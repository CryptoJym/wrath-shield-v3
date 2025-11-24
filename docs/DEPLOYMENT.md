# Legal Advocate AI - Deployment Guide

Complete guide for deploying Legal Advocate AI to production environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Deployment Options](#deployment-options)
- [Railway Deployment](#railway-deployment)
- [Render Deployment](#render-deployment)
- [Docker Deployment](#docker-deployment)
- [Manual Deployment](#manual-deployment)
- [Database Migration](#database-migration)
- [Post-Deployment](#post-deployment)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Accounts
- PostgreSQL database (or hosting provider with PostgreSQL)
- SendGrid account (for email alerts)
- Sentry account (optional, for error tracking)

### Required Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Security
SECRET_KEY=your-secret-key-here
API_KEY=your-api-key-here

# Email
SENDGRID_API_KEY=your-sendgrid-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
ADMIN_EMAIL=admin@yourdomain.com

# Monitoring (Optional)
SENTRY_DSN=your-sentry-dsn

# CORS (comma-separated)
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

## Deployment Options

### Option 1: Railway (Recommended for Quick Deploy)

Railway offers the easiest deployment with automatic PostgreSQL setup.

**Steps:**

1. Install Railway CLI:
```bash
npm install -g @railway/cli
```

2. Login to Railway:
```bash
railway login
```

3. Initialize project:
```bash
railway init
```

4. Link to GitHub repository (optional):
```bash
railway link
```

5. Deploy using blueprint:
```bash
railway up --json deploy/railway.json
```

6. Set environment variables:
```bash
railway variables set SECRET_KEY=your-secret-key
railway variables set API_KEY=your-api-key
railway variables set SENDGRID_API_KEY=your-sendgrid-key
railway variables set SENDGRID_FROM_EMAIL=noreply@yourdomain.com
railway variables set ADMIN_EMAIL=admin@yourdomain.com
railway variables set CORS_ORIGINS=https://yourdomain.com
```

7. Railway will automatically:
   - Create PostgreSQL database
   - Run database migrations
   - Deploy API and Dashboard
   - Set up health checks

**Cost:** Free tier available, then $5/month

### Option 2: Render

Render provides a complete PaaS with built-in PostgreSQL and good free tier.

**Steps:**

1. Fork repository to GitHub

2. Connect to Render:
   - Go to https://render.com
   - Create new account or login
   - Click "New +" → "Blueprint"
   - Connect your GitHub repository
   - Select `deploy/render.yaml`

3. Configure environment variables in Render dashboard:
   - Go to each service
   - Add environment variables from `.env.example`

4. Render will automatically:
   - Create PostgreSQL database
   - Deploy API, Dashboard, and Worker
   - Run migrations on deploy
   - Set up health checks

**Cost:** Free tier available (limitations on DB size and runtime)

### Option 3: Docker + Cloud Provider

Deploy using Docker to any cloud provider (AWS, GCP, Azure, DigitalOcean, etc.)

**Steps:**

1. Build Docker images:
```bash
# API
docker build -t legal-advocate-api:latest .

# Dashboard
docker build -f Dockerfile.dashboard -t legal-advocate-dashboard:latest .
```

2. Push to container registry:
```bash
# Example: Docker Hub
docker tag legal-advocate-api:latest yourusername/legal-advocate-api:latest
docker push yourusername/legal-advocate-api:latest

docker tag legal-advocate-dashboard:latest yourusername/legal-advocate-dashboard:latest
docker push yourusername/legal-advocate-dashboard:latest
```

3. Deploy using docker-compose:
```bash
# Copy docker-compose.yml to server
# Set environment variables in .env file
docker-compose up -d
```

Or use cloud-specific tools:
- **AWS ECS/Fargate**: Use task definitions
- **GCP Cloud Run**: Deploy containers directly
- **Azure Container Instances**: Deploy from container registry
- **DigitalOcean App Platform**: Connect to GitHub and deploy

### Option 4: Manual/VPS Deployment

Deploy to your own server (Ubuntu/Debian recommended).

**Steps:**

1. Install dependencies:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Python 3.11
sudo apt install python3.11 python3.11-venv python3-pip -y

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Install Nginx (reverse proxy)
sudo apt install nginx -y
```

2. Create database:
```bash
sudo -u postgres psql
CREATE DATABASE legal_advocate;
CREATE USER legaluser WITH PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON DATABASE legal_advocate TO legaluser;
\q
```

3. Clone repository:
```bash
cd /opt
git clone https://github.com/yourusername/legal-advocate-ai.git
cd legal-advocate-ai
```

4. Setup Python environment:
```bash
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

5. Configure environment:
```bash
cp .env.example .env
nano .env  # Edit with your values
```

6. Run migrations:
```bash
alembic upgrade head
```

7. Setup systemd services:

Create `/etc/systemd/system/legal-advocate-api.service`:
```ini
[Unit]
Description=Legal Advocate AI API
After=network.target postgresql.service

[Service]
Type=notify
User=www-data
WorkingDirectory=/opt/legal-advocate-ai
Environment="PATH=/opt/legal-advocate-ai/venv/bin"
ExecStart=/opt/legal-advocate-ai/venv/bin/gunicorn api.main:app \
    --bind 127.0.0.1:8000 \
    --worker-class uvicorn.workers.UvicornWorker \
    --workers 4 \
    --timeout 120
Restart=always

[Install]
WantedBy=multi-user.target
```

Create `/etc/systemd/system/legal-advocate-worker.service`:
```ini
[Unit]
Description=Legal Advocate AI Alert Worker
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/legal-advocate-ai
Environment="PATH=/opt/legal-advocate-ai/venv/bin"
ExecStart=/opt/legal-advocate-ai/venv/bin/python alert_engine.py
Restart=always

[Install]
WantedBy=multi-user.target
```

8. Setup Nginx:

Create `/etc/nginx/sites-available/legal-advocate`:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        proxy_pass http://127.0.0.1:8000/health;
        access_log off;
    }
}
```

9. Enable and start services:
```bash
sudo ln -s /etc/nginx/sites-available/legal-advocate /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

sudo systemctl enable legal-advocate-api
sudo systemctl enable legal-advocate-worker
sudo systemctl start legal-advocate-api
sudo systemctl start legal-advocate-worker
```

10. Setup SSL (recommended):
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com
```

## Database Migration

### From SQLite to PostgreSQL

If you have existing data in SQLite:

1. Create PostgreSQL database (see deployment steps above)

2. Run migration script:
```bash
python scripts/migrate_to_postgres.py \
    --sqlite sqlite:///~/.legal_advocate_ai/action_items.db \
    --postgres postgresql://user:pass@host:5432/legal_advocate
```

3. Verify migration:
```bash
python scripts/migrate_to_postgres.py \
    --sqlite sqlite:///~/.legal_advocate_ai/action_items.db \
    --postgres postgresql://user:pass@host:5432/legal_advocate \
    --verify-only
```

### Using Alembic for Schema Changes

For database schema updates:

1. Create migration:
```bash
alembic revision --autogenerate -m "description of changes"
```

2. Review migration in `alembic/versions/`

3. Apply migration:
```bash
alembic upgrade head
```

4. Rollback if needed:
```bash
alembic downgrade -1
```

## Post-Deployment

### 1. Verify Health

Check health endpoint:
```bash
curl https://yourdomain.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2025-10-05T12:00:00"
}
```

### 2. Test API

```bash
# Get API info
curl https://yourdomain.com/

# Test authentication (with API key)
curl -H "X-API-Key: your-api-key" https://yourdomain.com/api/deadlines
```

### 3. Monitor Logs

**Railway:**
```bash
railway logs
```

**Render:**
- View in dashboard

**Docker:**
```bash
docker-compose logs -f
```

**Systemd:**
```bash
sudo journalctl -u legal-advocate-api -f
```

### 4. Setup Backups

Schedule daily backups:
```bash
# Add to crontab
0 2 * * * /opt/legal-advocate-ai/venv/bin/python /opt/legal-advocate-ai/scripts/backup_database.py --cleanup 30
```

### 5. Configure Sentry (Optional)

Add to environment:
```bash
SENTRY_DSN=your-sentry-dsn
SENTRY_ENVIRONMENT=production
```

Sentry will automatically capture errors and performance metrics.

## Troubleshooting

### Issue: Database connection fails

**Solution:**
1. Check DATABASE_URL format
2. Verify PostgreSQL is running
3. Check firewall rules
4. Test connection:
```bash
psql $DATABASE_URL
```

### Issue: Migrations fail

**Solution:**
1. Check database permissions
2. Manually run SQL:
```bash
alembic upgrade head --sql > migration.sql
psql $DATABASE_URL < migration.sql
```

### Issue: SendGrid emails not sending

**Solution:**
1. Verify API key is correct
2. Check SendGrid dashboard for errors
3. Verify sender email is verified in SendGrid
4. Check application logs:
```bash
grep "sendgrid" /var/log/legal-advocate/api.log
```

### Issue: High memory usage

**Solution:**
1. Reduce worker count:
```bash
WEB_CONCURRENCY=2
```
2. Enable connection pooling
3. Monitor with:
```bash
docker stats  # Docker
htop          # VPS
```

### Issue: CORS errors

**Solution:**
1. Add frontend URL to CORS_ORIGINS:
```bash
CORS_ORIGINS=https://frontend.com,https://app.frontend.com
```
2. Check middleware configuration
3. Verify in browser console

## Monitoring Best Practices

### 1. Health Checks

Monitor `/health` endpoint every 30 seconds:
- **200 OK**: System healthy
- **503**: Database issue
- **Timeout**: API not responding

### 2. Metrics

Monitor `/metrics` endpoint for:
- Request rate
- Error rate
- Response times
- Active connections

### 3. Alerts

Setup alerts for:
- API downtime (5+ minutes)
- Database connection failures
- High error rate (>5%)
- Disk space (>80%)

### 4. Performance

Monitor:
- Database query times
- API response times
- Worker queue length
- Memory usage

## Security Checklist

- [ ] Change default SECRET_KEY
- [ ] Use strong API_KEY
- [ ] Enable HTTPS/TLS
- [ ] Configure CORS properly
- [ ] Enable rate limiting
- [ ] Keep dependencies updated
- [ ] Regular security audits
- [ ] Backup encryption
- [ ] Database access controls
- [ ] API key rotation

## Scaling Considerations

### Horizontal Scaling

1. Load balancer (Nginx, HAProxy)
2. Multiple API instances
3. Shared PostgreSQL
4. Redis for session state
5. Separate worker nodes

### Database Scaling

1. Connection pooling (PgBouncer)
2. Read replicas
3. Partitioning
4. Query optimization
5. Index management

### Caching

1. Redis for session/cache
2. CDN for static assets
3. Query result caching
4. API response caching

## Support

For deployment issues:
- GitHub Issues: [link]
- Documentation: [link]
- Email: support@yourdomain.com
