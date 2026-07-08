import * as DocumentRepo from '../db/documents.js';
import * as ProfileRepo from '../db/profiles.js';
import * as DepartmentRepo from '../db/departments.js';
import * as FileCategoryRepo from '../db/file_categories.js';
import * as NotificationRepo from '../db/notifications.js';
import AppError from '../utils/AppError.js';
import { mapDoc, mapDocs, mapProfile, mapProfiles, mapFileCategories } from '../utils/transform.js';
import storageService from '../services/storage.service.js';

// ─── Dashboard ────────────────────────────────────────────

export const getDashboard = async (req, res) => {
  const deptId = req.user.departmentId;
  const stats = await DocumentRepo.getDeptDashboardStats(deptId);

  const { data: recentDocs } = await DocumentRepo.find(
    { department_id: deptId, direction: 'submission' },
    { sort: { created_at: 'desc' }, limit: 10 }
  );

  // Customers: aggregate by customer from documents
  const subFilter = { department_id: deptId, direction: 'submission' };
  const { data: allSubDocs } = await DocumentRepo.find(subFilter, { limit: 10000 });
  const customerMap = {};
  for (const doc of allSubDocs) {
    const cId = doc.customer_id;
    if (!customerMap[cId]) {
      customerMap[cId] = { totalDocs: 0, pendingDocs: 0, lastDoc: doc.created_at };
    }
    customerMap[cId].totalDocs++;
    if (doc.status === 'pending') customerMap[cId].pendingDocs++;
    if (new Date(doc.created_at) > new Date(customerMap[cId].lastDoc)) {
      customerMap[cId].lastDoc = doc.created_at;
    }
  }

  const customers = [];
  for (const [cId, info] of Object.entries(customerMap)) {
    const profile = await ProfileRepo.findByIdLean(cId);
    if (profile) {
      customers.push({
        _id: cId,
        name: profile.name,
        email: profile.email,
        totalDocs: info.totalDocs,
        pendingDocs: info.pendingDocs,
        lastDoc: info.lastDoc,
      });
    }
  }
  customers.sort((a, b) => new Date(b.lastDoc) - new Date(a.lastDoc));

  res.json({
    success: true,
    data: {
      ...stats,
      recentDocs: mapDocs(recentDocs),
      customers,
    },
  });
};

// ─── Customers ────────────────────────────────────────────

export const getCustomers = async (req, res) => {
  const deptId = req.user.departmentId;
  const { filter } = req.query;

  const slaMs = 48 * 60 * 60 * 1000;
  const warningMs = 12 * 60 * 60 * 1000;
  const now = new Date();

  const filters = { department_id: deptId, direction: 'submission' };
  if (filter === 'completed') {
    filters.status = 'completed';
  } else if (filter === 'non_completed') {
    filters.status = ['pending', 'processing', 'blocked'];
  } else if (filter === 'near_deadline') {
    filters.status = ['pending', 'processing'];
    filters.created_at = {
      $gte: new Date(now - slaMs).toISOString(),
      $lt: new Date(now - slaMs + warningMs).toISOString(),
    };
  }

  const page = parseInt(req.query.page);
  const limit = parseInt(req.query.limit);

  const { data: docs } = await DocumentRepo.find(filters, { limit: 10000 });

  // Group by customer
  const customerMap = {};
  for (const doc of docs) {
    const cId = doc.customer_id;
    if (!customerMap[cId]) {
      customerMap[cId] = { totalDocs: 0, pendingDocs: 0, lastDoc: doc.created_at };
    }
    customerMap[cId].totalDocs++;
    if (doc.status === 'pending') customerMap[cId].pendingDocs++;
    if (new Date(doc.created_at) > new Date(customerMap[cId].lastDoc)) {
      customerMap[cId].lastDoc = doc.created_at;
    }
  }

  const customerIds = Object.keys(customerMap);
  const customerProfiles = {};
  for (const cId of customerIds) {
    const profile = await ProfileRepo.findByIdLean(cId);
    if (profile) customerProfiles[cId] = profile;
  }

  let result = customerIds.map(cId => ({
    _id: cId,
    name: customerProfiles[cId]?.name || 'Unknown',
    email: customerProfiles[cId]?.email || '',
    totalDocs: customerMap[cId].totalDocs,
    pendingDocs: customerMap[cId].pendingDocs,
    lastDoc: customerMap[cId].lastDoc,
  }));

  result.sort((a, b) => new Date(b.lastDoc) - new Date(a.lastDoc));
  const total = result.length;

  if (page && limit) {
    const skip = (page - 1) * limit;
    result = result.slice(skip, skip + limit);
  }

  res.json({
    success: true,
    data: result,
    pagination: page && limit ? { total, page, limit, pages: Math.ceil(total / limit) } : undefined,
  });
};

// ─── Customer Documents (department view) ─────────────────

export const getCustomerDocuments = async (req, res) => {
  const deptId = req.user.departmentId;
  const { customerId } = req.params;
  const filters = { customer_id: customerId, department_id: deptId, is_deleted: false };

  const page = parseInt(req.query.page);
  const limit = parseInt(req.query.limit);
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

// ─── Documents ────────────────────────────────────────────

export const getDocuments = async (req, res) => {
  const deptId = req.user.departmentId;
  const { status, customerId, q } = req.query;
  const filters = { department_id: deptId, direction: 'submission', is_deleted: false };

  if (status && typeof status === 'string') filters.status = status;
  if (customerId && typeof customerId === 'string') filters.customer_id = customerId;

  const page = parseInt(req.query.page);
  const limit = parseInt(req.query.limit);
  const options = { sort: { created_at: 'desc' } };

  if (q && typeof q === 'string') {
    // Find matching customers
    const { data: matchingCustomers } = await ProfileRepo.find(
      { role: 'customer' },
      { search: { fields: ['name', 'email'], term: q }, limit: 100 }
    );
    const customerIds = matchingCustomers.map(c => c.id);

    const orConditions = [
      `title.ilike.%${q}%`,
      `original_name.ilike.%${q}%`,
      `custom_group_name.ilike.%${q}%`,
      `description.ilike.%${q}%`,
      `notes.ilike.%${q}%`,
    ];
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

export const getDocumentDetail = async (req, res) => {
  const deptId = req.user.departmentId;
  const { id } = req.params;

  const doc = await DocumentRepo.findOne({ id, department_id: deptId });
  if (!doc) throw new AppError('Document not found', 404);

  let groupDocs = [];
  if (doc.group_id) {
    const { data } = await DocumentRepo.find(
      { group_id: doc.group_id },
      { sort: { created_at: 'asc' } }
    );
    groupDocs = mapDocs(data);
  } else {
    groupDocs = [mapDoc(doc)];
  }

  res.json({
    success: true,
    data: {
      ...mapDoc(doc),
      groupDocs,
    },
  });
};

export const updateDocumentStatus = async (req, res) => {
  const deptId = req.user.departmentId;
  const { id } = req.params;
  const { status, notes } = req.body;

  if (!['pending', 'processing', 'completed'].includes(status)) {
    throw new AppError('Invalid status', 400);
  }

  const doc = await DocumentRepo.findOne({ id, department_id: deptId });
  if (!doc) throw new AppError('Document not found', 404);

  if (doc.group_id) {
    const updates = { status };
    if (notes !== undefined) updates.notes = notes;
    await DocumentRepo.updateMany({ group_id: doc.group_id, department_id: deptId }, updates);
    const updated = await DocumentRepo.findById(id);
    return res.json({ success: true, data: mapDoc(updated) });
  }

  const updates = { status };
  if (notes !== undefined) updates.notes = notes;
  await DocumentRepo.update(id, updates);
  const updated = await DocumentRepo.findById(id);
  res.json({ success: true, data: mapDoc(updated) });
};

export const createResponse = async (req, res) => {
  const deptId = req.user.departmentId;
  const { customerId, fileCategoryId, notes, groupId } = req.body;

  if (!customerId) throw new AppError('Customer ID is required', 400);
  if (!fileCategoryId) throw new AppError('File category ID is required', 400);
  if (!groupId) throw new AppError('Group ID is required to link the response to a request', 400);
  if (!req.file) throw new AppError('Response file is required', 400);

  const fileCategory = await FileCategoryRepo.findById(fileCategoryId);
  if (!fileCategory || !fileCategory.is_active) {
    throw new AppError('File category not found or inactive', 404);
  }

  const customer = await ProfileRepo.findByIdLean(customerId);
  if (!customer) throw new AppError('Customer not found', 404);

  const fileInfo = await storageService.saveResponse(req.file, customerId, fileCategoryId);

  const doc = await DocumentRepo.create({
    customer_id: customerId,
    department_id: deptId,
    file_category_id: fileCategoryId,
    group_id: groupId,
    direction: 'response',
    title: req.file.originalname,
    notes: notes || '',
    original_name: fileInfo.originalName,
    stored_path: fileInfo.storedPath,
    mime_type: fileInfo.mimeType,
    file_size: fileInfo.fileSize,
    status: 'completed',
  });

  // Notify the customer
  const dept = await DepartmentRepo.findById(deptId);
  await NotificationRepo.create({
    user_id: customerId,
    type: 'new_response',
    message: `${dept.name} uploaded a new document: ${fileInfo.originalName}`,
    link: '/customer/responses',
  });

  res.status(201).json({ success: true, data: mapDoc(doc) });
};

export const getResponses = async (req, res) => {
  const deptId = req.user.departmentId;
  const { customerId } = req.query;
  const filters = { department_id: deptId, direction: 'response', is_deleted: false };
  if (customerId) filters.customer_id = customerId;

  const { data } = await DocumentRepo.find(filters, { sort: { created_at: 'desc' } });
  res.json({ success: true, data: mapDocs(data) });
};

export const getDepartmentFileCategories = async (req, res) => {
  const deptId = req.user.departmentId;
  const { data } = await FileCategoryRepo.find(
    { department_id: deptId, is_active: true },
    { sort: { name: 'asc' } }
  );
  res.json({ success: true, data: mapFileCategories(data) });
};

export const blockDocument = async (req, res) => {
  const deptId = req.user.departmentId;
  const { id } = req.params;

  const dept = await DepartmentRepo.findById(deptId);
  if (!dept?.permissions?.blockDocuments) {
    throw new AppError('Your department does not have permission to block documents', 403);
  }

  const doc = await DocumentRepo.findOne({ id, department_id: deptId });
  if (!doc) throw new AppError('Document not found', 404);

  if (doc.group_id) {
    await DocumentRepo.updateMany(
      { group_id: doc.group_id, department_id: deptId },
      {
        payment_blocked: true,
        status: 'blocked',
        blocked_at: new Date().toISOString(),
      }
    );
    const updated = await DocumentRepo.findById(id);
    return res.json({ success: true, data: mapDoc(updated) });
  }

  if (!doc.result_file_stored_path) throw new AppError('No result file to block', 400);

  await DocumentRepo.update(id, {
    payment_blocked: true,
    status: 'blocked',
    blocked_at: new Date().toISOString(),
  });

  const updated = await DocumentRepo.findById(id);
  res.json({ success: true, data: mapDoc(updated) });
};

export const unblockDocument = async (req, res) => {
  const deptId = req.user.departmentId;
  const { id } = req.params;

  const dept = await DepartmentRepo.findById(deptId);
  if (!dept?.permissions?.blockDocuments) {
    throw new AppError('Your department does not have permission to unblock documents', 403);
  }

  const doc = await DocumentRepo.findOne({ id, department_id: deptId });
  if (!doc) throw new AppError('Document not found', 404);

  if (doc.group_id) {
    await DocumentRepo.updateMany(
      { group_id: doc.group_id, department_id: deptId },
      { payment_blocked: false, blocked_at: null, blocked_by: null }
    );
    const updated = await DocumentRepo.findById(id);
    return res.json({ success: true, data: mapDoc(updated) });
  }

  if (!doc.result_file_stored_path) throw new AppError('No result file to unblock', 400);

  await DocumentRepo.update(id, {
    payment_blocked: false,
    blocked_at: null,
    blocked_by: null,
  });

  const updated = await DocumentRepo.findById(id);
  res.json({ success: true, data: mapDoc(updated) });
};

export const updateNotes = async (req, res) => {
  const deptId = req.user.departmentId;
  const { id } = req.params;
  const { notes } = req.body;

  const doc = await DocumentRepo.findOne({ id, department_id: deptId });
  if (!doc) throw new AppError('Document not found', 404);

  await DocumentRepo.update(id, { notes });
  const updated = await DocumentRepo.findById(id);
  res.json({ success: true, data: mapDoc(updated) });
};

export const downloadFile = async (req, res) => {
  const deptId = req.user.departmentId;
  const { id } = req.params;

  const doc = await DocumentRepo.findOne({ id, department_id: deptId });
  if (!doc) throw new AppError('Document not found', 404);

  const { type } = req.query;

  if (type === 'result') {
    if (doc.payment_blocked) {
      throw new AppError('Result file is blocked until payment is completed.', 403);
    }
    if (doc.result_file_deleted_from_storage) {
      throw new AppError('The requested result file has been purged from storage.', 410);
    }
  }
  if (type !== 'result') {
    if (doc.file_deleted_from_storage) {
      throw new AppError('The requested submission file has been purged from storage.', 410);
    }
  }

  const filePath = type === 'result' && doc.result_file_stored_path ? doc.result_file_stored_path : doc.stored_path;
  const fileName = type === 'result' && doc.result_file_original_name ? doc.result_file_original_name : doc.original_name;

  if (!filePath) throw new AppError('File not found', 404);
  const url = await storageService.getDownloadUrl(filePath, fileName);
  if (!url) throw new AppError('File not found on storage', 404);

  res.redirect(url);
};

export const departmentPurgeDocumentFiles = async (req, res) => {
  const deptId = req.user.departmentId;
  const { id } = req.params;

  const doc = await DocumentRepo.findOne({ id, department_id: deptId });
  if (!doc) throw new AppError('Document not found', 404);

  let docsToPurge = [doc];
  if (doc.group_id) {
    const { data } = await DocumentRepo.find({ group_id: doc.group_id, department_id: deptId });
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

export const renameCustomer = async (req, res) => {
  if (!req.user.canRename) {
    throw new AppError('You do not have permission to rename', 403);
  }

  const deptId = req.user.departmentId;
  const { customerId } = req.params;
  const { name } = req.body;

  if (!name || !name.trim()) {
    throw new AppError('Name is required', 400);
  }

  const doc = await DocumentRepo.findOne({ customer_id: customerId, department_id: deptId });
  if (!doc) throw new AppError('Customer not found in your department', 404);

  const updated = await ProfileRepo.update(customerId, { name: name.trim() });
  res.json({ success: true, data: mapProfile(updated) });
};

export const departmentBatchDocuments = async (req, res) => {
  const { ids, action, status, groupId } = req.body;
  const deptId = req.user.departmentId;

  if (!ids || !Array.isArray(ids)) {
    throw new AppError('Document IDs array is required', 400);
  }

  if (action === 'status') {
    if (!status || !['pending', 'processing', 'completed', 'blocked'].includes(status)) {
      throw new AppError('Valid status is required', 400);
    }

    for (const id of ids) {
      const doc = await DocumentRepo.findOne({ id, department_id: deptId });
      if (doc) {
        const updatePayload = { status };
        if (status === 'blocked') {
          updatePayload.payment_blocked = true;
          updatePayload.blocked_at = new Date().toISOString();
        }

        if (groupId) {
          if (status === 'blocked') {
            await DocumentRepo.updateMany({ group_id: groupId, department_id: deptId, direction: 'response' }, updatePayload);
          } else {
            await DocumentRepo.updateMany({ group_id: groupId, department_id: deptId }, updatePayload);
          }
        } else {
          await DocumentRepo.update(id, updatePayload);
        }
      }
    }
  } else if (action === 'block') {
    for (const id of ids) {
      const doc = await DocumentRepo.findOne({ id, department_id: deptId });
      if (doc) {
        const updatePayload = {
          payment_blocked: true,
          status: 'blocked',
          blocked_at: new Date().toISOString(),
        };
        if (groupId) {
          await DocumentRepo.updateMany({ group_id: groupId, department_id: deptId, direction: 'response' }, updatePayload);
        } else {
          await DocumentRepo.update(id, updatePayload);
        }
      }
    }
  } else if (action === 'unblock') {
    for (const id of ids) {
      const doc = await DocumentRepo.findOne({ id, department_id: deptId });
      if (doc) {
        const updatePayload = { payment_blocked: false, blocked_at: null, blocked_by: null };
        if (groupId) {
          await DocumentRepo.updateMany({ group_id: groupId, department_id: deptId, direction: 'response' }, updatePayload);
        } else {
          await DocumentRepo.update(id, updatePayload);
        }
      }
    }
  } else if (action === 'delete') {
    if (!req.user.canDelete) {
      throw new AppError('You do not have permission to delete files or folders', 403);
    }
    for (const id of ids) {
      const doc = await DocumentRepo.findOne({ id, department_id: deptId });
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
          await DocumentRepo.update(item.id, {
            is_deleted: true,
            purged_at: new Date().toISOString()
          });
        }
      }
    }
  } else {
    throw new AppError('Invalid action', 400);
  }

  res.json({ success: true, message: 'Batch operation completed successfully' });
};
