import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { CompaniesService } from '../companies/companies.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { Role, User, Prisma } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private companiesService: CompaniesService,
    private jwtService: JwtService,
  ) {}

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async comparePasswords(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
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

    // Run Company and User creation in a database transaction block
    return this.prisma.$transaction(async (tx) => {
      // 1. Create User with ACTIVE status immediately (No OTP required)
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          phone: normalizedPhone,
          passwordHash,
          fullName: dto.fullName.trim(),
          status: 'ACTIVE',
          isEmailVerified: Boolean(normalizedEmail),
          isPhoneVerified: Boolean(normalizedPhone),
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

      // 4. Generate JWT tokens for instant login
      const tokens = await this.generateTokens(user, tx);

      const companyWithRole = {
        ...company,
        role: Role.OWNER,
      };

      return {
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          fullName: user.fullName,
        },
        company: companyWithRole,
        companies: [companyWithRole],
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        message: 'Registration successful.',
      };
    });
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
