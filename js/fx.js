// Effects chain (main thread, built from native Web Audio nodes):
//   Mod FX (chorus / ensemble / phaser / flanger) -> Delay -> Reverb
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
    else if (this.built && (key === 'time' || key === 'depth')) this.update();
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
      n.disconnect();
    }
    this.parts = [];
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
];

export class ReverbFX extends FXUnit {
  build() {
    this.conv = this.node(this.ctx.createConvolver());
    this.input.connect(this.conv).connect(this.wet);
  }

  update() {
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
        data[i] = y * env;
      }
      for (let e = 0; e < cfg.early; e++) { // discrete early reflections
        const at = pre + Math.floor((0.004 + Math.random() * 0.05) * sr);
        data[at] += (Math.random() < 0.5 ? -1 : 1) * (0.6 - e * 0.05);
      }
    }
    return buf;
  }
}
