import * as cdk from 'aws-cdk-lib';
import * as iot from 'aws-cdk-lib/aws-iot';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { IotRulesStackProps } from './types';
import { ParameterStoreHelper } from './parameter-store-helper';

export class IotRulesStack extends cdk.Stack {
  public readonly rules: { [key: string]: iot.CfnTopicRule };
  private parameterHelper: ParameterStoreHelper;

  constructor(scope: Construct, id: string, props: IotRulesStackProps) {
    super(scope, id, props);

    this.rules = {};

    // Initialize parameter store helper
    this.parameterHelper = new ParameterStoreHelper(this, {
      environment: props.environment,
      stackName: 'rules',
    });

    // ============================================================================
    // 📊 CLOUDWATCH LOG GROUPS - USED BY IOT RULES FOR ERROR LOGGING
    // ============================================================================

    // Create CloudWatch log group for button press rule error logging
    const buttonPressLogGroup = new logs.LogGroup(this, 'ButtonPressRuleLogGroup', {
      logGroupName: `/aws/iot/rules/AcornPupsButtonPress_${props.environment}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create CloudWatch log group for device lifecycle rule error logging
    const deviceLifecycleLogGroup = new logs.LogGroup(this, 'DeviceLifecycleRuleLogGroup', {
      logGroupName: `/aws/iot/rules/AcornPupsDeviceLifecycle_${props.environment}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ============================================================================
    // 🔧 LAMBDA FUNCTION ARNS - USED BY IOT RULES
    // ============================================================================

    // Read Lambda function ARNs from Parameter Store
    // 🔄 USED BY: ButtonPressRule to route button events
    const handleButtonPressLambdaArnParam = ssm.StringParameter.fromStringParameterName(
      this,
      'HandleButtonPressLambdaArnParam',
      `/acorn-pups/${props.environment}/lambda-functions/handleButtonPress/arn`
    );

    // 🔄 USED BY: DeviceStatusRule to route status updates
    const updateDeviceStatusLambdaArnParam = ssm.StringParameter.fromStringParameterName(
      this,
      'UpdateDeviceStatusLambdaArnParam', 
      `/acorn-pups/${props.environment}/lambda-functions/updateDeviceStatus/arn`
    );

    // 🔄 USED BY: Settings update flow (API publishes to MQTT)
    const updateDeviceSettingsLambdaArnParam = ssm.StringParameter.fromStringParameterName(
      this,
      'UpdateDeviceSettingsLambdaArnParam',
      `/acorn-pups/${props.environment}/lambda-functions/updateDeviceSettings/arn`
    );

    // 🔄 USED BY: All IoT rules for error logging
    const iotRuleExecutionRoleArnParam = ssm.StringParameter.fromStringParameterName(
      this,
      'IoTRuleExecutionRoleArnParam',
      `/acorn-pups/${props.environment}/iot-core/rule-execution-role/arn`
    );

    // 🔄 USED BY: DeviceLifecycleRule to update device online/offline status
    const handleDeviceLifecycleLambdaArnParam = ssm.StringParameter.fromStringParameterName(
      this,
      'HandleDeviceLifecycleLambdaArnParam',
      `/acorn-pups/${props.environment}/lambda-functions/handleDeviceLifecycle/arn`
    );

    // 🔄 USED BY: VolumeControlRule to process volume control events
    const handleVolumeControlLambdaArnParam = ssm.StringParameter.fromStringParameterName(
      this,
      'HandleVolumeControlLambdaArnParam',
      `/acorn-pups/${props.environment}/lambda-functions/handleVolumeControl/arn`
    );

    // ============================================================================
    // ⚡ ACTUAL IOT RULES - USED BY SYSTEM AT RUNTIME
    // ============================================================================

    // 🔄 USED BY: ESP32 devices publishing button press events
    // Real-time flow: ESP32 → MQTT → This Rule → handleButtonPress Lambda → Expo Push API → All User Devices
    // Multi-device support: Each authorized user receives notifications on ALL registered devices (2-4 devices per user)
    this.rules.buttonPress = new iot.CfnTopicRule(this, 'ButtonPressRule', {
      ruleName: `AcornPupsButtonPress_${props.environment}`,
      topicRulePayload: {
        sql: "SELECT *, topic(3) as clientId, substring(topic(3), 16) as deviceId, timestamp() as receivedAt FROM 'acorn-pups/button-press/+'",
        description: 'Route RF button press events to handleButtonPress Lambda for multi-device Expo push notifications with automatic token cleanup',
        actions: [
          {
            lambda: {
              functionArn: handleButtonPressLambdaArnParam.stringValue
            }
          }
        ],
        errorAction: {
          cloudwatchLogs: {
            logGroupName: `/aws/iot/rules/AcornPupsButtonPress_${props.environment}`,
            roleArn: iotRuleExecutionRoleArnParam.stringValue
          }
        },
        ruleDisabled: false
      },
      tags: [
        {
          key: 'Project',
          value: 'acorn-pups'
        },
        {
          key: 'Environment',
          value: props.environment
        },
        {
          key: 'Service',
          value: 'IoT-Core'
        },
        {
          key: 'Component',
          value: 'Rule'
        },
        {
          key: 'RuleType',
          value: 'ButtonPress'
        }
      ]
    });

    // 🔄 USED BY: AWS IoT Core to track device connect/disconnect events
    // Real-time flow: Device connects/disconnects → This Rule → handleDeviceLifecycle Lambda → Update DynamoDB
    this.rules.deviceLifecycle = new iot.CfnTopicRule(this, 'DeviceLifecycleRule', {
      ruleName: `AcornPupsDeviceLifecycle_${props.environment}`,
      topicRulePayload: {
        sql: `SELECT 
          clientId, 
          substring(clientId, 15) as deviceId,
          eventType,
          timestamp() as timestamp,
          principal as certificateArn,
          sessionIdentifier,
          versionNumber
        FROM '$aws/events/presence/+/+'
        WHERE startswith(clientId, 'acorn-receiver-')`,
        description: 'Capture device lifecycle events (connect/disconnect) for ESP32 receivers and update device online status in DynamoDB',
        actions: [
          {
            lambda: {
              functionArn: handleDeviceLifecycleLambdaArnParam.stringValue
            }
          }
        ],
        errorAction: {
          cloudwatchLogs: {
            logGroupName: `/aws/iot/rules/AcornPupsDeviceLifecycle_${props.environment}`,
            roleArn: iotRuleExecutionRoleArnParam.stringValue
          }
        },
        ruleDisabled: false
      },
      tags: [
        {
          key: 'Project',
          value: 'acorn-pups'
        },
        {
          key: 'Environment',
          value: props.environment
        },
        {
          key: 'Service',
          value: 'IoT-Core'
        },
        {
          key: 'Component',
          value: 'Rule'
        },
        {
          key: 'RuleType',
          value: 'DeviceLifecycle'
        }
      ]
    });

    // 🔄 USED BY: ESP32 devices publishing volume control events
    // Real-time flow: ESP32 → MQTT → This Rule → handleVolumeControl Lambda → Update DynamoDB Settings
    this.rules.volumeControl = new iot.CfnTopicRule(this, 'VolumeControlRule', {
      ruleName: `AcornPupsVolumeControl_${props.environment}`,
      topicRulePayload: {
        sql: "SELECT *, topic(3) as clientId, substring(topic(3), 15) as deviceId, timestamp() as receivedAt FROM 'acorn-pups/volume-control/+'",
        description: 'Route volume control events from ESP32 receivers to handleVolumeControl Lambda function to update device settings',
        actions: [
          {
            lambda: {
              functionArn: handleVolumeControlLambdaArnParam.stringValue
            }
          }
        ],
        ruleDisabled: false
      },
      tags: [
        {
          key: 'Project',
          value: 'acorn-pups'
        },
        {
          key: 'Environment',
          value: props.environment
        },
        {
          key: 'Service',
          value: 'IoT-Core'
        },
        {
          key: 'Component',
          value: 'Rule'
        },
        {
          key: 'RuleType',
          value: 'VolumeControl'
        }
      ]
    });

    // REMOVED: Device Status Rule - status is now pulled by cloud rather than pushed by devices
    // REMOVED: Device Reset Rule - reset handling now via HTTP registration API only
    // REMOVED: Device Settings Acknowledgment Rule - simplified settings flow
    // REMOVED: Factory Reset Rule - all reset handling now via HTTP registration API

    // ============================================================================
    // 🔧 RULE METADATA - USED FOR CROSS-STACK INTEGRATION
    // ============================================================================

    // Store rule information in Parameter Store
    Object.entries(this.rules).forEach(([name, rule]) => {
      // 🔄 USED BY: Monitoring stack to reference rule ARNs
      this.parameterHelper.createParameter(
        `${name}RuleArnParam`,
        rule.attrArn,
        `ARN of the ${name} IoT Rule`,
        `/acorn-pups/${props.environment}/iot-core/rules/${name}/arn`
      );

      // 🔄 USED BY: Other infrastructure components that need rule names
      this.parameterHelper.createParameter(
        `${name}RuleNameParam`,
        rule.ruleName!,
        `Name of the ${name} IoT Rule`,
        `/acorn-pups/${props.environment}/iot-core/rules/${name}/name`
      );
    });

    // Store CloudWatch log group information in Parameter Store
    this.parameterHelper.createParameter(
      'ButtonPressLogGroupArnParam',
      buttonPressLogGroup.logGroupArn,
      'ARN of the Button Press IoT Rule CloudWatch log group',
      `/acorn-pups/${props.environment}/iot-core/log-groups/button-press/arn`
    );

    // Store UserEndpoints table reference for notification system
    this.parameterHelper.createParameter(
      'UserEndpointsTableParam',
      'UserEndpoints',
      'Name of the UserEndpoints DynamoDB table for push notification tokens',
      `/acorn-pups/${props.environment}/dynamodb/tables/user-endpoints/name`
    );

    // Store Expo Push API configuration
    this.parameterHelper.createParameter(
      'ExpoPushApiEndpointParam',
      'https://exp.host/--/api/v2/push/send',
      'Expo Push API endpoint for sending notifications',
      `/acorn-pups/${props.environment}/expo/push-api/endpoint`
    );

    this.parameterHelper.createParameter(
      'DeviceLifecycleLogGroupArnParam',
      deviceLifecycleLogGroup.logGroupArn,
      'ARN of the Device Lifecycle IoT Rule CloudWatch log group',
      `/acorn-pups/${props.environment}/iot-core/log-groups/device-lifecycle/arn`
    );

    // ============================================================================
    // 🔧 CLOUDFORMATION OUTPUTS - USED FOR CROSS-STACK INTEGRATION
    // ============================================================================

    // Create CloudFormation outputs with Parameter Store integration
    this.parameterHelper.createOutputWithParameter(
      'ButtonPressRuleArnOutput',
      this.rules.buttonPress.attrArn,
      'ARN of the Button Press IoT Rule',
      `AcornPupsButtonPressRuleArn-${props.environment}`
    );

    this.parameterHelper.createOutputWithParameter(
      'DeviceLifecycleRuleArnOutput',
      this.rules.deviceLifecycle.attrArn,
      'ARN of the Device Lifecycle IoT Rule',
      `AcornPupsDeviceLifecycleRuleArn-${props.environment}`
    );

    this.parameterHelper.createOutputWithParameter(
      'VolumeControlRuleArnOutput',
      this.rules.volumeControl.attrArn,
      'ARN of the Volume Control IoT Rule',
      `AcornPupsVolumeControlRuleArn-${props.environment}`
    );

    // Create CloudFormation outputs for log groups
    new cdk.CfnOutput(this, 'ButtonPressLogGroupArn', {
      value: buttonPressLogGroup.logGroupArn,
      description: 'ARN of the Button Press IoT Rule CloudWatch log group',
      exportName: `acorn-pups-${props.environment}-button-press-log-group-arn`,
    });

    new cdk.CfnOutput(this, 'DeviceLifecycleLogGroupArn', {
      value: deviceLifecycleLogGroup.logGroupArn,
      description: 'ARN of the Device Lifecycle IoT Rule CloudWatch log group',
      exportName: `acorn-pups-${props.environment}-device-lifecycle-log-group-arn`,
    });

    // REMOVED: DeviceStatusRuleArnOutput - status rule no longer exists (pull model)

    // ============================================================================
    // 📖 DOCUMENTATION ONLY - NOT USED BY SYSTEM
    // ============================================================================

    // 📋 DOCUMENTATION: Rule configuration details (NOT used at runtime)
    this.parameterHelper.createParameter(
      'RuleConfigurationParam',
      JSON.stringify({
        buttonPress: {
          topic: 'acorn-pups/button-press/+',
          description: 'Real-time processing of RF button press events - no persistent storage',
          lambdaFunction: 'handleButtonPress',
          processing: 'REAL_TIME'
        },
        volumeControl: {
          topic: 'acorn-pups/volume-control/+',
          description: 'Process volume control events and update device settings in DynamoDB',
          lambdaFunction: 'handleVolumeControl',
          processing: 'PERSISTENT'
        },
        deviceStatus: {
          topic: 'acorn-pups/status/+',
          description: 'Process device status updates and store in DeviceStatus table',
          lambdaFunction: 'updateDeviceStatus',
          processing: 'PERSISTENT'
        }
      }),
      'IoT Rule configuration details',
      `/acorn-pups/${props.environment}/iot-core/rule-configuration`
    );

    // 📋 DOCUMENTATION: Lambda function requirements (NOT used at runtime)
    this.parameterHelper.createParameter(
      'LambdaFunctionRequirementsParam',
      JSON.stringify({
        handleButtonPress: {
          purpose: 'Process RF button press events and send push notifications to all user devices',
          inputData: 'deviceId, clientId, buttonRfId, timestamp, batteryLevel',
          outputAction: 'Query UserEndpoints for all authorized users and send Expo push notifications',
          databaseAccess: 'DeviceUsers table (read), Users table (read), UserEndpoints table (read/write)',
          lambdaRole: 'notificationRole',
          roleArn: `/acorn-pups/${props.environment}/lambda-functions/notification-role/arn`,
          mqttTrigger: 'acorn-pups/button-press/+',
          permissions: ['HTTP requests to Expo Push API', 'DynamoDB read/write', 'Parameter Store read'],
          notificationFlow: 'Query DeviceUsers -> Get UserEndpoints -> Send to Expo -> Process receipts -> Update token status'
        },
        handleVolumeControl: {
          purpose: 'Process volume control events and update device settings in DynamoDB',
          inputData: 'deviceId, clientId, action, newVolume, previousVolume, timestamp',
          outputAction: 'Update device settings with new volume level',
          databaseAccess: 'Devices table (update settings)',
          lambdaRole: 'baseLambdaRole',
          roleArn: `/acorn-pups/${props.environment}/lambda-functions/base-role/arn`,
          mqttTrigger: 'acorn-pups/volume-control/+',
          permissions: ['DynamoDB read/write', 'Parameter Store read']
        },
        updateDeviceStatus: {
          purpose: 'Process status requests from cloud and update device status',
          inputData: 'deviceId, statusType, timestamp, deviceMetrics',
          outputAction: 'Update device status in DynamoDB',
          databaseAccess: 'DeviceStatus table (write), Devices table (update)',
          lambdaRole: 'baseLambdaRole',
          roleArn: `/acorn-pups/${props.environment}/lambda-functions/base-role/arn`,
          mqttTrigger: 'acorn-pups/status-request/+', // NEW: Status requests from cloud
          permissions: ['DynamoDB read/write', 'Parameter Store read']
        },
        updateDeviceSettings: {
          purpose: 'Process settings updates from API and publish to device MQTT topic',
          inputData: 'deviceId, settings, timestamp',
          outputAction: 'Update database and publish to device MQTT topic',
          databaseAccess: 'Devices table (update), publish to MQTT',
          lambdaRole: 'iotCommunicationRole',
          roleArn: `/acorn-pups/${props.environment}/lambda-functions/iot-comm-role/arn`,
          apiTrigger: 'PUT /devices/{deviceId}/settings',
          mqttPublish: 'acorn-pups/settings/{clientId}',
          permissions: ['IoT publish', 'DynamoDB read/write', 'Parameter Store read']
        },
        registerPushToken: {
          purpose: 'Register or update Expo push tokens for multi-device notification support',
          inputData: 'userId, expoPushToken, deviceFingerprint, platform, deviceInfo',
          outputAction: 'Create or update UserEndpoints table record with device token information',
          databaseAccess: 'UserEndpoints table (read/write)',
          lambdaRole: 'notificationRole',
          roleArn: `/acorn-pups/${props.environment}/lambda-functions/notification-role/arn`,
          apiTrigger: 'POST /users/{userId}/push-tokens',
          permissions: ['DynamoDB read/write', 'Parameter Store read'],
          tokenManagement: 'Minimal proactive strategy - check and update tokens on app launch only'
        }
      }),
      'Lambda function requirements and role mapping for IoT rules',
      `/acorn-pups/${props.environment}/iot-core/lambda-function-requirements`
    );

    // 📋 DOCUMENTATION: MQTT topics reference (NOT used at runtime)
    this.parameterHelper.createParameter(
      'RuleTopicsParam',
      JSON.stringify({
        buttonPress: 'acorn-pups/button-press/+',
        volumeControl: 'acorn-pups/volume-control/+', // NEW: Volume control events from device
        statusRequest: 'acorn-pups/status-request/+', // NEW: Cloud requests device status
        deviceSettings: 'acorn-pups/settings/+' // Note: Published TO devices, not FROM devices
      }),
      'MQTT topics monitored by IoT Rules and published to devices',
      `/acorn-pups/${props.environment}/iot-core/rule-topics`
    );
    // 📋 DOCUMENTATION: CloudWatch log prefix (NOT used at runtime)
    this.parameterHelper.createParameter(
      'LogGroupPrefixParam',
      `/aws/iot/rules/AcornPups`,
      'CloudWatch Log Group prefix for IoT Rules',
      `/acorn-pups/${props.environment}/iot-core/log-group-prefix`
    );

    // 📋 DOCUMENTATION: Complete integration mapping (NOT used at runtime)
    this.parameterHelper.createParameter(
      'ApiRuleIntegrationParam',
      JSON.stringify({
        description: 'Complete integration mapping between API endpoints, IoT rules, Lambda functions, and roles with device instance ID security',
        deviceInstanceIdSecurity: {
          resetDetection: 'Compare device_instance_id to detect factory resets',
          ownershipTransfer: 'Automatic cleanup when reset is proven via new instance ID',
          physicalAccessRequired: 'Only physical reset button can generate new instance ID',
          httpBasedReset: 'All reset handling via HTTP registration API (no MQTT reset topics)'
        },
        apiToIoTFlow: {
          'PUT /devices/{deviceId}/settings': {
            apiFunction: 'update-device-settings',
            apiRole: 'iotCommunicationRole',
            roleArn: `/acorn-pups/${props.environment}/lambda-functions/iot-comm-role/arn`,
            publishToMqtt: 'acorn-pups/settings/{clientId}',
            flow: 'API -> Lambda (IoT Comm Role) -> MQTT -> Device applies settings',
            permissions: 'IoT publish, DynamoDB read/write'
          },
          'POST /devices/register': {
            apiFunction: 'register-device',
            apiRole: 'iotDeviceManagementRole',
            roleArn: `/acorn-pups/${props.environment}/lambda-functions/iot-device-mgmt-role/arn`,
            resetValidation: 'Compare device_instance_id to detect resets and handle ownership transfer',
            iotOperations: 'Certificate generation, Thing creation, Policy attachment',
            flow: 'API -> Lambda (IoT Device Mgmt Role) -> IoT certificate/thing creation -> Database',
            permissions: 'Full IoT management, certificate generation, DynamoDB read/write, S3 backup'
          },
          'POST /users/{userId}/push-tokens': {
            apiFunction: 'register-push-token',
            apiRole: 'notificationRole',
            roleArn: `/acorn-pups/${props.environment}/lambda-functions/notification-role/arn`,
            databaseOperations: 'UserEndpoints table create/update with device fingerprint logic',
            tokenManagement: 'Minimal proactive strategy - update only when token changes',
            flow: 'Mobile App -> API -> Lambda (Notification Role) -> UserEndpoints table update',
            permissions: 'DynamoDB read/write (UserEndpoints table), Parameter Store read'
          }
        },
        deviceToCloudFlow: {
          'RF button press': {
            devicePublish: 'acorn-pups/button-press/{clientId}',
            iotRule: 'buttonPress',
            lambdaFunction: 'handle-button-press',
            lambdaRole: 'notificationRole',
            roleArn: `/acorn-pups/${props.environment}/lambda-functions/notification-role/arn`,
            flow: 'Device -> MQTT -> IoT Rule -> Lambda (Notification Role) -> Expo Push API -> All User Devices',
            databaseFlow: 'Query DeviceUsers -> Get all UserEndpoints -> Send batch notifications -> Process receipts -> Update token status',
            permissions: 'HTTP requests to Expo Push API, DynamoDB read/write (DeviceUsers, Users, UserEndpoints)',
            multiDeviceSupport: 'Sends notifications to all registered devices per authorized user (2-4 devices per user average)'
          },
          'Volume control': {
            devicePublish: 'acorn-pups/volume-control/{clientId}',
            iotRule: 'volumeControl',
            lambdaFunction: 'handle-volume-control',
            lambdaRole: 'baseLambdaRole',
            roleArn: `/acorn-pups/${props.environment}/lambda-functions/base-role/arn`,
            flow: 'Device -> MQTT -> IoT Rule -> Lambda (Base Role) -> DynamoDB -> Update Settings',
            permissions: 'DynamoDB read/write (device settings update)'
          },
          'Device status response': {
            cloudRequest: 'acorn-pups/status-request/{clientId}', // NEW: Cloud requests status
            deviceResponse: 'acorn-pups/status-response/{clientId}', // NEW: Device responds with status
            lambdaFunction: 'update-device-status',
            lambdaRole: 'baseLambdaRole',
            roleArn: `/acorn-pups/${props.environment}/lambda-functions/base-role/arn`,
            flow: 'Cloud -> MQTT Request -> Device -> MQTT Response -> Lambda (Base Role) -> DynamoDB',
            permissions: 'DynamoDB read/write only'
          }
        },
        statusPullModel: {
          description: 'Status is now pulled by cloud rather than pushed by devices',
          cloudInitiates: 'Cloud publishes to acorn-pups/status-request/{clientId}',
          deviceResponds: 'Device publishes to acorn-pups/status-response/{clientId}',
          benefits: 'Reduced device power consumption, controlled status polling, better network efficiency'
        }
      }),
      'Complete integration mapping between API endpoints, IoT rules, Lambda functions, and roles',
      `/acorn-pups/${props.environment}/iot-core/api-rule-integration`
    );
  }
} 