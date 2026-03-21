import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { PrismaClient } from '@prisma/client';
import { isBookAlreadyProcessed } from '../utils/dedup';
import { buildAffiliateLink } from '../utils/affiliate';
import { bookQueue } from '../pipeline/queue';

// ─── Types ──────────────────────────────────────────────────────────────────

interface GutenbergBook {
  id: number;
  title: string;
  authors: Array<{ name: string; birth_year?: number; death_year?: number }>;
  subjects: string[];
  bookshelves: string[];
  languages: string[];
  formats: Record<string, string>;
  download_count: number;
}

interface GutenbergResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: GutenbergBook[];
}

interface GutenbergProgress {
  lastPage: number;
  totalPages: number;
  totalDownloaded: number;
  totalSkipped: number;
  lastUpdated: string;
  completedIds: number[];
}

// ─── Config ─────────────────────────────────────────────────────────────────

const DATA_DIR = path.resolve(__dirname, '../../data');
const BOOKS_DIR = path.resolve(__dirname, '../../books/gutenberg');
const PROGRESS_PATH = path.join(DATA_DIR, 'gutenberg-progress.json');
const GUTENDEX_BASE = 'https://gutendex.com/books/';
const RATE_LIMIT_MS = 1000; // 1 request per second

const prisma = new PrismaClient();

// ─── HTTP Fetcher ───────────────────────────────────────────────────────────

function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const request = client.get(url, { timeout: 30000 }, (res) => {
      // Follow redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        res.resume();
        return;
      }

      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      res.on('error', reject);
    });
    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const request = client.get(url, { timeout: 60000 }, (res) => {
      // Follow redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        res.resume();
        return;
      }

      const ws = fs.createWriteStream(destPath);
      res.pipe(ws);
      ws.on('finish', () => ws.close(() => resolve()));
      ws.on('error', reject);
      res.on('error', reject);
    });
    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error(`Timeout downloading ${url}`));
    });
  });
}

// ─── Progress Tracking ──────────────────────────────────────────────────────

function loadProgress(): GutenbergProgress {
  if (fs.existsSync(PROGRESS_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf-8'));
    } catch {
      // Corrupted progress file, start fresh
    }
  }
  return {
    lastPage: 0,
    totalPages: 0,
    totalDownloaded: 0,
    totalSkipped: 0,
    lastUpdated: new Date().toISOString(),
    completedIds: [],
  };
}

function saveProgress(progress: GutenbergProgress): void {
  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2), 'utf-8');
}

// ─── Extract text URL from Gutenberg formats ────────────────────────────────

function getTextUrl(formats: Record<string, string>): string | null {
  // Prefer UTF-8 plain text
  const preferredKeys = [
    'text/plain; charset=utf-8',
    'text/plain',
    'text/plain; charset=us-ascii',
    'text/plain; charset=iso-8859-1',
  ];

  for (const key of preferredKeys) {
    if (formats[key]) {
      return formats[key];
    }
  }

  // Look for any plain text format
  for (const [mime, url] of Object.entries(formats)) {
    if (mime.startsWith('text/plain') && !url.endsWith('.zip')) {
      return url;
    }
  }

  return null;
}

// ─── Extract ISBN from formats metadata if available ────────────────────────

function extractIsbn(book: GutenbergBook): string | undefined {
  // Gutendex doesn't reliably provide ISBNs, but we can try subjects
  for (const subject of book.subjects) {
    const isbnMatch = subject.match(/ISBN[:\s]*(\d{10}|\d{13})/i);
    if (isbnMatch) return isbnMatch[1];
  }
  return undefined;
}

// ─── Sanitize filename ──────────────────────────────────────────────────────

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 100);
}

// ─── Map Gutenberg categories to our categories ─────────────────────────────

function mapGutenbergCategories(book: GutenbergBook): string[] {
  const categories = new Set<string>();
  const allText = [...book.subjects, ...book.bookshelves].join(' ').toLowerCase();

  const mapping: Record<string, string> = {
    'fiction': 'Fiction',
    'novel': 'Fiction',
    'romance': 'Romance',
    'love': 'Romance',
    'history': 'History',
    'historical': 'History',
    'science': 'Science',
    'philosophy': 'Philosophy',
    'psychology': 'Psychology',
    'biography': 'Biography',
    'autobiography': 'Biography',
    'business': 'Business',
    'economics': 'Economics',
    'education': 'Education',
    'technology': 'Technology',
    'health': 'Health',
    'spirituality': 'Spirituality',
    'religion': 'Spirituality',
    'self-help': 'Self-Help',
    'sociology': 'Sociology',
    'art': 'Creativity',
    'creativity': 'Creativity',
  };

  for (const [keyword, category] of Object.entries(mapping)) {
    if (allText.includes(keyword)) {
      categories.add(category);
    }
  }

  if (categories.size === 0) {
    categories.add('Fiction'); // Default for Gutenberg (mostly fiction)
  }

  return Array.from(categories);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function gutenbergBulk() {
  console.log('\n=== BookBite Gutenberg Bulk Download ===\n');

  // Parse CLI args
  const args = process.argv.slice(2);
  const resume = args.includes('--resume');
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity;
  const langIdx = args.indexOf('--lang');
  const lang = langIdx !== -1 ? args[langIdx + 1] : 'en';

  // Ensure directories exist
  for (const dir of [DATA_DIR, BOOKS_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Load or initialize progress
  const progress = resume ? loadProgress() : {
    lastPage: 0,
    totalPages: 0,
    totalDownloaded: 0,
    totalSkipped: 0,
    lastUpdated: new Date().toISOString(),
    completedIds: [],
  };

  const completedSet = new Set(progress.completedIds);

  console.log(`Language filter: ${lang}`);
  console.log(`Limit: ${limit === Infinity ? 'none' : limit}`);
  if (resume && progress.lastPage > 0) {
    console.log(`Resuming from page ${progress.lastPage + 1}`);
    console.log(`Previously downloaded: ${progress.totalDownloaded}`);
  }
  console.log('');

  let currentPage = progress.lastPage + 1;
  let downloaded = 0;
  let skipped = 0;
  let errors = 0;
  let hasMore = true;

  // Build initial URL
  let url = `${GUTENDEX_BASE}?languages=${lang}&page=${currentPage}`;

  while (hasMore && downloaded < limit) {
    try {
      console.log(`Fetching page ${currentPage}...`);
      const response = await fetchUrl(url);
      const data: GutenbergResponse = JSON.parse(response);

      if (progress.totalPages === 0) {
        progress.totalPages = Math.ceil(data.count / 32); // Gutendex returns 32 per page
        console.log(`Total books: ~${data.count} (${progress.totalPages} pages)`);
      }

      for (const book of data.results) {
        if (downloaded >= limit) break;

        // Skip if already completed in this run
        if (completedSet.has(book.id)) {
          skipped++;
          continue;
        }

        const authorName = book.authors.length > 0
          ? book.authors[0].name
          : 'Unknown';

        // Dedup check against DB
        const alreadyProcessed = await isBookAlreadyProcessed(
          book.title,
          authorName,
          `gutenberg-${book.id}.txt`
        );

        if (alreadyProcessed) {
          completedSet.add(book.id);
          skipped++;
          continue;
        }

        // Find text URL
        const textUrl = getTextUrl(book.formats);
        if (!textUrl) {
          skipped++;
          continue;
        }

        // Download the text file
        const safeTitle = sanitizeFilename(book.title);
        const fileName = `gutenberg-${book.id}-${safeTitle}.txt`;
        const filePath = path.join(BOOKS_DIR, fileName);

        if (fs.existsSync(filePath)) {
          // File already downloaded but maybe not in DB
          completedSet.add(book.id);
          skipped++;
          continue;
        }

        try {
          await downloadFile(textUrl, filePath);

          // Check file size — skip very small files (likely error pages)
          const stats = fs.statSync(filePath);
          if (stats.size < 1000) {
            fs.unlinkSync(filePath);
            skipped++;
            continue;
          }

          const isbn = extractIsbn(book);
          const categories = mapGutenbergCategories(book);

          // Create book record in DB
          const dbBook = await prisma.book.create({
            data: {
              title: book.title,
              author: authorName,
              sourceFile: fileName,
              isbn: isbn || null,
              categories,
              status: 'QUEUED',
              purchaseLink: buildAffiliateLink(isbn, book.title, authorName),
            },
          });

          // Queue for processing
          await bookQueue.add(
            'process-book',
            {
              bookId: dbBook.id,
              filePath,
              fileName,
              fileType: 'txt' as const,
            },
            { jobId: `book-${dbBook.id}` }
          );

          completedSet.add(book.id);
          downloaded++;

          if (downloaded % 10 === 0) {
            console.log(`  Downloaded: ${downloaded} | Skipped: ${skipped} | Errors: ${errors}`);
          }
        } catch (err: any) {
          errors++;
          if (fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch {}
          }
          console.warn(`  WARN: Failed to download Gutenberg #${book.id}: ${err.message}`);
        }

        // Rate limit
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS));
      }

      // Save progress after each page
      progress.lastPage = currentPage;
      progress.totalDownloaded += downloaded;
      progress.totalSkipped += skipped;
      progress.completedIds = Array.from(completedSet);
      saveProgress(progress);

      // Next page
      if (data.next && downloaded < limit) {
        url = data.next;
        currentPage++;
      } else {
        hasMore = false;
      }
    } catch (err: any) {
      console.error(`ERROR on page ${currentPage}: ${err.message}`);
      errors++;

      // Save progress and retry next page
      progress.lastPage = currentPage;
      progress.completedIds = Array.from(completedSet);
      saveProgress(progress);

      currentPage++;
      url = `${GUTENDEX_BASE}?languages=${lang}&page=${currentPage}`;

      // Wait a bit before retrying
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  // Final save
  progress.totalDownloaded += downloaded;
  progress.totalSkipped += skipped;
  progress.completedIds = Array.from(completedSet);
  saveProgress(progress);

  // Summary
  console.log('\n─────────────────────────────');
  console.log(`  Downloaded:  ${downloaded}`);
  console.log(`  Skipped:     ${skipped}`);
  console.log(`  Errors:      ${errors}`);
  console.log(`  Last page:   ${progress.lastPage}`);
  console.log(`  Progress saved to: ${PROGRESS_PATH}`);
  console.log('─────────────────────────────');
  console.log('\nUse --resume to continue from where you left off.\n');

  await prisma.$disconnect();
  process.exit(0);
}

// Entry point
gutenbergBulk().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
