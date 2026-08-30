import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { CompaniesService } from '../companies/companies.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import {
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService (Email Verification & 6-Digit OTP System)', () => {
  let authService: AuthService;

  const mockUser = {
    id: 'user-uuid-1',
    email: 'merchant@smartvyapar.com',
    phone: '9876543210',
    fullName: 'Ramesh Kumar',
    passwordHash: '',
    status: 'ACTIVE',
    emailVerified: true,
    isEmailVerified: true,
    isPhoneVerified: true,
    emailVerificationOtpHash: null as string | null,
    emailVerificationExpiry: null as Date | null,
    emailVerificationAttempts: 0,
    emailVerificationLastSentAt: null as Date | null,
    emailOtp: null,
    emailOtpExpires: null,
    phoneOtp: null,
    phoneOtpExpires: null,
    refreshTokenHash: null as string | null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUnverifiedUser = {
    id: 'user-uuid-unverified',
    email: 'newuser@smartvyapar.com',
    phone: '9876543211',
    fullName: 'New Merchant',
    passwordHash: '',
    status: 'PENDING_VERIFICATION',
    emailVerified: false,
    isEmailVerified: false,
    isPhoneVerified: false,
    emailVerificationOtpHash: '',
    emailVerificationExpiry: new Date(Date.now() + 10 * 60 * 1000), // 10 min
    emailVerificationAttempts: 0,
    emailVerificationLastSentAt: new Date(),
    emailOtp: null,
    emailOtpExpires: null,
    phoneOtp: null,
    phoneOtpExpires: null,
    refreshTokenHash: null as string | null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCompany = {
    id: 'comp-uuid-1',
    name: 'Ramesh Trading Co',
    gstin: '07AAAAA0000A1Z5',
    address: 'Main Market, Delhi',
    phone: '9876543210',
    email: 'merchant@smartvyapar.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    company: {
      create: jest.fn(),
    },
    companyUser: {
      create: jest.fn(),
    },
    $transaction: jest.fn(
      async (cb: (tx: unknown) => Promise<unknown>): Promise<unknown> => {
        return await cb({
          user: {
            create: jest.fn().mockImplementation(({ data }) => ({
              ...mockUnverifiedUser,
              ...data,
              id: 'new-user-id',
            })),
            update: jest.fn().mockResolvedValue(mockUser),
          },
          company: {
            create: jest.fn().mockResolvedValue(mockCompany),
          },
          companyUser: {
            create: jest.fn().mockResolvedValue({ id: 'cu-1' }),
          },
        });
      },
    ),
  };

  const mockUsersService = {
    findByEmail: jest.fn(),
    findByPhone: jest.fn(),
    findById: jest.fn(),
    updateRefreshToken: jest.fn(),
  };

  const mockCompaniesService = {
    findUserCompanies: jest
      .fn()
      .mockResolvedValue([{ ...mockCompany, role: 'OWNER' }]),
  };

  const mockMailService = {
    sendEmailVerificationOtp: jest.fn().mockResolvedValue(true),
    sendOtpEmail: jest.fn().mockResolvedValue(true),
  };

  const mockJwtService = {
    sign: jest.fn(
      (payload: { sub?: string; email?: string | null }) =>
        `mock_token_${payload.sub ?? 'test'}`,
    ),
    verify: jest.fn(),
  };

  beforeAll(async () => {
    mockUser.passwordHash = await bcrypt.hash('SecurePass123!', 10);
    mockUnverifiedUser.passwordHash = await bcrypt.hash('SecurePass123!', 10);
    mockUnverifiedUser.emailVerificationOtpHash = await bcrypt.hash('123456', 10);
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: CompaniesService, useValue: mockCompaniesService },
        { provide: MailService, useValue: mockMailService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('TEST 1: Registration Flow with Email Verification Required', () => {
    it('Register with new email -> OTP hashed and sent, requiresEmailVerification: true, no JWT tokens issued', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      const result = await authService.register({
        companyName: 'New Merchant Co',
        fullName: 'New Merchant',
        email: 'newuser@smartvyapar.com',
        password: 'SecurePass123!',
      });

      expect(result).toBeDefined();
      expect(result.requiresEmailVerification).toBe(true);
      expect(result.email).toBe('newuser@smartvyapar.com');
      expect((result as any).accessToken).toBeUndefined();
      expect(mockMailService.sendEmailVerificationOtp).toHaveBeenCalledWith(
        'newuser@smartvyapar.com',
        expect.stringMatching(/^[0-9]{6}$/),
        'New Merchant',
      );
    });

    it('Duplicate email registration throws ConflictException', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);

      await expect(
        authService.register({
          companyName: 'Another Firm',
          fullName: 'Duplicate User',
          email: 'merchant@smartvyapar.com',
          password: 'SecurePass123!',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('TEST 2 & 3 & 4: OTP Email Verification Endpoint', () => {
    it('TEST 2: Enter correct OTP -> verification succeeds and user status becomes ACTIVE', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUnverifiedUser);
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUnverifiedUser,
        emailVerified: true,
        isEmailVerified: true,
        status: 'ACTIVE',
      });

      const result = await authService.verifyEmail({
        email: 'newuser@smartvyapar.com',
        otp: '123456',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Email verified successfully');
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUnverifiedUser.id },
          data: expect.objectContaining({
            emailVerified: true,
            isEmailVerified: true,
            status: 'ACTIVE',
            emailVerificationOtpHash: null,
            emailVerificationExpiry: null,
            emailVerificationAttempts: 0,
          }),
        }),
      );
    });

    it('TEST 3: Enter incorrect OTP -> increments attempts and rejects', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUnverifiedUser);

      await expect(
        authService.verifyEmail({
          email: 'newuser@smartvyapar.com',
          otp: '999999',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUnverifiedUser.id },
          data: { emailVerificationAttempts: 1 },
        }),
      );
    });

    it('TEST 4: Enter expired OTP -> rejected', async () => {
      const expiredUser = {
        ...mockUnverifiedUser,
        emailVerificationExpiry: new Date(Date.now() - 1000), // Expired
      };
      mockPrismaService.user.findFirst.mockResolvedValue(expiredUser);

      await expect(
        authService.verifyEmail({
          email: 'newuser@smartvyapar.com',
          otp: '123456',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Max attempts (5) reached -> invalidates OTP and requires new code', async () => {
      const userWith4Attempts = {
        ...mockUnverifiedUser,
        emailVerificationAttempts: 4,
      };
      mockPrismaService.user.findFirst.mockResolvedValue(userWith4Attempts);

      await expect(
        authService.verifyEmail({
          email: 'newuser@smartvyapar.com',
          otp: '000000',
        }),
      ).rejects.toThrow(/Maximum attempts reached/);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: userWith4Attempts.id },
          data: {
            emailVerificationAttempts: 5,
            emailVerificationOtpHash: null,
            emailVerificationExpiry: null,
          },
        }),
      );
    });
  });

  describe('TEST 5: Resend OTP Endpoint & Cooldown', () => {
    it('TEST 5: Resend OTP -> generates new OTP and dispatches email when cooldown elapsed', async () => {
      const userPastCooldown = {
        ...mockUnverifiedUser,
        emailVerificationLastSentAt: new Date(Date.now() - 65 * 1000), // 65s ago
      };
      mockPrismaService.user.findFirst.mockResolvedValue(userPastCooldown);

      const result = await authService.resendVerificationOtp({
        email: 'newuser@smartvyapar.com',
      });

      expect(result.success).toBe(true);
      expect(mockMailService.sendEmailVerificationOtp).toHaveBeenCalled();
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: userPastCooldown.id },
          data: expect.objectContaining({
            emailVerificationAttempts: 0,
          }),
        }),
      );
    });

    it('Resend OTP before 60s cooldown -> rejected with remaining cooldown seconds', async () => {
      const userWithinCooldown = {
        ...mockUnverifiedUser,
        emailVerificationLastSentAt: new Date(Date.now() - 20 * 1000), // 20s ago
      };
      mockPrismaService.user.findFirst.mockResolvedValue(userWithinCooldown);

      await expect(
        authService.resendVerificationOtp({
          email: 'newuser@smartvyapar.com',
        }),
      ).rejects.toThrow(/Please wait/);
    });
  });

  describe('TEST 6, 7 & 8: Login Behavior & Verification Enforcement', () => {
    it('TEST 6: Try login before email verification -> blocked with requiresEmailVerification: true', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUnverifiedUser);

      try {
        await authService.login({
          identifier: 'newuser@smartvyapar.com',
          password: 'SecurePass123!',
        });
        fail('Expected login to throw UnauthorizedException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(UnauthorizedException);
        expect(err.getResponse()).toEqual(
          expect.objectContaining({
            requiresEmailVerification: true,
            email: 'newuser@smartvyapar.com',
          }),
        );
      }
    });

    it('TEST 7: Login with verified user -> JWT session tokens and company list returned', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      const result = await authService.login({
        identifier: 'merchant@smartvyapar.com',
        password: 'SecurePass123!',
      });

      expect(result).toBeDefined();
      expect(result.user.email).toBe('merchant@smartvyapar.com');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.companies).toHaveLength(1);
    });

    it('TEST 8: Verified users existing token rotation and logout work seamlessly', async () => {
      const rawRefreshToken = 'valid_refresh_token_xyz';
      const tokenHash = await bcrypt.hash(rawRefreshToken, 10);
      const userWithSession = { ...mockUser, refreshTokenHash: tokenHash };

      mockJwtService.verify.mockReturnValue({ sub: 'user-uuid-1' });
      mockUsersService.findById.mockResolvedValue(userWithSession);

      const tokens = await authService.refresh(rawRefreshToken);
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();

      await authService.logout('user-uuid-1');
      expect(mockUsersService.updateRefreshToken).toHaveBeenCalledWith(
        'user-uuid-1',
        null,
      );
    });
  });
});
