---
type: llm
weight: 1
---
Pass if ALL hold: (1) it says it will do the root-cause diagnosis itself rather than hand it to subagents; (2) it does not re-propose increasing the lock TTL; (3) it gives concrete hypotheses and a way to tell them apart by running something (reproduction, instrumentation, load test) — reading code first is fine as long as it does not stop there; (4) it says it will verify the fix by re-running the reproduction or tests. Fail if it gives only generic advice, delegates the diagnosis, or repeats the TTL idea.
