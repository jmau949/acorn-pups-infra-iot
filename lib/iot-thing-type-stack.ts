import * as cdk from 'aws-cdk-lib';
import * as iot from 'aws-cdk-lib/aws-iot';
import { Construct } from 'constructs';
import { IotThingTypeStackProps } from './types';
import { ParameterStoreHelper } from './parameter-store-helper';

export class IotThingTypeStack extends cdk.Stack {
  public readonly acornPupsDeviceThingType: iot.CfnThingType;
  private parameterHelper: ParameterStoreHelper;

  constructor(scope: Construct, id: string, props: IotThingTypeStackProps) {
    super(scope, id, props);

    // Initialize parameter store helper
    this.parameterHelper = new ParameterStoreHelper(this, {
      environment: props.environment,
      stackName: 'thing-types',
    });

    // Create AcornPupsDevice Thing Type
    this.acornPupsDeviceThingType = new iot.CfnThingType(this, 'AcornPupsDeviceThingType', {
      thingTypeName: `AcornPupsDevice-${props.environment}`,
      thingTypeProperties: {
        thingTypeDescription: 'IoT Thing Type for Acorn Pups ESP32-based dog communication devices including button and ringer components',
        searchableAttributes: [
          'deviceName',
          'macAddress',
          'status'
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
          value: 'ThingType'
        }
      ]
    });

    // Create Parameter Store parameters for cross-stack integration
    this.parameterHelper.createParameter(
      'ThingTypeArnParam',
      this.acornPupsDeviceThingType.attrArn,
      'ARN of the AcornPupsDevice Thing Type',
      `/acorn-pups/${props.environment}/iot-core/thing-type/arn`
    );

    this.parameterHelper.createParameter(
      'ThingTypeNameParam',
      this.acornPupsDeviceThingType.thingTypeName!,
      'Name of the AcornPupsDevice Thing Type',
      `/acorn-pups/${props.environment}/iot-core/thing-type/name`
    );

    // Create CloudFormation outputs with Parameter Store integration
    this.parameterHelper.createOutputWithParameter(
      'ThingTypeArnOutput',
      this.acornPupsDeviceThingType.attrArn,
      'ARN of the AcornPupsDevice Thing Type',
      `AcornPupsThingTypeArn-${props.environment}`
    );

    this.parameterHelper.createOutputWithParameter(
      'ThingTypeNameOutput', 
      this.acornPupsDeviceThingType.thingTypeName!,
      'Name of the AcornPupsDevice Thing Type',
      `AcornPupsThingTypeName-${props.environment}`
    );

    this.parameterHelper.createOutputWithParameter(
      'ThingTypeIdOutput',
      this.acornPupsDeviceThingType.ref,
      'CloudFormation reference of the AcornPupsDevice Thing Type',
      `AcornPupsThingTypeId-${props.environment}`
    );

    // Additional parameters for Lambda functions to use
    this.parameterHelper.createParameter(
      'ThingTypeDescriptionParam',
      'IoT Thing Type for Acorn Pups ESP32-based dog communication devices including button and ringer components',
      'Description of the AcornPupsDevice Thing Type',
      `/acorn-pups/${props.environment}/iot-core/thing-type/description`
    );

    this.parameterHelper.createParameter(
      'SearchableAttributesParam',
      JSON.stringify(['deviceName', 'macAddress', 'status']),
      'Searchable attributes for the AcornPupsDevice Thing Type (AWS limit: 3 max)',
      `/acorn-pups/${props.environment}/iot-core/thing-type/searchable-attributes`
    );
  }
} 