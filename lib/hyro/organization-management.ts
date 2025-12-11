/**
 * Organization Management Service - Hyro Education System
 *
 * @hyro-domain multi_tenancy
 * @hyro-manifold Provides organization hierarchy and access control
 * @hyro-rationale Enables scalable B2B model for families, schools, and districts
 *
 * PURPOSE:
 * Manages the complete lifecycle of organizations in the Hyro system,
 * including creation, membership, permissions, and hierarchical relationships.
 */

import {
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
  DataAccessRequest,
  OrganizationApiKey,
  Webhook,
  DEFAULT_LIMITS,
  DEFAULT_ROLE_PERMISSIONS,
  DEFAULT_ORGANIZATION_SETTINGS,
  DEFAULT_ORGANIZATION_BRANDING,
  DEFAULT_FEATURES_BY_TIER,
} from './organization-types';

// =============================================================================
// ORGANIZATION CRUD OPERATIONS
// =============================================================================

/**
 * Create a new organization
 */
export async function createOrganization(params: {
  name: string;
  slug: string;
  type: OrganizationType;
  parentOrganizationId?: string;
  subscriptionTier?: SubscriptionTier;
  ownerId: string;
  settings?: Partial<OrganizationSettings>;
  branding?: Partial<OrganizationBranding>;
}): Promise<{
  success: boolean;
  organization?: Organization;
  error?: string;
}> {
  const {
    name,
    slug,
    type,
    parentOrganizationId,
    subscriptionTier = 'free',
    ownerId,
    settings = {},
    branding = {},
  } = params;

  // Validate slug uniqueness
  const existingOrg = await getOrganizationBySlug(slug);
  if (existingOrg) {
    return { success: false, error: 'Organization slug already exists' };
  }

  // Validate parent organization if provided
  if (parentOrganizationId) {
    const parentOrg = await getOrganizationById(parentOrganizationId);
    if (!parentOrg) {
      return { success: false, error: 'Parent organization not found' };
    }
    // Validate hierarchy (e.g., school can only be under district)
    const validHierarchy = validateOrganizationHierarchy(type, parentOrg.type);
    if (!validHierarchy) {
      return { success: false, error: `Invalid hierarchy: ${type} cannot be under ${parentOrg.type}` };
    }
  }

  // Determine hierarchy depth
  const depth = parentOrganizationId
    ? await getOrganizationDepth(parentOrganizationId) + 1
    : 0;

  // Create organization object
  const organization: Organization = {
    id: generateOrganizationId(),
    slug,
    name,
    type,
    status: 'active',
    parentOrganizationId: parentOrganizationId || null,
    childOrganizationIds: [],
    depth,
    subscriptionTier,
    subscriptionStatus: 'active',
    subscriptionStartDate: new Date(),
    subscriptionEndDate: null,
    trialEndsAt: subscriptionTier === 'free' ? null : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 day trial
    limits: { ...DEFAULT_LIMITS[subscriptionTier] },
    settings: { ...DEFAULT_ORGANIZATION_SETTINGS, ...settings },
    branding: { ...DEFAULT_ORGANIZATION_BRANDING, ...branding },
    features: { ...DEFAULT_FEATURES_BY_TIER[subscriptionTier] },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: ownerId,
  };

  // TODO: Insert into database
  // await db.organizations.insert(organization);

  // Create owner membership
  await createOrganizationMembership({
    organizationId: organization.id,
    userId: ownerId,
    roleType: 'org_owner',
  });

  // Update parent's child list if applicable
  if (parentOrganizationId) {
    await addChildOrganization(parentOrganizationId, organization.id);
  }

  // Log audit event
  await logAuditEvent({
    organizationId: organization.id,
    userId: ownerId,
    action: 'organization.created',
    resourceType: 'organization',
    resourceId: organization.id,
    details: { name, type, subscriptionTier },
  });

  return { success: true, organization };
}

/**
 * Update an organization
 */
export async function updateOrganization(
  organizationId: string,
  userId: string,
  updates: Partial<Pick<Organization, 'name' | 'settings' | 'branding' | 'status'>>
): Promise<{
  success: boolean;
  organization?: Organization;
  error?: string;
}> {
  // Check permission
  const hasPermission = await checkPermission(userId, organizationId, 'organization', 'update');
  if (!hasPermission) {
    return { success: false, error: 'Permission denied' };
  }

  const organization = await getOrganizationById(organizationId);
  if (!organization) {
    return { success: false, error: 'Organization not found' };
  }

  const updatedOrganization: Organization = {
    ...organization,
    ...updates,
    settings: updates.settings
      ? { ...organization.settings, ...updates.settings }
      : organization.settings,
    branding: updates.branding
      ? { ...organization.branding, ...updates.branding }
      : organization.branding,
    updatedAt: new Date(),
  };

  // TODO: Update in database
  // await db.organizations.update(organizationId, updatedOrganization);

  await logAuditEvent({
    organizationId,
    userId,
    action: 'organization.updated',
    resourceType: 'organization',
    resourceId: organizationId,
    details: { updates },
    previousValue: organization,
    newValue: updatedOrganization,
  });

  return { success: true, organization: updatedOrganization };
}

/**
 * Delete (soft) an organization
 */
export async function deleteOrganization(
  organizationId: string,
  userId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  const hasPermission = await checkPermission(userId, organizationId, 'organization', 'delete');
  if (!hasPermission) {
    return { success: false, error: 'Permission denied' };
  }

  const organization = await getOrganizationById(organizationId);
  if (!organization) {
    return { success: false, error: 'Organization not found' };
  }

  // Check for child organizations
  if (organization.childOrganizationIds.length > 0) {
    return { success: false, error: 'Cannot delete organization with child organizations' };
  }

  // Soft delete - set status to deleted
  // TODO: Update in database
  // await db.organizations.update(organizationId, { status: 'deleted', deletedAt: new Date() });

  // Remove from parent's child list
  if (organization.parentOrganizationId) {
    await removeChildOrganization(organization.parentOrganizationId, organizationId);
  }

  await logAuditEvent({
    organizationId,
    userId,
    action: 'organization.deleted',
    resourceType: 'organization',
    resourceId: organizationId,
    details: { name: organization.name },
  });

  return { success: true };
}

// =============================================================================
// CLASS MANAGEMENT
// =============================================================================

/**
 * Create a new class
 */
export async function createClass(params: {
  organizationId: string;
  name: string;
  type: ClassType;
  subject?: string;
  gradeLevel?: string;
  teacherId: string;
  createdBy: string;
  settings?: Partial<Class['settings']>;
  schedule?: Partial<Class['schedule']>;
}): Promise<{
  success: boolean;
  class?: Class;
  error?: string;
}> {
  const {
    organizationId,
    name,
    type,
    subject,
    gradeLevel,
    teacherId,
    createdBy,
    settings = {},
    schedule,
  } = params;

  // Check permission
  const hasPermission = await checkPermission(createdBy, organizationId, 'class', 'create');
  if (!hasPermission) {
    return { success: false, error: 'Permission denied' };
  }

  // Check organization limits
  const org = await getOrganizationById(organizationId);
  if (!org) {
    return { success: false, error: 'Organization not found' };
  }

  const currentClassCount = await getClassCount(organizationId);
  if (currentClassCount >= org.limits.maxClasses) {
    return { success: false, error: 'Class limit reached for this organization' };
  }

  // Generate unique code
  const code = generateClassCode();

  const newClass: Class = {
    id: generateClassId(),
    organizationId,
    name,
    code,
    type,
    subject: subject || null,
    gradeLevel: gradeLevel || null,
    academicYear: getCurrentAcademicYear(),
    term: getCurrentTerm(),
    teacherIds: [teacherId],
    studentIds: [],
    parentObserverIds: [],
    schedule: schedule || null,
    settings: {
      allowSelfEnroll: false,
      requireApproval: true,
      visibleToOrganization: true,
      shareProgressWithParents: true,
      allowPeerCollaboration: false,
      maxStudents: 30,
      ...settings,
    },
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy,
  };

  // TODO: Insert into database
  // await db.classes.insert(newClass);

  // Create teacher membership
  await createClassMembership({
    classId: newClass.id,
    userId: teacherId,
    role: 'lead_teacher',
    addedBy: createdBy,
  });

  await logAuditEvent({
    organizationId,
    userId: createdBy,
    action: 'class.created',
    resourceType: 'class',
    resourceId: newClass.id,
    details: { name, type, subject, gradeLevel },
  });

  return { success: true, class: newClass };
}

/**
 * Enroll a student in a class
 */
export async function enrollStudentInClass(params: {
  classId: string;
  studentId: string;
  enrolledBy: string;
  role?: ClassMembership['role'];
}): Promise<{
  success: boolean;
  membership?: ClassMembership;
  error?: string;
}> {
  const { classId, studentId, enrolledBy, role = 'student' } = params;

  const classData = await getClassById(classId);
  if (!classData) {
    return { success: false, error: 'Class not found' };
  }

  // Check permission
  const hasPermission = await checkPermission(enrolledBy, classData.organizationId, 'class', 'update');
  if (!hasPermission) {
    return { success: false, error: 'Permission denied' };
  }

  // Check if student is already enrolled
  if (classData.studentIds.includes(studentId)) {
    return { success: false, error: 'Student already enrolled in this class' };
  }

  // Check class capacity
  if (classData.studentIds.length >= classData.settings.maxStudents) {
    return { success: false, error: 'Class is at maximum capacity' };
  }

  const membership = await createClassMembership({
    classId,
    userId: studentId,
    role,
    addedBy: enrolledBy,
  });

  // Update class student list
  // TODO: Update in database
  // await db.classes.update(classId, { studentIds: [...classData.studentIds, studentId] });

  await logAuditEvent({
    organizationId: classData.organizationId,
    userId: enrolledBy,
    action: 'class.student_enrolled',
    resourceType: 'class',
    resourceId: classId,
    details: { studentId, role },
  });

  return { success: true, membership };
}

/**
 * Remove a student from a class
 */
export async function removeStudentFromClass(params: {
  classId: string;
  studentId: string;
  removedBy: string;
  reason?: string;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  const { classId, studentId, removedBy, reason } = params;

  const classData = await getClassById(classId);
  if (!classData) {
    return { success: false, error: 'Class not found' };
  }

  // Check permission
  const hasPermission = await checkPermission(removedBy, classData.organizationId, 'class', 'update');
  if (!hasPermission) {
    return { success: false, error: 'Permission denied' };
  }

  // Check if student is enrolled
  if (!classData.studentIds.includes(studentId)) {
    return { success: false, error: 'Student not enrolled in this class' };
  }

  // Deactivate membership
  await deactivateClassMembership(classId, studentId, removedBy);

  // Update class student list
  // TODO: Update in database
  // await db.classes.update(classId, {
  //   studentIds: classData.studentIds.filter(id => id !== studentId)
  // });

  await logAuditEvent({
    organizationId: classData.organizationId,
    userId: removedBy,
    action: 'class.student_removed',
    resourceType: 'class',
    resourceId: classId,
    details: { studentId, reason },
  });

  return { success: true };
}

// =============================================================================
// MEMBERSHIP MANAGEMENT
// =============================================================================

/**
 * Create organization membership
 */
export async function createOrganizationMembership(params: {
  organizationId: string;
  userId: string;
  roleType: RoleType;
  customRoleId?: string;
  addedBy?: string;
}): Promise<OrganizationMembership> {
  const { organizationId, userId, roleType, customRoleId, addedBy } = params;

  // Get effective permissions for this role
  const effectivePermissions = customRoleId
    ? await getCustomRolePermissions(customRoleId)
    : DEFAULT_ROLE_PERMISSIONS[roleType] || [];

  const membership: OrganizationMembership = {
    id: generateMembershipId(),
    organizationId,
    userId,
    roleId: customRoleId || roleType,
    roleType,
    status: 'active',
    effectivePermissions,
    joinedAt: new Date(),
    invitedBy: addedBy || null,
    lastActiveAt: new Date(),
  };

  // TODO: Insert into database
  // await db.organization_memberships.insert(membership);

  return membership;
}

/**
 * Create class membership
 */
export async function createClassMembership(params: {
  classId: string;
  userId: string;
  role: ClassMembership['role'];
  addedBy: string;
}): Promise<ClassMembership> {
  const { classId, userId, role, addedBy } = params;

  const membership: ClassMembership = {
    id: generateMembershipId(),
    classId,
    userId,
    role,
    status: 'active',
    enrolledAt: new Date(),
    addedBy,
    permissions: getDefaultClassPermissions(role),
  };

  // TODO: Insert into database
  // await db.class_memberships.insert(membership);

  return membership;
}

/**
 * Deactivate class membership
 */
async function deactivateClassMembership(
  classId: string,
  userId: string,
  removedBy: string
): Promise<void> {
  // TODO: Update in database
  // await db.class_memberships.update(
  //   { classId, userId },
  //   { status: 'removed', removedAt: new Date(), removedBy }
  // );
}

/**
 * Update a user's role in an organization
 */
export async function updateMemberRole(params: {
  organizationId: string;
  userId: string;
  newRoleType: RoleType;
  customRoleId?: string;
  updatedBy: string;
}): Promise<{
  success: boolean;
  membership?: OrganizationMembership;
  error?: string;
}> {
  const { organizationId, userId, newRoleType, customRoleId, updatedBy } = params;

  // Check permission
  const hasPermission = await checkPermission(updatedBy, organizationId, 'member', 'update');
  if (!hasPermission) {
    return { success: false, error: 'Permission denied' };
  }

  // Get existing membership
  const membership = await getOrganizationMembership(organizationId, userId);
  if (!membership) {
    return { success: false, error: 'Membership not found' };
  }

  // Cannot demote owner unless there's another owner
  if (membership.roleType === 'org_owner' && newRoleType !== 'org_owner') {
    const ownerCount = await getOrganizationOwnerCount(organizationId);
    if (ownerCount <= 1) {
      return { success: false, error: 'Cannot remove the only owner' };
    }
  }

  const effectivePermissions = customRoleId
    ? await getCustomRolePermissions(customRoleId)
    : DEFAULT_ROLE_PERMISSIONS[newRoleType] || [];

  const updatedMembership: OrganizationMembership = {
    ...membership,
    roleType: newRoleType,
    roleId: customRoleId || newRoleType,
    effectivePermissions,
  };

  // TODO: Update in database
  // await db.organization_memberships.update(membership.id, updatedMembership);

  await logAuditEvent({
    organizationId,
    userId: updatedBy,
    action: 'member.role_updated',
    resourceType: 'membership',
    resourceId: membership.id,
    details: { userId, previousRole: membership.roleType, newRole: newRoleType },
  });

  return { success: true, membership: updatedMembership };
}

// =============================================================================
// PARENT-STUDENT LINKING
// =============================================================================

/**
 * Link a parent to a student
 */
export async function linkParentToStudent(params: {
  parentId: string;
  studentId: string;
  relationship: ParentStudentLink['relationship'];
  linkedBy: string;
  organizationId: string;
  permissions?: Partial<ParentStudentLink['permissions']>;
}): Promise<{
  success: boolean;
  link?: ParentStudentLink;
  error?: string;
}> {
  const {
    parentId,
    studentId,
    relationship,
    linkedBy,
    organizationId,
    permissions = {},
  } = params;

  // Check permission
  const hasPermission = await checkPermission(linkedBy, organizationId, 'student', 'update');
  if (!hasPermission) {
    return { success: false, error: 'Permission denied' };
  }

  // Check if link already exists
  const existingLink = await getParentStudentLink(parentId, studentId);
  if (existingLink && existingLink.status === 'active') {
    return { success: false, error: 'Parent-student link already exists' };
  }

  const link: ParentStudentLink = {
    id: generateLinkId(),
    parentId,
    studentId,
    relationship,
    status: 'active',
    permissions: {
      viewProgress: true,
      viewGrades: true,
      viewAttendance: true,
      receiveNotifications: true,
      communicateWithTeachers: true,
      viewDetailedAnalytics: false,
      manageAccount: relationship === 'parent' || relationship === 'legal_guardian',
      ...permissions,
    },
    linkedAt: new Date(),
    linkedBy,
    verifiedAt: null,
    verificationMethod: null,
  };

  // TODO: Insert into database
  // await db.parent_student_links.insert(link);

  await logAuditEvent({
    organizationId,
    userId: linkedBy,
    action: 'parent.student_linked',
    resourceType: 'parent_student_link',
    resourceId: link.id,
    details: { parentId, studentId, relationship },
  });

  return { success: true, link };
}

/**
 * Verify a parent-student link
 */
export async function verifyParentStudentLink(params: {
  linkId: string;
  verifiedBy: string;
  verificationMethod: ParentStudentLink['verificationMethod'];
  organizationId: string;
}): Promise<{
  success: boolean;
  link?: ParentStudentLink;
  error?: string;
}> {
  const { linkId, verifiedBy, verificationMethod, organizationId } = params;

  // Check permission (usually school admin)
  const hasPermission = await checkPermission(verifiedBy, organizationId, 'student', 'update');
  if (!hasPermission) {
    return { success: false, error: 'Permission denied' };
  }

  const link = await getParentStudentLinkById(linkId);
  if (!link) {
    return { success: false, error: 'Link not found' };
  }

  const updatedLink: ParentStudentLink = {
    ...link,
    verifiedAt: new Date(),
    verificationMethod,
  };

  // TODO: Update in database
  // await db.parent_student_links.update(linkId, updatedLink);

  await logAuditEvent({
    organizationId,
    userId: verifiedBy,
    action: 'parent.link_verified',
    resourceType: 'parent_student_link',
    resourceId: linkId,
    details: { verificationMethod },
  });

  return { success: true, link: updatedLink };
}

// =============================================================================
// INVITATION SYSTEM
// =============================================================================

/**
 * Create an invitation
 */
export async function createInvitation(params: {
  organizationId: string;
  email: string;
  type: InvitationType;
  roleType: RoleType;
  classIds?: string[];
  createdBy: string;
  expiresInDays?: number;
  message?: string;
}): Promise<{
  success: boolean;
  invitation?: Invitation;
  error?: string;
}> {
  const {
    organizationId,
    email,
    type,
    roleType,
    classIds = [],
    createdBy,
    expiresInDays = 7,
    message,
  } = params;

  // Check permission
  const hasPermission = await checkPermission(createdBy, organizationId, 'invitation', 'create');
  if (!hasPermission) {
    return { success: false, error: 'Permission denied' };
  }

  // Check organization limits
  const org = await getOrganizationById(organizationId);
  if (!org) {
    return { success: false, error: 'Organization not found' };
  }

  // Check if already invited
  const existingInvitation = await getPendingInvitation(organizationId, email);
  if (existingInvitation) {
    return { success: false, error: 'User already has a pending invitation' };
  }

  const invitation: Invitation = {
    id: generateInvitationId(),
    organizationId,
    email,
    type,
    roleType,
    classIds,
    token: generateSecureToken(),
    status: 'pending',
    createdAt: new Date(),
    createdBy,
    expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
    message: message || null,
  };

  // TODO: Insert into database
  // await db.invitations.insert(invitation);

  // TODO: Send invitation email
  // await sendInvitationEmail(invitation);

  await logAuditEvent({
    organizationId,
    userId: createdBy,
    action: 'invitation.created',
    resourceType: 'invitation',
    resourceId: invitation.id,
    details: { email, type, roleType },
  });

  return { success: true, invitation };
}

/**
 * Accept an invitation
 */
export async function acceptInvitation(params: {
  token: string;
  userId: string;
}): Promise<{
  success: boolean;
  organizationId?: string;
  error?: string;
}> {
  const { token, userId } = params;

  const invitation = await getInvitationByToken(token);
  if (!invitation) {
    return { success: false, error: 'Invalid invitation token' };
  }

  if (invitation.status !== 'pending') {
    return { success: false, error: 'Invitation is no longer valid' };
  }

  if (new Date() > invitation.expiresAt) {
    return { success: false, error: 'Invitation has expired' };
  }

  // Create organization membership
  await createOrganizationMembership({
    organizationId: invitation.organizationId,
    userId,
    roleType: invitation.roleType,
    addedBy: invitation.createdBy,
  });

  // Create class memberships if applicable
  for (const classId of invitation.classIds) {
    const classRole = invitation.roleType === 'teacher' ? 'co_teacher' : 'student';
    await createClassMembership({
      classId,
      userId,
      role: classRole,
      addedBy: invitation.createdBy,
    });
  }

  // Update invitation status
  // TODO: Update in database
  // await db.invitations.update(invitation.id, {
  //   status: 'accepted',
  //   acceptedAt: new Date(),
  //   acceptedBy: userId
  // });

  await logAuditEvent({
    organizationId: invitation.organizationId,
    userId,
    action: 'invitation.accepted',
    resourceType: 'invitation',
    resourceId: invitation.id,
    details: { type: invitation.type, roleType: invitation.roleType },
  });

  return { success: true, organizationId: invitation.organizationId };
}

// =============================================================================
// PERMISSION CHECKING
// =============================================================================

/**
 * Check if a user has a specific permission
 */
export async function checkPermission(
  userId: string,
  organizationId: string,
  category: PermissionCategory,
  action: PermissionAction,
  resourceId?: string
): Promise<boolean> {
  // Get user's membership
  const membership = await getOrganizationMembership(organizationId, userId);
  if (!membership || membership.status !== 'active') {
    return false;
  }

  // Super admin always has permission
  if (membership.roleType === 'super_admin') {
    return true;
  }

  // Check effective permissions
  const requiredPermission: Permission = {
    category,
    action,
    scope: resourceId ? 'own' : 'all',
  };

  return membership.effectivePermissions.some(p =>
    p.category === requiredPermission.category &&
    p.action === requiredPermission.action &&
    (p.scope === 'all' || p.scope === requiredPermission.scope)
  );
}

/**
 * Check if user can access a specific resource
 */
export async function canAccessResource(params: {
  userId: string;
  organizationId: string;
  resourceType: PermissionCategory;
  resourceId: string;
  action: PermissionAction;
}): Promise<boolean> {
  const { userId, organizationId, resourceType, resourceId, action } = params;

  // First check basic permission
  const hasPermission = await checkPermission(userId, organizationId, resourceType, action, resourceId);
  if (!hasPermission) {
    return false;
  }

  // Check scope-specific access
  const membership = await getOrganizationMembership(organizationId, userId);
  if (!membership) return false;

  const permission = membership.effectivePermissions.find(
    p => p.category === resourceType && p.action === action
  );

  if (!permission) return false;

  // 'all' scope can access everything
  if (permission.scope === 'all') return true;

  // 'own' scope needs ownership check
  if (permission.scope === 'own') {
    return await isResourceOwner(userId, resourceType, resourceId);
  }

  // 'class' scope needs class membership check
  if (permission.scope === 'class') {
    return await isInSameClass(userId, resourceId);
  }

  return false;
}

/**
 * Get all resources a user can access
 */
export async function getAccessibleResources(params: {
  userId: string;
  organizationId: string;
  resourceType: PermissionCategory;
  action: PermissionAction;
}): Promise<string[]> {
  const { userId, organizationId, resourceType, action } = params;

  const membership = await getOrganizationMembership(organizationId, userId);
  if (!membership || membership.status !== 'active') {
    return [];
  }

  const permission = membership.effectivePermissions.find(
    p => p.category === resourceType && p.action === action
  );

  if (!permission) return [];

  // Based on scope, return appropriate resources
  switch (permission.scope) {
    case 'all':
      return await getAllResourcesInOrganization(organizationId, resourceType);
    case 'own':
      return await getOwnedResources(userId, resourceType);
    case 'class':
      return await getClassResources(userId, resourceType);
    default:
      return [];
  }
}

// =============================================================================
// HIERARCHY UTILITIES
// =============================================================================

/**
 * Validate organization hierarchy
 */
function validateOrganizationHierarchy(
  childType: OrganizationType,
  parentType: OrganizationType
): boolean {
  const validHierarchies: Record<OrganizationType, OrganizationType[]> = {
    state_system: [],  // Top level only
    district: ['state_system'],
    public_school: ['district', 'state_system'],
    private_school: ['district'],
    homeschool_coop: [],  // Top level or under district
    tutoring_center: ['district'],
    family: [],  // Top level
    nonprofit: [],
    corporate: [],
    other: [],
  };

  if (validHierarchies[childType].length === 0) {
    return true; // Can be top level
  }

  return validHierarchies[childType].includes(parentType);
}

/**
 * Get organization depth in hierarchy
 */
async function getOrganizationDepth(organizationId: string): Promise<number> {
  const org = await getOrganizationById(organizationId);
  return org?.depth || 0;
}

/**
 * Get all ancestor organizations
 */
export async function getAncestorOrganizations(organizationId: string): Promise<Organization[]> {
  const ancestors: Organization[] = [];
  let currentOrg = await getOrganizationById(organizationId);

  while (currentOrg?.parentOrganizationId) {
    const parent = await getOrganizationById(currentOrg.parentOrganizationId);
    if (parent) {
      ancestors.push(parent);
      currentOrg = parent;
    } else {
      break;
    }
  }

  return ancestors;
}

/**
 * Get all descendant organizations
 */
export async function getDescendantOrganizations(organizationId: string): Promise<Organization[]> {
  const descendants: Organization[] = [];
  const org = await getOrganizationById(organizationId);

  if (!org) return descendants;

  async function collectDescendants(orgId: string): Promise<void> {
    const current = await getOrganizationById(orgId);
    if (!current) return;

    for (const childId of current.childOrganizationIds) {
      const child = await getOrganizationById(childId);
      if (child) {
        descendants.push(child);
        await collectDescendants(childId);
      }
    }
  }

  await collectDescendants(organizationId);
  return descendants;
}

// =============================================================================
// AUDIT LOGGING
// =============================================================================

/**
 * Log an audit event
 */
export async function logAuditEvent(params: {
  organizationId: string;
  userId: string;
  action: string;
  resourceType: AuditLogEntry['resourceType'];
  resourceId: string;
  details?: Record<string, unknown>;
  previousValue?: unknown;
  newValue?: unknown;
}): Promise<AuditLogEntry> {
  const {
    organizationId,
    userId,
    action,
    resourceType,
    resourceId,
    details = {},
    previousValue,
    newValue,
  } = params;

  const entry: AuditLogEntry = {
    id: generateAuditId(),
    organizationId,
    userId,
    action,
    resourceType,
    resourceId,
    details,
    previousValue: previousValue || null,
    newValue: newValue || null,
    ipAddress: null, // Would be populated from request context
    userAgent: null, // Would be populated from request context
    timestamp: new Date(),
  };

  // TODO: Insert into database
  // await db.audit_logs.insert(entry);

  return entry;
}

/**
 * Get audit logs for an organization
 */
export async function getAuditLogs(params: {
  organizationId: string;
  userId?: string;
  resourceType?: AuditLogEntry['resourceType'];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<{
  entries: AuditLogEntry[];
  total: number;
}> {
  // TODO: Query from database with filters
  // const entries = await db.audit_logs.find({ ...params });
  // const total = await db.audit_logs.count({ ...params });

  return { entries: [], total: 0 };
}

// =============================================================================
// SUBSCRIPTION MANAGEMENT
// =============================================================================

/**
 * Upgrade organization subscription
 */
export async function upgradeSubscription(params: {
  organizationId: string;
  newTier: SubscriptionTier;
  userId: string;
}): Promise<{
  success: boolean;
  organization?: Organization;
  error?: string;
}> {
  const { organizationId, newTier, userId } = params;

  const hasPermission = await checkPermission(userId, organizationId, 'organization', 'update');
  if (!hasPermission) {
    return { success: false, error: 'Permission denied' };
  }

  const org = await getOrganizationById(organizationId);
  if (!org) {
    return { success: false, error: 'Organization not found' };
  }

  const updatedOrg: Organization = {
    ...org,
    subscriptionTier: newTier,
    limits: { ...DEFAULT_LIMITS[newTier] },
    features: { ...DEFAULT_FEATURES_BY_TIER[newTier] },
    updatedAt: new Date(),
  };

  // TODO: Update in database
  // await db.organizations.update(organizationId, updatedOrg);

  await logAuditEvent({
    organizationId,
    userId,
    action: 'organization.subscription_upgraded',
    resourceType: 'organization',
    resourceId: organizationId,
    details: { previousTier: org.subscriptionTier, newTier },
  });

  return { success: true, organization: updatedOrg };
}

/**
 * Check if feature is enabled for organization
 */
export async function isFeatureEnabled(
  organizationId: string,
  feature: keyof OrganizationFeatures
): Promise<boolean> {
  const org = await getOrganizationById(organizationId);
  if (!org) return false;
  return org.features[feature] === true;
}

// =============================================================================
// HELPER FUNCTIONS (Stubs - to be implemented with actual database)
// =============================================================================

// These functions would be implemented with actual database queries

async function getOrganizationById(id: string): Promise<Organization | null> {
  // TODO: Implement with database
  return null;
}

async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  // TODO: Implement with database
  return null;
}

async function getClassById(id: string): Promise<Class | null> {
  // TODO: Implement with database
  return null;
}

async function getClassCount(organizationId: string): Promise<number> {
  // TODO: Implement with database
  return 0;
}

async function getOrganizationMembership(
  organizationId: string,
  userId: string
): Promise<OrganizationMembership | null> {
  // TODO: Implement with database
  return null;
}

async function getOrganizationOwnerCount(organizationId: string): Promise<number> {
  // TODO: Implement with database
  return 0;
}

async function getCustomRolePermissions(roleId: string): Promise<Permission[]> {
  // TODO: Implement with database
  return [];
}

async function getParentStudentLink(
  parentId: string,
  studentId: string
): Promise<ParentStudentLink | null> {
  // TODO: Implement with database
  return null;
}

async function getParentStudentLinkById(id: string): Promise<ParentStudentLink | null> {
  // TODO: Implement with database
  return null;
}

async function getPendingInvitation(
  organizationId: string,
  email: string
): Promise<Invitation | null> {
  // TODO: Implement with database
  return null;
}

async function getInvitationByToken(token: string): Promise<Invitation | null> {
  // TODO: Implement with database
  return null;
}

async function addChildOrganization(parentId: string, childId: string): Promise<void> {
  // TODO: Implement with database
}

async function removeChildOrganization(parentId: string, childId: string): Promise<void> {
  // TODO: Implement with database
}

async function isResourceOwner(
  userId: string,
  resourceType: PermissionCategory,
  resourceId: string
): Promise<boolean> {
  // TODO: Implement with database
  return false;
}

async function isInSameClass(userId: string, resourceId: string): Promise<boolean> {
  // TODO: Implement with database
  return false;
}

async function getAllResourcesInOrganization(
  organizationId: string,
  resourceType: PermissionCategory
): Promise<string[]> {
  // TODO: Implement with database
  return [];
}

async function getOwnedResources(
  userId: string,
  resourceType: PermissionCategory
): Promise<string[]> {
  // TODO: Implement with database
  return [];
}

async function getClassResources(
  userId: string,
  resourceType: PermissionCategory
): Promise<string[]> {
  // TODO: Implement with database
  return [];
}

function getDefaultClassPermissions(role: ClassMembership['role']): Permission[] {
  const permissions: Record<ClassMembership['role'], Permission[]> = {
    lead_teacher: [
      { category: 'class', action: 'read', scope: 'all' },
      { category: 'class', action: 'update', scope: 'all' },
      { category: 'student', action: 'read', scope: 'class' },
      { category: 'student', action: 'update', scope: 'class' },
      { category: 'report', action: 'read', scope: 'class' },
      { category: 'report', action: 'create', scope: 'class' },
    ],
    co_teacher: [
      { category: 'class', action: 'read', scope: 'all' },
      { category: 'student', action: 'read', scope: 'class' },
      { category: 'student', action: 'update', scope: 'class' },
      { category: 'report', action: 'read', scope: 'class' },
    ],
    student: [
      { category: 'class', action: 'read', scope: 'own' },
      { category: 'student', action: 'read', scope: 'own' },
    ],
    parent_observer: [
      { category: 'class', action: 'read', scope: 'own' },
      { category: 'student', action: 'read', scope: 'own' },
      { category: 'report', action: 'read', scope: 'own' },
    ],
    teaching_assistant: [
      { category: 'class', action: 'read', scope: 'all' },
      { category: 'student', action: 'read', scope: 'class' },
    ],
  };
  return permissions[role] || [];
}

// ID generators
function generateOrganizationId(): string {
  return `org_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateClassId(): string {
  return `class_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateMembershipId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateLinkId(): string {
  return `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateInvitationId(): string {
  return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateAuditId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateClassCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateSecureToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function getCurrentAcademicYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  // Academic year starts in August
  if (month >= 7) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
}

function getCurrentTerm(): string {
  const now = new Date();
  const month = now.getMonth();
  if (month >= 7 && month <= 11) return 'fall';
  if (month >= 0 && month <= 4) return 'spring';
  return 'summer';
}

export default {
  // Organization CRUD
  createOrganization,
  updateOrganization,
  deleteOrganization,

  // Class management
  createClass,
  enrollStudentInClass,
  removeStudentFromClass,

  // Membership
  createOrganizationMembership,
  createClassMembership,
  updateMemberRole,

  // Parent-student linking
  linkParentToStudent,
  verifyParentStudentLink,

  // Invitations
  createInvitation,
  acceptInvitation,

  // Permissions
  checkPermission,
  canAccessResource,
  getAccessibleResources,

  // Hierarchy
  getAncestorOrganizations,
  getDescendantOrganizations,

  // Audit
  logAuditEvent,
  getAuditLogs,

  // Subscription
  upgradeSubscription,
  isFeatureEnabled,
};
