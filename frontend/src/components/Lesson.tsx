import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Code2, RotateCcw, Braces } from 'lucide-react'
import { Button } from './ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
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
export function Lesson({revision,onState}:{revision:Revision;onState:(state:State)=>void}) {
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[compiled,setCompiled]=useState<Compiled|null>(null)
  const [error,setError]=useState(''),[epoch,setEpoch]=useState(0)
  const runtime=useRef<Sandbox|null>(null),compiler=useRef<Worker|null>(null)
  const latest=useRef({revision,onState});latest.current={revision,onState}
  const seq=useRef(0),initialized=useRef(false),onReadySource=useRef('')
  useEffect(()=>{
    let alive=true
    initialized.current=false;setError('');setSnapshot(null)
    const sandbox=new Sandbox(value=>{if(alive){setSnapshot(value);latest.current.onState(value.state)}},message=>{if(alive)setError(message)})
    runtime.current=sandbox
    const worker=new Worker(new URL('../compiler/worker.ts',import.meta.url),{type:'module'})
    compiler.current=worker
    let timer:number|undefined
    worker.onmessage=async event=>{
      if(event.data.id!==seq.current||!alive)return
      clearTimeout(timer)
      if(event.data.error){setError(event.data.error);return}
      const next=event.data.result as Compiled
      setCompiled(next)
      try {
        const state=stateInstruction(latest.current.revision.source,latest.current.revision.state)
        await sandbox.program(next,state,!initialized.current)
        initialized.current=true
      }catch(e){if(alive)setError((e as Error).message)}
    }
    worker.onerror=()=>setError('编译器发生错误，请重试')
    const compile=(source:string)=>{
      const id=++seq.current;clearTimeout(timer)
      timer=window.setTimeout(()=>{worker.terminate();setError('文档解析超时，请缩小演示范围或重新加载')},3000)
      worker.postMessage({id,source})
    }
    onReadySource.current=''
    const initial=latest.current.revision.source
    if(initial){compile(initial);onReadySource.current=initial}
    // Store the bounded compile dispatcher, so streaming updates reuse both workers.
    dispatch.current=compile
    return()=>{alive=false;clearTimeout(timer);sandbox.dispose();worker.terminate();runtime.current=null;compiler.current=null}
  },[revision.id,epoch])
  const dispatch=useRef<(source:string)=>void>(()=>{})
  useEffect(()=>{
    if(!revision.source||revision.source===onReadySource.current)return
    // Metadata must finish before the first seed is committed to the runtime.
    if(revision.source.startsWith('<!-- windgen-state:')&&!revision.source.includes('-->'))return
    const timer=setTimeout(()=>{onReadySource.current=revision.source;dispatch.current(revision.source)},revision.status==='streaming'?90:0)
    return()=>clearTimeout(timer)
  },[revision.source,revision.status,epoch])
  const invoke=(handler:unknown,args:unknown[])=>{runtime.current?.invoke(handler,args).catch(e=>setError(e.message))}
  return <div className="lesson">
    <Tabs defaultValue="lesson">
      <div className="lesson-tabs"><TabsList><TabsTrigger value="lesson">交互教程</TabsTrigger><TabsTrigger value="source"><Code2 size={14}/> 源码</TabsTrigger><TabsTrigger value="state"><Braces size={14}/> 状态</TabsTrigger></TabsList><span className="lesson-status">{revision.mode==='demo'?'固定演示样例':revision.status==='streaming'?'正在生成…':'模型生成'}</span></div>
      {error&&<div className="error-message" role="alert"><AlertCircle size={16}/><span>{error}</span><Button variant="ghost" size="sm" onClick={()=>setEpoch(v=>v+1)}><RotateCcw size={14}/> 重新加载</Button></div>}
      <TabsContent value="lesson"><div className="lesson-body">{snapshot?.tree?<Renderer node={snapshot.tree} invoke={invoke}/>:<div className="lesson-pending"><span className="loading-dot"/>正在生成文档并准备可运行的界面…</div>}</div></TabsContent>
      <TabsContent value="source"><p className="caption">模型生成的 DIL 文档；计算逻辑在沙箱运行。</p><pre className="source-view">{revision.source}</pre>{compiled?.diagnostics.length? <details><summary>解析诊断（{compiled.diagnostics.length}）</summary><pre>{JSON.stringify(compiled.diagnostics,null,2)}</pre></details>:null}</TabsContent>
      <TabsContent value="state"><p className="caption">下一轮对话会携带这些参数和当前步骤。</p><pre className="source-view">{JSON.stringify(snapshot?.state||revision.state,null,2)}</pre></TabsContent>
    </Tabs>
  </div>
}
