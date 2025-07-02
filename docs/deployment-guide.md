# Acorn Pups IoT Infrastructure Deployment Guide

This guide provides step-by-step instructions for deploying the Acorn Pups IoT infrastructure using AWS CDK.

## Prerequisites Checklist

Before deploying, ensure you have:

- [ ] **Node.js** 22.0.0 or higher installed
- [ ] **AWS CDK** v2 installed globally (`npm install -g aws-cdk`)
- [ ] **AWS CLI** configured with appropriate credentials
- [ ] **PowerShell** (for Windows deployment scripts)
- [ ] **API Infrastructure** deployed first (contains required Lambda functions)

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

The IoT Rules stack requires Lambda functions to be deployed first. Verify these Parameter Store entries exist:

```powershell
aws ssm get-parameter --name "/acorn-pups/dev/lambda-functions/handleButtonPress/arn"
aws ssm get-parameter --name "/acorn-pups/dev/lambda-functions/updateDeviceStatus/arn"
aws ssm get-parameter --name "/acorn-pups/dev/lambda-functions/resetDevice/arn"
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

The stacks have dependencies and should be deployed in this order:

1. **Certificate Management Stack** (independent)
2. **IoT Thing Type Stack** (independent) 
3. **IoT Policy Stack** (depends on Thing Type)
4. **IoT Rules Stack** (depends on Policy and Certificate, requires Lambda ARNs)
5. **Monitoring Stack** (depends on Thing Type and Rules)

The deployment scripts handle these dependencies automatically.

## Stack Details

### Certificate Management Stack
- **Resources**: S3 bucket, CA certificate placeholder, certificate templates
- **Dependencies**: None
- **Outputs**: Certificate bucket name/ARN, CA certificate ARN

### IoT Thing Type Stack  
- **Resources**: `AcornPupsDevice` Thing Type with searchable attributes
- **Dependencies**: None
- **Outputs**: Thing Type name/ARN, searchable attributes

### IoT Policy Stack
- **Resources**: Device policy, IoT Rules execution role
- **Dependencies**: Thing Type Stack
- **Outputs**: Policy name/ARN, execution role ARN

### IoT Rules Stack
- **Resources**: 5 IoT Rules for different message types
- **Dependencies**: Policy Stack, Certificate Stack, Lambda functions in Parameter Store
- **Outputs**: Rule names/ARNs for all rules

### Monitoring Stack
- **Resources**: CloudWatch dashboard, 4 CloudWatch alarms
- **Dependencies**: Thing Type Stack, Rules Stack
- **Outputs**: Dashboard name/URL, alarm names/ARNs

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
```

### 3. Test IoT Rules
```powershell
# Test button press rule
aws iot publish --topic "acorn-pups/button-press/test-device" --payload '{"deviceId": "test-device", "timestamp": "2024-01-01T12:00:00Z"}'

# Test status update rule  
aws iot publish --topic "acorn-pups/status/test-device" --payload '{"deviceId": "test-device", "status": "online", "firmwareVersion": "1.0.0"}'
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

### Issue: Certificate Management Stack Errors
**Symptom**: Certificate stack fails to deploy or CA certificate issues.

**Solution**:
- The current implementation uses a placeholder CA certificate
- For production, manually register your CA certificate with AWS IoT Core
- Update the certificate management stack to reference your actual CA

### Issue: IoT Policy Permissions Denied
**Symptom**: Devices cannot connect or publish messages.

**Solution**:
1. Verify device client ID matches pattern `acorn-esp32-*`
2. Check device certificate is attached to Thing
3. Verify policy is attached to certificate
4. Ensure device is using correct MQTT endpoint

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
- Each device gets unique X.509 certificate
- Client ID must match pattern `acorn-esp32-*`
- Device can only access its own topics (`{iot:ClientId}`)
- Certificate must be attached to Thing for connection

## Monitoring and Maintenance

### CloudWatch Alarms
- **High Error Rate**: >5% rule execution failures
- **Device Connectivity**: >10 failed connections in 5 minutes  


### Regular Maintenance Tasks
1. **Monthly**: Review CloudWatch metrics and logs
2. **Quarterly**: Update certificate expiration dates
3. **Annually**: Review and update security policies
4. **As Needed**: Scale monitoring thresholds based on fleet size

### Cost Optimization
- Monitor AWS IoT Core message costs
- Set CloudWatch log retention policies
- Use CloudWatch Insights for log analysis
- Consider S3 lifecycle policies for certificates

## Rollback Procedures

### Development Environment
```powershell
# Destroy all stacks
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

**Note**: S3 buckets in production are retained by default and must be manually deleted.

## Troubleshooting Commands

```powershell
# Check CDK diff before deployment
cdk diff --all --context environment=dev

# View CloudFormation events
aws cloudformation describe-stack-events --stack-name acorn-pups-iot-dev-rules

# Check IoT Core connectivity
aws iot describe-endpoint --endpoint-type iot:Data-ATS

# List IoT Things
aws iot list-things --thing-type-name AcornPupsDevice-dev

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