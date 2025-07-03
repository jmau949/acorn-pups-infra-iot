import { StackProps } from 'aws-cdk-lib';
import * as iot from 'aws-cdk-lib/aws-iot';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface BaseIotStackProps extends StackProps {
  environment: string;
  logLevel: string;
  enableDetailedMonitoring: boolean;
  certificateExpirationDays: number;
  ruleErrorDestination: string;
}

export interface IotThingTypeStackProps extends BaseIotStackProps {}

export interface IotPolicyStackProps extends BaseIotStackProps {
  thingTypeName: string;
}

export interface IotRulesStackProps extends BaseIotStackProps {
  roleArn: string;
}

export interface CertificateManagementStackProps extends BaseIotStackProps {}

export interface MonitoringStackProps extends BaseIotStackProps {
  thingTypeName: string;
  iotRules: { [key: string]: iot.CfnTopicRule };
}

export interface IotDevicePolicy {
  policyName: string;
  policyDocument: any;
}

export interface IotRule {
  ruleName: string;
  description: string;
  sql: string;
  actions: any[];
  errorAction?: any;
}

export interface DeviceAttributes {
  deviceName: string;
  firmwareVersion: string;
  macAddress: string;
  deviceType: string;
  location?: string;
}

export interface DeviceSettings {
  volume: number;
  ringerType: string;
  ringerDuration: number;
  cooldownPeriod: number;
  ledBrightness: number;
  autoSleep: boolean;
  sleepTimeout: number;
  customSoundUrl?: string;
}

export interface IotTopicTemplates {
  buttonPress: string;
  status: string;
  settings: string;
  commands: string;
}

export const IOT_TOPIC_TEMPLATES: IotTopicTemplates = {
  buttonPress: 'acorn-pups/button-press/+',
  status: 'acorn-pups/status/+',
  settings: 'acorn-pups/settings/+',
  commands: 'acorn-pups/commands/+',
};

export const IOT_CLIENT_ID_PATTERN = 'acorn-esp32-*'; 