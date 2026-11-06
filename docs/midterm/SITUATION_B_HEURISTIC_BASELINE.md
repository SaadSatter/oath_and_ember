# Situation B: unprepared Griffin combat and goddess return

Owner-requested B replaces the earlier enclosure-only proposal. ID `griffin-unprepared-return-v1`, definition `b224f75d2ec71ad61082fe0cba4617057b73cd9feb5173c52f7f32dcd86ed6f1`, start `45b1a6aa2c164b2c31885d6e5d514fc8d7eae190ef76d7aad4422445f38db9b8` at tick 540. Both heroes start with full normal health/abilities; no Mirror, Shears or Wig. Checkpoint reached by the normal opening, ordinary movement around the shrine statue and north travel, with arrival dialogue read. No heal, teleport, item injection or flag cleanup. Initial Griffin 640 HP/NEST, fresh encounter. Code/tests and [definition](evaluation-abc/B-unprepared-return-definition.json) certify reset reproducibility.

Success requires combat defeat AND wig acquisition AND actual `chapter0.complete` from normal offering/dialogue. The wig is consumed by offering, so final inventory possession is not required. Peaceful grooming with positive Griffin HP, mere wig possession, entering the shrine or an accepted E without effect cannot pass. Any lethal-hit respawn ends the episode as `knockout` using the existing authoritative damage observer, even when final HP is 100. Limits: 300 game seconds, 1,600 decisions /400 calls /4M tokens per hero, 600 baseline wall seconds; zero provider charge. Model execution remains unapproved and the current centralized model allowlist does not yet admit B.

`baseline-griffin-heuristic-v1` has separate hero memories and no model gateway. It fights a visibly hostile creature using normal sword/fireball, spacing, visible attack readiness and charging cues. Coco can try Black Hole on a nearby organic hostile as a generic pull/damage action. There is no airborne test, special landing/grounding instruction or copied fight sequence. Pull effects are observed displacement/HP changes, not inferred completion. Normal game mechanics may make the pull useful against Griffin; that is a result of executing the ability, not supplied solution knowledge.

After visible defeat, it explores for the reward named by the game. Coco can use normal flight over observed water. A visible nest landmark is remembered, not supplied as a coordinate. The adapter previously omitted that already-rendered straw nest: `GriffinView.ts` draws it at its world location; perception now lists `nest` under ordinary viewport filtering for every player. It is not visible offscreen. No game art or mechanics changed.

With the wig in the normal shared inventory, the player follows observed RETURN exits, explores the shrine, locates its visible offering point and uses the owned item through normal validation. It reads normal dialogue and chooses the first available response. Temporary collision memory and role-specific deterministic frontier tie-breaking let it recover from blocked paths. The centralized model sees both views while baseline instances retain separate histories; disclose this architecture asymmetry. The baseline does have hand-coded general game/combat knowledge, not a route or hidden state.

Development history: attempt 1 failed during legal prefix construction at the statue (no episode started); attempt 2 defeated Griffin but failed to find reward (265.5 game-s, decision limit); attempt 3 obtained wig and returned but stalled exploring shrine (300 game-s, tick limit); attempt 4 completed Chapter 0 in 89.8 game-s with 0 invalid actions/calls and no knockout. These are disclosed development outcomes, not frozen repetitions. No C or legacy held-out player case was run.

B's objective now differs from unchanged C (strict defeat + wig acquisition). Do not pool their times or call B/C a controlled inventory-only contrast. A, C, their prior definitions/results, and the legacy S4/F held-out gates remain unchanged. The new ID does not repurpose historical S2-B/S2-C or S4. Declaration r6 records this scope amendment and the new B comparator; the old declarations are retained.

Reproduce from repository root, after dependency installation:

```sh
node --import tsx scripts/midterm/evaluate.ts --player baseline-griffin-heuristic --situations griffin-unprepared-return-v1 --seeds 0 --out /tmp/griffin-baseline-run1
```

Both frozen repetitions and verification results are recorded below. Free offline runs are accelerated and have no video; no normal-speed recording or new model result is claimed. This baseline is incomplete search, not proof of general success on other encounters.

## Recorded B baseline results

B baseline frozen at `fbc3627`: **2/2 successes** in **89.8 game seconds / 5389 ticks** each. Decisions 481 Sieg / 646 Coco. Wall times 6.7 s /6.6 s. **0 invalid actions, 0 model calls/tokens, $0 API cost, no knockout**. Both authoritative traces record Griffin defeat, wig acquisition, offering acceptance and Chapter 0 completion, with valid hash chains and identical gameplay fingerprints/end hashes. End hash `a454145029bba5ad3a669aca2852a4db768536a943946be6720f43435d51275c`. Evidence: `docs/midterm/evidence/griffin-heuristic-v1/manifest.json`. A regression still succeeds with its pinned end hash `1287b39e…`; C has not been run.

Typecheck/build passed. Broad targeted verification: 77/77 tests in five files (B baseline, suite, environment, Situation A and scripted pins). After the final B-only private defeat milestone, 43/43 affected tests passed. No full-suite concurrency or paid/held-out player run. Initial prefix and metadata-test failures were fixed and rerun; development outcomes are retained. Baseline/player information remains observation-only. Twelve active rows remain unrun (10 model, two C baseline); A/B model trial requirements are not complete. Identical deterministic repeats do not establish statistical certainty.

Evidence scan: 222 session/midterm text files returned 0 findings with only the unchanged previously documented historical canary report (`2026-10-27-recording.md`) excluded. The original failed-prefix run metadata is also preserved; it produced no baseline episode outcome.

## Watching and recording a new free run

The archived heuristic trials above were accelerated offline runs and have no video. From the evaluation checkout, run:

```sh
cd /Users/saadsatter/Classes/AI_Pract_Building_Games/oath_and_ember-eval
npm run eval:live -- --scenario griffin-unprepared-return-v1 --seed 0 --player baseline-griffin-heuristic
```

The live viewer uses normal speed and recording is on by default. Output prints its directory under `evaluation-runs/live/`; `recording.webm` is the video and `recording.json` is recording metadata. This is a new free baseline episode, not a video of the archived trial. The launcher now explicitly admits the new B runtime ID. `griffin-unprepared-v1` in another checkout is a different scenario and must not be silently substituted. The CLI smoke test uses `--no-viewer` and therefore does not create or validate a recording.

Integrated into `oath_and_ember-eval` at the owner's request. Original archived trials retain their source commit IDs; integration checks are recorded separately. The reviewed `griffin-unprepared-v1` enclosure case is preserved beside the return variant, not replaced or aliased.
