// (a) Debug route verify_name: quan sát nhánh Dify (MATCH/NOT_MATCH=NOT_INVOKED vs REVIEW-AI)
// Chạy: node test/live/test_verify_name.mjs
import { GAS_URL } from './config.mjs';

async function verify(label, inv, pay) {
  const t0 = Date.now();
  const res = await fetch(GAS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'verify_name', pair: { request_id: 'BM-' + label, invoice_beneficiary_name: inv, payment_beneficiary_name: pay } }) });
  const d = JSON.parse(await res.text());
  if (d.error) { console.log(`\n[${label}] ERROR: ${d.error} ${d.body || ''}`); return; }
  const uw = d.user_warning || {}; const nv = d.name_verification || {};
  console.log(`\n[${label}] ${Date.now() - t0}ms`);
  console.log(`  invoice="${inv}"\n  payment="${pay}"`);
  console.log(`  decision=${d.decision} action=${d.action} reason=${JSON.stringify(d.reason_codes)}`);
  console.log(`  similarity=${nv.similarity_score} seq=${nv.similarity_details && nv.similarity_details.sequence_similarity} tok=${nv.similarity_details && nv.similarity_details.token_similarity}`);
  console.log(`  >>> ai_status=${uw.ai_status}  generated_by_ai=${uw.generated_by_ai}  (LLM fired = ${uw.ai_status === 'SUCCESS' || uw.generated_by_ai})`);
}

await verify('REVIEW_AI', 'CONG TY TNHH DAU TU THUONG MAI HOANG GIA', 'CONG TY TNHH THUONG MAI HOANG GIA');
await verify('MATCH', 'CONG TY TNHH ABC VIET NAM', 'CTY TNHH ABC VIET NAM');
await verify('NOT_MATCH', 'CONG TY CO PHAN DELTA', 'CONG TY TNHH DELTA');
