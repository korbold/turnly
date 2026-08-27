#!/usr/bin/env python3
"""Turn a production config dump into the staging fixture.

    python3 refresh-fixture.py /tmp/prodcfg.txt config.json

Every rule about what may and may not cross into staging lives here. The
script refuses to write a fixture in which any known real string survived.
"""
import collections
import json
import pathlib
import re
import sys
import uuid

# Fixed namespace: the same input always yields the same fixture, so a
# regenerated file diffs as "what production changed" and nothing else.
NS = uuid.UUID("6f2c8a10-0000-4000-8000-000000000000")

# Production slug -> (staging slug, staging name). Names change nothing about
# behaviour, so they are the cheapest thing to drop.
TENANTS = {
    "negocio-de-pruebas":          ("negocio-demo",  "Negocio Demo"),
    "lavadora-y-lubricador-feder": ("autospa-demo",  "AutoSpa Demo"),
    "jirapintas":                  ("barberia-demo", "Barberia Demo"),
}

# The production rows are the first names of real employees.
WASHERS = ["Bruno", "Ivan", "Marco", "Tomas", "Simon"]
DRYERS = ["Lucia", "Noelia", "Sofia", "Ximena", "Renata"]

# Anything here surviving into the output is a bug, not a warning.
FORBIDDEN = ["jirapintas", "feder", "0991213606", "r2.dev",
             "Pablo", "Hernán", "Daniel", "Cristian", "Carlos",
             "Mary", "Azucena", "Gisela", "Cristina", "Paola"]


def rid(table, old):
    """Deterministic replacement id. No production id reaches staging."""
    return None if old is None else str(uuid.uuid5(NS, f"{table}:{old}"))


def parse(dump_path):
    raw = pathlib.Path(dump_path).read_text()
    parts = re.split(r"=====TABLE:(\w+)\n", raw)[1:]
    return {parts[i]: json.loads(parts[i + 1].strip()) for i in range(0, len(parts), 2)}


def sanitise(src):
    out = collections.OrderedDict()

    # Global catalogues: no tenant, no PII. Ids kept, because staging:seed
    # matches these on slug anyway.
    out["plans"] = src["plans"]
    out["business_categories"] = src["business_categories"]

    tenants = []
    for t in src["tenants"]:
        slug, name = TENANTS[t["slug"]]
        t = dict(t)
        t["id"] = rid("tenants", t["id"])
        t["slug"], t["name"] = slug, name
        t["owner_name"] = "Duenio Demo"
        t["email"] = f"admin@{slug}.staging.goturnly.com"
        t["phone"] = "0999000000"
        t["address"] = "Av. Demo 100"
        t["legal_name"] = name.upper()
        t["tax_id"] = "1700000000001" if t["tax_id_type"] == "ruc" else None
        t["billing_email"] = f"facturacion@{slug}.staging.goturnly.com"
        t["billing_phone"] = "0999000000"
        t["billing_address"] = "Av. Demo 100"
        t["logo_url"] = None          # production R2 bucket
        t["cover_url"] = None         # production R2 bucket
        if t["social_links"]:
            t["social_links"] = {k: None for k in t["social_links"]}
        # settings and custom_fields pass through untouched on purpose: the
        # permissions matrix and the variant map ARE the config worth copying,
        # and they hold no PII.
        tenants.append(t)
    out["tenants"] = tenants

    for table in ["services", "service_variants", "products",
                  "business_resources", "service_staff"]:
        rows = []
        for r in src[table]:
            r = dict(r)
            r["id"] = rid(table, r["id"])
            r["tenant_id"] = rid("tenants", r["tenant_id"])
            if table == "service_variants":
                r["service_id"] = rid("services", r["service_id"])
            if table == "services":
                r["image_url"] = None      # production R2 bucket
            if table == "business_resources":
                r["employee_id"] = None    # FK to a real staff user
            rows.append(r)
        if table == "service_staff":
            washers, dryers = iter(WASHERS), iter(DRYERS)
            for r in rows:
                r["name"] = next(washers) if r["position"] == "washer" else next(dryers)
        out[table] = rows

    consumption = []
    for r in src["service_variant_consumption"]:
        r = dict(r)
        r["id"] = rid("service_variant_consumption", r["id"])
        r["service_variant_id"] = rid("service_variants", r["service_variant_id"])
        r["product_id"] = rid("products", r["product_id"])
        consumption.append(r)
    out["service_variant_consumption"] = consumption

    return out


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)

    fixture = sanitise(parse(sys.argv[1]))
    blob = json.dumps(fixture, ensure_ascii=False, indent=1) + "\n"

    for needle in FORBIDDEN:
        if needle.lower() in blob.lower():
            sys.exit(f"REFUSING TO WRITE: {needle!r} survived the sanitiser")

    pathlib.Path(sys.argv[2]).write_text(blob)

    for table, rows in fixture.items():
        print(f"  {table}: {len(rows)}")
    print(f"wrote {sys.argv[2]} ({len(blob)} bytes), leak check clean")


if __name__ == "__main__":
    main()
