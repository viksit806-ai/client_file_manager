import fs from 'fs';
import env from '../config/env.js';
import * as DocumentRepo from '../db/documents.js';
import * as DepartmentRepo from '../db/departments.js';
import * as ProfileRepo from '../db/profiles.js';
import * as NotificationRepo from '../db/notifications.js';
import AppError from '../utils/AppError.js';
import storageService from '../services/storage.service.js';
import { mapDoc, mapDocs } from '../utils/transform.js';

export const getDepartments = async (req, res) => {
  const { data: departments } = await DepartmentRepo.find(
    { is_active: true },
    { sort: { name: 'asc' } }
  );
  res.json({ success: true, data: departments });
};

export const uploadDocument = async (req, res) => {
  const customerId = req.user._id;
  const { departmentId, description, requiresResult } = req.body;

  if (!departmentId) throw new AppError('Department ID is required', 400);
  if (!req.files || req.files.length === 0) throw new AppError('At least one file is required', 400);

  if (description) {
    const wordCount = description.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount > 500) {
      throw new AppError('Description cannot exceed 500 words', 400);
    }
  }

  // Calculate cumulative storage quota
  const incomingTotal = req.files.reduce((sum, f) => sum + f.size, 0);
  const currentTotal = await DocumentRepo.getCustomerStorage(customerId);

  if (currentTotal + incomingTotal > env.MAX_STORAGE_LIMIT) {
    for (const file of req.files) {
      if (file.path && fs.existsSync(file.path)) {
        try { fs.unlinkSync(file.path); } catch (_) {}
      }
    }
    throw new AppError('Storage quota exceeded. Maximum cumulative storage is 200MB.', 413);
  }

  const department = await DepartmentRepo.findById(departmentId);
  if (!department || !department.is_active) {
    for (const file of req.files) {
      if (file.path && fs.existsSync(file.path)) {
        try { fs.unlinkSync(file.path); } catch (_) {}
      }
    }
    throw new AppError('Department not found', 404);
  }

  const reqResult = requiresResult === 'false' || requiresResult === false ? false : true;
  const { v4: uuidv4 } = await import('uuid');
  const groupId = uuidv4();
  const savedFilePaths = [];

  try {
    for (const file of req.files) {
      const fileInfo = await storageService.saveSubmission(file, customerId, departmentId);
      savedFilePaths.push(fileInfo.storedPath);

      await DocumentRepo.create({
        customer_id: customerId,
        department_id: department.id,
        group_id: groupId,
        requires_result: reqResult,
        title: file.originalname,
        description: description || '',
        direction: 'submission',
        original_name: fileInfo.originalName,
        stored_path: fileInfo.storedPath,
        mime_type: fileInfo.mimeType,
        file_size: fileInfo.fileSize,
        status: 'pending',
      });
    }

    const { data: populatedDocs } = await DocumentRepo.find(
      { group_id: groupId },
      { sort: { created_at: 'asc' } }
    );

    // Notify department users
    const { data: deptUsers } = await ProfileRepo.find({
      department_id: department.id,
      role: 'department',
      is_active: true,
    });

    const notifications = deptUsers.map(u => ({
      user_id: u.id,
      type: 'new_request',
      message: `${req.user.name} submitted a new request to ${department.name}`,
      link: `/department/customers/${customerId}`,
    }));
    if (notifications.length > 0) {
      await NotificationRepo.insertMany(notifications);
    }

    res.status(201).json({ success: true, data: mapDocs(populatedDocs) });
  } catch (error) {
    for (const filePath of savedFilePaths) {
      try { await storageService.deleteFile(filePath); } catch (_) {}
    }
    for (const file of req.files) {
      if (file.path && fs.existsSync(file.path)) {
        try { fs.unlinkSync(file.path); } catch (_) {}
      }
    }
    throw error;
  }
};

export const getDocuments = async (req, res) => {
  const customerId = req.user._id;
  const filters = { customer_id: customerId, direction: 'submission', is_deleted: false };

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

export const downloadDocument = async (req, res) => {
  const customerId = req.user._id;
  const { id } = req.params;
  const { type } = req.query;

  const doc = await DocumentRepo.findOne({ id, customer_id: customerId });
  if (!doc) throw new AppError('Document not found', 404);

  if (type === 'result') {
    if (doc.result_file_deleted_from_storage) {
      throw new AppError('The requested result file has been purged from storage to free up space.', 410);
    }
    if (doc.payment_blocked) {
      throw new AppError('Document is blocked. Please contact the firm regarding payment.', 403);
    }
  } else {
    if (doc.file_deleted_from_storage) {
      throw new AppError('The requested submission file has been purged from storage to free up space.', 410);
    }
  }

  const filePath = type === 'result' && doc.result_file_stored_path ? doc.result_file_stored_path : doc.stored_path;
  if (!filePath) throw new AppError('File not found', 404);

  const fileName = type === 'result' && doc.result_file_original_name ? doc.result_file_original_name : doc.original_name;
  const url = await storageService.getDownloadUrl(filePath, fileName);
  if (!url) throw new AppError('File not found on storage', 404);

  res.redirect(url);
};

export const getResponses = async (req, res) => {
  const customerId = req.user._id;
  const { fileCategoryId } = req.query;
  const filters = { customer_id: customerId, direction: 'response', is_deleted: false };
  if (fileCategoryId && typeof fileCategoryId === 'string') filters.file_category_id = fileCategoryId;

  const { data } = await DocumentRepo.find(filters, { sort: { created_at: 'desc' } });
  res.json({ success: true, data: mapDocs(data) });
};

export const getResponseCategories = async (req, res) => {
  const customerId = req.user._id;

  const { data: docs } = await DocumentRepo.find(
    {
      customer_id: customerId,
      direction: 'response',
      is_deleted: false,
    },
    { sort: { created_at: 'desc' }, limit: 10000 }
  );

  const grouped = {};
  for (const doc of docs) {
    if (!doc.file_category_id) continue;
    if (!grouped[doc.file_category_id]) {
      grouped[doc.file_category_id] = {
        _id: doc.file_category_id,
        name: doc.file_category?.name || 'Unknown',
        departmentName: doc.department?.name || 'General',
        documents: [],
      };
    }
    grouped[doc.file_category_id].documents.push(mapDoc(doc));
  }

  res.json({ success: true, data: Object.values(grouped) });
};
