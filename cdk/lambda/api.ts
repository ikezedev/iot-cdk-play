import { APIGatewayEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  DynamoDBClient,
  QueryCommandInput,
  Select,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

export const handler = async (
  event: APIGatewayEvent
): Promise<APIGatewayProxyResult> => {
  console.log({ event });

  const client = new DynamoDBClient({});
  const docClient = DynamoDBDocumentClient.from(client);
  const resource = event.pathParameters?.resource;

  if (resource === "temperature") {
    const result = await baseHandler(
      docClient,
      "TEMPERATURE_TABLE_NAME",
      resource
    );
    return result;
  } else if (resource === "humidity") {
    const result = await baseHandler(
      docClient,
      "HUMIDITY_TABLE_NAME",
      resource
    );
    return result;
  }

  return {
    statusCode: 404,
    body: JSON.stringify({ message: "Route not found", path: event.path }),
  };
};

const baseHandler = async (
  docClient: DynamoDBDocumentClient,
  tableNameEnv: string,
  resource: string
): Promise<APIGatewayProxyResult> => {
  const oneMinuteAgo = Date.now() - 60 * 1000;
  const tableName = process.env[tableNameEnv];
  if (!tableName) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: `${tableNameEnv} name not configured`,
      }),
    };
  }

  try {
    console.log(`Fetching data for ${resource} since ${oneMinuteAgo}`);

    const params = {
      TableName: tableName,
      KeyConditionExpression:
        "#deviceIdCol = :deviceId AND #timestampCol > :oneMinuteAgo",
      ExpressionAttributeValues: {
        ":oneMinuteAgo": oneMinuteAgo,
        ":deviceId": `${resource}_sensor_1`,
      },
      ExpressionAttributeNames: {
        "#timestampCol": "timestamp",
        "#deviceIdCol": "device_id",
      },
      Select: Select.ALL_ATTRIBUTES,
      Limit: 100,
    };

    const command = new QueryCommand(params);
    const response = await docClient.send(command);
    const items = response.Items;

    return {
      statusCode: 200,
      body: JSON.stringify(items),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `Failed to fetch ${resource} data` }),
    };
  }
};
