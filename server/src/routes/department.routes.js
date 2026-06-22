import { Router } from 'express';
import {
  getDashboard,
  getCustomers,
  getCustomerDocuments,
  getDocuments,
  getDocumentDetail,
  updateDocumentStatus,
  getCategories,
  uploadResult,
  blockDocument,
  unblockDocument,
  updateNotes,
  downloadFile,
  departmentPurgeDocumentFiles,
  renameCustomer,
} from '../controllers/department.controller.js';
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

router.use(auth, requireRole('department'));

router.get('/dashboard', getDashboard);
router.get('/customers', getCustomers);
router.get('/customers/:customerId/documents', getCustomerDocuments);
router.patch('/customers/:customerId/rename', renameCustomer);
router.get('/documents', getDocuments);
router.get('/categories', getCategories);
router.get('/documents/:id', getDocumentDetail);
router.patch('/documents/:id/status', updateDocumentStatus);
router.post('/documents/:id/upload-result', upload.single('file'), validateUploadedFiles, uploadResult);
router.patch('/documents/:id/block', blockDocument);
router.patch('/documents/:id/unblock', unblockDocument);
router.put('/documents/:id/notes', updateNotes);
router.get('/documents/:id/download', downloadFile);
router.post('/documents/:id/purge', departmentPurgeDocumentFiles);
router.patch('/documents/:id/rename', renameDocument);
router.patch('/documents/group/:groupId/rename', renameGroup);
router.delete('/documents/:id', deleteDocument);
router.delete('/documents/group/:groupId', deleteGroup);
router.post('/documents/folder', createEmptyFolder);
router.post('/documents/group/:groupId/upload', upload.array('files', 10), validateUploadedFiles, uploadFilesToFolder);

export default router;

