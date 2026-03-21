import SwiftUI

struct FeedView: View {
    @StateObject private var viewModel = FeedViewModel()
    @State private var selectedStory: Story?
    @State private var hasRestoredScroll = false
    @State private var scrolledID: String?

    var body: some View {
        NavigationStack {
            ZStack {
                BBColors.background
                    .ignoresSafeArea()

                if viewModel.isLoading && viewModel.stories.isEmpty {
                    loadingView
                } else if viewModel.stories.isEmpty && !viewModel.isLoading {
                    emptyView
                } else {
                    storyList
                }
            }
            .navigationTitle("BookBite")
            .navigationBarTitleDisplayMode(.large)
            .sheet(item: $selectedStory) { story in
                StoryDetailView(story: story) { action in
                    handleStoryAction(action, for: story)
                }
            }
        }
        .task {
            await viewModel.loadInitialFeedIfNeeded()
        }
        .onAppear {
            viewModel.startTracking()
        }
        .onDisappear {
            viewModel.stopTracking()
        }
    }

    // MARK: - Story List

    private var storyList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: BBSpacing.md) {
                    ForEach(Array(viewModel.stories.enumerated()), id: \.element.id) { index, story in

                        // Anchor line — sits right before the bookmark story.
                        // Only advances when you scroll down near it.
                        if index == viewModel.bookmarkIndex && viewModel.bookmarkIndex > 0 {
                            anchorLine
                                .transition(.opacity.combined(with: .scale(scale: 0.95)))
                                .id("bookmark-anchor")
                        }

                        StoryCard(
                            story: story,
                            onLike: {
                                Task { await viewModel.toggleLike(for: story.id) }
                            },
                            onBookmark: {
                                Task { await viewModel.toggleBookmark(for: story.id) }
                            },
                            onTap: {
                                selectedStory = story
                                viewModel.trackView(storyId: story.id, percentage: 10)
                            }
                        )
                        .id(story.id)
                        .padding(.horizontal, BBSpacing.md)
                        .onAppear {
                            viewModel.storyAppeared(story.id)

                            // Infinite scroll trigger
                            if story.id == viewModel.stories.last?.id {
                                Task { await viewModel.loadMore() }
                            }
                        }
                    }

                    if viewModel.isLoadingMore {
                        ProgressView()
                            .padding(.vertical, BBSpacing.lg)
                    }

                    if !viewModel.hasMore && !viewModel.stories.isEmpty {
                        allCaughtUpFooter
                    }
                }
                .scrollTargetLayout()
                .padding(.vertical, BBSpacing.sm)
                .padding(.bottom, 100)
            }
            .scrollPosition(id: $scrolledID)
            .onChange(of: scrolledID) { _, newID in
                guard let newID else { return }
                if let idx = viewModel.stories.firstIndex(where: { $0.id == newID }) {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        viewModel.updateScrollPosition(idx)
                    }
                }
            }
            .refreshable {
                await viewModel.refresh()
            }
            .onAppear {
                performScrollRestore(proxy: proxy)
            }
            .onChange(of: viewModel.restoreToStoryId) { _, _ in
                performScrollRestore(proxy: proxy)
            }
            // Floating "Continue reading" button — top right, outside content
            .overlay(alignment: .topTrailing) {
                if viewModel.shouldShowContinueButton {
                    continueReadingButton(proxy: proxy)
                        .padding(.trailing, BBSpacing.md)
                        .padding(.top, BBSpacing.sm)
                        .transition(.asymmetric(
                            insertion: .move(edge: .trailing).combined(with: .opacity),
                            removal: .opacity
                        ))
                }
            }
            .animation(.spring(response: 0.35, dampingFraction: 0.8), value: viewModel.shouldShowContinueButton)
        }
    }

    // MARK: - Continue Reading Button

    private func continueReadingButton(proxy: ScrollViewProxy) -> some View {
        Button {
            guard let targetId = viewModel.bookmarkStoryIdForScroll else { return }
            withAnimation(.easeInOut(duration: 0.5)) {
                proxy.scrollTo(targetId, anchor: .top)
            }
        } label: {
            Image(systemName: viewModel.isBookmarkBelow
                  ? "chevron.down"
                  : "chevron.up")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(BBColors.gray500)
                .frame(width: 32, height: 32)
                .background(
                    Circle()
                        .fill(BBColors.background.opacity(0.85))
                        .shadow(color: .black.opacity(0.06), radius: 4, y: 2)
                )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Anchor Line (subtle, between cards)

    private var anchorLine: some View {
        HStack(spacing: 12) {
            Rectangle()
                .fill(
                    LinearGradient(
                        colors: [.clear, BBColors.gray400],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .frame(height: 1.5)

            Circle()
                .fill(BBColors.gray500)
                .frame(width: 7, height: 7)
                .shadow(color: BBColors.gray400.opacity(0.5), radius: 2, y: 0)

            Rectangle()
                .fill(
                    LinearGradient(
                        colors: [BBColors.gray400, .clear],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .frame(height: 1.5)
        }
        .padding(.horizontal, BBSpacing.md)
        .padding(.vertical, 8)
    }

    // MARK: - All Caught Up Footer

    private var allCaughtUpFooter: some View {
        VStack(spacing: BBSpacing.md) {
            Divider()
                .padding(.horizontal, BBSpacing.xl)
                .padding(.top, BBSpacing.md)

            Image(systemName: "checkmark.circle")
                .font(.system(size: 32, weight: .light))
                .foregroundColor(BBColors.textTertiary)

            Text("You're all caught up")
                .font(BBFonts.titleMedium())
                .foregroundColor(BBColors.text)

            Text("Come back tomorrow for fresh stories")
                .font(BBFonts.bodySmall())
                .foregroundColor(BBColors.textTertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, BBSpacing.xl)
    }

    // MARK: - Empty State

    private var emptyView: some View {
        VStack(spacing: BBSpacing.md) {
            Spacer()

            Image(systemName: "book.closed")
                .font(.system(size: 48))
                .foregroundColor(BBColors.textTertiary)

            Text("No stories yet")
                .font(BBFonts.titleLarge())
                .foregroundColor(BBColors.text)

            Text("Stories will appear here once they're\nadded to your feed.")
                .font(BBFonts.bodyMedium())
                .foregroundColor(BBColors.textSecondary)
                .multilineTextAlignment(.center)

            BBButton(title: "Refresh", style: .outline) {
                Task { await viewModel.refresh() }
            }
            .frame(width: 140)

            Spacer()
            Spacer()
        }
    }

    // MARK: - Loading

    private var loadingView: some View {
        VStack(spacing: 0) {
            Spacer()
                .frame(height: 60)

            VStack(spacing: BBSpacing.md) {
                ZStack {
                    Circle()
                        .fill(BBColors.surface)
                        .frame(width: 80, height: 80)

                    Image(systemName: "book.fill")
                        .font(.system(size: 32, weight: .medium))
                        .foregroundColor(BBColors.primary)
                        .symbolEffect(.pulse.wholeSymbol, options: .repeating)
                }

                Text(greetingText)
                    .font(BBFonts.titleLarge())
                    .foregroundColor(BBColors.text)

                Text("Preparing your daily stories...")
                    .font(BBFonts.bodyMedium())
                    .foregroundColor(BBColors.textTertiary)
            }
            .padding(.bottom, BBSpacing.xl)

            VStack(spacing: BBSpacing.md) {
                ForEach(0..<3, id: \.self) { index in
                    skeletonCard
                        .padding(.horizontal, BBSpacing.md)
                        .opacity(1.0 - Double(index) * 0.25)
                }
            }

            Spacer()
        }
    }

    private var greetingText: String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 5..<12: return "Good morning"
        case 12..<17: return "Good afternoon"
        case 17..<22: return "Good evening"
        default: return "Late night reads"
        }
    }

    private var skeletonCard: some View {
        VStack(alignment: .leading, spacing: BBSpacing.sm) {
            RoundedRectangle(cornerRadius: BBRadius.sm)
                .fill(BBColors.gray900)
                .frame(height: 32)
                .shimmer()

            RoundedRectangle(cornerRadius: BBRadius.sm)
                .fill(BBColors.surface)
                .frame(height: 20)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, BBSpacing.md)
                .shimmer()

            VStack(spacing: 6) {
                ForEach(0..<3, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: 3)
                        .fill(BBColors.surface)
                        .frame(height: 14)
                }
                RoundedRectangle(cornerRadius: 3)
                    .fill(BBColors.surface)
                    .frame(height: 14)
                    .frame(maxWidth: .infinity)
                    .scaleEffect(x: 0.7, y: 1, anchor: .leading)
            }
            .padding(.horizontal, BBSpacing.md)
            .shimmer()

            HStack {
                RoundedRectangle(cornerRadius: BBRadius.sm)
                    .fill(BBColors.surface)
                    .frame(width: 120, height: 14)
                Spacer()
                HStack(spacing: BBSpacing.sm) {
                    Circle().fill(BBColors.surface).frame(width: 28, height: 28)
                    Circle().fill(BBColors.surface).frame(width: 28, height: 28)
                }
            }
            .padding(.horizontal, BBSpacing.md)
            .padding(.bottom, BBSpacing.md)
            .shimmer()
        }
        .background(BBColors.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: BBRadius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: BBRadius.lg)
                .stroke(BBColors.border, lineWidth: 1)
        )
    }

    // MARK: - Scroll Restore

    private func performScrollRestore(proxy: ScrollViewProxy) {
        guard let targetId = viewModel.restoreToStoryId, !hasRestoredScroll else { return }
        hasRestoredScroll = true
        // Give LazyVStack time to lay out content, then smoothly scroll
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
            withAnimation(.easeInOut(duration: 0.6)) {
                proxy.scrollTo(targetId, anchor: .top)
            }
        }
    }

    // MARK: - Actions

    private func handleStoryAction(_ action: StoryDetailAction, for story: Story) {
        switch action {
        case .like:
            Task { await viewModel.toggleLike(for: story.id) }
        case .bookmark:
            Task { await viewModel.toggleBookmark(for: story.id) }
        case .trackView(let percentage):
            viewModel.trackView(storyId: story.id, percentage: percentage)
        }
    }
}

// MARK: - Shimmer Effect

struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .overlay(
                LinearGradient(
                    colors: [
                        .clear,
                        BBColors.background.opacity(0.6),
                        .clear,
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )
                .offset(x: phase)
                .onAppear {
                    withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                        phase = 400
                    }
                }
            )
            .clipShape(RoundedRectangle(cornerRadius: BBRadius.lg))
    }
}

extension View {
    func shimmer() -> some View {
        modifier(ShimmerModifier())
    }
}
