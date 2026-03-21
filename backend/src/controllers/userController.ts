import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/userService';

export class UserController {
  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const profile = await userService.getProfile(userId);
      res.json(profile);
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { displayName, avatarUrl } = req.body;
      const profile = await userService.updateProfile(userId, {
        displayName,
        avatarUrl,
      });
      res.json(profile);
    } catch (error) {
      next(error);
    }
  }

  async getPreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const prefs = await userService.getPreferences(userId);
      res.json(prefs);
    } catch (error) {
      next(error);
    }
  }

  async updatePreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { bookCategories, preferredReadingTimes, timezone, fontFamily, fontSize, onboardingCompleted } =
        req.body;
      const prefs = await userService.updatePreferences(userId, {
        bookCategories,
        preferredReadingTimes,
        timezone,
        fontFamily,
        fontSize,
        onboardingCompleted,
      });
      res.json(prefs);
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
