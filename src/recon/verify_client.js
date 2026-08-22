'use strict';
/**
 * verify_client.js — verify TÊN 1 cặp (invoice vs transfer) cho từng nhóm.
 * Pluggable:
 *   - makeStubVerifier(): offline, xấp xỉ V2 bằng normalize JS (đủ để test recon).
 *   - makeDifyVerifier(): live, POST tới Dify Workflow V2 (API_CONTRACT).
 * Recon engine chỉ cần 1 hàm async: (pair) => { decision, reason_codes }.
 */
const { normalizeName, extractCoreName } = require('./normalize');

const LEGAL_FAMILY = [
  [/\bCONG TY TNHH MOT THANH VIEN\b/, 'TNHH'],
  [/\bCONG TY TNHH\b/, 'TNHH'],
  [/\bTNHH\b/, 'TNHH'],
  [/\bCONG TY CO PHAN\b/, 'CO_PHAN'],
  [/\bDOANH NGHIEP TU NHAN\b/, 'DNTN'],
  [/\bHOP TAC XA\b/, 'HTX'],
];

function legalFamily(normalized) {
  for (const [re, fam] of LEGAL_FAMILY) if (re.test(normalized)) return fam;
  return 'UNKNOWN';
}

function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  if (!A.size && !B.size) return 1;
  let inter = 0; for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Stub xấp xỉ V2 — KHÔNG thay lõi thật; đủ để chạy/aggregate recon offline. */
function makeStubVerifier() {
  return async function verify({ invoice_beneficiary_name, payment_beneficiary_name }) {
    const invN = normalizeName(invoice_beneficiary_name);
    const payN = normalizeName(payment_beneficiary_name);
    if (!invN || !payN) return { decision: 'REVIEW', reason_codes: ['INSUFFICIENT_DATA'], source: 'STUB' };

    const invF = legalFamily(invN), payF = legalFamily(payN);
    if (invF !== 'UNKNOWN' && payF !== 'UNKNOWN' && invF !== payF)
      return { decision: 'NOT_MATCH', reason_codes: ['LEGAL_ENTITY_TYPE_CONFLICT'], source: 'STUB' };

    if (invN === payN)
      return { decision: 'MATCH', reason_codes: ['NORMALIZED_NAME_EXACT_MATCH'], source: 'STUB' };

    const invC = extractCoreName(invN).split(' ').filter(Boolean);
    const payC = extractCoreName(payN).split(' ').filter(Boolean);
    if (invC.join(' ') === payC.join(' '))
      return { decision: 'MATCH', reason_codes: ['LEGAL_TYPE_AND_CORE_NAME_EXACT_MATCH'], source: 'STUB' };

    const sim = jaccard(invC, payC);
    if (sim >= 0.6)
      return { decision: 'REVIEW', reason_codes: ['NAME_SIMILAR_BUT_NOT_CONCLUSIVE'], source: 'STUB' };
    return { decision: 'NOT_MATCH', reason_codes: ['LOW_NAME_SIMILARITY'], source: 'STUB' };
  };
}

/** Live — POST tới Dify V2. fetchImpl mặc định = global fetch (Node 18+). */
function makeDifyVerifier({ url, apiKey, fetchImpl } = {}) {
  const doFetch = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  if (!doFetch) throw new Error('Không có fetch — truyền fetchImpl');
  return async function verify({ request_id, invoice_beneficiary_name, payment_beneficiary_name,
                                 invoice_account_number, payment_account_number }) {
    const res = await doFetch(`${url}/workflows/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputs: {
          request_id: request_id || 'BM-RECON',
          invoice_beneficiary_name, payment_beneficiary_name,
          invoice_account_number: invoice_account_number || '',
          payment_account_number: payment_account_number || '',
        },
        response_mode: 'blocking', user: request_id || 'BM-RECON',
      }),
    });
    if (!res.ok) throw new Error(`Dify HTTP ${res.status}`);
    const data = await res.json();
    const r = data && data.data && data.data.outputs && data.data.outputs.result;
    if (!r) throw new Error('Dify: thiếu outputs.result');
    return { decision: r.decision, reason_codes: r.reason_codes || [], source: 'DIFY_V2' };
  };
}

module.exports = { makeStubVerifier, makeDifyVerifier, legalFamily };
