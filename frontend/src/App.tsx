import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Square, Plus, PanelLeft, PanelLeftClose, BookOpen, ChevronDown, Settings2, Wind, FlaskConical, AlertCircle, Trash2 } from 'lucide-react'
import { Button } from './components/ui/button'
import { Lesson } from './components/Lesson'
import { ModelSettings, type Appearance, type ModelConfig } from './components/ModelSettings'
import { DeleteConversation, type DeleteTarget } from './components/DeleteConversation'
import { api,stream } from './lib/api'
import type { Conversation,Revision,State } from './types'

const examples=[{id:'gradient',title:'梯度下降',subtitle:'沿损失地形观察参数更新',prompt:'演示线性回归与梯度下降，给出损失曲面和优化粒子的移动轨迹。'},{id:'kmeans',title:'K-means 聚类',subtitle:'观察空间中的簇与质心',prompt:'用三维点云演示 K-means 的分配与质心更新。'},{id:'network',title:'反向传播',subtitle:'拆开前向、求导和更新',prompt:'逐步演示小型神经网络的前向传播、反向求梯度与权重更新。'},{id:'convolution',title:'卷积张量',subtitle:'跟随卷积核的滑动窗口',prompt:'用三维张量块演示卷积核滑动，展示每次乘加和输出。'},{id:'attention',title:'注意力机制',subtitle:'看见 token 之间的信息汇聚',prompt:'用空间节点和动态连线逐步演示 Q/K/V 与注意力加权。'}]
export default function App(){
  const [config,setConfig]=useState<ModelConfig|null>(null),[list,setList]=useState<Conversation[]>([]),[conversation,setConversation]=useState<Conversation|null>(null)
  const [appearance,setAppearance]=useState<Appearance>(()=>{try{const value=localStorage.getItem('windgen-appearance');if(value){const parsed=JSON.parse(value) as Appearance;if(['light','dark'].includes(parsed.mode)&&['blue','navy','lavender','rose','terracotta','amber'].includes(parsed.accent))return parsed}}catch{}return {mode:'light',accent:'blue'}})
  const [selected,setSelected]=useState(''),[prompt,setPrompt]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[thinking,setThinking]=useState('')
  const [sidebar,setSidebar]=useState(false),[sidebarHidden,setSidebarHidden]=useState(false),[showConfig,setShowConfig]=useState(false)
  const [deleteTarget,setDeleteTarget]=useState<DeleteTarget|null>(null),[deleting,setDeleting]=useState(false),[deleteError,setDeleteError]=useState('')
  const deletedConversations=useRef(new Set<string>()),listRequest=useRef(0)
  const abort=useRef<AbortController|null>(null),state=useRef<State>({}),current=useRef<Conversation|null>(null),scroll=useRef<HTMLDivElement>(null)
  current.current=conversation
  const revision=conversation?.revisions.find(r=>r.id===selected)
  const refresh=()=>{const id=++listRequest.current;return api<Conversation[]>('/conversations').then(items=>{if(id===listRequest.current)setList(items.filter(item=>!deletedConversations.current.has(item.id)))})}
  useEffect(()=>{api<ModelConfig>('/config').then(setConfig).catch(e=>setMessage(e.message));refresh().catch(e=>setMessage(e.message))},[])
  useEffect(()=>{document.documentElement.dataset.theme=appearance.mode;document.documentElement.dataset.accent=appearance.accent;localStorage.setItem('windgen-appearance',JSON.stringify(appearance))},[appearance])
  async function open(id:string){if(busy||deleting)return;try{const c=await api<Conversation>('/conversations/'+id);if(deletedConversations.current.has(id))return;setConversation(c);const r=c.revisions.at(-1);setSelected(r?.id||'');state.current=r?.state||{};setMessage('');setSidebar(false)}catch(e){if(!deletedConversations.current.has(id))setMessage((e as Error).message)}}
  function fresh(){if(busy||deleting)return;setConversation(null);setSelected('');state.current={};setMessage('');setPrompt('');setSidebar(false)}
  const persistTimer=useRef<ReturnType<typeof setTimeout>|null>(null)
  useEffect(()=>()=>{if(persistTimer.current)clearTimeout(persistTimer.current);abort.current?.abort()},[])
  function updateState(rid:string,value:State){
    if(selected!==rid)return
    state.current=value
    setConversation(c=>c?{...c,revisions:c.revisions.map(r=>r.id===rid?{...r,state:value}:r)}:c)
    if(persistTimer.current)clearTimeout(persistTimer.current)
    const cid=current.current?.id
    if(cid&&deletedConversations.current.has(cid))return
    persistTimer.current=setTimeout(()=>{if(cid)api(`/conversations/${cid}/revisions/${rid}/state`,{state:value},'PUT').catch(e=>{if(!deletedConversations.current.has(cid)&&current.current?.id===cid)setMessage(e.message)})},350)
  }
  async function removeConversation(){
    if(!deleteTarget||busy||deleting)return
    const target=deleteTarget,ids=target==='all'?list.map(c=>c.id):[target.id]
    ids.forEach(id=>deletedConversations.current.add(id));setDeleting(true);setDeleteError('')
    try{
      await api(target==='all'?'/conversations':'/conversations/'+target.id,undefined,'DELETE')
      ++listRequest.current
      setList(items=>target==='all'?[]:items.filter(c=>c.id!==target.id))
      if(target==='all'||current.current?.id===target.id){
        if(persistTimer.current){clearTimeout(persistTimer.current);persistTimer.current=null}
        current.current=null;state.current={};setConversation(null);setSelected('');setPrompt('');setMessage('');setSidebar(false)
      }
      setDeleteTarget(null);refresh().catch(()=>{})
    }catch(e){ids.forEach(id=>deletedConversations.current.delete(id));setDeleteError((e as Error).message)}
    finally{setDeleting(false)}
  }
  const askDelete=(target:DeleteTarget)=>{setDeleteError('');setDeleteTarget(target)}
  async function generate(text:string,example?:string){
    if(!text.trim()||busy||deleting)return
    if(persistTimer.current){clearTimeout(persistTimer.current);persistTimer.current=null}
    setBusy(true);setMessage('');setThinking('');setPrompt('')
    let c=conversation,rid='',source=''
    abort.current=new AbortController()
    try {
      if(!c){const created=await api<Conversation>('/conversations',{});c={...created,revisions:[]};setConversation(c)}
      const cid=c.id,oldId=example?undefined:selected||undefined,initial=example?{}:state.current
      await stream(`/conversations/${cid}/generate`,{prompt:text,mode:example?'demo':'live',example,state:initial,revision_id:oldId},abort.current.signal,(type,data)=>{
        if(type==='start'){
          rid=String(data.id);const next:Revision={id:rid,prompt:text,source:'',state:data.state as State,status:'streaming',mode:String(data.mode),created:Date.now()/1000}
          state.current=next.state;setConversation(previous=>previous?{...previous,title:text.slice(0,48),revisions:[...previous.revisions,next]}:previous);setSelected(rid)
          setTimeout(()=>scroll.current?.scrollTo({top:scroll.current.scrollHeight,behavior:'smooth'}),50)
        }
        if(type==='source'){source+=String(data.value);setConversation(previous=>previous?{...previous,revisions:previous.revisions.map(r=>r.id===rid?{...r,source}:r)}:previous)}
        if(type==='thinking')setThinking(String(data.value))
        if(type==='error'){setMessage(String(data.message));setConversation(previous=>previous?{...previous,revisions:previous.revisions.map(r=>r.id===rid?{...r,status:'error'}:r)}:previous)}
        if(type==='done')setConversation(previous=>previous?{...previous,revisions:previous.revisions.map(r=>r.id===rid?{...r,status:'complete'}:r)}:previous)
      })
    }catch(e){
      const cancelled=(e as Error).name==='AbortError'
      if(!cancelled)setMessage((e as Error).message)
      if(rid)setConversation(previous=>previous?{...previous,revisions:previous.revisions.map(r=>r.id===rid?{...r,status:cancelled?'cancelled':'error'}:r)}:previous)
    }finally{setBusy(false);setThinking('');abort.current=null;refresh().catch(()=>{})}
  }
  return <div className="app-shell">
    <aside className={'sidebar'+(sidebar?' open':'')+(sidebarHidden?' collapsed':'')}><div className="brand"><Wind size={23}/><strong>WindGen</strong><Button variant="ghost" size="icon" className="sidebar-hide" aria-label="隐藏侧边栏" title="隐藏侧边栏" onClick={()=>{setSidebarHidden(true);setSidebar(false)}}><PanelLeftClose size={17}/></Button></div><Button variant="outline" onClick={fresh} disabled={busy||deleting} data-new-conversation><Plus size={16}/> 新教程</Button><nav aria-label="会话历史">{list.length?list.map(c=><div key={c.id} className={'conversation-row'+(c.id===conversation?.id?' active':'')} data-testid={'conversation-'+c.id}><button className="conversation-open" onClick={()=>open(c.id)} disabled={busy||deleting} title={c.title}>{c.title}</button><button className="conversation-delete" onClick={()=>askDelete({id:c.id,title:c.title})} disabled={busy||deleting} aria-label={'删除会话：'+c.title} title="删除会话"><Trash2 size={14}/></button></div>):<p className="history-empty">暂无会话</p>}</nav><Button variant="ghost" className="delete-all-conversations" onClick={()=>askDelete('all')} disabled={!list.length||busy||deleting}><Trash2 size={14}/> 删除全部会话</Button><div className="sidebar-footer"><BookOpen size={16}/><span>算法交互课堂</span></div></aside>
    {sidebar&&<button className="sidebar-scrim" aria-label="关闭会话栏" onClick={()=>setSidebar(false)}/>}
    {deleteTarget&&<DeleteConversation target={deleteTarget} count={list.length} pending={deleting} error={deleteError} onCancel={()=>setDeleteTarget(null)} onConfirm={removeConversation}/>}
    <main className="main-shell"><header className="app-header"><div><Button variant="ghost" size="icon" className={'sidebar-toggle'+(sidebarHidden?' visible':'')} aria-label={sidebarHidden?"显示侧边栏":"打开会话栏"} title={sidebarHidden?"显示侧边栏":"打开会话栏"} onClick={()=>{if(sidebarHidden)setSidebarHidden(false);else setSidebar(!sidebar)}}><PanelLeft size={18}/></Button><span className="header-title">WindGen <ChevronDown size={13}/></span><span className="header-model">{config?.model||'正在连接'}</span></div><Button size="sm" variant="ghost" onClick={()=>setShowConfig(!showConfig)}><Settings2 size={16}/> 通用配置</Button></header>
      {showConfig&&config&&<ModelSettings config={config} onClose={()=>setShowConfig(false)} onSaved={setConfig} appearance={appearance} onAppearance={setAppearance}/>}
      <div className="conversation-scroll" ref={scroll}>
        {!revision?<div className="welcome"><Wind size={38} strokeWidth={1.5}/><h1>让算法成为<br/>可以探索的课堂。</h1><p>给出一个算法，观察公式如何变成数值，<br/>再用三维演示走过每一步。</p><div className="example-list">{examples.map(e=><button key={e.id} onClick={()=>generate(e.prompt,e.id)} disabled={busy}><span>{e.title}</span><small>{e.subtitle}</small><FlaskConical size={16}/></button>)}</div></div>:<div className="conversation-content">
          {conversation!.revisions.length>1&&<div className="turn-history">{conversation!.revisions.map((r,i)=><button key={r.id} className={selected===r.id?'selected':''} disabled={busy} onClick={()=>{setSelected(r.id);state.current=r.state;setMessage('')}}>版本 {i+1}{r.status==='cancelled'?' · 已停止':r.status==='error'?' · 错误':''}</button>)}</div>}
          <div className="user-message">{revision.prompt}</div><div className="assistant-heading"><Wind size={20}/><span>WindGen</span>{thinking&&<small>{thinking}</small>}</div>
          <Lesson key={revision.id} revision={revision} onState={value=>updateState(revision.id,value)}/>
          {revision.mode==='demo'&&<p className="demo-note"><FlaskConical size={14}/> 当前是固定教学样例。继续提问将由模型生成新版本。</p>}
        </div>}
      </div>
      <div className="composer-area">{message&&<div className="error-message" role="alert"><AlertCircle size={16}/>{message}</div>}<form className="composer" onSubmit={e=>{e.preventDefault();generate(prompt)}}><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();generate(prompt)}}} placeholder={revision?'按当前参数继续提问，或修改这个演示…':'例如：用三维张量块讲解卷积，展示公式与计算过程…'} aria-label="输入教程需求" rows={2} disabled={busy}/><div className="composer-bottom">{busy?<Button type="button" size="icon" aria-label="停止生成" onClick={()=>abort.current?.abort()}><Square size={15}/></Button>:<Button type="submit" size="icon" aria-label="发送" disabled={!prompt.trim()}><ArrowUp size={19}/></Button>}</div></form></div>
    </main>
  </div>
}
