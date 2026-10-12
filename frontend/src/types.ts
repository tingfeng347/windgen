export type State = Record<string, unknown>
export interface Revision { kind?:'lesson'|'chat'; id:string; prompt:string; source:string; state:State; status:string; mode:string; created:number }
export interface Conversation { id:string; title:string; updated:number; revisions:Revision[] }
export interface Node { t:string; v?:string; p?:Record<string,unknown>; c?:Node[] }
export interface Compiled { code:string; constants:Record<string,unknown>; appData:unknown; stateKeys:string[]; diagnostics:{code:string;line:number;column:number}[]; fallbackMarkdown:string; source:string }
export interface Snapshot {tree:Node|null; state:State; version:number;warnings?:string[]}
