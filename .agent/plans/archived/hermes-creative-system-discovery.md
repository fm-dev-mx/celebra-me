# Hermes Creative System — Discovery Audit

> **Date**: 2026-06-29 **Author**: Jeremías (Hermes Agent) **Status**: final · discovery **Scope**:
> Hermes setup, Celebra-me project context, image generation, creative production gaps
>
> **⚠️ BOUNDARY CORRECTION (Loop 1B):** This report was written during the initial audit before the
> Celebra-me/CEJ architectural boundary was clarified. CEJ is a **separate brand** and must not live
> inside the Celebra-me repository. All CEJ references in this document are included as historical
> audit notes only — they do not define the project scope. See `.agent/plans/active/README.md` for
> the corrected architecture. A separate Hermes-level creative workspace (`creative-ops`) should
> house multi-brand creative infrastructure, brand briefs for non-Celebra-me brands, and local
> image-generation workflows.

---

## 1. Executive Summary

**What we have:**

- Hermes Agent v0.17.0 fully operational with delegation, streaming, memory, and 87 global skills.
- Celebra-me repo is well-structured with AGENTS.md, `.agent/` dir (plans, rules, skills,
  workflows), git safety, gatekeeper, and 14 repo-local skills.
- ComfyUI running on localhost:8188 with Flux Dev fp8, Juggernaut XL v9, RealVis XL v5.
- 8+ ComfyUI workflows (txt2img, img2img, upscale) and a batch generation script.
- Previously generated demo images exist in ComfyUI output.

**What we don't have:**

- **No FAL key** — `FAL_KEY` is commented out in `.env`. The global `image_generate` tool won't
  work.
- **No Hermes-to-ComfyUI integration** — ComfyUI runs standalone on port 8188 with no Hermes tool
  wrapping it. The `comfyui` global skill exists but hasn't been loaded/configured.
- **No creative-content-pipeline skill** (neither global nor repo-local).
- **No brand briefs** — no Celebra-me brand guidelines document, no CEJ brief at all.
- **No face restoration models** — `facerestore/` directory is empty (CodeFormer .pth was mentioned
  but never downloaded to the correct ComfyUI path).
- **No ControlNet, IP-Adapter, LoRAs** (only Qwen-Image-Edit LoRA present).
- **No `.hermes.md` or `HERMES.md`** — AGENTS.md is the sole primary context file.
- **No CEJ information** — no formal brief exists yet.
- **No embed metadata/reproducibility system** for image generation.
- `skills.external_dirs` is **empty** — repo-local `.agent/skills/` are not auto-loaded by Hermes.
- **Curator is disabled** (`curator.enabled: false`).
- Config version is outdated (v30 → v31).

**Risks:**

- The repo has 3 unstaged modified files on `develop`. Any write operation must go through git
  safety protocol.
- FAL key missing means image_gen tool is non-functional — this is a blocker for cloud-based
  generation.
- CEJ is a blank page — any attempt to produce CEJ content without a brief will invent data.
- `skills.external_dirs` empty means Hermes doesn't discover repo-local skills. They must be loaded
  manually or via a configured path.

**Recommended next step:** Loop 1 — establish source of truth by documenting where briefs,
workflows, and skills live, and how Hermes discovers them.

---

## 2. Git State

| Property                | Value                                                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Repository              | `fm-dev-mx/celebra-me` (GitHub)                                                                                              |
| Current branch          | `develop`                                                                                                                    |
| Staged changes          | None                                                                                                                         |
| Unstaged changes        | 3 files modified: `src/components/invitation/CountdownTimer.astro`, `src/lib/adapters/event.ts`, `src/lib/time/demo-date.ts` |
| Untracked files         | 1 new: `src/lib/time/demo-date.ts` (marked with `A` — added to index?)                                                       |
| Stash                   | 1 entry: `stash@{0}: WIP on main: d0811f99 docs(agent): update section CSS splitting results`                                |
| Detached HEAD worktrees | Multiple under `.codex/worktrees/` (opencode tool) — not relevant to this session                                            |

**Git safety verified.** The 3 modified files are user-owned work that must be preserved. No staged
changes exist. This session will NOT perform any git write operations.

---

## 3. Hermes / Project Context State

| Element                 | Exists | Path                            | Status              | Recommended Action                                                                         |
| ----------------------- | -----: | ------------------------------- | ------------------- | ------------------------------------------------------------------------------------------ |
| `.hermes.md`            |     ❌ | —                               | Missing             | Should NOT be created — AGENTS.md already serves this role                                 |
| `HERMES.md`             |     ❌ | —                               | Missing             | Same as above                                                                              |
| `AGENTS.md`             |     ✅ | `AGENTS.md` (project root)      | **Primary context** | Preserve as-is. It references `.agent/` correctly                                          |
| `CLAUDE.md`             |     ❌ | —                               | Missing             | Should NOT be created per AGENTS.md rule: "Do not introduce provider-specific agent files" |
| `.cursorrules`          |     ❌ | —                               | Missing             | Same as above                                                                              |
| `.agent/`               |     ✅ | `.agent/` (project root)        | Active              | Well-structured: index.md, load-skills.md, plans/, rules/, skills/, workflows/, tmp/       |
| `.agent/index.md`       |     ✅ | `.../.agent/index.md`           | Active              | Discovery map for all skills and workflows                                                 |
| `.agent/load-skills.md` |     ✅ | `.../.agent/load-skills.md`     | Active              | Protocol says "Do NOT load skills from outside the repository"                             |
| `.agent/rules/`         |     ✅ | 11 rule files                   | Active              | Covers git safety, gatekeeper, database, API, production, styling, workflow                |
| `.agent/plans/`         |     ✅ | 40 active + 40 archived         | Active              | Well-governed with README and schema                                                       |
| `.agent/skills/`        |     ✅ | 14 skills (all with SKILL.md)   | Active              | Lack creative/ branding skills                                                             |
| `.agent/workflows/`     |     ✅ | 4 workflows                     | Active              | error-remediation, plan-authoring, system-doc-alignment, theme-architecture-governance     |
| `.agent/tmp/`           |     ✅ | Various temp files              | Active              | Contains QA screenshots, scripts, visual explorations                                      |
| `.hermes/`              |     ✅ | `.hermes/` (project root)       | Active              | Contains plans/ with 1 spec (lead-attribution)                                             |
| `.hermes/plans/`        |     ✅ | 1 file                          | Active              | `2026-06-28_235959-deterministic-lead-attribution.md`                                      |
| `.opencode/`            |     ✅ | `.opencode/` (project root)     | Active              | opencode.json + graphify plugin                                                            |
| `docs/`                 |     ✅ | `docs/` (project root)          | Active              | core/, domains/, archive/ with well-organized docs                                         |
| `docs/core/`            |     ✅ | 7 files                         | Active              | project-conventions, architecture, content-schema, git-governance, etc.                    |
| `docs/domains/`         |     ✅ | 6 domain dirs                   | Active              | content, database, intake, rsvp, theme, tracking                                           |
| Brand briefs            |     ❌ | —                               | Missing             | **Critical gap** — no Celebra-me brand guidelines document                                 |
| CEJ brief               |     ❌ | —                               | Missing             | **Critical gap** — no CEJ information at all                                               |
| Memory notes            |     ✅ | Built-in MEMORY.md (1984 chars) | Active              | Contains Hermes config notes, ComfyUI setup, photorealism research, Jeremías persona       |
| User profile            |     ✅ | USER.md (1281 chars)            | Active              | Contains Francisco's preferences, conventions, Spanish tone                                |
| `SOUL.md`               |     ✅ | `AppData/Local/hermes/SOUL.md`  | Active              | Generic Hermes Agent persona (513 bytes) — not customized                                  |

### Key Observations

**AGENTS.md** (7444 bytes, 129 lines) is the canonical entry point. It defines:

- Loading order (AGENTS.md → `.agent/index.md` → `.agent/load-skills.md` → gatekeeper)
- Authority hierarchy (user > AGENTS.md > `.agent/**` > docs)
- 13 non-negotiable rules (Spanish UI, English code, SCSS over Tailwind, Conventional Commits, no
  `.cursor/`/`CLAUDE.md`, etc.)
- Domain rules via `.agent/rules/`
- Validation selection from `package.json`
- Key commands table

**Missing from AGENTS.md / `.agent/`:**

- Any reference to creative workflows or content production
- No mention of image generation, ComfyUI, or visual asset creation
- No brand brief repository or convention
- No content profile system documented
- No CEJ domain reference

---

## 4. Skills State

| Aspect                            | Status                | Details                                                                                                                                                                                                                                      |
| --------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Global Skills                     | ✅ 87 installed       | Covers git, github, creative (12), media, mlops, software-development, etc.                                                                                                                                                                  |
| Repo-local Skills                 | ✅ 14 (all SKILL.md)  | Accessibility, agent-communication, animation-motion, astro-patterns, backend-engineering, commit-planner, copywriting-es, documentation-governance, frontend-design, seo-metadata, supabase, supabase-postgres, testing, theme-architecture |
| `skills.external_dirs`            | ⚠️ **Empty** `[]`     | Global Hermes config has `skills.external_dirs: []` — Hermes does NOT discover repo-local skills automatically                                                                                                                               |
| `skills.write_approval`           | `false`               | No approval needed for skill writes                                                                                                                                                                                                          |
| `creative-content-pipeline` skill | ❌ **Does not exist** | Neither global nor repo-local                                                                                                                                                                                                                |
| Brand brief skills                | ❌ **Does not exist** | Neither global nor repo-local                                                                                                                                                                                                                |
| CEJ skill                         | ❌ **Does not exist** | Cannot be created until CEJ brief exists                                                                                                                                                                                                     |

### Gap Analysis

**The repo's `.agent/load-skills.md` explicitly says:**

> "Do NOT load skills from outside the repository."

**But Hermes' `skills.external_dirs` is empty**, so Hermes never sees repo-local skills. This is a
**structural disconnect** — Hermes loads global skills (from `AppData/Local/hermes/skills/`), the
repo expects agents to load from `.agent/skills/`, but there's no bridge between them.

**Recommendation:** Either:

1. Set `skills.external_dirs` to include the repo's `.agent/skills/` path in Hermes config (requires
   config change, needs approval), OR
2. Keep repo-local skills isolated and load them manually via `skill_view()` per task (current
   approach), OR
3. Create a hybrid: use global Hermes skills for cross-project creative tasks, and repo-local skills
   for Celebra-me-specific tasks.

**For the creative system:** A global Hermes skill (`creative-content-pipeline`) would be ideal
since creative content production is cross-project. But it must reference repo-local briefs.

---

## 5. Subagents / Delegation State

| Aspect                    | Status        | Details                                        |
| ------------------------- | ------------- | ---------------------------------------------- |
| Delegation available      | ✅ Yes        | Tool is active and listed in `hermes doctor`   |
| `max_concurrent_children` | 3             | Can run up to 3 parallel subagents             |
| `max_spawn_depth`         | 1             | Subagents are leaf-only (no nested delegation) |
| `orchestrator_enabled`    | `true`        | Orchestrator role is available                 |
| `subagent_auto_approve`   | `false`       | Subagents require approval for operations      |
| `child_timeout_seconds`   | 0 (unlimited) | No timeout on child agents                     |

### When delegation adds value for Celebra-me

1. **Parallel creative draft generation** — reel scripts + post copy simultaneously.
2. **Image prompt engineering** — subagent researches/invents prompts while main agent handles
   context.
3. **Creative QA** — separate subagent reviews output for tone, brand compliance, and visual
   quality.
4. **Multi-format production** — reel + carousel + static post in parallel.
5. **Research independent of generation** — one subagent checks trends/references while another
   produces.

### When NOT to use delegation

1. **Simple single-item tasks** — a direct tool call is faster and cheaper.
2. **Tasks requiring memory context** — subagents have no memory access.
3. **Gemini/vision-dependent tasks without explicit pass-through** — model inheritance is from
   parent.
4. **Tasks needing user interaction** — subagents cannot use `clarify`.

### Risks

- **Context loss**: subagents don't inherit the full conversation, so each delegation must be
  self-contained with all relevant context.
- **Oversight cost**: 3 parallel subagents = 3 summaries to review before integrating.
- **Cost multiplier**: each subagent burns model tokens independently.

---

## 6. Image Generation State

| Capability                     |     Exists | Evidence                                                                                                                                                                                          | Est. Quality  | Gap                                                                                                                               |
| ------------------------------ | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Text-to-image**              | ✅ Partial | ComfyUI workflows: `celebra_flux_dev_txt2img.json`, `celebra_juggernaut_txt2img.json`, `celebra_realvis_txt2img.json`, `celebra_jugg_v4.json`, `celebra_jugg_v5.json`, `celebra_color_boost.json` | Good (8-9/10) | No Hermes tool integration — must use ComfyUI API manually or wrap via skill. FAL key missing means `image_generate` tool is dead |
| **Image-to-image**             | ✅ Partial | `celebra_img2img_refine.json` workflow                                                                                                                                                            | Good (8/10)   | Same integration gap                                                                                                              |
| **Upscaling**                  | ✅ Partial | upscale workflows; NMKD + UltraSharp models in shared models dir                                                                                                                                  | Good (7-8/10) | Not integrated into any automated pipeline                                                                                        |
| **Inpainting**                 |    ❌ None | No workflow found, no inpainting model downloaded                                                                                                                                                 | —             | Requires inpainting model (SDXL or Flux inpaint variant)                                                                          |
| **Face restoration**           |    ❌ None | `facerestore/` dir is empty. CodeFormer .pth mentioned in research but not downloaded to ComfyUI path                                                                                             | —             | **Blocker for photorealism** — without it, faces look plastic                                                                     |
| **Identity/character control** |    ❌ None | No IP-Adapter, no InstantID, no face-swap models                                                                                                                                                  | —             | For client-consistent face generation (e.g., same couple across images)                                                           |
| **Visual reference**           |    ❌ None | No ControlNet models in shared models dir                                                                                                                                                         | —             | For pose/edge/depth-guided generation                                                                                             |
| **Initial/final frame**        |    ❌ None | No frame-generation workflow                                                                                                                                                                      | —             | Could be done with existing txt2img, but no pipeline exists                                                                       |
| **Video generation**           |    ❌ None | No video models, no frame interpolation workflows beyond installed dir placeholder                                                                                                                | —             | Not a priority yet                                                                                                                |
| **Batch generation**           | ✅ Partial | `generate_demo.py` + `demo_batch_config.json` in ComfyUI dir                                                                                                                                      | Good          | Script-driven, not agent-driven                                                                                                   |
| **Prompt templates**           |    ❌ None | No structured prompt library or template system                                                                                                                                                   | —             | Each prompt is hand-crafted per workflow                                                                                          |
| **Metadata/reproducibility**   |    ❌ None | No system to track seeds, prompts, CFG, sampler — workflows include seed field but no log/replay mechanism                                                                                        | —             | Cannot reproduce or iterate systematically                                                                                        |

### Active ComfyUI Details

- **Status**: ✅ Running on `localhost:8188` (PID 37372)
- **Install path**: local ComfyUI install directory
- **Custom nodes**: ComfyUI-Manager only (plus one custom `websocket_image_save.py`)
- **Extra models path**: shared models directory (shared between Comfy Desktop and comfy-cli)
- **Output dir**: ComfyUI output directory
- **Shared output**: shared ComfyUI output directory

### Installed Models

| Model                                                         | Type                   | Size   | Purpose                            |
| ------------------------------------------------------------- | ---------------------- | ------ | ---------------------------------- |
| `flux1-dev-fp8.safetensors`                                   | Diffusion model (UNET) | ~7GB   | General high-quality txt2img       |
| `Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors`           | SDXL checkpoint        | ~6.5GB | Photorealism (weddings, portraits) |
| `RealVisXL_V5.0_fp16.safetensors`                             | SDXL checkpoint        | ~6.5GB | Photorealism (alternative)         |
| `z_image_turbo_bf16.safetensors`                              | Diffusion model        | ~?     | Fast generation                    |
| `clip_l.safetensors`                                          | CLIP text encoder      | ~?     | Required for SDXL                  |
| `t5xxl_fp8_e4m3fn.safetensors`                                | T5 text encoder        | ~?     | Required for Flux                  |
| `ae.safetensors`                                              | VAE                    | ~?     | Flux VAE                           |
| `qwen_image_vae.safetensors`                                  | VAE                    | ~?     | Qwen VAE                           |
| `4x_NMKD-Superscale-SP_178000_G.pth`                          | Upscaler               | ~?     | 4x upscale                         |
| `4x-UltraSharp.pth`                                           | Upscaler               | ~?     | 4x upscale                         |
| `Qwen-Image-Edit-2509-Lightning-4steps-V1.0-bf16.safetensors` | LoRA                   | ~?     | Image editing                      |

---

## 7. Local Models

| Aspect                   | Status                      | Evidence                                                                                                      |
| ------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Local runtime**        | ✅ ComfyUI running          | PID 37372 on localhost:8188                                                                                   |
| **Local endpoints**      | ✅ REST API available       | `http://127.0.0.1:8188` — supports `/prompt`, `/history`, `/queue`, `/view`, etc.                             |
| **Installed models**     | ✅ 3 main + support files   | See table above                                                                                               |
| **Workflows**            | ✅ 8+ JSON workflow files   | ComfyUI workflows directory                                                                                   |
| **Batch scripts**        | ✅ Python script            | `generate_demo.py` + `demo_batch_config.json` in ComfyUI dir                                                  |
| **Hardware**             | RTX 5070 Ti (16 GB VRAM)    | From memory: ~14.4 GB free, 1882 MiB used                                                                     |
| **Hermes integration**   | ❌ None                     | No Hermes tool, skill, or config references ComfyUI                                                           |
| **Possible integration** | ✅ Via comfyui global skill | The global `comfyui` skill (in creative category) exists but hasn't been loaded yet. It can wrap the REST API |
| **FAL integration**      | ❌ No FAL key               | `FAL_KEY` commented out in `.env`. `image_generate` tool (which uses FAL) will fail                           |
| **Other runtimes**       | ❌ None                     | No AUTOMATIC1111, InvokeAI, Ollama for image models                                                           |

---

## 8. Main Gaps

### 🔴 Blockers (must fix before any creative production)

1. **FAL key missing** — `image_generate` tool is non-functional. Either configure FAL_KEY or
   integrate ComfyUI as the generation backend.
2. **No face restoration** — `facerestore/` directory is empty. Without CodeFormer/GFPGAN, generated
   faces will have plastic look (confirmed issue from memory).
3. **No CEJ brief** — absolutely no information about CEJ exists. Cannot produce CEJ content without
   inventing data.
4. **`skills.external_dirs` empty** — repo-local skills are not discoverable by Hermes. Creative
   skills won't load automatically.

### 🟡 Important Gaps (should fix before scaling)

5. **No creative-content-pipeline skill** — no structured workflow for producing reels, posts, image
   prompts, or carousels.
6. **No brand briefs** — no Celebra-me brand guidelines, tone, visual style, or audience definition
   document.
7. **No ControlNet/IP-Adapter** — can't do pose-guided, edge-guided, or style-consistent generation.
8. **No prompt template system** — every generation starts from scratch; no reusable prompt
   patterns.
9. **No metadata/reproducibility** — seeds, CFG, sampler settings aren't logged for iteration.
10. **No inpainting model** — can't do targeted image edits (replacing parts of generated images).
11. **No initial/final frame pipeline** — for video-style transitions in invitations.
12. **Config version outdated** — v30 → v31. `hermes doctor --fix` recommended.

### 🟢 Optional Improvements

13. **No identity consistency tools** — InstantID or IP-Adapter for consistent faces across images.
14. **No video generation** — out of scope for now unless CEJ requires it.
15. **Curator disabled** — not critical for creative work but useful for memory hygiene.
16. **Custom persona (SOUL.md)** — current SOUL.md is generic Hermes, not customized for Celebra-me
    creative work.

---

## 9. Recommended Architecture

### Core Principles

1. **AGENTS.md remains the single source of truth** for project context. No `.hermes.md` or
   `HERMES.md` needed.
2. **Briefs live in `.agent/briefs/`** — new directory parallel to rules/, skills/, workflows/. Each
   brand gets one brief (`celebra-me.md`, `cej.md`).
3. **Creative skill is a global Hermes skill** — `creative-content-pipeline` lives in
   `AppData/Local/hermes/skills/` (not repo-local) so it can work across projects.
4. **Workflows extend `.agent/workflows/`** — add a `creative-production.md` workflow.
5. **Templates live in `.agent/templates/`** — new directory for prompt templates, copy templates,
   and content structures.
6. **ComfyUI integration via Hermes `comfyui` global skill** — load the existing `comfyui` skill
   (creative category) and configure it for `localhost:8188`.
7. **Repo-local skill loading** — either set `skills.external_dirs` or document the manual load
   pattern.

### Structure Diagram

```text
celebra-me/                    (Project root — AGENTS.md is entry point)
├── AGENTS.md                ← Primary context (unchanged)
├── .agent/
│   ├── index.md             ← Discovery map (add creative workflows/domains)
│   ├── load-skills.md       ← Protocol (may need update to allow external skill loading)
│   ├── briefs/              ← 🆕 Brand briefs
│   │   ├── celebra-me.md
│   │   └── cej.md           ← (placeholder until info provided)
│   ├── rules/               ← Existing (11 files)
│   ├── plans/               ← Existing governance
│   │   ├── active/
│   │   └── archived/
│   ├── skills/              ← Existing (14 repo-local skills)
│   ├── workflows/           ← Existing + 🆕 creative-production.md
│   └── templates/           ← 🆕 Prompt & copy templates
│       ├── prompts/
│       └── copy/

Hermes home directory (config/skills/)
├── skills/
│   ├── creative-content-pipeline/  ← 🆕 Global Hermes skill
│   ├── comfyui                     ← Existing (load & configure)
│   └── ... (87 existing skills)
├── .env                     ← Add FAL_KEY or configure ComfyUI integration
└── config.yaml              ← Set skills.external_dirs to include repo path
```

### What stays unchanged

- `AGENTS.md` — still the canonical entry point
- All existing `.agent/rules/` — git safety, gatekeeper, database, etc.
- All existing `.agent/skills/` — 14 repo skills
- `.hermes/` — leave as-is (has its own plan for lead-attribution)
- `.opencode/` — leave as-is (opencode-specific)
- `docs/` — leave as-is (architecture and domain docs)
- All ComfyUI workflows and models — leave as-is

---

## 10. Recommended Implementation Loop

### Loop 1 — Context and Source of Truth

**Goal:** Define where the creative context lives and how Hermes should discover it.

**What to do (Jeremías can implement automatically):**

- Load the `hermes-agent` skill to review Hermes config conventions.
- Decide whether to use `skills.external_dirs` or manual loading.
- Create `.agent/briefs/` directory.
- Add briefs/ and templates/ to `.agent/index.md` discovery map.

**What needs manual approval:**

- Changes to Hermes `config.yaml` (`skills.external_dirs`).
- Approval to create new directories under `.agent/`.

**Validation:** Jeremías can explain where briefs, workflows, and skills live.

---

### Loop 2 — Brand Briefs

**Goal:** Create Celebra-me brand brief; keep CEJ as placeholder.

**What to do (Jeremías can implement):**

- Author `.agent/briefs/celebra-me.md` from existing knowledge:
  - Premium digital invitation platform
  - Social events (XV, wedding, baby shower, birthday, baptism)
  - Sold via WhatsApp, visual and emotional experience
  - Spanish UI copy, warm/formal tone
  - Target: Hispanic families, event planners
  - Visual: elegant, minimalist, soft romantic palette
- Create `.agent/briefs/cej.md` as placeholder with minimum required info fields.

**Validation:**

- Celebra-me brief is usable for copywriting and image prompting.
- CEJ is clearly marked: `STATUS: awaiting brief from Francisco`.

---

### Loop 3 — Creative Skill

**Goal:** Create `creative-content-pipeline` global Hermes skill.

**What to do (Jeremías can implement):**

- `skill_manage(action='create', name='creative-content-pipeline')` with:
  - Reel script generation (structure, hook, CTA)
  - Social post/carousel generation (format, copy VSL, visual desc)
  - Image prompt engineering (SDXL/Flux prompt structures for invitations)
  - Initial/final video frame prompting
  - Creative QA checklist
  - Brand brief loading protocol

**Validation:** The skill produces consistent outputs for reels, posts, prompts, and images when
used with a loaded brand brief.

---

### Loop 4 — Local Image Models

**Goal:** Integrate ComfyUI into Hermes workflow.

**What to do (Jeremías can implement):**

- Load the existing `comfyui` global skill and configure it for the local endpoint.
- Create prompt template files in `.agent/templates/prompts/`:
  - `wedding-photorealism.md`
  - `editorial-portrait.md`
  - `invitation-cover.md`
  - `video-frame-prompt.md`
- Document the working CFG/sampler params (CFG 4-4.5, dpmpp_2m_sde+karras, 35 steps).

**What needs manual intervention:**

- Face restoration models downloaded to correct ComfyUI path.
- Optional: ControlNet models for pose/edge control.

**Validation:** Jeremías knows when to use Flux vs Juggernaut, what inputs are required, how to
structure prompts, and how to report parameters.

---

### Loop 5 — Subagents and QA

**Goal:** Define when to delegate and how to review outputs.

**What to do (Jeremías can implement):**

- Document delegation patterns in `creative-content-pipeline` skill.
- Define creative QA checklist in `.agent/templates/` or the skill itself.

**Validation:** The system can produce a small campaign with QA review in one flow.

---

### Loop 6 — Real Test

**Goal:** Generate:

- 1 reel script for Celebra-me
- 1 post/carousel
- 1 image prompt
- 1 initial/final video-frame prompt

**Validation:** Issues are detected before scaling.

---

## 11. What Francisco Should Do Manually

| Item                                    | Action                                                                                                         | Priority                     |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| **Review this discovery report**        | Read and confirm findings, especially gaps and risks                                                           | 🔴 Before Loop 1             |
| **Provide FAL key**                     | Set `FAL_KEY` in `.env` or confirm ComfyUI-only path                                                           | 🔴 Before Loop 4             |
| **Provide CEJ information**             | What CEJ stands for, what it sells, target audience, tone, visual style, content goals, restrictions, examples | 🔴 Before Loop 2 (CEJ brief) |
| **Confirm local model paths**           | Are the shared model and ComfyUI paths correct? Any changes?                                                   | 🟡 Before Loop 4             |
| **Approve `skills.external_dirs`**      | Should Hermes config be updated to discover repo skills automatically?                                         | 🟡 Before Loop 1             |
| **Run `hermes doctor --fix`**           | Migrate config from v30 to v31                                                                                 | 🟡 Optional                  |
| **Download CodeFormer model**           | Place `codeformer.pth` in ComfyUI's `models/facerestore/`                                                      | 🟡 When face quality matters |
| **Approve creative system setup**       | Confirm the architecture in §9 before I implement                                                              | 🟡 Before Loops 1-3          |
| **Provide existing successful prompts** | Any saved prompts that worked well for previous image generation                                               | 🟢 Nice-to-have              |

---

## 12. Final Recommendation

### Implement first — Loop 1 (Context and Source of Truth)

This is the **foundation**. Without it, everything else is ad-hoc:

1. Establish where briefs, workflows, and templates live.
2. Decide on the skills loading approach (external_dirs vs manual).
3. Document the structure in `.agent/index.md`.

### Leave for later — Loops 5 (Subagents/QA) and 6 (Real Test)

These depend on Loops 1-4 being complete. No point designing QA for a pipeline that doesn't exist
yet.

### Do NOT do yet

- ❌ Create CEJ content — no brief exists
- ❌ Install ControlNet/IP-Adapter — nice but not blocking
- ❌ Add SOUL.md customization — low priority
- ❌ Modify AGENTS.md — it's correct and stable
- ❌ Edit any production code — strict audit-only mode

### Branch strategy

**Continue on `develop`** — the existing 3 unstaged changes are already there, and all discovery
work is additive (new files, no modifications to existing ones). No need for a new branch. All
changes go through git safety protocol.

---

_End of discovery audit. Ready for Loop 1 approval._
