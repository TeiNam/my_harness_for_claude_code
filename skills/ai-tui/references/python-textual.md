# Python — textual / rich

두 경로가 있다. 필요에 맞춰 하나만 고른다.

- **정적 배너 + 스크롤 로그만** → `rich` (println 방식, TUI 아님, 가장 가벼움)
- **입력창 + 힌트바 + 실시간 갱신** → `textual` (유지형 위젯 트리, pi-tui와 1:1 대응)

## 패키지

| 역할 | 패키지 |
|------|--------|
| 정적 출력/색상 | `rich` |
| 풀 TUI | `textual` (rich 기반, async 위젯 트리) |
| 입력창 | textual `Input` / `TextArea` 위젯 (내장) |
| 마크다운 렌더 | rich `Markdown` / textual `Markdown` 위젯 |
| LLM 호출 | `anthropic` / `openai` SDK (async) |

textual은 asyncio 위에 돌고, ANSI 폭 계산을 rich가 알아서 처리하므로 `visibleLength` 직접 구현 불필요.

## 경로 A: rich (정적 배너)

로그만 흘려보내면 되는 단순 에이전트:

```python
from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from rich.align import Align

console = Console()

# 색상 팔레트 — 로고 색을 primary와 분리
PRIMARY = "#258bff"
LOGO_C  = "#ff3b30"
MUTED   = "dim"

LOGO = r"""
███████╗████████╗ ██████╗  ██████╗██╗  ██╗███████╗██████╗
██╔════╝╚══██╔══╝██╔═══██╗██╔════╝██║ ██╔╝██╔════╝██╔══██╗
███████╗   ██║   ██║   ██║██║     █████╔╝ █████╗  ██████╔╝
"""

def print_intro(model: str) -> None:
    console.print(Panel(
        Align.center(Text("Welcome to Stocker v1.0", style="bold")),
        width=50, border_style=PRIMARY,
    ))
    console.print(Text(LOGO, style=f"bold {LOGO_C}"))
    console.print("Your AI assistant for deep research.")
    console.print(Text.assemble(("Model: ", MUTED), (model, PRIMARY)))
```

`Panel`이 pi-tui의 `═` 테두리 + 가운데 정렬 수동 계산을 대신한다.

## 경로 B: textual (풀 TUI — pi-tui 구조 이식)

유지형 위젯 트리. `compose()`가 pi-tui의 "init에서 한 번 조립"에 그대로 대응한다.

```python
from textual.app import App, ComposeResult
from textual.widgets import Static, Input, RichLog
from textual.containers import Vertical

LOGO = "..."  # 위와 동일

class AgentApp(App):
    CSS = """
    #logo   { color: #ff3b30; text-style: bold; }
    #banner { border: heavy #258bff; text-align: center; }
    #model  { color: #258bff; }
    """

    def __init__(self, model: str) -> None:
        super().__init__()
        self.model = model

    # compose() = 트리를 한 번만 조립. 이후엔 위젯 참조로 텍스트만 갱신.
    def compose(self) -> ComposeResult:
        yield Static("Welcome to Stocker v1.0", id="banner")
        yield Static(LOGO, id="logo")
        yield Static("Your AI assistant for deep research.")
        yield Static(f"Model: {self.model}", id="model")
        yield RichLog(id="chatlog")          # 대화/도구 이벤트
        yield Input(placeholder="Ask anything…", id="editor")
        yield Static("esc 중단  ·  ctrl+c 종료  ·  /help", id="hintbar")

    # /model 로 모델 바꾸면 텍스트만 교체 (트리 재조립 X)
    def set_model(self, model: str) -> None:
        self.model = model
        self.query_one("#model", Static).update(f"Model: {model}")

    async def on_input_submitted(self, event: Input.Submitted) -> None:
        log = self.query_one("#chatlog", RichLog)
        log.write(f"> {event.value}")
        event.input.value = ""
        # 여기서 LLM 호출 (async) → 토큰 스트림을 log.write 로 흘림

if __name__ == "__main__":
    AgentApp(model="claude-opus-5").run()
```

## 비동기 LLM 스트리밍

textual은 이미 asyncio 루프 위에 돈다. Rust처럼 채널을 손수 짤 필요 없이 `async` 핸들러 안에서 SDK의 async 스트림을 `await for`로 받아 위젯을 갱신하면 된다:

```python
async def stream_reply(self, prompt: str) -> None:
    log = self.query_one("#chatlog", RichLog)
    async with client.messages.stream(...) as stream:
        async for text in stream.text_stream:
            log.write(text, expand=False)   # UI 스레드 안전 (textual이 관리)
```

## 이 언어 고유 함정

- **`visibleLength` 불필요** — rich/textual이 셀 폭을 알아서 계산.
- **rich vs textual 선택 실수** — 입력창·실시간 갱신이 필요하면 rich만으로는 부족하다. rich는 출력 전용, textual이 상호작용 담당.
- **CSS로 스타일 분리** — textual은 위젯 스타일을 별도 CSS 블록/파일로 뺀다. 색 하드코딩 대신 `#id`·클래스로.
- **키 바인딩** — textual은 `BINDINGS` 클래스 변수로 `esc`/`ctrl+c`/`↑↓`를 선언적으로 등록.
