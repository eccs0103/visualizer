# Contributing

## Custom Visualizations

A visualization is one file in [`studio/view/visualizations/`](./studio/view/visualizations/), imported from [`studio/view/visualizations.ts`](./studio/view/visualizations.ts):

```typescript
import "./visualizations/my-visualization.js";
```

The built-in [`pulsar.ts`](./studio/view/visualizations/pulsar.ts) and [`spectrogram.ts`](./studio/view/visualizations/spectrogram.ts) are the reference scripts.

A visualization is split in two parts:

- **The visualization** owns the shared, per-frame state: metrics, colours, paths, the camera. It never paints.
- **The layers** each paint one part of the picture on a canvas of their own. The engine clears every layer, composites the layers bottom to top, and lets the user reorder them and set their opacity and blend mode.

```typescript
"use strict";

import "adaptive-extender/core";
import { Blend } from "../../models/blend.js";
import { type StageHost, type VisualizationHost } from "../../models/visualization.js";
import { Registry, Visualization } from "../../services/visualization-registry.js";

Registry.attach("My visualization", class extends Visualization {
	// Declared bottom to top: the order of the fields is the default order of the layers.
	#layerCircle = this.newLayer("Circle", this.#drawCircle.bind(this));
	#layerGlow = this.newLayer("Glow", this.#drawGlow.bind(this), { blend: Blend.lighter, opacity: 0.6 });
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

### Lifecycle

1. `Registry.attach(name, class)` registers the visualization when its file is imported.
2. `rebuild(stage)` runs when the canvas is resized, the theme changes, or the visualization becomes active.
3. Every engine frame, `update(stage)` runs once, then every visible layer's painter runs with a `host`.

The engine runs at the rate the user picks (30–1200 fps). The audio analysis, the stems and the painters all advance on that same frame, so `update()` always sees fresh data.

### Layers

`this.newLayer(name, painter, options?)` returns the layer; keeping it in a field only gives the declaration a home. `options` sets the layer's defaults, which the user can change afterwards:

| Option    | Type     | Default        | Description                                                                    |
| :-------- | :------- | :------------- | :----------------------------------------------------------------------------- |
| `opacity` | `number` | `1`            | `0` hides the layer, `1` is fully opaque.                                      |
| `blend`   | `Blend`  | `Blend.normal` | How the layer mixes with the layers below it. Imported from `models/blend.js`. |

`Blend` values: `normal`, `lighter`, `multiply`, `screen`, `overlay`, `darken`, `lighten`, `difference`.

Every visualization also gets two layers that the engine adds and owns; the names `Background` and `Lyrics` are reserved:

| Layer        | Position | Description                                                                                                                                                                        |
| :----------- | :------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Background` | Bottom   | The theme colour, or an image the user uploaded with an optional effect: shake and parallax follow your camera, pulse follows the beat. Each visualization keeps its own settings. |
| `Lyrics`     | Top      | Synced lyrics, following the camera by `lyrics.shake`. Drawn only while there are lyrics.                                                                                          |

Both are pinned: the user can change their opacity and blend mode but cannot move them.

### Rules

- **Layers are isolated.** Each layer paints on its own canvas, so state set in one layer (`fillStyle`, `filter`, clipping) never leaks into another. Use `blend` instead of `globalCompositeOperation` to mix layers.
- **Share data through the visualization, never through the canvas.** Compute paths, colours and metrics in `rebuild()` and `update()` and keep them in `#private` fields. If one layer must be masked by another's shape, share the `Path2D` and use `context.clip()`.
- **The origin is the canvas centre.** `camera` is reset every frame; translate or scale it in `update()` to shake or zoom every layer at once. The background's shake and parallax effects follow it too.
- **Gradients can be shared.** A `CanvasGradient` made on one layer's context works on another's, so build it once per frame.
- **Keep frames cheap.** Avoid allocating inside loops over `audioset.length`. `environment.colorBackground` is a shared instance: copy it with `new Color(...)` before changing it.
- **Failures stay local.** If `update()` throws, your layers stop and the engine layers keep drawing; if a painter throws, only that layer stops. Both are logged once and recover on the next rebuild.
- **Registration is validated.** A visualization that declares no layers, repeats a layer name, uses a reserved name, or repeats another visualization's name is rejected with a console message.

### `stage` — in `rebuild()` and `update()`

| Property      | Type                       | Description                                          |
| :------------ | :------------------------- | :--------------------------------------------------- |
| `width`       | `number`                   | Canvas width in pixels.                              |
| `height`      | `number`                   | Canvas height in pixels.                             |
| `camera`      | `DOMMatrix`                | Transform applied to every layer, reset every frame. |
| `audioset`    | `AudiosetView`             | This frame's audio.                                  |
| `environment` | `VisualizationEnvironment` | This frame's engine state.                           |

### `host` — in a painter

| Property   | Type                                | Description                                      |
| :--------- | :---------------------------------- | :----------------------------------------------- |
| `context`  | `OffscreenCanvasRenderingContext2D` | The layer's own 2D context, cleared every frame. |
| `audioset` | `AudiosetView`                      | This frame's audio.                              |

### `audioset` — the mix

Everything in the spectrum table below, plus:

| Property       | Type           | Description                                             |
| :------------- | :------------- | :------------------------------------------------------ |
| `length`       | `number`       | Number of frequency bins.                               |
| `dataTemporal` | `Float32Array` | Waveform, `[0, 1]` with silence at `0.5`.               |
| `volume`       | `number`       | RMS of the waveform, `[0, 1]`.                          |
| `stems`        | `StemsView`    | `drums`, `bass`, `vocals` and `other`, each a spectrum. |

### Spectrum — the mix and each stem

| Property           | Type           | Description                                        |
| :----------------- | :------------- | :------------------------------------------------- |
| `dataFrequency`    | `Float32Array` | Spectrum, `[0, 1]` per bin.                        |
| `energy`           | `number`       | Sum of the six bands: how much is sounding.        |
| `spectralFlux`     | `number`       | How much the spectrum rose since the last frame.   |
| `subBass`          | `number`       | 20–60 Hz.                                          |
| `bass`             | `number`       | 60–250 Hz.                                         |
| `lowMid`           | `number`       | 250–500 Hz.                                        |
| `mid`              | `number`       | 500 Hz–2 kHz.                                      |
| `highMid`          | `number`       | 2–6 kHz.                                           |
| `high`             | `number`       | 6–20 kHz.                                          |
| `spectralCentroid` | `number`       | Weighted mean frequency, `[0, 1]` of the spectrum. |
| `percussiveness`   | `number`       | Flux against its recent mean, `[0, 1]`.            |
| `beatDetected`     | `boolean`      | `true` on onset frames (at most one per ~58 ms).   |
| `dropIntensity`    | `number`       | Percussive sub-bass, `[0, 1]`.                     |
| `bassLevel`        | `number`       | Blend of the sub-bass and bass bands.              |

A small neural model splits the music into the four stems; their spectra add back up to the mix's. A stem is only part of the mix, so its values are smaller and an absent stem is quiet rather than exactly zero: rescale a stem value before feeding it into ranges tuned for the mix.

### `environment`

| Property          | Type                 | Description                                                                                                              |
| :---------------- | :------------------- | :----------------------------------------------------------------------------------------------------------------------- |
| `delta`           | `number`             | Seconds since the last frame.                                                                                            |
| `colorBackground` | `Color`              | The theme colour (a shared instance, copy it before changing it).                                                        |
| `lyrics`          | `LyricsView \| null` | `previous`, `current` and `next` line (each `string \| null`) and `shake` (`0`–`1`), or `null` when there are no lyrics. |

### Tools

[`services/visualization-tools.ts`](./studio/services/visualization-tools.ts) holds what the built-in visualizations use:

| Tool          | Use                                                                                                                                                                                                                                                                                                                 |
| :------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Shaper`      | A `[0, 1] → [0, 1]` curve: `Shaper.sigmoid(steepness, center)`, `Shaper.arcsinSaturate`, `Shaper.smoothstep`, chained with `.then(next)` and applied with `.apply(value)`.                                                                                                                                          |
| `ColorDriver` | Rotates a colour's hue by whole degrees at `rate` degrees per second: keep one per visualization and call `tick(color, rate, environment.delta, factor)` in `update()`.                                                                                                                                             |
| `Drivers`     | Inputs fitted to the playing song, so an effect sweeps its whole range on a quiet ballad and a loud master alike: `drop`, `percussiveness`, `bassLevel`, `subBass`, `centroid`, `high`, `highMid`, `flux`, `volume`. Keep one per visualization and call `update(audioset, environment.delta)` first in `update()`. |
| `Silhouette`  | The mix's spectrum with the drums reduced, so hats and snares stop jagging a shape: `new Silhouette(weightDrums, gain).shape(audioset)`.                                                                                                                                                                            |

Do not feed a full-range input into a colour's lightness: `Color.illuminate(1)` is white.
