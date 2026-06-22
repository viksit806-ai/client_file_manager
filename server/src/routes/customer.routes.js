import { Router } from 'express';
import {
  getCategories,
  getDepartments,
  uploadDocument,
  getDocuments,
  downloadDocument,
} from '../controllers/customer.controller.js';
import auth from '../middleware/auth.js';
import requireRole from '../middleware/role.js';
import upload, { validateUploadedFiles } from '../middleware/upload.js';
import { uploadRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.use(auth, requireRole('customer'));

router.get('/categories', getCategories);
router.get('/departments', getDepartments);
router.post('/upload', uploadRateLimiter, upload.array('files', 10), validateUploadedFiles, uploadDocument);
router.get('/documents', getDocuments);
router.get('/documents/:id/download', downloadDocument);

export default router;

