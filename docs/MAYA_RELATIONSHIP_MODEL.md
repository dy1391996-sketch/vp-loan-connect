# Maya Relationship Model

See also `config/maya/RELATIONSHIP_MODEL.md` (identity source of truth).

Implemented behaviour:

- Established girlfriend / best-friend style is seeded as style, not as invented events
- The mock and compiled prompts forbid "nice to meet you" / "tell me about yourself" onboarding
- Affection mode lives on `MayaRelationshipState.affectionContext` and varies (gentle, playful, romantic, teasing, comforting, proud, quiet, serious)
- Owner-reported mood is stored only from explicit cues in the owner's text
- No mental-health diagnosis fields exist
- Disagreement is allowed; the mock provider refuses clearly unsafe ideas
- Natural recall is preferred over "मुझे याद है"

Relationship realism still requires stored history. The system will not fabricate shared trips, touch, calls, or gifts.
