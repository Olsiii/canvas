import type { EmailClient, EmailMessage } from "./types";

// No SMTP_HOST configured in this environment — logs instead of sending,
// same degrade-gracefully precedent as brain/mock-client.ts.
export class MockEmailClient implements EmailClient {
  async send(message: EmailMessage): Promise<void> {
    console.log(`[email:mock] to=${message.to} subject="${message.subject}"`);
  }
}
