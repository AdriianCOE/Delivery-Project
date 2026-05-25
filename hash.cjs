const fs = require('fs');
const crypto = require('crypto');

const html = fs.readFileSync('dist/index.html', 'utf8');
const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);

if (match) {
  const content = match[1];
  const hash = crypto.createHash('sha256').update(content).digest('base64');
  console.log('sha256-' + hash);
} else {
  console.log('no match');
}