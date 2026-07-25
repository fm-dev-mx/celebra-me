# Content Payload ↔ SQL Embedded JSON Synchronization

When a SQL patch embeds a content payload as `v_new_content := '...'::jsonb;`, keep the standalone
canonical JSON file and the SQL-embedded copy synchronized.

## Problem

Two copies exist:

1. **Canonical file**: `.agent/plans/active/<slug>-db-payload.json` (or project equivalent)
2. **SQL-embedded copy**: inside `scripts/manual/production-patches/<date>_<slug>.sql`

They must match or tests fail and environments diverge.

## Sync Technique

Use a short script (Python/Node) to:

1. Serialize the canonical JSON (UTF-8, stable indent).
2. Find the `v_new_content := '…'::jsonb;` assignment.
3. Replace the embedded JSON in place.
4. Verify equality.

```python
import json, re

with open('path/to/canonical-payload.json', 'r', encoding='utf-8') as f:
    canonical = json.load(f)

with open('path/to/patch.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

canonical_json = json.dumps(canonical, indent=4, ensure_ascii=False)
pattern = r"(v_new_content\s*:=?\s*')([\s\S]*?)('\s*::jsonb;)"
match = re.search(pattern, sql)
if not match:
    raise RuntimeError("Could not find v_new_content pattern in SQL")

new_sql = sql[: match.start()] + match.group(1) + canonical_json + match.group(3) + sql[match.end() :]

with open('path/to/patch.sql', 'w', encoding='utf-8') as f:
    f.write(new_sql)

assert json.loads(canonical_json) == canonical
```

Prefer a focused Jest/Vitest assertion that parses both sources and `expect`s equality.

## Pitfalls

| Pitfall                     | Mitigation                                     |
| --------------------------- | ---------------------------------------------- |
| Dollar-quoting (`$$`)       | Update regex/test if SQL quoting style changes |
| Indent mismatch             | Match `json.dumps` indent to the SQL file      |
| Apostrophes in JSON strings | Rare with `"` keys; validate before embed      |
| Non-UTF-8 SQL files         | Always UTF-8                                   |

After every canonical payload edit, re-sync SQL in the same change set.
