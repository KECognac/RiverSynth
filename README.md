# SynthWork

**▶ Play it live: https://kecognac.github.io/SynthWork/**

An 8-voice polyphonic synthesizer that runs in the web browser. It started from the KORG minilogue
(xd) layout and has grown modern extras (supersaw, vowel filter, shimmer reverb, sidechain pump),
with a Moog Grandmother-inspired look. It can also turn USGS streamflow data into music.

Everything runs in the browser using the Web Audio API. There's no build step and no
dependencies, so it can be hosted for free on GitHub Pages.

## Run it locally

Browsers only load the audio engine from a web server, not by double-clicking `index.html`:

```bash
python3 -m http.server 8123
```

Then open <http://localhost:8123> and press a key or the power button to start audio.

## Playing

- **Computer keyboard:** `A S D F G H J K L ; '` are white keys, and `W E T Y U O P` are
  black keys. `Z` / `X` shift the octave.
- **On-screen keyboard:** click, tap or drag across keys.
- **Knobs:** drag up and down, use the scroll wheel or the arrow keys. Hold `Shift` for fine
  control, and double-click to reset a knob.
- **MIDI keyboard:** click **MIDI** (next to the octave buttons) to play from a USB/MIDI keyboard,
  including the sustain pedal. Works in Chrome, Edge and Firefox; Safari has no Web MIDI.
- **Programs:** choose a factory preset, save your own (stored in this browser), or export and
  import them as `.json` files.
- **🎲 Random** makes a new sound within musical limits, **Mutate** nudges the current one, and
  **↶ / ↷** (or Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z) undo and redo any change.
- **Share link** copies a URL that opens the app with your exact sound.

## What's implemented

| Section | Controls |
|---|---|
| VCO 1 / VCO 2 | Saw / Tri / Square / **Super** (7 detuned saws), octave (16'–2'), pitch ±1200¢, continuous **Shape** (saw→square morph, triangle wavefold, pulse width, supersaw detune); VCO 2 **Sync** and **Ring** |
| Multi Engine | **Noise** (High, Low, Peak, Decim) or **VPM** (2-operator phase modulation: Sine, Octave, Bell, Metal, Sub) |
| Mixer | VCO 1, VCO 2, Multi levels |
| Filter | **LP 12**, **LP 24** (ladder-style, saturating), **HP**, **BP**, **Notch** and **Vowel** (three formants morphing A–E–I–O–U; EG/LFO cutoff modulation sweeps the vowel, Cutoff shifts the voice size); cutoff, resonance, drive, key tracking |
| Amp EG | Attack, Decay, Sustain, Release |
| EG | Attack, Decay, bipolar Intensity → Cutoff, Pitch 2 or Pitch |
| LFO | Saw / Tri / Square / **S&H** (stepped random) / **Drift** (smooth random), free rate or **tempo sync** (2 bars–1/16), **key sync**, bipolar intensity → Pitch, Shape or Cutoff |
| Voice Mode | **Glide** (portamento) for all modes · **Poly** (depth = detune), **Unison** (all 8 voices stacked, depth = detune), **Chord** (depth selects 1 of 14 chord types), **Arp** (depth selects 1 of 13 patterns) |
| Arpeggiator | Manual / Rise / Fall / Rise Fall / Poly over 1–2 octaves, Random over 1–3 octaves; Latch, Rate (1/4–1/32 incl. triplets), Gate |
| Pump | Tempo-synced sidechain-style ducking (1/2, 1/4, 1/8) with depth and release; restarts on the first note you play |
| Tempo | One global tempo (Master section) for the arpeggiator, synced LFO and pump |
| Effects | **Crush:** bit depth + downsampling · **Distortion:** Tube, Fuzz, Fold · **Tape:** wow & flutter · **Mod:** Chorus, Ensemble, Phaser, Flanger · **Delay:** Stereo, Tape, Ping-Pong · **Reverb:** Hall, Room, Plate, Riser, Spring, **Shimmer** (octave-up feedback; Tone = shimmer amount) |
| Display | Live oscilloscope with a readout of the parameter you're changing |
| Programs | 32 factory presets, unlimited user presets, JSON export/import |
| Record | **● Rec** saves the output (keyboard, data player, everything) as a WAV file |
| River Data | Play any USGS stream gauge's daily discharge as notes (see below) |

### Planned next

- River layers (drone following the trend, event hits at peaks) and 15-minute data
- 16-step polyphonic sequencer with motion sequencing
- Joystick (pitch bend / modulation)
- User oscillator and effect slots

## Code layout

```
index.html                      page layout
css/style.css                   styling
js/params.js                    every parameter: range, default, label, panel layout
js/worklet/synth-processor.js   the voice engine (oscillators, filters, envelopes, LFO, voice modes, arpeggiator, pump)
js/worklet/fx-processors.js     audio-thread effects: shimmer pitch shifter, bitcrusher, recorder
js/recorder.js                  live recording and WAV encoding
js/randomize.js                 Randomize and Mutate
                                runs on the audio thread as an AudioWorklet
js/fx.js                        crush, mod FX, delay, reverb (incl. shimmer) and the river roar
js/synth.js                     ties it together; the one API every input uses
js/presets.js                   factory presets and saved user presets
js/ui/                          knobs and switches, keyboard, oscilloscope
js/main.js                      builds the page and connects everything
js/data/usgs.js                 fetch USGS daily values in the browser; parse CSVs
js/data/player.js               data → notes mapping, scheduler and chart
js/data/features.js             derived signals: change, anomaly vs normal, trend, turbulence
js/data/gauges.js               the River menu's gauges, grouped by region
js/data/river-presets.js        built-in river presets and saved user ones
js/data/midi.js                 MIDI file export
js/ui/midi-input.js             MIDI keyboard input
data_helper/                    Python: fetch USGS data for sonification
```

Every input (keyboards now, data later) drives the synth through the same three calls in
`js/synth.js`:

```js
synth.noteOn(60);                       // MIDI note number
synth.noteOff(60);
synth.setParam('filter.cutoff', 1200);  // any id from js/params.js
```

You can try these in the browser's developer console, where the synth is available as
`window.synth`.

## River Data: play a stream gauge

The **River Data** panel loads daily mean discharge for any USGS gauge, straight from the
[USGS Water Data API](https://api.waterdata.usgs.gov) in the browser. No Python is needed for
this part. It starts with the **Cache la Poudre River at Fort Collins, CO (06752260)** for 2024,
and the **River** menu has a dozen more with very different characters (snowmelt, tropical flash
floods, giant rivers, dam-controlled flow, arctic ice breakup), or type any gauge number.

Above the chart, **River preset** recalls a whole setup at once: sound, scale and speed, Data →
Sound routes, river roar and (for some) a gauge and dates. Six are built in (Snowmelt Choir,
Glacier Bells, Flash Flood Pump, Drought Watch, Lo-Fi Creek, Arctic Breakup), and **Save**
stores your own in this browser.

After loading, the app also fetches the gauge's full daily record in the background to work out
the **normal** (median) flow for each date, drawn as a dashed line on the chart.

- Each day becomes one step and its flow picks a note from the chosen **Scale** and **Key**
  between **Low** and **High**. With **Note spread: Even** (the default) the days are ranked,
  so every note gets used about equally; **Proportional** follows the flow's actual size
  (log scale by default).
- **Tempo** and **Step** set the speed (at 120 BPM in 1/16 steps, a year of data plays in about
  46 seconds). **Gate** sets note length, and **Tie repeats** holds a note while the flow stays
  on the same pitch.
- Click the chart to move the playhead. Notes play through the current program and voice mode,
  so Chord or Arp mode turn each day into a chord or an arpeggio.
- **Data → Sound** lets the river move other controls too. Each row picks a control (filter
  cutoff, resonance, reverb or delay mix, delay feedback, LFO rate, voice detune and so on) and
  what it **follows**:
  - **Flow**: the flow itself
  - **Change**: falling vs rising
  - **Anomaly vs normal**: drier vs wetter than the median for that date
  - **Trend (30-day)**: the slow, seasonal movement
  - **Turbulence (7-day)**: calm vs stormy weeks

  Because these move independently, the sound gets more than one dimension. The defaults:
  flow opens the filter, wetter-than-normal adds reverb, turbulence adds resonance. Routed
  knobs move on the panel while playing and return to where they were when you stop. (Reverb
  Decay and Tone aren't available because they rebuild the reverb on every change.)
- **River roar** adds a continuous rushing-water layer whose loudness and brightness follow the
  flow: a quiet trickle at low flow, a bright roar at high flow.
- **Export WAV** renders the whole river song (start to end, plus a tail for reverb) to a
  44.1 kHz stereo WAV, offline and faster than real time: a year at 1/16 notes takes a few
  seconds. **Export MIDI** saves the notes plus the river signals as controllers (CC 20 Flow,
  21 Change, 22 Anomaly, 23 Trend, 24 Turbulence), so a music program can map them to any knob.
- **Load CSV** accepts files from the Python helper below, or any CSV with a date column and a
  value column.

Notes from the data are scheduled with exact audio-clock times
(`synth.noteOn(note, velocity, time)`), so playback stays in time.

Note: the better-known *Cache la Poudre at Mouth of Canyon* gauge (06752000) has no USGS daily
discharge for recent years, which is why the Fort Collins gauge is the default.

## USGS streamflow helper (Python)

```bash
pip install -r data_helper/requirements.txt
python data_helper/fetch_streamflow.py --site 01646500 --start 2024-01-01 --end 2024-12-31
```

This writes `data/<site>_<start>_<end>.csv` with `date`, `discharge_cfs` and a `normalized`
column (0–1, log-scaled by default), ready to map onto pitch or filter cutoff. An example file
for the Potomac River in 2024 is included in `data/`.
