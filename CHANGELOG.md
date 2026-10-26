## 3.8.0 (27.10.2026)
- Added the **Stems** visualization, shown when the address ends with `?for=developers`.
- The browser console now shows the address with `?for=developers` that opens the developer settings.
- Added `Smoother`, `Trail`, `Shaper.exponential(steepness)`, `shaper.between(low, high)` and `SpectrumAnalysis.centroid(...analyses)` to [visualization-tools](./studio/services/visualization-tools.ts) — see [CONTRIBUTING.md](./CONTRIBUTING.md).
- Added [stems.ts](./studio/view/visualizations/stems.ts) as a third reference script. [CONTRIBUTING.md](./CONTRIBUTING.md) now asks to name the visualization's class and keep every fixed number, curve and colour as a `static #` field.
- **Spectrogram**'s beat zoom now relaxes within a quarter of a second after each beat. Before, it hardly faded, so the picture stayed zoomed in.
- **Pulsar** and **Spectrogram** no longer learn a song's quiet-to-loud range from silence, so their effects react correctly right after a pause or at the start of a new song.
- **Pulsar** takes about a third less time per frame and **Spectrogram** about an eighth less, drawing exactly the same picture.
- **Breaking:** `HueDrift` now holds its colour: create it with `new HueDrift(color, rate)`, call `tick(environment.delta, factor)` once per frame and read `color`, instead of `tick(color, rate, delta, factor)`.
- **Breaking:** `AutoRange.push(value, volume, delta)` is now `push(value, host)`. Pass the `host` your `update()` receives.

## 3.7.0 (18.10.2026)
- Added an **AI** section to the configurator for the AIs that listen to the song, each with its own settings under it. Its first entry is **Stem separation**: a switch turns the AI on or off, **Status** shows whether it runs, on which graphics card and how many times per second it updates (with a hint when the chosen model is too heavy for this computer), and **Model** picks the trained model with its size and a short description; <kbd>Shift</kbd> + <kbd>↑</kbd>/<kbd>↓</kbd> cycles through the models. Both choices are remembered.
- Added the **Deep listening** model, which follows how every sound changes over time. New visitors start with it; **Standard** stays available.
- Added **Smoothness** to the configurator: how many frames per second are drawn now, out of the most the Rate and the screen allow. A freeze or a drop is marked at once, and the mark stays until the page has run smoothly for a few seconds.
- Added a warning button next to the configurator button on the main screen. It appears when graphics acceleration is off, the page runs slowly, a recording stutters or the AI can't run. Its tooltip explains each problem and how to fix it, and clicking it opens the configurator.
- The **Visualizer** section of the configurator is renamed **Engine**, and the Stem separation status moved into the new AI section.
- **Rate** is now reached. Before, a Rate of 60 drew only about 40 frames per second on a 60 Hz screen and 48 on a 144 Hz one; now it draws 60 on both. The picture is never drawn more often than the screen shows.
- When the computer can't draw every frame, the picture now skips frames instead of falling further and further behind, so setting changes also take effect at once instead of seconds later.
- The instrument sliders (**Drums ×** … **Other ×**) are now in the AI section and appear when the address ends with `?for=developers` instead of `?developer`. The Developer section and its test models are removed.
- Without WebGPU the AI status now says "This browser can't run the AI.", and when the browser blocks the graphics card it explains how to turn graphics acceleration on, instead of showing a raw error.
- The AI status no longer stays on "Loading…" after switching from one model that can't run to another that fails the same way, and a newly chosen model is no longer marked as too slow because of the previous one.
- Recorded clips no longer stay in memory after they are downloaded.
- Durations of a day or longer are shown correctly; before, a day counted as 24 minutes.
- The page description for search engines now describes stem separation instead of the removed self-teaching DJ.
- The visualization example in [CONTRIBUTING.md](./CONTRIBUTING.md) now imports `adaptive-extender/worker`, the environment visualizations run in.

## 3.6.0 (13.10.2026)
- Added a **Stem separation (AI)** row to the configurator. It shows whether the AI that splits the song into instruments is active, which graphics card it runs on and how many times per second it updates, with a hint when it runs slower than it should on this computer.
- Added a **Developer** section, shown when the address ends with `?developer`: pick which trained stem model runs (<kbd>Shift</kbd> + <kbd>↑</kbd>/<kbd>↓</kbd> cycles it) and make each instrument stronger or weaker for the visuals. Nothing in it is saved.
- Added the visualization tools to the contributor API: `Shaper`, `HueDrift`, `StemMix`, `SpectrumAnalysis` and `AutoRange` in [visualization-tools](./studio/services/visualization-tools.ts) — see [CONTRIBUTING.md](./CONTRIBUTING.md).
- Added `audioset.dataGuitar`, `audioset.dataKeys`, `audioset.sampleRate` and `audioset.time` to the contributor API.
- The playback-mode button now shows the name of the current mode next to its icon.
- Stem separation now runs on the graphics card through WebGPU and splits six instruments (drums, bass, vocals, guitar, keys and the rest) instead of four, updating as often as the graphics card allows instead of 10 times per second. In a browser without WebGPU the row reads **Unavailable** and all instruments react together.
- `Pulsar` and `Spectrogram` now take each effect from the instrument it belongs to and measure it against the song that is playing, so loud songs no longer hold their effects at the maximum. Their **Drums**, **Bass**, **Vocals** and **Other** layers are removed.
- `environment.colorBackground` is now a copy, so a visualization may change it freely.
- The configurator's descriptions are rewritten in plain words, and the browser's page translation now translates the interface while leaving song titles, times and lyrics untouched.
- **Breaking:** Removed the AI auto-correction (the self-teaching DJ) with its dashboard (learning steps, continuous learning, feedback, reset, export and share) and the NN-weights submission. Focus, Spread, Boost, Tilt and Punch are always set by hand; a saved AI setting is ignored.
- **Breaking:** `rebuild()`, `update()` and every layer painter now receive the same `host` (`context`, `audioset`, `environment`). Declare layers in the constructor with `this.newLayer(name, painter, options?)` instead of fields set by `this.newCustomLayer()`, read the size from `host.context.canvas` instead of `stage.width` and `stage.height`, and move or zoom every layer by transforming `host.context` in `update()` instead of `stage.camera`. See [CONTRIBUTING.md](./CONTRIBUTING.md).
- **Breaking:** Renamed `StageHost` and `VisualizationHost` to `Host`, `AudiosetView` to `Audioset`, `VisualizationEnvironment` to `Environment` and `LyricsView` to `LyricsWindow`. Update the type imports from `models/visualization.js`.
- **Breaking:** Renamed `audioset.dataFrequencyDrums`, `dataFrequencyBass`, `dataFrequencyVocals` and `dataFrequencyOther` to `dataDrums`, `dataBass`, `dataVocals` and `dataOther`. Every audio array is now a read-only `ArrayLike<number>`, and `dataOther` holds only what is not drums, bass, vocals, guitar or keys; `new StemMix(0, 0, 0, 1, 1, 1, 1).mix(audioset)` gives the former "other".
- **Breaking:** Removed `audioset.amplitude`, `zeroCrossingRate`, `distortionLevel`, `djFocus`, `djSpread`, `djBoost`, `djTilt`, `djPunch`, `isActive()` and `isPercussive()`, and `environment.isLaunched` and `environment.fps`. Use `volume` for loudness, `percussiveness` for percussive content and `1 / environment.delta` for the frame rate; the `dj*` values have no replacement because nothing drives the knobs any more.
- **Breaking:** Removed the undocumented `ColorDriver` and `Stems` helpers from `visualization-tools.ts`. Use `HueDrift` and `StemMix` instead.

## 3.5.0 (25.09.2026)
- Added layers — every visualization is now drawn from a stack of layers, listed in a new **Layers** section of the configurator. Drag a layer by its handle (or focus the handle and press <kbd>↑</kbd>/<kbd>↓</kbd>) to reorder it, lower its opacity to fade it out, or pick a blend mode (`Normal`, `Lighter`, `Multiply`, `Screen`, `Overlay`, `Darken`, `Lighten` or `Difference`). The arrangement is saved per visualization.
- Added a **Background** layer, pinned to the bottom of every visualization. It shows the theme colour or an image you upload (cover, contain or stretch, up to 50 MB, anything wider or taller than 3840 px is scaled down), with an optional shake, beat pulse (the default) or parallax effect and an intensity slider. Each visualization keeps its own image and settings, and the image is remembered between sessions.
- The **Lyrics** layer is now pinned on top of every visualization with its own opacity and blend mode, and follows the camera by the **Shake** amount.
- `Pulsar` is now drawn from the `Shadow`, `Wave` and `Halo` layers, and `Spectrogram` from the `Vignette`, `Thread`, `Bloom` and `Ridge` layers.
- A visualization that fails no longer takes the whole picture down: a failing `update()` stops only its own layers, a failing painter disables only that layer, and both recover on the next rebuild. A visualization that declares no layers, repeats a layer name, uses the reserved `Background` or `Lyrics` names, or repeats another visualization's name is rejected with a message in the console.
- Added `this.newCustomLayer(name, painter, options?)`, `StageHost` (`width`, `height`, `camera`, `audioset`, `environment`) and `Blend` to the contributor API — see [CONTRIBUTING.md](./CONTRIBUTING.md).
- The playlist's file picker now offers `.txt` lyrics files too, and its button is renamed **Add songs or lyrics**.
- Added tooltips to the interface buttons, a playlist hint about dropping files and attaching lyrics, a hint in the player while the playlist is empty, and a tooltip on the playback-mode button that names the current mode.
- The neural network now stops running while auto-correction is off.
- **Breaking:** `rebuild(host)` and `update(host)` of a `Visualization` now receive a `StageHost` and no longer paint. Declare each drawing step as a layer with `this.newCustomLayer()`, move the clearing, shaking and zooming of the canvas to `stage.camera`, and delete your background and lyrics drawing, which the engine now provides. See "Migrating from `update(host)`" in [CONTRIBUTING.md](./CONTRIBUTING.md).
- **Breaking:** `environment.colorBackground` is now a shared instance. Copy it with `new Color(...)` before changing it.

## 3.4.1 (12.09.2026)
- `Pulsar`'s halo and the `Spectrogram`'s ridge now draw their bass glow as a blurred extra pass instead of a canvas shadow, and skip it entirely when the blur would round below a pixel.
- The `Spectrogram`'s bass bloom and shimmer thread now take their tint from the ridge's current rotated color instead of the fixed red seed, so they recolor along with the ridge.

## 3.4.0 (11.09.2026)
- Added synced lyrics — attach a `.lrc` (or `.txt`) file alongside a track and the active visualization draws the current line, with the previous and next lines above and below it. `Pulsar` and `Spectrogram` display them.
- Added online lyrics lookup — a track with no attached file gets synced lyrics searched by filename, cached per track and rechecked once a day.
- Added a **Lyrics** section to the configurator: a lyrics toggle, a lookup toggle, and a **Shake** slider (0–1) for how much of the visualization's own motion carries the text.
- Tracks now appear in the playlist as you add them, disabled until their duration is read, instead of the whole batch landing when the last file finishes. A file that fails to load is dropped from the list.
- Playlist rows now carry a mark when the track has lyrics.
- The configurator now nests its options — analysis options under **Type**, the AI's learning and feedback controls under **AI**.
- Added `environment.lyrics` (`LyricsView | null` with `previous`, `current`, `next`, `shake`) to the contributor API — see [CONTRIBUTING.md](./CONTRIBUTING.md).

## 3.3.2 (04.08.2026)
- Added keyboard reordering — focus a track's drag handle and press <kbd>↑</kbd>/<kbd>↓</kbd> to move that track up or down the playlist.
- The playlist now updates rows in place instead of rebuilding the whole list, so keyboard focus survives track changes and rows no longer flicker on every update.
- The "No tracks yet" message now uses the correct muted styling, and an empty track list no longer leaves a gap above it.
- The playback-mode button now starts on the correct icon instead of briefly showing none.
- **Breaking:** <kbd>Tab</kbd> now opens the configurator and <kbd>Shift</kbd> + <kbd>Tab</kbd> opens the playlist, restoring the arrangement used before 3.3.0. Use <kbd>Shift</kbd> + <kbd>Tab</kbd> wherever you pressed <kbd>Tab</kbd> in 3.3.0.

## 3.3.0 (01.08.2026)
- Replaced single-track upload with a full playlist: add multiple tracks via the file picker or by dropping files onto the page, reorder them by dragging, and remove them individually.
- Added playback modes — repeat one, play through once (default), loop all, and shuffle — cycled from a button in the new playlist panel.
- Added previous/next track controls next to the play indicator, plus <kbd>Shift</kbd> + <kbd>←</kbd>/<kbd>→</kbd> shortcuts.
- Added <kbd>←</kbd>/<kbd>→</kbd> to seek 5 seconds back or forward.
- The current track title is now shown in the interface.
- A track saved in an earlier version is carried over into the playlist automatically on first launch.
- Audio data left behind by removed tracks is now cleaned up on startup.
- The panel you last had open — playlist or configurator — is reopened on the next session.
- Visualization settings now heal themselves when a visualization is added or removed, instead of failing to start.
- <kbd>Space</kbd> and the arrow keys are now ignored while you are typing in a field, and the arrows are ignored while a panel is open.
- Redesigned the icon set; the playlist and configurator panels now keep their header fixed while the contents scroll.
- Fixed the play/pause indicator and screen wake lock not resetting when a track finished playing.
- **Breaking:** <kbd>Tab</kbd> now opens the playlist and <kbd>Shift</kbd> + <kbd>Tab</kbd> opens the configurator. Use <kbd>Shift</kbd> + <kbd>Tab</kbd> where you previously pressed <kbd>Tab</kbd>.
- **Breaking:** Visualizations are now cycled with <kbd>↑</kbd>/<kbd>↓</kbd> instead of <kbd>Shift</kbd> + <kbd>Tab</kbd>.

## 3.2.0 (15.07.2026)
- Added a screen wake lock — the display now stays awake while audio is playing or a clip is recording.
- The Spectrogram visualization has been redesigned with a mirrored frequency ridge, bass bloom, a temporal shimmer thread, and a vignette, plus beat-synced pulsing and DJ-focus-weighted detail.
- Visualizations now recolor live when the page theme (light/dark) changes instead of only on the next resize.
- The selected visualization is now saved and restored between sessions.
- Improved the playback seek bar: scrubbing now uses pointer capture and works reliably on touch devices.
- The Pulsar visualization now derives its inner halo tint from the background color and has a stronger bass-driven glow.

## 3.1.0 (12.07.2026)
- Auto-correction upgraded from a static scene classifier to a self-teaching DJ that continuously adjusts focus, spread, boost, tilt, and punch in real time via reinforcement learning.
- Added gain boost, spectral tilt, and compressor punch controls to the Configurator, giving direct access to the five parameters the DJ head learns to tune automatically.
- Visualization rendering moved to a dedicated Web Worker with an OffscreenCanvas, keeping the main thread free and improving frame consistency under load.
- Visualization authoring API updated: custom visualizations now extend `Visualization` and register via `Registry.attach()`; `rebuild()` and `update()` receive a `VisualizationHost` parameter instead of accessing properties via `this`.
- The built-in Pulsar and Spectrogram visualizations now respond to the richer audio analysis — beat-drop shake, bass-driven glow, and spectral hue shifts driven by the DJ's boost, tilt, spread, and punch.
- Core updated to Adaptive Extender 1.0.3.
- Project retargeted to ES2025.

## 3.0.0 (28.05.2026)
- Added clip recording — a button in the interface lets you record the visualization and download it as a video file.
- Auto-correction now uses a neural network that recognizes six audio scenes (Silence, Speech, Ambient, Buildup, Beat, Drop) for more accurate and responsive focus and spread adjustments.
- Audio analysis runs in a background thread, keeping the interface smooth even on complex visualizations.
- Program stability and rendering consistency significantly improved.

## 2.4.5 : Adaptive Core 3.3.6 (31.01.2025)
- Added an experimental auto-correction feature that adjusts focus and spread for better visualization.
- Code optimized by approximately 8%.
- Fixed visualization errors. Improved the "Pulsar" method.
- Core updated.

## 2.4.0 : Adaptive Core 3.3.5 (28.01.2025)
- The configurator is better adapted to different sizes.
- Restoration and update of the deprecated "Spectrogram" visualization.
- Optimization of existing visualizations. Core optimization for background operation.
- Fixed various rendering bugs in visualizations.
- Smooth animation for pause/resume transitions.
- Added the ability to switch between visualizations using <kbd>Shift</kbd> + <kbd>Tab</kbd>.
- Improved structure to support custom visualizations.

## 2.2.2 : Adaptive Core 3.3.2 (05.01.2025)
- Core updated.
- Bug fixes and program structure improvements.
- The program now prevents saving corrupted data.

## 2.2.0 : Adaptive Core 3.1.6 (03.11.2024)
- Core updated.
- Application icon changed.
- Interface improved: adapted for multiple actions, enhanced user interaction, and optimized for mobile devices.
- Added configurator, accessible via the interface or <kbd>Tab</kbd>.
- Visualization saves enabled, along with individual configuration saves for each visualization.

## 2.0.0 - UI Release : AWT 2.4.1 (17.01.2024)
- Updated the interface layout. It's now more flexible and stable.
- Improved the playback progress bar for easier use.
- The time counter no longer overlaps or blocks the playback progress bar.
- The playback progress bar now displays the time during scrolling.
- Fixed media insertion animations. They now appear sequentially, interacting with the environment.
- Media extraction no longer requires page reloading.
- Accelerated and optimized the interface.
- New experimental visualization "Pulsar". Old ones will be removed.
- Significant work on optimizing the core and the program itself. The program now consumes 23% fewer resources.

## 1.6.5 (14.12.2023)
- Updated the core (to version 2.3.4).
- Optimized the "Waveform" mode.

## 1.6.4 (06.10.2023)
- Now the uploaded song will be saved until it is removed manually.

## 1.6.3 (27.09.2023)
- Added a feature to display the author and title of the composition.
- Added corresponding configuration in the settings.

## 1.6.2 (26.09.2023)
- Settings have been sorted.
- Added smoothness and limiters settings.
- Added an anchor setting for the "Spectrogram" visualization.
- Now configuring settings are saved separately for each visualization.
- Added an enhanced shake effect for the "Spectrogram" visualization.
- The quality processing algorithm has been changed.

## 1.5.13 (24.09.2023)
- Stabilized visualizations.
- And some optimization.

## 1.5.12 (19.09.2023)
- Updated the core.
- Fixed the timer.
- Fixed music uploading.

## 1.5.10 (01.09.2023)
- Updated the core.
- Fixed an issue where fullscreen mode wasn't displaying in the button.

## 1.5.9 (26.08.2023)
- Core updated.

## 1.5.8 (26.08.2023)
- Added smoothing effect to "Waveform" visualization.
- Fixed minor errors.

## 1.5.7 (24.08.2023)
- Bug fixes.

## 1.5.6 (23.08.2023)
- Core modified.
- Code adapted for IOS devices.
- Replaced the function of automatic fullscreen mode with automatic playback due to unstable functionality.
- Added a loading panel.
- Program structure rebuilt.
- Improved metadata.
- Enhanced "Spectrogram" visualization.
- Revamped popup window styles.

## 1.4.17 (12.08.2023)
- Metadata has been modified.
- Now it's possible to upload audio and video.
- Modules have been updated.
- "Waveform" visualization has been improved.

## 1.4.15 (12.07.2023)
- Added descriptions for visualization types in the settings.
- Fixed an issue where the "Waveform" visualization was displayed incorrectly in the light theme.

## 1.4.14 (08.07.2023)
- Fixed an issue where the auto-fullscreen toggle did not respond after restoring factory settings.
- Fixed an issue where the sound wave in the "Waveform" visualization was distorted.

## 1.4.13 (07.07.2023)
- Improved visualization of the "Waveform".
- Added dynamic effects and shadows to the "Waveform" visualization.

## 1.4.12 (06.07.2023)
- Optimization of the "Spectrogram" visualization.
- Improved rendering of the "Spectrogram".

## 1.4.11 (21.06.2023)
- Added audio control slider.
- Improved internal modules.

## 1.4.9 (18.06.2023)
- Improved internal audio player.
- Added automatic fullscreen mode activation setting.
- Enhanced "Waveform" visualization.

## 1.4.8 (16.06.2023)
- Added fullscreen mode functionality.
- Fixed fullscreen mode issue.

## 1.4.7 (15.06.2023)
- Removed unnecessary settings
- Fixed settings freezing bug.
- Added time indicator.
- Improved animation module.
- Fixed internal engine errors.
- Enhanced time representation.
- Fixed line width issue in visualization "Waveform".
- Improved visualization.
- Added dynamic effects.
- Optimized visualization for high-quality processing. Now even at high qualities, the load will be approximately the same.
- Changed internal structure. Added main controlling element `Visualizer`.
- Added amplitude processing.
- Improved interface layout.
- Configured new engine stylization.
- Optimized internal modules.
- Separated local styles.

## 1.3.6 (09.05.2023)
- Modified interface.
- Added the ability to reload media files.
- Improved visualization.
- Added dynamic illumination.
- Added motion effect.
- Changed visualization mode "Waveform".
- Improved design.
- Enhanced adaptability.

## 1.2.8 (08.03.2023)
- Optimized color handling.
- Removed highlighting setting.
- Added background lighting.
- Improved visual representation.

## 1.2.6 (02.03.2023)
- Improved HTML structure of settings.
- Added highlighting setting.
- Added visualization reflection setting.
- Modified visual representation.

## 1.2.4 (28.02.2023)
- Improved compatibility of settings and their management.
- Enhanced settings descriptions.
- Added the ability to loop a song.
- Fixed modules.
- Improved JS structure.
- Prepared scripts for future updates.
- Optimized visualization.
- Added dynamic effects during pause.
- Improved layout of the "Back" icon in settings.

## 1.1.8 (25.02.2023)
- Added settings.
- Added dynamic page icons.
- Optimized the program.
- Improved HTML structure.

## 1.1.0 (23.02.2023)
- Added dynamic effects.
- Improved structural scripts.
- Optimized visualization rendering.
