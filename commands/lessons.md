---
description: 경량 lessons-learned 교훈 로그를 조회·추가하거나, 안정된 교훈을 steering 규칙으로 승격한다.
workloads: [core]
---

# /lessons — 교훈 로그 관리

`lessons-learned` skill 의 한 줄 교훈 로그를 다룬다. `capture-lessons` hook 이
Stop 시점에 반복 교정을 감지해 제안하지만, 이 커맨드로 직접 조회·추가·승격할 수 있다.

## 인자

- `(없음)` 또는 `list` — 현재 누적된 교훈을 카테고리별로 보여준다.
- `add` — 이번 세션에서 반복된 교정을 분석해 한 줄 교훈을 제안하고, 확인 후 추가한다.
- `promote` — 안정적으로 반복되는 교훈을 골라 steering 규칙(`rules/`)으로 승격 제안한다.

## lessons-learned 파일 위치

설치 방식에 따라 다음 중 존재하는 것을 사용한다:

- 플러그인/심볼릭 링크: `${CLAUDE_PLUGIN_ROOT}/skills/lessons-learned/SKILL.md`
- 글로벌 설치: `~/.claude/skills/_harness/lessons-learned/SKILL.md`
- 그 외: `~/.claude/skills/lessons-learned/SKILL.md`

`## Lessons` 섹션 아래의 세 카테고리(`Review findings`, `Build failure patterns`,
`User corrections`)에 한 줄씩 누적한다.

## list

파일의 `## Lessons` 이하를 읽어 카테고리별로 항목을 출력한다. 비어 있으면
"아직 누적된 교훈이 없습니다" 라고 알린다.

## add

1. 현재 세션에서 같은 유형으로 **반복된** 교정을 찾는다:
   - 동일 유형의 리뷰 지적 (에러 처리 누락, 가변 변경, 입력 검증 누락 등)
   - 반복된 빌드/린트/테스트 실패와 근본 수정
   - 사용자가 두 번 이상 준 명시적 정정
2. 일회성·사소한 것(오타, 단발 API 오류)은 제외한다.
3. 다음 포맷으로 한 줄 교훈을 **제안**한다:

   ```
   - [YYYY-MM-DD] (category) <트리거 / 맥락> -> <규칙으로 진술한 교훈>
   ```

4. 사용자에게 보여주고 **확인을 받은 뒤에만** 해당 카테고리 아래에 추가한다.
5. 자동 편집 금지 — 항상 확인을 거친다.

## promote

1. 로그에서 여러 번 등장했거나 명백히 일반적인 교훈을 고른다.
2. `rules/` 의 적절한 위치(공통이면 `rules/common/`, 언어별이면 해당 폴더)에
   넣을 규칙 초안을 제안한다.
3. 사용자 확인 후 규칙 파일에 반영하고, 승격된 교훈은 로그에서 제거하거나
   "(promoted)" 표시를 남긴다.

## 다른 학습 장치와의 관계

- 더 무거운 패턴(재사용 skill 1개) 은 `/learn`.
- 자동 관찰 기반 instinct 는 `/promote`·`/evolve` (continuous-learning-v2).
- 이 커맨드는 그 중간 — 가벼운 한 줄 교훈 누적과 규칙 승격.
