import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { isBookAlreadyProcessed } from '../utils/dedup';
import { buildAffiliateLink } from '../utils/affiliate';
import { aiKnowledgeQueue } from '../pipeline/queue';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SourceResult {
  title: string;
  author: string;
  categories: string[];
  isbn?: string;
  source: 'gutenberg' | 'openlibrary' | 'gutenberg-bulk' | 'ai-only';
  filePath?: string;
}

// ─── Config ─────────────────────────────────────────────────────────────────

const DATA_DIR = path.resolve(__dirname, '../../data');
const RESULTS_PATH = path.join(DATA_DIR, 'source-results.json');

const prisma = new PrismaClient();

// ─── Main ───────────────────────────────────────────────────────────────────

async function generateStories() {
  console.log('\n=== BookBite AI Story Generator ===\n');

  // Load source results
  if (!fs.existsSync(RESULTS_PATH)) {
    console.error('ERROR: source-results.json not found. Run "npm run catalog:source" first.');
    process.exit(1);
  }

  const allResults: SourceResult[] = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf-8'));
  const aiOnlyBooks = allResults.filter((r) => r.source === 'ai-only');

  console.log(`Total source results: ${allResults.length}`);
  console.log(`AI-only books: ${aiOnlyBooks.length}\n`);

  if (aiOnlyBooks.length === 0) {
    console.log('No AI-only books to process.');
    process.exit(0);
  }

  let queued = 0;
  let skipped = 0;
  let errors = 0;

  for (const book of aiOnlyBooks) {
    try {
      // Dedup check
      const alreadyProcessed = await isBookAlreadyProcessed(book.title, book.author);
      if (alreadyProcessed) {
        console.log(`  SKIP  "${book.title}" by ${book.author} (already in DB)`);
        skipped++;
        continue;
      }

      // Create book record
      const dbBook = await prisma.book.create({
        data: {
          title: book.title,
          author: book.author,
          isbn: book.isbn || null,
          categories: book.categories,
          status: 'QUEUED',
          purchaseLink: buildAffiliateLink(book.isbn, book.title, book.author),
        },
      });

      // Queue for AI knowledge processing
      await aiKnowledgeQueue.add(
        'ai-knowledge',
        {
          bookId: dbBook.id,
          title: book.title,
          author: book.author,
          categories: book.categories,
        },
        { jobId: `ai-knowledge-${dbBook.id}` }
      );

      console.log(`  QUEUED "${book.title}" by ${book.author}`);
      queued++;
    } catch (err: any) {
      console.error(`  ERROR  "${book.title}": ${err.message}`);
      errors++;
    }
  }

  // Queue stats
  const waiting = await aiKnowledgeQueue.getWaitingCount();
  const active = await aiKnowledgeQueue.getActiveCount();

  console.log('\n─────────────────────────────');
  console.log(`  Queued:   ${queued}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Errors:   ${errors}`);
  console.log(`  Queue:    ${waiting} waiting, ${active} active`);
  console.log('─────────────────────────────');
  console.log('\nRun "npm run worker:ai" to start processing.\n');

  await prisma.$disconnect();
  process.exit(0);
}

// Entry point
generateStories().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
