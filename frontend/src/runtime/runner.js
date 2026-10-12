// WindGen runtime. All model evaluation is inside an opaque-origin iframe's Worker.
// The language/compiler is adapted from intelligent-ui-demo; see THIRD_PARTY_LICENSES.
const slots = new Map();
let program, constants, appData, root, index = 0, handlers = new Map(), version = 0;
let activeKeys = new Set(), state = {}, currentId = 0;
let warnings = [];
const fragment = Symbol('fragment');
function jsx(type, props, ...children) { return {type,props:props||{},children}; }
const DIL = {
  math: teachingMath,
  reportError(error) {const message=String(error?.message||error).slice(0,180);if(warnings.length<12&&!warnings.includes(message))warnings.push(message);},
  jsx, Fragment: fragment, render(el) {root=el;},
  useConstants() {return constants;}, useAppData(fn) {return fn?fn(appData):appData;},
  useState(initial, opts) {
    const key=opts?.key ?? '@'+index++;activeKeys.add(key);
    if (!slots.has(key)) slots.set(key,Object.hasOwn(state,key)?state[key]:typeof initial==='function'?initial():initial);
    return [slots.get(key),value=>slots.set(key,typeof value==='function'?value(slots.get(key)):value)];
  },
  useMemo(fn) {return fn();},useCallback(fn){return fn;},
  useRef(value){const key='ref'+index++;if(!slots.has(key))slots.set(key,{current:value});return slots.get(key);},
  useEffect(){throw Error('使用 stepper 推进教学步骤，不支持自由 effect');}, useNow(){return 0;},
};
let nodeCount=0;
function serialize(node,depth=0) {
  if(depth>48||++nodeCount>10000)throw Error('界面节点过多');
  if(node==null||typeof node==='boolean')return null;
  if(typeof node==='string'||typeof node==='number')return {t:'#text',v:String(node)};
  if(Array.isArray(node))return {t:'#frag',c:node.map(n=>serialize(n,depth+1)).filter(Boolean)};
  if(typeof node.type==='function')return serialize(node.type(node.props),depth+1);
  const p={};
  for(const [key,value] of Object.entries(node.props||{})) {
    if(['__proto__','prototype','constructor'].includes(key))continue;
    if(typeof value==='function'){const id='fn'+handlers.size;handlers.set(id,value);p[key]={__dilFn:id};}
    else if(value!==undefined)p[key]=value;
  }
  return {t:node.type===fragment?'#frag':String(node.type),p,c:(node.children||[]).map(n=>serialize(n,depth+1)).filter(Boolean)};
}
function render(id) {
  index=0;root=null;handlers=new Map();activeKeys=new Set();nodeCount=0;warnings=[];
  new Function('DIL','__dil','"use strict";\n'+program)(DIL,{jsx,Fragment:fragment});
  const tree=serialize(root),snapshot={};
  for(const key of activeKeys)if(!key.startsWith('@'))snapshot[key]=slots.get(key);
  const message={kind:'snapshot',id,tree,state:snapshot,version:++version,warnings};
  const text=JSON.stringify(message,(_,value)=>{
    if(typeof value==='number'&&Number.isNaN(value)){DIL.reportError('计算出现 NaN，请检查矩阵维度与输入数值');return null;}
    if(value===Infinity)return '∞';if(value===-Infinity)return '−∞';return value;
  });
  if(text.length>600000)throw Error('演示数据过大，请减少点或对象');
  // JSON removes prototypes and non-data values from the tree crossing the boundary.
  self.postMessage(JSON.parse(text));
}
self.onmessage=event=>{
  const msg=event.data;currentId=msg.id;
  try {
    if(msg.kind==='program') {
      if(msg.reset){slots.clear();state=msg.state||{};}
      program=msg.compiled.code;constants=msg.compiled.constants;appData=msg.compiled.appData;
      render(msg.id);
    } else if(msg.kind==='invoke') {
      if(msg.version!==version){self.postMessage({kind:'ignored',id:msg.id});return;}
      const fn=handlers.get(msg.handler);if(!fn)throw Error('交互已更新，请重试');
      fn(...msg.args);render(msg.id);
    }
  } catch(error) { self.postMessage({kind:'failure',id:msg.id,message:String(error?.message||error).slice(0,250)}); }
};
