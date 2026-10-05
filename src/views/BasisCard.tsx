import { Badge } from '@fluentui/react-components'
import type { ReleaseBasisView } from '../services/releaseBasis'

const fmt = (iso: string) => iso ? iso.slice(0, 16).replace('T', ' ') : '—'

/** 统一放行依据卡片：批次详情、偏差工作台与追溯审计渲染同一份判定结果。 */
export function BasisCard({ view }: { view: ReleaseBasisView }) {
  const tone = view.validity === '已失效' ? 'danger' : view.reasons.length > 0 ? 'warning' : 'success'
  const label = view.validity === '已失效' ? '依据已失效' : view.signed ? '依据有效（已签字归档）' : view.reasons.length > 0 ? '依据待补齐' : '依据有效'
  return (
    <div className="basis-card">
      <div className="basis-head"><strong>统一放行依据</strong><Badge appearance="tint" color={tone}>{label}</Badge></div>
      <dl>
        <div><dt>前一批次</dt><dd>{view.previousBatchId} · {view.previousProduct}</dd></div>
        <div><dt>清洗结果</dt><dd>{view.cleaningRecordId} V{view.cleaningVersion}（{view.cleaningStatus}）</dd></div>
        <div><dt>有效时段</dt><dd>至 {fmt(view.validUntil)}</dd></div>
        <div><dt>依据绑定</dt><dd>{fmt(view.boundAt)}</dd></div>
        <div><dt>未关闭偏差</dt><dd>{view.openDeviations} 项</dd></div>
      </dl>
      {view.reasons.length > 0 && <ul className="basis-reasons">{view.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
    </div>
  )
}
