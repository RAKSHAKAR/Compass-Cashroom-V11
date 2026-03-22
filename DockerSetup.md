# CashRoom Compliance System - Docker Setup Guide

This document outlines the complete steps to run the CashRoom Compliance System (Frontend, Backend, and Mailcatcher) entirely within Docker.

## Prerequisites
Ensure Docker and Docker Compose (or Docker Desktop) are installed and running on your system.

---

## Step 1: Update Backend Requirements
The mailcatcher script requires `aiosmtpd` to run, which must be included in the Docker build process.

Open `backend/requirements.txt` and add the following to the very bottom of the file:
```text
aiosmtpd==1.4.6
````

## Step 2: Configure Mailcatcher for Docker

By default, the mailcatcher script listens on `localhost`, which means it cannot accept connections from other Docker containers. We must change it to listen on all network interfaces (`0.0.0.0`).

Open `backend/mailcatcher.py`, scroll to the very bottom, and update the host variables:

```python
if __name__ == "__main__":
    # CHANGE THESE FROM "localhost" TO "0.0.0.0"
    smtp_host, smtp_port = "0.0.0.0", 1025
    http_host, http_port = "0.0.0.0", 1080

    # ... rest of the file remains the same
```

## Step 3: Verify Frontend API Client

Ensure the frontend is configured to accept the API URL from the Docker build arguments rather than hardcoding it.

Open `frontend/src/api/client.ts` and ensure the `BASE_URL` looks like this:

```typescript
const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/v1'
```

*(Ensure there are no Vite proxy settings in `vite.config.ts`, as Nginx will be handling the static serving in Docker).*

## Step 4: The `docker-compose.yml` Configuration

Your `docker-compose.yml` in the root directory should look exactly like this.

**Key adjustments made:**

1.  Frontend is mapped to port `3000` (`3000:80`).
2.  Backend `SMTP_HOST` points to `mailcatcher`.
3.  Mailcatcher service is added with a custom `entrypoint` to override the default backend startup script.

<!-- end list -->

```yaml
version: "3.9"

services:
  # ── Backend (FastAPI) ───────────────────────────────────────────────────────
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: cashroom-backend
    restart: unless-stopped
    ports:
      - "8000:8000"
    volumes:
      - db_data:/app/data
    environment:
      DATABASE_URL: "sqlite:////app/data/cashroom.db"
      SECRET_KEY: "${SECRET_KEY:-change-me-in-production-32-chars-minimum}"
      ACCESS_TOKEN_EXPIRE_MINUTES: "60"
      REFRESH_TOKEN_EXPIRE_DAYS: "7"
      
      # ── Email (SMTP) ───────────────────────────────────────────────────────
      EMAIL_ENABLED: "true"
      SMTP_HOST: "mailcatcher"
      SMTP_PORT: "${SMTP_PORT:-1025}"
      SMTP_USER: "${SMTP_USER:-}"
      SMTP_PASSWORD: "${SMTP_PASSWORD:-}"
      FROM_EMAIL: "${FROM_EMAIL:-noreply@compass.com}"
      FROM_NAME: "${FROM_NAME:-CashRoom Compass}"

      # ── CORS ──────────────────────────────────────────────────────────────
      CORS_ORIGINS: '["http://localhost", "http://localhost:80", "http://localhost:3000"]'
      DEBUG: "false"

    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      start_period: 20s
      retries: 3

  # ── Frontend (React → nginx) ────────────────────────────────────────────────
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        VITE_API_URL: "http://localhost:8000/v1"
    container_name: cashroom-frontend
    restart: unless-stopped
    ports:
      - "3000:80"
    depends_on:
      backend:
        condition: service_healthy

  # ── MailCatcher (Debug SMTP Server) ─────────────────────────────────────────
  mailcatcher:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: cashroom-mailcatcher
    # Explicitly override the backend entrypoint.sh so it runs the email script
    entrypoint: ["python", "mailcatcher.py"]
    restart: unless-stopped
    ports:
      - "1080:1080"

# ── Volumes ────────────────────────────────────────────────────────────────────
volumes:
  db_data:
    driver: local
```

## Step 5: Build and Run

Whenever you make code changes or want to start the system, open your terminal (PowerShell/CMD/Bash) in the root directory and run the following command to clean up old instances and build fresh containers:

**For Windows (PowerShell):**

```powershell
docker-compose down --remove-orphans ; docker-compose up -d --build
```

**For Mac/Linux/Git Bash:**

```bash
docker-compose down --remove-orphans && docker-compose up -d --build
```

## Step 6: Access the Application

Once the containers are running and healthy, you can access the system at the following URLs:

  * 🖥️ **Frontend App:** [http://localhost:3000](https://www.google.com/search?q=http://localhost:3000)
  * ⚙️ **Backend API (Swagger):** [http://localhost:8000/docs](https://www.google.com/search?q=http://localhost:8000/docs)
  * 📧 **Mailcatcher (JSON feed):** [http://localhost:1080/emails](https://www.google.com/search?q=http://localhost:1080/emails)

### Viewing Emails in the Terminal

For a much cleaner, formatted view of intercepted emails, open a new terminal window and tail the logs of the mailcatcher container:

```bash
docker logs -f cashroom-mailcatcher
```

*Keep this terminal window open while you test the app. Any email triggered by the system will instantly print beautifully to this screen.*

```
```