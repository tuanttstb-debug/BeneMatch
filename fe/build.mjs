/**
 * fe/build.mjs — sinh fe/index.html từ template + gas/Recon.gs (engine) + synthetic data.
 * Nguồn logic DUY NHẤT là Recon.gs (đã parity với src/recon) — FE không giữ bản copy tay.
 * Chạy: node fe/build.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

let engine = readFileSync(join(ROOT, 'gas/Recon.gs'), 'utf8');
// Bỏ khối module.exports (chỉ dùng cho Node) — trình duyệt không cần.
engine = engine.replace(/\nif \(typeof module[\s\S]*$/m, '\n');

const invoices = readFileSync(join(ROOT, 'data/synthetic/invoices.json'), 'utf8').trim();
const transfersCsv = readFileSync(join(ROOT, 'data/synthetic/transfer_orders.csv'), 'utf8');
const config = readFileSync(join(ROOT, 'src/config/thresholds.json'), 'utf8').trim();
const scenarios = readFileSync(join(ROOT, 'data/synthetic/scenarios.json'), 'utf8').trim();

function inject(tplName) {
  let out = readFileSync(join(__dirname, tplName), 'utf8')
    .replace('/*__RECON_ENGINE__*/', engine)
    .replace('/*__SYNTHETIC_INVOICES__*/ []', invoices)
    .replace('/*__SYNTHETIC_TRANSFERS_CSV__*/ ""', JSON.stringify(transfersCsv))
    .replace('/*__CONFIG__*/ {}', config)
    .replace('/*__SCENARIOS__*/ []', scenarios);
  const leftover = ['/*__RECON_ENGINE__*/', '/*__SYNTHETIC_INVOICES__*/', '/*__SYNTHETIC_TRANSFERS_CSV__*/', '/*__CONFIG__*/', '/*__SCENARIOS__*/']
    .filter((m) => out.includes(m));
  if (leftover.length) { console.error(tplName, '— còn marker chưa thay:', leftover); process.exit(1); }
  return out;
}

const fe = inject('index.template.html');
writeFileSync(join(__dirname, 'index.html'), fe);
console.log('✓ fe/index.html (', fe.length, 'bytes ) — công cụ tương tác.');

// GitHub Pages phục vụ từ /docs (nhánh main). Trang demo tĩnh, tự chứa, chỉ dữ liệu synthetic.
const DOCS = join(ROOT, 'docs');
mkdirSync(DOCS, { recursive: true });
writeFileSync(join(DOCS, 'index.html'), fe);
writeFileSync(join(DOCS, '.nojekyll'), '');
console.log('✓ docs/index.html (', fe.length, 'bytes ) — bản host GitHub Pages.');

const present = inject('present.template.html');
writeFileSync(join(__dirname, 'present.html'), present);
console.log('✓ fe/present.html (', present.length, 'bytes ) — trang trình bày (artifact).');
