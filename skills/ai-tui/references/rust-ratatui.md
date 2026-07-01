# Rust — ratatui + crossterm

`ratatui`는 **즉시형(immediate mode)** — 매 프레임 상태를 보고 화면을 통째로 다시 그린다. pi-tui의 "트리 한 번 조립"은 여기서 **`App` 상태 구조체 하나 + 렌더 함수**로 뒤집힌다.

## 크레이트

| 역할 | 크레이트 |
|------|----------|
| TUI 프레임워크 | `ratatui` + `crossterm` (백엔드) |
| 색상/ANSI | `ratatui`의 `Style`/`Color` (또는 `owo-colors`) |
| ASCII 로고 | `figlet-rs` 또는 리터럴 박제 |
| 입력창 | `tui-textarea` |
| 마크다운 렌더 | `termimad` |
| LLM 호출 | `reqwest` + `serde` (또는 `async-openai`) |
| 비동기 런타임 | `tokio` |

```toml
[dependencies]
ratatui = "0.29"
crossterm = "0.28"
tui-textarea = "0.7"
tokio = { version = "1", features = ["full"] }
```

## 상태 구조체 = "트리 한 번 조립"의 Rust 버전

유지형에서 위젯 참조를 들고 있던 것을 상태 필드로 바꾼다:

```rust
struct App {
    model: String,                    // intro.ts의 modelText — 텍스트만 갱신
    chat_log: Vec<Line<'static>>,
    input: tui_textarea::TextArea<'static>,
    error: Option<String>,
    working: bool,
}
```

## 색상 팔레트

```rust
use ratatui::style::Color;

const PRIMARY: Color = Color::Rgb(0x25, 0x8b, 0xff);
const LOGO_C:  Color = Color::Rgb(0xff, 0x3b, 0x30); // 로고 전용, primary와 분리
const MUTED:   Color = Color::Rgb(0xa6, 0xa6, 0xa6);
```

## 배너 + 로고 렌더

`Block` + `Alignment::Center`가 pi-tui의 `padding`/`trailing` 수동 계산을 대신한다. `Span`/`Line` 단위 폭 관리라 **`visibleLength`(ANSI 벗기기)가 불필요** — 정렬 자동.

```rust
use ratatui::{prelude::*, widgets::{Block, Borders, Paragraph}};

const INTRO_WIDTH: u16 = 50;
const LOGO: &str = r#"
███████╗████████╗ ██████╗  ██████╗██╗  ██╗███████╗██████╗
██╔════╝╚══██╔══╝██╔═══██╗██╔════╝██║ ██╔╝██╔════╝██╔══██╗
███████╗   ██║   ██║   ██║██║     █████╔╝ █████╗  ██████╔╝
╚════██║   ██║   ██║   ██║██║     ██╔═██╗ ██╔══╝  ██╔══██╗
███████║   ██║   ╚██████╔╝╚██████╗██║  ██╗███████╗██║  ██║
╚══════╝   ╚═╝    ╚═════╝  ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝
"#;

fn render_intro(f: &mut Frame, area: Rect, app: &App) {
    // 1) 제목 박스 — Block이 테두리 + 가운데 정렬 대신
    let title = Paragraph::new(Line::from(vec![
        Span::styled("Welcome to Stocker", Style::new().bold()),
        Span::styled(" v1.0", Style::new().fg(MUTED)),
    ]))
    .alignment(Alignment::Center)
    .block(Block::default().borders(Borders::ALL).border_style(Style::new().fg(PRIMARY)));

    // 2) ASCII 로고 (전용 색)
    let logo = Paragraph::new(LOGO).style(Style::new().fg(LOGO_C).bold());

    // 3) 태그라인 + 모델 상태 줄
    let status = Paragraph::new(vec![
        Line::from("Your AI assistant for deep research."),
        Line::from(vec![
            Span::styled("Model: ", Style::new().fg(MUTED)),
            Span::styled(app.model.clone(), Style::new().fg(PRIMARY)),
        ]),
    ]);

    let rows = Layout::vertical([
        Constraint::Length(3), // 박스
        Constraint::Length(8), // 로고
        Constraint::Length(2), // 상태
    ]).split(area);

    f.render_widget(title, rows[0]);
    f.render_widget(logo, rows[1]);
    f.render_widget(status, rows[2]);
}
```

## 메인 루프 = "트리 조립 + 렌더 스로틀"의 Rust 버전

```rust
use crossterm::event::{self, Event, KeyCode, KeyModifiers};

fn main() -> std::io::Result<()> {
    let mut terminal = ratatui::init();   // raw 모드 + alternate screen 진입
    let mut app = App::new();

    loop {
        terminal.draw(|f| {
            let [top, editor, hint] = Layout::vertical([
                Constraint::Min(0),     // intro + chat_log
                Constraint::Length(3),  // 입력창
                Constraint::Length(1),  // 힌트 바
            ]).areas(f.area());

            render_intro(f, top, &app);
            f.render_widget(&app.input, editor);
            render_hint_bar(f, hint, &app);
        })?;

        // raw 모드 — esc/↑↓/ctrl+c가 직접 들어옴
        if let Event::Key(key) = event::read()? {
            match key.code {
                KeyCode::Esc => app.clear_or_interrupt(),
                KeyCode::Char('c') if key.modifiers == KeyModifiers::CONTROL => break,
                _ => { app.input.input(key); }
            }
        }
    }
    ratatui::restore();   // 원래 터미널 화면 복구
    Ok(())
}
```

## 비동기 LLM 스트리밍 배선 (직접 해야 함)

bun/LangChain이 감춰주던 부분. `tokio` task에서 토큰을 받아 `mpsc` 채널로 UI 루프에 넘기고, `event::poll(timeout)`으로 키 입력과 함께 폴링한다.

```rust
let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<String>();
// LLM task: 스트림 토큰 → tx.send(token)
loop {
    while let Ok(token) = rx.try_recv() { app.append_stream(token); }
    if event::poll(std::time::Duration::from_millis(16))? {
        // 키 처리
    }
    terminal.draw(|f| { /* ... */ })?;
}
```

## 이 언어 고유 함정

- **`visibleLength` 불필요** — `Span` 폭 관리 자동. Node의 ANSI 함정이 없다.
- **테두리·정렬 수동 계산 불필요** — `Block` + `Alignment`가 대신.
- **패닉 시 터미널 복구** — `ratatui::restore()`를 패닉 훅에도 등록하지 않으면, 크래시 후 터미널이 raw 모드로 망가진 채 남는다. `std::panic::set_hook`으로 restore 보장.
- **비동기 배선은 직접** — 스트리밍/툴콜을 채널로 UI에 넣는 배선을 손수 짠다.
