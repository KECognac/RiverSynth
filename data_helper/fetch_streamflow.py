"""Download USGS daily streamflow and save it as a CSV the synth can read later.

Uses the USGS `dataretrieval` package (new Water Data APIs).

Example:
    python data_helper/fetch_streamflow.py --site 01646500 --start 2024-01-01 --end 2024-12-31

Output columns:
    date            YYYY-MM-DD
    discharge_cfs   daily mean discharge (cubic feet per second)
    normalized      discharge rescaled to 0..1 over the period (log scale by default),
                    ready to map onto pitch, cutoff, etc.
"""

import argparse
import math
from pathlib import Path

from dataretrieval import waterdata

DISCHARGE = "00060"  # parameter code: discharge, cubic feet per second
DAILY_MEAN = "00003"  # statistic code: mean


def fetch_daily_discharge(site: str, start: str, end: str):
    site_id = site if site.startswith("USGS-") else f"USGS-{site}"
    df, _ = waterdata.get_daily(
        monitoring_location_id=site_id,
        parameter_code=DISCHARGE,
        statistic_id=DAILY_MEAN,
        time=f"{start}/{end}",
        properties=["time", "value", "unit_of_measure"],
        skip_geometry=True,
    )
    if df.empty:
        raise SystemExit(f"No daily discharge found for {site_id} between {start} and {end}.")
    df = df.rename(columns={"time": "date", "value": "discharge_cfs"})
    df["date"] = df["date"].astype(str).str[:10]
    return df[["date", "discharge_cfs"]].dropna().sort_values("date").reset_index(drop=True)


def normalize(values, log_scale=True):
    # Streamflow is very skewed (floods dwarf base flow), so log scale is the default.
    v = [math.log10(max(x, 0.01)) if log_scale else x for x in values]
    lo, hi = min(v), max(v)
    return [0.5 if hi == lo else (x - lo) / (hi - lo) for x in v]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--site", required=True, help="USGS site number, e.g. 01646500 (Potomac River near DC)")
    ap.add_argument("--start", required=True, help="start date YYYY-MM-DD")
    ap.add_argument("--end", required=True, help="end date YYYY-MM-DD")
    ap.add_argument("--out", help="output CSV path (default: data/<site>_<start>_<end>.csv)")
    ap.add_argument("--linear", action="store_true", help="normalize on a linear instead of log scale")
    args = ap.parse_args()

    df = fetch_daily_discharge(args.site, args.start, args.end)
    df["normalized"] = [round(x, 4) for x in normalize(df["discharge_cfs"], log_scale=not args.linear)]

    out = Path(args.out or f"data/{args.site.removeprefix('USGS-')}_{args.start}_{args.end}.csv")
    out.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out, index=False)
    print(f"Saved {len(df)} days to {out} "
          f"(discharge {df['discharge_cfs'].min():g}–{df['discharge_cfs'].max():g} cfs)")


if __name__ == "__main__":
    main()
