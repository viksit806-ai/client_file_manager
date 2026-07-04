import User from '../models/User.model.js';
import Department from '../models/Department.model.js';
import FileCategory from '../models/FileCategory.model.js';
import Document from '../models/Document.model.js';
import AppError from '../utils/AppError.js';
import crypto from 'crypto';

const generatePassword = () => crypto.randomBytes(12).toString('hex');

const SLA_MS = 48 * 60 * 60 * 1000;
const WARNING_MS = 12 * 60 * 60 * 1000;

export const getDashboard = async (req, res) => {
  const now = new Date();

  const [totalCustomers, totalDepartments, totalDeptUsers, totalDocuments, deptStats, slaOverview] = await Promise.all([
    User.countDocuments({ role: 'customer' }),
    Department.countDocuments(),
    User.countDocuments({ role: 'department' }),
    Document.countDocuments(),
    Document.aggregate([
      { $group: { _id: '$departmentId', count: { $sum: 1 } } },
      { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'dept' } },
      { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
      { $project: { deptName: '$dept.name', count: 1 } },
    ]),
    Document.aggregate([
      { $match: { status: { $in: ['pending', 'processing'] } } },
      {
        $group: {
          _id: '$departmentId',
          overdue: {
            $sum: { $cond: [{ $lt: ['$createdAt', new Date(now - SLA_MS)] }, 1, 0] },
          },
          approaching: {
            $sum: {
              $cond: [
                { $and: [
                  { $gte: ['$createdAt', new Date(now - SLA_MS)] },
                  { $lt: ['$createdAt', new Date(now - SLA_MS + WARNING_MS)] },
                ]},
                1, 0,
              ],
            },
          },
          withinSla: {
            $sum: { $cond: [{ $gte: ['$createdAt', new Date(now - SLA_MS + WARNING_MS)] }, 1, 0] },
          },
        },
      },
      { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'dept' } },
      { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
      { $project: { deptName: '$dept.name', overdue: 1, approaching: 1, withinSla: 1 } },
    ]),
  ]);

  const recentDocs = await Document.find()
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('customerId', 'name email')
    .lean();

  res.json({
    success: true,
    data: { totalCustomers, totalDepartments, totalDeptUsers, totalDocuments, deptStats, slaOverview, recentDocs },
  });
};

export const getCustomers = async (req, res) => {
  const { search, status } = req.query;
  const query = { role: 'customer' };
  if (search && typeof search === 'string') {
    query.$or = [
      { name: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
      { email: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
    ];
  }
  if (status === 'active') query.isActive = true;
  if (status === 'inactive') query.isActive = false;

  const page = parseInt(req.query.page);
  const limit = parseInt(req.query.limit);

  if (page && limit) {
    const skip = (page - 1) * limit;
    const total = await User.countDocuments(query);
    const customers = await User.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
    res.json({
      success: true,
      data: customers,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) }
    });
  } else {
    const customers = await User.find(query).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: customers });
  }
};

export const createCustomer = async (req, res) => {
  const { name, email, password: customPassword, canRename, canDelete, canCreate } = req.body;
  if (!name || !email) {
    throw new AppError('Name and email are required', 400);
  }

  const password = customPassword || generatePassword();
  const customer = await User.create({
    name, email, password,
    role: 'customer',
    createdBy: req.user._id,
    mustChangePassword: true,
    canRename: canRename || false,
    canDelete: canDelete || false,
    canCreate: canCreate || false,
  });

  res.status(201).json({
    success: true,
    data: customer.toJSON(),
    message: 'Customer created successfully',
  });
};

export const updateCustomer = async (req, res) => {
  const { id } = req.params;
  const { name, email, isActive, canRename, canDelete, canCreate } = req.body;

  const customer = await User.findOneAndUpdate(
    { _id: id, role: 'customer' },
    { $set: { name, email, isActive, canRename, canDelete, canCreate } },
    { new: true, runValidators: true }
  );

  if (!customer) throw new AppError('Customer not found', 404);
  res.json({ success: true, data: customer });
};

export const deleteCustomer = async (req, res) => {
  const { id } = req.params;
  const customer = await User.findOneAndDelete({ _id: id, role: 'customer' });
  if (!customer) throw new AppError('Customer not found', 404);
  await Document.deleteMany({ customerId: id });
  res.json({ success: true, message: 'Customer deleted' });
};

export const resetCustomerPassword = async (req, res) => {
  const { id } = req.params;
  const customer = await User.findOne({ _id: id, role: 'customer' });
  if (!customer) throw new AppError('Customer not found', 404);

  const newPassword = generatePassword();
  customer.password = newPassword;
  customer.mustChangePassword = true;
  await customer.save();

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

  const customer = await User.findOne({ _id: id, role: 'customer' });
  if (!customer) throw new AppError('Customer not found', 404);

  customer.password = password;
  customer.mustChangePassword = false;
  await customer.save();

  res.json({ success: true, message: 'Password updated successfully' });
};

export const getCustomerDocuments = async (req, res) => {
  const { id } = req.params;
  const page = parseInt(req.query.page);
  const limit = parseInt(req.query.limit);
  const query = { customerId: id, isDeleted: { $ne: true } };

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

export const getDepartments = async (req, res) => {
  const page = parseInt(req.query.page);
  const limit = parseInt(req.query.limit);

  if (page && limit) {
    const skip = (page - 1) * limit;
    const total = await Department.countDocuments();
    const departments = await Department.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
    res.json({
      success: true,
      data: departments,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) }
    });
  } else {
    const departments = await Department.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: departments });
  }
};

export const createDepartment = async (req, res) => {
  const { name, description } = req.body;
  if (!name) throw new AppError('Department name is required', 400);

  const dept = await Department.create({
    name, description: description || '',
    createdBy: req.user._id,
  });

  res.status(201).json({ success: true, data: dept });
};

export const updateDepartment = async (req, res) => {
  const { id } = req.params;
  const { name, description, isActive, permissions } = req.body;

  const dept = await Department.findByIdAndUpdate(
    id,
    { $set: { name, description, isActive, permissions } },
    { new: true, runValidators: true }
  );

  if (!dept) throw new AppError('Department not found', 404);
  res.json({ success: true, data: dept });
};

export const deleteDepartment = async (req, res) => {
  const { id } = req.params;
  const dept = await Department.findByIdAndDelete(id);
  if (!dept) throw new AppError('Department not found', 404);
  await User.updateMany({ departmentId: id, role: 'department' }, { isActive: false });
  res.json({ success: true, message: 'Department deleted' });
};

export const updateDepartmentPermissions = async (req, res) => {
  const { id } = req.params;
  const { blockDocuments, viewCustomers } = req.body;

  const dept = await Department.findByIdAndUpdate(
    id,
    { $set: { 'permissions.blockDocuments': blockDocuments, 'permissions.viewCustomers': viewCustomers } },
    { new: true }
  );

  if (!dept) throw new AppError('Department not found', 404);
  res.json({ success: true, data: dept });
};

export const getDepartmentUsers = async (req, res) => {
  const { deptId } = req.query;
  const query = { role: 'department' };
  if (deptId && typeof deptId === 'string') query.departmentId = deptId;

  const page = parseInt(req.query.page);
  const limit = parseInt(req.query.limit);

  if (page && limit) {
    const skip = (page - 1) * limit;
    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .populate('departmentId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    res.json({
      success: true,
      data: users,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) }
    });
  } else {
    const users = await User.find(query)
      .populate('departmentId', 'name')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: users });
  }
};

export const getDepartmentUsersByDept = async (req, res) => {
  const { deptId } = req.params;
  const users = await User.find({ role: 'department', departmentId: deptId })
    .sort({ createdAt: -1 })
    .lean();

  res.json({ success: true, data: users });
};

export const createDepartmentUser = async (req, res) => {
  const { name, email, departmentId, password: customPassword, canRename, canDelete, canCreate } = req.body;
  if (!name || !email || !departmentId) {
    throw new AppError('Name, email, and department are required', 400);
  }

  const dept = await Department.findById(departmentId);
  if (!dept) throw new AppError('Department not found', 404);

  const password = customPassword || generatePassword();
  const user = await User.create({
    name, email, password,
    role: 'department',
    departmentId,
    createdBy: req.user._id,
    mustChangePassword: true,
    canRename: canRename || false,
    canDelete: canDelete || false,
    canCreate: canCreate || false,
  });

  res.status(201).json({
    success: true,
    data: user.toJSON(),
  });
};

export const updateDepartmentUser = async (req, res) => {
  const { id } = req.params;
  const { name, email, isActive, departmentId, canRename, canDelete, canCreate } = req.body;

  const user = await User.findOneAndUpdate(
    { _id: id, role: 'department' },
    { $set: { name, email, isActive, departmentId, canRename, canDelete, canCreate } },
    { new: true, runValidators: true }
  );

  if (!user) throw new AppError('Department user not found', 404);
  res.json({ success: true, data: user });
};

export const deleteDepartmentUser = async (req, res) => {
  const { id } = req.params;
  const user = await User.findOneAndDelete({ _id: id, role: 'department' });
  if (!user) throw new AppError('Department user not found', 404);
  res.json({ success: true, message: 'User deleted' });
};

export const resetDeptUserPassword = async (req, res) => {
  const { id } = req.params;
  const user = await User.findOne({ _id: id, role: 'department' });
  if (!user) throw new AppError('User not found', 404);

  const newPassword = generatePassword();
  user.password = newPassword;
  user.mustChangePassword = true;
  await user.save();

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

  const user = await User.findOne({ _id: id, role: 'department' });
  if (!user) throw new AppError('User not found', 404);

  user.password = password;
  user.mustChangePassword = false;
  await user.save();

  res.json({ success: true, message: 'Password updated successfully' });
};

export const getAllDocuments = async (req, res) => {
  const { departmentId, status, customerId, search } = req.query;
  const query = { isDeleted: { $ne: true } };

  if (departmentId && typeof departmentId === 'string') query.departmentId = departmentId;
  if (status && typeof status === 'string') query.status = status;
  if (customerId && typeof customerId === 'string') query.customerId = customerId;

  if (search && typeof search === 'string') {
    // If there is search query, find matching customers
    const matchingCustomers = await User.find({
      role: 'customer',
      $or: [
        { name: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
        { email: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
      ]
    }).select('_id').lean();
    const customerIds = matchingCustomers.map(c => c._id);
    
    query.$or = [
      { customerId: { $in: customerIds } },
      { title: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
      { originalName: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
    ];
  }

  const page = parseInt(req.query.page);
  const limit = parseInt(req.query.limit);

  if (page && limit) {
    const skip = (page - 1) * limit;
    const total = await Document.countDocuments(query);
    const docs = await Document.find(query)
      .populate('customerId', 'name email')
      .populate('departmentId', 'name')
      .populate('resultFile.uploadedBy', 'name')
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
      .populate('customerId', 'name email')
      .populate('departmentId', 'name')
      .populate('resultFile.uploadedBy', 'name')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: docs });
  }
};

export const adminBlockDocument = async (req, res) => {
  const { id } = req.params;
  const doc = await Document.findById(id);
  if (!doc) throw new AppError('Document not found', 404);

  if (doc.groupId) {
    await Document.updateMany(
      { groupId: doc.groupId, resultFile: { $exists: true } },
      {
        paymentBlocked: true,
        status: 'blocked',
        blockedAt: new Date(),
        blockedBy: req.user._id,
      }
    );
    const updated = await Document.findById(id);
    return res.json({ success: true, data: updated });
  }

  if (!doc.resultFile) throw new AppError('No result file to block', 400);

  doc.paymentBlocked = true;
  doc.status = 'blocked';
  doc.blockedAt = new Date();
  doc.blockedBy = req.user._id;
  await doc.save();

  res.json({ success: true, data: doc });
};

export const adminUnblockDocument = async (req, res) => {
  const { id } = req.params;
  const doc = await Document.findById(id);
  if (!doc) throw new AppError('Document not found', 404);

  if (doc.groupId) {
    await Document.updateMany(
      { groupId: doc.groupId, resultFile: { $exists: true } },
      {
        paymentBlocked: false,
        $unset: { blockedAt: 1, blockedBy: 1 }
      }
    );
    const updated = await Document.findById(id);
    return res.json({ success: true, data: updated });
  }

  if (!doc.resultFile) throw new AppError('No result file to unblock', 400);

  doc.paymentBlocked = false;
  doc.blockedAt = undefined;
  doc.blockedBy = undefined;
  await doc.save();

  res.json({ success: true, data: doc });
};

export const adminUpdateDocument = async (req, res) => {
  const { id } = req.params;
  const { title, notes, status } = req.body;

  const doc = await Document.findById(id);
  if (!doc) throw new AppError('Document not found', 404);

  if (doc.groupId) {
    const updatePayload = {};
    if (notes !== undefined) updatePayload.notes = notes;
    if (status !== undefined && ['pending', 'processing', 'completed', 'blocked'].includes(status)) {
      updatePayload.status = status;
      if (status === 'blocked') {
        updatePayload.paymentBlocked = true;
        updatePayload.blockedAt = new Date();
        updatePayload.blockedBy = req.user._id;
      } else {
        updatePayload.paymentBlocked = false;
      }
    }

    if (Object.keys(updatePayload).length > 0) {
      if (status && status !== 'blocked') {
        await Document.updateMany(
          { groupId: doc.groupId },
          {
            $set: updatePayload,
            $unset: { blockedAt: 1, blockedBy: 1 }
          }
        );
      } else {
        await Document.updateMany(
          { groupId: doc.groupId },
          updatePayload
        );
      }
    }

    if (title !== undefined) {
      doc.title = title;
      await doc.save();
    }

    const updated = await Document.findById(id);
    return res.json({ success: true, data: updated });
  }

  if (title !== undefined) doc.title = title;
  if (notes !== undefined) doc.notes = notes;
  if (status !== undefined && ['pending', 'processing', 'completed', 'blocked'].includes(status)) {
    doc.status = status;
    if (status === 'blocked') {
      doc.paymentBlocked = true;
      doc.blockedAt = new Date();
      doc.blockedBy = req.user._id;
    } else {
      doc.paymentBlocked = false;
      doc.blockedAt = undefined;
      doc.blockedBy = undefined;
    }
  }

  await doc.save();
  res.json({ success: true, data: doc });
};

export const adminDeleteDocument = async (req, res) => {
  const { id } = req.params;
  const doc = await Document.findById(id);
  if (!doc) throw new AppError('Document not found', 404);

  await Document.findByIdAndDelete(id);
  res.json({ success: true, message: 'Document deleted' });
};

export const adminPurgeDocumentFiles = async (req, res) => {
  const { id } = req.params;
  const doc = await Document.findById(id);
  if (!doc) throw new AppError('Document not found', 404);

  let docsToPurge = [doc];
  if (doc.groupId) {
    docsToPurge = await Document.find({ groupId: doc.groupId });
  }

  let totalFilesDeleted = 0;

  for (const item of docsToPurge) {
    let itemModified = false;
    if (item.storedPath && !item.fileDeletedFromStorage) {
      try {
        await storageService.deleteFile(item.storedPath);
        item.fileDeletedFromStorage = true;
        itemModified = true;
        totalFilesDeleted++;
      } catch (err) {
        console.error(`Failed to delete file ${item.storedPath}:`, err);
      }
    }
    if (item.resultFile?.storedPath && !item.resultFileDeletedFromStorage) {
      try {
        await storageService.deleteFile(item.resultFile.storedPath);
        item.resultFileDeletedFromStorage = true;
        itemModified = true;
        totalFilesDeleted++;
      } catch (err) {
        console.error(`Failed to delete result file ${item.resultFile.storedPath}:`, err);
      }
    }

    if (itemModified) {
      item.purgedAt = new Date();
      item.purgedBy = req.user._id;
      await item.save();
    }
  }

  const updatedDoc = await Document.findById(id);
  res.json({
    success: true,
    message: `Successfully purged files across the request group (Deleted ${totalFilesDeleted} files).`,
    data: updatedDoc
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
    const updatePayload = { status };
    if (status === 'blocked') {
      updatePayload.paymentBlocked = true;
      updatePayload.blockedAt = new Date();
      updatePayload.blockedBy = req.user._id;
    } else {
      updatePayload.paymentBlocked = false;
    }

    for (const id of ids) {
      const doc = await Document.findById(id);
      if (doc) {
        if (doc.groupId) {
          if (status !== 'blocked') {
            await Document.updateMany(
              { groupId: doc.groupId },
              { $set: updatePayload, $unset: { blockedAt: 1, blockedBy: 1 } }
            );
          } else {
            await Document.updateMany({ groupId: doc.groupId }, updatePayload);
          }
        } else {
          doc.status = status;
          if (status === 'blocked') {
            doc.paymentBlocked = true;
            doc.blockedAt = new Date();
            doc.blockedBy = req.user._id;
          } else {
            doc.paymentBlocked = false;
            doc.blockedAt = undefined;
            doc.blockedBy = undefined;
          }
          await doc.save();
        }
      }
    }
  } else if (action === 'block') {
    for (const id of ids) {
      const doc = await Document.findById(id);
      if (doc) {
        if (doc.groupId) {
          await Document.updateMany(
            { groupId: doc.groupId, resultFile: { $exists: true } },
            { paymentBlocked: true, status: 'blocked', blockedAt: new Date(), blockedBy: req.user._id }
          );
        } else if (doc.resultFile) {
          doc.paymentBlocked = true;
          doc.status = 'blocked';
          doc.blockedAt = new Date();
          doc.blockedBy = req.user._id;
          await doc.save();
        }
      }
    }
  } else if (action === 'unblock') {
    for (const id of ids) {
      const doc = await Document.findById(id);
      if (doc) {
        if (doc.groupId) {
          await Document.updateMany(
            { groupId: doc.groupId, resultFile: { $exists: true } },
            { paymentBlocked: false, $unset: { blockedAt: 1, blockedBy: 1 } }
          );
        } else if (doc.resultFile) {
          doc.paymentBlocked = false;
          doc.blockedAt = undefined;
          doc.blockedBy = undefined;
          await doc.save();
        }
      }
    }
  } else if (action === 'delete') {
    for (const id of ids) {
      const doc = await Document.findById(id);
      if (doc) {
        let docsToPurge = [doc];
        if (doc.groupId) {
          docsToPurge = await Document.find({ groupId: doc.groupId });
        }
        for (const item of docsToPurge) {
          if (item.storedPath && !item.fileDeletedFromStorage) {
            try { await storageService.deleteFile(item.storedPath); } catch (_) {}
          }
          if (item.resultFile?.storedPath && !item.resultFileDeletedFromStorage) {
            try { await storageService.deleteFile(item.resultFile.storedPath); } catch (_) {}
          }
          await Document.findByIdAndDelete(item._id);
        }
      }
    }
  } else {
    throw new AppError('Invalid action', 400);
  }

  res.json({ success: true, message: 'Batch operation completed successfully' });
};

// ─── FileCategory CRUD ────────────────────────────────────────

export const getFileCategories = async (req, res) => {
  const { deptId } = req.query;
  const query = {};
  if (deptId && typeof deptId === 'string') query.departmentId = deptId;

  const page = parseInt(req.query.page);
  const limit = parseInt(req.query.limit);

  if (page && limit) {
    const skip = (page - 1) * limit;
    const total = await FileCategory.countDocuments(query);
    const fileCategories = await FileCategory.find(query)
      .populate('departmentId', 'name')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean();
    res.json({
      success: true,
      data: fileCategories,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) }
    });
  } else {
    const fileCategories = await FileCategory.find(query)
      .populate('departmentId', 'name')
      .sort({ name: 1 })
      .lean();
    res.json({ success: true, data: fileCategories });
  }
};

export const createFileCategory = async (req, res) => {
  const { name, description, departmentId } = req.body;
  if (!name || !departmentId) {
    throw new AppError('Name and department are required', 400);
  }

  const dept = await Department.findById(departmentId);
  if (!dept) throw new AppError('Department not found', 404);

  const fileCategory = await FileCategory.create({
    name, description: description || '',
    departmentId,
    createdBy: req.user._id,
  });

  res.status(201).json({ success: true, data: fileCategory });
};

export const updateFileCategory = async (req, res) => {
  const { id } = req.params;
  const { name, description, isActive, departmentId } = req.body;

  const fileCategory = await FileCategory.findByIdAndUpdate(
    id,
    { $set: { name, description, isActive, departmentId } },
    { new: true, runValidators: true }
  );

  if (!fileCategory) throw new AppError('File category not found', 404);
  res.json({ success: true, data: fileCategory });
};

export const deleteFileCategory = async (req, res) => {
  const { id } = req.params;
  const fileCategory = await FileCategory.findByIdAndDelete(id);
  if (!fileCategory) throw new AppError('File category not found', 404);
  res.json({ success: true, message: 'File category deleted' });
};
