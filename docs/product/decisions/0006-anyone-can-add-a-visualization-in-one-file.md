---
status: accepted
date: 2025-01-28
decision-makers: project author
---

# Anyone can add a visualization by writing one file

## Context and Problem Statement

The product calls itself a flexible framework for creating custom visualizations. Outside authors need a way in that does not require learning the whole product.

## Considered Options

1. One file per visualization, next to the built-in ones, plus one line that lists it.

Only this option is recorded.

## Decision Outcome

Chosen option: "One file, one line", because a contributor should need to know as little as possible about the inner workings.

1. The contributor guide covers only writing visualizations; the built-in Pulsar, Spectrogram and Stems are its examples.
2. A visualization can only draw its picture. It cannot change the visitor's settings or anything else in the app.
3. Every visualization, including one written tomorrow, gets the product's improvements without changes; no visualization is special-cased.
4. If one layer or one visualization fails, the rest of the picture keeps drawing and the others stay in the list.
5. Visualizations look the same at any frame rate, and clean-ups never change how one looks.
6. A new built-in visualization may be shown to developers first, then opened to everyone (Stems: 3.8.0, then 3.9.0).

### Consequences

- Good, because new looks arrive without touching the rest of the product, and a broken one harms nobody.
- Bad, because a visualization cannot reach beyond its picture, so some ideas need a change to the product itself.

### Confirmation

Follow CONTRIBUTING.md: a new file plus one import line adds a visualization to the list, with no other change.

## More Information

- Confidence: Stated
- Evidence: README.md:17-19; CONTRIBUTING.md:3-13; CHANGELOG 2.4.0, 3.1.0, 3.5.0, 3.6.0, 3.8.0, 3.9.0; studio/view/visualizations.ts:5-7; agent memory (local) for point 3
