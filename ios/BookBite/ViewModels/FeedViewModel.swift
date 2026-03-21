import SwiftUI
import Combine

// MARK: - Feed Cache (persisted to disk)

private struct FeedCache: Codable {
    let stories: [Story]
    let nextCursor: String?
    let hasMore: Bool
    let date: String              // "YYYY-MM-DD" — invalidate when the day changes
    let bookmarkIndex: Int        // Index of the anchor line (between last-read and next-unread)
    let bookmarkStoryId: String?  // Story ID at that index for scroll restoration
    let userId: String            // Per-user cache — survives logout/login for the same user
}

@MainActor
class FeedViewModel: ObservableObject {
    @Published var stories: [Story] = []
    @Published var isLoading = false
    @Published var isLoadingMore = false
    @Published var hasMore = true
    @Published var error: String?

    /// The story ID to auto-scroll to on restore.
    @Published var restoreToStoryId: String?

    /// The anchor index — sits between the last story that scrolled off the top
    /// and the next one. Advances as the user scrolls down. Persisted across sessions.
    @Published var bookmarkIndex: Int = 0

    private var nextCursor: String?

    // MARK: - Cache & User Identity

    private static let cacheKey = "bb_feedCache"
    private static let userIdKey = "bb_currentUserId"

    /// Store the current user's ID so the cache can be validated per-user.
    static func setCurrentUserId(_ id: String) {
        UserDefaults.standard.set(id, forKey: userIdKey)
    }

    static func clearCurrentUserId() {
        UserDefaults.standard.removeObject(forKey: userIdKey)
    }

    static var currentUserId: String? {
        UserDefaults.standard.string(forKey: userIdKey)
    }

    // MARK: - Seen Tracking

    private var seenBuffer: Set<String> = []
    private var seenFlushed: Set<String> = []
    private var flushTimer: Timer?
    private let flushInterval: TimeInterval = 4.0
    private let minBatchSize = 5

    // MARK: - Lifecycle

    func startTracking() {
        stopTracking()
        flushTimer = Timer.scheduledTimer(withTimeInterval: flushInterval, repeats: true) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor in
                self.flushSeenBuffer()
            }
        }
        NotificationCenter.default.addObserver(
            forName: UIApplication.willResignActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor in
                self.flushSeenBuffer()
                self.persistCache()
            }
        }
    }

    func stopTracking() {
        flushTimer?.invalidate()
        flushTimer = nil
        flushSeenBuffer()
        persistCache()
    }

    /// The index of the story currently at the top of the visible scroll area.
    /// Used by the view to decide whether to show the "continue reading" button.
    @Published var currentTopIndex: Int = 0

    /// Called by the view's scrollPosition observer.
    /// Moves the bookmark up or down when scrolling within proximity (1-2 cards).
    /// If the user is far away from the line, it stays put.
    func updateScrollPosition(_ index: Int) {
        currentTopIndex = index

        let distance = index - bookmarkIndex
        // Move the bookmark when we're close to it (within 2 cards in either direction)
        if abs(distance) > 0 && abs(distance) <= 2 {
            bookmarkIndex = index
        }
    }

    /// Whether the "continue reading" button should be visible.
    var shouldShowContinueButton: Bool {
        bookmarkIndex > 0 && abs(currentTopIndex - bookmarkIndex) > 2
    }

    /// Whether the bookmark is below the current scroll position.
    var isBookmarkBelow: Bool {
        currentTopIndex < bookmarkIndex
    }

    /// The story ID at the bookmark position (for scrolling to it).
    var bookmarkStoryIdForScroll: String? {
        guard bookmarkIndex < stories.count else { return stories.last?.id }
        return stories[bookmarkIndex].id
    }

    /// Called when a story card appears on screen — used for seen tracking only.
    func storyAppeared(_ storyId: String) {
        guard !seenBuffer.contains(storyId), !seenFlushed.contains(storyId) else { return }
        seenBuffer.insert(storyId)
        if seenBuffer.count >= minBatchSize {
            flushSeenBuffer()
        }
    }

    private func flushSeenBuffer() {
        guard !seenBuffer.isEmpty else { return }
        let batch = Array(seenBuffer)
        seenFlushed.formUnion(seenBuffer)
        seenBuffer.removeAll()
        Task {
            try? await APIService.shared.markSeen(storyIds: batch)
        }
    }

    // MARK: - Cache Persistence

    private var todayString: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = .current
        return formatter.string(from: Date())
    }

    private func persistCache() {
        guard !stories.isEmpty, let userId = Self.currentUserId else { return }

        let bmStoryId: String? = bookmarkIndex < stories.count
            ? stories[bookmarkIndex].id
            : stories.last?.id

        let cache = FeedCache(
            stories: stories,
            nextCursor: nextCursor,
            hasMore: hasMore,
            date: todayString,
            bookmarkIndex: bookmarkIndex,
            bookmarkStoryId: bmStoryId,
            userId: userId
        )

        do {
            let data = try JSONEncoder().encode(cache)
            UserDefaults.standard.set(data, forKey: Self.cacheKey)
        } catch { }
    }

    private func restoreFromCache() -> Bool {
        guard let data = UserDefaults.standard.data(forKey: Self.cacheKey) else { return false }

        do {
            let cache = try JSONDecoder().decode(FeedCache.self, from: data)

            // Validate same user AND same day
            guard cache.date == todayString,
                  cache.userId == Self.currentUserId else {
                UserDefaults.standard.removeObject(forKey: Self.cacheKey)
                return false
            }

            stories = cache.stories
            nextCursor = cache.nextCursor
            hasMore = cache.hasMore
            bookmarkIndex = min(cache.bookmarkIndex, cache.stories.count)

            if let scrollTo = cache.bookmarkStoryId {
                restoreToStoryId = scrollTo
            }

            seenFlushed = Set(cache.stories.map(\.id))
            return true
        } catch {
            UserDefaults.standard.removeObject(forKey: Self.cacheKey)
            return false
        }
    }

    static func clearCache() {
        UserDefaults.standard.removeObject(forKey: cacheKey)
    }

    // MARK: - Feed Loading

    private var hasLoadedOnce = false

    func loadInitialFeedIfNeeded() async {
        guard !hasLoadedOnce else { return }
        hasLoadedOnce = true

        if restoreFromCache() { return }
        await loadFeed()
    }

    func refresh() async {
        stories = []
        nextCursor = nil
        hasMore = true
        bookmarkIndex = 0
        restoreToStoryId = nil
        seenBuffer.removeAll()
        seenFlushed.removeAll()
        UserDefaults.standard.removeObject(forKey: Self.cacheKey)
        await loadFeed()
    }

    func loadFeed() async {
        guard !isLoading, hasMore else { return }
        isLoading = stories.isEmpty
        isLoadingMore = !stories.isEmpty

        do {
            let response = try await APIService.shared.getFeed(
                cursor: nextCursor,
                limit: 10
            )
            stories.append(contentsOf: response.stories)
            nextCursor = response.nextCursor
            hasMore = response.hasMore
            error = nil
            persistCache()
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
        isLoadingMore = false
    }

    func loadMore() async {
        guard !isLoadingMore, hasMore else { return }
        await loadFeed()
    }

    // MARK: - Interactions

    func toggleLike(for storyId: String) async {
        guard let index = stories.firstIndex(where: { $0.id == storyId }) else { return }
        let wasLiked = stories[index].isLiked ?? false
        stories[index].isLiked = !wasLiked
        do { let _ = try await APIService.shared.toggleLike(storyId: storyId) }
        catch { stories[index].isLiked = wasLiked }
    }

    func toggleBookmark(for storyId: String) async {
        guard let index = stories.firstIndex(where: { $0.id == storyId }) else { return }
        let wasBookmarked = stories[index].isBookmarked ?? false
        stories[index].isBookmarked = !wasBookmarked
        do { let _ = try await APIService.shared.toggleBookmark(storyId: storyId) }
        catch { stories[index].isBookmarked = wasBookmarked }
    }

    func trackView(storyId: String, percentage: Double) {
        Task {
            try? await APIService.shared.trackView(storyId: storyId, readPercentage: percentage)
        }
    }
}
