import * as cdk from '@aws-cdk/core';
import { CloudFrontWebDistribution, CloudFrontAllowedMethods } from '@aws-cdk/aws-cloudfront'
import { Bucket, BlockPublicAccess } from '@aws-cdk/aws-s3';
import { BucketDeployment, Source } from '@aws-cdk/aws-s3-deployment';
import * as lambda from "@aws-cdk/aws-lambda";
import * as cognito from "@aws-cdk/aws-cognito";
import * as route53 from '@aws-cdk/aws-route53';
import * as targets from '@aws-cdk/aws-route53-targets';
import * as acm from '@aws-cdk/aws-certificatemanager';
import * as apigateway from '@aws-cdk/aws-apigateway';
import * as config from './config';

interface myStackProps extends cdk.StackProps {
  apigw: apigateway.LambdaRestApi;
  userPool: cognito.UserPool;
  handler: lambda.Function;
  sourceBucket: Bucket
}

export class AlwaysOnwardStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: myStackProps) {
    super(scope, id, props);

    const {userPool, apigw, handler, sourceBucket} = props;
    const distribution = new CloudFrontWebDistribution(this, config.siteName + '-cfront', {
      originConfigs: [
        {
          customOriginSource: {
            domainName: `${apigw.restApiId}.execute-api.${this.region}.${this.urlSuffix}`,
            //~ originProtocolPolicy: cf.OriginProtocolPolicy.MATCH_VIEWER
          },
          originPath: `/${apigw.deploymentStage.stageName}`,
          behaviors: [{
            pathPattern: '/api/*',
            allowedMethods: CloudFrontAllowedMethods.ALL,
            forwardedValues: {
              queryString: true,
              cookies: { forward: 'all'},
              headers: [ "Referer" ]
            },
          }]
        },
        {
          s3OriginSource: {
            s3BucketSource: sourceBucket,
            //~ originAccessIdentity: oia
          },
          behaviors : [ {isDefaultBehavior: true}]
        },
      ],
      aliasConfiguration: {
        acmCertRef: config.certificateArn,
        names: [config.siteName]
      }
    });

    new BucketDeployment(this, config.siteName + 'DeployWebsite', {
      sources: [Source.asset(config.websiteDistSourcePath)],
      destinationBucket: sourceBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    const myHostedZone = route53.HostedZone.fromHostedZoneAttributes(this, config.siteName + '-hosted-zone', {
      hostedZoneId: config.hostedZoneId,
      zoneName: config.zoneName,
    });
    new route53.ARecord(this, config.siteName + '-alias-record', {
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      zone: myHostedZone,
      recordName: config.siteName,
    });
    //add cognito authorizer to the Lambda
    //~ const auth = new apigateway.CognitoUserPoolsAuthorizer(this, 'alwaysOnwardAuthorizer', {
      //~ cognitoUserPools: [userPool]
    //~ });
    //~ const my_resource = apigw.root.addResource("private")
    //~ const private_route = my_resource.addMethod('ANY', new apigateway.LambdaIntegration(handler), {
      //~ authorizationType: apigateway.AuthorizationType.COGNITO,
      //~ authorizer: auth
    //~ });
  }
}
