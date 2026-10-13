// Fetch USGS daily values straight from the browser using the Water Data OGC API
// (https://api.waterdata.usgs.gov), which allows cross-origin requests.

const API = 'https://api.waterdata.usgs.gov/ogcapi/v1/collections';

export const DISCHARGE = '00060'; // parameter code: discharge, cubic feet per second
const DAILY_MEAN = '00003';

const siteId = (site) => (site.startsWith('USGS-') ? site : `USGS-${site.trim()}`);

export async function fetchSiteName(site) {
  try {
    const res = await fetch(`${API}/monitoring-locations/items/${siteId(site)}?f=json&skipGeometry=true`);
    if (!res.ok) return null;
    return (await res.json()).properties?.monitoring_location_name ?? null;
  } catch {
    return null;
  }
}

// Returns [{ date: 'YYYY-MM-DD', value: Number | null }] sorted by date.
export async function fetchDaily(site, start, end, parameterCode = DISCHARGE) {
  const params = new URLSearchParams({
    f: 'json',
    monitoring_location_id: siteId(site),
    parameter_code: parameterCode,
    statistic_id: DAILY_MEAN,
    time: `${start}/${end}`,
    properties: 'time,value',
    skipGeometry: 'true',
    sortby: 'time',
    limit: '10000',
  });
  let url = `${API}/daily/items?${params}`;
  const rows = [];
  while (url) { // follow paging links for long date ranges
    const res = await fetch(url);
    if (!res.ok) throw new Error(`USGS request failed (${res.status})`);
    const data = await res.json();
    for (const f of data.features ?? []) {
      const v = f.properties.value;
      rows.push({ date: String(f.properties.time).slice(0, 10), value: v == null ? null : Number(v) });
    }
    url = data.links?.find((l) => l.rel === 'next')?.href ?? null;
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return rows;
}

// Parse a CSV from data_helper/fetch_streamflow.py (date, discharge_cfs, ...)
// or any CSV whose first column is a date and second a number.
export function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const hasHeader = isNaN(Number(header[1]));
  let dateCol = 0, valueCol = 1;
  if (hasHeader) {
    dateCol = Math.max(0, header.findIndex((h) => h.includes('date') || h === 'time'));
    const v = header.findIndex((h) => h.includes('discharge') || h === 'value');
    valueCol = v >= 0 ? v : 1;
  }
  return lines.slice(hasHeader ? 1 : 0).map((line) => {
    const cells = line.split(',');
    const v = Number(cells[valueCol]);
    return { date: cells[dateCol]?.trim().slice(0, 10), value: cells[valueCol] === '' || isNaN(v) ? null : v };
  }).filter((r) => r.date);
}
