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
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      this.logger.log(`SMTP Mailer initialized for host: ${host}`);
    } else {
      this.logger.warn(
        'SMTP credentials not configured in .env. Running in DEV mode: OTP codes will be logged to the console.',
      );
    }
  }

  async sendOtpEmail(
    toEmail: string,
    fullName: string,
    otp: string,
  ): Promise<boolean> {
    const fromAddress =
      process.env.SMTP_FROM || '"SmartVyapar ERP" <no-reply@smartvyapar.com>';
    const subject = `${otp} is your SmartVyapar ERP Verification Code`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; }
          .card { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
          .header { text-align: center; margin-bottom: 24px; }
          .logo-box { display: inline-block; background: #004870; color: #facc15; padding: 8px 16px; border-radius: 10px; font-weight: 900; font-size: 16px; letter-spacing: 0.5px; }
          .title { font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 16px; margin-bottom: 8px; }
          .subtitle { font-size: 13px; color: #64748b; margin: 0; }
          .otp-container { text-align: center; margin: 28px 0; }
          .otp-code { display: inline-block; background: #f0fdf4; border: 2px dashed #22c55e; color: #15803d; font-size: 32px; font-weight: 900; letter-spacing: 8px; padding: 14px 28px; border-radius: 12px; font-family: monospace; }
          .info { font-size: 12px; color: #64748b; line-height: 1.6; text-align: center; }
          .footer { text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div class="logo-box">SmartVyapar ERP</div>
            <h2 class="title">Verify Your Business Account</h2>
            <p class="subtitle">Namaste ${fullName || 'Business Owner'}, please verify your email address to complete your registration.</p>
          </div>
          <div class="otp-container">
            <div class="otp-code">${otp}</div>
          </div>
          <p class="info">
            This verification code is valid for <strong>10 minutes</strong>. Do not share this code with anyone.
          </p>
          <div class="footer">
            SmartVyapar ERP — Smart Business Accounting & Khata System<br>
            If you did not request this code, please ignore this email.
          </div>
        </div>
      </body>
      </html>
    `;

    // High visibility console banner in dev / test mode
    console.log('\n======================================================');
    console.log(`[SmartVyapar ERP] EMAIL OTP FOR: ${toEmail}`);
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
          text: `Your SmartVyapar ERP verification code is: ${otp}. Valid for 10 minutes.`,
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
}
