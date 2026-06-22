import { Platform, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const screenWidth = width;
export const screenHeight = height;
export const isSmallDevice = width < 375;

export function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${mins}`;
}

export function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

export function getStatusColor(status) {
  switch (status) {
    case 'pending':
      return '#d97706';
    case 'processing':
      return '#9333ea';
    case 'completed':
      return '#16a34a';
    case 'blocked':
      return '#dc2626';
    default:
      return '#64748b';
  }
}

export function getStatusBg(status) {
  switch (status) {
    case 'pending':
      return '#fef3c7';
    case 'processing':
      return '#f3e8ff';
    case 'completed':
      return '#dcfce7';
    case 'blocked':
      return '#fee2e2';
    default:
      return '#f1f5f9';
  }
}

export function getStatusLabel(status) {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'processing':
      return 'Processing';
    case 'completed':
      return 'Completed';
    case 'blocked':
      return 'Blocked';
    default:
      return status;
  }
}

export function truncateText(text, maxLength = 50) {
  if (!text || text.length <= maxLength) return text || '';
  return text.substring(0, maxLength) + '...';
}

const SLA_HOURS = 48;
const WARNING_HOURS = 12;

export function getSlaStatus(createdAt, docStatus) {
  if (!createdAt) return 'unknown';
  if (docStatus === 'completed') return 'completed';
  if (docStatus === 'blocked') return 'blocked';
  const now = Date.now();
  const deadline = new Date(createdAt).getTime() + SLA_HOURS * 60 * 60 * 1000;
  const remaining = deadline - now;
  if (remaining <= 0) return 'overdue';
  if (remaining <= WARNING_HOURS * 60 * 60 * 1000) return 'approaching';
  return 'within_sla';
}

export function getSlaColor(slaStatus) {
  const map = {
    within_sla: '#059669',
    approaching: '#d97706',
    overdue: '#dc2626',
    completed: '#64748b',
    blocked: '#64748b',
    unknown: '#64748b',
  };
  return map[slaStatus] || '#64748b';
}

export function getSlaBg(slaStatus) {
  const map = {
    within_sla: '#d1fae5',
    approaching: '#fef3c7',
    overdue: '#fee2e2',
    completed: '#f1f5f9',
    blocked: '#f1f5f9',
    unknown: '#f1f5f9',
  };
  return map[slaStatus] || '#f1f5f9';
}

export function getSlaLabel(slaStatus) {
  const map = {
    within_sla: 'Within SLA',
    approaching: 'Approaching Deadline',
    overdue: 'Overdue',
    completed: 'Completed',
    blocked: 'Blocked',
    unknown: 'Unknown',
  };
  return map[slaStatus] || slaStatus;
}
