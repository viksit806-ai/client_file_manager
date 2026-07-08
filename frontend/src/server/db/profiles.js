import supabase from './client.js';

const TABLE = 'profiles';

// ─── Queries ──────────────────────────────────────────────

export const findById = async (id) => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*, department:department_id(name), created_by_profile:created_by(name, email)')
    .eq('id', id)
    .single();
  if (error && error.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
};

export const findByIdLean = async (id) => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single();
  if (error && error.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
};

export const findByEmail = async (email) => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('email', email.toLowerCase())
    .single();
  if (error && error.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
};

export const find = async (filters = {}, options = {}) => {
  let query = supabase.from(TABLE).select(options.select || '*', { count: 'exact' });

  // Apply filters
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        query = query.in(key, value);
      } else if (typeof value === 'object' && value.$ne) {
        query = query.neq(key, value.$ne);
      } else if (typeof value === 'object' && value.$in) {
        query = query.in(key, value.$in);
      } else if (typeof value === 'object' && value.$regex) {
        query = query.ilike(key, `%${value.$regex}%`);
      } else {
        query = query.eq(key, value);
      }
    }
  });

  // Search across multiple fields
  if (options.search) {
    const { fields, term } = options.search;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const conditions = fields.map(f => `${f}.ilike.%${escaped}%`).join(',');
    query = query.or(conditions);
  }

  // Sorting
  if (options.sort) {
    Object.entries(options.sort).forEach(([field, direction]) => {
      query = query.order(field, { ascending: direction === 'asc' });
    });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  // Pagination
  if (options.page && options.limit) {
    const start = (options.page - 1) * options.limit;
    const end = start + options.limit - 1;
    query = query.range(start, end);
  }

  if (options.limit && !options.page) {
    query = query.limit(options.limit);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, count };
};

// ─── Mutations ────────────────────────────────────────────

export const create = async (record) => {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(record)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const update = async (id, updates) => {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error && error.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
};

export const findOneAndUpdate = async (filters, updates) => {
  let query = supabase
    .from(TABLE)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .select()
    .single();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined) query = query.eq(key, value);
  });

  const { data, error } = await query;
  if (error && error.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
};

export const remove = async (id) => {
  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)
    .select()
    .single();
  if (error && error.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
};

export const findOneAndDelete = async (filters) => {
  let query = supabase.from(TABLE).delete().select().single();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined) query = query.eq(key, value);
  });
  const { data, error } = await query;
  if (error && error.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
};

export const count = async (filters = {}) => {
  let query = supabase.from(TABLE).select('*', { count: 'exact', head: true });
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (typeof value === 'object' && value.$ne) {
        query = query.neq(key, value.$ne);
      } else if (typeof value === 'object' && value.$in) {
        query = query.in(key, value.$in);
      } else {
        query = query.eq(key, value);
      }
    }
  });
  const { error, count } = await query;
  if (error) throw error;
  return count || 0;
};

export const updateMany = async (filters, updates) => {
  let query = supabase
    .from(TABLE)
    .update({ ...updates, updated_at: new Date().toISOString() });

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined) {
      if (typeof value === 'object' && value.$ne) {
        query = query.neq(key, value.$ne);
      } else {
        query = query.eq(key, value);
      }
    }
  });

  const { error } = await query;
  if (error) throw error;
};

export const deleteMany = async (filters = {}) => {
  let query = supabase.from(TABLE).delete();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined) query = query.eq(key, value);
  });
  const { error } = await query;
  if (error) throw error;
};
