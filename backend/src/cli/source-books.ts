import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { PrismaClient } from '@prisma/client';
import { isBookAlreadyProcessed } from '../utils/dedup';
import { buildAffiliateLink } from '../utils/affiliate';
import { bookQueue } from '../pipeline/queue';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CatalogBook {
  title: string;
  author: string;
  categories: string[];
  isbn?: string;
  purchaseLink?: string;
}

interface Catalog {
  generatedAt: string;
  version: number;
  books: CatalogBook[];
}

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
const BOOKS_DIR = path.resolve(__dirname, '../../books');
const CATALOG_PATH = path.join(DATA_DIR, 'catalog.json');
const RESULTS_PATH = path.join(DATA_DIR, 'source-results.json');
const GUTENBERG_DIR = path.join(BOOKS_DIR, 'gutenberg');
const RATE_LIMIT_MS = 1000;

const prisma = new PrismaClient();

// ─── HTTP Fetcher ───────────────────────────────────────────────────────────

function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const request = client.get(url, { timeout: 30000 }, (res) => {
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

// ─── Sanitize filename ──────────────────────────────────────────────────────

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 100);
}

// ─── Check local Gutenberg folder ───────────────────────────────────────────

function findInLocalGutenberg(title: string, author: string): string | null {
  if (!fs.existsSync(GUTENBERG_DIR)) return null;

  const normalTitle = title.toLowerCase().trim();
  const files = fs.readdirSync(GUTENBERG_DIR);

  for (const file of files) {
    // Check filename for title match
    const lowerFile = file.toLowerCase();
    // Gutenberg files: gutenberg-{id}-{sanitized_title}.txt
    if (lowerFile.includes(sanitizeFilename(normalTitle).toLowerCase().substring(0, 30))) {
      return path.join(GUTENBERG_DIR, file);
    }
  }

  return null;
}

// ─── Search Gutenberg API ───────────────────────────────────────────────────

async function searchGutenberg(
  title: string,
  author: string
): Promise<{ textUrl: string; isbn?: string; gutenbergId: number } | null> {
  try {
    const query = encodeURIComponent(`${title} ${author}`);
    const url = `https://gutendex.com/books/?search=${query}`;
    const response = await fetchUrl(url);
    const data = JSON.parse(response);

    if (!data.results || data.results.length === 0) return null;

    // Try to find a close match
    const normalTitle = title.toLowerCase().trim();
    const book = data.results.find((b: any) => {
      const bTitle = (b.title || '').toLowerCase().trim();
      return bTitle.includes(normalTitle) || normalTitle.includes(bTitle);
    }) || data.results[0]; // Fall back to first result if no exact match

    // Find plain text URL
    const formats = book.formats || {};
    const textKeys = [
      'text/plain; charset=utf-8',
      'text/plain',
      'text/plain; charset=us-ascii',
    ];

    for (const key of textKeys) {
      if (formats[key]) {
        return {
          textUrl: formats[key],
          gutenbergId: book.id,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ─── Search Open Library ────────────────────────────────────────────────────

async function searchOpenLibrary(
  title: string,
  author: string
): Promise<{ isbn?: string; downloadUrl?: string } | null> {
  try {
    const query = `title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}`;
    const url = `https://openlibrary.org/search.json?${query}&limit=3`;
    const response = await fetchUrl(url);
    const data = JSON.parse(response);

    if (!data.docs || data.docs.length === 0) return null;

    const doc = data.docs[0];

    // Extract ISBN
    const isbn = doc.isbn ? doc.isbn[0] : undefined;

    // Check for downloadable text (Open Library full-text)
    // Open Library provides read links for some books
    let downloadUrl: string | undefined;
    if (doc.key) {
      try {
        const editionsUrl = `https://openlibrary.org${doc.key}/editions.json?limit=5`;
        const editionsResponse = await fetchUrl(editionsUrl);
        const editions = JSON.parse(editionsResponse);

        for (const edition of editions.entries || []) {
          if (edition.ocaid) {
            // Archive.org text link
            downloadUrl = `https://archive.org/download/${edition.ocaid}/${edition.ocaid}_djvu.txt`;
            break;
          }
        }
      } catch {
        // Can't fetch editions, that's okay
      }
    }

    return { isbn, downloadUrl };
  } catch {
    return null;
  }
}

// ─── Load existing results ──────────────────────────────────────────────────

function loadResults(): SourceResult[] {
  if (fs.existsSync(RESULTS_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf-8'));
    } catch {}
  }
  return [];
}

function saveResults(results: SourceResult[]): void {
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2), 'utf-8');
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function sourceBooks() {
  console.log('\n=== BookBite Book Sourcer ===\n');

  // Ensure directories exist
  for (const dir of [DATA_DIR, BOOKS_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Load catalog
  if (!fs.existsSync(CATALOG_PATH)) {
    console.error('ERROR: catalog.json not found. Run "npm run catalog:generate" first.');
    process.exit(1);
  }

  const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
  console.log(`Catalog contains ${catalog.books.length} books (v${catalog.version})`);

  // Load existing results for resume capability
  const existingResults = loadResults();
  const processedTitles = new Set(
    existingResults.map((r) => `${r.title.toLowerCase()}|${r.author.toLowerCase()}`)
  );

  const results: SourceResult[] = [...existingResults];
  let found = 0;
  let aiOnly = 0;
  let skippedDedup = 0;
  let skippedExisting = 0;

  for (let i = 0; i < catalog.books.length; i++) {
    const book = catalog.books[i];
    const progressStr = `[${i + 1}/${catalog.books.length}]`;

    // Skip if already in results
    const key = `${book.title.toLowerCase()}|${book.author.toLowerCase()}`;
    if (processedTitles.has(key)) {
      skippedExisting++;
      continue;
    }

    // Dedup check against DB
    const alreadyProcessed = await isBookAlreadyProcessed(book.title, book.author);
    if (alreadyProcessed) {
      console.log(`  ${progressStr} SKIP (DB) "${book.title}"`);
      results.push({
        title: book.title,
        author: book.author,
        categories: book.categories,
        isbn: book.isbn,
        source: 'gutenberg-bulk', // Assume it came from bulk download
      });
      processedTitles.add(key);
      skippedDedup++;
      continue;
    }

    console.log(`  ${progressStr} Searching: "${book.title}" by ${book.author}...`);

    let isbn = book.isbn;
    let sourceResult: SourceResult | null = null;

    // Step 1: Check local Gutenberg folder
    const localPath = findInLocalGutenberg(book.title, book.author);
    if (localPath) {
      console.log(`    → Found locally: ${path.basename(localPath)}`);
      sourceResult = {
        title: book.title,
        author: book.author,
        categories: book.categories,
        isbn,
        source: 'gutenberg-bulk',
        filePath: localPath,
      };
    }

    // Step 2: Search Gutenberg API
    if (!sourceResult) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS));
      const gutenberg = await searchGutenberg(book.title, book.author);
      if (gutenberg) {
        const safeTitle = sanitizeFilename(book.title);
        const fileName = `catalog-gutenberg-${gutenberg.gutenbergId}-${safeTitle}.txt`;
        const filePath = path.join(BOOKS_DIR, fileName);

        try {
          await downloadFile(gutenberg.textUrl, filePath);

          // Verify file is substantial
          const stats = fs.statSync(filePath);
          if (stats.size < 1000) {
            fs.unlinkSync(filePath);
          } else {
            console.log(`    → Downloaded from Gutenberg (#${gutenberg.gutenbergId})`);
            sourceResult = {
              title: book.title,
              author: book.author,
              categories: book.categories,
              isbn: isbn || gutenberg.isbn,
              source: 'gutenberg',
              filePath,
            };
          }
        } catch (err: any) {
          console.warn(`    → Gutenberg download failed: ${err.message}`);
          if (fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch {}
          }
        }
      }
    }

    // Step 3: Search Open Library
    if (!sourceResult) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS));
      const openLib = await searchOpenLibrary(book.title, book.author);
      if (openLib) {
        // Update ISBN if found
        if (openLib.isbn && !isbn) {
          isbn = openLib.isbn;
        }

        if (openLib.downloadUrl) {
          const safeTitle = sanitizeFilename(book.title);
          const fileName = `catalog-openlibrary-${safeTitle}.txt`;
          const filePath = path.join(BOOKS_DIR, fileName);

          try {
            await downloadFile(openLib.downloadUrl, filePath);

            const stats = fs.statSync(filePath);
            if (stats.size < 1000) {
              fs.unlinkSync(filePath);
            } else {
              console.log(`    → Downloaded from Open Library`);
              sourceResult = {
                title: book.title,
                author: book.author,
                categories: book.categories,
                isbn,
                source: 'openlibrary',
                filePath,
              };
            }
          } catch (err: any) {
            console.warn(`    → Open Library download failed: ${err.message}`);
            if (fs.existsSync(filePath)) {
              try { fs.unlinkSync(filePath); } catch {}
            }
          }
        }
      }
    }

    // Step 4: Mark as ai-only if no text found
    if (!sourceResult) {
      console.log(`    → No public text found, marking as AI-only`);
      sourceResult = {
        title: book.title,
        author: book.author,
        categories: book.categories,
        isbn,
        source: 'ai-only',
      };
      aiOnly++;
    } else {
      found++;

      // If we have a file, create DB record and queue for processing
      if (sourceResult.filePath) {
        const fileName = path.basename(sourceResult.filePath);
        const ext = path.extname(fileName).toLowerCase().replace('.', '') as 'pdf' | 'txt';

        try {
          const dbBook = await prisma.book.create({
            data: {
              title: book.title,
              author: book.author,
              sourceFile: fileName,
              isbn: isbn || null,
              categories: book.categories,
              status: 'QUEUED',
              purchaseLink: buildAffiliateLink(isbn, book.title, book.author),
            },
          });

          await bookQueue.add(
            'process-book',
            {
              bookId: dbBook.id,
              filePath: sourceResult.filePath,
              fileName,
              fileType: ext,
            },
            { jobId: `book-${dbBook.id}` }
          );
        } catch (err: any) {
          console.warn(`    → DB/Queue error: ${err.message}`);
        }
      }
    }

    results.push(sourceResult);
    processedTitles.add(key);

    // Save results periodically
    if (results.length % 20 === 0) {
      saveResults(results);
    }
  }

  // Final save
  saveResults(results);

  // Summary
  console.log('\n─────────────────────────────');
  console.log(`  Catalog books:       ${catalog.books.length}`);
  console.log(`  Found text:          ${found}`);
  console.log(`  AI-only:             ${aiOnly}`);
  console.log(`  Skipped (DB dedup):  ${skippedDedup}`);
  console.log(`  Skipped (existing):  ${skippedExisting}`);
  console.log(`  Results saved to:    ${RESULTS_PATH}`);
  console.log('─────────────────────────────\n');

  await prisma.$disconnect();
  process.exit(0);
}

// Entry point
sourceBooks().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
