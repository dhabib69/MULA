const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const fs = require('fs');

const html = fs.readFileSync('c:/Users/habib/OneDrive/Desktop/MULA/index.html', 'utf8')
  .replace('<script type="module">', '<script>')
  .replace(/import\s+.*?;/g, ''); // strip imports

const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost' });

dom.window.onerror = function(m, s, l, c, e) {
  fs.appendFileSync('c:/Users/habib/OneDrive/Desktop/MULA/jsdom_logs.txt', 'ERR: ' + m + ' at line ' + l + '\n');
  if(e && e.stack) fs.appendFileSync('c:/Users/habib/OneDrive/Desktop/MULA/jsdom_logs.txt', e.stack + '\n');
};

setTimeout(() => {
  fs.appendFileSync('c:/Users/habib/OneDrive/Desktop/MULA/jsdom_logs.txt', 'done\n');
}, 1000);
