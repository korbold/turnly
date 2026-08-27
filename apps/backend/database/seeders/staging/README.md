# The staging fixture

`config.json` is production's **configuration**, and nothing else. It feeds
`php artisan staging:seed`, which invents every person on top of it.

What is in it, and why: the permissions matrix, `iva_mode`, `payment_timing`,
`require_open_till_for_cash`, the `custom_fields` variant map, service prices,
variants and recipes. Those are the settings that change how the system
behaves, so a staging box that lacks them tests a different program.

What is deliberately not in it:

- **No people.** Names, phones, emails, addresses, plates and tax ids were all
  replaced when the fixture was generated. The ten `service_staff` rows in
  production are the first names of real employees; the ten here are invented.
- **No production ids.** Every tenant-scoped id was rewritten. A tenant id
  shared between staging and production is a footgun waiting for the day
  something points at the wrong billing service.
- **No R2 URLs.** `logo_url`, `cover_url` and `services.image_url` are nulled.
  They point into production's bucket.
- **Nothing about billing.** `ambiente` lives in the billing service's own
  database, next to `p12_cert` and `p12_password`, and one production tenant
  sits at `ambiente=2`. That row must never be copied: it would put a real
  signing certificate on a sandbox. Staging's billing config is created fresh
  at `ambiente=1` with its own test certificate.

## Refreshing it when production's config drifts

The fixture is a snapshot, taken 2026-08-27. When a setting changes in
production and it matters here, regenerate rather than hand-edit:

```bash
# 1. On the prod box, dump the config tables as JSON. Read-only, SELECT only.
ssh root@<prod> 'bash -s' < refresh-export.sh > /tmp/prodcfg.txt

# 2. Locally, sanitise and write the fixture. Refuses to finish if any known
#    real string survives.
python3 refresh-fixture.py /tmp/prodcfg.txt config.json
```

`refresh-fixture.py` holds the whole sanitising policy: the slug and name
mapping, the invented staff names, the id rewriting and the leak check. Read it
before trusting a regenerated fixture, and read the diff afterwards.
