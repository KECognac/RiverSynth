// Voice engine: runs on the audio thread inside an AudioWorklet.
//
// Signal path per voice (like the minilogue):
//   VCO1 + VCO2 + Multi Engine -> Mixer -> Drive -> 2-pole low-pass filter -> Amp EG
// Modulation: EG (cutoff / pitch / pitch 2) and LFO (pitch / shape / cutoff).
//
// The main thread talks to this file only through messages:
//   { type: 'noteOn', note, velocity } | { type: 'noteOff', note } | { type: 'allOff' }
//   { type: 'param', id, value }       | { type: 'params', values }

import { CHORDS, chordIndex, defaultValues } from '../params.js';

const NUM_VOICES = 4;
const TWO_PI = Math.PI * 2;
const OCTAVE_OFFSET = [-1, 0, 1, 2]; // 16' 8' 4' 2'
const KEYTRACK = [0, 0.5, 1];
const VPM_RATIO = [1, 2, 3.5, 1.414, 0.5];
const POLY_SPREAD = [-1, 0.33, -0.33, 1]; // per-voice detune shape in Poly mode
const UNISON_SPREAD = [-1, -0.33, 0.33, 1];

const midiToHz = (n) => 440 * Math.pow(2, (n - 69) / 12);
const frac = (x) => x - Math.floor(x);

function polyBlep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}

const saw = (p, dt) => 2 * p - 1 - polyBlep(p, dt);

// Analog-style oscillator with a continuous SHAPE control.
//  Saw: morphs toward a square by subtracting a half-cycle-shifted saw.
//  Tri: wavefolding.
//  Sqr: pulse width 50% -> 95%.
function osc(wave, p, dt, shape) {
  if (wave === 0) {
    return shape > 0 ? saw(p, dt) - shape * saw(frac(p + 0.5), dt) : saw(p, dt);
  }
  if (wave === 1) {
    const tri = p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
    if (shape <= 0) return tri;
    const y = frac((tri * (1 + shape * 3) + 1) * 0.25);
    return y < 0.5 ? 4 * y - 1 : 3 - 4 * y;
  }
  const pw = 0.5 + 0.45 * shape;
  let y = p < pw ? 1 : -1;
  y += polyBlep(p, dt);
  y -= polyBlep(frac(p - pw + 1), dt);
  return y - (2 * pw - 1);
}

class Envelope {
  constructor() { this.stage = 0; this.level = 0; } // 0 idle, 1 attack, 2 decay/sustain, 3 release
  gateOn() { this.stage = 1; }
  gateOff() { if (this.stage !== 0) this.stage = 3; }
  // a/d/r are per-sample coefficients; sustain 0..1
  tick(a, d, s, r) {
    switch (this.stage) {
      case 1:
        this.level += (1.3 - this.level) * a;
        if (this.level >= 1) { this.level = 1; this.stage = 2; }
        break;
      case 2:
        this.level += (s - this.level) * d;
        break;
      case 3:
        this.level -= this.level * r;
        if (this.level < 1e-5) { this.level = 0; this.stage = 0; }
        break;
    }
    return this.level;
  }
}

class Voice {
  constructor() {
    this.key = -1;      // the key that triggered this voice
    this.note = 60;     // the note it plays (differs from key in Chord mode)
    this.detune = 0;    // cents
    this.gate = false;
    this.started = 0;   // allocation order, for voice stealing
    this.p1 = Math.random(); this.p2 = Math.random();
    this.pc = 0; this.pm = 0;
    this.amp = new Envelope();
    this.eg = new Envelope();
    this.ic1 = 0; this.ic2 = 0; // filter state
    // noise state
    this.nLp = 0; this.nBand = 0; this.nLow = 0; this.nHold = 0; this.nCount = 0;
  }
  get active() { return this.amp.stage !== 0; }
  trigger(key, note, detune, order) {
    this.key = key; this.note = note; this.detune = detune;
    this.gate = true; this.started = order;
    this.amp.gateOn(); this.eg.gateOn();
  }
  release() { this.gate = false; this.amp.gateOff(); this.eg.gateOff(); }
}

export class SynthEngine {
  constructor(sr) {
    this.sr = sr;
    this.p = defaultValues();
    this.voices = Array.from({ length: NUM_VOICES }, () => new Voice());
    this.held = []; // keys held, in press order (for Unison / Chord note priority)
    this.order = 0;
    this.lfoPhase = 0;
    this.smoothCoef = 1 - Math.exp(-1 / (0.005 * sr));
    this.s = {}; // smoothed copies of continuous params
    for (const k of ['filter.cutoff', 'filter.resonance', 'filter.drive', 'mixer.vco1', 'mixer.vco2',
      'mixer.multi', 'vco1.shape', 'vco2.shape', 'multi.shape']) this.s[k] = this.p[k];
    this.updateCoefs();
  }

  handle(msg) {
    switch (msg.type) {
      case 'noteOn': this.noteOn(msg.note); break;
      case 'noteOff': this.noteOff(msg.note); break;
      case 'allOff': this.allOff(); break;
      case 'param': this.setParam(msg.id, msg.value); break;
      case 'params': for (const id in msg.values) this.setParam(id, msg.values[id]); break;
    }
  }

  setParam(id, value) {
    const prevMode = this.p['voice.mode'];
    this.p[id] = value;
    if (id === 'voice.mode' && value !== prevMode) this.allOff();
    this.updateCoefs();
  }

  updateCoefs() {
    const sr = this.sr, p = this.p;
    const attack = (t) => 1 - Math.exp(-1.466 / (t * sr)); // reaches 1.0 at time t (target 1.3)
    const decay = (t) => 1 - Math.exp(-5 / (t * sr));      // ~99% of the way at time t
    this.ampA = attack(p['ampeg.attack']);
    this.ampD = decay(p['ampeg.decay']);
    this.ampR = decay(p['ampeg.release']);
    this.egA = attack(p['eg.attack']);
    this.egD = decay(p['eg.decay']);
  }

  // --- Note handling / voice modes ----------------------------------------
  noteOn(key) {
    const mode = this.p['voice.mode'];
    const depth = this.p['voice.depth'];
    if (mode === 0) {
      const v = this.allocate(key);
      v.trigger(key, key, POLY_SPREAD[this.voices.indexOf(v)] * depth * 20, ++this.order);
      return;
    }
    this.held = this.held.filter((k) => k !== key);
    this.held.push(key);
    this.playMono(key);
  }

  noteOff(key) {
    const mode = this.p['voice.mode'];
    if (mode === 0) {
      for (const v of this.voices) if (v.gate && v.key === key) v.release();
      return;
    }
    const wasCurrent = this.held[this.held.length - 1] === key;
    this.held = this.held.filter((k) => k !== key);
    if (!wasCurrent) return;
    if (this.held.length) this.playMono(this.held[this.held.length - 1]);
    else for (const v of this.voices) v.release();
  }

  // Unison and Chord modes: all four voices respond to the most recent key.
  playMono(key) {
    const mode = this.p['voice.mode'];
    const depth = this.p['voice.depth'];
    const order = ++this.order;
    if (mode === 1) {
      this.voices.forEach((v, i) => v.trigger(key, key, UNISON_SPREAD[i] * depth * 35, order));
    } else {
      const intervals = CHORDS[chordIndex(depth)][1];
      this.voices.forEach((v, i) => {
        if (i < intervals.length) v.trigger(key, key + intervals[i], 0, order);
        else v.release();
      });
    }
  }

  allocate(key) {
    // Re-use a voice already playing this key, then a silent voice, then the
    // oldest released voice, and finally steal the oldest held voice.
    const vs = this.voices;
    const byAge = (a, b) => a.started - b.started;
    return vs.find((v) => v.active && v.key === key)
      || vs.filter((v) => !v.active).sort(byAge)[0]
      || vs.filter((v) => !v.gate).sort(byAge)[0]
      || [...vs].sort(byAge)[0];
  }

  allOff() {
    this.held = [];
    for (const v of this.voices) v.release();
  }

  // --- Audio ---------------------------------------------------------------
  render(outL, outR) {
    const p = this.p, s = this.s, sr = this.sr, sm = this.smoothCoef;
    const nyq = sr * 0.45;
    const w1 = p['vco1.wave'], w2 = p['vco2.wave'];
    const oct1 = OCTAVE_OFFSET[p['vco1.octave']] * 12 + p['vco1.pitch'] / 100;
    const oct2 = OCTAVE_OFFSET[p['vco2.octave']] * 12 + p['vco2.pitch'] / 100;
    const sync = p['vco2.sync'], ring = p['vco2.ring'];
    const multiType = p['multi.type'], noiseType = p['multi.noise'];
    const vpmRatio = VPM_RATIO[p['multi.vpm']];
    const kt = KEYTRACK[p['filter.keytrack']];
    const egInt = p['eg.int'], egTarget = p['eg.target'];
    const lfoWave = p['lfo.wave'], lfoInc = p['lfo.rate'] / sr;
    const lfoInt = p['lfo.int'], lfoTarget = p['lfo.target'];
    const sus = p['ampeg.sustain'];
    const keys = Object.keys(s);

    for (let i = 0; i < outL.length; i++) {
      for (const k of keys) s[k] += (p[k] - s[k]) * sm;

      // Global LFO, -1..1
      this.lfoPhase = frac(this.lfoPhase + lfoInc);
      const lp = this.lfoPhase;
      const lfo = lfoWave === 0 ? 1 - 2 * lp : lfoWave === 1 ? (lp < 0.5 ? 4 * lp - 1 : 3 - 4 * lp) : (lp < 0.5 ? 1 : -1);
      const lfoMod = lfo * lfoInt;
      const lfoPitch = lfoTarget === 0 ? lfoMod * 12 : 0;
      const lfoShape = lfoTarget === 1 ? lfoMod : 0;
      const lfoCut = lfoTarget === 2 ? lfoMod * 48 : 0;

      const sh1 = Math.min(1, Math.max(0, s['vco1.shape'] + lfoShape));
      const sh2 = Math.min(1, Math.max(0, s['vco2.shape'] + lfoShape));
      const shM = Math.min(1, Math.max(0, s['multi.shape'] + lfoShape));
      const res = s['filter.resonance'];
      const k = 2 - 1.97 * res;
      const drive = 1 + s['filter.drive'] * 5;
      const driveComp = 1 / Math.tanh(drive);

      let out = 0;
      for (const v of this.voices) {
        if (!v.active) continue;
        const amp = v.amp.tick(this.ampA, this.ampD, sus, this.ampR);
        const eg = v.eg.tick(this.egA, this.egD, 0, this.egD) * egInt;

        const base = v.note + v.detune / 100 + lfoPitch;
        const egPitch = eg * 48;
        const n1 = base + oct1 + (egTarget === 2 ? egPitch : 0);
        const n2 = base + oct2 + (egTarget >= 1 ? egPitch : 0);
        const dt1 = Math.min(0.49, midiToHz(n1) / sr);
        const dt2 = Math.min(0.49, midiToHz(n2) / sr);

        // VCO 1
        v.p1 += dt1;
        let wrapped = false;
        if (v.p1 >= 1) { v.p1 -= 1; wrapped = true; }
        const o1 = osc(w1, v.p1, dt1, sh1);

        // VCO 2 (with hard sync to VCO 1 and ring modulation)
        v.p2 += dt2;
        if (v.p2 >= 1) v.p2 -= 1;
        if (sync && wrapped) v.p2 = v.p1 * (dt2 / dt1);
        let o2 = osc(w2, v.p2, dt2, sh2);
        if (ring) o2 *= o1;

        // Multi engine
        let om = 0;
        if (p['mixer.multi'] > 0 || s['mixer.multi'] > 1e-4) {
          if (multiType === 0) om = this.noise(v, noiseType, shM);
          else {
            const fc = midiToHz(base + (egTarget === 2 ? egPitch : 0)) / sr;
            v.pc = frac(v.pc + fc);
            v.pm = frac(v.pm + fc * vpmRatio);
            om = Math.sin(TWO_PI * v.pc + shM * 6 * Math.sin(TWO_PI * v.pm));
          }
        }

        // Mixer + drive
        let x = (o1 * s['mixer.vco1'] + o2 * s['mixer.vco2'] + om * s['mixer.multi']) * 0.5;
        if (drive > 1.001) x = Math.tanh(x * drive) * driveComp;

        // 2-pole (12 dB/oct) low-pass, topology-preserving state-variable filter
        const cutSemis = (v.note - 60) * kt + (egTarget === 0 ? eg * 72 : 0) + lfoCut;
        const fc = Math.min(nyq, Math.max(20, s['filter.cutoff'] * Math.pow(2, cutSemis / 12)));
        const g = Math.tan(Math.PI * fc / sr);
        const a1 = 1 / (1 + g * (g + k));
        const a2 = g * a1, a3 = g * a2;
        const v3 = x - v.ic2;
        const v1 = a1 * v.ic1 + a2 * v3;
        const v2 = v.ic2 + a2 * v.ic1 + a3 * v3;
        v.ic1 = 2 * v1 - v.ic1;
        v.ic2 = 2 * v2 - v.ic2;

        out += v2 * amp;
      }

      const y = Math.tanh(out * 0.6);
      outL[i] = y;
      if (outR) outR[i] = y;
    }
  }

  // Four noise colours; SHAPE sets the filter frequency or decimation rate.
  noise(v, type, shape) {
    const w = Math.random() * 2 - 1;
    const sr = this.sr;
    if (type === 0) { // High: white minus its low-passed part
      const a = 1 - Math.exp(-TWO_PI * (200 * Math.pow(60, shape)) / sr);
      v.nLp += (w - v.nLp) * a;
      return (w - v.nLp) * 1.2;
    }
    if (type === 1) { // Low
      const a = 1 - Math.exp(-TWO_PI * (80 * Math.pow(100, shape)) / sr);
      v.nLp += (w - v.nLp) * a;
      return v.nLp * (1.5 + (1 - shape) * 3);
    }
    if (type === 2) { // Peak: resonant band-pass
      const f = 2 * Math.sin(Math.PI * Math.min(7000, 100 * Math.pow(70, shape)) / sr);
      const high = w - v.nLow - 0.15 * v.nBand;
      v.nBand += f * high;
      v.nLow += f * v.nBand;
      return Math.max(-1.5, Math.min(1.5, v.nBand * 0.5));
    }
    // Decim: sample-and-hold
    const period = Math.max(1, Math.round(sr / (200 * Math.pow(100, shape))));
    if (++v.nCount >= period) { v.nCount = 0; v.nHold = w; }
    return v.nHold;
  }
}

if (typeof registerProcessor === 'function') {
  class SynthProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this.engine = new SynthEngine(sampleRate);
      this.port.onmessage = (e) => this.engine.handle(e.data);
    }
    process(_inputs, outputs) {
      const out = outputs[0];
      this.engine.render(out[0], out[1]);
      return true;
    }
  }
  registerProcessor('synth-processor', SynthProcessor);
}
