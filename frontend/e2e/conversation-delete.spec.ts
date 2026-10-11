import { test, expect, type Page } from '@playwright/test'

async function mockHistory(page:Page,{failFirst=false,lateState=false}={}){
  let items=[{id:'first',title:'梯度下降教程',updated:2,revisions:[{id:'first-revision',prompt:'梯度下降教程',source:'<text>当前会话的内容</text>',state:{step:2},status:'complete',mode:'demo',created:1}]},{id:'second',title:'K-means 教程',updated:1,revisions:[]}]
  const deleted:string[]=[]
  let failed=false
  let release=()=>{}
  const gate=new Promise<void>(resolve=>{release=resolve})
  await page.route('**/api/conversations**',async route=>{
    const path=new URL(route.request().url()).pathname,method=route.request().method()
    if(method==='DELETE'){
      if(failFirst&&!failed){failed=true;await route.fulfill({status:500,json:{detail:'删除失败，请重试'}});return}
      if(path==='/api/conversations'){deleted.push('all');items=[]}
      else{const id=path.split('/').at(-1)!;deleted.push(id);items=items.filter(c=>c.id!==id)}
      await route.fulfill({json:{deleted:1}});return
    }
    if(method==='PUT'){
      if(lateState){await gate;const exists=items.some(c=>c.id===path.split('/')[3]);await route.fulfill(exists?{json:{ok:true}}:{status:404,json:{detail:'版本不存在'}})}
      else await route.fulfill({json:{ok:true}})
      return
    }
    if(path==='/api/conversations'){await route.fulfill({json:items});return}
    const c=items.find(c=>c.id===path.split('/').at(-1))
    await route.fulfill(c?{json:c}:{status:404,json:{detail:'会话不存在'}})
  })
  return {deleted,release}
}

test('single deletion confirms, preserves other conversations, and clears a deleted current view',async({page})=>{
  const {deleted,release}=await mockHistory(page,{lateState:true})
  await page.goto('/')
  const first=page.getByTestId('conversation-first'),second=page.getByTestId('conversation-second')
  await expect(first).toBeVisible()
  const uploadStarted=page.waitForRequest(request=>request.method()==='PUT'&&request.url().includes('/first-revision/state'))
  await first.getByRole('button',{name:'梯度下降教程',exact:true}).click()
  await expect(page.getByText('当前会话的内容',{exact:true})).toBeVisible()
  await uploadStarted
  await second.hover()
  await second.getByRole('button',{name:'删除会话：K-means 教程'}).click()
  const dialog=page.getByRole('alertdialog',{name:'删除这条会话？'})
  await expect(dialog).toBeVisible()
  await page.getByRole('button',{name:'取消',exact:true}).click()
  expect(deleted).toEqual([])
  await expect(second).toBeVisible()
  await second.getByRole('button',{name:'删除会话：K-means 教程'}).click()
  await page.getByRole('button',{name:'删除会话',exact:true}).click()
  await expect(second).not.toBeVisible()
  await expect(page.getByText('当前会话的内容',{exact:true})).toBeVisible()
  await first.hover()
  await first.getByRole('button',{name:'删除会话：梯度下降教程'}).click()
  await page.screenshot({path:'test-results/delete-desktop.png',fullPage:true,animations:'disabled'})
  await page.getByRole('button',{name:'删除会话',exact:true}).click()
  await expect(first).not.toBeVisible()
  await expect(page.getByRole('heading',{name:'让算法成为 可以探索的课堂。'})).toBeVisible()
  await expect(page.locator('aside [data-new-conversation]')).toBeFocused()
  await expect(page.getByText('暂无会话',{exact:true})).toBeVisible()
  const lateReply=page.waitForResponse(response=>response.status()===404&&response.url().includes('/first-revision/state'))
  release()
  await (await lateReply).finished()
  await expect(page.locator('.composer-area [role="alert"]')).toHaveCount(0)
  expect(deleted).toEqual(['second','first'])
})

test('mobile delete all cancels safely, reports failures, then clears history on retry',async({page})=>{
  await page.setViewportSize({width:390,height:844})
  const {deleted}=await mockHistory(page,{failFirst:true})
  await page.goto('/')
  await page.getByRole('button',{name:'打开会话栏'}).click()
  await expect(page.getByTestId('conversation-first')).toBeVisible()
  await page.getByRole('button',{name:'删除全部会话',exact:true}).click()
  const dialog=page.getByRole('alertdialog',{name:'删除全部会话？'})
  await expect(dialog).toContainText('全部 2 条会话')
  await page.screenshot({path:'test-results/delete-mobile.png',fullPage:true,animations:'disabled'})
  await page.getByRole('button',{name:'取消',exact:true}).click()
  expect(deleted).toEqual([])
  await expect(page.getByTestId('conversation-first')).toBeVisible()
  await page.getByRole('button',{name:'删除全部会话',exact:true}).click()
  await page.getByRole('button',{name:'删除全部',exact:true}).click()
  await expect(dialog.getByRole('alert')).toContainText('删除失败')
  await expect(page.getByTestId('conversation-first')).toBeVisible()
  await page.getByRole('button',{name:'删除全部',exact:true}).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('button',{name:'打开会话栏'})).toBeFocused()
  await page.getByRole('button',{name:'打开会话栏'}).click()
  await expect(page.getByText('暂无会话',{exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:'删除全部会话',exact:true})).toBeDisabled()
  expect(deleted).toEqual(['all'])
})
