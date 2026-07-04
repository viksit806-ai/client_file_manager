import mongoose from 'mongoose';

const resultFileSchema = new mongoose.Schema({
  originalName: String,
  storedPath: String,
  mimeType: String,
  fileSize: Number,
  uploadedAt: { type: Date, default: Date.now },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { _id: false });

const documentSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  fileCategoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FileCategory',
    required: false,
  },
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true,
  },
  title: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true,
  },
  requiresResult: {
    type: Boolean,
    default: true,
  },
  fileDeletedFromStorage: {
    type: Boolean,
    default: false,
  },
  resultFileDeletedFromStorage: {
    type: Boolean,
    default: false,
  },
  purgedAt: Date,
  purgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  direction: {
    type: String,
    enum: ['submission', 'result', 'response'],
    default: 'submission',
  },
  originalName: String,
  storedPath: String,
  mimeType: String,
  fileSize: Number,
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'blocked'],
    default: 'pending',
  },
  paymentBlocked: {
    type: Boolean,
    default: false,
  },
  blockedAt: Date,
  blockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  resultFile: resultFileSchema,
  notes: {
    type: String,
    default: '',
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true,
  },
  customGroupName: {
    type: String,
    default: '',
  },
  isPlaceholder: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

const SLA_HOURS = 48;
const WARNING_HOURS = 12;

documentSchema.virtual('deadline').get(function () {
  if (!this.createdAt) return null;
  return new Date(this.createdAt.getTime() + SLA_HOURS * 60 * 60 * 1000);
});

documentSchema.virtual('slaStatus').get(function () {
  if (!this.createdAt) return 'unknown';
  if (this.status === 'completed') return 'completed';
  if (this.status === 'blocked') return 'blocked';
  const now = Date.now();
  const deadline = this.createdAt.getTime() + SLA_HOURS * 60 * 60 * 1000;
  const remaining = deadline - now;
  if (remaining <= 0) return 'overdue';
  if (remaining <= WARNING_HOURS * 60 * 60 * 1000) return 'approaching';
  return 'within_sla';
});

documentSchema.index({ customerId: 1, departmentId: 1 });
documentSchema.index({ departmentId: 1, status: 1 });
documentSchema.index({ customerId: 1, status: 1 });
documentSchema.index({ departmentId: 1, createdAt: -1 });
documentSchema.index({ direction: 1, departmentId: 1, createdAt: -1 });
documentSchema.index({ groupId: 1 });

export default mongoose.model('Document', documentSchema);
