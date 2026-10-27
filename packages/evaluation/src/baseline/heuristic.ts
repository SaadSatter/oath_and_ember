/** Generic observation-only exploration baseline. No map, quest route or item IDs.
 * Intentionally limited: cannot infer puzzle dependencies or solve reflective geometry.
 */
export class ExplorationBaseline {
  private decisions = 0;
  private usedLabels = new Set<string>();
  decide(view: {
    observation_id: string;
    observation: unknown;
    legal_actions: unknown;
  }): unknown {
    const legal = view.legal_actions as {
      ui?: { token: string; label: string }[];
      tokens?: { token: string; label: string }[];
    };
    const tokens = Array.isArray(view.legal_actions)
      ? view.legal_actions
      : (legal?.ui ?? legal?.tokens ?? []);
    const available = tokens.filter(
      (entry: unknown): entry is { token: string; label: string } =>
        !!entry &&
        typeof entry === "object" &&
        typeof (entry as { token?: unknown }).token === "string",
    );
    const fresh = available.find(
      (entry: { token: string }) =>
        !this.usedLabels.has(
          (entry as { token: string; label?: string }).label ?? entry.token,
        ),
    );
    const index = this.decisions++;
    if (fresh) {
      this.usedLabels.add(
        (fresh as { token: string; label?: string }).label ?? fresh.token,
      );
      return {
        observation_id: view.observation_id,
        action_id: `baseline-${index}`,
        plan: [{ type: "ui", token: fresh.token }],
      };
    }
    const key = ["up", "right", "down", "left"][Math.floor(index / 12) % 4];
    const held = index % 4 === 0 ? [key, "secondary"] : [key];
    return {
      observation_id: view.observation_id,
      action_id: `baseline-${index}`,
      plan: [
        { type: "controls", held, ticks: 30 },
        { type: "press", key: "interact" },
      ],
    };
  }
}
