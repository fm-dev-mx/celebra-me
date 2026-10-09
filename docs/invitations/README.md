# Invitation documentation

Per-client invitation state lives here as one file per invitation:

```text
docs/invitations/<slug>.md
```

Slug must **not** repeat `eventType` (public URL is already `/{eventType}/{slug}`); see
[`docs/core/invitation-creation-contract.md`](../core/invitation-creation-contract.md). The release
command sequence is the
[five-operation release map](../core/release-process.md#canonical-operation-map). Invitations that
must stay Local-renderable are listed in the [Local Render Corpus](../core/local-render-corpus.md).

## Authority

| Concern                                        | Owner                                               |
| ---------------------------------------------- | --------------------------------------------------- |
| Preparation schema, hygiene, creative gate     | `docs/core/invitation-preparation-contract.md`      |
| Markdown template                              | `.agent/templates/invitation/preparation-state.md`  |
| Preparation procedure                          | `.agent/skills/invitation-preparation/SKILL.md`     |
| Executable evaluation (**prepReadiness SSOT**) | `src/lib/invitation-preparation/`                   |
| Cross-cutting architecture / runbooks          | `docs/core/`, `docs/domains/` — **not** these files |

A client file may guide its own invitation but must not redefine system contracts. A documented
prepReadiness must match `evaluatePreparationReadiness`.

Gates: `pnpm validate:invitation-preparation` (prepReadiness alignment and hygiene) and
`pnpm validate:invitation-publication-transitions -- --base <sha> --head <sha>` (new
`in_progress -> published` transitions only).

## Lifecycle of a client file

- **Active:** the full preparation state from the template, updated in place until delivery.
- **Delivered:** once the event has taken place, reduce the file to identity, route, preset and
  variants, delivered state, and known constraints. Git keeps the preparation history. Keep any line
  a contract test or the preparation validator still reads.

## Index

| File                                                        | Route                            | State     |
| ----------------------------------------------------------- | -------------------------------- | --------- |
| [abril-michelle-becerra-rea](abril-michelle-becerra-rea.md) | `/xv/abril-michelle-becerra-rea` | delivered |
| [aithan-darell](aithan-darell.md)                           | `/cumple/aithan-darell`          | active    |
| [alba-rosa-quinonez](alba-rosa-quinonez.md)                 | `/cumple/alba-rosa-quinonez`     | delivered |
| [allison-scarlett](allison-scarlett.md)                     | `/xv/allison-scarlett`           | active    |
| [daniela-y-martin](daniela-y-martin.md)                     | `/boda/daniela-y-martin`         | active    |
| [destenid-sofia](destenid-sofia.md)                         | `/xv/destenid-sofia`             | active    |
| [leslie-perez](leslie-perez.md)                             | `/xv/leslie-perez`               | delivered |
| [melissa-y-luis-osmar](melissa-y-luis-osmar.md)             | `/boda/melissa-y-luis-osmar`     | active    |
| [mia-pintor](mia-pintor.md)                                 | `/xv/mia-pintor`                 | active    |
| [naydelin-paredes](naydelin-paredes.md)                     | `/xv/naydelin-paredes`           | active    |
| [norma-hernandez](norma-hernandez.md)                       | `/cumple/norma-hernandez`        | active    |
| [renata](renata.md)                                         | `/xv/renata`                     | delivered |
| [romina-rios-chaparro](romina-rios-chaparro.md)             | `/xv/romina-rios-chaparro`       | delivered |
| [valentina-hernandez](valentina-hernandez.md)               | `/xv/valentina-hernandez`        | delivered |
| [victoria-y-roberto](victoria-y-roberto.md)                 | `/boda/victoria-y-roberto`       | active    |
