import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { CompaniesService } from '../companies/companies.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import {
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService (Password-Only Authentication)', () => {
  let authService: AuthService;

  const mockUser = {
    id: 'user-uuid-1',
    email: 'merchant@smartvyapar.com',
    phone: '9876543210',
    fullName: 'Ramesh Kumar',
    passwordHash: '',
    status: 'ACTIVE',
    isEmailVerified: true,
    isPhoneVerified: true,
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
            create: jest.fn().mockResolvedValue(mockUser),
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

  const mockJwtService = {
    sign: jest.fn(
      (payload: { sub?: string; email?: string | null }) =>
        `mock_token_${payload.sub ?? 'test'}`,
    ),
    verify: jest.fn(),
  };

  beforeAll(async () => {
    mockUser.passwordHash = await bcrypt.hash('SecurePass123!', 10);
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: CompaniesService, useValue: mockCompaniesService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('Registration Flow', () => {
    it('1. Register with email + password -> success without OTP (Status = ACTIVE)', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      const result = await authService.register({
        companyName: 'Ramesh Trading Co',
        fullName: 'Ramesh Kumar',
        email: 'merchant@smartvyapar.com',
        password: 'SecurePass123!',
      });

      expect(result).toBeDefined();
      expect(result.user.email).toBe('merchant@smartvyapar.com');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.message).toBe('Registration successful.');
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('2. Register with phone + password -> success without OTP (Status = ACTIVE)', async () => {
      mockUsersService.findByPhone.mockResolvedValue(null);

      const result = await authService.register({
        companyName: 'Ramesh Mobile Trading',
        fullName: 'Ramesh Kumar',
        phone: '9876543210',
        password: 'SecurePass123!',
      });

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('7. Missing both email and phone during registration -> validation error (BadRequestException)', async () => {
      await expect(
        authService.register({
          companyName: 'No Contact Business',
          fullName: 'Anon User',
          password: 'SecurePass123!',
        }),
      ).rejects.toThrow(BadRequestException);
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

  describe('Login Flow', () => {
    it('3. Login using email + password -> success', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      const result = await authService.login({
        identifier: 'merchant@smartvyapar.com',
        password: 'SecurePass123!',
      });

      expect(result).toBeDefined();
      expect(result.user.email).toBe('merchant@smartvyapar.com');
      expect(result.accessToken).toBeDefined();
      expect(result.companies).toHaveLength(1);
    });

    it('4. Login using phone + password -> success', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      const result = await authService.login({
        identifier: '9876543210',
        password: 'SecurePass123!',
      });

      expect(result).toBeDefined();
      expect(result.user.fullName).toBe('Ramesh Kumar');
      expect(result.accessToken).toBeDefined();
    });

    it('5. Wrong password -> 401 Unauthorized', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      await expect(
        authService.login({
          identifier: 'merchant@smartvyapar.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('6. Unknown email/phone -> 401 Unauthorized', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(
        authService.login({
          identifier: 'unknown@user.com',
          password: 'SecurePass123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Token Rotation & Session Security', () => {
    it('8 & 9. Refresh token verification and rotation', async () => {
      const rawRefreshToken = 'valid_refresh_token_xyz';
      const tokenHash = await bcrypt.hash(rawRefreshToken, 10);
      const userWithSession = { ...mockUser, refreshTokenHash: tokenHash };

      mockJwtService.verify.mockReturnValue({ sub: 'user-uuid-1' });
      mockUsersService.findById.mockResolvedValue(userWithSession);

      const tokens = await authService.refresh(rawRefreshToken);

      expect(tokens).toBeDefined();
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
    });

    it('Logout invalidates session hash', async () => {
      await authService.logout('user-uuid-1');
      expect(mockUsersService.updateRefreshToken).toHaveBeenCalledWith(
        'user-uuid-1',
        null,
      );
    });
  });
});
