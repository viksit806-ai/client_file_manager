import { Router } from 'express';
import {
  getDashboard,
  getCustomers, createCustomer, updateCustomer, deleteCustomer, resetCustomerPassword, setCustomerPassword, getCustomerDocuments,
  getDepartments, createDepartment, updateDepartment, deleteDepartment, updateDepartmentPermissions,
  getDepartmentUsers, getDepartmentUsersByDept, createDepartmentUser, updateDepartmentUser, deleteDepartmentUser, resetDeptUserPassword, setDeptUserPassword,
  getCategories, getCategoriesByDepartment, createCategory, updateCategory, deleteCategory,
  getAllDocuments, adminBlockDocument, adminUnblockDocument, adminUpdateDocument, adminDeleteDocument,
  adminPurgeDocumentFiles,
} from '../controllers/admin.controller.js';
import {
  renameDocument,
  renameGroup,
  deleteDocument,
  deleteGroup,
  createEmptyFolder,
  uploadFilesToFolder,
} from '../controllers/documentOps.controller.js';
import auth from '../middleware/auth.js';
import requireRole from '../middleware/role.js';
import upload, { validateUploadedFiles } from '../middleware/upload.js';

const router = Router();

router.use(auth, requireRole('super_admin'));

router.get('/dashboard', getDashboard);

router.get('/customers', getCustomers);
router.post('/customers', createCustomer);
router.put('/customers/:id', updateCustomer);
router.delete('/customers/:id', deleteCustomer);
router.put('/customers/:id/reset-password', resetCustomerPassword);
router.put('/customers/:id/set-password', setCustomerPassword);
router.get('/customers/:id/documents', getCustomerDocuments);

router.get('/departments', getDepartments);
router.post('/departments', createDepartment);
router.put('/departments/:id', updateDepartment);
router.delete('/departments/:id', deleteDepartment);
router.put('/departments/:id/permissions', updateDepartmentPermissions);

router.get('/department-users', getDepartmentUsers);
router.get('/department-users/department/:deptId', getDepartmentUsersByDept);
router.post('/department-users', createDepartmentUser);
router.put('/department-users/:id', updateDepartmentUser);
router.delete('/department-users/:id', deleteDepartmentUser);
router.put('/department-users/:id/reset-password', resetDeptUserPassword);
router.put('/department-users/:id/set-password', setDeptUserPassword);

router.get('/categories', getCategories);
router.get('/categories/department/:deptId', getCategoriesByDepartment);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

router.get('/documents', getAllDocuments);
router.patch('/documents/:id/block', adminBlockDocument);
router.patch('/documents/:id/unblock', adminUnblockDocument);
router.put('/documents/:id', adminUpdateDocument);
router.delete('/documents/:id', adminDeleteDocument);
router.post('/documents/:id/purge', adminPurgeDocumentFiles);
router.patch('/documents/:id/rename', renameDocument);
router.patch('/documents/group/:groupId/rename', renameGroup);
router.delete('/documents/:id/soft', deleteDocument);
router.delete('/documents/group/:groupId/soft', deleteGroup);
router.post('/documents/folder', createEmptyFolder);
router.post('/documents/group/:groupId/upload', upload.array('files', 10), validateUploadedFiles, uploadFilesToFolder);

export default router;

