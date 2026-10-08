# Changelog

## 2026-10-07
- DNS: Route 53 hosted zone for `cloudscribble.com` added to `CloudScribble-account` (copied from the legacy account's zone). Spacemail records (DKIM repaired into one record), DMARC, SES DKIM + MAIL FROM generated from the identity. TEMPORARY records keep the legacy pre-launch Amplify site, its cert renewal, and old `staging.` working until launch cutover. Dropped: old SES identity records, unused ACM validations, `staging-admin` (admin site retired), dead AAAA.
- Decisions: app name CloudScribble; no admin site (admin = Cognito group, later); legacy account is the Organization payer — ask before accessing.

## 2026-10-01
- Infrastructure: `CloudScribble-account` (GitHub OIDC deploy role, GuardDuty → SNS, SES domain identity), `CloudScribble-staging`/`-prod` (DynamoDB table, Cognito pool with web + mobile clients and admin group, private scans bucket with 1-day expiry, HTTP API with JWT authorizer and stage throttling, 5xx alarm), `ScribbleFunction` construct (Node 22, ARM64).
- Backend: `_shared/errors.ts`, `_shared/response.ts`, `GET /v1/health`.
- Decisions: free trial via Apple intro offer; offer-code pool keyed `PK=POOL`, `SK=<expiresOn>#<code>`.

## 2026-09-30
- Repo skeleton: npm workspaces (`packages/shared`, `frontend`, `backend`, `infrastructure`; `mobile/` outside), `@cloudscribble/shared` dual CJS+ESM, brand assets in `docs/brand/`.
- Decisions: Bedrock (IAM) for AI, domain `cloudscribble.com`, NativeWind for mobile, app-focused website, no planner page codes.
