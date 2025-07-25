

```
acorn-pups-infra-iot:
├── IoT Rules ✅
├── Thing Types ✅
├── Monitoring ✅
└── S3 Bucket (certificate backups) ✅

acorn-pups-infra-api:
├── Lambda Functions ✅
├── IoT Policies ✅ (moved here)
├── Certificate Lifecycle Management ✅
├── IoT Rule Execution Role ✅ (moved here)
└── API Gateway ✅
```

## What Was Moved

### From IoT Repository to API Repository

1. **IoT Policy Stack** (`lib/iot-policy-stack.ts`)
   - `AcornPupsReceiverPolicy` - Device security policy
   - IoT Rule Execution Role - For IoT rules to invoke Lambda functions
   - Policy parameter store entries
   - CloudFormation outputs

2. **IoT Core Constants** (`IOT_CLIENT_ID_PATTERN`)

3. **Related Type Definitions** (`IotPolicyStackProps`)

### Updated in IoT Repository

1. **IoT Rules Stack** (`lib/iot-rules-stack.ts`)
   - Now reads IoT Rule Execution Role ARN from Parameter Store
   - Removed direct dependency on IoT Policy Stack

2. **Main App** (`bin/app.ts`)
   - Removed IoT Policy Stack import and instantiation
   - Updated stack dependencies

3. **Type Definitions** (`lib/types.ts`)
   - Removed `roleArn` requirement from `IotRulesStackProps`

## New Deployment Order

### Cross-Repository Dependencies

```
1. acorn-pups-infra-db          (Database tables)
    ↓
2. acorn-pups-infra-cognito     (Authentication)
    ↓
3. acorn-pups-infra-api         (Lambda functions + IoT policies)
    ↓
4. acorn-pups-infra-iot         (IoT rules + monitoring)
```

### Within API Repository

```
1. IoT Policy Stack             (Policies + Rule execution role)
    ↓
2. Lambda Functions Stack       (Depends on IoT policies for device management)
    ↓
3. API Gateway Stack            (Routes to Lambda functions)
    ↓
4. Monitoring Stack             (Monitors API and Lambda functions)
```

### Within IoT Repository

```
1. Certificate Management Stack (S3 bucket + configuration)
2. IoT Thing Type Stack         (Device schemas)
    ↓
3. IoT Rules Stack              (References role from API repository)
    ↓
4. Monitoring Stack             (Monitors IoT rules)
```

## Parameter Store Integration

### API Repository Creates

- `/acorn-pups/{environment}/iot-core/receiver-policy/arn`
- `/acorn-pups/{environment}/iot-core/receiver-policy/name`
- `/acorn-pups/{environment}/iot-core/rule-execution-role/arn`
- `/acorn-pups/{environment}/iot-core/rule-execution-role/name`
- `/acorn-pups/{environment}/iot-core/mqtt-topics`
- `/acorn-pups/{environment}/iot-core/security-config`
- `/acorn-pups/{environment}/iot-core/api-integration`

### IoT Repository Consumes

- `/acorn-pups/{environment}/iot-core/rule-execution-role/arn` (for IoT rules)
- `/acorn-pups/{environment}/lambda-functions/*/arn` (for Lambda targets)

## Benefits of This Structure

### 1. Clean Dependency Management
- No circular dependencies between repositories
- Each repository can be deployed and destroyed independently
- Clear ownership of related resources

### 2. Lifecycle Alignment
- IoT policies and certificates have the same lifecycle
- Certificate cleanup automatically handles policy detachment
- Device registration/reset is atomic and consistent

### 3. Security Consistency
- Device security managed in one place
- Certificate and policy operations use same IAM roles
- Easier to audit and maintain security policies

### 4. Operational Simplicity
- Deploy/destroy operations work cleanly
- No manual cleanup required between deployments
- Easier troubleshooting and debugging

## Migration Steps Performed

1. ✅ **Created IoT Policy Stack in API Repository**
   - Moved complete policy and role definitions
   - Added Parameter Store integration
   - Updated CloudFormation outputs

2. ✅ **Updated IoT Repository Dependencies**
   - Modified IoT Rules Stack to read role ARN from Parameter Store
   - Removed IoT Policy Stack completely
   - Updated type definitions and dependencies

3. ✅ **Updated Documentation**
   - Updated deployment guides in both repositories
   - Created IoT management documentation in API repository
   - Updated README files with new architecture

4. ✅ **Verified Integration**
   - Parameter Store paths aligned between repositories
   - IAM permissions correctly scoped
   - CloudFormation dependencies properly ordered

## Deployment Instructions

### First-Time Deployment

```powershell
# 1. Deploy database infrastructure
cd ../acorn-pups-infra-db
cdk deploy --all --context environment=dev

# 2. Deploy authentication infrastructure  
cd ../acorn-pups-infra-cognito
cdk deploy --all --context environment=dev

# 3. Deploy API infrastructure (includes IoT policies)
cd ../acorn-pups-infra-api
cdk deploy --all --context environment=dev

# 4. Deploy IoT infrastructure (rules and monitoring)
cd ../acorn-pups-infra-iot
cdk deploy --all --context environment=dev
```

### Existing Deployment Migration

If you have existing IoT stacks deployed:

```powershell
# 1. Destroy existing IoT repository stacks (this will work cleanly now)
cd acorn-pups-infra-iot
cdk destroy --all --context environment=dev --force

# 2. Deploy API repository with new IoT policies
cd ../acorn-pups-infra-api
git pull  # Get updated code with IoT policies
cdk deploy --all --context environment=dev

# 3. Redeploy IoT repository with updated dependencies
cd ../acorn-pups-infra-iot
git pull  # Get updated code without IoT policies
cdk deploy --all --context environment=dev
```

## Verification Steps

After migration, verify the system works correctly:

### 1. Check Parameter Store

```powershell
# Verify IoT policy parameters exist (created by API repo)
aws ssm get-parameter --name "/acorn-pups/dev/iot-core/receiver-policy/arn"
aws ssm get-parameter --name "/acorn-pups/dev/iot-core/rule-execution-role/arn"

# Verify Lambda function parameters exist (created by API repo)
aws ssm get-parameter --name "/acorn-pups/dev/lambda-functions/handleButtonPress/arn"
```

### 2. Check IoT Resources

```powershell
# Verify IoT policy exists (created by API repo)
aws iot get-policy --policy-name "AcornPupsReceiverPolicy-dev"

# Verify IoT rules exist (created by IoT repo)
aws iot list-topic-rules --topic "acorn-pups"
```

### 3. Test Device Registration

```powershell
# Test device registration API (should create certificate and attach policy)
curl -X POST https://api-dev.acornpups.com/devices/register \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"test-device","deviceName":"Test Device","serialNumber":"TEST001","macAddress":"AA:BB:CC:DD:EE:FF"}'
```

## Troubleshooting

### Parameter Not Found Errors

If IoT Rules deployment fails with parameter not found:

1. Verify API repository is deployed first
2. Check parameter paths exactly match:
   - `/acorn-pups/{environment}/iot-core/rule-execution-role/arn`
   - `/acorn-pups/{environment}/lambda-functions/{functionName}/arn`

### IoT Policy Not Found

If device registration fails:

1. Verify API repository created the IoT policy
2. Check policy name matches: `AcornPupsReceiverPolicy-{environment}`

### Clean Slate Deployment

To start completely fresh:

```powershell
# Destroy all stacks in reverse order
cd acorn-pups-infra-iot && cdk destroy --all --context environment=dev --force
cd ../acorn-pups-infra-api && cdk destroy --all --context environment=dev --force
cd ../acorn-pups-infra-cognito && cdk destroy --all --context environment=dev --force
cd ../acorn-pups-infra-db && cdk destroy --all --context environment=dev --force

# Deploy in correct order
cd acorn-pups-infra-db && cdk deploy --all --context environment=dev
cd ../acorn-pups-infra-cognito && cdk deploy --all --context environment=dev
cd ../acorn-pups-infra-api && cdk deploy --all --context environment=dev
cd ../acorn-pups-infra-iot && cdk deploy --all --context environment=dev
```

## Summary

This restructure resolves the circular dependency issue and provides a clean separation of concerns:

- **API Repository**: Manages device lifecycle (certificates, policies, registration/reset)
- **IoT Repository**: Manages message routing and monitoring (rules, thing types, dashboards)

The new structure enables clean deployment and destruction cycles while maintaining all existing functionality.

---

*For questions about this restructure, refer to the updated documentation in each repository or create a GitHub issue.* 