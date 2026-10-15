// Data player: turns a daily time series into notes and plays them through the synth.
//
// Each data point is one step. Its value is rescaled to 0..1 over the whole series
// (log or linear), then mapped onto the notes of a scale between a low and high note.
// Notes are scheduled slightly ahead with exact AudioContext times, so timing stays
// steady even if the page is busy.
//
// "Routes" let the same 0..1 value move other controls too (e.g. brighter filter and more
// reverb at high flow). Routed knobs are restored when playback stops.

import { PARAMS, toValue } from '../params.js';
import { computeSources, evenSpread } from './features.js';

export const SCALES = {
  'Major pentatonic': [0, 2, 4, 7, 9],
  'Minor pentatonic': [0, 3, 5, 7, 10],
  'Major': [0, 2, 4, 5, 7, 9, 11],
  'Natural minor': [0, 2, 3, 5, 7, 8, 10],
  'Dorian': [0, 2, 3, 5, 7, 9, 10],
  'Whole tone': [0, 2, 4, 6, 8, 10],
  'Chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

export const RATES = { '1/4': 1, '1/8': 2, '1/16': 4, '1/32': 8 }; // steps per beat

const LOOKAHEAD = 0.15; // seconds of notes scheduled in advance
const TICK_MS = 25;

export class DataPlayer {
  constructor(synth, ensureAudio) {
    this.synth = synth;
    this.ensureAudio = ensureAudio;
    this.rows = [];
    this.settings = {
      scale: 'Major pentatonic', root: 0, low: 48, high: 84, log: true,
      bpm: 120, rate: '1/16', gate: 0.6, tie: false, loop: false,
      spread: 'even',      // 'even': every scale note used about equally; 'proportional': follows the flow
      voicing: 'single',   // 'single' note per step, or a 'triad' built from the scale
      roar: false, roarLevel: 0.6,
    };
    this.history = null;   // long daily record for the same gauge, for "normal" flows
    this.position = 0;     // step to start from
    this.playing = false;
    this.timeline = [];    // [{ time, step }] of scheduled steps, for the playhead
    this.listeners = new Set(); // called with ({ playing }) when play state changes
    this.routes = [];      // [{ id, source, from, to }]: knob position (0..1) at the source's low and high end
    this.base = {};        // routed params' values before playback, restored on stop
  }

  setSeries(rows) {
    this.stop();
    this.rows = rows;
    this.position = 0;
    this.invalidate();
  }

  setHistory(history) {
    this.history = history;
    this.invalidate();
  }

  set(key, value) {
    this.settings[key] = value;
    this.invalidate();
    if (this.playing && (key === 'roar' || key === 'roarLevel')) this.updateRoar();
  }

  invalidate() { this._notes = null; this._norms = null; this._sources = null; this._ext = null; }

  // Derived 0..1 signals: flow, change, anomaly, trend, turbulence (see features.js).
  get sources() {
    this._sources ??= computeSources(this.rows, { log: this.settings.log, history: this.history });
    return this._sources;
  }

  updateRoar() {
    const roar = this.synth.roar;
    if (!roar) return;
    roar.setLevel(this.settings.roarLevel);
    if (!this.settings.roar) roar.silence();
  }

  get stepDur() { return 60 / this.settings.bpm / RATES[this.settings.rate]; }

  // Notes allowed by the scale, root and range (optionally extended above High).
  allowedNotes(extra = 0) {
    const { scale, root, low, high } = this.settings;
    const degrees = SCALES[scale];
    const out = [];
    for (let n = Math.min(low, high); n <= Math.max(low, high) + extra; n++) {
      if (degrees.includes((((n - root) % 12) + 12) % 12)) out.push(n);
    }
    return out;
  }

  // The 0..1 value that picks each step's note. "Even" ranks the values so every scale
  // note gets used about equally; "proportional" follows the flow's actual size.
  get norms() {
    this._norms ??= this.settings.spread === 'even' ? evenSpread(this.sources.flow) : this.sources.flow;
    return this._norms;
  }

  // One MIDI note (or null for a missing value) per data point.
  get notes() {
    if (this._notes) return this._notes;
    const allowed = this.allowedNotes();
    this._notes = this.norms.map((t) => (t == null || !allowed.length ? null : allowed[Math.round(t * (allowed.length - 1))]));
    return this._notes;
  }

  // The notes to play at step i: the note itself, or a triad stacked in thirds from the
  // scale (which may reach above High). Empty for missing data.
  chordAt(i) {
    const root = this.notes[i];
    if (root == null) return [];
    if (this.settings.voicing !== 'triad') return [root];
    this._ext ??= this.allowedNotes(24);
    const k = this._ext.indexOf(root);
    return [this._ext[k], this._ext[k + 2], this._ext[k + 4]].filter((n) => n != null);
  }

  routeValue(route, t) {
    return toValue(PARAMS[route.id], route.from + t * (route.to - route.from));
  }

  // Replace the routes. While playing, a param that is no longer routed goes back to its
  // pre-playback value, and a newly routed one has its current value remembered.
  setRoutes(routes) {
    if (this.playing) {
      const ids = new Set(routes.map((r) => r.id));
      for (const id of Object.keys(this.base)) {
        if (!ids.has(id)) { this.synth.setParam(id, this.base[id]); delete this.base[id]; }
      }
      for (const id of ids) if (!(id in this.base)) this.base[id] = this.synth.values[id];
    }
    this.routes = routes;
  }

  // After a preset loads mid-playback, remember its values as the ones to restore.
  rebase() {
    if (!this.playing) return;
    for (const id of Object.keys(this.base)) this.base[id] = this.synth.values[id];
  }

  async play() {
    if (this.playing || !this.rows.length) return;
    await this.ensureAudio();
    const ctx = this.synth.ctx;
    if (!ctx) return;
    this.playing = true;
    this.sounding = null;
    this.base = {};
    for (const r of this.routes) this.base[r.id] = this.synth.values[r.id];
    this.updateRoar();
    this.nextStep = this.position;
    this.nextTime = ctx.currentTime + 0.05;
    this.timeline = [];
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
    this.emit();
  }

  stop() {
    if (!this.playing) return;
    clearInterval(this.timer);
    this.position = this.currentStep() ?? this.position;
    this.playing = false;
    this.synth.clearScheduled();
    this.synth.allNotesOff();
    this.sounding = null;
    this.synth.setParams(this.base);
    this.base = {};
    this.synth.roar?.silence();
    this.emit();
  }

  seek(step) {
    step = Math.max(0, Math.min(this.rows.length - 1, step));
    if (!this.playing) { this.position = step; return; }
    this.synth.clearScheduled();
    this.synth.allNotesOff();
    this.sounding = null;
    this.nextStep = step;
    this.nextTime = this.synth.ctx.currentTime + 0.05;
    this.timeline = [];
  }

  tick() {
    const ctx = this.synth.ctx;
    const n = this.rows.length;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      if (this.nextStep >= n) {
        if (!this.settings.loop) {
          // Let the last note finish, then stop and rewind.
          if (ctx.currentTime >= this.nextTime) { this.stop(); this.position = 0; }
          return;
        }
        this.nextStep = 0;
      }
      this.scheduleStep(this.nextStep, this.nextTime);
      this.timeline.push({ time: this.nextTime, step: this.nextStep });
      if (this.timeline.length > 64) this.timeline.shift();
      this.nextStep++;
      this.nextTime += this.stepDur;
    }
  }

  scheduleStep(i, t) {
    const { tie, gate } = this.settings;
    const chord = this.chordAt(i);
    const next = this.chordAt(i + 1);
    const same = (a, b) => a.length === b.length && a.every((n, j) => n === b[j]);
    const src = this.sources;
    for (const r of this.routes) {
      const v = src[r.source ?? 'flow'][i];
      if (v != null) this.synth.setParamAt(r.id, this.routeValue(r, v), t);
    }
    if (this.settings.roar && src.flow[i] != null) {
      // Smooth over a couple of steps so the roar swells rather than steps.
      this.synth.roar?.setFlow(src.flow[i], t, Math.max(0.05, this.stepDur * 2));
    }
    // Notes tied over from the previous step either continue or end here.
    if (this.sounding && !(tie && same(chord, this.sounding))) {
      for (const n of this.sounding) this.synth.noteOff(n, t);
      this.sounding = null;
    }
    if (!chord.length) return;
    if (!this.sounding) for (const n of chord) this.synth.noteOn(n, 1, t);
    if (tie && same(next, chord)) {
      this.sounding = chord; // hold into the next step
    } else {
      for (const n of chord) this.synth.noteOff(n, t + this.stepDur * gate);
      this.sounding = null;
    }
  }

  // The whole performance as a list of timed events (for WAV and MIDI export).
  // Runs the same step logic as live playback, capturing what it would send.
  collectEvents() {
    const ev = { notes: [], params: [], roar: [], steps: [] };
    const real = this.synth, savedSounding = this.sounding;
    this.synth = {
      noteOn: (note, velocity, time) => ev.notes.push({ type: 'noteOn', note, velocity, time }),
      noteOff: (note, time) => ev.notes.push({ type: 'noteOff', note, time }),
      setParamAt: (id, value, time) => ev.params.push({ id, value, time }),
      roar: { setFlow: (t, time, smooth) => ev.roar.push({ t, time, smooth }) },
    };
    this.sounding = null;
    try {
      const dur = this.stepDur;
      for (let i = 0; i < this.rows.length; i++) {
        this.scheduleStep(i, i * dur);
        ev.steps.push({ i, time: i * dur });
      }
      ev.duration = this.rows.length * dur;
    } finally {
      this.synth = real;
      this.sounding = savedSounding;
    }
    return ev;
  }

  // The step currently sounding (from the scheduled timeline), or null.
  currentStep() {
    if (!this.playing || !this.synth.ctx) return null;
    const now = this.synth.ctx.currentTime;
    let cur = null;
    for (const e of this.timeline) if (e.time <= now) cur = e.step;
    return cur ?? this.position;
  }

  emit() { for (const fn of this.listeners) fn({ playing: this.playing }); }
}

// --- Chart ---------------------------------------------------------------------
export class DataChart {
  constructor(canvas, player, onSeek) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.player = player;
    canvas.addEventListener('pointerdown', (e) => {
      const n = player.rows.length;
      if (!n) return;
      const r = canvas.getBoundingClientRect();
      onSeek(Math.round(((e.clientX - r.left) / r.width) * (n - 1)));
    });
    requestAnimationFrame(() => this.draw());
  }

  draw() {
    requestAnimationFrame(() => this.draw());
    const { canvas, g, player } = this;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    g.fillStyle = '#0b0e10';
    g.fillRect(0, 0, w, h);
    const rows = player.rows;
    if (!rows.length) return;

    const log = player.settings.log;
    const tr = (x) => (log ? Math.log10(Math.max(x, 0.01)) : x);
    const vals = rows.map((r) => (r.value == null ? null : tr(r.value)));
    const present = vals.filter((v) => v != null);
    const lo = Math.min(...present), hi = Math.max(...present);
    const pad = 8 * dpr;
    const x = (i) => (rows.length === 1 ? w / 2 : (i / (rows.length - 1)) * w);
    const y = (v) => h - pad - ((hi > lo ? (v - lo) / (hi - lo) : 0.5) * (h - 2 * pad));

    // Filled area under the hydrograph
    g.beginPath();
    let started = false;
    vals.forEach((v, i) => {
      if (v == null) return;
      if (!started) { g.moveTo(x(i), h); g.lineTo(x(i), y(v)); started = true; } else g.lineTo(x(i), y(v));
    });
    g.lineTo(w, h);
    g.closePath();
    g.fillStyle = 'rgba(240, 182, 47, 0.18)';
    g.fill();

    g.beginPath();
    started = false;
    vals.forEach((v, i) => {
      if (v == null) { started = false; return; }
      if (!started) { g.moveTo(x(i), y(v)); started = true; } else g.lineTo(x(i), y(v));
    });
    g.strokeStyle = '#f0b62f';
    g.lineWidth = 1.5 * dpr;
    g.stroke();

    // Dashed line: the normal (median) flow for each date, when history is available
    const src = player.sources;
    if (src.anomalyAvailable) {
      g.beginPath();
      started = false;
      src.normal.forEach((nv, i) => {
        if (nv == null) { started = false; return; }
        const yy = Math.min(h, Math.max(0, y(tr(nv))));
        if (!started) { g.moveTo(x(i), yy); started = true; } else g.lineTo(x(i), yy);
      });
      g.setLineDash([4 * dpr, 4 * dpr]);
      g.strokeStyle = 'rgba(169, 198, 236, 0.75)';
      g.lineWidth = 1 * dpr;
      g.stroke();
      g.setLineDash([]);
    }

    // Playhead
    const step = player.playing ? player.currentStep() : player.position;
    if (step != null) {
      g.fillStyle = 'rgba(246, 231, 182, 0.9)';
      g.fillRect(x(step) - dpr / 2, 0, dpr * 1.5, h);
      if (vals[step] != null) {
        g.beginPath();
        g.arc(x(step), y(vals[step]), 3.5 * dpr, 0, Math.PI * 2);
        g.fill();
      }
    }
    this.onFrame?.(step);
  }
}
