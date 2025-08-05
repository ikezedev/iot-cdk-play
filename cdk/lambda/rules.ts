import { Humidity, Temperature } from "../protos/types";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommandInput } from "@aws-sdk/lib-dynamodb";

export const humidityHandler = async (input: { data: string }) => {
  console.log("Humidity Event received:", input);

  const data = parse(input.data, Humidity.fromBinary.bind(Humidity));
  await baseHandler(data, "HUMIDITY_TABLE_NAME");
};

export const temperatureHandler = async (input: { data: string }) => {
  console.log("Temperature Event received:", input);

  const data = parse(input.data, Temperature.fromBinary.bind(Temperature));
  await baseHandler(data, "TEMPERATURE_TABLE_NAME");
};

const baseHandler = async (
  data: { deviceId: string; timestamp: bigint; value: number },
  tableNameEnv: string
) => {
  console.log("Input Data:", data);

  const { deviceId, timestamp, value } = data;

  const client = new DynamoDBClient({});
  const docClient = DynamoDBDocumentClient.from(client);

  const tableName = process.env[tableNameEnv];
  if (!tableName) {
    console.error(`${tableNameEnv} name not configured`);
    return;
  }

  try {
    const params: PutCommandInput = {
      TableName: tableName,
      Item: {
        device_id: {
          S: deviceId,
        },
        value: {
          N: value.toString(),
        },
        timestamp: {
          N: timestamp.toString(),
        },
      },
    };
    const command = new PutItemCommand(params);
    const response = await docClient.send(command);
    console.log("Data inserted successfully:", response);
  } catch (error) {
    console.error("Error inserting data:", error);
  }
};

function parse<T>(input: string, fn: (data: Uint8Array) => T): T {
  try {
    const buffer = Buffer.from(input, "base64");
    return fn(buffer);
  } catch (error) {
    console.error("Error parsing input:", error);
    throw error;
  }
}
