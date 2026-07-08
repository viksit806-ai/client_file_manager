import path from 'path';
import fs from 'fs';
import * as ProfileRepo from '../db/profiles.js';
import supabase from './supabase.service.js';

class StorageService {
  async getCustomerFolderName(customerId) {
    const customer = await ProfileRepo.findByIdLean(customerId);
    if (!customer) return customerId.toString();
    const safeName = customer.name.replace(/[^a-zA-Z0-9]/g, '_');
    const safeEmail = customer.email.replace(/[^a-zA-Z0-9@.]/g, '_');
    return `${safeName}_${safeEmail}`;
  }

  sanitizeFilename(name) {
    const base = path.basename(name);
    return base.replace(/[/\\:*?"<>|]/g, '_');
  }

  async saveSubmission(file, customerId, departmentId) {
    const folder = await this.getCustomerFolderName(customerId);
    const safeName = this.sanitizeFilename(file.originalname);
    const fileName = `${Date.now()}_${safeName}`;
    const key = `customers/${folder}/${departmentId}/submissions/${fileName}`;

    const buffer = file.buffer || fs.readFileSync(file.path);
    await supabase.upload(key, buffer, file.mimetype);

    if (file.path && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch (_) {}
    }

    return { storedPath: key, originalName: file.originalname, mimeType: file.mimetype, fileSize: file.size };
  }

  async saveResult(file, customerId, departmentId) {
    const folder = await this.getCustomerFolderName(customerId);
    const safeName = this.sanitizeFilename(file.originalname);
    const fileName = `${Date.now()}_${safeName}`;
    const key = `customers/${folder}/${departmentId}/results/${fileName}`;

    const buffer = file.buffer || fs.readFileSync(file.path);
    await supabase.upload(key, buffer, file.mimetype);

    if (file.path && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch (_) {}
    }

    return { storedPath: key, originalName: file.originalname, mimeType: file.mimetype, fileSize: file.size };
  }

  async saveResponse(file, customerId, fileCategoryId) {
    const folder = await this.getCustomerFolderName(customerId);
    const safeName = this.sanitizeFilename(file.originalname);
    const fileName = `${Date.now()}_${safeName}`;
    const key = `responses/${folder}/${fileCategoryId}/${fileName}`;

    const buffer = file.buffer || fs.readFileSync(file.path);
    await supabase.upload(key, buffer, file.mimetype);

    if (file.path && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch (_) {}
    }

    return { storedPath: key, originalName: file.originalname, mimeType: file.mimetype, fileSize: file.size };
  }

  async getDownloadUrl(storedPath, fileName) {
    if (!storedPath) return null;
    return supabase.getSignedUrl(storedPath, fileName);
  }

  async deleteFile(storedPath) {
    if (!storedPath) return;
    try {
      await supabase.delete(storedPath);
    } catch (err) {
      console.error('Failed to delete file from Supabase:', err);
    }
  }
}

const storageService = new StorageService();

export default storageService;
