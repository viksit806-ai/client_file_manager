-- =============================================================
-- Migration 001: Create Supabase tables for WhatsApp Automation
-- Run this in the Supabase SQL Editor
-- Order: departments → file_categories → profiles → documents → notifications
-- =============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================
-- 1. DEPARTMENTS
-- =============================================================
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  permissions JSONB DEFAULT '{"blockDocuments": true, "viewCustomers": true}',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_departments_created ON departments(created_at DESC);

-- =============================================================
-- 2. FILE CATEGORIES
-- =============================================================
CREATE TABLE IF NOT EXISTS file_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, department_id)
);

CREATE INDEX IF NOT EXISTS idx_file_categories_dept ON file_categories(department_id);

-- =============================================================
-- 3. PROFILES (replaces MongoDB 'users' collection)
-- =============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'department', 'customer')),
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  can_rename BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  must_change_password BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_role_created ON profiles(role, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_dept ON profiles(role, department_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- =============================================================
-- 4. DOCUMENTS (resultFile flattened)
-- =============================================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_category_id UUID REFERENCES file_categories(id) ON DELETE SET NULL,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  title TEXT DEFAULT '',
  description TEXT DEFAULT '',
  group_id UUID,
  requires_result BOOLEAN DEFAULT true,
  file_deleted_from_storage BOOLEAN DEFAULT false,
  result_file_deleted_from_storage BOOLEAN DEFAULT false,
  purged_at TIMESTAMPTZ,
  purged_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  direction TEXT DEFAULT 'submission' CHECK (direction IN ('submission', 'result', 'response')),
  original_name TEXT,
  stored_path TEXT,
  mime_type TEXT,
  file_size BIGINT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'blocked')),
  payment_blocked BOOLEAN DEFAULT false,
  blocked_at TIMESTAMPTZ,
  blocked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- Flattened resultFile sub-document
  result_file_original_name TEXT,
  result_file_stored_path TEXT,
  result_file_mime_type TEXT,
  result_file_size BIGINT,
  result_file_uploaded_at TIMESTAMPTZ,
  result_file_uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT DEFAULT '',
  is_deleted BOOLEAN DEFAULT false,
  custom_group_name TEXT DEFAULT '',
  is_placeholder BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_customer_dept ON documents(customer_id, department_id);
CREATE INDEX IF NOT EXISTS idx_documents_dept_status ON documents(department_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_customer_status ON documents(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_dept_created ON documents(department_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_direction_dept_created ON documents(direction, department_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_group ON documents(group_id);
CREATE INDEX IF NOT EXISTS idx_documents_not_deleted ON documents(is_deleted) WHERE is_deleted = false;

-- =============================================================
-- 5. NOTIFICATIONS
-- =============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('new_request', 'new_response')),
  message TEXT NOT NULL,
  link TEXT DEFAULT '',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);

-- =============================================================
-- RPC FUNCTIONS for aggregation queries previously done via
-- MongoDB aggregate() pipeline.
-- =============================================================

-- Get admin dashboard stats
CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  sla_ms BIGINT := 48 * 60 * 60 * 1000;
  warning_ms BIGINT := 12 * 60 * 60 * 1000;
  now_ts TIMESTAMPTZ := NOW();
BEGIN
  SELECT JSONB_BUILD_OBJECT(
    'totalCustomers', (SELECT COUNT(*) FROM profiles WHERE role = 'customer'),
    'totalDepartments', (SELECT COUNT(*) FROM departments),
    'totalDeptUsers', (SELECT COUNT(*) FROM profiles WHERE role = 'department'),
    'totalDocuments', (SELECT COUNT(*) FROM documents),
    'deptStats', COALESCE(
      (SELECT JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'deptName', d.name,
          'count', (SELECT COUNT(*) FROM documents doc WHERE doc.department_id = d.id)
        )
      ) FROM departments d),
      '[]'::JSONB
    ),
    'slaOverview', COALESCE(
      (SELECT JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'deptName', d.name,
          'overdue', (SELECT COUNT(*) FROM documents doc WHERE doc.department_id = d.id AND doc.status IN ('pending', 'processing') AND doc.created_at < now_ts - (sla_ms * INTERVAL '1 microsecond')),
          'approaching', (SELECT COUNT(*) FROM documents doc WHERE doc.department_id = d.id AND doc.status IN ('pending', 'processing') AND doc.created_at >= now_ts - (sla_ms * INTERVAL '1 microsecond') AND doc.created_at < now_ts - ((sla_ms - warning_ms) * INTERVAL '1 microsecond')),
          'withinSla', (SELECT COUNT(*) FROM documents doc WHERE doc.department_id = d.id AND doc.status IN ('pending', 'processing') AND doc.created_at >= now_ts - ((sla_ms - warning_ms) * INTERVAL '1 microsecond'))
        )
      ) FROM departments d),
      '[]'::JSONB
    )
  ) INTO result;
  RETURN result;
END;
$$;

-- Get department dashboard stats
CREATE OR REPLACE FUNCTION get_dept_dashboard_stats(p_dept_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  sla_ms BIGINT := 48 * 60 * 60 * 1000;
  warning_ms BIGINT := 12 * 60 * 60 * 1000;
  now_ts TIMESTAMPTZ := NOW();
BEGIN
  SELECT JSONB_BUILD_OBJECT(
    'totalDocs', (SELECT COUNT(*) FROM documents WHERE department_id = p_dept_id AND direction = 'submission'),
    'pending', (SELECT COUNT(*) FROM documents WHERE department_id = p_dept_id AND direction = 'submission' AND status = 'pending'),
    'processing', (SELECT COUNT(*) FROM documents WHERE department_id = p_dept_id AND direction = 'submission' AND status = 'processing'),
    'completed', (SELECT COUNT(*) FROM documents WHERE department_id = p_dept_id AND direction = 'submission' AND status = 'completed'),
    'blocked', (SELECT COUNT(*) FROM documents WHERE department_id = p_dept_id AND direction = 'submission' AND status = 'blocked'),
    'slaOverdue', (SELECT COUNT(*) FROM documents WHERE department_id = p_dept_id AND direction = 'submission' AND status IN ('pending', 'processing') AND created_at < now_ts - (sla_ms * INTERVAL '1 microsecond')),
    'slaApproaching', (SELECT COUNT(*) FROM documents WHERE department_id = p_dept_id AND direction = 'submission' AND status IN ('pending', 'processing') AND created_at >= now_ts - (sla_ms * INTERVAL '1 microsecond') AND created_at < now_ts - ((sla_ms - warning_ms) * INTERVAL '1 microsecond')),
    'slaWithin', (SELECT COUNT(*) FROM documents WHERE department_id = p_dept_id AND direction = 'submission' AND status IN ('pending', 'processing') AND created_at >= now_ts - ((sla_ms - warning_ms) * INTERVAL '1 microsecond')),
    'slaMet', (SELECT COUNT(*) FROM documents WHERE department_id = p_dept_id AND direction = 'submission' AND status IN ('completed', 'blocked') AND result_file_uploaded_at IS NOT NULL AND result_file_uploaded_at - created_at <= (sla_ms * INTERVAL '1 microsecond')),
    'slaMissed', (SELECT COUNT(*) FROM documents WHERE department_id = p_dept_id AND direction = 'submission' AND status IN ('completed', 'blocked') AND result_file_uploaded_at IS NOT NULL AND result_file_uploaded_at - created_at > (sla_ms * INTERVAL '1 microsecond'))
  ) INTO result;
  RETURN result;
END;
$$;

-- Get total storage used by a customer
CREATE OR REPLACE FUNCTION get_customer_storage(p_customer_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total BIGINT;
BEGIN
  SELECT COALESCE(SUM(file_size), 0) INTO total
  FROM documents
  WHERE customer_id = p_customer_id AND file_deleted_from_storage = false;
  RETURN total;
END;
$$;

-- Batch update documents by group (status/block/unblock)
CREATE OR REPLACE FUNCTION batch_update_by_group(
  p_group_id UUID,
  p_updates JSONB
) RETURNS SETOF documents
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_updates ? 'status' THEN
    UPDATE documents SET
      status = (p_updates->>'status')::TEXT,
      payment_blocked = COALESCE((p_updates->>'payment_blocked')::BOOLEAN, payment_blocked),
      blocked_at = COALESCE((p_updates->>'blocked_at')::TIMESTAMPTZ, blocked_at),
      blocked_by = COALESCE((p_updates->>'blocked_by')::UUID, blocked_by)
    WHERE group_id = p_group_id;
  END IF;
  RETURN QUERY SELECT * FROM documents WHERE group_id = p_group_id ORDER BY created_at;
END;
$$;
