# XV América Bautista Asset Report

## Source

- Client folder:
  `C:\Users\fmdevmx\OneDrive\Documentos\Projects\celebra-me\Clientes\XV America Bautista\Fotos`
- Asset namespace: `src/assets/images/events/xv-america-bautista/`
- Payload: `.agent/plans/active/xv-america-bautista-db-payload.json`

## Mapping

| Asset key          | Output file               | Source photo   | Notes                                                                                                        |
| ------------------ | ------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------ |
| `hero`             | `hero.webp`               | `DSC04224.JPG` | Tight mobile crop around face, arms, and 15 balloons to avoid the background person flagged in client notes. |
| `heroDesktop`      | `hero-desktop.webp`       | `DSC04224.JPG` | Wide statement crop for desktop hero overlay.                                                                |
| `portrait`         | `portrait.webp`           | `DSC03417.JPG` | Secondary editorial statement on the bridge.                                                                 |
| `family`           | `family.webp`             | `DSC03619.JPG` | Family/emotional portrait crop.                                                                              |
| `gallery01`        | `gallery-01.webp`         | `DSC03559.JPG` | Statement portrait using previously unused photo.                                                            |
| `gallery02`        | `gallery-02.webp`         | `DSC03775.JPG` | Alternate crop using previously unused client photo.                                                         |
| `gallery03`        | `gallery-03.webp`         | `DSC03698.JPG` | [UNUSED] Removed from gallery payload to resolve duplicate photo usage with `interlude03`.                   |
| `gallery04`        | `gallery-04.webp`         | `DSC01278.JPG` | Friends/session energy.                                                                                      |
| `gallery05`        | `gallery-05.webp`         | `DSC03740.JPG` | Friends/family story.                                                                                        |
| `gallery06`        | `gallery-06.webp`         | `DSC03619.JPG` | Family close-up.                                                                                             |
| `gallery07`        | `gallery-07.webp`         | `DSC03733.JPG` | Group/session story.                                                                                         |
| `gallery08`        | `gallery-08.webp`         | `DSC03953.JPG` | Family support.                                                                                              |
| `gallery09`        | `gallery-09.webp`         | `DSC04268.JPG` | Bridge group.                                                                                                |
| `gallery10`        | `gallery-10.webp`         | `DSC04351.JPG` | Celebration/group moment.                                                                                    |
| `interlude01`      | `interlude-01.webp`       | `DSC03404.JPG` | Decorative editorial break.                                                                                  |
| `interlude02`      | `interlude-02.webp`       | `DSC01165.JPG` | Decorative editorial break; cropped to avoid the lower photographer area.                                    |
| `interlude03`      | `interlude-03.webp`       | `DSC03698.JPG` | Compact divider.                                                                                             |
| `interlude04`      | `interlude-04.webp`       | `DSC03821.JPG` | Closing/editorial divider.                                                                                   |
| `thankYouPortrait` | `thank-you-portrait.webp` | `DSC03821.JPG` | Closing portrait.                                                                                            |

## Pending

- Music: the client provided the Spotify track `Viva la Vida — Coldplay`, but the current invitation
  `MusicPlayer` requires a direct playable audio URL. Do not add the Spotify page URL to
  `music.url`; request or upload a licensed/direct audio asset before enabling the music section.
