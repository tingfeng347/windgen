import { expect, it } from 'vitest'
import { compile } from './vendor/index.js'
import { validateTree } from '../runtime/client'

it('accepts list and list-item nodes emitted by Markdown lowering', () => {
  const node = validateTree({t:'list',c:[{t:'list-item',c:[{t:'#text',v:'冻结权重'}]}]})
  expect(node?.t).toBe('list')
  expect(node?.c?.[0].t).toBe('list-item')
})
it('keeps LaTeX braces in inline math out of JavaScript expressions', () => {
  const result = compile('维度 $d_{\\text{model}}=4$，权重 $W_Q$。')
  expect(result.diagnostics).toEqual([])
  expect(result.code).toContain('"math"')
})
it('does not leak unmatched closing tags into the tutorial text', () => {
  const result = compile('<box><text>教程</text></box>\n</box>')
  expect(Object.values(result.constants).join('')).not.toContain('</box>')
})
it('hides complete and streamed state metadata comments from lesson prose',()=>{
  for(const comment of ['<!-- windgen-state','<!-- windgen-state: {"set":{"step":0}}','<!-- windgen-state: {"set":{"step":0}} -->']){
    const result=compile('## 已显示\n'+comment)
    expect(Object.values(result.constants).join('')).not.toContain('windgen-state')
  }
})
