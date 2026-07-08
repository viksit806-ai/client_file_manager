import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      JWT_SECRET: 'test-secret-key',
      NODE_ENV: 'test',
      UPLOAD_DIR: './test-uploads',
      MAX_FILE_SIZE: '52428800',
      MAX_STORAGE_LIMIT: '209715200',
      JWT_EXPIRES_IN: '1h',
      // Set these to a test Supabase project for integration tests:
      // SUPABASE_URL: 'https://your-test-project.supabase.co',
      // SUPABASE_SERVICE_ROLE_KEY: 'your-test-service-role-key',
    },
  },
});
