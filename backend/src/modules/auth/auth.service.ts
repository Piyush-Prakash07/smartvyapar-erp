import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { CompaniesService } from '../companies/companies.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Role, User, Prisma } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private companiesService: CompaniesService,
    private mailService: MailService,
    private jwtService: JwtService,
  ) {}

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async comparePasswords(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generates a cryptographically secure 6-digit numeric OTP string
   */
  generateSecureOtp(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Hashes an OTP code with bcrypt before storing in database
   */
  async hashOtp(otp: string): Promise<string> {
    return bcrypt.hash(otp, 10);
  }

  async generateTokens(user: User, tx?: Prisma.TransactionClient) {
    const payload = { sub: user.id, email: user.email };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      },
    );

    // Save refresh token hash to db
    const salt = await bcrypt.genSalt(10);
    const refreshTokenHash = await bcrypt.hash(refreshToken, salt);

    if (tx) {
      await tx.user.update({
        where: { id: user.id },
        data: { refreshTokenHash },
      });
    } else {
      await this.usersService.updateRefreshToken(user.id, refreshTokenHash);
    }

    return {
      accessToken,
      refreshToken,
    };
  }

  async register(dto: RegisterDto) {
    const normalizedEmail = dto.email ? dto.email.toLowerCase().trim() : null;
    const normalizedPhone = dto.phone ? dto.phone.replace(/\s+/g, '') : null;

    if (!normalizedEmail && !normalizedPhone) {
      throw new BadRequestException(
        'Please provide at least an email address or a mobile phone number for registration.',
      );
    }

    // Check duplicate email
    if (normalizedEmail) {
      const existingEmail =
        await this.usersService.findByEmail(normalizedEmail);
      if (existingEmail) {
        throw new ConflictException(
          'An account with this email address already exists. Please log in.',
        );
      }
    }

    // Check duplicate phone
    if (normalizedPhone) {
      const existingPhone =
        await this.usersService.findByPhone(normalizedPhone);
      if (existingPhone) {
        throw new ConflictException(
          'An account with this mobile phone number already exists. Please log in.',
        );
      }
    }

    const passwordHash = await this.hashPassword(dto.password);

    // If an email address is provided, email verification is required
    const requiresVerification = Boolean(normalizedEmail);
    let otp: string | null = null;
    let otpHash: string | null = null;
    let otpExpiry: Date | null = null;

    if (requiresVerification) {
      otp = this.generateSecureOtp();
      otpHash = await this.hashOtp(otp);
      otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
    }

    // Run Company and User creation in a database transaction block
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create User
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          phone: normalizedPhone,
          passwordHash,
          fullName: dto.fullName.trim(),
          status: requiresVerification ? 'PENDING_VERIFICATION' : 'ACTIVE',
          emailVerified: !requiresVerification,
          isEmailVerified: !requiresVerification,
          isPhoneVerified: Boolean(normalizedPhone),
          emailVerificationOtpHash: otpHash,
          emailVerificationExpiry: otpExpiry,
          emailVerificationAttempts: 0,
          emailVerificationLastSentAt: requiresVerification ? new Date() : null,
        },
      });

      // 2. Create Initial Company
      const company = await tx.company.create({
        data: {
          name: dto.companyName.trim(),
          gstin: dto.gstin?.trim() || null,
          address: dto.address?.trim() || null,
          phone: normalizedPhone || null,
          email: normalizedEmail || null,
        },
      });

      // 3. Create CompanyUser Link as OWNER
      await tx.companyUser.create({
        data: {
          companyId: company.id,
          userId: user.id,
          role: Role.OWNER,
        },
      });

      return { user, company };
    });

    // 4. Send verification email if required
    if (requiresVerification && normalizedEmail && otp) {
      await this.mailService.sendEmailVerificationOtp(
        normalizedEmail,
        otp,
        dto.fullName.trim(),
      );

      return {
        message: 'Registration successful. Please verify your email.',
        requiresEmailVerification: true,
        email: normalizedEmail,
      };
    }

    // If no email verification required (phone only), issue tokens
    const tokens = await this.generateTokens(result.user);
    const companyWithRole = {
      ...result.company,
      role: Role.OWNER,
    };

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        phone: result.user.phone,
        fullName: result.user.fullName,
      },
      company: companyWithRole,
      companies: [companyWithRole],
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      message: 'Registration successful.',
      requiresEmailVerification: false,
    };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const submittedOtp = dto.otp.trim();

    if (!/^[0-9]{6}$/.test(submittedOtp)) {
      throw new BadRequestException('Verification code must be exactly 6 numeric digits.');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: 'insensitive' },
      },
    });

    if (!user) {
      throw new NotFoundException('No account found for the provided email address.');
    }

    if (user.emailVerified || user.isEmailVerified) {
      return {
        message: 'Email is already verified. You can log in to your account.',
        success: true,
        alreadyVerified: true,
      };
    }

    // Check maximum failed attempts
    if (user.emailVerificationAttempts >= 5) {
      throw new BadRequestException(
        'Maximum verification attempts exceeded. Please request a new verification code.',
      );
    }

    // Check OTP expiry
    if (!user.emailVerificationExpiry || user.emailVerificationExpiry < new Date()) {
      throw new BadRequestException(
        'Verification code has expired. Please request a new code.',
      );
    }

    if (!user.emailVerificationOtpHash) {
      throw new BadRequestException(
        'No active verification code found. Please request a new code.',
      );
    }

    // Compare submitted OTP with stored hash
    const isValidOtp = await bcrypt.compare(
      submittedOtp,
      user.emailVerificationOtpHash,
    );

    if (!isValidOtp) {
      const nextAttempts = user.emailVerificationAttempts + 1;

      if (nextAttempts >= 5) {
        // Invalidate current OTP
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            emailVerificationAttempts: nextAttempts,
            emailVerificationOtpHash: null,
            emailVerificationExpiry: null,
          },
        });
        throw new BadRequestException(
          'Invalid verification code. Maximum attempts reached. Please request a new code.',
        );
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationAttempts: nextAttempts,
        },
      });

      const remainingAttempts = 5 - nextAttempts;
      throw new BadRequestException(
        `Invalid verification code. ${remainingAttempts} attempt(s) remaining.`,
      );
    }

    // Successful verification: activate user and clear OTP fields
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        isEmailVerified: true,
        status: 'ACTIVE',
        emailVerificationOtpHash: null,
        emailVerificationExpiry: null,
        emailVerificationAttempts: 0,
        emailVerificationLastSentAt: null,
        emailOtp: null,
        emailOtpExpires: null,
      },
    });

    return {
      message: 'Email verified successfully. You can now log in to your account.',
      success: true,
    };
  }

  async resendVerificationOtp(dto: ResendOtpDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const user = await this.prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: 'insensitive' },
      },
    });

    // To prevent user enumeration, return a general success message if user doesn't exist
    if (!user || !user.email) {
      return {
        message: 'If an account exists with this email address, a verification code has been sent.',
        success: true,
      };
    }

    if (user.emailVerified || user.isEmailVerified) {
      return {
        message: 'This email is already verified. You can log in directly.',
        success: true,
        alreadyVerified: true,
      };
    }

    // Check resend cooldown (60 seconds)
    if (user.emailVerificationLastSentAt) {
      const elapsedSeconds = Math.floor(
        (Date.now() - user.emailVerificationLastSentAt.getTime()) / 1000,
      );
      if (elapsedSeconds < 60) {
        const waitTime = 60 - elapsedSeconds;
        throw new BadRequestException(
          `Please wait ${waitTime} second${waitTime === 1 ? '' : 's'} before requesting another verification code.`,
        );
      }
    }

    // Generate new OTP & hash
    const newOtp = this.generateSecureOtp();
    const newOtpHash = await this.hashOtp(newOtp);
    const newExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationOtpHash: newOtpHash,
        emailVerificationExpiry: newExpiry,
        emailVerificationAttempts: 0,
        emailVerificationLastSentAt: new Date(),
      },
    });

    await this.mailService.sendEmailVerificationOtp(
      user.email,
      newOtp,
      user.fullName || undefined,
    );

    return {
      message: 'A new verification code has been sent to your email address.',
      success: true,
    };
  }

  async login(dto: LoginDto) {
    const rawIdentifier = dto.identifier.trim();
    const emailCandidate = rawIdentifier.toLowerCase();
    const cleanPhone = rawIdentifier.replace(/\s+/g, '');
    const phoneDigits = rawIdentifier.replace(/[^0-9]/g, '');
    const mobile10 = phoneDigits.slice(-10);

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: emailCandidate, mode: 'insensitive' } },
          { phone: rawIdentifier },
          { phone: cleanPhone },
          ...(mobile10.length === 10
            ? [{ phone: { contains: mobile10 } }]
            : []),
        ],
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        'Invalid email/mobile number or password credentials',
      );
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'This account does not have a password set. Please contact administrator.',
      );
    }

    const matches = await this.comparePasswords(
      dto.password,
      user.passwordHash,
    );
    if (!matches) {
      throw new UnauthorizedException(
        'Invalid email/mobile number or password credentials',
      );
    }

    // If user's email is not verified, block login and require verification
    if (user.email && (!user.emailVerified && !user.isEmailVerified)) {
      throw new UnauthorizedException({
        message: 'Please verify your email before logging in.',
        requiresEmailVerification: true,
        email: user.email,
      });
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'Your account is inactive or suspended. Please contact support.',
      );
    }

    const tokens = await this.generateTokens(user);
    const companies = await this.companiesService.findUserCompanies(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
      },
      companies,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<{ sub: string; email?: string }>(
        refreshToken,
        {
          secret: process.env.JWT_REFRESH_SECRET,
        },
      );

      const user = await this.usersService.findById(payload.sub);
      if (!user || !user.refreshTokenHash) {
        throw new UnauthorizedException('User session not found');
      }

      const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
      if (!matches) {
        throw new UnauthorizedException('Invalid session token');
      }

      // Issue fresh tokens
      const tokens = await this.generateTokens(user);

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }
  }

  async logout(userId: string) {
    await this.usersService.updateRefreshToken(userId, null);
    return { success: true };
  }
}
