# BookBite iOS — Features

Detailed documentation for every screen, component, and user-facing feature.

---

## Table of Contents

1. [Splash Screen](#1-splash-screen)
2. [Authentication](#2-authentication)
3. [Onboarding](#3-onboarding)
4. [Story Feed](#4-story-feed)
5. [Story Detail / Reader](#5-story-detail--reader)
6. [Bookmarks](#6-bookmarks)
7. [User Profile](#7-user-profile)
8. [Reusable Components](#8-reusable-components)
9. [Data Models](#9-data-models)

---

## 1. Splash Screen

**File:** `Views/Auth/SplashView.swift`

### What It Does

Displays while the app checks for an existing session (stored JWT). Shows the BookBite logo with a smooth entrance animation.

### Visual Design

- White background.
- Centered book icon (`text.book.closed.fill`) in black.
- "BookBite" title in `displayLarge` font.
- Subtitle: "Stories that stick" in `bodyLarge`, secondary color.

### Animations

- Logo scales from 0.8 → 1.0 with spring animation.
- Opacity fades from 0 → 1.
- Subtitle fades in with a 0.3s delay.

### State Transitions

Automatically transitions when `AuthViewModel.isLoading` becomes `false`:
- **Authenticated + onboarding done** → `MainTabView`
- **Authenticated + onboarding pending** → `OnboardingView`
- **Not authenticated** → `AuthView`

---

## 2. Authentication

**Files:** `Views/Auth/AuthView.swift`, `ViewModels/AuthViewModel.swift`

### What It Does

Login and registration screen with email/password and social sign-in options.

### Screens

#### Login Mode
- Email field (with envelope icon).
- Password field (with lock icon, secure entry).
- "Sign In" primary button.
- Apple Sign-In button.
- Google Sign-In button (placeholder).
- Toggle: "Don't have an account? Sign Up"

#### Register Mode
- Display name field (with person icon).
- Email field.
- Password field (minimum 8 characters).
- "Create Account" primary button.
- Same social options.
- Toggle: "Already have an account? Sign In"

### Validation

- **Register:** password must be >= 8 characters; all fields required.
- **Login:** email and password required.
- Errors displayed as red text below the form.

### Social Authentication

#### Apple Sign-In
- Uses `ASAuthorizationAppleIDProvider`.
- Sends identity token and authorization code to backend.
- Handles first-time (gets name/email) and returning users.

#### Google Sign-In
- Placeholder UI ready.
- Sends Google ID token to backend for verification.

### AuthViewModel State

```swift
@Published var isAuthenticated: Bool
@Published var onboardingCompleted: Bool
@Published var isLoading: Bool
@Published var error: String?
@Published var currentUser: UserProfile?
```

**Key methods:**
- `checkExistingSession()` — called on app launch, validates stored token.
- `login(email:password:)` — authenticates, stores tokens, sets state.
- `register(email:password:displayName:)` — creates account, stores tokens.
- `handleAppleSignIn(result:)` — processes Apple credential.
- `logout()` — clears tokens, resets state.

### Animations

- Staggered field appearance on load.
- Smooth transition between login ↔ register modes.

---

## 3. Onboarding

**Files:** `Views/Onboarding/OnboardingView.swift`, `ViewModels/OnboardingViewModel.swift`

### What It Does

Two-step questionnaire that sets up the user's reading preferences. Shown once after registration.

### Step 1: Category Selection

- Title: "What do you love reading?"
- Grid of `CategoryChip` buttons.
- Each chip shows an icon + category name.
- Tapped chips toggle with a spring animation.
- Minimum 3 categories required to proceed.

**Available categories (14):**
| Category | Icon |
|----------|------|
| Self-Help | `sparkles` |
| Business | `briefcase` |
| Biography | `person.text.rectangle` |
| Psychology | `brain.head.profile` |
| Science | `atom` |
| Philosophy | `lightbulb` |
| History | `clock.arrow.circlepath` |
| Fiction | `book` |
| Technology | `desktopcomputer` |
| Health | `heart` |
| Memoir | `text.book.closed` |
| Spirituality | `leaf` |
| Economics | `chart.line.uptrend.xyaxis` |
| Creativity | `paintbrush` |

### Step 2: Reading Time

- Title: "How long do you like to read?"
- Four `ReadingTimeOption` cards, radio-style selection.

| Option | Label | Description |
|--------|-------|-------------|
| 1 min | Quick Bite | "Perfect for a quick break" |
| 3 min | Short Read | "Great for commute or coffee" |
| 5 min | Standard | "A satisfying read" |
| 10 min | Deep Dive | "Immersive and detailed" |

### Navigation

- Progress bar at top (animated fill).
- "Back" button on step 2.
- "Continue" / "Get Started" button at bottom.
- "Get Started" submits preferences to API and marks onboarding complete.

### OnboardingViewModel State

```swift
@Published var selectedCategories: Set<BookCategory>
@Published var selectedReadingTime: ReadingTime   // default: .three
@Published var currentStep: Int                    // 0 or 1
@Published var isSubmitting: Bool
@Published var error: String?
```

### Animations

- Spring transitions between steps.
- Category chips bounce on selection.
- Progress bar animates width changes.

---

## 4. Story Feed

**Files:** `Views/Feed/FeedView.swift`, `ViewModels/FeedViewModel.swift`

### What It Does

The core experience. An infinite-scroll feed of personalized story cards. The primary screen users interact with.

### Visual Layout

```
┌────────────────────────────┐
│  "Discover" (nav title)    │
│                            │
│  ┌──────────────────────┐  │
│  │     StoryCard 1      │  │
│  │  Book title • 3 min  │  │
│  │  Story Title         │  │
│  │  Content preview...  │  │
│  │  Author  ♡ 42  🔖 15 │  │
│  └──────────────────────┘  │
│                            │
│  ┌──────────────────────┐  │
│  │     StoryCard 2      │  │
│  │         ...          │  │
│  └──────────────────────┘  │
│                            │
│         (loading)          │
│  ── load more on scroll ── │
└────────────────────────────┘
```

### Features

- **Infinite scroll:** Loads 20 stories initially. Triggers `loadMore()` when the last visible card appears.
- **Pull-to-refresh:** Resets feed and loads fresh content.
- **Shimmer loading:** Shows placeholder cards while loading.
- **Empty state:** "No stories yet" with refresh button.
- **Staggered appearance:** Cards animate in sequentially with 0.05s delays.
- **Tap to read:** Opens `StoryDetailView` as a sheet.

### FeedViewModel State

```swift
@Published var stories: [Story]
@Published var isLoading: Bool
@Published var isLoadingMore: Bool
@Published var error: String?
// Private
private var nextCursor: String?
private var hasMore: Bool
```

**Key methods:**
- `loadFeed(reset:)` — fetches personalized feed from API.
- `loadMore()` — loads next page using cursor.
- `toggleLike(storyId:)` — optimistic like toggle.
- `toggleBookmark(storyId:)` — optimistic bookmark toggle.
- `trackView(storyId:percentage:)` — records reading progress.

### Optimistic Updates

When a user taps like/bookmark:
1. **Immediately** update the local story object (flip `isLiked`, adjust `likeCount`).
2. **Then** send the API request in the background.
3. **If the API fails**, revert the local change.

This makes interactions feel instant.

---

## 5. Story Detail / Reader

**File:** `Views/Feed/StoryDetailView.swift`

### What It Does

Full-screen reading view for a single story. Opened as a sheet from the feed or bookmarks.

### Visual Layout

```
┌────────────────────────────┐
│  [X Close]                 │
│                            │
│  ATOMIC HABITS             │  (book title, caps)
│                            │
│  The British Cycling       │  (story title, serif)
│  Revolution                │
│                            │
│  3 min read • Inspiring    │  (badges)
│                            │
│  ─────────────────────     │
│                            │
│  In 2003, British cycling  │  (story content, serif font)
│  was a joke. One Olympic   │
│  gold in a century...      │
│                            │
│  ─────────────────────     │
│                            │
│  📖 Source                  │
│  Atomic Habits             │
│  by James Clear            │
│  [Buy Book →]              │  (opens purchase link)
│                            │
│  ─────────────────────     │
│  [♡ Like]    [🔖 Bookmark] │  (toolbar)
└────────────────────────────┘
```

### Features

- **Serif typography** for story content (book-like reading experience).
- **Reading time badge** with clock icon.
- **Tone badge** (e.g., "Inspiring", "Educational").
- **Source section** with book name, author, and purchase link.
- **Like/Bookmark toolbar** with animated scale effects.
- **View tracking:** Records 50% on appear, 100% on disappear.
- **Dismiss button** in top-right corner.

### Interactions

| Action | Behavior |
|--------|----------|
| Tap like | Toggles like, scale animation, haptic feedback |
| Tap bookmark | Toggles bookmark, scale animation, haptic feedback |
| Tap "Buy Book" | Opens purchase URL in Safari |
| Scroll | Natural scroll through content |
| Tap X / Swipe down | Dismisses sheet |

---

## 6. Bookmarks

**Files:** `Views/Bookmarks/BookmarksView.swift`, `ViewModels/BookmarksViewModel.swift`

### What It Does

Displays all stories the user has bookmarked, with list and grid view options.

### View Modes

#### List View (default)
```
┌──────────────────────────────┐
│  Bookmarks         [grid ⊞]  │
│                               │
│  ┌───────────────────────┐   │
│  │ The British Cycling   🔖 │  (tap 🔖 to remove)
│  │ Atomic Habits • 3 min │   │
│  └───────────────────────┘   │
│  ┌───────────────────────┐   │
│  │ The Janitor Who...    🔖 │
│  │ Psychology of Money   │   │
│  └───────────────────────┘   │
└──────────────────────────────┘
```

#### Grid View
```
┌──────────────────────────────┐
│  Bookmarks         [list ☰]  │
│                               │
│  ┌───────┐  ┌───────┐       │
│  │ Story │  │ Story │       │
│  │ Title │  │ Title │       │
│  │ 3 min │  │ 5 min │       │
│  └───────┘  └───────┘       │
│  ┌───────┐  ┌───────┐       │
│  │  ...  │  │  ...  │       │
│  └───────┘  └───────┘       │
└──────────────────────────────┘
```

### Features

- **Toggle view mode** with toolbar button (animated transition).
- **Remove bookmark** by tapping the bookmark icon in list view.
- **Tap to read** opens `StoryDetailView` sheet.
- **Empty state** with bookmark icon and "No bookmarks yet" message.
- **Cursor pagination** for large bookmark lists.

### BookmarksViewModel State

```swift
@Published var stories: [Story]
@Published var isGridView: Bool        // toggle list/grid
@Published var isLoading: Bool
@Published var error: String?
```

---

## 7. User Profile

**File:** `Views/Profile/ProfileView.swift`, `ViewModels/ProfileViewModel.swift`

### What It Does

Displays user information, engagement stats, reading preferences, and app settings.

### Visual Layout

```
┌────────────────────────────────┐
│  Profile                       │
│                                │
│       ┌────┐                   │
│       │ JD │  (initials avatar)│
│       └────┘                   │
│    Jane Doe                    │
│    jane@example.com            │
│                                │
│  ┌────────┬────────┬────────┐  │
│  │  128   │   42   │   15   │  │
│  │Stories │ Liked  │ Saved  │  │
│  │  Read  │        │        │  │
│  └────────┴────────┴────────┘  │
│                                │
│  Reading Preferences   [Edit]  │
│  ┌──────────────────────────┐  │
│  │ Categories:              │  │
│  │ [Self-Help] [Psychology] │  │ (FlowLayout tags)
│  │ [Business]               │  │
│  │                          │  │
│  │ Reading Time: 3 min      │  │
│  └──────────────────────────┘  │
│                                │
│  Settings                      │
│  ├── Notifications             │
│  ├── Privacy Policy            │
│  ├── Help & Support            │
│  └── Sign Out (red)            │
└────────────────────────────────┘
```

### Sections

#### Profile Header
- Circular avatar with initials (first letter of display name).
- Display name and email.

#### Stats Row
- Three stat cards in a horizontal row.
- **Stories Read:** Total `StoryView` count.
- **Liked:** Total `Like` count.
- **Saved:** Total `Bookmark` count.

#### Reading Preferences
- **Categories** displayed as tags in a custom `FlowLayout` (wrapping to new lines).
- **Reading time** preference.
- **Edit button** opens `EditPreferencesView` sheet.

#### Edit Preferences Sheet
- Same category chip and reading time selectors as onboarding.
- Save button sends updated preferences to API.

#### Settings
- **Notifications** — placeholder.
- **Privacy Policy** — placeholder.
- **Help & Support** — placeholder.
- **Sign Out** — red text, clears tokens, returns to `AuthView`.

### ProfileViewModel State

```swift
@Published var profile: ProfileResponse?
@Published var isLoading: Bool
@Published var error: String?
```

---

## 8. Reusable Components

### BBButton (`Views/Components/BBButton.swift`)

A versatile button component with four visual styles.

| Style | Appearance | Use Case |
|-------|-----------|----------|
| `.primary` | Black background, white text | Main actions (Sign In, Submit) |
| `.secondary` | Gray background, black text | Secondary actions |
| `.outline` | Transparent, black border | Alternative actions |
| `.ghost` | Transparent, no border | Subtle actions |

**Features:**
- Loading state (shows `ProgressView` spinner).
- Disabled state (0.6 opacity).
- Full-width by default.
- 50pt height, `md` corner radius.

**Special buttons:**
- `AppleSignInButton` — black button with Apple logo.
- `GoogleSignInButton` — outlined button with Google "G" branding.

### BBTextField (`Views/Components/BBTextField.swift`)

Custom text input field matching the design system.

**Features:**
- Optional leading icon (SF Symbol).
- Secure field toggle (for passwords).
- Focus state: border changes from `BBColors.border` to `BBColors.borderStrong`.
- Disabled autocapitalization and autocorrect.
- 50pt height, `surface` background, `md` corner radius.

### StoryCard (`Views/Components/StoryCard.swift`)

The primary feed card component.

**Layout:**
- **Header:** Book title (caps, label font) + reading time badge.
- **Title:** Story title (titleLarge, 2 lines max).
- **Preview:** Story content (bodyMedium, 4 lines max, tertiary color).
- **Footer:** Author name + Like button (count) + Bookmark button (count).

**Interactions:**
- **Tap card** → triggers `onTap` callback (opens detail).
- **Tap like** → triggers `onLike` callback with scale animation + haptic.
- **Tap bookmark** → triggers `onBookmark` callback with scale animation + haptic.
- **Filled/empty icons** based on `isLiked` / `isBookmarked` state.

**Styling:**
- White card background.
- 1px border, `md` corner radius.
- `md` padding.
- `PressEffect` modifier for tap feedback.

---

## 9. Data Models

**File:** `Models/Models.swift`

### Story

The primary data object.

```swift
struct Story: Codable, Identifiable {
    let id: String
    let bookId: String
    let title: String
    let content: String
    let summary: String?
    let readingTimeMinutes: Int
    let categories: [String]
    let tone: String?
    let likeCount: Int
    let bookmarkCount: Int
    let viewCount: Int
    let createdAt: String
    let book: BookInfo?
    var isLiked: Bool?
    var isBookmarked: Bool?
}
```

### BookInfo

```swift
struct BookInfo: Codable {
    let id: String
    let title: String
    let author: String
    let coverUrl: String?
    let purchaseLink: String?
}
```

### BookCategory (enum)

14 categories, each with an associated SF Symbol icon:

```swift
enum BookCategory: String, Codable, CaseIterable {
    case selfHelp = "Self-Help"       // sparkles
    case business = "Business"         // briefcase
    case biography = "Biography"       // person.text.rectangle
    case psychology = "Psychology"     // brain.head.profile
    case science = "Science"           // atom
    case philosophy = "Philosophy"     // lightbulb
    case history = "History"           // clock.arrow.circlepath
    case fiction = "Fiction"           // book
    case technology = "Technology"     // desktopcomputer
    case health = "Health"             // heart
    case memoir = "Memoir"             // text.book.closed
    case spirituality = "Spirituality" // leaf
    case economics = "Economics"       // chart.line.uptrend.xyaxis
    case creativity = "Creativity"     // paintbrush
}
```

### ReadingTime (enum)

```swift
enum ReadingTime: Int, Codable, CaseIterable {
    case one = 1      // "Quick Bite"
    case three = 3    // "Short Read"
    case five = 5     // "Standard"
    case ten = 10     // "Deep Dive"
}
```

### Auth Models

```swift
struct AuthResponse: Codable {
    let user: UserProfile
    let accessToken: String
    let refreshToken: String
}

struct UserProfile: Codable, Identifiable {
    let id: String
    let email: String
    let displayName: String?
    let avatarUrl: String?
    let role: String
    let onboardingCompleted: Bool?
}
```

### Feed Response

```swift
struct FeedResponse: Codable {
    let stories: [Story]
    let nextCursor: String?
    let hasMore: Bool
}
```

### Interaction Responses

```swift
struct LikeResult: Codable {
    let liked: Bool
    let likeCount: Int
}

struct BookmarkResult: Codable {
    let bookmarked: Bool
    let bookmarkCount: Int
}
```
