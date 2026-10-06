import { contractRegistry } from "./contracts.js";
import type { Asset, Manifest } from "./model.js";
export type FeedbackRoute = "ART" | "IMPLEMENTATION" | "COMBINED" | "AMBIGUOUS";
export interface Classification {
  route: FeedbackRoute;
  reason: string;
  signals: string[];
  classifier: "explicit-rules-v1";
  tasks?: { art: string; implementation: string };
}
export function classifyFeedback(
  text: string,
  override?: "art" | "implementation",
): Classification {
  if (override)
    return {
      route: override === "art" ? "ART" : "IMPLEMENTATION",
      reason: "Explicit human route selection",
      signals: [override],
      classifier: "explicit-rules-v1",
    };
  const art =
    /\b(brighter|darker|colour|color|palette|texture|rune shapes?|stronger runes?|runes? stronger|silhouette|redesign|artwork|draw|paint)\b/i.test(
      text,
    );
  const implementation =
    /\b(render|center|centre|centered|centred|centering|centring|position|offset|fade|pulse|pulsing|rotate|rotating|rotation|choppy|too big|too small|speed|timing|animation|anchor|scale|layer|px|pixels)\b|\d+\s*%\s*(larger|smaller)/i.test(
      text,
    );
  if (art && implementation && !override) {
    const clauses = text
      .split(/(?<=[.!?])\s+|\s+(?:and|also|while)\s+/i)
      .map((s) => s.trim())
      .filter(Boolean);
    const artParts: string[] = [],
      implementationParts: string[] = [];
    for (const clause of clauses) {
      // Classify each clause without recursively splitting an inseparable mixed clause.
      const a =
        /\b(brighter|darker|colour|color|palette|texture|rune shapes?|stronger runes?|runes? stronger|silhouette|redesign|artwork|draw|paint)\b/i.test(
          clause,
        );
      const i =
        /\b(render|center|centre|centered|centred|centering|centring|position|offset|fade|pulse|pulsing|rotate|rotating|rotation|choppy|too big|too small|speed|timing|animation|anchor|scale|layer|px|pixels)\b|\d+\s*%\s*(larger|smaller)/i.test(
          clause,
        );
      if (a === i)
        return {
          route: "AMBIGUOUS",
          reason:
            "A clause has unclear or conflicting intent; clarify that clause in the same asset request.",
          signals: [clause],
          classifier: "explicit-rules-v1",
        };
      (a ? artParts : implementationParts).push(clause);
    }
    if (artParts.length && implementationParts.length)
      return {
        route: "COMBINED",
        reason:
          "One asset request with source-art and presentation tasks; apply both before QA.",
        signals: ["source-art", "presentation"],
        classifier: "explicit-rules-v1",
        tasks: {
          art: artParts.join(". "),
          implementation: implementationParts.join(". "),
        },
      };
  }
  const signals = [
    art ? "source-art" : "",
    implementation ? "presentation" : "",
  ].filter(Boolean);
  return {
    route:
      art === implementation ? "AMBIGUOUS" : art ? "ART" : "IMPLEMENTATION",
    reason:
      art && implementation
        ? "Feedback mixes source artwork and runtime presentation; choose ART or IMPLEMENTATION."
        : !art && !implementation
          ? "Insufficient information to choose source art or presentation changes."
          : art
            ? "Feedback changes source appearance."
            : "Feedback changes runtime presentation.",
    signals,
    classifier: "explicit-rules-v1",
  };
}
export function selectAsset(
  m: Manifest,
  text: string,
  explicit?: string,
  active?: string,
  registeredTargets = Object.keys(contractRegistry()),
): {
  asset?: Asset;
  target?: { character: string; animation: string };
  clarification?: string;
} {
  if (explicit)
    return m.assets[explicit]
      ? { asset: m.assets[explicit] }
      : { clarification: `Unknown asset ${explicit}` };
  const mentioned = text.match(/\b[a-z][a-z0-9_]*_v[1-9][0-9]*\b/g) || [];
  if (mentioned.length)
    return mentioned.length === 1
      ? selectAsset(m, text, mentioned[0])
      : { clarification: "Choose one asset per request." };
  const normalized = text.toLowerCase().replace(/[’']/g, "");
  const matches = Object.values(m.assets).filter(
    (a) =>
      normalized.includes(a.character.toLowerCase()) &&
      normalized.includes(a.animation.toLowerCase()),
  );
  const roles = new Set(matches.map((a) => `${a.character}:${a.animation}`));
  if (roles.size > 1)
    return { clarification: "Request mentions multiple assets; choose one." };
  if (matches.length)
    return { asset: matches.sort((a, b) => b.version - a.version)[0] };
  const known = registeredTargets
    .map((key) => {
      const [character, animation] = key.split(":");
      return { character, animation };
    })
    .filter(
      (t) =>
        normalized.includes(t.character) && normalized.includes(t.animation),
    );
  if (known.length === 1) return { target: known[0] };
  if (known.length > 1) return { clarification: "Choose one effect." };
  if (
    active &&
    m.assets[active] &&
    /^(approve|improve|reject|review|resume)\b/i.test(text.trim())
  )
    return { asset: m.assets[active] };
  return {
    clarification:
      "Name an existing asset or Coco Ward/projectile, or use --asset ASSET_ID.",
  };
}
