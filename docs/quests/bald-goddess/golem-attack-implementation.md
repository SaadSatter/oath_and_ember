# Forest Iron Golem charged beam

The sentinel now has the supplied palm/flash attack poses and an authoritative charged ranged attack, including the maze's formerly passive golem. Its existing HP, body, movement speed and 28 damage are retained. It detects players within 420px, approaches to a 320px firing range, locks its facing for a visible 1.2s charge, and fires at 400px/s. Cooldown remains 2.5s. The projectile expires harmlessly after 1.6s (640px travel) if nothing is struck.

The first swept contact with a solid obstacle, world border or living connected player triggers one explosion. Walls take precedence at equal contact distance. The exact impact point is authoritative; fast projectiles cannot skip a wall to hit a player behind it. Explosion damage is 28 once, including the directly hit player, within 64px (two 32px tiles) of the impact center. Disconnected/dead players, other scenes, and players protected by a solid wall are excluded. Existing guard/ward/invulnerability rules still apply through the standard server damage path. No damage is inferred from a client's effect animation.

Slow Time scales charge/cooldown timing, projectile travel/lifetime and cosmetic effects to 0.2. Super Speed preserves Sieg's existing normal movement interaction, allowing him to dodge. Killing a golem during its charge prevents that shot.

The server snapshots tag beam projectiles with `effect: golem_beam` and impacts with `effect: golem_blast`, radius 64. The client uses the supplied four nine-frame palm/flash clips, charge sphere with a white beam trail, and one non-looping explosion. Attack clips use fixed direction-specific padding with a common (64,108) anchor; idle/walk anchors remain unchanged. Source pixels and alpha are preserved. The projectile is gameplay-centered; cosmetic palm charge offsets do not change collision.

Source exports, GIFs and hashes: `Images/Sprites/monster_sprites/sources/forest-iron-golem/attack/`. Runtime assets: `apps/client/public/assets/enemies/ironbound_sentinel/attack.png`, `charge.png`, `blast.png`, `attack.json`. Reproduce with `scripts/import-golem-attack.py`.

Validation: charge/death cancellation, locked aim, earliest swept contact, wall occlusion, exact two-tile radius, same-scene eligibility, single area hit without double direct damage, Slow Time, harmless expiry, and two real socket clients receiving identical beams, impacts and player HP. Browser script `scripts/qa-golem-attack.ts` exercises all four directions using ordinary authoritative simulation ticks with server-side initial encounter fixtures; screenshots are in `qa/golem-{charge,beam,blast}-*.png`.

Typecheck/build pass; all 245 tests across 37 files pass with `npm test -- --maxWorkers=4`. Bounded concurrency avoids wall-clock socket-test contention on this host. Existing Vite bundle-size advisory remains.

## Close-range punch update

The golem now chooses its supplied Cross Punch within 60px. Entering that range during an unfinished beam charge cancels the beam and starts a new, readable punch windup at the approaching hero. Already-fired beams continue normally. Melee aim locks at the start; the target can dodge by leaving range or moving behind the punch. The hit checks the frontal 120° arc, same scene, living/connected target and wall visibility.

Contact is at tick 12 (0.4s); the full six-frame punch lasts 24 ticks (0.8s), followed by a one-second attack cooldown. Damage remains 28 and applies once to the selected close target, without a beam or area explosion. Attack mode is selected anew after cooldown; moving away restores beam attacks. Slow Time scales both contact and recovery timing. Death/disconnection prevents a hit.

Original source export and GIFs are preserved under `Images/Sprites/monster_sprites/sources/forest-iron-golem/melee/`, with PNG hashes and translation provenance. Runtime `melee.png` has four rows of six 128px cells, unchanged source pixels and fixed direction/clip translations to the established (64,108) attack anchor. `scripts/import-golem-melee.py` rebuilds it.

Validation adds close/ranged selection, mid-charge switching, fresh windup, one hit, directional dodging, wall/disconnection/death cancellation, cooldown/recovery, Slow Time and two-client numeric mode/HP synchronization. `scripts/qa-golem-melee.ts` checks all four native punch directions, hides charge effects for melee, verifies one close hit and complete recovery in both browsers. All 252 tests across 38 files, typecheck and build pass.
