import SwiftUI

// MARK: - BookBite Design System
// Minimalistic black & white, inspired by shadcn/ui

enum BBColors {
    static let primary = Color.black
    static let background = Color.white
    static let surface = Color(hex: "F5F5F5")
    static let border = Color(hex: "E5E5E5")
    static let borderStrong = Color(hex: "D4D4D4")

    static let text = Color.black
    static let textSecondary = Color(hex: "666666")
    static let textTertiary = Color(hex: "999999")
    static let textInverse = Color.white

    static let cardBackground = Color.white
    static let cardBackgroundHover = Color(hex: "FAFAFA")

    // Grays
    static let gray50 = Color(hex: "FAFAFA")
    static let gray100 = Color(hex: "F5F5F5")
    static let gray200 = Color(hex: "E5E5E5")
    static let gray300 = Color(hex: "D4D4D4")
    static let gray400 = Color(hex: "A3A3A3")
    static let gray500 = Color(hex: "737373")
    static let gray600 = Color(hex: "525252")
    static let gray700 = Color(hex: "404040")
    static let gray800 = Color(hex: "262626")
    static let gray900 = Color(hex: "171717")
}

enum BBFonts {
    // Headings — SF Pro Display
    static func displayLarge() -> Font { .system(size: 34, weight: .bold, design: .default) }
    static func displayMedium() -> Font { .system(size: 28, weight: .bold, design: .default) }
    static func displaySmall() -> Font { .system(size: 22, weight: .semibold, design: .default) }

    // Body — SF Pro Text
    static func titleLarge() -> Font { .system(size: 20, weight: .semibold, design: .default) }
    static func titleMedium() -> Font { .system(size: 17, weight: .semibold, design: .default) }
    static func bodyLarge() -> Font { .system(size: 17, weight: .regular, design: .default) }
    static func bodyMedium() -> Font { .system(size: 15, weight: .regular, design: .default) }
    static func bodySmall() -> Font { .system(size: 13, weight: .regular, design: .default) }
    static func caption() -> Font { .system(size: 12, weight: .medium, design: .default) }
    static func label() -> Font { .system(size: 11, weight: .semibold, design: .default) }

    // Reading — Serif for story content
    static func readingBody() -> Font { .system(size: 18, weight: .regular, design: .serif) }
    static func readingLarge() -> Font { .system(size: 20, weight: .regular, design: .serif) }
}

enum BBSpacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 16
    static let lg: CGFloat = 24
    static let xl: CGFloat = 32
    static let xxl: CGFloat = 48
}

enum BBRadius {
    static let sm: CGFloat = 6
    static let md: CGFloat = 10
    static let lg: CGFloat = 16
    static let xl: CGFloat = 24
    static let full: CGFloat = 9999
}

// MARK: - Color Hex Extension

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 6: // RGB
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
