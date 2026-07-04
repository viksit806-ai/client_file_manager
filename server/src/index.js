import env from './config/env.js';
import connectDB from './config/db.js';
import app from './app.js';

const requiredVars = [
  { key: 'MONGODB_URI', name: 'MONGODB_URI' },
  { key: 'JWT_SECRET', name: 'JWT_SECRET' },
  { key: 'SUPABASE_URL', name: 'SUPABASE_URL' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', name: 'SUPABASE_SERVICE_ROLE_KEY' },
];

const missing = requiredVars.filter(v => !process.env[v.key]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.map(v => v.name).join(', ')}`);
  process.exit(1);
}

const start = async () => {
  await connectDB();
  app.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT}`);
  });
};

start();
