"""seed.py — fetch the 5 keyless sources, normalise via parsers.py, write per-corpus artifacts.

Glue by design (NOT unit-tested — proven by real Action runs; the pure logic lives in parsers.py).
Stdlib-only so CI installs nothing. Exits non-zero if ANY source fails or lands under its floor,
so a broken upstream fails the Action loudly instead of publishing a stub artifact — the Worker
cron's swap gate is the second, independent line of defence.

Usage: python ingest/seed.py --out dist
"""

import argparse
import io
import json
import re
import sqlite3
import sys
import tempfile
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from parsers import (
    attach_coords,
    parse_cqc_directory,
    parse_fhrs,
    parse_greenspace,
    parse_nhle,
    parse_postcodes,
)

UA = "sortmy-london-ingest/1.0 (https://github.com/qte77/ldnmxx-hack)"

NHLE_QUERY = (
    "https://services-eu1.arcgis.com/ZOdPfBS3aqqDYPUQ/ArcGIS/rest/services/"
    "National_Heritage_List_for_England_NHLE_v02_VIEW/FeatureServer/0/query"
)
OS_DOWNLOADS = "https://api.os.uk/downloads/v1/products/OpenGreenspace"
CQC_DATA_PAGE = "https://www.cqc.org.uk/about-us/transparency/using-cqc-data"
FHRS_BASE = "https://api.ratings.food.gov.uk"
POSTCODES_BULK = "https://api.postcodes.io/postcodes"

LONDON_AUTHORITIES = frozenset(
    {
        "Barking and Dagenham", "Barnet", "Bexley", "Brent", "Bromley", "Camden", "City of London",
        "Croydon", "Ealing", "Enfield", "Greenwich", "Hackney", "Hammersmith and Fulham", "Haringey",
        "Harrow", "Havering", "Hillingdon", "Hounslow", "Islington", "Kensington and Chelsea",
        "Kingston upon Thames", "Lambeth", "Lewisham", "Merton", "Newham", "Redbridge",
        "Richmond upon Thames", "Southwark", "Sutton", "Tower Hamlets", "Waltham Forest",
        "Wandsworth", "Westminster",
        # FHRS /Authorities spellings for three boroughs (verified live 2026-07-23).
        "City of London Corporation", "Kingston-Upon-Thames", "Richmond-Upon-Thames",
    }
)  # fmt: skip

# Under these floors the run FAILS (first line of defence; the cron's swap gate is the second).
FLOORS = {"postcodes": 1000, "nhle": 1000, "greenspace": 500, "cqc": 1000, "fhrs": 1000}


def fetch_bytes(url: str, headers: dict | None = None, data: bytes | None = None) -> bytes:
    # Scheme allowlist: every source URL is https (constants above, or links/redirects discovered
    # FROM those https pages) — refuse anything else so a poisoned discovered link cannot become a
    # file:// or ftp:// read. This is the REAL guard behind the scanner suppressions on the urlopen
    # below (semgrep dynamic-urllib-use-detected; CodeFactor/bandit B310 audit-url-open).
    if not url.startswith("https://"):
        raise ValueError(f"refusing non-https URL: {url}")
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=300) as r:  # nosemgrep # nosec B310
        return r.read()


def fetch_json(url: str, headers: dict | None = None, data: bytes | None = None):
    return json.loads(fetch_bytes(url, headers, data))


def fetch_nhle() -> list[dict]:
    """Page the Listed Building points layer over the Greater London bbox (WGS84 GeoJSON)."""
    records: list[dict] = []
    offset = 0
    while True:
        params = urllib.parse.urlencode(
            {
                "where": "1=1",
                "outFields": "OBJECTID,ListEntry,Name,Grade,ListDate,AmendDate,hyperlink",
                "f": "geojson",
                "geometry": "-0.52,51.28,0.34,51.70",
                "geometryType": "esriGeometryEnvelope",
                "inSR": "4326",
                "spatialRel": "esriSpatialRelIntersects",
                "resultOffset": str(offset),
                "resultRecordCount": "2000",
            }
        )
        page = fetch_json(f"{NHLE_QUERY}?{params}")
        feats = page.get("features", [])
        records.extend(parse_nhle({"features": feats}))
        print(f"  nhle: +{len(feats)} features at offset {offset}")
        if len(feats) < 2000:
            return records
        offset += 2000


def fetch_greenspace() -> list[dict]:
    """GB GeoPackage (~59MB) -> sqlite rows -> London records (parsers do WKB + BNG->WGS84)."""
    product = fetch_json(OS_DOWNLOADS)
    # OS versions are "YYYY-MM" — pad to full ISO so dates.ts validation accepts it (asOf honesty).
    as_of = str(product.get("version", ""))[:10] or "unknown"
    if re.fullmatch(r"\d{4}-\d{2}", as_of):
        as_of += "-01"
    url = f"{OS_DOWNLOADS}/downloads?area=GB&format=GeoPackage&redirect"
    blob = fetch_bytes(url)
    zf = zipfile.ZipFile(io.BytesIO(blob))
    inner = next(n for n in zf.namelist() if n.endswith(".gpkg"))
    with tempfile.NamedTemporaryFile(suffix=".gpkg") as tmp:
        tmp.write(zf.read(inner))
        tmp.flush()
        con = sqlite3.connect(tmp.name)
        con.row_factory = sqlite3.Row
        sites = [dict(r) for r in con.execute("SELECT id, function, distinctive_name_1 FROM greenspace_site")]
        aps = [dict(r) for r in con.execute("SELECT geometry, ref_to_greenspace_site FROM access_point")]
        con.close()
    print(f"  greenspace: {len(sites)} sites, {len(aps)} access points (GB), as_of {as_of}")
    return parse_greenspace(sites, aps, as_of=as_of)


def fetch_cqc() -> list[dict]:
    """Discover this month's directory CSV link on the using-cqc-data page, download, parse."""
    html = fetch_bytes(CQC_DATA_PAGE).decode("utf-8", "replace")
    links = re.findall(r'href="([^"]+_CQC_directory\.csv)"', html)
    if not links:
        raise RuntimeError("CQC directory CSV link not found on the using-cqc-data page")
    url = links[0] if links[0].startswith("http") else f"https://www.cqc.org.uk{links[0]}"
    print(f"  cqc: {url}")
    return parse_cqc_directory(fetch_bytes(url).decode("utf-8-sig", "replace"))


def fetch_fhrs() -> list[dict]:
    """All establishments for the 33 London authorities (FHRS scheme; inspection date in copy)."""
    hdrs = {"x-api-version": "2"}
    auth = fetch_json(f"{FHRS_BASE}/Authorities/basic", hdrs)
    london = [a for a in auth["authorities"] if a.get("Name") in LONDON_AUTHORITIES]
    print(f"  fhrs: {len(london)} London authorities")
    records: list[dict] = []
    for a in london:
        page_no = 1
        while True:
            page = fetch_json(
                f"{FHRS_BASE}/Establishments?localAuthorityId={a['LocalAuthorityId']}"
                f"&pageSize=5000&pageNumber={page_no}",
                hdrs,
            )
            records.extend(parse_fhrs([page]))
            meta = page.get("meta", {})
            if page_no >= int(meta.get("totalPages", 1)):
                break
            page_no += 1
    return records


def geocode(postcodes: list[str]) -> dict[str, dict]:
    """Bulk-geocode via postcodes.io (100/request) -> {postcode: {lat, lng}} + raw gazetteer rows."""
    rows: list[dict] = []
    for i in range(0, len(postcodes), 100):
        body = json.dumps({"postcodes": postcodes[i : i + 100]}).encode()
        resp = fetch_json(POSTCODES_BULK, {"Content-Type": "application/json"}, body)
        rows.extend(parse_postcodes([resp]))
    return {r["postcode"]: r for r in rows}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="dist")
    out = Path(ap.parse_args().out)
    out.mkdir(parents=True, exist_ok=True)

    artifacts: dict[str, list[dict]] = {}
    failures: list[str] = []

    for name, fn in (("nhle", fetch_nhle), ("greenspace", fetch_greenspace), ("cqc", fetch_cqc), ("fhrs", fetch_fhrs)):
        print(f"fetching {name} ...")
        try:
            artifacts[name] = fn()
        except Exception as e:
            failures.append(f"{name}: {e}")
            artifacts[name] = []

    # Gazetteer universe: the postcodes the corpora reference (CQC pre-geocode) + a seed set.
    # Full-London unit enumeration (ONSPD via the ONS geoportal) is 016 backlog — widen there.
    print("geocoding gazetteer ...")
    universe = sorted(
        {r["postcode"] for r in artifacts.get("cqc", [])}
        | {"SW1A 1AA", "E8 3GT", "SW9 9SL", "N1 9GU", "SE1 7PB", "E1 6AN"}
    )
    try:
        gazetteer = geocode(universe)
        artifacts["postcodes"] = sorted(gazetteer.values(), key=lambda r: r["postcode"])
        artifacts["cqc"] = attach_coords(artifacts["cqc"], gazetteer)
    except Exception as e:
        failures.append(f"postcodes: {e}")
        artifacts["postcodes"] = []

    for name, rows in artifacts.items():
        (out / f"{name}.json").write_text(json.dumps(rows, indent=0))
        floor = FLOORS[name]
        status = "OK" if len(rows) >= floor else f"UNDER FLOOR {floor}"
        print(f"{name}.json: {len(rows)} rows [{status}]")
        if len(rows) < floor:
            failures.append(f"{name}: {len(rows)} rows < floor {floor}")

    if failures:
        print("FAILED:\n  " + "\n  ".join(failures))
        return 1
    print("all artifacts OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
