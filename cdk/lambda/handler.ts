import { Humidity, Temperature } from "../protos/types";

export const humidityHandler = async (input: string) => {
  console.log("Event received:", input);

  // Process the event data
  const { deviceId, timestamp, value } = parse(input, Humidity.fromBinary);

  // Log the data for debugging
  console.log(
    `Device ID: ${deviceId}, Timestamp: ${timestamp}, Humidity: ${value}`
  );

  // Here you would typically insert the data into DynamoDB tables
  // For example:
  // await temperatureTable.put({ device_id, temperature, timestamp: Date.now() });
  // await humidityTable.put({ device_id, humidity, timestamp: Date.now() });

  return {
    timestamp: new Date(Number(timestamp)),
    deviceId,
    value,
  };
};

export const temperatureHandler = async (input: string) => {
  console.log("Event received:", input);

  // Process the event data
  const { deviceId, timestamp, value } = parse(input, Temperature.fromBinary);

  // Log the data for debugging
  console.log(
    `Device ID: ${deviceId}, Timestamp: ${timestamp}, Temperature: ${value}`
  );

  // Here you would typically insert the data into DynamoDB tables
  // For example:
  // await temperatureTable.put({ device_id, temperature, timestamp: Date.now() });
  // await humidityTable.put({ device_id, humidity, timestamp: Date.now() });

  return {
    timestamp: new Date(Number(timestamp)),
    deviceId,
    value,
  };
};

function parse<T>(input: string, fn: (data: Uint8Array) => T): T {
  return fn(Buffer.from(input, "hex"));
}
