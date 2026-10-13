// Factory presets (only the params that differ from the defaults) and
// user preset storage in the browser's localStorage.

import { PARAMS, defaultValues } from './params.js';

export const FACTORY = [
  { name: 'Init Program', values: {} },
  {
    name: 'Warm Poly Pad',
    values: {
      'mixer.vco2': 0.7, 'vco2.pitch': 8, 'filter.cutoff': 1400, 'filter.resonance': 0.15,
      'ampeg.attack': 0.6, 'ampeg.decay': 1.5, 'ampeg.sustain': 0.8, 'ampeg.release': 1.6,
      'eg.attack': 0.8, 'eg.decay': 2.5, 'eg.int': 0.25, 'lfo.rate': 0.3, 'lfo.int': 0.12,
      'voice.depth': 0.4, 'mod.on': 1, 'mod.type': 1, 'mod.mix': 0.5,
      'reverb.on': 1, 'reverb.time': 0.7, 'reverb.mix': 0.35,
    },
  },
  {
    name: 'Unison Bass',
    values: {
      'voice.mode': 1, 'voice.depth': 0.35, 'vco1.octave': 0, 'vco2.octave': 0, 'vco2.wave': 2,
      'mixer.vco2': 0.6, 'filter.cutoff': 380, 'filter.resonance': 0.35, 'filter.drive': 0.4,
      'eg.attack': 0.001, 'eg.decay': 0.25, 'eg.int': 0.45,
      'ampeg.attack': 0.001, 'ampeg.decay': 0.4, 'ampeg.sustain': 0.7, 'ampeg.release': 0.08,
    },
  },
  {
    name: 'Sync Lead',
    values: {
      'vco2.sync': 1, 'vco2.octave': 2, 'mixer.vco1': 0.3, 'mixer.vco2': 0.8,
      'eg.target': 1, 'eg.attack': 0.001, 'eg.decay': 0.6, 'eg.int': -0.35,
      'filter.cutoff': 5000, 'filter.resonance': 0.2, 'lfo.target': 0, 'lfo.rate': 5.5, 'lfo.int': 0.03,
      'delay.on': 1, 'delay.time': 0.32, 'delay.depth': 0.35, 'delay.mix': 0.25,
    },
  },
  {
    name: 'Chord Stab',
    values: {
      'voice.mode': 2, 'voice.depth': 6 / 13, 'filter.cutoff': 900, 'filter.resonance': 0.3,
      'eg.attack': 0.001, 'eg.decay': 0.3, 'eg.int': 0.5,
      'ampeg.attack': 0.001, 'ampeg.decay': 0.35, 'ampeg.sustain': 0, 'ampeg.release': 0.3,
      'delay.on': 1, 'delay.type': 2, 'delay.time': 0.375, 'delay.depth': 0.45, 'delay.mix': 0.3,
      'reverb.on': 1, 'reverb.type': 1, 'reverb.mix': 0.25,
    },
  },
  {
    name: 'Arp Pluck',
    values: {
      'voice.mode': 3, 'voice.depth': 7 / 12, 'arp.latch': 1, 'arp.tempo': 118, 'arp.rate': 3, 'arp.gate': 0.4,
      'vco1.wave': 2, 'vco1.shape': 0.3, 'mixer.vco2': 0.4, 'vco2.octave': 2, 'vco2.wave': 1,
      'filter.cutoff': 700, 'filter.resonance': 0.45, 'eg.attack': 0.001, 'eg.decay': 0.18, 'eg.int': 0.55,
      'ampeg.attack': 0.001, 'ampeg.decay': 0.25, 'ampeg.sustain': 0.2, 'ampeg.release': 0.15,
      'delay.on': 1, 'delay.type': 2, 'delay.time': 0.38, 'delay.depth': 0.4, 'delay.mix': 0.3,
      'reverb.on': 1, 'reverb.type': 0, 'reverb.mix': 0.25,
    },
  },
  {
    // Inspired by the shimmering, bell-like arpeggio in Grimes' "Genesis" (2012):
    // FM bell + soft square + high triangle sparkle, rising arp, chorus, ping-pong and big hall.
    name: 'Genesis Shimmer',
    values: {
      'voice.mode': 3, 'voice.depth': 3 / 12, 'arp.latch': 1, 'arp.tempo': 84, 'arp.rate': 3, 'arp.gate': 0.35,
      'vco1.wave': 2, 'vco1.octave': 2, 'vco1.shape': 0.15, 'mixer.vco1': 0.45,
      'vco2.wave': 1, 'vco2.octave': 3, 'vco2.pitch': 7, 'mixer.vco2': 0.25,
      'multi.type': 1, 'multi.vpm': 2, 'multi.shape': 0.35, 'mixer.multi': 0.7,
      'filter.cutoff': 6500, 'filter.resonance': 0.1, 'filter.keytrack': 2,
      'ampeg.attack': 0.002, 'ampeg.decay': 0.6, 'ampeg.sustain': 0, 'ampeg.release': 0.6,
      'eg.attack': 0.001, 'eg.decay': 0.25, 'eg.int': 0.2,
      'lfo.target': 0, 'lfo.wave': 1, 'lfo.rate': 5, 'lfo.int': 0.01,
      'mod.on': 1, 'mod.type': 1, 'mod.time': 0.35, 'mod.depth': 0.5, 'mod.mix': 0.45,
      'delay.on': 1, 'delay.type': 2, 'delay.time': 0.536, 'delay.depth': 0.45, 'delay.mix': 0.3, // dotted 1/8 at 84 BPM
      'reverb.on': 1, 'reverb.type': 0, 'reverb.time': 0.8, 'reverb.depth': 0.65, 'reverb.mix': 0.45,
    },
  },
  {
    // Inspired by Fred again..'s warm, sidechain-pumping house chords. There's no sidechain here,
    // so a rising saw LFO on the cutoff (2.133 Hz = quarter notes at 128 BPM) ducks each beat.
    name: 'Fred Pump Chords',
    values: {
      'voice.mode': 2, 'voice.depth': 5 / 13, // one key plays a m7 chord
      'vco1.wave': 0, 'vco1.shape': 0.1, 'mixer.vco1': 0.7,
      'vco2.wave': 0, 'vco2.pitch': 12, 'mixer.vco2': 0.6,
      'multi.type': 0, 'multi.noise': 0, 'multi.shape': 0.7, 'mixer.multi': 0.06,
      'filter.cutoff': 1800, 'filter.resonance': 0.15, 'filter.drive': 0.25,
      'ampeg.attack': 0.004, 'ampeg.decay': 1.2, 'ampeg.sustain': 0.7, 'ampeg.release': 0.35,
      'eg.attack': 0.001, 'eg.decay': 0.35, 'eg.int': 0.2,
      'lfo.wave': 0, 'lfo.rate': 2.133, 'lfo.int': -0.35, 'lfo.target': 2,
      'mod.on': 1, 'mod.type': 0, 'mod.mix': 0.35,
      'reverb.on': 1, 'reverb.type': 2, 'reverb.time': 0.5, 'reverb.mix': 0.25,
    },
  },
  {
    // Inspired by the chopped, euphoric energy of Fred again..'s "Delilah (pull me out of this)".
    // The arp's Poly pattern re-triggers the held chord every 1/16 like sample chops (hold the
    // keys; latch is off). Saw LFO on cutoff at quarter notes (140 BPM) imitates sidechain pumping.
    name: 'Delilah Chop Stabs',
    values: {
      'voice.mode': 3, 'voice.depth': 8 / 12, 'arp.latch': 0, 'arp.tempo': 140, 'arp.rate': 3, 'arp.gate': 0.45,
      'vco1.wave': 0, 'mixer.vco1': 0.6,
      'vco2.wave': 0, 'vco2.octave': 2, 'vco2.pitch': 9, 'mixer.vco2': 0.35,
      'multi.type': 0, 'multi.noise': 0, 'multi.shape': 0.75, 'mixer.multi': 0.04,
      'filter.cutoff': 2400, 'filter.resonance': 0.35, 'filter.drive': 0.3,
      'eg.attack': 0.001, 'eg.decay': 0.15, 'eg.int': 0.3,
      'ampeg.attack': 0.002, 'ampeg.decay': 0.2, 'ampeg.sustain': 0.5, 'ampeg.release': 0.12,
      'lfo.wave': 0, 'lfo.rate': 140 / 60, 'lfo.int': -0.3, 'lfo.target': 2,
      'mod.on': 1, 'mod.type': 0, 'mod.mix': 0.3,
      'delay.on': 1, 'delay.type': 2, 'delay.time': 0.214, 'delay.depth': 0.3, 'delay.mix': 0.2, // 1/8 at 140 BPM
      'reverb.on': 1, 'reverb.type': 2, 'reverb.time': 0.45, 'reverb.mix': 0.2,
      'master.volume': 0.55,
    },
  },
  {
    // Watery and magical. Droplets: a fast downward pitch blip on every note (EG -> Pitch),
    // played by a latched Random arp. Current: resonant "Peak" noise for a babbling-brook texture
    // and a slow LFO sweeping the cutoff. Shimmer: folded triangles, phaser, ping-pong, big hall.
    name: 'River Shimmer',
    values: {
      'voice.mode': 3, 'voice.depth': 11 / 12, 'arp.latch': 1, 'arp.tempo': 90, 'arp.rate': 3, 'arp.gate': 0.3,
      'vco1.wave': 1, 'vco1.shape': 0.2, 'mixer.vco1': 0.9,
      'vco2.wave': 1, 'vco2.octave': 2, 'vco2.pitch': 5, 'mixer.vco2': 0.4,
      'multi.type': 0, 'multi.noise': 2, 'multi.shape': 0.55, 'mixer.multi': 0.25,
      'filter.cutoff': 2200, 'filter.resonance': 0.55, 'filter.keytrack': 2,
      'eg.target': 2, 'eg.attack': 0.001, 'eg.decay': 0.06, 'eg.int': 0.12,
      'ampeg.attack': 0.003, 'ampeg.decay': 0.5, 'ampeg.sustain': 0, 'ampeg.release': 0.7,
      'lfo.wave': 1, 'lfo.rate': 0.2, 'lfo.int': 0.25, 'lfo.target': 2,
      'mod.on': 1, 'mod.type': 2, 'mod.time': 0.25, 'mod.depth': 0.7, 'mod.mix': 0.5,
      'delay.on': 1, 'delay.type': 2, 'delay.time': 0.333, 'delay.depth': 0.5, 'delay.mix': 0.35, // 1/8 at 90 BPM
      'reverb.on': 1, 'reverb.type': 0, 'reverb.time': 0.9, 'reverb.depth': 0.7, 'reverb.mix': 0.5,
      'master.volume': 0.95,
    },
  },
  {
    // Soft, Sonic Pi-style mallet beeps. A near-sine FM tone (Bell ratio at low index adds a
    // touch of wooden inharmonicity) plus a triangle body; a fast filter EG makes each strike
    // bright then mellow like a xylophone. A quiet square two octaves up gives a brief digital
    // blip. Latched Random 2 arp on a steady 1/8 grid, like `play scale(...).choose`, with
    // Sonic Pi-ish echo and room reverb, and no wobble so it stays clean.
    name: 'River Shimmer 2',
    values: {
      'voice.mode': 3, 'voice.depth': 11 / 12, 'arp.latch': 1, 'arp.tempo': 110, 'arp.rate': 1, 'arp.gate': 0.3,
      'vco1.wave': 1, 'mixer.vco1': 0.3,
      'vco2.wave': 2, 'vco2.octave': 3, 'mixer.vco2': 0.18,
      'multi.type': 1, 'multi.vpm': 2, 'multi.shape': 0.12, 'mixer.multi': 0.9,
      'filter.cutoff': 1400, 'filter.resonance': 0.05, 'filter.keytrack': 2,
      'eg.target': 0, 'eg.attack': 0.001, 'eg.decay': 0.06, 'eg.int': 0.4,
      'ampeg.attack': 0.001, 'ampeg.decay': 0.45, 'ampeg.sustain': 0, 'ampeg.release': 0.35,
      'delay.on': 1, 'delay.type': 0, 'delay.time': 0.409, 'delay.depth': 0.35, 'delay.mix': 0.25, // dotted 1/8 at 110 BPM
      'reverb.on': 1, 'reverb.type': 1, 'reverb.time': 0.5, 'reverb.depth': 0.5, 'reverb.mix': 0.3,
      'master.volume': 1,
    },
  },
  {
    // Glockenspiel: a struck steel bar. VCO 2 is tuned 2.76x above VCO 1 (+2 oct, then
    // +557 cents relative to VCO 1's 4'), the bar's real first overtone, which gives the
    // metallic ring. Fast filter-EG strike, long ringing decay, no sustain. Plays an octave up.
    name: 'Glockenspiel',
    values: {
      'vco1.wave': 1, 'vco1.octave': 2, 'vco1.shape': 0.08, 'mixer.vco1': 0.95,
      'vco2.wave': 1, 'vco2.octave': 3, 'vco2.pitch': 557, 'mixer.vco2': 0.45,
      'filter.cutoff': 7000, 'filter.resonance': 0.05, 'filter.keytrack': 2,
      'eg.target': 0, 'eg.attack': 0.001, 'eg.decay': 0.04, 'eg.int': 0.3,
      'ampeg.attack': 0.001, 'ampeg.decay': 2.2, 'ampeg.sustain': 0, 'ampeg.release': 2.2, // keeps ringing after the key is lifted
      'reverb.on': 1, 'reverb.type': 2, 'reverb.time': 0.45, 'reverb.depth': 0.75, 'reverb.mix': 0.25,
      'master.volume': 0.95,
    },
  },
  // --- Inspired by the Moog Grandmother: fat analog mono sounds through a spring reverb ---
  {
    // Classic Moog bass: saw + square an octave below, mono (Unison, light detune),
    // low cutoff with a punchy filter envelope and some drive.
    name: 'Grandmother Bass',
    values: {
      'voice.mode': 1, 'voice.depth': 0.12,
      'vco1.wave': 0, 'mixer.vco1': 0.8,
      'vco2.wave': 2, 'vco2.octave': 0, 'vco2.pitch': -5, 'mixer.vco2': 0.7,
      'filter.cutoff': 280, 'filter.resonance': 0.3, 'filter.drive': 0.5,
      'eg.target': 0, 'eg.attack': 0.001, 'eg.decay': 0.3, 'eg.int': 0.45,
      'ampeg.attack': 0.001, 'ampeg.decay': 0.5, 'ampeg.sustain': 0.8, 'ampeg.release': 0.1,
      'reverb.on': 1, 'reverb.type': 4, 'reverb.time': 0.3, 'reverb.mix': 0.1,
    },
  },
  {
    // Singing mono lead: saw + slightly detuned pulse, resonant filter, light
    // vibrato, tape echo and the drippy spring reverb.
    name: 'Grandmother Lead',
    values: {
      'voice.mode': 1, 'voice.depth': 0.08,
      'vco1.wave': 0, 'mixer.vco1': 0.8,
      'vco2.wave': 2, 'vco2.shape': 0.3, 'vco2.pitch': 7, 'mixer.vco2': 0.6,
      'filter.cutoff': 1800, 'filter.resonance': 0.45, 'filter.drive': 0.3,
      'eg.target': 0, 'eg.attack': 0.01, 'eg.decay': 0.5, 'eg.int': 0.25,
      'ampeg.attack': 0.01, 'ampeg.decay': 0.6, 'ampeg.sustain': 0.85, 'ampeg.release': 0.3,
      'lfo.wave': 1, 'lfo.rate': 5.2, 'lfo.int': 0.02, 'lfo.target': 0,
      'delay.on': 1, 'delay.type': 1, 'delay.time': 0.3, 'delay.depth': 0.35, 'delay.mix': 0.2,
      'reverb.on': 1, 'reverb.type': 4, 'reverb.time': 0.5, 'reverb.mix': 0.3,
    },
  },
  {
    // The Grandmother's arpeggiator: latched rising plucks with a squelchy resonant
    // filter envelope, splashing into the spring reverb.
    name: 'Grandmother Spring Arp',
    values: {
      'voice.mode': 3, 'voice.depth': 3 / 12, 'arp.latch': 1, 'arp.tempo': 112, 'arp.rate': 3, 'arp.gate': 0.35,
      'vco1.wave': 2, 'vco1.shape': 0.2, 'mixer.vco1': 0.8,
      'vco2.wave': 0, 'vco2.octave': 2, 'mixer.vco2': 0.3,
      'filter.cutoff': 600, 'filter.resonance': 0.55, 'filter.drive': 0.2,
      'eg.target': 0, 'eg.attack': 0.001, 'eg.decay': 0.18, 'eg.int': 0.5,
      'ampeg.attack': 0.001, 'ampeg.decay': 0.25, 'ampeg.sustain': 0, 'ampeg.release': 0.2,
      'reverb.on': 1, 'reverb.type': 4, 'reverb.time': 0.55, 'reverb.mix': 0.35,
    },
  },
  {
    // Warm brass chords (the Grandmother can play paraphonically): two detuned saws,
    // a slow-opening filter swell and a touch of spring.
    name: 'Grandmother Brass',
    values: {
      'vco1.wave': 0, 'mixer.vco1': 0.75,
      'vco2.wave': 0, 'vco2.pitch': 10, 'mixer.vco2': 0.65,
      'filter.cutoff': 700, 'filter.resonance': 0.2, 'filter.drive': 0.3,
      'eg.target': 0, 'eg.attack': 0.08, 'eg.decay': 0.6, 'eg.int': 0.45,
      'ampeg.attack': 0.03, 'ampeg.decay': 0.8, 'ampeg.sustain': 0.75, 'ampeg.release': 0.35,
      'voice.depth': 0.3,
      'reverb.on': 1, 'reverb.type': 4, 'reverb.time': 0.4, 'reverb.mix': 0.2,
    },
  },
  {
    name: 'FM Bells',
    values: {
      'mixer.vco1': 0, 'mixer.multi': 0.9, 'multi.type': 1, 'multi.vpm': 2, 'multi.shape': 0.45,
      'filter.cutoff': 12000, 'ampeg.attack': 0.002, 'ampeg.decay': 2.5, 'ampeg.sustain': 0,
      'ampeg.release': 2.5, 'reverb.on': 1, 'reverb.type': 2, 'reverb.time': 0.6, 'reverb.mix': 0.35,
    },
  },
  {
    name: 'Wind Noise',
    values: {
      'mixer.vco1': 0, 'mixer.multi': 1, 'multi.type': 0, 'multi.noise': 2, 'multi.shape': 0.4,
      'lfo.target': 1, 'lfo.wave': 1, 'lfo.rate': 0.15, 'lfo.int': 0.35,
      'filter.cutoff': 6000, 'ampeg.attack': 1.2, 'ampeg.release': 2.5,
      'reverb.on': 1, 'reverb.type': 0, 'reverb.time': 0.8, 'reverb.mix': 0.45,
    },
  },
  {
    name: 'PWM Strings',
    values: {
      'vco1.wave': 2, 'vco2.wave': 2, 'mixer.vco2': 0.7, 'vco2.pitch': -6,
      'lfo.target': 1, 'lfo.rate': 0.7, 'lfo.int': 0.45, 'filter.cutoff': 3200,
      'ampeg.attack': 0.35, 'ampeg.sustain': 0.85, 'ampeg.release': 0.9,
      'mod.on': 1, 'mod.type': 0, 'reverb.on': 1, 'reverb.mix': 0.3,
    },
  },
  {
    name: 'Riser FX',
    values: {
      'vco1.wave': 1, 'vco1.shape': 0.6, 'mixer.multi': 0.3, 'multi.noise': 0,
      'eg.target': 2, 'eg.attack': 4, 'eg.decay': 0.5, 'eg.int': 0.25,
      'filter.cutoff': 600, 'lfo.target': 2, 'lfo.rate': 6, 'lfo.int': 0.3,
      'mod.on': 1, 'mod.type': 3, 'reverb.on': 1, 'reverb.type': 3, 'reverb.mix': 0.5,
    },
  },
];

const KEY = 'synthwork.userPresets';

export function loadUserPresets() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}

export function saveUserPresets(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch { return false; }
}

// Fill in defaults and drop unknown keys, so old preset files keep working.
export function resolvePreset(values) {
  const out = defaultValues();
  for (const [id, v] of Object.entries(values || {})) if (id in PARAMS) out[id] = v;
  return out;
}
