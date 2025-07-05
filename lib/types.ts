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
  deviceId: string;
  serialNumber: string;
  macAddress: string;
  deviceName: string;
  firmwareVersion: string;
  hardwareVersion: string;
  wifiSsid: string;
  signalStrength: number;
  deviceType: 'ESP32_RECEIVER';
  isOnline: boolean;
  lastSeen: string;
}

export interface DeviceSettings {
  soundEnabled: boolean;
  soundVolume: number;
  ledBrightness: number;
  notificationCooldown: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export interface ButtonPressEvent {
  deviceId: string;
  buttonRfId: string;
  timestamp: string;
  batteryLevel?: number;
  signalStrength?: number;
}

export interface DeviceStatusEvent {
  deviceId: string;
  statusType: 'CURRENT' | 'HEALTH' | 'CONNECTIVITY';
  timestamp: string;
  isOnline: boolean;
  signalStrength?: number;
  memoryUsage?: number;
  cpuTemperature?: number;
  uptime?: number;
  errorCount?: number;
  lastErrorMessage?: string;
  firmwareVersion?: string;
}

export interface IotTopicTemplates {
  buttonPress: string;
  status: string;
  settings: string;
  commands: string;
  commandsReset: string;
}

export const IOT_TOPIC_TEMPLATES: IotTopicTemplates = {
  buttonPress: 'acorn-pups/button-press/+',
  status: 'acorn-pups/status/+',
  settings: 'acorn-pups/settings/+',
  commands: 'acorn-pups/commands/+',
  commandsReset: 'acorn-pups/commands/+/reset',
};

export const IOT_CLIENT_ID_PATTERN = 'acorn-receiver-*';

export const LAMBDA_FUNCTIONS = {
  handleButtonPress: 'handleButtonPress',
  updateDeviceStatus: 'updateDeviceStatus',
  resetDevice: 'resetDevice',
};

export const DYNAMODB_TABLES = {
  users: 'Users',
  devices: 'Devices',
  deviceUsers: 'DeviceUsers',
  invitations: 'Invitations',
  deviceStatus: 'DeviceStatus',
};

export interface DeviceCertificateConfig {
  type: 'AWS_MANAGED';
  autoActivate: boolean;
  attachPolicy: boolean;
  policyName: string;
  thingTypeName: string;
  validityPeriod: number;
  certificateStatus: 'ACTIVE' | 'INACTIVE';
} 