import { Router } from 'express';
import { userController } from '../controllers/userController';
import { feedController } from '../controllers/feedController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Profile
router.get('/profile', authenticate, (req, res, next) =>
  userController.getProfile(req, res, next)
);
router.put('/profile', authenticate, (req, res, next) =>
  userController.updateProfile(req, res, next)
);

// Preferences
router.get('/preferences', authenticate, (req, res, next) =>
  userController.getPreferences(req, res, next)
);
router.put('/preferences', authenticate, (req, res, next) =>
  userController.updatePreferences(req, res, next)
);

// Bookmarks
router.get('/bookmarks', authenticate, (req, res, next) =>
  feedController.getBookmarks(req, res, next)
);

export default router;
