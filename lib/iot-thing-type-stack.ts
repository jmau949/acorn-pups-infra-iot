import * as cdk from 'aws-cdk-lib';
import * as iot from 'aws-cdk-lib/aws-iot';
import { Construct } from 'constructs';
import { IotThingTypeStackProps } from './types';
import { ParameterStoreHelper } from './parameter-store-helper';

export class IotThingTypeStack extends cdk.Stack {
  public readonly acornPupsReceiverThingType: iot.CfnThingType;
  private parameterHelper: ParameterStoreHelper;

  constructor(scope: Construct, id: string, props: IotThingTypeStackProps) {
    super(scope, id, props);

    // Initialize parameter store helper
    this.parameterHelper = new ParameterStoreHelper(this, {
      environment: props.environment,
      stackName: 'thing-types',
    });

    // Create AcornPupsReceiver Thing Type for ESP32 receivers only
    this.acornPupsReceiverThingType = new iot.CfnThingType(this, 'AcornPupsReceiverThingType', {
      thingTypeName: `AcornPupsReceiver-${props.environment}`,
      thingTypeProperties: {
        thingTypeDescription: 'IoT Thing Type for Acorn Pups ESP32-based smart receivers that plug into wall outlets and ring when RF buttons are pressed',
        searchableAttributes: [
          'deviceName',
          'serialNumber',
          'macAddress'
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
        },
        {
          key: 'DeviceType',
          value: 'ESP32-Receiver'
        }
      ]
    });

    // Create Parameter Store parameters for cross-stack integration
    this.parameterHelper.createParameter(
      'ReceiverThingTypeArnParam',
      this.acornPupsReceiverThingType.attrArn,
      'ARN of the AcornPupsReceiver Thing Type',
      `/acorn-pups/${props.environment}/iot-core/thing-type/receiver/arn`
    );

    this.parameterHelper.createParameter(
      'ReceiverThingTypeNameParam',
      this.acornPupsReceiverThingType.thingTypeName!,
      'Name of the AcornPupsReceiver Thing Type',
      `/acorn-pups/${props.environment}/iot-core/thing-type/receiver/name`
    );

    // Create CloudFormation outputs with Parameter Store integration
    this.parameterHelper.createOutputWithParameter(
      'ReceiverThingTypeArnOutput',
      this.acornPupsReceiverThingType.attrArn,
      'ARN of the AcornPupsReceiver Thing Type',
      `AcornPupsReceiverThingTypeArn-${props.environment}`
    );

    this.parameterHelper.createOutputWithParameter(
      'ReceiverThingTypeNameOutput', 
      this.acornPupsReceiverThingType.thingTypeName!,
      'Name of the AcornPupsReceiver Thing Type',
      `AcornPupsReceiverThingTypeName-${props.environment}`
    );

    this.parameterHelper.createOutputWithParameter(
      'ReceiverThingTypeIdOutput',
      this.acornPupsReceiverThingType.ref,
      'CloudFormation reference of the AcornPupsReceiver Thing Type',
      `AcornPupsReceiverThingTypeId-${props.environment}`
    );

    // Additional parameters for Lambda functions to use
    this.parameterHelper.createParameter(
      'ReceiverThingTypeDescriptionParam',
      'IoT Thing Type for Acorn Pups ESP32-based smart receivers that plug into wall outlets and ring when RF buttons are pressed',
      'Description of the AcornPupsReceiver Thing Type',
      `/acorn-pups/${props.environment}/iot-core/thing-type/receiver/description`
    );

    this.parameterHelper.createParameter(
      'ReceiverSearchableAttributesParam',
      JSON.stringify(['deviceName', 'serialNumber', 'macAddress']),
      'Searchable attributes for the AcornPupsReceiver Thing Type (AWS limit: 3 max)',
      `/acorn-pups/${props.environment}/iot-core/thing-type/receiver/searchable-attributes`
    );

    // RF Button information (not IoT devices, just for reference)
    this.parameterHelper.createParameter(
      'RfButtonInfoParam',
      JSON.stringify({
        type: 'RF_TRANSMITTER',
        frequency: '315MHz_or_433MHz',
        autoRecognition: true,
        batteryType: 'CR2032',
        registrationRequired: false,
        description: 'RF buttons are simple transmitters that send signals to ESP32 receivers. They are not IoT devices and do not connect to AWS IoT Core.'
      }),
      'RF Button technical information for documentation',
      `/acorn-pups/${props.environment}/rf-buttons/info`
    );

    // Device architecture information
    this.parameterHelper.createParameter(
      'DeviceArchitectureParam',
      JSON.stringify({
        receivers: {
          type: 'ESP32_RECEIVER',
          connectivity: 'WiFi_and_MQTT',
          features: ['RF_reception', 'speaker', 'LED_indicators', 'wall_outlet_power'],
          iotIntegration: true
        },
        buttons: {
          type: 'RF_TRANSMITTER',
          connectivity: 'RF_only',
          features: ['button_press', 'battery_powered', 'LED_feedback'],
          iotIntegration: false
        }
      }),
      'Device architecture information for the Acorn Pups system',
      `/acorn-pups/${props.environment}/device-architecture`
    );
  }
} 