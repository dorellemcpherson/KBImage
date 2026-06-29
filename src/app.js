// kBanana v0.04 — single-file panel script (whole-image + selection edits).
//
// PERMANENT CONSTRAINTS (see CLAUDE.md):
//  - No ES modules. No top-level require().
//  - Every require() is lazy (inside a function).
//  - The delegated click listener attaches at SCRIPT LOAD (top of IIFE),
//    BEFORE anything that could throw. Script tag sits at end of <body>,
//    so document.body already exists. Tab switching cannot be defeated
//    by a downstream error.

(function () {
  "use strict";
  const TAG = "[kBanana]";

  // =======================================================================
  // STEP 1 — attach the delegated click + keyboard listeners IMMEDIATELY.
  // Nothing above this line can throw, nothing below can defeat it.
  // =======================================================================

  try { console.log(TAG, "app.js loaded"); } catch (_) {}

  function showViewByClass(view) {
    try { console.log(TAG, "show view:", view); } catch (_) {}
    const views = document.querySelectorAll(".view");
    for (let i = 0; i < views.length; i++) views[i].classList.add("hidden");
    const target = document.getElementById("view-" + view);
    if (target) target.classList.remove("hidden");
    else try { console.error(TAG, "missing view container: view-" + view); } catch (_) {}

    const tabs = document.querySelectorAll(".tab");
    for (let i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle("active", tabs[i].getAttribute("data-view") === view);
    }

    // v0.08.1 step 2 — Settings now lives in the header gear (not a tab).
    // Highlight the gear while the Settings view is showing.
    const gear = document.getElementById("gear-btn");
    if (gear) gear.classList.toggle("active", view === "settings");

    // Shared form (prompt + refs + model + res + aspect + action) is
    // visible for Generate / Select / Edit / Compose, hidden for Settings
    // and Upscale (Upscale has its own self-contained finishing controls).
    const shared = document.getElementById("shared-form");
    if (shared) shared.classList.toggle("hidden", view === "settings" || view === "upscale");

    // Per-tab edit-type bookkeeping. Generate uses no edit type; Select
    // restores the last selection-edit pill; Edit restores the last
    // whole-image preset (or freeform "").
    if (typeof onTabChanged === "function") onTabChanged(view);
  }

  // Deferred action dispatch — populated below once the heavy modules are
  // defined. Until then we just log so the user sees the click registered.
  let dispatchAction = function (name, srcEl) {
    try { console.warn(TAG, "action arrived before handlers ready:", name); } catch (_) {}
  };
  // Forward-declared so handleClick can call them before definitions land.
  let onModelChanged = null;
  let onEditTypeChanged = null;
  let onTabChanged = null;
  let updateCostEstimate = null;   // v0.09 cost meter — refresh estimate line
  let onRateInput = null;          // v0.09 — a rate input changed
  let onThresholdInput = null;     // v0.09 — spend-warning threshold changed
  let onFluxSafetyInput = null;    // v0.13.x — Flux safety_tolerance changed

  function handleClick(e) {
    try {
      // ----- Custom dropdowns (Model / Quantity) -----
      // A click inside a .dropdown is fully handled here; a click anywhere
      // else closes any open menu, then proceeds to normal handling.
      const inDropdown = e.target.closest(".dropdown");
      if (!inDropdown) {
        closeAllDropdowns();
      } else {
        const ddTrigger = e.target.closest(".dd-trigger");
        if (ddTrigger) {
          toggleDropdown(ddTrigger.getAttribute("data-dd"));
          return;
        }
        const ddOption = e.target.closest(".dd-option");
        if (ddOption) {
          const grp = ddOption.getAttribute("data-dd-group");
          const val = ddOption.getAttribute("data-dd-value");
          closeAllDropdowns();
          if (grp === "model") {
            if (typeof onModelChanged === "function") onModelChanged(val);  // sets cachedModelId + rebuilds aspect/res + cost
            setModelDropdownSelection(val);                                  // label + highlight (onModelChanged no-ops if same value)
          } else if (grp === "quantity") {
            cachedQuantity = Math.max(1, Math.min(4, Number(val) || 1));
            setQuantityDropdown(cachedQuantity);
            try { console.log(TAG, "quantity →", cachedQuantity); } catch (_) {}
            if (typeof updateCostEstimate === "function") updateCostEstimate();
          }
          return;
        }
        return;   // click inside dropdown chrome but not trigger/option → swallow
      }

      const tab = e.target.closest("[data-view]");
      if (tab) {
        try { console.log(TAG, "click: tab →", tab.getAttribute("data-view")); } catch (_) {}
        showViewByClass(tab.getAttribute("data-view"));
        return;
      }

      const pill = e.target.closest(".pill");
      if (pill) {
        const group = pill.closest(".pills");
        if (group) {
          try { console.log(TAG, "click: pill →", group.id, pill.getAttribute("data-value")); } catch (_) {}

          // Normal single-select within one group. Each tab owns its own
          // pill groups now — no cross-group dedup needed.
          const pills = group.querySelectorAll(".pill");
          for (let i = 0; i < pills.length; i++) pills[i].classList.remove("selected");
          pill.classList.add("selected");

          // Side effects per group.
          const value = pill.getAttribute("data-value");
          if (group.id === "pills-model" && typeof onModelChanged === "function") {
            onModelChanged(value);
          } else if ((group.id === "pills-select-type" || group.id === "pills-edit-type")
                     && typeof onEditTypeChanged === "function") {
            onEditTypeChanged(value);
          } else if (group.id === "pills-extend-dir") {
            cachedExtendDir = value;
          } else if (group.id === "pills-quantity") {
            const n = Number(value) || 1;
            cachedQuantity = Math.max(1, Math.min(4, n));
            try { console.log(TAG, "quantity →", cachedQuantity); } catch (_) {}
          } else if (group.id === "pills-compose-op") {
            if (value === "refgen" || value === "fuse" || value === "refinpaint") {
              cachedComposeOp = value;
              try { console.log(TAG, "compose-op →", cachedComposeOp); } catch (_) {}
              updateModeUi();
            }
          } else if (group.id === "pills-upscale-source") {
            if (value === "composite" || value === "active-layer") {
              cachedUpscaleSource = value;
              try { console.log(TAG, "upscale-source →", cachedUpscaleSource); } catch (_) {}
            }
          } else if (group.id === "pills-upscale-factor") {
            const n = Number(value) || 2;
            if (n === 2 || n === 4) {
              cachedUpscaleFactor = n;
              try { console.log(TAG, "upscale-factor →", cachedUpscaleFactor + "x"); } catch (_) {}
            }
          } else if (group.id === "pills-upscale-provider") {
            if (value === "topaz" || value === "clarity") {
              cachedUpscaleProvider = value;
              try { console.log(TAG, "upscale-provider →", cachedUpscaleProvider); } catch (_) {}
              refreshUpscaleEnabled();   // toggles key-gate + Clarity creativity field
            }
          } else if (group.id === "pills-clarity-creativity") {
            const c = Number(value);
            if (isFinite(c)) {
              cachedClarityCreativity = Math.max(0, Math.min(1, c));
              try { console.log(TAG, "clarity-creativity →", cachedClarityCreativity); } catch (_) {}
            }
          } else if (group.id === "pills-fal-safety") {
            cachedFalSafetyChecker = (value === "on");   // v0.14 — enable_safety_checker
            try { console.log(TAG, "fal safety_checker →", cachedFalSafetyChecker); } catch (_) {}
          }
          // v0.09 — any pill change (model / resolution / quantity / factor /
          // source / compose-op) can move the estimate. Refresh it.
          if (typeof updateCostEstimate === "function") updateCostEstimate();
        }
        return;
      }
      const actEl = e.target.closest("[data-action]");
      if (actEl) {
        // .disabled on a div-button = inert.
        if (actEl.classList && actEl.classList.contains("disabled")) return;
        const name = actEl.getAttribute("data-action");
        if (name === "open-key-page") e.preventDefault();
        try { console.log(TAG, "click: action →", name); } catch (_) {}
        dispatchAction(name, actEl);
        return;
      }
    } catch (err) {
      try { console.error(TAG, "handleClick error:", err); } catch (_) {}
    }
  }

  // v0.09 — delegated change handler for the editable rate cells and the
  // spend-warning threshold (text inputs → no click/keydown coverage).
  function handleChange(e) {
    const t = e.target;
    if (!t) return;
    if (t.id === "warn-threshold") {
      if (typeof onThresholdInput === "function") onThresholdInput(t.value);
      return;
    }
    if (t.id === "flux-safety-tolerance") {
      if (typeof onFluxSafetyInput === "function") onFluxSafetyInput(t.value);
      return;
    }
    if (t.id === "fal-lora-url") {                 // v0.14 — LoRA weights URL
      cachedFalLoraUrl = (t.value || "").trim();
      return;
    }
    if (t.id === "fal-lora-scale") {               // v0.14 — LoRA scale
      const v = Number((t.value || "").trim());
      cachedFalLoraScale = isFinite(v) ? v : 1;
      return;
    }
    if (t.classList && t.classList.contains("rate-input")) {
      if (typeof onRateInput === "function") onRateInput(t);
      return;
    }
  }

  function handleKeydown(e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    const t = e.target;
    if (!t) return;
    const tag = (t.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    if (t.matches && t.matches('[role="button"], [role="tab"], .pill, .dd-option, [data-action], [data-view]')) {
      e.preventDefault();
      t.click();
    }
  }

  if (document.body) {
    document.body.addEventListener("click", handleClick);
    document.body.addEventListener("keydown", handleKeydown);
    document.body.addEventListener("change", handleChange);
    try { console.log(TAG, "delegated listeners attached (body)"); } catch (_) {}
  } else {
    // Extreme fallback — script ran before <body> for some reason.
    document.addEventListener("DOMContentLoaded", function () {
      document.body.addEventListener("click", handleClick);
      document.body.addEventListener("keydown", handleKeydown);
      document.body.addEventListener("change", handleChange);
      try { console.log(TAG, "delegated listeners attached (DOMContentLoaded)"); } catch (_) {}
    });
  }

  // =======================================================================
  // STEP 2 — heavy modules. Anything in here is allowed to throw; the body
  // listener above keeps tabs/pills/buttons routing regardless.
  // =======================================================================

  function uxp()       { return require("uxp"); }
  function ssget()     { return uxp().storage.secureStorage; }
  function fsLocal()   { return uxp().storage.localFileSystem; }
  function fmts()      { return uxp().storage.formats; }
  function shellMod()  { return uxp().shell; }
  function psMod()     { return require("photoshop"); }

  // UXP does NOT expose TextEncoder / TextDecoder as globals. Hand-rolled
  // UTF-8 helpers instead. secureStorage's setItem expects Uint8Array, so
  // we still need string ↔ bytes for the API key — just done by hand.

  function strToBytes(s) {
    const bytes = [];
    for (let i = 0; i < s.length; i++) {
      let c = s.charCodeAt(i);
      if (c < 0x80) {
        bytes.push(c);
      } else if (c < 0x800) {
        bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      } else if (c < 0xd800 || c >= 0xe000) {
        bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      } else {
        // surrogate pair → single 4-byte UTF-8 sequence
        i++;
        const c2 = s.charCodeAt(i);
        const u = 0x10000 + (((c & 0x3ff) << 10) | (c2 & 0x3ff));
        bytes.push(
          0xf0 |  (u >> 18),
          0x80 | ((u >> 12) & 0x3f),
          0x80 | ((u >> 6)  & 0x3f),
          0x80 |  (u        & 0x3f)
        );
      }
    }
    return new Uint8Array(bytes);
  }

  function bytesToStr(bytes) {
    let s = "";
    let i = 0;
    while (i < bytes.length) {
      const b = bytes[i++];
      if (b < 0x80) {
        s += String.fromCharCode(b);
      } else if (b < 0xe0) {
        const b2 = bytes[i++];
        s += String.fromCharCode(((b & 0x1f) << 6) | (b2 & 0x3f));
      } else if (b < 0xf0) {
        const b2 = bytes[i++], b3 = bytes[i++];
        s += String.fromCharCode(((b & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f));
      } else {
        const b2 = bytes[i++], b3 = bytes[i++], b4 = bytes[i++];
        const u = ((b & 0x07) << 18) | ((b2 & 0x3f) << 12) | ((b3 & 0x3f) << 6) | (b4 & 0x3f);
        const c = u - 0x10000;
        s += String.fromCharCode(0xd800 + (c >> 10), 0xdc00 + (c & 0x3ff));
      }
    }
    return s;
  }

  // v0.04 keys (Gemini = "the kBanana key" from the original brief).
  const KEY_NAME        = "kbanana.apiKey";
  const MODEL_KEY       = "kbanana.modelId";
  // v0.06 — second provider key. Independent of Gemini's; saved in
  // secureStorage; used when the active model's registry entry has
  // provider === "openai".
  const OPENAI_KEY_NAME = "kbanana.openaiApiKey";

  async function saveKey(k) { await ssget().setItem(KEY_NAME, strToBytes(k)); }
  async function loadKey() {
    try {
      const b = await ssget().getItem(KEY_NAME);
      return b ? bytesToStr(b) : "";
    } catch (_) { return ""; }
  }
  async function saveModel(id) { await ssget().setItem(MODEL_KEY, strToBytes(id)); }
  async function loadModel() {
    try {
      const b = await ssget().getItem(MODEL_KEY);
      return b ? bytesToStr(b) : "";
    } catch (_) { return ""; }
  }
  async function saveOpenAIKey(k) { await ssget().setItem(OPENAI_KEY_NAME, strToBytes(k)); }
  async function loadOpenAIKey() {
    try {
      const b = await ssget().getItem(OPENAI_KEY_NAME);
      return b ? bytesToStr(b) : "";
    } catch (_) { return ""; }
  }
  // v0.07 — third adapter (FINISHING — Topaz Image API).
  // Independent of the two generation keys. Stored in secureStorage,
  // used by the Upscale action only. Never sent anywhere except
  // api.topazlabs.com.
  const TOPAZ_KEY_NAME = "kbanana.topazApiKey";
  async function saveTopazKey(k) { await ssget().setItem(TOPAZ_KEY_NAME, strToBytes(k)); }
  async function loadTopazKey() {
    try {
      const b = await ssget().getItem(TOPAZ_KEY_NAME);
      return b ? bytesToStr(b) : "";
    } catch (_) { return ""; }
  }

  // v0.12 — fourth adapter (Black Forest Labs / Flux.2). Generation provider,
  // own key, `x-key` header. Independent of the others.
  const BFL_KEY_NAME = "kbanana.bflApiKey";
  async function saveBflKey(k) { await ssget().setItem(BFL_KEY_NAME, strToBytes(k)); }
  async function loadBflKey() {
    try {
      const b = await ssget().getItem(BFL_KEY_NAME);
      return b ? bytesToStr(b) : "";
    } catch (_) { return ""; }
  }
  // v0.12 — Clarity (ClarityAI.co) upscaler key. SCAFFOLD ONLY: clarityai.co has
  // no public first-party API endpoint to call (see upscaleViaClarity stub), so
  // this key is stored/ready but unused until a documented direct endpoint exists.
  const CLARITY_KEY_NAME = "kbanana.clarityApiKey";
  async function saveClarityKey(k) { await ssget().setItem(CLARITY_KEY_NAME, strToBytes(k)); }
  async function loadClarityKey() {
    try {
      const b = await ssget().getItem(CLARITY_KEY_NAME);
      return b ? bytesToStr(b) : "";
    } catch (_) { return ""; }
  }
  // v0.14 — Fal (FAL_KEY). One key for all Fal-lane models.
  const FAL_KEY_NAME = "kbanana.falApiKey";
  async function saveFalKey(k) { await ssget().setItem(FAL_KEY_NAME, strToBytes(k)); }
  async function loadFalKey() {
    try {
      const b = await ssget().getItem(FAL_KEY_NAME);
      return b ? bytesToStr(b) : "";
    } catch (_) { return ""; }
  }

  // ----- model registry -----
  // Each entry FULLY defines its own option sets. Resolution + Aspect pills
  // in the UI are rebuilt from these arrays whenever the model changes.
  // maxRefImages is the per-model reference image cap.
  const DEFAULT_MODEL_ID = "gemini-3-pro-image-preview";
  const MATCH_INPUT = "Match Input";
  // Fit Canvas — a synthetic aspect option shown ONLY in the pill row (never
  // stored in MODELS.aspectRatios, so the aspect-math helpers never see it).
  // When selected, generation uses the active document's own aspect (nearest
  // model-supported ratio) so the placed result fills the canvas edge-to-edge.
  const FIT_CANVAS = "Fit Canvas";
  const MODELS = {
    "gemini-3-pro-image-preview": {
      id: "gemini-3-pro-image-preview",
      displayName: "Nano Banana Pro",
      provider:    "gemini",
      resolutions:  ["1K", "2K", "4K"],
      aspectRatios: [MATCH_INPUT, "1:1", "3:2", "2:3", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
      maxRefImages: 14,
    },
    "gemini-3.1-flash-image-preview": {
      id: "gemini-3.1-flash-image-preview",
      displayName: "Nano Banana 2",
      provider:    "gemini",
      resolutions:  ["0.5K", "1K", "2K", "4K"],
      aspectRatios: [MATCH_INPUT, "1:1", "3:2", "2:3", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9", "1:4", "4:1", "1:8", "8:1"],
      maxRefImages: 14,
    },
    "gpt-image-2": {
      // v0.06 — second direct provider. GPT Image 2 (launched 2026-04-21,
      // pinned id "gpt-image-2-2026-04-21"). Stricter than the deprecated
      // gpt-image-1 / DALL·E family: NO response_format param (b64_json
      // is default), aspect ratio <= 3:1, dimensions multiples of 16,
      // total pixels 655,360 .. 8,294,400, max edge 3840px.
      //
      // GATING: gpt-image-2 is gated behind API Organization Verification
      // in OpenAI's developer console. If a request fails with a
      // permissions / access error rather than a param error, the org/
      // key needs verification before any call works. The adapter
      // surfaces that distinctly so it's not chased as a code bug.
      id: "gpt-image-2",
      displayName: "GPT Image",
      provider:    "openai",
      resolutions:  ["1K", "2K", "4K"],         // map → low / medium / high quality
      // GPT Image 2 allows ANY aspect ratio up to 3:1 (with dims multiples
      // of 16). Include every ratio in the Gemini-aligned set that is
      // ≤ 3:1; drop only the >3:1 extremes (8:1, 1:8, 4:1, 1:4).
      aspectRatios: [MATCH_INPUT, "1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"],
      maxRefImages: 16,
    },
    // v0.12 — Black Forest Labs FLUX.2. Provider "bfl", ASYNC (submit→poll).
    // FLUX.2 controls size via width/height (NOT aspect_ratio) and has NO
    // negative_prompt — so NO negative-prompt field for Flux. The conditional
    // negative-prompt mechanism stays dormant; it lights up only for a future
    // engine that sets `supportsNegativePrompt: true`. Output ~4MP cap →
    // resolutions stop at 2K. Up to 8 reference images.
    "flux-2-pro": {
      id: "flux-2-pro",
      displayName: "Flux.2 Pro",
      provider:    "bfl",
      bflPath:     "/v1/flux-2-pro",
      resolutions:  ["1K", "2K"],
      aspectRatios: [MATCH_INPUT, "1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"],
      maxRefImages: 8,
    },
    "flux-2-max": {
      id: "flux-2-max",
      displayName: "Flux.2 Max",
      provider:    "bfl",
      bflPath:     "/v1/flux-2-max",
      resolutions:  ["1K", "2K"],
      aspectRatios: [MATCH_INPUT, "1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"],
      maxRefImages: 8,
    },
    // v0.14 — FAL LANE (deliberate, isolated aggregator exception; group "fal").
    // Provider "fal", ASYNC queue (submit → poll status → result). Text-to-image
    // only (maxRefImages 0). Cost is Fal's BILLED (aggregator markup), not a clean
    // first-party per-run cost — surfaced in the UI + log (routedVia:"fal").
    "fal-flux-dev": {
      id: "fal-flux-dev",
      displayName: "Flux dev + LoRA (Fal)",
      provider:    "fal",
      group:       "fal",
      falPath:     "fal-ai/flux-lora",
      resolutions:  ["1K", "2K"],
      aspectRatios: [MATCH_INPUT, "1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"],
      maxRefImages: 0,
      falSafetyToggle: true,   // exposes enable_safety_checker (intimates unblock)
      falLora: true,           // exposes the LoRA weights-URL + scale slot
    },
    // v0.14 — Fal EDIT model (image-to-image / instruction redress, VTO). Reads
    // the CURRENT COMPOSITE as the input image (image_urls array); added refs ride
    // along (e.g. a garment ref). Same safety toggle + LoRA slot as flux-dev t2i.
    "fal-flux-edit": {
      id: "fal-flux-edit",
      displayName: "Flux dev Edit + LoRA (Fal)",
      provider:    "fal",
      group:       "fal",
      falPath:     "fal-ai/flux-2/lora/edit",
      falEdit:     true,        // image-to-image: feeds the composite into image_urls
      resolutions:  ["1K", "2K"],
      aspectRatios: [MATCH_INPUT, "1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"],
      maxRefImages: 4,          // source = the composite; refs = optional garment(s)
      falSafetyToggle: true,
      falLora: true,
    },
    "fal-qwen": {
      id: "fal-qwen",
      displayName: "Qwen (Fal)",
      provider:    "fal",
      group:       "fal",
      falPath:     "fal-ai/qwen-image",
      resolutions:  ["1K", "2K"],
      aspectRatios: [MATCH_INPUT, "1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"],
      maxRefImages: 0,
      falSafetyToggle: true,
    },
    "fal-seedream": {
      id: "fal-seedream",
      // NOTE: Fal hosts Seedream v4 (Seedream 4.0). No v4.5 endpoint exists on Fal
      // (flagged); wiring the confirmed v4 path. Update if a 4.5 path appears.
      displayName: "Seedream (Fal)",
      provider:    "fal",
      group:       "fal",
      falPath:     "fal-ai/bytedance/seedream/v4/text-to-image",
      resolutions:  ["1K", "2K", "4K"],   // Seedream native 4K (cap 4096)
      aspectRatios: [MATCH_INPUT, "1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"],
      maxRefImages: 0,
      falSafetyToggle: true,
    },
  };
  function defaultResFor(modelId)    { const m = MODELS[modelId]; return (m && (m.resolutions.indexOf("2K") >= 0 ? "2K" : m.resolutions[0])) || "2K"; }
  function defaultAspectFor(modelId) { return MATCH_INPUT; }
  // Aspect VALUES for the pill row = the model's ratios with FIT_CANVAS spliced
  // in right after MATCH_INPUT. Keeps Fit Canvas in the UI only; MODELS stays
  // untouched. Used by both aspect-rebuild sites so selection survives model
  // switches.
  function aspectValuesFor(modelId) {
    const m = MODELS[modelId] || MODELS[DEFAULT_MODEL_ID];
    const ratios = (m && m.aspectRatios) ? m.aspectRatios : [MATCH_INPUT];
    const rest = ratios.filter(function (r) { return r !== MATCH_INPUT && r !== FIT_CANVAS; });
    return [MATCH_INPUT, FIT_CANVAS].concat(rest);
  }

  // Map UI labels (model registry values) to the literal strings the API
  // accepts for image_size. Per docs the 0.5K slot is sent as "512" for
  // NB2; the others are "1K" / "2K" / "4K" verbatim.
  const IMAGE_SIZE_WIRE = {
    "0.5K": "512",
    "1K":   "1K",
    "2K":   "2K",
    "4K":   "4K",
  };

  // -----------------------------------------------------------------------
  // ONE shared aspect-handling path — called by generateImage for both
  // Generate and every Edit type. No per-tab / per-mode copies.
  //
  // Two principles encoded as the two branches:
  //
  //   GENERATE mode (and EXTEND — user is deliberately changing shape):
  //     "The canvas is the target shape." Honor the user's pill verbatim.
  //     Match Input → snap active-doc dims to nearest supported ratio,
  //     orientation preserved.
  //
  //   EDIT mode (selection or whole-image, where a base layer/image exists
  //   and the result composites back onto it):
  //     "The base image dictates the shape." Always derive from the base
  //     layer dimensions and snap to nearest supported ratio. An explicit
  //     pill is IGNORED — composite-back requires base-matching aspect.
  //     EXTEND is the one exception (it's listed as "edit" structurally
  //     but its job is changing shape — callers pass mode="extend").
  //
  // Result is NEVER null. Omitting aspect = NB default = wrong shape. We
  // always send a resolved aspect_ratio.
  // -----------------------------------------------------------------------

  function parseAspectLabel(label) {
    if (!label || label === MATCH_INPUT) return null;
    const parts = String(label).split(":");
    const w = Number(parts[0]);
    const h = Number(parts[1]);
    if (!w || !h || !isFinite(w) || !isFinite(h)) return null;
    return { w: w, h: h, v: w / h };
  }

  function modelSupportsAspect(modelId, ratio) {
    const model = MODELS[modelId];
    if (!model || !model.aspectRatios) return false;
    return model.aspectRatios.indexOf(ratio) >= 0;
  }

  function orientationOf(width, height) {
    if (!width || !height || width <= 0 || height <= 0) return "square";
    const v = width / height;
    if (Math.abs(v - 1) < 1e-6) return "square";
    return v > 1 ? "landscape" : "portrait";
  }

  function ratioOrientation(ratioStr) {
    const p = parseAspectLabel(ratioStr);
    if (!p) return "square";
    if (Math.abs(p.v - 1) < 1e-6) return "square";
    return p.v > 1 ? "landscape" : "portrait";
  }

  function nearestSupportedAspectOriented(modelId, width, height) {
    const model = MODELS[modelId] || MODELS[DEFAULT_MODEL_ID];
    if (!model || !model.aspectRatios) return "1:1";
    const orient = orientationOf(width, height);
    if (orient === "square") return modelSupportsAspect(modelId, "1:1") ? "1:1" : firstSupportedRatio(modelId);

    const actual = width / height;
    let best = null;
    let bestDiff = Infinity;
    for (let i = 0; i < model.aspectRatios.length; i++) {
      const label = model.aspectRatios[i];
      if (label === MATCH_INPUT) continue;
      const p = parseAspectLabel(label);
      if (!p) continue;
      // Orientation filter.
      const o = ratioOrientation(label);
      if (o !== orient) continue;
      const d = Math.abs(actual - p.v);
      if (d < bestDiff) { best = label; bestDiff = d; }
    }
    return best || firstSupportedRatio(modelId);
  }

  function firstSupportedRatio(modelId) {
    const model = MODELS[modelId] || MODELS[DEFAULT_MODEL_ID];
    if (!model || !model.aspectRatios) return "1:1";
    for (let i = 0; i < model.aspectRatios.length; i++) {
      if (model.aspectRatios[i] !== MATCH_INPUT) return model.aspectRatios[i];
    }
    return "1:1";
  }

  // Single entry point used by generateImage. Returns the resolved
  // aspect_ratio string (never null) + a breadcrumb describing how it
  // was picked, for logging.
  //
  // opts.aspectMode ∈ {"generate","edit","extend"}.
  //   generate / extend → user's pill is authoritative (with model-validity
  //     fallback); Match Input snaps doc dims.
  //   edit → base dims are authoritative; pill is ignored.
  function resolveAspectForRequest(opts, modelId) {
    const mode = opts.aspectMode || "generate";
    const explicit = opts.aspectRatio;
    const tag = "[" + mode + "]";

    // ----- FIT CANVAS: use the ACTIVE DOCUMENT's own aspect (any mode) -----
    // Read the canvas dims LIVE, snap to the nearest model-supported ratio so
    // the generated result fills the document edge-to-edge (no transparent
    // borders). Falls back to opts dims, then a safe default.
    if (explicit === FIT_CANVAS) {
      let cw = 0, ch = 0;
      try {
        const d = psMod().app.activeDocument;
        if (d) { cw = Math.round(d.width); ch = Math.round(d.height); }
      } catch (_) {}
      if (!cw || !ch) { cw = opts.sourceWidth || 0; ch = opts.sourceHeight || 0; }
      if (cw && ch) {
        const r = nearestSupportedAspectOriented(modelId, cw, ch);
        return { ratio: r, picked: tag + " fit-canvas(" + cw + "x" + ch + ")" };
      }
      return { ratio: firstSupportedRatio(modelId), picked: tag + " fit-canvas-no-doc-default" };
    }

    // ----- EDIT: base image dictates shape (composite-back rule) -----
    if (mode === "edit") {
      if (opts.sourceWidth && opts.sourceHeight) {
        const r = nearestSupportedAspectOriented(modelId, opts.sourceWidth, opts.sourceHeight);
        return { ratio: r, picked: tag + " base(" + opts.sourceWidth + "x" + opts.sourceHeight + ")"
          + (explicit && explicit !== MATCH_INPUT ? " (pill " + explicit + " ignored)" : "") };
      }
      return { ratio: firstSupportedRatio(modelId), picked: tag + " no-base-default" };
    }

    // ----- GENERATE / EXTEND: pill is authoritative; Match Input → snap -----
    if (explicit && explicit !== MATCH_INPUT) {
      if (modelSupportsAspect(modelId, explicit)) {
        return { ratio: explicit, picked: tag + " explicit-verbatim" };
      }
      // Picked ratio isn't supported by this model — snap to nearest
      // same-orientation ratio that IS supported. Never empty.
      const p = parseAspectLabel(explicit);
      if (p) {
        const fb = nearestSupportedAspectOriented(modelId, p.w, p.h);
        return { ratio: fb, picked: tag + " explicit-fallback(not-supported-by-" + modelId + ")" };
      }
      return { ratio: firstSupportedRatio(modelId), picked: tag + " explicit-fallback(unparseable)" };
    }
    // Match Input
    if (opts.sourceWidth && opts.sourceHeight) {
      const r = nearestSupportedAspectOriented(modelId, opts.sourceWidth, opts.sourceHeight);
      return { ratio: r, picked: tag + " match-input(" + opts.sourceWidth + "x" + opts.sourceHeight + ")" };
    }
    return { ratio: "1:1", picked: tag + " match-input-no-dims-default" };
  }

  // Back-compat shim — older call sites that used nearestSupportedAspect
  // still work; orientation now preserved by default.
  function nearestSupportedAspect(modelId, width, height) {
    return nearestSupportedAspectOriented(modelId, width, height);
  }

  // ----- gemini -----
  const HOST = "https://generativelanguage.googleapis.com";
  // Preview image models live under v1beta. v1 returns 404 model-not-found.
  const API_VERSION = "v1beta";
  function endpoint(modelId) {
    return HOST + "/" + API_VERSION + "/models/" + encodeURIComponent(modelId) + ":generateContent";
  }
  function authHeaders(apiKey) { return { "Content-Type": "application/json", "x-goog-api-key": apiKey }; }

  function extractImage(json) {
    const parts = json && json.candidates && json.candidates[0]
      && json.candidates[0].content && json.candidates[0].content.parts;
    if (!parts) return null;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const data = (p && p.inlineData && p.inlineData.data)
                || (p && p.inline_data && p.inline_data.data);
      if (data) {
        const mime = (p.inlineData && p.inlineData.mimeType)
                  || (p.inline_data && p.inline_data.mime_type)
                  || "image/png";
        return { base64: data, mime };
      }
    }
    return null;
  }

  // Build a useful error message when the model returned a response with
  // no image. The common causes are:
  //   - candidates[0].finishReason  ∈ {SAFETY, RECITATION, PROHIBITED_CONTENT,
  //                                    BLOCKLIST, OTHER, MAX_TOKENS, STOP}
  //   - candidates[0].safetyRatings  (per-category HIGH/MEDIUM flags)
  //   - promptFeedback.blockReason   (input filter blocked the prompt entirely)
  // Previously this collapsed everything into "(no detail)" — surface the
  // real reason so the user knows whether it's a safety block, a content
  // filter on the input, or a genuine empty result.
  function diagnoseNoImage(json) {
    const cand = json && json.candidates && json.candidates[0];
    const pf   = json && json.promptFeedback;
    const lines = [];

    if (cand && cand.finishReason) {
      lines.push("finish_reason=" + cand.finishReason);
    }

    if (cand && cand.safetyRatings && cand.safetyRatings.length) {
      const hot = cand.safetyRatings.filter(function (r) {
        return r && (r.blocked === true || r.probability === "HIGH" || r.probability === "MEDIUM");
      });
      if (hot.length) {
        lines.push("safety=" + hot.map(function (r) {
          const cat = String(r.category || "?").replace(/^HARM_CATEGORY_/, "");
          return cat + ":" + (r.probability || "?") + (r.blocked ? " (blocked)" : "");
        }).join(", "));
      }
    }

    if (pf && pf.blockReason) {
      lines.push("prompt_block=" + pf.blockReason);
      if (pf.blockReasonMessage) lines.push("prompt_block_msg=" + pf.blockReasonMessage);
    }
    if (pf && pf.safetyRatings && pf.safetyRatings.length) {
      const hot = pf.safetyRatings.filter(function (r) {
        return r && (r.blocked === true || r.probability === "HIGH" || r.probability === "MEDIUM");
      });
      if (hot.length) {
        lines.push("prompt_safety=" + hot.map(function (r) {
          const cat = String(r.category || "?").replace(/^HARM_CATEGORY_/, "");
          return cat + ":" + (r.probability || "?") + (r.blocked ? " (blocked)" : "");
        }).join(", "));
      }
    }

    const parts = (cand && cand.content && cand.content.parts) || [];
    const text = parts.map(function (p) { return p && p.text; }).filter(Boolean).join(" ");
    if (text) lines.push("text=" + text.slice(0, 200));

    return lines.length ? lines.join(" | ") : "(no detail)";
  }

  // Friendly headline for the most common terminal cases.
  function noImageHeadline(json) {
    const cand = json && json.candidates && json.candidates[0];
    const pf   = json && json.promptFeedback;
    const fr   = cand && cand.finishReason;
    const pb   = pf && pf.blockReason;
    if (fr === "SAFETY" || pb === "SAFETY")                      return "Blocked by safety filter";
    if (fr === "PROHIBITED_CONTENT" || pb === "PROHIBITED_CONTENT") return "Blocked: prohibited content";
    if (fr === "RECITATION")                                     return "Blocked: recitation filter";
    if (fr === "BLOCKLIST")                                      return "Blocked by content blocklist";
    if (pb === "OTHER" || fr === "OTHER")                        return "Model declined to generate";
    return "No image returned";
  }
  async function safeText(res) { try { return await res.text(); } catch (_) { return ""; } }
  function shortErr(text) {
    try { const j = JSON.parse(text); return (j && j.error && j.error.message) || text.slice(0, 200); }
    catch (_) { return (text || "").slice(0, 200); }
  }
  // -----------------------------------------------------------------------
  // PROVIDER DISPATCH (v0.06)
  //
  // Both providers share the same neutral interface:
  //   testConnection(apiKey)                    → { ok, message }
  //   generateImage(apiKey, opts) → { base64, mime }
  //
  // Inside, each one has its own request-building + endpoint logic.
  // generateImage() (top-level) routes by MODELS[opts.modelId].provider.
  // -----------------------------------------------------------------------

  async function testConnection(apiKey, provider) {
    const p = provider || "gemini";
    if (p === "openai") return testConnectionOpenAI(apiKey);
    return testConnectionGemini(apiKey);
  }

  async function testConnectionGemini(apiKey) {
    if (!apiKey) return { ok: false, message: "no key" };
    try {
      // Minimal valid generateContent body. Same v1beta endpoint as the
      // image generation call, so success here proves the path the real
      // request will use is reachable.
      const res = await fetch(HOST + "/" + API_VERSION + "/models/gemini-2.5-flash:generateContent", {
        method: "POST",
        headers: authHeaders(apiKey),
        body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] }),
      });
      if (res.ok) return { ok: true, message: "connected" };
      return { ok: false, message: res.status + " " + shortErr(await safeText(res)) };
    } catch (e) {
      return { ok: false, message: (e && e.message) || String(e) };
    }
  }
  // Top-level adapter dispatch: routes by the active model's provider.
  async function generateImage(apiKey, opts) {
    const modelId = (opts && opts.modelId) || DEFAULT_MODEL_ID;
    const model = MODELS[modelId];
    const provider = (model && model.provider) || "gemini";
    if (provider === "openai") return generateImageOpenAI(apiKey, opts);
    if (provider === "bfl")    return generateImageFlux(apiKey, opts);
    if (provider === "fal")    return generateImageFal(apiKey, opts);
    return generateImageGemini(apiKey, opts);
  }

  async function generateImageGemini(apiKey, opts) {
    if (!apiKey) throw new Error("Missing API key");
    if (!opts || !opts.prompt || !opts.prompt.trim()) throw new Error("Prompt is required");
    const modelId = opts.modelId || DEFAULT_MODEL_ID;
    if (!MODELS[modelId]) throw new Error("Unknown model: " + modelId);

    // SNAKE_CASE body throughout (the REST endpoint normalizes field paths
    // to snake_case in error messages — keep the wire format aligned).
    //
    // SHARED ACROSS MODELS: this builder runs identically for NB2, NB Pro,
    // or any other image-accepting model. There is NO model-specific branch
    // for refs.
    //
    // CRITICAL framing rule (edit + refs):
    //   When a source layer AND ≥1 reference are present, the model was
    //   editing the LAST image (a reference) instead of the source. Fix:
    //   prefix the instruction with explicit role framing AND insert
    //   text labels between each image so every inline_data part carries
    //   its role tag immediately before it:
    //     [ instruction text with role framing ]
    //     [ text: "--- BASE IMAGE (edit this) ---" ]
    //     [ inline_data: source ]
    //     [ text: "--- REFERENCE 1 (guidance only — do NOT edit) ---" ]
    //     [ inline_data: ref1 ]
    //     [ text: "--- REFERENCE 2 (guidance only — do NOT edit) ---" ]
    //     [ inline_data: ref2 ]
    //     ...
    //   For paths without a source (Generate) or without refs (Edit with
    //   no refs) the original simpler shape is kept so nothing regresses.
    const refs = opts.refImages || [];
    const hasSource = !!(opts.sourceImage && opts.sourceImage.base64);

    // Filter refs to only valid ones up front (preserves the v0.04.1
    // integrity check + per-ref diagnostics).
    const validRefs = [];
    for (let i = 0; i < refs.length; i++) {
      const r = refs[i];
      if (!r || !r.base64 || !r.mime || r.base64.length === 0) {
        try {
          console.warn(TAG, "ref " + (i + 1) + "/" + refs.length
            + " skipped (invalid): name=" + (r && r.name)
            + " has_base64=" + !!(r && r.base64)
            + " has_mime=" + !!(r && r.mime));
        } catch (_) {}
        continue;
      }
      validRefs.push(r);
      try {
        console.log(TAG, "valid ref " + validRefs.length + "/" + refs.length
          + ": name=" + (r.name || "(unnamed)")
          + " mime=" + r.mime
          + " base64.len=" + r.base64.length);
      } catch (_) {}
    }
    const refsAttached = validRefs.length;
    if (refsAttached !== refs.length) {
      try {
        console.warn(TAG, "REF COUNT MISMATCH: UI had " + refs.length
          + " refs, " + refsAttached + " accepted. Check warnings above.");
      } catch (_) {}
    }

    const parts = [];

    if (hasSource && refsAttached > 0) {
      // ----- Labeled edit-with-refs shape -----
      const refCount = refsAttached;
      const framing =
        "Apply the following edit to the BASE IMAGE only. " +
        "The BASE IMAGE is the first image labeled 'BASE IMAGE' below. " +
        "There " + (refCount === 1 ? "is 1" : "are " + refCount) + " additional image"
        + (refCount === 1 ? "" : "s") + " labeled 'REFERENCE' — those are guidance only "
        + "(style, color, composition). Do NOT edit, copy out, or output the references. "
        + "Output a single edited version of the BASE IMAGE.\n\n"
        + "Edit instruction: " + (opts.prompt || "");

      parts.push({ text: framing });
      parts.push({ text: "--- BASE IMAGE (edit this) ---" });
      parts.push({
        inline_data: {
          mime_type: opts.sourceImage.mime || "image/png",
          data: opts.sourceImage.base64,
        },
      });
      for (let i = 0; i < validRefs.length; i++) {
        const r = validRefs[i];
        parts.push({ text: "--- REFERENCE " + (i + 1)
          + " of " + refCount + " (guidance only — do NOT edit) ---" });
        parts.push({ inline_data: { mime_type: r.mime, data: r.base64 } });
      }
    } else if (hasSource) {
      // ----- Edit without refs (unchanged shape) -----
      parts.push({ text: opts.prompt });
      parts.push({
        inline_data: {
          mime_type: opts.sourceImage.mime || "image/png",
          data: opts.sourceImage.base64,
        },
      });
    } else if (opts.composeRefGen && refsAttached > 0) {
      // ----- Reference Gen (Compose) — refs-only with explicit
      // "hold subject identity" labeling. No source image to edit; the
      // references are the subject the model must preserve.
      const refCount = refsAttached;
      const framing =
        "Generate a new image. Use the following REFERENCE image"
        + (refCount === 1 ? "" : "s")
        + " to hold the subject identity and scene-consistency cues — "
        + "match the same person / object / setting across the new image. "
        + "Do NOT copy a reference out verbatim; produce a new shot that"
        + " is recognizably the same subject. New image instruction: "
        + (opts.prompt || "");
      parts.push({ text: framing });
      for (let i = 0; i < validRefs.length; i++) {
        const r = validRefs[i];
        parts.push({ text: "--- REFERENCE " + (i + 1) + " of " + refCount
          + " (hold this subject / identity) ---" });
        parts.push({ inline_data: { mime_type: r.mime, data: r.base64 } });
      }
    } else {
      // ----- Generate (no source, no refgen framing). -----
      parts.push({ text: opts.prompt });
      for (let i = 0; i < validRefs.length; i++) {
        const r = validRefs[i];
        parts.push({ inline_data: { mime_type: r.mime, data: r.base64 } });
      }
    }

    // ----- minimal body baseline -----
    // Sequence of 400s we've already burned through:
    //   400 Unknown name "responseModalities" at 'generation_config'
    //   400 Unknown name "image_config"      at 'generation_config'
    //   400 Unknown name "image_config"       (top level)
    // The API reference page documents top-level fields contents / tools /
    // toolConfig / safetySettings / systemInstruction / generationConfig /
    // cachedContent / serviceTier / store — no image_config anywhere. The
    // image-generation docs page is inconsistent across queries.
    //
    // Until the correct placement is locked, we send the minimal known-good
    // body — just contents. The image models return an image at default
    // size/aspect with no config at all. Pills are read but NOT wired into
    // the request — we'll plumb them through once placement is confirmed.
    // ----- aspect + size (ONE shared builder) -----
    // resolveAspectForRequest is the single decision point for both paths.
    // It always returns a non-null ratio + a breadcrumb describing how it
    // was picked. We log per-call so the value we WANT to send is visible.
    const resolved = resolveAspectForRequest(opts, modelId);
    const resolvedAspect = resolved.ratio;
    try {
      console.log(TAG, "aspect resolved: " + resolvedAspect
        + " via " + resolved.picked
        + " | model=" + modelId
        + " pill=" + (opts.aspectRatio || "(none)")
        + " source=" + (opts.sourceWidth || "?") + "x" + (opts.sourceHeight || "?"));
    } catch (_) {}

    const imageConfig = {};
    if (resolvedAspect) imageConfig.aspect_ratio = resolvedAspect;
    if (opts.imageSize) {
      const wireSize = IMAGE_SIZE_WIRE[opts.imageSize] || opts.imageSize;
      imageConfig.image_size = wireSize;
    }

    // -----------------------------------------------------------------
    // Body shape per the live docs page (re-fetched 2026-05-30):
    //
    //   {
    //     "contents": [...],
    //     "generationConfig": {
    //       "responseModalities": ["TEXT", "IMAGE"],
    //       "responseFormat": {
    //         "image": {
    //           "aspectRatio": "1:1",        // strings: 1:1, 3:2, …, 21:9
    //           "imageSize":   "2K"          // strings: 512 | 1K | 2K | 4K
    //         }
    //       }
    //     }
    //   }
    //
    // Notes:
    //  - CAMELCASE throughout (the snake_case sibling shape returned 400
    //    "Invalid value" — same path, different result, suggests the
    //    case matters for value parsing here).
    //  - imageSize literals MUST be uppercase K — "1k" is rejected per
    //    the docs.
    //  - Includes responseModalities. Pro rejected it on
    //    generation_config (snake_case) earlier; trying the camelCase
    //    docs shape here. If Pro still 400s on it, we log and remove.
    // -----------------------------------------------------------------
    const body = { contents: [{ parts: parts }] };
    if (Object.keys(imageConfig).length) {
      // Path per BerriAI/litellm issue #18656 (a real-world report against
      // the same model family): generationConfig.imageConfig.{aspectRatio,
      // imageSize}. CAMELCASE for both the parent field and the inner
      // keys. String values verbatim — "1:1", "16:9", "2K", "4K", etc.
      //
      // Differs from the docs page's responseFormat.image example, which
      // returned 400 "Invalid value" — i.e. that path resolved as a real
      // type (ImageResponseFormat) but rejected the same string values.
      // imageConfig is a sibling type that does take these strings.
      const imageBlock = {};
      if (imageConfig.aspect_ratio) imageBlock.aspectRatio = imageConfig.aspect_ratio;
      if (imageConfig.image_size)   imageBlock.imageSize   = imageConfig.image_size;
      body.generationConfig = {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: imageBlock,
      };
    }

    // Body summary (NOT the body itself — would dump megabytes of base64).
    // For edit-with-refs the body is now interleaved with role-label text
    // parts so each inline_data has its tag immediately before it.
    try {
      const imageParts = parts.filter(function (p) { return p && p.inline_data; });
      const textParts  = parts.filter(function (p) { return p && p.text; });
      const sourceImageCount = hasSource ? 1 : 0;
      const mimes = imageParts.map(function (p) { return p.inline_data.mime_type; }).join(", ");
      const labels = textParts.map(function (p) {
        const t = p.text || "";
        return t.length > 60 ? t.slice(0, 57) + "…" : t;
      });
      console.log(TAG, "request:",
        "model=" + modelId,
        "ui_refs=" + refs.length,
        "source_image=" + sourceImageCount,
        "refs_attached=" + refsAttached,
        "image_parts=" + imageParts.length,
        "text_parts=" + textParts.length,
        "shape=" + (hasSource && refsAttached > 0 ? "labeled-edit-with-refs"
                    : hasSource ? "edit-no-refs"
                    : opts.composeRefGen && refsAttached > 0 ? "refgen-labeled"
                    : "generate"),
        "aspect_ratio=" + (imageConfig.aspect_ratio || "(omitted)"),
        "image_size=" + (imageConfig.image_size || "(omitted)"));
      console.log(TAG, "request mimes:", mimes);
      console.log(TAG, "request text labels:", labels);

      // Full outgoing body dump with base64 strings elided.
      // This is the thing to paste back when the result aspect is still
      // wrong — proves exactly what went over the wire so we stop
      // guessing field paths.
      const safeBody = JSON.parse(JSON.stringify(body));
      if (safeBody && safeBody.contents) {
        for (let ci = 0; ci < safeBody.contents.length; ci++) {
          const cp = (safeBody.contents[ci] && safeBody.contents[ci].parts) || [];
          for (let pi = 0; pi < cp.length; pi++) {
            const part = cp[pi];
            if (part && part.inline_data && typeof part.inline_data.data === "string") {
              part.inline_data.data = "[base64 " + part.inline_data.data.length + " chars elided]";
            }
            if (part && part.inlineData && typeof part.inlineData.data === "string") {
              part.inlineData.data = "[base64 " + part.inlineData.data.length + " chars elided]";
            }
          }
        }
      }
      console.log(TAG, "FULL BODY (base64 elided):\n" + JSON.stringify(safeBody, null, 2));
    } catch (_) {}

    // TODO(image-config): once docs confirm placement, wire opts.aspectRatio
    // / opts.imageSize back in.  Likely candidates not yet tried:
    //   - generation_config.aspectRatio + .imageSize  (camelCase, direct)
    //   - generation_config.aspect_ratio + .image_size (snake, direct)
    //   - mediaResolution at top level
    void opts.aspectRatio; void opts.imageSize;

    const res = await fetch(endpoint(modelId), {
      method: "POST",
      headers: authHeaders(apiKey),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Gemini " + res.status + ": " + shortErr(await safeText(res)));
    const json = await res.json();

    // Log the response's promptFeedback / candidates[0].finishReason so
    // we can see if NB silently dropped fields it didn't recognize
    // (vs honoring them and returning the requested aspect).
    try {
      const cand = json && json.candidates && json.candidates[0];
      console.log(TAG, "response:",
        "candidates=" + (json && json.candidates ? json.candidates.length : 0),
        "finishReason=" + (cand && cand.finishReason),
        "promptFeedback=" + (json && json.promptFeedback ? JSON.stringify(json.promptFeedback) : "(none)"));
    } catch (_) {}

    const img = extractImage(json);
    if (img) {
      // Log the actual returned image dims so we can compare to the
      // requested aspect. atob to extract PNG IHDR / JPEG SOF dimensions.
      try {
        const dims = decodeImageDims(img.base64, img.mime);
        if (dims) {
          const orient = (dims.w === dims.h) ? "square" : (dims.w > dims.h ? "landscape" : "portrait");
          console.log(TAG, "RETURNED IMAGE: " + dims.w + "x" + dims.h
            + " (" + orient + ", ratio " + (dims.w / dims.h).toFixed(3)
            + ") requested aspect_ratio=" + (imageConfig.aspect_ratio || "(omitted)"));
        }
      } catch (e) {
        try { console.warn(TAG, "decodeImageDims failed:", e); } catch (_) {}
      }
    }

    if (!img) {
      try { console.warn(TAG, "no-image response keys:",
        Object.keys(json || {}).join(",")); } catch (_) {}
      try { console.warn(TAG, "diagnostics:", diagnoseNoImage(json)); } catch (_) {}
      const headline = noImageHeadline(json);
      const detail   = diagnoseNoImage(json);
      throw new Error(headline + " — " + detail);
    }
    return img;
  }

  // =======================================================================
  // OpenAI provider — gpt-image-2 (launched 2026-04-21)
  //   POST https://api.openai.com/v1/images/generations   (JSON)
  //   POST https://api.openai.com/v1/images/edits         (multipart)
  // Sizes:   "1024x1024" | "1024x1536" | "1536x1024" (preset names accepted;
  //          custom sizes allowed within dims-multiple-of-16, aspect≤3:1,
  //          total pixels 655360..8294400, max edge 3840px)
  // Quality: low | medium | high
  // Moderation: auto | low (optional; "low" = permissive but still filtered)
  // Auth:      Authorization: Bearer <key>
  // Response:  { data: [{ b64_json: "..." }, ...] }  — b64_json is the
  //            DEFAULT for this model; do NOT send response_format
  //            (deprecated DALL·E / gpt-image-1 param, rejected by v2).
  // Gating:    gpt-image-2 is gated behind Organization Verification in
  //            OpenAI's developer console. Permission/access errors here
  //            are an account-side issue, not a code bug — the adapter
  //            tags those error messages distinctly.
  // =======================================================================

  const OPENAI_HOST = "https://api.openai.com";

  function openaiAuthHeaders(apiKey) {
    return { "Authorization": "Bearer " + apiKey };
  }

  async function testConnectionOpenAI(apiKey) {
    if (!apiKey) return { ok: false, message: "no key" };
    try {
      // GET /v1/models is the cheapest auth check — returns the model
      // list on success, 401 on bad key, 403 on no access.
      const res = await fetch(OPENAI_HOST + "/v1/models", {
        method: "GET",
        headers: openaiAuthHeaders(apiKey),
      });
      if (res.ok) return { ok: true, message: "connected" };
      const text = await safeText(res);
      return { ok: false, message: res.status + " " + shortErr(text) };
    } catch (e) {
      return { ok: false, message: (e && e.message) || String(e) };
    }
  }

  // Map kBanana's aspect ratio → explicit GPT Image 2 pixel size "WxH".
  // Constraints v2 enforces:
  //   - both W and H must be multiples of 16
  //   - max edge ≤ 3840
  //   - total pixels in [655,360 .. 8,294,400]
  //   - aspect ratio ≤ 3:1
  //
  // Each value below targets roughly 1.0–2.2 megapixels — comfortable for
  // a high-quality result while staying inside the bounds, and pre-
  // verified for the 16-divisible / 3840 / pixel-total / 3:1 rules.
  //
  // Match Input + source dims known → orientation-preserving snap to the
  // nearest supported aspect via nearestSupportedAspectOriented (which
  // already reads the model's own aspectRatios list).
  const OPENAI_RATIO_SIZE = {
    "1:1":  "1024x1024",   //   1.05 MP
    "3:2":  "1536x1024",   //   1.57 MP
    "2:3":  "1024x1536",   //   1.57 MP
    "4:3":  "1280x960",    //   1.23 MP
    "3:4":  "960x1280",    //   1.23 MP
    "16:9": "1792x1008",   //   1.81 MP (1792/1008 = 1.778 — exact 16:9)
    "9:16": "1008x1792",   //   1.81 MP
    "21:9": "1792x768",    //   1.38 MP (1792/768  = 2.333 — exact 21:9)
  };

  function openaiSizeFromOpts(opts) {
    const explicit = opts.aspectRatio;
    if (explicit && OPENAI_RATIO_SIZE[explicit]) return OPENAI_RATIO_SIZE[explicit];

    const w = Number(opts.sourceWidth)  || 0;
    const h = Number(opts.sourceHeight) || 0;
    if (w > 0 && h > 0) {
      // Snap canvas dims to the model's supported list. GPT's registry
      // entry holds the same list of ratios used above, so the snap will
      // always land on a key that exists in OPENAI_RATIO_SIZE.
      const snapped = nearestSupportedAspectOriented("gpt-image-2", w, h);
      if (snapped && OPENAI_RATIO_SIZE[snapped]) return OPENAI_RATIO_SIZE[snapped];
    }
    return "1024x1024";
  }

  // Map kBanana's resolution pill → GPT's quality enum.
  function openaiQualityFromOpts(opts) {
    const size = opts.imageSize;
    if (size === "4K") return "high";
    if (size === "2K") return "medium";
    if (size === "0.5K" || size === "1K") return "low";
    return "medium";
  }

  // Build an alpha-PNG mask Blob from a maskSpec for OpenAI's
  // /v1/images/edits API. v2 mask semantics: TRANSPARENT pixels =
  // regenerate, OPAQUE pixels = preserve. Must match the input image's
  // dimensions exactly.
  //
  // Two construction paths:
  //   1. Canvas + toBlob (modern UXP supports it).
  //   2. Manual PNG bytes (uncompressed deflate IDAT, no zlib library
  //      needed) as a fallback if canvas isn't available.
  async function buildAlphaMaskBlob(width, height, maskSpec) {
    if (!maskSpec || !width || !height) return null;
    // --- Path 1: HTMLCanvasElement (preferred) ---
    try {
      if (typeof document !== "undefined" && document.createElement) {
        const canvas = document.createElement("canvas");
        if (canvas && canvas.getContext) {
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          // Default: fully opaque (preserve everything).
          ctx.fillStyle = "rgba(0,0,0,1)";
          ctx.fillRect(0, 0, width, height);
          // Clear the regenerate region to transparent.
          if (maskSpec.kind === "rect" && maskSpec.rect) {
            const r = maskSpec.rect;
            ctx.clearRect(r.left, r.top, r.right - r.left, r.bottom - r.top);
          } else if (maskSpec.kind === "frame" && maskSpec.oldRect) {
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = "rgba(0,0,0,1)";
            const r = maskSpec.oldRect;
            ctx.fillRect(r.left, r.top, r.right - r.left, r.bottom - r.top);
          }
          if (typeof canvas.toBlob === "function") {
            const blob = await new Promise(function (resolve) {
              canvas.toBlob(function (b) { resolve(b); }, "image/png");
            });
            if (blob) return blob;
          }
        }
      }
    } catch (e) {
      try { console.warn(TAG, "canvas mask failed, falling back:", e); } catch (_) {}
    }
    // --- Path 2: Manual PNG construction ---
    return new Blob([buildAlphaMaskPngBytes(width, height, maskSpec)],
      { type: "image/png" });
  }

  // Hand-built PNG: 8-bit RGBA, no compression (zlib stored deflate
  // blocks). Avoids any DEFLATE library dependency.
  function buildAlphaMaskPngBytes(width, height, maskSpec) {
    const stride = width * 4 + 1; // +1 for the per-row filter byte
    const raw = new Uint8Array(stride * height);
    // Default: all opaque black (preserve)
    for (let y = 0; y < height; y++) {
      raw[y * stride] = 0; // filter type = None
      for (let x = 0; x < width; x++) {
        const i = y * stride + 1 + x * 4;
        raw[i + 3] = 255; // alpha
      }
    }
    function clearRect(left, top, right, bottom) {
      const L = Math.max(0, Math.floor(left));
      const T = Math.max(0, Math.floor(top));
      const R = Math.min(width,  Math.ceil(right));
      const B = Math.min(height, Math.ceil(bottom));
      for (let y = T; y < B; y++) {
        for (let x = L; x < R; x++) {
          const i = y * stride + 1 + x * 4;
          raw[i + 3] = 0;
        }
      }
    }
    function fillRectOpaque(left, top, right, bottom) {
      // First clear everything, then fill the kept region
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const i = y * stride + 1 + x * 4;
          raw[i + 3] = 0;
        }
      const L = Math.max(0, Math.floor(left));
      const T = Math.max(0, Math.floor(top));
      const R = Math.min(width,  Math.ceil(right));
      const B = Math.min(height, Math.ceil(bottom));
      for (let y = T; y < B; y++) {
        for (let x = L; x < R; x++) {
          const i = y * stride + 1 + x * 4;
          raw[i + 3] = 255;
        }
      }
    }
    if (maskSpec.kind === "rect" && maskSpec.rect) {
      const r = maskSpec.rect;
      clearRect(r.left, r.top, r.right, r.bottom);
    } else if (maskSpec.kind === "frame" && maskSpec.oldRect) {
      const r = maskSpec.oldRect;
      fillRectOpaque(r.left, r.top, r.right, r.bottom);
    }
    return assemblePng(width, height, raw);
  }

  // CRC32 table + helper, needed for PNG chunks.
  let _crcTable = null;
  function crc32(bytes) {
    if (!_crcTable) {
      _crcTable = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        _crcTable[n] = c >>> 0;
      }
    }
    let c = 0xFFFFFFFF >>> 0;
    for (let i = 0; i < bytes.length; i++) {
      c = (_crcTable[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8)) >>> 0;
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function adler32(bytes) {
    let a = 1, b = 0;
    for (let i = 0; i < bytes.length; i++) {
      a = (a + bytes[i]) % 65521;
      b = (b + a) % 65521;
    }
    return ((b << 16) | a) >>> 0;
  }
  function be32(n) {
    return new Uint8Array([(n >>> 24) & 0xFF, (n >>> 16) & 0xFF, (n >>> 8) & 0xFF, n & 0xFF]);
  }
  function le16(n) { return new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF]); }
  function pngChunk(tag, data) {
    const tagBytes = new Uint8Array(4);
    for (let i = 0; i < 4; i++) tagBytes[i] = tag.charCodeAt(i);
    const out = new Uint8Array(8 + data.length + 4);
    out.set(be32(data.length), 0);
    out.set(tagBytes, 4);
    out.set(data, 8);
    const crcInput = new Uint8Array(tagBytes.length + data.length);
    crcInput.set(tagBytes, 0);
    crcInput.set(data, tagBytes.length);
    out.set(be32(crcInput.length ? crc32(crcInput) : 0), 8 + data.length);
    return out;
  }
  function zlibStored(raw) {
    // zlib header: deflate, 32K window, no level info, no dictionary
    const header = new Uint8Array([0x78, 0x01]);
    const blocks = [];
    let off = 0;
    while (off < raw.length) {
      const remaining = raw.length - off;
      const len = Math.min(remaining, 0xFFFF);
      const last = (off + len === raw.length) ? 1 : 0;
      blocks.push(new Uint8Array([last])); // BFINAL + BTYPE=00 (stored)
      blocks.push(le16(len));
      blocks.push(le16((~len) & 0xFFFF));
      blocks.push(raw.subarray(off, off + len));
      off += len;
    }
    const adler = be32(adler32(raw));
    const totalLen = header.length + blocks.reduce(function (s, b) { return s + b.length; }, 0) + adler.length;
    const out = new Uint8Array(totalLen);
    let pos = 0;
    out.set(header, pos); pos += header.length;
    for (let i = 0; i < blocks.length; i++) { out.set(blocks[i], pos); pos += blocks[i].length; }
    out.set(adler, pos);
    return out;
  }
  function assemblePng(width, height, raw) {
    const sig = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const ihdr = new Uint8Array(13);
    ihdr.set(be32(width),  0);
    ihdr.set(be32(height), 4);
    ihdr[8] = 8;  ihdr[9] = 6;  ihdr[10] = 0;  ihdr[11] = 0;  ihdr[12] = 0;
    const idatData = zlibStored(raw);
    const chunks = [
      sig,
      pngChunk("IHDR", ihdr),
      pngChunk("IDAT", idatData),
      pngChunk("IEND", new Uint8Array(0)),
    ];
    const total = chunks.reduce(function (s, c) { return s + c.length; }, 0);
    const out = new Uint8Array(total);
    let pos = 0;
    for (let i = 0; i < chunks.length; i++) { out.set(chunks[i], pos); pos += chunks[i].length; }
    return out;
  }

  // Base64 → Blob, used to attach images to the multipart edits endpoint.
  function base64ToBlob(b64, mime) {
    const clean = String(b64 || "").replace(/\s+/g, "");
    if (!clean) return new Blob([], { type: mime || "image/png" });
    if (typeof atob !== "function") {
      throw new Error("atob not available — cannot build Blob from base64.");
    }
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime || "image/png" });
  }

  // Concatenate text + image parts into a single human-readable prompt
  // string for OpenAI. GPT's API doesn't take per-image labels like
  // Gemini does — we fold our BASE/REFERENCE framing into the prompt
  // text, and the image roles are implicit by position (first = base
  // when present, rest = references).
  function openaiBuildPromptText(opts) {
    const base = opts.prompt || "";
    const hasSource = !!(opts.sourceImage && opts.sourceImage.base64);
    const refCount  = (opts.refImages || []).length;

    if (opts.composeRefGen && refCount > 0) {
      return "Generate a new image. The image" + (refCount === 1 ? "" : "s")
        + " provided " + (refCount === 1 ? "is" : "are")
        + " REFERENCE" + (refCount === 1 ? "" : "S")
        + " — hold the subject identity / scene cues; do not copy them out verbatim. "
        + "Instruction: " + base;
    }
    if (hasSource && refCount > 0) {
      return "Apply this edit to the BASE IMAGE (the first image) only. "
        + "The other " + refCount + " image"
        + (refCount === 1 ? " is a REFERENCE" : "s are REFERENCES")
        + " for style/content guidance only — do NOT output them. "
        + "Edit instruction: " + base;
    }
    return base;
  }

  async function generateImageOpenAI(apiKey, opts) {
    if (!apiKey) throw new Error("Missing OpenAI API key.");
    if (!opts || !opts.prompt || !opts.prompt.trim()) {
      throw new Error("Prompt is required.");
    }
    const modelId = opts.modelId || "gpt-image-2";
    const hasSource = !!(opts.sourceImage && opts.sourceImage.base64);
    const refs = opts.refImages || [];
    const hasInputImages = hasSource || refs.length > 0;
    const promptText = openaiBuildPromptText(opts);
    const size       = openaiSizeFromOpts(opts);
    const quality    = openaiQualityFromOpts(opts);

    try {
      console.log(TAG, "openai request:",
        "model=" + modelId,
        "endpoint=" + (hasInputImages ? "edits" : "generations"),
        "size=" + size,
        "quality=" + quality,
        "source=" + (hasSource ? 1 : 0),
        "refs=" + refs.length);
    } catch (_) {}

    let res;
    if (!hasInputImages) {
      // ---------- generations endpoint (JSON) ----------
      // gpt-image-2 returns b64_json by default and REJECTS the
      // response_format param (it was a gpt-image-1 / DALL·E param).
      // Omitting it.
      const body = {
        model: modelId,
        prompt: promptText,
        n: 1,
        size: size,
        quality: quality,
      };
      try {
        console.log(TAG, "openai generations body:", JSON.stringify(body));
      } catch (_) {}
      res = await fetch(OPENAI_HOST + "/v1/images/generations", {
        method: "POST",
        headers: Object.assign(
          { "Content-Type": "application/json" },
          openaiAuthHeaders(apiKey)
        ),
        body: JSON.stringify(body),
      });
    } else {
      // ---------- edits endpoint (multipart/form-data) ----------
      // First image = base (if present), then references. OpenAI accepts
      // multiple files via repeated "image[]" parts.
      if (typeof FormData === "undefined") {
        throw new Error("FormData not available in this UXP runtime — edits endpoint cannot be reached.");
      }
      const fd = new FormData();
      fd.append("model", modelId);
      fd.append("prompt", promptText);
      fd.append("n", "1");
      fd.append("size", size);
      fd.append("quality", quality);

      let attached = 0;
      if (hasSource) {
        const blob = base64ToBlob(opts.sourceImage.base64, opts.sourceImage.mime || "image/png");
        fd.append("image[]", blob, "base.png");
        attached++;
      }
      for (let i = 0; i < refs.length; i++) {
        const r = refs[i];
        if (!r || !r.base64) continue;
        fd.append("image[]", base64ToBlob(r.base64, r.mime || "image/png"), "ref-" + (i + 1) + ".png");
        attached++;
      }
      // v0.06 — selection-as-mask. When the caller passes opts.maskSpec
      // + opts.maskDoc (document dims), build an alpha PNG and send it as
      // the API "mask" param. GPT regenerates only the transparent
      // pixels and preserves the opaque pixels at the input's resolution.
      let maskAttached = false;
      if (opts.maskSpec && opts.maskDoc && opts.maskDoc.width && opts.maskDoc.height) {
        try {
          const maskBlob = await buildAlphaMaskBlob(
            Math.round(opts.maskDoc.width),
            Math.round(opts.maskDoc.height),
            opts.maskSpec
          );
          if (maskBlob) {
            fd.append("mask", maskBlob, "mask.png");
            maskAttached = true;
          }
        } catch (e) {
          try { console.warn(TAG, "mask build failed:", e); } catch (_) {}
        }
      }

      try {
        console.log(TAG, "openai edits multipart:",
          "model=" + modelId,
          "size=" + size,
          "quality=" + quality,
          "image[]_attached=" + attached,
          "mask_attached=" + maskAttached,
          "mask_kind=" + (opts.maskSpec && opts.maskSpec.kind || "(none)"),
          "prompt.len=" + (promptText || "").length);
      } catch (_) {}

      res = await fetch(OPENAI_HOST + "/v1/images/edits", {
        method: "POST",
        // Do NOT set Content-Type — FormData attaches the boundary.
        headers: openaiAuthHeaders(apiKey),
        body: fd,
      });
    }

    if (!res.ok) {
      const text = await safeText(res);
      const detail = shortErr(text);
      // GPT Image 2 is gated behind OpenAI org verification. Surface that
      // distinctly so the user doesn't chase it as a code bug — they need
      // to verify their org at platform.openai.com first.
      const blob = (text || "").toLowerCase();
      const looksLikeOrgGate =
        res.status === 401 || res.status === 403 ||
        blob.indexOf("verification") >= 0 ||
        blob.indexOf("not verified") >= 0 ||
        blob.indexOf("organization") >= 0 ||
        blob.indexOf("must be verified") >= 0;
      if (looksLikeOrgGate) {
        throw new Error("OpenAI " + res.status
          + ": Organization not verified for GPT Image. Complete API "
          + "Organization Verification at platform.openai.com → Settings → "
          + "Organization, then retry. — " + detail);
      }
      throw new Error("OpenAI " + res.status + ": " + detail);
    }
    const json = await res.json();
    const item = json && json.data && json.data[0];
    if (!item) throw new Error("OpenAI: empty response");

    try {
      console.log(TAG, "openai response:",
        "data.length=" + (json.data ? json.data.length : 0),
        "has_b64=" + !!item.b64_json,
        "has_url=" + !!item.url);
    } catch (_) {}

    if (item.b64_json) return { base64: item.b64_json, mime: "image/png" };
    if (item.url) {
      const ir = await fetch(item.url);
      if (!ir.ok) throw new Error("OpenAI image fetch failed: " + ir.status);
      const buf = await ir.arrayBuffer();
      return { base64: arrayBufferToBase64(buf), mime: "image/png" };
    }
    throw new Error("OpenAI: response has neither b64_json nor url");
  }

  // =======================================================================
  // FLUX.2 — fourth adapter (Black Forest Labs / BFL). v0.12.
  //
  // FIRST ASYNC generation adapter: submit → poll `polling_url` until
  // status "Ready" → `result.sample` is a TEMPORARY signed URL (delivery-*.bfl.ai,
  // ~10 min) → fetch bytes → base64. Auth header: `x-key`. FLUX.2 sizes via
  // width/height (NOT aspect_ratio) and has NO negative_prompt field — the
  // optional negative prompt is folded into the prompt text.
  //
  // ⚠️ VERIFY exact shapes against live docs before spending (printed in the
  // build report). Endpoints:
  //   POST https://api.bfl.ai/v1/flux-2-pro   (and /v1/flux-2-max)
  //     headers { x-key, Content-Type: application/json }
  //     body { prompt, width, height, seed?, output_format:"png",
  //            safety_tolerance:0–5 (editable, default 5), input_image?, input_image_2..8? }
  //     → { id, polling_url, cost, output_mp }
  //   GET <polling_url> (x-key) → { status:"Pending"|"Ready"|"Error", result:{ sample } }
  // =======================================================================
  const BFL_HOST       = "https://api.bfl.ai";
  const BFL_POLL_MS    = 1500;
  const BFL_TIMEOUT_MS = 180000;
  const BFL_MAX_MP     = 4 * 1024 * 1024;   // FLUX.2 caps ~4MP output

  function bflAuthHeaders(apiKey) {
    return { "x-key": apiKey, "Content-Type": "application/json", "Accept": "application/json" };
  }
  // No free verify endpoint exists (a real submit costs money), so the Test
  // button only confirms the key is stored. Live confirm = first generate.
  async function testConnectionFlux(apiKey) {
    if (!apiKey) return { ok: false, message: "empty key" };
    return { ok: true, message: "saved — generate to verify (no free test endpoint)" };
  }

  // Map the neutral request (resolution + aspect) → explicit width/height
  // (multiples of 16), capped to ~4MP. FLUX.2 has no aspect_ratio param.
  function fluxDimsFromOpts(opts) {
    const res = opts.imageSize || "1K";
    const longEdge = (res === "2K" || res === "4K") ? 1536 : 1024;
    let ar = 1;   // width / height
    const aspect = opts.aspectRatio;
    if (aspect && aspect !== MATCH_INPUT && aspect !== FIT_CANVAS) {
      const p = parseAspectLabel(aspect);
      if (p && p.v) ar = p.v;
    } else if (opts.sourceWidth && opts.sourceHeight) {
      ar = opts.sourceWidth / opts.sourceHeight;   // Match Input / Fit Canvas
    }
    let w, h;
    if (ar >= 1) { w = longEdge; h = Math.round(longEdge / ar); }
    else         { h = longEdge; w = Math.round(longEdge * ar); }
    const round16 = function (n) { return Math.max(64, Math.round(n / 16) * 16); };
    w = round16(w); h = round16(h);
    if (w * h > BFL_MAX_MP) {
      const s = Math.sqrt(BFL_MAX_MP / (w * h));
      w = round16(w * s); h = round16(h * s);
    }
    return { width: w, height: h };
  }

  async function generateImageFlux(apiKey, opts) {
    if (!apiKey) throw new Error("Missing Black Forest Labs API key.");
    if (!opts || !opts.prompt || !opts.prompt.trim()) throw new Error("Prompt is required.");
    const modelId = opts.modelId || "flux-2-pro";
    const model = MODELS[modelId] || MODELS["flux-2-pro"];
    const path = (model && model.bflPath) || "/v1/flux-2-pro";

    // FLUX.2 has no negative_prompt field — there is no negative prompt for Flux.
    const dims = fluxDimsFromOpts(opts);
    // safety_tolerance: 0 (strict) .. 5 (most permissive). FLUX.2 range is 0–5
    // (NOT 0–6; 6 was FLUX.1). Editable in Settings (cachedFluxSafety, default 5).
    // Docs state max 5 on the image-input/edit path too (no documented cap), but
    // FLUX.1 capped the image path at 2 — if a live edit call rejects the chosen
    // value, lower it in Settings (it's adjustable).
    const body = {
      prompt: opts.prompt.trim(),
      width: dims.width,
      height: dims.height,
      output_format: "png",
      safety_tolerance: clampFluxSafety(cachedFluxSafety),
    };
    if (opts.seed != null && isFinite(Number(opts.seed))) body.seed = Number(opts.seed);
    // source (edit) + references → input_image, input_image_2..8 (base64).
    const imgs = [];
    if (opts.sourceImage && opts.sourceImage.base64) imgs.push(opts.sourceImage.base64);
    const refs = opts.refImages || [];
    for (let i = 0; i < refs.length; i++) if (refs[i] && refs[i].base64) imgs.push(refs[i].base64);
    for (let i = 0; i < imgs.length && i < 8; i++) {
      body[i === 0 ? "input_image" : ("input_image_" + (i + 1))] = imgs[i];
    }

    try { console.log(TAG, "flux submit:", "model=" + modelId, "path=" + path,
      dims.width + "x" + dims.height, "imgs=" + imgs.length); } catch (_) {}

    const submitRes = await fetch(BFL_HOST + path, {
      method: "POST", headers: bflAuthHeaders(apiKey), body: JSON.stringify(body),
    });
    if (!submitRes.ok) {
      const t = await safeText(submitRes);
      throw new Error("Flux submit " + submitRes.status + ": " + shortErr(t));
    }
    const submit = await submitRes.json();
    const pollUrl = submit && submit.polling_url;
    if (!pollUrl) throw new Error("Flux: no polling_url in submit response.");
    try { if (submit.cost != null) console.log(TAG, "flux reported cost:", submit.cost, "output_mp:", submit.output_mp); } catch (_) {}

    // Poll the returned polling_url verbatim until Ready (region may differ).
    const t0 = Date.now();
    let sampleUrl = null;
    while (Date.now() - t0 < BFL_TIMEOUT_MS) {
      await new Promise(function (r) { setTimeout(r, BFL_POLL_MS); });
      let stRes;
      try { stRes = await fetch(pollUrl, { method: "GET", headers: bflAuthHeaders(apiKey) }); }
      catch (e) { continue; }
      if (!stRes.ok) continue;
      let st; try { st = await stRes.json(); } catch (_) { continue; }
      const status = (st && st.status) || "";
      if (status === "Ready") { sampleUrl = st.result && st.result.sample; break; }
      if (status === "Error" || status === "Failed" || /moder/i.test(status)) {
        throw new Error("Flux: " + status + (st.result ? (" — " + JSON.stringify(st.result)) : ""));
      }
      // "Pending" / "Queued" / "Task not found" (briefly) → keep polling.
    }
    if (!sampleUrl) throw new Error("Flux: timed out waiting for result.");

    // Fetch the temporary signed result image (delivery-*.bfl.ai) → base64.
    const imgRes = await fetch(sampleUrl, { method: "GET" });
    if (!imgRes.ok) throw new Error("Flux: result fetch failed (" + imgRes.status + ").");
    const buf = await imgRes.arrayBuffer();
    return { base64: bytesToBase64(buf), mime: "image/png" };
  }

  // =======================================================================
  // FAL LANE — fifth adapter (fal.ai AGGREGATOR). v0.14. ASYNC QUEUE.
  //
  // DELIBERATE, ISOLATED aggregator exception — the only path to Qwen / Seedream
  // / Flux-dev + LoRA + a controllable safety checker (BFL's hosted pro/max
  // moderate intimates and expose no LoRA). Every Fal generation is tagged
  // routedVia:"fal" in the session log; cost is Fal's BILLED amount (aggregator
  // MARKUP), surfaced as such in the UI — NOT a clean first-party per-run cost.
  //
  // ⚠️ VERIFY shapes (printed in the build report). Auth: `Authorization: Key <FAL_KEY>`.
  //   POST https://queue.fal.run/{falPath} → { request_id, status_url, response_url }
  //   GET  <status_url>   → { status: IN_QUEUE | IN_PROGRESS | COMPLETED }
  //   GET  <response_url> → { images:[{ url, width, height, content_type }], ... }
  //   result URL on v3.fal.media (temporary — fetch immediately). No cost in response.
  // Per-model body: flux-lora { prompt, image_size{w,h}, num_inference_steps:28,
  //   guidance_scale:3.5, num_images:1, output_format:"png", enable_safety_checker,
  //   loras:[{path,scale}] (omit when empty → plain dev) }; qwen { + enable_safety_checker,
  //   negative_prompt }; seedream v4 { prompt, image_size, num_images, enable_safety_checker }.
  // =======================================================================
  const FAL_QUEUE_HOST = "https://queue.fal.run";
  const FAL_POLL_MS    = 1500;
  const FAL_TIMEOUT_MS = 240000;
  function falAuthHeaders(apiKey) {
    return { "Authorization": "Key " + apiKey, "Content-Type": "application/json", "Accept": "application/json" };
  }
  async function testConnectionFal(apiKey) {
    if (!apiKey) return { ok: false, message: "empty key" };
    return { ok: true, message: "saved — generate to verify (no free test endpoint)" };
  }
  // Resolution+aspect → {width,height} (reuses the Flux mapper; Seedream caps 4096).
  function falDimsFromOpts(opts) {
    const d = fluxDimsFromOpts(opts);
    return { width: Math.min(d.width, 4096), height: Math.min(d.height, 4096) };
  }
  function falBuildBody(model, opts) {
    const dims = falDimsFromOpts(opts);
    const body = {
      prompt: opts.prompt.trim(),
      image_size: { width: dims.width, height: dims.height },
      num_images: 1,
      output_format: "png",
    };
    if (opts.seed != null && isFinite(Number(opts.seed))) body.seed = Number(opts.seed);
    if (model.falSafetyToggle) body.enable_safety_checker = !!cachedFalSafetyChecker;

    if (model.falEdit) {
      // EDIT model (fal-ai/flux-2/lora/edit), image_urls = the images to edit.
      // The EDIT BASE is what the user LOADED: if Reference Images are present,
      // THOSE are the input (base = the first ref) — the user's redress workflow.
      // Only if no refs are loaded do we fall back to the canvas composite.
      // Fal decodes data: URIs server-side, BUT a malformed one (whitespace /
      // newlines in the base64) is silently ignored → so we strip whitespace, and
      // cap at 3 (Fal uses only the first 3).
      const clean = function (b64) { return String(b64 || "").replace(/\s+/g, ""); };
      const toUri = function (mime, b64) { return "data:" + (mime || "image/png") + ";base64," + clean(b64); };
      const urls = [];
      const refs = opts.refImages || [];
      if (refs.length) {
        for (let i = 0; i < refs.length; i++) {
          if (refs[i] && refs[i].base64) urls.push(toUri(refs[i].mime, refs[i].base64));
        }
      } else if (opts.sourceImage && opts.sourceImage.base64) {
        urls.push(toUri(opts.sourceImage.mime, opts.sourceImage.base64));
      }
      body.image_urls = urls.slice(0, 3);   // Fal edit caps at 3 images
      body.num_inference_steps = 28;
      body.guidance_scale = 2.5;
      // Generate at the CANVAS's NATIVE resolution (actual doc dims), clamped to
      // ~4MP, 16-aligned, max edge 4096 — NOT the 1K/2K long-edge from
      // fluxDimsFromOpts. So the edit renders at canvas res instead of being
      // upscaled to fill on placement. Falls back to the computed dims if no doc.
      const docW = Math.round(Number(opts.sourceWidth)  || 0);
      const docH = Math.round(Number(opts.sourceHeight) || 0);
      if (docW > 0 && docH > 0) {
        let ew = docW, eh = docH;
        const MAXMP = 4 * 1024 * 1024;
        if (ew * eh > MAXMP) { const s = Math.sqrt(MAXMP / (ew * eh)); ew = ew * s; eh = eh * s; }
        const r16 = function (n) { return Math.max(64, Math.min(4096, Math.round(n / 16) * 16)); };
        body.image_size = { width: r16(ew), height: r16(eh) };
      }
    } else if (model.falPath === "fal-ai/flux-lora") {
      body.num_inference_steps = 28;
      body.guidance_scale = 3.5;
    }
    // qwen/seedream: defaults are fine.

    // LoRA slot — for any model that exposes it (both flux-dev models). Read the
    // URL/scale DIRECTLY from the fields at submit time (not the change-event
    // cache) so a pasted link always applies. URL present → include; blank → omit.
    if (model.falLora) {
      const urlEl   = $("fal-lora-url");
      const scaleEl = $("fal-lora-scale");
      const loraUrl = ((urlEl && urlEl.value) || cachedFalLoraUrl || "").trim();
      if (loraUrl) {
        const rawScale = (scaleEl && scaleEl.value != null && scaleEl.value !== "") ? scaleEl.value : cachedFalLoraScale;
        const scale = isFinite(Number(rawScale)) ? Number(rawScale) : 1;
        body.loras = [{ path: loraUrl, scale: scale }];
        try { console.log(TAG, "fal LoRA applied:", loraUrl.slice(0, 80), "scale=" + scale); } catch (_) {}
      }
    }
    return body;
  }
  async function generateImageFal(apiKey, opts) {
    if (!apiKey) throw new Error("Missing Fal API key.");
    if (!opts || !opts.prompt || !opts.prompt.trim()) throw new Error("Prompt is required.");
    const modelId = opts.modelId || "fal-flux-dev";
    const model = MODELS[modelId] || MODELS["fal-flux-dev"];
    const path  = (model && model.falPath) || "fal-ai/flux-lora";
    const body  = falBuildBody(model, opts);
    if (model.falEdit && (!body.image_urls || !body.image_urls.length)) {
      throw new Error("Edit model needs a source image — open a document to redress.");
    }

    // Exact request body, image data TRUNCATED — shows whether image_urls is
    // present + populated, each entry's format (data: vs http), length, and a
    // whitespace flag (a malformed data URI = silently ignored by Fal).
    try {
      const dbg = Object.assign({}, body);
      if (dbg.image_urls) dbg.image_urls = dbg.image_urls.map(function (u) {
        return (typeof u === "string")
          ? (u.slice(0, 44) + "…[len=" + u.length + (/\s/.test(u) ? ", HAS-WHITESPACE!" : "") + "]")
          : "(non-string)";
      });
      if (dbg.loras) dbg.loras = dbg.loras.map(function (l) { return { path: String(l.path).slice(0, 60) + "…", scale: l.scale }; });
      console.log(TAG, "fal request body →", path, JSON.stringify(dbg));
    } catch (_) {}

    const submitRes = await fetch(FAL_QUEUE_HOST + "/" + path, {
      method: "POST", headers: falAuthHeaders(apiKey), body: JSON.stringify(body),
    });
    if (!submitRes.ok) {
      const t = await safeText(submitRes);
      throw new Error("Fal submit " + submitRes.status + ": " + shortErr(t));
    }
    const submit = await submitRes.json();
    const statusUrl   = submit.status_url;
    const responseUrl = submit.response_url;
    if (!statusUrl || !responseUrl) throw new Error("Fal: no status_url/response_url in submit response.");

    // Poll status until COMPLETED (IN_QUEUE / IN_PROGRESS → keep polling).
    const t0 = Date.now();
    let done = false;
    while (Date.now() - t0 < FAL_TIMEOUT_MS) {
      await new Promise(function (r) { setTimeout(r, FAL_POLL_MS); });
      let stRes;
      try { stRes = await fetch(statusUrl, { method: "GET", headers: falAuthHeaders(apiKey) }); }
      catch (e) { continue; }
      if (!stRes.ok) continue;
      let st; try { st = await stRes.json(); } catch (_) { continue; }
      if (((st && st.status) || "") === "COMPLETED") { done = true; break; }
    }
    if (!done) throw new Error("Fal: timed out waiting for result.");

    const resRes = await fetch(responseUrl, { method: "GET", headers: falAuthHeaders(apiKey) });
    if (!resRes.ok) {
      const t = await safeText(resRes);
      throw new Error("Fal result " + resRes.status + ": " + shortErr(t));
    }
    const result = await resRes.json();
    const img = result.images && result.images[0];
    const url = img && img.url;
    if (!url) throw new Error("Fal: no images[0].url in result (" + shortErr(JSON.stringify(result)) + ").");
    try { console.log(TAG, "fal result:", String(url).slice(0, 80), "nsfw=" + JSON.stringify(result.has_nsfw_concepts)); } catch (_) {}

    // Fetch the temporary result image (v3.fal.media; public, fetch now) → base64.
    const imgRes = await fetch(url, { method: "GET" });
    if (!imgRes.ok) throw new Error("Fal: result image fetch failed (" + imgRes.status + ").");
    const buf = await imgRes.arrayBuffer();
    const mime = detectImageMime(buf) || "image/png";
    return { base64: bytesToBase64(buf), mime: mime };
  }

  // =======================================================================
  // CLARITY CRYSTAL (ClarityAI) — second upscaler adapter. v0.12. DIRECT.
  // CONFIRMED end-to-end against a live call (synchronous):
  //   POST https://api-upscale.clarityai.co
  //   headers { Authorization: Bearer ap_…, Content-Type: application/json }
  //   body { mode:"crystal", image:"<data: URI>", scale_factor, creativity, output_format:"png" }
  //   → 200 { status, message:"<result image URL>", balance, credit_cost, cost_usd, logs }
  // - IMAGE TRANSPORT: a **data: URI** (`data:image/png;base64,…`) of the source
  //   pixels — CONFIRMED ACCEPTED (do not change). No public host needed.
  // - RESULT: `message` IS the final image URL (Cloudflare R2 `r2-us.clarityai.co`,
  //   covered by *.clarityai.co). Synchronous — `logs` holds the prediction text,
  //   not the URL. No webhooks, no job-poll.
  // - COST: the RETURNED `cost_usd` (= credit_cost × $0.01); `balance` is remaining.
  // =======================================================================
  const CLARITY_HOST = "https://api-upscale.clarityai.co";
  function clarityAuthHeaders(apiKey) {
    return { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json", "Accept": "application/json" };
  }
  async function testConnectionClarity(apiKey) {
    if (!apiKey) return { ok: false, message: "empty key" };
    // No documented free verify endpoint — confirm on first upscale.
    return { ok: true, message: "saved — upscale to verify" };
  }
  // Returns { bytes, mime, width, height, costUsd } to match the Topaz shape so
  // placeUpscaleResultAsLayer works unchanged.
  async function upscaleViaClarity(apiKey, sourceImage, opts) {
    if (!apiKey) throw new Error("Missing ClarityAI API key.");
    if (!sourceImage || !sourceImage.base64) throw new Error("No source pixels for Clarity upscale.");
    const factor = (opts && opts.factor === 4) ? 4 : 2;
    const creativity = (opts && isFinite(Number(opts.creativity))) ? Number(opts.creativity) : 0;
    const dataUri = "data:" + (sourceImage.mime || "image/png") + ";base64," + sourceImage.base64;
    const body = {
      mode: "crystal",
      image: dataUri,                 // ⚠️ data URI — see header note
      scale_factor: factor,
      creativity: creativity,
      output_format: "png",
    };
    if (opts && typeof opts.onStatus === "function") opts.onStatus("submitting to Clarity…");
    const res = await fetch(CLARITY_HOST, {
      method: "POST", headers: clarityAuthHeaders(apiKey), body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await safeText(res);
      throw new Error("Clarity " + res.status + ": " + shortErr(t));
    }
    const j = await res.json();
    try { console.log(TAG, "clarity response:", JSON.stringify(j)); } catch (_) {}

    // CONFIRMED live shape (SYNC):
    //   { status:200, message:"<result image URL>", balance, credit_cost, cost_usd, logs }
    // The result is a CLOUDFLARE-R2 URL in `message` (r2-us.clarityai.co, covered by
    // the *.clarityai.co manifest entry). It's the final ready image (the prediction
    // log text lives separately in `logs`, NOT in `message`) — so this is synchronous.
    let url = (typeof j.message === "string" && /^https?:\/\//i.test(j.message)) ? j.message : null;
    if (!url) {   // defensive only — `message` has been the URL every time
      const m = JSON.stringify(j).match(/https?:\/\/[^\s"'<>]+\.(?:png|jpe?g|webp)/i);
      if (m) url = m[0];
    }
    if (!url) throw new Error("Clarity: no result URL in `message` — raw logged. Body: " + shortErr(JSON.stringify(j)));

    // Cost: `cost_usd` is present (= credit_cost × $0.01). `balance` is the REMAINING
    // balance (not the charge) — never use it for cost.
    const costUsd = (j.cost_usd != null) ? Number(j.cost_usd)
                  : (j.credit_cost != null) ? Number(j.credit_cost) * 0.01 : 0;
    try { console.log(TAG, "clarity: url=" + url + " cost_usd=" + costUsd + " credit_cost=" + j.credit_cost + " balance=" + j.balance); } catch (_) {}

    // SYNC fetch of the ready R2 URL, with a few light retries for transient R2
    // propagation latency (NOT an async job-poll — `message` is already the result).
    if (opts && typeof opts.onStatus === "function") opts.onStatus("fetching upscaled image…");
    let buf = null, lastStatus = 0;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt > 0) await new Promise(function (r) { setTimeout(r, 1500); });
      let imgRes;
      try { imgRes = await fetch(url, { method: "GET" }); } catch (e) { continue; }
      lastStatus = imgRes.status;
      if (imgRes.ok) {
        const b = await imgRes.arrayBuffer();
        if (b && b.byteLength > 0 && detectImageMime(b)) { buf = b; break; }
      }
    }
    if (!buf) throw new Error("Clarity: result fetch failed (last status " + lastStatus + ").");
    const mime = detectImageMime(buf) || "image/png";
    const dims = decodeImageDimsFromBytes(buf) || { w: 0, h: 0 };
    return { bytes: buf, mime: mime, width: dims.w, height: dims.h, costUsd: costUsd };
  }

  // =======================================================================
  // TOPAZ — third adapter (FINISHING, not generation)
  //
  // Topaz Image API. Live docs (developer.topazlabs.com, verified
  // 2026-05-30) describe an ASYNC workflow only — no synchronous endpoint
  // exists. Three calls per job:
  //   POST {base}/enhance/async    → { process_id }
  //   GET  {base}/status/{id}      → { status: "Completed"|"Failed"|"Cancelled"|... }
  //   GET  {base}/download/{id}    → { url: "<signed CDN url>" }
  // Polling cadence: 2000ms per the docs' own sample code.
  // Auth header: X-API-KEY (NOT Authorization: Bearer).
  //
  // Topaz bills by OUTPUT megapixels — note for the cost meter (v0.08).
  // =======================================================================
  const TOPAZ_HOST       = "https://api.topazlabs.com";
  const TOPAZ_BASE       = TOPAZ_HOST + "/image/v1";
  const TOPAZ_POLL_MS    = 2000;
  const TOPAZ_TIMEOUT_MS = 180000;
  const TOPAZ_DEFAULT_MODEL = "Standard V2";

  function topazAuthHeaders(apiKey) {
    return { "X-API-KEY": apiKey, "Accept": "application/json" };
  }

  async function testConnectionTopaz(apiKey) {
    if (!apiKey) return { ok: false, message: "no key" };
    try {
      // No auth-only endpoint exists. Hit /status with a bogus id — a
      // valid key returns 404 (process not found); a bad key returns
      // 401/403. Either resolves the key state without consuming credit.
      const res = await fetch(TOPAZ_BASE + "/status/kbanana-test", {
        method: "GET",
        headers: topazAuthHeaders(apiKey),
      });
      if (res.status === 401 || res.status === 403) {
        return { ok: false, message: "unauthorized — check key" };
      }
      return { ok: true, message: "connected" };
    } catch (e) {
      return { ok: false, message: (e && e.message) || String(e) };
    }
  }

  // Run an upscale through Topaz. Reads pixel bytes from the caller,
  // returns enhanced bytes ready for placeBase64AsLayer.
  //
  // sourceImage: { base64, mime, width, height } from a read helper.
  // opts.factor:   2 | 4  — multiplier on source dims (default 2).
  // opts.onStatus: optional progress callback (string → UI).
  //
  // Topaz controls upscale via output_width / output_height integers
  // (1..32000). There is NO scale param — if you send neither, you
  // get 1:1 output (confirmed empirically). We multiply source dims
  // by the factor and clamp at 32000.
  async function upscaleViaTopaz(apiKey, sourceImage, opts) {
    if (!apiKey) throw new Error("Missing Topaz API key");
    if (!sourceImage || !sourceImage.base64) throw new Error("No source image to upscale");
    opts = opts || {};
    const model        = opts.model         || TOPAZ_DEFAULT_MODEL;
    const outputFormat = opts.output_format || "png";
    const factor       = (opts.factor === 4) ? 4 : 2;
    const onStatus     = opts.onStatus      || function () {};

    // ---- compute target dims ----
    const srcW = Number(sourceImage.width)  || 0;
    const srcH = Number(sourceImage.height) || 0;
    if (!(srcW > 0 && srcH > 0)) {
      throw new Error("Source dimensions unknown — cannot compute upscale target.");
    }
    const TOPAZ_MAX_DIM = 32000;
    let targetW = Math.round(srcW * factor);
    let targetH = Math.round(srcH * factor);
    if (targetW > TOPAZ_MAX_DIM || targetH > TOPAZ_MAX_DIM) {
      const cap = Math.min(TOPAZ_MAX_DIM / targetW, TOPAZ_MAX_DIM / targetH);
      targetW = Math.round(targetW * cap);
      targetH = Math.round(targetH * cap);
      try {
        console.warn(TAG, "topaz: capped target to " + targetW + "x" + targetH
          + " (Topaz max " + TOPAZ_MAX_DIM + "px/dim)");
      } catch (_) {}
    }
    try {
      console.log(TAG, "topaz request: model=" + model
        + " src=" + srcW + "x" + srcH
        + " factor=" + factor + "x"
        + " target=" + targetW + "x" + targetH
        + " output_format=" + outputFormat);
    } catch (_) {}

    // ---- submit (multipart) ----
    const form = new FormData();
    form.append("model", model);
    form.append("output_format", outputFormat);
    // The upscale instruction. Without these, Topaz returns input
    // dimensions back (1.0x round-trip).
    form.append("output_width",  String(targetW));
    form.append("output_height", String(targetH));

    const srcBuf  = base64ToArrayBuffer(sourceImage.base64);
    const srcMime = sourceImage.mime || "image/png";
    const srcBlob = new Blob([srcBuf], { type: srcMime });
    form.append("image", srcBlob, "source.png");

    onStatus("submitting…");
    const submitRes = await fetch(TOPAZ_BASE + "/enhance/async", {
      method: "POST",
      headers: topazAuthHeaders(apiKey),
      body: form,
    });
    logTopazResponse("submit", submitRes);
    if (!submitRes.ok) {
      const t = await safeText(submitRes);
      throw new Error("Topaz submit failed: " + submitRes.status + " " + shortErr(t));
    }
    // The submit may return a body that is JSON or (rarely) text — try
    // text first so we can log it raw, then parse.
    const submitText = await safeText(submitRes);
    try { console.log(TAG, "topaz submit raw body:", submitText.slice(0, 500)); } catch (_) {}
    let submitJson = null;
    try { submitJson = JSON.parse(submitText); } catch (_) {}
    const processId = submitJson && (submitJson.process_id || submitJson.processId
                                    || submitJson.id || submitJson.job_id);
    if (!processId) throw new Error("Topaz: no process_id in submit response — got: "
      + submitText.slice(0, 200));
    try { console.log(TAG, "topaz process_id:", processId); } catch (_) {}

    // ---- poll status ----
    const startedAt = Date.now();
    let status = "";
    let polls = 0;
    let lastStatusJson = null;
    while (true) {
      if (Date.now() - startedAt > TOPAZ_TIMEOUT_MS) {
        throw new Error("Topaz: timed out after " + Math.round(TOPAZ_TIMEOUT_MS / 1000) + "s");
      }
      await new Promise(function (r) { setTimeout(r, TOPAZ_POLL_MS); });
      polls++;
      const stRes = await fetch(TOPAZ_BASE + "/status/" + encodeURIComponent(processId), {
        headers: topazAuthHeaders(apiKey),
      });
      if (!stRes.ok) {
        const t = await safeText(stRes);
        throw new Error("Topaz status failed: " + stRes.status + " " + shortErr(t));
      }
      const stText = await safeText(stRes);
      let stJson = null;
      try { stJson = JSON.parse(stText); } catch (_) {}
      lastStatusJson = stJson;
      status = (stJson && (stJson.status || stJson.Status || stJson.state)) || "";
      // Log every status poll so we see the actual cadence + body.
      try {
        console.log(TAG, "topaz status poll #" + polls
          + " (" + (polls * (TOPAZ_POLL_MS / 1000)) + "s): "
          + stText.slice(0, 300));
      } catch (_) {}
      onStatus("processing… (" + status + ", " + (polls * (TOPAZ_POLL_MS / 1000)) + "s)");
      if (status === "Completed") break;
      if (status === "Failed" || status === "Cancelled" || status === "Error") {
        throw new Error("Topaz job ended: " + status
          + (stJson && stJson.message ? " — " + stJson.message : ""));
      }
    }

    // ---- download ----
    onStatus("downloading…");
    const dlRes = await fetch(TOPAZ_BASE + "/download/" + encodeURIComponent(processId), {
      headers: topazAuthHeaders(apiKey),
    });
    logTopazResponse("download", dlRes);
    if (!dlRes.ok) {
      const t = await safeText(dlRes);
      throw new Error("Topaz download failed: " + dlRes.status + " " + shortErr(t));
    }

    // The docs (developer.topazlabs.com, re-verified 2026-05-30) say:
    //   { "download_url": "<presigned url, expires in 1h>",
    //     "head_url":     "<presigned head url>",
    //     "expiry":       <unix epoch> }
    // But: some hosts in the past returned raw binary on /download.
    // So we branch on Content-Type and only fall back to JSON parsing
    // when the body is text.
    const dlCt  = (dlRes.headers && dlRes.headers.get && dlRes.headers.get("content-type")) || "";
    try {
      console.log(TAG, "topaz download response: status=" + dlRes.status
        + " content-type=" + dlCt);
    } catch (_) {}

    // Path A — binary image in the response body. Place directly, no
    // CDN hop needed.
    //
    // NOTE: returning the raw ArrayBuffer (NOT base64). For 4x upscale
    // of a 2K image the PNG can be ~100MB; building a ~130MB base64
    // string and then atob-ing it back in the placement helper blew
    // past UXP's per-allocation limit and threw "Invalid array length."
    // The placement path writes the buffer straight to disk.
    if (/^image\//i.test(dlCt)) {
      const buf = await dlRes.arrayBuffer();
      const mime = detectImageMime(buf) || dlCt.split(";")[0].trim() || "image/png";
      const dims = decodeImageDimsFromBytes(buf) || { w: 0, h: 0 };
      try { console.log(TAG, "topaz download: binary image, bytes=" + buf.byteLength
        + ", mime=" + mime + ", dims=" + dims.w + "x" + dims.h); } catch (_) {}
      return { bytes: buf, mime: mime, width: dims.w, height: dims.h };
    }

    // Path B — JSON envelope with a presigned URL. Live docs say
    // `download_url`; older mirrors document `url`. Accept both,
    // plus a few common variants, and log the actual body if none match.
    const dlText = await safeText(dlRes);
    try { console.log(TAG, "topaz download raw body:", dlText.slice(0, 500)); } catch (_) {}
    let dlJson = null;
    try { dlJson = JSON.parse(dlText); } catch (_) {}
    const fileUrl = dlJson && (
        dlJson.download_url        // ← actual current field (docs verified)
     || dlJson.downloadUrl
     || dlJson.url                 // ← what older mirrors claimed
     || dlJson.URL
     || dlJson.output_url
     || dlJson.signed_url
     || dlJson.presigned_url
    );
    if (!fileUrl) {
      const keys = dlJson ? Object.keys(dlJson).join(",") : "(non-json)";
      throw new Error("Topaz: no download URL found in response (keys: " + keys + ")");
    }
    try { console.log(TAG, "topaz download_url host:", String(fileUrl).split("/")[2] || "(?)"); } catch (_) {}

    // Topaz stores results on Cloudflare R2 — presigned URLs of the
    // form  https://<bucket>.<account-hash>.r2.cloudflarestorage.com/output/<id>.png
    // with an X-Amz-Expires query param. Manifest whitelists
    // *.r2.cloudflarestorage.com (and amazonaws / cloudfront as
    // defense in depth in case Topaz switches CDN). The presign
    // expires fast (hour-ish) — we fetch immediately, no caching.
    const imgRes = await fetch(fileUrl);
    if (!imgRes.ok) throw new Error("Topaz CDN fetch failed: " + imgRes.status + " (" + fileUrl + ")");
    const buf  = await imgRes.arrayBuffer();
    const mime = detectImageMime(buf);
    const dims = decodeImageDimsFromBytes(buf) || { w: 0, h: 0 };
    try { console.log(TAG, "topaz CDN fetched: bytes=" + buf.byteLength
      + ", mime=" + mime + ", dims=" + dims.w + "x" + dims.h); } catch (_) {}
    // Return the raw ArrayBuffer + decoded header dims. Avoiding the
    // ArrayBuffer → base64 → ArrayBuffer roundtrip is critical for the
    // 4x path — see Path A note above.
    return { bytes: buf, mime: mime, width: dims.w, height: dims.h };
  }

  // Log the response shape (status, content-type, content-length) — used
  // any time we touch Topaz so a future failure shows what's actually on
  // the wire instead of a generic "no field found" error.
  function logTopazResponse(label, res) {
    try {
      const ct = (res.headers && res.headers.get && res.headers.get("content-type")) || "";
      const cl = (res.headers && res.headers.get && res.headers.get("content-length")) || "";
      console.log(TAG, "topaz " + label + " response:",
        "status=" + res.status, "content-type=" + ct, "content-length=" + cl);
    } catch (_) {}
  }

  // ----- layer bridge -----
  function base64ToArrayBuffer(b64) {
    const clean = b64.replace(/\s+/g, "");
    if (typeof atob === "function") {
      const bin = atob(clean);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out.buffer;
    }
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const lookup = new Uint8Array(256);
    for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
    const padded = clean.replace(/=+$/, "");
    const bytes = new Uint8Array(Math.floor((padded.length * 3) / 4));
    let p = 0;
    for (let i = 0; i < padded.length; i += 4) {
      const a = lookup[padded.charCodeAt(i)];
      const b = lookup[padded.charCodeAt(i + 1)];
      const c = lookup[padded.charCodeAt(i + 2)];
      const d = lookup[padded.charCodeAt(i + 3)];
      bytes[p++] = (a << 2) | (b >> 4);
      if (!isNaN(c)) bytes[p++] = ((b & 15) << 4) | (c >> 2);
      if (!isNaN(d)) bytes[p++] = ((c & 3) << 6) | d;
    }
    return bytes.buffer;
  }
  // FOUNDATION — the path of the most recent result PNG a place function
  // wrote to disk. The session log references THIS (a path string) as the
  // afterSnapshotRef, so the log stays lightweight (no inline image bytes)
  // and we add zero extra disk writes — we reuse the file the op already
  // wrote. Captured immediately after the write; read by executeGenerate.
  let lastPlacedFileRef = null;

  async function placeBase64AsLayer(base64, layerName) {
    const ps = psMod();
    if (!ps.app.activeDocument) throw new Error("Open a Photoshop document first.");
    const folder = await fsLocal().getDataFolder();
    const file = await folder.createFile("kbanana-" + Date.now() + ".png", { overwrite: true });
    await file.write(base64ToArrayBuffer(base64), { format: fmts().binary });
    try { lastPlacedFileRef = file.nativePath; } catch (_) {}
    const token = await fsLocal().createSessionToken(file);

    let layerID = null;
    await ps.core.executeAsModal(async function () {
      await ps.action.batchPlay(
        [{
          _obj: "placeEvent",
          target: { _path: token },
          freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" },
          offset: { _obj: "offset", horizontal: { _unit: "pixelsUnit", _value: 0 }, vertical: { _unit: "pixelsUnit", _value: 0 } },
          _options: { dialogOptions: "dontDisplay" },
        }],
        { synchronousExecution: true }
      );
      if (layerName) {
        try { await renameActiveLayer(layerName); } catch (_) {}
      }
      try {
        const doc = ps.app.activeDocument;
        const layer = doc && doc.activeLayers && doc.activeLayers[0];
        if (layer && typeof layer.id !== "undefined") layerID = layer.id;
      } catch (_) {}
    }, { commandName: "KBImage — place generated image" });
    return layerID;
  }

  // v0.07.2 — Topaz-specific placement. Topaz returns a LARGER image than
  // the source — that's the point of upscale. We must:
  //   1. Place the image at its NATIVE upscaled dimensions, NOT shrunk to
  //      fit canvas. If the user has Photoshop's "Resize Image During
  //      Place" preference ON, placeEvent will shrink the image — we
  //      reverse that with a scale transform back to native size.
  //   2. Allow the layer to exceed canvas bounds — Photoshop supports
  //      this natively; the user can crop or resize canvas to expose
  //      the full pixels. We do NOT clip or mask.
  //   3. Center on the canvas (placeEvent's default behavior — kept).
  //   4. Rasterize so the result is a normal pixel layer (the session
  //      token can otherwise break once modal exits — same reason the
  //      edit pipeline rasterizes).
  //
  // Returns { layerID, nativeW, nativeH, sourceW, sourceH, factor }.
  //
  // ARGS: arrayBuffer (raw bytes — NOT base64), mime, layerName.
  // The base64 round-trip used to live here; for a 4x upscale of 2K
  // that's a ~130MB string allocation in UXP's JS engine which threw
  // "Invalid array length." We now write the bytes straight to disk
  // and let Photoshop's placeEvent decode them natively.
  async function placeUpscaleResultAsLayer(arrayBuffer, mime, layerName) {
    const ps = psMod();
    if (!ps.app.activeDocument) throw new Error("Open a Photoshop document first.");
    if (!arrayBuffer || !arrayBuffer.byteLength) {
      throw new Error("placeUpscaleResultAsLayer: no bytes (buffer empty)");
    }

    // Decode native dimensions from the byte header (24 bytes for PNG,
    // walked for JPEG) — never bigger than 4KB read regardless of source.
    const nativeDims = decodeImageDimsFromBytes(arrayBuffer) || { w: 0, h: 0 };
    try {
      console.log(TAG, "topaz placement: bytes=" + arrayBuffer.byteLength
        + ", mime=" + mime
        + ", native=" + nativeDims.w + "x" + nativeDims.h);
    } catch (_) {}

    const ext = (mime === "image/jpeg") ? "jpg" : "png";
    const folder = await fsLocal().getDataFolder();
    const file = await folder.createFile("kbanana-upscale-" + Date.now() + "." + ext, { overwrite: true });
    await file.write(arrayBuffer, { format: fmts().binary });
    try { lastPlacedFileRef = file.nativePath; } catch (_) {}   // session-log afterSnapshotRef
    const token = await fsLocal().createSessionToken(file);

    let layerID    = null;
    let placedW    = 0;
    let placedH    = 0;
    await ps.core.executeAsModal(async function () {
      // ----- place (centered on canvas; Photoshop may shrink-to-fit
      //       depending on user pref "Resize Image During Place") -----
      await ps.action.batchPlay(
        [{
          _obj: "placeEvent",
          target: { _path: token },
          freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" },
          offset: { _obj: "offset", horizontal: { _unit: "pixelsUnit", _value: 0 }, vertical: { _unit: "pixelsUnit", _value: 0 } },
          _options: { dialogOptions: "dontDisplay" },
        }],
        { synchronousExecution: true }
      );

      const doc = ps.app.activeDocument;
      const layer = doc && doc.activeLayers && doc.activeLayers[0];

      // ----- restore native size if Photoshop shrank to fit -----
      if (layer && layer.bounds && nativeDims.w > 0 && nativeDims.h > 0) {
        const b = layer.bounds;
        const curW = Math.round(Number(b.right)  - Number(b.left));
        const curH = Math.round(Number(b.bottom) - Number(b.top));
        placedW = curW;
        placedH = curH;
        if (curW > 0 && curH > 0) {
          const scaleX = (nativeDims.w / curW) * 100;
          const scaleY = (nativeDims.h / curH) * 100;
          const needs  = Math.abs(scaleX - 100) > 0.5 || Math.abs(scaleY - 100) > 0.5;
          if (needs) {
            try {
              console.log(TAG, "topaz place: shrunk to " + curW + "x" + curH
                + ", scaling back to native " + nativeDims.w + "x" + nativeDims.h
                + " (×" + scaleX.toFixed(1) + "%, ×" + scaleY.toFixed(1) + "%)");
            } catch (_) {}
            await ps.action.batchPlay(
              [{
                _obj: "transform",
                _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
                freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" },
                width:  { _unit: "percentUnit", _value: scaleX },
                height: { _unit: "percentUnit", _value: scaleY },
                _options: { dialogOptions: "dontDisplay" },
              }],
              { synchronousExecution: true }
            );
            placedW = nativeDims.w;
            placedH = nativeDims.h;
          } else {
            try { console.log(TAG, "topaz place: at native (no scale needed)"); } catch (_) {}
          }
        }
      }

      // ----- rasterize so the smart-object token can't break later -----
      try { await rasterizeActiveLayer(); } catch (e) {
        try { console.warn(TAG, "rasterizeActiveLayer threw (continuing):", e); } catch (_) {}
      }

      // ----- grow the canvas so the upscale is actually visible -----
      // Without this, the enlarged layer extends beyond the canvas and
      // the user sees no change — Photoshop clips view + export to the
      // canvas. The deliverable IS the bigger image, so the doc grows
      // to match. Anchored at center so the existing content stays
      // aligned with the centered upscale layer.
      if (nativeDims.w > 0 && nativeDims.h > 0) {
        try {
          await resizeCanvasToFit(nativeDims.w, nativeDims.h);
        } catch (e) {
          try { console.warn(TAG, "resizeCanvasToFit threw (continuing):", e); } catch (_) {}
        }
      }

      // ----- rename -----
      if (layerName) {
        try { await renameActiveLayer(layerName); } catch (_) {}
      }

      try {
        const l2 = doc && doc.activeLayers && doc.activeLayers[0];
        if (l2 && typeof l2.id !== "undefined") layerID = l2.id;
      } catch (_) {}
    }, { commandName: "KBImage — place Topaz upscale" });

    return { layerID: layerID, nativeW: nativeDims.w, nativeH: nativeDims.h,
             placedW: placedW, placedH: placedH };
  }

  // Grow the active document's canvas to at least (newW × newH),
  // anchored at center. NEVER shrinks. Used after a Topaz upscale so
  // the layer's full enlarged pixels are visible/exportable instead of
  // being clipped to the original canvas.
  //
  // Why center anchor: placeEvent placed the upscale centered (QCSAverage),
  // and the existing-content layer was already filling the old canvas.
  // Centering the new canvas around the old keeps the centered upscale
  // layer aligned with the centered existing content — no offset drift.
  //
  // Must be called inside executeAsModal (caller's scope).
  async function resizeCanvasToFit(newW, newH) {
    const ps = psMod();
    const doc = ps.app.activeDocument;
    if (!doc) return;
    const curW = Math.round(Number(doc.width));
    const curH = Math.round(Number(doc.height));
    const targetW = Math.max(Math.round(newW), curW);
    const targetH = Math.max(Math.round(newH), curH);
    if (targetW <= curW && targetH <= curH) {
      try {
        console.log(TAG, "canvas resize: skipped (current " + curW + "x" + curH
          + " already covers " + newW + "x" + newH + ")");
      } catch (_) {}
      return;
    }
    try {
      console.log(TAG, "canvas resize: " + curW + "x" + curH
        + " → " + targetW + "x" + targetH + " (anchor=center)");
    } catch (_) {}
    await ps.action.batchPlay(
      [{
        _obj: "canvasSize",
        width:  { _unit: "pixelsUnit", _value: targetW },
        height: { _unit: "pixelsUnit", _value: targetH },
        horizontal: { _enum: "horizontalLocation", _value: "center" },
        vertical:   { _enum: "verticalLocation",   _value: "center" },
        _options: { dialogOptions: "dontDisplay" },
      }],
      { synchronousExecution: true }
    );
  }

  // =======================================================================
  // STEP 2.5 — Photoshop-side editing primitives.
  // All of these run inside executeAsModal (the caller wraps).
  // =======================================================================

  function bytesToBase64(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      const end = Math.min(i + chunk, bytes.length);
      binary += String.fromCharCode.apply(null, bytes.subarray(i, end));
    }
    return btoa(binary);
  }

  // Decode just enough of the file header to read the image dimensions.
  // Used to log what NB *actually* returned so we can compare to the
  // aspect we asked for.
  //   PNG:  bytes 16..24 (IHDR width + height, big-endian uint32 each)
  //   JPEG: walk markers until SOF0..SOF3 (0xFFC0..0xFFC3), then read
  //         height (bytes 5..7) + width (bytes 7..9) from that segment.
  function decodeImageDims(base64, _mime) {
    if (!base64) return null;
    const clean = base64.replace(/\s+/g, "");
    if (typeof atob !== "function") return null;
    // Decode the first ~256 bytes — plenty for PNG IHDR; usually enough
    // to walk JPEG markers to SOF0. (If a JPEG is heavily commented before
    // SOF, we fall through and return null rather than scan the whole file.)
    const head = clean.slice(0, 4096); // up to 3KB binary
    let bin;
    try { bin = atob(head); } catch (_) { return null; }
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    // PNG signature
    if (bytes.length >= 24
        && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      const w = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
      const h = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
      return { w: w >>> 0, h: h >>> 0 };
    }

    // JPEG: walk markers
    if (bytes.length >= 4 && bytes[0] === 0xFF && bytes[1] === 0xD8) {
      let i = 2;
      while (i + 9 < bytes.length) {
        if (bytes[i] !== 0xFF) { i++; continue; }
        const marker = bytes[i + 1];
        // SOF0..SOF3 = baseline / extended / progressive / lossless
        if (marker >= 0xC0 && marker <= 0xC3) {
          const h = (bytes[i + 5] << 8) | bytes[i + 6];
          const w = (bytes[i + 7] << 8) | bytes[i + 8];
          return { w: w, h: h };
        }
        // Standalone markers (no length): SOI/EOI/RSTn
        if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7)) {
          i += 2; continue;
        }
        // Generic segment: length follows the marker
        const segLen = (bytes[i + 2] << 8) | bytes[i + 3];
        if (!segLen) break;
        i += 2 + segLen;
      }
    }
    return null;
  }

  // Same as decodeImageDims but operates directly on an ArrayBuffer
  // header — avoids base64-encoding huge buffers just to read 24 bytes.
  // Used on the Topaz path where the CDN returns binary.
  function decodeImageDimsFromBytes(arrayBuffer) {
    if (!arrayBuffer || !arrayBuffer.byteLength) return null;
    const sliceLen = Math.min(4096, arrayBuffer.byteLength);
    const bytes = new Uint8Array(arrayBuffer, 0, sliceLen);

    // PNG signature + IHDR
    if (bytes.length >= 24
        && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      const w = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
      const h = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
      return { w: w >>> 0, h: h >>> 0 };
    }

    // JPEG: walk markers to SOF0..SOF3
    if (bytes.length >= 4 && bytes[0] === 0xFF && bytes[1] === 0xD8) {
      let i = 2;
      while (i + 9 < bytes.length) {
        if (bytes[i] !== 0xFF) { i++; continue; }
        const marker = bytes[i + 1];
        if (marker >= 0xC0 && marker <= 0xC3) {
          const h = (bytes[i + 5] << 8) | bytes[i + 6];
          const w = (bytes[i + 7] << 8) | bytes[i + 8];
          return { w: w, h: h };
        }
        if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7)) {
          i += 2; continue;
        }
        const segLen = (bytes[i + 2] << 8) | bytes[i + 3];
        if (!segLen) break;
        i += 2 + segLen;
      }
    }
    return null;
  }

  // Sniff the actual encoded format from the first few bytes so the
  // mime_type we send to the model matches what UXP produced. We need this
  // because encodeImageData's output format depends on the pixel data
  // shape and the host version — sometimes PNG, sometimes JPEG.
  function detectImageMime(arrayBuffer) {
    const v = new Uint8Array(arrayBuffer);
    if (v.length >= 4 && v[0] === 0x89 && v[1] === 0x50 && v[2] === 0x4E && v[3] === 0x47) return "image/png";
    if (v.length >= 3 && v[0] === 0xFF && v[1] === 0xD8 && v[2] === 0xFF) return "image/jpeg";
    if (v.length >= 6 && v[0] === 0x47 && v[1] === 0x49 && v[2] === 0x46) return "image/gif";
    return "image/png"; // safe default — Gemini accepts both
  }

  // Read the document COMPOSITE (rendered output of all layers) as image
  // base64 via the UXP imaging API. Must be called inside executeAsModal.
  //
  // Why composite, not active layer:
  //   - Edit modes need surrounding context for the model to understand the
  //     scene. Reading just the active layer hides everything below it.
  //   - Reading the composite avoids issues with smart-object / adjustment /
  //     empty layers whose own bounds may be zero-area ("invalid empty image
  //     region" from grabPixels).
  //   - sourceBounds is set explicitly to the document rect — never passed
  //     empty.
  //
  // applyAlpha:true flattens any per-layer transparency INTO the RGB so the
  // resulting pixel data has no alpha channel. Without this the encoder
  // throws "Image data with alpha cannot be encoded as jpeg" — the default
  // encoder format on this host rejects RGBA.
  async function readDocCompositeAsImage() {
    const ps = psMod();
    const doc = ps.app.activeDocument;
    if (!doc) throw new Error("Open a Photoshop document first.");

    const docW = Math.round(doc.width);
    const docH = Math.round(doc.height);
    if (!(docW > 0 && docH > 0)) {
      throw new Error("Document has zero area (width=" + docW + ", height=" + docH + ").");
    }

    const pixelResult = await ps.imaging.getPixels({
      documentID: doc.id,
      // No layerID → composite of all visible layers.
      sourceBounds: { left: 0, top: 0, right: docW, bottom: docH },
      applyAlpha: true,        // bake alpha into RGB — encoder needs RGB
      componentSize: 8,        // 8-bit per channel
    });

    if (!pixelResult || !pixelResult.imageData) {
      throw new Error("imaging.getPixels returned no imageData.");
    }

    let encoded;
    try {
      encoded = await ps.imaging.encodeImageData({
        imageData: pixelResult.imageData,
      });
    } finally {
      try { pixelResult.imageData.dispose(); } catch (_) {}
    }

    let buffer;
    let base64;
    if (encoded instanceof ArrayBuffer) {
      buffer = encoded; base64 = bytesToBase64(encoded);
    } else if (encoded && encoded.buffer instanceof ArrayBuffer) {
      buffer = encoded.buffer; base64 = bytesToBase64(encoded.buffer);
    } else if (typeof encoded === "string") {
      base64 = encoded;
      // Decode just the first ~12 bytes for magic-number sniffing.
      try {
        const head = atob(encoded.slice(0, 16));
        const arr = new Uint8Array(head.length);
        for (let i = 0; i < head.length; i++) arr[i] = head.charCodeAt(i);
        buffer = arr.buffer;
      } catch (_) { buffer = new ArrayBuffer(0); }
    } else {
      throw new Error("Unknown encodeImageData return type: " + typeof encoded);
    }

    const mime = detectImageMime(buffer);

    try {
      const approxBytes = Math.round(base64.length * 3 / 4);
      console.log(TAG, "read image OK: doc=" + docW + "x" + docH
        + ", mime=" + mime + ", base64.len=" + base64.length + " (~" + approxBytes + "B)");
    } catch (_) {}

    return { base64: base64, mime: mime, width: docW, height: docH };
  }

  // v0.07 — read the ACTIVE LAYER's own pixels (not the document
  // composite). Topaz wants what the layer contains, not the scene.
  // Throws clearly if the active layer has no pixel content (e.g.
  // adjustment / empty / zero-bounds layer).
  async function readActiveLayerAsImage() {
    const ps = psMod();
    const doc = ps.app.activeDocument;
    if (!doc) throw new Error("Open a Photoshop document first.");
    const layer = doc.activeLayers && doc.activeLayers[0];
    if (!layer) throw new Error("No active layer.");

    const b = layer.bounds || {};
    const left   = Math.round(Number(b.left)   || 0);
    const top    = Math.round(Number(b.top)    || 0);
    const right  = Math.round(Number(b.right)  || 0);
    const bottom = Math.round(Number(b.bottom) || 0);
    const w = right - left;
    const h = bottom - top;
    if (!(w > 0 && h > 0)) {
      throw new Error("Active layer has no pixel content (bounds "
        + w + "x" + h + "). Pick a pixel or smart-object layer.");
    }

    const pixelResult = await ps.imaging.getPixels({
      documentID: doc.id,
      layerID: layer.id,
      sourceBounds: { left: left, top: top, right: right, bottom: bottom },
      applyAlpha: true,
      componentSize: 8,
    });
    if (!pixelResult || !pixelResult.imageData) {
      throw new Error("imaging.getPixels returned no imageData.");
    }

    let encoded;
    try {
      encoded = await ps.imaging.encodeImageData({ imageData: pixelResult.imageData });
    } finally {
      try { pixelResult.imageData.dispose(); } catch (_) {}
    }

    let buffer;
    let base64;
    if (encoded instanceof ArrayBuffer) {
      buffer = encoded; base64 = bytesToBase64(encoded);
    } else if (encoded && encoded.buffer instanceof ArrayBuffer) {
      buffer = encoded.buffer; base64 = bytesToBase64(encoded.buffer);
    } else if (typeof encoded === "string") {
      base64 = encoded;
      try {
        const head = atob(encoded.slice(0, 16));
        const arr = new Uint8Array(head.length);
        for (let i = 0; i < head.length; i++) arr[i] = head.charCodeAt(i);
        buffer = arr.buffer;
      } catch (_) { buffer = new ArrayBuffer(0); }
    } else {
      throw new Error("Unknown encodeImageData return type: " + typeof encoded);
    }

    const mime = detectImageMime(buffer);
    try {
      console.log(TAG, "read active layer: " + w + "x" + h
        + ", mime=" + mime + ", base64.len=" + base64.length);
    } catch (_) {}
    return { base64: base64, mime: mime, width: w, height: h };
  }

  async function addLayerMaskRevealSelection() {
    const ps = psMod();
    await ps.action.batchPlay(
      [{
        _obj: "make",
        new: { _class: "channel" },
        at: { _ref: "channel", _enum: "channel", _value: "mask" },
        using: { _enum: "userMaskEnabled", _value: "revealSelection" },
        _options: { dialogOptions: "dontDisplay" },
      }],
      { synchronousExecution: true }
    );
  }

  // Explicit-fill mask path. Used to BUILD the layer mask directly from
  // a captured rect rather than relying on "revealSelection" reading the
  // live PS selection state at the moment the mask is created. The
  // revealSelection path was producing an all-black mask on NB regardless
  // of selectRect being called immediately before — the mask was made
  // before the selection write was committed in some PS internal order.
  // The hide-all + selectRect + fill-white sequence is unambiguous:
  //   1. Mask exists, fully black (everything hidden).
  //   2. Selection set to the exact rect we want to reveal.
  //   3. Active fill target is the mask channel; white fill paints
  //      white pixels into the masked area.
  //   4. Deselect so the next op starts clean.
  async function addLayerMaskHideAll() {
    const ps = psMod();
    await ps.action.batchPlay(
      [{
        _obj: "make",
        new: { _class: "channel" },
        at: { _ref: "channel", _enum: "channel", _value: "mask" },
        using: { _enum: "userMaskEnabled", _value: "hideAll" },
        _options: { dialogOptions: "dontDisplay" },
      }],
      { synchronousExecution: true }
    );
  }

  async function fillSelectionWithWhite() {
    const ps = psMod();
    await ps.action.batchPlay(
      [{
        _obj: "fill",
        using:   { _enum: "fillContents", _value: "white" },
        opacity: { _unit: "percentUnit", _value: 100 },
        mode:    { _enum: "blendMode", _value: "normal" },
        _options: { dialogOptions: "dontDisplay" },
      }],
      { synchronousExecution: true }
    );
  }

  async function deselectAll() {
    const ps = psMod();
    await ps.action.batchPlay(
      [{
        _obj: "set",
        _target: [{ _ref: "channel", _property: "selection" }],
        to: { _enum: "ordinal", _value: "none" },
        _options: { dialogOptions: "dontDisplay" },
      }],
      { synchronousExecution: true }
    );
  }

  // v0.10 — verification for the editable selection mask. Reads the active
  // layer's mask channel histogram and counts revealed (>=128) and pure-
  // white (255) pixels. white/revealed == 0 is the all-black-mask signature
  // (the old regression) — log it loudly so a polarity/timing break is
  // caught here instead of looking like a blank edit. Returns null if the
  // host doesn't expose the histogram (non-fatal — the mask still built).
  async function maskRevealedPixelCount() {
    const ps = psMod();
    try {
      const res = await ps.action.batchPlay(
        [{
          _obj: "get",
          _target: [
            { _ref: "channel", _enum: "channel", _value: "mask" },
            { _ref: "layer",   _enum: "ordinal", _value: "targetEnum" },
          ],
          _options: { dialogOptions: "dontDisplay" },
        }],
        { synchronousExecution: true }
      );
      const hist = res && res[0] && res[0].histogram;
      if (hist && hist.length === 256) {
        let revealed = 0, white = 0;
        for (let v = 0; v < 256; v++) {
          if (v >= 128) revealed += hist[v];
          if (v === 255) white += hist[v];
        }
        return { revealed: revealed, white: white };
      }
    } catch (e) {
      try { console.warn(TAG, "mask histogram read failed:", e); } catch (_) {}
    }
    return null;
  }

  async function renameActiveLayer(name) {
    const ps = psMod();
    await ps.action.batchPlay(
      [{
        _obj: "set",
        _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
        to: { _obj: "layer", name: name },
        _options: { dialogOptions: "dontDisplay" },
      }],
      { synchronousExecution: true }
    );
  }

  // v0.10 — save / reload / delete the LIVE selection via a temp alpha
  // channel. This is the key to a SHAPE-ACCURATE mask: the user's real
  // selection (lasso / quick-mask / subject-select / any irregular shape)
  // is persisted up-front, then reloaded after generation so the native
  // revealSelection mask op reproduces the EXACT shape — never a bounding
  // rectangle, and never lost to the steps that clear the live selection.
  //
  // batchPlay equivalents of Select ▸ Save Selection (new channel),
  // Select ▸ Load Selection (from channel), and deleting that channel.
  async function saveSelectionToChannel(name) {
    const ps = psMod();
    await ps.action.batchPlay(
      [{
        _obj: "duplicate",
        _target: [{ _ref: "channel", _property: "selection" }],
        name: name,
        _options: { dialogOptions: "dontDisplay" },
      }],
      { synchronousExecution: true }
    );
  }

  async function loadSelectionFromChannel(name) {
    const ps = psMod();
    await ps.action.batchPlay(
      [{
        _obj: "set",
        _target: [{ _ref: "channel", _property: "selection" }],
        to: { _ref: "channel", _name: name },
        _options: { dialogOptions: "dontDisplay" },
      }],
      { synchronousExecution: true }
    );
  }

  async function deleteChannelByName(name) {
    const ps = psMod();
    await ps.action.batchPlay(
      [{
        _obj: "delete",
        _target: [{ _ref: "channel", _name: name }],
        _options: { dialogOptions: "dontDisplay" },
      }],
      { synchronousExecution: true }
    );
  }

  // v0.10 — target the RGB composite (exit layer-mask / alpha-channel
  // editing). After revealSelection the layer MASK is the active channel
  // target; with a mask/alpha channel targeted, "Delete channel" reports
  // "not currently available". Selecting RGB makes the normal pixel layer
  // the active target so the temp-channel delete is valid.
  async function selectRGBChannel() {
    const ps = psMod();
    await ps.action.batchPlay(
      [{
        _obj: "select",
        _target: [{ _ref: "channel", _enum: "channel", _value: "RGB" }],
        makeVisible: false,
        _options: { dialogOptions: "dontDisplay" },
      }],
      { synchronousExecution: true }
    );
  }

  // True only if an alpha channel of this exact name exists. Used so we
  // never issue a delete against a missing channel (which is itself an
  // error). Silent on any failure.
  async function channelExistsByName(name) {
    const ps = psMod();
    try {
      const res = await ps.action.batchPlay(
        [{
          _obj: "get",
          _target: [{ _ref: "channel", _name: name }],
          _options: { dialogOptions: "dontDisplay" },
        }],
        { synchronousExecution: true }
      );
      return !!(res && res[0] && res[0].name === name);
    } catch (_) {
      return false;
    }
  }

  // Select a rectangle by absolute document px.
  async function selectRect(left, top, right, bottom) {
    const ps = psMod();
    await ps.action.batchPlay(
      [{
        _obj: "set",
        _target: [{ _ref: "channel", _property: "selection" }],
        to: {
          _obj: "rectangle",
          top:    { _unit: "pixelsUnit", _value: top },
          left:   { _unit: "pixelsUnit", _value: left },
          bottom: { _unit: "pixelsUnit", _value: bottom },
          right:  { _unit: "pixelsUnit", _value: right },
        },
        _options: { dialogOptions: "dontDisplay" },
      }],
      { synchronousExecution: true }
    );
  }

  async function invertSelection() {
    const ps = psMod();
    await ps.action.batchPlay(
      [{ _obj: "inverse", _options: { dialogOptions: "dontDisplay" } }],
      { synchronousExecution: true }
    );
  }

  // Resize the canvas. anchorH ∈ {"left","center","right"}, anchorV ∈ {"top","center","bottom"}.
  async function canvasResize(newW, newH, anchorH, anchorV) {
    const ps = psMod();
    await ps.action.batchPlay(
      [{
        _obj: "canvasSize",
        width:  { _unit: "pixelsUnit", _value: newW },
        height: { _unit: "pixelsUnit", _value: newH },
        horizontal: { _enum: "horizontalLocation", _value: anchorH || "center" },
        vertical:   { _enum: "verticalLocation",   _value: anchorV || "center" },
        _options: { dialogOptions: "dontDisplay" },
      }],
      { synchronousExecution: true }
    );
  }

  // Bake the active layer's rendered content into pixels in-place.
  // Smart objects placed via placeEvent reference an external PNG via a
  // UXP session token; that reference appears to render correctly inside
  // the modal scope but go stale once the modal exits, so the canvas
  // shows nothing while the layer is technically there. Rasterizing
  // commits the rendered pixels into the layer itself — no external
  // dependency. The mask + name etc. still attach fine to the rasterized
  // layer.
  async function rasterizeActiveLayer() {
    const ps = psMod();
    await ps.action.batchPlay(
      [{
        _obj: "rasterizeLayer",
        _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
        _options: { dialogOptions: "dontDisplay" },
      }],
      { synchronousExecution: true }
    );
  }

  // Stretch the active layer to fully cover the document. Center-anchored
  // scale + translate-to-center. The placed smart object's native bounds
  // come from the model's output resolution (often 1024², doesn't match the
  // canvas). Without this step the result sits at native size in the middle
  // of the document and the mask — which is in document coords — would
  // clip away the visible content because they no longer line up.
  //
  // Anisotropic stretch is intentional. For masked edits any distortion is
  // hidden outside the selection. For whole-image and Extend edits the user
  // can pick a matching aspect ratio in the Aspect pills (or accept stretch
  // for now — once Match Input is wired to the API this will go away).
  async function fitActiveLayerToCanvas() {
    const ps = psMod();
    const doc = ps.app.activeDocument;
    const layer = doc.activeLayers && doc.activeLayers[0];
    if (!layer) return;

    let cur;
    try { cur = layer.bounds; } catch (_) { return; }
    if (!cur) return;

    const curL = Number(cur.left)   || 0;
    const curT = Number(cur.top)    || 0;
    const curR = Number(cur.right)  || 0;
    const curB = Number(cur.bottom) || 0;
    const curW = curR - curL;
    const curH = curB - curT;
    if (curW <= 0 || curH <= 0) return;

    const targetW = Math.round(doc.width);
    const targetH = Math.round(doc.height);
    if (targetW <= 0 || targetH <= 0) return;

    // Single transform: scale around center, translate center to canvas center.
    const dx = (targetW / 2) - (curL + curW / 2);
    const dy = (targetH / 2) - (curT + curH / 2);
    const sx = (targetW / curW) * 100;
    const sy = (targetH / curH) * 100;

    try {
      console.log(TAG, "fit→canvas: cur=" + curW + "x" + curH + "@(" + curL + "," + curT + ")",
        "tgt=" + targetW + "x" + targetH,
        "dx=" + Math.round(dx) + " dy=" + Math.round(dy),
        "sx=" + sx.toFixed(1) + "% sy=" + sy.toFixed(1) + "%");
    } catch (_) {}

    await ps.action.batchPlay(
      [{
        _obj: "transform",
        _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
        freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" },
        offset: {
          _obj: "offset",
          horizontal: { _unit: "pixelsUnit", _value: dx },
          vertical:   { _unit: "pixelsUnit", _value: dy },
        },
        width:  { _unit: "percentUnit", _value: sx },
        height: { _unit: "percentUnit", _value: sy },
        _options: { dialogOptions: "dontDisplay" },
      }],
      { synchronousExecution: true }
    );
  }

  // Place + fit-to-canvas + (optionally) mask the result.
  //
  // maskSpec describes what the mask should be (or null = no mask):
  //   { kind: "rect",   rect: {left, top, right, bottom} }
  //     → re-select rect, mask = revealSelection. Only the selection shows
  //       the model's content; outside the selection stays original.
  //   { kind: "frame", oldRect: {left, top, right, bottom} }
  //     → re-select oldRect, invert, mask = revealSelection (Extend). Only
  //       the new extended frame shows the model's content; the original
  //       canvas area stays original.
  //
  // The fit-to-canvas step happens BEFORE the mask so the visible content
  // and the mask both live in the same document coordinate space.
  //
  // NOTE: rectangular re-selection is a rectangular approximation of the
  // user's original selection. Arbitrary-shape (lasso, magic wand)
  // selections are reduced to their bounding rectangle in v0.03 — the
  // proper "save selection to alpha channel" workflow is deferred.
  // finalizeSelChannel — when true AND a channel-kind mask was used, delete
  // the temp selection channel here (inside this modal, after the mask is
  // built + deselected + RGB re-targeted) so "Delete channel" is valid and
  // never surfaces a host error dialog. Caller sets it on the LAST batch
  // item so earlier items can still reload the channel.
  async function placeBase64AsEditedLayer(base64, maskSpec, layerName, finalizeSelChannel) {
    const ps = psMod();
    if (!ps.app.activeDocument) throw new Error("Open a Photoshop document first.");

    const folder = await fsLocal().getDataFolder();
    const file = await folder.createFile("kbanana-edit-" + Date.now() + ".png", { overwrite: true });
    await file.write(base64ToArrayBuffer(base64), { format: fmts().binary });
    try { lastPlacedFileRef = file.nativePath; } catch (_) {}
    const token = await fsLocal().createSessionToken(file);

    let layerID = null;
    await ps.core.executeAsModal(async function () {
      await ps.action.batchPlay(
        [{
          _obj: "placeEvent",
          target: { _path: token },
          freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" },
          offset: { _obj: "offset", horizontal: { _unit: "pixelsUnit", _value: 0 }, vertical: { _unit: "pixelsUnit", _value: 0 } },
          _options: { dialogOptions: "dontDisplay" },
        }],
        { synchronousExecution: true }
      );

      // CRITICAL: scale + position the placed layer to cover the canvas
      // before masking. The mask is in document coords; without this step
      // the visible content (model's native output) and the mask don't
      // overlap and the user sees a small floating box or whole-scene
      // changes outside the selection.
      try {
        await fitActiveLayerToCanvas();
      } catch (e) {
        try { console.warn(TAG, "fit-to-canvas failed:", e); } catch (_) {}
      }

      // CRITICAL: commit the smart object's rendered content into pixels.
      // The smart object's source is a PNG in the plugin data folder
      // referenced via UXP session token — the token survives the modal
      // scope inconsistently and the canvas can end up showing nothing
      // even though the layer exists at the right bounds with the right
      // mask. Rasterize bakes the pixels into the layer in-place and
      // breaks the external dependency.
      try {
        await rasterizeActiveLayer();
      } catch (e) {
        try { console.warn(TAG, "rasterize failed:", e); } catch (_) {}
      }

      if (maskSpec) {
        // The placed layer's PIXELS are the MODEL OUTPUT ONLY — nothing is
        // ever stamped onto them. The mask below hides/reveals; it never
        // alters layer content. It is LEFT EDITABLE (never applied/merged)
        // so the designer can hand-refine the blend afterward.
        try {
          if (maskSpec.kind === "channel" && maskSpec.channelName) {
            // v0.10 — SHAPE-ACCURATE editable selection mask (Select tab).
            // Reload the user's REAL selection (its true shape, saved to an
            // alpha channel before generation) and build the mask with the
            // NATIVE revealSelection op = white in the exact selection shape,
            // black outside. This is the "active selection → add layer mask"
            // behavior; it preserves lasso/quick-mask/irregular shapes
            // instead of a bounding rectangle. revealSelection needs a LIVE
            // selection, which is why we reload from the channel here — by
            // mask-time the original selection has been cleared by the
            // generation/placement steps.
            await deselectAll();
            await loadSelectionFromChannel(maskSpec.channelName);
            await addLayerMaskRevealSelection();
            await deselectAll();
            // Safety net for the historical all-black degrade: if reveal
            // came back empty, paint white into the EXISTING mask using the
            // reloaded selection shape (fill respects the real shape — still
            // never a rectangle). Only fires on the 0-revealed failure.
            try {
              const mc0 = await maskRevealedPixelCount();
              if (mc0 && mc0.revealed <= 0) {
                console.warn(TAG, "revealSelection mask empty — rebuilding white via reload+fill (shape-accurate).");
                await deselectAll();
                await loadSelectionFromChannel(maskSpec.channelName);
                await fillSelectionWithWhite();
                await deselectAll();
              }
            } catch (_) {}
          } else {
            // FRAME (Extend) and rect fallback: hide-all (fully black mask)
            // then reveal the keep-region by white fill.
            //   • Extend frame: select OLD rect, invert, fill → reveal the
            //     new perimeter.
            //   • rect fallback (only if the channel save was unavailable):
            //     bounding-box reveal.
            // Deselect FIRST: the user's live marquee is still active here,
            // and on this UXP host a black hide-all has scoped onto the
            // LAYER PIXELS when a selection was live. Clearing it first keeps
            // the black confined to the mask channel.
            await deselectAll();
            await addLayerMaskHideAll();
            if (maskSpec.kind === "frame" && maskSpec.oldRect) {
              await selectRect(maskSpec.oldRect.left, maskSpec.oldRect.top, maskSpec.oldRect.right, maskSpec.oldRect.bottom);
              await invertSelection();
            } else if (maskSpec.kind === "rect" && maskSpec.rect) {
              await selectRect(maskSpec.rect.left, maskSpec.rect.top, maskSpec.rect.right, maskSpec.rect.bottom);
            }
            await fillSelectionWithWhite();
            await deselectAll();
          }
          // v0.10 — verify the mask actually revealed the selection. A
          // revealed/white count of 0 == the old all-black bug.
          try {
            const mc = await maskRevealedPixelCount();
            if (mc) {
              const r = maskSpec.rect;
              const expected = (r && typeof r.right === "number")
                ? Math.round((r.right - r.left) * (r.bottom - r.top))
                : null;
              console.log(TAG, "mask verify:", maskSpec.kind,
                "revealed(>=128)=" + mc.revealed,
                "white(255)=" + mc.white,
                expected != null ? ("expected(bbox)≈" + expected + "px") : "");
              if (mc.revealed <= 0) {
                console.warn(TAG, "MASK ALL-BLACK — revealed 0 px (regression!).");
              }
            }
          } catch (_) {}

          // v0.10 — delete the temp selection channel HERE: inside the
          // modal, after the mask is built and the selection is none, with
          // RGB re-targeted so a normal pixel layer (not the mask/alpha
          // channel) is the active target. That state is what makes
          // "Delete channel" valid; doing it in a later/standalone modal
          // left an alpha/mask channel targeted and triggered "The command
          // 'Delete' is not currently available". Only on the LAST batch
          // item (finalizeSelChannel) so earlier items can still reload it.
          // Fully guarded: a failure logs to console and is swallowed — it
          // NEVER surfaces a dialog or aborts the edit (a leftover temp
          // channel is harmless and the next run clears it).
          if (finalizeSelChannel && maskSpec.kind === "channel" && maskSpec.channelName) {
            try {
              await selectRGBChannel();
              if (await channelExistsByName(maskSpec.channelName)) {
                await deleteChannelByName(maskSpec.channelName);
              }
            } catch (e) {
              try { console.warn(TAG, "temp channel cleanup skipped:", e); } catch (_) {}
            }
          }
        } catch (e) {
          try { console.warn(TAG, "mask apply failed:", e); } catch (_) {}
        }
      }

      if (layerName) {
        try { await renameActiveLayer(layerName); } catch (_) {}
      }
      // Capture the new layer's ID for future use (currently unused by
      // the panel — Layers panel is the result navigator).
      try {
        const doc = ps.app.activeDocument;
        const layer = doc && doc.activeLayers && doc.activeLayers[0];
        if (layer && typeof layer.id !== "undefined") layerID = layer.id;
      } catch (_) {}
    }, { commandName: "KBImage — place edited image" });
    return layerID;
  }

  // =======================================================================
  // STEP 3 — UI state + action handlers
  // =======================================================================

  // v0.04 — "the kBanana key" was the Google AI Studio one. v0.06 adds
  // a second provider key (OpenAI) kept independent in secureStorage.
  // Every call into generateImage uses activeApiKey() so the right key
  // is picked based on the currently-selected model's provider.
  let cachedKey       = "";   // Google AI Studio (Gemini)
  let cachedOpenAIKey = "";   // OpenAI
  let cachedTopazKey  = "";   // Topaz Image API (finishing — v0.07)
  let cachedBflKey    = "";   // Black Forest Labs / Flux.2 (v0.12)
  let cachedClarityKey = "";  // ClarityAI upscaler (v0.12 — scaffold only)
  let cachedUpscaleProvider = "topaz";   // v0.12 — "topaz" | "clarity"
  let cachedClarityCreativity = 0;        // v0.12 — Clarity creativity, default 0 (fidelity)
  // v0.14 — Fal lane (aggregator exception). One key serves all Fal models.
  let cachedFalKey = "";
  let cachedFalSafetyChecker = true;     // enable_safety_checker; user can turn OFF (intimates unblock)
  let cachedFalLoraUrl = "";             // LoRA .safetensors URL (empty = plain dev inference)
  let cachedFalLoraScale = 1;            // LoRA scale
  // Flux safety_tolerance (editable in Settings): 0 strict .. 5 most permissive.
  // FLUX.2 range is 0–5 (6 was FLUX.1). Default 5 = BFL's most permissive.
  let cachedFluxSafety = 5;
  function clampFluxSafety(v) {
    const n = Math.round(Number(v));
    return isFinite(n) ? Math.max(0, Math.min(5, n)) : 5;
  }
  // v0.07.1 — what the Upscale action sends to Topaz.
  //   "composite"   → readDocCompositeAsImage() — flattened snapshot of
  //                   ALL visible layers (default; what a multi-layer
  //                   comp actually wants for finishing)
  //   "active-layer"→ readActiveLayerAsImage()  — just the active
  //                   layer's own pixels
  // Reset each session; we don't persist this.
  let cachedUpscaleSource = "composite";
  // v0.07.3 — upscale factor (multiplier on source dimensions). Topaz
  // controls upscale via explicit output_width / output_height — there
  // is NO `scale` param. We multiply source dims by this factor and
  // pass the result. Default 2x; Topaz caps any single dim at 32000.
  let cachedUpscaleFactor = 2;
  let cachedModelId = DEFAULT_MODEL_ID;

  function activeProvider() {
    const m = MODELS[cachedModelId] || MODELS[DEFAULT_MODEL_ID];
    return (m && m.provider) || "gemini";
  }
  function activeApiKey() {
    const p = activeProvider();
    if (p === "openai") return cachedOpenAIKey;
    if (p === "bfl")    return cachedBflKey;
    if (p === "fal")    return cachedFalKey;
    return cachedKey;
  }
  // Reference images held in memory only. Each entry:
  //   { name, mime, base64, dataUrl }
  // Not persisted across reloads — references are session-scoped.
  let refImages = [];
  // Hard lock against concurrent Generate runs. Belt-and-suspenders with the
  // .disabled class — even if multiple click events somehow reach the
  // dispatcher (duplicate listener, fast double-tap, synthetic event), only
  // one actGenerate body can execute at a time.
  let generateInFlight = false;

  // v0.04 (4-tab restructure) — tab + per-tab pill state.
  //   activeTab ∈ {"generate","select","edit","compose","settings"}
  //   cachedSelectionPill ∈ {remove,replace,add,fill,extend} — sticky last
  //     pill on the Select tab.
  //   cachedWholePill ∈ {"",lighting,recolor,style} — sticky last pill on
  //     the Edit tab. "" = freeform (user types instruction).
  //   cachedComposeOp ∈ {refgen,fuse,refinpaint} — sticky last op on the
  //     Compose tab (v0.05).
  //   cachedEditType is the DERIVED current value for the pipeline,
  //     restored from cachedSelectionPill or cachedWholePill on tab change.
  let activeTab           = "generate";
  let cachedSelectionPill = "remove";
  let cachedWholePill     = "";
  let cachedComposeOp     = "refgen";
  let cachedEditType      = "remove";
  let cachedExtendDir     = "all";

  // v0.04.2 — quantity batch. N selected → N sequential generateContent
  // calls → N named layers. Result navigation lives in Photoshop's Layers
  // panel, not the plugin; no in-panel thumbnail grid or history.
  let cachedQuantity = 1;

  // =======================================================================
  // v0.09 — COST METER (real USD; never points/credits).
  //
  // Proves both value props for the target user (heavy partner-model users
  // who run out of Adobe credits): no ceiling + lower real cost. Estimates
  // are shown per action; a live session total tallies actual spend.
  //
  // Rates are EDITABLE in Settings (prices change). Generation models price
  // per IMAGE at each resolution; Topaz prices per OUTPUT MEGAPIXEL.
  // Defaults are sensible starting points from published API pricing — the
  // user corrects them as pricing moves.
  // =======================================================================
  const RATES_KEY = "kbanana.rates";
  const WARN_KEY  = "kbanana.warnThreshold";
  const TOPAZ_RATE_ID = "topaz";
  const TOPAZ_MAX_DIM_EST = 32000;   // mirror the adapter's per-dim cap

  const DEFAULT_RATES = {
    "gemini-3-pro-image-preview":     { "1K": 0.134, "2K": 0.134, "4K": 0.24 },
    "gemini-3.1-flash-image-preview": { "0.5K": 0.02, "1K": 0.039, "2K": 0.039, "4K": 0.06 },
    "gpt-image-2":                    { "1K": 0.04, "2K": 0.07, "4K": 0.19 },
    // v0.12 — Flux.2 estimates (BFL bills ~$0.03/MP pro, ~$0.07/MP max; submit
    // response returns the real cost — these rates are the pre-gen estimate, editable in Settings).
    "flux-2-pro":                     { "1K": 0.03, "2K": 0.12 },
    "flux-2-max":                     { "1K": 0.07, "2K": 0.21 },
    // v0.14 — Fal lane (AGGREGATOR MARKUP, not clean first-party cost). Estimates;
    // Fal exposes no cost in the response. Editable in Settings. Qwen ~$0.02/MP,
    // Seedream ~$0.03/image, flux-dev flat-ish per image.
    "fal-flux-dev":                   { "1K": 0.03, "2K": 0.05 },
    "fal-flux-edit":                  { "1K": 0.04, "2K": 0.06 },
    "fal-qwen":                       { "1K": 0.02, "2K": 0.08 },
    "fal-seedream":                   { "1K": 0.03, "2K": 0.03, "4K": 0.03 },
    "topaz":                          { "perMP": 0.01 },
    // Clarity cost is NOT a rate — it's read off the response (cost_usd) per run.
  };
  function cloneRates(src) {
    const out = {};
    const ids = Object.keys(src);
    for (let i = 0; i < ids.length; i++) {
      const inner = src[ids[i]]; const o = {};
      const keys = Object.keys(inner);
      for (let j = 0; j < keys.length; j++) o[keys[j]] = inner[keys[j]];
      out[ids[i]] = o;
    }
    return out;
  }
  let RATES = cloneRates(DEFAULT_RATES);   // live rates (defaults + overrides)
  let warnThreshold = 0;                   // 0 / NaN = warning off
  let sessionTotal  = 0;                   // USD spent since last reset
  let sessionSince  = null;                // Date of last reset / load

  // ----- rate lookups -----
  function perImageCost(modelId, resLabel) {
    const r = RATES[modelId];
    if (!r) return 0;
    const v = Number(r[resLabel]);
    return isFinite(v) ? v : 0;
  }
  function topazPerMP() {
    const r = RATES[TOPAZ_RATE_ID];
    const v = r ? Number(r.perMP) : NaN;
    return isFinite(v) ? v : 0;
  }
  function fmtUSD(n) {
    if (!isFinite(n)) return "$0.00";
    return "$" + (Math.round(n * 100) / 100).toFixed(2);
  }

  // ----- estimates -----
  function effectiveQuantity() {
    // Compose Fuse always returns 3 options; quantity is ignored there.
    if (activeTab === "compose" && cachedComposeOp === "fuse") return 3;
    return Math.max(1, Math.min(4, Number(cachedQuantity) || 1));
  }
  function estimateGenerateUSD() {
    const modelId = cachedModelId || DEFAULT_MODEL_ID;
    const res = readPills("pills-resolution", defaultResFor(modelId));
    return perImageCost(modelId, res) * effectiveQuantity();
  }
  // Topaz output megapixels from the active doc dims × factor (per-dim
  // capped). Returns { usd, known } — known=false when no doc is open.
  function estimateUpscale() {
    const factor = Number(cachedUpscaleFactor) || 2;
    let w = 0, h = 0;
    try {
      const doc = psMod().app.activeDocument;
      if (doc && doc.width > 0 && doc.height > 0) { w = doc.width; h = doc.height; }
    } catch (_) {}
    if (!w || !h) return { usd: 0, known: false };
    const outW = Math.min(w * factor, TOPAZ_MAX_DIM_EST);
    const outH = Math.min(h * factor, TOPAZ_MAX_DIM_EST);
    const mp = (outW * outH) / 1e6;
    return { usd: topazPerMP() * mp, known: true, mp: mp };
  }

  // ----- session total + warning -----
  function updateSessionDisplay() {
    const $tot = $("session-total");
    if ($tot) {
      $tot.textContent = fmtUSD(sessionTotal);
      const over = warnThreshold > 0 && sessionTotal > warnThreshold;
      $tot.classList.toggle("over", over);
    }
    const $since = $("session-since");
    if ($since) $since.textContent = "since " + (sessionSince ? hhmm(sessionSince) : "—");
  }
  function hhmm(d) {
    try {
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      return h + ":" + m;
    } catch (_) { return "—"; }
  }
  function addSessionCost(usd) {
    if (!isFinite(usd) || usd <= 0) return;
    sessionTotal += usd;
    try { console.log(TAG, "session += " + fmtUSD(usd) + " → " + fmtUSD(sessionTotal)); } catch (_) {}
    updateSessionDisplay();
  }
  function resetSession() {
    sessionTotal = 0;
    sessionSince = new Date();
    updateSessionDisplay();
  }

  // ----- per-action estimate line (live) -----
  function _updateCostEstimate() {
    const $gen = $("cost-estimate");
    if ($gen) {
      const n = effectiveQuantity();
      const usd = estimateGenerateUSD();
      $gen.textContent = usd > 0
        ? ("~" + fmtUSD(usd) + (n > 1 ? " (" + n + " images)" : ""))
        : "";
    }
    const $up = $("upscale-estimate");
    if ($up) {
      const e = estimateUpscale();
      if (!e.known) $up.textContent = "Open a document to estimate";
      else $up.textContent = e.usd > 0
        ? ("~" + fmtUSD(e.usd) + " (" + (Math.round(e.mp * 10) / 10) + " MP out)")
        : "";
    }
  }

  // ----- editable rates table (Settings) -----
  function _rebuildRatesTable() {
    const host = $("cost-rates");
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);
    const ids = Object.keys(MODELS);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]; const m = MODELS[id];
      const group = document.createElement("div"); group.className = "rate-group";
      const lbl = document.createElement("div"); lbl.className = "rate-name";
      lbl.textContent = m.displayName + "  ($/image)";
      group.appendChild(lbl);
      const row = document.createElement("div"); row.className = "rate-cells";
      for (let j = 0; j < m.resolutions.length; j++) {
        row.appendChild(rateCell(id, m.resolutions[j], "res"));
      }
      group.appendChild(row);
      host.appendChild(group);
    }
    // Topaz — per output megapixel.
    const tg = document.createElement("div"); tg.className = "rate-group";
    const tl = document.createElement("div"); tl.className = "rate-name";
    tl.textContent = "Topaz Upscale  ($/MP out)";
    tg.appendChild(tl);
    const trow = document.createElement("div"); trow.className = "rate-cells";
    trow.appendChild(rateCell(TOPAZ_RATE_ID, "perMP", "mp"));
    tg.appendChild(trow);
    host.appendChild(tg);
  }
  function rateCell(modelId, key, kind) {
    const cell = document.createElement("label"); cell.className = "rate-cell";
    const cap = document.createElement("span"); cap.className = "rate-cap";
    cap.textContent = kind === "mp" ? "MP" : key;
    const inp = document.createElement("input");
    inp.className = "input rate-input";
    inp.type = "text"; inp.inputMode = "decimal";
    inp.setAttribute("data-rate-model", modelId);
    inp.setAttribute("data-rate-key", key);
    const cur = (RATES[modelId] && RATES[modelId][key]);
    inp.value = (cur != null && isFinite(Number(cur))) ? String(cur) : "";
    cell.appendChild(cap); cell.appendChild(inp);
    return cell;
  }

  // ----- persistence (secureStorage, same pattern as keys/model) -----
  async function saveRates()  { try { await ssget().setItem(RATES_KEY, strToBytes(JSON.stringify(RATES))); } catch (e) { try { console.error(TAG, "saveRates failed:", e); } catch (_) {} } }
  async function loadRates() {
    try {
      const b = await ssget().getItem(RATES_KEY);
      if (!b) return;
      const obj = JSON.parse(bytesToStr(b));
      if (obj && typeof obj === "object") {
        // Merge over defaults so newly-added models still get a default.
        const merged = cloneRates(DEFAULT_RATES);
        const ids = Object.keys(obj);
        for (let i = 0; i < ids.length; i++) {
          merged[ids[i]] = merged[ids[i]] || {};
          const keys = Object.keys(obj[ids[i]] || {});
          for (let j = 0; j < keys.length; j++) {
            const v = Number(obj[ids[i]][keys[j]]);
            if (isFinite(v)) merged[ids[i]][keys[j]] = v;
          }
        }
        RATES = merged;
      }
    } catch (e) { try { console.error(TAG, "loadRates failed:", e); } catch (_) {} }
  }
  async function saveThreshold() { try { await ssget().setItem(WARN_KEY, strToBytes(String(warnThreshold || 0))); } catch (_) {} }
  async function loadThreshold() {
    try {
      const b = await ssget().getItem(WARN_KEY);
      const v = b ? Number(bytesToStr(b)) : 0;
      warnThreshold = isFinite(v) && v > 0 ? v : 0;
    } catch (_) { warnThreshold = 0; }
  }
  // Flux safety_tolerance — editable Settings value, persisted (same pattern).
  const FLUX_SAFETY_KEY = "kbanana.fluxSafety";
  async function saveFluxSafety() { try { await ssget().setItem(FLUX_SAFETY_KEY, strToBytes(String(cachedFluxSafety))); } catch (_) {} }
  async function loadFluxSafety() {
    try {
      const b = await ssget().getItem(FLUX_SAFETY_KEY);
      const s = b ? bytesToStr(b) : "";
      cachedFluxSafety = (s === "") ? 5 : clampFluxSafety(s);
    } catch (_) { cachedFluxSafety = 5; }
  }

  // ----- assign the forward-declared hooks (called from handleClick /
  //       handleChange, which were attached at the top of the IIFE) -----
  updateCostEstimate = _updateCostEstimate;

  onRateInput = function (el) {
    const modelId = el.getAttribute("data-rate-model");
    const key     = el.getAttribute("data-rate-key");
    if (!modelId || !key) return;
    const raw = (el.value || "").trim().replace(/^\$/, "");
    const v = Number(raw);
    if (!RATES[modelId]) RATES[modelId] = {};
    if (raw === "" || !isFinite(v) || v < 0) {
      // Blank / invalid → fall back to the default for that cell.
      const def = DEFAULT_RATES[modelId] && DEFAULT_RATES[modelId][key];
      RATES[modelId][key] = isFinite(Number(def)) ? Number(def) : 0;
      el.value = String(RATES[modelId][key]);
    } else {
      RATES[modelId][key] = v;
    }
    saveRates();
    _updateCostEstimate();
    updateSessionDisplay();
  };

  onThresholdInput = function (val) {
    const raw = (val || "").trim().replace(/^\$/, "");
    const v = Number(raw);
    warnThreshold = (raw !== "" && isFinite(v) && v > 0) ? v : 0;
    saveThreshold();
    updateSessionDisplay();
  };

  onFluxSafetyInput = function (val) {
    cachedFluxSafety = clampFluxSafety(val);
    const el = $("flux-safety-tolerance");
    if (el) el.value = String(cachedFluxSafety);   // reflect the clamped value
    saveFluxSafety();
  };

  function actResetSession() { resetSession(); }
  function actResetRates() {
    RATES = cloneRates(DEFAULT_RATES);
    saveRates();
    _rebuildRatesTable();
    _updateCostEstimate();
    updateSessionDisplay();
  }

  const EXTEND_MARGIN = 0.25;   // 25% of current canvas dim per extend side

  // -----------------------------------------------------------------------
  // EDIT_MODES — single source of truth for every edit type's behavior.
  //   group              "selection" | "whole"  — which area it lives in.
  //   display            label shown in pills / status / layer name.
  //   requiresSelection  true → block with "Make a selection first" if none.
  //   requiresPrompt     true → block with "This edit type needs a prompt."
  //   isExtend           true → canvas-resize before reading + frame mask.
  //   isWholeImage       true → ignore selection, no mask on result.
  //   dualMode           "recolor" → if selection present, switch to masked
  //                       (selection-recolor); else whole-image.
  //   passthroughPrompt  true → buildEditInstruction returns the user's
  //                       prompt as-is (whole-image presets — the preset
  //                       text IS the structured instruction).
  //
  // The empty key "" is the FREEFORM default — no preset clicked, no
  // selection mode picked. Pipeline runs whole-image and sends user's
  // typed instruction as-is. Restore / Background Replace etc. are no
  // longer dedicated modes — the user types them into the freeform box.
  // -----------------------------------------------------------------------
  const EDIT_MODES = {
    "":         { group: "whole",     display: "Edit",            requiresSelection: false, requiresPrompt: true,  isExtend: false, isWholeImage: true,  dualMode: null,      passthroughPrompt: true  },
    remove:     { group: "selection", display: "Remove",          requiresSelection: true,  requiresPrompt: false, isExtend: false, isWholeImage: false, dualMode: null,      passthroughPrompt: false },
    replace:    { group: "selection", display: "Replace",         requiresSelection: true,  requiresPrompt: true,  isExtend: false, isWholeImage: false, dualMode: null,      passthroughPrompt: false },
    add:        { group: "selection", display: "Add",             requiresSelection: true,  requiresPrompt: true,  isExtend: false, isWholeImage: false, dualMode: null,      passthroughPrompt: false },
    fill:       { group: "selection", display: "Generative Fill", requiresSelection: false, requiresPrompt: false, isExtend: false, isWholeImage: false, dualMode: null,      passthroughPrompt: false },
    extend:     { group: "selection", display: "Extend",          requiresSelection: false, requiresPrompt: false, isExtend: true,  isWholeImage: false, dualMode: null,      passthroughPrompt: false },
    lighting:   { group: "whole",     display: "Lighting",        requiresSelection: false, requiresPrompt: true,  isExtend: false, isWholeImage: true,  dualMode: null,      passthroughPrompt: true  },
    recolor:    { group: "whole",     display: "Recolor",         requiresSelection: false, requiresPrompt: true,  isExtend: false, isWholeImage: true,  dualMode: "recolor", passthroughPrompt: true  },
    style:      { group: "whole",     display: "Style",           requiresSelection: false, requiresPrompt: true,  isExtend: false, isWholeImage: true,  dualMode: null,      passthroughPrompt: true  },
  };

  // Preset instruction templates injected into the prompt textarea when a
  // whole-image pill is clicked. The user can edit / replace freely — the
  // pipeline sends the textarea content verbatim (passthroughPrompt).
  const PRESET_TEXTS = {
    lighting: "Relight the image: [describe the lighting, e.g. golden hour from the left]. Change lighting and shadows only; keep content and color.",
    recolor:  "Recolor: [describe the target color or palette]. Change color only; keep lighting, texture, and composition.",
    style:    "Restyle the image as: [describe the style, e.g. 1970s film stock]. Preserve composition and subject.",
  };

  // Effective mode after dualMode resolution. For Recolor: selection
  // present flips isWholeImage → false (mask pipeline); no selection stays
  // whole-image. Unknown edit type falls back to the freeform whole-image
  // default (EDIT_MODES[""]).
  function effectiveEditMode(editType, hasSelection) {
    const base = EDIT_MODES[editType] || EDIT_MODES[""];
    if (!base) return null;
    if (base.dualMode === "recolor" && hasSelection) {
      return {
        group: base.group, display: base.display,
        requiresSelection: false, requiresPrompt: base.requiresPrompt,
        isExtend: false, isWholeImage: false, dualMode: base.dualMode,
        passthroughPrompt: base.passthroughPrompt,
        recolorVariant: "selection",
      };
    }
    if (base.dualMode === "recolor" && !hasSelection) {
      return Object.assign({}, base, { recolorVariant: "whole" });
    }
    return base;
  }

  function $(id) { return document.getElementById(id); }

  // ----- pill builder -----
  // Rebuild a .pills container from a list of values. Preserves the current
  // selection if it's still valid for the new options; otherwise falls back
  // to the supplied default.
  function rebuildPills(containerId, values, fallbackDefault) {
    const $g = $(containerId);
    if (!$g) return;
    const oldSel = $g.querySelector(".pill.selected");
    const oldVal = oldSel ? oldSel.getAttribute("data-value") : null;
    const newSel = values.indexOf(oldVal) >= 0 ? oldVal : fallbackDefault;

    while ($g.firstChild) $g.removeChild($g.firstChild);
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      const pill = document.createElement("div");
      pill.className = "pill" + (v === newSel ? " selected" : "");
      pill.setAttribute("role", "button");
      pill.setAttribute("tabindex", "0");
      pill.setAttribute("data-value", v);
      pill.textContent = v;
      $g.appendChild(pill);
    }
  }

  // v0.06 — render the Model pill row from the MODELS registry. Every
  // entry's displayName becomes a pill; data-value is the model id.
  // Adding a new model (any provider) to the registry → it appears
  // here automatically with no HTML/CSS change.
  function rebuildModelPills(selectedId) {
    const $g = $("pills-model");
    if (!$g) return;
    while ($g.firstChild) $g.removeChild($g.firstChild);
    const ids = Object.keys(MODELS);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const m = MODELS[id];
      if (!m) continue;
      const pill = document.createElement("div");
      pill.className = "pill" + (id === selectedId ? " selected" : "");
      pill.setAttribute("role", "button");
      pill.setAttribute("tabindex", "0");
      pill.setAttribute("data-value", id);
      pill.textContent = m.displayName || id;
      $g.appendChild(pill);
    }
  }

  // ----- Model / Quantity DROPDOWNS (div-based; replace the pill rows) -----
  // Model options come from the SAME MODELS registry the pills read — a new
  // registry entry appears here automatically, no markup. Selecting an option
  // drives the exact same state the pills did (onModelChanged / cachedQuantity).
  function rebuildModelDropdown(selectedId) {
    const menu = $("dd-model-menu");
    if (!menu) return;
    while (menu.firstChild) menu.removeChild(menu.firstChild);
    const ids = Object.keys(MODELS);
    // v0.14 — direct engines first, then a LABELED Fal group so a Fal-routed
    // model is never blended in with the direct ones.
    const direct = ids.filter(function (id) { return MODELS[id] && MODELS[id].group !== "fal"; });
    const fal    = ids.filter(function (id) { return MODELS[id] && MODELS[id].group === "fal"; });
    const addOption = function (id) {
      const m = MODELS[id]; if (!m) return;
      const opt = document.createElement("div");
      opt.className = "dd-option" + (id === selectedId ? " selected" : "");
      opt.setAttribute("role", "option");
      opt.setAttribute("tabindex", "0");
      opt.setAttribute("data-dd-group", "model");
      opt.setAttribute("data-dd-value", id);
      opt.textContent = m.displayName || id;
      menu.appendChild(opt);
    };
    const addLabel = function (text) {
      const lab = document.createElement("div");
      lab.className = "dd-group-label";
      lab.textContent = text;
      menu.appendChild(lab);
    };
    direct.forEach(addOption);
    if (fal.length) {
      addLabel("Fal — LoRA / uncensored (aggregator, billed-cost)");
      fal.forEach(addOption);
    }
    setModelDropdownSelection(selectedId);
  }
  function setModelDropdownSelection(id) {
    const valEl = $("dd-model-value");
    const m = MODELS[id];
    if (valEl) valEl.textContent = (m && m.displayName) || id || "Model";
    const menu = $("dd-model-menu");
    if (menu) {
      const opts = menu.querySelectorAll(".dd-option");
      for (let i = 0; i < opts.length; i++) {
        opts[i].classList.toggle("selected", opts[i].getAttribute("data-dd-value") === id);
      }
    }
  }
  function setQuantityDropdown(n) {
    const q = Math.max(1, Math.min(4, Number(n) || 1));
    const valEl = $("dd-quantity-value");
    if (valEl) valEl.textContent = String(q);
    const menu = $("dd-quantity-menu");
    if (menu) {
      const opts = menu.querySelectorAll(".dd-option");
      for (let i = 0; i < opts.length; i++) {
        opts[i].classList.toggle("selected", Number(opts[i].getAttribute("data-dd-value")) === q);
      }
    }
  }
  function closeAllDropdowns(exceptMenuId) {
    const menus = document.querySelectorAll(".dd-menu");
    for (let i = 0; i < menus.length; i++) {
      if (exceptMenuId && menus[i].id === exceptMenuId) continue;
      menus[i].classList.add("hidden");
    }
  }
  function toggleDropdown(name) {
    const menu = $("dd-" + name + "-menu");
    if (!menu) return;
    const willOpen = menu.classList.contains("hidden");
    closeAllDropdowns(menu.id);
    menu.classList.toggle("hidden", !willOpen);
  }

  // ----- reference image helpers -----
  function detectMime(filename) {
    const idx = filename.lastIndexOf(".");
    if (idx < 0) return null;
    const ext = filename.slice(idx + 1).toLowerCase();
    const map = {
      png: "image/png",
      jpg: "image/jpeg", jpeg: "image/jpeg",
      webp: "image/webp",
      heic: "image/heic",
      heif: "image/heif",
    };
    return map[ext] || null;
  }

  function arrayBufferToBase64(buf) {
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      const end = Math.min(i + chunk, bytes.length);
      binary += String.fromCharCode.apply(null, bytes.subarray(i, end));
    }
    return btoa(binary);
  }

  function renderRefThumbs() {
    const $row = $("ref-thumbs");
    if (!$row) return;
    while ($row.firstChild) $row.removeChild($row.firstChild);
    for (let i = 0; i < refImages.length; i++) {
      const ref = refImages[i];
      const wrap = document.createElement("div");
      wrap.className = "ref-thumb";
      wrap.setAttribute("title", ref.name);

      const img = document.createElement("img");
      img.src = ref.dataUrl;
      img.alt = ref.name;

      const del = document.createElement("div");
      del.className = "ref-delete";
      del.setAttribute("role", "button");
      del.setAttribute("tabindex", "0");
      del.setAttribute("data-action", "delete-ref");
      del.setAttribute("data-index", String(i));
      del.textContent = "×";

      wrap.appendChild(img);
      wrap.appendChild(del);
      $row.appendChild(wrap);
    }
  }

  function updateRefAddState() {
    const $add = $("ref-add");
    const $hint = $("ref-hint");
    const model = MODELS[cachedModelId] || MODELS[DEFAULT_MODEL_ID];
    const max = model.maxRefImages;
    const n = refImages.length;
    if ($add) {
      if (n >= max) $add.classList.add("disabled");
      else          $add.classList.remove("disabled");
    }
    if ($hint) {
      $hint.textContent = (n >= max)
        ? "Max " + max + " references for " + model.displayName
        : n + "/" + max + " references";
    }
  }

  function readPills(groupId, fallback) {
    const g = $(groupId);
    if (!g) return fallback;
    const sel = g.querySelector(".pill.selected");
    return (sel && sel.getAttribute("data-value")) || fallback;
  }
  function setStatus(kind, text) {
    // Mirror to both status lines: #generate-status lives in the shared form
    // (workflow tabs); #upscale-status lives in the Upscale tab. Only the
    // visible one is seen, so writing both keeps upscale feedback on-screen
    // even though the shared form is hidden on the Upscale tab (v0.08.1 step 3).
    const ids = ["generate-status", "upscale-status"];
    for (let i = 0; i < ids.length; i++) {
      const s = $(ids[i]);
      if (s) { s.textContent = text; s.className = "status " + kind; }
    }
  }
  function setConn(state, label) {
    const dot = $("conn-dot"); const lbl = $("conn-label");
    if (dot) dot.className = "dot dot-" + state;
    if (lbl) lbl.textContent = label;
  }
  function refreshGenerateEnabled() {
    const btn = $("generate-btn"); const status = $("generate-status");
    if (!btn || !status) return;
    // v0.06 — enabled when the ACTIVE model's provider key is saved.
    // Switching models can flip this (e.g. NB2 saved but no OpenAI key →
    // selecting GPT disables Generate with a clear status hint).
    const haveKey = !!activeApiKey();
    if (haveKey) {
      btn.classList.remove("disabled");
      if (status.classList.contains("muted")) status.textContent = "Ready.";
    } else {
      // Key-optional: dormant model → Generate disabled with a clean message;
      // no network call, never throws.
      btn.classList.add("disabled");
      const p = activeProvider();
      const label = p === "openai" ? "OpenAI" : p === "bfl" ? "Black Forest Labs"
                  : p === "fal" ? "Fal" : "Google AI Studio";
      status.textContent = "Add the " + label + " API key in Settings to use this model.";
      status.className = "status muted";
    }
  }

  async function actSaveKey() {
    const $key = $("api-key");
    const v = (($key && $key.value) || "").trim();
    if (!v) { setConn("bad", "empty key"); return; }
    try {
      await saveKey(v);
      cachedKey = v;
      setConn("unknown", "saved — test to verify");
      refreshGenerateEnabled();
    } catch (err) {
      try { console.error(TAG, "saveKey failed:", err); } catch (_) {}
      setConn("bad", (err && err.message) || "save failed");
    }
  }
  async function actTestKey() {
    const $key = $("api-key");
    const v = (($key && $key.value) || "").trim();
    if (!v) { setConn("bad", "empty key"); return; }
    setConn("busy", "testing…");
    const result = await testConnection(v);
    try { console.log(TAG, "testConnection result:", result); } catch (_) {}
    if (result.ok) {
      setConn("ok", "connected");
      try { await saveKey(v); } catch (_) {}
      cachedKey = v;
      refreshGenerateEnabled();
      showViewByClass("generate");
    } else {
      setConn("bad", result.message);
    }
  }
  function actShowKey() {
    const $key = $("api-key"); const $btn = $("show-key");
    if (!$key || !$btn) return;
    const isPwd = $key.type === "password";
    $key.type = isPwd ? "text" : "password";
    $btn.textContent = isPwd ? "Hide" : "Show";
  }
  async function actOpenKeyPage() {
    try { await shellMod().openExternal("https://aistudio.google.com/apikey"); }
    catch (err) { try { console.error(TAG, "openExternal failed:", err); } catch (_) {} }
  }

  // ----- v0.06 OpenAI Settings actions -----

  async function actSaveOpenAIKey() {
    const $key = $("openai-api-key");
    const v = (($key && $key.value) || "").trim();
    if (!v) { setConnOpenAI("bad", "empty key"); return; }
    try {
      await saveOpenAIKey(v);
      cachedOpenAIKey = v;
      setConnOpenAI("unknown", "saved — test to verify");
      refreshGenerateEnabled();
    } catch (err) {
      try { console.error(TAG, "saveOpenAIKey failed:", err); } catch (_) {}
      setConnOpenAI("bad", (err && err.message) || "save failed");
    }
  }
  async function actTestOpenAIKey() {
    const $key = $("openai-api-key");
    const v = (($key && $key.value) || "").trim();
    if (!v) { setConnOpenAI("bad", "empty key"); return; }
    setConnOpenAI("busy", "testing…");
    const result = await testConnectionOpenAI(v);
    try { console.log(TAG, "testConnectionOpenAI result:", result); } catch (_) {}
    if (result.ok) {
      setConnOpenAI("ok", "connected");
      try { await saveOpenAIKey(v); } catch (_) {}
      cachedOpenAIKey = v;
      refreshGenerateEnabled();
    } else {
      setConnOpenAI("bad", result.message);
    }
  }
  function actShowOpenAIKey() {
    const $key = $("openai-api-key"); const $btn = $("show-openai-key");
    if (!$key || !$btn) return;
    const isPwd = $key.type === "password";
    $key.type = isPwd ? "text" : "password";
    $btn.textContent = isPwd ? "Hide" : "Show";
  }
  async function actOpenOpenAIKeyPage() {
    try { await shellMod().openExternal("https://platform.openai.com/api-keys"); }
    catch (err) { try { console.error(TAG, "openExternal failed:", err); } catch (_) {} }
  }
  function setConnOpenAI(state, label) {
    const $dot = $("openai-conn-dot"); const $lbl = $("openai-conn-label");
    if ($dot) $dot.className = "dot dot-" + state;
    if ($lbl) $lbl.textContent = label;
  }

  // ----- v0.07 Topaz Settings actions -----

  async function actSaveTopazKey() {
    const $key = $("topaz-api-key");
    const v = (($key && $key.value) || "").trim();
    if (!v) { setConnTopaz("bad", "empty key"); return; }
    try {
      await saveTopazKey(v);
      cachedTopazKey = v;
      setConnTopaz("unknown", "saved — test to verify");
      refreshUpscaleEnabled();
    } catch (err) {
      try { console.error(TAG, "saveTopazKey failed:", err); } catch (_) {}
      setConnTopaz("bad", (err && err.message) || "save failed");
    }
  }
  async function actTestTopazKey() {
    const $key = $("topaz-api-key");
    const v = (($key && $key.value) || "").trim();
    if (!v) { setConnTopaz("bad", "empty key"); return; }
    setConnTopaz("busy", "testing…");
    const result = await testConnectionTopaz(v);
    try { console.log(TAG, "testConnectionTopaz result:", result); } catch (_) {}
    if (result.ok) {
      setConnTopaz("ok", "connected");
      try { await saveTopazKey(v); } catch (_) {}
      cachedTopazKey = v;
      refreshUpscaleEnabled();
    } else {
      setConnTopaz("bad", result.message);
    }
  }
  function actShowTopazKey() {
    const $key = $("topaz-api-key"); const $btn = $("show-topaz-key");
    if (!$key || !$btn) return;
    const isPwd = $key.type === "password";
    $key.type = isPwd ? "text" : "password";
    $btn.textContent = isPwd ? "Hide" : "Show";
  }
  async function actOpenTopazKeyPage() {
    try { await shellMod().openExternal("https://developer.topazlabs.com/"); }
    catch (err) { try { console.error(TAG, "openExternal failed:", err); } catch (_) {} }
  }
  function setConnTopaz(state, label) {
    const $dot = $("topaz-conn-dot"); const $lbl = $("topaz-conn-label");
    if ($dot) $dot.className = "dot dot-" + state;
    if ($lbl) $lbl.textContent = label;
  }

  // ----- v0.12 BFL (Flux) key handlers -----
  async function actSaveBflKey() {
    const $key = $("bfl-api-key");
    const v = (($key && $key.value) || "").trim();
    if (!v) { setConnBfl("bad", "empty key"); return; }
    try {
      await saveBflKey(v); cachedBflKey = v;
      setConnBfl("unknown", "saved — generate to verify");
      refreshGenerateEnabled();
    } catch (err) { setConnBfl("bad", (err && err.message) || "save failed"); }
  }
  async function actTestBflKey() {
    const $key = $("bfl-api-key");
    const v = (($key && $key.value) || "").trim();
    if (!v) { setConnBfl("bad", "empty key"); return; }
    setConnBfl("busy", "saving…");
    const result = await testConnectionFlux(v);
    if (result.ok) { try { await saveBflKey(v); } catch (_) {} cachedBflKey = v; setConnBfl("unknown", result.message); refreshGenerateEnabled(); }
    else setConnBfl("bad", result.message);
  }
  function actShowBflKey() {
    const $key = $("bfl-api-key"); const $btn = $("show-bfl-key");
    if (!$key || !$btn) return;
    const isPwd = $key.type === "password";
    $key.type = isPwd ? "text" : "password";
    $btn.textContent = isPwd ? "Hide" : "Show";
  }
  async function actOpenBflKeyPage() {
    try { await shellMod().openExternal("https://docs.bfl.ai/"); } catch (_) {}
  }
  function setConnBfl(state, label) {
    const $dot = $("bfl-conn-dot"); const $lbl = $("bfl-conn-label");
    if ($dot) $dot.className = "dot dot-" + state;
    if ($lbl) $lbl.textContent = label;
  }

  // ----- v0.12 ClarityAI key handlers -----
  async function actSaveClarityKey() {
    const $key = $("clarity-api-key");
    const v = (($key && $key.value) || "").trim();
    if (!v) { setConnClarity("bad", "empty key"); return; }
    try {
      await saveClarityKey(v); cachedClarityKey = v;
      setConnClarity("unknown", "saved — upscale to verify");
      refreshUpscaleEnabled();
    } catch (err) { setConnClarity("bad", (err && err.message) || "save failed"); }
  }
  async function actTestClarityKey() {
    const $key = $("clarity-api-key");
    const v = (($key && $key.value) || "").trim();
    if (!v) { setConnClarity("bad", "empty key"); return; }
    setConnClarity("busy", "saving…");
    const result = await testConnectionClarity(v);
    if (result.ok) { try { await saveClarityKey(v); } catch (_) {} cachedClarityKey = v; setConnClarity("unknown", result.message); refreshUpscaleEnabled(); }
    else setConnClarity("bad", result.message);
  }
  function actShowClarityKey() {
    const $key = $("clarity-api-key"); const $btn = $("show-clarity-key");
    if (!$key || !$btn) return;
    const isPwd = $key.type === "password";
    $key.type = isPwd ? "text" : "password";
    $btn.textContent = isPwd ? "Hide" : "Show";
  }
  async function actOpenClarityKeyPage() {
    try { await shellMod().openExternal("https://clarityai.co/"); } catch (_) {}
  }
  function setConnClarity(state, label) {
    const $dot = $("clarity-conn-dot"); const $lbl = $("clarity-conn-label");
    if ($dot) $dot.className = "dot dot-" + state;
    if ($lbl) $lbl.textContent = label;
  }

  // ----- v0.14 Fal key handlers (one key for all Fal-lane models) -----
  async function actSaveFalKey() {
    const $key = $("fal-api-key");
    const v = (($key && $key.value) || "").trim();
    if (!v) { setConnFal("bad", "empty key"); return; }
    try {
      await saveFalKey(v); cachedFalKey = v;
      setConnFal("unknown", "saved — generate to verify");
      refreshGenerateEnabled();
    } catch (err) { setConnFal("bad", (err && err.message) || "save failed"); }
  }
  async function actTestFalKey() {
    const $key = $("fal-api-key");
    const v = (($key && $key.value) || "").trim();
    if (!v) { setConnFal("bad", "empty key"); return; }
    setConnFal("busy", "saving…");
    const result = await testConnectionFal(v);
    if (result.ok) { try { await saveFalKey(v); } catch (_) {} cachedFalKey = v; setConnFal("unknown", result.message); refreshGenerateEnabled(); }
    else setConnFal("bad", result.message);
  }
  function actShowFalKey() {
    const $key = $("fal-api-key"); const $btn = $("show-fal-key");
    if (!$key || !$btn) return;
    const isPwd = $key.type === "password";
    $key.type = isPwd ? "text" : "password";
    $btn.textContent = isPwd ? "Hide" : "Show";
  }
  async function actOpenFalKeyPage() {
    try { await shellMod().openExternal("https://fal.ai/dashboard/keys"); } catch (_) {}
  }
  function setConnFal(state, label) {
    const $dot = $("fal-conn-dot"); const $lbl = $("fal-conn-label");
    if ($dot) $dot.className = "dot dot-" + state;
    if ($lbl) $lbl.textContent = label;
  }

  function refreshUpscaleEnabled() {
    const btn = $("upscale-btn");
    if (!btn) return;
    // Key-optional per selected upscaler provider.
    const haveKey = (cachedUpscaleProvider === "clarity") ? !!cachedClarityKey : !!cachedTopazKey;
    if (haveKey) btn.classList.remove("disabled");
    else         btn.classList.add("disabled");
    // Clarity creativity control shows only when Clarity is the provider.
    const cf = $("clarity-creativity-field");
    if (cf) cf.classList.toggle("hidden", cachedUpscaleProvider !== "clarity");
  }

  // v0.07 — Upscale (Topaz) handler.
  // Reads the active layer pixels, runs Topaz async enhance (submit →
  // poll → download), places enhanced bytes as a plain layer above the
  // source. No mask, no compositing tricks — Topaz returns a finished
  // image.
  async function actUpscaleTopaz() {
    // Key-optional per selected upscaler provider.
    const _upProvider = cachedUpscaleProvider === "clarity" ? "clarity" : "topaz";
    if (_upProvider === "clarity" && !cachedClarityKey) {
      setStatus("bad", "Add the ClarityAI API key in Settings to use Clarity.");
      return;
    }
    if (_upProvider === "topaz" && !cachedTopazKey) {
      setStatus("bad", "Add the Topaz API key in Settings to use Topaz.");
      return;
    }
    if (generateInFlight) return;
    const ps = psMod();
    if (!ps.app.activeDocument) {
      setStatus("bad", "Open a Photoshop document first.");
      return;
    }
    const $btn = $("upscale-btn");
    if ($btn) $btn.classList.add("disabled");

    generateInFlight = true;
    try {
      // Recall-wrapped (single preview). The recall bar on the Upscale tab
      // (a second .recall-bar) drives Accept / Re-run; executeUpscale does the
      // read→Topaz→place and adds the megapixel cost per run.
      let srcRef = null, _targetLayerId = null;
      try {
        const doc = ps.app.activeDocument;
        const al = doc && doc.activeLayers && doc.activeLayers[0];
        if (al && typeof al.id !== "undefined") _targetLayerId = al.id;
        srcRef = (cachedUpscaleSource === "active-layer")
          ? ("active-layer:" + (_targetLayerId != null ? _targetLayerId : "?"))
          : "composite";
      } catch (_) {}
      await runWithRecall({
        op: "upscale:" + _upProvider,
        params: upscaleParamsFromForm(),
        targetLayerId: _targetLayerId,
        sourceRef: srcRef,
        paramsProvider: upscaleParamsFromForm,
        execute: executeUpscale,
      });
      setStatus("ok", "Preview ready — Accept to keep or Re-run.");
    } catch (err) {
      try { console.error(TAG, "topaz upscale failed:", err); } catch (_) {}
      setStatus("bad", (err && err.message) || "upscale failed");
    } finally {
      generateInFlight = false;
      try { updateDocInfo(); } catch (_) {}   // v0.13 — refresh readout/flag after upscale
      refreshUpscaleEnabled();
    }
  }
  // -----------------------------------------------------------------------
  // Instruction templates.
  //
  // Selection-edit types wrap the user's prompt with structured language
  // ("Remove the selected content…", etc.) because the user only types a
  // hint, not a full instruction.
  //
  // Whole-image preset types (Lighting / Recolor / Style) and the empty
  // freeform type are passthrough — the user's prompt already IS the full
  // instruction (the preset pre-fills the textarea with structured text
  // that the user then customizes). We don't double-wrap.
  // -----------------------------------------------------------------------
  function buildEditInstruction(editType, userPrompt, mode) {
    const p = (userPrompt || "").trim();
    const cfg = EDIT_MODES[editType] || EDIT_MODES[""];
    if (cfg && cfg.passthroughPrompt) return p;

    switch (editType) {
      // ----- Group 1: selection edits (template-wrapped) -----
      case "remove":
        return "Remove the selected content and reconstruct the area to match the surrounding scene."
          + (p ? " Hint: " + p : "");
      case "replace":
        return "Replace the selected region with: " + (p || "(unspecified)")
          + ", matching scene lighting and perspective.";
      case "add":
        return "Add " + (p || "the described element")
          + " into the selected region, matching the scene.";
      case "fill":
        return "Fill the selected region to seamlessly match the surrounding image"
          + (p ? ": " + p : ".");
      case "extend":
        return "Extend and continue the scene naturally into the new area,"
          + " matching lighting, perspective, and content style."
          + (p ? " Hint: " + p : "");
      default:
        return p;
    }
  }

  function timestampForLayerName() {
    const d = new Date();
    const pad = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate())
      + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  // Layer name format:
  //   single result:  "{ModelDisplayName} {Mode} {YYYY-MM-DD HH:MM}"
  //   N>1 batch:      "{ModelDisplayName} {Mode} {ts} ({i} of {N})"
  function buildLayerName(editType, index, total) {
    const model = MODELS[cachedModelId] || MODELS[DEFAULT_MODEL_ID];
    const cfg = EDIT_MODES[editType];
    const modeName = (cfg && cfg.display) || editType;
    return buildBatchLayerName(modeName, index, total, model);
  }

  // Same format but with an explicit type label (e.g. "Generate" for the
  // fresh-generate path which doesn't go through EDIT_MODES).
  function buildBatchLayerName(typeDisplay, index, total, modelOverride) {
    const model = modelOverride || MODELS[cachedModelId] || MODELS[DEFAULT_MODEL_ID];
    const modelName = (model && model.displayName) || "KBImage";
    let name = modelName + " " + typeDisplay + " " + timestampForLayerName();
    if (total && total > 1) name += " (" + index + " of " + total + ")";
    return name;
  }


  // -----------------------------------------------------------------------
  // Edit pipeline. Reads doc composite, sends to Gemini with the built
  // instruction, places result as a new (optionally masked) layer.
  //
  // Read strategy:
  //   - Capture selection bounds from the DOM BEFORE entering executeAsModal
  //     (DOM-read access doesn't need modal). Validate width/height > 0.
  //   - For selection-required edit types (Remove / Replace / Add): fail
  //     fast with "Make a selection first" if no selection.
  //   - Inside modal: optionally do canvas-extend; then call
  //     imaging.getPixels with EXPLICIT document bounds — never empty.
  //   - No channel duplicate / delete. No helper layers.
  //
  // Mask strategy (post-network):
  //   - Re-create a rectangular selection from the captured bounds.
  //   - addLayerMaskRevealSelection on the placed layer.
  //   - Arbitrary-shape selections are reduced to their bounding rect in
  //     this version (known trade-off — documented in CLAUDE.md).
  // -----------------------------------------------------------------------
  async function runEditPipeline(editType, userPrompt, quantity, pipeOpts) {
    pipeOpts = pipeOpts || {};
    // recallWrapped: the caller is driving this op through the recall wrapper.
    // When true we DON'T finalize (delete) the temp selection channel during
    // placement — it's kept alive across the preview so a Re-run can reload
    // the same selection shape; cleanup happens on accept/abandon (onSettle).
    const recallWrapped = !!pipeOpts.recallWrapped;
    const ps = psMod();
    const doc = ps.app.activeDocument;
    if (!doc) throw new Error("Open a Photoshop document first.");

    // ----- Read selection bounds from DOM (no modal required for reads) ----
    let userSelBounds = null;
    try {
      const sel = doc.selection;
      if (sel && sel.bounds) {
        const b = sel.bounds;
        const left   = Number(b.left)   || 0;
        const top    = Number(b.top)    || 0;
        const right  = Number(b.right)  || 0;
        const bottom = Number(b.bottom) || 0;
        const w = right - left;
        const h = bottom - top;
        if (w > 0 && h > 0) {
          userSelBounds = { left: left, top: top, right: right, bottom: bottom };
        }
        try { console.log(TAG, "selection.bounds:", JSON.stringify({left,top,right,bottom,w,h})); } catch (_) {}
      } else {
        try { console.log(TAG, "no selection."); } catch (_) {}
      }
    } catch (e) {
      try { console.warn(TAG, "reading selection bounds failed:", e); } catch (_) {}
    }

    // Resolve effective mode (handles Recolor dual: with selection →
    // selection-recolor; without → whole-image recolor).
    const mode = effectiveEditMode(editType, !!userSelBounds);
    if (!mode) throw new Error("Unknown edit type: " + editType);
    try { console.log(TAG, "effective mode:", editType, mode); } catch (_) {}

    // Whole-image edits ignore any selection (and the brief asks for clean
    // behavior, not a warning that would interrupt the flow).
    if (mode.isWholeImage) userSelBounds = null;

    // Selection-required check (after dual-mode resolution).
    if (mode.requiresSelection && !userSelBounds) {
      throw new Error("Make a selection first.");
    }

    // ----- PRE: optional canvas-extend + read composite -----
    let sourcePng = null;
    let maskSpec = null;     // { kind, rect | oldRect | channelName } or null
    let extendOldRect = null;

    // v0.10 — shape-accurate Select-tab mask. For a Select-tab selection
    // edit (not Extend, not whole-image) we save the user's REAL selection
    // to a temp alpha channel NOW, while it's still live, so the mask can
    // later be rebuilt from its true shape (not a bounding box). Falls back
    // to the bounding-rect mask if the host can't save the selection.
    const SEL_CHANNEL = "kb_sel_tmp";
    const wantSelMask =
      (activeTab === "select" && !!userSelBounds && !mode.isExtend && !mode.isWholeImage);
    let savedSelChannel = false;
    // Source/base dimensions captured AT REQUEST TIME (post-extend for
    // Extend mode). Threaded into generateImage so Match Input resolves
    // against the actual base, not the reference or NB's default.
    let baseW = Math.round(doc.width);
    let baseH = Math.round(doc.height);

    await ps.core.executeAsModal(async function () {
      // v0.10 — capture the TRUE selection shape FIRST, before any step can
      // clear it. Saved to a temp alpha channel; reloaded at mask time.
      if (wantSelMask) {
        // Clear a stale temp channel from a prior interrupted run, but only
        // if one actually exists (deleting a missing channel is itself an
        // error). Fully guarded — never surfaces.
        try {
          if (await channelExistsByName(SEL_CHANNEL)) {
            await deleteChannelByName(SEL_CHANNEL);
          }
        } catch (_) {}
        try {
          await saveSelectionToChannel(SEL_CHANNEL);
          savedSelChannel = true;
        } catch (e) {
          try { console.warn(TAG, "save selection→channel failed; rect-mask fallback:", e); } catch (_) {}
        }
      }

      if (mode.isExtend) {
        // Resize canvas in the chosen direction(s). The OLD content rect
        // is recorded so we can mask the new layer to the new frame area.
        const w = baseW;
        const h = baseH;
        const dW = (cachedExtendDir === "all" || cachedExtendDir === "left" || cachedExtendDir === "right")
          ? Math.round(w * EXTEND_MARGIN) : 0;
        const dH = (cachedExtendDir === "all" || cachedExtendDir === "top"  || cachedExtendDir === "bottom")
          ? Math.round(h * EXTEND_MARGIN) : 0;

        let totalW = w, totalH = h, anchorH = "center", anchorV = "center";
        let oldLeft = 0, oldTop = 0;
        if (cachedExtendDir === "all") {
          totalW = w + 2 * dW; totalH = h + 2 * dH; oldLeft = dW; oldTop = dH;
        } else if (cachedExtendDir === "left") {
          totalW = w + dW; oldLeft = dW; anchorH = "right";
        } else if (cachedExtendDir === "right") {
          totalW = w + dW; anchorH = "left";
        } else if (cachedExtendDir === "top") {
          totalH = h + dH; oldTop = dH; anchorV = "bottom";
        } else if (cachedExtendDir === "bottom") {
          totalH = h + dH; anchorV = "top";
        }
        await canvasResize(totalW, totalH, anchorH, anchorV);
        extendOldRect = { left: oldLeft, top: oldTop, right: oldLeft + w, bottom: oldTop + h };
        // After extend, the document is the new larger size — that's the
        // base we want NB to return at.
        baseW = totalW;
        baseH = totalH;
      }

      // Read the document composite via imaging — explicit bounds avoid
      // the "invalid empty image region" crash; applyAlpha:true flattens
      // transparency so the encoder doesn't reject RGBA.
      sourcePng = await readDocCompositeAsImage();
    }, { commandName: "KBImage — read for edit" });

    if (!sourcePng || !sourcePng.base64 || sourcePng.base64.length === 0) {
      throw new Error("Read returned empty pixels.");
    }

    // Build the mask spec for the post-network compositing step.
    // Whole-image edits → no mask (mode.isWholeImage). Selection edits →
    // rect mask. Extend → frame mask.
    if (mode.isExtend) {
      if (extendOldRect) maskSpec = { kind: "frame", oldRect: extendOldRect };
    } else if (userSelBounds && !mode.isWholeImage) {
      // v0.10 — prefer the shape-accurate channel mask; keep bounds for
      // placement + GPT's (rect-only) API mask + verification expected-area.
      maskSpec = savedSelChannel
        ? { kind: "channel", channelName: SEL_CHANNEL, rect: userSelBounds }
        : { kind: "rect", rect: userSelBounds };
    }

    // ----- NETWORK call (outside modal) -----
    const instruction = buildEditInstruction(editType, userPrompt, mode);
    const opts = {
      modelId: cachedModelId || DEFAULT_MODEL_ID,
      prompt: instruction,
      sourceImage: sourcePng,
      refImages: refImages,
      // Base dims (post-extend for Extend) — generateImage uses these to
      // snap aspect to the base's nearest supported ratio.
      sourceWidth: baseW,
      sourceHeight: baseH,
      // aspectMode rule:
      //   Extend → user is deliberately reshaping the canvas; pill wins.
      //   Anything else (selection or whole-image) → base dictates,
      //   pill ignored (composite-back rule).
      aspectMode: mode.isExtend ? "extend" : "edit",
    };
    const imageSize    = readPills("pills-resolution", defaultResFor(opts.modelId));
    const aspectChoice = readPills("pills-aspect",     defaultAspectFor(opts.modelId));
    opts.imageSize = imageSize;
    opts.aspectRatio = aspectChoice;

    // Batch: N sequential generateContent calls reusing the SAME source
    // (read once above). Each result places as its own layer named
    // "{model} {mode} {timestamp} (i of N)". The mask spec is fixed for
    // the batch — every result clips to the same selection / extended frame.
    // v0.06 mask routing — confirmed via isolation tests:
    //   • GPT/openai + maskSpec → send API mask; place a plain layer
    //     (server-side confines the change to the masked region).
    //   • NB/gemini + rect maskSpec (Remove/Replace/Add/Fill/RefInpaint)
    //     → place a PLAIN layer, NO client-side mask. NB's edit output
    //     preserves the surrounding scene, so the visible result IS the
    //     edit in the right location; the v0.05 reveal-selection mask
    //     was just hiding it.
    //   • NB/gemini + frame maskSpec (Extend) → keep the client-side
    //     frame mask. Extend reshapes the canvas, and the frame mask is
    //     the cleanest way to reveal only the new perimeter on NB.
    //
    // v0.10 — EDITABLE, SHAPE-ACCURATE SELECTION MASK (Select tab only).
    // For Select-tab selection edits (Remove/Replace/Add/Generative Fill)
    // we place the result on a layer carrying an EDITABLE layer mask built
    // from the user's REAL selection shape (reloaded from the alpha channel
    // saved up-front) via native revealSelection — white in the true shape,
    // black elsewhere, LEFT UNAPPLIED so the designer can paint/feather it.
    // "AI proposes, designer disposes." The layer's PIXELS are the model
    // output only; nothing is stamped onto them. Applied UNIFORMLY for NB
    // and GPT (it's a client-side PS layer mask, not an API mask).
    //
    // GPT also gets a server-side API mask to confine the change — but GPT's
    // API mask has no shape channel, so it's built from the BOUNDING RECT
    // (opts.maskSpec below is rect even when the client mask is shape-
    // accurate). The visible/editable PS mask is still shape-accurate.
    //
    // Scope is strictly the Select tab: Edit-tab Recolor-with-selection
    // (also a rect maskSpec) stays plain-layer, and Extend keeps its frame
    // mask.
    const _provider = (MODELS[opts.modelId] || MODELS[DEFAULT_MODEL_ID]).provider || "gemini";
    const _useApiMask = (_provider === "openai" && !!maskSpec);
    if (_useApiMask) {
      // GPT's server-side mask is rect-only — approximate the shape mask
      // with its bounding box for the API while the PS layer mask stays
      // shape-accurate.
      opts.maskSpec = (maskSpec.kind === "channel" && maskSpec.rect)
        ? { kind: "rect", rect: maskSpec.rect }
        : maskSpec;
      opts.maskDoc  = { width: baseW, height: baseH };
    }
    const _isSelectTabMask =
      (activeTab === "select" && maskSpec &&
       (maskSpec.kind === "channel" || maskSpec.kind === "rect"));
    // _clientMaskSpec → the editable PS layer mask placeBase64AsEditedLayer
    // should build. v0.10: Select-tab selection edits opt IN (channel =
    // shape-accurate, rect = bounding-box fallback when the channel save
    // wasn't available). Otherwise: Extend's frame mask stays; else null.
    const _clientMaskSpec = _isSelectTabMask
      ? maskSpec
      : ((_useApiMask || !maskSpec || maskSpec.kind === "rect" || maskSpec.kind === "channel")
          ? null
          : maskSpec);

    const N = Math.max(1, Math.min(4, Number(quantity) || 1));
    const placedLayerIds = [];
    let afterRef = null;
    for (let i = 1; i <= N; i++) {
      setStatus("busy",
        (N > 1 ? "Editing " + i + " of " + N : "Editing")
        + (refImages.length ? (" with " + refImages.length + " ref" + (refImages.length===1?"":"s")) : "")
        + "…");
      const img = await generateImage(activeApiKey(), opts);
      setStatus("busy", N > 1
        ? "Placing layer " + i + " of " + N + "…"
        : "Placing layer…");
      const layerName = buildLayerName(editType, i, N);
      // v0.10 — the LAST item deletes the temp selection channel from inside
      // its own placement modal (proper state → no "Delete unavailable"
      // dialog). Earlier items keep it so they can reload the shape. If the
      // loop errors before the last item, the stale channel is harmless and
      // the next run's start-of-run guarded pre-delete clears it.
      // FOUNDATION — under the recall wrapper the channel is NEVER finalized
      // here (kept alive for Re-run); onSettle cleans it up on accept/abandon.
      const finalize = recallWrapped ? false : (i === N);
      const layerID = await placeBase64AsEditedLayer(img.base64, _clientMaskSpec, layerName, finalize);
      if (layerID != null) placedLayerIds.push(layerID);
      if (lastPlacedFileRef) afterRef = lastPlacedFileRef;   // reference the file already written
    }
    // Return preview state for the recall wrapper. selChannel/selBounds let a
    // Re-run restore the same selection so the edit re-applies to the same
    // region; null for whole-image edits (no selection dependency).
    return {
      layerIds: placedLayerIds,
      afterSnapshotRef: afterRef,
      selChannel: savedSelChannel ? SEL_CHANNEL : null,
      selBounds: userSelBounds || null,
    };
  }

  // =======================================================================
  // v0.05 — COMPOSE TAB. Three operations. Each reuses the shared
  // request builder (generateImage) and the existing place pipelines.
  // No fork of the engine — only the framing flag, the source-read
  // choice, and the layer-name prefix differ per op.
  // =======================================================================

  // OP 1 — Reference Gen: text + refs (refgen-labeled). No source layer
  // read; the model holds the reference subject in a new image. Quantity
  // honored.
  async function runComposeRefGen(userPrompt, quantity) {
    if (!userPrompt || !userPrompt.trim()) {
      throw new Error("Describe the new image to generate.");
    }
    if (!refImages || refImages.length === 0) {
      throw new Error("Add at least one reference image (uploader below).");
    }
    const modelId = cachedModelId || DEFAULT_MODEL_ID;
    const imageSize    = readPills("pills-resolution", defaultResFor(modelId));
    const aspectChoice = readPills("pills-aspect",     defaultAspectFor(modelId));
    const opts = {
      modelId: modelId,
      prompt: userPrompt,
      refImages: refImages,
      imageSize: imageSize,
      aspectRatio: aspectChoice,
      aspectMode: "generate",     // pill is authoritative
      composeRefGen: true,        // refs-only labeled framing in builder
    };
    // Match Input → feed doc dims when available.
    try {
      const doc = psMod().app.activeDocument;
      if (doc && doc.width > 0 && doc.height > 0) {
        opts.sourceWidth = doc.width;
        opts.sourceHeight = doc.height;
      }
    } catch (_) {}

    const N = Math.max(1, Math.min(4, Number(quantity) || 1));
    const layerIds = [];
    let afterRef = null;
    for (let i = 1; i <= N; i++) {
      setStatus("busy", "Generating " + i + " of " + N
        + " (Reference Gen, " + refImages.length + " ref"
        + (refImages.length === 1 ? "" : "s") + ")…");
      const img = await generateImage(activeApiKey(), opts);
      setStatus("busy", "Placing layer " + i + " of " + N + "…");
      const layerName = buildBatchLayerName("Compose-RefGen", i, N);
      const lid = await placeBase64AsLayer(img.base64, layerName);
      if (lid != null) layerIds.push(lid);
      if (lastPlacedFileRef) afterRef = lastPlacedFileRef;
    }
    return { layerIds: layerIds, afterSnapshotRef: afterRef };
  }

  // OP 2 — Fuse: read the flattened composite as the base image, send
  // the fixed unification instruction. Always 3 results (3× cost). Refs
  // (if any) ride along as additional context.
  async function runComposeFuse(userPromptHint /*, ignored quantity */) {
    const ps = psMod();
    const doc = ps.app.activeDocument;
    if (!doc) throw new Error("Open a Photoshop document first.");

    const baseW = Math.round(doc.width);
    const baseH = Math.round(doc.height);
    if (!(baseW > 0 && baseH > 0)) {
      throw new Error("Document has zero area.");
    }

    let sourcePng = null;
    await ps.core.executeAsModal(async function () {
      sourcePng = await readDocCompositeAsImage();
    }, { commandName: "KBImage — Fuse read" });

    if (!sourcePng || !sourcePng.base64 || sourcePng.base64.length === 0) {
      throw new Error("Read returned empty pixels.");
    }

    const instructionBase =
      "Treat this as a single photograph. Unify all elements so they appear"
      + " captured together in one shot: match lighting direction, shadow"
      + " softness and direction, color temperature, grain / noise, and"
      + " depth of field across the whole image. Do not change composition"
      + " or content — only integrate them into one coherent image.";
    const instruction = userPromptHint && userPromptHint.trim()
      ? instructionBase + " Hint: " + userPromptHint.trim()
      : instructionBase;

    const modelId = cachedModelId || DEFAULT_MODEL_ID;
    const imageSize = readPills("pills-resolution", defaultResFor(modelId));
    const opts = {
      modelId: modelId,
      prompt: instruction,
      sourceImage: sourcePng,
      refImages: refImages,
      imageSize: imageSize,
      aspectRatio: MATCH_INPUT,   // Fuse always matches the base canvas
      aspectMode: "edit",
      sourceWidth: baseW,
      sourceHeight: baseH,
    };

    const N = 3; // fixed
    const options = [];
    for (let i = 1; i <= N; i++) {
      setStatus("busy", "Fusing option " + i + " of " + N + "…");
      const img = await generateImage(activeApiKey(), opts);
      setStatus("busy", "Placing option " + i + " of " + N + "…");
      const layerName = buildBatchLayerName("Fuse", i, N);
      // Fuse output covers the whole canvas — place via the edited-layer
      // path with no mask so fit-to-canvas + rasterize still apply.
      const lid = await placeBase64AsEditedLayer(img.base64, null, layerName);
      options.push({ layerId: lid, afterSnapshotRef: lastPlacedFileRef || null });
    }
    // Multi-option preview: each result is its own pickable option.
    return { options: options };
  }

  // OP 3 — Reference Inpaint: PS selection + reference; reuse the
  // existing selection→mask→composite engine, but ALSO attach refs so
  // the labeled-edit-with-refs branch in generateImage fires.
  async function runComposeRefInpaint(userPrompt, quantity) {
    const ps = psMod();
    const doc = ps.app.activeDocument;
    if (!doc) throw new Error("Open a Photoshop document first.");
    if (!refImages || refImages.length === 0) {
      throw new Error("Add at least one reference image (uploader below).");
    }

    // Read the user's selection bounds (DOM-only — no modal yet).
    let userSelBounds = null;
    try {
      const sel = doc.selection;
      if (sel && sel.bounds) {
        const b = sel.bounds;
        const left   = Number(b.left)   || 0;
        const top    = Number(b.top)    || 0;
        const right  = Number(b.right)  || 0;
        const bottom = Number(b.bottom) || 0;
        if (right > left && bottom > top) {
          userSelBounds = { left: left, top: top, right: right, bottom: bottom };
        }
      }
    } catch (_) {}
    if (!userSelBounds) throw new Error("Make a selection first.");

    const baseW = Math.round(doc.width);
    const baseH = Math.round(doc.height);

    let sourcePng = null;
    await ps.core.executeAsModal(async function () {
      sourcePng = await readDocCompositeAsImage();
    }, { commandName: "KBImage — RefInpaint read" });
    if (!sourcePng || !sourcePng.base64 || sourcePng.base64.length === 0) {
      throw new Error("Read returned empty pixels.");
    }

    const maskSpec = { kind: "rect", rect: userSelBounds };

    const instructionBase =
      "Fill the selected region using the REFERENCE image"
      + (refImages.length === 1 ? "" : "s")
      + " as the content / style source. Match the lighting, perspective,"
      + " color temperature, and grain of the surrounding scene so the"
      + " inserted region reads as part of the same photograph. Leave"
      + " everything outside the selected region unchanged.";
    const instruction = userPrompt && userPrompt.trim()
      ? instructionBase + " Hint: " + userPrompt.trim()
      : instructionBase;

    const modelId = cachedModelId || DEFAULT_MODEL_ID;
    const imageSize    = readPills("pills-resolution", defaultResFor(modelId));
    const aspectChoice = readPills("pills-aspect",     defaultAspectFor(modelId));
    const opts = {
      modelId: modelId,
      prompt: instruction,
      sourceImage: sourcePng,
      refImages: refImages,         // refs trigger labeled-edit-with-refs
      imageSize: imageSize,
      aspectRatio: aspectChoice,
      aspectMode: "edit",           // base dictates; pill ignored for shape
      sourceWidth: baseW,
      sourceHeight: baseH,
    };

    // v0.06 — same routing as runEditPipeline. RefInpaint's maskSpec is
    // always {kind:"rect"} from the PS selection. Both providers get
    // their results placed as plain layers:
    //   • GPT/openai → API mask sent, server confines.
    //   • NB/gemini → no client mask; result preserves surroundings
    //     naturally, so plain placement shows the edit in the right
    //     region without hiding it.
    const _provider = (MODELS[opts.modelId] || MODELS[DEFAULT_MODEL_ID]).provider || "gemini";
    const _useApiMask = (_provider === "openai" && !!maskSpec);
    if (_useApiMask) {
      opts.maskSpec = maskSpec;
      opts.maskDoc  = { width: baseW, height: baseH };
    }
    const _clientMaskSpec = null;

    const N = Math.max(1, Math.min(4, Number(quantity) || 1));
    const layerIds = [];
    let afterRef = null;
    for (let i = 1; i <= N; i++) {
      setStatus("busy", "Inpainting " + i + " of " + N
        + " (with " + refImages.length + " ref"
        + (refImages.length === 1 ? "" : "s") + ")…");
      const img = await generateImage(activeApiKey(), opts);
      setStatus("busy", "Placing layer " + i + " of " + N + "…");
      const layerName = buildBatchLayerName("Compose-RefInpaint", i, N);
      const lid = await placeBase64AsEditedLayer(img.base64, _clientMaskSpec, layerName);
      if (lid != null) layerIds.push(lid);
      if (lastPlacedFileRef) afterRef = lastPlacedFileRef;
    }
    // selBounds → re-run restores the same selection (via editReRunPrep).
    return { layerIds: layerIds, afterSnapshotRef: afterRef, selBounds: userSelBounds };
  }

  // ----- Compose + Upscale operators, recall-wrapped -----
  // Same pattern as Generate/Edit: a paramsFromForm (re-read on re-run) + an
  // execute that runs the existing place flow, adds cost per actual run, and
  // returns { layerIds | options, afterSnapshotRef[, state] }.
  function refgenParamsFromForm() {
    const modelId = cachedModelId || DEFAULT_MODEL_ID;
    const $prompt = $("prompt");
    return {
      modelId: modelId,
      prompt: (($prompt && $prompt.value) || "").trim(),
      imageSize: readPills("pills-resolution", defaultResFor(modelId)),
      aspectRatio: readPills("pills-aspect", defaultAspectFor(modelId)),
      refImagesCount: refImages.length,
      quantity: Math.max(1, Math.min(4, Number(cachedQuantity) || 1)),
    };
  }
  async function executeRefGen(params) {
    const r = await runComposeRefGen(params.prompt, params.quantity);
    try {
      const modelId = params.modelId || cachedModelId || DEFAULT_MODEL_ID;
      addSessionCost(perImageCost(modelId, params.imageSize || defaultResFor(modelId)) * (params.quantity || 1));
    } catch (_) {}
    return { layerIds: (r && r.layerIds) || [], afterSnapshotRef: (r && r.afterSnapshotRef) || null };
  }

  function refinpaintParamsFromForm() {
    const modelId = cachedModelId || DEFAULT_MODEL_ID;
    const $prompt = $("prompt");
    return {
      modelId: modelId,
      prompt: (($prompt && $prompt.value) || "").trim(),
      imageSize: readPills("pills-resolution", defaultResFor(modelId)),
      aspectRatio: readPills("pills-aspect", defaultAspectFor(modelId)),
      refImagesCount: refImages.length,
      quantity: Math.max(1, Math.min(4, Number(cachedQuantity) || 1)),
    };
  }
  async function executeRefInpaint(params) {
    const r = await runComposeRefInpaint(params.prompt, params.quantity);
    try {
      const modelId = params.modelId || cachedModelId || DEFAULT_MODEL_ID;
      addSessionCost(perImageCost(modelId, params.imageSize || defaultResFor(modelId)) * (params.quantity || 1));
    } catch (_) {}
    // state.selBounds → reuses editReRunPrep (rect re-select) + editOnSettle (no-op, no channel).
    return {
      layerIds: (r && r.layerIds) || [],
      afterSnapshotRef: (r && r.afterSnapshotRef) || null,
      state: { selBounds: (r && r.selBounds) || null, selChannel: null },
    };
  }

  function fuseParamsFromForm() {
    const modelId = cachedModelId || DEFAULT_MODEL_ID;
    const $prompt = $("prompt");
    return {
      modelId: modelId,
      prompt: (($prompt && $prompt.value) || "").trim(),   // optional hint
      imageSize: readPills("pills-resolution", defaultResFor(modelId)),
      aspectRatio: MATCH_INPUT,
      refImagesCount: refImages.length,
    };
  }
  async function executeFuse(params) {
    const r = await runComposeFuse(params.prompt);   // always 3 options
    try {
      const modelId = params.modelId || cachedModelId || DEFAULT_MODEL_ID;
      addSessionCost(perImageCost(modelId, params.imageSize || defaultResFor(modelId)) * 3);
    } catch (_) {}
    return { options: (r && r.options) || [] };
  }

  function upscaleParamsFromForm() {
    return {
      provider:   cachedUpscaleProvider === "clarity" ? "clarity" : "topaz",
      sourceMode: cachedUpscaleSource === "active-layer" ? "active-layer" : "composite",
      factor:     cachedUpscaleFactor === 4 ? 4 : 2,
      creativity: cachedClarityCreativity,
    };
  }
  // The upscale read→(Topaz|Clarity)→place flow, lifted out of actUpscaleTopaz so
  // it can run through the recall wrapper. NOTE: placement grows the canvas
  // (grow-only). A re-run/discard deletes the layer but does NOT shrink the
  // canvas — this does not COMPOUND (re-running the same factor grows to the
  // same size), so a discarded upscale just leaves the canvas enlarged.
  async function executeUpscale(params) {
    const ps = psMod();
    const provider = params.provider === "clarity" ? "clarity" : "topaz";
    const sourceMode = params.sourceMode === "active-layer" ? "active-layer" : "composite";
    setStatus("busy", sourceMode === "active-layer" ? "Reading active layer…" : "Reading flattened composite…");
    let sourceImage = null;
    await ps.core.executeAsModal(async function () {
      sourceImage = sourceMode === "active-layer"
        ? await readActiveLayerAsImage()
        : await readDocCompositeAsImage();
    }, { commandName: "KBImage — read pixels for upscale" });

    let enhanced, costUsd = null, brand;
    if (provider === "clarity") {
      brand = "Clarity Upscale";
      enhanced = await upscaleViaClarity(cachedClarityKey, sourceImage, {
        factor:     params.factor === 4 ? 4 : 2,
        creativity: params.creativity,
        onStatus:   function (s) { setStatus("busy", "Clarity: " + s); },
      });
      costUsd = enhanced.costUsd;   // real cost off the response
    } else {
      brand = "Topaz Upscale";
      enhanced = await upscaleViaTopaz(cachedTopazKey, sourceImage, {
        factor:   params.factor === 4 ? 4 : 2,
        onStatus: function (s) { setStatus("busy", "Topaz: " + s); },
      });
    }

    const srcW = (sourceImage && sourceImage.width) || 0;
    const outW = enhanced.width || 0;
    let factorTag = "";
    if (srcW > 0 && outW > 0) factorTag = (outW / srcW).toFixed(1) + "x";

    setStatus("busy", "Placing enhanced layer at native size…");
    const srcTag = sourceMode === "active-layer" ? "Active Layer" : "Composite";
    const namePieces = [brand];
    if (factorTag) namePieces.push(factorTag);
    namePieces.push("(" + srcTag + ")");
    namePieces.push(timestampForLayerName());
    const placed = await placeUpscaleResultAsLayer(enhanced.bytes, enhanced.mime, namePieces.join(" "));

    try {
      if (provider === "clarity") {
        if (costUsd != null && isFinite(costUsd)) addSessionCost(costUsd);   // returned cost_usd
      } else {
        const __w = enhanced.width  || placed.nativeW || 0;
        const __h = enhanced.height || placed.nativeH || 0;
        if (__w && __h) addSessionCost(topazPerMP() * (__w * __h) / 1e6);
      }
    } catch (_) {}

    return {
      layerIds: (placed && placed.layerID != null) ? [placed.layerID] : [],
      afterSnapshotRef: lastPlacedFileRef || null,
    };
  }

  // =======================================================================
  // FOUNDATION 1 — SESSION LOG (append-only).
  //
  // Records every operation AS IT HAPPENS — not reconstructed later. The
  // authorship gateway reads this log, so it must be complete from the
  // first run. Append-only semantics: records are never deleted or
  // reordered; the ONLY mutation is a record's `committed` flag flipping
  // false→true once, on an explicit Accept. `committed` therefore IS the
  // authorship signal — nothing is committed unless a designer accepted it.
  //
  // Lightweight: snapshot fields are REFERENCES (file paths), never inline
  // image bytes. `params` is sanitized so reference-image base64 / source
  // pixels never enter the log.
  // =======================================================================
  // The authorship session is PER ACTIVE DOCUMENT, not per plugin launch.
  // sessionId rotates whenever the active document changes (see
  // rotateAuthorshipSession). The COST METER is deliberately NOT part of this
  // — it is per-launch and keeps accumulating across documents.
  let   sessionId  = "sess-" + Date.now().toString(36) + "-0";
  let   __sessionSeq = 0;
  let   __logSeq   = 0;
  const sessionLog = [];   // in-memory source of truth (recorded as it happens)
  // Which document the current authorship session belongs to. Baselined in
  // hydrate; compared against the active doc to detect a switch.
  let   currentSessionDocId = undefined;
  const TEMP_SEL_CHANNEL = "kb_sel_tmp";   // matches runEditPipeline's SEL_CHANNEL
  // Console inspection hooks (visible in the UDT devtools console).
  try { globalThis.__kbimageLog = sessionLog; globalThis.__kbimageSessionId = sessionId; } catch (_) {}

  function newSessionId() {
    return "sess-" + Date.now().toString(36) + "-" + (++__sessionSeq);
  }
  // Per-session log filename → each document's authorship trail persists as its
  // own file (the gateway reads one print's work, not a mix).
  function currentLogFileName() {
    return "kbimage-session-" + sessionId + ".jsonl";
  }

  function isoFromMs(ms) {
    try { return new Date(ms).toISOString(); } catch (_) { return String(ms); }
  }

  // Strip heavy / sensitive fields so the log never inlines image bytes.
  function sanitizeParams(p) {
    if (!p || typeof p !== "object") return (p == null ? null : p);
    const out = {};
    for (const k in p) {
      if (!Object.prototype.hasOwnProperty.call(p, k)) continue;
      const v = p[k];
      if (k === "refImages" && Array.isArray(v)) {
        out.refImages = v.map(function (r) { return (r && r.name) || "ref"; });
        out.refImagesCount = v.length;
      } else if (k === "sourceImage") {
        out.sourceImage = "(image omitted)";
      } else if (typeof v === "string" && v.length > 2000) {
        out[k] = v.slice(0, 2000) + "…";
      } else if (v && typeof v === "object") {
        // shallow copy of plain option objects (maskSpec, doc dims, …)
        try { out[k] = JSON.parse(JSON.stringify(v)); } catch (_) { out[k] = "(unserializable)"; }
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  function logRecordSkeleton(op, params, targetLayerId, sourceRef) {
    const now = Date.now();
    // v0.14 — provenance tag: every record records whether it was routed via the
    // Fal aggregator lane ("fal") or a direct first-party engine ("direct"), so
    // provenance (v0.16) can treat Fal generations as a known category.
    const _m = MODELS[(params && params.modelId) || ""];
    const routedVia = (_m && _m.provider === "fal") ? "fal" : "direct";
    return {
      id: "rec-" + now.toString(36) + "-" + (++__logSeq),
      sessionId: sessionId,
      ts: now,                       // epoch ms
      tsISO: isoFromMs(now),         // convenience, human-readable
      op: op,
      routedVia: routedVia,          // "fal" (aggregator) | "direct" (first-party)
      params: sanitizeParams(params),
      targetLayerId: (targetLayerId == null ? null : targetLayerId),
      sourceRef: sourceRef || null,
      beforeSnapshotRef: null,       // file-path reference (or null)
      afterSnapshotRef: null,        // file-path reference (or null)
      committed: false,              // ONLY recallAccept() sets this true
    };
  }

  // Flush the whole in-memory log to a JSONL file (one record per line).
  // Whole-file rewrite from the immutable array preserves append-only
  // semantics (never deletes/reorders) and keeps the on-disk file in sync.
  async function flushLog() {
    try {
      const folder = await fsLocal().getDataFolder();
      const file = await folder.createFile(currentLogFileName(), { overwrite: true });
      let text = "";
      for (let i = 0; i < sessionLog.length; i++) text += JSON.stringify(sessionLog[i]) + "\n";
      await file.write(text, { format: fmts().utf8 });
      try { globalThis.__kbimageLogPath = file.nativePath; } catch (_) {}
      try { console.log(TAG, "[log] flushed", sessionLog.length, "record(s) →", file.nativePath); } catch (_) {}
    } catch (e) {
      try { console.error(TAG, "[log] flush failed:", e); } catch (_) {}
    }
  }

  // Append a run record the moment a preview exists, then persist.
  async function logRun(rec) {
    sessionLog.push(rec);
    try { console.log(TAG, "[log] +run", rec.op, rec.id, "committed=false"); } catch (_) {}
    await flushLog();
    return rec;
  }

  // Finalize a record to committed:true (the one in-place mutation allowed).
  async function logFinalizeCommitted(recId) {
    for (let i = 0; i < sessionLog.length; i++) {
      if (sessionLog[i].id === recId) {
        sessionLog[i].committed = true;
        try { console.log(TAG, "[log] commit", recId); } catch (_) {}
        break;
      }
    }
    await flushLog();
  }

  // =======================================================================
  // PER-DOCUMENT AUTHORSHIP SESSION.
  //
  // The session log + temp channel + pending preview belong to ONE document.
  // When the active document changes we rotate the AUTHORSHIP session so each
  // document (each print) gets a clean trail the gateway can read on its own.
  //
  // The COST METER (sessionTotal / sessionSince) is intentionally untouched
  // here — it is a per-LAUNCH running total that keeps accumulating across
  // documents and only resets when the plugin / Photoshop closes.
  // =======================================================================

  // Best-effort: remove a leftover temp selection channel in the now-active
  // document. Guarded; a missing channel or a busy host is harmless.
  async function clearTempSelChannel() {
    const ps = psMod();
    if (!ps.app.activeDocument) return;
    await ps.core.executeAsModal(async function () {
      try {
        if (await channelExistsByName(TEMP_SEL_CHANNEL)) {
          try { await selectRGBChannel(); } catch (_) {}
          await deleteChannelByName(TEMP_SEL_CHANNEL);
        }
      } catch (e) { try { console.warn(TAG, "clearTempSelChannel:", e); } catch (_) {} }
    }, { commandName: "KBImage — clear temp channel" });
  }

  // Rotate the authorship session for a new active document. Sets the doc id
  // FIRST so concurrent listener fires no-op. Does NOT touch the cost meter.
  async function rotateAuthorshipSession(newDocId, reason) {
    const prevId = currentSessionDocId;
    currentSessionDocId = newDocId;
    sessionId = newSessionId();
    sessionLog.length = 0;                 // empty IN PLACE so __kbimageLog ref stays valid
    __logSeq = 0;
    try { globalThis.__kbimageSessionId = sessionId; } catch (_) {}
    // Drop pending preview/recall state from the previous document. We do NOT
    // delete that document's preview layer — it lives in that document; we
    // only release the in-memory handle and hide the bar.
    pendingRecall = null;
    try { hideRecallBar(); } catch (_) {}
    try { console.log(TAG, "[session] rotate (" + reason + "): doc " + prevId + " → " + newDocId + ", new " + sessionId); } catch (_) {}
    try { await clearTempSelChannel(); } catch (_) {}
  }

  // Read the active doc id; rotate if it changed. Cheap id-compare so spurious
  // notification fires (e.g. layer selects) are no-ops.
  async function maybeRotateSession(reason) {
    let id = null;
    try {
      const d = psMod().app.activeDocument;
      id = (d && typeof d.id !== "undefined") ? d.id : null;
    } catch (_) { id = null; }
    if (id == null) return;                       // no document → keep current session
    if (currentSessionDocId === undefined) {      // first observation = baseline (no rotate)
      currentSessionDocId = id;
      return;
    }
    if (id === currentSessionDocId) return;       // same document → nothing to do
    await rotateAuthorshipSession(id, reason);
  }

  // Register a notification listener for document changes. No dedicated
  // "activeDocumentChanged" event exists in UXP — we listen to document
  // lifecycle/select events and guard with the id-compare above. Tolerant of
  // the string-array vs object-array signature difference across PS versions.
  function registerDocChangeListener() {
    const cb = function () {
      maybeRotateSession("notify").catch(function (e) {
        try { console.warn(TAG, "[session] notify rotate failed:", e); } catch (_) {}
      });
      // v0.13 — refresh the doc-resolution readout + under-res flag on the SAME
      // events (new layer arrives / active layer or document changes).
      try { updateDocInfo(); } catch (_) {}
    };
    // v0.13 — added paste/placeEvent/delete so the under-res flag catches a
    // layer ON ENTRY (import/paste/AI place) and active-layer changes (select).
    const events = ["open", "close", "make", "select", "paste", "placeEvent", "delete"];
    try {
      const ps = psMod();
      if (!ps.action || typeof ps.action.addNotificationListener !== "function") {
        try { console.warn(TAG, "[session] addNotificationListener unavailable; per-action backstop only."); } catch (_) {}
        return;
      }
      try {
        ps.action.addNotificationListener(events, cb);                       // string-array form
      } catch (e1) {
        ps.action.addNotificationListener(events.map(function (n) { return { event: n }; }), cb);  // object-array fallback
      }
      try { console.log(TAG, "[session] doc-change listener registered."); } catch (_) {}
    } catch (e) {
      try { console.warn(TAG, "[session] listener registration failed; per-action backstop only:", e); } catch (_) {}
    }
  }

  // v0.13 — DOCUMENT-RESOLUTION READOUT + UNDER-RES LAYER FLAG.
  //
  // Readout: the active document's pixel dimensions (the reference the flag
  // compares against). Flag: the ACTIVE layer's real pixel resolution (its
  // bounds — PS layers carry no per-layer DPI, so pixel-count is the measure)
  // vs the document. Below project resolution → a red, INFORMATIONAL flag
  // (awareness, never a blocker; the user conforms via the Upscale tab). All
  // reads are plain property getters (no modal). Fully guarded.
  //
  // Known limitation (documented, not a bug): the bounds test catches a layer
  // PLACED/GENERATED small (the common case, e.g. a 1K gen in a 2K doc). It does
  // NOT detect a smart object internally scaled UP to fill the canvas (its
  // bounds read full-canvas) — that would need the SO source size.
  function updateDocInfo() {
    const $res  = $("doc-resolution");
    const $flag = $("under-res-flag");
    let doc = null;
    try { doc = psMod().app.activeDocument; } catch (_) { doc = null; }
    if (!doc) {
      if ($res)  $res.textContent = "Document: —";
      if ($flag) $flag.classList.add("hidden");
      return;
    }
    let dw = 0, dh = 0;
    try { dw = Math.round(Number(doc.width)); dh = Math.round(Number(doc.height)); } catch (_) {}
    if ($res) $res.textContent = "Document: " + dw + " × " + dh + " px";
    if (!$flag) return;

    let lw = 0, lh = 0;
    try {
      const layer = doc.activeLayers && doc.activeLayers[0];
      if (layer && layer.bounds) {
        const b = layer.bounds;
        lw = Math.round(Number(b.right) - Number(b.left));
        lh = Math.round(Number(b.bottom) - Number(b.top));
      }
    } catch (_) {}

    // Flag when the active layer's pixels fall below project resolution in
    // either dimension (1% tolerance so a ~full-canvas layer doesn't flag on
    // rounding/crop). Empty/zero-bounds layers are skipped.
    const below = (lw > 0 && lh > 0 && dw > 0 && dh > 0)
      && (lw < Math.floor(dw * 0.99) || lh < Math.floor(dh * 0.99));
    if (below) {
      $flag.textContent = "⚠️ Active layer is " + lw + " × " + lh
        + " in a " + dw + " × " + dh + " document — below project resolution.";
      $flag.classList.remove("hidden");
    } else {
      $flag.classList.add("hidden");
    }
  }

  // =======================================================================
  // FOUNDATION 2 — RECALL WRAPPER.
  //
  // One shared mechanism that wraps ANY operation: it produces a preview
  // (a non-destructive result layer the designer can see), then exposes
  // accept() (commit) and reRun() (discard + run again with new params).
  // Nothing commits without an explicit accept.
  //
  // Uniform contract returned by runWithRecall():
  //   { previewLayerId, previewLayerIds, accept(), reRun(overrides) }
  //
  // ORIGIN-BLIND: the wrapper hands the operator only targetLayerId; the
  // operator never branches on how that content arrived.
  // =======================================================================
  let pendingRecall = null;   // the live preview awaiting accept / re-run

  // Every preview layer id, whether the pending preview is single-record
  // (layerIds[]) or multi-option (options[].layerId). Used by re-run / supersede
  // so cleanup removes ALL preview layers, not just one.
  function allPreviewLayerIds(pr) {
    if (!pr) return [];
    if (pr.multiOption && Array.isArray(pr.options)) {
      return pr.options.map(function (o) { return o.layerId; }).filter(function (x) { return x != null; });
    }
    return (pr.layerIds || []).filter(function (x) { return x != null; });
  }

  // CLASS-based so multiple bars work (shared-form bar for Generate/Edit/Compose
  // + a second bar on the Upscale tab, since the shared form is hidden there).
  // The bar on the visible tab shows; one in a hidden parent stays invisible.
  function showRecallBar(text) {
    const labels = document.querySelectorAll(".recall-label");
    for (let i = 0; i < labels.length; i++) if (text) labels[i].textContent = text;
    const bars = document.querySelectorAll(".recall-bar");
    for (let i = 0; i < bars.length; i++) bars[i].classList.remove("hidden");
  }
  function hideRecallBar() {
    const bars = document.querySelectorAll(".recall-bar");
    for (let i = 0; i < bars.length; i++) bars[i].classList.add("hidden");
  }

  // Delete preview layer(s) by id — inside executeAsModal (UXP rule: all
  // document mutation is modal). Robust against the "Delete not currently
  // available" alert: we never rely on ambient selection. For each id we
  //   1) SELECT the layer explicitly by _id (NOTE the underscore — the bare
  //      `target` key is ignored by Photoshop, which silently dropped the id
  //      and made Delete act on whatever was ambiently active, the original
  //      bug). The select also validates existence: a layer that's already
  //      gone throws here → we catch and skip (missing = nothing to discard).
  //   2) selectRGBChannel() to exit any layer-mask / alpha-channel target —
  //      with a mask/alpha targeted, "Delete" reports "not currently
  //      available" (documented; same fix as the temp-channel cleanup).
  //   3) Delete that layer explicitly by _id.
  // Every step is guarded; a missing/failed layer never throws out.
  async function deleteLayersById(ids) {
    if (!ids || !ids.length) return;
    const ps = psMod();
    if (!ps.app.activeDocument) return;
    await ps.core.executeAsModal(async function () {
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        if (id == null) continue;

        // 1) Make the target layer the ACTIVE layer, explicitly by id.
        try {
          await ps.action.batchPlay(
            [{ _obj: "select",
               _target: [{ _ref: "layer", _id: id }],
               makeVisible: false,
               _options: { dialogOptions: "dontDisplay" } }],
            { synchronousExecution: true }
          );
        } catch (e) {
          try { console.warn(TAG, "deleteLayer: layer id", id, "not selectable (already gone?) — skipping:", e); } catch (_) {}
          continue;   // layer no longer exists → nothing to delete
        }

        // 2) Exit any mask/alpha-channel target so a normal pixel layer (RGB)
        //    is active; otherwise Delete reports "not currently available".
        try { await selectRGBChannel(); } catch (_) {}

        // 3) Delete that exact layer by id (never an ambiently-selected one).
        try {
          await ps.action.batchPlay(
            [{ _obj: "delete",
               _target: [{ _ref: "layer", _id: id }],
               _options: { dialogOptions: "dontDisplay" } }],
            { synchronousExecution: true }
          );
        } catch (e) {
          try { console.warn(TAG, "deleteLayer: delete id", id, "failed:", e); } catch (_) {}
        }
      }
    }, { commandName: "KBImage — discard preview" });
  }

  // Run an operation through the recall gate.
  //   descriptor = {
  //     op, params, targetLayerId, sourceRef,
  //     execute:        async (params) => ({ layerIds, beforeSnapshotRef, afterSnapshotRef }),
  //     paramsProvider: () => params      // optional; re-read on reRun so
  //                                       // "new params" = current form state
  //   }
  // Optional descriptor hooks (op-specific state lifecycle; all optional):
  //   onSettle(state, accepted)  — preview's fate is decided. accepted=true
  //                                on Accept, false when abandoned by a new
  //                                superseding run. Use to release op state
  //                                (e.g. delete a temp selection channel).
  //   reRunPrep(state)           — about to Re-run: restore op state the next
  //                                run needs (e.g. reload the selection).
  // `state` is whatever execute() returns on result.state.
  // descriptor.multiOption (optional): the op produces N independent OPTIONS
  // (e.g. Fuse's 3). execute returns { options: [{layerId, afterSnapshotRef}, …] }.
  // The wrapper writes ONE log record per option (all committed:false) and the
  // pick-from-N accept commits the chosen one + discards the rest. Reusable by
  // any future multi-option operator.
  async function runWithRecall(descriptor) {
    // A new run supersedes any still-pending preview the user neither
    // accepted nor re-ran. Discard ALL its layer(s) and release its state; its
    // log record(s) stay committed:false (kept rejected forks = evidence).
    if (pendingRecall) {
      const prev = pendingRecall;
      pendingRecall = null;
      const prevIds = allPreviewLayerIds(prev);
      if (prevIds.length) { try { await deleteLayersById(prevIds); } catch (_) {} }
      if (prev.descriptor && typeof prev.descriptor.onSettle === "function") {
        try { await prev.descriptor.onSettle(prev.state, false); } catch (_) {}
      }
    }
    hideRecallBar();

    const result = await descriptor.execute(descriptor.params);
    const state = (result && result.state) || null;

    // ----- MULTI-OPTION (pick-from-N) -----
    if (descriptor.multiOption) {
      const raw = (result && Array.isArray(result.options))
        ? result.options.filter(function (o) { return o && o.layerId != null; })
        : [];
      const ofN = raw.length;
      const options = [];
      for (let i = 0; i < raw.length; i++) {
        // One record PER option, tagged option/ofN; targetLayerId = that layer.
        const p = Object.assign({}, descriptor.params, { option: i + 1, ofN: ofN });
        const rec = logRecordSkeleton(descriptor.op, p, raw[i].layerId, descriptor.sourceRef);
        rec.afterSnapshotRef = raw[i].afterSnapshotRef || null;
        await logRun(rec);
        options.push({ recordId: rec.id, layerId: raw[i].layerId });
      }
      pendingRecall = { multiOption: true, options: options, descriptor: descriptor, state: state };
      showRecallBar(ofN + " options placed — in the Layers panel pick the one you want, then Accept (the other "
        + (ofN - 1) + " are discarded). Re-run regenerates all " + ofN + ".");
      return {
        previewLayerIds: options.map(function (o) { return o.layerId; }),
        accept: recallAccept,
        reRun: recallReRun,
      };
    }

    // ----- SINGLE RECORD (one preview, may be a quantity batch) -----
    const layerIds = (result && Array.isArray(result.layerIds))
      ? result.layerIds.filter(function (x) { return x != null; })
      : [];
    // Record the run AS IT HAPPENS (committed:false until an explicit accept).
    const rec = logRecordSkeleton(descriptor.op, descriptor.params, descriptor.targetLayerId, descriptor.sourceRef);
    rec.beforeSnapshotRef = (result && result.beforeSnapshotRef) || null;
    rec.afterSnapshotRef  = (result && result.afterSnapshotRef)  || null;
    await logRun(rec);

    pendingRecall = { recordId: rec.id, layerIds: layerIds, descriptor: descriptor, state: state };
    showRecallBar("Preview ready — Accept to keep, Re-run to discard & try again.");

    return {
      previewLayerId:  layerIds.length ? layerIds[0] : null,
      previewLayerIds: layerIds.slice(),
      accept:  recallAccept,
      reRun:   recallReRun,
    };
  }

  async function recallAccept() {
    if (!pendingRecall) return;
    const descriptor = pendingRecall.descriptor;
    const state      = pendingRecall.state;

    // ----- MULTI-OPTION: pick = the option whose layer is ACTIVE in the
    // Layers panel. Commit that record; discard the other option layers
    // (their records stay committed:false = directed-selection evidence). -----
    if (pendingRecall.multiOption) {
      let activeId = null;
      try {
        const doc = psMod().app.activeDocument;
        const al = doc && doc.activeLayers && doc.activeLayers[0];
        if (al && typeof al.id !== "undefined") activeId = al.id;
      } catch (_) {}
      const options = pendingRecall.options || [];
      const chosen = options.filter(function (o) { return o.layerId === activeId; })[0];
      if (!chosen) {
        // Not on one of the options — keep the preview pending so they retry.
        setStatus("bad", "Select one of the " + options.length + " options in the Layers panel, then Accept.");
        return;
      }
      pendingRecall = null;
      hideRecallBar();
      const discardIds = options
        .filter(function (o) { return o.layerId !== chosen.layerId; })
        .map(function (o) { return o.layerId; });
      try { await deleteLayersById(discardIds); } catch (_) {}
      await logFinalizeCommitted(chosen.recordId);   // only the kept option commits
      if (descriptor && typeof descriptor.onSettle === "function") {
        try { await descriptor.onSettle(state, true); } catch (_) {}
      }
      setStatus("ok", "Kept your pick — " + discardIds.length
        + " other option" + (discardIds.length === 1 ? "" : "s") + " discarded.");
      return;
    }

    // ----- SINGLE: commit the one record; layers all stay. -----
    const recId = pendingRecall.recordId;
    pendingRecall = null;
    hideRecallBar();
    await logFinalizeCommitted(recId);   // the ONLY thing that commits
    if (descriptor && typeof descriptor.onSettle === "function") {
      try { await descriptor.onSettle(state, true); } catch (_) {}
    }
    setStatus("ok", "Accepted — kept in the document.");
  }

  async function recallReRun(overrides) {
    if (!pendingRecall) return;
    const descriptor = pendingRecall.descriptor;
    const state      = pendingRecall.state;
    const allIds     = allPreviewLayerIds(pendingRecall);   // single batch OR all options
    pendingRecall = null;
    hideRecallBar();
    // Discard ALL preview layer(s). The prior log record(s) remain
    // committed:false — kept rejected forks (evidence).
    try { await deleteLayersById(allIds); } catch (_) {}
    // Restore op-specific state the next run needs (e.g. reload the selection
    // so a selection edit re-applies to the same region).
    if (descriptor && typeof descriptor.reRunPrep === "function") {
      try { await descriptor.reRunPrep(state); } catch (_) {}
    }
    // Re-run with fresh params: paramsProvider re-reads the form so "new
    // params" = whatever the designer changed; explicit overrides win.
    let nextParams = descriptor.params;
    if (typeof descriptor.paramsProvider === "function") {
      try { nextParams = descriptor.paramsProvider(); } catch (_) {}
    }
    if (overrides && typeof overrides === "object") {
      nextParams = Object.assign({}, nextParams, overrides);
    }
    const nextDescriptor = Object.assign({}, descriptor, { params: nextParams });
    return runWithRecall(nextDescriptor);
  }

  // ----- Generate operator, recall-wrapped (proof case) -----
  // Reads all knobs from the panel form into a neutral params object. Used
  // both for the first run and (via paramsProvider) on every re-run, so a
  // re-run picks up any change the designer made to prompt/model/res/etc.
  function genParamsFromForm() {
    const modelId = cachedModelId || DEFAULT_MODEL_ID;
    const $prompt = $("prompt");
    const userPrompt = (($prompt && $prompt.value) || "").trim();
    const opts = {
      modelId: modelId,
      prompt: userPrompt,
      imageSize: readPills("pills-resolution", defaultResFor(modelId)),
      refImages: refImages,
      aspectRatio: readPills("pills-aspect", defaultAspectFor(modelId)),
      aspectMode: "generate",
      quantity: Math.max(1, Math.min(4, Number(cachedQuantity) || 1)),
    };
    try {
      const doc = psMod().app.activeDocument;
      if (doc && doc.width > 0 && doc.height > 0) {
        opts.sourceWidth = doc.width;
        opts.sourceHeight = doc.height;
      }
    } catch (_) {}
    return opts;
  }

  // Executes the generate op and returns the recall result shape. Cost is
  // added HERE (per actual generation) so re-runs — which make fresh API
  // calls — are billed too. afterSnapshotRef references the result PNG the
  // place function already wrote (no extra disk write).
  async function executeGenerate(params) {
    const N = Math.max(1, Math.min(4, Number(params.quantity) || 1));
    const modelId = params.modelId || DEFAULT_MODEL_ID;
    // v0.14 — Fal EDIT models (falEdit): the edit base is what the user LOADED.
    // If Reference Images are loaded, those are the input (falBuildBody packs them)
    // and we do NOT read the canvas. ONLY when no refs are loaded do we read the
    // current composite as the edit base. Read once (before the loop) so every
    // variation edits the same original. Direct/text-to-image models skip this.
    const _m = MODELS[modelId];
    if (_m && _m.falEdit && !params.sourceImage && !((params.refImages || []).length)) {
      const ps = psMod();
      if (!ps.app.activeDocument) throw new Error("Add a reference image, or open a document — the edit model needs an image to edit.");
      let src = null;
      setStatus("busy", "Reading the canvas to edit…");
      await ps.core.executeAsModal(async function () {
        src = await readDocCompositeAsImage();
      }, { commandName: "KBImage — read source for Fal edit" });
      if (!src || !src.base64) throw new Error("Read returned empty pixels for the edit source.");
      params.sourceImage = src;
    }
    const layerIds = [];
    let afterRef = null;
    for (let i = 1; i <= N; i++) {
      setStatus("busy", N === 1
        ? (params.refImages && params.refImages.length
            ? ("Generating with " + params.refImages.length + " ref" + (params.refImages.length === 1 ? "" : "s") + "…")
            : "Generating…")
        : ("Generating " + i + " of " + N
            + (params.refImages && params.refImages.length
                ? (" with " + params.refImages.length + " ref" + (params.refImages.length === 1 ? "" : "s")) : "")
            + "…"));
      const img = await generateImage(activeApiKey(), params);
      setStatus("busy", N === 1 ? "Placing layer…" : "Placing layer " + i + " of " + N + "…");
      const layerName = buildBatchLayerName("Generate", i, N);
      // v0.14 — Fal EDIT result: place via the edited-layer path (fit-to-canvas +
      // rasterize, no mask) so it FILLS the document instead of landing as a small
      // native-size centered block. With Fit Canvas (output = canvas aspect) the
      // fit is a uniform scale, no distortion. Other models keep native placement.
      const layerID = (_m && _m.falEdit)
        ? await placeBase64AsEditedLayer(img.base64, null, layerName, false)
        : await placeBase64AsLayer(img.base64, layerName);
      if (layerID != null) layerIds.push(layerID);
      if (lastPlacedFileRef) afterRef = lastPlacedFileRef;   // ref the file already written
    }
    // Cost: per-image rate (model × resolution) × images produced.
    try { addSessionCost(perImageCost(modelId, params.imageSize || defaultResFor(modelId)) * N); } catch (_) {}
    return { layerIds: layerIds, afterSnapshotRef: afterRef, beforeSnapshotRef: null };
  }

  // ----- Edit operator, recall-wrapped (Select/Edit tabs, EXCEPT Extend) -----
  // runEditPipeline reads its knobs from the live form/globals (cachedEditType,
  // the prompt textarea, the pills, refImages), so these params are for the
  // LOG record and to satisfy the uniform contract; the pipeline itself stays
  // origin-blind (it reads the document COMPOSITE, never branching on how the
  // target arrived). Image bytes never enter params.
  function editParamsFromForm() {
    const modelId = cachedModelId || DEFAULT_MODEL_ID;
    const $prompt = $("prompt");
    return {
      editType: cachedEditType,
      prompt: (($prompt && $prompt.value) || "").trim(),
      modelId: modelId,
      imageSize: readPills("pills-resolution", defaultResFor(modelId)),
      aspectRatio: readPills("pills-aspect", defaultAspectFor(modelId)),
      refImagesCount: refImages.length,
      quantity: Math.max(1, Math.min(4, Number(cachedQuantity) || 1)),
    };
  }

  async function executeEdit(params) {
    const r = await runEditPipeline(params.editType, params.prompt, params.quantity, { recallWrapped: true });
    // Cost per actual run (re-runs make fresh API calls → billed too).
    try {
      const modelId = params.modelId || cachedModelId || DEFAULT_MODEL_ID;
      addSessionCost(perImageCost(modelId, params.imageSize || defaultResFor(modelId)) * (params.quantity || 1));
    } catch (_) {}
    return {
      layerIds: (r && r.layerIds) || [],
      afterSnapshotRef: (r && r.afterSnapshotRef) || null,
      beforeSnapshotRef: null,
      state: { selChannel: (r && r.selChannel) || null, selBounds: (r && r.selBounds) || null },
    };
  }

  // Re-run prep: restore the selection so the re-run re-applies to the SAME
  // region. Prefer the shape-accurate temp channel; fall back to the bounding
  // rect. No-op for whole-image edits (no selection state). Inside a modal.
  async function editReRunPrep(state) {
    if (!state || (!state.selChannel && !state.selBounds)) return;
    const ps = psMod();
    if (!ps.app.activeDocument) return;
    await ps.core.executeAsModal(async function () {
      try {
        if (state.selChannel && await channelExistsByName(state.selChannel)) {
          await deselectAll();
          await loadSelectionFromChannel(state.selChannel);
        } else if (state.selBounds) {
          await selectRect(state.selBounds.left, state.selBounds.top, state.selBounds.right, state.selBounds.bottom);
        }
      } catch (e) { try { console.warn(TAG, "editReRunPrep:", e); } catch (_) {} }
    }, { commandName: "KBImage — restore selection for re-run" });
  }

  // Settle: release the temp selection channel when the preview's fate is
  // decided (Accept, or abandoned by a superseding run). selectRGBChannel
  // first so a normal pixel layer is targeted (the documented fix for the
  // "Delete not available" dialog). Fully guarded; the next run's start-of-run
  // pre-delete is the safety net if this is ever skipped.
  async function editOnSettle(state) {
    if (!state || !state.selChannel) return;
    const ps = psMod();
    if (!ps.app.activeDocument) return;
    await ps.core.executeAsModal(async function () {
      try {
        await selectRGBChannel();
        if (await channelExistsByName(state.selChannel)) {
          await deleteChannelByName(state.selChannel);
        }
      } catch (e) { try { console.warn(TAG, "editOnSettle channel cleanup:", e); } catch (_) {} }
    }, { commandName: "KBImage — settle edit preview" });
  }

  // Recall-bar action handlers (respect the in-flight lock — a re-run makes
  // real API calls and must not overlap a generate).
  async function actRecallAccept() {
    // Guard: multi-option accept mutates the document (deletes the non-picked
    // option layers), so it must not overlap an in-flight run.
    if (generateInFlight) return;
    generateInFlight = true;
    try { await recallAccept(); }
    catch (e) { try { setStatus("bad", (e && e.message) || String(e)); } catch (_) {} }
    finally { generateInFlight = false; }
  }
  async function actRecallReRun() {
    if (generateInFlight) return;
    generateInFlight = true;
    const rrBtns = document.querySelectorAll(".recall-rerun");   // both bars
    for (let i = 0; i < rrBtns.length; i++) rrBtns[i].classList.add("disabled");
    try {
      setStatus("busy", "Discarding preview & re-running…");
      await recallReRun();
      setStatus("ok", "Preview ready — review, then Accept or Re-run.");
    } catch (e) {
      try { setStatus("bad", (e && e.message) || String(e)); } catch (_) {}
    } finally {
      generateInFlight = false;
      for (let i = 0; i < rrBtns.length; i++) rrBtns[i].classList.remove("disabled");
    }
  }

  async function actGenerate() {
    // Hard reentry guard — return immediately if a run is already in flight.
    if (generateInFlight) {
      try { console.log(TAG, "generate ignored — already in flight"); } catch (_) {}
      return;
    }
    const btn = $("generate-btn");
    if (btn && btn.classList.contains("disabled")) return;

    // Backstop: if the active document changed since the last run (and the
    // notification listener somehow missed it), rotate the authorship session
    // BEFORE this op writes to the log — never pool a new doc's work into the
    // old trail. Does not touch the cost meter.
    try { await maybeRotateSession("action"); } catch (_) {}

    const $prompt = $("prompt");
    const userPrompt = (($prompt && $prompt.value) || "").trim();

    // v0.06 — pick the key matching the active model's provider.
    const _activeModelId = cachedModelId || DEFAULT_MODEL_ID;
    const _activeModel   = MODELS[_activeModelId] || MODELS[DEFAULT_MODEL_ID];
    const _activeProvider = (_activeModel && _activeModel.provider) || "gemini";
    // Key-optional: a model whose provider key isn't set is DORMANT — selecting
    // it is fine, but generating surfaces a clean message and makes NO network
    // call (returns here, never throws/breaks the panel).
    const _activeKey = (_activeProvider === "openai") ? cachedOpenAIKey
                     : (_activeProvider === "bfl")    ? cachedBflKey
                     : (_activeProvider === "fal")    ? cachedFalKey
                     : cachedKey;
    if (!_activeKey) {
      const label = _activeProvider === "openai" ? "OpenAI"
                  : _activeProvider === "bfl"    ? "Black Forest Labs"
                  : _activeProvider === "fal"    ? "Fal"
                  : "Google AI Studio";
      setStatus("bad", "Add the " + label + " API key in Settings to use this model.");
      return;
    }

    // Generate tab → generate flow.
    // Select/Edit tabs → edit flow.
    // Compose tab → one of three Compose ops.
    // Settings tab doesn't reach here because the action button is hidden.
    const isEdit    = (activeTab === "select" || activeTab === "edit");
    const isCompose = (activeTab === "compose");

    if (!isEdit && !isCompose && !userPrompt) {
      setStatus("bad", "Type a prompt first."); return;
    }
    if (isEdit) {
      const cfg = EDIT_MODES[cachedEditType] || EDIT_MODES[""];
      if (cfg && cfg.requiresPrompt && !userPrompt) {
        setStatus("bad",
          cachedEditType === "" ? "Type a whole-image instruction first."
                                 : "This edit type needs a prompt."); return;
      }
    }
    if (isCompose) {
      if (cachedComposeOp === "refgen") {
        if (!userPrompt) { setStatus("bad", "Describe the new image."); return; }
        if (!refImages.length) { setStatus("bad", "Add at least one reference image."); return; }
      } else if (cachedComposeOp === "refinpaint") {
        if (!refImages.length) { setStatus("bad", "Add at least one reference image."); return; }
      }
      // Fuse: no prompt required, no ref required.
    }

    // Lock + visually disable BEFORE any await.
    generateInFlight = true;
    if (btn) btn.classList.add("disabled");

    const reqId = Date.now().toString(36);
    const modelId = cachedModelId || DEFAULT_MODEL_ID;
    const N = Math.max(1, Math.min(4, Number(cachedQuantity) || 1));

    try {
      if (isCompose) {
        // ----- Compose routed through the RECALL WRAPPER -----
        try { console.log(TAG, "compose START", reqId, "op=" + cachedComposeOp, "model=" + modelId, "N=" + N); } catch (_) {}
        let srcRef = null;
        try {
          const doc = psMod().app.activeDocument;
          srcRef = (doc && typeof doc.id !== "undefined") ? ("doc:" + doc.id) : null;
        } catch (_) {}
        if (cachedComposeOp === "refgen") {
          await runWithRecall({
            op: "compose:refgen",
            params: refgenParamsFromForm(),
            targetLayerId: null,
            sourceRef: srcRef,
            paramsProvider: refgenParamsFromForm,
            execute: executeRefGen,
          });
        } else if (cachedComposeOp === "fuse") {
          await runWithRecall({
            op: "compose:fuse",
            params: fuseParamsFromForm(),
            targetLayerId: null,
            sourceRef: srcRef,
            paramsProvider: fuseParamsFromForm,
            execute: executeFuse,
            multiOption: true,         // 3 options → pick-from-N accept
          });
        } else if (cachedComposeOp === "refinpaint") {
          let _targetLayerId = null;
          try {
            const doc = psMod().app.activeDocument;
            const al = doc && doc.activeLayers && doc.activeLayers[0];
            if (al && typeof al.id !== "undefined") _targetLayerId = al.id;
          } catch (_) {}
          await runWithRecall({
            op: "compose:refinpaint",
            params: refinpaintParamsFromForm(),
            targetLayerId: _targetLayerId,
            sourceRef: srcRef,
            paramsProvider: refinpaintParamsFromForm,
            execute: executeRefInpaint,
            reRunPrep: editReRunPrep,   // re-run re-selects the rect
            onSettle: editOnSettle,     // no channel → no-op
          });
        }
        setStatus("ok", "Preview ready — Accept to keep or Re-run.");
        try { console.log(TAG, "compose OK (preview)", reqId); } catch (_) {}
      } else if (isEdit) {
        try { console.log(TAG, "edit START", reqId, "type=" + cachedEditType, "model=" + modelId, "N=" + N); } catch (_) {}
        setStatus("busy", N === 1 ? "Reading layer…" : "Reading layer… (batch of " + N + ")");
        // Extend mutates the CANVAS (canvasResize), which a layer-delete can't
        // cleanly revert — so it is NOT recall-wrapped this pass; it places
        // directly as before. Every other edit (Remove/Replace/Add/Generative
        // Fill, whole-image presets, Recolor) is additive → recall-wrapped.
        const _editMode = effectiveEditMode(cachedEditType, docHasSelection());
        const _isExtend = !!(_editMode && _editMode.isExtend);
        if (_isExtend) {
          await runEditPipeline(cachedEditType, userPrompt, N, { recallWrapped: false });
          try { addSessionCost(perImageCost(modelId, readPills("pills-resolution", defaultResFor(modelId))) * N); } catch (_) {}
          const okMode = EDIT_MODES[cachedEditType];
          setStatus("ok", "Done — " + N + " "
            + (okMode ? okMode.display : cachedEditType)
            + " layer" + (N===1?"":"s") + " placed.");
        } else {
          // ----- Edit routed through the RECALL WRAPPER -----
          let srcRef = null, _targetLayerId = null;
          try {
            const doc = psMod().app.activeDocument;
            srcRef = (doc && typeof doc.id !== "undefined") ? ("doc:" + doc.id) : null;
            const al = doc && doc.activeLayers && doc.activeLayers[0];
            if (al && typeof al.id !== "undefined") _targetLayerId = al.id;   // nominal target (logged; op stays origin-blind)
          } catch (_) {}
          await runWithRecall({
            op: "edit:" + cachedEditType,
            params: editParamsFromForm(),
            targetLayerId: _targetLayerId,
            sourceRef: srcRef,
            paramsProvider: editParamsFromForm,   // re-run re-reads the form
            execute: executeEdit,
            reRunPrep: editReRunPrep,             // re-run restores the selection
            onSettle: editOnSettle,               // accept/abandon releases the temp channel
          });
          setStatus("ok", "Preview ready — Accept to keep or Re-run.");
        }
        try { console.log(TAG, "edit OK", reqId, "N=" + N); } catch (_) {}
      } else {
        // ----- Generate mode — routed through the RECALL WRAPPER -----
        // The placed layer(s) are the PREVIEW; nothing commits until the
        // designer hits Accept on the recall bar. Re-run discards and runs
        // again with the current form params. The wrapper writes the
        // session-log record and (via executeGenerate) adds cost per run.
        try { console.log(TAG, "generate START", reqId, "model=" + modelId, "N=" + N); } catch (_) {}
        let srcRef = null;
        try {
          const doc = psMod().app.activeDocument;
          srcRef = (doc && typeof doc.id !== "undefined") ? ("doc:" + doc.id) : null;
        } catch (_) {}
        await runWithRecall({
          op: "generate",
          params: genParamsFromForm(),
          targetLayerId: null,            // generate creates a new layer; no pre-existing target
          sourceRef: srcRef,
          paramsProvider: genParamsFromForm,   // re-run re-reads the form
          execute: executeGenerate,
        });
        setStatus("ok", "Preview ready — Accept to keep or Re-run.");
        try { console.log(TAG, "generate OK (preview)", reqId, "N=" + N); } catch (_) {}
      }
      // v0.09 — cost is added per ACTUAL run inside each execute (generate /
      // edit / compose) and the Extend branch, so recall re-runs are billed
      // too. Nothing to add here anymore.
    } catch (e) {
      try {
        const which = isCompose ? "compose FAIL" : (isEdit ? "edit FAIL" : "generate FAIL");
        console.error(TAG, which, reqId, e);
      } catch (_) {}
      setStatus("bad", (e && e.message) || String(e));
    } finally {
      generateInFlight = false;
      try { updateDocInfo(); } catch (_) {}   // v0.13 — refresh readout/flag after generate/edit/compose
      if (activeApiKey() && btn) btn.classList.remove("disabled");
    }
  }

  async function actAddRefs() {
    try { console.log(TAG, "actAddRefs entry — cachedModelId=" + cachedModelId
      + " refImages.length=" + refImages.length); } catch (_) {}

    const model = MODELS[cachedModelId] || MODELS[DEFAULT_MODEL_ID];
    if (refImages.length >= model.maxRefImages) {
      try { console.log(TAG, "actAddRefs: at cap (" + model.maxRefImages + "), bail"); } catch (_) {}
      setStatus("bad", "At cap — " + model.maxRefImages + " references max for " + model.displayName + ".");
      return;
    }

    // Make the click visible in the panel even before the dialog opens.
    setStatus("busy", "Opening file picker…");

    // Make sure the UXP file-system module is actually reachable.
    let fs;
    try { fs = fsLocal(); }
    catch (e) {
      try { console.error(TAG, "fsLocal() threw:", e); } catch (_) {}
      setStatus("bad", "UXP file system unavailable: " + ((e && e.message) || String(e)));
      return;
    }
    if (!fs || typeof fs.getFileForOpening !== "function") {
      try { console.error(TAG, "fsLocal returned no getFileForOpening:", fs); } catch (_) {}
      setStatus("bad", "fsLocal.getFileForOpening missing — UXP API may have changed.");
      return;
    }

    let picked;
    try {
      picked = await fs.getFileForOpening({
        types: ["png", "jpg", "jpeg", "webp", "heic", "heif"],
        allowMultiple: true,
      });
      try { console.log(TAG, "file picker returned:", picked); } catch (_) {}
    } catch (e) {
      try { console.error(TAG, "file picker failed:", e); } catch (_) {}
      setStatus("bad", "File picker error: " + ((e && e.message) || String(e)));
      return;
    }
    if (!picked) {
      try { console.log(TAG, "file picker: user cancelled"); } catch (_) {}
      setStatus("muted", "Cancelled.");
      return;
    }
    const files = Array.isArray(picked) ? picked : [picked];
    if (!files.length) {
      try { console.log(TAG, "file picker: empty selection"); } catch (_) {}
      setStatus("muted", "No files picked.");
      return;
    }
    try { console.log(TAG, "file picker: " + files.length + " file(s) picked"); } catch (_) {}

    let added = 0, skippedType = 0, skippedCap = 0;
    for (let i = 0; i < files.length; i++) {
      if (refImages.length >= model.maxRefImages) { skippedCap = files.length - i; break; }
      const f = files[i];
      const mime = detectMime(f.name);
      if (!mime) { skippedType++; continue; }
      try {
        const buf = await f.read({ format: fmts().binary });
        const base64 = arrayBufferToBase64(buf);
        refImages.push({
          name: f.name,
          mime: mime,
          base64: base64,
          dataUrl: "data:" + mime + ";base64," + base64,
        });
        added++;
      } catch (e) {
        try { console.error(TAG, "ref read failed:", f.name, e); } catch (_) {}
        skippedType++;
      }
    }
    renderRefThumbs();
    updateRefAddState();

    if (skippedType || skippedCap) {
      const bits = [];
      if (added)       bits.push("added " + added);
      if (skippedType) bits.push("skipped " + skippedType + " unsupported");
      if (skippedCap)  bits.push(skippedCap + " over cap");
      setStatus("bad", bits.join(", ") + ".");
    }
  }

  function actDeleteRef(srcEl) {
    if (!srcEl) return;
    const idx = parseInt(srcEl.getAttribute("data-index") || "-1", 10);
    if (isNaN(idx) || idx < 0 || idx >= refImages.length) return;
    refImages.splice(idx, 1);
    renderRefThumbs();
    updateRefAddState();
  }

  // -----------------------------------------------------------------------
  // Mode / edit-type UI updates
  // -----------------------------------------------------------------------

  function promptCopyFor(activeTabArg, editType) {
    if (activeTabArg === "generate") {
      return {
        label:       "Prompt",
        placeholder: "Describe the image you want to generate…",
        button:      "Generate",
      };
    }
    if (activeTabArg === "compose") {
      switch (cachedComposeOp) {
        case "fuse":
          return {
            label:       "Optional hint",
            placeholder: "(Fuse uses a fixed unification instruction; leave blank for default)",
            button:      "Fuse",
          };
        case "refinpaint":
          return {
            label:       "Hint (optional)",
            placeholder: "e.g. 'use as the new face', 'apply to the marked region only'",
            button:      "Apply",
          };
        case "refgen":
        default:
          return {
            label:       "Prompt",
            placeholder: "Describe the new image — subject, pose, setting…",
            button:      "Generate",
          };
      }
    }
    switch (editType) {
      // ----- Group 1: selection edits — user types a HINT; we wrap it -----
      case "remove":
        return { label: "Hint (optional)",   placeholder: "e.g. 'the lamp on the left'",       button: "Apply Edit" };
      case "replace":
        return { label: "What to put here",  placeholder: "Describe the replacement…",          button: "Apply Edit" };
      case "add":
        return { label: "What to add",       placeholder: "Describe what to add…",              button: "Apply Edit" };
      case "fill":
        return { label: "Hint (optional)",   placeholder: "e.g. 'continue the water'",          button: "Apply Edit" };
      case "extend":
        return { label: "Hint (optional)",   placeholder: "e.g. 'continue the forest'",         button: "Apply Edit" };

      // ----- Group 2: whole-image presets — user types the INSTRUCTION -----
      case "lighting":
      case "recolor":
      case "style":
        return { label: "Instruction", placeholder: "Edit the starter or write your own whole-image instruction…", button: "Apply Edit" };

      // ----- Freeform whole-image (no pill picked) -----
      default:
        return { label: "Instruction", placeholder: "Type a whole-image instruction — e.g. 'restore this photo' or 'replace background with a beach at sunset'", button: "Apply Edit" };
    }
  }

  // Currently-selected selection (for showing the Recolor dual-mode hint).
  function docHasSelection() {
    try {
      const sel = psMod().app.activeDocument && psMod().app.activeDocument.selection;
      if (!sel || !sel.bounds) return false;
      const b = sel.bounds;
      return (Number(b.right) || 0) > (Number(b.left) || 0)
          && (Number(b.bottom) || 0) > (Number(b.top) || 0);
    } catch (_) { return false; }
  }

  function updateModeUi() {
    // Extend direction shows only on Select tab + Extend pill.
    const $extendField = $("extend-dir-field");
    if ($extendField) {
      $extendField.classList.toggle("hidden",
        !(activeTab === "select" && cachedEditType === "extend"));
    }

    // Prompt label / placeholder / action button text per active tab + pill.
    const copy = promptCopyFor(activeTab, cachedEditType);
    const $label = $("prompt-label");
    const $prompt = $("prompt");
    const $btn = $("generate-btn");
    if ($label)  $label.textContent = copy.label;
    if ($prompt) $prompt.setAttribute("placeholder", copy.placeholder);
    if ($btn)    $btn.textContent = copy.button;

    // Compose-tab hint — one dynamic line per op.
    const $composeHint = $("compose-hint");
    if ($composeHint && activeTab === "compose") {
      switch (cachedComposeOp) {
        case "refgen":
          $composeHint.textContent = "Add 1+ references below, then describe the new image. NB will hold the reference subject.";
          break;
        case "fuse":
          $composeHint.textContent = "Reads the flattened canvas and produces 3 unified-photograph options. Quantity is fixed at 3.";
          break;
        case "refinpaint":
          $composeHint.textContent = "Make a selection in the document and add a reference below; the model fills only the selection from the reference.";
          break;
      }
    }

    // Edit-tab hint — ONE dynamic helper line reflecting the picked pill
    // (replaces the per-pill explainer paragraphs that ate panel height).
    const $hint = $("edit-hint");
    if ($hint && activeTab === "edit") {
      switch (cachedEditType) {
        case "lighting":
          $hint.textContent = "Change how the image is lit — direction, time of day, shadows.";
          break;
        case "recolor": {
          const hasSel = docHasSelection();
          $hint.textContent = hasSel
            ? "Selection detected → masked Recolor (only the selected region changes)."
            : "Change colors or palette. Select a region first to recolor only that area.";
          break;
        }
        case "style":
          $hint.textContent = "Restyle the whole image — film look, medium, era, mood.";
          break;
        case "":
        default:
          $hint.textContent = "Pick a starter, or just type your own whole-image instruction.";
      }
    }
  }

  onTabChanged = function (newTab) {
    const known = ["generate","select","edit","compose","upscale","settings"];
    if (known.indexOf(newTab) < 0) return;
    activeTab = newTab;
    if (newTab === "select") cachedEditType = cachedSelectionPill;
    else if (newTab === "edit") cachedEditType = cachedWholePill;
    // generate / compose / settings: cachedEditType is irrelevant; leave it.
    updateModeUi();
    // v0.09 — the relevant estimate (generate-side vs upscale-side) depends
    // on the tab; refresh on every switch.
    if (typeof updateCostEstimate === "function") updateCostEstimate();
  };

  onEditTypeChanged = function (newType) {
    if (newType !== "" && !EDIT_MODES[newType]) return;
    cachedEditType = newType;

    // Sticky per-tab pill memory.
    if (activeTab === "select") cachedSelectionPill = newType;
    else if (activeTab === "edit") cachedWholePill = newType;

    // Whole-image preset pills (Lighting / Recolor / Style) pre-fill the
    // prompt textarea with their starter template. The user can edit or
    // replace it freely — the pipeline sends whatever ends up there.
    if (PRESET_TEXTS[newType]) {
      const $prompt = $("prompt");
      if ($prompt) $prompt.value = PRESET_TEXTS[newType];
    }
    updateModeUi();
  };

  onModelChanged = function (newId) {
    if (!MODELS[newId] || newId === cachedModelId) return;
    cachedModelId = newId;
    const model = MODELS[newId];

    // Repaint Resolution + Aspect pills against the new option set.
    rebuildPills("pills-resolution", model.resolutions,        defaultResFor(newId));
    rebuildPills("pills-aspect",     aspectValuesFor(newId),   defaultAspectFor(newId));

    // Enforce per-model reference cap. Keep the first N, drop the rest, warn.
    if (refImages.length > model.maxRefImages) {
      const dropped = refImages.length - model.maxRefImages;
      refImages = refImages.slice(0, model.maxRefImages);
      renderRefThumbs();
      setStatus("bad", "Dropped " + dropped + " reference image" + (dropped===1?"":"s")
        + " — " + model.displayName + " allows " + model.maxRefImages + ".");
    }
    updateRefAddState();

    // v0.06 — switching to a model whose provider key isn't saved must
    // disable Generate with a clear status (e.g. select GPT with no
    // OpenAI key saved → "Save the OpenAI API key in Settings.")
    refreshGenerateEnabled();

    saveModel(newId).catch(function (e) {
      try { console.error(TAG, "saveModel failed:", e); } catch (_) {}
    });
    // v0.12 — conditional negative-prompt field (dormant — no v0.12 engine
    // supports it; lights up only for a future model flagged supportsNegativePrompt).
    updateNegativePromptVisibility();
    updateFalOptionsVisibility();   // v0.14 — Fal options panel (safety / LoRA / caveat)
    // v0.09 — model switched → price (and the resolution pills) changed.
    if (typeof updateCostEstimate === "function") updateCostEstimate();
  };

  // Show the negative-prompt field only when the ACTIVE model declares
  // supportsNegativePrompt. v0.12: NO model sets it, so the field stays hidden —
  // the mechanism exists for a future engine (same pattern as the aspect reshape).
  function updateNegativePromptVisibility() {
    const field = $("negative-prompt-field");
    if (!field) return;
    const m = MODELS[cachedModelId] || MODELS[DEFAULT_MODEL_ID];
    const show = !!(m && m.supportsNegativePrompt);
    field.classList.toggle("hidden", !show);
  }

  // v0.14 — Fal options panel: visible ONLY when a Fal-lane model is active. The
  // safety toggle + LoRA slot show only for models that declare them. Always
  // surfaces the aggregator cost caveat so a Fal generation is never mistaken
  // for clean first-party cost.
  function updateFalOptionsVisibility() {
    const panel = $("fal-options");
    const m = MODELS[cachedModelId] || MODELS[DEFAULT_MODEL_ID];
    const isFal = !!(m && m.provider === "fal");
    if (panel) panel.classList.toggle("hidden", !isFal);
    const loraField = $("fal-lora-field");
    if (loraField) loraField.classList.toggle("hidden", !(isFal && m && m.falLora));
    const safetyField = $("fal-safety-field");
    if (safetyField) safetyField.classList.toggle("hidden", !(isFal && m && m.falSafetyToggle));
  }

  // Now that the action implementations exist, swap the placeholder
  // dispatchAction (referenced inside handleClick) for the real router.
  const ACTIONS = {
    "save-key":              actSaveKey,
    "test-key":              actTestKey,
    "show-key":              actShowKey,
    "open-key-page":         actOpenKeyPage,
    "save-openai-key":       actSaveOpenAIKey,
    "test-openai-key":       actTestOpenAIKey,
    "show-openai-key":       actShowOpenAIKey,
    "open-openai-key-page":  actOpenOpenAIKeyPage,
    "save-topaz-key":        actSaveTopazKey,
    "test-topaz-key":        actTestTopazKey,
    "show-topaz-key":        actShowTopazKey,
    "open-topaz-key-page":   actOpenTopazKeyPage,
    "save-bfl-key":          actSaveBflKey,
    "test-bfl-key":          actTestBflKey,
    "show-bfl-key":          actShowBflKey,
    "open-bfl-key-page":     actOpenBflKeyPage,
    "save-clarity-key":      actSaveClarityKey,
    "test-clarity-key":      actTestClarityKey,
    "show-clarity-key":      actShowClarityKey,
    "open-clarity-key-page": actOpenClarityKeyPage,
    "save-fal-key":          actSaveFalKey,
    "test-fal-key":          actTestFalKey,
    "show-fal-key":          actShowFalKey,
    "open-fal-key-page":     actOpenFalKeyPage,
    "generate":              actGenerate,
    "recall-accept":         actRecallAccept,
    "recall-rerun":          actRecallReRun,
    "upscale-topaz":         actUpscaleTopaz,
    "add-refs":              actAddRefs,
    "delete-ref":            actDeleteRef,
    "reset-session":         actResetSession,
    "reset-rates":           actResetRates,
  };
  dispatchAction = function (name, srcEl) {
    const fn = ACTIONS[name];
    if (fn) fn(srcEl);
    else try { console.warn(TAG, "no handler for action:", name); } catch (_) {}
  };

  // =======================================================================
  // STEP 4 — hydrate (load key, decide which view to show on entry)
  // =======================================================================

  async function hydrate() {
    // ----- API key -----
    try {
      cachedKey = await loadKey();
      try { console.log(TAG, "loaded key:", cachedKey ? "(present)" : "(none)"); } catch (_) {}
    } catch (e) {
      try { console.error(TAG, "loadKey failed:", e); } catch (_) {}
      cachedKey = "";
    }
    if (cachedKey) {
      const $key = $("api-key");
      if ($key) $key.value = cachedKey;
      setConn("ok", "saved");
    } else {
      setConn("unknown", "no key");
    }

    // ----- OpenAI key (v0.06) -----
    try {
      cachedOpenAIKey = await loadOpenAIKey();
      try { console.log(TAG, "loaded openai key:", cachedOpenAIKey ? "(present)" : "(none)"); } catch (_) {}
    } catch (e) {
      try { console.error(TAG, "loadOpenAIKey failed:", e); } catch (_) {}
      cachedOpenAIKey = "";
    }
    if (cachedOpenAIKey) {
      const $oKey = $("openai-api-key");
      if ($oKey) $oKey.value = cachedOpenAIKey;
      setConnOpenAI("ok", "saved");
    } else {
      setConnOpenAI("unknown", "no key");
    }

    // ----- Topaz key (v0.07) -----
    try {
      cachedTopazKey = await loadTopazKey();
      try { console.log(TAG, "loaded topaz key:", cachedTopazKey ? "(present)" : "(none)"); } catch (_) {}
    } catch (e) {
      try { console.error(TAG, "loadTopazKey failed:", e); } catch (_) {}
      cachedTopazKey = "";
    }
    if (cachedTopazKey) {
      const $tKey = $("topaz-api-key");
      if ($tKey) $tKey.value = cachedTopazKey;
      setConnTopaz("ok", "saved");
    } else {
      setConnTopaz("unknown", "no key");
    }

    // ----- BFL (Flux) key (v0.12) -----
    try { cachedBflKey = await loadBflKey(); } catch (_) { cachedBflKey = ""; }
    if (cachedBflKey) {
      const $bKey = $("bfl-api-key"); if ($bKey) $bKey.value = cachedBflKey;
      setConnBfl("ok", "saved");
    } else { setConnBfl("unknown", "no key"); }

    // ----- ClarityAI key (v0.12) -----
    try { cachedClarityKey = await loadClarityKey(); } catch (_) { cachedClarityKey = ""; }
    if (cachedClarityKey) {
      const $cKey = $("clarity-api-key"); if ($cKey) $cKey.value = cachedClarityKey;
      setConnClarity("ok", "saved");
    } else { setConnClarity("unknown", "no key"); }

    // ----- Fal key (v0.14) -----
    try { cachedFalKey = await loadFalKey(); } catch (_) { cachedFalKey = ""; }
    if (cachedFalKey) {
      const $fKey = $("fal-api-key"); if ($fKey) $fKey.value = cachedFalKey;
      setConnFal("ok", "saved");
    } else { setConnFal("unknown", "no key"); }

    refreshGenerateEnabled();
    refreshUpscaleEnabled();

    // ----- model + pills -----
    let savedModel = "";
    try { savedModel = await loadModel(); } catch (_) {}
    const initialModel = (savedModel && MODELS[savedModel]) ? savedModel : DEFAULT_MODEL_ID;
    cachedModelId = initialModel;
    try { console.log(TAG, "loaded model:", initialModel); } catch (_) {}

    // v0.06 — render the Model dropdown from the registry, with the saved /
    // default model preselected. Adding a provider to MODELS makes it
    // appear here automatically.
    rebuildModelDropdown(initialModel);
    // Quantity dropdown reflects the current cachedQuantity (default 1).
    setQuantityDropdown(cachedQuantity);

    // Build Resolution + Aspect pills from the model's option sets.
    const model = MODELS[initialModel];
    rebuildPills("pills-resolution", model.resolutions,            defaultResFor(initialModel));
    rebuildPills("pills-aspect",     aspectValuesFor(initialModel), defaultAspectFor(initialModel));

    // Initial ref hint.
    updateRefAddState();

    // Initial mode UI: Generate mode, prompt label/placeholder/button label.
    updateModeUi();
    updateNegativePromptVisibility();   // v0.12 — dormant (hidden) at load
    updateFalOptionsVisibility();        // v0.14 — Fal panel hidden unless a Fal model is active
    refreshUpscaleEnabled();            // v0.12 — sets Clarity creativity-field visibility

    // ----- v0.09 cost meter: load rates + threshold, paint UI -----
    await loadRates();
    await loadThreshold();
    const $warn = $("warn-threshold");
    if ($warn) $warn.value = warnThreshold > 0 ? String(warnThreshold) : "";
    await loadFluxSafety();
    const $fs = $("flux-safety-tolerance");
    if ($fs) $fs.value = String(cachedFluxSafety);
    _rebuildRatesTable();
    resetSession();          // start the PER-LAUNCH cost meter clock ("since HH:MM")
    _updateCostEstimate();

    // Per-document authorship session: baseline the current active document so
    // the initial session belongs to it, then listen for active-document
    // changes. The cost meter is intentionally NOT rotated by this.
    try {
      const _d = psMod().app.activeDocument;
      currentSessionDocId = (_d && typeof _d.id !== "undefined") ? _d.id : undefined;
    } catch (_) { currentSessionDocId = undefined; }
    registerDocChangeListener();
    updateDocInfo();   // v0.13 — initial doc-resolution readout + under-res flag

    // Default tab: Generate if a key is saved, Settings otherwise.
    // v0.06 — open Generate if EITHER provider key is saved (Generate is
    // useful even with just one). Settings if neither is.
    showViewByClass((cachedKey || cachedOpenAIKey) ? "generate" : "settings");
  }

  // hydrate is async but we don't await it — fire-and-forget. If it throws,
  // the body click listener is still live so the panel remains usable.
  hydrate().catch(function (e) {
    try { console.error(TAG, "hydrate threw:", e); } catch (_) {}
  });
})();
