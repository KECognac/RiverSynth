// On-screen piano and computer-keyboard input.
// Both call the same noteOn / noteOff handlers.

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK = new Set([1, 3, 6, 8, 10]);
// Two rows of the QWERTY keyboard laid out like piano keys, starting at C.
const COMPUTER_KEYS = ['a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'y', 'h', 'u', 'j', 'k', 'o', 'l', 'p', ';', "'"];

export const noteName = (n) => `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`;

export class Keyboard {
  constructor(container, { noteOn, noteOff, onOctave }) {
    this.container = container;
    this.noteOn = noteOn;
    this.noteOff = noteOff;
    this.onOctave = onOctave;
    this.octave = 4;          // computer keyboard 'A' = C4
    this.numKeys = 25;        // on-screen range: two octaves, C to C
    this.down = new Map();    // source id -> note (pointer ids and computer keys)
    this.counts = new Map();  // note -> number of sources holding it
    this.render();
    this.bindComputerKeys();
    this.bindPointer();
  }

  get base() { return (this.octave + 1) * 12; }

  setOctave(o) {
    o = Math.max(0, Math.min(8, o));
    if (o === this.octave) return;
    this.releaseAll();
    this.octave = o;
    this.render();
    this.onOctave?.(o);
  }

  render() {
    this.container.innerHTML = '';
    const whites = [];
    for (let i = 0; i < this.numKeys; i++) if (!BLACK.has((this.base + i) % 12)) whites.push(i);
    const whiteW = 100 / whites.length;
    let w = 0;
    this.keyEls = new Map();
    for (let i = 0; i < this.numKeys; i++) {
      const note = this.base + i;
      const black = BLACK.has(note % 12);
      const k = document.createElement('div');
      k.className = `key ${black ? 'black' : 'white'}`;
      k.dataset.note = String(note);
      if (black) k.style.left = `calc(${w * whiteW}% - ${whiteW * 0.3}%)`;
      else { k.style.left = `${w * whiteW}%`; w++; }
      k.style.width = black ? `${whiteW * 0.6}%` : `${whiteW}%`;
      const hint = COMPUTER_KEYS[i];
      k.innerHTML = `<span class="hint">${hint ? hint.toUpperCase() : ''}</span>${note % 12 === 0 ? `<span class="name">${noteName(note)}</span>` : ''}`;
      if (this.counts.get(note)) k.classList.add('down');
      if (this.highlighted === note) k.classList.add('data');
      this.container.appendChild(k);
      this.keyEls.set(note, k);
    }
  }

  press(source, note) {
    if (this.down.has(source)) this.release(source);
    this.down.set(source, note);
    const c = (this.counts.get(note) || 0) + 1;
    this.counts.set(note, c);
    if (c === 1) {
      this.keyEls.get(note)?.classList.add('down');
      this.noteOn(note);
    }
  }

  release(source) {
    const note = this.down.get(source);
    if (note === undefined) return;
    this.down.delete(source);
    const c = (this.counts.get(note) || 1) - 1;
    this.counts.set(note, c);
    if (c === 0) {
      this.keyEls.get(note)?.classList.remove('down');
      this.noteOff(note);
    }
  }

  // Light up a key played by something other than the user (e.g. the data player).
  highlight(note) {
    if (note === this.highlighted) return;
    this.keyEls.get(this.highlighted)?.classList.remove('data');
    this.highlighted = note;
    this.keyEls.get(note)?.classList.add('data');
  }

  releaseAll() { for (const s of [...this.down.keys()]) this.release(s); }

  bindComputerKeys() {
    const typing = (e) => e.target.closest?.('input, textarea, select, [contenteditable]');
    window.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e)) return;
      const key = e.key.toLowerCase();
      if (key === 'z') { if (!e.repeat) this.setOctave(this.octave - 1); return; }
      if (key === 'x') { if (!e.repeat) this.setOctave(this.octave + 1); return; }
      const i = COMPUTER_KEYS.indexOf(key);
      if (i < 0) return;
      e.preventDefault();
      if (!e.repeat) this.press(`key:${key}`, this.base + i);
    });
    window.addEventListener('keyup', (e) => this.release(`key:${e.key.toLowerCase()}`));
    window.addEventListener('blur', () => this.releaseAll());
  }

  bindPointer() {
    const noteAt = (x, y) => {
      const el = document.elementFromPoint(x, y)?.closest('.key');
      return el && this.container.contains(el) ? Number(el.dataset.note) : null;
    };
    this.container.addEventListener('pointerdown', (e) => {
      const n = noteAt(e.clientX, e.clientY);
      if (n === null) return;
      e.preventDefault();
      this.container.setPointerCapture(e.pointerId);
      this.press(`ptr:${e.pointerId}`, n);
    });
    // Sliding across keys plays a glissando.
    this.container.addEventListener('pointermove', (e) => {
      const src = `ptr:${e.pointerId}`;
      if (!this.down.has(src)) return;
      const n = noteAt(e.clientX, e.clientY);
      if (n !== null && n !== this.down.get(src)) this.press(src, n);
    });
    const end = (e) => this.release(`ptr:${e.pointerId}`);
    this.container.addEventListener('pointerup', end);
    this.container.addEventListener('pointercancel', end);
  }
}
