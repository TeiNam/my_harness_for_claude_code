# SwiftUI for macOS Best Practices

macOS-specific SwiftUI patterns, modifiers, and known Tahoe issues.

## macOS-Specific Views

### NavigationSplitView

```swift
// PASS: GOOD: Sidebar layout for macOS
struct ContentView: View {
    @State private var selection: Item?

    var body: some View {
        NavigationSplitView {
            // Sidebar
            List(items, selection: $selection) { item in
                NavigationLink(value: item) {
                    Label(item.name, systemImage: item.icon)
                }
            }
            .navigationSplitViewColumnWidth(min: 200, ideal: 250, max: 300)
        } detail: {
            // Detail
            if let item = selection {
                ItemDetailView(item: item)
            } else {
                ContentUnavailableView("Select an Item", systemImage: "doc")
            }
        }
        .navigationSplitViewStyle(.balanced)
    }
}
```

### Table View

```swift
// PASS: GOOD: Native Table view
struct DocumentsTable: View {
    @State private var documents: [Document]
    @State private var selection = Set<Document.ID>()
    @State private var sortOrder = [KeyPathComparator(\Document.name)]

    var body: some View {
        Table(documents, selection: $selection, sortOrder: $sortOrder) {
            TableColumn("Name", value: \.name) { document in
                HStack {
                    Image(systemName: document.icon)
                    Text(document.name)
                }
            }

            TableColumn("Modified", value: \.modifiedDate) { document in
                Text(document.modifiedDate, style: .date)
            }
            .width(min: 100, ideal: 150)

            TableColumn("Size", value: \.size) { document in
                Text(document.size, format: .byteCount(style: .file))
            }
            .width(ideal: 100)
        }
        .onChange(of: sortOrder) {
            documents.sort(using: sortOrder)
        }
    }
}
```

## macOS-Specific Modifiers

### Context Menus

```swift
// PASS: GOOD: Rich context menus
.contextMenu {
    Button("Open") {
        openItem()
    }
    Button("Open in New Window") {
        openInNewWindow()
    }

    Divider()

    Button("Rename") {
        startRename()
    }
    Button("Duplicate") {
        duplicateItem()
    }

    Divider()

    Menu("Share") {
        ShareLink(item: shareableItem)
    }

    Divider()

    Button("Delete", role: .destructive) {
        deleteItem()
    }
}
```

### Help Tags (Tooltips)

```swift
// PASS: GOOD: Helpful tooltips
Button(action: save) {
    Image(systemName: "square.and.arrow.down")
}
.help("Save document")  // Tooltip on hover

Toggle("Enable feature", isOn: $isEnabled)
    .help("This feature improves performance by...")
```

### Focus Management

```swift
// PASS: GOOD: Keyboard focus handling
struct LoginView: View {
    @FocusState private var focusedField: Field?

    enum Field: Hashable {
        case username
        case password
    }

    var body: some View {
        Form {
            TextField("Username", text: $username)
                .focused($focusedField, equals: .username)

            SecureField("Password", text: $password)
                .focused($focusedField, equals: .password)
                .onSubmit {
                    login()
                }
        }
        .onAppear {
            focusedField = .username
        }
    }
}
```

## Known macOS Tahoe SwiftUI Issues

### Layout Bugs

```swift
// WARNING: ISSUE: SwiftUI layout broken in some cases on Tahoe
// Workaround: Use explicit frames and spacing

// FAIL: May break on Tahoe
VStack {
    Text("Title")
    Text("Subtitle")
}
.frame(maxWidth: .infinity)

// PASS: WORKAROUND: Be explicit
VStack(spacing: 8) {
    Text("Title")
        .frame(maxWidth: .infinity, alignment: .leading)
    Text("Subtitle")
        .frame(maxWidth: .infinity, alignment: .leading)
}
.fixedSize(horizontal: false, vertical: true)
```

### NSHostingView Animation Issues

```swift
// WARNING: ISSUE: Frame changes don't animate smoothly in NSHostingView
// Workaround: Use explicit animation timing

// FAIL: May not animate smoothly
.frame(width: isExpanded ? 300 : 100)
.animation(.default, value: isExpanded)

// PASS: WORKAROUND: Use specific timing
.frame(width: isExpanded ? 300 : 100)
.animation(.easeInOut(duration: 0.2), value: isExpanded)

// Or avoid NSHostingView for animated content
// Use pure SwiftUI windows instead
```

### Transparency Issues

```swift
// WARNING: ISSUE: Some transparency effects may not render correctly
// Workaround: Test on actual macOS Tahoe

// PASS: GOOD: Use tested materials
.background(.regularMaterial)
.background(.ultraThinMaterial)

// WARNING: Test custom transparency
.background(Color.white.opacity(0.5))  // May not work as expected
```

## Window Management

### Custom Windows

```swift
// PASS: GOOD: Create auxiliary windows
@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }

        // Inspector window
        Window("Inspector", id: "inspector") {
            InspectorView()
        }
        .defaultSize(width: 300, height: 600)
        .windowResizability(.contentSize)

        // Preferences
        Settings {
            SettingsView()
        }
    }
}

// Open window from code
@Environment(\.openWindow) var openWindow

Button("Show Inspector") {
    openWindow(id: "inspector")
}
```

### Window Toolbar Customization

```swift
// PASS: GOOD: Unified toolbar style
.windowStyle(.hiddenTitleBar)
.windowToolbarStyle(.unified)

// PASS: GOOD: Expanded toolbar
.windowToolbarStyle(.expanded)

// PASS: GOOD: Automatic based on content
.windowToolbarStyle(.automatic)
```

## Menus and Commands

### MenuBarExtra

```swift
// PASS: GOOD: Menu bar app
@main
struct MenuBarApp: App {
    var body: some Scene {
        MenuBarExtra("My App", systemImage: "star.fill") {
            Button("Action 1") {
                // Action
            }

            Button("Action 2") {
                // Action
            }

            Divider()

            Button("Quit") {
                NSApplication.shared.terminate(nil)
            }
            .keyboardShortcut("q")
        }
    }
}
```

### Context Menu for Menu Bar

```swift
// PASS: GOOD: Menu bar extra with label
MenuBarExtra("Status", systemImage: statusIcon) {
    VStack {
        Text("Status: \(currentStatus)")
        Divider()
        Button("Refresh") {
            refresh()
        }
    }
}
.menuBarExtraStyle(.window)  // Shows as popover
```

## Observation Framework

### Using @Observable (macOS 14+)

```swift
// PASS: GOOD: New Observation framework
import Observation

@Observable
final class ArticleViewModel {
    var articles: [Article] = []
    var isLoading = false
    var error: Error?

    func loadArticles() async {
        isLoading = true
        // Load articles...
        isLoading = false
    }
}

// Usage in view - automatic updates
struct ArticleListView: View {
    let viewModel: ArticleViewModel

    var body: some View {
        List(viewModel.articles) { article in
            Text(article.title)
        }
        .overlay {
            if viewModel.isLoading {
                ProgressView()
            }
        }
        .task {
            await viewModel.loadArticles()
        }
    }
}

// FAIL: OLD: ObservableObject (still works, but @Observable is preferred)
class ArticleViewModel: ObservableObject {
    @Published var articles: [Article] = []
}
```

## Gestures and Interactions

### Mouse Events

```swift
// PASS: GOOD: Hover effects
.onHover { isHovered in
    withAnimation {
        self.isHovered = isHovered
    }
}
.scaleEffect(isHovered ? 1.05 : 1.0)

// PASS: GOOD: Right-click handling
.onTapGesture(count: 1, perform: leftClick)
.gesture(
    TapGesture(count: 1)
        .modifiers(.control)
        .onEnded { _ in
            showContextMenu()
        }
)
```

### Drag and Drop

```swift
// PASS: GOOD: Draggable items
Text(item.name)
    .draggable(item)

// PASS: GOOD: Drop destination
List {
    // Items
}
.dropDestination(for: Item.self) { items, location in
    handleDrop(items, at: location)
    return true
}
```

## Performance Optimization

### LazyVStack vs VStack

```swift
// PASS: GOOD: Use LazyVStack for long lists
ScrollView {
    LazyVStack(spacing: 8) {
        ForEach(items) { item in
            ItemRow(item: item)
        }
    }
}

// FAIL: BAD: Regular VStack loads all items
ScrollView {
    VStack {
        ForEach(items) { item in  // Loads everything!
            ItemRow(item: item)
        }
    }
}
```

### Drawing Performance

```swift
// PASS: GOOD: Use drawingGroup for complex graphics
Canvas { context, size in
    // Complex drawing
}
.drawingGroup()  // Offloads to Metal

// PASS: GOOD: Cache expensive calculations
.backgroundStyle(
    LinearGradient(...)
        .drawingGroup()
)
```

## SwiftUI + AppKit Bridge

### NSViewRepresentable

```swift
// PASS: GOOD: Wrap NSTextField for advanced features
struct AdvancedTextField: NSViewRepresentable {
    @Binding var text: String

    func makeNSView(context: Context) -> NSTextField {
        let textField = NSTextField()
        textField.delegate = context.coordinator
        return textField
    }

    func updateNSView(_ nsView: NSTextField, context: Context) {
        nsView.stringValue = text
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(text: $text)
    }

    class Coordinator: NSObject, NSTextFieldDelegate {
        @Binding var text: String

        init(text: Binding<String>) {
            _text = text
        }

        func controlTextDidChange(_ notification: Notification) {
            if let textField = notification.object as? NSTextField {
                text = textField.stringValue
            }
        }
    }
}
```

## SwiftUI Checklist for macOS

- [ ] Use NavigationSplitView for sidebar layouts
- [ ] Use Table for tabular data
- [ ] Provide rich context menus
- [ ] Add help tags (tooltips) to controls
- [ ] Manage keyboard focus appropriately
- [ ] Use @Observable for view models (macOS 14+)
- [ ] Handle hover interactions
- [ ] Support drag and drop where appropriate
- [ ] Use LazyVStack for long lists
- [ ] Test layout on actual macOS Tahoe
- [ ] Verify animations in NSHostingView
- [ ] Use proper window toolbar styles

## Resources

- [SwiftUI Documentation](https://developer.apple.com/documentation/swiftui)
- [WWDC 2024: What's new in SwiftUI](https://developer.apple.com/videos/swiftui)
- [macOS SwiftUI Tutorials](https://developer.apple.com/tutorials/swiftui)
