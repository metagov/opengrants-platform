# DAOIP-5 Compliance Assessment Methodology

**Version:** 1.0.0
**Last updated:** 2026-03-31
**Companion report:** `docs/compliance/daoip5_compliance_report_2026-03-31.md`
**Assessment script:** `scripts/daoip5_compliance_check.py`

---

## Purpose and Scope

This document is the authoritative reference for how DAOIP-5 compliance is measured in this
codebase. It is written so that any engineer — including one who has never touched this pipeline
before — can understand:

1. What exactly is being measured and why
2. How each design decision was made and what alternatives were considered
3. Where the methodology has known weaknesses and what to do about them
4. How to re-run the assessment and interpret changes in results over time

The methodology is implemented in `scripts/daoip5_compliance_check.py`. Where this document
describes logic, the script implements it. When the two disagree, this document is the
specification and the script should be updated.

---

## The Target Standard: DAOIP-5

DAOIP-5 (DAO Improvement Proposal 5) is a data interoperability standard for grant programs,
authored by the [DAOstar](https://daostar.org/) project. Full specification: `raw_data/DAOIP-5/DAOIP-5.md`.
Extensions spec: `raw_data/DAOIP-5/X-DAOIP-5.md`.

The standard defines three core entity schemas:

1. **GrantPool** — represents a funding round or grant program. Examples: "SCF #28", a Gitcoin
   QF round on Optimism, an ENS Small Grants voting round.

2. **Project** — represents a persistent team or entity that applies for grants across one or
   more pools. The same project may apply to multiple pools across multiple seasons.

3. **GrantApplication** — represents a single application from a specific Project to a specific
   GrantPool, including the funding request, approval status, and disbursement records.

Each schema has fields that are **REQUIRED** (RFC 2119 MUST) and fields that are **OPTIONAL**
or **RECOMMENDED**. The spec uses RFC 2119 language throughout. Where the spec says "MUST",
this assessment treats the field as required. Where it says "SHOULD" or "RECOMMENDED", the
field is tracked as high-value optional but does not affect the required-field pass/fail gate.

---

## What This Assessment Measures (and What It Does Not)

### What it measures

**Data content provenance.** For each DAOIP-5 field in each silver table, the assessment
answers: does this field's value derive from an actual source column in the underlying data,
or was it written as a constant by a developer to satisfy the schema shape?

This question matters because downstream analytics — funding trend charts, cross-platform
comparisons, grant discovery features — consume silver table values under the assumption that
those values reflect the underlying source systems. A field that is structurally present
(correct name, correct type) but semantically fabricated (constant value regardless of source)
does not carry information. In the case of numeric fields, it actively corrupts aggregations.

### What it does not measure

**Structural schema validity.** All sources in this codebase pass structural validation —
column names match DAOIP-5 field names, types are correct, ID format follows
`daoip-5:{system}:{schema}:{id}`. Structural validation is a prerequisite for ingestion,
not a finding of this assessment.

**Row-level data completeness.** A field classified as SOURCE_MAPPED may still be empty
in 40% of rows because the source system doesn't consistently populate it. This assessment
does not check actual row data. See the "Known Limitations" section for implications.

**Enum value correctness.** A field like `grantFundingMechanism` classified as SOURCE_MAPPED
may still map `strategy_name` values to non-standard DAOIP-5 enum values. Enum validation
is on the roadmap but not currently implemented.

**JSON-LD context compliance.** The `@context` field and full JSON-LD conformance are
out of scope for this assessment.

**Extension field quality.** DAOIP-5 allows vendor-specific extension namespaces
(`org.stellar.communityfund`, `co.gitcoin`, `io.ens`). Extensions are valuable but
outside the core standard, and their quality is not measured here.

---

## The Schema Map as the Measurement Target

### Why we assess schema maps rather than the live database

The natural instinct when assessing data quality is to query the database: sample rows,
check null rates, count how many records have non-empty values in each field. This approach
has serious problems in the context of this pipeline:

**Problem 1: Snapshot dependency.**
The silver tables are populated by running the pipeline against a specific data snapshot.
If the database is empty, stale, or contains data from a different snapshot than the one
being assessed, the row-level results would be misleading.

**Problem 2: Non-reproducibility.**
Two people running a row-level assessment against different pipeline states would get
different numbers. The schema map, by contrast, is version-controlled — its state at
any point in time is fully reproducible from git history.

**Problem 3: Treating symptoms instead of causes.**
A row-level assessment might show that `createdAt` has 100% non-null coverage, which
appears healthy — but if every non-null value is the identical string `'2025-01-01T00:00:00Z'`,
the coverage metric is meaningless. The underlying problem is in the schema map transform,
not in the data rows.

**The schema map is the causal bottleneck.** If the YAML map says `source: null, transform:
"lambda _: ''"`, the silver column will contain empty strings regardless of what data is
loaded. The map determines the output. Fixing the map fixes the output for all future
pipeline runs automatically.

### Schema map file locations

```
og_dagster/configs/schema_maps/active/
  daoip5_scf.yaml        # Stellar Community Fund (Airtable)
  daoip5_gitcoin2.yaml   # Gitcoin 2.0 (CSV snapshot)
  daoip5_ens.yaml        # ENS Small Grants (Snapshot API)
  daoip5_giveth.yaml     # Giveth (GraphQL API)
  daoip5_privote.yaml    # Privote
```

The script reads all `daoip5_*.yaml` files in this directory automatically. New sources
are assessed without any script changes simply by creating a new YAML file.

### Schema map structure

Each YAML file has two top-level sections:

```yaml
manifest:
  schema_name: daoip5_scf
  version: "1.0.11"
  source_system: "Stellar Community Fund (Airtable API)"
  last_updated: "2025-11-20T00:00:00Z"
  description: >
    Human-readable description of what this source is and how it maps to DAOIP-5.

schemas:
  grant_pools:       # → silver_{source}_grant_pools
    table: bronze_scf_rounds
    target_table: silver_scf_grant_pools
    fields:
      id:
        source: "Name"
        type: string
        required: true
        transform: |
          lambda v: f"daoip-5:scf:grantPool:{v.strip()}" if v else None
      ...
    extensions:
      org.stellar.communityfund:
        ...

  projects:          # → silver_{source}_projects
    ...

  grant_applications:  # → silver_{source}_grant_applications
    ...
```

Each field definition has:
- `source`: the source column name (string), list of column names (list), or null
- `type`: the data type
- `required`: boolean (overrides the global registry if present)
- `transform`: an optional Python lambda expression string

---

## Field Classification System

The core of the assessment is classifying each field into one of four categories based on
the `source` and `transform` values in the YAML.

### Category 1: SOURCE_MAPPED

**What it means:** The field receives its value from a named column in the bronze source table.
The transform (if present) processes the column's value — it does not ignore it.

**Why this is the target state:** A SOURCE_MAPPED field carries forward information from the
underlying source system. Any change in source data will produce a corresponding change in the
silver output. This is the contract that downstream consumers rely on.

**Detection logic:**
- `source` is a non-null string (single column name), AND
- Either no `transform` is defined, OR
- The `transform` string contains a lambda that uses its parameter (e.g., `lambda v:`) rather
  than ignoring it (e.g., `lambda _:`)

**Concrete examples:**

Simple direct mapping — the silver field gets the bronze column value with no modification:
```yaml
name:
  source: "Title"
  type: string
  required: true
```

Transform that processes the value but still uses it:
```yaml
description:
  source: "Description"
  type: string
  transform: |
    lambda v: v.strip() if v and str(v).strip() else "No description provided."
```

**Edge case — fallback strings in transforms:**
The `"No description provided."` default in the example above does not disqualify the field
from SOURCE_MAPPED classification. The fallback is only reached when the source column is
empty. The primary code path uses the source value; the fallback is a defensive default
for sparse source data, not a fabrication.

The distinction is: does the transform ever use `v` (the source value)? If yes → SOURCE_MAPPED.
If the transform always ignores `v` and returns the same constant → HARDCODED.

**Edge case — JSON extraction from blob columns:**
```yaml
name:
  source: round_metadata
  transform: |
    lambda v: json.loads(v).get('name', 'Unnamed Round') if v else 'Unnamed Round'
```

This is SOURCE_MAPPED. The value is extracted from a JSON blob stored in the source column.
The `'Unnamed Round'` default is a fallback for rounds that have malformed or empty metadata.
The output is still determined by what the source column contains.

### Category 2: COMPUTED

**What it means:** The field is derived from two or more source columns, or from a single
source column through a transform that synthesizes a new data structure (typically a JSON
array or object) from the column's value.

**Why it is distinct from SOURCE_MAPPED:** A COMPUTED field has more failure modes than a
direct mapping. A SOURCE_MAPPED field fails in exactly one scenario: the source column is
missing or renamed. A COMPUTED field can additionally fail if the construction logic contains
a bug, if the columns have incompatible null patterns, or if the JSON structure changes
in the source. This added maintenance risk is reflected in a slightly lower score for
required fields (2 points vs 3 for SOURCE_MAPPED).

**Detection logic:**
- `source` is a list of column names (multiple inputs), OR
- `source` is a single column but the transform constructs a new structure (an `[{...}]`
  array or `{...}` object) from the value

**Concrete examples:**

Multi-column social links:
```yaml
socials:
  source:
    - "Github"
    - "Discord"
    - "X"
    - "LinkedIn"
  type: json
  transform: |
    lambda Github, Discord, X, LinkedIn: [
      {"platform": "GitHub", "url": Github} if Github else None,
      {"platform": "Discord", "url": Discord} if Discord else None,
      ...
    ]
```

Single-column JSON construction:
```yaml
totalGrantPoolSize:
  source: "Total Awarded (USD)"
  type: json
  transform: |
    lambda v: [{"amount": float(v), "denomination": "USD"}] if v else []
```

Derived boolean from date comparison:
```yaml
isOpen:
  source: "Submission Close Date"
  type: boolean
  transform: |
    lambda v: datetime.fromisoformat(v) > datetime.now() if v else False
```

All of these are data-driven. The output changes based on source data.

### Category 3: HARDCODED

**What it means:** The field returns a constant value regardless of what the source data contains.
The `transform` ignores its input by using the underscore parameter convention (`lambda _:`),
or the source is null and the transform returns a literal value.

**Why this is problematic:** A HARDCODED field carries zero information from the source system.
The silver table value tells you nothing about the underlying source data. For optional fields,
a benign hardcode like `[]` for `requiredCredentials` is acceptable — the source system genuinely
has no credential requirements. For required fields, a hardcode means the DAOIP-5 schema is
satisfied structurally but the field is meaningless, which is deceptive to downstream consumers.

**Detection logic — two sub-cases:**

Sub-case A: `source` is null and `transform` returns a literal:
```yaml
createdAt:
  source: null
  type: datetime
  transform: "lambda _: '2025-01-01T00:00:00Z'"
```

Sub-case B: `source` exists but `transform` ignores it:
```yaml
isOpen:
  source: "some_column"  # column exists in source table
  transform: "lambda _: True"  # but transform ignores it — always returns True
```

Sub-case B is rarer but possible. A developer might have set `source` to avoid a "missing source"
warning in the build system while actually hardcoding the output.

**Detection mechanism in the script:**
The script uses a regex to identify lambda expressions that use the underscore convention
for "I am intentionally ignoring this argument":
```python
re.search(r"lambda\s+_\s*[,:]", transform_str)
```

This detects:
- `lambda _: value` (single ignored arg)
- `lambda _, other: value` (first arg ignored, others may or may not be used)

**Benign vs fabricated hardcodes:**
Not all hardcodes are equally harmful. The severity depends on the field and the value:

| Hardcoded value | Context | Severity | Rationale |
|---|---|---|---|
| `'2025-01-01T00:00:00Z'` | Required `createdAt` | P0 — fabricated | Writes a specific false timestamp that corrupts temporal analysis |
| `0.0` | Required `totalGrantPoolSizeInUSD` | P0 — fabricated | Writes a false zero that corrupts funding sum calculations |
| `'Ranked Choice Voting'` | Required `grantFundingMechanism` | Acceptable | The value is accurate for this source; no better source column exists |
| `[]` | Optional `requiredCredentials` | Acceptable | Source system has no credential requirements; empty array is correct |
| `''` | Optional `email` | Acceptable | Source system doesn't collect email; empty string is benign but NULL would be better |
| `{}` | Optional `payoutAddress` | Acceptable | Source system doesn't collect wallet addresses |

The script uses pattern matching to identify fabrications:
- Literal ISO 8601 timestamps in required date fields → fabricated
- Literal `0.0` in required numeric funding fields → fabricated

The methodology acknowledges that this pattern list cannot catch all fabrications —
a developer who hardcodes an unusual value would not be caught automatically. Periodic
manual review of the hardcoded values in schema maps is recommended.

### Category 4: NULL

**What it means:** The field has no source and no transform, or the transform explicitly returns
`None`. The silver column will contain database NULL.

**Why NULL is preferable to HARDCODED for optional fields:**

This is a deliberate design choice that differs from some DAOIP-5 tooling which requires all
defined fields to be non-null. Our position: an honest NULL is better than a misleading empty string.

Consider `governanceURI` for SCF. Governance documentation exists on the SCF website, but the
Airtable data does not link to it. Two options:

Option A — HARDCODED empty string: `transform: "lambda _: ''"`
- The silver table has `governanceURI = ''` for all SCF grant pool records
- A query `WHERE governanceURI IS NOT NULL` returns SCF records — false positive
- A query `WHERE governanceURI != ''` correctly excludes them, but requires callers to know this convention
- An empty string that is mistaken for a missing value causes silent wrong behavior

Option B — NULL: `source: null` (no transform)
- The silver table has `governanceURI = NULL` for all SCF grant pool records
- A query `WHERE governanceURI IS NOT NULL` correctly excludes SCF records
- Standard SQL null semantics work as expected
- No convention required; callers get correct behavior by default

We prefer Option B. The tradeoff: some DAOIP-5 JSON exporters will omit null fields entirely
from JSON output, which may break consumers that expect all defined fields to be present. This
is an acceptable tradeoff for an internal analytics platform. A future export layer can
translate NULLs to empty strings/arrays as needed.

**Detection logic:**
- `source` is null AND `transform` is absent, OR
- `source` is null AND `transform` contains `lambda _: None`

---

## DAOIP-5 Required Field Registry

The following field-per-schema mapping is used as the authoritative required field list.
It is derived from RFC 2119 MUST language in `raw_data/DAOIP-5/DAOIP-5.md`:

```python
REQUIRED_FIELDS = {
    "grant_pools": [
        "id",
        "name",
        "description",
        "grantFundingMechanism",
        "isOpen",
        "totalGrantPoolSizeInUSD",
    ],
    "projects": [
        "id",
        "name",
        "description",
        "contentURI",
    ],
    "grant_applications": [
        "id",
        "grantPoolId",
        "projectId",
        "createdAt",
    ],
}
```

### Interpretation notes

**`totalGrantPoolSizeInUSD`:** The DAOIP-5 spec marks this REQUIRED in the GrantPool JSON
schema example. This creates a conflict for ENS Small Grants, where no USD amount exists in
the source data — the program distributes ENS token voting weight, not USD. The resolution
applied here: the field is required, and a fabricated `0.0` fails compliance. The correct
options are (a) compute a USD equivalent from ENS token price data, or (b) use `null` with
a documented compatibility note in the schema map manifest. The fabricated `0.0` is neither
option and is classified P0.

**`contentURI` for Projects:** The spec implies this through the `projectsURI` publishing
requirement (every project MUST publish a `projectsURI`). We treat it as required because a
Project record without a `contentURI` is an orphan — there is no link to more information
about the project, defeating the purpose of the discovery layer. ENS's `contentURI = NULL`
is classified as a required-field failure for this reason.

**`applicationsURI` for GrantPools:** The spec says "a grant pool MUST publish an
`applicationsURI` field." This is MUST language, making it technically required. However,
this assessment does not include it in the required field list because the intent of the
MUST is about publication and discoverability (grant pools must have a way to find their
applications), not about data completeness per se. A NULL `applicationsURI` for a pool
where applications are tracked internally (not at a URL) does not corrupt downstream analytics
the way a fabricated `createdAt` does. This is a deliberate conservative interpretation to
focus P0 flags on fields that directly corrupt quantitative analysis.

### High-value optional fields

These fields are optional per DAOIP-5 but are tracked separately in reports because their
absence most directly limits the analytical value of the platform:

```python
HIGH_VALUE_OPTIONAL = [
    "fundsAskedInUSD",       # enables ask-vs-approval analysis
    "fundsApprovedInUSD",    # primary capital deployment metric
    "payoutAddress",         # enables on-chain cross-platform deduplication
    "payouts",               # distinguishes approved from actually disbursed
    "status",                # required for funnel/pipeline analysis
    "closeDate",             # enables round duration and velocity analysis
    "applicationsURI",       # discovery link for external consumers
    "socials",               # project identity signal for deduplication
    "image",                 # presentation completeness
    "email",                 # operational contact for notifications
    "membersURI",            # team accountability and contributor tracking
]
```

---

## Scoring Model

### Per-field scoring

| Category | Required field | Optional field |
|---|---|---|
| SOURCE_MAPPED | 3 pts | 1 pt |
| COMPUTED | 2 pts | 1 pt |
| HARDCODED — accurate constant | 1 pt | 0 pts |
| HARDCODED — fabricated value | 0 pts + P0 flag | 0 pts |
| NULL | 0 pts | 0 pts |

**Why required fields use a 3-point scale while optional fields use 1 point:**
Required fields have higher stakes. A required field that is HARDCODED with a fabricated value
is categorically worse than a required field that is SOURCE_MAPPED but has sparse source data —
the former corrupts; the latter is merely incomplete. The 3-point scale for required fields
creates visible differentiation between these outcomes. Optional fields don't need this
differentiation: either they are populated from source data (good) or they aren't (neutral).

**Why COMPUTED scores 2 out of 3 for required fields:**
Computed fields introduce transformation logic that can break silently when source data
changes structure. A direct SOURCE_MAPPED field will throw a column-not-found error if
the source column is renamed — the failure is loud and immediate. A COMPUTED field
might silently return incorrect values if one of its input columns shifts semantics.
The 1-point penalty reflects this additional maintenance risk, not a judgment that
computed fields are worse than direct mappings in general.

**Why HARDCODED accurate constants score 1 point (not 0):**
Consider ENS `grantFundingMechanism: 'Ranked Choice Voting'`. The value is accurate — every
ENS round uses ranked choice voting. No better source exists. The developer made a reasonable
decision to hardcode a known-accurate value rather than leave the field NULL. Awarding 1 point
acknowledges that this is intentional and correct, even though the value is not derived from
source data. It is not as good as SOURCE_MAPPED (the value could become wrong if ENS changes
its mechanism) but it is not as bad as HARDCODED fabricated.

### Per-schema score

```
score_pct = sum(points_earned for all fields) / sum(max_points for all fields) × 100
```

Where max_points per field = 3 for required fields, 1 for optional fields.

### Overall source score

The per-source score is the column-backed percentage across all implemented schemas:

```
overall_column_backed_pct = (SOURCE_MAPPED + COMPUTED fields across all schemas) /
                             (total fields across all schemas) × 100
```

Note: this is a simpler metric than the weighted point score. It answers the plain question
"what fraction of this source's DAOIP-5 fields are backed by source column data?" The point
score is more nuanced (it weights required fields higher) but the column-backed percentage
is more intuitive and is used in summary tables.

### Scoring unimplemented schemas

If a schema is not implemented for a source (e.g., ENS `grant_applications`), it contributes
0 column-backed fields and 0 points to the source's overall score.

**Why not exclude unimplemented schemas from the denominator?**
Because the absence of an entire schema is a compliance finding, not a measurement gap.
ENS not implementing `grant_applications` means ENS does not provide application-level data.
This should reduce ENS's compliance score. Excluding it from the denominator would treat
"we didn't implement this schema" the same as "this schema is fully implemented and passing,"
which is misleading.

**Tradeoff:** This makes ENS's score heavily penalized for a structural design decision
(voting model incompatibility) rather than for data quality failures within a schema it does
implement. A future version of this assessment could report two separate dimensions:
*structural completeness* (which schemas are implemented) and *data quality*
(how well-populated are the schemas that exist). For now, a single score is sufficient.

---

## Issue Severity Classifications

Issues are classified into four priority levels:

### P0 — Fabricated Required Field

**Definition:** A required DAOIP-5 field is populated with a hardcoded constant that is
factually incorrect. This is not merely an absence of data — it is the presence of false data.

**Why P0 (highest severity):** Fabricated values in required fields corrupt downstream analytics
silently. There is no error, no NULL, no warning — the aggregation runs, the chart renders, the
dashboard shows a number. The number is wrong. The person reading it does not know it is wrong.
This is the worst possible outcome for a data pipeline. A NULL at least signals absence; a
fabricated `0.0` or a fixed timestamp signals presence of data that does not exist.

**Examples in this codebase:**
- ENS `totalGrantPoolSizeInUSD = 0.0` → cross-platform funding totals are understated
- SCF `createdAt = '2025-01-01T00:00:00Z'` → time-series charts show all SCF grants as simultaneous

### P1 — Data Present in Bronze But Not Connected to Silver

**Definition:** Source data that could populate a DAOIP-5 field already exists in the bronze
layer of the pipeline — it has been ingested from the source system — but the silver
transformation does not use it, leaving the field NULL or hardcoded.

**Why P1 (high priority, immediately fixable):** P1 issues can be resolved without any
coordination with the source system. The data is already in the warehouse. The fix is a
schema map change or a silver asset update. These should be treated as technical debt to
clear in the next sprint.

**Example:** Gitcoin `payouts` — `bronze_gitcoin2_payouts` exists with full disbursement
records, but the silver applications transformation does not join it.

### P2 — Semantic Mismatch

**Definition:** A field is populated with data from a source column, but the column being
used is semantically incorrect for the DAOIP-5 field. The field is not NULL and not hardcoded —
it has a value — but the value means something different from what DAOIP-5 intends.

**Why P2 (medium priority):** P2 fields inflate column-backed coverage metrics without providing
the intended information. They can cause subtler downstream bugs than fabricated values (a feature
that tries to send email to an `email` field will fail silently when the value is a Twitter handle).
But they are less urgent than P0 because they don't corrupt quantitative aggregations.

**Example:** Gitcoin `email` contains `metadata.projectTwitter` (a Twitter handle), not an email.

### P3 — Structural Gap

**Definition:** An entire schema is absent, or a field is absent due to fundamental incompatibility
between the source system's data model and the DAOIP-5 schema. Unlike P1, these gaps cannot be
resolved by a pipeline change alone — they require either changes to the source system's data
collection or an acknowledgment that the gap is intentional and permanent.

**Examples:**
- ENS `grant_applications` not implemented — the voting model doesn't have application records
- SCF `payoutAddress` always `{}` — Airtable never collected Stellar wallet addresses
- SCF `status` limited to 2 values — the Airtable view filters to awarded projects only

---

## What the Script Does

`scripts/daoip5_compliance_check.py` automates the methodology described in this document
against the YAML schema map files. It does not query the database. It does not read CSV files.
It reads only the schema map YAMLs and applies the classification and scoring logic to produce
a structured report.

### Processing pipeline

```
Step 1: Discovery
  └── Find all daoip5_*.yaml files in og_dagster/configs/schema_maps/active/
  └── Filter by --sources argument if provided

Step 2: Parse each schema map
  └── Read manifest section (source name, version, last_updated)
  └── For each schema type (grant_pools, projects, grant_applications):
      └── If schema section is absent → mark as NOT IMPLEMENTED, check for known P3
      └── For each field in the schema:
          └── classify_field(source, transform) → FieldCategory
          └── is_required = field_name in REQUIRED_FIELDS[schema_type]
          └── is_high_value_optional = field_name in HIGH_VALUE_OPTIONAL
          └── score_field(name, category, is_required, transform) → (points, max_points)
          └── check for P0: is_required + HARDCODED + fabricated pattern → P0 flag
          └── check for P1: match against KNOWN_P1_PATTERNS registry
          └── check for P2: match against KNOWN_P2_PATTERNS registry
      └── check for P3: match against KNOWN_P3_PATTERNS registry at schema level

Step 3: Aggregate scores
  └── Per-schema: source_mapped_pct, score_pct, required_failures
  └── Per-source: overall_source_mapped_pct, P0/P1/P2/P3 issue lists

Step 4: Generate report
  └── Summary table across all sources
  └── P0 issues section
  └── Per-source detail (field tables, required failures, issues)
  └── Consolidated issue register
```

### Classification logic

```python
def classify_field(source, transform_str: Optional[str]) -> FieldCategory:
    """
    source: None | str | list[str]
    transform_str: the raw lambda string from YAML, or None

    Decision tree:
      source=None + no transform              → NULL
      source=None + transform(lambda _: ...)  → HARDCODED
      source=list + transform(lambda _: ...)  → HARDCODED  (all inputs ignored)
      source=list + transform uses params     → COMPUTED
      source=str  + transform(lambda _: ...)  → HARDCODED  (source ignored)
      source=str  + no transform              → SOURCE_MAPPED
      source=str  + transform uses param      → SOURCE_MAPPED
    """
    uses_literal_lambda = bool(
        transform_str and re.search(r"lambda\s+_\s*[,:]", transform_str)
    )

    if source is None:
        if transform_str is None:
            return FieldCategory.NULL
        if uses_literal_lambda:
            return FieldCategory.HARDCODED
        return FieldCategory.NULL

    if isinstance(source, list):
        if uses_literal_lambda:
            return FieldCategory.HARDCODED
        return FieldCategory.COMPUTED

    # Single string source
    if uses_literal_lambda:
        return FieldCategory.HARDCODED

    return FieldCategory.SOURCE_MAPPED
```

The key signal is the `lambda _:` pattern. Python convention is that `_` as a parameter name
means "I am intentionally not using this argument." A transform of `lambda _: 'some_value'`
explicitly announces that the source data is being discarded and a constant is being returned.

### P0 fabrication detection

After classifying a field as HARDCODED, the script checks whether it should trigger a P0
flag by examining the field name and the literal value being returned:

```python
FABRICATED_PATTERNS = [
    r"'20\d\d-\d\d-\d\dT\d\d:\d\d:\d\dZ'",  # ISO 8601 timestamp literals
    r"\"20\d\d-\d\d-\d\dT\d\d:\d\d:\d\dZ\"", # same with double quotes
]

FABRICATED_NUMERIC_FIELDS = ["totalGrantPoolSizeInUSD", "fundsApprovedInUSD"]
# For these fields, a hardcoded 0.0 is treated as fabricated
```

P0 is triggered when:
1. The field is required (in REQUIRED_FIELDS), AND
2. The category is HARDCODED, AND
3. The hardcoded value matches a FABRICATED_PATTERN, OR the field is in FABRICATED_NUMERIC_FIELDS
   and the hardcoded value is `0.0`

**Why a pattern list rather than a per-field registry?**
A per-field registry would require explicitly listing every bad hardcode — it would be
comprehensive but brittle (new bad hardcodes would be silently missed). A pattern list
catches the most common fabrication patterns (timestamp strings, numeric zeros) automatically.
The tradeoff is that unusual fabrications (e.g., a hardcoded `"unknown"` status) would not
be caught. Periodic manual inspection of the HARDCODED fields in schema maps is recommended
as a complement to the automated check.

### P1/P2/P3 issue registries

Unlike P0 (which is auto-detected from the YAML), P1, P2, and P3 issues require human
judgment — they depend on knowledge about the source system, the bronze table contents,
and the semantic meaning of DAOIP-5 fields. They are stored as static registries in the
script:

```python
KNOWN_P1_PATTERNS = [
    # (source_name, schema_type, field_name, explanation)
    ("gitcoin2", "grant_applications", "payouts",
     "bronze_gitcoin2_payouts table exists ... but not joined"),
    ...
]
```

**Why static registries instead of dynamic detection?**
Dynamic detection of P1 would require the script to know the schema of every bronze table
and understand which bronze fields correspond to which silver fields — essentially
re-implementing the entire schema map system inside the compliance script. Static registries
are simpler, transparent, and require a human to consciously decide when a P1 has been
resolved (by removing it from the registry) or when a new one is discovered (by adding it).

**Maintaining the registries:**
When a P1 is fixed (e.g., Gitcoin `payouts` gets wired up), remove the corresponding entry
from `KNOWN_P1_PATTERNS`. When a new structural issue is identified, add it to the
appropriate registry. The registries should be reviewed whenever a schema map is updated.

---

## Tradeoffs and Design Decisions (Complete Record)

### Decision 1: Schema map analysis vs live database query

**What was considered:**
A row-level database assessment: query silver tables, sample rows, check % non-null, % non-empty,
% non-sentinel-value per column.

**Why schema map analysis was chosen:**
- Snapshot-independent: results are the same regardless of which data is loaded
- Version-controlled: changes to schema maps are tracked in git
- Identifies the causal root: fixing the schema map fixes all future pipeline runs
- Faster: no database connection required

**Residual risk:** A field can be classified as SOURCE_MAPPED in the schema map while
being empty in 95% of rows because the source column is consistently null in the source
export. The schema map says the column should be populated; the data says it isn't.
This discrepancy is invisible to the schema-map-only assessment.

**Mitigation:** Periodically run a complementary row-level null-rate check against the
live silver tables, especially after a new snapshot is loaded. Flag any field where
the null rate exceeds 50% despite being classified as SOURCE_MAPPED.

### Decision 2: Penalizing unimplemented schemas in the overall score

**What was considered:**
Excluding unimplemented schemas from score calculation (treating ENS `grant_applications`
as N/A rather than 0%).

**Why penalization was chosen:**
A system that doesn't implement a core DAOIP-5 schema is less DAOIP-5 compliant than one
that implements it with imperfect data. Excluding missing schemas from the denominator would
treat structural absence the same as full implementation, which makes scores incomparable
across sources.

**Tradeoff:**
ENS's score is dominated by the structural incompatibility of the voting model rather than
by the data quality within the schemas it does implement. A future two-dimensional assessment
(structural completeness + data quality) would provide a more nuanced picture. For now,
a single score is preferred for simplicity.

### Decision 3: `fundsAsked` classified as P2, not P1

**What was considered:**
Classifying the absence of `fundsAsked` (for SCF and Gitcoin) as P1, implying the data
exists somewhere and just needs to be connected.

**Why P2 was chosen:**
P1 is reserved for cases where data exists in the bronze layer and just needs wiring.
`fundsAsked` doesn't exist in the bronze layer for SCF or Gitcoin because neither source
system collects a formal funding request as a distinct data point from the approved amount.
Gitcoin's QF model has no funding request concept at all. SCF's Airtable export merges
ask and award into a single field.

Getting `fundsAsked` would require product changes in the upstream source systems —
Gitcoin would need to add a funding request step to its QF application, SCF would need
to expose a separate "requested amount" field. This is a source system design limitation,
not a pipeline gap.

**The line between P1 and P2:**
P1 = data exists in our warehouse, not yet connected.
P2 = data conceptually exists (source system collects it) but the wrong column is used,
     OR data does not exist in the source system at all.

### Decision 4: COMPUTED scores 2/3 points for required fields (not 3/3)

**What was considered:**
Scoring COMPUTED the same as SOURCE_MAPPED (3/3 for required fields).

**Why the penalty was introduced:**
Computed fields have an additional failure mode: the computation logic itself can be wrong.
A direct mapping `source: "column_name"` has one failure mode (column missing). A computed
field `lambda v: json.loads(v).get('name')` has two failure modes: column missing AND JSON
structure changed AND null handling broken. The 1-point penalty is not about the engineering
quality of computed fields — it reflects that they carry more maintenance risk.

**Tradeoff:**
Deriving `isOpen` from a timestamp comparison is arguably more semantically correct than
storing a boolean that can drift out of sync. The penalty may feel unfair to well-engineered
computed fields. But the compliance score measures data reliability, not engineering sophistication.
A computed field that silently returns wrong values when source data changes is a reliability
risk that a direct mapping avoids.

### Decision 5: Empty array `[]` for optional fields classified as HARDCODED not NULL

**What was considered:**
Classifying `lambda _: []` the same as NULL (i.e., treating an empty array as equivalent
to no mapping at all).

**Why HARDCODED was chosen for the category:**
The distinction matters for the database representation. A field with `transform: "lambda _: []"`
will write an empty JSON array `[]` to the silver table. A field with no transform and
`source: null` will write database NULL. These are different values in SQL:
- `WHERE payouts IS NOT NULL` returns rows with `[]` (HARDCODED) but not rows with NULL
- `WHERE payouts != '[]'::jsonb` is needed to exclude empty arrays

Using HARDCODED for this case preserves the distinction between "empty array was explicitly
written" and "field was never set." The score for both is 0 points (for optional fields),
so it doesn't affect the compliance score — but it is important for schema map auditing.

### Decision 6: Accurate hardcodes score 1/3 (not 0/3) for required fields

**What was considered:**
Scoring all HARDCODED required fields as 0, regardless of whether the value is accurate.

**Why accurate hardcodes get 1 point:**
ENS `grantFundingMechanism: 'Ranked Choice Voting'` is a HARDCODED value on a required field.
But it is correct — all ENS rounds use ranked choice voting. No source column exists that could
provide this value dynamically. A developer made a deliberate, informed decision to hardcode
a known-correct value rather than leave it NULL.

Scoring this 0 would put it on the same footing as a fabricated `'2025-01-01T00:00:00Z'`
timestamp, which would be unfair and would obscure the real problem (fabrications).
1 point acknowledges intentional correctness while still penalizing the lack of a source mapping.

---

## How to Re-run the Assessment

### Prerequisites
```bash
# From project root — pyyaml is the only non-stdlib dependency
pip install pyyaml

# Or if using the project's dependency management:
# pyyaml is already in requirements.txt / pyproject.toml
```

### Basic usage

```bash
# Full report for all sources to stdout
python3 scripts/daoip5_compliance_check.py

# Specific sources only
python3 scripts/daoip5_compliance_check.py --sources scf gitcoin2

# Write report to dated file
python3 scripts/daoip5_compliance_check.py \
  --output docs/compliance/daoip5_compliance_report_$(date +%Y-%m-%d).md

# Machine-readable JSON output (useful for dashboards or CI assertions)
python3 scripts/daoip5_compliance_check.py --format json

# Show all fields in tables, not just failures and high-value fields
python3 scripts/daoip5_compliance_check.py --verbose

# Exit with code 1 if any P0 issues exist — for CI integration
python3 scripts/daoip5_compliance_check.py --fail-on-p0
```

### CI integration

Add to your CI pipeline to prevent P0 regressions from being merged:

```yaml
# In your CI config (e.g., .github/workflows/compliance.yml)
- name: DAOIP-5 compliance gate
  run: python3 scripts/daoip5_compliance_check.py --fail-on-p0
```

This will fail the build if a developer introduces a new fabricated required field.
It will not fail on P1/P2/P3 issues, which require judgment calls and should be
reviewed in PRs rather than automatically blocked.

### Interpreting score changes over time

When you re-run the assessment after a schema map change or new snapshot:

| What changed | What it means | What to do |
|---|---|---|
| Column-backed % increased | A HARDCODED or NULL field now has a source column mapping | Verify the source column actually has data in the new snapshot (run the row-level null check) |
| Column-backed % decreased | A field lost its source mapping, or a new source was added with low coverage | Investigate before merging — may indicate a regression |
| P0 count decreased | A fabricated required field was fixed | Confirm the fix is correct; add a row to the historical tracking table |
| P0 count increased | A new fabricated value was introduced | Treat as a blocking issue; do not merge until resolved |
| New P1 appeared | A bronze table was added that contains data for an unmapped silver field | Schedule the wiring work |
| Score unchanged but P0 count decreased | A P0 was downgraded to P2 or P3 | Still progress, even if the score didn't move |

### Adding a new data source

1. Create `og_dagster/configs/schema_maps/active/daoip5_{source_name}.yaml` following the
   existing structure (manifest section + schemas section with grant_pools / projects /
   grant_applications subsections)

2. The script will automatically detect and assess it on next run — no script changes needed

3. Ensure `manifest.source_system` is populated with a descriptive name — it appears in
   report headers

4. If the source has structural incompatibilities with DAOIP-5 (like ENS), add a
   `compatibility_note` to the manifest explaining which schemas are not implemented and why

5. Add P1/P2/P3 entries to the relevant static registries in the script for any known
   issues that the auto-detection cannot catch

6. Add a row to the historical tracking table below with the first assessment results

---

## Historical Compliance Tracking

Record assessment results here whenever the scores change materially (>2% shift in any source).

| Date | SCF | Gitcoin 2.0 | ENS | P0 Total | Notes |
|------|-----|------------|-----|----------|-------|
| 2026-03-31 | 55% | 74% | 14% | 2 | Baseline assessment |

---

## Known Limitations of This Assessment

### 1. Does not check row-level data completeness

A field classified as SOURCE_MAPPED may still be empty in 90% of rows if the source system
does not consistently populate the source column. The methodology assesses whether a path
exists from source to silver — not whether the path carries non-null data.

**Impact:** SOURCE_MAPPED coverage percentages overstate the practical completeness of the
data for sparsely-populated source columns.

**Mitigation:** Complement this assessment with periodic row-level null rate checks per field
in the silver tables. Flag any SOURCE_MAPPED field with >50% null rate.

### 2. Does not validate enum values

`grantFundingMechanism` classified as SOURCE_MAPPED for Gitcoin may still map `strategy_name`
values to outputs that are not in the DAOIP-5 recognized mechanism list. The script confirms
that a source column is being used, not that the output values conform to the enum.

**Impact:** Enum compliance is overstated for sources with complex mechanism mapping logic.

**Mitigation:** Add a separate enum validation step that samples silver table values and
checks them against the DAOIP-5 enum list.

### 3. Does not validate ID format compliance

DAOIP-5 specifies `daoip-5:{system}:{schema}:{id}` as the ID format for all entities.
The script confirms that a transform exists on `id` fields — but does not validate that the
transform produces correctly formatted IDs.

### 4. Extension fields are not scored

DAOIP-5 extension namespaces (`org.stellar.communityfund`, `co.gitcoin`, `io.ens`) contain
valuable source-specific metadata. These fields are mapped from source columns and contribute
to the richness of the data, but they are not DAOIP-5 core fields and are not measured here.

### 5. P1/P2/P3 registries require manual maintenance

The static registries for P1/P2/P3 issues in the script must be manually updated when issues
are fixed or new ones are discovered. There is no automated detection for these issue types.
A fixed P1 that is not removed from the registry will continue to appear in reports as unfixed.
The registries should be reviewed whenever a schema map is updated.

### 6. Does not assess JSON-LD context

The `@context` field and full JSON-LD conformance (`@type`, `@id` on nested objects) are
not checked. DAOIP-5 is a JSON-LD schema and full conformance would require these to be present.
This is acceptable for internal analytics but would need to be addressed before publishing
DAOIP-5-compliant data to external systems.
