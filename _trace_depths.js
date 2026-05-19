const fs = require('fs');
const c = fs.readFileSync('_head_ve_current.js', 'utf8').replace(/\r?\n/g, '\n');
const l = c.split('\n');

// Depth-tracker step by step
let d = 0;
for (let i = 0; i < 80; i++) {
  const ts = l[i].trim();
  const o = (ts.match(/\{/g) || []).length;
  const cl = (ts.match(/}/g) || []).length;
  const prev = d; d += o - cl;
  if (ts) console.log('L' + (i + 1), 'dB:' + prev + '->' + d, ts.substring(0, 60));
}
console.log('\n--- TRANSITIONS 12-82 ---');
for(let i=11; i<82; i++){
  const ts = l[i].trim();
  const o=(ts.match(/\{/g)||[]).length, cl=(ts.match(/}/g)||[]).length;
  const prev=d; d+=o-cl;
  if(o>0 || cl>0 || ts==='}') console.log('L'+(i+1), 'dB:'+prev+'->'+d, ts.substring(0,50));
}
