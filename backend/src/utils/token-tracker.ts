/**
 * Token Budget Tracker
 *
 * Monitors AI token usage across Claude and OpenAI API calls.
 * When the estimated cost reaches the configured budget limit,
 * throws a BudgetExhaustedError so the pipeline can stop gracefully.
 *
 * Pricing (as of early 2026):
 *   Claude Sonnet: $3/1M input, $15/1M output
 *   GPT-4o:        $2.50/1M input, $10/1M output
 */

// ─── Pricing ────────────────────────────────────────────────────────────────

const PRICING = {
  claude: {
    inputPer1M: 3.0,
    outputPer1M: 15.0,
  },
  openai: {
    inputPer1M: 2.5,
    outputPer1M: 10.0,
  },
} as const;

// ─── Error ──────────────────────────────────────────────────────────────────

export class BudgetExhaustedError extends Error {
  constructor(
    public spent: number,
    public budget: number,
    public totalInputTokens: number,
    public totalOutputTokens: number
  ) {
    super(
      `Token budget exhausted: $${spent.toFixed(2)} spent of $${budget.toFixed(2)} budget ` +
      `(${totalInputTokens.toLocaleString()} input + ${totalOutputTokens.toLocaleString()} output tokens)`
    );
    this.name = 'BudgetExhaustedError';
  }
}

// ─── Tracker ────────────────────────────────────────────────────────────────

export class TokenTracker {
  private budgetUsd: number;
  private claudeInput = 0;
  private claudeOutput = 0;
  private openaiInput = 0;
  private openaiOutput = 0;
  private callCount = 0;

  constructor(budgetUsd: number) {
    this.budgetUsd = budgetUsd;
    console.log(`[TokenTracker] Budget: $${budgetUsd.toFixed(2)}`);
  }

  /**
   * Record token usage from a Claude API call.
   * Throws BudgetExhaustedError if budget is exceeded.
   */
  recordClaude(inputTokens: number, outputTokens: number): void {
    this.claudeInput += inputTokens;
    this.claudeOutput += outputTokens;
    this.callCount++;
    this.checkBudget();
  }

  /**
   * Record token usage from an OpenAI API call.
   * Throws BudgetExhaustedError if budget is exceeded.
   */
  recordOpenAI(inputTokens: number, outputTokens: number): void {
    this.openaiInput += inputTokens;
    this.openaiOutput += outputTokens;
    this.callCount++;
    this.checkBudget();
  }

  /**
   * Get the current estimated cost in USD.
   */
  getSpent(): number {
    const claudeCost =
      (this.claudeInput / 1_000_000) * PRICING.claude.inputPer1M +
      (this.claudeOutput / 1_000_000) * PRICING.claude.outputPer1M;

    const openaiCost =
      (this.openaiInput / 1_000_000) * PRICING.openai.inputPer1M +
      (this.openaiOutput / 1_000_000) * PRICING.openai.outputPer1M;

    return claudeCost + openaiCost;
  }

  /**
   * Get remaining budget in USD.
   */
  getRemaining(): number {
    return Math.max(0, this.budgetUsd - this.getSpent());
  }

  /**
   * Check if we still have budget left (without throwing).
   */
  hasBudget(): boolean {
    return this.getSpent() < this.budgetUsd;
  }

  /**
   * Print a summary of token usage.
   */
  printSummary(): void {
    const spent = this.getSpent();
    console.log('\n─── Token Usage Summary ───');
    console.log(`  API calls:      ${this.callCount}`);
    console.log(`  Claude tokens:  ${this.claudeInput.toLocaleString()} in / ${this.claudeOutput.toLocaleString()} out`);
    console.log(`  OpenAI tokens:  ${this.openaiInput.toLocaleString()} in / ${this.openaiOutput.toLocaleString()} out`);
    console.log(`  Estimated cost: $${spent.toFixed(2)} / $${this.budgetUsd.toFixed(2)}`);
    console.log(`  Remaining:      $${this.getRemaining().toFixed(2)}`);
    console.log('───────────────────────────\n');
  }

  /**
   * Get stats as an object (for programmatic use).
   */
  getStats() {
    return {
      callCount: this.callCount,
      claudeInput: this.claudeInput,
      claudeOutput: this.claudeOutput,
      openaiInput: this.openaiInput,
      openaiOutput: this.openaiOutput,
      spent: this.getSpent(),
      budget: this.budgetUsd,
      remaining: this.getRemaining(),
    };
  }

  private checkBudget(): void {
    const spent = this.getSpent();
    if (spent >= this.budgetUsd) {
      throw new BudgetExhaustedError(
        spent,
        this.budgetUsd,
        this.claudeInput + this.openaiInput,
        this.claudeOutput + this.openaiOutput
      );
    }

    // Log progress every 10 calls
    if (this.callCount % 10 === 0) {
      console.log(
        `[TokenTracker] ${this.callCount} calls — $${spent.toFixed(2)} / $${this.budgetUsd.toFixed(2)} spent`
      );
    }
  }
}

// ─── Global singleton (set by pipeline, used by AI processors) ──────────────

let globalTracker: TokenTracker | null = null;

export function initTokenTracker(budgetUsd: number): TokenTracker {
  globalTracker = new TokenTracker(budgetUsd);
  return globalTracker;
}

export function getTokenTracker(): TokenTracker | null {
  return globalTracker;
}
