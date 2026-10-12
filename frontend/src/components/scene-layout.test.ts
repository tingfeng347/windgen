import {it,expect} from 'vitest'
import {Vector3,PerspectiveCamera} from 'three'
import {sceneBounds,sceneFrame,visibleSceneLabels} from './scene-layout'
it('fits a generated top-layer tensor at y=11 on a narrow viewport without inactive label bias',()=>{
 const objects=Array.from({length:24},(_,i)=>({id:String(i),type:'box',position:[(i%6-2.5)*1.4,11.5,(Math.floor(i/6)-1.5)*1.4] as [number,number,number],size:[1,1,1] as [number,number,number],label:String(i)}))
 const bounds=sceneBounds([...objects,{type:'label',position:[0,100,0],text:'inactive'}])
 expect(bounds.getCenter(new Vector3()).y).toBe(11.5)
 const frame=sceneFrame(bounds,390/350,[9,10,11]),camera=new PerspectiveCamera(45,390/350,.1,1000)
 camera.position.copy(frame.position);camera.lookAt(frame.target);camera.updateMatrixWorld()
 for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){const p=new Vector3(x,y,z).project(camera);expect(Math.abs(p.x)).toBeLessThan(1);expect(Math.abs(p.y)).toBeLessThan(1)}
 expect([...visibleSceneLabels(objects,'10')]).toEqual(['10'])
})
it('includes nested transformed geometry in camera bounds',()=>{
 const bounds=sceneBounds([{type:'group',position:[3,8,0],scale:[2,2,2],children:[{type:'box',position:[1,0,0],size:[2,2,2]}]}])
 expect(bounds.min.toArray()).toEqual([3,6,-2]);expect(bounds.max.toArray()).toEqual([7,10,2])
})
