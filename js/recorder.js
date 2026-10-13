// Records the synth's final output and saves it as a 16-bit stereo WAV file.

export class Recorder {
  constructor(ctx, source) {
    this.ctx = ctx;
    this.node = new AudioWorkletNode(ctx, 'recorder', {
      numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2],
    });
    // The recorder must be connected onward to be processed; a muted gain does that.
    const mute = ctx.createGain();
    mute.gain.value = 0;
    source.connect(this.node).connect(mute).connect(ctx.destination);
    this.recording = false;
    this.left = [];
    this.right = [];
    this.node.port.onmessage = (e) => {
      if (e.data.chunks) {
        this.left.push(...e.data.chunks[0]);
        this.right.push(...e.data.chunks[1]);
      }
      if (e.data.done) this.resolveStop?.();
    };
  }

  start() {
    this.left = [];
    this.right = [];
    this.recording = true;
    this.startedAt = this.ctx.currentTime;
    this.node.port.postMessage('start');
  }

  // Resolves with a WAV Blob once the last audio has arrived from the audio thread.
  stop() {
    this.recording = false;
    return new Promise((resolve) => {
      this.resolveStop = () => resolve(encodeWav(this.left, this.right, this.ctx.sampleRate));
      this.node.port.postMessage('stop');
    });
  }
}

export function encodeWav(leftChunks, rightChunks, sampleRate) {
  const frames = leftChunks.reduce((n, c) => n + c.length, 0);
  const buf = new ArrayBuffer(44 + frames * 4);
  const view = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); view.setUint32(4, 36 + frames * 4, true); str(8, 'WAVE');
  str(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true); view.setUint16(34, 16, true);
  str(36, 'data'); view.setUint32(40, frames * 4, true);
  let o = 44;
  for (let c = 0; c < leftChunks.length; c++) {
    const L = leftChunks[c], R = rightChunks[c];
    for (let i = 0; i < L.length; i++) {
      view.setInt16(o, Math.max(-1, Math.min(1, L[i])) * 0x7fff, true);
      view.setInt16(o + 2, Math.max(-1, Math.min(1, R[i])) * 0x7fff, true);
      o += 4;
    }
  }
  return new Blob([buf], { type: 'audio/wav' });
}
