import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ─── Config ──────────────────────────────────────────────

const MONGODB_URI = process.env.MONGODB_URI;

const OLD_SUPABASE_URL = process.env.OLD_SUPABASE_URL;
const OLD_SUPABASE_SERVICE_ROLE_KEY = process.env.OLD_SUPABASE_SERVICE_ROLE_KEY;
const OLD_BUCKET = process.env.OLD_SUPABASE_BUCKET || 'files';

const NEW_SUPABASE_URL = process.env.SUPABASE_URL;
const NEW_SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NEW_BUCKET = process.env.SUPABASE_BUCKET || 'files';

const MISSING = [];
if (!MONGODB_URI) MISSING.push('MONGODB_URI');
if (!OLD_SUPABASE_URL || !OLD_SUPABASE_SERVICE_ROLE_KEY) MISSING.push('OLD_SUPABASE_URL / OLD_SUPABASE_SERVICE_ROLE_KEY');
if (!NEW_SUPABASE_URL || !NEW_SUPABASE_SERVICE_ROLE_KEY) MISSING.push('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
if (MISSING.length) {
  console.error(`Missing env vars: ${MISSING.join(', ')}`);
  process.exit(1);
}

// ─── Clients ─────────────────────────────────────────────

const oldSupabase = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Stats ────────────────────────────────────────────────

const stats = { filesMigrated: 0, filesSkipped: 0, filesFailed: 0 };

// ─── Helpers ──────────────────────────────────────────────

const MIME_TYPES = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
};

const guessMime = (key) => {
  const ext = key.split('.').pop()?.toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
};

const insertBatch = async (table, records, batchSize = 500) => {
  let inserted = 0;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error } = await newSupabase.from(table).insert(batch);
    if (error) {
      console.error(`  ✗ Batch insert error (${table}):`, error.message);
      throw error;
    }
    inserted += batch.length;
    console.log(`  ✓ Inserted ${inserted}/${records.length}`);
  }
};

const migrateFile = async (storedPath) => {
  if (!storedPath) return null;
  if (storedPath.startsWith('.') || storedPath.startsWith('/') || storedPath.includes(':\\')) {
    stats.filesSkipped++;
    return storedPath;
  }

  try {
    const { data: fileBlob, error: dlError } = await oldSupabase.storage
      .from(OLD_BUCKET)
      .download(storedPath);

    if (dlError) {
      console.log(`  ⚠ Cannot download ${storedPath}: ${dlError.message}`);
      stats.filesSkipped++;
      return storedPath;
    }

    const buffer = Buffer.from(await fileBlob.arrayBuffer());
    const contentType = guessMime(storedPath);

    const { error: upError } = await newSupabase.storage
      .from(NEW_BUCKET)
      .upload(storedPath, buffer, { contentType, upsert: true });

    if (upError) {
      console.error(`  ✗ Upload failed for ${storedPath}: ${upError.message}`);
      stats.filesFailed++;
      return storedPath;
    }

    stats.filesMigrated++;
    process.stdout.write('.');
    return storedPath;
  } catch (err) {
    console.error(`  ✗ Error migrating file ${storedPath}: ${err.message}`);
    stats.filesFailed++;
    return storedPath;
  }
};

// ─── Migrate Departments ──────────────────────────────────

const migrateDepartments = async () => {
  console.log('\n=== Migrating Departments ===');
  const departments = await mongoose.connection.db.collection('departments').find({}).toArray();
  console.log(`Found ${departments.length} departments`);

  if (departments.length === 0) return {};

  const idMap = {};
  const records = departments.map(d => {
    const newId = uuidv4();
    idMap[d._id.toString()] = newId;
    return {
      id: newId,
      name: d.name,
      description: d.description || '',
      is_active: d.isActive !== undefined ? d.isActive : true,
      permissions: d.permissions || { blockDocuments: true, viewCustomers: true },
      created_by: null, // set after profiles migration
      created_at: d.createdAt || new Date().toISOString(),
      updated_at: d.updatedAt || new Date().toISOString(),
    };
  });

  await insertBatch('departments', records);
  return idMap;
};

// ─── Migrate File Categories ──────────────────────────────

const migrateFileCategories = async (deptIdMap) => {
  console.log('\n=== Migrating File Categories ===');
  const categories = await mongoose.connection.db.collection('filecategories').find({}).toArray();
  console.log(`Found ${categories.length} file categories`);

  if (categories.length === 0) return {};

  const idMap = {};
  const records = categories.map(c => {
    const newId = uuidv4();
    idMap[c._id.toString()] = newId;
    return {
      id: newId,
      name: c.name,
      description: c.description || '',
      department_id: deptIdMap[c.departmentId?.toString()] || null,
      is_active: c.isActive !== undefined ? c.isActive : true,
      created_by: null,
      created_at: c.createdAt || new Date().toISOString(),
      updated_at: c.updatedAt || new Date().toISOString(),
    };
  });

  await insertBatch('file_categories', records);
  return idMap;
};

// ─── Migrate Profiles ─────────────────────────────────────

const migrateProfiles = async (deptIdMap, catIdMap) => {
  console.log('\n=== Migrating Profiles (Users) ===');
  const users = await mongoose.connection.db.collection('users').find({}).toArray();
  console.log(`Found ${users.length} users`);

  if (users.length === 0) return {};

  // First pass: create all profiles with temp created_by
  const idMap = {};
  const records = users.map(u => {
    const newId = uuidv4();
    idMap[u._id.toString()] = newId;
    return {
      id: newId,
      name: u.name,
      email: u.email,
      password: u.password,
      role: u.role,
      department_id: deptIdMap[u.departmentId?.toString()] || null,
      is_active: u.isActive !== undefined ? u.isActive : true,
      can_rename: u.canRename || false,
      can_delete: u.canDelete || false,
      can_create: u.canCreate || false,
      must_change_password: u.mustChangePassword !== undefined ? u.mustChangePassword : true,
      created_by: null,
      created_at: u.createdAt || new Date().toISOString(),
      updated_at: u.updatedAt || new Date().toISOString(),
    };
  });

  await insertBatch('profiles', records);

  // Second pass: update created_by references
  console.log('  Updating created_by references...');
  for (const u of users) {
    if (u.createdBy) {
      const newId = idMap[u._id.toString()];
      const creatorId = idMap[u.createdBy.toString()];
      if (newId && creatorId) {
        await newSupabase.from('profiles').update({ created_by: creatorId }).eq('id', newId);
      }
    }
  }

  // Update departments created_by
  const deptDocs = await mongoose.connection.db.collection('departments').find({ createdBy: { $ne: null } }).toArray();
  for (const d of deptDocs) {
    const deptUuid = deptIdMap[d._id.toString()];
    const creatorUuid = idMap[d.createdBy.toString()];
    if (deptUuid && creatorUuid) {
      await newSupabase.from('departments').update({ created_by: creatorUuid }).eq('id', deptUuid);
    }
  }

  // Update file_categories created_by
  const fcDocs = await mongoose.connection.db.collection('filecategories').find({ createdBy: { $ne: null } }).toArray();
  for (const c of fcDocs) {
    const fcUuid = catIdMap?.[c._id.toString()];
    const creatorUuid = idMap[c.createdBy.toString()];
    if (fcUuid && creatorUuid) {
      await newSupabase.from('file_categories').update({ created_by: creatorUuid }).eq('id', fcUuid);
    }
  }

  console.log('  ✓ References updated');
  return idMap;
};

// ─── Migrate Documents ────────────────────────────────────

const migrateDocuments = async (profileIdMap, deptIdMap, catIdMap) => {
  console.log('\n=== Migrating Documents ===');
  const docs = await mongoose.connection.db.collection('documents').find({}).toArray();
  console.log(`Found ${docs.length} documents`);

  if (docs.length === 0) return;

  // Build group ID mapping so docs sharing the same MongoDB groupId get the same new UUID
  const groupIdMap = {};
  for (const d of docs) {
    if (d.groupId) {
      const key = d.groupId.toString();
      if (!groupIdMap[key]) groupIdMap[key] = uuidv4();
    }
  }

  const BATCH_SIZE = 50;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    const records = [];

    for (const d of batch) {
      const resultFile = d.resultFile || {};
      let storedPath = d.storedPath || null;
      let resultStoredPath = resultFile.storedPath || null;

      // Migrate associated files
      if (storedPath && !d.fileDeletedFromStorage) {
        storedPath = await migrateFile(storedPath);
      }
      if (resultStoredPath && !d.resultFileDeletedFromStorage) {
        resultStoredPath = await migrateFile(resultStoredPath);
      }

      const rec = {
        id: uuidv4(),
        customer_id: profileIdMap[d.customerId?.toString()] || null,
        file_category_id: catIdMap[d.fileCategoryId?.toString()] || null,
        department_id: deptIdMap[d.departmentId?.toString()] || null,
        title: d.title || '',
        description: d.description || '',
        group_id: d.groupId ? (groupIdMap[d.groupId.toString()] || uuidv4()) : null,
        requires_result: d.requiresResult !== undefined ? d.requiresResult : true,
        file_deleted_from_storage: d.fileDeletedFromStorage || false,
        result_file_deleted_from_storage: d.resultFileDeletedFromStorage || false,
        purged_at: d.purgedAt || null,
        purged_by: profileIdMap[d.purgedBy?.toString()] || null,
        direction: d.direction || 'submission',
        original_name: d.originalName || null,
        stored_path: storedPath,
        mime_type: d.mimeType || null,
        file_size: d.fileSize || null,
        status: d.status || 'pending',
        payment_blocked: d.paymentBlocked || false,
        blocked_at: d.blockedAt || null,
        blocked_by: profileIdMap[d.blockedBy?.toString()] || null,
        result_file_original_name: resultFile.originalName || null,
        result_file_stored_path: resultStoredPath,
        result_file_mime_type: resultFile.mimeType || null,
        result_file_size: resultFile.fileSize || null,
        result_file_uploaded_at: resultFile.uploadedAt || null,
        result_file_uploaded_by: profileIdMap[resultFile.uploadedBy?.toString()] || null,
        notes: d.notes || '',
        is_deleted: d.isDeleted || false,
        custom_group_name: d.customGroupName || '',
        is_placeholder: d.isPlaceholder || false,
        created_at: d.createdAt || new Date().toISOString(),
        updated_at: d.updatedAt || new Date().toISOString(),
      };
      records.push(rec);
    }

    await insertBatch('documents', records, BATCH_SIZE);
    console.log(`  Files: ${stats.filesMigrated} migrated, ${stats.filesSkipped} skipped, ${stats.filesFailed} failed`);
  }
};

// ─── Migrate Notifications ────────────────────────────────

const migrateNotifications = async (profileIdMap) => {
  console.log('\n=== Migrating Notifications ===');
  const notifications = await mongoose.connection.db.collection('notifications').find({}).toArray();
  console.log(`Found ${notifications.length} notifications`);

  if (notifications.length === 0) return;

  const records = notifications.map(n => ({
    id: uuidv4(),
    user_id: profileIdMap[n.userId?.toString()] || null,
    type: n.type,
    message: n.message,
    link: n.link || '',
    is_read: n.isRead || false,
    created_at: n.createdAt || new Date().toISOString(),
  }));

  await insertBatch('notifications', records);
};

// ─── Verify ───────────────────────────────────────────────

const verifyCounts = async () => {
  console.log('\n=== Verifying Migration ===');
  const tables = ['departments', 'file_categories', 'profiles', 'documents', 'notifications'];
  let allMatch = true;

  for (const table of tables) {
    const { count: pgCount, error } = await newSupabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    if (error) { console.error(`  ✗ Error counting ${table}:`, error.message); continue; }

    const mongoCollection = table === 'profiles' ? 'users' : table;
    const mongoCount = await mongoose.connection.db.collection(mongoCollection).countDocuments();
    const match = pgCount === mongoCount;
    if (!match) allMatch = false;
    console.log(`  ${match ? '✓' : '⚠'} ${table}: MongoDB=${mongoCount} → Supabase=${pgCount}`);
  }

  return allMatch;
};

// ─── Main ──────────────────────────────────────────────────

const migrate = async () => {
  const startTime = Date.now();

  try {
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║  Complete Migration: MongoDB + Storage → Supabase ║');
    console.log('╚══════════════════════════════════════════════════╝\n');

    console.log(`OLD Supabase: ${OLD_SUPABASE_URL}`);
    console.log(`NEW Supabase: ${NEW_SUPABASE_URL}`);
    console.log(`Bucket: ${OLD_BUCKET} → ${NEW_BUCKET}\n`);

    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    const { count: existingDocs } = await newSupabase
      .from('documents')
      .select('*', { count: 'exact', head: true });
    if (existingDocs > 0) {
      console.log(`⚠ New Supabase already has ${existingDocs} documents.`);
      process.exit(1);
    }

    const deptIdMap = await migrateDepartments();
    const catIdMap = await migrateFileCategories(deptIdMap);
    const profileIdMap = await migrateProfiles(deptIdMap, catIdMap);
    await migrateDocuments(profileIdMap, deptIdMap, catIdMap);
    await migrateNotifications(profileIdMap);

    const dataOk = await verifyCounts();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n═══════════════════════════════════════════════════');
    console.log('  MIGRATION COMPLETE');
    console.log('═══════════════════════════════════════════════════');
    console.log(`  Time:              ${elapsed}s`);
    console.log(`  Files migrated:    ${stats.filesMigrated}`);
    console.log(`  Files skipped:     ${stats.filesSkipped}`);
    console.log(`  Files failed:      ${stats.filesFailed}`);
    console.log(`  Data match:        ${dataOk ? '✓' : '⚠ Some mismatches'}`);
    console.log('\nNext steps:');
    console.log('  1. Update .env: set SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY to NEW project');
    console.log('  2. Remove MONGODB_URI, OLD_SUPABASE_URL, OLD_SUPABASE_SERVICE_ROLE_KEY');
    console.log('  3. Run: npm run seed');
    console.log('  4. Restart server: npm run dev');
    console.log('  5. Test all endpoints');

    await mongoose.disconnect();
  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    process.exit(1);
  }
};

migrate();
