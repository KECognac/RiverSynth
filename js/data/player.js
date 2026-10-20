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
  'Mixolydian': [0, 2, 4, 5, 7, 9, 10],     // old-time / Appalachian (major with a flat 7th)
  'Harmonic minor': [0, 2, 3, 5, 7, 8, 11], // Spanish / Mexican, spaghetti-western tension
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
    this.raw = [];         // the daily series as loaded
    this.rows = [];        // what plays: the daily series, or one row per group of days
    this.settings = {
      scale: 'Major pentatonic', root: 0, low: 48, high: 84, log: true,
      bpm: 120, rate: '1/16', gate: 0.6, tie: false, loop: false,
      spread: 'even',      // 'even': every scale note used about equally; 'proportional': follows the flow;
                           // 'fixed': a set cfs range (fixedLow..fixedHigh), so different rivers or years compare fairly
      fixedLow: 2000, fixedHigh: 130000,
      restBelow: 0,        // cfs: days below this play silence (a river that has nearly stopped); 0 = off
      daysPerStep: 1,      // play several days as one step (e.g. 7 = a week), for many years of data
      combine: 'mean',     // how those days become one value: 'mean' (average) or 'max' (peak)
      voicing: 'single',   // 'single' note per step, or a 'triad' built from the scale
      roar: false, roarLevel: 0.6,
    };
    this.history = null;   // long daily record for the same gauge, for "normal" flows
    // Layer 2: a second sound playing the same river, shifted and paced on its own.
    this.layer = { on: false, octave: 0, every: 4, voicing: 'single' };
    this.position = 0;     // step to start from
    this.playing = false;
    this.timeline = [];    // [{ time, step }] of scheduled steps, for the playhead
    this.listeners = new Set(); // called with ({ playing }) when play state changes
    this.routes = [];      // [{ id, source, from, to }]: knob position (0..1) at the source's low and high end
    this.base = {};        // routed params' values before playback, restored on stop
  }

  setSeries(rows) {
    this.stop();
    this.raw = rows;
    this.rows = this.group(rows);
    this.position = 0;
    this.invalidate();
  }

  // Several days per step: each group keeps its first date and the average or peak flow.
  group(rows) {
    const n = Math.max(1, Math.round(this.settings.daysPerStep));
    if (n === 1) return rows;
    const out = [];
    for (let i = 0; i < rows.length; i += n) {
      const vals = rows.slice(i, i + n).map((r) => r.value).filter((v) => v != null);
      const value = !vals.length ? null
        : this.settings.combine === 'max' ? Math.max(...vals) : vals.reduce((a, b) => a + b, 0) / vals.length;
      out.push({ date: rows[i].date, value });
    }
    return out;
  }

  setHistory(history) {
    this.history = history;
    this.invalidate();
  }

  set(key, value) {
    this.settings[key] = value;
    if ((key === 'daysPerStep' || key === 'combine') && this.raw.length) {
      this.stop();
      this.rows = this.group(this.raw);
      this.position = 0;
    }
    this.invalidate();
    if (this.playing && (key === 'roar' || key === 'roarLevel')) this.updateRoar();
  }

  invalidate() { this._notes = null; this._norms = null; this._sources = null; this._ext = null; }

  // Derived 0..1 signals: flow, change, anomaly, trend, turbulence (see features.js).
  get sources() {
    if (!this._sources) {
      this._sources = computeSources(this.rows, { log: this.settings.log, history: this.history });
      // Fixed scale: flow is measured against a set range instead of this series' own low and
      // high, so a flat, regulated river stays on a few notes (and routes and roar barely move).
      if (this.settings.spread === 'fixed') {
        const [lo, hi] = this.fixedRange();
        const tr = this.flowTransform();
        this._sources.flow = this.rows.map((r) => (r.value == null ? null
          : Math.min(1, Math.max(0, (tr(r.value) - lo) / (hi - lo)))));
      }
      // Surge: follows the flow up at once, then drains slowly (about 10% a step), so a flood
      // only a few steps long swells and lingers instead of flashing past.
      let level = 0;
      this._sources.surge = this._sources.flow.map((v) => {
        level = Math.max(v ?? 0, level * 0.9);
        return v == null ? null : level;
      });
    }
    return this._sources;
  }

  flowTransform() { return this.settings.log ? (x) => Math.log10(Math.max(x, 0.01)) : (x) => x; }
  fixedRange() {
    const tr = this.flowTransform();
    return [tr(this.settings.fixedLow), tr(this.settings.fixedHigh)];
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
    this._norms ??= this.settings.spread === 'even' ? evenSpread(this.sources.flow) : this.sources.flow; // proportional or fixed
    return this._norms;
  }

  // One MIDI note (or null for a missing value) per data point.
  get notes() {
    if (this._notes) return this._notes;
    const allowed = this.allowedNotes();
    const rest = this.settings.restBelow;
    this._notes = this.norms.map((t, i) => (t == null || !allowed.length || (rest > 0 && this.rows[i].value < rest)
      ? null : allowed[Math.round(t * (allowed.length - 1))]));
    return this._notes;
  }

  // The notes to play at step i: the note itself, or a triad stacked in thirds from the
  // scale (which may reach above High). Empty for missing data.
  chordAt(i, voicing = this.settings.voicing) {
    const root = this.notes[i];
    if (root == null) return [];
    if (voicing !== 'triad') return [root];
    this._ext ??= this.allowedNotes(24);
    const k = this._ext.indexOf(root);
    return [this._ext[k], this._ext[k + 2], this._ext[k + 4]].filter((n) => n != null);
  }

  setLayer(key, value) { this.layer[key] = value; }

  // Layer 2 plays every Nth day, shifted by its octave, held for its whole span.
  scheduleLayer(i, t) {
    const { on, every, octave, voicing } = this.layer;
    if (!on || i % every !== 0) return;
    const chord = this.chordAt(i, voicing).map((n) => n + octave).filter((n) => n >= 0 && n <= 127);
    const end = t + this.stepDur * every * 0.95;
    for (const n of chord) {
      this.synth.layerNoteOn(n, t);
      this.synth.layerNoteOff(n, end);
    }
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
    this.scheduleLayer(i, t);
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
    const ev = { notes: [], params: [], roar: [], steps: [], layerNotes: [] };
    const real = this.synth, savedSounding = this.sounding;
    this.synth = {
      noteOn: (note, velocity, time) => ev.notes.push({ type: 'noteOn', note, velocity, time }),
      noteOff: (note, time) => ev.notes.push({ type: 'noteOff', note, time }),
      setParamAt: (id, value, time) => ev.params.push({ id, value, time }),
      roar: { setFlow: (t, time, smooth) => ev.roar.push({ t, time, smooth }) },
      layerNoteOn: (note, time) => ev.layerNotes.push({ type: 'noteOn', note, velocity: 1, time }),
      layerNoteOff: (note, time) => ev.layerNotes.push({ type: 'noteOff', note, time }),
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
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const GUTTER = 40; // CSS px on the left for the cfs scale
const FOOT = 15;   // CSS px along the bottom for month or year labels

// "850", "1.2k", "12k", "1.5M"
function cfsLabel(v) {
  if (v >= 1e6) return `${+(v / 1e6).toFixed(1)}M`;
  if (v >= 1e4) return `${Math.round(v / 1e3)}k`;
  if (v >= 1e3) return `${+(v / 1e3).toFixed(1)}k`;
  if (v >= 1) return String(Math.round(v));
  return String(+v.toFixed(2));
}

// A few round cfs values inside [lo, hi] (in chart units: log10 cfs, or cfs).
function cfsTicks(lo, hi, log) {
  if (!(hi > lo)) return [];
  if (log) {
    const vals = [];
    for (const mults of [[1], [1, 3], [1, 2, 5]]) {
      vals.length = 0;
      for (let e = Math.floor(lo) - 1; e <= Math.ceil(hi); e++) {
        for (const m of mults) { const v = Math.log10(m) + e; if (v >= lo - 1e-9 && v <= hi + 1e-9) vals.push(v); }
      }
      if (vals.length >= 2) break;
    }
    while (vals.length > 4) vals.splice(0, vals.length, ...vals.filter((_, i) => i % 2 === 0));
    return vals.map((v) => ({ v, label: cfsLabel(10 ** v) }));
  }
  const raw = (hi - lo) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((x) => x >= raw);
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push({ v, label: cfsLabel(v) });
  return out;
}

export class DataChart {
  constructor(canvas, player, onSeek) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.player = player;
    this.layer = document.createElement('canvas'); // the static picture, redrawn only when it changes
    this.layerKey = null;
    document.fonts?.ready.then(() => { this.layerKey = null; }); // redraw labels in Geist Mono once it loads
    canvas.addEventListener('pointerdown', (e) => {
      const n = player.rows.length;
      if (!n) return;
      const r = canvas.getBoundingClientRect();
      const f = (e.clientX - r.left - GUTTER) / (r.width - GUTTER);
      onSeek(Math.round(Math.min(1, Math.max(0, f)) * (n - 1)));
    });
    requestAnimationFrame(() => this.draw());
  }

  // Plot geometry in device pixels for the current size and data.
  geometry(w, h, dpr) {
    const { player } = this;
    const rows = player.rows;
    const log = player.settings.log;
    const tr = (x) => (log ? Math.log10(Math.max(x, 0.01)) : x);
    const vals = rows.map((r) => (r.value == null ? null : tr(r.value)));
    const present = vals.filter((v) => v != null);
    // With a fixed scale the chart uses the same range too, so a flat river looks flat.
    const [lo, hi] = player.settings.spread === 'fixed' ? player.fixedRange()
      : present.length ? [Math.min(...present), Math.max(...present)] : [0, 1];
    const left = GUTTER * dpr, top = 8 * dpr, bottom = h - FOOT * dpr;
    const x = (i) => left + (rows.length === 1 ? 0.5 : i / (rows.length - 1)) * (w - left);
    const y = (v) => bottom - (Math.min(1, Math.max(0, hi > lo ? (v - lo) / (hi - lo) : 0.5)) * (bottom - top));
    return { rows, log, tr, vals, lo, hi, left, top, bottom, x, y };
  }

  drawLayer(w, h, dpr, geo) {
    const { layer, player } = this;
    layer.width = w; layer.height = h;
    const g = layer.getContext('2d');
    const { rows, log, tr, vals, lo, hi, left, top, bottom, x, y } = geo;
    g.fillStyle = '#0b0e10';
    g.fillRect(0, 0, w, h);
    const font = (px) => `${px * dpr}px "Geist Mono", ui-monospace, monospace`;

    // cfs scale: faint lines across, labels in the left gutter
    g.font = font(10);
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    for (const t of cfsTicks(lo, hi, log)) {
      const yy = Math.round(y(t.v)) + 0.5;
      g.fillStyle = 'rgba(169, 198, 236, 0.08)';
      g.fillRect(left, yy, w - left, dpr);
      g.fillStyle = 'rgba(169, 198, 236, 0.55)';
      g.fillText(t.label, left - 6 * dpr, Math.min(bottom - 5 * dpr, Math.max(top + 5 * dpr, yy)));
    }
    g.textAlign = 'left';
    g.fillStyle = 'rgba(169, 198, 236, 0.4)';
    g.fillText('cfs', 6 * dpr, bottom + 8 * dpr);

    // Month marks (or years, for longer spans) along the bottom
    if (rows.length > 1) {
      const span = (new Date(rows[rows.length - 1].date) - new Date(rows[0].date)) / 864e5;
      const byYear = span > 900;
      const multiYear = rows[0].date.slice(0, 4) !== rows[rows.length - 1].date.slice(0, 4);
      const monthW = (w - left) / Math.max(1, span / 30.4);
      g.textBaseline = 'middle';
      for (let i = 1; i < rows.length; i++) {
        const a = rows[i - 1].date, b = rows[i].date;
        if (a.slice(0, 7) === b.slice(0, 7)) continue;
        const m = Number(b.slice(5, 7)) - 1;
        const newYear = a.slice(0, 4) !== b.slice(0, 4);
        if (byYear && !newYear) {
          g.fillStyle = 'rgba(169, 198, 236, 0.18)';
          g.fillRect(Math.round(x(i)), bottom, dpr, 3 * dpr);
          continue;
        }
        const xx = Math.round(x(i));
        g.fillStyle = newYear ? 'rgba(169, 198, 236, 0.16)' : 'rgba(169, 198, 236, 0.07)';
        g.fillRect(xx, top, dpr, bottom - top + 3 * dpr);
        const label = byYear || (newYear && multiYear) ? b.slice(0, 4)
          : monthW < 34 * dpr ? MONTHS[m][0] : MONTHS[m];
        g.fillStyle = newYear && multiYear ? 'rgba(169, 198, 236, 0.75)' : 'rgba(169, 198, 236, 0.5)';
        g.fillText(label, xx + 3 * dpr, bottom + 8 * dpr);
      }
    }

    // Filled area under the hydrograph, fading toward the bottom
    g.save();
    g.beginPath();
    g.rect(left, 0, w - left, h);
    g.clip();
    g.beginPath();
    let started = false;
    let lastX = left;
    vals.forEach((v, i) => {
      if (v == null) return;
      if (!started) { g.moveTo(x(i), bottom); g.lineTo(x(i), y(v)); started = true; } else g.lineTo(x(i), y(v));
      lastX = x(i);
    });
    g.lineTo(lastX, bottom);
    g.closePath();
    const grad = g.createLinearGradient(0, top, 0, bottom);
    grad.addColorStop(0, 'rgba(240, 182, 47, 0.38)');
    grad.addColorStop(1, 'rgba(240, 182, 47, 0.03)');
    g.fillStyle = grad;
    g.fill();

    g.beginPath();
    started = false;
    vals.forEach((v, i) => {
      if (v == null) { started = false; return; }
      if (!started) { g.moveTo(x(i), y(v)); started = true; } else g.lineTo(x(i), y(v));
    });
    g.strokeStyle = '#f0b62f';
    g.lineWidth = 1.5 * dpr;
    g.lineJoin = 'round';
    g.stroke();

    // Dashed line: the normal (median) flow for each date, when history is available
    const src = player.sources;
    if (src.anomalyAvailable) {
      g.beginPath();
      started = false;
      src.normal.forEach((nv, i) => {
        if (nv == null) { started = false; return; }
        const yy = Math.min(bottom, Math.max(top, y(tr(nv))));
        if (!started) { g.moveTo(x(i), yy); started = true; } else g.lineTo(x(i), yy);
      });
      g.setLineDash([4 * dpr, 4 * dpr]);
      g.strokeStyle = 'rgba(169, 198, 236, 0.75)';
      g.lineWidth = 1 * dpr;
      g.stroke();
      g.setLineDash([]);
    }
    g.restore();
  }

  draw() {
    requestAnimationFrame(() => this.draw());
    const { canvas, g, player } = this;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const rows = player.rows;
    if (!rows.length) {
      g.fillStyle = '#0b0e10';
      g.fillRect(0, 0, w, h);
      return;
    }

    // The sources object is rebuilt whenever the data or a setting that shapes it changes,
    // so it (with the rows and size) tells us when to redraw the static picture.
    const src = player.sources;
    if (!this.geo || this.layerKey?.rows !== rows || this.layerKey.src !== src || this.layerKey.w !== w || this.layerKey.h !== h) {
      this.geo = this.geometry(w, h, dpr);
      this.drawLayer(w, h, dpr, this.geo);
      this.layerKey = { rows, src, w, h };
    }
    g.drawImage(this.layer, 0, 0);

    // Playhead, with a soft glow
    const { x, y, vals } = this.geo;
    const step = player.playing ? player.currentStep() : player.position;
    if (step != null) {
      g.save();
      g.shadowColor = 'rgba(240, 182, 47, 0.9)';
      g.shadowBlur = 8 * dpr;
      g.fillStyle = 'rgba(246, 231, 182, 0.9)';
      g.fillRect(x(step) - dpr / 2, 0, dpr * 1.5, h - FOOT * dpr);
      if (vals[step] != null) {
        g.beginPath();
        g.arc(x(step), y(vals[step]), 3.5 * dpr, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }
    this.onFrame?.(step);
  }
}
