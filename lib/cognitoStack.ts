import cdk = require('@aws-cdk/core');
import * as cognito from "@aws-cdk/aws-cognito";
import * as config from './onwardConfig';
import * as acm from '@aws-cdk/aws-certificatemanager';

export class CognitoStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: config.siteNames[0],
      selfSignUpEnabled: true, // Allow users to sign up
      autoVerify: { email: true }, // Verify email addresses by sending a verification code
      signInAliases: { email: true }, // Set email as an alias
    });
    userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix: config.authName,
      },
    });
    const domainCert = acm.Certificate.fromCertificateArn(this, 'domainCert', config.certificateArn);
    userPool.addDomain('CustomDomain', {
      customDomain: {
        domainName: config.authDomain,
        certificate: domainCert,
      },
    });

    const userPoolClient = new cognito.UserPoolClient(this, "UserPoolClient", {
      userPool,
      generateSecret: false, // Don't need to generate secret for web app running on browsers
    });

    const identityPool = new cognito.CfnIdentityPool(this, "IdentityPool", {
      allowUnauthenticatedIdentities: false, // Don't allow unathenticated users
      cognitoIdentityProviders: [
        {
          clientId: userPoolClient.userPoolClientId,
          providerName: userPool.userPoolProviderName,
        },
      ],
    });

    // Export values
    new cdk.CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId,
    });
    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
    });
    new cdk.CfnOutput(this, "IdentityPoolId", {
      value: identityPool.ref,
    });
  }
}