---
name: pdf
description: Generate, fill, merge, split, and extract from PDF files programmatically. Use when the user wants to create a PDF report/invoice/certificate, fill a PDF form, merge or split PDFs, extract text or tables, or convert to/from PDF. Covers pypdf, reportlab, and HTML→PDF.
origin: harness
workloads: [core]
---

# PDF

Pick the lightest tool that does the job. The ladder:

1. **Already have HTML/CSS?** → render it to PDF (best fidelity, least new code).
2. **Filling / merging / splitting / reading an existing PDF?** → `pypdf` (pure Python, no system deps).
3. **Generating a laid-out PDF from data?** → `reportlab` (precise) or HTML→PDF (faster to author).

## Read / extract

```python
from pypdf import PdfReader
reader = PdfReader("in.pdf")
text = "\n".join(page.extract_text() or "" for page in reader.pages)
```

`extract_text()` is fine for digital PDFs. For **scanned** PDFs it returns
empty — that's OCR territory (`ocrmypdf`
skill's OCR endpoint). Tables extract poorly with pypdf; use `pdfplumber` when
you need cell structure.

## Merge / split / rotate

```python
from pypdf import PdfReader, PdfWriter

w = PdfWriter()
for f in ("a.pdf", "b.pdf"):
    for page in PdfReader(f).pages:
        w.add_page(page)
with open("merged.pdf", "wb") as fh:
    w.write(fh)

# split: one file per page
src = PdfReader("in.pdf")
for i, page in enumerate(src.pages):
    w = PdfWriter(); w.add_page(page)
    with open(f"page_{i+1}.pdf", "wb") as fh:
        w.write(fh)
```

## Fill a form (AcroForm)

```python
from pypdf import PdfReader, PdfWriter
reader = PdfReader("form.pdf"); w = PdfWriter(); w.append(reader)
w.update_page_form_field_values(
    w.pages[0], {"full_name": "Jane Doe", "date": "2026-07-09"},
    auto_regenerate=False,
)
with open("filled.pdf", "wb") as fh:
    w.write(fh)
```

Field names are the internal names, not the visible labels — dump them first
with `reader.get_fields()`.

## Generate from HTML (recommended for reports/invoices)

Author the document in HTML/CSS (reuse the harness's frontend/design skills for
styling), then render. `weasyprint` is pure-Python-ish and handles CSS paged
media well:

```python
from weasyprint import HTML
HTML(string=html).write_pdf("report.pdf")   # or HTML("report.html")
```

Use `@page { size: A4; margin: 20mm }` and `page-break-before` in CSS for
pagination. For pixel-perfect / JS-driven pages, render with Playwright's
`page.pdf()` instead.

## Generate from scratch (reportlab)

When you need precise coordinate control (certificates, labels, tickets):

```python
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

c = canvas.Canvas("cert.pdf", pagesize=A4)
w, h = A4
c.setFont("Helvetica-Bold", 28)
c.drawCentredString(w/2, h-80*mm, "Certificate of Completion")
c.showPage()
c.save()
```

For flowing multi-page content (tables, paragraphs) use reportlab's
`platypus` (`SimpleDocTemplate` + `Table`/`Paragraph`) rather than raw canvas.

## Korean / CJK text

reportlab's built-in fonts have **no CJK glyphs** — register a Korean TTF or
Korean text renders blank:

```python
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
pdfmetrics.registerFont(TTFont("Pretendard", "/path/Pretendard-Regular.ttf"))
c.setFont("Pretendard", 12)
```

HTML→PDF (weasyprint/Playwright) handles Korean automatically if the font is
available to the renderer — usually the simpler path for Korean documents.

## Install

```bash
command -v uv >/dev/null || curl -LsSf https://astral.sh/uv/install.sh | sh
uv add pypdf reportlab            # core
uv add pdfplumber weasyprint      # tables / HTML→PDF (weasyprint needs system libs)
```

## Sanity check

```python
# ponytail: one runnable check — merge two 1-page PDFs, assert page count
from pypdf import PdfReader, PdfWriter
r = PdfReader("a.pdf")
assert len(PdfReader("merged.pdf").pages) == len(r.pages) + len(PdfReader("b.pdf").pages)
```

Related: `ppt-authoring` + `frontend-slides` (slides), `docx`, `xlsx`.
