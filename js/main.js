import { PARAMS, SECTIONS, formatValue, toValue, toNorm } from './params.js';
import { Synth } from './synth.js';
import { createControl } from './ui/controls.js';
import { Keyboard, noteName } from './ui/keyboard.js';
import { Scope } from './ui/scope.js';
import { FACTORY, loadUserPresets, saveUserPresets, resolvePreset } from './presets.js';
import { DataPlayer, DataChart, SCALES, RATES } from './data/player.js';
import { fetchDaily, fetchSiteName, parseCsv } from './data/usgs.js';
import { SOURCES } from './data/features.js';
import { GAUGES } from './data/gauges.js';

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
  if (PARAMS[id]?.choices) refreshVisibility(); // switches can show or hide other controls
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
  player.rebase();
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
  const name = (presetName.value.trim() || 'synthwork').replace(/[^\w-]+/g, '_');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name}-${stamp}.wav`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  scope.show('Saved recording', a.download);
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
bindSetting('#data-tie', 'tie', (el) => el.checked);
bindSetting('#data-loop', 'loop', (el) => el.checked);
bindSetting('#data-log', 'log', (el) => el.checked);
bindSetting('#data-spread', 'spread');
bindSetting('#data-roar', 'roar', (el) => el.checked);
bindSetting('#data-roar-level', 'roarLevel', (el) => Number(el.value));

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
  const normal = player.sources.normal[step];
  const pctNormal = row.value != null && normal ? ` (${Math.round((100 * row.value) / normal)}% of normal)` : '';
  dataNow.textContent = `${row.date} · ${row.value == null ? 'no data' : `${row.value.toLocaleString()} cfs${pctNormal}`} · ${note == null ? 'rest' : noteName(note)}`;
};

function showSeries(rows, label, history = null) {
  player.setSeries(rows);
  player.setHistory(history);
  renderRoutes();
  lastShown = -1;
  const vals = rows.map((r) => r.value).filter((v) => v != null);
  dataStatus.textContent = rows.length
    ? `${label} · ${rows.length} days · ${Math.min(...vals).toLocaleString()}–${Math.max(...vals).toLocaleString()} cfs`
    : `${label} · no data`;
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
      dataStatus.textContent += ` · normal from ${first}–${last}`;
    }
  } catch {
    // Not fatal: anomaly falls back to the loaded period itself.
  }
}

async function loadFromUsgs() {
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
      showSeries(rows, label);
      loadHistory(site, label, token);
    }
  } catch (err) {
    dataStatus.textContent = `Couldn't load data: ${err.message}`;
  } finally {
    btn.disabled = false;
  }
}
$('#data-load').addEventListener('click', loadFromUsgs);

// River picker: choosing one fills in the gauge number and loads it.
const gaugeSel = $('#data-gauge');
fillSelect(gaugeSel, [...GAUGES.map((g) => [g.id, `${g.name} — ${g.note}`]), ['', 'Other (type a gauge number)']], GAUGES[0].id);
gaugeSel.addEventListener('change', () => {
  if (!gaugeSel.value) { $('#data-site').focus(); return; }
  $('#data-site').value = gaugeSel.value;
  loadFromUsgs();
});
$('#data-site').addEventListener('input', () => {
  const v = $('#data-site').value.trim();
  gaugeSel.value = GAUGES.some((g) => g.id === v) ? v : '';
});
$('#data-site').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadFromUsgs(); });

$('#data-csv').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const rows = parseCsv(await file.text());
  ++loadToken;
  if (rows.length) showSeries(rows, file.name);
  else dataStatus.textContent = `${file.name}: no date/value rows found.`;
});

// --- Data → Sound routes -----------------------------------------------------------
// Any continuous control can follow the data, except reverb Decay/Tone, which rebuild the
// reverb's impulse response and can't keep up with per-step changes.
const ROUTE_EXCLUDE = new Set(['reverb.time', 'reverb.depth']);
const ROUTE_TARGETS = SECTIONS.flatMap((sec) => sec.controls
  .filter((id) => PARAMS[id].min !== undefined && !ROUTE_EXCLUDE.has(id))
  .map((id) => [id, `${sec.title} · ${PARAMS[id].label}`]));
const FX_NAMES = { mod: 'Mod FX', delay: 'Delay', reverb: 'Reverb' };
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

loadPreset('f:0'); // open with program 001 (Glockenspiel)
loadFromUsgs(); // start with the Poudre River at Fort Collins
window.addEventListener('pointerdown', () => ensureAudio(), { once: true });
window.addEventListener('keydown', () => ensureAudio(), { once: true });
