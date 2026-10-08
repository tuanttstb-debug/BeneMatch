/**
 * ui_smoke.mjs — kiểm công cụ trên Chrome thật (sau `node fe/build.mjs`):
 *   OCR offline (PDF scan thẳng / xoay 90° / ảnh / PDF chữ / XML) · 0 request ra Internet · 0 lỗi JS ·
 *   bản Pages (docs/ + bm-vendor.js) · thẻ AI tư vấn 2 chế độ (chạy thử Gemini miễn phí / AI nội bộ) qua mock_proxy.
 * Chạy: node tools/dev/ui_smoke.mjs   (CHROME_PATH nếu Chrome không ở chỗ mặc định) — chỉ dữ liệu giả lập trong test/fixtures.
 * Sinh lại fixtures scan: PYTHONUTF8=1 python tools/dev/make_scan_fixtures.py
 */
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import http from 'http';
import { readFileSync } from 'fs';
import { spawn } from 'child_process';
import { join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..').split('\\').join('/');
const FX = ROOT + '/test/fixtures';
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? '  ✓ ' : '  ✗ ') + n + (d ? '  — ' + d : '')); };

// Server tĩnh cho bản Pages (docs/)
const srv = http.createServer((q, r) => { const p = join(ROOT, 'docs', q.url === '/' ? 'index.html' : q.url.split('?')[0]);
  try { const b = readFileSync(p); r.setHeader('Content-Type', p.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8'); r.end(b); } catch { r.statusCode = 404; r.end(); } }).listen(8799);
const mocks = [spawn('node', [ROOT + '/tools/dev/mock_proxy.mjs', '8790']), spawn('node', [ROOT + '/tools/dev/mock_proxy.mjs', '8791', 'real']), spawn('node', [ROOT + '/tools/dev/mock_proxy.mjs', '8793', 'slow'])];
await new Promise((r) => setTimeout(r, 1200));

const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', defaultViewport: { width: 1300, height: 1400 } });

async function open(url, ls) {
  const page = await b.newPage();
  if (ls) await page.evaluateOnNewDocument((v) => localStorage.setItem('bm_ai_settings', v), JSON.stringify(ls));
  const ext = [], errs = [];
  page.on('request', (rq) => { const u = rq.url(); if (!/^(file:|data:|blob:|http:\/\/127\.0\.0\.1:(8799|8790|8791|8793)\/)/.test(u)) ext.push(u); });
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(url, { waitUntil: 'load' });
  return { page, ext, errs };
}
async function upload(page, files, expect, timeout) {
  const el = await page.$('#fInv'); await el.uploadFile(...files);
  await page.waitForFunction((n) => Number(document.getElementById('invCount').textContent) >= n, { timeout, polling: 500 }, expect);
  return page.$$eval('#invTbl tbody tr', (trs) => trs.map((tr) => { const v = (k) => { const i = tr.querySelector('[data-k="' + k + '"]'); return i ? i.value : ''; };
    return { src: tr.querySelector('.src') && tr.querySelector('.src').textContent, seller: v('seller_name'), mst: v('seller_mst'), amt: v('amount_total'), no: v('invoice_no') }; }));
}

console.log('\n[1] Bản 1 file offline (fe/index.html, file://)');
let { page, ext, errs } = await open('file:///' + ROOT + '/fe/index.html');
check('Thư viện nhúng sẵn: pdf.js + tesseract + SheetJS', await page.evaluate(() => typeof pdfjsLib !== 'undefined' && typeof Tesseract !== 'undefined' && typeof XLSX !== 'undefined' && hasOcrLibs()));
let t0 = Date.now();
const rows = await upload(page, [FX + '/hddt_synth_scan.pdf', FX + '/hddt_synth_scan_xoay90.pdf', FX + '/hddt_synth_scan.png', FX + '/hddt_synth.pdf', FX + '/hddt_synth_tt78.xml'], 5, 300000);
console.log('    (đọc 5 file trong', Math.round((Date.now() - t0) / 1000), 'giây)');
rows.forEach((r, i) => console.log('    ', i + 1, r.src, '|', r.seller, '|', r.mst, '|', r.amt, '|', r.no));
const okRow = (r) => /^CÔNG TY .*SÀI GÒN XANH$/i.test(r.seller) && r.mst.replace(/\D/g, '') === '0104000004' && r.amt.replace(/\D/g, '') === '79200000';
check('PDF scan thẳng → OCR đủ tên/MST/tiền', okRow(rows[0]) && /PDF scan/.test(rows[0].src), JSON.stringify(rows[0]));
check('PDF scan XOAY 90° → tự xoay, OCR đủ', okRow(rows[1]), JSON.stringify(rows[1]));
check('Ảnh PNG → OCR đủ', okRow(rows[2]) && /ảnh/.test(rows[2].src), JSON.stringify(rows[2]));
check('PDF chữ → đọc lớp chữ', okRow(rows[3]) && /PDF$/.test(rows[3].src.trim()), JSON.stringify(rows[3]));
check('XML TT78 → đọc chính xác', rows[4] && /XML/.test(rows[4].src) && rows[4].seller.length > 5, JSON.stringify(rows[4]));
check('0 request ra Internet (OCR offline)', ext.length === 0, ext.slice(0, 3).join(' '));
check('0 lỗi JS', errs.length === 0, errs.slice(0, 3).join(' | '));
await page.close();

console.log('\n[2] Bản Pages (docs/index.html + bm-vendor.js)');
({ page, ext, errs } = await open('http://127.0.0.1:8799/'));
const r2 = await upload(page, [FX + '/hddt_synth_scan_xoay90.pdf'], 1, 180000);
check('Pages: thư viện tải cùng origin, OCR scan xoay chạy', okRow(r2[0]), JSON.stringify(r2[0]));
check('Pages: 0 request ra Internet · 0 lỗi JS', ext.length === 0 && errs.length === 0, ext.concat(errs).slice(0, 3).join(' | '));

console.log('\n[3] Thẻ AI tư vấn — chế độ thử (Gemini miễn phí giả lập)');
await page.close();
({ page, ext, errs } = await open('http://127.0.0.1:8799/', { url: 'http://127.0.0.1:8790/exec' }));
await page.select('#scnSel', '8');
await page.click('#btnRun');
await page.waitForSelector('#aiCard', { timeout: 10000 });
await page.waitForFunction(() => /gemini/.test((document.getElementById('aiMode') || {}).textContent || ''), { timeout: 8000 }).catch(() => {});
const mode = await page.$eval('#aiMode', (e) => ({ cls: e.className, txt: e.textContent }));
check('Hiện cảnh báo chạy thử + tên model từ cổng', /ai-warn/.test(mode.cls) && /gemini/.test(mode.txt) && /miễn phí/.test(mode.txt), mode.txt.slice(0, 120));
await page.type('#aiCode', 'DEV-LOCAL');
await page.click('#aiAsk');
const s1 = await page.$eval('#aiStatus', (e) => e.textContent);
check('Chưa tick xác nhận ẩn danh → không gửi', /tick xác nhận/.test(s1), s1);
await page.click('#aiAttest');
await page.click('#aiAsk');
await page.waitForFunction(() => /Đã nhận ý kiến AI|⚠/.test(document.getElementById('aiStatus').textContent), { timeout: 20000 });
const s2 = await page.$eval('#aiStatus', (e) => e.textContent);
const advN = await page.$$eval('.ai-op, .advice, [class*="ai-op"]', (x) => x.length).catch(() => -1);
check('Tick xác nhận → nhận ý kiến AI', /Đã nhận ý kiến AI cho 2 cặp/.test(s2), s2 + ' · khối ý kiến: ' + advN);
if (process.env.SHOT_DIR) await page.screenshot({ path: process.env.SHOT_DIR + '/ui_ai_card.png', fullPage: false, clip: await page.$eval('#aiCard', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y + window.scrollY, width: r.width, height: r.height }; }) }).catch(() => {});
await page.close();

console.log('\n[4] Thẻ AI tư vấn — AI nội bộ (giả lập, cho phép dữ liệu thật)');
({ page, ext, errs } = await open('http://127.0.0.1:8799/', { url: 'http://127.0.0.1:8791/exec', code: 'DEV-LOCAL' }));
await page.select('#scnSel', '8');
await page.click('#btnRun');
await page.waitForSelector('#aiCard');
await page.waitForFunction(() => /tpb-llm-mock/.test((document.getElementById('aiMode') || {}).textContent || ''), { timeout: 8000 }).catch(() => {});
const m2 = await page.$eval('#aiMode', (e) => ({ cls: e.className, txt: e.textContent }));
check('Không cảnh báo, ghi model nội bộ', !/ai-warn/.test(m2.cls) && /openai_compat · tpb-llm-mock/.test(m2.txt), m2.txt);
await page.click('#aiAsk');
await page.waitForFunction(() => /Đã nhận ý kiến AI|⚠/.test(document.getElementById('aiStatus').textContent), { timeout: 20000 });
check('Hỏi AI không cần tick xác nhận', /Đã nhận ý kiến AI cho 2 cặp/.test(await page.$eval('#aiStatus', (e) => e.textContent)));
check('0 lỗi JS', errs.length === 0, errs.join(' | '));

await page.close();

console.log('\n[5] AI chậm (treo 14 giây) → giao diện báo bận sau 10 giây');
({ page, ext, errs } = await open('http://127.0.0.1:8799/', { url: 'http://127.0.0.1:8793/exec', code: 'DEV-LOCAL' }));
await page.select('#scnSel', '8');
await page.click('#btnRun');
await page.waitForSelector('#aiAttest', { timeout: 10000 });
await page.click('#aiAttest');
const ts = Date.now();
await page.click('#aiAsk');
await page.waitForFunction(() => /Đã nhận ý kiến AI|⚠/.test(document.getElementById('aiStatus').textContent), { timeout: 30000 });
const sl = await page.$eval('#aiStatus', (e) => e.textContent), secs = (Date.now() - ts) / 1000;
check('Báo "AI đang bận" trong ~10 giây, không treo giao diện', /AI đang bận/.test(sl) && secs < 11.5, secs.toFixed(1) + ' giây · ' + sl);

console.log('\n[6] Check nhanh tên — chế độ thử bắt tick xác nhận');
await page.click('button[data-tab="quick"]');
await page.evaluate(() => { const i = document.getElementById('qInv'), p = document.getElementById('qPay'); i.value = 'CÔNG TY TNHH SAO VIỆT'; p.value = 'VIETSTAR COMPANY LIMITED'; p.dispatchEvent(new Event('input')); });
await page.waitForSelector('#qcAsk', { timeout: 5000 });
check('Có ô tick xác nhận cạnh nút Hỏi AI', !!(await page.$('#qcAttest')));
await page.click('#qcAsk');
check('Chưa tick → không gửi', /tick xác nhận/.test(await page.$eval('#qcAiSt', (e) => e.textContent)));
await page.close();
({ page, ext, errs } = await open('http://127.0.0.1:8799/', { url: 'http://127.0.0.1:8790/exec', code: 'DEV-LOCAL' }));
await page.click('button[data-tab="quick"]');
await page.evaluate(() => { const i = document.getElementById('qInv'), p = document.getElementById('qPay'); i.value = 'CÔNG TY TNHH SAO VIỆT'; p.value = 'VIETSTAR COMPANY LIMITED'; p.dispatchEvent(new Event('input')); });
await page.waitForSelector('#qcAttest', { timeout: 5000 });
await page.click('#qcAttest');
await page.click('#qcAsk');
await page.waitForFunction(() => !document.getElementById('qcAsk') || /⚠/.test((document.getElementById('qcAiSt') || {}).textContent || ''), { timeout: 15000 }).catch(() => {});
const qres = await page.$eval('#qcRes', (e) => e.innerText);
check('Tick → nhận ý kiến AI ở Check nhanh', /pháp nhân/i.test(qres) && !(await page.$('#qcAsk')), qres.replace(/\s+/g, ' ').slice(-140));
check('0 lỗi JS', errs.length === 0, errs.join(' | '));

await b.close(); srv.close(); mocks.forEach((m) => m.kill());
console.log(`\n=== UI: ${pass} pass · ${fail} fail ===`);
process.exit(fail ? 1 : 0);
