/**
 * fe/build.mjs — sinh các bản chạy từ NGUỒN LOGIC DUY NHẤT src/engine/bm-engine.js.
 *   fe/index.html      — công cụ offline (bản làm việc)
 *   docs/index.html    — bản host GitHub Pages (Prod: https://tuanttstb-debug.github.io/BeneMatch/)
 *   fe/present.html    — trang trình bày tổng quan (kịch bản tổng hợp)
 *   gas/Engine.gs      — cùng engine cho Google Apps Script (đường API nội bộ, tùy chọn)
 * Chạy: node fe/build.mjs   (chạy test trước: node test/engine.test.mjs)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const engine = readFileSync(join(ROOT, 'src/engine/bm-engine.js'), 'utf8');
const config = readFileSync(join(ROOT, 'src/config/thresholds.json'), 'utf8').trim();
const advisor = readFileSync(join(ROOT, 'src/config/advisor.json'), 'utf8').trim();
const scenarios = readFileSync(join(ROOT, 'data/synthetic/scenarios.json'), 'utf8').trim();
// Không để chuỗi "</script" lọt vào dữ liệu nhúng.
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');

function inject(tplName) {
  let out = readFileSync(join(__dirname, tplName), 'utf8');
  out = out.replace('/*__BM_ENGINE__*/', () => safe(engine))
    .replace('/*__SCENARIOS__*/ []', () => safe(scenarios))
    .replace('/*__CONFIG__*/ {}', () => config)
    .replace('/*__ADVISOR__*/ {}', () => advisor);
  const leftover = ['/*__BM_ENGINE__*/', '/*__SCENARIOS__*/', '/*__CONFIG__*/', '/*__ADVISOR__*/'].filter((m) => out.includes(m));
  if (leftover.length) { console.error(tplName, '— còn marker chưa thay:', leftover); process.exit(1); }
  return out;
}

const fe = inject('index.template.html');
writeFileSync(join(__dirname, 'index.html'), fe);
console.log('✓ fe/index.html (', fe.length, 'bytes )');

const DOCS = join(ROOT, 'docs');
mkdirSync(DOCS, { recursive: true });
writeFileSync(join(DOCS, 'index.html'), fe);
writeFileSync(join(DOCS, '.nojekyll'), '');
console.log('✓ docs/index.html — GitHub Pages');

const present = inject('present.template.html');
writeFileSync(join(__dirname, 'present.html'), present);
console.log('✓ fe/present.html (', present.length, 'bytes )');

const gasHeader = '/**\n * Engine.gs — SINH TỰ ĐỘNG từ src/engine/bm-engine.js bởi fe/build.mjs. KHÔNG SỬA TAY.\n * Dùng trong GAS: BM.verifyName(...), BM.reconcileCase(...).\n */\n';
writeFileSync(join(ROOT, 'gas/Engine.gs'), gasHeader + engine);
console.log('✓ gas/Engine.gs');
