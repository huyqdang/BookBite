import SwiftUI

struct BookmarksView: View {
    @StateObject private var viewModel = BookmarksViewModel()
    @State private var selectedStory: Story?

    var body: some View {
        NavigationStack {
            ZStack {
                BBColors.background
                    .ignoresSafeArea()

                if viewModel.isLoading && viewModel.stories.isEmpty {
                    ProgressView()
                } else if viewModel.stories.isEmpty {
                    emptyView
                } else {
                    storyList
                }
            }
            .navigationTitle("Bookmarks")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                            viewModel.isGridView.toggle()
                        }
                    } label: {
                        Image(systemName: viewModel.isGridView ? "list.bullet" : "square.grid.2x2")
                            .font(.system(size: 16))
                            .foregroundColor(BBColors.text)
                    }
                }
            }
            .sheet(item: $selectedStory) { story in
                StoryDetailView(story: story) { _ in }
            }
        }
        .task {
            await viewModel.loadBookmarks(reset: true)
        }
    }

    // MARK: - List View

    private var storyList: some View {
        ScrollView {
            if viewModel.isGridView {
                gridLayout
            } else {
                listLayout
            }
        }
    }

    private var listLayout: some View {
        LazyVStack(spacing: BBSpacing.sm) {
            ForEach(viewModel.stories) { story in
                bookmarkRow(story: story)
                    .transition(.asymmetric(
                        insertion: .slide.combined(with: .opacity),
                        removal: .move(edge: .trailing).combined(with: .opacity)
                    ))
            }
        }
        .padding(.horizontal, BBSpacing.md)
        .padding(.vertical, BBSpacing.sm)
        .padding(.bottom, 100)
    }

    private var gridLayout: some View {
        LazyVGrid(columns: [
            GridItem(.flexible(), spacing: BBSpacing.sm),
            GridItem(.flexible(), spacing: BBSpacing.sm),
        ], spacing: BBSpacing.sm) {
            ForEach(viewModel.stories) { story in
                gridCard(story: story)
            }
        }
        .padding(.horizontal, BBSpacing.md)
        .padding(.vertical, BBSpacing.sm)
        .padding(.bottom, 100)
    }

    // MARK: - Row

    private func bookmarkRow(story: Story) -> some View {
        Button {
            selectedStory = story
        } label: {
            HStack(spacing: BBSpacing.md) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(story.title)
                        .font(BBFonts.titleMedium())
                        .foregroundColor(BBColors.text)
                        .lineLimit(2)

                    if let book = story.book {
                        Text(book.title)
                            .font(BBFonts.bodySmall())
                            .foregroundColor(BBColors.textTertiary)
                            .lineLimit(1)
                    }

                    Text("\(story.readingTimeMinutes) min")
                        .font(BBFonts.label())
                        .foregroundColor(BBColors.textSecondary)
                }

                Spacer()

                // Remove bookmark
                Button {
                    Task {
                        await viewModel.removeBookmark(storyId: story.id)
                        await MainActor.run {
                            withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {}
                        }
                    }
                } label: {
                    Image(systemName: "bookmark.fill")
                        .font(.system(size: 16))
                        .foregroundColor(BBColors.text)
                }
            }
            .padding(BBSpacing.md)
            .background(BBColors.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: BBRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: BBRadius.md)
                    .stroke(BBColors.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Grid Card

    private func gridCard(story: Story) -> some View {
        Button {
            selectedStory = story
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                Text(story.title)
                    .font(BBFonts.bodyMedium())
                    .fontWeight(.semibold)
                    .foregroundColor(BBColors.text)
                    .lineLimit(3)

                Spacer()

                HStack {
                    Text("\(story.readingTimeMinutes) min")
                        .font(BBFonts.label())
                        .foregroundColor(BBColors.textTertiary)
                    Spacer()
                    Image(systemName: "bookmark.fill")
                        .font(.system(size: 12))
                        .foregroundColor(BBColors.textTertiary)
                }
            }
            .padding(BBSpacing.md)
            .frame(height: 140)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(BBColors.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: BBRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: BBRadius.md)
                    .stroke(BBColors.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Empty

    private var emptyView: some View {
        VStack(spacing: BBSpacing.md) {
            Image(systemName: "bookmark")
                .font(.system(size: 48))
                .foregroundColor(BBColors.textTertiary)

            Text("No bookmarks yet")
                .font(BBFonts.titleLarge())
                .foregroundColor(BBColors.text)

            Text("Save stories you love and\ncome back to them anytime.")
                .font(BBFonts.bodyMedium())
                .foregroundColor(BBColors.textSecondary)
                .multilineTextAlignment(.center)
        }
    }
}
