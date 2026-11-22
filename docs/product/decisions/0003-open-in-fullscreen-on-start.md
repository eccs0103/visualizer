---
status: deprecated
date: 2023-06-18
decision-makers: project author
---

# Open in fullscreen on start

## Context and Problem Statement

The product once switched to fullscreen by itself when it started.

## Considered Options

1. Fullscreen on start.
2. Auto-play on start instead.

## Decision Outcome

Chosen option at the time: "Fullscreen on start". It ended on 2023-08-23 and was replaced by auto-play, because fullscreen on start did not work reliably.

### Consequences

- Good, because the product no longer takes over the screen unasked.
- Bad, because the visitor enters fullscreen by hand.

### Confirmation

Opening the studio does not enter fullscreen.

## More Information

- Confidence: Stated
- Evidence: CHANGELOG 1.4.9 (added), 1.5.6 (23.08.2023, replaced because of unstable functionality)
