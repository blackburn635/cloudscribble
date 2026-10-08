import * as cdk from 'aws-cdk-lib';
import * as guardduty from 'aws-cdk-lib/aws-guardduty';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';

/**
 * Account bootstrap — deployed ONCE by the owner from a laptop (the only exception
 * to "deploy by commit"). Prerequisite: `cdk bootstrap aws://<account>/us-east-2`.
 *
 * Resources:
 *   - GitHub OIDC provider + `github-actions-deploy` role (trusted only by the repo's
 *     `staging` and `production` GitHub environments)
 *   - GuardDuty detector + HIGH/CRITICAL findings → SNS → email
 *   - Route 53 public hosted zone for the domain (registered at Spaceship, which points its
 *     nameservers here). All records are code — never hand-edit them in the console.
 *   - SES domain identity (Easy DKIM + custom MAIL FROM); its DNS records are created in the zone.
 */
export interface AccountStackProps extends cdk.StackProps {
  /** owner/repo */
  githubRepo: string;
  /**
   * Repo as it appears in GitHub's OIDC `sub` claim, which uses immutable IDs:
   * `owner@<ownerId>/repo@<repoId>`. Immune to repo renames and name reuse.
   */
  githubOidcRepo: string;
  domainName: string;
  alertEmail: string;
}

export class AccountStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AccountStackProps) {
    super(scope, id, props);

    const { githubRepo, githubOidcRepo, domainName, alertEmail } = props;

    // ==================================================================
    // GitHub Actions OIDC deploy role
    // ==================================================================
    const githubProvider = new iam.OidcProviderNative(this, 'GitHubOidcProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    const deployRole = new iam.Role(this, 'GitHubDeployRole', {
      roleName: 'github-actions-deploy',
      description: `Assumed by GitHub Actions (${githubRepo}) to deploy CloudScribble stacks`,
      assumedBy: new iam.WebIdentityPrincipal(githubProvider.oidcProviderArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
        },
        StringLike: {
          'token.actions.githubusercontent.com:sub': [
            `repo:${githubOidcRepo}:environment:staging`,
            `repo:${githubOidcRepo}:environment:production`,
          ],
        },
      }),
      maxSessionDuration: cdk.Duration.hours(1),
    });

    // CDK deploys by assuming the bootstrap roles; the deploy role itself holds no app permissions.
    deployRole.addToPolicy(new iam.PolicyStatement({
      actions: ['sts:AssumeRole'],
      resources: [`arn:aws:iam::${this.account}:role/cdk-hnb659fds-*-${this.account}-${this.region}`],
    }));

    // Workflow secrets sync (describe → put, else create)
    deployRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'secretsmanager:DescribeSecret',
        'secretsmanager:PutSecretValue',
        'secretsmanager:CreateSecret',
        'secretsmanager:TagResource',
      ],
      resources: [`arn:aws:secretsmanager:${this.region}:${this.account}:secret:cloudscribble/*`],
    }));

    // Workflow "print outputs" step
    deployRole.addToPolicy(new iam.PolicyStatement({
      actions: ['cloudformation:DescribeStacks'],
      resources: [`arn:aws:cloudformation:${this.region}:${this.account}:stack/CloudScribble-*/*`],
    }));

    // ==================================================================
    // GuardDuty + alerts
    // ==================================================================
    new guardduty.CfnDetector(this, 'GuardDutyDetector', {
      enable: true,
      findingPublishingFrequency: 'FIFTEEN_MINUTES',
      features: [
        { name: 'S3_DATA_EVENTS', status: 'ENABLED' },
        { name: 'LAMBDA_NETWORK_LOGS', status: 'ENABLED' },
      ],
    });

    const alertTopic = new sns.Topic(this, 'SecurityAlertTopic', {
      topicName: 'cloudscribble-security-alerts',
      displayName: 'CloudScribble Security Alerts',
    });
    alertTopic.addSubscription(new subscriptions.EmailSubscription(alertEmail));

    new events.Rule(this, 'GuardDutyHighCriticalRule', {
      ruleName: 'cloudscribble-guardduty-high-critical',
      description: 'Routes GuardDuty HIGH and CRITICAL findings to SNS',
      eventPattern: {
        source: ['aws.guardduty'],
        detailType: ['GuardDuty Finding'],
        detail: { severity: [{ numeric: ['>=', 7] }] },
      },
      targets: [new targets.SnsTopic(alertTopic)],
    });

    // ==================================================================
    // Route 53 hosted zone (moved from the legacy account's zone)
    // ==================================================================
    const zone = new route53.PublicHostedZone(this, 'HostedZone', {
      zoneName: domainName,
      comment: 'CloudScribble — managed by CloudScribble-account (CDK)',
    });

    const fiveMinutes = cdk.Duration.minutes(5);

    // --- Spacemail (support@ mailbox) ---
    new route53.MxRecord(this, 'SpacemailMx', {
      zone,
      values: [
        { priority: 10, hostName: 'mx1.spacemail.com' },
        { priority: 20, hostName: 'mx2.spacemail.com' },
      ],
      ttl: fiveMinutes,
    });

    new route53.TxtRecord(this, 'ApexSpf', {
      zone,
      values: ['v=spf1 include:spf.spacemail.com ~all'],
      ttl: fiveMinutes,
    });

    new route53.SrvRecord(this, 'SpacemailAutoconfig', {
      zone,
      values: [{ priority: 0, weight: 0, port: 443, hostName: 'autoconfig.spacemail.com' }],
      ttl: fiveMinutes,
    });

    // One TXT value (the legacy zone split this key across two records, breaking DKIM).
    new route53.TxtRecord(this, 'SpacemailDkim', {
      zone,
      recordName: 'spacemail._domainkey',
      values: [
        'v=DKIM1;k=rsa;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArmw1uCUG0jInlyO5xfck/Al9m7L9HtRQCfqSXNP2XWtFk4OIMN2s/oOEw+iQVmpwIcwSzk9rgDEAUrLyDxMq6VgOjsP9fEx+/'
        + 'lMWdttmIvRHTdqZrtEQ3fXbD3ODRDUxKa8XFWG3QjIWH47KN+TEusJf5Os2EDYKE8co0k8Y2MxWtK7dNkAoi4+XrmpkzSRxV7/5woacuoVhdg0HWPxJT8kWpBeFtGWUF+n92R9VW93oXyFSDMmuBxJqpLJAQ+spE5qZOPOgBowh8Qr8kDGOfnud/'
        + 'kGn1kEhU5kGRgBEmYjhuF+kM9+alw5s5XVgBOCDET8InC4t5EG8nTbQcBDSJwIDAQAB',
      ],
      ttl: fiveMinutes,
    });

    new route53.TxtRecord(this, 'Dmarc', {
      zone,
      recordName: '_dmarc',
      values: [`v=DMARC1; p=none; rua=mailto:${alertEmail}`],
      ttl: cdk.Duration.hours(1),
    });

    // --- TEMPORARY: legacy-account resources. Remove at launch cutover (see CLAUDE.md). ---
    // Pre-launch website: Amplify app `cloudscribble-pre-launch-website` (legacy account).
    const preLaunchSite = route53.RecordTarget.fromAlias({
      bind: () => ({ dnsName: 'd3tf4sck4uqw4j.cloudfront.net', hostedZoneId: 'Z2FDTNDATAQYW2' }),
    });
    new route53.ARecord(this, 'TempPreLaunchApex', { zone, target: preLaunchSite });
    new route53.ARecord(this, 'TempPreLaunchWww', { zone, recordName: 'www', target: preLaunchSite });

    // Amplify-managed certificate renewal for the legacy Amplify apps.
    new route53.CnameRecord(this, 'TempPreLaunchCertValidation', {
      zone,
      recordName: '_20305e66cc35e101c5c6f4f5b275adf0',
      domainName: '_0691c8770b48499bc4a7bca1f8f2fc88.xlfgrmvvlj.acm-validations.aws',
      ttl: fiveMinutes,
    });

    // `staging.` is managed by the new Amplify app's custom domain (Amplify creates its records) — never define it here.

    // ==================================================================
    // SES domain identity (shared by both stages) — DKIM + MAIL FROM records created in the zone
    // ==================================================================
    new ses.EmailIdentity(this, 'DomainIdentity', {
      identity: ses.Identity.publicHostedZone(zone),
      mailFromDomain: `mail.${domainName}`,
    });

    new cdk.CfnOutput(this, 'NameServers', {
      value: cdk.Fn.join(', ', zone.hostedZoneNameServers!),
      description: 'Set these as the domain nameservers at Spaceship (after verification)',
    });

    new cdk.CfnOutput(this, 'DeployRoleArn', {
      value: deployRole.roleArn,
      description: 'Set as AWS_DEPLOY_ROLE_ARN in both GitHub environments',
    });
  }
}
