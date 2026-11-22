---
status: deprecated
date: 2025-01-31
decision-makers: project author
---

# An AI tunes the picture for you

## Context and Problem Statement

From 2.4.5 an experimental AI set the picture's analysis knobs (focus, spread, boost, tilt, punch). In 3.1.0 it became a self-teaching "DJ" that learned from the visitor's feedback, and visitors could submit, export and share its trained weights.

## Considered Options

1. Keep the AI that tunes the picture.
2. Remove it; the visitor sets the knobs by hand.

## Decision Outcome

Removed in 3.6.0 (2026-10-13), because it had no real target to learn from. Focus, spread, boost, tilt and punch are now always set by hand, and weight sharing is gone. The work is kept restorable; it may return once it has a real target (see the [roadmap](../ROADMAP.md)).

### Consequences

- Good, because the picture behaves predictably and the visitor is in control.
- Bad, because visitors tune the picture themselves.

### Confirmation

The settings show no DJ, no feedback dashboard and no weight sharing; the five knobs move only when the visitor moves them.

## More Information

- Confidence: Stated
- Evidence: CHANGELOG 2.4.5, 3.0.0, 3.1.0, 3.6.0; branch archive/dj-ai (d30d467)
