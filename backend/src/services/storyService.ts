import { prisma } from '../config/db';
import { NotFoundError, ConflictError } from '../utils/errors';

export class StoryService {
  async getStoryById(storyId: string, userId?: string) {
    const story = await prisma.story.findUnique({
      where: { id: storyId },
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
    });

    if (!story) {
      throw new NotFoundError('Story not found');
    }

    let isLiked = false;
    let isBookmarked = false;

    if (userId) {
      const [like, bookmark] = await Promise.all([
        prisma.like.findUnique({
          where: { userId_storyId: { userId, storyId } },
        }),
        prisma.bookmark.findUnique({
          where: { userId_storyId: { userId, storyId } },
        }),
      ]);
      isLiked = !!like;
      isBookmarked = !!bookmark;
    }

    return { ...story, isLiked, isBookmarked };
  }

  async toggleLike(userId: string, storyId: string) {
    // Check story exists
    const story = await prisma.story.findUnique({ where: { id: storyId } });
    if (!story) throw new NotFoundError('Story not found');

    const existing = await prisma.like.findUnique({
      where: { userId_storyId: { userId, storyId } },
    });

    if (existing) {
      // Unlike
      await prisma.$transaction([
        prisma.like.delete({
          where: { id: existing.id },
        }),
        prisma.story.update({
          where: { id: storyId },
          data: { likeCount: { decrement: 1 } },
        }),
      ]);
      return { liked: false, likeCount: story.likeCount - 1 };
    } else {
      // Like
      await prisma.$transaction([
        prisma.like.create({
          data: { userId, storyId },
        }),
        prisma.story.update({
          where: { id: storyId },
          data: { likeCount: { increment: 1 } },
        }),
      ]);
      return { liked: true, likeCount: story.likeCount + 1 };
    }
  }

  async toggleBookmark(userId: string, storyId: string) {
    const story = await prisma.story.findUnique({ where: { id: storyId } });
    if (!story) throw new NotFoundError('Story not found');

    const existing = await prisma.bookmark.findUnique({
      where: { userId_storyId: { userId, storyId } },
    });

    if (existing) {
      await prisma.$transaction([
        prisma.bookmark.delete({
          where: { id: existing.id },
        }),
        prisma.story.update({
          where: { id: storyId },
          data: { bookmarkCount: { decrement: 1 } },
        }),
      ]);
      return { bookmarked: false, bookmarkCount: story.bookmarkCount - 1 };
    } else {
      await prisma.$transaction([
        prisma.bookmark.create({
          data: { userId, storyId },
        }),
        prisma.story.update({
          where: { id: storyId },
          data: { bookmarkCount: { increment: 1 } },
        }),
      ]);
      return { bookmarked: true, bookmarkCount: story.bookmarkCount + 1 };
    }
  }

  async trackView(userId: string, storyId: string, readPercentage: number) {
    const story = await prisma.story.findUnique({ where: { id: storyId } });
    if (!story) throw new NotFoundError('Story not found');

    // Upsert view: update if already viewed, create if not
    const existingView = await prisma.storyView.findFirst({
      where: { userId, storyId },
    });

    if (existingView) {
      await prisma.storyView.update({
        where: { id: existingView.id },
        data: {
          readPercentage: Math.max(existingView.readPercentage, readPercentage),
          viewedAt: new Date(),
        },
      });
    } else {
      await prisma.$transaction([
        prisma.storyView.create({
          data: { userId, storyId, readPercentage },
        }),
        prisma.story.update({
          where: { id: storyId },
          data: { viewCount: { increment: 1 } },
        }),
      ]);
    }

    return { tracked: true };
  }

  /**
   * Batch-mark stories as "seen" in the feed (readPercentage = 0).
   * This prevents them from showing up again in future feed loads.
   * Uses skipDuplicates to avoid conflicts for already-tracked stories.
   */
  async markSeen(userId: string, storyIds: string[]) {
    if (!storyIds.length) return { marked: 0 };

    // Filter out malformed UUIDs before hitting the DB
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validFormatIds = storyIds.filter((id) => UUID_RE.test(id));
    if (!validFormatIds.length) return { marked: 0 };

    // Filter to only valid story IDs that exist
    const existingStories = await prisma.story.findMany({
      where: { id: { in: validFormatIds } },
      select: { id: true },
    });
    const validIds = new Set(existingStories.map((s) => s.id));

    // Find which ones this user has already seen
    const alreadySeen = await prisma.storyView.findMany({
      where: { userId, storyId: { in: [...validIds] } },
      select: { storyId: true },
    });
    const alreadySeenSet = new Set(alreadySeen.map((v) => v.storyId));

    // Only create records for stories not yet seen
    const newStoryIds = [...validIds].filter((id) => !alreadySeenSet.has(id));

    if (newStoryIds.length === 0) return { marked: 0 };

    // Batch create view records with readPercentage 0 (scrolled past)
    const created = await prisma.storyView.createMany({
      data: newStoryIds.map((storyId) => ({
        userId,
        storyId,
        readPercentage: 0,
      })),
      skipDuplicates: true,
    });

    // Increment view counts
    await prisma.story.updateMany({
      where: { id: { in: newStoryIds } },
      data: { viewCount: { increment: 1 } },
    });

    return { marked: created.count };
  }
}

export const storyService = new StoryService();
