const fs = require('fs');
const c = fs.readFileSync('_fde2b0e_ve.js', 'utf8').replace(/\r?\n/g, '\n');
const l = c.split('\n');
for (let i = 483; i < 560; i++) {
  const sp = ((l[i - 1] || '').match(/^[ \t]*/) || [''])[0].length;
  console.log(i, String(sp).padStart(3), JSON.stringify((l[i - 1] || '').trim().substring(0, 60)));
}
