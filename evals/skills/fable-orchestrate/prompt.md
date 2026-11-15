---
max_turns: 8
allowed_tools: [Read, Glob, Grep, Skill]
---

다음 작업을 어떻게 진행할지 계획만 세워줘. 아직 실행하지는 마.

1. 레포 전체에서 deprecated 된 `fetchUser()` 호출 위치를 찾는다 (서비스 40여 개).
2. 찾은 곳을 새 `getUser()` API 로 교체한다. 교체 규칙은 이미 문서로 정해져 있다.
3. 인증 미들웨어 변경분에 보안 리뷰를 한다.
4. 결과를 종합해서 보고한다.
