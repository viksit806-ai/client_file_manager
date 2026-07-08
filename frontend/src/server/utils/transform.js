// Map Supabase document rows to the nested format the frontend expects
// (backward compatibility with the old Mongoose population pattern)

export const mapDoc = (doc) => {
  if (!doc) return null;
  return {
    _id: doc.id,
    id: doc.id,
    customerId: doc.customer
      ? { _id: doc.customer_id, name: doc.customer.name, email: doc.customer.email }
      : doc.customer_id,
    fileCategoryId: doc.file_category
      ? { _id: doc.file_category_id, name: doc.file_category.name }
      : doc.file_category_id,
    departmentId: doc.department
      ? { _id: doc.department_id, name: doc.department.name }
      : doc.department_id,
    title: doc.title,
    description: doc.description,
    groupId: doc.group_id,
    requiresResult: doc.requires_result,
    fileDeletedFromStorage: doc.file_deleted_from_storage,
    resultFileDeletedFromStorage: doc.result_file_deleted_from_storage,
    purgedAt: doc.purged_at,
    purgedBy: doc.purged_by,
    direction: doc.direction,
    originalName: doc.original_name,
    storedPath: doc.stored_path,
    mimeType: doc.mime_type,
    fileSize: doc.file_size,
    status: doc.status,
    paymentBlocked: doc.payment_blocked,
    blockedAt: doc.blocked_at,
    blockedBy: doc.blocked_by,
    resultFile: doc.result_file_stored_path
      ? {
          originalName: doc.result_file_original_name,
          storedPath: doc.result_file_stored_path,
          mimeType: doc.result_file_mime_type,
          fileSize: doc.result_file_size,
          uploadedAt: doc.result_file_uploaded_at,
          uploadedBy: doc.result_file_uploaded_by
            ? { _id: doc.result_file_uploaded_by, name: doc.result_uploaded_by?.name }
            : doc.result_file_uploaded_by,
        }
      : undefined,
    notes: doc.notes,
    isDeleted: doc.is_deleted,
    customGroupName: doc.custom_group_name,
    isPlaceholder: doc.is_placeholder,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
    deadline: doc.created_at
      ? new Date(new Date(doc.created_at).getTime() + 48 * 60 * 60 * 1000)
      : null,
    slaStatus: computeSlaStatus(doc),
  };
};

export const mapDocs = (docs) => (docs || []).map(mapDoc);

const SLA_HOURS = 48;
const WARNING_HOURS = 12;

function computeSlaStatus(doc) {
  if (!doc.created_at) return 'unknown';
  if (doc.status === 'completed') return 'completed';
  if (doc.status === 'blocked') return 'blocked';
  const now = Date.now();
  const createdAt = new Date(doc.created_at).getTime();
  const deadline = createdAt + SLA_HOURS * 60 * 60 * 1000;
  const remaining = deadline - now;
  if (remaining <= 0) return 'overdue';
  if (remaining <= WARNING_HOURS * 60 * 60 * 1000) return 'approaching';
  return 'within_sla';
}

// Map Supabase profile row to camelCase for API responses
export const mapProfile = (profile) => {
  if (!profile) return null;
  const { password, ...rest } = profile;
  return {
    _id: profile.id,
    ...rest,
    departmentId: profile.department_id,
    isActive: profile.is_active,
    canRename: profile.can_rename,
    canDelete: profile.can_delete,
    canCreate: profile.can_create,
    mustChangePassword: profile.must_change_password,
    createdBy: profile.created_by,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
    department_id: undefined,
    is_active: undefined,
    can_rename: undefined,
    can_delete: undefined,
    can_create: undefined,
    must_change_password: undefined,
    created_at: undefined,
    updated_at: undefined,
  };
};

export const mapProfiles = (profiles) => (profiles || []).map(mapProfile);

export const toUserJSON = (profile) => {
  if (!profile) return null;
  const { password, ...rest } = mapProfile(profile);
  return rest;
};

export const mapDepartment = (dept) => {
  if (!dept) return null;
  const { is_active, created_by, created_at, updated_at, ...rest } = dept;
  return {
    _id: dept.id,
    ...rest,
    isActive: is_active,
    createdBy: created_by,
    createdAt: created_at,
    updatedAt: updated_at,
  };
};

export const mapDepartments = (depts) => (depts || []).map(mapDepartment);

export const mapFileCategory = (cat) => {
  if (!cat) return null;
  const { is_active, department_id, created_by, created_at, updated_at, ...rest } = cat;
  return {
    _id: cat.id,
    ...rest,
    departmentId: department_id,
    isActive: is_active,
    createdBy: created_by,
    createdAt: created_at,
    updatedAt: updated_at,
  };
};

export const mapFileCategories = (cats) => (cats || []).map(mapFileCategory);
