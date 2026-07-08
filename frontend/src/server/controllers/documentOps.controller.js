import fs from 'fs';
import env from '../config/env.js';
import * as DocumentRepo from '../db/documents.js';
import AppError from '../utils/AppError.js';
import storageService from '../services/storage.service.js';
import { mapDoc } from '../utils/transform.js';

export const renameDocument = async (req, res) => {
  const { id } = req.params;
  const { name, isResult } = req.body;
  if (!name) throw new AppError('Name is required', 400);

  if (req.user.role !== 'super_admin' && !req.user.canRename) {
    throw new AppError('You do not have permission to rename files or folders', 403);
  }

  const filters = { id };
  if (req.user.role === 'customer') filters.customer_id = req.user._id;
  if (req.user.role === 'department') filters.department_id = req.user.departmentId;

  const doc = await DocumentRepo.findOne(filters);
  if (!doc) throw new AppError('Document not found', 404);

  if (isResult && doc.result_file_stored_path) {
    await DocumentRepo.update(id, { result_file_original_name: name });
  } else {
    await DocumentRepo.update(id, { title: name, original_name: name });
  }

  const updated = await DocumentRepo.findById(id);
  res.json({ success: true, data: mapDoc(updated) });
};

export const renameGroup = async (req, res) => {
  const { groupId } = req.params;
  const { name } = req.body;
  if (!name) throw new AppError('Name is required', 400);

  if (req.user.role !== 'super_admin' && !req.user.canRename) {
    throw new AppError('You do not have permission to rename files or folders', 403);
  }

  const filters = { group_id: groupId };
  if (req.user.role === 'customer') filters.customer_id = req.user._id;
  if (req.user.role === 'department') filters.department_id = req.user.departmentId;

  await DocumentRepo.updateMany(filters, { custom_group_name: name });
  res.json({ success: true, message: 'Folder renamed successfully' });
};

export const deleteDocument = async (req, res) => {
  const { id } = req.params;
  const { isResult } = req.body;

  if (req.user.role !== 'super_admin' && !req.user.canDelete) {
    throw new AppError('You do not have permission to delete files or folders', 403);
  }

  const filters = { id };
  if (req.user.role === 'customer') filters.customer_id = req.user._id;
  if (req.user.role === 'department') filters.department_id = req.user.departmentId;

  const doc = await DocumentRepo.findOne(filters);
  if (!doc) throw new AppError('Document not found', 404);

  const updates = { is_deleted: true, purged_at: new Date().toISOString() };

  if (isResult && doc.result_file_stored_path) {
    if (!doc.result_file_deleted_from_storage) {
      try { await storageService.deleteFile(doc.result_file_stored_path); } catch (_) {}
      updates.result_file_deleted_from_storage = true;
    }
  } else {
    if (doc.stored_path && !doc.file_deleted_from_storage) {
      try { await storageService.deleteFile(doc.stored_path); } catch (_) {}
      updates.file_deleted_from_storage = true;
    }
    if (doc.result_file_stored_path && !doc.result_file_deleted_from_storage) {
      try { await storageService.deleteFile(doc.result_file_stored_path); } catch (_) {}
      updates.result_file_deleted_from_storage = true;
    }
  }

  await DocumentRepo.update(id, updates);
  const updated = await DocumentRepo.findById(id);
  res.json({ success: true, message: 'File deleted successfully', data: mapDoc(updated) });
};

export const deleteGroup = async (req, res) => {
  const { groupId } = req.params;

  if (req.user.role !== 'super_admin' && !req.user.canDelete) {
    throw new AppError('You do not have permission to delete files or folders', 403);
  }

  const filters = { group_id: groupId };
  if (req.user.role === 'customer') filters.customer_id = req.user._id;
  if (req.user.role === 'department') filters.department_id = req.user.departmentId;

  const { data: docs } = await DocumentRepo.find(filters);
  for (const doc of docs) {
    const updates = { is_deleted: true, purged_at: new Date().toISOString() };
    if (doc.stored_path && !doc.file_deleted_from_storage) {
      try { await storageService.deleteFile(doc.stored_path); } catch (_) {}
      updates.file_deleted_from_storage = true;
    }
    if (doc.result_file_stored_path && !doc.result_file_deleted_from_storage) {
      try { await storageService.deleteFile(doc.result_file_stored_path); } catch (_) {}
      updates.result_file_deleted_from_storage = true;
    }
    await DocumentRepo.update(doc.id, updates);
  }

  res.json({ success: true, message: 'Folder deleted successfully' });
};

export const createEmptyFolder = async (req, res) => {
  const { folderName, customerId, departmentId } = req.body;
  if (!folderName || !folderName.trim()) throw new AppError('Folder name is required', 400);

  if (req.user.role !== 'super_admin' && !req.user.canCreate) {
    throw new AppError('You do not have permission to create folders', 403);
  }

  const effectiveCustomerId = req.user.role === 'customer'
    ? req.user._id
    : (customerId || null);
  const effectiveDepartmentId = req.user.role === 'department'
    ? req.user.departmentId
    : (departmentId || null);

  if (!effectiveCustomerId) throw new AppError('Customer ID is required', 400);
  if (!effectiveDepartmentId) throw new AppError('Department ID is required', 400);

  const { v4: uuidv4 } = await import('uuid');
  const groupId = uuidv4();

  const placeholder = await DocumentRepo.create({
    customer_id: effectiveCustomerId,
    department_id: effectiveDepartmentId,
    group_id: groupId,
    custom_group_name: folderName.trim(),
    title: folderName.trim(),
    stored_path: null,
    direction: 'submission',
    status: 'pending',
    requires_result: false,
    is_placeholder: true,
  });

  res.status(201).json({ success: true, data: mapDoc(placeholder), message: 'Folder created successfully' });
};

export const uploadFilesToFolder = async (req, res) => {
  const { groupId } = req.params;

  if (req.user.role !== 'super_admin' && !req.user.canCreate) {
    throw new AppError('You do not have permission to upload files', 403);
  }

  if (!req.files || req.files.length === 0) throw new AppError('At least one file is required', 400);

  const refDoc = await DocumentRepo.findOne({ group_id: groupId });
  if (!refDoc) throw new AppError('Folder group not found', 404);

  if (req.user.role === 'department' && refDoc.department_id !== req.user.departmentId) {
    throw new AppError('You do not have permission to upload to this folder', 403);
  }

  const effectiveCustomerId = refDoc.customer_id;
  const effectiveDepartmentId = refDoc.department_id;

  const incomingTotal = req.files.reduce((sum, f) => sum + f.size, 0);
  const currentTotal = await DocumentRepo.getCustomerStorage(effectiveCustomerId);

  if (currentTotal + incomingTotal > env.MAX_STORAGE_LIMIT) {
    for (const file of req.files) {
      if (file.path && fs.existsSync(file.path)) { try { fs.unlinkSync(file.path); } catch (_) {} }
    }
    throw new AppError('Storage quota exceeded. Maximum cumulative storage is 200 MB.', 413);
  }

  const savedFilePaths = [];
  const createdDocs = [];

  try {
    for (const file of req.files) {
      const fileInfo = await storageService.saveSubmission(file, effectiveCustomerId, effectiveDepartmentId);
      savedFilePaths.push(fileInfo.storedPath);

      const doc = await DocumentRepo.create({
        customer_id: effectiveCustomerId,
        department_id: effectiveDepartmentId,
        group_id: refDoc.group_id,
        custom_group_name: refDoc.custom_group_name,
        title: file.originalname,
        direction: 'submission',
        status: 'pending',
        requires_result: false,
        original_name: fileInfo.originalName,
        stored_path: fileInfo.storedPath,
        mime_type: fileInfo.mimeType,
        file_size: fileInfo.fileSize,
      });
      createdDocs.push(doc);
    }

    res.status(201).json({ success: true, data: createdDocs, message: 'Files uploaded successfully' });
  } catch (err) {
    for (const fp of savedFilePaths) {
      try { await storageService.deleteFile(fp); } catch (_) {}
    }
    for (const file of req.files) {
      if (file.path && fs.existsSync(file.path)) { try { fs.unlinkSync(file.path); } catch (_) {} }
    }
    throw err;
  }
};
