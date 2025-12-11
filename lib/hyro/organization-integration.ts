/**
 * Organization Integration - Hyro Education System
 *
 * @hyro-domain multi_tenancy
 * @hyro-manifold Integrates organization hierarchy with database
 * @hyro-rationale Provides database operations for multi-tenant management
 *
 * PURPOSE:
 * Implements the database layer for organization management,
 * connecting the organization-management.ts service functions
 * to the SQLite database.
 */

import { getDb } from '@/lib/db';
import type {
  Organization,
  OrganizationType,
  OrganizationStatus,
  SubscriptionTier,
  OrganizationLimits,
  OrganizationSettings,
  OrganizationBranding,
  OrganizationFeatures,
  Class,
  ClassType,
  Role,
  RoleType,
  Permission,
  PermissionCategory,
  PermissionAction,
  OrganizationMembership,
  ClassMembership,
  ParentStudentLink,
  Invitation,
  InvitationType,
  BulkImport,
  AuditLogEntry,
  DEFAULT_LIMITS,
  DEFAULT_ROLE_PERMISSIONS,
  DEFAULT_ORGANIZATION_SETTINGS,
  DEFAULT_ORGANIZATION_BRANDING,
  DEFAULT_FEATURES_BY_TIER,
} from './organization-types';

// =============================================================================
// ORGANIZATION DATABASE OPERATIONS
// =============================================================================

/**
 * Get organization by ID
 */
export async function getOrganizationById(id: string): Promise<Organization | null> {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM hyro_organizations WHERE id = ?
  `).get(id) as OrganizationRow | undefined;

  if (!row) return null;
  return rowToOrganization(row);
}

/**
 * Get organization by slug
 */
export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM hyro_organizations WHERE slug = ?
  `).get(slug) as OrganizationRow | undefined;

  if (!row) return null;
  return rowToOrganization(row);
}

/**
 * List organizations for a user
 */
export async function getOrganizationsForUser(userId: string): Promise<Organization[]> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT o.* FROM hyro_organizations o
    INNER JOIN hyro_organization_memberships m ON o.id = m.organization_id
    WHERE m.user_id = ? AND m.status = 'active' AND o.status != 'deleted'
    ORDER BY o.name
  `).all(userId) as OrganizationRow[];

  return rows.map(rowToOrganization);
}

/**
 * List child organizations
 */
export async function getChildOrganizations(parentId: string): Promise<Organization[]> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM hyro_organizations
    WHERE parent_organization_id = ? AND status != 'deleted'
    ORDER BY name
  `).all(parentId) as OrganizationRow[];

  return rows.map(rowToOrganization);
}

/**
 * Insert organization
 */
export async function insertOrganization(org: Organization): Promise<void> {
  const db = getDb();
  db.prepare(`
    INSERT INTO hyro_organizations (
      id, slug, name, type, status,
      parent_organization_id, depth,
      contact_email, contact_phone, address,
      subscription_tier, subscription_status,
      subscription_start_date, subscription_end_date, trial_ends_at,
      stripe_customer_id, stripe_subscription_id,
      limits, settings, branding, features,
      created_at, updated_at, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    org.id,
    org.slug,
    org.name,
    org.type,
    org.status,
    org.parentOrganizationId,
    org.depth,
    org.contactEmail || null,
    org.contactPhone || null,
    org.address ? JSON.stringify(org.address) : null,
    org.subscriptionTier,
    org.subscriptionStatus,
    org.subscriptionStartDate?.toISOString() || null,
    org.subscriptionEndDate?.toISOString() || null,
    org.trialEndsAt?.toISOString() || null,
    org.stripeCustomerId || null,
    org.stripeSubscriptionId || null,
    JSON.stringify(org.limits),
    JSON.stringify(org.settings),
    JSON.stringify(org.branding),
    JSON.stringify(org.features),
    org.createdAt.toISOString(),
    org.updatedAt.toISOString(),
    org.createdBy
  );
}

/**
 * Update organization
 */
export async function updateOrganization(id: string, updates: Partial<Organization>): Promise<void> {
  const db = getDb();

  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    values.push(updates.name);
  }
  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    values.push(updates.status);
  }
  if (updates.settings !== undefined) {
    setClauses.push('settings = ?');
    values.push(JSON.stringify(updates.settings));
  }
  if (updates.branding !== undefined) {
    setClauses.push('branding = ?');
    values.push(JSON.stringify(updates.branding));
  }
  if (updates.limits !== undefined) {
    setClauses.push('limits = ?');
    values.push(JSON.stringify(updates.limits));
  }
  if (updates.features !== undefined) {
    setClauses.push('features = ?');
    values.push(JSON.stringify(updates.features));
  }
  if (updates.subscriptionTier !== undefined) {
    setClauses.push('subscription_tier = ?');
    values.push(updates.subscriptionTier);
  }
  if (updates.subscriptionStatus !== undefined) {
    setClauses.push('subscription_status = ?');
    values.push(updates.subscriptionStatus);
  }

  setClauses.push('updated_at = ?');
  values.push(new Date().toISOString());

  values.push(id);

  if (setClauses.length > 0) {
    db.prepare(`
      UPDATE hyro_organizations SET ${setClauses.join(', ')} WHERE id = ?
    `).run(...values);
  }
}

/**
 * Soft delete organization
 */
export async function deleteOrganization(id: string): Promise<void> {
  const db = getDb();
  db.prepare(`
    UPDATE hyro_organizations
    SET status = 'deleted', deleted_at = ?, updated_at = ?
    WHERE id = ?
  `).run(new Date().toISOString(), new Date().toISOString(), id);
}

/**
 * Update child organizations list
 */
export async function addChildOrganization(parentId: string, childId: string): Promise<void> {
  // In SQLite, we don't store child IDs directly
  // The relationship is via parent_organization_id on the child
  // This function exists for interface compatibility
}

export async function removeChildOrganization(parentId: string, childId: string): Promise<void> {
  // Same as above - relationship managed via parent_organization_id
}

// =============================================================================
// CLASS DATABASE OPERATIONS
// =============================================================================

/**
 * Get class by ID
 */
export async function getClassById(id: string): Promise<Class | null> {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM hyro_classes WHERE id = ?
  `).get(id) as ClassRow | undefined;

  if (!row) return null;
  return rowToClass(row);
}

/**
 * Get class by code
 */
export async function getClassByCode(code: string): Promise<Class | null> {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM hyro_classes WHERE code = ?
  `).get(code) as ClassRow | undefined;

  if (!row) return null;
  return rowToClass(row);
}

/**
 * List classes for an organization
 */
export async function getClassesForOrganization(
  organizationId: string,
  options?: { status?: string; academicYear?: string }
): Promise<Class[]> {
  const db = getDb();
  let sql = `SELECT * FROM hyro_classes WHERE organization_id = ?`;
  const params: unknown[] = [organizationId];

  if (options?.status) {
    sql += ` AND status = ?`;
    params.push(options.status);
  }
  if (options?.academicYear) {
    sql += ` AND academic_year = ?`;
    params.push(options.academicYear);
  }

  sql += ` ORDER BY name`;

  const rows = db.prepare(sql).all(...params) as ClassRow[];
  return rows.map(rowToClass);
}

/**
 * List classes for a user
 */
export async function getClassesForUser(userId: string): Promise<Class[]> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT c.* FROM hyro_classes c
    INNER JOIN hyro_class_memberships m ON c.id = m.class_id
    WHERE m.user_id = ? AND m.status = 'active' AND c.status = 'active'
    ORDER BY c.name
  `).all(userId) as ClassRow[];

  return rows.map(rowToClass);
}

/**
 * Get class count for organization
 */
export async function getClassCount(organizationId: string): Promise<number> {
  const db = getDb();
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM hyro_classes
    WHERE organization_id = ? AND status != 'deleted'
  `).get(organizationId) as { count: number };

  return result.count;
}

/**
 * Insert class
 */
export async function insertClass(cls: Class): Promise<void> {
  const db = getDb();
  db.prepare(`
    INSERT INTO hyro_classes (
      id, organization_id, name, code, description,
      type, subject, grade_level, academic_year, term,
      schedule, settings, status,
      created_at, updated_at, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    cls.id,
    cls.organizationId,
    cls.name,
    cls.code,
    cls.description || null,
    cls.type,
    cls.subject || null,
    cls.gradeLevel || null,
    cls.academicYear,
    cls.term || null,
    cls.schedule ? JSON.stringify(cls.schedule) : null,
    JSON.stringify(cls.settings),
    cls.status,
    cls.createdAt.toISOString(),
    cls.updatedAt.toISOString(),
    cls.createdBy
  );
}

/**
 * Update class
 */
export async function updateClass(id: string, updates: Partial<Class>): Promise<void> {
  const db = getDb();

  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    setClauses.push('description = ?');
    values.push(updates.description);
  }
  if (updates.settings !== undefined) {
    setClauses.push('settings = ?');
    values.push(JSON.stringify(updates.settings));
  }
  if (updates.schedule !== undefined) {
    setClauses.push('schedule = ?');
    values.push(JSON.stringify(updates.schedule));
  }
  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    values.push(updates.status);
  }

  setClauses.push('updated_at = ?');
  values.push(new Date().toISOString());

  values.push(id);

  if (setClauses.length > 0) {
    db.prepare(`
      UPDATE hyro_classes SET ${setClauses.join(', ')} WHERE id = ?
    `).run(...values);
  }
}

// =============================================================================
// MEMBERSHIP DATABASE OPERATIONS
// =============================================================================

/**
 * Get organization membership
 */
export async function getOrganizationMembership(
  organizationId: string,
  userId: string
): Promise<OrganizationMembership | null> {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM hyro_organization_memberships
    WHERE organization_id = ? AND user_id = ?
  `).get(organizationId, userId) as OrgMembershipRow | undefined;

  if (!row) return null;
  return rowToOrgMembership(row);
}

/**
 * List organization members
 */
export async function getOrganizationMembers(
  organizationId: string,
  options?: { roleType?: RoleType; status?: string }
): Promise<OrganizationMembership[]> {
  const db = getDb();
  let sql = `SELECT * FROM hyro_organization_memberships WHERE organization_id = ?`;
  const params: unknown[] = [organizationId];

  if (options?.roleType) {
    sql += ` AND role_type = ?`;
    params.push(options.roleType);
  }
  if (options?.status) {
    sql += ` AND status = ?`;
    params.push(options.status);
  }

  sql += ` ORDER BY joined_at`;

  const rows = db.prepare(sql).all(...params) as OrgMembershipRow[];
  return rows.map(rowToOrgMembership);
}

/**
 * Get organization owner count
 */
export async function getOrganizationOwnerCount(organizationId: string): Promise<number> {
  const db = getDb();
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM hyro_organization_memberships
    WHERE organization_id = ? AND role_type = 'org_owner' AND status = 'active'
  `).get(organizationId) as { count: number };

  return result.count;
}

/**
 * Insert organization membership
 */
export async function insertOrganizationMembership(membership: OrganizationMembership): Promise<void> {
  const db = getDb();
  db.prepare(`
    INSERT INTO hyro_organization_memberships (
      id, organization_id, user_id, role_id, role_type,
      status, effective_permissions,
      joined_at, invited_by, last_active_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    membership.id,
    membership.organizationId,
    membership.userId,
    membership.roleId,
    membership.roleType,
    membership.status,
    JSON.stringify(membership.effectivePermissions),
    membership.joinedAt.toISOString(),
    membership.invitedBy || null,
    membership.lastActiveAt?.toISOString() || null
  );
}

/**
 * Update organization membership
 */
export async function updateOrganizationMembership(
  id: string,
  updates: Partial<OrganizationMembership>
): Promise<void> {
  const db = getDb();

  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (updates.roleType !== undefined) {
    setClauses.push('role_type = ?');
    values.push(updates.roleType);
  }
  if (updates.roleId !== undefined) {
    setClauses.push('role_id = ?');
    values.push(updates.roleId);
  }
  if (updates.effectivePermissions !== undefined) {
    setClauses.push('effective_permissions = ?');
    values.push(JSON.stringify(updates.effectivePermissions));
  }
  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    values.push(updates.status);
  }

  values.push(id);

  if (setClauses.length > 0) {
    db.prepare(`
      UPDATE hyro_organization_memberships SET ${setClauses.join(', ')} WHERE id = ?
    `).run(...values);
  }
}

/**
 * Get class membership
 */
export async function getClassMembership(
  classId: string,
  userId: string
): Promise<ClassMembership | null> {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM hyro_class_memberships
    WHERE class_id = ? AND user_id = ?
  `).get(classId, userId) as ClassMembershipRow | undefined;

  if (!row) return null;
  return rowToClassMembership(row);
}

/**
 * List class members
 */
export async function getClassMembers(
  classId: string,
  options?: { role?: ClassMembership['role']; status?: string }
): Promise<ClassMembership[]> {
  const db = getDb();
  let sql = `SELECT * FROM hyro_class_memberships WHERE class_id = ?`;
  const params: unknown[] = [classId];

  if (options?.role) {
    sql += ` AND role = ?`;
    params.push(options.role);
  }
  if (options?.status) {
    sql += ` AND status = ?`;
    params.push(options.status);
  }

  sql += ` ORDER BY enrolled_at`;

  const rows = db.prepare(sql).all(...params) as ClassMembershipRow[];
  return rows.map(rowToClassMembership);
}

/**
 * Insert class membership
 */
export async function insertClassMembership(membership: ClassMembership): Promise<void> {
  const db = getDb();
  db.prepare(`
    INSERT INTO hyro_class_memberships (
      id, class_id, user_id, role, status,
      permissions, enrolled_at, added_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    membership.id,
    membership.classId,
    membership.userId,
    membership.role,
    membership.status,
    JSON.stringify(membership.permissions),
    membership.enrolledAt.toISOString(),
    membership.addedBy
  );
}

/**
 * Update class membership
 */
export async function updateClassMembership(
  id: string,
  updates: Partial<ClassMembership>
): Promise<void> {
  const db = getDb();

  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (updates.role !== undefined) {
    setClauses.push('role = ?');
    values.push(updates.role);
  }
  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    values.push(updates.status);
  }
  if (updates.permissions !== undefined) {
    setClauses.push('permissions = ?');
    values.push(JSON.stringify(updates.permissions));
  }

  values.push(id);

  if (setClauses.length > 0) {
    db.prepare(`
      UPDATE hyro_class_memberships SET ${setClauses.join(', ')} WHERE id = ?
    `).run(...values);
  }
}

// =============================================================================
// PARENT-STUDENT LINK DATABASE OPERATIONS
// =============================================================================

/**
 * Get parent-student link
 */
export async function getParentStudentLink(
  parentId: string,
  studentId: string
): Promise<ParentStudentLink | null> {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM hyro_parent_student_links
    WHERE parent_id = ? AND student_id = ?
  `).get(parentId, studentId) as ParentStudentLinkRow | undefined;

  if (!row) return null;
  return rowToParentStudentLink(row);
}

/**
 * Get parent-student link by ID
 */
export async function getParentStudentLinkById(id: string): Promise<ParentStudentLink | null> {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM hyro_parent_student_links WHERE id = ?
  `).get(id) as ParentStudentLinkRow | undefined;

  if (!row) return null;
  return rowToParentStudentLink(row);
}

/**
 * Get students for a parent
 */
export async function getStudentsForParent(parentId: string): Promise<ParentStudentLink[]> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM hyro_parent_student_links
    WHERE parent_id = ? AND status = 'active'
  `).all(parentId) as ParentStudentLinkRow[];

  return rows.map(rowToParentStudentLink);
}

/**
 * Insert parent-student link
 */
export async function insertParentStudentLink(link: ParentStudentLink): Promise<void> {
  const db = getDb();
  db.prepare(`
    INSERT INTO hyro_parent_student_links (
      id, parent_id, student_id, relationship, status,
      permissions, linked_at, linked_by,
      verified_at, verification_method, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    link.id,
    link.parentId,
    link.studentId,
    link.relationship,
    link.status,
    JSON.stringify(link.permissions),
    link.linkedAt.toISOString(),
    link.linkedBy,
    link.verifiedAt?.toISOString() || null,
    link.verificationMethod || null,
    link.expiresAt?.toISOString() || null
  );
}

/**
 * Update parent-student link
 */
export async function updateParentStudentLink(
  id: string,
  updates: Partial<ParentStudentLink>
): Promise<void> {
  const db = getDb();

  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    values.push(updates.status);
  }
  if (updates.verifiedAt !== undefined) {
    setClauses.push('verified_at = ?');
    values.push(updates.verifiedAt?.toISOString() || null);
  }
  if (updates.verificationMethod !== undefined) {
    setClauses.push('verification_method = ?');
    values.push(updates.verificationMethod);
  }
  if (updates.permissions !== undefined) {
    setClauses.push('permissions = ?');
    values.push(JSON.stringify(updates.permissions));
  }

  values.push(id);

  if (setClauses.length > 0) {
    db.prepare(`
      UPDATE hyro_parent_student_links SET ${setClauses.join(', ')} WHERE id = ?
    `).run(...values);
  }
}

// =============================================================================
// INVITATION DATABASE OPERATIONS
// =============================================================================

/**
 * Get pending invitation by email
 */
export async function getPendingInvitation(
  organizationId: string,
  email: string
): Promise<Invitation | null> {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM hyro_invitations
    WHERE organization_id = ? AND email = ? AND status = 'pending'
  `).get(organizationId, email) as InvitationRow | undefined;

  if (!row) return null;
  return rowToInvitation(row);
}

/**
 * Get invitation by token
 */
export async function getInvitationByToken(token: string): Promise<Invitation | null> {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM hyro_invitations WHERE token = ?
  `).get(token) as InvitationRow | undefined;

  if (!row) return null;
  return rowToInvitation(row);
}

/**
 * Insert invitation
 */
export async function insertInvitation(invitation: Invitation): Promise<void> {
  const db = getDb();
  db.prepare(`
    INSERT INTO hyro_invitations (
      id, organization_id, email, type, role_type,
      class_ids, token, status,
      created_at, created_by, expires_at, message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    invitation.id,
    invitation.organizationId,
    invitation.email,
    invitation.type,
    invitation.roleType,
    JSON.stringify(invitation.classIds),
    invitation.token,
    invitation.status,
    invitation.createdAt.toISOString(),
    invitation.createdBy,
    invitation.expiresAt.toISOString(),
    invitation.message || null
  );
}

/**
 * Update invitation
 */
export async function updateInvitation(
  id: string,
  updates: Partial<Invitation>
): Promise<void> {
  const db = getDb();

  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    values.push(updates.status);
  }
  if (updates.acceptedAt !== undefined) {
    setClauses.push('accepted_at = ?');
    values.push(updates.acceptedAt?.toISOString() || null);
  }
  if (updates.acceptedBy !== undefined) {
    setClauses.push('accepted_by = ?');
    values.push(updates.acceptedBy);
  }

  values.push(id);

  if (setClauses.length > 0) {
    db.prepare(`
      UPDATE hyro_invitations SET ${setClauses.join(', ')} WHERE id = ?
    `).run(...values);
  }
}

// =============================================================================
// AUDIT LOG DATABASE OPERATIONS
// =============================================================================

/**
 * Insert audit log entry
 */
export async function insertAuditLogEntry(entry: AuditLogEntry): Promise<void> {
  const db = getDb();
  db.prepare(`
    INSERT INTO hyro_audit_logs (
      id, organization_id, user_id, action,
      resource_type, resource_id, details,
      previous_value, new_value,
      ip_address, user_agent, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.id,
    entry.organizationId,
    entry.userId,
    entry.action,
    entry.resourceType,
    entry.resourceId,
    JSON.stringify(entry.details),
    entry.previousValue ? JSON.stringify(entry.previousValue) : null,
    entry.newValue ? JSON.stringify(entry.newValue) : null,
    entry.ipAddress || null,
    entry.userAgent || null,
    entry.timestamp.toISOString()
  );
}

/**
 * Query audit logs
 */
export async function queryAuditLogs(params: {
  organizationId: string;
  userId?: string;
  resourceType?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<{ entries: AuditLogEntry[]; total: number }> {
  const db = getDb();

  const conditions: string[] = ['organization_id = ?'];
  const values: unknown[] = [params.organizationId];

  if (params.userId) {
    conditions.push('user_id = ?');
    values.push(params.userId);
  }
  if (params.resourceType) {
    conditions.push('resource_type = ?');
    values.push(params.resourceType);
  }
  if (params.action) {
    conditions.push('action LIKE ?');
    values.push(`${params.action}%`);
  }
  if (params.startDate) {
    conditions.push('timestamp >= ?');
    values.push(params.startDate.toISOString());
  }
  if (params.endDate) {
    conditions.push('timestamp <= ?');
    values.push(params.endDate.toISOString());
  }

  const whereClause = conditions.join(' AND ');

  // Get total count
  const countResult = db.prepare(`
    SELECT COUNT(*) as count FROM hyro_audit_logs WHERE ${whereClause}
  `).get(...values) as { count: number };

  // Get paginated results
  const limit = params.limit || 50;
  const offset = params.offset || 0;

  const rows = db.prepare(`
    SELECT * FROM hyro_audit_logs
    WHERE ${whereClause}
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `).all(...values, limit, offset) as AuditLogRow[];

  return {
    entries: rows.map(rowToAuditLogEntry),
    total: countResult.count,
  };
}

// =============================================================================
// ROLE DATABASE OPERATIONS
// =============================================================================

/**
 * Get role by ID
 */
export async function getRoleById(id: string): Promise<Role | null> {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM hyro_roles WHERE id = ?
  `).get(id) as RoleRow | undefined;

  if (!row) return null;
  return rowToRole(row);
}

/**
 * Get custom role permissions
 */
export async function getCustomRolePermissions(roleId: string): Promise<Permission[]> {
  const role = await getRoleById(roleId);
  if (!role) return [];
  return role.permissions;
}

/**
 * Insert role
 */
export async function insertRole(role: Role): Promise<void> {
  const db = getDb();
  db.prepare(`
    INSERT INTO hyro_roles (
      id, organization_id, name, description,
      type, is_system_role, is_custom,
      permissions, inherits_from,
      created_at, updated_at, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    role.id,
    role.organizationId,
    role.name,
    role.description || null,
    role.type,
    role.isSystemRole ? 1 : 0,
    role.isCustom ? 1 : 0,
    JSON.stringify(role.permissions),
    role.inheritsFrom || null,
    role.createdAt.toISOString(),
    role.updatedAt.toISOString(),
    role.createdBy || null
  );
}

/**
 * Create default system roles for an organization
 */
export async function createDefaultRolesForOrganization(
  organizationId: string,
  createdBy: string
): Promise<void> {
  const roleTypes: RoleType[] = [
    'org_owner', 'org_admin', 'principal', 'department_head',
    'teacher', 'teaching_assistant', 'parent', 'guardian', 'student', 'observer'
  ];

  for (const roleType of roleTypes) {
    const permissions = DEFAULT_ROLE_PERMISSIONS[roleType] || [];

    await insertRole({
      id: `role_${organizationId}_${roleType}`,
      organizationId,
      name: formatRoleName(roleType),
      description: `Default ${formatRoleName(roleType)} role`,
      type: roleType,
      isSystemRole: true,
      isCustom: false,
      permissions,
      inheritsFrom: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy,
    });
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatRoleName(type: RoleType): string {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// =============================================================================
// ROW TYPE DEFINITIONS
// =============================================================================

interface OrganizationRow {
  id: string;
  slug: string;
  name: string;
  type: OrganizationType;
  status: OrganizationStatus;
  parent_organization_id: string | null;
  depth: number;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  subscription_tier: SubscriptionTier;
  subscription_status: string;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  limits: string;
  settings: string;
  branding: string;
  features: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  deleted_at: string | null;
}

interface ClassRow {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  description: string | null;
  type: ClassType;
  subject: string | null;
  grade_level: string | null;
  academic_year: string;
  term: string | null;
  schedule: string | null;
  settings: string;
  status: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  archived_at: string | null;
}

interface OrgMembershipRow {
  id: string;
  organization_id: string;
  user_id: string;
  role_id: string;
  role_type: RoleType;
  status: string;
  effective_permissions: string;
  joined_at: string;
  invited_by: string | null;
  last_active_at: string | null;
  removed_at: string | null;
  removed_by: string | null;
  removal_reason: string | null;
}

interface ClassMembershipRow {
  id: string;
  class_id: string;
  user_id: string;
  role: string;
  status: string;
  permissions: string;
  enrolled_at: string;
  added_by: string;
  completed_at: string | null;
  withdrawn_at: string | null;
  removed_at: string | null;
  removed_by: string | null;
}

interface ParentStudentLinkRow {
  id: string;
  parent_id: string;
  student_id: string;
  relationship: string;
  status: string;
  permissions: string;
  linked_at: string;
  linked_by: string;
  verified_at: string | null;
  verification_method: string | null;
  expires_at: string | null;
}

interface InvitationRow {
  id: string;
  organization_id: string;
  email: string;
  type: InvitationType;
  role_type: RoleType;
  class_ids: string;
  token: string;
  status: string;
  created_at: string;
  created_by: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  message: string | null;
  resent_count: number;
  last_resent_at: string | null;
}

interface AuditLogRow {
  id: string;
  organization_id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: string;
  previous_value: string | null;
  new_value: string | null;
  ip_address: string | null;
  user_agent: string | null;
  timestamp: string;
}

interface RoleRow {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  type: RoleType;
  is_system_role: number;
  is_custom: number;
  permissions: string;
  inherits_from: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

// =============================================================================
// ROW CONVERSION FUNCTIONS
// =============================================================================

function rowToOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    type: row.type,
    status: row.status,
    parentOrganizationId: row.parent_organization_id,
    childOrganizationIds: [], // Loaded separately if needed
    depth: row.depth,
    contactEmail: row.contact_email || undefined,
    contactPhone: row.contact_phone || undefined,
    address: row.address ? JSON.parse(row.address) : undefined,
    subscriptionTier: row.subscription_tier,
    subscriptionStatus: row.subscription_status as Organization['subscriptionStatus'],
    subscriptionStartDate: row.subscription_start_date ? new Date(row.subscription_start_date) : null,
    subscriptionEndDate: row.subscription_end_date ? new Date(row.subscription_end_date) : null,
    trialEndsAt: row.trial_ends_at ? new Date(row.trial_ends_at) : null,
    stripeCustomerId: row.stripe_customer_id || undefined,
    stripeSubscriptionId: row.stripe_subscription_id || undefined,
    limits: JSON.parse(row.limits),
    settings: JSON.parse(row.settings),
    branding: JSON.parse(row.branding),
    features: JSON.parse(row.features),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined,
  };
}

function rowToClass(row: ClassRow): Class {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    code: row.code,
    description: row.description || undefined,
    type: row.type,
    subject: row.subject || null,
    gradeLevel: row.grade_level || null,
    academicYear: row.academic_year,
    term: row.term || undefined,
    teacherIds: [], // Loaded from memberships
    studentIds: [], // Loaded from memberships
    parentObserverIds: [], // Loaded from memberships
    schedule: row.schedule ? JSON.parse(row.schedule) : null,
    settings: JSON.parse(row.settings),
    status: row.status as Class['status'],
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
    archivedAt: row.archived_at ? new Date(row.archived_at) : undefined,
  };
}

function rowToOrgMembership(row: OrgMembershipRow): OrganizationMembership {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    roleId: row.role_id,
    roleType: row.role_type,
    status: row.status as OrganizationMembership['status'],
    effectivePermissions: JSON.parse(row.effective_permissions),
    joinedAt: new Date(row.joined_at),
    invitedBy: row.invited_by,
    lastActiveAt: row.last_active_at ? new Date(row.last_active_at) : undefined,
    removedAt: row.removed_at ? new Date(row.removed_at) : undefined,
    removedBy: row.removed_by || undefined,
    removalReason: row.removal_reason || undefined,
  };
}

function rowToClassMembership(row: ClassMembershipRow): ClassMembership {
  return {
    id: row.id,
    classId: row.class_id,
    userId: row.user_id,
    role: row.role as ClassMembership['role'],
    status: row.status as ClassMembership['status'],
    permissions: JSON.parse(row.permissions),
    enrolledAt: new Date(row.enrolled_at),
    addedBy: row.added_by,
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    withdrawnAt: row.withdrawn_at ? new Date(row.withdrawn_at) : undefined,
    removedAt: row.removed_at ? new Date(row.removed_at) : undefined,
    removedBy: row.removed_by || undefined,
  };
}

function rowToParentStudentLink(row: ParentStudentLinkRow): ParentStudentLink {
  return {
    id: row.id,
    parentId: row.parent_id,
    studentId: row.student_id,
    relationship: row.relationship as ParentStudentLink['relationship'],
    status: row.status as ParentStudentLink['status'],
    permissions: JSON.parse(row.permissions),
    linkedAt: new Date(row.linked_at),
    linkedBy: row.linked_by,
    verifiedAt: row.verified_at ? new Date(row.verified_at) : null,
    verificationMethod: row.verification_method as ParentStudentLink['verificationMethod'],
    expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
  };
}

function rowToInvitation(row: InvitationRow): Invitation {
  return {
    id: row.id,
    organizationId: row.organization_id,
    email: row.email,
    type: row.type,
    roleType: row.role_type,
    classIds: JSON.parse(row.class_ids),
    token: row.token,
    status: row.status as Invitation['status'],
    createdAt: new Date(row.created_at),
    createdBy: row.created_by,
    expiresAt: new Date(row.expires_at),
    acceptedAt: row.accepted_at ? new Date(row.accepted_at) : undefined,
    acceptedBy: row.accepted_by || undefined,
    message: row.message,
    resentCount: row.resent_count,
    lastResentAt: row.last_resent_at ? new Date(row.last_resent_at) : undefined,
  };
}

function rowToAuditLogEntry(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    action: row.action,
    resourceType: row.resource_type as AuditLogEntry['resourceType'],
    resourceId: row.resource_id,
    details: JSON.parse(row.details),
    previousValue: row.previous_value ? JSON.parse(row.previous_value) : null,
    newValue: row.new_value ? JSON.parse(row.new_value) : null,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    timestamp: new Date(row.timestamp),
  };
}

function rowToRole(row: RoleRow): Role {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description || undefined,
    type: row.type,
    isSystemRole: row.is_system_role === 1,
    isCustom: row.is_custom === 1,
    permissions: JSON.parse(row.permissions),
    inheritsFrom: row.inherits_from,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by || undefined,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  // Organization
  getOrganizationById,
  getOrganizationBySlug,
  getOrganizationsForUser,
  getChildOrganizations,
  insertOrganization,
  updateOrganization,
  deleteOrganization,
  addChildOrganization,
  removeChildOrganization,

  // Class
  getClassById,
  getClassByCode,
  getClassesForOrganization,
  getClassesForUser,
  getClassCount,
  insertClass,
  updateClass,

  // Membership
  getOrganizationMembership,
  getOrganizationMembers,
  getOrganizationOwnerCount,
  insertOrganizationMembership,
  updateOrganizationMembership,
  getClassMembership,
  getClassMembers,
  insertClassMembership,
  updateClassMembership,

  // Parent-Student
  getParentStudentLink,
  getParentStudentLinkById,
  getStudentsForParent,
  insertParentStudentLink,
  updateParentStudentLink,

  // Invitation
  getPendingInvitation,
  getInvitationByToken,
  insertInvitation,
  updateInvitation,

  // Audit
  insertAuditLogEntry,
  queryAuditLogs,

  // Role
  getRoleById,
  getCustomRolePermissions,
  insertRole,
  createDefaultRolesForOrganization,
};
