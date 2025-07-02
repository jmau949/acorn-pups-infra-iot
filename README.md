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
- **Device Status Rule**: Routes `acorn-pups/status/+` to `updateDeviceStatus` Lambda  
- **Device Reset Rule**: Routes `acorn-pups/commands/+/reset` to `resetDevice` Lambda
- **Shadow Update Rule**: Routes device shadow updates for offline state management
- **Heartbeat Rule**: Routes device heartbeat for connectivity monitoring
- Error actions configured for CloudWatch Logs integration

### 4. **Certificate Management Stack** (`CertificateManagementStack`)
- S3 bucket for storing certificates and CA materials
- CA certificate management (placeholder for manual setup in production)
- Certificate templates for device registration
- Security configurations for device certificates

### 5. **Monitoring Stack** (`MonitoringStack`)
- CloudWatch Dashboard with device connectivity, message processing, and rule execution metrics
- CloudWatch Alarms for high error rates, connectivity issues, and low battery
- Custom metrics for device heartbeat and button press monitoring
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
- `/acorn-pups/{environment}/iot-core/ca-certificate/arn`
- `/acorn-pups/{environment}/iot-core/certificate-bucket/name`
- `/acorn-pups/{environment}/iot-core/certificate-template/template`

### IoT Core Endpoints
- `/acorn-pups/{environment}/iot-core/endpoint-url`
- `/acorn-pups/{environment}/iot-core/data-endpoint-url`

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
| `acorn-pups/status/{deviceId}` | Device → Cloud | Device status updates |
| `acorn-pups/settings/{deviceId}` | Cloud → Device | Device configuration |
| `acorn-pups/commands/{deviceId}` | Cloud → Device | Device commands |
| `acorn-pups/heartbeat/{deviceId}` | Device → Cloud | Connectivity monitoring |

## Device Registration Flow

1. **Device Setup**: ESP32 enters configuration mode
2. **Certificate Generation**: Lambda creates device certificate using CA
3. **Thing Creation**: Device registered as IoT Thing with policy attachment
4. **Parameter Storage**: Device information stored in Parameter Store
5. **MQTT Connection**: Device connects using certificate and client ID pattern

## Monitoring and Observability

### CloudWatch Dashboard
- **Device Connectivity**: Connection success/failure rates
- **Message Processing**: MQTT message throughput
- **Rule Execution**: IoT Rule processing metrics
- **Custom Metrics**: Device heartbeat and button press tracking

### CloudWatch Alarms
- **High Error Rate**: >5% rule execution failures
- **Device Connectivity**: >10 failed connections in 5 minutes
- **No Heartbeat**: Missing device heartbeat for 15 minutes
- **Low Battery**: Device battery <20%

## Security Considerations

### Device Security
- Unique X.509 certificates per device
- Device-specific topic access only
- Client ID pattern enforcement: `acorn-esp32-*`
- Thing attachment requirement for connections

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
   - Manual CA certificate setup required for production
   - Verify S3 bucket permissions

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
   aws iot publish --topic "acorn-pups/button-press/test-device" --payload '{"test": true}'
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