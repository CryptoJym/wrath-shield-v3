/**
 * Hyro Agent Crawler
 *
 * Monitors educational sources and ingests learning content
 */

import type {
  LearningSource,
  LearningItem,
  SyncResult,
  CrawlerConfig,
  TopicCategory,
  DifficultyLevel,
} from './types';
import {
  createLearningItem,
  listLearningItems,
  recordSyncResult,
  getCrawlerConfig,
  upsertCrawlerConfig,
} from './store';

// Mock crawler implementations
// In production, these would be real API integrations

interface CrawledItem {
  source_url: string;
  title: string;
  description?: string;
  author?: string;
  published_at?: number;
  topics: TopicCategory[];
  difficulty: DifficultyLevel;
  estimated_time_minutes?: number;
  tags: string[];
}

// ============================================================================
// Source Crawlers
// ============================================================================

async function crawlArxiv(config: CrawlerConfig): Promise<CrawledItem[]> {
  // Mock implementation - would use arXiv API in production
  const keywords = config.config.keywords || ['machine learning'];
  const maxItems = config.config.max_items || 5;

  console.log(`[Hyro] Crawling arXiv for: ${keywords.join(', ')}`);

  // Mock data
  return [
    {
      source_url: 'https://arxiv.org/abs/2401.00001',
      title: 'Advances in Transformer Architectures for Large Language Models',
      description: 'This paper explores recent innovations in transformer architecture design.',
      author: 'Smith et al.',
      published_at: Math.floor(Date.now() / 1000) - 86400,
      topics: ['ai_ml'] as TopicCategory[],
      difficulty: 'advanced' as DifficultyLevel,
      estimated_time_minutes: 120,
      tags: ['transformers', 'llm', 'deep-learning'],
    },
  ].slice(0, maxItems);
}

async function crawlYoutube(config: CrawlerConfig): Promise<CrawledItem[]> {
  // Mock implementation - would use YouTube API in production
  const keywords = config.config.keywords || ['programming tutorial'];
  const maxItems = config.config.max_items || 5;

  console.log(`[Hyro] Crawling YouTube for: ${keywords.join(', ')}`);

  return [
    {
      source_url: 'https://youtube.com/watch?v=example',
      title: 'React Server Components Tutorial',
      description: 'Learn how to build with React Server Components',
      author: 'Tech Channel',
      published_at: Math.floor(Date.now() / 1000) - 172800,
      topics: ['programming'] as TopicCategory[],
      difficulty: 'intermediate' as DifficultyLevel,
      estimated_time_minutes: 45,
      tags: ['react', 'javascript', 'web-development'],
    },
  ].slice(0, maxItems);
}

async function crawlGithub(config: CrawlerConfig): Promise<CrawledItem[]> {
  // Mock implementation - would use GitHub API in production
  const keywords = config.config.keywords || ['awesome list'];
  const maxItems = config.config.max_items || 5;

  console.log(`[Hyro] Crawling GitHub for: ${keywords.join(', ')}`);

  return [
    {
      source_url: 'https://github.com/example/awesome-ai',
      title: 'Awesome AI Resources Collection',
      description: 'Curated list of AI/ML resources and tools',
      author: 'community',
      published_at: Math.floor(Date.now() / 1000) - 259200,
      topics: ['ai_ml'] as TopicCategory[],
      difficulty: 'beginner' as DifficultyLevel,
      estimated_time_minutes: 30,
      tags: ['ai', 'ml', 'resources', 'awesome-list'],
    },
  ].slice(0, maxItems);
}

async function crawlMedium(config: CrawlerConfig): Promise<CrawledItem[]> {
  // Mock implementation
  const keywords = config.config.keywords || ['software engineering'];
  const maxItems = config.config.max_items || 5;

  console.log(`[Hyro] Crawling Medium for: ${keywords.join(', ')}`);

  return [
    {
      source_url: 'https://medium.com/@author/article',
      title: 'Building Scalable Microservices with Go',
      description: 'A deep dive into microservice architecture patterns',
      author: 'Jane Developer',
      published_at: Math.floor(Date.now() / 1000) - 345600,
      topics: ['programming', 'engineering'] as TopicCategory[],
      difficulty: 'advanced' as DifficultyLevel,
      estimated_time_minutes: 20,
      tags: ['golang', 'microservices', 'architecture'],
    },
  ].slice(0, maxItems);
}

async function crawlRSS(config: CrawlerConfig): Promise<CrawledItem[]> {
  // Mock implementation - would parse RSS feed in production
  const url = config.config.url || '';
  const maxItems = config.config.max_items || 10;

  console.log(`[Hyro] Crawling RSS feed: ${url}`);

  return [
    {
      source_url: 'https://example.com/blog/post',
      title: 'Weekly Tech Roundup',
      description: 'Latest news in technology and software development',
      author: 'Tech Blog',
      published_at: Math.floor(Date.now() / 1000) - 86400,
      topics: ['programming', 'other'] as TopicCategory[],
      difficulty: 'intermediate' as DifficultyLevel,
      estimated_time_minutes: 15,
      tags: ['news', 'tech', 'roundup'],
    },
  ].slice(0, maxItems);
}

// ============================================================================
// Main Crawler Interface
// ============================================================================

const CRAWLER_MAP: Record<LearningSource, (config: CrawlerConfig) => Promise<CrawledItem[]>> = {
  arxiv: crawlArxiv,
  youtube: crawlYoutube,
  github: crawlGithub,
  medium: crawlMedium,
  rss: crawlRSS,
  coursera: async () => [],     // Not implemented yet
  podcast: async () => [],       // Not implemented yet
  book: async () => [],          // Not implemented yet
  newsletter: async () => [],    // Not implemented yet
  custom: crawlRSS,              // Use RSS parser for custom sources
};

/**
 * Crawl a specific source and ingest new items
 */
export async function crawlSource(source: LearningSource, user_id: string): Promise<SyncResult> {
  const startTime = Math.floor(Date.now() / 1000);

  try {
    // Get crawler config
    const config = getCrawlerConfig(source);
    if (!config) {
      throw new Error(`No crawler config found for source: ${source}`);
    }

    if (!config.enabled) {
      return {
        source,
        success: false,
        items_found: 0,
        items_new: 0,
        items_updated: 0,
        error: 'Source is disabled',
        synced_at: startTime,
      };
    }

    // Run crawler
    const crawler = CRAWLER_MAP[source];
    if (!crawler) {
      throw new Error(`No crawler implementation for source: ${source}`);
    }

    const items = await crawler(config);

    // Ingest items
    const existing = listLearningItems({ user_id, source });
    const existingUrls = new Set(existing.map(i => i.source_url).filter(Boolean));

    let newCount = 0;
    let updatedCount = 0;

    for (const item of items) {
      if (!existingUrls.has(item.source_url)) {
        // Create new learning item
        createLearningItem({
          user_id,
          source,
          source_url: item.source_url,
          title: item.title,
          description: item.description,
          author: item.author,
          published_at: item.published_at,
          topics: item.topics,
          difficulty: item.difficulty,
          estimated_time_minutes: item.estimated_time_minutes,
          status: 'pending',
          progress_percent: 0,
          notes: undefined,
          tags: item.tags,
          priority_score: 50, // Default priority
          confidence: 0.7,    // Default confidence
          scheduled_for: undefined,
        });
        newCount++;
      } else {
        // Item already exists, skip for now
        // In production, might want to update metadata
        updatedCount++;
      }
    }

    // Update crawler config
    upsertCrawlerConfig({
      ...config,
      last_sync_at: startTime,
      last_success_at: startTime,
      error_count: 0,
      last_error: undefined,
    });

    const result: SyncResult = {
      source,
      success: true,
      items_found: items.length,
      items_new: newCount,
      items_updated: updatedCount,
      synced_at: startTime,
    };

    recordSyncResult(result);
    return result;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Hyro] Crawler error for ${source}:`, errorMsg);

    // Update error count
    const config = getCrawlerConfig(source);
    if (config) {
      upsertCrawlerConfig({
        ...config,
        last_sync_at: startTime,
        error_count: config.error_count + 1,
        last_error: errorMsg,
      });
    }

    const result: SyncResult = {
      source,
      success: false,
      items_found: 0,
      items_new: 0,
      items_updated: 0,
      error: errorMsg,
      synced_at: startTime,
    };

    recordSyncResult(result);
    return result;
  }
}

/**
 * Crawl all enabled sources
 */
export async function crawlAllSources(user_id: string): Promise<SyncResult[]> {
  const sources: LearningSource[] = ['arxiv', 'youtube', 'github', 'medium', 'rss'];
  const results: SyncResult[] = [];

  for (const source of sources) {
    const result = await crawlSource(source, user_id);
    results.push(result);
  }

  return results;
}

/**
 * Initialize default crawler configs
 */
export function initializeDefaultCrawlers(): void {
  const defaultConfigs: Array<{ source: LearningSource; config: CrawlerConfig['config'] }> = [
    {
      source: 'arxiv',
      config: {
        keywords: ['machine learning', 'artificial intelligence'],
        max_items: 5,
        sync_interval_hours: 24,
      },
    },
    {
      source: 'youtube',
      config: {
        keywords: ['programming tutorial', 'tech education'],
        max_items: 5,
        sync_interval_hours: 12,
      },
    },
    {
      source: 'github',
      config: {
        keywords: ['awesome', 'resources'],
        max_items: 3,
        sync_interval_hours: 168, // Weekly
      },
    },
    {
      source: 'medium',
      config: {
        keywords: ['software engineering', 'productivity'],
        max_items: 5,
        sync_interval_hours: 24,
      },
    },
    {
      source: 'rss',
      config: {
        url: 'https://example.com/rss',
        max_items: 10,
        sync_interval_hours: 6,
      },
    },
  ];

  for (const { source, config } of defaultConfigs) {
    const existing = getCrawlerConfig(source);
    if (!existing) {
      upsertCrawlerConfig({
        source,
        enabled: true,
        config,
        error_count: 0,
      });
    }
  }
}
