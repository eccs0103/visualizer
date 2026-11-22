---
status: accepted
date: 2026-09-11
decision-makers: project author
---

# Synced lyrics appear in every visualization, in its own look

## Context and Problem Statement

Visitors want to see the words of the song along with the picture.

## Considered Options

1. Lyrics from a file dropped next to the song, or looked up online by file name.

Only this option is recorded.

## Decision Outcome

Chosen option: "File or online lookup", because most songs come without a lyrics file.

1. A lyrics file dropped with the track is used first.
2. Otherwise the lyrics are looked up online by file name; this is on by default and can be turned off.
3. Each built-in visualization shows the lyrics in its own style.
4. The visitor keeps control of the lyrics layer's opacity and blend, whatever the style.
5. The browser's page translation leaves lyrics, song titles and times untouched.

### Consequences

- Good, because lyrics appear for most songs with no effort.
- Bad, because the lookup sends the file name to an outside service, and a badly named file finds the wrong lyrics.

### Confirmation

Play a well-named song with no lyrics file: synced lyrics appear. Turn the lookup off: they do not.

## More Information

- Confidence: Stated
- Evidence: README.md:9; CHANGELOG 3.4.0, 3.6.0, 3.9.0; studio/index.html:109-116; agent memory (local) for point 4
