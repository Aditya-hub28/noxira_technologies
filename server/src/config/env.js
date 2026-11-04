const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

module.exports = {
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
