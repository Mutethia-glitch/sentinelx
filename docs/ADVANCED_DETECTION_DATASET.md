# Task 29 — Controlled anomaly-detection research dataset

Task 29 prepares a deterministic synthetic dataset for later anomaly-detection
research. It is not production telemetry and does not claim real-world accuracy.

## Files

- `src/ml/dataset.js`: pure deterministic generator.
- `fixtures/ml/task29-synthetic-events.jsonl`: checked-in generated records.
- `fixtures/ml/task29-manifest.json`: schema, class counts, provenance and limitations.
- `scripts/verify-dataset.js`: read-only reproducibility/privacy verifier.

## Dataset shape

The fixture contains 80 records:
- 60 synthetic baseline examples;
- 20 synthetically injected anomaly examples.

Raw normalized-style fields:
`recordId`, `timestamp`, `source`, `type`, `sourceIp`,
`destinationIp`, `user`, `host`, `action`, `status`, `severity`.

Research-only fields:
- `label`: 0 synthetic baseline, 1 injected anomaly;
- `scenario`: controlled scenario name.

No behavioral aggregate features, rolling counts, encodings, model scores, or
other Task 30 feature engineering are included.

## Privacy and provenance

Every identifier is artificial. Network addresses use documentation-only ranges
192.0.2.0/24, 198.51.100.0/24, and 203.0.113.0/24. Users are named
`research-user-##`; hosts use `synthetic-...` identifiers. There are no
emails, passwords, raw production payloads, connected-app data, or user records.

The dataset is generated entirely by SentinelX research code. Its 75/25 class
balance is deliberately constructed and must not be interpreted as an estimate
of anomaly or attack prevalence in any real organization.

Synthetic labels are test ground truth only. They do not validate detection
accuracy, generalization, false-positive rates, or operational ML performance.

## Reproducibility

The generator is deterministic: the same source produces identical canonical
LF-terminated JSONL and manifest content. On Windows, Git may check out text files
with CRLF; the verifier normalizes CRLF to LF before comparing the JSONL while
preserving all actual record and manifest checks. This avoids treating a
platform-specific text checkout as changed research data.

The verifier checks schema, counts, identifier constraints, documentation address
ranges, and stated limitations. The checked-in fixture comparison is also included
in the normal quality test suite.

Run:

```powershell
npm.cmd run quality
npm.cmd run verify:dataset
```

Expected:

`Controlled synthetic dataset schema, provenance, labels, privacy constraints and deterministic reproduction verified.`

Task 29 adds no database migration. Task 30 ML Feature Engineering remains
Not Started.

## Completion

Task 29 is **Complete**. After the cross-platform JSONL comparison fix, the
user-reported Windows acceptance verifier passed on 2026-09-30:

`Controlled synthetic dataset schema, provenance, labels, privacy constraints and deterministic reproduction verified.`

This completes dataset preparation only; it does not demonstrate real-world
model accuracy or begin Task 30 feature engineering.
