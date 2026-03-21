# BookBite Backend — Features

Detailed documentation for every feature, endpoint, and subsystem.

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [User Profiles & Preferences](#2-user-profiles--preferences)
3. [Personalized Feed](#3-personalized-feed)
4. [Story Interactions](#4-story-interactions)
5. [Bookmarks](#5-bookmarks)
6. [AI Story Extraction Pipeline](#6-ai-story-extraction-pipeline)
7. [CLI Tools](#7-cli-tools)
8. [Admin API](#8-admin-api)
9. [Database Seeding](#9-database-seeding)

---

## 1. Authentication

### Overview

The auth system supports three methods: email/password, Apple Sign-In, and Google Sign-In. All methods return the same JWT token pair.

### Endpoints

#### `POST /api/auth/register`

Creates a new user account with email and password.

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "displayName": "Jane Doe"
}
```

**Response (201):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "Jane Doe",
    "role": "USER",
    "onboardingCompleted": false
  },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

**What happens internally:**
1. Validates that email is not already registered.
2. Hashes password with bcrypt (12 rounds).
3. Creates `User` record with empty `UserPreference`.
4. Generates JWT token pair.

#### `POST /api/auth/login`

Authenticates an existing user.

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response (200):** Same shape as register.

#### `POST /api/auth/apple`

Handles Apple Sign-In. Creates or links account by Apple ID or email.

**Request body:**
```json
{
  "identityToken": "apple-jwt-token",
  "authorizationCode": "auth-code",
  "email": "user@icloud.com",
  "fullName": "Jane Doe"
}
```

#### `POST /api/auth/google`

Handles Google Sign-In. Same pattern as Apple.

**Request body:**
```json
{
  "idToken": "google-jwt-token",
  "email": "user@gmail.com",
  "displayName": "Jane Doe"
}
```

#### `POST /api/auth/refresh`

Exchanges a valid refresh token for a new token pair.

**Request body:**
```json
{
  "refreshToken": "eyJ..."
}
```

**Response (200):**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

### Social Auth Linking

When a social auth request arrives, the system follows this priority:
1. **Find by provider ID** (appleId/googleId) → log in to that account.
2. **Find by email** → link the provider ID to the existing account.
3. **No match** → create a new account (no password required).

---

## 2. User Profiles & Preferences

### Overview

Each user has a profile and a set of preferences that drive feed personalization. Preferences are set during onboarding and can be updated later.

### Endpoints

#### `GET /api/profile` (authenticated)

Returns the user's profile, preferences, and engagement stats.

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "displayName": "Jane Doe",
  "avatarUrl": null,
  "role": "USER",
  "preferences": {
    "bookCategories": ["Self-Help", "Psychology", "Business"],
    "preferredReadingTime": 3,
    "onboardingCompleted": true
  },
  "stats": {
    "totalLikes": 42,
    "totalBookmarks": 15,
    "storiesRead": 128
  }
}
```

**Stats calculation:**
- `totalLikes`: COUNT of Like records for this user.
- `totalBookmarks`: COUNT of Bookmark records for this user.
- `storiesRead`: COUNT of StoryView records for this user.

#### `PUT /api/profile` (authenticated)

Updates display name and/or avatar.

**Request body:**
```json
{
  "displayName": "New Name",
  "avatarUrl": "https://..."
}
```

#### `GET /api/preferences` (authenticated)

Returns just the preferences object (creates defaults if none exist).

#### `PUT /api/preferences` (authenticated)

Updates reading preferences.

**Request body:**
```json
{
  "bookCategories": ["Fiction", "Philosophy"],
  "preferredReadingTime": 5,
  "onboardingCompleted": true
}
```

---

## 3. Personalized Feed

### Overview

The feed is the core feature. It serves an infinite scroll of story cards personalized to each user's category preferences, reading time preference, and viewing history.

### Endpoint

#### `GET /api/feed` (authenticated)

**Query parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 20 | Stories per page |
| `cursor` | string | — | Pagination cursor (story ID) |
| `readingTime` | number | — | Override preferred reading time filter |

**Response:**
```json
{
  "stories": [
    {
      "id": "uuid",
      "title": "The British Cycling Revolution",
      "content": "In 2003, British cycling was a joke...",
      "summary": null,
      "readingTimeMinutes": 3,
      "categories": ["Self-Help", "Psychology"],
      "tone": "inspiring",
      "likeCount": 42,
      "bookmarkCount": 15,
      "viewCount": 230,
      "createdAt": "2026-02-07T...",
      "book": {
        "id": "uuid",
        "title": "Atomic Habits",
        "author": "James Clear",
        "coverUrl": null,
        "purchaseLink": "https://amazon.com/..."
      },
      "isLiked": false,
      "isBookmarked": true
    }
  ],
  "nextCursor": "uuid-of-last-story",
  "hasMore": true
}
```

### Personalization Algorithm

The feed service follows this logic:

1. **Load user preferences** — categories and preferred reading time.
2. **Exclude viewed stories** — queries `StoryView` to get IDs the user has already seen.
3. **Filter** — matches stories where:
   - `readingTimeMinutes` equals the user's preferred time (or query override).
   - `categories` overlaps with the user's selected categories.
   - Story ID is NOT in the viewed set.
4. **Order** — by `createdAt DESC` (newest first).
5. **Paginate** — cursor-based using story ID. Returns `limit` results + `nextCursor`.
6. **Enrich** — for each story, checks if the current user has liked/bookmarked it.

### Cursor-Based Pagination

Instead of offset-based pagination (which breaks when new content is inserted), the feed uses cursor pagination:

```
Page 1: GET /api/feed?limit=20
         → returns stories, nextCursor = "story-id-20"

Page 2: GET /api/feed?limit=20&cursor=story-id-20
         → returns next 20 stories after that cursor
```

This ensures consistent results even as new stories are added.

---

## 4. Story Interactions

### Overview

Users can **like**, **bookmark**, and **view** stories. Each interaction is tracked and used for feed personalization.

### Endpoints

#### `GET /api/stories/:id` (authenticated)

Fetches a single story with book info and user interaction state.

#### `POST /api/stories/:id/like` (authenticated)

Toggles the like state. First call likes, second call unlikes.

**Response:**
```json
{
  "liked": true,
  "likeCount": 43
}
```

**Internal behavior:**
1. Check if `Like(userId, storyId)` exists.
2. If exists → DELETE the Like, decrement `story.likeCount`.
3. If not → CREATE the Like, increment `story.likeCount`.
4. Both operations are atomic (Prisma transaction).

#### `POST /api/stories/:id/bookmark` (authenticated)

Same toggle pattern as likes.

**Response:**
```json
{
  "bookmarked": true,
  "bookmarkCount": 16
}
```

#### `POST /api/stories/:id/view` (authenticated)

Tracks that the user viewed/read a story. Used for feed "already seen" exclusion.

**Request body:**
```json
{
  "readPercentage": 85
}
```

**Internal behavior:**
1. Upserts a `StoryView(userId, storyId)` record.
2. Updates `readPercentage` if the new value is higher.
3. Increments `story.viewCount`.

---

## 5. Bookmarks

### Endpoint

#### `GET /api/bookmarks` (authenticated)

Returns the user's bookmarked stories with pagination.

**Query parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 20 | Items per page |
| `cursor` | string | — | Pagination cursor |

**Response:** Same shape as feed response, but only bookmarked stories.

---

## 6. AI Story Extraction Pipeline

### Overview

The pipeline is BookBite's most complex subsystem. It takes a PDF or TXT file, reads it, and uses AI to extract every meaningful story, anecdote, example, and case study — then generates reading-time variants for the feed.

### Architecture

```
┌─────────────────┐
│  CLI Ingest Tool │  (npm run ingest)
│  Scans folder    │
│  Creates DB Book │
│  Queues job      │
└────────┬────────┘
         │ BullMQ Job
         ▼
┌─────────────────────────────────────────────┐
│               Worker Process                 │
│                                              │
│  Pass 1: Extract Text (PDF/TXT → string)     │
│      ▼                                       │
│  Pass 1b: Smart Chunking (~4000 tokens)      │
│      ▼                                       │
│  Pass 2: Analyze Book (AI → categories)       │
│      ▼                                       │
│  Pass 3: For each chunk:                      │
│      │  a) Discover stories (AI → candidates) │
│      │  b) Extract each story (AI → content)  │
│      │  c) Generate variants (AI → 1/3/5/10)  │
│      ▼                                       │
│  Pass 4: Cross-reference sweep               │
│      │  Compare TOC vs extracted stories      │
│      │  Extract any missed stories            │
│      ▼                                       │
│  Save all stories to database                 │
│  Update book status → COMPLETED               │
└─────────────────────────────────────────────┘
```

### Pass 1: Text Extraction (`pipeline/extractor.ts`)

**Purpose:** Convert PDF/TXT files to raw text.

**For PDFs:**
- Uses `pdf-parse` library (class-based API in v2).
- Extracts: full text, page count, metadata (title, author if available).

**For TXT files:**
- Reads file as UTF-8 string.
- Estimates page count (~250 words per page).

### Pass 1b: Smart Chunking (`pipeline/chunker.ts`)

**Purpose:** Split raw text into AI-digestible chunks that respect document structure.

**Algorithm:**
1. **Detect chapters** using regex patterns:
   - `Chapter 1`, `CHAPTER ONE`, `Part I`, etc.
   - Uppercase headings, numbered sections.
2. **Split at chapter boundaries** first.
3. **If a chunk exceeds target size** (~4000 tokens / ~16,000 characters), split further at paragraph boundaries.
4. **Preserve chapter titles** — each chunk carries its chapter context.
5. **Extract table of contents** — list of chapter headings for the cross-reference sweep.

### Pass 2: Book Analysis (`pipeline/ai-processor.ts → analyzeBook()`)

**Purpose:** Understand the book before diving into extraction.

**Input:** First ~20,000 characters of text + table of contents.

**AI prompt asks for:**
- Book categories (mapped against canonical list).
- Book type (non-fiction, fiction, biography, etc.).
- Structure description (chapters, stories per chapter estimate).
- Story density rating (how many extractable stories exist).

**Output:** `BookAnalysis` object used to guide subsequent passes.

### Pass 3a: Story Discovery (`pipeline/ai-processor.ts → discoverStories()`)

**Purpose:** Find ALL story candidates in a chunk.

**For each text chunk, the AI identifies:**
- Named stories, anecdotes, examples, case studies.
- Historical events, experiments, parables.
- Character-driven narratives, analogies.

**Output:** Array of `StoryCandidate` objects with:
- Title, location in text, estimated length.
- Brief description of the story's content.

### Pass 3b: Story Extraction (`pipeline/ai-processor.ts → extractStory()`)

**Purpose:** Deep extraction of each discovered story.

**Key feature: Style Seeds.** Each extraction uses a random combination of:
- **Hook style:** question, dramatic statement, scene-setting, contrast, statistic.
- **Voice:** conversational, authoritative, storyteller, journalistic.
- **Pacing:** fast-build, slow-reveal, parallel-timeline.
- **Ending:** cliffhanger, lesson, reflection, call-to-action.

This prevents "cookie cutter" stories — every extraction has a unique flavor.

**Output:** `ExtractedStory` with:
- Title, content (600–1000 words), tone, categories.
- The style seed used (stored for reference).

### Pass 3c: Variant Generation (`pipeline/ai-processor.ts → generateVariants()`)

**Purpose:** Create 4 reading-time versions of each story.

| Variant | Target | Word Count |
|---------|--------|-----------|
| 1 minute | Quick bite | ~150 words |
| 3 minutes | Standard read | ~450 words |
| 5 minutes | Deep read | ~750 words |
| 10 minutes | Full exploration | ~1500 words |

**Important:** Each variant is a **complete, standalone story** — not a truncation. The 1-minute version captures the essence. The 10-minute version adds context, detail, and reflection.

**All variants share a `storyGroupId`** so the feed can avoid showing duplicates.

### Pass 4: Cross-Reference Sweep (`pipeline/ai-processor.ts → crossReferenceSweep()`)

**Purpose:** Catch stories that were missed in the per-chunk pass.

**Algorithm:**
1. Compare the table of contents against extracted story titles.
2. Identify chapters/sections with no extracted stories.
3. For each gap, find the relevant text chunk.
4. Run discovery + extraction on those chunks.

This ensures maximum story coverage from every book.

### Category Normalization (`pipeline/categorizer.ts`)

Maps AI-detected categories to a canonical set:

```
Self-Help, Business, Biography, Psychology, Science,
Philosophy, History, Fiction, Technology, Health,
Memoir, Spirituality, Economics, Sociology, Education, Creativity
```

Fuzzy matching handles variations (e.g., "self improvement" → "Self-Help").

### Job Queue (`pipeline/queue.ts`)

**BullMQ configuration:**
- **Queue name:** `book-processing`
- **Concurrency:** 1 (one book at a time to manage AI API costs).
- **Retries:** 3 with exponential backoff.
- **Rate limiting:** Max 1 job per 10 seconds.
- **Job data:** `{ bookId, filePath, fileName, fileType }`.

**Book status lifecycle:**
```
QUEUED → PROCESSING → COMPLETED
                   └→ FAILED (after 3 retries)
```

### AI Provider Fallback

The `aiCall()` function implements automatic fallback:

1. **Try Anthropic Claude** (claude-sonnet-4-20250514) — primary provider.
2. **If Claude fails** (rate limit, error, timeout) → **fall back to OpenAI GPT-4o**.
3. **If both fail** → throw error, triggering BullMQ retry.

---

## 7. CLI Tools

### `npm run ingest [folder]`

Scans a folder for PDF/TXT files and queues them for processing.

**Default folder:** `backend/books/`

**Behavior:**
1. Lists all `.pdf` and `.txt` files in the folder.
2. For each file, checks if `sourceFile` already exists in the `Book` table.
3. Skips duplicates, creates new `Book` records with status `QUEUED`.
4. Adds a BullMQ job for each new book.
5. Prints summary: queued count, skipped count.

**Usage:**
```bash
# Default folder
npm run ingest

# Custom folder
npm run ingest -- /path/to/books
```

### `npm run queue:status`

Displays current BullMQ queue status.

**Output includes:**
- Waiting jobs (not yet picked up).
- Active jobs (currently processing, with progress %).
- Completed jobs (with story count).
- Failed jobs (with error message).
- Delayed jobs (waiting for retry).

### `npm run worker`

Starts the BullMQ worker process that picks up jobs and runs the 5-pass pipeline. Must be running for ingested books to be processed.

---

## 8. Admin API

All admin routes require `authenticate` + `requireAdmin` middleware.

### `GET /api/admin/books`

Lists all books with their processing status and story counts.

### `GET /api/admin/queue/status`

Returns queue statistics computed from the database (books by status).

---

## 9. Database Seeding

### `npm run seed`

Populates the database with test data for development.

**Creates:**
- **Test user:** `test@test.com` / password: `test`
  - Preferences: Self-Help, Psychology, Business, Philosophy | 3 min reading time
  - Simulated activity: 8 likes, 5 bookmarks, 12 views
- **Admin user:** `admin@bookbite.app` / password: `admin`
- **10 books:** Atomic Habits, Sapiens, Psychology of Money, Thinking Fast and Slow, The Alchemist, Deep Work, Man's Search for Meaning, The 48 Laws of Power, Shoe Dog, The Power of Now
- **31 stories:** Multiple stories per book with varying reading times (1, 3, 5, 10 min), tones (inspiring, philosophical, educational, dramatic, cautionary, humorous), and full engaging content.

**Note:** Running seed clears all existing data first.
