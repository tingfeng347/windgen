import type { CSSProperties } from 'react'

type Cell = number | string | null
export function matrixData(raw: unknown): Cell[][] {
  if (!Array.isArray(raw) || raw.length > 32) throw Error('矩阵最多支持 32 行')
  const columns = Array.isArray(raw[0]) ? raw[0].length : 0
  if (columns > 32 || raw.some(row => !Array.isArray(row) || row.length !== columns)) throw Error('矩阵行宽必须一致，最多 32 列')
  return raw.map(row => row.map((v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' ? v.slice(0,80) : null))
}
const label = (v: unknown) => typeof v === 'string' || typeof v === 'number' ? String(v) : ''
const labels = (raw: unknown) => Array.isArray(raw) ? raw.slice(0,32).map(label) : []
const numberText = (v: Cell, precision: number) => v === null ? '—' : typeof v === 'number' ? Number(v.toFixed(precision)).toString() : v

export function Matrix({ p, heatmap = false, onSelect }: { p: Record<string,unknown>; heatmap?: boolean; onSelect: (row:number,column:number)=>void }) {
  let data: Cell[][]
  try { data = matrixData(p.data ?? p.values ?? []) } catch (e) { return <p role="alert" className="caption">{(e as Error).message}</p> }
  const rows = labels(p.rowLabels), columns = labels(p.columnLabels), precision = Math.max(0,Math.min(8,typeof p.precision==='number'?p.precision:4))
  const numeric = data.flat().filter((v): v is number => typeof v === 'number'), min = typeof p.min==='number'?p.min:Math.min(0,...numeric), max = typeof p.max==='number'?p.max:Math.max(1e-8,...numeric)
  const selected = Array.isArray(p.selected)?p.selected:[]
  return <figure className={'teaching-matrix'+(heatmap?' teaching-heatmap':'')}>
    <figcaption><strong>{label(p.label)|| (heatmap?'注意力权重':'矩阵')}</strong><span>{data.length} × {data[0]?.length||0}</span></figcaption>
    {data.length?<div className="matrix-scroll"><table><thead><tr><th scope="col">{label(p.rowLabel)||'行 / 列'}</th>{data[0].map((_,j)=><th scope="col" key={j}>{columns[j]||j}</th>)}</tr></thead><tbody>{data.map((row,i)=><tr key={i} className={p.selectedRow===i?'matrix-row-selected':''}><th scope="row">{rows[i]||i}</th>{row.map((v,j)=>{
      const intensity=typeof v==='number'?Math.max(0,Math.min(1,(v-min)/(max-min||1))):0
      const active=selected[0]===i&&selected[1]===j
      return <td key={j}><button type="button" aria-label={`${label(p.label)||'矩阵'} ${rows[i]||i} → ${columns[j]||j}: ${numberText(v,precision)}`} aria-pressed={active} className={active?'selected':''} style={heatmap?{'--cell-fill':`${Math.round(intensity*35)}%`} as CSSProperties:undefined} onClick={()=>onSelect(i,j)}>{numberText(v,precision)}</button></td>
    })}</tr>)}</tbody></table></div>:<p className="caption">等待矩阵数据…</p>}
    {heatmap&&<div className="heatmap-scale"><span>{numberText(min,precision)}</span><span className="heatmap-scale-bar"/><span>{numberText(max,precision)}</span><small>深色表示更大的数值 · 点击单元格查看</small></div>}
  </figure>
}

export function TokenGraph({p,onSelect}:{p:Record<string,unknown>;onSelect:(index:number)=>void}) {
  const tokens=labels(p.tokens).slice(0,16),selected=Math.max(0,Math.min(tokens.length-1,typeof p.selected==='number'?p.selected:0))
  const weights=Array.isArray(p.weights)?p.weights:[],height=Math.max(180,tokens.length*42+36)
  return <figure className="token-graph">
    <figcaption><strong>{label(p.label)||'Token 信息汇聚'}</strong><span>Query → Key / Value</span></figcaption>
    <div className="token-options" role="group" aria-label="选择 query token">{tokens.map((t,i)=><button key={i} aria-pressed={i===selected} onClick={()=>onSelect(i)}>{t}</button>)}</div>
    <svg viewBox={`0 0 560 ${height}`} role="img" aria-label={`Token ${tokens[selected]||''} 的注意力连接`}>
      {tokens.map((t,j)=>{
        const raw=Array.isArray(weights[selected])?weights[selected][j]:weights[j],weight=typeof raw==='number'&&Number.isFinite(raw)?Math.max(0,Math.min(1,raw)):0,y=36+j*42
        return <g key={j}><path d={`M140 ${height/2} C260 ${height/2},260 ${y},365 ${y}`} fill="none" stroke="var(--primary)" strokeWidth={.5+weight*8} opacity={weight===0?.15:.35+weight*.65} strokeDasharray={weight===0?'4 4':undefined}/><rect x="365" y={y-14} width="95" height="28" rx="6" fill="var(--secondary)"/><text x="412" y={y+5} textAnchor="middle" fill="var(--foreground)">{t}</text><text x="475" y={y+5} fill="var(--foreground)">{weight.toFixed(4)}</text></g>
      })}
      <rect x="30" y={height/2-20} width="110" height="40" rx="8" fill="var(--secondary)" stroke="var(--primary)"/><text x="85" y={height/2+5} textAnchor="middle" fill="var(--foreground)">{tokens[selected]||'Query'}</text>
    </svg>
  </figure>
}
