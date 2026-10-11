import { useRef, type ReactNode } from 'react'
import { Dialog as Primitive } from 'radix-ui'
import { X } from 'lucide-react'

export function Dialog({open,onOpenChange,title,description,children,closeDisabled=false}:{open:boolean;onOpenChange:(open:boolean)=>void;title:string;description?:string;children:ReactNode;closeDisabled?:boolean}) {
  const trigger=useRef(document.activeElement as HTMLElement|null)
  return <Primitive.Root open={open} onOpenChange={onOpenChange}>
    <Primitive.Portal>
      <Primitive.Overlay className="model-overlay"/>
      <Primitive.Content className="model-dialog" onCloseAutoFocus={event=>{event.preventDefault();trigger.current?.focus()}}>
        <header className="model-dialog-header">
          <div><Primitive.Title>{title}</Primitive.Title>{description&&<Primitive.Description>{description}</Primitive.Description>}</div>
          <Primitive.Close className="model-close" aria-label="关闭通用配置" disabled={closeDisabled}><X size={18}/></Primitive.Close>
        </header>
        {children}
      </Primitive.Content>
    </Primitive.Portal>
  </Primitive.Root>
}
