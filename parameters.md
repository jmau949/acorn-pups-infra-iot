# Acorn Pups Infrastructure Parameters

This document lists all Parameter Store parameters used and created by this repository.

## Parameter Store Path Structure

```
/acorn-pups/{environment}/
├── cfn-outputs/           # CloudFormation outputs (API repo)
├── iot-outputs/           # IoT CloudFormation outputs (IoT repo)
├── lambda-functions/      # Lambda function ARNs and roles (API repo)
│   ├── {function-name}/arn
│   ├── base-role/arn           # Basic Lambda functions
│   ├── iot-device-mgmt-role/arn # Device registration/reset
│   ├── iot-comm-role/arn        # Device settings/communication
│   ├── notification-role/arn    # Push notifications/emails
│   └── execution-role/arn       # Legacy (points to base-role)
├── iot-core/             # IoT Core resources
├── rf-buttons/           # RF button information
└── device-architecture/  # Device architecture info
```

## Lambda Role Architecture (API Repository)

The API repository now uses granular IAM roles instead of a single execution role:

### **IoT Device Management Role** (`iot-device-mgmt-role`)
- **Used by**: `register-device`, `reset-device`
- **Permissions**: Full IoT certificate and Thing management, S3 certificate backup, DynamoDB access
- **Parameter Path**: `/acorn-pups/{environment}/lambda-functions/iot-device-mgmt-role/arn`

### **IoT Communication Role** (`iot-comm-role`)
- **Used by**: `update-device-settings`
- **Permissions**: IoT publish to device topics, DynamoDB access
- **Parameter Path**: `/acorn-pups/{environment}/lambda-functions/iot-comm-role/arn`

### **Notification Role** (`notification-role`)
- **Used by**: `handle-button-press`, `invite-user`
- **Permissions**: SNS publish, SES email sending, DynamoDB access
- **Parameter Path**: `/acorn-pups/{environment}/lambda-functions/notification-role/arn`

### **Base Lambda Role** (`base-role`)
- **Used by**: `update-device-status`, `get-user-devices`, `health-check`, user management functions
- **Permissions**: DynamoDB access, Parameter Store access only
- **Parameter Path**: `/acorn-pups/{environment}/lambda-functions/base-role/arn`

### **Legacy Compatibility**
- **Parameter Path**: `/acorn-pups/{environment}/lambda-functions/execution-role/arn`
- **Note**: Points to `base-role` for backward compatibility

## IoT Infrastructure Repository

### Parameters **REQUIRED** by this repository (from API repo):
- `/acorn-pups/{environment}/lambda-functions/handleButtonPress/arn` - ✅ **EXISTS** (uses notification-role)
- `/acorn-pups/{environment}/lambda-functions/updateDeviceStatus/arn` - ✅ **EXISTS** (uses base-role)
- `/acorn-pups/{environment}/lambda-functions/resetDevice/arn` - ✅ **EXISTS** (uses iot-device-mgmt-role)
- `/acorn-pups/{environment}/lambda-functions/updateDeviceSettings/arn` - ✅ **EXISTS** (uses iot-comm-role)

### Role-to-Function Mapping:
- **Button Press Events** → `handle-button-press` → **notification-role** → SNS notifications
- **Device Status Updates** → `update-device-status` → **base-role** → DynamoDB only
- **Device Reset Commands** → `reset-device` → **iot-device-mgmt-role** → Full IoT cleanup
- **Settings Updates** → `update-device-settings` → **iot-comm-role** → IoT publish + DB

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

#### Certificate Management (`/acorn-pups/{environment}/iot-core/`)
- `certificate-bucket/name` - S3 bucket for certificate backup storage
- `certificate-bucket/arn` - ARN of the S3 bucket for certificates
- `endpoint` - AWS IoT Core endpoint for certificate management
- `data-endpoint` - AWS IoT Core data endpoint for ESP32 receiver connections
- `certificate-type` - Certificate type (AWS_MANAGED)
- `certificate-expiration-days` - Certificate validity period
- `receiver-certificate-config` - ESP32 receiver certificate configuration
- `api-certificate-generation-workflow` - **UPDATED**: Now references `iot-device-mgmt-role`
- `device-reset-certificate-cleanup` - **UPDATED**: Now references `iot-device-mgmt-role`
- `lambda-role-mapping` - **NEW**: Complete mapping of Lambda functions to their specific roles

#### Rules Stack (`/acorn-pups/{environment}/iot-core/`)
- `rules/{rule-name}/arn` - ARNs of all IoT Rules
- `rules/{rule-name}/name` - Names of all IoT Rules
- `lambda-function-requirements` - **UPDATED**: Now includes role mapping for each function
- `api-rule-integration` - **UPDATED**: Complete integration mapping with granular roles
- `rule-topics` - MQTT topics monitored by IoT Rules
- `log-group-prefix` - CloudWatch Log Group prefix for IoT Rules

#### Monitoring Stack (`/acorn-pups/{environment}/iot-outputs/monitoring/`)
- `iot-dashboard-name` - IoT CloudWatch Dashboard name
- `iot-dashboard-url` - IoT CloudWatch Dashboard URL
- `iot-alarm-topic-arn` - IoT SNS Topic ARN for alarms
- `iot-alarm-topic-name` - IoT SNS Topic name for alarms

## Updated Parameters for Granular Roles

The following parameters have been updated to utilize the new granular role structure:

### Certificate Generation Workflows
- **Parameter**: `/acorn-pups/{environment}/iot-core/api-certificate-generation-workflow`
- **Change**: Now references `iot-device-mgmt-role` instead of generic `execution-role`
- **Reason**: Device registration requires full IoT certificate and Thing management permissions

### Device Reset Workflows  
- **Parameter**: `/acorn-pups/{environment}/iot-core/device-reset-certificate-cleanup`
- **Change**: Now references `iot-device-mgmt-role` instead of generic `execution-role`
- **Reason**: Device reset requires full IoT cleanup including certificate deletion

### Lambda Function Requirements
- **Parameter**: `/acorn-pups/{environment}/iot-core/lambda-function-requirements`
- **Enhancement**: Added role mapping showing which Lambda functions use which specific roles
- **Benefits**: Clear visibility into permission boundaries for each function

### API Integration Mapping
- **Parameter**: `/acorn-pups/{environment}/iot-core/api-rule-integration`
- **Enhancement**: Complete integration flows with role-specific permissions
- **Benefits**: End-to-end visibility from API endpoints to device interactions

## Migration Notes

### Backward Compatibility
- Legacy parameter `/acorn-pups/{environment}/lambda-functions/execution-role/arn` still exists
- Points to `base-role` for backward compatibility
- Existing IoT rules continue to work without changes

### Security Improvements
- **Principle of Least Privilege**: Each Lambda function now has only the permissions it needs
- **Reduced Attack Surface**: Functions without IoT operations cannot perform IoT actions
- **Clear Audit Trail**: Role assignments clearly show which functions can perform which operations

### Deployment Order
1. **Deploy API repository first**: Creates all Lambda functions with granular roles
2. **Deploy IoT repository second**: References the specific roles created in step 1

---