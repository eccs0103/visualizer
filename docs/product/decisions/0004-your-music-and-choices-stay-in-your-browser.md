---
status: accepted
date: 2023-10-06
decision-makers: project author
---

# Your music and choices stay in your browser and survive every update

## Context and Problem Statement

Visitors add songs, lyrics, backgrounds and settings. They expect to find them again next time, and after the product updates.

## Considered Options

1. Keep everything in the visitor's own browser and carry it forward on every update.

Only this option is recorded.

## Decision Outcome

Chosen option: "Keep it in the browser, carry it forward", because the product has no accounts and no server storage.

1. Songs, lyrics, backgrounds, the playlist and all settings come back on the next visit.
2. An update never loses saved data: older saved data is moved into the new shape.
3. Removing a track from the playlist removes what was stored for it.

### Consequences

- Good, because nothing leaves the visitor's computer and nothing needs an account.
- Bad, because the data lives in one browser only and is lost if the visitor clears it.

### Confirmation

Add a song, change a setting, reload: both are still there. Update to a new version: both are still there.

## More Information

- Confidence: Stated (survives updates); Inferred (stays in the browser, removal deletes stored audio)
- Evidence: CHANGELOG 1.6.4, 3.3.0, 3.8.1; studio/controllers/studio-controller.ts:49-62; agent memory (local)
