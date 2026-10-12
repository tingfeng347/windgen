import {useEffect,useId,useMemo,useRef,useState} from 'react'
import {Play,Pause} from 'lucide-react'
import {Button} from './ui/button'
type FlowNode={id:string;label:string;x:number;y:number;value?:unknown}
const finite=(v:unknown,fallback:number)=>typeof v==='number'&&Number.isFinite(v)?v:fallback
export function FlowDiagram({p,onSelect}:{p:Record<string,unknown>;onSelect:(id:string)=>void}){
 const nodes=useMemo(()=> (Array.isArray(p.nodes)?p.nodes:[]).slice(0,40).filter(n=>n&&typeof n==='object').map((n,i)=>({id:String(n.id??i),label:String(n.label??n.id??i).slice(0,30),x:Math.max(45,Math.min(595,finite(n.x,80+i*100))),y:Math.max(40,Math.min(320,finite(n.y,180))),value:n.value})) as FlowNode[],[p.nodes])
 const edges=useMemo(()=> (Array.isArray(p.edges)?p.edges:[]).slice(0,80).filter(e=>e&&typeof e==='object').map(e=>({from:nodes.find(n=>n.id===String(e.from)),to:nodes.find(n=>n.id===String(e.to)),weight:Math.max(0,Math.min(1,finite(e.weight,1))),label:String(e.label??'').slice(0,24)})).filter(e=>e.from&&e.to),[p.edges,nodes])
 const svg=useRef<SVGSVGElement>(null),id=useId().replace(/:/g,'')
 const [playing,setPlaying]=useState(()=>p.animated!==false&&!matchMedia('(prefers-reduced-motion: reduce)').matches),[speed,setSpeed]=useState(1)
 useEffect(()=>{if(playing)svg.current?.unpauseAnimations();else svg.current?.pauseAnimations()},[playing,edges])
 const duration=Math.max(1,Math.min(10,finite(p.duration,3)))/speed
 return <figure className="flow-diagram" data-playing={playing}>
  <div className="flow-toolbar"><strong>{String(p.label||'信息流动画')}</strong><div><Button size="sm" variant="ghost" onClick={()=>setPlaying(v=>!v)} aria-label={playing?'暂停动画':'播放动画'}>{playing?<Pause size={14}/>:<Play size={14}/>} {playing?'暂停':'播放'}</Button><select aria-label="动画速度" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value={.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option></select></div></div>
  <svg ref={svg} viewBox="0 0 640 360" role="img" aria-label={String(p.label||'可播放的信息流动画')}>
   <defs><marker id={id+'arrow'} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/></marker></defs>
   {edges.map((edge,i)=>{const a=edge.from!,b=edge.to!,dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1,offset=Math.min(32,length*.2),start=[a.x+dx/length*offset,a.y+dy/length*offset],end=[b.x-dx/length*offset,b.y-dy/length*offset],path=`M${start} L${end}`;return <g key={`${a.id}-${b.id}-${i}`} className="flow-edge" data-weight={edge.weight}>
    <path d={path} fill="none" stroke="currentColor" strokeWidth={1+edge.weight*3} opacity={edge.weight? .25+edge.weight*.5:.12} strokeDasharray={edge.weight?undefined:'4 4'} markerEnd={`url(#${id}arrow)`}/>
    {edge.label&&<text x={(a.x+b.x)/2} y={(a.y+b.y)/2-10} textAnchor="middle">{edge.label}</text>}
    {edge.weight>0&&<circle r={3+edge.weight*2} fill="currentColor" className="flow-particle"><animateMotion path={path} dur={`${duration}s`} repeatCount="indefinite"/></circle>}
   </g>})}
   {nodes.map(n=><g key={n.id} className={'flow-node'+(p.selected===n.id?' selected':'')} role="button" tabIndex={0} aria-label={n.label} onClick={()=>onSelect(n.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(n.id)}}}>
    <rect x={n.x-38} y={n.y-22} width="76" height="44" rx="9"/>
    <text x={n.x} y={n.y+(n.value===undefined?5:-2)} textAnchor="middle">{n.label}</text>
    {n.value!==undefined&&<text className="flow-value" x={n.x} y={n.y+14} textAnchor="middle">{typeof n.value==='number'?n.value.toFixed(3):String(n.value).slice(0,20)}</text>}
   </g>)}
  </svg>
  {p.caption!==undefined&&<figcaption>{String(p.caption)}</figcaption>}
 </figure>
}
