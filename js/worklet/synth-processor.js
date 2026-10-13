// Voice engine: runs on the audio thread inside an AudioWorklet.
//
// Signal path per voice:
//   VCO1 + VCO2 + Multi Engine -> Mixer -> Drive -> Filter -> Amp EG
// Filter types: 12 dB low-pass, 24 dB "ladder" low-pass, high-pass, band-pass, notch,
// and a vowel (formant) filter.
// Modulation: EG (cutoff / pitch / pitch 2) and LFO (pitch / shape / cutoff), with
// tempo sync and random shapes. A tempo-synced "pump" ducks the output like a sidechain.
//
// The main thread talks to this file only through messages:
//   { type: 'noteOn', note, velocity } | { type: 'noteOff', note } | { type: 'allOff' }
//   { type: 'param', id, value }       | { type: 'params', values }

import { CHORDS, chordIndex, ARP_TYPES, arpIndex, ARP_RATES, defaultValues } from '../params.js';

const NUM_VOICES = 8;
const TWO_PI = Math.PI * 2;
const OCTAVE_OFFSET = [-1, 0, 1, 2]; // 16' 8' 4' 2'
const KEYTRACK = [0, 0.5, 1];
const VPM_RATIO = [1, 2, 3.5, 1.414, 0.5];
const POLY_SPREAD = [-1, 0.33, -0.33, 1, -0.66, 0.66, 0.1, -0.1]; // per-voice detune shape in Poly mode
const UNISON_SPREAD = Array.from({ length: NUM_VOICES }, (_, i) => -1 + (2 * i) / (NUM_VOICES - 1));
const LFO_SYNC_BEATS = [0, 8, 4, 2, 1, 0.5, 0.25]; // Free, 2 bars, 1 bar, 1/2, 1/4, 1/8, 1/16
const PUMP_BEATS = [2, 1, 0.5]; // 1/2, 1/4, 1/8

// Filter types (index of 'filter.type')
const LP12 = 0, LP24 = 1, HP = 2, BP = 3, NOTCH = 4, VOWEL = 5;
// Vowel formants (Hz) and their relative levels: A E I O U
const FORMANTS = [
  [730, 1090, 2440], [530, 1840, 2480], [270, 2290, 3010], [570, 840, 2410], [300, 870, 2240],
];
const FORMANT_GAIN = [1, 0.6, 0.4];

// Supersaw: seven saws spread around the note, the centre one loudest.
const SUPER_OFFSETS = [-1, -0.66, -0.33, 0, 0.33, 0.66, 1];
const SUPER_GAIN = SUPER_OFFSETS.map((o) => (o === 0 ? 0.55 : 0.32));
const SUPER_NORM = 1.6 / SUPER_GAIN.reduce((a, b) => a + b, 0);

const midiToHz = (n) => 440 * Math.pow(2, (n - 69) / 12);
const frac = (x) => x - Math.floor(x);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

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
//  (Super is handled separately: it needs seven phases.)
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

// Seven detuned saws; SHAPE sets the detune spread (up to about +/-0.7 semitones).
function superSaw(phases, dt, shape) {
  const spread = Math.pow(shape, 1.5) * 0.04;
  let y = 0;
  for (let j = 0; j < 7; j++) {
    const d = dt * (1 + SUPER_OFFSETS[j] * spread);
    let ph = phases[j] + d;
    if (ph >= 1) ph -= 1;
    phases[j] = ph;
    y += saw(ph, d) * SUPER_GAIN[j];
  }
  return y * SUPER_NORM * 1.35; // about as loud as a single saw
}

// One step of a topology-preserving state-variable filter. `c` holds
// [a1, a2, a3] at offset `o`; `st` holds [ic1, ic2] at offset `so`. Returns band (v1)
// and low (v2) through `out`.
function svf(x, c, o, st, so, out) {
  const v3 = x - st[so + 1];
  const v1 = c[o] * st[so] + c[o + 1] * v3;
  const v2 = st[so + 1] + c[o + 1] * st[so] + c[o + 2] * v3;
  st[so] = 2 * v1 - st[so];
  st[so + 1] = 2 * v2 - st[so + 1];
  out[0] = v1; out[1] = v2;
}

function svfCoefs(c, o, fc, sr, k) {
  const g = Math.tan(Math.PI * fc / sr);
  const a1 = 1 / (1 + g * (g + k));
  c[o] = a1; c[o + 1] = g * a1; c[o + 2] = g * g * a1;
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
    this.ss1 = Float64Array.from({ length: 7 }, Math.random); // supersaw phases
    this.ss2 = Float64Array.from({ length: 7 }, Math.random);
    this.pc = 0; this.pm = 0;
    this.amp = new Envelope();
    this.eg = new Envelope();
    this.st = new Float64Array(10);  // filter states: main, ladder 2nd stage, 3 formants
    this.c = new Float64Array(15);   // filter coefficients (same layout)
    this.k = 2;                      // main filter damping
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
    // Arpeggiator state
    this.arpDown = new Set();  // keys physically held right now
    this.arpNotes = [];        // notes the arp plays, in press order (survives key-up when latched)
    this.arpVoices = [];       // voices sounding the current step
    this.arpStep = 0;
    this.arpCount = 0;         // samples until the next step
    this.arpGateCount = 0;     // samples until the current step is released
    // LFO state (S&H and Drift pick new random values each cycle)
    this.lfoPhase = 0;
    this.lfoHold = 0; this.lfoPrev = 0; this.lfoNext = Math.random() * 2 - 1;
    this.pumpPhase = 0;        // position in the pump cycle, reset by the first note
    this.tick = 0;             // sample counter, for control-rate filter updates
    this.tmp = new Float64Array(2);
    this.smoothCoef = 1 - Math.exp(-1 / (0.005 * sr));
    this.s = {}; // smoothed copies of continuous params
    for (const k of ['filter.cutoff', 'filter.resonance', 'filter.drive', 'filter.vowel', 'mixer.vco1',
      'mixer.vco2', 'mixer.multi', 'vco1.shape', 'vco2.shape', 'multi.shape', 'pump.depth']) this.s[k] = this.p[k];
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
    const prev = this.p[id];
    this.p[id] = value;
    if (id === 'voice.mode' && value !== prev) this.allOff();
    // Turning latch off drops notes whose keys are no longer held.
    if (id === 'arp.latch' && !value && prev) {
      this.arpNotes = this.arpNotes.filter((n) => this.arpDown.has(n));
    }
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

  get beatSamples() { return (this.sr * 60) / this.p['arp.tempo']; }

  // Called whenever a note (or arp step) starts. The first note after silence (or the
  // first step of an arpeggio) restarts the pump cycle and any tempo-synced LFO, so they
  // line up with what you play.
  onTrigger(fromSilence) {
    if (fromSilence) {
      this.pumpPhase = 0;
      if (this.p['lfo.sync'] > 0) this.lfoPhase = 0;
    }
    if (this.p['lfo.keysync']) this.lfoPhase = 0;
  }

  // --- Note handling / voice modes ----------------------------------------
  noteOn(key) {
    const mode = this.p['voice.mode'];
    const depth = this.p['voice.depth'];
    if (mode === 0) {
      this.onTrigger(!this.voices.some((v) => v.gate));
      const v = this.allocate(key);
      v.trigger(key, key, POLY_SPREAD[this.voices.indexOf(v)] * depth * 20, ++this.order);
      return;
    }
    if (mode === 3) {
      // With latch on, the first key after letting go of everything starts a new set.
      if (this.p['arp.latch'] && this.arpDown.size === 0) this.arpNotes = [];
      this.arpDown.add(key);
      if (!this.arpNotes.includes(key)) {
        if (this.arpNotes.length === 0) { this.arpStep = 0; this.arpCount = 0; this.arpFresh = true; } // start on the beat
        this.arpNotes.push(key);
      }
      return;
    }
    this.held = this.held.filter((k) => k !== key);
    this.held.push(key);
    this.onTrigger(!this.voices.some((v) => v.gate));
    this.playMono(key);
  }

  noteOff(key) {
    const mode = this.p['voice.mode'];
    if (mode === 0) {
      for (const v of this.voices) if (v.gate && v.key === key) v.release();
      return;
    }
    if (mode === 3) {
      this.arpDown.delete(key);
      if (!this.p['arp.latch']) this.arpNotes = this.arpNotes.filter((n) => n !== key);
      return;
    }
    const wasCurrent = this.held[this.held.length - 1] === key;
    this.held = this.held.filter((k) => k !== key);
    if (!wasCurrent) return;
    if (this.held.length) this.playMono(this.held[this.held.length - 1]);
    else for (const v of this.voices) v.release();
  }

  // Unison and Chord modes: the voices respond to the most recent key.
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
    this.arpDown.clear();
    this.arpNotes = [];
    this.arpVoices = [];
    for (const v of this.voices) v.release();
  }

  // --- Arpeggiator -----------------------------------------------------------
  // Called once per sample in Arp mode.
  arpTick() {
    if (this.arpGateCount > 0 && --this.arpGateCount === 0) this.arpRelease();
    if (this.arpNotes.length === 0) {
      if (this.arpVoices.length) this.arpRelease();
      return;
    }
    if (--this.arpCount > 0) return;

    const p = this.p;
    const stepLen = this.beatSamples / ARP_RATES[p['arp.rate']];
    this.arpCount = Math.max(1, Math.round(stepLen));
    this.arpRelease();
    this.onTrigger(this.arpFresh);
    this.arpFresh = false;

    const seq = this.arpSequence();
    const notes = seq[this.arpStep % seq.length];
    this.arpStep = (this.arpStep + 1) % seq.length;
    const order = ++this.order;
    for (const n of notes) {
      if (n > 127) continue;
      const v = this.allocate(n);
      v.trigger(n, n, 0, order);
      this.arpVoices.push(v);
    }
    // Gate 100% holds each note until the next step (legato).
    this.arpGateCount = p['arp.gate'] >= 1 ? 0 : Math.max(1, Math.round(stepLen * p['arp.gate']));
  }

  arpRelease() {
    for (const v of this.arpVoices) v.release();
    this.arpVoices = [];
  }

  // The notes for each step of the current pattern; each step is an array
  // (one note, or every held note in the Poly patterns).
  arpSequence() {
    const [, order, octaves] = ARP_TYPES[arpIndex(this.p['voice.depth'])];
    const held = this.arpNotes.slice(0, 16);
    const span = (list) => {
      const out = [];
      for (let o = 0; o < octaves; o++) for (const n of list) out.push(n + 12 * o);
      return out;
    };
    const up = [...held].sort((a, b) => a - b);
    switch (order) {
      case 'manual': return span(held).map((n) => [n]);
      case 'rise': return span(up).map((n) => [n]);
      case 'fall': return span(up).reverse().map((n) => [n]);
      case 'risefall': {
        const r = span(up);
        return r.concat(r.slice(1, -1).reverse()).map((n) => [n]);
      }
      case 'poly': {
        const steps = [];
        for (let o = 0; o < octaves; o++) steps.push(held.slice(0, NUM_VOICES).map((n) => n + 12 * o));
        return steps;
      }
      default: { // random
        const r = span(up);
        return [[r[Math.floor(Math.random() * r.length)]]];
      }
    }
  }

  // --- LFO -----------------------------------------------------------------
  lfoValue(wave) {
    const lp = this.lfoPhase;
    switch (wave) {
      case 0: return 1 - 2 * lp;                         // saw
      case 1: return lp < 0.5 ? 4 * lp - 1 : 3 - 4 * lp; // triangle
      case 2: return lp < 0.5 ? 1 : -1;                   // square
      case 3: return this.lfoHold;                        // sample & hold
      default: {                                          // drift: smooth random
        const t = (1 - Math.cos(Math.PI * lp)) / 2;
        return this.lfoPrev + (this.lfoNext - this.lfoPrev) * t;
      }
    }
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
    const ftype = p['filter.type'];
    const kt = KEYTRACK[p['filter.keytrack']];
    const egInt = p['eg.int'], egTarget = p['eg.target'];
    const lfoWave = p['lfo.wave'];
    const syncBeats = LFO_SYNC_BEATS[p['lfo.sync']];
    const lfoInc = (syncBeats ? sr / this.beatSamples / syncBeats : p['lfo.rate']) / sr;
    const lfoInt = p['lfo.int'], lfoTarget = p['lfo.target'];
    const sus = p['ampeg.sustain'];
    const keys = Object.keys(s);
    const arp = p['voice.mode'] === 3;
    const voiceGain = p['voice.mode'] === 1 ? 0.6 : 1; // Unison stacks all 8 voices
    const pumpOn = p['pump.on'];
    const pumpInc = 1 / (this.beatSamples * PUMP_BEATS[p['pump.rate']]);
    const pumpAttack = Math.min(0.2, 0.004 * sr * pumpInc); // ~4 ms dip, as a fraction of the cycle
    const pumpRelease = Math.max(0.01, p['pump.release'] * 0.35);
    const tmp = this.tmp;

    for (let i = 0; i < outL.length; i++) {
      if (arp) this.arpTick();
      for (const k of keys) s[k] += (p[k] - s[k]) * sm;

      // Global LFO, -1..1
      const before = this.lfoPhase;
      this.lfoPhase = frac(this.lfoPhase + lfoInc);
      if (this.lfoPhase < before) { // new cycle: new random values
        this.lfoHold = Math.random() * 2 - 1;
        this.lfoPrev = this.lfoNext;
        this.lfoNext = Math.random() * 2 - 1;
      }
      const lfoMod = this.lfoValue(lfoWave) * lfoInt;
      const lfoPitch = lfoTarget === 0 ? lfoMod * 12 : 0;
      const lfoShape = lfoTarget === 1 ? lfoMod : 0;
      const lfoCut = lfoTarget === 2 ? lfoMod * 48 : 0;

      const sh1 = clamp01(s['vco1.shape'] + lfoShape);
      const sh2 = clamp01(s['vco2.shape'] + lfoShape);
      const shM = clamp01(s['multi.shape'] + lfoShape);
      const res = s['filter.resonance'];
      const drive = 1 + s['filter.drive'] * 5;
      const driveComp = 1 / Math.tanh(drive);
      const control = (this.tick++ & 7) === 0; // update filter coefficients every 8 samples

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
        const o1 = w1 === 3 ? superSaw(v.ss1, dt1, sh1) : osc(w1, v.p1, dt1, sh1);

        // VCO 2 (with hard sync to VCO 1 and ring modulation)
        v.p2 += dt2;
        if (v.p2 >= 1) v.p2 -= 1;
        if (sync && wrapped) v.p2 = v.p1 * (dt2 / dt1);
        let o2 = w2 === 3 ? superSaw(v.ss2, dt2, sh2) : osc(w2, v.p2, dt2, sh2);
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

        // Filter
        const cutSemis = (v.note - 60) * kt + (egTarget === 0 ? eg * 72 : 0) + lfoCut;
        let y;
        if (ftype === VOWEL) {
          // Three resonant band-passes at the formants of a vowel. VOWEL picks the vowel
          // (EG and LFO "cutoff" modulation sweep it); CUTOFF shifts the formants up or
          // down like a bigger or smaller voice; RESONANCE narrows them.
          if (control) {
            const pos = clamp01(s['filter.vowel'] + (egTarget === 0 ? eg : 0) + lfoCut / 48) * 4;
            const a = Math.min(3, Math.floor(pos)), t = pos - a;
            const shift = Math.pow(2, Math.log2(s['filter.cutoff'] / 1000) * 0.25);
            const kf = 1 / (4 + res * 16);
            for (let f = 0; f < 3; f++) {
              const hz = (FORMANTS[a][f] * (1 - t) + FORMANTS[a + 1][f] * t) * shift;
              svfCoefs(v.c, 6 + f * 3, Math.min(nyq, hz), sr, kf);
            }
            v.k = kf;
          }
          y = 0;
          for (let f = 0; f < 3; f++) {
            svf(x, v.c, 6 + f * 3, v.st, 4 + f * 2, tmp);
            y += tmp[0] * v.k * FORMANT_GAIN[f];
          }
          y *= 7; // narrow band-passes pass little energy; bring it up to match the other types
        } else {
          if (control) {
            const fc = Math.min(nyq, Math.max(20, s['filter.cutoff'] * Math.pow(2, cutSemis / 12)));
            v.k = 2 - 1.97 * res;
            svfCoefs(v.c, 0, fc, sr, v.k);
            if (ftype === LP24) svfCoefs(v.c, 3, fc, sr, 1.414);
          }
          if (ftype === LP24) {
            // Ladder-style 24 dB: a gentle first stage into the resonant one, with input
            // saturation and some bass make-up as resonance rises.
            svf(Math.tanh(x * 1.5) / 1.2, v.c, 3, v.st, 2, tmp);
            svf(tmp[1], v.c, 0, v.st, 0, tmp);
            y = tmp[1] * (1 + res * 0.8);
          } else {
            svf(x, v.c, 0, v.st, 0, tmp);
            const band = tmp[0], low = tmp[1];
            y = ftype === HP ? x - v.k * band - low
              : ftype === BP ? band * v.k * 1.3
              : ftype === NOTCH ? x - v.k * band
              : low;
          }
        }

        out += y * amp;
      }

      // Pump: duck the output at the start of each beat and let it swell back.
      if (pumpOn) {
        this.pumpPhase += pumpInc;
        if (this.pumpPhase >= 1) this.pumpPhase -= 1;
        const ph = this.pumpPhase;
        const dip = ph < pumpAttack ? ph / pumpAttack : Math.exp(-(ph - pumpAttack) / pumpRelease);
        out *= 1 - s['pump.depth'] * dip;
      }

      const yOut = Math.tanh(out * 0.6 * voiceGain);
      outL[i] = yOut;
      if (outR) outR[i] = yOut;
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
      this.queue = []; // timestamped messages, sorted by frame
      this.port.onmessage = (e) => {
        const msg = e.data;
        if (msg.type === 'clearScheduled') { this.queue = []; return; }
        if (msg.time == null) { this.engine.handle(msg); return; }
        // Messages with a `time` (AudioContext seconds) are applied at that exact sample.
        const frame = Math.round(msg.time * sampleRate);
        let i = this.queue.length;
        while (i > 0 && this.queue[i - 1].frame > frame) i--;
        this.queue.splice(i, 0, { frame, msg });
      };
    }
    process(_inputs, outputs) {
      const [L, R] = outputs[0];
      const n = L.length;
      let pos = 0;
      while (this.queue.length && this.queue[0].frame < currentFrame + n) {
        const ev = this.queue.shift();
        const at = Math.max(pos, ev.frame - currentFrame);
        if (at > pos) {
          this.engine.render(L.subarray(pos, at), R?.subarray(pos, at));
          pos = at;
        }
        this.engine.handle(ev.msg);
      }
      if (pos < n) this.engine.render(L.subarray(pos), R?.subarray(pos));
      return true;
    }
  }
  registerProcessor('synth-processor', SynthProcessor);
}
