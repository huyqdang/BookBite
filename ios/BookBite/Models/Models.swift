import Foundation

// MARK: - Auth Models

struct AuthResponse: Codable {
    let user: UserProfile
    let accessToken: String
    let refreshToken: String
}

struct TokenResponse: Codable {
    let accessToken: String
    let refreshToken: String
}

// MARK: - User Models

struct UserProfile: Codable, Identifiable {
    let id: String
    let email: String?
    let displayName: String
    let avatarUrl: String?
    let role: String
    let onboardingCompleted: Bool?
}

struct UserPreferences: Codable {
    let bookCategories: [String]
    let preferredReadingTimes: [Int]
    let timezone: String?
    let fontFamily: String?
    let fontSize: Int?
    let onboardingCompleted: Bool
}

struct ProfileResponse: Codable {
    let id: String
    let email: String?
    let displayName: String
    let avatarUrl: String?
    let role: String
    let preferences: UserPreferences?
    let stats: UserStats
    let createdAt: String
}

struct UserStats: Codable {
    let likes: Int
    let bookmarks: Int
    let storiesRead: Int
}

// MARK: - Story Models

struct Story: Codable, Identifiable, Equatable {
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
    let viewCount: Int?
    let createdAt: String
    let book: BookInfo?
    var isLiked: Bool?
    var isBookmarked: Bool?

    static func == (lhs: Story, rhs: Story) -> Bool {
        lhs.id == rhs.id
    }
}

struct BookInfo: Codable {
    let id: String
    let title: String
    let author: String
    let coverUrl: String?
    let purchaseLink: String?
}

// MARK: - Feed Models

struct FeedResponse: Codable {
    let stories: [Story]
    let nextCursor: String?
    let hasMore: Bool
}

// MARK: - Interaction Results

struct LikeResult: Codable {
    let liked: Bool
    let likeCount: Int
}

struct BookmarkResult: Codable {
    let bookmarked: Bool
    let bookmarkCount: Int
}

// MARK: - Book Categories

enum BookCategory: String, CaseIterable, Identifiable {
    case selfHelp = "Self-Help"
    case business = "Business"
    case biography = "Biography"
    case psychology = "Psychology"
    case science = "Science"
    case philosophy = "Philosophy"
    case history = "History"
    case fiction = "Fiction"
    case technology = "Technology"
    case health = "Health"
    case romance = "Romance"
    case spirituality = "Spirituality"
    case economics = "Economics"
    case creativity = "Creativity"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .selfHelp: return "sparkles"
        case .business: return "briefcase"
        case .biography: return "person.text.rectangle"
        case .psychology: return "brain.head.profile"
        case .science: return "atom"
        case .philosophy: return "lightbulb"
        case .history: return "clock.arrow.circlepath"
        case .fiction: return "book.closed"
        case .technology: return "desktopcomputer"
        case .health: return "heart"
        case .romance: return "heart.text.clipboard"
        case .spirituality: return "leaf"
        case .economics: return "chart.line.uptrend.xyaxis"
        case .creativity: return "paintbrush"
        }
    }
}

// MARK: - Reading Time

enum ReadingTime: Int, CaseIterable, Identifiable {
    case oneMin = 1
    case threeMin = 3
    case fiveMin = 5
    case tenMin = 10

    var id: Int { rawValue }

    var label: String {
        "\(rawValue) min"
    }

    var description: String {
        switch self {
        case .oneMin: return "Quick bite"
        case .threeMin: return "Short read"
        case .fiveMin: return "Medium read"
        case .tenMin: return "Deep dive"
        }
    }
}

// MARK: - Reading Fonts (Kindle-style)

import SwiftUI

enum ReadingFont: String, CaseIterable, Identifiable {
    case system      = "system"
    case newYork     = "newYork"
    case georgia     = "georgia"
    case palatino    = "palatino"
    case baskerville = "baskerville"
    case charter     = "charter"
    case iowan       = "iowan"
    case literata    = "literata"
    case athelas     = "athelas"
    case avenirNext  = "avenirNext"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .system:      return "System"
        case .newYork:     return "New York"
        case .georgia:     return "Georgia"
        case .palatino:    return "Palatino"
        case .baskerville: return "Baskerville"
        case .charter:     return "Charter"
        case .iowan:       return "Iowan"
        case .literata:    return "Literata"
        case .athelas:     return "Athelas"
        case .avenirNext:  return "Avenir Next"
        }
    }

    var category: String {
        switch self {
        case .system:     return "Sans-serif"
        case .avenirNext: return "Sans-serif"
        default:          return "Serif"
        }
    }

    /// The actual iOS font name for UIFont / custom Font usage
    private var fontName: String? {
        switch self {
        case .system:      return nil // use .system
        case .newYork:     return nil // use .design(.serif)
        case .georgia:     return "Georgia"
        case .palatino:    return "Palatino-Roman"
        case .baskerville: return "Baskerville"
        case .charter:     return "Charter-Roman"
        case .iowan:       return "IowanOldStyle-Roman"
        case .literata:    return "Georgia" // Literata not available on iOS; fallback to Georgia
        case .athelas:     return "Athelas-Regular"
        case .avenirNext:  return "AvenirNext-Regular"
        }
    }

    func font(size: CGFloat) -> Font {
        switch self {
        case .system:
            return .system(size: size, weight: .regular, design: .default)
        case .newYork:
            return .system(size: size, weight: .regular, design: .serif)
        default:
            if let name = fontName {
                return .custom(name, size: size)
            }
            return .system(size: size, weight: .regular, design: .serif)
        }
    }

    /// Preview sample text rendered in this font
    func previewFont() -> Font {
        font(size: 16)
    }
}

// MARK: - Reading Settings (Local + Sync)

class ReadingSettings: ObservableObject {
    static let shared = ReadingSettings()

    @Published var fontFamily: ReadingFont {
        didSet {
            UserDefaults.standard.set(fontFamily.rawValue, forKey: "bb_fontFamily")
            syncToBackend()
        }
    }

    @Published var fontSize: Int {
        didSet {
            UserDefaults.standard.set(fontSize, forKey: "bb_fontSize")
            syncToBackend()
        }
    }

    static let minFontSize = 14
    static let maxFontSize = 28
    static let fontSizeStep = 1

    private init() {
        let savedFamily = UserDefaults.standard.string(forKey: "bb_fontFamily") ?? "system"
        self.fontFamily = ReadingFont(rawValue: savedFamily) ?? .system
        let savedSize = UserDefaults.standard.integer(forKey: "bb_fontSize")
        self.fontSize = savedSize > 0 ? savedSize : 18
    }

    /// Apply settings loaded from the server (without triggering a re-sync)
    func applyFromServer(fontFamily: String?, fontSize: Int?) {
        if let family = fontFamily, let font = ReadingFont(rawValue: family) {
            if self.fontFamily != font {
                UserDefaults.standard.set(family, forKey: "bb_fontFamily")
                DispatchQueue.main.async { self.fontFamily = font }
            }
        }
        if let size = fontSize, size >= ReadingSettings.minFontSize && size <= ReadingSettings.maxFontSize {
            if self.fontSize != size {
                UserDefaults.standard.set(size, forKey: "bb_fontSize")
                DispatchQueue.main.async { self.fontSize = size }
            }
        }
    }

    /// The reading font at the user's chosen size
    var readingBodyFont: Font {
        fontFamily.font(size: CGFloat(fontSize))
    }

    /// A slightly larger variant for detail headers
    var readingLargeFont: Font {
        fontFamily.font(size: CGFloat(fontSize + 2))
    }

    /// Content preview font on cards (smaller than full reading)
    var cardPreviewFont: Font {
        fontFamily.font(size: CGFloat(max(fontSize - 3, ReadingSettings.minFontSize)))
    }

    private func syncToBackend() {
        Task {
            try? await APIService.shared.updatePreferences(
                bookCategories: nil,
                preferredReadingTimes: nil,
                fontFamily: fontFamily.rawValue,
                fontSize: fontSize,
                onboardingCompleted: nil
            )
        }
    }
}
