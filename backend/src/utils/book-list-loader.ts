import fs from 'fs';
import path from 'path';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BookListEntry {
  title: string;
  author: string;
  categories: string[];
  rank: number; // Position within its primary category (1-based)
  sourceFile: string; // Which list file it came from
}

interface BookListFile {
  createdAt: string;
  description?: string;
  categories: Record<string, Array<{ title: string; author: string }>>;
}

// ─── Config ─────────────────────────────────────────────────────────────────

const BOOK_LISTS_DIR = path.resolve(__dirname, '../../data/book-lists');

// ─── Load all book list files and merge ─────────────────────────────────────

function loadAllBookLists(): BookListFile[] {
  if (!fs.existsSync(BOOK_LISTS_DIR)) {
    console.warn(`[BookListLoader] Directory not found: ${BOOK_LISTS_DIR}`);
    return [];
  }

  const files = fs.readdirSync(BOOK_LISTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort(); // Sort by filename (date-based names sort chronologically)

  const lists: BookListFile[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(BOOK_LISTS_DIR, file), 'utf-8');
      const parsed = JSON.parse(content) as BookListFile;
      parsed.createdAt = parsed.createdAt || file.replace('.json', '');
      lists.push(parsed);
      console.log(`[BookListLoader] Loaded: ${file} (${parsed.createdAt})`);
    } catch (err: any) {
      console.warn(`[BookListLoader] Failed to parse ${file}: ${err.message}`);
    }
  }

  return lists;
}

// ─── Build per-category ranked lists ────────────────────────────────────────

function buildCategoryRanks(lists: BookListFile[]): Map<string, BookListEntry[]> {
  const categoryMap = new Map<string, BookListEntry[]>();
  const seenBooks = new Set<string>(); // "title|author" dedup key

  // Process lists in order (newer files add new books, don't duplicate)
  for (const list of lists) {
    for (const [category, books] of Object.entries(list.categories)) {
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }

      const categoryList = categoryMap.get(category)!;

      for (const book of books) {
        const key = `${book.title.toLowerCase().trim()}|${book.author.toLowerCase().trim()}`;

        if (seenBooks.has(key)) continue; // Skip duplicates across files
        seenBooks.add(key);

        categoryList.push({
          title: book.title,
          author: book.author,
          categories: [category], // Will be enriched below
          rank: categoryList.length + 1,
          sourceFile: list.createdAt,
        });
      }
    }
  }

  // Enrich: find all categories for each book
  const bookCategories = new Map<string, Set<string>>();
  for (const [category, books] of categoryMap.entries()) {
    for (const book of books) {
      const key = `${book.title.toLowerCase().trim()}|${book.author.toLowerCase().trim()}`;
      if (!bookCategories.has(key)) {
        bookCategories.set(key, new Set());
      }
      bookCategories.get(key)!.add(category);
    }
  }

  // Apply enriched categories
  for (const books of categoryMap.values()) {
    for (const book of books) {
      const key = `${book.title.toLowerCase().trim()}|${book.author.toLowerCase().trim()}`;
      const allCats = bookCategories.get(key);
      if (allCats) {
        book.categories = Array.from(allCats);
      }
    }
  }

  return categoryMap;
}

// ─── Round-robin ordering ───────────────────────────────────────────────────

/**
 * Returns books in round-robin order across categories:
 * Rank 1 from each category, then rank 2, then rank 3, etc.
 *
 * Deduplicates: if a book appears in multiple categories,
 * it only appears ONCE in the output (at its first occurrence).
 */
export function loadBooksRoundRobin(): BookListEntry[] {
  const lists = loadAllBookLists();

  if (lists.length === 0) {
    console.warn('[BookListLoader] No book list files found.');
    return [];
  }

  const categoryRanks = buildCategoryRanks(lists);
  const categories = Array.from(categoryRanks.keys()).sort();

  console.log(`[BookListLoader] Categories: ${categories.length}`);
  for (const cat of categories) {
    console.log(`  ${cat}: ${categoryRanks.get(cat)!.length} books`);
  }

  // Round-robin: rank 1 from each category, then rank 2, etc.
  const result: BookListEntry[] = [];
  const seen = new Set<string>(); // Dedup across categories

  const maxRank = Math.max(...Array.from(categoryRanks.values()).map((b) => b.length));

  for (let rank = 0; rank < maxRank; rank++) {
    for (const category of categories) {
      const books = categoryRanks.get(category)!;
      if (rank >= books.length) continue;

      const book = books[rank];
      const key = `${book.title.toLowerCase().trim()}|${book.author.toLowerCase().trim()}`;

      if (seen.has(key)) continue; // Already in output from another category
      seen.add(key);

      result.push(book);
    }
  }

  console.log(`[BookListLoader] Total unique books (round-robin): ${result.length}\n`);

  return result;
}

/**
 * Get summary stats about the loaded book lists.
 */
export function getBookListStats(): {
  totalFiles: number;
  totalUnique: number;
  categoryCounts: Record<string, number>;
} {
  const lists = loadAllBookLists();
  const categoryRanks = buildCategoryRanks(lists);

  const categoryCounts: Record<string, number> = {};
  for (const [cat, books] of categoryRanks.entries()) {
    categoryCounts[cat] = books.length;
  }

  const allBooks = new Set<string>();
  for (const books of categoryRanks.values()) {
    for (const book of books) {
      allBooks.add(`${book.title.toLowerCase()}|${book.author.toLowerCase()}`);
    }
  }

  return {
    totalFiles: lists.length,
    totalUnique: allBooks.size,
    categoryCounts,
  };
}
