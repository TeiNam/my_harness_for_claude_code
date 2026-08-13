# Workload-based Install — 메뉴 구조 상세

> CLAUDE.md 에서 옮겨온 상세. 설치 메뉴·워크로드 키·자산 선정을 손볼 때 읽는다.

## Workload-based Install (2-tier 메뉴)

설치는 **도메인 축 6개 톱레벨 카테고리**(**dev / cloud / ai / data / research / writing**) 와 중분류(sub-옵션)·상세로 결정되는 **3단계(대분류→중분류→소분류)** 메뉴다. sub-옵션이 곧 워크로드 키와 매칭되어, 예컨대 "데이터 → MySQL" 만 골랐을 때 Postgres 가이드까지 끌려오지 않는다. 대분류 구성:
  - **dev**(개발): frontend · 백엔드(python-backend/rust/nodejs) · 플러그인(obsidian/chrome/claude)
  - **cloud**(AWS 운영): 인프라·컨테이너(cloud+devops) · finops · integration
  - **ai**: ai(Bedrock·SageMaker·Kendra 등)
  - **data**: 분석(python-data/data-analysis) · 설계(mysql/postgres/mongodb/dynamodb/aws-rds)
  - **research**(리서치·리포트): 웹 검색(research) · 기술 리포트(report=tech-writer)
  - **writing**(글쓰기): 일반 글쓰기(writing) · 소셜(상세 3그룹 `social-voice`/`social-content`/`social-visual`)
  상세 tier(3단째)는 자산이 많은 writing.social(17) 한 중분류에만 붙였고, 나머지는 leaf(3단계 미진입)다. 옛 카테고리(backend/plugin/data-design/data-analysis 톱레벨)는 이 도메인 축으로 재편되면서 dev·data 등으로 흡수됐다.

- 톱레벨 카테고리 → sub-옵션 → 상세(`detailOptions`) 매핑은 `scripts/install/menu.js` 한 곳에서 정의된다. `detailOptions` 는 leaf 가 될 수 있는 노드(subOptions 없는 category, 또는 subOption)에 부착한다.
- 워크로드 키 카탈로그는 `scripts/install/workloads.js` (`core, research, report, python-backend, python-data, rust, nodejs, cloud, devops, finops, integration, aws-rds, data-analysis, ai, frontend, obsidian, plugin-chrome, plugin-claude, mysql, postgres, mongodb, dynamodb, writing, social-voice, social-content, social-visual`). `core` 는 **최소 baseline**(github·context7·time·fetch MCP + 범용 에이전트)만 담고, 메뉴 경로에서는 여기에 `writing`·`report` 가 더해진다(`menu.js` 의 `ALWAYS_INCLUDED` — 글·문서 작업 비중이 높아 고르지 않아도 따라온다). `--workload=` 로 직접 지정하면 이 baseline 은 적용되지 않는다. AWS MCP 분류용 키 — `devops`(IaC·컨테이너·서버리스·관측성)·`finops`(비용·요금)·`integration`(SNS·SQS·MQ·Step Functions)·`aws-rds`(Aurora·RDS·DSQL·Keyspaces, 로컬 DB설계와 분리)·`data-analysis`(Glue·Athena·Redshift·Neptune) — 로 `cloud` 통짜 바구니를 막는다. `research`(exa·brave·deep-researcher, 웹 검색·자료조사)·`report`(tech-writer 계열, 기술 리포트)는 각각 core·writing 에서 분리했다. `expandAliases()` 는 옛 통짜 키를 하위 키로 확장하는 자리이며 현재 ALIASES 는 비어 있다(마지막 별칭 `apple` 은 Apple 스킬 제거와 함께 사라졌다). `lab` 은 메뉴에 노출되지 않는 수동 전용 키로 (`--workload=...,lab`), humanize 메타 에이전트 격리에만 쓴다.
- 설치 시작 시 `scripts/install/check-global.js` 가 글로벌 baseline 상태(`absent`/`outdated`/`current`)를 판정한다 — `$CLAUDE_HOME/_harness-manifest.json`(설치 종료 시 `manifest.js` 가 기록: version·workloads·installedAt) 의 버전을 repo `VERSION` 과 비교. 심볼릭 설치는 멱등이라 세 상태 모두 링크 루프를 그대로 태우고, 사용자에겐 상태만 알린다.
- 진입점은 `scripts/install/select-workloads.js` 로, 다음 셋 중 하나를 자동으로 고른다:
  - 메뉴 CLI 플래그(`--category=`, `--dev=`, `--data=`, `--writing-social=` …) 가 있으면 비대화형으로 그 값 사용
  - 인자가 없고 TTY 면 방향키 체크박스 3단계 메뉴(`scripts/install/checkbox-prompt.js`, 의존성 0)
  - 그 외엔 `--all` 폴백
- 결정된 워크로드는 `scripts/install/select-assets.js` 로 넘어가 자산 frontmatter `workloads:` 와 교집합 매칭 → `kind\tsource\ttarget` 라인 출력 → install.sh / install.ps1 가 파일별 심볼릭 링크로 `$CLAUDE_HOME/<kind>s/_harness/...` 에 설치한다. 워크로드 흐름에 들어오는 kind 는 **agent·command·skill·rule** 4종뿐이다.
- **워크로드 외(hooks·mcp) 추가 설치 프롬프트**: hooks·mcp 는 워크로드 분류 밖(별도 파일, 통째 설치)이라, 워크로드 자산 설치 후 **TTY 면 두 번 물어본다** — (1) hooks 를 settings.json 에 머지할지, (2) MCP proxy 를 `docker compose up -d` 로 기동할지. 둘 다 기본값 N. `--with-hooks`(`-WithHooks`) 를 주면 hooks 는 묻지 않고 바로 머지하고, `--with-mcp`(`-WithMcp`) 를 주면 MCP proxy 를 묻지 않고 바로 기동한다(둘 다 비대화형에서도 동작; docker/데몬/compose 미비 시 경고만 하고 넘어감 — `setup_mcp_proxy`/`Set-McpProxy`). `--no-extras`(`-NoExtras`) 또는 비대화형(파이프/CI)이면 프롬프트를 건너뛰고 워크로드만 설치(기존 동작 보존). MCP 는 proxy-first(`mcp-configs/proxy/` compose 스택)이고, 클라이언트 `.mcp.json` 은 프록시 서버를 `localhost:9090/<서버>/mcp` URL 로, 로컬 서버(sentry·playwright)는 직접 명령으로 참조한다.
- repo-root 링크 `$CLAUDE_HOME/_harness` 는 항상 생성된다 — `hooks/hooks.json` 의 inline bootstrap 이 root 후보로 본다. 부트스트랩 우선순위: `$CLAUDE_PLUGIN_ROOT` → `$CLAUDE_PROJECT_DIR/.claude(_harness)` → `$HOME/.claude(_harness, plugins/_harness)`. 따라서 `CLAUDE_HOME` 을 프로젝트 로컬로 둬도 (예: `$PWD/.claude`) `CLAUDE_PROJECT_DIR` 만 주입되면 동작한다.
- `--with-hooks` 로 hooks 를 머지하고 `CLAUDE_HOME` 이 `$HOME/.claude` 가 아닌 경우, 일부 환경 (CLAUDE_PROJECT_DIR 미주입 등) 을 위한 안전망으로 `$HOME/.claude/_harness` 보조 링크가 함께 생성된다. 끄려면 `--no-home-link` (`-NoHomeLink`).
- 자산 추가: 파일을 두고 frontmatter 에 `workloads: [...]` 만 적으면 끝. 휴리스틱에 맡길 수도 있다. 일괄 재태깅은 `node scripts/install/tag-assets.js --apply --force`.
- 저수준 모드: `--workload=python-backend,mysql` 를 직접 지정하면 메뉴를 무시하고 그 값만 사용한다.
- **드리프트 점검**: `npm run check-drift [-- --workload=core]` (= `scripts/install/check-drift.js`). `--workload` 미지정 시 `$CLAUDE_HOME/_harness-manifest.json` 의 설치 워크로드를 기본값으로 사용한다(매니페스트 없으면 전 그룹) — 수동 전용 `lab` 그룹이 영구 오탐 드리프트로 잡히는 것을 방지. 선택 워크로드 기준으로 "레포가 깔아야 할 자산" vs "실제 `$CLAUDE_HOME` 심볼릭"을 대조해 missing / wrong-target / broken 을 보고하고 drift 가 있으면 exit 1 + `./install.sh --force` 안내. 읽기 전용 — 링크를 만들거나 지우지 않는다. "자산은 옛 상태로 stale 인데 훅만 풀 주입" 같은 어긋남을 한 방에 드러내려는 용도(과거 글로벌이 거의 비어 있었던 사고의 재발 방지).
- 테스트: `tests/scripts/install/{workloads,menu,select-workloads,select-assets,tag-assets,merge-hooks,manifest,check-global,checkbox-prompt}.test.js`.
