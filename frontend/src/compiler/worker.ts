import { lessonSource } from '../lib/lesson-source'
import { compile } from './vendor/index.js'
import type { Compiled } from '../types'
self.postMessage({kind:'ready'})
self.onmessage = (event: MessageEvent<{id:number;source:string}>) => {
  const {id,source} = event.data
  try {
    if (source.length > 150000) throw Error('教程源码超过限制')
    const result = compile(lessonSource(source).replace(/^<!-- windgen-state:.*?-->\s*/s, '')) as unknown as Compiled
    self.postMessage({id,result})
  } catch { self.postMessage({id,error:'文档无法编译，请缩小演示范围'}) }
}
