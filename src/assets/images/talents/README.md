# Talent library

Reusable photographic identities for invitation demos and client packs.

## Principle

- A **talent** owns face, body, wardrobe, and world locks.
- An **event pack** under `src/assets/images/events/<slug>/` only **copies** approved shots from a
  talent. It does not invent a new identity.
- Never mix two talents in one invitation pack.

## Layout

```text
talents/
  README.md                 ← this file
  <talentId>/
    MODEL.md                ← identity + wardrobe + world + anti-slop + shot budget
    masters/                ← frozen hero / master frames (do not regenerate)
    locks/
      face.webp
      body.webp
      environment.webp
    shots/                  ← approved reusable frames
    shots/_quarantine-drift/  ← rejected gens (optional; do not ship)
```

## Active talents

| ID                   | Role                                                          | Use in celestial-blue demo |
| -------------------- | ------------------------------------------------------------- | -------------------------- |
| `camila-ice-loggia`  | Canonical XV session — updo, strapless gown, loggia blue hour | **Yes — only this**        |
| `camila-ice-waves`   | Separate person — long waves + off-shoulder sleeves (seeded)  | **No** — later pack        |
| `camila-marble-moon` | Legacy marble/moon salon archive                              | **No**                     |

Work lock for the current celestial-blue overhaul: `camila-ice-loggia/locks/body.webp` (plus face +
environment + frozen heroes). Do not use marble-moon body locks; that talent has no
`locks/body.webp`.

## Generation rules

1. Face-shot refs: follow `SHOT-PROMPTS.md` (face + body + **at most 1** hero master).
2. Place-only shots may use `locks/environment.webp` (+ desktop master) without inventing a new
   face.
3. Reject: face drift, giant moon, glitter storm, porcelain skin, pose/angle near-duplicates.
4. Event pack filenames stay stable (`gallery-01.webp`, etc.); copy from `shots/` after approval.
5. Naming: `camila-marble-moon` archive uses event pack filenames in `shots/`; `camila-ice-*` use
   shot IDs mapped to demo filenames in `MODEL.md` / `SHOT-PROMPTS.md`.
