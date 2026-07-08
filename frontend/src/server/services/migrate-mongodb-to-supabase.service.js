import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!MONGODB_URI) { console.error('MONGODB_URI is not set'); process.exit(1); }
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Helpers ──────────────────────────────────────────────

const toSnakeCase = (str) => str.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);

const mapFields = (doc, fieldMap) => {
  const result = {};
  for (const [mongoField, pgField] of Object.entries(fieldMap)) {
    const value = mongoField.includes('.')
      ? mongoField.split('.').reduce((o, k) => o?.[k], doc)
      : doc[mongoField];
    if (value !== undefined) {
      result[pgField] = value instanceof mongoose.Types.ObjectId ? value.toString() : value;
    }
  }
  return result;
};

const insertBatch = async (table, records, batchSize = 500) => {
  let inserted = 0;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error } = await supabase.from(table).insert(batch);
    if (error) {
      console.error(`  ✗ Batch insert error (${table}):`, error.message);
      throw error;
    }
    inserted += batch.length;
    console.log(`  ✓ Inserted ${inserted}/${records.length}`);
  }
};

// ─── Migrate Departments ──────────────────────────────────

const migrateDepartments = async () => {
  console.log('\n--- Migrating Departments ---');
  const departments = await mongoose.connection.db.collection('departments').find({}).toArray();
  console.log(`Found ${departments.length} departments`);

  if (departments.length === 0) return {};

  const records = departments.map(d => mapFields(d, {
    _id: 'id', name: 'name', description: 'description',
    isActive: 'is_active', permissions: 'permissions',
    createdBy: 'created_by', createdAt: 'created_at', updatedAt: 'updated_at',
  }));

  await insertBatch('departments', records);

  // Build ID mapping: Mongo ObjectId string → Supabase UUID
  const mapping = {};
  departments.forEach((d, i) => {
    mapping[d._id.toString()] = records[i].id;
  });
  return mapping;
};

// ─── Migrate File Categories ──────────────────────────────

const migrateFileCategories = async (deptMapping) => {
  console.log('\n--- Migrating File Categories ---');
  const categories = await mongoose.connection.db.collection('filecategories').find({}).toArray();
  console.log(`Found ${categories.length} file categories`);

  if (categories.length === 0) return {};

  const records = categories.map(c => {
    const rec = mapFields(c, {
      _id: 'id', name: 'name', description: 'description',
      isActive: 'is_active', createdBy: 'created_by',
      createdAt: 'created_at', updatedAt: 'updated_at',
    });
    rec.department_id = deptMapping[c.departmentId?.toString()] || c.departmentId?.toString();
    return rec;
  });

  await insertBatch('file_categories', records);

  const mapping = {};
  categories.forEach((c, i) => {
    mapping[c._id.toString()] = records[i].id;
  });
  return mapping;
};

// ─── Migrate Profiles (Users) ─────────────────────────────

const migrateProfiles = async (deptMapping) => {
  console.log('\n--- Migrating Profiles (Users) ---');
  const users = await mongoose.connection.db.collection('users').find({}).toArray();
  console.log(`Found ${users.length} users`);

  if (users.length === 0) return {};

  const records = users.map(u => {
    const rec = mapFields(u, {
      _id: 'id', name: 'name', email: 'email', password: 'password',
      role: 'role', isActive: 'is_active',
      canRename: 'can_rename', canDelete: 'can_delete', canCreate: 'can_create',
      mustChangePassword: 'must_change_password',
      createdAt: 'created_at', updatedAt: 'updated_at',
    });
    rec.department_id = deptMapping[u.departmentId?.toString()] || null;
    // created_by will be set after all profiles are inserted
    return rec;
  });

  await insertBatch('profiles', records);

  const mapping = {};
  users.forEach((u, i) => {
    mapping[u._id.toString()] = records[i].id;
  });

  // Now update created_by references
  console.log('  Updating created_by references...');
  for (const u of users) {
    if (u.createdBy) {
      const newId = mapping[u._id.toString()];
      const creatorId = mapping[u.createdBy.toString()];
      if (newId && creatorId) {
        await supabase.from('profiles').update({ created_by: creatorId }).eq('id', newId);
      }
    }
  }
  console.log('  ✓ created_by references updated');

  return mapping;
};

// ─── Migrate Documents ────────────────────────────────────

const migrateDocuments = async (profileMapping, deptMapping, catMapping) => {
  console.log('\n--- Migrating Documents ---');
  const docs = await mongoose.connection.db.collection('documents').find({}).toArray();
  console.log(`Found ${docs.length} documents`);

  if (docs.length === 0) return;

  // Process in batches to avoid memory issues
  const batchSize = 200;

  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    const records = batch.map(d => {
      const resultFile = d.resultFile || {};
      const rec = {
        id: d._id.toString(),
        customer_id: profileMapping[d.customerId?.toString()] || d.customerId?.toString(),
        file_category_id: catMapping[d.fileCategoryId?.toString()] || d.fileCategoryId?.toString() || null,
        department_id: deptMapping[d.departmentId?.toString()] || d.departmentId?.toString(),
        title: d.title || '',
        description: d.description || '',
        group_id: d.groupId?.toString() || null,
        requires_result: d.requiresResult !== undefined ? d.requiresResult : true,
        file_deleted_from_storage: d.fileDeletedFromStorage || false,
        result_file_deleted_from_storage: d.resultFileDeletedFromStorage || false,
        purged_at: d.purgedAt || null,
        purged_by: profileMapping[d.purgedBy?.toString()] || null,
        direction: d.direction || 'submission',
        original_name: d.originalName || null,
        stored_path: d.storedPath || null,
        mime_type: d.mimeType || null,
        file_size: d.fileSize || null,
        status: d.status || 'pending',
        payment_blocked: d.paymentBlocked || false,
        blocked_at: d.blockedAt || null,
        blocked_by: profileMapping[d.blockedBy?.toString()] || null,
        // Flattened resultFile
        result_file_original_name: resultFile.originalName || null,
        result_file_stored_path: resultFile.storedPath || null,
        result_file_mime_type: resultFile.mimeType || null,
        result_file_size: resultFile.fileSize || null,
        result_file_uploaded_at: resultFile.uploadedAt || null,
        result_file_uploaded_by: profileMapping[resultFile.uploadedBy?.toString()] || null,
        notes: d.notes || '',
        is_deleted: d.isDeleted || false,
        custom_group_name: d.customGroupName || '',
        is_placeholder: d.isPlaceholder || false,
        created_at: d.createdAt || new Date().toISOString(),
        updated_at: d.updatedAt || new Date().toISOString(),
      };
      return rec;
    });

    await insertBatch('documents', records, 200);
  }
};

// ─── Migrate Notifications ────────────────────────────────

const migrateNotifications = async (profileMapping) => {
  console.log('\n--- Migrating Notifications ---');
  const notifications = await mongoose.connection.db.collection('notifications').find({}).toArray();
  console.log(`Found ${notifications.length} notifications`);

  if (notifications.length === 0) return;

  const records = notifications.map(n => ({
    id: n._id.toString(),
    user_id: profileMapping[n.userId?.toString()] || n.userId?.toString(),
    type: n.type,
    message: n.message,
    link: n.link || '',
    is_read: n.isRead || false,
    created_at: n.createdAt || new Date().toISOString(),
  }));

  await insertBatch('notifications', records);
};

// ─── Verify Migration ─────────────────────────────────────

const verifyCounts = async () => {
  console.log('\n--- Verifying Migration ---');

  const tables = ['departments', 'file_categories', 'profiles', 'documents', 'notifications'];
  for (const table of tables) {
    const { count: pgCount, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    if (error) { console.error(`  ✗ Error counting ${table}:`, error.message); continue; }

    const mongoCount = await mongoose.connection.db.collection(table === 'profiles' ? 'users' : table).countDocuments();
    const status = pgCount === mongoCount ? '✓' : '⚠';
    console.log(`  ${status} ${table}: MongoDB=${mongoCount} → Supabase=${pgCount}`);
  }
};

// ─── Main ──────────────────────────────────────────────────

const migrate = async () => {
  try {
    console.log('=== MongoDB → Supabase Migration ===\n');

    // 1. Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // 2. Check if Supabase tables have data
    const { count: existingDocs } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true });
    if (existingDocs > 0) {
      console.log(`\n⚠ Supabase already has ${existingDocs} documents.`);
      console.log('Run the purge-data script first if you want to re-migrate.');
      console.log('Skipping migration.');
      await mongoose.disconnect();
      return;
    }

    // 3. Migrate in dependency order
    const deptMapping = await migrateDepartments();
    const catMapping = await migrateFileCategories(deptMapping);
    const profileMapping = await migrateProfiles(deptMapping);
    await migrateDocuments(profileMapping, deptMapping, catMapping);
    await migrateNotifications(profileMapping);

    // 4. Verify
    await verifyCounts();

    console.log('\n=== Migration Complete ===');
    console.log('Next steps:');
    console.log('  1. Update .env: remove MONGODB_URI, add DATABASE_TYPE=supabase');
    console.log('  2. Run the updated seed service to verify');
    console.log('  3. Test all API endpoints');
    console.log('  4. If rollback needed: mongorestore + git checkout');

    await mongoose.disconnect();
  } catch (error) {
    console.error('\nMigration failed:', error);
    process.exit(1);
  }
};

migrate();
