---
status: accepted
date: 2026-05-28
decision-makers: project author
---

# A recorded clip looks exactly like the screen

## Context and Problem Statement

Visitors record the visualization with the music and download it as a video. The clip is only useful if it is what they saw.

## Considered Options

1. Record live while the music plays, every frame, the same colours, in the original video format.
2. A different video format, tried in 2026-10. Declined: it froze at the start, lowered quality and had no audio.

## Decision Outcome

Chosen option: "Exactly the screen, recorded live", because a clip that differs from the screen breaks trust in it.

1. Every frame drawn is recorded, with the same colours and the same background.
2. Quality is chosen as a level, not as a technical number.
3. When the recording stutters, the visitor is told.

### Consequences

- Good, because what you see is what you get.
- Bad, because a clip takes as long to record as the song plays, and comes in one format only.

### Confirmation

Record a clip and play it next to the screen: frames, colours and background match.

## More Information

- Confidence: Stated
- Evidence: CHANGELOG 3.0.0; studio/services/clip-recorder.ts:37-57; studio/controllers/notice-controller.ts:22-27; agent memory (local) for the exact-match rule and the declined format
