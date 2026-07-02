# Liquid Glass Design System

Modern design language for macOS 26 (Tahoe), iOS 26, and iPadOS 26.

> **Note:** For the new `.glassEffect()` API introduced in iOS/macOS 26, see the updated skill at `skills/apple-design/liquid-glass/SKILL.md` which covers GlassEffectContainer, morphing transitions, and interactive effects.

## Core Principles

### 1. Transparency and Depth

Liquid Glass uses transparency to create visual hierarchy and depth.

```swift
// PASS: GOOD: Transparent background with blur
struct ContentView: View {
    var body: some View {
        ZStack {
            // Background content
            Image("background")
                .resizable()
                .ignoresSafeArea()

            // Foreground panel with Liquid Glass effect
            VStack {
                Text("Content")
                    .font(.largeTitle)
            }
            .padding()
            .background(.ultraThinMaterial)  // Liquid Glass material
            .cornerRadius(20)
            .shadow(radius: 10)
        }
    }
}

// FAIL: BAD: Opaque solid colors (old style)
VStack {
    Text("Content")
}
.background(Color.white)  // Not Liquid Glass
```

### 2. Menu Bar Transparency

macOS Tahoe features a fully transparent menu bar with subtle drop shadow.

```swift
// PASS: GOOD: App embracing transparent menu bar
@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .windowStyle(.hiddenTitleBar)  // Clean integration
        .windowToolbarStyle(.unified)
    }
}

struct ContentView: View {
    var body: some View {
        NavigationSplitView {
            // Sidebar
        } detail: {
            // Main content that flows under menu bar
            ScrollView {
                // Content
            }
            .ignoresSafeArea(edges: .top)  // Extend under menu bar
        }
    }
}

// WARNING: Ensure content doesn't clash with menu bar
// Add proper padding for interactive elements
```

### 3. Materials and Vibrancy

Use system materials for platform consistency.

```swift
// PASS: GOOD: System materials
.background(.regularMaterial)    // Standard material
.background(.thickMaterial)      // More opaque
.background(.thinMaterial)       // More transparent
.background(.ultraThinMaterial)  // Highly transparent

// PASS: GOOD: Adaptive materials (respect appearance)
.background(.bar)         // For toolbars and bars
.background(.sidebar)     // For sidebar backgrounds
.background(.selection)   // For selected items

// FAIL: BAD: Hardcoded colors
.background(Color(red: 0.9, green: 0.9, blue: 0.9))
```

### 4. Visual Hierarchy

Create clear hierarchy through depth, size, and contrast.

```swift
// PASS: GOOD: Clear hierarchy
struct DashboardView: View {
    var body: some View {
        VStack(spacing: 20) {
            // Primary card - most prominent
            PrimaryCard()
                .shadow(radius: 12)
                .zIndex(2)

            // Secondary cards - less prominent
            HStack {
                SecondaryCard()
                    .shadow(radius: 6)

                SecondaryCard()
                    .shadow(radius: 6)
            }
            .zIndex(1)

            // Background elements - least prominent
            BackgroundInfo()
                .opacity(0.7)
        }
    }
}
```

## Redesigned Folder Icons

macOS Tahoe features customizable folder icons.

```swift
// PASS: Using custom folder colors
// In Finder: Right-click → Get Info → Icon customization

// SwiftUI file icon display
struct FileIcon: View {
    let file: File

    var body: some View {
        Image(systemName: file.iconName)
            .symbolRenderingMode(.multicolor)  // Use SF Symbols multicolor
            .font(.system(size: 64))
            .foregroundStyle(file.accentColor)  // Respect accent color
    }
}

// Folder icons can now:
// - Have custom colors
// - Include custom emblems
// - Display emoji overlays
// - Respect system accent color
```

## Redesigned Control Center

Control Center follows Liquid Glass design with modular cards.

```swift
// PASS: GOOD: Control Center-style cards
struct ControlCard: View {
    let title: String
    let icon: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.title)
                    .symbolRenderingMode(.hierarchical)

                Text(title)
                    .font(.caption)
            }
            .frame(width: 100, height: 100)
            .background(.ultraThinMaterial)
            .cornerRadius(16)
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(.white.opacity(0.2), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

// Usage - Grid of control cards
LazyVGrid(columns: [GridItem(.adaptive(minimum: 100))]) {
    ControlCard(title: "Wi-Fi", icon: "wifi") { }
    ControlCard(title: "Bluetooth", icon: "bluetooth") { }
    ControlCard(title: "AirDrop", icon: "airplayaudio") { }
}
```

## Animation Guidelines

Liquid Glass emphasizes smooth, fluid animations.

```swift
// PASS: GOOD: Smooth spring animations
.animation(.spring(response: 0.3, dampingFraction: 0.8), value: isExpanded)

// PASS: GOOD: Interpolating spring for natural motion
.animation(.interactiveSpring(response: 0.3, dampingFraction: 0.7), value: offset)

// PASS: GOOD: Easing for simple transitions
.animation(.easeInOut(duration: 0.2), value: isVisible)

// FAIL: BAD: Abrupt linear animations
.animation(.linear, value: isExpanded)

// FAIL: BAD: Too long or too bouncy
.animation(.spring(response: 2.0, dampingFraction: 0.3), value: isExpanded)
```

### Common Animation Patterns

```swift
// PASS: GOOD: Card expansion
struct ExpandableCard: View {
    @State private var isExpanded = false

    var body: some View {
        VStack {
            Text("Title")
            if isExpanded {
                Text("Details")
                    .transition(.asymmetric(
                        insertion: .scale.combined(with: .opacity),
                        removal: .opacity
                    ))
            }
        }
        .frame(maxWidth: isExpanded ? .infinity : 200)
        .background(.ultraThinMaterial)
        .cornerRadius(16)
        .animation(.spring(response: 0.4, dampingFraction: 0.8), value: isExpanded)
        .onTapGesture {
            isExpanded.toggle()
        }
    }
}

// PASS: GOOD: List item appearance
.transition(.move(edge: .trailing).combined(with: .opacity))

// PASS: GOOD: Modal presentation
.transition(.asymmetric(
    insertion: .scale(scale: 0.9).combined(with: .opacity),
    removal: .opacity
))
```

## Color and Theming

### Adaptive Colors

```swift
// PASS: GOOD: Semantic colors (adapt to light/dark mode)
.foregroundStyle(.primary)      // Primary text
.foregroundStyle(.secondary)    // Secondary text
.foregroundStyle(.tertiary)     // Tertiary text

// PASS: GOOD: Accent color
.foregroundStyle(.tint)         // System accent color
.tint(.blue)                    // Custom accent

// PASS: GOOD: Semantic backgrounds
.background(.background)
.background(.secondaryBackground)

// FAIL: BAD: Hardcoded colors that don't adapt
.foregroundColor(.black)        // Won't adapt to dark mode
.background(Color.white)
```

### Vibrancy Effects

```swift
// PASS: GOOD: Vibrancy for content over materials
struct GlassCard: View {
    var body: some View {
        VStack {
            Text("Title")
                .font(.headline)
                .foregroundStyle(.primary)

            Text("Subtitle")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding()
        .background(.regularMaterial)
        .backgroundStyle(.blue)  // Tint the material
        .cornerRadius(16)
    }
}
```

## Depth and Shadows

```swift
// PASS: GOOD: Subtle shadows for depth
.shadow(color: .black.opacity(0.1), radius: 8, y: 4)

// PASS: GOOD: Layered shadows for cards
.shadow(color: .black.opacity(0.05), radius: 2, y: 1)
.shadow(color: .black.opacity(0.1), radius: 12, y: 6)

// FAIL: BAD: Heavy shadows (outdated style)
.shadow(color: .black.opacity(0.5), radius: 20)

// FAIL: BAD: No shadow on floating elements
// Cards and panels should have subtle shadows for depth
```

## Glass Morphism Effects

```swift
// PASS: GOOD: Full glass morphism card
struct GlassMorphCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "star.fill")
                    .foregroundStyle(.yellow)
                Text("Featured")
                    .font(.headline)
            }

            Text("Content goes here")
                .font(.body)
                .foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity)
        .background(.ultraThinMaterial)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(.white.opacity(0.2), lineWidth: 1)
        )
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.1), radius: 10, y: 5)
    }
}
```

## Liquid Glass Checklist

- [ ] Use system materials (.ultraThinMaterial, .regularMaterial, etc.)
- [ ] Embrace transparent menu bar design
- [ ] Apply subtle shadows for depth hierarchy
- [ ] Use smooth spring animations
- [ ] Support light and dark modes with semantic colors
- [ ] Create visual hierarchy through depth and transparency
- [ ] Use vibrancy for content over materials
- [ ] Follow Control Center card design patterns (if applicable)
- [ ] Support customizable folder icons (if file management)
- [ ] Ensure smooth 60fps animations

## macOS 26 Tahoe Specific

- Menu bar is fully transparent by default
- Control Center redesigned with modular cards
- Folder icons support custom colors and emblems
- Liquid Glass materials are primary design element
- Smooth animations are expected throughout
- Depth through transparency, not heavy shadows

## Resources

- [Apple Design Resources](https://developer.apple.com/design/resources/)
- [macOS Tahoe HIG](https://developer.apple.com/design/human-interface-guidelines/macos)
- [WWDC 2025: Design for macOS Tahoe](https://developer.apple.com/videos/)
