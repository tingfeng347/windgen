import { useRef } from 'react'
import { AlertDialog } from 'radix-ui'
import { Loader2, Trash2 } from 'lucide-react'
import { Button } from './ui/button'

export type DeleteTarget = {id:string;title:string}|'all'
export function DeleteConversation({target,count,pending,error,onCancel,onConfirm}:{target:DeleteTarget;count:number;pending:boolean;error:string;onCancel:()=>void;onConfirm:()=>void}) {
  const trigger=useRef(document.activeElement as HTMLElement|null)
  const all=target==='all'
  function restoreFocus(){
    const toggle=document.querySelector<HTMLElement>('[aria-label="打开会话栏"]')
    const mobileClosed=Boolean(toggle?.getClientRects().length&&!document.querySelector('.sidebar')?.classList.contains('open'))
    const candidates=[trigger.current,document.querySelector<HTMLElement>('[data-new-conversation]'),toggle]
    candidates.find(element=>{
      if(!element?.isConnected||element.hasAttribute('disabled')||!element.getClientRects().length)return false
      if(mobileClosed&&element.closest('.sidebar'))return false
      const rect=element.getBoundingClientRect()
      return rect.right>0&&rect.left<innerWidth&&rect.bottom>0&&rect.top<innerHeight
    })?.focus()
  }
  return <AlertDialog.Root open onOpenChange={open=>{if(!open&&!pending)onCancel()}}>
    <AlertDialog.Portal><AlertDialog.Overlay className="model-overlay"/>
      <AlertDialog.Content className="delete-dialog" onCloseAutoFocus={event=>{event.preventDefault();restoreFocus()}}>
        <div className="delete-dialog-icon"><Trash2 size={21}/></div>
        <AlertDialog.Title>{all?'删除全部会话？':'删除这条会话？'}</AlertDialog.Title>
        {!all&&<p className="delete-conversation-title">{target.title}</p>}
        <AlertDialog.Description>{all?`将永久删除全部 ${count} 条会话及其所有版本。`:'此会话及其所有版本将被永久删除。'}此操作无法撤销。</AlertDialog.Description>
        {error&&<p role="alert" className="delete-error">{error}</p>}
        <div className="delete-dialog-actions"><AlertDialog.Cancel asChild><Button variant="outline" disabled={pending}>取消</Button></AlertDialog.Cancel><Button variant="destructive" onClick={onConfirm} disabled={pending}>{pending?<Loader2 size={15} className="animate-spin"/>:<Trash2 size={15}/>} {pending?'正在删除':all?'删除全部':'删除会话'}</Button></div>
      </AlertDialog.Content>
    </AlertDialog.Portal>
  </AlertDialog.Root>
}
