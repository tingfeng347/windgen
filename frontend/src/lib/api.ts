export async function api<T>(path:string,body?:unknown,method?:string):Promise<T> {
  const response=await fetch('/api'+path,{method:method||(body?'POST':'GET'),headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined})
  if(!response.ok){const error=await response.json().catch(()=>({detail:'请求失败'}));throw Error(typeof error.detail==='string'?error.detail:'请求参数无效')}
  return response.json()
}
export async function stream(path:string,body:unknown,signal:AbortSignal,onEvent:(type:string,data:Record<string,unknown>)=>void) {
  const response=await fetch('/api'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal})
  if(!response.ok){const e=await response.json().catch(()=>({detail:'生成失败'}));throw Error(e.detail)}
  const reader=response.body!.getReader(),decoder=new TextDecoder()
  let buffer='',terminal=false
  try {
    while(true){const {done,value}=await reader.read();if(done)break;buffer=(buffer+decoder.decode(value,{stream:true})).replace(/\r\n/g,'\n');let end:number
      while((end=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,end);buffer=buffer.slice(end+2);const type=block.match(/^event:\s*(.+)$/m)?.[1];const data=block.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(type&&data){if(type==='done'||type==='error')terminal=true;onEvent(type,JSON.parse(data))}}
    }
    if(!terminal)throw Error('生成连接中断，已保留收到的内容，请重试')
  } finally {reader.releaseLock()}
}
