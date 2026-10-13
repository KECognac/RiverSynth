// Play the synth from a hardware MIDI keyboard (Web MIDI: Chrome, Edge, Firefox; not Safari).
// Notes go through the same press/release path as the computer and on-screen keyboards,
// so keys light up on screen. The sustain pedal (CC 64) holds notes.

export class MidiInput {
  constructor({ press, release, onStatus }) {
    this.press = press;
    this.release = release;
    this.onStatus = onStatus;
    this.enabled = false;
    this.down = new Set();      // keys physically held
    this.sustained = new Set(); // keys released while the pedal is down
    this.pedal = false;
  }

  static get supported() { return typeof navigator.requestMIDIAccess === 'function'; }

  async enable() {
    if (!MidiInput.supported) throw new Error('This browser has no Web MIDI (try Chrome or Edge)');
    this.access ??= await navigator.requestMIDIAccess();
    this.enabled = true;
    this.access.onstatechange = () => this.attach();
    this.attach();
  }

  disable() {
    this.enabled = false;
    for (const input of this.access?.inputs.values() ?? []) input.onmidimessage = null;
    for (const n of [...this.down, ...this.sustained]) this.release(`midi:${n}`);
    this.down.clear(); this.sustained.clear(); this.pedal = false;
    this.onStatus('');
  }

  attach() {
    if (!this.enabled) return;
    const inputs = [...this.access.inputs.values()];
    for (const input of inputs) input.onmidimessage = (e) => this.message(e.data);
    this.onStatus(inputs.length ? inputs.map((i) => i.name).join(', ') : 'no devices found');
  }

  message([status, d1, d2]) {
    const cmd = status & 0xf0;
    if (cmd === 0x90 && d2 > 0) {
      this.down.add(d1);
      this.sustained.delete(d1);
      this.press(`midi:${d1}`, d1);
    } else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) {
      this.down.delete(d1);
      if (this.pedal) this.sustained.add(d1);
      else this.release(`midi:${d1}`);
    } else if (cmd === 0xb0 && d1 === 64) {
      this.pedal = d2 >= 64;
      if (!this.pedal) {
        for (const n of this.sustained) if (!this.down.has(n)) this.release(`midi:${n}`);
        this.sustained.clear();
      }
    }
  }
}
