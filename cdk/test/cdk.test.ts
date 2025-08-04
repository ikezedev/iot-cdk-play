import * as cdk from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import * as Cdk from "../lib/cdk-stack";

test("dynamodb tables created", () => {
  const app = new cdk.App();
  const stack = new Cdk.CdkStack(app, "MyTestStack");

  const template = Template.fromStack(stack);

  template.resourceCountIs("AWS::DynamoDB::Table", 2);

  template.hasResourceProperties("AWS::DynamoDB::Table", {
    TableName: "TemperatureTable",
    BillingMode: "PAY_PER_REQUEST",
  });
  template.hasResourceProperties("AWS::DynamoDB::Table", {
    TableName: "HumidityTable",
    BillingMode: "PAY_PER_REQUEST",
  });

  template.hasResourceProperties("AWS::DynamoDB::Table", {
    KeySchema: Match.arrayWith([
      Match.objectLike({ AttributeName: "device_id", KeyType: "HASH" }),
      Match.objectLike({ AttributeName: "timestamp", KeyType: "RANGE" }),
    ]),
    AttributeDefinitions: Match.arrayWith([
      Match.objectLike({ AttributeName: "device_id", AttributeType: "S" }),
      Match.objectLike({ AttributeName: "timestamp", AttributeType: "N" }),
    ]),
  });
});

test("lambda functions created", () => {
  const app = new cdk.App();
  const stack = new Cdk.CdkStack(app, "MyTestStack");

  const template = Template.fromStack(stack);

  template.resourceCountIs("AWS::Lambda::Function", 2);

  template.hasResourceProperties("AWS::Lambda::Function", {
    Handler: "index.temperatureHandler",
    FunctionName: "TemperatureHandlerFunction",
    Runtime: "nodejs22.x",
    Environment: {
      Variables: {
        TEMPERATURE_TABLE_NAME: {
          Ref: "TemparatureTableAndHandlerTemperatureTableD365FA1E",
        },
      },
    },
  });

  template.hasResourceProperties("AWS::Lambda::Function", {
    Handler: "index.humidityHandler",
    FunctionName: "HumidityHandlerFunction",
    Runtime: "nodejs22.x",
    Environment: {
      Variables: {
        HUMIDITY_TABLE_NAME: {
          Ref: "HumidityTableAndHandlerHumidityTable660BC191",
        },
      },
    },
  });
});
