import AppError from '../utils/AppError.js';
import env from '../config/env.js';

const MAGIC_BYTES = {
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/jpg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47]],
  'application/msword': [[0xd0, 0xcf, 0x11, 0xe0], [0x50, 0x4b, 0x03, 0x04]],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [[0x50, 0x4b, 0x03, 0x04]],
  'application/vnd.ms-excel': [[0xd0, 0xcf, 0x11, 0xe0], [0x50, 0x4b, 0x03, 0x04]],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [[0x50, 0x4b, 0x03, 0x04]],
  'text/plain': [],
};

const allowedTypes = new Set(Object.keys(MAGIC_BYTES));

const validateMagicBytes = (buffer, mimeType) => {
  const signatures = MAGIC_BYTES[mimeType];
  if (!signatures || signatures.length === 0) return true;
  return signatures.some((sig) => sig.every((byte, index) => buffer[index] === byte));
};

const normalizeFile = async (file) => {
  if (!allowedTypes.has(file.type)) {
    throw new AppError('File type not allowed. Allowed: PDF, images, docs, sheets, text', 400);
  }

  if (file.size > env.MAX_FILE_SIZE) {
    throw new AppError('File too large', 413);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!validateMagicBytes(buffer, file.type)) {
    throw new AppError('File content does not match declared type', 400);
  }

  return {
    originalname: file.name,
    mimetype: file.type,
    size: file.size,
    buffer,
  };
};

export const parseMultipartBody = async (request, mode) => {
  const form = await request.formData();
  const body = {};
  const files = [];

  for (const [key, value] of form.entries()) {
    const isFile = typeof value === 'object' && value !== null && typeof value.name === 'string';
    if (isFile) {
      if (value.size > 0) files.push(await normalizeFile(value));
    } else if (body[key] === undefined) {
      body[key] = value;
    } else if (Array.isArray(body[key])) {
      body[key].push(value);
    } else {
      body[key] = [body[key], value];
    }
  }

  if (mode === 'single') {
    return { body, file: files[0], files: files[0] ? [files[0]] : [] };
  }

  return { body, files };
};
