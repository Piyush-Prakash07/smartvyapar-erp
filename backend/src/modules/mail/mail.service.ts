import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    const host = process.env.SMTP_HOST || process.env.MAIL_HOST;
    const portStr = process.env.SMTP_PORT || process.env.MAIL_PORT || '587';
    const port = parseInt(portStr, 10);
    const user = process.env.SMTP_USER || process.env.MAIL_USER;
    const pass = process.env.SMTP_PASS || process.env.MAIL_PASSWORD;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      this.logger.log(`SMTP Mailer initialized for host: ${host}:${port}`);
    } else {
      this.logger.warn(
        'SMTP/MAIL credentials not fully configured in .env. Running in DEV mode: Verification OTP codes will be logged to the console.',
      );
    }
  }

  /**
   * Send 6-digit OTP verification email to user
   */
  async sendEmailVerificationOtp(
    toEmail: string,
    otp: string,
    fullName?: string,
  ): Promise<boolean> {
    const fromAddress =
      process.env.SMTP_FROM ||
      process.env.MAIL_FROM ||
      '"SmartVyapar ERP" <no-reply@smartvyapar.com>';
    const subject = 'Verify your SmartVyapar email';

    const greetingName = fullName ? fullName.trim() : 'Business Owner';

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify your SmartVyapar email</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 24px; color: #334155; }
          .card { max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 20px; padding: 36px 32px; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 24px; }
          .logo-box { display: inline-block; background: linear-gradient(135deg, #004870 0%, #002f4a 100%); color: #facc15; padding: 10px 22px; border-radius: 12px; font-weight: 900; font-size: 17px; letter-spacing: 0.5px; box-shadow: 0 4px 6px -1px rgba(0, 72, 112, 0.2); }
          .title { font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 20px; margin-bottom: 8px; }
          .subtitle { font-size: 14px; color: #64748b; margin: 0; line-height: 1.5; }
          .otp-container { text-align: center; margin: 30px 0; }
          .otp-code { display: inline-block; background: #f0fdf4; border: 2px dashed #16a34a; color: #15803d; font-size: 34px; font-weight: 900; letter-spacing: 10px; padding: 16px 32px; border-radius: 14px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; box-shadow: 0 2px 4px rgba(22, 163, 74, 0.08); }
          .info { font-size: 13px; color: #475569; line-height: 1.6; text-align: center; margin: 20px 0 0 0; }
          .warning-box { background: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 12px 16px; margin-top: 20px; font-size: 12px; color: #92400e; text-align: center; }
          .footer { text-align: center; margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div class="logo-box">SmartVyapar ERP</div>
            <h2 class="title">Verify Your Business Email</h2>
            <p class="subtitle">Namaste ${greetingName}, please use the verification code below to verify your email address and activate your ERP account.</p>
          </div>
          <div class="otp-container">
            <div class="otp-code">${otp}</div>
          </div>
          <p class="info">
            This verification code is valid for <strong>10 minutes</strong>.
          </p>
          <div class="warning-box">
            <strong>Security Notice:</strong> Never share this code with anyone. SmartVyapar support staff will never ask for your verification code.
          </div>
          <div class="footer">
            SmartVyapar ERP — Smart Business Accounting & GST Billing Platform<br>
            If you did not register for an account or request this code, please safely disregard this email.
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `SmartVyapar ERP - Email Verification\n\n` +
      `Namaste ${greetingName},\n\n` +
      `Your verification code is: ${otp}\n\n` +
      `This code expires in 10 minutes.\n` +
      `Warning: Do not share this code with anyone.\n\n` +
      `SmartVyapar ERP Team`;

    // High visibility console banner in dev / debug mode
    console.log('\n======================================================');
    console.log(`[SmartVyapar ERP] EMAIL VERIFICATION OTP FOR: ${toEmail}`);
    console.log(`[SmartVyapar ERP] VERIFICATION CODE: >> ${otp} <<`);
    console.log(`[SmartVyapar ERP] VALID FOR: 10 Minutes`);
    console.log('======================================================\n');

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: fromAddress,
          to: toEmail,
          subject,
          html: htmlContent,
          text: textContent,
        });
        this.logger.log(
          `Verification OTP email successfully sent to ${toEmail}`,
        );
        return true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Failed to send verification email to ${toEmail}: ${message}`,
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Backward-compatible alias
   */
  async sendOtpEmail(
    toEmail: string,
    fullName: string,
    otp: string,
  ): Promise<boolean> {
    return this.sendEmailVerificationOtp(toEmail, otp, fullName);
  }
}
