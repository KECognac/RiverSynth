// Signals derived from one daily series, so different parts of the sound can follow
// different aspects of the river instead of all moving in lockstep.
// Every source is an array of 0..1 values (or null where data is missing).

export const SOURCES = {
  flow:       { label: 'Flow',                low: 'Low flow',          high: 'High flow' },
  change:     { label: 'Change',              low: 'Falling',           high: 'Rising' },
  anomaly:    { label: 'Anomaly vs normal',   low: 'Drier than normal', high: 'Wetter than normal' },
  trend:      { label: 'Trend (30-day)',      low: 'Low trend',         high: 'High trend' },
  turbulence: { label: 'Turbulence (7-day)',  low: 'Calm',              high: 'Turbulent' },
};

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];
const present = (arr) => arr.filter((v) => v != null);

// Plain min-max scaling.
function minmax(arr) {
  const p = present(arr);
  const lo = Math.min(...p), hi = Math.max(...p);
  return arr.map((v) => (v == null ? null : hi > lo ? (v - lo) / (hi - lo) : 0.5));
}

// Min-max between the 2nd and 98th percentiles, so one extreme day doesn't flatten the rest.
function robust(arr) {
  const s = present(arr).sort((a, b) => a - b);
  if (!s.length) return arr.map(() => null);
  const lo = percentile(s, 0.02), hi = percentile(s, 0.98);
  return arr.map((v) => (v == null ? null : hi > lo ? Math.min(1, Math.max(0, (v - lo) / (hi - lo))) : 0.5));
}

// Signed values around zero -> 0..1 with 0.5 meaning "no change" / "normal".
function symmetric(arr) {
  const s = present(arr).map(Math.abs).sort((a, b) => a - b);
  const scale = s.length ? percentile(s, 0.95) || 1 : 1;
  return arr.map((v) => (v == null ? null : 0.5 + 0.5 * Math.min(1, Math.max(-1, v / scale))));
}

// Rank-based scaling: every value gets an equal share of 0..1 (ties share a rank).
export function evenSpread(arr) {
  const idx = arr.map((v, i) => [v, i]).filter(([v]) => v != null).sort((a, b) => a[0] - b[0]);
  const out = arr.map(() => null);
  const n = idx.length;
  for (let i = 0; i < n;) {
    let j = i;
    while (j + 1 < n && idx[j + 1][0] === idx[i][0]) j++;
    const t = n > 1 ? ((i + j) / 2) / (n - 1) : 0.5;
    for (let k = i; k <= j; k++) out[idx[k][1]] = t;
    i = j + 1;
  }
  return out;
}

// Day of year 0..364 on a non-leap calendar (Feb 29 counts as Feb 28).
const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
function dayOfYear(date) {
  const m = Number(date.slice(5, 7)), d = Number(date.slice(8, 10));
  return MONTH_START[m - 1] + Math.min(d, m === 2 ? 28 : 31) - 1;
}

// Median raw value for each day of the year, using a +/-7 day window across all years.
export function dailyNormals(history) {
  const buckets = Array.from({ length: 365 }, () => []);
  for (const r of history) if (r.value != null) buckets[dayOfYear(r.date)].push(r.value);
  const years = new Set(history.map((r) => r.date.slice(0, 4)));
  if (years.size < 3) return null;
  return buckets.map((_, doy) => {
    const vals = [];
    for (let k = -7; k <= 7; k++) vals.push(...buckets[(doy + k + 365) % 365]);
    vals.sort((a, b) => a - b);
    return vals.length ? vals[Math.floor(vals.length / 2)] : null;
  });
}

function trailing(arr, n, fn) {
  return arr.map((v, i) => {
    if (v == null) return null;
    const win = present(arr.slice(Math.max(0, i - n + 1), i + 1));
    return win.length ? fn(win) : null;
  });
}
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const std = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };

// rows: the series being played; history: a long record from the same gauge (optional).
export function computeSources(rows, { log = true, history = null } = {}) {
  const tr = (x) => (log ? Math.log10(Math.max(x, 0.01)) : x);
  const x = rows.map((r) => (r.value == null ? null : tr(r.value)));
  const diff = x.map((v, i) => (i === 0 ? (v == null ? null : 0) : v == null || x[i - 1] == null ? null : v - x[i - 1]));

  const normalsByDoy = dailyNormals(history?.length ? history : rows);
  const normal = rows.map((r) => (normalsByDoy ? normalsByDoy[dayOfYear(r.date)] : null));
  const anomalyRaw = x.map((v, i) => (v == null || normal[i] == null ? null : v - tr(normal[i])));

  return {
    flow: minmax(x),
    change: symmetric(diff),
    anomaly: normalsByDoy ? symmetric(anomalyRaw) : rows.map(() => 0.5),
    trend: robust(trailing(x, 30, mean)),
    turbulence: robust(trailing(diff, 7, std)),
    normal, // median raw value for each row's date (for the chart and readout)
    anomalyAvailable: !!normalsByDoy,
  };
}
