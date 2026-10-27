// Find the active USGS stream gauges nearest to a point (from the browser's location or a ZIP code).

const API = 'https://api.waterdata.usgs.gov/ogcapi/v1/collections';
const ACTIVE_DAYS = 120;              // a gauge counts as active if it reported daily flow this recently
const RADII_MILES = [15, 35, 75, 150]; // search wider until enough gauges turn up

// ZIP code -> { lat, lon, place } using the free Zippopotam.us lookup (no key, allows browser requests).
export async function zipToLatLon(zip) {
  const res = await fetch(`https://api.zippopotam.us/us/${encodeURIComponent(zip)}`);
  if (!res.ok) throw new Error(`ZIP code ${zip} wasn't found`);
  const p = (await res.json()).places?.[0];
  if (!p) throw new Error(`ZIP code ${zip} wasn't found`);
  return { lat: +p.latitude, lon: +p.longitude, place: `${p['place name']}, ${p['state abbreviation']}` };
}

// "Lowell, MA", "Lowell MA" or "Lowell, Massachusetts" -> { lat, lon, place } using the free
// Open-Meteo place search (no key, allows browser requests). The state, if given, picks the
// right town among same-named ones; otherwise the best-known match wins.
const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky',
  LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', PR: 'Puerto Rico', RI: 'Rhode Island',
  SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};
const ABBR = Object.fromEntries(Object.entries(STATE_NAMES).map(([a, n]) => [n.toLowerCase(), a]));
export async function placeToLatLon(query) {
  let town = query.trim().replace(/\s+/g, ' ');
  let state = null;
  const parts = town.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1 && (STATE_NAMES[parts.at(-1).toUpperCase()] || ABBR[parts.at(-1).toLowerCase()])) {
    const last = parts.pop();
    state = STATE_NAMES[last.toUpperCase()] ? last.toUpperCase() : ABBR[last.toLowerCase()];
    town = parts.join(', ');
  } else {
    const m = town.match(/^(.+?) ([A-Za-z]{2})$/); // "Lowell MA"
    if (m && STATE_NAMES[m[2].toUpperCase()]) { town = m[1]; state = m[2].toUpperCase(); }
  }
  const params = new URLSearchParams({ name: town, count: '20', language: 'en', format: 'json', countryCode: 'US' });
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  const results = (await res.json()).results ?? [];
  const p = results.find((r) => !state || r.admin1 === STATE_NAMES[state]);
  if (!p) throw new Error(`"${query.trim()}" wasn't found`);
  return { lat: p.latitude, lon: p.longitude, place: `${p.name}, ${ABBR[p.admin1?.toLowerCase()] ?? p.admin1 ?? 'US'}` };
}

export function browserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('This browser has no location access')); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(new Error(err.code === 1 ? 'Location access was blocked' : "Couldn't get your location")),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
    );
  });
}

function miles(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2
    + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(a));
}

// USGS names are all caps with abbreviations ("CACHE LA POUDRE RIV AB BOXELDER CRK NR TIMNATH, CO").
const SMALL = new Set(['at', 'near', 'above', 'below', 'of', 'and', 'the', 'in', 'on', 'to', 'de', 'del']);
const EXPAND = {
  nr: 'near', ab: 'above', abv: 'above', bl: 'below', blw: 'below',
  r: 'River', riv: 'River', cr: 'Creek', crk: 'Creek', ck: 'Creek', trib: 'Tributary', fk: 'Fork',
};
const STATES = new Set(('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY '
  + 'NC ND OH OK OR PA PR RI SC SD TN TX UT VT VA WA WV WI WY').split(' '));
const cap = (w) => w.replace(/(^|[-'(/])([a-z])/g, (m, p, c) => p + c.toUpperCase()).replace(/^Mc([a-z])/, (m, c) => `Mc${c.toUpperCase()}`);
export function prettyName(name) {
  const words = name.replace(/[.,\s]+$/, '').split(/\s+/);
  return words.map((raw, i) => {
    const comma = raw.endsWith(',') ? ',' : '';
    const bare = raw.replace(/[,.]+$/, '');
    const low = bare.toLowerCase();
    if (i === words.length - 1 && STATES.has(bare.toUpperCase()) && i > 1) return bare.toUpperCase();
    if (/^([a-z]\.)+[a-z]?$/.test(raw.toLowerCase().replace(/,$/, ''))) return raw.toUpperCase();
    if (i > 0 && EXPAND[low]) return EXPAND[low] + comma;
    if (i > 0 && SMALL.has(low)) return low + comma;
    return cap(low) + (raw.endsWith('.') && !comma ? '.' : '') + comma;
  }).join(' ').replace(/([^,]) ([A-Z]{2})$/, (m, c, st) => (STATES.has(st) ? `${c}, ${st}` : m));
}

// Daily-discharge series in a box around the point, keeping those still reporting.
async function activeSeries(lat, lon, radius) {
  const dLat = radius / 69, dLon = radius / (69 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const params = new URLSearchParams({
    f: 'json',
    parameter_code: '00060',
    statistic_id: '00003',
    bbox: [lon - dLon, lat - dLat, lon + dLon, lat + dLat].map((v) => v.toFixed(4)).join(','),
    properties: 'monitoring_location_id,end',
    limit: '2000',
  });
  const res = await fetch(`${API}/time-series-metadata/items?${params}`);
  if (!res.ok) throw new Error(`USGS search failed (${res.status})`);
  const cutoff = new Date(Date.now() - ACTIVE_DAYS * 864e5).toISOString();
  const found = new Map();
  for (const f of (await res.json()).features ?? []) {
    const { monitoring_location_id: id, end } = f.properties;
    if (!end || end < cutoff || !f.geometry) continue;
    const [gLon, gLat] = f.geometry.coordinates;
    found.set(id, { id, dist: miles(lat, lon, gLat, gLon) });
  }
  return [...found.values()].filter((g) => g.dist <= radius).sort((a, b) => a.dist - b.dist);
}

// Names and site types; drops canals, ditches, wells and lakes so only streams are offered.
async function describe(ids) {
  const params = new URLSearchParams({
    f: 'json',
    id: ids.join(','),
    properties: 'monitoring_location_name,site_type_code',
    skipGeometry: 'true',
    limit: String(ids.length),
  });
  const res = await fetch(`${API}/monitoring-locations/items?${params}`);
  if (!res.ok) throw new Error(`USGS search failed (${res.status})`);
  const info = new Map();
  for (const f of (await res.json()).features ?? []) info.set(f.id, f.properties);
  return info;
}

// Returns up to `count` gauges: [{ site: '06752260', name, miles }], nearest first.
export async function nearestGauges(lat, lon, count = 5) {
  let picked = [];
  for (const radius of RADII_MILES) {
    const candidates = (await activeSeries(lat, lon, radius)).slice(0, count * 4);
    if (!candidates.length) continue;
    const info = await describe(candidates.map((g) => g.id));
    picked = candidates
      .filter((g) => ['ST', 'ST-TS'].includes(info.get(g.id)?.site_type_code))
      .map((g) => ({
        site: g.id.replace(/^USGS-/, ''),
        name: prettyName(info.get(g.id).monitoring_location_name || g.id),
        miles: g.dist,
      }));
    if (picked.length >= count) break;
  }
  return picked.slice(0, count);
}
