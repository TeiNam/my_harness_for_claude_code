# JDBC Driver / Connector Selection (Java)

Aurora MySQL · RDS MySQL 에 Java 로 붙을 때 드라이버 선택과 페일오버 설정.
버전은 시간이 지나면 바뀌므로 릴리스 페이지로 재확인한다(아래 Sources).

## 권장: AWS Advanced JDBC Wrapper

Aurora/RDS 라면 **AWS Advanced JDBC Wrapper** 가 1순위. 클러스터 토폴로지를
실시간 캐시하고 DNS 해석 지연을 우회해, 페일오버 시 복구를 분(minutes) 대신
초(seconds) 단위로 줄인다. Aurora MySQL·Aurora PostgreSQL·RDS Multi-AZ 클러스터
모두 지원(과거 "Aurora MySQL 3 전용"이 아님).

- **최신: v4.1.0** (2026-06 기준). 확인: github.com/aws/aws-advanced-jdbc-wrapper/releases
- 과거 명칭 "Aurora JDBC Advanced Wrapper" 의 현재 공식 명칭.
- **밑단(underlying) 드라이버가 따로 필요** — wrapper 는 래퍼다. MySQL Connector/J
  (또는 MariaDB Connector/J)를 함께 의존성에 넣는다. v4.1.0 은 MySQL
  Connector/J 9.7.0, MariaDB Connector/J 3.5.9 를 번들·검증.

### 의존성 (Maven 좌표)

```
software.amazon.jdbc:aws-advanced-jdbc-wrapper   # + mysql-connector-j
```
(Federated Auth 환경이 아니면 `-bundle-federated-auth` 가 아닌 일반 JAR 권장.)

### 연결

```
# 드라이버 클래스: software.amazon.jdbc.Driver
# URL 프로토콜: jdbc:aws-wrapper:mysql://
jdbc:aws-wrapper:mysql://my-cluster.cluster-xyz.us-east-2.rds.amazonaws.com:3306/db
```

- 기본 활성 플러그인: `initialConnection,auroraConnectionTracker,failover2,efm2`
  — **failover2(Failover Plugin v2)와 efm2 가 기본**이라 별도 설정 없이 빠른
  페일오버가 켜진다. 커스터마이즈는 `wrapperPlugins` 로 (예: `iam,failover2`).
- IAM 인증·Secrets Manager·읽기/쓰기 분리(read/write splitting) 등은 플러그인
  추가로.

## 드라이버 비교

| 드라이버 | 권장 | 비고 |
|----------|------|------|
| **AWS Advanced JDBC Wrapper** | 1순위 (Aurora/RDS) | 토폴로지 캐시 + DNS 우회로 초 단위 페일오버, failover2 기본, R/W split·IAM·Secrets 플러그인 |
| **MySQL Connector/J** | 가능 (wrapper 의 밑단 or 단독) | 단독 사용 시 페일오버 자동 감지 약함 — 아래 튜닝 필요. 최신 9.x |
| **MariaDB Connector/J** | 조건부 | 3.x 는 Aurora 미지원 이슈 — Aurora 면 wrapper 의 밑단으로만 쓰거나 피한다 |
| **Aurora JDBC Driver** (구) | 사용 금지 | EOL |

## 단독 드라이버 사용 시 페일오버 튜닝

wrapper 없이 MySQL Connector/J 를 단독으로 쓰면 **Primary/Secondary 전환을
자동 감지하지 못해** 기본 설정에서 페일오버 감지에 ~15분이 걸릴 수 있다. 방어:

- 커널 `tcp_retries2`: 기본(~15분) → 최소 5분 수준으로 하향.
- JDBC `socketTimeout` / `connectTimeout` 을 낮은 값으로 설정해 끊긴 연결을
  빨리 감지.
- 애플리케이션 레벨 재시도·연결 검증(헬스 체크) 로직을 둔다.

> Aurora/RDS 라면 이런 수동 튜닝 대신 **AWS Advanced JDBC Wrapper 를 쓰는 것이
> 정석**이다. 단독 드라이버 튜닝은 wrapper 를 못 쓰는 환경의 차선책.

## Sources

- AWS Advanced JDBC Wrapper — github.com/aws/aws-advanced-jdbc-wrapper (releases / docs/using-the-jdbc-driver)
- Failover Plugin v2 — docs/using-the-jdbc-driver/using-plugins/UsingTheFailover2Plugin.md
- 버전·번들 드라이버는 릴리스 노트로 재확인 (위 v4.1.0 은 2026-06 기준)
