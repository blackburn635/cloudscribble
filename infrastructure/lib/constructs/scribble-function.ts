import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

/**
 * Reusable Lambda function construct for CloudScribble (adapted from TableTryb's TrybFunction).
 *
 * Standardizes: runtime, architecture, bundling, environment, log retention, tagging.
 *
 * Example:
 *   const fn = new ScribbleFunction(this, 'HealthGet', {
 *     stage, sharedEnv,
 *     entry: 'health/get.ts',
 *   });
 */

export interface ScribbleFunctionProps {
  /** Path to the handler file, relative to backend/functions/ */
  entry: string;
  /** Exported handler function name (default: 'handler') */
  handler?: string;
  /** Timeout in seconds (default: 30) */
  timeout?: number;
  /** Memory in MB (default: 256) */
  memorySize?: number;
  /** Additional environment variables beyond the shared defaults */
  environment?: Record<string, string>;
  /** Additional IAM policy statements */
  policies?: iam.PolicyStatement[];
  description?: string;
}

/**
 * Shared environment variables for all Lambdas.
 * NOTE: Secrets are NOT here — they live in Secrets Manager (`SECRETS_NAME`)
 * and are fetched at runtime via _shared/secrets.ts.
 */
export interface ScribbleFunctionSharedEnv {
  TABLE_NAME: string;
  STAGE: string;
  SCANS_BUCKET: string;
  USER_POOL_ID: string;
  ALLOWED_ORIGIN: string;
  SECRETS_NAME: string;
}

export class ScribbleFunction extends Construct {
  public readonly function: nodejs.NodejsFunction;

  constructor(
    scope: Construct,
    id: string,
    props: ScribbleFunctionProps & { stage: string; sharedEnv: ScribbleFunctionSharedEnv }
  ) {
    super(scope, id);

    const repoRoot = path.join(__dirname, '..', '..', '..');
    const functionName = `cloudscribble-${id.toLowerCase()}-${props.stage}`;

    const logGroup = new logs.LogGroup(this, 'Logs', {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: props.stage === 'prod' ? logs.RetentionDays.THREE_MONTHS : logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.function = new nodejs.NodejsFunction(this, 'Function', {
      functionName,
      entry: path.join(repoRoot, 'backend', 'functions', props.entry),
      handler: props.handler || 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(props.timeout || 30),
      memorySize: props.memorySize || 256,
      description: props.description,
      logGroup,

      bundling: {
        minify: true,
        target: 'es2022',
        sourceMap: true,
        externalModules: ['@aws-sdk/*'], // Lambda-provided SDK
      },
      // Root lockfile so workspace packages (@cloudscribble/shared) resolve in CI
      depsLockFilePath: path.join(repoRoot, 'package-lock.json'),

      environment: {
        ...props.sharedEnv,
        NODE_OPTIONS: '--enable-source-maps',
        ...(props.environment || {}),
      },
    });

    // Runtime secret retrieval
    this.function.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [
          cdk.Arn.format(
            {
              service: 'secretsmanager',
              resource: 'secret',
              resourceName: `${props.sharedEnv.SECRETS_NAME}-*`,
              arnFormat: cdk.ArnFormat.COLON_RESOURCE_NAME,
            },
            cdk.Stack.of(this)
          ),
        ],
      })
    );

    for (const policy of props.policies || []) {
      this.function.addToRolePolicy(policy);
    }

    cdk.Tags.of(this.function).add('Project', 'CloudScribble');
    cdk.Tags.of(this.function).add('Stage', props.stage);
  }
}
