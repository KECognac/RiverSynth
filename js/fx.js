// Effects chain (main thread, built from Web Audio nodes):
//   Crush -> Mod FX (chorus / ensemble / phaser / flanger) -> Delay -> Reverb
// The bitcrusher and the shimmer reverb's pitch shifter run as AudioWorklets
// (js/worklet/fx-processors.js).
// Each unit has an input, an output, a dry path and a wet path.

class FXUnit {
  constructor(ctx) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.input.connect(this.dry).connect(this.output);
    this.wet.connect(this.output);
    this.parts = []; // nodes created by build(), torn down on type change
    this.p = { on: 0, type: 0, time: 0.5, depth: 0.5, mix: 0.3 };
    this.wet.gain.value = 0;
  }

  set(key, value) {
    const prev = this.p[key];
    this.p[key] = value;
    if (key === 'type' && value !== prev && this.built) this.rebuild();
    else if (key === 'on' && value && !this.built) this.rebuild();
    else if (this.built && key !== 'on' && key !== 'type' && key !== 'mix') this.update();
    this.applyMix();
  }

  applyMix() {
    const t = this.ctx.currentTime;
    const { on, mix } = this.p;
    // Equal-power crossfade between dry and wet.
    const dry = on ? Math.cos(mix * Math.PI / 2) : 1;
    const wet = on ? Math.sin(mix * Math.PI / 2) : 0;
    this.dry.gain.setTargetAtTime(dry, t, 0.02);
    this.wet.gain.setTargetAtTime(wet, t, 0.02);
  }

  node(n) { this.parts.push(n); return n; }

  rebuild() {
    for (const n of this.parts) {
      try { n.stop?.(); } catch { /* not started */ }
      n.port?.postMessage('end'); // let worklet processors shut down
      n.disconnect();
    }
    this.parts = [];
    this.input.disconnect(); // drop links into the old nodes, keep the dry path
    this.input.connect(this.dry);
    this.build();
    this.built = true;
    this.update();
  }
}

// --- Modulation effects -----------------------------------------------------
const MOD_PRESETS = {
  // taps: [base delay (s), lfo depth (s), lfo rate multiplier, pan, lfo polarity]
  0: { taps: [[0.012, 0.004, 1, -1, 1], [0.014, 0.004, 1, 1, -1]], fb: 0 },                     // Chorus
  1: { taps: [[0.008, 0.003, 1, -1, 1], [0.010, 0.003, 1.13, 0, -1], [0.009, 0.003, 0.87, 1, 1]], fb: 0 }, // Ensemble
  3: { taps: [[0.002, 0.0018, 1, -0.6, 1], [0.0025, 0.0018, 1, 0.6, -1]], fb: 0.8 },             // Flanger
};

export class ModFX extends FXUnit {
  build() {
    const ctx = this.ctx;
    this.lfos = [];
    this.fbs = [];
    if (this.p.type === 2) { // Phaser: six all-pass stages swept by an LFO
      const lfo = this.node(ctx.createOscillator());
      const depth = this.node(ctx.createGain());
      lfo.connect(depth);
      let prev = this.input;
      this.stages = [];
      for (let i = 0; i < 6; i++) {
        const ap = this.node(ctx.createBiquadFilter());
        ap.type = 'allpass';
        ap.frequency.value = 800;
        ap.Q.value = 0.6;
        depth.connect(ap.frequency);
        prev.connect(ap);
        prev = ap;
        this.stages.push(ap);
      }
      prev.connect(this.wet);
      lfo.start();
      this.lfos.push({ osc: lfo, gain: depth, rate: 1, depthScale: 650 });
      return;
    }
    const cfg = MOD_PRESETS[this.p.type];
    for (const [base, amt, rate, pan, pol] of cfg.taps) {
      const d = this.node(ctx.createDelay(0.05));
      d.delayTime.value = base;
      const lfo = this.node(ctx.createOscillator());
      const g = this.node(ctx.createGain());
      lfo.connect(g).connect(d.delayTime);
      const panner = this.node(ctx.createStereoPanner());
      panner.pan.value = pan;
      this.input.connect(d);
      d.connect(panner).connect(this.wet);
      if (cfg.fb) {
        const fb = this.node(ctx.createGain());
        d.connect(fb).connect(d);
        this.fbs.push(fb);
      }
      lfo.start();
      this.lfos.push({ osc: lfo, gain: g, rate, depthScale: amt * pol });
    }
  }

  update() {
    const t = this.ctx.currentTime;
    const hz = 0.05 * Math.pow(160, this.p.time); // 0.05 .. 8 Hz
    for (const l of this.lfos) {
      l.osc.frequency.setTargetAtTime(hz * l.rate, t, 0.05);
      l.gain.gain.setTargetAtTime(this.p.depth * l.depthScale, t, 0.05);
    }
    for (const fb of this.fbs) fb.gain.setTargetAtTime(this.p.depth * 0.85, t, 0.05);
  }
}

// --- Delay ---------------------------------------------------------------------
export class DelayFX extends FXUnit {
  build() {
    const ctx = this.ctx;
    this.delays = [];
    this.fbs = [];
    if (this.p.type === 2) { // Ping-pong: mono in, bouncing between left and right
      const mono = this.node(ctx.createGain());
      mono.channelCount = 1;
      mono.channelCountMode = 'explicit';
      const dl = this.node(ctx.createDelay(2));
      const dr = this.node(ctx.createDelay(2));
      const fbl = this.node(ctx.createGain());
      const fbr = this.node(ctx.createGain());
      const merge = this.node(ctx.createChannelMerger(2));
      this.input.connect(mono).connect(dl);
      dl.connect(merge, 0, 0);
      dl.connect(fbl).connect(dr);
      dr.connect(merge, 0, 1);
      dr.connect(fbr).connect(dl);
      merge.connect(this.wet);
      this.delays.push(dl, dr);
      this.fbs.push(fbl, fbr);
      return;
    }
    const tape = this.p.type === 1;
    const d = this.node(ctx.createDelay(2));
    const fb = this.node(ctx.createGain());
    const tone = this.node(ctx.createBiquadFilter());
    tone.type = 'lowpass';
    tone.frequency.value = tape ? 3200 : 9000;
    this.input.connect(d);
    d.connect(this.wet);
    if (tape) { // darker repeats, saturation and a little wow
      const sat = this.node(ctx.createWaveShaper());
      const curve = new Float32Array(1024);
      for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh((i / 511.5 - 1) * 1.6);
      sat.curve = curve;
      d.connect(tone).connect(sat).connect(fb).connect(d);
      const wow = this.node(ctx.createOscillator());
      const wowAmt = this.node(ctx.createGain());
      wow.frequency.value = 0.6;
      wowAmt.gain.value = 0.0015;
      wow.connect(wowAmt).connect(d.delayTime);
      wow.start();
    } else {
      d.connect(tone).connect(fb).connect(d);
    }
    this.delays.push(d);
    this.fbs.push(fb);
  }

  update() {
    const t = this.ctx.currentTime;
    for (const d of this.delays) d.delayTime.setTargetAtTime(this.p.time, t, 0.05);
    for (const fb of this.fbs) fb.gain.setTargetAtTime(this.p.depth, t, 0.05);
  }
}

// --- Reverb ----------------------------------------------------------------------
// Impulse responses are synthesised: filtered noise with a decaying (or rising) envelope.
const REVERB_TYPES = [
  { len: 3.2, pre: 0.025, bright: 7000, dark: 1200, early: 0 },      // Hall
  { len: 0.9, pre: 0.006, bright: 6000, dark: 1800, early: 8 },      // Room
  { len: 2.2, pre: 0, bright: 12000, dark: 4000, early: 0 },         // Plate
  { len: 3.0, pre: 0, bright: 9000, dark: 3000, early: 0, rise: 1 }, // Riser
  { len: 1.8, pre: 0.004, bright: 4500, dark: 1800, early: 0, spring: 1 }, // Spring
  { len: 4.0, pre: 0.02, bright: 9000, dark: 4000, early: 0, shimmer: 1 }, // Shimmer
];

export class ReverbFX extends FXUnit {
  build() {
    const ctx = this.ctx;
    this.conv = this.node(ctx.createConvolver());
    this.fb = null;
    if (!REVERB_TYPES[this.p.type].shimmer) {
      this.input.connect(this.conv).connect(this.wet);
      return;
    }
    // Shimmer: the reverb's output is pitched up an octave and fed back into it, so
    // each pass rises higher as it fades. Filters in the loop keep it from building up mud
    // or harshness; TONE sets how much is fed back.
    const sum = this.node(ctx.createGain());
    this.input.connect(sum).connect(this.conv).connect(this.wet);
    const hp = this.node(ctx.createBiquadFilter());
    hp.type = 'highpass'; hp.frequency.value = 250;
    const lp = this.node(ctx.createBiquadFilter());
    lp.type = 'lowpass'; lp.frequency.value = 7000;
    const shift = this.node(new AudioWorkletNode(ctx, 'pitch-shift', {
      numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2],
    }));
    this.fb = this.node(ctx.createGain());
    const loopDelay = this.node(ctx.createDelay(0.1));
    loopDelay.delayTime.value = 0.03;
    this.conv.connect(hp).connect(lp).connect(shift).connect(this.fb).connect(loopDelay).connect(sum);
  }

  update() {
    if (this.fb) this.fb.gain.setTargetAtTime(0.2 + this.p.depth * 0.4, this.ctx.currentTime, 0.05);
    clearTimeout(this.timer); // regenerate at most every 120 ms while a knob turns
    this.timer = setTimeout(() => { this.conv.buffer = this.makeIR(); }, this.conv.buffer ? 120 : 0);
  }

  makeIR() {
    const sr = this.ctx.sampleRate;
    const cfg = REVERB_TYPES[this.p.type];
    const len = cfg.len * (0.25 + this.p.time * 1.75);
    const tone = 0.35 + this.p.depth * 1.3;
    const pre = Math.floor(cfg.pre * sr);
    const n = pre + Math.floor(len * sr);
    const buf = this.ctx.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      let y = 0;
      for (let i = pre; i < n; i++) {
        const t = (i - pre) / sr;
        const x = t / len;
        const env = cfg.rise
          ? Math.pow(x, 1.6) * (x > 0.94 ? (1 - x) / 0.06 : 1)
          : Math.exp(-6.9 * x);
        const fc = Math.min(sr * 0.45, cfg.bright * tone * Math.pow(cfg.dark / cfg.bright, x));
        y += (Math.random() * 2 - 1 - y) * (1 - Math.exp(-2 * Math.PI * fc / sr));
        data[i] = y * env * (cfg.spring ? 0.35 : 1);
      }
      if (cfg.spring) this.addSpringChirps(data, sr, pre, len, ch);
      for (let e = 0; e < cfg.early; e++) { // discrete early reflections
        const at = pre + Math.floor((0.004 + Math.random() * 0.05) * sr);
        data[at] += (Math.random() < 0.5 ? -1 : 1) * (0.6 - e * 0.05);
      }
    }
    return buf;
  }

  // A spring tank's "drip": each pass of the wave down the spring returns as a falling
  // chirp (high frequencies travel faster), repeating every ~30 ms and dying away.
  addSpringChirps(data, sr, pre, len, ch) {
    const period = 0.031 + ch * 0.0027; // slightly different springs left and right
    const n = Math.floor(0.022 * sr);
    for (let k = 0; ; k++) {
      const t0 = 0.004 + k * period;
      if (t0 > len) break;
      const amp = 0.9 * Math.exp(-6.9 * t0 / len);
      const start = pre + Math.floor(t0 * sr);
      let ph = 0;
      for (let j = 0; j < n && start + j < data.length; j++) {
        const x = j / n;
        ph += 2 * Math.PI * (3800 * Math.pow(400 / 3800, x)) / sr;
        data[start + j] += amp * 0.6 * Math.sin(ph) * Math.sin(Math.PI * x);
      }
    }
  }
}

// --- River roar ------------------------------------------------------------------
// A continuous rushing-water layer for the data player: looped stereo pink noise through
// two low-pass filters. Flow sets loudness and brightness (a trickle at low flow, a roar
// at high flow), and two slow LFOs make it surge and babble.
export class RiverRoar {
  constructor(ctx, destination) {
    this.ctx = ctx;
    this.level = 0.6;
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(2, sr * 6, sr);
    for (let ch = 0; ch < 2; ch++) { // Paul Kellet's pink noise filter, independent per channel
      const d = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    this.lp1 = ctx.createBiquadFilter();
    this.lp2 = ctx.createBiquadFilter();
    for (const f of [this.lp1, this.lp2]) { f.type = 'lowpass'; f.Q.value = 0.5; f.frequency.value = 400; }
    const trem = ctx.createGain();
    this.vca = ctx.createGain();
    this.vca.gain.value = 0;
    src.connect(this.lp1).connect(this.lp2).connect(trem).connect(this.vca).connect(destination);

    // Surging: slow LFO on the filters' detune; babble: faster, gentle tremolo.
    const surge = ctx.createOscillator(), surgeAmt = ctx.createGain();
    surge.frequency.value = 0.13; surgeAmt.gain.value = 350; // cents
    surge.connect(surgeAmt);
    surgeAmt.connect(this.lp1.detune);
    surgeAmt.connect(this.lp2.detune);
    const babble = ctx.createOscillator(), babbleAmt = ctx.createGain();
    babble.frequency.value = 0.71; babbleAmt.gain.value = 0.12;
    babble.connect(babbleAmt).connect(trem.gain);
    src.start(); surge.start(); babble.start();
  }

  setLevel(level) { this.level = level; }

  // t: 0..1 flow; time: when (AudioContext seconds); smooth: glide time constant (s)
  setFlow(t, time, smooth) {
    const gain = this.level * (0.03 + 0.5 * t * t);
    const fc = 250 * Math.pow(32, t); // 250 Hz trickle -> 8 kHz roar
    this.vca.gain.setTargetAtTime(gain, time, smooth);
    this.lp1.frequency.setTargetAtTime(fc, time, smooth);
    this.lp2.frequency.setTargetAtTime(fc, time, smooth);
  }

  silence() {
    const now = this.ctx.currentTime;
    for (const p of [this.vca.gain, this.lp1.frequency, this.lp2.frequency]) p.cancelScheduledValues(now);
    this.vca.gain.setTargetAtTime(0, now, 0.3);
  }
}

// --- Crush ---------------------------------------------------------------------
// Bit-depth and sample-rate reduction for lo-fi, chiptune and "data" textures.
export class CrushFX extends FXUnit {
  build() {
    this.crusher = this.node(new AudioWorkletNode(this.ctx, 'crusher', {
      numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2],
    }));
    this.input.connect(this.crusher).connect(this.wet);
  }

  update() {
    const t = this.ctx.currentTime;
    this.crusher.parameters.get('bits').setValueAtTime(this.p.bits ?? 8, t);
    this.crusher.parameters.get('down').setValueAtTime(this.p.rate ?? 4, t);
  }
}
