export type BatchStatus = '生产中' | '待复核' | '可放行' | '隔离中' | '已放行' | '已报废'
export type DeviationStatus = '待调查' | '调查中' | '待复核' | '已关闭'
export type DecisionType = '返工' | '报废' | '让步接收'
export type CleaningStatus = '待确认' | '已确认' | '已换版' | '已过期'
export type CleaningResult = '合格' | '不合格'
export type AttemptOutcome = '已采纳' | '冲突保留'

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

/** 清洗结果的一次终端提交。id 为幂等键，重试同一提交不会产生第二条记录。 */
export interface CleaningAttempt {
  id: string
  terminal: string
  operator: string
  result: CleaningResult
  note: string
  submittedAt: string
  outcome: AttemptOutcome
}

/** 产线清洗验证记录，按版本管理；换版或超过有效时段后旧版本作废。 */
export interface CleaningRecord {
  id: string
  line: string
  version: number
  method: string
  fromProduct: string
  toProduct: string
  dairySwitch: boolean
  status: CleaningStatus
  result: CleaningResult | ''
  confirmedBy: string
  confirmedTerminal: string
  confirmedAt: string
  validUntil: string
  attempts: CleaningAttempt[]
}

/** 批次投产时绑定的放行依据：前一批产品 + 清洗结果版本。 */
export interface ReleaseBasis {
  previousBatchId: string
  previousProduct: string
  cleaningRecordId: string
  cleaningVersion: number
  boundAt: string
  validity: '有效' | '已失效'
  invalidReason: string
  recomputedAt: string
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
  releaseBasis: ReleaseBasis
  version: number
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
  /** 写入时的放行依据快照，追溯审计与批次详情显示同一依据。 */
  basis?: string
  createdAt: string
}
