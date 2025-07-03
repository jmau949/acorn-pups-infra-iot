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
    const buttonPressLambdaArnParam = ssm.StringParameter.fromStringParameterName(
      this,
      'ButtonPressLambdaArnParam',
      `/acorn-pups/${props.environment}/lambda-functions/handleButtonPress/arn`
    );

    const deviceStatusLambdaArnParam = ssm.StringParameter.fromStringParameterName(
      this,
      'DeviceStatusLambdaArnParam', 
      `/acorn-pups/${props.environment}/lambda-functions/updateDeviceStatus/arn`
    );

    const deviceResetLambdaArnParam = ssm.StringParameter.fromStringParameterName(
      this,
      'DeviceResetLambdaArnParam',
      `/acorn-pups/${props.environment}/lambda-functions/resetDevice/arn`
    );

    // Button Press Rule - Routes button press events to Lambda
    this.rules.buttonPress = new iot.CfnTopicRule(this, 'ButtonPressRule', {
      ruleName: `AcornPupsButtonPress_${props.environment}`,
      topicRulePayload: {
        sql: "SELECT *, topic(3) as deviceId, timestamp() as receivedAt FROM 'acorn-pups/button-press/+'",
        description: 'Route button press events from Acorn Pups devices to processing Lambda function',
        actions: [
          {
            lambda: {
              functionArn: buttonPressLambdaArnParam.stringValue
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

    // Device Status Rule - Routes status updates to Lambda
    this.rules.deviceStatus = new iot.CfnTopicRule(this, 'DeviceStatusRule', {
      ruleName: `AcornPupsDeviceStatus_${props.environment}`,
      topicRulePayload: {
        sql: "SELECT *, topic(3) as deviceId, timestamp() as receivedAt FROM 'acorn-pups/status/+'",
        description: 'Route device status updates from Acorn Pups devices to status Lambda function',
        actions: [
          {
            lambda: {
              functionArn: deviceStatusLambdaArnParam.stringValue
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
        description: 'Route device reset commands to reset handler Lambda function',
        actions: [
          {
            lambda: {
              functionArn: deviceResetLambdaArnParam.stringValue
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

    // Device Shadow Update Rule - Routes shadow updates for device state management
    this.rules.shadowUpdate = new iot.CfnTopicRule(this, 'ShadowUpdateRule', {
      ruleName: `AcornPupsShadowUpdate_${props.environment}`,
      topicRulePayload: {
        sql: "SELECT *, topic(4) as deviceId, timestamp() as receivedAt FROM '$aws/things/+/shadow/update/accepted'",
        description: 'Route device shadow updates for offline state management',
        actions: [
          {
            cloudwatchLogs: {
              logGroupName: `/aws/iot/shadows/AcornPupsShadowUpdate_${props.environment}`,
              roleArn: props.roleArn
            }
          }
        ],
        errorAction: {
          cloudwatchLogs: {
            logGroupName: `/aws/iot/rules/AcornPupsShadowUpdate_${props.environment}/errors`,
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
          value: 'ShadowUpdate'
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

    // Create outputs for all rules
    Object.entries(this.rules).forEach(([name, rule]) => {
      this.parameterHelper.createOutputWithParameter(
        `${name}RuleArnOutput`,
        rule.attrArn,
        `ARN of the ${name} IoT Rule`,
        `AcornPups${name}RuleArn-${props.environment}`
      );

      this.parameterHelper.createOutputWithParameter(
        `${name}RuleNameOutput`,
        rule.ruleName!,
        `Name of the ${name} IoT Rule`,
        `AcornPups${name}RuleName-${props.environment}`
      );
    });

    // Additional parameters for monitoring and debugging
    this.parameterHelper.createParameter(
      'RuleTopicsParam',
      JSON.stringify({
        buttonPress: 'acorn-pups/button-press/+',
        deviceStatus: 'acorn-pups/status/+',
        deviceReset: 'acorn-pups/commands/+/reset',
        shadowUpdate: '$aws/things/+/shadow/update/accepted',
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
  }
} 