import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit'
import { processSteps, seedAudit, seedBatches, seedCleaningRecords, seedClock, seedDeviations } from '../data/seed'
import { activeCleaning, releaseBasisView } from '../services/releaseBasis'
import type { AuditEntry, Batch, BatchStatus, CleaningAttempt, CleaningRecord, CleaningResult, Deviation, Investigation, ProcessStep } from '../types'

export const WORKING_KEY = 'gsb64:haccp-platform'
export const COMMITTED_KEY = 'gsb64:haccp-committed'

interface PersistMeta {
  status: '已同步' | '写入失败' | '已恢复'
  committedAt: string
  recoveredAt: string
  simulateFailure: boolean
}

interface HaccpState {
  batches: Batch[]
  deviations: Deviation[]
  cleaningRecords: CleaningRecord[]
  processSteps: ProcessStep[]
  audit: AuditEntry[]
  clock: string
  persist: PersistMeta
  batchFilter: string
  batchStatus: BatchStatus | '全部'
  selectedBatchId: string | null
}

function seedState(): HaccpState {
  return {
    batches: structuredClone(seedBatches),
    deviations: structuredClone(seedDeviations),
    cleaningRecords: structuredClone(seedCleaningRecords),
    processSteps,
    audit: structuredClone(seedAudit),
    clock: seedClock,
    persist: { status: '已同步', committedAt: seedClock, recoveredAt: '', simulateFailure: false },
    batchFilter: '',
    batchStatus: '全部',
    selectedBatchId: seedBatches[0].id
  }
}

function initialState(): HaccpState {
  try {
    const raw = localStorage.getItem(WORKING_KEY) ?? localStorage.getItem(COMMITTED_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      // 旧版本持久化数据缺少清洗记录或时钟时回退到种子数据。
      if (parsed && Array.isArray(parsed.cleaningRecords) && parsed.persist && parsed.clock) return parsed
    }
  } catch {
    // Seed data remains available when local storage is unavailable or corrupt.
  }
  return seedState()
}

/** 幂等审计：同一 key 的重试只保留第一条记录。 */
function log(state: HaccpState, entity: string, action: string, operator: string, detail: string, key?: string, basis?: string) {
  const id = key ?? nanoid()
  if (state.audit.some((entry) => entry.id === id)) return
  state.audit.unshift({ id, entity, action, operator, detail, basis, createdAt: state.clock })
}

/** 域变更落笔时更新最近完整提交时间；写入失败期间不推进。 */
function touch(state: HaccpState) {
  if (state.persist.simulateFailure) return
  state.persist.committedAt = state.clock
  if (state.persist.status !== '已同步') state.persist.status = '已同步'
}

/** 清洗结果换版或超期后，绑定该版本的未签字批次立即失效并重算状态。 */
function invalidateBatchesForCleaning(state: HaccpState, record: CleaningRecord, reason: string) {
  for (const batch of state.batches) {
    if (batch.line !== record.line || batch.releaseBasis.cleaningRecordId !== record.id) continue
    if (batch.status === '已放行' || batch.status === '已报废') continue
    if (batch.releaseBasis.validity === '已失效') continue
    batch.releaseBasis.validity = '已失效'
    batch.releaseBasis.invalidReason = reason
    batch.releaseBasis.recomputedAt = state.clock
    batch.version += 1
    const hasOpenDeviation = state.deviations.some((item) => item.batchId === batch.id && item.status !== '已关闭')
    batch.status = hasOpenDeviation ? '隔离中' : '生产中'
    log(state, batch.id, '放行依据失效重算', '系统', `${reason}，批次状态重算为${batch.status}`, `basis-invalid-${batch.id}-${record.id}`, `${record.id} V${record.version} · 已失效`)
  }
}

const slice = createSlice({
  name: 'haccp',
  initialState,
  reducers: {
    setBatchFilter(state, action: PayloadAction<string>) { state.batchFilter = action.payload },
    setBatchStatus(state, action: PayloadAction<BatchStatus | '全部'>) { state.batchStatus = action.payload },
    setSelectedBatch(state, action: PayloadAction<string | null>) { state.selectedBatchId = action.payload },
    updateProcessStep(state, action: PayloadAction<ProcessStep>) {
      const index = state.processSteps.findIndex((item) => item.id === action.payload.id)
      if (index >= 0) state.processSteps[index] = action.payload
      log(state, action.payload.id, '修改控制措施', '质量主管', `更新${action.payload.name}关键限值或监控要求`)
      touch(state)
    },
    startBatch(state, action: PayloadAction<{ product: string; line: string; quantity: number; operator: string }>) {
      const active = activeCleaning(state.cleaningRecords, action.payload.line, state.clock)
      if (!active) {
        log(state, action.payload.line, '投产被拦截', action.payload.operator, `${action.payload.line}无有效清洗结果，批次投产被拒绝`)
        return
      }
      const day = state.clock.slice(2, 10).replaceAll('-', '')
      const seq = state.batches.filter((item) => item.id.startsWith(`B${day}`)).length + 1
      const id = `B${day}-${String(seq).padStart(2, '0')}`
      const previous = state.batches.filter((item) => item.line === action.payload.line).sort((a, b) => b.producedAt.localeCompare(a.producedAt))[0]
      const batch: Batch = {
        id, product: action.payload.product, line: action.payload.line, quantity: action.payload.quantity,
        producedAt: state.clock, status: '生产中', isolationScope: '无', monitoring: [], version: 1,
        releaseBasis: {
          previousBatchId: previous?.id ?? '无',
          previousProduct: previous ? previous.product : '无（产线首批）',
          cleaningRecordId: active.id, cleaningVersion: active.version,
          boundAt: state.clock, validity: '有效', invalidReason: '', recomputedAt: state.clock
        }
      }
      state.batches.unshift(batch)
      state.selectedBatchId = id
      log(state, id, '批次投产绑定', action.payload.operator, `绑定前批${batch.releaseBasis.previousBatchId}（${batch.releaseBasis.previousProduct}）与清洗${active.id} V${active.version}`, undefined, `${active.id} V${active.version} · 有效`)
      touch(state)
    },
    submitCleaningConfirmation(state, action: PayloadAction<{ recordId: string; attempt: Omit<CleaningAttempt, 'outcome' | 'submittedAt'> }>) {
      const record = state.cleaningRecords.find((item) => item.id === action.payload.recordId)
      if (!record) return
      const attempt: CleaningAttempt = { ...action.payload.attempt, submittedAt: state.clock, outcome: '已采纳' }
      // 同一终端同一提交的重试直接忽略，不重复追加审计。
      if (record.attempts.some((item) => item.id === attempt.id)) return
      if (record.status !== '待确认') {
        // 后到者：先到者已生效，输入保留为冲突记录。
        attempt.outcome = '冲突保留'
        record.attempts.push(attempt)
        log(state, record.id, '终端确认冲突', attempt.operator, `${attempt.terminal}提交时${record.confirmedTerminal}已确认V${record.version}，输入保留为冲突记录`, `cl-conflict-${attempt.id}`)
        touch(state)
        return
      }
      // 先到者生效。
      record.result = attempt.result
      record.confirmedBy = attempt.operator
      record.confirmedTerminal = attempt.terminal
      record.confirmedAt = state.clock
      record.attempts.push(attempt)
      if (attempt.result !== '合格') {
        log(state, record.id, '清洗结果不合格', attempt.operator, `${attempt.terminal}判定${record.line}清洗V${record.version}不合格，需重新清洗`, `cl-reject-${attempt.id}`)
        touch(state)
        return
      }
      record.status = '已确认'
      log(state, record.id, '清洗结果确认', attempt.operator, `${attempt.terminal}确认${record.line}清洗V${record.version}合格，有效期至${record.validUntil.slice(0, 16).replace('T', ' ')}`, `cl-confirm-${attempt.id}`)
      // 新版本生效即换版：作废旧版本并让绑定旧版本的未签字批次失效重算。
      for (const other of state.cleaningRecords) {
        if (other.line !== record.line || other.id === record.id || other.status !== '已确认') continue
        other.status = '已换版'
        log(state, other.id, '清洗结果换版', '系统', `${record.line}启用V${record.version}，V${other.version}作废`, `revise-${other.id}-by-${record.id}`)
        invalidateBatchesForCleaning(state, other, `清洗结果换版为${record.id} V${record.version}`)
      }
      touch(state)
    },
    issueCleaningRevision(state, action: PayloadAction<{ line: string; method: string; fromProduct: string; toProduct: string; dairySwitch: boolean; validHours: number; operator: string }>) {
      const version = Math.max(0, ...state.cleaningRecords.filter((item) => item.line === action.payload.line).map((item) => item.version)) + 1
      const id = `CL-${action.payload.line}-${String(version).padStart(3, '0')}`
      if (state.cleaningRecords.some((item) => item.id === id)) return
      const validUntil = new Date(new Date(state.clock).getTime() + action.payload.validHours * 3600_000).toISOString()
      const record: CleaningRecord = {
        id, line: action.payload.line, version, method: action.payload.method,
        fromProduct: action.payload.fromProduct, toProduct: action.payload.toProduct, dairySwitch: action.payload.dairySwitch,
        status: '待确认', result: '', confirmedBy: '', confirmedTerminal: '', confirmedAt: '', validUntil, attempts: []
      }
      state.cleaningRecords.unshift(record)
      log(state, id, '发起清洗换版', action.payload.operator, `${action.payload.line}发起清洗V${version}（${action.payload.fromProduct}→${action.payload.toProduct}），待终端确认`, `cl-issue-${id}`)
      touch(state)
    },
    advanceClock(state, action: PayloadAction<number>) {
      state.clock = new Date(new Date(state.clock).getTime() + action.payload * 3600_000).toISOString()
      for (const record of state.cleaningRecords) {
        if (record.status === '已确认' && record.validUntil <= state.clock) {
          record.status = '已过期'
          log(state, record.id, '清洗结果超过有效时段', '系统', `${record.line}清洗V${record.version}有效期至${record.validUntil.slice(0, 16).replace('T', ' ')}，已过期`, `expire-${record.id}`)
          invalidateBatchesForCleaning(state, record, `清洗${record.id} V${record.version}超过有效时段`)
        }
      }
      touch(state)
    },
    rebindBatch(state, action: PayloadAction<{ id: string; operator: string }>) {
      const batch = state.batches.find((item) => item.id === action.payload.id)
      if (!batch || batch.status === '已放行' || batch.status === '已报废') return
      if (batch.releaseBasis.validity !== '已失效') return
      const active = activeCleaning(state.cleaningRecords, batch.line, state.clock)
      if (!active) return
      batch.releaseBasis.cleaningRecordId = active.id
      batch.releaseBasis.cleaningVersion = active.version
      batch.releaseBasis.boundAt = state.clock
      batch.releaseBasis.validity = '有效'
      batch.releaseBasis.invalidReason = ''
      batch.releaseBasis.recomputedAt = state.clock
      batch.version += 1
      const hasOpenDeviation = state.deviations.some((item) => item.batchId === batch.id && item.status !== '已关闭')
      batch.status = hasOpenDeviation ? '隔离中' : '待复核'
      log(state, batch.id, '重新绑定放行依据', action.payload.operator, `重新绑定清洗${active.id} V${active.version}，批次状态重算为${batch.status}`, `rebind-${batch.id}-${active.id}`, `${active.id} V${active.version} · 有效`)
      touch(state)
    },
    updateBatchStatus(state, action: PayloadAction<{ id: string; status: BatchStatus; operator?: string }>) {
      const batch = state.batches.find((item) => item.id === action.payload.id)
      if (!batch || batch.status === '已放行' || batch.status === '已报废') return
      const view = releaseBasisView(state, batch.id)
      // 放行与签字都必须以同一份有效依据为前提，未关闭偏差或失效依据一律拦截。
      if (action.payload.status === '可放行' && !view?.releasable) return
      if (action.payload.status === '已放行' && (batch.status !== '可放行' || !view?.releasable)) return
      batch.status = action.payload.status
      batch.version += 1
      log(state, batch.id, '批次状态流转', action.payload.operator ?? '质量主管', `状态更新为${action.payload.status}`, undefined, view?.summary)
      touch(state)
    },
    createDeviation(state, action: PayloadAction<{ batchId: string; stepId: string; title: string; severity: '一般' | '重大'; owner: string }>) {
      const batch = state.batches.find((item) => item.id === action.payload.batchId)
      if (!batch) return
      const deviation: Deviation = {
        id: `DEV-${Date.now().toString().slice(-8)}`, ...action.payload, status: '待调查', openedAt: state.clock,
        dueDate: new Date(new Date(state.clock).getTime() + 86400000).toISOString().slice(0, 10), reviewNote: '', reviewer: '', version: 1,
        investigation: { cause: '', evidence: '', decision: '返工', reworkInstruction: '' }
      }
      state.deviations.unshift(deviation)
      batch.status = '隔离中'
      batch.version += 1
      log(state, deviation.id, '创建偏差调查', '当前用户', `批次${batch.id}因${action.payload.title}进入隔离`, undefined, releaseBasisView(state, batch.id)?.summary)
      touch(state)
    },
    saveInvestigation(state, action: PayloadAction<{ id: string; investigation: Investigation }>) {
      const deviation = state.deviations.find((item) => item.id === action.payload.id)
      if (!deviation || !action.payload.investigation.cause.trim() || !action.payload.investigation.evidence.trim()) return
      deviation.investigation = action.payload.investigation
      deviation.status = '待复核'
      deviation.version += 1
      log(state, deviation.id, '提交偏差调查', deviation.owner, `处置分支：${deviation.investigation.decision}`)
      touch(state)
    },
    reviewDeviation(state, action: PayloadAction<{ id: string; approved: boolean; note: string; reviewer: string }>) {
      const deviation = state.deviations.find((item) => item.id === action.payload.id)
      if (!deviation) return
      if (action.payload.approved && !action.payload.note.trim()) return
      deviation.reviewNote = action.payload.note
      deviation.reviewer = action.payload.reviewer
      deviation.status = action.payload.approved ? '已关闭' : '调查中'
      deviation.version += 1
      const batch = state.batches.find((item) => item.id === deviation.batchId)
      if (batch && action.payload.approved && !state.deviations.some((item) => item.batchId === batch.id && item.status !== '已关闭' && item.id !== deviation.id)) {
        // 依据已失效的批次不能回到待复核，需先重新绑定清洗版本。
        batch.status = deviation.investigation.decision === '报废' ? '已报废' : batch.releaseBasis.validity === '有效' ? '待复核' : '生产中'
        batch.version += 1
      }
      log(state, deviation.id, action.payload.approved ? '复核通过' : '退回补证', action.payload.reviewer, action.payload.note || '退回调查')
      touch(state)
    },
    simulateWriteFailure(state, action: PayloadAction<boolean>) {
      state.persist.simulateFailure = action.payload
      state.persist.status = action.payload ? '写入失败' : '已同步'
    },
    recoverLastCommitted(state) {
      try {
        const raw = localStorage.getItem(COMMITTED_KEY)
        if (!raw) return
        const committed = JSON.parse(raw) as HaccpState
        if (!committed || !Array.isArray(committed.batches) || !Array.isArray(committed.audit)) return
        const recoveredAt = state.clock
        state.batches = committed.batches
        state.deviations = committed.deviations
        state.cleaningRecords = committed.cleaningRecords
        state.processSteps = committed.processSteps
        state.audit = committed.audit
        state.clock = committed.clock
        state.persist = { status: '已恢复', committedAt: committed.persist?.committedAt ?? committed.clock, recoveredAt, simulateFailure: false }
        log(state, '持久层', '按最近完整提交恢复', '系统', `恢复至${state.persist.committedAt.slice(0, 16).replace('T', ' ')}的完整批次快照，失败期间的写入已回滚`, `recover-${state.persist.committedAt}`)
      } catch {
        // 快照不可读时保持当前状态，等待人工处理。
      }
    },
    resetDemo() {
      return seedState()
    }
  }
})

export const {
  setBatchFilter, setBatchStatus, setSelectedBatch, updateProcessStep, startBatch,
  submitCleaningConfirmation, issueCleaningRevision, advanceClock, rebindBatch,
  updateBatchStatus, createDeviation, saveInvestigation, reviewDeviation,
  simulateWriteFailure, recoverLastCommitted, resetDemo
} = slice.actions
export default slice.reducer
