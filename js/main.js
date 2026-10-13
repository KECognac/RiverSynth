import { PARAMS, SECTIONS, formatValue } from './params.js';
import { Synth } from './synth.js';
import { createControl } from './ui/controls.js';
import { Keyboard, noteName } from './ui/keyboard.js';
import { Scope } from './ui/scope.js';
import { FACTORY, loadUserPresets, saveUserPresets, resolvePreset } from './presets.js';

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
  if (id === 'multi.type') refreshVisibility();
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
window.addEventListener('pointerdown', () => ensureAudio(), { once: true });
window.addEventListener('keydown', () => ensureAudio(), { once: true });
