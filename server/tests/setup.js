import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import app from '../src/app.js';
import * as ProfileRepo from '../src/db/profiles.js';
import * as DepartmentRepo from '../src/db/departments.js';
import * as FileCategoryRepo from '../src/db/file_categories.js';
import * as DocumentRepo from '../src/db/documents.js';
import * as NotificationRepo from '../src/db/notifications.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase;

beforeAll(async () => {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in vitest.config.js for tests');
    return;
  }
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
});

afterEach(async () => {
  if (!supabase) return;
  // Clean all data in reverse dependency order
  await supabase.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('documents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('file_categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('departments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
});

const getJwtSecret = () => process.env.JWT_SECRET || 'test-secret-key';

export {
  app,
  supabase,
  ProfileRepo,
  DepartmentRepo,
  FileCategoryRepo,
  DocumentRepo,
  NotificationRepo,
  getJwtSecret,
};

export async function createAdmin(overrides = {}) {
  const hashedPassword = await bcrypt.hash('password123', 12);
  const user = await ProfileRepo.create({
    name: 'Admin User',
    email: 'admin@test.com',
    password: hashedPassword,
    role: 'super_admin',
    is_active: true,
    ...overrides,
  });
  const token = jwt.sign({ id: user.id, role: user.role }, getJwtSecret(), { expiresIn: '1h' });
  return { user, token };
}

export async function createDepartment(overrides = {}) {
  const dept = await DepartmentRepo.create({
    name: 'Test Department',
    is_active: true,
    ...overrides,
  });
  return dept;
}

export async function createDeptUser(deptId, overrides = {}) {
  const hashedPassword = await bcrypt.hash('password123', 12);
  const user = await ProfileRepo.create({
    name: 'Dept User',
    email: 'dept@test.com',
    password: hashedPassword,
    role: 'department',
    department_id: deptId,
    is_active: true,
    ...overrides,
  });
  const token = jwt.sign({ id: user.id, role: user.role, departmentId: deptId }, getJwtSecret(), { expiresIn: '1h' });
  return { user, token };
}

export async function createCustomer(overrides = {}) {
  const hashedPassword = await bcrypt.hash('password123', 12);
  const user = await ProfileRepo.create({
    name: 'Test Customer',
    email: 'customer@test.com',
    password: hashedPassword,
    role: 'customer',
    is_active: true,
    ...overrides,
  });
  const token = jwt.sign({ id: user.id, role: user.role }, getJwtSecret(), { expiresIn: '1h' });
  return { user, token };
}

export async function createFileCategory(deptId, overrides = {}) {
  const fc = await FileCategoryRepo.create({
    name: 'Tax Return File',
    description: 'For tax return documents',
    department_id: deptId,
    is_active: true,
    ...overrides,
  });
  return fc;
}
