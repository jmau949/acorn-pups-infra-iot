import * as cdk from 'aws-cdk-lib';
import * as iot from 'aws-cdk-lib/aws-iot';
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

    // ============================================================================
    // ⚡ ACTUAL IOT RULES - USED BY SYSTEM AT RUNTIME
    // ============================================================================

    // 🔄 USED BY: ESP32 devices publishing button press events
    // Real-time flow: ESP32 → MQTT → This Rule → handleButtonPress Lambda → Push Notifications
    this.rules.buttonPress = new iot.CfnTopicRule(this, 'ButtonPressRule', {
      ruleName: `AcornPupsButtonPress_${props.environment}`,
      topicRulePayload: {
        sql: "SELECT *, topic(3) as deviceId, timestamp() as receivedAt FROM 'acorn-pups/button-press/+'",
        description: 'Route RF button press events from ESP32 receivers to handleButtonPress Lambda function for real-time notifications',
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
          purpose: 'Process RF button press events and send push notifications',
          inputData: 'deviceId, buttonRfId, timestamp, batteryLevel',
          outputAction: 'Send push notifications to all authorized users',
          databaseAccess: 'DeviceUsers table (read), Users table (read)',
          lambdaRole: 'notificationRole',
          roleArn: `/acorn-pups/${props.environment}/lambda-functions/notification-role/arn`,
          mqttTrigger: 'acorn-pups/button-press/+',
          permissions: ['SNS publish', 'DynamoDB read', 'Parameter Store read']
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
          mqttPublish: 'acorn-pups/settings/{deviceId}',
          permissions: ['IoT publish', 'DynamoDB read/write', 'Parameter Store read']
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
            publishToMqtt: 'acorn-pups/settings/{deviceId}',
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
          }
        },
        deviceToCloudFlow: {
          'RF button press': {
            devicePublish: 'acorn-pups/button-press/{deviceId}',
            iotRule: 'buttonPress',
            lambdaFunction: 'handle-button-press',
            lambdaRole: 'notificationRole',
            roleArn: `/acorn-pups/${props.environment}/lambda-functions/notification-role/arn`,
            flow: 'Device -> MQTT -> IoT Rule -> Lambda (Notification Role) -> SNS -> Mobile App',
            permissions: 'SNS publish, DynamoDB read (user lookup)'
          },
          'Device status response': {
            cloudRequest: 'acorn-pups/status-request/{deviceId}', // NEW: Cloud requests status
            deviceResponse: 'acorn-pups/status-response/{deviceId}', // NEW: Device responds with status
            lambdaFunction: 'update-device-status',
            lambdaRole: 'baseLambdaRole',
            roleArn: `/acorn-pups/${props.environment}/lambda-functions/base-role/arn`,
            flow: 'Cloud -> MQTT Request -> Device -> MQTT Response -> Lambda (Base Role) -> DynamoDB',
            permissions: 'DynamoDB read/write only'
          }
        },
        statusPullModel: {
          description: 'Status is now pulled by cloud rather than pushed by devices',
          cloudInitiates: 'Cloud publishes to acorn-pups/status-request/{deviceId}',
          deviceResponds: 'Device publishes to acorn-pups/status-response/{deviceId}',
          benefits: 'Reduced device power consumption, controlled status polling, better network efficiency'
        }
      }),
      'Complete integration mapping between API endpoints, IoT rules, Lambda functions, and roles',
      `/acorn-pups/${props.environment}/iot-core/api-rule-integration`
    );
  }
} 