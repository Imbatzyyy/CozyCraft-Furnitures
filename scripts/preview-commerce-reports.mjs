// Generate inspectable design fixtures using the actual production PDF renderer.
// No database, account, credentials, or external requests are involved.
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
await mkdir('tmp/pdfs',{recursive:true});
await mkdir('output/pdf',{recursive:true});
await build({entryPoints:['src/lib/admin/commerce-report-pdf.ts'],outfile:'tmp/pdfs/report-renderer.mjs',bundle:true,platform:'node',format:'esm',packages:'external',alias:{'@':resolve('src')}});
const {createCommerceReportPdf}=await import('../tmp/pdfs/report-renderer.mjs');
const logo='data:image/png;base64,'+(await readFile('public/email-logo.png')).toString('base64');
const base={filters:{status:'all',paymentStatus:'all',paymentMethod:'all',dateRange:'custom',from:'2026-10-01',to:'2026-10-22',query:'',scope:'all',view:'all'},details:{contact:true,address:true,items:true},asOf:'2026-10-22T09:15:00Z',snapshotKey:'fixture'};
const rows=Array.from({length:36},(_,i)=>({id:String(i),order_number:`CC-${String(1200+i).padStart(5,'0')}`,created_at:'2026-10-22T00:35:00Z',status:['delivered','processing','pending','cancelled'][i%4],payment_method:['cod','gcash','card'][i%3],payment_status:['paid','pending','failed','refunded'][i%4],total:12499.5+i*100,subtotal:12000+i*100,delivery_fee:650,discount:150.5,shipping_address:{name:i%5===0?'Alexandra Marie de la Cruz - Long recipient name wrapping example':'Juan Dela Cruz'},environment:['cod','test','live'][i%3],payment_reference:i%3===0?`COD-CC-${1200+i}`:`pay_reference_example_${String(i).padStart(6,'0')}`,paid_at:i%4===0?'2026-10-22T01:03:00Z':null,email:'customer@example.invalid',mobile:'09000000000',address:'Sample Street, Barangay Sample, Quezon City, Metro Manila, 1100',items:[{name:'A comfortable three-seat sofa in a natural finish',quantity:1,unit_price:12000+i*100}]}));
const summary={totalValue:rows.reduce((s,r)=>s+r.total,0),settledValue:rows.filter(r=>r.payment_status==='paid'&&r.status!=='cancelled').reduce((s,r)=>s+r.total,0),settledCount:9,pendingValue:rows.filter(r=>r.payment_status==='pending').reduce((s,r)=>s+r.total,0),refundedValue:rows.filter(r=>r.payment_status==='refunded').reduce((s,r)=>s+r.total,0),cancelledCount:9};
for(const kind of ['orders','payments']) {
  const report={...base,kind,rows,total:rows.length,summary};
  await writeFile(`output/pdf/CozyCraft-${kind}-template-preview.pdf`,Buffer.from(createCommerceReportPdf(report,logo)));
}
console.log('Generated two fixture reports for visual QA in output/pdf. These files contain sample data only.');
