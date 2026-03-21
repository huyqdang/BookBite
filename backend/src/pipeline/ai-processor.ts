import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { env } from '../config/env';

// ─── AI Client Setup ────────────────────────────────────────────────────────

let anthropic: Anthropic | null = null;
let openai: OpenAI | null = null;

function getAnthropic(): Anthropic {
  if (!anthropic) {
    if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
    anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return anthropic;
}

function getOpenAI(): OpenAI {
  if (!openai) {
    if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
    openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return openai;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BookAnalysis {
  categories: string[];
  structure: string;
  storyDensity: 'high' | 'medium' | 'low';
  bookType: string;
}

export interface StoryCandidate {
  id: number;
  title: string;
  description: string;
  approximateLocation: string;
  type: 'anecdote' | 'case_study' | 'example' | 'parable' | 'historical' | 'personal' | 'dialogue' | 'other';
  optimalReadingTime: 1 | 3 | 5 | 10;
}

export interface ExtractedStory {
  title: string;
  content: string;
  tone: string;
  categories: string[];
  styleSeed: string;
  readingTimeMinutes: number;
  wordCount: number;
}

// ─── Style Variety ──────────────────────────────────────────────────────────

const OPENING_HOOKS = [
  'question',
  'bold_statement',
  'in_medias_res',
  'scene_setting',
  'dialogue',
];

const NARRATIVE_VOICES = [
  'third_person_omniscient',
  'close_third_person',
  'second_person',
  'storyteller',
];

const PACING_STYLES = ['fast_punchy', 'slow_burn', 'building_tension', 'reflective'];

const ENDING_STYLES = [
  'resolution',
  'cliffhanger',
  'reflection_prompt',
  'callback_to_opening',
  'open_ended',
];

function getRandomStyleSeed(): string {
  const hook = OPENING_HOOKS[Math.floor(Math.random() * OPENING_HOOKS.length)];
  const voice = NARRATIVE_VOICES[Math.floor(Math.random() * NARRATIVE_VOICES.length)];
  const pacing = PACING_STYLES[Math.floor(Math.random() * PACING_STYLES.length)];
  const ending = ENDING_STYLES[Math.floor(Math.random() * ENDING_STYLES.length)];
  return `${hook}|${voice}|${pacing}|${ending}`;
}

// ─── AI Call with Fallback ──────────────────────────────────────────────────

async function aiCall(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 4096
): Promise<string> {
  // Try Claude first
  if (env.ANTHROPIC_API_KEY) {
    try {
      const client = getAnthropic();
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });
      const block = response.content[0];
      if (block.type === 'text') return block.text;
    } catch (err: any) {
      console.warn(`[AI] Claude failed: ${err.message}, falling back to OpenAI`);
    }
  }

  // Fallback to OpenAI
  if (env.OPENAI_API_KEY) {
    try {
      const client = getOpenAI();
      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });
      return response.choices[0]?.message?.content || '';
    } catch (err: any) {
      console.warn(`[AI] OpenAI failed: ${err.message}`);
    }
  }

  throw new Error('No AI provider available. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.');
}

// ─── Pass 1: Book Analysis ──────────────────────────────────────────────────

export async function analyzeBook(
  sampleText: string,
  fileName: string
): Promise<BookAnalysis> {
  const systemPrompt = `You are a book analyst. Given a sample of text from a book, analyze its properties. Respond in valid JSON only, no markdown.`;

  const userPrompt = `Analyze this book (filename: "${fileName}"). Here is a sample from the beginning:

---
${sampleText.slice(0, 5000)}
---

Return JSON with this exact structure:
{
  "categories": ["Category1", "Category2", ...],
  "structure": "brief description of how the book is structured",
  "storyDensity": "high" | "medium" | "low",
  "bookType": "e.g. narrative non-fiction, self-help, novel, biography, etc."
}

Valid categories: Self-Help, Business, Biography, Psychology, Science, Philosophy, History, Fiction, Technology, Health, Memoir, Spirituality, Economics, Sociology, Education, Creativity`;

  const response = await aiCall(systemPrompt, userPrompt, 1024);

  try {
    return JSON.parse(response.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
  } catch {
    return {
      categories: ['Self-Help'],
      structure: 'Unknown',
      storyDensity: 'medium',
      bookType: 'non-fiction',
    };
  }
}

// ─── Pass 2: Story Discovery ────────────────────────────────────────────────

export async function discoverStories(
  chunkText: string,
  bookAnalysis: BookAnalysis,
  chunkIndex: number
): Promise<StoryCandidate[]> {
  const systemPrompt = `You are a master story hunter. Your job is to identify EVERY possible story, anecdote, example, case study, parable, or meaningful narrative in a given text chunk. Be exhaustive — find even subtle examples that others might miss. Respond in valid JSON only, no markdown.`;

  const userPrompt = `This is chunk #${chunkIndex} from a ${bookAnalysis.bookType} book (categories: ${bookAnalysis.categories.join(', ')}).

Identify ALL story candidates — anecdotes, case studies, examples, parables, historical events, personal stories, dialogue scenes, metaphors with narrative structure, studies/experiments, any passage with characters or a point being illustrated.

Be aggressive in identifying candidates. It's better to over-identify than miss stories.

IMPORTANT: Each story should be a UNIQUE, different narrative — not the same idea retold. For each story, assign an "optimalReadingTime" based on how much depth and complexity the story naturally has:
- 1 min: Quick punchy insight, a single powerful moment, a micro-anecdote, a surprising fact with context
- 3 min: A full story arc with setup, conflict, resolution — the sweet spot for most anecdotes and examples
- 5 min: Rich narrative with scene-setting, character development, and layered meaning
- 10 min: Epic, complex stories spanning multiple events, deep character arcs, or multi-layered case studies

Match the reading time to the story's NATURAL depth — don't stretch a simple anecdote to 10 min or compress an epic saga to 1 min.

Text chunk:
---
${chunkText}
---

Return a JSON array:
[
  {
    "id": 1,
    "title": "Short descriptive title",
    "description": "1-2 sentence description of the story/example",
    "approximateLocation": "beginning/middle/end of chunk",
    "type": "anecdote|case_study|example|parable|historical|personal|dialogue|other",
    "optimalReadingTime": 3
  }
]

Return an empty array [] if no story candidates are found.`;

  const response = await aiCall(systemPrompt, userPrompt, 2048);

  try {
    const parsed = JSON.parse(
      response.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    );
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── Pass 3: Deep Story Extraction ──────────────────────────────────────────

export async function extractStory(
  chunkText: string,
  candidate: StoryCandidate,
  bookAnalysis: BookAnalysis,
  bookTitle: string,
  bookAuthor: string
): Promise<ExtractedStory | null> {
  const styleSeed = getRandomStyleSeed();
  const [hook, voice, pacing, ending] = styleSeed.split('|');

  const systemPrompt = `You are a world-class storyteller who rewrites book excerpts into engaging, standalone stories. Your writing is vivid, direct, and captivating. Each story should work on its own without needing the reader to know the book.

STYLE INSTRUCTIONS for this story:
- Opening hook style: ${hook.replace(/_/g, ' ')}
- Narrative voice: ${voice.replace(/_/g, ' ')}
- Pacing: ${pacing.replace(/_/g, ' ')}
- Ending style: ${ending.replace(/_/g, ' ')}

Write in a way that is engaging and varied — NOT cookie-cutter. The story should feel alive and human.

Respond in valid JSON only, no markdown.`;

  // Word count targets based on optimal reading time
  const wordTargets: Record<number, { min: number; max: number; description: string }> = {
    1: { min: 150, max: 220, description: 'Ultra-tight. Hook + core point + powerful takeaway. Every word must earn its place. Punchy and memorable.' },
    3: { min: 450, max: 650, description: 'Full story arc with engaging detail, vivid scenes, and a satisfying resolution.' },
    5: { min: 750, max: 1050, description: 'Rich storytelling with scene-setting, character depth, multiple beats, and layered meaning.' },
    10: { min: 1500, max: 2100, description: 'Immersive deep read. Full context, atmosphere, multiple narrative threads, and deeply satisfying resolution.' },
  };

  const readingTime = candidate.optimalReadingTime || 3;
  const target = wordTargets[readingTime] || wordTargets[3];

  const userPrompt = `From the book "${bookTitle}" by ${bookAuthor} (${bookAnalysis.bookType}), extract and rewrite this story:

Story to extract: "${candidate.title}" — ${candidate.description}

Source text (use this as your raw material, but REWRITE it in your own engaging style):
---
${chunkText}
---

TARGET READING TIME: ${readingTime} minute(s) (~${target.min}-${target.max} words)
WRITING STYLE: ${target.description}

Return JSON:
{
  "title": "Engaging story title",
  "content": "The full rewritten story at ${target.min}-${target.max} words. Start directly: 'A man named...', 'In 2003...', 'Imagine you...' etc. Make it engaging and standalone.",
  "tone": "one of: inspiring, cautionary, humorous, dramatic, philosophical, educational, provocative, heartwarming",
  "categories": ${JSON.stringify(bookAnalysis.categories)}
}

IMPORTANT: Write EXACTLY for the ${readingTime}-minute reading time. The content must be ${target.min}-${target.max} words — this is the optimal format for this particular story.`;

  const maxTokens = readingTime >= 10 ? 6144 : readingTime >= 5 ? 4096 : 2048;
  const response = await aiCall(systemPrompt, userPrompt, maxTokens);

  try {
    const parsed = JSON.parse(
      response.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    );
    const content = parsed.content || '';
    return {
      title: parsed.title || candidate.title,
      content,
      tone: parsed.tone || 'inspiring',
      categories: parsed.categories || bookAnalysis.categories,
      styleSeed,
      readingTimeMinutes: readingTime,
      wordCount: content.split(/\s+/).length,
    };
  } catch {
    return null;
  }
}

// ─── Pass 4: REMOVED ────────────────────────────────────────────────────────
//
// The old "generateVariants" pass created 4 copies of the same story at
// different word counts (1/3/5/10 min). This caused users with multiple
// reading times selected to see the same narrative repeated.
//
// Now, each story is discovered with an optimal reading time in Pass 2,
// and written at exactly that length in Pass 3. Every story in the DB
// is a unique narrative — no duplicates across reading times.

// ─── Pass 5: Cross-Reference Sweep ──────────────────────────────────────────

export async function crossReferenceSweep(
  tableOfContents: string[],
  extractedStoryTitles: string[],
  bookAnalysis: BookAnalysis,
  bookTitle: string,
  fullTextSample: string
): Promise<StoryCandidate[]> {
  const systemPrompt = `You are a thorough book analyst looking for stories that might have been missed during an initial extraction pass. Respond in valid JSON only, no markdown.`;

  const userPrompt = `We've been extracting stories from "${bookTitle}" (${bookAnalysis.bookType}).

Table of Contents / Chapter Headings:
${tableOfContents.length > 0 ? tableOfContents.join('\n') : '(none detected)'}

Stories already extracted:
${extractedStoryTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Here's a sample from parts of the book we may have missed:
---
${fullTextSample.slice(0, 6000)}
---

Based on the book type (${bookAnalysis.bookType}) and the chapters listed, what stories, examples, anecdotes, or meaningful narratives might we have MISSED?

Think about:
- Stories that span multiple chapters
- Subtle examples embedded in theoretical sections
- The author's personal experiences
- Historical events used as illustration
- Recurring metaphors or analogies with narrative structure

Return a JSON array of missed story candidates (same format as before):
[
  {
    "id": 1,
    "title": "Story title",
    "description": "Description",
    "approximateLocation": "Which chapter/section",
    "type": "anecdote|case_study|example|parable|historical|personal|dialogue|other"
  }
]

Return an empty array [] if you think we've covered everything.`;

  const response = await aiCall(systemPrompt, userPrompt, 2048);

  try {
    const parsed = JSON.parse(
      response.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    );
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
