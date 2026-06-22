import multer from 'multer';
import path from 'path';
import { v4 as uuid } from 'uuid';
import fs from 'fs';
import env from '../config/env.js';
import AppError from '../utils/AppError.js';

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(env.UPLOAD_DIR, 'temp');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}_${uuid().slice(0, 8)}${ext}`;
    cb(null, name);
  },
});

const MAGIC_BYTES = {
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47]],
  'application/msword': [[0xD0, 0xCF, 0x11, 0xE0], [0x50, 0x4B, 0x03, 0x04]],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [[0x50, 0x4B, 0x03, 0x04]],
  'application/vnd.ms-excel': [[0xD0, 0xCF, 0x11, 0xE0], [0x50, 0x4B, 0x03, 0x04]],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [[0x50, 0x4B, 0x03, 0x04]],
  'text/plain': [],
};

const validateMagicBytes = (filePath, mimeType) => {
  const signatures = MAGIC_BYTES[mimeType];
  if (!signatures || signatures.length === 0) return true;
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(8);
  fs.readSync(fd, buffer, 0, 8, 0);
  fs.closeSync(fd);
  return signatures.some((sig) => sig.every((byte, i) => buffer[i] === byte));
};

const fileFilter = (req, file, cb) => {
  const allowed = [
    'application/pdf',
    'image/jpeg', 'image/png', 'image/jpg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ];
  if (!allowed.includes(file.mimetype)) {
    return cb(new AppError('File type not allowed. Allowed: PDF, images, docs, sheets, text', 400), false);
  }
  cb(null, true);
};

export const validateUploadedFiles = (req, res, next) => {
  if (!req.files || req.files.length === 0) return next();
  for (const file of req.files) {
    if (!validateMagicBytes(file.path, file.mimetype)) {
      return next(new AppError('File content does not match declared type', 400));
    }
  }
  next();
};

const upload = multer({
  storage,
  limits: { fileSize: env.MAX_FILE_SIZE },
  fileFilter,
});

export default upload;
