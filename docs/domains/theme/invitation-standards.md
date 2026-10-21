# Invitation Standards

**Owns:** what client invitations should repeat and avoid, learned from delivered invitations, and
the retro log that lets an invitation note leave the repository.

**Does not own:** the hero contract and quality criteria
([visual design reference](visual-design-reference.md)), implementation rules
([theme architecture](architecture.md)) or the preparation schema
([`docs/core/invitation-preparation-contract.md`](../../core/invitation-preparation-contract.md)).

Read this page before the
[design-reference brief](../../../.agent/templates/creative/design-reference-brief.md) of a new
invitation. Each entry names the invitation it comes from, when it was learned and the evidence. An
entry is a lesson from one rendered result, not a preset catalog: verify current tokens and assets
before reusing a value.

## Repeat

- **R1.** Copy the reference's composition (dominant subject, scale, image and text balance), not
  only its palette and ornament. Example: `melissa-y-luis-osmar`; learned 2026-09; evidence:
  [Before/after evidence](visual-design-reference.md#melissa-and-luis-osmar-bounded-beforeafter-evidence).
- **R2.** Long messages as readable editorial prose; script type only for names and short
  signatures. Example: `melissa-y-luis-osmar`; learned 2026-09; evidence: same section: the script
  quote became editorial prose.
- **R3.** One essence sentence per hero (palette, type and composition cue) so two heroes are never
  interchangeable after swapping names. Example: `abril-michelle-becerra-rea`,
  `romina-rios-chaparro`; learned 2026-09; evidence:
  [Essence rule](visual-design-reference.md#essence-rule-anti-clone).
- **R4.** Split the honoree's name: the first word in script, the rest as a tracked serif line, and
  repeat that hierarchy in the closing. Example: `naydelin-paredes`; learned 2026-10-17; evidence:
  `hero.presentation.nameLeadWords: 1` and `thankYou.closingNameLeadWords: 1` in its definition.
- **R5.** One designed tonal band (for example an arch into a dark RSVP and gifts band, a soft
  bridge out of it); every other boundary neutral. Example: `naydelin-paredes`; learned 2026-10-17;
  evidence: design notes in [`naydelin-paredes.md`](../../invitations/naydelin-paredes.md).
- **R6.** Simplify the profile after acceptance; fewer declarations can keep the same look. Example:
  `melissa-y-luis-osmar`; learned 2026-09; evidence: profile went from 1,040 to 489 declarations
  with content and artwork hashes unchanged.
- **R7.** Add songs and other content through the typed content, not new styles. Example:
  `olivia-y-antonio`; learned 2026-10-20; evidence: the song shipped in two files (#394).

## Avoid

- **A1.** Border, inner frame, medallion and shadow all marking the same item: it reads as cheap
  template decoration. Learned 2026-09; evidence:
  [Quality criteria, Surfaces](visual-design-reference.md#comparative-quality-criteria).
- **A2.** Tiny tracked capitals for practical information (times, addresses, buttons). Example:
  `melissa-y-luis-osmar`; learned 2026-09; evidence: quality criteria, Typography; the functional
  sections were made readable.
- **A3.** A frosted or ivory card over a full-bleed client portrait when the photo is the hero.
  Learned 2026-09; evidence:
  [Hero anti-patterns](visual-design-reference.md#hero-anti-patterns-additions).
- **A4.** Writing code before the direction is agreed: the hero, name size and one accepted capture
  come first. Example: `america`; learned 2026-10-20; evidence: about 35 `style(theme)` commits and
  81 owner messages while the direction was found (#392).
- **A5.** Client tokens in shared SCSS (`--<slug>-*` read by `src/styles/invitation/scenes/**`).
  Example: `america`; learned 2026-10-20; evidence: `scenes/_lantern-route.scss` reads
  `--america-night` and `--america-night-gold`.
- **A6.** A new variant redeclaring a shared token: it changes published invitations that never
  asked for it. Example: `olivia-y-antonio`; learned 2026-10-20; evidence: `_night-route.scss`
  redeclared `--location-card-shadow` and changed three published invitations (#371).
- **A7.** Informal «tú» copy and hardcoded uppercase in shared components; guest-facing copy uses
  «usted». Example: `naydelin-paredes`; learned 2026-10-17; evidence: follow-ups in its note:
  «Contáctanos», the RSVP hints and «ENVIAR RESPUESTA».
- **A8.** Abbreviated months on the reveal card («17 · OCT · 2026»); write the full date. Example:
  `naydelin-paredes`; learned 2026-10-17; evidence: its envelope letter shows the full date and
  hides the abbreviated card date.

## Retro

About a month after the event, before the invitation's note leaves `docs/invitations/`:

1. Read the note, its pull requests and the owner's review rounds.
2. Record what worked (Repeat), what looks dated, cheap or generic (Avoid) and what took the most
   review rounds, each with the invitation, date and evidence. Change an existing entry instead of
   adding a near-duplicate.
3. Add a row to the retro log below. A retro may conclude that nothing new was learned; the row says
   so.
4. Only then delete the note, together with the invitation's definition, profile and assets when it
   expires. `pnpm validate:invitation-note-retirement` fails a pull request that deletes a note
   whose slug has no row in the retro log.

## Retro log

| Slug | Event date | Retro date | Entries |
