import { Fragment, Suspense, lazy, useEffect, useRef, useState } from 'react'
import katex from 'katex'
import { Play, Pause, StepForward, RotateCcw } from 'lucide-react'
import { Button } from './ui/button'
import { Slider } from './ui/slider'
import { FlowDiagram } from './FlowDiagram'
import { Matrix, TokenGraph } from './TeachingVisuals'
import type { SceneObject } from './Scene'
const Scene=lazy(()=>import('./Scene').then(module=>({default:module.Scene})))
import type { Node } from '../types'

export type Invoke=(handler:unknown,args:unknown[])=>void
const num=(v:unknown,d=0)=>typeof v==='number'&&Number.isFinite(v)?v:d
const text=(v:unknown)=>v===null||v===undefined?'':typeof v==='object'?JSON.stringify(v):String(v)
function Formula({content,inline=false}:{content:string;inline?:boolean}) {
  let html=''
  try {html=katex.renderToString(content,{throwOnError:false,displayMode:!inline,trust:false,maxExpand:1000})}catch{return <code>{content}</code>}
  return inline?<span className="inline-math" dangerouslySetInnerHTML={{__html:html}}/>:<div className="formula" dangerouslySetInnerHTML={{__html:html}}/>
}
function Stepper({value,max,onChange,label}:{value:number;max:number;onChange:(v:number)=>void;label:string}) {
  const [playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1)
  const latest=useRef({value,max,onChange});latest.current={value,max,onChange}
  useEffect(()=>{if(!playing)return;const timer=setInterval(()=>{const p=latest.current;if(p.value>=p.max){setPlaying(false);return}p.onChange(p.value+1)},1000/speed);return()=>clearInterval(timer)},[playing,speed])
  useEffect(()=>{if(value===0||value>=max)setPlaying(false)},[value,max])
  return <div className="stepper">
    <div className="stepper-label"><strong>{label||'演示步骤'}</strong><span data-testid="step-value">{value} / {max}</span></div>
    <div className="stepper-actions"><Button size="sm" variant={playing?'secondary':'default'} disabled={max===0} onClick={()=>setPlaying(!playing)}>{playing?<Pause size={14}/>:<Play size={14}/>} {playing?'暂停':'播放'}</Button><Button size="sm" variant="outline" disabled={value>=max} onClick={()=>onChange(value+1)}><StepForward size={14}/> 单步</Button><Button size="sm" variant="ghost" onClick={()=>{setPlaying(false);onChange(0)}}><RotateCcw size={14}/> 重置</Button><select aria-label="播放速度" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value={.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option></select></div>
    <Slider aria-label="演示步骤" min={0} max={Math.max(1,max)} step={1} value={[value]} onValueChange={v=>{setPlaying(false);onChange(v[0])}}/>
  </div>
}
function Chart({p}:{p:Record<string,unknown>}) {
  const data=Array.isArray(p.data)?p.data.slice(0,500) as Record<string,unknown>[]:[]
  const xKey=text(p.xKey)||'x', yKey=text(p.yKey)||'loss'
  const points=data.map(d=>[num(d[xKey]),num(d[yKey])])
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),xmin=Math.min(...xs,0),xmax=Math.max(...xs,1),ymin=Math.min(...ys,0),ymax=Math.max(...ys,1e-8)
  const path=points.map(([x,y])=>[30+(x-xmin)/(xmax-xmin||1)*510,150-(y-ymin)/(ymax-ymin||1)*125])
  return <figure className="chart"><figcaption>{text(p.label)||'数值曲线'}</figcaption><svg viewBox="0 0 560 175" role="img" aria-label={text(p.label)||'数值曲线'}><path d="M30 20V150H540" fill="none" stroke="#d9d3c9"/><polyline points={path.map(p=>p.join(',')).join(' ')} fill="none" stroke="#607c9e" strokeWidth="2.5"/><text x="4" y="28" fontSize="10" fill="#625d56">{ymax.toPrecision(3)}</text><text x="8" y="151" fontSize="10" fill="#625d56">{ymin.toPrecision(2)}</text><text x="30" y="170" fontSize="10" fill="#625d56">{xmin}</text><text x="520" y="170" fontSize="10" fill="#625d56">{xmax}</text></svg></figure>
}
function objectsFromNodes(nodes:Node[]):SceneObject[] {
  return nodes.map((n,i)=>({...n.p,type:n.t==='point'?'sphere':text(n.p?.type)||n.t,id:text(n.p?.id)||String(i),children:n.c?objectsFromNodes(n.c):[]} as SceneObject))
}
export function Renderer({node,invoke}:{node:Node|null;invoke:Invoke}) {
  if(!node)return null
  const p=node.p||{},children=(node.c||[]).map((c,i)=><Renderer key={text(c.p?.key)||text(c.p?.id)||i} node={c} invoke={invoke}/>)
  const content=p.content!==undefined?text(p.content):undefined
  const call=(name:string,...args:unknown[])=>invoke(p[name],args)
  switch(node.t){
    case '#text':return <>{node.v}</>
    case '#frag':return <Fragment>{children}</Fragment>
    case 'title':return <h3>{children}</h3>
    case 'text':return <p>{children}</p>
    case 'caption':case 'label':return <p className="caption">{children}</p>
    case 'bold':return <strong>{children}</strong>
    case 'list':return p.marker==='number'?<ol className="lesson-list">{children}</ol>:<ul className="lesson-list">{children}</ul>
    case 'list-item':return <li>{children}</li>
    case 'table-row':return <tr>{children}</tr>
    case 'table-cell':return <td>{children}</td>
    case 'disclosure':return <details className="lesson-disclosure" open={p.open===true}><summary>{text(p.label)||'实现细节'}</summary>{children}</details>
    case 'progress':return <progress max={num(p.max,1)} value={num(p.value)} aria-label={text(p.label)||'进度'}/>
    case 'badge':return <span className="badge">{children}</span>
    case 'divider':return <hr/>
    case 'spacer':return <div className="spacer"/>
    case 'button':return <Button variant={p.variant==='secondary'?'secondary':'default'} disabled={p.disabled===true} onClick={()=>call('onClick')}>{children}</Button>
    case 'code':return <pre className="code-block"><code>{content??children}</code></pre>
    case 'formula':return <Formula content={content??''}/>
    case 'math':return <Formula content={content??''} inline/>
    case 'matrix':case 'heatmap':return <Matrix p={p} heatmap={node.t==='heatmap'} onSelect={(row,column)=>call('onSelect',row,column)}/>
    case 'flow-diagram':return <FlowDiagram p={p} onSelect={id=>call('onSelect',id)}/>
    case 'token-graph':return <TokenGraph p={p} onSelect={index=>call('onSelect',index)}/>
    case 'metric':return <div className="metric"><span>{text(p.label)}</span><strong>{text(p.value)}</strong></div>
    case 'slider':return <label className="parameter"><span>{text(p.label)}<output>{text(p.value)}</output></span><Slider aria-label={text(p.label)} min={num(p.min)} max={num(p.max,100)} step={num(p.step,1)} value={[num(p.value)]} onValueChange={v=>call('onChange',v[0])}/></label>
    case 'input':case 'textarea':return <label className="parameter"><span>{text(p.label)}</span><input type={p.type==='number'?'number':'text'} value={text(p.value)} onChange={e=>call('onChange',p.type==='number'?Number(e.target.value):e.target.value)}/></label>
    case 'checkbox':return <label className="checkbox"><input type="checkbox" checked={p.value===true} onChange={e=>call('onChange',e.target.checked)}/>{text(p.label)}{children}</label>
    case 'select':{const options=(Array.isArray(p.options)?p.options:[]).map((o:unknown)=>typeof o==='object'&&o?o as Record<string,unknown>:{label:o,value:o});return <label className="parameter"><span>{text(p.label)}</span><select aria-label={text(p.label)} value={text(p.value)} onChange={e=>call('onChange',options.find(o=>text(o.value)===e.target.value)?.value??e.target.value)}>{options.map((opt,i)=><option key={i} value={text(opt.value)}>{text(opt.label)}</option>)}</select></label>}
    case 'segmented-control':return <div className="token-options" role="group" aria-label={text(p.label)}>{(Array.isArray(p.options)?p.options:[]).map((o:any,i)=>{const opt=typeof o==='object'&&o?o:{label:o,value:o};return <button key={i} aria-pressed={opt.value===p.value} onClick={()=>call('onChange',opt.value)}>{text(opt.label)}</button>})}</div>
    case 'stepper':return <Stepper value={Math.max(0,num(p.value))} max={Math.max(0,Math.min(500,num(p.max,30)))} onChange={v=>call('onChange',v)} label={text(p.label)}/>
    case 'scene':return <Suspense fallback={<p className="caption">正在加载三维渲染器…</p>}><Scene objects={p.objects||objectsFromNodes(node.c||[])} camera={p.camera} selected={text(p.selected)} onSelect={id=>call('onSelect',id)} caption={text(p.caption)}/></Suspense>
    case 'chart':return <Chart p={p}/>
    case 'table':return <div className="table-scroll"><table><thead><tr>{(Array.isArray(p.columns)?p.columns:[]).map((v,i)=><th key={i}>{text(v)}</th>)}</tr></thead><tbody>{(Array.isArray(p.rows)?p.rows:[]).slice(0,200).map((r,i)=><tr key={i}>{(Array.isArray(r)?r:[]).map((v,j)=><td key={j}>{text(v)}</td>)}</tr>)}</tbody></table></div>
    default:return <div className={'node-'+node.t} style={node.t==='grid'?{gridTemplateColumns:`repeat(${Math.max(1,Math.min(4,num(p.columns,2)))},minmax(0,1fr))`}:undefined}>{children}</div>
  }
}
