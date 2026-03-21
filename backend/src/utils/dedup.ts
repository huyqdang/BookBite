import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Normalize a string for comparison: lowercase, trim, collapse whitespace.
 */
function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Check if a book has already been processed.
 *
 * Checks (any match = skip, unless status is FAILED):
 * 1. Book.sourceFile exact match
 * 2. Book.title + Book.author normalized match
 *
 * If the book exists but has status FAILED, returns false (allow reprocessing).
 */
export async function isBookAlreadyProcessed(
  title: string,
  author: string,
  sourceFile?: string
): Promise<boolean> {
  // Check 1: sourceFile exact match
  if (sourceFile) {
    const byFile = await prisma.book.findUnique({
      where: { sourceFile },
      select: { id: true, status: true },
    });
    if (byFile) {
      if (byFile.status === 'FAILED') {
        return false; // Allow reprocessing of failed books
      }
      return true;
    }
  }

  // Check 2: title + author normalized match
  const normalizedTitle = normalize(title);
  const normalizedAuthor = normalize(author);

  // Prisma doesn't support case-insensitive combined queries easily,
  // so we use a raw query for this
  const matches = await prisma.$queryRaw<Array<{ id: string; status: string }>>`
    SELECT id, status FROM books
    WHERE LOWER(TRIM(title)) = ${normalizedTitle}
      AND LOWER(TRIM(author)) = ${normalizedAuthor}
    LIMIT 1
  `;

  if (matches.length > 0) {
    if (matches[0].status === 'FAILED') {
      return false; // Allow reprocessing of failed books
    }
    return true;
  }

  return false;
}

/**
 * Get the existing book record if it was previously failed (for reprocessing).
 */
export async function getFailedBook(
  title: string,
  author: string,
  sourceFile?: string
): Promise<{ id: string } | null> {
  if (sourceFile) {
    const byFile = await prisma.book.findUnique({
      where: { sourceFile },
      select: { id: true, status: true },
    });
    if (byFile && byFile.status === 'FAILED') {
      return { id: byFile.id };
    }
  }

  const normalizedTitle = normalize(title);
  const normalizedAuthor = normalize(author);

  const matches = await prisma.$queryRaw<Array<{ id: string; status: string }>>`
    SELECT id, status FROM books
    WHERE LOWER(TRIM(title)) = ${normalizedTitle}
      AND LOWER(TRIM(author)) = ${normalizedAuthor}
      AND status = 'FAILED'
    LIMIT 1
  `;

  return matches.length > 0 ? { id: matches[0].id } : null;
}

export { prisma as dedupPrisma };
