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
    const env = Environment.getEnvironment();

    const temparatureTableAndHandler = new TableAndLambda(
      this,
      "TemparatureTableAndHandler",
      {
        tableName: "TemperatureTable",
        handlerName: "TemperatureHandlerFunction",
        handlerPath: "../lambda/handler.ts",
        handlerFunction: "temperatureHandler",
        tableEnvName: "TEMPERATURE_TABLE_NAME",
      }
    );
    const humidityTableAndHandler = new TableAndLambda(
      this,
      "HumidityTableAndHandler",
      {
        tableName: "HumidityTable",
        handlerName: "HumidityHandlerFunction",
        handlerPath: "../lambda/handler.ts",
        handlerFunction: "humidityHandler",
        tableEnvName: "HUMIDITY_TABLE_NAME",
      }
    );

    new WeatherSensor(
      this,
      "WeatherSensor",
      env,
      temparatureTableAndHandler.handler,
      humidityTableAndHandler.handler
    );
  }
}

export class TableAndLambda extends Construct {
  public readonly table: dynamodb.Table;
  public readonly handler: lambdaNodejs.NodejsFunction;

  constructor(
    scope: Construct,
    id: string,
    props: {
      tableName: string;
      handlerName: string;
      handlerPath: string;
      handlerFunction: string;
      tableEnvName: string;
    }
  ) {
    super(scope, id);

    this.table = new dynamodb.Table(this, props.tableName, {
      partitionKey: { name: "device_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.handler = new lambdaNodejs.NodejsFunction(this, props.handlerName, {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(__dirname, props.handlerPath),
      handler: props.handlerFunction,
      environment: {
        [props.tableEnvName]: this.table.tableName,
      },
      bundling: {
        minify: false,
        sourceMap: true,
      },
    });

    this.table.grantReadWriteData(this.handler);
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
