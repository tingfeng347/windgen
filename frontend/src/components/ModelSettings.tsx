import { useState, type CSSProperties } from 'react'
import { Waves, Blocks, Eye, EyeOff, ShieldCheck, CircleCheck, AlertCircle, Loader2, Cable, ChevronRight, Sun, Moon, Palette, Check } from 'lucide-react'
import { Dialog } from './ui/dialog'
import { Button } from './ui/button'
import { api } from '../lib/api'

export interface ModelConfig {configured:boolean;model:string;base_url:string}
export type Appearance = {mode:'light'|'dark';accent:'blue'|'navy'|'lavender'|'rose'|'terracotta'|'amber'}
type Provider = 'deepseek'|'custom'
const isDeepSeek=(url:string)=>{try{return new URL(url).hostname==='api.deepseek.com'}catch{return false}}

type ModelSettingsProps={config:ModelConfig;onClose:()=>void;onSaved:(config:ModelConfig)=>void;appearance:Appearance;onAppearance:(appearance:Appearance)=>void}
export function ModelSettings({config,onClose,onSaved,appearance,onAppearance}:ModelSettingsProps) {
  const initial:Provider=isDeepSeek(config.base_url)?'deepseek':'custom'
  const [section,setSection]=useState<'appearance'|'model'>('appearance')
  const [provider,setProvider]=useState<Provider>(initial)
  const [drafts,setDrafts]=useState({deepseek:{base_url:initial==='deepseek'?config.base_url:'https://api.deepseek.com',model:initial==='deepseek'?config.model:'deepseek-flash',api_key:''},custom:{base_url:initial==='custom'?config.base_url:'',model:initial==='custom'?config.model:'',api_key:''}})
  const [reveal,setReveal]=useState(false),[busy,setBusy]=useState<'test'|'save'|null>(null),[saved,setSaved]=useState(false)
  const [feedback,setFeedback]=useState<{kind:'success'|'error';text:string}|null>(null)
  const draft=drafts[provider],retained=config.configured&&draft.base_url.trim().replace(/\/+$/,'')===config.base_url
  const valid=Boolean(draft.base_url.trim()&&draft.model.trim()&&(draft.api_key.trim()||retained))
  const update=(field:keyof typeof draft,value:string)=>{setDrafts(current=>({...current,[provider]:{...current[provider],[field]:value}}));setFeedback(null);setSaved(false)}
  const choose=(next:Provider)=>{setProvider(next);setFeedback(null);setReveal(false);setSaved(false)}
  async function submit(action:'test'|'save') {
    if(busy||!valid)return
    setBusy(action);setFeedback(null)
    try {
      const body={base_url:draft.base_url.trim(),model:draft.model.trim(),api_key:draft.api_key.trim()||null}
      if(action==='test'){
        const result=await api<{message:string}>('/config/test',body)
        setFeedback({kind:'success',text:result.message})
      }else{
        const result=await api<ModelConfig>('/config',body,'PUT')
        onSaved(result);setDrafts(current=>({...current,[provider]:{base_url:result.base_url,model:result.model,api_key:''}}));setReveal(false);setSaved(true)
        setFeedback({kind:'success',text:'配置已保存，后续生成将使用这个模型。'})
      }
    }catch(e){setFeedback({kind:'error',text:(e as Error).message})}
    finally{setBusy(null)}
  }
  return <Dialog open closeDisabled={!!busy} onOpenChange={open=>{if(!open&&!busy)onClose()}} title="通用配置">
    <div className="model-dialog-body">
      <nav className="model-providers settings-nav" aria-label="通用配置">
        <button className={'provider-option'+(section==='appearance'?' selected':'')} onClick={()=>setSection('appearance')} aria-pressed={section==='appearance'}><span className="provider-symbol"><Palette size={18}/></span><span><strong>外观</strong></span><ChevronRight size={14}/></button>
        <button className={'provider-option'+(section==='model'?' selected':'')} onClick={()=>setSection('model')} aria-pressed={section==='model'}><span className="provider-symbol"><Blocks size={18}/></span><span><strong>模型服务</strong></span><ChevronRight size={14}/></button>
        {section==='model'&&<div className="provider-subnav">
          <span className="provider-label">模型服务</span>
          <button className={'provider-option'+(provider==='deepseek'?' selected':'')} onClick={()=>choose('deepseek')} disabled={!!busy} aria-pressed={provider==='deepseek'}><span className="provider-symbol"><Waves size={18}/></span><span><strong>DeepSeek</strong><small>官方接口</small></span></button>
          <button className={'provider-option'+(provider==='custom'?' selected':'')} onClick={()=>choose('custom')} disabled={!!busy} aria-pressed={provider==='custom'}><span className="provider-symbol"><Blocks size={17}/></span><span><strong>自定义接口</strong><small>OpenAI 兼容服务</small></span></button>
          <div className="provider-note"><ShieldCheck size={16}/><p>密钥保存在本机<br/>已有密钥不会回传</p></div>
        </div>}
      </nav>
      {section==='appearance'&&<section className="appearance-panel" aria-label="外观设置">
        <div className="appearance-heading"><h3>外观</h3></div>
        <div className="appearance-settings-grid"><div className="appearance-group appearance-mode-group"><h4>颜色模式</h4><div className="appearance-mode" role="group" aria-label="颜色模式">
          <button className={appearance.mode==='light'?'selected':''} onClick={()=>onAppearance({...appearance,mode:'light'})} aria-pressed={appearance.mode==='light'}><Sun size={18}/><span>亮色</span></button>
          <button className={appearance.mode==='dark'?'selected':''} onClick={()=>onAppearance({...appearance,mode:'dark'})} aria-pressed={appearance.mode==='dark'}><Moon size={18}/><span>暗色</span></button>
        </div></div>
        <div className="appearance-group appearance-theme-group"><h4>主题色</h4><div className="appearance-accents" role="group" aria-label="主题色">
          {([{id:'blue',label:'雾蓝',color:'#607c9e'},{id:'navy',label:'墨蓝',color:'#4f6786'},{id:'lavender',label:'灰紫',color:'#7e719e'},{id:'rose',label:'玫瑰',color:'#a5566a'},{id:'terracotta',label:'赤陶',color:'#ad5946'},{id:'amber',label:'琥珀',color:'#a86c2f'}] as const).map(item=><button key={item.id} className={appearance.accent===item.id?'selected':''} onClick={()=>onAppearance({...appearance,accent:item.id})} aria-pressed={appearance.accent===item.id} aria-label={item.label}><span className="accent-swatch" style={{'--swatch':item.color} as CSSProperties}>{appearance.accent===item.id&&<Check size={12}/>}</span><span>{item.label}</span></button>)}
        </div></div></div>
      </section>}
      {section==='model'&&<form id="model-settings-form" className="model-form" onSubmit={e=>{e.preventDefault();submit('save')}}>
        <div className="provider-heading"><div><h3>{provider==='deepseek'?'DeepSeek':'自定义接口'}</h3><p>{provider==='deepseek'?'使用 DeepSeek API 生成交互教程。':'连接你的 OpenAI 兼容模型服务。'}</p></div><span className="connection-method">API Key</span></div>
        <label className="model-field"><span>接口地址 <small>Base URL</small></span><input aria-label="接口地址" type="url" value={draft.base_url} onChange={e=>update('base_url',e.target.value)} placeholder="https://api.example.com/v1" autoComplete="off" required disabled={!!busy}/><small>填写 API 基础地址，不包含 /chat/completions。</small></label>
        <div className="model-protocol"><span>API 格式</span><strong>OpenAI 兼容 <small>Chat Completions</small></strong></div>
        <label className="model-field"><span>API Key {retained&&<small className="key-retained"><ShieldCheck size={12}/> 已配置</small>}</span><div className="model-secret"><input aria-label="API Key" type={reveal?'text':'password'} value={draft.api_key} onChange={e=>update('api_key',e.target.value)} placeholder={retained?'留空保留已保存的密钥':'输入此服务的 API Key'} autoComplete="new-password" spellCheck={false} disabled={!!busy}/><button type="button" aria-label={reveal?'隐藏新密钥':'显示新密钥'} onClick={()=>setReveal(!reveal)} disabled={!draft.api_key||!!busy}>{reveal?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></label>
        <label className="model-field"><span>模型 ID</span><input aria-label="模型 ID" value={draft.model} onChange={e=>update('model',e.target.value)} placeholder="输入服务支持的模型 ID" spellCheck={false} autoComplete="off" required disabled={!!busy}/><small>与服务端的模型名称保持一致。</small></label>
        {feedback&&<div className={'model-feedback '+feedback.kind} role={feedback.kind==='error'?'alert':'status'}>{feedback.kind==='error'?<AlertCircle size={16}/>:<CircleCheck size={16}/>}<span>{feedback.text}</span></div>}
      </form>}
    </div>
    <footer className="model-dialog-footer">{section==='model'?<><Button type="button" variant="ghost" onClick={()=>submit('test')} disabled={!valid||!!busy}>{busy==='test'?<Loader2 size={15} className="animate-spin"/>:<Cable size={15}/>} 测试连接</Button><div><Button type="button" variant="ghost" onClick={onClose} disabled={!!busy}>{saved?'完成':'取消'}</Button><Button type="submit" form="model-settings-form" disabled={!valid||!!busy||saved}>{busy==='save'&&<Loader2 size={15} className="animate-spin"/>}{busy==='save'?'正在保存':'保存配置'}</Button></div></>:<><span/><Button type="button" onClick={onClose}>完成</Button></>}</footer>
  </Dialog>
}
