export interface TextChunk {
  index: number;
  text: string;
  startOffset: number;
  endOffset: number;
  isChapterStart: boolean;
  chapterTitle?: string;
}

// Patterns that typically indicate chapter boundaries
const CHAPTER_PATTERNS = [
  /^chapter\s+\d+/im,
  /^chapter\s+[ivxlc]+/im,
  /^part\s+\d+/im,
  /^part\s+[ivxlc]+/im,
  /^section\s+\d+/im,
  /^\d+\.\s+[A-Z]/m,
  /^[A-Z][A-Z\s]{5,}$/m, // ALL CAPS headings
];

// Approximate tokens-to-characters ratio (1 token ≈ 4 chars)
const TARGET_CHUNK_TOKENS = 4000;
const TARGET_CHUNK_CHARS = TARGET_CHUNK_TOKENS * 4;
const MAX_CHUNK_CHARS = TARGET_CHUNK_CHARS * 1.5;
const MIN_CHUNK_CHARS = 500;

/**
 * Smart text chunking that respects chapter/section boundaries.
 * Aims for ~4000 token chunks to fit well within AI context windows.
 */
export function chunkText(fullText: string): TextChunk[] {
  // First, try to split by chapter boundaries
  const sections = splitByChapters(fullText);

  const chunks: TextChunk[] = [];
  let globalOffset = 0;

  for (const section of sections) {
    if (section.text.length <= MAX_CHUNK_CHARS) {
      // Section fits in one chunk
      if (section.text.length >= MIN_CHUNK_CHARS) {
        chunks.push({
          index: chunks.length,
          text: section.text,
          startOffset: globalOffset,
          endOffset: globalOffset + section.text.length,
          isChapterStart: section.isChapterStart,
          chapterTitle: section.chapterTitle,
        });
      }
    } else {
      // Section is too large — split by paragraphs
      const subChunks = splitByParagraphs(
        section.text,
        globalOffset,
        section.isChapterStart,
        section.chapterTitle
      );
      for (const sub of subChunks) {
        sub.index = chunks.length;
        chunks.push(sub);
      }
    }

    globalOffset += section.text.length;
  }

  return chunks;
}

interface Section {
  text: string;
  isChapterStart: boolean;
  chapterTitle?: string;
}

function splitByChapters(text: string): Section[] {
  const lines = text.split('\n');
  const sections: Section[] = [];
  let currentSection: string[] = [];
  let currentTitle: string | undefined;
  let isFirst = true;

  for (const line of lines) {
    const isChapterBoundary = CHAPTER_PATTERNS.some((pattern) =>
      pattern.test(line.trim())
    );

    if (isChapterBoundary && currentSection.length > 0) {
      sections.push({
        text: currentSection.join('\n').trim(),
        isChapterStart: !isFirst,
        chapterTitle: currentTitle,
      });
      currentSection = [];
      currentTitle = line.trim();
      isFirst = false;
    }

    currentSection.push(line);
  }

  // Push remaining content
  if (currentSection.length > 0) {
    sections.push({
      text: currentSection.join('\n').trim(),
      isChapterStart: sections.length === 0 ? true : false,
      chapterTitle: currentTitle,
    });
  }

  // If no chapters found, return entire text as one section
  if (sections.length === 0) {
    sections.push({
      text: text.trim(),
      isChapterStart: true,
    });
  }

  return sections;
}

function splitByParagraphs(
  text: string,
  baseOffset: number,
  isChapterStart: boolean,
  chapterTitle?: string
): TextChunk[] {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: TextChunk[] = [];
  let currentChunk = '';
  let chunkStart = baseOffset;
  let isFirst = true;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (
      currentChunk.length + trimmed.length > TARGET_CHUNK_CHARS &&
      currentChunk.length >= MIN_CHUNK_CHARS
    ) {
      // Emit current chunk
      chunks.push({
        index: 0, // will be reassigned
        text: currentChunk.trim(),
        startOffset: chunkStart,
        endOffset: chunkStart + currentChunk.length,
        isChapterStart: isFirst && isChapterStart,
        chapterTitle: isFirst ? chapterTitle : undefined,
      });
      chunkStart += currentChunk.length;
      currentChunk = '';
      isFirst = false;
    }

    currentChunk += trimmed + '\n\n';
  }

  // Emit remaining
  if (currentChunk.trim().length >= MIN_CHUNK_CHARS) {
    chunks.push({
      index: 0,
      text: currentChunk.trim(),
      startOffset: chunkStart,
      endOffset: chunkStart + currentChunk.length,
      isChapterStart: isFirst && isChapterStart,
      chapterTitle: isFirst ? chapterTitle : undefined,
    });
  } else if (chunks.length > 0 && currentChunk.trim().length > 0) {
    // Merge small remainder into last chunk
    const last = chunks[chunks.length - 1];
    last.text += '\n\n' + currentChunk.trim();
    last.endOffset += currentChunk.length;
  }

  return chunks;
}

/**
 * Extract a rough table of contents from chapter headings found in the text.
 */
export function extractTableOfContents(fullText: string): string[] {
  const lines = fullText.split('\n');
  const toc: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      CHAPTER_PATTERNS.some((p) => p.test(trimmed)) &&
      trimmed.length < 200
    ) {
      toc.push(trimmed);
    }
  }

  return toc;
}
