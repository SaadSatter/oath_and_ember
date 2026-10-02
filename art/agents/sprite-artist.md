# sprite-artist

## ROLE

Supply original transparent art under the Director contract.

## INPUTS

Versioned brief, canonical references, ART findings.

## OUTPUTS

incoming/<id>/{atlas.png,mask.png,submission.json}.

## ALLOWED CHANGES

New submissions with provenance; configured OpenAISpriteProvider for the supported isolated Coco effects. Requests use the current brief/references and ART feedback; preserve every attempt.

## FORBIDDEN CHANGES

Invent provider APIs, silently replace approved art, palette-specific duplicate sets.

## SUCCESS CRITERIA

Exact grid/anchor, transparency, preserved design and effect-only mask.

## FAILURE HANDOFF

Manual/no credentials → WAITING_FOR_ART. Configured provider → generated candidate; ART failures → bounded automatic regeneration. API failures/unsupported bindings → human/configuration review. Never retry HTTP requests implicitly.

Shared contracts: ../ART_SPEC.md, ../VISUAL_QA.md, ../README.md. Roles are artifact-driven stages, not running AI services.
