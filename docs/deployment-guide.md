# Acorn Pups IoT Infrastructure Deployment Guide

This guide provides step-by-step instructions for deploying the Acorn Pups IoT infrastructure using AWS CDK.

## Repository Structure

The Acorn Pups IoT infrastructure is split across multiple repositories to maintain clean separation of concerns:

1. **acorn-pups-infra-db** - Database tables and core data infrastructure
2. **acorn-pups-infra-cognito** - Authentication and user management
3. **acorn-pups-infra-api** - Lambda functions, API Gateway, and **IoT policies**
4. **acorn-pups-infra-iot** - IoT rules, thing types, and monitoring (this repository)

**Important**: IoT policies and device management are now handled in the API repository alongside certificate generation to avoid circular dependencies.

## Prerequisites Checklist

Before deploying, ensure you have:

- [ ] **Node.js** 22.0.0 or higher installed
- [ ] **AWS CDK** v2 installed globally (`npm install -g aws-cdk`)
- [ ] **AWS CLI** configured with appropriate credentials
- [ ] **PowerShell** (for Windows deployment scripts)
- [ ] **Database Infrastructure** deployed first (acorn-pups-infra-db)
- [ ] **Cognito Infrastructure** deployed second (acorn-pups-infra-cognito)
- [ ] **API Infrastructure** deployed third (acorn-pups-infra-api) - contains IoT policies

## Pre-Deployment Setup

### 1. Clone and Setup Repository

```powershell
git clone <repository-url>
cd acorn-pups-infra-iot
npm install
```

### 2. Configure AWS Environment

```powershell
# Configure AWS credentials
aws configure

# Set environment variables
$env:CDK_DEFAULT_ACCOUNT = "your-account-id"
$env:CDK_DEFAULT_REGION = "us-east-1"  # or your preferred region
```

### 3. Verify Prerequisites

```powershell
# Check versions
node --version    # Should be >= v22.0.0
cdk --version     # Should be >= 2.100.0
aws --version     # Should be >= 2.0.0

# Test AWS access
aws sts get-caller-identity
```

### 4. Validate Existing Infrastructure

This IoT repository requires the API infrastructure to be deployed first. Verify these Parameter Store entries exist:

```powershell
# Lambda function ARNs (created by API repository)
aws ssm get-parameter --name "/acorn-pups/dev/lambda-functions/handleButtonPress/arn"
aws ssm get-parameter --name "/acorn-pups/dev/lambda-functions/updateDeviceStatus/arn"
aws ssm get-parameter --name "/acorn-pups/dev/lambda-functions/resetDevice/arn"
aws ssm get-parameter --name "/acorn-pups/dev/lambda-functions/factoryReset/arn"

# IoT policy and rule execution role (created by API repository)
aws ssm get-parameter --name "/acorn-pups/dev/iot-core/receiver-policy/arn"
aws ssm get-parameter --name "/acorn-pups/dev/iot-core/rule-execution-role/arn"
```

If these don't exist, deploy the API infrastructure first.

## Deployment Methods

### Method 1: Using PowerShell Script (Recommended)

The repository includes a comprehensive PowerShell deployment script with validation and error handling.

#### Development Environment
```powershell
# Full deployment with interactive confirmation
.\scripts\deploy.ps1 -Environment dev

# Force deployment without prompts
.\scripts\deploy.ps1 -Environment dev -Force

# Dry run to see what would be deployed
.\scripts\deploy.ps1 -Environment dev -DryRun

# Deploy specific stack
.\scripts\deploy.ps1 -Environment dev -StackName thing-types
```

#### Production Environment
```powershell
# Production deployment (requires additional confirmation)
.\scripts\deploy.ps1 -Environment prod

# View differences before deploying
.\scripts\deploy.ps1 -Environment prod -Action diff
```

### Method 2: Direct CDK Commands

For more control, use CDK commands directly:

```powershell
# Build the project
npm run build

# Synthesize CloudFormation templates
cdk synth --context environment=dev

# Deploy all stacks
cdk deploy --all --context environment=dev

# Deploy specific stack
cdk deploy acorn-pups-iot-dev-thing-types --context environment=dev
```

## Deployment Order

The complete system should be deployed in this order across repositories:

### Cross-Repository Deployment Order
1. **acorn-pups-infra-db** - Database tables
2. **acorn-pups-infra-cognito** - Authentication
3. **acorn-pups-infra-api** - Lambda functions and **IoT policies**
4. **acorn-pups-infra-iot** - IoT rules and monitoring (this repository)

### This Repository Stack Order
1. **Certificate Management Stack** (S3 bucket and configuration)
2. **IoT Thing Type Stack** (ESP32 receiver thing types)
3. **IoT Rules Stack** (MQTT message routing rules)
4. **Monitoring Stack** (CloudWatch dashboards and alarms)

The deployment scripts handle these dependencies automatically.

## Stack Details

### Certificate Management Stack
- **Resources**: S3 bucket for certificate backups, configuration parameters
- **Dependencies**: None
- **Outputs**: Certificate bucket name/ARN, IoT endpoints
- **Note**: Actual certificate generation is handled by API repository Lambda functions

### IoT Thing Type Stack  
- **Resources**: `AcornPupsReceiver` Thing Type with searchable attributes
- **Dependencies**: None
- **Outputs**: Thing Type name/ARN, searchable attributes

### IoT Rules Stack
- **Resources**: 5 IoT Rules for different message types
- **Dependencies**: Certificate Stack, Thing Type Stack, API repository (for Lambda ARNs and rule execution role)
- **Outputs**: Rule names/ARNs for all rules

### Monitoring Stack
- **Resources**: CloudWatch dashboard, 4 CloudWatch alarms
- **Dependencies**: Thing Type Stack, Rules Stack
- **Outputs**: Dashboard name/URL, alarm names/ARNs

**Note**: IoT policies are no longer managed in this repository. They are created in the API repository alongside the Lambda functions that manage device certificates.

## Post-Deployment Verification

### 1. Check Stack Status
```powershell
# View all stacks
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE

# Check specific stack
aws cloudformation describe-stacks --stack-name acorn-pups-iot-dev-thing-types
```

### 2. Verify Parameter Store Integration
```powershell
# List all IoT parameters
aws ssm get-parameters-by-path --path "/acorn-pups/dev/iot-core" --recursive

# Check specific parameter
aws ssm get-parameter --name "/acorn-pups/dev/iot-core/thing-type/arn"

# Verify API repository created the IoT policy
aws ssm get-parameter --name "/acorn-pups/dev/iot-core/receiver-policy/arn"
```

### 3. Test IoT Rules
```powershell
# Test button press rule
aws iot publish --topic "acorn-pups/button-press/test-device" --payload '{"deviceId": "test-device", "timestamp": "2024-01-01T12:00:00Z"}'

# Test status update rule  
aws iot publish --topic "acorn-pups/status/test-device" --payload '{"deviceId": "test-device", "status": "online", "firmwareVersion": "1.0.0"}'

# Test factory reset rule
aws iot publish --topic "acorn-pups/reset/test-device" --payload '{"command": "reset_cleanup", "deviceId": "test-device", "resetTimestamp": "2024-01-01T12:00:00Z", "oldCertificateArn": "arn:aws:iot:us-east-1:123456789012:cert/example", "reason": "physical_button_reset"}'
```

### 4. View CloudWatch Dashboard
Navigate to: `https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=AcornPupsIoT-dev`

### 5. Check CloudWatch Logs
```powershell
# View IoT Rule logs
aws logs describe-log-groups --log-group-name-prefix "/aws/iot/rules/AcornPups"

# View log streams
aws logs describe-log-streams --log-group-name "/aws/iot/rules/AcornPupsButtonPress_dev"
```

## Common Issues and Solutions

### Issue: Lambda ARN Parameters Not Found
**Symptom**: IoT Rules stack deployment fails with parameter not found errors.

**Solution**: 
1. Ensure API infrastructure is deployed first
2. Verify parameter paths match exactly:
   - `/acorn-pups/{environment}/lambda-functions/handleButtonPress/arn`
   - `/acorn-pups/{environment}/lambda-functions/updateDeviceStatus/arn`  
   - `/acorn-pups/{environment}/lambda-functions/resetDevice/arn`
   - `/acorn-pups/{environment}/lambda-functions/factoryReset/arn`

### Issue: IoT Rule Execution Role Not Found
**Symptom**: IoT Rules stack deployment fails with rule execution role parameter not found.

**Solution**:
1. Ensure API infrastructure is deployed first
2. Verify the API repository created the IoT rule execution role:
   ```powershell
   aws ssm get-parameter --name "/acorn-pups/dev/iot-core/rule-execution-role/arn"
   ```

### Issue: IoT Policy Not Found
**Symptom**: Device registration fails because IoT policy doesn't exist.

**Solution**:
1. The IoT policy is now created in the API repository, not this one
2. Verify the policy exists:
   ```powershell
   aws iot get-policy --policy-name "AcornPupsReceiverPolicy-dev"
   ```
3. If missing, redeploy the API repository

### Issue: Certificate Management Stack Errors
**Symptom**: Certificate stack fails to deploy or configuration issues.

**Solution**:
- This stack only creates S3 bucket and configuration parameters
- Actual certificate generation is handled by API repository Lambda functions
- For issues with certificate generation, check the API repository logs

### Issue: CloudWatch Dashboard Empty
**Symptom**: Dashboard shows no data despite device activity.

**Solution**:
1. Verify IoT Rules are enabled and processing messages
2. Check CloudWatch Logs for rule execution errors
3. Ensure custom metrics are being published correctly
4. Allow 5-10 minutes for metrics to appear

## Security Considerations

### Development Environment
- Use separate AWS account or isolated region
- Shorter certificate expiration (365 days)
- More verbose logging for debugging

### Production Environment
- Longer certificate expiration (730 days)
- S3 bucket retention policies enabled
- Minimal logging for performance
- Consider additional IAM restrictions

### Device Security
- Each device gets unique X.509 certificate (managed by API repository)
- Client ID must match pattern `acorn-pups-*`
- Device can only access its own topics (`{iot:ClientId}`)
- Certificate must be attached to Thing for connection
- IoT policies enforce device-scoped permissions

## Monitoring and Maintenance

### CloudWatch Alarms
- **High Error Rate**: >5% rule execution failures
- **Device Connectivity**: >10 failed connections in 5 minutes  

### Regular Maintenance Tasks
1. **Monthly**: Review CloudWatch metrics and logs
2. **Quarterly**: Update certificate expiration dates (via API repository)
3. **Annually**: Review and update security policies (in API repository)
4. **As Needed**: Scale monitoring thresholds based on fleet size

### Cost Optimization
- Monitor AWS IoT Core message costs
- Set CloudWatch log retention policies
- Use CloudWatch Insights for log analysis
- Consider S3 lifecycle policies for certificates

## Rollback Procedures

### Development Environment
```powershell
# Destroy all stacks in this repository
.\scripts\deploy.ps1 -Environment dev -Action destroy -Force

# Or use CDK directly
cdk destroy --all --context environment=dev --force
```

### Production Environment
```powershell
# Careful rollback with confirmation
.\scripts\deploy.ps1 -Environment prod -Action destroy

# Manual verification before proceeding
aws cloudformation list-stacks --query 'StackSummaries[?contains(StackName, `acorn-pups-iot-prod`)].{Name:StackName,Status:StackStatus}'
```

**Note**: 
- S3 buckets in production are retained by default and must be manually deleted
- IoT policies are managed in the API repository and must be cleaned up there
- Destroying this repository does not affect device certificates or policies

## Troubleshooting Commands

```powershell
# Check CDK diff before deployment
cdk diff --all --context environment=dev

# View CloudFormation events
aws cloudformation describe-stack-events --stack-name acorn-pups-iot-dev-rules

# Check IoT Core connectivity
aws iot describe-endpoint --endpoint-type iot:Data-ATS

# List IoT Things
aws iot list-things --thing-type-name AcornPupsReceiver-dev

# Check IoT policies (managed in API repository)
aws iot list-policies --query 'policies[?contains(policyName, `AcornPupsReceiver`)].{Name:policyName,Arn:policyArn}'

# Test MQTT connection
aws iot test-invoke-authorizer --authorizer-name your-authorizer --token your-token
```

## Support and Documentation

- **AWS CDK Documentation**: https://docs.aws.amazon.com/cdk/
- **AWS IoT Core Documentation**: https://docs.aws.amazon.com/iot/
- **CloudWatch Documentation**: https://docs.aws.amazon.com/cloudwatch/
- **Project Issues**: Create GitHub issues for bugs and feature requests

---

*This deployment guide provides comprehensive instructions for deploying and managing the Acorn Pups IoT infrastructure. Always test in development before deploying to production.* 

## Certificate Management

### AWS IoT Core Managed Certificates

The infrastructure uses AWS IoT Core's built-in certificate generation, which is handled entirely by the API repository Lambda functions.

#### Certificate Generation Process (API Repository)

The API repository handles all certificate operations through Lambda functions:

1. **Device Registration API**: `POST /devices/register`
   - Creates AWS-managed X.509 certificate
   - Creates IoT Thing with device metadata
   - Attaches policy to certificate
   - Attaches certificate to Thing
   - Stores certificate backup in S3

2. **Device Reset API**: `POST /devices/{deviceId}/reset`
   - Lists and detaches certificates from Thing
   - Detaches policies from certificates
   - Deactivates and deletes certificates
   - Deletes IoT Thing
   - Cleans up S3 backups

#### Device Configuration

When a device is registered via the API, it receives:
- **Device Certificate**: X.509 PEM format
- **Private Key**: RSA PEM format (keep secure!)
- **IoT Endpoint**: AWS IoT Core data endpoint

The device also needs:
- **Root CA**: Download from https://www.amazontrust.com/repository/AmazonRootCA1.pem

#### Certificate Storage

- Certificate backups are stored in: `acorn-pups-certificates-{environment}-{account-id}`
- The S3 bucket (created by this repository) has versioning and lifecycle policies
- Certificate metadata is accessible via Parameter Store
- Actual certificate management is handled by API repository Lambda functions

#### Manual Certificate Operations (Development Only)

For development and testing, you can manually create certificates:

```bash
# Create device certificate
aws iot create-keys-and-certificate --set-as-active --output json > device-cert.json

# Extract certificate information
CERT_ARN=$(jq -r '.certificateArn' device-cert.json)
CERT_ID=$(jq -r '.certificateId' device-cert.json)

# Save certificate files
jq -r '.certificatePem' device-cert.json > device-cert.pem
jq -r '.keyPair.PrivateKey' device-cert.json > device-private-key.pem

# Create IoT Thing
aws iot create-thing --thing-name "acorn-pups-device-001" --thing-type-name "AcornPupsReceiver-dev"

# Attach policy (created by API repository)
aws iot attach-policy --policy-name "AcornPupsReceiverPolicy-dev" --target "$CERT_ARN"

# Attach certificate to Thing
aws iot attach-thing-principal --thing-name "acorn-pups-device-001" --principal "$CERT_ARN"
```

**Note**: In production, always use the API endpoints for device management to ensure proper cleanup and security. 