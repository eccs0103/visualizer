# Contributing

## Custom Visualizations

Custom visualizations are added in [`studio/view/visualizations.ts`](./studio/view/visualizations.ts).

Extend `Visualizer.Visualization` and pass the class to `Visualizer.attach()`. The call must appear before the `Visualizer` instance is created.

```typescript
import { Visualizer } from "../services/visualizer.js";

Visualizer.attach("My custom title", class extends Visualizer.Visualization {
	// Called when the canvas is resized or the active visualization changes.
	rebuild(): void {
		const { context, audioset } = this;
		const { width, height } = context.canvas;
	}

	// Called on every frame.
	update(): void {
		const { audioset, environment } = this;
		const { delta, isLaunched } = environment;
	}
});
```

### Available properties

`this` inside both `rebuild()` and `update()` exposes:

| Property      | Type                       | Description                         |
| :------------ | :------------------------- | :---------------------------------- |
| `context`     | `CanvasRenderingContext2D` | Canvas 2D rendering context.        |
| `audioset`    | `Audioset`                 | Real-time audio analysis snapshot.  |
| `environment` | `VisualizationEnvironment` | Engine state for the current frame. |

### `audioset` properties

| Property           | Type                         | Description                                      |
| :----------------- | :--------------------------- | :----------------------------------------------- |
| `length`           | `number`                     | Number of frequency bins.                        |
| `dataFrequency`    | `Float32Array`               | Normalised frequency-domain data `[0, 1]`.       |
| `dataTemporal`     | `Float32Array`               | Normalised time-domain data `[0, 1]`.            |
| `volume`           | `number`                     | Normalised RMS volume `[0, 1]`.                  |
| `amplitude`        | `number`                     | Normalised peak amplitude `[0, 1]`.              |
| `spectralFlux`     | `number`                     | Rate of change in the spectrum.                  |
| `subBass`          | `number`                     | Sub-bass band energy (20–60 Hz).                 |
| `bass`             | `number`                     | Bass band energy (60–250 Hz).                    |
| `lowMid`           | `number`                     | Low-mid band energy (250–500 Hz).                |
| `mid`              | `number`                     | Mid band energy (500 Hz–2 kHz).                  |
| `highMid`          | `number`                     | High-mid band energy (2–4 kHz).                  |
| `high`             | `number`                     | High band energy (4–20 kHz).                     |
| `zeroCrossingRate` | `number`                     | Zero-crossing rate.                              |
| `spectralCentroid` | `number`                     | Weighted mean frequency.                         |
| `percussiveness`   | `number`                     | Estimated percussive content `[0, 1]`.           |
| `beatDetected`     | `boolean`                    | `true` on detected beat frames.                  |
| `scene`            | `Scene`                      | Current scene classification.                    |
| `confidence`       | `number`                     | Model confidence for the current scene `[0, 1]`. |
| `probabilities`    | `ReadonlyMap<Scene, number>` | Per-scene softmax probabilities.                 |
| `dropIntensity`    | `number`                     | Drop intensity estimate.                         |
| `bassLevel`        | `number`                     | Smoothed bass level.                             |
| `distortionLevel`  | `number`                     | Estimated distortion level.                      |

### `environment` properties

| Property     | Type      | Description                             |
| :----------- | :-------- | :-------------------------------------- |
| `isLaunched` | `boolean` | `false` when the browser tab is hidden. |
| `delta`      | `number`  | Seconds elapsed since the last frame.   |
| `fps`        | `number`  | Current frame rate.                     |

### Scenes

The `Scene` enum has six values: `Silence`, `Speech`, `Ambient`, `Buildup`, `Beat`, `Drop`.

---

## Submitting NN Weights

The neural network classifies audio into the six scenes listed above. If you have trained a set of weights that performs noticeably better, you can submit them to become the new default.

### Architecture

Three-layer fully-connected network with ReLU activations:

```
320 inputs → 64 → 32 → 6 outputs (one per scene)
```

Inputs are normalised frequency-domain and time-domain bins. Outputs are logits converted to softmax probabilities.

### Training in developer mode

1. Open the studio and append `?developer` to the URL, e.g.:
   ```
   http://localhost:5173/studio/?developer
   ```
2. Load a song and press <kbd>Tab</kbd> to open the Configurator.
3. In the **AI** section, click scene buttons to label the currently playing audio. Enable **Auto Train** to let the model also learn from DSP-derived labels automatically.
4. Once satisfied with the confidence shown in the panel, click **Export** — this downloads `nn-weights.json`.

### Submitting

Open a **Pull Request** that replaces [`resources/data/nn-weights.json`](./resources/data/nn-weights.json) with your exported file, or open an **Issue** and attach the JSON.

Include a brief description of what audio you trained on and the model confidence you observed.
