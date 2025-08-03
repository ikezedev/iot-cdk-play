export interface Environment {
  accountId: string;
  region: string;
  topicName: string;
  baseArn: string;
}

export function getEnvironment(): Environment {
  const accountId = process.env.ACCOUNT_ID;
  const region = process.env.REGION;
  const topicName = process.env.TOPIC_NAME;
  const baseArn = process.env.BASE_ARN;

  if (!accountId || !region || !topicName || !baseArn) {
    throw new Error("Missing environment variables");
  }

  return {
    accountId,
    region,
    topicName,
    baseArn,
  };
}
