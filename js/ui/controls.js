// Front-panel controls: knobs, multi-position switches and toggle buttons.
// Each control calls onChange(value) and exposes set(value) for external updates.

import { PARAMS, toNorm, toValue } from '../params.js';

const SWEEP = 270; // knob rotation range in degrees

function arcPath(t) {
  const r = 22, cx = 28, cy = 28;
  const a0 = (-135 - 90) * Math.PI / 180;
  const a1 = a0 + (t * SWEEP) * Math.PI / 180;
  const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${t * SWEEP > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

export function createKnob(id, onChange) {
  const p = PARAMS[id];
  const el = document.createElement('div');
  el.className = 'control knob';
  el.innerHTML = `
    <div class="dial" tabindex="0" role="slider" aria-label="${p.label}">
      <svg viewBox="0 0 56 56" aria-hidden="true">
        <path class="track" d="${arcPath(1)}" />
        <path class="value" />
        <circle class="cap" cx="28" cy="28" r="15" />
        <line class="pointer" x1="28" y1="28" x2="28" y2="16" />
      </svg>
    </div>
    <span class="label">${p.label}</span>`;
  const dial = el.querySelector('.dial');
  const valueArc = el.querySelector('.value');
  const pointer = el.querySelector('.pointer');
  const bipolar = p.min < 0;
  let t = toNorm(p, p.def);

  const render = () => {
    if (bipolar) {
      // draw from 12 o'clock toward the current value
      const lo = Math.min(t, 0.5), hi = Math.max(t, 0.5);
      valueArc.setAttribute('d', hi - lo < 0.001 ? '' : arcSegment(lo, hi));
    } else {
      valueArc.setAttribute('d', t < 0.001 ? '' : arcPath(t));
    }
    pointer.setAttribute('transform', `rotate(${-135 + t * SWEEP} 28 28)`);
    dial.setAttribute('aria-valuenow', String(Math.round(t * 100)));
  };

  const setNorm = (nt) => {
    nt = Math.min(1, Math.max(0, nt));
    if (nt === t) return;
    t = nt;
    render();
    onChange(toValue(p, t));
  };

  dial.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    dial.focus();
    dial.setPointerCapture(e.pointerId);
    let lastY = e.clientY;
    const move = (ev) => {
      const dy = lastY - ev.clientY;
      lastY = ev.clientY;
      setNorm(t + dy / (ev.shiftKey ? 900 : 180));
    };
    const up = () => {
      dial.removeEventListener('pointermove', move);
      dial.removeEventListener('pointerup', up);
      dial.removeEventListener('pointercancel', up);
    };
    dial.addEventListener('pointermove', move);
    dial.addEventListener('pointerup', up);
    dial.addEventListener('pointercancel', up);
  });
  dial.addEventListener('dblclick', () => setNorm(toNorm(p, p.def)));
  dial.addEventListener('wheel', (e) => {
    e.preventDefault();
    setNorm(t - Math.sign(e.deltaY) * (e.shiftKey ? 0.002 : 0.01));
  }, { passive: false });
  dial.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 0.002 : 0.02;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') setNorm(t + step);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') setNorm(t - step);
    else return;
    e.preventDefault();
    e.stopPropagation();
  });

  render();
  return {
    el,
    set(v) { t = Math.min(1, Math.max(0, toNorm(p, v))); render(); },
  };
}

function arcSegment(lo, hi) {
  const r = 22, cx = 28, cy = 28;
  const ang = (x) => ((-135 - 90) + x * SWEEP) * Math.PI / 180;
  const a0 = ang(lo), a1 = ang(hi);
  return `M ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A ${r} ${r} 0 ${(hi - lo) * SWEEP > 180 ? 1 : 0} 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}`;
}

export function createSwitch(id, onChange) {
  const p = PARAMS[id];
  const el = document.createElement('div');
  el.className = 'control switch';
  const opts = document.createElement('div');
  opts.className = 'options';
  opts.setAttribute('role', 'radiogroup');
  opts.setAttribute('aria-label', p.label);
  const buttons = p.choices.map((label, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.setAttribute('role', 'radio');
    b.addEventListener('click', () => { set(i); onChange(i); });
    opts.appendChild(b);
    return b;
  });
  const lab = document.createElement('span');
  lab.className = 'label';
  lab.textContent = p.label;
  el.append(opts, lab);
  function set(v) {
    buttons.forEach((b, i) => b.setAttribute('aria-checked', String(i === v)));
  }
  set(p.def);
  return { el, set };
}

export function createToggle(id, onChange) {
  const p = PARAMS[id];
  const el = document.createElement('div');
  el.className = 'control toggle';
  const b = document.createElement('button');
  b.type = 'button';
  b.innerHTML = `<span class="led"></span>${p.label}`;
  let v = p.def;
  b.addEventListener('click', () => { set(v ? 0 : 1); onChange(v); });
  el.appendChild(b);
  function set(nv) { v = nv; b.setAttribute('aria-pressed', String(!!v)); }
  set(v);
  return { el, set };
}

export function createControl(id, onChange) {
  const p = PARAMS[id];
  if (p.toggle) return createToggle(id, onChange);
  if (p.choices) return createSwitch(id, onChange);
  return createKnob(id, onChange);
}
