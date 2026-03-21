import { env } from '../config/env';

/**
 * Build an Amazon affiliate link for a book.
 *
 * Link generation cascade:
 * 1. If ISBN is available -> direct product link: https://www.amazon.com/dp/{ISBN}?tag={TAG}
 * 2. If no ISBN -> search link: https://www.amazon.com/s?k={TITLE}+{AUTHOR}&tag={TAG}
 *
 * When the associate tag is empty, links are generated without the ?tag= param
 * (works fine, just no commission tracking).
 */
export function buildAffiliateLink(
  isbn?: string | null,
  title?: string | null,
  author?: string | null
): string {
  const tag = env.AMAZON_ASSOCIATE_TAG;

  // Strategy 1: Direct product link with ISBN
  if (isbn) {
    const cleanIsbn = isbn.replace(/[-\s]/g, '');
    const baseUrl = `https://www.amazon.com/dp/${encodeURIComponent(cleanIsbn)}`;
    return tag ? `${baseUrl}?tag=${encodeURIComponent(tag)}` : baseUrl;
  }

  // Strategy 2: Search link with title + author
  const searchTerms: string[] = [];
  if (title) searchTerms.push(title);
  if (author && author !== 'Unknown') searchTerms.push(author);

  if (searchTerms.length === 0) {
    // Fallback: generic Amazon link
    return tag
      ? `https://www.amazon.com?tag=${encodeURIComponent(tag)}`
      : 'https://www.amazon.com';
  }

  const query = searchTerms.join(' ');
  const baseUrl = `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
  return tag ? `${baseUrl}&tag=${encodeURIComponent(tag)}` : baseUrl;
}
