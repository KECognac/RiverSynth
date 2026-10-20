// River presets: a sound, the note mapping and speed, the Data -> Sound routes, and
// optionally a gauge and dates, saved together so a whole sonification can be recalled.
//
// Factory presets refer to a factory program by name (plus optional overrides), or carry
// their own sound in `values` (settings that differ from the defaults).
// User presets store the full sound, and live in this browser's localStorage.
// Low/High must be C notes (the menus list C1-C8).
// The first preset is the one the app opens with.

export const RIVER_FACTORY = [
  {
    // A Native American-style flute over Sierra snowmelt (Merced River, Yosemite): Canyon
    // Flute in F# minor pentatonic, kept low (C3-C5), playing soft triads in breathing 1/8
    // phrases with repeated days held as long tones, in a hall. Brisk 1/16 steps at 132 BPM
    // so several years can be heard back to back. Flow opens the tone, fast changes
    // build the canyon echo, stormy weeks deepen the vibrato, wet years get more space.
    name: 'Snowmelt Flute',
    program: 'Canyon Flute',
    // Quicker breath and release so the flute still speaks at 1/16 (about 40 s a year).
    values: { 'ampeg.attack': 0.05, 'ampeg.release': 0.3, 'reverb.type': 0, 'reverb.time': 0.7, 'reverb.mix': 0.35, 'master.volume': 0.95 },
    gauge: { site: '11264500', start: '2024-01-01', end: '2024-12-31' },
    settings: { scale: 'Minor pentatonic', root: 6, low: 48, high: 72, log: true, bpm: 132, rate: '1/16', gate: 0.95, tie: true, voicing: 'triad', spread: 'even', roar: false, roarLevel: 0.35 },
    layer: { on: true, program: 'Bowed Cello', level: 0.4, octave: -12, every: 4, voicing: 'single' },
    routes: [
      { id: 'filter.cutoff', source: 'flow', from: 0.5, to: 0.75 },
      { id: 'delay.depth', source: 'change', from: 0.2, to: 0.5 },
      { id: 'lfo.int', source: 'turbulence', from: 0.505, to: 0.52 },
      { id: 'reverb.mix', source: 'anomaly', from: 0.2, to: 0.5 },
    ],
  },
  {
    // Arizona western: twangy tremolo guitar arpeggios in E minor (Em, G, Am, Bm, C, D: the
    // minor desert-ballad sound of westerns) on the Verde River, with a lap steel sliding an octave
    // up every 4 days. Monsoon floods brighten the twang and stretch the echoes; stormy weeks
    // deepen the tremolo; wet stretches drench the spring reverb.
    name: 'Desert Twang',
    program: 'Twang Guitar',
    values: { 'voice.mode': 3, 'voice.depth': 6 / 12, 'arp.latch': 0, 'arp.rate': 3, 'arp.gate': 0.8, 'arp.tempo': 90 },
    gauge: { site: '09506000', start: '2024-01-01', end: '2024-12-31' },
    settings: { scale: 'Natural minor', root: 4, low: 36, high: 60, bpm: 90, rate: '1/16', gate: 1, tie: false, voicing: 'triad', spread: 'even', log: true, roar: false, roarLevel: 0.3 },
    layer: { on: true, program: 'Slide Guitar', level: 0.3, octave: 12, every: 4, voicing: 'single' },
    routes: [
      { id: 'filter.cutoff', source: 'flow', from: 0.45, to: 0.8 },
      { id: 'delay.depth', source: 'change', from: 0.25, to: 0.55 },
      { id: 'pump.depth', source: 'turbulence', from: 0.25, to: 0.55 },
      { id: 'reverb.mix', source: 'anomaly', from: 0.3, to: 0.55 },
    ],
  },
  {
    // Grimes "Genesis"-style arpeggios from a flashy river: each day gives the arpeggiator a
    // triad from the scale, and Rise Fall over 2 octaves sweeps it up and down (about two and
    // a half octaves) in flowing 1/16s that carry on from day to day. Grandmother Bass sound
    // with a hall reverb and dotted-eighth echoes. Flow opens the filter, stormy weeks add
    // squelch, flash floods build echoes, wetter-than-normal stretches get more space.
    name: 'Flash Flood Pump',
    program: 'Grandmother Bass',
    values: {
      'voice.mode': 3, 'voice.depth': 7 / 12, 'arp.latch': 0, 'arp.rate': 3, 'arp.gate': 0.55, 'arp.tempo': 100,
      'ampeg.release': 0.25,
      'delay.on': 1, 'delay.type': 2, 'delay.time': 0.45, 'delay.depth': 0.45, 'delay.mix': 0.3, // dotted 1/8 at 100
      'reverb.on': 1, 'reverb.type': 0, 'reverb.time': 0.7, 'reverb.depth': 0.55, 'reverb.mix': 0.35,
    },
    gauge: { site: '16704000', start: '2024-01-01', end: '2024-12-31' },
    settings: { scale: 'Natural minor', root: 2, low: 36, high: 60, bpm: 100, rate: '1/4', gate: 1, tie: false, voicing: 'triad', spread: 'even', log: true, roar: false, roarLevel: 0.4 },
    layer: { on: true, program: 'Choir Pad', level: 0.3, octave: 24, every: 1, voicing: 'triad' },
    routes: [
      { id: 'filter.cutoff', source: 'flow', from: 0.45, to: 0.85 },
      { id: 'filter.resonance', source: 'turbulence', from: 0.2, to: 0.55 },
      { id: 'delay.depth', source: 'change', from: 0.3, to: 0.6 },
      { id: 'reverb.mix', source: 'anomaly', from: 0.2, to: 0.45 },
    ],
  },
  {
    // Your saved version (from "New Lo-Fi Creek"), softened: the melody settings are unchanged,
    // but the oscillators run cooler, the harsh Fold distortion is swapped for a little warm
    // tube and tape warble, and the echoes sit back, so it no longer slams the limiter.
    name: 'Lo-Fi Creek',
    values: {
      'vco1.wave': 1, 'vco2.wave': 1, 'multi.type': 1, 'multi.shape': 0.1907,
      'mixer.vco1': 0.35, 'mixer.vco2': 0.55, 'mixer.multi': 0.45, 'filter.cutoff': 1300,
      'filter.resonance': 0.1016, 'filter.drive': 0.1, 'ampeg.attack': 0.007689, 'ampeg.decay': 1.5,
      'ampeg.sustain': 0.3, 'ampeg.release': 0.5, 'lfo.wave': 4, 'lfo.rate': 0.6259,
      'lfo.int': -0.01463, 'voice.depth': 0.09214, 'mod.on': 1, 'mod.mix': 0.3,
      'delay.on': 1, 'delay.time': 0.7325, 'delay.depth': 0.32, 'delay.mix': 0.3,
      'reverb.on': 1, 'reverb.type': 5, 'reverb.time': 0.3, 'reverb.mix': 0.25,
      'crush.bits': 4.063, 'crush.rate': 2.96, 'crush.mix': 0.6,
      'dist.on': 1, 'dist.type': 0, 'dist.amount': 0.2, 'dist.mix': 0.35,
      'tape.on': 1, 'tape.wow': 0.15, 'tape.flutter': 0.08, 'tape.mix': 1,
      'master.volume': 0.5,
    },
    gauge: { site: '01474000', start: '2024-01-01', end: '2024-12-31' },
    settings: { scale: 'Major', root: 5, low: 48, high: 72, log: true, bpm: 100, rate: '1/16', gate: 0.7, tie: true, loop: true, spread: 'even', roar: true, roarLevel: 0.3 },
    layer: { on: true, program: 'Drone Bass', level: 0.25, octave: 0, every: 1, voicing: 'single' },
    routes: [
      { id: 'reverb.mix', source: 'flow', from: 0.1903, to: 0.5903 },
      { id: 'lfo.int', source: 'anomaly', from: 0.64, to: 1 },
    ],
  },
  {
    // Headwaters: the Cache la Poudre, from the snowfields of Rocky Mountain National Park down
    // to Fort Collins, heard as a basin filling and emptying. Soft, muted mallets flow up and
    // down through each day's D major chord (2 octaves, one note a day, carrying on from chord
    // to chord) in a mountain hall. Proportional note spread lets the melody sit low all winter,
    // climb through the snowmelt runoff and drain back down. The 30-day trend is the water level:
    // as it rises, notes lengthen until they overlap and pool, echoes pile up and the hall grows;
    // as it falls, the sound thins back to short, dry drips (and quieter). Daily flow ripples the brightness on
    // top. An alpine horn swells slowly every 8 days (layer 2), a rising and falling bed.
    name: 'Headwaters',
    program: 'Whitewater Plucks',
    values: {
      'voice.mode': 3, 'voice.depth': 7 / 12, 'arp.latch': 0, 'arp.rate': 3, 'arp.gate': 0.5, 'arp.tempo': 124,
      'multi.vpm': 2, 'multi.shape': 0.2, 'ampeg.decay': 0.9, 'ampeg.release': 0.6,
      'delay.mix': 0.22,
      'reverb.type': 0, 'reverb.time': 0.6, 'reverb.mix': 0.3,
    },
    gauge: { site: '06752260', start: '2024-01-01', end: '2024-12-31' },
    settings: { scale: 'Major', root: 2, low: 36, high: 60, bpm: 124, rate: '1/16', gate: 1, tie: false, voicing: 'triad', spread: 'proportional', log: true, roar: false, roarLevel: 0.3 },
    layer: { on: true, program: 'Alpine Horn', level: 0.45, octave: 0, every: 8, voicing: 'triad' },
    routes: [
      { id: 'arp.gate', source: 'trend', from: 0.15, to: 0.95 },
      { id: 'delay.depth', source: 'trend', from: 0.1, to: 0.65 },
      { id: 'reverb.mix', source: 'trend', from: 0.12, to: 0.5 },
      { id: 'master.volume', source: 'trend', from: 0.55, to: 1 },
      { id: 'filter.cutoff', source: 'flow', from: 0.4, to: 0.8 },
    ],
  },
  {
    // Drip Flow: drips on a flashy western creek (Carpinteria Creek, near Santa Barbara:
    // nearly dry for months, then winter floods). Each day is a water drop that chirps into
    // pitch and scatters in ping-pong rebounds before the next one lands, in F major
    // pentatonic, over a soft, slow pad an octave down (layer 2). Floods make the drops
    // brighter and bounce longer, stormy weeks shake the tape, wet stretches add reverb.
    name: 'Drip Flow',
    program: 'Water Drop',
    gauge: { site: '11119500', start: '2024-01-01', end: '2024-12-31' },
    settings: { scale: 'Major pentatonic', root: 5, low: 60, high: 84, bpm: 100, rate: '1/16', gate: 0.3, tie: true, voicing: 'single', spread: 'even', log: true, roar: true, roarLevel: 0.2 },
    layer: { on: true, program: 'River Pad', level: 0.2, octave: -12, every: 8, voicing: 'single' },
    routes: [
      { id: 'delay.depth', source: 'flow', from: 0.5, to: 0.8 },
      { id: 'filter.cutoff', source: 'flow', from: 0.55, to: 0.85 },
      { id: 'tape.flutter', source: 'turbulence', from: 0.1, to: 0.6 },
      { id: 'reverb.mix', source: 'anomaly', from: 0.15, to: 0.45 },
    ],
  },
  {
    // Your saved version (from "New Glacier Bells"), made gentler: both oscillators an octave
    // lower (the top bell partial used to ring near 6 kHz), the upper partial quieter, a softer
    // strike, a darker filter that follows the keys and a warmer plate.
    name: 'Glacier Bells',
    values: {
      'vco1.wave': 1, 'vco1.octave': 1, 'vco1.shape': 0.08, 'vco2.wave': 1,
      'vco2.octave': 2, 'vco2.pitch': 557, 'mixer.vco1': 0.95, 'mixer.vco2': 0.28,
      'filter.cutoff': 3200, 'filter.resonance': 0, 'filter.keytrack': 1, 'ampeg.attack': 0.004,
      'ampeg.decay': 2.2, 'ampeg.sustain': 0, 'ampeg.release': 10, 'eg.attack': 0.001,
      'eg.decay': 0.04, 'eg.int': 0.15, 'arp.tempo': 40, 'reverb.on': 1,
      'reverb.type': 2, 'reverb.time': 0.45, 'reverb.depth': 0.45, 'reverb.mix': 0.28,
      'master.volume': 0.75,
    },
    gauge: { site: '06752260', start: '2024-01-01', end: '2024-12-31' },
    settings: { scale: 'Minor pentatonic', root: 9, low: 60, high: 84, log: true, bpm: 120, rate: '1/16', gate: 0.5, tie: true, loop: true, spread: 'even', roar: false, roarLevel: 0.45 },
    routes: [
      { id: 'filter.cutoff', source: 'flow', from: 0.5, to: 0.72 },
      { id: 'reverb.mix', source: 'anomaly', from: 0.1, to: 0.55 },
    ],
  },
  {
    // Your saved version (from "New Drought Watch").
    name: 'Drought Watch',
    values: {
      'vco1.wave': 3, 'vco1.pitch': 9.198, 'vco2.wave': 1, 'vco2.octave': 2,
      'vco2.pitch': -9, 'vco2.sync': 1, 'multi.type': 1, 'multi.vpm': 1,
      'multi.shape': 0.05, 'mixer.vco1': 0.7, 'mixer.vco2': 0.3464, 'mixer.multi': 0.25,
      'filter.cutoff': 900, 'filter.resonance': 0.45, 'filter.drive': 0.25, 'ampeg.attack': 0.6,
      'ampeg.decay': 2, 'ampeg.sustain': 0.85, 'ampeg.release': 2.2, 'eg.attack': 1.2,
      'eg.decay': 2.5, 'eg.int': 0.3, 'lfo.rate': 0.12, 'lfo.int': 0.3,
      'voice.depth': 0.25, 'voice.glide': 0.07548, 'mod.on': 1, 'mod.type': 2,
      'mod.time': 0.15, 'mod.depth': 0.6, 'mod.mix': 0.35, 'delay.on': 1,
      'delay.type': 1, 'delay.time': 0.45, 'delay.depth': 0.45, 'delay.mix': 0.25,
      'reverb.on': 1, 'reverb.type': 5, 'reverb.time': 0.7, 'reverb.mix': 0.288,
    },
    gauge: { site: '06752260', start: '2024-01-01', end: '2024-12-31' },
    settings: { scale: 'Minor pentatonic', root: 2, low: 36, high: 60, log: true, bpm: 80, rate: '1/32', gate: 0.9, tie: true, loop: true, spread: 'even', roar: true, roarLevel: 0.4 },
    routes: [
      { id: 'vco1.shape', source: 'anomaly', from: 0, to: 1 },
      { id: 'filter.cutoff', source: 'anomaly', from: 0, to: 1 },
      { id: 'lfo.int', source: 'turbulence', from: 0, to: 1 },
    ],
  },
  {
    // Ice crystals: sparkling FM bells in a minor pentatonic, scattering into echoes and
    // shimmer. Flow brightens them, sudden changes (the spring breakup) build the echoes,
    // and the river roar rumbles underneath.
    name: 'Arctic Breakup',
    program: 'Drift Bells',
    gauge: { site: '15565447', start: '2024-01-01', end: '2024-12-31' },
    settings: { scale: 'Minor pentatonic', root: 2, low: 60, high: 96, bpm: 110, rate: '1/16', gate: 0.4, tie: false, spread: 'even', log: true, roar: true, roarLevel: 0.45 },
    routes: [
      { id: 'filter.cutoff', source: 'flow', from: 0.45, to: 0.95 },
      { id: 'delay.depth', source: 'change', from: 0.15, to: 0.6 },
      { id: 'reverb.mix', source: 'anomaly', from: 0.2, to: 0.55 },
    ],
  },
  // --- Compare: natural vs regulated ---------------------------------------------------
  // The same gauge (Colorado River at Lees Ferry, AZ) before and after Glen Canyon Dam
  // closed in 1963. Both use one fixed cfs-to-pitch scale, key, range and tempo, so the
  // difference you hear is the river's: the wild year sweeps three octaves up to a June
  // snowmelt flood; the regulated year hovers on a few notes and peaks in August.
  {
    // Wild: a breathing flute over a bowed cello, gliding between notes, the filter opening
    // with the flood, the river roar swelling into a rush, stormy weeks opening the space.
    name: 'Wild Colorado · 1957',
    group: 'Compare: natural vs regulated',
    note: 'Before Glen Canyon Dam: the June snowmelt flood peaked at 124,000 cfs, 38 times the low flow.',
    program: 'Canyon Flute',
    values: { 'voice.glide': 0.1, 'master.volume': 0.95 },
    gauge: { site: '09380000', start: '1957-01-01', end: '1957-12-31' },
    settings: { scale: 'Major pentatonic', root: 2, low: 48, high: 84, log: true, bpm: 110, rate: '1/16', gate: 0.9, tie: true, loop: false, voicing: 'single', spread: 'fixed', fixedLow: 2000, fixedHigh: 130000, roar: true, roarLevel: 0.55 },
    layer: { on: true, program: 'Bowed Cello', level: 0.35, octave: -12, every: 4, voicing: 'single' },
    routes: [
      { id: 'filter.cutoff', source: 'flow', from: 0.35, to: 0.85 },
      { id: 'reverb.mix', source: 'turbulence', from: 0.2, to: 0.5 },
      { id: 'delay.depth', source: 'change', from: 0.15, to: 0.5 },
    ],
  },
  {
    // Regulated: a hard-edged pulse wave with no glide (changes land as steps, like gate
    // operations), a steady sidechain pump and a low drone for the turbines, a little bit
    // crush, a small dry room and no river roar (the dam traps the sediment; the water runs
    // clear and cold). Day-to-day changes in release flick the filter like a switch.
    name: 'Engineered Colorado · 2024',
    group: 'Compare: natural vs regulated',
    note: 'After the dam: flow barely changes all year (1.8 times the low flow), and peaks in August with power demand.',
    values: {
      'vco1.wave': 2, 'vco1.shape': 0.25, 'mixer.vco1': 0.7,
      'vco2.wave': 2, 'vco2.octave': 0, 'vco2.shape': 0.5, 'mixer.vco2': 0.35,
      'filter.type': 1, 'filter.cutoff': 1400, 'filter.resonance': 0.3, 'filter.drive': 0.15,
      'ampeg.attack': 0.002, 'ampeg.decay': 0.3, 'ampeg.sustain': 0.8, 'ampeg.release': 0.04,
      'lfo.int': 0, 'voice.glide': 0,
      'pump.on': 1, 'pump.rate': 2, 'pump.depth': 0.45, 'pump.release': 0.35, 'arp.tempo': 110,
      'crush.on': 1, 'crush.bits': 10, 'crush.rate': 3, 'crush.mix': 0.35,
      'mod.on': 0, 'delay.on': 0, 'tape.on': 0,
      'reverb.on': 1, 'reverb.type': 1, 'reverb.time': 0.25, 'reverb.mix': 0.12,
      'master.volume': 0.45, // the steady tone reads louder than the wild year's quiet low flows
    },
    gauge: { site: '09380000', start: '2024-01-01', end: '2024-12-31' },
    settings: { scale: 'Major pentatonic', root: 2, low: 48, high: 84, log: true, bpm: 110, rate: '1/16', gate: 0.9, tie: true, loop: false, voicing: 'single', spread: 'fixed', fixedLow: 2000, fixedHigh: 130000, roar: false, roarLevel: 0.55 },
    layer: { on: true, program: 'Drone Bass', level: 0.28, octave: -12, every: 16, voicing: 'single' },
    routes: [
      { id: 'filter.cutoff', source: 'change', from: 0.4, to: 0.65 },
    ],
  },
  // --- Floods & droughts --------------------------------------------------------------
  // Linear (not log) flow scales, so ordinary days sit near the bottom and only big water
  // climbs: the floods tower over everything. Each day's chord is arpeggiated, so quiet
  // stretches are gentle picking on a low chord rather than one stuck note.
  {
    // Five years (2011–2015) on the Big Thompson at Loveland, one step per week using each
    // week's peak day (it was a flash flood). Hammered-dulcimer arpeggios (a Rocky Mountain
    // folk sound) pick on a low C Dorian chord, rise a little with each spring's snowmelt, then
    // in September 2013 leap up four octaves: the dulcimer tears into distortion, resonance
    // builds on the rise, the volume surges and the river roar comes up from silence. A low
    // drone rumbles underneath.
    name: 'Big Thompson Flood · 2013',
    group: 'Floods & droughts',
    note: '2011–2015, one step per week (each week\'s peak day). Sept 13, 2013: 7,200 cfs at Loveland, almost 4 times the next-biggest peak in these 5 years (1,940 cfs in 2015), on a river that usually runs under 60 cfs.',
    program: 'Hammered Dulcimer',
    values: {
      'voice.mode': 3, 'voice.depth': 6 / 12, 'arp.latch': 0, 'arp.rate': 3, 'arp.gate': 0.7, 'arp.tempo': 132,
      'dist.on': 1, 'dist.type': 0, 'dist.amount': 0, 'dist.mix': 0.4, 'master.volume': 0.8,
    },
    gauge: { site: '06741510', start: '2011-01-01', end: '2015-12-31' },
    settings: { scale: 'Dorian', root: 0, low: 36, high: 84, log: false, bpm: 132, rate: '1/16', gate: 1, tie: false, loop: false, voicing: 'triad', spread: 'proportional', daysPerStep: 7, combine: 'max', roar: true, roarLevel: 0.55 },
    layer: { on: true, program: 'Drone Bass', level: 0.1, octave: -12, every: 4, voicing: 'single' },
    // The flood is only a few weekly steps long, so the loudness, grit, ringing notes and
    // echoes follow Surge: they jump with the flood and drain slowly over a couple of seconds.
    routes: [
      { id: 'filter.cutoff', source: 'flow', from: 0.4, to: 0.95 },
      { id: 'dist.amount', source: 'surge', from: 0, to: 0.6 },
      { id: 'ampeg.release', source: 'surge', from: 0.68, to: 0.93 },
      { id: 'delay.depth', source: 'surge', from: 0.2, to: 0.75 },
      { id: 'master.volume', source: 'surge', from: 0.4, to: 1 },
    ],
  },
  {
    // Five years (2015–2019) on Brays Bayou in Houston, one step per week using each week's
    // average flow (Harvey's flood lasted for days; starting Jan 2 keeps Aug 25–31, 2017 in
    // one week). The Lo-Fi Keys program as it is (poly chords, held while the chord repeats)
    // in C major pentatonic, C3–C5, over a deep 808 sub (layer 2). Houston's other floods nudge the chords up; Harvey sends them leaping, with the
    // echoes building, the bitcrush grit rising and the volume swelling.
    name: 'Hurricane Harvey · 2017',
    group: 'Floods & droughts',
    note: '2015–2019, one step per week (weekly average). Harvey\'s week, Aug 25–31, 2017, averaged 11,900 cfs on Brays Bayou, about 3½ times the next-biggest week here (Memorial Day 2015, 3,350 cfs), on a bayou that usually runs about 140 cfs.',
    program: 'Lo-Fi Keys',
    gauge: { site: '08075000', start: '2015-01-02', end: '2019-12-31' },
    settings: { scale: 'Major pentatonic', root: 0, low: 48, high: 72, log: false, bpm: 100, rate: '1/16', gate: 0.9, tie: true, loop: false, voicing: 'triad', spread: 'proportional', daysPerStep: 7, combine: 'mean', roar: false, roarLevel: 0.5 },
    layer: { on: true, program: '808 Sub', level: 0.45, octave: -12, every: 2, voicing: 'single' },
    // Harvey is only a few weekly steps long, so the loudness, grit, ringing chords and
    // echoes follow Surge: they jump with the flood and drain slowly over a couple of seconds.
    routes: [
      { id: 'delay.depth', source: 'surge', from: 0.3, to: 0.75 },
      { id: 'crush.mix', source: 'surge', from: 0.6, to: 0.85 },
      { id: 'ampeg.release', source: 'surge', from: 0.67, to: 0.92 },
      { id: 'master.volume', source: 'surge', from: 0.4, to: 0.85 },
      { id: 'filter.cutoff', source: 'flow', from: 0.6, to: 0.85 },
    ],
  },
  // The Cache la Poudre just below Fort Collins and its diversions, played with the Headwaters
  // sound, April to October, in the 2002 drought and the big 2023 snowmelt year. Both use one linear 0–2,500 cfs
  // scale (in C, so the low resting chord is the home chord), and the basin controls (note
  // length, echoes, hall, volume) follow that same flow scale instead of each year's own range,
  // so the drought stays an empty basin and the wet year fills it. Days under 2 cfs rest.
  {
    name: 'Poudre Drought · 2002',
    group: 'Floods & droughts',
    note: 'April–September 2002, in the drought, below Fort Collins\' diversions: typically just 2.6 cfs, down to 0.03 cfs on Aug 12. Silent steps are days under 2 cfs.',
    program: 'Whitewater Plucks',
    values: {
      'voice.mode': 3, 'voice.depth': 7 / 12, 'arp.latch': 0, 'arp.rate': 3, 'arp.gate': 0.5, 'arp.tempo': 124,
      'multi.vpm': 2, 'multi.shape': 0.2, 'ampeg.decay': 0.9, 'ampeg.release': 0.6,
      'delay.mix': 0.22,
      'reverb.type': 0, 'reverb.time': 0.6, 'reverb.mix': 0.3,
    },
    gauge: { site: '06752280', start: '2002-04-01', end: '2002-10-01' },
    settings: { scale: 'Major', root: 0, low: 36, high: 72, bpm: 124, rate: '1/16', gate: 1, tie: false, loop: false, voicing: 'triad', spread: 'fixed', log: false, fixedLow: 0, fixedHigh: 2500, restBelow: 2, roar: false, roarLevel: 0.3 },
    layer: { on: true, program: 'Alpine Horn', level: 0.45, octave: 0, every: 8, voicing: 'triad' },
    routes: [
      { id: 'arp.gate', source: 'flow', from: 0.15, to: 0.95 },
      { id: 'delay.depth', source: 'flow', from: 0.1, to: 0.65 },
      { id: 'reverb.mix', source: 'flow', from: 0.12, to: 0.5 },
      { id: 'master.volume', source: 'flow', from: 0.7, to: 1 },
      { id: 'filter.cutoff', source: 'flow', from: 0.4, to: 0.8 },
    ],
  },
  {
    name: 'Poudre Wet Year · 2023',
    group: 'Floods & droughts',
    note: 'The same gauge and months in 2023, a big snowmelt year: typically 89 cfs, peaking at 2,220 cfs in June.',
    program: 'Whitewater Plucks',
    values: {
      'voice.mode': 3, 'voice.depth': 7 / 12, 'arp.latch': 0, 'arp.rate': 3, 'arp.gate': 0.5, 'arp.tempo': 124,
      'multi.vpm': 2, 'multi.shape': 0.2, 'ampeg.decay': 0.9, 'ampeg.release': 0.6,
      'delay.mix': 0.22,
      'reverb.type': 0, 'reverb.time': 0.6, 'reverb.mix': 0.3,
    },
    gauge: { site: '06752280', start: '2023-04-01', end: '2023-10-01' },
    settings: { scale: 'Major', root: 0, low: 36, high: 72, bpm: 124, rate: '1/16', gate: 1, tie: false, loop: false, voicing: 'triad', spread: 'fixed', log: false, fixedLow: 0, fixedHigh: 2500, restBelow: 2, roar: false, roarLevel: 0.3 },
    layer: { on: true, program: 'Alpine Horn', level: 0.45, octave: 0, every: 8, voicing: 'triad' },
    routes: [
      { id: 'arp.gate', source: 'flow', from: 0.15, to: 0.95 },
      { id: 'delay.depth', source: 'flow', from: 0.1, to: 0.65 },
      { id: 'reverb.mix', source: 'flow', from: 0.12, to: 0.5 },
      { id: 'master.volume', source: 'flow', from: 0.7, to: 1 },
      { id: 'filter.cutoff', source: 'flow', from: 0.4, to: 0.8 },
    ],
  },
];

const KEY = 'synthwork.riverPresets';

export function loadRiverPresets() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}

export function saveRiverPresets(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch { return false; }
}
