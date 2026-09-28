"""
build_advisor_dsl.py — sinh DSL Dify cho workflow "BeneMatch Name Advisor v3" (LLM tư vấn, không quyết định).
Chạy: PYTHONUTF8=1 python dify/build_advisor_dsl.py → 2 bản (import vào Dify Cloud):
  - dify/BeneMatch_Name_Advisor_v3.yml        — BẢN CHÍNH: Gemini 3.8 Flash ([TT] chốt 2026-09-28; key Gemini TRẢ PHÍ)
  - dify/BeneMatch_Name_Advisor_v3_gpt5.yml   — dự phòng: GPT-5 (OpenAI)
Khung (app/dependencies/features) lấy từ workflow V2 để đúng định dạng import của workspace hiện tại.
Nguồn chuẩn của prompt/schema/guard: file này (+ BM.advisor.guard trong src/engine/bm-engine.js — cùng logic).
"""
import copy, os, yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V2 = os.path.join(ROOT, 'Beneficiary Legal Entity Verification V2.yml')
VARIANTS = [
    # Gemini 3.8 Flash: bỏ hẳn temperature/top_p/top_k; thinking mặc định MEDIUM (giữ theo [TT]) → completion_params rỗng.
    # Schema bỏ additionalProperties (Gemini response schema hay từ chối) — lớp gác vẫn lọc trường thừa.
    # dependencies để trống: cài/cập nhật plugin Gemini trên workspace trước khi import (bản có gemini-3.8-flash).
    {'file': 'BeneMatch_Name_Advisor_v3.yml', 'label': 'gemini-3.8-flash', 'title': 'Gemini 3.8 Flash',
     'model': {'completion_params': {}, 'mode': 'chat', 'name': 'gemini-3.8-flash', 'provider': 'langgenius/gemini/google'},
     'strict_schema': False, 'keep_dependencies': False},
    # GPT-5: chỉ nhận temperature mặc định → KHÔNG đặt temperature (V2 đặt 0.7 — một nguyên nhân FALLBACK).
    {'file': 'BeneMatch_Name_Advisor_v3_gpt5.yml', 'label': 'gpt-5', 'title': 'GPT-5',
     'model': {'completion_params': {}, 'mode': 'chat', 'name': 'gpt-5', 'provider': 'langgenius/openai/openai'},
     'strict_schema': True, 'keep_dependencies': True},
]

base = yaml.safe_load(open(V2, encoding='utf-8'))

START, LLM, GUARD, END = '1790000000001', '1790000000002', '1790000000003', '1790000000004'

def var(name, label, required=False, typ='text-input', maxlen=300):
    return {'default': '', 'hint': '', 'label': label, 'max_length': maxlen, 'options': [], 'placeholder': '',
            'required': required, 'type': typ, 'variable': name}

start_vars = [
    var('invoice_name', 'Tên bên bán trên hóa đơn', True),
    var('payment_name', 'Tên người thụ hưởng trên UNC', True),
    var('engine_decision', 'Kết luận engine (MATCH/REVIEW/NOT_MATCH)', maxlen=20),
    var('engine_reason', 'Mã luật engine', maxlen=60),
    var('engine_explanation', 'Diễn giải engine', typ='paragraph', maxlen=400),
    var('engine_score', 'Độ tương đồng kỹ thuật %', maxlen=5),
    var('invoice_legal', 'Họ loại hình hóa đơn', maxlen=20),
    var('payment_legal', 'Họ loại hình UNC', maxlen=20),
    var('invoice_core', 'Tên lõi hóa đơn', maxlen=200),
    var('payment_core', 'Tên lõi UNC', maxlen=200),
]

SYSTEM = """Bạn là chuyên gia thẩm định tên pháp nhân doanh nghiệp Việt Nam, hỗ trợ cán bộ ngân hàng kiểm tra NGƯỜI THỤ HƯỞNG trước khi giải ngân theo hóa đơn.
Nhiệm vụ: đánh giá TÊN BÊN BÁN trên hóa đơn và TÊN NGƯỜI THỤ HƯỞNG trên lệnh chuyển tiền (UNC) có cùng một pháp nhân hay không.

Ý kiến của bạn CHỈ ĐỂ THAM KHẢO. Kết luận chính thức do engine luật của ngân hàng quyết định; bạn không thay đổi kết luận đó.

Kiến thức cần áp dụng:
- Loại hình pháp nhân: Công ty TNHH (gồm TNHH MTV/2TV), Công ty cổ phần (CTCP, JSC), Doanh nghiệp tư nhân, Hợp tác xã, Công ty hợp danh, Hộ kinh doanh. KHÁC loại hình (vd TNHH ≠ Cổ phần) ⇒ LUÔN là hai pháp nhân khác nhau.
- Tên tiếng Anh/tên giao dịch có thể là bản dịch nghĩa của tên riêng (vd "Sao Việt" ↔ "Vietstar", "Ánh Dương" ↔ "Sunshine"); từ ngành nghề (Thương mại=Trading, Dịch vụ=Services, Xây dựng=Construction, Thực phẩm=Foods, Vận tải biển=Shipping…) không phải tên riêng.
- Viết tắt/tên thương hiệu thường ghép chữ cái đầu của phần tên (vd "An Phát Technical Services" → APTS). Viết tắt ≤ 3 chữ cái rất mơ hồ.
- Tổng công ty / Tập đoàn ↔ công ty con, công ty "số 3", công ty "miền Bắc"… là CÁC PHÁP NHÂN KHÁC NHAU dù tên gần giống ⇒ RELATED_ENTITY.
- Chi nhánh, văn phòng đại diện, địa điểm kinh doanh thuộc cùng pháp nhân với công ty mẹ ⇒ SAME_ENTITY, relation BRANCH.
- Hộ kinh doanh có thể nhận tiền vào tài khoản cá nhân của chủ hộ (cùng họ tên).
- Thêm/bớt một chữ trong PHẦN TÊN RIÊNG (vd "Hoàng Gia" ↔ "Hoàng Gia Phát") thường là doanh nghiệp khác. Khác số hiệu (số 1 ↔ số 7) là doanh nghiệp khác.
- Lỗi OCR hay gặp: O↔0, I/L↔1, E↔F, mất dấu; tên trên UNC thường không dấu, viết hoa, có thể bị cắt cụt.
- Bạn KHÔNG có dữ liệu đăng ký kinh doanh: không được khẳng định doanh nghiệp đã đổi tên; nếu nghi đổi tên ⇒ UNCERTAIN, relation RENAMED.

Nguyên tắc an toàn: nhầm "cùng pháp nhân" gây chuyển tiền sai người — nghiêm trọng hơn nhiều so với báo "chưa đủ căn cứ". Chỉ trả SAME_ENTITY khi có căn cứ rõ ràng; phân vân ⇒ UNCERTAIN.

Trả về JSON đúng schema:
- verdict: SAME_ENTITY | DIFFERENT_ENTITY | RELATED_ENTITY | UNCERTAIN
- relation: IDENTICAL | ABBREVIATION | TRANSLATION | TRANSLITERATION | TRUNCATION | TYPO_OCR | BRANCH | PARENT_SUBSIDIARY | RENAMED | UNRELATED | UNKNOWN
- confidence: số 0..1 (mức chắc chắn của verdict)
- evidence: tối đa 4 căn cứ ngắn, cụ thể (chỉ ra từ nào tương ứng từ nào)
- explanation: 1–3 câu tiếng Việt cho cán bộ
- checks_for_officer: tối đa 3 việc cán bộ cần kiểm tra thêm (vd đối chiếu tên chủ tài khoản, MST, giấy ĐKKD)"""

USER = ("Tên bên bán trên HÓA ĐƠN: {{#" + START + ".invoice_name#}}\n"
        "Tên người thụ hưởng trên UNC: {{#" + START + ".payment_name#}}\n\n"
        "Kết quả engine luật (tham khảo): {{#" + START + ".engine_decision#}} — mã {{#" + START + ".engine_reason#}} — độ tương đồng kỹ thuật {{#" + START + ".engine_score#}}%\n"
        "Diễn giải engine: {{#" + START + ".engine_explanation#}}\n"
        "Loại hình (họ): hóa đơn = {{#" + START + ".invoice_legal#}}; UNC = {{#" + START + ".payment_legal#}}\n"
        "Tên lõi sau chuẩn hóa: hóa đơn = {{#" + START + ".invoice_core#}}; UNC = {{#" + START + ".payment_core#}}\n\n"
        "Đánh giá hai tên và trả JSON theo schema.")

SCHEMA = {
    'type': 'object', 'additionalProperties': False,
    'required': ['verdict', 'relation', 'confidence', 'evidence', 'explanation', 'checks_for_officer'],
    'properties': {
        'verdict': {'type': 'string', 'enum': ['SAME_ENTITY', 'DIFFERENT_ENTITY', 'RELATED_ENTITY', 'UNCERTAIN']},
        'relation': {'type': 'string', 'enum': ['IDENTICAL', 'ABBREVIATION', 'TRANSLATION', 'TRANSLITERATION', 'TRUNCATION', 'TYPO_OCR',
                                                'BRANCH', 'PARENT_SUBSIDIARY', 'RENAMED', 'UNRELATED', 'UNKNOWN']},
        'confidence': {'type': 'number'},
        'evidence': {'type': 'array', 'items': {'type': 'string'}, 'maxItems': 4},
        'explanation': {'type': 'string'},
        'checks_for_officer': {'type': 'array', 'items': {'type': 'string'}, 'maxItems': 3},
    },
}

GUARD_CODE = '''import json

VERDICTS = ["SAME_ENTITY", "DIFFERENT_ENTITY", "RELATED_ENTITY", "UNCERTAIN"]
RELATIONS = ["IDENTICAL", "ABBREVIATION", "TRANSLATION", "TRANSLITERATION", "TRUNCATION", "TYPO_OCR",
             "BRANCH", "PARENT_SUBSIDIARY", "RENAMED", "UNRELATED", "UNKNOWN"]


def _parse(structured, text):
    if isinstance(structured, dict) and structured.get("verdict"):
        return structured
    t = (text or "").strip()
    if "{" in t and "}" in t:
        try:
            return json.loads(t[t.index("{"): t.rindex("}") + 1])
        except Exception:
            return None
    return None


def main(structured: dict, text: str, invoice_legal: str, payment_legal: str) -> dict:
    a = _parse(structured, text)
    ok = isinstance(a, dict) and a.get("verdict") in VERDICTS
    a = a if isinstance(a, dict) else {}
    verdict = a.get("verdict") if a.get("verdict") in VERDICTS else "UNCERTAIN"
    relation = a.get("relation") if a.get("relation") in RELATIONS else "UNKNOWN"
    try:
        conf = max(0.0, min(1.0, float(a.get("confidence", 0))))
    except Exception:
        conf = 0.0
    notes = []
    fi, fp = (invoice_legal or "UNKNOWN"), (payment_legal or "UNKNOWN")
    if verdict == "SAME_ENTITY" and fi != "UNKNOWN" and fp != "UNKNOWN" and fi != fp:
        verdict, conf = "UNCERTAIN", min(conf, 0.5)
        notes.append("Khác loại hình pháp nhân — luật cứng.")
    if verdict == "SAME_ENTITY" and relation == "PARENT_SUBSIDIARY":
        verdict = "RELATED_ENTITY"
        notes.append("Mẹ ↔ con là hai pháp nhân khác nhau.")

    def arr(x, n):
        return [str(s)[:300] for s in (x if isinstance(x, list) else []) if s][:n]

    return {"result": {
        "ai_status": "OK" if ok else "FALLBACK",
        "verdict": verdict, "relation": relation, "confidence": round(conf, 2),
        "evidence": arr(a.get("evidence"), 4),
        "explanation": str(a.get("explanation", ""))[:800],
        "checks_for_officer": arr(a.get("checks_for_officer"), 3),
        "guard_notes": notes, "model": "__MODEL_LABEL__", "used_for_decision": False,
    }}
'''

def node(nid, data, x, y, h=90):
    return {'data': data, 'height': h, 'id': nid, 'position': {'x': x, 'y': y}, 'positionAbsolute': {'x': x, 'y': y},
            'selected': False, 'sourcePosition': 'right', 'targetPosition': 'left', 'type': 'custom', 'width': 244, 'zIndex': 0}

def edge(a, b, st, tt):
    return {'data': {'isInIteration': False, 'isInLoop': False, 'sourceType': st, 'targetType': tt},
            'id': f'{a}-source-{b}-target', 'source': a, 'sourceHandle': 'source', 'target': b, 'targetHandle': 'target',
            'type': 'custom', 'zIndex': 0}

def build(v):
    schema = copy.deepcopy(SCHEMA)
    if not v['strict_schema']:
        schema.pop('additionalProperties', None)
    nodes = [
        node(START, {'selected': False, 'title': 'START', 'type': 'start', 'variables': start_vars}, 0, 0, 380),
        node(LLM, {
            'context': {'enabled': False, 'variable_selector': []},
            'model': copy.deepcopy(v['model']),
            'prompt_config': {'jinja2_variables': []},
            'prompt_template': [
                {'id': 'a1b2c3d4-0001-4000-8000-000000000001', 'role': 'system', 'text': SYSTEM},
                {'id': 'a1b2c3d4-0002-4000-8000-000000000002', 'role': 'user', 'text': USER},
            ],
            'selected': False, 'structured_output': {'schema': schema}, 'structured_output_enabled': True,
            'title': 'LLM Name Advisor (' + v['title'] + ')', 'type': 'llm', 'vision': {'enabled': False},
        }, 340, 0),
        node(GUARD, {
            'code': GUARD_CODE.replace('__MODEL_LABEL__', v['label']), 'code_language': 'python3',
            'outputs': {'result': {'children': None, 'type': 'object'}},
            'selected': False, 'title': 'Validate & Guard', 'type': 'code',
            'variables': [
                {'value_selector': [LLM, 'structured_output'], 'value_type': 'object', 'variable': 'structured'},
                {'value_selector': [LLM, 'text'], 'value_type': 'string', 'variable': 'text'},
                {'value_selector': [START, 'invoice_legal'], 'value_type': 'string', 'variable': 'invoice_legal'},
                {'value_selector': [START, 'payment_legal'], 'value_type': 'string', 'variable': 'payment_legal'},
            ],
        }, 680, 0),
        node(END, {'outputs': [{'value_selector': [GUARD, 'result'], 'value_type': 'object', 'variable': 'result'}],
                   'selected': False, 'title': 'Output', 'type': 'end'}, 1020, 0),
    ]
    edges = [edge(START, LLM, 'start', 'llm'), edge(LLM, GUARD, 'llm', 'code'), edge(GUARD, END, 'code', 'end')]
    dsl = copy.deepcopy(base)
    dsl['app']['name'] = 'BeneMatch Name Advisor v3 (' + v['title'] + ')'
    dsl['app']['description'] = 'LLM tư vấn nhận diện tên pháp nhân (tham khảo, không quyết định) cho ca CẦN KIỂM TRA / khác biệt mềm của engine BeneMatch v3. Model: ' + v['title'] + '.'
    dsl['app']['icon'] = '🧭'
    if not v['keep_dependencies']:
        dsl['dependencies'] = []
    dsl['workflow']['graph']['nodes'] = nodes
    dsl['workflow']['graph']['edges'] = edges
    dsl['workflow']['graph']['viewport'] = {'x': 60, 'y': 200, 'zoom': 0.8}
    out = os.path.join(ROOT, 'dify', v['file'])
    with open(out, 'w', encoding='utf-8', newline='\n') as f:
        yaml.safe_dump(dsl, f, allow_unicode=True, sort_keys=False, width=100000)
    print('✓', out, '—', v['title'])


for v in VARIANTS:
    build(v)
