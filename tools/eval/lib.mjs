/**
 * lib.mjs — tiện ích chung cho bộ đánh giá (chạy trên máy [TT]).
 * NGUYÊN TẮC DỮ LIỆU: file GNOL thật + file gán nhãn + báo cáo chi tiết chỉ nằm ở thư mục làm việc local
 * (vd D:\Công việc\BeneMatch_eval\). Script TỪ CHỐI ghi vào trong repo. Chỉ báo cáo đã ẩn danh mới được chia sẻ.
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join, resolve, relative, isAbsolute } from 'path';
import { mkdirSync } from 'fs';

const require = createRequire(import.meta.url);
export const XLSX = require('xlsx');
export const REPO = resolve(join(dirname(fileURLToPath(import.meta.url)), '..', '..'));
export const BM = require(join(REPO, 'src/engine/bm-engine.js'));
export const CONFIG = require(join(REPO, 'src/config/thresholds.json'));

export function args() {
  const a = {}; const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i++) if (v[i].startsWith('--')) { const k = v[i].slice(2); a[k] = (v[i + 1] && !v[i + 1].startsWith('--')) ? v[++i] : true; }
  return a;
}

/** Chặn ghi dữ liệu thật vào repo (data-boundary). */
export function safeOutDir(dir) {
  const die = (m) => { console.error('✗ ' + m); process.exit(1); };
  if (!dir) die('Thiếu --out <thư mục làm việc local, vd "D:\\Công việc\\BeneMatch_eval">');
  const abs = resolve(dir);
  const rel = relative(REPO, abs);
  if (!rel || (!rel.startsWith('..') && !isAbsolute(rel))) die('KHÔNG được ghi vào trong repo BeneMatch (' + abs + ') — chọn thư mục ngoài repo (vd D:\\Công việc\\…).');
  mkdirSync(abs, { recursive: true });
  return abs;
}

export const today = () => new Date().toISOString().slice(0, 10);

export function readSheet(file, nameCandidates) {
  const wb = XLSX.readFile(file, { cellDates: true });
  const name = wb.SheetNames.find((n) => nameCandidates.some((c) => BM.stripAccents(n).toLowerCase().replace(/\s+/g, '') === c)) || null;
  return name ? XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: '' }) : null;
}

export function writeBook(file, sheets, widths = {}) {
  const wb = XLSX.utils.book_new();
  for (const [n, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = (rows[0] || []).map((_, i) => ({ wch: (widths[n] && widths[n][i]) || 18 }));
    XLSX.utils.book_append_sheet(wb, ws, n);
  }
  XLSX.writeFile(wb, file);
}

/** Gọi cổng AI (GAS proxy) theo lô 10 cặp. */
export async function askProxy(url, code, pairs, onProgress) {
  const out = [];
  for (let i = 0; i < pairs.length; i += 10) {
    const chunk = pairs.slice(i, i + 10);
    const r = await fetch(url, { method: 'POST', body: JSON.stringify({ action: 'advise_names', access_code: code, pairs: chunk }), redirect: 'follow' });
    const d = await r.json();
    if (d.error) throw new Error(d.message || d.error);
    out.push(...d.advices);
    if (onProgress) onProgress(Math.min(i + 10, pairs.length), pairs.length);
  }
  return out;
}

// ---- Ẩn danh: giữ cấu trúc (loại hình, từ ngành, tiếng Anh chung, chi nhánh, số), thay phần tên riêng bằng mã ----
const KEEP = new Set(('CONG TY TNHH CO PHAN MOT HAI THANH VIEN TRO LEN DOANH NGHIEP TU NHAN HOP TAC XA HO KINH DOANH TONG TAP DOAN '
  + 'CHI NHANH VAN PHONG DAI DIEN DIA DIEM TAI THUONG MAI DICH VU XAY DUNG SAN XUAT XUAT NHAP KHAU DAU PHAT TRIEN '
  + 'NGHE KY THUAT QUOC TE VIET NAM TONG HOP THIET BI VAT LIEU VAN GIAI PHAP THIET KE HANG HOA KHI DIEN NANG LUONG MOI '
  + 'TRUONG THUC PHAM NONG NGHIEP BAT DONG SAN VA TRADING SERVICE SERVICES COMPANY LIMITED LTD CO JSC JOINT STOCK CORPORATION '
  + 'CORP GROUP INTERNATIONAL INVESTMENT DEVELOPMENT TECHNOLOGY CONSTRUCTION IMPORT EXPORT MANUFACTURING ENGINEERING AND '
  + 'SOLUTIONS SOLUTION FOODS FOOD SHIPPING LOGISTICS TECHNICAL TRADE COMMERCIAL HOLDINGS PARTNERS ' + 'MIEN BAC NAM TRUNG SO HA NOI HO CHI MINH').split(/\s+/));
export function makeAnonymizer() {
  const map = new Map(); let n = 0;
  return function anon(name) {
    const toks = BM.stripAccents(String(name || '')).toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
    return toks.map((t) => {
      if (KEEP.has(t) || /^\d{1,2}$/.test(t)) return t;
      if (/\d{3,}/.test(t)) return '#'.repeat(Math.min(t.length, 6));
      if (!map.has(t)) map.set(t, 'X' + (++n));
      return map.get(t) + (t.length <= 4 ? '(' + t.length + ')' : '');
    }).join(' ');
  };
}
