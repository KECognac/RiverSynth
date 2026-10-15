// Write a river performance as a Standard MIDI File (format 0, one track).
//
// Notes are the data player's notes (channel 1); layer 2's notes go on channel 2.
// Each river signal is also written as a controller
// (CC) per step, so a music program can map them to any knob:
//   CC 20 Flow · CC 21 Change · CC 22 Anomaly vs normal · CC 23 Trend · CC 24 Turbulence
// (CC 20-24 are "undefined" in the MIDI spec, so they won't collide with mod wheel etc.)

export const SOURCE_CCS = [[20, 'flow'], [21, 'change'], [22, 'anomaly'], [23, 'trend'], [24, 'turbulence']];

const PPQ = 480; // ticks per quarter note

function vlq(n) { // MIDI variable-length quantity
  const bytes = [n & 0x7f];
  while ((n >>= 7)) bytes.unshift((n & 0x7f) | 0x80);
  return bytes;
}

const text = (s) => [...new TextEncoder().encode(s)];

// notes: [{ type: 'noteOn'|'noteOff', note, time }], steps: [{ i, time }], sources: player.sources
export function buildMidi({ notes, layerNotes = [], steps, sources, bpm, name }) {
  const toTick = (sec) => Math.max(0, Math.round((sec * bpm / 60) * PPQ));
  const events = []; // { tick, order, bytes } -- note-offs sort before note-ons at the same tick
  const addNotes = (list, ch) => {
    for (const e of list) {
      const n = Math.max(0, Math.min(127, Math.round(e.note)));
      if (e.type === 'noteOn') events.push({ tick: toTick(e.time), order: 2, bytes: [0x90 | ch, n, 100] });
      else events.push({ tick: toTick(e.time), order: 0, bytes: [0x80 | ch, n, 0] });
    }
  };
  addNotes(notes, 0);
  addNotes(layerNotes, 1);
  const last = {};
  for (const { i, time } of steps) {
    for (const [cc, key] of SOURCE_CCS) {
      const v = sources[key]?.[i];
      if (v == null) continue;
      const val = Math.round(v * 127);
      if (last[cc] === val) continue; // only write changes
      last[cc] = val;
      events.push({ tick: toTick(time), order: 1, bytes: [0xb0, cc, val] });
    }
  }
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);

  const usPerQuarter = Math.round(60_000_000 / bpm);
  const name8 = text(name.slice(0, 120));
  const track = [
    0, 0xff, 0x03, ...vlq(name8.length), ...name8,                                        // track name
    0, 0xff, 0x51, 0x03, (usPerQuarter >> 16) & 0xff, (usPerQuarter >> 8) & 0xff, usPerQuarter & 0xff, // tempo
    0, 0xff, 0x58, 0x04, 4, 2, 24, 8,                                                       // 4/4
  ];
  let prev = 0;
  for (const e of events) {
    track.push(...vlq(e.tick - prev), ...e.bytes);
    prev = e.tick;
  }
  track.push(0, 0xff, 0x2f, 0x00); // end of track

  const header = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (PPQ >> 8) & 0xff, PPQ & 0xff];
  const len = track.length;
  const trackHeader = [0x4d, 0x54, 0x72, 0x6b, (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff];
  return new Blob([new Uint8Array([...header, ...trackHeader, ...track])], { type: 'audio/midi' });
}
