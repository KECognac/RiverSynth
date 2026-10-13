// Factory presets (only the params that differ from the defaults) and
// user preset storage in the browser's localStorage.

import { PARAMS, defaultValues } from './params.js';

// The first preset (001) is the sound the app opens with.
export const FACTORY = [
  {
    // Glockenspiel: a struck steel bar. VCO 2 is tuned 2.76x above VCO 1 (+2 oct, then
    // +557 cents relative to VCO 1's 4'), the bar's real first overtone, which gives the
    // metallic ring. Fast filter-EG strike, long ringing decay, no sustain. Plays an octave up.
    name: 'Glockenspiel',
    values: {
      'vco1.wave': 1, 'vco1.octave': 2, 'vco1.shape': 0.08, 'mixer.vco1': 0.95,
      'vco2.wave': 1, 'vco2.octave': 3, 'vco2.pitch': 557, 'mixer.vco2': 0.45,
      'filter.cutoff': 7000, 'filter.resonance': 0.05, 'filter.keytrack': 2,
      'eg.target': 0, 'eg.attack': 0.001, 'eg.decay': 0.04, 'eg.int': 0.3,
      'ampeg.attack': 0.001, 'ampeg.decay': 2.2, 'ampeg.sustain': 0, 'ampeg.release': 2.2, // keeps ringing after the key is lifted
      'reverb.on': 1, 'reverb.type': 2, 'reverb.time': 0.45, 'reverb.depth': 0.75, 'reverb.mix': 0.25,
      'master.volume': 0.95,
    },
  },
  { name: 'Init Program', values: {} },
  {
    name: 'Warm Poly Pad',
    values: {
      'mixer.vco2': 0.7, 'vco2.pitch': 8, 'filter.cutoff': 1400, 'filter.resonance': 0.15,
      'ampeg.attack': 0.6, 'ampeg.decay': 1.5, 'ampeg.sustain': 0.8, 'ampeg.release': 1.6,
      'eg.attack': 0.8, 'eg.decay': 2.5, 'eg.int': 0.25, 'lfo.rate': 0.3, 'lfo.int': 0.12,
      'voice.depth': 0.4, 'mod.on': 1, 'mod.type': 1, 'mod.mix': 0.5,
      'reverb.on': 1, 'reverb.time': 0.7, 'reverb.mix': 0.35,
    },
  },
  {
    name: 'Unison Bass',
    values: {
      'voice.mode': 1, 'voice.depth': 0.35, 'vco1.octave': 0, 'vco2.octave': 0, 'vco2.wave': 2,
      'mixer.vco2': 0.6, 'filter.cutoff': 380, 'filter.resonance': 0.35, 'filter.drive': 0.4,
      'eg.attack': 0.001, 'eg.decay': 0.25, 'eg.int': 0.45,
      'ampeg.attack': 0.001, 'ampeg.decay': 0.4, 'ampeg.sustain': 0.7, 'ampeg.release': 0.08,
    },
  },
  {
    name: 'Sync Lead',
    values: {
      'vco2.sync': 1, 'vco2.octave': 2, 'mixer.vco1': 0.3, 'mixer.vco2': 0.8,
      'eg.target': 1, 'eg.attack': 0.001, 'eg.decay': 0.6, 'eg.int': -0.35,
      'filter.cutoff': 5000, 'filter.resonance': 0.2, 'lfo.target': 0, 'lfo.rate': 5.5, 'lfo.int': 0.03,
      'delay.on': 1, 'delay.time': 0.32, 'delay.depth': 0.35, 'delay.mix': 0.25,
    },
  },
  {
    name: 'Chord Stab',
    values: {
      'voice.mode': 2, 'voice.depth': 6 / 13, 'filter.cutoff': 900, 'filter.resonance': 0.3,
      'eg.attack': 0.001, 'eg.decay': 0.3, 'eg.int': 0.5,
      'ampeg.attack': 0.001, 'ampeg.decay': 0.35, 'ampeg.sustain': 0, 'ampeg.release': 0.3,
      'delay.on': 1, 'delay.type': 2, 'delay.time': 0.375, 'delay.depth': 0.45, 'delay.mix': 0.3,
      'reverb.on': 1, 'reverb.type': 1, 'reverb.mix': 0.25,
    },
  },
  {
    name: 'Arp Pluck',
    values: {
      'voice.mode': 3, 'voice.depth': 7 / 12, 'arp.latch': 1, 'arp.tempo': 118, 'arp.rate': 3, 'arp.gate': 0.4,
      'vco1.wave': 2, 'vco1.shape': 0.3, 'mixer.vco2': 0.4, 'vco2.octave': 2, 'vco2.wave': 1,
      'filter.cutoff': 700, 'filter.resonance': 0.45, 'eg.attack': 0.001, 'eg.decay': 0.18, 'eg.int': 0.55,
      'ampeg.attack': 0.001, 'ampeg.decay': 0.25, 'ampeg.sustain': 0.2, 'ampeg.release': 0.15,
      'delay.on': 1, 'delay.type': 2, 'delay.time': 0.38, 'delay.depth': 0.4, 'delay.mix': 0.3,
      'reverb.on': 1, 'reverb.type': 0, 'reverb.mix': 0.25,
    },
  },
  {
    // Inspired by the shimmering, bell-like arpeggio in Grimes' "Genesis" (2012):
    // FM bell + soft square + high triangle sparkle, rising arp, chorus, ping-pong and big hall.
    name: 'Genesis Shimmer',
    values: {
      'voice.mode': 3, 'voice.depth': 3 / 12, 'arp.latch': 1, 'arp.tempo': 84, 'arp.rate': 3, 'arp.gate': 0.35,
      'vco1.wave': 2, 'vco1.octave': 2, 'vco1.shape': 0.15, 'mixer.vco1': 0.45,
      'vco2.wave': 1, 'vco2.octave': 3, 'vco2.pitch': 7, 'mixer.vco2': 0.25,
      'multi.type': 1, 'multi.vpm': 2, 'multi.shape': 0.35, 'mixer.multi': 0.7,
      'filter.cutoff': 6500, 'filter.resonance': 0.1, 'filter.keytrack': 2,
      'ampeg.attack': 0.002, 'ampeg.decay': 0.6, 'ampeg.sustain': 0, 'ampeg.release': 0.6,
      'eg.attack': 0.001, 'eg.decay': 0.25, 'eg.int': 0.2,
      'lfo.target': 0, 'lfo.wave': 1, 'lfo.rate': 5, 'lfo.int': 0.01,
      'mod.on': 1, 'mod.type': 1, 'mod.time': 0.35, 'mod.depth': 0.5, 'mod.mix': 0.45,
      'delay.on': 1, 'delay.type': 2, 'delay.time': 0.536, 'delay.depth': 0.45, 'delay.mix': 0.3, // dotted 1/8 at 84 BPM
      'reverb.on': 1, 'reverb.type': 0, 'reverb.time': 0.8, 'reverb.depth': 0.65, 'reverb.mix': 0.45,
    },
  },
  {
    // Inspired by Fred again..'s warm, sidechain-pumping house chords. There's no sidechain here,
    // so a rising saw LFO on the cutoff (2.133 Hz = quarter notes at 128 BPM) ducks each beat.
    name: 'Fred Pump Chords',
    values: {
      'voice.mode': 2, 'voice.depth': 5 / 13, // one key plays a m7 chord
      'vco1.wave': 0, 'vco1.shape': 0.1, 'mixer.vco1': 0.7,
      'vco2.wave': 0, 'vco2.pitch': 12, 'mixer.vco2': 0.6,
      'multi.type': 0, 'multi.noise': 0, 'multi.shape': 0.7, 'mixer.multi': 0.06,
      'filter.cutoff': 1800, 'filter.resonance': 0.15, 'filter.drive': 0.25,
      'ampeg.attack': 0.004, 'ampeg.decay': 1.2, 'ampeg.sustain': 0.7, 'ampeg.release': 0.35,
      'eg.attack': 0.001, 'eg.decay': 0.35, 'eg.int': 0.2,
      'lfo.wave': 0, 'lfo.rate': 2.133, 'lfo.int': -0.35, 'lfo.target': 2,
      'mod.on': 1, 'mod.type': 0, 'mod.mix': 0.35,
      'reverb.on': 1, 'reverb.type': 2, 'reverb.time': 0.5, 'reverb.mix': 0.25,
    },
  },
  {
    // Inspired by the chopped, euphoric energy of Fred again..'s "Delilah (pull me out of this)".
    // The arp's Poly pattern re-triggers the held chord every 1/16 like sample chops (hold the
    // keys; latch is off). Saw LFO on cutoff at quarter notes (140 BPM) imitates sidechain pumping.
    name: 'Delilah Chop Stabs',
    values: {
      'voice.mode': 3, 'voice.depth': 8 / 12, 'arp.latch': 0, 'arp.tempo': 140, 'arp.rate': 3, 'arp.gate': 0.45,
      'vco1.wave': 0, 'mixer.vco1': 0.6,
      'vco2.wave': 0, 'vco2.octave': 2, 'vco2.pitch': 9, 'mixer.vco2': 0.35,
      'multi.type': 0, 'multi.noise': 0, 'multi.shape': 0.75, 'mixer.multi': 0.04,
      'filter.cutoff': 2400, 'filter.resonance': 0.35, 'filter.drive': 0.3,
      'eg.attack': 0.001, 'eg.decay': 0.15, 'eg.int': 0.3,
      'ampeg.attack': 0.002, 'ampeg.decay': 0.2, 'ampeg.sustain': 0.5, 'ampeg.release': 0.12,
      'lfo.wave': 0, 'lfo.rate': 140 / 60, 'lfo.int': -0.3, 'lfo.target': 2,
      'mod.on': 1, 'mod.type': 0, 'mod.mix': 0.3,
      'delay.on': 1, 'delay.type': 2, 'delay.time': 0.214, 'delay.depth': 0.3, 'delay.mix': 0.2, // 1/8 at 140 BPM
      'reverb.on': 1, 'reverb.type': 2, 'reverb.time': 0.45, 'reverb.mix': 0.2,
      'master.volume': 0.55,
    },
  },
  {
    // Watery and magical. Droplets: a fast downward pitch blip on every note (EG -> Pitch),
    // played by a latched Random arp. Current: resonant "Peak" noise for a babbling-brook texture
    // and a slow LFO sweeping the cutoff. Shimmer: folded triangles, phaser, ping-pong, big hall.
    name: 'River Shimmer',
    values: {
      'voice.mode': 3, 'voice.depth': 11 / 12, 'arp.latch': 1, 'arp.tempo': 90, 'arp.rate': 3, 'arp.gate': 0.3,
      'vco1.wave': 1, 'vco1.shape': 0.2, 'mixer.vco1': 0.9,
      'vco2.wave': 1, 'vco2.octave': 2, 'vco2.pitch': 5, 'mixer.vco2': 0.4,
      'multi.type': 0, 'multi.noise': 2, 'multi.shape': 0.55, 'mixer.multi': 0.25,
      'filter.cutoff': 2200, 'filter.resonance': 0.55, 'filter.keytrack': 2,
      'eg.target': 2, 'eg.attack': 0.001, 'eg.decay': 0.06, 'eg.int': 0.12,
      'ampeg.attack': 0.003, 'ampeg.decay': 0.5, 'ampeg.sustain': 0, 'ampeg.release': 0.7,
      'lfo.wave': 1, 'lfo.rate': 0.2, 'lfo.int': 0.25, 'lfo.target': 2,
      'mod.on': 1, 'mod.type': 2, 'mod.time': 0.25, 'mod.depth': 0.7, 'mod.mix': 0.5,
      'delay.on': 1, 'delay.type': 2, 'delay.time': 0.333, 'delay.depth': 0.5, 'delay.mix': 0.35, // 1/8 at 90 BPM
      'reverb.on': 1, 'reverb.type': 0, 'reverb.time': 0.9, 'reverb.depth': 0.7, 'reverb.mix': 0.5,
      'master.volume': 0.95,
    },
  },
  {
    // Soft, Sonic Pi-style mallet beeps. A near-sine FM tone (Bell ratio at low index adds a
    // touch of wooden inharmonicity) plus a triangle body; a fast filter EG makes each strike
    // bright then mellow like a xylophone. A quiet square two octaves up gives a brief digital
    // blip. Latched Random 2 arp on a steady 1/8 grid, like `play scale(...).choose`, with
    // Sonic Pi-ish echo and room reverb, and no wobble so it stays clean.
    name: 'River Shimmer 2',
    values: {
      'voice.mode': 3, 'voice.depth': 11 / 12, 'arp.latch': 1, 'arp.tempo': 110, 'arp.rate': 1, 'arp.gate': 0.3,
      'vco1.wave': 1, 'mixer.vco1': 0.3,
      'vco2.wave': 2, 'vco2.octave': 3, 'mixer.vco2': 0.18,
      'multi.type': 1, 'multi.vpm': 2, 'multi.shape': 0.12, 'mixer.multi': 0.9,
      'filter.cutoff': 1400, 'filter.resonance': 0.05, 'filter.keytrack': 2,
      'eg.target': 0, 'eg.attack': 0.001, 'eg.decay': 0.06, 'eg.int': 0.4,
      'ampeg.attack': 0.001, 'ampeg.decay': 0.45, 'ampeg.sustain': 0, 'ampeg.release': 0.35,
      'delay.on': 1, 'delay.type': 0, 'delay.time': 0.409, 'delay.depth': 0.35, 'delay.mix': 0.25, // dotted 1/8 at 110 BPM
      'reverb.on': 1, 'reverb.type': 1, 'reverb.time': 0.5, 'reverb.depth': 0.5, 'reverb.mix': 0.3,
      'master.volume': 1,
    },
  },
  // --- Inspired by the Moog Grandmother: fat analog mono sounds through a spring reverb ---
  {
    // Classic Moog bass: saw + square an octave below, mono (Unison, light detune),
    // low cutoff with a punchy filter envelope and some drive.
    name: 'Grandmother Bass',
    values: {
      'voice.mode': 1, 'voice.depth': 0.12,
      'vco1.wave': 0, 'mixer.vco1': 0.8,
      'vco2.wave': 2, 'vco2.octave': 0, 'vco2.pitch': -5, 'mixer.vco2': 0.7,
      'filter.cutoff': 280, 'filter.resonance': 0.3, 'filter.drive': 0.5,
      'eg.target': 0, 'eg.attack': 0.001, 'eg.decay': 0.3, 'eg.int': 0.45,
      'ampeg.attack': 0.001, 'ampeg.decay': 0.5, 'ampeg.sustain': 0.8, 'ampeg.release': 0.1,
      'reverb.on': 1, 'reverb.type': 4, 'reverb.time': 0.3, 'reverb.mix': 0.1,
    },
  },
  {
    // Singing mono lead: saw + slightly detuned pulse, resonant filter, light
    // vibrato, tape echo and the drippy spring reverb.
    name: 'Grandmother Lead',
    values: {
      'voice.mode': 1, 'voice.depth': 0.08,
      'vco1.wave': 0, 'mixer.vco1': 0.8,
      'vco2.wave': 2, 'vco2.shape': 0.3, 'vco2.pitch': 7, 'mixer.vco2': 0.6,
      'filter.cutoff': 1800, 'filter.resonance': 0.45, 'filter.drive': 0.3,
      'eg.target': 0, 'eg.attack': 0.01, 'eg.decay': 0.5, 'eg.int': 0.25,
      'ampeg.attack': 0.01, 'ampeg.decay': 0.6, 'ampeg.sustain': 0.85, 'ampeg.release': 0.3,
      'lfo.wave': 1, 'lfo.rate': 5.2, 'lfo.int': 0.02, 'lfo.target': 0,
      'delay.on': 1, 'delay.type': 1, 'delay.time': 0.3, 'delay.depth': 0.35, 'delay.mix': 0.2,
      'reverb.on': 1, 'reverb.type': 4, 'reverb.time': 0.5, 'reverb.mix': 0.3,
    },
  },
  {
    // The Grandmother's arpeggiator: latched rising plucks with a squelchy resonant
    // filter envelope, splashing into the spring reverb.
    name: 'Grandmother Spring Arp',
    values: {
      'voice.mode': 3, 'voice.depth': 3 / 12, 'arp.latch': 1, 'arp.tempo': 112, 'arp.rate': 3, 'arp.gate': 0.35,
      'vco1.wave': 2, 'vco1.shape': 0.2, 'mixer.vco1': 0.8,
      'vco2.wave': 0, 'vco2.octave': 2, 'mixer.vco2': 0.3,
      'filter.cutoff': 600, 'filter.resonance': 0.55, 'filter.drive': 0.2,
      'eg.target': 0, 'eg.attack': 0.001, 'eg.decay': 0.18, 'eg.int': 0.5,
      'ampeg.attack': 0.001, 'ampeg.decay': 0.25, 'ampeg.sustain': 0, 'ampeg.release': 0.2,
      'reverb.on': 1, 'reverb.type': 4, 'reverb.time': 0.55, 'reverb.mix': 0.35,
    },
  },
  {
    // Warm brass chords (the Grandmother can play paraphonically): two detuned saws,
    // a slow-opening filter swell and a touch of spring.
    name: 'Grandmother Brass',
    values: {
      'vco1.wave': 0, 'mixer.vco1': 0.75,
      'vco2.wave': 0, 'vco2.pitch': 10, 'mixer.vco2': 0.65,
      'filter.cutoff': 700, 'filter.resonance': 0.2, 'filter.drive': 0.3,
      'eg.target': 0, 'eg.attack': 0.08, 'eg.decay': 0.6, 'eg.int': 0.45,
      'ampeg.attack': 0.03, 'ampeg.decay': 0.8, 'ampeg.sustain': 0.75, 'ampeg.release': 0.35,
      'voice.depth': 0.3,
      'reverb.on': 1, 'reverb.type': 4, 'reverb.time': 0.4, 'reverb.mix': 0.2,
    },
  },
  {
    // Flowing Moog-style pad: warm detuned saws and a soft triangle an octave up, a resonant
    // filter that swells open on each note and drifts with a slow LFO like a current, slow
    // phaser swirl, tape echo and spring reverb. Long attack and release so notes run together.
    name: 'Grandmother Flow',
    values: {
      'voice.depth': 0.25,
      'vco1.wave': 0, 'mixer.vco1': 0.7,
      'vco2.wave': 0, 'vco2.pitch': -9, 'mixer.vco2': 0.55,
      'multi.type': 1, 'multi.vpm': 1, 'multi.shape': 0.05, 'mixer.multi': 0.25,
      'filter.cutoff': 900, 'filter.resonance': 0.45, 'filter.drive': 0.25,
      'eg.target': 0, 'eg.attack': 1.2, 'eg.decay': 2.5, 'eg.int': 0.3,
      'ampeg.attack': 0.6, 'ampeg.decay': 2, 'ampeg.sustain': 0.85, 'ampeg.release': 2.2,
      'lfo.wave': 1, 'lfo.rate': 0.12, 'lfo.int': 0.3, 'lfo.target': 2,
      'mod.on': 1, 'mod.type': 2, 'mod.time': 0.15, 'mod.depth': 0.6, 'mod.mix': 0.35,
      'delay.on': 1, 'delay.type': 1, 'delay.time': 0.45, 'delay.depth': 0.45, 'delay.mix': 0.25,
      'reverb.on': 1, 'reverb.type': 4, 'reverb.time': 0.7, 'reverb.mix': 0.3,
    },
  },
  // --- Showcase presets for the new features ------------------------------------
  {
    // Huge trance/EDM supersaw: two supersaws (one an octave up) through the 24 dB ladder.
    name: 'Supersaw Anthem',
    values: {
      'arp.tempo': 128, 'voice.depth': 0.2,
      'vco1.wave': 3, 'vco1.shape': 0.55, 'mixer.vco1': 0.8,
      'vco2.wave': 3, 'vco2.octave': 2, 'vco2.shape': 0.4, 'mixer.vco2': 0.45,
      'filter.type': 1, 'filter.cutoff': 4500, 'filter.resonance': 0.15,
      'eg.target': 0, 'eg.attack': 0.001, 'eg.decay': 0.6, 'eg.int': 0.15,
      'ampeg.attack': 0.01, 'ampeg.decay': 1, 'ampeg.sustain': 0.85, 'ampeg.release': 0.6,
      'delay.on': 1, 'delay.type': 2, 'delay.time': 0.352, 'delay.depth': 0.35, 'delay.mix': 0.25, // dotted 1/8 at 128
      'reverb.on': 1, 'reverb.type': 0, 'reverb.time': 0.7, 'reverb.mix': 0.3,
    },
  },
  {
    // Fred again..-style euphoric chords: one key = a supersaw m7 chord, with a real
    // tempo-locked pump that restarts on the first note you play.
    name: 'Euphoric Pump',
    values: {
      'arp.tempo': 126, 'voice.mode': 2, 'voice.depth': 5 / 13,
      'vco1.wave': 3, 'vco1.shape': 0.5, 'mixer.vco1': 0.75,
      'vco2.wave': 3, 'vco2.shape': 0.35, 'mixer.vco2': 0.5,
      'filter.type': 1, 'filter.cutoff': 2600, 'filter.resonance': 0.2,
      'ampeg.attack': 0.005, 'ampeg.decay': 0.8, 'ampeg.sustain': 0.8, 'ampeg.release': 0.3,
      'pump.on': 1, 'pump.rate': 1, 'pump.depth': 0.75, 'pump.release': 0.5,
      'reverb.on': 1, 'reverb.type': 2, 'reverb.time': 0.5, 'reverb.mix': 0.25,
    },
  },
  {
    // Vocal-style chops: hold a chord and the arp re-triggers it every 1/16 while a
    // tempo-synced sample-and-hold LFO jumps the vowel filter to a new vowel each step.
    name: 'Vowel Chops',
    values: {
      'arp.tempo': 124, 'voice.mode': 3, 'voice.depth': 8 / 12, 'arp.latch': 0, 'arp.rate': 3, 'arp.gate': 0.5,
      'vco1.wave': 0, 'mixer.vco1': 0.8,
      'vco2.wave': 2, 'vco2.pitch': 7, 'mixer.vco2': 0.6,
      'filter.type': 5, 'filter.vowel': 0.3, 'filter.cutoff': 1000, 'filter.resonance': 0.55,
      'lfo.wave': 3, 'lfo.sync': 6, 'lfo.int': 0.5, 'lfo.target': 2,
      'ampeg.attack': 0.002, 'ampeg.decay': 0.25, 'ampeg.sustain': 0.6, 'ampeg.release': 0.12,
      'pump.on': 1, 'pump.rate': 1, 'pump.depth': 0.5, 'pump.release': 0.4,
      'delay.on': 1, 'delay.type': 2, 'delay.time': 0.242, 'delay.depth': 0.3, 'delay.mix': 0.2, // 1/8 at 124
      'reverb.on': 1, 'reverb.type': 2, 'reverb.time': 0.45, 'reverb.mix': 0.2,
    },
  },
  {
    // "Ooh" choir: soft supersaw through the vowel filter set near O/U, slowly drifting
    // between vowels, into the shimmer reverb.
    name: 'Choir Pad',
    values: {
      'vco1.wave': 3, 'vco1.shape': 0.35, 'mixer.vco1': 0.8,
      'vco2.wave': 1, 'vco2.octave': 2, 'mixer.vco2': 0.3,
      'filter.type': 5, 'filter.vowel': 0.75, 'filter.cutoff': 800, 'filter.resonance': 0.45,
      'lfo.wave': 4, 'lfo.rate': 0.2, 'lfo.int': 0.15, 'lfo.target': 2,
      'ampeg.attack': 1.2, 'ampeg.decay': 2, 'ampeg.sustain': 0.9, 'ampeg.release': 2.5,
      'mod.on': 1, 'mod.type': 1, 'mod.mix': 0.4,
      'reverb.on': 1, 'reverb.type': 5, 'reverb.time': 0.6, 'reverb.depth': 0.5, 'reverb.mix': 0.35,
    },
  },
  {
    // Ambient wash: soft triangles and a sine layer in a long shimmer reverb that rises
    // an octave as it fades.
    name: 'Shimmer Cathedral',
    values: {
      'vco1.wave': 1, 'mixer.vco1': 0.7,
      'vco2.wave': 1, 'vco2.octave': 3, 'vco2.pitch': 5, 'mixer.vco2': 0.35,
      'multi.type': 1, 'multi.vpm': 0, 'multi.shape': 0.1, 'mixer.multi': 0.3,
      'filter.cutoff': 3000,
      'ampeg.attack': 0.8, 'ampeg.decay': 3, 'ampeg.sustain': 0.7, 'ampeg.release': 4,
      'lfo.wave': 4, 'lfo.rate': 0.3, 'lfo.int': 0.01, 'lfo.target': 0,
      'delay.on': 1, 'delay.type': 0, 'delay.time': 0.5, 'delay.depth': 0.4, 'delay.mix': 0.2,
      'reverb.on': 1, 'reverb.type': 5, 'reverb.time': 0.9, 'reverb.depth': 0.85, 'reverb.mix': 0.55,
    },
  },
  {
    // Lo-fi electric piano: soft FM tine, a drifting-pitch LFO for tape wobble, and the
    // bitcrusher for dusty grit.
    name: 'Lo-Fi Keys',
    values: {
      'multi.type': 1, 'multi.vpm': 0, 'multi.shape': 0.25, 'mixer.multi': 0.8,
      'vco1.wave': 1, 'mixer.vco1': 0.35,
      'filter.cutoff': 2500, 'filter.resonance': 0.1,
      'ampeg.attack': 0.003, 'ampeg.decay': 1.5, 'ampeg.sustain': 0.3, 'ampeg.release': 0.5,
      'lfo.wave': 4, 'lfo.rate': 0.6, 'lfo.int': 0.015, 'lfo.target': 0,
      'crush.on': 1, 'crush.bits': 9, 'crush.rate': 3, 'crush.mix': 0.6,
      'mod.on': 1, 'mod.type': 0, 'mod.mix': 0.3,
      'delay.on': 1, 'delay.type': 1, 'delay.time': 0.33, 'delay.depth': 0.3, 'delay.mix': 0.2,
      'reverb.on': 1, 'reverb.type': 1, 'reverb.time': 0.3, 'reverb.mix': 0.25,
    },
  },
  {
    // Acid line: squelchy resonant 24 dB ladder with a snappy filter envelope on a
    // latched rising arp, plus a slow tempo-synced filter sweep over two bars.
    name: 'Ladder Acid',
    values: {
      'arp.tempo': 128, 'voice.mode': 3, 'voice.depth': 3 / 12, 'arp.latch': 1, 'arp.rate': 3, 'arp.gate': 0.55,
      'vco1.wave': 0, 'mixer.vco1': 0.9,
      'filter.type': 1, 'filter.cutoff': 380, 'filter.resonance': 0.82, 'filter.drive': 0.5,
      'eg.target': 0, 'eg.attack': 0.001, 'eg.decay': 0.2, 'eg.int': 0.55,
      'ampeg.attack': 0.001, 'ampeg.decay': 0.3, 'ampeg.sustain': 0.6, 'ampeg.release': 0.08,
      'lfo.wave': 1, 'lfo.sync': 1, 'lfo.int': 0.25, 'lfo.target': 2,
      'delay.on': 1, 'delay.type': 2, 'delay.time': 0.352, 'delay.depth': 0.35, 'delay.mix': 0.2,
    },
  },
  {
    // FM bells with gently drifting pitch, scattering into shimmer.
    name: 'Drift Bells',
    values: {
      'multi.type': 1, 'multi.vpm': 2, 'multi.shape': 0.4, 'mixer.multi': 0.85,
      'vco1.wave': 1, 'vco1.octave': 2, 'mixer.vco1': 0.25,
      'filter.cutoff': 10000,
      'ampeg.attack': 0.002, 'ampeg.decay': 2.5, 'ampeg.sustain': 0, 'ampeg.release': 2.5,
      'lfo.wave': 4, 'lfo.rate': 0.3, 'lfo.int': 0.012, 'lfo.target': 0,
      'delay.on': 1, 'delay.type': 2, 'delay.time': 0.4, 'delay.depth': 0.4, 'delay.mix': 0.25,
      'reverb.on': 1, 'reverb.type': 5, 'reverb.time': 0.6, 'reverb.depth': 0.5, 'reverb.mix': 0.4,
    },
  },
  {
    // 8-bit game music: pulse waves, a very fast 1/32 arpeggio and the bitcrusher.
    name: 'Chiptune Arp',
    values: {
      'arp.tempo': 140, 'voice.mode': 3, 'voice.depth': 2 / 12, 'arp.latch': 1, 'arp.rate': 5, 'arp.gate': 0.8,
      'vco1.wave': 2, 'vco1.shape': 0.5, 'mixer.vco1': 0.8,
      'vco2.wave': 2, 'vco2.octave': 2, 'vco2.shape': 0.2, 'mixer.vco2': 0.3,
      'filter.cutoff': 12000,
      'ampeg.attack': 0.001, 'ampeg.decay': 0.1, 'ampeg.sustain': 0.8, 'ampeg.release': 0.05,
      'crush.on': 1, 'crush.bits': 5, 'crush.rate': 6, 'crush.mix': 0.9,
      'delay.on': 1, 'delay.type': 2, 'delay.time': 0.214, 'delay.depth': 0.25, 'delay.mix': 0.15,
    },
  },
  {
    // 808-style sub bass: a deep triangle with a quick downward pitch drop at the start
    // and a long decay, lightly saturated by the ladder filter.
    name: '808 Sub',
    values: {
      'vco1.wave': 1, 'vco1.octave': 0, 'mixer.vco1': 1,
      'filter.type': 1, 'filter.cutoff': 900, 'filter.resonance': 0.05, 'filter.drive': 0.3,
      'eg.target': 2, 'eg.attack': 0.001, 'eg.decay': 0.08, 'eg.int': 0.25,
      'ampeg.attack': 0.001, 'ampeg.decay': 1.8, 'ampeg.sustain': 0.25, 'ampeg.release': 0.4,
    },
  },
  {
    // Hollow, phaser-like pad: supersaw through the notch filter, swept by a triangle
    // LFO locked to one bar.
    name: 'Notch Sweep Pad',
    values: {
      'vco1.wave': 3, 'vco1.shape': 0.5, 'mixer.vco1': 0.8,
      'filter.type': 4, 'filter.cutoff': 900, 'filter.resonance': 0.3,
      'lfo.wave': 1, 'lfo.sync': 2, 'lfo.int': 0.45, 'lfo.target': 2,
      'ampeg.attack': 0.5, 'ampeg.decay': 2, 'ampeg.sustain': 0.85, 'ampeg.release': 1.5,
      'reverb.on': 1, 'reverb.type': 0, 'reverb.time': 0.6, 'reverb.mix': 0.35,
    },
  },
  // --- Inspired by Four Tet, "There Is Love in You" (2010) and nearby work -----------
  {
    // "Angel Echoes": a chopped, pitched vocal fragment swimming in echoes. A soft supersaw
    // through the vowel filter ("ah" toward "eh"), a quick vowel move on each note, a synced
    // sample-and-hold LFO for small chopped vowel jumps, tape wobble and long ping-pong echoes.
    name: 'Angel Echoes Vox',
    values: {
      'arp.tempo': 124,
      'vco1.wave': 3, 'vco1.shape': 0.25, 'mixer.vco1': 0.7,
      'vco2.wave': 1, 'vco2.octave': 2, 'mixer.vco2': 0.25,
      'filter.type': 5, 'filter.vowel': 0.1, 'filter.cutoff': 1400, 'filter.resonance': 0.55,
      'eg.target': 0, 'eg.attack': 0.001, 'eg.decay': 0.25, 'eg.int': 0.15,
      'ampeg.attack': 0.01, 'ampeg.decay': 0.5, 'ampeg.sustain': 0.6, 'ampeg.release': 0.35,
      'lfo.wave': 3, 'lfo.sync': 5, 'lfo.int': 0.12, 'lfo.target': 2, 'lfo.keysync': 1,
      'tape.on': 1, 'tape.wow': 0.35, 'tape.flutter': 0.2, 'tape.mix': 1,
      'delay.on': 1, 'delay.type': 2, 'delay.time': 0.363, 'delay.depth': 0.5, 'delay.mix': 0.35, // dotted 1/8 at 124
      'reverb.on': 1, 'reverb.type': 2, 'reverb.time': 0.6, 'reverb.mix': 0.3,
    },
  },
  {
    // "Sing": glassy, slightly metallic plucks. A low-index FM "metal" tone plus a soft
    // triangle and a faint high pulse glint, a quick filter pluck, drifting pitch, ping-pong
    // eighths, tape and a touch of bitcrush grit.
    name: 'Sing Plucks',
    values: {
      'arp.tempo': 124,
      'multi.type': 1, 'multi.vpm': 3, 'multi.shape': 0.22, 'mixer.multi': 0.7,
      'vco1.wave': 1, 'vco1.octave': 2, 'vco1.shape': 0.15, 'mixer.vco1': 0.45,
      'vco2.wave': 2, 'vco2.octave': 3, 'vco2.shape': 0.7, 'mixer.vco2': 0.1,
      'filter.cutoff': 5000, 'filter.keytrack': 2,
      'eg.target': 0, 'eg.attack': 0.001, 'eg.decay': 0.12, 'eg.int': 0.25,
      'ampeg.attack': 0.001, 'ampeg.decay': 0.7, 'ampeg.sustain': 0, 'ampeg.release': 0.6,
      'lfo.wave': 4, 'lfo.rate': 0.4, 'lfo.int': 0.01, 'lfo.target': 0,
      'crush.on': 1, 'crush.bits': 11, 'crush.rate': 2, 'crush.mix': 0.35,
      'tape.on': 1, 'tape.wow': 0.2, 'tape.flutter': 0.15, 'tape.mix': 1,
      'delay.on': 1, 'delay.type': 2, 'delay.time': 0.242, 'delay.depth': 0.4, 'delay.mix': 0.3, // 1/8 at 124
      'reverb.on': 1, 'reverb.type': 1, 'reverb.time': 0.35, 'reverb.mix': 0.25,
    },
  },
  {
    // Gamelan-like bells ("Plastic People"): two triangles ring-modulated at a non-integer
    // ratio for inharmonic, gong-ish partials, plus a soft FM bell, slow beating drift.
    name: 'Plastic People Gamelan',
    values: {
      'vco1.wave': 1, 'vco1.octave': 2, 'mixer.vco1': 0.7,
      'vco2.wave': 1, 'vco2.octave': 3, 'vco2.pitch': 386, 'vco2.ring': 1, 'mixer.vco2': 0.5,
      'multi.type': 1, 'multi.vpm': 2, 'multi.shape': 0.15, 'mixer.multi': 0.4,
      'filter.cutoff': 6000, 'filter.keytrack': 2,
      'ampeg.attack': 0.001, 'ampeg.decay': 1.6, 'ampeg.sustain': 0, 'ampeg.release': 1.4,
      'lfo.wave': 4, 'lfo.rate': 0.5, 'lfo.int': 0.008, 'lfo.target': 0,
      'tape.on': 1, 'tape.wow': 0.15, 'tape.flutter': 0.1, 'tape.mix': 1,
      'reverb.on': 1, 'reverb.type': 2, 'reverb.time': 0.5, 'reverb.mix': 0.3,
    },
  },
  {
    // Hammered dulcimer (in the spirit of "Two Thousand and Seventeen"): a bright folded
    // triangle doubled by a slightly detuned saw like paired strings, a sharp hammer of
    // filter envelope, long natural decay, a little room.
    name: 'Hammered Dulcimer',
    values: {
      'vco1.wave': 1, 'vco1.shape': 0.25, 'mixer.vco1': 0.95,
      'vco2.wave': 0, 'vco2.pitch': 7, 'mixer.vco2': 0.45,
      'filter.cutoff': 1800, 'filter.resonance': 0.15, 'filter.keytrack': 2,
      'eg.target': 0, 'eg.attack': 0.001, 'eg.decay': 0.18, 'eg.int': 0.45,
      'ampeg.attack': 0.001, 'ampeg.decay': 1.4, 'ampeg.sustain': 0, 'ampeg.release': 1.2,
      'delay.on': 1, 'delay.type': 0, 'delay.time': 0.3, 'delay.depth': 0.2, 'delay.mix': 0.15,
      'reverb.on': 1, 'reverb.type': 1, 'reverb.time': 0.45, 'reverb.mix': 0.3,
      'master.volume': 0.95,
    },
  },
  {
    // Warm, round bass ("Love Cry"): triangle plus a soft pulse an octave down through the
    // saturating 24 dB ladder, a gentle filter thump, and tape for warmth.
    name: 'Love Cry Sub',
    values: {
      'vco1.wave': 1, 'vco1.octave': 0, 'mixer.vco1': 0.9,
      'vco2.wave': 2, 'vco2.octave': 0, 'vco2.shape': 0.3, 'mixer.vco2': 0.25,
      'filter.type': 1, 'filter.cutoff': 500, 'filter.resonance': 0.2, 'filter.drive': 0.35,
      'eg.target': 0, 'eg.attack': 0.001, 'eg.decay': 0.25, 'eg.int': 0.2,
      'ampeg.attack': 0.003, 'ampeg.decay': 0.8, 'ampeg.sustain': 0.7, 'ampeg.release': 0.2,
      'tape.on': 1, 'tape.wow': 0.1, 'tape.flutter': 0.05, 'tape.mix': 1,
    },
  },
  {
    name: 'FM Bells',
    values: {
      'mixer.vco1': 0, 'mixer.multi': 0.9, 'multi.type': 1, 'multi.vpm': 2, 'multi.shape': 0.45,
      'filter.cutoff': 12000, 'ampeg.attack': 0.002, 'ampeg.decay': 2.5, 'ampeg.sustain': 0,
      'ampeg.release': 2.5, 'reverb.on': 1, 'reverb.type': 2, 'reverb.time': 0.6, 'reverb.mix': 0.35,
    },
  },
  {
    name: 'Wind Noise',
    values: {
      'mixer.vco1': 0, 'mixer.multi': 1, 'multi.type': 0, 'multi.noise': 2, 'multi.shape': 0.4,
      'lfo.target': 1, 'lfo.wave': 1, 'lfo.rate': 0.15, 'lfo.int': 0.35,
      'filter.cutoff': 6000, 'ampeg.attack': 1.2, 'ampeg.release': 2.5,
      'reverb.on': 1, 'reverb.type': 0, 'reverb.time': 0.8, 'reverb.mix': 0.45,
    },
  },
  {
    name: 'PWM Strings',
    values: {
      'vco1.wave': 2, 'vco2.wave': 2, 'mixer.vco2': 0.7, 'vco2.pitch': -6,
      'lfo.target': 1, 'lfo.rate': 0.7, 'lfo.int': 0.45, 'filter.cutoff': 3200,
      'ampeg.attack': 0.35, 'ampeg.sustain': 0.85, 'ampeg.release': 0.9,
      'mod.on': 1, 'mod.type': 0, 'reverb.on': 1, 'reverb.mix': 0.3,
    },
  },
  {
    name: 'Riser FX',
    values: {
      'vco1.wave': 1, 'vco1.shape': 0.6, 'mixer.multi': 0.3, 'multi.noise': 0,
      'eg.target': 2, 'eg.attack': 4, 'eg.decay': 0.5, 'eg.int': 0.25,
      'filter.cutoff': 600, 'lfo.target': 2, 'lfo.rate': 6, 'lfo.int': 0.3,
      'mod.on': 1, 'mod.type': 3, 'reverb.on': 1, 'reverb.type': 3, 'reverb.mix': 0.5,
    },
  },
];

const KEY = 'synthwork.userPresets';

export function loadUserPresets() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}

export function saveUserPresets(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch { return false; }
}

// Fill in defaults and drop unknown keys, so old preset files keep working.
export function resolvePreset(values) {
  const out = defaultValues();
  for (const [id, v] of Object.entries(values || {})) if (id in PARAMS) out[id] = v;
  return out;
}
