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
