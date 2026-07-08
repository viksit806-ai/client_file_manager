import bcrypt from 'bcrypt';
import crypto from 'crypto';
import * as ProfileRepo from '../db/profiles.js';
import * as DepartmentRepo from '../db/departments.js';
import * as FileCategoryRepo from '../db/file_categories.js';
import * as DocumentRepo from '../db/documents.js';
import AppError from '../utils/AppError.js';
import { mapDoc, mapDocs, mapProfile, mapProfiles, toUserJSON, mapDepartment, mapDepartments, mapFileCategory, mapFileCategories } from '../utils/transform.js';
import storageService from '../services/storage.service.js';

const generatePassword = () => crypto.randomBytes(12).toString('hex');

// ─── Dashboard ────────────────────────────────────────────

export const getDashboard = async (req, res) => {
  const stats = await DocumentRepo.getAdminDashboardStats();

  const recentDocs = await DocumentRepo.find({}, {
    sort: { created_at: 'desc' },
    limit: 10,
  });

  res.json({
    success: true,
    data: {
      totalCustomers: stats.totalCustomers,
      totalDepartments: stats.totalDepartments,
      totalDeptUsers: stats.totalDeptUsers,
      totalDocuments: stats.totalDocuments,
      deptStats: stats.deptStats || [],
      slaOverview: stats.slaOverview || [],
      recentDocs: mapDocs(recentDocs.data),
    },
  });
};

// ─── Customers ────────────────────────────────────────────

export const getCustomers = async (req, res) => {
  const { search, status } = req.query;
  const filters = { role: 'customer' };
  if (status === 'active') filters.is_active = true;
  if (status === 'inactive') filters.is_active = false;

  const page = parseInt(req.query.page);
  const limit = parseInt(req.query.limit);

  const options = {
    sort: { created_at: 'desc' },
    ...(page && limit ? { page, limit } : {}),
  };

  if (search && typeof search === 'string') {
    options.search = {
      fields: ['name', 'email'],
      term: search,
    };
  }

  const { data, count } = await ProfileRepo.find(filters, options);

  if (page && limit) {
    res.json({
      success: true,
      data: mapProfiles(data),
      pagination: { total: count, page, limit, pages: Math.ceil(count / limit) },
    });
  } else {
    res.json({ success: true, data: mapProfiles(data) });
  }
};

export const createCustomer = async (req, res) => {
  const { name, email, password: customPassword, canRename, canDelete, canCreate } = req.body;
  if (!name || !email) {
    throw new AppError('Name and email are required', 400);
  }

  const password = customPassword || generatePassword();
  const hashedPassword = await bcrypt.hash(password, 12);

  const customer = await ProfileRepo.create({
    name,
    email: email.toLowerCase(),
    password: hashedPassword,
    role: 'customer',
    must_change_password: true,
    can_rename: canRename || false,
    can_delete: canDelete || false,
    can_create: canCreate || false,
  });

  res.status(201).json({
    success: true,
    data: toUserJSON(customer),
    message: 'Customer created successfully',
  });
};

export const updateCustomer = async (req, res) => {
  const { id } = req.params;
  const { name, email, isActive, canRename, canDelete, canCreate } = req.body;

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email.toLowerCase();
  if (isActive !== undefined) updates.is_active = isActive;
  if (canRename !== undefined) updates.can_rename = canRename;
  if (canDelete !== undefined) updates.can_delete = canDelete;
  if (canCreate !== undefined) updates.can_create = canCreate;

  const customer = await ProfileRepo.findOneAndUpdate(
    { id, role: 'customer' },
    updates
  );

  if (!customer) throw new AppError('Customer not found', 404);
  res.json({ success: true, data: mapProfile(customer) });
};

export const deleteCustomer = async (req, res) => {
  const { id } = req.params;
  const customer = await ProfileRepo.findOneAndDelete({ id, role: 'customer' });
  if (!customer) throw new AppError('Customer not found', 404);
  await DocumentRepo.deleteMany({ customer_id: id });
  res.json({ success: true, message: 'Customer deleted' });
};

export const resetCustomerPassword = async (req, res) => {
  const { id } = req.params;
  const customer = await ProfileRepo.findByIdLean(id);
  if (!customer || customer.role !== 'customer') throw new AppError('Customer not found', 404);

  const newPassword = generatePassword();
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await ProfileRepo.update(id, {
    password: hashedPassword,
    must_change_password: true,
  });

  res.json({
    success: true,
    message: 'Password reset successfully',
    data: { newPassword },
  });
};

export const setCustomerPassword = async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  if (!password || password.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  const customer = await ProfileRepo.findByIdLean(id);
  if (!customer || customer.role !== 'customer') throw new AppError('Customer not found', 404);

  const hashedPassword = await bcrypt.hash(password, 12);
  await ProfileRepo.update(id, {
    password: hashedPassword,
    must_change_password: false,
  });

  res.json({ success: true, message: 'Password updated successfully' });
};

export const getCustomerDocuments = async (req, res) => {
  const { id } = req.params;
  const page = parseInt(req.query.page);
  const limit = parseInt(req.query.limit);
  const filters = { customer_id: id, is_deleted: false };
  const options = { sort: { created_at: 'desc' } };

  if (page && limit) {
    options.page = page;
    options.limit = limit;
  }

  const { data, count } = await DocumentRepo.find(filters, options);

  if (page && limit) {
    res.json({
      success: true,
      data: mapDocs(data),
      pagination: { total: count, page, limit, pages: Math.ceil(count / limit) },
    });
  } else {
    res.json({ success: true, data: mapDocs(data) });
  }
};

// ─── Departments ──────────────────────────────────────────

export const getDepartments = async (req, res) => {
  const page = parseInt(req.query.page);
  const limit = parseInt(req.query.limit);
  const options = { sort: { created_at: 'desc' } };

  if (page && limit) {
    options.page = page;
    options.limit = limit;
  }

  const { data, count } = await DepartmentRepo.find({}, options);

  if (page && limit) {
    res.json({
      success: true,
      data: mapDepartments(data),
      pagination: { total: count, page, limit, pages: Math.ceil(count / limit) },
    });
  } else {
    res.json({ success: true, data: mapDepartments(data) });
  }
};

export const createDepartment = async (req, res) => {
  const { name, description } = req.body;
  if (!name) throw new AppError('Department name is required', 400);

  const dept = await DepartmentRepo.create({
    name,
    description: description || '',
  });

  res.status(201).json({ success: true, data: mapDepartment(dept) });
};

export const updateDepartment = async (req, res) => {
  const { id } = req.params;
  const { name, description, isActive, permissions } = req.body;

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (isActive !== undefined) updates.is_active = isActive;
  if (permissions !== undefined) updates.permissions = permissions;

  const dept = await DepartmentRepo.findByIdAndUpdate(id, updates);
  if (!dept) throw new AppError('Department not found', 404);
  res.json({ success: true, data: mapDepartment(dept) });
};

export const deleteDepartment = async (req, res) => {
  const { id } = req.params;
  const dept = await DepartmentRepo.findByIdAndDelete(id);
  if (!dept) throw new AppError('Department not found', 404);
  await ProfileRepo.updateMany(
    { department_id: id, role: 'department' },
    { is_active: false }
  );
  res.json({ success: true, message: 'Department deleted' });
};

export const updateDepartmentPermissions = async (req, res) => {
  const { id } = req.params;
  const { blockDocuments, viewCustomers } = req.body;

  const dept = await DepartmentRepo.findByIdAndUpdate(id, {
    permissions: { blockDocuments, viewCustomers },
  });

  if (!dept) throw new AppError('Department not found', 404);
  res.json({ success: true, data: mapDepartment(dept) });
};

// ─── Department Users ─────────────────────────────────────

export const getDepartmentUsers = async (req, res) => {
  const { deptId } = req.query;
  const filters = { role: 'department' };
  if (deptId && typeof deptId === 'string') filters.department_id = deptId;

  const page = parseInt(req.query.page);
  const limit = parseInt(req.query.limit);
  const options = { sort: { created_at: 'desc' } };

  if (page && limit) {
    options.page = page;
    options.limit = limit;
  }

  const { data, count } = await ProfileRepo.find(filters, options);

  if (page && limit) {
    res.json({
      success: true,
      data: mapProfiles(data),
      pagination: { total: count, page, limit, pages: Math.ceil(count / limit) },
    });
  } else {
    res.json({ success: true, data: mapProfiles(data) });
  }
};

export const getDepartmentUsersByDept = async (req, res) => {
  const { deptId } = req.params;
  const { data } = await ProfileRepo.find(
    { role: 'department', department_id: deptId },
    { sort: { created_at: 'desc' } }
  );
  res.json({ success: true, data: mapProfiles(data) });
};

export const createDepartmentUser = async (req, res) => {
  const { name, email, departmentId, password: customPassword, canRename, canDelete, canCreate } = req.body;
  if (!name || !email || !departmentId) {
    throw new AppError('Name, email, and department are required', 400);
  }

  const dept = await DepartmentRepo.findById(departmentId);
  if (!dept) throw new AppError('Department not found', 404);

  const password = customPassword || generatePassword();
  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await ProfileRepo.create({
    name,
    email: email.toLowerCase(),
    password: hashedPassword,
    role: 'department',
    department_id: departmentId,
    must_change_password: true,
    can_rename: canRename || false,
    can_delete: canDelete || false,
    can_create: canCreate || false,
  });

  res.status(201).json({
    success: true,
    data: toUserJSON(user),
  });
};

export const updateDepartmentUser = async (req, res) => {
  const { id } = req.params;
  const { name, email, isActive, departmentId, canRename, canDelete, canCreate } = req.body;

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email.toLowerCase();
  if (isActive !== undefined) updates.is_active = isActive;
  if (departmentId !== undefined) updates.department_id = departmentId;
  if (canRename !== undefined) updates.can_rename = canRename;
  if (canDelete !== undefined) updates.can_delete = canDelete;
  if (canCreate !== undefined) updates.can_create = canCreate;

  const user = await ProfileRepo.findOneAndUpdate(
    { id, role: 'department' },
    updates
  );

  if (!user) throw new AppError('Department user not found', 404);
  res.json({ success: true, data: mapProfile(user) });
};

export const deleteDepartmentUser = async (req, res) => {
  const { id } = req.params;
  const user = await ProfileRepo.findOneAndDelete({ id, role: 'department' });
  if (!user) throw new AppError('Department user not found', 404);
  res.json({ success: true, message: 'User deleted' });
};

export const resetDeptUserPassword = async (req, res) => {
  const { id } = req.params;
  const user = await ProfileRepo.findByIdLean(id);
  if (!user || user.role !== 'department') throw new AppError('User not found', 404);

  const newPassword = generatePassword();
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await ProfileRepo.update(id, {
    password: hashedPassword,
    must_change_password: true,
  });

  res.json({
    success: true,
    message: 'Password reset successfully',
    data: { newPassword },
  });
};

export const setDeptUserPassword = async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  if (!password || password.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  const user = await ProfileRepo.findByIdLean(id);
  if (!user || user.role !== 'department') throw new AppError('User not found', 404);

  const hashedPassword = await bcrypt.hash(password, 12);
  await ProfileRepo.update(id, {
    password: hashedPassword,
    must_change_password: false,
  });

  res.json({ success: true, message: 'Password updated successfully' });
};

// ─── Documents ────────────────────────────────────────────

export const getAllDocuments = async (req, res) => {
  const { departmentId, status, customerId, search } = req.query;
  const filters = { is_deleted: false };

  if (departmentId && typeof departmentId === 'string') filters.department_id = departmentId;
  if (status && typeof status === 'string') filters.status = status;
  if (customerId && typeof customerId === 'string') filters.customer_id = customerId;

  const page = parseInt(req.query.page);
  const limit = parseInt(req.query.limit);
  const options = { sort: { created_at: 'desc' } };

  if (search && typeof search === 'string') {
    // Find matching customers first
    const { data: matchingCustomers } = await ProfileRepo.find(
      { role: 'customer' },
      { search: { fields: ['name', 'email'], term: search }, limit: 100 }
    );
    const customerIds = matchingCustomers.map(c => c.id);

    // Build or query for document search
    const orConditions = [`title.ilike.%${search}%`, `original_name.ilike.%${search}%`];
    if (customerIds.length > 0) {
      orConditions.push(`customer_id.in.(${customerIds.join(',')})`);
    }
    filters.or = orConditions.join(',');
  }

  if (page && limit) {
    options.page = page;
    options.limit = limit;
  }

  const { data, count } = await DocumentRepo.find(filters, options);

  if (page && limit) {
    res.json({
      success: true,
      data: mapDocs(data),
      pagination: { total: count, page, limit, pages: Math.ceil(count / limit) },
    });
  } else {
    res.json({ success: true, data: mapDocs(data) });
  }
};

// ─── Block/Unblock ────────────────────────────────────────

export const adminBlockDocument = async (req, res) => {
  const { id } = req.params;

  if (req.body.groupId) {
    await DocumentRepo.updateMany(
      { group_id: req.body.groupId },
      {
        payment_blocked: true,
        status: 'blocked',
        blocked_at: new Date().toISOString(),
      }
    );
    const doc = await DocumentRepo.findById(id);
    return res.json({ success: true, data: mapDoc(doc) });
  }

  const doc = await DocumentRepo.findById(id);
  if (!doc) throw new AppError('Document not found', 404);
  if (!doc.result_file_stored_path) throw new AppError('No result file to block', 400);

  await DocumentRepo.update(id, {
    payment_blocked: true,
    status: 'blocked',
    blocked_at: new Date().toISOString(),
  });

  const updated = await DocumentRepo.findById(id);
  res.json({ success: true, data: mapDoc(updated) });
};

export const adminUnblockDocument = async (req, res) => {
  const { id } = req.params;

  if (req.body.groupId) {
    await DocumentRepo.updateMany(
      { group_id: req.body.groupId },
      {
        payment_blocked: false,
        blocked_at: null,
        blocked_by: null,
      }
    );
    const doc = await DocumentRepo.findById(id);
    return res.json({ success: true, data: mapDoc(doc) });
  }

  const doc = await DocumentRepo.findById(id);
  if (!doc) throw new AppError('Document not found', 404);
  if (!doc.result_file_stored_path) throw new AppError('No result file to unblock', 400);

  await DocumentRepo.update(id, {
    payment_blocked: false,
    blocked_at: null,
    blocked_by: null,
  });

  const updated = await DocumentRepo.findById(id);
  res.json({ success: true, data: mapDoc(updated) });
};

export const adminUpdateDocument = async (req, res) => {
  const { id } = req.params;
  const { title, notes, status } = req.body;

  const doc = await DocumentRepo.findById(id);
  if (!doc) throw new AppError('Document not found', 404);

  if (doc.group_id) {
    const updatePayload = {};
    if (notes !== undefined) updatePayload.notes = notes;
    if (status !== undefined && ['pending', 'processing', 'completed', 'blocked'].includes(status)) {
      updatePayload.status = status;
      if (status === 'blocked') {
        updatePayload.payment_blocked = true;
        updatePayload.blocked_at = new Date().toISOString();
      } else {
        updatePayload.payment_blocked = false;
        updatePayload.blocked_at = null;
        updatePayload.blocked_by = null;
      }
    }

    if (Object.keys(updatePayload).length > 0) {
      await DocumentRepo.updateMany({ group_id: doc.group_id }, updatePayload);
    }

    if (title !== undefined) {
      await DocumentRepo.update(id, { title });
    }

    const updated = await DocumentRepo.findById(id);
    return res.json({ success: true, data: mapDoc(updated) });
  }

  const updates = {};
  if (title !== undefined) updates.title = title;
  if (notes !== undefined) updates.notes = notes;
  if (status !== undefined && ['pending', 'processing', 'completed', 'blocked'].includes(status)) {
    updates.status = status;
    if (status === 'blocked') {
      updates.payment_blocked = true;
      updates.blocked_at = new Date().toISOString();
    } else {
      updates.payment_blocked = false;
      updates.blocked_at = null;
      updates.blocked_by = null;
    }
  }

  await DocumentRepo.update(id, updates);
  const updated = await DocumentRepo.findById(id);
  res.json({ success: true, data: mapDoc(updated) });
};

export const adminDeleteDocument = async (req, res) => {
  const { id } = req.params;
  const doc = await DocumentRepo.findByIdAndDelete(id);
  if (!doc) throw new AppError('Document not found', 404);
  res.json({ success: true, message: 'Document deleted' });
};

export const adminPurgeDocumentFiles = async (req, res) => {
  const { id } = req.params;
  const doc = await DocumentRepo.findById(id);
  if (!doc) throw new AppError('Document not found', 404);

  let docsToPurge = [doc];
  if (doc.group_id) {
    const { data } = await DocumentRepo.find({ group_id: doc.group_id });
    docsToPurge = data;
  }

  let totalFilesDeleted = 0;

  for (const item of docsToPurge) {
    const updates = {};
    if (item.stored_path && !item.file_deleted_from_storage) {
      try {
        await storageService.deleteFile(item.stored_path);
        updates.file_deleted_from_storage = true;
        totalFilesDeleted++;
      } catch (err) {
        console.error(`Failed to delete file ${item.stored_path}:`, err);
      }
    }
    if (item.result_file_stored_path && !item.result_file_deleted_from_storage) {
      try {
        await storageService.deleteFile(item.result_file_stored_path);
        updates.result_file_deleted_from_storage = true;
        totalFilesDeleted++;
      } catch (err) {
        console.error(`Failed to delete result file ${item.result_file_stored_path}:`, err);
      }
    }

    if (Object.keys(updates).length > 0) {
      updates.purged_at = new Date().toISOString();
      await DocumentRepo.update(item.id, updates);
    }
  }

  const updatedDoc = await DocumentRepo.findById(id);
  res.json({
    success: true,
    message: `Successfully purged files across the request group (Deleted ${totalFilesDeleted} files).`,
    data: mapDoc(updatedDoc),
  });
};

export const adminBatchDocuments = async (req, res) => {
  const { ids, action, status } = req.body;
  if (!ids || !Array.isArray(ids)) {
    throw new AppError('Document IDs array is required', 400);
  }

  if (action === 'status') {
    if (!status || !['pending', 'processing', 'completed', 'blocked'].includes(status)) {
      throw new AppError('Valid status is required', 400);
    }

    for (const id of ids) {
      const doc = await DocumentRepo.findById(id);
      if (doc) {
        const updatePayload = { status };
        if (status === 'blocked') {
          updatePayload.payment_blocked = true;
          updatePayload.blocked_at = new Date().toISOString();
        } else {
          updatePayload.payment_blocked = false;
          updatePayload.blocked_at = null;
          updatePayload.blocked_by = null;
        }

        if (doc.group_id) {
          await DocumentRepo.updateMany({ group_id: doc.group_id }, updatePayload);
        } else {
          await DocumentRepo.update(id, updatePayload);
        }
      }
    }
  } else if (action === 'block') {
    for (const id of ids) {
      const doc = await DocumentRepo.findById(id);
      if (doc) {
        const updatePayload = {
          payment_blocked: true,
          status: 'blocked',
          blocked_at: new Date().toISOString(),
        };
        if (doc.group_id) {
          await DocumentRepo.updateMany({ group_id: doc.group_id }, updatePayload);
        } else if (doc.result_file_stored_path) {
          await DocumentRepo.update(id, updatePayload);
        }
      }
    }
  } else if (action === 'unblock') {
    for (const id of ids) {
      const doc = await DocumentRepo.findById(id);
      if (doc) {
        const updatePayload = {
          payment_blocked: false,
          blocked_at: null,
          blocked_by: null,
        };
        if (doc.group_id) {
          await DocumentRepo.updateMany({ group_id: doc.group_id }, updatePayload);
        } else if (doc.result_file_stored_path) {
          await DocumentRepo.update(id, updatePayload);
        }
      }
    }
  } else if (action === 'delete') {
    for (const id of ids) {
      const doc = await DocumentRepo.findById(id);
      if (doc) {
        let docsToPurge = [doc];
        if (doc.group_id) {
          const { data } = await DocumentRepo.find({ group_id: doc.group_id });
          docsToPurge = data;
        }
        for (const item of docsToPurge) {
          if (item.stored_path && !item.file_deleted_from_storage) {
            try { await storageService.deleteFile(item.stored_path); } catch (_) {}
          }
          if (item.result_file_stored_path && !item.result_file_deleted_from_storage) {
            try { await storageService.deleteFile(item.result_file_stored_path); } catch (_) {}
          }
          await DocumentRepo.findByIdAndDelete(item.id);
        }
      }
    }
  } else {
    throw new AppError('Invalid action', 400);
  }

  res.json({ success: true, message: 'Batch operation completed successfully' });
};

// ─── File Categories ──────────────────────────────────────

export const getFileCategories = async (req, res) => {
  const { deptId } = req.query;
  const filters = {};
  if (deptId && typeof deptId === 'string') filters.department_id = deptId;

  const page = parseInt(req.query.page);
  const limit = parseInt(req.query.limit);
  const options = { sort: { name: 'asc' } };

  if (page && limit) {
    options.page = page;
    options.limit = limit;
  }

  const { data, count } = await FileCategoryRepo.find(filters, options);

  if (page && limit) {
    res.json({
      success: true,
      data: mapFileCategories(data),
      pagination: { total: count, page, limit, pages: Math.ceil(count / limit) },
    });
  } else {
    res.json({ success: true, data: mapFileCategories(data) });
  }
};

export const createFileCategory = async (req, res) => {
  const { name, description, departmentId } = req.body;
  if (!name || !departmentId) {
    throw new AppError('Name and department are required', 400);
  }

  const dept = await DepartmentRepo.findById(departmentId);
  if (!dept) throw new AppError('Department not found', 404);

  const fileCategory = await FileCategoryRepo.create({
    name,
    description: description || '',
    department_id: departmentId,
  });

  res.status(201).json({ success: true, data: mapFileCategory(fileCategory) });
};

export const updateFileCategory = async (req, res) => {
  const { id } = req.params;
  const { name, description, isActive, departmentId } = req.body;

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (isActive !== undefined) updates.is_active = isActive;
  if (departmentId !== undefined) updates.department_id = departmentId;

  const fileCategory = await FileCategoryRepo.findByIdAndUpdate(id, updates);
  if (!fileCategory) throw new AppError('File category not found', 404);
  res.json({ success: true, data: mapFileCategory(fileCategory) });
};

export const deleteFileCategory = async (req, res) => {
  const { id } = req.params;
  const fileCategory = await FileCategoryRepo.findByIdAndDelete(id);
  if (!fileCategory) throw new AppError('File category not found', 404);
  res.json({ success: true, message: 'File category deleted' });
};
