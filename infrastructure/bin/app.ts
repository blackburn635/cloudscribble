#!/usr/bin/env node
/**
 * CDK App — CloudScribble infrastructure.
 *
 *   CloudScribble-account  — account bootstrap (OIDC deploy role, GuardDuty, SES identity).
 *                            Deployed ONCE by the owner from a laptop. Never by CI or an AI session.
 *   CloudScribble-staging  — develop branch → staging.cloudscribble.com (GitHub Actions)
 *   CloudScribble-prod     — main branch    → cloudscribble.com         (GitHub Actions)
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BRAND } from '@cloudscribble/shared';
import { AccountStack } from '../lib/account-stack';
import { CloudScribbleStack } from '../lib/cloudscribble-stack';

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'us-east-2',
};

new AccountStack(app, 'CloudScribble-account', {
  env,
  description: 'CloudScribble — account bootstrap (GitHub OIDC deploy role, GuardDuty, SES domain identity)',
  githubRepo: 'blackburn635/cloudscribble',
  githubOidcRepo: 'blackburn635@215784882/cloudscribble@1406374307',
  domainName: BRAND.domain,
  alertEmail: BRAND.supportEmail,
});

new CloudScribbleStack(app, 'CloudScribble-staging', {
  env,
  description: 'CloudScribble — staging',
  stage: 'staging',
  siteDomain: `staging.${BRAND.domain}`,
  // Amplify default domain for the develop branch (app d2orlejbd6zz8l) + local Vite dev server.
  extraOrigins: ['https://develop.d2orlejbd6zz8l.amplifyapp.com', 'http://localhost:5173'],
  emailDomain: BRAND.domain,
});

new CloudScribbleStack(app, 'CloudScribble-prod', {
  env,
  description: 'CloudScribble — production',
  stage: 'prod',
  siteDomain: BRAND.domain,
  extraOrigins: [`https://www.${BRAND.domain}`],
  emailDomain: BRAND.domain,
});

app.synth();
