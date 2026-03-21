import { Router } from 'express';
import { feedController } from '../controllers/feedController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, (req, res, next) =>
  feedController.getFeed(req, res, next)
);

router.post('/seen', authenticate, (req, res, next) =>
  feedController.markSeen(req, res, next)
);

export default router;
