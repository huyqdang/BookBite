# BookBite Backend — Architecture

## Overview

BookBite's backend is a **Node.js/Express** REST API built with **TypeScript**. It powers a social reading platform where users scroll through short, engaging story snippets extracted from books via an AI pipeline.

**Core technologies:**

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js + TypeScript |
| Framework | Express 5 |
| Database | PostgreSQL |
| ORM | Prisma 6 |
| Job Queue | BullMQ + Redis |
| AI | Anthropic Claude (primary) + OpenAI GPT-4o (fallback) |
| Auth | JWT (access + refresh tokens) |

---

## Layered Architecture

The backend follows a strict **4-layer architecture**. Each layer has a single responsibility and only communicates with its adjacent layer.

```
┌──────────────────────────────────────────────────────────┐
│                       Routes                             │
│  Define HTTP endpoints, attach middleware                 │
├──────────────────────────────────────────────────────────┤
│                     Controllers                          │
│  Parse requests, validate input, call services           │
├──────────────────────────────────────────────────────────┤
│                      Services                            │
│  Business logic, database queries, data enrichment       │
├──────────────────────────────────────────────────────────┤
│                    Data Layer                             │
│  Prisma ORM, Redis, external APIs (AI providers)         │
└──────────────────────────────────────────────────────────┘
```

**Rules:**
- Routes never contain business logic.
- Controllers never query the database directly.
- Services are the only layer that touches Prisma.
- Middleware (auth, rate limiting, error handling) runs between Routes and Controllers.

---

## Directory Structure

```
backend/
├── src/
│   ├── index.ts              # Express app entry point
│   ├── config/               # Configuration & connections
│   │   ├── env.ts            # Environment variable loader
│   │   ├── db.ts             # Prisma client singleton
│   │   └── redis.ts          # Redis/IORedis connection factory
│   ├── middleware/            # Express middleware
│   │   ├── auth.ts           # JWT authentication + RBAC
│   │   ├── errorHandler.ts   # Global error handler
│   │   └── rateLimiter.ts    # Rate limiting configs
│   ├── routes/               # Route definitions
│   │   ├── authRoutes.ts     # /api/auth/*
│   │   ├── feedRoutes.ts     # /api/feed
│   │   ├── storyRoutes.ts    # /api/stories/*
│   │   ├── userRoutes.ts     # /api/profile, /api/preferences, /api/bookmarks
│   │   └── adminRoutes.ts    # /api/admin/*
│   ├── controllers/          # Request handlers
│   │   ├── authController.ts
│   │   ├── feedController.ts
│   │   ├── storyController.ts
│   │   └── userController.ts
│   ├── services/             # Business logic
│   │   ├── authService.ts
│   │   ├── feedService.ts
│   │   ├── storyService.ts
│   │   └── userService.ts
│   ├── pipeline/             # AI story extraction pipeline
│   │   ├── queue.ts          # BullMQ queue & worker factory
│   │   ├── worker.ts         # 5-pass processing orchestrator
│   │   ├── extractor.ts      # PDF/TXT text extraction
│   │   ├── chunker.ts        # Smart text chunking
│   │   ├── categorizer.ts    # Category normalization
│   │   └── ai-processor.ts   # AI prompt engine (Claude + OpenAI)
│   ├── cli/                  # Command-line tools
│   │   ├── ingest.ts         # Bulk PDF/TXT ingestion
│   │   ├── queue-status.ts   # Queue monitoring
│   │   └── seed.ts           # Database seeding
│   └── utils/                # Shared utilities
│       ├── jwt.ts            # Token generation & verification
│       └── errors.ts         # Custom error classes
├── prisma/
│   └── schema.prisma         # Database schema
├── books/                    # Drop PDF/TXT files here for ingestion
├── package.json
├── tsconfig.json
└── .env.example
```

---

## Database Schema

### Entity Relationship Diagram

```
┌─────────────┐     1:1     ┌──────────────────┐
│    User      │────────────▶│  UserPreference   │
│              │             │                    │
│  id (UUID)   │             │  bookCategories[]  │
│  email       │             │  preferredReading  │
│  passwordHash│             │  onboarding done   │
│  appleId     │             └──────────────────┘
│  googleId    │
│  displayName │     1:N     ┌─────────────┐
│  role        │────────────▶│  Bookmark    │
│              │             │  userId      │
│              │     1:N     │  storyId     │◀── unique(userId, storyId)
│              │────────────▶│              │
│              │             └─────────────┘
│              │     1:N     ┌─────────────┐
│              │────────────▶│    Like      │
│              │             │  userId      │
│              │             │  storyId     │◀── unique(userId, storyId)
│              │             └─────────────┘
│              │     1:N     ┌─────────────┐
│              │────────────▶│  StoryView   │
└─────────────┘             │  readPercent │
                             │  viewedAt    │
                             └──────┬──────┘
                                    │ N:1
┌─────────────┐     1:N     ┌──────▼──────┐
│    Book      │────────────▶│    Story     │
│              │             │              │
│  title       │             │  title       │
│  author      │             │  content     │
│  categories[]│             │  readingTime │
│  purchaseLink│             │  categories[]│
│  sourceFile  │             │  tone        │
│  status      │             │  storyGroupId│
│  storyCount  │             │  likeCount   │
└─────────────┘             │  bookmarkCnt │
                             │  viewCount   │
                             └─────────────┘
```

### Key Design Decisions

- **`storyGroupId`**: Groups story variants (1/3/5/10 min) from the same source material. The feed uses this to avoid showing duplicates.
- **`sourceFile` (unique)**: Prevents re-processing the same PDF/TXT.
- **`BookStatus` enum** (`QUEUED → PROCESSING → COMPLETED/FAILED`): Tracks ingestion pipeline progress.
- **Composite unique constraints** on `Like(userId, storyId)` and `Bookmark(userId, storyId)`: Enforces one-like-per-user.
- **Denormalized counts** (`likeCount`, `bookmarkCount`, `viewCount`): Avoids expensive COUNT queries on the feed.

---

## Request Flow

A typical authenticated request follows this path:

```
Client Request
    │
    ▼
Express Middleware Stack
    │  helmet (security headers)
    │  cors (cross-origin)
    │  morgan (logging)
    │  express.json (body parsing)
    │  cookie-parser
    │  rateLimiter (100 req/15 min)
    │
    ▼
Route Matcher
    │  e.g. GET /api/feed
    │
    ▼
Auth Middleware (authenticate)
    │  Extract Bearer token
    │  Verify JWT signature
    │  Attach req.user = { userId, role }
    │
    ▼
Controller (feedController.getFeed)
    │  Parse query params (limit, cursor, readingTime)
    │  Call service
    │
    ▼
Service (feedService.getPersonalizedFeed)
    │  Query Prisma for stories
    │  Filter by preferences & viewed history
    │  Enrich with isLiked/isBookmarked
    │  Return paginated result
    │
    ▼
Response → Client
    { stories: [...], nextCursor, hasMore }
```

---

## Authentication System

### Token Strategy

BookBite uses a **dual-token JWT strategy**:

| Token | Purpose | Lifetime | Storage (client) |
|-------|---------|----------|-----------------|
| Access Token | Authenticates API requests | 15 minutes | iOS Keychain |
| Refresh Token | Obtains new access tokens | 7 days | iOS Keychain |

### Flow

```
1. Login/Register
   Client sends credentials → Server returns { accessToken, refreshToken }

2. Authenticated Requests
   Client sends: Authorization: Bearer <accessToken>
   Server verifies signature + expiry → attaches req.user

3. Token Refresh
   When access token expires (401) →
   Client sends refresh token to POST /api/auth/refresh →
   Server returns new { accessToken, refreshToken }

4. Social Auth (Apple / Google)
   Client handles OAuth flow → sends identity token to server →
   Server creates/links account → returns JWT pair
```

### Password Security

- Passwords are hashed with **bcryptjs** (12 salt rounds).
- Plain-text passwords are never stored or logged.

---

## Error Handling

### Custom Error Classes

```
AppError (base)
├── BadRequestError    (400)
├── UnauthorizedError  (401)
├── ForbiddenError     (403)
├── NotFoundError      (404)
└── ConflictError      (409)
```

### Global Error Handler

The `errorHandler` middleware catches all thrown errors:
- `AppError` instances → returns `{ error: message }` with the correct HTTP status.
- Unexpected errors → returns generic 500 with error details in development mode.

---

## Rate Limiting

| Limiter | Scope | Limit | Window |
|---------|-------|-------|--------|
| `generalLimiter` | All routes | 100 requests | 15 minutes |
| `authLimiter` | `/api/auth/*` | 20 requests | 15 minutes |
| `interactionLimiter` | Like/Bookmark/View | 60 requests | 1 minute |

---

## Environment Configuration

All configuration is loaded from `.env` via `src/config/env.ts`:

| Variable | Purpose | Default |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection string | — |
| `REDIS_HOST` / `REDIS_PORT` | Redis for BullMQ | `127.0.0.1:6379` |
| `JWT_ACCESS_SECRET` | Access token signing key | — |
| `JWT_REFRESH_SECRET` | Refresh token signing key | — |
| `JWT_ACCESS_EXPIRATION` | Access token TTL | `15m` |
| `JWT_REFRESH_EXPIRATION` | Refresh token TTL | `7d` |
| `ANTHROPIC_API_KEY` | Claude API key | — |
| `OPENAI_API_KEY` | GPT-4o API key | — |
| `PORT` | Server port | `3001` |

---

## NPM Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm run dev` | `tsx watch src/index.ts` | Development server with hot reload |
| `npm run build` | `tsc` | Compile TypeScript |
| `npm start` | `node dist/index.js` | Production server |
| `npm run seed` | `tsx src/cli/seed.ts` | Seed database with test data |
| `npm run ingest` | `tsx src/cli/ingest.ts` | Queue PDFs/TXTs for processing |
| `npm run worker` | `tsx src/pipeline/worker.ts` | Start BullMQ worker |
| `npm run queue:status` | `tsx src/cli/queue-status.ts` | Check queue status |
| `npm run db:generate` | `prisma generate` | Generate Prisma client |
| `npm run db:push` | `prisma db push` | Push schema to database |
| `npm run db:studio` | `prisma studio` | Open Prisma Studio GUI |
