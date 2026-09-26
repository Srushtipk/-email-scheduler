# ReachInbox — Email Campaign Scheduler

A full-stack email scheduling platform with async queuing, rate limiting, and real-time monitoring. Built as an assessment project demonstrating production-grade backend architecture.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, TailwindCSS v3, Axios |
| Backend | Node.js, Express, TypeScript, Prisma ORM |
| Database | PostgreSQL (primary store) |
| Queue | Redis + BullMQ (async job processing) |
| Search | Elasticsearch 8.x (dashboard queries) |
| Email | Nodemailer via Ethereal SMTP |
| Auth | Google OAuth 2.0 + JWT |

## Features

- **CSV Upload** — Upload a CSV file with recipient emails. The parser scans all columns to find email addresses automatically.
- **Scheduled Delivery** — Set a future start time and emails are queued with the exact delay in BullMQ.
- **Rate Limiting** — Per-user hourly limits enforced via Redis counters. When the limit is hit, remaining emails are delayed to the next hour.
- **Slack Alerts** — Incoming Webhook integration sends real-time notifications when rate limits are breached.
- **Retry Failed Jobs** — One-click retry button re-queues failed emails back into BullMQ without duplicates.
- **Live Search** — Search bar queries Elasticsearch directly with 300ms debounce.
- **Health Check API** — `/api/health` endpoint reports status of Postgres, Redis, and Elasticsearch.
- **Idempotency** — `@@unique([campaignId, recipientEmail])` in Prisma + BullMQ `jobId` hashing prevents duplicate sends.
- **Crash Recovery** — Jobs persist in Redis. If the server restarts, the worker picks up exactly where it left off.
- **Light/Dark Theme** — Toggle between light and dark mode, persisted in localStorage.
- **Auto-Refresh** — Dashboard polls every 10 seconds so you can watch emails move from Scheduled → Sent.
- **Toast Notifications** — Non-blocking feedback instead of browser alerts.

## Architecture

```
┌──────────┐     ┌───────────┐     ┌─────────┐
│  React   │────▶│  Express  │────▶│ Postgres │
│ Frontend │     │  Backend  │     │  (Prisma)│
└──────────┘     └─────┬─────┘     └─────────┘
                       │
                 ┌─────▼─────┐
                 │   Redis   │
                 │  (BullMQ) │
                 └─────┬─────┘
                       │
                 ┌─────▼─────┐     ┌───────────────┐
                 │  Worker   │────▶│ Ethereal SMTP  │
                 │ (send)    │     └───────────────┘
                 └─────┬─────┘
                       │
                 ┌─────▼──────────┐
                 │ Elasticsearch  │
                 │ (status index) │
                 └────────────────┘
```

## Getting Started

### Prerequisites
- Node.js 18+
- Docker & Docker Compose

### 1. Start infrastructure

```bash
docker-compose up -d
```

This spins up PostgreSQL, Redis, and Elasticsearch.

### 2. Backend

```bash
cd backend
cp .env.example .env   # then fill in your credentials
npm install
npx prisma db push
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Environment Variables

Create `backend/.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/email_scheduler"
GOOGLE_CLIENT_ID="your-google-client-id"
JWT_SECRET="super-secret-key"
ETHEREAL_USER="your-ethereal-user"
ETHEREAL_PASS="your-ethereal-pass"
ELASTICSEARCH_URL="http://localhost:9200"
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/google` | Google OAuth login |
| POST | `/api/auth/slack-webhook` | Save Slack webhook URL |
| POST | `/api/campaigns` | Create and queue a campaign |
| GET | `/api/search?q=term` | Search emails via Elasticsearch |
| GET | `/api/health` | Service health check |
| POST | `/api/retry/:jobId` | Retry a failed email job |

## Demo Scenarios

### Restart Recovery
1. Schedule emails for 2 minutes in the future
2. Stop the backend server (`Ctrl+C`)
3. Restart it (`npm run dev`)
4. Emails still send on time — BullMQ persisted them in Redis

### Rate Limiting + Slack
1. Connect Slack via the dashboard
2. Schedule a campaign with **Hourly Limit = 1** and 3 recipients
3. First email sends, remaining are delayed
4. Slack notification fires automatically
