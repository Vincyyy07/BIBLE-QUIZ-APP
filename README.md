# ✝ Bible Quiz Platform

A real-time multiplayer Bible Quiz Platform for church events supporting **~200 simultaneous participants**.

## Quick Start

### Prerequisites
- Node.js v18+
- PostgreSQL (local or cloud)

### 1. Clone & Install
```bash
git clone <repo>
cd bible-quiz
npm run install:all
```

### 2. Set up Database
**⚠️ External service required: PostgreSQL**

Create a PostgreSQL database:
```sql
CREATE DATABASE biblequiz;
```

### 3. Configure Environment
```bash
# In server/
cp ../.env.example server/.env
```

Edit `server/.env`:
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/biblequiz
HOST_SECRET=generate-with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 4. Run Database Migration
```bash
npm run db:migrate
```

### 5. Start Development
```bash
npm run dev
```
- Client: http://localhost:5173
- Server: http://localhost:3001

---

## The Three Interfaces

| URL | Who Uses It | Device |
|-----|-------------|--------|
| `/host` | Quiz host/team | Desktop/Laptop |
| `/join` → `/play` | Participants | Mobile phone |
| `/display/CODE` | Church projector | TV/Projector |

---

## Host Workflow

1. Go to `/host`
2. Create a quiz with a title
3. Add questions using the question builder
4. Click **Open Lobby** — participants see the join code
5. Click **Start Quiz** when ready
6. Click **Next Question** after each round
7. Click **End Quiz** to show final results

---

## Participant Workflow

1. Go to `/join` on their phone
2. Enter the **quiz code** (shown on projector/host screen)
3. Enter their **name**
4. Wait for the host to start
5. Answer each question before the timer expires
6. See their rank after each question

---

## Church Event Setup (Local Network — Recommended)

For maximum reliability, run the server on a **local laptop** connected to the church Wi-Fi:

```bash
# Start server on laptop
cd server && npm start

# Find your laptop's local IP (run in cmd)
ipconfig  # look for IPv4 Address, e.g. 192.168.1.50

# Update client/.env
VITE_API_URL=http://192.168.1.50:3001
VITE_SOCKET_URL=http://192.168.1.50:3001

# Build client
cd client && npm run build && npm run preview -- --host
```

Participants connect to: `http://192.168.1.50:4173/join`

> ✅ This works without internet. Zero latency. Full reliability.

---

## Load Testing

```bash
# Install Socket.IO client in load-test dir
cd load-test && npm init -y && npm install socket.io-client

# Run with 200 virtual clients
node simulate.js --clients 200 --code BIBLE25 --url http://localhost:3001
```

---

## Architecture

```
React (Vite + Tailwind)
  /host    → Host Dashboard (create, manage, control quiz)
  /join    → Participant join form
  /play    → Real-time quiz interface (mobile-first)
  /display → Projector screen (PowerPoint-style)
       ↕ Socket.IO WebSocket + REST API
Node.js + Express + Socket.IO
       ↕ pg Pool (parameterized queries)
PostgreSQL
```

**Backend is authoritative for:**
- Quiz state & status
- Server-time timer (`questionStartedAt`, `questionEndsAt`)
- Answer validation (checks deadline server-side)
- Scoring (never trusted from client)
- Leaderboard ranking

---

## Scoring & Tie-Breaking

- Correct answer (before deadline): +10 points (configurable per question)
- Incorrect / no answer: 0 points

**Tie-breaking rules (in priority order):**
1. Higher `total_score`
2. If tied → higher `correct_answers`
3. If still tied → earlier `last_correct_at` (faster overall correct answers)

---

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Server port (default: 3001) |
| `DATABASE_URL` | PostgreSQL connection string |
| `CLIENT_URL` | React app URL (for CORS) |
| `HOST_SECRET` | JWT signing secret (min 32 chars) |
| `NODE_ENV` | `development` or `production` |
| `VITE_API_URL` | Backend API URL (client) |
| `VITE_SOCKET_URL` | Backend Socket.IO URL (client) |

---

## Deployment Options

| Platform | WebSocket Support | Free Tier | Notes |
|---|---|---|---|
| **Local Laptop** | ✅ Full | ✅ Free | **Best for church events** |
| Railway.app | ✅ Full | ✅ Limited | PostgreSQL add-on available |
| Render.com | ✅ Full | ⚠️ Sleeps after 15min | Use $7/mo paid plan for events |
| Fly.io | ✅ Full | ✅ Limited | Good WebSocket support |

> **Important:** For the actual church event with 200 participants, use the **local laptop** approach. It eliminates internet dependency and ensures reliable WebSocket connections.

---

## Security Features

- JWT host authentication on every privileged event
- Server-side timer validation (late answers rejected)
- Server-side scoring (client cannot manipulate)
- Parameterized SQL queries (SQL injection prevention)
- Rate limiting on all API endpoints
- Input validation on all fields
- Duplicate answer prevention
- Session validation on reconnection
