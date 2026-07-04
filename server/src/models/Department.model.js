import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Department name is required'],
    unique: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  permissions: {
    blockDocuments: { type: Boolean, default: true },
    viewCustomers: { type: Boolean, default: true },
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, { timestamps: true });

departmentSchema.index({ createdAt: -1 });

export default mongoose.model('Department', departmentSchema);
