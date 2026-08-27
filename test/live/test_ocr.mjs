// (b) OCR đường thật (Drive OCR free): POST ảnh hóa đơn synthetic + USE_OCR=true
//     -> Vision/Drive OCR -> parseInvoiceText_ -> reconcile. Ảnh EVD nằm cùng thư mục.
// Chạy: node test/live/test_ocr.mjs
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GAS_URL } from './config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMG = join(__dirname, 'invoice_synth_01.png');

const b64 = fs.readFileSync(IMG).toString('base64');
console.log(`image=${IMG}  base64_len=${b64.length}`);

// Lệnh CT khớp hóa đơn (kỳ vọng: OCR bóc đúng -> nhóm MATCH)
const csv = [
  'beneficiary_name,beneficiary_mst,account_number,amount',
  'CTY TNHH ABC VIET NAM,0101234567,0123456789,100000000',
].join('\n');

const body = JSON.stringify({
  action: 'reconcile',
  files: [{ name: 'invoice_synth_01.png', mime: 'image/png', data: b64 }],
  transfer_orders_csv: csv,
});

const t0 = Date.now();
const res = await fetch(GAS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body });
const text = await res.text();
let d; try { d = JSON.parse(text); } catch (e) { console.log('NON-JSON:\n', text.slice(0, 800)); process.exit(1); }
console.log(`HTTP ${res.status}  ${Date.now() - t0}ms\n`);
if (d.error) { console.log('ERROR:', d.error); process.exit(1); }

console.log('=== OCR-derived invoice (group) ===');
(d.groups || []).forEach((g) => {
  console.log(`  name="${g.beneficiary_display}" key=${g.group_key}`);
  console.log(`  name_decision=${g.name_decision} src=${g.name_source} amount_status=${g.amount_status} group=${g.decision}`);
});
console.log('\n=== SUMMARY ===', JSON.stringify(d.summary, null, 2));
console.log('warnings:', (d.warnings || []).map((w) => w.code || w.type));
fs.writeFileSync(join(__dirname, 'ocr_response.json'), JSON.stringify(d, null, 2));
console.log('\nfull response -> test/live/ocr_response.json');
