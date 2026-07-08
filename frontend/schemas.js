/**
 * This file serves as a reference for the Supabase database schemas 
 * present in the project after the MongoDB to Supabase migration.
 */

/**
 * @typedef {Object} Profile
 * @property {string} id - UUID (Primary Key)
 * @property {string} name
 * @property {string} email
 * @property {string} password - Hashed password
 * @property {('super_admin'|'department'|'customer')} role
 * @property {string|null} department_id - UUID referencing Department
 * @property {boolean} is_active
 * @property {boolean} can_rename
 * @property {boolean} can_delete
 * @property {boolean} can_create
 * @property {boolean} must_change_password
 * @property {string|null} created_by - UUID referencing another Profile
 * @property {string} created_at - ISO DateTime
 * @property {string} updated_at - ISO DateTime
 */

/**
 * @typedef {Object} Department
 * @property {string} id - UUID (Primary Key)
 * @property {string} name
 * @property {string} description
 * @property {boolean} is_active
 * @property {Object} permissions - JSON object (e.g. { blockDocuments: true, viewCustomers: true })
 * @property {string|null} created_by - UUID referencing Profile
 * @property {string} created_at - ISO DateTime
 * @property {string} updated_at - ISO DateTime
 */

/**
 * @typedef {Object} FileCategory
 * @property {string} id - UUID (Primary Key)
 * @property {string} name
 * @property {string} description
 * @property {string|null} department_id - UUID referencing Department
 * @property {boolean} is_active
 * @property {string|null} created_by - UUID referencing Profile
 * @property {string} created_at - ISO DateTime
 * @property {string} updated_at - ISO DateTime
 */

/**
 * @typedef {Object} Document
 * @property {string} id - UUID (Primary Key)
 * @property {string|null} customer_id - UUID referencing Profile
 * @property {string|null} file_category_id - UUID referencing FileCategory
 * @property {string|null} department_id - UUID referencing Department
 * @property {string} title
 * @property {string} description
 * @property {string|null} group_id - UUID for grouping related docs
 * @property {boolean} requires_result
 * @property {boolean} file_deleted_from_storage
 * @property {boolean} result_file_deleted_from_storage
 * @property {string|null} purged_at - ISO DateTime
 * @property {string|null} purged_by - UUID referencing Profile
 * @property {string} direction - e.g., 'submission', 'response'
 * @property {string|null} original_name
 * @property {string|null} stored_path - Path in Supabase Storage
 * @property {string|null} mime_type
 * @property {number|null} file_size
 * @property {string} status - e.g., 'pending', 'processed', 'blocked'
 * @property {boolean} payment_blocked
 * @property {string|null} blocked_at - ISO DateTime
 * @property {string|null} blocked_by - UUID referencing Profile
 * @property {string|null} result_file_original_name
 * @property {string|null} result_file_stored_path
 * @property {string|null} result_file_mime_type
 * @property {number|null} result_file_size
 * @property {string|null} result_file_uploaded_at - ISO DateTime
 * @property {string|null} result_file_uploaded_by - UUID referencing Profile
 * @property {string} notes
 * @property {boolean} is_deleted - Soft delete flag
 * @property {string} custom_group_name
 * @property {boolean} is_placeholder
 * @property {string} created_at - ISO DateTime
 * @property {string} updated_at - ISO DateTime
 */

/**
 * @typedef {Object} Notification
 * @property {string} id - UUID (Primary Key)
 * @property {string|null} user_id - UUID referencing Profile
 * @property {string} type
 * @property {string} message
 * @property {string} link
 * @property {boolean} is_read
 * @property {string} created_at - ISO DateTime
 */

export default {};
