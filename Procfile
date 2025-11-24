# Procfile for Heroku/Railway/Render deployment

# Web server (API)
web: sh -c "alembic upgrade head && gunicorn api.main:app --bind 0.0.0.0:${PORT:-8000} --worker-class uvicorn.workers.UvicornWorker --workers ${WEB_CONCURRENCY:-4} --timeout ${WORKER_TIMEOUT:-120}"

# Background worker (Alert Engine)
worker: python alert_engine.py

# Database migration (one-off)
release: alembic upgrade head
