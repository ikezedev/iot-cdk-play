import * as dotenv from "dotenv";
import { existsSync } from "node:fs";
import * as path from "node:path";

// Load environment variables from .env file if it exists
const envFilePath = path.resolve(__dirname, "../../.env");
if (existsSync(envFilePath)) {
  dotenv.config({ path: envFilePath });
} else {
  console.warn("No .env file found, using environment variables directly.");
}

export class Environment {
  accountId: string;
  region: string;
  topicName: string;
  baseArn: string;
  certArn: string;

  constructor(
    accountId: string,
    region: string,
    topicName: string,
    certArn: string
  ) {
    this.accountId = accountId;
    this.region = region;
    this.topicName = topicName;
    this.certArn = certArn;
  }

  static getEnvironment(): Environment {
    const accountId = process.env.AWS_ACCOUNT_ID;
    const region = process.env.AWS_REGION;
    const topicName = process.env.AWS_TOPIC_NAME;
    const certArn = process.env.CERT_ARN;

    if (!accountId || !region || !topicName || !certArn) {
      throw new Error("Missing environment variables");
    }

    return new Environment(accountId, region, topicName, certArn);
  }

  getNamespace(resource: string): string {
    return `arn:aws:${resource}:${this.region}:${this.accountId}`;
  }
}
