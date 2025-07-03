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
          // Device Connectivity Widget
          new cloudwatch.GraphWidget({
            title: 'Device Connectivity',
            left: [
              new cloudwatch.Metric({
                namespace: 'AWS/IoT',
                metricName: 'Connect.Success',
                dimensionsMap: {
                  ClientId: 'acorn-esp32-*'
                },
                statistic: 'Sum'
              }),
              new cloudwatch.Metric({
                namespace: 'AWS/IoT',
                metricName: 'Connect.Failure',
                dimensionsMap: {
                  ClientId: 'acorn-esp32-*'
                },
                statistic: 'Sum'
              })
            ],
            width: 12,
            height: 6
          }),
          
          // Message Processing Widget
          new cloudwatch.GraphWidget({
            title: 'Message Processing',
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
          // Rule Execution Widget
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
              })
            ],
            width: 12,
            height: 6
          }),
        ],
        [
          // Device Status Widget
          new cloudwatch.SingleValueWidget({
            title: 'Active Devices',
            metrics: [
              new cloudwatch.Metric({
                namespace: 'AcornPups/IoT',
                metricName: 'ActiveDevices',
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

    // Device Connectivity Alarm
    this.alarms.deviceConnectivity = new cloudwatch.Alarm(this, 'DeviceConnectivityAlarm', {
      alarmName: `AcornPupsIoT-DeviceConnectivity-${props.environment}`,
      alarmDescription: 'Device connectivity issues detected',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/IoT',
        metricName: 'Connect.Failure',
        dimensionsMap: {
          ClientId: 'acorn-esp32-*'
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5)
      }),
      threshold: 10, // More than 10 failed connections in 5 minutes
      evaluationPeriods: 2,
      datapointsToAlarm: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    });

    // Add tags to alarms
    Object.entries(this.alarms).forEach(([name, alarm]) => {
      cdk.Tags.of(alarm).add('Project', 'acorn-pups');
      cdk.Tags.of(alarm).add('Environment', props.environment);
      cdk.Tags.of(alarm).add('Service', 'IoT-Core');
      cdk.Tags.of(alarm).add('Component', 'Alarm');
      cdk.Tags.of(alarm).add('AlarmType', name);
    });

    // Store monitoring information in Parameter Store
    this.parameterHelper.createParameter(
      'DashboardNameParam',
      this.dashboard.dashboardName,
      'Name of the CloudWatch Dashboard',
      `/acorn-pups/${props.environment}/monitoring/dashboard/name`
    );

    this.parameterHelper.createParameter(
      'DashboardUrlParam',
      `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.dashboard.dashboardName}`,
      'URL of the CloudWatch Dashboard',
      `/acorn-pups/${props.environment}/monitoring/dashboard/url`
    );

    // Store alarm information
    Object.entries(this.alarms).forEach(([name, alarm]) => {
      this.parameterHelper.createParameter(
        `${name}AlarmArnParam`,
        alarm.alarmArn,
        `ARN of the ${name} alarm`,
        `/acorn-pups/${props.environment}/monitoring/alarms/${name}/arn`
      );

      this.parameterHelper.createParameter(
        `${name}AlarmNameParam`,
        alarm.alarmName,
        `Name of the ${name} alarm`,
        `/acorn-pups/${props.environment}/monitoring/alarms/${name}/name`
      );
    });

    // Create CloudFormation outputs with Parameter Store integration
    this.parameterHelper.createOutputWithParameter(
      'DashboardNameOutput',
      this.dashboard.dashboardName,
      'Name of the CloudWatch Dashboard',
      `AcornPupsIoTDashboardName-${props.environment}`
    );

    this.parameterHelper.createOutputWithParameter(
      'DashboardUrlOutput',
      `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.dashboard.dashboardName}`,
      'URL of the CloudWatch Dashboard',
      `AcornPupsIoTDashboardUrl-${props.environment}`
    );

    // Additional monitoring parameters
    this.parameterHelper.createParameter(
      'MetricNamespacesParam',
      JSON.stringify(['AWS/IoT', 'AcornPups/IoT']),
      'CloudWatch metric namespaces used by the IoT system',
      `/acorn-pups/${props.environment}/monitoring/metric-namespaces`
    );

    this.parameterHelper.createParameter(
      'AlarmThresholdsParam',
      JSON.stringify({
        errorRate: 5,
        connectivityFailures: 10,
      }),
      'Alarm thresholds for monitoring',
      `/acorn-pups/${props.environment}/monitoring/alarm-thresholds`
    );
  }
} 