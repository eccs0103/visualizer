---
status: deprecated
date: 2023-02-22
decision-makers: project author
---

# Offer the original visualizations, including Waveform

## Context and Problem Statement

The first versions shipped their own set of looks, Waveform among them. Pulsar arrived in 2.0.0 as their successor.

## Considered Options

1. Keep the original looks next to Pulsar.
2. Retire them in favour of Pulsar.

## Decision Outcome

The original looks ended with 2.0.0 (2024-01-17) and were removed by 2.1.0 (2024-07-20). Spectrogram, also retired, was brought back in 2.4.0 and is still offered (see [0006](0006-anyone-can-add-a-visualization-in-one-file.md)).

### Consequences

- Good, because the catalogue stays small and every look in it is maintained.
- Bad, because visitors lost looks they knew.

### Confirmation

Waveform is not in the list of visualizations.

## More Information

- Confidence: Stated
- Evidence: CHANGELOG 2.0.0, 2.4.0; commit 770c959 (2.1.0)
