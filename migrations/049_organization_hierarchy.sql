-- ============================================================================
-- HYRO FORGE: Organization Hierarchy Migration
-- Migration 049: Full organization hierarchy for multi-tenant B2B
-- Created: 2025-12-09
--
-- OBJECTIVE:
-- Implement complete organization hierarchy supporting:
-- - Families, homeschool coops, schools, districts, state systems
-- - Role-based access control (RBAC)
-- - Subscription tiers with feature flags
-- - Class management with teacher/student relationships
-- - Parent-student linking
-- - Audit logging for compliance
--
-- ARCHITECTURE:
-- State System → District → School → Class → Student
-- Organization → Classes → Members (Teachers, Students, Parents)
-- ============================================================================

-- ============================================================================
-- PART 1: ORGANIZATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS hyro_organizations (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,

    -- Type and status
    type TEXT NOT NULL CHECK (type IN (
        'family', 'homeschool_coop', 'tutoring_center',
        'private_school', 'public_school', 'district',
        'state_system', 'nonprofit', 'corporate', 'other'
    )),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'pending', 'active', 'suspended', 'deleted'
    )),

    -- Hierarchy
    parent_organization_id TEXT REFERENCES hyro_organizations(id) ON DELETE SET NULL,
    depth INTEGER NOT NULL DEFAULT 0,

    -- Contact info (JSON for flexibility)
    contact_email TEXT,
    contact_phone TEXT,
    address TEXT,  -- JSON: {street, city, state, zip, country}

    -- Subscription
    subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN (
        'free', 'family', 'educator', 'school', 'district', 'enterprise'
    )),
    subscription_status TEXT NOT NULL DEFAULT 'active' CHECK (subscription_status IN (
        'active', 'trial', 'past_due', 'cancelled', 'paused'
    )),
    subscription_start_date DATETIME,
    subscription_end_date DATETIME,
    trial_ends_at DATETIME,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,

    -- Limits (JSON blob matching OrganizationLimits interface)
    limits TEXT NOT NULL DEFAULT '{}',

    -- Settings (JSON blob matching OrganizationSettings interface)
    settings TEXT NOT NULL DEFAULT '{}',

    -- Branding (JSON blob matching OrganizationBranding interface)
    branding TEXT NOT NULL DEFAULT '{}',

    -- Features (JSON blob matching OrganizationFeatures interface)
    features TEXT NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL,
    deleted_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_hyro_org_slug ON hyro_organizations(slug);
CREATE INDEX IF NOT EXISTS idx_hyro_org_parent ON hyro_organizations(parent_organization_id);
CREATE INDEX IF NOT EXISTS idx_hyro_org_type ON hyro_organizations(type);
CREATE INDEX IF NOT EXISTS idx_hyro_org_status ON hyro_organizations(status);
CREATE INDEX IF NOT EXISTS idx_hyro_org_tier ON hyro_organizations(subscription_tier);

-- ============================================================================
-- PART 2: ROLES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS hyro_roles (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES hyro_organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,

    -- Role type and base
    type TEXT NOT NULL CHECK (type IN (
        'super_admin', 'org_owner', 'org_admin', 'principal',
        'department_head', 'teacher', 'teaching_assistant',
        'parent', 'guardian', 'student', 'observer'
    )),
    is_system_role INTEGER NOT NULL DEFAULT 0,  -- Cannot be deleted if true
    is_custom INTEGER NOT NULL DEFAULT 0,

    -- Permissions (JSON array of Permission objects)
    permissions TEXT NOT NULL DEFAULT '[]',

    -- Inheritance
    inherits_from TEXT REFERENCES hyro_roles(id) ON DELETE SET NULL,

    -- Timestamps
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_hyro_roles_org ON hyro_roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_hyro_roles_type ON hyro_roles(type);

-- ============================================================================
-- PART 3: CLASSES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS hyro_classes (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES hyro_organizations(id) ON DELETE CASCADE,

    -- Basic info
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,  -- 6-character join code
    description TEXT,

    -- Type and subject
    type TEXT NOT NULL DEFAULT 'standard' CHECK (type IN (
        'standard', 'honors', 'ap', 'remedial', 'enrichment',
        'homeroom', 'advisory', 'special_education'
    )),
    subject TEXT,
    grade_level TEXT,

    -- Academic period
    academic_year TEXT NOT NULL,
    term TEXT,

    -- Schedule (JSON blob)
    schedule TEXT,

    -- Settings (JSON blob)
    settings TEXT NOT NULL DEFAULT '{}',

    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'draft', 'active', 'archived', 'deleted'
    )),

    -- Timestamps
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL,
    archived_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_hyro_classes_org ON hyro_classes(organization_id);
CREATE INDEX IF NOT EXISTS idx_hyro_classes_code ON hyro_classes(code);
CREATE INDEX IF NOT EXISTS idx_hyro_classes_status ON hyro_classes(status);
CREATE INDEX IF NOT EXISTS idx_hyro_classes_year ON hyro_classes(academic_year);

-- ============================================================================
-- PART 4: ORGANIZATION MEMBERSHIPS
-- ============================================================================

CREATE TABLE IF NOT EXISTS hyro_organization_memberships (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES hyro_organizations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,  -- Clerk user ID

    -- Role assignment
    role_id TEXT NOT NULL REFERENCES hyro_roles(id) ON DELETE RESTRICT,
    role_type TEXT NOT NULL,

    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'pending', 'active', 'suspended', 'removed'
    )),

    -- Effective permissions (cached, JSON array)
    effective_permissions TEXT NOT NULL DEFAULT '[]',

    -- Metadata
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    invited_by TEXT,
    last_active_at DATETIME,
    removed_at DATETIME,
    removed_by TEXT,
    removal_reason TEXT,

    UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_hyro_org_mem_org ON hyro_organization_memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_hyro_org_mem_user ON hyro_organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_hyro_org_mem_role ON hyro_organization_memberships(role_type);
CREATE INDEX IF NOT EXISTS idx_hyro_org_mem_status ON hyro_organization_memberships(status);

-- ============================================================================
-- PART 5: CLASS MEMBERSHIPS
-- ============================================================================

CREATE TABLE IF NOT EXISTS hyro_class_memberships (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL REFERENCES hyro_classes(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,  -- Clerk user ID

    -- Role in this class
    role TEXT NOT NULL CHECK (role IN (
        'lead_teacher', 'co_teacher', 'teaching_assistant',
        'student', 'parent_observer'
    )),

    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'active', 'withdrawn', 'removed', 'completed'
    )),

    -- Permissions for this class (JSON array)
    permissions TEXT NOT NULL DEFAULT '[]',

    -- Metadata
    enrolled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    added_by TEXT NOT NULL,
    completed_at DATETIME,
    withdrawn_at DATETIME,
    removed_at DATETIME,
    removed_by TEXT,

    UNIQUE(class_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_hyro_class_mem_class ON hyro_class_memberships(class_id);
CREATE INDEX IF NOT EXISTS idx_hyro_class_mem_user ON hyro_class_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_hyro_class_mem_role ON hyro_class_memberships(role);
CREATE INDEX IF NOT EXISTS idx_hyro_class_mem_status ON hyro_class_memberships(status);

-- ============================================================================
-- PART 6: PARENT-STUDENT LINKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS hyro_parent_student_links (
    id TEXT PRIMARY KEY,
    parent_id TEXT NOT NULL,  -- Clerk user ID of parent
    student_id TEXT NOT NULL,  -- Clerk user ID of student

    -- Relationship type
    relationship TEXT NOT NULL CHECK (relationship IN (
        'parent', 'guardian', 'grandparent', 'sibling',
        'tutor', 'mentor', 'caregiver', 'legal_guardian', 'other'
    )),

    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'pending', 'active', 'revoked', 'expired'
    )),

    -- Permissions (JSON blob)
    permissions TEXT NOT NULL DEFAULT '{}',

    -- Verification
    linked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    linked_by TEXT NOT NULL,
    verified_at DATETIME,
    verification_method TEXT CHECK (verification_method IN (
        'school_admin', 'document_upload', 'email_verification',
        'manual_review', 'automatic'
    )),

    -- Expiration for temporary guardians
    expires_at DATETIME,

    UNIQUE(parent_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_hyro_psl_parent ON hyro_parent_student_links(parent_id);
CREATE INDEX IF NOT EXISTS idx_hyro_psl_student ON hyro_parent_student_links(student_id);
CREATE INDEX IF NOT EXISTS idx_hyro_psl_status ON hyro_parent_student_links(status);

-- ============================================================================
-- PART 7: INVITATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS hyro_invitations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES hyro_organizations(id) ON DELETE CASCADE,

    -- Invite details
    email TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN (
        'organization_member', 'class_teacher', 'class_student',
        'parent_link', 'bulk_import'
    )),
    role_type TEXT NOT NULL,

    -- Associated classes (JSON array of class IDs)
    class_ids TEXT DEFAULT '[]',

    -- Token
    token TEXT UNIQUE NOT NULL,

    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'accepted', 'declined', 'expired', 'revoked'
    )),

    -- Metadata
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    accepted_at DATETIME,
    accepted_by TEXT,
    message TEXT,

    -- Track resends
    resent_count INTEGER NOT NULL DEFAULT 0,
    last_resent_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_hyro_inv_org ON hyro_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_hyro_inv_email ON hyro_invitations(email);
CREATE INDEX IF NOT EXISTS idx_hyro_inv_token ON hyro_invitations(token);
CREATE INDEX IF NOT EXISTS idx_hyro_inv_status ON hyro_invitations(status);

-- ============================================================================
-- PART 8: BULK IMPORTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS hyro_bulk_imports (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES hyro_organizations(id) ON DELETE CASCADE,

    -- Import details
    type TEXT NOT NULL CHECK (type IN (
        'students', 'teachers', 'parents', 'classes', 'enrollments'
    )),
    source TEXT NOT NULL CHECK (source IN (
        'csv', 'google_classroom', 'clever', 'classlink', 'manual'
    )),

    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'validating', 'processing', 'completed',
        'completed_with_errors', 'failed', 'cancelled'
    )),

    -- Counts
    total_rows INTEGER NOT NULL DEFAULT 0,
    processed_rows INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,

    -- Errors (JSON array)
    errors TEXT DEFAULT '[]',

    -- Original file info
    file_name TEXT,
    file_url TEXT,

    -- Metadata
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL,
    started_at DATETIME,
    completed_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_hyro_bulk_org ON hyro_bulk_imports(organization_id);
CREATE INDEX IF NOT EXISTS idx_hyro_bulk_status ON hyro_bulk_imports(status);

-- ============================================================================
-- PART 9: AUDIT LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS hyro_audit_logs (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES hyro_organizations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,

    -- Action details
    action TEXT NOT NULL,  -- e.g., 'organization.created', 'member.role_updated'
    resource_type TEXT NOT NULL,  -- e.g., 'organization', 'class', 'membership'
    resource_id TEXT NOT NULL,

    -- Details (JSON blob)
    details TEXT DEFAULT '{}',

    -- Change tracking (JSON blobs)
    previous_value TEXT,
    new_value TEXT,

    -- Request context
    ip_address TEXT,
    user_agent TEXT,

    -- Timestamp
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hyro_audit_org ON hyro_audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_hyro_audit_user ON hyro_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_hyro_audit_action ON hyro_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_hyro_audit_resource ON hyro_audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_hyro_audit_time ON hyro_audit_logs(timestamp);

-- ============================================================================
-- PART 10: API KEYS (for integrations)
-- ============================================================================

CREATE TABLE IF NOT EXISTS hyro_api_keys (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES hyro_organizations(id) ON DELETE CASCADE,

    -- Key details
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,  -- Store hashed, never plain
    key_prefix TEXT NOT NULL,  -- First 8 chars for identification

    -- Permissions (JSON array)
    permissions TEXT NOT NULL DEFAULT '[]',

    -- Rate limiting
    rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
    rate_limit_per_day INTEGER NOT NULL DEFAULT 10000,

    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'active', 'revoked', 'expired'
    )),

    -- Usage tracking
    last_used_at DATETIME,
    total_requests INTEGER NOT NULL DEFAULT 0,

    -- Metadata
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL,
    expires_at DATETIME,
    revoked_at DATETIME,
    revoked_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_hyro_api_org ON hyro_api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_hyro_api_prefix ON hyro_api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_hyro_api_status ON hyro_api_keys(status);

-- ============================================================================
-- PART 11: WEBHOOKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS hyro_webhooks (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES hyro_organizations(id) ON DELETE CASCADE,

    -- Webhook config
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,  -- For signature verification

    -- Events to subscribe (JSON array)
    events TEXT NOT NULL DEFAULT '[]',

    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'active', 'paused', 'failed', 'disabled'
    )),

    -- Health tracking
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    last_success_at DATETIME,
    last_failure_at DATETIME,
    last_failure_reason TEXT,

    -- Metadata
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hyro_webhook_org ON hyro_webhooks(organization_id);
CREATE INDEX IF NOT EXISTS idx_hyro_webhook_status ON hyro_webhooks(status);

-- ============================================================================
-- PART 12: DATA ACCESS REQUESTS (GDPR/CCPA compliance)
-- ============================================================================

CREATE TABLE IF NOT EXISTS hyro_data_access_requests (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES hyro_organizations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,

    -- Request details
    type TEXT NOT NULL CHECK (type IN (
        'export', 'delete', 'restrict', 'rectify', 'access'
    )),

    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'completed', 'rejected'
    )),

    -- Data scope (JSON array of data categories)
    data_scope TEXT NOT NULL DEFAULT '[]',

    -- Verification
    verified_at DATETIME,
    verification_method TEXT,

    -- Completion
    download_url TEXT,
    download_expires_at DATETIME,

    -- Metadata
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_by TEXT,
    completed_at DATETIME,
    rejection_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_hyro_dar_org ON hyro_data_access_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_hyro_dar_user ON hyro_data_access_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_hyro_dar_status ON hyro_data_access_requests(status);

-- ============================================================================
-- PART 13: UPDATE STUDENTS TABLE
-- Add organization_id to link students to organizations
-- ============================================================================

-- Add organization_id column to students table if not exists
ALTER TABLE students ADD COLUMN organization_id TEXT REFERENCES hyro_organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_students_org ON students(organization_id);

-- ============================================================================
-- PART 14: DEFAULT SYSTEM ROLES (inserted per organization)
-- These will be created automatically when an organization is created
-- ============================================================================

-- Note: System roles are created programmatically in organization-management.ts
-- This section documents the expected default roles for reference:
--
-- ROLE: super_admin
--   - Full system access across all organizations
--   - Only assigned to platform administrators
--
-- ROLE: org_owner
--   - Full access to their organization
--   - Can manage billing, subscription, and settings
--   - Can create/delete admin users
--
-- ROLE: org_admin
--   - Administrative access to organization
--   - Cannot manage billing or delete organization
--
-- ROLE: principal
--   - School-level administration
--   - Can manage teachers and classes
--
-- ROLE: teacher
--   - Can manage assigned classes
--   - Can view/update student progress in their classes
--
-- ROLE: parent
--   - Can view linked students' progress
--   - Cannot modify educational content
--
-- ROLE: student
--   - Can access their own learning content
--   - Progress is tracked automatically

-- ============================================================================
-- MIGRATION RECORD
-- ============================================================================

INSERT INTO migrations (name) VALUES ('049_organization_hierarchy');

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Tables Created: 12 new tables for organization hierarchy
--   1. hyro_organizations - Organization entities
--   2. hyro_roles - Role definitions with permissions
--   3. hyro_classes - Class/course entities
--   4. hyro_organization_memberships - User-org relationships
--   5. hyro_class_memberships - User-class relationships
--   6. hyro_parent_student_links - Parent-student relationships
--   7. hyro_invitations - Invitation system
--   8. hyro_bulk_imports - Bulk import tracking
--   9. hyro_audit_logs - Compliance audit trail
--  10. hyro_api_keys - API key management
--  11. hyro_webhooks - Webhook subscriptions
--  12. hyro_data_access_requests - GDPR/CCPA compliance
--
-- Indexes Created: 35+ indexes for query performance
--
-- Tables Updated:
--   - students: Added organization_id column
--
-- FEATURES ENABLED:
-- - Multi-tenant organization hierarchy
-- - Role-based access control (RBAC)
-- - Subscription tier management
-- - Class management
-- - Parent-student linking
-- - Invitation and bulk import systems
-- - Full audit logging
-- - API key and webhook management
-- - GDPR/CCPA compliance support
-- ============================================================================
