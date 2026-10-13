// Single source of truth for every synth parameter.
// The UI, presets and audio engine all read from these definitions.
//
// Continuous params: { min, max, def, curve: 'lin' | 'exp', fmt }
// Choice params:     { choices: [...labels], def: index }
// Toggle params:     { toggle: true, def: 0 | 1 }

const hz = (v) => (v >= 1000 ? `${(v / 1000).toFixed(2)} kHz` : `${v.toFixed(v < 10 ? 2 : 0)} Hz`);
const sec = (v) => (v >= 1 ? `${v.toFixed(2)} s` : `${Math.round(v * 1000)} ms`);
const pct = (v) => `${Math.round(v * 100)}%`;
const bipct = (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
const cents = (v) => `${v > 0 ? '+' : ''}${Math.round(v)} ¢`;

export const CHORDS = [
  ['5th', [0, 7]],
  ['sus2', [0, 2, 7]],
  ['m', [0, 3, 7]],
  ['Maj', [0, 4, 7]],
  ['sus4', [0, 5, 7]],
  ['m7', [0, 3, 7, 10]],
  ['7', [0, 4, 7, 10]],
  ['7sus4', [0, 5, 7, 10]],
  ['Maj7', [0, 4, 7, 11]],
  ['aug', [0, 4, 8]],
  ['dim', [0, 3, 6]],
  ['m7b5', [0, 3, 6, 10]],
  ['mMaj7', [0, 3, 7, 11]],
  ['Maj7b5', [0, 4, 6, 11]],
];

export const chordIndex = (depth) => Math.round(depth * (CHORDS.length - 1));

// Arpeggiator patterns, selected with the Depth knob in Arp mode (as on the minilogue xd).
// order: how held notes are sorted; octaves: how many octaves the pattern spans.
export const ARP_TYPES = [
  ['Manual 1', 'manual', 1], ['Manual 2', 'manual', 2],
  ['Rise 1', 'rise', 1], ['Rise 2', 'rise', 2],
  ['Fall 1', 'fall', 1], ['Fall 2', 'fall', 2],
  ['Rise Fall 1', 'risefall', 1], ['Rise Fall 2', 'risefall', 2],
  ['Poly 1', 'poly', 1], ['Poly 2', 'poly', 2],
  ['Random 1', 'random', 1], ['Random 2', 'random', 2], ['Random 3', 'random', 3],
];

export const arpIndex = (depth) => Math.round(depth * (ARP_TYPES.length - 1));
export const ARP_RATES = [1, 2, 3, 4, 6, 8]; // steps per beat for each 'arp.rate' choice

export const PARAMS = {
  // --- Oscillators ---------------------------------------------------------
  'vco1.wave':   { label: 'Wave', choices: ['Saw', 'Tri', 'Sqr'], def: 0 },
  'vco1.octave': { label: 'Octave', choices: ["16'", "8'", "4'", "2'"], def: 1 },
  'vco1.pitch':  { label: 'Pitch', min: -1200, max: 1200, def: 0, curve: 'lin', fmt: cents },
  'vco1.shape':  { label: 'Shape', min: 0, max: 1, def: 0, curve: 'lin', fmt: pct },

  'vco2.wave':   { label: 'Wave', choices: ['Saw', 'Tri', 'Sqr'], def: 0 },
  'vco2.octave': { label: 'Octave', choices: ["16'", "8'", "4'", "2'"], def: 1 },
  'vco2.pitch':  { label: 'Pitch', min: -1200, max: 1200, def: 0, curve: 'lin', fmt: cents },
  'vco2.shape':  { label: 'Shape', min: 0, max: 1, def: 0, curve: 'lin', fmt: pct },
  'vco2.sync':   { label: 'Sync', toggle: true, def: 0 },
  'vco2.ring':   { label: 'Ring', toggle: true, def: 0 },

  'multi.type':  { label: 'Engine', choices: ['Noise', 'VPM'], def: 0 },
  'multi.noise': { label: 'Noise', choices: ['High', 'Low', 'Peak', 'Decim'], def: 0 },
  'multi.vpm':   { label: 'VPM', choices: ['Sine', 'Octave', 'Bell', 'Metal', 'Sub'], def: 0 },
  'multi.shape': { label: 'Shape', min: 0, max: 1, def: 0.5, curve: 'lin', fmt: pct },

  // --- Mixer ---------------------------------------------------------------
  'mixer.vco1':  { label: 'VCO 1', min: 0, max: 1, def: 0.8, curve: 'lin', fmt: pct },
  'mixer.vco2':  { label: 'VCO 2', min: 0, max: 1, def: 0, curve: 'lin', fmt: pct },
  'mixer.multi': { label: 'Multi', min: 0, max: 1, def: 0, curve: 'lin', fmt: pct },

  // --- Filter --------------------------------------------------------------
  'filter.cutoff':    { label: 'Cutoff', min: 20, max: 20000, def: 8000, curve: 'exp', fmt: hz },
  'filter.resonance': { label: 'Resonance', min: 0, max: 1, def: 0.1, curve: 'lin', fmt: pct },
  'filter.drive':     { label: 'Drive', min: 0, max: 1, def: 0, curve: 'lin', fmt: pct },
  'filter.keytrack':  { label: 'Key Track', choices: ['0%', '50%', '100%'], def: 1 },

  // --- Envelopes -----------------------------------------------------------
  'ampeg.attack':  { label: 'Attack', min: 0.001, max: 10, def: 0.005, curve: 'exp', fmt: sec },
  'ampeg.decay':   { label: 'Decay', min: 0.001, max: 10, def: 0.4, curve: 'exp', fmt: sec },
  'ampeg.sustain': { label: 'Sustain', min: 0, max: 1, def: 0.8, curve: 'lin', fmt: pct },
  'ampeg.release': { label: 'Release', min: 0.001, max: 10, def: 0.25, curve: 'exp', fmt: sec },

  'eg.attack': { label: 'Attack', min: 0.001, max: 10, def: 0.005, curve: 'exp', fmt: sec },
  'eg.decay':  { label: 'Decay', min: 0.001, max: 10, def: 0.4, curve: 'exp', fmt: sec },
  'eg.int':    { label: 'EG Int', min: -1, max: 1, def: 0, curve: 'lin', fmt: bipct },
  'eg.target': { label: 'Target', choices: ['Cutoff', 'Pitch 2', 'Pitch'], def: 0 },

  // --- LFO -----------------------------------------------------------------
  'lfo.wave':   { label: 'Wave', choices: ['Saw', 'Tri', 'Sqr'], def: 1 },
  'lfo.rate':   { label: 'Rate', min: 0.05, max: 30, def: 2, curve: 'exp', fmt: hz },
  'lfo.int':    { label: 'Int', min: -1, max: 1, def: 0, curve: 'lin', fmt: bipct },
  'lfo.target': { label: 'Target', choices: ['Pitch', 'Shape', 'Cutoff'], def: 2 },

  // --- Voice mode ----------------------------------------------------------
  'voice.mode':  { label: 'Mode', choices: ['Poly', 'Unison', 'Chord', 'Arp'], def: 0 },
  'voice.depth': { label: 'Depth', min: 0, max: 1, def: 0, curve: 'lin', fmt: pct },

  // --- Arpeggiator (Arp voice mode) -------------------------------------------
  'arp.latch': { label: 'Latch', toggle: true, def: 0 },
  'arp.tempo': { label: 'Tempo', min: 40, max: 300, def: 120, curve: 'lin', fmt: (v) => `${Math.round(v)} BPM` },
  'arp.rate':  { label: 'Rate', choices: ['1/4', '1/8', '1/8T', '1/16', '1/16T', '1/32'], def: 3 },
  'arp.gate':  { label: 'Gate', min: 0.05, max: 1, def: 0.5, curve: 'lin', fmt: pct },

  // --- Effects -------------------------------------------------------------
  'mod.on':    { label: 'On', toggle: true, def: 0 },
  'mod.type':  { label: 'Type', choices: ['Chorus', 'Ensemble', 'Phaser', 'Flanger'], def: 0 },
  'mod.time':  { label: 'Speed', min: 0, max: 1, def: 0.4, curve: 'lin', fmt: pct },
  'mod.depth': { label: 'Depth', min: 0, max: 1, def: 0.5, curve: 'lin', fmt: pct },
  'mod.mix':   { label: 'Mix', min: 0, max: 1, def: 0.5, curve: 'lin', fmt: pct },

  'delay.on':    { label: 'On', toggle: true, def: 0 },
  'delay.type':  { label: 'Type', choices: ['Stereo', 'Tape', 'Ping-Pong'], def: 0 },
  'delay.time':  { label: 'Time', min: 0.02, max: 1.2, def: 0.35, curve: 'exp', fmt: sec },
  'delay.depth': { label: 'Feedback', min: 0, max: 0.92, def: 0.4, curve: 'lin', fmt: pct },
  'delay.mix':   { label: 'Mix', min: 0, max: 1, def: 0.3, curve: 'lin', fmt: pct },

  'reverb.on':    { label: 'On', toggle: true, def: 0 },
  'reverb.type':  { label: 'Type', choices: ['Hall', 'Room', 'Plate', 'Riser', 'Spring'], def: 0 },
  'reverb.time':  { label: 'Decay', min: 0, max: 1, def: 0.5, curve: 'lin', fmt: pct },
  'reverb.depth': { label: 'Tone', min: 0, max: 1, def: 0.5, curve: 'lin', fmt: pct },
  'reverb.mix':   { label: 'Mix', min: 0, max: 1, def: 0.3, curve: 'lin', fmt: pct },

  'master.volume': { label: 'Volume', min: 0, max: 1, def: 0.7, curve: 'lin', fmt: pct },
};

// Voice-mode depth means something different in each mode.
PARAMS['voice.depth'].fmtWith = (v, all) => {
  const mode = all['voice.mode'];
  if (mode === 2) return CHORDS[chordIndex(v)][0];
  if (mode === 3) return ARP_TYPES[arpIndex(v)][0];
  return `Detune ${Math.round(v * 100)}%`;
};

// Front-panel layout. `showIf` hides controls that don't apply.
export const SECTIONS = [
  { id: 'vco1', title: 'VCO 1', controls: ['vco1.wave', 'vco1.octave', 'vco1.pitch', 'vco1.shape'] },
  { id: 'vco2', title: 'VCO 2', controls: ['vco2.wave', 'vco2.octave', 'vco2.pitch', 'vco2.shape', 'vco2.sync', 'vco2.ring'] },
  {
    id: 'multi', title: 'Multi Engine',
    controls: ['multi.type', 'multi.noise', 'multi.vpm', 'multi.shape'],
    showIf: { 'multi.noise': (v) => v['multi.type'] === 0, 'multi.vpm': (v) => v['multi.type'] === 1 },
  },
  { id: 'mixer', title: 'Mixer', controls: ['mixer.vco1', 'mixer.vco2', 'mixer.multi'] },
  { id: 'filter', title: 'Filter', controls: ['filter.cutoff', 'filter.resonance', 'filter.drive', 'filter.keytrack'] },
  { id: 'ampeg', title: 'Amp EG', controls: ['ampeg.attack', 'ampeg.decay', 'ampeg.sustain', 'ampeg.release'] },
  { id: 'eg', title: 'EG', controls: ['eg.attack', 'eg.decay', 'eg.int', 'eg.target'] },
  { id: 'lfo', title: 'LFO', controls: ['lfo.wave', 'lfo.rate', 'lfo.int', 'lfo.target'] },
  {
    id: 'voice', title: 'Voice Mode',
    controls: ['voice.mode', 'voice.depth', 'arp.latch', 'arp.tempo', 'arp.rate', 'arp.gate'],
    showIf: Object.fromEntries(['arp.latch', 'arp.tempo', 'arp.rate', 'arp.gate']
      .map((id) => [id, (v) => v['voice.mode'] === 3])),
  },
  { id: 'master', title: 'Master', controls: ['master.volume'] },
  { id: 'mod', title: 'Mod FX', controls: ['mod.on', 'mod.type', 'mod.time', 'mod.depth', 'mod.mix'] },
  { id: 'delay', title: 'Delay', controls: ['delay.on', 'delay.type', 'delay.time', 'delay.depth', 'delay.mix'] },
  { id: 'reverb', title: 'Reverb', controls: ['reverb.on', 'reverb.type', 'reverb.time', 'reverb.depth', 'reverb.mix'] },
];

export function defaultValues() {
  const v = {};
  for (const [id, p] of Object.entries(PARAMS)) v[id] = p.def;
  return v;
}

// Knob position (0..1) <-> parameter value.
export function toValue(p, t) {
  t = Math.min(1, Math.max(0, t));
  if (p.curve === 'exp') return p.min * Math.pow(p.max / p.min, t);
  return p.min + t * (p.max - p.min);
}

export function toNorm(p, v) {
  if (p.curve === 'exp') return Math.log(v / p.min) / Math.log(p.max / p.min);
  return (v - p.min) / (p.max - p.min);
}

export function formatValue(id, v, all) {
  const p = PARAMS[id];
  if (p.fmtWith) return p.fmtWith(v, all);
  if (p.choices) return p.choices[v];
  if (p.toggle) return v ? 'On' : 'Off';
  return p.fmt ? p.fmt(v) : String(v);
}

// Which params are handled by the main-thread effects chain vs. the voice engine.
export const isFxParam = (id) => /^(mod|delay|reverb|master)\./.test(id);
