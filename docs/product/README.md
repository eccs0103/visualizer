# Product vision

> For music listeners who want to see their own songs come alive, Visualizer is a free browser music visualizer that splits each song into its instruments and lets every effect follow its own one.

Updated 2026-11-22 · [Decisions](decisions/README.md) · [Changelog](CHANGELOG.md) · [Roadmap](ROADMAP.md) · [Glossary](GLOSSARY.md)

## Target users

- Listeners: play their own songs and watch, arrange and record the visuals.
- Visualization authors: add a new look by writing one file.
- Developers: tune the AI and preview new looks through a hidden address.

## Needs

- See your own music as moving pictures, with no account and no install.
- Visuals that follow the drums, the bass and the voice on their own, not only the whole mix.
- Keep a video of what you saw.

## Product

- A studio in the browser with a playlist, keyboard control and phone support.
- Three built-in looks (Pulsar, Spectrogram, Stems), each built from layers you can reorder, fade and blend over your own background.
- Synced lyrics from a file or an online lookup.
- An optional AI that splits the song into drums, bass, vocals, guitar, keys and the rest.
- Clip recording that matches the screen exactly.

## Business goals

- Free and open source under Apache 2.0, offered on a public website ([0001](decisions/0001-free-and-open-source-on-a-public-website.md)).
- Everything runs on the visitor's own computer; data stays in their browser ([0004](decisions/0004-your-music-and-choices-stay-in-your-browser.md)).

## Non-goals

- A built-in music library ([0002](decisions/0002-play-your-own-music-and-watch-it-come-alive.md)).
- An AI that tunes the picture for you, for now ([0007](decisions/0007-an-ai-tunes-the-picture-for-you.md)).
- An app that picks settings for your computer by itself ([0013](decisions/0013-the-app-never-changes-your-choices.md)).
- An instrument split that lags behind the sound ([0011](decisions/0011-an-optional-ai-hears-each-instrument.md)).

## Rules in force

1. Free, open source, on a public website ([0001](decisions/0001-free-and-open-source-on-a-public-website.md)).
2. Visitors bring their own music; the studio works by keyboard, mouse and touch, upright and sideways ([0002](decisions/0002-play-your-own-music-and-watch-it-come-alive.md)).
3. Songs, playlist and settings stay in the browser and survive every update ([0004](decisions/0004-your-music-and-choices-stay-in-your-browser.md)).
4. Anyone adds a visualization by writing one file; it can only draw, and one failing look never breaks the rest ([0006](decisions/0006-anyone-can-add-a-visualization-in-one-file.md)).
5. A recorded clip looks exactly like the screen ([0008](decisions/0008-a-recorded-clip-looks-exactly-like-the-screen.md)).
6. Synced lyrics appear in every visualization, and the lookup can be turned off ([0009](decisions/0009-synced-lyrics-in-every-visualization.md)).
7. Every picture is layers the visitor arranges, remembered per visualization ([0010](decisions/0010-arrange-the-picture-in-layers.md)).
8. The AI is optional, live and honest; the visuals work without it ([0011](decisions/0011-an-optional-ai-hears-each-instrument.md)).
9. Developer settings appear only on request; visitors see a simple panel ([0012](decisions/0012-developers-get-extra-settings-on-request.md)).
10. The app never changes the visitor's choices; it measures, warns in plain words and lets them decide ([0013](decisions/0013-the-app-never-changes-your-choices.md)).
