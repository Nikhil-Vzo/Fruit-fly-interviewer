const fs = require('fs');
const path = 'public/js/app.js';
let src = fs.readFileSync(path, 'utf8');

// Use index-based replacement
const startMarker = 'div.innerHTML = `';
const endMarker = '    `;\r\n    historyList.insertBefore';
const startIdx = src.indexOf(startMarker);
const endIdx = src.indexOf(endMarker, startIdx);

console.log('startIdx:', startIdx, 'endIdx:', endIdx);
const oldBlock = src.slice(startIdx, endIdx + endMarker.length);
console.log('OLD:', oldBlock);

const newBlock = `div.innerHTML = \`
      <span class="hist-time">\${timeStr}</span>
      <span class="hist-delta \${isNeg ? 'negative' : ''}\${isLLM ? ' llm' : ''}">\${isLLM ? '? ' : ''}\${deltaText}</span>
      <span class="hist-text">\${critique}</span>
    \`;\r\n    historyList.insertBefore`;

src = src.slice(0, startIdx) + newBlock + src.slice(startIdx + oldBlock.length);
fs.writeFileSync(path, src, 'utf8');
console.log('PATCHED successfully');
