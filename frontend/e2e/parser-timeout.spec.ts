import {test,expect} from '@playwright/test'
import {readFileSync} from 'node:fs'
const source=readFileSync('../examples/attention.dil','utf8')
test('production compiler loads and renders the attention lesson without timing out',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
 await page.route('**/api/conversations**',route=>route.fulfill({json:new URL(route.request().url()).pathname==='/api/conversations'?[{id:'parser-test',title:'解析验收',updated:1}]:{id:'parser-test',title:'解析验收',updated:1,revisions:[{id:'parser-test-r',prompt:'注意力',source,state:{},mode:'demo',status:'complete',created:1}]}}))
 await page.goto('http://127.0.0.1:8787/')
 await page.getByRole('button',{name:'解析验收',exact:true}).click()
 await expect(page.getByText('当前 Query',{exact:true})).toBeVisible({timeout:10000})
 await expect(page.getByText('文档解析超时',{exact:false})).toHaveCount(0)
 expect(errors).toEqual([])
})

test('missing compiler asset reports a load failure and offers a page refresh',async({page,context})=>{
 await context.route('**/compiler-worker.js',route=>route.fulfill({status:404,body:'Not Found'}))
 await page.route('**/api/conversations**',route=>route.fulfill({json:new URL(route.request().url()).pathname==='/api/conversations'?[{id:'missing-test',title:'缺失编译器',updated:1}]:{id:'missing-test',title:'缺失编译器',updated:1,revisions:[{id:'missing-r',prompt:'注意力',source,state:{},mode:'demo',status:'complete',created:1}]}}))
 await page.goto('http://127.0.0.1:8787/')
 await page.getByRole('button',{name:'缺失编译器',exact:true}).click()
 await expect(page.getByRole('alert')).toContainText('编译器加载',{timeout:8000})
 await expect(page.getByRole('button',{name:'刷新页面',exact:true})).toBeVisible()
 await expect(page.getByText('文档解析超时',{exact:false})).toHaveCount(0)
})

test('compiler startup delay does not consume the document parsing deadline',async({page,context})=>{
 await context.route('**/compiler-worker.js',async route=>{
   await new Promise(resolve=>setTimeout(resolve,3500))
   await route.continue()
 })
 await page.route('**/api/conversations**',route=>route.fulfill({json:new URL(route.request().url()).pathname==='/api/conversations'?[{id:'slow-test',title:'慢启动编译器',updated:1}]:{id:'slow-test',title:'慢启动编译器',updated:1,revisions:[{id:'slow-r',prompt:'注意力',source,state:{},mode:'demo',status:'complete',created:1}]}}))
 await page.goto('http://127.0.0.1:8787/')
 await page.getByRole('button',{name:'慢启动编译器',exact:true}).click()
 await expect(page.getByText('当前 Query',{exact:true})).toBeVisible({timeout:10000})
 await expect(page.getByRole('alert')).toHaveCount(0)
})

test('an already-open build can load a retired compiler URL',async({page})=>{
 await page.goto('http://127.0.0.1:8787/')
 const result=await page.evaluate(()=>new Promise<string>((resolve,reject)=>{
 const worker=new Worker('/assets/worker-obsolete-build.js',{type:'module'})
 const timeout=setTimeout(()=>{worker.terminate();reject(Error('worker did not start'))},5000)
 worker.onmessage=e=>{if(e.data.kind==='ready'){clearTimeout(timeout);worker.terminate();resolve('ready')}}
 worker.onerror=()=>{clearTimeout(timeout);worker.terminate();reject(Error('worker load failed'))}
 }))
 expect(result).toBe('ready')
})
