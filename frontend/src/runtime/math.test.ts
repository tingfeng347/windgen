import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { matrixData } from '../components/TeachingVisuals'
const context=vm.createContext({})
new vm.Script(readFileSync('src/runtime/math.js','utf8')+';globalThis.math=teachingMath;').runInContext(context)
const math=context.math
it('checks matrix dimensions and independent numerical results',()=>{
  expect(math.matmul([[1,2],[3,4]],[[5],[6]])).toEqual([[17],[39]])
  expect(()=>math.matmul([[1,2,3]],[[1],[2]])).toThrow('维度不匹配')
  expect(()=>math.splitHeads([[1,2,3]],2)).toThrow('整除')
  expect(math.concatHeads(math.splitHeads([[1,2,3,4],[5,6,7,8]],2))).toEqual([[1,2,3,4],[5,6,7,8]])
})
it('stable softmax masks exactly and preserves precision',()=>{
  const row=math.softmax([1000,1001,1002],1,[false,false,true])
  expect(row[0]).toBeCloseTo(1/(1+Math.E),12);expect(row[2]).toBe(0)
  expect(row.reduce((a:number,b:number)=>a+b,0)).toBeCloseTo(1,14)
  expect(()=>math.softmax([1,2],1,[true,true])).toThrow('未掩码')
})
it('normalizes each token across its feature axis',()=>{
  const rows=math.layerNorm([[1,2,3,4],[9,9,9,9]])
  expect(rows[0].reduce((a:number,b:number)=>a+b,0)).toBeCloseTo(0,12)
  expect(rows[1]).toEqual([0,0,0,0])
})
it('bounds matrix rendering and rejects ragged data',()=>{
  expect(()=>matrixData([[1],[2,3]])).toThrow('行宽')
  expect(()=>matrixData(Array.from({length:33},()=>[1]))).toThrow('32 行')
  expect(matrixData([[NaN,1]])).toEqual([[null,1]])
})
