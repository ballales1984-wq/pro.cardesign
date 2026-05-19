const fs = require('fs');

function analyze(path, label) {
  const c = fs.readFileSync(path, 'utf8').replace(/\r?\n/g, '\n');
  const l = c.split('\n');
  console.log(`\n=== ${label} (${l.length} lines) ===`);
  
  // Scan 495-530
  const start = Math.max(0, 495 - 1);
  const end = Math.min(l.length, 530);
  for (let i = start; i < end; i++) {
    const sp = (l[i].match(/^[ \t]*/) || [''])[0].length;
    console.log(String(i + 1).padStart(3), 'SP:' + String(sp).padStart(3), JSON.stringify(l[i].trim().substring(0, 60)));
  }
}

analyze('_fde2b0e_ve.js', 'fde2b0e');
analyze('_4c42e13_source.js', '4c42e13');
