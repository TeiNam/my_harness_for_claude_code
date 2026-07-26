---
name: docx
description: Generate and edit Microsoft Word (.docx) documents programmatically. Use when the user wants to produce a Word report, contract, letter, or templated document, do mail-merge-style fill, or read/modify existing .docx files. Covers python-docx and template-based generation.
origin: harness
workloads: [core]
---

# DOCX

`python-docx` reads and writes real Word files — no Word install, no COM. Reach
for a **template + fill** approach before building documents element-by-element:
it's less code and keeps styling in the hands of whoever owns the template.

## Template fill (recommended)

Author `template.docx` in Word with `{{placeholders}}`, then substitute. The
`docxtpl` library (Jinja2 over docx) is the clean way:

```python
from docxtpl import DocxTemplate
doc = DocxTemplate("template.docx")
doc.render({"client": "Acme", "date": "2026-07-09",
            "items": [{"name": "Widget", "qty": 3}]})   # supports {% for %} loops in the doc
doc.save("out.docx")
```

Loops/conditionals live in the template as `{% for item in items %}` — the
document's styling stays in the template, code just supplies data.

## Build from scratch (python-docx)

```python
from docx import Document
from docx.shared import Pt, Inches

doc = Document()
doc.add_heading("Quarterly Report", level=0)
doc.add_paragraph("Summary paragraph.")
p = doc.add_paragraph("Bold intro: ")
p.add_run("emphasis").bold = True

# table
t = doc.add_table(rows=1, cols=2); t.style = "Light Grid Accent 1"
t.rows[0].cells[0].text, t.rows[0].cells[1].text = "Metric", "Value"
row = t.add_row().cells
row[0].text, row[1].text = "Revenue", "$1.2M"

doc.add_page_break()
doc.save("report.docx")
```

## Read / modify existing

```python
from docx import Document
doc = Document("in.docx")
text = "\n".join(p.text for p in doc.paragraphs)
for p in doc.paragraphs:
    if "DRAFT" in p.text:
        for run in p.runs:
            run.text = run.text.replace("DRAFT", "FINAL")
doc.save("out.docx")
```

**Gotcha:** a single logical sentence is often split across multiple `runs`, so
`"old" in paragraph.text` can be true while no single `run.text` contains
`"old"` — naive per-run replace misses it. For reliable find/replace, prefer the
template approach, or join+rewrite at the paragraph level.

## Styling notes

- Use **named styles** (`doc.styles`) over hardcoded formatting so the document
  stays consistent and restyleable — same principle as CSS tokens.
- Set document defaults via the `Normal` style: `doc.styles["Normal"].font.name`
  and `.size`.
- **Korean/CJK:** set the East Asian font explicitly or Korean falls back to a
  default face. Set `rPr/rFonts w:eastAsia` (via the style's XML) to a Korean
  font like `맑은 고딕` / `Pretendard`.

## Convert to PDF

python-docx can't export PDF. Options: LibreOffice headless
(`soffice --headless --convert-to pdf out.docx`), the `docx2pdf` package
(needs Word/LibreOffice), or the `nutrient-document-processing` skill's convert
endpoint. See the `pdf` skill.

## Install

```bash
command -v uv >/dev/null || curl -LsSf https://astral.sh/uv/install.sh | sh
uv add python-docx docxtpl
```

## Sanity check

```python
# ponytail: round-trip — write a heading, reopen, assert it's there
from docx import Document
d = Document(); d.add_heading("X", level=1); d.save("t.docx")
assert Document("t.docx").paragraphs[0].text == "X"
```

Related: `pdf`, `xlsx`, `ppt-authoring`, `markdown-writing` (for prose you'll
then pour into a template).
