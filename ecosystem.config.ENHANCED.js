/**
 * PM2 Ecosystem Configuration for Wrath Shield v3 - ENHANCED
 *
 * This is an ENHANCED version with additional agent-based scheduled tasks.
 * Copy this to ecosystem.config.js to enable the new tasks.
 *
 * NEW TASKS ADDED:
 * - ea-daily-agenda: EA daily agenda generation (6:30 AM)
 * - ea-weekly-report: EA weekly planning (Sunday 6:00 PM)
 * - pm-weekly-report: PM weekly status report (Sunday 8:00 PM)
 *
 * Usage:
 *   cp ecosystem.config.ENHANCED.js ecosystem.config.js
 *   pm2 reload ecosystem.config.js --env production
 */

module.exports = {
  apps: [
    {
      name: 'wrath-shield-v3',
      script: 'npm',
      args: 'run start',
      cwd: __dirname,

      // Instance management
      instances: 1,
      exec_mode: 'fork',

      // Auto-restart configuration
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',

      // Restart behavior
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,

      // Logging
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Environment variables - Production
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // Environment variables - Development
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
      },

      // Health check
      health_check: {
        enable: true,
        interval: 30000,
        threshold: 3,
        port: 3000,
        path: '/',
      },
    },

    // ==========================================================================
    // CORE SCHEDULED TASKS
    // ==========================================================================

    {
      name: 'wrath-scheduler',
      script: 'bash',
      args: "-lc 'npx -y tsx scripts/nightly-tasks.ts'",
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      watch: false,
      cron_restart: '0 3 * * *', // 03:00 daily
      env: { NODE_ENV: 'production' },
      error_file: './logs/scheduler-error.log',
      out_file: './logs/scheduler-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },

    // ==========================================================================
    // HEALTH & DATA SYNC
    // ==========================================================================

    {
      name: 'lifelog-hourly',
      script: 'bash',
      args: "-lc 'cd " + __dirname + " && npm run sync:lifelogs'",
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      watch: false,
      cron_restart: '0 4-23 * * *', // hourly 04:00–23:00
      env: { NODE_ENV: 'production' },
      error_file: './logs/lifelog-hourly-error.log',
      out_file: './logs/lifelog-hourly-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },

    {
      name: 'pipeline-hourly',
      script: 'bash',
      args: "-lc 'cd " + __dirname + " && bash scripts/run-pipeline.sh'",
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      watch: false,
      cron_restart: '15 * * * *', // hourly at :15
      env: { NODE_ENV: 'production' },
      error_file: './logs/pipeline-error.log',
      out_file: './logs/pipeline-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },

    // ==========================================================================
    // EA AGENT TASKS (ENHANCED)
    // ==========================================================================

    {
      name: 'ea-daily-agenda',
      script: 'bash',
      args: "-lc 'cd " + __dirname + " && npx tsx scripts/ea-daily-agenda.ts'",
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      watch: false,
      cron_restart: '30 6 * * *', // 06:30 daily (before morning digest)
      env: { NODE_ENV: 'production' },
      error_file: './logs/ea-daily-agenda-error.log',
      out_file: './logs/ea-daily-agenda-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },

    {
      name: 'digest-morning',
      script: 'bash',
      args: "-lc 'cd " + __dirname + " && npm run daily:digest'",
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      watch: false,
      cron_restart: '5 7 * * *', // 07:05 daily
      env: { NODE_ENV: 'production' },
      error_file: './logs/digest-error.log',
      out_file: './logs/digest-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },

    {
      name: 'shutdown-evening',
      script: 'bash',
      args: "-lc 'cd " + __dirname + " && npm run daily:shutdown'",
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      watch: false,
      cron_restart: '55 22 * * *', // 22:55 daily
      env: { NODE_ENV: 'production' },
      error_file: './logs/shutdown-error.log',
      out_file: './logs/shutdown-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },

    {
      name: 'ea-weekly-report',
      script: 'bash',
      args: "-lc 'cd " + __dirname + " && npx tsx scripts/ea-weekly-report.ts'",
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      watch: false,
      cron_restart: '0 18 * * 0', // 18:00 every Sunday
      env: { NODE_ENV: 'production' },
      error_file: './logs/ea-weekly-report-error.log',
      out_file: './logs/ea-weekly-report-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },

    // ==========================================================================
    // PM AGENT TASKS (ENHANCED)
    // ==========================================================================

    {
      name: 'pm-weekly-report',
      script: 'bash',
      args: "-lc 'cd " + __dirname + " && npx tsx scripts/pm-weekly-report.ts'",
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      watch: false,
      cron_restart: '0 20 * * 0', // 20:00 every Sunday
      env: { NODE_ENV: 'production' },
      error_file: './logs/pm-weekly-report-error.log',
      out_file: './logs/pm-weekly-report-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },

    // ==========================================================================
    // LEGAL AGENT TASKS
    // ==========================================================================

    {
      name: 'legal-hourly',
      script: 'bash',
      args: "-lc 'cd " + __dirname + " && npm run legal:run'",
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      watch: false,
      cron_restart: '20 * * * *', // hourly at :20
      env: { NODE_ENV: 'production' },
      error_file: './logs/legal-error.log',
      out_file: './logs/legal-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },

    // ==========================================================================
    // FINANCE AGENT TASKS
    // ==========================================================================

    {
      name: 'finance-auto-enrich-daily',
      script: 'bash',
      args: "-lc 'cd " + __dirname + " && npm run finance:auto-enrich'",
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      watch: false,
      cron_restart: '15 5 * * *', // 05:15 daily
      env: { NODE_ENV: 'production' },
      error_file: './logs/finance-auto-enrich-error.log',
      out_file: './logs/finance-auto-enrich-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },

    {
      name: 'finance-daily',
      script: 'bash',
      args: "-lc 'cd " + __dirname + " && npm run finance:ingest && npm run finance:rollup'",
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      watch: false,
      cron_restart: '30 6 * * *', // 06:30 daily
      env: { NODE_ENV: 'production' },
      error_file: './logs/finance-error.log',
      out_file: './logs/finance-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },

    // ==========================================================================
    // ORCHESTRATOR & PROACTIVE SYSTEM
    // ==========================================================================

    {
      name: 'proactive-tick',
      script: 'bash',
      args: "-lc 'curl -s \"http://localhost:4242/api/proactive/tick?secret=${PROACTIVE_SECRET}\" || true'",
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      watch: false,
      cron_restart: '* * * * *', // every minute
      env: {
        NODE_ENV: 'production',
        PROACTIVE_SECRET: process.env.PROACTIVE_SECRET || '',
      },
      error_file: './logs/proactive-tick-error.log',
      out_file: './logs/proactive-tick-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },

    {
      name: 'agentic-executor',
      script: 'bash',
      args: "-lc 'cd " + __dirname + " && npx tsx scripts/run-executors.ts'",
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      watch: false,
      cron_restart: '*/10 * * * *', // every 10 minutes
      env: { NODE_ENV: 'production' },
      error_file: './logs/agentic-executor-error.log',
      out_file: './logs/agentic-executor-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],

  // Deployment configuration
  deploy: {
    production: {
      user: 'node',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'git@github.com:username/wrath-shield-v3.git',
      path: '/var/www/wrath-shield-v3',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
    },
  },
};
