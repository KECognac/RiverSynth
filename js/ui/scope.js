// OLED-style display: a live oscilloscope, with a parameter readout that
// pops up whenever a control changes (like the minilogue's screen).

export class Scope {
  constructor(canvas, readout) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.readout = readout;
    this.analyser = null;
    this.buf = null;
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
    requestAnimationFrame(() => this.draw());
  }

  attach(analyser) {
    this.analyser = analyser;
    this.buf = new Float32Array(analyser.fftSize);
  }

  show(label, value) {
    this.readout.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    this.readout.classList.add('visible');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.readout.classList.remove('visible'), 1200);
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
  }

  draw() {
    requestAnimationFrame(() => this.draw());
    const { g, canvas } = this;
    const w = canvas.width, h = canvas.height;
    g.fillStyle = '#05080a';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120, 220, 255, 0.12)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, h / 2); g.lineTo(w, h / 2);
    g.stroke();
    if (!this.analyser) return;

    const buf = this.buf;
    this.analyser.getFloatTimeDomainData(buf);
    const span = Math.floor(buf.length / 2);
    // Trigger on a rising zero crossing so the waveform stands still.
    let start = 0;
    for (let i = 1; i < buf.length - span; i++) {
      if (buf[i - 1] < 0 && buf[i] >= 0) { start = i; break; }
    }
    g.strokeStyle = '#bff3ff';
    g.lineWidth = 1.5 * (window.devicePixelRatio || 1);
    g.shadowColor = '#5fd8ff';
    g.shadowBlur = 6;
    g.beginPath();
    const view = Math.floor(span / 2);
    for (let i = 0; i < view; i++) {
      const x = (i / (view - 1)) * w;
      const y = h / 2 - buf[start + i] * h * 0.45;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    g.shadowBlur = 0;
  }
}
