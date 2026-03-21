import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { env } from '../config/env';
import { getTokenTracker } from '../utils/token-tracker';
import type { StoryCandidate, ExtractedStory } from './ai-processor';

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

// ─── Style Variety ──────────────────────────────────────────────────────────

const OPENING_HOOKS = [
  'question',
  'bold_statement',
  'in_medias_res',
  'scene_setting',
  'dialogue',
  'surprising_fact',
  'provocative_claim',
];

const NARRATIVE_VOICES = [
  'third_person_omniscient',
  'close_third_person',
  'second_person',
  'storyteller',
  'intimate_confessional',
];

const PACING_STYLES = [
  'fast_punchy',
  'slow_burn',
  'building_tension',
  'reflective',
  'rhythmic_alternating',
];

const ENDING_STYLES = [
  'resolution',
  'cliffhanger',
  'reflection_prompt',
  'callback_to_opening',
  'open_ended',
  'powerful_takeaway',
  'thought_provoking_question',
];

export function getRandomStyleSeed(): string {
  const hook = OPENING_HOOKS[Math.floor(Math.random() * OPENING_HOOKS.length)];
  const voice = NARRATIVE_VOICES[Math.floor(Math.random() * NARRATIVE_VOICES.length)];
  const pacing = PACING_STYLES[Math.floor(Math.random() * PACING_STYLES.length)];
  const ending = ENDING_STYLES[Math.floor(Math.random() * ENDING_STYLES.length)];
  return `${hook}|${voice}|${pacing}|${ending}`;
}

// ─── AI Call with Fallback + Token Tracking ─────────────────────────────────

async function aiCall(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 4096
): Promise<string> {
  const tracker = getTokenTracker();

  // Check budget before making the call
  if (tracker && !tracker.hasBudget()) {
    const { BudgetExhaustedError } = await import('../utils/token-tracker');
    const stats = tracker.getStats();
    throw new BudgetExhaustedError(
      stats.spent,
      stats.budget,
      stats.claudeInput + stats.openaiInput,
      stats.claudeOutput + stats.openaiOutput
    );
  }

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

      // Track token usage
      if (tracker && response.usage) {
        tracker.recordClaude(
          response.usage.input_tokens,
          response.usage.output_tokens
        );
      }

      const block = response.content[0];
      if (block.type === 'text') return block.text;
    } catch (err: any) {
      // Re-throw budget errors
      if (err.name === 'BudgetExhaustedError') throw err;

      // Check if it's a rate limit or billing error — stop the pipeline
      if (err.status === 429 || err.status === 402) {
        throw new Error(`API limit reached (${err.status}): ${err.message}`);
      }

      console.warn(`[AI-Knowledge] Claude failed: ${err.message}, falling back to OpenAI`);
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

      // Track token usage
      if (tracker && response.usage) {
        tracker.recordOpenAI(
          response.usage.prompt_tokens || 0,
          response.usage.completion_tokens || 0
        );
      }

      return response.choices[0]?.message?.content || '';
    } catch (err: any) {
      if (err.name === 'BudgetExhaustedError') throw err;

      if (err.status === 429 || err.status === 402) {
        throw new Error(`API limit reached (${err.status}): ${err.message}`);
      }

      console.warn(`[AI-Knowledge] OpenAI failed: ${err.message}`);
    }
  }

  throw new Error('No AI provider available. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.');
}

// ─── Multi-Pass Discovery: 50+ Stories per Book ─────────────────────────────

/**
 * Discovers stories in multiple passes to hit 50+ unique candidates:
 *   Pass A: Core stories — the major examples, anecdotes, case studies
 *   Pass B: Deep dive — subtle stories, personal narratives, hidden gems
 *   Pass C: Gap fill — anything missed, cross-chapter themes, meta-narratives
 */
export async function discoverStoriesFromKnowledge(
  title: string,
  author: string,
  categories: string[]
): Promise<StoryCandidate[]> {
  const allCandidates: StoryCandidate[] = [];
  const seenTitles = new Set<string>();

  // ── Pass A: Core stories (aim for 20-25) ──────────────────────────────
  console.log(`    Discovery Pass A: Core stories...`);
  const passA = await discoverPassA(title, author, categories);
  for (const c of passA) {
    const key = c.title.toLowerCase().trim();
    if (!seenTitles.has(key)) {
      seenTitles.add(key);
      allCandidates.push(c);
    }
  }
  console.log(`      → ${passA.length} found, ${allCandidates.length} total unique`);

  // ── Pass B: Deep dive (aim for 20-25 more) ────────────────────────────
  console.log(`    Discovery Pass B: Deep dive...`);
  const passB = await discoverPassB(title, author, categories, allCandidates);
  for (const c of passB) {
    const key = c.title.toLowerCase().trim();
    if (!seenTitles.has(key)) {
      seenTitles.add(key);
      allCandidates.push({ ...c, id: allCandidates.length + 1 });
    }
  }
  console.log(`      → ${passB.length} found, ${allCandidates.length} total unique`);

  // ── Pass C: Gap fill if we haven't hit 50 yet ─────────────────────────
  if (allCandidates.length < 50) {
    console.log(`    Discovery Pass C: Gap fill...`);
    const passC = await discoverPassC(title, author, categories, allCandidates);
    for (const c of passC) {
      const key = c.title.toLowerCase().trim();
      if (!seenTitles.has(key)) {
        seenTitles.add(key);
        allCandidates.push({ ...c, id: allCandidates.length + 1 });
      }
    }
    console.log(`      → ${passC.length} found, ${allCandidates.length} total unique`);
  }

  console.log(`    Discovery complete: ${allCandidates.length} unique story candidates`);
  return allCandidates;
}

async function discoverPassA(
  title: string,
  author: string,
  categories: string[]
): Promise<StoryCandidate[]> {
  const systemPrompt = `You are a literary expert with encyclopedic knowledge of published books. You extract the most valuable, engaging stories from books — the kind that make people stop scrolling and read. Respond in valid JSON only, no markdown.`;

  const userPrompt = `For the book "${title}" by ${author} (categories: ${categories.join(', ')}), extract ALL the core stories, examples, and anecdotes that deliver real value.

WHAT WE'RE LOOKING FOR:
Every story must deliver at least one of:
- A powerful LESSON the reader can apply to their life
- An actionable INSIGHT or strategy
- A perspective-shifting REVELATION
- A deeply engaging NARRATIVE that entertains AND educates

TYPES TO INCLUDE:
- Real-world case studies and experiments with surprising results
- Personal stories from the author or people in the book
- Historical events that illuminate a key principle
- Anecdotes that make abstract ideas concrete and relatable
- "Aha moment" examples that change how you see the world
- Cautionary tales and failure stories
- Transformation stories (before/after)
- Counter-intuitive examples that challenge assumptions

TITLE REQUIREMENTS:
Each story title must be CATCHY and MEANINGFUL — like a headline that makes you want to read more. NOT generic ("Chapter 3 Story") but specific and intriguing ("The Surgeon Who Operated on the Wrong Patient" or "Why a Stanford Professor Gave Up His Tenure").

For each story, assign an optimalReadingTime based on natural depth:
- 1 min: Quick punchy insight or surprising fact (aim for ~5-8 of these)
- 3 min: Full story arc (aim for ~8-10 of these)
- 5 min: Rich narrative with layers (aim for ~5-7 of these)
- 10 min: Epic deep story (aim for ~2-3 of these)

Return 20-25 story candidates as a JSON array:
[
  {
    "id": 1,
    "title": "Catchy, specific, intriguing title",
    "description": "2-3 sentences: what happens, what the value/lesson is, why it's engaging",
    "approximateLocation": "Which part of the book",
    "type": "anecdote|case_study|example|parable|historical|personal|dialogue|other",
    "optimalReadingTime": 3
  }
]`;

  const response = await aiCall(systemPrompt, userPrompt, 6144);
  try {
    const parsed = JSON.parse(response.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

async function discoverPassB(
  title: string,
  author: string,
  categories: string[],
  existingCandidates: StoryCandidate[]
): Promise<StoryCandidate[]> {
  const existingTitles = existingCandidates.map((c) => c.title).join('\n- ');

  const systemPrompt = `You are a literary detective who finds the hidden gems in books — the subtle stories, surprising examples, and overlooked narratives that most people miss on a first read. Respond in valid JSON only, no markdown.`;

  const userPrompt = `We've already found these stories from "${title}" by ${author}:
- ${existingTitles}

Now dig DEEPER. Find 20-25 MORE stories we MISSED. Look for:

1. SUBTLE EXAMPLES embedded in theoretical or explanatory sections
2. SECONDARY CHARACTERS or supporting stories often overlooked
3. The author's PERSONAL experiences and behind-the-scenes moments
4. RESEARCH STUDIES and experiments mentioned in passing
5. ANALOGIES and METAPHORS with narrative structure
6. Stories from the INTRODUCTION, CONCLUSION, or FOOTNOTES
7. COUNTER-EXAMPLES or contrasting cases the author uses
8. Brief but powerful QUOTES or DIALOGUES with context
9. HISTORICAL CONTEXT the author weaves through the book
10. Cross-chapter THEMES that tell a story when connected

Each story MUST deliver a value, lesson, or actionable insight. No filler stories.

TITLE REQUIREMENTS: Catchy, specific, scroll-stopping. Like a great article headline.

Assign optimalReadingTime: 1, 3, 5, or 10 minutes based on natural depth.
Aim for a good mix: ~6 at 1min, ~8 at 3min, ~5 at 5min, ~2 at 10min.

Return 20-25 candidates as JSON array:
[
  {
    "id": 1,
    "title": "Catchy, specific title",
    "description": "What happens, what's the value/lesson",
    "approximateLocation": "Where in the book",
    "type": "anecdote|case_study|example|parable|historical|personal|dialogue|other",
    "optimalReadingTime": 3
  }
]`;

  const response = await aiCall(systemPrompt, userPrompt, 6144);
  try {
    const parsed = JSON.parse(response.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

async function discoverPassC(
  title: string,
  author: string,
  categories: string[],
  existingCandidates: StoryCandidate[]
): Promise<StoryCandidate[]> {
  const existingTitles = existingCandidates.map((c) => c.title).join('\n- ');
  const currentCount = existingCandidates.length;
  const needed = Math.max(10, 50 - currentCount);

  const systemPrompt = `You are a master curator who ensures complete coverage of a book's most valuable content. You find every last gem. Respond in valid JSON only, no markdown.`;

  const userPrompt = `We have ${currentCount} stories from "${title}" by ${author} so far:
- ${existingTitles}

We need at least ${needed} MORE unique stories to reach 50 total. Think creatively:

1. What THEMES or BIG IDEAS from the book haven't been covered as stories yet?
2. Are there any CHAPTER-SPANNING narratives that tell a bigger story?
3. What about the book's OPENING and CLOSING — are there stories there?
4. Any REAL-WORLD APPLICATIONS or modern examples the author mentions?
5. What would a superfan of this book say we missed?
6. Think about QUICK INSIGHTS (1-min reads) — short, punchy facts or revelations
7. Any CONTROVERSIAL or SURPRISING claims the author makes that could be a story?

Every story must deliver VALUE — a lesson, insight, or actionable takeaway.
Titles must be catchy and specific — like magazine headlines.

Return ${needed}+ candidates as JSON array:
[
  {
    "id": 1,
    "title": "Catchy, specific title",
    "description": "What happens, what's the value/lesson",
    "approximateLocation": "Where in the book",
    "type": "anecdote|case_study|example|parable|historical|personal|dialogue|other",
    "optimalReadingTime": 3
  }
]`;

  const response = await aiCall(systemPrompt, userPrompt, 6144);
  try {
    const parsed = JSON.parse(response.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

// ─── Generate Story from AI Knowledge ───────────────────────────────────────

export async function generateStoryFromKnowledge(
  title: string,
  author: string,
  candidate: StoryCandidate,
  categories: string[]
): Promise<ExtractedStory | null> {
  const styleSeed = getRandomStyleSeed();
  const [hook, voice, pacing, ending] = styleSeed.split('|');

  const systemPrompt = `You are a world-class storyteller who transforms book knowledge into captivating content people can't stop reading. You tell stories IN YOUR OWN WORDS — never summarizing, always narrating.

CRITICAL RULES:
- Tell this story IN YOUR OWN WORDS as if you lived it or witnessed it firsthand
- Open with a hook that STOPS THE SCROLL — no "In the book..." or "According to..."
- Start directly: "A man named...", "In 2003...", "Picture this...", "The night before..."
- Every story must DELIVER VALUE: a lesson, insight, or actionable takeaway
- The value should emerge NATURALLY from the narrative, not as a bolted-on moral
- Never sound like a book report, summary, or essay
- Make it ENGAGING — the reader should feel something (surprised, inspired, motivated, challenged)
- Each story must work 100% standalone

STYLE INSTRUCTIONS:
- Opening hook: ${hook.replace(/_/g, ' ')}
- Narrative voice: ${voice.replace(/_/g, ' ')}
- Pacing: ${pacing.replace(/_/g, ' ')}
- Ending: ${ending.replace(/_/g, ' ')}

Respond in valid JSON only, no markdown.`;

  const wordTargets: Record<number, { min: number; max: number; description: string }> = {
    1: { min: 150, max: 220, description: 'Ultra-tight. Hook + core insight + powerful takeaway. Every word earns its place.' },
    3: { min: 450, max: 650, description: 'Full story arc with vivid detail and a clear lesson or insight.' },
    5: { min: 750, max: 1050, description: 'Rich narrative with scene-setting, characters, and layered value.' },
    10: { min: 1500, max: 2100, description: 'Immersive deep read with full context, atmosphere, and deeply satisfying payoff.' },
  };

  const readingTime = candidate.optimalReadingTime || 3;
  const target = wordTargets[readingTime] || wordTargets[3];

  const userPrompt = `From the book "${title}" by ${author}, tell this story IN YOUR OWN WORDS:

Story: "${candidate.title}"
What happens: ${candidate.description}
Type: ${candidate.type}

TARGET: ${readingTime} minute read (~${target.min}-${target.max} words)
STYLE: ${target.description}

REQUIREMENTS:
1. CATCHY TITLE — not generic, but specific and intriguing (like a great headline)
2. ENGAGING NARRATIVE — told in your own words, not summarized
3. DELIVERS VALUE — the reader walks away with a lesson, insight, or actionable idea
4. STANDALONE — works without knowing the book

Return JSON:
{
  "title": "Catchy, meaningful, specific title that makes you want to read",
  "content": "The story in ${target.min}-${target.max} words. In your own words. Engaging. Delivers value.",
  "tone": "inspiring|cautionary|humorous|dramatic|philosophical|educational|provocative|heartwarming",
  "categories": ${JSON.stringify(categories)}
}`;

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
      categories: parsed.categories || categories,
      styleSeed,
      readingTimeMinutes: readingTime,
      wordCount: content.split(/\s+/).length,
    };
  } catch {
    return null;
  }
}
