import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

function findFiles(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) findFiles(fullPath, files);
    else if (fullPath.endsWith('.ts')) files.push(fullPath);
  }
  return files;
}

const files = findFiles('./apps/api/src');
for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  // Match `from './...'` or `from "../..."` without `.js`
  content = content.replace(/from\s+(['"])(\.\/|\.\.\/)(.*?)(?!\.js)\1/g, (match, quote, prefix, p3) => {
    if (p3.endsWith('.js') || p3.endsWith('.ts')) return match;
    return `from ${quote}${prefix}${p3}.js${quote}`;
  });
  // Also match `import './...'`
  content = content.replace(/import\s+(['"])(\.\/|\.\.\/)(.*?)(?!\.js)\1/g, (match, quote, prefix, p3) => {
    if (p3.endsWith('.js') || p3.endsWith('.ts')) return match;
    return `import ${quote}${prefix}${p3}.js${quote}`;
  });
  fs.writeFileSync(file, content);
}
console.log('Fixed imports!');
