import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as apigatewayv2Authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { ScribbleFunction, type ScribbleFunctionSharedEnv } from './constructs/scribble-function';

// ============================================================================
// Stack Props
// ============================================================================
export interface CloudScribbleStackProps extends cdk.StackProps {
  stage: 'staging' | 'prod';
  /** Website domain for this stage (CORS origin) */
  siteDomain: string;
  /** SES-verified domain (created by CloudScribble-account) */
  emailDomain: string;
}

// ============================================================================
// Main Stack
// ============================================================================
export class CloudScribbleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CloudScribbleStackProps) {
    super(scope, id, props);

    const { stage, siteDomain, emailDomain } = props;
    const isProd = stage === 'prod';
    const retainInProd = isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;

    // ==================================================================
    // DynamoDB — single table (key patterns: see CLAUDE.md "Data model")
    // ==================================================================
    const table = new dynamodb.Table(this, 'Table', {
      tableName: `cloudscribble-${stage}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'ttl',
      deletionProtection: isProd,
      removalPolicy: retainInProd,
    });

    // ==================================================================
    // Cognito User Pool
    // ==================================================================
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `cloudscribble-${stage}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      email: cognito.UserPoolEmail.withSES({
        fromEmail: `no-reply@${emailDomain}`,
        fromName: 'CloudScribble',
        sesRegion: this.region,
        sesVerifiedDomain: emailDomain,
      }),
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      standardAttributes: {
        email: { required: true, mutable: true },
        givenName: { required: false, mutable: true },
        familyName: { required: false, mutable: true },
      },
      deletionProtection: isProd,
      removalPolicy: retainInProd,
    });

    const userPoolClientWeb = new cognito.UserPoolClient(this, 'UserPoolClientWeb', {
      userPoolClientName: `cloudscribble-web-${stage}`,
      userPool,
      generateSecret: false,
      authFlows: { userSrp: true },
      preventUserExistenceErrors: true,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
    });

    // Mobile client — amazon-cognito-identity-js; long refresh so users stay signed in.
    const userPoolClientMobile = new cognito.UserPoolClient(this, 'UserPoolClientMobile', {
      userPoolClientName: `cloudscribble-mobile-${stage}`,
      userPool,
      generateSecret: false,
      authFlows: { userSrp: true, userPassword: true },
      preventUserExistenceErrors: true,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(365),
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
    });

    new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'cloudscribble-admins',
      description: 'Admin access',
    });

    // ==================================================================
    // S3 — scan uploads (private, presigned POST only, 1-day expiry)
    // ==================================================================
    const scansBucket = new s3.Bucket(this, 'ScansBucket', {
      bucketName: `cloudscribble-scans-${this.account}-${stage}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      lifecycleRules: [
        { id: 'expire-scans', expiration: cdk.Duration.days(1), abortIncompleteMultipartUploadAfter: cdk.Duration.days(1) },
      ],
      removalPolicy: retainInProd,
      autoDeleteObjects: !isProd,
    });

    // ==================================================================
    // Shared environment for all Lambdas
    // ==================================================================
    const sharedEnv: ScribbleFunctionSharedEnv = {
      TABLE_NAME: table.tableName,
      STAGE: stage,
      SCANS_BUCKET: scansBucket.bucketName,
      USER_POOL_ID: userPool.userPoolId,
      ALLOWED_ORIGIN: `https://${siteDomain}`,
      SECRETS_NAME: `cloudscribble/${stage}/secrets`,
    };

    // ==================================================================
    // Lambda functions
    // ==================================================================
    const healthGet = new ScribbleFunction(this, 'HealthGet', {
      stage, sharedEnv,
      entry: 'health/get.ts',
      description: 'Liveness check',
      memorySize: 128,
      timeout: 5,
    });

    const uploadsCreate = new ScribbleFunction(this, 'UploadsCreate', {
      stage, sharedEnv,
      entry: 'uploads/create.ts',
      description: 'Presigned POST for a scan image',
      timeout: 10,
      policies: [
        new iam.PolicyStatement({ actions: ['s3:PutObject'], resources: [scansBucket.arnForObjects('scans/*')] }),
      ],
    });

    // Bedrock model IDs are inference profiles (us.*), which route to foundation models in several US regions.
    const scansCreate = new ScribbleFunction(this, 'ScansCreate', {
      stage, sharedEnv,
      entry: 'scans/create.ts',
      description: 'Read a planner page with Claude (Bedrock) and return events',
      timeout: 29, // HTTP API integrations time out at 30s; scanPage budgets its calls within this
      memorySize: 512,
      environment: {
        SCAN_MODEL_PRIMARY: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
        // Sonnet 5.x / Haiku 5.5 are not yet enabled for this account on Bedrock (AWS-gated); 4.6 is.
        SCAN_MODEL_FALLBACK: 'us.anthropic.claude-sonnet-4-6',
        SCAN_FALLBACK_BELOW: '0.7',
        SCAN_FALLBACK_EFFORT: 'low',
      },
      policies: [
        new iam.PolicyStatement({
          actions: ['s3:GetObject', 's3:DeleteObject'],
          resources: [scansBucket.arnForObjects('scans/*')],
        }),
        new iam.PolicyStatement({
          actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:Query'],
          resources: [table.tableArn],
        }),
        new iam.PolicyStatement({
          actions: ['bedrock:InvokeModel'],
          resources: [
            `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/us.anthropic.*`,
            'arn:aws:bedrock:*::foundation-model/anthropic.*',
          ],
        }),
      ],
    });

    // ==================================================================
    // API Gateway (HTTP API)
    // ==================================================================
    const httpApi = new apigatewayv2.HttpApi(this, 'HttpApi', {
      apiName: `cloudscribble-api-${stage}`,
      description: `CloudScribble API — ${stage}`,
      corsPreflight: {
        // Native mobile sends no Origin; only the website needs CORS.
        allowOrigins: isProd
          ? [`https://${siteDomain}`, `https://www.${siteDomain}`]
          : [`https://${siteDomain}`, 'http://localhost:5173'],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PUT,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Authorization', 'Content-Type'],
        allowCredentials: true,
        maxAge: cdk.Duration.hours(24),
      },
    });

    // Stage-wide throttling (WAF can't attach to HTTP API). Per-route limits added with routes.
    const defaultStage = httpApi.defaultStage!.node.defaultChild as apigatewayv2.CfnStage;
    defaultStage.defaultRouteSettings = {
      throttlingRateLimit: 50,
      throttlingBurstLimit: 100,
    };
    // AI route: tighter stage-wide limit (each call costs money).
    // RouteSettings is untyped JSON in CloudFormation — keys must be PascalCase.
    defaultStage.routeSettings = {
      'POST /v1/scans': { ThrottlingRateLimit: 10, ThrottlingBurstLimit: 20 },
    };

    const jwtAuthorizer = new apigatewayv2Authorizers.HttpJwtAuthorizer(
      'CognitoAuthorizer',
      `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
      { jwtAudience: [userPoolClientWeb.userPoolClientId, userPoolClientMobile.userPoolClientId] }
    );

    const addRoute = (
      method: apigatewayv2.HttpMethod,
      path: string,
      fn: ScribbleFunction,
      options?: { noAuth?: boolean }
    ) => {
      httpApi.addRoutes({
        path,
        methods: [method],
        integration: new apigatewayv2Integrations.HttpLambdaIntegration(
          `${fn.node.id}-integration`,
          fn.function
        ),
        authorizer: options?.noAuth ? undefined : jwtAuthorizer,
      });
    };

    // --- Public routes ---
    addRoute(apigatewayv2.HttpMethod.GET, '/v1/health', healthGet, { noAuth: true });

    // --- Authenticated routes ---
    addRoute(apigatewayv2.HttpMethod.POST, '/v1/uploads', uploadsCreate);
    addRoute(apigatewayv2.HttpMethod.POST, '/v1/scans', scansCreate);

    // ==================================================================
    // CloudWatch alarms
    // ==================================================================
    new cloudwatch.Alarm(this, 'Api5xxAlarm', {
      alarmName: `cloudscribble-api-5xx-${stage}`,
      alarmDescription: 'API Gateway 5xx errors above threshold',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '5xx',
        dimensionsMap: { ApiId: httpApi.httpApiId },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 10,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // ==================================================================
    // Outputs
    // ==================================================================
    new cdk.CfnOutput(this, 'ApiUrl', { value: httpApi.apiEndpoint, description: 'HTTP API endpoint' });
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId, description: 'Cognito user pool ID' });
    new cdk.CfnOutput(this, 'UserPoolClientIdWeb', { value: userPoolClientWeb.userPoolClientId, description: 'Cognito web client ID' });
    new cdk.CfnOutput(this, 'UserPoolClientIdMobile', { value: userPoolClientMobile.userPoolClientId, description: 'Cognito mobile client ID' });
    new cdk.CfnOutput(this, 'TableName', { value: table.tableName, description: 'DynamoDB table' });
    new cdk.CfnOutput(this, 'ScansBucketName', { value: scansBucket.bucketName, description: 'Scan upload bucket' });
    new cdk.CfnOutput(this, 'Region', { value: this.region, description: 'AWS region' });
  }
}
