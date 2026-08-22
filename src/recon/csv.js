'use strict';
/**
 * csv.js — parser CSV lệnh chuyển tiền (header cố định).
 * Cột: beneficiary_name,beneficiary_mst,account_number,amount
 * account = String (giữ số 0 đầu); amount = Number VND nguyên (bỏ dấu phân tách).
 */

function splitLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function toAmount(raw) {
  const digits = String(raw == null ? '' : raw).replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

/** parseTransferCsv(text) -> transfer_orders[] */
function parseTransferCsv(text) {
  if (!text) return [];
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim().length);
  if (!lines.length) return [];
  const header = splitLine(lines[0]).map((h) => h.toLowerCase());
  const idx = (name) => header.indexOf(name);
  const iName = idx('beneficiary_name'), iMst = idx('beneficiary_mst'),
        iAcc = idx('account_number'), iAmt = idx('amount');
  const rows = [];
  for (let n = 1; n < lines.length; n++) {
    const c = splitLine(lines[n]);
    rows.push({
      transfer_id: 'CT-' + String(n).padStart(4, '0'),
      beneficiary_name: iName >= 0 ? c[iName] : '',
      beneficiary_mst: iMst >= 0 ? c[iMst] : '',
      account_number: iAcc >= 0 ? String(c[iAcc] || '') : '',
      amount: iAmt >= 0 ? toAmount(c[iAmt]) : 0,
    });
  }
  return rows;
}

module.exports = { parseTransferCsv, toAmount };
