// OLED-style display: a live oscilloscope, with a parameter readout that
// pops up whenever a control changes (like the minilogue's screen).

export class Scope {
  constructor(canvas, readout) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.readout = readout;
    this.analyser = null;
    this.buf = null;
    this.idle = 1; // 1 = showing the resting shimmer, 0 = showing live sound
    this.still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
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
    g.fillStyle = '#0b0e10';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(246, 231, 182, 0.12)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, h / 2); g.lineTo(w, h / 2);
    g.stroke();

    const buf = this.buf;
    let live = false;
    if (this.analyser) {
      this.analyser.getFloatTimeDomainData(buf);
      for (let i = 0; i < buf.length; i += 8) if (Math.abs(buf[i]) > 0.003) { live = true; break; }
    }
    // While nothing is sounding, a slow, gentle ripple, like water at rest; it fades out as
    // soon as sound starts and back in after it stops.
    this.idle += ((live ? 0 : 1) - this.idle) * (live ? 0.25 : 0.04);
    if (this.idle > 0.02) this.drawIdle(w, h);
    if (!live) return;

    const span = Math.floor(buf.length / 2);
    // Trigger on a rising zero crossing so the waveform stands still.
    let start = 0;
    for (let i = 1; i < buf.length - span; i++) {
      if (buf[i - 1] < 0 && buf[i] >= 0) { start = i; break; }
    }
    g.strokeStyle = '#f6e7b6';
    g.lineWidth = 1.5 * (window.devicePixelRatio || 1);
    g.shadowColor = '#f0b62f';
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

  drawIdle(w, h) {
    const { g } = this;
    const t = this.still ? 0 : performance.now() / 1000;
    const dpr = window.devicePixelRatio || 1;
    g.strokeStyle = `rgba(246, 231, 182, ${0.45 * this.idle})`;
    g.lineWidth = 1.5 * dpr;
    g.shadowColor = '#f0b62f';
    g.shadowBlur = 6 * this.idle;
    g.beginPath();
    const n = 96;
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const ripple = 0.6 * Math.sin(f * Math.PI * 3 + t * 0.7) + 0.4 * Math.sin(f * Math.PI * 7.4 - t * 1.1);
      const y = h / 2 - ripple * h * 0.07 * Math.sin(f * Math.PI); // taper to the edges
      if (i === 0) g.moveTo(f * w, y); else g.lineTo(f * w, y);
    }
    g.stroke();
    g.shadowBlur = 0;
  }
}
