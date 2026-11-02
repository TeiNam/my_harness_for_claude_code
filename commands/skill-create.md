---
name: skill-create
description: Analyze local git history to extract coding patterns and generate SKILL.md files. Local version of the Skill Creator GitHub App.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
workloads: [core]
---

# /skill-create - Local Skill Generation

Analyze your repository's git history to extract coding patterns and generate SKILL.md files that teach Claude your team's practices.

## Usage

```bash
/skill-create                    # Analyze current repo
/skill-create --commits 100      # Analyze last 100 commits
/skill-create --output ./skills  # Custom output directory
```

## What It Does

1. **Parses Git History** - Analyzes commits, file changes, and patterns
2. **Detects Patterns** - Identifies recurring workflows and conventions
3. **Generates SKILL.md** - Creates valid Claude Code skill files

## Analysis Steps

### Step 1: Gather Git Data

```bash
# Get recent commits with file changes
git log --oneline -n ${COMMITS:-200} --name-only --pretty=format:"%H|%s|%ad" --date=short

# Get commit frequency by file
git log --oneline -n 200 --name-only | grep -v "^$" | grep -v "^[a-f0-9]" | sort | uniq -c | sort -rn | head -20

# Get commit message patterns
git log --oneline -n 200 | cut -d' ' -f2- | head -50
```

### Step 2: Detect Patterns

Look for these pattern types:

| Pattern | Detection Method |
|---------|-----------------|
| **Commit conventions** | Regex on commit messages (feat:, fix:, chore:) |
| **File co-changes** | Files that always change together |
| **Workflow sequences** | Repeated file change patterns |
| **Architecture** | Folder structure and naming conventions |
| **Testing patterns** | Test file locations, naming, coverage |

### Step 3: Generate SKILL.md

Output format:

```markdown
---
name: {repo-name}-patterns
description: Coding patterns extracted from {repo-name}
version: 1.0.0
source: local-git-analysis
analyzed_commits: {count}
---

# {Repo Name} Patterns

## Commit Conventions
{detected commit message patterns}

## Code Architecture
{detected folder structure and organization}

## Workflows
{detected repeating file change patterns}

## Testing Patterns
{detected test conventions}
```

Before writing the file, check it against the Skill Layout Rules below.

## Skill Layout Rules

Anthropic 스킬 작성 가이드(2026-10 개정) 기준. 저장 전에 하나씩 확인한다.

1. **목차** — 100줄 넘는 참고 파일은 맨 위에 `## Contents` 를 둔다. Claude 는 긴 파일의 앞부분만 보고 더 읽을지 정한다.
2. **자유도** — 단계마다 "다르게 하면 무슨 일이 생기나"를 묻는다. 정답이 여러 개면 목표만 주고, 돈·삭제·배포·마이그레이션처럼 되돌리기 어려우면 스크립트나 "이 명령 그대로"로 잠근다.
3. **모델** — 최신 모델에는 과한 MUST·대문자 강조가 역효과고, Haiku 는 100줄 아래 규칙과 트리거 없는 description 을 놓치고, Haiku 5.5 는 스킬을 스스로 잘 부르지 않는다(위험 작업 스킬은 description 맨 앞에 "Use before …" 트리거). 핵심 안전 규칙은 앞쪽에 두고, 하네스 스킬이면 `npm run eval:skills -- --model haiku|sonnet|opus` 로 스킬 있음/없음을 비교한다(케이스는 `evals/skills/`). 공유할 스킬이면 검증한 모델을 본문 첫머리에 적는다.
4. **1단계 참조** — SKILL.md ≤ 500줄, 세부는 파일로 빼되 모든 파일을 SKILL.md 에서 직접 링크한다(파일→파일 사슬 금지).
5. **체크리스트** — 순서가 중요한 긴 작업에만 단계 목록을 주고, 검증 실패 시 "N단계로 돌아가라"를 넣는다.
6. **검사-수정 루프** — 산출물을 기준(스타일 가이드·rubric·테스트)과 대조→수정→재검사하고, 통과해야 끝낸다.
7. **설치 명시** — 스크립트·라이브러리를 쓰면 정확한 설치 명령을 실행 직전에 적는다("이미 있으면 건너뛴다").

하네스 `skills/` 에 둘 때는 `node scripts/ci/validate-skills.js` 가 1·4번을 검사하고, `--fix-toc` 가 목차를 넣는다.

## Example Output

Running `/skill-create` on a TypeScript project might produce:

```markdown
---
name: my-app-patterns
description: Coding patterns from my-app repository
version: 1.0.0
source: local-git-analysis
analyzed_commits: 150
---

# My App Patterns

## Commit Conventions

This project uses **conventional commits**:
- `feat:` - New features
- `fix:` - Bug fixes
- `chore:` - Maintenance tasks
- `docs:` - Documentation updates

## Code Architecture

```
src/
├── components/     # React components (PascalCase.tsx)
├── hooks/          # Custom hooks (use*.ts)
├── utils/          # Utility functions
├── types/          # TypeScript type definitions
└── services/       # API and external services
```

## Workflows

### Adding a New Component
1. Create `src/components/ComponentName.tsx`
2. Add tests in `src/components/__tests__/ComponentName.test.tsx`
3. Export from `src/components/index.ts`

### Database Migration
1. Modify `src/db/schema.ts`
2. Run `pnpm db:generate`
3. Run `pnpm db:migrate`

## Testing Patterns

- Test files: `__tests__/` directories or `.test.ts` suffix
- Coverage target: 80%+
- Framework: Vitest
```

## GitHub App Integration

For advanced features (10k+ commits, team sharing, auto-PRs), use the [Skill Creator GitHub App](https://github.com/apps/skill-creator):

- Install: [github.com/apps/skill-creator](https://github.com/apps/skill-creator)
- Comment `/skill-creator analyze` on any issue
- Receives PR with generated skills

## Related Commands

- `/learn` — 세션에서 재사용 가능한 패턴을 스킬 1개로 추출
- `/lessons` — 반복 교정 교훈을 한 줄씩 누적

---

*Part of [Everything Claude Code](https://github.com/affaan-m/everything-claude-code)*
