# README Rule — 프로젝트 배지 배너 자동 생성

## 적용 시점

이 규칙은 다음 경우에 적용한다:

1. README.md 생성 요청
2. 프로젝트 문서화 요청
3. README 배지/배너 추가 요청
4. 프로젝트 초기 설정
5. 오픈소스 프로젝트 준비

## 개요

README.md 생성 시 프로젝트 소스 코드를 분석하여 **상단 배지(badge) 배너**를 자동으로 구성한다.
배지는 프로젝트에서 실제 사용 중인 기술 스택만 포함하며, 항상 **Buy Me A Coffee** 링크를 포함한다.

---

## 배지 배너 구조

배너는 항상 다음 순서로 구성한다:

```
[언어 배지] [프레임워크 배지] [DB 배지] [인프라 배지] [라이선스 배지]

[Buy Me A Coffee 배지]
```

### 고정 배지 (항상 포함)

```markdown
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/teinam)
```

> **이 링크는 절대 변경하지 않는다. 항상 `https://buymeacoffee.com/teinam` 을 사용한다.**

---

## 코드 분석 → 배지 매핑 규칙

README 생성 시 반드시 프로젝트 파일을 분석하여 배지를 결정한다.

### 1단계: 프로젝트 파일 탐색

다음 파일들을 우선 확인한다:

| 파일 | 용도 |
|------|------|
| `pyproject.toml` | Python 의존성, 버전 |
| `requirements.txt` | Python 의존성 |
| `package.json` | Node.js 의존성, 버전 |
| `Pipfile` | Python 의존성 (pipenv) |
| `Cargo.toml` | Rust 의존성 |
| `go.mod` | Go 의존성 |
| `pom.xml` / `build.gradle` | Java 의존성 |
| `Dockerfile` / `docker-compose.yml` | Docker 사용 여부 |
| `*.tf` / `terraform/` | Terraform 사용 여부 |
| `.github/workflows/` | GitHub Actions |
| `LICENSE` / `LICENSE.md` | 라이선스 종류 |

### 2단계: 배지 카테고리별 매핑

#### 언어 (Language)

소스 코드 파일 확장자 및 설정 파일로 판별한다.

| 감지 조건 | 배지 |
|-----------|------|
| `*.py` 파일 존재 또는 `pyproject.toml` | `![Python](https://img.shields.io/badge/Python-{version}-blue.svg)` |
| `*.ts` / `*.tsx` 파일 존재 | `![TypeScript](https://img.shields.io/badge/TypeScript-{version}-blue.svg)` |
| `*.js` / `*.jsx` 파일 존재 (TS 없을 때) | `![JavaScript](https://img.shields.io/badge/JavaScript-ES{version}-yellow.svg)` |
| `*.go` 파일 존재 | `![Go](https://img.shields.io/badge/Go-{version}-00ADD8.svg)` |
| `*.rs` 파일 존재 | `![Rust](https://img.shields.io/badge/Rust-{version}-orange.svg)` |
| `*.java` 파일 존재 | `![Java](https://img.shields.io/badge/Java-{version}-red.svg)` |

**버전 탐지**: `pyproject.toml` 의 `python_requires`, `package.json` 의 `engines`, `go.mod` 의 모듈 버전 등에서 추출. 찾을 수 없으면 주요 버전만 표기 (예: `3.x`).

#### 프레임워크 (Framework)

의존성 파일에서 프레임워크를 감지한다.

| 감지 조건 (의존성 이름) | 배지 |
|------------------------|------|
| `fastapi` | `![FastAPI](https://img.shields.io/badge/FastAPI-{version}-009688.svg)` |
| `django` | `![Django](https://img.shields.io/badge/Django-{version}-092E20.svg)` |
| `flask` | `![Flask](https://img.shields.io/badge/Flask-{version}-000000.svg)` |
| `react` | `![React](https://img.shields.io/badge/React-{version}-61DAFB.svg)` |
| `next` | `![Next.js](https://img.shields.io/badge/Next.js-{version}-000000.svg)` |
| `vue` | `![Vue.js](https://img.shields.io/badge/Vue.js-{version}-4FC08D.svg)` |
| `express` | `![Express](https://img.shields.io/badge/Express-{version}-000000.svg)` |
| `spring-boot` | `![Spring Boot](https://img.shields.io/badge/Spring%20Boot-{version}-6DB33F.svg)` |

**버전 탐지**: 의존성 파일에서 명시된 버전을 사용. `^`, `~`, `>=` 등의 접두사는 제거하고 주요 버전(major.minor)만 표기한다.

#### 데이터베이스 (Database)

의존성 또는 설정 파일(docker-compose, .env 등)에서 감지한다.

| 감지 조건 | 배지 |
|-----------|------|
| `mysql`, `pymysql`, `mysqlclient`, `mysql` 이미지 | `![MySQL](https://img.shields.io/badge/MySQL-{version}-4479A1.svg)` |
| `psycopg2`, `asyncpg`, `postgres` 이미지 | `![PostgreSQL](https://img.shields.io/badge/PostgreSQL-{version}-336791.svg)` |
| `redis`, `aioredis`, `redis` 이미지 | `![Redis](https://img.shields.io/badge/Redis-{version}-DC382D.svg)` |
| `pymongo`, `motor`, `mongo` 이미지 | `![MongoDB](https://img.shields.io/badge/MongoDB-{version}-47A248.svg)` |
| `sqlalchemy` | `![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-{version}-D71F00.svg)` |
| `sqlite3` import 또는 `*.db` 파일 | `![SQLite](https://img.shields.io/badge/SQLite-3-003B57.svg)` |
| `oracledb`, `cx_Oracle` | `![Oracle](https://img.shields.io/badge/Oracle-{version}-F80000.svg)` |

**버전 탐지**: docker-compose 의 이미지 태그에서 추출 (예: `mysql:8.0` → `8.0`). 의존성에서만 감지 시 버전 생략 가능.

#### 인프라 (Infrastructure)

| 감지 조건 | 배지 |
|-----------|------|
| `Dockerfile` 또는 `docker-compose.yml` 존재 | `![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)` |
| `*.tf` 파일 존재 | `![Terraform](https://img.shields.io/badge/Terraform-IaC-7B42BC.svg)` |
| `.github/workflows/` 존재 | `![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-CI/CD-2088FF.svg)` |
| `kubernetes/`, `k8s/`, `*.yaml` (k8s 리소스) | `![Kubernetes](https://img.shields.io/badge/Kubernetes-Ready-326CE5.svg)` |
| AWS 관련 설정 (`aws-cdk`, `serverless`, `sam`) | `![AWS](https://img.shields.io/badge/AWS-Cloud-FF9900.svg)` |
| `nginx.conf` 또는 nginx 관련 설정 | `![Nginx](https://img.shields.io/badge/Nginx-Proxy-009639.svg)` |

#### 라이선스 (License)

| 감지 조건 | 배지 |
|-----------|------|
| `LICENSE` 파일 내 "MIT" | `![License](https://img.shields.io/badge/License-MIT-green.svg)` |
| `LICENSE` 파일 내 "Apache" | `![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)` |
| `LICENSE` 파일 내 "GPL" | `![License](https://img.shields.io/badge/License-GPL%20v3-blue.svg)` |
| LICENSE 파일 없음 | 라이선스 배지 생략 |

---

## 출력 형식

배지 배너는 README.md 의 **최상단** (제목 바로 아래)에 위치한다.

```markdown
# 프로젝트 이름

![Python](https://img.shields.io/badge/Python-3.13-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg)
![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1.svg)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/teinam)

## 개요
...
```

### 배치 규칙

1. 기술 배지들은 한 줄에 나열 (빈 줄 없이 연속)
2. 기술 배지와 Buy Me A Coffee 배지 사이에 **빈 줄 1개**
3. Buy Me A Coffee 배지 아래 **빈 줄 1개** 후 본문 시작
4. 배지가 너무 많으면 (6개 초과) 카테고리별로 줄바꿈 가능

---

## 주의사항

- **실제 사용 기술만 표시**: 프로젝트에서 감지되지 않는 기술의 배지는 포함하지 않는다.
- **버전은 가능한 한 구체적으로**: major.minor 수준까지 표기 (예: `3.13`, `0.115`).
- **Buy Me A Coffee 링크 고정**: `https://buymeacoffee.com/teinam` 변경 불가.
- **shields.io 형식 준수**: 모든 배지는 `https://img.shields.io/badge/` 기반.
- **색상 일관성**: 각 기술의 공식 브랜드 컬러 사용 (위 매핑 테이블 참고).
