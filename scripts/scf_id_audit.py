"""Audit SCF DAOIP-5 ID stability between two SDF Airtable snapshots.

Usage:
    python3 scripts/scf_id_audit.py OLD_DIR NEW_DIR [CANONICAL_IDS_FILE] > audit.json

OLD_DIR / NEW_DIR are raw_data/SCF/<date>/ folders holding the three Airtable CSV exports.
CANONICAL_IDS_FILE (optional) is `grep -H "^canonical_id" docs/projects/*.md` run in the
SCF-Public-Goods-Maintenance site repo.

See docs/data-quality/scf_canonical_id_data_loss_report_2026-10-09.md.
"""
import csv
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

OLD_DIR, NEW_DIR = Path(sys.argv[1]), Path(sys.argv[2])
CANON = Path(sys.argv[3]) if len(sys.argv) > 3 else None
csv.field_size_limit(10**9)


def slug(v):
    # Exact transform from og_dagster/configs/schema_maps/active/daoip5_scf.yaml
    return v.strip().lower().replace(" ", "_") if v and str(v).strip() else None


def money(v):
    v = re.sub(r"[^0-9.]", "", v or "")
    try:
        return float(v) if v else 0.0
    except ValueError:
        return 0.0


def rnum(r):
    m = re.search(r"#\s*(\d+)", r or "")
    return int(m.group(1)) if m else None


def load(d):
    def rd(prefix):
        (f,) = [p for p in d.iterdir() if p.name.startswith(prefix) and p.suffix == ".csv"]
        return list(csv.DictReader(open(f, encoding="utf-8-sig")))

    return {"projects": rd("Awarded Projects"), "subs": rd("Awarded Submissions"),
            "rounds": rd("Build Award Rounds")}


def norm_url(u):
    u = (u or "").strip().lower()
    u = re.sub(r"^https?://(www\.)?", "", u).rstrip("/")
    return u


def keys_for(p):
    """Stable-ish linkage keys for a project row (anything but its name)."""
    ks = set()
    for col in ("Website", "Github", "X", "Discord", "LinkedIn"):
        for part in re.split(r"[,\s]+", p.get(col) or ""):
            n = norm_url(part)
            if len(n) > 6 and "." in n:
                ks.add((col, n))
    for col in ("Submission URL (from All Submissions)", "Submission URL (from Awarded Submissions)"):
        for part in re.split(r"[,\s]+", p.get(col) or ""):
            n = norm_url(part)
            if n:
                ks.add(("SubmissionURL", n))
    return ks


snaps = {"old": load(OLD_DIR), "new": load(NEW_DIR)}
out = {}

for n, s in snaps.items():
    titles = defaultdict(set)
    for p in s["projects"]:
        titles[slug(p["Title"])].add(p["Title"])
    app_ids = Counter(slug(x["Submission / Project"]) for x in s["subs"])
    proj_ids = {slug(p["Title"]) for p in s["projects"]}
    sub_proj = Counter(slug(x["Project"]) for x in s["subs"])
    out[n] = {
        "projects": len(s["projects"]),
        "submissions": len(s["subs"]),
        "rounds": len(s["rounds"]),
        "distinct_project_ids": len(proj_ids),
        "distinct_app_ids": len(app_ids),
        "null_project_ids": sum(1 for p in s["projects"] if not slug(p["Title"])),
        "null_app_ids": app_ids.get(None, 0),
        "project_id_collisions": {k: sorted(v) for k, v in titles.items() if len(v) > 1},
        "app_ids_shared": sum(1 for c in app_ids.values() if c > 1),
        "subs_hidden_by_app_id_collision": sum(c - 1 for k, c in app_ids.items() if k and c > 1),
        "subs_whose_project_missing": sum(c for k, c in sub_proj.items() if k not in proj_ids),
        "orphan_awards_usd": sum(
            money(x.get("Total Awarded (USD)")) for x in s["subs"] if slug(x["Project"]) not in proj_ids
        ),
        "app_id_ne_project_id": sum(
            1 for x in s["subs"] if slug(x["Submission / Project"]) != slug(x["Project"])
        ),
        "ids_with_unsafe_chars": sorted(i for i in proj_ids if i and re.search(r"[^a-z0-9_]", i)),
    }
    # Same project awarded twice in the same quarter -> COUNT(DISTINCT a.id) undercount
    rq = {r.get("Name"): r.get("Quarter, Year") for r in s["rounds"]}
    by_q = Counter()
    for x in s["subs"]:
        if money(x.get("Total Awarded (USD)")) > 0:
            by_q[(rq.get(x["Round"]), slug(x["Submission / Project"]))] += 1
    out[n]["same_quarter_dupes"] = sum(c - 1 for c in by_q.values() if c > 1)

# ---- Diff Nov -> Feb at project level
A, B = snaps["old"], snaps["new"]
a_by = {slug(p["Title"]): p for p in A["projects"]}
b_by = {slug(p["Title"]): p for p in B["projects"]}
gone = sorted(set(a_by) - set(b_by))
new = sorted(set(b_by) - set(a_by))
b_index = defaultdict(set)
for i in new:
    for k in keys_for(b_by[i]):
        b_index[k].add(i)

a_subs = defaultdict(list)
for x in A["subs"]:
    a_subs[slug(x["Project"])].append(x)
b_sub_urls = {norm_url(x.get("Submission URL")): x for x in B["subs"] if x.get("Submission URL")}

lost = []
for g in gone:
    p = a_by[g]
    cand = Counter()
    for k in keys_for(p):
        for i in b_index.get(k, ()):
            cand[i] += 1
    # Where did this project's submissions go in Feb?
    moved_to = Counter()
    for x in a_subs.get(g, []):
        y = b_sub_urls.get(norm_url(x.get("Submission URL")))
        if y:
            moved_to[slug(y["Project"])] += 1
    match = None
    how = None
    if moved_to:
        match, how = moved_to.most_common(1)[0][0], "submission URL"
    elif cand:
        match, how = cand.most_common(1)[0][0], "website/github/socials"
    lost.append({
        "old_id": g,
        "old_title": p["Title"],
        "total_awarded_nov": money(p.get("Total Awarded")),
        "rounds": p.get("Round (from Awarded Submissions)") or p.get("Round (from Submissions)"),
        "submissions_nov": len(a_subs.get(g, [])),
        "new_id": match,
        "new_title": b_by[match]["Title"] if match in b_by else None,
        "matched_by": how,
        "total_awarded_feb": money(b_by[match].get("Total Awarded")) if match in b_by else None,
    })
out["diff"] = {"gone": len(gone), "new": len(new), "lost": lost,
               "new_unmatched": sorted(set(new) - {l["new_id"] for l in lost if l["new_id"]})}

# ---- Submissions that vanished entirely (by Submission URL)
a_urls = {norm_url(x.get("Submission URL")): x for x in A["subs"] if x.get("Submission URL")}
vanished = [a_urls[u] for u in set(a_urls) - set(b_sub_urls)]
out["vanished_submissions"] = [
    {"app_id": slug(x["Submission / Project"]), "round": x["Round"],
     "awarded": money(x.get("Total Awarded (USD)")), "url": x.get("Submission URL")}
    for x in sorted(vanished, key=lambda x: x["Round"])
]
# Submissions whose application ID changed although the submission is the same
changed_app = []
for u, x in a_urls.items():
    y = b_sub_urls.get(u)
    if y and slug(x["Submission / Project"]) != slug(y["Submission / Project"]):
        changed_app.append({"old": slug(x["Submission / Project"]), "new": slug(y["Submission / Project"]),
                            "round": x["Round"], "awarded": money(x.get("Total Awarded (USD)"))})
out["app_id_changed_same_submission"] = changed_app

# ---- Funding attached to IDs that disappeared
out["awarded_on_gone_ids"] = sum(l["total_awarded_nov"] for l in lost)

# ---- SCF project pages (#138 canonical_id backfill)
canon = []
for line in (CANON.read_text().splitlines() if CANON else []):
    page, cid = line.split(":canonical_id:")
    cid = cid.strip()
    suffix = cid.split(":", 3)[-1]
    canon.append({
        "page": Path(page).name, "canonical_id": cid,
        "in_nov_projects": suffix in a_by, "in_feb_projects": suffix in b_by,
        "in_feb_app_ids": suffix in {slug(x["Submission / Project"]) for x in B["subs"]},
    })
out["canonical"] = canon

json.dump(out, sys.stdout, indent=1, default=str)
