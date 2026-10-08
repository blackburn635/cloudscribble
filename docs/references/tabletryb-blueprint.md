# TableTryb Reference Architecture — Blueprint for CloudScribble

Sep 29, 2026 · @Alan Blackburn

## Purpose

TableTryb is a serverless, single-region AWS SaaS with a React web app, an Expo iOS app, and one CDK stack per environment, all shipped from one GitHub monorepo. This doc captures every layer, identifier pattern, and hard-won lesson so CloudScribble can be rebuilt on the same pattern without rediscovering the pitfalls.

How to use it: read the overview diagram, then work through the Replication checklist near the end. Each layer section lists what to build, the settings that matter, and what to rename. Wherever you see `tabletryb`, substitute your CloudScribble slug.

The design principles that carry over unchanged:

- **Serverless, pay-per-use** — Lambda, HTTP API, and on-demand DynamoDB scale to zero, so idle cost is near nothing.
- **One monorepo, one shared types package** — web, mobile, backend, and infra import the same TypeScript types and constants.
- **Infrastructure as code only** — nothing in the app stack is created by hand in the console.
- **Deploy by commit** — a push to `develop` ships staging; a merge to `main` ships production. No local deploys.
- **The database is the source of truth** — billing providers and identity push state in via webhooks; apps never query them at runtime.
- **Surgical change discipline** — read the current file, edit the minimum, verify nothing else moved.

## System overview

Both clients sign in to the same Cognito pool and call the same HTTP API; about 26 Lambdas behind it read and write one DynamoDB table, the single source of truth that billing webhooks also write into.

&#91;embedded content: TableTryb architecture · clients, AWS stack, external services, delivery\]

Read it top to bottom: clients authenticate and call the API, Lambdas do the work against DynamoDB, S3 and Secrets Manager, and external billing and AI services connect only through the backend. The Delivery lane shows the one-commit deploy: a push triggers GitHub Actions (backend and infrastructure) and Amplify (web) together, while iOS builds go through EAS on demand.

## Frontend (web)

The web app is a React 18 single-page app (Create React App, TypeScript, react-router-dom v6) hosted on AWS Amplify Hosting, which builds on every push to a connected branch.

| Item | TableTryb setting | CloudScribble action |
| --- | --- | --- |
| Framework | React 18 CRA + TypeScript | Same, or Vite if starting fresh |
| Hosting | Amplify Hosting, app `d23g8sje3tuway` | New Amplify app connected to the repo |
| Branch mapping | `develop` → staging subdomain, `main` → apex + `www` | Same pattern |
| Build spec | `amplify.yml` at repo root, `appRoot: .` | Copy and rename |
| Certificates | Amplify-managed ACM | Automatic |
| DNS | Spaceship registrar, CNAME/ANAME to Amplify | Your registrar |
| Bot protection | Cloudflare Turnstile on sign-up and contact form | New widget per environment |
| Analytics | GA4, `main` branch only | New property |
| Errors | Sentry `@sentry/react` | New Sentry project |

**Source layout** — `frontend/src/` holds `config/` (Amplify auth config, Sentry init), `contexts/` (AuthContext, SubscriptionContext), `hooks/` (useApi, useSubscription), `pages/` (public and `app/` pages), and `components/`.

**Build spec essentials** — preBuild runs `npm ci`, removes `packages/shared/tsconfig.tsbuildinfo`, then `npm run build:shared`; build runs `npm run build:frontend`; artifacts come from `frontend/build`. Cache paths must include both `node_modules/**/*` and `packages/shared/dist/**/*`.

**Per-branch environment variables** (set in the Amplify console, not in code): `REACT_APP_API_URL`, `REACT_APP_USER_POOL_ID`, `REACT_APP_USER_POOL_CLIENT_ID`, `REACT_APP_CHARGEBEE_SITE`, `REACT_APP_TURNSTILE_SITE_KEY`, `REACT_APP_REGION`. These are public values; secrets never go in the frontend.

**Security headers** live in `amplify.yml` under `customHeaders` (SEC-009): a Content-Security-Policy allowing only self, the regional API Gateway and Cognito endpoints, S3, the billing provider, and GA; plus `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, strict Referrer-Policy, a Permissions-Policy disabling camera, mic, geolocation and payment, and a two-year HSTS with preload.

**Data flow** — the SPA signs in with Cognito (SRP), sends the ID token as a Bearer header to the HTTP API, fetches `GET /v1/subscription/status` on load and after checkout, and gates features from that cached status. Image uploads go straight to S3 with a presigned PUT URL from the API.

**Deep-link files** — `frontend/public/.well-known/apple-app-site-association` (and later `assetlinks.json`) are served from the Amplify domain so email links can open the mobile app.

## Mobile app (iOS)

The mobile app is an Expo SDK 55 managed-workflow app (React Native 0.83.6, React 19.2, new architecture) built in the cloud by EAS and shipped through TestFlight to the App Store. It reuses the same API, Cognito pool, and shared types as the web app; only billing differs.

| Item | TableTryb setting |
| --- | --- |
| Framework | Expo SDK 55, React Native 0.83.6, React 19.2.0 |
| Native code | Continuous Native Generation — no committed `ios/` or `android/` |
| Styling | NativeWind `4.2.1` + `react-native-css-interop` `0.2.1`, pinned exactly |
| Navigation | React Navigation 7 |
| Auth | `amazon-cognito-identity-js` with tokens in `expo-secure-store` |
| Purchases | `react-native-purchases` (RevenueCat SDK) |
| Errors | `@sentry/react-native` |
| Builds | EAS, org `@blackburn635`, profiles development / preview / production |
| Versioning | `appVersionSource: "remote"` so EAS owns build numbers |
| Identity | Bundle ID `com.tabletryb.app`, Apple team `87H23V3FLB` (CloudScribble LLC) |
| Config | `app.config.ts` (TypeScript, imports `BRAND` from shared) |

**Workspace placement** — `mobile/` lives in the monorepo but is deliberately NOT in the root `workspaces` array, because React 19 (Expo) and React 18 (web) peer dependencies collide. It consumes `@tabletryb/shared` through Metro.

**Key config files**

- `metro.config.js` — `watchFolders: [monorepoRoot]`, `nodeModulesPaths` for both `mobile/` and root, wrapped last in `withNativeWind`. Do not set `disableHierarchicalLookup`.
- `babel.config.js` — `babel-preset-expo` with `jsxImportSource: 'nativewind'`, the `nativewind/babel` preset, and `react-native-reanimated/plugin` last.
- `tsconfig.json` — no `jsxImportSource` here; `nativewind-env.d.ts` begins with `import 'react-native';` so the `className` augmentation extends rather than replaces the types.
- `tailwind.config.js` — colours read from `BRAND.colors` so web and mobile share one palette.
- `index.ts` — keeps the `NativeModules.ExpoRandom` shim backed by `crypto.getRandomValues`; production builds crash without it.
- `app.config.ts` — `platforms: ['ios', 'android']` to suppress web bundling; `ITSAppUsesNonExemptEncryption: false`; never list `react-native-purchases` in `plugins`.

**Auth** — a separate Cognito app client for mobile (SRP + user-password flows, 1-hour access and ID tokens, longer refresh). Every manual `new CognitoUser({...})` must pass `Storage: storage` explicitly. Login is forced before the paywall.

**Subscription gating** — on open and on resume the app calls `GET /v1/subscription/status` and caches it for about 5 minutes. After login it calls `Purchases.logIn(householdId)`. The paywall reads RevenueCat offering `default` with packages `$rc_monthly` and `$rc_annual`, and checks entitlement `tabletryb_unlimited`. If the status shows an active web subscription, the paywall is not shown.

**Release path** — `eas build --profile production --platform ios`, then `eas submit`. Sandbox testing uses a team-scoped Apple sandbox account; Clear Purchase History resets trial eligibility.

**Future** — Universal Links for email flows, push via APNs and SNS, a `GET /v1/app/config` endpoint for minimum version and feature flags, Sign in with Apple if any social login is added, then Android with `google_iap`.

## Backend API

The backend is roughly 26 single-purpose Node.js 20 Lambdas on ARM64 (Graviton), fronted by one API Gateway HTTP API (v2) with a Cognito JWT authorizer. Each route maps to one handler; there is no framework or monolithic router.

**Folder layout** — `backend/functions/<domain>/<action>.ts`, with domains `health`, `household`, `members`, `recipes`, `meal-plan`, `grocery`, `subscription`, `user-profiles`, `admin`, `contact`, `referral`, and `image-upload`. Tests live in `backend/test/` (Vitest).

**Shared helpers** in `backend/functions/_shared/`:

| File | Role |
| --- | --- |
| `dynamo.ts` | Document client, `getItem`, `putItem`, `queryByPK` (begins\_with), `queryGSI`, `convertFloats`, `generateSecureToken` |
| `response.ts` | Consistent JSON responses and CORS headers from `ALLOWED_ORIGIN` |
| `auth.ts` | Reads JWT claims (`sub`, `custom:householdId`, `custom:role`), `requireAdmin()` |
| `secrets.ts` | Fetches the Secrets Manager JSON blob once per cold start and caches it |
| `errors.ts` | `AppError` with structured codes the UI maps to messages |

**TrybFunction construct** (`infrastructure/lib/constructs/tryb-function.ts`) wraps `NodejsFunction`: ARM64, Node 20, esbuild bundling with `depsLockFilePath` pointed at the root `package-lock.json` (so workspace symlinks resolve in CI), shared env vars, and read access to the stage secret. Function names follow `tabletryb-<domain><action>-<stage>`.

**Routing** — a small `addRoute(method, path, fn, { noAuth })` helper in the stack adds each route with an `HttpLambdaIntegration`. Authenticated routes use the JWT authorizer whose audience lists both the web and mobile client IDs. Public routes (`noAuth: true`) are only health, contact, invite validation, and the two billing webhooks.

**Conventions**

- All routes are versioned under `/v1/`; add `/v2/` for divergent shapes rather than forking.
- Tenant scope always comes from the token's `custom:householdId`, never from the request body.
- HTTP API serialises JWT array claims as bracketed strings (`"[tabletryb-admins]"`); strip brackets before parsing groups.
- Non-secret config is Lambda env: `TABLE_NAME`, `STAGE`, `RECIPE_IMAGE_BUCKET`, `RECIPE_IMAGE_DOMAIN`, `USER_POOL_ID`, `CHARGEBEE_SITE`, `ALLOWED_ORIGIN`, `SECRETS_NAME`.
- CORS allows only the web origins (prod: apex and `www`; staging: staging domain plus localhost 3000/3001). Native mobile sends no Origin, so no mobile origins are added.

**Abuse controls** — Turnstile on public forms, Cognito's built-in throttling, HTTP API stage and route throttling, and DynamoDB-backed counters (AI actions: 20 lifetime on trial, 200 per day paid; contact form: 5 per hour per IP). WAF cannot attach to an HTTP API, so it was deferred.

**Email** — SES from the verified domain (DKIM, SPF, DMARC), with bounce and complaint notifications to SNS. Production access must be approved before launch.

## Data layer (DynamoDB and S3)

All application data lives in one DynamoDB table per stage (`tabletryb-{stage}`), on-demand billing, AWS-managed encryption, point-in-time recovery on, and TTL on the `ttl` attribute. RDS and Aurora Serverless were rejected: Lambda connection pooling is painful and their idle floors ($15–43 a month) exceed a pre-revenue budget.

**Keys** — string `PK` and `SK`, plus two overloaded indexes: GSI1 (`GSI1PK`/`GSI1SK`) for user-to-household, sorted listings, and invite lookup; GSI2 (`GSI2PK`/`GSI2SK`) for subscriptions by status.

| Entity | PK | SK | Index keys |
| --- | --- | --- | --- |
| Household | `HH#<hhId>` | `META` | — |
| Member | `HH#<hhId>` | `MEMBER#<userId>` | GSI1: `USER#<userId>` / `HH#<hhId>` |
| Recipe | `HH#<hhId>` | `RECIPE#<recipeId>` | GSI1: `HH#<hhId>#RECIPE` / title |
| Week meal | `HH#<hhId>` | `WEEK#<yyyy-Www>#MEAL…` | GSI1: `HH#<hhId>#WEEK` |
| Week vote | `HH#<hhId>` | `WEEK#<yyyy-Www>#VOTE…` | — |
| Settings | `HH#<hhId>` | `SETTINGS` | — |
| Invite | `INVITE#<token>` | `INVITE` | GSI1: `HH#<hhId>#INV` / email; TTL 7 days |
| Web subscription | `SUB#<hhId>` | `SUBSCRIPTION` | GSI2: `SUB#STATUS` / `<status>#<hhId>` |
| Mobile subscription | `SUB#<hhId>` | `SUBSCRIPTION#IAP` | — |
| Pending referral | `SUB#<hhId>` | `PENDING_REFERRAL` | — |
| Referral code | `REFCODE#<code>` | — | — |
| Rate limit | `RATE#CONTACT#<ip>` | `COUNTER` | TTL 2 hours |

**Rules that make it work**

- Every tenant item starts with `HH#<householdId>`, so no query can cross households without the ID.
- Key patterns are immutable once shipped; rename only display text.
- Design SK prefixes so one `begins_with` query returns a family of records (both subscription records come back from `SUBSCRIPTION`).
- Invite tokens use `crypto.randomBytes(32)` (64 hex characters); `generateId()` is only for non-sensitive IDs.
- Staging uses `RemovalPolicy.DESTROY`; production uses `RETAIN` for the table, user pool, and bucket.

**Images** — S3 bucket `tabletryb-images-<account>-<stage>`, private, served through CloudFront with Origin Access Control (`RECIPE_IMAGE_DOMAIN`). Uploads use a presigned PUT from `image-upload/presigned-url.ts` that allowlists `image/jpeg`, `png`, `webp`, and `heic`, strips path components from the file name, and uses a server-generated key. Size is capped client-side at 10 MB because presigned PUTs cannot enforce it.

## Identity and auth (Cognito)

One Cognito user pool per stage is the only identity provider, with email as the unique account key (`signInAliases: { email: true }`, email required). The same email always maps to the same household, which is what lets one subscription unlock both web and mobile.

| Setting | Web client | Mobile client |
| --- | --- | --- |
| Auth flows | SRP | SRP + user-password |
| Client secret | none | none |
| Access / ID token | 1 hour | 1 hour |
| Refresh token | 30 days | longer (up to 365 days) |
| `preventUserExistenceErrors` | on | on |

**Custom attributes** carry only slow-changing identity: `custom:householdId`, `custom:role` (`primary` or `member`), and `custom:excludeFromAnalytics`; plus standard `name`, `given_name`, `family_name`. Admins are a Cognito group (`tabletryb-admins`).

**Never put billing or usage state in the token.** Tokens are snapshots for up to an hour, so subscription status and quotas are read from DynamoDB on each request.

**Flow** — sign-up (email plus Turnstile) → email verification → create or join a household (invite token) → the household ID is written to the user's attribute and a `MEMBER#` record → subsequent tokens carry it. Login and password reset stay generic so they don't reveal whether an email exists.

**Account deletion** is always allowed (Apple guideline 5.1.1(v)): cancel the web subscription server-side, warn about an active App Store subscription with a deep link, and never block deletion on billing.

## Subscriptions and billing

Billing is split by platform — Chargebee (with Stripe as the payment gateway) for web, RevenueCat over Apple in-app purchase for iOS — and reconciled in DynamoDB at read time. Apps never call a billing provider to decide access. Pricing is $3.99 a month or $39.99 a year with a 14-day trial.

|  | Web | iOS |
| --- | --- | --- |
| Provider | Chargebee PC 2.0, sites `tabletryb-test` and live | RevenueCat project `proj4bd48514` over App Store |
| Products | `TableTryb-USD-Monthly`, `TableTryb-USD-Yearly` | `com.tabletryb.app.monthly`, `com.tabletryb.app.annual` |
| Trial | Local: `household.createdAt` + 14 days | Apple intro offer: free, 2 weeks |
| Customer key | Chargebee `customer[id]` = householdId | RevenueCat App User ID = householdId |
| Webhook | `POST /v1/webhooks/chargebee`, Basic auth | `POST /v1/webhooks/revenuecat`, Authorization header |
| Record written | `SUB#<hhId>` / `SUBSCRIPTION` | `SUB#<hhId>` / `SUBSCRIPTION#IAP` |
| Manage link | Chargebee customer portal | `apps.apple.com/account/subscriptions` |

**The keystone** — using the household ID as the customer ID in both providers means every webhook writes its record with zero lookups.

**Read-time resolution** (in `get-status`, one `queryByPK` with prefix `SUBSCRIPTION`):

1. Load both records.
2. Among records whose status is access-active (`in_trial`, `active`, `past_due`), Apple wins.
3. If none is active, return the best terminal status (`expired` or `cancelled`).
4. Apply the local trial only when zero records exist, so trials cannot stack.
5. Return `subscriptionSource` when a real record exists, and `hasConflictingSources: true` when both are active so the web can warn about double billing.

`isAccessActive()` lives once in the shared package and is used by status, the checkout guard, and the AI rate limiter, so they cannot disagree. Any code that checks subscription must query by prefix, never point-read one SK.

**RevenueCat handler** derives status from ground-truth fields, not the event verb, so out-of-order delivery converges: `BILLING_ISSUE` → `past_due`; missing or past expiration → `expired`; `TRIAL`/`INTRO` period → `in_trial`; otherwise `active`. It compares the Authorization header with `crypto.timingSafeEqual`, ignores `SANDBOX` events in production, skips `$RCAnonymousID:` users, and returns 500 on unexpected errors so RevenueCat retries.

**Guards** — web `create-checkout` returns `409 CHECKOUT_BLOCKED_IAP_ACTIVE` when an Apple subscription is active. The reverse can only be blocked client-side at the paywall, because StoreKit completes on the device before we hear about it.

**Provider setup to repeat** — Chargebee: live site, catalog, gateway, hosted checkout redirects, portal, webhook events (`subscription_created`, `activated`, `cancelled`, `renewed`, `reactivated`, `payment_failed`, `payment_succeeded`), dunning. Apple: one subscription group with both products at the same level, intro offer, In-App Purchase key and App Store Connect API key uploaded to RevenueCat. RevenueCat: entitlement, `default` offering, "transfer to new App User ID" for shared purchases.

## AI services (recipe extraction)

AI runs server-side only, in one Lambda (`recipes/analyze.ts`) that calls the Anthropic Claude API directly with a key from Secrets Manager — not Bedrock. The model ID is config, currently `claude-sonnet-4-6`; a retired model ID caused a production outage, so check current model IDs before each release.

**Request path**

1. Client posts a URL or an uploaded photo reference.
2. `checkAiRateLimit` confirms the household is access-active (querying both subscription records by prefix) and under quota: 20 lifetime actions on trial, 200 per day when paid.
3. For URLs, the Lambda fetches the page with SSRF protection (blocks private and metadata addresses) and a size cap.
4. Claude returns structured JSON (title, ingredients, steps, image URL); the handler validates and sanitises it.
5. The recipe is saved under `HH#<hhId>` / `RECIPE#<recipeId>`.

**Errors** are `AppError` codes the UI maps to a persistent, click-to-dismiss toast: `RECIPE_INVALID_URL`, `RECIPE_PAGE_NOT_FOUND`, `RECIPE_SITE_BLOCKED`, `RECIPE_FETCH_FAILED`, `RECIPE_URL_TOO_LARGE`, `RECIPE_AI_ERROR`, `RECIPE_NOT_FOUND`. Clear messages matter because import failure was the top predicted support ticket.

**For CloudScribble** — keep the same shape (one AI Lambda, quota check first, typed errors, model ID in config). Bedrock is a drop-in alternative if you prefer IAM auth over an API key; the decision is independent of the rest of this architecture.

## Infrastructure, environments and secrets

All app infrastructure is one AWS CDK (TypeScript) stack per environment, `TableTryb-staging` and `TableTryb-prod`, in us-east-2 in a single account. A second, account-scoped stack (`TableTryb-account-setup`, GuardDuty) is deployed once by hand and kept out of CI.

**What the app stack creates**: Cognito user pool with web and mobile clients and the admin group; the DynamoDB table with GSI1 and GSI2; the images bucket plus a CloudFront distribution with OAC; the HTTP API with CORS, throttling, and the JWT authorizer; every Lambda via `TrybFunction` and its route; an import of the stage secret with read granted to each function; SNS topics for SES bounces and complaints; and stack outputs `ApiUrl`, `UserPoolId`, and `UserPoolClientId`.

**Files** — `infrastructure/bin/app.ts` instantiates both stages; `lib/tabletryb-stack.ts` (800+ lines, the highest-risk file: always edit surgically); `lib/account-setup-stack.ts`; `lib/constructs/tryb-function.ts`. Root `cdk.json` points at the app.

| Behaviour | Staging | Production |
| --- | --- | --- |
| Branch | `develop` | `main` |
| Stack | `TableTryb-staging` | `TableTryb-prod` |
| Table | `tabletryb-staging` | `tabletryb-prod` |
| Secret | `tabletryb/staging/secrets` | `tabletryb/prod/secrets` |
| Web URL | `staging.tabletryb.com` | `tabletryb.com` + `www` |
| Chargebee site | `tabletryb-test` | live |
| RevenueCat sandbox events | accepted | ignored |
| Removal policy | DESTROY, auto-delete objects | RETAIN |
| CORS | staging + localhost | apex + `www` |

Local development runs the React dev server on `localhost:3000` against the staging API.

**Secrets pipeline** — GitHub Environment secrets are the source of truth. At deploy, the workflow builds one JSON blob with `jq` and upserts it to Secrets Manager (`describe-secret` → `put-secret-value`, else `create-secret` with Project and Stage tags). Lambdas get only `SECRETS_NAME` and fetch the blob once per cold start through `_shared/secrets.ts`.

Secrets in the blob: `ANTHROPIC_API_KEY`, `CHARGEBEE_API_KEY`, `CHARGEBEE_WEBHOOK_SECRET`, `REVENUECAT_WEBHOOK_SECRET`, `TURNSTILE_SECRET_KEY`, `SENTRY_DSN`, `KROGER_CLIENT_ID`, `KROGER_CLIENT_SECRET`. Outside the blob: `AWS_DEPLOY_ROLE_ARN` (used by the workflow) and `CHARGEBEE_SITE` (non-secret, passed to CDK as env).

The blob is rebuilt from GitHub on every deploy, so any key added by hand in the console is silently wiped. Every new secret must be added in three places: GitHub (both environments), both workflow `jq` blocks, and the reading code.

**AWS access** — no IAM users. Humans assume role `TableTrybAdmin` via CLI profile `tabletryb`; GitHub assumes `github-actions-deploy` through the OIDC provider `token.actions.githubusercontent.com`, with a trust policy scoped to the repo (branch and environment subject claims).

## CI/CD: one-commit deploy

One push ships the whole stack for that branch: GitHub Actions deploys the backend and infrastructure while Amplify, watching the same branch, rebuilds the web app. Mobile ships separately through EAS because App Store builds need review.

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `ci.yml` | push to `develop`/`main`, PRs | `npm ci`, build shared, typecheck, lint, test (does not block deploy) |
| `deploy-staging.yml` | push to `develop`, manual | GitHub environment `staging` → staging stack |
| `deploy-prod.yml` | push to `main` | GitHub environment `production` → prod stack |
| Amplify | push to `develop` or `main` | Builds `frontend/` with branch env vars |
| EAS | manual `eas build` / `eas submit` | iOS binary to TestFlight / App Store |

**Deploy job steps** (both stages, `permissions: id-token: write, contents: read`):

1. `actions/checkout@v4`; `actions/setup-node@v4` with Node 20 and npm cache.
2. `npm ci`, then `npm run build:shared`.
3. `aws-actions/configure-aws-credentials@v4` assuming `secrets.AWS_DEPLOY_ROLE_ARN` in us-east-2.
4. Sync secrets: `jq -n` builds the blob, upsert to `tabletryb/<stage>/secrets`.
5. `npx cdk deploy TableTryb-<stage> --require-approval never` from `infrastructure/`, with `CHARGEBEE_SITE` in env.
6. Print stack outputs with `aws cloudformation describe-stacks`.

**Branch and release rules** — work lands on `develop` only; only the owner merges `develop` → `main`. No `cdk deploy` from a laptop or an AI session; `deploy.sh` exists for emergencies and enforces the right account. `npm run diff:staging` and `npm run synth` are safe for inspection.

**Build gotchas** — never commit `packages/shared/tsconfig.tsbuildinfo` (tsc then skips emitting `dist/` in CI). Root `postinstall` runs `build:shared` so EAS and fresh clones get `dist/`. The shared package is dual-format (tsup CJS + ESM, `exports` map, `tsBuildInfoFile` inside `dist/`) because Node-run tools such as Expo CLI and Tailwind need resolvable imports. Touching only `_shared/` code may not rebuild Lambdas (asset hash), so also touch a handler file.

## Operations, security and legal

Observability is Sentry for errors in all three tiers plus CloudWatch for logs and metrics, with GuardDuty watching the account. Support today runs through CLI access; a read-only admin dashboard is the planned next step.

| Area | TableTryb setup |
| --- | --- |
| Error tracking | Sentry projects `-backend` (`@sentry/aws-serverless`), `-frontend`, `-mobile`; DSN via secrets |
| Logs and queries | CloudWatch Logs per function (`tabletryb-*-<stage>`), Logs Insights |
| Threat detection | GuardDuty in the account-setup stack |
| Email health | SES bounce and complaint → SNS; watch sending reputation |
| Bot defence | Cloudflare Turnstile widgets per environment |
| Tests | Vitest in `backend/test/` (webhook replay harnesses, status, checkout guard) |
| Test data cleanup | `cleanup-test-users.sh` deletes Cognito users and their `HH#`, `SUB#`, `REFCODE#`, `INVITE#` items |

**Security baseline already done** (carry these over from day one): secrets in Secrets Manager; rate limiting; SSRF protection on URL fetches; timing-safe webhook comparison; Turnstile on the contact form; CSP and security headers; S3 upload validation; cryptographic invite tokens; input sanitisation; SES bounce handling.

**Support roadmap** — P1 read-only admin lookup (build near about 500 households), P2 admin actions (resend invite, reset password, extend trial) and an AI support assistant, P3 status page and self-serve household transfer.

**Legal and store** — Terms of Service and Privacy Policy published on the site (sections on households, billing and refunds, referrals, AI-processed content, third-party services, governing law). App Store needs a privacy policy URL, account deletion in-app, and a real paywall screenshot for the subscription review.

**Documentation habit** — `CLAUDE.md` at the repo root holds guardrails for AI coding sessions; `docs/` holds `ARCHITECTURE.md`, `DATABASE.md`, `DEPLOYMENT.md`, `CHANGELOG.md`, and per-phase briefs. A per-phase `update-docs.sh` with sentinel guards prepends changelog entries and is run by the owner after review.

## Replication checklist for CloudScribble

Work top to bottom; each phase ends with something deployable. Replace `tabletryb` with your slug (for example `cloudscribble`) everywhere, including key prefixes, stack names, and secret paths.

**Phase 1 — Accounts and foundations**

- [ ] Decide account strategy: a new AWS account for CloudScribble (cleanest isolation) or the same account with new stacks
- [ ] Pick region; create admin role and CLI profile (no IAM users)
- [ ] Register GitHub OIDC provider and a `github-actions-deploy` role trusted only by the new repo
- [ ] Deploy an account-setup stack with GuardDuty once, by hand
- [ ] Domain at the registrar; SES domain identity with DKIM, SPF, DMARC; request SES production access early
- [ ] Sentry org projects (backend, frontend, mobile); Cloudflare Turnstile widgets (staging, prod)

**Phase 2 — Repo skeleton**

- [ ] npm-workspaces monorepo: `packages/shared`, `frontend`, `backend`, `infrastructure`; `mobile/` present but outside `workspaces`
- [ ] `tsconfig.base.json`; shared package dual-format with tsup, `exports` map, `tsBuildInfoFile` in `dist/`
- [ ] Root scripts `build:shared`, `build`, `typecheck`, `lint`, `test`, `synth`, `diff:<stage>`, and `postinstall: build:shared`
- [ ] `.gitignore` covers `dist/`, `tsbuildinfo`, `.env.*`, `mobile/ios`, `mobile/android`
- [ ] `CLAUDE.md` with guardrails from the Gotchas section; `docs/` with architecture, database, deployment, changelog

**Phase 3 — Infrastructure stack**

- [ ] `bin/app.ts` with staging and prod stacks; stage-driven removal policy and CORS
- [ ] `TrybFunction`-style construct (ARM64, Node 20, `depsLockFilePath`, shared env, secret read)
- [ ] Cognito pool (email sign-in, custom attributes, admin group) with web and mobile clients
- [ ] DynamoDB table with PK/SK, GSI1, GSI2, PITR, TTL; design key prefixes before writing handlers
- [ ] HTTP API with JWT authorizer (both client audiences), throttling, and `addRoute` helper
- [ ] Private S3 bucket plus CloudFront with OAC; SNS for SES events; stack outputs

**Phase 4 — Pipeline**

- [ ] GitHub environments `staging` and `production` with all secrets
- [ ] `ci.yml`, `deploy-staging.yml`, `deploy-prod.yml` (checkout → install → build shared → OIDC → secrets sync → cdk deploy → outputs)
- [ ] Amplify app on the repo; `develop` and `main` branches with env vars; custom domains; `amplify.yml` with cache paths and security headers
- [ ] First push to `develop` and confirm both halves deploy

**Phase 5 — Core app**

- [ ] `_shared/` helpers (dynamo, response, auth, secrets, errors) and a `/v1/health` route
- [ ] Tenant create/join flow and invite tokens; everything scoped by the token's tenant ID
- [ ] Web app: auth context, `useApi`, protected routes, status-driven gating

**Phase 6 — Billing**

- [ ] Web provider (Chargebee or Stripe Billing) with customer ID = tenant ID; checkout, portal, webhook
- [ ] RevenueCat project, entitlement, offering; App Store group, products, intro offer, both Apple keys
- [ ] Two-record model, shared `isAccessActive()`, read-time precedence, checkout guard, Vitest replay tests

**Phase 7 — Mobile**

- [ ] Apple Developer team, bundle ID with capabilities, App Store Connect record
- [ ] Expo app via `npx create-expo-app`, then `npx expo install --check`; Metro, Babel, NativeWind configs as above
- [ ] Cognito auth with secure storage, RevenueCat `logIn(tenantId)`, paywall after login
- [ ] EAS profiles, TestFlight, then App Store submission with privacy policy and deletion flow

**Phase 8 — Launch**

- [ ] Production secrets and live billing sites; push to `main`; set Amplify prod env vars from stack outputs and redeploy
- [ ] Point billing webhooks at the prod API URL; smoke-test sign-up, email, AI, checkout, webhook, core flows
- [ ] Watch Sentry, CloudWatch, GuardDuty, and SES reputation for the first week

## Gotchas and lessons learned

Each of these cost real debugging time on TableTryb; put the relevant ones in the new repo's `CLAUDE.md` on day one.

| Area | Trap | Rule |
| --- | --- | --- |
| Process | Full-file rewrites regressed unrelated features | Read the current file first; surgical edits only; verify nothing else changed |
| Secrets | Keys added by hand were wiped on the next deploy | Add every secret to GitHub, both workflow `jq` blocks, and code |
| Secrets | A missing comma in the prod `jq` block broke the sync step | Diff staging and prod workflows whenever one changes |
| CI | Committed `tsbuildinfo` made tsc skip emitting `dist/` | Keep it out of git; keep `packages/shared/dist/**/*` in Amplify cache |
| CDK | Editing only `_shared/` did not rebuild Lambdas | Also touch a handler file to change the asset hash |
| CDK | esbuild could not resolve workspace packages in CI | Set `depsLockFilePath` to the root lockfile |
| API | HTTP API wraps array claims in brackets | Strip `[` `]` before parsing groups |
| API | WAF cannot attach to HTTP API v2 | Use Turnstile, Cognito throttling, route throttling |
| Billing | AI limiter read only the web subscription record | Always query subscriptions by prefix and use `isAccessActive()` |
| Billing | Webhook route mismatch between docs and dashboard | Verify the dashboard URL against the deployed route |
| Billing | RevenueCat entitlement IDs cannot be renamed | Decide the snake\_case ID before any code uses it |
| AI | A retired model ID caused "temporarily unavailable" | Keep the model ID in config; check before releases |
| Frontend | `useApi()` returns a new object each render | Never put `api` in effect or callback dependency arrays |
| Shared pkg | Bundler-only ESM broke Expo CLI and Tailwind | Publish CJS + ESM with an `exports` map |
| Mobile | NativeWind 4.2.3 / css-interop 0.2.3 silently dropped all styles | Pin `4.2.1` and `0.2.1` exactly, css-interop as a direct dependency |
| Mobile | Hand-pinned Expo packages broke pod install and Swift compile | Run `npx expo install --check` after any dependency change |
| Mobile | `disableHierarchicalLookup` broke Metro in a workspace | Leave it off |
| Mobile | `jsxImportSource` in tsconfig broke `className` types | Set it in Babel only |
| Mobile | `CognitoUser` ignores the pool's storage | Pass `Storage` to every `new CognitoUser` |
| Mobile | `ExpoRandom` missing in production builds | Keep the `crypto.getRandomValues` shim in `index.ts` |
| Mobile | Adding `react-native-purchases` to plugins failed EAS | It has no config plugin; never list it |
| Apple | New developer agreement caused 403 on builds | Accept the updated agreement, wait, retry |
| Apple | Products stuck at "Missing Metadata" were not fetchable in sandbox | Add a review screenshot to reach "Ready to Submit" |
| Shell | `sed -i` fails on macOS | Use `sed -i ''` |
