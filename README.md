# Visualizer
A flexible framework for creating and managing custom visualizations.

[Changelog](./CHANGELOG.md) · [Contributing](./CONTRIBUTING.md)

![Preview](https://repository-images.githubusercontent.com/605233361/ff4e6308-2b43-4ac4-9efb-b1f97760242a)

## Guide
Upload any song to visualize it.  

The system supports custom visualizations, which can be implemented by extending the `Visualizer.Visualization` class. These visualizations allow for creative and dynamic interactions, such as audio-responsive effects or graphical animations.

All visualization code is located in the [`studio/view/visualizations.ts`](./studio/view/visualizations.ts) file. This serves both as a reference for studying the structure of built-in visualizations and as a place to define your own.

Below is an example of how to create and attach a custom visualization:

```typescript
Visualizer.attach("My custom title", class extends Visualizer.Visualization {
	// Called when the canvas is resized or the active visualization changes.
	rebuild(): void {
		const { context, audioset } = this;
		context;  // CanvasRenderingContext2D — rendering context.
		audioset; // Audioset — real-time audio data.

		const { width, height } = context.canvas;
	}

	// Called on every frame.
	update(): void {
		const { environment } = this;
		const { delta, fps, isLaunched } = environment;
		delta;      // Seconds since the last frame.
		fps;        // Current frame rate.
		isLaunched; // False when the browser tab is hidden.
	}
});
```
