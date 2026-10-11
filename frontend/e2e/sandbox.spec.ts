import {test,expect} from '@playwright/test'
test('real browser worker has no DOM, network is blocked, loops are terminated',async({page})=>{
  await page.goto('/')
  const result=await page.evaluate(async()=>{
    // Import the actual development module; this is an independent browser boundary test.
    // @ts-expect-error Vite resolves the URL at browser runtime.
    const {Sandbox}=await import('/src/runtime/client.ts')
    let snapshot:any, error=''
    const sandbox=new Sandbox((v:any)=>snapshot=v,(e:string)=>error=e)
    const compiled=(code:string)=>({code,constants:{},appData:{},source:'',stateKeys:[],diagnostics:[],fallbackMarkdown:''})
    await sandbox.program(compiled('DIL.render(__dil.jsx("text",null,typeof document+"|"+typeof window));'),{},true)
    const authority=snapshot.tree.c[0].v
    await sandbox.program(compiled('const [blocked,setBlocked]=DIL.useState("pending",{key:"blocked"});if(blocked==="pending")fetch("https://example.com/windgen-sandbox-test").then(()=>setBlocked("allowed"),()=>setBlocked("blocked"));DIL.render(__dil.jsx("text",null,blocked));'),{},true)
    await new Promise(r=>setTimeout(r,200))
    await sandbox.program(compiled('const [blocked]=DIL.useState("pending",{key:"blocked"});DIL.render(__dil.jsx("text",null,blocked));'),{},false)
    const network=snapshot.tree.c[0].v
    const start=performance.now()
    try{await sandbox.program(compiled('while(true){}'),{},true)}catch{}
    const duration=performance.now()-start
    sandbox.dispose()
    return {authority,network,duration,error}
  })
  expect(result.authority).toBe('undefined|undefined')
  expect(result.network).toBe('blocked')
  expect(result.error).toContain('超时')
  expect(result.duration).toBeLessThan(3500)
  await expect(page.getByRole('textbox',{name:'输入教程需求'})).toBeEnabled()
})
