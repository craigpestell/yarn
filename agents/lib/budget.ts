export class BudgetExceeded extends Error {
  constructor(what: string) {
    super(`budget exceeded: ${what}`)
    this.name = 'BudgetExceeded'
  }
}

export interface BudgetLimits {
  maxTurns: number
  maxBudgetUsd: number
  /** Max number of LLM calls in one run. */
  maxCalls?: number
}

/** Shared run-wide cap on LLM turns, spend and calls. Each call asks for its remaining allowance first. */
export class Budget {
  turns = 0
  usd = 0
  calls = 0
  constructor(readonly limits: BudgetLimits) {}

  remaining() {
    return {
      turns: this.limits.maxTurns - this.turns,
      usd: this.limits.maxBudgetUsd - this.usd,
      calls: (this.limits.maxCalls ?? 50) - this.calls,
    }
  }
  /** Call before each LLM call; throws when nothing is left. */
  start(): { maxTurns: number; maxBudgetUsd: number } {
    const r = this.remaining()
    if (r.calls <= 0) throw new BudgetExceeded('calls')
    if (r.turns <= 0) throw new BudgetExceeded('turns')
    if (r.usd <= 0) throw new BudgetExceeded('usd')
    this.calls++
    return { maxTurns: r.turns, maxBudgetUsd: r.usd }
  }
  /** Record usage after a call. */
  record(turns: number, usd: number) {
    this.turns += turns
    this.usd += usd
  }
}
