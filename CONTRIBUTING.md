# Contributing

## Custom Visualizations

A visualization is one file in [`studio/view/visualizations/`](./studio/view/visualizations/), imported from [`studio/view/visualizations.ts`](./studio/view/visualizations.ts):

```typescript
import "./visualizations/my-visualization.js";
```

The built-in [`pulsar.ts`](./studio/view/visualizations/pulsar.ts) and [`spectrogram.ts`](./studio/view/visualizations/spectrogram.ts) are the reference scripts.

A visualization is a class with two functions, `rebuild(host)` and `update(host)`, plus its layers, which are functions of the same `host`. Everything in `host` is read-only; the only thing a visualization writes is `host.context`. What a visualization sees is defined in one file, [`models/visualization.ts`](./studio/models/visualization.ts).

```typescript
"use strict";

import "adaptive-extender/worker";
import { Blend } from "../../models/blend.js";
import { type Host } from "../../models/visualization.js";
import { Registry, Visualization } from "../../services/visualization-registry.js";

Registry.attach("My visualization", class extends Visualization {
	#radius: number;

	constructor() {
		super();
		// Declared bottom to top: this is the default order of the layers.
		this.newLayer("Circle", this.#drawCircle.bind(this));
		this.newLayer("Glow", this.#drawGlow.bind(this), { blend: Blend.lighter, opacity: 0.6 });
	}

	// Called when the canvas is resized or the active visualization changes.
	rebuild(host: Host): void {
		const { width, height } = host.context.canvas;
		this.#radius = Math.min(width, height) / 2;
	}

	// Called on every frame, before any layer is painted. The context's transform is the camera: it moves every layer.
	update(host: Host): void {
		const zoom = 1 + host.audioset.bassLevel * 0.1;
		host.context.scale(zoom, zoom);
	}

	#drawCircle(host: Host): void {
		const { context, audioset } = host;
		context.beginPath();
		context.arc(0, 0, this.#radius * (0.5 + audioset.volume), 0, 2 * Math.PI);
		context.fillStyle = "white";
		context.fill();
	}

	#drawGlow(host: Host): void {
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
2. `rebuild(host)` runs when the canvas is resized, the theme changes, or the visualization becomes active.
3. On every engine frame, `update(host)` runs once, then every visible layer runs.

The engine runs at the rate the user picks (30–1200 fps). The audio, its analysis and the stems all advance on that same frame.

### `host`

| Property      | Type                                | Description                                                                                                                                                                                                                                     |
| :------------ | :---------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context`     | `OffscreenCanvasRenderingContext2D` | The only writable thing. In a layer: the layer's own canvas, cleared, origin at the centre, already moved by the camera. In `update`: its transform is the camera; anything drawn there is discarded. Its `canvas` has the size of the picture. |
| `audioset`    | `Audioset`                          | This frame's audio, below.                                                                                                                                                                                                                      |
| `environment` | `Environment`                       | This frame's surroundings, below.                                                                                                                                                                                                               |

### `host.audioset`

| Property           | Type                | Description                                         |
| :----------------- | :------------------ | :-------------------------------------------------- |
| `length`           | `number`            | Number of frequency bins.                           |
| `sampleRate`       | `number`            | Hz; bin `i` is at `i * sampleRate / 2 / length` Hz. |
| `time`             | `number`            | When this frame was captured, in milliseconds.      |
| `volume`           | `number`            | RMS of the waveform, `[0, 1]`.                      |
| `dataFrequency`    | `ArrayLike<number>` | The spectrum, `[0, 1]` per bin.                     |
| `dataTemporal`     | `ArrayLike<number>` | The waveform, `[0, 1]` with silence at `0.5`.       |
| `dataDrums`        | `ArrayLike<number>` | The drums' part of `dataFrequency`.                 |
| `dataBass`         | `ArrayLike<number>` | The bass line's part of `dataFrequency`.            |
| `dataVocals`       | `ArrayLike<number>` | The vocals' part of `dataFrequency`.                |
| `dataGuitar`       | `ArrayLike<number>` | The guitars' part of `dataFrequency`.               |
| `dataKeys`         | `ArrayLike<number>` | Piano's and keyboards' part of `dataFrequency`.     |
| `dataOther`        | `ArrayLike<number>` | The rest (strings, wind, pads…) of `dataFrequency`. |
| `spectralFlux`     | `number`            | How much the spectrum rose since the last frame.    |
| `subBass`          | `number`            | 20–60 Hz.                                           |
| `bass`             | `number`            | 60–250 Hz.                                          |
| `lowMid`           | `number`            | 250–500 Hz.                                         |
| `mid`              | `number`            | 500 Hz–2 kHz.                                       |
| `highMid`          | `number`            | 2–6 kHz.                                            |
| `high`             | `number`            | 6–20 kHz.                                           |
| `spectralCentroid` | `number`            | Weighted mean frequency, `[0, 1]` of the spectrum.  |
| `percussiveness`   | `number`            | Flux against its recent mean, `[0, 1]`.             |
| `beatDetected`     | `boolean`           | `true` on onset frames (at most one per ~58 ms).    |
| `dropIntensity`    | `number`            | Percussive sub-bass, `[0, 1]`.                      |
| `bassLevel`        | `number`            | Blend of the sub-bass and bass bands.               |

The six stem arrays come from a small neural model that decides, for every bin, which share of it belongs to each instrument; the six add back up to `dataFrequency`. They are estimates, and all the numbers above describe the whole mix. To get the same numbers for a stem, run a `SpectrumAnalysis` on it (see the tools).

### `host.environment`

| Property          | Type                   | Description                                                                                            |
| :---------------- | :--------------------- | :----------------------------------------------------------------------------------------------------- |
| `delta`           | `number`               | Seconds since the last frame.                                                                          |
| `colorBackground` | `Color`                | The theme colour, a copy of it.                                                                        |
| `lyrics`          | `LyricsWindow \| null` | `previous`, `current`, `next` (each `string \| null`) and `shake` (`0`–`1`), or `null` without lyrics. |

### Layers

`this.newLayer(name, painter, options?)` declares a layer in the constructor; the painter is a function of `host`. `options` sets the layer's defaults, which the user can change afterwards:

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

- **Read only, context out.** Nothing in `host` can be changed except by drawing on `host.context`. The engine decides everything else.
- **Layers are isolated.** Each layer paints on its own canvas, so state set in one layer (`fillStyle`, `filter`, clipping) never leaks into another. Use `blend` instead of `globalCompositeOperation` to mix layers.
- **Share data through the visualization, never through the canvas.** Compute paths, colours and metrics in `rebuild()` and `update()` and keep them in `#private` fields. `update()` always runs before the layers, whatever order the user puts them in. If one layer must be masked by another's shape, share the `Path2D` and use `context.clip()`.
- **The camera is `update`'s context transform.** Translate or scale `host.context` in `update()` to shake or zoom every layer at once; the background's shake and parallax effects follow it too.
- **Gradients can be shared.** A `CanvasGradient` made on one layer's context works on another's, so build it once per frame.
- **Heavy work goes in `rebuild()`.** It runs almost only once, so precompute sizes, colours, gradient stops, tables and buffers there. `update()` and the layers run every frame: give them only what truly changes per frame, and avoid allocating inside loops over `audioset.length`.
- **Failures stay local.** If `update()` throws, your layers stop and the engine layers keep drawing; if a painter throws, only that layer stops. Both are logged once and recover on the next rebuild.
- **Registration is validated.** A visualization that declares no layers, repeats a layer name, uses a reserved name, or repeats another visualization's name is rejected with a console message.

### Tools

[`services/visualization-tools.ts`](./studio/services/visualization-tools.ts) holds small, universal classes a visualization keeps in its fields between calls:

| Tool               | Use                                                                                                                                                                                                                                                                                               |
| :----------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Shaper`           | A `[0, 1] → [0, 1]` curve: `Shaper.sigmoid(steepness, center)`, `Shaper.arcsinSaturate`, `Shaper.smoothstep`, chained with `.then(next)` and applied with `.apply(value)`.                                                                                                                        |
| `HueDrift`         | Turns a colour's hue at `rate` degrees per second, by whole degrees: `tick(color, rate, environment.delta, factor)`.                                                                                                                                                                              |
| `StemMix`          | The spectrum rebuilt from the stems with one weight each: `new StemMix(drums, bass, vocals, guitar, keys, other, gain).mix(audioset)`. `new StemMix(0.5, 1, 1, 1, 1, 1, 1)` is the mix with the drums at half; `new StemMix(0, 0, 0, 1, 1, 1, 1)` is every instrument but drums, bass and vocals. |
| `SpectrumAnalysis` | The same analysis the engine runs on the mix, for any spectrum: `analyze(audioset.dataDrums, audioset)` once per frame, then read `percussiveness`, `bassLevel`, the bands, `energy`, and so on.                                                                                                  |
| `AutoRange`        | A value relative to the song that is playing: `new AutoRange(low, high)` with a typical range, `push(value, audioset.volume, environment.delta)` once per frame, then `level` is `0`–`1` of this song's last ~30 s. Silence of 1.5 s starts a new song.                                           |

Do not feed a full-range input into a colour's lightness: `Color.illuminate(1)` is white.
