import { useState } from 'react'
import { Badge, Button, Dropdown, Field, Input, Option, Textarea } from '@fluentui/react-components'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '../store'
import { advanceClock, issueCleaningRevision, submitCleaningConfirmation } from '../store/haccpSlice'
import { activeCleaning } from '../services/releaseBasis'
import type { CleaningRecord, CleaningResult } from '../types'

const terminals = ['清洗终端A', '清洗终端B']
const products = ['低温鲜奶 950mL（含奶）', '低脂牛奶 1L（含奶）', '原味酸奶 200g（含奶）', '燕麦植物蛋白饮 1L（无奶）']
const statusColor = (status: CleaningRecord['status']) => status === '已确认' ? 'success' : status === '待确认' ? 'warning' : 'danger'
const fmt = (iso: string) => iso ? iso.slice(0, 16).replace('T', ' ') : '—'

export function CleaningVerification() {
  const dispatch = useDispatch<AppDispatch>()
  const state = useSelector((root: RootState) => root.haccp)
  const lines = [...new Set(state.cleaningRecords.map((item) => item.line))].sort()
  const [terminal, setTerminal] = useState(terminals[0])
  const [operator, setOperator] = useState('王洁')
  const [result, setResult] = useState<CleaningResult>('合格')
  const [note, setNote] = useState('')
  const [revision, setRevision] = useState<{ line: string; method: string; fromProduct: string; toProduct: string; validHours: number } | null>(null)
  const conflicts = state.cleaningRecords.flatMap((record) => record.attempts.filter((item) => item.outcome === '冲突保留').map((item) => ({ record, item })))

  const confirm = (record: CleaningRecord) => {
    dispatch(submitCleaningConfirmation({
      recordId: record.id,
      attempt: { id: `ATT-${record.id}-${terminal}`, terminal, operator, result, note }
    }))
    setNote('')
  }

  return (
    <section className="page">
      <header className="page-head">
        <div><p>产线切换 / 清洗验证</p><h1>清洗结果与有效时段</h1></div>
        <div className="clock-band">
          <span>系统时间 <strong>{fmt(state.clock)}</strong></span>
          <Button size="small" appearance="secondary" onClick={() => dispatch(advanceClock(4))}>+4小时</Button>
          <Button size="small" appearance="secondary" onClick={() => dispatch(advanceClock(12))}>+12小时</Button>
        </div>
      </header>
      <div className="toolbar">
        <Dropdown value={terminal} selectedOptions={[terminal]} onOptionSelect={(_, data) => setTerminal(data.optionValue ?? terminals[0])}>{terminals.map((item) => <Option key={item} value={item}>{item}</Option>)}</Dropdown>
        <Input value={operator} onChange={(_, data) => setOperator(data.value)} placeholder="确认人" />
        <Dropdown value={result} selectedOptions={[result]} onOptionSelect={(_, data) => setResult(data.optionValue as CleaningResult)}>{['合格', '不合格'].map((item) => <Option key={item} value={item}>{item}</Option>)}</Dropdown>
        <Input value={note} onChange={(_, data) => setNote(data.value)} placeholder="快检备注（电导率 / ATP）" />
        <span>两台终端确认同一清洗结果时，先到者生效，后到者输入保留为冲突记录。</span>
      </div>
      {lines.map((line) => {
        const active = activeCleaning(state.cleaningRecords, line, state.clock)
        const records = state.cleaningRecords.filter((item) => item.line === line).sort((a, b) => b.version - a.version)
        return (
          <div key={line} className="line-section">
            <div className="line-head">
              <h2>{line} 产线</h2>
              {active ? <Badge appearance="tint" color="success">当前有效：{active.id} V{active.version} · 至 {fmt(active.validUntil)}</Badge> : <Badge appearance="tint" color="danger">无有效清洗结果，投产与放行均被拦截</Badge>}
              <Button size="small" appearance="primary" onClick={() => setRevision({ line, method: 'CIP全程清洗', fromProduct: active?.toProduct ?? products[0], toProduct: products[3], validHours: 24 })}>发起清洗换版</Button>
            </div>
            <div className="cleaning-grid">
              {records.map((record) => (
                <article key={record.id} className={`cleaning-card ${record.status === '已确认' ? 'active-cleaning' : ''}`}>
                  <div className="cleaning-title">
                    <strong>{record.id} · V{record.version}</strong>
                    <Badge appearance="tint" color={statusColor(record.status)}>{record.status}</Badge>
                  </div>
                  <dl>
                    <div><dt>产品切换</dt><dd>{record.fromProduct} → {record.toProduct}</dd></div>
                    <div><dt>切换类型</dt><dd>{record.dairySwitch ? '含奶 ↔ 无奶（过敏原）' : '同类产品续产'}</dd></div>
                    <div><dt>清洗方式</dt><dd>{record.method}</dd></div>
                    <div><dt>有效时段</dt><dd>至 {fmt(record.validUntil)}</dd></div>
                    {record.confirmedBy && <div><dt>确认</dt><dd>{record.confirmedTerminal} · {record.confirmedBy} · {fmt(record.confirmedAt)}</dd></div>}
                  </dl>
                  {record.attempts.length > 0 && <div className="attempt-list">
                    {record.attempts.map((attempt) => (
                      <div key={attempt.id} className={attempt.outcome === '冲突保留' ? 'attempt-conflict' : ''}>
                        <span>{attempt.terminal} · {attempt.operator}</span>
                        <Badge size="small" appearance="outline" color={attempt.outcome === '已采纳' ? 'success' : 'warning'}>{attempt.outcome}</Badge>
                        <small>{attempt.result}{attempt.note ? ` · ${attempt.note}` : ''} · {fmt(attempt.submittedAt)}</small>
                      </div>
                    ))}
                  </div>}
                  {(record.status === '待确认' || record.status === '已确认') && (
                    <div className="record-actions">
                      <Button size="small" appearance={record.status === '待确认' ? 'primary' : 'secondary'} disabled={!operator.trim()} onClick={() => confirm(record)}>
                        {record.status === '待确认' ? `${terminal}确认` : `${terminal}补确认（将记为冲突）`}
                      </Button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        )
      })}
      {conflicts.length > 0 && (
        <div className="rule-band conflict-band">
          <strong>冲突记录（{conflicts.length}）</strong>
          <span>{conflicts.map(({ record, item }) => `${record.id}：${item.terminal} ${item.operator} 于 ${fmt(item.submittedAt)} 提交被保留`).join('；')}</span>
        </div>
      )}
      {revision && (
        <div className="edit-panel">
          <h3>{revision.line} · 发起清洗换版</h3>
          <div className="edit-grid">
            <Field label="清洗方式"><Input value={revision.method} onChange={(_, data) => setRevision({ ...revision, method: data.value })} /></Field>
            <Field label="前一批产品"><Dropdown value={revision.fromProduct} selectedOptions={[revision.fromProduct]} onOptionSelect={(_, data) => setRevision({ ...revision, fromProduct: data.optionValue ?? revision.fromProduct })}>{products.map((item) => <Option key={item} value={item}>{item}</Option>)}</Dropdown></Field>
            <Field label="切换目标产品"><Dropdown value={revision.toProduct} selectedOptions={[revision.toProduct]} onOptionSelect={(_, data) => setRevision({ ...revision, toProduct: data.optionValue ?? revision.toProduct })}>{products.map((item) => <Option key={item} value={item}>{item}</Option>)}</Dropdown></Field>
            <Field label="有效时段（小时）"><Input type="number" value={String(revision.validHours)} onChange={(_, data) => setRevision({ ...revision, validHours: Number(data.value) || 24 })} /></Field>
          </div>
          <div className="record-actions">
            <Button onClick={() => setRevision(null)}>取消</Button>
            <Button appearance="primary" disabled={!revision.method.trim() || revision.fromProduct === revision.toProduct} onClick={() => {
              dispatch(issueCleaningRevision({
                line: revision.line, method: revision.method, fromProduct: revision.fromProduct, toProduct: revision.toProduct,
                dairySwitch: revision.fromProduct.includes('无奶') !== revision.toProduct.includes('无奶'),
                validHours: revision.validHours, operator: operator || '质量主管'
              }))
              setRevision(null)
            }}>发起换版（待终端确认）</Button>
          </div>
        </div>
      )}
      <div className="rule-band"><strong>清洗验证约束</strong><span>清洗结果换版或超过有效时段后，绑定旧版本的未签字批次立即失效重算；已签字批次保留历史依据不受影响。</span></div>
    </section>
  )
}
