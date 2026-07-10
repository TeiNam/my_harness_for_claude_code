# 대화형 세분화 설치 — 설계 문서

- **날짜**: 2026-07-11
- **대상**: `install.sh`, `install.ps1`, `scripts/install/*`
- **상태**: 승인 대기

## 1. 목적

설치를 대화형으로 만들고 워크로드 선택을 3단계로 세분화하여, 사용자가 원하는 것만 설치하도록 한다. 요청된 플로우:

```
설치 실행
  → 글로벌 설치 여부 검사
  → 글로벌이 오래된 버전이거나 없으면 설치, 있으면 패스
  → 기존 설치항목 검사
  → 있으면 업데이트, 없으면 워크플로우 설치
  → 대분류 → 중분류 → 상세항목 선택
  → 설치
```

## 2. 배경 / 현재 구조

- 설치는 **심볼릭 링크 기반**이다. `~/.claude/<kind>s/_harness/…` 링크가 repo 소스를 직접 가리킨다. 따로 버전된 산출물이 없으므로 **"버전"은 우리가 기록해야만 존재한다.**
- 이미 2-tier 대화형 메뉴가 `scripts/install/select-workloads.js`에 있다 (readline 숫자-콤마 입력: `1,3` / `all`).
- `scripts/install/check-drift.js`가 이미 "설치된 링크 vs repo가 설치할 자산"을 대조한다. 단, 버전 개념은 없다.
- `install.sh`와 `install.ps1` **둘 다** 대화형 메뉴를 Node `select-workloads.js`에 위임한다 (`.ps1` L73/L97). → TUI를 Node에 **한 번만** 쓰면 두 셸이 모두 상속한다.
- repo 루트에 `VERSION` 파일 존재 (`0.1.0`).

## 3. 결정 사항 (브레인스토밍에서 확정)

| 질문 | 결정 |
|------|------|
| "글로벌"·"버전"의 의미 | **하네스 baseline + 버전 스탬프**. manifest 파일에 version·workloads 기록 |
| 3번째 tier "상세항목"의 의미 | **중분류를 더 쪼갠 그룹** (개별 자산 단위 아님) |
| 대화형 입력 방식 | **방향키 체크박스 TUI** (npm 의존성 0, raw-mode 직접 구현) |
| 상세 tier 적용 범위 | 자산이 많은 **apple(23) + social-content(17)** 두 곳만 우선. 나머지 중분류는 leaf 유지 |

## 4. 아키텍처

### 4.1 Manifest (신규) — 버전/글로벌 검사의 단일 소스

**파일**: `$CLAUDE_HOME/_harness-manifest.json`

```json
{
  "version": "0.1.0",
  "workloads": ["core", "mysql", "writing"],
  "installedAt": "2026-07-11T00:00:00Z"
}
```

- `version` ← repo `VERSION` 파일.
- `workloads` ← 이번 설치에서 확정된 활성 워크로드 집합.
- 글로벌 설치 여부 + 오래됨 판정, 기존 설치항목 검사(drift)의 기준이 된다.

**신규 모듈**: `scripts/install/manifest.js` (CommonJS, plain `.js`)

```
readManifest(claudeHome) -> { version, workloads, installedAt } | null
writeManifest(claudeHome, { version, workloads }) -> void   // installedAt 은 인자로 주입(테스트 위해 Date.now 직접 호출 회피 가능)
repoVersion(root) -> string        // VERSION 파일 읽기
compareVersion(a, b) -> -1|0|1     // semver-lite: major.minor.patch 숫자 비교
```

> `installedAt` 타임스탬프는 호출부(install 스크립트)에서 생성해 주입한다 — 모듈 자체는 순수 유지.

### 4.2 상태 판정 로직 (install 스크립트가 Node CLI로 호출)

**신규 CLI**: `scripts/install/check-global.js`

```
node scripts/install/check-global.js [--claude-home=PATH] [--json]
```

출력 (stdout, JSON):

```json
{ "state": "absent|outdated|current",
  "installedVersion": "0.1.0" | null,
  "repoVersion": "0.1.0",
  "workloads": ["core", ...] }
```

판정:

- `absent`: manifest 없음 **또는** `_harness` 루트 링크 없음
- `outdated`: `compareVersion(installed, repo) < 0`
- `current`: 그 외

install 스크립트(`install.sh` / `install.ps1`)는 이 CLI를 호출해 분기한다.

### 4.3 실행 플로우

```
install 실행
  │
  ├─ 1. 글로벌 baseline 검사  (check-global.js)
  │     absent   → baseline 신규 설치 (아래 정의)
  │     outdated → baseline 갱신 (--force 로 재링크)
  │     current  → 패스
  │
  │     baseline = _harness 루트 링크 + `core` 워크로드 자산.
  │     (기존 install.sh 의 _harness 링크 로직 + core-only select-assets)
  │
  ├─ 2. 기존 설치항목 검사  (check-drift.js, manifest.workloads 기준)
  │     drift/누락 있음 → "기존 설치를 업데이트할까요? [Y/n]" → --force 재링크
  │     없음           → 3 으로
  │
  └─ 3. 워크로드 선택
        대분류(카테고리) → 중분류(sub-option) → [상세항목(detail, 있을 때만)]
        → select-assets 로 링크 → manifest 기록 (writeManifest)
```

핵심: **2번의 "있으면 업데이트"는 기존 `check-drift.js`를 그대로 재사용한다.** 신규 로직 아님.

### 4.4 3-tier 메뉴 — `menu.js` 확장

sub-option에 **선택적** `detailQuestion` + `detailOptions` 필드 추가:

```js
{
  id: 'apple', label: 'Apple 플랫폼 개발',
  // (기존엔 카테고리 레벨 workloads: ['apple'])
  subQuestion: '...',
  subOptions: [
    { id: 'apple', label: 'Apple 플랫폼', detailQuestion: '어느 영역?', detailOptions: [
        { id: 'core',     label: '핵심 개발 (Swift/SwiftUI/테스트/생성기)', workloads: ['apple-core'] },
        { id: 'platform', label: '플랫폼 특화 (watchOS/visionOS/ML/Maps)',  workloads: ['apple-platform'] },
        { id: 'product',  label: '제품·운영 (App Store/성장/법무)',          workloads: ['apple-product'] },
    ]},
  ],
}
```

**규칙**:

- `detailOptions`가 **없는** 중분류(mysql, rust, postgres, react-vite-ts…)는 지금처럼 leaf → 그 중분류의 `workloads` 전체 설치. 3단계로 내려가지 않는다.
- `detailOptions`가 **있는** 중분류만 상세 tier로 드릴다운. 상세 미선택(빈 값)이면 전체 상세 = 전체 워크로드(하위호환 편의 기본값, 기존 "빈 배열 = 전체" 규칙과 일치).

`resolveSelection()` 확장: `detailSelections: { [categoryId.subId]: detailId[] }`를 추가로 받아 상세 워크로드를 합집합에 더한다. detail이 없는 sub는 기존과 동일.

`parseCliFlags()` 확장: `--apple=core,platform` 같은 상세 플래그를 파싱 (sub-option이 카테고리와 동명일 때는 카테고리 플래그가 곧 상세 플래그).

### 4.5 워크로드 카탈로그 — `workloads.js` 재분할

**apple** 을 3개로 분할, **social-content** 를 3개로 분할:

```
apple          → apple-core, apple-platform, apple-product   (3분할)
social-content → social-voice, social-content, social-visual (3분할, social-content 는 재사용/축소)
```

> 하위호환: `apple`·`social-content` 키를 **별칭(alias)** 으로 유지할지 여부는 §7 미해결. 기본안 = 옛 키를 카탈로그에 남겨두되 메뉴에서만 세분화(옛 `--workload=apple` 은 3개 전체로 확장 매핑).

**자산 재태깅**: apple 23개 스킬, social 17개 스킬의 frontmatter `workloads:`를 새 하위 키로 갱신.

- apple 그룹핑 (CLAUDE.md 기준):
  - `apple-core`: ios, macos, swift, swiftui, design, testing, generators, security, performance, shared
  - `apple-platform`: watchos, visionos, swiftdata, mapkit, foundation, core-ml, apple-intelligence
  - `apple-product`: product, app-store, growth, legal, monetization, release-review
- social 그룹핑 (파이프라인 단계 기준):
  - `social-voice`: voice-builder, newsletter-voice, profile-optimizer
  - `social-content`: post-writer, post-formatter, hook-generator, content-matrix, niche-research, post-scorer, analytics-dashboard, pinned-comment, reels-scripting
  - `social-visual`: graphic-designer, gemini-carousel, gemini-infographic, quote-post, youtube-thumbnail

재태깅은 수동 Edit 또는 `scripts/install/tag-assets.js` 활용.

### 4.6 방향키 체크박스 TUI — 신규 `scripts/install/checkbox-prompt.js`

**의존성 0.** Node 내장 `readline` + `process.stdin.setRawMode(true)` + keypress 이벤트.

```
checkboxPrompt({ title, options: [{id,label}], preselected? }) -> Promise<string[]>
```

- `↑/↓`: 커서 이동
- `space`: 토글
- `a`: 전체 토글
- `enter`: 확정 (선택 배열 반환)
- `ctrl-c`: abort (비-0 종료)
- 렌더는 stderr (stdout은 기계용 워크로드 목록 유지)
- 재그림: 커서를 옵션 수만큼 올려 다시 그림 (`\x1b[<n>A`, 라인 클리어)

**폴백**: `process.stdin.isTTY`가 아니면 이 프롬프트를 호출하지 않는다 — 기존 `--all`/CLI 플래그 경로가 그대로 처리. `select-workloads.js`의 `runInteractive()`가 숫자-콤마 대신 이 위젯을 대분류/중분류/상세 3단계에 재사용.

## 5. 파일 변경 요약

| 파일 | 변경 |
|------|------|
| `scripts/install/manifest.js` | **신규** — read/write/repoVersion/compareVersion |
| `scripts/install/check-global.js` | **신규** — absent/outdated/current 판정 CLI |
| `scripts/install/checkbox-prompt.js` | **신규** — 방향키 체크박스 TUI (의존성 0) |
| `scripts/install/menu.js` | detailOptions 지원, resolveSelection/parseCliFlags 확장 |
| `scripts/install/workloads.js` | apple/social-content 3분할, RULES 재태깅 반영 |
| `scripts/install/select-workloads.js` | runInteractive 를 3-tier + 체크박스로 교체 |
| `install.sh` | 플로우: check-global → baseline → check-drift → 워크로드 → manifest write |
| `install.ps1` | 동일 플로우 (Node CLI 위임이라 로직 최소) |
| skills/apple-*, skills/(social) | frontmatter `workloads:` 재태깅 |
| `tests/scripts/install/*` | manifest·check-global·menu(detail)·checkbox 테스트 |

## 6. 테스트

TDD. 각 신규 모듈은 순수 함수 위주로 테스트 가능하게 설계.

- `manifest.test.js`: compareVersion (0.1.0 vs 0.2.0 vs 0.1.0), read(없음)→null, write→read 왕복
- `check-global.test.js`: absent(매니페스트 없음), outdated(낮은 버전), current — 임시 CLAUDE_HOME 픽스처
- `menu.test.js` (확장): detailOptions 있는 sub의 resolveSelection, detail 빈 값→전체, parseCliFlags `--apple=core`
- `workloads.test.js` (확장): 새 키 존재, apple-* 별칭 확장(선택 시)
- `checkbox-prompt.test.js`: 키 입력 시퀀스 → 선택 배열 (stdin 모킹). raw-mode는 주입 가능한 스트림으로 테스트.
- `select-assets.test.js`: 재태깅된 apple/social 자산이 새 키로 분류되는지

비-TTY/CI 경로(–all 폴백)가 깨지지 않는지 회귀 확인.

## 7. 미해결 / 하위호환

1. **옛 워크로드 키 별칭**: `--workload=apple` (기존 문서·스크립트에서 쓰던 것)을 `apple-core,apple-platform,apple-product`로 확장 매핑할지. 기본안 = 확장 매핑(별칭 유지). CLAUDE.md·README의 워크로드 카탈로그 문구도 갱신 필요.
2. **manifest 부재 시 기존 사용자**: 이번 변경 전 설치한 사용자는 manifest가 없어 `absent`로 판정 → baseline 재설치(멱등, --force 아니면 기존 링크 skip). 안전하지만 최초 1회 재설치 유발. 허용 가능으로 본다.
3. **상세 tier 확장**: writing 등 나머지 카테고리는 지금 leaf 유지. 나중에 `detailOptions`만 붙이면 자동 확장 (모델은 이미 지원).

## 8. 스킵한 것 (YAGNI)

- npm TUI 라이브러리(enquirer 등) → raw-mode 직접 구현 (no-new-dep 정책)
- 개별 자산 단위 체크박스 선택 → 중분류를 쪼갠 그룹까지만
- 모든 카테고리 상세 tier → apple + social-content 두 곳만 우선
- 부분 업데이트(자산별 diff 설치) → drift 있으면 통째 --force 재링크
