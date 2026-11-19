# GCET Smart Placement Cell — Local VS Code & Public Deployment Guide

## 1. Architecture Summary

The workspace contains two coordinated parts:

1. **Primary Running Web Application (Node.js + Express + React + Vite + SQLite via `sql.js`)**
   - Frontend: React 19, TypeScript, Vite, Tailwind CSS (`src/`)
   - Backend API & Static Server: Express + TypeScript (`server.ts`, `server/db.ts`)
   - Database: Persistent SQLite database (`data/gcet_career_connect.db` by default, configurable via `DB_PATH`) with 30 relational tables and foreign keys enforced (`PRAGMA foreign_keys = ON`).
2. **Downloadable Java / Jakarta Servlet Source (`java-tomcat-portal/`)**
   - Separate Maven + Jakarta Servlets + JSP + HikariCP/JDBC + MySQL 8.0 source tree retained for standalone Java/Apache Tomcat 10.1 execution.

---

## 2. Running Locally in Visual Studio Code

1. Copy `.env.example` to `.env` and configure a strong random `SESSION_SECRET`:
   ```bash
   cp .env.example .env
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run in development mode (Vite HMR disabled + Express on port `3000`):
   ```bash
   npm run dev
   ```
4. Build and run in production mode:
   ```bash
   npm run build
   NODE_ENV=production npm start
   ```
5. Verify health endpoint:
   - Open `http://localhost:3000/api/health`

---

## 3. Public Cloud Deployment (Render / Railway / Google Cloud Run / Fly.io)

1. **Environment Variables**
   - `NODE_ENV=production`
   - `PORT=3000` (or the platform-assigned `PORT`)
   - `APP_URL=https://<your-public-domain>`
   - `CORS_ORIGIN=https://<your-public-domain>`
   - `SESSION_SECRET=<at least 32 random bytes, e.g. openssl rand -hex 32>`
   - `DB_PATH=/var/data/gcet_career_connect.db` (mount a persistent disk so database updates survive restarts)
2. **Build Command**
   ```bash
   npm ci && npm run build
   ```
3. **Start Command**
   ```bash
   npm start
   ```
4. **HTTPS & Security Behavior**
   - `trust proxy` is enabled (`app.set('trust proxy', 1)`), allowing secure cookies behind cloud reverse proxies (`X-Forwarded-Proto: https`).
   - Security headers (`X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`), origin-restricted CORS, and IP/account brute-force rate limiting are enabled automatically.
   - Production responses never expose raw SQL errors or stack traces.
