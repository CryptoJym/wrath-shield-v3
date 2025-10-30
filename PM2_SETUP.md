# PM2 Process Management Setup for Wrath Shield v3

## Installation

Install PM2 globally:

```bash
npm install -g pm2
```

## Basic Usage

### Start the Application

```bash
# Development mode
pm2 start ecosystem.config.js --env development

# Production mode (requires build first)
npm run build
pm2 start ecosystem.config.js --env production
```

### Check Status

```bash
pm2 status
pm2 list
```

### View Logs

```bash
# View all logs
pm2 logs wrath-shield-v3

# View only error logs
pm2 logs wrath-shield-v3 --err

# View only output logs
pm2 logs wrath-shield-v3 --out

# View logs in real-time
pm2 logs wrath-shield-v3 --lines 50
```

### Restart/Stop

```bash
# Restart
pm2 restart wrath-shield-v3

# Reload with zero-downtime (for production)
pm2 reload wrath-shield-v3

# Stop
pm2 stop wrath-shield-v3

# Delete from PM2 process list
pm2 delete wrath-shield-v3
```

### Monitor

```bash
# Real-time monitoring dashboard
pm2 monit

# Web-based dashboard (advanced)
pm2 web
```

## Auto-Restart on System Boot

To ensure the application starts automatically when the system reboots:

```bash
# Generate startup script
pm2 startup

# Save current process list
pm2 save
```

## Health Checks

The ecosystem.config.js includes health check configuration:
- Checks the home route (`/`) every 30 seconds
- Restarts after 3 failed health checks
- Ensures application availability

## Environment Variables

Production and development environments are configured in `ecosystem.config.js`.

To add additional environment variables:

1. Create a `.env` file in the project root
2. Reference it in `ecosystem.config.js`:

```javascript
env_production: {
  NODE_ENV: 'production',
  PORT: 3000,
  // Add other variables from .env
}
```

## Logs Location

PM2 logs are stored in:
- `./logs/pm2-out.log` - Standard output
- `./logs/pm2-error.log` - Error output

## Troubleshooting

### App won't start
```bash
# Check for errors
pm2 logs wrath-shield-v3 --err --lines 100

# Verify Next.js build is complete
npm run build

# Check if port 3000 is available
lsof -i :3000
```

### Memory issues
```bash
# Check memory usage
pm2 status

# Increase max_memory_restart in ecosystem.config.js if needed
```

### Process crashes frequently
```bash
# Check restart count
pm2 status

# Review error logs
pm2 logs wrath-shield-v3 --err --lines 200

# Adjust min_uptime and max_restarts in ecosystem.config.js
```

## Advanced Configuration

### Cluster Mode (Multiple Instances)

For better performance with multiple CPU cores:

```javascript
// In ecosystem.config.js
{
  instances: 4,      // Number of instances (or 'max' for CPU count)
  exec_mode: 'cluster'
}
```

### Custom Watch Mode (Development)

For auto-restart on file changes during development:

```javascript
// In ecosystem.config.js
{
  watch: true,
  watch_delay: 1000,
  ignore_watch: ['node_modules', 'logs', '.next']
}
```

## Testing PM2 Configuration

Before deploying to production, test the configuration:

```bash
# Start in development mode
pm2 start ecosystem.config.js --env development

# Check status
pm2 status

# Test health check
curl http://localhost:3000/

# View logs for any issues
pm2 logs wrath-shield-v3

# Stop when done testing
pm2 stop wrath-shield-v3
pm2 delete wrath-shield-v3
```

## Node.js Version Requirement

This project requires Node.js 20+. Verify version:

```bash
node --version
# Should output: v20.x.x or higher
```

If using nvm:

```bash
nvm use 20
```

## References

- [PM2 Documentation](https://pm2.keymetrics.io/)
- [PM2 Ecosystem File Reference](https://pm2.keymetrics.io/docs/usage/application-declaration/)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
