const fs = require('fs');
const c = fs.readFileSync('_head_ve_current.js', 'utf8');
const l = c.split('\n');
let d = 0;
for(let i = 10; i <= 30; i++) {
  const ts = l[i-1].trim();
  const o = (ts.match(/\{/g) || []).length;
  const cl = (ts.match(/}/g) || []).length;
  const prev = d; d += o - cl;
  const sp = (l[i-1].match(/^[ \t]*/) || [''])[0].length;
  console.log('L' + i, 'dB:'+prev+'->'+d, 'SP:'+sp, ts.substring(0,55));
}
