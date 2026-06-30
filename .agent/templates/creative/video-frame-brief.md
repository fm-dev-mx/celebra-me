---
template: video-frame-brief
purpose: Structure a text-to-image prompt for initial or final video frames
version: 1.0.0
brand: celebra-me
language: en
---

# Video Frame Prompt Brief

> Frame prompts target a specific moment in a video — the opening shot (initial frame) or the
> closing shot (final frame). These frames must stand alone as hero images while being consistent
> with the video's visual language.

## Metadata

| Field            | Value                                              |
| ---------------- | -------------------------------------------------- |
| **Campaign**     |                                                    |
| **Event type**   | XV / Wedding / Baby Shower / Birthday / Baptism    |
| **Frame type**   | Initial / Final                                    |
| **Aspect ratio** | 9:16 (vertical) / 16:9 (horizontal) / 1:1 (square) |

## Narrative Context

> _What happens in the video? Describe the scene before (for initial) or after (for final) this
> frame._

## Mood & Emotion

> _What feeling should this frame convey?_

## Visual Description

> _Detailed description of the frame — subject, composition, lighting, colors,
> foreground/background._

## ComfyUI / Local Model Prompt

### Positive Prompt

```
[Subject], [scene/setting], [lighting], [colors], [mood],
[specific details], [composition], [technical quality words]
```

### Negative Prompt

```
[artifacts to avoid], [style elements to exclude]
```

### Generation Parameters

| Parameter  | Value                                           |
| ---------- | ----------------------------------------------- |
| Model      | Juggernaut XL v9 / Flux Dev fp8 / RealVis XL v5 |
| CFG        | 4.0–4.5                                         |
| Steps      | 30–35                                           |
| Sampler    | dpmpp_2m_sde                                    |
| Scheduler  | karras                                          |
| Seed       | (to be logged)                                  |
| Resolution | (based on aspect ratio)                         |

## Reference / Style Notes

> _Any existing images, color palettes, or style references._

## Notes

- Log all generation parameters for reproducibility
- If generating multiple frames, use same seed family for consistency
- For face consistency across frames, note this is not yet supported (no IP-Adapter/InstantID)
