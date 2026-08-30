import { validateEnvironment } from './env.validation';

describe('validateEnvironment', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should throw error when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL;
    expect(() => validateEnvironment()).toThrow(
      'DATABASE_URL is required but not defined in environment.',
    );
  });

  it('should throw error when JWT secrets are missing', () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_SECRET;
    expect(() => validateEnvironment()).toThrow(
      'JWT_ACCESS_SECRET (or JWT_SECRET) is required for authentication.',
    );
  });

  it('should enforce production secrets and CORS origins in production mode', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://production.db:5432/finance';
    process.env.JWT_ACCESS_SECRET =
      'your-super-secret-jwt-key-change-in-production';
    process.env.JWT_REFRESH_SECRET =
      'your-super-secret-refresh-key-change-in-production';
    delete process.env.FRONTEND_URL;
    delete process.env.FRONTEND_URLS;

    expect(() => validateEnvironment()).toThrow(
      /Insecure JWT_ACCESS_SECRET detected in production|FRONTEND_URL/,
    );
  });

  it('should pass validation with valid configuration', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL =
      'postgresql://user:securepass@db.smartvyapar.com:5432/finance_prod';
    process.env.JWT_ACCESS_SECRET = 'c8b9d3f1a6e7428905b1c3d5e7f9a2b4';
    process.env.JWT_REFRESH_SECRET = 'f9a2b4c8b9d3f1a6e7428905b1c3d5e7';
    process.env.FRONTEND_URL = 'https://app.smartvyapar.com';

    expect(() => validateEnvironment()).not.toThrow();
  });
});
