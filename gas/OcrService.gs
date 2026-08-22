/**
 * OcrService.gs — OCR hóa đơn (đường thật, guard bằng USE_OCR). Xem OCR_SPEC.md.
 * ocrInvoices_ chỉ được gọi khi USE_OCR=true; đường synthetic bỏ qua file này.
 * parseInvoiceText_ tách riêng, unit-test bằng gas/verify_ocr.mjs (text mẫu).
 * ⚠ Regex theo mẫu hóa đơn VAT VN — CẦN [TT] cấp ảnh mẫu để hiệu chỉnh.
 */

function ocrInvoices_(files, cfg, props) {
  var apiKey = props.getProperty('VISION_API_KEY');
  if (!apiKey) throw new Error('USE_OCR=true nhưng thiếu VISION_API_KEY');
  var out = [];
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    var vision = callVision_(f.data, f.mime, apiKey);   // {text, confidence}
    var inv = parseInvoiceText_(vision.text);
    inv.source_file = f.name || ('file_' + (i + 1));
    inv.ocr_confidence = vision.confidence;
    if (!inv.invoice_id) inv.invoice_id = 'OCR-' + String(i + 1).padStart(4, '0');
    out.push(inv);
  }
  return out;
}

/** Gọi Google Vision DOCUMENT_TEXT_DETECTION. base64 = nội dung file (không prefix). */
function callVision_(base64, mime, apiKey) {
  var res = UrlFetchApp.fetch('https://vision.googleapis.com/v1/images:annotate?key=' + encodeURIComponent(apiKey), {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({
      requests: [{ image: { content: base64 }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }], imageContext: { languageHints: ['vi', 'en'] } }],
    }),
  });
  var code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('Vision HTTP ' + code + ': ' + res.getContentText().slice(0, 300));
  var data = JSON.parse(res.getContentText());
  var r = data.responses && data.responses[0];
  var text = (r && r.fullTextAnnotation && r.fullTextAnnotation.text) || '';
  // Confidence trung bình các page (nếu có).
  var conf = 0, n = 0;
  if (r && r.fullTextAnnotation && r.fullTextAnnotation.pages) {
    r.fullTextAnnotation.pages.forEach(function (p) { if (typeof p.confidence === 'number') { conf += p.confidence; n++; } });
  }
  return { text: text, confidence: n ? conf / n : 0.9 };
}

/**
 * parseInvoiceText_(text) -> { beneficiary_name, beneficiary_mst, amount_total, invoice_id, invoice_date }
 * Heuristic theo nhãn hóa đơn VAT VN (song ngữ). KHÔNG tự sửa OCR (chỉ trích).
 */
function parseInvoiceText_(text) {
  var t = String(text || '').replace(/\r/g, '');
  var out = { beneficiary_name: '', beneficiary_mst: '', amount_total: 0, invoice_id: '', invoice_date: '' };

  // MST: gần nhãn "Mã số thuế" (ưu tiên), else số 10/13.
  var mst = t.match(/M[ãa]\s*s[ốo]\s*thu[ếe][^\d]{0,20}(\d{10}(?:\s*-\s*\d{3})?)/i);
  if (!mst) mst = t.match(/\b(\d{10}(?:-\d{3})?)\b/);
  if (mst) out.beneficiary_mst = mst[1].replace(/\s|-/g, '').length >= 10 ? mst[1].replace(/\s/g, '') : mst[1];

  // Số tiền: gần "Tổng cộng tiền thanh toán" / "Total payment" / "Tổng cộng".
  var amt = t.match(/(?:t[ổo]ng\s+c[ộo]ng\s+ti[ềe]n\s+thanh\s+to[áa]n|total\s+payment|t[ổo]ng\s+c[ộo]ng)[^\d]{0,30}([\d.,\s]{4,})/i);
  if (amt) { var digits = amt[1].replace(/[^\d]/g, ''); out.amount_total = digits ? parseInt(digits, 10) : 0; }

  // Số hóa đơn: nhãn "Số" / "No." (thường dạng 00001234 hoặc AA/24E-...).
  var no = t.match(/(?:s[ốo]\s*(?:h[óo]a\s*[đd][ơo]n)?|invoice\s*no\.?|no\.?)\s*[:.]?\s*([A-Z0-9][A-Z0-9/\-]{2,})/i);
  if (no) out.invoice_id = no[1].replace(/[.,;]+$/, '');

  // Ngày: "Ngày dd tháng mm năm yyyy" hoặc dd/mm/yyyy.
  var d1 = t.match(/Ng[àa]y\s*(\d{1,2})\s*th[áa]ng\s*(\d{1,2})\s*n[ăa]m\s*(\d{4})/i);
  if (d1) out.invoice_date = d1[3] + '-' + pad2_(d1[2]) + '-' + pad2_(d1[1]);
  else {
    var d2 = t.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})\b/);
    if (d2) out.invoice_date = d2[3] + '-' + pad2_(d2[2]) + '-' + pad2_(d2[1]);
  }

  // Tên bên bán/thụ hưởng: dòng sau nhãn "Đơn vị bán hàng/Tên đơn vị/Người bán".
  var nm = t.match(/(?:[ĐđDd][ơo]n\s*v[ịi]\s*b[áa]n\s*h[àa]ng|t[êe]n\s*[đd][ơo]n\s*v[ịi]|ng[ưu][ờo]i\s*b[áa]n)\s*[:.]?\s*(.+)/i);
  if (nm) out.beneficiary_name = nm[1].split('\n')[0].trim().replace(/\s{2,}/g, ' ');

  return out;
}

function pad2_(s) { s = String(s); return s.length < 2 ? '0' + s : s; }

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseInvoiceText_: parseInvoiceText_ };
}
