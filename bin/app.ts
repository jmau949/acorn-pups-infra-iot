#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { IotThingTypeStack } from '../lib/iot-thing-type-stack';
import { IotRulesStack } from '../lib/iot-rules-stack';
import { CertificateManagementStack } from '../lib/certificate-management-stack';
import { MonitoringStack } from '../lib/monitoring-stack';

const app = new cdk.App();

// Get environment from context (dev or prod)
const environment = app.node.tryGetContext('environment') || 'dev';
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION || 'us-east-1';

console.log(`Deploying Acorn Pups IoT infrastructure to environment: ${environment}`);

const env = {
  account,
  region,
};

// Environment-specific configuration
const config = {
  dev: {
    logLevel: 'DEBUG',
    enableDetailedMonitoring: true,
    certificateExpirationDays: 365,
    ruleErrorDestination: 'cloudwatch',
  },
  prod: {
    logLevel: 'INFO',
    enableDetailedMonitoring: true,
    certificateExpirationDays: 3652,
    ruleErrorDestination: 'cloudwatch',
  }
};

const envConfig = config[environment as keyof typeof config];
if (!envConfig) {
  throw new Error(`Invalid environment: ${environment}. Must be 'dev' or 'prod'`);
}

// Stack naming convention
const stackPrefix = `acorn-pups-iot-${environment}`;

// Certificate Management Stack (stores S3 bucket and configuration parameters)
const certificateStack = new CertificateManagementStack(app, `${stackPrefix}-certificates`, {
  env,
  environment,
  ...envConfig,
});

// IoT Thing Type Stack - ESP32 Receivers only
const thingTypeStack = new IotThingTypeStack(app, `${stackPrefix}-thing-types`, {
  env,
  environment,
  ...envConfig,
});

// IoT Rules Stack (references IoT rule execution role from API repository)
const rulesStack = new IotRulesStack(app, `${stackPrefix}-rules`, {
  env,
  environment,
  ...envConfig,
});

// Monitoring Stack (monitors all IoT components)
const monitoringStack = new MonitoringStack(app, `${stackPrefix}-monitoring`, {
  env,
  environment,
  thingTypeName: thingTypeStack.acornPupsReceiverThingType.thingTypeName!,
  iotRules: rulesStack.rules,
  ...envConfig,
});

// Add dependencies to ensure proper deployment order
// Note: IoT policies are now managed in the API repository alongside certificate management
rulesStack.addDependency(certificateStack);
rulesStack.addDependency(thingTypeStack);
monitoringStack.addDependency(thingTypeStack);
monitoringStack.addDependency(rulesStack);

// Tags for all resources
cdk.Tags.of(app).add('Project', 'acorn-pups');
cdk.Tags.of(app).add('Environment', environment);
cdk.Tags.of(app).add('Service', 'IoT-Core');
cdk.Tags.of(app).add('ManagedBy', 'CDK');
cdk.Tags.of(app).add('Architecture', 'ESP32-Receiver-RF-Button'); 