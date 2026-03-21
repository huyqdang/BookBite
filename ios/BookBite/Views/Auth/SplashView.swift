import SwiftUI

struct SplashView: View {
    @State private var iconScale: CGFloat = 0.3
    @State private var iconOpacity: Double = 0
    @State private var titleOpacity: Double = 0
    @State private var titleOffset: CGFloat = 12
    @State private var subtitleOpacity: Double = 0
    @State private var dotsOpacity: Double = 0
    @State private var activeDot = 0

    // Timer for pulsing dots
    private let dotTimer = Timer.publish(every: 0.4, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack {
            BBColors.background
                .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // Logo icon with spring-in
                ZStack {
                    // Subtle glow ring behind the icon
                    Circle()
                        .fill(BBColors.gray100)
                        .frame(width: 100, height: 100)
                        .scaleEffect(iconScale * 1.1)
                        .opacity(iconOpacity * 0.6)

                    Image(systemName: "book.closed.fill")
                        .font(.system(size: 44, weight: .medium))
                        .foregroundColor(BBColors.primary)
                }
                .scaleEffect(iconScale)
                .opacity(iconOpacity)

                // App name
                Text("BookBite")
                    .font(.system(size: 36, weight: .bold, design: .default))
                    .tracking(-0.5)
                    .foregroundColor(BBColors.text)
                    .opacity(titleOpacity)
                    .offset(y: titleOffset)
                    .padding(.top, 20)

                // Tagline
                Text("Stories worth your time")
                    .font(BBFonts.bodyMedium())
                    .foregroundColor(BBColors.textTertiary)
                    .opacity(subtitleOpacity)
                    .padding(.top, 6)

                Spacer()

                // Loading dots
                HStack(spacing: 6) {
                    ForEach(0..<3, id: \.self) { index in
                        Circle()
                            .fill(activeDot == index ? BBColors.primary : BBColors.gray300)
                            .frame(width: 6, height: 6)
                            .scaleEffect(activeDot == index ? 1.3 : 1.0)
                            .animation(.easeInOut(duration: 0.3), value: activeDot)
                    }
                }
                .opacity(dotsOpacity)
                .padding(.bottom, 60)
            }
        }
        .onAppear {
            // Stage 1: Icon springs in (0s)
            withAnimation(.spring(response: 0.6, dampingFraction: 0.65)) {
                iconScale = 1.0
                iconOpacity = 1.0
            }

            // Stage 2: Title slides up (0.25s)
            withAnimation(.easeOut(duration: 0.5).delay(0.25)) {
                titleOpacity = 1.0
                titleOffset = 0
            }

            // Stage 3: Subtitle fades in (0.5s)
            withAnimation(.easeOut(duration: 0.4).delay(0.5)) {
                subtitleOpacity = 1.0
            }

            // Stage 4: Loading dots appear (0.8s)
            withAnimation(.easeOut(duration: 0.3).delay(0.8)) {
                dotsOpacity = 1.0
            }
        }
        .onReceive(dotTimer) { _ in
            activeDot = (activeDot + 1) % 3
        }
    }
}
