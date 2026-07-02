---
name: apple-swiftui
description: SwiftUI feature patterns — AlarmKit, WebKit embedding, rich text editing, customizable toolbars, and 3D charts. Use when implementing alarms/timers, embedding web content, rich text, toolbars, or 3D data visualization in SwiftUI.
allowed-tools: [Read, Glob, Grep, WebFetch]
origin: rshankras/claude-code-apple-skills
workloads: [apple]
---

# SwiftUI Feature Patterns

Aggregates specialized SwiftUI feature modules. Read the relevant module based on the user's need.

## Available Modules

### alarmkit/
AlarmKit integration for scheduling alarms and timers with custom UI, Live Activities, and snooze support (iOS 18+).

### charts-3d/
3D chart visualization with Swift Charts — `Chart3D`, `SurfacePlot`, interactive pose control, surface styling.

### text-editing/
Styled text display and rich text editing — `Text`, `AttributedString`, `TextEditor` with formatting controls.

### toolbars/
Modern toolbar patterns — customizable toolbars, search integration, transition effects, platform-specific behavior.

### webkit/
WebKit integration — `WebView` and `WebPage` for embedding web content, navigation, JavaScript interop.

## How to Use

1. Identify the feature area from the user's request
2. Read the relevant module's `SKILL.md`
3. Apply the guidance to their specific SwiftUI context
