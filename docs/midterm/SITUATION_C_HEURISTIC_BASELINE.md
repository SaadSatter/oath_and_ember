# Situation C cheap baseline

> **Classification (owner decision, 2026-11-06):** C-specific exploratory baseline, **excluded from the official evaluation**. It is tuned to C's literal item text ([rules-reviewer round 1](agent-evidence/reviews/2026-11-06-situation-c-rules-review.md), finding 1). The official C2 is the unchanged `baseline-griffin-heuristic-v1` ([SITUATION_C_PREPARED.md](SITUATION_C_PREPARED.md)). The implementation and history below are preserved unchanged.

Prepared 2026-11-06. Player kind: `baseline-inventory-heuristic`; policy ID: `baseline-inventory-heuristic-v1`. Zero model calls. Implementation: [inventoryHeuristic.ts](../../packages/agent/src/policies/inventoryHeuristic.ts).

This is a deterministic inventory-affordance overlay on the unchanged Situation B heuristic. Each hero has independent policy memory. Coco matches owned item names/descriptions against observed labels and nearby target names, approaches observed compatible objects, and tries different matching items. Item IDs are taken from inventory, not an answer table. Sieg retains the existing combat behavior. Normal dialogue, wig return and offering use the existing B fallback.

The policy has no scenario imports, fixed destination coordinates, hidden flags, or prescribed item-delivery sequence. It uses the same observation and action interface as other players. Coco temporarily deprioritizes observed enemies when carrying useful tools; this is an explicit policy tradeoff, not an adapter visibility change. This baseline knows normal combat/return rules inherited from B and was developed with knowledge of the prepared inventory setup. It is not a blind general-purpose player.

Accepted item input is recorded separately from observed inventory changes. Neither is declared a completed subgoal. A pending item interaction has a fixed 30-game-second deadline and periodic normal interaction probes. Deadline expiration resumes general play; it does not certify failure or success.

## Verification and limits

- `npm run typecheck`: passed.
- `npm test -- packages/agent/test/inventoryHeuristic.test.ts packages/agent/test/mazeHeuristic.test.ts packages/agent/test/griffinHeuristic.test.ts`: 29 tests passed across three files.
- `npm run build`: passed; existing bundle-size warning.
- Synthetic tests cover arbitrary item/target matching, different tool attempts, accepted input without reward, fixed deadline, ordinary offering, absent items, independent instances and deterministic histories.
- A/B policy sources remain unchanged from HEAD.
- No C episode or paid model was run. No C completion, recording, start hash or success rate is claimed. Generic text matching can choose an unsuitable item; movement and combat fallback may still fail.

The concurrent scenario work proposes `griffin-prepared-return-v1`: prepared encounter, normal wig acquisition and goddess offering ending in actual `chapter0.complete`, without knockout. This baseline does not register or approve that scenario. The separate proposal JSON identifies the candidate policy; it does not amend the active suite declaration or fill result slots. Keep model prompts unchanged based on C outcomes if C remains held out.

After the scenario definition and policy are frozen and execution is approved, evaluate the unchanged policy on identical starts and retain both outcomes. A possible viewer invocation is `npm run eval:live -- --scenario griffin-prepared-return-v1 --seed 0 --player baseline-inventory-heuristic --port 3031`. It has not been executed here.
