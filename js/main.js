import { PARAMS, SECTIONS, CHORDS, chordIndex, ARP_TYPES, arpIndex, formatValue, toValue, toNorm, defaultValues } from './params.js';
import { Synth } from './synth.js';
import { createControl } from './ui/controls.js';
import { Keyboard, noteName } from './ui/keyboard.js';
import { Scope } from './ui/scope.js';
import { FACTORY, loadUserPresets, saveUserPresets, resolvePreset } from './presets.js';
import { DataPlayer, DataChart, SCALES, RATES } from './data/player.js';
import { fetchDaily, fetchSiteName, parseCsv } from './data/usgs.js';
import { SOURCES } from './data/features.js';
import { GAUGES } from './data/gauges.js';
import { browserLocation, zipToLatLon, placeToLatLon, nearestGauges, prettyName } from './data/nearby.js';
import { RIVER_FACTORY, loadRiverPresets, saveRiverPresets } from './data/river-presets.js';
import { buildMidi } from './data/midi.js';
import { randomPatch, mutate } from './randomize.js';
import { MidiInput } from './ui/midi-input.js';
import { SimpleView } from './ui/simple.js';

const synth = new Synth();
window.synth = synth; // handy for experimenting from the browser console

const $ = (sel) => document.querySelector(sel);
const slug = (s) => s.replace(/[^\w-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
function download(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const scope = new Scope($('#scope'), $('#readout'));

// --- Front panel ---------------------------------------------------------------
const controls = {};
const sectionEls = {};
const panel = $('#panel');

for (const sec of SECTIONS) {
  const box = document.createElement('section');
  box.className = `section section-${sec.id}`;
  box.innerHTML = `<h2>${sec.title}</h2><div class="controls"></div>`;
  const row = box.querySelector('.controls');
  for (const id of sec.controls) {
    const c = createControl(id, (v) => {
      synth.setParam(id, v);
      commitSoon();
      scope.show(`${sec.title} · ${PARAMS[id].label}`, formatValue(id, v, synth.values));
    });
    c.el.dataset.param = id;
    row.appendChild(c.el);
    controls[id] = c;
  }
  sectionEls[sec.id] = { box, sec };
  panel.appendChild(box);
}

// Chord and Arp modes: buttons for the chord type or arp pattern. They set the same
// 'voice.depth' value the minilogue-style Depth knob does, so presets and links are unchanged.
function buttonGroup(label, names, onPick, className = '') {
  const el = document.createElement('div');
  el.className = `control switch picker ${className}`;
  const opts = document.createElement('div');
  opts.className = 'options';
  opts.setAttribute('role', 'radiogroup');
  opts.setAttribute('aria-label', label);
  const buttons = names.map((name, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = name;
    b.setAttribute('role', 'radio');
    b.addEventListener('click', () => onPick(i));
    opts.appendChild(b);
    return b;
  });
  const lab = document.createElement('span');
  lab.className = 'label';
  lab.textContent = label;
  el.append(opts, lab);
  return { el, buttons };
}
function setVoiceDepth(depth, what) {
  synth.setParam('voice.depth', depth);
  commitSoon();
  scope.show(`Voice Mode · ${what}`, formatValue('voice.depth', depth, synth.values));
}

const CHORD_MAIN = ['5th', 'sus2', 'm', 'Maj', 'sus4', 'm7', '7', 'Maj7'];
const CHORD_MORE = CHORDS.map(([name]) => name).filter((name) => !CHORD_MAIN.includes(name));
const chordDepth = (name) => CHORDS.findIndex(([n]) => n === name) / (CHORDS.length - 1);
const chordPicker = buttonGroup('Chord', [...CHORD_MAIN, 'More…'], (i) => {
  let name = CHORD_MAIN[i];
  if (!name) { // More… steps through the less common chords
    const cur = CHORDS[chordIndex(synth.values['voice.depth'])][0];
    name = CHORD_MORE[(CHORD_MORE.indexOf(cur) + 1) % CHORD_MORE.length];
  }
  setVoiceDepth(chordDepth(name), 'Chord');
}, 'picker-chord');
const moreBtn = chordPicker.buttons[CHORD_MAIN.length];
moreBtn.title = `More chords: ${CHORD_MORE.join(', ')}`;

const ARP_PATTERNS = [['Manual', 'manual'], ['Rise', 'rise'], ['Fall', 'fall'], ['Rise Fall', 'risefall'], ['Poly', 'poly'], ['Random', 'random']];
const arpDepth = (kind, oct) => {
  const max = Math.max(...ARP_TYPES.filter((a) => a[1] === kind).map((a) => a[2]));
  const i = ARP_TYPES.findIndex((a) => a[1] === kind && a[2] === Math.min(oct, max));
  return i / (ARP_TYPES.length - 1);
};
const currentArp = () => ARP_TYPES[arpIndex(synth.values['voice.depth'])];
const arpPicker = buttonGroup('Pattern', ARP_PATTERNS.map(([name]) => name), (i) => {
  setVoiceDepth(arpDepth(ARP_PATTERNS[i][1], currentArp()[2]), 'Arp');
}, 'picker-arp');
const octPicker = buttonGroup('Octaves', ['1', '2', '3'], (i) => {
  setVoiceDepth(arpDepth(currentArp()[1], i + 1), 'Arp');
}, 'picker-oct');
octPicker.buttons[2].title = 'Random pattern only';

controls['voice.depth'].el.after(chordPicker.el, arpPicker.el, octPicker.el);

function refreshVoicePickers() {
  const mode = synth.values['voice.mode'], depth = synth.values['voice.depth'];
  chordPicker.el.hidden = mode !== 2;
  arpPicker.el.hidden = octPicker.el.hidden = mode !== 3;
  const chord = CHORDS[chordIndex(depth)][0];
  CHORD_MAIN.forEach((name, i) => chordPicker.buttons[i].setAttribute('aria-checked', String(name === chord)));
  const isMore = CHORD_MORE.includes(chord);
  moreBtn.setAttribute('aria-checked', String(isMore));
  moreBtn.textContent = isMore ? `${chord} ›` : 'More…';
  const [, kind, oct] = ARP_TYPES[arpIndex(depth)];
  ARP_PATTERNS.forEach(([, k], i) => arpPicker.buttons[i].setAttribute('aria-checked', String(k === kind)));
  octPicker.buttons.forEach((b, i) => b.setAttribute('aria-checked', String(i + 1 === oct)));
  octPicker.buttons[2].disabled = kind !== 'random';
}
synth.listeners.add((id) => { if (id === 'voice.mode' || id === 'voice.depth') refreshVoicePickers(); });
refreshVoicePickers();

function refreshVisibility() {
  for (const { box, sec } of Object.values(sectionEls)) {
    if (!sec.showIf) continue;
    for (const [id, test] of Object.entries(sec.showIf)) {
      box.querySelector(`[data-param="${id}"]`).hidden = !test(synth.values);
    }
  }
}

// Keep the panel in sync with any change, including presets and code.
synth.listeners.add((id, v) => {
  controls[id]?.set(v);
  if (PARAMS[id]?.choices) refreshVisibility(); // switches can show or hide other controls
});
refreshVisibility();

// --- Presets -------------------------------------------------------------------
const presetSelect = $('#preset');
const presetName = $('#preset-name');
let userPresets = loadUserPresets();

function fillPresetList(selected) {
  presetSelect.innerHTML = '';
  // Shown when the sound isn't a saved program (random, shared link, a river preset's own sound).
  presetSelect.append(Object.assign(new Option('Custom sound', ''), { disabled: true, hidden: true }));
  const group = (label, list, prefix) => {
    const og = document.createElement('optgroup');
    og.label = label;
    list.forEach((p, i) => {
      const o = document.createElement('option');
      o.value = `${prefix}:${i}`;
      o.textContent = `${String(i + 1).padStart(3, '0')}  ${p.name}`;
      og.appendChild(o);
    });
    presetSelect.appendChild(og);
  };
  group('Factory', FACTORY, 'f');
  if (userPresets.length) group('User', userPresets, 'u');
  if (selected) presetSelect.value = selected;
}

function loadPreset(key) {
  const [kind, i] = key.split(':');
  const preset = (kind === 'f' ? FACTORY : userPresets)[Number(i)];
  if (!preset) return;
  synth.allNotesOff();
  synth.setParams(resolvePreset(preset.values));
  player.rebase();
  presetName.value = preset.name;
  commitNow();
  $('#delete-preset').disabled = kind !== 'u';
  simple.capture();
  scope.show('Program', preset.name);
}

presetSelect.addEventListener('change', () => loadPreset(presetSelect.value));

$('#save-preset').addEventListener('click', () => {
  const name = presetName.value.trim() || 'Untitled';
  const existing = userPresets.findIndex((p) => p.name === name);
  const entry = { name, values: { ...synth.values } };
  if (existing >= 0) userPresets[existing] = entry; else userPresets.push(entry);
  const ok = saveUserPresets(userPresets);
  fillPresetList(`u:${existing >= 0 ? existing : userPresets.length - 1}`);
  fillLayerPrograms(layerSel.value); // the layer 2 menu lists your programs too
  $('#delete-preset').disabled = false;
  scope.show(ok ? 'Saved' : 'Not saved (storage blocked)', name);
});

$('#delete-preset').addEventListener('click', () => {
  const [kind, i] = presetSelect.value.split(':');
  if (kind !== 'u') return;
  const [removed] = userPresets.splice(Number(i), 1);
  saveUserPresets(userPresets);
  fillPresetList('f:0');
  fillLayerPrograms(layerSel.value);
  loadPreset('f:0');
  scope.show('Deleted', removed.name);
});

$('#export-preset').addEventListener('click', () => {
  const name = presetName.value.trim() || 'Untitled';
  download(new Blob([JSON.stringify({ name, values: synth.values }, null, 2)], { type: 'application/json' }), `${slug(name)}.json`);
});

$('#import-preset').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    synth.setParams(resolvePreset(data.values));
    presetName.value = data.name || file.name.replace(/\.json$/, '');
    commitNow();
    scope.show('Imported', presetName.value);
  } catch {
    scope.show('Import failed', 'Not a preset file');
  }
});

fillPresetList('f:0');

// --- Undo / redo -------------------------------------------------------------------
// History holds settled patches (with their names): a knob drag counts once it has been
// still for 400 ms.
// Changes made by the river data player during playback aren't recorded.
const undoBtn = $('#undo'), redoBtn = $('#redo');
const hist = { past: [], future: [], current: null };
let commitTimer = null;
const snapshot = () => JSON.stringify({ n: presetName.value, v: synth.values });
function updateUndoButtons() {
  undoBtn.disabled = !hist.past.length && !commitTimer;
  redoBtn.disabled = !hist.future.length;
}
function commitNow() {
  clearTimeout(commitTimer);
  commitTimer = null;
  const snap = snapshot();
  if (snap !== hist.current) {
    if (hist.current) hist.past.push(hist.current);
    if (hist.past.length > 100) hist.past.shift();
    hist.current = snap;
    hist.future = [];
  }
  updateUndoButtons();
}
function commitSoon() {
  clearTimeout(commitTimer);
  commitTimer = setTimeout(commitNow, 400);
  updateUndoButtons();
}
function restore(snap, label) {
  const { n, v } = JSON.parse(snap);
  synth.setParams(v);
  presetName.value = n;
  player.rebase();
  updateUndoButtons();
  scope.show(label, presetName.value);
}
function undo() {
  if (commitTimer) commitNow();
  if (!hist.past.length) return;
  hist.future.push(hist.current);
  hist.current = hist.past.pop();
  restore(hist.current, 'Undo');
}
function redo() {
  if (!hist.future.length) return;
  hist.past.push(hist.current);
  hist.current = hist.future.pop();
  restore(hist.current, 'Redo');
}
undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);
window.addEventListener('keydown', (e) => {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k !== 'z' && k !== 'y') return;
  if (e.target.matches?.('input[type="text"], input[type="number"], textarea')) return; // let text fields undo
  e.preventDefault();
  if (k === 'y' || e.shiftKey) redo(); else undo();
});

// --- Randomize / mutate ------------------------------------------------------------
let randomCount = 0;
$('#randomize').addEventListener('click', () => {
  if (commitTimer) commitNow();
  synth.setParams(randomPatch(synth.values));
  player.rebase();
  presetName.value = `Random ${++randomCount}`;
  presetSelect.value = '';
  commitNow();
  scope.show('Random sound', presetName.value);
});
$('#mutate').addEventListener('click', () => {
  if (commitTimer) commitNow();
  synth.setParams(mutate(synth.values));
  player.rebase();
  if (!presetName.value.endsWith('~')) presetName.value = `${presetName.value.trim()} ~`;
  commitNow();
  scope.show('Mutated', presetName.value);
});

// --- Share a sound by link -----------------------------------------------------------
// The link's #sound= part holds the settings that differ from the defaults, as base64url JSON.
function encodeShare() {
  const defaults = defaultValues();
  const diff = {};
  for (const [id, v] of Object.entries(synth.values)) {
    if (v !== defaults[id]) diff[id] = Number(Number(v).toPrecision(4));
  }
  const bytes = new TextEncoder().encode(JSON.stringify({ n: presetName.value.trim(), v: diff }));
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeShare(str) {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
}
$('#share').addEventListener('click', async () => {
  const url = `${location.origin}${location.pathname}#sound=${encodeShare()}`;
  try {
    await navigator.clipboard.writeText(url);
    scope.show('Link copied', 'Paste it anywhere to share this sound');
  } catch {
    window.prompt('Copy this link to share the sound:', url);
  }
});

// --- Keyboard ------------------------------------------------------------------
const octaveLabel = $('#octave');
const keyboard = new Keyboard($('#keys'), {
  noteOn: (n) => { ensureAudio(); synth.noteOn(n); },
  noteOff: (n) => synth.noteOff(n),
  onOctave: (o) => { octaveLabel.textContent = noteName((o + 1) * 12); },
});
octaveLabel.textContent = noteName(keyboard.base);
$('#oct-down').addEventListener('click', () => keyboard.setOctave(keyboard.octave - 1));
$('#oct-up').addEventListener('click', () => keyboard.setOctave(keyboard.octave + 1));
$('#panic').addEventListener('click', () => { keyboard.releaseAll(); synth.allNotesOff(); });

// --- MIDI keyboard input -------------------------------------------------------------
const midiBtn = $('#midi');
const midi = new MidiInput({
  press: (src, n) => keyboard.press(src, n),
  release: (src) => keyboard.release(src),
  onStatus: (status) => {
    midiBtn.textContent = status ? `MIDI: ${status.length > 28 ? `${status.slice(0, 27)}…` : status}` : 'MIDI';
  },
});
if (!MidiInput.supported) {
  midiBtn.disabled = true;
  midiBtn.title = 'This browser has no Web MIDI (try Chrome or Edge)';
}
midiBtn.addEventListener('click', async () => {
  if (midi.enabled) {
    midi.disable();
    midiBtn.setAttribute('aria-pressed', 'false');
    return;
  }
  try {
    await ensureAudio();
    await midi.enable();
    midiBtn.setAttribute('aria-pressed', 'true');
  } catch (err) {
    scope.show('MIDI unavailable', err.message || 'Permission was not granted');
  }
});

// --- Audio start (browsers require a click or key press first) -------------------
const power = $('#power');
let starting = null;
function ensureAudio() {
  if (synth.running) return Promise.resolve();
  starting ??= synth.start().then(() => {
    scope.attach(synth.analyser);
    power.setAttribute('aria-pressed', 'true');
    document.body.classList.add('audio-on');
  }).catch((err) => {
    console.error(err);
    scope.show('Audio failed', err.message);
  }).finally(() => { starting = null; });
  return starting;
}
power.addEventListener('click', () => ensureAudio());

// --- Record to WAV -----------------------------------------------------------------
const recBtn = $('#record');
let recTimer = null;
recBtn.addEventListener('click', async () => {
  await ensureAudio();
  const rec = synth.recorder;
  if (!rec) return;
  if (!rec.recording) {
    rec.start();
    recBtn.setAttribute('aria-pressed', 'true');
    const tick = () => {
      const secs = Math.floor(synth.ctx.currentTime - rec.startedAt);
      recBtn.textContent = `■ ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    };
    tick();
    recTimer = setInterval(tick, 250);
    return;
  }
  clearInterval(recTimer);
  recBtn.setAttribute('aria-pressed', 'false');
  recBtn.textContent = '● Rec';
  const blob = await rec.stop();
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const filename = `${slug(presetName.value.trim() || 'synthwork')}-${stamp}.wav`;
  download(blob, filename);
  scope.show('Saved recording', filename);
});

// --- River data player -----------------------------------------------------------
const player = new DataPlayer(synth, ensureAudio);
window.player = player; // for experimenting from the console, like window.synth
const chart = new DataChart($('#data-chart'), player, (step) => player.seek(step));
const dataStatus = $('#data-status');
const dataNow = $('#data-now');
const playBtn = $('#data-play');

const fillSelect = (sel, options, value) => {
  sel.innerHTML = options.map(([v, label]) => `<option value="${v}">${label}</option>`).join('');
  sel.value = String(value);
};
const NOTE_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const octaves = Array.from({ length: 8 }, (_, i) => [24 + i * 12, noteName(24 + i * 12)]);
fillSelect($('#data-scale'), Object.keys(SCALES).map((s) => [s, s]), player.settings.scale);
fillSelect($('#data-root'), NOTE_KEYS.map((n, i) => [i, n]), player.settings.root);
fillSelect($('#data-low'), octaves, player.settings.low);
fillSelect($('#data-high'), octaves, player.settings.high);
fillSelect($('#data-rate'), Object.keys(RATES).map((r) => [r, r]), player.settings.rate);

const bindSetting = (sel, key, parse = (el) => el.value) => {
  const el = $(sel);
  el.addEventListener(el.type === 'number' ? 'change' : 'input', () => player.set(key, parse(el)));
};
bindSetting('#data-scale', 'scale');
bindSetting('#data-root', 'root', (el) => Number(el.value));
bindSetting('#data-low', 'low', (el) => Number(el.value));
bindSetting('#data-high', 'high', (el) => Number(el.value));
bindSetting('#data-rate', 'rate');
bindSetting('#data-bpm', 'bpm', (el) => Math.min(400, Math.max(20, Number(el.value) || 120)));
bindSetting('#data-gate', 'gate', (el) => Number(el.value));
bindSetting('#data-rest', 'restBelow', (el) => Math.max(0, Number(el.value) || 0));
bindSetting('#data-days', 'daysPerStep', (el) => Number(el.value));
$('#data-days').addEventListener('input', () => renderStatus());
bindSetting('#data-combine', 'combine');
bindSetting('#data-tie', 'tie', (el) => el.checked);
bindSetting('#data-loop', 'loop', (el) => el.checked);
bindSetting('#data-log', 'log', (el) => el.checked);
bindSetting('#data-spread', 'spread');
bindSetting('#data-voicing', 'voicing');
bindSetting('#data-roar', 'roar', (el) => el.checked);
bindSetting('#data-roar-level', 'roarLevel', (el) => Number(el.value));

playBtn.addEventListener('click', () => (player.playing ? player.stop() : player.play()));
player.listeners.add(({ playing }) => {
  playBtn.querySelector('.play-text').textContent = playing ? 'Stop' : 'Play';
  playBtn.setAttribute('aria-label', playing ? 'Stop' : 'Play');
  playBtn.setAttribute('aria-pressed', String(playing));
  if (!playing) keyboard.highlight(null);
});

// Readout under the chart: date, flow and the note it became.
let lastShown = -1;
chart.onFrame = (step) => {
  if (step == null || !player.rows.length) return;
  if (player.playing) keyboard.highlight(player.notes[step]);
  if (step === lastShown) return;
  lastShown = step;
  const row = player.rows[step];
  const note = player.notes[step];
  const normal = player.sources.normal[step];
  const pctNormal = row.value != null && normal ? ` (${Math.round((100 * row.value) / normal)}% of normal)` : '';
  dataNow.textContent = `${row.date} · ${row.value == null ? 'no data' : `${row.value.toLocaleString(undefined, { maximumFractionDigits: row.value < 10 ? 2 : 0 })} cfs${row.est ? ' (est.)' : pctNormal}`} · ${note == null ? 'rest' : noteName(note)}`;
};

// The latest year of data: the 365 days up to yesterday (today's daily mean isn't out yet).
function recentYear() {
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - 364);
  return [iso(start), iso(end)];
}
[$('#data-start').value, $('#data-end').value] = recentYear(); // picking a river from the menu plays its latest year

let riverLabel = '';
// The line under the chart: small chips for the dates, length, flow range and (once the
// history loads) the years behind the normal line. The river's name is in the River menu.
function formatDates(a, b) {
  const d = (s) => new Date(`${s}T00:00`);
  const opts = { month: 'short', day: 'numeric' };
  const sameYear = a.slice(0, 4) === b.slice(0, 4);
  return `${d(a).toLocaleDateString(undefined, sameYear ? opts : { ...opts, year: 'numeric' })} – ${d(b).toLocaleDateString(undefined, { ...opts, year: 'numeric' })}`;
}
let normalYears = null; // "1902–2007", once the gauge's history has loaded
function renderStatus() {
  const raw = player.raw;
  const vals = raw.map((r) => r.value).filter((v) => v != null);
  if (!raw.length || !vals.length) { dataStatus.textContent = 'No data'; return; }
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const n = player.settings.daysPerStep;
  const chips = [
    formatDates(raw[0].date, raw[raw.length - 1].date),
    n > 1 ? `${raw.length} days · ${n} per step` : `${raw.length} days`,
    lo === hi ? `${lo.toLocaleString()} cfs` : `${lo.toLocaleString()}–${hi.toLocaleString()} cfs`,
  ];
  if (normalYears) chips.push(`normal from ${normalYears}`);
  const filled = raw.filter((r) => r.est).length, missing = raw.length - vals.length;
  const gaps = [filled && `${filled} ${filled === 1 ? 'day' : 'days'} filled in`, missing && `${missing} missing`].filter(Boolean);
  if (gaps.length) chips.push([gaps.join(' · '), `USGS has no reading for some days (a sensor problem, ice on the river, or data not yet reviewed). Gaps of up to ${DataPlayer.MAX_FILL ?? 7} days are filled in with a straight line (dashed on the chart); longer gaps are left as breaks, and the music rests there.`]);
  const how = Object.assign(document.createElement('a'), {
    className: 'find-gauge how-measured',
    href: 'https://www.usgs.gov/water-science-school/science/how-streamflow-measured',
    target: '_blank', rel: 'noopener',
    textContent: 'How is streamflow measured? ↗',
  });
  dataStatus.replaceChildren(...chips.map((chip) => {
    const [text, title] = Array.isArray(chip) ? chip : [chip];
    const c = document.createElement('span');
    c.className = 'chip';
    c.textContent = text;
    if (title) c.title = title;
    return c;
  }), how);
}
function showSeries(rows, label, history = null, menuName = null) {
  riverLabel = label;
  showCurrentRiver(menuName);
  player.setSeries(rows);
  player.setHistory(history);
  renderRoutes();
  lastShown = -1;
  normalYears = null;
  renderStatus();
}

// Fetch the gauge's full daily record in the background to work out the normal flow for
// each date (used by the "Anomaly vs normal" source and the dashed line on the chart).
let loadToken = 0;
async function loadHistory(site, label, token) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const history = await fetchDaily(site, '1900-01-01', today);
    if (token !== loadToken) return; // a newer load replaced this one
    const years = new Set(history.map((r) => r.date.slice(0, 4)));
    player.setHistory(history);
    renderRoutes();
    lastShown = -1; // refresh the readout so it can show "% of normal"
    if (years.size >= 3) {
      const first = history[0].date.slice(0, 4), last = history[history.length - 1].date.slice(0, 4);
      normalYears = `${first}–${last}`;
      renderStatus();
    }
  } catch {
    // Not fatal: anomaly falls back to the loaded period itself.
  }
}

async function loadFromUsgs() {
  checkRiverNote();
  const token = ++loadToken;
  const site = $('#data-site').value.trim();
  const start = $('#data-start').value, end = $('#data-end').value;
  if (!site || !start || !end) { dataStatus.textContent = 'Enter a gauge number and both dates.'; return; }
  const btn = $('#data-load');
  btn.disabled = true;
  dataStatus.textContent = `Loading USGS ${site}…`;
  try {
    const [rows, name] = await Promise.all([fetchDaily(site, start, end), fetchSiteName(site)]);
    if (!rows.length) {
      dataStatus.textContent = `No daily discharge for USGS ${site} between ${start} and ${end}.`;
    } else {
      const label = name ? `${name} (USGS ${site})` : `USGS ${site}`;
      showSeries(rows, label, null, GAUGES.some((g) => g.id === site) ? null : prettyName(name || `USGS ${site}`));
      loadHistory(site, label, token);
    }
  } catch (err) {
    dataStatus.textContent = `Couldn't load data: ${err.message}`;
  } finally {
    btn.disabled = false;
  }
}
$('#data-load').addEventListener('click', loadFromUsgs);

// Changing a date reloads by itself, after a short pause so typing a year digit by digit
// doesn't fire a request for each one. Partial or backwards dates wait for a fix.
let dateTimer = 0;
function datesChanged() {
  clearTimeout(dateTimer);
  dateTimer = setTimeout(() => {
    const site = $('#data-site').value.trim();
    const start = $('#data-start').value, end = $('#data-end').value;
    if (!site || !start || !end || start > end || start < '1850-01-01') return;
    loadFromUsgs();
  }, 800);
}
$('#data-start').addEventListener('change', datesChanged);
$('#data-end').addEventListener('change', datesChanged);

// River picker: choosing one fills in the gauge number and loads it.
const gaugeSel = $('#data-gauge');
for (const g of GAUGES) gaugeSel.append(new Option(`${g.name} — ${g.note}`, g.id));
// A gauge or file that isn't in the list shows its own name here instead of "Other".
const currentRiverOpt = new Option('', '__current');
currentRiverOpt.hidden = true;
gaugeSel.append(currentRiverOpt, new Option('Other (type a gauge number)', ''));
gaugeSel.value = GAUGES[0].id;
function showCurrentRiver(name) {
  currentRiverOpt.hidden = !name;
  currentRiverOpt.textContent = name ?? '';
  if (name) gaugeSel.value = '__current';
}
const syncGaugeSel = () => {
  const v = $('#data-site').value.trim();
  gaugeSel.value = GAUGES.some((g) => g.id === v) ? v : '';
};
gaugeSel.addEventListener('change', () => {
  if (gaugeSel.value === '__current') return;
  if (!gaugeSel.value) { $('#data-site').focus(); return; }
  $('#data-site').value = gaugeSel.value;
  loadFromUsgs();
});
$('#data-site').addEventListener('input', syncGaugeSel);
$('#data-site').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadFromUsgs(); });

// Find a river near you: location or ZIP code -> the nearest active stream gauges to pick from.
const nearbyBox = $('#nearby-results');
let nearbyToken = 0;
function showNearbyMessage(text) {
  nearbyBox.hidden = false;
  nearbyBox.replaceChildren(text);
}
function markNearbyPick() {
  const site = $('#data-site').value.trim();
  for (const b of nearbyBox.querySelectorAll('.gauge-pick')) b.classList.toggle('on', b.dataset.site === site);
}
async function findNearby(getPoint, where) {
  const token = ++nearbyToken;
  showNearbyMessage(`Searching for gauges ${where}…`);
  try {
    const point = await getPoint();
    if (token !== nearbyToken) return;
    if (point.place) showNearbyMessage(`Searching for gauges near ${point.place}…`);
    const gauges = await nearestGauges(point.lat, point.lon);
    if (token !== nearbyToken) return;
    if (!gauges.length) { showNearbyMessage('No active USGS stream gauges within 150 miles.'); return; }
    const items = gauges.map((g) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'gauge-pick';
      b.dataset.site = g.site;
      b.title = `USGS ${g.site}`;
      const mi = document.createElement('span');
      mi.className = 'mi';
      mi.textContent = `${g.miles < 10 ? g.miles.toFixed(1) : Math.round(g.miles)} mi`;
      b.append(g.name, mi);
      b.addEventListener('click', () => {
        $('#data-site').value = g.site;
        syncGaugeSel();
        markNearbyPick();
        loadFromUsgs();
      });
      return b;
    });
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'nearby-close';
    close.setAttribute('aria-label', 'Close the list');
    close.textContent = '×';
    close.addEventListener('click', () => { nearbyBox.hidden = true; });
    nearbyBox.replaceChildren(...items, close);
    markNearbyPick();
  } catch (err) {
    if (token !== nearbyToken) return;
    const hint = /blocked|location/i.test(err.message) ? ' Try a ZIP code or town instead.' : '';
    showNearbyMessage(`${err.message}.${hint}`);
    if (hint) $('#near-zip').focus();
  }
}
$('#near-me').addEventListener('click', () => findNearby(browserLocation, 'near you'));
// A 5-digit ZIP code, or a place name like "Lowell, MA".
function searchZip() {
  const q = $('#near-zip').value.trim();
  if (!q) { showNearbyMessage('Enter a ZIP code or a town, like "Lowell, MA".'); $('#near-zip').focus(); return; }
  if (/^\d{5}$/.test(q)) findNearby(() => zipToLatLon(q), `near ${q}`);
  else if (/^\d+$/.test(q)) { showNearbyMessage('Enter a 5-digit ZIP code.'); $('#near-zip').focus(); }
  else findNearby(() => placeToLatLon(q), `near ${q}`);
}
$('#near-zip-go').addEventListener('click', searchZip);
$('#near-zip').addEventListener('keydown', (e) => { if (e.key === 'Enter') searchZip(); });

$('#data-csv').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const rows = parseCsv(await file.text());
  ++loadToken;
  noteFor = null; riverNote.hidden = true;
  if (rows.length) showSeries(rows, file.name, null, file.name);
  else dataStatus.textContent = `${file.name}: no rows found. The CSV needs a date column (YYYY-MM-DD) and a flow column in cfs, like "date,discharge_cfs".`;
});

// --- Data → Sound routes -----------------------------------------------------------
// Any continuous control can follow the data, except reverb Decay/Tone, which rebuild the
// reverb's impulse response and can't keep up with per-step changes.
const ROUTE_EXCLUDE = new Set(['reverb.time', 'reverb.depth']);
const ROUTE_TARGETS = SECTIONS.flatMap((sec) => sec.controls
  .filter((id) => PARAMS[id].min !== undefined && !ROUTE_EXCLUDE.has(id))
  .map((id) => [id, `${sec.title} · ${PARAMS[id].label}`]));
const FX_NAMES = { crush: 'Crush', dist: 'Distortion', tape: 'Tape', mod: 'Mod FX', delay: 'Delay', reverb: 'Reverb', pump: 'Pump' };
const routesEl = $('#routes');
// Defaults use three different sources so the sound has more than one dimension.
let routes = [
  { id: 'filter.cutoff', source: 'flow', from: 0.45, to: 0.9 },        // brighter at high flow
  { id: 'reverb.mix', source: 'anomaly', from: 0.08, to: 0.6 },        // drought dry, wet years spacious
  { id: 'filter.resonance', source: 'turbulence', from: 0.1, to: 0.6 }, // stormy weeks more agitated
];
const SOURCE_OPTIONS = Object.entries(SOURCES).map(([k, s]) => [k, s.label]);

function renderRoutes() {
  routesEl.innerHTML = '';
  routes.forEach((r, i) => {
    const row = document.createElement('div');
    row.className = 'route';
    row.innerHTML = `
      <label>Follows<select class="route-source"></select></label>
      <label>Control<select class="route-target"></select></label>
      <label><span class="route-low"></span><input class="route-from" type="range" min="0" max="1" step="0.01"><output></output></label>
      <label><span class="route-high"></span><input class="route-to" type="range" min="0" max="1" step="0.01"><output></output></label>
      <span class="route-warn small"></span>
      <button class="route-remove" type="button" aria-label="Remove ${PARAMS[r.id].label}">×</button>`;
    const sel = row.querySelector('.route-target');
    fillSelect(sel, ROUTE_TARGETS, r.id);
    const srcSel = row.querySelector('.route-source');
    r.source ??= 'flow';
    fillSelect(srcSel, SOURCE_OPTIONS, r.source);
    row.querySelector('.route-low').textContent = SOURCES[r.source].low;
    row.querySelector('.route-high').textContent = SOURCES[r.source].high;
    srcSel.addEventListener('change', () => { r.source = srcSel.value; applyRoutes(); });
    const from = row.querySelector('.route-from'), to = row.querySelector('.route-to');
    from.value = r.from; to.value = r.to;
    const outs = row.querySelectorAll('output');
    const label = () => {
      outs[0].textContent = formatValue(r.id, toValue(PARAMS[r.id], r.from), synth.values);
      outs[1].textContent = formatValue(r.id, toValue(PARAMS[r.id], r.to), synth.values);
    };
    label();
    sel.addEventListener('change', () => {
      // Start a new target at its current knob position, sweeping upward from there.
      const cur = toNorm(PARAMS[sel.value], synth.values[sel.value]);
      routes[i] = { id: sel.value, source: r.source, from: cur, to: Math.min(1, cur + 0.4) };
      applyRoutes();
    });
    from.addEventListener('input', () => { r.from = Number(from.value); label(); player.setRoutes(routes); });
    to.addEventListener('input', () => { r.to = Number(to.value); label(); player.setRoutes(routes); });
    row.querySelector('.route-remove').addEventListener('click', () => { routes.splice(i, 1); applyRoutes(); });
    routesEl.appendChild(row);
  });
  updateRouteWarnings();
}

// An effect knob does nothing while that effect is switched off; say so.
function updateRouteWarnings() {
  routesEl.querySelectorAll('.route').forEach((row, i) => {
    const r = routes[i];
    const unit = r?.id.split('.')[0];
    const off = FX_NAMES[unit] && !synth.values[`${unit}.on`];
    const noNormal = r?.source === 'anomaly' && player.rows.length && !player.sources.anomalyAvailable;
    row.querySelector('.route-warn').textContent = off ? `${FX_NAMES[unit]} is off`
      : noNormal ? 'Normal not available yet (needs several years of data)' : '';
  });
}

function applyRoutes() {
  player.setRoutes(routes);
  renderRoutes();
}

$('#route-add').addEventListener('click', () => {
  const used = new Set(routes.map((r) => r.id));
  const id = (ROUTE_TARGETS.find(([t]) => !used.has(t)) ?? ROUTE_TARGETS[0])[0];
  const cur = toNorm(PARAMS[id], synth.values[id]);
  routes.push({ id, source: 'flow', from: cur, to: Math.min(1, cur + 0.4) });
  applyRoutes();
});
synth.listeners.add((id) => { if (id.endsWith('.on')) updateRouteWarnings(); });
applyRoutes();

// --- Layer 2 ------------------------------------------------------------------------------
// A second sound playing the same river. Its program is any saved program, or a copy of the
// sound in the Modulate panel ("Copied sound").
const layerSel = $('#layer-program');
let layerCustom = null; // values when using a copied sound
function fillLayerPrograms(selected) {
  layerSel.innerHTML = '';
  layerSel.append(Object.assign(new Option('Copied sound', 'custom'), { hidden: true }));
  const group = (label, list, prefix) => {
    if (!list.length) return;
    const og = document.createElement('optgroup');
    og.label = label;
    list.forEach((p, i) => og.append(new Option(p.name, `${prefix}:${i}`)));
    layerSel.append(og);
  };
  group('Factory', FACTORY, 'f');
  group('User', userPresets, 'u');
  layerSel.value = selected;
}
function layerValues() {
  if (layerSel.value === 'custom') return layerCustom ?? defaultValues();
  const [kind, i] = layerSel.value.split(':');
  return resolvePreset((kind === 'u' ? userPresets : FACTORY)[Number(i)]?.values);
}
const applyLayerSound = () => synth.setLayerSound(layerValues());
// Describe layer 2 for saving in a river preset.
function layerState() {
  const [kind, i] = layerSel.value.split(':');
  const sound = layerSel.value === 'custom' || kind === 'u'
    ? { values: { ...layerValues() } }
    : { program: FACTORY[Number(i)].name };
  return { ...player.layer, ...sound, level: Number($('#layer-level').value) };
}
// Restore layer 2 from a river preset (or switch it off if the preset has none).
function setLayerState(layer) {
  const l = { on: false, octave: 0, every: 4, voicing: 'single', drone: null, offbeat: false, level: 0.6, program: 'Love Cry Sub', ...layer };
  for (const k of ['on', 'octave', 'every', 'voicing', 'drone', 'offbeat']) player.setLayer(k, l[k]);
  $('#layer-drone').value = l.drone == null ? '' : String(l.drone);
  $('#layer-offbeat').checked = !!l.offbeat;
  $('#layer-on').checked = !!l.on;
  $('#layer-octave').value = String(l.octave);
  $('#layer-every').value = String(l.every);
  $('#layer-voicing').value = l.voicing;
  $('#layer-level').value = String(l.level);
  synth.setLayerLevel(l.level);
  if (l.values) {
    layerCustom = resolvePreset(l.values);
    layerSel.value = 'custom';
  } else {
    const i = FACTORY.findIndex((p) => p.name === l.program);
    layerSel.value = `f:${Math.max(0, i)}`;
  }
  applyLayerSound();
}
fillLayerPrograms(`f:${Math.max(0, FACTORY.findIndex((p) => p.name === 'Love Cry Sub'))}`);
layerSel.addEventListener('change', applyLayerSound);
$('#layer-on').addEventListener('input', (e) => player.setLayer('on', e.target.checked));
$('#layer-octave').addEventListener('input', (e) => player.setLayer('octave', Number(e.target.value)));
$('#layer-every').addEventListener('input', (e) => player.setLayer('every', Number(e.target.value)));
$('#layer-voicing').addEventListener('input', (e) => player.setLayer('voicing', e.target.value));
fillSelect($('#layer-drone'), [['', 'Off'], ...Array.from({ length: 37 }, (_, i) => [48 + i, noteName(48 + i)])], '');
$('#layer-drone').addEventListener('input', (e) => player.setLayer('drone', e.target.value === '' ? null : Number(e.target.value)));
$('#layer-offbeat').addEventListener('input', (e) => player.setLayer('offbeat', e.target.checked));
$('#layer-level').addEventListener('input', (e) => synth.setLayerLevel(Number(e.target.value)));
$('#layer-copy').addEventListener('click', () => {
  layerCustom = { ...synth.values, ...(player.playing ? player.base : {}) }; // the patch without live data changes
  layerSel.value = 'custom';
  applyLayerSound();
  scope.show('Layer 2', `Copied ${presetName.value || 'sound'}`);
});
applyLayerSound();

// --- River presets ---------------------------------------------------------------------
const riverSel = $('#river-preset');
const riverName = $('#river-preset-name');
let riverUser = loadRiverPresets();
const DATA_CONTROLS = {
  scale: '#data-scale', root: '#data-root', low: '#data-low', high: '#data-high', rate: '#data-rate',
  bpm: '#data-bpm', gate: '#data-gate', tie: '#data-tie', loop: '#data-loop', log: '#data-log',
  spread: '#data-spread', voicing: '#data-voicing', roar: '#data-roar', roarLevel: '#data-roar-level',
  restBelow: '#data-rest', daysPerStep: '#data-days', combine: '#data-combine',
};
function setDataControl(key, value) {
  const el = DATA_CONTROLS[key] && $(DATA_CONTROLS[key]);
  if (!el) return;
  if (el.type === 'checkbox') el.checked = !!value; else el.value = String(value);
}

function fillRiverPresets(selected = '') {
  riverSel.innerHTML = '';
  riverSel.append(new Option('Choose…', ''));
  // Factory presets with a `group` (e.g. the natural vs regulated pair) get their own heading.
  const group = (label, list, prefix, keep = () => true) => {
    const items = list.map((rp, i) => [rp, i]).filter(([rp]) => keep(rp));
    if (!items.length) return;
    const og = document.createElement('optgroup');
    og.label = label;
    for (const [rp, i] of items) og.append(new Option(rp.name, `${prefix}:${i}`));
    riverSel.append(og);
  };
  group('Factory', RIVER_FACTORY, 'rf', (rp) => !rp.group);
  for (const name of new Set(RIVER_FACTORY.map((rp) => rp.group).filter(Boolean))) {
    group(name, RIVER_FACTORY, 'rf', (rp) => rp.group === name);
  }
  group('Yours', riverUser, 'ru');
  riverSel.value = selected;
  $('#river-preset-delete').disabled = !selected.startsWith('ru:');
}

// A preset's one-line note (e.g. what the dam did) shows above the chart while its own
// gauge and dates are loaded.
const riverNote = $('#river-note');
let noteFor = null;
function showRiverNote(rp) {
  noteFor = rp.note && rp.gauge ? rp.gauge : null;
  riverNote.textContent = rp.note ?? '';
  riverNote.hidden = !noteFor;
}
function checkRiverNote() {
  if (!noteFor) return;
  const same = $('#data-site').value.trim() === noteFor.site
    && $('#data-start').value === noteFor.start && $('#data-end').value === noteFor.end;
  if (!same) { noteFor = null; riverNote.hidden = true; }
}

function applyRiverPreset(key) {
  const [kind, i] = key.split(':');
  const rp = (kind === 'rf' ? RIVER_FACTORY : riverUser)[Number(i)];
  if (!rp) return;
  player.stop();
  const prog = rp.program ? FACTORY.find((p) => p.name === rp.program) : null;
  synth.setParams(resolvePreset({ ...(prog?.values ?? {}), ...(rp.values ?? {}) }));
  presetName.value = rp.program ?? rp.name;
  if (prog) presetSelect.value = `f:${FACTORY.indexOf(prog)}`; else presetSelect.value = '';
  // Settings a preset doesn't mention go back to their defaults.
  const defaults = { voicing: 'single', restBelow: 0, fixedLow: 2000, fixedHigh: 130000, daysPerStep: 1, combine: 'mean' };
  for (const [k, v] of Object.entries({ ...defaults, ...rp.settings })) { player.set(k, v); setDataControl(k, v); }
  setLayerState(rp.layer);
  routes = (rp.routes ?? []).map((r) => ({ ...r }));
  applyRoutes();
  riverName.value = rp.name;
  showRiverNote(rp);
  $('#river-preset-delete').disabled = kind !== 'ru';
  simple.capture();
  commitNow();
  if (rp.gauge) {
    const [start, end] = rp.gauge.recent ? recentYear() : [rp.gauge.start, rp.gauge.end];
    $('#data-site').value = rp.gauge.site;
    $('#data-start').value = start;
    $('#data-end').value = end;
    syncGaugeSel();
    loadFromUsgs();
  }
  scope.show('River preset', rp.name);
}
riverSel.addEventListener('change', () => { if (riverSel.value) applyRiverPreset(riverSel.value); });

$('#river-preset-save').addEventListener('click', () => {
  const name = riverName.value.trim() || 'My river';
  const entry = {
    name,
    values: { ...synth.values, ...(player.playing ? player.base : {}) }, // the patch without live data changes
    settings: { ...player.settings },
    routes: routes.map((r) => ({ ...r })),
    layer: layerState(),
    gauge: { site: $('#data-site').value.trim(), start: $('#data-start').value, end: $('#data-end').value },
  };
  const existing = riverUser.findIndex((p) => p.name === name);
  if (existing >= 0) riverUser[existing] = entry; else riverUser.push(entry);
  const ok = saveRiverPresets(riverUser);
  fillRiverPresets(`ru:${existing >= 0 ? existing : riverUser.length - 1}`);
  scope.show(ok ? 'River preset saved' : 'Not saved (storage blocked)', name);
});
$('#river-preset-delete').addEventListener('click', () => {
  const [kind, i] = riverSel.value.split(':');
  if (kind !== 'ru') return;
  const [removed] = riverUser.splice(Number(i), 1);
  saveRiverPresets(riverUser);
  fillRiverPresets('');
  scope.show('Deleted', removed.name);
});
fillRiverPresets('');

// --- Simple view -------------------------------------------------------------------------
// Instrument cards and six knobs in place of the knob panel (the default). Advanced shows
// the full panel; the choice is remembered in this browser.
const simple = new SimpleView($('#simple'), {
  synth, player, factory: FACTORY,
  getRoutes: () => routes,
  setRoutes: (r) => { routes = r; applyRoutes(); },
  setSetting: (key, value) => { player.set(key, value); setDataControl(key, value); },
  getProgramName: () => presetName.value,
  onProgram: (name) => {
    const prog = FACTORY.find((p) => p.name === name);
    presetName.value = name;
    presetSelect.value = prog ? `f:${FACTORY.indexOf(prog)}` : '';
    if (prog) scope.show('Instrument', name);
  },
  onChange: () => commitSoon(),
});
const synthArea = $('.synth-area');
const viewBtns = synthArea.querySelectorAll('.view-toggle button');
function setView(view) {
  const wasSimple = synthArea.classList.contains('is-simple');
  const isSimple = view === 'simple';
  if (wasSimple && !isSimple) simple.leave();
  if (!wasSimple && isSimple) simple.enter();
  synthArea.classList.toggle('is-simple', isSimple);
  viewBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
  try { localStorage.setItem('synthwork.view', view); } catch {}
}
viewBtns.forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
try {
  if (localStorage.getItem('synthwork.view') === 'advanced') {
    synthArea.classList.remove('is-simple');
    viewBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === 'advanced')));
  }
} catch {}

// --- Export the river song -------------------------------------------------------------
function songName(ext) {
  const g = GAUGES.find((x) => x.id === $('#data-site').value.trim());
  const river = (g?.name ?? riverLabel ?? 'river').split(',')[0];
  const rows = player.rows;
  return `${slug(river)}-${rows[0].date}_${rows[rows.length - 1].date}.${ext}`;
}

$('#export-wav').addEventListener('click', async () => {
  if (!player.rows.length) return;
  const btn = $('#export-wav');
  if (player.playing) player.stop();
  btn.disabled = true;
  try {
    const ev = player.collectEvents();
    const values = { ...synth.values };
    const tail = Math.min(12, 3 + values['ampeg.release'] * 1.5 + (values['reverb.on'] ? 3 : 0));
    const blob = await synth.renderOffline({
      values,
      notes: ev.notes,
      params: ev.params,
      roar: player.settings.roar ? { level: player.settings.roarLevel, steps: ev.roar } : null,
      layers: player.layer.on ? [{ values: layerValues(), level: Number($('#layer-level').value), notes: ev.layerNotes }] : [],
      duration: ev.duration + tail,
      onProgress: (f) => { btn.textContent = `Rendering ${Math.round(f * 100)}%`; },
    });
    const filename = songName('wav');
    download(blob, filename);
    scope.show('Saved', filename);
  } catch (err) {
    console.error(err);
    dataStatus.textContent = `Export failed: ${err.message}`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Export WAV';
  }
});

$('#export-midi').addEventListener('click', () => {
  if (!player.rows.length) return;
  const ev = player.collectEvents();
  const blob = buildMidi({ notes: ev.notes, layerNotes: ev.layerNotes, steps: ev.steps, sources: player.sources, bpm: player.settings.bpm, name: riverLabel || 'River' });
  const filename = songName('mid');
  download(blob, filename);
  scope.show('Saved', filename);
});

// --- Start up: a shared link's sound, or program 001 ------------------------------------
const shared = location.hash.match(/^#sound=([\w-]+)/);
let sharedLoaded = false;
if (shared) {
  try {
    const data = decodeShare(shared[1]);
    synth.setParams(resolvePreset(data.v));
    presetName.value = data.n || 'Shared sound';
    presetSelect.value = '';
    commitNow();
    scope.show('Shared sound', presetName.value);
    sharedLoaded = true;
  } catch {
    // a broken link: fall back to the default program
  }
}
// Open on the first river preset (Poudre Pickin') so a first-time visitor can just press
// Play. A shared link keeps its own sound and loads the default river.
if (sharedLoaded) {
  loadFromUsgs();
} else {
  riverSel.value = 'rf:0';
  applyRiverPreset('rf:0');
}
simple.capture();
window.addEventListener('pointerdown', () => ensureAudio(), { once: true });
window.addEventListener('keydown', () => ensureAudio(), { once: true });

// The river Settings fold stays open or closed the way the visitor left it.
const dataMore = document.getElementById('data-more');
try { dataMore.open = localStorage.getItem('synthwork.settingsOpen') === '1'; } catch {}
dataMore.addEventListener('toggle', () => {
  try { localStorage.setItem('synthwork.settingsOpen', dataMore.open ? '1' : '0'); } catch {}
});

// Light / dark look, remembered in this browser (dark is the default).
const themeBtn = document.getElementById('theme-toggle');
function showTheme() {
  const dark = document.documentElement.dataset.theme !== 'light';
  themeBtn.textContent = dark ? '☀ Light' : '☾ Dark';
  themeBtn.setAttribute('aria-label', dark ? 'Switch to the light look' : 'Switch to the dark look');
}
themeBtn.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('synthwork.theme', next); } catch {}
  showTheme();
});
showTheme();

// Contact link. The address is put together here rather than written in the page, so
// spam bots that scan pages for addresses don't pick it up.
const contact = document.getElementById('contact');
const CONTACT = ['riversynth.kc', 'gmail.com']; // [name, domain]
contact.addEventListener('click', (e) => {
  e.preventDefault();
  const subject = encodeURIComponent('RiverSynth');
  window.location.href = `mailto:${CONTACT.join('@')}?subject=${subject}`;
});
