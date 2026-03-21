import { PrismaClient } from '@prisma/client';
import { loadBooksRoundRobin, getBookListStats } from '../utils/book-list-loader';
import { isBookAlreadyProcessed } from '../utils/dedup';
import { buildAffiliateLink } from '../utils/affiliate';
import { initTokenTracker, BudgetExhaustedError } from '../utils/token-tracker';
import {
  discoverStoriesFromKnowledge,
  generateStoryFromKnowledge,
} from '../pipeline/ai-knowledge-processor';

/**
 * Process Books CLI
 *
 * Reads the curated book lists (data/book-lists/*.json), orders them
 * round-robin across categories, and generates stories using AI.
 *
 * Usage:
 *   npm run process:books                    # Run with default $50 budget
 *   npm run process:books -- --budget 100    # Run with $100 budget
 *   npm run process:books -- --limit 5       # Process only 5 books
 *   npm run process:books -- --dry-run       # Show what would be processed
 */

const prisma = new PrismaClient();

// ─── Parse CLI Args ─────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);

  const budgetIdx = args.indexOf('--budget');
  const budget = budgetIdx !== -1 ? parseFloat(args[budgetIdx + 1]) : 50;

  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity;

  const dryRun = args.includes('--dry-run');

  return { budget, limit, dryRun };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function processBooks() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║       BookBite — Process Books from Lists    ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  const { budget, limit, dryRun } = parseArgs();

  // Show book list stats
  const stats = getBookListStats();
  console.log(`Book list files: ${stats.totalFiles}`);
  console.log(`Total unique books: ${stats.totalUnique}`);
  console.log('Per category:');
  for (const [cat, count] of Object.entries(stats.categoryCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }
  console.log('');

  // Load round-robin ordered books
  const books = loadBooksRoundRobin();

  if (books.length === 0) {
    console.error('No books found. Add book list files to data/book-lists/');
    process.exit(1);
  }

  // Init token tracker
  const tracker = initTokenTracker(budget);
  console.log(`Budget: $${budget.toFixed(2)}`);
  console.log(`Book limit: ${limit === Infinity ? 'none' : limit}`);
  console.log(`Dry run: ${dryRun}`);
  console.log('');

  if (dryRun) {
    console.log('=== DRY RUN — Books would be processed in this order: ===\n');
    let shown = 0;
    for (const book of books) {
      if (shown >= (limit === Infinity ? 50 : limit)) {
        console.log(`  ... and ${books.length - shown} more`);
        break;
      }
      const alreadyDone = await isBookAlreadyProcessed(book.title, book.author);
      const status = alreadyDone ? 'SKIP (already processed)' : 'WILL PROCESS';
      console.log(`  ${shown + 1}. [${status}] "${book.title}" by ${book.author} (${book.categories.join(', ')})`);
      shown++;
    }
    console.log('');
    await prisma.$disconnect();
    process.exit(0);
  }

  // ── Process books ─────────────────────────────────────────────────────

  let processed = 0;
  let skipped = 0;
  let totalStories = 0;
  let stoppedReason = '';

  for (const book of books) {
    if (processed >= limit) {
      stoppedReason = `Reached book limit (${limit})`;
      break;
    }

    // Check budget before starting a new book
    if (!tracker.hasBudget()) {
      stoppedReason = 'Budget exhausted';
      break;
    }

    // Dedup check
    const alreadyDone = await isBookAlreadyProcessed(book.title, book.author);
    if (alreadyDone) {
      skipped++;
      continue;
    }

    console.log(`\n${'━'.repeat(60)}`);
    console.log(`Book ${processed + 1}: "${book.title}" by ${book.author}`);
    console.log(`Categories: ${book.categories.join(', ')} | Rank: ${book.rank}`);
    console.log(`Budget remaining: $${tracker.getRemaining().toFixed(2)}`);
    console.log(`${'━'.repeat(60)}\n`);

    try {
      // Create book record in DB
      const dbBook = await prisma.book.create({
        data: {
          title: book.title,
          author: book.author,
          categories: book.categories,
          status: 'PROCESSING',
          tier: 1, // Curated top books
          purchaseLink: buildAffiliateLink(null, book.title, book.author),
        },
      });

      // Discover stories (multi-pass, targeting 50+)
      const candidates = await discoverStoriesFromKnowledge(
        book.title,
        book.author,
        book.categories
      );

      if (candidates.length === 0) {
        console.log(`  No stories found. Marking as completed.`);
        await prisma.book.update({
          where: { id: dbBook.id },
          data: { status: 'COMPLETED', storyCount: 0 },
        });
        processed++;
        continue;
      }

      console.log(`  Generating ${candidates.length} stories...\n`);
      let bookStories = 0;

      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];

        // Check budget before each story
        if (!tracker.hasBudget()) {
          console.log(`\n  Budget exhausted after ${bookStories} stories for this book.`);
          break;
        }

        try {
          const story = await generateStoryFromKnowledge(
            book.title,
            book.author,
            candidate,
            book.categories
          );

          if (!story || !story.content || story.content.length < 50) {
            continue;
          }

          await prisma.story.create({
            data: {
              bookId: dbBook.id,
              title: story.title,
              content: story.content,
              summary: story.content.substring(0, 200) + '...',
              readingTimeMinutes: story.readingTimeMinutes,
              categories: story.categories,
              tone: story.tone,
              styleSeed: story.styleSeed,
            },
          });

          bookStories++;
          totalStories++;

          if (bookStories % 10 === 0) {
            console.log(`    Progress: ${bookStories}/${candidates.length} stories | $${tracker.getSpent().toFixed(2)} spent`);
          }

          // Small delay between calls
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (err: any) {
          if (err instanceof BudgetExhaustedError || err.name === 'BudgetExhaustedError') {
            console.log(`\n  Budget exhausted after ${bookStories} stories.`);
            break;
          }
          if (err.message?.includes('API limit reached')) {
            console.log(`\n  API rate limit reached.`);
            stoppedReason = 'API rate limit';
            break;
          }
          // Skip individual story errors
          console.warn(`    Failed "${candidate.title}": ${err.message}`);
        }
      }

      // Update book record
      await prisma.book.update({
        where: { id: dbBook.id },
        data: {
          status: 'COMPLETED',
          storyCount: bookStories,
        },
      });

      console.log(`\n  Done: ${bookStories} stories from "${book.title}"`);
      processed++;

      // Stop if budget ran out during story generation
      if (!tracker.hasBudget()) {
        stoppedReason = 'Budget exhausted';
        break;
      }
      if (stoppedReason) break;

    } catch (err: any) {
      if (err instanceof BudgetExhaustedError || err.name === 'BudgetExhaustedError') {
        stoppedReason = 'Budget exhausted';
        break;
      }
      if (err.message?.includes('API limit reached')) {
        stoppedReason = 'API rate limit';
        break;
      }

      console.error(`  ERROR processing "${book.title}": ${err.message}`);
      // Continue to next book on error
      processed++;
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────

  tracker.printSummary();

  console.log('═══════════════════════════════════════');
  console.log('  Processing Summary');
  console.log('═══════════════════════════════════════');
  console.log(`  Books processed:  ${processed}`);
  console.log(`  Books skipped:    ${skipped} (already in DB)`);
  console.log(`  Stories created:  ${totalStories}`);
  if (stoppedReason) {
    console.log(`  Stopped because:  ${stoppedReason}`);
  }
  console.log(`  Avg stories/book: ${processed > 0 ? (totalStories / processed).toFixed(0) : 0}`);
  console.log('═══════════════════════════════════════\n');

  await prisma.$disconnect();
  process.exit(0);
}

// Entry point
processBooks().catch(async (err) => {
  if (err instanceof BudgetExhaustedError || err.name === 'BudgetExhaustedError') {
    console.log('\nPipeline stopped: Budget exhausted.');
    console.log(`Spent: $${err.spent.toFixed(2)} / $${err.budget.toFixed(2)}`);
  } else {
    console.error('Fatal error:', err);
  }
  await prisma.$disconnect();
  process.exit(err instanceof BudgetExhaustedError ? 0 : 1);
});
