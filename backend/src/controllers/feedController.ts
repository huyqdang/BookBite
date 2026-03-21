import { Request, Response, NextFunction } from 'express';
import { feedService } from '../services/feedService';
import { storyService } from '../services/storyService';
import { BadRequestError } from '../utils/errors';

export class FeedController {
  async getFeed(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { cursor, limit, readingTime, category, timezone } = req.query;

      const result = await feedService.getPersonalizedFeed({
        userId,
        cursor: cursor as string | undefined,
        limit: limit ? parseInt(limit as string, 10) : 10,
        readingTime: readingTime ? parseInt(readingTime as string, 10) : undefined,
        category: category as string | undefined,
        timezone: timezone as string | undefined,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async markSeen(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { storyIds } = req.body;

      if (!Array.isArray(storyIds) || storyIds.length === 0) {
        throw new BadRequestError('storyIds must be a non-empty array');
      }
      if (storyIds.length > 50) {
        throw new BadRequestError('Cannot mark more than 50 stories at once');
      }

      const result = await storyService.markSeen(userId, storyIds);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getBookmarks(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { cursor, limit } = req.query;

      const result = await feedService.getBookmarkedStories(
        userId,
        cursor as string | undefined,
        limit ? parseInt(limit as string, 10) : 10
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const feedController = new FeedController();
