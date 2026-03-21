import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { prisma } from '../config/db';

const router = Router();

// All admin routes require auth + admin role
router.use(authenticate);
router.use(requireAdmin);

// List all books with processing status
router.get('/books', async (_req, res, next) => {
  try {
    const books = await prisma.book.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { stories: true },
        },
      },
    });
    res.json(books);
  } catch (error) {
    next(error);
  }
});

// Get queue status (will be enhanced when BullMQ is set up)
router.get('/queue/status', async (_req, res, next) => {
  try {
    const [queued, processing, completed, failed] = await Promise.all([
      prisma.book.count({ where: { status: 'QUEUED' } }),
      prisma.book.count({ where: { status: 'PROCESSING' } }),
      prisma.book.count({ where: { status: 'COMPLETED' } }),
      prisma.book.count({ where: { status: 'FAILED' } }),
    ]);

    res.json({ queued, processing, completed, failed });
  } catch (error) {
    next(error);
  }
});

export default router;
