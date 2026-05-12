import { readFileSync } from 'fs';
const buf = readFileSync('app/page.js');
const lines = buf.toString('latin1').split('\n');
const line = lines[607]; // line 608 0-indexed
console.log('Latin-1 repr:', JSON.stringify(line));
const bytes = [];
for (let i = 0; i < line.length; i++) bytes.push(line.charCodeAt(i).toString(16).padStart(2,'0'));
console.log('Bytes around col 60-80:', bytes.slice(60, 90).join(' '));
