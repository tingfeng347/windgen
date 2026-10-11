import type {Compiled,Snapshot,State,Node} from '../types'
const allowed = new Set(['#text','#frag','box','row','column','grid','grid-item','card','divider','spacer','text','title','caption','bold','label','code','badge','button','input','textarea','checkbox','select','slider','table','metric','formula','chart','scene','stepper','group','mesh','point','line'])
export function validateTree(tree:unknown):Node|null {
  let count=0
  function walk(raw:unknown,depth:number):Node|null {
    if(raw===null)return null
    if(typeof raw!=='object'||!raw||depth>48||++count>10000)throw Error('界面数据无效或过大')
    const n=raw as Node
    if(!allowed.has(n.t))return {t:'caption',c:[{t:'#text',v:`不支持的组件：${String(n.t).slice(0,40)}`}]}
    if(n.v!==undefined&&typeof n.v!=='string')throw Error('文字数据无效')
    if(n.p&&(typeof n.p!=='object'||Array.isArray(n.p)))throw Error('属性数据无效')
    if(n.c&&!Array.isArray(n.c))throw Error('子节点数据无效')
    return {t:n.t,v:n.v,p:n.p||{},c:(n.c||[]).map(c=>walk(c,depth+1)).filter((c):c is Node=>c!==null)}
  }
  return walk(tree,0)
}
export class Sandbox {
  private frame:HTMLIFrameElement
  private token=crypto.randomUUID()
  private seq=0
  private version=0
  private ready:Promise<void>
  private latestState:State={}
  private pending=new Map<number,{resolve:()=>void;reject:(e:Error)=>void;timer:number}>()
  constructor(private snapshot:(v:Snapshot)=>void,private error:(e:string)=>void) {
    this.frame=document.createElement('iframe');this.frame.hidden=true;this.frame.setAttribute('sandbox','allow-scripts')
    this.ready=new Promise((resolve,reject)=>{
      const timeout=window.setTimeout(()=>reject(Error('计算沙箱启动超时')),5000)
      this.onReady=()=>{clearTimeout(timeout);resolve()}
    })
    window.addEventListener('message',this.receive)
    this.frame.src='/sandbox/frame#'+this.token;document.body.appendChild(this.frame)
  }
  private onReady:()=>void=()=>{}
  private receive=(event:MessageEvent)=>{
    const m=event.data
    if(event.source!==this.frame.contentWindow||!m?.windgen||m.token!==this.token)return
    if(m.kind==='ready'){this.post({kind:'init'});this.onReady();return}
    const pending=this.pending.get(m.id)
    if(pending){clearTimeout(pending.timer);this.pending.delete(m.id)}
    if(m.kind==='failure'){const e=Error(m.message);pending?.reject(e);this.error(m.message);return}
    if(m.kind==='snapshot'){
      try { const tree=validateTree(m.tree);this.version=m.version;this.latestState=m.state;this.snapshot({tree,state:m.state,version:m.version});pending?.resolve() }
      catch(e){this.error((e as Error).message);pending?.reject(e as Error)}
    } else pending?.resolve()
  }
  private post(data:Record<string,unknown>){this.frame.contentWindow?.postMessage({windgen:true,token:this.token,...data},'*')}
  private async send(data:Record<string,unknown>){
    await this.ready
    const id=++this.seq
    return new Promise<void>((resolve,reject)=>{
      const timer=window.setTimeout(()=>{this.pending.delete(id);reject(Error('计算没有响应，请重置演示'));this.error('计算没有响应，请重置演示')},2500)
      this.pending.set(id,{resolve,reject,timer});this.post({...data,id})
    })
  }
  program(compiled:Compiled,state:State,reset:boolean){return this.send({kind:'program',compiled,state,reset})}
  invoke(handler:unknown,args:unknown[]){
    const id=(handler as {__dilFn?:string})?.__dilFn
    if(!id)return Promise.resolve()
    return this.send({kind:'invoke',handler:id,args,version:this.version})
  }
  state(){return this.latestState}
  dispose(){window.removeEventListener('message',this.receive);this.frame.remove();for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('演示已切换'))}this.pending.clear()}
}
