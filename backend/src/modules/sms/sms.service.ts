import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  /**
   * Dispatches OTP SMS to the user's mobile number.
   * Supports:
   * 1. Fast2SMS (Popular & Instant in India - set FAST2SMS_API_KEY in .env)
   * 2. Twilio (Global SMS - set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM in .env)
   * 3. Fallback / Dev Mode: Clean console banner
   */
  async sendOtpSms(phoneNumber: string, otp: string): Promise<boolean> {
    const rawNumber = phoneNumber.replace(/[^0-9]/g, '');
    // Standard 10-digit Indian mobile number
    const mobile10 = rawNumber.length > 10 ? rawNumber.slice(-10) : rawNumber;
    const internationalPhone = phoneNumber.startsWith('+')
      ? phoneNumber
      : `+91${mobile10}`;

    // 1. Fast2SMS Provider (India Quick OTP Gateway)
    const fast2smsKey = process.env.FAST2SMS_API_KEY;
    if (fast2smsKey) {
      try {
        const response = await axios.post<{ return?: boolean }>(
          'https://www.fast2sms.com/dev/bulkV2',
          {
            variables_values: otp,
            route: 'otp',
            numbers: mobile10,
          },
          {
            headers: {
              authorization: fast2smsKey,
              'Content-Type': 'application/json',
            },
            timeout: 8000,
          },
        );

        if (response.data?.return) {
          this.logger.log(`[Fast2SMS] OTP sent successfully to ${mobile10}`);
          return true;
        } else {
          this.logger.warn(`[Fast2SMS Error] ${JSON.stringify(response.data)}`);
        }
      } catch (err: unknown) {
        let errorMsg = String(err);
        if (axios.isAxiosError<{ message?: string }>(err)) {
          errorMsg = err.response?.data?.message || err.message;
        }
        this.logger.error(`[Fast2SMS Exception] ${errorMsg}`);
      }
    }

    // 2. Twilio Provider (Global Standard)
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_FROM;

    if (twilioSid && twilioToken && twilioFrom) {
      try {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
        const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString(
          'base64',
        );
        const params = new URLSearchParams();
        params.append('To', internationalPhone);
        params.append('From', twilioFrom);
        params.append(
          'Body',
          `Your SmartVyapar ERP verification code is: ${otp}. Valid for 10 minutes.`,
        );

        const response = await axios.post<{ sid?: string }>(
          twilioUrl,
          params.toString(),
          {
            headers: {
              Authorization: `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: 8000,
          },
        );

        if (response.status === 201 || response.data?.sid) {
          this.logger.log(
            `[Twilio] OTP sent successfully to ${internationalPhone}`,
          );
          return true;
        }
      } catch (err: unknown) {
        let errorMsg = String(err);
        if (axios.isAxiosError<{ message?: string }>(err)) {
          errorMsg = err.response?.data?.message || err.message;
        }
        this.logger.error(`[Twilio Exception] ${errorMsg}`);
      }
    }

    // 3. Fallback / Development Logging
    console.log('\n======================================================');
    console.log(`📱 [SmartVyapar ERP] MOBILE SMS OTP`);
    console.log(`📱 TO PHONE: ${internationalPhone}`);
    console.log(`📱 VERIFICATION CODE: >> ${otp} <<`);
    console.log(`📱 VALID FOR: 10 Minutes`);
    console.log('======================================================\n');

    this.logger.log(
      `[SMS OTP Dispatched / Fallback Logged] Mobile: ${internationalPhone}, Code: ${otp}`,
    );
    return true;
  }
}
