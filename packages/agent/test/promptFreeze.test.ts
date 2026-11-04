// Prompt freeze (owner request 2026-11-03, P1 revision 3; independent review of
// P1 revision 2, finding 8). The tutorial text and S2-A's full model prompts
// are pinned to the values they had at 16f1a6d, before any P1 work, so a
// change to the shared prompt code cannot alter S2-A without failing here.
// P1's own prompt and its revisions are pinned in prologueSituation.test.ts.
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { policiesFor, type ModelSetup } from "../src/harness.js";
import { defaultBudgetLimits, ModelBudget, type Gateway } from "../src/budget.js";
import { situation } from "../src/suite.js";
import { LLMPlayer, TASK } from "../src/policies/llm.js";
import { loadPlayerManual, TUTORIAL_BRIEFING, tutorialId } from "../src/playerKnowledge.js";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const MANUAL = loadPlayerManual(root).text;

/** Computed at 16f1a6d (before P1) and unchanged since; see docs/midterm/PROLOGUE_SITUATION.md. */
const S2A_PROMPTS = {
  "model-history": { sieg: "d8da1c93abf67ab74d3e2f6f4c3d4315bdcd0fc58c716a812f76b97c152a6002", coco: "e15180fe321ccfbde3d380443c8c4a8f6fad6680313542b29b7eeea7904190f2" },
  "model-obs-only": { sieg: "480f5b69995bd07b26df13d6928841e0e5a6732beeb6bb57cf04d0cd99a92387", coco: "80c360044e23da38cfcee24143f960c8e0914efe16bb338b2319ea603fdb9017" },
  "model-memory": { sieg: "43eedf0c5fc0f2490ded117fd9e81fbcc4203ff17b0a5410ab09fd9737a96e8d", coco: "a37aafcdd0201bece5c58d3ed79108f544418147f139b65624d6067245acac2a" },
} as const;

describe("prompt freeze", () => {
  it("the tutorial briefing is unchanged (id 2ec2f251)", () => {
    expect(tutorialId()).toBe("2ec2f251");
    expect(createHash("sha256").update(TUTORIAL_BRIEFING).digest("hex")).toBe("2ec2f2518db9301cba1ca1eb043d188e281150441060de8130e9ba232a143395");
    expect(TASK).toBe("Complete the Goddess's quest together.");
  });

  it("S2-A (S2-local) full system prompts are unchanged, built directly and through the harness", () => {
    const d = situation("S2-local");
    expect(d.task).toBeUndefined();
    const memory = { "model-history": "history", "model-obs-only": "none", "model-memory": "persistent" } as const;
    const setup = { gateway: { label: "test" } as unknown as Gateway, manual: MANUAL, ledger: undefined as never, stage: "pilot", priceSource: "offline fixture" } as ModelSetup;
    for (const [kind, mem] of Object.entries(memory) as [keyof typeof memory, (typeof memory)[keyof typeof memory]][]) {
      for (const [id, hero] of [["sieg", "Sieg"], ["coco", "Coco"]] as const)
        expect(new LLMPlayer(hero, MANUAL, { label: "test" } as never, 4, mem, d.briefing, d.tutorial).promptHash, `${kind} ${id}`).toBe(S2A_PROMPTS[kind][id]);
      const players = policiesFor(kind, new ModelBudget({ ...defaultBudgetLimits, maxSpendUsd: 1 }), setup, "S2-local");
      for (const id of ["sieg", "coco"] as const) {
        const p = players[id] as unknown as { promptHash: string; name: string };
        expect(p.promptHash, `harness ${kind} ${id}`).toBe(S2A_PROMPTS[kind][id]);
        expect(p.name).not.toContain("·task-");
      }
    }
  });
});
