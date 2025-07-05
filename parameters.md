# Acorn Pups Infrastructure Parameters

This document lists all Parameter Store parameters used and created by this repository.

## Parameter Store Path Structure

```
/acorn-pups/{environment}/
├── cfn-outputs/           # CloudFormation outputs (API repo)
├── iot-outputs/           # IoT CloudFormation outputs (IoT repo)
├── lambda-functions/      # Lambda function ARNs and names
├── iot-core/             # IoT Core resources
├── rf-buttons/           # RF button information
└── device-architecture/  # Device architecture info
```


## IoT Infrastructure Repository

### Parameters **REQUIRED** by this repository:
- `/acorn-pups/{environment}/lambda-functions/handleButtonPress/arn` - ✅ **EXISTS** in API repo
- `/acorn-pups/{environment}/lambda-functions/updateDeviceStatus/arn` - ✅ **EXISTS** in API repo
- `/acorn-pups/{environment}/lambda-functions/resetDevice/arn` - ✅ **EXISTS** in API repo

### Parameters **CREATED** by this repository:

#### Thing Types Stack (`/acorn-pups/{environment}/iot-core/`)
- `thing-type/receiver/arn` - ARN of the AcornPupsReceiver Thing Type
- `thing-type/receiver/name` - Name of the AcornPupsReceiver Thing Type
- `thing-type/receiver/description` - Description of the AcornPupsReceiver Thing Type
- `thing-type/receiver/searchable-attributes` - Searchable attributes for the Thing Type
- `rf-buttons/info` - RF Button technical information
- `device-architecture` - Device architecture information

#### Policy Stack (`/acorn-pups/{environment}/iot-core/`)
- `receiver-policy/arn` - ARN of the AcornPupsReceiver Policy
- `receiver-policy/name` - Name of the AcornPupsReceiver Policy
- `rule-execution-role/arn` - ARN of the IoT Rule Execution Role
- `rule-execution-role/name` - Name of the IoT Rule Execution Role
- `client-id-pattern` - Client ID pattern for IoT receiver connections
- `mqtt-topics` - MQTT topic structure for Acorn Pups system

#### Rules Stack (`/acorn-pups/{environment}/iot-core/`)
- `rules/buttonPress/arn` - ARN of the Button Press IoT Rule
- `rules/buttonPress/name` - Name of the Button Press IoT Rule
- `rules/deviceStatus/arn` - ARN of the Device Status IoT Rule
- `rules/deviceStatus/name` - Name of the Device Status IoT Rule
- `rules/deviceReset/arn` - ARN of the Device Reset IoT Rule
- `rules/deviceReset/name` - Name of the Device Reset IoT Rule
- `rule-configuration` - IoT Rule configuration details
- `lambda-function-requirements` - Lambda function requirements for IoT rules
- `rule-topics` - MQTT topics monitored by IoT Rules
- `log-group-prefix` - CloudWatch Log Group prefix for IoT Rules

#### Certificate Management Stack (`/acorn-pups/{environment}/iot-core/`)
- `certificate-bucket/name` - S3 bucket for storing device metadata
- `certificate-bucket/arn` - ARN of the S3 bucket for certificates
- `endpoint` - AWS IoT Core endpoint for certificate management
- `data-endpoint` - AWS IoT Core data endpoint for ESP32 receivers
- `certificate-type` - Certificate type (AWS_MANAGED)
- `certificate-expiration-days` - Certificate expiration days
- `receiver-certificate-config` - ESP32 receiver certificate configuration
- `certificate-generation-workflow` - Certificate generation workflow
- `receiver-certificate-files` - Required certificate files for ESP32 receivers
- `amazon-root-ca` - Amazon Root CA information
- `certificate-security-best-practices` - Certificate security best practices

#### Monitoring Stack (`/acorn-pups/{environment}/iot-outputs/monitoring/`)
- `iot-dashboard-name` - IoT CloudWatch Dashboard name
- `iot-dashboard-url` - IoT CloudWatch Dashboard URL
- `iot-alarm-topic-arn` - IoT SNS Topic ARN for alarms
- `iot-alarm-topic-name` - IoT SNS Topic name for alarms

---