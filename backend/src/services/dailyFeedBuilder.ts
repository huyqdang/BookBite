import { prisma } from '../config/db';
import { Prisma } from '@prisma/client';

/**
 * Daily Feed Builder
 *
 * Pre-builds a personalized, ranked feed for each user containing enough
 * stories to keep them reading for 24 hours straight.
 *
 * Ranking priority:
 *   1. Highest-liked stories from preferred categories (curated books first)
 *   2. Stories from curated top-200 books (tier 1)
 *   3. AI-knowledge stories (tier 3)
 *   4. Bulk/general stories (tier 2)
 *
 * Composite score:
 *   score = tierBonus + (likeCount * 3) + (bookmarkCount * 2)
 *   where tierBonus: tier 1 = 100, tier 3 = 50, tier 2 = 0
 */

const TARGET_MINUTES = 24 * 60; // 1440 minutes = 24 hours
const MAX_STORIES = 1500; // Safety cap per daily feed

interface RankedStory {
  id: string;
  reading_time_minutes: number;
  score: number;
}

export class DailyFeedBuilder {
  /** The date being built — used by queryRankedStories to scope the seen filter. */
  private _buildDate: Date = new Date();
  /**
   * Build (or rebuild) a daily feed for a single user.
   * @param userId - The user to build for
   * @param date - The date to build for (defaults to today in user's timezone or UTC)
   * Returns the number of stories placed into the feed.
   */
  async buildForUser(userId: string, date?: Date): Promise<number> {
    const today = date || this.getToday();
    // Pass today's date so we only exclude stories seen BEFORE today
    this._buildDate = today;

    // 1. Get user preferences
    const preferences = await prisma.userPreference.findUnique({
      where: { userId },
    });

    if (!preferences || !preferences.onboardingCompleted) {
      console.log(`  [skip] User ${userId} — onboarding not completed`);
      return 0;
    }

    const preferredCategories = preferences.bookCategories;
    const preferredReadingTimes = preferences.preferredReadingTimes;

    if (!preferredCategories.length || !preferredReadingTimes.length) {
      console.log(`  [skip] User ${userId} — no categories or reading times`);
      return 0;
    }

    // 2. Query ranked stories via raw SQL (composite score, exclude seen)
    let stories = await this.queryRankedStories(
      userId,
      preferredCategories,
      preferredReadingTimes,
    );

    // 3. Fill until we hit 24h of content
    let totalMinutes = 0;
    const feedStoryIds: string[] = [];

    for (const story of stories) {
      if (totalMinutes >= TARGET_MINUTES) break;
      if (feedStoryIds.length >= MAX_STORIES) break;
      feedStoryIds.push(story.id);
      totalMinutes += story.reading_time_minutes;
    }

    // 4. If we haven't hit 24h, relax category filter (any category, same reading times)
    if (totalMinutes < TARGET_MINUTES) {
      const relaxed = await this.queryRankedStories(
        userId,
        [], // any category
        preferredReadingTimes,
        new Set(feedStoryIds), // exclude already-added
      );

      for (const story of relaxed) {
        if (totalMinutes >= TARGET_MINUTES) break;
        if (feedStoryIds.length >= MAX_STORIES) break;
        feedStoryIds.push(story.id);
        totalMinutes += story.reading_time_minutes;
      }
    }

    // 5. If STILL not enough, relax everything (any category, any reading time)
    if (totalMinutes < TARGET_MINUTES) {
      const allStories = await this.queryRankedStories(
        userId,
        [],
        [],
        new Set(feedStoryIds),
      );

      for (const story of allStories) {
        if (totalMinutes >= TARGET_MINUTES) break;
        if (feedStoryIds.length >= MAX_STORIES) break;
        feedStoryIds.push(story.id);
        totalMinutes += story.reading_time_minutes;
      }
    }

    if (feedStoryIds.length === 0) {
      console.log(`  [skip] User ${userId} — no unseen stories available`);
      return 0;
    }

    // 6. Upsert into DailyFeed
    await prisma.dailyFeed.upsert({
      where: {
        userId_date: { userId, date: today },
      },
      create: {
        userId,
        date: today,
        storyIds: feedStoryIds,
        totalMinutes,
        storyCount: feedStoryIds.length,
      },
      update: {
        storyIds: feedStoryIds,
        totalMinutes,
        storyCount: feedStoryIds.length,
      },
    });

    return feedStoryIds.length;
  }

  /**
   * Build feeds for ALL users who have completed onboarding.
   */
  async buildForAllUsers(): Promise<{ total: number; built: number; skipped: number }> {
    const users = await prisma.user.findMany({
      where: {
        preferences: {
          onboardingCompleted: true,
        },
      },
      select: { id: true, email: true },
    });

    let built = 0;
    let skipped = 0;

    for (const user of users) {
      const count = await this.buildForUser(user.id);
      if (count > 0) {
        console.log(`  [built] ${user.email} — ${count} stories`);
        built++;
      } else {
        skipped++;
      }
    }

    return { total: users.length, built, skipped };
  }

  /**
   * Core ranking query using raw SQL.
   *
   * Computes a composite score per story:
   *   score = tierBonus + (like_count * 3) + (bookmark_count * 2)
   *
   * Excludes stories the user has already seen (via story_views table)
   * and optionally excludes a set of already-picked IDs.
   */
  private async queryRankedStories(
    userId: string,
    categories: string[],
    readingTimes: number[],
    excludeIds?: Set<string>,
  ): Promise<RankedStory[]> {
    // Build WHERE clauses dynamically
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    // Exclude stories the user has seen on PREVIOUS days (not today).
    // Stories seen today are fine — they're part of today's feed.
    // This ensures rebuilding or re-seeding doesn't shrink the feed.
    conditions.push(`s.id NOT IN (SELECT sv.story_id FROM story_views sv WHERE sv.user_id = $${paramIdx}::uuid AND sv.viewed_at < $${paramIdx + 1}::timestamp)`);
    params.push(userId);
    params.push(this._buildDate); // midnight of today — excludes views from before today only
    paramIdx += 2;

    // Category filter (array overlap)
    if (categories.length > 0) {
      conditions.push(`s.categories && $${paramIdx}::text[]`);
      params.push(categories);
      paramIdx++;
    }

    // Reading time filter
    if (readingTimes.length > 0) {
      conditions.push(`s.reading_time_minutes = ANY($${paramIdx}::int[])`);
      params.push(readingTimes);
      paramIdx++;
    }

    // Exclude already-selected story IDs (for fallback passes)
    if (excludeIds && excludeIds.size > 0) {
      conditions.push(`s.id != ALL($${paramIdx}::uuid[])`);
      params.push([...excludeIds]);
      paramIdx++;
    }

    const whereClause = conditions.length > 0
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    const query = `
      SELECT
        s.id,
        s.reading_time_minutes,
        (
          CASE
            WHEN b.tier = 1 THEN 100
            WHEN b.tier = 3 THEN 50
            ELSE 0
          END
          + (s.like_count * 3)
          + (s.bookmark_count * 2)
        ) AS score
      FROM stories s
      JOIN books b ON s.book_id = b.id
      ${whereClause}
      ORDER BY score DESC, s.created_at DESC
      LIMIT ${MAX_STORIES}
    `;

    const results = await prisma.$queryRawUnsafe<RankedStory[]>(query, ...params);
    return results;
  }

  /**
   * Get today's date at midnight UTC (date-only, no time component).
   */
  private getToday(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }
}

export const dailyFeedBuilder = new DailyFeedBuilder();
