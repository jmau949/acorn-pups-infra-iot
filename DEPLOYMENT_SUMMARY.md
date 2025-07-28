# Acorn Pups IoT Infrastructure - Deployment Summary

## Project Overview
AWS CDK Infrastructure for Acorn Pups IoT Core components and device management with enhanced security features.

## Recent Updates (Updated for Device Instance ID Security)

### ✅ Enhanced Security Architecture
- **Device Instance ID Security**: Added `device_instance_id` field for reset security tracking
- **HTTP-Based Reset**: Eliminated MQTT reset complexity in favor of HTTP registration API
- **Echo/Nest Pattern**: Implemented industry-standard reset validation approach
- **Physical Access Required**: Only physical reset button can generate new instance ID

### ✅ Simplified Topic Structure
- **Removed MQTT Reset Topics**: Eliminated `acorn-pups/reset/+` and related reset logic
- **Streamlined Rules**: Reduced from 5 IoT rules to 1 core rule (button press only)
- **Simplified Settings Flow**: Removed settings acknowledgment rule for cleaner architecture
- **Status Pull Model**: Devices subscribe to `acorn-pups/status-request/{deviceId}` and respond via `acorn-pups/status-response/{deviceId}`

### ✅ Updated Lambda Function Mappings
- **Added Cognito Post-Confirmation**: Support for automatic user creation after email verification
- **Removed Reset Functions**: `resetDevice` and `factoryReset` functions removed (now handled via HTTP API)
- **Updated Role Mapping**: Enhanced role structure with device instance ID security validation

### ✅ Certificate Management Updates
- **Reset Validation**: Enhanced certificate cleanup with device instance ID validation
- **Ownership Transfer**: Automatic cleanup when legitimate reset is detected
- **Security Prevention**: Prevents remote takeover attacks through instance ID verification

## Current Stack Structure

### 1. Certificate Management Stack (`certificate-management-stack.ts`)
- **S3 Bucket**: Certificate storage and backup
- **Enhanced API Workflow**: Device registration with reset security validation
- **Role Documentation**: Updated Lambda role mappings with device instance ID security
- **Security Best Practices**: Instance ID-based reset validation

### 2. IoT Thing Type Stack (`iot-thing-type-stack.ts`)
- **Receiver Thing Type**: ESP32-based smart receivers
- **Searchable Attributes**: deviceName, serialNumber, macAddress
- **Device Architecture Info**: Documentation for receivers vs RF buttons

### 3. IoT Rules Stack (`iot-rules-stack.ts`) - **UPDATED**
- **Button Press Rule**: Routes RF button events to `handleButtonPress` Lambda
- **REMOVED**: Device Status Rule - status now pulled by cloud rather than pushed by devices
- **REMOVED**: Factory reset rule, device reset rule, settings acknowledgment rule
- **Simplified Configuration**: Only essential rules for core functionality
- **Status Pull Model**: Cloud requests device status via `acorn-pups/status-request/{deviceId}`

### 4. Monitoring Stack (`monitoring-stack.ts`)
- **CloudWatch Integration**: Monitors all IoT components
- **Rule Monitoring**: Tracks performance of remaining IoT rules

## Key Architecture Changes

### Device Instance ID Security Pattern
```typescript
// NEW: Device Instance ID for reset security
export interface DeviceRegistrationRequest {
  deviceId: string;
  deviceInstanceId: string; // UUID generated each factory reset cycle
  deviceName: string;
  serialNumber: string;
  macAddress: string;
  deviceState?: string; // "factory_reset" or "normal"
  resetTimestamp?: number; // When reset occurred
}
```

### Simplified MQTT Topic Structure
```typescript
// UPDATED: Status pull model instead of push
export const IOT_TOPIC_TEMPLATES: IotTopicTemplates = {
  buttonPress: 'acorn-pups/button-press/+',
  statusRequest: 'acorn-pups/status-request/+', // NEW: Cloud requests device status
  statusResponse: 'acorn-pups/status-response/+', // NEW: Device responds with status
  settings: 'acorn-pups/settings/+',
  commands: 'acorn-pups/commands/+',
  // REMOVED: Reset-related topics - now handled via HTTP API only
};
```

### Updated Lambda Function List
```typescript
// UPDATED: Removed reset functions, added Cognito post-confirmation
export const LAMBDA_FUNCTIONS = {
  // Button and device management
  handleButtonPress: 'handleButtonPress',
  updateDeviceStatus: 'updateDeviceStatus',
  registerDevice: 'registerDevice', // Enhanced with reset validation
  updateDeviceSettings: 'updateDeviceSettings',
  
  // User management and invitations
  cognitoPostConfirmation: 'cognitoPostConfirmation', // NEW
  inviteUser: 'inviteUser',
  acceptInvitation: 'acceptInvitation',
  declineInvitation: 'declineInvitation',
  removeUserAccess: 'removeUserAccess',
  
  // Data retrieval
  getUserDevices: 'getUserDevices',
  getUserInvitations: 'getUserInvitations',
  healthCheck: 'healthCheck',
  
  // REMOVED: resetDevice, factoryReset
};
```

## Deployment Commands

```bash
# Development Environment
npm run deploy:dev

# Production Environment  
npm run deploy:prod

# Synthesis Check
npm run synth

# Clean Build
npm run build
```

## Environment Variables Required
- `CDK_DEFAULT_ACCOUNT`: AWS Account ID
- `CDK_DEFAULT_REGION`: AWS Region (default: us-east-1)

## Parameter Store Integration
All stack outputs are automatically stored in AWS Systems Manager Parameter Store with paths:
- `/acorn-pups/{environment}/iot-core/`
- `/acorn-pups/{environment}/lambda-functions/`

## Security Enhancements
1. **Device Instance ID**: Prevents remote takeover attacks
2. **Physical Reset Required**: Only physical access can generate new instance ID
3. **HTTP-Based Reset**: All reset handling via secure API endpoints
4. **Certificate Cleanup**: Automatic cleanup when legitimate reset detected
5. **Ownership Transfer**: Secure device ownership transfer after factory reset

## Dependencies
- **API Repository**: Lambda functions and IAM roles
- **Mobile App**: Consumes IoT infrastructure for device management
- **ESP32 Firmware**: Implements device instance ID security pattern

## Validation Status
✅ All stacks synthesize successfully  
✅ TypeScript compilation passes  
✅ Security architecture updated  
✅ Documentation aligned with implementation 