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

    // Create S3 bucket for storing certificates and device metadata
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

    // Add tags to S3 bucket
    cdk.Tags.of(this.certificateBucket).add('Project', 'acorn-pups');
    cdk.Tags.of(this.certificateBucket).add('Environment', props.environment);
    cdk.Tags.of(this.certificateBucket).add('Service', 'IoT-Core');
    cdk.Tags.of(this.certificateBucket).add('Component', 'CertificateStorage');

    // Store certificate information in Parameter Store
    this.parameterHelper.createParameter(
      'CertificateBucketNameParam',
      this.certificateBucket.bucketName,
      'S3 bucket for storing device certificates and metadata',
      `/acorn-pups/${props.environment}/iot-core/certificate-bucket/name`
    );

    this.parameterHelper.createParameter(
      'CertificateBucketArnParam',
      this.certificateBucket.bucketArn,
      'ARN of the S3 bucket for certificates',
      `/acorn-pups/${props.environment}/iot-core/certificate-bucket/arn`
    );

    // AWS IoT Core endpoint information
    const iotEndpoint = `https://${cdk.Aws.ACCOUNT_ID}.iot.${cdk.Aws.REGION}.amazonaws.com`;
    const iotDataEndpoint = `https://${cdk.Aws.ACCOUNT_ID}-ats.iot.${cdk.Aws.REGION}.amazonaws.com`;

    this.parameterHelper.createParameter(
      'IoTEndpointParam',
      iotEndpoint,
      'AWS IoT Core endpoint for certificate management',
      `/acorn-pups/${props.environment}/iot-core/endpoint`
    );

    this.parameterHelper.createParameter(
      'IoTDataEndpointParam',
      iotDataEndpoint,
      'AWS IoT Core data endpoint for device connections',
      `/acorn-pups/${props.environment}/iot-core/data-endpoint`
    );

    // Certificate configuration for AWS IoT Core built-in certificates
    this.parameterHelper.createParameter(
      'CertificateTypeParam',
      'AWS_MANAGED',
      'Certificate type: AWS IoT Core managed certificates',
      `/acorn-pups/${props.environment}/iot-core/certificate-type`
    );

    this.parameterHelper.createParameter(
      'CertificateExpirationDaysParam',
      props.certificateExpirationDays.toString(),
      'Number of days before device certificates expire',
      `/acorn-pups/${props.environment}/iot-core/certificate-expiration-days`
    );

    // Device certificate configuration for AWS IoT Core
    this.parameterHelper.createParameter(
      'DeviceCertificateConfigParam',
      JSON.stringify({
        type: 'AWS_MANAGED',
        autoActivate: true,
        attachPolicy: true,
        policyName: `AcornPupsDevicePolicy-${props.environment}`,
        thingTypeName: `AcornPupsDevice-${props.environment}`,
        validityPeriod: props.certificateExpirationDays,
        certificateStatus: 'ACTIVE'
      }),
      'Device certificate configuration for AWS IoT Core',
      `/acorn-pups/${props.environment}/iot-core/certificate-config`
    );

    // Instructions for certificate generation using AWS CLI/SDK
    this.parameterHelper.createParameter(
      'CertificateGenerationInstructionsParam',
      JSON.stringify({
        method: 'AWS_CLI',
        commands: [
          'aws iot create-keys-and-certificate --set-as-active',
          'aws iot attach-policy --policy-name AcornPupsDevicePolicy-${environment} --target <certificateArn>',
          'aws iot create-thing --thing-name <deviceId> --thing-type-name AcornPupsDevice-${environment}',
          'aws iot attach-thing-principal --thing-name <deviceId> --principal <certificateArn>'
        ],
        documentation: 'https://docs.aws.amazon.com/iot/latest/developerguide/create-device-certificate.html'
      }),
      'Instructions for generating AWS IoT Core certificates',
      `/acorn-pups/${props.environment}/iot-core/certificate-generation-instructions`
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
      'AWS IoT Core data endpoint',
      `AcornPupsIoTDataEndpoint-${props.environment}`
    );

    // Regional Amazon Root CA information
    this.parameterHelper.createParameter(
      'AmazonRootCAInfoParam',
      JSON.stringify({
        name: 'Amazon Root CA 1',
        url: 'https://www.amazontrust.com/repository/AmazonRootCA1.pem',
        fingerprint: 'SHA256:++KUrOSCJlM8ZbQGz6HRgN2FXI4xjvuZfV9pDYTqHzo=',
        description: 'Amazon Root CA certificate for AWS IoT Core device connections'
      }),
      'Amazon Root CA information for device configuration',
      `/acorn-pups/${props.environment}/iot-core/amazon-root-ca`
    );
  }
} 