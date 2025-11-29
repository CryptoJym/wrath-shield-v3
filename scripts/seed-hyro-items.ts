#!/usr/bin/env npx ts-node
/**
 * Seed Hyro Education Agent with sample learning items
 *
 * Run: npx ts-node scripts/seed-hyro-items.ts
 */

import { createLearningItem } from '../lib/hyro/store';
import type { LearningSource, TopicCategory, DifficultyLevel, LearningStatus } from '../lib/hyro/types';

interface SeedItem {
  user_id: string;
  source: LearningSource;
  source_url?: string;
  title: string;
  description?: string;
  author?: string;
  topics: TopicCategory[];
  difficulty: DifficultyLevel;
  estimated_time_minutes?: number;
  status: LearningStatus;
  progress_percent: number;
  tags: string[];
  priority_score: number;
  confidence: number;
}

const sampleItems: SeedItem[] = [
  // AI/ML
  {
    user_id: 'default',
    source: 'arxiv',
    source_url: 'https://arxiv.org/abs/2312.00752',
    title: 'Mamba: Linear-Time Sequence Modeling with Selective State Spaces',
    description: 'A new state space model architecture that achieves transformer-level performance with linear scaling.',
    author: 'Albert Gu, Tri Dao',
    topics: ['ai_ml'],
    difficulty: 'advanced',
    estimated_time_minutes: 120,
    status: 'pending',
    progress_percent: 0,
    tags: ['state-space-models', 'transformers', 'efficiency'],
    priority_score: 85,
    confidence: 0.9,
  },
  {
    user_id: 'default',
    source: 'youtube',
    source_url: 'https://youtube.com/watch?v=example1',
    title: 'Understanding RAG: Retrieval Augmented Generation Explained',
    description: 'A comprehensive guide to implementing RAG systems for LLM applications.',
    author: 'AI Explained',
    topics: ['ai_ml', 'programming'],
    difficulty: 'intermediate',
    estimated_time_minutes: 45,
    status: 'pending',
    progress_percent: 0,
    tags: ['rag', 'llm', 'retrieval'],
    priority_score: 90,
    confidence: 0.95,
  },
  // Programming
  {
    user_id: 'default',
    source: 'github',
    source_url: 'https://github.com/vercel/next.js',
    title: 'Next.js App Router Deep Dive',
    description: 'Learn the new App Router architecture in Next.js 14+ with server components.',
    author: 'Vercel',
    topics: ['programming'],
    difficulty: 'intermediate',
    estimated_time_minutes: 90,
    status: 'pending',
    progress_percent: 0,
    tags: ['nextjs', 'react', 'server-components'],
    priority_score: 88,
    confidence: 0.92,
  },
  {
    user_id: 'default',
    source: 'medium',
    source_url: 'https://medium.com/example',
    title: 'TypeScript 5.3 New Features You Should Know',
    description: 'Overview of the latest TypeScript features including import attributes and narrowing.',
    author: 'Matt Pocock',
    topics: ['programming'],
    difficulty: 'intermediate',
    estimated_time_minutes: 30,
    status: 'pending',
    progress_percent: 0,
    tags: ['typescript', 'javascript'],
    priority_score: 75,
    confidence: 0.88,
  },
  // Business
  {
    user_id: 'default',
    source: 'podcast',
    source_url: 'https://podcasts.example.com/business',
    title: 'How to Build a $1M Solo Business',
    description: 'Strategies for building a profitable solo consulting or SaaS business.',
    author: 'My First Million',
    topics: ['business'],
    difficulty: 'beginner',
    estimated_time_minutes: 60,
    status: 'pending',
    progress_percent: 0,
    tags: ['entrepreneurship', 'solo-business', 'saas'],
    priority_score: 70,
    confidence: 0.85,
  },
  // Health
  {
    user_id: 'default',
    source: 'book',
    source_url: 'https://www.amazon.com/dp/example',
    title: 'Outlive: The Science and Art of Longevity',
    description: 'Dr. Peter Attia\'s guide to extending healthspan through preventive medicine.',
    author: 'Peter Attia MD',
    topics: ['health'],
    difficulty: 'intermediate',
    estimated_time_minutes: 480,
    status: 'pending',
    progress_percent: 0,
    tags: ['longevity', 'health', 'preventive-medicine'],
    priority_score: 82,
    confidence: 0.9,
  },
  // Productivity
  {
    user_id: 'default',
    source: 'youtube',
    source_url: 'https://youtube.com/watch?v=example2',
    title: 'Building a Second Brain with Obsidian',
    description: 'How to set up a personal knowledge management system using Obsidian.',
    author: 'Tiago Forte',
    topics: ['productivity'],
    difficulty: 'beginner',
    estimated_time_minutes: 45,
    status: 'pending',
    progress_percent: 0,
    tags: ['pkm', 'obsidian', 'note-taking'],
    priority_score: 78,
    confidence: 0.87,
  },
  // Science
  {
    user_id: 'default',
    source: 'newsletter',
    source_url: 'https://newsletter.example.com/science',
    title: 'Quantum Computing: From Theory to Practice',
    description: 'An accessible introduction to quantum computing principles and real-world applications.',
    author: 'Quantum Newsletter',
    topics: ['science', 'programming'],
    difficulty: 'advanced',
    estimated_time_minutes: 60,
    status: 'pending',
    progress_percent: 0,
    tags: ['quantum', 'computing', 'physics'],
    priority_score: 65,
    confidence: 0.8,
  },
  // Engineering
  {
    user_id: 'default',
    source: 'coursera',
    source_url: 'https://www.coursera.org/learn/system-design',
    title: 'System Design for Senior Engineers',
    description: 'Learn how to design scalable distributed systems for high-traffic applications.',
    author: 'Stanford Online',
    topics: ['engineering', 'programming'],
    difficulty: 'advanced',
    estimated_time_minutes: 600,
    status: 'pending',
    progress_percent: 0,
    tags: ['system-design', 'distributed-systems', 'scalability'],
    priority_score: 92,
    confidence: 0.95,
  },
  // Philosophy
  {
    user_id: 'default',
    source: 'book',
    source_url: 'https://www.amazon.com/dp/example2',
    title: 'Meditations by Marcus Aurelius',
    description: 'The classic Stoic text on philosophy, duty, and living a good life.',
    author: 'Marcus Aurelius',
    topics: ['philosophy'],
    difficulty: 'intermediate',
    estimated_time_minutes: 300,
    status: 'pending',
    progress_percent: 0,
    tags: ['stoicism', 'philosophy', 'self-improvement'],
    priority_score: 75,
    confidence: 0.9,
  },
];

async function seedItems() {
  console.log('Seeding Hyro learning items...\n');

  for (const item of sampleItems) {
    try {
      const created = createLearningItem(item);
      console.log(`✓ Created: ${created.title}`);
    } catch (error) {
      console.error(`✗ Failed: ${item.title}`, error);
    }
  }

  console.log(`\nSeeded ${sampleItems.length} learning items.`);
}

seedItems().catch(console.error);
