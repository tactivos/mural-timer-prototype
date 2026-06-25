# Mural Timer — functional prototype

A working, self-contained prototype of the proposed Mural timer interface.
Plain HTML/CSS/JS, no build step, no dependencies.

## Run it

Just open the file — no server needed:

```
open index.html
```

(Or drag `index.html` into a browser. Audio needs a click first — browsers
block sound until the user interacts, so press a button before expecting sound.)

## What works

- **Duration** presets (2 / 5 / 10 min) + **Custom** stepper (− / + in 1-min steps).
- **Music** dropdown — 6 tracks (Energize, Focus, Imagine, Flow, Decide, Sprint)
  + *No music*. Selecting a track activates the **preview** button (play ▶ / stop ■).
- **Start timer** → pill switches to a live countdown with a **music note + visualizer**
  that reacts to the actual audio signal.
- Click the running pill → **control panel**:
  - **Your volume** — per-user mute + − / slider / + (everyone hears the music; volume is personal).
  - **Adjust time** — − / + in 30-sec steps *(facilitator only)*.
  - **Pause / Resume** and **End** *(facilitator only)*.
- At `0:00` → end chime + "Time's up!" then resets to idle.
- **View as** toggle (bottom-left, dev-only) — switch Facilitator ⇄ Participant.
  Participants see only the volume half of the running panel.

## Sound

Tracks are **synthesized** with the Web Audio API (distinct tempo/scale/waveform
per track) so the prototype plays sound with zero audio files. To use real loops
later, drop them in `assets/sounds/` and swap `MUSIC.play()` in `audio.js`.

## Tweakable flags

- `app.js` → `TRADITIONAL_DROPDOWN` — `false` (default) uses the designed
  "selected option drops out" behavior; `true` shows all options with a checkmark.
- Custom step size, adjust-time step (30s), and track definitions live near the
  top of `app.js` / `audio.js`.
