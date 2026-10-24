// Converts the single-file build (dist-single/index.html) into the page format the Claude artifact host expects
// (no doctype/html/head/body wrappers). Output: dist-single/artifact.html
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync('dist-single/index.html', 'utf8');
const title = (src.match(/<title>[\s\S]*?<\/title>/) || ['<title>Covenbound</title>'])[0];
const head = src.slice(src.indexOf('<head>') + 6, src.indexOf('</head>'));
const body = src.slice(src.indexOf('<body>') + 6, src.lastIndexOf('</body>'));
const keepHead = head
  .replace(/<meta charset[^>]*>/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '')
  .replace(/<title>[\s\S]*?<\/title>/i, '');
const out = `${title}\n${keepHead.trim()}\n${body.trim()}\n`;
writeFileSync('dist-single/artifact.html', out);
console.log('artifact.html', (out.length / 1024).toFixed(0) + ' KB');
