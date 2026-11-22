---
status: accepted
date: 2026-10-17
decision-makers: project author
---

# The app never changes your choices; it measures, warns and lets you decide

## Context and Problem Statement

Computers differ widely. When one can't keep up, the product could quietly lower quality or switch models, or it could tell the visitor.

## Considered Options

1. Measure, warn in plain words, and let the visitor decide.
2. Let the app pick the AI model, rate or quality for each computer. Declined.

## Decision Outcome

Chosen option: "Measure and warn", because a product that silently changes the visitor's choices cannot be trusted.

1. No setting (AI on or off, model, rate, quality, recording) changes unless the visitor changes it.
2. A live Smoothness readout shows how well the page keeps up.
3. When something is wrong (AI unavailable, graphics acceleration off, running slowly, recording stutters), a warning on the main screen says what is wrong and what to change.
4. Settings describe only facts that never change; model names and descriptions come from the current model list.
5. Interface text uses plain everyday words, not audio jargon.

### Consequences

- Good, because the visitor stays in control and always knows why things look the way they do.
- Bad, because a visitor on a weak computer must act on the warning themselves.

### Confirmation

Slow the computer down: a warning appears, and no setting has changed.

## More Information

- Confidence: Stated
- Evidence: README.md:13; CHANGELOG 3.7.0; studio/index.html:96-105; studio/controllers/notice-controller.ts:22-27; agent memory (local) for points 1 and 4 and option 2
