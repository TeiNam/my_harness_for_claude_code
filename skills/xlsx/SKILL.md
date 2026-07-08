---
name: xlsx
description: Generate and edit Microsoft Excel (.xlsx) files programmatically — styled reports, dashboards, multi-sheet workbooks, formulas, charts. Use when the user wants an Excel export/report, to fill a spreadsheet template, or to read/modify .xlsx. Covers openpyxl and the pandas handoff.
origin: harness
workloads: [core]
---

# XLSX

Two tools, clear split:

- **Dumping a dataframe/table to Excel** → `pandas.to_excel` (one line).
- **Styled reports, formulas, charts, multi-sheet, editing existing files** →
  `openpyxl`.

Don't hand-roll cell-by-cell writing when you already have a DataFrame.

## Fast path: DataFrame → Excel

```python
import pandas as pd
with pd.ExcelWriter("report.xlsx", engine="openpyxl") as xl:
    df_sales.to_excel(xl, sheet_name="Sales", index=False)
    df_costs.to_excel(xl, sheet_name="Costs", index=False)
```

Then reopen with openpyxl if you need styling/formulas on top.

## openpyxl: build a styled report

```python
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

wb = Workbook(); ws = wb.active; ws.title = "Summary"

headers = ["Month", "Revenue", "Cost", "Margin"]
ws.append(headers)
for c in ws[1]:                      # style header row
    c.font = Font(bold=True, color="FFFFFF")
    c.fill = PatternFill("solid", fgColor="2F5597")
    c.alignment = Alignment(horizontal="center")

rows = [("Jan", 1200, 800), ("Feb", 1500, 900)]
for i, (m, rev, cost) in enumerate(rows, start=2):
    ws.append([m, rev, cost, None])
    ws.cell(i, 4).value = f"=B{i}-C{i}"        # live formula
    ws.cell(i, 2).number_format = '#,##0'
    ws.cell(i, 3).number_format = '#,##0'

ws.freeze_panes = "A2"                          # freeze header
for col in range(1, len(headers)+1):            # autosize-ish
    ws.column_dimensions[get_column_letter(col)].width = 14
wb.save("report.xlsx")
```

## Formulas, not precomputed values

Write `=SUM(B2:B13)` as a cell value — Excel evaluates on open. openpyxl does
**not** compute formula results itself, so if you read the file back with
`load_workbook(...)` the formula cell's `.value` is the formula string, not the
number. To read computed values, open with `data_only=True` (returns the last
value Excel cached — `None` if the file was never opened in Excel).

## Charts

```python
from openpyxl.chart import BarChart, Reference
chart = BarChart(); chart.title = "Revenue"
data = Reference(ws, min_col=2, min_row=1, max_row=3)
cats = Reference(ws, min_col=1, min_row=2, max_row=3)
chart.add_data(data, titles_from_data=True); chart.set_categories(cats)
ws.add_chart(chart, "F2")
```

## Read / edit existing

```python
from openpyxl import load_workbook
wb = load_workbook("in.xlsx")            # data_only=True for cached values
ws = wb["Sheet1"]
for row in ws.iter_rows(min_row=2, values_only=True):
    ...
wb.save("out.xlsx")
```

`load_workbook` preserves existing styling/formulas — good for filling a
template someone else designed.

## Gotchas

- **Large data** (100k+ rows): use `Workbook(write_only=True)` + `ws.append`
  to stream, or just use pandas — the styled cell API is slow at scale.
- **Dates**: assign `datetime` objects and set `number_format = 'yyyy-mm-dd'`;
  don't write pre-formatted strings or you lose sortability.
- **Korean text** works out of the box (xlsx is Unicode); only column width
  needs a bump for wide CJK glyphs.

## Install

```bash
pip install openpyxl pandas
```

## Sanity check

```python
# ponytail: formula round-trips as a formula, value as data_only
from openpyxl import Workbook, load_workbook
wb = Workbook(); ws = wb.active; ws["A1"] = 2; ws["A2"] = "=A1*3"; wb.save("t.xlsx")
assert load_workbook("t.xlsx")["Sheet"]["A2"].value == "=A1*3"
```

Related: `python-data-analysis` (pandas/polars/duckdb before the Excel step),
`pdf`, `docx`, `dashboard-builder`.
