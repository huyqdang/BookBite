import SwiftUI

struct StoryCard: View {
    let story: Story
    let onLike: () -> Void
    let onBookmark: () -> Void
    let onTap: () -> Void

    @ObservedObject private var readingSettings = ReadingSettings.shared
    @State private var likeScale: CGFloat = 1.0
    @State private var bookmarkScale: CGFloat = 1.0

    private var readingTimeLabel: String {
        switch story.readingTimeMinutes {
        case 1: return "1 MIN"
        case 3: return "3 MIN"
        case 5: return "5 MIN"
        case 10: return "10 MIN"
        default: return "\(story.readingTimeMinutes) MIN"
        }
    }

    private var readingTimeDescription: String {
        switch story.readingTimeMinutes {
        case 1: return "Quick bite"
        case 3: return "Short read"
        case 5: return "Medium read"
        case 10: return "Deep dive"
        default: return "Read"
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

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 0) {
                // Reading time banner
                HStack(spacing: 8) {
                    Image(systemName: readingTimeIcon)
                        .font(.system(size: 11, weight: .bold))

                    Text(readingTimeLabel)
                        .font(.system(size: 11, weight: .heavy, design: .rounded))
                        .tracking(1.2)

                    Text("·")
                        .font(.system(size: 11, weight: .bold))

                    Text(readingTimeDescription)
                        .font(.system(size: 11, weight: .medium))
                }
                .foregroundColor(.white)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(BBColors.primary)

                // Book source
                if let book = story.book {
                    Text(book.title.uppercased())
                        .font(.system(size: 10, weight: .semibold))
                        .tracking(0.8)
                        .foregroundColor(BBColors.textTertiary)
                        .lineLimit(1)
                        .padding(.horizontal, BBSpacing.lg)
                        .padding(.top, 14)
                        .padding(.bottom, 4)
                }

                // Title
                Text(story.title)
                    .font(BBFonts.displaySmall())
                    .foregroundColor(BBColors.text)
                    .lineLimit(2)
                    .padding(.horizontal, BBSpacing.lg)
                    .padding(.bottom, BBSpacing.sm)

                // Content preview — uses reader font settings
                Text(story.content)
                    .font(readingSettings.cardPreviewFont)
                    .foregroundColor(BBColors.textSecondary)
                    .lineLimit(4)
                    .lineSpacing(4)
                    .padding(.horizontal, BBSpacing.lg)
                    .padding(.bottom, BBSpacing.md)

                Divider()
                    .padding(.horizontal, BBSpacing.md)

                // Footer: Author + Actions
                HStack {
                    if let book = story.book {
                        Text("by \(book.author)")
                            .font(BBFonts.bodySmall())
                            .foregroundColor(BBColors.textTertiary)
                    }

                    Spacer()

                    // Like button
                    Button {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.5)) {
                            likeScale = 1.3
                        }
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                                likeScale = 1.0
                            }
                        }
                        let impactFeedback = UIImpactFeedbackGenerator(style: .light)
                        impactFeedback.impactOccurred()
                        onLike()
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: story.isLiked == true ? "heart.fill" : "heart")
                                .font(.system(size: 16))
                                .scaleEffect(likeScale)
                            Text("\(story.likeCount)")
                                .font(BBFonts.bodySmall())
                        }
                        .foregroundColor(story.isLiked == true ? .black : BBColors.textTertiary)
                    }
                    .buttonStyle(.plain)

                    // Bookmark button
                    Button {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.5)) {
                            bookmarkScale = 1.3
                        }
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                                bookmarkScale = 1.0
                            }
                        }
                        let impactFeedback = UIImpactFeedbackGenerator(style: .light)
                        impactFeedback.impactOccurred()
                        onBookmark()
                    } label: {
                        Image(systemName: story.isBookmarked == true ? "bookmark.fill" : "bookmark")
                            .font(.system(size: 16))
                            .scaleEffect(bookmarkScale)
                            .foregroundColor(story.isBookmarked == true ? .black : BBColors.textTertiary)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, BBSpacing.lg)
                .padding(.vertical, BBSpacing.md)
            }
            .background(BBColors.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: BBRadius.lg))
            .overlay(
                RoundedRectangle(cornerRadius: BBRadius.lg)
                    .stroke(BBColors.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}
