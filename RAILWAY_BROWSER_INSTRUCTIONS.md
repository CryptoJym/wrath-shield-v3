# Railway Deployment - Browser Instructions for Agent

Give these instructions to your browser automation agent.

---

## Part 1: Create Railway Project

1. Navigate to: https://railway.app/dashboard
2. Click button: "New Project"
3. Click option: "Deploy from GitHub repo"
4. Find and click repository: "CryptoJym/legal-advocate-ai"
5. Select branch: "main"
6. Click: "Deploy Now"

---

## Part 2: Add PostgreSQL Database

1. In the Railway project view, click: "New"
2. Select: "Database"
3. Click: "Add PostgreSQL"
4. Wait for database to provision (this creates DATABASE_URL automatically)

---

## Part 3: Configure Environment Variables

1. Click on the "legal-advocate-ai" service card
2. Click tab: "Variables"
3. Click: "Raw Editor" (easier to paste multiple variables)

4. Paste the following configuration (I've already generated the secure keys):

```
SECRET_KEY=6835303fc3c2eb0c7683aa881bda31d6098cac6d037003db35ba0d19ab548b37
API_KEY=ebdb0fc6e40188608c90028afe63fa7ace6d186823bceb5b8a844ce155bb556c
ENVIRONMENT=production
```

5. Continue by adding these additional variables:

```
MYCASE_USERNAME=James@jamesbrady.org
MYCASE_PASSWORD=3$!cD%VX
MYCASE_PORTAL_URL=https://mycase.utcourts.gov/MyCaseWEB/LoginServlet
ADMIN_EMAIL=James@jamesbrady.org
```

6. Click: "Save" or "Deploy" button

---

## Part 5: Verify Deployment

1. Wait for deployment to complete (watch for "Success" indicator)
2. Click "Deployments" tab
3. Look for latest deployment status: should show "Success"
4. Click on the deployment to see logs
5. Check for: "Application startup complete" in logs
6. Copy the Railway-provided URL (looks like: https://legal-advocate-ai-production.up.railway.app)

---

## Part 6: Test the Deployment

1. Navigate to: `<your-railway-url>/health`
2. You should see: `{"status": "healthy"}`

---

## Notes for Agent

- If deployment fails, check the "Logs" tab for error messages
- The database migration runs automatically on first deployment
- The app will restart automatically after adding environment variables
- DATABASE_URL is automatically provided by Railway - do not add it manually

---

## All credentials are included - deployment ready!
