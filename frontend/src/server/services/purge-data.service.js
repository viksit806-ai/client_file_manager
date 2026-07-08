import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const purge = async () => {
  try {
    // Check if admin exists
    const { data: admin } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'super_admin')
      .single();

    if (!admin) {
      console.log('No admin found. Aborting — seed an admin first.');
      process.exit(1);
    }
    console.log(`Preserving admin: ${admin.email} (${admin.id})`);

    // Delete in reverse dependency order
    const { count: delNotifs } = await supabase.from('notifications').delete().neq('user_id', admin.id);
    console.log(`Deleted ${delNotifs || 0} notifications`);

    const { count: delDocs } = await supabase.from('documents').delete().neq('customer_id', admin.id);
    console.log(`Deleted ${delDocs || 0} documents`);

    const { count: delFCs } = await supabase.from('file_categories').delete().neq('created_by', admin.id);
    console.log(`Deleted ${delFCs || 0} file categories`);

    const { count: delDepts } = await supabase.from('departments').delete().neq('created_by', admin.id);
    console.log(`Deleted ${delDepts || 0} departments`);

    const { count: delUsers } = await supabase
      .from('profiles')
      .delete()
      .neq('id', admin.id);
    console.log(`Deleted ${delUsers || 0} non-admin users`);

    console.log('\nPurge complete. Only the admin user remains.');
  } catch (error) {
    console.error('Purge failed:', error);
    process.exit(1);
  }
};

purge();
