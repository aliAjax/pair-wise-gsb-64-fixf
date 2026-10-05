import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit'
import { seedAudit, seedBatches, seedCleaningConflicts, seedCleaningRecords, seedDeviations, processSteps } from '../data/seed'
import { computeReleaseBasis, effectiveCleaningForLine } from './releaseBasis'
import type { AuditEntry, Batch, BatchStatus, CleaningConflict, CleaningRecord, CleaningResult, Deviation, ProcessStep } from '../types'

interface HaccpState {
  batches: Batch[]
  deviations: Deviation[]
  processSteps: ProcessStep[]
  cleaningRecords: CleaningRecord[]
  cleaningConflicts: CleaningConflict[]
  audit: AuditEntry[]
  processedRequests: string[]
  batchFilter: string
  batchStatus: BatchStatus | '全部'
  selectedBatchId: string | null
}

interface PersistedState extends HaccpState {}
const STORAGE_KEY = 'gsb64:haccp-platform'

function freshState(): HaccpState {
  return {
    batches: structuredClone(seedBatches),
    deviations: structuredClone(seedDeviations),
    processSteps,
    cleaningRecords: structuredClone(seedCleaningRecords),
    cleaningConflicts: structuredClone(seedCleaningConflicts),
    audit: structuredClone(seedAudit),
    processedRequests: [],
    batchFilter: '',
    batchStatus: '全部',
    selectedBatchId: seedBatches[0].id
  }
}

function migrate(parsed: Partial<HaccpState>): HaccpState {
  const fresh = freshState()
  return {
    ...fresh,
    ...parsed,
    batches: (parsed.batches ?? fresh.batches).map((batch) => {
      const legacy = batch as Partial<Batch>
      return {
        ...batch,
        prevBatchId: legacy.prevBatchId ?? null,
        prevProduct: legacy.prevProduct ?? '',
        cleaningId: legacy.cleaningId ?? '',
        cleaningVersion: legacy.cleaningVersion ?? 0,
        basisStale: legacy.basisStale ?? false,
        signedAt: legacy.signedAt ?? null,
        signedBy: legacy.signedBy ?? ''
      }
    }),
    cleaningRecords: parsed.cleaningRecords ?? fresh.cleaningRecords,
    cleaningConflicts: parsed.cleaningConflicts ?? fresh.cleaningConflicts,
    processedRequests: parsed.processedRequests ?? []
  }
}

function initialState(): HaccpState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return migrate(JSON.parse(raw))
  } catch {
    // Seed data remains available when local storage is unavailable or corrupt.
  }
  return freshState()
}

// 幂等：同一requestId只应用一次，重试不会重复追加审计。
function alreadyProcessed(state: HaccpState, requestId?: string) {
  return !!requestId && state.processedRequests.includes(requestId)
}

function markProcessed(state: HaccpState, requestId?: string) {
  if (!requestId) return
  state.processedRequests.push(requestId)
  if (state.processedRequests.length > 300) state.processedRequests.splice(0, state.processedRequests.length - 300)
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
    },
    createBatch(state, action: PayloadAction<{ requestId: string; product: string; line: string; quantity: number; operator: string }>) {
      if (alreadyProcessed(state, action.payload.requestId)) return
      const cleaning = effectiveCleaningForLine(state.cleaningRecords, action.payload.line)
      if (!cleaning) return // 产线无生效清洗结果，禁止投产
      const now = new Date()
      const prevBatch = state.batches
        .filter((item) => item.line === action.payload.line)
        .sort((a, b) => b.producedAt.localeCompare(a.producedAt))[0] ?? null
      const datePart = now.toISOString().slice(2, 10).replace(/-/g, '')
      const seq = state.batches.filter((item) => item.id.startsWith(`B${datePart}`)).length + 1
      const batch: Batch = {
        id: `B${datePart}-${String(seq).padStart(2, '0')}`,
        product: action.payload.product,
        line: action.payload.line,
        quantity: action.payload.quantity,
        producedAt: now.toISOString(),
        status: '生产中',
        isolationScope: '无',
        monitoring: [],
        version: 1,
        prevBatchId: prevBatch?.id ?? null,
        prevProduct: prevBatch ? prevBatch.product : '无（本线首批）',
        cleaningId: cleaning.id,
        cleaningVersion: cleaning.version,
        basisStale: false,
        signedAt: null,
        signedBy: ''
      }
      state.batches.unshift(batch)
      state.selectedBatchId = batch.id
      log(state, batch.id, '批次投产', action.payload.operator, `绑定前批${batch.prevBatchId ?? '无'}（${batch.prevProduct}）与清洗结果${cleaning.id} V${cleaning.version}`)
      markProcessed(state, action.payload.requestId)
    },
    createCleaningRecord(state, action: PayloadAction<{ requestId: string; line: string; switchFrom: string; switchTo: string; cleaningType: string; operator: string }>) {
      if (alreadyProcessed(state, action.payload.requestId)) return
      const version = Math.max(0, ...state.cleaningRecords.filter((item) => item.line === action.payload.line).map((item) => item.version)) + 1
      const record: CleaningRecord = {
        id: `CLN-${Date.now().toString().slice(-6)}`,
        line: action.payload.line,
        switchFrom: action.payload.switchFrom,
        switchTo: action.payload.switchTo,
        cleaningType: action.payload.cleaningType,
        result: '合格',
        version,
        validFrom: '',
        validUntil: '',
        status: '待确认',
        effectiveConfirmationId: null,
        confirmations: []
      }
      state.cleaningRecords.unshift(record)
      log(state, record.id, '登记清洗结果', action.payload.operator, `${record.line}线${record.switchFrom}→${record.switchTo}，V${record.version}待终端确认`)
      markProcessed(state, action.payload.requestId)
    },
    confirmCleaning(state, action: PayloadAction<{ requestId: string; cleaningId: string; terminal: string; operator: string; result: CleaningResult; note: string; validHours: number }>) {
      if (alreadyProcessed(state, action.payload.requestId)) return
      const record = state.cleaningRecords.find((item) => item.id === action.payload.cleaningId)
      if (!record) return
      const now = new Date()
      const confirmation = {
        id: `CFM-${nanoid(6)}`,
        terminal: action.payload.terminal,
        operator: action.payload.operator,
        result: action.payload.result,
        note: action.payload.note,
        submittedAt: now.toISOString(),
        outcome: '冲突' as '生效' | '冲突',
        requestId: action.payload.requestId
      }
      if (record.effectiveConfirmationId) {
        // 先到者已生效：后到者保留输入并登记冲突记录，不改写清洗结果。
        record.confirmations.push(confirmation)
        const winner = record.confirmations.find((item) => item.id === record.effectiveConfirmationId)
        const conflict: CleaningConflict = {
          id: `CNF-${nanoid(6)}`,
          cleaningId: record.id,
          terminal: confirmation.terminal,
          operator: confirmation.operator,
          result: confirmation.result,
          note: confirmation.note,
          conflictWithTerminal: winner?.terminal ?? '未知终端',
          createdAt: now.toISOString()
        }
        state.cleaningConflicts.unshift(conflict)
        log(state, record.id, '清洗确认冲突', confirmation.operator, `${confirmation.terminal}晚于${conflict.conflictWithTerminal}提交，输入已保留为冲突记录${conflict.id}`)
      } else {
        confirmation.outcome = '生效'
        record.confirmations.push(confirmation)
        record.effectiveConfirmationId = confirmation.id
        record.result = confirmation.result
        record.validFrom = now.toISOString()
        record.validUntil = new Date(now.getTime() + action.payload.validHours * 3600000).toISOString()
        if (confirmation.result === '不合格') {
          record.status = '不合格'
          log(state, record.id, '清洗结果不合格', confirmation.operator, `${confirmation.terminal}确认不合格，需重新清洗并登记换版`)
        } else {
          record.status = '生效'
          // 换版：同线先生效的清洗结果作废，绑定它的未签字批次立即失效重算。
          for (const other of state.cleaningRecords) {
            if (other.line !== record.line || other.id === record.id || other.status !== '生效') continue
            other.status = '已换版'
            for (const batch of state.batches) {
              if (batch.line !== record.line || batch.cleaningId !== other.id || batch.signedAt || batch.status === '已放行' || batch.status === '已报废') continue
              batch.basisStale = true
              batch.version += 1
              log(state, batch.id, '放行依据失效', '系统', `绑定的清洗结果${other.id}已换版为${record.id} V${record.version}，需重新绑定后重算`)
            }
            log(state, other.id, '清洗结果换版', '系统', `被${record.id} V${record.version}取代`)
          }
          log(state, record.id, '清洗结果确认生效', confirmation.operator, `${confirmation.terminal}首到确认，V${record.version}有效期至${record.validUntil.slice(0, 16).replace('T', ' ')}`)
        }
      }
      markProcessed(state, action.payload.requestId)
    },
    rebindBatchCleaning(state, action: PayloadAction<{ requestId: string; batchId: string; operator: string }>) {
      if (alreadyProcessed(state, action.payload.requestId)) return
      const batch = state.batches.find((item) => item.id === action.payload.batchId)
      if (!batch || batch.signedAt) return
      const cleaning = effectiveCleaningForLine(state.cleaningRecords, batch.line)
      if (!cleaning) return // 无生效清洗结果可绑，保持失效状态
      batch.cleaningId = cleaning.id
      batch.cleaningVersion = cleaning.version
      batch.basisStale = false
      batch.version += 1
      log(state, batch.id, '放行依据重算', action.payload.operator, `重新绑定清洗结果${cleaning.id} V${cleaning.version}，有效期至${cleaning.validUntil.slice(0, 16).replace('T', ' ')}`)
      markProcessed(state, action.payload.requestId)
    },
    updateBatchStatus(state, action: PayloadAction<{ id: string; status: BatchStatus; operator?: string }>) {
      const batch = state.batches.find((item) => item.id === action.payload.id)
      if (!batch || batch.status === action.payload.status) return
      const basis = computeReleaseBasis(state, batch.id)
      if ((action.payload.status === '可放行' || action.payload.status === '已放行') && (!basis || basis.blockers.length > 0)) return
      if (action.payload.status === '已放行' && batch.status !== '可放行') return
      batch.status = action.payload.status
      batch.version += 1
      if (action.payload.status === '已放行') {
        batch.signedAt = new Date().toISOString()
        batch.signedBy = action.payload.operator ?? '质量负责人 秦岚'
        log(state, batch.id, '签字放行', batch.signedBy, `依据清洗结果${batch.cleaningId} V${batch.cleaningVersion}签字，依据随签字冻结`)
      } else {
        log(state, batch.id, '批次状态流转', action.payload.operator ?? '质量主管', `状态更新为${action.payload.status}`)
      }
    },
    createDeviation(state, action: PayloadAction<{ batchId: string; stepId: string; title: string; severity: '一般' | '重大'; owner: string }>) {
      const batch = state.batches.find((item) => item.id === action.payload.batchId)
      if (!batch) return
      const now = new Date().toISOString()
      const deviation: Deviation = {
        id: `DEV-${Date.now().toString().slice(-8)}`, ...action.payload, status: '待调查', openedAt: now,
        dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), reviewNote: '', reviewer: '', version: 1,
        investigation: { cause: '', evidence: '', decision: '返工', reworkInstruction: '' }
      }
      state.deviations.unshift(deviation)
      batch.status = '隔离中'
      batch.version += 1
      log(state, deviation.id, '创建偏差调查', '当前用户', `批次${batch.id}因${action.payload.title}进入隔离`)
    },
    saveInvestigation(state, action: PayloadAction<{ id: string; investigation: Deviation['investigation'] }>) {
      const deviation = state.deviations.find((item) => item.id === action.payload.id)
      if (!deviation || !action.payload.investigation.cause.trim() || !action.payload.investigation.evidence.trim()) return
      deviation.investigation = action.payload.investigation
      deviation.status = '待复核'
      deviation.version += 1
      log(state, deviation.id, '提交偏差调查', deviation.owner, `处置分支：${deviation.investigation.decision}`)
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
        batch.status = deviation.investigation.decision === '报废' ? '已报废' : '待复核'
        batch.version += 1
      }
      log(state, deviation.id, action.payload.approved ? '复核通过' : '退回补证', action.payload.reviewer, action.payload.note || '退回调查')
    },
    restoreSnapshot(_state, action: PayloadAction<HaccpState>) {
      // 写入失败后按最近完整批次恢复，不追加审计。
      return action.payload
    },
    resetDemo() {
      return freshState()
    }
  }
})

function log(state: HaccpState, entity: string, action: string, operator: string, detail: string) {
  state.audit.unshift({ id: nanoid(), entity, action, operator, detail, createdAt: new Date().toISOString() })
}

export const {
  setBatchFilter, setBatchStatus, setSelectedBatch, updateProcessStep, createBatch, createCleaningRecord,
  confirmCleaning, rebindBatchCleaning, updateBatchStatus, createDeviation, saveInvestigation, reviewDeviation,
  restoreSnapshot, resetDemo
} = slice.actions
export type { HaccpState, PersistedState }
export default slice.reducer
