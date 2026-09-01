# Security

## Table of Contents
1. [JWT Authentication](./jwt-authentication.md)
2. [OAuth2 + Password Hashing](./oauth2-password-hashing.md)
3. [RBAC Authorization](./rbac-authorization.md)
4. [Rate Limiting](./rate-limiting.md)
5. [Security Headers & CORS](./security-headers-cors.md)
6. [Input Validation & Defense](./input-validation-defense.md)

> **라우트에 인증을 붙이는 규율**은 `../api-design/openapi-documentation.md` §4 에 있다 —
> 라우터 레벨 `dependencies=[Security(...)]` 로 잠가 신규 라우트가 상속하게 하고,
> `Depends` 대신 `Security` 를 써서 OpenAPI 스펙에 `security` 가 올라가게 한다.
> 여기 문서들은 토큰 생성·검증·RBAC 판정 *구현*을 다룬다.

---
