'use strict';
/**
 * normalize.js — port gọn của NORMALIZATION_SPEC (V2) sang JS.
 * Dùng cho: gộp nhóm theo tên (fallback khi thiếu MST) + stub verify offline.
 * Nguồn quyết định verify tên thật vẫn là Dify V2 (Python) — bản JS này bám sát
 * để gộp nhóm nhất quán, KHÔNG thay thế lõi verify.
 */

// Bảng viết tắt pháp lý & ký hiệu (áp trên chuỗi đã bỏ dấu, IN HOA, còn dấu chấm).
// Thứ tự quan trọng: cụm dài / dạng chấm trước.
const REPLACEMENTS = [
  [/\bJOINT\s+STOCK\s+COMPANY\b/g, 'CONG TY CO PHAN'],
  [/\bJOINT\s+STOCK\s+CO\b/g, 'CONG TY CO PHAN'],
  [/\bC\.T\.C\.P\b/g, 'CONG TY CO PHAN'],
  [/\bCTCP\b/g, 'CONG TY CO PHAN'],
  [/\bCONG\s+TY\s+CP\b/g, 'CONG TY CO PHAN'],
  [/\bJSC\b/g, 'CONG TY CO PHAN'],

  [/\bLIMITED\s+LIABILITY\s+COMPANY\b/g, 'CONG TY TNHH'],
  [/\bCOMPANY\s+LIMITED\b/g, 'CONG TY TNHH'],
  [/\bCO\.?\s*,?\s*LTD\b/g, 'CONG TY TNHH'],
  [/\bLTD\b/g, 'CONG TY TNHH'],

  [/\bCONG\s+TY\s+TRACH\s+NHIEM\s+HUU\s+HAN\s+MOT\s+THANH\s+VIEN\b/g, 'CONG TY TNHH MOT THANH VIEN'],
  [/\bTRACH\s+NHIEM\s+HUU\s+HAN\b/g, 'TNHH'],
  [/\bT\.N\.H\.H\b/g, 'TNHH'],
  [/\bTNHH\s+MTV\b/g, 'TNHH MOT THANH VIEN'],
  [/\bTNHH\s+1\s*TV\b/g, 'TNHH MOT THANH VIEN'],
  [/\bMTV\b/g, 'MOT THANH VIEN'],

  [/\bDNTN\b/g, 'DOANH NGHIEP TU NHAN'],
  [/\bHTX\b/g, 'HOP TAC XA'],

  [/\bC\.TY\b/g, 'CONG TY'],
  [/\bCTY\b/g, 'CONG TY'],

  [/&/g, ' VA '],
];

// Tiền tố pháp lý loại khi lấy core name (dài → ngắn).
const LEGAL_PREFIXES = [
  'CONG TY TNHH MOT THANH VIEN',
  'CONG TY CO PHAN',
  'CONG TY TNHH',
  'DOANH NGHIEP TU NHAN',
  'HOP TAC XA',
  'CONG TY',
];

/** Bỏ dấu tiếng Việt (NFD + loại Combining Marks), xử lý Đ/đ riêng. */
function stripAccents(s) {
  return s
    .replace(/Đ/g, 'D').replace(/đ/g, 'd')
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Chuẩn hóa tên đầy đủ (tương ứng normalize_name của V2). */
function normalizeName(raw) {
  if (!raw) return '';
  let s = String(raw).toUpperCase().trim();
  s = stripAccents(s);
  // Punctuation → khoảng trắng, GIỮ dấu chấm để xử lý viết tắt trước.
  s = s.replace(/[,;:/\\_()\[\]{}"'`-]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  for (const [re, rep] of REPLACEMENTS) s = s.replace(re, rep);
  // Xóa dấu chấm còn lại → gom khoảng trắng.
  s = s.replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}

/** Lấy core name = bỏ tiền tố pháp lý ở đầu (không xóa từ ngành nghề). */
function extractCoreName(normalized) {
  let s = normalized || '';
  for (const p of LEGAL_PREFIXES) {
    if (s === p) return s;               // toàn bộ là tiền tố → giữ nguyên
    if (s.startsWith(p + ' ')) { s = s.slice(p.length + 1).trim(); break; }
  }
  return s;
}

/** MST: chỉ giữ chữ số. */
function normalizeMst(raw) {
  return String(raw == null ? '' : raw).replace(/\D/g, '');
}

/** Số tài khoản: giữ nguyên String (chỉ trim), không parse Number. */
function normalizeAccount(raw) {
  return String(raw == null ? '' : raw).trim();
}

module.exports = { normalizeName, extractCoreName, normalizeMst, normalizeAccount, stripAccents };
