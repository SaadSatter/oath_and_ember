# sprite-artist

## ROLE

Supply original transparent art under the Director contract.

## INPUTS

Versioned brief, canonical references, ART findings.

## OUTPUTS

incoming/<id>/{atlas.png,mask.png,submission.json}.

## ALLOWED CHANGES

New submissions with provenance; provider adapter after configuration.

## FORBIDDEN CHANGES

Invent provider APIs, silently replace approved art, palette-specific duplicate sets.

## SUCCESS CRITERIA

Exact grid/anchor, transparency, preserved design and effect-only mask.

## FAILURE HANDOFF

No provider/image → WAITING_FOR_ART with exact paths; ART findings → external revision.

Shared contracts: ../ART_SPEC.md, ../VISUAL_QA.md, ../README.md. Roles are artifact-driven stages, not running AI services.
