import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { IotThingTypeStack } from '../lib/iot-thing-type-stack';
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
    test('creates AcornPupsReceiver Thing Type', () => {
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
        ThingTypeName: `AcornPupsReceiver-${environment}`,
        ThingTypeProperties: {
          Description: 'IoT Thing Type for Acorn Pups ESP32-based receiver devices',
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

    test('creates IoT endpoint parameters', () => {
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
        Name: `/acorn-pups/${environment}/iot-core/endpoint`,
        Type: 'String'
      });

      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: `/acorn-pups/${environment}/iot-core/data-endpoint`,
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
        thingTypeName: `AcornPupsReceiver-${environment}`,
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
        thingTypeName: `AcornPupsReceiver-${environment}`,
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