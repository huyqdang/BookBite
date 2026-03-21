import { Request, Response, NextFunction } from 'express';
import { storyService } from '../services/storyService';
import { BadRequestError } from '../utils/errors';

export class StoryController {
  async getStory(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const userId = req.user?.userId;
      const story = await storyService.getStoryById(id, userId);
      res.json(story);
    } catch (error) {
      next(error);
    }
  }

  async toggleLike(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const userId = req.user!.userId;
      const result = await storyService.toggleLike(userId, id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async toggleBookmark(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const userId = req.user!.userId;
      const result = await storyService.toggleBookmark(userId, id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async trackView(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const userId = req.user!.userId;
      const { readPercentage = 0 } = req.body;

      if (typeof readPercentage !== 'number' || readPercentage < 0 || readPercentage > 100) {
        throw new BadRequestError('readPercentage must be a number between 0 and 100');
      }

      const result = await storyService.trackView(userId, id, readPercentage);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const storyController = new StoryController();
