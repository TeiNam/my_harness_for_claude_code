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

## 재구축 시 걸리는 것 (2026-08-30 실측)

컨테이너·이미지가 0인 상태에서 다시 띄우며 밟은 순서다.

1. **`docker compose` 가 없다고 나온다** — Homebrew 의 `docker-compose` formula 는 플러그인
   바이너리를 `$(brew --prefix)/lib/docker/cli-plugins/` 에만 두고 `~/.docker/cli-plugins/` 로
   링크하지 않는다. `docker-compose`(하이픈)만 되고 `docker compose`(v2)는 "unknown command"다.
   ```bash
   mkdir -p ~/.docker/cli-plugins
   ln -sfn /opt/homebrew/lib/docker/cli-plugins/docker-compose ~/.docker/cli-plugins/docker-compose
   ```
2. **`mcpProxy.version is required` 로 부팅 루프** — 이미지가 `:latest` 라서 상류 스키마가
   v1 → v2 로 올라가면 기존 config 가 거부된다. `config.json` 과 빌더(`build-mcp-config.js`)
   양쪽에 `mcpProxy.version` 을 넣었다. **스키마가 또 바뀔 수 있다는 뜻이므로**, 재구축이
   실패하면 먼저 `docker logs harness-mcp-proxy` 를 보고 상류
   `docs/CONFIGURATION.md` 와 대조한다.
3. **키가 필요한 2개는 따로** — 9개 중 `brave-search`·`obsidian` 만 `.env` 값을 요구하고,
   비어 있으면 그 둘만 `transport closed` 로 죽고 나머지 7개는 정상 연결된다.
   `.env` 위치는 **compose 와 같은 디렉터리**(`mcp-configs/proxy/.env`, `.gitignore` 대상)다.
4. **`playwright` 는 프록시에 넣지 않는다** — 카탈로그에서 `route: "local"` 이다. 컨테이너 안에
   브라우저가 없으므로 호스트 stdio 로 등록한다: `claude mcp add -s user playwright -- npx -y
   @playwright/mcp --headless --browser chromium`.
   **`--browser chromium` 을 빼면 도구 호출이 실패한다** — 기본값이 채널 `chrome`(실제
   Google Chrome.app)이라서 `Chromium distribution 'chrome' is not found` 가 난다. 서버는
   정상 연결되므로(`/mcp` 는 초록) 첫 `browser_*` 호출에서야 드러난다. 번들 브라우저는
   `npx playwright install chromium` 로 한 번 받는다(~95MB → `~/Library/Caches/ms-playwright`).
