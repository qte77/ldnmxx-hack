"""Module-TDD for the pure P1 parsers (plan 016 #182).

Fixtures are SMALL CAPTURED REAL payloads (2026-07-23) — field names and nesting are source-truth,
not guesses. All sources are OGL / redistribute_ok (data/sources.json); per-source obligations are
rendered worker-side from registry attribution, never from these artifacts.
"""

import json
from pathlib import Path

from parsers import (
    GREATER_LONDON_BBOX,
    attach_coords,
    bng_to_wgs84,
    epoch_millis_to_iso,
    gpkg_point,
    parse_cqc_directory,
    parse_fhrs,
    parse_greenspace,
    parse_nhle,
    parse_postcodes,
)

FIXTURES = Path(__file__).parent / "fixtures"


def fixture_json(name: str):
    return json.loads((FIXTURES / name).read_text())


RECORD_KEYS = {"id", "name", "authority", "why", "officialUrl", "lastUpdated", "lat", "lng"}


def assert_is_record(r: dict) -> None:
    assert set(r.keys()) >= RECORD_KEYS
    assert isinstance(r["lat"], float) and isinstance(r["lng"], float)
    for k in ("id", "name", "authority", "why", "officialUrl", "lastUpdated"):
        assert isinstance(r[k], str) and r[k], f"empty/invalid {k}"


# --- helpers --------------------------------------------------------------------------------------


class TestBngToWgs84:
    def test_matches_the_ons_reference_for_sw1a_1aa(self):
        # The postcodes.io fixture carries BOTH grids for SW1A 1AA — a free cross-check vector.
        lat, lng = bng_to_wgs84(529090, 179645)
        assert abs(lat - 51.50101) < 2e-4
        assert abs(lng - -0.141563) < 2e-4


class TestGpkgPoint:
    def test_decodes_the_real_access_point_blob(self):
        g = fixture_json("greenspace-gpkg-sample.json")
        blob = bytes.fromhex(g["access_point"]["rows"][0]["geometry"][4:])  # strip "HEX:"
        e, n = gpkg_point(blob)
        assert abs(e - 523775.67) < 0.01
        assert abs(n - 173549.56) < 0.01

    def test_rejects_a_non_point_or_garbage_blob(self):
        assert gpkg_point(b"not a geopackage blob") is None


class TestEpochMillis:
    def test_converts_nhle_listdate_millis(self):
        # 881193600000 ms = 10199 * 86400 s exactly — midnight UTC, 1997-12-04.
        assert epoch_millis_to_iso(881193600000) == "1997-12-04"

    def test_none_passes_through(self):
        assert epoch_millis_to_iso(None) is None


# --- postcodes.io bulk -> gazetteer ---------------------------------------------------------------


class TestParsePostcodes:
    def rows(self):
        return parse_postcodes([fixture_json("postcodesio-bulk.json")])

    def test_resolves_found_postcodes_with_coords(self):
        rows = self.rows()
        sw = next(r for r in rows if r["postcode"] == "SW1A 1AA")
        assert abs(sw["lat"] - 51.50101) < 1e-5
        assert abs(sw["lng"] - -0.141563) < 1e-5

    def test_drops_not_found_entries(self):
        assert not [r for r in self.rows() if r["postcode"] == "ZZ1 1ZZ"]

    def test_excludes_northern_ireland_rows_per_licence(self):
        # BT1 1AA RESOLVES in the fixture (country: Northern Ireland) — the licence gate drops it.
        assert not [r for r in self.rows() if r["postcode"].startswith("BT")]

    def test_dedupes_across_batches(self):
        doubled = parse_postcodes([fixture_json("postcodesio-bulk.json")] * 2)
        assert len(doubled) == len(self.rows())


# --- NHLE ArcGIS GeoJSON -> wander records --------------------------------------------------------


class TestParseNhle:
    def records(self):
        return parse_nhle(fixture_json("nhle.geojson"))

    def test_normalises_a_listed_building_feature(self):
        r = next(x for x in self.records() if x["id"] == "nhle-1021941")
        assert_is_record(r)
        assert r["authority"] == "Historic England"
        assert r["officialUrl"] == "https://historicengland.org.uk/listing/the-list/list-entry/1021941"
        assert "II*" in r["why"]
        assert r["lastUpdated"] == "1997-12-04"  # ListDate millis (AmendDate is null), midnight UTC

    def test_name_is_not_shouting_all_caps(self):
        r = next(x for x in self.records() if x["id"] == "nhle-1021941")
        assert r["name"] != r["name"].upper()

    def test_takes_coords_from_the_multipoint_geometry(self):
        for r in self.records():
            lo_lng, lo_lat, hi_lng, hi_lat = GREATER_LONDON_BBOX
            assert lo_lat < r["lat"] < hi_lat and lo_lng < r["lng"] < hi_lng

    def test_skips_features_without_geometry_or_outside_london(self):
        d = fixture_json("nhle.geojson")
        f0 = json.loads(json.dumps(d["features"][0]))
        f0["geometry"] = None
        durham = json.loads(json.dumps(d["features"][0]))
        durham["geometry"]["coordinates"] = [[-1.576, 54.774]]
        broken = {"type": "FeatureCollection", "features": [f0, durham]}
        assert parse_nhle(broken) == []


# --- OS Open Greenspace GeoPackage rows -> wander records -----------------------------------------


class TestParseGreenspace:
    def setup_method(self):
        g = fixture_json("greenspace-gpkg-sample.json")
        self.site = dict(g["greenspace_site"]["rows"][0])
        self.ap = dict(g["access_point"]["rows"][0])
        self.ap["ref_to_greenspace_site"] = self.site["id"]  # real rows, joined for the test

    def test_joins_site_to_its_access_point_and_projects_to_wgs84(self):
        recs = parse_greenspace([self.site], [self.ap], as_of="2026-07-01")
        assert len(recs) == 1
        r = recs[0]
        assert_is_record(r)
        assert r["id"] == f"osgs-{self.site['id']}"
        assert r["authority"] == "Ordnance Survey"
        assert r["lastUpdated"] == "2026-07-01"
        exp_lat, exp_lng = bng_to_wgs84(523775.67, 173549.56)
        assert abs(r["lat"] - exp_lat) < 1e-6 and abs(r["lng"] - exp_lng) < 1e-6

    def test_site_without_an_access_point_is_skipped(self):
        assert parse_greenspace([self.site], [], as_of="2026-07-01") == []

    def test_unnamed_site_falls_back_to_its_function(self):
        self.site["distinctive_name_1"] = None
        recs = parse_greenspace([self.site], [self.ap], as_of="2026-07-01")
        assert recs[0]["name"] == self.site["function"]

    def test_non_london_sites_are_filtered_out(self):
        far = dict(self.ap)
        # Edinburgh-ish BNG point, same real blob structure with swapped coordinates.
        import struct

        far["geometry"] = (
            "HEX:" + (bytes.fromhex(self.ap["geometry"][4:])[:13] + struct.pack("<dd", 325000.0, 673000.0)).hex()
        )
        assert parse_greenspace([self.site], [far], as_of="2026-07-01") == []


# --- CQC directory CSV -> care records (keyless bulk; API is key-gated as of 2026-07) -------------


class TestParseCqcDirectory:
    def parsed(self):
        return parse_cqc_directory((FIXTURES / "cqc-directory-head.csv").read_text())

    def test_skips_the_preamble_and_reads_the_real_header(self):
        recs = self.parsed()
        assert recs, "no records parsed"
        assert all("CQC Location ID" not in r for r in recs)

    def test_keeps_only_london_region_rows(self):
        recs = self.parsed()
        ids = {r["id"] for r in recs}
        assert "cqc-1-10552899555" in ids  # Square Mile Dental Centre, City of London
        assert "cqc-1-10553191017" not in ids  # Mansfield, East Midlands

    def test_normalises_the_record_with_postcode_for_geocoding(self):
        r = next(x for x in self.parsed() if x["id"] == "cqc-1-10552899555")
        assert r["authority"] == "Care Quality Commission"
        assert r["officialUrl"] == "https://www.cqc.org.uk/location/1-10552899555"
        assert r["postcode"] == "E1 7BS"
        assert "Dentist" in r["why"]
        assert r["lastUpdated"] == "2026-07-22"  # the file's produced-on date

    def test_dedupes_pipe_separated_service_types(self):
        # Real data carries duplicates like "Doctors/GPs|Doctors/GPs" (seen live 2026-07-23).
        text = (FIXTURES / "cqc-directory-head.csv").read_text()
        text += (
            '\n"Stockwell Group Practice",,"Stockwell Road,London",SW9 9GH,,,'
            "Doctors/GPs|Doctors/GPs,12/May/2025 - 00:00,Services for everyone,"
            "Stockwell Partnership,Lambeth,London,"
            "https://www.cqc.org.uk/location/1-999999999,1-999999999,1-888888888"
        )
        r = next(x for x in parse_cqc_directory(text) if x["id"] == "cqc-1-999999999")
        assert r["why"].count("Doctors/GPs") == 1

    def test_attach_coords_geocodes_and_drops_unresolved(self):
        recs = self.parsed()
        gaz = {"E1 7BS": {"lat": 51.516, "lng": -0.077}}
        out = attach_coords(recs, gaz)
        assert all(set(RECORD_KEYS) <= set(r.keys()) for r in out)
        assert {r["id"] for r in out} == {"cqc-1-10552899555"}
        assert out[0]["lat"] == 51.516
        assert "postcode" not in out[0]


# --- FHRS establishments -> food-hygiene records --------------------------------------------------


class TestParseFhrs:
    def records(self, mutate=None):
        d = fixture_json("fhrs-establishments.json")
        if mutate:
            mutate(d)
        return parse_fhrs([d])

    def test_normalises_an_establishment(self):
        r = next(x for x in self.records() if x["id"] == "fhrs-1824267")
        assert_is_record(r)
        assert r["authority"] == "Food Standards Agency"
        assert r["officialUrl"] == "https://ratings.food.gov.uk/business/1824267"
        assert "rating 5" in r["why"].lower()
        assert "2026-03-18" in r["why"]  # inspection date shown, per licence obligation
        assert r["lastUpdated"] == "2026-03-18"
        assert abs(r["lat"] - 51.528421) < 1e-6  # geocode strings became floats

    def test_drops_establishments_without_a_geocode(self):
        def mutate(d):
            d["establishments"][0]["geocode"] = {"longitude": None, "latitude": None}

        ids = {r["id"] for r in self.records(mutate)}
        assert "fhrs-1824267" not in ids

    def test_drops_non_fhrs_scheme_rows(self):
        def mutate(d):
            d["establishments"][0]["SchemeType"] = "FHIS"

        ids = {r["id"] for r in self.records(mutate)}
        assert "fhrs-1824267" not in ids
