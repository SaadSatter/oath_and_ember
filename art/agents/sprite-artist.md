# sprite-artist

## ROLE

Supply original transparent art under the Director contract.

## INPUTS

Versioned brief, canonical references, ART findings.

## OUTPUTS

incoming/<id>/{atlas.png,mask.png,submission.json}.

## ALLOWED CHANGES

New submissions with provenance; configured OpenAISpriteProvider for declared asset capabilities. Requests use the current brief/references and ART feedback; preserve every attempt.

## FORBIDDEN CHANGES

Invent provider APIs, silently replace approved art, palette-specific duplicate sets.

## SUCCESS CRITERIA

Exact grid/anchor, transparency, preserved design and contract-specific mask.

## FAILURE HANDOFF

Manual/no credentials → WAITING_FOR_ART. Configured provider → generated candidate; ART failures → bounded automatic regeneration. API failures → human/configuration review; unsupported/unsafe contracts or bindings → Game Engineer capability handoff. Never retry HTTP requests implicitly.

Semantic-mask contracts preserve separate mask requests/raw responses and require protected-region review; never derive a character/equipment mask from atlas alpha.

Shared contracts: ../ART_SPEC.md, ../VISUAL_QA.md, ../README.md. Roles are artifact-driven stages, not running AI services.
