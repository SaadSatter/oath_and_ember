# Human-requested Ward presentation revision

Feedback: “Make Coco's ward as a whole rotate and speed up the animation.”

The separate Ward image rotates clockwise using the continuous scene clock, one turn per 2.4 seconds. Rotation does not restart on new snapshots or start/held/end transitions. Coco's body does not rotate. Ward presentation-envelope durations are divided by 1.5 and the held opacity pulse period is halved. Sieg's Guard keeps its original timing and orientation. Server skills, inputs, damage, cooldowns and held-state authority are unchanged.

Iteration 3 was integrated from iteration 2's candidate atlas/mask, preserving the exact byte hashes. No artist/provider call occurred. The implementation regression test verifies the Ward image rotation at the scene-clock timestamp while its body remains on the existing animation. Typecheck, all 89 tests and build passed. Browser/vision outcomes remain separate evidence; this note grants no visual PASS or approval.
