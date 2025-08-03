import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as iot from 'aws-cdk-lib/aws-iot';

export class CdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const queue = new sqs.Queue(this, 'CdkQueue', {
      visibilityTimeout: Duration.seconds(300)
    });

    const topic = new sns.Topic(this, 'CdkTopic');

    topic.addSubscription(new subs.SqsSubscription(queue));
  }
}

interface TemperatureSensorProps {
  thingName: string;
}

class TemperatureSensor extends Construct {
  public readonly thing: iot.CfnThing;
  constructor(scope: Construct, id: string, props: TemperatureSensorProps) {
    super(scope, id);

    // Create a Thing
    this.thing = new iot.CfnThing(this, 'MyThing', {
      thingName: props.thingName,
    });

    // Create an IoT Policy
    const policy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          actions: ['iot:Connect', 'iot:Publish', 'iot:Subscribe', 'iot:Receive'],
          resources: ['*'], // Specify your resources more narrowly for better security
        }),
      ],
    });

    const cfnPolicy = new iot.CfnPolicy(this, 'IoTPolicy', {
      policyName: 'IoTSensorPolicy',
      policyDocument: policy,
    });

    // Create a Role for IoT to assume
    const role = new iam.Role(this, 'IoTRole', {
      assumedBy: new iam.ServicePrincipal('iot.amazonaws.com'),
    });

    role.attachInlinePolicy(new iam.Policy(this, 'IoTPolicyAttachment', {
      document: policy,
    }));

    // Create a Thing Principal Attachment
    new iot.CfnThingPrincipalAttachment(this, 'ThingPrincipalAttachment', {
      principal: role.roleArn,
      thingName: props.thingName,
    });

    // Create an IoT Rule
    new iot.CfnTopicRule(this, 'IoTRule', {
      ruleName: 'IoTSensorRule',
      topicRulePayload: {
        sql: `SELECT temperature FROM 'topic/sensor' WHERE temperature > 50`,
        actions: [
          {
            sns: {
              // topicArn: 'arn:aws:sns:REGION:ACCOUNT_ID:TOPIC_NAME', // Replace with your SNS topic ARN
              roleArn: role.roleArn,
            },
          },
        ],
        ruleDisabled: false,
      },
    });
  }
}