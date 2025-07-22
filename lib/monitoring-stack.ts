import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as iot from 'aws-cdk-lib/aws-iot';
import { Construct } from 'constructs';
import { MonitoringStackProps } from './types';
import { ParameterStoreHelper } from './parameter-store-helper';

export class MonitoringStack extends cdk.Stack {
  public readonly dashboard: cloudwatch.Dashboard;
  public readonly alarms: { [key: string]: cloudwatch.Alarm };
  private parameterHelper: ParameterStoreHelper;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    this.alarms = {};

    // Initialize parameter store helper
    this.parameterHelper = new ParameterStoreHelper(this, {
      environment: props.environment,
      stackName: 'monitoring',
    });

    // Create CloudWatch Dashboard
    this.dashboard = new cloudwatch.Dashboard(this, 'AcornPupsIoTDashboard', {
      dashboardName: `AcornPupsIoT-${props.environment}`,
      widgets: [
        [
          // ESP32 Receiver Connectivity Widget
          new cloudwatch.GraphWidget({
            title: 'ESP32 Receiver Connectivity',
            left: [
              new cloudwatch.Metric({
                namespace: 'AWS/IoT',
                metricName: 'Connect.Success',
                dimensionsMap: {
                  ClientId: 'acorn-receiver-*'
                },
                statistic: 'Sum'
              }),
              new cloudwatch.Metric({
                namespace: 'AWS/IoT',
                metricName: 'Connect.Failure',
                dimensionsMap: {
                  ClientId: 'acorn-receiver-*'
                },
                statistic: 'Sum'
              })
            ],
            width: 12,
            height: 6
          }),
          
          // RF Button Press Message Processing Widget
          new cloudwatch.GraphWidget({
            title: 'RF Button Press Message Processing',
            left: [
              new cloudwatch.Metric({
                namespace: 'AWS/IoT',
                metricName: 'PublishIn.Success',
                dimensionsMap: {
                  Topic: 'acorn-pups/button-press'
                },
                statistic: 'Sum'
              }),
              new cloudwatch.Metric({
                namespace: 'AWS/IoT',
                metricName: 'PublishIn.Success',
                dimensionsMap: {
                  Topic: 'acorn-pups/status'
                },
                statistic: 'Sum'
              })
            ],
            width: 12,
            height: 6
          })
        ],
        [
          // IoT Rule Execution Widget
          new cloudwatch.GraphWidget({
            title: 'IoT Rule Executions',
            left: [
              new cloudwatch.Metric({
                namespace: 'AWS/IoT',
                metricName: 'RuleExecution',
                dimensionsMap: {
                  RuleName: `AcornPupsButtonPress_${props.environment}`
                },
                statistic: 'Sum'
              }),
              new cloudwatch.Metric({
                namespace: 'AWS/IoT',
                metricName: 'RuleExecution',
                dimensionsMap: {
                  RuleName: `AcornPupsDeviceStatus_${props.environment}`
                },
                statistic: 'Sum'
              }),
              new cloudwatch.Metric({
                namespace: 'AWS/IoT',
                metricName: 'RuleExecution',
                dimensionsMap: {
                  RuleName: `AcornPupsDeviceReset_${props.environment}`
                },
                statistic: 'Sum'
              }),
              new cloudwatch.Metric({
                namespace: 'AWS/IoT',
                metricName: 'RuleExecution',
                dimensionsMap: {
                  RuleName: `AcornPupsFactoryReset_${props.environment}`
                },
                statistic: 'Sum'
              })
            ],
            width: 12,
            height: 6
          }),
        ],
        [
          // Active ESP32 Receivers Widget
          new cloudwatch.SingleValueWidget({
            title: 'Active ESP32 Receivers',
            metrics: [
              new cloudwatch.Metric({
                namespace: 'AcornPups/IoT',
                metricName: 'ActiveReceivers',
                statistic: 'Average'
              })
            ],
            width: 6,
            height: 6
          }),

          // Error Rate Widget
          new cloudwatch.SingleValueWidget({
            title: 'Error Rate',
            metrics: [
              new cloudwatch.MathExpression({
                expression: 'errors/total*100',
                usingMetrics: {
                  errors: new cloudwatch.Metric({
                    namespace: 'AWS/IoT',
                    metricName: 'RuleExecution.Failure',
                    statistic: 'Sum'
                  }),
                  total: new cloudwatch.Metric({
                    namespace: 'AWS/IoT',
                    metricName: 'RuleExecution',
                    statistic: 'Sum'
                  })
                }
              })
            ],
            width: 6,
            height: 6
          })
        ]
      ]
    });

    // Add tags to dashboard
    cdk.Tags.of(this.dashboard).add('Project', 'acorn-pups');
    cdk.Tags.of(this.dashboard).add('Environment', props.environment);
    cdk.Tags.of(this.dashboard).add('Service', 'IoT-Core');
    cdk.Tags.of(this.dashboard).add('Component', 'Dashboard');

    // Create CloudWatch Alarms
    
    // High Error Rate Alarm
    this.alarms.highErrorRate = new cloudwatch.Alarm(this, 'HighErrorRateAlarm', {
      alarmName: `AcornPupsIoT-HighErrorRate-${props.environment}`,
      alarmDescription: 'High error rate in IoT Rule executions',
      metric: new cloudwatch.MathExpression({
        expression: 'errors/total*100',
        usingMetrics: {
          errors: new cloudwatch.Metric({
            namespace: 'AWS/IoT',
            metricName: 'RuleExecution.Failure',
            statistic: 'Sum',
            period: cdk.Duration.minutes(5)
          }),
          total: new cloudwatch.Metric({
            namespace: 'AWS/IoT',
            metricName: 'RuleExecution',
            statistic: 'Sum',
            period: cdk.Duration.minutes(5)
          })
        }
      }),
      threshold: 5, // 5% error rate
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    });

    // ESP32 Receiver Connectivity Alarm
    this.alarms.receiverConnectivity = new cloudwatch.Alarm(this, 'ReceiverConnectivityAlarm', {
      alarmName: `AcornPupsIoT-ReceiverConnectivity-${props.environment}`,
      alarmDescription: 'ESP32 receiver connectivity issues detected',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/IoT',
        metricName: 'Connect.Failure',
        dimensionsMap: {
          ClientId: 'acorn-receiver-*'
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5)
      }),
      threshold: 10, // More than 10 failed connections in 5 minutes
      evaluationPeriods: 2,
      datapointsToAlarm: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    });

    // Store monitoring information in Parameter Store
    this.parameterHelper.createParameter(
      'DashboardNameParam',
      this.dashboard.dashboardName,
      'CloudWatch Dashboard name for Acorn Pups IoT monitoring',
      `/acorn-pups/${props.environment}/monitoring/dashboard-name`
    );

    this.parameterHelper.createParameter(
      'AlarmNamesParam',
      JSON.stringify({
        highErrorRate: this.alarms.highErrorRate.alarmName,
        receiverConnectivity: this.alarms.receiverConnectivity.alarmName
      }),
      'CloudWatch Alarm names for Acorn Pups IoT monitoring',
      `/acorn-pups/${props.environment}/monitoring/alarm-names`
    );

    // Create CloudFormation outputs with Parameter Store integration
    this.parameterHelper.createOutputWithParameter(
      'DashboardNameOutput',
      this.dashboard.dashboardName,
      'Name of the CloudWatch Dashboard',
      `AcornPupsDashboardName-${props.environment}`
    );

    this.parameterHelper.createOutputWithParameter(
      'HighErrorRateAlarmArnOutput',
      this.alarms.highErrorRate.alarmArn,
      'ARN of the High Error Rate Alarm',
      `AcornPupsHighErrorRateAlarmArn-${props.environment}`
    );

    this.parameterHelper.createOutputWithParameter(
      'ReceiverConnectivityAlarmArnOutput',
      this.alarms.receiverConnectivity.alarmArn,
      'ARN of the Receiver Connectivity Alarm',
      `AcornPupsReceiverConnectivityAlarmArn-${props.environment}`
    );

    // Monitoring metrics configuration
    this.parameterHelper.createParameter(
      'MonitoringMetricsParam',
      JSON.stringify({
        receiverConnectivity: {
          namespace: 'AWS/IoT',
          successMetric: 'Connect.Success',
          failureMetric: 'Connect.Failure',
          dimension: 'ClientId: acorn-receiver-*'
        },
        buttonPressProcessing: {
          namespace: 'AWS/IoT',
          publishMetric: 'PublishIn.Success',
          topicDimension: 'acorn-pups/button-press'
        },
        ruleExecution: {
          namespace: 'AWS/IoT',
          executionMetric: 'RuleExecution',
          failureMetric: 'RuleExecution.Failure',
          rules: [
            `AcornPupsButtonPress_${props.environment}`,
            `AcornPupsDeviceStatus_${props.environment}`,
            `AcornPupsDeviceReset_${props.environment}`,
            `AcornPupsFactoryReset_${props.environment}`
          ]
        }
      }),
      'CloudWatch metrics configuration for Acorn Pups IoT monitoring',
      `/acorn-pups/${props.environment}/monitoring/metrics-config`
    );
  }
} 