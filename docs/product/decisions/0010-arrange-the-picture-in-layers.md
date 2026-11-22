---
status: accepted
date: 2026-09-25
decision-makers: project author
---

# Visitors arrange every picture in layers, with their own background

## Context and Problem Statement

Visitors want to shape a look to their taste, not only pick it.

## Considered Options

1. Every visualization is a stack of layers the visitor can reorder, fade and blend.

Only this option is recorded.

## Decision Outcome

Chosen option: "Layers per visualization", because it gives control without asking the visitor to write anything.

1. Drag a layer to reorder it, lower its opacity, or pick a blend mode.
2. Lyrics always stay on top and the background always stays at the bottom.
3. The background can be the visitor's own image, with an optional pulse, shake or parallax effect.
4. The arrangement is remembered per visualization.
5. Images that are too large or in an unsupported format are refused with a clear message.

### Consequences

- Good, because each visitor gets their own version of each look.
- Bad, because there are more settings to learn.

### Confirmation

Reorder a layer, switch visualizations and back: the order is kept.

## More Information

- Confidence: Stated
- Evidence: README.md:15; CHANGELOG 3.5.0, 3.8.1; studio/view/layers-view.ts:108-180; studio/controllers/layers-controller.ts:56-76
