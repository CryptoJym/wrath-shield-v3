# Production Configuration Guide

Complete reference for configuring Legal Advocate AI in production environments.

## Environment Variables Reference

### Core Settings

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ENVIRONMENT` | No | `development` | Environment name: `development`, `production`, `testing` |
| `SECRET_KEY` | Yes (prod) | - | Secret key for session encryption (generate with `openssl rand -hex 32`) |
| `API_KEY` | Yes (prod) | - | API authentication key for client access |

### Database

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes (prod) | SQLite path | PostgreSQL connection string: `postgresql://user:pass@host:port/dbname` |

**PostgreSQL Format:**
```
postgresql://username:password@hostname:5432/database_name
```

**Auto-conversion from Heroku/Railway:**
The system automatically converts `postgres://` to `postgresql://`.

### Email / SendGrid

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SENDGRID_API_KEY` | Yes | - | SendGrid API key for sending alerts |
| `SENDGRID_FROM_EMAIL` | Yes | - | Verified sender email address |
| `ADMIN_EMAIL` | No | - | Admin email for system notifications |

**SendGrid Setup:**
1. Create account at https://sendgrid.com
2. Create API key with "Mail Send" permissions
3. Verify sender email address
4. Add API key to environment

### Error Tracking (Sentry)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SENTRY_DSN` | No | - | Sentry DSN for error tracking |
| `SENTRY_ENVIRONMENT` | No | `production` | Environment tag for Sentry events |
| `SENTRY_TRACES_SAMPLE_RATE` | No | `0.1` | Performance monitoring sample rate (0.0-1.0) |

**Sentry Setup:**
1. Create account at https://sentry.io
2. Create new project (Python/FastAPI)
3. Copy DSN from project settings
4. Add to environment variables

### Security & CORS

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CORS_ORIGINS` | Yes (prod) | - | Comma-separated list of allowed origins |

**CORS Configuration:**
```bash
# Single origin
CORS_ORIGINS=https://yourdomain.com

# Multiple origins
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com,https://admin.yourdomain.com
```

### Logging

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LOG_LEVEL` | No | `INFO` | Logging level: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL` |

**Production Recommendation:** Use `INFO` or `WARNING` to reduce log volume.

### Rate Limiting

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RATE_LIMIT_ENABLED` | No | `true` | Enable/disable rate limiting |
| `RATE_LIMIT_PER_MINUTE` | No | `60` | Max requests per minute per IP |

**Production Recommendation:** Enable rate limiting to prevent abuse.

### Background Jobs

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SCHEDULER_ENABLED` | No | `true` | Enable/disable alert scheduler |
| `ALERT_CHECK_INTERVAL_MINUTES` | No | `15` | How often to check for due alerts |

**Production Recommendation:** Run scheduler in separate worker process.

### Gunicorn (Production Web Server)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `WEB_CONCURRENCY` | No | `4` | Number of worker processes |
| `WORKER_CLASS` | No | `uvicorn.workers.UvicornWorker` | Worker class for Gunicorn |
| `WORKER_TIMEOUT` | No | `120` | Worker timeout in seconds |

**Worker Calculation:**
```
workers = (2 × CPU_CORES) + 1
```

For 2 CPU cores: 5 workers
For 4 CPU cores: 9 workers

### MyCase Integration (Optional)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MYCASE_USERNAME` | No | - | MyCase portal username |
| `MYCASE_PASSWORD` | No | - | MyCase portal password |
| `MYCASE_PORTAL_URL` | No | - | MyCase portal URL |

### Gmail API (Optional)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GMAIL_CREDENTIALS_FILE` | No | `credentials.json` | OAuth2 credentials file |
| `GMAIL_TOKEN_FILE` | No | `token.json` | OAuth2 token file |

### AI/LLM (Optional)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OLLAMA_BASE_URL` | No | `http://localhost:11434` | Ollama API base URL |
| `OLLAMA_MODEL` | No | `deepseek-r1:8b` | Ollama model name |

### ChromaDB (Optional)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CHROMA_PERSIST_DIR` | No | `~/.legal_advocate_ai/chroma` | ChromaDB persistence directory |

## Configuration Templates

### Railway Template

```bash
# Required
ENVIRONMENT=production
DATABASE_URL=${RAILWAY_DATABASE_URL}
SECRET_KEY=${RAILWAY_SECRET_KEY}
API_KEY=${RAILWAY_API_KEY}
SENDGRID_API_KEY=your-sendgrid-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
CORS_ORIGINS=https://yourdomain.com

# Optional
ADMIN_EMAIL=admin@yourdomain.com
SENTRY_DSN=your-sentry-dsn
LOG_LEVEL=INFO
WEB_CONCURRENCY=4
```

### Render Template

```bash
# Required
ENVIRONMENT=production
DATABASE_URL=${DATABASE_URL}
SECRET_KEY=${SECRET_KEY}
API_KEY=${API_KEY}
SENDGRID_API_KEY=your-sendgrid-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
CORS_ORIGINS=https://yourdomain.com

# Optional
ADMIN_EMAIL=admin@yourdomain.com
SENTRY_DSN=your-sentry-dsn
LOG_LEVEL=INFO
WEB_CONCURRENCY=4
```

### Docker Template

```bash
# .env file for docker-compose
ENVIRONMENT=production
POSTGRES_PASSWORD=secure-postgres-password
DATABASE_URL=postgresql://postgres:secure-postgres-password@db:5432/legal_advocate
SECRET_KEY=your-secret-key
API_KEY=your-api-key
SENDGRID_API_KEY=your-sendgrid-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
ADMIN_EMAIL=admin@yourdomain.com
SENTRY_DSN=your-sentry-dsn
CORS_ORIGINS=https://yourdomain.com
LOG_LEVEL=INFO
WEB_CONCURRENCY=4
```

## Security Best Practices

### 1. Generate Secure Keys

**SECRET_KEY:**
```bash
python -c 'import secrets; print(secrets.token_hex(32))'
# Or
openssl rand -hex 32
```

**API_KEY:**
```bash
python -c 'import secrets; print(secrets.token_urlsafe(32))'
# Or
openssl rand -base64 32
```

### 2. Secure Environment Variables

**Never commit secrets to Git:**
- Use `.env` files (in `.gitignore`)
- Use platform secret management (Railway Secrets, Render Environment Variables)
- Use cloud provider secrets (AWS Secrets Manager, GCP Secret Manager)

**Rotation Schedule:**
- SECRET_KEY: Every 6 months
- API_KEY: Every 3 months
- Database passwords: Every 6 months
- API keys (SendGrid, Sentry): Annually or on compromise

### 3. Database Security

**Connection Security:**
```bash
# Require SSL
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

# With client certificate
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=verify-full&sslcert=/path/to/cert&sslkey=/path/to/key&sslrootcert=/path/to/ca
```

**Access Control:**
- Create dedicated database user (not `postgres`)
- Grant minimal permissions
- Use strong passwords
- Enable connection limits

### 4. CORS Configuration

**Strict Production CORS:**
```bash
# ❌ Never use in production
CORS_ORIGINS=*

# ✅ Specific origins only
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

**Wildcard Subdomains:**
```python
# In api/middleware.py if needed
CORS_ORIGINS = [
    "https://yourdomain.com",
    "https://*.yourdomain.com"
]
```

## Configuration Validation

### Startup Validation

The application validates configuration on startup:

```python
# config/production.py
class ProductionConfig:
    @classmethod
    def validate(cls):
        """Validates required production settings"""
        errors = []

        if not cls.DATABASE_URL:
            errors.append("DATABASE_URL is required")

        if not cls.SECRET_KEY:
            errors.append("SECRET_KEY is required")

        # ... more validations

        if errors:
            raise ValueError(f"Configuration errors: {', '.join(errors)}")
```

### Manual Validation

```bash
# Test configuration
python -c "from config import get_config; get_config('production').validate()"
```

### Environment Check

```bash
# Check all required vars are set
python scripts/check_env.py
```

## Performance Tuning

### Database Connection Pooling

```bash
# Recommended settings for PostgreSQL
DATABASE_URL=postgresql://user:pass@host:5432/db?pool_size=20&max_overflow=10
```

### Worker Optimization

**CPU-bound tasks:**
```bash
WEB_CONCURRENCY=4  # 2 × CPU cores
WORKER_CLASS=uvicorn.workers.UvicornWorker
```

**I/O-bound tasks:**
```bash
WEB_CONCURRENCY=8  # 4 × CPU cores
WORKER_CLASS=uvicorn.workers.UvicornWorker
```

### Logging Performance

```bash
# Production: Reduce log volume
LOG_LEVEL=WARNING

# Debug issues temporarily
LOG_LEVEL=DEBUG
```

## Monitoring Configuration

### Health Check

```bash
# Railway/Render auto-configure
# Manual: Monitor /health endpoint

curl https://yourdomain.com/health
```

### Metrics

```bash
# Access metrics endpoint
curl https://yourdomain.com/metrics
```

### Sentry Configuration

```python
# Automatic configuration when SENTRY_DSN is set
# Custom traces sample rate
SENTRY_TRACES_SAMPLE_RATE=0.2  # 20% of transactions
```

## Troubleshooting Configuration

### Check Current Configuration

```bash
# View active config
python -c "from config import get_config; import json; print(json.dumps(vars(get_config()), indent=2))"
```

### Common Issues

**Issue: "DATABASE_URL is required"**
- Ensure DATABASE_URL is set in environment
- Check for typos in variable name
- Verify database is accessible

**Issue: "CORS error in browser"**
- Add frontend URL to CORS_ORIGINS
- Check for protocol mismatch (http vs https)
- Verify no trailing slashes

**Issue: "SendGrid authentication failed"**
- Verify API key is correct
- Check API key permissions (Mail Send required)
- Verify sender email is verified in SendGrid

**Issue: "Workers timeout"**
- Increase WORKER_TIMEOUT
- Reduce WEB_CONCURRENCY
- Optimize database queries

## Configuration Migration

### From Development to Production

```bash
# 1. Copy .env.example
cp .env.example .env.production

# 2. Edit with production values
nano .env.production

# 3. Validate
ENVIRONMENT=production python -c "from config import get_config; get_config().validate()"

# 4. Deploy
source .env.production
python -m gunicorn api.main:app --config gunicorn.conf.py
```

### Configuration Inheritance

```python
# Development inherits from Base
class DevelopmentConfig(BaseConfig):
    DEBUG = True

# Production overrides Base
class ProductionConfig(BaseConfig):
    DEBUG = False
    DATABASE_URL = os.getenv("DATABASE_URL")  # Required in prod
```

## References

- [FastAPI Configuration](https://fastapi.tiangolo.com/advanced/settings/)
- [Gunicorn Settings](https://docs.gunicorn.org/en/stable/settings.html)
- [PostgreSQL Connection Strings](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING)
- [SendGrid API Documentation](https://docs.sendgrid.com/)
- [Sentry Python SDK](https://docs.sentry.io/platforms/python/)
