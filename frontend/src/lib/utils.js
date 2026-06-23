export const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const formatDateTime = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getStatusColor = (status) => {
  const map = {
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    blocked: 'bg-red-100 text-red-800',
  };
  return map[status] || 'bg-gray-100 text-gray-800';
};

export const getFileIcon = (mimeType) => {
  if (mimeType?.includes('pdf')) return 'FileText';
  if (mimeType?.includes('image')) return 'Image';
  if (mimeType?.includes('word') || mimeType?.includes('document')) return 'FileText';
  if (mimeType?.includes('excel') || mimeType?.includes('sheet')) return 'FileSpreadsheet';
  if (mimeType?.includes('text')) return 'FileText';
  return 'Folder';
};

export const formatFileSize = (bytes) => {
  if (!bytes) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text);
};

const SLA_HOURS = 48;
const WARNING_HOURS = 12;

export const getSlaStatus = (createdAt, docStatus) => {
  if (!createdAt) return 'unknown';
  if (docStatus === 'completed') return 'completed';
  if (docStatus === 'blocked') return 'blocked';
  const now = Date.now();
  const deadline = new Date(createdAt).getTime() + SLA_HOURS * 60 * 60 * 1000;
  const remaining = deadline - now;
  if (remaining <= 0) return 'overdue';
  if (remaining <= WARNING_HOURS * 60 * 60 * 1000) return 'approaching';
  return 'within_sla';
};

export const getSlaColor = (slaStatus) => {
  const map = {
    within_sla: 'bg-green-100 text-green-800',
    approaching: 'bg-yellow-100 text-yellow-800',
    overdue: 'bg-red-100 text-red-800',
    completed: 'bg-gray-100 text-gray-800',
    blocked: 'bg-gray-100 text-gray-800',
    unknown: 'bg-gray-100 text-gray-800',
  };
  return map[slaStatus] || 'bg-gray-100 text-gray-800';
};

export const getSlaLabel = (slaStatus) => {
  const map = {
    within_sla: 'Within SLA',
    approaching: 'Approaching Deadline',
    overdue: 'Overdue',
    completed: 'Completed',
    blocked: 'Blocked',
    unknown: 'Unknown',
  };
  return map[slaStatus] || slaStatus;
};
