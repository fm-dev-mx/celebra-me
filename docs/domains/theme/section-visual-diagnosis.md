# Public invitation visual diagnosis by section

Use `pnpm visual:parity:diagnose` to locate reproducible visual differences between two deployed
public renderers. This extends the existing visual parity CLI and canonical invitation/demo
inventory. It does not create or accept baseline references and does not replace
`visual:parity:compare`.

## Run

Verify each environment's deployment identity first. Prefer immutable deployment URLs; if a public
alias is required, verify its deployment before and after capture. SHA arguments are
operator-provided provenance, not proof inferred from the hostname.

```sh
pnpm visual:parity:diagnose --production-url=https://production-deployment.example.com --preview-url=https://preview-deployment.example.com --production-sha=<40-character-sha> --preview-sha=<40-character-sha>
```

Use the existing `VERCEL_AUTOMATION_BYPASS_SECRET` environment variable when Preview needs
deployment protection access. It is sent only to the configured Preview origin, never to Production
or third-party image hosts. Do not put secrets in command arguments. No database writes,
provisioning, publication, or deployment occurs.

The default covers all registered invitations and discovered demos at 390×844 and 1440×900.
`--route=/xv/example` limits a troubleshooting run and marks its scope PARTIAL.
`--at=<ISO timestamp>` fixes client time across environments and repeats. A repeatable browser
random sequence also stabilizes randomized demo countdowns; it does not modify deployed code.
`--output=.tmp/visual-parity/diagnostics/<new-run>` selects a new ignored output directory; existing
results are never overwritten. Public anonymous coverage does not include guest-only personalized
states.

## Capture and comparison contract

- Use the same Chromium process/version, locale, time zone, scale, viewport, fixed client clock, and
  reduced motion settings for both environments.
- Load actual public routes with `skipEnvelope=true&animations=off`, without the test variant
  harness or the layout-changing screenshot query mode.
- Wait for fonts and decoded images, scroll to trigger deferred content, stop animations, and hide
  operational fixed overlays (navigation, consent banner and music player) using the existing capture utility. Navigation/envelope interactions
  are outside this section report.
- Align the hero and section wrappers by `data-screenshot-section`; repeated interludes retain their
  ordinal identity. Detect duplicate identities, missing sections, changed order, invalid routes,
  and failed images explicitly.
- Capture each section directly after measuring the public DOM, avoiding blank compositor regions in very tall full-page bitmaps. Reject incomplete captures. Pad unequal dimensions; never
  resize images to make layouts appear equal.
- Flag RGB channel differences above 24; surface cases exceeding 0.1% of pixels or changing
  dimensions/order. Percentage is a diagnostic ranking, not severity or acceptance. Font, text,
  source and crop metadata aid investigation; different asset hosts alone cannot establish a visual
  defect.
- Recapture suspicious pages in fresh contexts. Compare both environments again and compare each
  environment to itself. Reproducible cross-environment changes are DIFFERENT; changes between
  repeated captures are UNSTABLE. Missing sections are MISSING. Failed captures are ERROR, never
  MATCH. Missing route coverage or corrupted capture bytes fail closed.

## Review

Open the generated `index.html`. Filter by route, section or status; the highest pixel differences
appear first within each status. Each row provides Production, Preview, highlighted differences and
a 50/50 overlay. `report.json` includes deployment provenance, section dimensions, image/font
metadata, content versions, repeat noise, PNG hashes and coverage. The command exits nonzero for
differences, unstable cases, missing sections or errors, after writing the report when capture
failures can be represented.

MATCH means no difference above the documented diagnostic threshold, not certified pixel identity.
Server-rendered clock-dependent content and external embeds can still vary; unstable findings
require investigation. Human review against Production and reference acceptance in the pinned
canonical visual runtime remain separate steps. Do not automatically accept these diagnostic PNGs as
baselines.
