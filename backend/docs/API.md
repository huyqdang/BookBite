# BookBite Backend — API Reference

Base URL: `http://localhost:3001/api`

All authenticated endpoints require: `Authorization: Bearer <accessToken>`

---

## Health Check

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | Server health check |

---

## Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Create new account |
| POST | `/api/auth/login` | No | Email/password login |
| POST | `/api/auth/apple` | No | Apple Sign-In |
| POST | `/api/auth/google` | No | Google Sign-In |
| POST | `/api/auth/refresh` | No | Refresh token pair |

### POST `/api/auth/register`
```json
// Request
{ "email": "string", "password": "string", "displayName": "string" }

// Response 201
{ "user": { ... }, "accessToken": "string", "refreshToken": "string" }
```

### POST `/api/auth/login`
```json
// Request
{ "email": "string", "password": "string" }

// Response 200
{ "user": { ... }, "accessToken": "string", "refreshToken": "string" }
```

### POST `/api/auth/apple`
```json
// Request
{ "identityToken": "string", "authorizationCode": "string", "email": "string?", "fullName": "string?" }

// Response 200
{ "user": { ... }, "accessToken": "string", "refreshToken": "string" }
```

### POST `/api/auth/google`
```json
// Request
{ "idToken": "string", "email": "string", "displayName": "string?" }

// Response 200
{ "user": { ... }, "accessToken": "string", "refreshToken": "string" }
```

### POST `/api/auth/refresh`
```json
// Request
{ "refreshToken": "string" }

// Response 200
{ "accessToken": "string", "refreshToken": "string" }
```

---

## Feed

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/feed` | Yes | Personalized story feed |

### GET `/api/feed`

**Query params:**
- `limit` (number, default 20) — stories per page
- `cursor` (string) — pagination cursor
- `readingTime` (number) — override reading time filter (1, 3, 5, or 10)

```json
// Response 200
{
  "stories": [
    {
      "id": "uuid",
      "title": "string",
      "content": "string",
      "summary": "string?",
      "readingTimeMinutes": 3,
      "categories": ["Self-Help", "Psychology"],
      "tone": "inspiring",
      "likeCount": 42,
      "bookmarkCount": 15,
      "viewCount": 230,
      "createdAt": "ISO-8601",
      "book": {
        "id": "uuid",
        "title": "Atomic Habits",
        "author": "James Clear",
        "coverUrl": "string?",
        "purchaseLink": "string?"
      },
      "isLiked": false,
      "isBookmarked": true
    }
  ],
  "nextCursor": "uuid | null",
  "hasMore": true
}
```

---

## Stories

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/stories/:id` | Yes | Get single story |
| POST | `/api/stories/:id/like` | Yes | Toggle like |
| POST | `/api/stories/:id/bookmark` | Yes | Toggle bookmark |
| POST | `/api/stories/:id/view` | Yes | Track view |

### GET `/api/stories/:id`
```json
// Response 200 — same shape as feed story object
```

### POST `/api/stories/:id/like`
```json
// Response 200
{ "liked": true, "likeCount": 43 }
```

### POST `/api/stories/:id/bookmark`
```json
// Response 200
{ "bookmarked": true, "bookmarkCount": 16 }
```

### POST `/api/stories/:id/view`
```json
// Request
{ "readPercentage": 85 }

// Response 200
{ "success": true }
```

---

## User Profile & Preferences

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/profile` | Yes | Get profile + stats |
| PUT | `/api/profile` | Yes | Update profile |
| GET | `/api/preferences` | Yes | Get preferences |
| PUT | `/api/preferences` | Yes | Update preferences |
| GET | `/api/bookmarks` | Yes | Get bookmarked stories |

### GET `/api/profile`
```json
// Response 200
{
  "id": "uuid",
  "email": "string",
  "displayName": "string",
  "avatarUrl": "string?",
  "role": "USER",
  "preferences": {
    "bookCategories": ["Self-Help"],
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

### PUT `/api/profile`
```json
// Request
{ "displayName": "string?", "avatarUrl": "string?" }
```

### PUT `/api/preferences`
```json
// Request
{
  "bookCategories": ["Fiction", "Philosophy"],
  "preferredReadingTime": 5,
  "onboardingCompleted": true
}
```

### GET `/api/bookmarks`

**Query params:** `limit`, `cursor` (same as feed)

```json
// Response 200 — same shape as feed response
```

---

## Admin

All admin routes require `role: ADMIN`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/books` | Admin | List all books |
| GET | `/api/admin/queue/status` | Admin | Queue statistics |

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Human-readable error message"
}
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request (validation error) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient role) |
| 404 | Resource not found |
| 409 | Conflict (duplicate resource) |
| 429 | Rate limited |
| 500 | Internal server error |
