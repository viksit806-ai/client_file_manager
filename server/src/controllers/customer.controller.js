import mongoose from 'mongoose';
import fs from 'fs';
import env from '../config/env.js';
import Document from '../models/Document.model.js';
import Department from '../models/Department.model.js';
import User from '../models/User.model.js';
import Notification from '../models/Notification.model.js';
import AppError from '../utils/AppError.js';
import storageService from '../services/storage.service.js';
import path from 'path';

export const getDepartments = async (req, res) => {
  const departments = await Department.find({ isActive: true })
    .sort({ name: 1 })
    .lean();
  res.json({ success: true, data: departments });
};

export const uploadDocument = async (req, res) => {
  const customerId = req.user._id;
  const { departmentId, description, requiresResult } = req.body;

  if (!departmentId) throw new AppError('Department ID is required', 400);
  if (!req.files || req.files.length === 0) throw new AppError('At least one file is required', 400);

  // Validate description word count
  if (description) {
    const wordCount = description.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount > 500) {
      throw new AppError('Description cannot exceed 500 words', 400);
    }
  }

  // Calculate cumulative storage quota and incoming upload size
  const incomingTotal = req.files.reduce((sum, f) => sum + f.size, 0);
  const storageResult = await Document.aggregate([
    {
      $match: {
        customerId: new mongoose.Types.ObjectId(customerId),
        fileDeletedFromStorage: { $ne: true }
      }
    },
    { $group: { _id: null, totalSize: { $sum: '$fileSize' } } }
  ]);
  const currentTotal = storageResult[0]?.totalSize || 0;

  if (currentTotal + incomingTotal > env.MAX_STORAGE_LIMIT) {
    // Clean up temp files stored by multer in this request
    for (const file of req.files) {
      if (file.path && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch (err) {
          console.error(`Failed to delete temp file ${file.path}:`, err);
        }
      }
    }
    throw new AppError('Storage quota exceeded. Maximum cumulative storage is 200MB.', 413);
  }

  const department = await Department.findById(departmentId);
  if (!department || !department.isActive) {
    // Clean up temp files
    for (const file of req.files) {
      if (file.path && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch (err) {
          console.error(`Failed to delete temp file ${file.path}:`, err);
        }
      }
    }
    throw new AppError('Department not found', 404);
  }

  // Coerce requiresResult to boolean (default: true)
  const reqResult = requiresResult === 'false' || requiresResult === false ? false : true;

  const groupId = new mongoose.Types.ObjectId();
  const savedFilePaths = [];

  try {
    for (const file of req.files) {
      const fileInfo = await storageService.saveSubmission(file, customerId, departmentId);
      savedFilePaths.push(fileInfo.storedPath);

      await Document.create({
        customerId,
        departmentId: department._id,
        groupId,
        requiresResult: reqResult,
        title: file.originalname,
        description: description || '',
        direction: 'submission',
        ...fileInfo,
        status: 'pending',
      });
    }

    // Populate department name for all created docs in this batch
    const populatedDocs = await Document.find({ groupId })
      .populate('departmentId', 'name');

    // Notify all department users in this department
    const deptUsers = await User.find({ departmentId: department._id, role: 'department', isActive: true }).lean();
    const notifications = deptUsers.map(u => ({
      userId: u._id,
      type: 'new_request',
      message: `${req.user.name} submitted a new request to ${department.name}`,
      link: `/department/customers/${customerId}`,
    }));
    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    res.status(201).json({ success: true, data: populatedDocs });
  } catch (error) {
    // Clean up any files uploaded to Supabase
    for (const filePath of savedFilePaths) {
      try { await storageService.deleteFile(filePath); } catch (_) {}
    }
    // Clean up any remaining temp files in multer storage
    for (const file of req.files) {
      if (file.path && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch (err) {
          console.error(`Failed to clean up temp file ${file.path}:`, err);
        }
      }
    }
    throw error;
  }
};

export const getDocuments = async (req, res) => {
  const customerId = req.user._id;
  const query = { customerId, direction: 'submission', isDeleted: { $ne: true } };

  const page = parseInt(req.query.page);
  const limit = parseInt(req.query.limit);

  if (page && limit) {
    const skip = (page - 1) * limit;
    const total = await Document.countDocuments(query);
    const docs = await Document.find(query)
      .populate('departmentId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    res.json({
      success: true,
      data: docs,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) }
    });
  } else {
    const docs = await Document.find(query)
      .populate('departmentId', 'name')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: docs });
  }
};

export const downloadDocument = async (req, res) => {
  const customerId = req.user._id;
  const { id } = req.params;
  const { type } = req.query;

  const doc = await Document.findOne({ _id: id, customerId });
  if (!doc) throw new AppError('Document not found', 404);

  if (type === 'result') {
    if (doc.resultFileDeletedFromStorage) {
      throw new AppError('The requested result file has been purged from storage to free up space.', 410);
    }
    if (doc.paymentBlocked) {
      throw new AppError('Document is blocked. Please contact the firm regarding payment.', 403);
    }
  } else {
    if (doc.fileDeletedFromStorage) {
      throw new AppError('The requested submission file has been purged from storage to free up space.', 410);
    }
  }

  const filePath = type === 'result' && doc.resultFile ? doc.resultFile.storedPath : doc.storedPath;
  if (!filePath) throw new AppError('File not found', 404);

  const fileName = type === 'result' && doc.resultFile ? doc.resultFile.originalName : doc.originalName;
  const url = await storageService.getDownloadUrl(filePath, fileName);
  if (!url) throw new AppError('File not found on storage', 404);

  res.redirect(url);
};

export const getResponses = async (req, res) => {
  const customerId = req.user._id;
  const { fileCategoryId } = req.query;
  const query = { customerId, direction: 'response', isDeleted: { $ne: true } };
  if (fileCategoryId && typeof fileCategoryId === 'string') query.fileCategoryId = fileCategoryId;

  const docs = await Document.find(query)
    .populate('fileCategoryId', 'name')
    .populate('departmentId', 'name')
    .sort({ createdAt: -1 })
    .lean();

  res.json({ success: true, data: docs });
};

export const getResponseCategories = async (req, res) => {
  const customerId = req.user._id;

  const docs = await Document.find({
    customerId, direction: 'response', isDeleted: { $ne: true },
    fileCategoryId: { $ne: null },
  })
    .populate('fileCategoryId', 'name')
    .populate('departmentId', 'name')
    .sort({ createdAt: -1 })
    .lean();

  const grouped = {};
  for (const doc of docs) {
    const fcId = doc.fileCategoryId?._id?.toString();
    if (!fcId) continue;
    if (!grouped[fcId]) {
      grouped[fcId] = {
        _id: doc.fileCategoryId._id,
        name: doc.fileCategoryId.name,
        departmentName: doc.departmentId?.name || 'General',
        documents: [],
      };
    }
    grouped[fcId].documents.push(doc);
  }

  res.json({ success: true, data: Object.values(grouped) });
};
