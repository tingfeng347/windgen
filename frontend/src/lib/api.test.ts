import { afterEach, expect, it, vi } from 'vitest'
import { stream } from './api'

afterEach(() => vi.unstubAllGlobals())

function response(parts: string[]) {
  const encoder = new TextEncoder()
  return new Response(new ReadableStream({ start(controller) {
    for (const part of parts) controller.enqueue(encoder.encode(part))
    controller.close()
  } }))
}

it('delivers fragmented SSE source events before the terminal event', async () => {
  vi.stubGlobal('fetch', async () => response([
    'event: source\r', '\ndata: {"value":"公式"}\r\n\r', '\n',
    'event: done\ndata: {"status":"complete"}\n\n',
  ]))
  const events: unknown[] = []
  await stream('/generate', {}, new AbortController().signal, (type, data) => events.push([type, data]))
  expect(events).toEqual([['source', { value: '公式' }], ['done', { status: 'complete' }]])
})

it('reports a disconnected stream while keeping already delivered content', async () => {
  vi.stubGlobal('fetch', async () => response(['event: source\ndata: {"value":"已生成内容"}\n\n']))
  const events: unknown[] = []
  await expect(stream('/generate', {}, new AbortController().signal, (_, data) => events.push(data))).rejects.toThrow('生成连接中断')
  expect(events).toEqual([{ value: '已生成内容' }])
})
