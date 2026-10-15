// River presets: a sound, the note mapping and speed, the Data -> Sound routes, and
// optionally a gauge and dates, saved together so a whole sonification can be recalled.
//
// Factory presets refer to a factory program by name (plus optional overrides), or carry
// their own sound in `values` (settings that differ from the defaults).
// User presets store the full sound, and live in this browser's localStorage.
// Low/High must be C notes (the menus list C1-C8).

export const RIVER_FACTORY = [
  {
    // Folksy Fort Collins: fingerpicked triads on a plucked-guitar sound in G major
    // pentatonic. Each day gives the arp a triad, picked root-3rd-5th-3rd and flowing on
    // from day to day, with an octave-below body for depth. Slapback echo and spring reverb
    // for the western twang. Flow brightens the pick, fast changes build the echoes,
    // stormy weeks wobble the tape, wetter-than-normal stretches get more space.
    name: "Poudre Pickin'",
    program: 'Prairie Guitar',
    values: { 'voice.mode': 3, 'voice.depth': 6 / 12, 'arp.latch': 0, 'arp.rate': 3, 'arp.gate': 0.7, 'arp.tempo': 96 },
    gauge: { site: '06752260', start: '2024-01-01', end: '2024-12-31' },
    settings: { scale: 'Major pentatonic', root: 7, low: 48, high: 72, bpm: 96, rate: '1/4', gate: 1, tie: false, voicing: 'triad', spread: 'even', log: true, roar: true, roarLevel: 0.3 },
    routes: [
      { id: 'filter.cutoff', source: 'flow', from: 0.5, to: 0.8 },
      { id: 'delay.depth', source: 'change', from: 0.1, to: 0.45 },
      { id: 'tape.wow', source: 'turbulence', from: 0.1, to: 0.7 },
      { id: 'reverb.mix', source: 'anomaly', from: 0.15, to: 0.45 },
    ],
  },
  {
    // Your saved version (from "New Glacier Bells").
    name: 'Glacier Bells',
    values: {
      'vco1.wave': 1, 'vco1.octave': 2, 'vco1.shape': 0.08, 'vco2.wave': 1,
      'vco2.octave': 3, 'vco2.pitch': 557, 'mixer.vco1': 0.95, 'mixer.vco2': 0.45,
      'filter.cutoff': 7000, 'filter.resonance': 0, 'filter.keytrack': 0, 'ampeg.attack': 0.001,
      'ampeg.decay': 2.2, 'ampeg.sustain': 0, 'ampeg.release': 10, 'eg.attack': 0.001,
      'eg.decay': 0.04, 'eg.int': 0.3, 'arp.tempo': 40, 'reverb.on': 1,
      'reverb.type': 2, 'reverb.time': 0.45, 'reverb.depth': 0.75, 'reverb.mix': 0.25,
      'master.volume': 0.95,
    },
    gauge: { site: '06752260', start: '2024-01-01', end: '2024-12-31' },
    settings: { scale: 'Minor pentatonic', root: 9, low: 60, high: 84, log: true, bpm: 120, rate: '1/16', gate: 0.5, tie: true, loop: true, spread: 'even', roar: false, roarLevel: 0.45 },
    routes: [
      { id: 'filter.cutoff', source: 'flow', from: 0.5, to: 0.72 },
      { id: 'reverb.mix', source: 'anomaly', from: 0.1, to: 0.55 },
    ],
  },
  {
    // Grimes "Genesis"-style arpeggios from a flashy river: each day gives the arpeggiator a
    // triad from the scale, and Rise Fall over 2 octaves sweeps it up and down (about two and
    // a half octaves) in flowing 1/16s that carry on from day to day. Grandmother Bass sound
    // with a hall reverb and dotted-eighth echoes. Flow opens the filter, stormy weeks add
    // squelch, flash floods build echoes, wetter-than-normal stretches get more space.
    name: 'Flash Flood Pump',
    program: 'Grandmother Bass',
    values: {
      'voice.mode': 3, 'voice.depth': 7 / 12, 'arp.latch': 0, 'arp.rate': 3, 'arp.gate': 0.55, 'arp.tempo': 100,
      'ampeg.release': 0.25,
      'delay.on': 1, 'delay.type': 2, 'delay.time': 0.45, 'delay.depth': 0.45, 'delay.mix': 0.3, // dotted 1/8 at 100
      'reverb.on': 1, 'reverb.type': 0, 'reverb.time': 0.7, 'reverb.depth': 0.55, 'reverb.mix': 0.35,
    },
    gauge: { site: '16704000', start: '2024-01-01', end: '2024-12-31' },
    settings: { scale: 'Natural minor', root: 2, low: 36, high: 60, bpm: 100, rate: '1/4', gate: 1, tie: false, voicing: 'triad', spread: 'even', log: true, roar: true, roarLevel: 0.4 },
    routes: [
      { id: 'filter.cutoff', source: 'flow', from: 0.45, to: 0.85 },
      { id: 'filter.resonance', source: 'turbulence', from: 0.2, to: 0.55 },
      { id: 'delay.depth', source: 'change', from: 0.3, to: 0.6 },
      { id: 'reverb.mix', source: 'anomaly', from: 0.2, to: 0.45 },
    ],
  },
  {
    // Your saved version (from "New Drought Watch").
    name: 'Drought Watch',
    values: {
      'vco1.wave': 3, 'vco1.pitch': 9.198, 'vco2.wave': 1, 'vco2.octave': 2,
      'vco2.pitch': -9, 'vco2.sync': 1, 'multi.type': 1, 'multi.vpm': 1,
      'multi.shape': 0.05, 'mixer.vco1': 0.7, 'mixer.vco2': 0.3464, 'mixer.multi': 0.25,
      'filter.cutoff': 900, 'filter.resonance': 0.45, 'filter.drive': 0.25, 'ampeg.attack': 0.6,
      'ampeg.decay': 2, 'ampeg.sustain': 0.85, 'ampeg.release': 2.2, 'eg.attack': 1.2,
      'eg.decay': 2.5, 'eg.int': 0.3, 'lfo.rate': 0.12, 'lfo.int': 0.3,
      'voice.depth': 0.25, 'voice.glide': 0.07548, 'mod.on': 1, 'mod.type': 2,
      'mod.time': 0.15, 'mod.depth': 0.6, 'mod.mix': 0.35, 'delay.on': 1,
      'delay.type': 1, 'delay.time': 0.45, 'delay.depth': 0.45, 'delay.mix': 0.25,
      'reverb.on': 1, 'reverb.type': 5, 'reverb.time': 0.7, 'reverb.mix': 0.288,
    },
    gauge: { site: '06752260', start: '2024-01-01', end: '2024-12-31' },
    settings: { scale: 'Minor pentatonic', root: 2, low: 36, high: 60, log: true, bpm: 80, rate: '1/32', gate: 0.9, tie: true, loop: true, spread: 'even', roar: true, roarLevel: 0.4 },
    routes: [
      { id: 'vco1.shape', source: 'anomaly', from: 0, to: 1 },
      { id: 'filter.cutoff', source: 'anomaly', from: 0, to: 1 },
      { id: 'lfo.int', source: 'turbulence', from: 0, to: 1 },
    ],
  },
  {
    // Your saved version (from "New Lo-Fi Creek").
    name: 'Lo-Fi Creek',
    values: {
      'vco1.wave': 1, 'vco2.wave': 1, 'multi.type': 1, 'multi.shape': 0.1907,
      'mixer.vco1': 0.35, 'mixer.vco2': 0.7799, 'mixer.multi': 0.8, 'filter.cutoff': 1475,
      'filter.resonance': 0.1016, 'filter.drive': 0.1358, 'ampeg.attack': 0.007689, 'ampeg.decay': 1.5,
      'ampeg.sustain': 0.3, 'ampeg.release': 0.5, 'lfo.wave': 4, 'lfo.rate': 0.6259,
      'lfo.int': -0.01463, 'voice.depth': 0.09214, 'mod.on': 1, 'mod.mix': 0.3,
      'delay.on': 1, 'delay.time': 0.7325, 'delay.depth': 0.3817, 'delay.mix': 0.4191,
      'reverb.on': 1, 'reverb.type': 5, 'reverb.time': 0.3, 'reverb.mix': 0.25,
      'crush.bits': 4.063, 'crush.rate': 2.96, 'crush.mix': 0.6, 'dist.on': 1,
      'dist.type': 2,
    },
    gauge: { site: '01474000', start: '2024-01-01', end: '2024-12-31' },
    settings: { scale: 'Major', root: 5, low: 48, high: 72, log: true, bpm: 100, rate: '1/16', gate: 0.7, tie: true, loop: true, spread: 'even', roar: true, roarLevel: 0.5 },
    routes: [
      { id: 'reverb.mix', source: 'flow', from: 0.1903, to: 0.5903 },
      { id: 'lfo.int', source: 'anomaly', from: 0.64, to: 1 },
    ],
  },
  {
    // Ice crystals: sparkling FM bells in a minor pentatonic, scattering into echoes and
    // shimmer. Flow brightens them, sudden changes (the spring breakup) build the echoes,
    // and the river roar rumbles underneath.
    name: 'Arctic Breakup',
    program: 'Drift Bells',
    gauge: { site: '15565447', start: '2024-01-01', end: '2024-12-31' },
    settings: { scale: 'Minor pentatonic', root: 2, low: 60, high: 96, bpm: 110, rate: '1/16', gate: 0.4, tie: false, spread: 'even', log: true, roar: true, roarLevel: 0.45 },
    routes: [
      { id: 'filter.cutoff', source: 'flow', from: 0.45, to: 0.95 },
      { id: 'delay.depth', source: 'change', from: 0.15, to: 0.6 },
      { id: 'reverb.mix', source: 'anomaly', from: 0.2, to: 0.55 },
    ],
  },
];

const KEY = 'synthwork.riverPresets';

export function loadRiverPresets() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}

export function saveRiverPresets(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch { return false; }
}
