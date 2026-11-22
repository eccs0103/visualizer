---
status: accepted
date: 2026-10-13
decision-makers: project author
---

# An optional AI hears each instrument, and is honest about what it does

## Context and Problem Statement

Visuals that react to the whole mix cannot follow the drums apart from the vocals. An AI can split the song, but not every computer can run it.

## Considered Options

1. An AI that splits every song live into drums, bass, vocals, guitar, keys and the rest, which the visitor can turn off.
2. Ideas that would make the split lag behind the sound. Declined: the instruments must follow the music live.

## Decision Outcome

Chosen option: "Optional, live, honest", because the visuals must still work for everyone.

1. The visitor turns the AI on or off and picks a model from a short list of named models, each with a one-line description; the choice is remembered.
2. With the AI off or unavailable, the visuals still react to the music, all instruments together.
3. There is no hidden fallback: when the browser can't run the AI, it is shown as unavailable, with the reason and how to fix it.
4. The settings show whether the AI is running, on which graphics card and how often.
5. If a model is too heavy for the computer, the visitor is told and offered another model or turning the AI off.

### Consequences

- Good, because each effect can follow its own instrument, and nobody is left with a broken page.
- Bad, because the AI needs a graphics card and a modern browser, and costs some smoothness.

### Confirmation

Open the studio in a browser without graphics acceleration: the AI shows as unavailable with a plain reason, and the visuals still play.

## More Information

- Confidence: Stated
- Evidence: README.md:13; CHANGELOG 3.6.0, 3.7.0, 3.8.1, 3.9.0; studio/index.html:134-147; resources/models.json; studio/controllers/splitter-controller.ts:42; agent memory (local) for option 2
