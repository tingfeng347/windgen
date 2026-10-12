import {expect,test} from 'vitest'
import {lessonSource} from './lesson-source'
test('removes legacy diagnostic introductions while preserving the lesson and computation',()=>{
 const source='# 注意力\n\n修复说明：之前引用了 `t`。\n现已更新。\n\n计算 QK。\n{@body const note="修复说明：保留数据"}\n<text>{note}</text>'
 expect(lessonSource(source)).toBe('# 注意力\n\n计算 QK。\n{@body const note="修复说明：保留数据"}\n<text>{note}</text>')
 expect(lessonSource('# 牛顿法\n\n误差修正用于优化。')).toContain('误差修正')
})
