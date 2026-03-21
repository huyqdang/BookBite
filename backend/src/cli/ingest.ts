import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { bookQueue } from '../pipeline/queue';
import { isBookAlreadyProcessed, getFailedBook } from '../utils/dedup';
import { buildAffiliateLink } from '../utils/affiliate';

const prisma = new PrismaClient();
const SUPPORTED_EXTENSIONS = ['.pdf', '.txt'];

function formatTitle(fileName: string): string {
  const name = path.basename(fileName, path.extname(fileName));
  return name
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Extract author from filename if it follows "Title - Author.ext" pattern
 */
function extractAuthor(fileName: string): string {
  const name = path.basename(fileName, path.extname(fileName));
  const parts = name.split(' - ');
  if (parts.length >= 2) {
    return parts[parts.length - 1].trim();
  }
  return 'Unknown';
}

async function ingest(folderPath: string) {
  const absPath = path.resolve(folderPath);

  console.log('\n=== BookBite Ingest CLI ===\n');
  console.log(`Scanning: ${absPath}\n`);

  if (!fs.existsSync(absPath)) {
    console.error(`ERROR: Folder not found: ${absPath}`);
    process.exit(1);
  }

  // Scan for supported files (recursive)
  const allFiles = scanDirectory(absPath);

  if (allFiles.length === 0) {
    console.log('No PDF or TXT files found.');
    process.exit(0);
  }

  console.log(`Found ${allFiles.length} file(s):\n`);

  let queued = 0;
  let skipped = 0;
  let requeued = 0;

  for (const filePath of allFiles) {
    const file = path.basename(filePath);
    const ext = path.extname(file).toLowerCase().replace('.', '') as 'pdf' | 'txt';
    const title = formatTitle(file);
    const author = extractAuthor(file);

    // Dedup check: sourceFile + title+author
    const alreadyProcessed = await isBookAlreadyProcessed(title, author, file);

    if (alreadyProcessed) {
      console.log(`  SKIP     ${file} (already processed — dedup match)`);
      skipped++;
      continue;
    }

    // Check if there's a failed book to reprocess
    const failedBook = await getFailedBook(title, author, file);

    let book;
    if (failedBook) {
      // Reset the failed book for reprocessing
      book = await prisma.book.update({
        where: { id: failedBook.id },
        data: {
          status: 'QUEUED',
          sourceFile: file,
          purchaseLink: buildAffiliateLink(null, title, author),
        },
      });
      console.log(`  REQUEUE  ${file} (reprocessing previously failed book)`);
      requeued++;
    } else {
      // Create new book record
      book = await prisma.book.create({
        data: {
          title,
          author,
          sourceFile: file,
          status: 'QUEUED',
          categories: [],
          purchaseLink: buildAffiliateLink(null, title, author),
        },
      });
    }

    // Push to BullMQ queue
    const job = await bookQueue.add(
      'process-book',
      {
        bookId: book.id,
        filePath,
        fileName: file,
        fileType: ext,
      },
      { jobId: `book-${book.id}` }
    );

    console.log(`  QUEUED   ${file} → Job ${job.id}`);
    queued++;
  }

  // Show summary
  const waiting = await bookQueue.getWaitingCount();
  const active = await bookQueue.getActiveCount();

  console.log(`\n─────────────────────────────`);
  console.log(`  New:     ${queued} queued`);
  console.log(`  Requeued:${requeued}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Queue:   ${waiting} waiting, ${active} active`);
  console.log(`─────────────────────────────`);
  console.log(`\nWorker will process them in the background.`);
  console.log(`Run "npm run queue:status" to check progress.\n`);

  await prisma.$disconnect();
  process.exit(0);
}

/**
 * Recursively scan a directory for supported files.
 */
function scanDirectory(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanDirectory(fullPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_EXTENSIONS.includes(ext)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

// Entry point
const folder = process.argv[2] || path.resolve(__dirname, '../../books');
ingest(folder);
