# Anonymous human playtest notes

Initially recorded on 4 November 2026 from the developer's retrospective account, supplemented by the developer on 7 November 2026 with the session details below. Participants are anonymous; names and identifying details are omitted. These are aggregated, developer-reported notes, not a transcript or independently verified session log.

## Session details supplied by the developer

| Field | Retrospective account |
| --- | --- |
| When | 2 November 2026, around 10 p.m.; timezone not specified |
| Duration | Roughly 45 minutes |
| Tested build | Before the cow barriers, added grave dialogue and wolf changes; exact commit not recorded |
| Participants | Friends who played the game; exact count not supplied |
| Coverage | Started at the prologue and played through to the ending, trying all puzzles, according to the developer; no trace or recording verifies completion |
| Assistance | The developer explained several unclear parts; this was assisted play, not a session completed without help |
| Revised-build retest | None: these players did not try the revised version |


## What players tried and where they hesitated

The developer reports hesitation around the grave quest, talking to or locating the apothecary, getting past the cow, and finding the wolf. The Griffin was reportedly easy to defeat; the exact combat method and item use were not specified. Exact actions, individual attempts and direct quotations were not supplied.

| Area | Reported hesitation or feedback | Change made |
| --- | --- | --- |
| Cow walkway puzzle | It was not clear that the cow could not be moved vertically. The puzzle needed to communicate the sideways route into its bay more clearly. | North and south barriers now leave an opening that heroes can pass through but the cow cannot. This makes the sideways constraint visible in the level geometry. The barriers were subsequently drawn as maze hedges. |
| Story and grave visits | Players wanted more dialogue to direct quest progression, particularly when to visit or return to the grave. | Added dialogue explaining why the heroes ask around Emberbrook after the funeral, search Papa's things after collecting clues, and return to the grave after finding the journal. |

Additional reported issues:

- **Apothecary:** players hesitated about speaking to or locating her. No specific verified fix for this issue is identified in the three cited commits.
- **Wolf:** players had difficulty finding it. The later lap behavior is a related iteration, but the available account does not establish that it fixes discovery or that players validated it.
- **Griffin:** the developer reports that it was easy to defeat. The later HP increase is documented below; its effect on difficulty was not retested by these players.

The developer supplied an approximate overall session duration, not per-puzzle completion times or exact movement sequences. None are inferred here.

## Changes and repository evidence

- [ffbdecb — Fence the hedge maze cow, double griffin HP and explain story turns](https://github.com/SaadSatter/oath_and_ember/commit/ffbdecb11979934c8dc41d31f38ec8cba1aebceb): implements the cow barriers and story guidance described above. The same commit raises Griffin HP from 320 to 640; the developer's 7 November supplement reports that the earlier fight was easy. No post-change difficulty result is available.
- [0a09f1b — Draw the cow walls as maze hedges instead of stone slabs](https://github.com/SaadSatter/oath_and_ember/commit/0a09f1b7f38edf260d590e9c280103161a0bd0ab): integrates the barriers with the maze artwork while preserving collision.
- [3ca9792 — Make the hedge maze wolf run laps of its loop once a hero enters it](https://github.com/SaadSatter/oath_and_ember/commit/3ca9792ab87ac6e400df81e09ae95a73cdf10daa): related maze iteration supplied by the developer. Inside the loop, the wolf keeps running and turns back when a hero blocks it, allowing two heroes to corner it. The later account reports difficulty finding the wolf, but does not establish a specific causal link to the lap behavior or a successful follow-up test.

These commits establish what changed, not whether players understood the revised build.

## Limitations and follow-up

The revised midterm requirement permits any other human player, including a classmate, friend, or family member. It asks for at least one session observed without helping, with anonymous notes on actions, hesitation, and resulting changes. The developer now confirms that help was given, so this record does not establish the observation-without-help condition. Session date, approximate duration, build chronology and coverage are now supplied; exact player count/build hash and detailed action logs remain unavailable.

If satisfying the supplied unaided-observation requirement, conduct and document a separate short session without hints. A follow-up session should check whether a new player recognizes the cow's sideways-only route without prompting, understands when to return to the grave after finding the journal, and can coordinate with a partner to corner the wolf. Record what the player actually does and where they hesitate. No follow-up results are claimed yet.

## Documentation session evidence

This documentation session checked the three commit records and the local origin URL, and read the available midterm implementation status, boundary review records, design rationale, and project/manual READMEs. The required `MIDTERM_GUIDELINES.md`, `RECURRING_INSTRUCTIONS.md`, `REQUIREMENTS_CHECKLIST.md`, and `EVIDENCE_INDEX.md` were absent from this checkout; no current phase handoff, `.claude/skills/`, or session-evidence procedure was found. The revised human-playtest wording was supplied directly by the developer in chat.

Only documentation was changed for these notes. Commit references and relative documentation links were checked locally; gameplay tests were not rerun. No paid evaluation, held-out scenario, push, or merge was performed. The local origin points to `SaadSatter/oath_and_ember`; GitHub privacy and fork-parent mapping were not verified by that local check.


## 7 November owner-supplied clarification

The developer supplied the session timing, approximate duration, pre-change build description, full-story coverage, additional apothecary/wolf/Griffin observations, assistance disclosure and absence of a retest in the submission-preparation chat. Those details are recorded above as the developer's account. This update changes documentation only; it adds no gameplay result or claim of improvement. The previously approved submission commits and generated package were not changed. Include this updated notes document during the next authorized documentation integration.
