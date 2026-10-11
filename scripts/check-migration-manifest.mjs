import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const names=readdirSync('supabase/migrations').filter(n=>/^\d{14}_.+\.sql$/.test(n)).sort();
assert.equal(new Set(names.map(n=>n.slice(0,14))).size,names.length,'Duplicate migration versions');
const migrations=names.map(file=>({file,sha256:createHash('sha256').update(readFileSync(`supabase/migrations/${file}`)).digest('hex')}));
if(process.argv.includes('--print')) console.log(JSON.stringify({project:'gwjsivqksyimuabbdyqq',migrations},null,2));
else {
  const manifest=JSON.parse(readFileSync('docs/releases/shared-backend-manifest.json','utf8'));
  assert.deepEqual(manifest.migrations,migrations,'Migration manifest changed: review and regenerate deliberately');
  console.log(`PASS: ${migrations.length} unique migration versions match the shared-backend manifest.`);
}
