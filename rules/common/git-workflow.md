# Git Workflow

## 파이프라인 (항상 이 순서)

코드 변경을 반영하는 방법은 **하나뿐**이다: `브랜치 → 커밋 → 푸시 → PR → 머지`.
"작은 변경이라서", "문서만 고쳐서", "이미 main 에 있으니" 는 예외 사유가 아니다.

```bash
git switch -c <type>/<slug>          # 1. feat/, fix/, refactor/, docs/, chore/ …
git commit -m "<type>: <설명>"       # 2. 커밋 (여러 개 가능)
git push -u origin <branch>          # 3. 푸시
gh pr create --fill                  # 4. PR (본문은 아래 규칙대로 작성)
gh pr merge --squash --delete-branch # 5. 머지 + 브랜치 정리
git switch main && git pull          # 6. 로컬 동기화
```

**기본 브랜치(`main`/`master`)에 직접 커밋·푸시하지 않는다.** 이미 main 에서
작업을 시작해버렸으면 커밋 전에 `git switch -c <branch>` 로 옮긴다.

세션에서 사용자가 "커밋해줘", "푸시해줘", "PR 올려줘" 중 **일부만** 말했더라도
파이프라인의 남은 단계까지 이어서 수행한다. 중간에 멈춰 세울 이유(리뷰 대기,
CI 확인 등)가 있으면 멈추는 이유를 한 줄로 말한다.

### 예외 (직접 푸시 허용)

- 사용자가 명시적으로 "main 에 직접" 이라고 지시한 경우
- 릴리스 태그 푸시 (`git push --tags`)
- 원격이 없는 로컬 전용 레포

강제 게이트: `pre:bash:git-push-reminder` 훅이 기본 브랜치 푸시를 감지해
`strict` 프로파일에서 차단, 그 외 프로파일에서 경고한다. 의도적 직행은
`HARNESS_ALLOW_MAIN_PUSH=1`.

## Commit Message Format
```
<type>: <description>

<optional body>
```

Types: feat, fix, refactor, docs, test, chore, perf, ci

Note: Attribution disabled globally via ~/.claude/settings.json.

## Pull Request Workflow

When creating PRs:
1. Analyze full commit history (not just latest commit)
2. Use `git diff [base-branch]...HEAD` to see all changes
3. Draft comprehensive PR summary
4. Include test plan with TODOs
5. Push with `-u` flag if new branch

> For the full development process (planning, TDD, code review) before git operations,
> see [development-workflow.md](./development-workflow.md).
