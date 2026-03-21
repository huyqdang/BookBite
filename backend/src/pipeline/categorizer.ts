/**
 * Normalize and validate book categories against our known set.
 */

export const VALID_CATEGORIES = [
  'Self-Help',
  'Business',
  'Biography',
  'Psychology',
  'Science',
  'Philosophy',
  'History',
  'Fiction',
  'Technology',
  'Health',
  'Romance',
  'Spirituality',
  'Economics',
  'Sociology',
  'Education',
  'Creativity',
] as const;

export type BookCategory = (typeof VALID_CATEGORIES)[number];

/**
 * Normalize AI-detected categories to our canonical set.
 * Handles fuzzy matching and common variations.
 */
export function normalizeCategories(rawCategories: string[]): string[] {
  const categoryMap: Record<string, string> = {
    'self help': 'Self-Help',
    'self-help': 'Self-Help',
    'selfhelp': 'Self-Help',
    'personal development': 'Self-Help',
    'business': 'Business',
    'entrepreneurship': 'Business',
    'management': 'Business',
    'leadership': 'Business',
    'finance': 'Business',
    'biography': 'Biography',
    'autobiography': 'Biography',
    'romance': 'Romance',
    'love story': 'Romance',
    'romantic': 'Romance',
    'psychology': 'Psychology',
    'behavioral science': 'Psychology',
    'neuroscience': 'Science',
    'science': 'Science',
    'physics': 'Science',
    'biology': 'Science',
    'philosophy': 'Philosophy',
    'ethics': 'Philosophy',
    'history': 'History',
    'historical': 'History',
    'fiction': 'Fiction',
    'novel': 'Fiction',
    'literary fiction': 'Fiction',
    'technology': 'Technology',
    'tech': 'Technology',
    'programming': 'Technology',
    'health': 'Health',
    'wellness': 'Health',
    'fitness': 'Health',
    'nutrition': 'Health',
    'spirituality': 'Spirituality',
    'religion': 'Spirituality',
    'mindfulness': 'Spirituality',
    'economics': 'Economics',
    'sociology': 'Sociology',
    'social science': 'Sociology',
    'education': 'Education',
    'learning': 'Education',
    'creativity': 'Creativity',
    'art': 'Creativity',
    'design': 'Creativity',
  };

  const normalized = new Set<string>();

  for (const raw of rawCategories) {
    const lower = raw.toLowerCase().trim();

    if (categoryMap[lower]) {
      normalized.add(categoryMap[lower]);
    } else {
      // Check if it matches any valid category directly
      const directMatch = VALID_CATEGORIES.find(
        (c) => c.toLowerCase() === lower
      );
      if (directMatch) {
        normalized.add(directMatch);
      }
    }
  }

  return Array.from(normalized);
}
