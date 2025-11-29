/**
 * Hyro Agent - Main Entry Point
 *
 * Convenience exports for Hyro agent functionality
 */

// Types
export type {
  LearningSource,
  LearningItem,
  DailyRecommendation,
  LearningProgress,
  HyroAgentStatus,
  CrawlerConfig,
  SyncResult,
  DifficultyLevel,
  TopicCategory,
  LearningStatus,
} from './types';

// Store operations
export {
  createLearningItem,
  updateLearningItem,
  getLearningItem,
  listLearningItems,
  createDailyRecommendation,
  getDailyRecommendation,
  updateDailyRecommendation,
  getLearningProgress,
  upsertCrawlerConfig,
  getCrawlerConfig,
  listCrawlerConfigs,
  recordSyncResult,
  getLastSyncResult,
} from './store';

// Crawler operations
export {
  crawlSource,
  crawlAllSources,
  initializeDefaultCrawlers,
} from './crawler';

// Recommendation operations
export {
  generateDailyRecommendations,
  acceptRecommendationItem,
  completeRecommendationItem,
  getRecommendedTimeBudget,
} from './recommender';

/**
 * Quick start helper - Initialize Hyro for a new user
 */
export async function initializeHyroForUser(user_id: string): Promise<{
  crawlers_initialized: boolean;
  sources_synced: number;
  recommendations_generated: boolean;
  error?: string;
}> {
  try {
    const { initializeDefaultCrawlers } = await import('./crawler');
    const { crawlAllSources } = await import('./crawler');
    const { generateDailyRecommendations } = await import('./recommender');

    // 1. Initialize default crawler configs
    initializeDefaultCrawlers();

    // 2. Sync all sources
    const syncResults = await crawlAllSources(user_id);
    const successfulSyncs = syncResults.filter(r => r.success).length;

    // 3. Generate initial recommendations
    const recommendations = await generateDailyRecommendations(user_id, {
      max_items: 5,
      target_time_minutes: 120,
    });

    return {
      crawlers_initialized: true,
      sources_synced: successfulSyncs,
      recommendations_generated: !!recommendations,
    };
  } catch (error) {
    return {
      crawlers_initialized: false,
      sources_synced: 0,
      recommendations_generated: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
