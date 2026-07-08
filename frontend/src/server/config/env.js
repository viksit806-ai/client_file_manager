import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

const cwd = process.cwd();
dotenv.config({ path: path.resolve(cwd, '.env.local') });
dotenv.config({ path: path.resolve(cwd, '.env') });
dotenv.config({ path: path.resolve(cwd, '../server/.env') });

const generateSecret = () => crypto.randomBytes(32).toString('hex');

const env = {
  PORT: process.env.PORT || 5000,
  JWT_SECRET: process.env.JWT_SECRET || generateSecret(),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 52428800,
  MAX_STORAGE_LIMIT: parseInt(process.env.MAX_STORAGE_LIMIT) || 209715200,
  NODE_ENV: process.env.NODE_ENV || 'production',
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_BUCKET: process.env.SUPABASE_BUCKET || 'files',
};

if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET not set - using auto-generated random secret. Tokens will be invalidated on server restart.');
}

// Removed dev mode warning to prevent Next.js dev overlay popups

export default env;
