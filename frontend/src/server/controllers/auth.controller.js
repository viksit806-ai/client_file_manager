import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import * as ProfileRepo from '../db/profiles.js';
import AppError from '../utils/AppError.js';
import env from '../config/env.js';
import { toUserJSON } from '../utils/transform.js';

const generateTokens = (user) => {
  const payload = { id: user.id || user._id, role: user.role, departmentId: user.departmentId || user.department_id };
  const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
  const refreshToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN });
  return { accessToken, refreshToken };
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new AppError('Email and password are required', 400);
  }
  if (typeof email !== 'string' || typeof password !== 'string') {
    throw new AppError('Invalid credentials', 401);
  }

  const user = await ProfileRepo.findByEmail(email);
  if (!user || !user.is_active) {
    throw new AppError('Invalid credentials', 401);
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new AppError('Invalid credentials', 401);
  }

  const tokens = generateTokens(user);
  res.json({
    success: true,
    data: {
      user: toUserJSON(user),
      ...tokens,
      mustChangePassword: user.must_change_password,
    },
  });
};

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw new AppError('Current password and new password are required', 400);
  }
  if (newPassword.length < 8) {
    throw new AppError('New password must be at least 8 characters', 400);
  }

  const user = await ProfileRepo.findById(req.user._id);
  if (!user) throw new AppError('User not found', 404);

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    throw new AppError('Current password is incorrect', 400);
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await ProfileRepo.update(user.id, {
    password: hashedPassword,
    must_change_password: false,
  });

  const updatedUser = await ProfileRepo.findById(user.id);
  const tokens = generateTokens(updatedUser);
  res.json({
    success: true,
    data: { user: toUserJSON(updatedUser), ...tokens },
    message: 'Password changed successfully',
  });
};

export const getMe = async (req, res) => {
  const user = await ProfileRepo.findById(req.user._id);
  res.json({ success: true, data: toUserJSON(user) });
};
