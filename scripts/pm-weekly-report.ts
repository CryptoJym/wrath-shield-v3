#!/usr/bin/env tsx
/**
 * PM Weekly Report Generation
 *
 * Runs every Sunday at 8:00 PM to generate project status report.
 * Called by PM2 cron or internal scheduler.
 *
 * Responsibilities:
 * - Aggregate project progress across all domains
 * - Identify blockers and risks
 * - Generate stakeholder updates
 * - Store report in memory
 */

import { addMemory } from '../lib/MemoryWrapper';
import { getEventBus, createNotificationEvent } from '../lib/agents/life-os-event-bus';
import { getDomains } from '../lib/life-os-config';

const USER_ID = process.env.MEMORY_USER_ID || 'james';

interface ProjectStatus {
  domain: string;
  totalProjects: number;
  activeProjects: number;
  completedThisWeek: number;
  blockers: number;
  healthScore: number;
}

interface PMWeeklyReport {
  weekStart: string;
  weekEnd: string;
  overview: {
    totalDomains: number;
    totalProjects: number;
    completedTasks: number;
    activeBlockers: number;
    overallHealth: number;
  };
  byDomain: ProjectStatus[];
  topBlockers: string[];
  recommendations: string[];
}

async function generatePMReport(): Promise<PMWeeklyReport> {
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 7);

  const weekEnd = new Date(today);

  console.log(`[PM Weekly] Generating report for ${weekStart.toISOString().slice(0, 10)} to ${weekEnd.toISOString().slice(0, 10)}...`);

  // Get domains from Life OS config
  const domainsConfig = getDomains();
  const domains = domainsConfig.domains;

  // TODO: Implement actual project data fetching
  const byDomain: ProjectStatus[] = domains.map(domain => ({
    domain: domain.name,
    totalProjects: 0,
    activeProjects: 0,
    completedThisWeek: 0,
    blockers: 0,
    healthScore: 85,
  }));

  const report: PMWeeklyReport = {
    weekStart: weekStart.toISOString().slice(0, 10),
    weekEnd: weekEnd.toISOString().slice(0, 10),
    overview: {
      totalDomains: domains.length,
      totalProjects: byDomain.reduce((sum, d) => sum + d.totalProjects, 0),
      completedTasks: byDomain.reduce((sum, d) => sum + d.completedThisWeek, 0),
      activeBlockers: byDomain.reduce((sum, d) => sum + d.blockers, 0),
      overallHealth: Math.round(byDomain.reduce((sum, d) => sum + d.healthScore, 0) / byDomain.length),
    },
    byDomain,
    topBlockers: [],
    recommendations: [
      'Focus on clearing blockers in high-priority domains',
      'Allocate resources to projects with declining health scores',
      'Review and update project roadmaps for Q1',
    ],
  };

  return report;
}

async function storePMReport(report: PMWeeklyReport): Promise<void> {
  const reportText = [
    `PM Weekly Report: ${report.weekStart} to ${report.weekEnd}`,
    '',
    '## Overview',
    `- Total Domains: ${report.overview.totalDomains}`,
    `- Total Projects: ${report.overview.totalProjects}`,
    `- Completed Tasks: ${report.overview.completedTasks}`,
    `- Active Blockers: ${report.overview.activeBlockers}`,
    `- Overall Health: ${report.overview.overallHealth}%`,
    '',
    '## By Domain',
    ...report.byDomain.map(d => [
      `### ${d.domain}`,
      `- Total Projects: ${d.totalProjects}`,
      `- Active: ${d.activeProjects}`,
      `- Completed This Week: ${d.completedThisWeek}`,
      `- Blockers: ${d.blockers}`,
      `- Health Score: ${d.healthScore}%`,
      '',
    ]).flat(),
    report.topBlockers.length > 0 ? '## Top Blockers' : '',
    ...report.topBlockers.map(b => `- ${b}`),
    '',
    '## Recommendations',
    ...report.recommendations.map(r => `- ${r}`),
  ].join('\n');

  await addMemory(reportText, USER_ID, {
    type: 'anchor',
    category: 'pm_weekly_report',
    weekStart: report.weekStart,
    weekEnd: report.weekEnd,
    agent: 'agent.pm',
  });

  console.log('[PM Weekly] Stored weekly report in memory');
}

async function publishPMNotification(report: PMWeeklyReport): Promise<void> {
  const eventBus = getEventBus();

  await eventBus.publish(createNotificationEvent({
    source: 'agent.pm',
    payload: {
      type: 'pm_weekly_report',
      report,
      timestamp: new Date().toISOString(),
    },
    priority: 'normal',
  }));

  console.log('[PM Weekly] Published weekly report notification');
}

async function main() {
  try {
    console.log('[PM Weekly] Starting PM weekly report generation...');

    const report = await generatePMReport();

    await storePMReport(report);
    await publishPMNotification(report);

    console.log('[PM Weekly] Successfully generated PM weekly report');
  } catch (error) {
    console.error('[PM Weekly] Error:', error);
    process.exitCode = 1;
  }
}

main();
