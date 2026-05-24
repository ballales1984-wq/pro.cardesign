const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const lines = html.split('\n');

let stack = [];

lines.forEach((line, i) => {
  // Find all tags - use non-global match for iterating
  let str = line;
  let pos = 0;
  let m;
  let re = /<\/?([a-z][a-z0-9]*)([^>]*)>/gi;
  while ((m = re.exec(str)) !== null) {
    let full = m[0];
    if (full.includes('/>') || full.startsWith('<!')) continue;
    let isClosing = m[0].startsWith('</');
    let tagName = m[1];

    if (isClosing) {
      if (stack.length > 0 && stack[stack.length-1].tag === tagName) {
        stack.pop();
      } else {
        // Find which opener this closes
        let found = false;
        for (let j = stack.length-1; j >= 0; j--) {
          if (stack[j].tag === tagName) {
            console.log('STRAY </' + tagName + '> at line ' + (i+1) + ' closing opener from line ' + stack[j].line);
            stack.splice(j, 1);
            found = true;
            break;
          }
        }
        if (!found) console.log('EXTRA closing </' + tagName + '> at line ' + (i+1));
      }
    } else {
      stack.push({ line: i+1, tag: tagName });
    }
  }
});

console.log('\nRemaining open tags (UNCLOSED):');
stack.forEach(s => console.log('  <' + s.tag + '> opened at line ' + s.line));
