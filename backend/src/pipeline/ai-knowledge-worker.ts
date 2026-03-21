import { PrismaClient } from '@prisma/client';
import { Job } from 'bullmq';
import {
  discoverStoriesFromKnowledge,
  generateStoryFromKnowledge,
} from './ai-knowledge-processor';
import {
  createAiKnowledgeWorker,
  type AiKnowledgeJobData,
  type AiKnowledgeJobResult,
} from './queue';
import { BudgetExhaustedError } from '../utils/token-tracker';

const prisma = new PrismaClient();

// ─── Process a single AI-knowledge book ─────────────────────────────────────

async function processAiKnowledgeBook(
  job: Job<AiKnowledgeJobData>
): Promise<AiKnowledgeJobResult> {
  const { bookId, title, author, categories } = job.data;

  console.log(`\n[AI-Knowledge] Processing: "${title}" by ${author}`);
  console.log(`  Categories: ${categories.join(', ')}`);

  // Mark book as processing
  await prisma.book.update({
    where: { id: bookId },
    data: { status: 'PROCESSING' },
  });

  try {
    // ── Multi-pass discovery (aims for 50+ unique stories) ──────────────
    console.log(`  Discovering stories (multi-pass, targeting 50+)...`);
    const candidates = await discoverStoriesFromKnowledge(title, author, categories);
    console.log(`  Found ${candidates.length} story candidates`);

    if (candidates.length === 0) {
      console.log(`  WARNING: No stories found for "${title}"`);
      await prisma.book.update({
        where: { id: bookId },
        data: { status: 'COMPLETED', storyCount: 0 },
      });
      return { storiesGenerated: 0, categories };
    }

    let storiesGenerated = 0;

    // ── Generate each story at its optimal reading time ──────────────────
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      console.log(`  [${i + 1}/${candidates.length}] Generating "${candidate.title}" (${candidate.optimalReadingTime || 3} min)...`);

      try {
        const story = await generateStoryFromKnowledge(title, author, candidate, categories);

        if (!story || !story.content || story.content.length < 50) {
          console.log(`    Skipped (insufficient content)`);
          continue;
        }

        // Save unique story at its optimal reading time
        await prisma.story.create({
          data: {
            bookId,
            title: story.title,
            content: story.content,
            summary: story.content.substring(0, 200) + '...',
            readingTimeMinutes: story.readingTimeMinutes,
            categories: story.categories,
            tone: story.tone,
            styleSeed: story.styleSeed,
          },
        });

        storiesGenerated++;
        console.log(`    Saved "${story.title}" (${story.readingTimeMinutes} min, ${story.wordCount} words)`);

        // Update progress
        await job.updateProgress(Math.round(((i + 1) / candidates.length) * 100));

        // Small delay between AI calls to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } catch (err: any) {
        // Budget exhausted — save what we have and stop
        if (err instanceof BudgetExhaustedError || err.name === 'BudgetExhaustedError') {
          console.log(`\n  BUDGET EXHAUSTED during "${title}"`);
          console.log(`  Saved ${storiesGenerated} stories before stopping.`);

          // Mark book as completed with however many we got
          await prisma.book.update({
            where: { id: bookId },
            data: {
              status: storiesGenerated > 0 ? 'COMPLETED' : 'QUEUED', // Re-queue if we got nothing
              storyCount: storiesGenerated,
              categories,
            },
          });

          // Re-throw to stop the entire pipeline
          throw err;
        }

        // API rate limit — also stop
        if (err.message?.includes('API limit reached')) {
          console.log(`\n  API LIMIT REACHED during "${title}"`);
          await prisma.book.update({
            where: { id: bookId },
            data: {
              status: storiesGenerated > 0 ? 'COMPLETED' : 'QUEUED',
              storyCount: storiesGenerated,
              categories,
            },
          });
          throw err;
        }

        // Regular error — skip this story, continue with next
        console.warn(`    Failed: ${err.message}`);
      }
    }

    // Mark book as completed
    await prisma.book.update({
      where: { id: bookId },
      data: {
        status: 'COMPLETED',
        storyCount: storiesGenerated,
        categories,
      },
    });

    console.log(`  Done "${title}": ${storiesGenerated} stories generated\n`);
    return { storiesGenerated, categories };
  } catch (err: any) {
    // Budget/rate limit errors: re-throw for pipeline to handle
    if (
      err instanceof BudgetExhaustedError ||
      err.name === 'BudgetExhaustedError' ||
      err.message?.includes('API limit reached')
    ) {
      throw err;
    }

    console.error(`  Failed "${title}": ${err.message}`);
    await prisma.book.update({
      where: { id: bookId },
      data: { status: 'FAILED' },
    });
    throw err;
  }
}

// ─── Start Worker ───────────────────────────────────────────────────────────

export function startAiKnowledgeWorker() {
  console.log('[AI-Knowledge Worker] Starting...');
  const worker = createAiKnowledgeWorker(processAiKnowledgeBook);
  console.log('[AI-Knowledge Worker] Ready and waiting for jobs.\n');
  return worker;
}

// Entry point (when run directly)
if (require.main === module) {
  startAiKnowledgeWorker();
}
