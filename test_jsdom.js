const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const fs = require('fs');

const html = fs.readFileSync('c:/Users/habib/OneDrive/Desktop/MULA/index.html', 'utf8')
  .replace('<script type="module">', '<script>')
  .replace(/import\s+.*?;/g, ''); // strip imports

const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost' });

dom.window.onerror = function(m, s, l, c, e) {
  console.log('ERR:', m, 'at line', l);
  if(e && e.stack) console.log(e.stack);
};

setTimeout(() => console.log('done'), 1000);
