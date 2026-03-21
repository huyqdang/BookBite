import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';

import { createBookWorker, BookJobData, BookJobResult } from './queue';
import { extractText } from './extractor';
import { chunkText, extractTableOfContents } from './chunker';
import {
  analyzeBook,
  discoverStories,
  extractStory,
  crossReferenceSweep,
  StoryCandidate,
} from './ai-processor';
import { normalizeCategories } from './categorizer';

const prisma = new PrismaClient();

/**
 * Main 5-pass processing pipeline for a single book.
 */
async function processBook(job: Job<BookJobData>): Promise<BookJobResult> {
  const { bookId, filePath, fileName, fileType } = job.data;
  let totalStories = 0;
  let bookCategories: string[] = [];

  try {
    // Update book status to PROCESSING
    await prisma.book.update({
      where: { id: bookId },
      data: { status: 'PROCESSING' },
    });

    // ─── Step 1: Extract Text ──────────────────────────────────────
    console.log(`[Pipeline] Step 1: Extracting text from ${fileName}`);
    await job.updateProgress(5);

    const extracted = await extractText(filePath, fileType);
    console.log(
      `[Pipeline] Extracted ${extracted.text.length} chars, ${extracted.pageCount} pages`
    );

    // Update book metadata if available
    if (extracted.metadata.author && extracted.metadata.author !== 'Unknown') {
      await prisma.book.update({
        where: { id: bookId },
        data: { author: extracted.metadata.author },
      });
    }

    // ─── Step 2: Smart Chunking ────────────────────────────────────
    console.log(`[Pipeline] Step 2: Chunking text`);
    await job.updateProgress(10);

    const chunks = chunkText(extracted.text);
    const toc = extractTableOfContents(extracted.text);
    console.log(`[Pipeline] Created ${chunks.length} chunks, found ${toc.length} chapters`);

    // ─── Pass 1: Book Analysis ─────────────────────────────────────
    console.log(`[Pipeline] Pass 1: Analyzing book`);
    await job.updateProgress(15);

    const analysis = await analyzeBook(extracted.text, fileName);
    bookCategories = normalizeCategories(analysis.categories);
    console.log(
      `[Pipeline] Book type: ${analysis.bookType}, Categories: ${bookCategories.join(', ')}, Density: ${analysis.storyDensity}`
    );

    await prisma.book.update({
      where: { id: bookId },
      data: { categories: bookCategories },
    });

    // ─── Pass 2-4: Process Each Chunk ──────────────────────────────
    const allExtractedTitles: string[] = [];
    const progressPerChunk = 65 / Math.max(chunks.length, 1);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const baseProgress = 20 + i * progressPerChunk;
      await job.updateProgress(Math.round(baseProgress));

      console.log(
        `[Pipeline] Processing chunk ${i + 1}/${chunks.length}${
          chunk.chapterTitle ? ` (${chunk.chapterTitle})` : ''
        }`
      );

      // Pass 2: Discover stories in this chunk
      const candidates = await discoverStories(chunk.text, analysis, i);
      console.log(`[Pipeline]   Found ${candidates.length} story candidates`);

      if (candidates.length === 0) continue;

      // Pass 3: Extract each candidate as a unique story at its optimal reading time
      for (const candidate of candidates) {
        try {
          const book = await prisma.book.findUnique({ where: { id: bookId } });
          const story = await extractStory(
            chunk.text,
            candidate,
            analysis,
            book?.title || fileName,
            book?.author || 'Unknown'
          );

          if (!story || !story.content || story.content.length < 50) {
            console.log(`[Pipeline]   Skipping "${candidate.title}" — extraction too short`);
            continue;
          }

          // Save one unique story at its optimal reading time
          await prisma.story.create({
            data: {
              bookId,
              title: story.title,
              content: story.content,
              readingTimeMinutes: story.readingTimeMinutes,
              categories: normalizeCategories(story.categories),
              tone: story.tone,
              styleSeed: story.styleSeed,
            },
          });
          totalStories++;

          allExtractedTitles.push(story.title);
          console.log(
            `[Pipeline]   Extracted "${story.title}" (${story.readingTimeMinutes} min, ${story.wordCount} words)`
          );
        } catch (err: any) {
          console.warn(
            `[Pipeline]   Failed to extract "${candidate.title}": ${err.message}`
          );
        }
      }
    }

    // ─── Pass 5: Cross-Reference Sweep ─────────────────────────────
    console.log(`[Pipeline] Pass 5: Cross-reference sweep`);
    await job.updateProgress(90);

    try {
      // Take a sample from different parts of the book for the sweep
      const midPoint = Math.floor(extracted.text.length / 2);
      const sweepSample =
        extracted.text.slice(0, 3000) +
        '\n...\n' +
        extracted.text.slice(midPoint, midPoint + 3000);

      const missed = await crossReferenceSweep(
        toc,
        allExtractedTitles,
        analysis,
        fileName,
        sweepSample
      );

      console.log(`[Pipeline] Sweep found ${missed.length} potentially missed stories`);

      // Process missed stories (use full text chunks to find relevant content)
      for (const candidate of missed) {
        try {
          // Find the most relevant chunk for this candidate
          const relevantChunk = findRelevantChunk(chunks, candidate);
          if (!relevantChunk) continue;

          const book = await prisma.book.findUnique({ where: { id: bookId } });
          const story = await extractStory(
            relevantChunk,
            candidate,
            analysis,
            book?.title || fileName,
            book?.author || 'Unknown'
          );

          if (!story || !story.content || story.content.length < 50) continue;

          await prisma.story.create({
            data: {
              bookId,
              title: story.title,
              content: story.content,
              readingTimeMinutes: story.readingTimeMinutes,
              categories: normalizeCategories(story.categories),
              tone: story.tone,
              styleSeed: story.styleSeed,
            },
          });
          totalStories++;

          console.log(
            `[Pipeline]   Swept "${story.title}" (${story.readingTimeMinutes} min, ${story.wordCount} words)`
          );
        } catch (err: any) {
          console.warn(
            `[Pipeline]   Failed sweep for "${candidate.title}": ${err.message}`
          );
        }
      }
    } catch (err: any) {
      console.warn(`[Pipeline] Cross-reference sweep failed: ${err.message}`);
    }

    // ─── Finalize ──────────────────────────────────────────────────
    await prisma.book.update({
      where: { id: bookId },
      data: {
        status: 'COMPLETED',
        storyCount: totalStories,
        categories: bookCategories,
      },
    });

    await job.updateProgress(100);
    console.log(
      `[Pipeline] DONE: ${fileName} → ${totalStories} total stories extracted`
    );

    return { storiesExtracted: totalStories, categories: bookCategories };
  } catch (error: any) {
    console.error(`[Pipeline] FAILED: ${fileName} — ${error.message}`);

    await prisma.book.update({
      where: { id: bookId },
      data: { status: 'FAILED' },
    });

    throw error;
  }
}

/**
 * Find the chunk most likely to contain a given story candidate.
 */
function findRelevantChunk(
  chunks: { text: string; chapterTitle?: string }[],
  candidate: StoryCandidate
): string | null {
  const searchTerms = candidate.title
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);

  let bestChunk: string | null = null;
  let bestScore = 0;

  for (const chunk of chunks) {
    const lower = chunk.text.toLowerCase();
    let score = 0;
    for (const term of searchTerms) {
      if (lower.includes(term)) score++;
    }
    if (chunk.chapterTitle) {
      const chapterLower = chunk.chapterTitle.toLowerCase();
      for (const term of searchTerms) {
        if (chapterLower.includes(term)) score += 2;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestChunk = chunk.text;
    }
  }

  return bestChunk;
}

// ─── Start Worker ───────────────────────────────────────────────────────────

console.log('[Worker] Starting BookBite processing worker...');
console.log('[Worker] Waiting for jobs. Press Ctrl+C to stop.\n');

const worker = createBookWorker(processBook);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[Worker] Shutting down...');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});
