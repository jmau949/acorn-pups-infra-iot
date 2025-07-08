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

    const updateDeviceSettingsLambdaArnParam = ssm.StringParameter.fromStringParameterName(
      this,
      'UpdateDeviceSettingsLambdaArnParam',
      `/acorn-pups/${props.environment}/lambda-functions/updateDeviceSettings/arn`
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
            roleArn: props.roleArn
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
            roleArn: props.roleArn
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
            roleArn: props.roleArn
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
            roleArn: props.roleArn
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
        }
      }),
      'IoT Rule configuration details',
      `/acorn-pups/${props.environment}/iot-core/rule-configuration`
    );

    // Lambda function requirements for IoT rules
    this.parameterHelper.createParameter(
      'LambdaFunctionRequirementsParam',
      JSON.stringify({
        handleButtonPress: {
          purpose: 'Process RF button press events in real-time',
          inputData: 'deviceId, buttonRfId, timestamp, batteryLevel',
          outputAction: 'Send push notifications to all authorized users',
          databaseAccess: 'DeviceUsers table (read-only)',
          noStorage: 'No persistent storage of button events for MVP'
        },
        updateDeviceStatus: {
          purpose: 'Process and store device status updates',
          inputData: 'deviceId, statusType, timestamp, device metrics',
          outputAction: 'Update DeviceStatus table',
          databaseAccess: 'DeviceStatus table (write), Devices table (update)'
        },
        resetDevice: {
          purpose: 'Handle device factory reset commands',
          inputData: 'deviceId, resetReason, timestamp',
          outputAction: 'Clean up device data and certificates',
          databaseAccess: 'All device-related tables (cleanup)'
        },
        updateDeviceSettings: {
          purpose: 'Process settings updates from API and device acknowledgments',
          inputData: 'deviceId, settings, timestamp',
          outputAction: 'Update database and publish to device MQTT topic',
          databaseAccess: 'Devices table (update), publish to MQTT'
        }
      }),
      'Lambda function requirements for IoT rules',
      `/acorn-pups/${props.environment}/iot-core/lambda-function-requirements`
    );

    // Additional parameters for monitoring and debugging
    this.parameterHelper.createParameter(
      'RuleTopicsParam',
      JSON.stringify({
        buttonPress: 'acorn-pups/button-press/+',
        deviceStatus: 'acorn-pups/status/+',
        deviceReset: 'acorn-pups/commands/+/reset',
        deviceSettingsAck: 'acorn-pups/settings/+/ack'
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

    // API integration mapping
    this.parameterHelper.createParameter(
      'ApiRuleIntegrationParam',
      JSON.stringify({
        apiEndpoints: {
          'PUT /devices/{deviceId}/settings': {
            mqttTopic: 'acorn-pups/settings/{deviceId}',
            rule: 'deviceSettingsAck',
            flow: 'API -> Lambda -> MQTT -> Device -> MQTT (ack) -> Lambda -> Database'
          },
          'POST /devices/{deviceId}/reset': {
            mqttTopic: 'acorn-pups/commands/{deviceId}/reset',
            rule: 'deviceReset',
            flow: 'API -> Lambda -> MQTT -> Device -> MQTT (ack) -> Lambda -> Database'
          }
        },
        deviceToCloud: {
          'RF button press': {
            mqttTopic: 'acorn-pups/button-press/{deviceId}',
            rule: 'buttonPress',
            flow: 'Device -> MQTT -> Lambda -> SNS -> Mobile App'
          },
          'Device status': {
            mqttTopic: 'acorn-pups/status/{deviceId}',
            rule: 'deviceStatus',
            flow: 'Device -> MQTT -> Lambda -> DynamoDB'
          }
        }
      }),
      'API and device integration mapping for IoT rules',
      `/acorn-pups/${props.environment}/iot-core/api-rule-integration`
    );
  }
} 