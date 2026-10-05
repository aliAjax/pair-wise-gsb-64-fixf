export type BatchStatus = '生产中' | '待复核' | '可放行' | '隔离中' | '已放行' | '已报废'
export type DeviationStatus = '待调查' | '调查中' | '待复核' | '已关闭'
export type DecisionType = '返工' | '报废' | '让步接收'
export type CleaningStatus = '待确认' | '生效' | '已换版' | '不合格'
export type CleaningResult = '合格' | '不合格'

export interface ProcessStep {
  id: string
  name: string
  equipment: string
  hazard: string
  controlPoint: string
  limit: string
  frequency: string
  correctiveAction: string
}

export interface MonitoringValue {
  stepId: string
  value: number
  unit: string
  recordedAt: string
  operator: string
}

export interface Batch {
  id: string
  product: string
  line: string
  quantity: number
  producedAt: string
  status: BatchStatus
  isolationScope: string
  monitoring: MonitoringValue[]
  version: number
  prevBatchId: string | null
  prevProduct: string
  cleaningId: string
  cleaningVersion: number
  basisStale: boolean
  signedAt: string | null
  signedBy: string
}

export interface CleaningConfirmation {
  id: string
  terminal: string
  operator: string
  result: CleaningResult
  note: string
  submittedAt: string
  outcome: '生效' | '冲突'
  requestId: string
}

export interface CleaningRecord {
  id: string
  line: string
  switchFrom: string
  switchTo: string
  cleaningType: string
  result: CleaningResult
  version: number
  validFrom: string
  validUntil: string
  status: CleaningStatus
  effectiveConfirmationId: string | null
  confirmations: CleaningConfirmation[]
}

export interface CleaningConflict {
  id: string
  cleaningId: string
  terminal: string
  operator: string
  result: CleaningResult
  note: string
  conflictWithTerminal: string
  createdAt: string
}

export interface ReleaseBasis {
  batchId: string
  prevBatchId: string | null
  prevProduct: string
  cleaningId: string
  cleaningVersion: number
  cleaningStatus: CleaningStatus | '缺失'
  currentCleaningId: string | null
  currentCleaningVersion: number | null
  validUntil: string
  expired: boolean
  superseded: boolean
  stale: boolean
  signed: boolean
  signedBy: string
  signedAt: string | null
  openDeviations: number
  controlPointsCovered: number
  controlPointsTotal: number
  blockers: string[]
}

export interface Investigation {
  cause: string
  evidence: string
  decision: DecisionType
  reworkInstruction: string
}

export interface Deviation {
  id: string
  batchId: string
  stepId: string
  title: string
  severity: '一般' | '重大'
  status: DeviationStatus
  owner: string
  openedAt: string
  dueDate: string
  investigation: Investigation
  reviewNote: string
  reviewer: string
  version: number
}

export interface AuditEntry {
  id: string
  entity: string
  action: string
  operator: string
  detail: string
  createdAt: string
}
