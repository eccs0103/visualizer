---
status: accepted
date: 2023-02-22
decision-makers: project author
---

# Visitors play their own music in the browser and watch it come alive

## Context and Problem Statement

A music visualizer needs music. The product chose to have none of its own: it visualizes what the visitor brings.

## Considered Options

1. The visitor brings the songs; there is no built-in library.

Only this option is recorded.

## Decision Outcome

Chosen option: "Bring your own music", because the product is a studio for the visitor's own songs.

The experience it promises:

1. Add songs or videos by picking them or dropping them anywhere on the page.
2. A playlist that can be reordered and played once, repeated, looped or shuffled.
3. The song's author and title are shown.
4. Everything works from the keyboard as well as by mouse or touch.
5. It works on phones and touch devices, upright and sideways.
6. The screen stays awake while music plays or a clip records.

### Consequences

- Good, because any song the visitor owns works, with no rights or catalogue problems.
- Bad, because a first-time visitor sees nothing until they add a song.

### Confirmation

Drop an audio file on the page: it joins the playlist and plays. Rotate a phone: every panel still fits.

## More Information

- Confidence: Stated
- Evidence: README.md:9-11; CHANGELOG 1.4.17, 1.5.6, 1.6.3, 2.2.0, 3.2.0, 3.3.0, 3.3.2; studio/index.html:32-84; agent memory (local) for both orientations
