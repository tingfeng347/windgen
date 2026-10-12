import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { compile } from './vendor/index.js'
import { stateInstruction } from '../components/Lesson'
import { sceneObjects } from '../components/Scene'
const runner=readFileSync('src/runtime/math.js','utf8')+'\n'+readFileSync('src/runtime/runner.js','utf8')
function runtime(){
  const messages:any[]=[]
  const context=vm.createContext({self:{postMessage:(m:unknown)=>messages.push(m)}})
  new vm.Script(runner).runInContext(context,{timeout:1000})
  let id=0
  return {run(source:string,state={},reset=true){context.self.onmessage({data:{kind:'program',id:++id,compiled:compile(source),state,reset}});const m=messages.at(-1);if(m.kind==='failure')throw Error(m.message);return m},invoke(handler:string,args:unknown[]){const version=messages.at(-1).version;context.self.onmessage({data:{kind:'invoke',id:++id,handler,args,version}});return messages.at(-1)}}
}
const sample=(name:string)=>readFileSync('../examples/'+name+'.dil','utf8')
function find(node:any,type:string):any{if(node?.t===type)return node;for(const c of node?.c||[]){const found=find(c,type);if(found)return found}}
function metrics(tree:any):Record<string,string>{const out:Record<string,string>={};function visit(n:any){if(n?.t==='metric')out[n.p.label]=String(n.p.value);for(const c of n?.c||[])visit(c)}visit(tree);return out}
describe('teaching document compilation and numerical behavior',()=>{
  it('transformer stages have finite matrices and a real 6×4 multihead output',()=>{
    for(let step=0;step<=6;step++){
      const m=runtime().run(sample('transformer'),{step})
      expect(m.warnings).toEqual([])
      expect(m.state.step).toBe(step)
    }
    const m=runtime().run(sample('transformer'),{step:6})
    const final=find(m.tree,'matrix').p.data
    expect(final).toHaveLength(6);expect(final[0]).toHaveLength(8)
    function allMatrices(n:any):any[]{return [...(n.t==='matrix'?[n]:[]),...(n.c||[]).flatMap(allMatrices)]}
    const output=allMatrices(m.tree).find(n=>n.p.label==='最终输出 Y').p.data
    expect(output).toHaveLength(6);expect(output.every((r:any)=>r.length===4&&r.every(Number.isFinite))).toBe(true)
  })
  it('transformer causal weights are zero above the diagonal and sum to one without intermediate rounding',()=>{
    const m=runtime().run(sample('transformer'),{step:3,causal:true,head:1,temperature:.7})
    const weights=find(m.tree,'heatmap').p.data
    weights.forEach((row:number[],i:number)=>{expect(row.reduce((a,b)=>a+b,0)).toBeCloseTo(1,12);row.forEach((v,j)=>{if(j>i)expect(v).toBe(0)})})
    expect(m.warnings).toEqual([])
    const other=runtime().run(sample('transformer'),{step:3,head:0}).tree
    expect(weights).not.toEqual(find(other,'heatmap').p.data)
  })
  it.each(['gradient','kmeans','network','convolution','attention'])('%s compiles and emits a complete scene',name=>{const source=sample(name);expect(compile(source).diagnostics).toEqual([]);const m=runtime().run(source);expect(find(m.tree,'scene').p.objects.length).toBeGreaterThan(0)})
  it('recovers incomplete streamed prefixes without losing named user state',()=>{const source=sample('gradient'),r=runtime();for(let i=70;i<source.length;i+=47)r.run(source.slice(0,i),{learningRate:.2,step:3},i===70);const m=r.run(source,{},false);expect(m.state.learningRate).toBe(.2);expect(m.state.step).toBe(3)})
  it('linear regression uses the independent golden step',()=>{const m=runtime().run(sample('gradient'),{learningRate:.1,step:1});const result=metrics(m.tree);expect(Number(result['斜率 w'])).toBeCloseTo(13/30,5);expect(Number(result['截距 b'])).toBeCloseTo(.3,6)})
  it('3D kmeans updates to the means and decreases objective 16→8',()=>{const r=runtime();expect(metrics(r.run(sample('kmeans')).tree)['平方距离和 J']).toBe('16.000000');expect(metrics(r.run(sample('kmeans'),{step:2}).tree)['平方距离和 J']).toBe('8.000000')})
  it('backpropagation does not update weights until the update stage',()=>{const source=sample('network');const a=runtime().run(source,{step:2});const b=runtime().run(source,{step:4});const rows=find(a.tree,'table').p.rows;expect(rows[0]).toEqual(['w1','0.00000','0.50000']);expect(find(b.tree,'table').p.rows[0][1]).toBe('-0.05000')})
  it('gradient agrees with independently evaluated finite differences',()=>{const p=[0,0,2,0];const loss=([w1,b1,w2,b2]:number[])=>.5*(w2/(1+Math.exp(-(w1+b1)))+b2)**2;const gradients=p.map((_,i)=>{const a=[...p],b=[...p];a[i]+=1e-5;b[i]-=1e-5;return (loss(a)-loss(b))/2e-5});expect(gradients).toEqual(expect.arrayContaining([expect.closeTo(.5,6),expect.closeTo(1,6)]));for(let i=0;i<4;i++)expect(gradients[i]).toBeCloseTo([.5,.5,.5,1][i],6)})
  it('convolution produces correct shape and multiply-add output',()=>{const m=runtime().run(sample('convolution'));expect(metrics(m.tree)['当前输出']).toBe('-5');expect(metrics(m.tree)['输出形状']).toBe('3 × 3');const n=runtime().run(sample('convolution'),{stride:2});expect(metrics(n.tree)['输出形状']).toBe('2 × 2')})
  it('attention weights normalize and match stable softmax',()=>{const m=runtime().run(sample('attention'));const weights=find(m.tree,'table').p.rows.map((r:any)=>Number(r[2]));const exp=Math.exp(1/Math.sqrt(2)),denom=2*exp+1;expect(weights[0]).toBeCloseTo(exp/denom,3);expect(weights[1]).toBeCloseTo(1/denom,3);expect(metrics(m.tree)['权重和']).toBe('1.000000')})
  it('explicit parameter instructions reset progress but keep other state',()=>{expect(stateInstruction('<!-- windgen-state: {"set":{"learningRate":0.1},"reset":["step"]} -->\n<box/>',{step:7,learningRate:.3,selected:'a'})).toEqual({learningRate:.1,selected:'a'})})
  it('rejects unbounded or invalid scene geometry',()=>{expect(()=>sceneObjects(Array.from({length:601},()=>({type:'sphere'})))).toThrow();expect(()=>sceneObjects([{type:'mesh',vertices:[[0,0,0]],indices:[9]}])).toThrow()})
})
describe('actual generated tensor regression',()=>{
 const source=readFileSync('test-fixtures/transformer-scene-repaired.dil','utf8')
 it('renders all seven stages without warnings, normalizes masks and computes expanded FFN',()=>{
   for(let step=0;step<=6;step++)expect(runtime().run(source,{step}).warnings).toEqual([])
   const attention=runtime().run(source,{step:3,head:1,causal:true,temperature:.7})
   find(attention.tree,'heatmap').p.data.forEach((row:number[],i:number)=>{expect(row.reduce((a,b)=>a+b,0)).toBeCloseTo(1,12);row.forEach((v,j)=>{if(j>i)expect(v).toBe(0)})})
   const output=runtime().run(source,{step:6});expect(find(output.tree,'matrix').p.data[0]).toHaveLength(8)
   const scene=find(output.tree,'scene').p.objects;expect(scene.filter((o:any)=>o.type==='box')).toHaveLength(24);expect(scene.filter((o:any)=>o.type==='box').every((o:any)=>Number.isFinite(o.value))).toBe(true)
   const qkv=find(runtime().run(source,{step:1}).tree,'scene').p.objects.filter((o:any)=>o.type==='box')
   expect(new Set(qkv.map((o:any)=>o.position[1])).size).toBe(3)
   expect(Object.values(compile(source).constants).join('')).not.toContain('windgen-state')
 })
})
