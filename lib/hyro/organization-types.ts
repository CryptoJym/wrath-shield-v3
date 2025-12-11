/**
 * Multi-Tenant Organization Types - Hyro Education System
 *
 * @hyro-domain organization_management
 * @hyro-standards ORG-ADMIN-*, ORG-ACCESS-*, ORG-DATA-*
 * @hyro-manifold Provides tenant isolation and role-based access
 * @hyro-rationale Enables schools, districts, homeschool coops, and families to use Hyro
 *
 * PURPOSE:
 * Provides the type system for multi-tenant organization hierarchy:
 * - Organizations (schools, districts, homeschool coops, tutoring centers)
 * - Classes/Groups within organizations
 * - Role-based access control
 * - Organization-specific settings and branding
 *
 * HIERARCHY:
 * District (optional) → Organization → Class/Group → Student
 *                                    → Teacher
 *                                    → Parent (linked to students)
 *
 * SUPPORTED USE CASES:
 * - Single family homeschool
 * - Homeschool cooperative
 * - Private tutoring center
 * - Individual school
 * - School district
 * - State/Regional system
 */

// =============================================================================
// ORGANIZATION TYPES
// =============================================================================

/**
 * Types of organizations supported by the system
 */
export type OrganizationType =
  | 'family'           // Single family homeschool
  | 'homeschool_coop'  // Homeschool cooperative
  | 'tutoring_center'  // Private tutoring/learning center
  | 'private_school'   // Private/charter school
  | 'public_school'    // Public school
  | 'district'         // School district (parent org)
  | 'state_system'     // State education system
  | 'nonprofit'        // Educational nonprofit
  | 'corporate'        // Corporate training
  | 'other';

/**
 * Organization status
 */
export type OrganizationStatus =
  | 'pending'          // Awaiting approval/setup
  | 'trial'            // Trial period
  | 'active'           // Fully active
  | 'suspended'        // Temporarily suspended
  | 'archived';        // No longer active

/**
 * Subscription tier for organization features
 */
export type SubscriptionTier =
  | 'free'             // Basic features, limited students
  | 'family'           // Family plan (unlimited family members)
  | 'educator'         // Single teacher/tutor plan
  | 'school'           // School-wide access
  | 'district'         // District-wide access
  | 'enterprise';      // Custom enterprise features

/**
 * Core organization entity
 */
export interface Organization {
  id: string;                          // UUID
  slug: string;                        // URL-friendly unique identifier
  name: string;
  type: OrganizationType;
  status: OrganizationStatus;

  // Hierarchy
  parentOrganizationId: string | null; // For districts with schools
  childOrganizationIds: string[];      // Schools within district

  // Contact information
  contactEmail: string;
  contactPhone: string | null;
  address: Address | null;
  website: string | null;

  // Subscription & billing
  subscriptionTier: SubscriptionTier;
  subscriptionStartDate: Date;
  subscriptionEndDate: Date | null;
  billingEmail: string | null;

  // Limits based on subscription
  limits: OrganizationLimits;

  // Settings
  settings: OrganizationSettings;

  // Branding
  branding: OrganizationBranding;

  // Feature flags
  features: OrganizationFeatures;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;                   // User ID who created it
}

/**
 * Address structure
 */
export interface Address {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/**
 * Organization limits based on subscription tier
 */
export interface OrganizationLimits {
  maxStudents: number;                 // -1 for unlimited
  maxTeachers: number;
  maxClasses: number;
  maxAdmins: number;
  maxStorageGB: number;
  maxApiCallsPerMonth: number;
}

/**
 * Organization-specific settings
 */
export interface OrganizationSettings {
  // Academic settings
  defaultGradeLevels: string[];        // Which grades the org supports
  academicYear: {
    startMonth: number;                // 1-12
    startDay: number;
    endMonth: number;
    endDay: number;
  };
  timezone: string;

  // Standards settings
  standardsFramework: 'common_core' | 'ngss' | 'state_specific' | 'custom';
  stateCode: string | null;            // For state-specific standards
  customStandardsEnabled: boolean;

  // Assessment settings
  defaultPassingScore: number;         // 0-100
  allowRetakes: boolean;
  retakeWaitDays: number;
  gradingScale: GradingScale;

  // Communication settings
  parentPortalEnabled: boolean;
  studentMessagingEnabled: boolean;
  emailNotificationsEnabled: boolean;

  // Privacy settings
  dataRetentionDays: number;
  shareAnonymousAnalytics: boolean;
  studentDataVisibleToParents: boolean;
  showLeaderboards: boolean;

  // Learning settings
  gamificationEnabled: boolean;
  xpSystemEnabled: boolean;
  achievementsEnabled: boolean;
  adaptiveLearningEnabled: boolean;
}

/**
 * Grading scale configuration
 */
export interface GradingScale {
  type: 'letter' | 'percentage' | 'standards_based' | 'custom';
  scale: Array<{
    grade: string;              // "A", "B", "Proficient", etc.
    minScore: number;
    maxScore: number;
    gpaPoints: number | null;
  }>;
}

/**
 * Organization branding options
 */
export interface OrganizationBranding {
  logoUrl: string | null;
  iconUrl: string | null;
  primaryColor: string;               // Hex color
  secondaryColor: string;
  accentColor: string;
  fontFamily: string | null;
  customCss: string | null;           // Enterprise only
  welcomeMessage: string | null;
  loginMessage: string | null;
}

/**
 * Feature flags for organization
 */
export interface OrganizationFeatures {
  // Core features
  dashboardEnabled: boolean;
  assessmentsEnabled: boolean;
  curriculumEnabled: boolean;
  reportsEnabled: boolean;

  // Advanced features
  aiTutorEnabled: boolean;
  videoLessonsEnabled: boolean;
  liveTutoringEnabled: boolean;
  customContentEnabled: boolean;

  // Integration features
  ltiEnabled: boolean;
  ssoEnabled: boolean;
  apiAccessEnabled: boolean;
  webhooksEnabled: boolean;

  // Specialized modules
  testOutSystemEnabled: boolean;
  patternRecognitionEnabled: boolean;
  neuroscienceModuleEnabled: boolean;
  decisionFrameworkEnabled: boolean;

  // Data features
  advancedAnalyticsEnabled: boolean;
  predictiveInsightsEnabled: boolean;
  customReportsEnabled: boolean;
  dataExportEnabled: boolean;
}

// =============================================================================
// CLASS/GROUP TYPES
// =============================================================================

/**
 * Types of classes/groups
 */
export type ClassType =
  | 'homeroom'         // Primary class assignment
  | 'subject'          // Subject-specific class
  | 'intervention'     // Intervention/support group
  | 'enrichment'       // Enrichment/advanced group
  | 'advisory'         // Advisory period
  | 'study_hall'       // Study hall group
  | 'club'             // Extracurricular
  | 'custom';

/**
 * Class/Group entity
 */
export interface Class {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  type: ClassType;

  // Academic info
  subject: string | null;              // Math, ELA, Science, etc.
  gradeLevel: string | null;           // K, 1, 2, etc.
  section: string | null;              // A, B, 1, 2, etc.
  period: string | null;               // 1st period, etc.

  // Schedule (optional)
  schedule: ClassSchedule | null;

  // Settings
  settings: ClassSettings;

  // Status
  isActive: boolean;
  archivedAt: Date | null;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

/**
 * Class schedule
 */
export interface ClassSchedule {
  type: 'fixed' | 'rotating' | 'block' | 'custom';
  meetingDays: Array<0 | 1 | 2 | 3 | 4 | 5 | 6>;  // 0 = Sunday
  startTime: string;                    // "08:30"
  endTime: string;                      // "09:15"
  timezone: string;
  rotationPattern: string | null;       // For rotating schedules
}

/**
 * Class-specific settings
 */
export interface ClassSettings {
  // Assignment settings
  defaultDueDays: number;
  lateSubmissionAllowed: boolean;
  latePenaltyPercent: number;

  // Grading
  useOrganizationGradingScale: boolean;
  customGradingScale: GradingScale | null;
  weightCategories: Array<{
    category: string;
    weight: number;
  }>;

  // Learning settings
  adaptivePacingEnabled: boolean;
  peerLearningEnabled: boolean;
  discussionsEnabled: boolean;

  // Communication
  announcementsEnabled: boolean;
  parentUpdatesEnabled: boolean;
}

// =============================================================================
// ROLE & MEMBERSHIP TYPES
// =============================================================================

/**
 * Role types within the system
 */
export type RoleType =
  | 'super_admin'      // System-wide admin (Hyro team)
  | 'org_owner'        // Organization owner/creator
  | 'org_admin'        // Organization administrator
  | 'principal'        // School principal
  | 'curriculum_lead'  // Curriculum coordinator
  | 'teacher'          // Teacher/Instructor
  | 'teaching_asst'    // Teaching assistant
  | 'counselor'        // School counselor
  | 'parent'           // Parent/Guardian
  | 'student'          // Student
  | 'observer';        // Read-only observer

/**
 * Permission categories
 */
export type PermissionCategory =
  | 'organization'     // Org settings, branding, billing
  | 'users'            // User management
  | 'classes'          // Class management
  | 'curriculum'       // Curriculum and content
  | 'assessments'      // Assessment creation and grading
  | 'reports'          // Viewing and generating reports
  | 'data'             // Data export and analytics
  | 'integrations';    // Third-party integrations

/**
 * Permission action types
 */
export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'assign'
  | 'grade'
  | 'export'
  | 'admin';

/**
 * Full permission definition
 */
export interface Permission {
  category: PermissionCategory;
  action: PermissionAction;
  scope: 'own' | 'class' | 'organization' | 'all';
}

/**
 * Role definition with permissions
 */
export interface Role {
  id: string;
  organizationId: string | null;       // null for system roles
  name: string;
  type: RoleType;
  description: string;
  permissions: Permission[];
  isSystemRole: boolean;               // Can't be modified
  isDefault: boolean;                  // Assigned by default
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Organization membership - links users to organizations
 */
export interface OrganizationMembership {
  id: string;
  organizationId: string;
  userId: string;                      // Clerk user ID

  // Role assignment
  roleId: string;
  roleType: RoleType;                  // Denormalized for quick access

  // Status
  status: 'pending' | 'active' | 'suspended' | 'removed';
  invitedAt: Date | null;
  invitedBy: string | null;
  joinedAt: Date | null;

  // Custom permissions (override role)
  customPermissions: Permission[] | null;

  // Profile within organization
  title: string | null;                // "5th Grade Teacher", "Principal"
  department: string | null;
  employeeId: string | null;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Class membership - links users/students to classes
 */
export interface ClassMembership {
  id: string;
  classId: string;
  userId: string;                      // Clerk user ID

  // Role in this class
  role: 'teacher' | 'co_teacher' | 'aide' | 'student' | 'observer';

  // Status
  status: 'pending' | 'active' | 'dropped' | 'completed';
  enrolledAt: Date;
  droppedAt: Date | null;
  completedAt: Date | null;

  // For students: gradebook
  currentGrade: number | null;
  currentLetterGrade: string | null;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// STUDENT-PARENT RELATIONSHIP
// =============================================================================

/**
 * Parent-student relationship (enhanced from current system)
 */
export interface ParentStudentLink {
  id: string;
  parentUserId: string;
  studentUserId: string;
  organizationId: string;

  // Relationship
  relationship: 'parent' | 'guardian' | 'foster_parent' | 'grandparent' | 'sibling' | 'other';
  isPrimaryContact: boolean;
  canPickUp: boolean;

  // Access level
  accessLevel: 'full' | 'limited' | 'emergency_only';
  notificationsEnabled: boolean;
  canViewGrades: boolean;
  canViewAssignments: boolean;
  canMessageTeachers: boolean;
  canApproveFieldTrips: boolean;

  // Contact info
  email: string;
  phone: string | null;
  preferredContactMethod: 'email' | 'phone' | 'text' | 'app';

  // Status
  status: 'pending' | 'verified' | 'suspended';
  verifiedAt: Date | null;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// INVITATIONS
// =============================================================================

/**
 * Types of invitations
 */
export type InvitationType =
  | 'org_admin'
  | 'teacher'
  | 'parent'
  | 'student'
  | 'bulk_import';

/**
 * Invitation to join organization
 */
export interface Invitation {
  id: string;
  organizationId: string;
  classIds: string[];                  // Classes to be added to

  // Invitation details
  type: InvitationType;
  email: string;
  roleId: string;

  // For bulk imports
  bulkImportId: string | null;

  // Status
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: Date;
  acceptedAt: Date | null;
  acceptedBy: string | null;

  // Tracking
  sentAt: Date;
  sentBy: string;
  lastReminderAt: Date | null;
  reminderCount: number;

  // Metadata
  customMessage: string | null;
  metadata: Record<string, unknown> | null;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Bulk import job
 */
export interface BulkImport {
  id: string;
  organizationId: string;
  importType: 'students' | 'teachers' | 'parents' | 'all';

  // Source
  sourceType: 'csv' | 'clever' | 'classlink' | 'powerschool' | 'google_classroom';
  sourceData: string | null;           // S3 key or API reference

  // Status
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
  totalRecords: number;
  processedRecords: number;
  successfulRecords: number;
  failedRecords: number;

  // Results
  errors: Array<{
    row: number;
    field: string;
    message: string;
  }>;

  // Timestamps
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  createdBy: string;
}

// =============================================================================
// AUDIT & COMPLIANCE
// =============================================================================

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id: string;
  organizationId: string;
  userId: string;

  // Action details
  action: string;                      // 'user.created', 'class.updated', etc.
  category: PermissionCategory;
  resourceType: string;                // 'user', 'class', 'assessment', etc.
  resourceId: string;

  // Change details
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  changeDescription: string | null;

  // Context
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;

  // Timestamp
  createdAt: Date;
}

/**
 * Data access request (FERPA, GDPR compliance)
 */
export interface DataAccessRequest {
  id: string;
  organizationId: string;
  requesterId: string;
  studentId: string;

  // Request type
  type: 'view' | 'export' | 'delete' | 'rectify';
  reason: string;

  // Status
  status: 'pending' | 'approved' | 'denied' | 'completed';
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;

  // For completed requests
  completedAt: Date | null;
  exportUrl: string | null;            // Temporary download URL

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// API TYPES
// =============================================================================

/**
 * API key for organization integrations
 */
export interface OrganizationApiKey {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;

  // Key details
  keyPrefix: string;                   // First 8 chars for identification
  keyHash: string;                     // Hashed key for verification
  lastUsedAt: Date | null;

  // Permissions
  scopes: string[];                    // API scopes this key can access

  // Limits
  rateLimit: number;                   // Requests per minute
  monthlyLimit: number;                // Requests per month
  usedThisMonth: number;

  // Status
  isActive: boolean;
  expiresAt: Date | null;

  // Timestamps
  createdAt: Date;
  createdBy: string;
}

/**
 * Webhook configuration
 */
export interface Webhook {
  id: string;
  organizationId: string;
  name: string;

  // Configuration
  url: string;
  secret: string;                      // For HMAC signature
  events: string[];                    // Events to subscribe to

  // Status
  isActive: boolean;
  lastTriggeredAt: Date | null;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  consecutiveFailures: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// DEFAULTS
// =============================================================================

/**
 * Default organization limits by tier
 */
export const DEFAULT_LIMITS: Record<SubscriptionTier, OrganizationLimits> = {
  free: {
    maxStudents: 5,
    maxTeachers: 1,
    maxClasses: 2,
    maxAdmins: 1,
    maxStorageGB: 1,
    maxApiCallsPerMonth: 1000,
  },
  family: {
    maxStudents: 10,
    maxTeachers: 2,
    maxClasses: 5,
    maxAdmins: 2,
    maxStorageGB: 5,
    maxApiCallsPerMonth: 5000,
  },
  educator: {
    maxStudents: 50,
    maxTeachers: 3,
    maxClasses: 10,
    maxAdmins: 2,
    maxStorageGB: 10,
    maxApiCallsPerMonth: 10000,
  },
  school: {
    maxStudents: 1000,
    maxTeachers: 100,
    maxClasses: 200,
    maxAdmins: 10,
    maxStorageGB: 100,
    maxApiCallsPerMonth: 100000,
  },
  district: {
    maxStudents: 50000,
    maxTeachers: 5000,
    maxClasses: 10000,
    maxAdmins: 100,
    maxStorageGB: 1000,
    maxApiCallsPerMonth: 1000000,
  },
  enterprise: {
    maxStudents: -1,                   // Unlimited
    maxTeachers: -1,
    maxClasses: -1,
    maxAdmins: -1,
    maxStorageGB: -1,
    maxApiCallsPerMonth: -1,
  },
};

/**
 * Default role permissions
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleType, Permission[]> = {
  super_admin: [
    { category: 'organization', action: 'admin', scope: 'all' },
    { category: 'users', action: 'admin', scope: 'all' },
    { category: 'classes', action: 'admin', scope: 'all' },
    { category: 'curriculum', action: 'admin', scope: 'all' },
    { category: 'assessments', action: 'admin', scope: 'all' },
    { category: 'reports', action: 'admin', scope: 'all' },
    { category: 'data', action: 'admin', scope: 'all' },
    { category: 'integrations', action: 'admin', scope: 'all' },
  ],
  org_owner: [
    { category: 'organization', action: 'admin', scope: 'organization' },
    { category: 'users', action: 'admin', scope: 'organization' },
    { category: 'classes', action: 'admin', scope: 'organization' },
    { category: 'curriculum', action: 'admin', scope: 'organization' },
    { category: 'assessments', action: 'admin', scope: 'organization' },
    { category: 'reports', action: 'admin', scope: 'organization' },
    { category: 'data', action: 'admin', scope: 'organization' },
    { category: 'integrations', action: 'admin', scope: 'organization' },
  ],
  org_admin: [
    { category: 'organization', action: 'edit', scope: 'organization' },
    { category: 'users', action: 'admin', scope: 'organization' },
    { category: 'classes', action: 'admin', scope: 'organization' },
    { category: 'curriculum', action: 'view', scope: 'organization' },
    { category: 'assessments', action: 'view', scope: 'organization' },
    { category: 'reports', action: 'view', scope: 'organization' },
    { category: 'data', action: 'export', scope: 'organization' },
    { category: 'integrations', action: 'view', scope: 'organization' },
  ],
  principal: [
    { category: 'organization', action: 'view', scope: 'organization' },
    { category: 'users', action: 'view', scope: 'organization' },
    { category: 'classes', action: 'admin', scope: 'organization' },
    { category: 'curriculum', action: 'view', scope: 'organization' },
    { category: 'assessments', action: 'view', scope: 'organization' },
    { category: 'reports', action: 'view', scope: 'organization' },
    { category: 'data', action: 'export', scope: 'organization' },
    { category: 'integrations', action: 'view', scope: 'organization' },
  ],
  curriculum_lead: [
    { category: 'curriculum', action: 'admin', scope: 'organization' },
    { category: 'assessments', action: 'admin', scope: 'organization' },
    { category: 'classes', action: 'view', scope: 'organization' },
    { category: 'reports', action: 'view', scope: 'organization' },
  ],
  teacher: [
    { category: 'classes', action: 'edit', scope: 'class' },
    { category: 'curriculum', action: 'view', scope: 'class' },
    { category: 'assessments', action: 'admin', scope: 'class' },
    { category: 'reports', action: 'view', scope: 'class' },
    { category: 'users', action: 'view', scope: 'class' },
  ],
  teaching_asst: [
    { category: 'classes', action: 'view', scope: 'class' },
    { category: 'assessments', action: 'grade', scope: 'class' },
    { category: 'users', action: 'view', scope: 'class' },
  ],
  counselor: [
    { category: 'users', action: 'view', scope: 'organization' },
    { category: 'reports', action: 'view', scope: 'organization' },
    { category: 'classes', action: 'view', scope: 'organization' },
  ],
  parent: [
    { category: 'reports', action: 'view', scope: 'own' },
    { category: 'assessments', action: 'view', scope: 'own' },
    { category: 'classes', action: 'view', scope: 'own' },
  ],
  student: [
    { category: 'curriculum', action: 'view', scope: 'own' },
    { category: 'assessments', action: 'view', scope: 'own' },
    { category: 'reports', action: 'view', scope: 'own' },
  ],
  observer: [
    { category: 'classes', action: 'view', scope: 'class' },
    { category: 'reports', action: 'view', scope: 'class' },
  ],
};

/**
 * Default organization settings
 */
export const DEFAULT_ORGANIZATION_SETTINGS: OrganizationSettings = {
  defaultGradeLevels: ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
  academicYear: {
    startMonth: 8,
    startDay: 15,
    endMonth: 6,
    endDay: 1,
  },
  timezone: 'America/Chicago',

  standardsFramework: 'common_core',
  stateCode: null,
  customStandardsEnabled: false,

  defaultPassingScore: 70,
  allowRetakes: true,
  retakeWaitDays: 3,
  gradingScale: {
    type: 'letter',
    scale: [
      { grade: 'A', minScore: 90, maxScore: 100, gpaPoints: 4.0 },
      { grade: 'B', minScore: 80, maxScore: 89, gpaPoints: 3.0 },
      { grade: 'C', minScore: 70, maxScore: 79, gpaPoints: 2.0 },
      { grade: 'D', minScore: 60, maxScore: 69, gpaPoints: 1.0 },
      { grade: 'F', minScore: 0, maxScore: 59, gpaPoints: 0.0 },
    ],
  },

  parentPortalEnabled: true,
  studentMessagingEnabled: true,
  emailNotificationsEnabled: true,

  dataRetentionDays: 365 * 7,          // 7 years for FERPA
  shareAnonymousAnalytics: true,
  studentDataVisibleToParents: true,
  showLeaderboards: true,

  gamificationEnabled: true,
  xpSystemEnabled: true,
  achievementsEnabled: true,
  adaptiveLearningEnabled: true,
};

/**
 * Default organization branding
 */
export const DEFAULT_ORGANIZATION_BRANDING: OrganizationBranding = {
  logoUrl: null,
  iconUrl: null,
  primaryColor: '#3B82F6',             // Blue
  secondaryColor: '#1E40AF',           // Dark blue
  accentColor: '#10B981',              // Green
  fontFamily: null,
  customCss: null,
  welcomeMessage: null,
  loginMessage: null,
};

/**
 * Default features by tier
 */
export const DEFAULT_FEATURES_BY_TIER: Record<SubscriptionTier, OrganizationFeatures> = {
  free: {
    dashboardEnabled: true,
    assessmentsEnabled: true,
    curriculumEnabled: true,
    reportsEnabled: true,
    aiTutorEnabled: false,
    videoLessonsEnabled: false,
    liveTutoringEnabled: false,
    customContentEnabled: false,
    ltiEnabled: false,
    ssoEnabled: false,
    apiAccessEnabled: false,
    webhooksEnabled: false,
    testOutSystemEnabled: false,
    patternRecognitionEnabled: false,
    neuroscienceModuleEnabled: false,
    decisionFrameworkEnabled: false,
    advancedAnalyticsEnabled: false,
    predictiveInsightsEnabled: false,
    customReportsEnabled: false,
    dataExportEnabled: false,
  },
  family: {
    dashboardEnabled: true,
    assessmentsEnabled: true,
    curriculumEnabled: true,
    reportsEnabled: true,
    aiTutorEnabled: true,
    videoLessonsEnabled: true,
    liveTutoringEnabled: false,
    customContentEnabled: false,
    ltiEnabled: false,
    ssoEnabled: false,
    apiAccessEnabled: false,
    webhooksEnabled: false,
    testOutSystemEnabled: true,
    patternRecognitionEnabled: true,
    neuroscienceModuleEnabled: true,
    decisionFrameworkEnabled: true,
    advancedAnalyticsEnabled: false,
    predictiveInsightsEnabled: false,
    customReportsEnabled: false,
    dataExportEnabled: true,
  },
  educator: {
    dashboardEnabled: true,
    assessmentsEnabled: true,
    curriculumEnabled: true,
    reportsEnabled: true,
    aiTutorEnabled: true,
    videoLessonsEnabled: true,
    liveTutoringEnabled: false,
    customContentEnabled: true,
    ltiEnabled: false,
    ssoEnabled: false,
    apiAccessEnabled: false,
    webhooksEnabled: false,
    testOutSystemEnabled: true,
    patternRecognitionEnabled: true,
    neuroscienceModuleEnabled: true,
    decisionFrameworkEnabled: true,
    advancedAnalyticsEnabled: true,
    predictiveInsightsEnabled: false,
    customReportsEnabled: false,
    dataExportEnabled: true,
  },
  school: {
    dashboardEnabled: true,
    assessmentsEnabled: true,
    curriculumEnabled: true,
    reportsEnabled: true,
    aiTutorEnabled: true,
    videoLessonsEnabled: true,
    liveTutoringEnabled: true,
    customContentEnabled: true,
    ltiEnabled: true,
    ssoEnabled: true,
    apiAccessEnabled: true,
    webhooksEnabled: true,
    testOutSystemEnabled: true,
    patternRecognitionEnabled: true,
    neuroscienceModuleEnabled: true,
    decisionFrameworkEnabled: true,
    advancedAnalyticsEnabled: true,
    predictiveInsightsEnabled: true,
    customReportsEnabled: true,
    dataExportEnabled: true,
  },
  district: {
    dashboardEnabled: true,
    assessmentsEnabled: true,
    curriculumEnabled: true,
    reportsEnabled: true,
    aiTutorEnabled: true,
    videoLessonsEnabled: true,
    liveTutoringEnabled: true,
    customContentEnabled: true,
    ltiEnabled: true,
    ssoEnabled: true,
    apiAccessEnabled: true,
    webhooksEnabled: true,
    testOutSystemEnabled: true,
    patternRecognitionEnabled: true,
    neuroscienceModuleEnabled: true,
    decisionFrameworkEnabled: true,
    advancedAnalyticsEnabled: true,
    predictiveInsightsEnabled: true,
    customReportsEnabled: true,
    dataExportEnabled: true,
  },
  enterprise: {
    dashboardEnabled: true,
    assessmentsEnabled: true,
    curriculumEnabled: true,
    reportsEnabled: true,
    aiTutorEnabled: true,
    videoLessonsEnabled: true,
    liveTutoringEnabled: true,
    customContentEnabled: true,
    ltiEnabled: true,
    ssoEnabled: true,
    apiAccessEnabled: true,
    webhooksEnabled: true,
    testOutSystemEnabled: true,
    patternRecognitionEnabled: true,
    neuroscienceModuleEnabled: true,
    decisionFrameworkEnabled: true,
    advancedAnalyticsEnabled: true,
    predictiveInsightsEnabled: true,
    customReportsEnabled: true,
    dataExportEnabled: true,
  },
};

export default {};
