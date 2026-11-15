---
type: llm
weight: 1
---
Pass only if it advises against simply retrying the same way and recommends escalating to Fable with a concrete route: switch the session model (ideally a fresh session) with a handoff summary of what was tried and why it failed, or one self-contained Agent call with the fable model. Mentioning a cross-family second opinion (Codex) in addition is fine. Fail if it only suggests retrying Opus, or names Fable with no route or handoff.
