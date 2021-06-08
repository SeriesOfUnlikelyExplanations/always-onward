#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AlwaysOnwardStack } from '../lib/alwaysOnwardStack';
import { LambdaStack } from '../lib/lambdaStack';

const app = new cdk.App();
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'us-west-2'
}

const Lambda = new LambdaStack(app, "lambda", {
  stackName: 'Always-Onward-lambda-stack',
  env: env,
});

new AlwaysOnwardStack(app, 'AlwaysOnwardStack', {
  apigw: Lambda.apigw,
  stackName: 'Always-Onward-base-stack',
  env: env,
});
