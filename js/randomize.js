// Randomize: build a fresh patch within musical limits (no silent mixes, no wild vibrato,
// effects used in moderation). Mutate: nudge the current patch by a small amount.
// Master volume and tempo are always left alone.

import { PARAMS, defaultValues, toValue, toNorm } from './params.js';

const rnd = Math.random;
const between = (a, b) => a + rnd() * (b - a);
const chance = (p) => rnd() < p;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
// Pick an index with the given relative weights.
function pick(weights) {
  let r = rnd() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) if ((r -= weights[i]) < 0) return i;
  return weights.length - 1;
}
// A knob value from a range of knob positions (0..1), so log-scaled knobs behave.
const knob = (id, lo, hi) => toValue(PARAMS[id], between(lo, hi));

const KEEP = ['master.volume', 'arp.tempo'];

// Final safety pass: keep pitch modulation gentle and the mix clearly audible.
function tame(v) {
  if (v['lfo.target'] === 0) v['lfo.int'] = Math.max(-0.04, Math.min(0.04, v['lfo.int']));
  if (v['eg.target'] !== 0) v['eg.int'] = Math.max(-0.15, Math.min(0.15, v['eg.int']));
  if (v['mixer.vco1'] + v['mixer.vco2'] + v['mixer.multi'] < 0.6) v['mixer.vco1'] = Math.max(v['mixer.vco1'], 0.6);
  return v;
}

export function randomPatch(current) {
  const v = defaultValues();
  for (const id of KEEP) v[id] = current[id];

  // Oscillators
  v['vco1.wave'] = pick([3, 2, 2, 2]);
  v['vco1.octave'] = pick([1, 4, 2, 0.5]);
  v['vco1.shape'] = chance(0.5) ? between(0, 0.7) : 0;
  v['vco2.wave'] = pick([3, 2, 2, 1.5]);
  v['vco2.octave'] = pick([1, 3, 2, 1]);
  v['vco2.shape'] = chance(0.5) ? between(0, 0.7) : 0;
  v['vco2.pitch'] = [0, (chance(0.5) ? 1 : -1) * between(3, 15), 700, -500, 1200][pick([3, 4, 1, 0.5, 0.5])];
  v['vco2.sync'] = chance(0.12) ? 1 : 0;
  v['vco2.ring'] = chance(0.08) ? 1 : 0;
  v['multi.type'] = pick([1, 1]);
  v['multi.noise'] = pick([1, 1, 1, 1]);
  v['multi.vpm'] = pick([1, 1, 1, 1, 1]);
  v['multi.shape'] = between(0.1, 0.8);

  // Mixer (always clearly audible)
  v['mixer.vco1'] = between(0.55, 0.9);
  v['mixer.vco2'] = chance(0.7) ? between(0.2, 0.75) : 0;
  v['mixer.multi'] = chance(0.35) ? between(0.1, 0.6) : 0;

  // Filter
  const ft = pick([4, 3, 1, 1, 0.7, 1.3]);
  v['filter.type'] = ft;
  v['filter.cutoff'] = ft === 2 ? knob('filter.cutoff', 0.2, 0.55) : ft === 3 ? knob('filter.cutoff', 0.45, 0.75) : knob('filter.cutoff', 0.4, 0.9);
  v['filter.resonance'] = between(0, 0.6);
  v['filter.drive'] = chance(0.4) ? between(0, 0.5) : 0;
  v['filter.keytrack'] = pick([1, 3, 2]);
  v['filter.vowel'] = rnd();

  // Envelopes: pick a playing style first so the four stages fit together.
  const style = pick([1, 1.2, 1]); // pluck, keys, pad
  const [a, d, s, r] = [
    [[0, 0.15], [0.25, 0.5], [0, 0.3], [0.2, 0.45]],
    [[0, 0.2], [0.4, 0.65], [0.4, 0.8], [0.3, 0.5]],
    [[0.45, 0.7], [0.55, 0.8], [0.6, 0.95], [0.6, 0.8]],
  ][style];
  v['ampeg.attack'] = knob('ampeg.attack', ...a);
  v['ampeg.decay'] = knob('ampeg.decay', ...d);
  v['ampeg.sustain'] = between(...s);
  v['ampeg.release'] = knob('ampeg.release', ...r);
  v['eg.target'] = pick([5, 1, 1]);
  v['eg.attack'] = knob('eg.attack', 0, 0.4);
  v['eg.decay'] = knob('eg.decay', 0.2, 0.7);
  v['eg.int'] = !chance(0.7) ? 0 : v['eg.target'] === 0 ? between(-0.3, 0.6) : between(-0.08, 0.12);

  // LFO (pitch modulation kept subtle)
  v['lfo.wave'] = pick([1, 3, 1, 1.5, 2]);
  v['lfo.target'] = pick([1, 2, 3]);
  v['lfo.sync'] = chance(0.4) ? 1 + pick([1, 1, 1, 1, 1, 1]) : 0;
  v['lfo.rate'] = knob('lfo.rate', 0.1, 0.6);
  v['lfo.int'] = chance(0.4) ? 0 : [between(0, 0.03), between(0, 0.5), between(-0.4, 0.4)][v['lfo.target']];

  // Voice
  v['voice.mode'] = pick([6, 1.5, 1, 1.5]);
  v['voice.depth'] = v['voice.mode'] <= 1 ? between(0, 0.5) : rnd();
  v['voice.glide'] = chance(0.2) ? between(0.03, 0.25) : 0;
  v['arp.latch'] = 0;
  v['arp.rate'] = pick([0.5, 1.5, 1, 3, 1, 1]);
  v['arp.gate'] = between(0.3, 0.9);

  // Effects, in moderation
  if (chance(0.12)) Object.assign(v, { 'pump.on': 1, 'pump.rate': pick([1, 3, 1]), 'pump.depth': between(0.4, 0.8), 'pump.release': between(0.3, 0.7) });
  if (chance(0.12)) Object.assign(v, { 'crush.on': 1, 'crush.bits': between(4, 10), 'crush.rate': knob('crush.rate', 0.1, 0.6), 'crush.mix': between(0.4, 0.9) });
  if (chance(0.15)) Object.assign(v, { 'dist.on': 1, 'dist.type': pick([1, 1, 1]), 'dist.amount': between(0.2, 0.6), 'dist.mix': between(0.4, 0.8) });
  if (chance(0.15)) Object.assign(v, { 'tape.on': 1, 'tape.wow': between(0.2, 0.6), 'tape.flutter': between(0.1, 0.5), 'tape.mix': 1 });
  if (chance(0.35)) Object.assign(v, { 'mod.on': 1, 'mod.type': pick([1, 1, 1, 1]), 'mod.time': between(0.2, 0.6), 'mod.depth': between(0.3, 0.7), 'mod.mix': between(0.25, 0.5) });
  if (chance(0.4)) Object.assign(v, { 'delay.on': 1, 'delay.type': pick([1, 1, 1]), 'delay.time': knob('delay.time', 0.45, 0.8), 'delay.depth': between(0.2, 0.55), 'delay.mix': between(0.15, 0.35) });
  if (chance(0.65)) Object.assign(v, { 'reverb.on': 1, 'reverb.type': pick([2, 1, 2, 0.3, 1, 1.2]), 'reverb.time': between(0.3, 0.8), 'reverb.depth': between(0.3, 0.8), 'reverb.mix': between(0.15, 0.45) });
  return tame(v);
}

// Switches that would change how the instrument is played are left as they are.
const MUTATE_SKIP = new Set([...KEEP, 'voice.mode', 'arp.latch']);

export function mutate(current, amount = 0.15) {
  const v = { ...current };
  for (const [id, p] of Object.entries(PARAMS)) {
    if (MUTATE_SKIP.has(id)) continue;
    if (p.toggle) { if (chance(0.04)) v[id] = v[id] ? 0 : 1; continue; }
    if (p.choices) { if (chance(0.08)) v[id] = Math.floor(rnd() * p.choices.length); continue; }
    let amt = amount;
    if (id === 'vco1.pitch' || id === 'vco2.pitch') amt = 0.004;      // a few cents
    if (id === 'lfo.int' && v['lfo.target'] === 0) amt = 0.01;          // gentle vibrato only
    if (id === 'filter.resonance') amt *= 0.7;
    const nudge = ((rnd() + rnd() + rnd()) - 1.5) / 1.5;                // roughly bell-shaped, -1..1
    v[id] = toValue(p, clamp01(toNorm(p, v[id]) + nudge * amt));
  }
  return tame(v);
}
