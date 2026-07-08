import { createClient } from '@supabase/supabase-js';
import env from '../config/env.js';

class SupabaseService {
  constructor() {
    this.client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    this.bucket = env.SUPABASE_BUCKET;
  }

  async upload(key, buffer, contentType) {
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(key, buffer, { contentType, upsert: true });
    if (error) throw error;
  }

  async delete(key) {
    const { error } = await this.client.storage
      .from(this.bucket)
      .remove([key]);
    if (error) throw error;
  }

  async getSignedUrl(key, fileName) {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(key, 3600, { download: fileName });
    if (error) throw error;
    return data.signedUrl;
  }
}

const supabaseService = new SupabaseService();

export default supabaseService;
