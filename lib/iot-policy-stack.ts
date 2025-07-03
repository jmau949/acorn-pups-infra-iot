import * as cdk from 'aws-cdk-lib';
import * as iot from 'aws-cdk-lib/aws-iot';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { IotPolicyStackProps, IOT_CLIENT_ID_PATTERN } from './types';
import { ParameterStoreHelper } from './parameter-store-helper';

export class IotPolicyStack extends cdk.Stack {
  public readonly devicePolicy: iot.CfnPolicy;
  public readonly iotRuleExecutionRole: iam.Role;
  private parameterHelper: ParameterStoreHelper;

  constructor(scope: Construct, id: string, props: IotPolicyStackProps) {
    super(scope, id, props);

    // Initialize parameter store helper
    this.parameterHelper = new ParameterStoreHelper(this, {
      environment: props.environment,
      stackName: 'policies',
    });

    // Create IoT Device Policy with minimal security principle
    this.devicePolicy = new iot.CfnPolicy(this, 'AcornPupsDevicePolicy', {
      policyName: `AcornPupsDevicePolicy-${props.environment}`,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: 'iot:Connect',
            Resource: `arn:aws:iot:${this.region}:${this.account}:client/${IOT_CLIENT_ID_PATTERN}`,
            Condition: {
              StringEquals: {
                'iot:Connection.Thing.IsAttached': 'true'
              }
            }
          },
          {
            Effect: 'Allow',
            Action: 'iot:Publish',
            Resource: [
              `arn:aws:iot:${this.region}:${this.account}:topic/acorn-pups/button-press/\${iot:ClientId}`,
              `arn:aws:iot:${this.region}:${this.account}:topic/acorn-pups/status/\${iot:ClientId}`
            ]
          },
          {
            Effect: 'Allow',
            Action: [
              'iot:Subscribe',
              'iot:Receive'
            ],
            Resource: [
              `arn:aws:iot:${this.region}:${this.account}:topic/acorn-pups/settings/\${iot:ClientId}`,
              `arn:aws:iot:${this.region}:${this.account}:topic/acorn-pups/commands/\${iot:ClientId}`
            ]
          },
          {
            Effect: 'Allow',
            Action: [
              'iot:UpdateThingShadow',
              'iot:GetThingShadow'
            ],
            Resource: `arn:aws:iot:${this.region}:${this.account}:thing/\${iot:ClientId}`
          }
        ]
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
          value: 'Policy'
        }
      ]
    });

    // Create IAM Role for IoT Rules execution
    this.iotRuleExecutionRole = new iam.Role(this, 'IoTRuleExecutionRole', {
      roleName: `AcornPupsIoTRuleExecution-${props.environment}`,
      assumedBy: new iam.ServicePrincipal('iot.amazonaws.com'),
      description: 'Role for IoT Rules to execute Lambda functions and write to CloudWatch Logs',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSIoTRuleActions')
      ],
      inlinePolicies: {
        LambdaInvokePolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'lambda:InvokeFunction'
              ],
              resources: [
                `arn:aws:lambda:${this.region}:${this.account}:function:acorn-pups-${props.environment}-*`
              ]
            })
          ]
        }),
        CloudWatchLogsPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
                'logs:DescribeLogGroups',
                'logs:DescribeLogStreams'
              ],
              resources: [
                `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/iot/rules/*`,
                `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/iot/rules/*:*`
              ]
            })
          ]
        }),
        ParameterStoreReadPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'ssm:GetParameter',
                'ssm:GetParameters',
                'ssm:GetParameterHistory'
              ],
              resources: [
                `arn:aws:ssm:${this.region}:${this.account}:parameter/acorn-pups/${props.environment}/*`
              ]
            })
          ]
        })
      }
    });

    // Add tags to IAM role
    cdk.Tags.of(this.iotRuleExecutionRole).add('Project', 'acorn-pups');
    cdk.Tags.of(this.iotRuleExecutionRole).add('Environment', props.environment);
    cdk.Tags.of(this.iotRuleExecutionRole).add('Service', 'IoT-Core');
    cdk.Tags.of(this.iotRuleExecutionRole).add('Component', 'IAM-Role');

    // Store policy information in Parameter Store
    this.parameterHelper.createParameter(
      'DevicePolicyArnParam',
      this.devicePolicy.attrArn,
      'ARN of the AcornPupsDevice Policy',
      `/acorn-pups/${props.environment}/iot-core/device-policy/arn`
    );

    this.parameterHelper.createParameter(
      'DevicePolicyNameParam',
      this.devicePolicy.policyName!,
      'Name of the AcornPupsDevice Policy',
      `/acorn-pups/${props.environment}/iot-core/device-policy/name`
    );

    // Create outputs with Parameter Store integration
    this.parameterHelper.createOutputWithParameter(
      'DevicePolicyArnOutput',
      this.devicePolicy.attrArn,
      'ARN of the Acorn Pups Device Policy',
      `AcornPupsDevicePolicyArn-${props.environment}`
    );

    this.parameterHelper.createOutputWithParameter(
      'DevicePolicyNameOutput',
      this.devicePolicy.policyName!,
      'Name of the Acorn Pups Device Policy',
      `AcornPupsDevicePolicyName-${props.environment}`
    );

    this.parameterHelper.createOutputWithParameter(
      'IoTRuleExecutionRoleArnOutput',
      this.iotRuleExecutionRole.roleArn,
      'ARN of the IoT Rule Execution Role',
      `AcornPupsIoTRuleExecutionRoleArn-${props.environment}`
    );

    this.parameterHelper.createOutputWithParameter(
      'IoTRuleExecutionRoleNameOutput',
      this.iotRuleExecutionRole.roleName,
      'Name of the IoT Rule Execution Role',
      `AcornPupsIoTRuleExecutionRoleName-${props.environment}`
    );

    // Additional parameters for Lambda functions
    this.parameterHelper.createParameter(
      'ClientIdPatternParam',
      IOT_CLIENT_ID_PATTERN,
      'Client ID pattern for IoT device connections',
      `/acorn-pups/${props.environment}/iot-core/client-id-pattern`
    );

    this.parameterHelper.createParameter(
      'TopicPrefixesParam',
      JSON.stringify({
        buttonPress: 'acorn-pups/button-press/',
        status: 'acorn-pups/status/',
        settings: 'acorn-pups/settings/',
        commands: 'acorn-pups/commands/'
      }),
      'MQTT topic prefixes for device communication',
      `/acorn-pups/${props.environment}/iot-core/topic-prefixes`
    );
  }
} 