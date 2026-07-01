# Node / TypeScript — pi-tui (stocker 원본 기반)

`@mariozechner/pi-tui` 유지형(retained) 위젯 트리. stocker의 실제 구현을 그대로 따온 틀.

## 크레이트/패키지

| 역할 | 패키지 |
|------|--------|
| TUI 프레임워크 | `@mariozechner/pi-tui` |
| 색상/ANSI | `chalk` |
| LLM 호출 | `@langchain/anthropic` 등 LangChain, 또는 Vercel AI SDK |
| 런타임 | bun (권장) 또는 node |

## 컴포넌트 트리 — init에서 한 번만 조립

```ts
// cli.ts — Build the component tree ONCE, no root.clear()
root.addChild(intro);            // 배너 + 로고 + 태그라인 + 모델
root.addChild(chatLog);          // 대화/도구 이벤트 (초기엔 비어 있음)
root.addChild(errorText);        // 에러 한 줄 (평소 빈 문자열)
root.addChild(workingIndicator); // 작업 중 스피너
root.addChild(spacer);           // 여백 1줄
root.addChild(editor);           // 입력창
root.addChild(hintBar);          // 하단 단축키/자동완성
tui.addChild(root);
```

이후 갱신은 각 컴포넌트의 텍스트/가시성만 바꾼다. 주석 원문: *"The root is built once at init — this only changes text/hints/visibility."*

## 배너 + 로고 (`intro.ts`)

고정 폭 박스에 제목을 가운데 정렬하고, ASCII 로고를 얹는다.

```ts
import { Container, Spacer, Text } from '@mariozechner/pi-tui';
import { theme } from '../theme.js';

const INTRO_WIDTH = 50;

export class IntroComponent extends Container {
  private readonly modelText: Text;

  constructor(model: string) {
    super();
    const welcomeText = 'Welcome to Stocker';
    const versionText = ' v1.0';
    const fullText = welcomeText + versionText;
    const padding  = Math.floor((INTRO_WIDTH - fullText.length - 2) / 2);
    const trailing = INTRO_WIDTH - fullText.length - padding - 2;

    this.addChild(new Spacer(1));
    this.addChild(new Text(theme.primary('═'.repeat(INTRO_WIDTH)), 0, 0));
    this.addChild(new Text(theme.primary(
      `║${' '.repeat(padding)}${theme.bold(welcomeText)}${theme.muted(versionText)}${' '.repeat(trailing)}║`
    ), 0, 0));
    this.addChild(new Text(theme.primary('═'.repeat(INTRO_WIDTH)), 0, 0));
    this.addChild(new Spacer(1));

    // ASCII 로고 (전용 색)
    this.addChild(new Text(theme.bold(theme.logo(LOGO)), 0, 0));

    this.addChild(new Spacer(1));
    this.addChild(new Text('Your AI assistant for deep research.', 0, 0));

    // 모델 줄은 참조를 보관 — /model로 텍스트만 교체 (트리 재조립 X)
    this.modelText = new Text('', 0, 0);
    this.addChild(this.modelText);
    this.setModel(model);
  }

  setModel(model: string) {
    this.modelText.setText(`${theme.muted('Model: ')}${theme.primary(model)}`);
  }
}

const LOGO = `
███████╗████████╗ ██████╗  ██████╗██╗  ██╗███████╗██████╗
██╔════╝╚══██╔══╝██╔═══██╗██╔════╝██║ ██╔╝██╔════╝██╔══██╗
███████╗   ██║   ██║   ██║██║     █████╔╝ █████╗  ██████╔╝
╚════██║   ██║   ██║   ██║██║     ██╔═██╗ ██╔══╝  ██╔══██╗
███████║   ██║   ╚██████╔╝╚██████╗██║  ██╗███████╗██║  ██║
╚══════╝   ╚═╝    ╚═════╝  ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝`;
```

## 색상 팔레트 (`theme.ts`)

팔레트를 한 곳에 정의하고 의미별 함수로 래핑. 컴포넌트는 색 코드가 아니라 `theme.primary(...)`만 부른다.

```ts
import chalk from 'chalk';

const palette = {
  primary: '#258bff',
  logo:    '#ff3b30',   // 로고 전용 — primary와 분리
  muted:   '#a6a6a6',
  error:   '#ff3333',
  success: '#00cc00',
};

const fg = (color: string) => (text: string) => chalk.hex(color)(text);

export const theme = {
  primary: fg(palette.primary),
  logo:    fg(palette.logo),
  muted:   fg(palette.muted),
  error:   fg(palette.error),
  bold:    (t: string) => chalk.bold(t),
};
```

## 힌트 바 (`hint-bar.ts`) — ANSI 폭 함정 주의

좌측 일반 힌트 + 우측 esc 힌트 양끝 정렬. 슬래시 입력 시 여러 줄 자동완성으로 확장.

```ts
// 색 입힌 문자열은 .length가 ANSI 이스케이프까지 세므로 정렬이 깨진다.
// 반드시 ANSI를 벗긴 가시 폭으로 패딩을 계산한다.
function visibleLength(str: string): number {
  return str.replace(/\x1b\[[0-9;]*m/g, '').length;
}

const leftLen  = visibleLength(leftHint);
const rightLen = visibleLength(rightHint);
const padding  = Math.max(1, width - leftLen - rightLen);
return [leftHint + ' '.repeat(padding) + rightHint];
```

슬래시 커맨드 자동완성:

```ts
setSuggestions(commands, selectedIndex) {
  this.clear();
  for (let i = 0; i < commands.length; i++) {
    const isSelected = i === selectedIndex;
    const prefix = isSelected ? theme.primary('> ') : '  ';
    const name   = isSelected ? theme.primary(`/${commands[i].name}`) : theme.muted(`/${commands[i].name}`);
    this.addChild(new Text(`${prefix}${name}${theme.muted(` — ${commands[i].description}`)}`, 0, 0));
  }
}
```

## ASCII 로고 생성

```bash
figlet -f ANSI\ Shadow "STOCKER"   # 또는 patorjk.com/software/taag
```

로고는 문자열 리터럴로 박제한다. 런타임 생성은 느리고 깨지기 쉽다.

## 이 언어 고유 함정

- **`visibleLength` 필수** — chalk가 입힌 ANSI 코드를 `.length`가 세므로 정렬 계산 전 반드시 제거.
- **엔트리 파일**: `#!/usr/bin/env bun` 셔뱅 + `bin` 필드로 CLI 등록. `dotenv`로 `.env` 로드 후 `runCli()`.
- 진입 시 캐시/백엔드 초기화 1회 (`await initX()`) → `await runCli()`.
