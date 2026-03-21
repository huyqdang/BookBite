import fs from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';

export interface ExtractedText {
  text: string;
  pageCount: number;
  metadata: {
    title?: string;
    author?: string;
  };
}

/**
 * Extract text content from PDF or TXT files
 */
export async function extractText(
  filePath: string,
  fileType: 'pdf' | 'txt'
): Promise<ExtractedText> {
  const absPath = path.resolve(filePath);

  if (!fs.existsSync(absPath)) {
    throw new Error(`File not found: ${absPath}`);
  }

  if (fileType === 'txt') {
    const text = fs.readFileSync(absPath, 'utf-8');
    return {
      text,
      pageCount: Math.ceil(text.length / 3000), // rough estimate
      metadata: {},
    };
  }

  // PDF extraction using pdf-parse v3 API
  const dataBuffer = fs.readFileSync(absPath);
  const parser = new PDFParse({ data: new Uint8Array(dataBuffer) });

  try {
    // Get text
    const textResult = await parser.getText();
    const fullText = textResult.text || '';

    // Get metadata
    let title: string | undefined;
    let author: string | undefined;
    let pageCount = 0;

    try {
      const info = await parser.getInfo();
      title = info.info?.Title || undefined;
      author = info.info?.Author || undefined;
      pageCount = textResult.pages?.length || 0;
    } catch {
      // Metadata extraction can fail on some PDFs
    }

    await parser.destroy();

    return {
      text: fullText,
      pageCount,
      metadata: { title, author },
    };
  } catch (error) {
    await parser.destroy().catch(() => {});
    throw error;
  }
}
