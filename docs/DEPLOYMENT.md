# Deployment

- `develop` → `CloudScribble-staging`, `main` → `CloudScribble-prod`, via GitHub Actions (OIDC). No laptop deploys.
- One exception: `CloudScribble-account` (OIDC deploy role, GuardDuty, SES identity), deployed once by the owner.

## Account bootstrap (Build Order step 1, owner only)

1. Create the new AWS account; sign in with an admin role and set up a CLI profile (no IAM users). Example profile name: `cloudscribble`.
2. Bootstrap CDK in us-east-2:
   ```
   npx cdk bootstrap aws://<ACCOUNT_ID>/us-east-2 --profile cloudscribble
   ```
3. Deploy the account stack (from `infrastructure/`):
   ```
   npx cdk deploy CloudScribble-account --profile cloudscribble
   ```
4. Add the DNS records from the stack outputs at the registrar (3 DKIM CNAMEs, MAIL FROM MX + SPF TXT, DMARC TXT). Wait until SES shows the domain as verified.
5. Confirm the SNS subscription email sent to support@cloudscribble.com.
6. SES: request production access (sandbox only sends to verified addresses).
7. Bedrock (us-east-2): complete Anthropic's one-time use-case form in the Bedrock console; check quotas for Haiku 4.5 and Sonnet and request increases early.
8. GitHub repo `blackburn635/cloudscribble` → Settings → Environments: create `staging` and `production`, each with secret `AWS_DEPLOY_ROLE_ARN` = the `DeployRoleArn` output.

The staging/prod stacks will fail to deploy until step 4 completes (Cognito sends email through the SES domain).

## Secrets

Source of truth: GitHub environment secrets → synced by the deploy workflow's `jq` block into `cloudscribble/<stage>/secrets`. New secret = GitHub (both environments) + both workflow `jq` blocks + reading code.

_Secret list, workflows, and Amplify setup to be filled in during Build Order step 4._
