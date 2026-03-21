# BookBite

A social media platform for book stories — rewritten, engaging, and perfectly sized for quick reads.

## Architecture

```
BookBite/
├── ios/                    SwiftUI iOS app (MVVM)
│   └── BookBite/
│       ├── App/            App entry, root navigation
│       ├── Models/         Data models (Story, User, etc.)
│       ├── Views/          SwiftUI views by feature
│       ├── ViewModels/     MVVM view models
│       ├── Services/       API client, Keychain
│       ├── Animations/     Custom animation helpers
│       └── Resources/      Design system (Theme.swift)
├── backend/                Node.js + Express + TypeScript
│   ├── books/              Drop PDFs/TXTs here for ingestion
│   ├── src/
│   │   ├── cli/            CLI tools (ingest, queue status)
│   │   ├── config/         DB, Redis, env config
│   │   ├── middleware/     Auth, rate limiting, errors
│   │   ├── routes/         Express routes
│   │   ├── controllers/    Request handlers
│   │   ├── services/       Business logic
│   │   └── pipeline/       PDF processing pipeline
│   └── prisma/             Database schema
└── README.md
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| iOS App | SwiftUI, MVVM, async/await |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL via Prisma ORM |
| Job Queue | BullMQ + Redis |
| AI | Claude (primary) + OpenAI (fallback) |
| Auth | JWT + Apple Sign-In + Google Sign-In |

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Xcode 15+ (for iOS)

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database URL, API keys, etc.

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed with sample data
npm run seed

# Start development server
npm run dev
```

### iOS Setup

1. Open `ios/BookBite.xcodeproj` in Xcode
2. Update the API base URL in `Services/APIService.swift`
3. Build and run on simulator or device (iOS 17+)

### Book Ingestion Pipeline

```bash
# Drop PDF/TXT files into the books folder
cp ~/my-books/*.pdf backend/books/

# Queue all files for processing
npm run ingest

# Or point to a custom folder
npm run ingest ~/Downloads/ebooks/

# Check processing status
npm run queue:status

# Start the background worker (processes one book at a time)
npm run worker
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Email/password signup |
| POST | `/api/auth/login` | Email/password login |
| POST | `/api/auth/apple` | Apple Sign-in |
| POST | `/api/auth/google` | Google Sign-in |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/feed` | Personalized infinite feed |
| GET | `/api/stories/:id` | Single story detail |
| POST | `/api/stories/:id/like` | Toggle like |
| POST | `/api/stories/:id/bookmark` | Toggle bookmark |
| POST | `/api/stories/:id/view` | Track story view |
| GET | `/api/bookmarks` | User's bookmarked stories |
| GET | `/api/preferences` | Get user preferences |
| PUT | `/api/preferences` | Update preferences |
| GET | `/api/profile` | User profile + stats |
| PUT | `/api/profile` | Update profile |

## Story Extraction Pipeline

The 5-pass deep extraction pipeline maximizes stories per book:

1. **Book Analysis** — Detect category, structure, story density
2. **Story Discovery** — Identify all story candidates per chunk
3. **Deep Extraction** — Rewrite each story with varied styles
4. **Reading Time Variants** — Generate 1, 3, 5, 10 min versions
5. **Cross-Reference Sweep** — Catch missed stories

Target: 30-100+ stories per book depending on type.

## Test Accounts

After running `npm run seed`:

| Email | Password | Role |
|-------|----------|------|
| admin@bookbite.app | admin123456 | Admin |
| test@bookbite.app | test123456 | User |
