import SwiftUI

struct BBButton: View {
    let title: String
    var style: ButtonStyle = .primary
    var isLoading: Bool = false
    var isDisabled: Bool = false
    let action: () -> Void

    enum ButtonStyle {
        case primary
        case secondary
        case outline
        case ghost
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView()
                        .tint(style == .primary ? .white : .black)
                        .scaleEffect(0.8)
                }
                Text(title)
                    .font(BBFonts.titleMedium())
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(background)
            .foregroundColor(foreground)
            .clipShape(RoundedRectangle(cornerRadius: BBRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: BBRadius.md)
                    .stroke(borderColor, lineWidth: style == .outline ? 1.5 : 0)
            )
        }
        .disabled(isLoading || isDisabled)
        .opacity(isDisabled ? 0.5 : 1.0)
    }

    private var background: Color {
        switch style {
        case .primary: return BBColors.primary
        case .secondary: return BBColors.surface
        case .outline: return .clear
        case .ghost: return .clear
        }
    }

    private var foreground: Color {
        switch style {
        case .primary: return BBColors.textInverse
        case .secondary: return BBColors.text
        case .outline: return BBColors.text
        case .ghost: return BBColors.text
        }
    }

    private var borderColor: Color {
        switch style {
        case .outline: return BBColors.border
        default: return .clear
        }
    }
}

// MARK: - Social Sign-In Buttons

struct AppleSignInButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: "apple.logo")
                    .font(.system(size: 18, weight: .medium))
                Text("Continue with Apple")
                    .font(BBFonts.titleMedium())
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Color.black)
            .foregroundColor(.white)
            .clipShape(RoundedRectangle(cornerRadius: BBRadius.md))
        }
    }
}

struct GoogleSignInButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Text("G")
                    .font(.system(size: 18, weight: .bold))
                Text("Continue with Google")
                    .font(BBFonts.titleMedium())
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Color.white)
            .foregroundColor(.black)
            .clipShape(RoundedRectangle(cornerRadius: BBRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: BBRadius.md)
                    .stroke(BBColors.border, lineWidth: 1.5)
            )
        }
    }
}
