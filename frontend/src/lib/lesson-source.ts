// Only inspect introductory Markdown, never computational statements.
export function lessonSource(source:string):string {
  const boundary=source.indexOf('{@body')
  const intro=boundary<0?source:source.slice(0,boundary)
  const cleaned=intro.replace(/^(?:修复说明|纠错说明|修正说明)[：:][^\n]*(?:\n(?!\s*\n)[^\n]+)*(?:\n\s*\n|$)/gm,'')
  return cleaned+(boundary<0?'':source.slice(boundary))
}
