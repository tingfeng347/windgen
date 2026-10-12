import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Line } from '@react-three/drei'
import { BufferGeometry, Float32BufferAttribute, DoubleSide, CanvasTexture, SRGBColorSpace, Sprite, Vector3, PerspectiveCamera } from 'three'
import type { OrbitControls as OrbitControlType } from 'three-stdlib'
import { RotateCcw, Move3D } from 'lucide-react'
import { Button } from './ui/button'
import { sceneBounds, sceneFrame, visibleSceneLabels } from './scene-layout'

type Vec = [number,number,number]
export interface SceneObject { id?:string; type:string; position?:Vec; rotation?:Vec; scale?:Vec; size?:Vec; color?:string; opacity?:number; label?:string; text?:string; value?:unknown; points?:Vec[]; vertices?:Vec[]; indices?:number[]; width?:number; children?:SceneObject[] }
const kinds=new Set(['group','box','sphere','cylinder','cone','plane','line','mesh','label','point'])
const vec=(v:unknown,fallback:Vec=[0,0,0]):Vec=>Array.isArray(v)&&v.length===3&&v.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=10000)?v as Vec:fallback
const color=(c:unknown)=>typeof c==='string'&&/^#[\da-f]{3,8}$/i.test(c)?c:'#607c9e'
export function sceneObjects(raw:unknown):SceneObject[] {
  let count=0
  function check(o:unknown,depth:number):SceneObject {
    if(!o||typeof o!=='object'||++count>600||depth>12)throw Error('三维场景过大或对象无效')
    const a=o as SceneObject
    if(!kinds.has(a.type))throw Error('不支持的三维对象：'+String(a.type).slice(0,30))
    if((a.vertices?.length??0)>10000||(a.indices?.length??0)>30000||(a.points?.length??0)>2000)throw Error('三维几何数据超过限制')
    const vertices=a.vertices?.map(v=>vec(v))
    if(a.indices&&!a.indices.every(i=>Number.isInteger(i)&&i>=0&&i<(vertices?.length??0)))throw Error('网格索引无效')
    return {...a,id:String(a.id||'object'+count),position:vec(a.position),rotation:vec(a.rotation),scale:vec(a.scale,[1,1,1]),size:vec(a.size,[.25,.25,.25]),color:color(a.color),opacity:Math.max(.05,Math.min(1,Number(a.opacity)||1)),vertices,points:a.points?.map(p=>vec(p)),children:a.children?.map(c=>check(c,depth+1))}
  }
  if(!Array.isArray(raw))return []
  return raw.map(o=>check(o,0))
}
function Geometry({item}:{item:SceneObject}) {
  const geometry=useMemo(()=>{
    const g=new BufferGeometry()
    g.setAttribute('position',new Float32BufferAttribute((item.vertices||[]).flat(),3))
    if(item.indices)g.setIndex(item.indices)
    g.computeVertexNormals()
    return g
  },[item.vertices,item.indices])
  useEffect(()=>()=>geometry.dispose(),[geometry])
  return <primitive object={geometry} attach="geometry" />
}
function SceneLabel({text,selected=false,dark=false}:{text:string;selected?:boolean;dark?:boolean}) {
  const sprite=useRef<Sprite>(null)
  const vectors=useMemo(()=>({position:new Vector3(),camera:new Vector3(),direction:new Vector3(),parentScale:new Vector3()}),[])
  const texture=useMemo(()=>{
    const canvas=document.createElement('canvas');canvas.height=64
    const context=canvas.getContext('2d')!
    context.font='32px system-ui';canvas.width=Math.min(2048,Math.ceil(context.measureText(text.slice(0,100)).width)+32)
    context.fillStyle=dark?(selected?'#59452f':'#302e2b'):(selected?'#fff0db':'#fdfcf9');context.fillRect(0,0,canvas.width,64)
    context.fillStyle=dark?(selected?'#f4d8b3':'#eeeae3'):(selected?'#714827':'#38342e');context.font='32px system-ui';context.textAlign='center';context.textBaseline='middle';context.fillText(text.slice(0,100),canvas.width/2,32,canvas.width-24)
    const image=new CanvasTexture(canvas);image.colorSpace=SRGBColorSpace
    return image
  },[text,selected,dark])
  useFrame(({camera,size})=>{
    if(!sprite.current)return
    sprite.current.getWorldPosition(vectors.position);camera.getWorldPosition(vectors.camera);camera.getWorldDirection(vectors.direction)
    const depth=Math.max(.1,vectors.position.sub(vectors.camera).dot(vectors.direction))
    const viewHeight=camera instanceof PerspectiveCamera?2*Math.tan(camera.fov*Math.PI/360)*depth/camera.zoom:('top' in camera?(camera.top-camera.bottom)/camera.zoom:10)
    const height=28*viewHeight/Math.max(1,size.height)
    sprite.current.parent?.getWorldScale(vectors.parentScale)
    sprite.current.scale.set(height*texture.image.width/64/Math.max(.001,vectors.parentScale.x),height/Math.max(.001,vectors.parentScale.y),1)
  })
  useEffect(()=>()=>texture.dispose(),[texture])
  return <sprite ref={sprite} renderOrder={1000}><spriteMaterial map={texture} toneMapped={false} depthTest={false} depthWrite={false}/></sprite>
}
function ObjectView({item,selected,onSelect,dark,labels}:{item:SceneObject;selected:string;onSelect:(id:string)=>void;dark:boolean;labels:Set<string>}) {
  const size=item.size||[.25,.25,.25]
  const chosen=selected===item.id
  const label=labels.has(item.id!)&&(item.label||item.text)
  const content=item.type==='line'
    ? (item.points&&item.points.length>=2?<Line points={item.points} color={item.color} lineWidth={Math.min(8,item.width||2)} onClick={e=>{e.stopPropagation();onSelect(item.id!)}}/>:null)
    : item.type==='label'?null:item.type==='group'?item.children?.map((child,i)=><ObjectView key={child.id||i} item={child} selected={selected} onSelect={onSelect} dark={dark} labels={labels}/>)
    : <mesh onClick={e=>{e.stopPropagation();onSelect(item.id!)}} castShadow receiveShadow>
      {item.type==='mesh'?<Geometry item={item}/>:item.type==='sphere'||item.type==='point'?<sphereGeometry args={[Math.max(.01,size[0]),24,16]}/>:item.type==='cylinder'?<cylinderGeometry args={[Math.abs(size[0]),Math.abs(size[0]),Math.abs(size[1]),24]}/>:item.type==='cone'?<coneGeometry args={[Math.abs(size[0]),Math.abs(size[1]),24]}/>:item.type==='plane'?<planeGeometry args={[Math.abs(size[0]),Math.abs(size[1])]}/>:<boxGeometry args={size.map(Math.abs) as Vec}/>}
      <meshStandardMaterial color={chosen?'#cc9553':item.color} roughness={.5} metalness={.08} transparent={item.opacity!<1} opacity={item.opacity} side={DoubleSide}/>
    </mesh>
  return <group position={item.position} rotation={item.rotation} scale={item.scale}>
    {content}
    {label&&<group position={[0,item.type==='label'?0:Math.abs(size[1])+.25,0]}><SceneLabel text={String(label)} selected={chosen} dark={dark}/></group>}
  </group>
}
function CameraFrame({objects,direction,epoch,controls}:{objects:SceneObject[];direction:Vec;epoch:number;controls:React.RefObject<OrbitControlType|null>}) {
  const {camera,size}=useThree()
  // Reframe when stages change their geometry layout, not on every numeric update.
  const layout=JSON.stringify(objects.map(function shape(o):unknown{return [o.type,o.id,o.position,o.rotation,o.scale,o.children?.map(shape)]}))
  useEffect(()=>{
    const frame=sceneFrame(sceneBounds(objects),size.width/size.height,direction)
    camera.position.copy(frame.position);camera.lookAt(frame.target);camera.updateProjectionMatrix()
    if(controls.current){controls.current.target.copy(frame.target);controls.current.maxDistance=Math.max(60,frame.distance*4);controls.current.update();controls.current.saveState()}
  // Object size/value changes preserve the learner's orbit; stage/reset/resize reframe.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[layout,size.width,size.height,epoch,camera])
  return null
}
export function Scene({objects:raw,camera,selected='',onSelect,caption}:{objects:unknown;camera?:unknown;selected?:string;onSelect:(id:string)=>void;caption?:string}) {
  const controls=useRef<OrbitControlType>(null)
  const [contextError,setContextError]=useState(false)
  const [viewEpoch,setViewEpoch]=useState(0)
  const [dark,setDark]=useState(()=>document.documentElement.dataset.theme==='dark')
  useEffect(()=>{const observer=new MutationObserver(()=>setDark(document.documentElement.dataset.theme==='dark'));observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});return()=>observer.disconnect()},[])
  let objects:SceneObject[]=[];let error=''
  try { objects=sceneObjects(raw) } catch(e) {error=(e as Error).message}
  if(error)return <p role="alert" className="error-message">{error}</p>
  const labels=visibleSceneLabels(objects,selected)
  const focused=(function find(list:SceneObject[]):SceneObject|undefined{for(const o of list){if(o.id===selected)return o;const child=find(o.children||[]);if(child)return child}})(objects)
  return <figure className="scene-wrap">
    <div className="scene-toolbar"><span><Move3D size={15}/> 三维演示</span><Button variant="ghost" size="sm" onClick={()=>setViewEpoch(v=>v+1)}><RotateCcw size={14}/> 复位视角</Button></div>
    <div className="scene-canvas" data-testid="scene">
      {contextError?<p role="alert">三维渲染不可用。请使用支持 WebGL 的浏览器；公式和数值表仍可使用。</p>:<Suspense fallback={<p>正在准备三维场景…</p>}><Canvas shadows dpr={[1,1.5]} camera={{position:vec(camera,[7,5,8]),fov:45,near:.1,far:1000}} onCreated={({gl})=>{gl.domElement.addEventListener('webglcontextlost',()=>setContextError(true),{once:true})}} fallback={<p>浏览器不支持 WebGL；请查看下方数值。</p>}>
        <color attach="background" args={[dark?'#292724':'#f4f1ec']}/><ambientLight intensity={1.5}/><directionalLight position={[6,10,6]} intensity={2} castShadow/>
        <gridHelper args={[20,20,dark?'#625d56':'#cfc8bc',dark?'#403d38':'#e5dfd5']} position={[0,-.4,0]}/>
        {objects.map((item,i)=><ObjectView key={item.id||i} item={item} selected={selected} onSelect={onSelect} dark={dark} labels={labels}/>)}
        <OrbitControls ref={controls} makeDefault enableDamping minDistance={1} maxDistance={60}/>
        <CameraFrame objects={objects} direction={vec(camera,[7,5,8])} epoch={viewEpoch} controls={controls}/>
      </Canvas></Suspense>}
      <div className="scene-hint">拖动旋转 · 滚轮缩放 · 点击选择</div>
      {focused&&<div className="scene-inspector"><strong>{focused.id}</strong><span>{focused.label||focused.text}</span><code>{JSON.stringify(focused.position)}{focused.value!==undefined?' · '+String(focused.value):''}</code></div>}
    </div>
    {caption&&<figcaption>{caption}</figcaption>}
  </figure>
}
