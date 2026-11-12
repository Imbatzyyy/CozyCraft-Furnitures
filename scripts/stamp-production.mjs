// Run only from the tested release checkout, after a production build.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const git = (...args) => execFileSync('git', args, { encoding:'utf8' }).trim();
const commit=git('rev-parse','HEAD');
if (!/^[a-f0-9]{40}$/.test(commit) || commit !== git('rev-parse','origin/main') ||
    git('status','--porcelain','--untracked-files=normal'))
  throw Error('Stamp only a clean checkout of the pushed main commit.');
const html=readFileSync('dist/index.html','utf8');
const entries=[...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"/]+\.(?:js|css))"/g)].map(m=>m[1]))];
if (!entries.length || !entries.some(p=>p.endsWith('.js'))) throw Error('Missing built entry assets');
const assets=Object.fromEntries(entries.map(p=>[p,createHash('sha256').update(readFileSync('dist'+p)).digest('hex')]));
writeFileSync('dist/release.json',JSON.stringify({commit,assets})+'\n');
console.log('Stamped release '+commit+' ('+entries.length+' entry assets)');
