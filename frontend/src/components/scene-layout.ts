import {Box3,Matrix4,Quaternion,Vector3,Euler} from 'three'
import type {SceneObject} from './Scene'
export function sceneBounds(objects:SceneObject[]):Box3 {
 const bounds=new Box3()
 const visit=(items:SceneObject[],parent:Matrix4)=>{
  for(const item of items){
   if(item.type==='label')continue
   const transform=new Matrix4().compose(new Vector3(...(item.position||[0,0,0])),new Quaternion().setFromEuler(new Euler(...(item.rotation||[0,0,0]))),new Vector3(...(item.scale||[1,1,1])))
   transform.premultiply(parent)
   if(item.type==='group'){visit(item.children||[],transform);continue}
   if(item.points?.length||item.vertices?.length){for(const point of item.points||item.vertices||[])bounds.expandByPoint(new Vector3(...point).applyMatrix4(transform));continue}
   const size=item.size||[.25,.25,.25]
   const extent=item.type==='sphere'||item.type==='point'?[size[0],size[0],size[0]]:size.map(v=>Math.abs(v)/2)
   for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])bounds.expandByPoint(new Vector3(x*extent[0],y*extent[1],z*extent[2]).applyMatrix4(transform))
  }
 }
 visit(objects,new Matrix4())
 if(bounds.isEmpty())bounds.set(new Vector3(-1,-1,-1),new Vector3(1,1,1))
 return bounds
}
export function sceneFrame(bounds:Box3,aspect:number,direction:number[]=[7,5,8]){
 const target=bounds.getCenter(new Vector3())
 const radius=Math.max(.5,bounds.getSize(new Vector3()).length()/2)
 const halfFov=Math.min(Math.PI/8,Math.atan(Math.tan(Math.PI/8)*Math.max(.1,aspect)))
 const distance=radius/Math.sin(halfFov)*1.25
 const offset=new Vector3(...direction as [number,number,number]);if(offset.lengthSq()<.01)offset.set(7,5,8)
 const position=offset.normalize().multiplyScalar(distance).add(target)
 return {target,position,distance}
}
export function visibleSceneLabels(objects:SceneObject[],selected:string){
 const ids=new Set<string>(),budget=12
 const visit=(items:SceneObject[])=>{for(const item of items){if((item.label||item.text)&&item.id===selected)ids.add(item.id);visit(item.children||[])}}
 visit(objects)
 const add=(items:SceneObject[])=>{for(const item of items){if(ids.size<budget&&(item.label||item.text)&&item.id)ids.add(item.id);add(item.children||[])}}
 // Dense numeric geometry uses a selection inspector; labels are reserved for sparse objects.
 const count=(items:SceneObject[]):number=>items.reduce((n,item)=>n+(item.type==='group'?count(item.children||[]):item.type==='label'?0:1),0)
 if(count(objects)<=budget)add(objects)
 return ids
}
