import type { AuditEntry, Batch, CleaningConflict, CleaningRecord, Deviation, ProcessStep } from '../types'

export const processSteps: ProcessStep[] = [
  { id: 'P1', name: '原料验收', equipment: '冷藏收货台', hazard: '致病菌、温度失控', controlPoint: '原料中心温度', limit: '≤ 4 ℃', frequency: '每批', correctiveAction: '拒收并隔离供应商批次' },
  { id: 'P2', name: '巴氏杀菌', equipment: 'HTST-02', hazard: '致病菌残留', controlPoint: '杀菌温度', limit: '≥ 72 ℃ / 15 s', frequency: '连续记录', correctiveAction: '自动回流并触发偏差' },
  { id: 'P3', name: '金属探测', equipment: 'MD-06', hazard: '金属异物', controlPoint: 'Fe/SUS灵敏度', limit: 'Fe 1.5 mm / SUS 2.0 mm', frequency: '每半小时', correctiveAction: '隔离末次合格点以来产品' },
  { id: 'P4', name: '灌装封口', equipment: 'FILL-01', hazard: '密封不良', controlPoint: '封口压力', limit: '0.38-0.45 MPa', frequency: '每小时', correctiveAction: '停机调机并复检留样' },
  { id: 'P5', name: '终产品冷却', equipment: '冷却隧道', hazard: '芽孢萌发', controlPoint: '冷却结束温度', limit: '≤ 10 ℃ / 2 h', frequency: '每批', correctiveAction: '延长冷却并观察质量' }
]

export const seedCleaningRecords: CleaningRecord[] = [
  {
    id: 'CLN-260929-01', line: 'L1', switchFrom: '低脂牛奶 1L（含奶）', switchTo: '低温鲜奶 950mL（含奶）', cleaningType: 'CIP标准清洗', result: '合格', version: 1,
    validFrom: '2026-09-29T04:00:00', validUntil: '2026-09-29T16:00:00', status: '生效', effectiveConfirmationId: 'CFM-1',
    confirmations: [
      { id: 'CFM-1', terminal: '终端T-01', operator: '班长 王海涛', result: '合格', note: '罐体清洗表复核无误，电导率与ATP涂抹合格', submittedAt: '2026-09-29T04:12:00', outcome: '生效', requestId: 'seed-cfm-1' },
      { id: 'CFM-2', terminal: '终端T-02', operator: '班长 王海涛', result: '合格', note: '交接班重复提交', submittedAt: '2026-09-29T04:13:00', outcome: '冲突', requestId: 'seed-cfm-2' }
    ]
  },
  {
    id: 'CLN-260929-02', line: 'L2', switchFrom: '蓝莓果汁饮料 500mL（无奶）', switchTo: '原味酸奶 200g（含奶）', cleaningType: 'CIP+过敏原验证', result: '合格', version: 1,
    validFrom: '2026-09-29T07:00:00', validUntil: '2026-10-08T07:00:00', status: '生效', effectiveConfirmationId: 'CFM-3',
    confirmations: [
      { id: 'CFM-3', terminal: '终端T-02', operator: '班长 李珍', result: '合格', note: '过敏原试纸条阴性，ATP涂抹合格', submittedAt: '2026-09-29T07:08:00', outcome: '生效', requestId: 'seed-cfm-3' }
    ]
  },
  {
    id: 'CLN-260929-03', line: 'L2', switchFrom: '原味酸奶 200g（含奶）', switchTo: '橙汁饮品 1L（无奶）', cleaningType: 'CIP+过敏原验证', result: '合格', version: 2,
    validFrom: '', validUntil: '', status: '待确认', effectiveConfirmationId: null,
    confirmations: []
  }
]

export const seedCleaningConflicts: CleaningConflict[] = [
  { id: 'CNF-1', cleaningId: 'CLN-260929-01', terminal: '终端T-02', operator: '班长 王海涛', result: '合格', note: '交接班重复提交', conflictWithTerminal: '终端T-01', createdAt: '2026-09-29T04:13:00' }
]

export const seedBatches: Batch[] = [
  {
    id: 'B260929-01', product: '低温鲜奶 950mL', line: 'L1', quantity: 3200, producedAt: '2026-09-29T06:20:00', status: '隔离中', isolationScope: '杀菌后至金属探测前全部在制品', version: 4,
    prevBatchId: 'B260928-07', prevProduct: '低脂牛奶 1L（含奶）', cleaningId: 'CLN-260929-01', cleaningVersion: 1, basisStale: false, signedAt: null, signedBy: '',
    monitoring: [
      { stepId: 'P1', value: 3.4, unit: '℃', recordedAt: '2026-09-29T06:25:00', operator: '陈莉' },
      { stepId: 'P2', value: 70.8, unit: '℃', recordedAt: '2026-09-29T06:48:00', operator: '系统采集' },
      { stepId: 'P3', value: 1.5, unit: 'mm Fe', recordedAt: '2026-09-29T07:20:00', operator: '杨鸣' }
    ]
  },
  {
    id: 'B260929-02', product: '原味酸奶 200g', line: 'L2', quantity: 8600, producedAt: '2026-09-29T08:10:00', status: '待复核', isolationScope: 'FILL-01本次清洁后产品', version: 3,
    prevBatchId: 'B260928-11', prevProduct: '蓝莓果汁饮料 500mL（无奶）', cleaningId: 'CLN-260929-02', cleaningVersion: 1, basisStale: false, signedAt: null, signedBy: '',
    monitoring: [
      { stepId: 'P4', value: 0.36, unit: 'MPa', recordedAt: '2026-09-29T08:40:00', operator: '系统采集' },
      { stepId: 'P5', value: 8.2, unit: '℃', recordedAt: '2026-09-29T10:10:00', operator: '郑凯' }
    ]
  },
  {
    id: 'B260928-07', product: '低脂牛奶 1L', line: 'L1', quantity: 5100, producedAt: '2026-09-28T16:20:00', status: '已放行', isolationScope: '无', version: 6,
    prevBatchId: 'B260928-03', prevProduct: '全麦谷物饮品 330mL（无奶）', cleaningId: 'CLN-260928-02', cleaningVersion: 1, basisStale: false, signedAt: '2026-09-28T19:40:00', signedBy: '质量负责人 秦岚',
    monitoring: processSteps.map((step, index) => ({ stepId: step.id, value: [3.0, 73.2, 1.2, 0.41, 7.8][index], unit: ['℃', '℃', 'mm Fe', 'MPa', '℃'][index], recordedAt: '2026-09-28T17:00:00', operator: '生产线记录' }))
  }
]

export const seedDeviations: Deviation[] = [
  {
    id: 'DEV-260929-01', batchId: 'B260929-01', stepId: 'P2', title: '杀菌温度低于关键限值', severity: '重大', status: '调查中', owner: '质量工程组', openedAt: '2026-09-29T06:55:00', dueDate: '2026-09-29', version: 3,
    investigation: { cause: '蒸汽调节阀响应滞后', evidence: '趋势图显示70.8℃持续42秒；阀门检修记录已上传', decision: '返工', reworkInstruction: '隔离产品全部回流至平衡槽，重新杀菌并留样验证' }, reviewNote: '', reviewer: ''
  },
  {
    id: 'DEV-260929-02', batchId: 'B260929-02', stepId: 'P4', title: '封口压力偏低', severity: '一般', status: '待复核', owner: '设备保障组', openedAt: '2026-09-29T08:52:00', dueDate: '2026-09-30', version: 2,
    investigation: { cause: '气缸密封圈磨损', evidence: '压力曲线、拆检照片、备件领用单', decision: '返工', reworkInstruction: '更换密封圈，返封隔离产品并恢复压力。' }, reviewNote: '', reviewer: ''
  }
]

export const seedAudit: AuditEntry[] = [
  { id: 'AUD-1', entity: 'CLN-260929-01', action: '清洗结果确认生效', operator: '班长 王海涛', detail: '终端T-01首到确认，V1有效期至2026-09-29 16:00', createdAt: '2026-09-29T04:12:00' },
  { id: 'AUD-2', entity: 'CLN-260929-01', action: '清洗确认冲突', operator: '班长 王海涛', detail: '终端T-02晚于终端T-01提交，输入已保留为冲突记录CNF-1', createdAt: '2026-09-29T04:13:00' },
  { id: 'AUD-3', entity: 'B260929-01', action: '批次投产', operator: '班长 王海涛', detail: '绑定前批B260928-07（低脂牛奶 1L）与清洗结果CLN-260929-01 V1', createdAt: '2026-09-29T06:20:00' },
  { id: 'AUD-4', entity: 'B260929-01', action: '自动创建偏差', operator: '监控系统', detail: '杀菌温度70.8℃低于限值72℃，批次已隔离', createdAt: '2026-09-29T06:55:00' },
  { id: 'AUD-5', entity: 'DEV-260929-01', action: '提交调查', operator: '质量工程组', detail: '记录蒸汽阀响应滞后与趋势证据', createdAt: '2026-09-29T08:15:00' },
  { id: 'AUD-6', entity: 'B260929-02', action: '状态流转', operator: '杨鸣', detail: '由生产中转为待复核', createdAt: '2026-09-29T08:52:00' }
]
