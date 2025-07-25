import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { CertificateManagementStackProps } from './types';
import { ParameterStoreHelper } from './parameter-store-helper';

export class CertificateManagementStack extends cdk.Stack {
  public readonly certificateBucket: s3.Bucket;
  private parameterHelper: ParameterStoreHelper;

  constructor(scope: Construct, id: string, props: CertificateManagementStackProps) {
    super(scope, id, props);

    // Initialize parameter store helper
    this.parameterHelper = new ParameterStoreHelper(this, {
      environment: props.environment,
      stackName: 'certificates',
    });

    // ============================================================================
    // 🏗️ ACTUAL INFRASTRUCTURE - USED BY SYSTEM
    // ============================================================================

    // Create S3 bucket for storing device metadata and backup certificates
    // 🔄 USED BY: registerDevice Lambda function for certificate backups
    this.certificateBucket = new s3.Bucket(this, 'CertificateBucket', {
      bucketName: `acorn-pups-certificates-${props.environment}-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [
        {
          id: 'DeleteOldVersions',
          enabled: true,
          noncurrentVersionExpiration: cdk.Duration.days(90),
        }
      ],
      removalPolicy: props.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add tags to resources
    cdk.Tags.of(this.certificateBucket).add('Project', 'acorn-pups');
    cdk.Tags.of(this.certificateBucket).add('Environment', props.environment);
    cdk.Tags.of(this.certificateBucket).add('Service', 'IoT-Core');
    cdk.Tags.of(this.certificateBucket).add('Component', 'CertificateStorage');

    // ============================================================================
    // 🔧 CONFIGURATION PARAMETERS - USED BY LAMBDA FUNCTIONS
    // ============================================================================

    // 🔄 USED BY: registerDevice Lambda to know where to store certificate backups
    this.parameterHelper.createParameter(
      'CertificateBucketNameParam',
      this.certificateBucket.bucketName,
      'S3 bucket for storing device metadata and backup certificates',
      `/acorn-pups/${props.environment}/iot-core/certificate-bucket/name`
    );

    // 🔄 USED BY: Lambda functions that need S3 bucket permissions
    this.parameterHelper.createParameter(
      'CertificateBucketArnParam',
      this.certificateBucket.bucketArn,
      'ARN of the S3 bucket for certificates',
      `/acorn-pups/${props.environment}/iot-core/certificate-bucket/arn`
    );

    // AWS IoT Core endpoint information
    const iotEndpoint = `${cdk.Aws.ACCOUNT_ID}.iot.${cdk.Aws.REGION}.amazonaws.com`;
    const iotDataEndpoint = `${cdk.Aws.ACCOUNT_ID}-ats.iot.${cdk.Aws.REGION}.amazonaws.com`;

    // 🔄 USED BY: Lambda functions for IoT management operations
    this.parameterHelper.createParameter(
      'IoTEndpointParam',
      iotEndpoint,
      'AWS IoT Core endpoint for certificate management',
      `/acorn-pups/${props.environment}/iot-core/endpoint`
    );

    // 🔄 USED BY: ESP32 devices and Lambda functions for MQTT connections
    this.parameterHelper.createParameter(
      'IoTDataEndpointParam',
      iotDataEndpoint,
      'AWS IoT Core data endpoint for ESP32 receiver connections',
      `/acorn-pups/${props.environment}/iot-core/data-endpoint`
    );

    // 🔄 USED BY: Lambda functions to configure certificate type
    this.parameterHelper.createParameter(
      'CertificateTypeParam',
      'AWS_MANAGED',
      'Certificate type: AWS IoT Core managed certificates for ESP32 receivers',
      `/acorn-pups/${props.environment}/iot-core/certificate-type`
    );

    // 🔄 USED BY: Lambda functions to set certificate expiration
    this.parameterHelper.createParameter(
      'CertificateExpirationDaysParam',
      props.certificateExpirationDays.toString(),
      'Number of days before ESP32 receiver certificates expire',
      `/acorn-pups/${props.environment}/iot-core/certificate-expiration-days`
    );

    // 🔄 USED BY: registerDevice Lambda for certificate configuration
    this.parameterHelper.createParameter(
      'ReceiverCertificateConfigParam',
      JSON.stringify({
        type: 'AWS_MANAGED',
        autoActivate: true,
        attachPolicy: true,
        policyName: `AcornPupsReceiverPolicy-${props.environment}`,
        thingTypeName: `AcornPupsReceiver-${props.environment}`,
        validityPeriod: props.certificateExpirationDays,
        certificateStatus: 'ACTIVE',
        deviceType: 'ESP32_RECEIVER'
      }),
      'ESP32 receiver certificate configuration for AWS IoT Core',
      `/acorn-pups/${props.environment}/iot-core/receiver-certificate-config`
    );

    // ============================================================================
    // 📖 DOCUMENTATION ONLY - NOT USED BY SYSTEM
    // ============================================================================

    // 📋 DOCUMENTATION: Detailed workflow steps (NOT executed by system)
    // This is reference documentation for API developers implementing registerDevice Lambda
    this.parameterHelper.createParameter(
      'ApiCertificateGenerationWorkflowParam',
      JSON.stringify({
        apiEndpoint: 'POST /devices/register',
        method: 'LAMBDA_FUNCTION',
        description: 'Certificate generation workflow for device registration API with device instance ID reset security',
        lambdaExecutionRole: `/acorn-pups/${props.environment}/lambda-functions/iot-device-mgmt-role/arn`,
        roleDescription: 'IoT Device Management role with full IoT certificate and thing management permissions',
        deviceInstanceIdSecurity: {
          description: 'Device instance ID prevents remote takeover and enables reset-based ownership transfer',
          resetDetection: 'Compare device_instance_id to detect factory resets',
          ownershipTransfer: 'Automatic cleanup when reset is proven via new instance ID',
          physicalAccessRequired: 'Only physical reset button can generate new instance ID'
        },
        steps: [
          {
            step: 1,
            action: 'validateReset',
            description: 'Check device_instance_id to detect factory resets and validate ownership transfer',
            logic: 'If device exists AND has different device_instance_id -> Allow ownership transfer, If same instance_id -> Reject (no reset), If new device -> Normal registration'
          },
          {
            step: 2,
            action: 'cleanupExistingResources',
            description: 'Revoke old certificates and clean up existing device resources if reset detected',
            condition: 'Only if device_instance_id changed (reset detected)',
            apiCalls: ['iot:ListThingPrincipals', 'iot:DetachThingPrincipal', 'iot:DetachPolicy', 'iot:UpdateCertificate', 'iot:DeleteCertificate']
          },
          {
            step: 3,
            action: 'createKeysAndCertificate',
            description: 'Generate AWS-managed X.509 certificate and private key',
            apiCall: 'iot:CreateKeysAndCertificate',
            parameters: {
              setAsActive: true
            }
          },
          {
            step: 4,
            action: 'createThing',
            description: 'Create IoT Thing for ESP32 receiver',
            apiCall: 'iot:CreateThing',
            parameters: {
              thingName: '{deviceId}',
              thingTypeName: `AcornPupsReceiver-${props.environment}`,
              attributePayload: {
                attributes: {
                  deviceName: '{deviceName}',
                  serialNumber: '{serialNumber}',
                  macAddress: '{macAddress}',
                  deviceInstanceId: '{deviceInstanceId}'
                }
              }
            }
          },
          {
            step: 5,
            action: 'attachPolicy',
            description: 'Attach receiver policy to certificate',
            apiCall: 'iot:AttachPolicy',
            parameters: {
              policyName: `AcornPupsReceiverPolicy-${props.environment}`,
              target: '{certificateArn}'
            }
          },
          {
            step: 6,
            action: 'attachThingPrincipal',
            description: 'Attach certificate to Thing as principal',
            apiCall: 'iot:AttachThingPrincipal',
            parameters: {
              thingName: '{deviceId}',
              principal: '{certificateArn}'
            }
          },
          {
            step: 7,
            action: 'storeBackup',
            description: 'Store certificate backup in S3',
            apiCall: 's3:PutObject',
            parameters: {
              bucket: this.certificateBucket.bucketName,
              key: 'devices/{deviceId}/certificate.pem'
            }
          },
          {
            step: 8,
            action: 'updateDatabase',
            description: 'Update Devices table with new instance ID and ownership information',
            apiCall: 'dynamodb:PutItem',
            parameters: {
              table: 'Devices',
              item: {
                device_instance_id: '{deviceInstanceId}',
                last_reset_at: '{resetTimestamp}',
                owner_user_id: '{newOwnerId}'
              }
            }
          }
        ],
        response: {
          deviceCertificate: 'X.509 PEM format certificate',
          privateKey: 'RSA PEM format private key',
          iotEndpoint: iotDataEndpoint
        },
        note: 'Uses IoT Device Management role created in API repository with comprehensive IoT permissions and device instance ID security'
      }),
      'API-specific certificate generation workflow for device registration with reset security',
      `/acorn-pups/${props.environment}/iot-core/api-certificate-generation-workflow`
    );

    // 📋 DOCUMENTATION: CLI commands for reference (NOT executed by system)
    this.parameterHelper.createParameter(
      'CertificateGenerationWorkflowParam',
      JSON.stringify({
        method: 'AWS_CLI_SDK',
        description: 'Certificate generation workflow for ESP32 receivers during device registration',
        steps: [
          {
            step: 1,
            command: 'aws iot create-keys-and-certificate --set-as-active',
            description: 'Generate AWS-managed X.509 certificate and private key'
          },
          {
            step: 2,
            command: 'aws iot create-thing --thing-name <deviceId> --thing-type-name AcornPupsReceiver-${environment}',
            description: 'Create IoT Thing for ESP32 receiver'
          },
          {
            step: 3,
            command: 'aws iot attach-policy --policy-name AcornPupsReceiverPolicy-${environment} --target <certificateArn>',
            description: 'Attach receiver policy to certificate'
          },
          {
            step: 4,
            command: 'aws iot attach-thing-principal --thing-name <deviceId> --principal <certificateArn>',
            description: 'Attach certificate to Thing as principal'
          }
        ],
        documentation: 'https://docs.aws.amazon.com/iot/latest/developerguide/create-device-certificate.html'
      }),
      'Certificate generation workflow for ESP32 receivers',
      `/acorn-pups/${props.environment}/iot-core/certificate-generation-workflow`
    );

    // 📋 DOCUMENTATION: File format reference (NOT used by system)
    this.parameterHelper.createParameter(
      'ReceiverCertificateFilesParam',
      JSON.stringify({
        deviceCertificate: {
          format: 'X.509 PEM',
          description: 'Device-specific certificate generated by AWS IoT Core',
          usage: 'Device authentication and authorization'
        },
        privateKey: {
          format: 'RSA PEM',
          description: 'Private key corresponding to device certificate',
          usage: 'TLS handshake and message signing'
        },
        amazonRootCA: {
          format: 'X.509 PEM',
          description: 'Amazon Root CA 1 certificate',
          url: 'https://www.amazontrust.com/repository/AmazonRootCA1.pem',
          usage: 'TLS certificate validation'
        }
      }),
      'Required certificate files for ESP32 receivers',
      `/acorn-pups/${props.environment}/iot-core/receiver-certificate-files`
    );

    // ============================================================================
    // 🔧 CLOUDFORMATION OUTPUTS - USED FOR CROSS-STACK INTEGRATION
    // ============================================================================

    // Create CloudFormation outputs with Parameter Store integration
    this.parameterHelper.createOutputWithParameter(
      'CertificateBucketNameOutput',
      this.certificateBucket.bucketName,
      'Name of the certificate storage bucket',
      `AcornPupsCertificateBucketName-${props.environment}`
    );

    this.parameterHelper.createOutputWithParameter(
      'CertificateBucketArnOutput',
      this.certificateBucket.bucketArn,
      'ARN of the certificate storage bucket',
      `AcornPupsCertificateBucketArn-${props.environment}`
    );

    this.parameterHelper.createOutputWithParameter(
      'IoTEndpointOutput',
      iotEndpoint,
      'AWS IoT Core endpoint',
      `AcornPupsIoTEndpoint-${props.environment}`
    );

    this.parameterHelper.createOutputWithParameter(
      'IoTDataEndpointOutput',
      iotDataEndpoint,
      'AWS IoT Core data endpoint for ESP32 receivers',
      `AcornPupsIoTDataEndpoint-${props.environment}`
    );

    // ============================================================================
    // 📖 MORE DOCUMENTATION ONLY - NOT USED BY SYSTEM
    // ============================================================================

    // 📋 DOCUMENTATION: Amazon Root CA reference info (NOT used by system)
    this.parameterHelper.createParameter(
      'AmazonRootCAInfoParam',
      JSON.stringify({
        name: 'Amazon Root CA 1',
        url: 'https://www.amazontrust.com/repository/AmazonRootCA1.pem',
        fingerprint: 'SHA256:++KUrOSCJlM8ZbQGz6HRgN2FXI4xjvuZfV9pDYTqHzo=',
        description: 'Amazon Root CA certificate for ESP32 receiver AWS IoT Core connections',
        usage: 'TLS certificate validation for MQTT over TLS'
      }),
      'Amazon Root CA information for ESP32 receiver configuration',
      `/acorn-pups/${props.environment}/iot-core/amazon-root-ca`
    );

    // 📋 DOCUMENTATION: Security best practices (NOT used by system)
    this.parameterHelper.createParameter(
      'CertificateSecurityBestPracticesParam',
      JSON.stringify({
        storage: 'Store certificates in ESP32 secure flash partition',
        rotation: 'Implement certificate rotation before expiration',
        backup: 'Keep backup certificates in S3 for recovery',
        monitoring: 'Monitor certificate expiration dates',
        revoking: 'Implement certificate revocation for compromised devices'
      }),
      'Certificate security best practices for ESP32 receivers',
      `/acorn-pups/${props.environment}/iot-core/certificate-security-best-practices`
    );

    // 📋 DOCUMENTATION: Reset cleanup workflow (NOT executed by system)
    this.parameterHelper.createParameter(
      'DeviceResetCertificateCleanupParam',
      JSON.stringify({
        description: 'Certificate cleanup workflow for HTTP-based device reset with device instance ID security',
        trigger: 'POST /devices/register API call with different device_instance_id',
        lambdaExecutionRole: `/acorn-pups/${props.environment}/lambda-functions/iot-device-mgmt-role/arn`,
        roleDescription: 'IoT Device Management role with full IoT certificate and thing management permissions',
        resetSecurity: {
          description: 'Echo/Nest pattern for secure device reset',
          physicalAccessRequired: 'Only physical reset button can generate new device_instance_id',
          preventRemoteTakeover: 'Registration fails without valid reset proof (new instance ID)',
          ownershipTransfer: 'Automatic cleanup when legitimate reset is detected'
        },
        steps: [
          {
            step: 1,
            action: 'validateReset',
            description: 'Compare device_instance_id to confirm factory reset occurred',
            condition: 'device_instance_id != stored_device_instance_id'
          },
          {
            step: 2,
            action: 'listThingPrincipals',
            description: 'List certificates attached to the Thing'
          },
          {
            step: 3,
            action: 'detachThingPrincipal',
            description: 'Detach certificates from the Thing'
          },
          {
            step: 4,
            action: 'detachPolicy',
            description: 'Detach policies from certificates'
          },
          {
            step: 5,
            action: 'updateCertificate',
            description: 'Set certificate status to INACTIVE'
          },
          {
            step: 6,
            action: 'deleteCertificate',
            description: 'Delete the certificate after grace period'
          },
          {
            step: 7,
            action: 'deleteThing',
            description: 'Delete the IoT Thing'
          },
          {
            step: 8,
            action: 'cleanupDatabase',
            description: 'Remove DeviceUsers entries and update Devices table',
            note: 'Complete ownership transfer after reset validation'
          }
        ],
        note: 'No MQTT reset topics - all reset handling via HTTP registration API with device instance ID validation'
      }),
      'HTTP-based certificate cleanup workflow for device reset with instance ID security',
      `/acorn-pups/${props.environment}/iot-core/device-reset-certificate-cleanup`
    );

    // 📋 DOCUMENTATION: Lambda role requirements (NOT used by system)
    this.parameterHelper.createParameter(
      'LambdaIoTPermissionsRequiredParam',
      JSON.stringify({
        description: 'IoT permissions and role mapping for Lambda functions created in API repository with device instance ID security',
        roleLocation: 'acorn-pups-infrastructure-api repository',
        deviceInstanceIdSecurity: {
          description: 'Device instance ID prevents remote takeover attacks and enables secure ownership transfer',
          implementation: 'UUID generated each factory reset cycle, stored in ESP32 secure storage',
          validation: 'Lambda functions compare instance IDs to detect legitimate resets'
        },
        roleStructure: {
          iotDeviceManagementRole: {
            path: `/acorn-pups/${props.environment}/lambda-functions/iot-device-mgmt-role/arn`,
            usedBy: ['register-device'],
            permissions: [
              'iot:CreateKeysAndCertificate',
              'iot:DeleteCertificate',
              'iot:UpdateCertificate',
              'iot:DescribeCertificate',
              'iot:CreateThing',
              'iot:DeleteThing',
              'iot:DescribeThing',
              'iot:UpdateThing',
              'iot:AttachPolicy',
              'iot:DetachPolicy',
              'iot:AttachThingPrincipal',
              'iot:DetachThingPrincipal',
              'iot:ListThingPrincipals',
              'iot:ListPrincipalThings',
              'iot:DescribeEndpoint',
              'iot:Publish'
            ],
            useCases: 'Device registration with reset validation, certificate lifecycle management, ownership transfer'
          },
          iotCommunicationRole: {
            path: `/acorn-pups/${props.environment}/lambda-functions/iot-comm-role/arn`,
            usedBy: ['update-device-settings'],
            permissions: [
              'iot:Publish',
              'iot:DescribeEndpoint'
            ],
            useCases: 'Real-time device configuration updates via MQTT'
          },
          notificationRole: {
            path: `/acorn-pups/${props.environment}/lambda-functions/notification-role/arn`,
            usedBy: ['handle-button-press', 'invite-user'],
            permissions: [
              'sns:Publish',
              'ses:SendEmail'
            ],
            useCases: 'Push notifications, email invitations'
          },
          baseLambdaRole: {
            path: `/acorn-pups/${props.environment}/lambda-functions/base-role/arn`,
            usedBy: ['update-device-status', 'get-user-devices', 'health-check', 'cognito-post-confirmation'],
            permissions: [
              'dynamodb operations only'
            ],
            useCases: 'Basic CRUD operations, data retrieval, user creation after email verification'
          }
        },
        s3Permissions: {
          resource: `${this.certificateBucket.bucketArn}/*`,
          actions: [
            's3:GetObject',
            's3:PutObject', 
            's3:DeleteObject'
          ],
          appliesTo: 'iotDeviceManagementRole only'
        },
        legacyCompatibility: {
          path: `/acorn-pups/${props.environment}/lambda-functions/execution-role/arn`,
          note: 'Points to baseLambdaRole for backward compatibility'
        }
      }),
      'IoT permissions and role mapping for Lambda functions with device instance ID security',
      `/acorn-pups/${props.environment}/iot-core/lambda-role-mapping`
    );
  }
} 