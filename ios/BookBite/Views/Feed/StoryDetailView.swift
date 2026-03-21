import SwiftUI

enum StoryDetailAction {
    case like
    case bookmark
    case trackView(Double)
}

struct StoryDetailView: View {
    let story: Story
    let onAction: (StoryDetailAction) -> Void

    @ObservedObject private var readingSettings = ReadingSettings.shared
    @Environment(\.dismiss) private var dismiss
    @State private var scrollOffset: CGFloat = 0
    @State private var appeared = false
    @State private var likeScale: CGFloat = 1.0
    @State private var bookmarkScale: CGFloat = 1.0
    @State private var showReaderSettings = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    // Header
                    VStack(alignment: .leading, spacing: BBSpacing.sm) {
                        // Reading time + tone badges
                        HStack(spacing: 8) {
                            readingTimeBadge

                            if let tone = story.tone {
                                badge(tone.capitalized)
                            }
                        }

                        Text(story.title)
                            .font(BBFonts.displayMedium())
                            .foregroundColor(BBColors.text)

                        if let book = story.book {
                            Text("From \"\(book.title)\" by \(book.author)")
                                .font(BBFonts.bodyMedium())
                                .foregroundColor(BBColors.textSecondary)
                        }
                    }
                    .padding(.horizontal, BBSpacing.lg)
                    .padding(.top, BBSpacing.lg)
                    .padding(.bottom, BBSpacing.lg)
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 20)

                    Divider()
                        .padding(.horizontal, BBSpacing.lg)

                    // Story content — uses user's reading font settings
                    Text(story.content)
                        .font(readingSettings.readingBodyFont)
                        .foregroundColor(BBColors.text)
                        .lineSpacing(8)
                        .padding(.horizontal, BBSpacing.lg)
                        .padding(.vertical, BBSpacing.xl)
                        .opacity(appeared ? 1 : 0)
                        .offset(y: appeared ? 0 : 30)
                        .animation(.easeInOut(duration: 0.2), value: readingSettings.fontSize)
                        .animation(.easeInOut(duration: 0.2), value: readingSettings.fontFamily)

                    Divider()
                        .padding(.horizontal, BBSpacing.lg)

                    // Source section
                    if let book = story.book {
                        sourceSection(book: book)
                    }

                    Spacer(minLength: 100)
                }
            }
            .background(BBColors.background)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(BBColors.text)
                            .frame(width: 32, height: 32)
                            .background(BBColors.surface)
                            .clipShape(Circle())
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    HStack(spacing: 12) {
                        // Reader settings (Aa button like Kindle)
                        Button {
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                            showReaderSettings = true
                        } label: {
                            Text("Aa")
                                .font(.system(size: 16, weight: .medium, design: .serif))
                                .foregroundColor(BBColors.text)
                                .frame(width: 32, height: 32)
                                .background(BBColors.surface)
                                .clipShape(Circle())
                        }

                        // Like
                        Button {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.5)) {
                                likeScale = 1.4
                            }
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                                withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                                    likeScale = 1.0
                                }
                            }
                            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                            onAction(.like)
                        } label: {
                            Image(systemName: story.isLiked == true ? "heart.fill" : "heart")
                                .font(.system(size: 18))
                                .scaleEffect(likeScale)
                                .foregroundColor(BBColors.text)
                        }

                        // Bookmark
                        Button {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.5)) {
                                bookmarkScale = 1.4
                            }
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                                withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                                    bookmarkScale = 1.0
                                }
                            }
                            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                            onAction(.bookmark)
                        } label: {
                            Image(systemName: story.isBookmarked == true ? "bookmark.fill" : "bookmark")
                                .font(.system(size: 18))
                                .scaleEffect(bookmarkScale)
                                .foregroundColor(BBColors.text)
                        }
                    }
                }
            }
            .sheet(isPresented: $showReaderSettings) {
                ReaderSettingsSheet()
                    .presentationDetents([.medium])
                    .presentationDragIndicator(.visible)
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.5)) {
                appeared = true
            }
            onAction(.trackView(50))
        }
        .onDisappear {
            onAction(.trackView(100))
        }
    }

    private var readingTimeIcon: String {
        switch story.readingTimeMinutes {
        case 1: return "bolt.fill"
        case 3: return "clock.fill"
        case 5: return "book.fill"
        case 10: return "text.book.closed.fill"
        default: return "clock.fill"
        }
    }

    private var readingTimeLabel: String {
        switch story.readingTimeMinutes {
        case 1: return "1 min · Quick bite"
        case 3: return "3 min · Short read"
        case 5: return "5 min · Medium read"
        case 10: return "10 min · Deep dive"
        default: return "\(story.readingTimeMinutes) min read"
        }
    }

    private var readingTimeBadge: some View {
        HStack(spacing: 6) {
            Image(systemName: readingTimeIcon)
                .font(.system(size: 11, weight: .bold))
            Text(readingTimeLabel.uppercased())
                .font(.system(size: 10, weight: .heavy, design: .rounded))
                .tracking(0.8)
        }
        .foregroundColor(.white)
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(BBColors.primary)
        .clipShape(Capsule())
    }

    private func badge(_ text: String) -> some View {
        Text(text)
            .font(BBFonts.label())
            .foregroundColor(BBColors.textSecondary)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(BBColors.surface)
            .clipShape(Capsule())
            .overlay(Capsule().stroke(BBColors.border, lineWidth: 1))
    }

    private func sourceSection(book: BookInfo) -> some View {
        VStack(alignment: .leading, spacing: BBSpacing.sm) {
            Text("SOURCE")
                .font(BBFonts.label())
                .foregroundColor(BBColors.textTertiary)

            HStack(spacing: BBSpacing.md) {
                // Book icon placeholder
                RoundedRectangle(cornerRadius: BBRadius.sm)
                    .fill(BBColors.surface)
                    .frame(width: 48, height: 64)
                    .overlay(
                        Image(systemName: "book.closed.fill")
                            .foregroundColor(BBColors.textTertiary)
                    )

                VStack(alignment: .leading, spacing: 2) {
                    Text(book.title)
                        .font(BBFonts.titleMedium())
                        .foregroundColor(BBColors.text)
                    Text("by \(book.author)")
                        .font(BBFonts.bodySmall())
                        .foregroundColor(BBColors.textSecondary)
                }

                Spacer()

                if let link = book.purchaseLink, !link.isEmpty {
                    Link(destination: URL(string: link) ?? URL(string: "https://amazon.com")!) {
                        Text("Buy")
                            .font(BBFonts.bodySmall())
                            .fontWeight(.semibold)
                            .foregroundColor(BBColors.textInverse)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(BBColors.primary)
                            .clipShape(Capsule())
                    }
                }
            }
        }
        .padding(.horizontal, BBSpacing.lg)
        .padding(.vertical, BBSpacing.lg)
    }
}

// MARK: - Reader Settings Sheet (Kindle-style)

struct ReaderSettingsSheet: View {
    @ObservedObject private var settings = ReadingSettings.shared
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Live preview
                previewSection
                    .padding(.horizontal, BBSpacing.lg)
                    .padding(.top, BBSpacing.md)
                    .padding(.bottom, BBSpacing.lg)

                Divider()

                ScrollView {
                    VStack(spacing: BBSpacing.lg) {
                        // Font size slider
                        fontSizeSection
                            .padding(.horizontal, BBSpacing.lg)
                            .padding(.top, BBSpacing.lg)

                        Divider()
                            .padding(.horizontal, BBSpacing.lg)

                        // Font family picker
                        fontFamilySection
                            .padding(.horizontal, BBSpacing.lg)
                            .padding(.bottom, BBSpacing.xl)
                    }
                }
            }
            .background(BBColors.background)
            .navigationTitle("Reader Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }
                        .fontWeight(.semibold)
                        .foregroundColor(BBColors.text)
                }
            }
        }
    }

    // MARK: - Live Preview

    private var previewSection: some View {
        VStack(alignment: .leading, spacing: BBSpacing.sm) {
            Text("Preview")
                .font(BBFonts.caption())
                .foregroundColor(BBColors.textTertiary)
                .textCase(.uppercase)

            Text("A man named Marcus sat alone in his study, the weight of a decision pressing on his mind. He had spent years building something remarkable, but now he faced a crossroads...")
                .font(settings.readingBodyFont)
                .foregroundColor(BBColors.text)
                .lineSpacing(8)
                .padding(BBSpacing.md)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(BBColors.surface)
                .clipShape(RoundedRectangle(cornerRadius: BBRadius.md))
                .animation(.easeInOut(duration: 0.2), value: settings.fontSize)
                .animation(.easeInOut(duration: 0.2), value: settings.fontFamily)
        }
    }

    // MARK: - Font Size

    private var fontSizeSection: some View {
        VStack(alignment: .leading, spacing: BBSpacing.md) {
            HStack {
                Text("Font Size")
                    .font(BBFonts.titleMedium())
                    .foregroundColor(BBColors.text)
                Spacer()
                Text("\(settings.fontSize) pt")
                    .font(BBFonts.bodyMedium())
                    .foregroundColor(BBColors.textSecondary)
                    .monospacedDigit()
            }

            HStack(spacing: BBSpacing.md) {
                // Decrease button
                Button {
                    if settings.fontSize > ReadingSettings.minFontSize {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        withAnimation(.easeInOut(duration: 0.15)) {
                            settings.fontSize -= ReadingSettings.fontSizeStep
                        }
                    }
                } label: {
                    Text("A")
                        .font(.system(size: 14, weight: .medium, design: .serif))
                        .foregroundColor(settings.fontSize > ReadingSettings.minFontSize ? BBColors.text : BBColors.textTertiary)
                        .frame(width: 44, height: 44)
                        .background(BBColors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: BBRadius.md))
                        .overlay(
                            RoundedRectangle(cornerRadius: BBRadius.md)
                                .stroke(BBColors.border, lineWidth: 1)
                        )
                }
                .disabled(settings.fontSize <= ReadingSettings.minFontSize)

                // Slider
                Slider(
                    value: Binding(
                        get: { Double(settings.fontSize) },
                        set: { settings.fontSize = Int($0) }
                    ),
                    in: Double(ReadingSettings.minFontSize)...Double(ReadingSettings.maxFontSize),
                    step: Double(ReadingSettings.fontSizeStep)
                )
                .tint(BBColors.primary)

                // Increase button
                Button {
                    if settings.fontSize < ReadingSettings.maxFontSize {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        withAnimation(.easeInOut(duration: 0.15)) {
                            settings.fontSize += ReadingSettings.fontSizeStep
                        }
                    }
                } label: {
                    Text("A")
                        .font(.system(size: 22, weight: .medium, design: .serif))
                        .foregroundColor(settings.fontSize < ReadingSettings.maxFontSize ? BBColors.text : BBColors.textTertiary)
                        .frame(width: 44, height: 44)
                        .background(BBColors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: BBRadius.md))
                        .overlay(
                            RoundedRectangle(cornerRadius: BBRadius.md)
                                .stroke(BBColors.border, lineWidth: 1)
                        )
                }
                .disabled(settings.fontSize >= ReadingSettings.maxFontSize)
            }
        }
    }

    // MARK: - Font Family

    private var fontFamilySection: some View {
        VStack(alignment: .leading, spacing: BBSpacing.md) {
            Text("Font")
                .font(BBFonts.titleMedium())
                .foregroundColor(BBColors.text)

            LazyVStack(spacing: 0) {
                ForEach(ReadingFont.allCases) { font in
                    fontRow(font)

                    if font != ReadingFont.allCases.last {
                        Divider()
                            .padding(.leading, BBSpacing.md)
                    }
                }
            }
            .background(BBColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: BBRadius.lg))
            .overlay(
                RoundedRectangle(cornerRadius: BBRadius.lg)
                    .stroke(BBColors.border, lineWidth: 1)
            )
        }
    }

    private func fontRow(_ font: ReadingFont) -> some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            withAnimation(.easeInOut(duration: 0.2)) {
                settings.fontFamily = font
            }
        } label: {
            HStack(spacing: BBSpacing.md) {
                // Font sample rendered in the actual font
                Text("Ag")
                    .font(font.font(size: 22))
                    .foregroundColor(BBColors.text)
                    .frame(width: 40, alignment: .center)

                VStack(alignment: .leading, spacing: 2) {
                    Text(font.displayName)
                        .font(BBFonts.bodyLarge())
                        .foregroundColor(BBColors.text)
                    Text(font.category)
                        .font(BBFonts.caption())
                        .foregroundColor(BBColors.textTertiary)
                }

                Spacer()

                if settings.fontFamily == font {
                    Image(systemName: "checkmark")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(BBColors.primary)
                }
            }
            .padding(.horizontal, BBSpacing.md)
            .padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
