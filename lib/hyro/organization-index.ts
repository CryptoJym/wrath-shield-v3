/**
 * Organization System Index - Hyro Education System
 *
 * @hyro-domain multi_tenancy
 * @hyro-manifold Central export for all organization-related modules
 *
 * This file provides a unified interface for the multi-tenant organization
 * system, exporting types, management functions, and database operations.
 */

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type {
  // Core types
  OrganizationType,
  OrganizationStatus,
  SubscriptionTier,

  // Organization interfaces
  Organization,
  OrganizationLimits,
  OrganizationSettings,
  OrganizationBranding,
  OrganizationFeatures,
  Address,
  GradingScale,

  // Class types
  ClassType,
  Class,
  ClassSchedule,
  ClassSettings,

  // Role and permission types
  RoleType,
  PermissionCategory,
  PermissionAction,
  PermissionScope,
  Permission,
  Role,

  // Membership types
  OrganizationMembership,
  ClassMembership,
  ParentStudentLink,

  // Invitation types
  InvitationType,
  Invitation,
  BulkImport,

  // Audit and compliance
  AuditLogEntry,
  DataAccessRequest,

  // Integration types
  OrganizationApiKey,
  Webhook,
} from './organization-types';

// =============================================================================
// DEFAULT CONFIGURATION EXPORTS
// =============================================================================

export {
  DEFAULT_LIMITS,
  DEFAULT_ROLE_PERMISSIONS,
  DEFAULT_ORGANIZATION_SETTINGS,
  DEFAULT_ORGANIZATION_BRANDING,
  DEFAULT_FEATURES_BY_TIER,
} from './organization-types';

// =============================================================================
// MANAGEMENT FUNCTION EXPORTS
// =============================================================================

export {
  // Organization CRUD
  createOrganization,
  updateOrganization,
  deleteOrganization,

  // Class management
  createClass,
  enrollStudentInClass,
  removeStudentFromClass,

  // Membership management
  createOrganizationMembership,
  createClassMembership,
  updateMemberRole,

  // Parent-student linking
  linkParentToStudent,
  verifyParentStudentLink,

  // Invitations
  createInvitation,
  acceptInvitation,

  // Permission checking
  checkPermission,
  canAccessResource,
  getAccessibleResources,

  // Hierarchy utilities
  getAncestorOrganizations,
  getDescendantOrganizations,

  // Audit logging
  logAuditEvent,
  getAuditLogs,

  // Subscription management
  upgradeSubscription,
  isFeatureEnabled,
} from './organization-management';

// =============================================================================
// DATABASE INTEGRATION EXPORTS
// =============================================================================

export {
  // Organization queries
  getOrganizationById,
  getOrganizationBySlug,
  getOrganizationsForUser,
  getChildOrganizations,
  insertOrganization,

  // Class queries
  getClassById,
  getClassByCode,
  getClassesForOrganization,
  getClassesForUser,
  getClassCount,
  insertClass,
  updateClass,

  // Membership queries
  getOrganizationMembership,
  getOrganizationMembers,
  getOrganizationOwnerCount,
  insertOrganizationMembership,
  updateOrganizationMembership,
  getClassMembership,
  getClassMembers,
  insertClassMembership,
  updateClassMembership,

  // Parent-student queries
  getParentStudentLink,
  getParentStudentLinkById,
  getStudentsForParent,
  insertParentStudentLink,
  updateParentStudentLink,

  // Invitation queries
  getPendingInvitation,
  getInvitationByToken,
  insertInvitation,
  updateInvitation,

  // Audit queries
  insertAuditLogEntry,
  queryAuditLogs,

  // Role queries
  getRoleById,
  getCustomRolePermissions,
  insertRole,
  createDefaultRolesForOrganization,
} from './organization-integration';

// =============================================================================
// CONVENIENCE UTILITIES
// =============================================================================

/**
 * Quick check if user is an admin of an organization
 */
export async function isOrganizationAdmin(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const { checkPermission } = await import('./organization-management');
  return checkPermission(userId, organizationId, 'organization', 'update');
}

/**
 * Quick check if user is a member of an organization
 */
export async function isOrganizationMember(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const { getOrganizationMembership } = await import('./organization-integration');
  const membership = await getOrganizationMembership(organizationId, userId);
  return membership !== null && membership.status === 'active';
}

/**
 * Quick check if user is enrolled in a class
 */
export async function isClassMember(
  userId: string,
  classId: string
): Promise<boolean> {
  const { getClassMembership } = await import('./organization-integration');
  const membership = await getClassMembership(classId, userId);
  return membership !== null && membership.status === 'active';
}

/**
 * Get user's role in an organization
 */
export async function getUserRole(
  userId: string,
  organizationId: string
): Promise<string | null> {
  const { getOrganizationMembership } = await import('./organization-integration');
  const membership = await getOrganizationMembership(organizationId, userId);
  return membership?.roleType || null;
}

/**
 * Check if organization has feature enabled
 */
export async function hasFeature(
  organizationId: string,
  feature: string
): Promise<boolean> {
  const { getOrganizationById } = await import('./organization-integration');
  const org = await getOrganizationById(organizationId);
  if (!org) return false;
  return (org.features as Record<string, boolean>)[feature] === true;
}

/**
 * Get organization's current usage stats
 */
export async function getOrganizationUsage(organizationId: string): Promise<{
  students: { current: number; limit: number };
  teachers: { current: number; limit: number };
  classes: { current: number; limit: number };
  storage: { current: number; limit: number };
}> {
  const { getOrganizationById, getClassCount, getOrganizationMembers } = await import('./organization-integration');

  const org = await getOrganizationById(organizationId);
  if (!org) {
    return {
      students: { current: 0, limit: 0 },
      teachers: { current: 0, limit: 0 },
      classes: { current: 0, limit: 0 },
      storage: { current: 0, limit: 0 },
    };
  }

  const members = await getOrganizationMembers(organizationId, { status: 'active' });
  const classCount = await getClassCount(organizationId);

  const studentCount = members.filter(m => m.roleType === 'student').length;
  const teacherCount = members.filter(m =>
    ['teacher', 'teaching_assistant', 'principal', 'department_head'].includes(m.roleType)
  ).length;

  return {
    students: { current: studentCount, limit: org.limits.maxStudents },
    teachers: { current: teacherCount, limit: org.limits.maxTeachers },
    classes: { current: classCount, limit: org.limits.maxClasses },
    storage: { current: 0, limit: org.limits.storageGb * 1024 * 1024 * 1024 }, // Convert GB to bytes
  };
}

// =============================================================================
// EXPORT DEFAULT
// =============================================================================

export default {
  // Convenience utilities
  isOrganizationAdmin,
  isOrganizationMember,
  isClassMember,
  getUserRole,
  hasFeature,
  getOrganizationUsage,
};
