import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { Badge, Button } from '@fluentui/react-components'
import { BrowserRouter } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from './store'
import { resetDemo } from './store/haccpSlice'
import { Overview } from './views/Overview'
import { CleaningVerification } from './views/CleaningVerification'
import { ProcessControl } from './views/ProcessControl'
import { DeviationWorkbench } from './views/DeviationWorkbench'
import { AuditTrail } from './views/AuditTrail'

const navigation = [
  ['/', '生产批次'],
  ['/cleaning', '清洗验证'],
  ['/process', 'HACCP控制矩阵'],
  ['/deviations', '偏差调查'],
  ['/audit', '追溯审计']
]

function Shell() {
  const dispatch = useDispatch<AppDispatch>()
  const openDeviations = useSelector((state: RootState) => state.haccp.deviations.filter((item) => item.status !== '已关闭').length)
  const invalidBasis = useSelector((state: RootState) => state.haccp.batches.filter((item) => item.releaseBasis.validity === '已失效' && item.status !== '已放行' && item.status !== '已报废').length)
  const clock = useSelector((state: RootState) => state.haccp.clock)
  return (
    <div className="app-shell">
      <aside>
        <div className="brand"><b>H</b><div><strong>食品安全控制台</strong><small>HACCP批次与偏差追溯</small></div></div>
        <nav>{navigation.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'}><span>{label}</span>{label === '偏差调查' && <Badge appearance="filled" color="danger">{openDeviations}</Badge>}{label === '清洗验证' && invalidBasis > 0 && <Badge appearance="filled" color="warning">{invalidBasis}</Badge>}</NavLink>)}</nav>
        <div className="aside-note"><strong>系统时间</strong><span>{clock.slice(0, 16).replace('T', ' ')}</span><small>数据源：本地持久化</small></div>
      </aside>
      <main>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/cleaning" element={<CleaningVerification />} />
          <Route path="/process" element={<ProcessControl />} />
          <Route path="/deviations" element={<DeviationWorkbench />} />
          <Route path="/audit" element={<AuditTrail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Button className="reset-button" appearance="subtle" onClick={() => dispatch(resetDemo())}>恢复演示数据</Button>
      </main>
    </div>
  )
}

export function App() {
  return <BrowserRouter><Shell /></BrowserRouter>
}
