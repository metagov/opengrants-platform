"""Shared Airtable configuration for SCF data source."""

SCF_BASE_ID = "app8tLjMIDrjeloWN"

SCF_TABLES = {
    "bronze_scf_projects": "tblQFNVNhCxfzUgbF",       # Awarded Projects [Build only]
    "bronze_scf_submissions": "tbl57OROvn0qQTuiP",     # Awarded Submissions [Build only]
    "bronze_scf_rounds": "tbl9nsqJMzoACJVE0",          # Build Award Rounds
}

# Required columns per table (used by integration tests to validate schema)
SCF_REQUIRED_COLUMNS = {
    "bronze_scf_projects": [
        "Title",
        "Description",
        "Category",
        "Website",
        "Total Awarded",
        "Total Paid",
    ],
    "bronze_scf_submissions": [
        "Submission / Project",
        "Submission Title",
        "Round",
        "Total Awarded (USD)",
        "Total Paid (USD)",
    ],
    "bronze_scf_rounds": [
        "Name",
        "Quarter, Year",
        "Total Awarded (USD)",
        "Total Paid (USD)",
    ],
}
