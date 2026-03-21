import SwiftUI

// MARK: - Custom Animation Presets

extension Animation {
    /// Smooth spring for UI transitions
    static var smoothSpring: Animation {
        .spring(response: 0.4, dampingFraction: 0.8, blendDuration: 0)
    }

    /// Bouncy spring for interactive elements
    static var bouncySpring: Animation {
        .spring(response: 0.35, dampingFraction: 0.6, blendDuration: 0)
    }

    /// Snappy spring for tab switches
    static var snappy: Animation {
        .spring(response: 0.3, dampingFraction: 0.75, blendDuration: 0)
    }

    /// Gentle ease for content transitions
    static var gentleEase: Animation {
        .easeInOut(duration: 0.35)
    }
}

// MARK: - View Transitions

extension AnyTransition {
    /// Slide up with fade
    static var slideUp: AnyTransition {
        .asymmetric(
            insertion: .move(edge: .bottom).combined(with: .opacity),
            removal: .move(edge: .top).combined(with: .opacity)
        )
    }

    /// Scale in from center
    static var scaleIn: AnyTransition {
        .scale(scale: 0.8).combined(with: .opacity)
    }
}

// MARK: - Staggered Appearance Modifier

struct StaggeredAppearance: ViewModifier {
    let index: Int
    let totalItems: Int
    @State private var appeared = false

    func body(content: Content) -> some View {
        content
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 20)
            .onAppear {
                let delay = Double(min(index, 10)) * 0.05
                withAnimation(.smoothSpring.delay(delay)) {
                    appeared = true
                }
            }
    }
}

extension View {
    func staggeredAppearance(index: Int, total: Int = 10) -> some View {
        modifier(StaggeredAppearance(index: index, totalItems: total))
    }
}

// MARK: - Press Effect

struct PressEffect: ViewModifier {
    @State private var isPressed = false

    func body(content: Content) -> some View {
        content
            .scaleEffect(isPressed ? 0.97 : 1.0)
            .animation(.spring(response: 0.2, dampingFraction: 0.7), value: isPressed)
            .simultaneousGesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in isPressed = true }
                    .onEnded { _ in isPressed = false }
            )
    }
}

extension View {
    func pressEffect() -> some View {
        modifier(PressEffect())
    }
}

// MARK: - Haptic Feedback Helpers

enum HapticManager {
    static func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .medium) {
        UIImpactFeedbackGenerator(style: style).impactOccurred()
    }

    static func notification(_ type: UINotificationFeedbackGenerator.FeedbackType) {
        UINotificationFeedbackGenerator().notificationOccurred(type)
    }

    static func selection() {
        UISelectionFeedbackGenerator().selectionChanged()
    }
}
