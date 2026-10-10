# CLAUDE.md — CloudScribble Scan App

Guardrails and decisions for AI coding sessions. Read this fully before any change.
Reference architecture: `docs/references/tabletryb-blueprint.md` (TableTryb, a working sibling app by the same owner). Where this file and the blueprint disagree, **this file wins**.

## Response style
- Code first, brief explanation. No READMEs, summaries, or guides unless asked.
- One file per response unless asked otherwise. Answer only what was asked.
- Read the current file before editing; make surgical edits; verify nothing else changed.

## Product
- One mobile app (Expo, iOS first, Android later): photograph **any** paper planner page → AI extracts events → events written to the phone's calendar.
- Owner: CloudScribble LLC. App name: **CloudScribble** — one app that works with any paper planner (copy must never imply CloudScribble planners only); planner buyers get a free year via Apple Offer Code.
- Monetization: **Apple-only** auto-renewing subscription (no web checkout). Price TBD: $1.99–2.99/mo, annual TBD — set in App Store Connect (see margin notes: heavy annual users are the thin case). Target ≥30% margin after store fees (15% via Small Business Program). Free trial via Apple introductory offer (7 or 14 days, TBD); no server-side trial. Planner buyers' free year = **Apple Offer Codes only** (planner price should cover ~$2/yr AI cost).
- CloudScribble planner buyers get **1 year free via Apple Offer Codes** (see Entitlements).
- Fair-use cap: **100 scans/month** per user (`SCAN_MONTHLY_LIMIT`; keeps a maxed-out user within the 30% margin).

## Architecture (TableTryb pattern, adapted)
- **New AWS account** for CloudScribble (`574921529456`, profile `cloudscribble`). The legacy account (`528757783633`, profile `cloudscribble-payer`) is also the Organization's payer account, so it is cleaned out, never closed. **Ask the owner before every session's first access to the legacy account**; never create, change, or delete anything there without explicit approval. It still hosts the live website (Amplify) and the `cloudscribble.com` Route 53 zone.
- Region `us-east-2`. One CDK stack per environment: `CloudScribble-staging` (branch `develop`), `CloudScribble-prod` (branch `main`).
- Serverless only: Lambda (Node 22, ARM64, esbuild via a shared function construct), API Gateway **HTTP API** with Cognito JWT authorizer, **DynamoDB** single table (on-demand, PITR, TTL on `ttl`).
- **No** VPC, NAT, RDS, bastion, Chargebee, admin app, product catalog, or CloudFront for scans.
- Cognito: one user pool per stage, email sign-in, web + mobile clients, admin = Cognito group. Never put billing or usage state in tokens.
- S3 scans bucket: private, **1-day lifecycle expiration**, uploads via **presigned POST with `content-length-range`** (max 5 MB — Claude's per-image limit; jpeg/png/webp only — Claude can't read HEIC, so the app converts to JPEG).
- HTTP API integrations time out at **30 s**: Lambdas behind it use ≤ 29 s and budget downstream calls (see `scans/ai.ts`).
- Web: app-focused site, not a storefront (Amplify, one app). Pages: Home, How it works, FAQ, Support (contact form → public API route + SES + Turnstile), Privacy, Terms, Delete account (Cognito sign-in). Domain `cloudscribble.com` (prod apex + `www`, staging `staging.cloudscribble.com`). Registrar: Spaceship. DNS: Route 53 public hosted zone in the **new** account, defined in CDK (`CloudScribble-account`); never hand-edit records. Records pointing at legacy-account resources are marked TEMPORARY and removed after launch cutover.
- Mobile: port the archived app's UI/flow (`cloudscribble-archived/cloudscribble-monorepo/packages/mobile`) nearly unchanged; replace internals (Bedrock scan API, Cognito + SecureStore, RevenueCat, React Navigation 7 stack), TypeScript, styles rewritten in NativeWind. Brand source files in `docs/brand/`.
- Staging `RemovalPolicy.DESTROY`; prod `RETAIN` for table, pool, bucket.

## Data model (single table `cloudscribble-{stage}`)
```
PK                  SK                     Notes
USER#<sub>          PROFILE                lazy-created on first API call (no post-confirmation Lambda)
USER#<sub>          SUBSCRIPTION#IAP       RevenueCat webhook
USER#<sub>          USAGE#<yyyy-mm>        atomic ADD; quota check before every AI call
POOL                <expiresOn>#<code>     Apple offer-code pool; batchId (one partition, sorted by expiry)
ORDER#<orderId>     CODE                   claimed code, claimedAt
```
- Key patterns are immutable once shipped.
- Subscription checks always `begins_with(SK, 'SUBSCRIPTION')` and use shared `isAccessActive()`; never point-read one record.
- Members of Cognito group `cloudscribble-admins` bypass the subscription check (never the quota).

## Scan flow
1. App requests presigned POST → uploads image (client downscales to ~1568px long edge, crops to page).
2. `POST /v1/scans` → Lambda: auth → `isAccessActive()` → quota check (`USAGE#`) → AI call → validate JSON → return events.
3. **Device writes events to calendar** (expo-calendar). No server-side Google/Outlook OAuth.
4. Rescan of the same page is matched **on the device** (by the page's dates + events the app created); the server stores no events or page mappings.
5. No planner page codes: the AI reads dates from any page. Calendar sync may only offer to delete events the app itself created (tracked event IDs), never other events in the calendar.

## AI
- Single AI Lambda. Model IDs in config, never hard-coded; verify IDs are current before each release (a retired ID caused a TableTryb outage).
- Model: **Sonnet 4.6 only** (decided 2026-10-08 from `evals/`: 94% events found / 83% exact time / ~$0.0116 per scan). Haiku 4.5 misreads handwritten digits with high confidence; Haiku-first tiering (still supported via `SCAN_MODEL_FALLBACK` + `datesConsistent`) scored 90% / 74% for only ~20% less cost.
  - Sonnet 5.x and Haiku 5.5 are AWS-gated for this account on Bedrock ("contact AWS Sales"); owner is opening a support case. Sonnet 5.5 (~⅓ cheaper) should land ≈ $0.008/scan — re-run `evals/` once enabled.
- Prompt-cache the system prompt + schema.
- Target cost ≈ $0.009/scan; currently ~$0.0116 (offset by the 100/month cap).
- Provider: **Amazon Bedrock** via `@anthropic-ai/bedrock-sdk` (`AnthropicBedrock` client → bedrock-runtime; IAM `bedrock:InvokeModel`). IAM auth only — no Anthropic API key, no AI secret in Secrets Manager. Model IDs are **inference profiles** (`us.anthropic.…`) set as Lambda env (`SCAN_MODEL_PRIMARY`/`_FALLBACK`); in us-east-2 the models are profile-only. Request Bedrock quota increases early.
- Prompt + output schema live in `backend/functions/scans/prompt.ts`; `evals/` scores against the same conventions — change both together. Run the eval before changing models or the prompt.
- Typed `AppError` codes for all failures (e.g. `SCAN_UNREADABLE`, `SCAN_QUOTA_EXCEEDED`, `SCAN_AI_ERROR`).

## Entitlements & billing
- RevenueCat over App Store (Google Play later). App User ID = Cognito `sub`. Entitlement ID **`cloudscribble_access`** (permanent — never rename). One RevenueCat account shared with TableTryb (separate projects).
- Bundle ID `com.cloudscribble.app`. EAS under Expo account `@blackburn635`. Sentry added before TestFlight.
- Webhook derives status from ground-truth fields, timing-safe auth compare, ignores SANDBOX in prod, returns 500 on unexpected errors.
- **Apple guideline 3.1.1: never unlock features with our own codes/license keys.** Planner free year = **Apple Offer Codes** only.
- Offer codes: one-time-use, created via App Store Connect API in batches (500–25,000), **expire ≤6 months from creation**, 1M/app/quarter.
  - Monthly scheduled Lambda replenishes pool when available < 200.
  - Order webhook claims oldest code with ≥30 days left (Query `PK = POOL AND SK >= <today+30d>` `Limit 1` → conditional delete / TransactWrite with `ORDER#`), emails it.
  - The offer itself ("1 year free, new subscribers") is created once by hand in App Store Connect; its ID is config.
  - Free code auto-renews at full price after the year — disclose on the planner insert.
- Google Play promo codes: manual only (no API) — treat Android planner grants separately.
- Account deletion always allowed in-app (Apple 5.1.1(v)); warn about active App Store subscription.

## Guardrails (carry-over lessons)
- IaC only. No console-created app resources. No `cdk deploy` from a laptop or AI session — deploy by commit via GitHub Actions (OIDC role).
  - Exception 1: the account bootstrap stack (GitHub OIDC provider + deploy role, GuardDuty) is deployed once by the owner from a laptop. Never by an AI session.
  - Exception 2: the website's Amplify Hosting app is created by hand in the console (same as TableTryb): GitHub connected via the Amplify GitHub App, branches `develop` (staging) + `main` (prod), per-branch env vars from stack outputs. Amplify builds on every push. Its custom-domain records may be created by Amplify in the hosted zone; never define the same record names in CDK.
- Never use CloudFormation exports; pass values via stack props. Never manually delete CDK-managed resources.
- New secret = add in **three places**: GitHub environments (both), both workflow `jq` blocks, reading code. Console-added keys are wiped on deploy.
- Diff staging vs prod workflows whenever one changes.
- Editing only `_shared/` may not rebuild Lambdas — touch a handler too. `depsLockFilePath` = root lockfile.
- Never commit `tsconfig.tsbuildinfo`. Shared package is dual CJS+ESM with `exports` map.
- HTTP API wraps array claims in brackets — strip `[ ]` before parsing groups. WAF can't attach to HTTP API; use route throttling.
- Mobile: run `npx expo install --check` after any dependency change; pin NativeWind `4.2.1` / css-interop `0.2.1`; don't set `disableHierarchicalLookup`; `jsxImportSource` in Babel only; pass `Storage` to every `new CognitoUser`; keep `crypto.getRandomValues` shim; never list `react-native-purchases` in plugins; `mobile/` outside root workspaces.
- Apple: accept updated agreements if builds 403; IAP products need a review screenshot to leave "Missing Metadata".
- macOS: `sed -i ''`.

## Open decisions
- Prices ($1.99–2.99/mo, annual) and trial length (7 vs 14 days) — set in App Store Connect before submission.
- Android timing.

## Build order
1. Account + foundations (new account, admin role, OIDC deploy role, GuardDuty, domain/SES, Sentry).
2. Repo skeleton (workspaces, shared package, scripts, this file, `docs/`).
3. Infra stack (Cognito, table, scans bucket, HTTP API, function construct).
4. Pipeline (ci, deploy-staging, deploy-prod, Amplify).
5. Scan endpoint + AI Lambda + quota.
6. Mobile app: auth, capture, calendar write, paywall (RevenueCat).
7. Offer-code pool + order webhook.
8. TestFlight → App Store.
