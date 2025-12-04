/**
 * HYRO FORGE: Platform Connector Types
 * Shared type definitions for platform integration connectors
 */

import type { StatName } from '../forge-types';

// ============================================================================
// Platform Progress
// ============================================================================

export interface PlatformProgress {
  platformId: string;
  displayName: string;

  // Progress metrics
  badges?: number;
  badgesTotal?: number;
  lessonsCompleted?: number;
  lessonsTotal?: number;
  percentComplete?: number;

  // Current status
  currentMission?: string;
  currentLesson?: string | number;

  // Pace tracking
  paceStatus?: 'ahead' | 'on_track' | 'behind' | 'unknown';
  dueDate?: string;

  // Detailed breakdown
  breakdown?: MissionProgress[];

  // Last sync info
  lastSynced?: number; // Unix timestamp
}

export interface MissionProgress {
  grade?: string;
  mission: number | string;
  name: string;
  badges: number;
  badgesTotal: number;
  percentComplete: number;
  status: 'complete' | 'partial' | 'not_started';
  note?: string;
}

// ============================================================================
// Sync Results
// ============================================================================

export interface SyncResult {
  success: boolean;
  platformId: string;
  timestamp: number;

  // Sync statistics
  itemsSynced: number;
  progressRecords: number;
  assignmentRecords: number;
  memoryRecords: number;

  // Quest generation
  questsGenerated?: number;
  questsSkipped?: string[];

  // Error tracking
  errors: SyncError[];
  warnings?: string[];
}

export interface SyncError {
  category: 'progress' | 'assignment' | 'quest' | 'memory' | 'other';
  message: string;
  context?: any;
}

// ============================================================================
// Platform Items
// ============================================================================

export interface PlatformItem {
  platformId: string;
  externalId: string;

  // Item details
  type: 'lesson' | 'mission' | 'assignment' | 'badge' | 'activity';
  title: string;
  description?: string;
  subject?: string;

  // Progress
  status: 'not_started' | 'in_progress' | 'completed';
  percentComplete?: number;
  score?: number;
  maxScore?: number;

  // Timing
  dueDate?: number; // Unix timestamp
  assignedDate?: number;
  completedDate?: number;
  estimatedMinutes?: number;

  // Quest mapping
  difficulty?: string;
  url?: string;
}

// ============================================================================
// Connector Status
// ============================================================================

export interface ConnectorStatus {
  platformId: string;
  displayName: string;
  isHealthy: boolean;
  isEnabled: boolean;

  // Health metrics
  lastSync?: number;
  lastSuccessfulSync?: number;
  consecutiveFailures: number;
  errorCount: number;

  // Recent errors
  recentErrors?: SyncError[];

  // Capabilities
  supportsAutoSync: boolean;
  supportsScreenshot: boolean;
  supportsManualEntry: boolean;
}

// ============================================================================
// Quest Input (for mapping to Forge quest system)
// ============================================================================

export interface QuestInput {
  platform: string;
  platformId: string;
  title: string;
  description?: string;
  subject?: string;
  url?: string;
  dueDate?: number;
  assignedDate?: number;
  difficulty?: string;
  estimatedMinutes?: number;
  score?: number;
  maxScore?: number;
}

// ============================================================================
// Screenshot OCR Input (for Zearn)
// ============================================================================

export interface ScreenshotInput {
  imagePath?: string;
  imageUrl?: string;
  imageBase64?: string;
  platform: string;
  context?: string;
}

export interface OCRResult {
  success: boolean;
  extractedText: string;
  confidence?: number;
  structuredData?: any;
  error?: string;
}
