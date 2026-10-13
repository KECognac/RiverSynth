// Audio-thread helpers for the effects chain:
//   'pitch-shift' : octave-up shifter used inside the shimmer reverb's feedback loop
//   'crusher'     : bit-depth and sample-rate reduction
//   'recorder'    : copies whatever passes through it to the main thread (for WAV export)

// Granular pitch shifter: two read taps sweep through a short delay line at twice the
// write speed, crossfaded with sine-squared windows so the jumps are inaudible.
class PitchShift extends AudioWorkletProcessor {
  constructor() {
    super();
    this.size = 8192;
    this.win = 2048; // ~43 ms grains at 48 kHz
    this.bufs = [new Float32Array(this.size), new Float32Array(this.size)];
    this.w = 0;
    this.d = 0; // current delay of the first tap
    this.alive = true;
    this.port.onmessage = (e) => { if (e.data === 'end') this.alive = false; };
  }
  process(inputs, outputs) {
    const input = inputs[0], output = outputs[0];
    if (!input.length) return this.alive ?? true;
    const n = output[0].length, size = this.size, W = this.win, ratio = 2;
    for (let i = 0; i < n; i++) {
      this.d -= ratio - 1;
      if (this.d < 0) this.d += W;
      for (let ch = 0; ch < output.length; ch++) {
        const buf = this.bufs[ch];
        const x = (input[ch] ?? input[0])[i];
        buf[(this.w) & (size - 1)] = x;
        let y = 0;
        for (const off of [0, W / 2]) {
          const dd = (this.d + off) % W;
          const pos = this.w - dd - 1;
          const i0 = Math.floor(pos), f = pos - i0;
          const a = buf[i0 & (size - 1)], b = buf[(i0 + 1) & (size - 1)];
          const g = Math.sin(Math.PI * dd / W);
          y += (a + (b - a) * f) * g * g;
        }
        output[ch][i] = y;
      }
      this.w++;
    }
    return this.alive;
  }
}
registerProcessor('pitch-shift', PitchShift);

class Crusher extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'bits', defaultValue: 8, minValue: 1, maxValue: 16, automationRate: 'k-rate' },
      { name: 'down', defaultValue: 4, minValue: 1, maxValue: 64, automationRate: 'k-rate' },
    ];
  }
  constructor() {
    super();
    this.hold = [0, 0];
    this.count = 0;
    this.alive = true;
    this.port.onmessage = (e) => { if (e.data === 'end') this.alive = false; };
  }
  process(inputs, outputs, params) {
    const input = inputs[0], output = outputs[0];
    if (!input.length) return this.alive ?? true;
    const half = Math.pow(2, params.bits[0]) / 2;
    const down = params.down[0];
    for (let i = 0; i < output[0].length; i++) {
      this.count += 1;
      const sample = this.count >= down;
      if (sample) this.count -= down;
      for (let ch = 0; ch < output.length; ch++) {
        if (sample) this.hold[ch] = Math.round((input[ch] ?? input[0])[i] * half) / half;
        output[ch][i] = this.hold[ch];
      }
    }
    return this.alive;
  }
}
registerProcessor('crusher', Crusher);

class Recorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.on = false;
    this.chunks = [[], []];
    this.port.onmessage = (e) => {
      if (e.data === 'start') { this.on = true; this.chunks = [[], []]; }
      if (e.data === 'stop') { this.flush(); this.on = false; this.port.postMessage({ done: true }); }
    };
  }
  flush() {
    if (this.chunks[0].length) this.port.postMessage({ chunks: this.chunks });
    this.chunks = [[], []];
  }
  process(inputs) {
    const input = inputs[0];
    if (this.on && input.length) {
      this.chunks[0].push(input[0].slice());
      this.chunks[1].push((input[1] ?? input[0]).slice());
      if (this.chunks[0].length >= 64) this.flush(); // send about every 170 ms
    }
    return true;
  }
}
registerProcessor('recorder', Recorder);
