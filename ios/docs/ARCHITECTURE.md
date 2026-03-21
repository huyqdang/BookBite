# BookBite iOS — Architecture

## Overview

BookBite's iOS app is built with **SwiftUI** following the **MVVM (Model-View-ViewModel)** pattern. It targets **iOS 17+** and features a minimalistic black-and-white design system with world-class animations.

**Core technologies:**

| Layer | Technology |
|-------|-----------|
| UI Framework | SwiftUI |
| Architecture | MVVM |
| Concurrency | Swift async/await, actors |
| Networking | URLSession |
| Secure Storage | iOS Keychain |
| Authentication | JWT + Apple Sign-In |
| Minimum Target | iOS 17.0 |

---

## MVVM Architecture

```
┌──────────────────────────────────────────┐
│                  Views                    │
│  SwiftUI views that observe ViewModels   │
│  Declarative UI, animations, gestures    │
├──────────────────────────────────────────┤
│               ViewModels                  │
│  @Published state, business logic        │
│  Call APIService, handle errors           │
│  Optimistic updates for interactions      │
├──────────────────────────────────────────┤
│                Services                   │
│  APIService (actor) — all network calls  │
│  KeychainService — secure token storage  │
├──────────────────────────────────────────┤
│                 Models                    │
│  Codable structs for API data            │
│  Enums for categories, reading times     │
└──────────────────────────────────────────┘
```

**Data flow:**
1. Views observe `@Published` properties on ViewModels.
2. User actions trigger ViewModel methods.
3. ViewModels call `APIService` (async).
4. `APIService` makes HTTP requests with token management.
5. Responses are decoded into Model structs.
6. ViewModels update `@Published` state → SwiftUI re-renders.

---

## Directory Structure

```
ios/BookBite/
├── App/                          # App entry & navigation
│   ├── BookBiteApp.swift         # @main entry point
│   ├── RootView.swift            # Auth/onboarding/main router
│   └── MainTabView.swift         # Tab bar navigation
├── Resources/                    # Design system
│   └── Theme.swift               # Colors, fonts, spacing, radius
├── Models/                       # Data structures
│   └── Models.swift              # All Codable models & enums
├── Services/                     # Network & storage
│   ├── APIService.swift          # HTTP client (actor)
│   └── KeychainService.swift     # Keychain token storage
├── ViewModels/                   # State management
│   ├── AuthViewModel.swift       # Authentication state
│   ├── OnboardingViewModel.swift # Onboarding flow
│   ├── FeedViewModel.swift       # Feed & interactions
│   ├── BookmarksViewModel.swift  # Bookmarks management
│   └── ProfileViewModel.swift    # Profile & preferences
├── Views/                        # UI screens
│   ├── Auth/
│   │   ├── SplashView.swift      # Loading splash
│   │   └── AuthView.swift        # Login/Register
│   ├── Onboarding/
│   │   └── OnboardingView.swift  # Category & time selection
│   ├── Feed/
│   │   ├── FeedView.swift        # Infinite scroll feed
│   │   └── StoryDetailView.swift # Full story reader
│   ├── Bookmarks/
│   │   └── BookmarksView.swift   # Saved stories
│   ├── Profile/
│   │   └── ProfileView.swift     # Profile & settings
│   └── Components/               # Reusable components
│       ├── BBButton.swift        # Button variants
│       ├── BBTextField.swift     # Text input
│       └── StoryCard.swift       # Feed story card
└── Animations/
    └── AnimationExtensions.swift # Animation presets & haptics
```

---

## Navigation Flow

The app uses a **state-driven navigation** pattern. `RootView` observes `AuthViewModel` and renders the appropriate screen:

```
App Launch
    │
    ▼
┌─────────────┐
│  SplashView  │  (checking stored token)
└──────┬──────┘
       │
       ├── Token valid + onboarding done ──▶ MainTabView
       │
       ├── Token valid + onboarding NOT done ──▶ OnboardingView
       │
       └── No token / invalid ──▶ AuthView
                                      │
                                      ├── Login success ──▶ MainTabView or OnboardingView
                                      └── Register success ──▶ OnboardingView
```

### MainTabView Tabs

```
┌──────────────┬──────────────┬──────────────┐
│     Feed     │  Bookmarks   │   Profile    │
│  (default)   │              │              │
│  FeedView    │ BookmarksView│ ProfileView  │
└──────────────┴──────────────┴──────────────┘
```

Custom tab bar with `matchedGeometryEffect` animated indicator.

---

## State Management

### Environment Objects

Two objects are injected at the app root and available throughout the view hierarchy:

| Object | Purpose | Scope |
|--------|---------|-------|
| `AuthViewModel` | Authentication state, current user | Global |
| `AppState` | Tab selection | Global |

### ViewModel Ownership

Each screen owns its ViewModel via `@StateObject`:

| View | ViewModel | Lifetime |
|------|-----------|----------|
| `AuthView` | Uses shared `AuthViewModel` | App lifetime |
| `OnboardingView` | `OnboardingViewModel` | Onboarding flow |
| `FeedView` | `FeedViewModel` | Feed tab lifetime |
| `BookmarksView` | `BookmarksViewModel` | Bookmarks tab lifetime |
| `ProfileView` | `ProfileViewModel` | Profile tab lifetime |

---

## Networking Architecture

### APIService (Actor)

`APIService` is implemented as a Swift **actor**, ensuring thread-safe access to mutable state (tokens, in-flight requests).

```
┌─────────────────────────────────────────┐
│              APIService                  │
│                                          │
│  baseURL: "http://localhost:3001/api"    │
│                                          │
│  ┌─────────────────────────────────┐    │
│  │  Generic request<T>() method     │    │
│  │                                   │    │
│  │  1. Build URLRequest             │    │
│  │  2. Attach Bearer token           │    │
│  │  3. Execute URLSession            │    │
│  │  4. Check for 401                 │    │
│  │     → attemptTokenRefresh()       │    │
│  │     → Retry original request      │    │
│  │  5. Decode JSON → T              │    │
│  └─────────────────────────────────┘    │
│                                          │
│  Token Management:                       │
│  ├── accessToken (from Keychain)         │
│  ├── refreshToken (from Keychain)        │
│  └── Auto-refresh on 401                 │
└─────────────────────────────────────────┘
```

### Token Refresh Flow

```
API call returns 401
    │
    ▼
Read refreshToken from Keychain
    │
    ├── No refresh token → throw .unauthorized
    │
    └── POST /api/auth/refresh
            │
            ├── Success → Save new tokens to Keychain
            │             → Retry original request
            │
            └── Failure → Clear tokens → throw .unauthorized
                          (triggers logout in AuthViewModel)
```

### Error Handling

```swift
enum APIError: LocalizedError {
    case invalidURL
    case noData
    case decodingError(Error)
    case serverError(Int, String)
    case networkError(Error)
    case unauthorized
}
```

---

## Design System

All UI tokens are centralized in `Theme.swift` for consistency:

### Color Palette

```
BBColors.primary        #000000  (Black — primary actions)
BBColors.background     #FFFFFF  (White — page background)
BBColors.surface        #F5F5F5  (Light gray — cards, inputs)
BBColors.text           #000000  (Primary text)
BBColors.textSecondary  #666666  (Secondary text)
BBColors.textTertiary   #999999  (Captions, hints)
BBColors.border         #E5E5E5  (Subtle borders)
BBColors.borderStrong   #D4D4D4  (Emphasized borders)
```

### Typography Scale

```
BBFonts.displayLarge()   34pt  Bold      — Hero headings
BBFonts.displayMedium()  28pt  Bold      — Section titles
BBFonts.titleLarge()     20pt  Semibold  — Card titles
BBFonts.titleMedium()    17pt  Semibold  — Subtitles
BBFonts.bodyLarge()      17pt  Regular   — Body text
BBFonts.bodyMedium()     15pt  Regular   — Default body
BBFonts.bodySmall()      13pt  Regular   — Small text
BBFonts.reading()        18pt  Serif     — Story content
BBFonts.readingLarge()   20pt  Serif     — Story titles
BBFonts.caption()        12pt  Medium    — Captions
BBFonts.label()          11pt  Semibold  — Labels/badges
```

**Story content uses serif fonts** for a book-like reading experience, while the UI uses SF Pro (system font).

### Spacing & Radius

```
BBSpacing: xs=4  sm=8  md=16  lg=24  xl=32  xxl=48
BBRadius:  sm=6  md=10 lg=16  xl=24  full=9999
```

---

## Animation System

### Presets (`AnimationExtensions.swift`)

| Preset | Duration | Damping | Use Case |
|--------|----------|---------|----------|
| `.smoothSpring` | 0.4s | 0.8 | General UI transitions |
| `.bouncySpring` | 0.35s | 0.6 | Interactive elements (buttons, toggles) |
| `.snappy` | 0.3s | 0.75 | Tab switches, quick actions |
| `.gentleEase` | 0.35s | — | Content fade in/out |

### Transitions

| Transition | Effect |
|-----------|--------|
| `.slideUp` | Slide from bottom + fade |
| `.scaleIn` | Scale from 0.8 + fade |

### Modifiers

| Modifier | Effect |
|----------|--------|
| `StaggeredAppearance(index:)` | Delays appearance by `index * 0.05s` for cascading animations |
| `PressEffect()` | Scales to 0.97x on press for tactile feedback |

### Haptic Feedback (`HapticManager`)

| Method | Trigger |
|--------|---------|
| `.impact(.light)` | Button taps |
| `.impact(.medium)` | Interactions (like, bookmark) |
| `.notification(.success)` | Successful actions |
| `.selection()` | Tab switches, selections |

---

## Secure Storage

### KeychainService

Tokens are stored in the iOS Keychain (not UserDefaults) for security:

```
Service: "app.bookbite"
├── "access_token"   → JWT access token
└── "refresh_token"  → JWT refresh token
```

**Operations:**
- `saveTokens(access:refresh:)` — stores both tokens.
- `getAccessToken()` / `getRefreshToken()` — retrieves tokens.
- `clearTokens()` — removes both (on logout).

Uses iOS Security framework (`kSecClassGenericPassword`) for hardware-backed encryption.
