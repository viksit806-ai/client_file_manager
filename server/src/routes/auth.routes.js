import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, changePassword, getMe } from '../controllers/auth.controller.js';
import auth from '../middleware/auth.js';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many password change attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

router.post('/login', loginLimiter, login);
router.put('/change-password', auth, changePasswordLimiter, changePassword);
router.get('/me', auth, getMe);

export default router;
