# Gameplay

Forest/Ruins is a 1800 × 900 top-down map. The bramble/rune gate combines Oath's melee action with Ember's channel. The counterweight bridge combines physical crate placement with arcane crystal activation. Persistent conditions are idempotent, and gates derive collision directly from puzzle completion. Players may move independently throughout each shared map.

The 1800 × 750 airship switches shared movement to gravity, grounded jumping and AABB platforms. A deck gap precedes the engine. The crank and core require both heroes to hold interact within range simultaneously for three seconds. Engine progress drains while either contribution is missing.

The Stormbound Warden inhabits a separate platformer arena. It begins shielded. Ember channels an anchor to expose it; Oath's melee and Ember's projectiles then damage it. The shield returns once below half health. The server alone declares victory at zero HP.

Oath skills: Guard (damage reduction), Heavy Break (stronger slash), Dash (forward movement burst). Ember skills: Ward (damage reduction), Telekinesis (counterweight interaction), Blink (movement burst). Current Dash/Blink share collision-safe movement behavior; Blink is a prototype burst rather than a full teleport. Nodes cost one point and require the previous node. Base actions have server cooldowns. Mosslings seek and damage nearby heroes; dead enemies and expired bolts are removed.

Planned content to extend the slice:

- Split corridor: Oath holds a physical plate while Ember activates a distant rune.
- Ruin breach: Heavy Break destroys a seal while Telekinesis places an arcane lens.
- Cinder Wisp: ranged pressure using authoritative hostile projectiles.
- Ironbound Sentinel: Ember disrupts armor before Oath strikes.
- Authored checkpoints, dialogue, effects, audio, animated art, and richer boss telegraphs.

These are documented additions, not implemented features. Current puzzles and skills can be extended through shared definitions and server logic without granting authority to the browser.
