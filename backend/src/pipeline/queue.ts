import { Queue, Worker, Job } from 'bullmq';
import { createRedisConnection } from '../config/redis';

// ─── Queue Names ────────────────────────────────────────────────────────────

const BOOK_QUEUE_NAME = 'book-processing';
const AI_KNOWLEDGE_QUEUE_NAME = 'ai-knowledge-processing';

// ─── Book Processing Queue (file-based pipeline) ───────────────────────────

export const bookQueue = new Queue(BOOK_QUEUE_NAME, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

export type BookJobData = {
  bookId: string;
  filePath: string;
  fileName: string;
  fileType: 'pdf' | 'txt';
};

export type BookJobResult = {
  storiesExtracted: number;
  categories: string[];
};

// ─── AI Knowledge Queue (AI-only books without text files) ──────────────────

export const aiKnowledgeQueue = new Queue(AI_KNOWLEDGE_QUEUE_NAME, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

export type AiKnowledgeJobData = {
  bookId: string;
  title: string;
  author: string;
  categories: string[];
};

export type AiKnowledgeJobResult = {
  storiesGenerated: number;
  categories: string[];
};

// ─── Worker Factories ───────────────────────────────────────────────────────

export function createBookWorker(
  processor: (job: Job<BookJobData>) => Promise<BookJobResult>
) {
  const worker = new Worker<BookJobData, BookJobResult>(
    BOOK_QUEUE_NAME,
    processor,
    {
      connection: createRedisConnection(),
      concurrency: 1, // Process ONE book at a time
      limiter: {
        max: 1,
        duration: 2000, // Max 1 job per 2 seconds
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(
      `[Worker] Completed: ${job.data.fileName} — ${job.returnvalue?.storiesExtracted} stories extracted`
    );
  });

  worker.on('failed', (job, err) => {
    console.error(
      `[Worker] Failed: ${job?.data.fileName} — ${err.message}`
    );
  });

  worker.on('error', (err) => {
    console.error('[Worker] Error:', err.message);
  });

  return worker;
}

export function createAiKnowledgeWorker(
  processor: (job: Job<AiKnowledgeJobData>) => Promise<AiKnowledgeJobResult>
) {
  const worker = new Worker<AiKnowledgeJobData, AiKnowledgeJobResult>(
    AI_KNOWLEDGE_QUEUE_NAME,
    processor,
    {
      connection: createRedisConnection(),
      concurrency: 1, // Process ONE book at a time (AI rate limits)
      limiter: {
        max: 1,
        duration: 5000, // Max 1 job per 5 seconds
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(
      `[AI-Knowledge Worker] Completed: "${job.data.title}" — ${job.returnvalue?.storiesGenerated} stories generated`
    );
  });

  worker.on('failed', (job, err) => {
    console.error(
      `[AI-Knowledge Worker] Failed: "${job?.data.title}" — ${err.message}`
    );
  });

  worker.on('error', (err) => {
    console.error('[AI-Knowledge Worker] Error:', err.message);
  });

  return worker;
}
