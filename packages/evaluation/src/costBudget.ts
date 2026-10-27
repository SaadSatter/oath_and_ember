/** Explicit prices come from the run manifest, never guessed or inferred as zero. */
export interface CostPolicy {
  maximumUsd: number;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  source: string;
}
export class CostBudget {
  private charged = 0;
  constructor(readonly policy: CostPolicy) {
    for (const n of [
      policy.maximumUsd,
      policy.inputUsdPerMillion,
      policy.outputUsdPerMillion,
    ])
      if (!Number.isFinite(n) || n <= 0)
        throw Error("Positive spend cap and explicit token prices required");
    if (!policy.source.trim()) throw Error("Pricing provenance required");
  }
  reserve(inputBound: number, outputBound: number) {
    const usd =
      (inputBound * this.policy.inputUsdPerMillion +
        outputBound * this.policy.outputUsdPerMillion) /
      1e6;
    if (this.charged + usd > this.policy.maximumUsd)
      throw Error("dollar_budget");
    this.charged += usd;
    let settled = false;
    return {
      settle: (input: number, output: number) => {
        if (settled) throw Error("Already settled");
        settled = true;
        const actual =
          (input * this.policy.inputUsdPerMillion +
            output * this.policy.outputUsdPerMillion) /
          1e6;
        this.charged += actual - usd;
        return actual;
      },
    };
  }
  get accountedUsd() {
    return this.charged;
  }
}
