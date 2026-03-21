import SwiftUI

@MainActor
class BookmarksViewModel: ObservableObject {
    @Published var stories: [Story] = []
    @Published var isLoading = false
    @Published var isGridView = false
    @Published var error: String?

    private var nextCursor: String?
    private var hasMore = true

    func loadBookmarks(reset: Bool = false) async {
        if reset {
            stories = []
            nextCursor = nil
            hasMore = true
        }

        guard !isLoading, hasMore else { return }
        isLoading = true

        do {
            let response = try await APIService.shared.getBookmarks(
                cursor: nextCursor,
                limit: 15
            )

            if reset {
                stories = response.stories
            } else {
                stories.append(contentsOf: response.stories)
            }

            nextCursor = response.nextCursor
            hasMore = response.hasMore
            error = nil
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    func removeBookmark(storyId: String) async {
        stories.removeAll { $0.id == storyId }
        do {
            let _ = try await APIService.shared.toggleBookmark(storyId: storyId)
        } catch {
            // Reload on failure
            await loadBookmarks(reset: true)
        }
    }
}
