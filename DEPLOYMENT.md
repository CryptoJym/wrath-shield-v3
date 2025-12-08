# Wrath Shield Production Deployment Guide

## Decision Guide

| Your Priority | Best Choice |
|---------------|-------------|
| Easiest setup, less control | **Railway** |
| PM2 cron jobs work as-is | **DigitalOcean** |
| Fixed monthly cost | **DigitalOcean** ($12/mo) |
| Zero server management | **Railway** |
| SQLite without changes | **DigitalOcean** |

---

## Quick Start: Railway (Easiest Setup)

### 1. Setup Railway

```bash
# Install CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Link to GitHub (recommended for auto-deploys)
railway link
```

### 2. Configure Environment Variables

In Railway dashboard, add all your env vars:

```
# Required
OPENROUTER_API_KEY=your_key
ZEP_API_KEY=your_key
DATABASE_URL=./data/wrath-shield.db

# Optional integrations
PLAID_CLIENT_ID=your_id
PLAID_SECRET=your_secret
MOTION_API_KEY=your_key
GITHUB_TOKEN=your_token
TODOIST_API_KEY=your_key
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
PROACTIVE_SECRET=your_secret
LIMITLESS_API_KEY=your_key
```

### 3. Create Procfile for Railway

Create `Procfile` in project root:
```
web: npm run build && npm run start
```

### 4. Handle Cron Jobs (Choose One)

**Option A: Use internal scheduler (recommended)**
The app includes `lib/cron/scheduler.ts` which runs cron jobs inside the Node process.
Just deploy - it works automatically when `USE_PM2_CRON` is not set.

**Option B: Use external cron service**
Use [cron-job.org](https://cron-job.org) (free) to hit your endpoints:
- `https://your-app.railway.app/api/proactive/tick?secret=XXX` - every minute

### 5. Add PostgreSQL (Recommended for Railway)

```bash
# Railway's managed Postgres is more reliable than SQLite on containers
railway add postgresql
# Update DATABASE_URL in Railway dashboard
```

### 6. Deploy

```bash
railway up
```

### 7. Setup Custom Domain (Optional)

In Railway dashboard: Settings → Domains → Add custom domain

---

## Option B: DigitalOcean Droplet (Full Control - $12-24/month)

### 1. Create Droplet

```bash
# Create $12/month droplet (2GB RAM, 1 vCPU)
# Choose: Ubuntu 22.04 LTS
# Add your SSH key
```

### 2. Initial Server Setup

```bash
# SSH into server
ssh root@your_droplet_ip

# Create non-root user
adduser wrath
usermod -aG sudo wrath

# Switch to user
su - wrath
```

### 3. Install Node.js 20+

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version  # v20.x.x
```

### 4. Install PM2

```bash
sudo npm install -g pm2
```

### 5. Clone and Setup

```bash
# Clone your repo
git clone https://github.com/YOUR_USERNAME/wrath-shield-v3.git
cd wrath-shield-v3

# Install dependencies
npm install

# Create .env file with all your secrets
nano .env

# Build
npm run build
```

### 6. Start with PM2

```bash
# Create logs directory
mkdir -p logs

# Start all processes
pm2 start ecosystem.config.js --env production

# Save PM2 config (survives reboots)
pm2 save

# Setup startup script
pm2 startup
# Run the command it outputs!
```

### 7. Setup Nginx Reverse Proxy

```bash
sudo apt install -y nginx

# Create config
sudo nano /etc/nginx/sites-available/wrath-shield
```

Add this config:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/wrath-shield /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 8. Setup SSL with Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 9. Setup Auto-Deploy with GitHub Actions

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.SERVER_IP }}
          username: wrath
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd ~/wrath-shield-v3
            git pull origin main
            npm install
            npm run build
            pm2 reload ecosystem.config.js --env production
```

---

## Option C: Fly.io (Good for Global Distribution - ~$10-25/month)

### 1. Install Fly CLI

```bash
brew install flyctl
fly auth login
```

### 2. Create fly.toml

```toml
app = "wrath-shield"
primary_region = "ord"  # Chicago

[build]
  [build.args]
    NEXT_TELEMETRY_DISABLED = "1"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = false  # Keep running always
  auto_start_machines = true
  min_machines_running = 1

[mounts]
  source = "wrath_data"
  destination = "/app/data"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 1024
```

### 3. Create Volume for SQLite

```bash
fly volumes create wrath_data --size 1 --region ord
```

### 4. Set Secrets

```bash
fly secrets set OPENROUTER_API_KEY=xxx ZEP_API_KEY=xxx ...
```

### 5. Deploy

```bash
fly deploy
```

---

## Database Considerations

### Current: SQLite (Portable)
- Works fine for single-instance deployment
- Data stored in `./data/wrath-shield.db`
- **Important**: Use persistent volume (Fly.io) or VPS (DigitalOcean)

### Future: PostgreSQL (Scalable)
If you need multiple instances or higher reliability:

```bash
# Railway has managed Postgres
railway add postgres

# Or use Supabase (free tier available)
# Update DATABASE_URL in .env
```

---

## Monitoring

### PM2 Web Dashboard

```bash
# On your server
pm2 install pm2-server-monit

# Or use PM2 Plus (paid)
pm2 plus
```

### Health Checks

Your ecosystem.config.js already has health checks. Add external monitoring:

- **UptimeRobot** (free) - monitors https://your-domain.com
- **Better Stack** - logs + monitoring

### Log Management

```bash
# View all logs
pm2 logs

# Rotate logs (prevent disk fill)
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## Updating the System

### Manual Deploy

```bash
ssh wrath@your-server
cd ~/wrath-shield-v3
git pull origin main
npm install
npm run build
pm2 reload ecosystem.config.js --env production
```

### Auto Deploy (GitHub Actions)

Push to `main` branch → automatic deployment

---

## Backup Strategy

### SQLite Database

```bash
# Add to crontab
0 4 * * * cp /home/wrath/wrath-shield-v3/data/wrath-shield.db /home/wrath/backups/wrath-shield-$(date +\%Y\%m\%d).db

# Or sync to cloud storage
0 4 * * * rclone copy /home/wrath/wrath-shield-v3/data/wrath-shield.db remote:backups/
```

### Full System Backup

DigitalOcean: Enable weekly droplet backups ($2.40/month extra)

---

## Cost Summary

| Platform | Monthly Cost | Best For |
|----------|-------------|----------|
| Railway | $5-20 | Easy setup, auto-scaling |
| DigitalOcean Droplet | $12-24 | Full control, PM2 cron jobs |
| Fly.io | $10-25 | Global edge, SQLite volumes |
| Render | $7-25 | Simple deploys, background workers |

---

## Quick Commands Reference

```bash
# Check status
pm2 status

# View logs
pm2 logs wrath-shield-v3

# Restart all
pm2 reload ecosystem.config.js --env production

# Monitor resources
pm2 monit

# Check if running after reboot
pm2 resurrect
```
