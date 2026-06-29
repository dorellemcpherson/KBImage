# CLAUDE.md — KBImage (Photoshop UXP Plugin)

Read this entire file before writing or changing any code.

## 🔢 VERSIONING SCHEME + BUILD ORDER (the map — read before tagging anything)

**Scheme: `major.minor.patch`.**
- **Minor** (`0.11 → 0.12 → 0.13…`) = a named module / capability block — a real new feature set.
- **Patch** (`0.12.0 → 0.12.1…`) = fixes, doc corrections, small UX tweaks, runtime confirms *within* that module.
- The `-working` suffix stays as the **tested-checkpoint** marker on top of the number (e.g. `v0.12-working`).
- This rule applies **going forward**; the older inconsistent `v0.10-*` tags are not renumbered.

**Build order (each minor = the next thing to build):**
- **v0.11** — recall foundation complete ✅ DONE/TAGGED (`v0.11-recall-complete-working`)
- **v0.12** — engine adapter wire (**Flux.2 [pro] + [max] via BFL, Clarity Crystal via ClarityAI** — the two accessible Western first-party providers) + conditional negative-prompt field. **Wire KEY-OPTIONAL / no-keys:** each engine registers in `MODELS` and shows in the dropdown regardless of whether its key is set; a keyless engine is dormant — selecting it is fine, but generating surfaces a clean "add [provider] key in Settings" message and must NEVER throw or break the panel; no key = no network call. This decouples the build from account setup (the plumbing — registry, dropdown, conditional negative-prompt field, dispatch routing — is testable with zero keys; live confirms come per-engine as keys arrive). Existing Gemini/OpenAI/Topaz engines stay untouched. **PARKED — access-gated, NOT in v0.12:** Qwen (DashScope) and Seedream (BytePlus) — both Chinese-cloud, blocked by KYC/real-name verification + no personal-account path for a US user (no key obtainable). Wire them only if access terms open up. *(GPT mask verify + 3 doc fixes ride here as a `v0.12.x` patch. Smart Object output + pre-gen resolution warning fit here or in v0.13.)*
- **v0.13** — upscaler upgrades (scope toggle, under-res flagging, non-destructive output — both Topaz + Clarity)
- **v0.14** — Outpaint / Expand (born recall-wrapped) — *Compose op that inherits the fresh recall machinery, cheaper to build now*
- **v0.15** — **Print module** (Recolour two-path engine + locks, operators side, exports: `.pat` + motif→SVG + separations)
- **v0.16** — provenance system (output folder + reject-retain, generation history, two metadata scores + provenance export) — **⚠️ DISCUSSION-GATED: do NOT build until the scoring model + legal-export are talked through (with Dorelle, and likely legal). It's the layer that READS everything else, so everything else — including Print's deterministic human operations — must exist first for the human-authorship score to count honestly.**

Reference-disable toggle attaches to whichever minor it's built alongside. Colour Intelligence
(Pantone snap / substrate-shift) lands inside or after Print depending on the auto-snap decision.
*(Order rationale: provenance is LAST — it's the layer that reads everything else, and it's
discussion-gated, not straightforward build work. Print's deterministic human operations must
exist before the human-authorship score can count them honestly. Outpaint sits ahead of Print
because it inherits the recall wrapper directly.)*
Full detail for every item is in the ROADMAP section below.

## ⏸️ SESSION STATE / START HERE (last updated 2026-06-28)

**Where we stopped:** v0.14 Fal lane (aggregator exception) IN PROGRESS — checkpointed,
NOT fully working. v0.13 (under-res flag) is the last TESTED-working commit. v0.12
engines remain partially tested. Recall foundation (v0.11) is the tested foundation.

- **⚠️ v0.14 — FAL LANE IN PROGRESS (checkpoint tag `v0.14-fal-lane-checkpoint`):**
  Isolated aggregator exception. 4 Fal models (provider `fal`, group `fal`, labeled
  group in the dropdown), key-optional, async queue (submit→poll status→result on
  `v3.fal.media`), `routedVia:"fal"` in the log, billing caveat in Settings + a muted
  marker on the Generate tab. Auth `Authorization: Key <FAL_KEY>` (one key). Models:
  - `fal-flux-dev` → `fal-ai/flux-lora` (FLUX.1 dev, t2i) + LoRA slot + safety toggle.
  - `fal-flux-edit` → `fal-ai/flux-2/lora/edit` (FLUX.2 edit). **TESTED WORKING** for
    redress: references ARE the edit base (refs-first; composite only if no refs);
    base64 whitespace-stripped; `image_urls` capped 3; `image_size` = doc dims clamped
    ~4MP/16-aligned/≤4096; result placed via `placeBase64AsEditedLayer` (fit-to-canvas).
  - `fal-qwen` → `fal-ai/qwen-image`; `fal-seedream` → `…/seedream/v4/text-to-image`
    (Fal hosts v4, NOT 4.5).
  - **OPEN BUG:** `fal-flux-dev` returns BLACK images (safety on OR off). Prime suspect:
    the LoRA URL field is SHARED, but flux-dev is FLUX.1 and the edit is FLUX.2 — a
    FLUX.2 LoRA bleeding onto the FLUX.1 endpoint → incompatible → black. Check the
    `fal request body →` log for `loras=1`; fix = clear LoRA on model switch / per-model.
  - Carryover fixes this session: LoRA URL/scale inputs wrapped in `.key-row` (focus/
    paste); Flux.2 (BFL) `safety_tolerance` editable (0–5, default 5); `.input` blue
    border (no grey). All UNCOMMITTED before this checkpoint.

- **v0.13 — under-res flagging + doc-resolution readout — TESTED WORKING**
  (tag `v0.13-underres-flag-working`):
  - **Doc-resolution readout** — persistent bar under the cost meter (`#doc-info-bar`):
    `Document: W × H px`, refreshed on doc change + after every op + hydrate.
  - **Under-res flag** — `updateDocInfo()`, CATCH-ON-ENTRY (events
    open/close/make/select/paste/placeEvent/delete + after plugin ops): active layer's
    pixel **bounds** vs doc dims; below project res (1% tol) → red `#under-res-flag`
    line; at/above → hidden. INFORMATIONAL only (no inline conform — decided); the user
    conforms via the **Upscale tab** (Active Layer → Topaz, the v0.12 non-destructive
    path). All plain getters, no modal, guarded.
  - **Known limit:** bounds test catches PLACED/GENERATED-small layers (the common
    case), NOT a smart object internally scaled up (bounds read full-canvas).
  - **NOT built:** batch conform (multi-layer at once, stack-order) — deferred; and the
    pre-gen OUTPUT-size warning is a separate item (out of scope).
  - v0.12 scope toggle (Composite/Active Layer) + non-destructive single-layer output
    verified intact, not rebuilt.
- **⚠️ v0.12 IN PROGRESS (checkpoint `v0.12-engines-checkpoint`, NOT `-working`):**
  Two direct first-party adapters added, **key-optional** (register + show in the
  dropdown/toggle without a key; keyless = clean "add key" message, no network call,
  never throws). Gemini/OpenAI/Topaz untouched.
  - **Flux.2 [pro] + [max]** — BFL, provider `bfl`, `x-key`, ASYNC (submit
    `POST api.bfl.ai/v1/flux-2-{pro,max}` → poll `polling_url` → `result.sample`
    temp URL). Sizes via width/height; **no negative prompt**. Cost = editable rate
    estimate (real `cost` is in the submit response, logged not metered). **UNTESTED live.**
  - **Clarity Crystal** — ClarityAI DIRECT, 2nd upscaler beside Topaz (Upscale-tab
    provider toggle, default Topaz; `creativity` default 0). `POST
    api-upscale.clarityai.co`, `Bearer ap_…`, image sent as a **data URI**
    (CONFIRMED accepted — do NOT change). **SYNCHRONOUS**, confirmed live response:
    `{ status, message:<result URL>, balance, credit_cost, cost_usd, logs }`. Adapter
    maps the result image to **`message`** (R2 host `r2-us.clarityai.co`, covered by
    `*.clarityai.co`), cost to the returned **`cost_usd`** (= credit_cost × $0.01;
    `balance` is remaining, not the charge), and fetches the ready URL with light
    retries (no async job-poll, no webhooks). Note: 4× of 2048²→8192² (67MP) = ~$1.60.
    **Field maps now exact** (regex kept only as a defensive fallback). Re-test that
    the upscaled layer places; then Clarity is confirmed-complete.
  - **Negative-prompt field** — conditional mechanism built but **DORMANT**: hidden
    for every v0.12 engine (none support it); lights up only for a future model
    flagged `supportsNegativePrompt`.
  - Manifest adds `api.bfl.ai`/`*.bfl.ai` + `api-upscale.clarityai.co`/`*.clarityai.co`.
- **Latest TESTED checkpoint:** tag `v0.11-recall-complete-working` — Compose
  (RefGen / Fuse pick-from-N / RefInpaint) + Upscale (Topaz) all wrapped in
  `runWithRecall`; every Image operator now logs (Extend the one exception). Recover with
  `git checkout v0.11-recall-complete-working`. See "Foundation COMPLETE" below.
  (Prior UI checkpoint: `v0.10-iconnav-labels-working` — two-tier nav with icon + label.)
- **Prior tested UI checkpoints:** `v0.10-topnav-working` (the nav restructure, when it
  still used tooltips), `v0.10-ui-dropdowns-working` (Fit Canvas + dropdowns).
- **Top nav restructure (2026-06-27):** the 5 text tabs overflowed the panel width, so
  nav is now TWO tiers — a top **Image** tab (`.toptab`, `data-toptab`, future Print
  drops in as a sibling) + a `<nav class="subnav">` of 5 operator buttons (inline-SVG
  icon + small label, `class="tab opicon"`, original `id`/`data-view` kept so the
  existing `showViewByClass`/`onTabChanged` path is reused — ZERO app.js change). Active
  operator = the existing `.tab.active` mustard + underline (icon via `currentColor`,
  label via inherited colour).
- **Operator labels, NOT tooltips (settled after 2 failed tooltip rounds):** each
  `.opicon` is a vertical stack — icon on top, a small **always-visible** `.op-label`
  beneath (Generate/Select/Edit/Compose/Upscale). NO hover tooltip. Why: a CSS `.op-tip`
  pill positioned below the row overlapped the cost counter; positioning it above looked
  wrong; and the native `title` tooltip renders pale-yellow and is NOT CSS-styleable
  (host-controlled). Static labels sidestep all of it and reduce clutter. **Do not
  reintroduce a hover tooltip here.**
- **Prior tested checkpoints:** `v0.10-session-scoping-working` (per-document
  authorship session), `v0.10-foundation-working` (recall wrapper + session log +
  re-run delete fix), `checkpoint-foundation-recall-log`.
- **UI: Fit Canvas + dropdowns (2026-06-27):**
  - **Fit Canvas** aspect pill — synthetic option (`FIT_CANVAS`) injected into the
    aspect row only via `aspectValuesFor()` (NOT in `MODELS.aspectRatios`, so the
    aspect-math helpers never see it). `resolveAspectForRequest` reads the active
    doc's live w/h → nearest supported ratio so the result fills the canvas
    edge-to-edge. Aspect row's selected pill is bright blue (`#pills-aspect
    .pill.selected`, `--info`); other rows keep mustard. `Match Input` unchanged.
  - **Model + Quantity are div-based dropdowns** (not pills, not native `<select>`
    — unreliable in UXP). Model options come from the `MODELS` registry
    (`rebuildModelDropdown`); selecting still calls `onModelChanged`. Quantity sets
    `cachedQuantity`. Wired through `handleClick` (`[data-dd]` toggle / `.dd-option`
    select / outside-click close). Dead-but-harmless: `rebuildModelPills` + two
    unreachable `handleClick` pill branches (the `.pills` elements no longer exist).
- **Per-document session scoping (2026-06-27):** the authorship session was
  plugin-launch-scoped, pooling multiple documents into one log/channel trail.
  Now `sessionId` rotates when the active document changes (notification listener
  on open/close/make/select + id-compare, plus a backstop in `actGenerate`):
  new `sessionId`, empty `sessionLog`, per-session log FILE
  (`kbimage-session-<sessionId>.jsonl`), `kb_sel_tmp` cleared, `pendingRecall`
  dropped. The **COST METER is deliberately per-LAUNCH** — NOT rotated on doc
  change; it only resets on plugin/PS close (or the manual Reset button).
- **The re-run delete fix (2026-06-27):** `deleteLayersById` used the bare key
  `target:` instead of `_target:`, so Photoshop ignored the layer id and ran
  Delete against the ambient (often mask/alpha-channel) target → "Delete not
  currently available". Now per id: select the layer explicitly by `_target` `_id`
  (also the existence guard — a gone layer throws → skip), `selectRGBChannel()` to
  leave any mask/alpha target, then delete by `_id`. Fully guarded.
- **Manifest unchanged** (`com.dorelle.kbimage`, v0.10.0).

- **Foundation COMPLETE (2026-06-27):** EVERY Image operator now runs through
  `runWithRecall` and writes the session log — generate, edit, **compose:refgen**,
  **compose:fuse**, **compose:refinpaint**, **upscale:topaz**. Fuse uses the new
  reusable **multi-option (pick-from-N)** path: 3 options placed, one record each
  (`option/ofN`), Accept = keep the layer ACTIVE in the Layers panel + discard the
  rest (kept → `committed:true`, others stay `false`). Upscale gets its own
  `.recall-bar` on the Upscale tab (`showRecallBar`/`hideRecallBar` are class-based).
  Cost is billed inside each `execute` (re-runs count). **Extend stays the only
  intentional exception** (canvas mutation). Upscale caveat: re-run/discard leaves
  the canvas enlarged (doesn't compound) — no canvas-restore hook.

## ROADMAP — deferred / coming-soon (THE FULL PICTURE)

Everything forward-looking, consolidated here so this is the single source of truth
(it was previously fragmented across these build notes and the deck). Core ships
first; everything below is deferred/upgrade. Build order is the queue at the top.

### Build queue (before Print)

**1. Wire the accessible new first-party adapters — one build.** Same pattern as the
existing Gemini/OpenAI/Topaz adapters: own key field in Settings + `MODELS` registry
entry + provider dispatch branch + per-run cost line, each.
- **Flux.2 [pro]** + **Flux.2 [max]** — Black Forest Labs (BFL), direct.
- **Clarity Crystal** — ClarityAI.co, direct — a **SECOND upscaler** alongside Topaz
  (not a generate engine); expose `creativity`, default **0** (fidelity / no invented detail).
- **PARKED — access-gated, NOT wired in v0.12:** **Qwen Image** (Alibaba DashScope) and
  **Seedream 4.5** (ByteDance BytePlus). Both are Chinese-cloud and blocked at onboarding —
  KYC / real-name verification (DashScope needs a Chinese phone number; BytePlus runs its own
  real-name registration) with no usable personal-account path for a US user, so no key is
  obtainable today. The wall is identity/KYC + business-account-default, not a hard ban. Wire
  them only if the access terms open up. (BFL + ClarityAI are the two accessible Western
  first-party providers — that's what v0.12 ships.)
- **NO aggregators.** Fal/Replicate rejected on principle: a middleman breaks true
  per-run cost AND moves generations into its own logs — killing the two things the tool
  exists for (spend truth + authorship visibility). Aggregator only ever justified for a
  model with NO first-party API (deliberate exception).
- **Negative-prompt field = conditional UI** driven by model selection, same pattern as
  the aspect pill reshaping on model change (`onModelChanged`): shows only for engines
  that support it (**Flux** now; Qwen/Seedream if ever wired), hidden for Nano Banana + GPT Image.
  Anti-hallucination lever (no extra lace/limbs/trim).
- Content policies differ: BFL light. (Qwen/Seedream Chinese-cloud filters, uneven on skin —
  noted for if they're ever wired.) Needs a key per provider + a live endpoint-shape confirm before spend.

**2. Upscaler upgrades (Topaz + Clarity, both):**
- **(a) Scope toggle** — active **layer** vs **whole image** (whole = a non-destructive
  merged duplicate of visible layers; never flatten the live doc).
- **(b) Under-res layer flagging** — scan the stack, compare each layer's real pixel
  bounds vs its canvas footprint at doc resolution (PS layers carry no per-layer DPI —
  use pixel-count-vs-footprint), flag layers BELOW project resolution (at/above = leave
  off), lift flagged to MATCH project resolution (conform-to-spec; targeting is
  arithmetic, only the upscale is AI); batch-select all or pick.
- **(c) Non-destructive output** — upscale ALWAYS outputs to a NEW layer, original
  preserved; single result placed directly ABOVE its source at the same stack position;
  batch keeps stack order.

**3. GPT Image mask — runtime verify + doc fixes** (the diagnosed state is below in
"Real feature state"; verify `images.edit`-with-mask actually runs in PS — depends on
`FormData`/`Blob` in the UXP runtime; one live confirm pending).

**4. Outpaint / Expand** — a new **Compose** op (canvas-extend style; mind the same
canvas-mutation caveat as Extend when wrapping in recall; born recall-wrapped).
(Generative Fill is ALREADY BUILT on the Select tab — do NOT rebuild.)

**THEN the Print tier.**

### UX / output adds (AI Lab / Picture Instruments competitive audit — APPROVED)
- **Smart Object output** — generations land as an embedded Smart Object + editable mask
  (re-editable, non-destructive) instead of flat raster+mask. Fits the non-destructive
  thesis and the "always output to a new layer" rule.
- **Pre-gen resolution warning** — before generating, an indicator warns if the chosen
  model output vs the target area is too big (wastes spend) or too small (blurry); turns
  orange = adjust model/selection first. Distinct from under-res LAYER flagging (2b): this
  guards the chosen OUTPUT before the run.
- **Reference disable toggle** — keep a reference loaded but exclude it from the send (no delete).
- **SKIP:** in-panel selection brush/box — KBImage uses PS-native selection, which is more
  capable (a strength, not a gap). *Optional/unconfirmed:* reference disk-persistence +
  reload across sessions; prompt-history recall (cheap — the session log already stores prompts).

### Provenance system (APPROVED)
- **Output folder + reject-retain** — an admin-set output folder at install (next to the
  authorship-log path; same provenance system; ComfyUI input/output parallel). EVERY
  generation writes to the folder at creation; **accept** also places it into the project;
  **re-run writes-but-doesn't-place — NO delete** (revises the current re-run-deletes-the-layer
  behavior: the render is already on disk, re-run just declines to place). Folder holds the
  bytes, the session log holds the meaning; the image is tagged + matched back to the log.
- **Generation history** — a per-document browsable view of the log (kept-vs-rejected counts
  as a behavior mirror, e.g. "25 made, 3 kept, 22 rejected, same prompt"); rejects shown as
  thumbnails to keep size sane (the log stores file-path refs, not inline bytes).
- **Spend — instrument first, NO hard cap.** A hard cap caps creativity (trips mid-explore
  on the best run); the meter is visibility, a cap is control — keep visibility, refuse the
  in-loop ceiling. Characterize real session cost from the logs FIRST, then soft signals only
  (running total + "heavier than usual" nudge). Any true ceiling is admin/org-level only,
  never imposed on the artist mid-flow.
- **Two provenance scores → file metadata** (passive support, NON-determinant, for LEGAL
  not the designer): (1) **human-authorship** — how much is the designer's, computed from
  logged accepts/edits/inpaints/masks/deterministic ops vs the generation base (affirmative
  copyrightability evidence); (2) **reference-derivation risk** — how close the output stayed
  to an imported copyrighted reference (transformation/distance) — a **RISK FLAG, never a
  clearance**; the tool must never imply legal safety. Both locked in file metadata, surfaced
  only on a dispute; the designer keeps duty of care.
- **Provenance export** — a per-file readout of the two scores + the decision trail, readable
  without opening PS. Export + scoring are ONE system; legal (a human), not the tool, reads it
  at review and determines.
- **Refusal fallback — CLOSED, stays MANUAL.** No auto-switch on a content refusal: the model
  is the designer's choice, and an auto-retry would spend on an engine they didn't pick and
  change the look. The clean "try Nano Banana" error is enough; the user switches by hand.

### Print tier (future top tab — nav reserves the `Print` `.toptab` seam)
An **operators** side and an **exports** side.
- **Operators:** repeat (half-drop/full/brick/mirror/seamless), reduce colours, separate
  (one layer/colour), **Recolour**, extract motif, **grid/engineered layouts** (placement
  prints for a garment area, beyond all-over repeat), **line-art modifier** (clean/convert
  artwork into production-ready line work).
  - **Recolour operator = DETERMINISTIC remix, NOT AI** (corrected — this is the operator,
    not the generative pattern below): a reduced indexed image, colours assigned per index,
    **constrained permutation** across regions, with **region-pinned locks** (locked regions
    drop out of the pool; only unlocked colours redistribute among unlocked positions).
    Deterministic, instant, free — sits with the tiler + extractor on the arithmetic side.
    - **TWO ENTRY PATHS into the same remix engine** (the artist's choice once artwork is
      ready for recolor):
      1. **`.ase` path** — the artist loads a pre-built palette as an `.ase` file (client
         colours / trend pack / existing colorway). The file *is* the palette — no library
         chooser; colours come in ready and get assigned.
      2. **Pick-Pantone path** — no pre-made file. The artist chooses **fabric first**, which
         loads that fabric's **single** Pantone library (cotton → TCX, nylon → TN, polyester →
         TSX, metallic → TPM, etc.), then picks a Pantone per index **from that one book**.
    - **ONE library per recolor, chosen by fabric — NO cross-pack mixing.** This keeps the
      production guarantee ("the whole colorway is achievable on this fabric") and makes the
      later substrate-shift logic honest, because the library *is* the fabric. Library
      selection only appears on the pick-Pantone path.
    - Palette/library inputs come in as **`.ase`** (universal, parseable — Pantone Connect
      exports or converted). Do NOT depend on `.scl` (program-specific, not a free standard —
      see Colour). `.ase`/`.aco` parse directly.
    - **MUST TEST AT BUILD:** both entry paths, and fabric-driven single-library selection on
      the pick-Pantone path.
- **Exports:** `.pat` Photoshop pattern from the repeat tile; **motif → SVG** (Print "motif"
  actions only — vectorize/trace; **NO live Illustrator bridge**); production separations / mill files.

### Colour Intelligence (the textile wedge)
- **Pantone mill-safe mapping** — snap reduced colours to real dyes; **substrate-shift
  prediction** (cotton vs nylon vs polyester); **out-of-gamut flagging** before the mill.
  The dye-library snap is the production source of truth for colour.
- **Pantone libraries provided as `.scl`** (Pantone proprietary). `.ase`/`.aco` parse
  directly; `.scl` would need conversion to a Lab/RGB + substrate table first. **NOTE /
  OPEN:** the Recolour operator's "user MUST pick the Pantone" ruling removes the auto-snap
  *search*, so `.scl` conversion is NOT required for deterministic remix. It is only needed
  if Colour Intelligence keeps a separate **auto-snap** path (reduce → nearest real dye).
  Substrate values can also come from **Pantone Connect `.ase` exports** instead of the
  proprietary `.scl`. Decide whether the auto-snap path survives before doing any `.scl` work.
- **NEURAL_ATELIER recolor JSON** (`NA_Recolor` node — single-target Pantone repaint via Nano
  Banana + SeedVR2 upscale) = a **SEPARATE generative escape hatch** for the un-indexed case
  only, and the reference recipe for the FUTURE **"Recolor garment"** AI feature. Generative =
  approximate — it is NOT the deterministic Recolour operator and NOT the colour source of truth.

### Preview (deck "Coming Soon")
- **Visualize on a garment** — see the print on a body before export.
- **Variation batches** — generate a set under your controls, pick one.
- **Fabric-width repeat** — tie the repeat to the actual bolt width.

### Engine
- **Flux (BFL)** — currently future-only in the wired build (see "Real feature state":
  Flux is NOT wired in yet). It becomes live as part of the 5-adapter wire above; until that
  build lands, the "Flux NOT wired in" rule below stays in force.

### Deployment-gated (pre-ship requirements, not features)
- **Admin-configurable authorship-log path** — the session-log location must be admin-set for
  deployment (the authorship gateway reads it). Today it's a fixed per-session file in the
  plugin data folder (`kbimage-session-<sessionId>.jsonl`).
- **Admin-configurable output folder** — the provenance output folder (above), set at install,
  next to the log path.
- **Pantone `.scl` parsing/conversion** — prerequisite ONLY for a Colour Intelligence auto-snap
  path, if that path is retained (see Colour note above).

## What this is

**KBImage** is a Photoshop UXP panel that generates and edits images using
multiple third-party AI models, routed directly to each provider's HTTPS API,
with results placed onto Photoshop layers. It is a model-agnostic, serverless,
bring-your-own-key replacement for Firefly's Generative Fill.

- **App name:** KBImage (no "+", no "kBanana"). This is the plugin layer of the
  **ArtFlow** project (Komar).
- **Author / builder:** Dorelle McPherson, Creative Technology.

## Rename history (why this folder exists)

This is a clean continuation of the **kBanana** build, with the kBanana name
dropped. It was stood up fresh from the last known-good build because a previous
copy (`C:\Users\dorel\KBImage_plus`) rendered stripped (no CSS, no tabs, no
scroll) and was abandoned.

- **Source of this build:** `C:\Users\dorel\kBanana\v0.08\` — the working,
  full-interface build that loads in Photoshop with the complete UI. NOTE: the
  folder was labelled "v0.08", but its contents had silently absorbed the
  v0.09 and v0.10 work (session cost bar marked `(v0.09)` in the markup, Compose +
  Upscale tabs, dual/triple-key Settings, cost meter). **Do not trust the old
  version string** — the code is later than its label.
- **Clean version chosen here:** `0.10.0` in `manifest.json`, reflecting the real
  feature state (through the v0.10-era work the old "v0.08" had absorbed).
- **New unique plugin id:** `com.dorelle.kbimage` (was `com.dorelle.kbanana.v008`).
  A new id means UDT treats it as a distinct plugin — it will NOT collide with any
  existing kBanana plugins, and it gets a FRESH `secureStorage` namespace (so API
  keys must be re-entered once in the new panel; nothing carries over from kBanana).
- **Do NOT** read from or copy out of `C:\Users\dorel\KBImage_plus` — it is the bad copy.
- **Internal string note:** `secureStorage` key names (`kbanana.apiKey`,
  `kbanana.openaiApiKey`, `kbanana.topazApiKey`, `kbanana.rates`, etc.) and the log
  TAG still read "kbanana" by design — they are invisible internal identifiers, and a
  fresh plugin id already namespaces the store. They were left untouched to avoid
  regression. User-visible branding (title, logo alt, Photoshop undo-history labels,
  fallback layer name) was renamed to KBImage.

## Real feature state (must not regress)

Three engines are wired in and working behind a shared provider-adapter / model-
registry architecture (registry lives in `src/app.js`):

- **Nano Banana Pro** — Gemini `gemini-3-pro-image-preview` (provider `gemini`). Paid tier.
- **Nano Banana 2** — Gemini `gemini-3.1-flash-image-preview` (provider `gemini`). Free-tier
  default for dev. Endpoint `https://generativelanguage.googleapis.com/v1beta/...`.
- **GPT Image 2** — OpenAI `gpt-image-2` (provider `openai`). Own key. No `response_format`.
- **Topaz** — finishing/upscale only (NOT a generation model). Own key. Result lands as a
  new layer; canvas grows to match (center anchor, grow-only).

**Flux (BFL) is NOT wired in** — it is a future engine. Leave it out. Do not add
`api.bfl.*`, polling/async machinery, or a Flux registry entry in this build.

Everything below must survive any change:
- **Five tabs:** Generate · Select · Edit · Compose · Upscale (Settings is the header
  gear, not a tab).
- **Selection Edits panel:** Remove · Replace · Add · Generative Fill · Extend.
- **Reference Images**, **Model picker** (pills: NB Pro / NB 2 / GPT Image),
  **Resolution** (1K/2K/4K; NB2 also 0.5K), **Aspect** (rebuilt per model from registry).
- **Cost meter** — real USD: per-action estimate + always-visible session total bar;
  rates/warning-threshold in Settings.
- **Editable selection mask** — selection read in PS, applied as a layer mask on the
  result; original layer always preserved. NB has no API mask (mask lives in PS); GPT
  confines server-side via its API mask, placed as a plain layer.
- **Smart routing** — GPT refuses to EDIT figure/fashion work it will generate; surface
  the safety refusal cleanly and steer figure/fashion edits to Nano Banana.
- **Scrollable body** and the styled narrow-panel layout.

### Select/Edit mask path — diagnosed state (2026-06-27)
Traced end-to-end; no code changed. How the selection becomes a mask, per provider:
- **Nano Banana (gemini):** the mask is **NOT sent to the generate call** (NB has no API
  mask). `runEditPipeline` builds `maskSpec` (channel = shape-accurate, else rect,
  `app.js:3771-3776`); `_useApiMask = (_provider === "openai" && !!maskSpec)`
  (`app.js:3837`) is FALSE for NB, so `opts.maskSpec` is never set and
  `generateImageGemini` sends only `contents` (instruction + composite + refs). The
  selection becomes a **Photoshop layer mask** applied to the result client-side in
  `placeBase64AsEditedLayer` (`app.js:2640-2667`, shape-accurate via
  `loadSelectionFromChannel` → `addLayerMaskRevealSelection`). **Complete & working.**
- **GPT Image 2 (openai):** the mask **IS wired through** to `images/edits` — NOT stubbed,
  NOT dropped. Routing sets `opts.maskSpec` (the **bounding RECT**, not the shape) +
  `opts.maskDoc` (`app.js:3838-3845`); the adapter builds an alpha PNG and
  `fd.append("mask", maskBlob, "mask.png")` (`app.js:1396-1410`) then
  `POST /v1/images/edits` (`app.js:1423-1428`). Mask builder is fully implemented
  (`buildAlphaMaskBlob` 1100-1137 + hand-built-PNG fallback). **Two caveats:** (1) GPT's
  API mask is **rect-only** (bounding box of the selection); the shape-accurate mask only
  exists as the client-side PS layer mask. (2) Runtime dependency — throws
  "FormData not available…" (`app.js:1369-1371`) if UXP lacks `FormData`; also needs
  `Blob`/`canvas.toBlob`.
- **GPT selected on a masked Select edit:** it **edits with the (rect) mask** — it does
  NOT auto-route to Nano Banana. Dispatch is purely by `model.provider` (`app.js:682`);
  there is **no figure/fashion detection or auto-switch** in code (the "Smart routing"
  above is a MANUAL workflow rule). On a content refusal GPT **errors**, surfaced as a
  clean "try Nano Banana" message; switching models is the user's manual step.

## Foundation layers (every future operator inherits these)

Two shared layers underneath the studio. Built together. **Do not regress; new
operators must adopt them, not bypass them.**

### 1. Recall wrapper — `runWithRecall(descriptor)` (app.js)
One shared mechanism that wraps ANY operation: it produces a **preview** (a
non-destructive result layer the designer can see), then exposes **accept**
(commit) and **re-run** (discard + run again with new params). **Nothing commits
without an explicit accept.**

- Descriptor: `{ op, params, targetLayerId, sourceRef, execute(params), paramsProvider(),
  reRunPrep(state), onSettle(state, accepted) }`. `execute` returns
  `{ layerIds, beforeSnapshotRef, afterSnapshotRef, state }`.
- Uniform contract returned: `{ previewLayerId, previewLayerIds, accept(), reRun(overrides) }`.
- **Origin-blind:** the wrapper hands the operator only `targetLayerId` — operators
  never branch on how the target's content arrived. (Edit logs the active layer as a
  nominal target but the pipeline reads the COMPOSITE; it does not branch on it.)
- **accept()** is the *only* thing that sets a log record's `committed:true`.
- **reRun()** deletes the preview layer(s) by id (inside `executeAsModal`), leaves the
  prior log record at `committed:false` (a kept **rejected fork = evidence**), then runs
  again — `paramsProvider` re-reads the form so "new params" = whatever the designer
  changed; an explicit `overrides` object wins.
- **Optional lifecycle hooks** (for op-specific state — e.g. a temp selection channel):
  `reRunPrep(state)` restores state the next run needs (reload the selection);
  `onSettle(state, accepted)` releases state when the preview's fate is decided
  (accept = true; abandoned-by-a-new-run = false). `state` is whatever `execute` returns.
- UI: a hidden **recall bar** in `#shared-form` (`#recall-bar`, Accept / Re-run) shows
  while a preview is pending. Actions `recall-accept` / `recall-rerun`. Generic — it
  drives whichever op's descriptor is pending.
- **Adopted so far:**
  - **Generate** (`actGenerate` → `runWithRecall` → `executeGenerate`).
  - **Edit** — Select/Edit-tab edits (Remove/Replace/Add/Generative Fill, whole-image
    presets, Recolor) via `executeEdit` → `runEditPipeline(…, {recallWrapped:true})`.
    Re-run restores the selection (`editReRunPrep`: shape-accurate temp channel, or rect
    bounds fallback); accept/abandon releases the channel (`editOnSettle`). Under recall,
    `runEditPipeline` never finalizes the temp channel during placement — `onSettle` owns
    cleanup; the start-of-run pre-delete is the safety net.
  - **EXCEPTION — Extend is NOT recall-wrapped.** It mutates the canvas (`canvasResize`),
    which a layer-delete can't cleanly revert, so it places directly as before (no recall
    bar). Revisit if/when discard learns to restore canvas size.
- **Not yet wrapped:** Compose, Upscale — they place layers directly as before. When they
  adopt the wrapper, the contract does not change.

### 2. Session log — append-only JSONL (app.js)
Records every operation **as it happens** (not reconstructed later). The authorship
gateway reads this later, so it must be complete from the first run.

- In-memory array `sessionLog` is source of truth; flushed in full to
  `<pluginData>/kbimage-session-log.jsonl` (one JSON record per line) after every event.
- **Append-only:** records are never deleted/reordered; the only mutation is a record's
  `committed` flag flipping `false→true` once, on accept. So `committed:true` *is* the
  authorship signal.
- Record: `{ id, sessionId, ts, tsISO, op, params, targetLayerId, sourceRef,
  beforeSnapshotRef, afterSnapshotRef, committed }`.
- **Lightweight:** snapshot fields are file-path **references**, never inline image
  bytes. `afterSnapshotRef` reuses the result PNG the place function already wrote (zero
  extra disk writes). `params` is sanitized (reference-image base64 / source pixels are
  stripped).
- A run appends its record at preview-creation time with `committed:false`. Accept →
  `true`. Re-run → the prior record stays `false` and a fresh record is appended.
- Inspect in the UDT console: `globalThis.__kbimageLog` (array),
  `globalThis.__kbimageLogPath` (file path), `globalThis.__kbimageSessionId`.

## UXP discipline (non-negotiable — learned by failing)

1. **CSS is INLINED in `index.html`** inside a `<style>` block — NO external
   stylesheet (external sub-resources did not apply across reloads in this host).
   No `position: fixed/sticky`, no flexbox `gap` (use margin/padding), no
   `border-radius: 50%` on pills (use a large px / 999px radius).
2. **All document/pixel work runs inside** `require("photoshop").core.executeAsModal`.
3. **No Spectrum web components, no inline `onclick=`/`onchange=`** — wire everything
   with `addEventListener` after the DOM exists. Single bundled non-module
   `<script src="src/app.js">` (no `type="module"`).
4. **No `localStorage`/`sessionStorage`, no `TextEncoder`/`TextDecoder`** globals. Keys in
   `secureStorage`; base64→bytes via `atob` + `Uint8Array`.
5. **Gemini calls use `/v1beta/`; request bodies are snake_case.**
6. **Manifest icon paths are RELATIVE to the plugin root.**

### Reloading a code change in UDT (critical)
Any change to `src/app.js` (or the manifest) requires a full **Remove + Re-Add** of the
plugin in the UXP Developer Tool. The **Reload** button does NOT reliably pick up
`app.js` changes. HTML/CSS-only changes may reload, but when in doubt, Remove + Re-Add.

## How to load KBImage in UDT

1. Open the **UXP Developer Tool** (UDT) with Photoshop (v25 or v26) running.
2. **Add Plugin** → select `C:\Users\dorel\KBImage\manifest.json`.
3. Click **Load** next to "KBImage" (id `com.dorelle.kbimage`).
4. In Photoshop, the panel appears under **Plugins → KBImage** (dock it).
5. Confirm the full interface renders: header logo + 5 tabs (Generate / Select /
   Edit / Compose / Upscale) + settings gear, the session cost bar, the shared
   form (prompt / Reference Images / Model pills / Resolution / Aspect), the
   Selection Edits pills on the Select tab, and a scrollable body.
6. Open Settings (gear) and enter the Gemini / OpenAI / Topaz keys once (fresh store).

## First steps for any session
1. Read this file.
2. Confirm the panel still loads on PS v25 + v26 and the full UI renders.
3. For any provider work: verify model ids / field placement against LIVE docs; send a
   minimal valid body first, add fields one at a time, lock the body that returns 200.
