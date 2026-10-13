// Main-thread synth: owns the AudioContext, the voice engine (AudioWorklet),
// the effects chain and an analyser for the oscilloscope.
//
// Every input source -- computer keyboard, on-screen keyboard, and later data
// time series -- drives the synth through the same three calls:
//   synth.noteOn(note), synth.noteOff(note), synth.setParam(id, value)

import { defaultValues, isFxParam } from './params.js';
import { ModFX, DelayFX, ReverbFX } from './fx.js';

export class Synth {
  constructor() {
    this.values = defaultValues();
    this.ctx = null;
    this.listeners = new Set(); // called with (id, value) on every param change
  }

  get running() { return this.ctx?.state === 'running'; }

  async start() {
    if (this.ctx) { await this.ctx.resume(); return; }
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;
    await ctx.audioWorklet.addModule(new URL('./worklet/synth-processor.js', import.meta.url));
    this.node = new AudioWorkletNode(ctx, 'synth-processor', {
      numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
    });

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 4096;
    this.fx = { mod: new ModFX(ctx), delay: new DelayFX(ctx), reverb: new ReverbFX(ctx) };
    this.master = ctx.createGain();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.1;

    this.node.connect(this.analyser);
    this.node.connect(this.fx.mod.input);
    this.fx.mod.output.connect(this.fx.delay.input);
    this.fx.delay.output.connect(this.fx.reverb.input);
    this.fx.reverb.output.connect(this.master).connect(limiter).connect(ctx.destination);

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
    if (!isFxParam(id)) {
      this.node.port.postMessage({ type: 'param', id, value });
      return;
    }
    const [unit, key] = id.split('.');
    if (unit === 'master') this.master.gain.setTargetAtTime(value, this.ctx.currentTime, 0.02);
    else this.fx[unit].set(key, value);
  }

  // `time` (optional, AudioContext seconds) schedules the event sample-accurately.
  noteOn(note, velocity = 1, time) { this.send({ type: 'noteOn', note, velocity, time }); }
  noteOff(note, time) { this.send({ type: 'noteOff', note, time }); }
  allNotesOff() { this.send({ type: 'allOff' }); }
  // Drop notes that were scheduled for the future but haven't played yet.
  clearScheduled() { this.send({ type: 'clearScheduled' }); }

  // Notes played while audio is still starting up are queued, not dropped.
  send(msg) {
    if (this.node) this.node.port.postMessage(msg);
    else (this.pending ??= []).push(msg);
  }
}
