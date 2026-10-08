# -*- coding: utf-8 -*-
"""Sinh fixtures "PDF scan" GIẢ LẬP cho kiểm OCR offline (tools/dev/ui_smoke.mjs) từ test/fixtures/hddt_synth.pdf:
  test/fixtures/hddt_synth_scan.png          — ảnh chụp trang 1 (200 dpi)
  test/fixtures/hddt_synth_scan.pdf          — PDF chỉ có ảnh (không lớp chữ) → buộc OCR
  test/fixtures/hddt_synth_scan_xoay90.pdf   — như trên nhưng trang bị xoay 90° (kiểm tự xoay)
Chạy: PYTHONUTF8=1 python tools/dev/make_scan_fixtures.py   (cần pymupdf + pillow)
"""
import io
from pathlib import Path

import pymupdf
from PIL import Image

FX = Path(__file__).resolve().parents[2] / "test" / "fixtures"
src = pymupdf.open(FX / "hddt_synth.pdf")
pix = src[0].get_pixmap(dpi=200)
img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("L")
img.save(FX / "hddt_synth_scan.png", optimize=True)


def jpeg(im):
    b = io.BytesIO()
    im.save(b, "JPEG", quality=80)
    return b.getvalue()


for name, im in (("hddt_synth_scan.pdf", img), ("hddt_synth_scan_xoay90.pdf", img.rotate(-90, expand=True))):
    out = pymupdf.open()
    w, h = im.size
    pg = out.new_page(width=w * 72 / 200, height=h * 72 / 200)
    pg.insert_image(pg.rect, stream=jpeg(im))
    out.save(FX / name, deflate=True, garbage=4)
    print(name, round((FX / name).stat().st_size / 1024), "KB")
