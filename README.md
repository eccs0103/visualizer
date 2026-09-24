# Visualizer
A flexible framework for creating and managing custom visualizations.

[Changelog](./CHANGELOG.md) · [Contributing](./CONTRIBUTING.md)

![Preview](https://repository-images.githubusercontent.com/605233361/ff4e6308-2b43-4ac4-9efb-b1f97760242a)

## Guide
Add one or more songs to visualize them. Reorder, drop new files onto the page, or remove tracks from the playlist panel (<kbd>Shift</kbd> + <kbd>Tab</kbd>), and switch between repeat-one, once, loop-all, and shuffle playback modes. Drop a `.lrc` file alongside a track to show synced lyrics, or let the configurator look them up online.

Open the configurator with <kbd>Tab</kbd> and the playlist with <kbd>Shift</kbd> + <kbd>Tab</kbd>. Use <kbd>Space</kbd> to play/pause, <kbd>←</kbd>/<kbd>→</kbd> to seek, <kbd>Shift</kbd> + <kbd>←</kbd>/<kbd>→</kbd> to switch tracks, and <kbd>↑</kbd>/<kbd>↓</kbd> to cycle visualizations. Focus a track's drag handle and use <kbd>↑</kbd>/<kbd>↓</kbd> to reorder it.

In the configurator's **Layers** section, every visualization lists the layers it is drawn from. Drag a layer to reorder it, lower its opacity to fade it out, or pick a blend mode to change how it mixes with the layers below. Your arrangement is remembered per visualization. The **Lyrics** layer on top and the **Background** layer at the bottom are added by the engine and stay in place; the background can show an image you upload, with an optional effect (shake, beat pulse or parallax).

The system supports custom visualizations, which can be implemented by extending the `Visualization` class and declaring the layers it is drawn from with `this.newCustomLayer()`. A visualization keeps the shared, per-frame state; each layer only paints its own part of the picture, and the engine takes care of clearing, background, lyrics, compositing, and isolating a failing layer from the rest.

All visualization code is located in the [`studio/view/visualizations.ts`](./studio/view/visualizations.ts) file. This serves both as a reference for studying the structure of built-in visualizations and as a place to define your own.

Below is an example of how to create and attach a custom visualization:

```typescript
import "adaptive-extender/core";
import { type StageHost, type VisualizationHost } from "../models/visualization.js";
import { Registry, Visualization } from "../services/visualization-registry.js";

Registry.attach("My custom title", class extends Visualization {
	// Layers are declared bottom to top; the engine adds the background and the lyrics itself.
	#layerCircle = this.newCustomLayer("Circle", this.#drawCircle.bind(this));

	// Called when the canvas is resized or the active visualization changes.
	rebuild(stage: StageHost): void {
		const { width, height, audioset, environment } = stage;
	}

	// Called on every frame, before any layer is painted.
	update(stage: StageHost): void {
		const { camera, audioset, environment } = stage;
		camera.translateSelf(0, 0); // Origin is the canvas centre; shake or zoom every layer at once.
	}

	#drawCircle(host: VisualizationHost): void {
		const { context, audioset } = host;
		context.beginPath();
		context.arc(0, 0, 100 * audioset.volume, 0, 2 * Math.PI);
		context.fillStyle = "white";
		context.fill();
	}
});
```
