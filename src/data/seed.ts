import type { AuditEntry, Batch, CleaningRecord, Deviation, ProcessStep } from '../types'

/** 演示系统时间：清洗有效时段、失效重算与审计时间均以此时钟为准。 */
export const seedClock = '2026-09-29T12:00:00'

export const processSteps: ProcessStep[] = [
  { id: 'P1', name: '原料验收', equipment: '冷藏收货台', hazard: '致病菌、温度失控', controlPoint: '原料中心温度', limit: '≤ 4 ℃', frequency: '每批', correctiveAction: '拒收并隔离供应商批次' },
  { id: 'P2', name: '巴氏杀菌', equipment: 'HTST-02', hazard: '致病菌残留', controlPoint: '杀菌温度', limit: '≥ 72 ℃ / 15 s', frequency: '连续记录', correctiveAction: '自动回流并触发偏差' },
  { id: 'P3', name: '金属探测', equipment: 'MD-06', hazard: '金属异物', controlPoint: 'Fe/SUS灵敏度', limit: 'Fe 1.5 mm / SUS 2.0 mm', frequency: '每半小时', correctiveAction: '隔离末次合格点以来产品' },
  { id: 'P4', name: '灌装封口', equipment: 'FILL-01', hazard: '密封不良', controlPoint: '封口压力', limit: '0.38-0.45 MPa', frequency: '每小时', correctiveAction: '停机调机并复检留样' },
  { id: 'P5', name: '终产品冷却', equipment: '冷却隧道', hazard: '芽孢萌发', controlPoint: '冷却结束温度', limit: '≤ 10 ℃ / 2 h', frequency: '每批', correctiveAction: '延长冷却并观察质量' }
]

export const seedCleaningRecords: CleaningRecord[] = [
  {
    id: 'CL-L1-004', line: 'L1', version: 4, method: 'CIP全程清洗+过敏原验证', fromProduct: '低温鲜奶 950mL（含奶）', toProduct: '燕麦植物蛋白饮 1L（无奶）', dairySwitch: true,
    status: '待确认', result: '', confirmedBy: '', confirmedTerminal: '', confirmedAt: '', validUntil: '2026-09-30T12:00:00', attempts: []
  },
  {
    id: 'CL-L1-003', line: 'L1', version: 3, method: 'CIP全程清洗', fromProduct: '燕麦植物蛋白饮 1L（无奶）', toProduct: '低温鲜奶 950mL（含奶）', dairySwitch: true,
    status: '已确认', result: '合格', confirmedBy: '王洁', confirmedTerminal: '清洗终端A', confirmedAt: '2026-09-29T05:40:00', validUntil: '2026-09-30T06:00:00',
    attempts: [
      { id: 'ATT-CL-L1-003-清洗终端A', terminal: '清洗终端A', operator: '王洁', result: '合格', note: '电导率与ATP快检合格', submittedAt: '2026-09-29T05:40:00', outcome: '已采纳' },
      { id: 'ATT-CL-L1-003-清洗终端B', terminal: '清洗终端B', operator: '杜衡', result: '合格', note: '复核数据一致', submittedAt: '2026-09-29T05:42:00', outcome: '冲突保留' }
    ]
  },
  {
    id: 'CL-L2-002', line: 'L2', version: 2, method: 'CIP碱洗+酸洗', fromProduct: '原味酸奶 200g（含奶）', toProduct: '原味酸奶 200g（含奶）', dairySwitch: false,
    status: '已确认', result: '合格', confirmedBy: '杨鸣', confirmedTerminal: '清洗终端A', confirmedAt: '2026-09-29T07:30:00', validUntil: '2026-09-29T20:00:00',
    attempts: [
      { id: 'ATT-CL-L2-002-清洗终端A', terminal: '清洗终端A', operator: '杨鸣', result: '合格', note: '同产品续产，常规清洗', submittedAt: '2026-09-29T07:30:00', outcome: '已采纳' }
    ]
  },
  {
    id: 'CL-L1-002', line: 'L1', version: 2, method: 'CIP全程清洗', fromProduct: '低脂牛奶 1L（含奶）', toProduct: '燕麦植物蛋白饮 1L（无奶）', dairySwitch: true,
    status: '已换版', result: '合格', confirmedBy: '王洁', confirmedTerminal: '清洗终端A', confirmedAt: '2026-09-28T14:10:00', validUntil: '2026-09-29T06:00:00',
    attempts: [
      { id: 'ATT-CL-L1-002-清洗终端A', terminal: '清洗终端A', operator: '王洁', result: '合格', note: '', submittedAt: '2026-09-28T14:10:00', outcome: '已采纳' }
    ]
  }
]

export const seedBatches: Batch[] = [
  {
    id: 'B260929-01', product: '低温鲜奶 950mL', line: 'L1', quantity: 3200, producedAt: '2026-09-29T06:20:00', status: '隔离中', isolationScope: '杀菌后至金属探测前全部在制品', version: 4,
    releaseBasis: { previousBatchId: 'B260928-09', previousProduct: '燕麦植物蛋白饮 1L（无奶）', cleaningRecordId: 'CL-L1-003', cleaningVersion: 3, boundAt: '2026-09-29T06:10:00', validity: '有效', invalidReason: '', recomputedAt: '2026-09-29T06:10:00' },
    monitoring: [
      { stepId: 'P1', value: 3.4, unit: '℃', recordedAt: '2026-09-29T06:25:00', operator: '陈莉' },
      { stepId: 'P2', value: 70.8, unit: '℃', recordedAt: '2026-09-29T06:48:00', operator: '系统采集' },
      { stepId: 'P3', value: 1.5, unit: 'mm Fe', recordedAt: '2026-09-29T07:20:00', operator: '杨鸣' }
    ]
  },
  {
    id: 'B260929-02', product: '原味酸奶 200g', line: 'L2', quantity: 8600, producedAt: '2026-09-29T08:10:00', status: '待复核', isolationScope: 'FILL-01本次清洁后产品', version: 3,
    releaseBasis: { previousBatchId: 'B260928-11', previousProduct: '原味酸奶 200g（含奶）', cleaningRecordId: 'CL-L2-002', cleaningVersion: 2, boundAt: '2026-09-29T08:00:00', validity: '有效', invalidReason: '', recomputedAt: '2026-09-29T08:00:00' },
    monitoring: [
      { stepId: 'P4', value: 0.36, unit: 'MPa', recordedAt: '2026-09-29T08:40:00', operator: '系统采集' },
      { stepId: 'P5', value: 8.2, unit: '℃', recordedAt: '2026-09-29T10:10:00', operator: '郑凯' }
    ]
  },
  {
    id: 'B260928-07', product: '低脂牛奶 1L', line: 'L1', quantity: 5100, producedAt: '2026-09-28T16:20:00', status: '已放行', isolationScope: '无', version: 6,
    releaseBasis: { previousBatchId: 'B260928-05', previousProduct: '低脂牛奶 1L（含奶）', cleaningRecordId: 'CL-L1-002', cleaningVersion: 2, boundAt: '2026-09-28T16:00:00', validity: '有效', invalidReason: '', recomputedAt: '2026-09-28T16:00:00' },
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
  { id: 'AUD-1', entity: 'B260929-01', action: '自动创建偏差', operator: '监控系统', detail: '杀菌温度70.8℃低于限值72℃，批次已隔离', basis: 'CL-L1-003 V3 · 有效', createdAt: '2026-09-29T06:55:00' },
  { id: 'AUD-2', entity: 'DEV-260929-01', action: '提交调查', operator: '质量工程组', detail: '记录蒸汽阀响应滞后与趋势证据', createdAt: '2026-09-29T08:15:00' },
  { id: 'AUD-3', entity: 'B260929-02', action: '状态流转', operator: '杨鸣', detail: '由生产中转为待复核', basis: 'CL-L2-002 V2 · 有效', createdAt: '2026-09-29T08:52:00' },
  { id: 'AUD-CL1', entity: 'CL-L1-003', action: '清洗结果确认', operator: '王洁', detail: '清洗终端A确认L1清洗V3合格（无奶→含奶切换），有效期至09-30 06:00', createdAt: '2026-09-29T05:40:00' },
  { id: 'AUD-CL2', entity: 'CL-L1-003', action: '终端确认冲突', operator: '杜衡', detail: '清洗终端B提交时终端A已确认V3，输入保留为冲突记录', createdAt: '2026-09-29T05:42:00' },
  { id: 'AUD-CL3', entity: 'B260929-01', action: '批次投产绑定', operator: '班长 赵鹏', detail: '绑定前批B260928-09（燕麦植物蛋白饮）与清洗CL-L1-003 V3', basis: 'CL-L1-003 V3 · 有效', createdAt: '2026-09-29T06:10:00' }
]
