const fs = require('fs');
const c = fs.readFileSync('_fde2b0e_ve.js', 'utf8');   // use exact path string
const l = c.split('\n');
for(let i = 436; i < 475; i++) {
  console.log(String(i+1).padStart(3), JSON.stringify((l[i] || '').trim().substring(0, 65)));
}
console.log('---');
for(let i = 484; i < 535; i++) {
  console.log(String(i+1).padStart(3), JSON.stringify((l[i] || '').trim().substring(0, 65)));
}
console.log('---');
for(let i = 528; i < 560; i++) {
  console.log(String(i+1).padStart(3), JSON.stringify((l[i] || '').trim().substring(0, 65)));
}
