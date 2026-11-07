import { encrypt, decrypt } from './backup-local.mjs';
import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'cozy-backup-fixture-'));const file=join(dir,'fixture.enc');
try{
 const key=randomBytes(32),data=Buffer.from('Synthetic restore fixture only');
 await encrypt(Readable.from(data),file,key);
 const chunks=[];for await(const c of decrypt(file,key))chunks.push(c);assert.deepEqual(Buffer.concat(chunks),data);
 assert.throws(()=>decrypt(file,randomBytes(32)));
 const damaged=readFileSync(file);damaged[25]^=1;writeFileSync(file,damaged);assert.throws(()=>decrypt(file,key));
 console.log('PASS: authenticated encryption round trip, wrong-key rejection and tamper rejection.');
}finally{rmSync(file,{force:true});rmdirSync(dir);}
