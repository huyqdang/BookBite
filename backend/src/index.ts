import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { connectDB } from './config/db';
import { errorHandler } from './middleware/errorHandler';
import { generalLimiter, authLimiter } from './middleware/rateLimiter';

// Route imports
import authRoutes from './routes/authRoutes';
import storyRoutes from './routes/storyRoutes';
import feedRoutes from './routes/feedRoutes';
import userRoutes from './routes/userRoutes';
import adminRoutes from './routes/adminRoutes';

const app = express();

// ─── Middleware ──────────────────────────────────────────────────────────────

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Rate limiting
app.use('/api/', generalLimiter);
app.use('/api/auth', authLimiter);

// ─── Routes ─────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api', userRoutes);
app.use('/api/admin', adminRoutes);

// ─── Error Handler ──────────────────────────────────────────────────────────

app.use(errorHandler);

// ─── Start Server ───────────────────────────────────────────────────────────

async function start() {
  await connectDB();

  app.listen(env.PORT, () => {
    console.log(`\n[BookBite] Server running on http://localhost:${env.PORT}`);
    console.log(`[BookBite] Environment: ${env.NODE_ENV}\n`);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

export default app;
