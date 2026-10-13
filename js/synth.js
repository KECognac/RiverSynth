// Main-thread synth: owns the AudioContext, the voice engine (AudioWorklet),
// the effects chain and an analyser for the oscilloscope.
//
// Every input source -- computer keyboard, on-screen keyboard, MIDI and data time
// series -- drives the synth through the same three calls:
//   synth.noteOn(note), synth.noteOff(note), synth.setParam(id, value)
//
// The same audio chain can also be built in an OfflineAudioContext to render a whole
// performance to a WAV file faster than real time (see renderOffline).

import { defaultValues, isFxParam } from './params.js';
import { CrushFX, DistFX, TapeFX, ModFX, DelayFX, ReverbFX, RiverRoar } from './fx.js';
import { Recorder, encodeWav } from './recorder.js';

async function loadModules(ctx) {
  await ctx.audioWorklet.addModule(new URL('./worklet/synth-processor.js', import.meta.url));
  await ctx.audioWorklet.addModule(new URL('./worklet/fx-processors.js', import.meta.url));
}

// engine -> crush -> distortion -> tape -> mod -> delay -> reverb -> master -> limiter -> out
// (the river roar joins at the reverb, so it shares the room)
function buildChain(ctx, processorOptions) {
  const node = new AudioWorkletNode(ctx, 'synth-processor', {
    numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2], processorOptions,
  });
  const fx = {
    crush: new CrushFX(ctx), dist: new DistFX(ctx), tape: new TapeFX(ctx),
    mod: new ModFX(ctx), delay: new DelayFX(ctx), reverb: new ReverbFX(ctx),
  };
  const master = ctx.createGain();
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.1;
  node.connect(fx.crush.input);
  const order = ['crush', 'dist', 'tape', 'mod', 'delay', 'reverb'];
  for (let i = 0; i < order.length - 1; i++) fx[order[i]].output.connect(fx[order[i + 1]].input);
  fx.reverb.output.connect(master).connect(limiter).connect(ctx.destination);
  const roar = new RiverRoar(ctx, fx.reverb.input);
  return { node, fx, master, limiter, roar };
}

// Apply an effects/master parameter to a chain, optionally at a scheduled time.
function routeFx(chain, ctx, id, value, time) {
  const [unit, key] = id.split('.');
  if (unit === 'master') chain.master.gain.setTargetAtTime(value, time ?? ctx.currentTime, 0.02);
  else chain.fx[unit].set(key, value, time);
}

export class Synth {
  constructor() {
    this.values = defaultValues();
    this.ctx = null;
    this.listeners = new Set(); // called with (id, value) on every param change
    this.paramTimers = new Set();
  }

  get running() { return this.ctx?.state === 'running'; }

  async start() {
    if (this.ctx) { await this.ctx.resume(); return; }
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;
    await loadModules(ctx);
    const chain = buildChain(ctx);
    this.chain = chain;
    Object.assign(this, chain); // node, fx, master, limiter, roar
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 4096;
    this.node.connect(this.analyser);
    this.recorder = new Recorder(ctx, chain.limiter);

    this.setParams(this.values);
    for (const msg of this.pending ?? []) this.node.port.postMessage(msg);
    this.pending = null;
    await ctx.resume();
  }

  setParam(id, value) {
    this.values[id] = value;
    if (this.node) this.route(id, value);
    for (const fn of this.listeners) fn(id, value);
  }

  setParams(values) {
    Object.assign(this.values, values);
    if (this.node) {
      const engine = {};
      for (const [id, v] of Object.entries(values)) {
        if (isFxParam(id)) this.route(id, v);
        else engine[id] = v;
      }
      this.node.port.postMessage({ type: 'params', values: engine });
    }
    for (const [id, v] of Object.entries(values)) for (const fn of this.listeners) fn(id, v);
  }

  route(id, value) {
    if (isFxParam(id)) routeFx(this.chain, this.ctx, id, value);
    else this.node.port.postMessage({ type: 'param', id, value });
  }

  // `time` (optional, AudioContext seconds) schedules the event sample-accurately.
  noteOn(note, velocity = 1, time) { this.send({ type: 'noteOn', note, velocity, time }); }
  noteOff(note, time) { this.send({ type: 'noteOff', note, time }); }
  allNotesOff() { this.send({ type: 'allOff' }); }
  // Change a parameter at a future AudioContext time (used by the data player, so knobs
  // move in step with the notes). Timer-based, which is plenty for parameter changes.
  setParamAt(id, value, time) {
    const ms = this.ctx ? (time - this.ctx.currentTime) * 1000 : 0;
    const timer = setTimeout(() => { this.paramTimers.delete(timer); this.setParam(id, value); }, Math.max(0, ms));
    this.paramTimers.add(timer);
  }

  // Drop notes and parameter changes scheduled for the future that haven't happened yet.
  clearScheduled() {
    this.send({ type: 'clearScheduled' });
    for (const t of this.paramTimers) clearTimeout(t);
    this.paramTimers.clear();
  }

  // Notes played while audio is still starting up are queued, not dropped.
  send(msg) {
    if (this.node) this.node.port.postMessage(msg);
    else (this.pending ??= []).push(msg);
  }

  // Render a performance offline and return a WAV Blob.
  //   values:   the patch to start from
  //   notes:    [{ type: 'noteOn' | 'noteOff', note, time }]
  //   params:   [{ id, value, time }] scheduled parameter changes
  //   roar:     { level, steps: [{ t, time, smooth }] } or null
  //   duration: seconds (include a tail for releases and reverb)
  async renderOffline({ values, notes = [], params = [], roar = null, duration, sampleRate = 44100, onProgress }) {
    const ctx = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);
    await loadModules(ctx);
    const engineValues = {}, fxValues = {};
    for (const [id, v] of Object.entries(values)) (isFxParam(id) ? fxValues : engineValues)[id] = v;
    const events = [...notes, ...params.filter((p) => !isFxParam(p.id))
      .map((p) => ({ type: 'param', id: p.id, value: p.value, time: p.time }))]
      .sort((a, b) => a.time - b.time);
    const chain = buildChain(ctx, { values: engineValues, events });
    for (const [id, v] of Object.entries(fxValues)) routeFx(chain, ctx, id, v, 0);
    for (const p of params) if (isFxParam(p.id)) routeFx(chain, ctx, p.id, p.value, p.time);
    if (roar) {
      chain.roar.setLevel(roar.level);
      for (const r of roar.steps) chain.roar.setFlow(r.t, r.time, r.smooth);
    }
    // Progress updates: pause the render every so often (where the browser supports it).
    if (onProgress && ctx.suspend) {
      const every = Math.max(2, duration / 50);
      for (let t = every; t < duration; t += every) {
        ctx.suspend(t).then(() => { onProgress(t / duration); ctx.resume(); }).catch(() => {});
      }
    }
    const buf = await ctx.startRendering();
    onProgress?.(1);
    return encodeWav([buf.getChannelData(0)], [buf.getChannelData(1)], sampleRate);
  }
}
