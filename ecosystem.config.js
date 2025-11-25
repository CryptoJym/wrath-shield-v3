/**
 * PM2 Ecosystem Configuration for Wrath Shield v3
 *
 * Manages Next.js application processes for development and production environments.
 *
 * Usage:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 start ecosystem.config.js --env development
 *   pm2 status
 *   pm2 restart wrath-shield-v3
 *   pm2 logs wrath-shield-v3
 *   pm2 stop wrath-shield-v3
 */

module.exports = {
  apps: [
    {
      name: 'wrath-shield-v3',
      script: 'npm',
      args: 'run start',
      cwd: __dirname,

      // Node.js version constraint
      node_args: '--version', // PM2 will verify Node 20+ via package.json engines field

      // Instance management
      instances: 1,
      exec_mode: 'fork', // Use 'cluster' for multiple instances

      // Auto-restart configuration
      autorestart: true,
      watch: false, // Don't watch files in production
      max_memory_restart: '1G',

      // Restart behavior
      min_uptime: '10s', // Minimum uptime before considering app stable
      max_restarts: 10, // Maximum restarts within 1 minute
      restart_delay: 4000, // Delay between restarts (ms)

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

      // Health check (experimental)
      // PM2 will check this URL periodically
      health_check: {
        enable: true,
        interval: 30000, // Check every 30 seconds
        threshold: 3, // Restart after 3 failed checks
        port: 3000,
        path: '/', // Next.js home route
      },
    },
    {
      name: 'wrath-scheduler',
      script: 'bash',
      args: "-lc 'npx -y tsx scripts/nightly-tasks.ts'",
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      watch: false,
      cron_restart: '0 3 * * *', // run daily at 03:00
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/scheduler-error.log',
      out_file: './logs/scheduler-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
    {
      name: 'lifelog-hourly',
      script: 'bash',
      args: "-lc 'cd " + __dirname + " && npm run sync:lifelogs'",
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      watch: false,
      cron_restart: '0 4-23 * * *', // every hour 04:00–23:00
      env: {
        NODE_ENV: 'production',
      },
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
      cron_restart: '15 * * * *', // hourly at :15 to stagger after lifelog sync
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/pipeline-error.log',
      out_file: './logs/pipeline-out.log',
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
    {
      name: 'finance-auto-enrich-daily',
      script: 'bash',
      args: "-lc 'cd " + __dirname + " && npm run finance:auto-enrich'",
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      watch: false,
      cron_restart: '15 5 * * *', // daily 05:15
      env: { NODE_ENV: 'production' },
      error_file: './logs/finance-auto-enrich-error.log',
      out_file: './logs/finance-auto-enrich-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],

  // Deployment configuration (optional)
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
