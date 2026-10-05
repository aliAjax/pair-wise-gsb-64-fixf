import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Dropdown, Field, Input, Option, Switch, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Textarea } from '@fluentui/react-components'
import { useDispatch, useSelector } from 'react-redux'
import { nanoid } from '@reduxjs/toolkit'
import type { AppDispatch, RootState } from '../store'
import { confirmCleaning, createCleaningRecord, rebindBatchCleaning } from '../store/haccpSlice'
import { computeReleaseBasis, effectiveCleaningForLine, isCleaningExpired } from '../store/releaseBasis'
import { isSimulatingPersistFailure, setSimulatePersistFailure } from '../services/persistence'
import type { CleaningResult } from '../types'

const terminals = ['终端T-01', '终端T-02', '终端T-03']
const statusColor = (status: string) => status === '生效' ? 'success' : status === '待确认' ? 'warning' : 'danger'

export function CleaningControl() {
  const dispatch = useDispatch<AppDispatch>()
  const state = useSelector((root: RootState) => root.haccp)
  const [selectedId, setSelectedId] = useState(state.cleaningRecords[0]?.id ?? '')
  const [showCreate, setShowCreate] = useState(false)
  const [newRecord, setNewRecord] = useState({ line: 'L1', switchFrom: '', switchTo: '', cleaningType: 'CIP+过敏原验证' })
  const [confirmForm, setConfirmForm] = useState({ terminal: terminals[0], operator: '班长 王海涛', result: '合格' as CleaningResult, note: '', validHours: 8 })
  const [requestId, setRequestId] = useState(() => nanoid())
  const [simulateFailure, setSimulateFailure] = useState(isSimulatingPersistFailure())

  const selected = state.cleaningRecords.find((item) => item.id === selectedId) ?? state.cleaningRecords[0]
  const staleBatches = useMemo(
    () => state.batches.filter((batch) => !batch.signedAt && computeReleaseBasis(state, batch.id)?.stale),
    [state]
  )

  // 确认真正落库后才更换requestId；写入失败被回滚时保留原requestId，重试不重复追加审计。
  useEffect(() => {
    if (selected?.confirmations.some((item) => item.requestId === requestId)) {
      setRequestId(nanoid())
      setConfirmForm((form) => ({ ...form, note: '' }))
    }
  }, [selected, requestId])

  const submitConfirmation = () => {
    if (!selected) return
    dispatch(confirmCleaning({ requestId, cleaningId: selected.id, ...confirmForm }))
  }

  return (
    <section className="page">
      <header className="page-head">
        <div><p>产线切换 / 清洗验证</p><h1>清洗结果与放行依据</h1></div>
        <Button appearance="primary" onClick={() => setShowCreate(true)}>登记清洗结果（换版）</Button>
      </header>
      <div className="metrics">
        <article><span>生效清洗结果</span><strong>{state.cleaningRecords.filter((item) => item.status === '生效' && !isCleaningExpired(item)).length}</strong><small>作为批次放行依据</small></article>
        <article><span>待确认</span><strong>{state.cleaningRecords.filter((item) => item.status === '待确认').length}</strong><small>等待终端首到确认</small></article>
        <article><span>冲突记录</span><strong>{state.cleaningConflicts.length}</strong><small>后到者输入已保留</small></article>
        <article><span>依据失效批次</span><strong>{staleBatches.length}</strong><small>未签字批次需重算</small></article>
      </div>
      <div className="split-layout">
        <div className="table-panel">
          <Table size="small" aria-label="清洗结果">
            <TableHeader><TableRow><TableHeaderCell>编号</TableHeaderCell><TableHeaderCell>产线</TableHeaderCell><TableHeaderCell>产品切换</TableHeaderCell><TableHeaderCell>版本</TableHeaderCell><TableHeaderCell>有效期至</TableHeaderCell><TableHeaderCell>状态</TableHeaderCell></TableRow></TableHeader>
            <TableBody>
              {state.cleaningRecords.map((record) => (
                <TableRow key={record.id} onClick={() => setSelectedId(record.id)} className={record.id === selected?.id ? 'selected-row' : ''}>
                  <TableCell>{record.id}</TableCell><TableCell>{record.line}</TableCell>
                  <TableCell>{record.switchFrom} → {record.switchTo}</TableCell><TableCell>V{record.version}</TableCell>
                  <TableCell>{record.validUntil ? record.validUntil.slice(0, 16).replace('T', ' ') : '待确认'}</TableCell>
                  <TableCell><Badge appearance="tint" color={statusColor(record.status)}>{record.status}{record.status === '生效' && isCleaningExpired(record) ? '·已过期' : ''}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {state.cleaningConflicts.length > 0 && (
            <div className="conflict-panel">
              <h3>冲突记录（后到者输入已保留）</h3>
              {state.cleaningConflicts.map((conflict) => (
                <div key={conflict.id} className="conflict-item">
                  <Badge appearance="tint" color="danger">{conflict.id}</Badge>
                  <span>{conflict.cleaningId} · {conflict.terminal} · {conflict.operator}</span>
                  <small>判定{conflict.result}；{conflict.note || '无备注'}；晚于{conflict.conflictWithTerminal}，未生效</small>
                </div>
              ))}
            </div>
          )}
        </div>
        {selected && (
          <aside className="record-panel">
            <div className="record-title">
              <div><span>{selected.line} · {selected.cleaningType}</span><h2>{selected.id} · V{selected.version}</h2></div>
              <Badge color={statusColor(selected.status)}>{selected.status}</Badge>
            </div>
            <dl>
              <div><dt>产品切换</dt><dd>{selected.switchFrom} → {selected.switchTo}</dd></div>
              <div><dt>清洗结果</dt><dd>{selected.result}</dd></div>
              <div><dt>有效时段</dt><dd>{selected.validFrom ? `${selected.validFrom.slice(0, 16).replace('T', ' ')} ~ ${selected.validUntil.slice(0, 16).replace('T', ' ')}` : '确认后生效'}</dd></div>
            </dl>
            <h3>终端确认记录</h3>
            <div className="monitoring-list">
              {selected.confirmations.length === 0 && <div><span>暂无确认，两台终端同时提交时仅先到者生效</span></div>}
              {selected.confirmations.map((item) => (
                <div key={item.id}>
                  <span>{item.terminal} · {item.operator}</span>
                  <Badge appearance="tint" color={item.outcome === '生效' ? 'success' : 'danger'}>{item.outcome}</Badge>
                  <small>{item.submittedAt.slice(0, 16).replace('T', ' ')} · 判定{item.result}{item.note ? ` · ${item.note}` : ''}</small>
                </div>
              ))}
            </div>
            <h3>终端确认</h3>
            <div className="confirm-form">
              <Field label="终端">
                <Dropdown value={confirmForm.terminal} selectedOptions={[confirmForm.terminal]} onOptionSelect={(_, data) => setConfirmForm({ ...confirmForm, terminal: data.optionValue ?? terminals[0] })}>
                  {terminals.map((item) => <Option key={item} value={item}>{item}</Option>)}
                </Dropdown>
              </Field>
              <Field label="确认人"><Input value={confirmForm.operator} onChange={(_, data) => setConfirmForm({ ...confirmForm, operator: data.value })} /></Field>
              <Field label="判定">
                <Dropdown value={confirmForm.result} selectedOptions={[confirmForm.result]} onOptionSelect={(_, data) => setConfirmForm({ ...confirmForm, result: data.optionValue as CleaningResult })}>
                  {(['合格', '不合格'] as const).map((item) => <Option key={item} value={item}>{item}</Option>)}
                </Dropdown>
              </Field>
              <Field label="有效时长（小时）"><Input type="number" value={String(confirmForm.validHours)} onChange={(_, data) => setConfirmForm({ ...confirmForm, validHours: Number(data.value) || 8 })} /></Field>
              <Field label="备注" className="confirm-note"><Textarea value={confirmForm.note} onChange={(_, data) => setConfirmForm({ ...confirmForm, note: data.value })} placeholder="罐体清洗表复核情况" /></Field>
            </div>
            <div className="record-actions">
              <Button appearance="primary" disabled={!confirmForm.operator} onClick={submitConfirmation}>提交终端确认</Button>
            </div>
            {selected.effectiveConfirmationId
              ? <p className="validation-text">该清洗结果已生效，再次提交将保留输入并记为冲突，不会改写结果。</p>
              : <p className="hint-text">两台终端确认同一清洗结果时，仅先到者生效。</p>}
          </aside>
        )}
      </div>
      {staleBatches.length > 0 && (
        <div className="stale-panel">
          <h3>放行依据失效 · 待重算（未签字批次）</h3>
          {staleBatches.map((batch) => {
            const basis = computeReleaseBasis(state, batch.id)!
            const canRebind = !!effectiveCleaningForLine(state.cleaningRecords, batch.line)
            return (
              <div key={batch.id} className="stale-item">
                <div><strong>{batch.id}</strong><span>{batch.product} · {batch.line}</span><small>{basis.blockers.join('；')}</small></div>
                <Button size="small" appearance="primary" disabled={!canRebind} onClick={() => dispatch(rebindBatchCleaning({ requestId: nanoid(), batchId: batch.id, operator: '班长 王海涛' }))}>
                  {canRebind ? `重新绑定${basis.currentCleaningId} V${basis.currentCleaningVersion}` : '本线无生效清洗结果'}
                </Button>
              </div>
            )
          })}
        </div>
      )}
      <div className="rule-band">
        <strong>故障演练</strong>
        <span>开启后下一次写入将失败，系统按最近完整批次恢复；用同一表单重试不会重复追加审计。</span>
        <Switch checked={simulateFailure} onChange={(_, data) => { setSimulateFailure(data.checked); setSimulatePersistFailure(data.checked) }} label={simulateFailure ? '模拟写入失败：开' : '模拟写入失败：关'} />
      </div>
      {showCreate && (
        <div className="edit-panel">
          <h3>登记清洗结果（换版）</h3>
          <div className="edit-grid">
            <Field label="产线">
              <Dropdown value={newRecord.line} selectedOptions={[newRecord.line]} onOptionSelect={(_, data) => setNewRecord({ ...newRecord, line: data.optionValue ?? 'L1' })}>
                {['L1', 'L2'].map((item) => <Option key={item} value={item}>{item}</Option>)}
              </Dropdown>
            </Field>
            <Field label="前产品（含奶/无奶）"><Input value={newRecord.switchFrom} onChange={(_, data) => setNewRecord({ ...newRecord, switchFrom: data.value })} placeholder="原味酸奶 200g（含奶）" /></Field>
            <Field label="目标产品（含奶/无奶）"><Input value={newRecord.switchTo} onChange={(_, data) => setNewRecord({ ...newRecord, switchTo: data.value })} placeholder="橙汁饮品 1L（无奶）" /></Field>
            <Field label="清洗方式">
              <Dropdown value={newRecord.cleaningType} selectedOptions={[newRecord.cleaningType]} onOptionSelect={(_, data) => setNewRecord({ ...newRecord, cleaningType: data.optionValue ?? 'CIP标准清洗' })}>
                {['CIP标准清洗', 'CIP+过敏原验证', '干式清扫'].map((item) => <Option key={item} value={item}>{item}</Option>)}
              </Dropdown>
            </Field>
          </div>
          <div className="record-actions">
            <Button onClick={() => setShowCreate(false)}>取消</Button>
            <Button appearance="primary" disabled={!newRecord.switchFrom || !newRecord.switchTo} onClick={() => { dispatch(createCleaningRecord({ requestId: nanoid(), ...newRecord, operator: '班长 王海涛' })); setShowCreate(false) }}>登记并等待终端确认</Button>
          </div>
          <p className="hint-text">新清洗结果确认生效后，同线旧版本自动换版，绑定旧版本的未签字批次立即失效重算。</p>
        </div>
      )}
    </section>
  )
}
