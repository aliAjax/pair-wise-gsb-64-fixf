import type { Batch, CleaningRecord, Deviation } from '../types'

/** 放行依据计算所需的最小状态切片。 */
export interface BasisState {
  batches: Batch[]
  deviations: Deviation[]
  cleaningRecords: CleaningRecord[]
  clock: string
}

export interface ReleaseBasisView {
  batchId: string
  signed: boolean
  previousBatchId: string
  previousProduct: string
  cleaningRecordId: string
  cleaningVersion: number
  cleaningStatus: string
  validUntil: string
  boundAt: string
  validity: '有效' | '已失效'
  invalidReason: string
  openDeviations: number
  activeVersion: number
  reasons: string[]
  releasable: boolean
  summary: string
}

/** 产线当前生效的清洗结果：已确认、合格且仍在有效时段内的最高版本。 */
export function activeCleaning(records: CleaningRecord[], line: string, clock: string): CleaningRecord | undefined {
  return records
    .filter((item) => item.line === line && item.status === '已确认' && item.result === '合格' && item.validUntil > clock)
    .sort((a, b) => b.version - a.version)[0]
}

/**
 * 批次放行依据的统一视图：批次详情、偏差工作台与追溯审计共用，
 * 保证三个页面看到的是同一份判定。
 */
export function releaseBasisView(state: BasisState, batchId: string): ReleaseBasisView | null {
  const batch = state.batches.find((item) => item.id === batchId)
  if (!batch) return null
  const basis = batch.releaseBasis
  const record = state.cleaningRecords.find((item) => item.id === basis.cleaningRecordId)
  const active = activeCleaning(state.cleaningRecords, batch.line, state.clock)
  const openDeviations = state.deviations.filter((item) => item.batchId === batchId && item.status !== '已关闭').length
  const signed = batch.status === '已放行' || batch.status === '已报废'
  const reasons: string[] = []
  if (!signed) {
    if (basis.validity === '已失效') reasons.push(`依据已失效：${basis.invalidReason}`)
    if (!record) reasons.push('绑定的清洗记录不存在')
    else {
      if (record.status === '待确认') reasons.push(`清洗${record.id}尚未经终端确认`)
      if (record.status === '已换版') reasons.push(`清洗结果已换版，当前有效版本V${active?.version ?? '—'}`)
      if (record.status === '已过期') reasons.push(`清洗结果超过有效时段（${record.validUntil.slice(0, 16).replace('T', ' ')}）`)
      if (record.status === '已确认' && record.result !== '合格') reasons.push('清洗结果判定不合格')
      if (record.status === '已确认' && record.validUntil <= state.clock) reasons.push('清洗结果已超出有效时段，待系统换版')
      if (active && active.id !== record.id) reasons.push(`产线已启用清洗V${active.version}，本批次仍绑定V${record.version}`)
      if (!active && record.status === '已确认') reasons.push('产线当前无有效清洗结果')
    }
    if (openDeviations > 0) reasons.push(`${openDeviations}项偏差未关闭`)
  }
  return {
    batchId,
    signed,
    previousBatchId: basis.previousBatchId,
    previousProduct: basis.previousProduct,
    cleaningRecordId: basis.cleaningRecordId,
    cleaningVersion: basis.cleaningVersion,
    cleaningStatus: record ? record.status : '记录缺失',
    validUntil: record ? record.validUntil : '',
    boundAt: basis.boundAt,
    validity: basis.validity,
    invalidReason: basis.invalidReason,
    openDeviations,
    activeVersion: active?.version ?? basis.cleaningVersion,
    reasons,
    releasable: !signed && reasons.length === 0,
    summary: `${basis.cleaningRecordId} V${basis.cleaningVersion} · ${basis.validity}`
  }
}
