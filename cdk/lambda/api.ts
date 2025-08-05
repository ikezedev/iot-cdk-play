import { APIGatewayEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient, QueryCommandInput } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

export const handler = async (
  event: APIGatewayEvent
): Promise<APIGatewayProxyResult> => {
  const path = event.path;
  console.log({ event });

  const client = new DynamoDBClient({});
  const docClient = DynamoDBDocumentClient.from(client);

  if (path === "/weather/temperature") {
    return baseHandler(docClient, "TEMPERATURE_TABLE_NAME");
  } else if (path === "/weather/humidity") {
    return baseHandler(docClient, "HUMIDITY_TABLE_NAME");
  }

  return {
    statusCode: 404,
    body: JSON.stringify({ message: "Route not found" }),
  };
};

const baseHandler = async (
  docClient: DynamoDBDocumentClient,
  tableNameEnv: string
): Promise<APIGatewayProxyResult> => {
  const oneMinuteAgo = Date.now() - 60 * 1000;
  const tableName = process.env[tableNameEnv];
  if (!tableName) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "`${tableNameEnv}` name not configured",
      }),
    };
  }

  try {
    const params: QueryCommandInput = {
      TableName: tableName,
      KeyConditionExpression: "timestamp > :oneMinuteAgo",
      ExpressionAttributeValues: {
        ":oneMinuteAgo": {
          N: new Date(oneMinuteAgo).toISOString(),
        },
      },
    };

    const command = new QueryCommand(params);
    const response = await docClient.send(command);
    const items = response.Items;

    console.log(items);

    return {
      statusCode: 200,
      body: JSON.stringify({
        temperature: items ? items.map((item) => item.value) : [],
      }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to fetch temperature data" }),
    };
  }
};
