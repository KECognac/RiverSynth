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
