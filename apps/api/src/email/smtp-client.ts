import nodemailer from "nodemailer";
import { env } from "../env";
import type { EmailClient, EmailMessage } from "./types";

export class SmtpEmailClient implements EmailClient {
  private transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({ from: env.EMAIL_FROM, ...message });
  }
}
