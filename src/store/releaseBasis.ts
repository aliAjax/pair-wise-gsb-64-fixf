import type { Batch, CleaningRecord, Deviation, ProcessStep, ReleaseBasis } from '../types'

export interface BasisStateSlice {
  batches: Batch[]
  deviations: Deviation[]
  processSteps: ProcessStep[]
  cleaningRecords: CleaningRecord[]
}

export function isCleaningExpired(record: CleaningRecord, now = Date.now()) {
  if (!record.validUntil) return false
  return new Date(record.validUntil).getTime() <= now
}

export function isCleaningUsable(record: CleaningRecord | undefined, now = Date.now()) {
  return !!record && record.status === '生效' && !isCleaningExpired(record, now)
}

export function effectiveCleaningForLine(records: CleaningRecord[], line: string, now = Date.now()) {
  return records.find((record) => record.line === line && isCleaningUsable(record, now)) ?? null
}

export function computeReleaseBasis(state: BasisStateSlice, batchId: string, now = Date.now()): ReleaseBasis | null {
  const batch = state.batches.find((item) => item.id === batchId)
  if (!batch) return null
  const bound = state.cleaningRecords.find((record) => record.id === batch.cleaningId)
  const current = effectiveCleaningForLine(state.cleaningRecords, batch.line, now)
  const signed = !!batch.signedAt
  const expired = bound ? isCleaningExpired(bound, now) : false
  const superseded = bound ? bound.status === '已换版' : false
  const missing = !bound
  const versionMismatch = !!bound && bound.version !== batch.cleaningVersion
  // 已签字批次的放行依据随签字冻结，换版与过期不再影响；未签字批次立即失效重算。
  const stale = !signed && (batch.basisStale || missing || superseded || expired || versionMismatch || bound?.status !== '生效')
  const openDeviations = state.deviations.filter((item) => item.batchId === batch.id && item.status !== '已关闭').length
  const coveredSteps = new Set(batch.monitoring.map((item) => item.stepId))
  const blockers: string[] = []
  if (!signed) {
    if (missing) blockers.push('未绑定清洗结果，禁止放行')
    if (superseded) blockers.push(`清洗结果${batch.cleaningId}已换版，放行依据失效，需重新绑定`)
    if (expired) blockers.push(`清洗结果${batch.cleaningId}已超过有效时段（至${bound?.validUntil.slice(0, 16).replace('T', ' ')}），放行依据失效`)
    if (bound && bound.status === '待确认') blockers.push(`清洗结果${batch.cleaningId}尚未确认生效`)
    if (bound && bound.status === '不合格') blockers.push(`清洗结果${batch.cleaningId}判定不合格，需重新清洗`)
    if (versionMismatch && bound) blockers.push(`绑定版本V${batch.cleaningVersion}与清洗结果当前版本V${bound.version}不一致`)
  }
  if (openDeviations > 0) blockers.push(`仍有${openDeviations}项未关闭偏差`)
  return {
    batchId: batch.id,
    prevBatchId: batch.prevBatchId,
    prevProduct: batch.prevProduct,
    cleaningId: batch.cleaningId,
    cleaningVersion: batch.cleaningVersion,
    cleaningStatus: bound ? bound.status : '缺失',
    currentCleaningId: current?.id ?? null,
    currentCleaningVersion: current?.version ?? null,
    validUntil: bound?.validUntil ?? '',
    expired,
    superseded,
    stale,
    signed,
    signedBy: batch.signedBy,
    signedAt: batch.signedAt,
    openDeviations,
    controlPointsCovered: coveredSteps.size,
    controlPointsTotal: state.processSteps.length,
    blockers
  }
}
