import * as cdk from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import * as Cdk from "../lib/cdk-stack";

let template: Template;

beforeAll(() => {
  const app = new cdk.App();
  const stack = new Cdk.CdkStack(app, "MyTestStack");
  template = Template.fromStack(stack);
});

test("dynamodb tables created", () => {
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
  template.resourceCountIs("AWS::Lambda::Function", 2);

  template.hasResourceProperties("AWS::Lambda::Function", {
    Handler: "index.temperatureHandler",
    FunctionName: "TemperatureHandlerFunction",
    Runtime: "nodejs22.x",
    Environment: {
      Variables: {
        TEMPERATURE_TABLE_NAME: {
          Ref: "TemperatureTable6C2EF813",
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
          Ref: "HumidityTable10436007",
        },
      },
    },
  });
});

describe("Weather Sensor IoT", () => {
  test("Topic Rules created", () => {
    template.resourceCountIs("AWS::IoT::TopicRule", 2);

    template.hasResourceProperties("AWS::IoT::TopicRule", {
      TopicRulePayload: {
        RuleDisabled: false,
        Sql: "SELECT encode(*, 'base64') as data FROM 'monitoring/temperature'",
        AwsIotSqlVersion: "2016-03-23",
        Actions: Match.arrayWith([
          Match.objectLike({
            Lambda: Match.objectLike({
              FunctionArn: {
                "Fn::GetAtt": ["TemperatureHandlerFunction689D8EDF", "Arn"],
              },
            }),
          }),
        ]),
      },
    });
    template.hasResourceProperties("AWS::IoT::TopicRule", {
      TopicRulePayload: {
        RuleDisabled: false,
        Sql: "SELECT encode(*, 'base64') as data FROM 'monitoring/humidity'",
        AwsIotSqlVersion: "2016-03-23",
        Actions: Match.arrayWith([
          Match.objectLike({
            Lambda: Match.objectLike({
              FunctionArn: {
                "Fn::GetAtt": ["HumidityHandlerFunctionF7B098D6", "Arn"],
              },
            }),
          }),
        ]),
      },
    });
  });

  test("Lambda permissions for IoT", () => {
    template.resourceCountIs("AWS::Lambda::Permission", 2);
    template.hasResourceProperties("AWS::Lambda::Permission", {
      Action: "lambda:InvokeFunction",
      FunctionName: {
        "Fn::GetAtt": ["TemperatureHandlerFunction689D8EDF", "Arn"],
      },
      Principal: "iot.amazonaws.com",
      SourceArn: {
        "Fn::GetAtt": ["WeatherSensorIoTTemperatureRuleBB404478", "Arn"],
      },
    });

    template.hasResourceProperties("AWS::Lambda::Permission", {
      Action: "lambda:InvokeFunction",
      FunctionName: {
        "Fn::GetAtt": ["HumidityHandlerFunctionF7B098D6", "Arn"],
      },
      Principal: "iot.amazonaws.com",
      SourceArn: {
        "Fn::GetAtt": ["WeatherSensorIoTHumidityRuleC2281067", "Arn"],
      },
    });
  });
});
