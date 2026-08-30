/**
 * Startup Environment Variable Validator
 * Validates critical environment variables on boot and fails fast if production configuration is missing or insecure.
 */
export function validateEnvironment(): void {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const errors: string[] = [];

  // Required in all environments
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim() === '') {
    errors.push('DATABASE_URL is required but not defined in environment.');
  }

  const jwtAccess = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  if (!jwtAccess || jwtAccess.trim() === '') {
    errors.push(
      'JWT_ACCESS_SECRET (or JWT_SECRET) is required for authentication.',
    );
  }

  const jwtRefresh = process.env.JWT_REFRESH_SECRET;
  if (!jwtRefresh || jwtRefresh.trim() === '') {
    errors.push('JWT_REFRESH_SECRET is required for session rotation.');
  }

  // Strict Production Environment Validations
  if (nodeEnv === 'production') {
    const defaultPlaceholderRegex =
      /your-super-secret|change-in-production|default-secret/i;

    if (jwtAccess && defaultPlaceholderRegex.test(jwtAccess)) {
      errors.push(
        'Insecure JWT_ACCESS_SECRET detected in production. You must set a secure 32+ character random secret.',
      );
    }

    if (jwtRefresh && defaultPlaceholderRegex.test(jwtRefresh)) {
      errors.push(
        'Insecure JWT_REFRESH_SECRET detected in production. You must set a secure 32+ character random secret.',
      );
    }

    const frontendUrl = process.env.FRONTEND_URL || process.env.FRONTEND_URLS;
    if (!frontendUrl || frontendUrl.trim() === '') {
      errors.push(
        'FRONTEND_URL (or FRONTEND_URLS) is required in production to restrict CORS to approved merchant domains.',
      );
    }
  }

  if (errors.length > 0) {
    console.error(
      '\n❌ [CRITICAL CONFIGURATION ERROR] Environment validation failed:',
    );
    errors.forEach((err, idx) => console.error(`  ${idx + 1}. ${err}`));
    console.error(
      '\nPlease verify your .env file or production environment settings.\n',
    );
    throw new Error(`Environment validation failed: ${errors.join('; ')}`);
  }
}
