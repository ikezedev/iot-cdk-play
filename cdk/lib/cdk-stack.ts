import { RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as iot from "aws-cdk-lib/aws-iot";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import path from "node:path";
import { Environment } from "../utils/Environment";

export class CdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const temperatureTable = new dynamodb.Table(this, "TemperatureTable", {
      partitionKey: { name: "device_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const humidityTable = new dynamodb.Table(this, "HumidityTable", {
      partitionKey: { name: "device_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const weatherDataProcessor = new lambdaNodejs.NodejsFunction(
      this,
      "WeatherDataProcessorFunction",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        entry: path.join(__dirname, "../lambda/handler.ts"),
        handler: "handler",
        environment: {
          TEMPERATURE_TABLE_NAME: temperatureTable.tableName,
          HUMIDITY_TABLE_NAME: humidityTable.tableName,
        },
        bundling: {
          minify: true,
          sourceMap: true,
        },
      }
    );
  }
}

interface WeatherSensorProps {
  thingName: string;
}

class WeatherSensor extends Construct {
  public readonly thing: iot.CfnThing;
  constructor(
    scope: Construct,
    id: string,
    props: WeatherSensorProps,
    env: Environment,
    tempFn: lambdaNodejs.NodejsFunction,
    humidityFn: lambdaNodejs.NodejsFunction
  ) {
    super(scope, id);

    // Create a Thing
    this.thing = new iot.CfnThing(this, "MyThing", {
      thingName: props.thingName,
    });

    const policy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          actions: ["iot:Connect"],
          resources: [`${env.baseArn}:client/rust-client`],
        }),
        new iam.PolicyStatement({
          actions: ["iot:Publish", "iot:PublishRetain"],
          resources: [
            `${env.baseArn}:topic/monitoring/temperature`,
            `${env.baseArn}:topic/monitoring/humidity`,
          ],
        }),
      ],
    });

    new iot.CfnPolicy(this, "IoTPolicy", {
      policyName: "IoTSensorPolicy",
      policyDocument: policy,
    });

    const role = new iam.Role(this, "IoTRole", {
      assumedBy: new iam.ServicePrincipal("iot.amazonaws.com"),
    });

    role.attachInlinePolicy(
      new iam.Policy(this, "IoTPolicyAttachment", {
        document: policy,
      })
    );

    // Create a Thing Principal Attachment
    new iot.CfnThingPrincipalAttachment(this, "ThingPrincipalAttachment", {
      principal: role.roleArn,
      thingName: props.thingName,
    });

    new iot.CfnTopicRule(this, "IoTRule", {
      ruleName: "IoTTemperatureRule",
      topicRulePayload: {
        sql: `SELECT * FROM 'monitoring/temperature'`,
        actions: [
          {
            lambda: {
              functionArn: tempFn.functionArn,
            },
          },
        ],
        ruleDisabled: false,
      },
    });

    new iot.CfnTopicRule(this, "IoTRule", {
      ruleName: "IoTHumidityRule",
      topicRulePayload: {
        sql: `SELECT * FROM 'monitoring/humidity'`,
        actions: [
          {
            lambda: {
              functionArn: humidityFn.functionArn, // Replace with your Lambda function ARN
            },
          },
        ],
        ruleDisabled: false,
      },
    });
  }
}
