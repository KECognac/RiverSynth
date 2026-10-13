// River presets: a sound, the note mapping and speed, the Data -> Sound routes, and
// optionally a gauge and dates, saved together so a whole sonification can be recalled.
//
// Factory presets refer to a factory program by name (plus optional overrides).
// User presets store the full sound, and live in this browser's localStorage.
// Low/High must be C notes (the menus list C1-C8).

export const RIVER_FACTORY = [
  {
    name: 'Snowmelt Choir',
    program: 'Choir Pad',
    gauge: { site: '06752260', start: '2024-01-01', end: '2024-12-31' },
    settings: { scale: 'Major pentatonic', root: 0, low: 48, high: 72, bpm: 96, rate: '1/8', gate: 0.95, tie: true, spread: 'even', log: true, roar: true, roarLevel: 0.45 },
    routes: [
      { id: 'filter.vowel', source: 'flow', from: 0.15, to: 0.95 },
      { id: 'reverb.mix', source: 'anomaly', from: 0.1, to: 0.6 },
      { id: 'filter.resonance', source: 'turbulence', from: 0.2, to: 0.7 },
    ],
  },
  {
    name: 'Glacier Bells',
    program: 'Glockenspiel',
    settings: { scale: 'Minor pentatonic', root: 9, low: 60, high: 96, bpm: 120, rate: '1/16', gate: 0.5, tie: false, spread: 'even', log: true, roar: false },
    routes: [
      { id: 'filter.cutoff', source: 'flow', from: 0.5, to: 0.95 },
      { id: 'reverb.mix', source: 'anomaly', from: 0.1, to: 0.55 },
    ],
  },
  {
    name: 'Flash Flood Pump',
    program: 'Supersaw Anthem',
    values: { 'pump.on': 1, 'pump.rate': 1, 'pump.depth': 0.6 },
    gauge: { site: '16704000', start: '2024-01-01', end: '2024-12-31' },
    settings: { scale: 'Natural minor', root: 2, low: 48, high: 84, bpm: 128, rate: '1/16', gate: 0.55, tie: false, spread: 'even', log: true, roar: true, roarLevel: 0.7 },
    routes: [
      { id: 'filter.cutoff', source: 'flow', from: 0.3, to: 0.95 },
      { id: 'pump.depth', source: 'turbulence', from: 0.2, to: 0.9 },
      { id: 'delay.depth', source: 'change', from: 0.1, to: 0.7 },
    ],
  },
  {
    name: 'Drought Watch',
    program: 'Grandmother Flow',
    settings: { scale: 'Dorian', root: 2, low: 36, high: 72, bpm: 80, rate: '1/8', gate: 0.9, tie: true, spread: 'even', log: true, roar: true, roarLevel: 0.4 },
    routes: [
      { id: 'reverb.mix', source: 'anomaly', from: 0.05, to: 0.7 },
      { id: 'filter.cutoff', source: 'anomaly', from: 0.3, to: 0.85 },
      { id: 'lfo.int', source: 'turbulence', from: 0.5, to: 0.8 },
    ],
  },
  {
    name: 'Lo-Fi Creek',
    program: 'Lo-Fi Keys',
    gauge: { site: '01474000', start: '2024-01-01', end: '2024-12-31' },
    settings: { scale: 'Major', root: 5, low: 48, high: 72, bpm: 84, rate: '1/8', gate: 0.7, tie: false, spread: 'even', log: true, roar: true, roarLevel: 0.5 },
    routes: [
      { id: 'crush.bits', source: 'flow', from: 0.2, to: 0.75 }, // low water crunchy, high water clean
      { id: 'reverb.mix', source: 'anomaly', from: 0.1, to: 0.5 },
    ],
  },
  {
    name: 'Arctic Breakup',
    program: 'Shimmer Cathedral',
    gauge: { site: '15565447', start: '2024-01-01', end: '2024-12-31' },
    settings: { scale: 'Whole tone', root: 0, low: 48, high: 84, bpm: 100, rate: '1/4', gate: 1, tie: true, spread: 'even', log: true, roar: true, roarLevel: 0.6 },
    routes: [
      { id: 'filter.cutoff', source: 'flow', from: 0.35, to: 0.9 },
      { id: 'delay.depth', source: 'change', from: 0.1, to: 0.65 },
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
