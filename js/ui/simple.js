// Simple view: a friendlier face on the Modulate step. Instrument cards pick a program and
// four sliders (Mood, Speed, Space, Texture) each move several real controls at once.
//
// The sliders nudge the current sound rather than replace it: in the middle they leave the
// preset exactly as it is, and each side moves its controls away from the preset's own
// values. A control that a Data → Sound route moves has the route's range shifted by the
// same amount, so the river keeps moving it around the slider's setting.
import { PARAMS, toValue, toNorm } from '../params.js';
import { resolvePreset } from '../presets.js';

// Abstract line glyphs, one per instrument: the shape of the sound rather than a picture.
const glyph = (body) => `<svg viewBox="0 0 32 24" width="32" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const INSTRUMENTS = [
  // a plucked string: a sharp attack ringing away
  { label: 'Guitar', program: 'Prairie Guitar', icon: glyph('<path d="M3 12 L6 3 L9 20 L12 6 L15 17 L18 9 L21 14 L24 11 L29 12"/>') },
  // a bow stroke: a long swell and fade
  { label: 'Cello', program: 'Bowed Cello', icon: glyph('<path d="M3 12 C9 2, 23 2, 29 12"/><path d="M3 12 C9 22, 23 22, 29 12"/>') },
  // breath: a soft wave with air drifting off it
  { label: 'Flute', program: 'Canyon Flute', icon: glyph('<path d="M3 14 C7 8, 11 8, 15 14 S23 20, 27 14"/><circle cx="25" cy="6" r="0.8"/><circle cx="29" cy="9" r="0.8"/><circle cx="21" cy="4" r="0.8"/>') },
  // metal bars, long to short
  { label: 'Glockenspiel', program: 'Glockenspiel', icon: glyph('<path d="M5 4 V20 M10 5.5 V18.5 M15 7 V17 M20 8.5 V15.5 M25 10 V14"/><circle cx="28.5" cy="5" r="1.4"/>') },
  // steps of notes
  { label: 'Keys', program: 'Lo-Fi Keys', icon: glyph('<path d="M4 20 V15 H10 V11 H16 V7 H22 V11 H28"/>') },
  // layered waves blurring into each other
  { label: 'Dreamy pad', program: 'River Pad', icon: glyph('<path d="M2 9 C8 5, 12 13, 18 9 S28 5, 30 9" opacity="0.45"/><path d="M2 13 C8 9, 12 17, 18 13 S28 9, 30 13"/><path d="M2 17 C8 13, 12 21, 18 17 S28 13, 30 17" opacity="0.45"/>') },
];

const SLIDERS = [
  { id: 'mood', label: 'Mood', low: 'wistful', high: 'bright' },
  { id: 'speed', label: 'Speed', low: 'drifting', high: 'rushing' },
  { id: 'space', label: 'Space', low: 'close room', high: 'canyon' },
  { id: 'texture', label: 'Texture', low: 'clean', high: 'old tape' },
];

// Mood picks a scale once it leaves the middle: darker to the left, brighter to the right.
const DARKER = ['Dorian', 'Minor pentatonic', 'Natural minor'];
const BRIGHTER = ['Mixolydian', 'Major', 'Major pentatonic'];
// The "playing style" of a preset (Arp or Chord mode and its pattern) stays when you
// change instrument, so Poudre Pickin' still picks on the cello.
const STYLE_KEYS = ['voice.mode', 'voice.depth', 'voice.glide', 'arp.latch', 'arp.rate', 'arp.gate', 'arp.tempo'];

const clamp01 = (x) => Math.min(1, Math.max(0, x));

export class SimpleView {
  // host: { synth, player, factory, getRoutes, setRoutes, setSetting, getProgramName, onProgram, onChange }
  constructor(root, host) {
    this.host = host;
    this.pos = { mood: 50, speed: 50, space: 50, texture: 50 };
    this.origin = null; // the sound as the preset left it (Reset goes back here)
    this.base = null;   // the same, with the chosen instrument

    root.innerHTML = `
      <div class="simple-label">Instrument</div>
      <div class="simple-cards" role="group" aria-label="Instrument"></div>
      <div class="simple-sliders"></div>
      <div class="simple-actions">
        <button type="button" class="simple-surprise">🎲 Surprise me</button>
        <button type="button" class="simple-reset">Reset to preset</button>
      </div>`;
    const cards = root.querySelector('.simple-cards');
    this.cards = INSTRUMENTS.map((inst) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'simple-card';
      b.setAttribute('aria-pressed', 'false');
      b.innerHTML = `<span class="simple-icon" aria-hidden="true">${inst.icon}</span><span>${inst.label}</span>`;
      b.addEventListener('click', () => this.pickInstrument(inst.program));
      cards.append(b);
      return b;
    });
    const sliders = root.querySelector('.simple-sliders');
    this.inputs = {};
    this.outs = {};
    for (const s of SLIDERS) {
      const row = document.createElement('label');
      row.className = 'simple-slider';
      row.innerHTML = `
        <span class="simple-name">${s.label}<output></output></span>
        <input type="range" min="0" max="100" step="1" value="50">
        <span class="simple-ends"><span>${s.low}</span><span>${s.high}</span></span>`;
      const input = row.querySelector('input');
      input.addEventListener('input', () => { this.pos[s.id] = Number(input.value); this.apply(); });
      input.addEventListener('dblclick', () => { input.value = 50; this.pos[s.id] = 50; this.apply(); });
      this.inputs[s.id] = input;
      this.outs[s.id] = row.querySelector('output');
      sliders.append(row);
    }
    root.querySelector('.simple-surprise').addEventListener('click', () => this.surprise());
    root.querySelector('.simple-reset').addEventListener('click', () => this.reset());
  }

  // What the synth is set to without the river's live changes.
  current() {
    const { synth, player } = this.host;
    return {
      values: { ...synth.values, ...(player.playing ? player.base : {}) },
      routes: this.host.getRoutes().map((r) => ({ ...r })),
      scale: player.settings.scale,
      bpm: player.settings.bpm,
      program: this.host.getProgramName(),
    };
  }

  // A new preset or program was loaded: it becomes the middle of every slider.
  capture() {
    for (const k of Object.keys(this.pos)) { this.pos[k] = 50; this.inputs[k].value = 50; }
    this.origin = this.current();
    this.base = this.origin;
    this.showState();
    this.mark = this.fingerprint();
  }

  // Remember the sound when leaving for Advanced; on return, start over from whatever
  // Advanced left only if something there changed.
  leave() { this.mark = this.fingerprint(); }
  enter() { if (this.fingerprint() !== this.mark) this.capture(); }
  fingerprint() {
    const c = this.current();
    return JSON.stringify([c.values, c.routes, c.scale, c.bpm]);
  }

  pickInstrument(name) {
    const prog = this.host.factory.find((p) => p.name === name);
    if (!prog) return;
    const style = Object.fromEntries(STYLE_KEYS.map((k) => [k, this.base.values[k]]));
    this.base = { ...this.base, values: resolvePreset({ ...prog.values, ...style }), program: name };
    this.host.onProgram(name);
    this.apply();
  }

  reset() {
    for (const k of Object.keys(this.pos)) { this.pos[k] = 50; this.inputs[k].value = 50; }
    this.base = this.origin;
    this.host.onProgram(this.base.program);
    this.apply();
  }

  surprise() {
    const inst = INSTRUMENTS[Math.floor(Math.random() * INSTRUMENTS.length)];
    for (const k of Object.keys(this.pos)) {
      this.pos[k] = Math.round(15 + Math.random() * 70);
      this.inputs[k].value = this.pos[k];
    }
    this.pickInstrument(inst.program);
  }

  // Work out every control from the base sound and the four sliders, then send the changes.
  apply() {
    const b = this.base;
    if (!b) return;
    const out = { ...b.values };
    const routes = b.routes.map((r) => ({ ...r }));
    const shift = (id, d) => {
      const p = PARAMS[id];
      out[id] = toValue(p, toNorm(p, out[id]) + d);
      for (const r of routes) if (r.id === id) { r.from = clamp01(r.from + d); r.to = clamp01(r.to + d); }
    };
    const m = (this.pos.mood - 50) / 50, s = (this.pos.speed - 50) / 50;
    const sp = (this.pos.space - 50) / 50, t = (this.pos.texture - 50) / 50;

    // Mood: a darker or brighter scale, and a slightly darker or brighter tone.
    let scale = b.scale;
    if (Math.abs(m) >= 0.15) {
      const list = m < 0 ? DARKER : BRIGHTER;
      scale = list[Math.min(2, Math.floor(((Math.abs(m) - 0.15) / 0.85) * 3))];
    }
    shift('filter.cutoff', 0.08 * m);

    // Speed: half to double the tempo (and the arpeggiator with it).
    const f = Math.pow(2, s);
    const bpm = Math.min(400, Math.max(20, Math.round(b.bpm * f)));
    out['arp.tempo'] = Math.min(300, Math.max(40, b.values['arp.tempo'] * f));

    // Space: reverb from a close room to a big hall, plus a canyon echo near the top.
    if (sp > 0 && !out['reverb.on']) { out['reverb.on'] = 1; out['reverb.mix'] = 0; }
    shift('reverb.mix', (sp > 0 ? 0.35 : 0.25) * sp);
    shift('reverb.time', 0.3 * sp);
    if (out['delay.on']) shift('delay.mix', 0.2 * sp);
    else if (sp > 0.4) {
      Object.assign(out, { 'delay.on': 1, 'delay.type': 1, 'delay.time': 0.42, 'delay.depth': 0.35, 'delay.mix': 0 });
      shift('delay.mix', 0.25 * ((sp - 0.4) / 0.6));
    }

    // Texture: clean, or warbling tape with chorus, and a little bit-crush grit at the top.
    if (t > 0 && !out['tape.on']) Object.assign(out, { 'tape.on': 1, 'tape.wow': 0, 'tape.flutter': 0, 'tape.mix': 1 });
    if (out['tape.on']) { shift('tape.wow', 0.45 * t); shift('tape.flutter', 0.35 * t); }
    if (out['mod.on']) shift('mod.mix', (t > 0 ? 0.15 : 0.3) * t);
    if (out['crush.on']) shift('crush.mix', (t > 0 ? 0.3 : 0.8) * t);
    else if (t > 0.5) {
      Object.assign(out, { 'crush.on': 1, 'crush.bits': 10, 'crush.rate': 2, 'crush.mix': 0 });
      shift('crush.mix', 0.4 * ((t - 0.5) / 0.5));
    }

    // Send only what changed. A routed control's resting value lives in player.base while
    // the river plays.
    const { synth, player } = this.host;
    for (const [id, v] of Object.entries(out)) {
      const routed = player.playing && id in player.base;
      const cur = routed ? player.base[id] : synth.values[id];
      if (cur === v) continue;
      if (routed) player.base[id] = v; else synth.setParam(id, v);
    }
    this.host.setRoutes(routes);
    if (scale !== player.settings.scale) this.host.setSetting('scale', scale);
    if (bpm !== player.settings.bpm) this.host.setSetting('bpm', bpm);
    this.showState(scale, bpm);
    this.host.onChange?.();
  }

  showState(scale = this.host.player.settings.scale, bpm = this.host.player.settings.bpm) {
    const prog = this.base?.program;
    INSTRUMENTS.forEach((inst, i) => this.cards[i].setAttribute('aria-pressed', String(inst.program === prog)));
    this.outs.mood.textContent = scale;
    this.outs.speed.textContent = `${bpm} BPM`;
    this.outs.space.textContent = '';
    this.outs.texture.textContent = '';
  }
}
