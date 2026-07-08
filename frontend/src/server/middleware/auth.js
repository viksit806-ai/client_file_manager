import jwt from 'jsonwebtoken';
import * as ProfileRepo from '../db/profiles.js';
import AppError from '../utils/AppError.js';
import env from '../config/env.js';

const auth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError('No token provided', 401);
  }

  const token = header.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const user = await ProfileRepo.findById(decoded.id);
    if (!user || !user.is_active) {
      throw new AppError('User not found or inactive', 401);
    }

    // Map PG column names back to camelCase for backward compatibility
    req.user = {
      _id: user.id,
      id: user.id,
      name: user.name,
      email: user.email,
      password: user.password,
      role: user.role,
      departmentId: user.department_id,
      isActive: user.is_active,
      canRename: user.can_rename,
      canDelete: user.can_delete,
      canCreate: user.can_create,
      mustChangePassword: user.must_change_password,
      createdBy: user.created_by,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      throw new AppError('Invalid or expired token', 401);
    }
    throw error;
  }
};

export default auth;
