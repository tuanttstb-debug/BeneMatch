/**
 * fe/build.mjs — sinh các bản chạy từ NGUỒN LOGIC DUY NHẤT src/engine/bm-engine.js.
 *   fe/index.html      — công cụ offline 1 FILE (nhúng sẵn OCR + Excel, ~8 MB) — gửi nội bộ, mở thẳng bằng Chrome/Edge. (gitignore)
 *   docs/index.html    — bản GitHub Pages (Prod: https://tuanttstb-debug.github.io/BeneMatch/) + docs/bm-vendor.js (thư viện, cùng origin)
 *   fe/present.html    — trang trình bày tổng quan (kịch bản tổng hợp)
 *   gas/Engine.gs      — cùng engine cho Google Apps Script (cổng logic + AI)
 * Thư viện nhúng (Apache-2.0): pdfjs-dist · tesseract.js + core + mô hình tiếng Việt · xlsx (SheetJS) — từ node_modules.
 * Chuẩn bị 1 lần: npm ci   ·   Chạy: node fe/build.mjs   (chạy test trước: node test/engine.test.mjs)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const NM = join(ROOT, 'node_modules');

const engine = readFileSync(join(ROOT, 'src/engine/bm-engine.js'), 'utf8');
const scanLib = readFileSync(join(ROOT, 'src/ocr/scan_lib.js'), 'utf8');
const config = readFileSync(join(ROOT, 'src/config/thresholds.json'), 'utf8').trim();
const advisor = readFileSync(join(ROOT, 'src/config/advisor.json'), 'utf8').trim();
const scenarios = readFileSync(join(ROOT, 'data/synthetic/scenarios.json'), 'utf8').trim();
// Không để chuỗi "</script" / "<!--" lọt vào script nhúng.
const safe = (s) => s.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

// ---------- Thư viện offline (giống công cụ ẩn danh v3.6 / công cụ sao kê) ----------
if (!existsSync(join(NM, 'tesseract.js'))) { console.error('Thiếu node_modules — chạy `npm ci` trước.'); process.exit(1); }
const rd = (p) => readFileSync(join(NM, p), 'utf8');
const ver = (p) => JSON.parse(rd(p + '/package.json')).version;
const jsString = (name, src) => 'window.' + name + '=' + JSON.stringify(src).replace(/<\//g, '<\\/') + ';';
const libs = ['pdfjs-dist', 'tesseract.js', 'tesseract.js-core', '@tesseract.js-data/vie', 'xlsx'].map((p) => p + '@' + ver(p)).join(', ');
const vieB64 = readFileSync(join(NM, '@tesseract.js-data/vie/4.0.0_best_int/vie.traineddata.gz')).toString('base64');
const vendorParts = [
  rd('pdfjs-dist/build/pdf.min.js'),
  rd('tesseract.js/dist/tesseract.min.js'),
  rd('xlsx/dist/xlsx.full.min.js'),
  jsString('__PDFW_SRC', rd('pdfjs-dist/build/pdf.worker.min.js')),
  // Lõi LSTM + SIMD (Chrome/Edge ≥ 91).
  jsString('__TCORE_SRC', rd('tesseract.js-core/tesseract-core-simd-lstm.wasm.js')),
  jsString('__TW_SRC', rd('tesseract.js/dist/worker.min.js')),
  'window.__VIE_B64="' + vieB64 + '";',
];
const vendorNote = '<!-- Thư viện nhúng offline (Apache-2.0): ' + libs + ' -->';
const vendorInline = vendorNote + '\n' + vendorParts.map((p) => '<script>' + safe(p) + '</script>').join('\n');
const vendorFile = '/* BeneMatch — thư viện offline: ' + libs + ' (Apache-2.0). SINH TỰ ĐỘNG bởi fe/build.mjs. */\n' + vendorParts.join('\n;\n');

function inject(tplName, vendor) {
  let out = readFileSync(join(__dirname, tplName), 'utf8');
  out = out.replace('/*__BM_ENGINE__*/', () => safe(engine))
    .replace('/*__SCANLIB__*/', () => safe(scanLib))
    .replace('<!--__VENDOR__-->', () => vendor || '')
    .replace('/*__SCENARIOS__*/ []', () => safe(scenarios))
    .replace('/*__CONFIG__*/ {}', () => config)
    .replace('/*__ADVISOR__*/ {}', () => advisor);
  const leftover = ['/*__BM_ENGINE__*/', '/*__SCANLIB__*/', '<!--__VENDOR__-->', '/*__SCENARIOS__*/', '/*__CONFIG__*/', '/*__ADVISOR__*/'].filter((m) => out.includes(m));
  if (leftover.length) { console.error(tplName, '— còn marker chưa thay:', leftover); process.exit(1); }
  return out;
}
const mb = (s) => (Buffer.byteLength(s) / 1e6).toFixed(2) + ' MB';

const fe = inject('index.template.html', vendorInline);
writeFileSync(join(__dirname, 'index.html'), fe);
console.log('✓ fe/index.html — 1 file offline (', mb(fe), ')');

const DOCS = join(ROOT, 'docs');
mkdirSync(DOCS, { recursive: true });
const docs = inject('index.template.html', vendorNote + '\n<script src="bm-vendor.js"></script>');
writeFileSync(join(DOCS, 'index.html'), docs);
const vPath = join(DOCS, 'bm-vendor.js');
if (!existsSync(vPath) || readFileSync(vPath, 'utf8') !== vendorFile) writeFileSync(vPath, vendorFile);
writeFileSync(join(DOCS, '.nojekyll'), '');
console.log('✓ docs/index.html (', mb(docs), ') + docs/bm-vendor.js (', mb(vendorFile), ') — GitHub Pages');

const present = inject('present.template.html');
writeFileSync(join(__dirname, 'present.html'), present);
console.log('✓ fe/present.html (', mb(present), ')');

const gasHeader = '/**\n * Engine.gs — SINH TỰ ĐỘNG từ src/engine/bm-engine.js bởi fe/build.mjs. KHÔNG SỬA TAY.\n * Dùng trong GAS: BM.verifyName(...), BM.reconcileCase(...), BM.advisor.*(...).\n */\n';
writeFileSync(join(ROOT, 'gas/Engine.gs'), gasHeader + engine);
console.log('✓ gas/Engine.gs');
