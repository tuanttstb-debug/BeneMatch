/**
 * score.mjs — chấm điểm engine + AI tư vấn trên file đã GÁN NHÃN (chạy trên máy [TT]).
 *   node tools/eval/score.mjs --in "D:\Công việc\BeneMatch_eval\BeneMatch_gan_nhan_2026-10-05.xlsx" --out "D:\Công việc\BeneMatch_eval"
 * Kết quả: BeneMatch_danh_gia_<ngày>.md — số liệu tổng hợp + ca sai ĐÃ ẨN DANH (file này mới được gửi cho [CC]).
 */
import { join } from 'path';
import { writeFileSync } from 'fs';
import { BM, args, safeOutDir, readSheet, today, makeAnonymizer } from './lib.mjs';

const a = args();
if (!a.in) { console.error('Thiếu --in <file gán nhãn>'); process.exit(1); }
const dir = safeOutDir(a.out);
const rows = readSheet(a.in, ['gannhan']);
if (!rows) { console.error('Không thấy sheet "GanNhan".'); process.exit(1); }
const H = rows[0].map((x) => String(x));
const ix = (p) => H.findIndex((h) => h.startsWith(p));
const I = { inv: ix('Tên bên bán'), pay: ix('Tên người thụ hưởng'), dec: ix('Engine: kết luận'), rule: ix('Engine: luật'), ai: ix('AI: ý kiến'),
  rel: ix('AI: quan hệ'), conf: ix('AI: độ tin'), label: ix('NHÃN'), cat: ix('Nhóm ca khó'), note: ix('Ghi chú') };
const norm = (s) => BM.stripAccents(String(s || '')).toUpperCase().replace(/\s+/g, '_').trim();
const LAB = { CUNG: 'SAME', KHAC: 'DIFF', LIEN_QUAN: 'DIFF', KHONG_RO: 'UNK' };

const items = rows.slice(1).filter((r) => r[I.inv] && r[I.pay]).map((r) => ({
  inv: r[I.inv], pay: r[I.pay], dec: String(r[I.dec]), rule: String(r[I.rule]), ai: String(r[I.ai] || ''), rel: String(r[I.rel] || ''),
  conf: Number(r[I.conf] || 0), label: LAB[norm(r[I.label])] || null, rawLabel: norm(r[I.label]), cat: norm(r[I.cat]) || 'CHUA_PHAN_LOAI', note: String(r[I.note] || ''),
}));
const lab = items.filter((x) => x.label && x.label !== 'UNK');
const pct = (n, d) => (d ? (100 * n / d).toFixed(1) + '%' : '—');

// ---- Engine ----
const eFalseMatch = lab.filter((x) => x.dec === 'MATCH' && x.label === 'DIFF');
const eMissedSame = lab.filter((x) => x.dec !== 'MATCH' && x.label === 'SAME');
const eBlockSame = lab.filter((x) => x.dec === 'NOT_MATCH' && x.label === 'SAME');
const eMatch = lab.filter((x) => x.dec === 'MATCH');

// ---- AI (chỉ ca đã hỏi) ----
const asked = lab.filter((x) => x.ai);
const answered = asked.filter((x) => x.ai !== 'UNCERTAIN');
const aiRight = answered.filter((x) => (x.ai === 'SAME_ENTITY' && x.label === 'SAME') || ((x.ai === 'DIFFERENT_ENTITY' || x.ai === 'RELATED_ENTITY') && x.label === 'DIFF'));
const aiFalseSame = asked.filter((x) => x.ai === 'SAME_ENTITY' && x.label === 'DIFF');
const aiHelped = asked.filter((x) => x.ai === 'SAME_ENTITY' && x.label === 'SAME' && x.dec !== 'MATCH');
const byCat = {};
for (const x of asked) {
  const c = byCat[x.cat] || (byCat[x.cat] = { n: 0, ans: 0, right: 0, falseSame: 0 });
  c.n++; if (x.ai !== 'UNCERTAIN') c.ans++;
  if (aiRight.includes(x)) c.right++; if (aiFalseSame.includes(x)) c.falseSame++;
}
const confBands = [[0.9, 1.01], [0.75, 0.9], [0, 0.75]].map(([lo, hi]) => {
  const s = answered.filter((x) => x.conf >= lo && x.conf < hi);
  return `| ${lo}–${hi > 1 ? 1 : hi} | ${s.length} | ${pct(s.filter((x) => aiRight.includes(x)).length, s.length)} |`;
});

const anon = makeAnonymizer();
const ex = (list, n) => list.slice(0, n).map((x) => `| ${anon(x.inv)} | ${anon(x.pay)} | ${x.dec}/${x.rule} | ${x.ai || '—'} ${x.ai ? '(' + x.conf + ')' : ''} | ${x.rawLabel} | ${x.cat} |`).join('\n') || '| (không có) | | | | | |';

const md = `# BeneMatch — Đánh giá trên dữ liệu GNOL (${today()})

> File này **đã ẩn danh** (phần tên riêng → X1, X2…; giữ loại hình, từ ngành, cấu trúc) — được phép gửi cho [CC]. File gán nhãn gốc giữ local.

## Quy mô
- Cặp tên trong file: **${items.length}** · đã gán nhãn (CUNG/KHAC/LIEN_QUAN): **${lab.length}** · KHONG_RO: ${items.filter((x) => x.label === 'UNK').length} · chưa gán: ${items.filter((x) => !x.label).length}
- Engine: KHỚP ${lab.filter((x) => x.dec === 'MATCH').length} · CẦN KIỂM TRA ${lab.filter((x) => x.dec === 'REVIEW').length} · KHÔNG KHỚP ${lab.filter((x) => x.dec === 'NOT_MATCH').length}

## Engine luật v${BM.ENGINE_VERSION}
| Chỉ số | Giá trị | Ý nghĩa |
|---|---|---|
| **Khớp nhầm** (engine KHỚP, nhãn khác pháp nhân) | **${eFalseMatch.length}** / ${eMatch.length} KHỚP (${pct(eFalseMatch.length, eMatch.length)}) | Phải = 0 — rủi ro chi sai người |
| Cùng pháp nhân nhưng engine không cho KHỚP | ${eMissedSame.length} / ${lab.filter((x) => x.label === 'SAME').length} (${pct(eMissedSame.length, lab.filter((x) => x.label === 'SAME').length)}) | Việc tay của cán bộ — AI giúp giảm |
| ...trong đó engine CHẶN | ${eBlockSame.length} | Ca AI nên gỡ nhiều nhất (tiếng Anh, viết tắt) |

## AI tư vấn (Dify · GPT-5)
| Chỉ số | Giá trị |
|---|---|
| Ca đã hỏi AI (có nhãn) | ${asked.length} |
| AI trả lời dứt khoát (không UNCERTAIN) | ${answered.length} (${pct(answered.length, asked.length)}) |
| **Độ đúng khi trả lời dứt khoát** | **${pct(aiRight.length, answered.length)}** |
| **AI nói CÙNG nhưng thực tế KHÁC** (nguy hiểm) | **${aiFalseSame.length}** (${pct(aiFalseSame.length, asked.length)}) |
| AI đúng "cùng pháp nhân" ở ca engine không cho KHỚP (tiết kiệm việc tay) | ${aiHelped.length} |

### Độ đúng theo độ tin của AI
| Độ tin | Số ca | Độ đúng |
|---|---|---|
${confBands.join('\n')}

### Theo nhóm ca khó
| Nhóm | Hỏi AI | Trả lời dứt khoát | Đúng | AI nói CÙNG sai |
|---|---|---|---|---|
${Object.entries(byCat).map(([k, c]) => `| ${k} | ${c.n} | ${c.ans} | ${pct(c.right, c.ans)} | ${c.falseSame} |`).join('\n') || '| — | | | | |'}

## Ca sai (ẩn danh)
### Engine khớp nhầm
| Tên HĐ | Tên UNC | Engine | AI | Nhãn | Nhóm |
|---|---|---|---|---|---|
${ex(eFalseMatch, 30)}

### AI nói CÙNG nhưng thực tế KHÁC
| Tên HĐ | Tên UNC | Engine | AI | Nhãn | Nhóm |
|---|---|---|---|---|---|
${ex(aiFalseSame, 30)}

### Engine chặn nhưng thực tế CÙNG (AI chưa gỡ được)
| Tên HĐ | Tên UNC | Engine | AI | Nhãn | Nhóm |
|---|---|---|---|---|---|
${ex(eBlockSame.filter((x) => x.ai !== 'SAME_ENTITY'), 30)}
`;
const file = join(dir, `BeneMatch_danh_gia_${today()}.md`);
writeFileSync(file, md, 'utf8');
console.log(md.split('## Ca sai')[0]);
console.log('✓ ' + file + '  ← gửi file này cho em (đã ẩn danh)');
