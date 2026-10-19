# Story checkpoints

The title screen offers four starting chapters when creating a room. Joining
an existing room uses that room's chapter, regardless of the joiner's selection.

| Starting chapter | Opening | State |
| --- | --- | --- |
| Prologue | Sieg arrives at Alden's shop | The story begins from the start. |
| Shopping | Coco sets off with Papa's shopping list | Alden is alive; shopping objectives and purchases are still available. Sieg waits at home. |
| Alden's Funeral | The following morning | Both heroes prepare the grave, gathering stones and flowers before the funeral. The house is damaged and Alden is gone. |
| Investigate Emberbrook | The village's western entrance | The burial is complete. Both heroes can question villagers; no investigation clues have been collected. |

These starts work with `npm run dev`, `npm start`, and `npm run prologue`.
Rebuild and restart a running compiled server after updating the code, then
refresh the title screen in both browsers. Existing rooms keep their selected
chapter; create a new room to choose another one. Replaying a completed game
returns to that room's selected chapter.

The client sends only a checkpoint identifier in `room:create`. The server
validates it and reconstructs prior story flags and item transfers from the
authored story scenes. Clients cannot provide stages, inventory, HP, or outcomes.
Checkpoint initialization adds no persistence or unlocked-checkpoint tracking.

Programmatic `room:create` requests with an empty payload retain the server's
configured default, including the shrine and enemy playtest modes. An explicit
story checkpoint selects the story campaign instead.

Validation: `apps/server/test/storyCheckpoints.test.ts` covers state, inventory,
reachability, invalid requests, multiplayer sync, reconnection, and replay.
`node --import tsx scripts/qa-story-checkpoints.ts qa/<fresh-directory>` exercises
the title screen and starts all four chapters in two real browsers.
