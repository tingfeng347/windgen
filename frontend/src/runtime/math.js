// Trusted, bounded numeric primitives exposed only inside the calculation Worker.
const teachingMath = (() => {
  const vector = (v, infinity = false) => {
    if (!Array.isArray(v) || !v.length || v.length > 64 || v.some(x => typeof x !== 'number' || (!Number.isFinite(x) && !(infinity && x === -Infinity)))) throw Error('向量必须包含 1–64 个有效数值');
    return v;
  };
  const matrix = m => {
    if (!Array.isArray(m) || !m.length || m.length > 64) throw Error('矩阵必须包含 1–64 行');
    m.forEach(r => { vector(r); if (r.length !== m[0].length) throw Error('矩阵每行长度必须相同'); });
    return m;
  };
  const matmul = (a,b) => {
    matrix(a); matrix(b);
    if (a[0].length !== b.length) throw Error(`矩阵乘法维度不匹配：${a.length}×${a[0].length} 与 ${b.length}×${b[0].length}`);
    return a.map(row => b[0].map((_,j) => row.reduce((sum,v,k) => sum+v*b[k][j],0)));
  };
  const transpose = m => { matrix(m); return m[0].map((_,j)=>m.map(row=>row[j])); };
  const add = (a,b) => { matrix(a); matrix(b); if(a.length!==b.length||a[0].length!==b[0].length)throw Error('相加矩阵的形状必须相同');return a.map((r,i)=>r.map((v,j)=>v+b[i][j])); };
  const softmax = (row,temperature=1,mask=[]) => {
    vector(row,true); if(!Number.isFinite(temperature)||temperature<=0)throw Error('softmax 温度必须大于 0');
    if(mask.length&&mask.length!==row.length)throw Error('掩码长度必须与向量一致');
    const values=row.map((v,i)=>mask[i]?-Infinity:v),max=Math.max(...values);
    if(!Number.isFinite(max))throw Error('至少需要一个未掩码的位置');
    const exp=values.map(v=>v===-Infinity?0:Math.exp((v-max)/temperature)),sum=exp.reduce((a,b)=>a+b,0);
    return exp.map(v=>v/sum);
  };
  const layerNorm = (m,epsilon=1e-5) => { matrix(m); if(!Number.isFinite(epsilon)||epsilon<=0)throw Error('epsilon 必须大于 0');return m.map(row=>{const mean=row.reduce((a,b)=>a+b,0)/row.length,variance=row.reduce((a,b)=>a+(b-mean)**2,0)/row.length;return row.map(v=>(v-mean)/Math.sqrt(variance+epsilon));}); };
  const splitHeads = (m,count) => { matrix(m);if(!Number.isInteger(count)||count<1||count>16||m[0].length%count)throw Error('维度必须能被注意力头数整除');const width=m[0].length/count;return Array.from({length:count},(_,h)=>m.map(row=>row.slice(h*width,(h+1)*width))); };
  const concatHeads = heads => { if(!Array.isArray(heads)||!heads.length||heads.length>16)throw Error('注意力头数必须为 1–16');heads.forEach(matrix);if(heads.some(h=>h.length!==heads[0].length))throw Error('各头的 token 数必须相同');const result=heads[0].map((_,i)=>heads.flatMap(h=>h[i]));return matrix(result); };
  return Object.freeze({matmul,transpose,add,softmax,layerNorm,splitHeads,concatHeads});
})();
