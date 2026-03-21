import { execSync, spawn } from 'child_process';
import path from 'path';
import { isCatalogStale } from './generate-catalog';

// ─── Config ─────────────────────────────────────────────────────────────────

const ROOT_DIR = path.resolve(__dirname, '../..');

// ─── Helpers ────────────────────────────────────────────────────────────────

function printBanner() {
  console.log(`
╔══════════════════════════════════════════════╗
║       BookBite Content Pipeline              ║
║       Master Orchestrator                    ║
╚══════════════════════════════════════════════╝
  `);
}

function printStep(step: number, total: number, name: string) {
  console.log(`\n${'━'.repeat(50)}`);
  console.log(`Step ${step}/${total}: ${name}`);
  console.log(`${'━'.repeat(50)}\n`);
}

function runCommand(command: string, description: string): boolean {
  console.log(`Running: ${command}\n`);
  try {
    execSync(command, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      env: { ...process.env },
    });
    console.log(`\n[OK] ${description} completed successfully.`);
    return true;
  } catch (err: any) {
    console.error(`\n[FAIL] ${description} failed: ${err.message}`);
    return false;
  }
}

function startWorker(script: string, name: string): ReturnType<typeof spawn> {
  console.log(`Starting ${name}...`);
  const child = spawn('npx', ['tsx', script], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    env: { ...process.env },
  });
  return child;
}

// ─── Parse CLI args ─────────────────────────────────────────────────────────

interface PipelineOptions {
  books: boolean;
  catalog: boolean;
  gutenberg: boolean;
  source: boolean;
  ingest: boolean;
  ai: boolean;
  all: boolean;
  forceCatalog: boolean;
  budget: number;
  bookLimit?: number;
  gutenbergLimit?: number;
  gutenbergLang: string;
}

function parseArgs(): PipelineOptions {
  const args = process.argv.slice(2);

  const options: PipelineOptions = {
    books: args.includes('--books'),
    catalog: args.includes('--catalog'),
    gutenberg: args.includes('--gutenberg'),
    source: args.includes('--source'),
    ingest: args.includes('--ingest'),
    ai: args.includes('--ai'),
    all: args.includes('--all'),
    forceCatalog: args.includes('--force-catalog'),
    budget: 50,
    gutenbergLang: 'en',
  };

  // Parse --budget
  const budgetIdx = args.indexOf('--budget');
  if (budgetIdx !== -1 && args[budgetIdx + 1]) {
    options.budget = parseFloat(args[budgetIdx + 1]);
  }

  // Parse --book-limit
  const bookLimitIdx = args.indexOf('--book-limit');
  if (bookLimitIdx !== -1 && args[bookLimitIdx + 1]) {
    options.bookLimit = parseInt(args[bookLimitIdx + 1], 10);
  }

  // Parse --gutenberg-limit
  const limitIdx = args.indexOf('--gutenberg-limit');
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    options.gutenbergLimit = parseInt(args[limitIdx + 1], 10);
  }

  // Parse --gutenberg-lang
  const langIdx = args.indexOf('--gutenberg-lang');
  if (langIdx !== -1 && args[langIdx + 1]) {
    options.gutenbergLang = args[langIdx + 1];
  }

  // If --all, enable everything
  if (options.all) {
    options.books = true;
    options.gutenberg = true;
    options.source = true;
    options.ingest = true;
  }

  // If nothing selected, show help
  const hasSelection = options.books || options.catalog || options.gutenberg ||
    options.source || options.ingest || options.ai;
  if (!hasSelection) {
    printHelp();
    process.exit(0);
  }

  return options;
}

function printHelp() {
  console.log(`
Usage: npm run pipeline -- [flags]

Main Commands:
  --books              Process books from curated lists (data/book-lists/*.json)
                       This is the PRIMARY way to generate stories.
  --all                Run books + gutenberg + source + ingest

Other Steps:
  --catalog            Generate AI-powered catalog (uses Claude API credits)
  --gutenberg          Bulk download from Project Gutenberg
  --source             Source catalog books from public domain
  --ingest             Run ingest on downloaded files
  --ai                 Generate AI stories for ai-only books (old queue-based flow)

Options:
  --budget N           Token budget in USD (default: 50)
  --book-limit N       Max books to process
  --force-catalog      Force catalog regeneration
  --gutenberg-limit N  Limit Gutenberg downloads to N books
  --gutenberg-lang xx  Language filter for Gutenberg (default: en)

Examples:
  npm run pipeline -- --books                          # Process curated books ($50 budget)
  npm run pipeline -- --books --budget 100             # With $100 budget
  npm run pipeline -- --books --budget 20 --book-limit 5  # Quick test
  npm run pipeline -- --all --budget 100               # Everything
  npm run pipeline -- --gutenberg --gutenberg-limit 100    # 100 Gutenberg books
  `);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  printBanner();
  const options = parseArgs();

  const steps: string[] = [];
  if (options.books) steps.push('Process Books');
  if (options.catalog) steps.push('Catalog');
  if (options.gutenberg) steps.push('Gutenberg');
  if (options.source) steps.push('Source');
  if (options.ingest) steps.push('Ingest');
  if (options.ai) steps.push('AI Stories (queue)');

  console.log(`Pipeline steps: ${steps.join(' → ')}`);
  console.log(`Budget: $${options.budget.toFixed(2)}\n`);

  let currentStep = 0;
  const totalSteps = steps.length;
  const results: Record<string, boolean> = {};

  // ── Step: Process Books from Curated Lists ────────────────────────────
  if (options.books) {
    currentStep++;
    printStep(currentStep, totalSteps, 'Process Books from Curated Lists');

    let processArgs = `--budget ${options.budget}`;
    if (options.bookLimit) {
      processArgs += ` --limit ${options.bookLimit}`;
    }

    results['Process Books'] = runCommand(
      `npx tsx src/cli/process-books.ts ${processArgs}`,
      'Book processing'
    );
  }

  // ── Step: Catalog Generation ──────────────────────────────────────────
  if (options.catalog) {
    currentStep++;
    printStep(currentStep, totalSteps, 'Catalog Generation');

    const shouldRegenerate = options.forceCatalog || isCatalogStale();

    if (shouldRegenerate) {
      const forceFlag = options.forceCatalog ? ' --force' : '';
      results['Catalog'] = runCommand(
        `npx tsx src/cli/generate-catalog.ts${forceFlag}`,
        'Catalog generation'
      );
    } else {
      console.log('Catalog is up to date (less than 90 days old). Skipping.');
      console.log('Use --force-catalog to regenerate anyway.');
      results['Catalog'] = true;
    }
  }

  // ── Step: Gutenberg Bulk Download ─────────────────────────────────────
  if (options.gutenberg) {
    currentStep++;
    printStep(currentStep, totalSteps, 'Gutenberg Bulk Download');

    let gutenbergArgs = '--resume';
    gutenbergArgs += ` --lang ${options.gutenbergLang}`;
    if (options.gutenbergLimit) {
      gutenbergArgs += ` --limit ${options.gutenbergLimit}`;
    }

    results['Gutenberg'] = runCommand(
      `npx tsx src/cli/gutenberg-bulk.ts ${gutenbergArgs}`,
      'Gutenberg bulk download'
    );
  }

  // ── Step: Source Catalog Books ────────────────────────────────────────
  if (options.source) {
    currentStep++;
    printStep(currentStep, totalSteps, 'Source Catalog Books');

    results['Source'] = runCommand(
      'npx tsx src/cli/source-books.ts',
      'Book sourcing'
    );
  }

  // ── Step: Ingest Downloaded Files ────────────────────────────────────
  if (options.ingest) {
    currentStep++;
    printStep(currentStep, totalSteps, 'Ingest Downloaded Files');

    results['Ingest'] = runCommand(
      'npx tsx src/cli/ingest.ts',
      'File ingest'
    );
  }

  // ── Step: Generate AI Stories (old queue-based flow) ──────────────────
  if (options.ai) {
    currentStep++;
    printStep(currentStep, totalSteps, 'Generate AI Stories (queue)');

    const queueSuccess = runCommand(
      'npx tsx src/cli/generate-stories.ts',
      'AI story queueing'
    );

    results['AI Stories'] = queueSuccess;

    if (queueSuccess) {
      console.log('\nStarting workers...');
      console.log('Press Ctrl+C to stop.\n');

      const bookWorker = startWorker('src/pipeline/worker.ts', 'Book Processing Worker');
      const aiWorker = startWorker('src/pipeline/ai-knowledge-worker.ts', 'AI Knowledge Worker');

      const cleanup = () => {
        console.log('\nShutting down workers...');
        bookWorker.kill('SIGTERM');
        aiWorker.kill('SIGTERM');
        process.exit(0);
      };

      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);

      await new Promise<void>((resolve) => {
        let exitCount = 0;
        const onExit = () => {
          exitCount++;
          if (exitCount >= 2) resolve();
        };
        bookWorker.on('exit', onExit);
        aiWorker.on('exit', onExit);
      });
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(50)}`);
  console.log('Pipeline Summary');
  console.log(`${'═'.repeat(50)}\n`);

  for (const [step, success] of Object.entries(results)) {
    const icon = success ? '[OK]' : '[FAIL]';
    console.log(`  ${icon} ${step}`);
  }

  const failures = Object.values(results).filter((v) => !v).length;
  if (failures > 0) {
    console.log(`\n${failures} step(s) failed. Check logs above for details.\n`);
    process.exit(1);
  } else {
    console.log('\nAll steps completed successfully!\n');
    process.exit(0);
  }
}

// Entry point
main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
