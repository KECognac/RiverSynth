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

// One voice: engine -> crush -> distortion -> tape -> mod -> delay -> reverb -> master gain
function buildVoice(ctx, processorOptions) {
  const node = new AudioWorkletNode(ctx, 'synth-processor', {
    numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2], processorOptions,
  });
  const fx = {
    crush: new CrushFX(ctx), dist: new DistFX(ctx), tape: new TapeFX(ctx),
    mod: new ModFX(ctx), delay: new DelayFX(ctx), reverb: new ReverbFX(ctx),
  };
  const master = ctx.createGain();
  node.connect(fx.crush.input);
  const order = ['crush', 'dist', 'tape', 'mod', 'delay', 'reverb'];
  for (let i = 0; i < order.length - 1; i++) fx[order[i]].output.connect(fx[order[i + 1]].input);
  fx.reverb.output.connect(master);
  return { node, fx, master };
}

// The instrument: the main voice into a limiter and out. The river roar joins at the main
// reverb (so it shares the room); layer 2 joins at the limiter.
function buildChain(ctx, processorOptions) {
  const voice = buildVoice(ctx, processorOptions);
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.1;
  voice.master.connect(limiter).connect(ctx.destination);
  const roar = new RiverRoar(ctx, voice.fx.reverb.input);
  return { ...voice, limiter, roar };
}

// Apply an effects/master parameter to a voice, optionally at a scheduled time.
// `gain` scales the master volume (layer 2's level).
function routeFx(chain, ctx, id, value, time, gain = 1) {
  const [unit, key] = id.split('.');
  if (unit === 'master') chain.master.gain.setTargetAtTime(value * gain, time ?? ctx.currentTime, 0.02);
  else chain.fx[unit].set(key, value, time);
}

const splitValues = (values) => {
  const engine = {}, fx = {};
  for (const [id, v] of Object.entries(values)) (isFxParam(id) ? fx : engine)[id] = v;
  return { engine, fx };
};

// Layer 2: a second complete voice with its own program and effects, mixed into the main
// output at its own level. The data player sends it notes.
class Layer {
  constructor(ctx, destination) {
    this.ctx = ctx;
    Object.assign(this, buildVoice(ctx));
    this.master.connect(destination);
    this.level = 0.6;
    this.values = defaultValues();
  }
  setValues(values) {
    this.values = { ...defaultValues(), ...values };
    const { engine, fx } = splitValues(this.values);
    this.node.port.postMessage({ type: 'params', values: engine });
    for (const [id, v] of Object.entries(fx)) routeFx(this, this.ctx, id, v, undefined, this.level);
  }
  setLevel(level) {
    this.level = level;
    this.master.gain.setTargetAtTime(this.values['master.volume'] * level, this.ctx.currentTime, 0.02);
  }
  send(msg) { this.node.port.postMessage(msg); }
}

export class Synth {
  constructor() {
    this.values = defaultValues();
    this.ctx = null;
    this.listeners = new Set(); // called with (id, value) on every param change
    this.paramTimers = new Set();
  }

  get running() { return this.ctx?.state === 'running'; }

  // Build the audio graph without sound: browsers keep a context made before the first tap
  // suspended, but it can load and compile the worklets, which is the slow part on phones.
  // Called while the page loads, so the first Play only has to resume.
  prepare() {
    this.ready ??= this.build();
    return this.ready;
  }

  async start() {
    this.started = true;
    const pending = this.prepare();
    const resumed = this.ctx.resume(); // inside the tap that started it, before any await
    await pending;
    await resumed;
  }

  async build() {
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
    this.layer = new Layer(ctx, chain.limiter);
    this.layer.setLevel(this.layerLevel ?? 0.6);
    this.layer.setValues(this.layerValues ?? defaultValues());

    this.setParams(this.values);
    for (const msg of this.pending ?? []) this.node.port.postMessage(msg);
    this.pending = null;
    // Some browsers let a context run without a tap; keep it idle until something asks for sound.
    if (!this.started) await ctx.suspend();
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
  allNotesOff() { this.send({ type: 'allOff' }); this.layer?.send({ type: 'allOff' }); }

  // Layer 2 (see Layer). Settings made before audio starts are applied when it does.
  setLayerSound(values) { this.layerValues = values; this.layer?.setValues(values); }
  setLayerLevel(level) { this.layerLevel = level; this.layer?.setLevel(level); }
  layerNoteOn(note, time) { this.layer?.send({ type: 'noteOn', note, velocity: 1, time }); }
  layerNoteOff(note, time) { this.layer?.send({ type: 'noteOff', note, time }); }
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
    this.layer?.send({ type: 'clearScheduled' });
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
  //   layers:   [{ values, level, notes }] extra voices (layer 2)
  //   duration: seconds (include a tail for releases and reverb)
  async renderOffline({ values, notes = [], params = [], roar = null, layers = [], duration, sampleRate = 44100, onProgress }) {
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
    for (const layer of layers) {
      const { engine, fx } = splitValues({ ...defaultValues(), ...layer.values });
      const voice = buildVoice(ctx, { values: engine, events: [...layer.notes].sort((a, b) => a.time - b.time) });
      voice.master.connect(chain.limiter);
      for (const [id, v] of Object.entries(fx)) routeFx(voice, ctx, id, v, 0, layer.level);
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
