// Syntax parsing only; this module never evaluates model-authored JavaScript.
import { parse } from 'acorn';
const cache = new Map();
function parses(source) {
  if (cache.has(source)) return cache.get(source);
  let ok = true;
  try { parse(`(function(){${source}\n})`, {ecmaVersion: 'latest'}); } catch { ok = false; }
  if (cache.size >= 4000) cache.clear();
  cache.set(source, ok);
  return ok;
}
export function isExpression(code) { return parses(`return (${code}\n);`); }
export function isStatement(code) { return parses(`${code}\n;`); }
export function isProgram(code) { return parses(code); }
