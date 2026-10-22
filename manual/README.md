# Oath and Ember manual

- `Oath_and_Ember_Player_Manual.pdf` is the illustrated reading copy.
- `Oath_and_Ember_Player_Manual.md` is the editable text copy.
- `images/` contains the original gameplay captures used in both copies.

Prepared on 22 October 2026 against the current local source and client build.

## Image provenance

All seven PNG files were captured from the local game in two independent headless Chrome browser contexts joined to the same room. No artwork was generated or modified. The capture session used a temporary local server. The guard image uses a server-side fixture transition to Forest Ruins; the remaining views show the lobby and initial exploration state. The fixture removed story control for capture and did not alter game source or combat rules. These images illustrate mechanics rather than a route through the campaign.

## Maintenance references

Verify controls against `apps/client/src/main.ts`, panel behavior against `apps/client/src/ui/`, and action rules against `apps/server/src/GameRoom.ts` and `packages/shared/src/`. Older gameplay prose may describe superseded skill menus. Heavy Break is documented conditionally because it is not a normal starting skill.
