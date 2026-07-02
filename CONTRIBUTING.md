# Contributing

## Custom Visualizations

Custom visualizations are added in [`studio/view/visualizations.ts`](./studio/view/visualizations.ts).

Extend `Visualization` and pass the class to `Registry.attach()`. The call must appear before the visualizer starts.

```typescript
import "adaptive-extender/core";
import { type VisualizationHost } from "../models/visualization.js";
import { Registry, Visualization } from "../services/visualization-registry.js";

Registry.attach("My custom title", class extends Visualization {
	// Called when the canvas is resized or the active visualization changes.
	rebuild(host: VisualizationHost): void {
		const { context, audioset, environment } = host;
		const { width, height } = context.canvas;
	}

	// Called on every frame.
	update(host: VisualizationHost): void {
		const { audioset, environment } = host;
		const { delta, isLaunched } = environment;
	}
});
```

### Available properties

`host` inside both `rebuild()` and `update()` exposes:

| Property      | Type                                | Description                         |
| :------------ | :---------------------------------- | :---------------------------------- |
| `context`     | `OffscreenCanvasRenderingContext2D` | Canvas 2D rendering context.        |
| `audioset`    | `AudiosetView`                      | Real-time audio analysis snapshot.  |
| `environment` | `VisualizationEnvironment`          | Engine state for the current frame. |

### `audioset` properties

| Property           | Type           | Description                                    |
| :----------------- | :------------- | :--------------------------------------------- |
| `length`           | `number`       | Number of frequency bins.                      |
| `dataFrequency`    | `Float32Array` | Normalised frequency-domain data `[0, 1]`.     |
| `dataTemporal`     | `Float32Array` | Normalised time-domain data `[0, 1]`.          |
| `volume`           | `number`       | Normalised RMS volume `[0, 1]`.                |
| `amplitude`        | `number`       | Normalised peak amplitude `[0, 1]`.            |
| `spectralFlux`     | `number`       | Rate of change in the spectrum.                |
| `subBass`          | `number`       | Sub-bass band energy (20–60 Hz).               |
| `bass`             | `number`       | Bass band energy (60–250 Hz).                  |
| `lowMid`           | `number`       | Low-mid band energy (250–500 Hz).              |
| `mid`              | `number`       | Mid band energy (500 Hz–2 kHz).                |
| `highMid`          | `number`       | High-mid band energy (2–4 kHz).                |
| `high`             | `number`       | High band energy (4–20 kHz).                   |
| `zeroCrossingRate` | `number`       | Zero-crossing rate.                            |
| `spectralCentroid` | `number`       | Weighted mean frequency.                       |
| `percussiveness`   | `number`       | Estimated percussive content `[0, 1]`.         |
| `beatDetected`     | `boolean`      | `true` on detected beat frames.                |
| `dropIntensity`    | `number`       | Drop intensity estimate.                       |
| `bassLevel`        | `number`       | Smoothed bass level.                           |
| `distortionLevel`  | `number`       | Estimated distortion level.                    |
| `djFocus`          | `number`       | DJ-adjusted analyser focus (dB).               |
| `djSpread`         | `number`       | DJ-adjusted analyser spread (dB).              |
| `djBoost`          | `number`       | DJ-adjusted gain multiplier.                   |
| `djTilt`           | `number`       | DJ-adjusted spectral tilt (dB).                |
| `djPunch`          | `number`       | DJ-adjusted compressor punch `[0, 1]`.         |
| `isActive()`       | `boolean`      | `true` when the audio has meaningful signal.   |
| `isPercussive()`   | `boolean`      | `true` when the audio is primarily percussive. |

### `environment` properties

| Property          | Type      | Description                             |
| :---------------- | :-------- | :-------------------------------------- |
| `isLaunched`      | `boolean` | `false` when the browser tab is hidden. |
| `delta`           | `number`  | Seconds elapsed since the last frame.   |
| `fps`             | `number`  | Current frame rate.                     |
| `colorBackground` | `Color`   | Current background colour.              |

---

## Submitting NN Weights

The auto-correction system uses a neural network that learns in real time to adjust the analyser's focus, spread, boost, tilt, and punch for the audio it hears. If you have trained a set of weights that performs noticeably better, you can submit them to become the new default.

### Architecture

Four-layer actor-critic network with leaky-ReLU activations in the hidden layers:

```
320 inputs → 64 → 32 → control head: 5 outputs (tanh)
                      → value head:   1 output  (linear)
```

Inputs are normalised frequency-domain and time-domain bins. The control head outputs five bipolar deltas (tanh) mapped to the five DJ parameters; the value head estimates the expected long-term reward for online TD learning.

### Training in developer mode

1. Open the studio and append `?developer` to the URL, e.g.:
   ```
   http://localhost:5173/studio/?developer
   ```
2. Load a song and press <kbd>Tab</kbd> to open the Configurator.
3. In the **AI** section, enable **Auto Learn** to let the model learn from the audio continuously via reinforcement learning. Use the **Good** / **Bad** feedback buttons to guide learning when the auto-correction is noticeably right or wrong.
4. Once satisfied with the reward shown in the panel, click **Export** — this downloads `nn-weights.json`.

### Submitting

In the **AI** section, click the **Share** button — it opens a pre-filled GitHub issue form. Attach the downloaded `nn-weights.json` and include a brief description of what audio you trained on and the reward level you observed.
