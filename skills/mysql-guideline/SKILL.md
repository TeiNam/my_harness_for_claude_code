---
name: mysql-guideline
description: >
  MySQL 8.0+ 스키마 설계, 테이블/인덱스 생성, 쿼리 최적화, 파티셔닝,
  커넥션 관리에 적용. 트리거: CREATE TABLE, ALTER TABLE, slow query 분석,
  index 설계, RANGE partition, MySQL migration, utf8mb4, InnoDB,
  트랜잭션 관리, UPSERT, Covering Index, 복합 인덱스 관련 작업.
origin: custom
workloads: [mysql]
---

# MySQL Database Guideline

## When to Activate

- Writing MySQL queries or migrations
- Designing MySQL database schemas
- Troubleshooting slow queries
- Creating partitioned tables
- Setting up connection management

## MySQL Version and Defaults
- MySQL 8.0.40+
- Character set: utf8mb4, utf8mb4_general_ci
- Engine: InnoDB

## Naming Rules

공통 RDBMS 네이밍(snake_case, 단수형, 능동태+날짜컬럼 예외, prefix/postfix 규칙,
약어 정의서, 컬럼 접두·접미 체계, 데이터 타입)은 **`rdbms-naming` 스킬을 단일
소스로 따른다.** 요약:

- Tables/Columns: snake_case, 테이블은 단수형 (e.g. `user`, `user_chat_setting`, `user_id`)
- 능동태: `create_date` — 단, 날짜+시간 컬럼은 `created_at`/`updated_at` 예외
- 인덱스: 테이블+컬럼을 조건 순서대로, **접미사 대문자**
  - 일반 `<table>_<col>_IDX` · Unique `_UIDX` · Fulltext `_FTX`
  - 예: `book_like_user_id_IDX`, `book_uuid_UIDX`, `book_name_FTX`

## Data Type Guide

| Use Case | Recommended Type | Notes |
|----------|-----------------|-------|
| Tiny PK/flag | `tinyint unsigned` | 0~255 |
| Small PK | `smallint unsigned` | 0~65535 |
| Standard PK | `int unsigned` | 0~4.2 billion |
| Large PK | `bigint unsigned` | Log tables |
| Boolean | `char(1)` 'Y'/'N' (권장) or `tinyint(1)` 0/1 | 0→NULL/falsy 오인 회피용 CHAR 권장. MySQL native boolean 없음 → tinyint 도 가능. 한 스키마 내 통일 |
| Variable string | `varchar(n)` | Specify max length |
| Long text | `text` | No length limit |
| Fixed string | `char(n)` | Fixed-length codes |
| Timestamp | `datetime` | With DEFAULT CURRENT_TIMESTAMP |
| JSON data | `json` | MySQL 8.0+ native JSON |
| Money | `decimal(p,s)` | Never use float / `decimal(15,2)`: 원화, `decimal(10,2)`: USD, `decimal(5,4)`: 비율(0.1234=12.34%) |

## Prohibited Items
- Stored Procedures: prohibited
- Triggers: prohibited
- Events: prohibited
- Complex Views: discouraged, simple read-only only

## Reference Files
- `schema-design.md` — PK/FK policy, checklists
- `index-and-query.md` — Index strategy, query patterns
- `partitioning.md` — Partitioning strategy, management
- `connection-and-features.md` — Connection management, transactions
