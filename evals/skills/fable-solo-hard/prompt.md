---
max_turns: 8
allowed_tools: [Read, Glob, Grep, Skill]
---

Opus 로 effort 를 xhigh 까지 올려 두 번 시도했는데 못 잡은 버그야. 간헐적으로 결제 웹훅이 중복 처리돼.

지금까지 확인한 것: 멱등성 키는 저장하고 있음. 락은 Redis SETNX + TTL 30초. 재현은 부하 테스트에서 200건 중 1건꼴. Opus 는 두 번 다 "락 TTL 을 늘리자"고 했는데 늘려도 재현됨.

어떻게 진행할지 말해줘. 아직 실행하지는 마.
