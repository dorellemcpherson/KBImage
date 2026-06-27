# CLAUDE.md — KBImage (Photoshop UXP Plugin)

Read this entire file before writing or changing any code.

## ⏸️ SESSION STATE / START HERE (last updated 2026-06-27)

**Where we stopped:** the two foundation layers — the **recall wrapper** and the
**append-only session log** — are built, adopted by **Generate** and the
**Select/Edit-tab edits**, and **TESTED WORKING in Photoshop**. The re-run
"Delete not currently available" bug AND the per-document session-scoping fix are
both done and tested. See "Foundation layers" below.

- **Latest checkpoint (TESTED):** commit on `master`, tag `v0.10-iconnav-labels-working`
  — two-tier nav with icon + small always-visible label per operator. Recover with
  `git checkout v0.10-iconnav-labels-working`.
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

**NEXT STEP — open follow-ups (rough priority):**
- **Extend** is excluded from recall because it mutates the canvas (`canvasResize`);
  joining it needs discard to also restore canvas size. Revisit only if wanted.

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
