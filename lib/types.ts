import { StackProps } from 'aws-cdk-lib';
import * as iot from 'aws-cdk-lib/aws-iot';
import * as iam from 'aws-cdk-lib/aws-iam';

// EXPO NOTIFICATIONS IMPLEMENTATION
// This file has been updated to support Expo Push Notifications with multi-device support
// Key additions: UserEndpointsTableItem interface, registerPushToken Lambda function,
// and userEndpoints table reference for the notification system

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

export interface IotRulesStackProps extends BaseIotStackProps {}

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

// API-specific types based on OpenAPI specification
export interface DeviceRegistrationRequest {
  deviceId: string;
  deviceInstanceId: string; // NEW: UUID generated each factory reset cycle
  deviceName: string;
  serialNumber: string;
  macAddress: string;
  deviceState?: string; // NEW: "factory_reset" or "normal"
  resetTimestamp?: number; // NEW: When reset occurred
}

export interface DeviceRegistrationResponse {
  deviceId: string;
  deviceName: string;
  serialNumber: string;
  ownerId: string;
  registeredAt: string;
  status: 'pending' | 'active';
  certificates: {
    deviceCertificate: string;
    privateKey: string;
    iotEndpoint: string;
  };
}

export interface DeviceSettingsRequest {
  soundEnabled?: boolean;
  soundVolume?: number;
  ledBrightness?: number;
  notificationCooldown?: number;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

export interface UserInviteRequest {
  email: string;
  notificationsPermission?: boolean;
  settingsPermission?: boolean;
}

export interface UserInviteResponse {
  invitationId: string;
  email: string;
  deviceId: string;
  deviceName: string;
  notificationsPermission: boolean;
  settingsPermission: boolean;
  expiresAt: string;
  sentAt: string;
}

export interface DeviceAttributes {
  deviceId: string;
  deviceInstanceId: string; // NEW: Reset security tracking
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
  lastResetAt?: string; // NEW: Last factory reset timestamp
  ownerId: string;
  registeredAt: string;
  status: 'pending' | 'active' | 'inactive';
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

export interface DevicePermissions {
  notifications: boolean;
  settings: boolean;
}

export interface Device {
  deviceId: string;
  deviceName: string;
  serialNumber: string;
  isOnline: boolean;
  lastSeen: string;
  registeredAt: string;
  firmwareVersion: string;
  settings: DeviceSettings;
  permissions: DevicePermissions;
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

export interface VolumeControlEvent {
  deviceId: string;
  clientId: string;
  action: 'volume_up' | 'volume_down';
  newVolume: number;
  previousVolume: number;
  timestamp: string;
}

export interface IotTopicTemplates {
  buttonPress: string;
  volumeControl: string; // NEW: Volume control events from device
  statusRequest: string; // NEW: Cloud requests device status
  statusResponse: string; // NEW: Device responds with status
  settings: string;
  commands: string;
  // REMOVED: commandsReset, firmware - simplified topic structure
}

export const IOT_TOPIC_TEMPLATES: IotTopicTemplates = {
  buttonPress: 'acorn-pups/button-press/+',
  volumeControl: 'acorn-pups/volume-control/+', // NEW: Volume control events from device
  statusRequest: 'acorn-pups/status-request/+', // NEW: Cloud requests device status
  statusResponse: 'acorn-pups/status-response/+', // NEW: Device responds with status
  settings: 'acorn-pups/settings/+',
  commands: 'acorn-pups/commands/+',
  // REMOVED: Reset-related topics - now handled via HTTP API only
};

export const IOT_CLIENT_ID_PATTERN = 'acorn-receiver-*';

export const LAMBDA_FUNCTIONS = {
  // Button and device management
  handleButtonPress: 'handleButtonPress',
  handleVolumeControl: 'handleVolumeControl',
  updateDeviceStatus: 'updateDeviceStatus',
  registerDevice: 'registerDevice',
  updateDeviceSettings: 'updateDeviceSettings',
  
  // Push notification management
  registerPushToken: 'registerPushToken',
  
  // User management and invitations
  cognitoPostConfirmation: 'cognitoPostConfirmation', // NEW: Auto-create user after email verification
  inviteUser: 'inviteUser',
  acceptInvitation: 'acceptInvitation',
  declineInvitation: 'declineInvitation',
  removeUserAccess: 'removeUserAccess',
  
  // Data retrieval
  getUserDevices: 'getUserDevices',
  getUserInvitations: 'getUserInvitations',
  healthCheck: 'healthCheck',
  
  // REMOVED: resetDevice, factoryReset - now handled via HTTP registration API only
};

export const DYNAMODB_TABLES = {
  users: 'Users',
  devices: 'Devices',
  deviceUsers: 'DeviceUsers',
  invitations: 'Invitations',
  deviceStatus: 'DeviceStatus',
  userEndpoints: 'UserEndpoints',
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

// API Response types
export interface ApiResponse<T> {
  data: T;
  requestId: string;
}

export interface ApiError {
  error: string;
  message: string;
  requestId: string;
  validationErrors?: Array<{
    field: string;
    message: string;
  }>;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  environment: string;
  version: string;
  region: string;
  checks: {
    api: boolean;
    lambda: boolean;
    dynamodb: boolean;
  };
}

// MQTT message types
export interface MqttButtonPressMessage {
  deviceId: string;
  buttonRfId: string;
  timestamp: string;
  batteryLevel?: number;
}

export interface MqttDeviceStatusMessage {
  deviceId: string;
  statusType: string;
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

export interface MqttDeviceSettingsMessage {
  soundEnabled: boolean;
  soundVolume: number;
  ledBrightness: number;
  notificationCooldown: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export interface MqttVolumeControlMessage {
  deviceId: string;
  clientId: string;
  action: 'volume_up' | 'volume_down';
  newVolume: number;
  previousVolume: number;
  timestamp: string;
}

export interface MqttDeviceResetMessage {
  deviceId: string;
  reason: string;
  timestamp: string;
}

// IoT Core certificate management
export interface CertificateInfo {
  certificateArn: string;
  certificateId: string;
  certificatePem: string;
  keyPair: {
    publicKey: string;
    privateKey: string;
  };
  iotEndpoint: string;
}

// Database table schemas (based on technical documentation)
export interface UsersTableItem {
  PK: string; // USER#{user_id}
  SK: string; // PROFILE
  user_id: string; // Cognito Sub UUID used directly as user identifier
  email: string;
  full_name: string;
  phone?: string;
  timezone: string;
  created_at: string;
  updated_at: string;
  last_login?: string;
  is_active: boolean;
  push_notifications: boolean;
  preferred_language: string;
  sound_alerts: boolean;
  vibration_alerts: boolean;
}

export interface DevicesTableItem {
  PK: string; // DEVICE#{device_id}
  SK: string; // METADATA | SETTINGS
  device_id: string;
  device_instance_id: string; // NEW: UUID generated each factory reset cycle
  serial_number: string;
  mac_address: string;
  device_name: string;
  owner_user_id: string;
  firmware_version: string;
  hardware_version: string;
  is_online: boolean;
  last_seen: string;
  wifi_ssid: string;
  signal_strength: number;
  created_at: string;
  updated_at: string;
  last_reset_at?: string; // NEW: Last factory reset timestamp
  is_active: boolean;
  // Settings fields
  sound_enabled: boolean;
  sound_volume: number;
  led_brightness: number;
  notification_cooldown: number;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

export interface DeviceUsersTableItem {
  PK: string; // DEVICE#{device_id}
  SK: string; // USER#{user_id}
  device_id: string;
  user_id: string;
  notifications_permission: boolean;
  settings_permission: boolean;
  notifications_enabled: boolean;
  notification_sound: string;
  notification_vibration: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  custom_notification_sound?: string;
  device_nickname?: string;
  invited_by: string;
  invited_at: string;
  accepted_at: string;
  is_active: boolean;
}

export interface InvitationsTableItem {
  PK: string; // INVITATION#{invitation_id}
  SK: string; // METADATA
  invitation_id: string;
  device_id: string;
  invited_email: string;
  invited_by: string;
  invitation_token: string;
  expires_at: string;
  created_at: string;
  accepted_at?: string;
  is_accepted: boolean;
  is_expired: boolean;
}

export interface DeviceStatusTableItem {
  PK: string; // DEVICE#{device_id}
  SK: string; // STATUS#{status_type}
  device_id: string;
  status_type: string;
  timestamp: string;
  signal_strength?: number;
  is_online: boolean;
  memory_usage?: number;
  cpu_temperature?: number;
  uptime?: number;
  error_count?: number;
  last_error_message?: string;
  firmware_version?: string;
}

export interface UserEndpointsTableItem {
  PK: string; // USER#{user_id}
  SK: string; // ENDPOINT#{device_fingerprint}
  user_id: string;
  expo_push_token: string;
  device_fingerprint: string;
  platform: 'ios' | 'android';
  device_info: string;
  is_active: boolean;
  created_at: string;
  last_used: string;
} 