import jwt from 'jsonwebtoken';
import User from '../models/User.model.js';
import AppError from '../utils/AppError.js';
import env from '../config/env.js';

const generateTokens = (user) => {
  const payload = { id: user._id, role: user.role, departmentId: user.departmentId };
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

  const user = await User.findOne({ email });
  if (!user || !user.isActive) {
    throw new AppError('Invalid credentials', 401);
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new AppError('Invalid credentials', 401);
  }

  const tokens = generateTokens(user);
  res.json({
    success: true,
    data: {
      user: user.toJSON(),
      ...tokens,
      mustChangePassword: user.mustChangePassword,
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

  const user = await User.findById(req.user._id);
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw new AppError('Current password is incorrect', 400);
  }

  user.password = newPassword;
  user.mustChangePassword = false;
  await user.save();

  const tokens = generateTokens(user);
  res.json({
    success: true,
    data: { user: user.toJSON(), ...tokens },
    message: 'Password changed successfully',
  });
};

export const getMe = async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('departmentId', 'name')
    .populate('createdBy', 'name email');
  res.json({ success: true, data: user });
};
