import User from '../models/User.model.js';
import Department from '../models/Department.model.js';
import Category from '../models/Category.model.js';
import Document from '../models/Document.model.js';
import AppError from '../utils/AppError.js';
import crypto from 'crypto';
import fs from 'fs';

const generatePassword = () => crypto.randomBytes(4).toString('hex');

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
    .populate('categoryId', 'name')
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
    query.name = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }
  if (status === 'active') query.isActive = true;
  if (status === 'inactive') query.isActive = false;

  const customers = await User.find(query).sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: customers });
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
  const docs = await Document.find({ customerId: id, isDeleted: { $ne: true } })
    .populate('categoryId', 'name')
    .populate('departmentId', 'name')
    .sort({ createdAt: -1 })
    .lean();

  res.json({ success: true, data: docs });
};

export const getDepartments = async (req, res) => {
  const departments = await Department.find().sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: departments });
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
  await Category.updateMany({ departmentId: id }, { isActive: false });
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

  const users = await User.find(query)
    .populate('departmentId', 'name')
    .sort({ createdAt: -1 })
    .lean();

  res.json({ success: true, data: users });
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

  res.json({ success: true, message: 'Password reset successfully' });
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

export const getCategories = async (req, res) => {
  const { deptId } = req.query;
  const query = {};
  if (deptId && typeof deptId === 'string') query.departmentId = deptId;

  const categories = await Category.find(query)
    .populate('departmentId', 'name')
    .sort({ name: 1 })
    .lean();

  res.json({ success: true, data: categories });
};

export const getCategoriesByDepartment = async (req, res) => {
  const { deptId } = req.params;
  const categories = await Category.find({ departmentId: deptId })
    .sort({ name: 1 })
    .lean();

  res.json({ success: true, data: categories });
};

export const createCategory = async (req, res) => {
  const { name, description, departmentId } = req.body;
  if (!name || !departmentId) {
    throw new AppError('Name and department are required', 400);
  }

  const dept = await Department.findById(departmentId);
  if (!dept) throw new AppError('Department not found', 404);

  const category = await Category.create({
    name, description: description || '',
    departmentId,
    createdBy: req.user._id,
  });

  res.status(201).json({ success: true, data: category });
};

export const updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name, description, isActive, departmentId } = req.body;

  const category = await Category.findByIdAndUpdate(
    id,
    { $set: { name, description, isActive, departmentId } },
    { new: true, runValidators: true }
  );

  if (!category) throw new AppError('Category not found', 404);
  res.json({ success: true, data: category });
};

export const deleteCategory = async (req, res) => {
  const { id } = req.params;
  const category = await Category.findByIdAndDelete(id);
  if (!category) throw new AppError('Category not found', 404);
  res.json({ success: true, message: 'Category deleted' });
};

export const getAllDocuments = async (req, res) => {
  const { departmentId, categoryId, status, customerId, search } = req.query;
  const query = { isDeleted: { $ne: true } };

  if (departmentId && typeof departmentId === 'string') query.departmentId = departmentId;
  if (categoryId && typeof categoryId === 'string') query.categoryId = categoryId;
  if (status && typeof status === 'string') query.status = status;
  if (customerId && typeof customerId === 'string') query.customerId = customerId;

  const docs = await Document.find(query)
    .populate('customerId', 'name email')
    .populate('categoryId', 'name')
    .populate('departmentId', 'name')
    .populate('resultFile.uploadedBy', 'name')
    .sort({ createdAt: -1 })
    .lean();

  if (search) {
    const filtered = docs.filter(d =>
      d.customerId?.name?.toLowerCase().includes(search.toLowerCase()) ||
      d.title?.toLowerCase().includes(search.toLowerCase())
    );
    return res.json({ success: true, data: filtered });
  }

  res.json({ success: true, data: docs });
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
        if (fs.existsSync(item.storedPath)) {
          fs.unlinkSync(item.storedPath);
        }
        item.fileDeletedFromStorage = true;
        itemModified = true;
        totalFilesDeleted++;
      } catch (err) {
        console.error(`Failed to delete file ${item.storedPath}:`, err);
      }
    }
    if (item.resultFile?.storedPath && !item.resultFileDeletedFromStorage) {
      try {
        if (fs.existsSync(item.resultFile.storedPath)) {
          fs.unlinkSync(item.resultFile.storedPath);
        }
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
