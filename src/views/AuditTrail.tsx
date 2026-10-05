import { useState } from 'react'
import { Badge, Button, Dropdown, Input, Option, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from '@fluentui/react-components'
import { useSelector } from 'react-redux'
import type { RootState } from '../store'
import { releaseBasisView } from '../services/releaseBasis'
import { BasisCard } from './BasisCard'

export function AuditTrail() {
  const state = useSelector((root: RootState) => root.haccp)
  const [keyword, setKeyword] = useState('')
  const [basisBatchId, setBasisBatchId] = useState(state.batches[0]?.id ?? '')
  const rows = state.audit.filter((item) => `${item.entity} ${item.action} ${item.operator} ${item.detail}`.includes(keyword))
  const basisView = basisBatchId ? releaseBasisView(state, basisBatchId) : null
  const exportAudit = () => {
    const payload = {
      exportedAt: state.clock,
      audit: rows,
      cleaningRecords: state.cleaningRecords,
      batches: state.batches.map((batch) => ({ id: batch.id, product: batch.product, line: batch.line, status: batch.status, releaseBasis: batch.releaseBasis }))
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'HACCP追溯审计.json'; anchor.click(); URL.revokeObjectURL(url)
  }
  return <section className="page"><header className="page-head"><div><p>批次 / 清洗 / 控制点 / 偏差 / 签字</p><h1>完整追溯审计</h1></div><Button appearance="primary" onClick={exportAudit}>导出追溯包</Button></header>
    <div className="toolbar">
      <Input value={keyword} onChange={(_, data) => setKeyword(data.value)} placeholder="搜索实体、动作、操作人" />
      <Dropdown value={basisBatchId} selectedOptions={[basisBatchId]} onOptionSelect={(_, data) => setBasisBatchId(data.optionValue ?? '')}>
        {state.batches.map((item) => <Option key={item.id} value={item.id} text={`${item.id} ${item.product}`}>{item.id} {item.product}</Option>)}
      </Dropdown>
      <span>共{rows.length}条可追溯事件 · 审计与批次详情共用同一放行依据</span>
    </div>
    {basisView && <BasisCard view={basisView} />}
    <div className="table-panel"><Table size="small"><TableHeader><TableRow><TableHeaderCell>时间</TableHeaderCell><TableHeaderCell>实体</TableHeaderCell><TableHeaderCell>动作</TableHeaderCell><TableHeaderCell>操作人</TableHeaderCell><TableHeaderCell>说明</TableHeaderCell><TableHeaderCell>放行依据</TableHeaderCell></TableRow></TableHeader><TableBody>{rows.map((item) => <TableRow key={item.id}><TableCell>{item.createdAt.replace('T', ' ').slice(0, 16)}</TableCell><TableCell>{item.entity}</TableCell><TableCell>{item.action}</TableCell><TableCell>{item.operator}</TableCell><TableCell>{item.detail}</TableCell><TableCell>{item.basis ? <Badge appearance="outline">{item.basis}</Badge> : '—'}</TableCell></TableRow>)}</TableBody></Table></div>
  </section>
}
