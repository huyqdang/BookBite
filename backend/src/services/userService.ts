import { prisma } from '../config/db';
import { NotFoundError, BadRequestError } from '../utils/errors';

export class UserService {
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { preferences: true },
    });

    if (!user) throw new NotFoundError('User not found');

    // Get stats
    const [likeCount, bookmarkCount, storiesRead] = await Promise.all([
      prisma.like.count({ where: { userId } }),
      prisma.bookmark.count({ where: { userId } }),
      prisma.storyView.count({ where: { userId } }),
    ]);

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      preferences: user.preferences
        ? {
            bookCategories: user.preferences.bookCategories,
            preferredReadingTimes: user.preferences.preferredReadingTimes,
            timezone: user.preferences.timezone,
            fontFamily: user.preferences.fontFamily,
            fontSize: user.preferences.fontSize,
            onboardingCompleted: user.preferences.onboardingCompleted,
          }
        : null,
      stats: {
        likes: likeCount,
        bookmarks: bookmarkCount,
        storiesRead,
      },
      createdAt: user.createdAt,
    };
  }

  async updateProfile(
    userId: string,
    data: { displayName?: string; avatarUrl?: string }
  ) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.displayName && { displayName: data.displayName }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
      },
    });

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    };
  }

  async getPreferences(userId: string) {
    let prefs = await prisma.userPreference.findUnique({
      where: { userId },
    });

    if (!prefs) {
      prefs = await prisma.userPreference.create({
        data: {
          userId,
          bookCategories: [],
          preferredReadingTimes: [3],
        },
      });
    }

    return {
      bookCategories: prefs.bookCategories,
      preferredReadingTimes: prefs.preferredReadingTimes,
      timezone: prefs.timezone,
      fontFamily: prefs.fontFamily,
      fontSize: prefs.fontSize,
      onboardingCompleted: prefs.onboardingCompleted,
    };
  }

  async updatePreferences(
    userId: string,
    data: {
      bookCategories?: string[];
      preferredReadingTimes?: number[];
      timezone?: string;
      fontFamily?: string;
      fontSize?: number;
      onboardingCompleted?: boolean;
    }
  ) {
    const validReadingTimes = [1, 3, 5, 10];
    if (data.preferredReadingTimes) {
      for (const t of data.preferredReadingTimes) {
        if (!validReadingTimes.includes(t)) {
          throw new BadRequestError(
            'Reading times must be 1, 3, 5, or 10 minutes'
          );
        }
      }
    }

    if (data.fontSize !== undefined) {
      if (data.fontSize < 14 || data.fontSize > 28) {
        throw new BadRequestError('Font size must be between 14 and 28');
      }
    }

    const prefs = await prisma.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        bookCategories: data.bookCategories || [],
        preferredReadingTimes: data.preferredReadingTimes || [3],
        timezone: data.timezone || 'UTC',
        fontFamily: data.fontFamily || 'system',
        fontSize: data.fontSize ?? 18,
        onboardingCompleted: data.onboardingCompleted ?? false,
      },
      update: {
        ...(data.bookCategories && { bookCategories: data.bookCategories }),
        ...(data.preferredReadingTimes && {
          preferredReadingTimes: data.preferredReadingTimes,
        }),
        ...(data.timezone && { timezone: data.timezone }),
        ...(data.fontFamily !== undefined && { fontFamily: data.fontFamily }),
        ...(data.fontSize !== undefined && { fontSize: data.fontSize }),
        ...(data.onboardingCompleted !== undefined && {
          onboardingCompleted: data.onboardingCompleted,
        }),
      },
    });

    return {
      bookCategories: prefs.bookCategories,
      preferredReadingTimes: prefs.preferredReadingTimes,
      timezone: prefs.timezone,
      fontFamily: prefs.fontFamily,
      fontSize: prefs.fontSize,
      onboardingCompleted: prefs.onboardingCompleted,
    };
  }
}

export const userService = new UserService();
