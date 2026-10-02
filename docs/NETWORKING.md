# Networking

The browser submits current buttons and a monotonic sequence number. It never submits authoritative position, HP, damage, puzzle results, or skill points. Strict Zod input parsing rejects extra fields and illegal movement values. Lobby and progression requests validate their payloads and return acknowledged success or a readable error.

The server has a RoomManager separate from Socket.IO broadcast membership. Every GameRoom contains serializable world state and private session records. Cryptographic six-character codes identify rooms; private random reconnect tokens authenticate resume and are never broadcast. Two participants and exclusive hero roles are enforced server-side.

A fixed-step accumulator advances at 30Hz, with at most five catch-up steps. Dynamic snapshots broadcast at 15Hz via volatile events. Collision geometry is imported from shared maps rather than broadcast repeatedly. Snapshot state includes player input acknowledgement, enemies, projectiles, puzzle state and boss state. Initial connection, resume, lobby changes and scene transitions send full state syncs.

The local client predicts shared kinematics at 30Hz. On snapshots it restores the authoritative player, discards acknowledged inputs and replays remaining input. Rendering converges toward that prediction, snapping only for corrections above 100 pixels. Other players, enemies and projectiles use a 100ms receipt-time snapshot interpolation buffer and hold when no newer state is available. Presentation cannot resolve combat or puzzles.

Requests: room:create, room:join, session:resume, role:select, lobby:ready, skill:unlock, game:restart. Continuous intent: player:input. Server events: state:sync, game:snapshot, scene:transition, connection:status, game:complete. room:state, game:event and server:error are typed extension points; current code uses state:sync and acknowledgement errors instead.

Input is limited to at most 100 accepted frames/second and stale sequences are ignored. After 250ms without input the server clears held actions. On disconnect, game simulation pauses and the slot is reserved for 30 seconds. Reconnect replaces client state and clears stale prediction/interpolation. On grace expiry the departed player is removed and the room returns to the lobby. Resume failures remove the client's stale session.

The current server consumes the most recent input per simulation tick. That keeps disposable button-state transport simple but is not a full tick-aligned input queue. Prediction errors under real-world jitter should be measured before production polish. All gameplay invariants continue to be server-owned.

Primary-button edges use reliable validated input frames and a bounded server intent queue so brief taps are not lost between ticks. Snapshots expose server-owned Heavy Break charge, accepted release markers and one-second retained projectile collision impacts. See [combat details](COMBAT_CHARGE_AND_PROJECTILES.md).
