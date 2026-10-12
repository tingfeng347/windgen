import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // Keep stream regression tests out of the user's local history.
  await page.route('**/api/conversations**', route => route.fulfill({
    json: route.request().method() === 'POST'
      ? { id: 'streaming-conversation', title: '新教程', updated: 0, revisions: [] }
      : route.request().method() === 'PUT' ? { ok: true } : [],
  }))
})

test('renders incoming lesson content before the model stream finishes', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      if (typeof input !== 'string' || !input.endsWith('/generate')) return original(input, init)
      const encoder = new TextEncoder()
      const source = '## 渐进生成测试\n\n<box><title>教程已经开始</title><text>' + '计算步骤正在展开。'.repeat(300) + '</text></box>'
      const body = new ReadableStream({
        start(controller) {
          const send = (kind: string, data: unknown) => controller.enqueue(encoder.encode(`event: ${kind}\ndata: ${JSON.stringify(data)}\n\n`))
          send('start', { id: 'streaming-test', state: {}, mode: 'live' })
          let offset = 0
          const timer = setInterval(() => {
            send('source', { value: source.slice(offset, offset + 16) })
            offset += 16
            if (offset >= source.length) {
              clearInterval(timer)
              send('done', { id: 'streaming-test', status: 'complete' })
              controller.close()
            }
          }, 20)
        },
      })
      return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })
    }
  })
  await page.route('**/revisions/streaming-test/state', route => route.fulfill({ json: { ok: true } }))
  await page.goto('/')
  await page.getByRole('textbox', { name: '输入教程需求' }).fill('给我逐步展示教程')
  await page.getByRole('button', { name: '发送', exact: true }).click()
  await expect(page.locator('.lesson-body')).toContainText('渐进生成测试', { timeout: 1500 })
  await expect(page.getByRole('button', { name: '停止生成' })).toBeVisible()
  await expect(page.getByRole('button', { name: '停止生成' })).not.toBeVisible({ timeout: 10000 })
  await expect(page.locator('.lesson-body')).toContainText('教程已经开始')
})

test('an empty failed generation does not leave a permanent loading indicator', async ({ page }) => {
  await page.route('**/generate', route => route.fulfill({
    contentType: 'text/event-stream',
    body: 'event: start\ndata: {"id":"empty-failure","state":{},"mode":"live"}\n\nevent: error\ndata: {"message":"模型没有返回教程内容"}\n\n',
  }))
  await page.goto('/')
  await page.getByRole('textbox', { name: '输入教程需求' }).fill('解释算法')
  await page.getByRole('button', { name: '发送', exact: true }).click()
  await expect(page.locator('.composer-area [role="alert"]')).toContainText('模型没有返回教程内容')
  await expect(page.locator('.lesson-pending')).toContainText('本次未生成教程内容')
  await expect(page.locator('.loading-dot')).toHaveCount(0)
})

test('a failed streamed program keeps the last successful preview', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      if (typeof input !== 'string' || !input.endsWith('/generate')) return original(input, init)
      const encoder = new TextEncoder()
      return new Response(new ReadableStream({ start(controller) {
        const send = (kind: string, data: unknown) => controller.enqueue(encoder.encode(`event: ${kind}\ndata: ${JSON.stringify(data)}\n\n`))
        send('start', { id: 'partial-error', state: {}, mode: 'live' })
        send('source', { value: '## 已显示的教程\n\n' })
        setTimeout(() => send('source', { value: '{@body if(true){throw Error("未完成代码")}}' }), 700)
        setTimeout(() => {
          send('done', { id: 'partial-error', status: 'complete' })
          controller.close()
        }, 1700)
      } }), { headers: { 'Content-Type': 'text/event-stream' } })
    }
  })
  await page.goto('/')
  await page.getByRole('textbox', { name: '输入教程需求' }).fill('逐步生成')
  await page.getByRole('button', { name: '发送', exact: true }).click()
  await expect(page.locator('.lesson-body')).toContainText('已显示的教程', { timeout: 1500 })
  await expect(page.locator('.lesson [role="alert"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '停止生成' })).not.toBeVisible()
  await expect(page.locator('.lesson [role="alert"]')).toContainText('这次演示暂时无法完成',{timeout:10000})
  await expect(page.locator('.lesson-body')).toContainText('已显示的教程')
})

test('split state metadata stays hidden and is applied once before interactive state updates',async({page})=>{
 await page.addInitScript(()=>{
  const original=window.fetch.bind(window)
  window.fetch=async(input,init)=>{
   if(typeof input!=='string'||!input.endsWith('/generate'))return original(input,init)
   const encoder=new TextEncoder()
   return new Response(new ReadableStream({start(controller){
    const send=(kind:string,data:unknown)=>controller.enqueue(encoder.encode(`event: ${kind}\ndata: ${JSON.stringify(data)}\n\n`))
    send('start',{id:'metadata-stream',state:{step:5},mode:'live'})
    send('source',{value:'<!-- windgen-state'})
    setTimeout(()=>send('source',{value:': {"set":{"step":0}} -->\n'}),600)
    setTimeout(()=>send('source',{value:'{@body const [step,setStep]=DIL.useState(0)}\n<box><title>状态流测试</title><stepper value={step} onChange={setStep} max={6}/></box>'}),900)
    setTimeout(()=>{send('done',{id:'metadata-stream',status:'complete'});controller.close()},1500)
   }}),{headers:{'Content-Type':'text/event-stream'}})
  }
 })
 await page.goto('/')
 await page.getByRole('textbox',{name:'输入教程需求'}).fill('继续修改')
 await page.getByRole('button',{name:'发送',exact:true}).click()
 await expect(page.getByRole('button',{name:'停止生成'})).toBeVisible()
 await expect(page.locator('.lesson-body')).not.toContainText('windgen-state')
 await expect(page.getByTestId('step-value')).toHaveText('0 / 6')
 await expect(page.getByRole('button',{name:'停止生成'})).not.toBeVisible()
 await page.getByRole('button',{name:'单步',exact:true}).click()
 await expect(page.getByTestId('step-value')).toHaveText('1 / 6')
 await expect(page.locator('.lesson-body')).not.toContainText('windgen-state')
})

 test('shows the received introduction while incomplete computation cannot execute',async({page})=>{
 await page.addInitScript(()=>{
 const original=window.fetch.bind(window)
 window.fetch=async(input,init)=>{
 if(typeof input!=='string'||!input.endsWith('/generate'))return original(input,init)
 const encoder=new TextEncoder()
 return new Response(new ReadableStream({start(controller){
 const send=(kind:string,data:unknown)=>controller.enqueue(encoder.encode(`event: ${kind}\ndata: ${JSON.stringify(data)}\n\n`))
 send('start',{id:'partial',state:{},mode:'live'})
 send('source',{value:'# 注意力计算\n先观察 Query 与 Key 的关系。\n{@body const scores = keys.map(k=>k)}'})
 setTimeout(()=>{send('done',{status:'complete'});controller.close()},5000)
 }}),{headers:{'Content-Type':'text/event-stream'}})
 }
 })
 await page.goto('/')
 await page.getByRole('textbox',{name:'输入教程需求'}).fill('演示注意力')
 await page.getByRole('button',{name:'发送',exact:true}).click()
 await expect(page.locator('.lesson-body')).toContainText('先观察 Query 与 Key 的关系。',{timeout:1500})
 await expect(page.getByRole('button',{name:'停止生成',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'停止生成',exact:true}).click()
 })

test('acknowledges the submitted request before intent classification returns',async({page})=>{
 await page.route('**/generate',async route=>{
  await new Promise(resolve=>setTimeout(resolve,1800))
  await route.fulfill({contentType:'text/event-stream',body:'event: start\ndata: {"id":"slow-intent","kind":"chat","state":{},"mode":"live"}\n\nevent: source\ndata: {"value":"你好"}\n\nevent: done\ndata: {"status":"complete"}\n\n'})
 })
 await page.goto('/')
 await page.getByRole('textbox',{name:'输入教程需求'}).fill('先和我聊一聊')
 await page.getByRole('button',{name:'发送',exact:true}).click()
 await expect(page.locator('.user-message')).toHaveText('先和我聊一聊',{timeout:500})
 await expect(page.getByRole('status')).toContainText('正在生成',{timeout:500})
 await expect(page.locator('.chat-reply')).toHaveText('你好')
})
