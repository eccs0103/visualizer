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
