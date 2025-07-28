# Acorn Pups IoT Infrastructure

AWS CDK TypeScript infrastructure for Acorn Pups IoT Core components and device management system.

## Overview

This repository contains the AWS CDK infrastructure for the Acorn Pups IoT dog communication system. It manages AWS IoT Core components including Thing Types, Policies, Rules, Certificate Management, and Monitoring for ESP32-based devices.

## Architecture

The infrastructure is organized into the following stacks:

### 1. **IoT Thing Type Stack** (`IotThingTypeStack`)
- Creates `AcornPupsDevice` Thing Type
- Defines searchable attributes: `deviceName`, `firmwareVersion`, `macAddress`, `deviceType`, `location`, `owner`, `status`
- Stores Thing Type information in Parameter Store for cross-stack integration

### 2. **IoT Policy Stack** (`IotPolicyStack`)
- Creates device-specific IoT policies with minimal security principle
- Allows connections with client ID pattern: `acorn-esp32-*`
- Publish permissions: `acorn-pups/button-press/{iot:ClientId}`, `acorn-pups/status/{iot:ClientId}`
- Subscribe permissions: `acorn-pups/settings/{iot:ClientId}`, `acorn-pups/commands/{iot:ClientId}`
- Creates IAM role for IoT Rules execution with Lambda invoke permissions

### 3. **IoT Rules Stack** (`IotRulesStack`)
- **Button Press Rule**: Routes `acorn-pups/button-press/+` to `handleButtonPress` Lambda
- **REMOVED**: Device Status Rule - status is now pulled by cloud rather than pushed by devices
- **REMOVED**: Device Reset Rule - reset handling now via HTTP registration API only
- **REMOVED**: Device Settings Acknowledgment Rule - simplified settings flow
- Error actions configured for CloudWatch Logs integration

### 4. **Certificate Management Stack** (`CertificateManagementStack`)
- **AWS IoT Core Managed Certificates**: Uses AWS IoT Core's built-in certificate generation
- **S3 Bucket**: Secure storage for device certificates and metadata
- **Amazon Root CA**: Provides Amazon Root CA 1 information for device configuration
- **Certificate Configuration**: Automated certificate generation using AWS CLI/SDK
- **IoT Endpoints**: AWS IoT Core endpoints for device connections
- **No CA Management**: Eliminates the overhead of managing custom Certificate Authority

### 5. **Monitoring Stack** (`MonitoringStack`)
- CloudWatch Dashboard with device connectivity, message processing, and rule execution metrics
- CloudWatch Alarms for high error rates, connectivity issues

- Comprehensive monitoring for all IoT components

## Prerequisites

- Node.js >= 22.0.0
- AWS CDK v2 installed globally: `npm install -g aws-cdk`
- AWS CLI configured with appropriate permissions
- Existing Lambda functions deployed (from separate API stack)

## Required AWS Permissions

The deployment requires the following AWS permissions:
- IoT Core: Full access for Thing Types, Policies, Rules, and Certificates
- IAM: Role creation and policy management
- CloudWatch: Dashboard and alarm creation
- S3: Bucket creation and management
- Lambda: Function invocation permissions
- Systems Manager: Parameter Store read/write access

## Installation

1. **Clone the repository**
   ```powershell
   git clone <repository-url>
   cd acorn-pups-infra-iot
   ```

2. **Install dependencies**
   ```powershell
   npm install
   ```

3. **Configure AWS credentials**
   ```powershell
   aws configure
   ```

4. **Set environment variables**
   ```powershell
   $env:CDK_DEFAULT_ACCOUNT = "your-account-id"
   $env:CDK_DEFAULT_REGION = "us-east-1"
   ```

## Deployment

### Development Environment
```powershell
# Deploy all stacks to development
npm run deploy:dev

# Deploy specific stack
cdk deploy acorn-pups-iot-dev-thing-types --context environment=dev

# View differences before deployment
npm run diff:dev
```

### Production Environment
```powershell
# Deploy all stacks to production
npm run deploy:prod

# Deploy specific stack
cdk deploy acorn-pups-iot-prod-policies --context environment=prod

# View differences before deployment
npm run diff:prod
```

## Stack Dependencies

The stacks have the following deployment order dependencies:

1. **Certificate Management Stack** (independent)
2. **IoT Thing Type Stack** (independent)
3. **IoT Policy Stack** (depends on Thing Type Stack)
4. **IoT Rules Stack** (depends on Policy and Certificate stacks)
5. **Monitoring Stack** (depends on Thing Type and Rules stacks)

## Parameter Store Integration

All stack outputs are automatically stored in AWS Systems Manager Parameter Store for cross-stack integration:

### Thing Type Parameters
- `/acorn-pups/{environment}/iot-core/thing-type/arn`
- `/acorn-pups/{environment}/iot-core/thing-type/name`
- `/acorn-pups/{environment}/iot-core/thing-type/description`

### Policy Parameters
- `/acorn-pups/{environment}/iot-core/device-policy/arn`
- `/acorn-pups/{environment}/iot-core/device-policy/name`
- `/acorn-pups/{environment}/iot-core/client-id-pattern`

### Rules Parameters
- `/acorn-pups/{environment}/iot-core/rules/{ruleName}/arn`
- `/acorn-pups/{environment}/iot-core/rules/{ruleName}/name`
- `/acorn-pups/{environment}/iot-core/rule-topics`

### Certificate Parameters
- `/acorn-pups/{environment}/iot-core/certificate-bucket/name`
- `/acorn-pups/{environment}/iot-core/certificate-type` (AWS_MANAGED)
- `/acorn-pups/{environment}/iot-core/certificate-config`
- `/acorn-pups/{environment}/iot-core/amazon-root-ca`

### IoT Core Endpoints
- `/acorn-pups/{environment}/iot-core/endpoint`
- `/acorn-pups/{environment}/iot-core/data-endpoint`

## Integration with Lambda Functions

The IoT Rules read Lambda function ARNs from Parameter Store:
- `/acorn-pups/{environment}/lambda-functions/handleButtonPress/arn`
- `/acorn-pups/{environment}/lambda-functions/updateDeviceStatus/arn`
- `/acorn-pups/{environment}/lambda-functions/resetDevice/arn`

Ensure these parameters exist before deploying the IoT Rules stack.

## MQTT Topics

The infrastructure supports the following MQTT topic patterns:

| Topic Pattern | Direction | Purpose |
|---------------|-----------|---------|
| `acorn-pups/button-press/{deviceId}` | Device → Cloud | Button press events |
| `acorn-pups/status-request/{deviceId}` | Cloud → Device | Status request from cloud |
| `acorn-pups/status-response/{deviceId}` | Device → Cloud | Status response from device |
| `acorn-pups/settings/{deviceId}` | Cloud → Device | Device configuration |
| `acorn-pups/commands/{deviceId}` | Cloud → Device | Device commands |


## Device Registration Flow

1. **Certificate Generation**: Create AWS IoT Core managed certificates
   ```bash
   aws iot create-keys-and-certificate --set-as-active
   ```
2. **Thing Creation**: Register device as IoT Thing with attributes
   ```bash
   aws iot create-thing --thing-name <deviceId> --thing-type-name AcornPupsDevice-dev
   ```
3. **Policy Attachment**: Attach device policy to certificate
   ```bash
   aws iot attach-policy --policy-name AcornPupsDevicePolicy-dev --target <certificateArn>
   ```
4. **Principal Attachment**: Attach certificate to Thing
   ```bash
   aws iot attach-thing-principal --thing-name <deviceId> --principal <certificateArn>
   ```
5. **Device Configuration**: Configure device with certificates and Amazon Root CA
6. **MQTT Connection**: Device connects using certificate and client ID pattern

## Monitoring and Observability

### CloudWatch Dashboard
- **Device Connectivity**: Connection success/failure rates
- **Message Processing**: MQTT message throughput
- **Rule Execution**: IoT Rule processing metrics


### CloudWatch Alarms
- **High Error Rate**: >5% rule execution failures
- **Device Connectivity**: >10 failed connections in 5 minutes

## Security Considerations

### Device Security
- AWS IoT Core managed X.509 certificates per device
- Device-specific topic access only
- Client ID pattern enforcement: `acorn-esp32-*`
- Thing attachment requirement for connections
- Amazon Root CA 1 for certificate validation

### Network Security
- MQTT over TLS 1.2
- Certificate-based authentication
- Minimal IAM permissions
- Encrypted S3 bucket for certificate storage

## Development

### Building
```powershell
npm run build
```

### Testing
```powershell
npm test
npm run test:watch
```

### Linting and Formatting
```powershell
# Check for linting errors
npm run build

# Watch for changes
npm run watch
```

## Troubleshooting

### Common Issues

1. **Lambda ARN Parameters Missing**
   - Ensure API infrastructure is deployed first
   - Verify Parameter Store paths match expected format

2. **Certificate Management Errors**
   - Use AWS IoT Core managed certificates
   - Verify S3 bucket permissions for certificate storage

3. **IoT Rule Failures**
   - Check CloudWatch Logs for error details
   - Verify IAM role permissions for Lambda invocation

4. **Device Connection Issues**
   - Verify client ID matches pattern `acorn-esp32-*`
   - Check certificate validity and Thing attachment

### Debugging

1. **Check Parameter Store**
   ```powershell
   aws ssm get-parameters-by-path --path "/acorn-pups/dev/iot-core" --recursive
   ```

2. **View CloudWatch Logs**
   ```powershell
   aws logs describe-log-groups --log-group-name-prefix "/aws/iot/rules"
   ```

3. **Test IoT Rules**
```powershell
# Test button press rule
aws iot publish --topic "acorn-pups/button-press/test-device" --payload '{"deviceId": "test-device", "timestamp": "2024-01-01T12:00:00Z"}'

# Test status request (cloud requests device status)
aws iot publish --topic "acorn-pups/status-request/test-device" --payload '{"requestId": "req-123", "timestamp": "2024-01-01T12:00:00Z"}'

# Test status response (device responds with status)
aws iot publish --topic "acorn-pups/status-response/test-device" --payload '{"deviceId": "test-device", "statusType": "CURRENT", "timestamp": "2024-01-01T12:00:00Z", "isOnline": true, "firmwareVersion": "1.0.0"}'
```

## Environment Configuration

The infrastructure supports two environments:

### Development (`dev`)
- Debug logging enabled
- Detailed monitoring
- 365-day certificate expiration
- CloudWatch error destinations

### Production (`prod`)
- Info logging
- Detailed monitoring
- 730-day certificate expiration
- CloudWatch error destinations
- S3 bucket retention policy

## Cleanup

To remove all resources:

```powershell
# Development
npm run destroy:dev

# Production
npm run destroy:prod
```

**Note**: S3 buckets in production are retained by default and must be manually deleted.



*This infrastructure integrates with the Acorn Pups API and database stacks to provide a complete IoT device management solution.*