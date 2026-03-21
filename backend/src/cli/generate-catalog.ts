import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';
import { VALID_CATEGORIES } from '../pipeline/categorizer';

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

// ─── Config ─────────────────────────────────────────────────────────────────

const DATA_DIR = path.resolve(__dirname, '../../data');
const CATALOG_PATH = path.join(DATA_DIR, 'catalog.json');
const BOOKS_PER_CATEGORY = 200;

// ─── AI Client ──────────────────────────────────────────────────────────────

function getAnthropic(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set. Required for catalog generation.');
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
}

// ─── Generate books for a single category ───────────────────────────────────

async function generateBooksForCategory(
  client: Anthropic,
  category: string
): Promise<CatalogBook[]> {
  console.log(`  Generating top ${BOOKS_PER_CATEGORY} books for "${category}"...`);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    system: `You are a world-class book curator and literary expert. You provide accurate, well-researched book recommendations. Always respond in valid JSON only, no markdown fences.`,
    messages: [
      {
        role: 'user',
        content: `Generate a list of the top ${BOOKS_PER_CATEGORY} most impactful, popular, and highly-rated books in the "${category}" category. Include both classic and modern titles.

For each book, provide:
- title: The exact book title
- author: The author's full name
- isbn: The ISBN-10 if you know it (10-digit number), otherwise null
- categories: An array of categories this book fits into from this list: ${VALID_CATEGORIES.join(', ')}

Requirements:
- Include a diverse mix: bestsellers, award winners, cult classics, and modern gems
- Prioritize books that have rich stories, anecdotes, examples, and engaging narratives
- For fiction: prioritize novels with compelling plots and memorable characters
- For non-fiction: prioritize books known for their real-world examples and case studies
- Include books from various time periods and cultural backgrounds
- Be accurate with titles and author names

Return a JSON array of exactly ${BOOKS_PER_CATEGORY} books:
[
  {
    "title": "Book Title",
    "author": "Author Name",
    "isbn": "0123456789",
    "categories": ["${category}", "OtherCategory"]
  }
]`,
      },
    ],
  });

  const block = response.content[0];
  if (block.type !== 'text') {
    console.warn(`  WARNING: Unexpected response type for "${category}"`);
    return [];
  }

  try {
    const parsed = JSON.parse(
      block.text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    );
    if (!Array.isArray(parsed)) return [];

    return parsed.map((b: any) => ({
      title: String(b.title || '').trim(),
      author: String(b.author || '').trim(),
      isbn: b.isbn ? String(b.isbn).trim() : undefined,
      categories: Array.isArray(b.categories) ? b.categories : [category],
    })).filter((b: CatalogBook) => b.title && b.author);
  } catch (err: any) {
    console.error(`  ERROR parsing response for "${category}": ${err.message}`);
    return [];
  }
}

// ─── Deduplicate across categories ──────────────────────────────────────────

function deduplicateBooks(allBooks: CatalogBook[]): CatalogBook[] {
  const seen = new Map<string, CatalogBook>();

  for (const book of allBooks) {
    const key = `${book.title.toLowerCase().trim()}|${book.author.toLowerCase().trim()}`;

    if (seen.has(key)) {
      // Merge categories
      const existing = seen.get(key)!;
      const mergedCategories = new Set([...existing.categories, ...book.categories]);
      existing.categories = Array.from(mergedCategories);
      // Keep ISBN if we have one
      if (!existing.isbn && book.isbn) {
        existing.isbn = book.isbn;
      }
    } else {
      seen.set(key, { ...book });
    }
  }

  return Array.from(seen.values());
}

// ─── Backup existing catalog ────────────────────────────────────────────────

function backupCatalog(): void {
  if (!fs.existsSync(CATALOG_PATH)) return;

  try {
    const existing: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
    const date = existing.generatedAt
      ? new Date(existing.generatedAt).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    const backupPath = path.join(DATA_DIR, `catalog.${date}.json`);
    fs.copyFileSync(CATALOG_PATH, backupPath);
    console.log(`  Backed up existing catalog to ${path.basename(backupPath)}`);
  } catch {
    // If parsing fails, just back up with current date
    const backupPath = path.join(DATA_DIR, `catalog.${new Date().toISOString().split('T')[0]}.json`);
    fs.copyFileSync(CATALOG_PATH, backupPath);
  }
}

// ─── Check catalog age ──────────────────────────────────────────────────────

export function isCatalogStale(maxAgeDays = 90): boolean {
  if (!fs.existsSync(CATALOG_PATH)) return true;

  try {
    const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
    const generatedAt = new Date(catalog.generatedAt);
    const ageMs = Date.now() - generatedAt.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    return ageDays > maxAgeDays;
  } catch {
    return true;
  }
}

// ─── Load catalog ───────────────────────────────────────────────────────────

export function loadCatalog(): Catalog | null {
  if (!fs.existsSync(CATALOG_PATH)) return null;

  try {
    return JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function generateCatalog() {
  console.log('\n=== BookBite Catalog Generator ===\n');

  // Ensure data dir exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Check if we should force or skip
  const force = process.argv.includes('--force');
  if (!force && !isCatalogStale()) {
    const catalog = loadCatalog();
    if (catalog) {
      console.log(`Catalog is up to date (generated ${catalog.generatedAt}).`);
      console.log(`Contains ${catalog.books.length} unique books.`);
      console.log('Use --force to regenerate.\n');
      process.exit(0);
    }
  }

  // Backup existing catalog
  backupCatalog();

  const client = getAnthropic();
  const allBooks: CatalogBook[] = [];

  // Generate books for each category
  const categories = [...VALID_CATEGORIES];
  console.log(`Generating top ${BOOKS_PER_CATEGORY} books for ${categories.length} categories...\n`);

  for (const category of categories) {
    try {
      const books = await generateBooksForCategory(client, category);
      console.log(`    → ${books.length} books found\n`);
      allBooks.push(...books);

      // Rate limit: slight delay between categories
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (err: any) {
      console.error(`  ERROR generating "${category}": ${err.message}\n`);
    }
  }

  // Deduplicate across categories
  console.log(`\nDeduplicating ${allBooks.length} total entries...`);
  const uniqueBooks = deduplicateBooks(allBooks);
  console.log(`  → ${uniqueBooks.length} unique books after dedup\n`);

  // Determine version
  let version = 1;
  const existing = loadCatalog();
  if (existing) {
    version = (existing.version || 0) + 1;
  }

  // Write catalog
  const catalog: Catalog = {
    generatedAt: new Date().toISOString(),
    version,
    books: uniqueBooks,
  };

  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf-8');

  console.log(`Catalog written to ${CATALOG_PATH}`);
  console.log(`  Version: ${version}`);
  console.log(`  Books: ${uniqueBooks.length}`);
  console.log(`  Generated: ${catalog.generatedAt}\n`);

  // Stats by category
  const categoryStats = new Map<string, number>();
  for (const book of uniqueBooks) {
    for (const cat of book.categories) {
      categoryStats.set(cat, (categoryStats.get(cat) || 0) + 1);
    }
  }
  console.log('Books per category:');
  for (const [cat, count] of Array.from(categoryStats.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }
  console.log('');

  process.exit(0);
}

// Entry point
generateCatalog().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
