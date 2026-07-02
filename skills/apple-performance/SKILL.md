---
name: apple-performance
description: Performance diagnosis for Apple platform apps — Instruments profiling (hangs, memory, slow launches, energy drain) and SwiftUI-specific re-render/view-identity debugging. Use when reviewing app performance or diagnosing why SwiftUI views are slow or re-rendering too often.
allowed-tools: [Read, Glob, Grep, WebFetch]
origin: rshankras/claude-code-apple-skills
workloads: [apple]
---

# Performance Diagnosis

Aggregates performance-focused modules for Apple platform apps.

## Available Modules

### profiling/
Instruments workflows — Time Profiler, Allocations, hangs, memory issues, slow launches, energy drain.

### swiftui-debugging/
SwiftUI re-render diagnosis — view identity, body re-evaluation, lazy loading, `_printChanges()`.

## How to Use

1. Identify whether the issue is general app performance or SwiftUI-specific rendering
2. Read the relevant module's `SKILL.md`
3. Apply the diagnostic workflow to the user's specific case
