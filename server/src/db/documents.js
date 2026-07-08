import supabase from './client.js';

const TABLE = 'documents';
const DEFAULT_SELECT = '*, customer:customer_id(name, email), department:department_id(name), file_category:file_category_id(name), result_uploaded_by:result_file_uploaded_by(name)';

// ─── Query helpers ────────────────────────────────────────

function buildFilterQuery(initialQuery, filters) {
  let query = initialQuery;
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (typeof value === 'object' && value.$ne) {
      query = query.neq(key, value.$ne);
    } else if (typeof value === 'object' && value.$in) {
      query = query.in(key, value.$in);
    } else if (typeof value === 'object' && value.$regex) {
      const escaped = value.$regex.source || value.$regex;
      query = query.ilike(key, `%${escaped}%`);
    } else if (typeof value === 'object' && value.$exists) {
      if (value.$exists) {
        query = query.not(key, 'is', null);
      } else {
        query = query.is(key, null);
      }
    } else if (typeof value === 'object' && value.$lt) {
      query = query.lt(key, value.$lt);
    } else if (typeof value === 'object' && value.$gte) {
      query = query.gte(key, value.$gte);
    } else if (typeof value === 'object' && value.$gt) {
      query = query.gt(key, value.$gt);
    } else {
      query = query.eq(key, value);
    }
  });
  return query;
}

// ─── Queries ──────────────────────────────────────────────

export const findById = async (id) => {
  const { data, error } = await supabase
    .from(TABLE)
    .select(DEFAULT_SELECT)
    .eq('id', id)
    .single();
  if (error && error.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
};

export const findOne = async (filters = {}) => {
  let query = supabase.from(TABLE).select(DEFAULT_SELECT).single();
  query = buildFilterQuery(query, filters);
  const { data, error } = await query;
  if (error && error.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
};

export const find = async (filters = {}, options = {}) => {
  const selectFields = options.select || DEFAULT_SELECT;
  let query = supabase.from(TABLE).select(selectFields, { count: 'exact' });

  query = buildFilterQuery(query, filters);

  // Search across multiple fields
  if (options.search) {
    const { fields, term } = options.search;
    const escaped = term.replace(/'/g, "''");
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
    query = query.range(start, start + options.limit - 1);
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

export const createMany = async (records) => {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(records)
    .select();
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

// findOneAndUpdate via specific filters
export const findOneAndUpdate = async (filters, updates) => {
  let query = supabase
    .from(TABLE)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .select()
    .single();
  query = buildFilterQuery(query, filters);
  const { data, error } = await query;
  if (error && error.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
};

// updateMany with filters
export const updateMany = async (filters, updates) => {
  let query = supabase
    .from(TABLE)
    .update({ ...updates, updated_at: new Date().toISOString() });
  query = buildFilterQuery(query, filters);
  const { error } = await query;
  if (error) throw error;
};

// findOneAndDelete
export const findOneAndDelete = async (filters) => {
  let query = supabase.from(TABLE).delete().select().single();
  query = buildFilterQuery(query, filters);
  const { data, error } = await query;
  if (error && error.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
};

// findByIdAndDelete
export const findByIdAndDelete = async (id) => {
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

// Hard delete by filters
export const deleteMany = async (filters = {}) => {
  let query = supabase.from(TABLE).delete();
  query = buildFilterQuery(query, filters);
  const { error } = await query;
  if (error) throw error;
};

// ─── Aggregation / Count ──────────────────────────────────

export const count = async (filters = {}) => {
  let query = supabase.from(TABLE).select('*', { count: 'exact', head: true });
  query = buildFilterQuery(query, filters);
  const { error, count } = await query;
  if (error) throw error;
  return count || 0;
};

export const getCustomerStorage = async (customerId) => {
  const { data, error } = await supabase.rpc('get_customer_storage', {
    p_customer_id: customerId,
  });
  if (error) throw error;
  return data || 0;
};

// ─── RPC calls for dashboard ──────────────────────────────

export const getAdminDashboardStats = async () => {
  const { data, error } = await supabase.rpc('get_admin_dashboard_stats');
  if (error) throw error;
  return data;
};

export const getDeptDashboardStats = async (deptId) => {
  const { data, error } = await supabase.rpc('get_dept_dashboard_stats', {
    p_dept_id: deptId,
  });
  if (error) throw error;
  return data;
};
