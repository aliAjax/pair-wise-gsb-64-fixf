import { useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Badge, Button, Dropdown, Field, Input, Option, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from '@fluentui/react-components'
import { nanoid } from '@reduxjs/toolkit'
import type { AppDispatch, RootState } from '../store'
import { createBatch, rebindBatchCleaning, setBatchFilter, setBatchStatus, setSelectedBatch, updateBatchStatus } from '../store/haccpSlice'
import { computeReleaseBasis, effectiveCleaningForLine } from '../store/releaseBasis'
import { ReleaseBasisCard } from '../components/ReleaseBasisCard'
import type { BatchStatus } from '../types'
import { useCheckReleaseReadinessQuery, useLoadBatchSnapshotQuery } from '../services/api'

const statuses: Array<BatchStatus | '全部'> = ['全部', '生产中', '待复核', '可放行', '隔离中', '已放行', '已报废']
const statusColor = (status: BatchStatus) => status === '隔离中' || status === '已报废' ? 'danger' : status === '已放行' ? 'success' : status === '可放行' ? 'important' : 'warning'

export function Overview() {
  const dispatch = useDispatch<AppDispatch>()
  const state = useSelector((root: RootState) => root.haccp)
  const { isFetching } = useLoadBatchSnapshotQuery()
  const [showCreate, setShowCreate] = useState(false)
  const [newBatch, setNewBatch] = useState({ product: '', line: 'L1', quantity: 1000 })
  const rows = useMemo(() => state.batches.filter((batch) => {
    const text = `${batch.id} ${batch.product} ${batch.line}`.toLowerCase()
    return (!state.batchFilter || text.includes(state.batchFilter.toLowerCase())) && (state.batchStatus === '全部' || batch.status === state.batchStatus)
  }), [state.batches, state.batchFilter, state.batchStatus])
  const selected = state.batches.find((item) => item.id === state.selectedBatchId) ?? rows[0]
  const basis = selected ? computeReleaseBasis(state, selected.id) : null
  const { data: readiness } = useCheckReleaseReadinessQuery(
    { batchId: selected?.id ?? '', openDeviations: basis?.openDeviations ?? 0, basisStale: basis?.stale ?? false },
    { skip: !selected || !basis }
  )
  const selectedDeviations = state.deviations.filter((item) => item.batchId === selected?.id)
  const canRebind = !!selected && !selected.signedAt && !!effectiveCleaningForLine(state.cleaningRecords, selected.line)
  const lineCleaning = effectiveCleaningForLine(state.cleaningRecords, newBatch.line)

  return (
    <section className="page">
      <header className="page-head">
        <div><p>质量运营中心 / 批次控制</p><h1>生产批次与放行</h1></div>
        <div className="head-actions">
          <Button appearance="primary" onClick={() => setShowCreate(true)}>登记投产批次</Button>
          <span className="sync-state">{isFetching ? '正在同步' : '批次快照已加载'}</span>
        </div>
      </header>
      <div className="metrics">
        <article><span>今日批次</span><strong>{state.batches.length}</strong><small>覆盖2条生产线</small></article>
        <article><span>隔离批次</span><strong>{state.batches.filter((item) => item.status === '隔离中').length}</strong><small>禁止放行</small></article>
        <article><span>依据失效</span><strong>{state.batches.filter((item) => !item.signedAt && computeReleaseBasis(state, item.id)?.stale).length}</strong><small>未签字批次需重算</small></article>
        <article><span>已放行</span><strong>{state.batches.filter((item) => item.status === '已放行').length}</strong><small>已完成签字</small></article>
      </div>
      <div className="toolbar">
        <Input value={state.batchFilter} onChange={(_, data) => dispatch(setBatchFilter(data.value))} placeholder="搜索批次、产品、产线" />
        <Dropdown value={state.batchStatus} selectedOptions={[state.batchStatus]} onOptionSelect={(_, data) => dispatch(setBatchStatus(data.optionValue as BatchStatus | '全部'))}>
          {statuses.map((status) => <Option key={status} value={status}>{status}</Option>)}
        </Dropdown>
        <span>点击批次查看监测点、放行依据与偏差关系</span>
      </div>
      <div className="split-layout">
        <div className="table-panel">
          <Table size="small" aria-label="生产批次">
            <TableHeader><TableRow><TableHeaderCell>批次</TableHeaderCell><TableHeaderCell>产品</TableHeaderCell><TableHeaderCell>产线</TableHeaderCell><TableHeaderCell>状态</TableHeaderCell><TableHeaderCell>清洗依据</TableHeaderCell></TableRow></TableHeader>
            <TableBody>
              {rows.map((batch) => {
                const rowBasis = computeReleaseBasis(state, batch.id)
                return (
                  <TableRow key={batch.id} onClick={() => dispatch(setSelectedBatch(batch.id))} className={batch.id === selected?.id ? 'selected-row' : ''}>
                    <TableCell>{batch.id}</TableCell><TableCell>{batch.product}</TableCell><TableCell>{batch.line}</TableCell>
                    <TableCell><Badge appearance="tint" color={statusColor(batch.status)}>{batch.status}</Badge></TableCell>
                    <TableCell>
                      {batch.cleaningId
                        ? <Badge appearance="outline" color={rowBasis?.stale ? 'danger' : 'success'}>{batch.cleaningId} V{batch.cleaningVersion}{rowBasis?.stale ? ' · 失效' : ''}</Badge>
                        : <Badge appearance="outline" color="danger">未绑定</Badge>}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        {selected && basis && <aside className="record-panel">
          <div className="record-title"><div><span>{selected.id} · {selected.line}</span><h2>{selected.product}</h2></div><Badge color={statusColor(selected.status)}>{selected.status}</Badge></div>
          <dl><div><dt>生产数量</dt><dd>{selected.quantity.toLocaleString()} 件</dd></div><div><dt>隔离范围</dt><dd>{selected.isolationScope}</dd></div><div><dt>关联偏差</dt><dd>{selectedDeviations.length} 项</dd></div></dl>
          <ReleaseBasisCard basis={basis} />
          {basis.stale && (
            <div className="record-actions">
              <Button appearance="primary" disabled={!canRebind} onClick={() => dispatch(rebindBatchCleaning({ requestId: nanoid(), batchId: selected.id, operator: '班长 王海涛' }))}>
                {canRebind ? `重新绑定${basis.currentCleaningId} V${basis.currentCleaningVersion}` : '本线无生效清洗结果'}
              </Button>
            </div>
          )}
          <h3>监测点结果</h3>
          <div className="monitoring-list">{selected.monitoring.map((item) => <div key={`${selected.id}-${item.stepId}`}><span>{state.processSteps.find((step) => step.id === item.stepId)?.controlPoint}</span><strong>{item.value} {item.unit}</strong><small>{item.operator} · {item.recordedAt.slice(11, 16)}</small></div>)}</div>
          <div className="record-actions">
            <Button appearance="secondary" disabled={basis.blockers.length > 0 || selected.status === '已放行' || selected.status === '已报废'} onClick={() => dispatch(updateBatchStatus({ id: selected.id, status: '可放行', operator: '质量主管' }))}>提交放行复核</Button>
            <Button appearance="primary" disabled={selected.status !== '可放行' || basis.blockers.length > 0} onClick={() => dispatch(updateBatchStatus({ id: selected.id, status: '已放行', operator: '质量负责人 秦岚' }))}>签字放行</Button>
          </div>
          {readiness && !readiness.ready && <p className="validation-text">{readiness.reasons.join('；')}</p>}
        </aside>}
      </div>
      {showCreate && (
        <div className="edit-panel">
          <h3>登记投产批次</h3>
          <div className="edit-grid">
            <Field label="产品"><Input value={newBatch.product} onChange={(_, data) => setNewBatch({ ...newBatch, product: data.value })} placeholder="橙汁饮品 1L（无奶）" /></Field>
            <Field label="产线">
              <Dropdown value={newBatch.line} selectedOptions={[newBatch.line]} onOptionSelect={(_, data) => setNewBatch({ ...newBatch, line: data.optionValue ?? 'L1' })}>
                {['L1', 'L2'].map((item) => <Option key={item} value={item}>{item}</Option>)}
              </Dropdown>
            </Field>
            <Field label="数量（件）"><Input type="number" value={String(newBatch.quantity)} onChange={(_, data) => setNewBatch({ ...newBatch, quantity: Number(data.value) || 0 })} /></Field>
          </div>
          {lineCleaning
            ? <p className="hint-text">投产将自动绑定{newBatch.line}线前一批产品与清洗结果{lineCleaning.id} V{lineCleaning.version}（有效期至{lineCleaning.validUntil.slice(0, 16).replace('T', ' ')}）。</p>
            : <p className="validation-text">{newBatch.line}线当前无生效清洗结果，禁止投产，请先在清洗验证台完成确认。</p>}
          <div className="record-actions">
            <Button onClick={() => setShowCreate(false)}>取消</Button>
            <Button appearance="primary" disabled={!newBatch.product || newBatch.quantity <= 0 || !lineCleaning} onClick={() => { dispatch(createBatch({ requestId: nanoid(), ...newBatch, operator: '班长 王海涛' })); setShowCreate(false) }}>绑定依据并投产</Button>
          </div>
        </div>
      )}
    </section>
  )
}
