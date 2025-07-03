import * as cdk from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export interface ParameterStoreConfig {
  environment: string;
  stackName: string;
}

/**
 * Helper class to manage Parameter Store parameters for IoT CloudFormation outputs
 */
export class ParameterStoreHelper {
  private scope: Construct;
  private config: ParameterStoreConfig;

  constructor(scope: Construct, config: ParameterStoreConfig) {
    this.scope = scope;
    this.config = config;
  }

  /**
   * Create a CloudFormation output and corresponding Parameter Store parameter
   * @param outputId - Unique identifier for the output within the stack
   * @param value - The value to output and store
   * @param description - Description for both output and parameter
   * @param exportName - Optional export name for cross-stack references
   * @param parameterPath - Optional custom parameter path (defaults to generated path)
   * @returns The created CfnOutput
   */
  public createOutputWithParameter(
    outputId: string,
    value: string,
    description: string,
    exportName?: string,
    parameterPath?: string
  ): cdk.CfnOutput {
    // Generate parameter path if not provided
    const generatedPath = parameterPath || this.generateParameterPath(outputId);

    // Create Parameter Store parameter
    new ssm.StringParameter(this.scope, `${outputId}Parameter`, {
      parameterName: generatedPath,
      stringValue: value,
      description: `[${this.config.stackName}] ${description}`,
      tier: ssm.ParameterTier.STANDARD,
      allowedPattern: '.*', // Allow any string pattern
    });

    // Create CloudFormation output
    const output = new cdk.CfnOutput(this.scope, outputId, {
      value: value,
      description: description,
      exportName: exportName,
    });

    return output;
  }

  /**
   * Batch create multiple outputs with parameters
   * @param outputs - Array of output configurations
   */
  public createMultipleOutputsWithParameters(
    outputs: Array<{
      outputId: string;
      value: string;
      description: string;
      exportName?: string;
      parameterPath?: string;
    }>
  ): cdk.CfnOutput[] {
    return outputs.map(output => 
      this.createOutputWithParameter(
        output.outputId,
        output.value,
        output.description,
        output.exportName,
        output.parameterPath
      )
    );
  }

  /**
   * Generate standardized parameter path for IoT resources
   * @param outputId - The output identifier
   * @returns Formatted parameter path
   */
  private generateParameterPath(outputId: string): string {
    // Convert PascalCase to kebab-case for parameter names
    const kebabCaseId = outputId
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '');

    return `/acorn-pups/${this.config.environment}/iot-outputs/${this.config.stackName}/${kebabCaseId}`;
  }

  /**
   * Create a parameter for an existing CloudFormation output value
   * @param parameterId - Unique identifier for the parameter
   * @param value - The value to store
   * @param description - Description for the parameter
   * @param parameterPath - Optional custom parameter path
   */
  public createParameter(
    parameterId: string,
    value: string,
    description: string,
    parameterPath?: string
  ): ssm.StringParameter {
    const generatedPath = parameterPath || this.generateParameterPath(parameterId);

    return new ssm.StringParameter(this.scope, `${parameterId}Parameter`, {
      parameterName: generatedPath,
      stringValue: value,
      description: `[${this.config.stackName}] ${description}`,
      tier: ssm.ParameterTier.STANDARD,
      allowedPattern: '.*',
    });
  }

  /**
   * Get the parameter path for a given output ID
   * @param outputId - The output identifier
   * @returns The parameter path
   */
  public getParameterPath(outputId: string): string {
    return this.generateParameterPath(outputId);
  }

  /**
   * Create parameters for IoT Thing Type resources
   * @param thingType - IoT Thing Type resource
   * @param environment - Environment name
   */
  public createIotThingTypeParameters(
    thingType: any,
    environment: string
  ): void {
    this.createParameter(
      'ThingTypeArn',
      thingType.attrArn,
      'ARN of the AcornPupsDevice Thing Type',
      `/acorn-pups/${environment}/iot-core/thing-type/arn`
    );

    this.createParameter(
      'ThingTypeName',
      thingType.thingTypeName,
      'Name of the AcornPupsDevice Thing Type',
      `/acorn-pups/${environment}/iot-core/thing-type/name`
    );
  }

  /**
   * Create parameters for IoT Policy resources
   * @param policy - IoT Policy resource
   * @param environment - Environment name
   */
  public createIotPolicyParameters(
    policy: any,
    environment: string
  ): void {
    this.createParameter(
      'DevicePolicyArn',
      policy.attrArn,
      'ARN of the AcornPupsDevice Policy',
      `/acorn-pups/${environment}/iot-core/device-policy/arn`
    );

    this.createParameter(
      'DevicePolicyName',
      policy.policyName,
      'Name of the AcornPupsDevice Policy',
      `/acorn-pups/${environment}/iot-core/device-policy/name`
    );
  }

  /**
   * Create parameters for IoT Rule resources
   * @param rules - Object containing IoT Rules
   * @param environment - Environment name
   */
  public createIotRuleParameters(
    rules: { [key: string]: any },
    environment: string
  ): void {
    Object.entries(rules).forEach(([name, rule]) => {
      this.createParameter(
        `${name}RuleArn`,
        rule.attrArn,
        `ARN of the ${name} IoT Rule`,
        `/acorn-pups/${environment}/iot-core/rules/${name}/arn`
      );

      this.createParameter(
        `${name}RuleName`,
        rule.ruleName,
        `Name of the ${name} IoT Rule`,
        `/acorn-pups/${environment}/iot-core/rules/${name}/name`
      );
    });
  }

  /**
   * Create parameters for IoT Core endpoint and general resources
   * @param environment - Environment name
   * @param region - AWS region
   * @param account - AWS account ID
   */
  public createIotCoreParameters(
    environment: string,
    region: string,
    account: string
  ): void {
    // IoT Core endpoint URL
    const iotEndpoint = `${account}.iot.${region}.amazonaws.com`;
    this.createParameter(
      'IotEndpointUrl',
      iotEndpoint,
      'AWS IoT Core endpoint URL for MQTT connections',
      `/acorn-pups/${environment}/iot-core/endpoint-url`
    );

    // IoT Core data endpoint
    const iotDataEndpoint = `https://${account}.iot.${region}.amazonaws.com`;
    this.createParameter(
      'IotDataEndpointUrl',
      iotDataEndpoint,
      'AWS IoT Core data endpoint URL for API operations',
      `/acorn-pups/${environment}/iot-core/data-endpoint-url`
    );
  }
} 