---
status: accepted
date: 2026-10-13
decision-makers: project author
---

# Developers get extra settings on request; visitors see a simple product

## Context and Problem Statement

Model sizes, per-instrument strength and preview visualizations help developers but clutter the panel for everyone else.

## Considered Options

1. A hidden address for developers (`?for=developers`); the browser console points developers to it.
2. The earlier `?developer` address with its own Developer section and test models, replaced in 3.7.0.

## Decision Outcome

Chosen option: "`?for=developers`", because regular visitors should see only what they need.

### Consequences

- Good, because the regular panel stays short and plain.
- Bad, because developer features are hidden from anyone who does not know the address.

### Confirmation

Open the studio with and without `?for=developers`: only the first shows model sizes and instrument sliders.

## More Information

- Confidence: Stated
- Evidence: CHANGELOG 3.6.0, 3.7.0, 3.8.0, 3.8.1; studio/controllers/studio-controller.ts:46-48; studio/index.html:149-178
