# 대화형 세분화 설치 — 설계 문서

- **날짜**: 2026-07-11
- **대상**: `install.sh`, `install.ps1`, `scripts/install/*`
- **상태**: 구현 완료 (전체 테스트 1570 pass, 교차소속·자산손실 감사 통과)

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

> **구조 수정 (검토 발견)**: 초기 스펙은 detailOptions를 sub-option에만 두는 것으로 그렸으나, 실제 `menu.js`에서 **apple 카테고리는 subOptions가 없다** (카테고리 레벨에서 직접 `workloads: ['apple']`, sub 없는 유일한 카테고리). 따라서 detailOptions는 **"leaf 노드"(sub-option, 또는 sub 없는 카테고리) 어디에도 부착 가능**하도록 일반화한다.

**데이터 모델**: `detailQuestion` + `detailOptions`를 **leaf가 될 수 있는 노드**(subOption, 또는 subOptions 없는 category)에 선택적으로 부착한다.

- **apple** (subOptions 없음 → 카테고리 레벨에 detailOptions):

```js
{
  id: 'apple', label: 'Apple 플랫폼 개발',
  detailQuestion: '어느 영역? (여러 개 선택 가능)',
  detailOptions: [
    { id: 'core',     label: '핵심 개발 (Swift/SwiftUI/테스트/생성기)', workloads: ['apple-core'] },
    { id: 'platform', label: '플랫폼 특화 (watchOS/visionOS/ML/Maps)',  workloads: ['apple-platform'] },
    { id: 'product',  label: '제품·운영 (App Store/성장/법무)',          workloads: ['apple-product'] },
  ],
}
```

- **social** (writing 카테고리의 sub-option → sub-option 레벨에 detailOptions):

```js
{ id: 'social', label: '소셜 콘텐츠 (LinkedIn 등)',
  detailQuestion: '어느 단계? (여러 개 선택 가능)',
  detailOptions: [
    { id: 'voice',   label: '보이스·프로필 (voice-builder 등)',        workloads: ['social-voice'] },
    { id: 'content', label: '콘텐츠 제작 (post-writer/hook 등)',       workloads: ['social-content'] },
    { id: 'visual',  label: '시각 자산 (carousel/infographic 등)',     workloads: ['social-visual'] },
  ],
}
```

**해석 규칙 (일관된 3단계)**:

1. **카테고리** 선택 → 그 카테고리가
   - `subOptions`를 가지면 → 중분류로 내려감
   - `detailOptions`를 가지면 (sub 없음, apple) → 곧장 상세로 내려감
   - 둘 다 없으면 (없음, 현재는 해당 없음) → 카테고리 `workloads` 그대로
2. **중분류(sub-option)** 선택 → 그 sub이
   - `detailOptions`를 가지면 (social) → 상세로 내려감
   - 없으면 (mysql, rust…) → sub의 `workloads` 그대로 (leaf, 3단계로 안 내려감)
3. **상세(detail)** 선택 → 고른 detail들의 `workloads` 합집합.
   - **미선택(빈 값) = 전체 상세** (기존 "빈 배열 = 전체" 관례와 일치).

`resolveSelection()` 확장: `detailSelections: { [nodeKey]: detailId[] }`를 추가로 받는다. `nodeKey`는 카테고리 레벨 detail이면 `categoryId`(예: `apple`), sub 레벨 detail이면 `categoryId.subId`(예: `writing.social`). 고른 detail들의 workloads를 합집합에 더한다. detailOptions 없는 노드는 기존과 완전히 동일하게 동작 → **비-detail 경로 회귀 없음.**

`parseCliFlags()` 확장: 상세 플래그를 파싱.
- 카테고리 레벨 detail: `--apple=core,platform`
- sub 레벨 detail: `--writing-social=voice,content` (또는 하위호환으로 `--writing=social`만 주면 social 전체)

### 4.4.1 교차소속(cross-membership) 원칙 — 확정

> 목표에서 지적한 "프로그래밍에도 Python, 데이터 분석에도 Python" 케이스. **이미 핵심 메커니즘으로 지원되고 있다** (검토로 확인).

- 한 자산은 `workloads:` 배열로 **여러 그룹에 동시 소속**한다. 예: `python-patterns [python-backend, python-data]`, `ai-tui [ai, rust, nodejs, python-backend]`, `aws-bedrock [ai, cloud]`.
- 메뉴에서도 같은 소분류가 **여러 중분류에 등장**할 수 있다. 예: "Python"이 backend sub(`python-backend`)와 data-analysis sub(`python-data`) 양쪽에 존재.
- 활성 그룹과 자산 그룹이 **한 개라도 교집합이면 설치**된다 (합집합·OR 시맨틱). 사용자가 backend·data 둘 다 고르면 `python-patterns`는 한 번만 링크된다 (자산 단위 dedup은 select-assets가 이미 처리).
- **상세 그룹에도 동일 원칙 적용**: detail workload도 다중소속 배열 가능. 예: `apple-shared`(메타 도구)는 `apple-core` 하나에만 두어, 앱 개발자가 core를 고를 때만 따라온다.

이 스펙은 **새 교차소속을 만들지 않고**, 기존 메커니즘을 detail 레벨까지 그대로 확장한다.

### 4.5 워크로드 카탈로그 — `workloads.js` 재분할

**apple** 을 3개로 분할, **social-content** 를 3개로 분할:

```
apple          → apple-core, apple-platform, apple-product   (3분할)
social-content → social-voice, social-content, social-visual (3분할, social-content 는 재사용/축소)
```

**별칭(alias) — 확정**: 옛 키 `apple`·`social-content`은 **확장 별칭으로 유지**한다.
- `apple` → `{apple-core, apple-platform, apple-product}` 전체
- `social-content`는 **분할 후에도 "콘텐츠 제작" 그룹의 실제 키로 재사용**(아래 참조)하므로 별칭 불필요. 대신 옛 의미(17종 전체)를 원하면 `--workload=social-voice,social-content,social-visual`.
- 별칭 확장은 `select-assets.js`의 `selectGroups()` 진입 직후 1곳에서 처리 (`expandAliases(groups)` 헬퍼). 이렇게 해야 `--workload=apple`을 쓰는 기존 문서·CI·사용자 스크립트가 안 깨진다.

**자산 재태깅**: apple 23개 스킬, social 17개 스킬의 frontmatter `workloads:`를 새 하위 키로 갱신.

- apple 그룹핑 (CLAUDE.md "핵심/플랫폼/제품·운영/메타" 기준):
  - `apple-core` (10): ios, macos, swift, swiftui, design, testing, generators, security, performance, **shared**
    - `apple-shared`는 메타 도구(skill-creator/auditor + upstream LICENSE 위치)이나, 별도 그룹을 만들면 UX만 복잡해지므로 core에 귀속. 앱 개발 시작 = core 선택이므로 자연스럽다.
  - `apple-platform` (7): watchos, visionos, swiftdata, mapkit, foundation, core-ml, apple-intelligence
  - `apple-product` (6): product, app-store, growth, legal, monetization, release-review
  - 합계 23 = 10+7+6 ✓
- social 그룹핑 (CLAUDE.md 파이프라인 단계 기준):
  - `social-voice` (3): voice-builder, newsletter-voice, profile-optimizer
  - `social-content` (9): post-writer, post-formatter, hook-generator, content-matrix, niche-research, post-scorer, analytics-dashboard, pinned-comment, reels-scripting
  - `social-visual` (5): graphic-designer, gemini-carousel, gemini-infographic, quote-post, youtube-thumbnail
  - 합계 17 = 3+9+5 ✓

재태깅은 frontmatter 직접 Edit(정확) 또는 `workloads.js` RULES 갱신 후 `tag-assets.js`. RULES 기반 휴리스틱도 함께 갱신해 frontmatter 없는 자산 폴백을 새 키에 맞춘다.

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
| `scripts/install/menu.js` | detailOptions(leaf 부착) 지원, resolveSelection/parseCliFlags 확장 |
| `scripts/install/workloads.js` | apple/social 3분할, RULES 재태깅 반영, `expandAliases()` |
| `scripts/install/select-assets.js` | `selectGroups()`에서 별칭 확장 적용 |
| `scripts/install/select-workloads.js` | runInteractive 를 3-tier + 체크박스로 교체 |
| `install.sh` | 플로우: check-global → baseline → check-drift → 워크로드 → manifest write |
| `install.ps1` | 동일 플로우 (Node CLI 위임이라 로직 최소) |
| skills/apple-*, skills/(social) | frontmatter `workloads:` 재태깅 |
| `README.md` | L71(social 목록), L112(`--category=apple`), L122(writing 표), L161(카탈로그) 갱신 |
| `CLAUDE.md` | 워크로드 카탈로그·apple/social 설명 갱신 |
| `tests/scripts/install/*` | manifest·check-global·menu(detail)·checkbox·alias 테스트 |

## 6. 테스트

TDD. 각 신규 모듈은 순수 함수 위주로 테스트 가능하게 설계. 순수-로직(manifest/menu/workloads/alias)은 프로세스 없이 require 테스트, CLI·TUI는 자식 프로세스/스트림 모킹.

**신규/확장 단위 테스트**
- `manifest.test.js`: compareVersion (0.1.0<0.2.0, 0.1.0==0.1.0, 0.10.0>0.9.0 — 숫자비교), read(없음)→null, write→read 왕복, 손상된 JSON→null(throw 안 함)
- `check-global.test.js`: absent(매니페스트 없음), absent(_harness 링크 없음), outdated(낮은 버전), current — 임시 CLAUDE_HOME 픽스처
- `menu.test.js` (확장): (a) 카테고리 레벨 detail(apple)의 resolveSelection, (b) sub 레벨 detail(writing.social), (c) detail 빈 값→전체 상세, (d) parseCliFlags `--apple=core,platform` 및 `--writing-social=voice`, (e) **비-detail 노드 회귀**: mysql/rust 등이 기존과 동일 결과
- `workloads.test.js` (확장): 새 키(apple-core/platform/product, social-voice/content/visual) 카탈로그 존재, `expandAliases(['apple'])`→3키, `expandAliases(['mysql'])`→그대로, 새 RULES가 각 스킬을 올바른 그룹에 매핑
- `checkbox-prompt.test.js`: 키 입력 시퀀스(↓ space ↓ space enter)→선택 배열, `a`→전체 토글, ctrl-c→reject. raw-mode는 주입 가능한 fake stdin(EventEmitter)으로 테스트.
- `select-assets.test.js` (확장): 재태깅된 apple/social 자산이 새 키로 분류, `--workload=apple` 별칭이 23개 apple 스킬 전부 선택, 다중소속(python-patterns)이 backend·data 어느 쪽 선택으로도 선택됨

**회귀·통합**
- 비-TTY/CI 경로(`--all` 폴백, `--non-interactive --category=…`)가 동일 출력 유지
- `npm test`의 `validate-skills.js`·`validate-agents.js`가 재태깅된 frontmatter를 통과 (workloads 값이 스키마 허용 범위인지)
- `check-drift.js`가 새 키(apple-core 등)로도 정상 동작
- **드리프트 골든 체크**: 재태깅 전/후 `select-assets --workload=<옛 전체>` 자산 집합이 동일해야 함 (그룹만 쪼갰지 자산이 누락/추가되면 안 됨) — apple 23·social 17 카운트 불변 단언

## 7. 미해결 / 하위호환 (해소됨)

1. ~~옛 워크로드 키 별칭~~ → **해소**: `apple`은 3키 확장 별칭 유지, `social-content`는 실제 키로 재사용. §4.5 참조. `expandAliases()` 1곳 처리.
2. **manifest 부재 시 기존 사용자**: 변경 전 설치자는 manifest 없음→`absent`→baseline 재설치(멱등, --force 없으면 기존 링크는 "ok"로 skip). 안전, 최초 1회 baseline 재확인만. 허용.
3. **상세 tier 확장**: writing(tech), backend 등은 leaf 유지. 나중에 `detailOptions`만 붙이면 자동 확장(모델이 이미 leaf-부착 지원).
4. **apple-shared 귀속**: 메타 도구지만 `apple-core`에 포함(별도 그룹 안 만듦). §4.5 참조.

## 8. 스킵한 것 (YAGNI)

- npm TUI 라이브러리(enquirer 등) → raw-mode 직접 구현 (no-new-dep 정책)
- 개별 자산 단위 체크박스 선택 → 중분류를 쪼갠 그룹까지만
- 모든 카테고리 상세 tier → apple + social-content 두 곳만 우선
- 부분 업데이트(자산별 diff 설치) → drift 있으면 통째 --force 재링크
