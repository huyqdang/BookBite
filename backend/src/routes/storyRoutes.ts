import { Router } from 'express';
import { storyController } from '../controllers/storyController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/:id', authenticate, (req, res, next) =>
  storyController.getStory(req, res, next)
);
router.post('/:id/like', authenticate, (req, res, next) =>
  storyController.toggleLike(req, res, next)
);
router.post('/:id/bookmark', authenticate, (req, res, next) =>
  storyController.toggleBookmark(req, res, next)
);
router.post('/:id/view', authenticate, (req, res, next) =>
  storyController.trackView(req, res, next)
);

export default router;
