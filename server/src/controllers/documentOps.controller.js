import mongoose from 'mongoose';
import Document from '../models/Document.model.js';
import AppError from '../utils/AppError.js';
import fs from 'fs';
import env from '../config/env.js';
import storageService from '../services/storage.service.js';

export const renameDocument = async (req, res) => {
  const { id } = req.params;
  const { name, isResult } = req.body;
  if (!name) throw new AppError('Name is required', 400);

  // Check role permission (admin is always allowed)
  if (req.user.role !== 'super_admin' && !req.user.canRename) {
    throw new AppError('You do not have permission to rename files or folders', 403);
  }

  const query = { _id: id };
  if (req.user.role === 'customer') query.customerId = req.user._id;
  if (req.user.role === 'department') query.departmentId = req.user.departmentId;

  const doc = await Document.findOne(query);
  if (!doc) throw new AppError('Document not found', 404);

  if (isResult && doc.resultFile) {
    doc.resultFile.originalName = name;
  } else {
    doc.title = name;
    doc.originalName = name;
  }

  await doc.save();
  res.json({ success: true, data: doc });
};

export const renameGroup = async (req, res) => {
  const { groupId } = req.params;
  const { name } = req.body;
  if (!name) throw new AppError('Name is required', 400);

  if (req.user.role !== 'super_admin' && !req.user.canRename) {
    throw new AppError('You do not have permission to rename files or folders', 403);
  }

  const query = { groupId };
  if (req.user.role === 'customer') query.customerId = req.user._id;
  if (req.user.role === 'department') query.departmentId = req.user.departmentId;

  await Document.updateMany(query, { customGroupName: name });
  res.json({ success: true, message: 'Folder renamed successfully' });
};

export const deleteDocument = async (req, res) => {
  const { id } = req.params;
  const { isResult } = req.body;

  if (req.user.role !== 'super_admin' && !req.user.canDelete) {
    throw new AppError('You do not have permission to delete files or folders', 403);
  }

  const query = { _id: id };
  if (req.user.role === 'customer') query.customerId = req.user._id;
  if (req.user.role === 'department') query.departmentId = req.user.departmentId;

  const doc = await Document.findOne(query);
  if (!doc) throw new AppError('Document not found', 404);

  // Soft delete / Storage purge logic
  if (isResult && doc.resultFile) {
    if (doc.resultFile.storedPath && !doc.resultFileDeletedFromStorage) {
      try {
        if (fs.existsSync(doc.resultFile.storedPath)) {
          fs.unlinkSync(doc.resultFile.storedPath);
        }
      } catch (err) {
        console.error(`Failed to delete file ${doc.resultFile.storedPath}:`, err);
      }
      doc.resultFileDeletedFromStorage = true;
    }
    doc.isDeleted = true;
  } else {
    // Delete submission (deletes entire document)
    if (doc.storedPath && !doc.fileDeletedFromStorage) {
      try {
        if (fs.existsSync(doc.storedPath)) {
          fs.unlinkSync(doc.storedPath);
        }
      } catch (err) {
        console.error(`Failed to delete file ${doc.storedPath}:`, err);
      }
      doc.fileDeletedFromStorage = true;
    }
    if (doc.resultFile?.storedPath && !doc.resultFileDeletedFromStorage) {
      try {
        if (fs.existsSync(doc.resultFile.storedPath)) {
          fs.unlinkSync(doc.resultFile.storedPath);
        }
      } catch (err) {
        console.error(`Failed to delete file ${doc.resultFile.storedPath}:`, err);
      }
      doc.resultFileDeletedFromStorage = true;
    }
    doc.isDeleted = true;
  }

  doc.purgedAt = new Date();
  doc.purgedBy = req.user._id;
  await doc.save();

  res.json({ success: true, message: 'File deleted successfully', data: doc });
};

export const deleteGroup = async (req, res) => {
  const { groupId } = req.params;

  if (req.user.role !== 'super_admin' && !req.user.canDelete) {
    throw new AppError('You do not have permission to delete files or folders', 403);
  }

  const query = { groupId };
  if (req.user.role === 'customer') query.customerId = req.user._id;
  if (req.user.role === 'department') query.departmentId = req.user.departmentId;

  const docs = await Document.find(query);
  for (const doc of docs) {
    if (doc.storedPath && !doc.fileDeletedFromStorage) {
      try {
        if (fs.existsSync(doc.storedPath)) {
          fs.unlinkSync(doc.storedPath);
        }
      } catch (err) {
        console.error(`Failed to delete file ${doc.storedPath}:`, err);
      }
      doc.fileDeletedFromStorage = true;
    }
    if (doc.resultFile?.storedPath && !doc.resultFileDeletedFromStorage) {
      try {
        if (fs.existsSync(doc.resultFile.storedPath)) {
          fs.unlinkSync(doc.resultFile.storedPath);
        }
      } catch (err) {
        console.error(`Failed to delete file ${doc.resultFile.storedPath}:`, err);
      }
      doc.resultFileDeletedFromStorage = true;
    }
    doc.isDeleted = true;
    doc.purgedAt = new Date();
    doc.purgedBy = req.user._id;
    await doc.save();
  }

  res.json({ success: true, message: 'Folder deleted successfully' });
};

// ─── Create an empty folder (placeholder document) ───────────────────────────
// Works for super_admin (any customer), dept users with canCreate, customers with canCreate.
export const createEmptyFolder = async (req, res) => {
  const { folderName, customerId, departmentId } = req.body;
  if (!folderName || !folderName.trim()) throw new AppError('Folder name is required', 400);

  // Permission check
  if (req.user.role !== 'super_admin' && !req.user.canCreate) {
    throw new AppError('You do not have permission to create folders', 403);
  }

  // Resolve effective customerId / departmentId
  const effectiveCustomerId = req.user.role === 'customer'
    ? req.user._id
    : (customerId || null);
  const effectiveDepartmentId = req.user.role === 'department'
    ? req.user.departmentId
    : (departmentId || null);

  if (!effectiveCustomerId) throw new AppError('Customer ID is required', 400);
  if (!effectiveDepartmentId) throw new AppError('Department ID is required', 400);

  const groupId = new mongoose.Types.ObjectId();

  const placeholder = await Document.create({
    customerId: effectiveCustomerId,
    departmentId: effectiveDepartmentId,
    groupId,
    customGroupName: folderName.trim(),
    title: folderName.trim(),
    storedPath: null,          // no file – this is a folder placeholder
    direction: 'submission',
    status: 'pending',
    requiresResult: false,
    isPlaceholder: true,       // flag so UI can skip it in file listings
  });

  res.status(201).json({ success: true, data: placeholder, message: 'Folder created successfully' });
};

// ─── Upload files into an existing group/folder ───────────────────────────────
// Accepts groupId param – files are saved under the customer's directory tree.
export const uploadFilesToFolder = async (req, res) => {
  const { groupId } = req.params;

  // Permission check
  if (req.user.role !== 'super_admin' && !req.user.canCreate) {
    throw new AppError('You do not have permission to upload files', 403);
  }

  if (!req.files || req.files.length === 0) throw new AppError('At least one file is required', 400);

  // Resolve group reference to fetch the customerId / departmentId from an existing doc in that group
  const refDoc = await Document.findOne({ groupId });
  if (!refDoc) throw new AppError('Folder group not found', 404);

  // Department users can only upload to their own department's groups
  if (req.user.role === 'department' && refDoc.departmentId?.toString() !== req.user.departmentId?.toString()) {
    throw new AppError('You do not have permission to upload to this folder', 403);
  }

  const effectiveCustomerId = refDoc.customerId;
  const effectiveDepartmentId = refDoc.departmentId;

  // Storage quota check (sum existing non-deleted docs for this customer)
  const incomingTotal = req.files.reduce((sum, f) => sum + f.size, 0);
  const storageResult = await Document.aggregate([
    {
      $match: {
        customerId: new mongoose.Types.ObjectId(effectiveCustomerId.toString()),
        fileDeletedFromStorage: { $ne: true },
        storedPath: { $ne: null },
      },
    },
    { $group: { _id: null, totalSize: { $sum: '$fileSize' } } },
  ]);
  const currentTotal = storageResult[0]?.totalSize || 0;

  if (currentTotal + incomingTotal > env.MAX_STORAGE_LIMIT) {
    // Clean up multer temp files
    for (const file of req.files) {
      if (file.path && fs.existsSync(file.path)) {
        try { fs.unlinkSync(file.path); } catch (_) {}
      }
    }
    throw new AppError('Storage quota exceeded. Maximum cumulative storage is 200 MB.', 413);
  }

  const savedFilePaths = [];
  const createdDocs = [];

  try {
    for (const file of req.files) {
      const fileInfo = await storageService.saveSubmission(file, effectiveCustomerId, effectiveDepartmentId);
      savedFilePaths.push(fileInfo.storedPath);

      const doc = await Document.create({
        customerId: effectiveCustomerId,
        departmentId: effectiveDepartmentId,
        groupId: refDoc.groupId,
        customGroupName: refDoc.customGroupName,
        title: file.originalname,
        direction: 'submission',
        status: 'pending',
        requiresResult: false,
        ...fileInfo,
      });
      createdDocs.push(doc);
    }

    res.status(201).json({ success: true, data: createdDocs, message: 'Files uploaded successfully' });
  } catch (err) {
    // Rollback saved files
    for (const fp of savedFilePaths) {
      if (fs.existsSync(fp)) { try { fs.unlinkSync(fp); } catch (_) {} }
    }
    for (const file of req.files) {
      if (file.path && fs.existsSync(file.path)) { try { fs.unlinkSync(file.path); } catch (_) {} }
    }
    throw err;
  }
};

