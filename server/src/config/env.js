import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const generateSecret = () => crypto.randomBytes(32).toString('hex');

const env = {
  PORT: process.env.PORT || 5000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/ca-portal',
  JWT_SECRET: process.env.JWT_SECRET || generateSecret(),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 52428800,
  MAX_STORAGE_LIMIT: parseInt(process.env.MAX_STORAGE_LIMIT) || 209715200,
  NODE_ENV: process.env.NODE_ENV || 'production',
};

if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET not set — using auto-generated random secret. Tokens will be invalidated on server restart.');
}

if (env.NODE_ENV === 'development') {
  console.warn('Server running in development mode. Set NODE_ENV=production in .env for production use.');
}

export default env;
