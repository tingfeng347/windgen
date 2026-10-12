import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
const transformer=readFileSync('../examples/transformer.dil','utf8')
const broken=readFileSync('test-fixtures/transformer-broken.dil','utf8')
async function openLesson(page:Page,source:string){
  const conversation={id:'intelligent-test',title:'Transformer 测试',updated:1,revisions:[{id:'original-test',prompt:'演示 Transformer',source,state:{},status:'complete',mode:'live',created:1}]}
  await page.route('**/api/conversations**',route=>{
    const path=new URL(route.request().url()).pathname
    if(path.endsWith('/generate'))return route.fallback()
    return route.fulfill({json:route.request().method()==='PUT'?{ok:true}:path==='/api/conversations'?[conversation]:conversation})
  })
  await page.goto('/')
  await page.getByRole('button',{name:'Transformer 测试',exact:true}).click()
}
test('generated Transformer has selectable matrices, heatmaps, typed controls and actual stages',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await openLesson(page,transformer)
  await expect(page.getByText('词向量 E',{exact:true})).toBeVisible()
  await expect(page.locator('.lesson-issues')).toHaveCount(0)
  await page.getByLabel('注意力头',{exact:true}).selectOption('1')
  for(let i=1;i<=3;i++){await page.getByRole('button',{name:'单步',exact:true}).click();await expect(page.getByTestId('step-value')).toHaveText(`${i} / 6`)}
  await expect(page.getByText('词向量 E',{exact:true})).toHaveCount(0)
  await expect(page.locator('.teaching-heatmap button')).toHaveCount(36)
  await expect(page.locator('.token-graph svg')).toBeVisible()
  await page.getByLabel('注意力掩码',{exact:true}).selectOption('true')
  await expect(page.getByRole('button',{name:'注意力权重 A 我 → 处理: 0',exact:true})).toBeVisible()
  await page.locator('.token-graph').getByRole('button',{name:'语言',exact:true}).click()
  await expect(page.locator('.token-graph svg')).toHaveAttribute('aria-label','Token 语言 的注意力连接')
  await page.getByRole('tab',{name:'状态',exact:true}).click()
  await expect(page.locator('.source-view')).toContainText('"token": 4')
  const state=JSON.parse(await page.locator('.source-view').innerText())
  expect(state.head).toBe(1);expect(state.causal).toBe(true)
  await page.getByRole('tab',{name:'交互教程',exact:true}).click()
  await page.addStyleTag({content:'*,*::before,*::after{transition:none!important;animation:none!important;scroll-behavior:auto!important}'})
  await page.locator('.conversation-scroll').evaluate(el=>{el.scrollTop=0;el.scrollLeft=0})
  await page.screenshot({path:'../.impeccable/review/intelligent-ui/desktop.png',fullPage:true})
  await page.locator('.token-graph').scrollIntoViewIfNeeded()
  await page.screenshot({path:'../.impeccable/review/intelligent-ui/desktop-graph.png',fullPage:true})
  await page.setViewportSize({width:567,height:987})
  await page.locator('.conversation-scroll').evaluate(el=>{el.scrollTop=0;el.scrollLeft=0})
  await page.screenshot({path:'../.impeccable/review/intelligent-ui/user-567.png',fullPage:true})
  await page.setViewportSize({width:390,height:844})
  await page.locator('.conversation-scroll').evaluate(el=>{el.scrollTop=0;el.scrollLeft=0})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  const outer=await page.locator('.conversation-scroll').evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth}))
  expect(outer.scrollWidth).toBeLessThanOrEqual(outer.width)
  await page.screenshot({path:'../.impeccable/review/intelligent-ui/mobile.png',fullPage:true})
  await page.locator('.token-graph').scrollIntoViewIfNeeded()
  await page.screenshot({path:'../.impeccable/review/intelligent-ui/mobile-graph.png',fullPage:true})
  for(let i=4;i<=6;i++){await page.getByRole('button',{name:'单步',exact:true}).click();await expect(page.getByTestId('step-value')).toHaveText(`${i} / 6`)}
  await expect(page.getByText('最终输出 Y',{exact:true})).toBeVisible()
  await expect(page.locator('.lesson-issues')).toHaveCount(0)
  expect(errors).toEqual([])
})
test('silently repairs the real failed lesson while preserving its user request and state',async({page})=>{
  let request:any
  await page.route('**/generate',async route=>{
    request=route.request().postDataJSON()
    await route.fulfill({contentType:'text/event-stream',body:`event: start\ndata: ${JSON.stringify({id:'original-test',state:request.state,mode:'live'})}\n\nevent: source\ndata: ${JSON.stringify({value:transformer})}\n\nevent: done\ndata: {"id":"repair-test","status":"complete"}\n\n`})
  })
  await openLesson(page,broken)
  await expect(page.getByText('词向量 E',{exact:true})).toBeVisible()
  await expect(page.locator('.lesson-issues')).toHaveCount(0)
  expect(request.revision_id).toBe('original-test')
  expect(request.prompt).toBe('演示 Transformer')
  expect(request.repair_issues.length).toBeGreaterThan(0)
  await expect(page.getByRole('button',{name:'修复演示',exact:true})).toHaveCount(0)
})
