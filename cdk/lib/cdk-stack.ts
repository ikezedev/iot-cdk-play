import { RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as iot from "aws-cdk-lib/aws-iot";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as path from "node:path";
import { Environment } from "../utils/Environment";

export class CdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const env = Environment.getEnvironment();

    const temperatureTable = new WeatherTable(this, "TemperatureTable");
    const temperatureHandler = new WeatherHandler(
      this,
      "TemperatureHandlerFunction",
      "../lambda/handler.ts",
      "temperatureHandler",
      {
        TEMPERATURE_TABLE_NAME: temperatureTable.tableName,
      }
    );
    temperatureTable.grantReadWriteData(temperatureHandler);

    const humidityTable = new WeatherTable(this, "HumidityTable");
    const humidityHandler = new WeatherHandler(
      this,
      "HumidityHandlerFunction",
      "../lambda/handler.ts",
      "humidityHandler",
      {
        HUMIDITY_TABLE_NAME: humidityTable.tableName,
      }
    );
    humidityTable.grantReadWriteData(humidityHandler);

    new WeatherSensor(
      this,
      "WeatherSensor",
      env,
      temperatureHandler,
      humidityHandler
    );
  }
}

class WeatherTable extends dynamodb.Table {
  constructor(scope: Construct, tableName: string) {
    super(scope, tableName, {
      tableName: tableName,
      partitionKey: { name: "device_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}
class WeatherHandler extends lambdaNodejs.NodejsFunction {
  constructor(
    scope: Construct,
    id: string,
    handlerPath: string,
    handlerFunction: string,
    environment: { [key: string]: string } = {}
  ) {
    super(scope, id, {
      entry: path.join(__dirname, handlerPath),
      handler: handlerFunction,
      runtime: lambda.Runtime.NODEJS_22_X,
      environment: environment,
      functionName: id,
    });
  }
}

class WeatherSensor extends Construct {
  public readonly thing: iot.CfnThing;
  constructor(
    scope: Construct,
    id: string,
    env: Environment,
    tempFn: lambdaNodejs.NodejsFunction,
    humidityFn: lambdaNodejs.NodejsFunction
  ) {
    super(scope, id);

    this.thing = new iot.CfnThing(this, id, {
      thingName: id,
    });

    const policy = new iot.CfnPolicy(this, "IoTPolicy", {
      policyName: "IoTSensorPolicy",
      policyDocument: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            actions: ["iot:Connect"],
            resources: [
              `${env.getNamespace("iot")}:client/rust-client-1`,
              `${env.getNamespace("iot")}:client/rust-client-2`,
            ],
          }),
          new iam.PolicyStatement({
            actions: ["iot:Publish", "iot:PublishRetain", "iot:Receive"],
            resources: [
              `${env.getNamespace("iot")}:topic/${env.topicName}/temperature`,
              `${env.getNamespace("iot")}:topic/${env.topicName}/humidity`,
            ],
          }),
          new iam.PolicyStatement({
            actions: ["iot:Subscribe"],
            resources: [
              `${env.getNamespace("iot")}:topicfilter/${
                env.topicName
              }/temperature`,
              `${env.getNamespace("iot")}:topicfilter/${
                env.topicName
              }/humidity`,
            ],
          }),
        ],
      }),
    });

    new iot.CfnPolicyPrincipalAttachment(this, "PolicyPrincipalAttachment", {
      policyName: policy.policyName!,
      principal: env.certArn,
    });

    new iot.CfnThingPrincipalAttachment(this, "PrincipalAttachment", {
      thingName: id,
      principal: env.certArn,
    });

    let tempRule = new iot.CfnTopicRule(this, "IoTTemperatureRule", {
      ruleName: "IoTTemperatureRule",
      topicRulePayload: {
        awsIotSqlVersion: "2016-03-23",
        sql: `SELECT encode(*, 'base64') as data FROM '${env.topicName}/temperature'`,
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

    let humidityRule = new iot.CfnTopicRule(this, "IoTHumidityRule", {
      ruleName: "IoTHumidityRule",
      topicRulePayload: {
        awsIotSqlVersion: "2016-03-23",
        sql: `SELECT encode(*, 'base64') as data FROM '${env.topicName}/humidity'`,
        actions: [
          {
            lambda: {
              functionArn: humidityFn.functionArn,
            },
          },
        ],
        ruleDisabled: false,
      },
    });

    new lambda.CfnPermission(this, "TemperatureLambdaPermission", {
      action: "lambda:InvokeFunction",
      functionName: tempFn.functionArn,
      principal: "iot.amazonaws.com",
      sourceArn: tempRule.attrArn,
    });

    new lambda.CfnPermission(this, "HumidityLambdaPermission", {
      action: "lambda:InvokeFunction",
      functionName: humidityFn.functionArn,
      principal: "iot.amazonaws.com",
      sourceArn: humidityRule.attrArn,
    });
  }
}
