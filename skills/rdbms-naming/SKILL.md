---
name: rdbms-naming
description: >
  RDBMS 공통 네이밍·데이터 타입 컨벤션 (MySQL·PostgreSQL 공유 단일 소스).
  테이블/컬럼 snake_case, 단수형, 능동태(날짜·시간 컬럼 예외), prefix/postfix,
  약어 정의서, 컬럼 접두·접미 체계, 인덱스 명명(_IDX/_UIDX/_FTX), 데이터 타입
  선택. 트리거: 테이블/컬럼/인덱스 설계, DDL 작성, 스키마 리뷰, 네이밍 컨벤션,
  snake_case, 약어, PK/FK 명명, boolean 컬럼, DECIMAL, 정산 금액 컬럼.
origin: custom
workloads: [mysql, postgres]
---

# RDBMS Naming Conventions

**네이밍 거버넌스**(snake_case·단수형·능동태·prefix/postfix·약어·인덱스 명명)는
MySQL·PostgreSQL 공통이라 이 스킬이 **단일 소스**다. **데이터 타입**은 엔진마다
다르므로 아래 "데이터 타입 (DB별)" 표에서 대상 DB 칼럼만 적용하고, 더 깊은 내용은
`mysql-guideline` / `postgres-guideline` 을 본다.

## When to Activate

테이블·컬럼·인덱스를 새로 만들거나, DDL 을 작성·리뷰하거나, 네이밍 컨벤션을
판단할 때. RDBMS(MySQL/PostgreSQL) 대상.

## 공통 규칙

- **snake_case**: 모든 식별자는 소문자 + 언더스코어. `authUser` → `auth_user`.
- **직관적 기술형**: 이름만 보고 무엇인지 명확하게. 막연한 `log` 대신
  `delivery_log` / `order_log`. 되도록 쉬운 단어.
- **능동태**: 동사는 능동태. `create_date` (not `created_date`). 동명사는 허용.
  - **예외 — 날짜/시간 컬럼**: `created_at` · `updated_at` 같은 관용 표기는
    그대로 둔다. ORM·프레임워크 관례가 강하므로 능동태 강제 대상에서 제외.
- **예약어 금지**: DB 고유 예약어를 식별자로 쓰지 않는다.
  (MySQL: dev.mysql.com/doc/refman/8.0/en/keywords.html)

## 테이블 / 컬럼

- **단수형**: 테이블명은 단수. `users` → `user`.
- **postfix 금지 / prefix 제한**: `tb_user`·`user_tbl` → `user`. prefix 는
  마스터 테이블에 종속된 속성 테이블 구분에만. 예: `user_auth`(마스터 `user`의
  하위), `book_like`(마스터 `book`의 하위).
- **약어 제한**: 되도록 약어를 피한다. 써야 하면 소문자 + **약어 정의서**에
  등록해 팀 전체에 전파. `create_dt` → `create_date`, `user_cd` → `user_code`.

### 컬럼 접두/접미 체계

| 용도 | 규칙 | 예시 |
|------|------|------|
| PK | `<table>_id` | `user_id` |
| FK | `<parent_table>_id` | `user_id` |
| 날짜 (DATE) | `<목적>_date` | `create_date` |
| 날짜+시간 (DATETIME) | `<목적>_at` | `created_at` |
| 코드 | `<목적>_code` | `user_code` |
| 숫자 | `<목적>_no` | `order_no` |
| Boolean | `<컬럼>_yn` | `use_yn` |

## 약어 정의서

원칙: 너무 긴 단어 중 약어로 충분한 단어만 합의하에 사용. 규칙은 **최소한**.

| 대상 | 약어 |
|------|------|
| number | `no` |
| address | `addr` |
| episode | `ep` |
| transaction | `tx` |
| count | `cnt` |
| authentication | `auth` |
| introduce | `intro` |

## 인덱스 네이밍

구조: 인덱스를 만들 테이블과 포함 컬럼을 **조건 순서대로** 기술하고,
**접미사는 대문자**로 붙인다.

```
<table>_<col1>_<col2>_..._IDX
```

| 유형 | 접미사 | 예시 |
|------|--------|------|
| 일반 | `_IDX` | `book_like_user_id_IDX` |
| Unique | `_UIDX` | `book_uuid_UIDX` |
| Fulltext | `_FTX` | `book_name_FTX` |

복합 인덱스 예: `actor(first_name, last_name, last_update)` →
`actor_first_name_last_name_last_update_IDX`.

## 데이터 타입 (DB별)

타입 선택은 DB 엔진마다 다르다. **공통 원칙**(아래)을 따르되, 구체 타입은
대상 DB 칼럼을 본다. 더 깊은 타입 표는 `mysql-guideline` / `postgres-guideline`.

### 공통 원칙 (DB 무관)

- **PK 는 정수 계열 (UUID 지양)**: 첫 컬럼 PK `id` 는 auto-increment 정수
  (`int`/`bigint`)로 한다. 정렬·인덱스 지역성·스토리지가 UUID 보다 유리.
  UUID 는 **여러 DB·샤드에서 분산 생성**해야 할 때만(중앙 시퀀스 불가) 쓴다.
  단일 DB 면 정수 PK 가 기본.
  - **MySQL**: `AUTO_INCREMENT` (예: `id int unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY`)
  - **PostgreSQL**: `GENERATED ALWAYS AS IDENTITY` (예: `id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY`)
- **금액/정산**: 부동소수점(`float`/`double`/`real`) **절대 금지** → 고정소수점.
  기본 스케일 `(10,2)`; 통화·정밀도에 따라 조정(원화 `(15,2)`, 비율 `(5,4)`).
- **JOIN 키**: 정수 계열로 하고, 조인 양쪽 컬럼의 **타입을 동일하게** 맞춘다.
- **문자열**: 고정 자릿수 `CHAR(n)`, 가변 `VARCHAR(n)`.
- **NULL 지양**: 인덱스가 잡히는 컬럼은 NULL 지양 — 정규화 테이블로 분리 후
  JOIN 권장. 사이즈가 작거나 사용처가 적으면 NULL 허용.

### 타입 매핑

| 용도 | MySQL | PostgreSQL |
|------|-------|------------|
| Boolean | `CHAR(1)` 'Y'/'N' 권장 (0→NULL/falsy 오인 회피) 또는 `tinyint(1)` 0/1. native boolean 없음 | **native `boolean`** 사용. 'Y'/'N' 문자열 금지 |
| PK (auto, 정수) | **`AUTO_INCREMENT`** — `int`/`bigint unsigned` (표준 방식) | **`GENERATED ALWAYS AS IDENTITY`** — `int`/`bigint` (표준 방식). `SERIAL` 은 쓰지 않는다 (proprietary; IDENTITY 가 SQL 표준·실수 방지·권한 단순) |
| 금액 | `DECIMAL(p,s)` | `numeric(p,s)` |
| 날짜+시간 | `datetime` (+`DEFAULT CURRENT_TIMESTAMP`) | `timestamptz` (타임존 필수) |
| 날짜 | `date` | `date` |
| 긴 텍스트 | `TINYTEXT`(256B)/`TEXT`(64KB)/`MEDIUMTEXT`(16MB)/`LONGTEXT`(4GB) 4단계 | 가변 `text` **단일** (길이 구분 없음) |
| JSON | `json` (8.0+ native) | `jsonb` (인덱싱 지원, `json` 아님) |
| 양수 전용 | `UNSIGNED` 옵션 | UNSIGNED 없음 → `CHECK (col >= 0)` |
| 자릿수 표시 고정 | `INT(n) ZEROFILL` | 표시폭/ZEROFILL 개념 없음 → 앱·`LPAD` 처리 |
| 외부 ID (PK 아님) | `char(36)`/`binary(16)` UUID | `uuid` (`gen_random_uuid()`) |
| IP 주소 | `varchar(45)` | `inet` (native) |
| 배열 | (없음 → 정규화 or JSON) | `type[]` (e.g. `text[]`) |

> MySQL 고유: `UNSIGNED`, `ZEROFILL`, TEXT 4단계, `AUTO_INCREMENT`.
> PostgreSQL 고유: native `boolean`, `timestamptz`, `jsonb`, `inet`, 배열,
> `IDENTITY`, `numeric`. 둘을 섞어 쓰지 말고 대상 DB 칼럼만 적용한다.

## Bad / Good 요약

| Bad | Good | 이유 |
|-----|------|------|
| `authUser` | `auth_user` | snake_case |
| `users` | `user` | 단수형 |
| `tb_user` | `user` | 불필요한 prefix |
| `created_date` | `create_date` | 능동태 (날짜 컬럼은 `created_at` 예외) |
| `create_dt` | `create_date` | 약어 남용 |
| `idx_book_user` | `book_user_id_IDX` | 접미사 대문자, 테이블+컬럼 순 |

## Related

- `mysql-guideline` — MySQL 고유 기본값·타입·금지사항. 이 규칙을 기반으로 함.
- `postgres-guideline` — PostgreSQL 고유 차이(text 단일 타입, IDENTITY, UNSIGNED 미지원 등).
- `rdbms-data-modeler` agent — 정규화·테이블 설계 시 이 컨벤션을 적용.
