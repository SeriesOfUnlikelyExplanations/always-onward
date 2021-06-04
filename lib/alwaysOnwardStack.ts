import * as cdk from '@aws-cdk/core';
import { CloudFrontWebDistribution, OriginAccessIdentity } from '@aws-cdk/aws-cloudfront'
import { Bucket, BlockPublicAccess } from '@aws-cdk/aws-s3';
import { BucketDeployment, Source } from '@aws-cdk/aws-s3-deployment';
import * as route53 from '@aws-cdk/aws-route53';
import * as targets from '@aws-cdk/aws-route53-targets';
import * as apigw from '@aws-cdk/aws-apigateway';
import * as config from './onwardConfig';

export class AlwaysOnwardStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, apigw: apigw.LambdaRestApi, props?: cdk.StackProps) {
    super(scope, id, props);

    const sourceBucket = new Bucket(this, config.siteNames[0] + '-website', {
      websiteIndexDocument: 'index.html',
      bucketName: config.siteNames[0],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    });

    const oia = new OriginAccessIdentity(this, 'OIA', {
      comment: "Created by CDK"
    });
    sourceBucket.grantRead(oia);

    const distribution = new CloudFrontWebDistribution(this, config.siteNames[0] + '-cfront', {
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: sourceBucket,
            originAccessIdentity: oia
          },
          behaviors : [ {isDefaultBehavior: true}]
        },
        {
          customOriginSource: {
            domainName: `${apigw.restApiId}.execute-api.${this.region}.${this.urlSuffix}`
          },
          originPath: `/${apigw.deploymentStage.stageName}`,
          behaviors: [{
            pathPattern: '/api/*',
            allowedMethods: cloudfront.CloudFrontAllowedMethods.ALL
          }]
        }
      ],
      aliasConfiguration: {
        acmCertRef: config.certificateArn,
        names: config.siteNames
      }
    });

    new BucketDeployment(this, config.siteNames[0] + 'DeployWebsite', {
      sources: [Source.asset(config.websiteDistSourcePath)],
      destinationBucket: sourceBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    const myHostedZone = route53.HostedZone.fromHostedZoneAttributes(this, config.siteNames[0] + '-hosted-zone', {
      hostedZoneId: config.hostedZoneId,
      zoneName: config.zoneName,
    });

    config.siteNames.forEach((siteName) => {
      new route53.ARecord(this, siteName + '-alias-record', {
        target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
        zone: myHostedZone,
        recordName: siteName,
      });
    });
  }
}
