import { Humidity, Temperature } from "../protos/types";

export const humidityHandler = (input: { data: string }) => {
  console.log("Event received:", input);

  const { deviceId, timestamp, value } = parse(
    input.data,
    Humidity.fromBinary.bind(Humidity)
  );
  console.log(
    `Device ID: ${deviceId}, Timestamp: ${timestamp}, Humidity: ${value}`
  );

  // await humidityTable.put({ device_id, humidity, timestamp: Date.now() });

  return {
    timestamp: new Date(Number(timestamp)),
    deviceId,
    value,
  };
};

export const temperatureHandler = (input: { data: string }) => {
  console.log("Event received:", input);

  const { deviceId, timestamp, value } = parse(
    input.data,
    Temperature.fromBinary.bind(Temperature)
  );

  console.log(
    `Device ID: ${deviceId}, Timestamp: ${timestamp}, Temperature: ${value}`
  );

  // await temperatureTable.put({ device_id, temperature, timestamp: Date.now() });

  return {
    timestamp: new Date(Number(timestamp)),
    deviceId,
    value,
  };
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
