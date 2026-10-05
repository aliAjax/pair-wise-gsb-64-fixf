import { useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Badge, Button, Dropdown, Field, Input, Option, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from '@fluentui/react-components'
import type { AppDispatch, RootState } from '../store'
import { recoverLastCommitted, rebindBatch, setBatchFilter, setBatchStatus, setSelectedBatch, simulateWriteFailure, startBatch, updateBatchStatus } from '../store/haccpSlice'
import { activeCleaning, releaseBasisView } from '../services/releaseBasis'
import { BasisCard } from './BasisCard'
import type { BatchStatus } from '../types'
import { useLoadBatchSnapshotQuery } from '../services/api'

const statuses: Array<BatchStatus | '全部'> = ['全部', '生产中', '待复核', '可放行', '隔离中', '已放行', '已报废']
const products = ['低温鲜奶 950mL', '低脂牛奶 1L', '原味酸奶 200g', '燕麦植物蛋白饮 1L']
const statusColor = (status: BatchStatus) => status === '隔离中' || status === '已报废' ? 'danger' : status === '已放行' ? 'success' : status === '可放行' ? 'important' : 'warning'
const persistColor = (status: string) => status === '写入失败' ? 'danger' : status === '已恢复' ? 'warning' : 'success'

export function Overview() {
  const dispatch = useDispatch<AppDispatch>()
  const state = useSelector((root: RootState) => root.haccp)
  const { isFetching } = useLoadBatchSnapshotQuery()
  const [showStart, setShowStart] = useState(false)
  const [newBatch, setNewBatch] = useState({ product: products[0], line: 'L1', quantity: 5000, operator: '班长 赵鹏' })
  const rows = useMemo(() => state.batches.filter((batch) => {
    const text = `${batch.id} ${batch.product} ${batch.line}`.toLowerCase()
    return (!state.batchFilter || text.includes(state.batchFilter.toLowerCase())) && (state.batchStatus === '全部' || batch.status === state.batchStatus)
  }), [state.batches, state.batchFilter, state.batchStatus])
  const selected = state.batches.find((item) => item.id === state.selectedBatchId) ?? rows[0]
  const selectedView = selected ? releaseBasisView(state, selected.id) : null
  const invalidCount = state.batches.filter((item) => item.releaseBasis.validity === '已失效' && item.status !== '已放行' && item.status !== '已报废').length
  const startLineCleaning = activeCleaning(state.cleaningRecords, newBatch.line, state.clock)

  return (
    <section className="page">
      <header className="page-head">
        <div><p>质量运营中心 / 批次控制</p><h1>生产批次与放行</h1></div>
        <div className="persist-band">
          <Badge appearance="tint" color={persistColor(state.persist.status)}>{state.persist.status}</Badge>
          {state.persist.status === '已恢复' && <small>已于 {state.persist.recoveredAt.slice(11, 16)} 按最近完整提交恢复</small>}
          {state.persist.simulateFailure
            ? <><Button size="small" appearance="secondary" onClick={() => dispatch(simulateWriteFailure(false))}>恢复写入</Button>
                <Button size="small" appearance="primary" onClick={() => dispatch(recoverLastCommitted())}>按最近完整提交恢复</Button></>
            : <Button size="small" appearance="subtle" onClick={() => dispatch(simulateWriteFailure(true))}>模拟写入失败</Button>}
        </div>
      </header>
      <div className="metrics five">
        <article><span>今日批次</span><strong>{state.batches.length}</strong><small>覆盖2条生产线</small></article>
        <article><span>隔离批次</span><strong>{state.batches.filter((item) => item.status === '隔离中').length}</strong><small>禁止放行</small></article>
        <article><span>未关闭偏差</span><strong>{state.deviations.filter((item) => item.status !== '已关闭').length}</strong><small>需调查或复核</small></article>
        <article><span>依据失效批次</span><strong>{invalidCount}</strong><small>清洗换版或超期触发重算</small></article>
        <article><span>已放行</span><strong>{state.batches.filter((item) => item.status === '已放行').length}</strong><small>已完成签字</small></article>
      </div>
      <div className="toolbar">
        <Input value={state.batchFilter} onChange={(_, data) => dispatch(setBatchFilter(data.value))} placeholder="搜索批次、产品、产线" />
        <Dropdown value={state.batchStatus} selectedOptions={[state.batchStatus]} onOptionSelect={(_, data) => dispatch(setBatchStatus(data.optionValue as BatchStatus | '全部'))}>
          {statuses.map((status) => <Option key={status} value={status}>{status}</Option>)}
        </Dropdown>
        <Button appearance="primary" onClick={() => setShowStart(!showStart)}>批次投产</Button>
        <span>{isFetching ? '正在同步' : '批次快照已加载'} · 投产先绑定前批产品与清洗结果版本</span>
      </div>
      {showStart && <div className="edit-panel">
        <h3>批次投产 · 绑定放行依据</h3>
        <div className="edit-grid four">
          <Field label="产品"><Dropdown value={newBatch.product} selectedOptions={[newBatch.product]} onOptionSelect={(_, data) => setNewBatch({ ...newBatch, product: data.optionValue ?? products[0] })}>{products.map((item) => <Option key={item} value={item}>{item}</Option>)}</Dropdown></Field>
          <Field label="产线"><Dropdown value={newBatch.line} selectedOptions={[newBatch.line]} onOptionSelect={(_, data) => setNewBatch({ ...newBatch, line: data.optionValue ?? 'L1' })}>{['L1', 'L2'].map((item) => <Option key={item} value={item}>{item}</Option>)}</Dropdown></Field>
          <Field label="计划数量"><Input type="number" value={String(newBatch.quantity)} onChange={(_, data) => setNewBatch({ ...newBatch, quantity: Number(data.value) || 0 })} /></Field>
          <Field label="投产人"><Input value={newBatch.operator} onChange={(_, data) => setNewBatch({ ...newBatch, operator: data.value })} /></Field>
        </div>
        {startLineCleaning
          ? <p className="basis-hint">将绑定清洗 {startLineCleaning.id} V{startLineCleaning.version}（有效至 {startLineCleaning.validUntil.slice(0, 16).replace('T', ' ')}）</p>
          : <p className="validation-text">{newBatch.line} 当前无有效清洗结果，投产将被系统拦截。</p>}
        <div className="record-actions">
          <Button onClick={() => setShowStart(false)}>取消</Button>
          <Button appearance="primary" disabled={!startLineCleaning || newBatch.quantity <= 0 || !newBatch.operator.trim()} onClick={() => { dispatch(startBatch(newBatch)); setShowStart(false) }}>投产并绑定依据</Button>
        </div>
      </div>}
      <div className="split-layout">
        <div className="table-panel">
          <Table size="small" aria-label="生产批次">
            <TableHeader><TableRow><TableHeaderCell>批次</TableHeaderCell><TableHeaderCell>产品</TableHeaderCell><TableHeaderCell>产线</TableHeaderCell><TableHeaderCell>状态</TableHeaderCell><TableHeaderCell>放行依据</TableHeaderCell></TableRow></TableHeader>
            <TableBody>
              {rows.map((batch) => <TableRow key={batch.id} onClick={() => dispatch(setSelectedBatch(batch.id))} className={batch.id === selected?.id ? 'selected-row' : ''}>
                <TableCell>{batch.id}</TableCell><TableCell>{batch.product}</TableCell><TableCell>{batch.line}</TableCell>
                <TableCell><Badge appearance="tint" color={statusColor(batch.status)}>{batch.status}</Badge></TableCell>
                <TableCell><Badge appearance="outline" color={batch.releaseBasis.validity === '已失效' ? 'danger' : 'success'}>清洗V{batch.releaseBasis.cleaningVersion} · {batch.releaseBasis.validity}</Badge></TableCell>
              </TableRow>)}
            </TableBody>
          </Table>
        </div>
        {selected && selectedView && <aside className="record-panel">
          <div className="record-title"><div><span>{selected.id} · {selected.line}</span><h2>{selected.product}</h2></div><Badge color={statusColor(selected.status)}>{selected.status}</Badge></div>
          <dl><div><dt>生产数量</dt><dd>{selected.quantity.toLocaleString()} 件</dd></div><div><dt>隔离范围</dt><dd>{selected.isolationScope}</dd></div><div><dt>关联偏差</dt><dd>{selectedView.openDeviations} 项未关闭</dd></div></dl>
          <BasisCard view={selectedView} />
          {selectedView.validity === '已失效' && !selectedView.signed && (
            <div className="record-actions">
              <Button appearance="primary" disabled={!activeCleaning(state.cleaningRecords, selected.line, state.clock)} onClick={() => dispatch(rebindBatch({ id: selected.id, operator: '质量主管' }))}>重新绑定当前清洗版本</Button>
            </div>
          )}
          <h3>监测点结果</h3>
          <div className="monitoring-list">{selected.monitoring.map((item) => <div key={`${selected.id}-${item.stepId}`}><span>{state.processSteps.find((step) => step.id === item.stepId)?.controlPoint}</span><strong>{item.value} {item.unit}</strong><small>{item.operator} · {item.recordedAt.slice(11, 16)}</small></div>)}</div>
          <div className="record-actions">
            <Button appearance="secondary" disabled={!selectedView.releasable || selected.status === '可放行'} onClick={() => dispatch(updateBatchStatus({ id: selected.id, status: '可放行' }))}>提交放行复核</Button>
            <Button appearance="primary" disabled={selected.status !== '可放行' || !selectedView.releasable} onClick={() => dispatch(updateBatchStatus({ id: selected.id, status: '已放行', operator: '质量负责人 秦岚' }))}>签字放行</Button>
          </div>
          {!selectedView.releasable && !selectedView.signed && <p className="validation-text">放行依据未就绪（{selectedView.reasons[0] ?? '待补齐'}），系统已拦截放行与签字。</p>}
        </aside>}
      </div>
    </section>
  )
}
