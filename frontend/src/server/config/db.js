import supabase from '../db/client.js';

const connectDB = async () => {
  try {
    // Verify connection by querying a known table
    const { error } = await supabase.from('departments').select('id', { count: 'exact', head: true });
    if (error) {
      throw new Error(`Supabase connection failed: ${error.message}`);
    }
    console.log('Supabase connected');
  } catch (error) {
    console.error(`Database connection error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
