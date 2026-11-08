---
name: oath-rule-information-boundary
description: Review Oath and Ember evaluation adapters, players, baselines, clocks and traces for rule preservation and information leakage. Use at implementation checkpoints and pre-evaluation audits, not as a playable policy.
---

Review the requested revision read-only. This skill belongs to the implementation team; never include it in a game-playing agent's context.

- Trace observation fields to rendered public facts. Reject whole World, offscreen coordinates, future dialogue, full map geometry, source-derived solution labels and hidden flags. Structured observations only; require normal-speed recorded video, no screenshots.
- Trace actions to ordinary engine validation: role, reach, sight, cooldown, button edges, stale tokens and duplicate requests. Reject outcome mutation and fixture rewards after reset.
- Verify independent histories and worker capabilities, with bounded explicit messages only. No source/spec/QA/rationale/private-trace access by policies.
- Audit baseline information and action equality. A privileged engineering reachability oracle is not a fair baseline.
- Check one shared tick owner, simulation/wall time, freshness, deterministic IDs, transitions, cancellation and budget/success precedence. Audit frame/tick video timing and replay provenance.
- Check complete trace/replay evidence and policy/scenario freeze. Do not run held-out cases during tuning.
- Distinguish implemented tests, fixtures, baseline results and live-model evidence. Do not call an unverified full quest or a failed run successful.

Return prioritized findings with source references and concrete reproductions/fixes. State session ID, skill SHA256, scope and limitations. Do not edit files, fix code or write the user's personal team log. Missing paid-call credentials/budget block paid calls only.
