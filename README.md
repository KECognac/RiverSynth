# SynthWork

**▶ Play it live: https://kecognac.github.io/SynthWork/**

A 4-voice polyphonic synthesizer that runs in the web browser, modelled on the KORG minilogue (xd).
The long-term goal is to drive it with data time series such as USGS streamflow.

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
- **Programs:** choose a factory preset, save your own (stored in this browser), or export and
  import them as `.json` files.

## What's implemented (v1)

| Section | Controls |
|---|---|
| VCO 1 / VCO 2 | Saw / Tri / Square, octave (16'–2'), pitch ±1200¢, continuous **Shape** (saw→square morph, triangle wavefold, pulse width); VCO 2 **Sync** and **Ring** |
| Multi Engine | **Noise** (High, Low, Peak, Decim) or **VPM** (2-operator phase modulation: Sine, Octave, Bell, Metal, Sub) |
| Mixer | VCO 1, VCO 2, Multi levels |
| Filter | 2-pole 12 dB/oct low-pass, cutoff, resonance, drive, key tracking 0/50/100% |
| Amp EG | Attack, Decay, Sustain, Release |
| EG | Attack, Decay, bipolar Intensity → Cutoff, Pitch 2 or Pitch |
| LFO | Saw / Tri / Square, rate, bipolar intensity → Pitch, Shape or Cutoff |
| Voice Mode | **Poly** (depth = detune), **Unison** (all 4 voices stacked, depth = detune), **Chord** (depth selects 1 of 14 chord types), **Arp** (depth selects 1 of 13 patterns) |
| Arpeggiator | Manual / Rise / Fall / Rise Fall / Poly over 1–2 octaves, Random over 1–3 octaves; Latch, Tempo (40–300 BPM), Rate (1/4–1/32 incl. triplets), Gate |
| Effects | **Mod:** Chorus, Ensemble, Phaser, Flanger · **Delay:** Stereo, Tape, Ping-Pong · **Reverb:** Hall, Room, Plate, Riser, Spring |
| Display | Live oscilloscope with a readout of the parameter you're changing |
| Programs | 21 factory presets, unlimited user presets, JSON export/import |
| River Data | Play any USGS stream gauge's daily discharge as notes (see below) |

### Planned next

- 16-step polyphonic sequencer with motion sequencing
- Joystick (pitch bend / modulation)
- User oscillator and effect slots
- MIDI keyboard input (Web MIDI)

## Code layout

```
index.html                      page layout
css/style.css                   styling
js/params.js                    every parameter: range, default, label, panel layout
js/worklet/synth-processor.js   the voice engine (oscillators, filter, envelopes, LFO, voice modes, arpeggiator)
                                runs on the audio thread as an AudioWorklet
js/fx.js                        mod FX, delay and reverb (native Web Audio nodes)
js/synth.js                     ties it together; the one API every input uses
js/presets.js                   factory presets and saved user presets
js/ui/                          knobs and switches, keyboard, oscilloscope
js/main.js                      builds the page and connects everything
js/data/usgs.js                 fetch USGS daily values in the browser; parse CSVs
js/data/player.js               data → notes mapping, scheduler and chart
js/data/features.js             derived signals: change, anomaly vs normal, trend, turbulence
js/data/gauges.js               the River menu's starter gauges
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
