import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@ca-firm.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file');
  process.exit(1);
}

if (!ADMIN_PASSWORD) {
  console.error('ADMIN_PASSWORD is not set in .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const seed = async () => {
  try {
    // Check if admin already exists
    const { data: existingAdmin } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', ADMIN_EMAIL.toLowerCase())
      .eq('role', 'super_admin')
      .single();

    if (existingAdmin) {
      console.log('Admin already exists. Skipping seed.');
      console.log('Admin email: ' + existingAdmin.email);
      return;
    }

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

    const { data: admin, error } = await supabase
      .from('profiles')
      .insert({
        name: 'Super Admin',
        email: ADMIN_EMAIL.toLowerCase(),
        password: hashedPassword,
        role: 'super_admin',
        must_change_password: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create admin:', error.message);
      process.exit(1);
    }

    console.log('\nAdmin created successfully:');
    console.log('  Email:    ' + ADMIN_EMAIL);
    console.log('  Password: (set in .env ADMIN_PASSWORD)');
    console.log('\nYou can now log in and create departments, users, and file categories from the dashboard.');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
};

seed();
