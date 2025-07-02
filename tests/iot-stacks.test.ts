import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { IotThingTypeStack } from '../lib/iot-thing-type-stack';
import { IotPolicyStack } from '../lib/iot-policy-stack';
import { CertificateManagementStack } from '../lib/certificate-management-stack';
import { MonitoringStack } from '../lib/monitoring-stack';

describe('IoT Infrastructure Stacks', () => {
  let app: cdk.App;
  const environment = 'test';
  const env = {
    account: '123456789012',
    region: 'us-east-1',
  };

  beforeEach(() => {
    app = new cdk.App();
  });

  describe('IotThingTypeStack', () => {
    test('creates AcornPupsDevice Thing Type', () => {
      const stack = new IotThingTypeStack(app, 'TestThingTypeStack', {
        env,
        environment,
        logLevel: 'DEBUG',
        enableDetailedMonitoring: true,
        certificateExpirationDays: 365,
        ruleErrorDestination: 'cloudwatch',
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::IoT::ThingType', {
        ThingTypeName: `AcornPupsDevice-${environment}`,
        ThingTypeProperties: {
          Description: 'IoT Thing Type for Acorn Pups ESP32-based dog communication devices',
          SearchableAttributes: [
            'deviceName',
            'firmwareVersion',
            'macAddress',
            'deviceType',
            'location',
            'owner',
            'status'
          ]
        }
      });
    });

    test('creates Parameter Store parameters', () => {
      const stack = new IotThingTypeStack(app, 'TestThingTypeStack', {
        env,
        environment,
        logLevel: 'DEBUG',
        enableDetailedMonitoring: true,
        certificateExpirationDays: 365,
        ruleErrorDestination: 'cloudwatch',
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: `/acorn-pups/${environment}/iot-core/thing-type/arn`,
        Type: 'String'
      });

      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: `/acorn-pups/${environment}/iot-core/thing-type/name`,
        Type: 'String'
      });
    });
  });

  describe('IotPolicyStack', () => {
    test('creates device policy with correct permissions', () => {
      const stack = new IotPolicyStack(app, 'TestPolicyStack', {
        env,
        environment,
        thingTypeName: `AcornPupsDevice-${environment}`,
        logLevel: 'DEBUG',
        enableDetailedMonitoring: true,
        certificateExpirationDays: 365,
        ruleErrorDestination: 'cloudwatch',
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::IoT::Policy', {
        PolicyName: `AcornPupsDevicePolicy-${environment}`,
        PolicyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Action: 'iot:Connect',
              Resource: `arn:aws:iot:${env.region}:${env.account}:client/acorn-esp32-*`
            }
          ]
        }
      });
    });

    test('creates IoT Rule execution role', () => {
      const stack = new IotPolicyStack(app, 'TestPolicyStack', {
        env,
        environment,
        thingTypeName: `AcornPupsDevice-${environment}`,
        logLevel: 'DEBUG',
        enableDetailedMonitoring: true,
        certificateExpirationDays: 365,
        ruleErrorDestination: 'cloudwatch',
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::IAM::Role', {
        RoleName: `AcornPupsIoTRuleExecution-${environment}`,
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Effect: 'Allow',
              Principal: {
                Service: 'iot.amazonaws.com'
              },
              Action: 'sts:AssumeRole'
            }
          ]
        }
      });
    });
  });

  describe('CertificateManagementStack', () => {
    test('creates S3 bucket for certificates', () => {
      const stack = new CertificateManagementStack(app, 'TestCertificateStack', {
        env,
        environment,
        logLevel: 'DEBUG',
        enableDetailedMonitoring: true,
        certificateExpirationDays: 365,
        ruleErrorDestination: 'cloudwatch',
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: `acorn-pups-certificates-${environment}-${env.account}`,
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            {
              ServerSideEncryptionByDefault: {
                SSEAlgorithm: 'AES256'
              }
            }
          ]
        }
      });
    });

    test('creates certificate template parameters', () => {
      const stack = new CertificateManagementStack(app, 'TestCertificateStack', {
        env,
        environment,
        logLevel: 'DEBUG',
        enableDetailedMonitoring: true,
        certificateExpirationDays: 365,
        ruleErrorDestination: 'cloudwatch',
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: `/acorn-pups/${environment}/iot-core/certificate-template/template`,
        Type: 'String'
      });
    });
  });

  describe('MonitoringStack', () => {
    test('creates CloudWatch dashboard', () => {
      const mockRules = {
        buttonPress: {} as any,
        deviceStatus: {} as any,
      };

      const stack = new MonitoringStack(app, 'TestMonitoringStack', {
        env,
        environment,
        thingTypeName: `AcornPupsDevice-${environment}`,
        iotRules: mockRules,
        logLevel: 'DEBUG',
        enableDetailedMonitoring: true,
        certificateExpirationDays: 365,
        ruleErrorDestination: 'cloudwatch',
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
        DashboardName: `AcornPupsIoT-${environment}`
      });
    });

    test('creates CloudWatch alarms', () => {
      const mockRules = {
        buttonPress: {} as any,
        deviceStatus: {} as any,
      };

      const stack = new MonitoringStack(app, 'TestMonitoringStack', {
        env,
        environment,
        thingTypeName: `AcornPupsDevice-${environment}`,
        iotRules: mockRules,
        logLevel: 'DEBUG',
        enableDetailedMonitoring: true,
        certificateExpirationDays: 365,
        ruleErrorDestination: 'cloudwatch',
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: `AcornPupsIoT-HighErrorRate-${environment}`
      });

      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: `AcornPupsIoT-DeviceConnectivity-${environment}`
      });
    });
  });
}); 