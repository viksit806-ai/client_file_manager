import supabase from './client.js';

const TABLE = 'notifications';

export const find = async (filters = {}, options = {}) => {
  let query = supabase.from(TABLE).select('*', { count: 'exact' });

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (typeof value === 'object' && value.$ne) {
        query = query.neq(key, value.$ne);
      } else {
        query = query.eq(key, value);
      }
    }
  });

  if (options.sort) {
    Object.entries(options.sort).forEach(([field, direction]) => {
      query = query.order(field, { ascending: direction === 'asc' });
    });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
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

export const insertMany = async (records) => {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(records)
    .select();
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
    if (value !== undefined) {
      if (typeof value === 'object' && value.$ne) {
        query = query.neq(key, value.$ne);
      } else {
        query = query.eq(key, value);
      }
    }
  });
  const { error, count } = await query;
  if (error) throw error;
  return count || 0;
};
