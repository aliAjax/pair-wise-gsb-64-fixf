import { Badge } from '@fluentui/react-components'
import type { ReleaseBasis } from '../types'

function basisBadge(basis: ReleaseBasis) {
  if (basis.signed) return <Badge appearance="tint" color="success">依据已随签字冻结</Badge>
  if (basis.stale) return <Badge appearance="tint" color="danger">依据失效 · 需重算</Badge>
  return <Badge appearance="tint" color="success">依据有效</Badge>
}

export function ReleaseBasisCard({ basis }: { basis: ReleaseBasis }) {
  return (
    <div className="basis-card">
      <div className="basis-head"><strong>放行依据</strong>{basisBadge(basis)}</div>
      <dl>
        <div><dt>绑定清洗结果</dt><dd>{basis.cleaningId || '未绑定'} {basis.cleaningId && `V${basis.cleaningVersion}`}</dd></div>
        <div><dt>当前生效清洗</dt><dd>{basis.currentCleaningId ? `${basis.currentCleaningId} V${basis.currentCleaningVersion}` : '本线无生效清洗结果'}</dd></div>
        <div><dt>前一批次</dt><dd>{basis.prevBatchId ?? '无'} {basis.prevProduct && `· ${basis.prevProduct}`}</dd></div>
        <div><dt>清洗有效期至</dt><dd>{basis.validUntil ? basis.validUntil.slice(0, 16).replace('T', ' ') : '—'}</dd></div>
        <div><dt>未关闭偏差</dt><dd>{basis.openDeviations} 项</dd></div>
        <div><dt>控制点覆盖</dt><dd>{basis.controlPointsCovered}/{basis.controlPointsTotal}</dd></div>
        <div><dt>签字</dt><dd>{basis.signed ? `${basis.signedBy} · ${basis.signedAt?.slice(0, 16).replace('T', ' ')}` : '未签字'}</dd></div>
      </dl>
      {basis.blockers.length > 0 && <ul className="basis-blockers">{basis.blockers.map((item) => <li key={item}>{item}</li>)}</ul>}
    </div>
  )
}
