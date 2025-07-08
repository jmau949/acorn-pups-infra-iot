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

    // Create S3 bucket for storing device metadata and backup certificates
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

    // Store certificate information in Parameter Store
    this.parameterHelper.createParameter(
      'CertificateBucketNameParam',
      this.certificateBucket.bucketName,
      'S3 bucket for storing device metadata and backup certificates',
      `/acorn-pups/${props.environment}/iot-core/certificate-bucket/name`
    );

    this.parameterHelper.createParameter(
      'CertificateBucketArnParam',
      this.certificateBucket.bucketArn,
      'ARN of the S3 bucket for certificates',
      `/acorn-pups/${props.environment}/iot-core/certificate-bucket/arn`
    );

    // AWS IoT Core endpoint information
    const iotEndpoint = `${cdk.Aws.ACCOUNT_ID}.iot.${cdk.Aws.REGION}.amazonaws.com`;
    const iotDataEndpoint = `${cdk.Aws.ACCOUNT_ID}-ats.iot.${cdk.Aws.REGION}.amazonaws.com`;

    this.parameterHelper.createParameter(
      'IoTEndpointParam',
      iotEndpoint,
      'AWS IoT Core endpoint for certificate management',
      `/acorn-pups/${props.environment}/iot-core/endpoint`
    );

    this.parameterHelper.createParameter(
      'IoTDataEndpointParam',
      iotDataEndpoint,
      'AWS IoT Core data endpoint for ESP32 receiver connections',
      `/acorn-pups/${props.environment}/iot-core/data-endpoint`
    );

    // AWS IoT Core managed certificate configuration
    this.parameterHelper.createParameter(
      'CertificateTypeParam',
      'AWS_MANAGED',
      'Certificate type: AWS IoT Core managed certificates for ESP32 receivers',
      `/acorn-pups/${props.environment}/iot-core/certificate-type`
    );

    this.parameterHelper.createParameter(
      'CertificateExpirationDaysParam',
      props.certificateExpirationDays.toString(),
      'Number of days before ESP32 receiver certificates expire',
      `/acorn-pups/${props.environment}/iot-core/certificate-expiration-days`
    );

    // ESP32 receiver certificate configuration for AWS IoT Core
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

    // API-specific certificate generation workflow (references Lambda execution role from API repo)
    this.parameterHelper.createParameter(
      'ApiCertificateGenerationWorkflowParam',
      JSON.stringify({
        apiEndpoint: 'POST /devices/register',
        method: 'LAMBDA_FUNCTION',
        description: 'Certificate generation workflow for device registration API',
        lambdaExecutionRole: `/acorn-pups/${props.environment}/lambda-functions/execution-role/arn`,
        steps: [
          {
            step: 1,
            action: 'createKeysAndCertificate',
            description: 'Generate AWS-managed X.509 certificate and private key',
            apiCall: 'iot:CreateKeysAndCertificate',
            parameters: {
              setAsActive: true
            }
          },
          {
            step: 2,
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
                  macAddress: '{macAddress}'
                }
              }
            }
          },
          {
            step: 3,
            action: 'attachPolicy',
            description: 'Attach receiver policy to certificate',
            apiCall: 'iot:AttachPolicy',
            parameters: {
              policyName: `AcornPupsReceiverPolicy-${props.environment}`,
              target: '{certificateArn}'
            }
          },
          {
            step: 4,
            action: 'attachThingPrincipal',
            description: 'Attach certificate to Thing as principal',
            apiCall: 'iot:AttachThingPrincipal',
            parameters: {
              thingName: '{deviceId}',
              principal: '{certificateArn}'
            }
          },
          {
            step: 5,
            action: 'storeBackup',
            description: 'Store certificate backup in S3',
            apiCall: 's3:PutObject',
            parameters: {
              bucket: this.certificateBucket.bucketName,
              key: 'devices/{deviceId}/certificate.pem'
            }
          }
        ],
        response: {
          deviceCertificate: 'X.509 PEM format certificate',
          privateKey: 'RSA PEM format private key',
          iotEndpoint: iotDataEndpoint
        },
        note: 'Lambda execution role created in API repository with necessary IoT permissions'
      }),
      'API-specific certificate generation workflow for device registration',
      `/acorn-pups/${props.environment}/iot-core/api-certificate-generation-workflow`
    );

    // Certificate generation workflow for ESP32 receivers
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

    // Required certificate files for ESP32 receivers
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

    // Amazon Root CA information for ESP32 receivers
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

    // Certificate security best practices
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

    // Device reset certificate cleanup workflow
    this.parameterHelper.createParameter(
      'DeviceResetCertificateCleanupParam',
      JSON.stringify({
        description: 'Certificate cleanup workflow for device reset API',
        lambdaExecutionRole: `/acorn-pups/${props.environment}/lambda-functions/execution-role/arn`,
        steps: [
          {
            step: 1,
            action: 'listThingPrincipals',
            description: 'List certificates attached to the Thing'
          },
          {
            step: 2,
            action: 'detachThingPrincipal',
            description: 'Detach certificates from the Thing'
          },
          {
            step: 3,
            action: 'detachPolicy',
            description: 'Detach policies from certificates'
          },
          {
            step: 4,
            action: 'updateCertificate',
            description: 'Set certificate status to INACTIVE'
          },
          {
            step: 5,
            action: 'deleteCertificate',
            description: 'Delete the certificate after grace period'
          },
          {
            step: 6,
            action: 'deleteThing',
            description: 'Delete the IoT Thing'
          }
        ],
        note: 'Uses Lambda execution role created in API repository with necessary IoT permissions'
      }),
      'Certificate cleanup workflow for device reset',
      `/acorn-pups/${props.environment}/iot-core/device-reset-certificate-cleanup`
    );

    // Lambda execution role requirements (documentation only - role created in API repo)
    this.parameterHelper.createParameter(
      'LambdaIoTPermissionsRequiredParam',
      JSON.stringify({
        description: 'IoT permissions required for Lambda execution role created in API repository',
        roleLocation: 'acorn-pups-infrastructure-api repository',
        roleParameterPath: `/acorn-pups/${props.environment}/lambda-functions/execution-role/arn`,
        requiredPermissions: [
          'iot:CreateKeysAndCertificate',
          'iot:CreateThing',
          'iot:AttachPolicy',
          'iot:AttachThingPrincipal',
          'iot:DetachThingPrincipal',
          'iot:DetachPolicy',
          'iot:DeleteThing',
          'iot:DeleteCertificate',
          'iot:UpdateCertificate',
          'iot:DescribeThing',
          'iot:DescribeCertificate',
          'iot:ListThingPrincipals',
          'iot:ListPrincipalThings',
          'iot:Publish'
        ],
        s3Permissions: [
          's3:GetObject',
          's3:PutObject', 
          's3:DeleteObject'
        ],
        s3Resource: `${this.certificateBucket.bucketArn}/*`
      }),
      'IoT permissions required for Lambda execution role (created in API repo)',
      `/acorn-pups/${props.environment}/iot-core/lambda-iot-permissions-required`
    );
  }
} 