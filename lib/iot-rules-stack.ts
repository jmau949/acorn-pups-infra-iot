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

    // Read Lambda function ARNs from Parameter Store
    const handleButtonPressLambdaArnParam = ssm.StringParameter.fromStringParameterName(
      this,
      'HandleButtonPressLambdaArnParam',
      `/acorn-pups/${props.environment}/lambda-functions/handleButtonPress/arn`
    );

    const updateDeviceStatusLambdaArnParam = ssm.StringParameter.fromStringParameterName(
      this,
      'UpdateDeviceStatusLambdaArnParam', 
      `/acorn-pups/${props.environment}/lambda-functions/updateDeviceStatus/arn`
    );

    const resetDeviceLambdaArnParam = ssm.StringParameter.fromStringParameterName(
      this,
      'ResetDeviceLambdaArnParam',
      `/acorn-pups/${props.environment}/lambda-functions/resetDevice/arn`
    );

    const factoryResetLambdaArnParam = ssm.StringParameter.fromStringParameterName(
      this,
      'FactoryResetLambdaArnParam',
      `/acorn-pups/${props.environment}/lambda-functions/factoryReset/arn`
    );

    const updateDeviceSettingsLambdaArnParam = ssm.StringParameter.fromStringParameterName(
      this,
      'UpdateDeviceSettingsLambdaArnParam',
      `/acorn-pups/${props.environment}/lambda-functions/updateDeviceSettings/arn`
    );

    // Read IoT Rule Execution Role ARN from Parameter Store (created in API repository)
    const iotRuleExecutionRoleArnParam = ssm.StringParameter.fromStringParameterName(
      this,
      'IoTRuleExecutionRoleArnParam',
      `/acorn-pups/${props.environment}/iot-core/rule-execution-role/arn`
    );

    // Button Press Rule - Routes button press events from RF buttons to Lambda
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

    // Device Status Rule - Routes status updates from ESP32 receivers to Lambda
    this.rules.deviceStatus = new iot.CfnTopicRule(this, 'DeviceStatusRule', {
      ruleName: `AcornPupsDeviceStatus_${props.environment}`,
      topicRulePayload: {
        sql: "SELECT *, topic(3) as deviceId, timestamp() as receivedAt FROM 'acorn-pups/status/+'",
        description: 'Route device status updates from ESP32 receivers to updateDeviceStatus Lambda function',
        actions: [
          {
            lambda: {
              functionArn: updateDeviceStatusLambdaArnParam.stringValue
            }
          }
        ],
        errorAction: {
          cloudwatchLogs: {
            logGroupName: `/aws/iot/rules/AcornPupsDeviceStatus_${props.environment}`,
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
          value: 'DeviceStatus'
        }
      ]
    });

    // Device Reset Rule - Routes reset commands to Lambda
    this.rules.deviceReset = new iot.CfnTopicRule(this, 'DeviceResetRule', {
      ruleName: `AcornPupsDeviceReset_${props.environment}`,
      topicRulePayload: {
        sql: "SELECT *, topic(3) as deviceId, timestamp() as receivedAt FROM 'acorn-pups/commands/+/reset'",
        description: 'Route device reset commands to resetDevice Lambda function for ESP32 receiver factory reset',
        actions: [
          {
            lambda: {
              functionArn: resetDeviceLambdaArnParam.stringValue
            }
          }
        ],
        errorAction: {
          cloudwatchLogs: {
            logGroupName: `/aws/iot/rules/AcornPupsDeviceReset_${props.environment}`,
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
          value: 'DeviceReset'
        }
      ]
    });

    // Device Settings Acknowledgment Rule - Routes settings acknowledgments from ESP32 receivers to Lambda
    this.rules.deviceSettingsAck = new iot.CfnTopicRule(this, 'DeviceSettingsAckRule', {
      ruleName: `AcornPupsDeviceSettingsAck_${props.environment}`,
      topicRulePayload: {
        sql: "SELECT *, topic(3) as deviceId, timestamp() as receivedAt FROM 'acorn-pups/settings/+/ack'",
        description: 'Route settings acknowledgments from ESP32 receivers to updateDeviceSettings Lambda function',
        actions: [
          {
            lambda: {
              functionArn: updateDeviceSettingsLambdaArnParam.stringValue
            }
          }
        ],
        errorAction: {
          cloudwatchLogs: {
            logGroupName: `/aws/iot/rules/AcornPupsDeviceSettingsAck_${props.environment}`,
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
          value: 'DeviceSettingsAck'
        }
      ]
    });

    // Factory Reset Rule - Routes factory reset notifications from ESP32 receivers to Lambda
    this.rules.factoryReset = new iot.CfnTopicRule(this, 'FactoryResetRule', {
      ruleName: `AcornPupsFactoryReset_${props.environment}`,
      topicRulePayload: {
        sql: "SELECT *, topic(3) as deviceId, timestamp() as receivedAt FROM 'acorn-pups/reset/+'",
        description: 'Route factory reset notifications from ESP32 receivers to factoryReset Lambda function for cleanup',
        actions: [
          {
            lambda: {
              functionArn: factoryResetLambdaArnParam.stringValue
            }
          }
        ],
        errorAction: {
          cloudwatchLogs: {
            logGroupName: `/aws/iot/rules/AcornPupsFactoryReset_${props.environment}`,
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
          value: 'FactoryReset'
        }
      ]
    });

    // Store rule information in Parameter Store
    Object.entries(this.rules).forEach(([name, rule]) => {
      this.parameterHelper.createParameter(
        `${name}RuleArnParam`,
        rule.attrArn,
        `ARN of the ${name} IoT Rule`,
        `/acorn-pups/${props.environment}/iot-core/rules/${name}/arn`
      );

      this.parameterHelper.createParameter(
        `${name}RuleNameParam`,
        rule.ruleName!,
        `Name of the ${name} IoT Rule`,
        `/acorn-pups/${props.environment}/iot-core/rules/${name}/name`
      );
    });

    // Create CloudFormation outputs with Parameter Store integration
    this.parameterHelper.createOutputWithParameter(
      'ButtonPressRuleArnOutput',
      this.rules.buttonPress.attrArn,
      'ARN of the Button Press IoT Rule',
      `AcornPupsButtonPressRuleArn-${props.environment}`
    );

    this.parameterHelper.createOutputWithParameter(
      'DeviceStatusRuleArnOutput',
      this.rules.deviceStatus.attrArn,
      'ARN of the Device Status IoT Rule',
      `AcornPupsDeviceStatusRuleArn-${props.environment}`
    );

    this.parameterHelper.createOutputWithParameter(
      'DeviceResetRuleArnOutput',
      this.rules.deviceReset.attrArn,
      'ARN of the Device Reset IoT Rule',
      `AcornPupsDeviceResetRuleArn-${props.environment}`
    );

    this.parameterHelper.createOutputWithParameter(
      'DeviceSettingsAckRuleArnOutput',
      this.rules.deviceSettingsAck.attrArn,
      'ARN of the Device Settings Acknowledgment IoT Rule',
      `AcornPupsDeviceSettingsAckRuleArn-${props.environment}`
    );

    this.parameterHelper.createOutputWithParameter(
      'FactoryResetRuleArnOutput',
      this.rules.factoryReset.attrArn,
      'ARN of the Factory Reset IoT Rule',
      `AcornPupsFactoryResetRuleArn-${props.environment}`
    );

    // Additional rule configuration parameters
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
        },
        deviceReset: {
          topic: 'acorn-pups/commands/+/reset',
          description: 'Handle device factory reset commands',
          lambdaFunction: 'resetDevice',
          processing: 'COMMAND'
        },
        deviceSettingsAck: {
          topic: 'acorn-pups/settings/+/ack',
          description: 'Process settings acknowledgments from ESP32 receivers',
          lambdaFunction: 'updateDeviceSettings',
          processing: 'ACKNOWLEDGMENT'
        },
        factoryReset: {
          topic: 'acorn-pups/reset/+',
          description: 'Process factory reset notifications and cleanup AWS resources',
          lambdaFunction: 'factoryReset',
          processing: 'CLEANUP'
        }
      }),
      'IoT Rule configuration details',
      `/acorn-pups/${props.environment}/iot-core/rule-configuration`
    );

    // Lambda function requirements for IoT rules with role mapping
    this.parameterHelper.createParameter(
      'LambdaFunctionRequirementsParam',
      JSON.stringify({
        handleButtonPress: {
          purpose: 'Process RF button press events in real-time',
          inputData: 'deviceId, buttonRfId, timestamp, batteryLevel',
          outputAction: 'Send push notifications to all authorized users',
          databaseAccess: 'DeviceUsers table (read-only)',
          noStorage: 'No persistent storage of button events for MVP',
          lambdaRole: 'notificationRole',
          roleArn: `/acorn-pups/${props.environment}/lambda-functions/notification-role/arn`,
          iotRuleTrigger: 'acorn-pups/button-press/+',
          permissions: ['SNS publish', 'DynamoDB read', 'Parameter Store read']
        },
        updateDeviceStatus: {
          purpose: 'Process and store device status updates',
          inputData: 'deviceId, statusType, timestamp, device metrics',
          outputAction: 'Update DeviceStatus table',
          databaseAccess: 'DeviceStatus table (write), Devices table (update)',
          lambdaRole: 'baseLambdaRole',
          roleArn: `/acorn-pups/${props.environment}/lambda-functions/base-role/arn`,
          iotRuleTrigger: 'acorn-pups/status/+',
          permissions: ['DynamoDB read/write', 'Parameter Store read']
        },
        resetDevice: {
          purpose: 'Handle device factory reset commands',
          inputData: 'deviceId, resetReason, timestamp',
          outputAction: 'Clean up device data and certificates',
          databaseAccess: 'All device-related tables (cleanup)',
          lambdaRole: 'iotDeviceManagementRole',
          roleArn: `/acorn-pups/${props.environment}/lambda-functions/iot-device-mgmt-role/arn`,
          iotRuleTrigger: 'acorn-pups/commands/+/reset',
          permissions: ['Full IoT management', 'DynamoDB read/write', 'S3 access', 'Parameter Store read']
        },
        updateDeviceSettings: {
          purpose: 'Process settings updates from API and device acknowledgments',
          inputData: 'deviceId, settings, timestamp',
          outputAction: 'Update database and publish to device MQTT topic',
          databaseAccess: 'Devices table (update), publish to MQTT',
          lambdaRole: 'iotCommunicationRole',
          roleArn: `/acorn-pups/${props.environment}/lambda-functions/iot-comm-role/arn`,
          iotRuleTrigger: 'acorn-pups/settings/+/ack',
          permissions: ['IoT publish', 'DynamoDB read/write', 'Parameter Store read']
        },
        factoryReset: {
          purpose: 'Process factory reset notifications from devices and cleanup AWS resources',
          inputData: 'deviceId, resetTimestamp, oldCertificateArn, reason',
          outputAction: 'Revoke certificates, delete IoT Things, cleanup database records',
          databaseAccess: 'All device-related tables (cleanup), DeviceUsers, Invitations',
          lambdaRole: 'iotDeviceManagementRole',
          roleArn: `/acorn-pups/${props.environment}/lambda-functions/iot-device-mgmt-role/arn`,
          iotRuleTrigger: 'acorn-pups/reset/+',
          permissions: ['Full IoT management', 'Certificate revocation', 'DynamoDB read/write', 'Parameter Store read']
        }
      }),
      'Lambda function requirements and role mapping for IoT rules',
      `/acorn-pups/${props.environment}/iot-core/lambda-function-requirements`
    );

    // Additional parameters for monitoring and debugging
    this.parameterHelper.createParameter(
      'RuleTopicsParam',
      JSON.stringify({
        buttonPress: 'acorn-pups/button-press/+',
        deviceStatus: 'acorn-pups/status/+',
        deviceReset: 'acorn-pups/commands/+/reset',
        deviceSettingsAck: 'acorn-pups/settings/+/ack',
        factoryReset: 'acorn-pups/reset/+'
      }),
      'MQTT topics monitored by IoT Rules',
      `/acorn-pups/${props.environment}/iot-core/rule-topics`
    );

    this.parameterHelper.createParameter(
      'LogGroupPrefixParam',
      `/aws/iot/rules/AcornPups`,
      'CloudWatch Log Group prefix for IoT Rules',
      `/acorn-pups/${props.environment}/iot-core/log-group-prefix`
    );

    // API integration mapping with granular role structure
    this.parameterHelper.createParameter(
      'ApiRuleIntegrationParam',
      JSON.stringify({
        description: 'Complete integration mapping between API endpoints, IoT rules, Lambda functions, and roles',
        apiToIoTFlow: {
          'PUT /devices/{deviceId}/settings': {
            apiFunction: 'update-device-settings',
            apiRole: 'iotCommunicationRole',
            roleArn: `/acorn-pups/${props.environment}/lambda-functions/iot-comm-role/arn`,
            publishToMqtt: 'acorn-pups/settings/{deviceId}',
            deviceResponse: 'acorn-pups/settings/{deviceId}/ack',
            iotRule: 'deviceSettingsAck',
            ruleFunction: 'update-device-settings',
            ruleRole: 'iotCommunicationRole',
            flow: 'API -> Lambda (IoT Comm Role) -> MQTT -> Device -> MQTT (ack) -> Lambda (IoT Comm Role) -> Database',
            permissions: 'IoT publish, DynamoDB read/write'
          },
          'POST /devices/{deviceId}/reset': {
            apiFunction: 'reset-device',
            apiRole: 'iotDeviceManagementRole',
            roleArn: `/acorn-pups/${props.environment}/lambda-functions/iot-device-mgmt-role/arn`,
            publishToMqtt: 'acorn-pups/commands/{deviceId}/reset',
            iotRule: 'deviceReset',
            ruleFunction: 'reset-device',
            ruleRole: 'iotDeviceManagementRole',
            flow: 'API -> Lambda (IoT Device Mgmt Role) -> MQTT -> Device -> MQTT (ack) -> Lambda (IoT Device Mgmt Role) -> Cleanup',
            permissions: 'Full IoT management, certificate cleanup, DynamoDB read/write, S3 access'
          },
          'POST /devices/register': {
            apiFunction: 'register-device',
            apiRole: 'iotDeviceManagementRole',
            roleArn: `/acorn-pups/${props.environment}/lambda-functions/iot-device-mgmt-role/arn`,
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
          'Device status update': {
            devicePublish: 'acorn-pups/status/{deviceId}',
            iotRule: 'deviceStatus',
            lambdaFunction: 'update-device-status',
            lambdaRole: 'baseLambdaRole',
            roleArn: `/acorn-pups/${props.environment}/lambda-functions/base-role/arn`,
            flow: 'Device -> MQTT -> IoT Rule -> Lambda (Base Role) -> DynamoDB',
            permissions: 'DynamoDB read/write only'
          },
          'Factory reset notification': {
            devicePublish: 'acorn-pups/reset/{deviceId}',
            iotRule: 'factoryReset',
            lambdaFunction: 'factory-reset',
            lambdaRole: 'iotDeviceManagementRole',
            roleArn: `/acorn-pups/${props.environment}/lambda-functions/iot-device-mgmt-role/arn`,
            flow: 'Device -> MQTT -> IoT Rule -> Lambda (IoT Device Mgmt Role) -> Certificate Cleanup -> Database Cleanup',
            permissions: 'Full IoT management, certificate revocation, DynamoDB read/write'
          }
        },
        rolePermissionMapping: {
          iotDeviceManagementRole: {
            functions: ['register-device', 'reset-device', 'factory-reset'],
            permissions: 'Full IoT certificate and Thing management, S3 certificate backup, DynamoDB access',
            useCases: 'Device lifecycle management, certificate operations, factory reset cleanup'
          },
          iotCommunicationRole: {
            functions: ['update-device-settings'],
            permissions: 'IoT publish to device topics, DynamoDB access',
            useCases: 'Real-time device configuration updates'
          },
          notificationRole: {
            functions: ['handle-button-press', 'invite-user'],
            permissions: 'SNS publish, SES email sending, DynamoDB access',
            useCases: 'Push notifications, email invitations'
          },
          baseLambdaRole: {
            functions: ['update-device-status', 'get-user-devices', 'health-check', 'user management'],
            permissions: 'DynamoDB access, Parameter Store access only',
            useCases: 'Basic CRUD operations, data retrieval'
          }
        }
      }),
      'Complete API and device integration mapping with granular role structure',
      `/acorn-pups/${props.environment}/iot-core/api-rule-integration`
    );
  }
} 