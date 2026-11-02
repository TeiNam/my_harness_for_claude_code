---
type: llm
weight: 1
---
Pass if the database part of the rollback is safe: it says to back up first, to generate or write a down SQL script and review it before applying, and either explains that `prisma migrate resolve --rolled-back` only records history (does not revert schema) or avoids presenting it as the rollback; and it asks the user to confirm the target revision/version or which migration to revert. Fail if it presents `migrate resolve` (or `migrate reset`) alone as the way to roll back.
