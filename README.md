# SynthWork

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
| Voice Mode | **Poly** (depth = detune), **Unison** (all 4 voices stacked, depth = detune), **Chord** (depth selects 1 of 14 chord types) |
| Effects | **Mod:** Chorus, Ensemble, Phaser, Flanger · **Delay:** Stereo, Tape, Ping-Pong · **Reverb:** Hall, Room, Plate, Riser |
| Display | Live oscilloscope with a readout of the parameter you're changing |
| Programs | 9 factory presets, unlimited user presets, JSON export/import |

### Planned next

- Arpeggiator / Latch voice mode
- 16-step polyphonic sequencer with motion sequencing
- Joystick (pitch bend / modulation)
- User oscillator and effect slots
- MIDI keyboard input (Web MIDI)
- **Data player:** load a streamflow CSV and map it onto notes and parameters

## Code layout

```
index.html                      page layout
css/style.css                   styling
js/params.js                    every parameter: range, default, label, panel layout
js/worklet/synth-processor.js   the voice engine (oscillators, filter, envelopes, LFO, voice modes)
                                runs on the audio thread as an AudioWorklet
js/fx.js                        mod FX, delay and reverb (native Web Audio nodes)
js/synth.js                     ties it together; the one API every input uses
js/presets.js                   factory presets and saved user presets
js/ui/                          knobs and switches, keyboard, oscilloscope
js/main.js                      builds the page and connects everything
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

## USGS streamflow helper (Python)

```bash
pip install -r data_helper/requirements.txt
python data_helper/fetch_streamflow.py --site 01646500 --start 2024-01-01 --end 2024-12-31
```

This writes `data/<site>_<start>_<end>.csv` with `date`, `discharge_cfs` and a `normalized`
column (0–1, log-scaled by default), ready to map onto pitch or filter cutoff. An example file
for the Potomac River in 2024 is included in `data/`.
