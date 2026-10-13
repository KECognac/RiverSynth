import { PARAMS, SECTIONS, formatValue } from './params.js';
import { Synth } from './synth.js';
import { createControl } from './ui/controls.js';
import { Keyboard, noteName } from './ui/keyboard.js';
import { Scope } from './ui/scope.js';
import { FACTORY, loadUserPresets, saveUserPresets, resolvePreset } from './presets.js';
import { DataPlayer, DataChart, SCALES, RATES } from './data/player.js';
import { fetchDaily, fetchSiteName, parseCsv } from './data/usgs.js';

const synth = new Synth();
window.synth = synth; // handy for experimenting from the browser console

const $ = (sel) => document.querySelector(sel);
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
      scope.show(`${sec.title} · ${PARAMS[id].label}`, formatValue(id, v, synth.values));
    });
    c.el.dataset.param = id;
    row.appendChild(c.el);
    controls[id] = c;
  }
  sectionEls[sec.id] = { box, sec };
  panel.appendChild(box);
}

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
  if (id === 'multi.type' || id === 'voice.mode') refreshVisibility();
});
refreshVisibility();

// --- Presets -------------------------------------------------------------------
const presetSelect = $('#preset');
const presetName = $('#preset-name');
let userPresets = loadUserPresets();

function fillPresetList(selected) {
  presetSelect.innerHTML = '';
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
  presetName.value = preset.name;
  $('#delete-preset').disabled = kind !== 'u';
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
  $('#delete-preset').disabled = false;
  scope.show(ok ? 'Saved' : 'Not saved (storage blocked)', name);
});

$('#delete-preset').addEventListener('click', () => {
  const [kind, i] = presetSelect.value.split(':');
  if (kind !== 'u') return;
  const [removed] = userPresets.splice(Number(i), 1);
  saveUserPresets(userPresets);
  fillPresetList('f:0');
  loadPreset('f:0');
  scope.show('Deleted', removed.name);
});

$('#export-preset').addEventListener('click', () => {
  const name = presetName.value.trim() || 'Untitled';
  const blob = new Blob([JSON.stringify({ name, values: synth.values }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name.replace(/[^\w-]+/g, '_')}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$('#import-preset').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    synth.setParams(resolvePreset(data.values));
    presetName.value = data.name || file.name.replace(/\.json$/, '');
    scope.show('Imported', presetName.value);
  } catch {
    scope.show('Import failed', 'Not a preset file');
  }
});

fillPresetList('f:0');

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

// --- River data player -----------------------------------------------------------
const player = new DataPlayer(synth, ensureAudio);
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
bindSetting('#data-tie', 'tie', (el) => el.checked);
bindSetting('#data-loop', 'loop', (el) => el.checked);
bindSetting('#data-log', 'log', (el) => el.checked);

playBtn.addEventListener('click', () => (player.playing ? player.stop() : player.play()));
player.listeners.add(({ playing }) => {
  playBtn.textContent = playing ? '■ Stop' : '▶ Play';
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
  dataNow.textContent = `${row.date} · ${row.value == null ? 'no data' : `${row.value.toLocaleString()} cfs`} · ${note == null ? 'rest' : noteName(note)}`;
};

function showSeries(rows, label) {
  player.setSeries(rows);
  lastShown = -1;
  const vals = rows.map((r) => r.value).filter((v) => v != null);
  dataStatus.textContent = rows.length
    ? `${label} · ${rows.length} days · ${Math.min(...vals).toLocaleString()}–${Math.max(...vals).toLocaleString()} cfs`
    : `${label} · no data`;
}

async function loadFromUsgs() {
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
      showSeries(rows, name ? `${name} (USGS ${site})` : `USGS ${site}`);
    }
  } catch (err) {
    dataStatus.textContent = `Couldn't load data: ${err.message}`;
  } finally {
    btn.disabled = false;
  }
}
$('#data-load').addEventListener('click', loadFromUsgs);
$('#data-site').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadFromUsgs(); });

$('#data-csv').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const rows = parseCsv(await file.text());
  if (rows.length) showSeries(rows, file.name);
  else dataStatus.textContent = `${file.name}: no date/value rows found.`;
});

loadFromUsgs(); // start with the Poudre River at Fort Collins
window.addEventListener('pointerdown', () => ensureAudio(), { once: true });
window.addEventListener('keydown', () => ensureAudio(), { once: true });
