import { env } from "../env";
import { MockEmailClient } from "./mock-client";
import { SmtpEmailClient } from "./smtp-client";
import type { EmailClient } from "./types";

let client: EmailClient | undefined;

export function getEmailClient(): EmailClient {
  if (!client) {
    client = env.SMTP_HOST ? new SmtpEmailClient() : new MockEmailClient();
  }
  return client;
}

export * from "./types";
