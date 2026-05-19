const fs = require('fs');
const c = fs.readFileSync('_fde2b0e_ve.js', 'utf8').replace(/\r?\n/g, '\n');
const l = c.split('\n');
// print lines 440-475 (addVoxel open context)
for (let i = 438; i < 480; i++) {
  console.log(String(i + 1).padStart(3), JSON.stringify((l[i] || '').trim().substring(0, 60)));
}
console.log('---');
// print 485-535
for (let i = 484; i < 540; i++) {
  console.log(String(i + 1).padStart(3), JSON.stringify((l[i] || '').trim().substring(0, 70)));
}
