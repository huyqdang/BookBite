import { prisma } from '../config/db';
import { dailyFeedBuilder } from './dailyFeedBuilder';

export interface FeedQuery {
  userId: string;
  cursor?: string;
  limit?: number;
  readingTime?: number;
  category?: string;
  timezone?: string; // IANA timezone identifier, e.g. "America/New_York"
}

const STORY_INCLUDE_BOOK = {
  book: {
    select: {
      id: true,
      title: true,
      author: true,
      coverUrl: true,
      purchaseLink: true,
    },
  },
} as const;

export class FeedService {
  /**
   * Serve the user's pre-built daily feed.
   *
   * Flow:
   *   1. Look up today's DailyFeed for this user (lazy-build if first request of the day)
   *   2. Paginate through the full ordered list using cursor
   *   3. Fetch full story data + enrich with like/bookmark status
   *
   * The feed always serves ALL stories in their ranked order. Stories are never
   * removed from the current day's feed. The iOS client silently marks stories
   * as "seen" in the background via POST /feed/seen — this data is only used
   * when building TOMORROW's feed (to exclude already-read stories).
   */
  async getPersonalizedFeed(query: FeedQuery) {
    const { userId, cursor, limit = 10, readingTime, category, timezone } = query;
    const today = this.getTodayForTimezone(timezone);

    // Persist timezone to user preferences if provided (fire-and-forget)
    if (timezone) {
      prisma.userPreference.updateMany({
        where: { userId },
        data: { timezone },
      }).catch(() => {}); // non-blocking
    }

    // 1. Get (or lazily build) today's daily feed
    let dailyFeed = await prisma.dailyFeed.findUnique({
      where: { userId_date: { userId, date: today } },
    });

    if (!dailyFeed) {
      // Lazy build: first request of the day triggers feed generation
      const count = await dailyFeedBuilder.buildForUser(userId, today);
      if (count > 0) {
        dailyFeed = await prisma.dailyFeed.findUnique({
          where: { userId_date: { userId, date: today } },
        });
      }
    }

    // If no feed could be built (no stories in DB, or onboarding incomplete)
    if (!dailyFeed || dailyFeed.storyIds.length === 0) {
      return { stories: [], nextCursor: null, hasMore: false };
    }

    // 2. The full ordered story list for today
    let feedIds = dailyFeed.storyIds;

    // Optional client-driven filters (readingTime / category) on top of the pre-built feed
    if (readingTime || category) {
      const meta = await prisma.story.findMany({
        where: { id: { in: feedIds } },
        select: { id: true, readingTimeMinutes: true, categories: true },
      });
      const metaMap = new Map(meta.map((m) => [m.id, m]));

      feedIds = feedIds.filter((id) => {
        const m = metaMap.get(id);
        if (!m) return false;
        if (readingTime && m.readingTimeMinutes !== readingTime) return false;
        if (category && !m.categories.includes(category)) return false;
        return true;
      });
    }

    // 3. Cursor-based pagination within the ordered list
    let startIdx = 0;
    if (cursor) {
      const cursorIdx = feedIds.indexOf(cursor);
      if (cursorIdx >= 0) {
        startIdx = cursorIdx + 1;
      }
    }

    const batch = feedIds.slice(startIdx, startIdx + limit + 1);
    const hasMore = batch.length > limit;
    const resultIds = hasMore ? batch.slice(0, limit) : batch;
    const nextCursor = hasMore ? resultIds[resultIds.length - 1] : null;

    if (resultIds.length === 0) {
      return { stories: [], nextCursor: null, hasMore: false };
    }

    // 4. Fetch full story data for this page
    const stories = await prisma.story.findMany({
      where: { id: { in: resultIds } },
      include: STORY_INCLUDE_BOOK,
    });

    // Maintain the ranked order from the daily feed
    const storyMap = new Map(stories.map((s) => [s.id, s]));
    const ordered = resultIds
      .map((id) => storyMap.get(id))
      .filter((s): s is NonNullable<typeof s> => s != null);

    // 5. Enrich with user interaction data
    const storyIds = ordered.map((s) => s.id);
    const [likes, bookmarks] = await Promise.all([
      prisma.like.findMany({
        where: { userId, storyId: { in: storyIds } },
        select: { storyId: true },
      }),
      prisma.bookmark.findMany({
        where: { userId, storyId: { in: storyIds } },
        select: { storyId: true },
      }),
    ]);

    const likedSet = new Set(likes.map((l) => l.storyId));
    const bookmarkedSet = new Set(bookmarks.map((b) => b.storyId));

    const enriched = ordered.map((story) => ({
      ...story,
      isLiked: likedSet.has(story.id),
      isBookmarked: bookmarkedSet.has(story.id),
    }));

    return {
      stories: enriched,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Get "today" as a Date at midnight UTC, based on the user's timezone.
   * If timezone is "America/New_York" and it's 11pm Feb 8 there (but Feb 9 UTC),
   * this returns Feb 8 midnight UTC — so the feed date matches the user's local day.
   */
  private getTodayForTimezone(timezone?: string): Date {
    const now = new Date();
    if (timezone) {
      try {
        // Format current UTC time in the user's timezone to get their local date parts
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(now); // returns "YYYY-MM-DD"
        const [year, month, day] = parts.split('-').map(Number);
        return new Date(Date.UTC(year, month - 1, day));
      } catch {
        // Invalid timezone — fall through to UTC
      }
    }
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  async getBookmarkedStories(userId: string, cursor?: string, limit = 10) {
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: limit + 1,
      orderBy: { createdAt: 'desc' },
      include: {
        story: {
          include: {
            book: {
              select: {
                id: true,
                title: true,
                author: true,
                coverUrl: true,
                purchaseLink: true,
              },
            },
          },
        },
      },
    });

    const hasMore = bookmarks.length > limit;
    const results = hasMore ? bookmarks.slice(0, limit) : bookmarks;
    const nextCursor = hasMore ? results[results.length - 1].id : null;

    // Get liked status for bookmarked stories
    const storyIds = results.map((b) => b.story.id);
    const likes = await prisma.like.findMany({
      where: { userId, storyId: { in: storyIds } },
      select: { storyId: true },
    });
    const likedSet = new Set(likes.map((l) => l.storyId));

    const stories = results.map((b) => ({
      ...b.story,
      isLiked: likedSet.has(b.story.id),
      isBookmarked: true,
      bookmarkedAt: b.createdAt,
    }));

    return { stories, nextCursor, hasMore };
  }
}

export const feedService = new FeedService();
