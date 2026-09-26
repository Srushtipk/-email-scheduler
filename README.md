# ReachInbox — Email Campaign Scheduler

A full-stack email scheduling platform built as an assessment project demonstrating production-grade backend architecture.

**Demo Video:** [Insert Loom Link Here]
**Hosted Frontend:** [Insert Vercel/GitHub Pages Link Here]

## Architecture Overview

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

### How Scheduling Works
When a user submits a CSV of emails, the backend parses them and calculates a specific UNIX timestamp for each email based on the requested `Start Time` and `Delay Between Emails`. These emails are pushed into a BullMQ queue backed by Redis with a `delay` parameter. BullMQ holds them in a "delayed" set and only moves them to "active" processing when the exact timestamp is reached.

### How Persistence on Restart is Handled
Because jobs are pushed directly to Redis, they are entirely decoupled from the Node.js memory heap. If the backend server crashes or is restarted, the jobs remain safely stored in Redis. Upon restart, the BullMQ worker automatically reconnects to Redis and resumes processing any pending or delayed jobs exactly where it left off.

### How Rate Limiting & Concurrency are Implemented
- **Concurrency:** The BullMQ worker is instantiated with a concurrency limit of 5 (`{ concurrency: 5 }`), meaning it processes a maximum of 5 emails simultaneously to prevent CPU/Network blocking.
- **Rate Limiting:** A custom rate limiter is implemented using Redis. Before sending an email, the worker checks a Redis key for the current hour (`rate_limit:userId:currentHour`). If the count exceeds the `Hourly Limit`, the worker throws a `DelayedError` and pushes the job to the start of the next hour, protecting the SMTP reputation.

## Features Implemented

### Backend
- **Scheduler:** Parses CSVs and creates precise delayed jobs using BullMQ.
- **Persistence:** Postgres as source-of-truth, Redis for queue durability.
- **Rate Limiting:** Hourly limits per user enforced via Redis counters with Slack webhook alerts on breach.
- **Concurrency:** Worker concurrency throttled to 5.
- **Search:** Emails are indexed in Elasticsearch for lightning-fast lookups.
- **Open Tracking:** Injects a 1x1 transparent pixel to track when users open the email.

### Frontend
- **Login:** Google OAuth 2.0 integration (currently bypassed for demo review purposes).
- **Dashboard:** Tabbed view of Scheduled vs Sent emails with real-time status badges (`PENDING`, `SENT`, `OPENED`, `DELAYED`, `FAILED`).
- **Compose:** Form to define Subject, Body, Start Time, Delay, Hourly Limit, and CSV upload.
- **Tables:** Paginated table view mapping email data to the UI.
- **Live Search:** Search bar querying Elasticsearch directly with a 300ms debounce.
- **Health Check UI:** Live ping dot to ensure DB/Redis/ES are online.

## Note on Assumptions, Shortcuts, or Trade-offs

1. **Authentication Shortcut:** For ease of review for the recruiter, the Google OAuth flow has been bypassed with a mock "Demo User" auto-login. The JWT verification logic still exists in the backend architecture but is temporarily disabled so reviewers can instantly access the dashboard.
2. **Ethereal Mail:** Ethereal SMTP is used instead of Amazon SES/SendGrid to avoid exposing API keys in the repo, as per standard hackathon practice.
3. **Elasticsearch Trade-off:** Running Elasticsearch locally requires significant memory. In a real production environment, AWS OpenSearch would be used. The frontend gracefully degrades if Elasticsearch is unavailable.

## Setup Instructions

### Prerequisites
- Node.js 18+
- Docker & Docker Compose

### 1. Start Infrastructure
```bash
docker-compose up -d
```
This spins up PostgreSQL, Redis, and Elasticsearch.

### 2. Backend & Env Variables
Navigate to the `backend` folder and create a `.env` file:
```bash
cd backend
cp .env.example .env
```
Fill in the `.env`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/email_scheduler"
JWT_SECRET="super-secret-key"
ETHEREAL_USER="your-ethereal-user@ethereal.email"
ETHEREAL_PASS="your-ethereal-pass"
ELASTICSEARCH_URL="http://localhost:9200"
```
Install dependencies and run:
```bash
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
