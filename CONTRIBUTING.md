# Contributing

## Custom Visualizations

Custom visualizations are added in [`studio/view/visualizations.ts`](./studio/view/visualizations.ts).

Extend `Visualization`, declare the layers it is drawn from as fields with `this.newCustomLayer()`, and pass the class to `Registry.attach()`. The call must appear before the visualizer starts.

A visualization is split in two parts:

- **The visualization** owns the shared, per-frame state: metrics, colours, paths, the camera. It never paints.
- **The layers** each paint one part of the picture on a canvas of their own. The engine clears every layer, resets its state, composites the layers bottom to top, and lets the user reorder them and set their opacity and blend mode.

```typescript
import "adaptive-extender/core";
import { Blend } from "../models/blend.js";
import { type StageHost, type VisualizationHost } from "../models/visualization.js";
import { Registry, Visualization } from "../services/visualization-registry.js";

Registry.attach("My custom title", class extends Visualization {
	// Declared bottom to top: the order of the fields is the default order of the layers.
	#layerCircle = this.newCustomLayer("Circle", this.#drawCircle.bind(this));
	#layerGlow = this.newCustomLayer("Glow", this.#drawGlow.bind(this), { blend: Blend.lighter, opacity: 0.6 });
	#radius: number;

	// Called when the canvas is resized or the active visualization changes.
	rebuild(stage: StageHost): void {
		const { width, height } = stage;
		this.#radius = Math.min(width, height) / 2;
	}

	// Called on every frame, before any layer is painted.
	update(stage: StageHost): void {
		const { camera, audioset } = stage;
		camera.scaleSelf(1 + audioset.bassLevel * 0.1);
	}

	#drawCircle(host: VisualizationHost): void {
		const { context } = host;
		context.beginPath();
		context.arc(0, 0, this.#radius * 0.5, 0, 2 * Math.PI);
		context.fillStyle = "white";
		context.fill();
	}

	#drawGlow(host: VisualizationHost): void {
		const { context } = host;
		context.filter = "blur(24px)";
		context.beginPath();
		context.arc(0, 0, this.#radius * 0.5, 0, 2 * Math.PI);
		context.fillStyle = "deepskyblue";
		context.fill();
	}
});
```

`this.newCustomLayer(name, painter, options?)` returns the layer; keeping it in a field is only there to give the declaration a home. The painter receives a `VisualizationHost`. `options` is optional and sets the layer's defaults, which the user can change afterwards:

| Option    | Type     | Default        | Description                                                                    |
| :-------- | :------- | :------------- | :----------------------------------------------------------------------------- |
| `opacity` | `number` | `1`            | `0` hides the layer, `1` is fully opaque.                                      |
| `blend`   | `Blend`  | `Blend.normal` | How the layer mixes with the layers below it. Imported from `models/blend.js`. |

`Blend` values: `normal`, `lighter`, `multiply`, `screen`, `overlay`, `darken`, `lighten`, `difference`.

### Engine layers

Every visualization also gets two layers that the engine adds and owns. You do not declare them, and the names `Background` and `Lyrics` are reserved:

| Layer        | Position | Description                                                                                                                                                                                       |
| :----------- | :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Background` | Bottom   | The theme colour, or an image the user uploaded (cover, contain or stretch) with an optional effect: shake and parallax follow your camera, pulse follows the beat. Shared by all visualizations. |
| `Lyrics`     | Top      | Synced lyrics, following the camera by `lyrics.shake`. Drawn only while there are lyrics.                                                                                                         |

Both are pinned: the user can change their opacity and blend mode, but cannot move them.

### Rules

- **Layers are isolated.** Each layer paints on its own canvas, so state set in one layer (`fillStyle`, `filter`, `globalCompositeOperation`, clipping) never leaks into another. Set what you need inside every painter, and use `blend` instead of `globalCompositeOperation` to mix layers.
- **Share data through the visualization, never through the canvas.** Compute paths, colours and metrics in `rebuild()` and `update()` and store them in `#private` fields. `update()` always runs before the layers, so a layer can rely on it whatever order the user puts the layers in. If one layer must be masked by another's shape, share the `Path2D` and use `context.clip()`.
- **The origin is the canvas centre.** `camera` starts as the identity matrix every frame; translate or scale it in `update()` to shake or zoom every layer at once. A painter that fills the whole canvas can call `context.resetTransform()` first. The camera also drives the background's shake and parallax effects, so a visualization that never moves its camera gives them nothing to follow.
- **Gradients can be shared.** A `CanvasGradient` created on one layer's context can be used by another layer's context, so build it once per frame (for example in the first painter that needs it, and reset the field in `update()`) instead of once per layer.
- **Keep frames cheap.** The engine runs your code every frame. Avoid allocating per frequency bin (`new Color(...)`, template strings) inside loops over `audioset.length`; a gradient with a few dozen stops looks the same as one with hundreds. `environment.colorBackground` is a shared instance: copy it with `new Color(...)` before changing it.
- **Failures stay local.** If `update()` throws, the visualization's own layers stop and the engine layers keep drawing; if a painter throws, only that layer is disabled. Both are logged once and recover on the next rebuild.
- **Registration is validated.** A visualization that declares no layers, repeats a layer name, uses a reserved name, or repeats another visualization's name is rejected with a message in the console; everything else keeps working.

### Migrating from `update(host)`

Earlier versions had one `update(host)` that painted the whole canvas, including the background and lyrics. To migrate: keep the state and the maths in `rebuild(stage)` and `update(stage)`, turn each drawing step into a painter declared with `this.newCustomLayer()`, delete the background and lyrics drawing (the engine provides them), and move the clearing, shaking and zooming of the canvas to `stage.camera`.

### Available properties

`stage` inside `rebuild()` and `update()` exposes:

| Property      | Type                       | Description                                                     |
| :------------ | :------------------------- | :-------------------------------------------------------------- |
| `width`       | `number`                   | Canvas width in pixels.                                         |
| `height`      | `number`                   | Canvas height in pixels.                                        |
| `camera`      | `DOMMatrix`                | Transform applied to every layer, reset to identity each frame. |
| `audioset`    | `AudiosetView`             | Real-time audio analysis snapshot.                              |
| `environment` | `VisualizationEnvironment` | Engine state for the current frame.                             |

`host` inside a layer painter exposes:

| Property      | Type                                | Description                                      |
| :------------ | :---------------------------------- | :----------------------------------------------- |
| `context`     | `OffscreenCanvasRenderingContext2D` | The layer's own 2D context, cleared every frame. |
| `audioset`    | `AudiosetView`                      | Real-time audio analysis snapshot.               |
| `environment` | `VisualizationEnvironment`          | Engine state for the current frame.              |

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

| Property          | Type                 | Description                                                                               |
| :---------------- | :------------------- | :---------------------------------------------------------------------------------------- |
| `isLaunched`      | `boolean`            | `false` when the browser tab is hidden.                                                   |
| `delta`           | `number`             | Seconds elapsed since the last frame.                                                     |
| `fps`             | `number`             | Current frame rate.                                                                       |
| `colorBackground` | `Color`              | Current background colour (a shared instance, copy it before changing it).                |
| `lyrics`          | `LyricsView \| null` | Synced lyrics for the current playback point, or `null` if lyrics are off or unavailable. |

### `lyrics` properties

`environment.lyrics`, when not `null`, exposes:

| Property   | Type             | Description                                                                  |
| :--------- | :--------------- | :--------------------------------------------------------------------------- |
| `previous` | `string \| null` | Previous lyric line, or `null` if there is none.                             |
| `current`  | `string \| null` | Active lyric line, or `null` if there is none.                               |
| `next`     | `string \| null` | Next lyric line, or `null` if there is none.                                 |
| `shake`    | `number`         | `0`–`1`, how much of the visualization's own motion should affect this text. |

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
