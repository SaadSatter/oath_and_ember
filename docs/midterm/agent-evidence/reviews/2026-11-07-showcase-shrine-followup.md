# Follow-up review: ordered showcase history

**Provenance:** Reviewer subagent `/root/shrine_review`, launched from the implementing Codex session; no implementation edits by this reviewer. This follow-up supplements the original report without replacing it. No tests, policies or paid calls were run.

**Prior major finding: addressed in code.** `packages/agent/src/evaluator.ts` now defines all ten ordered milestones and requires each first-occurrence timestamp to exceed its predecessor. `packages/agent/src/environment.ts` passes the existing first-occurrence map into that predicate. An early Griffin defeat retains its original timestamp and cannot become acceptable through later revisits. Final authoritative quest-state conditions remain required.

The updated test uses timestamps from the actual baseline report, removes each required milestone individually, and includes an explicitly labelled evaluator-only timestamp fixture placing combat defeat before maze entry. These assertions directly cover the previously identified gap; execution results require the implementing session’s subsequent verification.

**Prior low finding: addressed.** Source headers now describe the normal Goddess Shrine checkpoint and the baseline’s opening dialogue phase. The environment comment now describes ordered quest and travel milestones.

**No additional blocking finding in this focused diff.** The showcase definition includes the ordered milestone list, so the revised contract affects its definition hash. Player observations and gameplay rules are unaffected by this fix.

**Limitations:** This was a focused code review of the changes addressing the two prior findings. Final test execution, exact replay, actual opening-video inspection, ledger recheck and clean-commit provenance remain outside this follow-up’s verification scope. Paid execution still requires the owner’s new approval for the final revised hashes.
