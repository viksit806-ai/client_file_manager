import supabase from './client.js';

const TABLE = 'file_categories';

export const findById = async (id) => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*, department:department_id(name)')
    .eq('id', id)
    .single();
  if (error && error.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
};

export const find = async (filters = {}, options = {}) => {
  let query = supabase.from(TABLE).select(
    options.select || '*, department:department_id(name)',
    { count: 'exact' }
  );

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      query = query.eq(key, value);
    }
  });

  const sortField = options.sort ? Object.keys(options.sort)[0] : 'name';
  const sortDir = options.sort ? options.sort[sortField] : 'asc';
  query = query.order(sortField, { ascending: sortDir === 'asc' });

  if (options.page && options.limit) {
    const start = (options.page - 1) * options.limit;
    query = query.range(start, start + options.limit - 1);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, count };
};

export const create = async (record) => {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(record)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const findByIdAndUpdate = async (id, updates) => {
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

export const count = async (filters = {}) => {
  let query = supabase.from(TABLE).select('*', { count: 'exact', head: true });
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined) query = query.eq(key, value);
  });
  const { error, count } = await query;
  if (error) throw error;
  return count || 0;
};
