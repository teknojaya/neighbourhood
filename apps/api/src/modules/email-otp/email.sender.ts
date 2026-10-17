import nodemailer from 'nodemailer';
import type { SmtpConfig } from '../../config.js';

export interface EmailSender {
  sendOtp(to: string, code: string, ttlMinutes: number): Promise<void>;
}

/**
 * Real email delivery over SMTP (any relay: Google Workspace SMTP relay,
 * or a transactional provider's SMTP endpoint). TLS is mandatory: implicit
 * TLS on 465, or STARTTLS required otherwise.
 */
export class SmtpEmailSender implements EmailSender {
  private readonly transport;

  constructor(private readonly cfg: SmtpConfig) {
    this.transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      requireTLS: !cfg.secure,
      ...(cfg.user && cfg.password ? { auth: { user: cfg.user, pass: cfg.password } } : {}),
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }

  async sendOtp(to: string, code: string, ttlMinutes: number): Promise<void> {
    const text = [
      `Your NeighbourHood sign-in code is ${code}`,
      `It expires in ${ttlMinutes} minutes. If you did not request it, ignore this email.`,
      '',
      `Kode masuk NeighbourHood Anda: ${code}`,
      `Berlaku ${ttlMinutes} menit. Abaikan email ini jika Anda tidak memintanya.`,
    ].join('\n');
    await this.transport.sendMail({
      from: this.cfg.from,
      to,
      subject: `${code} is your NeighbourHood sign-in code`,
      text,
    });
  }
}
