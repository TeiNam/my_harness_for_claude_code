# MCP 설정 (proxy-first)

`proxy/` 가 mcp-proxy compose 스택을 들고 있고, `mcp-servers.json` 카탈로그가 SSOT 다 —
각 서버에 `route: proxy|local` 과 `workloads: [...]` 를 표시한다.

설치 시 `scripts/install/build-mcp-config.js` 가 선택 워크로드와 매칭되는 `route=proxy`
서버만 골라 `proxy/config.json` 을 빌드한다. `terraform` 을 선택하면 compose 의
`terraform-mcp` profile 을 동반 기동한다.

---

## 함정: `--with-mcp` 는 config.json 을 워크로드 전체 기준으로 덮어쓴다

AWS 세분 워크로드(`cloud`·`ai`·`devops`·`finops`·`aws-rds`·`data-analysis`·`integration`)를
다 켜면 **65개**가 된다. 2026-08-14 실측 사고:

- 디스크 9Gi 소비
- 프록시 메모리 3.0GiB (VM 4GiB 의 80%)
- MCP 도구 목록으로 컨텍스트 잠식

그래서 **커밋된 `proxy/config.json`(9개)이 실사용 SSOT** 다:

```
github · exa · context7 · brave-search · time · fetch · aws-documentation · obsidian · terraform
```

빌더는 `RECOMMENDED_MAX` 초과 시 stderr 로 경고한다 — 설치 출력을 잘라 읽다가 그 경고를
놓치면 위 사고가 재현된다.

## 그래서 이렇게 쓴다

```bash
# MCP 만 다시 띄울 때: --with-mcp 를 쓰지 않는다
cd mcp-configs/proxy && docker compose --profile terraform up -d

# 서버 목록을 바꿀 때만 명시 빌드
node scripts/install/build-mcp-config.js --servers=a,b,c
```
