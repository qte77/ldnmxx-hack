"""Pure parsers: keyless source payloads -> normalised corpus records (plan 016 P1, #182).

Stdlib-only by design (the CI Action installs nothing). Every function here is pure and
pytest-covered (tests/test_parsers.py); fetching/orchestration lives in seed.py (glue, proven by
real Action runs). Output shape = the frozen CorpusRecord (worker/src/corpus/contract.ts):
id/name/authority/why/officialUrl/lastUpdated/lat/lng — plus {postcode, lat, lng} gazetteer rows.

Licence obligations (data/sources.json): NI/BT postcodes are excluded (separate non-commercial
licence); FHRS shows the inspection date in the record copy; NHLE links each record to its official
List entry. Attribution strings live in reviewed worker TS, never here.
"""

import csv
import io
import math
import re
import struct
from datetime import UTC, datetime

# Greater London, WGS84: (lo_lng, lo_lat, hi_lng, hi_lat).
GREATER_LONDON_BBOX = (-0.52, 51.28, 0.34, 51.70)
# Greater London, British National Grid: (lo_easting, lo_northing, hi_easting, hi_northing).
LONDON_BNG_BBOX = (500000.0, 153000.0, 564000.0, 202000.0)


# --- geometry helpers -----------------------------------------------------------------------------


def bng_to_wgs84(easting: float, northing: float) -> tuple[float, float]:
    """OSGB36 grid (Airy 1830) -> WGS84 lat/lng via inverse Transverse Mercator + Helmert (~5m)."""
    # Airy 1830 ellipsoid + National Grid projection constants.
    a, b = 6377563.396, 6356256.909
    f0 = 0.9996012717
    lat0, lon0 = math.radians(49.0), math.radians(-2.0)
    e0, n0 = 400000.0, -100000.0
    e2 = 1 - (b * b) / (a * a)
    n = (a - b) / (a + b)

    lat = lat0
    m = 0.0
    while abs(northing - n0 - m) >= 1e-5:
        lat = (northing - n0 - m) / (a * f0) + lat
        dl, sl = lat - lat0, lat + lat0
        m = (
            b
            * f0
            * (
                (1 + n + 1.25 * n**2 + 1.25 * n**3) * dl
                - (3 * n + 3 * n**2 + 2.625 * n**3) * math.sin(dl) * math.cos(sl)
                + (1.875 * n**2 + 1.875 * n**3) * math.sin(2 * dl) * math.cos(2 * sl)
                - (35 / 24) * n**3 * math.sin(3 * dl) * math.cos(3 * sl)
            )
        )

    sin_lat = math.sin(lat)
    nu = a * f0 / math.sqrt(1 - e2 * sin_lat**2)
    rho = a * f0 * (1 - e2) / (1 - e2 * sin_lat**2) ** 1.5
    eta2 = nu / rho - 1
    tan_lat = math.tan(lat)
    de = easting - e0
    vii = tan_lat / (2 * rho * nu)
    viii = tan_lat / (24 * rho * nu**3) * (5 + 3 * tan_lat**2 + eta2 - 9 * tan_lat**2 * eta2)
    ix = tan_lat / (720 * rho * nu**5) * (61 + 90 * tan_lat**2 + 45 * tan_lat**4)
    sec_lat = 1 / math.cos(lat)
    x = sec_lat / nu
    xi = sec_lat / (6 * nu**3) * (nu / rho + 2 * tan_lat**2)
    xii = sec_lat / (120 * nu**5) * (5 + 28 * tan_lat**2 + 24 * tan_lat**4)
    xiia = sec_lat / (5040 * nu**7) * (61 + 662 * tan_lat**2 + 1320 * tan_lat**4 + 720 * tan_lat**6)
    lat_osgb = lat - vii * de**2 + viii * de**4 - ix * de**6
    lon_osgb = lon0 + x * de - xi * de**3 + xii * de**5 - xiia * de**7

    # Helmert: OSGB36 -> WGS84 (cartesian), then back to geodetic on the WGS84 ellipsoid.
    h = 0.0
    sin_p, cos_p = math.sin(lat_osgb), math.cos(lat_osgb)
    nu2 = a / math.sqrt(1 - e2 * sin_p**2)
    x1 = (nu2 + h) * cos_p * math.cos(lon_osgb)
    y1 = (nu2 + h) * cos_p * math.sin(lon_osgb)
    z1 = ((1 - e2) * nu2 + h) * sin_p
    tx, ty, tz = 446.448, -125.157, 542.060
    s = 20.4894e-6
    rx, ry, rz = (math.radians(r / 3600.0) for r in (0.1502, 0.2470, 0.8421))
    x2 = tx + (1 + s) * x1 + (-rz) * y1 + ry * z1
    y2 = ty + rz * x1 + (1 + s) * y1 + (-rx) * z1
    z2 = tz + (-ry) * x1 + rx * y1 + (1 + s) * z1

    a2, b2 = 6378137.0, 6356752.3142
    e2b = 1 - (b2 * b2) / (a2 * a2)
    p = math.sqrt(x2**2 + y2**2)
    lat_w = math.atan2(z2, p * (1 - e2b))
    for _ in range(8):
        nu3 = a2 / math.sqrt(1 - e2b * math.sin(lat_w) ** 2)
        lat_w = math.atan2(z2 + e2b * nu3 * math.sin(lat_w), p)
    return math.degrees(lat_w), math.degrees(math.atan2(y2, x2))


def gpkg_point(blob: bytes) -> tuple[float, float] | None:
    """Decode a GeoPackage POINT geometry blob -> (easting, northing); None for anything else."""
    try:
        if blob[:2] != b"GP":
            return None
        flags = blob[3]
        envelope_bytes = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}.get((flags >> 1) & 0x07)
        if envelope_bytes is None:
            return None
        off = 8 + envelope_bytes
        order = "<" if blob[off] == 1 else ">"
        (wkb_type,) = struct.unpack(f"{order}I", blob[off + 1 : off + 5])
        if wkb_type != 1:  # WKB Point
            return None
        x, y = struct.unpack(f"{order}dd", blob[off + 5 : off + 21])
        return x, y
    except (IndexError, struct.error):
        return None


def epoch_millis_to_iso(ms: int | None) -> str | None:
    """ArcGIS epoch-millisecond date -> ISO YYYY-MM-DD (None passes through)."""
    if ms is None:
        return None
    return datetime.fromtimestamp(ms / 1000, tz=UTC).date().isoformat()


# --- postcodes.io bulk -> gazetteer ---------------------------------------------------------------


def parse_postcodes(responses: list[dict]) -> list[dict]:
    """Bulk-lookup responses -> [{postcode, lat, lng}]. Drops misses and NI/BT rows (licence)."""
    seen: set[str] = set()
    out: list[dict] = []
    for resp in responses:
        for entry in resp.get("result", []):
            res = entry.get("result")
            if not isinstance(res, dict):
                continue
            postcode = res.get("postcode")
            lat, lng = res.get("latitude"), res.get("longitude")
            if not isinstance(postcode, str) or not isinstance(lat, int | float) or not isinstance(lng, int | float):
                continue
            if res.get("country") == "Northern Ireland" or postcode.upper().startswith("BT"):
                continue
            if postcode in seen:
                continue
            seen.add(postcode)
            out.append({"postcode": postcode, "lat": float(lat), "lng": float(lng)})
    return out


# --- NHLE ArcGIS GeoJSON -> wander records --------------------------------------------------------


def _in_london(lat: float, lng: float) -> bool:
    lo_lng, lo_lat, hi_lng, hi_lat = GREATER_LONDON_BBOX
    return lo_lat < lat < hi_lat and lo_lng < lng < hi_lng


def parse_nhle(geojson: dict) -> list[dict]:
    """Listed Building point features -> records. Links each to its official List entry (licence)."""
    out = []
    for f in geojson.get("features", []):
        props = f.get("properties") or {}
        geom = f.get("geometry") or {}
        coords = geom.get("coordinates")
        if geom.get("type") == "MultiPoint" and coords:
            coords = coords[0]
        if not coords or len(coords) < 2:
            continue
        lng, lat = float(coords[0]), float(coords[1])
        entry, name, url = props.get("ListEntry"), props.get("Name"), props.get("hyperlink")
        last = epoch_millis_to_iso(props.get("AmendDate")) or epoch_millis_to_iso(props.get("ListDate"))
        if not entry or not name or not url or not last or not _in_london(lat, lng):
            continue
        grade = props.get("Grade") or "listed"
        out.append(
            {
                "id": f"nhle-{entry}",
                "name": str(name).title(),
                "authority": "Historic England",
                "why": f"Grade {grade} listed building — free to view from the street; check the official List entry.",
                "officialUrl": str(url),
                "lastUpdated": last,
                "lat": lat,
                "lng": lng,
            }
        )
    return out


# --- OS Open Greenspace GeoPackage rows -> wander records -----------------------------------------


def _geom_bytes(v) -> bytes | None:
    if isinstance(v, bytes):
        return v
    if isinstance(v, str) and v.startswith("HEX:"):
        return bytes.fromhex(v[4:])
    return None


def parse_greenspace(sites: list[dict], access_points: list[dict], as_of: str) -> list[dict]:
    """Site rows + access-point rows (BNG GeoPackage) -> records at the site's first access point."""
    ap_by_site: dict[str, tuple[float, float]] = {}
    for ap in access_points:
        ref = ap.get("ref_to_greenspace_site")
        blob = _geom_bytes(ap.get("geometry"))
        if not ref or ref in ap_by_site or blob is None:
            continue
        pt = gpkg_point(blob)
        if pt is not None:
            ap_by_site[ref] = pt
    lo_e, lo_n, hi_e, hi_n = LONDON_BNG_BBOX
    out = []
    for site in sites:
        site_id = site.get("id")
        pt = ap_by_site.get(site_id) if site_id else None
        if pt is None:
            continue
        e, n = pt
        if not (lo_e < e < hi_e and lo_n < n < hi_n):
            continue
        lat, lng = bng_to_wgs84(e, n)
        function = site.get("function") or "Greenspace"
        name = site.get("distinctive_name_1") or function
        out.append(
            {
                "id": f"osgs-{site_id}",
                "name": str(name),
                "authority": "Ordnance Survey",
                "why": f"{function} — free to visit; check locally for opening times.",
                "officialUrl": "https://explore.osmaps.com/",
                "lastUpdated": as_of,
                "lat": lat,
                "lng": lng,
            }
        )
    return out


# --- CQC directory CSV -> care records (keyless bulk; the API is key-gated as of 2026-07) ---------


def parse_cqc_directory(text: str) -> list[dict]:
    """Directory CSV (title preamble + header) -> London records with `postcode` for geocoding."""
    lines = text.splitlines()
    produced = None
    m = re.search(r"produced on (\d{1,2} \w+ \d{4})", text)
    if m:
        produced = datetime.strptime(m.group(1), "%d %B %Y").date().isoformat()
    try:
        header_at = next(i for i, li in enumerate(lines) if li.startswith("Name,"))
    except StopIteration:
        return []
    out = []
    for row in csv.DictReader(io.StringIO("\n".join(lines[header_at:]))):
        if row.get("Region") != "London":
            continue
        loc_id = row.get("CQC Location ID (for office use only)")
        name, postcode, url = row.get("Name"), row.get("Postcode"), row.get("Location URL")
        if not loc_id or not name or not postcode or not url or not produced:
            continue
        # Real data carries pipe-separated duplicates ("Doctors/GPs|Doctors/GPs") — dedupe, keep order.
        raw_services = (row.get("Service types") or "Care service").split("|")
        services = " · ".join(dict.fromkeys(s.strip() for s in raw_services if s.strip()))
        checked = (row.get("Date of latest check") or "").split(" - ")[0]
        checked_part = f"; last checked {checked}" if checked else ""
        out.append(
            {
                "id": f"cqc-{loc_id}",
                "name": name,
                "authority": "Care Quality Commission",
                "why": f"{services} — regulated by CQC{checked_part}. See the official page for current ratings.",
                "officialUrl": url,
                "lastUpdated": produced,
                "postcode": postcode,
            }
        )
    return out


def attach_coords(records: list[dict], gazetteer: dict[str, dict]) -> list[dict]:
    """Merge geocoded coords onto postcode-carrying records; unresolved postcodes are dropped."""
    out = []
    for r in records:
        g = gazetteer.get(r.get("postcode", ""))
        if not g:
            continue
        merged = {k: v for k, v in r.items() if k != "postcode"}
        merged["lat"], merged["lng"] = float(g["lat"]), float(g["lng"])
        out.append(merged)
    return out


# --- FHRS establishments -> food-hygiene records --------------------------------------------------


def parse_fhrs(pages: list[dict]) -> list[dict]:
    """Establishment pages -> records. Shows the inspection date (licence); FHRS scheme only."""
    out = []
    for page in pages:
        for est in page.get("establishments", []):
            if est.get("SchemeType") != "FHRS":
                continue
            geo = est.get("geocode") or {}
            fhrs_id, name = est.get("FHRSID"), est.get("BusinessName")
            try:
                lat, lng = float(geo.get("latitude")), float(geo.get("longitude"))
            except (TypeError, ValueError):
                continue
            rating_date = (est.get("RatingDate") or "").split("T")[0]
            if not fhrs_id or not name or not rating_date:
                continue
            value = est.get("RatingValue") or "unavailable"
            out.append(
                {
                    "id": f"fhrs-{fhrs_id}",
                    "name": str(name),
                    "authority": "Food Standards Agency",
                    "why": f"Food hygiene rating {value}, inspected {rating_date} — confirm on the official FSA page.",
                    "officialUrl": f"https://ratings.food.gov.uk/business/{fhrs_id}",
                    "lastUpdated": rating_date,
                    "lat": lat,
                    "lng": lng,
                }
            )
    return out
