const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || '',
  JWT_SECRET: process.env.JWT_SECRET || 'noxira_default_insecure_jwt_secret_dev_only',
  JWT_EXPIRES_IN: '24h',
  API_BASE_URL: process.env.API_BASE_URL || process.env.VERIFY_BASE_URL || 'http://localhost:5173',
  VERIFY_BASE_URL: process.env.VERIFY_BASE_URL || 'http://localhost:5173',
  STORAGE_DIR: path.resolve(__dirname, '../../storage/certificates'),
  PRIVATE_ASSETS_DIR: path.resolve(__dirname, '../assets/private'),
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  SMTP: {
    HOST: process.env.SMTP_HOST || 'smtp.ethereal.email',
    PORT: parseInt(process.env.SMTP_PORT || '587', 10),
    USER: process.env.SMTP_USER || '',
    PASS: process.env.SMTP_PASS || '',
    FROM: process.env.SMTP_FROM || 'certificates@noxira.com'
  }
};

function validateEnv(conf = config) {
  if (conf.NODE_ENV === 'production') {
    const errors = [];
    if (!conf.MONGODB_URI || conf.MONGODB_URI.trim() === '') {
      errors.push('MONGODB_URI environment variable is required in production.');
    }
    if (!conf.JWT_SECRET || conf.JWT_SECRET === 'noxira_default_insecure_jwt_secret_dev_only') {
      errors.push('JWT_SECRET must be explicitly set in production and cannot be the default fallback.');
    } else if (conf.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters long in production for cryptographic safety.');
    }

    // SMTP Credentials Validation in Production (prevents silent mock emails)
    if (!conf.SMTP || !conf.SMTP.HOST || conf.SMTP.HOST.trim() === '' || conf.SMTP.HOST === 'smtp.ethereal.email') {
      errors.push('SMTP_HOST is required in production and cannot use the development ethereal mock host.');
    }
    if (!conf.SMTP || !conf.SMTP.USER || conf.SMTP.USER.trim() === '' || conf.SMTP.USER === 'test@example.com') {
      errors.push('SMTP_USER is required in production.');
    }
    if (!conf.SMTP || !conf.SMTP.PASS || conf.SMTP.PASS.trim() === '' || conf.SMTP.PASS === 'password') {
      errors.push('SMTP_PASS is required in production.');
    }

    if (errors.length > 0) {
      throw new Error(`[CRITICAL CONFIG ERROR] Startup halted due to insecure production configuration:\n - ${errors.join('\n - ')}`);
    }
  }
}

// Enforce validation on module load in production
if (config.NODE_ENV === 'production') {
  validateEnv(config);
}

module.exports = {
  ...config,
  validateEnv
};
