import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Code2, RotateCcw, Braces } from 'lucide-react'
import { Button } from './ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import { lessonSource } from '../lib/lesson-source'
import { Renderer } from './Renderer'
import { Sandbox } from '../runtime/client'
import type { Compiled, Revision, Snapshot, State } from '../types'

export function stateInstruction(source:string,state:State):State {
  const match=source.match(/^<!-- windgen-state:\s*(\{.*?\})\s*-->/s)
  if(!match)return state
  try {
    const instruction=JSON.parse(match[1]),next={...state}
    if(instruction.set&&typeof instruction.set==='object'&&!Array.isArray(instruction.set)){
      for(const [k,v] of Object.entries(instruction.set))if(!['__proto__','constructor','prototype'].includes(k))next[k]=v
    }
    if(Array.isArray(instruction.reset))for(const k of instruction.reset)if(typeof k==='string')delete next[k]
    return next
  } catch {return state}
}
export function Lesson({revision,onState,onRepair,repairExhausted=false}:{revision:Revision;onState:(state:State)=>void;onRepair?:(issues:string[])=>void;repairExhausted?:boolean}) {
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[compiled,setCompiled]=useState<Compiled|null>(null)
  const [settled,setSettled]=useState('')
  const [error,setError]=useState(''),[epoch,setEpoch]=useState(0)
  const runtime=useRef<Sandbox|null>(null),compiler=useRef<Worker|null>(null)
  const latest=useRef({revision,onState});latest.current={revision,onState}
  const seq=useRef(0),initialized=useRef(false),onReadySource=useRef('')
  const lastFailure=useRef('')
  useEffect(()=>{
    let alive=true
    initialized.current=false;lastFailure.current='';setError('');setSnapshot(null);setCompiled(null);setSettled('')
    const fail=(message:string)=>{if(alive){lastFailure.current=message;if(latest.current.revision.status!=='streaming')setError(message)}}
    const sandbox=new Sandbox(value=>{if(alive){
      // Incomplete prefixes may temporarily render an empty tree. Keep the last useful view.
      if(value.tree&&(value.tree.t!=='#frag'||value.tree.c?.length))setSnapshot(value)
      lastFailure.current='';setError('')
      latest.current.onState(latest.current.revision.status==='streaming'?{...latest.current.revision.state,...value.state}:value.state)
    }},fail)
    runtime.current=sandbox
    const worker=import.meta.env.DEV?new Worker(new URL('../compiler/worker.ts',import.meta.url),{type:'module'}):new Worker('/compiler-worker.js',{type:'module'})
    compiler.current=worker
    let timer:number|undefined
    let scheduled:number|undefined,active=false,ready=false,stopped=false,pendingSource='',lastSource='',lastAt=0,programSource='',appliedMetadata=''
    const stopCompiler=(message:string)=>{
      stopped=true;active=false;clearTimeout(timer);clearTimeout(scheduled);worker.terminate();fail(message)
    }
    // Loading a stale/missing bundle is distinct from parsing a loaded document.
    timer=window.setTimeout(()=>stopCompiler('编译器加载超时，请刷新页面'),5000)
    // Throttle rather than debounce: a continuous token stream must never postpone
    // compilation indefinitely. Coalesce pending prefixes while a program is running.
    const pump=()=>{
      if(!alive||!ready||stopped||active||!pendingSource||pendingSource===lastSource)return
      if(pendingSource.trimStart().startsWith('<!--')&&!pendingSource.includes('-->'))return
      const wait=70-(Date.now()-lastAt)
      if(latest.current.revision.status==='streaming'&&wait>0&&pendingSource.length-lastSource.length<320){
        if(scheduled===undefined)scheduled=window.setTimeout(()=>{scheduled=undefined;pump()},wait)
        return
      }
      clearTimeout(scheduled);scheduled=undefined
      active=true;programSource=pendingSource;lastSource=programSource;lastAt=Date.now()
      const id=++seq.current
      timer=window.setTimeout(()=>stopCompiler('文档解析超时，请缩小演示范围或重新加载'),3000)
      worker.postMessage({id,source:programSource})
    }
    worker.onmessage=async event=>{
      if(!alive||stopped)return
      if(event.data.kind==='ready'){clearTimeout(timer);ready=true;pump();return}
      if(event.data.id!==seq.current||!alive)return
      clearTimeout(timer)
      try {
        if(event.data.error)throw Error(event.data.error)
        const next=event.data.result as Compiled
        setCompiled(next)
        const metadata=programSource.match(/^<!-- windgen-state:.*?-->/s)?.[0]||''
        const applyMetadata=!!metadata&&metadata!==appliedMetadata
        const state=applyMetadata?stateInstruction(programSource,latest.current.revision.state):latest.current.revision.state
        await sandbox.program(next,state,!initialized.current||applyMetadata)
        if(applyMetadata)appliedMetadata=metadata
        initialized.current=true
      }catch(e){fail((e as Error).message)}
      finally{setSettled(programSource);active=false;pump()}
    }
    worker.onerror=()=>stopCompiler('编译器加载或运行失败，请刷新页面')
    const compile=(source:string)=>{pendingSource=source;pump()}
    onReadySource.current=''
    const initial=latest.current.revision.source
    if(initial){compile(initial);onReadySource.current=initial}
    // Store the bounded compile dispatcher, so streaming updates reuse both workers.
    dispatch.current=compile
    return()=>{alive=false;clearTimeout(timer);clearTimeout(scheduled);sandbox.dispose();worker.terminate();runtime.current=null;compiler.current=null}
  },[revision.id,epoch])
  const dispatch=useRef<(source:string)=>void>(()=>{})
  useEffect(()=>{
    if(!revision.source||revision.source===onReadySource.current)return
    // Metadata must finish before the first seed is committed to the runtime.
    if(revision.source.startsWith('<!-- windgen-state:')&&!revision.source.includes('-->'))return
    onReadySource.current=revision.source;dispatch.current(revision.source)
  },[revision.source,revision.status,epoch])
  useEffect(()=>{if(revision.status!=='streaming'&&lastFailure.current)setError(lastFailure.current)},[revision.status])
  const invoke=(handler:unknown,args:unknown[])=>{runtime.current?.invoke(handler,args).catch(e=>setError(e.message))}
  const issues=Array.from(new Set([...(snapshot?.warnings||[]),...(compiled?.diagnostics||[]).filter(d=>['invalid_statement','invalid_expression','invalid_program'].includes(d.code)).map(d=>`${d.code}（第 ${d.line} 行）`)])).slice(0,12)
  const repairIssues=[...issues,...(error&&!error.includes('编译器')?[error]:[])]
  const issueKey=repairIssues.join('；')
  useEffect(()=>{
    if(revision.status==='complete'&&settled===revision.source&&issueKey&&!repairExhausted&&onRepair){
      const timer=setTimeout(()=>onRepair(issueKey.split('；')),150)
      return ()=>clearTimeout(timer)
    }
  },[revision.status,revision.source,settled,issueKey,repairExhausted,onRepair])
  const preview=lessonSource(revision.source).replace(/^<!--.*?-->\s*/s,'').split('{@body')[0].trim()
  return <div className="lesson">
    <Tabs defaultValue="lesson">
      <div className="lesson-tabs"><TabsList><TabsTrigger value="lesson">交互教程</TabsTrigger><TabsTrigger value="source"><Code2 size={14}/> 源码</TabsTrigger><TabsTrigger value="state"><Braces size={14}/> 状态</TabsTrigger></TabsList><span className="lesson-status">{revision.mode==='demo'?'固定演示样例':revision.status==='streaming'?'正在生成…':'模型生成'}</span></div>
      {error&&error.includes('编译器')&&<div className="error-message" role="alert"><AlertCircle size={16}/><span>{error}</span><Button variant="ghost" size="sm" onClick={()=>error.includes('刷新页面')?window.location.reload():setEpoch(v=>v+1)}><RotateCcw size={14}/> {error.includes('刷新页面')?'刷新页面':'重新加载'}</Button></div>}
      {revision.status!=='streaming'&&repairExhausted&&repairIssues.length>0&&<div className="error-message" role="alert">这次演示暂时无法完成，请重试或简化需求。</div>}
      <TabsContent value="lesson"><div className="lesson-body">{snapshot?.tree?<Renderer node={snapshot.tree} invoke={invoke}/>:preview&&!preview.startsWith('<')?<div className="stream-preview">{preview.split(/\n+/).map((line,i)=>/^#+ /.test(line)?<h3 key={i}>{line.replace(/^#+ /,'')}</h3>:<p key={i}>{line}</p>)}</div>:<div className="lesson-pending">{revision.status==='streaming'?<><span className="loading-dot"/>正在生成…</>:revision.status==='cancelled'?'生成已停止。':revision.status==='error'?revision.source?'生成未完成，可在源码中查看已收到的内容。':'本次未生成教程内容，请重试。':error?'教程暂时无法显示，请查看源码或重新加载。':compiled?'本次输出没有可显示的内容。':'正在加载教程…'}</div>}</div></TabsContent>
      <TabsContent value="source"><p className="caption">模型生成的 DIL 文档；计算逻辑在沙箱运行。</p><pre className="source-view">{revision.source}</pre>{compiled?.diagnostics.length? <details><summary>解析诊断（{compiled.diagnostics.length}）</summary><pre>{JSON.stringify(compiled.diagnostics,null,2)}</pre></details>:null}</TabsContent>
      <TabsContent value="state"><p className="caption">下一轮对话会携带这些参数和当前步骤。</p><pre className="source-view">{JSON.stringify(snapshot?.state||revision.state,null,2)}</pre></TabsContent>
    </Tabs>
  </div>
}
