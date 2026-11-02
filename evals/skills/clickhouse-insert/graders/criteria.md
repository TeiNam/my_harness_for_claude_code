---
type: llm
weight: 1
---
Pass only if the insert sends rows as data (e.g. `@clickhouse/client` `insert({ table, values, format: 'JSONEachRow' })` or query parameters) and never builds the SQL by interpolating row values into a string.
