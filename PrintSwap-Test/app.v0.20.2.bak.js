// KBImage Print Swap — single-file panel script.
//
// Build rules (see CLAUDE.md):
//  - No ES modules. No top-level require().
//  - Every require() is lazy (inside a function).
//  - The delegated click listener attaches at script load (top of the IIFE),
//    before anything that could throw. The script tag sits at the end of
//    <body>, so document.body already exists.

(function () {
  "use strict";
  const TAG = "[KBImage Print Swap]";

  // =======================================================================
  // 1 — attach the delegated click + keyboard listeners straight away.
  // Nothing above this line can throw, nothing below can defeat it.
  // =======================================================================

  try { console.log(TAG, "app.js loaded"); } catch (_) {}

  // Two views: "printswap" (the 9 steps) and "settings" (the gear).
  function showViewByClass(view) {
    try { console.log(TAG, "show view:", view); } catch (_) {}
    const views = document.querySelectorAll(".view");
    for (let i = 0; i < views.length; i++) views[i].classList.add("hidden");
    const target = document.getElementById("view-" + view);
    if (target) target.classList.remove("hidden");
    else try { console.error(TAG, "missing view container: view-" + view); } catch (_) {}

    const tabs = document.querySelectorAll("#pills-view .pill");            // Print Swap · Settings toggle: the shown view is selected
    for (let i = 0; i < tabs.length; i++) tabs[i].classList.toggle("selected", tabs[i].getAttribute("data-view") === view);
    if (view === "settings" && typeof adminSync === "function") { try { adminSync(); } catch (_) {} }

    if (typeof recallCheckStale === "function") { try { recallCheckStale(); } catch (_) {} }   // preview deleted while away
    if (view === "printswap") {
      const hooks = [psOnTabOpen, psPartsOnTabOpen, psPrintOnTabOpen, psTrimsOnTabOpen,
                     psEdgesOnTabOpen, psStepsOnTabOpen, psWhiteOnTabOpen];
      for (let i = 0; i < hooks.length; i++) {
        if (typeof hooks[i] === "function") { try { hooks[i](); } catch (_) {} }
      }
    }
    if (typeof updateDocInfo === "function") { try { updateDocInfo(); } catch (_) {} }
  }

  // Deferred action dispatch — replaced below once the action handlers exist.
  // Until then a click is only logged.
  let dispatchAction = function (name, srcEl) {
    try { console.warn(TAG, "action arrived before handlers ready:", name); } catch (_) {}
  };
  // Forward-declared so handleClick / handleChange can call them before the
  // definitions land.
  let updateCostEstimate = null;   // refresh the cost lines
  let onRateInput = null;          // a rate input changed
  let onThresholdInput = null;     // spend-warning threshold changed
  let onSelBleedInput = null;      // Remove print edge bleed changed

  function handleClick(e) {
    try {
      // ----- Custom dropdowns (garment type) -----
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
          if (grp === "psgtype") {
            if (typeof psSetGarmentType === "function") psSetGarmentType(val);
          } else if (grp === "pspart") {
            if (typeof psPickPart === "function") psPickPart(val);                 // step 7 "This part" picker
          }
          return;
        }
        return;   // click inside dropdown chrome but not trigger/option → swallow
      }

      const tab = e.target.closest("[data-view]");
      if (tab) {
        try { console.log(TAG, "click: view →", tab.getAttribute("data-view")); } catch (_) {}
        showViewByClass(tab.getAttribute("data-view"));
        return;
      }

      let pill = e.target.closest(".pill");
      const inner = pill && e.target.closest("[data-action]");
      if (inner && pill.contains(inner)) pill = null;       // a checkbox inside a row: its action runs, the row is not picked
      if (pill) {
        const group = pill.closest(".pills");
        if (group && group.classList.contains("ps-disabled")) return;   // grayed out (BUTTON while it follows PIPING)
        if (group) {
          try { console.log(TAG, "click: pill →", group.id, pill.getAttribute("data-value")); } catch (_) {}
          // Single-select within one group.
          const pills = group.querySelectorAll(".pill");
          for (let i = 0; i < pills.length; i++) pills[i].classList.remove("selected");
          pill.classList.add("selected");

          const value = pill.getAttribute("data-value");
          if (group.id === "pills-ps-piping-mode") {
            if (typeof psTrimsOnModeChanged === "function") psTrimsOnModeChanged();   // piping tolerance per mode
          } else if (group.id === "pills-ps-gray-chip") {
            if (typeof psOnGrayChip === "function") psOnGrayChip(value);              // step 5 target gray
          } else if (group.id.indexOf("pills-ps-tc-") === 0) {
            if (typeof psOnTrimColorChip === "function") psOnTrimColorChip(group.id.slice("pills-ps-tc-".length), value);   // step 4 trim color
          } else if (group.id === "pills-ps-tone-src" || group.id === "pills-ps-tone-print") {
            if (typeof psOnToneChip === "function") psOnToneChip(group.id === "pills-ps-tone-src" ? "src" : "print", value);   // step 8 garment / print
          } else if (group.id === "pills-ps-piping-dir") {
            if (typeof psTrimsOnDirChanged === "function") psTrimsOnDirChanged();     // Neutral: Light / Dark
          } else if (group.id === "pills-ps-bg-mode") {
            if (typeof psOnBgModeChanged === "function") psOnBgModeChanged();         // White / Lighten
          } else if (group.id === "pills-ps-parts") {
            if (typeof psOnPartPicked === "function") psOnPartPicked(value);          // part row
            if (typeof psPrintOnPartPicked === "function") psPrintOnPartPicked(value);  // part print controls
          }
          if (typeof updateCostEstimate === "function") updateCostEstimate();
        }
        return;
      }
      const actEl = e.target.closest("[data-action]");
      if (actEl) {
        // .disabled on a div-button = inert.
        if (actEl.classList && actEl.classList.contains("disabled")) return;
        const name = actEl.getAttribute("data-action");
        if (name === "open-fal-key-page" || name === "open-help") e.preventDefault();
        try { console.log(TAG, "click: action →", name); } catch (_) {}
        dispatchAction(name, actEl);
        return;
      }
    } catch (err) {
      try { console.error(TAG, "handleClick error:", err); } catch (_) {}
    }
  }

  // Delegated change handler for the Settings text inputs (no click/keydown coverage).
  function handleChange(e) {
    const t = e.target;
    if (!t) return;
    if ((t.id === "warn-threshold" || t.id === "sel-bleed" || (t.classList && t.classList.contains("rate-input"))) && typeof adminLocked === "function" && adminLocked()) {
      try { adminSync(); } catch (_) {}                    // locked by admin: put the saved value back
      return;
    }
    if (t.id === "warn-threshold") {
      if (typeof onThresholdInput === "function") onThresholdInput(t.value);
      return;
    }
    if (t.id === "ps-target-gray") {
      if (typeof psGrayFromBox === "function") psGrayFromBox();
      return;
    }
    if (t.id === "ps-garment-grow") {
      try { psRefreshUi(); } catch (_) {}
      return;
    }
    if (t.id === "sel-bleed") {
      if (typeof onSelBleedInput === "function") onSelBleedInput(t.value);
      return;
    }
    if (t.classList && t.classList.contains("rate-input")) {
      if (typeof onRateInput === "function") onRateInput(t);
      return;
    }
  }

  // Enter in a step 7 box: either Scale = Apply print, either Exact angle = that angle.
  function handleKeydown(e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    const t = e.target;
    if (!t) return;
    const tag = (t.tagName || "").toLowerCase();
    if (e.key === "Enter" && tag === "input" && t.id === "admin-pin") { e.preventDefault(); actAdminUnlock(); return; }
    if (e.key === "Enter" && tag === "input" && t.id === "ps-target-gray") { e.preventDefault(); try { t.blur(); } catch (_) {} psGrayFromBox(); return; }
    if (e.key === "Enter" && tag === "input" && (t.id === "ps-print-scale" || t.id === "ps-part-scale")) { e.preventDefault(); actPsApplyPrint(); return; }
    if (e.key === "Enter" && tag === "input" && t.id === "ps-print-rot-exact") { e.preventDefault(); actPsPrintRotate({ getAttribute: function (a) { return a === "data-set" ? "field" : null; } }); return; }
    if (e.key === "Enter" && tag === "input" && t.id === "ps-part-rot-exact") { e.preventDefault(); actPsPartAdjust({ getAttribute: function (a) { return a === "data-set" ? "field" : null; } }); return; }
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
    // Fallback — script ran before <body> for some reason.
    document.addEventListener("DOMContentLoaded", function () {
      document.body.addEventListener("click", handleClick);
      document.body.addEventListener("keydown", handleKeydown);
      document.body.addEventListener("change", handleChange);
      try { console.log(TAG, "delegated listeners attached (DOMContentLoaded)"); } catch (_) {}
    });
  }

  // =======================================================================
  // 2 — modules. Anything in here is allowed to throw; the body listener
  // above keeps buttons routing regardless.
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
  // The Fal key. Stored in UXP secureStorage only; sent only to Fal.
  const FAL_KEY_NAME = "printswap.falApiKey";
  async function saveFalKey(k) { await ssget().setItem(FAL_KEY_NAME, strToBytes(k)); }
  async function loadFalKey() {
    try {
      const b = await ssget().getItem(FAL_KEY_NAME);
      return b ? bytesToStr(b) : "";
    } catch (_) { return ""; }
  }

  // ----- the one image model: Nano Banana Pro on Fal (Remove print) -----
  // falEditPath is used whenever an image is sent (always, for Remove print).
  const DEFAULT_MODEL_ID = "gemini-3-pro-image-preview";
  const MATCH_INPUT = "Match Input";
  const MODELS = {
    "gemini-3-pro-image-preview": {
      id: "gemini-3-pro-image-preview",
      displayName: "Nano Banana Pro",
      provider:    "gemini",
      falPath:     "fal-ai/nano-banana-pro",
      falEditPath: "fal-ai/nano-banana-pro/edit",
      resolutions:  ["1K", "2K", "4K"],
      aspectRatios: [MATCH_INPUT, "1:1", "3:2", "2:3", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
      maxRefImages: 14,
    },
  };
  function defaultResFor(modelId)    { const m = MODELS[modelId]; return (m && (m.resolutions.indexOf("2K") >= 0 ? "2K" : m.resolutions[0])) || "2K"; }

  // -----------------------------------------------------------------------
  // Aspect handling for the Nano Banana request. The result is never null:
  // without an aspect_ratio the model picks its own shape.
  //   "edit"     — the base image's own size picks the nearest supported ratio.
  //   "generate" — an explicit ratio is used as is (or the nearest supported one).
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

  // Returns the aspect_ratio to send (never null) + a note on how it was
  // picked, for the log. opts.aspectMode: "generate" (default) or "edit".
  function resolveAspectForRequest(opts, modelId) {
    const mode = opts.aspectMode || "generate";
    const explicit = opts.aspectRatio;
    const tag = "[" + mode + "]";

    // ----- edit: the base image picks the shape -----
    if (mode === "edit") {
      if (opts.sourceWidth && opts.sourceHeight) {
        const r = nearestSupportedAspectOriented(modelId, opts.sourceWidth, opts.sourceHeight);
        return { ratio: r, picked: tag + " base(" + opts.sourceWidth + "x" + opts.sourceHeight + ")"
          + (explicit && explicit !== MATCH_INPUT ? " (pill " + explicit + " ignored)" : "") };
      }
      return { ratio: firstSupportedRatio(modelId), picked: tag + " no-base-default" };
    }

    // ----- generate: an explicit ratio is used; Match Input snaps the source size -----
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

  // =======================================================================
  // FAL — every AI call goes through Fal's queue API with the one key.
  //   POST https://queue.fal.run/<model path> → { status_url, response_url }
  //   poll status_url until COMPLETED → GET response_url → result JSON
  //   (falQueueJson, shared by Nano Banana Pro and SAM 3.1).
  //   Auth: "Authorization: Key <FAL_KEY>".
  // Images go to Fal as URLs: a data: URI when small, or uploaded to Fal's own
  // file storage first (rest.alpha.fal.ai → *.fal.media) when large, so a 4K
  // garment is not one huge JSON request.
  // =======================================================================
  const FAL_REST_HOST      = "https://rest.alpha.fal.ai";
  const FAL_INLINE_MAX_B64 = 3 * 1024 * 1024;   // base64 chars; larger images are uploaded

  async function safeText(res) { try { return await res.text(); } catch (_) { return ""; } }
  function shortErr(text) {
    try {
      const j = JSON.parse(text);
      if (j && j.error && j.error.message) return j.error.message;
      if (j && j.detail) return (typeof j.detail === "string") ? j.detail : JSON.stringify(j.detail).slice(0, 200);
      return text.slice(0, 200);
    } catch (_) { return (text || "").slice(0, 200); }
  }

  // Bytes → Fal file storage → the public fal.media URL to pass to a model.
  async function falUploadBytes(apiKey, buf, type) {
    const ext = (type === "image/jpeg") ? "jpg" : ((type.split("/")[1]) || "bin");
    const init = await fetch(FAL_REST_HOST + "/storage/upload/initiate?storage_type=fal-cdn-v3", {
      method: "POST", headers: falAuthHeaders(apiKey),
      body: JSON.stringify({ content_type: type, file_name: "printswap-" + Date.now() + "." + ext }),
    });
    if (!init.ok) throw new Error("upload initiate " + init.status + ": " + shortErr(await safeText(init)));
    const j = await init.json();
    if (!j || !j.upload_url || !j.file_url) throw new Error("upload initiate: no upload_url / file_url");
    const put = await fetch(j.upload_url, { method: "PUT", headers: { "Content-Type": type }, body: buf });
    if (!put.ok) throw new Error("upload PUT " + put.status + ": " + shortErr(await safeText(put)));
    return j.file_url;
  }
  // base64 image → a URL Fal can read. Small: inline data: URI. Large: uploaded
  // first; if the upload fails the image is sent inline instead (logged).
  async function falImageUrl(apiKey, base64, mime) {
    const clean = String(base64 || "").replace(/\s+/g, "");
    const type = mime || "image/png";
    if (clean.length > FAL_INLINE_MAX_B64) {
      try {
        const url = await falUploadBytes(apiKey, base64ToArrayBuffer(clean), type);
        try { console.log(TAG, "fal upload:", Math.round(clean.length * 0.75 / 1024) + " KB →", String(url).slice(0, 80)); } catch (_) {}
        return url;
      } catch (e) {
        try { console.warn(TAG, "fal upload failed, sending the image inline:", (e && e.message) || e); } catch (_) {}
      }
    }
    return "data:" + type + ";base64," + clean;
  }
  // The first image of a Fal result ({ images:[{url}] }, { images:["url"] } or
  // { image:{url} }) → { buf, mime }.
  async function falResultImage(result, label) {
    const r = result || {};
    const im = (r.images && r.images[0]) || r.image || null;
    const url = (typeof im === "string") ? im : (im && im.url);
    if (!url) {
      const why = r.description ? (" (" + String(r.description).slice(0, 200) + ")") : (" (" + shortErr(JSON.stringify(r)) + ")");
      throw new Error(label + ": Fal returned no image" + why + ".");
    }
    const u = String(url);
    let buf;
    if (u.indexOf("data:") === 0) buf = base64ToArrayBuffer(u.slice(u.indexOf(",") + 1));
    else {
      const res = await fetch(u, { method: "GET" });
      if (!res.ok) throw new Error(label + ": result image fetch failed (" + res.status + ").");
      buf = await res.arrayBuffer();
    }
    if (!buf || !buf.byteLength) throw new Error(label + ": the result image was empty.");
    return { buf: buf, mime: detectImageMime(buf) || "image/png" };
  }
  function falLogBody(path, body) {
    try {
      const dbg = Object.assign({}, body);
      const cut = function (u) { u = String(u || ""); return u.indexOf("data:") === 0 ? (u.slice(0, 30) + "…[len=" + u.length + "]") : u.slice(0, 90); };
      if (dbg.image_urls) dbg.image_urls = dbg.image_urls.map(cut);
      if (dbg.image_url) dbg.image_url = cut(dbg.image_url);
      if (dbg.mask_url) dbg.mask_url = cut(dbg.mask_url);
      if (typeof dbg.prompt === "string" && dbg.prompt.length > 160) dbg.prompt = dbg.prompt.slice(0, 157) + "…";
      console.log(TAG, "fal request →", path, JSON.stringify(dbg));
    } catch (_) {}
  }

  // ----- Nano Banana Pro on Fal -----
  // Fal takes one prompt plus an ordered image_urls list: the first image is
  // the base; any further images are references, named as such in the prompt.
  function nanoPromptText(opts, hasSource, refCount) {
    const p = opts.prompt || "";
    if (hasSource && refCount > 0) {
      return "Apply the following edit to the BASE IMAGE only. "
        + "The BASE IMAGE is the FIRST image. "
        + "There " + (refCount === 1 ? "is 1" : "are " + refCount) + " more image" + (refCount === 1 ? "" : "s")
        + " after it, labeled REFERENCE — " + (refCount === 1 ? "it is" : "those are") + " guidance only "
        + "(style, color, composition). Do NOT edit, copy out, or output the references. "
        + "Output a single edited version of the BASE IMAGE.\n\n"
        + "Edit instruction: " + p;
    }
    return p;
  }
  async function generateImageNanoBanana(apiKey, opts) {
    if (!apiKey) throw new Error("Missing Fal API key.");
    if (!opts || !opts.prompt || !opts.prompt.trim()) throw new Error("Prompt is required");
    const modelId = opts.modelId || DEFAULT_MODEL_ID;
    const model = MODELS[modelId];
    if (!model || !model.falPath) throw new Error("Unknown model: " + modelId);
    const hasSource = !!(opts.sourceImage && opts.sourceImage.base64);
    const allRefs = opts.refImages || [];
    const refs = allRefs.filter(function (r) { return r && r.base64 && r.mime; });
    if (refs.length !== allRefs.length) {
      try { console.warn(TAG, "REF COUNT MISMATCH: UI had " + allRefs.length + " refs, " + refs.length + " valid."); } catch (_) {}
    }
    const cap = model.maxRefImages || 14;   // Fal: up to 14 images in one request
    const images = [];
    if (hasSource) images.push(opts.sourceImage);
    for (let i = 0; i < refs.length && images.length < cap; i++) images.push(refs[i]);
    const refCount = images.length - (hasSource ? 1 : 0);

    // Always an explicit aspect ratio, never "auto".
    const resolved = resolveAspectForRequest(opts, modelId);
    try { console.log(TAG, "aspect resolved: " + resolved.ratio + " via " + resolved.picked + " | model=" + modelId); } catch (_) {}
    const body = {
      prompt: nanoPromptText(opts, hasSource, refCount),
      num_images: 1,
      aspect_ratio: resolved.ratio,
      output_format: "png",
    };
    if (opts.imageSize) body.resolution = opts.imageSize;   // "1K" | "2K" | "4K"
    let path = model.falPath;
    if (images.length) {
      path = model.falEditPath;
      body.image_urls = [];
      for (let i = 0; i < images.length; i++) {
        body.image_urls.push(await falImageUrl(apiKey, images[i].base64, images[i].mime || "image/png"));
      }
    }
    falLogBody(path, body);
    const result = await falQueueJson(apiKey, path, body);
    const out = await falResultImage(result, model.displayName);
    try {
      const d = decodeImageDimsFromBytes(out.buf);
      if (d) console.log(TAG, "RETURNED IMAGE: " + d.w + "x" + d.h + " requested aspect_ratio=" + resolved.ratio + " resolution=" + (body.resolution || "(default)"));
    } catch (_) {}
    return { base64: bytesToBase64(out.buf), mime: out.mime };
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

  // =======================================================================
  // FAL QUEUE — submit, poll, fetch.
  //   POST https://queue.fal.run/{path} → { request_id, status_url, response_url }
  //   GET  <status_url>   → { status: IN_QUEUE | IN_PROGRESS | COMPLETED }
  //   GET  <response_url> → the result JSON. Result image URLs are temporary,
  //   so they are fetched straight away. Fal sends no cost in the response;
  //   the cost counter uses the rates in Settings.
  // =======================================================================
  const FAL_QUEUE_HOST = "https://queue.fal.run";
  const FAL_POLL_MS    = 1500;
  const FAL_TIMEOUT_MS = 240000;

  // ----- render progress bar -------------------------------------------------
  // One thin bar (#fal-prog), moved under the button that started the run, shown
  // only while a Fal request runs: "Queued · position N" (IN_QUEUE) → "Rendering ·
  // 0:12" (IN_PROGRESS, live timer) → "Downloading", hidden when the action ends
  // (the layer is placed). While Rendering it fills toward the average of the last 5
  // render times for that model + size (kept in the plug-in data folder), never past
  // 90% before COMPLETED; no history yet → timer only. Fal's last log line shows
  // under it. An error turns it the theme error color.
  const FAL_TIMES_FILE = "fal-render-times.json";
  let falTimes = null, falProgRuns = [], falProgCall = null, falProgTimer = null;
  async function falTimesLoad() {
    if (falTimes) return falTimes;
    try { const f = await (await fsLocal().getDataFolder()).getEntry(FAL_TIMES_FILE); falTimes = JSON.parse(await f.read({ format: fmts().utf8 })) || {}; }
    catch (_) { falTimes = {}; }
    return falTimes;
  }
  async function falTimesAdd(key, ms) {
    const t = await falTimesLoad();
    t[key] = (t[key] || []).concat([Math.round(ms)]).slice(-5);
    try {
      const f = await (await fsLocal().getDataFolder()).createFile(FAL_TIMES_FILE, { overwrite: true });
      await f.write(JSON.stringify(t), { format: fmts().utf8 });
    } catch (e) { try { console.warn(TAG, "fal render times not saved:", e); } catch (_) {} }
  }
  function falTimesAvg(key) {
    const a = falTimes && falTimes[key];
    if (!a || !a.length) return 0;
    let sum = 0; for (let i = 0; i < a.length; i++) sum += a[i];
    return sum / a.length;
  }
  // Model + size: the endpoint and what sets the render size in the body.
  function falTimeKey(path, body) {
    const b = body || {}, z = b.image_size;
    const size = (z && typeof z === "object") ? (z.width + "x" + z.height)
      : [z, b.resolution, b.aspect_ratio, b.upscale_factor ? b.upscale_factor + "x" : ""].filter(function (v) { return !!v; }).join(" ");
    return path + " | " + (size || "-");
  }
  function falClock(ms) { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60); }
  // Runs = clicked actions still running; a Fal call belongs to the newest one.
  function falProgBegin(anchor) { const run = { anchor: anchor, err: false }; falProgRuns.push(run); return run; }
  function falProgEnd(run) {
    const i = falProgRuns.indexOf(run); if (i >= 0) falProgRuns.splice(i, 1);
    if (falProgCall && falProgCall.run === run && !run.err) falProgHide();
  }
  function falProgHide() {
    if (falProgTimer) { clearInterval(falProgTimer); falProgTimer = null; }
    falProgCall = null;
    const bar = $("fal-prog"); if (bar) { bar.classList.add("hidden"); bar.classList.remove("fal-prog-err"); }
  }
  // Under the button that started it: a button in a row → under the row; a
  // Re-run in a recall bar → just above that recall bar (under the step's button).
  function falProgPlace(anchor) {
    const bar = $("fal-prog");
    if (!bar || !anchor || !anchor.parentNode) return false;
    try {
      const rb = anchor.closest ? anchor.closest(".recall-bar") : null;
      if (rb && rb.parentNode) { if (bar.nextSibling !== rb) rb.parentNode.insertBefore(bar, rb); return true; }
      let host = anchor;
      const p = anchor.parentNode;
      if (p.classList && (p.classList.contains("btn-row") || p.classList.contains("key-row") || p.classList.contains("ps-main"))) host = p;
      if (host.nextSibling !== bar) host.parentNode.insertBefore(bar, host.nextSibling);
      return true;
    } catch (_) { return false; }
  }
  function falProgRender() {
    const c = falProgCall, bar = $("fal-prog");
    if (!c || !bar) return;
    const lab = $("fal-prog-label"), fill = $("fal-prog-fill"), log = $("fal-prog-log");
    let text = "", frac = -1;
    if (c.stage === "queued") text = "Queued" + (c.pos != null ? " · position " + c.pos : "");
    else if (c.stage === "rendering") {
      const el = Date.now() - c.tRun;
      text = "Rendering · " + falClock(el);
      if (c.avg > 0) frac = Math.min(0.9, el / c.avg);
    } else if (c.stage === "downloading") { text = "Downloading"; frac = 1; }
    if (lab) lab.textContent = text;
    if (fill) { fill.style.width = (frac >= 0 ? Math.round(frac * 1000) / 10 : 0) + "%"; }
    if (log) { log.textContent = c.log || ""; log.classList.toggle("hidden", !c.log); }
  }
  // Called by the two Fal pollers.
  function falProgSubmitted(path, body, submit) {
    const run = falProgRuns.length ? falProgRuns[falProgRuns.length - 1] : null;
    if (!run) return null;                                      // not started by a click: no bar
    const key = falTimeKey(path, body);
    const c = { run: run, key: key, stage: "queued", pos: null, tQueued: Date.now(), tRun: 0, avg: falTimesAvg(key), log: "" };
    if (submit && submit.queue_position != null) c.pos = submit.queue_position;
    if (!falProgPlace(run.anchor)) return null;
    run.err = false;
    falProgCall = c;
    const bar = $("fal-prog"); if (bar) { bar.classList.remove("fal-prog-err"); bar.classList.remove("hidden"); }
    if (!falProgTimer) falProgTimer = setInterval(function () { try { falProgRender(); } catch (_) {} }, 500);
    falProgRender();
    return c;
  }
  function falProgStatus(c, st) {
    if (!c || c !== falProgCall || !st) return;
    const status = String(st.status || "");
    if (status === "IN_QUEUE") { c.stage = "queued"; c.pos = st.queue_position != null ? st.queue_position : c.pos; c.tQueued = Date.now(); }
    else if (status === "IN_PROGRESS") { if (c.stage !== "rendering") { c.stage = "rendering"; c.tRun = Date.now(); } }
    else if (status === "COMPLETED") {
      if (c.stage === "rendering" || c.tQueued) falTimesAdd(c.key, Date.now() - (c.tRun || c.tQueued));
      c.stage = "downloading";
    }
    const logs = st.logs;
    if (Array.isArray(logs) && logs.length) {
      const last = logs[logs.length - 1];
      const m = String((last && (last.message != null ? last.message : last)) || "").replace(/\s+/g, " ").trim();
      if (m) c.log = m.length > 140 ? m.slice(0, 137) + "…" : m;
    }
    falProgRender();
  }
  // setStatus("bad", …) while a run's bar is up: the bar turns the error color.
  function falProgOnError() {
    const c = falProgCall, bar = $("fal-prog");
    if (!c || !bar || bar.classList.contains("hidden") || falProgRuns.indexOf(c.run) < 0) return;
    c.run.err = true;
    if (falProgTimer) { clearInterval(falProgTimer); falProgTimer = null; }
    bar.classList.add("fal-prog-err");
    const fill = $("fal-prog-fill"); if (fill) fill.style.width = "100%";
    const lab = $("fal-prog-label"); if (lab) lab.textContent = "Stopped";
  }
  function falStatusUrlWithLogs(u) { return String(u) + (String(u).indexOf("?") >= 0 ? "&" : "?") + "logs=1"; }
  function falAuthHeaders(apiKey) {
    return { "Authorization": "Key " + apiKey, "Content-Type": "application/json", "Accept": "application/json" };
  }
  async function testConnectionFal(apiKey) {
    if (!apiKey) return { ok: false, message: "empty key" };
    return { ok: true, message: "saved — run a step to verify (no free test endpoint)" };
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

  async function placeBase64AsLayer(base64, layerName) {
    const ps = psMod();
    if (!ps.app.activeDocument) throw new Error("Open a Photoshop document first.");
    const folder = await fsLocal().getDataFolder();
    const file = await folder.createFile("printswap-" + Date.now() + ".png", { overwrite: true });
    await file.write(base64ToArrayBuffer(base64), { format: fmts().binary });
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

  // =======================================================================
  // Photoshop-side editing primitives.
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


  // Reads the image dimensions straight from an ArrayBuffer header (PNG IHDR /
  // JPEG SOF) — avoids base64-encoding huge buffers just to read 24 bytes.
  // Used on every Fal result.
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
    return "image/png"; // safe default
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

  // Save / reload / delete the live selection via an alpha channel, so a mask
  // keeps the exact shape (never a bounding rectangle). batchPlay versions of
  // Select > Save Selection, Select > Load Selection and deleting that channel.
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

  // Target the RGB composite (leave layer-mask / alpha-channel editing). With a
  // mask or alpha channel targeted, "Delete channel" reports "not currently
  // available".
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

  // Rasterize layer id ONLY when it is a smart object, after making exactly that
  // layer active. Returns "rasterized", "pixels" (already a pixel layer) or
  // throws. id omitted = the active layer. Inside executeAsModal.
  async function rasterizeLayerIfSmart(id) {
    const ps = psMod();
    const doc = ps.app.activeDocument;
    if (id != null) {
      await ps.action.batchPlay(
        [{ _obj: "select", _target: [{ _ref: "layer", _id: id }], makeVisible: false,
           _options: { dialogOptions: "dontDisplay" } }],
        { synchronousExecution: true }
      );
    }
    const layer = doc && doc.activeLayers && doc.activeLayers[0];
    if (!layer || (id != null && layer.id !== id)) throw new Error("the placed layer is not the active layer.");
    let smart = true;
    try {
      const SO = ps.constants && ps.constants.LayerKind && ps.constants.LayerKind.SMARTOBJECT;
      if (SO && layer.kind !== undefined) smart = (layer.kind === SO);
    } catch (_) {}
    if (!smart) return "pixels";
    await rasterizeActiveLayer();
    return "rasterized";
  }

  // =======================================================================
  // 3 — panel state, cost counter, settings, key handlers
  // =======================================================================

  let cachedFalKey = "";
  // Remove print: extra pixels the result layer keeps past the garment area on
  // each side, inside the canvas (Settings "Edge bleed"). The mask still sets
  // the visible edge.
  const SEL_BLEED_DEFAULT = 4;
  let cachedSelBleed = SEL_BLEED_DEFAULT;
  function clampSelBleed(v) {
    const n = Math.round(Number(v));
    return isFinite(n) ? Math.max(0, Math.min(64, n)) : SEL_BLEED_DEFAULT;
  }
  // Lock against overlapping runs: only one step (or Accept / Re-run /
  // Discard) changes the document at a time.
  let generateInFlight = false;
  // A click while a run is going: the status line says so (no click ever does nothing).
  function kbBusyNote() { setStatus("bad", "Wait for the current run to finish, then click again."); }

  // =======================================================================
  // COST COUNTER (real USD, never credits).
  // Each Fal call adds its cost to the session total in the header. Nano
  // Banana Pro is priced per image at each resolution (editable in Settings);
  // SAM 3.1 is a fixed price per request (SAM_COST_USD). The total turns red
  // past the spend warning.
  // =======================================================================
  const RATES_KEY = "printswap.rates";
  const WARN_KEY  = "printswap.warnThreshold";

  const DEFAULT_RATES = {
    // Fal list price (checked 2026-10-10): $0.15 per image, 4K double.
    "gemini-3-pro-image-preview": { "1K": 0.15, "2K": 0.15, "4K": 0.30 },
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

  function perImageCost(modelId, resLabel) {
    const r = RATES[modelId];
    if (!r) return 0;
    const v = Number(r[resLabel]);
    return isFinite(v) ? v : 0;
  }
  function fmtUSD(n) {
    if (!isFinite(n)) return "$0.00";
    return "$" + (Math.round(n * 100) / 100).toFixed(2);
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
    try { if (typeof psChargeAdd === "function") psChargeAdd(usd); } catch (_) {}   // the step's Charged badge
    try { console.log(TAG, "session += " + fmtUSD(usd) + " → " + fmtUSD(sessionTotal)); } catch (_) {}
    updateSessionDisplay();
  }
  function resetSession() {
    sessionTotal = 0;
    sessionSince = new Date();
    updateSessionDisplay();
  }

  // The per-step cost lines in the Print Swap panel follow the rates.
  function _updateCostEstimate() {
    if (typeof psWhiteOnTabOpen === "function") { try { psWhiteOnTabOpen(); } catch (_) {} }
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
        row.appendChild(rateCell(id, m.resolutions[j]));
      }
      group.appendChild(row);
      host.appendChild(group);
    }
  }
  function rateCell(modelId, key) {
    const cell = document.createElement("label"); cell.className = "rate-cell";
    const cap = document.createElement("span"); cap.className = "rate-cap";
    cap.textContent = key;
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

  // ----- persistence (secureStorage) -----
  async function saveRates()  { try { await ssget().setItem(RATES_KEY, strToBytes(JSON.stringify(RATES))); } catch (e) { try { console.error(TAG, "saveRates failed:", e); } catch (_) {} } }
  async function loadRates() {
    try {
      const b = await ssget().getItem(RATES_KEY);
      if (!b) return;
      const obj = JSON.parse(bytesToStr(b));
      if (obj && typeof obj === "object") {
        // Merge over the defaults.
        const merged = cloneRates(DEFAULT_RATES);
        const ids = Object.keys(obj);
        for (let i = 0; i < ids.length; i++) {
          if (!merged[ids[i]]) continue;
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

  const SEL_BLEED_KEY = "printswap.selBleed";
  async function saveSelBleed() { try { await ssget().setItem(SEL_BLEED_KEY, strToBytes(String(cachedSelBleed))); } catch (_) {} }
  async function loadSelBleed() {
    try {
      const b = await ssget().getItem(SEL_BLEED_KEY);
      const s = b ? bytesToStr(b).trim() : "";
      cachedSelBleed = (s === "") ? SEL_BLEED_DEFAULT : clampSelBleed(s);
    } catch (_) { cachedSelBleed = SEL_BLEED_DEFAULT; }
  }

  // ----- the forward-declared hooks (called from handleClick / handleChange) -----
  updateCostEstimate = _updateCostEstimate;

  onRateInput = function (el) {
    const modelId = el.getAttribute("data-rate-model");
    const key     = el.getAttribute("data-rate-key");
    if (!modelId || !key) return;
    const raw = (el.value || "").trim().replace(/^\$/, "");
    const v = Number(raw);
    if (!RATES[modelId]) RATES[modelId] = {};
    if (raw === "" || !isFinite(v) || v < 0) {
      // Blank / invalid → back to the default for that cell.
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

  onSelBleedInput = function (val) {
    cachedSelBleed = (String(val || "").trim() === "") ? SEL_BLEED_DEFAULT : clampSelBleed(val);
    const el = $("sel-bleed");
    if (el) el.value = String(cachedSelBleed);     // show the clamped value
    saveSelBleed();
  };

  function actResetSession() { resetSession(); }
  function actResetRates() {
    if (adminLocked()) { adminSync(); return; }
    RATES = cloneRates(DEFAULT_RATES);
    saveRates();
    _rebuildRatesTable();
    _updateCostEstimate();
    updateSessionDisplay();
  }

  function $(id) { return document.getElementById(id); }
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

  function readPills(groupId, fallback) {
    const g = $(groupId);
    if (!g) return fallback;
    const sel = g.querySelector(".pill.selected");
    return (sel && sel.getAttribute("data-value")) || fallback;
  }
  // One status line at the top of the Print Swap panel, two lines at most: the result and
  // the next action. A longer message keeps its first sentence (cut at a word if it is
  // long) and its last sentence when that says what to do next; the full text goes under
  // a collapsed "Details" link and into the trace. Colors: results in normal text,
  // warnings (something to look at, a step to do first) in orange, errors in red. Only a
  // real error turns the progress bar to "Stopped".
  const STATUS_MAX = 110;                                   // about two lines at the panel's width
  const STATUS_NEXT = /\b(Accept|Click|Re-run|Check|Pick|Try|Run|Select|Set|Choose|Open|Use|Find|Make|Build|Type|Draw|Wait|Fix|Add|Zoom|Unlock|Save|Remove|Swap|Discard)\b/;
  const STATUS_ERROR = /fail|could not|couldn|error|refused|not currently available|Photoshop said|crash|cannot|can't|went wrong|timed out|server|PB changed|missing: Redo step/i;
  // Pure: sentences, split after . ! ? (and a closing quote or bracket) before a capital,
  // a quote or a digit, so "$0.16" and "1.2" stay whole.
  function statusSentences(t) {
    const out = []; let start = 0;
    for (let i = 0; i < t.length; i++) {
      const c = t.charAt(i);
      if (c !== "." && c !== "!" && c !== "?") continue;
      let j = i + 1;
      while (j < t.length && /["”’)\]]/.test(t.charAt(j))) j++;
      if (j >= t.length) break;
      if (!/\s/.test(t.charAt(j))) continue;
      let k = j; while (k < t.length && /\s/.test(t.charAt(k))) k++;
      if (k < t.length && /[A-Z“"0-9(]/.test(t.charAt(k))) { out.push(t.slice(start, j).trim()); start = k; i = k - 1; }
    }
    if (start < t.length) out.push(t.slice(start).trim());
    return out.filter(Boolean);
  }
  // Pure: { short, more } for a status text (more = null when it already fits).
  function statusShort(text) {
    const t = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
    if (t.length <= STATUS_MAX) return { short: t, more: null };
    const ss = statusSentences(t);
    let first = ss[0] || t;
    const last = ss.length > 1 ? ss[ss.length - 1] : "";
    const next = last && STATUS_NEXT.test(last) && last.length <= 80 ? last : "";
    const room = STATUS_MAX - (next ? next.length + 1 : 0);
    if (first.length > room) {                               // an earlier ". " (lower-case after it) is a cleaner end than a cut
      const dot = first.slice(0, room).search(/\.\s(?=\S)(?![^.]*$)/), d2 = first.slice(0, room).lastIndexOf(". ");
      const at = d2 > 10 ? d2 : dot;
      if (at > 10) first = first.slice(0, at + 1);
    }
    if (first.length > room) { const cut = first.slice(0, Math.max(30, room - 1)); const sp = cut.lastIndexOf(" "); first = (sp > 20 ? cut.slice(0, sp) : cut).replace(/[,;:·(–-]+$/, "") + "…"; }
    const short = first + (next ? " " + next : "");
    return { short: short, more: short === t ? null : t };
  }
  function setStatus(kind, text) {
    let k = kind;
    if (k === "bad" && !STATUS_ERROR.test(String(text || ""))) k = "warn";   // a step to do first: orange, not an error
    if (k === "ok" && /MERGED could not be rebuilt/.test(String(text || ""))) k = "bad";   // kept, but the final failed: an error
    try { if (typeof psStepNoteSync === "function") psStepNoteSync(k, text); } catch (_) {}
    const s = $("ps-status");
    if (s) {
      const sh = statusShort(text);
      while (s.firstChild) s.removeChild(s.firstChild);
      const main = document.createElement("span"); main.className = "status-main"; main.textContent = sh.short;
      s.appendChild(main);
      if (sh.more) {
        const more = document.createElement("span"); more.className = "text-link status-more"; more.setAttribute("role", "button"); more.setAttribute("tabindex", "0");
        more.setAttribute("data-action", "status-details"); more.textContent = " Details";
        const det = document.createElement("div"); det.className = "status-details hidden"; det.textContent = sh.more;
        s.appendChild(more); s.appendChild(det);
        try { if (typeof trace === "function" && k !== "busy") trace("status (" + k + "): " + sh.more); } catch (_) {}
      }
      s.className = "status " + k + " ps-status-top";
    }
    if ((k === "ok" || k === "bad" || k === "warn") && typeof psStepsRefresh === "function") { try { psStepsRefresh(); } catch (_) {} }
    if (k === "bad") { try { falProgOnError(); } catch (_) {} }   // a real error: the progress bar turns the error color ("Stopped")
  }
  function actStatusDetails() {
    const s = $("ps-status"), det = s && s.querySelector(".status-details"), more = s && s.querySelector(".status-more");
    if (!det) return;
    const open = det.classList.contains("hidden");
    det.classList.toggle("hidden", !open);
    if (more) more.textContent = open ? " Hide details" : " Details";
  }

  // ----- Admin lock -------------------------------------------------------------
  // Once a key is saved, Settings is locked: the key shows "Key saved ✓, locked by admin"
  // (no Show / edit / Save / Test), and the spend warning, edge bleed and rates are
  // read-only. The PIN is set with the first key; only a salted SHA-256 of it is kept,
  // in UXP secureStorage (never in the plug-in's files). The right PIN unlocks Settings
  // until the panel reloads. Forgot it: Reset key clears the key AND the PIN (the old
  // key is never shown) and the panel asks for a new key.
  const ADMIN_PIN_NAME = "printswap.adminPin";
  const ADMIN_PIN_ROUNDS = 4000;
  let adminPinRec = null;                                  // "salt:hash" from secureStorage, or null
  let adminUnlocked = false;                               // this panel load only
  let adminResetArmUntil = 0;
  // Pure: SHA-256 of a byte array → hex (no TextEncoder or crypto in UXP).
  function sha256Hex(bytes) {
    const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
      0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
      0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
      0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const len = bytes.length, nb = ((len + 9 + 63) >> 6) << 6, b = new Uint8Array(nb);
    b.set(bytes); b[len] = 0x80;
    const bits = len * 8; b[nb - 4] = (bits >>> 24) & 255; b[nb - 3] = (bits >>> 16) & 255; b[nb - 2] = (bits >>> 8) & 255; b[nb - 1] = bits & 255;
    b[nb - 5] = Math.floor(len / 0x20000000) & 255;
    const w = new Uint32Array(64), r = function (x, n) { return (x >>> n) | (x << (32 - n)); };
    for (let o = 0; o < nb; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = (b[o + i * 4] << 24) | (b[o + i * 4 + 1] << 16) | (b[o + i * 4 + 2] << 8) | b[o + i * 4 + 3];
      for (let i = 16; i < 64; i++) {
        const s0 = r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let a = H[0], bb = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + bb) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(function (x) { return ("00000000" + (x >>> 0).toString(16)).slice(-8); }).join("");
  }
  function adminPinHash(salt, pin) {
    let h = sha256Hex(strToBytes(salt + ":" + pin));
    for (let i = 1; i < ADMIN_PIN_ROUNDS; i++) h = sha256Hex(strToBytes(salt + h));
    return h;
  }
  async function adminLoad() {
    try { const b = await ssget().getItem(ADMIN_PIN_NAME); adminPinRec = b ? bytesToStr(b) : null; } catch (_) { adminPinRec = null; }
  }
  async function adminSetPin(pin) {
    let salt = ""; for (let i = 0; i < 16; i++) salt += Math.floor(Math.random() * 16).toString(16);
    adminPinRec = salt + ":" + adminPinHash(salt, pin);
    await ssget().setItem(ADMIN_PIN_NAME, strToBytes(adminPinRec));
  }
  function adminPinOk(pin) {
    if (!adminPinRec || !pin) return false;
    const i = adminPinRec.indexOf(":");
    return i > 0 && adminPinHash(adminPinRec.slice(0, i), pin) === adminPinRec.slice(i + 1);
  }
  function adminLocked() { return !!cachedFalKey && !!adminPinRec && !adminUnlocked; }
  // Settings face for the lock state (called on every Settings view and change).
  function adminSync() {
    const locked = adminLocked(), hasKey = !!cachedFalKey;
    const show = function (id, on) { const el = $(id); if (el) el.classList.toggle("hidden", !on); };
    show("settings-start-line", !hasKey);
    show("fal-key-editor", !locked);
    show("fal-key-locked", locked);
    show("save-fal-key", !locked); show("test-fal-key", !locked);
    show("admin-pin-new", !adminPinRec);                       // the PIN is set with the first key
    show("admin-link", locked);
    if (!locked) show("admin-box", false);
    show("admin-unlocked-line", hasKey && !!adminPinRec && adminUnlocked);
    const k = $("fal-api-key");
    if (k && locked) { k.value = ""; k.type = "password"; }   // the saved key never sits in the field while locked
    ["warn-threshold", "sel-bleed"].forEach(function (id) { const el = $(id); if (el) { el.disabled = locked; el.classList.toggle("locked", locked); } });
    const rates = document.querySelectorAll(".rate-input");
    for (let i = 0; i < rates.length; i++) { rates[i].disabled = locked; rates[i].classList.toggle("locked", locked); }
    const rr = $("reset-rates"); if (rr) rr.classList.toggle("hidden", locked);
    if (locked) {                                               // a change typed before the lock: back to what is saved
      const w = $("warn-threshold"); if (w) w.value = warnThreshold > 0 ? String(warnThreshold) : "";
      const sb = $("sel-bleed"); if (sb) sb.value = String(cachedSelBleed);
    }
  }
  function actAdminOpen() {
    const box = $("admin-box"); if (!box) return;
    box.classList.toggle("hidden");
    const n = $("admin-note"); if (n) n.textContent = "";
    const i = $("admin-pin"); if (i) { i.value = ""; try { i.focus(); } catch (_) {} }
  }
  function actAdminUnlock() {
    const i = $("admin-pin"), n = $("admin-note");
    const pin = i ? String(i.value || "") : "";
    if (i) i.value = "";
    if (!adminPinOk(pin)) { if (n) n.textContent = "Wrong PIN."; return; }   // still locked
    adminUnlocked = true;
    if (n) n.textContent = "";
    const k = $("fal-api-key"); if (k) k.value = cachedFalKey;
    adminSync();
    setConnFal("ok", "saved · unlocked until the panel reloads");
  }
  async function actAdminResetKey() {
    if (Date.now() > adminResetArmUntil) {
      adminResetArmUntil = Date.now() + 5000;
      const n = $("admin-note"); if (n) n.textContent = "Reset key clears the Fal key and the PIN. Click Reset key again within 5 seconds.";
      return;
    }
    adminResetArmUntil = 0;
    try { await ssget().removeItem(FAL_KEY_NAME); } catch (_) {}
    try { await ssget().removeItem(ADMIN_PIN_NAME); } catch (_) {}
    cachedFalKey = ""; adminPinRec = null; adminUnlocked = false;
    const k = $("fal-api-key"); if (k) { k.value = ""; k.type = "password"; }
    const n = $("admin-note"); if (n) n.textContent = "";
    setConnFal("unknown", "no key");
    adminSync();
    showViewByClass("settings");
  }

  // ----- Fal key -----
  async function actSaveFalKey() {
    if (adminLocked()) { adminSync(); return; }
    const $key = $("fal-api-key");
    const v = (($key && $key.value) || "").trim();
    if (!v) { setConnFal("bad", "empty key"); return; }
    if (!adminPinRec) {                                        // the first key: the admin PIN with it
      const pi = $("admin-pin-set"), pin = pi ? String(pi.value || "").trim() : "";
      if (pin.length < 4) { setConnFal("bad", "set an admin PIN (4 or more characters) to save the key"); return; }
      try { await adminSetPin(pin); } catch (err) { setConnFal("bad", "the PIN could not be saved: " + ((err && err.message) || err)); return; }
      if (pi) pi.value = "";
    }
    try {
      await saveFalKey(v); cachedFalKey = v;
      adminUnlocked = false;                                   // saved: locked from now on
      setConnFal("ok", "saved, locked by admin");
      adminSync();
    } catch (err) { setConnFal("bad", (err && err.message) || "save failed"); }
  }
  async function actTestFalKey() {
    if (adminLocked()) { adminSync(); return; }
    const $key = $("fal-api-key");
    const v = (($key && $key.value) || "").trim();
    if (!v) { setConnFal("bad", "empty key"); return; }
    setConnFal("busy", "saving…");
    const result = await testConnectionFal(v);
    if (result.ok) { try { await saveFalKey(v); } catch (_) {} cachedFalKey = v; setConnFal("unknown", result.message); }
    else setConnFal("bad", result.message);
  }
  function actShowFalKey() {
    if (adminLocked()) { adminSync(); return; }
    const $key = $("fal-api-key"); const $btn = $("show-fal-key");
    if (!$key || !$btn) return;
    const isPwd = $key.type === "password";
    $key.type = isPwd ? "text" : "password";
    $btn.textContent = isPwd ? "Hide" : "Show";
  }
  // HELP LINK. Set HELP_URL to the team's help page (for example the repo's
  // README on your Git host). Empty = the Help link in Settings stays hidden.
  const HELP_URL = "";
  async function actOpenHelp() {
    if (!HELP_URL) return;
    try { await shellMod().openExternal(HELP_URL); }
    catch (err) { try { console.error(TAG, "openExternal (help) failed:", err); } catch (_) {} }
  }
  async function actOpenFalKeyPage() {
    try { await shellMod().openExternal("https://fal.ai/dashboard/keys"); } catch (_) {}
  }
  function setConnFal(state, label) {
    const $dot = $("fal-conn-dot"); const $lbl = $("fal-conn-label");
    if ($dot) $dot.className = "dot dot-" + state;
    if ($lbl) $lbl.textContent = label;
  }

  // -----------------------------------------------------------------------
  // Masked results keep their own selection channel per run: the live
  // selection is saved to a new channel "kb_sel_<time>", loaded and removed
  // through its Channel object, and deleted as soon as the masks are made.
  // Leftover kb_sel_* channels are swept before each save. (A batchPlay "get"
  // of a channel by name is refused by Photoshop, so DOM objects are used.)
  // -----------------------------------------------------------------------
  const SEL_CH_PREFIX   = "kb_sel_";

  function selChannelObj(ref) {
    if (!ref) return null;
    try {
      const chans = psMod().app.activeDocument.channels;
      for (let i = 0; i < chans.length; i++) {
        const c = chans[i];
        if (!c) continue;
        if (ref.id != null) { if (c.id === ref.id) return c; }
        else if (c.name === ref.name) return c;
      }
    } catch (_) {}
    return null;
  }
  // Inside executeAsModal: remove every leftover kb_sel_* channel (earlier
  // builds left "kb_sel_tmp" copies behind). DOM remove, no batchPlay "get".
  async function selChannelsSweep() {
    try { await selectRGBChannel(); } catch (_) {}
    const list = [];
    try {
      const chans = psMod().app.activeDocument.channels;
      for (let i = 0; i < chans.length; i++) {
        const c = chans[i];
        if (c && String(c.name || "").indexOf(SEL_CH_PREFIX) === 0) list.push(c);
      }
    } catch (_) {}
    let n = 0;
    for (let i = 0; i < list.length; i++) {
      try { await list[i].remove(); n++; }
      catch (e) { try { console.warn(TAG, "selection channel sweep:", e); } catch (_) {} }
    }
    if (n) { try { console.log(TAG, "removed " + n + " old selection channel(s)"); } catch (_) {} }
    return n;
  }
  // Inside executeAsModal: the live selection → a NEW channel with its own
  // name. Returns { name, id } (id null when the host gives none).
  async function selChannelSave() {
    const name = SEL_CH_PREFIX + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
    await saveSelectionToChannel(name);
    const ch = selChannelObj({ name: name, id: null });
    if (!ch) throw new Error("the saved selection channel did not appear.");
    const id = (typeof ch.id === "number" || typeof ch.id === "string") ? ch.id : null;
    try { console.log(TAG, "selection saved to channel", name, "id=" + id); } catch (_) {}
    return { name: name, id: id };
  }
  // Inside executeAsModal: that channel → the live selection.
  async function selChannelLoad(ref) {
    const ch = selChannelObj(ref);
    if (!ch) throw new Error("the selection channel " + ref.name + " is gone.");
    try { await selectRGBChannel(); } catch (_) {}
    try { await psMod().app.activeDocument.selection.load(ch); return; }
    catch (e) { try { console.warn(TAG, "selection.load failed, trying batchPlay:", e); } catch (_) {} }
    await loadSelectionFromChannel(ref.name);   // unique name: cannot pick an old channel
  }
  // Inside executeAsModal: delete that channel. Guarded.
  async function selChannelDelete(ref) {
    try { await selectRGBChannel(); } catch (_) {}
    const ch = selChannelObj(ref);
    if (!ch) return;
    try { await ch.remove(); }
    catch (e) {
      try { console.warn(TAG, "channel.remove failed, trying batchPlay:", e); } catch (_) {}
      try { await deleteChannelByName(ref.name); } catch (_) {}
    }
  }

  // Inside executeAsModal: delete one layer by id.
  async function plDeleteLayerInModal(id) { await kbDeleteLayerSafeInModal(id); }

  // =======================================================================
  // ONE PLACEMENT ROUTINE for every AI result:
  //   1) decide the target rectangle first, in exact document pixels;
  //   2) send that area padded to the model's REAL output shape (Nano Banana's
  //      9:16 is 1536 x 2752, not exactly 9:16), recording padding and scale;
  //   3) place the returned image with ONE scale so it COVERS the frame the
  //      model was asked to draw (never smaller on any side, never stretched),
  //      centred, then cut it to the target (plus bleed for masked results);
  //   4) check the layer's bounds equal that rectangle (fix and log if not).
  // The pure maths (pl* without "InModal") is covered by tests/placement_test.js.
  // =======================================================================
  // Nano Banana Pro output sizes at 1K; 2K and 4K double / quadruple.
  const NB_OUT_1K = {
    "1:1": [1024, 1024], "2:3": [848, 1264], "3:2": [1264, 848], "3:4": [896, 1200], "4:3": [1200, 896],
    "4:5": [928, 1152], "5:4": [1152, 928], "9:16": [768, 1376], "16:9": [1376, 768], "21:9": [1584, 672],
  };
  const NB_RES_MULT = { "0.5K": 0.5, "1K": 1, "2K": 2, "4K": 4 };

  // The size the model returns for a request (opts as passed to generateImageNanoBanana). null = unknown.
  function plOutputDims(modelId, opts) {
    const m = MODELS[modelId] || MODELS[DEFAULT_MODEL_ID];
    try {
      if (m.provider === "gemini") {
        const r = resolveAspectForRequest(opts, modelId).ratio;
        const mult = NB_RES_MULT[opts.imageSize || "1K"] || 1;
        const b = NB_OUT_1K[r];
        if (b) return { w: Math.round(b[0] * mult), h: Math.round(b[1] * mult) };
        const p = parseAspectLabel(r);
        if (!p) return null;
        return { w: Math.round(1024 * mult * Math.sqrt(p.v)), h: Math.round(1024 * mult / Math.sqrt(p.v)) };
      }
      return null;
    } catch (_) { return null; }
  }
  // The size returned for a fixed ratio.
  function plRatioOutputDims(modelId, label, res) {
    return plOutputDims(modelId, { aspectRatio: label, aspectMode: "generate", imageSize: res || defaultResFor(modelId) });
  }
  // The document rectangle the WHOLE sent (padded) image stands for. One scale per axis
  // from the exact area, so rounding in the sent size cannot shift the result.
  function plFrameFromPad(area, cw, ch, plan) {
    const kx = cw / (area.right - area.left), ky = ch / (area.bottom - area.top);
    return { left: area.left - plan.ox / kx, top: area.top - plan.oy / ky,
             right: area.left + (plan.PW - plan.ox) / kx, bottom: area.top + (plan.PH - plan.oy) / ky };
  }
  // Where a RW x RH result goes so it COVERS `frame` with one scale, centred.
  function plCoverRect(frame, RW, RH) {
    const fw = frame.right - frame.left, fh = frame.bottom - frame.top;
    const s = Math.max(fw / RW, fh / RH), w = RW * s, h = RH * s;
    const cx = (frame.left + frame.right) / 2, cy = (frame.top + frame.bottom) / 2;
    return { left: cx - w / 2, top: cy - h / 2, right: cx + w / 2, bottom: cy + h / 2 };
  }
  // P scaled about (cx, cy) just enough to contain T (no change when it already does).
  function plEnsureCovers(P, T, cx, cy) {
    let f = 1;
    if (P.left > T.left && cx > T.left) f = Math.max(f, (cx - T.left) / (cx - P.left));
    if (P.right < T.right && T.right > cx) f = Math.max(f, (T.right - cx) / (P.right - cx));
    if (P.top > T.top && cy > T.top) f = Math.max(f, (cy - T.top) / (cy - P.top));
    if (P.bottom < T.bottom && T.bottom > cy) f = Math.max(f, (T.bottom - cy) / (P.bottom - cy));
    if (f <= 1) return P;
    return { left: cx + (P.left - cx) * f, top: cy + (P.top - cy) * f, right: cx + (P.right - cx) * f, bottom: cy + (P.bottom - cy) * f };
  }
  // The target plus `bleed` px on every side, clamped to the canvas.
  function plClipRect(target, bleed, docW, docH) {
    const b = Math.max(0, Math.round(bleed || 0));
    return { left: Math.max(0, target.left - b), top: Math.max(0, target.top - b),
             right: Math.min(docW, target.right + b), bottom: Math.min(docH, target.bottom + b) };
  }

  // ----- Photoshop side -----
  const plTargetOkIds = new Set();   // result layers that match their target (no low-res flag)

  // Write a result to the plug-in's data folder; its pixel size from the file header.
  async function plResultFile(base64, prefix) {
    const buf = base64ToArrayBuffer(base64);
    const dims = decodeImageDimsFromBytes(buf) || { w: 0, h: 0 };
    const ext = detectImageMime(buf) === "image/jpeg" ? "jpg" : "png";
    const folder = await fsLocal().getDataFolder();
    const f = await folder.createFile((prefix || "printswap-") + Date.now() + "." + ext, { overwrite: true });
    await f.write(buf, { format: fmts().binary });
    return { file: f, token: await fsLocal().createSessionToken(f), w: dims.w, h: dims.h, path: f.nativePath };
  }
  // Inside executeAsModal: the active layer's bounds as numbers.
  function plActiveBounds() {
    const l = psMod().app.activeDocument.activeLayers[0], b = l.bounds;
    return { left: +b.left, top: +b.top, right: +b.right, bottom: +b.bottom };
  }
  // Inside executeAsModal: a placed smart object's EXACT corners (its bounds are rounded to
  // whole pixels: a 1536 x 2752 file fitted into 2700 x 4800 is 2679.07 px wide, reported 2680).
  async function plSmartBounds(id) {
    try {
      const r = await psMod().action.batchPlay([{ _obj: "get", _target: [{ _property: "smartObjectMore" }, { _ref: "layer", _id: id }],
        _options: { dialogOptions: "dontDisplay" } }], { synchronousExecution: true });
      const t = r && r[0] && r[0].smartObjectMore && r[0].smartObjectMore.transform;
      if (!t || t.length < 8) return null;
      const xs = [t[0], t[2], t[4], t[6]].map(Number), ys = [t[1], t[3], t[5], t[7]].map(Number);
      if (xs.concat(ys).some(function (v) { return !isFinite(v); })) return null;
      return { left: Math.min.apply(null, xs), top: Math.min.apply(null, ys), right: Math.max.apply(null, xs), bottom: Math.max.apply(null, ys) };
    } catch (_) { return null; }
  }
  // Inside executeAsModal: move / scale the ACTIVE layer from its bounds onto `to`.
  async function plTransformActiveTo(cur, to) {
    const cW = cur.right - cur.left, cH = cur.bottom - cur.top, tW = to.right - to.left, tH = to.bottom - to.top;
    if (!(cW > 0 && cH > 0)) return;
    await psMod().action.batchPlay([{
      _obj: "transform",
      _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
      freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" },
      offset: { _obj: "offset",
        horizontal: { _unit: "pixelsUnit", _value: (to.left + tW / 2) - (cur.left + cW / 2) },
        vertical:   { _unit: "pixelsUnit", _value: (to.top + tH / 2) - (cur.top + cH / 2) } },
      width:  { _unit: "percentUnit", _value: tW / cW * 100 },
      height: { _unit: "percentUnit", _value: tH / cH * 100 },
      _options: { dialogOptions: "dontDisplay" },
    }], { synchronousExecution: true });
  }
  // Inside executeAsModal: keep only the part of layer `layerId` inside `rect` (Layer via
  // Copy, so pixels past the canvas go too). Returns the new layer's id.
  async function plTrimLayerToRect(layerId, rect, layerName) {
    const ps = psMod(), doc = ps.app.activeDocument;
    if (!(await kbSelectLayerById(layerId))) throw new Error("the placed result layer could not be selected.");
    await selectRect(rect.left, rect.top, rect.right, rect.bottom);
    await ps.action.batchPlay([{ _obj: "copyToLayer", _options: { dialogOptions: "dontDisplay" } }], { synchronousExecution: true });
    const nl = doc.activeLayers && doc.activeLayers[0];
    if (!nl || nl.id === layerId) throw new Error("trimming the result to its target did not make a new layer.");
    const newId = nl.id;
    await deselectAll();
    await kbDeleteLayerSafeInModal(layerId);
    await kbSelectLayerById(newId);
    try { await renameActiveLayer(layerName); } catch (_) {}
    return newId;
  }
  // Inside executeAsModal: layer `id` must cover exactly `rect` (within 1 px). If not, fit
  // it and write the before / after sizes to the session log.
  async function plCheckBounds(id, rect, what) {
    await kbSelectLayerById(id);
    const before = plActiveBounds();
    const near = function (b) {
      return Math.abs(b.left - rect.left) <= 1 && Math.abs(b.top - rect.top) <= 1 && Math.abs(b.right - rect.right) <= 1 && Math.abs(b.bottom - rect.bottom) <= 1;
    };
    let after = before, fixed = false;
    if (!near(before)) {
      try { console.warn(TAG, "placement: " + what + " layer " + JSON.stringify(before) + " is not its target " + JSON.stringify(rect) + "; fitting it"); } catch (_) {}
      await plTransformActiveTo(before, rect);
      after = plActiveBounds(); fixed = true;
      try {
        const rec = logRecordSkeleton("placement:fix", { what: what, target: rect, before: before, after: after }, id, null);
        rec.committed = true;   // a correction note, not a result the designer reviews
        await logRun(rec);
      } catch (_) {}
    }
    const ok = near(after);
    try { console.log(TAG, "placement: " + what + " layer " + JSON.stringify(after) + (ok ? " = target" : " NOT target " + JSON.stringify(rect)) + (fixed ? " (fixed)" : "")); } catch (_) {}
    if (ok) plTargetOkIds.add(id);
    lastPlacementCheck = { what: what, target: rect, before: before, after: after, ok: ok, fixed: fixed };
    return lastPlacementCheck;
  }
  let lastPlacementCheck = null;   // the last bounds check (console / tests)

  // Inside executeAsModal: THE placement. `res` is a plResultFile; g = { frame, target,
  // bleed, what }. Places the result so it covers g.frame with one scale, cuts it to
  // g.target + bleed (clamped to the canvas), checks the bounds. The user's selection is
  // kept unless g.keepSelection === false. Returns the result layer's id.
  async function plPlaceInModal(res, layerName, g) {
    const ps = psMod(), doc = ps.app.activeDocument;
    const docW = Math.round(doc.width), docH = Math.round(doc.height);
    let saved = null;
    if (g.keepSelection !== false) {
      try { const sb = doc.selection && doc.selection.bounds; if (sb && (+sb.right - +sb.left) > 0) saved = await selChannelSave(); } catch (_) { saved = null; }
    }
    try {
      await deselectAll();
      await ps.action.batchPlay([{
        _obj: "placeEvent", target: { _path: res.token },
        freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" },
        offset: { _obj: "offset", horizontal: { _unit: "pixelsUnit", _value: 0 }, vertical: { _unit: "pixelsUnit", _value: 0 } },
        _options: { dialogOptions: "dontDisplay" },
      }], { synchronousExecution: true });
      let id = doc.activeLayers[0].id;
      try { await renameActiveLayer(layerName); } catch (_) {}
      const cur = (await plSmartBounds(id)) || plActiveBounds();
      // The file's own size; Photoshop keeps its shape when it fits it on placing.
      const RW = res.w || (cur.right - cur.left), RH = res.h || (cur.bottom - cur.top);
      const clip0 = plClipRect(g.target, g.bleed || 0, docW, docH);
      let P = plCoverRect(g.frame, RW, RH);
      if (g.anchor) P = plEnsureCovers(P, clip0, g.anchor.x, g.anchor.y);   // keep an anchored point in place, still cover
      // Half a pixel past the cut on every side (one scale), so the edge column is never part-empty.
      const ax = g.anchor ? g.anchor.x : (P.left + P.right) / 2, ay = g.anchor ? g.anchor.y : (P.top + P.bottom) / 2;
      P = plEnsureCovers(P, { left: clip0.left - 0.5, top: clip0.top - 0.5, right: clip0.right + 0.5, bottom: clip0.bottom + 0.5 }, ax, ay);
      await plTransformActiveTo(cur, P);
      await rasterizeLayerIfSmart(id);
      const clip = plClipRect(g.target, g.bleed || 0, docW, docH);
      const b = plActiveBounds();
      if (b.left < clip.left - 0.01 || b.top < clip.top - 0.01 || b.right > clip.right + 0.01 || b.bottom > clip.bottom + 0.01) {
        id = await plTrimLayerToRect(id, clip, layerName);
      }
      await plCheckBounds(id, clip, g.what || layerName);
      try { console.log(TAG, "placement: " + (g.what || layerName) + " result " + RW + "x" + RH + " covers frame " + JSON.stringify(g.frame) + " at " + JSON.stringify(P) + ", cut to " + JSON.stringify(clip)); } catch (_) {}
      return id;
    } finally {
      if (saved) {
        try { await deselectAll(); await selChannelLoad(saved); } catch (_) {}
        try { await selChannelDelete(saved); } catch (_) {}
        try { await selectRGBChannel(); } catch (_) {}
      }
    }
  }

  // =======================================================================
  // SESSION LOG (append-only, one JSONL file per document in the plug-in's
  // data folder). Every run is written the moment its preview exists, with
  // committed:false; Accept flips committed to true. Records are never deleted
  // or reordered. Params are trimmed so no image bytes enter the log.
  // The session follows the active document; the cost counter does not (it
  // runs per launch, across documents).
  // =======================================================================
  let   sessionId  = "sess-" + Date.now().toString(36) + "-0";
  let   __sessionSeq = 0;
  let   __logSeq   = 0;
  const sessionLog = [];   // in-memory source of truth (recorded as it happens)
  // Which document the current session belongs to. Baselined in
  // hydrate; compared against the active doc to detect a switch.
  let   currentSessionDocId = undefined;

  function newSessionId() {
    return "sess-" + Date.now().toString(36) + "-" + (++__sessionSeq);
  }
  // One log file per session (= per document).
  function currentLogFileName() {
    return "printswap-session-" + sessionId + ".jsonl";
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
    return {
      id: "rec-" + now.toString(36) + "-" + (++__logSeq),
      sessionId: sessionId,
      ts: now,                       // epoch ms
      tsISO: isoFromMs(now),         // convenience, human-readable
      op: op,
      routedVia: "fal",              // every call goes through Fal
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
      try { globalThis.__printswapLogPath = file.nativePath; } catch (_) {}
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
  // PER-DOCUMENT SESSION. When the active document changes, the session log
  // starts a new file and any pending preview is released (its layer stays in
  // its own document). The cost counter is not touched.
  // =======================================================================

  // Best-effort: remove a leftover temp selection channel in the now-active
  // document. Guarded; a missing channel or a busy host is harmless.
  async function clearTempSelChannel() {
    const ps = psMod();
    if (!ps.app.activeDocument) return;
    await ps.core.executeAsModal(async function () {
      try { await selChannelsSweep(); }
      catch (e) { try { console.warn(TAG, "clearTempSelChannel:", e); } catch (_) {} }
    }, { commandName: "KBImage — clear temp channel" });
  }

  // Start a new session for a new active document. Sets the doc id
  // FIRST so concurrent listener fires no-op. Does NOT touch the cost counter.
  async function rotateDocSession(newDocId, reason) {
    const prevId = currentSessionDocId;
    currentSessionDocId = newDocId;
    sessionId = newSessionId();
    sessionLog.length = 0;                 // empty IN PLACE so __printswapLog ref stays valid
    __logSeq = 0;
    try { globalThis.__printswapSessionId = sessionId; } catch (_) {}
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
    await rotateDocSession(id, reason);
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
      // refresh the doc-resolution readout + under-res flag on the SAME
      // events (new layer arrives / active layer or document changes).
      try { updateDocInfo(); } catch (_) {}
      try { recallCheckStale(); } catch (_) {}   // preview layer deleted in Photoshop
      try { psGtypeFollowDoc(); } catch (_) {}   // the garment type belongs to the active document
      try { psGarmentNoteCheck(); } catch (_) {} // selection note follows the active document
    };
    // added paste/placeEvent/delete so the under-res flag catches a
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

  // DOCUMENT SIZE READOUT + LOW-RESOLUTION LAYER NOTE (header bar).
  // Readout: the active document's pixel size. Note: the active layer's pixel
  // size (its bounds) against the document; below it → a red note, for
  // information only (never a blocker). Not shown while the Print Swap panel
  // is open, since its layers cover single parts by design. Plain property
  // reads (no modal). A smart object scaled UP inside its bounds is not caught.
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

    let lw = 0, lh = 0, skip = false;
    try {
      const layer = doc.activeLayers && doc.activeLayers[0];
      if (layer && layer.bounds) {
        const b = layer.bounds;
        lw = Math.round(Number(b.right) - Number(b.left));
        lh = Math.round(Number(b.bottom) - Number(b.top));
      }
      // A result that matches its placement target is not low-res.
      if (layer && plTargetOkIds.has(layer.id)) skip = true;
      const psv = document.getElementById("view-printswap");
      if (psv && !psv.classList.contains("hidden")) skip = true;
    } catch (_) {}

    // 1% tolerance so a near-full-canvas layer does not trip on rounding.
    const below = !skip && (lw > 0 && lh > 0 && dw > 0 && dh > 0)
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
  // ACCEPT / RE-RUN / DISCARD.
  // Every step that changes the document runs through runWithRecall: its
  // result is a preview (layers and / or channels the retoucher can see),
  // then
  //   Accept  — keep it (the log record turns committed:true);
  //   Re-run  — delete it and run the step again with the current settings;
  //   Discard — delete it and stop.
  // Nothing is kept without Accept. A new run replaces a preview still waiting.
  // =======================================================================
  let pendingRecall = null;   // the live preview waiting for Accept / Re-run / Discard

  function allPreviewLayerIds(pr) {
    if (!pr) return [];
    return (pr.layerIds || []).filter(function (x) { return x != null; });
  }

  // The recall bar is moved under the button of the step that ran.
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

  // Delete preview layer(s) by id, inside executeAsModal. For each id:
  //   1) select the layer by _id (with the underscore — a bare `target` key is
  //      ignored and Delete would hit whatever layer is active). A layer that
  //      is already gone throws here and is skipped;
  //   2) selectRGBChannel(), since with a mask / alpha channel targeted
  //      "Delete" reports "not currently available";
  //   3) delete that layer by _id.
  // Every step is guarded; a missing layer never throws out.
  async function deleteLayersById(ids) {
    if (!ids || !ids.length) return [];
    const ps = psMod();
    if (!ps.app.activeDocument) return [];
    const fails = [];
    await ps.core.executeAsModal(async function () {
      for (let i = 0; i < ids.length; i++) {                 // one at a time: a failure never stops the rest
        const f = await kbDeleteLayerSafeInModal(ids[i]);
        if (f) fails.push(f);
      }
    }, { commandName: "KBImage — discard preview" });
    return fails;
  }
  // EVERY layer delete goes through here (inside executeAsModal): the layer must still be
  // there; it, everything in it and every group it sits in get Lock None; then it is
  // deleted by id (DOM delete as a second try). Never throws and never leaves a dialog:
  // returns null when the layer is gone, else { id, name, why }, also kept in
  // kbDeleteFails for the status line (kbDeleteFailNote).
  let kbDeleteFails = [];
  async function kbDeleteLayerSafeInModal(id) {
    if (id == null) return null;
    const l = kbLayerById(id);
    if (!l) return null;                                     // already gone
    let name = "layer " + id; try { name = String(l.name); } catch (_) {}
    try {
      await kbUnlockTreeInModal(l);
      let p = null; try { p = l.parent; } catch (_) {}
      for (let k = 0; p && k < 20; k++) {                    // a locked group locks what is in it
        if (p.id == null || !kbLayerById(p.id)) break;
        await kbUnlockOneInModal(p);
        try { p = p.parent; } catch (_) { p = null; }
      }
    } catch (_) {}
    let why = null;
    const del = async function () {
      await psMod().action.batchPlay([{ _obj: "delete", _target: [{ _ref: "layer", _id: id }], _options: { dialogOptions: "dontDisplay" } }],
        { synchronousExecution: true });
    };
    try {                                                    // nothing selected (no mask targeted), then delete by id
      await psMod().action.batchPlay([{ _obj: "selectNoLayers", _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
        _options: { dialogOptions: "dontDisplay" } }], { synchronousExecution: true });
    } catch (_) {}
    try { await del(); } catch (e) { why = (e && e.message) || String(e); }
    if (kbLayerById(id)) {                                   // second try: the layer itself selected, off any mask target
      if (await kbSelectLayerById(id)) { try { await selectRGBChannel(); } catch (_) {} }
      try { await del(); why = null; } catch (e) { why = why || (e && e.message) || String(e); }
    }
    if (kbLayerById(id)) { try { await l.delete(); } catch (e) { why = why || (e && e.message) || String(e); } }
    if (!kbLayerById(id)) return null;
    const f = { id: id, name: name, why: why || "Photoshop kept it" };
    kbDeleteFails.push(f);
    traceErr("delete " + name + " (" + id + ")", new Error(f.why));
    return f;
  }
  // EVERY layer-mask delete goes through here (inside executeAsModal): layer `id` must still be
  // there and have a mask (no mask: skipped, nothing is sent). It is selected and checked to be
  // the active layer first, so the delete never lands on whatever layer happened to be active
  // (a locked trim gave "The command Delete is not currently available"). apply = the mask is
  // applied to the pixels. Throws naming the layer and Photoshop's reason.
  async function kbDeleteMaskInModal(id, apply, what) {
    const l = kbLayerById(id);
    if (!l) return false;
    let name = what || ("layer " + id); try { if (!what) name = String(l.name); } catch (_) {}
    if ((await psLayerHasMask(id)) === false) return false;
    await kbSelectLayerById(id);
    if (kbActiveLayerId() !== id) throw new Error(name + " could not be selected, so its mask was not " + (apply ? "applied" : "deleted") + ".");
    const d = { _obj: "delete", _target: [{ _ref: "channel", _enum: "channel", _value: "mask" }], _options: { dialogOptions: "dontDisplay" } };
    if (apply) d.apply = true;
    try { await psMod().action.batchPlay([d], { synchronousExecution: true }); }
    catch (e) { throw new Error((apply ? "Applying " : "Deleting ") + "the mask of " + name + " failed — Photoshop said: " + ((e && e.message) || String(e))); }
    try { await selectRGBChannel(); } catch (_) {}
    return true;
  }
  // The layers that could not be removed since the last call, for the status line ("" if none).
  function kbDeleteFailNote() {
    const f = kbDeleteFails; kbDeleteFails = [];
    if (!f.length) return "";
    return "Could not remove " + f.map(function (x) { return x.name + " (" + String(x.why).replace(/[.\s]+$/, "") + ")"; }).join(", ") + ". Unlock and delete " + (f.length === 1 ? "it" : "them") + " in Layers.";
  }
  // Inside executeAsModal: one layer's locks off (DOM flags), then Lock None by id, which also
  // clears a lock the DOM does not report (the lock icon stays).
  async function kbUnlockOneInModal(l) {
    if (!l) return;
    ["allLocked", "pixelsLocked", "positionLocked", "transparentPixelsLocked"].forEach(function (k) {
      try { if (l[k]) l[k] = false; } catch (_) {}
    });
    try {
      await psMod().action.batchPlay([{ _obj: "applyLocking", _target: [{ _ref: "layer", _id: l.id }],
        layerLocking: { _obj: "layerLocking", protectNone: true }, _options: { dialogOptions: "dontDisplay" } }], { synchronousExecution: true });
    } catch (_) {}
  }
  // Inside executeAsModal: every lock off on a layer and, for a group, everything in it.
  async function kbUnlockTreeInModal(l) {
    if (!l) return;
    await kbUnlockOneInModal(l);
    let kids = null; try { kids = l.layers; } catch (_) {}
    if (kids) for (let i = 0; i < kids.length; i++) await kbUnlockTreeInModal(kids[i]);
  }

  // Run a step through Accept / Re-run / Discard.
  //   descriptor = {
  //     op, params, targetLayerId, sourceRef,
  //     execute:        async (params) => ({ layerIds, state, beforeSnapshotRef, afterSnapshotRef }),
  //     paramsProvider: () => params      // optional; re-read on Re-run so the
  //                                       // current panel settings are used
  //   }
  // Optional hooks:
  //   onSettle(state, accepted)  — the preview's fate is decided (true on
  //                                Accept, false on Discard / a new run).
  //   reRunPrep(state)           — about to Re-run: restore what the next run needs.
  //   preDiscard(state, layerIds, info) — read anything the retoucher changed on
  //                                the preview before Re-run or a new run deletes it.
  //   previewChannels(state)     — channel names the preview lives in (trims).
  //   discard(state, layerIds)   — the step deletes its own preview on Discard.
  let kbChargeContinue = null;          // the anchor whose Charged badge the next run adds to (Re-run)
  async function runWithRecall(descriptor) {
    // A new run replaces a preview still waiting: delete its layer(s) and
    // release its state; its log record stays committed:false.
    if (pendingRecall && descriptor && descriptor.psAnchor && pendingRecall.descriptor && pendingRecall.descriptor.psAnchor === descriptor.psAnchor) kbChargeContinue = descriptor.psAnchor;
    if (pendingRecall) {
      const prev = pendingRecall;
      pendingRecall = null;
      const prevIds = allPreviewLayerIds(prev);
      if (prev.descriptor && typeof prev.descriptor.preDiscard === "function") {
        try { await prev.descriptor.preDiscard(prev.state, prevIds); } catch (_) {}
      }
      if (prevIds.length) { try { await deleteLayersById(prevIds); } catch (_) {} }
      if (prev.descriptor && typeof prev.descriptor.onSettle === "function") {
        try { await prev.descriptor.onSettle(prev.state, false); } catch (_) {}
      }
    }
    hideRecallBar();

    const result = await descriptor.execute(descriptor.params);
    const state = (result && result.state) || null;

    const layerIds = (result && Array.isArray(result.layerIds))
      ? result.layerIds.filter(function (x) { return x != null; })
      : [];
    // Write the run to the log now (committed:false until Accept).
    const rec = logRecordSkeleton(descriptor.op, descriptor.params, descriptor.targetLayerId, descriptor.sourceRef);
    rec.beforeSnapshotRef = (result && result.beforeSnapshotRef) || null;
    rec.afterSnapshotRef  = (result && result.afterSnapshotRef)  || null;
    await logRun(rec);

    // Nothing landed (no layer, no preview channel — e.g. SAM found no
    // buttons): there is nothing to Accept, so no preview is left waiting.
    if (!layerIds.length && !recallPreviewChannels({ descriptor: descriptor, state: state }).length) {
      if (typeof descriptor.onSettle === "function") { try { await descriptor.onSettle(state, false); } catch (_) {} }
      return { previewLayerId: null, previewLayerIds: [], accept: recallAccept, reRun: recallReRun };
    }
    pendingRecall = { recordId: rec.id, layerIds: layerIds, descriptor: descriptor, state: state };
    showRecallBar("Preview ready.");

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
    const recId = pendingRecall.recordId;
    pendingRecall = null;
    hideRecallBar();
    await logFinalizeCommitted(recId);   // the only thing that commits
    let msg = null;                      // onSettle may name what Accept did
    if (descriptor && typeof descriptor.onSettle === "function") {
      try { msg = await descriptor.onSettle(state, true); } catch (_) {}
    }
    if (msg && typeof msg === "object" && msg.text) setStatus(msg.kind || "ok", msg.text);
    else setStatus("ok", typeof msg === "string" && msg ? msg : "Accepted — kept in the document.");
  }

  // Discard: drop the preview without a new run. A step with a
  // descriptor.discard(state, layerIds) hook deletes its own preview;
  // otherwise the preview layer(s) are deleted. The log record stays
  // committed:false. Returns the hook's result, or "wait" when the hook
  // asked for a second click.
  async function recallDiscard() {
    if (!pendingRecall) return null;
    const pr = pendingRecall, d = pr.descriptor, ids = allPreviewLayerIds(pr);
    let r = null;
    if (d && typeof d.discard === "function") {
      r = await d.discard(pr.state, ids);
      if (r === "wait") return r;
    } else if (ids.length) {
      await deleteLayersById(ids);
    }
    pendingRecall = null;
    hideRecallBar();
    if (d && typeof d.onSettle === "function") { try { await d.onSettle(pr.state, false); } catch (_) {} }
    return r;
  }
  // A preview deleted in Photoshop (not via the panel): the panel drops it
  // (bar hidden, run state released). Called on every document event. A
  // preview with several layers clears when all are gone. A preview that lives
  // in channels (trims) names them with descriptor.previewChannels(state); it
  // is gone when its layers and channels are.
  function recallPreviewChannels(pr) {
    const d = pr && pr.descriptor;
    if (!d || typeof d.previewChannels !== "function") return [];
    try { return (d.previewChannels(pr.state) || []).filter(Boolean); } catch (_) { return []; }
  }
  function recallCheckStale() {
    if (!pendingRecall || generateInFlight) return;
    const ids = allPreviewLayerIds(pendingRecall), chans = recallPreviewChannels(pendingRecall);
    if (ids.some(function (id) { return !!kbLayerById(id); })) return;
    if (chans.some(function (c) { return kbChannelExists(c); })) return;
    const pr = pendingRecall;
    pendingRecall = null;
    hideRecallBar();
    try { console.log(TAG, "preview (" + ids.concat(chans).join(", ") + ") is gone from the document; preview cleared."); } catch (_) {}
    if (pr.descriptor && typeof pr.descriptor.onSettle === "function") {
      Promise.resolve().then(function () { return pr.descriptor.onSettle(pr.state, false); }).catch(function () {});
    }
    setStatus("ok", "Preview removed.");
  }

  async function recallReRun(overrides) {
    if (!pendingRecall) return;
    const descriptor = pendingRecall.descriptor;
    const state      = pendingRecall.state;
    const allIds     = allPreviewLayerIds(pendingRecall);
    pendingRecall = null;
    hideRecallBar();
    if (descriptor && typeof descriptor.preDiscard === "function") {
      try { await descriptor.preDiscard(state, allIds, { reRun: true }); } catch (_) {}   // tells Re-run apart from a new run
    }
    // Delete the preview layer(s). Their log record stays committed:false.
    try { await deleteLayersById(allIds); } catch (_) {}
    // Restore what the next run needs (e.g. reload a selection).
    if (descriptor && typeof descriptor.reRunPrep === "function") {
      try { await descriptor.reRunPrep(state); } catch (_) {}
    }
    // Fresh params: paramsProvider re-reads the panel; explicit overrides win.
    let nextParams = descriptor.params;
    if (typeof descriptor.paramsProvider === "function") {
      try { nextParams = descriptor.paramsProvider(); } catch (_) {}
    }
    if (overrides && typeof overrides === "object") {
      nextParams = Object.assign({}, nextParams, overrides);
    }
    const nextDescriptor = Object.assign({}, descriptor, { params: nextParams });
    if (descriptor && descriptor.psAnchor) kbChargeContinue = descriptor.psAnchor;   // Re-run: the Charged badge adds up
    return runWithRecall(nextDescriptor);
  }

  // Recall-bar buttons. They respect the in-flight lock: Re-run makes real API
  // calls and must not overlap another run.
  async function actRecallAccept() {
    if (generateInFlight) { kbBusyNote(); return; }
    generateInFlight = true;
    kbDeleteFails = [];
    try { await recallAccept(); }
    catch (e) { try { setStatus("bad", (e && e.message) || String(e)); } catch (_) {} }
    finally { generateInFlight = false; kbDeleteFailShow(); }
  }
  // After a run: what could not be deleted goes in the status line, in red, after its message.
  function kbDeleteFailShow() {
    const note = kbDeleteFailNote();
    if (!note) return;
    let was = ""; try { was = $("ps-status").textContent || ""; } catch (_) {}
    setStatus("bad", (was ? was.replace(/\s*$/, "") + " " : "") + note);
  }
  async function actRecallDiscard() {
    if (generateInFlight) { kbBusyNote(); return; }
    generateInFlight = true;
    kbDeleteFails = [];
    let r = null;
    try {
      setStatus("busy", "Discarding…");
      r = await recallDiscard();
      if (r === "wait") return;                                     // the hook already said why
      setStatus("ok", "Discarded.");
    } catch (e) {
      try { setStatus("bad", "Discard failed: " + ((e && e.message) || String(e))); } catch (_) {}
    } finally {
      generateInFlight = false;
      try { updateDocInfo(); } catch (_) {}
      kbDeleteFailShow();
    }
  }
  async function actRecallReRun() {
    if (generateInFlight) { kbBusyNote(); return; }
    generateInFlight = true;
    kbDeleteFails = [];
    const rrBtns = document.querySelectorAll(".recall-rerun");
    for (let i = 0; i < rrBtns.length; i++) rrBtns[i].classList.add("disabled");
    try {
      setStatus("busy", "Discarding preview & re-running…");
      await recallReRun();
      // a step may word its own Re-run result (descriptor.reRunStatus(params))
      const rd = pendingRecall && pendingRecall.descriptor;
      let rmsg = null;
      try { if (rd && typeof rd.reRunStatus === "function") rmsg = rd.reRunStatus(rd.params); } catch (_) {}
      setStatus("ok", rmsg || "Preview ready — review, then Accept, Re-run or Discard.");
    } catch (e) {
      try { setStatus("bad", (e && e.message) || String(e)); } catch (_) {}
    } finally {
      generateInFlight = false;
      for (let i = 0; i < rrBtns.length; i++) rrBtns[i].classList.remove("disabled");
      kbDeleteFailShow();
    }
  }

  // =======================================================================
  // SAM 3.1 MASKS + PIXEL HELPERS (shared by every Print Swap step).
  //
  // A mask is CUT FROM THE DOCUMENT'S OWN PIXELS, never drawn by an image
  // model: SAM 3.1 (fal-ai/sam-3-1/image) segments the picture from a text
  // prompt → mask image(s) → a plane on a gw × gh grid → edges refined
  // against the photo → saved as a named alpha channel ("KBPS …"). Channels
  // live in the PSD and stay editable in the Channels panel. Prints are the
  // retoucher's REAL print files, tiled by arithmetic, never generated.
  // SAM is billed by Fal per request (SAM_COST_USD).
  //
  // Needs an RGB, 8-bit document (kbDocProblem says so otherwise).
  // =======================================================================
  const KB_TMP_LAYER   = "kb_tmp_place";          // temp placed layer (always deleted)
  const SAM_FAL_PATHS    = { sam3: "fal-ai/sam-3/image", sam31: "fal-ai/sam-3-1/image" };   // same request/response shape
  function kbSamPath() { return SAM_FAL_PATHS.sam31; }
  const SAM_COST_USD     = 0.005;                  // Fal list price per request
  const SAM_MIN_SCORE    = 0.3;                    // masks SAM scores below this are dropped (unsure → junk)
  const SAM_MAX_EDGE     = 2048;                   // long edge sent to SAM (it works ~1K internally)
  const SAM_MAX_MASKS    = 8;                      // "All matches" cap
  const KB_MAX_PIXELS  = 120 * 1000 * 1000;      // guard: doc-sized mask buffer
  const KB_TEX_MAX     = 4096;                   // max tile texture edge read back from PS

  let   kbGarmentLayerId = null;                 // garment layer fallback for kbActiveLayerId / kbGarmentSourceLayer (unset = none)
  let traceLines = [];
  function traceStart(label) { traceLines = []; trace("=== " + label + " ==="); }
  function trace(msg) {
    try { traceLines.push(new Date().toISOString().slice(11, 23) + " " + msg); } catch (_) {}
    try { console.log(TAG, "trace:", msg); } catch (_) {}
  }
  function traceErr(where, e) {
    let m = "";
    try { m = (e && e.message) || String(e); } catch (_) { m = "?"; }
    let st = "";
    try { st = (e && e.stack) ? String(e.stack).split("\n").slice(0, 6).join(" | ") : ""; } catch (_) {}
    trace("ERROR at " + where + ": " + m + (st ? "  [stack] " + st : ""));
  }
  async function traceFlush() {
    try {
      const folder = await fsLocal().getDataFolder();
      const f = await folder.createFile("printswap-trace.txt", { overwrite: true });
      await f.write(traceLines.join("\n") + "\n", { format: fmts().utf8 });
    } catch (_) {}
  }

  function kbNum(id, fallback, lo, hi) {
    const el = $(id);
    const raw = String((el && el.value) || "").trim();
    let n = raw === "" ? fallback : Number(raw);
    if (!isFinite(n)) n = fallback;
    if (n < lo) n = lo;
    if (n > hi) n = hi;
    return n;
  }

  // "#RRGGBB" / "RRGGBB" / "#RGB" → [r,g,b] or null.
  function kbParseHex(hex) {
    let s = String(hex == null ? "" : hex).trim().replace(/^#/, "");
    if (/^[0-9a-fA-F]{3}$/.test(s)) s = s.charAt(0) + s.charAt(0) + s.charAt(1) + s.charAt(1) + s.charAt(2) + s.charAt(2);
    if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  }

  async function kbSelectLayerById(id) {
    if (id == null || !kbLayerById(id)) return false;
    psPanelLayerSelAt = Date.now();                     // the panel's own select: the Layers listener skips it
    try {
      await psMod().action.batchPlay(
        [{ _obj: "select",
           _target: [{ _ref: "layer", _id: id }],
           makeVisible: false,
           _options: { dialogOptions: "dontDisplay" } }],
        { synchronousExecution: true }
      );
      return true;
    } catch (_) { return false; }
  }

  function kbLayerName(id) {
    let found = "";
    function walk(list) {
      if (!list || found) return;
      for (let i = 0; i < list.length && !found; i++) {
        const l = list[i];
        if (l && l.id === id) { found = String(l.name || ""); return; }
        try { if (l && l.layers && l.layers.length) walk(l.layers); } catch (_) {}
      }
    }
    try { walk(psMod().app.activeDocument.layers); } catch (_) {}
    return found;
  }

  // The active layer's id (null when there is none).
  function kbActiveLayerId() {
    try {
      const doc = psMod().app.activeDocument;
      const al = doc && doc.activeLayers && doc.activeLayers[0];
      return (al && typeof al.id !== "undefined") ? al.id : null;
    } catch (_) { return null; }
  }

  // The canvas view during a run: every layer's visibility and the active layer(s),
  // saved before and put back exactly after (on error too). Steps 4 and 6 read their
  // pixels straight from layers by id; this catches what a Photoshop command moved
  // (a temp layer for a mask or a channel save selects and shows layers).
  function kbViewSnap() {
    const vis = [];
    const walk = function (list) {
      if (!list) return;
      for (let i = 0; i < list.length; i++) {
        const l = list[i];
        try { vis.push([l.id, !!l.visible]); } catch (_) {}
        let kids = null; try { kids = l.layers; } catch (_) {}
        if (kids) walk(kids);
      }
    };
    let act = [];
    try { const d = psMod().app.activeDocument; walk(d.layers); act = Array.from(d.activeLayers || []).map(function (l) { return l.id; }); } catch (_) {}
    return { vis: vis, act: act };
  }
  // Inside executeAsModal.
  async function kbViewRestoreInModal(snap) {
    if (!snap) return 0;
    let n = 0;
    for (let i = 0; i < snap.vis.length; i++) {
      const l = kbLayerById(snap.vis[i][0]);
      if (!l) continue;
      try { if (!!l.visible !== snap.vis[i][1]) { l.visible = snap.vis[i][1]; n++; } } catch (_) {}
    }
    const act = snap.act.filter(function (id) { return !!kbLayerById(id); });
    const now = kbActiveLayerIds();
    if (act.length && act.join(",") !== now.join(",")) {
      await kbSelectLayerById(act[0]);
      for (let i = 1; i < act.length; i++) {
        try {
          await psMod().action.batchPlay([{ _obj: "select", _target: [{ _ref: "layer", _id: act[i] }],
            selectionModifier: { _enum: "selectionModifierType", _value: "addToSelection" }, makeVisible: false,
            _options: { dialogOptions: "dontDisplay" } }], { synchronousExecution: true });
        } catch (_) {}
      }
    }
    return n;
  }
  async function kbViewRestore(snap) {
    try { await psMod().core.executeAsModal(async function () { await kbViewRestoreInModal(snap); }, { commandName: "KBImage — keep the view" }); }
    catch (e) { try { traceErr("view restore", e); } catch (_) {} }
  }
  // Run fn with the view kept: whatever it shows, hides or selects is put back after.
  async function kbKeepView(fn) {
    const snap = kbViewSnap();
    try { return await fn(); }
    finally { await kbViewRestore(snap); }
  }
  function kbActiveLayerIds() {
    try { return Array.from(psMod().app.activeDocument.activeLayers || []).map(function (l) { return l.id; }); } catch (_) { return []; }
  }

  // encodeImageData result (ArrayBuffer | typed array | number[] | base64 string) → base64.
  function kbEncodedToBase64(encoded) {
    if (typeof encoded === "string") return encoded;
    if (encoded instanceof ArrayBuffer) return bytesToBase64(encoded);
    if (encoded && encoded.buffer instanceof ArrayBuffer) {
      return bytesToBase64(encoded.buffer.slice(encoded.byteOffset || 0, (encoded.byteOffset || 0) + encoded.byteLength));
    }
    if (Array.isArray(encoded)) return bytesToBase64(new Uint8Array(encoded).buffer);
    throw new Error("Unknown encodeImageData return type: " + typeof encoded);
  }
  function kbMimeOfBase64(b64) {
    try {
      const head = atob(String(b64).slice(0, 16));
      const arr = new Uint8Array(head.length);
      for (let i = 0; i < head.length; i++) arr[i] = head.charCodeAt(i);
      return detectImageMime(arr.buffer) || "image/jpeg";
    } catch (_) { return "image/jpeg"; }
  }

  // Composite of all visible layers, downsized so the long edge is at most
  // SAM_MAX_EDGE (SAM gains nothing from more, and a full 8K data URI would
  // be a very large upload). Must be called inside executeAsModal.
  // rect (doc px) defaults to the whole canvas; a smaller rect = a close-up crop.
  async function kbReadCompositeSmall(rect) {
    const ps = psMod();
    const doc = ps.app.activeDocument;
    if (!doc) throw new Error("Open a Photoshop document first.");
    const docW = Math.round(doc.width);
    const docH = Math.round(doc.height);
    if (!(docW > 0 && docH > 0)) throw new Error("Document has zero area.");
    const r = rect || { left: 0, top: 0, right: docW, bottom: docH };
    const rw = r.right - r.left, rh = r.bottom - r.top;
    if (!(rw > 0 && rh > 0)) throw new Error("Empty area to read.");

    const opts = {
      documentID: doc.id,
      sourceBounds: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
      applyAlpha: true,
      componentSize: 8,
    };
    const longEdge = Math.max(rw, rh);
    if (longEdge > SAM_MAX_EDGE) {
      const s = SAM_MAX_EDGE / longEdge;
      opts.targetSize = { width: Math.max(1, Math.round(rw * s)), height: Math.max(1, Math.round(rh * s)) };
    }
    const pr = await ps.imaging.getPixels(opts);
    if (!pr || !pr.imageData) throw new Error("imaging.getPixels returned no imageData.");
    const sentW = pr.imageData.width, sentH = pr.imageData.height;
    let encoded;
    try { encoded = await ps.imaging.encodeImageData({ imageData: pr.imageData }); }
    finally { try { pr.imageData.dispose(); } catch (_) {} }
    const base64 = kbEncodedToBase64(encoded).replace(/\s+/g, "");
    const mime = kbMimeOfBase64(base64);
    try { console.log(TAG, "sam: composite for SAM " + sentW + "x" + sentH + " from " + JSON.stringify(r) + " (doc " + docW + "x" + docH + "), " + mime + ", b64.len=" + base64.length); } catch (_) {}
    return { base64: base64, mime: mime, docW: docW, docH: docH, sentW: sentW, sentH: sentH, rect: r };
  }

  // The close-up SAM sees in steps 4 and 6, read straight from layers by id (nothing
  // hidden, shown or selected, so the canvas never changes): CLEAN inside KBPS garment
  // over the photo, or the photo alone when there is no CLEAN. src = { photoId, cleanId,
  // alpha (garment, 0…255) over arect, cache }. Inside executeAsModal. Same result
  // shape as kbReadCompositeSmall.
  async function kbReadLayersSmall(rect, src) {
    const key = [rect.left, rect.top, rect.right, rect.bottom].join(",");
    if (src.cache && src.cache[key]) return src.cache[key];
    const ps = psMod();
    const doc = ps.app.activeDocument;
    const docW = Math.round(doc.width), docH = Math.round(doc.height);
    const rw = rect.right - rect.left, rh = rect.bottom - rect.top, n = rw * rh;
    if (!(rw > 0 && rh > 0)) throw new Error("Empty area to read.");
    const base = src.photoId != null ? await psReadLayerRgb(src.photoId, rect) : null;
    const top = src.cleanId != null ? await psReadLayerRgb(src.cleanId, rect) : null;
    const R = new Uint8Array(n), G = new Uint8Array(n), B = new Uint8Array(n);
    const A = src.alpha, ar = src.arect, aw = ar ? ar.right - ar.left : 0, ah = ar ? ar.bottom - ar.top : 0;
    for (let y = 0, k = 0; y < rh; y++) {
      const ay = rect.top + y - (ar ? ar.top : 0);
      for (let x = 0; x < rw; x++, k++) {
        let inside = !A;
        if (A) { const ax = rect.left + x - ar.left; inside = ax >= 0 && ay >= 0 && ax < aw && ay < ah && A[ay * aw + ax] > 127; }
        let from = null;
        if (top && top.valid[k] && (inside || !(base && base.valid[k]))) from = top;
        else if (base && base.valid[k]) from = base;
        if (from) { R[k] = from.rgb[k * 3]; G[k] = from.rgb[k * 3 + 1]; B[k] = from.rgb[k * 3 + 2]; }
        else { R[k] = 255; G[k] = 255; B[k] = 255; }
      }
    }
    let tw = rw, th = rh;
    const longEdge = Math.max(rw, rh);
    if (longEdge > SAM_MAX_EDGE) { const k2 = SAM_MAX_EDGE / longEdge; tw = Math.max(1, Math.round(rw * k2)); th = Math.max(1, Math.round(rh * k2)); }
    const r = kbResamplePlane(R, rw, rh, tw, th), g = kbResamplePlane(G, rw, rh, tw, th), b = kbResamplePlane(B, rw, rh, tw, th);
    let base64 = null;
    // JPEG through Photoshop's encoder when it can build image data from a buffer; else a PNG.
    if (ps.imaging && typeof ps.imaging.createImageDataFromBuffer === "function") {
      let img = null;
      try {
        const rgb = new Uint8Array(tw * th * 3);
        for (let k = 0, o = 0; k < tw * th; k++, o += 3) { rgb[o] = r[k]; rgb[o + 1] = g[k]; rgb[o + 2] = b[k]; }
        img = await ps.imaging.createImageDataFromBuffer(rgb, { width: tw, height: th, components: 3, chunky: true, colorSpace: "RGB", colorProfile: "sRGB IEC61966-2.1" });
        base64 = kbEncodedToBase64(await ps.imaging.encodeImageData({ imageData: img, base64: true })).replace(/\s+/g, "");
      } catch (e) { base64 = null; try { console.warn(TAG, "sam: JPEG from buffer refused, sending PNG:", e); } catch (_) {} }
      finally { try { if (img) img.dispose(); } catch (_) {} }
    }
    if (!base64) {
      const rgba = new Uint8Array(tw * th * 4);
      for (let k = 0, o = 0; k < tw * th; k++, o += 4) { rgba[o] = r[k]; rgba[o + 1] = g[k]; rgba[o + 2] = b[k]; rgba[o + 3] = 255; }
      const bytes = psPngRgba(rgba, tw, th);
      base64 = bytesToBase64(bytes.buffer.byteLength === bytes.length ? bytes.buffer : bytes.slice().buffer);
    }
    const mime = kbMimeOfBase64(base64);
    try { console.log(TAG, "sam: layers " + (src.cleanId != null ? "CLEAN " + src.cleanId + " over " : "") + "photo " + src.photoId + " for SAM " + tw + "x" + th + " from " + JSON.stringify(rect) + ", " + mime + ", b64.len=" + base64.length); } catch (_) {}
    const out = { base64: base64, mime: mime, docW: docW, docH: docH, sentW: tw, sentH: th, rect: rect };
    if (src.cache) src.cache[key] = out;
    return out;
  }
  // What SAM reads in steps 4 and 6: CLEAN (inside the garment) over the photo, by id.
  function kbSamLayerSource(photoId, alpha, arect) {
    const cleanId = psAcceptedCleanId();
    if (cleanId == null && photoId == null) throw new Error("no CLEAN or photo layer found.");
    return { photoId: photoId, cleanId: cleanId, alpha: alpha || null, arect: arect || null, cache: {}, label: cleanId != null ? "CLEAN" : "photo" };
  }

  // Generic Fal queue call returning the result JSON (submit → poll → result).
  // Used by SAM 3.1 and Nano Banana Pro; shows the progress bar while it polls.
  async function falQueueJson(apiKey, path, body) {
    if (!apiKey) throw new Error("Missing Fal API key.");
    const submitRes = await fetch(FAL_QUEUE_HOST + "/" + path, {
      method: "POST", headers: falAuthHeaders(apiKey), body: JSON.stringify(body),
    });
    if (!submitRes.ok) {
      const t = await safeText(submitRes);
      throw new Error(falHint(submitRes.status) + " (Fal " + submitRes.status + ": " + shortErr(t) + ")");
    }
    const submit = await submitRes.json();
    const statusUrl   = submit.status_url;
    const responseUrl = submit.response_url;
    if (!statusUrl || !responseUrl) throw new Error("Fal: no status_url/response_url in submit response.");

    const prog = falProgSubmitted(path, body, submit);              // progress bar
    const t0 = Date.now();
    let done = false;
    while (Date.now() - t0 < FAL_TIMEOUT_MS) {
      await new Promise(function (r) { setTimeout(r, FAL_POLL_MS); });
      let stRes;
      try { stRes = await fetch(prog ? falStatusUrlWithLogs(statusUrl) : statusUrl, { method: "GET", headers: falAuthHeaders(apiKey) }); }
      catch (e) { continue; }
      if (!stRes.ok) continue;
      let st; try { st = await stRes.json(); } catch (_) { continue; }
      falProgStatus(prog, st);
      if (((st && st.status) || "") === "COMPLETED") { done = true; break; }
    }
    if (!done) throw new Error("Fal: timed out waiting for result.");

    const resRes = await fetch(responseUrl, { method: "GET", headers: falAuthHeaders(apiKey) });
    if (!resRes.ok) {
      const t = await safeText(resRes);
      throw new Error(falHint(resRes.status) + " (Fal result " + resRes.status + ": " + shortErr(t) + ")");
    }
    return await resRes.json();
  }

  // Plain-language first line for a Fal HTTP error; the raw status + body follow it.
  function falHint(status) {
    if (status === 401) return "Fal did not accept the key. Re-enter it in Settings";
    if (status === 403) return "Fal refused the request: the account may be out of credit or locked. Check fal.ai → Billing";
    if (status === 404) return "Fal could not find the model path";
    if (status === 413) return "The picture was too large for Fal";
    if (status === 422) return "Fal rejected the request fields";
    if (status === 429) return "Fal is rate-limiting this key. Wait a minute and try again";
    if (status >= 500) return "Fal had a server error. Try again in a minute";
    return "Fal returned an error";
  }

  // A Fal file reference (public URL or data: URI) → base64.
  async function kbFetchBase64(url) {
    const u = String(url || "");
    if (u.indexOf("data:") === 0) {
      const comma = u.indexOf(",");
      if (comma < 0) throw new Error("Fal: malformed data URI in result.");
      return u.slice(comma + 1).replace(/\s+/g, "");
    }
    const res = await fetch(u, { method: "GET" });
    if (!res.ok) throw new Error("Fal: mask fetch failed (" + res.status + ").");
    return bytesToBase64(await res.arrayBuffer());
  }

  // imaging.getPixels of ONE layer (opts.layerID, opts.componentSize 8), safe in
  // 16-bit documents.
  // There Photoshop refuses the 8-bit read of a single layer ("Code -32005.
  // Could not rasterize ^0" on a pixel layer, "Could not place the document
  // ^0" on a smart object); the read at the document's own depth works, so it
  // is the fallback, converted to 8-bit (Photoshop 16-bit runs 0…32768). The
  // result's imageData offers width / height / components / getData / dispose.
  async function getLayerPixels8(opts) {
    const ps = psMod();
    try { return await ps.imaging.getPixels(opts); }
    catch (e8) { try { console.warn(TAG, "8-bit layer read refused, reading at document depth:", e8); } catch (_) {} }
    const o2 = Object.assign({}, opts); delete o2.componentSize;
    const pr = await ps.imaging.getPixels(o2);
    const img = pr && pr.imageData;
    if (!img) return pr;
    const cs = img.componentSize || 16;
    return {
      sourceBounds: pr.sourceBounds,
      imageData: {
        width: img.width, height: img.height, components: img.components,
        colorSpace: img.colorSpace, colorProfile: img.colorProfile, componentSize: 8,
        getData: async function (o) {
          const d = await img.getData(o), d8 = new Uint8Array(d.length);
          if (cs === 32) { for (let k = 0; k < d.length; k++) { const v = d[k]; d8[k] = v <= 0 ? 0 : (v >= 1 ? 255 : Math.round(v * 255)); } }
          else if (cs === 8) d8.set(d);
          else { for (let k = 0; k < d.length; k++) { const v = Math.round(d[k] * 255 / 32768); d8[k] = v > 255 ? 255 : v; } }
          return d8;
        },
        dispose: function () { try { img.dispose(); } catch (_) {} },
      },
    };
  }

  // Read the ACTIVE (just-placed) layer's own pixels, resampled by Photoshop to
  // about targetW × targetH, as raw 8-bit chunky data. Position / on-canvas
  // scale of the placed layer do not matter — only its content is read.
  // Must be called inside executeAsModal.
  async function kbReadActiveLayerPixels(targetW, targetH) {
    const ps = psMod();
    const doc = ps.app.activeDocument;
    const layer = doc && doc.activeLayers && doc.activeLayers[0];
    if (!layer) throw new Error("No active layer to read.");
    const b = layer.bounds || {};
    const left = Math.round(Number(b.left) || 0), top = Math.round(Number(b.top) || 0);
    const right = Math.round(Number(b.right) || 0), bottom = Math.round(Number(b.bottom) || 0);
    const lw = right - left, lh = bottom - top;
    if (!(lw > 0 && lh > 0)) throw new Error("Placed layer has no pixels (bounds " + lw + "x" + lh + ").");

    // targetH omitted (0) → height follows the layer's own aspect.
    let tw = Math.max(1, Math.round(targetW || lw));
    if (tw > lw) tw = lw;          // never ask Photoshop to upsample
    let th = targetH ? Math.max(1, Math.round(targetH)) : Math.max(1, Math.round(tw * lh / lw));
    if (th > lh) th = lh;
    if (th > KB_TEX_MAX) {       // very tall layer: cap both, keep aspect
      const s = KB_TEX_MAX / th;
      th = KB_TEX_MAX; tw = Math.max(1, Math.round(tw * s));
    }
    // imaging.getPixels with BOTH layerID and targetSize returned
    // garbage (near-white) in real Photoshop on a large document — every SAM
    // mask read as "covers 100%". So a temp layer that is bigger than needed is
    // first resized IN Photoshop (proven transform) and rasterized, then read at
    // its own size with no targetSize. Callers only ever pass temp layers.
    let sb = { left: left, top: top, right: right, bottom: bottom };
    if (tw < lw || th < lh) {
      await ps.action.batchPlay(
        [{ _obj: "transform",
           _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
           freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" },
           width:  { _unit: "percentUnit", _value: tw / lw * 100 },
           height: { _unit: "percentUnit", _value: th / lh * 100 },
           _options: { dialogOptions: "dontDisplay" } }],
        { synchronousExecution: true });
      try { await rasterizeLayerIfSmart(layer.id); } catch (_) {}
      const nb = (doc.activeLayers && doc.activeLayers[0] && doc.activeLayers[0].bounds) || {};
      sb = { left: Math.round(Number(nb.left) || 0), top: Math.round(Number(nb.top) || 0),
             right: Math.round(Number(nb.right) || 0), bottom: Math.round(Number(nb.bottom) || 0) };
      if (!(sb.right > sb.left && sb.bottom > sb.top)) throw new Error("Resized layer has no pixels.");
    }
    const opts = {
      documentID: doc.id,
      layerID: layer.id,
      sourceBounds: sb,
      applyAlpha: false,
      componentSize: 8,
    };
    const pr = await getLayerPixels8(opts);   // 16-bit documents too
    if (!pr || !pr.imageData) throw new Error("imaging.getPixels returned no imageData.");
    const img = pr.imageData;
    let out;
    try {
      const data = await img.getData({ chunky: true });
      out = {
        data: data,
        width: img.width, height: img.height,
        components: img.components || Math.round(data.length / (img.width * img.height)),
        colorSpace: img.colorSpace || "",
        colorProfile: img.colorProfile || "",
        layerW: lw, layerH: lh,
      };
    } finally { try { img.dispose(); } catch (_) {} }
    return out;
  }

  // ----- PNG decoding in the panel (SAM masks) ---------------------------------------
  // SAM's masks come back as PNG. Decoded here (inflate, RFC 1951, + the PNG row
  // filters) they never touch the canvas: no temp layer, no selected layer. Anything
  // this does not read (interlaced, odd depth) returns null and the mask is placed and
  // read back the older way.
  const KB_INF_LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const KB_INF_LEXT  = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const KB_INF_DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const KB_INF_DEXT  = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  const KB_INF_CLORD = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  // Canonical Huffman table from code lengths: { count[16], sym[] }.
  function kbInfTable(lens, n) {
    const count = new Uint16Array(16), offs = new Uint16Array(16), sym = new Uint16Array(n);
    for (let i = 0; i < n; i++) count[lens[i]]++;
    count[0] = 0;
    for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + count[i - 1];
    for (let i = 0; i < n; i++) if (lens[i]) sym[offs[lens[i]]++] = i;
    return { count: count, sym: sym };
  }
  // zlib stream → bytes (outLen when known, to size the buffer).
  function kbInflate(src, outLen) {
    let pos = 2, bitBuf = 0, bitCnt = 0;                // skip the 2-byte zlib header
    let out = new Uint8Array(Math.max(1024, outLen || src.length * 4)), op = 0;
    const need = function (k) { if (op + k <= out.length) return; const o2 = new Uint8Array(Math.max(out.length * 2, op + k)); o2.set(out.subarray(0, op)); out = o2; };
    const bits = function (k) {
      while (bitCnt < k) { if (pos >= src.length) throw new Error("PNG data ends early."); bitBuf |= src[pos++] << bitCnt; bitCnt += 8; }
      const v = bitBuf & ((1 << k) - 1); bitBuf >>>= k; bitCnt -= k; return v;
    };
    const decode = function (t) {
      let code = 0, first = 0, index = 0;
      for (let len = 1; len < 16; len++) {
        code |= bits(1);
        const c = t.count[len];
        if (code - c < first) return t.sym[index + (code - first)];
        index += c; first += c; first <<= 1; code <<= 1;
      }
      throw new Error("bad Huffman code in PNG data.");
    };
    let fixedL = null, fixedD = null, last = 0;
    while (!last) {
      last = bits(1);
      const type = bits(2);
      if (type === 0) {
        bitBuf = 0; bitCnt = 0;
        const len = src[pos] | (src[pos + 1] << 8); pos += 4;
        need(len); out.set(src.subarray(pos, pos + len), op); op += len; pos += len;
        continue;
      }
      let lt, dt;
      if (type === 1) {
        if (!fixedL) {
          const l = new Uint8Array(288);
          for (let i = 0; i < 144; i++) l[i] = 8; for (let i = 144; i < 256; i++) l[i] = 9; for (let i = 256; i < 280; i++) l[i] = 7; for (let i = 280; i < 288; i++) l[i] = 8;
          fixedL = kbInfTable(l, 288);
          const d = new Uint8Array(30).fill(5); fixedD = kbInfTable(d, 30);
        }
        lt = fixedL; dt = fixedD;
      } else if (type === 2) {
        const hlit = bits(5) + 257, hdist = bits(5) + 1, hclen = bits(4) + 4;
        const cl = new Uint8Array(19);
        for (let i = 0; i < hclen; i++) cl[KB_INF_CLORD[i]] = bits(3);
        const ct = kbInfTable(cl, 19), lens = new Uint8Array(hlit + hdist);
        for (let i = 0; i < hlit + hdist;) {
          const sy = decode(ct);
          if (sy < 16) lens[i++] = sy;
          else if (sy === 16) { const prev = lens[i - 1], r = 3 + bits(2); for (let j = 0; j < r; j++) lens[i++] = prev; }
          else if (sy === 17) { i += 3 + bits(3); }
          else { i += 11 + bits(7); }
        }
        lt = kbInfTable(lens.subarray(0, hlit), hlit); dt = kbInfTable(lens.subarray(hlit), hdist);
      } else throw new Error("bad block type in PNG data.");
      for (;;) {
        const sy = decode(lt);
        if (sy < 256) { need(1); out[op++] = sy; continue; }
        if (sy === 256) break;
        const li = sy - 257, len = KB_INF_LBASE[li] + bits(KB_INF_LEXT[li]);
        const di = decode(dt), dist = KB_INF_DBASE[di] + bits(KB_INF_DEXT[di]);
        need(len);
        for (let j = 0; j < len; j++, op++) out[op] = out[op - dist];
      }
    }
    return out.subarray(0, op);
  }
  // PNG bytes → { data (chunky 8-bit), width, height, components } or null.
  function kbPngDecode(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (b.length < 33 || b[0] !== 137 || b[1] !== 80 || b[2] !== 78 || b[3] !== 71) return null;
    const u32 = function (o) { return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0; };
    let pos = 8, w = 0, h = 0, depth = 0, ctype = 0, inter = 0, pal = null, trns = null;
    const idat = [];
    while (pos + 8 <= b.length) {
      const len = u32(pos), t = String.fromCharCode(b[pos + 4], b[pos + 5], b[pos + 6], b[pos + 7]), d = pos + 8;
      if (t === "IHDR") { w = u32(d); h = u32(d + 4); depth = b[d + 8]; ctype = b[d + 9]; inter = b[d + 12]; }
      else if (t === "PLTE") pal = b.subarray(d, d + len);
      else if (t === "tRNS") trns = b.subarray(d, d + len);
      else if (t === "IDAT") idat.push(b.subarray(d, d + len));
      else if (t === "IEND") break;
      pos = d + len + 4;
    }
    if (!(w > 0 && h > 0) || inter || !(depth === 8 || depth === 16)) return null;
    const chans = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype];
    if (!chans || (ctype === 3 && (!pal || depth !== 8))) return null;
    let total = 0; idat.forEach(function (x) { total += x.length; });
    const z = new Uint8Array(total); let zo = 0; idat.forEach(function (x) { z.set(x, zo); zo += x.length; });
    const bpp = chans * depth / 8, stride = w * bpp;
    const raw = kbInflate(z, (stride + 1) * h);
    if (raw.length < (stride + 1) * h) return null;
    const px = new Uint8Array(stride * h);
    for (let y = 0; y < h; y++) {
      const f = raw[y * (stride + 1)], ri = y * (stride + 1) + 1, o = y * stride, p = o - stride;
      for (let x = 0; x < stride; x++) {
        const a = x >= bpp ? px[o + x - bpp] : 0, up = y ? px[p + x] : 0, c = (y && x >= bpp) ? px[p + x - bpp] : 0;
        let pr = 0;
        if (f === 1) pr = a; else if (f === 2) pr = up; else if (f === 3) pr = (a + up) >> 1;
        else if (f === 4) { const q = a + up - c, pa = Math.abs(q - a), pb = Math.abs(q - up), pc = Math.abs(q - c); pr = (pa <= pb && pa <= pc) ? a : (pb <= pc ? up : c); }
        px[o + x] = (raw[ri + x] + pr) & 0xFF;
      }
    }
    // to 8-bit chunky: gray → 1, gray+alpha → 2, RGB → 3, RGBA → 4; palette → RGB(A)
    const n = w * h, step = depth / 8;
    if (ctype === 3) {
      const comps = trns ? 4 : 3, out = new Uint8Array(n * comps);
      for (let k = 0; k < n; k++) { const i = px[k]; out[k * comps] = pal[i * 3]; out[k * comps + 1] = pal[i * 3 + 1]; out[k * comps + 2] = pal[i * 3 + 2]; if (comps === 4) out[k * 4 + 3] = i < trns.length ? trns[i] : 255; }
      return { data: out, width: w, height: h, components: comps };
    }
    if (step === 1) return { data: px, width: w, height: h, components: chans };
    const out = new Uint8Array(n * chans);
    for (let k = 0; k < out.length; k++) out[k] = px[k * 2];        // 16-bit: the high byte
    return { data: out, width: w, height: h, components: chans };
  }

  // Raw mask-image pixels → one 8-bit plane. Format-agnostic: if the image
  // carries real transparency its ALPHA is the mask; otherwise its LUMINANCE
  // is (white = inside). Returns { plane, kind, midPct }.
  function kbMaskPlane(px) {
    const n = px.width * px.height;
    const c = px.components;
    const d = px.data;
    const plane = new Uint8Array(n);
    let alphaVaries = false;
    if (c === 4) {
      for (let i = 0, p = 3; i < n; i++, p += 4) { if (d[p] < 250) { alphaVaries = true; break; } }
    }
    let mid = 0;
    if (alphaVaries) {
      for (let i = 0, p = 3; i < n; i++, p += 4) { const a = d[p]; plane[i] = a; if (a > 40 && a < 215) mid++; }
    } else if (c >= 3) {
      for (let i = 0, p = 0; i < n; i++, p += c) {
        const l = (d[p] * 77 + d[p + 1] * 150 + d[p + 2] * 29) >> 8;
        plane[i] = l; if (l > 40 && l < 215) mid++;
      }
    } else {
      for (let i = 0, p = 0; i < n; i++, p += c) { const l = d[p]; plane[i] = l; if (l > 40 && l < 215) mid++; }
    }
    return { plane: plane, kind: alphaVaries ? "alpha" : "luma", midPct: n ? (mid * 100 / n) : 0 };
  }

  // Bilinear upsample of an 8-bit plane (sw × sh) to (W × H).
  function kbResamplePlane(src, sw, sh, W, H) {
    if (sw === W && sh === H) return src;
    const out = new Uint8Array(W * H);
    const x0s = new Int32Array(W), x1s = new Int32Array(W), fxs = new Int32Array(W);
    const kx = sw / W, ky = sh / H;
    for (let x = 0; x < W; x++) {
      let fx = (x + 0.5) * kx - 0.5;
      if (fx < 0) fx = 0;
      let x0 = Math.floor(fx);
      if (x0 > sw - 1) x0 = sw - 1;
      const x1 = x0 + 1 < sw ? x0 + 1 : sw - 1;
      x0s[x] = x0; x1s[x] = x1; fxs[x] = Math.round((fx - x0) * 256);
      if (fxs[x] > 256) fxs[x] = 256;
    }
    for (let y = 0; y < H; y++) {
      let fy = (y + 0.5) * ky - 0.5;
      if (fy < 0) fy = 0;
      let y0 = Math.floor(fy);
      if (y0 > sh - 1) y0 = sh - 1;
      const y1 = y0 + 1 < sh ? y0 + 1 : sh - 1;
      let wy = Math.round((fy - y0) * 256);
      if (wy > 256) wy = 256;
      const r0 = y0 * sw, r1 = y1 * sw, o = y * W;
      for (let x = 0; x < W; x++) {
        const a = src[r0 + x0s[x]], b = src[r0 + x1s[x]];
        const c = src[r1 + x0s[x]], e = src[r1 + x1s[x]];
        const wx = fxs[x];
        const top = a * (256 - wx) + b * wx;
        const bot = c * (256 - wx) + e * wx;
        out[o + x] = (top * (256 - wy) + bot * wy + 32768) >> 16;
      }
    }
    return out;
  }

  // ----- document checks + layer / channel helpers ----------------------------
  function kbDocProblem(doc) {
    try {
      const mode = String(doc.mode || "");
      if (mode && !/rgb/i.test(mode)) return "Print Swap needs an RGB document. In Photoshop: Image → Mode → RGB Color.";
      const bits = String(doc.bitsPerChannel || "");
      if (bits && /16|32/.test(bits)) return "Print Swap needs an 8-bit document. In Photoshop: Image → Mode → 8 Bits/Channel.";
    } catch (_) {}
    return null;
  }

  // Every layer (inside groups too) whose name starts with `prefix`.
  function kbFindLayers(prefix) {
    const out = [];
    function walk(list) {
      if (!list) return;
      for (let i = 0; i < list.length; i++) {
        const l = list[i];
        if (!l) continue;
        if (String(l.name || "").indexOf(prefix) === 0) out.push(l);
        try { if (l.layers && l.layers.length) walk(l.layers); } catch (_) {}
      }
    }
    try { walk(psMod().app.activeDocument.layers); } catch (_) {}
    return out;
  }
  function kbChannelObjs(chName) {
    const out = [];
    try {
      const chans = psMod().app.activeDocument.channels;
      for (let i = 0; i < chans.length; i++) {
        const c = chans[i];
        if (c && c.name === chName) out.push(c);
      }
    } catch (e) { traceErr("reading doc.channels", e); }
    return out;
  }
  function kbChannelExists(chName) { return kbChannelObjs(chName).length > 0; }
  // Inside executeAsModal. Removes EVERY channel with this name (also cleans up
  // duplicates). Returns how many were removed.
  async function kbRemoveChannels(chName) {
    try { await selectRGBChannel(); } catch (_) {}
    const list = kbChannelObjs(chName);
    let n = 0;
    for (let i = 0; i < list.length; i++) {
      try { await list[i].remove(); n++; }
      catch (e) {
        traceErr("channel.remove " + chName, e);
        try { await deleteChannelByName(chName); n++; } catch (_) {}
      }
    }
    if (list.length) trace("removed " + n + " × " + chName);
    return n;
  }
  // Inside executeAsModal. Mask channel → the live selection. mode: "replace"
  // (default) | "add" | "subtract" | "intersect" with the current selection.
  async function kbLoadChannel(chName, mode) {
    psPanelSelAt = Date.now(); psUserSel = false;          // not the user's selection (garment note)
    const ch = kbChannelObjs(chName)[0];
    if (!ch) throw new Error("mask channel “" + chName + "” is not in this document.");
    const ps = psMod();
    try { await selectRGBChannel(); } catch (_) {}
    const m = mode || "replace";
    try {
      if (m === "replace") { await ps.app.activeDocument.selection.load(ch); return; }
      const ST = ps.constants && ps.constants.SelectionType;
      const st = m === "add" ? ST.EXTEND : (m === "subtract" ? ST.DIMINISH : ST.INTERSECT);
      await ps.app.activeDocument.selection.load(ch, st);
      return;
    } catch (e) { traceErr("selection.load " + chName + " " + m + " (trying batchPlay)", e); }
    if (m === "replace") { await loadSelectionFromChannel(chName); return; }
    const verb = m === "add" ? "add" : (m === "subtract" ? "subtractFrom" : "intersectWith");
    await ps.action.batchPlay(
      [{ _obj: verb,
         _target: [{ _ref: "channel", _property: "selection" }],
         to: { _ref: "channel", _name: chName },
         _options: { dialogOptions: "dontDisplay" } }],
      { synchronousExecution: true }
    );
  }
  function kbSelectionBounds() {
    try {
      const b = psMod().app.activeDocument.selection.bounds;
      if (b && (Number(b.right) - Number(b.left)) > 0 && (Number(b.bottom) - Number(b.top)) > 0) return b;
    } catch (_) {}
    return null;
  }

  // ----- Pixels → Photoshop via PLACE (proven path) ---------------------------
  // The imaging write calls (putSelection / putPixels) failed in real Photoshop
  // with "The command “Get” is not currently available", so mask pixels go in
  // the same way AI results do: an RGBA buffer → hand-built PNG (stored
  // deflate, assemblePng) → file in the plugin data folder → placeEvent → fit to
  // the target rect → rasterize. The mask's selection is then the placed layer's
  // own transparency (Ctrl-click equivalent).

  // Layer bounds are the extent of NON-transparent pixels, so a faint (alpha 1)
  // pixel in each corner keeps the placed layer's bounds = the full buffer —
  // the fit-to-rect math depends on it. Alpha 1/255 is invisible.
  async function kbRgbaToFile(rgba, w, h) {
    const stride = w * 4 + 1;
    const raw = new Uint8Array(stride * h);
    for (let y = 0; y < h; y++) {
      raw[y * stride] = 0;                                     // filter: None
      raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * stride + 1);
    }
    const bytes = assemblePng(w, h, raw);
    const folder = await fsLocal().getDataFolder();
    const file = await folder.createFile("printswap-mask-" + Date.now() + "-" + Math.floor(Math.random() * 1e6) + ".png", { overwrite: true });
    await file.write(bytes.buffer.byteLength === bytes.length ? bytes.buffer : bytes.slice().buffer, { format: fmts().binary });
    const token = await fsLocal().createSessionToken(file);
    return { file: file, token: token };
  }
  async function kbDeleteFile(f) { try { if (f && f.file) await f.file.delete(); } catch (_) {} }

  // Inside executeAsModal: place the file above the ACTIVE layer, name it,
  // stretch it onto rect {left, top, right, bottom}, rasterize. Returns the layer id.
  async function kbPlaceFileInModal(f, layerName, rect) {
    const ps = psMod();
    await ps.action.batchPlay(
      [{
        _obj: "placeEvent",
        target: { _path: f.token },
        freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" },
        offset: { _obj: "offset", horizontal: { _unit: "pixelsUnit", _value: 0 }, vertical: { _unit: "pixelsUnit", _value: 0 } },
        _options: { dialogOptions: "dontDisplay" },
      }],
      { synchronousExecution: true }
    );
    try { await renameActiveLayer(layerName); } catch (_) {}
    const doc = ps.app.activeDocument;
    const layer = doc.activeLayers && doc.activeLayers[0];
    if (!layer) throw new Error("the placed layer did not appear.");
    const id = layer.id;
    const b = layer.bounds;
    const cL = Number(b.left) || 0, cT = Number(b.top) || 0;
    const cW = (Number(b.right) || 0) - cL, cH = (Number(b.bottom) || 0) - cT;
    const tW = rect.right - rect.left, tH = rect.bottom - rect.top;
    if (cW > 0 && cH > 0 && (Math.abs(cW - tW) > 0.01 || Math.abs(cH - tH) > 0.01 || Math.abs(cL - rect.left) > 0.01 || Math.abs(cT - rect.top) > 0.01)) {
      await ps.action.batchPlay(
        [{
          _obj: "transform",
          _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
          freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" },
          offset: { _obj: "offset",
            horizontal: { _unit: "pixelsUnit", _value: (rect.left + tW / 2) - (cL + cW / 2) },
            vertical:   { _unit: "pixelsUnit", _value: (rect.top + tH / 2) - (cT + cH / 2) } },
          width:  { _unit: "percentUnit", _value: tW / cW * 100 },
          height: { _unit: "percentUnit", _value: tH / cH * 100 },
          _options: { dialogOptions: "dontDisplay" },
        }],
        { synchronousExecution: true }
      );
    }
    try { await rasterizeLayerIfSmart(id); } catch (e) { try { console.warn(TAG, "sam: rasterize failed (continuing):", e); } catch (_) {} }   // only a smart object, by id
    return id;
  }

  // Inside executeAsModal: the composite's brightness → the selection (Ctrl-click
  // on the RGB channel). Used while an opaque black/white mask image is on top.
  async function kbSelectCompositeLuminosity() {
    await psMod().action.batchPlay(
      [{ _obj: "set",
         _target: [{ _ref: "channel", _property: "selection" }],
         to: { _ref: "channel", _enum: "channel", _value: "RGB" },
         _options: { dialogOptions: "dontDisplay" } }],
      { synchronousExecution: true }
    );
  }

  // Inside executeAsModal: fill the whole active layer (its pixels, not its mask)
  // with a solid color.
  async function kbFillActiveLayer(rgb) {
    await psMod().action.batchPlay(
      [{ _obj: "fill",
         using: { _enum: "fillContents", _value: "color" },
         color: { _obj: "RGBColor", red: rgb[0], grain: rgb[1], blue: rgb[2] },
         opacity: { _unit: "percentUnit", _value: 100 },
         mode: { _enum: "blendMode", _value: "normal" },
         _options: { dialogOptions: "dontDisplay" } }],
      { synchronousExecution: true }
    );
  }

  // The garment's photo layer: the remembered one, else the top visible ordinary layer.
  function kbGarmentSourceLayer() {
    if (kbGarmentLayerId != null) {
      const nm = kbLayerName(kbGarmentLayerId);
      if (nm) return kbGarmentLayerId;
    }
    try {
      const top = psMod().app.activeDocument.layers;
      for (let i = 0; i < top.length; i++) {
        const l = top[i];
        if (l && String(l.name || "") !== KB_TMP_LAYER && l.visible !== false) return l.id;
      }
    } catch (_) {}
    return null;
  }
  function kbLayerById(id) {
    let found = null;
    function walk(list) {
      if (!list || found) return;
      for (let i = 0; i < list.length && !found; i++) {
        const l = list[i];
        if (l && l.id === id) { found = l; return; }
        try { if (l && l.layers && l.layers.length) walk(l.layers); } catch (_) {}
      }
    }
    try { walk(psMod().app.activeDocument.layers); } catch (_) {}
    return found;
  }

  // Inside executeAsModal: brightness (0–255) of the photo layer over bbox, plus
  // which pixels the layer actually covers. Returns { luma, valid } (bw × bh).
  async function kbReadGarmentLuma(layerId, bbox) {
    const ps = psMod();
    const doc = ps.app.activeDocument;
    const bw = bbox.right - bbox.left, bh = bbox.bottom - bbox.top;
    const luma = new Uint8Array(bw * bh), valid = new Uint8Array(bw * bh), alpha = new Uint8Array(bw * bh);
    const layer = kbLayerById(layerId);
    if (!layer) return { luma: luma, valid: valid, alpha: alpha };
    const lb = layer.bounds;
    const sb = {
      left: Math.max(bbox.left, Math.floor(Number(lb.left) || 0)), top: Math.max(bbox.top, Math.floor(Number(lb.top) || 0)),
      right: Math.min(bbox.right, Math.ceil(Number(lb.right) || 0)), bottom: Math.min(bbox.bottom, Math.ceil(Number(lb.bottom) || 0)),
    };
    if (!(sb.right > sb.left && sb.bottom > sb.top)) return { luma: luma, valid: valid, alpha: alpha };
    const pr = await getLayerPixels8({ documentID: doc.id, layerID: layerId, sourceBounds: sb, componentSize: 8 });   // 16-bit safe
    const img = pr && pr.imageData;
    if (!img) return { luma: luma, valid: valid, alpha: alpha };
    try {
      const got = pr.sourceBounds || sb;
      const gl = Math.round(Number(got.left)), gt = Math.round(Number(got.top));
      const d = await img.getData({ chunky: true });
      const w = img.width, hgt = img.height, c = img.components || Math.round(d.length / (w * hgt));
      for (let y = 0; y < hgt; y++) {
        const oy = gt + y - bbox.top;
        if (oy < 0 || oy >= bh) continue;
        for (let x = 0; x < w; x++) {
          const ox = gl + x - bbox.left;
          if (ox < 0 || ox >= bw) continue;
          const p = (y * w + x) * c;
          const o = oy * bw + ox;
          alpha[o] = c === 4 ? d[p + 3] : 255;
          luma[o] = c >= 3 ? ((d[p] * 77 + d[p + 1] * 150 + d[p + 2] * 29) >> 8) : d[p];
          if (c === 4 && d[p + 3] < 128) continue;
          valid[o] = 1;
        }
      }
    } finally { try { img.dispose(); } catch (_) {} }
    return { luma: luma, valid: valid, alpha: alpha };
  }

  // ----- EDGE REFINE — SAM's hard, ~1K-pixel mask edges → smooth edges that
  // follow the real photo (guided filter, He et al.), only in a thin band
  // along each edge so texture/stitching inside a mask cannot punch holes.
  // guide = photo brightness 0..1 (gw×gh); silhouette = photo alpha 0..255.
  function kbGuidedRefine(plane, guide, silhouette, gw, gh, r, eps) {
    // work only inside the mask's padded box
    let x0 = gw, y0 = gh, x1 = -1, y1 = -1;
    for (let y = 0, k = 0; y < gh; y++) for (let x = 0; x < gw; x++, k++) if (plane[k] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return plane;
    const pad = r * 4;
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(gw - 1, x1 + pad); y1 = Math.min(gh - 1, y1 + pad);
    const w = x1 - x0 + 1, h = y1 - y0 + 1, n = w * h;
    const I = new Float32Array(n), P = new Float32Array(n), II = new Float32Array(n), IP = new Float32Array(n);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = (y0 + y) * gw + x0 + x, o = y * w + x;
      const iv = guide[k], pv = plane[k] / 255;
      I[o] = iv; P[o] = pv; II[o] = iv * iv; IP[o] = iv * pv;
    }
    const mI = kbBoxBlur(I, w, h, r), mP = kbBoxBlur(P, w, h, r);
    const mII = kbBoxBlur(II, w, h, r), mIP = kbBoxBlur(IP, w, h, r);
    const A = new Float32Array(n), B = new Float32Array(n);
    for (let o = 0; o < n; o++) {
      const varI = mII[o] - mI[o] * mI[o], cov = mIP[o] - mI[o] * mP[o];
      A[o] = cov / (varI + eps); B[o] = mP[o] - A[o] * mI[o];
    }
    const mA = kbBoxBlur(A, w, h, r), mB = kbBoxBlur(B, w, h, r);
    const out = Uint8Array.from(plane);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = y * w + x, k = (y0 + y) * gw + x0 + x;
      const band = mP[o];                       // 0 / 1 away from an edge, in between near it
      if (band <= 0.001 || band >= 0.999) continue;
      let q = mA[o] * I[o] + mB[o];
      if (q < 0) q = 0; if (q > 1) q = 1;
      if (silhouette) q *= silhouette[k] / 255;  // never outside the garment
      out[k] = Math.round(q * 255);
    }
    return out;
  }

  // Refine every mask against the photo, then balance neighbours so overlapping
  // soft edges never add up to more than full coverage (no double fill).
  // softPct: 0 = crisp (≈1–2 px anti-aliased edge that still follows the photo)
  // … 100 = the full guided-filter softness. Applied as a contrast curve.
  async function kbRefineMasks(masks, gw, gh, docW, docH, srcId, softPct) {
    if (!masks.length || srcId == null) return false;
    const ps = psMod();
    let g = null;
    await ps.core.executeAsModal(async function () { g = await kbReadGarmentLuma(srcId, { left: 0, top: 0, right: docW, bottom: docH }); },
      { commandName: "KBImage — read photo for edges" });
    let cover = 0; for (let k = 0; k < g.valid.length; k++) cover += g.valid[k];
    if (cover < 16) return false;
    let luma = g.luma, alpha = g.alpha;
    if (docW !== gw || docH !== gh) { luma = kbResamplePlane(luma, docW, docH, gw, gh); alpha = kbResamplePlane(alpha, docW, docH, gw, gh); }
    const N = gw * gh, guide = new Float32Array(N);
    for (let k = 0; k < N; k++) guide[k] = luma[k] / 255;
    const r = Math.max(3, Math.round(Math.min(gw, gh) * 0.004));
    const t0 = Date.now();
    // Radius per mask ≤ a quarter of its thickness (2·area/perimeter), so thin
    // parts (piping, trims, a zipper) are smoothed at their edge, never washed out.
    const radii = [];
    for (let i = 0; i < masks.length; i++) {
      const pl = masks[i].plane;
      let area = 0, per = 0;
      for (let y = 0, k = 0; y < gh; y++) for (let x = 0; x < gw; x++, k++) {
        if (pl[k] <= 127) continue;
        area++;
        if (x === 0 || y === 0 || x === gw - 1 || y === gh - 1 || pl[k - 1] <= 127 || pl[k + 1] <= 127 || pl[k - gw] <= 127 || pl[k + gw] <= 127) per++;
      }
      const thick = per ? (2 * area / per) : 0;
      const rz = Math.max(1, Math.min(r, Math.floor(thick / 4)));
      radii.push(rz);
      masks[i].plane = kbGuidedRefine(pl, guide, alpha, gw, gh, rz, 0.001);
    }
    const soft = (softPct == null) ? 100 : Math.max(0, Math.min(100, softPct));
    if (soft < 100) {
      const kc = 1 + (1 - soft / 100) * 7;                 // 1 (as filtered) … 8 (crisp)
      const lut = new Uint8Array(256);
      for (let v = 0; v < 256; v++) { let q = (v / 255 - 0.5) * kc + 0.5; if (q < 0) q = 0; if (q > 1) q = 1; lut[v] = Math.round(q * 255); }
      for (let i = 0; i < masks.length; i++) { const pl = masks[i].plane; for (let k = 0; k < N; k++) pl[k] = lut[pl[k]]; }
    }
    if (masks.length > 1) {
      for (let k = 0; k < N; k++) {
        let sum = 0;
        for (let i = 0; i < masks.length; i++) sum += masks[i].plane[k];
        if (sum > 255) { const f = 255 / sum; for (let i = 0; i < masks.length; i++) masks[i].plane[k] = Math.floor(masks[i].plane[k] * f); }
      }
    }
    trace("refine: softness " + soft + "%, " + masks.map(function (z, i) { return z.name + " r=" + radii[i]; }).join(", ") + " in " + (Date.now() - t0) + " ms");
    return true;
  }

  // Separable box blur (radius r) of a float plane.
  function kbBoxBlur(src, w, h, r) {
    const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      let acc = 0, n = 0;
      const o = y * w;
      for (let x = -r; x < w; x++) {
        const add = x + r, sub = x - r - 1;
        if (add < w) { acc += src[o + add]; n++; }
        if (sub >= 0) { acc -= src[o + sub]; n--; }
        if (x >= 0) tmp[o + x] = acc / n;
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0, n = 0;
      for (let y = -r; y < h; y++) {
        const add = y + r, sub = y - r - 1;
        if (add < h) { acc += tmp[add * w + x]; n++; }
        if (sub >= 0) { acc -= tmp[sub * w + x]; n--; }
        if (y >= 0) out[y * w + x] = acc / n;
      }
    }
    return out;
  }

  // Shading factors + warp offsets for a bw × bh box — frequency separation:
  //   low    = blur(L, rd)   broad light: folds, drape, shadows
  //   detail = L / low       fine detail: stitching, seams, ribbing, weave
  //   shade  = (1 + kFold·(low/ref − 1)) · (1 + kTex·(detail − 1)),  clamped 0.12…2.4
  //   disp   = warp · (blur(L, rw) − ref)/128 · maxShift px  (same shift on x and y)
  // ref = median brightness of the photo under the part. Separate strengths let
  // fine texture read through a busy print without overdoing the folds.
  // Once per panel session the first mask decoded in the panel is also placed and read
  // back the older way, and the two are compared (trace + session log), so the panel
  // decoder can be checked against Photoshop on a real file. The placed copy shows on
  // the canvas for a moment; the view is put back after.
  let kbMaskCompared = false;
  async function kbMaskCompare(b64, px, src, prompt) {
    const ps = psMod();
    let placed = null, lid = null;
    const snap = kbViewSnap();
    try {
      lid = await placeBase64AsLayer(b64, KB_TMP_LAYER);
      await ps.core.executeAsModal(async function () { placed = await kbReadActiveLayerPixels(src.sentW, src.sentH); }, { commandName: "KBImage — compare mask reads" });
    } finally {
      if (lid != null) { try { await deleteLayersById([lid]); } catch (_) {} }
      await kbViewRestore(snap);
    }
    const a0 = kbMaskPlane(px), b = kbMaskPlane(placed);
    const a = kbResamplePlane(a0.plane, px.width, px.height, placed.width, placed.height);
    const n = a.length;
    let off = 0, sum = 0, max = 0, inA = 0, inB = 0;
    for (let k = 0; k < n; k++) {
      const d = Math.abs(a[k] - b.plane[k]); sum += d; if (d > max) max = d;
      const ia = a[k] > 127, ib = b.plane[k] > 127; if (ia) inA++; if (ib) inB++; if (ia !== ib) off++;
    }
    const pct = n ? off * 100 / n : 0;
    const verdict = off === 0 ? "pixel for pixel" : (pct <= 1 ? "within 1%" : "OVER 1%");
    const line = "mask compare (“" + prompt + "”): panel " + px.width + "x" + px.height + " (" + a0.kind + ") vs placed " + placed.width + "x" + placed.height + " (" + b.kind + "): "
      + off + " of " + n + " px differ at 50% (" + pct.toFixed(3) + "%), mean |Δ| " + (n ? (sum / n).toFixed(2) : "0") + ", max |Δ| " + max + ", inside " + inA + " vs " + inB + " → " + verdict;
    trace(line);
    try { console.log(TAG, line); } catch (_) {}
    try {
      const rec = logRecordSkeleton("printswap:mask-compare", { prompt: prompt, panel: [px.width, px.height, a0.kind], placed: [placed.width, placed.height, b.kind],
        differ: off, total: n, pct: Math.round(pct * 1000) / 1000, meanAbs: n ? Math.round(sum / n * 100) / 100 : 0, maxAbs: max, verdict: verdict }, null, "sam");
      await logRun(rec); await logFinalizeCommitted(rec.id);
    } catch (_) {}
    return { off: off, total: n, pct: pct, verdict: verdict };
  }
  async function kbSamPart(prompt, src, opts) {
    const ps = psMod();
    const body = {
      image_url: "data:" + src.mime + ";base64," + src.base64,
      prompt: prompt,
      apply_mask: false,          // raw mask, not the image with the mask painted on it
      output_format: "png",
      sync_mode: true,            // masks come back inline (no second download host)
      include_scores: true,
      return_multiple_masks: true,
      max_masks: SAM_MAX_MASKS,
    };
    if (opts && opts.box) body.box_prompts = [opts.box];
    try {
      const dbg = Object.assign({}, body);
      dbg.image_url = dbg.image_url.slice(0, 44) + "…[len=" + body.image_url.length + "]";
      console.log(TAG, "sam: fal request →", (opts && opts.samPath) || kbSamPath(), JSON.stringify(dbg));
    } catch (_) {}

    const result = await falQueueJson(cachedFalKey, (opts && opts.samPath) || kbSamPath(), body);   // Print Swap pins SAM 3.1
    try { addSessionCost(SAM_COST_USD); } catch (_) {}   // billed per request, match or not

    let masks = (result && Array.isArray(result.masks)) ? result.masks.filter(function (m) { return m && m.url; }) : [];
    if (!masks.length && result && result.image && result.image.url) masks = [result.image];
    try {
      console.log(TAG, "sam: SAM “" + prompt + "” → " + masks.length + " mask(s)",
        "keys=" + JSON.stringify(result ? Object.keys(result) : null),
        "scores=" + JSON.stringify((result && result.scores) || null),
        "sizes=" + JSON.stringify(masks.map(function (m) { return (m.width || "?") + "x" + (m.height || "?") + " " + (m.content_type || ""); })));
    } catch (_) {}
    if (!masks.length) return null;

    // Each mask: place → read its pixels at SAM size → union (max) → delete.
    let combined = null, cw = 0, ch = 0;
    const kinds = [], tmpIds = [], planes = [];
    try {
      for (let i = 0; i < masks.length; i++) {
        const b64 = await kbFetchBase64(masks[i].url);
        // Decoded in the panel: the canvas never shows the mask. Else placed and read back.
        let px = null, lid = null, how = "panel";
        try { px = kbPngDecode(new Uint8Array(base64ToArrayBuffer(b64))); }
        catch (e) { px = null; trace("sam: mask " + (i + 1) + " not decoded in the panel (" + ((e && e.message) || e) + ")"); }
        if (!px) {
          how = "placed (fallback)";
          lid = await placeBase64AsLayer(b64, KB_TMP_LAYER);
          if (lid != null) tmpIds.push(lid);
          await ps.core.executeAsModal(async function () {
            px = await kbReadActiveLayerPixels(src.sentW, src.sentH);
          }, { commandName: "KBImage — read mask" });
        } else if (!kbMaskCompared) {
          kbMaskCompared = true;                          // once per panel session: both paths on the same mask
          try { await kbMaskCompare(b64, px, src, prompt); } catch (e) { traceErr("mask compare", e); }
        }
        trace("mask read: " + how + " — “" + prompt + "” mask " + (i + 1) + " of " + masks.length + ", " + px.width + "x" + px.height + "x" + px.components);
        const mp = kbMaskPlane(px);
        kinds.push(mp.kind + ":" + px.width + "x" + px.height + ":mid" + mp.midPct.toFixed(1) + "%");
        // Junk filter: when SAM is unsure it can return a mask filling (almost) the
        // whole picture/tile, or one with a very low score. Those are dropped.
        let inside = 0; for (let k = 0; k < mp.plane.length; k++) if (mp.plane[k] > 127) inside++;
        const cover = mp.plane.length ? inside / mp.plane.length : 0;
        const score = (result && Array.isArray(result.scores) && typeof result.scores[i] === "number") ? result.scores[i] : null;
        const maxCover = (opts && opts.maxCover) || 0.95;
        if (cover > maxCover || (score != null && score < SAM_MIN_SCORE) || inside === 0) {
          trace("reject: “" + prompt + "” mask " + (i + 1) + " — covers " + (cover * 100).toFixed(0) + "% (max " + Math.round(maxCover * 100) + "%), score " + (score == null ? "?" : score.toFixed(2)));
          if (lid != null) {
            try { await deleteLayersById([lid]); } catch (_) {}
            const at = tmpIds.indexOf(lid); if (at >= 0) tmpIds.splice(at, 1);
          }
          continue;
        }
        if (!combined) {
          combined = Uint8Array.from(mp.plane); cw = px.width; ch = px.height;
          planes.push(mp.plane);
        } else {
          const plane = (px.width === cw && px.height === ch) ? mp.plane : kbResamplePlane(mp.plane, px.width, px.height, cw, ch);
          for (let k = 0; k < combined.length; k++) { if (plane[k] > combined[k]) combined[k] = plane[k]; }
          planes.push(plane);
        }
        if (lid != null) {
          try { await deleteLayersById([lid]); } catch (_) {}
          const at = tmpIds.indexOf(lid); if (at >= 0) tmpIds.splice(at, 1);
        }
      }
    } finally {
      if (tmpIds.length) { try { await deleteLayersById(tmpIds.slice()); } catch (_) {} }
    }
    try { console.log(TAG, "sam: “" + prompt + "” mask planes →", kinds.join(" | ")); } catch (_) {}
    if (!combined) return null;                       // every mask was junk
    return { plane: combined, planes: planes, w: cw, h: ch, masks: planes.length, kinds: kinds };
  }

  // ----- Instances + direction ------------------------------------------------
  // SAM returns one mask per instance (left sleeve, right sleeve). If the masks
  // are separate pieces (little overlap, none tiny) they can be kept as separate
  // parts named by position: "<part> left" / "<part> right" (as seen on screen),
  // or "<part> 1…n" for more than two. Duplicates (heavy overlap) stay merged.
  function kbAxisAngle(plane, gw, gh) {
    let n = 0, sx = 0, sy = 0;
    for (let y = 0, k = 0; y < gh; y++) for (let x = 0; x < gw; x++, k++) if (plane[k] > 127) { n++; sx += x; sy += y; }
    if (n < 20) return { angle: 0, ratio: 1 };
    const mx = sx / n, my = sy / n;
    let cxx = 0, cyy = 0, cxy = 0;
    for (let y = 0, k = 0; y < gh; y++) for (let x = 0; x < gw; x++, k++) if (plane[k] > 127) {
      const dx = x - mx, dy = y - my; cxx += dx * dx; cyy += dy * dy; cxy += dx * dy;
    }
    cxx /= n; cyy /= n; cxy /= n;
    const tr = cxx + cyy, det = cxx * cyy - cxy * cxy;
    const disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
    const l1 = tr / 2 + disc, l2 = Math.max(1e-9, tr / 2 - disc);
    const ratio = Math.sqrt(l1 / l2);
    if (ratio < 1.4) return { angle: 0, ratio: ratio };
    const phi = 0.5 * Math.atan2(2 * cxy, cxx - cyy) * 180 / Math.PI;   // long axis, from +x, y down
    let a = phi - 90;
    while (a <= -90) a += 180;
    while (a > 90) a -= 180;
    return { angle: Math.round(a * 10) / 10, ratio: ratio };
  }

  // The active document's title.
  function kbDocTitle() { try { return String(psMod().app.activeDocument.title || ""); } catch (_) { return ""; } }
  const KB_ZOOM_TILES = 4;

  // Rect (doc px) → overlapping tiles covering it: 3 along a long side / 1 across
  // for tall or wide regions, else 2 × 2. 20% overlap so a part on a seam is whole.
  function kbTiles(r) {
    const w = r.right - r.left, h = r.bottom - r.top;
    const tall = h > w * 1.5, wide = w > h * 1.5;
    const cols = tall ? 1 : (wide ? 3 : 2), rows = tall ? 3 : (wide ? 1 : 2);
    const tw = w / cols, th = h / rows, ox = tw * 0.2, oy = th * 0.2;
    const out = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      out.push({
        left:   Math.max(r.left,   Math.floor(r.left + i * tw - ox)),
        top:    Math.max(r.top,    Math.floor(r.top + j * th - oy)),
        right:  Math.min(r.right,  Math.ceil(r.left + (i + 1) * tw + ox)),
        bottom: Math.min(r.bottom, Math.ceil(r.top + (j + 1) * th + oy)),
      });
    }
    return out;
  }

  // A crop plane (cw × ch, covering doc rect `rect`) → max-merged into a grid
  // plane (gw × gh covering the whole document).
  function kbPasteCrop(grid, gw, gh, docW, docH, crop, cw, ch, rect) {
    const sx = gw / docW, sy = gh / docH;
    const gx0 = Math.max(0, Math.round(rect.left * sx)), gy0 = Math.max(0, Math.round(rect.top * sy));
    const gx1 = Math.min(gw, Math.round(rect.right * sx)), gy1 = Math.min(gh, Math.round(rect.bottom * sy));
    const tw = gx1 - gx0, th = gy1 - gy0;
    if (tw < 1 || th < 1) return;
    const r = kbResamplePlane(crop, cw, ch, tw, th);
    for (let y = 0; y < th; y++) {
      const ro = y * tw, go = (gy0 + y) * gw + gx0;
      for (let x = 0; x < tw; x++) { const v = r[ro + x]; if (v > grid[go + x]) grid[go + x] = v; }
    }
  }

  // Bounding box (doc px) of everything > 127 in a grid plane, padded; null if empty.
  function kbPlaneBox(plane, gw, gh, docW, docH, padFrac) {
    let l = gw, t = gh, r = -1, b = -1;
    for (let y = 0; y < gh; y++) {
      const o = y * gw;
      for (let x = 0; x < gw; x++) if (plane[o + x] > 127) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y; }
    }
    if (r < 0) return null;
    const sx = docW / gw, sy = docH / gh;
    const L = l * sx, T = t * sy, R = (r + 1) * sx, B = (b + 1) * sy;
    const px = (R - L) * padFrac, py = (B - T) * padFrac;
    return {
      left: Math.max(0, Math.floor(L - px)), top: Math.max(0, Math.floor(T - py)),
      right: Math.min(docW, Math.ceil(R + px)), bottom: Math.min(docH, Math.ceil(B + py)),
    };
  }

  // SAM on one doc rect → { plane (crop size), w, h, masks } or null. Reads the crop
  // in its own modal. opts.box = {x_min,y_min,x_max,y_max} in CROP pixels.
  async function kbSamRect(prompt, rect, opts) {
    const ps = psMod();
    let crop = null;
    await ps.core.executeAsModal(async function () { crop = (opts && opts.src) ? await kbReadLayersSmall(rect, opts.src) : await kbReadCompositeSmall(rect); },
      { commandName: "KBImage — read pixels for masks" });
    let box = null;
    if (opts && opts.boxDoc) {
      const kx = crop.sentW / (rect.right - rect.left), ky = crop.sentH / (rect.bottom - rect.top);
      box = { x_min: Math.max(0, Math.round((opts.boxDoc.left - rect.left) * kx)), y_min: Math.max(0, Math.round((opts.boxDoc.top - rect.top) * ky)),
              x_max: Math.min(crop.sentW, Math.round((opts.boxDoc.right - rect.left) * kx)), y_max: Math.min(crop.sentH, Math.round((opts.boxDoc.bottom - rect.top) * ky)) };
    }
    const po = { maxCover: (opts && opts.maxCover) || 0.95 };
    if (box) po.box = box;
    if (opts && opts.samPath) po.samPath = opts.samPath;
    const r = await kbSamPart(prompt, crop, po);
    return r;
  }

  // Grid for a whole-document plane: the doc size, long edge capped at SAM_MAX_EDGE.
  function kbGridSize(docW, docH) {
    const k = Math.min(1, SAM_MAX_EDGE / Math.max(docW, docH));
    return { gw: Math.max(1, Math.round(docW * k)), gh: Math.max(1, Math.round(docH * k)) };
  }

  // Zoom retry for one part: SAM on close-up tiles of `region`; hits merged into a grid plane.
  async function kbSamZoom(part, region, docW, docH, gw, gh, extra) {
    const tiles = kbTiles(region).slice(0, KB_ZOOM_TILES);
    const grid = new Uint8Array(gw * gh);
    let masks = 0;
    for (let t = 0; t < tiles.length; t++) {
      setStatus("busy", "SAM: zooming in for “" + part + "” (close-up " + (t + 1) + " of " + tiles.length + ")…");
      const r = await kbSamRect(part, tiles[t], { maxCover: 0.6, samPath: extra && extra.samPath, src: extra && extra.src });   // a close-up mask filling the tile is junk
      if (r && r.plane) { masks += r.masks; kbPasteCrop(grid, gw, gh, docW, docH, r.plane, r.w, r.h, tiles[t]); }
    }
    trace("zoom: " + part + " → " + masks + " mask(s) over " + tiles.length + " tiles");
    return { plane: grid, masks: masks, calls: tiles.length };
  }

  // Place a PNG file entry as a new layer (placeEvent), named layerName.
  // Returns the new layer's id.
  async function kbPlaceEntryAsLayer(entry, layerName) {
    const ps = psMod();
    if (!ps.app.activeDocument) throw new Error("Open a Photoshop document first.");
    const token = await fsLocal().createSessionToken(entry);
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
      if (layerName) { try { await renameActiveLayer(layerName); } catch (_) {} }
      try {
        const doc = ps.app.activeDocument;
        const layer = doc && doc.activeLayers && doc.activeLayers[0];
        if (layer && typeof layer.id !== "undefined") layerID = layer.id;
      } catch (_) {}
    }, { commandName: "KBImage — read print file" });
    return layerID;
  }

  // ----- PRINT TILE — deterministic fill of one part ---------------------------
  // Tile a texture (tw × th, `comps` bytes per pixel) across a bw × bh region
  // whose top-left is (originX, originY) in document pixels. One repeat is
  // tileW × tileH document pixels; a repeat is centered on (anchorX, anchorY)
  // and the whole lattice is rotated rotDeg clockwise about that anchor.
  // Returns RGBA. Pure arithmetic — the same inputs always give the same pixels.
  function kbComposeTile(bw, bh, originX, originY, tex, tw, th, comps, tileW, tileH, rotDeg, anchorX, anchorY, disp) {
    const out = new Uint8Array(bw * bh * 4);
    const hasA = (comps === 4);

    // Exact path: no rotation, no fold warp, and the texture is already at
    // repeat size → straight pixel copy (no resampling at all).
    if (rotDeg === 0 && !disp && tw === tileW && th === tileH) {
      const ax = Math.round(anchorX - tileW / 2);
      const ay = Math.round(anchorY - tileH / 2);
      const col = new Int32Array(bw);
      for (let x = 0; x < bw; x++) {
        let u = (originX + x - ax) % tw; if (u < 0) u += tw;
        col[x] = u * comps;
      }
      let o = 0;
      for (let y = 0; y < bh; y++) {
        let v = (originY + y - ay) % th; if (v < 0) v += th;
        const row = v * tw * comps;
        for (let x = 0; x < bw; x++) {
          const p = row + col[x];
          out[o]     = tex[p];
          out[o + 1] = tex[p + 1];
          out[o + 2] = tex[p + 2];
          out[o + 3] = hasA ? tex[p + 3] : 255;
          o += 4;
        }
      }
      return out;
    }

    // General path: inverse-rotate each output pixel into tile space, wrap,
    // bilinear sample.
    const rad = rotDeg * Math.PI / 180;
    const cs = Math.cos(rad), sn = Math.sin(rad);
    const kx = tw / tileW, ky = th / tileH;
    const hx = tw / 2 - 0.5, hy = th / 2 - 0.5;
    let o = 0;
    for (let y = 0; y < bh; y++) {
      const dy0 = originY + y + 0.5 - anchorY;
      for (let x = 0; x < bw; x++) {
        const dsh = disp ? disp[y * bw + x] : 0;            // fold warp (same shift on x and y)
        const dx = originX + x + 0.5 - anchorX + dsh;
        const dy = dy0 + dsh;
        const u = (dx * cs + dy * sn) * kx + hx;
        const v = (dy * cs - dx * sn) * ky + hy;
        let x0 = Math.floor(u), y0 = Math.floor(v);
        const fx = u - x0, fy = v - y0;
        x0 = x0 % tw; if (x0 < 0) x0 += tw;
        y0 = y0 % th; if (y0 < 0) y0 += th;
        const x1 = (x0 + 1 === tw) ? 0 : x0 + 1;
        const y1 = (y0 + 1 === th) ? 0 : y0 + 1;
        const p00 = (y0 * tw + x0) * comps, p10 = (y0 * tw + x1) * comps;
        const p01 = (y1 * tw + x0) * comps, p11 = (y1 * tw + x1) * comps;
        const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
        out[o]     = tex[p00]     * w00 + tex[p10]     * w10 + tex[p01]     * w01 + tex[p11]     * w11 + 0.5;
        out[o + 1] = tex[p00 + 1] * w00 + tex[p10 + 1] * w10 + tex[p01 + 1] * w01 + tex[p11 + 1] * w11 + 0.5;
        out[o + 2] = tex[p00 + 2] * w00 + tex[p10 + 2] * w10 + tex[p01 + 2] * w01 + tex[p11 + 2] * w11 + 0.5;
        out[o + 3] = hasA ? (tex[p00 + 3] * w00 + tex[p10 + 3] * w10 + tex[p01 + 3] * w01 + tex[p11 + 3] * w11 + 0.5) : 255;
        o += 4;
      }
    }
    return out;
  }

  async function kbReadPrintTexture(entry, targetW) {
    const ps = psMod();
    const app = ps.app;
    const homeDoc = app.activeDocument;
    let tex = null;
    try {
      trace("print: opening " + ((entry && entry.name) || "?") + " as its own document");
      await ps.core.executeAsModal(async function () {
        const pd = await app.open(entry);
        trace("print: opened, mode=" + String(pd.mode) + " bits=" + String(pd.bitsPerChannel) + " size=" + pd.width + "x" + pd.height);
        try {
          try {
            if (!/rgb/i.test(String(pd.mode || ""))) await pd.changeMode(ps.constants.ChangeMode.RGB);
          } catch (e) { try { console.warn(TAG, "sam: print changeMode failed:", e); } catch (_) {} }
          try {
            if (/16|32/.test(String(pd.bitsPerChannel || ""))) pd.bitsPerChannel = ps.constants.BitsPerChannel.EIGHT;
          } catch (e) { try { console.warn(TAG, "sam: print bit-depth change failed:", e); } catch (_) {} }
          const W = Math.round(pd.width), H = Math.round(pd.height);
          if (!(W > 0 && H > 0)) throw new Error("The print file has no pixels.");
          let tw = Math.max(1, Math.min(W, Math.round(targetW)));
          let th = Math.max(1, Math.round(tw * H / W));
          if (th > KB_TEX_MAX) { const k = KB_TEX_MAX / th; th = KB_TEX_MAX; tw = Math.max(1, Math.round(tw * k)); }
          const opts = { documentID: pd.id, sourceBounds: { left: 0, top: 0, right: W, bottom: H }, componentSize: 8, applyAlpha: false };
          if (tw < W || th < H) opts.targetSize = { width: tw, height: th };
          const pr = await ps.imaging.getPixels(opts);
          if (!pr || !pr.imageData) throw new Error("imaging.getPixels returned no imageData for the print.");
          const img = pr.imageData;
          try {
            const data = await img.getData({ chunky: true });
            tex = {
              data: data, width: img.width, height: img.height,
              components: img.components || Math.round(data.length / (img.width * img.height)),
              colorSpace: img.colorSpace || "", layerW: W, layerH: H, via: "open",
            };
          } finally { try { img.dispose(); } catch (_) {} }
        } finally {
          try { await pd.closeWithoutSaving(); } catch (_) {}
          try { if (homeDoc) app.activeDocument = homeDoc; } catch (_) {}
        }
      }, { commandName: "KBImage — read print file" });
      if (tex) { trace("print: read " + tex.width + "x" + tex.height + " c=" + tex.components); return tex; }
    } catch (e) {
      traceErr("open print as document (falling back to place)", e);
      try { console.warn(TAG, "sam: open-print path failed, falling back to place:", e); } catch (_) {}
      try { if (homeDoc && app.activeDocument !== homeDoc) app.activeDocument = homeDoc; } catch (_) {}
    }

    // Fallback: place into the working document, rasterize, read, delete.
    trace("print: fallback — placing into the working document");
    const tmpId = await kbPlaceEntryAsLayer(entry, KB_TMP_LAYER);
    try {
      await ps.core.executeAsModal(async function () {
        try {
          await ps.action.batchPlay(
            [{ _obj: "rasterizeLayer", _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
               _options: { dialogOptions: "dontDisplay" } }],
            { synchronousExecution: true });
        } catch (_) {}
        tex = await kbReadActiveLayerPixels(Math.min(targetW, KB_TEX_MAX), 0);
        if (tex) tex.via = "place";
      }, { commandName: "KBImage — read print pixels" });
    } finally {
      try { await deleteLayersById([tmpId]); } catch (_) {}
    }
    return tex;
  }

  // =======================================================================
  // PRINT SWAP — step 2 GARMENT and step 5 GRAY.
  // The garment lives in alpha channel "KBPS garment"; every Print Swap
  // channel starts with "KBPS".
  //
  //   FIND GARMENT — SAM 3.1, prompt "garment", whole picture → edges refined
  //                  against the photo → channel "KBPS garment" → shown as the
  //                  active selection.
  //   TOUCH UP     — + Add / − Remove the current Photoshop selection to / from
  //                  that channel, or Use selection as garment.
  //   MAKE GRAY    — Accept / Re-run. No AI: the garment area as seen (CLEAN
  //                  when step 3 was accepted), tint removed and the median
  //                  brightness shifted evenly to the target gray, so folds
  //                  keep their depth. Placed as "GREY exact", masked to the
  //                  garment.
  // =======================================================================
  const PS_GARMENT_CH   = "KBPS garment";             // Print Swap's own garment channel
  const PS_TMP_CH       = "KBPS_tmp_edit";            // temp channel for touch-ups
  const PS_GREY_NAME    = "GREY";
  const PS_TMP_LAYER    = "kb_ps_tmp";                // temp layers (always deleted)
  const PS_SAM_PATH     = "fal-ai/sam-3-1/image";     // SAM 3.1
  const PS_GRAY_DEFAULT = "#BABABA";
  const PS_EDGE_SOFT    = 15;                         // edge refine softness (%)

  let psPhotoLayerId = null;                          // the photo layer the garment was found on

  function psTargetHex() {
    const raw = String((($("ps-target-gray") || {}).value) || "").trim();
    const rgb = kbParseHex(raw || PS_GRAY_DEFAULT);
    if (!rgb) return null;
    const h = function (n) { return (n < 16 ? "0" : "") + n.toString(16).toUpperCase(); };
    return { hex: "#" + h(rgb[0]) + h(rgb[1]) + h(rgb[2]), rgb: rgb };
  }

  // ----- Target gray (step 5 face) ------------------------------------------------
  // Swatch + hex box + chips Light / Mid (default) / Dark / Custom… (Photoshop's color
  // picker). A color that is not neutral becomes the gray of the same lightness (CIE L*,
  // i.e. the same luminance). Saved per document with the print settings: `gray` (the
  // choice) and `grayMade` (the gray GREY exact was made with). When step 5 is done and
  // they differ, Make gray reads Update gray.
  const PS_GRAY_CHIPS = { light: "#D0D0D0", mid: "#BABABA", dark: "#8C8C8C" };
  let psGrayDoc = { docId: null, made: null };
  function psHex(rgb) { const h = function (n) { return (n < 16 ? "0" : "") + n.toString(16).toUpperCase(); }; return "#" + h(rgb[0]) + h(rgb[1]) + h(rgb[2]); }
  // Pure: the neutral gray with the same lightness as rgb (sRGB → luminance → sRGB).
  function psGrayOfSameLightness(rgb) {
    const lin = function (v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const Y = 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
    const g = Y <= 0.0031308 ? Y * 12.92 : 1.055 * Math.pow(Y, 1 / 2.4) - 0.055;
    const v = Math.max(0, Math.min(255, Math.round(g * 255)));
    return [v, v, v];
  }
  function psGrayMade() { return psGrayDoc.docId === psActiveDocId() && psGrayDoc.made ? psGrayDoc.made : PS_GRAY_DEFAULT; }
  function psGrayFaceSync() {
    const t = psTargetHex(), hex = t ? t.hex : null;
    const sw = $("ps-gray-swatch"); if (sw && hex) sw.style.backgroundColor = hex;
    const g = $("pills-ps-gray-chip");
    if (g) {
      let which = "custom";
      Object.keys(PS_GRAY_CHIPS).forEach(function (k) { if (PS_GRAY_CHIPS[k] === hex) which = k; });
      const ps = g.querySelectorAll(".pill");
      for (let i = 0; i < ps.length; i++) ps[i].classList.toggle("selected", ps[i].getAttribute("data-value") === which);
    }
    const btn = $("ps-gray-btn");
    if (btn) btn.textContent = psGrayNeedsUpdate() ? "Update gray" : "Make gray";
  }
  // Step 5 done and the chosen gray is not the one GREY exact was made with.
  function psGrayNeedsUpdate() {
    try {
      const g = psGreyExactLayer(); if (!g || psIsPending(g.id)) return false;
      const t = psTargetHex(); return !!t && t.hex !== psGrayMade();
    } catch (_) { return false; }
  }
  async function psGraySaveDoc(fields) {
    try { const st = await psStateLoad(); Object.keys(fields).forEach(function (k) { st[k] = fields[k]; }); await psStateSave(st); }
    catch (e) { traceErr("ps: save gray", e); }
  }
  // Any new gray (chip, box, picker): made neutral, shown, saved with the document.
  async function psGraySet(rgb, by) {
    const neutral = rgb[0] === rgb[1] && rgb[1] === rgb[2];
    const g = neutral ? rgb : psGrayOfSameLightness(rgb), hex = psHex(g);
    const box = $("ps-target-gray"); if (box) box.value = hex;
    psGrayFaceSync();
    await psGraySaveDoc({ gray: hex });
    trace("ps gray: target " + hex + " (" + by + (neutral ? "" : ", from " + psHex(rgb)) + ")");
    setStatus("ok", (neutral ? "Target gray " + hex + "." : "Converted to gray " + hex + " (same lightness as " + psHex(rgb) + ").")
      + (psGrayNeedsUpdate() ? " Click Update gray to use it." : ""));
    return hex;
  }
  async function psGrayFromBox() {
    const box = $("ps-target-gray"); if (!box) return;
    const rgb = kbParseHex(box.value);
    if (!rgb) { setStatus("bad", "Type the gray as a hex value, for example #BABABA."); psGrayRestoreBox(); return; }
    await psGraySet(rgb, "typed");
  }
  function psGrayRestoreBox() { psMod().app.activeDocument && psStateLoad().then(function (st) { const b = $("ps-target-gray"); if (b) b.value = st.gray || PS_GRAY_DEFAULT; psGrayFaceSync(); }).catch(function () {}); }
  function psOnGrayChip(value) {
    if (value === "custom") { actPsGrayCustom(); return; }
    const hex = PS_GRAY_CHIPS[value]; if (hex) psGraySet(kbParseHex(hex), value);
  }
  // Photoshop's color picker, starting at the current gray. Click the canvas while it is
  // open to sample (for example the print's ground color).
  async function actPsGrayCustom() {
    if (generateInFlight) { psGrayFaceSync(); return; }
    const ps = psMod();
    const t = psTargetHex() || { rgb: kbParseHex(PS_GRAY_DEFAULT) };
    let res = null;
    try {
      await ps.core.executeAsModal(async function () {
        res = await ps.action.batchPlay([{ _obj: "showColorPicker", context: "Print Swap target gray",
          color: { _obj: "RGBColor", red: t.rgb[0], grain: t.rgb[1], blue: t.rgb[2] }, _options: { dialogOptions: "dontDisplay" } }], { synchronousExecution: false });
      }, { commandName: "KBImage — pick gray" });
    } catch (e) { traceErr("ps gray: color picker", e); setStatus("bad", "The color picker did not open: " + ((e && e.message) || String(e))); psGrayFaceSync(); return; }
    const rgb = psPickerRgb(res && res[0]);
    if (!rgb) { setStatus("ok", "Custom gray: nothing picked."); psGrayFaceSync(); return; }
    await psGraySet(rgb, "picker");
  }
  // Pure: the RGB out of a showColorPicker result (color / RGBFloatColor; green as grain),
  // or null (cancelled).
  function psPickerRgb(r) {
    if (!r) return null;
    const c = r.color || r.RGBFloatColor || r.rgbFloatColor || r;
    if (!c || typeof c !== "object") return null;
    let R = Number(c.red), G = Number(c.grain != null ? c.grain : c.green), B = Number(c.blue);
    if (!(isFinite(R) && isFinite(G) && isFinite(B))) return null;
    if (R <= 1 && G <= 1 && B <= 1 && (R % 1 || G % 1 || B % 1)) { R *= 255; G *= 255; B *= 255; }
    const cl = function (v) { return Math.max(0, Math.min(255, Math.round(v))); };
    return [cl(R), cl(G), cl(B)];
  }
  // This document's gray (from its saved state; default Mid).
  function psGrayFromDocState(id, st) {
    psGrayDoc = { docId: id, made: (st && st.grayMade) || null };
    const b = $("ps-target-gray"); if (b) b.value = (st && st.gray) || PS_GRAY_DEFAULT;
    psGrayFaceSync();
  }

  // Enable "Make gray" only once a garment channel exists.
  function psRefreshUi() {
    const has = kbChannelExists(PS_GARMENT_CH);
    const btn = $("ps-gray-btn");
    if (btn) btn.classList.toggle("disabled", !has);
    const fc = $("ps-find-cost");
    if (fc) fc.textContent = psFindCostText();
    try { psGrayFaceSync(); } catch (_) {}
  }
  // Find garment's SAM calls: garment, collar ×2, skin + hair (when growing), cuff + hand,
  // hands; arms only for long sleeves with the hands over the garment.
  function psFindCostText() {
    const n = 1 + 2 + (psGarmentGrow() > 0 ? 2 : 0) + 2 + 1;
    return "SAM 3.1 · $" + (SAM_COST_USD * n).toFixed(3) + " (+$" + SAM_COST_USD.toFixed(3) + " for arms, long sleeves)";
  }
  function psOnTabOpen() { try { psRefreshUi(); } catch (_) {} try { const c = $("ps-clean-cost"); if (c) c.textContent = psCleanCostText(); } catch (_) {} }

  // The photo the garment sits on: the active layer when Find was clicked
  // (if it is not one of the plug-in's own layers), else the topmost ordinary layer.
  function psPickPhotoLayer() {
    const up = psUpscaleLayer();
    if (up) return up.id;                            // step 0: UPSCALE is the photo
    const id = kbActiveLayerId();
    const nm = id != null ? kbLayerName(id) : "";
    if (id != null && nm !== PS_GREY_NAME && nm.indexOf(PS_GREY_NAME + " ") !== 0 && nm.indexOf("kb_") !== 0 && nm !== "CLEAN" && nm !== "WHITE" && nm !== "MODEL" && nm !== "BG LIGHTEN") return id;
    const o = psOriginalPhotoId();                     // never WHITE / MODEL
    return o != null ? o : kbGarmentSourceLayer();
  }

  // Inside nothing (opens its own modals): a plane (gw×gh, white = garment) →
  // channel `chName`, via the proven route: place it as an opaque black/white
  // image on top, its brightness → the selection, save, delete the temp layer.
  async function psPlaneToChannel(plane, gw, gh, docW, docH, chName) {
    const ps = psMod();
    const N = gw * gh, rgba = new Uint8Array(N * 4);
    for (let k = 0, o = 0; k < N; k++, o += 4) { const v = plane[k]; rgba[o] = v; rgba[o + 1] = v; rgba[o + 2] = v; rgba[o + 3] = 255; }
    const file = await kbRgbaToFile(rgba, gw, gh);
    let tmpId = null;
    try {
      await ps.core.executeAsModal(async function () {
        const doc = ps.app.activeDocument;
        try { await deselectAll(); } catch (_) {}
        try { const top = doc.layers && doc.layers[0]; if (top) await kbSelectLayerById(top.id); } catch (_) {}
        try { await selectRGBChannel(); } catch (_) {}
        tmpId = await kbPlaceFileInModal(file, PS_TMP_LAYER, { left: 0, top: 0, right: docW, bottom: docH });
        await kbSelectCompositeLuminosity();
        await kbRemoveChannels(chName);
        await saveSelectionToChannel(chName);
        try { await deselectAll(); } catch (_) {}
      }, { commandName: "KBImage — save garment" });
    } finally {
      await kbDeleteFile(file);
      if (tmpId != null) { try { await deleteLayersById([tmpId]); } catch (_) {} }
    }
  }

  // A full-size plane (rw × rh over rect, document px) → channel chName, cut by KBPS garment
  // (its own edge is the part's outer edge; outside rect nothing is kept).
  async function psPlaneRectToChannel(plane, rw, rh, rect, chName) {
    const ps = psMod();
    const N = rw * rh, rgba = new Uint8Array(N * 4);
    for (let k = 0, o = 0; k < N; k++, o += 4) { const v = plane[k]; rgba[o] = v; rgba[o + 1] = v; rgba[o + 2] = v; rgba[o + 3] = 255; }
    const file = await kbRgbaToFile(rgba, rw, rh);
    let tmpId = null;
    try {
      await ps.core.executeAsModal(async function () {
        const doc = ps.app.activeDocument;
        try { await deselectAll(); } catch (_) {}
        try { const top = doc.layers && doc.layers[0]; if (top) await kbSelectLayerById(top.id); } catch (_) {}
        try { await selectRGBChannel(); } catch (_) {}
        tmpId = await kbPlaceFileInModal(file, PS_TMP_LAYER, rect);
        await kbSelectCompositeLuminosity();
        await kbLoadChannel(PS_GARMENT_CH, "intersect");
        await kbRemoveChannels(chName);
        if (kbSelectionBounds()) await saveSelectionToChannel(chName);
        try { await deselectAll(); } catch (_) {}
      }, { commandName: "KBImage — save " + chName });
    } finally {
      await kbDeleteFile(file);
      if (tmpId != null) { try { await deleteLayersById([tmpId]); } catch (_) {} }
    }
  }

  async function psShowGarmentSelection() {
    const ps = psMod();
    await ps.core.executeAsModal(async function () {
      await kbLoadChannel(PS_GARMENT_CH);
      if (psPhotoLayerId != null) { try { await kbSelectLayerById(psPhotoLayerId); } catch (_) {} }
    }, { commandName: "KBImage — show garment" });
    await psGarmentSnapTake();                       // what "the garment as a selection" looks like
  }

  // ----- FIND GARMENT ----------------------------------------------------------
  async function actPsFindGarment() {
    if (generateInFlight) { kbBusyNote(); return; }
    const ps = psMod();
    const doc = ps.app.activeDocument;
    if (!doc) { setStatus("bad", "Open a Photoshop document first."); return; }
    const problem = kbDocProblem(doc);
    if (problem) { setStatus("bad", problem); return; }
    try { psGtypeFollowDoc(); } catch (_) {}          // never a type left over from another document
    if (!psGtypeById(psGarmentType)) { setStatus("bad", "Pick the garment type first (step 2, above Find garment)."); return; }
    if (!cachedFalKey) { setStatus("bad", "Add your Fal API key in Settings (gear icon) to find the garment."); return; }
    await psGtypeSave(psGarmentType);                      // the type goes with the document
    const btn = $("ps-find-btn");
    if (btn) btn.classList.add("disabled");
    generateInFlight = true;
    traceStart("Print Swap — Find garment (" + PS_SAM_PATH + ")");
    let step = "reading the document";
    try {
      psPhotoLayerId = psPickPhotoLayer();
      trace("ps: photo layer " + psPhotoLayerId + " (" + kbLayerName(psPhotoLayerId) + ")");
      const docW = Math.round(doc.width), docH = Math.round(doc.height);
      if (docW * docH > KB_MAX_PIXELS) throw new Error("the document is too large (" + docW + " × " + docH + ").");
      const G = kbGridSize(docW, docH), gw = G.gw, gh = G.gh, N = gw * gh;
      const full = { left: 0, top: 0, right: docW, bottom: docH };

      step = "asking SAM 3.1 for the garment";
      setStatus("busy", "SAM 3.1: finding the garment…");
      let r = await kbSamRect("garment", full, { samPath: PS_SAM_PATH });
      let plane = null, area = 0;
      if (r && r.plane) {
        plane = new Uint8Array(N);
        kbPasteCrop(plane, gw, gh, docW, docH, r.plane, r.w, r.h, full);
        for (let k = 0; k < N; k++) if (plane[k] > 127) area++;
      }
      let zoomCalls = 0;
      if (!area) {                                            // retry close up
        step = "looking closer for the garment";
        const zr = await kbSamZoom("garment", full, docW, docH, gw, gh, { samPath: PS_SAM_PATH });
        zoomCalls = zr.calls;
        for (let k = 0; k < N; k++) if (zr.plane[k] > 127) area++;
        if (area) plane = zr.plane;
      }
      const rec = logRecordSkeleton("printswap:find",
        { prompt: "garment", model: PS_SAM_PATH, masks: r ? r.masks : 0, zoomCalls: zoomCalls,
          estCostUsd: SAM_COST_USD * (1 + zoomCalls) }, psPhotoLayerId, "composite");
      rec.routedVia = "fal";
      await logRun(rec);
      if (!area) throw new Error("SAM found no garment. Select it by hand, then use + Add.");

      // auto edge fix — collar and back neck added, grown into the old-garment fringe (not skin or hair).
      step = "fixing the garment edge";
      const fixCalls = await psGarmentAutoFix(plane, gw, gh, docW, docH);
      const frec = logRecordSkeleton("printswap:garment-fix-sam", { model: PS_SAM_PATH, calls: fixCalls, growPx: psGarmentGrow(), estCostUsd: SAM_COST_USD * fixCalls }, psPhotoLayerId, "composite");
      frec.routedVia = "fal";
      await logRun(frec);
      await logFinalizeCommitted(frec.id);

      step = "taking the hands off the garment";
      const hands = await psHandsOffGarment(plane, gw, gh, docW, docH);
      const hrec = logRecordSkeleton("printswap:garment-hands", { model: PS_SAM_PATH, calls: hands.calls, found: hands.found, arms: hands.arms,
        removedPx: hands.removedPx, estCostUsd: SAM_COST_USD * hands.calls }, psPhotoLayerId, "composite");
      hrec.routedVia = "fal";
      await logRun(hrec);
      await logFinalizeCommitted(hrec.id);
      const handsMsg = " Hands: " + (hands.found ? hands.removedPx.toLocaleString("en-US") + " px taken off the garment" + (hands.arms ? " (arms checked too)" : "") : "none found, garment unchanged")
        + " (SAM 3.1 +" + hands.calls + " call" + (hands.calls > 1 ? "s" : "") + ", $" + (SAM_COST_USD * hands.calls).toFixed(3) + ").";

      step = "refining the edges";
      setStatus("busy", "Refining the garment edge against the photo…");
      const one = [{ name: "garment", plane: plane }];
      try { await kbRefineMasks(one, gw, gh, docW, docH, psPhotoLayerId, PS_EDGE_SOFT); }
      catch (e) { traceErr("ps refine (kept as SAM made it)", e); }

      step = "saving the garment";
      setStatus("busy", "Saving the garment…");
      await psPlaneToChannel(one[0].plane, gw, gh, docW, docH, PS_GARMENT_CH);
      await psSoftenAfterSave([PS_GARMENT_CH], "garment", "garment");                  // edge softness
      await logFinalizeCommitted(rec.id);
      const stale = await psGarmentChanged();                               // later steps out of date
      await psShowGarmentSelection();
      trace("ps: garment saved to " + PS_GARMENT_CH);
      setStatus("ok", "Garment found and selected." + handsMsg + " Check the selection. Fix any miss before making it gray." + psStaleMsg(stale));
    } catch (err) {
      traceErr("ps find / " + step, err);
      setStatus("bad", "Find garment failed while " + step + ": " + ((err && err.message) || String(err)));
    } finally {
      generateInFlight = false;
      if (btn) btn.classList.remove("disabled");
      try { psRefreshUi(); updateDocInfo(); } catch (_) {}
      await traceFlush();
    }
  }

  // ----- TOUCH UP — + / − the current selection to / from the garment ----------
  // "replace" (Use selection as garment) — the selection becomes the garment.
  async function actPsEditGarment(srcEl) {
    if (generateInFlight) { kbBusyNote(); return; }
    const ps = psMod();
    if (!ps.app.activeDocument) { setStatus("bad", "Open a Photoshop document first."); return; }
    const dm = srcEl && srcEl.getAttribute && srcEl.getAttribute("data-mode");
    const mode = dm === "subtract" ? "subtract" : (dm === "replace" ? "replace" : "add");
    const verb = mode === "add" ? "add to" : (mode === "subtract" ? "remove from" : "use as");
    if (!kbSelectionBounds()) {
      setStatus("bad", "Select the bit to " + verb + " the garment first (Lasso or any selection tool).");
      return;
    }
    const had = kbChannelExists(PS_GARMENT_CH);
    if (!had && mode === "subtract") { setStatus("bad", "There is no garment yet. Click Find garment, or select it and use + Add."); return; }
    generateInFlight = true;
    traceStart("Print Swap — " + (mode === "replace" ? "selection as" : verb) + " garment");
    try {
      const softPx = psEdgeSoft("garment");
      await ps.core.executeAsModal(async function () {
        // keep the user's selection BEFORE the unsoften below, which
        // loads the garment as the selection, or the garment would be added to itself.
        if (had && mode !== "replace") { await kbRemoveChannels(PS_TMP_CH); await saveSelectionToChannel(PS_TMP_CH); }
        if (had && mode !== "replace") await psUnsoftenInModal(PS_GARMENT_CH);   // edit the hard version
        await (async function () {
        if (!had || mode === "replace") {             // first + Add, or Use selection: the selection IS the garment
          await kbRemoveChannels(PS_GARMENT_CH);
          await saveSelectionToChannel(PS_GARMENT_CH);
          return;
        }
        try {
          await kbLoadChannel(PS_GARMENT_CH);
          await kbLoadChannel(PS_TMP_CH, mode);
          if (!kbSelectionBounds()) throw new Error("that would leave the garment empty.");
          await kbRemoveChannels(PS_GARMENT_CH);
          await saveSelectionToChannel(PS_GARMENT_CH);
        } finally {
          await kbRemoveChannels(PS_TMP_CH);
        }
        })();
        await psSoftenAfterSaveInModal(PS_GARMENT_CH, softPx);               // soften again
      }, { commandName: "KBImage — edit garment" });
      const stale = await psGarmentChanged();                               // later steps out of date
      await psShowGarmentSelection();
      const rec = logRecordSkeleton("printswap:edit", { mode: mode, firstGarment: !had }, psPhotoLayerId, "selection");
      await logRun(rec);
      await logFinalizeCommitted(rec.id);
      setStatus("ok", (mode === "add" ? "Added to the garment." : (mode === "subtract" ? "Removed from the garment." : "The selection is now the garment.")) + " The garment is selected." + psStaleMsg(stale));
    } catch (err) {
      traceErr("ps edit", err);
      setStatus("bad", "Could not " + verb + " the garment: " + ((err && err.message) || String(err)));
    } finally {
      generateInFlight = false;
      try { psRefreshUi(); psStepsRefresh(); } catch (_) {}
      await traceFlush();
    }
  }

  // ----- MAKE GRAY -------------------------------------------------------------

  // Inside nothing: the garment channel's coverage (alpha 0..255) over `rect`, at
  // doc resolution. Route 1: a temp white layer, the channel as its mask, mask
  // APPLIED (baked into transparency), alpha read back. Route 2 (if route 1 left
  // no transparency): a temp layer filled white THROUGH the loaded selection.
  // First route: the channel loaded as the selection and read with imaging.getSelection —
  // no temp layer, so the canvas does not change. Then the older temp-layer routes, with
  // the view put back after them.
  let psMaskSelRoute = null;                          // null untried · "ok" · "no"
  async function psReadMaskBySelection(rect, CH) {
    const ps = psMod();
    if (psMaskSelRoute === "no" || !ps.imaging || typeof ps.imaging.getSelection !== "function") return null;
    const rw = rect.right - rect.left, rh = rect.bottom - rect.top;
    let out = null;
    try {
      await ps.core.executeAsModal(async function () {
        const doc = ps.app.activeDocument;
        try { await deselectAll(); } catch (_) {}
        await kbLoadChannel(CH);
        let selB = null; try { selB = doc.selection.bounds; } catch (_) {}
        let r = null;
        try { r = await ps.imaging.getSelection({ documentID: doc.id, sourceBounds: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } }); }
        finally { try { await deselectAll(); } catch (_) {} }
        const img = r && r.imageData;
        if (!img) throw new Error("getSelection returned no imageData.");
        try {
          const d = await img.getData({ chunky: true });
          const w = img.width, h = img.height, c = img.components || Math.max(1, Math.round(d.length / (w * h)));
          const cs = img.componentSize || 8;
          const got = r.sourceBounds || rect, gl = Math.round(Number(got.left) || 0), gt = Math.round(Number(got.top) || 0);
          const a = new Uint8Array(rw * rh);
          for (let y = 0; y < h; y++) {
            const oy = gt + y - rect.top; if (oy < 0 || oy >= rh) continue;
            for (let x = 0; x < w; x++) {
              const ox = gl + x - rect.left; if (ox < 0 || ox >= rw) continue;
              let v = d[(y * w + x) * c];
              if (cs === 16) v = Math.round(v * 255 / 32768); else if (cs === 32) v = Math.round(v * 255);
              a[oy * rw + ox] = v > 255 ? 255 : (v < 0 ? 0 : v);
            }
          }
          // check the read against Photoshop's own selection bounds (a wrong read is never used)
          if (selB) {
            let l = rw, t = rh, rr = -1, bb = -1;
            for (let y = 0, k = 0; y < rh; y++) for (let x = 0; x < rw; x++, k++) if (a[k]) { if (x < l) l = x; if (x > rr) rr = x; if (y < t) t = y; if (y > bb) bb = y; }
            const L = Math.max(rect.left, Math.round(Number(selB.left))) - rect.left, T = Math.max(rect.top, Math.round(Number(selB.top))) - rect.top;
            const R = Math.min(rect.right, Math.round(Number(selB.right))) - rect.left, Bt = Math.min(rect.bottom, Math.round(Number(selB.bottom))) - rect.top;
            if (R > L && Bt > T && (rr < 0 || Math.abs(l - L) > 2 || Math.abs(t - T) > 2 || Math.abs(rr + 1 - R) > 2 || Math.abs(bb + 1 - Bt) > 2))
              throw new Error("the selection read back at " + [l, t, rr + 1, bb + 1].join(",") + ", Photoshop has " + [L, T, R, Bt].join(","));
          }
          out = a;
        } finally { try { img.dispose(); } catch (_) {} }
      }, { commandName: "KBImage — read " + CH });
    } catch (e) {
      if (psMaskSelRoute !== "ok") psMaskSelRoute = "no";
      traceErr("ps mask route selection", e);
      return null;
    }
    psMaskSelRoute = "ok";
    return out;
  }
  async function psReadMaskAlpha(rect, chName) {
    const CH = chName || PS_GARMENT_CH;   // KBPS piping too (Blend If values)
    const sel = await psReadMaskBySelection(rect, CH);
    if (sel) {
      let lo = 0, hi = 0;
      for (let k = 0; k < sel.length; k++) { if (sel[k] < 128) lo++; else hi++; }
      trace("ps: mask " + CH + " via selection — inside " + hi + " px, outside " + lo + " px");
      if (hi > 0 && lo > 0) return sel;
    }
    return kbKeepView(async function () { return psReadMaskAlphaLayers(rect, CH); });
  }
  async function psReadMaskAlphaLayers(rect, CH) {
    const ps = psMod();
    const routes = ["apply-mask", "fill-selection"];
    for (let ri = 0; ri < routes.length; ri++) {
      const route = routes[ri];
      let tmpId = null, g = null;
      try {
        await ps.core.executeAsModal(async function () {
          const doc = ps.app.activeDocument;
          try { await deselectAll(); } catch (_) {}
          try { const top = doc.layers && doc.layers[0]; if (top) await kbSelectLayerById(top.id); } catch (_) {}
          try { await selectRGBChannel(); } catch (_) {}
          await ps.action.batchPlay(
            [{ _obj: "make", _target: [{ _ref: "layer" }], using: { _obj: "layer", name: PS_TMP_LAYER },
               _options: { dialogOptions: "dontDisplay" } }],
            { synchronousExecution: true });
          tmpId = kbActiveLayerId();
          if (route === "apply-mask") {
            await kbFillActiveLayer([255, 255, 255]);
            await kbLoadChannel(CH);
            await kbSelectLayerById(tmpId);
            await addLayerMaskRevealSelection();
            try { await deselectAll(); } catch (_) {}
            await kbDeleteMaskInModal(tmpId, true);
          } else {
            await kbLoadChannel(CH);
            await kbSelectLayerById(tmpId);
            await kbFillActiveLayer([255, 255, 255]);       // fills through the live selection
            try { await deselectAll(); } catch (_) {}
          }
          g = await kbReadGarmentLuma(tmpId, rect);
        }, { commandName: "KBImage — read garment mask" });
      } catch (e) {
        traceErr("ps mask route " + route, e);
        g = null;
      } finally {
        if (tmpId != null) { try { await deleteLayersById([tmpId]); } catch (_) {} }
      }
      if (!g) continue;
      let lo = 0, hi = 0;
      for (let k = 0; k < g.alpha.length; k++) { if (g.alpha[k] < 128) lo++; else hi++; }
      trace("ps: mask via " + route + " — inside " + hi + " px, outside " + lo + " px");
      if (hi > 0 && lo > 0) return g.alpha;           // a real mask (inside and outside both present)
    }
    throw new Error("could not read the garment mask's pixels.");
  }

  // Pixel math (pure): neutralise inside the mask, then shift the median to the
  // target evenly. rgba: Uint8Array (w×h×4, opaque). mask: Uint8Array (w×h).
  function psCorrectGray(rgba, mask, n, target) {
    const hist = new Uint32Array(256);
    let cnt = 0;
    const lum = new Uint8Array(n);
    for (let k = 0, o = 0; k < n; k++, o += 4) {
      const l = (rgba[o] * 77 + rgba[o + 1] * 150 + rgba[o + 2] * 29) >> 8;
      lum[k] = l;
      if (mask[k] > 127) { hist[l]++; cnt++; }
    }
    if (!cnt) return { median: null, shift: 0, inside: 0 };
    let median = 0, acc = 0;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= cnt / 2) { median = v; break; } }
    const shift = target - median;
    for (let k = 0, o = 0; k < n; k++, o += 4) {
      if (mask[k] === 0) continue;                    // outside: left as is (masked off anyway)
      let v = lum[k] + shift;
      if (v < 0) v = 0; if (v > 255) v = 255;
      // Soft mask edge: blend toward the corrected value by coverage.
      const a = mask[k] / 255;
      rgba[o]     = Math.round(rgba[o] * (1 - a) + v * a);
      rgba[o + 1] = Math.round(rgba[o + 1] * (1 - a) + v * a);
      rgba[o + 2] = Math.round(rgba[o + 2] * (1 - a) + v * a);
      rgba[o + 3] = 255;
    }
    return { median: median, shift: shift, inside: cnt };
  }

  // ----- Compressed PNG with alpha (Remove print cut-out) ----------------------
  // The cut-out must keep its transparency, so it cannot go as JPEG, and a stored
  // (uncompressed) PNG of a full-resolution crop is too large to send.
  // This is a small, plain deflate (LZ77 + dynamic Huffman, RFC 1951) and a PNG
  // writer with per-row filters. Pure JS, no libraries.
  const PS_DEF_LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const PS_DEF_LEXT  = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const PS_DEF_DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const PS_DEF_DEXT  = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  const PS_DEF_CLORD = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

  // Huffman code lengths (≤ maxLen) for the given frequencies.
  function psHuffLengths(freq, maxLen) {
    const n = freq.length;
    const f = Array.from(freq);
    let used = 0; for (let i = 0; i < n; i++) if (f[i]) used++;
    if (used < 2) { for (let i = 0; i < n && used < 2; i++) if (!f[i]) { f[i] = 1; used++; } }
    for (;;) {
      const nodes = [];
      for (let i = 0; i < n; i++) if (f[i]) nodes.push({ w: f[i], sym: i, l: null, r: null });
      nodes.sort(function (a, b) { return a.w - b.w; });
      // Two-queue Huffman build.
      const q2 = []; let i1 = 0, i2 = 0;
      const take = function () {
        if (i1 < nodes.length && (i2 >= q2.length || nodes[i1].w <= q2[i2].w)) return nodes[i1++];
        return q2[i2++];
      };
      while ((nodes.length - i1) + (q2.length - i2) > 1) { const a = take(), b = take(); q2.push({ w: a.w + b.w, sym: -1, l: a, r: b }); }
      const root = take();
      const len = new Uint8Array(n);
      let maxSeen = 0;
      const stack = [[root, 0]];
      while (stack.length) {
        const it = stack.pop(), nd = it[0], d = it[1];
        if (nd.sym >= 0) { len[nd.sym] = Math.max(1, d); if (d > maxSeen) maxSeen = d; }
        else { stack.push([nd.l, d + 1]); stack.push([nd.r, d + 1]); }
      }
      if (maxSeen <= maxLen) return len;
      for (let i = 0; i < n; i++) if (f[i]) f[i] = (f[i] >> 1) | 1;   // flatten and retry
    }
  }
  // Canonical codes for the lengths, bit-reversed for LSB-first writing.
  function psHuffCodes(len) {
    const maxL = Math.max.apply(null, Array.from(len));
    const blCount = new Uint16Array(maxL + 1);
    for (let i = 0; i < len.length; i++) if (len[i]) blCount[len[i]]++;
    const next = new Uint16Array(maxL + 2);
    let code = 0;
    for (let b = 1; b <= maxL; b++) { code = (code + blCount[b - 1]) << 1; next[b] = code; }
    const out = new Uint16Array(len.length);
    for (let i = 0; i < len.length; i++) {
      const L = len[i]; if (!L) continue;
      let c = next[L]++, r = 0;
      for (let k = 0; k < L; k++) { r = (r << 1) | (c & 1); c >>= 1; }
      out[i] = r;
    }
    return out;
  }

  // zlib stream (deflate, dynamic Huffman blocks) of `data` (Uint8Array).
  function psZlibDeflate(data) {
    const n = data.length;
    let out = new Uint8Array(Math.max(1024, (n >> 1) + 1024)), op = 0, bitBuf = 0, bitCnt = 0;
    const grow = function (need) { if (op + need <= out.length) return; const o2 = new Uint8Array(Math.max(out.length * 2, op + need + 1024)); o2.set(out.subarray(0, op)); out = o2; };
    const bits = function (v, cnt) {
      bitBuf |= v << bitCnt; bitCnt += cnt;
      while (bitCnt >= 8) { grow(1); out[op++] = bitBuf & 0xFF; bitBuf >>>= 8; bitCnt -= 8; }
    };
    out[op++] = 0x78; out[op++] = 0x9C;
    const lenSym = new Uint16Array(259), distOf = function (d) { let c = 29; while (PS_DEF_DBASE[c] > d) c--; return c; };
    for (let L = 3; L <= 258; L++) { let c = 28; while (PS_DEF_LBASE[c] > L) c--; lenSym[L] = c; }
    const WS = 32768, WM = WS - 1, HS = 1 << 15, HM = HS - 1, CHAIN = 24;
    const head = new Int32Array(HS).fill(-1), prev = new Int32Array(WS);
    const hashAt = function (i) { return ((data[i] << 10) ^ (data[i + 1] << 5) ^ data[i + 2]) & HM; };
    const insert = function (i) { if (i + 2 < n) { const h = hashAt(i); prev[i & WM] = head[h]; head[h] = i; } };
    const BLOCK = 1 << 16;
    const sLit = new Uint16Array(BLOCK), sDist = new Uint16Array(BLOCK);   // dist 0 = literal
    let i = 0;
    while (i < n || i === 0) {
      let ns = 0;
      while (i < n && ns < BLOCK) {
        let bestLen = 0, bestDist = 0;
        if (i + 2 < n) {
          let cand = head[hashAt(i)], chain = CHAIN;
          const maxL = Math.min(258, n - i);
          while (cand >= 0 && i - cand <= WS && chain-- > 0) {
            if (data[cand + bestLen] === data[i + bestLen]) {
              let L = 0; while (L < maxL && data[cand + L] === data[i + L]) L++;
              if (L > bestLen) { bestLen = L; bestDist = i - cand; if (L === maxL) break; }
            }
            const pc = prev[cand & WM];
            if (pc >= cand) break;
            cand = pc;
          }
        }
        if (bestLen >= 3) {
          sLit[ns] = bestLen; sDist[ns] = bestDist; ns++;
          for (let k = 0; k < bestLen; k++) insert(i + k);
          i += bestLen;
        } else {
          sLit[ns] = data[i]; sDist[ns] = 0; ns++;
          insert(i); i++;
        }
      }
      const last = i >= n;
      // Frequencies → trees.
      const lf = new Uint32Array(286), df = new Uint32Array(30);
      for (let s = 0; s < ns; s++) {
        if (sDist[s]) { lf[257 + lenSym[sLit[s]]]++; df[distOf(sDist[s])]++; } else lf[sLit[s]]++;
      }
      lf[256]++;
      const ll = psHuffLengths(lf, 15), dl = psHuffLengths(df, 15);
      const lc = psHuffCodes(ll), dc = psHuffCodes(dl);
      let nl = 286; while (nl > 257 && !ll[nl - 1]) nl--;
      let nd = 30; while (nd > 1 && !dl[nd - 1]) nd--;
      // Code-length sequence with run codes 16 / 17 / 18.
      const seq = Array.from(ll.subarray(0, nl)).concat(Array.from(dl.subarray(0, nd)));
      const cl = [], cx = [];
      for (let k = 0; k < seq.length;) {
        const v = seq[k]; let r = 1; while (k + r < seq.length && seq[k + r] === v) r++;
        if (v === 0 && r >= 3) { const t = Math.min(r, 138); if (t >= 11) { cl.push(18); cx.push(t - 11); } else { cl.push(17); cx.push(t - 3); } k += t; }
        else if (v !== 0 && r >= 4) { cl.push(v); cx.push(0); const t = Math.min(r - 1, 6); cl.push(16); cx.push(t - 3); k += t + 1; }
        else { cl.push(v); cx.push(0); k++; }
      }
      const cf = new Uint32Array(19); for (let k = 0; k < cl.length; k++) cf[cl[k]]++;
      const cll = psHuffLengths(cf, 7), clc = psHuffCodes(cll);
      let nc = 19; while (nc > 4 && !cll[PS_DEF_CLORD[nc - 1]]) nc--;
      bits(last ? 1 : 0, 1); bits(2, 2);
      bits(nl - 257, 5); bits(nd - 1, 5); bits(nc - 4, 4);
      for (let k = 0; k < nc; k++) bits(cll[PS_DEF_CLORD[k]], 3);
      for (let k = 0; k < cl.length; k++) {
        bits(clc[cl[k]], cll[cl[k]]);
        if (cl[k] === 16) bits(cx[k], 2); else if (cl[k] === 17) bits(cx[k], 3); else if (cl[k] === 18) bits(cx[k], 7);
      }
      for (let s = 0; s < ns; s++) {
        if (sDist[s]) {
          const L = sLit[s], c = lenSym[L], sym = 257 + c;
          bits(lc[sym], ll[sym]);
          if (PS_DEF_LEXT[c]) bits(L - PS_DEF_LBASE[c], PS_DEF_LEXT[c]);
          const D = sDist[s], d = distOf(D);
          bits(dc[d], dl[d]);
          if (PS_DEF_DEXT[d]) bits(D - PS_DEF_DBASE[d], PS_DEF_DEXT[d]);
        } else bits(lc[sLit[s]], ll[sLit[s]]);
      }
      bits(lc[256], ll[256]);
      if (last) break;
    }
    if (bitCnt > 0) { grow(1); out[op++] = bitBuf & 0xFF; bitBuf = 0; bitCnt = 0; }
    const a = adler32(data);
    grow(4); out[op++] = (a >>> 24) & 0xFF; out[op++] = (a >>> 16) & 0xFF; out[op++] = (a >>> 8) & 0xFF; out[op++] = a & 0xFF;
    return out.subarray(0, op);
  }

  // RGBA (w × h × 4) → compressed PNG bytes (color type 6, per-row filter
  // chosen by the smallest sum of residuals).
  function psPngRgba(rgba, w, h) {
    const stride = w * 4, raw = new Uint8Array((stride + 1) * h);
    const cand = [new Uint8Array(stride), new Uint8Array(stride), new Uint8Array(stride), new Uint8Array(stride), new Uint8Array(stride)];
    for (let y = 0; y < h; y++) {
      const r0 = y * stride, p0 = r0 - stride;
      let best = 0, bestSum = Infinity;
      for (let f = 0; f < 5; f++) {
        const c = cand[f]; let sum = 0;
        for (let x = 0; x < stride; x++) {
          const v = rgba[r0 + x], a = x >= 4 ? rgba[r0 + x - 4] : 0, b = y ? rgba[p0 + x] : 0, cc = (y && x >= 4) ? rgba[p0 + x - 4] : 0;
          let pr;
          if (f === 0) pr = 0; else if (f === 1) pr = a; else if (f === 2) pr = b; else if (f === 3) pr = (a + b) >> 1;
          else { const p = a + b - cc, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - cc); pr = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : cc); }
          const r = (v - pr) & 0xFF; c[x] = r; sum += r < 128 ? r : 256 - r;
        }
        if (sum < bestSum) { bestSum = sum; best = f; }
      }
      raw[y * (stride + 1)] = best;
      raw.set(cand[best], y * (stride + 1) + 1);
    }
    const ihdr = new Uint8Array(13);
    ihdr.set(be32(w), 0); ihdr.set(be32(h), 4);
    ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    const chunks = [new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
      pngChunk("IHDR", ihdr), pngChunk("IDAT", psZlibDeflate(raw)), pngChunk("IEND", new Uint8Array(0))];
    let total = 0; for (let k = 0; k < chunks.length; k++) total += chunks[k].length;
    const outp = new Uint8Array(total); let pos = 0;
    for (let k = 0; k < chunks.length; k++) { outp.set(chunks[k], pos); pos += chunks[k].length; }
    return outp;
  }

  // ----- step 3 REMOVE OLD PRINT (optional) ------------------------------------
  // Nano Banana Pro removes the old print BEFORE the gray (the team's order). The
  // garment crop goes at FULL resolution, padded (edge pixels repeated) to the
  // nearest ratio the model supports; the result is trimmed back to the exact
  // crop so it lines up with the mask. No reference image. Output: "CLEAN",
  // masked to KBPS garment, Accept / Re-run. Make gray then reads CLEAN.
  const PS_CLEAN_NAME  = "CLEAN";
  const PS_CLEAN_MODEL = "gemini-3-pro-image-preview";    // Nano Banana Pro
  const PS_CLEAN_SIZE  = "2K";
  const PS_AI_MAX_B64  = 14 * 1024 * 1024;               // request size cap; larger images are uploaded to Fal first
  const PS_NBP_MAX_PX  = 4096 * 4096;                    // Nano Banana Pro's largest output (4K, ~16 MP)
  let psCleanArmUntil = 0;

  // The team's base text (do not reword), then the garment type's Protected
  // trims, so the model keeps lace, buttons, etc. as they are.
  const PS_CLEAN_BASE = "remove the print from the clothing, from the fabric, make light grey, keep constructions, detail, shadow, fabric details exactly as is,";
  function psJoinWords(a) {
    if (a.length < 2) return a.join("");
    if (a.length === 2) return a[0] + " and " + a[1];
    return a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
  }
  function psCleanPrompt(t) {
    const g = psTargetHex(), target = " (target grey " + (g ? g.hex : PS_GRAY_DEFAULT) + ")";
    if (!t || !t.trims || !t.trims.length) return PS_CLEAN_BASE + target;
    return PS_CLEAN_BASE + " do not remove or change the " + psJoinWords(t.trims.map(function (s) { return String(s).toLowerCase(); }))
      + ", keep their original color and shape" + target;
  }
  function psCleanCostText() {
    return "Nano Banana Pro · $" + perImageCost(PS_CLEAN_MODEL, PS_CLEAN_SIZE).toFixed(2) + "–$" + perImageCost(PS_CLEAN_MODEL, "4K").toFixed(2);
  }
  function psCleanLayers() { return kbFindLayers(PS_CLEAN_NAME).filter(function (l) { return String(l.name) === PS_CLEAN_NAME; }); }
  function psCleanPending() {
    if (!pendingRecall || !pendingRecall.descriptor || String(pendingRecall.descriptor.op) !== "printswap:clean") return null;
    return pendingRecall;
  }
  // The accepted CLEAN layer (exists and is not a preview still waiting), else null.
  function psAcceptedCleanId() {
    const pend = psCleanPending();
    const ids = pend ? (pend.layerIds || []) : [];
    const l = psCleanLayers().filter(function (x) { return ids.indexOf(x.id) < 0; });
    return l.length ? l[0].id : null;
  }

  // Nearest supported ratio to w×h (log distance) and the padded size holding w×h,
  // centred, padded to the model's REAL output shape for that ratio (res = the
  // output resolution; Nano Banana's 9:16 is 1536 x 2752), so the result comes back
  // the same shape as what was sent and the padding trims off exactly.
  function psPadPlan(modelId, w, h, res) {
    const labels = ((MODELS[modelId] || {}).aspectRatios || []).filter(function (l) { return l !== MATCH_INPUT; });
    const c = w / h;
    let best = "1:1", bestV = 1, bestD = Infinity;
    for (let i = 0; i < labels.length; i++) {
      const p = parseAspectLabel(labels[i]); if (!p) continue;
      const d = Math.abs(Math.log(p.v / c));
      if (d < bestD) { bestD = d; best = labels[i]; bestV = p.v; }
    }
    const od = plRatioOutputDims(modelId, best, res);
    const v = (od && od.w > 0 && od.h > 0) ? od.w / od.h : bestV;
    let PW = w, PH = h;
    if (v >= c) PW = Math.max(w, Math.ceil(h * v)); else PH = Math.max(h, Math.ceil(w / v));
    return { ratio: best, PW: PW, PH: PH, ox: Math.floor((PW - w) / 2), oy: Math.floor((PH - h) / 2) };
  }

  async function executePsClean(params) {
    const ps = psMod();
    const doc = ps.app.activeDocument;
    if (!doc) throw new Error("Open a Photoshop document first.");
    if (!cachedFalKey) throw new Error("add your Fal key in Settings (gear icon) to remove the old print.");
    const docW = Math.round(doc.width), docH = Math.round(doc.height);
    let step = "reading the garment";
    try {
      // 1) The crop: the garment's own pixels in KBPS garment (coverage > 16 of 255)
      //    plus a small margin, inside the photo layer. (Selection bounds of the
      //    channel can span the whole canvas, so the mask pixels are measured.)
      const photoId = (psPhotoLayerId != null && kbLayerById(psPhotoLayerId)) ? psPhotoLayerId : psPickPhotoLayer();
      const photo = kbLayerById(photoId);
      let area = { left: 0, top: 0, right: docW, bottom: docH };
      if (photo) {
        const lb = photo.bounds;
        area = { left: Math.max(0, Math.floor(Number(lb.left))), top: Math.max(0, Math.floor(Number(lb.top))),
                 right: Math.min(docW, Math.ceil(Number(lb.right))), bottom: Math.min(docH, Math.ceil(Number(lb.bottom))) };
      }
      const aw = area.right - area.left, ah = area.bottom - area.top;
      if (!(aw > 0 && ah > 0)) throw new Error("the photo layer has no pixels.");
      const areaAlpha = await psReadMaskAlpha(area);
      let bl = aw, bt = ah, br = -1, bb = -1;
      for (let y = 0; y < ah; y++) { const o = y * aw; for (let x = 0; x < aw; x++) if (areaAlpha[o + x] > 16) { if (x < bl) bl = x; if (x > br) br = x; if (y < bt) bt = y; if (y > bb) bb = y; } }
      if (br < 0) throw new Error("the garment channel is empty. Click Find garment first.");
      const margin = Math.max(8, Math.round(Math.max(br - bl + 1, bb - bt + 1) * 0.02));
      // plus the edge bleed on each side, inside the photo and canvas.
      const psBleed = clampSelBleed(cachedSelBleed);
      const rect = { left: area.left + Math.max(0, bl - margin - psBleed), top: area.top + Math.max(0, bt - margin - psBleed),
                     right: area.left + Math.min(aw, br + 1 + margin + psBleed), bottom: area.top + Math.min(ah, bb + 1 + margin + psBleed) };
      const rw = rect.right - rect.left, rh = rect.bottom - rect.top;
      const cutAlpha = new Uint8Array(rw * rh);
      for (let y = 0; y < rh; y++) cutAlpha.set(areaAlpha.subarray((rect.top - area.top + y) * aw + (rect.left - area.left), (rect.top - area.top + y) * aw + (rect.left - area.left) + rw), y * rw);
      trace("ps clean: garment box " + JSON.stringify(rect) + " (" + rw + "x" + rh + ", margin " + margin + ") in photo area " + aw + "x" + ah);

      // 2) The garment CUT OUT by KBPS garment on transparency (no person, no
      //    background), padded with transparency to a supported ratio → PNG with
      //    alpha. Full resolution unless the padded image is over Nano Banana
      //    Pro's largest (4K, about 4096 × 4096 px) or the request size limit:
      //    then scaled down (aspect kept) until it fits.
      step = "reading the garment area";
      setStatus("busy", "Reading the garment area…");
      const hide = psOwnLayers().concat(psCleanLayers()).concat(psPartsHideables());   // the part groups, never PS, PB or SDW
      const plan0 = psPadPlan(params.model, rw, rh, params.imageSize);
      let scale = Math.min(1, Math.sqrt(PS_NBP_MAX_PX / (plan0.PW * plan0.PH)));
      let src = null, plan = null, cw = 0, ch = 0;
      for (let attempt = 0; attempt < 5 && !src; attempt++) {
        const maxEdge = scale >= 1 ? Infinity : Math.max(1, Math.floor(Math.max(rw, rh) * scale));
        let full = null;
        await ps.core.executeAsModal(async function () {
          const was = hide.map(function (l) { try { return l.visible; } catch (_) { return true; } });
          for (let i = 0; i < hide.length; i++) { try { hide[i].visible = false; } catch (_) {} }
          try { full = await psReadCompositePixels(rect, maxEdge); }
          finally { for (let i = 0; i < hide.length; i++) { try { hide[i].visible = was[i]; } catch (_) {} } }
        }, { commandName: "KBImage — read photo for print removal" });
        step = "cutting out and encoding the garment";
        cw = full.width; ch = full.height;
        const al = (cw === rw && ch === rh) ? cutAlpha : kbResamplePlane(cutAlpha, rw, rh, cw, ch);
        plan = psPadPlan(params.model, cw, ch, params.imageSize);
        const PW = plan.PW, PH = plan.PH, c = full.components, rgba = new Uint8Array(PW * PH * 4);
        for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
          const k = y * cw + x, a = al[k];
          if (!a) continue;
          const sp = k * c, o = ((y + plan.oy) * PW + x + plan.ox) * 4;
          rgba[o] = full.data[sp]; rgba[o + 1] = full.data[c >= 3 ? sp + 1 : sp]; rgba[o + 2] = full.data[c >= 3 ? sp + 2 : sp]; rgba[o + 3] = a;
        }
        full = null;
        const png = psPngRgba(rgba, PW, PH);
        const b64 = bytesToBase64(png.buffer.byteLength === png.length ? png.buffer : png.slice().buffer);
        trace("ps clean: try " + (attempt + 1) + " — sent size " + PW + "x" + PH + " (crop " + cw + "x" + ch + ", scale " + (cw / rw).toFixed(3) + "), PNG " + (png.length / 1048576).toFixed(1) + " MB");
        if (b64.length <= PS_AI_MAX_B64) { src = { base64: b64, mime: "image/png", route: "cut-out PNG with alpha" }; break; }
        scale = (cw / rw) * Math.sqrt(PS_AI_MAX_B64 / b64.length) * 0.95;           // over the request limit: smaller
      }
      if (!src) throw new Error("the cut-out garment is still too large to send after scaling down.");
      const sentArea = plan.PW * plan.PH;
      params.imageSize = sentArea > 2048 * 2048 ? "4K" : (sentArea > 1024 * 1024 ? "2K" : "1K");   // matching output size
      params.aspectRatio = plan.ratio;
      params.sentW = plan.PW; params.sentH = plan.PH; params.cropW = rw; params.cropH = rh;
      trace("ps clean: crop " + rw + "x" + rh + " → sent " + cw + "x" + ch + " padded " + plan.PW + "x" + plan.PH + " (" + plan.ratio + ", offset " + plan.ox + "," + plan.oy + "), "
        + Math.round(src.base64.length * 0.75 / 1024) + " KB, output " + params.imageSize + ", photo layer " + photoId);

      // 3) Nano Banana Pro: remove the print. No reference image.
      step = "asking Nano Banana Pro to remove the print";
      setStatus("busy", "Nano Banana Pro: removing the old print…");
      if (!params.prompt) params.prompt = psCleanPrompt(psGtypeById(params.gtype));
      trace("ps clean: garment type " + (params.gtype || "none") + ", prompt sent → " + params.prompt);
      const img = await generateImageNanoBanana(cachedFalKey, {   // Nano Banana Pro on Fal
        modelId: params.model, prompt: params.prompt,
        sourceImage: { base64: src.base64, mime: src.mime },
        sourceWidth: plan.PW, sourceHeight: plan.PH,
        aspectRatio: plan.ratio, imageSize: params.imageSize,
      });
      params.costUsd = perImageCost(params.model, params.imageSize);
      try { addSessionCost(params.costUsd); } catch (_) {}
      if (!img || !img.base64) throw new Error("Nano Banana returned no image.");

      // 4) CLEAN: the result covers the padded frame with one scale, is cut to the garment
      //    box (+ bleed) and bounds-checked, just above the photo, masked to the garment.
      //    No mask → no CLEAN (the layer is removed).
      step = "placing the CLEAN layer";
      setStatus("busy", "Placing CLEAN…");
      const rf = await plResultFile(img.base64, "printswap-clean-");
      const frame = plFrameFromPad(rect, cw, ch, plan);
      trace("ps clean: result covers frame " + JSON.stringify(frame) + " → cut to " + JSON.stringify(rect) + " (" + rw + "x" + rh + ")");
      let cleanId = null;
      try {
        await ps.core.executeAsModal(async function () {
          try { await deselectAll(); } catch (_) {}
          const base = psStackBaseId(photoId);                 // above BG LIGHTEN when there is one
          if (base != null) await kbSelectLayerById(base);
          try { await selectRGBChannel(); } catch (_) {}
          cleanId = await plPlaceInModal(rf, PS_CLEAN_NAME, { frame: frame, target: rect, bleed: 0, what: "Print Swap CLEAN", keepSelection: false });
          step = "masking CLEAN to the garment";
          try {
            await kbLoadChannel(PS_GARMENT_CH);
            await kbSelectLayerById(cleanId);
            await addLayerMaskRevealSelection();
          } catch (e) {
            try { await plDeleteLayerInModal(cleanId); } catch (_) {}
            cleanId = null;
            throw e;
          }
          try { await deselectAll(); } catch (_) {}
          try { await selectRGBChannel(); } catch (_) {}
        }, { commandName: "KBImage — CLEAN" });
      } finally { await kbDeleteFile(rf); }
      return { layerIds: [cleanId], afterSnapshotRef: null, state: { cleanId: cleanId } };
    } catch (err) {
      const e2 = new Error("Remove old print failed while " + step + ": " + ((err && err.message) || String(err)));
      e2.cause = err;
      throw e2;
    }
  }

  async function actPsRemovePrint() {
    if (generateInFlight) { kbBusyNote(); return; }
    const ps = psMod();
    if (!ps.app.activeDocument) { setStatus("bad", "Open a Photoshop document first."); return; }
    if (!kbChannelExists(PS_GARMENT_CH)) { setStatus("bad", "Find the garment first."); return; }
    try { psGtypeFollowDoc(); } catch (_) {}
    const gt = psGtypeById(psGarmentType);
    if (!gt) { setStatus("bad", "Pick the garment type in step 2 first. The prompt names its trims so they are kept."); return; }
    if (!cachedFalKey) { setStatus("bad", "Add your Fal key in Settings (gear icon) to remove the old print."); return; }
    if (pendingRecall && pendingRecall.descriptor && String(pendingRecall.descriptor.op).indexOf("printswap:") === 0 && !psCleanPending()) {
      setStatus("bad", "Accept or Re-run the preview that is waiting first."); return;
    }
    // An accepted CLEAN is replaced only on a second click.
    const oldId = psAcceptedCleanId();
    if (oldId != null) {
      if (Date.now() > psCleanArmUntil) {
        psCleanArmUntil = Date.now() + 5000;
        setStatus("bad", "This replaces the accepted CLEAN layer. Click Remove old print again within 5 seconds to go ahead.");
        return;
      }
      psCleanArmUntil = 0;
      try { await deleteLayersById([oldId]); } catch (_) {}
    }
    const params = function () { const t = psGtypeById(psGarmentType); return { model: PS_CLEAN_MODEL, imageSize: PS_CLEAN_SIZE, gtype: t ? t.id : null, prompt: psCleanPrompt(t) }; };
    const p = params();
    const btn = $("ps-clean-btn");
    if (btn) btn.classList.add("disabled");
    traceStart("Print Swap — Remove old print (" + PS_CLEAN_MODEL + ")");
    generateInFlight = true;
    try {
      await psRecall(3, "ps-recall-anchor-3", {
        op: "printswap:clean", params: p, targetLayerId: psPhotoLayerId,
        sourceRef: "garment:" + PS_GARMENT_CH, paramsProvider: params, execute: executePsClean,
      });
      setStatus("ok", "CLEAN preview ready. Sent " + p.sentW + "×" + p.sentH + " (" + p.imageSize + ") for a " + p.cropW + "×" + p.cropH
        + " garment crop. Check edges, " + psJoinWords(gt.trims.map(function (s) { return String(s).toLowerCase(); }).concat(["folds"])) + " at 100%. Accept to keep it, or Re-run.");
    } catch (err) {
      traceErr("ps clean", err && err.cause ? err.cause : err);
      try { console.error(TAG, "remove old print failed:", err); } catch (_) {}
      setStatus("bad", (err && err.message) || "Remove old print failed.");
    } finally {
      generateInFlight = false;
      if (btn) btn.classList.remove("disabled");
      try { psRefreshUi(); updateDocInfo(); } catch (_) {}
      await traceFlush();
    }
  }

  // ----- step 5 GRAY (Exact) -----------------------------------------------------
  // No AI: the garment area as seen, neutralised + median shifted to the target.
  // Output "GREY exact", masked to the garment, recall-wrapped. Free.
  const PS_EXACT_LAYER    = "GREY exact";
  const PS_EXACT_MAX_EDGE = 4096;         // Exact keeps full detail (up to the texture cap)

  // Every plug-in layer that must not be in the picture a gray method reads.
  function psOwnLayers() {
    return kbFindLayers(PS_GREY_NAME).filter(function (l) {
      const n = String(l.name); return n === PS_GREY_NAME || n.indexOf(PS_GREY_NAME + " ") === 0;
    });
  }
  // Inside executeAsModal: run fn with those layers hidden, then restore them.
  async function psWithOwnLayersHidden(fn) {
    const own = psOwnLayers();
    const was = own.map(function (l) { try { return l.visible; } catch (_) { return true; } });
    for (let i = 0; i < own.length; i++) { try { own[i].visible = false; } catch (_) {} }
    try { return await fn(); }
    finally { for (let i = 0; i < own.length; i++) { try { own[i].visible = was[i]; } catch (_) {} } }
  }

  // Inside executeAsModal: the COMPOSITE over rect as raw pixels, long edge ≤ maxEdge
  // (composite reads with targetSize are proven; single-layer ones are not).
  async function psReadCompositePixels(rect, maxEdge) {
    const ps = psMod();
    const doc = ps.app.activeDocument;
    const rw = rect.right - rect.left, rh = rect.bottom - rect.top;
    const opts = { documentID: doc.id, sourceBounds: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
                   applyAlpha: true, componentSize: 8 };
    const longEdge = Math.max(rw, rh);
    if (longEdge > maxEdge) { const s = maxEdge / longEdge; opts.targetSize = { width: Math.max(1, Math.round(rw * s)), height: Math.max(1, Math.round(rh * s)) }; }
    const pr = await ps.imaging.getPixels(opts);
    if (!pr || !pr.imageData) throw new Error("imaging.getPixels returned no imageData.");
    const img = pr.imageData;
    try {
      const data = await img.getData({ chunky: true });
      return { data: data, width: img.width, height: img.height, components: img.components || Math.round(data.length / (img.width * img.height)) };
    } finally { try { img.dispose(); } catch (_) {} }
  }

  // Chunky pixels (any component count) → opaque RGBA, optionally resized to (W × H).
  function psToRgba(px, W, H) {
    const w = px.width, h = px.height, c = px.components, n = w * h;
    const R = new Uint8Array(n), G = new Uint8Array(n), B = new Uint8Array(n);
    for (let k = 0, p = 0; k < n; k++, p += c) { R[k] = px.data[p]; G[k] = px.data[c >= 3 ? p + 1 : p]; B[k] = px.data[c >= 3 ? p + 2 : p]; }
    const tw = W || w, th = H || h;
    const r = (tw === w && th === h) ? R : kbResamplePlane(R, w, h, tw, th);
    const g = (tw === w && th === h) ? G : kbResamplePlane(G, w, h, tw, th);
    const b = (tw === w && th === h) ? B : kbResamplePlane(B, w, h, tw, th);
    const out = new Uint8Array(tw * th * 4);
    for (let k = 0, o = 0; k < tw * th; k++, o += 4) { out[o] = r[k]; out[o + 1] = g[k]; out[o + 2] = b[k]; out[o + 3] = 255; }
    return { rgba: out, w: tw, h: th };
  }

  // ----- MAKE GRAY ----------------------------------------------------------------
  function psGrayParams() {
    const t = psTargetHex();
    return { method: "exact", targetHex: t ? t.hex : null };
  }

  async function executePsGray(params) {
    const ps = psMod();
    const doc = ps.app.activeDocument;
    if (!doc) throw new Error("Open a Photoshop document first.");
    const method = "exact";
    const layerName = PS_EXACT_LAYER;
    const t = kbParseHex(params.targetHex);
    if (!t) throw new Error("Enter the target gray as a hex value, for example #BABABA.");
    const target = (t[0] * 77 + t[1] * 150 + t[2] * 29) >> 8;
    const docW = Math.round(doc.width), docH = Math.round(doc.height);
    let step = "reading the garment";
    try {
      // 1) The garment box (padded), kept inside the photo layer.
      let gb = null;
      await ps.core.executeAsModal(async function () {
        await kbLoadChannel(PS_GARMENT_CH);
        gb = kbSelectionBounds();
        try { await deselectAll(); } catch (_) {}
      }, { commandName: "KBImage — read garment" });
      if (!gb) throw new Error("the garment channel is empty. Click Find garment first.");
      const L0 = Number(gb.left), T0 = Number(gb.top), R0 = Number(gb.right), B0 = Number(gb.bottom);
      const pad = Math.round(Math.max(R0 - L0, B0 - T0) * 0.04);
      let rect = { left: Math.max(0, Math.floor(L0 - pad)), top: Math.max(0, Math.floor(T0 - pad)),
                   right: Math.min(docW, Math.ceil(R0 + pad)), bottom: Math.min(docH, Math.ceil(B0 + pad)) };
      const photoId = (psPhotoLayerId != null && kbLayerById(psPhotoLayerId)) ? psPhotoLayerId : psPickPhotoLayer();
      const photo = kbLayerById(photoId);
      if (photo) {
        const lb = photo.bounds;
        rect = { left: Math.max(rect.left, Math.floor(Number(lb.left))), top: Math.max(rect.top, Math.floor(Number(lb.top))),
                 right: Math.min(rect.right, Math.ceil(Number(lb.right))), bottom: Math.min(rect.bottom, Math.ceil(Number(lb.bottom))) };
      }
      const rw = rect.right - rect.left, rh = rect.bottom - rect.top;
      if (!(rw > 0 && rh > 0)) throw new Error("the garment is outside the photo layer.");
      // An accepted CLEAN (step 3) is what gets grayed (read with it shown), and GREY exact goes above it.
      // An older GREY exact (accepted): the new one goes right above it, in its place.
      const cleanId = psAcceptedCleanId();
      const olds = psGreyExactLayers().filter(function (l) { return !psIsPending(l.id); });
      const anchorId = olds.length ? olds[olds.length - 1].id : (cleanId != null ? cleanId : psStackBaseId(photoId));   // above BG LIGHTEN
      params.source = cleanId != null ? "CLEAN" : "photo";
      trace("ps gray [" + method + "]: target " + params.targetHex + " (luma " + target + "), photo layer " + photoId + ", source " + params.source + (cleanId != null ? " (" + cleanId + ")" : "") + ", area " + JSON.stringify(rect));

      // 2) The pixels to correct — the WHOLE area `rect`.
      let work = null;                              // { rgba, w, h }
      {
        step = "reading the garment area";
        setStatus("busy", "Exact gray: reading the garment area…");
        let px = null;
        await ps.core.executeAsModal(async function () {
          const cl = cleanId != null ? kbLayerById(cleanId) : null;
          let clWas = true; try { if (cl) { clWas = cl.visible; cl.visible = true; } } catch (_) {}
          try { px = await psWithOwnLayersHidden(function () { return psReadCompositePixels(rect, PS_EXACT_MAX_EDGE); }); }
          finally { try { if (cl) cl.visible = clWas; } catch (_) {} }
        }, { commandName: "KBImage — read garment area" });
        work = psToRgba(px);
      }

      // 3) Exact correction inside the garment mask.
      step = "reading the garment mask";
      const alphaDoc = await psReadMaskAlpha(rect);
      const mask = (work.w === rw && work.h === rh) ? alphaDoc : kbResamplePlane(alphaDoc, rw, rh, work.w, work.h);
      step = "correcting the gray";
      const fix = psCorrectGray(work.rgba, mask, work.w * work.h, target);
      trace("ps gray [" + method + "]: " + work.w + "x" + work.h + ", median " + fix.median + " → " + target + " (shift " + fix.shift + "), inside " + fix.inside + " px");
      if (!fix.inside) throw new Error("the garment mask is empty over the gray result.");

      // 4) Place over EXACTLY the area read, above the photo, masked to the garment.
      step = "placing the " + layerName + " layer";
      setStatus("busy", "Placing " + layerName + "…");
      const file = await kbRgbaToFile(work.rgba, work.w, work.h);
      let greyId = null;
      try {
        await ps.core.executeAsModal(async function () {
          try { await deselectAll(); } catch (_) {}
          if (anchorId != null) await kbSelectLayerById(anchorId);
          try { await selectRGBChannel(); } catch (_) {}
          greyId = await kbPlaceFileInModal(file, layerName, rect);
          step = "masking " + layerName + " to the garment";
          await kbLoadChannel(PS_GARMENT_CH);
          await kbSelectLayerById(greyId);
          await addLayerMaskRevealSelection();
          try { await deselectAll(); } catch (_) {}
          try { await selectRGBChannel(); } catch (_) {}
        }, { commandName: "KBImage — " + layerName });
      } finally {
        await kbDeleteFile(file);
      }
      params.medianBefore = fix.median;
      params.shift = fix.shift;
      return { layerIds: [greyId], afterSnapshotRef: null, state: { greyId: greyId, method: method, targetHex: psHex(t) } };
    } catch (err) {
      const e2 = new Error("Make gray (" + method + ") failed while " + step + ": " + ((err && err.message) || String(err)));
      e2.cause = err;
      throw e2;
    }
  }

  async function actPsMakeGray() {
    if (generateInFlight) { kbBusyNote(); return; }
    const ps = psMod();
    if (!ps.app.activeDocument) { setStatus("bad", "Open a Photoshop document first."); return; }
    if (psGrayNeedsUpdate()) { await actPsUpdateGray(); return; }
    if (!kbChannelExists(PS_GARMENT_CH)) { setStatus("bad", "Find the garment first."); return; }
    if (psCleanPending()) { setStatus("bad", "Accept or Re-run CLEAN first, so Make gray knows which layer to use."); return; }
    const p = psGrayParams();
    if (!p.targetHex) { setStatus("bad", "Enter the target gray as a hex value, for example #BABABA."); return; }
    const btn = $("ps-gray-btn");
    if (btn) btn.classList.add("disabled");
    traceStart("Print Swap — Make gray (" + p.method + ") " + p.targetHex);
    generateInFlight = true;
    try {
      await psRecall(5, "ps-recall-anchor-5", {
        op: "printswap:gray-" + p.method,
        params: p,
        targetLayerId: psPhotoLayerId,
        sourceRef: "garment:" + PS_GARMENT_CH + " target:" + p.targetHex + " method:" + p.method,
        paramsProvider: psGrayParams,
        execute: executePsGray,
        onSettle: async function (state, accepted) {
          if (!accepted) return null;
          try { await psGreyExactKeepOne(state && state.greyId); } catch (e) { traceErr("ps gray: delete the older " + PS_EXACT_LAYER, e); }   // replaced in place
          const hex = psTargetHex();
          psGrayDoc = { docId: psActiveDocId(), made: state && state.targetHex ? state.targetHex : (hex ? hex.hex : PS_GRAY_DEFAULT) };
          await psGraySaveDoc({ grayMade: psGrayDoc.made });
          psGrayFaceSync();
          return null;
        },
      });
      trace("ps gray: done");
      setStatus("ok", PS_EXACT_LAYER + " preview ready from " + (p.source === "CLEAN" ? "CLEAN" : "the photo") + " (median moved " + (p.medianBefore == null ? "?" : p.medianBefore) + " → " + p.targetHex
        + "). Accept to keep it, or Re-run.");
    } catch (err) {
      traceErr("ps gray", err && err.cause ? err.cause : err);
      try { console.error(TAG, "make gray failed:", err); } catch (_) {}
      setStatus("bad", (err && err.message) || "Make gray failed.");
    } finally {
      generateInFlight = false;
      try { psRefreshUi(); updateDocInfo(); } catch (_) {}
      await traceFlush();
    }
  }

  // UPDATE GRAY — step 5 done and the gray changed. No Accept bar: GREY exact is made
  // again with the new gray in the same place (the old one deleted), hidden again when
  // shading had hidden it. Step 8's GREY group and GREY copy 3 are copies of GREY exact,
  // so they are built again with the step 8 values (visibility kept). A MERGED from
  // Finish is redone in place. PARTS, prints and trims are not touched.
  async function actPsUpdateGray() {
    if (generateInFlight) { kbBusyNote(); return; }
    const ps = psMod();
    if (!kbChannelExists(PS_GARMENT_CH)) { setStatus("bad", "Find the garment first."); return; }
    if (pendingRecall && String(pendingRecall.descriptor && pendingRecall.descriptor.op).indexOf("printswap:") === 0) { setStatus("bad", "Accept or Discard the preview that is waiting first."); return; }
    const old = psGreyExactLayer();
    if (!old) { setStatus("bad", "There is no " + PS_EXACT_LAYER + " to update. Click Make gray."); return; }
    const p = psGrayParams();
    if (!p.targetHex) { setStatus("bad", "Enter the target gray as a hex value, for example #BABABA."); return; }
    const btn = $("ps-gray-btn");
    if (btn) btn.classList.add("disabled");
    generateInFlight = true;
    traceStart("Print Swap — Update gray " + psGrayMade() + " → " + p.targetHex);
    let step = "making " + PS_EXACT_LAYER;
    try {
      let oldVis = true; try { oldVis = old.visible; } catch (_) {}
      const r = await executePsGray(p);                                   // right above the old one, in its place
      const newId = r.layerIds[0];
      step = "replacing the old " + PS_EXACT_LAYER;
      await deleteLayersById([old.id]);
      await psGreyExactKeepOne(newId);                                    // any other GREY exact goes too
      await ps.core.executeAsModal(async function () { const n = kbLayerById(newId); if (n) { try { n.visible = oldVis; } catch (_) {} } }, { commandName: "KBImage — GREY exact" });
      let shadeMsg = "";
      const sg = psSdwGroup() || psTopLayerNamed(PS_SHADE_GROUP), sv = psTopLayerNamed(PS_VEIL_NAME);
      if (sg && psPartsGroup()) {
        step = "building the shading again";
        setStatus("busy", "Building the shading again with " + p.targetHex + "…");
        let gVis = true, vVis = true;
        try { gVis = sg.visible; } catch (_) {}
        try { if (sv) vVis = sv.visible; } catch (_) {}
        const sh = await executePsShade(psShadeParams());      // clears SDW and any old GREY group and veil first
        await ps.core.executeAsModal(async function () {
          const g = kbLayerById(sh.layerIds[0]), v = kbLayerById(sh.layerIds[1]);
          if (g) { try { g.visible = gVis; } catch (_) {} }
          if (v) { try { v.visible = vVis; } catch (_) {} }
        }, { commandName: "KBImage — shading visibility" });
        shadeMsg = " Shading (SDW) built again with it.";
      }
      let mm = null;
      if (!psMergedHeld && psMergedAccepted()) { step = "redoing MERGED"; mm = await psMergedRebuild(true); }
      psGrayDoc = { docId: psActiveDocId(), made: p.targetHex };
      await psGraySaveDoc({ grayMade: p.targetHex, gray: p.targetHex });
      const rec = logRecordSkeleton("printswap:gray-update", { targetHex: p.targetHex, medianBefore: p.medianBefore, shading: !!shadeMsg, merged: !!mm }, newId, "garment:" + PS_GARMENT_CH);
      await logRun(rec); await logFinalizeCommitted(rec.id);
      setStatus("ok", "Gray updated to " + p.targetHex + "." + shadeMsg + (mm ? " " + mm : "") + " Parts and prints kept.");
    } catch (err) {
      traceErr("ps update gray / " + step, err && err.cause ? err.cause : err);
      setStatus("bad", "Update gray failed while " + step + ": " + ((err && err.message) || String(err)));
    } finally {
      generateInFlight = false;
      if (btn) btn.classList.remove("disabled");
      try { psRefreshUi(); psStepsRefresh(); updateDocInfo(); } catch (_) {}
      await traceFlush();
    }
  }

  // =======================================================================
  // PRINT SWAP — step 6 PARTS.
  //
  //   FIND PARTS — Accept / Re-run. SAM 3.1 runs on the ORIGINAL photo (GREY /
  //     PARTS layers hidden while it reads) over the garment box, one call per
  //     part type of the garment type. Pieces are named by the VIEWER's side.
  //     Every garment pixel gets exactly one part: a fixed priority (the
  //     smaller / more specific part wins), then the rest of the top → TOP, the
  //     rest of the bottoms → PANT, anything unclear → UNASSIGNED. Edges refined
  //     against the photo, clipped to "KBPS garment", saved as channels
  //     "KBPS part <NAME>".
  //   LAYERS — group PARTS in PS, under PB and SDW; inside it one group per part name
  //     (team order), each holding "<NAME> shape": flat mid gray where the part
  //     is (mask applied → real pixels, for the print clipping in step 7).
  //     Shapes hidden.
  //   TOUCH UP — click a row, then + / − the current selection. Pixels added to
  //     one part leave every other part; pixels removed go back to TOP / PANT.
  // =======================================================================
  const PS_PARTS_GROUP = "PARTS";
  const PS_PART_CH     = "KBPS part ";                // + team name
  const PS_PART_TMP    = "KBPS_tmp_part";
  const PS_PART_TMP2   = "KBPS_tmp_part2";
  const PS_UNASSIGNED  = "UNASSIGNED";
  const PS_SHAPE_GRAY  = [128, 128, 128];
  // The team's 19 names, in their order (top to bottom in the Layers panel).
  const PS_PART_ORDER = ["PANT", "RIGHT PANT", "RIGHT PANT TRIM", "LEFT PANT", "LEFT INSIDE", "LEFT PANT TRIM",
    "TOP", "LEFT HAND", "LEFT HAND TRIM", "LEFT COLLAR", "LEFT TOP", "RIGHT TOP", "POCKET", "POCKET UPPER",
    "RIGHT COLLAR", "RIGHT NECK", "RIGHT HAND", "RIGHT HAND TRIM", "RIGHT HAND TRIM INSIDE"];
  const PS_PANT_SIDE = { "PANT": 1, "RIGHT PANT": 1, "RIGHT PANT TRIM": 1, "LEFT PANT": 1, "LEFT INSIDE": 1, "LEFT PANT TRIM": 1 };
  // What SAM is asked for. "button placket" (split line for the front panels),
  // "shirt" and "pants" (the areas TOP / PANT take the rest of) are helpers.
  const PS_PART_QUERIES = [
    { key: "sleeve",   prompt: "sleeve" },
    { key: "cuff",     prompt: "sleeve cuff" },
    { key: "cuffIn",   prompt: "inside of the sleeve cuff opening" },
    { key: "collar",   prompt: "collar" },
    { key: "neck",     prompt: "inside back of the collar / neck" },
    { key: "front",    prompt: "shirt front panel" },
    { key: "placket",  prompt: "button placket" },
    { key: "pocket",   prompt: "chest pocket" },
    { key: "pocketUp", prompt: "top band of the pocket" },
    { key: "leg",      prompt: "pant leg" },
    { key: "hem",      prompt: "pant hem cuff" },
    { key: "shirt",    prompt: "shirt", noZoom: true },
    { key: "pants",    prompt: "pants", noZoom: true },
  ];
  // Who wins a pixel claimed twice: first in this list wins.
  const PS_PART_PRIORITY = ["POCKET UPPER", "POCKET", "RIGHT HAND TRIM INSIDE", "LEFT HAND TRIM", "RIGHT HAND TRIM",
    "RIGHT NECK", "LEFT NECK", "LEFT COLLAR", "RIGHT COLLAR", "LEFT PANT TRIM", "RIGHT PANT TRIM", "LEFT HAND", "RIGHT HAND",
    "LEFT TOP", "RIGHT TOP", "LEFT PANT", "RIGHT PANT"];

  let psPartsArmUntil = 0;                            // two clicks to replace accepted parts
  let psPartsArmTimer = null;
  // The two-click warning, under the Find parts button only (gone after 5 seconds).
  function psPartsArmNote(on) {
    const n = $("ps-parts-arm");
    if (psPartsArmTimer) { clearTimeout(psPartsArmTimer); psPartsArmTimer = null; }
    if (!n) return;
    n.textContent = on ? "This replaces the parts and any hand fixes. Click Find parts again within 5 seconds to go ahead." : "";
    n.classList.toggle("hidden", !on);
    if (on) psPartsArmTimer = setTimeout(function () { psPartsArmTimer = null; psPartsArmNote(false); }, 5000);
  }

  // ----- GARMENT TYPES (docs/parts-list.md, A–H) ------------------------------
  // The user picks the type; only its parts are searched (and only the checked
  // ones), and step 4 offers only its Protected trims. A keeps the team's names and
  // the tested pajama cut (psCutParts; the file's "PATN" is "PANT"); B–H
  // use the file's names and psCutGeneric. Part fields: q = SAM query (PS_GQ key;
  // none = it takes what is left), s = side (L / R of the centre line), r = region
  // (u = top piece, l = bottom piece; one-piece types use "o"), p = priority (lower
  // wins a pixel claimed twice), rest = takes the leftover pixels of its region,
  // g = rest pair. Two checked parts with the same q and side: the first one gets
  // it (FRONT YOKE before BACK YOKE — uncheck the one not in view).
  const PS_GQ = {
    sleeve: "sleeve", cuff: "sleeve cuff", collar: "collar", yoke: "yoke", placket: "front placket",
    neckband: "neck band", inside: "inside of the garment showing through the opening",
    neckRuffle: "ruffle around the neckline", hemRuffle: "ruffle at the hem", cuffRuffle: "ruffle at the end of the sleeve",
    strap: "shoulder strap", armhole: "armhole binding", zipper: "zipper", leg: "leg", foot: "foot",
    top: "shirt", bottoms: "shorts or pants", shortLeg: "shorts leg", pantLeg: "pant leg", waistband: "waistband",
    shortHem: "hem band of the shorts", pocket: "chest pocket",
  };
  const PS_GQ_NOZOOM = { top: 1, bottoms: 1 };   // big areas: no close-up retry
  const PS_GTYPES = [
    { id: "A", label: "A · Pajama set, notch collar, piped", short: "PAJAMA SET", trims: ["PIPING", "BUTTONS"], team: true },
    { id: "B", label: "B · Nightgown, long sleeve, yoke and placket", short: "NIGHTGOWN", one: true, center: { o: "placket" }, trims: ["BUTTONS", "LACE"],
      parts: [{ n: "FRONT YOKE", q: "yoke", p: 5 }, { n: "BACK YOKE", q: "yoke", p: 5 }, { n: "GOWN FRONT", rest: 1, g: "gown" }, { n: "GOWN BACK", rest: 1, g: "gown" },
        { n: "PLACKET", q: "placket", p: 1 }, { n: "NECK BAND", q: "neckband", p: 0 }, { n: "LEFT HAND", q: "sleeve", s: "L", p: 4 }, { n: "RIGHT HAND", q: "sleeve", s: "R", p: 4 },
        { n: "LEFT HAND TRIM", q: "cuff", s: "L", p: 2 }, { n: "RIGHT HAND TRIM", q: "cuff", s: "R", p: 2 }, { n: "LEFT COLLAR", q: "collar", s: "L", p: 3 },
        { n: "RIGHT COLLAR", q: "collar", s: "R", p: 3 }, { n: "GOWN INSIDE", q: "inside", p: 3 }] },
    { id: "C", label: "C · Nightgown, long sleeve, ruffle neck and hem", short: "RUFFLE NIGHTGOWN", one: true, trims: ["RUFFLE LACE"],
      parts: [{ n: "GOWN FRONT", rest: 1, g: "gown" }, { n: "GOWN BACK", rest: 1, g: "gown" }, { n: "NECK RUFFLE", q: "neckRuffle", p: 1 }, { n: "HEM RUFFLE", q: "hemRuffle", p: 1 },
        { n: "LEFT HAND", q: "sleeve", s: "L", p: 4 }, { n: "RIGHT HAND", q: "sleeve", s: "R", p: 4 }, { n: "LEFT HAND RUFFLE", q: "cuffRuffle", s: "L", p: 2 },
        { n: "RIGHT HAND RUFFLE", q: "cuffRuffle", s: "R", p: 2 }, { n: "LEFT HAND TRIM", q: "cuff", s: "L", p: 3 }, { n: "RIGHT HAND TRIM", q: "cuff", s: "R", p: 3 }] },
    { id: "D", label: "D · Nightgown, sleeveless, square neck", short: "SLEEVELESS NIGHTGOWN", one: true, trims: ["LACE", "BUTTONS"],
      parts: [{ n: "FRONT YOKE", q: "yoke", p: 4 }, { n: "BACK YOKE", q: "yoke", p: 4 }, { n: "GOWN FRONT", rest: 1, g: "gown" }, { n: "GOWN BACK", rest: 1, g: "gown" },
        { n: "LEFT STRAP", q: "strap", s: "L", p: 1 }, { n: "RIGHT STRAP", q: "strap", s: "R", p: 1 }, { n: "LEFT ARMHOLE", q: "armhole", s: "L", p: 2 },
        { n: "RIGHT ARMHOLE", q: "armhole", s: "R", p: 2 }, { n: "GOWN INSIDE", q: "inside", p: 3 }] },
    { id: "E", label: "E · Footed sleeper / zip coverall", short: "SLEEPER", one: true, center: { o: "zipper" }, trims: ["ZIPPER"],
      parts: [{ n: "LEFT FRONT", rest: 1, s: "L", g: "front" }, { n: "RIGHT FRONT", rest: 1, s: "R", g: "front" }, { n: "LEFT HAND", q: "sleeve", s: "L", p: 3 },
        { n: "RIGHT HAND", q: "sleeve", s: "R", p: 3 }, { n: "LEFT HAND TRIM", q: "cuff", s: "L", p: 1 }, { n: "RIGHT HAND TRIM", q: "cuff", s: "R", p: 1 },
        { n: "LEFT LEG", q: "leg", s: "L", p: 4 }, { n: "RIGHT LEG", q: "leg", s: "R", p: 4 }, { n: "LEFT FOOT", q: "foot", s: "L", p: 2 }, { n: "RIGHT FOOT", q: "foot", s: "R", p: 2 },
        { n: "NECK BAND", q: "neckband", p: 0 }] },
    { id: "F", label: "F · Knit top and short or pant, striped", short: "KNIT SET", center: { u: "placket" }, trims: ["BUTTONS", "DRAWCORD"],
      parts: [{ n: "TOP FRONT", r: "u", rest: 1, g: "top" }, { n: "PLACKET", q: "placket", r: "u", p: 1 }, { n: "NECK BAND", q: "neckband", r: "u", p: 0 },
        { n: "LEFT HAND", q: "sleeve", s: "L", r: "u", p: 3 }, { n: "RIGHT HAND", q: "sleeve", s: "R", r: "u", p: 3 }, { n: "LEFT HAND TRIM", q: "cuff", s: "L", r: "u", p: 2 },
        { n: "RIGHT HAND TRIM", q: "cuff", s: "R", r: "u", p: 2 }, { n: "LEFT SHORT", q: "shortLeg", s: "L", r: "l", p: 4, rest: 1, g: "short" },
        { n: "RIGHT SHORT", q: "shortLeg", s: "R", r: "l", p: 4, rest: 1, g: "short" }, { n: "LEFT PANT", q: "pantLeg", s: "L", r: "l", p: 4, rest: 1, g: "pant" },
        { n: "RIGHT PANT", q: "pantLeg", s: "R", r: "l", p: 4, rest: 1, g: "pant" }, { n: "WAISTBAND", q: "waistband", r: "l", p: 1 },
        { n: "LEFT SHORT TRIM", q: "shortHem", s: "L", r: "l", p: 2 }, { n: "RIGHT SHORT TRIM", q: "shortHem", s: "R", r: "l", p: 2 }] },
    { id: "G", label: "G · Tee and boxer short", short: "TEE + SHORT", trims: ["DRAWCORD"],
      parts: [{ n: "TOP FRONT", r: "u", rest: 1, g: "top" }, { n: "CHEST POCKET", q: "pocket", r: "u", p: 1 }, { n: "NECK BAND", q: "neckband", r: "u", p: 0 },
        { n: "LEFT HAND", q: "sleeve", s: "L", r: "u", p: 3 }, { n: "RIGHT HAND", q: "sleeve", s: "R", r: "u", p: 3 },
        { n: "LEFT SHORT", q: "shortLeg", s: "L", r: "l", p: 4, rest: 1, g: "short" }, { n: "RIGHT SHORT", q: "shortLeg", s: "R", r: "l", p: 4, rest: 1, g: "short" },
        { n: "WAISTBAND", q: "waistband", r: "l", p: 1 }] },
    { id: "H", label: "H · Sleeveless ruffle top and pant set", short: "RUFFLE TOP SET", trims: ["BOW"],
      parts: [{ n: "TOP FRONT", r: "u", rest: 1, g: "top" }, { n: "NECK RUFFLE", q: "neckRuffle", r: "u", p: 1 }, { n: "LEFT ARMHOLE", q: "armhole", s: "L", r: "u", p: 2 },
        { n: "RIGHT ARMHOLE", q: "armhole", s: "R", r: "u", p: 2 }, { n: "LEFT PANT", q: "pantLeg", s: "L", r: "l", p: 4, rest: 1, g: "pant" },
        { n: "RIGHT PANT", q: "pantLeg", s: "R", r: "l", p: 4, rest: 1, g: "pant" }, { n: "WAISTBAND", q: "waistband", r: "l", p: 1 }] },
  ];
  // Type A: which of the pajama queries (PS_PART_QUERIES) each team part needs.
  const PS_A_NEEDS = { "LEFT HAND": ["sleeve"], "RIGHT HAND": ["sleeve"], "LEFT HAND TRIM": ["cuff"], "RIGHT HAND TRIM": ["cuff"],
    "RIGHT HAND TRIM INSIDE": ["cuffIn"], "LEFT COLLAR": ["collar"], "RIGHT COLLAR": ["collar"], "RIGHT NECK": ["neck"],
    "LEFT TOP": ["front"], "RIGHT TOP": ["front"], "POCKET": ["pocket"], "POCKET UPPER": ["pocketUp"], "TOP": [],
    "LEFT PANT": ["leg"], "RIGHT PANT": ["leg"], "LEFT PANT TRIM": ["hem"], "RIGHT PANT TRIM": ["hem"], "LEFT INSIDE": [], "PANT": [] };
  const PS_A_LABEL = { sleeve: "LEFT / RIGHT HAND", cuff: "LEFT / RIGHT HAND TRIM", cuffIn: "RIGHT HAND TRIM INSIDE", collar: "LEFT / RIGHT COLLAR",
    neck: "RIGHT NECK", front: "LEFT / RIGHT TOP", placket: "PLACKET (centre line)", pocket: "POCKET", pocketUp: "POCKET UPPER",
    leg: "LEFT / RIGHT PANT", hem: "LEFT / RIGHT PANT TRIM", shirt: "TOP (shirt area)", pants: "PANT (pants area)" };
  // Every type's part list (names, in order) → [{ n, ... }].
  function psGtypeParts(t) {
    if (!t) return [];
    if (t.team) return PS_PART_ORDER.map(function (n) { return { n: n, r: PS_PANT_SIDE[n] ? "l" : "u", team: 1 }; });
    return t.parts.map(function (p) { return Object.assign({ r: t.one ? "o" : (p.r || "u") }, p); });
  }
  function psGtypeById(id) { const all = psAllGtypes(); for (let i = 0; i < all.length; i++) if (all[i].id === id) return all[i]; return null; }
  // "OTHER" GARMENT TYPE for styles not in A–H. A builder under the step 2
  // dropdown picks trims and parts; the result is a type like B–H (same fields, cut by
  // psCutGeneric), used for this document only (stored in it) until "Save as type"
  // gives it the next letter (I, J …) and writes it to print-swap-custom-types.json.
  // A–H (PS_GTYPES) are never changed.
  const PS_OTHER_ID = "OTHER";
  const PS_CUSTOM_FILE = "print-swap-custom-types.json";
  const PS_CUSTOM_FOLDER_FILE = "print-swap-custom-types-folder.json";   // where the parts list lives (persistent token)
  const PS_TRIM_NAMES = ["PIPING", "BUTTONS", "LACE", "RUFFLE LACE", "DRAWCORD", "BOW", "ZIPPER"];
  let psCustomTypes = [];                             // saved types, from the file
  let psDocType = null;                               // the active document's own Other / custom definition
  let psOtherSaveTimer = null;
  function psAllGtypes() {
    const out = PS_GTYPES.concat(psCustomTypes);
    if (psDocType && !out.some(function (t) { return t.id === psDocType.id; })) out.push(psDocType);
    return out;
  }
  // A part from type A's team list, in B–H's fields (A's own cut stays as it is).
  function psPartFromTeamName(n) {
    const def = { n: n, r: PS_PANT_SIDE[n] ? "l" : "u" };
    if (/^LEFT /.test(n)) def.s = "L"; else if (/^RIGHT /.test(n)) def.s = "R";
    if (n === "TOP" || n === "PANT") { def.rest = 1; def.g = n.toLowerCase(); }
    const k = (PS_A_NEEDS[n] || [])[0];
    if (k) {
      if (PS_GQ[k]) def.q = k;
      else { const Q = PS_PART_QUERIES.filter(function (x) { return x.key === k; })[0]; def.q = "a_" + k; def.prompt = Q ? Q.prompt : k; }
      const pr = PS_PART_PRIORITY.indexOf(n);
      def.p = pr >= 0 ? Math.floor(pr / 4) + 1 : 3;
    }
    return def;
  }
  // Every part name used in A–H, once (B–H's definition first, then A's), sorted by
  // area with LEFT before RIGHT.
  function psPartCatalog() {
    const out = [], seen = {};
    for (let i = 1; i < PS_GTYPES.length; i++) PS_GTYPES[i].parts.forEach(function (p) { if (!seen[p.n]) { seen[p.n] = 1; out.push(Object.assign({}, p)); } });
    PS_PART_ORDER.forEach(function (n) { if (!seen[n]) { seen[n] = 1; out.push(psPartFromTeamName(n)); } });
    const key = function (n) { return n.replace(/^(LEFT|RIGHT) /, "") + (/^RIGHT /.test(n) ? " 2" : (/^LEFT /.test(n) ? " 1" : " 0")); };
    return out.sort(function (a, b) { return key(a.n) < key(b.n) ? -1 : (key(a.n) > key(b.n) ? 1 : 0); });
  }
  // A typed part name → ALL CAPS, 2–3 words, LEFT / RIGHT first (SIDE + AREA + DETAIL).
  function psNormPartName(raw) {
    const words = String(raw || "").toUpperCase().replace(/[^A-Z ]+/g, " ").trim().split(/\s+/).filter(Boolean);
    const side = words.filter(function (w) { return w === "LEFT" || w === "RIGHT"; });
    const rest = words.filter(function (w) { return w !== "LEFT" && w !== "RIGHT"; });
    if (side.length > 1) return { error: "Use one side only (LEFT or RIGHT)." };
    const all = side.concat(rest);
    if (all.length < 2 || all.length > 3) return { error: "Use 2–3 words: SIDE + AREA + DETAIL, e.g. NOTCH COLLAR or LEFT CUFF TRIM." };
    if (!rest.length) return { error: "Name the area, e.g. LEFT POCKET." };
    const def = { n: all.join(" "), q: "x_" + rest.join("_").toLowerCase(), prompt: rest.join(" ").toLowerCase(), p: 2, typed: 1 };
    if (side.length) def.s = side[0] === "LEFT" ? "L" : "R";
    return { def: def };
  }
  // The builder's trims + parts → a type with B–H's fields. Upper and lower parts
  // together make a two-piece set (top / bottoms areas); otherwise one piece. The
  // placket or zipper is the left / right line when it is checked.
  function psTypeFromParts(id, name, trims, parts) {
    const ps = parts.map(function (p) { return Object.assign({}, p); });
    const two = ps.some(function (p) { return p.r === "l"; }) && ps.some(function (p) { return p.r !== "l"; });
    if (two) ps.forEach(function (p) { if (!p.r) p.r = "u"; });
    else ps.forEach(function (p) { delete p.r; });
    const qs = ps.map(function (p) { return p.q; });
    let center;
    if (!two) { if (qs.indexOf("zipper") >= 0) center = { o: "zipper" }; else if (qs.indexOf("placket") >= 0) center = { o: "placket" }; }
    else if (ps.some(function (p) { return p.q === "placket" && p.r === "u"; })) center = { u: "placket" };
    const t = { id: id, label: id === PS_OTHER_ID ? "Other · " + (name || "this document only") : id + " · " + name, short: String(name || "OTHER").toUpperCase(),
      custom: true, one: !two, trims: PS_TRIM_NAMES.filter(function (x) { return trims.indexOf(x) >= 0; }), parts: ps };
    if (center) t.center = center;
    return t;
  }
  function psValidType(t) {
    return !!(t && typeof t.id === "string" && /^([I-Z]|OTHER)$/.test(t.id) && typeof t.label === "string" && Array.isArray(t.trims) && Array.isArray(t.parts)
      && t.trims.every(function (x) { return PS_TRIM_NAMES.indexOf(x) >= 0; }) && t.parts.every(function (p) { return p && typeof p.n === "string"; }));
  }

  // ----- the file: saved types, next to the parts list (folder picked once) + a copy in the plug-in folder -----
  async function psCustomFolder(ask) {
    try {
      const f = await (await fsLocal().getDataFolder()).getEntry(PS_CUSTOM_FOLDER_FILE);
      const tok = JSON.parse(await f.read({ format: fmts().utf8 })).token;
      const e = tok ? await fsLocal().getEntryForPersistentToken(tok) : null;
      if (e) return e;
    } catch (_) {}
    if (!ask) return null;
    setStatus("ok", "Pick the folder that holds the parts list (print-swap-parts-list…). " + PS_CUSTOM_FILE + " is saved there; asked once.");
    const folder = await fsLocal().getFolder();
    if (!folder) return null;
    try {
      const tok = await fsLocal().createPersistentToken(folder);
      const f = await (await fsLocal().getDataFolder()).createFile(PS_CUSTOM_FOLDER_FILE, { overwrite: true });
      await f.write(JSON.stringify({ token: tok, path: folder.nativePath }), { format: fmts().utf8 });
    } catch (e) { traceErr("ps custom types: remember the folder", e); }
    return folder;
  }
  async function psCustomLoad() {
    let data = null, from = "";
    try { const folder = await psCustomFolder(false); if (folder) { data = JSON.parse(await (await folder.getEntry(PS_CUSTOM_FILE)).read({ format: fmts().utf8 })); from = folder.nativePath; } } catch (_) {}
    if (!data) {
      try { data = JSON.parse(await (await (await fsLocal().getDataFolder()).getEntry(PS_CUSTOM_FILE)).read({ format: fmts().utf8 })); from = "the plug-in folder"; } catch (_) {}
    }
    psCustomTypes = (data && Array.isArray(data.types) ? data.types : []).filter(function (t) { return psValidType(t) && t.id !== PS_OTHER_ID; });
    try { console.log(TAG, "print swap custom types: " + psCustomTypes.map(function (t) { return t.label; }).join(", ") + (from ? " (from " + from + ")" : "")); } catch (_) {}
    psGtypeRender();
    return from;
  }
  async function psCustomWrite() {
    const json = JSON.stringify({ v: 1, note: "KBImage Print Swap — saved garment types (I, J …). Types A–H are in the parts list and are not stored here.",
      types: psCustomTypes }, null, 2);
    let where = [];
    const folder = await psCustomFolder(true);
    if (folder) {
      try { const f = await folder.createFile(PS_CUSTOM_FILE, { overwrite: true }); await f.write(json, { format: fmts().utf8 }); where.push(folder.nativePath); }
      catch (e) { traceErr("ps custom types: write next to the parts list", e); }
    }
    try { const f = await (await fsLocal().getDataFolder()).createFile(PS_CUSTOM_FILE, { overwrite: true }); await f.write(json, { format: fmts().utf8 }); where.push("the plug-in folder"); }
    catch (e) { traceErr("ps custom types: write in the plug-in folder", e); }
    return where;
  }

  // ----- the builder (step 2, under the dropdown, while the type is Other) -----
  function psOtherDisplayParts() {
    const cat = psPartCatalog(), names = {};
    cat.forEach(function (p) { names[p.n] = 1; });
    const typed = (psDocType && psDocType.id === PS_OTHER_ID ? psDocType.parts : []).filter(function (p) { return !names[p.n]; });
    return cat.concat(typed);
  }
  function psOtherSet(trims, partNames) {
    const shown = psOtherDisplayParts().concat(psOtherExtra);
    const parts = [], seen = {};
    shown.forEach(function (p) { if (partNames.indexOf(p.n) >= 0 && !seen[p.n]) { seen[p.n] = 1; parts.push(p); } });
    psDocType = psTypeFromParts(PS_OTHER_ID, null, trims, parts);
    delete psGtypeChecked[PS_OTHER_ID];               // step 6's checklist follows the builder
    psGtypeRender();
    try { psStepsRefresh(); } catch (_) {}
    if (psOtherSaveTimer) clearTimeout(psOtherSaveTimer);
    psOtherSaveTimer = setTimeout(function () { psOtherSaveTimer = null; if (psGarmentType === PS_OTHER_ID && psMod().app.activeDocument) psGtypeSave(PS_OTHER_ID); }, 800);
  }
  let psOtherExtra = [];                              // typed parts not yet checked (kept in the list)
  function psOtherCur() { return psDocType && psDocType.id === PS_OTHER_ID ? psDocType : psTypeFromParts(PS_OTHER_ID, null, [], []); }
  function actPsOtherTrim(srcEl) {
    const n = srcEl && srcEl.getAttribute && srcEl.getAttribute("data-trim-name");
    const t = psOtherCur(), tr = t.trims.slice(), i = tr.indexOf(n);
    if (i >= 0) tr.splice(i, 1); else tr.push(n);
    psOtherSet(tr, t.parts.map(function (p) { return p.n; }));
  }
  function actPsOtherPart(srcEl) {
    const n = srcEl && srcEl.getAttribute && srcEl.getAttribute("data-part");
    const t = psOtherCur(), names = t.parts.map(function (p) { return p.n; }), i = names.indexOf(n);
    if (i >= 0) names.splice(i, 1); else names.push(n);
    psOtherSet(t.trims, names);
  }
  function actPsOtherAddPart() {
    const inp = $("ps-other-add");
    const r = psNormPartName(inp ? inp.value : "");
    if (r.error) { setStatus("bad", r.error); return; }
    const t = psOtherCur(), names = t.parts.map(function (p) { return p.n; });
    if (names.indexOf(r.def.n) >= 0) { setStatus("ok", r.def.n + " is already checked."); if (inp) inp.value = ""; return; }
    if (!psOtherDisplayParts().some(function (p) { return p.n === r.def.n; }) && !psOtherExtra.some(function (p) { return p.n === r.def.n; })) psOtherExtra.push(r.def);
    names.push(r.def.n);
    if (inp) inp.value = "";
    psOtherSet(t.trims, names);
    setStatus("ok", "Added " + r.def.n + (r.def.s ? "" : "") + " (SAM looks for “" + r.def.prompt + "”).");
  }
  function actPsOtherSaveAsk() {
    const t = psOtherCur();
    if (!t.parts.length) { setStatus("bad", "Check at least one part first."); return; }
    const row = $("ps-other-save-row"); if (row) row.classList.remove("hidden");
    setStatus("ok", "Name the type (e.g. Sleep shirt), then Save.");
  }
  function actPsOtherSaveCancel() { const row = $("ps-other-save-row"); if (row) row.classList.add("hidden"); setStatus("ok", "Not saved."); }
  function psNextTypeLetter() {
    const used = psAllGtypes().map(function (t) { return t.id; });
    for (let c = "I".charCodeAt(0); c <= "Z".charCodeAt(0); c++) { const L = String.fromCharCode(c); if (used.indexOf(L) < 0) return L; }
    return null;
  }
  async function actPsOtherSave() {
    const t = psOtherCur();
    const inp = $("ps-other-name");
    const name = String(inp ? inp.value : "").replace(/\s+/g, " ").trim();
    if (!name) { setStatus("bad", "Type a short name for the type, e.g. Sleep shirt."); return; }
    if (name.length > 30) { setStatus("bad", "Keep the name short (30 characters at most)."); return; }
    if (!t.parts.length) { setStatus("bad", "Check at least one part first."); return; }
    const letter = psNextTypeLetter();
    if (!letter) { setStatus("bad", "All letters I to Z are used."); return; }
    const saved = psTypeFromParts(letter, name, t.trims, t.parts);
    psCustomTypes.push(saved);
    let where = [];
    try { where = await psCustomWrite(); } catch (e) { traceErr("ps custom types: save", e); }
    if (psGtypeChecked[PS_OTHER_ID]) psGtypeChecked[letter] = psGtypeChecked[PS_OTHER_ID];
    psDocType = saved;
    psGarmentType = letter;
    psOtherExtra = [];
    const row = $("ps-other-save-row"); if (row) row.classList.add("hidden");
    if (inp) inp.value = "";
    try { trace("ps: saved garment type " + saved.label + " (trims " + saved.trims.join(", ") + "; parts " + saved.parts.map(function (p) { return p.n; }).join(", ") + ")"); } catch (_) {}
    psGtypeRender();
    try { psStepsRefresh(); } catch (_) {}
    if (psMod().app.activeDocument) psGtypeSave(letter);
    setStatus(where.length ? "ok" : "bad", where.length ? "Saved as " + saved.label + ". It is in the dropdown for every document (" + PS_CUSTOM_FILE + " in " + where.join(" and ") + ")."
      : "Saved as " + saved.label + " for this panel session, but the file could not be written: see the trace.");
  }
  function psOtherRender() {
    const box = $("ps-other");
    if (!box) return;
    const on = psGarmentType === PS_OTHER_ID;
    box.classList.toggle("hidden", !on);
    if (!on) return;
    const t = psOtherCur();
    const fill = function (listId, items, isOn, action, attr) {
      const list = $(listId); if (!list) return;
      while (list.firstChild) list.removeChild(list.firstChild);
      items.forEach(function (n) {
        const row = document.createElement("div");
        row.className = "ps-check" + (isOn(n) ? " on" : "");
        row.setAttribute("role", "button"); row.setAttribute("tabindex", "0");
        row.setAttribute("data-action", action); row.setAttribute(attr, n);
        const b = document.createElement("span"); b.className = "ps-check-box"; b.textContent = isOn(n) ? "✓" : "";
        const nm = document.createElement("span"); nm.className = "ps-check-name"; nm.textContent = n;
        row.appendChild(b); row.appendChild(nm); list.appendChild(row);
      });
    };
    fill("ps-other-trims", PS_TRIM_NAMES, function (n) { return t.trims.indexOf(n) >= 0; }, "ps-other-trim", "data-trim-name");
    const names = t.parts.map(function (p) { return p.n; });
    const shown = psOtherDisplayParts().concat(psOtherExtra.filter(function (p) { return !psOtherDisplayParts().some(function (q) { return q.n === p.n; }); }));
    fill("ps-other-parts", shown.map(function (p) { return p.n; }), function (n) { return names.indexOf(n) >= 0; }, "ps-other-part", "data-part");
    const hint = $("ps-other-hint");
    if (hint) {
      const rest = t.parts.some(function (p) { return p.rest; });
      hint.textContent = t.parts.length + " part" + (t.parts.length === 1 ? "" : "s") + ", trims: " + (t.trims.length ? t.trims.join(", ") : "none") + "."
        + (t.parts.length && !rest ? " No body part is checked (e.g. TOP FRONT or GOWN FRONT), so what the parts do not cover goes to UNASSIGNED." : "");
    }
  }
  // "LEFT HAND", "RIGHT HAND" → "LEFT / RIGHT HAND".
  function psPairLabel(names) {
    if (names.length === 2 && /^LEFT /.test(names[0]) && names[1] === names[0].replace(/^LEFT /, "RIGHT ")) return "LEFT / RIGHT " + names[0].slice(5);
    if (names.length === 2 && /^RIGHT /.test(names[0]) && names[1] === names[0].replace(/^RIGHT /, "LEFT ")) return "LEFT / RIGHT " + names[0].slice(6);
    return names.join(" / ");
  }
  // The SAM queries for a type and its checked parts: [{ key, prompt, noZoom, label }].
  function psPartsPlan(t, checked) {
    const out = [], seen = {};
    const add = function (key, prompt, noZoom, label) { if (seen[key]) return; seen[key] = 1; out.push({ key: key, prompt: prompt, noZoom: !!noZoom, label: label }); };
    if (!t) return out;
    const parts = psGtypeParts(t).filter(function (p) { return checked.has(p.n); });
    if (t.team) {
      const need = {};
      parts.forEach(function (p) { (PS_A_NEEDS[p.n] || []).forEach(function (k) { need[k] = 1; }); });
      if (parts.some(function (p) { return p.r === "u"; })) { need.shirt = 1; need.placket = 1; }
      if (parts.some(function (p) { return p.r === "l"; })) need.pants = 1;
      PS_PART_QUERIES.forEach(function (Q) { if (need[Q.key]) add(Q.key, Q.prompt, Q.noZoom, PS_A_LABEL[Q.key] || Q.prompt); });
      return out;
    }
    // centre line and area helpers first, then one query per part query
    ["o", "u", "l"].forEach(function (r) {
      const key = t.center && t.center[r];
      if (key && parts.some(function (p) { return p.r === r && p.s; })) add(key, PS_GQ[key], false, (parts.filter(function (p) { return p.q === key; }).map(function (p) { return p.n; })[0] || key.toUpperCase()) + " (centre line)");
    });
    if (!t.one) {
      if (parts.some(function (p) { return p.r === "u"; })) add("top", PS_GQ.top, true, "TOP AREA");
      if (parts.some(function (p) { return p.r === "l"; })) add("bottoms", PS_GQ.bottoms, true, "BOTTOMS AREA");
    }
    parts.forEach(function (p) {
      if (!p.q) return;
      const names = parts.filter(function (x) { return x.q === p.q; }).map(function (x) { return x.n; });
      add(p.q, PS_GQ[p.q] || p.prompt, PS_GQ_NOZOOM[p.q], psPairLabel(names));   // p.prompt: a typed Other part
    });
    return out;
  }
  // Type A after psCutParts: an unchecked part's pixels go to TOP / PANT (when
  // checked) or UNASSIGNED. LEFT NECK follows RIGHT NECK.
  function psCutFilterA(cut, checked, N) {
    const labels = cut.labels, out = {};
    const keep = function (n) { return n === PS_UNASSIGNED || (n === "LEFT NECK" ? checked.has("RIGHT NECK") : checked.has(n)); };
    Object.keys(labels).forEach(function (n) { if (keep(n)) out[n] = labels[n]; });
    Object.keys(labels).forEach(function (n) {
      if (keep(n)) return;
      const home = PS_PANT_SIDE[n] ? "PANT" : "TOP", to = checked.has(home) ? home : PS_UNASSIGNED;
      if (!out[to]) out[to] = new Uint8Array(N);
      const b = labels[n], d = out[to];
      for (let k = 0; k < N; k++) if (b[k]) d[k] = 1;
    });
    return { labels: out, unassigned: out[PS_UNASSIGNED] ? 1 : 0, garmentPx: cut.garmentPx };
  }
  // Types B–H: one part per garment pixel. Claims (by priority), then leftovers to the
  // region's rest part(s) (a rest pair split at the centre line), else UNASSIGNED.
  function psCutGeneric(t, checked, sam, garment, gw, gh) {
    const N = gw * gh;
    const inG = new Uint8Array(N); let gCount = 0;
    for (let k = 0; k < N; k++) if (garment[k] > 127) { inG[k] = 1; gCount++; }
    const U = function (key) { return psUnion(sam[key] || [], N); };
    const parts = psGtypeParts(t).filter(function (p) { return checked.has(p.n); });
    const two = !t.one;
    const upA = two ? psUnion([U("top")].concat(parts.filter(function (p) { return p.r === "u" && p.q; }).map(function (p) { return U(p.q); })), N) : null;
    const loA = two ? psUnion([U("bottoms")].concat(parts.filter(function (p) { return p.r === "l" && p.q; }).map(function (p) { return U(p.q); })), N) : null;
    const gx = psCentroidX(inG, gw, gh);
    const centers = {};
    const center = function (r) {
      if (centers[r]) return centers[r];
      const key = t.center && t.center[r];
      const line = (key && sam[key] && sam[key].length) ? U(key) : null;
      const area = r === "u" ? upA : (r === "l" ? loA : inG);
      const cx = area ? psCentroidX(area, gw, gh) : null;
      centers[r] = psCenterLine(line, gw, gh, cx != null ? cx : (gx != null ? gx : gw / 2));
      return centers[r];
    };
    const names = parts.map(function (p) { return p.n; }).concat([PS_UNASSIGNED]);
    const idx = {}; names.forEach(function (n, i) { idx[n] = i + 1; });
    const label = new Uint8Array(N);
    // 1) claims: the first checked part per (query, side), lowest p first
    const seen = {}, claims = [];
    parts.forEach(function (p) { if (!p.q) return; const id = p.q + "|" + (p.s || ""); if (seen[id]) return; seen[id] = 1; claims.push(p); });
    claims.sort(function (a, b) { return (a.p || 0) - (b.p || 0); });
    for (let c = 0; c < claims.length; c++) {
      const p = claims[c];
      const b = p.s ? psSplitSides(sam[p.q] || [], center(p.r), gw, gh)[p.s === "L" ? "left" : "right"] : U(p.q);
      const v = idx[p.n];
      for (let k = 0; k < N; k++) if (inG[k] && !label[k] && b[k]) label[k] = v;
    }
    // 2) leftovers
    const restOf = {}; ["o", "u", "l"].forEach(function (r) { restOf[r] = parts.filter(function (p) { return p.rest && p.r === r; }); });
    const sb = two ? psRowQuantile(upA, gw, gh, 0.95) : null, pt = two ? psRowQuantile(loA, gw, gh, 0.05) : null;
    let unassigned = 0;
    for (let y = 0, k = 0; y < gh; y++) for (let x = 0; x < gw; x++, k++) {
      if (!inG[k] || label[k]) continue;
      let r = "o";
      if (two) {
        if (upA[k]) r = "u"; else if (loA[k]) r = "l";
        else if (sb != null && pt != null) { const lo = Math.min(sb, pt), hi = Math.max(sb, pt); r = y < lo ? "u" : (y > hi ? "l" : (y <= (sb + pt) / 2 ? "u" : "l")); }
        else r = sb != null ? "u" : "l";
      }
      const cands = restOf[r];
      if (!cands.length) { label[k] = idx[PS_UNASSIGNED]; unassigned++; continue; }
      let to = cands[0];
      if (to.s) {
        const mate = cands.filter(function (q) { return q.g === to.g && q.s && q.s !== to.s; })[0];
        if (mate) { const leftSide = x < center(r)[y]; to = (leftSide === (to.s === "L")) ? to : mate; }
      }
      label[k] = idx[to.n];
    }
    // A few stray UNASSIGNED pixels (under 0.1% of the garment) join the part next to them.
    if (unassigned && unassigned < Math.max(30, gCount * 0.001)) {
      const u = idx[PS_UNASSIGNED];
      for (let pass = 0; pass < 30 && unassigned; pass++) {
        for (let y = 0, k = 0; y < gh; y++) for (let x = 0; x < gw; x++, k++) {
          if (label[k] !== u) continue;
          const nb = (x > 0 && label[k - 1] && label[k - 1] !== u) ? label[k - 1]
                   : (x < gw - 1 && label[k + 1] && label[k + 1] !== u) ? label[k + 1]
                   : (y > 0 && label[k - gw] && label[k - gw] !== u) ? label[k - gw]
                   : (y < gh - 1 && label[k + gw] && label[k + gw] !== u) ? label[k + gw] : 0;
          if (nb) { label[k] = nb; unassigned--; }
        }
      }
    }
    const out = {};
    for (let i = 0; i < names.length; i++) {
      const v = i + 1, b = new Uint8Array(N); let n = 0;
      for (let k = 0; k < N; k++) if (label[k] === v) { b[k] = 1; n++; }
      if (n) out[names[i]] = b;
    }
    return { labels: out, unassigned: unassigned, garmentPx: gCount };
  }
  // Where a part's removed pixels go (touch-up): its region's rest part, else UNASSIGNED.
  // A part that takes the leftovers cannot have pixels removed.
  function psPartTypeFor(name) {
    const cur = psGtypeById(psGarmentType);
    if (cur && psGtypeParts(cur).some(function (p) { return p.n === name; })) return cur;
    if (PS_PART_ORDER.indexOf(name) >= 0) return PS_GTYPES[0];
    const all = psAllGtypes();
    for (let i = 1; i < all.length; i++) if (psGtypeParts(all[i]).some(function (p) { return p.n === name; })) return all[i];
    return null;
  }
  function psPartIsRest(name) {
    if (name === PS_UNASSIGNED) return true;
    const t = psPartTypeFor(name);
    if (!t) return false;
    if (t.team) return name === "TOP" || name === "PANT";
    const p = psGtypeParts(t).filter(function (x) { return x.n === name; })[0];
    return !!(p && p.rest);
  }
  function psPartHome(name) {
    const t = psPartTypeFor(name);
    if (!t) return PS_UNASSIGNED;
    if (t.team) return PS_PANT_SIDE[name] ? "PANT" : "TOP";
    const parts = psGtypeParts(t), me = parts.filter(function (x) { return x.n === name; })[0];
    const have = psPartNames();
    const cands = parts.filter(function (x) { return x.rest && x.r === (me ? me.r : "o") && have.indexOf(x.n) >= 0; });
    return cands.length ? cands[0].n : PS_UNASSIGNED;
  }
  // The type picked for this panel session (not saved across sessions) and its checked parts.
  let psGarmentType = null;
  const psGtypeChecked = {};
  function psCheckedFor(t) {
    if (!t) return new Set();
    if (!psGtypeChecked[t.id]) psGtypeChecked[t.id] = new Set(psGtypeParts(t).map(function (p) { return p.n; }));
    return psGtypeChecked[t.id];
  }

  function psPartsCostText() {
    const t = psGtypeById(psGarmentType);
    if (!t) return "Pick the garment type in step 2 first.";
    const plan = psPartsPlan(t, psCheckedFor(t));
    const n = plan.length, z = plan.filter(function (q) { return !q.noZoom; }).length, parts = psCheckedFor(t).size;
    if (!n) return "Check at least one part.";
    return "SAM 3.1 · " + n + " search" + (n === 1 ? "" : "es") + " for " + parts + " part" + (parts === 1 ? "" : "s")
      + " · $" + (n * SAM_COST_USD).toFixed(3) + "–$" + ((n + z * KB_ZOOM_TILES) * SAM_COST_USD).toFixed(3);
  }

  // ----- Layers ------------------------------------------------------------------
  // The team's structure: PS (top level, under MERGED VERSIONS and HAIR) holds PB (the
  // trims), SDW (step 8) and the part groups, in that order. A v0.19 document (top-level
  // trims, PARTS, the GREY group) still works; psLayoutFixInModal moves it into PS. Step 6's
  // part groups all live in one PARTS folder in PS, under PB and SDW; the preview is built in it.
  const PS_PS_GROUP = "PS", PS_PB_GROUP = "PB", PS_SDW_GROUP = "SDW", PS_BACKUP_GROUP = "Backup";
  const KB_BACKUP_TMP = "kb_backup_tmp";                     // the placeholder a new Backup is made around
  // "PRINT source · <file>" and "PRINT tiled · <file>": the Backup layers. Never a part, never
  // in PARTS, ignored by every parts lookup.
  function psIsBackupPrint(n) { return /^PRINT (source|tiled)( |$)/.test(String(n)); }
  function psBackupPrints() { return kbFindLayers("PRINT ").filter(function (l) { let g = null; try { g = l.layers; } catch (_) {} return !g && psIsBackupPrint(l.name); }); }
  // A part group is a group whose name is a part name (every garment type's, plus parts added
  // for Other). Anything else in PS (PB, SDW, Backup, PARTS, a trim group that ended up in PS
  // by mistake, the retoucher's own groups) is never a part: never deleted, moved or read as one.
  function psPartNameSet() {
    const set = {};
    psAllPartNames().forEach(function (n) { set[n] = 1; });
    try { psOtherExtra.forEach(function (p) { if (p && p.n) set[p.n] = 1; }); } catch (_) {}
    psTrimNames().forEach(function (n) { delete set[n]; });
    return set;
  }
  function psNotPart(n) { return !psPartNameSet()[String(n)]; }
  // Inside executeAsModal: layer l right under X, in X's group (or the top level), using
  // only "place before" moves: "place after" a group can drop l INSIDE that group (PIPING
  // ended up in BUTTON that way). Checked: l must end up in X's group.
  function kbPlaceAfterInModal(l, X) {
    const EP = psMod().constants.ElementPlacement;
    let G = null; try { G = X.parent; } catch (_) {}
    let sibs = []; try { sibs = Array.from(G ? G.layers : psMod().app.activeDocument.layers); } catch (_) {}
    let at = -1; for (let i = 0; i < sibs.length; i++) if (sibs[i].id === X.id) at = i;
    const next = at >= 0 ? sibs[at + 1] : null;
    if (next && next.id === l.id) return;                    // already there
    if (next) l.move(next, EP.PLACEBEFORE);
    else { l.move(X, EP.PLACEBEFORE); X.move(l, EP.PLACEBEFORE); }   // X is the bottom one: l above it, then X above l
    let p = null; try { p = l.parent; } catch (_) {}
    if (G && (!p || p.id !== G.id)) throw new Error(l.name + " did not land in " + G.name + " after " + X.name + ".");
  }
  function psGroupChild(g, name) {
    try { for (let i = 0; i < g.layers.length; i++) if (String(g.layers[i].name) === name && g.layers[i].layers) return g.layers[i]; } catch (_) {}
    return null;
  }
  function psPsGroup() { const l = psTopLayerNamed(PS_PS_GROUP); return l && l.layers ? l : null; }
  function psPbGroup() { const p = psPsGroup(); return p ? psGroupChild(p, PS_PB_GROUP) : null; }
  function psSdwGroup() { const p = psPsGroup(); return p ? psGroupChild(p, PS_SDW_GROUP) : null; }
  function psBackupGroup() { const p = psPsGroup(); return p ? psGroupChild(p, PS_BACKUP_GROUP) : null; }
  // Inside executeAsModal: group g (in PS, or about to go in) where the parts go: under PB
  // and SDW, above Backup. first = right under PB and SDW; else after the last part group.
  function psPlacePartsInPs(g, first) {
    const P = psPsGroup(), EP = psMod().constants.ElementPlacement;
    if (!P || !g) return;
    const up = psSdwGroup() || psPbGroup(), bk = psBackupGroup();
    const parts = first ? [] : psPsParts(P).filter(function (k) { return k.id !== g.id; }), last = parts[parts.length - 1];
    if (last) kbPlaceAfterInModal(g, last);
    else if (up) kbPlaceAfterInModal(g, up);
    else if (bk) g.move(bk, EP.PLACEBEFORE);
    else { const top = P.layers[0]; if (!top) g.move(P, EP.PLACEINSIDE); else if (top.id !== g.id) g.move(top, EP.PLACEBEFORE); }
  }
  // The part groups in PS (or in a PARTS group): groups named as a part, top → bottom.
  function psPsParts(p) {
    const out = [], set = psPartNameSet();
    try { for (let i = 0; i < p.layers.length; i++) { const l = p.layers[i]; if (l.layers && set[String(l.name)] && !psIsBackupPrint(l.name)) out.push(l); } } catch (_) {}
    return out;
  }
  // A trim group (or BUTTON THREAD) by name: in PB, else at the top level (older files).
  function psTrimGroupNamed(name) {
    const b = psPbGroup();
    if (b) { try { for (let i = 0; i < b.layers.length; i++) if (String(b.layers[i].name) === name) return b.layers[i]; } catch (_) {} }
    return psTopLayerNamed(name);
  }
  function psAccepted(l) { return !!(l && !psIsPending(l.id)); }
  // The PARTS folder: in PS, under PB and SDW (the team's file), else at the top level (a
  // v0.19 file). Every part group lives in it; Find parts, Redo and Discard touch only what
  // is inside it.
  function psPartsFolder() {
    const p = psPsGroup(), f = p ? psGroupChild(p, PS_PARTS_GROUP) : null;
    if (f) return f;
    const t = psTopLayerNamed(PS_PARTS_GROUP);
    return t && t.layers ? t : null;
  }
  // Every part group: in PARTS, plus a v0.20.0 file's part groups loose in PS (until the
  // layout fix gathers them into PARTS).
  function psPartGroupsAll() {
    const f = psPartsFolder(), P = psPsGroup();
    return (f ? psPsParts(f) : []).concat(P ? psPsParts(P) : []);
  }
  // Step 6 is done: an accepted part group.
  function psPartsAccepted() { return psPartGroupsAll().some(function (g) { return !psIsPending(g.id); }); }
  // What holds the part groups: PARTS, else (a v0.20.0 file) PS with part groups loose in it.
  function psPartsGroup() {
    const f = psPartsFolder();
    if (f && psPsParts(f).length) return f;
    const p = psPsGroup();
    return p && psPsParts(p).length ? p : null;
  }
  // What to hide, show or delete as "the parts": the part groups only.
  function psPartsHideables() { const pg = psPartsGroup(); return pg ? psPsParts(pg) : []; }
  function psPartGroup(name) {
    const pg = psPartsGroup();
    if (!pg || psNotPart(name)) return null;
    try { for (let i = 0; i < pg.layers.length; i++) if (String(pg.layers[i].name) === name && pg.layers[i].layers) return pg.layers[i]; } catch (_) {}
    return null;
  }
  function psShapeLayer(name) {
    const g = psPartGroup(name);
    if (!g) return null;
    try { for (let i = 0; i < g.layers.length; i++) if (String(g.layers[i].name) === name + " shape") return g.layers[i]; } catch (_) {}
    return null;
  }
  function psAllShapeLayers() {
    const pg = psPartsGroup(), out = [];
    if (!pg) return out;
    try {
      const kids = psPsParts(pg);                    // the part groups only: never PB, SDW or Backup
      for (let i = 0; i < kids.length; i++) {
        const g = kids[i];
        for (let j = 0; j < g.layers.length; j++) if (/ shape$/.test(String(g.layers[j].name))) out.push(g.layers[j]);
      }
    } catch (_) {}
    return out;
  }
  function psGreyExactLayer() {
    const l = kbFindLayers(PS_EXACT_LAYER).filter(function (x) { return String(x.name) === PS_EXACT_LAYER; });
    return l.length ? l[0] : null;
  }
  // Every GREY exact (exact name), oldest → newest (Photoshop layer ids only grow).
  function psGreyExactLayers() {
    return kbFindLayers(PS_EXACT_LAYER).filter(function (x) { return String(x.name) === PS_EXACT_LAYER; })
      .sort(function (a, b) { return a.id - b.id; });
  }
  // Only one GREY exact: keep keepId (else the newest), delete the others (unlocked first).
  async function psGreyExactKeepOne(keepId) {
    const all = psGreyExactLayers();
    if (all.length < 2) return 0;
    const keep = keepId != null && all.some(function (l) { return l.id === keepId; }) ? keepId : all[all.length - 1].id;
    const ids = all.filter(function (l) { return l.id !== keep; }).map(function (l) { return l.id; });
    await deleteLayersById(ids);
    trace("ps gray: kept " + PS_EXACT_LAYER + " " + keep + ", deleted " + ids.join(", "));
    return ids.length;
  }
  // The photo under the gray (for edge refine): the step 2 photo if still
  // there, else the first visible ordinary top-level layer below GREY exact.
  function psPartsPhotoLayerId() {
    if (psPhotoLayerId != null && kbLayerById(psPhotoLayerId)) return psPhotoLayerId;
    try {
      const top = psMod().app.activeDocument.layers;
      let seen = false;
      for (let i = 0; i < top.length; i++) {
        const l = top[i], n = String(l.name || "");
        if (n === PS_EXACT_LAYER) { seen = true; continue; }
        if (!seen || l.layers || l.visible === false) continue;
        if (n.indexOf(PS_GREY_NAME) === 0 || n.indexOf("KB") === 0 || n.indexOf("kb_") === 0) continue;
        return l.id;
      }
    } catch (_) {}
    return kbGarmentSourceLayer();
  }

  // Inside executeAsModal: delete one layer (or group) by id, like deleteLayersById.
  async function psDeleteLayerInModal(id) { await kbDeleteLayerSafeInModal(id); }

  // Inside executeAsModal: a new layer above the ACTIVE one, named "<name> shape",
  // flat mid gray where channel "KBPS part <name>" is (mask applied → pixels).
  // No channel → an empty layer. Returns its id.
  async function psMakeShapeInModal(name, visible) {
    const ps = psMod();
    const ch = PS_PART_CH + name;
    try { await deselectAll(); } catch (_) {}
    try { await selectRGBChannel(); } catch (_) {}
    await ps.action.batchPlay(
      [{ _obj: "make", _target: [{ _ref: "layer" }], using: { _obj: "layer", name: name + " shape" },
         _options: { dialogOptions: "dontDisplay" } }],
      { synchronousExecution: true });
    const id = kbActiveLayerId();
    if (kbChannelExists(ch)) {
      await kbFillActiveLayer(PS_SHAPE_GRAY);
      await kbLoadChannel(ch);
      await kbSelectLayerById(id);
      await addLayerMaskRevealSelection();
      try { await deselectAll(); } catch (_) {}
      try { await kbDeleteMaskInModal(id, true, name + " shape"); }
      catch (e) { traceErr("ps shape " + name + ": apply mask (kept as a mask)", e); }
      try { await selectRGBChannel(); } catch (_) {}
    }
    try { await renameActiveLayer(name + " shape"); } catch (_) {}
    try { const l = kbLayerById(id); if (l) l.visible = !!visible; } catch (_) {}
    return id;
  }

  // Inside executeAsModal: wrap the given layers in a new group named `name`.
  async function psGroupInModal(ids, name) {
    const ps = psMod();
    const doc = ps.app.activeDocument;
    const layers = ids.map(kbLayerById).filter(Boolean);
    let g = null;
    try { if (typeof doc.groupLayers === "function") g = await doc.groupLayers(layers); }
    catch (e) { traceErr("ps groupLayers " + name + " (trying batchPlay)", e); g = null; }
    if (g) { try { g.name = name; } catch (_) {} return g.id; }
    for (let i = 0; i < ids.length; i++) {
      const d = { _obj: "select", _target: [{ _ref: "layer", _id: ids[i] }], makeVisible: false, _options: { dialogOptions: "dontDisplay" } };
      if (i) d.selectionModifier = { _enum: "selectionModifierType", _value: "addToSelection" };
      await ps.action.batchPlay([d], { synchronousExecution: true });
    }
    await ps.action.batchPlay(
      [{ _obj: "make", _target: [{ _ref: "layerSection" }], from: { _ref: "layer", _enum: "ordinal", _value: "targetEnum" },
         _options: { dialogOptions: "dontDisplay" } }],
      { synchronousExecution: true });
    try { await renameActiveLayer(name); } catch (_) {}
    return kbActiveLayerId();
  }

  // Inside executeAsModal: redraw "<name> shape" from its channel, in place
  // (same group, same visibility). Creates the group inside PARTS if missing.
  async function psRedrawShapeInModal(name) {
    const old = psShapeLayer(name);
    if (old) {
      let vis = false; try { vis = old.visible; } catch (_) {}
      const oldId = old.id;
      await kbSelectLayerById(oldId);
      await psMakeShapeInModal(name, vis);           // new layer lands just above the old one, same group
      await psDeleteLayerInModal(oldId);
      return;
    }
    const pg = psPartsGroup();
    if (!pg) throw new Error("there is no PARTS group. Click Find parts first.");
    const ps = psMod();
    const first = psPsParts(pg)[0] || (pg.layers && pg.layers[0]);   // a part group, never PB above it
    if (first) await kbSelectLayerById(first.id);
    const sid = await psMakeShapeInModal(name, false);
    const gid = await psGroupInModal([sid], name);
    try {                                             // make sure it sits inside PARTS
      const g = kbLayerById(gid);
      if (g && (!g.parent || g.parent.id !== pg.id) && ps.constants && ps.constants.ElementPlacement) {
        g.move(pg, ps.constants.ElementPlacement.PLACEINSIDE);
      }
    } catch (e) { traceErr("ps move group " + name + " into PARTS", e); }
    try {                                             // in the team's order: above the next part of the type's list
      const g = kbLayerById(gid), EP = ps.constants && ps.constants.ElementPlacement, t = psGtypeById(psGarmentType);
      if (g && EP && t) {
        const team = psWithLeftNeck(psGtypeParts(t).map(function (p) { return p.n; }), true);
        const at = team.indexOf(name);
        let next = null;
        for (let j = at + 1; at >= 0 && j < team.length && !next; j++) { const o = psPartGroup(team[j]); if (o && o.id !== gid) next = o; }
        if (next) g.move(next, EP.PLACEBEFORE);
        else if (String(pg.name) === PS_PS_GROUP) psPlacePartsInPs(g, false);   // after the last part group, above Backup
        else { const kids = psPsParts(pg).filter(function (k) { return k.id !== gid; }), last = kids[kids.length - 1]; if (last) kbPlaceAfterInModal(g, last); }
      }
    } catch (e) { traceErr("ps order group " + name + " in PARTS", e); }
  }

  // ----- Panel ---------------------------------------------------------------------
  // LEFT NECK only exists when the back neck came in two pieces; it sits after RIGHT NECK.
  function psWithLeftNeck(list, has) {
    if (!has) return list.slice();
    const out = []; for (let i = 0; i < list.length; i++) { out.push(list[i]); if (list[i] === "RIGHT NECK") out.push("LEFT NECK"); }
    return out;
  }
  // the names in the document's PARTS group (any garment type), in panel order;
  // before Find parts, the picked type's list.
  function psPartNames() {
    const pg = psPartsGroup(), out = [];
    if (pg) psPsParts(pg).forEach(function (g) { out.push(String(g.name)); });
    if (out.length) return out;
    const t = psGtypeById(psGarmentType);
    return t ? psGtypeParts(t).map(function (p) { return p.n; }) : psWithLeftNeck(PS_PART_ORDER, false);
  }
  // Step 6's ONE parts list. Before Find parts: the type's parts with a checkbox each (the
  // ones to find). After: two groups —
  //   Parts found (N): checkbox · name; the name selects the part (a .pill in
  //     pills-ps-parts, so every picker and the Layers link work as before); unchecking
  //     moves it to the second group (steps 7 to 9 skip it).
  //   In this style, not in this photo (N): the name in gray and "+ Add" (checks it, selects
  //     it and asks for a selection; + Add then builds its group in team order).
  function psPartsRefreshList() {
    const g = $("pills-ps-parts");
    const has = !!psPartsGroup();
    const t = psGtypeById(psGarmentType);
    if (has && t) psCheckedFromDoc(t);
    const empty = $("ps-parts-empty");
    if (empty) empty.classList.toggle("hidden", has);
    const tools = $("ps-parts-tools");
    if (tools) tools.classList.toggle("hidden", !has);
    const cost = $("ps-parts-cost");
    if (cost) cost.textContent = psPartsCostText();
    const cl = $("ps-part-checklist");
    if (cl) cl.classList.toggle("hidden", !t || has);          // before Find parts only
    if (!g) return;
    const oldSel = g.querySelector(".pill.selected");
    const keep = oldSel ? oldSel.getAttribute("data-value") : null;
    while (g.firstChild) g.removeChild(g.firstChild);
    if (!has) { psUpdateShapesLink(); return; }
    const checked = t ? psCheckedFor(t) : null;
    const inDoc = psPartNames();
    const team = t ? psWithLeftNeck(psGtypeParts(t).map(function (p) { return p.n; }), inDoc.indexOf("LEFT NECK") >= 0) : inDoc;
    // the document's PARTS order, then parts added back with + Add that have no group yet
    const foundNames = inDoc.filter(function (n) { return !checked || checked.has(n) || team.indexOf(n) < 0; })
      .concat(team.filter(function (n) { return checked && checked.has(n) && inDoc.indexOf(n) < 0; }));
    const outNames = checked ? team.filter(function (n) { return !checked.has(n); }) : [];
    const head = function (text) { const h = document.createElement("div"); h.className = "ps-parts-head"; h.textContent = text; g.appendChild(h); };
    head("Parts found (" + foundNames.length + ")");
    foundNames.forEach(function (n) {
      const row = document.createElement("div");
      row.className = "pill ps-part-row" + (n === keep ? " selected" : "");
      row.setAttribute("role", "button"); row.setAttribute("tabindex", "0"); row.setAttribute("data-value", n);
      const box = document.createElement("span");
      box.className = "ps-check-box"; box.textContent = "✓";
      if (t && n !== PS_UNASSIGNED && team.indexOf(n) >= 0) { box.setAttribute("data-action", "ps-part-check"); box.setAttribute("data-part", n); box.setAttribute("role", "button"); }
      else box.classList.add("ps-check-fixed");
      const nm = document.createElement("span"); nm.className = "ps-part-name"; nm.textContent = n;
      row.appendChild(box); row.appendChild(nm);
      if (!kbChannelExists(PS_PART_CH + n)) { const st = document.createElement("span"); st.className = "ps-part-state ps-part-muted"; st.textContent = "select it, then + Add"; row.appendChild(st); }
      g.appendChild(row);
    });
    if (outNames.length) {
      head("In this style, not in this photo (" + outNames.length + ")");
      outNames.forEach(function (n) {
        const row = document.createElement("div"); row.className = "ps-part-out";
        const nm = document.createElement("span"); nm.className = "ps-part-name ps-part-muted"; nm.textContent = n;
        const add = document.createElement("span"); add.className = "text-link ps-part-add"; add.setAttribute("role", "button"); add.setAttribute("tabindex", "0");
        add.setAttribute("data-action", "ps-part-add"); add.setAttribute("data-part", n); add.textContent = "+ Add";
        row.appendChild(nm); row.appendChild(add);
        g.appendChild(row);
      });
    }
    psUpdateShapesLink();
    try { psPartPickersRender(readPills("pills-ps-parts", null)); } catch (_) {}   // step 7 pickers list the same parts
  }
  // After Find parts (or a panel reload): the checked parts are the ones with a shape,
  // unless the retoucher changed the list since (psCheckedBy).
  const psCheckedBy = {};
  function psCheckedFromDoc(t) {
    if (psCheckedBy[t.id]) return;
    const inDoc = psPartNames(), c = psCheckedFor(t);
    psGtypeParts(t).forEach(function (p) { if (inDoc.indexOf(p.n) >= 0 || kbChannelExists(PS_PART_CH + p.n)) c.add(p.n); else c.delete(p.n); });
    psCheckedBy[t.id] = "doc";
  }
  // "+ Add" on a part not in this photo: back in Parts found, checked and selected.
  async function actPsPartAdd(srcEl) {
    const name = srcEl && srcEl.getAttribute && srcEl.getAttribute("data-part");
    const t = psGtypeById(psGarmentType);
    if (!name || !t) return;
    psCheckedFor(t).add(name); psCheckedBy[t.id] = "you";
    psPartsRefreshList();
    psSetPartPill(name);
    try { await psOnPartPicked(name); } catch (_) {}      // (it says what is selected: the + Add line comes after)
    try { await psPrintOnPartPicked(name); } catch (_) {}
    setStatus("ok", "Select " + name + " on the photo, then click + Add.");
  }
  function psUpdateShapesLink() {
    const a = $("ps-shapes-link");
    if (!a) return;
    const shown = psAllShapeLayers().some(function (l) { try { return l.visible; } catch (_) { return false; } });
    a.textContent = shown ? "Hide shapes" : "Show shapes";
  }
  function psPartsOnTabOpen() { try { psGtypeRender(); psPartsRefreshList(); } catch (_) {} }

  // the garment type picker, in step 2. Steps 3 (prompt), 4 (trims) and
  // 6 (parts) read it. Stored in the document with the print settings, so it
  // follows the document and survives a panel reload.
  function psGtypeShort(t) { if (t && t.id === PS_OTHER_ID) return "Other"; return t ? t.id + " " + String(t.label).replace(/^[A-Z] · /, "").split(",")[0] : ""; }   // "B Nightgown"
  let psGtypeDocId = null;
  let psGtypeMissing = false;                         // Print Swap layers in the document but no saved type
  // Does the active document already hold Print Swap work (a KBPS channel or a plug-in layer)?
  function psDocHasPrintSwap() {
    try {
      const d = psMod().app.activeDocument; if (!d) return false;
      const cs = d.channels; for (let i = 0; i < cs.length; i++) if (String(cs[i].name).indexOf("KBPS") === 0) return true;
      const t = d.layers; for (let i = 0; i < t.length; i++) if (psIsPrintSwapLayerName(String(t[i].name))) return true;
    } catch (_) {}
    return false;
  }
  function psGtypeFollowDoc() {
    let id = null;
    try { const d = psMod().app.activeDocument; id = d ? d.id : null; } catch (_) {}
    if (id === psGtypeDocId) return;
    psGtypeDocId = id; psGarmentType = null; psGtypePendingChange = null; psDocType = null; psOtherExtra = []; psGtypeMissing = false;
    psUpDoc = { docId: id, v: null, info: null };          // step 0 is read from the document below
    try { psGrayFromDocState(id, null); } catch (_) {}     // so is the target gray
    psStaleSteps = []; psStaleDocId = id;                  // out-of-date steps belong to the document too
    try { psPipingModeReset(); } catch (_) {}              // a new document's piping mode is picked again
    try { psNeuFieldsFill(true); } catch (_) {}            // and its Edge ring / Min line length are its own auto values
    psTone = psToneBlank();
    try { psToneFaceSync(); } catch (_) {}
    psTrimColors = {}; psTrimLink = false; psTrimColorDocId = id;   // trim colors and the BUTTON link are the document's (below)
    psPartScaleTyped = null;                                // a This part scale typed on another document
    try { psBackupNote(""); } catch (_) {}                  // "Backup not made" was the other document's
    psGtypeRender();
    if (id == null) return;
    setTimeout(function () { psShadeTidy(id).catch(function () {}); }, 400);   // extra veils from older runs
    setTimeout(function () { psPbTidy(id).catch(function () {}); }, 600);      // trims nested in another trim group
    setTimeout(function () { psBackupTidy(id).catch(function () {}); }, 800);  // PRINT source / tiled outside Backup
    // Read from THIS document's own metadata only. The plug-in's fallback file is keyed
    // by document title, so a type from another document with the same name never
    // comes back; a new document starts with no type.
    psGtypeFromDoc().then(function (got) {
      const g = got && got.id;
      let now = null;
      try { const d = psMod().app.activeDocument; now = d ? d.id : null; } catch (_) {}
      if (psGtypeDocId !== id || now !== id) return;
      if (got && (got.upscale === "done" || got.upscale === "skipped" || got.upscale === "kept")) { psUpDoc = { docId: id, v: got.upscale, info: got.upInfo || null }; try { psStepsRefresh(); } catch (_) {} }
      if (got) { try { psGrayFromDocState(id, got); } catch (_) {} }
      if (got && got.piping) { try { psPipingStateApply(got.piping); } catch (e) { traceErr("ps piping: settings from the document", e); } }
      if (got && (got.trimColors || got.trimLink) && psTrimColorDocId === id) { psTrimColors = Object.assign({}, got.trimColors || {}); psTrimLink = !!got.trimLink; try { psTrimColorRender(); } catch (_) {} }
      if (got && Array.isArray(got.stale) && psStaleDocId === id) {
        psStaleSteps = got.stale.filter(function (n) { return n >= 3 && n <= PS_STEP_COUNT; });
        try { psStepsRefresh(); } catch (_) {}
      }
      if (psGarmentType) return;
      // Other, or a saved type this computer's file does not have: the document's own copy.
      if (g && got.def && psValidType(got.def) && got.def.id === g && !psCustomTypes.some(function (t) { return t.id === g; })) psDocType = got.def;
      if (g && psGtypeById(g)) {
        psGarmentType = g;
        try { trace("ps: garment type from the document → " + g); } catch (_) {}
        psGtypeRender();
        try { psStepsRefresh(); } catch (_) {}
        return;
      }
      psGtypeNoneSaved(id);
    }).catch(function (e) { try { traceErr("ps: read garment type from the document", e); } catch (_) {} psGtypeNoneSaved(id); });
  }
  // No type saved but Print Swap work in the file: ask for it again (picking it resets nothing).
  function psGtypeNoneSaved(id) {
    if (psGtypeDocId !== id || psGarmentType || !psDocHasPrintSwap()) return;
    psGtypeMissing = true;
    try { trace("ps: no garment type saved in this document"); } catch (_) {}
    psGtypeRender();
    try { psStepsRefresh(); } catch (_) {}
  }
  async function psGtypeFromDoc() {
    const f = psXmpStateFind(await psXmpGet());
    if (!f) return null;
    const s = JSON.parse(f.json);
    return s ? { id: s.gtype || null, def: s.gtypeDef || null, stale: s.garmentStale || [], upscale: s.upscale || null, upInfo: s.upInfo || null, gray: s.gray || null, grayMade: s.grayMade || null,
      trimColors: s.trimColors || null, piping: s.piping || null } : null;
  }
  async function psGtypeSave(id) {
    try {
      const s = await psStateLoad(); s.gtype = id;
      const t = psGtypeById(id);
      if (t && t.custom) s.gtypeDef = t; else delete s.gtypeDef;   // Other / I, J …: the definition goes with the document
      await psStateSave(s);
    }
    catch (e) { traceErr("ps: save garment type", e); }
  }
  function psGtypeRender() {
    const t = psGtypeById(psGarmentType);
    ["2"].forEach(function (w) {
      const v = $("dd-psgtype" + w + "-value");
      if (v) v.textContent = t ? t.label : "Pick a garment type…";
      const menu = $("dd-psgtype" + w + "-menu");
      const opts = PS_GTYPES.concat(psCustomTypes, [{ id: PS_OTHER_ID, label: "Other…" }]);
      const sig = opts.map(function (o) { return o.id + o.label; }).join("|");
      if (menu && menu.getAttribute("data-sig") !== sig) {
        while (menu.firstChild) menu.removeChild(menu.firstChild);
        menu.setAttribute("data-sig", sig);
        opts.forEach(function (gt) {
          const o = document.createElement("div");
          o.className = "dd-option"; o.setAttribute("role", "option"); o.setAttribute("tabindex", "0");
          o.setAttribute("data-dd-group", "psgtype"); o.setAttribute("data-dd-value", gt.id);
          o.textContent = gt.label;
          menu.appendChild(o);
        });
      }
      if (menu) { const os = menu.querySelectorAll(".dd-option"); for (let i = 0; i < os.length; i++) os[i].classList.toggle("selected", os[i].getAttribute("data-dd-value") === psGarmentType); }
    });
    const list = $("ps-part-checklist");
    if (list) {
      while (list.firstChild) list.removeChild(list.firstChild);
      list.classList.toggle("hidden", !t || !!psPartsGroup());      // before Find parts; after it, the grouped list
      if (t) {
        const checked = psCheckedFor(t);
        const hd = document.createElement("div"); hd.className = "ps-parts-head"; hd.textContent = "Parts to find (" + checked.size + ")";
        list.appendChild(hd);
        psGtypeParts(t).forEach(function (p) {
          const row = document.createElement("div");
          row.className = "ps-check" + (checked.has(p.n) ? " on" : "");
          row.setAttribute("role", "button"); row.setAttribute("tabindex", "0");
          row.setAttribute("data-action", "ps-part-check"); row.setAttribute("data-part", p.n);
          const box = document.createElement("span"); box.className = "ps-check-box"; box.textContent = checked.has(p.n) ? "✓" : "";
          const nm = document.createElement("span"); nm.className = "ps-check-name"; nm.textContent = p.n;
          row.appendChild(box); row.appendChild(nm);
          list.appendChild(row);
        });
      }
    }
    try { psOtherRender(); } catch (_) {}
    const tr = $("ps-gtype-trims");
    if (tr) tr.textContent = t ? "Trims (step 4, kept on top, never printed): " + t.trims.join(", ") + "." : "";
    const g6 = $("ps-gtype6");
    if (g6) g6.textContent = t ? "Garment type: " + t.label + " (set in step 2)." : "Pick the garment type in step 2 first.";
    const btn = $("ps-parts-btn");
    if (btn) btn.classList.toggle("disabled", !t || !psCheckedFor(t).size);
    const fb = $("ps-find-btn");
    if (fb) fb.classList.toggle("disabled", !t);
    const cost = $("ps-parts-cost");
    if (cost) cost.textContent = psPartsCostText();
    const cf = $("ps-gtype-confirm");
    if (cf) cf.classList.toggle("hidden", !psGtypePendingChange);
    const gm = $("ps-gtype-missing");
    if (gm) gm.classList.toggle("hidden", !(psGtypeMissing && !t));
    try { psTrimsRender(); } catch (_) {}
    try { psPartsRefreshList(); } catch (_) {}            // the parts list splits by this type
  }
  // What a type change after step 2 deletes (steps 3–9): plug-in layers by their exact
  // names at the top of the stack, and the trim and part channels. KBPS garment stays.
  function psGtypeResetTargets() {
    const names = [PS_CLEAN_NAME, PS_EXACT_LAYER, PS_PARTS_GROUP, PS_SHADE_GROUP, PS_VEIL_NAME, PS_MERGED_NAME, PS_MERGED_GROUP, PS_HAIR_NAME, PS_THREAD_NAME]
      .concat(Object.keys(PS_TRIM_KINDS).map(function (k) { return PS_TRIM_KINDS[k].group; }));
    const layers = [];
    const add = function (l) { if (l && !layers.some(function (x) { return x.id === l.id; })) layers.push(l); };
    add(psPsGroup());                                       // PS whole (PB, SDW, the parts, Backup)
    names.forEach(function (n) { add(psTopLayerNamed(n)); });   // and the top-level layers (older files too)
    const chans = Object.keys(PS_TRIM_KINDS).map(function (k) { return PS_TRIM_KINDS[k].ch; })
      .concat([PS_THREAD_CH], psAllPartNames().map(function (n) { return PS_PART_CH + n; }))
      .reduce(function (a, c) { return a.concat([c, psRawName(c)]); }, [])          // + the edge-softness base copies
      .filter(function (c) { return kbChannelExists(c); });
    return { layers: layers, chans: chans };
  }
  let psGtypePendingChange = null;                   // { id, targets } while the confirm box is up
  function psSetGarmentType(id) {
    try { psGtypeFollowDoc(); } catch (_) {}
    if (id === PS_OTHER_ID && !(psDocType && psDocType.id === PS_OTHER_ID)) psDocType = psTypeFromParts(PS_OTHER_ID, null, [], []);
    const nt = psGtypeById(id);
    if (!nt || id === psGarmentType) { psGtypePendingChange = null; psGtypeRender(); return; }
    if (generateInFlight) { setStatus("bad", "Wait for the current step to finish, then change the type."); psGtypeRender(); return; }
    if (psGtypeMissing) { psGtypeMissing = false; psGtypeApply(id); return; }   // the type was lost, not changed: nothing is reset
    const after2 = !!psGarmentType && kbChannelExists(PS_GARMENT_CH);
    const tg = after2 ? psGtypeResetTargets() : { layers: [], chans: [] };
    if (tg.layers.length || tg.chans.length) {
      if (pendingRecall && pendingRecall.descriptor && String(pendingRecall.descriptor.op).indexOf("printswap:") === 0) {
        setStatus("bad", "Accept or Re-run the preview that is waiting first, then change the type."); psGtypeRender(); return;
      }
      psGtypePendingChange = { id: id, targets: tg };
      const txt = $("ps-gtype-confirm-text");
      if (txt) txt.textContent = "Change to " + psGtypeShort(nt) + " and delete steps 3–9 (" + psCountText(tg.layers.length, tg.chans.length) + ")? The garment (step 2) stays.";
      psConfirmDetails("ps-gtype-details", "Changing to " + psGtypeShort(nt) + " resets steps 3–9. It deletes "
        + tg.layers.map(function (l) { return l.name; }).join(", ") + (tg.layers.length && tg.chans.length ? " and " : "")
        + (tg.chans.length ? tg.chans.length + " trim / part channel" + (tg.chans.length === 1 ? "" : "s") + " (" + tg.chans.join(", ") + ")" : "") + ". The garment (step 2) stays.");
      setStatus("ask", "Changing the garment type resets steps 3–9. Confirm under the type in step 2.");
      psGtypeRender();
      return;
    }
    psGtypeApply(id);
  }
  function psGtypeApply(id) {
    psGarmentType = id;
    psGtypePendingChange = null;
    try { console.log(TAG, "print swap garment type →", id); } catch (_) {}
    try { trace("ps: garment type → " + id); } catch (_) {}
    psGtypeRender();
    try { psStepsRefresh(); } catch (_) {}
    if (psMod().app.activeDocument) psGtypeSave(id);
    setStatus("ok", "Garment type: " + psGtypeById(id).label + ".");
  }
  async function actPsGtypeConfirm() {
    const pc = psGtypePendingChange;
    if (!pc) return;
    if (generateInFlight) { kbBusyNote(); return; }
    const tg = psGtypeResetTargets();             // read again: the document may have changed
    generateInFlight = true;
    traceStart("Print Swap — garment type " + psGarmentType + " → " + pc.id + " (reset steps 3–9)");
    try {
      if (tg.layers.length) await deleteLayersById(tg.layers.map(function (l) { return l.id; }));
      if (tg.chans.length) await psMod().core.executeAsModal(async function () { for (let i = 0; i < tg.chans.length; i++) { try { await kbRemoveChannels(tg.chans[i]); } catch (_) {} } }, { commandName: "KBImage — reset Print Swap steps 3–9" });
      trace("ps: reset deleted layers [" + tg.layers.map(function (l) { return l.name; }).join(", ") + "], channels [" + tg.chans.join(", ") + "]");
      generateInFlight = false;
      psGtypeApply(pc.id);
      setStatus("ok", "Garment type: " + psGtypeById(pc.id).label + ". Steps 3–9 were reset; run Remove print again.");
    } catch (err) {
      traceErr("ps gtype reset", err);
      setStatus("bad", "Resetting steps 3–9 failed: " + ((err && err.message) || String(err)));
    } finally {
      generateInFlight = false;
      psGtypePendingChange = null;
      try { psGtypeRender(); psStepsRefresh(); psPartsRefreshList(); updateDocInfo(); } catch (_) {}
      await traceFlush();
    }
  }
  // START OVER and REDO. Each step's own layers (top level, the plug-in's
  // exact names) and KBPS channels. Redo step n deletes steps n..9; Start over deletes
  // every Print Swap layer and KBPS channel and the document's garment type. The
  // original photo and the designer's own layers stay.
  function psStepOwn(n) {
    const trimGroups = Object.keys(PS_TRIM_KINDS).map(function (k) { return PS_TRIM_KINDS[k].group; });
    const trimChs = Object.keys(PS_TRIM_KINDS).map(function (k) { return PS_TRIM_KINDS[k].ch; });
    switch (n) {
      case 1: return { layers: [PS_BG_NAME, PS_MODEL_NAME, PS_WHITE_NAME], chans: [PS_PERSON_CH, PS_HAIR_CH] };
      case 2: return { layers: [], chans: [PS_GARMENT_CH, PS_HANDS_CH] };
      case 3: return { layers: [PS_CLEAN_NAME], chans: [] };
      case 4: return { layers: trimGroups.concat([PS_THREAD_NAME]), inPs: function () { return [psPbGroup()]; }, chans: trimChs.concat([PS_THREAD_CH]) };   // older files: top-level trims
      case 5: return { layers: [PS_EXACT_LAYER], chans: [] };
      case 6: return { layers: [], parts: true, chans: psAllPartNames().map(function (nm) { return PS_PART_CH + nm; }) };   // the part groups only: PARTS stays
      case 7: return { layers: [], inPs: function () { return [psBackupGroup()]; }, chans: [], prints: true };
      case 8: return { layers: [PS_SHADE_GROUP].concat(PS_SHADE_NAMES), inPs: function () { return [psSdwGroup()]; }, chans: [] };   // SDW; older files: GREY, GREY copy 3 and strays
      default: return { layers: [PS_MERGED_NAME, PS_MERGED_GROUP, PS_HAIR_NAME], chans: [] };
    }
  }
  // What a reset from step `from` deletes, read from the document now.
  //   all = true: Start over — every channel starting "KBPS" too.
  function psResetTargets(from, all) {
    const layers = [], names = [], chans = [];
    let prints = false;
    let top = [];
    try { top = Array.from(psMod().app.activeDocument.layers); } catch (_) {}
    // A step's own layers at the top level (by their names: older files too) and in PS (by
    // the PS helpers). From step 4 on, PS goes whole.
    const P = psPsGroup();
    const add = function (l) { if (l && !layers.some(function (x) { return x.id === l.id; })) layers.push(l); };
    if (P && from <= 4) add(P);
    for (let n = from; n <= PS_STEP_COUNT; n++) {
      const own = psStepOwn(n);
      own.layers.forEach(function (nm) {
        top.forEach(function (l) { if (String(l.name) === nm && !(P && l.id === P.id)) add(l); });
      });
      if (own.inPs && P && from > 4) own.inPs().forEach(add);
      if (own.parts) psPartGroupsAll().forEach(add);
      own.chans.forEach(function (c) { [c, psRawName(c)].forEach(function (x) { if (chans.indexOf(x) < 0 && kbChannelExists(x)) chans.push(x); }); });
      if (own.prints) prints = true;
    }
    if (all) {
      const vp = psTopLayerNamed(PS_PARTS_GROUP); if (vp && vp.layers) add(vp);   // a v0.19 file's top-level PARTS
      // leftovers from earlier versions and interrupted runs: temp layers (kb_ / KBPS_tmp)
      top.forEach(function (l) { const n = String(l.name); if (n.indexOf("kb_") === 0 || n.indexOf("KBPS_tmp") === 0) add(l); });
      try {
        const cs = psMod().app.activeDocument.channels;
        for (let i = 0; i < cs.length; i++) { const c = String(cs[i].name); if (c.indexOf("KBPS") === 0 && chans.indexOf(c) < 0) chans.push(c); }
      } catch (_) {}
    }
    const printIds = [];
    if (prints && from > 6) {                               // the parts stay: only their prints go
      psPartNames().forEach(function (nm) { psPrintIds(nm).forEach(function (id) { printIds.push(id); }); });
    }
    layers.forEach(function (l) { names.push(String(l.name)); });
    if (printIds.length) names.push(printIds.length + " PRINT layer" + (printIds.length === 1 ? "" : "s"));
    return { from: from, all: !!all, layerIds: layers.map(function (l) { return l.id; }).concat(printIds), names: names, chans: chans };
  }
  function psPendingPsPreview() {
    return !!(pendingRecall && pendingRecall.descriptor && String(pendingRecall.descriptor.op).indexOf("printswap:") === 0);
  }
  let psResetPending = null;                          // { from, all } while the confirm box is up
  function psResetText(tg) {
    const gt = psGtypeById(psGarmentType);
    const parts = [];
    if (tg.names.length) parts.push(tg.names.join(", "));
    if (tg.chans.length) parts.push(tg.chans.length + " KBPS channel" + (tg.chans.length === 1 ? "" : "s") + " (" + tg.chans.join(", ") + ")");
    if (psPendingPsPreview()) parts.push("the preview that is waiting");
    if (tg.all && gt) parts.push("the garment type " + psGtypeShort(gt) + " for this document");
    const what = parts.length ? parts.join("; ") : "nothing (no Print Swap layers or channels are left)";
    return (tg.all ? "Start over deletes: " : "Redo step " + tg.from + " deletes: ") + what + "."
      + (tg.all || tg.from === 1 ? " Background and your own layers stay." : " Steps 1–" + (tg.from - 1) + " stay.");
  }
  // "11 layers, 40 masks" (the masks are the KBPS channels).
  function psCountText(nl, nc) { return nl + " layer" + (nl === 1 ? "" : "s") + ", " + nc + " mask" + (nc === 1 ? "" : "s"); }
  // The confirm's one line; the full list goes under Show details.
  function psResetQuestion(tg) {
    const n = psCountText(tg.layerIds.length, tg.chans.length);
    if (tg.all) return "Delete all Print Swap layers and masks (" + n + ")? Background and your own layers stay." + (psUpscaleLayer() ? "\nUPSCALE is kept." : "");
    return "Delete step " + tg.from + (tg.from < PS_STEP_COUNT ? "–" + PS_STEP_COUNT : "") + " layers and masks (" + n + ")?"
      + (tg.from === 1 ? " Background and your own layers stay." : " Steps 1–" + (tg.from - 1) + " stay.");
  }
  // Fill a confirm's details and fold it shut (collapsed every time the confirm opens).
  function psConfirmDetails(id, text) {
    const d = $(id); if (d) { d.textContent = text; d.classList.add("hidden"); }
    const ar = $(id + "-arrow"); if (ar) ar.textContent = "▸";
  }
  // Show the confirm box under the Start over button, or under the step's header (Redo).
  function psResetAsk(from, all) {
    if (generateInFlight) { setStatus("bad", "Wait for the current step to finish."); return; }
    const box = $("ps-reset-confirm"), txt = $("ps-reset-confirm-text"), go = $("ps-reset-go");
    if (!box) return;
    const tg = psResetTargets(from, all);
    psResetPending = { from: from, all: !!all };
    if (txt) txt.textContent = psResetQuestion(tg);
    psConfirmDetails("ps-reset-details", psResetText(tg));
    if (go) go.textContent = all ? "Delete and start over" : "Delete and redo step " + from;
    const home = all ? $("ps-reset-home") : $("ps-step-" + from);
    if (home) {
      if (all) { if (box.parentNode !== home) home.appendChild(box); }
      else { const body = $("ps-step-body-" + from); home.insertBefore(box, body || null); }
    }
    box.classList.remove("hidden");
    setStatus("ask", (all ? "Start over" : "Redo step " + from) + ": confirm in the box, or Cancel.");
  }
  function actPsStartOver() { psResetAsk(1, true); }
  function actPsStepRedo(srcEl) {
    const n = Number(srcEl && srcEl.getAttribute && srcEl.getAttribute("data-step")) || 0;
    if (n) psResetAsk(n, false);
  }
  function actPsResetCancel() {
    psResetPending = null;
    const box = $("ps-reset-confirm"); if (box) box.classList.add("hidden");
    setStatus("ok", "Nothing deleted.");
  }
  async function actPsResetGo() {
    const rp = psResetPending;
    if (!rp) return;
    if (generateInFlight) { kbBusyNote(); return; }
    const box = $("ps-reset-confirm"); if (box) box.classList.add("hidden");
    psResetPending = null;
    const ps = psMod();
    if (!ps.app.activeDocument) { setStatus("bad", "Open a Photoshop document first."); return; }
    generateInFlight = true;
    kbDeleteFails = [];
    traceStart("Print Swap — " + (rp.all ? "Start over" : "Redo step " + rp.from));
    try {
      // A waiting Print Swap preview goes too (its record stays committed:false).
      if (psPendingPsPreview()) {
        const pr = pendingRecall; pendingRecall = null; hideRecallBar();
        const ids = allPreviewLayerIds(pr);
        if (ids.length) await deleteLayersById(ids);
        trace("ps reset: dropped the waiting preview " + pr.descriptor.op);
      }
      const tg = psResetTargets(rp.from, rp.all);       // read again: the document may have changed
      if (tg.layerIds.length) await deleteLayersById(tg.layerIds);
      await ps.core.executeAsModal(async function () {
        for (let i = 0; i < tg.chans.length; i++) { try { await kbRemoveChannels(tg.chans[i]); } catch (_) {} }
        // Show again what a cleared later step had hidden on a step that stays.
        if (rp.from <= 8) { const g = psGreyExactLayer(); if (g) { try { g.visible = true; } catch (_) {} } }   // Shading hid GREY exact
        if (!rp.all && rp.from <= 8) await psLayoutFixInModal();        // an older file: trims and parts into PS
        const b = psBgLayer(); if (b) { try { b.visible = true; } catch (_) {} }                                 // Finish hid BG LIGHTEN
      }, { commandName: "KBImage — Print Swap " + (rp.all ? "start over" : "redo step " + rp.from) });
      if (psBgLayer()) { const c = $("ps-bg-on"); if (c) c.checked = true; }
      trace("ps reset: deleted layers [" + tg.names.join(", ") + "], channels [" + tg.chans.join(", ") + "]");
      if (rp.all || rp.from <= 4) await psTrimColorsClear();
      psStepPaidClear(rp.all ? 0 : rp.from);               // their "done ✓ · $" totals go with them   // the trims are gone: built again, they are Original
      if (rp.all) {
        psGarmentType = null; psGtypePendingChange = null; psDocType = null; psOtherExtra = [];
        psStaleSteps = []; psGarmentSnap = null;
        const upKept = !!psUpscaleLayer(), upInfo = psUpInfo();
        psUpSet(upKept ? "kept" : null, upKept ? upInfo : null);   // step 0 can run again; UPSCALE stays
        try { psGrayFromDocState(psActiveDocId(), null); } catch (_) {}   // gray back to Mid
        try {
          const st0 = psStateEmpty();
          if (upKept) { st0.upscale = "kept"; if (upInfo) st0.upInfo = upInfo; }
          await psStateSave(st0);
        } catch (e) { traceErr("ps reset: clear saved state", e); }
        trace("ps reset: garment type and print settings cleared for this document");
      }
      generateInFlight = false;
      psStepsRefresh();
      psStepOpen(rp.all ? 0 : rp.from);
      setStatus("ok", rp.all ? (psStepState(0) === "kept" ? "Started over. UPSCALE kept (" + psUpKeptText() + "). Steps 1 to 9 reset."
          : "Started over. Step 0 (Upscale, optional) is ready: Upscale or Skip, then step 1.")
        : "Step " + rp.from + " is ready again. Steps " + rp.from + "–9 were cleared.");
      kbDeleteFailShow();                                  // in red: what stayed, and why
    } catch (err) {
      traceErr("ps reset", err);
      setStatus("bad", (rp.all ? "Start over" : "Redo") + " failed: " + ((err && err.message) || String(err)));
    } finally {
      generateInFlight = false;
      try { psGtypeRender(); psStepsRefresh(); psPartsRefreshList(); psTrimsRender(); updateDocInfo(); } catch (_) {}
      await traceFlush();
    }
  }
  function actPsGtypeCancel() {
    psGtypePendingChange = null;
    psGtypeRender();
    setStatus("ok", "Kept garment type " + psGtypeShort(psGtypeById(psGarmentType)) + ".");
  }
  function actPsPartCheck(srcEl) {
    const t = psGtypeById(psGarmentType);
    const name = srcEl && srcEl.getAttribute && srcEl.getAttribute("data-part");
    if (!t || !name) return;
    const c = psCheckedFor(t);
    if (c.has(name)) c.delete(name); else c.add(name);
    psCheckedBy[t.id] = "you";
    psGtypeRender();
    if (psPartsGroup()) {                                  // after Find parts: the row moves between the groups
      if (!c.has(name) && readPills("pills-ps-parts", null) === name) psSetPartPill(null);
      psPartsRefreshList();
      setStatus("ok", c.has(name) ? name + " is back in Parts found." : name + " moved to “not in this photo”: steps 7 to 9 skip it. + Add brings it back.");
    }
  }

  // ONE SELECTED PART, both ways. The step 6 pill is the selected part: clicking it
  // selects the part's group in the Layers panel (opened by selecting a layer inside it
  // first); selecting a part's group, PRINT or shape layer in the Layers panel makes it
  // the selected part (pill, step 7 line, This part scale and angle). Anything else
  // leaves the selected part as it is. Selects the panel makes are stamped
  // (psPanelLayerSelAt in kbSelectLayerById) and skipped, so nothing loops.
  let psPanelLayerSelAt = 0, psLayerSelTimer = null;
  // Inside executeAsModal: the part's group selected, open in the Layers panel.
  async function psSelectPartInLayersInModal(name) {
    const g = psPartGroup(name);
    if (!g) return false;
    const inner = psShapeLayer(name) || (g.layers && g.layers[0]);
    if (inner) await kbSelectLayerById(inner.id);          // Photoshop opens the group to show it
    await kbSelectLayerById(g.id);
    return true;
  }
  async function psSelectPartInLayers(name) {
    try {
      await psMod().core.executeAsModal(async function () {
        await psSelectPartInLayersInModal(name);
        const g = psPartGroup(name);                         // checked: Layers shows this part, not the last one drawn
        if (g && kbActiveLayerId() !== g.id) { await kbSelectLayerById(g.id); if (kbActiveLayerId() !== g.id) trace("ps: " + name + " could not be selected in Layers (active " + kbActiveLayerId() + ")"); }
      }, { commandName: "KBImage — select part" });
      psSetPartPill(name);
    } catch (e) { traceErr("ps: select " + name + " in Layers", e); }
  }
  // The part a layer belongs to: walk up to the child of PS (or of PARTS). null when it is not in a part.
  function psPartOfLayer(layer) {
    let l = layer, guard = 0;
    while (l && guard++ < 20) {
      const p = l.parent;
      if (!p) return null;
      if (String(p.name) === PS_PARTS_GROUP && (!p.parent || (String(p.parent.name) === PS_PS_GROUP && !p.parent.parent))) return l.layers ? String(l.name) : null;
      if (String(p.name) === PS_PS_GROUP && !p.parent) { const n = String(l.name); return l.layers && !psNotPart(n) ? n : null; }
      l = p;
    }
    return null;
  }
  // The pill shows `name` as selected (no click: nothing else runs).
  function psSetPartPill(name) {
    const g = $("pills-ps-parts");
    if (!g) return false;
    const ps = g.querySelectorAll(".pill");
    let found = false;
    for (let i = 0; i < ps.length; i++) { const on = ps[i].getAttribute("data-value") === name; ps[i].classList.toggle("selected", on); if (on) found = true; }
    return found;
  }
  function psOnLayerSelectEvent(ev, desc) {
    let t = ""; try { t = JSON.stringify((desc && desc._target) || ""); } catch (_) {}
    if (t.indexOf('"layer"') < 0) return;                                   // a layer select only
    if (generateInFlight || Date.now() - psPanelLayerSelAt < 1000) return;  // the panel's own
    if (psLayerSelTimer) clearTimeout(psLayerSelTimer);
    psLayerSelTimer = setTimeout(function () {
      psLayerSelTimer = null;
      let name = null;
      try { const al = psMod().app.activeDocument.activeLayers; if (al && al.length === 1) name = psPartOfLayer(al[0]); } catch (_) {}
      if (!name || psPartNames().indexOf(name) < 0) return;                 // not a part: the selected part stays
      if (readPills("pills-ps-parts", null) === name) return;
      if (!psSetPartPill(name)) return;
      try { psPrintRefreshPart(); } catch (_) {}
      try { trace("ps: " + name + " picked in the Layers panel"); } catch (_) {}
    }, 150);
  }
  function registerLayerSelectListener() {
    try {
      const ps = psMod();
      if (!ps.action || typeof ps.action.addNotificationListener !== "function") return;
      try { ps.action.addNotificationListener(["select"], psOnLayerSelectEvent); }
      catch (e1) { ps.action.addNotificationListener([{ event: "select" }], psOnLayerSelectEvent); }
    } catch (e) { try { console.warn(TAG, "[ps] layer select listener not registered:", e); } catch (_) {} }
  }

  // Row clicked: that part's pixels become the selection; its group is selected (and
  // opened) in the Layers panel.
  async function psOnPartPicked(name) {
    if (!name) return;
    const ps = psMod();
    if (!ps.app.activeDocument) return;
    const ch = PS_PART_CH + name;
    const has = kbChannelExists(ch);
    try {
      await ps.core.executeAsModal(async function () {
        if (has) await kbLoadChannel(ch); else { try { await deselectAll(); } catch (_) {} }
        await psSelectPartInLayersInModal(name);
      }, { commandName: "KBImage — show part" });
      setStatus("ok", has ? name + " is selected. Draw a selection, then + Add or - Remove."
                          : name + " has no pixels yet. Select it by hand, then + Add.");
    } catch (err) {
      setStatus("bad", "Could not show " + name + ": " + ((err && err.message) || String(err)));
    }
  }

  async function actPsToggleShapes() {
    const shapes = psAllShapeLayers();
    if (!shapes.length) { setStatus("bad", "There are no part shapes yet. Click Find parts first."); return; }
    const show = !shapes.some(function (l) { try { return l.visible; } catch (_) { return false; } });
    try {
      await psMod().core.executeAsModal(async function () {
        for (let i = 0; i < shapes.length; i++) { try { shapes[i].visible = show; } catch (_) {} }
      }, { commandName: show ? "KBImage — show part shapes" : "KBImage — hide part shapes" });
    } catch (_) {}
    psUpdateShapesLink();
  }

  // ----- The cut (pure pixel math on the gw × gh grid) ----------------------------
  // Center line x for each row: the placket's middle where SAM found it (gaps
  // filled from the nearest row), else a fixed x.
  function psCenterLine(placket, gw, gh, fallbackX) {
    const cx = new Float32Array(gh);
    const have = new Uint8Array(gh);
    let any = false;
    if (placket) {
      for (let y = 0; y < gh; y++) {
        let n = 0, s = 0;
        for (let x = 0, k = y * gw; x < gw; x++, k++) if (placket[k]) { n++; s += x; }
        if (n) { cx[y] = s / n; have[y] = 1; any = true; }
      }
    }
    if (!any) { for (let y = 0; y < gh; y++) cx[y] = fallbackX; return cx; }
    let last = -1;
    for (let y = 0; y < gh; y++) if (have[y]) { if (last < 0) for (let j = 0; j < y; j++) cx[j] = cx[y]; else for (let j = last + 1; j < y; j++) cx[j] = cx[last]; last = y; }
    for (let j = last + 1; j < gh; j++) cx[j] = cx[last];
    return cx;
  }
  function psCentroidX(b, gw, gh) {
    let n = 0, s = 0;
    for (let y = 0, k = 0; y < gh; y++) for (let x = 0; x < gw; x++, k++) if (b[k]) { n++; s += x; }
    return n ? s / n : null;
  }
  // Instances (boolean grids) → { left, right } by the viewer's side of `center`.
  // A piece with at least 25% on each side is cut along the line; otherwise the
  // whole piece goes to the side most of it is on.
  function psSplitSides(instances, center, gw, gh) {
    const N = gw * gh, L = new Uint8Array(N), R = new Uint8Array(N);
    for (let i = 0; i < instances.length; i++) {
      const b = instances[i];
      let nl = 0, nr = 0;
      for (let y = 0, k = 0; y < gh; y++) { const c = center[y]; for (let x = 0; x < gw; x++, k++) if (b[k]) { if (x < c) nl++; else nr++; } }
      const n = nl + nr;
      if (!n) continue;
      const cut = nl >= n * 0.25 && nr >= n * 0.25;
      for (let y = 0, k = 0; y < gh; y++) {
        const c = center[y];
        for (let x = 0; x < gw; x++, k++) {
          if (!b[k]) continue;
          if (cut ? (x < c) : (nl > nr)) L[k] = 1; else R[k] = 1;
        }
      }
    }
    return { left: L, right: R };
  }
  function psUnion(list, N) {
    const u = new Uint8Array(N);
    for (let i = 0; i < list.length; i++) { const b = list[i]; if (!b) continue; for (let k = 0; k < N; k++) if (b[k]) u[k] = 1; }
    return u;
  }
  // Rows (y) at the q-quantile of a boolean grid's pixels.
  function psRowQuantile(b, gw, gh, q) {
    const rows = new Uint32Array(gh); let n = 0;
    for (let y = 0, k = 0; y < gh; y++) for (let x = 0; x < gw; x++, k++) if (b[k]) { rows[y]++; n++; }
    if (!n) return null;
    let acc = 0;
    for (let y = 0; y < gh; y++) { acc += rows[y]; if (acc >= n * q) return y; }
    return gh - 1;
  }

  // sam: { key → [boolean instance grids] }; garment: alpha grid (0..255).
  // Returns { labels: { NAME → boolean grid }, unassigned: count }.
  function psCutParts(sam, garment, gw, gh) {
    const N = gw * gh;
    const inG = new Uint8Array(N); let gCount = 0;
    for (let k = 0; k < N; k++) if (garment[k] > 127) { inG[k] = 1; gCount++; }
    const U = function (key) { return psUnion(sam[key] || [], N); };
    const shirtArea = psUnion(["shirt", "front", "sleeve", "collar", "cuff", "cuffIn", "pocket", "pocketUp", "placket", "neck"].map(U), N);
    const pantsArea = psUnion(["pants", "leg", "hem"].map(U), N);
    const gx = psCentroidX(inG, gw, gh);
    const shirtX = psCentroidX(shirtArea, gw, gh), pantsX = psCentroidX(pantsArea, gw, gh);
    const placket = (sam.placket && sam.placket.length) ? U("placket") : null;
    const cShirt = psCenterLine(placket, gw, gh, shirtX != null ? shirtX : (gx != null ? gx : gw / 2));
    const cPants = psCenterLine(null, gw, gh, pantsX != null ? pantsX : (gx != null ? gx : gw / 2));

    const claim = {};
    const pair = function (key, leftName, rightName, center) {
      const s = psSplitSides(sam[key] || [], center, gw, gh);
      claim[leftName] = s.left; claim[rightName] = s.right;
    };
    pair("sleeve", "LEFT HAND", "RIGHT HAND", cShirt);
    pair("cuff", "LEFT HAND TRIM", "RIGHT HAND TRIM", cShirt);
    pair("collar", "LEFT COLLAR", "RIGHT COLLAR", cShirt);
    pair("front", "LEFT TOP", "RIGHT TOP", cShirt);
    pair("leg", "LEFT PANT", "RIGHT PANT", cPants);
    pair("hem", "LEFT PANT TRIM", "RIGHT PANT TRIM", cPants);
    claim["RIGHT HAND TRIM INSIDE"] = psSplitSides(sam.cuffIn || [], cShirt, gw, gh).right;   // the team has no LEFT one
    // Inside back neck: one piece = RIGHT NECK (as in the team's file); a second
    // piece on the viewer's left = LEFT NECK. Whole pieces, never cut in two.
    const necks = sam.neck || [];
    if (necks.length >= 2) {
      const NR = new Uint8Array(N), NL = new Uint8Array(N);
      for (let i = 0; i < necks.length; i++) {
        let nl = 0, nr = 0; const b = necks[i];
        for (let y = 0, k = 0; y < gh; y++) for (let x = 0; x < gw; x++, k++) if (b[k]) { if (x < cShirt[y]) nl++; else nr++; }
        const T = nl > nr ? NL : NR; for (let k = 0; k < N; k++) if (b[k]) T[k] = 1;
      }
      claim["RIGHT NECK"] = NR; claim["LEFT NECK"] = NL;
    } else claim["RIGHT NECK"] = U("neck");
    claim["POCKET"] = U("pocket");
    claim["POCKET UPPER"] = U("pocketUp");

    // Rule 1: each garment pixel once; the first name in PS_PART_PRIORITY wins.
    const names = PS_PART_ORDER.concat(["LEFT NECK", PS_UNASSIGNED]);
    const idx = {}; names.forEach(function (n, i) { idx[n] = i + 1; });
    const label = new Uint8Array(N);
    for (let p = 0; p < PS_PART_PRIORITY.length; p++) {
      const b = claim[PS_PART_PRIORITY[p]]; if (!b) continue;
      const v = idx[PS_PART_PRIORITY[p]];
      for (let k = 0; k < N; k++) if (inG[k] && !label[k] && b[k]) label[k] = v;
    }
    // Rule 2: the rest of the shirt → TOP, the rest of the pants → PANT,
    // otherwise by the waist; unclear → UNASSIGNED.
    const sb = psRowQuantile(shirtArea, gw, gh, 0.95), pt = psRowQuantile(pantsArea, gw, gh, 0.05);
    let unassigned = 0;
    for (let y = 0, k = 0; y < gh; y++) for (let x = 0; x < gw; x++, k++) {
      if (!inG[k] || label[k]) continue;
      if (shirtArea[k]) { label[k] = idx.TOP; continue; }
      if (pantsArea[k]) { label[k] = idx.PANT; continue; }
      if (sb != null && pt != null) {
        const lo = Math.min(sb, pt), hi = Math.max(sb, pt);
        if (y < lo) { label[k] = idx.TOP; continue; }
        if (y > hi) { label[k] = idx.PANT; continue; }
        if (sb < pt) { label[k] = (y <= (sb + pt) / 2) ? idx.TOP : idx.PANT; continue; }
      }
      label[k] = idx[PS_UNASSIGNED]; unassigned++;
    }
    // A few stray UNASSIGNED pixels (under 0.1% of the garment) join the part next to them.
    if (unassigned && unassigned < Math.max(30, gCount * 0.001)) {
      const u = idx[PS_UNASSIGNED];
      for (let pass = 0; pass < 30 && unassigned; pass++) {
        for (let y = 0, k = 0; y < gh; y++) for (let x = 0; x < gw; x++, k++) {
          if (label[k] !== u) continue;
          const nb = (x > 0 && label[k - 1] && label[k - 1] !== u) ? label[k - 1]
                   : (x < gw - 1 && label[k + 1] && label[k + 1] !== u) ? label[k + 1]
                   : (y > 0 && label[k - gw] && label[k - gw] !== u) ? label[k - gw]
                   : (y < gh - 1 && label[k + gw] && label[k + gw] !== u) ? label[k + gw] : 0;
          if (nb) { label[k] = nb; unassigned--; }
        }
      }
    }
    // No front panels from SAM: the shirt body (TOP) is split down the button placket.
    if (!(sam.front && sam.front.length)) {
      let moved = 0;
      for (let y = 0, k = 0; y < gh; y++) for (let x = 0; x < gw; x++, k++) if (label[k] === idx.TOP) { label[k] = x < cShirt[y] ? idx["LEFT TOP"] : idx["RIGHT TOP"]; moved++; }
      trace("ps parts: no front panels from SAM — TOP split down the placket (" + moved + " grid px)");
    }
    const out = {};
    for (let i = 0; i < names.length; i++) {
      const v = i + 1, b = new Uint8Array(N); let n = 0;
      for (let k = 0; k < N; k++) if (label[k] === v) { b[k] = 1; n++; }
      if (n) out[names[i]] = b;
    }
    return { labels: out, unassigned: unassigned, garmentPx: gCount };
  }

  // ----- FIND PARTS ----------------------------------------------------------------
  // Every part name any type uses (old channels of another type are cleared too).
  function psAllPartNames() {
    const seen = {}, out = [];
    const add = function (n) { if (!seen[n]) { seen[n] = 1; out.push(n); } };
    PS_PART_ORDER.forEach(add); ["LEFT PATN TRIM", "RIGHT PATN TRIM", "LEFT NECK", PS_UNASSIGNED].forEach(add);
    psAllGtypes().forEach(function (t) { psGtypeParts(t).forEach(function (p) { add(p.n); }); });
    return out;
  }
  async function executePsParts(params) {
    if (!psMod().app.activeDocument) throw new Error("Open a Photoshop document first.");
    return kbKeepView(async function () { return executePsPartsRun(params); });   // the view stays as it is
  }
  async function executePsPartsRun(params) {
    const ps = psMod();
    const doc = ps.app.activeDocument;
    const grey = psGreyExactLayer();
    if (!grey) throw new Error("there is no " + PS_EXACT_LAYER + " layer. Make gray and Accept it first (step 5).");
    const docW = Math.round(doc.width), docH = Math.round(doc.height);
    if (docW * docH > KB_MAX_PIXELS) throw new Error("the document is too large (" + docW + " × " + docH + ").");
    const G = kbGridSize(docW, docH), gw = G.gw, gh = G.gh, N = gw * gh;
    const photoId = psPartsPhotoLayerId();
    let step = "reading the garment";
    try {
      // 1) The garment (KBPS garment) on the grid, and its box for SAM.
      const full = { left: 0, top: 0, right: docW, bottom: docH };
      const alphaDoc = await psReadMaskAlpha(full);
      const garment = (gw === docW && gh === docH) ? alphaDoc : kbResamplePlane(alphaDoc, docW, docH, gw, gh);
      const box = kbPlaneBox(garment, gw, gh, docW, docH, 0.04);
      if (!box) throw new Error("the garment mask is empty. Find the garment first (step 2).");
      trace("ps parts: grid " + gw + "x" + gh + ", garment box " + JSON.stringify(box) + ", photo layer " + photoId);

      // 2) SAM reads CLEAN (inside the garment) over the photo straight from the layers
      //    by id: nothing is hidden or shown, the canvas stays as it is.
      const src = kbSamLayerSource(photoId, alphaDoc, full);
      params.source = src.label;
      const sam = {}, found = {};
      let calls = 0, zoomCalls = 0;
      const gt = psGtypeById(params.type), checked = new Set(params.checked || []);
      const plan = psPartsPlan(gt, checked);
      params.searches = plan.map(function (Q) { return Q.label; });
      trace("ps parts: type " + gt.id + " (" + gt.short + "), " + checked.size + " part(s): " + Array.from(checked).join(", ") + "; " + plan.length + " search(es): " + plan.map(function (Q) { return Q.prompt; }).join(" | "));
      try {
        for (let q = 0; q < plan.length; q++) {
          const Q = plan[q];
          step = "asking SAM 3.1 for “" + Q.prompt + "”";
          setStatus("busy", "SAM: " + gt.short + " · " + Q.label + " (" + (q + 1) + " of " + plan.length + ")…");
          const r = await kbSamRect(Q.prompt, box, { samPath: PS_SAM_PATH, src: src });
          calls++;
          const inst = [];
          if (r && r.planes) {
            for (let i = 0; i < r.planes.length; i++) {
              const grid = new Uint8Array(N);
              kbPasteCrop(grid, gw, gh, docW, docH, r.planes[i], r.w, r.h, box);
              const b = new Uint8Array(N); let n = 0;
              for (let k = 0; k < N; k++) if (grid[k] > 127) { b[k] = 1; n++; }
              if (n) inst.push(b);
            }
          }
          if (!inst.length && !Q.noZoom) {
            step = "looking closer for “" + Q.prompt + "”";
            const zr = await kbSamZoom(Q.prompt, box, docW, docH, gw, gh, { samPath: PS_SAM_PATH, src: src });
            zoomCalls += zr.calls;
            const b = new Uint8Array(N); let n = 0;
            for (let k = 0; k < N; k++) if (zr.plane[k] > 127) { b[k] = 1; n++; }
            if (n) inst.push(b);
          }
          sam[Q.key] = inst;
          found[Q.key] = inst.length;
          trace("ps parts: “" + Q.prompt + "” → " + inst.length + " piece(s)");
        }
      } finally { src.cache = null; }
      params.samCalls = calls; params.zoomCalls = zoomCalls;
      params.costUsd = (calls + zoomCalls) * SAM_COST_USD;
      params.samFound = found;
      const srec = logRecordSkeleton("printswap:parts-sam", { model: PS_SAM_PATH, calls: calls, zoomCalls: zoomCalls,
        estCostUsd: params.costUsd, found: found }, photoId, "composite");
      srec.routedVia = "fal";
      await logRun(srec);
      await logFinalizeCommitted(srec.id);

      // 3) The cut: one part per garment pixel.
      step = "cutting the parts";
      setStatus("busy", "Cutting the garment into parts…");
      const cut = gt.team ? psCutFilterA(psCutParts(sam, garment, gw, gh), checked, N) : psCutGeneric(gt, checked, sam, garment, gw, gh);
      const masks = [];
      Object.keys(cut.labels).forEach(function (nm) {
        const b = cut.labels[nm], pl = new Uint8Array(N);
        for (let k = 0; k < N; k++) if (b[k]) pl[k] = 255;
        masks.push({ name: nm, plane: pl });
      });
      step = "refining the edges";
      setStatus("busy", "Refining the part edges against the photo…");
      try { await kbRefineMasks(masks, gw, gh, docW, docH, photoId, PS_EDGE_SOFT); }
      catch (e) { traceErr("ps parts refine (kept as cut)", e); }
      // The parts tile the garment exactly: every garment pixel in one part (overlaps to the
      // stronger refined mask, gaps to the nearest part), shared borders hard with a 1 px
      // overlap. The outer edge is softened later from the garment (psSoftenFromRawInModal).
      step = "tiling the garment with the parts";
      const tile = psPartsTile(masks.map(function (z) { return z.plane; }), garment, gw, gh);
      for (let i = 0; i < masks.length; i++) masks[i].plane = tile.planes[i];
      const px = function (n) { return Math.round(n * (docW * docH) / N); };     // grid px → document px
      params.coverage = { pct: tile.coveredPct, gapsPx: px(tile.gapsAfter), overlapsAfterPx: px(tile.multiAfter), gapsFixedPx: px(tile.gapsFixed), overlapsFixedPx: px(tile.overlapsFixed),
        took: masks.map(function (z, i) { return { name: z.name, px: px(tile.took[i]) }; }).filter(function (x) { return x.px > 0; }).sort(function (a, b) { return b.px - a.px; }) };
      trace("ps parts: tiling " + JSON.stringify(params.coverage) + " (grid " + gw + "x" + gh + ")");
      if (tile.gapsAfter) throw new Error(px(tile.gapsAfter) + " garment px are still in no part after the fill.");

      // 4) Channels "KBPS part <NAME>" (empty parts: none).
      step = "saving the part channels";
      const all = psAllPartNames();
      await ps.core.executeAsModal(async function () {
        for (let i = 0; i < all.length; i++) { await kbRemoveChannels(PS_PART_CH + all[i]); await kbRemoveChannels(psRawName(PS_PART_CH + all[i])); }
      }, { commandName: "KBImage — clear part channels" });
      // At full size over the garment's box: smooth seams, every part past the garment's edge,
      // then cut by KBPS garment. Every garment pixel must be in a part (no light fringe).
      step = "making the part masks at full size";
      let gbox = null;
      await ps.core.executeAsModal(async function () {
        await kbLoadChannel(PS_GARMENT_CH);
        gbox = kbSelectionBounds();
        try { await deselectAll(); } catch (_) {}
      }, { commandName: "KBImage — garment box" });
      if (!gbox) throw new Error("KBPS garment is empty.");
      const frect = { left: Math.max(0, Math.floor(Number(gbox.left)) - 2), top: Math.max(0, Math.floor(Number(gbox.top)) - 2),
        right: Math.min(docW, Math.ceil(Number(gbox.right)) + 2), bottom: Math.min(docH, Math.ceil(Number(gbox.bottom)) + 2) };
      const F = psPartsFullLabels(masks.map(function (z) { return z.plane; }), gw, gh, docW, docH, frect);
      if (!F) throw new Error("no part has any pixels.");
      const ga = await psReadMaskAlpha(frect);
      let bare = 0;
      for (let p = 0; p < ga.length && p < F.lab.length; p++) if (ga[p] > 0 && !F.lab[p]) bare++;
      trace("ps parts: full size " + F.rw + "x" + F.rh + " at " + JSON.stringify(frect) + ", seams blurred " + F.sigma.toFixed(1) + " px, garment px in no part: " + bare);
      if (bare) throw new Error(bare + " garment px are in no part at full size.");
      for (let i = 0; i < masks.length; i++) {
        setStatus("busy", "Saving parts (" + (i + 1) + " of " + masks.length + ")…");
        await psPlaneRectToChannel(psPartFullPlane(F, i), F.rw, F.rh, frect, PS_PART_CH + masks[i].name);
      }
      setStatus("busy", "Softening the part edges…");
      await psSoftenAfterSave(masks.map(function (z) { return PS_PART_CH + z.name; }), "parts", "part");   // edge softness

      // 5) Layers: PARTS above GREY exact, one group per name, shape inside.
      step = "building the part layers";
      setStatus("busy", "Building the part layers…");
      const typeOrder = psGtypeParts(gt).map(function (p) { return p.n; }).filter(function (n) { return checked.has(n); });
      const wanted = gt.team ? psWithLeftNeck(typeOrder, !!cut.labels["LEFT NECK"]) : typeOrder;
      // a group only for a part with a shape (never an empty one); the rest are "not in this photo"
      const order = (cut.labels[PS_UNASSIGNED] ? [PS_UNASSIGNED] : []).concat(wanted.filter(function (n) { return !!cut.labels[n]; }));
      let newIds = [];
      await ps.core.executeAsModal(async function () {
        try { await deselectAll(); } catch (_) {}
        await kbSelectLayerById(grey.id);
        const shapeIds = [];
        for (let i = order.length - 1; i >= 0; i--) {     // bottom first → panel reads in team order
          shapeIds.unshift(await psMakeShapeInModal(order[i], false));
        }
        const groupIds = [];
        for (let i = 0; i < order.length; i++) groupIds.push(await psGroupInModal([shapeIds[i]], order[i]));
        newIds = groupIds.slice();
        // Into PARTS, in PS under PB and SDW (never at the top: shapes never cover the trims).
        // No PARTS yet: made from the new groups, in PS (PS made around it when missing). A
        // v0.19 file's top-level PARTS goes into PS first.
        step = "moving the parts into " + PS_PARTS_GROUP;
        try {
          const EP = ps.constants.ElementPlacement;
          let F = psPartsFolder();
          if (F && psPsGroup() && !(F.parent && F.parent.id === psPsGroup().id)) psPlacePartsInPs(F, true);
          if (F && !psPsGroup()) { const pid = await psGroupInModal([F.id], PS_PS_GROUP); psPassThrough(kbLayerById(pid)); }
          if (F) {
            for (let i = groupIds.length - 1; i >= 0; i--) { const g = kbLayerById(groupIds[i]); if (g) g.move(F, EP.PLACEINSIDE); }
            psOrderInGroup(F, groupIds.map(kbLayerById).filter(Boolean), function (l, rel, where) { l.move(rel, where); });
          } else {
            F = kbLayerById(await psGroupInModal(groupIds, PS_PARTS_GROUP));
            if (!F) throw new Error("the " + PS_PARTS_GROUP + " group could not be made.");
            psPassThrough(F);
            if (!psPsGroup()) { const pid = await psGroupInModal([F.id], PS_PS_GROUP); psPassThrough(kbLayerById(pid)); }
            else psPlacePartsInPs(F, true);
          }
          const out = groupIds.filter(function (id) { const g = kbLayerById(id); let pp = null; try { pp = g && g.parent; } catch (_) {} return !pp || pp.id !== F.id; });
          if (out.length) throw new Error(out.length + " part group(s) did not land in " + PS_PARTS_GROUP + ".");
        } catch (e) {                                     // no preview left outside PARTS
          for (let i = 0; i < groupIds.length; i++) await psDeleteLayerInModal(groupIds[i]);
          throw e;
        }
        try { await deselectAll(); } catch (_) {}
      }, { commandName: "KBImage — part layers" });

      const missing = wanted.filter(function (n) { return !cut.labels[n]; });
      params.missing = missing;
      params.unassigned = !!cut.labels[PS_UNASSIGNED];
      params.found = wanted.length - missing.length; params.wanted = wanted.length;
      trace("ps parts: found " + params.found + " of " + wanted.length + ", not in this photo: " + missing.join(", ") + (params.unassigned ? ", UNASSIGNED present" : ""));
      return { layerIds: newIds, afterSnapshotRef: null, state: { partIds: newIds } };   // Discard: these groups only, PARTS stays
    } catch (err) {
      const e2 = new Error("Find parts failed while " + step + ": " + ((err && err.message) || String(err)));
      e2.cause = err;
      throw e2;
    }
  }

  async function actPsFindParts() {
    if (generateInFlight) { kbBusyNote(); return; }
    const ps = psMod();
    const doc = ps.app.activeDocument;
    if (!doc) { setStatus("bad", "Open a Photoshop document first."); return; }
    const problem = kbDocProblem(doc);
    if (problem) { setStatus("bad", problem); return; }
    if (!cachedFalKey) { setStatus("bad", "Add your Fal API key in Settings (gear icon) to find the parts."); return; }
    if (!kbChannelExists(PS_GARMENT_CH)) { setStatus("bad", "Find the garment first (step 2)."); return; }
    if (pendingRecall && pendingRecall.descriptor && /^printswap:gray/.test(String(pendingRecall.descriptor.op))) {
      setStatus("bad", "Accept or Re-run the gray first (step 5)."); return;
    }
    if (!psGreyExactLayer()) { setStatus("bad", "Make gray and Accept " + PS_EXACT_LAYER + " first (step 5)."); return; }
    const gt = psGtypeById(psGarmentType);
    if (!gt) { setStatus("bad", "Pick the garment type in step 2 first."); return; }
    const checkedNow = Array.from(psCheckedFor(gt));
    if (!checkedNow.length) { setStatus("bad", "Check at least one part to find."); return; }
    // Accepted parts (maybe fixed by hand) are replaced only on a second click. Only the part
    // groups go, with their KBPS part channels: never PS, PB, SDW or Backup. A PARTS group
    // (older files) goes whole; a preview still waiting is replaced by the new run.
    const olds = psPartGroupsAll();
    const old = olds.some(function (g) { return psIsPending(g.id); }) ? [] : olds;   // a preview waiting: the new run replaces it
    if (old.length) {
      if (Date.now() > psPartsArmUntil) {
        psPartsArmUntil = Date.now() + 5000;
        psPartsArmNote(true);
        return;
      }
      psPartsArmUntil = 0;
      psPartsArmNote(false);
      const names = [];
      old.forEach(function (g) { names.push(String(g.name)); });
      try { await deleteLayersById(old.map(function (g) { return g.id; })); } catch (_) {}
      try {
        await ps.core.executeAsModal(async function () {
          for (let i = 0; i < names.length; i++) { await kbRemoveChannels(PS_PART_CH + names[i]); await kbRemoveChannels(psRawName(PS_PART_CH + names[i])); }
        }, { commandName: "KBImage — clear part channels" });
      } catch (e) { traceErr("ps parts: clear old part channels", e); }
      trace("ps parts: replaced " + old.map(function (g) { return g.name; }).join(", ") + " and their part channels");
    }
    const btn = $("ps-parts-btn");
    if (btn) btn.classList.add("disabled");
    traceStart("Print Swap — Find parts (" + PS_SAM_PATH + ")");
    generateInFlight = true;
    const partsParams = function () {
      const t = psGtypeById(psGarmentType) || gt, c = Array.from(psCheckedFor(t));
      return { model: PS_SAM_PATH, type: t.id, typeName: t.short, checked: c, parts: c.length };
    };
    const p = partsParams();
    try {
      const grey = psGreyExactLayer();
      await psRecall(6, "ps-recall-anchor-6", {
        op: "printswap:parts",
        params: p,
        targetLayerId: grey ? grey.id : null,
        sourceRef: "garment:" + PS_GARMENT_CH + " gray:" + PS_EXACT_LAYER,
        paramsProvider: partsParams,
        execute: executePsParts,
        onSettle: async function (state, accepted) {            // Accept: the part groups into PS (under PB and SDW)
          if (!accepted) return null;
          try { await ps.core.executeAsModal(async function () { await psLayoutFixInModal(); }, { commandName: "KBImage — PS group" }); }
          catch (e) { traceErr("ps parts: into PS", e); return "Accepted, but the parts could not be moved into PS (" + ((e && e.message) || String(e)) + ")."; }
          return null;
        },
      });
      trace("ps parts: done");
      const miss = p.missing || [];
      // Not found is neutral: those parts are not in this photo. They are unchecked, so steps
      // 7 to 9 skip them; check one again and add it with + Add if it is there.
      const t0 = psGtypeById(p.type);
      if (miss.length) {
        const t = t0, c = psCheckedFor(t);
        miss.forEach(function (n) { c.delete(n); });
        try { psGtypeRender(); } catch (_) {}
        trace("ps parts: unchecked (not in this photo): " + miss.join(", "));
      }
      const tk = (p.coverage && p.coverage.took) || [];
      if (t0) psCheckedBy[t0.id] = "doc";
      psPartsRefreshList();
      // The coverage stays honest, on its own line under the list (which parts filled gaps).
      const note = $("ps-parts-note");
      if (note) note.textContent = p.coverage ? "Coverage: " + p.coverage.pct + "%, gaps " + p.coverage.gapsPx + " px"
        + (tk.length ? " · gaps filled by " + tk.slice(0, 6).map(function (x) { return x.name + " (" + x.px.toLocaleString("en-US") + " px)"; }).join(", ") + (tk.length > 6 ? ", …" : "") : "")
        + (p.unassigned ? " · some pixels are in UNASSIGNED" : "") : "";
      setStatus("ok", (p.found != null ? p.found : p.parts - miss.length) + " of " + (p.wanted != null ? p.wanted : p.parts) + " parts found · $" + (p.costUsd || 0).toFixed(2) + ". Check the parts, then Accept.");
    } catch (err) {
      traceErr("ps parts", err && err.cause ? err.cause : err);
      try { console.error(TAG, "find parts failed:", err); } catch (_) {}
      setStatus("bad", (err && err.message) || "Find parts failed.");
    } finally {
      generateInFlight = false;
      if (btn) btn.classList.remove("disabled");
      try { psPartsRefreshList(); updateDocInfo(); } catch (_) {}
      await traceFlush();
    }
  }

  // ----- TOUCH UP — + / − the current selection to / from the picked part ----------
  async function actPsEditPart(srcEl) {
    if (generateInFlight) { kbBusyNote(); return; }
    const ps = psMod();
    if (!ps.app.activeDocument) { setStatus("bad", "Open a Photoshop document first."); return; }
    if (!psPartsGroup()) { setStatus("bad", "Click Find parts first."); return; }
    const name = readPills("pills-ps-parts", null);
    if (!name) { setStatus("bad", "Click a part in the list first."); return; }
    const mode = (srcEl && srcEl.getAttribute && srcEl.getAttribute("data-mode")) === "subtract" ? "subtract" : "add";
    if (!kbSelectionBounds()) {
      setStatus("bad", "Select the bit to " + (mode === "add" ? "add to " : "remove from ") + name + " first (Lasso or any selection tool).");
      return;
    }
    const ch = PS_PART_CH + name;
    const home = psPartHome(name);
    if (mode === "subtract") {
      if (psPartIsRest(name)) {
        setStatus("bad", name + " takes whatever is left. To move pixels out of it, pick the part they belong to and use + Add.");
        return;
      }
      if (!kbChannelExists(ch)) { setStatus("bad", name + " has no pixels to remove."); return; }
    }
    generateInFlight = true;
    traceStart("Print Swap — " + (mode === "add" ? "add to " : "remove from ") + name);
    const changed = [name];
    const softPx = psEdgeSoft("part");
    try {
      await ps.core.executeAsModal(async function () {
        const save = async function (chName) { await kbRemoveChannels(chName); if (kbSelectionBounds()) await saveSelectionToChannel(chName); };
        await kbRemoveChannels(PS_PART_TMP);
        await kbRemoveChannels(PS_PART_TMP2);
        await saveSelectionToChannel(PS_PART_TMP);
        const hard = psPartNames().map(function (n) { return PS_PART_CH + n; });     // edit the hard versions
        for (let i = 0; i < hard.length; i++) await psUnsoftenInModal(hard[i]);
        try {
          if (mode === "add") {
            // Only garment pixels can join a part.
            await kbLoadChannel(PS_PART_TMP);
            await kbLoadChannel(PS_GARMENT_CH, "intersect");
            if (!kbSelectionBounds()) throw new Error("the selection is outside the garment.");
            await save(PS_PART_TMP);
            if (kbChannelExists(ch)) { await kbLoadChannel(ch); await kbLoadChannel(PS_PART_TMP, "add"); }
            else await kbLoadChannel(PS_PART_TMP);
            await save(ch);
            // ...and leave every other part (rule 1).
            const others = psPartNames().filter(function (n) { return n !== name; });
            for (let i = 0; i < others.length; i++) {
              const oc = PS_PART_CH + others[i];
              if (!kbChannelExists(oc)) continue;
              await kbLoadChannel(oc);
              await kbLoadChannel(PS_PART_TMP, "intersect");
              if (!kbSelectionBounds()) continue;
              await kbLoadChannel(oc);
              await kbLoadChannel(PS_PART_TMP, "subtract");
              await save(oc);
              changed.push(others[i]);
            }
          } else {
            // The removed pixels go back to the part that takes the rest (TOP / PANT, GOWN FRONT, …).
            await kbLoadChannel(ch);
            await kbLoadChannel(PS_PART_TMP, "intersect");
            if (!kbSelectionBounds()) throw new Error("the selection does not touch " + name + ".");
            await saveSelectionToChannel(PS_PART_TMP2);
            await kbLoadChannel(ch);
            await kbLoadChannel(PS_PART_TMP2, "subtract");
            await save(ch);
            const hc = PS_PART_CH + home;
            if (kbChannelExists(hc)) { await kbLoadChannel(hc); await kbLoadChannel(PS_PART_TMP2, "add"); }
            else await kbLoadChannel(PS_PART_TMP2);
            await save(hc);
            changed.push(home);
          }
        } finally {
          await kbRemoveChannels(PS_PART_TMP);
          await kbRemoveChannels(PS_PART_TMP2);
          try { await deselectAll(); } catch (_) {}
        }
        for (let i = 0; i < hard.length; i++) await psSoftenAfterSaveInModal(hard[i], softPx);   // soften again
        for (let i = 0; i < changed.length; i++) await psRedrawShapeInModal(changed[i]);
        if (kbChannelExists(ch)) await kbLoadChannel(ch);
        const sh = psShapeLayer(name);
        if (sh) await kbSelectLayerById(sh.id);
      }, { commandName: "KBImage — edit part" });
      const rec = logRecordSkeleton("printswap:edit-part", { part: name, mode: mode, changed: changed }, null, "selection");
      await logRun(rec);
      await logFinalizeCommitted(rec.id);
      trace("ps edit part: " + mode + " " + name + ", redrawn: " + changed.join(", "));
      setStatus("ok", (mode === "add" ? "Added to " : "Removed from ") + name + "."
        + (changed.length > 1 ? " Also updated: " + changed.slice(1).join(", ") + "." : "") + " " + name + " is selected.");
    } catch (err) {
      traceErr("ps edit part", err);
      setStatus("bad", "Could not " + (mode === "add" ? "add to " : "remove from ") + name + ": " + ((err && err.message) || String(err)));
    } finally {
      generateInFlight = false;
      try { psPartsRefreshList(); } catch (_) {}
      await traceFlush();
    }
  }

  // =======================================================================
  // PRINT SWAP — step 7 PRINT and step 8 SHADING.
  // No AI: pixel tiling + Photoshop layers only.
  //
  //   PLACE PRINT — Accept / Re-run. The chosen print tiled (exact arithmetic,
  //     kbComposeTile — wraps, so no gaps or seams) over each part's box,
  //     placed by the PNG route as "PRINT" just above "<NAME> shape" in the
  //     part's group and CLIPPED to it (Create Clipping Mask), Normal 100%.
  //     Scale % = % of the print file's own pixels (one for the garment, an
  //     optional override per part). Angle = the part's long axis + the
  //     whole-garment turn + the part's own turn (1° / 15° steps). Saved in the
  //     document (XMP), with a copy in the plug-in data folder.
  //   SWAP PRINT — a new file into every part with the saved scale and angles.
  //   BUILD SHADING — Accept / Re-run. GREY group (Pass Through) above PARTS,
  //     bottom to top: GREY (hidden, locked) · GREY copy (Multiply, Shading
  //     strength %, Fold smoothing) with, clipped to it, Levels shading (the median
  //     gray of GREY exact → white, gamma = 1 / Fold contrast), Brightness/Contrast 1
  //     and Exposure 1 · GREY highlights (Screen, Highlights %) with Levels
  //     highlights clipped (median → black) · GREY copy 2 (Linear Burn 10%) with
  //     Levels burn clipped (median → white). Every adjustment is clipped, so on flat
  //     fabric each layer is white (Multiply, Linear Burn) or black (Screen) and the
  //     print keeps its colors. Then GREY copy 3 (the veil, Normal, 0% by default)
  //     above the group. Real adjustment layers; every layer but GREY
  //     masked to KBPS garment and unlocked; only GREY is locked. GREY exact is
  //     hidden, not deleted. Every build, Re-run, Discard and Redo first deletes every
  //     top-level GREY group and GREY copy 3 (unlocked first), so one veil is left.
  //     Fold smoothing: Surface Blur on GREY copy before Levels. Starting values from
  //     the source garment and the placed print (each Dark under 40% lightness).
  //   Clipping and adjustment calls that fail report Photoshop's exact error.
  // =======================================================================
  const PS_PRINT_LAYER   = "PRINT";
  const PS_SHADE_GROUP   = "GREY";
  const PS_VEIL_NAME     = "GREY copy 3";
  const PS_STATE_NS      = "http://ns.kbimage.local/printswap/1.0/";
  const PS_STATE_FILE    = "kbps-print-state.json";

  let psPrint = null;                                 // { name, entry } — the chosen print
  let psPrintTex = null;                              // { key, tex } — its pixels, read once
  let psShadeArmUntil = 0;

  // ----- Saved state: { scalePct, rotDeg, printName, parts: { NAME: { auto, own, nudge, scale } } } -----
  // rotDeg = the whole-garment angle. A part prints at auto (its direction) + its own
  // angle when it has one, else + rotDeg (+ nudge, an offset kept from older files).
  function psStateEmpty() { return { v: 1, scalePct: 100, rotDeg: 0, printName: null, parts: {} }; }
  function psXmlEsc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function psXmlUnesc(s) {
    return String(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&#x([0-9a-f]+);/gi, function (_, h) { return String.fromCharCode(parseInt(h, 16)); })
      .replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(Number(d)); }).replace(/&amp;/g, "&");
  }
  // Our state in the document's XMP, whatever prefix Photoshop gave the namespace (a
  // prefix already taken in this session gets renamed, e.g. kbps_1) and whether it was
  // kept as an element or rewritten as an attribute. → { prefix, form, raw, json } or null.
  function psXmpStateFind(xmp) {
    const x = String(xmp || ""), re = /xmlns:([A-Za-z_][\w.-]*)\s*=\s*["']([^"']*)["']/g;
    const prefixes = [];
    let m;
    while ((m = re.exec(x))) if (m[2] === PS_STATE_NS && prefixes.indexOf(m[1]) < 0) prefixes.push(m[1]);
    for (let i = 0; i < prefixes.length; i++) {
      const p = prefixes[i].replace(/[.]/g, "\\.");
      const el = new RegExp("<" + p + ":state>([\\s\\S]*?)</" + p + ":state>").exec(x);
      if (el) return { prefix: prefixes[i], form: "element", raw: el[0], json: psXmlUnesc(el[1]) };
      const at = new RegExp("\\b" + p + ":state\\s*=\\s*\"([^\"]*)\"").exec(x) || new RegExp("\\b" + p + ":state\\s*=\\s*'([^']*)'").exec(x);
      if (at) return { prefix: prefixes[i], form: "attribute", raw: at[0], json: psXmlUnesc(at[1]) };
    }
    return null;
  }
  async function psXmpGet() {
    const res = await psMod().action.batchPlay(
      [{ _obj: "get", _target: [{ _ref: "property", _property: "XMPMetadataAsUTF8" }, { _ref: "document", _enum: "ordinal", _value: "targetEnum" }],
         _options: { dialogOptions: "dontDisplay" } }], { synchronousExecution: true });
    return (res && res[0] && typeof res[0].XMPMetadataAsUTF8 === "string") ? res[0].XMPMetadataAsUTF8 : "";
  }
  async function psStateLoad() {
    try {
      const f = psXmpStateFind(await psXmpGet());
      if (f) { const s = JSON.parse(f.json); if (s && s.parts) return s; }
    } catch (e) { traceErr("ps state: read from document (trying plug-in file)", e); }
    try {
      const f = await (await fsLocal().getDataFolder()).getEntry(PS_STATE_FILE);
      const all = JSON.parse(await f.read({ format: fmts().utf8 })) || {};
      const s = all[kbDocTitle()];
      if (s && s.parts) return s;
    } catch (_) {}
    return psStateEmpty();
  }
  async function psStateSave(state) {
    const json = JSON.stringify(state);
    let inDoc = false;
    try {
      let xmp = await psXmpGet();
      const el = "<kbps:state>" + psXmlEsc(json) + "</kbps:state>";
      const f = psXmpStateFind(xmp);
      if (f && f.form === "element") xmp = xmp.replace(f.raw, function () { return "<" + f.prefix + ":state>" + psXmlEsc(json) + "</" + f.prefix + ":state>"; });
      else if (f) xmp = xmp.replace(f.raw, function () { return f.prefix + ':state="' + psXmlEsc(json).replace(/"/g, "&quot;") + '"'; });
      else {
        const desc = '<rdf:Description rdf:about="" xmlns:kbps="' + PS_STATE_NS + '">' + el + "</rdf:Description>";
        if (/<\/rdf:RDF>/.test(xmp)) xmp = xmp.replace(/<\/rdf:RDF>/, desc + "</rdf:RDF>");
        else xmp = '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' + desc + "</rdf:RDF></x:xmpmeta>";
      }
      await psMod().core.executeAsModal(async function () {
        await psMod().action.batchPlay(
          [{ _obj: "set", _target: [{ _ref: "property", _property: "XMPMetadataAsUTF8" }, { _ref: "document", _enum: "ordinal", _value: "targetEnum" }],
             to: { _obj: "document", XMPMetadataAsUTF8: xmp }, _options: { dialogOptions: "dontDisplay" } }], { synchronousExecution: true });
      }, { commandName: "KBImage — save print settings" });
      const back = psXmpStateFind(await psXmpGet());       // confirm it really landed (any prefix, either form)
      inDoc = !!back && (function () { try { return !!JSON.parse(back.json).parts; } catch (_) { return false; } })();
      if (!inDoc) trace("ps state: the document's XMP did not keep it" + (back ? " (read back different)" : " (not found after the write)"));
    } catch (e) { traceErr("ps state: save in document", e); }
    try {
      const folder = await fsLocal().getDataFolder();
      let all = {};
      try { all = JSON.parse(await (await folder.getEntry(PS_STATE_FILE)).read({ format: fmts().utf8 })) || {}; } catch (_) {}
      all[kbDocTitle()] = state;
      const f = await folder.createFile(PS_STATE_FILE, { overwrite: true });
      await f.write(JSON.stringify(all), { format: fmts().utf8 });
    } catch (_) {}
    trace("ps state saved" + (inDoc ? " in the document" : " in the plug-in folder only"));
    return inDoc;
  }

  // ----- Panel -------------------------------------------------------------------
  function psPrintScale() { return kbNum("ps-print-scale", 100, 1, 1000); }
  function psPrintOnPartPicked() { psPrintRefreshPart(); }
  async function psPrintRefreshPart() {
    const name = readPills("pills-ps-parts", null);
    const lbl = $("ps-print-part");
    if (lbl) { lbl.textContent = name || "none (pick a part)"; lbl.classList.toggle("ps-part-on", !!name); }
    psPartPickersRender(name);
    psPrintButtonSync();
    const ov = $("ps-part-scale"), ang = $("ps-part-angle"), gr = $("ps-print-rot"), ex = $("ps-part-rot-exact");
    let st = null;
    try { st = await psStateLoad(); } catch (_) {}
    const g = st ? Number(st.rotDeg) || 0 : 0;
    if (gr) gr.textContent = "Angle: " + psDegText(g);
    const gs = $("ps-print-scale");
    if (st) psPrintSaved = { printName: st.printName || null, scalePct: Number(st.scalePct) || 100, parts: st.parts || {} };
    if (gs && st && st.scalePct && !psPrintScaleSet && document.activeElement !== gs) gs.value = String(st.scalePct);   // a value set, not applied, stays
    psPrintDirtySync();
    const cc = $("ps-print-continuous"); if (cc && st) cc.checked = psPrintContinuous(st);
    const p = name && st ? st.parts[name] : null;
    if (ov && document.activeElement !== ov) ov.value = psPartScaleTyped && psPartScaleTyped.name === name ? psPartScaleTyped.raw   // typed, not applied: stays
      : ((p && p.scale != null) ? String(p.scale) : "");
    if (ex) ex.value = (p && p.own != null) ? String(p.own) : "";
    // Whole garment: only its own value. This part: the part's own final angle, else "same as whole garment".
    const own = !!p && ((p.own != null && isFinite(Number(p.own))) || !!Number(p.nudge));
    if (ang) ang.textContent = !name ? "Angle: pick a part" : (own ? "Angle: " + psDegText(psPartAngle(p, g)) : "Angle: same as whole garment");
  }
  // A part's angle as the retoucher sees it: its own (absolute) angle, else the
  // whole-garment angle (+ an older per-part offset). The print sits at the part's
  // own direction (auto) + this.
  function psPartAngle(pst, garmentRot) {
    if (pst && pst.own != null && isFinite(Number(pst.own))) return Number(pst.own);
    return (Number(garmentRot) || 0) + (Number(pst && pst.nudge) || 0);
  }
  function psWrapDeg(v) { return Math.round((((v + 180) % 360 + 360) % 360 - 180) * 10) / 10; }   // −180 … +180
  // Step 7's Part picker: every part in the step 6 order. Picking one = clicking its pill.
  function psPartPickerNames() {
    const g = $("pills-ps-parts");
    const pills = g ? Array.from(g.querySelectorAll(".pill")).map(function (p) { return p.getAttribute("data-value"); }) : [];
    return pills.length ? pills : psPartNames();
  }
  function psPartPickersRender(name) {
    const names = psPartPickerNames(), sig = names.join("|"), menu = $("dd-pspart-menu");
    if (!menu) return;
    if (menu.getAttribute("data-sig") !== sig) {
      while (menu.firstChild) menu.removeChild(menu.firstChild);
      menu.setAttribute("data-sig", sig);
      names.forEach(function (n) {
        const o = document.createElement("div");
        o.className = "dd-option"; o.setAttribute("role", "option"); o.setAttribute("tabindex", "0");
        o.setAttribute("data-dd-group", "pspart"); o.setAttribute("data-dd-value", n);
        o.textContent = n;
        menu.appendChild(o);
      });
    }
    const os = menu.querySelectorAll(".dd-option");
    for (let i = 0; i < os.length; i++) os[i].classList.toggle("selected", os[i].getAttribute("data-dd-value") === name);
  }
  function psPickPart(name) {
    if (!name) return;
    if (!psSetPartPill(name)) { setStatus("bad", "Find parts and Accept them first (step 6), then pick a part."); return; }
    psOnPartPicked(name);                                  // the selection and the Layers panel, as the pill
    psPrintOnPartPicked(name);                             // both pickers, the Selected part line, scale and angle
  }
  // 0° / +2° / -7.5° (clockwise is +).
  function psDegText(v) { const r = Math.round(v * 10) / 10; return (r > 0 ? "+" : "") + r + "°"; }
  // What Apply print last applied (from the document's state) and whether the Scale box
  // holds a value set since (typed or suggested). "Changes not applied" is only for a new
  // print or a changed scale; the angle buttons apply at once once the print is placed.
  let psPrintSaved = null;                             // { printName, scalePct, parts }
  let psPrintScaleSet = false;
  let psPartScaleTyped = null;                         // { name, raw }: This part scale typed, not applied yet
  function psPrintScaleRaw() { return String((($("ps-print-scale") || {}).value) || "").trim().replace("%", ""); }
  function psPartScaleVal(raw) { const r = String(raw == null ? "" : raw).trim().replace("%", ""), v = Number(r); return (r === "" || !(v > 0)) ? null : Math.min(1000, v); }
  function psPartSavedScale(parts, name) { const p = parts && parts[name]; return p && p.scale != null && p.scale > 0 ? Number(p.scale) : null; }
  function psPartScaleChanged(parts) { return !!psPartScaleTyped && psPartScaleVal(psPartScaleTyped.raw) !== psPartSavedScale(parts, psPartScaleTyped.name); }
  function psPrintDirty() {
    if (!psPrint || !psPrintPlaced() || !psPrintSaved) return false;
    if (psPrintSaved.printName && psPrintSaved.printName !== psPrint.name) return true;
    if (psPartScaleChanged(psPrintSaved.parts)) return true;
    const v = Number(psPrintScaleRaw());
    return v > 0 && Math.min(1000, v) !== psPrintSaved.scalePct;
  }
  function psPrintDirtySync() { const el = $("ps-print-dirty"); if (el) el.classList.toggle("hidden", !psPrintDirty()); }
  // Suggested scale: the largest at which the print is not enlarged past the pixels read from
  // its file (100% = one print pixel per document pixel; a file larger than the read limit
  // gives less). Shown under the box; before the first Apply print it fills the box.
  let psPrintSuggest = null;                           // { entry, pct }
  function psPrintSuggestPct(tex) {
    if (!tex || !(tex.layerW > 0) || !(tex.layerH > 0)) return null;
    const r = Math.min(1, (tex.width || tex.layerW) / tex.layerW, (tex.height || tex.layerH) / tex.layerH);
    return Math.max(1, Math.floor(100 * r));
  }
  function psPrintSuggestRender() {
    const el = $("ps-print-suggest");
    if (!el) return;
    const s = psPrint && psPrintSuggest && psPrintSuggest.entry === psPrint.entry ? psPrintSuggest.pct : null;
    el.classList.toggle("hidden", !s);
    el.textContent = s ? "Suggested: " + s + "%" : "";
  }
  async function psPrintSuggestUpdate() {
    const entry = psPrint && psPrint.entry;
    if (!entry) return null;
    let pct = null;
    try { pct = psPrintSuggestPct(await psPrintTexture()); } catch (e) { traceErr("ps print: suggested scale", e); }
    psPrintSuggest = pct ? { entry: entry, pct: pct } : null;
    if (pct && !psPrintPlaced()) { const sc = $("ps-print-scale"); if (sc) { sc.value = String(pct); psPrintScaleSet = true; } }
    psPrintSuggestRender();
    psPrintDirtySync();
    return pct;
  }
  function psPrintOnTabOpen() {
    const cc = $("ps-print-continuous");
    if (cc && !cc.__kbWired) { cc.__kbWired = true; cc.addEventListener("change", actPsPrintContinuous); }
    const sc = $("ps-print-scale");
    if (sc && !sc.__kbWired) { sc.__kbWired = true; sc.addEventListener("input", function () { psPrintScaleSet = true; psPrintDirtySync(); }); }
    const ps2 = $("ps-part-scale");
    if (ps2 && !ps2.__kbWired) {
      ps2.__kbWired = true;
      ps2.addEventListener("input", function () {
        const n = readPills("pills-ps-parts", null);
        psPartScaleTyped = n ? { name: n, raw: ps2.value } : null;
        psPrintDirtySync();
      });
    }
    psPrintSuggestRender();
    psPrintButtonSync();
    const el = $("ps-print-name");
    if (el) el.textContent = psPrint ? psPrint.name : "No print chosen";
    psPrintThumbRender();
    psPrintRefreshPart();
  }
  // the chosen print's thumbnail (step 7): a downscaled copy made here
  // in Photoshop (the file opened as its own document, read small, closed unsaved),
  // shown as an image in the panel. Never sent anywhere.
  const PS_THUMB_H = 120;
  let psPrintThumb = null;                             // { entry, src, w, h, W, H, bits }
  async function psPrintThumbMake(entry) {
    const ps = psMod(), app = ps.app, homeDoc = app.activeDocument;
    let out = null;
    await ps.core.executeAsModal(async function () {
      const pd = await app.open(entry);
      try {
        const W = Math.round(pd.width), H = Math.round(pd.height);
        const bm = /(\d+)/.exec(String(pd.bitsPerChannel || "")), bits = bm ? Number(bm[1]) : null;
        if (!(W > 0 && H > 0)) throw new Error("the print file has no pixels.");
        try { if (!/rgb/i.test(String(pd.mode || ""))) await pd.changeMode(ps.constants.ChangeMode.RGB); } catch (_) {}
        try { if (bits && bits !== 8) pd.bitsPerChannel = ps.constants.BitsPerChannel.EIGHT; } catch (_) {}
        const th = Math.min(H, PS_THUMB_H * 2), tw = Math.max(1, Math.round(W * th / H));     // 2x for a sharp 120 px
        const opts = { documentID: pd.id, sourceBounds: { left: 0, top: 0, right: W, bottom: H }, componentSize: 8, applyAlpha: true };
        if (tw < W || th < H) opts.targetSize = { width: tw, height: th };
        const pr = await ps.imaging.getPixels(opts);
        if (!pr || !pr.imageData) throw new Error("no pixels read.");
        let enc;
        try { enc = await ps.imaging.encodeImageData({ imageData: pr.imageData }); }
        finally { try { pr.imageData.dispose(); } catch (_) {} }
        const b64 = kbEncodedToBase64(enc).replace(/\s+/g, "");
        out = { entry: entry, src: "data:" + kbMimeOfBase64(b64) + ";base64," + b64, W: W, H: H, bits: bits };
      } finally {
        try { await pd.closeWithoutSaving(); } catch (_) {}
        try { if (homeDoc) app.activeDocument = homeDoc; } catch (_) {}
      }
    }, { commandName: "KBImage — print thumbnail" });
    return out;
  }
  function psPrintThumbRender() {
    const box = $("ps-print-thumb"), img = $("ps-print-thumb-img"), info = $("ps-print-thumb-info");
    if (!box) return;
    const t = psPrint && psPrintThumb && psPrintThumb.entry === psPrint.entry ? psPrintThumb : null;
    box.classList.toggle("hidden", !psPrint);
    if (!psPrint) return;
    if (img) {
      img.classList.toggle("hidden", !(t && t.src));
      if (t && t.src) {
        const h = Math.min(PS_THUMB_H, t.H), w = Math.max(1, Math.round(t.W * h / t.H));
        img.src = t.src; img.style.height = h + "px"; img.style.width = w + "px";
      }
    }
    if (info) info.textContent = psPrint.name + (t && t.W ? "\n" + t.W + "×" + t.H + " px" + (t.bits ? " · " + t.bits + "-bit" : "") : (t && t.err ? "\nNo preview: " + t.err : "\nMaking the preview…"));
  }
  async function psPrintThumbUpdate() {
    const entry = psPrint && psPrint.entry;
    if (!entry) { psPrintThumb = null; psPrintThumbRender(); return; }
    psPrintThumb = { entry: entry };
    psPrintThumbRender();
    try {
      const t = await psPrintThumbMake(entry);
      if (psPrint && psPrint.entry === entry) psPrintThumb = t || { entry: entry, err: "nothing read" };
    } catch (e) {
      traceErr("ps print thumbnail", e);
      if (psPrint && psPrint.entry === entry) psPrintThumb = { entry: entry, err: (e && e.message) || String(e) };
    }
    psPrintThumbRender();
  }
  // "The step 8 Build shading preview is still waiting: click Accept (or Discard) under
  // Build shading in step 8, then click Apply print again."
  const PS_STEP_RUN = { 0: "Upscale", 1: "Background", 3: "Remove old print", 4: "trim", 5: "Make gray", 6: "Find parts", 7: "Apply print", 8: "Build shading", 9: "Finish" };
  function psPendingBlockText(action) {
    const d = pendingRecall && pendingRecall.descriptor, n = d && d.psStep;
    const what = n != null && PS_STEP_RUN[n] ? "step " + n + " " + PS_STEP_RUN[n] : "another step's";
    return "The " + what + " preview is still waiting: click Accept (or Discard) under it" + (n != null ? " in step " + n : "") + ", then click " + action + " again.";
  }
  // Another Print Swap step's preview waiting? A new run would discard its layers.
  function psOtherPending(opPrefix) {
    if (!pendingRecall || !pendingRecall.descriptor) return false;
    const op = String(pendingRecall.descriptor.op || "");
    return op.indexOf("printswap:") === 0 && op.indexOf(opPrefix) !== 0;
  }

  async function actPsChoosePrint(quiet) {
    let picked;
    try { picked = await fsLocal().getFileForOpening({ types: ["png", "jpg", "jpeg", "tif", "tiff"], allowMultiple: false }); }
    catch (e) { setStatus("bad", "File picker error: " + ((e && e.message) || String(e))); return null; }
    const entry = Array.isArray(picked) ? picked[0] : picked;
    if (!entry) { setStatus("muted", "Cancelled."); return null; }
    psPrint = { name: entry.name || "print", entry: entry };
    psPrintTex = null;
    psPrintOnTabOpen();
    await psPrintThumbUpdate();                         // thumbnail, size and bit depth
    if (quiet !== true) setStatus("ok", "Print chosen: " + psPrint.name + ". Click Apply print.");
    return psPrint;
  }

  // ----- One part --------------------------------------------------------------
  async function psPrintTexture() {
    if (psPrintTex && psPrintTex.entry === psPrint.entry) return psPrintTex.tex;
    setStatus("busy", "Reading the print…");
    const tex = await kbReadPrintTexture(psPrint.entry, KB_TEX_MAX);
    if (!tex || !tex.data) throw new Error("could not read the print file's pixels.");
    if (tex.components < 3) throw new Error("the print read back with " + tex.components + " channel(s); save it as an RGB PNG or JPG.");
    psPrintTex = { entry: psPrint.entry, tex: tex };
    trace("ps print: " + psPrint.name + " " + tex.layerW + "x" + tex.layerH + " (read " + tex.width + "x" + tex.height + " via " + tex.via + ")");
    return tex;
  }

  // The part's box (from its channel) and, when asked, its long-axis angle
  // (PCA on the shape layer's own pixels, sampled to ≤ 400 px).
  async function psPartGeometry(name, wantAxis) {
    const ps = psMod();
    const doc = ps.app.activeDocument;
    const docW = Math.round(doc.width), docH = Math.round(doc.height);
    let bbox = null, axis = null;
    await ps.core.executeAsModal(async function () {
      await kbLoadChannel(PS_PART_CH + name);
      const b = kbSelectionBounds();
      if (b) {
        const l = Math.max(0, Math.floor(Number(b.left))), t = Math.max(0, Math.floor(Number(b.top)));
        const r = Math.min(docW, Math.ceil(Number(b.right))), m = Math.min(docH, Math.ceil(Number(b.bottom)));
        if (r > l && m > t) bbox = { left: l, top: t, right: r, bottom: m };
      }
      try { await deselectAll(); } catch (_) {}
      if (bbox && wantAxis) {
        const sh = psShapeLayer(name);
        if (sh) {
          const g = await kbReadGarmentLuma(sh.id, bbox);
          const bw = bbox.right - bbox.left, bh = bbox.bottom - bbox.top;
          const s = Math.max(1, Math.ceil(Math.max(bw, bh) / 400));
          const gw = Math.ceil(bw / s), gh = Math.ceil(bh / s), pl = new Uint8Array(gw * gh);
          for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) pl[y * gw + x] = g.alpha[(y * s) * bw + x * s];
          axis = kbAxisAngle(pl, gw, gh);
        }
      }
    }, { commandName: "KBImage — read part" });
    return { bbox: bbox, axis: axis };
  }

  function psPrintIds(name) {
    const g = psPartGroup(name);
    const out = [];
    try { if (g) for (let i = 0; i < g.layers.length; i++) if (String(g.layers[i].name) === PS_PRINT_LAYER) out.push(g.layers[i].id); } catch (_) {}
    return out;
  }
  // Inside executeAsModal: delete every "PRINT" layer in the part's group.
  async function psDeletePrintsInModal(name) {
    const ids = psPrintIds(name);
    for (let i = 0; i < ids.length; i++) await psDeleteLayerInModal(ids[i]);
  }

  // Inside executeAsModal: Create Clipping Mask on the active layer. Throws
  // Photoshop's exact error.
  async function psClipActiveInModal() {
    try {
      await psMod().action.batchPlay(
        [{ _obj: "groupEvent", _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
           _options: { dialogOptions: "dontDisplay" } }], { synchronousExecution: true });
    } catch (e) {
      throw new Error("Create Clipping Mask failed — Photoshop said: " + ((e && e.message) || String(e)));
    }
  }

  // Tile the print into one part → its PRINT layer. Returns the layer id, or null
  // (empty part: any old PRINT removed). pst = the part's saved { auto, own, nudge, scale }.
  // cont (Continuous, the default): one shared grid for every part, anchored at the
  // document's top-left, at the whole garment's scale and angle, so the pattern runs on
  // across seams, the pocket and the placket as if cut from one piece of fabric. A part's
  // own scale or angle still overrides it for that part. Off: each part tiled along its
  // own direction (pst.auto, the long axis), centred on the part.
  function psPrintContinuous(st) { return !st || st.continuous !== false; }
  // The part has its own angle or scale (This part), so it leaves the shared grid.
  function psPartOwnsPrint(pst) { return !!pst && ((pst.own != null && isFinite(Number(pst.own))) || !!Number(pst.nudge) || (pst.scale != null && pst.scale > 0)); }
  // Pure: the anchor for a tile tileW × tileH at rot° that shows, at point (cx, cy), the same
  // spot of the print as the shared grid (garment scale and angle, anchored at the
  // document's top-left). kbComposeTile maps a point to the tile by
  //   fu = ((x − ax)·cos + (y − ay)·sin) / tileW,  fv = ((y − ay)·cos − (x − ax)·sin) / tileH.
  function psSharedAnchorAt(cx, cy, tex, garmentScale, garmentRot, tileW, tileH, rot) {
    const gW = Math.max(2, Math.round(tex.layerW * garmentScale / 100)), gH = Math.max(2, Math.round(tex.layerH * garmentScale / 100));
    const g = (Number(garmentRot) || 0) * Math.PI / 180, c0 = Math.cos(g), s0 = Math.sin(g);
    const dx0 = cx - gW / 2, dy0 = cy - gH / 2;
    const fu = (dx0 * c0 + dy0 * s0) / gW, fv = (dy0 * c0 - dx0 * s0) / gH;
    const r = rot * Math.PI / 180, c1 = Math.cos(r), s1 = Math.sin(r);
    const U = fu * tileW, V = fv * tileH;
    return { x: cx - (U * c1 - V * s1), y: cy - (U * s1 + V * c1) };
  }
  async function psRenderPartPrint(name, pst, garmentScale, tex, garmentRot, cont) {
    const ps = psMod();
    const shape = psShapeLayer(name);
    if (!shape) { trace("ps print: " + name + " has no shape layer — skipped"); return null; }
    if (!kbChannelExists(PS_PART_CH + name)) {
      await ps.core.executeAsModal(async function () { await psDeletePrintsInModal(name); }, { commandName: "KBImage — clear print" });
      return null;
    }
    const geo = await psPartGeometry(name, pst.auto == null);
    if (!geo.bbox) return null;
    if (pst.auto == null) pst.auto = geo.axis ? geo.axis.angle : 0;
    const bbox = geo.bbox, bw = bbox.right - bbox.left, bh = bbox.bottom - bbox.top;
    if (bw * bh > 64 * 1000 * 1000) throw new Error(name + " is very large (" + bw + " × " + bh + " px).");
    const scale = (pst.scale != null && pst.scale > 0) ? pst.scale : garmentScale;
    const tileW = Math.max(2, Math.round(tex.layerW * scale / 100));
    const tileH = Math.max(2, Math.round(tex.layerH * scale / 100));
    const rot = cont ? psPartAngle(pst, garmentRot)                       // one fabric: the garment's angle (or the part's own)
      : (Number(pst.auto) || 0) + psPartAngle(pst, garmentRot);           // the part's direction + its angle
    const cx = (bbox.left + bbox.right) / 2, cy = (bbox.top + bbox.bottom) / 2;
    let ax = cont ? tileW / 2 : cx, ay = cont ? tileH / 2 : cy;           // shared grid: a tile's corner on the document's top-left
    if (cont && psPartOwnsPrint(pst)) {
      // The exception: this part's own angle or scale turns / scales its print around the
      // part's centre, starting from where the shared grid puts it there (same tile phase
      // at the centre), so it still lines up as closely as it can.
      const a = psSharedAnchorAt(cx, cy, tex, garmentScale, garmentRot, tileW, tileH, rot);
      ax = a.x; ay = a.y;
    }
    const buf = kbComposeTile(bw, bh, bbox.left, bbox.top, tex.data, tex.width, tex.height, tex.components,
      tileW, tileH, rot, ax, ay, null);
    for (let i = 3; i < buf.length; i += 4) {             // opaque PNG only (transparent ones landed shifted)
      const al = buf[i];
      if (al < 255) { const k = al / 255; buf[i - 3] = Math.round(buf[i - 3] * k + 255 * (1 - k)); buf[i - 2] = Math.round(buf[i - 2] * k + 255 * (1 - k)); buf[i - 1] = Math.round(buf[i - 1] * k + 255 * (1 - k)); buf[i] = 255; }
    }
    const file = await kbRgbaToFile(buf, bw, bh);
    let id = null;
    try {
      await ps.core.executeAsModal(async function () {
        await psDeletePrintsInModal(name);
        const sh = psShapeLayer(name);
        try { await deselectAll(); } catch (_) {}
        await kbSelectLayerById(sh.id);
        try { await selectRGBChannel(); } catch (_) {}
        id = await kbPlaceFileInModal(file, PS_PRINT_LAYER, bbox);
        await kbSelectLayerById(id);
        await psClipActiveInModal();
        try { sh.visible = true; } catch (_) {}                // the clip shows only through a visible base
        // The inside of the neck sits in shadow: Hue/Saturation 2 clipped above its print (team), neutral.
        if (/NECK$/.test(name) && !psChildNamed(psPartGroup(name), "Hue/Saturation 2")) {
          await psSelectLayerVerifiedInModal(id, "PRINT");
          await psMakeClippedInModal("Hue/Saturation 2", { _obj: "make", _target: [{ _ref: "adjustmentLayer" }],
            using: { _obj: "adjustmentLayer", name: "Hue/Saturation 2", type: psHueSatDesc({ hue: 0, saturation: 0, lightness: 0 }) },
            _options: { dialogOptions: "dontDisplay" } });
        }
      }, { commandName: "KBImage — print " + name });
    } finally { await kbDeleteFile(file); }
    trace("ps print: " + name + " box " + bw + "x" + bh + ", scale " + scale + "% (repeat " + tileW + "x" + tileH + "), angle " + rot.toFixed(1) + "°"
      + (cont ? (psPartOwnsPrint(pst) ? ", continuous, its own angle / scale around its centre (anchor " + Math.round(ax) + "," + Math.round(ay) + ")" : ", continuous (shared grid)") : ", own direction"));
    return id;
  }

  // ----- PLACE / SWAP ------------------------------------------------------------
  async function executePsPrint(params) {
    const ps = psMod();
    if (!ps.app.activeDocument) throw new Error("Open a Photoshop document first.");
    if (!psPartsGroup()) throw new Error("there is no PARTS group. Find parts and Accept them first (step 6).");
    let step = "reading the print";
    try {
      const tex = await psPrintTexture();
      const state = await psStateLoad();
      if (params.scalePct != null) state.scalePct = params.scalePct;      // the scale in the box
      if (params.partScale && params.partScale.name) {                      // This part scale typed since the last Apply
        const q = state.parts[params.partScale.name] || { auto: null, nudge: 0, scale: null };
        q.scale = params.partScale.scale; state.parts[params.partScale.name] = q;
      }
      params.scalePct = state.scalePct || 100;
      state.printName = params.printName;
      const ids = [], placed = [], empty = [];
      const ckT = psGtypeById(psGarmentType), ck = ckT ? psCheckedFor(ckT) : null;
      const printNames = psPartNames().filter(function (n) { return n !== PS_UNASSIGNED && (!ck || ck.has(n) || !psGtypeParts(ckT).some(function (p) { return p.n === n; })); });   // unchecked: skipped
      for (let i = 0; i < printNames.length; i++) {
        const name = printNames[i];
        step = "printing " + name;
        setStatus("busy", "Printing " + name + " (" + (i + 1) + " of " + printNames.length + ")…");
        const pst = state.parts[name] || { auto: null, nudge: 0, scale: null };
        if (!params.keepAngles) pst.auto = null;              // a first Apply print measures each part again
        const id = await psRenderPartPrint(name, pst, params.scalePct, tex, state.rotDeg, psPrintContinuous(state));
        state.parts[name] = pst;
        if (id != null) { ids.push(id); placed.push(name); } else empty.push(name);
      }
      step = "saving the scale and angles";
      params.savedInDoc = await psStateSave(state);
      params.placed = placed.length; params.empty = empty;
      return { layerIds: ids, afterSnapshotRef: null, state: {} };
    } catch (err) {
      const e2 = new Error("Apply print failed while " + step + ": " + ((err && err.message) || String(err)));
      e2.cause = err;
      throw e2;
    }
  }

  async function psRunPrint(keepAngles, partScale, sameScale) {
    const ps = psMod();
    const doc = ps.app.activeDocument;
    if (!doc) { setStatus("bad", "Open a Photoshop document first."); return; }
    const problem = kbDocProblem(doc);
    if (problem) { setStatus("bad", problem); return; }
    if (!psPartsGroup()) { setStatus("bad", "Find parts and Accept them first (step 6)."); return; }
    if (psOtherPending("printswap:print")) { setStatus("bad", psPendingBlockText("Apply print")); return; }
    if (!psPrint) { setStatus("bad", "Click Swap print first."); return; }
    const op = keepAngles ? "printswap:print-swap" : "printswap:print";
    const params = function () { return { printName: psPrint ? psPrint.name : null, scalePct: psPrintScale(), keepAngles: !!keepAngles, partScale: partScale || null }; };   // the scale in the box
    const p = params();
    generateInFlight = true;
    traceStart("Print Swap — Apply print " + p.printName + (keepAngles ? " (replace)" : ""));
    try {
      await psRecall(7, "ps-recall-anchor-7", {
        op: op, params: p, targetLayerId: null,
        sourceRef: "print:" + p.printName + " scale:" + p.scalePct,
        paramsProvider: params, execute: executePsPrint,
        onSettle: async function (state, accepted) {           // Accept: the Backup group follows this print
          if (!accepted) return null;
          psBackupNote("");
          try { await psBackupUpdate(); }
          catch (e) {                                          // the print stays accepted; the reason shows in red
            traceErr("ps backup", e);
            const m = "Backup not made: " + String((e && e.message) || e).replace(/[.\s]+$/, "") + ".";
            psBackupNote(m);
            return { kind: "bad", text: "Print accepted. " + m };
          } finally { await traceFlush(); }
          return null;
        },
      });
      psPartScaleTyped = null;
      setStatus("ok", (sameScale ? "Print applied: " : keepAngles ? "Replaced with " : "Placed ") + p.printName + " at " + p.scalePct + "% in " + p.placed + " part(s)"
        + (p.empty && p.empty.length ? " (no pixels, no print: " + p.empty.join(", ") + ")" : "")
        + "." + (p.savedInDoc ? "" : " The scale and angles were saved in the plug-in folder only (the document did not take them).")
        + " Accept to keep, or Re-run.");
    } catch (err) {
      traceErr("ps print", err && err.cause ? err.cause : err);
      setStatus("bad", (err && err.message) || "Apply print failed.");
    } finally {
      generateInFlight = false;
      try { psPrintRefreshPart(); psPartsRefreshList(); updateDocInfo(); } catch (_) {}
      await traceFlush();
    }
  }

  // Backup (hidden, at the bottom of PS, under PARTS), made again on every accepted Apply
  // print: "PRINT source · <file>" (the print file placed as a smart object at 100%, its own
  // pixels, untouched) and "PRINT tiled · <file>" (one layer over the garment's box at the
  // whole-garment scale and angle on the shared grid, as Continuous tiles it, so a part patched
  // from it lines up). Safe order, so nothing is ever visible: the old Backup and any stray
  // PRINT source / tiled go; an empty Backup is made at the bottom of PS and hidden; then a
  // layer INSIDE it is selected and each file placed there. If any part fails, every layer this
  // run made is deleted (unlocked first) and the reason thrown. Hidden, so MERGED never takes it.
  function psBackupNote(text) {
    const el = $("ps-backup-note");
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("hidden", !text);
  }
  function psAllLayerIds() {
    const out = {};
    const walk = function (list) { try { for (let i = 0; i < list.length; i++) { out[list[i].id] = 1; let k = null; try { k = list[i].layers; } catch (_) {} if (k) walk(k); } } catch (_) {} };
    try { walk(psMod().app.activeDocument.layers); } catch (_) {}
    return out;
  }
  function psParentId(l) { let p = null; try { p = l && l.parent; } catch (_) {} return p ? p.id : null; }
  // Inside executeAsModal: a new, empty, hidden Backup at the bottom of PS (never inside
  // PARTS), made around one empty placeholder layer, which is returned to select: a file
  // placed with it selected lands inside Backup. Returns { gid, tmpId }.
  async function psBackupMakeInModal() {
    const ps = psMod(), EP = ps.constants.ElementPlacement, P = psPsGroup();
    if (!P) throw new Error("there is no " + PS_PS_GROUP + " group");
    try {
      await ps.action.batchPlay([{ _obj: "selectNoLayers", _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
        _options: { dialogOptions: "dontDisplay" } }], { synchronousExecution: true });
    } catch (_) {}
    try { await selectRGBChannel(); } catch (_) {}
    try {
      await ps.action.batchPlay([{ _obj: "make", _target: [{ _ref: "layer" }], using: { _obj: "layer", name: KB_BACKUP_TMP },
        _options: { dialogOptions: "dontDisplay" } }], { synchronousExecution: true });
    } catch (e) { throw new Error("making the empty layer for " + PS_BACKUP_GROUP + " failed (Photoshop said: " + ((e && e.message) || String(e)) + ")"); }
    const tmpId = kbActiveLayerId(), tmp = tmpId != null ? kbLayerById(tmpId) : null;
    if (!tmp || String(tmp.name) !== KB_BACKUP_TMP) throw new Error("the empty layer for " + PS_BACKUP_GROUP + " was not made");
    try { tmp.visible = false; } catch (_) {}
    if (psParentId(tmp) !== P.id) tmp.move(P, EP.PLACEINSIDE);
    const last = P.layers[P.layers.length - 1];
    if (last && last.id !== tmpId) kbPlaceAfterInModal(tmp, last);   // the bottom of PS: under PARTS, not in it
    const gid = await psGroupInModal([tmpId], PS_BACKUP_GROUP);
    const g = gid != null ? kbLayerById(gid) : null;
    if (!g || String(g.name) !== PS_BACKUP_GROUP) throw new Error("the " + PS_BACKUP_GROUP + " group was not made");
    try { g.visible = false; } catch (_) {}
    psPassThrough(g);
    const P2 = psPsGroup(), bottom = P2 && P2.layers[P2.layers.length - 1];
    if (psParentId(g) !== P.id || !bottom || bottom.id !== gid) throw new Error("the " + PS_BACKUP_GROUP + " group did not land at the bottom of " + PS_PS_GROUP);
    if (psParentId(kbLayerById(tmpId)) !== gid) throw new Error("the empty layer is not in " + PS_BACKUP_GROUP);
    return { gid: gid, tmpId: tmpId };
  }
  async function psBackupUpdate() {
    if (!psPsGroup()) throw new Error("there is no " + PS_PS_GROUP + " group");
    if (!psPartGroupsAll().length) throw new Error("there are no part groups in " + PS_PARTS_GROUP);
    if (!psPrint) throw new Error("the print file is not known since a panel reload (pick it again with Swap print)");
    const ps = psMod();
    const name = psPrint.name;
    const tex = await psPrintTexture();
    const state = await psStateLoad();
    const gb = await psGarmentBox(0), r = gb.rect, bw = r.right - r.left, bh = r.bottom - r.top;
    if (bw * bh > 64 * 1000 * 1000) throw new Error("the garment is very large (" + bw + " × " + bh + " px)");
    const scale = state.scalePct || 100, rot = Number(state.rotDeg) || 0;
    const tileW = Math.max(2, Math.round(tex.layerW * scale / 100)), tileH = Math.max(2, Math.round(tex.layerH * scale / 100));
    const buf = kbComposeTile(bw, bh, r.left, r.top, tex.data, tex.width, tex.height, tex.components, tileW, tileH, rot, tileW / 2, tileH / 2, null);
    for (let i = 3; i < buf.length; i += 4) {               // opaque PNG only (transparent ones landed shifted)
      const al = buf[i];
      if (al < 255) { const k = al / 255; buf[i - 3] = Math.round(buf[i - 3] * k + 255 * (1 - k)); buf[i - 2] = Math.round(buf[i - 2] * k + 255 * (1 - k)); buf[i - 1] = Math.round(buf[i - 1] * k + 255 * (1 - k)); buf[i] = 255; }
    }
    const file = await kbRgbaToFile(buf, bw, bh);
    const srcTok = await fsLocal().createSessionToken(psPrint.entry);
    let gid = null;
    try {
      await ps.core.executeAsModal(async function () {
        let step = "removing the old " + PS_BACKUP_GROUP;
        const old = psBackupGroup();                       // a swap replaces both
        if (old) { const f = await kbDeleteLayerSafeInModal(old.id); if (f) throw new Error("the old " + PS_BACKUP_GROUP + " could not be removed (" + f.why + ")"); }
        const strays = psBackupPrints();                   // left by an older run: the newest pair replaces them
        for (let i = 0; i < strays.length; i++) { const f = await kbDeleteLayerSafeInModal(strays[i].id); if (f) throw new Error(f.name + " could not be removed (" + f.why + ")"); }
        const before = psAllLayerIds();
        try {
          step = "making the empty " + PS_BACKUP_GROUP + " group";
          const mk = await psBackupMakeInModal();
          gid = mk.gid;
          const inBk = function (id, what) {
            const l = id != null ? kbLayerById(id) : null;
            if (!l) throw new Error(what + " did not appear");
            if (psParentId(l) !== gid) throw new Error(what + " did not land in " + PS_BACKUP_GROUP);
            return l;
          };
          // the source: placed inside Backup, kept a smart object, set back to 100% if Photoshop scaled it
          step = "placing PRINT source";
          try { await deselectAll(); } catch (_) {}
          await kbSelectLayerById(mk.tmpId);
          try { await selectRGBChannel(); } catch (_) {}
          if (kbActiveLayerId() !== mk.tmpId) throw new Error("the layer inside " + PS_BACKUP_GROUP + " could not be selected");
          await ps.action.batchPlay([{ _obj: "placeEvent", target: { _path: srcTok },
            freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" },
            offset: { _obj: "offset", horizontal: { _unit: "pixelsUnit", _value: 0 }, vertical: { _unit: "pixelsUnit", _value: 0 } },
            _options: { dialogOptions: "dontDisplay" } }], { synchronousExecution: true });
          const srcId = kbActiveLayerId();
          if (srcId == null || srcId === mk.tmpId || before[srcId]) throw new Error("the print file did not place");
          const src = inBk(srcId, "PRINT source");
          try { await renameActiveLayer("PRINT source · " + name); } catch (_) {}
          if (!psIsBackupPrint(src.name)) { try { src.name = "PRINT source · " + name; } catch (_) {} }
          try {
            const b = src.bounds, cw = Number(b.right) - Number(b.left), ch = Number(b.bottom) - Number(b.top);
            if (cw > 0 && ch > 0 && (Math.abs(cw - tex.layerW) > 0.5 || Math.abs(ch - tex.layerH) > 0.5)) {
              await ps.action.batchPlay([{ _obj: "transform", _target: [{ _ref: "layer", _id: srcId }],
                freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" },
                width: { _unit: "percentUnit", _value: tex.layerW / cw * 100 }, height: { _unit: "percentUnit", _value: tex.layerH / ch * 100 },
                _options: { dialogOptions: "dontDisplay" } }], { synchronousExecution: true });
            }
          } catch (e) { traceErr("ps backup: source at 100%", e); }
          // the tiled copy over the garment's box, placed with the source selected: inside Backup too
          step = "placing PRINT tiled";
          await kbSelectLayerById(srcId);
          try { await selectRGBChannel(); } catch (_) {}
          if (kbActiveLayerId() !== srcId) throw new Error("PRINT source could not be selected");
          const tId = await kbPlaceFileInModal(file, "PRINT tiled · " + name, r);
          if (tId == null || before[tId]) throw new Error("the tiled print did not place");
          const t = inBk(tId, "PRINT tiled");
          if (!psIsBackupPrint(t.name)) { try { t.name = "PRINT tiled · " + name; } catch (_) {} }
          kbPlaceAfterInModal(t, kbLayerById(srcId));        // source on top, tiled under it
          step = "removing the empty layer";
          const f = await kbDeleteLayerSafeInModal(mk.tmpId);
          if (f) throw new Error("the empty layer could not be removed (" + f.why + ")");
          step = "checking " + PS_BACKUP_GROUP;
          const g = kbLayerById(gid), P = psPsGroup();
          const kids = g ? Array.from(g.layers).map(function (l) { return l.id; }) : [];
          if (kids.length !== 2 || kids.indexOf(srcId) < 0 || kids.indexOf(tId) < 0) throw new Error(PS_BACKUP_GROUP + " does not hold just PRINT source and PRINT tiled");
          try { g.visible = false; } catch (_) {}
          if (g.visible !== false) throw new Error(PS_BACKUP_GROUP + " could not be hidden");
          if (!P || P.layers[P.layers.length - 1].id !== gid) throw new Error(PS_BACKUP_GROUP + " is not at the bottom of " + PS_PS_GROUP);
        } catch (e) {                                       // nothing stays: every layer this run made goes, unlocked first
          const now = psAllLayerIds(), made = Object.keys(now).map(Number).filter(function (id) { return !before[id]; });
          if (gid != null && made.indexOf(gid) >= 0) { made.splice(made.indexOf(gid), 1); made.unshift(gid); }   // the group first: its layers go with it
          const kept = [];
          for (let i = 0; i < made.length; i++) { if (!kbLayerById(made[i])) continue; const f = await kbDeleteLayerSafeInModal(made[i]); if (f) kept.push(f.name); }
          gid = null;
          trace("ps backup: failed while " + step + "; removed what it made" + (kept.length ? " except " + kept.join(", ") : ""));
          throw new Error(step + ": " + String((e && e.message) || e).replace(/[.\s]+$/, "")
            + (kept.length ? ". " + kept.join(", ") + " could not be removed; delete " + (kept.length === 1 ? "it" : "them") + " in Layers" : ""));
        }
      }, { commandName: "KBImage — Backup" });
    } finally { await kbDeleteFile(file); }
    trace("ps backup: " + name + " (source at 100%, tiled " + bw + "x" + bh + " at " + scale + "%, " + rot + "°), group " + gid + ", hidden at the bottom of " + PS_PS_GROUP);
    return gid;
  }
  // Inside executeAsModal: any PRINT source / PRINT tiled outside Backup is hidden and moved
  // into it (Backup made, hidden, at the bottom of PS when missing), and Backup is hidden.
  // Returns the number of layers moved. dry = only count them.
  function psBackupStrays() {
    const bk = psBackupGroup();
    return psBackupPrints().filter(function (l) { return !bk || psParentId(l) !== bk.id; });
  }
  async function psBackupTidyInModal() {
    const strays = psBackupStrays();
    let bk = psBackupGroup();
    if (!strays.length) { if (bk) { try { bk.visible = false; } catch (_) {} } return 0; }
    strays.forEach(function (l) { try { l.visible = false; } catch (_) {} });   // hidden before anything moves
    if (!psPsGroup()) return 0;                             // no PS (an older file): hidden where they are
    const EP = psMod().constants.ElementPlacement;
    let tmpId = null;
    if (!bk) { const mk = await psBackupMakeInModal(); bk = kbLayerById(mk.gid); tmpId = mk.tmpId; }
    try { bk.visible = false; } catch (_) {}
    for (let i = 0; i < strays.length; i++) {
      const l = kbLayerById(strays[i].id), first = bk.layers[0];
      if (!l) continue;
      if (first) l.move(first, EP.PLACEBEFORE); else l.move(bk, EP.PLACEINSIDE);
      if (psParentId(kbLayerById(l.id)) !== bk.id) throw new Error(String(l.name) + " did not land in " + PS_BACKUP_GROUP);
    }
    if (tmpId != null) await kbDeleteLayerSafeInModal(tmpId);
    const P = psPsGroup(), last = P.layers[P.layers.length - 1];
    if (last.id !== bk.id) kbPlaceAfterInModal(bk, last);   // Backup: always at the bottom
    trace("ps backup: " + strays.length + " PRINT layer(s) moved into " + PS_BACKUP_GROUP + " (hidden): " + strays.map(function (l) { return String(l.name); }).join(", "));
    return strays.length;
  }
  // A document opens: stray PRINT source / tiled into Backup, hidden. Once per document.
  let psBackupTidyDone = {};
  async function psBackupTidy(docId) {
    if (docId == null || psBackupTidyDone[docId] || generateInFlight) return;
    if (pendingRecall && pendingRecall.descriptor && /^printswap:print/.test(String(pendingRecall.descriptor.op))) return;
    psBackupTidyDone[docId] = true;
    if (!psBackupStrays().length) return;
    generateInFlight = true;
    try {
      let n = 0;
      await psMod().core.executeAsModal(async function () { n = await psBackupTidyInModal(); }, { commandName: "KBImage — Backup" });
      if (n) setStatus("ok", n + " PRINT layer" + (n === 1 ? " was" : "s were") + " outside " + PS_BACKUP_GROUP + "; moved into " + PS_PS_GROUP + " › " + PS_BACKUP_GROUP + " (hidden).");
    } catch (e) { traceErr("ps backup tidy", e); setStatus("bad", "Could not move the PRINT layers into " + PS_BACKUP_GROUP + ": " + ((e && e.message) || String(e))); }
    finally { generateInFlight = false; }
  }

  // Whole-garment rotation: ↺ / ↻ by data-deg, data-set="0" back to 0°, data-set="field"
  // the exact angle typed in. Saved with the scale and angles; every part that has a
  // print is tiled again from the print file (nothing is transformed). With no print
  // placed yet, the angle is only saved and used by Apply print.
  // Every part that has a print, tiled again from the print file with `state` (scale and
  // angles). Returns the parts redone, or null (status set) when the print file is not
  // known since a panel reload. A Place / Swap preview waiting keeps the NEW layers.
  async function psRedoAllPrints(state, verb) {
    const ckT = psGtypeById(psGarmentType), ck = ckT ? psCheckedFor(ckT) : null;
    const parts = psPartNames().filter(function (n) { return n !== PS_UNASSIGNED && psPrintIds(n).length && (!ck || ck.has(n) || !psGtypeParts(ckT).some(function (p) { return p.n === n; })); });
    if (parts.length && !psPrint) { setStatus("bad", "Click Swap print first (pick the same file again after a panel reload)."); return null; }
    const redone = [];
    if (!parts.length) return redone;
    const tex = await psPrintTexture();
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i], old = psPrintIds(name);
      setStatus("busy", verb + " " + name + " (" + (i + 1) + " of " + parts.length + ")…");
      const pst = state.parts[name] || { auto: null, nudge: 0, scale: null };
      const id = await psRenderPartPrint(name, pst, state.scalePct || psPrintScale(), tex, state.rotDeg, psPrintContinuous(state));
      state.parts[name] = pst;
      redone.push(name);
      if (pendingRecall && Array.isArray(pendingRecall.layerIds)) {
        pendingRecall.layerIds = pendingRecall.layerIds.filter(function (x) { return old.indexOf(x) < 0; });
        if (id != null) pendingRecall.layerIds.push(id);
      }
    }
    return redone;
  }
  // Continuous on / off: saved with the document, every part that has a print tiled again.
  async function actPsPrintContinuous() {
    const cc = $("ps-print-continuous");
    if (!cc) return;
    const on = !!cc.checked;
    if (generateInFlight) { cc.checked = !on; setStatus("bad", "Wait for the current run to finish, then change Continuous."); return; }
    if (!psMod().app.activeDocument) { cc.checked = !on; setStatus("bad", "Open a Photoshop document first."); return; }
    generateInFlight = true;
    traceStart("Print Swap — Continuous " + (on ? "on" : "off"));
    try {
      const state = await psStateLoad();
      state.continuous = on;
      const redone = await psRedoAllPrints(state, on ? "One fabric across" : "Tiling on its own");
      if (redone === null) { cc.checked = !on; return; }
      const inDoc = await psStateSave(state);
      const rec = logRecordSkeleton("printswap:print-continuous", { continuous: on, parts: redone.length }, null, "print:" + (psPrint ? psPrint.name : ""));
      await logRun(rec); await logFinalizeCommitted(rec.id);
      const mm = redone.length && !psMergedHeld && psMergedAccepted() ? await psMergedRebuild(true) : null;
      setStatus("ok", "Continuous " + (on ? "on: one fabric across every part" : "off: each part tiled along its own direction")
        + (redone.length ? ", print redone in " + redone.length + " part(s)." : ". Apply print uses it.")
        + (inDoc ? "" : " Saved in the plug-in folder only.") + (mm ? " " + mm : ""));
    } catch (err) {
      traceErr("ps print continuous", err);
      cc.checked = !on;
      setStatus("bad", "Could not change Continuous: " + ((err && err.message) || String(err)));
    } finally {
      generateInFlight = false;
      await traceFlush();
    }
  }
  // Reset scale and rotation: whole garment 100% and 0°, every part's own scale and angle
  // cleared, the print redone. No confirm (nothing is deleted).
  async function actPsPrintReset() {
    if (generateInFlight) { kbBusyNote(); return; }
    if (!psMod().app.activeDocument) { setStatus("bad", "Open a Photoshop document first."); return; }
    generateInFlight = true;
    traceStart("Print Swap — reset scale and rotation");
    try {
      const state = await psStateLoad();
      state.scalePct = 100; state.rotDeg = 0;
      Object.keys(state.parts || {}).forEach(function (n) { const p = state.parts[n]; if (p) { p.scale = null; p.own = null; p.nudge = 0; } });
      const sc = $("ps-print-scale"); if (sc) sc.value = "100";
      psPrintScaleSet = false; psPartScaleTyped = null;
      const ex = $("ps-print-rot-exact"); if (ex) ex.value = "";
      const redone = await psRedoAllPrints(state, "Resetting the print in");
      if (redone === null) return;
      const inDoc = await psStateSave(state);
      const rec = logRecordSkeleton("printswap:print-reset", { parts: redone.length }, null, "print:" + (psPrint ? psPrint.name : ""));
      await logRun(rec); await logFinalizeCommitted(rec.id);
      const mm = redone.length && !psMergedHeld && psMergedAccepted() ? await psMergedRebuild(true) : null;
      setStatus("ok", "Scale and rotation reset: 100% and 0° for the whole garment, no part settings" + (redone.length ? ", print redone in " + redone.length + " part(s)." : ".")
        + (inDoc ? "" : " Saved in the plug-in folder only.") + (mm ? " " + mm : ""));
    } catch (err) {
      traceErr("ps print reset", err);
      setStatus("bad", "Could not reset the print: " + ((err && err.message) || String(err)));
    } finally {
      generateInFlight = false;
      try { psPrintRefreshPart(); } catch (_) {}
      await traceFlush();
    }
  }
  // Swap print only loads the file (thumbnail, name, size, suggested scale); nothing is
  // placed. Apply print is the one trigger: it places the print, or replaces / updates it.
  function psPrintPlaced() { try { return psPartNames().some(function (n) { return psPrintIds(n).length > 0; }); } catch (_) { return false; } }
  function psPrintButtonSync() { const b = $("ps-print-btn"); if (b) b.textContent = "Swap print"; }
  async function actPsPrintButton() {
    if (generateInFlight) { setStatus("bad", "Wait for the current run to finish, then click Swap print."); return; }
    const picked = await actPsChoosePrint(true);
    if (!picked) return;
    const pct = await psPrintSuggestUpdate();
    const placed = psPrintPlaced();
    setStatus("ok", "Print chosen: " + picked.name + (pct ? " (suggested scale " + pct + "%)" : "") + ". "
      + (placed ? "Set the scale, then click Apply print to replace the old print." : "Set the scale and angle, then click Apply print."));
  }
  // Apply print (or Enter in either Scale box): the first time it places the print (Accept /
  // Re-run); a new print, or the same print at a new whole-garment scale, replaces the print
  // in every part with the parts' angles kept (Accept / Re-run); a new This part scale alone
  // redoes only that part, kept at once.
  async function actPsApplyPrint() {
    if (generateInFlight) { setStatus("bad", "Wait for the current run to finish, then click Apply print."); return; }
    if (!psMod().app.activeDocument) { setStatus("bad", "Open a Photoshop document first."); return; }
    if (!psPrint) { setStatus("bad", "Click Swap print first."); return; }
    const raw = psPrintScaleRaw(), v = Number(raw);
    if (raw === "" || !(v > 0)) { setStatus("bad", "Type the whole-garment scale in % first (for example 100)."); return; }
    const pt = psPartScaleTyped;
    if (pt && String(pt.raw).trim() !== "" && psPartScaleVal(pt.raw) == null) { setStatus("bad", "Type " + pt.name + "'s scale in % (for example 80), or leave it empty for the whole-garment scale."); return; }
    let st = null;
    try { st = await psStateLoad(); } catch (_) {}
    const placed = psPrintPlaced();
    const part = pt ? { name: pt.name, scale: psPartScaleVal(pt.raw) } : null;
    if (!placed || !st || st.printName !== psPrint.name) { psPrintScaleSet = false; await psRunPrint(placed, part); return; }
    const partChanged = psPartScaleChanged(st.parts);
    if (Math.min(1000, v) !== Number(st.scalePct)) { psPrintScaleSet = false; await psRunPrint(true, partChanged ? part : null, true); return; }
    if (partChanged) { await actPsPartAdjust(null, part); return; }
    psPrintScaleSet = false; psPartScaleTyped = null; psPrintDirtySync();
    setStatus("ok", "Nothing new to apply: " + psPrint.name + " is on the canvas at " + st.scalePct + "% with these part settings. Swap print or change a scale first.");
  }

  async function actPsPrintRotate(srcEl) {
    if (generateInFlight) { kbBusyNote(); return; }
    if (!psMod().app.activeDocument) { setStatus("bad", "Open a Photoshop document first."); return; }
    const get = function (a) { return srcEl && srcEl.getAttribute ? srcEl.getAttribute(a) : null; };
    const set = get("data-set"), d = Number(get("data-deg")) || 0;
    let target = null;
    if (set === "field") {
      const raw = String((($("ps-print-rot-exact") || {}).value) || "").trim().replace("°", "");
      const v = Number(raw);
      if (raw === "" || !isFinite(v)) { setStatus("bad", "Type an angle in degrees first (for example -7.5; clockwise is +)."); return; }
      target = v;
    } else if (set === "0") target = 0;
    generateInFlight = true;
    traceStart("Print Swap — rotate print (whole garment)");
    try {
      const state = await psStateLoad();
      const was = Number(state.rotDeg) || 0;
      let now = target != null ? target : was + d;
      now = Math.round((((now + 180) % 360 + 360) % 360 - 180) * 10) / 10;   // −180 … +180
      state.rotDeg = now;
      const redone = await psRedoAllPrints(state, "Turning the print in");
      if (redone === null) return;
      const inDoc = await psStateSave(state);
      const rec = logRecordSkeleton("printswap:print-rotate", { fromDeg: was, rotDeg: now, parts: redone.length }, null, "print:" + (psPrint ? psPrint.name : ""));
      await logRun(rec);
      await logFinalizeCommitted(rec.id);
      const mm = redone.length && !psMergedHeld && psMergedAccepted() ? await psMergedRebuild(true) : null;   // kept at once: the newest MERGED is redone
      setStatus("ok", "Whole garment: angle " + psDegText(now) + (redone.length ? ", print turned in " + redone.length + " part(s)." : ". Apply print uses it.")
        + (inDoc ? "" : " Saved in the plug-in folder only.") + (mm ? " " + mm : ""));
    } catch (err) {
      traceErr("ps print rotate", err);
      setStatus("bad", "Could not rotate the print: " + ((err && err.message) || String(err)));
    } finally {
      generateInFlight = false;
      try { psPrintRefreshPart(); } catch (_) {}
      await traceFlush();
    }
  }

  // This part (the part picked in the Part dropdown): angle buttons / Exact angle + Enter,
  // or (from Apply print) `partScale` { name, scale }. Only that part is redone, turning
  // around its own centre. Before the first Apply print an angle is only saved.
  async function actPsPartAdjust(srcEl, partScale) {
    if (generateInFlight) { kbBusyNote(); return; }
    const name = partScale ? partScale.name : readPills("pills-ps-parts", null);
    if (!name) { setStatus("bad", "Pick a part in the Part dropdown (Adjust one part) first."); return; }
    const d = Number(srcEl && srcEl.getAttribute && srcEl.getAttribute("data-deg")) || 0;
    const zero = !!(srcEl && srcEl.getAttribute && srcEl.getAttribute("data-reset"));   // the 0° button: this part at 0°
    let follow = false, exact = zero ? 0 : null;           // follow = back to the whole-garment angle
    if (srcEl && srcEl.getAttribute && srcEl.getAttribute("data-set") === "field") {
      const raw = String((($("ps-part-rot-exact") || {}).value) || "").trim().replace("°", "");
      if (raw === "") follow = true;
      else {
        const v = Number(raw);
        if (!isFinite(v)) { setStatus("bad", "Type an angle in degrees (for example -7.5; clockwise is +), or leave it empty for the whole-garment angle."); return; }
        exact = Math.round(v * 10) / 10;
      }
    }
    if (!partScale && !psPrintPlaced()) {                   // before the first Apply print: the angle only
      try {
        const state = await psStateLoad(), g = Number(state.rotDeg) || 0;
        const pst = state.parts[name] || { auto: null, nudge: 0, scale: null };
        if (follow) { pst.own = null; pst.nudge = 0; }
        else if (exact != null) { pst.own = psWrapDeg(exact); pst.nudge = 0; }
        else { pst.own = psWrapDeg(psPartAngle(pst, g) + d); pst.nudge = 0; }
        state.parts[name] = pst;
        await psStateSave(state);
        setStatus("ok", name + ": angle " + (pst.own == null ? "same as whole garment" : psDegText(pst.own)) + ". Apply print uses it.");
      } catch (err) { setStatus("bad", "Could not set " + name + "'s angle: " + ((err && err.message) || String(err))); }
      try { psPrintRefreshPart(); } catch (_) {}
      return;
    }
    if (!psPrint) { setStatus("bad", "Click Swap print first (pick the same file again after a panel reload)."); return; }
    const old = psPrintIds(name);
    if (!old.length) { setStatus("bad", name + " has no print (it is unchecked or empty), so there is nothing to change there."); return; }
    generateInFlight = true;
    traceStart("Print Swap — adjust " + name);
    try {
      const tex = await psPrintTexture();
      const state = await psStateLoad();
      const pst = state.parts[name] || { auto: null, nudge: 0, scale: null };
      const g = Number(state.rotDeg) || 0;
      if (follow) { pst.own = null; pst.nudge = 0; }                          // follows the whole garment again
      else if (exact != null) { pst.own = psWrapDeg(exact); pst.nudge = 0; }  // absolute: whatever the whole garment is
      else if (d) { pst.own = psWrapDeg(psPartAngle(pst, g) + d); pst.nudge = 0; }   // turns from where it is now
      else if (partScale) pst.scale = partScale.scale;                       // Apply print: This part scale
      const id = await psRenderPartPrint(name, pst, state.scalePct || psPrintScale(), tex, state.rotDeg, psPrintContinuous(state));
      state.parts[name] = pst;
      const inDoc = await psStateSave(state);
      if (partScale) psPartScaleTyped = null;
      // A Place / Swap preview still waiting must discard the NEW layer on Re-run.
      if (pendingRecall && Array.isArray(pendingRecall.layerIds)) {
        pendingRecall.layerIds = pendingRecall.layerIds.filter(function (x) { return old.indexOf(x) < 0; });
        if (id != null) pendingRecall.layerIds.push(id);
      }
      const rec = logRecordSkeleton("printswap:part-adjust", { part: name, ownDeg: pst.own == null ? null : pst.own, scale: pst.scale }, id, "print:" + psPrint.name);
      await logRun(rec);
      await logFinalizeCommitted(rec.id);
      const mm = !psMergedHeld && psMergedAccepted() ? await psMergedRebuild(true) : null;   // kept at once: the newest MERGED is redone
      await psSelectPartInLayers(name);                                     // the part stays selected in Layers (checked)
      const back = !psPartOwnsPrint(pst) && psPrintContinuous(state) ? " Back on the shared grid." : "";
      setStatus("ok", name + ": " + (follow ? "angle same as whole garment again" : exact != null ? "angle " + psDegText(pst.own) : d ? "turned " + (d > 0 ? "clockwise " : "counterclockwise ") + Math.abs(d) + "°, angle " + psDegText(pst.own)
        : (pst.scale == null ? "uses the garment scale" : "scale " + pst.scale + "%")) + ". Only " + name + " changed." + back
        + (inDoc ? "" : " Saved in the plug-in folder only.") + (mm ? " " + mm : ""));
    } catch (err) {
      traceErr("ps part adjust", err);
      setStatus("bad", "Could not update " + name + ": " + ((err && err.message) || String(err)));
    } finally {
      generateInFlight = false;
      try { psPrintRefreshPart(); } catch (_) {}
      await traceFlush();
    }
  }

  // ----- SHADING -----------------------------------------------------------------
  function psShadeParams() {
    return {
      tone:       psToneKey(),
      strengthPct: kbNum("ps-sh-strength", 100, 0, PS_SHADOW_MAX),   // over 100: SHADOW 2 adds the rest
      foldContrast: kbNum("ps-sh-fold", 1.0, 0.1, 9.99),
      smoothPx:   Math.round(kbNum("ps-sh-smooth", PS_SMOOTH_PX, 0, 100)),
      lightPct:   kbNum("ps-sh-light", 50, 0, 100),
      burnPct:    kbNum("ps-sh-burn", 40, 0, 100),
      hiPct:      kbNum("ps-sh-hi", 0, 0, 100),
      warm:       readPills("pills-ps-sh-warm", "on") !== "off",
      ground:     psTone.ground || null,
      ringPx:     psShadeRingPx(),
      lightContrast: kbNum("ps-sh-light-c", 28, -50, 100),
      l2In:       psNums("ps-sh-l2-in", [39, 0.58, 255]),
      l2Out:      psNums("ps-sh-l2-out", [0, 199]),
      edgeAmt:    kbNum("ps-sh-edge-amt", 15, 0, 100),
      deepAmt:    kbNum("ps-sh-deep-amt", 10, 0, 100),
      featherPx:  kbNum("ps-sh-feather", psShadeLongFrac(0.0025), 0, 250),
    };
  }
  // "39 / 0.58 / 255" → numbers; a missing or bad one keeps its default.
  function psNums(id, defs) {
    const parts = String((($(id) || {}).value) || "").split(/[\s\/,]+/).filter(function (x) { return x !== ""; });
    return defs.map(function (d, i) { const v = Number(parts[i]); return parts[i] != null && isFinite(v) ? v : d; });
  }
  // A fraction of the document's long edge in px (0.0025 → 10 px at 4000 px), at least 1.
  function psShadeLongFrac(f) {
    let L = 4000; try { const d = psMod().app.activeDocument; if (d) L = Math.max(Math.round(d.width), Math.round(d.height)); } catch (_) {}
    return Math.max(1, Math.round(L * f * 10) / 10);
  }
  // Fold contrast → Brightness/Contrast 1's contrast: 1.0 = 0 (no change), 2.0 = 50.
  function psFoldToContrast(fold) { return Math.max(-50, Math.min(100, Math.round((Number(fold) - 1) * 50))); }
  // Color Balance 1 midtones [Cyan/Red, Magenta/Green, Yellow/Blue]: toward the print ground
  // with Warm shadows On (±15 at most); -8 Yellow/Blue when the ground could not be read; 0 Off.
  function psColorBalanceMid(warm, ground) {
    if (!warm) return [0, 0, 0];
    const c = ground ? kbParseHex(ground) : null;
    if (!c) return [0, 0, -8];
    const m = (c[0] + c[1] + c[2]) / 3, k = 40 / 255;
    const cl = function (v) { return Math.max(-15, Math.min(15, Math.round(v))); };
    return [cl((c[0] - m) * k), 0, cl((c[2] - m) * k)];
  }
  // Pure: the fold masks from GREY exact (px over gb.rect, garment alpha gb.alpha), on a grid
  // over the document (long edge at most 1500 px), 0…255:
  //   edge (Light 1): where the gray changes fastest (|value − local mean|), the top edgeAmt%
  //     of the garment; deep (Levels 2): the darkest deepAmt% of the garment (lightly smoothed);
  //     lit (Highlights): the brightest PS_HI_AMT% (the lit side of the folds).
  //   All feathered by featherPx and kept inside the garment.
  function psFoldMasks(px, gb, o) {
    const docW = gb.docW, docH = gb.docH, L = Math.max(docW, docH), f = Math.min(1, 1500 / L);
    const gw = Math.max(2, Math.round(docW * f)), gh = Math.max(2, Math.round(docH * f)), N = gw * gh;
    const rect = gb.rect, rw = rect.right - rect.left, med = o.median;
    const lum = new Float32Array(N).fill(med), inG = new Uint8Array(N);
    for (let y = 0; y < gh; y++) {
      const Y = Math.min(docH - 1, Math.floor(y / f)); if (Y < rect.top || Y >= rect.bottom) continue;
      for (let x = 0; x < gw; x++) {
        const X = Math.min(docW - 1, Math.floor(x / f)); if (X < rect.left || X >= rect.right) continue;
        const k = (Y - rect.top) * rw + (X - rect.left);
        if (gb.alpha[k] > 127 && px.valid[k]) { const q = y * gw + x; inG[q] = 1; lum[q] = (px.rgb[k * 3] * 77 + px.rgb[k * 3 + 1] * 150 + px.rgb[k * 3 + 2] * 29) / 256; }
      }
    }
    const sm = kbBoxBlur(lum, gw, gh, Math.max(1, Math.round(L * 0.0005 * f)));
    const mean = kbBoxBlur(sm, gw, gh, Math.max(2, Math.round(L * 0.004 * f)));
    const edgeS = new Float32Array(N);
    for (let q = 0; q < N; q++) edgeS[q] = Math.abs(sm[q] - mean[q]);
    // the value that leaves `pct`% of the garment above (top) or below (bottom) it
    // (edges: some change at all; deep folds: darker than the garment's median gray, so flat
    // fabric gives no mask however the ties fall)
    const cut = function (score, pct, top) {
      const vals = []; for (let q = 0; q < N; q++) if (inG[q]) vals.push(score[q]);
      if (!vals.length || !(pct > 0)) return null;
      vals.sort(function (a, b) { return a - b; });
      const i = Math.min(vals.length - 1, Math.max(0, Math.round((top ? 1 - pct / 100 : pct / 100) * (vals.length - 1))));
      return { t: vals[i], mid: vals[(vals.length - 1) >> 1] };
    };
    const fr = Math.max(0, Math.round((o.featherPx || 0) * f));
    const make = function (score, pct, top, bright) {
      const c = cut(score, pct, top);
      let m = new Float32Array(N), on = 0, nG = 0;
      for (let q = 0; q < N; q++) {
        if (!inG[q]) continue; nG++;
        const hit = !c ? false : (bright ? score[q] >= c.t && score[q] > c.mid + 0.5          // lighter than the garment's median: flat fabric gives no mask
          : (top ? score[q] >= c.t && score[q] > 0.5 : score[q] <= c.t && score[q] < c.mid - 0.5));
        if (hit) { m[q] = 255; on++; }
      }
      if (fr > 0) m = kbBoxBlur(kbBoxBlur(m, gw, gh, Math.max(1, Math.round(fr / 2))), gw, gh, Math.max(1, Math.round(fr / 2)));
      const out = new Uint8Array(N);
      for (let q = 0; q < N; q++) out[q] = inG[q] ? Math.max(0, Math.min(255, Math.round(m[q]))) : 0;
      return { plane: out, pct: nG ? Math.round(on / nG * 1000) / 10 : 0 };
    };
    const e = make(edgeS, o.edgeAmt, true), d = make(sm, o.deepAmt, false), h = make(sm, PS_HI_AMT, true, true);
    return { edge: e.plane, deep: d.plane, lit: h.plane, edgePct: e.pct, deepPct: d.pct, litPct: h.pct, gw: gw, gh: gh };
  }
  // Edge ring: about 0.15% of the long edge (6 px on 4000 px).
  const PS_RING_FRAC = 0.0015;
  function psShadeRingPx() {
    let L = 4000; try { const d = psMod().app.activeDocument; if (d) L = Math.max(Math.round(d.width), Math.round(d.height)); } catch (_) {}
    return Math.max(1, Math.round(L * PS_RING_FRAC));
  }

  // ----- Shading layers: one SDW group, never more ------------------------------------
  // Older files' step 8 names at the top level (the GREY group, GREY copy 3 and strays left
  // by an interrupted run): cleared with SDW, never built again.
  const PS_SHADE_NAMES = [PS_VEIL_NAME, "GREY copy", "GREY copy 2", "GREY highlights", "Levels shading", "Levels highlights", "Levels burn", "Warm shadows"];
  // What Build shading clears: SDW, and at the TOP LEVEL only an older file's GREY group,
  // GREY copy 3 and GREY highlights. Never anything inside PB or the part groups.
  const PS_SHADE_OLD = [PS_VEIL_NAME, "GREY highlights"];
  function psShadeTopLayers() {
    const out = [];
    try {
      const t = psMod().app.activeDocument.layers;
      for (let i = 0; i < t.length; i++) {
        const n = String(t[i].name);
        if (PS_SHADE_OLD.indexOf(n) >= 0 || (n === PS_SHADE_GROUP && t[i].layers)) out.push(t[i]);
      }
    } catch (_) {}
    const sd = psSdwGroup(); if (sd) out.push(sd);
    return out;
  }
  // The layers step 8 builds in SDW (SDW's own; anything else in it is the retoucher's).
  const PS_SDW_OWN = [PS_SDW_GROUP, "SHADOW", "SHADOW 2", "Color Balance 1", "Brightness/Contrast 1", "Selective Color 1", "Selective Color 2", "Light 1", "Levels 2", "Highlights"];
  // A layer the retoucher locked inside SDW (not one of step 8's own): its name, else null.
  function psSdwForeignLock(sd) {
    const locked = function (l) { try { return !!(l.allLocked || l.pixelsLocked || l.positionLocked || l.transparentPixelsLocked); } catch (_) { return false; } };
    const walk = function (g) {
      let kids = []; try { kids = Array.from(g.layers || []); } catch (_) {}
      for (let i = 0; i < kids.length; i++) {
        const n = String(kids[i].name);
        if (PS_SDW_OWN.indexOf(n) < 0 && locked(kids[i])) return n;
        if (kids[i].layers) { const r = walk(kids[i]); if (r) return r; }
      }
      return null;
    };
    return sd ? walk(sd) : null;
  }
  function psVeilCount() { return psShadeTopLayers().filter(function (l) { return String(l.name) === PS_VEIL_NAME; }).length; }
  // Every step 8 layer (the GREY group with everything in it, GREY copy 3 and any stray
  // GREY highlights / Levels shading …), unlocked then deleted, then checked by name:
  // anything left stops the run, so nothing is ever built on top of old shading.
  async function psShadeCleanup() {
    const ls = psShadeTopLayers();
    const foreign = psSdwForeignLock(psSdwGroup());          // the retoucher's own lock is kept: nothing is unlocked or deleted
    if (foreign) throw new Error(foreign + " in " + PS_SDW_GROUP + " is locked and is not a step 8 layer. Unlock it or move it out of " + PS_SDW_GROUP + ", then Build shading again.");
    if (ls.length) {
      await psMod().core.executeAsModal(async function () {
        for (let i = 0; i < ls.length; i++) await kbUnlockTreeInModal(ls[i]);
      }, { commandName: "KBImage — unlock shading" });
      await deleteLayersById(ls.map(function (l) { return l.id; }));
    }
    const left = psShadeTopLayers();
    trace("ps shade: cleared " + (ls.length - left.length) + " old shading layer(s)" + (left.length ? "; STILL THERE: " + left.map(function (l) { return l.name; }).join(", ") : ""));
    if (left.length) throw new Error("the old shading layers could not be deleted (" + left.map(function (l) { return String(l.name); }).join(", ") + "). Unlock and delete them in Layers, then Build shading again.");
    return ls.length;
  }
  // A document opens: trims nested inside another trim group in PB go back to PB's own level,
  // in the team's order. Once per document; nothing happens when PB is already right.
  let psPbTidyDone = {};
  async function psPbTidy(docId) {
    if (docId == null || psPbTidyDone[docId] || generateInFlight) return;
    psPbTidyDone[docId] = true;
    if (!psPbFlattenInModal(true)) return;
    generateInFlight = true;
    try {
      await psMod().core.executeAsModal(async function () { await psLayoutFixInModal(); }, { commandName: "KBImage — PB trims" });
      setStatus("ok", "Trims in " + PS_PB_GROUP + " were nested inside each other; moved back to one level, in order.");
    } catch (e) { traceErr("ps PB tidy", e); setStatus("bad", "Could not fix the trims nested in " + PS_PB_GROUP + ": " + ((e && e.message) || String(e))); }
    finally { generateInFlight = false; }
  }
  // A document opens: extra GREY copy 3 layers left by older runs go (the newest, the
  // lowest one, stays), and every copy but GREY is unlocked. Once per document.
  let psShadeTidyDone = {};
  async function psShadeTidy(docId) {
    if (docId == null || psShadeTidyDone[docId] || generateInFlight) return;
    if (pendingRecall && pendingRecall.descriptor && String(pendingRecall.descriptor.op) === "printswap:shade") return;
    psShadeTidyDone[docId] = true;
    const veils = psShadeTopLayers().filter(function (l) { return String(l.name) === PS_VEIL_NAME; });
    const group = psShadeTopLayers().filter(function (l) { return String(l.name) === PS_SHADE_GROUP; })[0] || null;
    const extra = veils.slice(0, Math.max(0, veils.length - 1));          // top first: all but the lowest
    const locked = function (l) { try { return !!(l.allLocked || l.pixelsLocked || l.positionLocked || l.transparentPixelsLocked); } catch (_) { return false; } };
    const unlock = veils.slice(veils.length - 1).filter(locked);
    if (group) { try { for (let i = 0; i < group.layers.length; i++) { const c = group.layers[i]; if (String(c.name) !== PS_SHADE_GROUP && locked(c)) unlock.push(c); } } catch (_) {} }
    if (!extra.length && !unlock.length) return;
    generateInFlight = true;
    try {
      await psMod().core.executeAsModal(async function () {
        for (let i = 0; i < extra.length; i++) await kbUnlockTreeInModal(extra[i]);
        for (let i = 0; i < unlock.length; i++) await kbUnlockTreeInModal(unlock[i]);
      }, { commandName: "KBImage — tidy shading" });
      if (extra.length) await deleteLayersById(extra.map(function (l) { return l.id; }));
      trace("ps shade tidy: deleted " + extra.length + " extra GREY copy 3, unlocked " + unlock.length + " layer(s); veils now " + psVeilCount());
      if (extra.length) setStatus("ok", "Deleted " + extra.length + " extra GREY copy 3 layer" + (extra.length === 1 ? "" : "s") + " left by older shading runs. Shading: 1 veil.");
    } catch (e) { traceErr("ps shade tidy", e); }
    finally { generateInFlight = false; }
  }

  // ----- Shading presets from the garment and the print (step 8) ------------------------
  // The source garment (the photo, before Remove print) and the placed print, each Dark
  // under 40% average lightness (L*), else Light, both read by id inside the parts'
  // shapes (inside KBPS garment). The pair picks the starting values; a click on either
  // toggle overrides that side (saved in the document); any field can still be changed.
  const PS_TONE_DARK_BELOW = 40;
  const PS_SMOOTH_THRESHOLD = 15;                     // Surface Blur threshold (levels): fold edges stay
  // Fold smoothing in px (Surface Blur radius). Dark → Light tested on the blue pajama to the cream floral.
  const PS_SMOOTH_PX = 2;
  // Fold light % (Light 1), Burn % (Levels 2) and Highlights % (0 on a light print, about 40
  // on a dark one): first guesses until tested.
  const PS_TONE_PRESETS = {
    "dark-light":  { fold: 2.0, smooth: 2, strength: 100, light: 60, burn: 50, hi: 0 },
    "light-light": { fold: 1.0, smooth: 2, strength: 100, light: 50, burn: 40, hi: 0 },
    "light-dark":  { fold: 1.2, smooth: 2, strength: 100, light: 70, burn: 30, hi: 40 },
    "dark-dark":   { fold: 1.6, smooth: 2, strength: 100, light: 70, burn: 40, hi: 40 },
  };
  // Highlights: Levels that brighten (output black raised, gamma above 1) on Screen, masked to
  // the brightest PS_HI_AMT% of GREY exact (the lit side of the folds). Paintable like Light 1.
  const PS_HI_NAME = "Highlights", PS_HI_AMT = 10, PS_HI_GAMMA = 1.3, PS_HI_OUT_BLACK = 40;
  function psToneBlank() { return { docId: null, src: "light", print: "light", srcBy: "auto", printBy: "auto", Ls: null, Lp: null, autoSrc: null, autoPrint: null, printName: null, ground: null, measured: false, busy: false }; }
  let psTone = psToneBlank();
  function psToneKey() { return psTone.src + "-" + psTone.print; }
  function psToneText() {
    const by = psTone.srcBy === "you" || psTone.printBy === "you" ? "Your pick" : "Auto";
    return by + ": " + psTone.src + " garment → " + psTone.print + " print";
  }
  function psToneFaceSync() {
    [["pills-ps-tone-src", psTone.src], ["pills-ps-tone-print", psTone.print]].forEach(function (x) {
      const g = $(x[0]);
      if (g) { const p = g.querySelectorAll(".pill"); for (let i = 0; i < p.length; i++) p[i].classList.toggle("selected", p[i].getAttribute("data-value") === x[1]); }
    });
    const n = $("ps-tone-note");
    if (!n) return;
    if (!psTone.measured) { n.textContent = "Auto: measured from the garment and the print when step 8 opens"; return; }
    const pct = function (v) { return v == null ? "not measured" : Math.round(v) + "%"; };
    n.textContent = psToneText() + " (average lightness: garment " + pct(psTone.Ls) + ", print " + (psTone.Lp == null ? "not placed yet" : pct(psTone.Lp)) + ")"
      + (psTone.ground ? ". Print ground " + psTone.ground : "");
  }
  function psToneFill() {
    const t = PS_TONE_PRESETS[psToneKey()] || PS_TONE_PRESETS["light-light"];
    const set = function (id, v) { const el = $(id); if (el) el.value = String(v); };
    set("ps-sh-strength", t.strength);
    set("ps-sh-fold", t.fold.toFixed(1));
    set("ps-sh-smooth", t.smooth);
    set("ps-sh-light", t.light);
    set("ps-sh-burn", t.burn);
    set("ps-sh-hi", t.hi);
  }
  // L* (0…100) of an sRGB 8-bit value, by table.
  let psLinTable = null;
  function psLstar(r, g, b) {
    if (!psLinTable) { psLinTable = new Float32Array(256); for (let v = 0; v < 256; v++) { const c = v / 255; psLinTable[v] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); } }
    const L = psLinTable, Y = 0.2126 * L[r] + 0.7152 * L[g] + 0.0722 * L[b];
    return Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y;
  }
  // Pure: add the L* of `px` where `shape` covers (both from psReadLayerRgb), every `step` px.
  function psToneSum(px, shape, n, step, acc, hist) {
    for (let k = 0; k < n; k += step) {
      if (!shape.valid[k] || !px.valid[k]) continue;
      const r = px.rgb[k * 3], g = px.rgb[k * 3 + 1], b = px.rgb[k * 3 + 2];
      acc.sum += psLstar(r, g, b); acc.n++;
      if (hist) { const q = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4); hist.n[q]++; hist.r[q] += r; hist.g[q] += g; hist.b[q] += b; }
    }
    return acc;
  }
  function psToneHist() { return { n: new Uint32Array(4096), r: new Float64Array(4096), g: new Float64Array(4096), b: new Float64Array(4096) }; }
  // Pure: the print's ground color, the most common color (16 levels a channel), averaged.
  function psToneGround(h) {
    let best = -1, bn = 0;
    for (let q = 0; q < 4096; q++) if (h.n[q] > bn) { bn = h.n[q]; best = q; }
    return best < 0 ? null : psHex([Math.round(h.r[best] / bn), Math.round(h.g[best] / bn), Math.round(h.b[best] / bn)]);
  }
  function psLightOrDark(L) { return L == null ? null : (L < PS_TONE_DARK_BELOW ? "dark" : "light"); }
  // Inside executeAsModal: { src, print } average L* inside the parts' shapes — the photo
  // (before Remove print) and every PRINT layer, read by id. null where there is nothing.
  async function psToneMeasureInModal() {
    const doc = psMod().app.activeDocument;
    const docW = Math.round(doc.width), docH = Math.round(doc.height);
    const photoId = psOriginalPhotoId();
    const as = { sum: 0, n: 0 }, ap = { sum: 0, n: 0 }, hist = psToneHist();
    const names = psPartNames();
    for (let i = 0; i < names.length; i++) {
      const shape = psShapeLayer(names[i]);
      if (!shape) continue;
      const b = shape.bounds || {};
      const rect = { left: Math.max(0, Math.floor(Number(b.left) || 0)), top: Math.max(0, Math.floor(Number(b.top) || 0)),
                     right: Math.min(docW, Math.ceil(Number(b.right) || 0)), bottom: Math.min(docH, Math.ceil(Number(b.bottom) || 0)) };
      const n = (rect.right - rect.left) * (rect.bottom - rect.top);
      if (!(n > 0)) continue;
      const sh = await psReadLayerRgb(shape.id, rect);
      const step = Math.max(1, Math.floor(n / 200000));
      if (photoId != null) psToneSum(await psReadLayerRgb(photoId, rect), sh, n, step, as);
      const prints = psPrintIds(names[i]);
      for (let j = 0; j < prints.length; j++) psToneSum(await psReadLayerRgb(prints[j], rect), sh, n, step, ap, hist);
    }
    return { src: as.n ? as.sum / as.n : null, print: ap.n ? ap.sum / ap.n : null, ground: ap.n ? psToneGround(hist) : null };
  }
  // Measure and pick (step 8 opens, before Build shading, after a new print is applied). A side the
  // retoucher clicked keeps their pick; the fields are filled when the pair changes.
  async function psToneCheck(force) {
    const docId = psActiveDocId();
    if (docId == null || psTone.busy) return;
    let st = null; try { st = await psStateLoad(); } catch (_) {}
    const pn = (st && st.printName) || null;
    // a click not saved yet (the toggles only fill the fields) wins over the document's copy
    const mem = psTone.docId === docId && (psTone.srcBy === "you" || psTone.printBy === "you") ? { src: psTone.src, print: psTone.print, srcBy: psTone.srcBy, printBy: psTone.printBy } : null;
    const saved = mem || (st && st.shadeTone) || {};
    if (!force && psTone.docId === docId && psTone.printName === pn && psTone.measured) { psToneFaceSync(); return; }
    psTone.busy = true;
    try {
      let m = { src: null, print: null };
      await psMod().core.executeAsModal(async function () { m = await psToneMeasureInModal(); }, { commandName: "KBImage — measure garment and print" });
      const autoSrc = psLightOrDark(m.src), autoPrint = psLightOrDark(m.print);
      const ok = function (v) { return v === "dark" || v === "light"; };
      const srcBy = saved.srcBy === "you" && ok(saved.src) ? "you" : "auto", printBy = saved.printBy === "you" && ok(saved.print) ? "you" : "auto";
      const before = psTone.docId === docId && psTone.measured ? psToneKey() : null;
      psTone = { docId: docId, src: srcBy === "you" ? saved.src : (autoSrc || "light"), print: printBy === "you" ? saved.print : (autoPrint || "light"),
        srcBy: srcBy, printBy: printBy, Ls: m.src, Lp: m.print, autoSrc: autoSrc, autoPrint: autoPrint, printName: pn, ground: m.ground || null, measured: true, busy: false };
      const filled = before !== psToneKey();
      if (filled) psToneFill();
      trace("ps tone: garment " + (m.src == null ? "-" : m.src.toFixed(1)) + " → " + autoSrc + ", print " + pn + " " + (m.print == null ? "-" : m.print.toFixed(1)) + " → " + autoPrint
        + "; using " + psToneKey() + " (" + srcBy + " / " + printBy + "), print ground " + (m.ground || "-") + (filled ? ", fields filled" : ""));
    } catch (e) { traceErr("ps tone", e); }
    finally { psTone.busy = false; psToneFaceSync(); }
  }
  // Step 8 opened (or a print was swapped): measure once the panel is free.
  function psToneSoon(force) {
    let tries = 0;
    const go = function () {
      if (!force && psOpenStep !== 8) return;
      if (generateInFlight || psTone.busy) { if (++tries < 80) setTimeout(go, 250); return; }
      psToneCheck(!!force);
    };
    setTimeout(go, 60);
  }
  // A click on Garment or Print Light / Dark: that side is the retoucher's (back to
  // auto when it matches what was measured). It fills the fields and does nothing else:
  // no build, no select, no layer or document change, even with a preview waiting. The
  // pick is saved with the document by the next Build shading or Re-run (psToneSaveInDoc).
  function psOnToneChip(side, v) {
    const val = v === "dark" ? "dark" : "light";
    if (psTone.docId == null) psTone.docId = psActiveDocId();
    if (side === "src") { psTone.src = val; psTone.srcBy = psTone.autoSrc === val ? "auto" : "you"; }
    else { psTone.print = val; psTone.printBy = psTone.autoPrint === val ? "auto" : "you"; }
    psToneFill();
    psToneFaceSync();
    const t = PS_TONE_PRESETS[psToneKey()];
    setStatus("ok", psToneText() + ": Shading strength " + t.strength + "%, Fold contrast " + t.fold.toFixed(1) + ", Fold smoothing " + t.smooth + " px, Fold light " + t.light + "%, Burn " + t.burn + "%. "
      + (pendingRecall && pendingRecall.descriptor && pendingRecall.descriptor.op === "printswap:shade" ? "Re-run to use it." : "Build shading to use it."));
  }
  // Build shading / Re-run: the toggles' pick into the document (only when it changed).
  async function psToneSaveInDoc() {
    try {
      const st = await psStateLoad();
      const want = psTone.srcBy === "you" || psTone.printBy === "you" ? { src: psTone.src, print: psTone.print, srcBy: psTone.srcBy, printBy: psTone.printBy } : null;
      if (JSON.stringify(st.shadeTone || null) === JSON.stringify(want)) return;
      if (want) st.shadeTone = want; else delete st.shadeTone;
      await psStateSave(st);
    } catch (e) { traceErr("ps tone save", e); }
  }

  function psTopLayerNamed(name) {
    try { const t = psMod().app.activeDocument.layers; for (let i = 0; i < t.length; i++) if (String(t[i].name) === name) return t[i]; } catch (_) {}
    return null;
  }
  // Inside executeAsModal: blend mode + opacity on a layer by id.
  async function psSetBlendInModal(id, mode, opacity) {
    await kbSelectLayerById(id);
    await psMod().action.batchPlay(
      [{ _obj: "set", _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
         to: { _obj: "layer", mode: { _enum: "blendMode", _value: mode }, opacity: { _unit: "percentUnit", _value: opacity } },
         _options: { dialogOptions: "dontDisplay" } }], { synchronousExecution: true });
  }
  // Inside executeAsModal: the layer's mask → KBPS garment (old mask dropped, not applied).
  async function psMaskToGarmentInModal(id) {
    const ps = psMod();
    await kbDeleteMaskInModal(id, false);                  // no mask yet (a new group): skipped
    try { await selectRGBChannel(); } catch (_) {}
    await kbLoadChannel(PS_GARMENT_CH);
    await kbSelectLayerById(id);
    await addLayerMaskRevealSelection();
    try { await deselectAll(); } catch (_) {}
    try { await selectRGBChannel(); } catch (_) {}
  }
  // Inside executeAsModal: an adjustment layer just above layer `afterId`, masked
  // to the garment (made with the garment selection loaded). Throws Photoshop's exact error.
  async function psMakeAdjustmentInModal(name, type, values, afterId, maskCh) {
    const ps = psMod();
    await kbLoadChannel(maskCh || PS_GARMENT_CH);
    await kbSelectLayerById(afterId);
    try {
      await ps.action.batchPlay(
        [{ _obj: "make", _target: [{ _ref: "adjustmentLayer" }],
           using: { _obj: "adjustmentLayer", name: name, type: Object.assign({ _obj: type }, values) },
           _options: { dialogOptions: "dontDisplay" } }], { synchronousExecution: true });
    } catch (e) { throw new Error("Making the " + name + " adjustment layer failed — Photoshop said: " + ((e && e.message) || String(e))); }
    const id = kbActiveLayerId();
    try { await deselectAll(); } catch (_) {}
    try {
      await ps.action.batchPlay(
        [{ _obj: "set", _target: [{ _ref: "adjustmentLayer", _enum: "ordinal", _value: "targetEnum" }],
           to: Object.assign({ _obj: type }, values), _options: { dialogOptions: "dontDisplay" } }], { synchronousExecution: true });
    } catch (e) { throw new Error("Setting the " + name + " values failed — Photoshop said: " + ((e && e.message) || String(e))); }
    try { await renameActiveLayer(name); } catch (_) {}
    return id;
  }

  // Levels values (composite channel): input black / white and gamma.
  function psLevelsValues(lo, hi, gamma, output) {
    const a = { _obj: "levelsAdjustment", channel: { _ref: "channel", _enum: "channel", _value: "composite" },
      input: [Math.round(lo), Math.round(hi)], gamma: Math.round(gamma * 100) / 100 };
    if (output) a.output = [Math.round(output[0]), Math.round(output[1])];
    return { presetKind: { _enum: "presetKindType", _value: "presetKindCustom" }, adjustment: [a] };
  }
  // Pure: the median of the luma where alpha > 127 and the layer has pixels.
  function psMedianLuma(px, alpha) {
    const h = new Uint32Array(256); let n = 0;
    for (let k = 0; k < alpha.length; k++) {
      if (alpha[k] <= 127 || !px.valid[k]) continue;
      h[(px.rgb[k * 3] * 77 + px.rgb[k * 3 + 1] * 150 + px.rgb[k * 3 + 2] * 29) >> 8]++; n++;
    }
    if (!n) return null;
    let acc = 0; for (let v = 0; v < 256; v++) { acc += h[v]; if (acc >= n / 2) return v; }
    return 255;
  }
  const PS_SHADOW_NAME = "SHADOW";
  // Shading strength 0 to 200%: up to 100 SHADOW alone (Multiply at that %); above, SHADOW at
  // 100% plus SHADOW 2, a plain copy of SHADOW directly under it in SDW (so Color Balance 1,
  // Brightness/Contrast 1 and Selective Color 1 still clip to SHADOW), Multiply at the rest.
  const PS_SHADOW2_NAME = "SHADOW 2", PS_SHADOW_MAX = 200;
  function psShadowSplit(pct) {
    const v = Math.max(0, Math.min(PS_SHADOW_MAX, Math.round(Number(pct) || 0)));
    return { one: Math.min(100, v), two: Math.max(0, v - 100) };
  }
  const PS_LIGHT_CH = "KBPS_tmp_light", PS_DEEP_CH = "KBPS_tmp_deep", PS_LIT_CH = "KBPS_tmp_lit";
  // Step 8: the SDW group in PS (garment mask), bottom → top: [SHADOW 2 above 100%,] SHADOW
  // (GREY exact cut to KBPS garment on transparency, Fold smoothing, median → white,
  // desaturated; Multiply at Shading strength, locked) with
  // Color Balance 1, Brightness/Contrast 1 and Selective Color 1 clipped to it; Selective
  // Color 2 (garment mask); Light 1 (fold edges mask) and Levels 2 (deepest folds mask).
  async function executePsShade(params) {
    const ps = psMod();
    const doc = ps.app.activeDocument;
    if (!doc) throw new Error("Open a Photoshop document first.");
    if (!psGreyExactLayer()) throw new Error("there is no " + PS_EXACT_LAYER + " layer (step 5).");
    if (!psPartsGroup()) throw new Error("there are no parts (step 6).");
    const EP = ps.constants && ps.constants.ElementPlacement;
    let step = "clearing old shading";
    let sdwId = null;
    const built = [];                                        // what this run made: removed again if it fails partway
    try {
      // Never more than one: SDW, and an older file's GREY group, GREY copy 3 and strays, go first (unlocked).
      params.cleared = await psShadeCleanup();
      await psToneSaveInDoc();
      step = "moving the trims and parts into " + PS_PS_GROUP;
      await ps.core.executeAsModal(async function () { params.moved = await psLayoutFixInModal(); }, { commandName: "KBImage — PS group" });
      if (!psPartGroupsAll().length) throw new Error("there are no part groups in " + PS_PARTS_GROUP + ".");
      step = "measuring the garment's median gray";
      setStatus("busy", "Measuring the garment's median gray…");
      const gb = await psGarmentBox(0);
      let px = null;
      await ps.core.executeAsModal(async function () { px = await psReadLayerRgb(psGreyExactLayer().id, gb.rect); },
        { commandName: "KBImage — read " + PS_EXACT_LAYER });
      const med = psMedianLuma(px, gb.alpha);
      if (med == null) throw new Error(PS_EXACT_LAYER + " has no pixels inside KBPS garment.");
      params.median = Math.max(2, Math.min(253, med));
      params.contrast = psFoldToContrast(params.foldContrast);
      params.cb = psColorBalanceMid(params.warm, params.ground);
      params.warmBy = !params.warm ? "off" : (params.ground ? "on" : "unmeasured");
      step = "finding the folds";
      setStatus("busy", "Finding the fold edges and the deepest folds…");
      const fm = psFoldMasks(px, gb, params);
      params.edgePct = fm.edgePct; params.deepPct = fm.deepPct;
      await psPlaneToChannel(fm.edge, fm.gw, fm.gh, gb.docW, gb.docH, PS_LIGHT_CH);
      await psPlaneToChannel(fm.deep, fm.gw, fm.gh, gb.docW, gb.docH, PS_DEEP_CH);
      params.litPct = fm.litPct;
      await psPlaneToChannel(fm.lit, fm.gw, fm.gh, gb.docW, gb.docH, PS_LIT_CH);
      step = "copying " + PS_EXACT_LAYER + " as " + PS_SHADOW_NAME;
      setStatus("busy", "Building the shading…");
      await ps.core.executeAsModal(async function () {
        try { await deselectAll(); } catch (_) {}
        // Every layer by a fresh lookup (never an id from an earlier run), checked before use.
        const grey = psGreyExactLayer(), P = psPsGroup();
        if (!grey) throw new Error("there is no " + PS_EXACT_LAYER + " layer (step 5).");
        const firstPart = P ? (psPartsFolder() || psPsParts(P)[0] || null) : null;   // SHADOW right above PARTS
        if (!firstPart) throw new Error("there are no part groups in " + PS_PS_GROUP + ".");
        const must = function (id, name) {
          const l = id == null ? null : kbLayerById(id);
          if (!l) throw new Error(name + " is not in the document any more.");
          return l;
        };
        const pick = async function (id, name) {
          must(id, name);
          if (!(await kbSelectLayerById(id))) throw new Error(name + " could not be selected.");
        };
        const cmd = async function (desc, what) {
          try { await ps.action.batchPlay([Object.assign({}, desc, { _options: { dialogOptions: "dontDisplay" } })], { synchronousExecution: true }); }
          catch (e) { throw new Error(what + " failed — Photoshop said: " + ((e && e.message) || String(e))); }
        };
        // Edge ring: KBPS garment grown and shrunk by ringPx, the band between (feathered),
        // filled with the median gray on SHADOW, so the dark cut-out edge of GREY exact never
        // prints as an outline.
        step = "making the edge ring";
        const RING = "KBPS_tmp_ring", RA = "KBPS_tmp_ringA", RB = "KBPS_tmp_ringB";
        const sizeSel = async function (verb, n) {
          await ps.action.batchPlay([{ _obj: verb, by: { _unit: "pixelsUnit", _value: n }, selectionModifyEffectAtCanvasBounds: false,
            _options: { dialogOptions: "dontDisplay" } }], { synchronousExecution: true });
        };
        params.ringBy = "off";
        try {
          await kbLoadChannel(PS_GARMENT_CH); await sizeSel("expand", params.ringPx); await psSaveSelectionAsInModal(RA);
          await kbLoadChannel(PS_GARMENT_CH); await sizeSel("contract", params.ringPx); await psSaveSelectionAsInModal(RB);
          if (kbChannelExists(RA)) {
            await kbLoadChannel(RA);
            if (kbChannelExists(RB)) await kbLoadChannel(RB, "subtract");
            await psFeatherSelectionInModal(Math.max(0.5, params.ringPx / 2));
            await psSaveSelectionAsInModal(RING);
          }
          try { await deselectAll(); } catch (_) {}
          if (kbChannelExists(RING)) params.ringBy = "on";
        } catch (e) { traceErr("ps shade: edge ring", e); try { await deselectAll(); } catch (_) {} }
        try { await kbRemoveChannels(RA); } catch (_) {}
        try { await kbRemoveChannels(RB); } catch (_) {}
        // SHADOW, straight above the top part group.
        let sh = null;
        try { sh = await grey.duplicate(firstPart, EP.PLACEBEFORE, PS_SHADOW_NAME); }
        catch (e) { throw new Error("Duplicating " + PS_EXACT_LAYER + " as " + PS_SHADOW_NAME + " failed — Photoshop said: " + ((e && e.message) || String(e))); }
        built.push(sh.id);
        await kbUnlockTreeInModal(sh);
        try { if (sh.isClippingMask) sh.isClippingMask = false; } catch (_) {}
        try { sh.visible = true; } catch (_) {}            // GREY exact is hidden after a build: its copy must not be
        await pick(sh.id, PS_SHADOW_NAME);
        try { await selectRGBChannel(); } catch (_) {}
        params.smoothBy = params.smoothPx > 0 ? null : "off";
        if (params.smoothPx > 0) {
          step = "smoothing " + PS_SHADOW_NAME + " (Surface Blur " + params.smoothPx + " px)";
          try {
            await ps.action.batchPlay([{ _obj: "surfaceBlur", radius: { _unit: "pixelsUnit", _value: params.smoothPx }, threshold: PS_SMOOTH_THRESHOLD,
              _options: { dialogOptions: "dontDisplay" } }], { synchronousExecution: true });
            params.smoothBy = "surface";
          } catch (e) {
            traceErr("ps shade: Surface Blur refused, Gaussian Blur " + params.smoothPx / 2 + " px instead", e);
            try {
              await ps.action.batchPlay([{ _obj: "gaussianBlur", radius: { _unit: "pixelsUnit", _value: params.smoothPx / 2 }, _options: { dialogOptions: "dontDisplay" } }],
                { synchronousExecution: true });
              params.smoothBy = "gaussian";
            } catch (e2) { traceErr("ps shade: Gaussian Blur refused too, no fold smoothing", e2); params.smoothBy = "none"; }
          }
        }
        if (params.ringBy === "on") {
          step = "filling the edge ring on " + PS_SHADOW_NAME;
          await kbLoadChannel(RING);
          await pick(sh.id, PS_SHADOW_NAME);
          try { await selectRGBChannel(); } catch (_) {}
          await cmd({ _obj: "fill", using: { _enum: "fillContents", _value: "color" },
            color: { _obj: "RGBColor", red: params.median, grain: params.median, blue: params.median },
            opacity: { _unit: "percentUnit", _value: 100 }, mode: { _enum: "blendMode", _value: "normal" } }, "Filling the edge ring on " + PS_SHADOW_NAME);
          try { await deselectAll(); } catch (_) {}
        }
        try { await kbRemoveChannels(RING); } catch (_) {}
        // SHADOW holds only garment pixels: GREY exact's mask (if the copy brought one) is
        // applied, then everything outside KBPS garment (full res, same soft edge) is cleared to
        // transparency. Any copy of SHADOW then carries no background; Multiply on transparency
        // changes nothing outside. SDW keeps its own garment mask.
        step = "applying " + PS_EXACT_LAYER + "'s mask on " + PS_SHADOW_NAME;
        await kbDeleteMaskInModal(sh.id, true, PS_SHADOW_NAME);
        step = "cutting " + PS_SHADOW_NAME + " to the garment";
        try { await deselectAll(); } catch (_) {}
        await kbLoadChannel(PS_GARMENT_CH);
        await cmd({ _obj: "inverse" }, "Inverting the garment selection");
        await pick(sh.id, PS_SHADOW_NAME);
        try { await selectRGBChannel(); } catch (_) {}
        await cmd({ _obj: "fill", using: { _enum: "fillContents", _value: "black" },
          opacity: { _unit: "percentUnit", _value: 100 }, mode: { _enum: "blendMode", _value: "clearEnum" } }, "Clearing " + PS_SHADOW_NAME + " outside the garment");
        try { await deselectAll(); } catch (_) {}
        step = "mapping the median gray to white on " + PS_SHADOW_NAME;
        await pick(sh.id, PS_SHADOW_NAME);
        try { await selectRGBChannel(); } catch (_) {}
        await cmd(Object.assign({ _obj: "levels" }, psLevelsValues(0, params.median, 1)), "Levels on " + PS_SHADOW_NAME);
        await cmd({ _obj: "desaturate" }, "Desaturate on " + PS_SHADOW_NAME);
        // Above 100%: SHADOW 2, a plain copy made now (after Levels / Desaturate), right under SHADOW.
        const split = psShadowSplit(params.strengthPct);
        let sh2 = null;
        if (split.two > 0) {
          step = "copying " + PS_SHADOW_NAME + " as " + PS_SHADOW2_NAME;
          try { sh2 = await sh.duplicate(sh, EP.PLACEAFTER, PS_SHADOW2_NAME); }
          catch (e) { throw new Error("Duplicating " + PS_SHADOW_NAME + " as " + PS_SHADOW2_NAME + " failed — Photoshop said: " + ((e && e.message) || String(e))); }
          built.push(sh2.id);
          try { if (sh2.isClippingMask) sh2.isClippingMask = false; } catch (_) {}
        }
        // Clipped to SHADOW: they shape the shading only, never the print.
        const clipped = async function (name, type, values, afterId) {
          must(afterId, "the layer under " + name);
          const id = await psMakeAdjustmentInModal(name, type, values, afterId);
          built.push(id);
          await pick(id, name);
          const l = kbLayerById(id); let c = false; try { c = !!l.isClippingMask; } catch (_) {}
          if (!c) await psClipActiveInModal();
          return id;
        };
        // Not clipped: on everything under them (the prints and SHADOW), masked.
        const free = async function (name, type, values, afterId, maskCh) {
          must(afterId, "the layer under " + name);
          const id = await psMakeAdjustmentInModal(name, type, values, afterId, maskCh);
          built.push(id);
          const l = kbLayerById(id);
          try { if (l && l.isClippingMask) l.isClippingMask = false; } catch (e) { traceErr("ps shade: unclip " + name, e); }
          return id;
        };
        step = "making Color Balance 1 (clipped)";
        const cb = await clipped("Color Balance 1", "colorBalance", { shadowLevels: [0, 0, 0], midtoneLevels: params.cb, highlightLevels: [0, 0, 0], preserveLuminosity: true }, sh.id);
        step = "making Brightness/Contrast 1 (clipped)";
        const bc = await clipped("Brightness/Contrast 1", "brightnessEvent", { brightness: 0, center: params.contrast, useLegacy: true }, cb);
        step = "making Selective Color 1 (clipped)";
        const sc1 = await clipped("Selective Color 1", "selectiveColor", { method: { _enum: "correctionMethod", _value: "relative" } }, bc);
        step = "making Selective Color 2";
        const sc2 = await free("Selective Color 2", "selectiveColor", { method: { _enum: "correctionMethod", _value: "relative" } }, sc1, PS_GARMENT_CH);
        step = "making Light 1 (fold edges)";
        const light = await free("Light 1", "brightnessEvent", { brightness: 0, center: params.lightContrast, useLegacy: false }, sc2, PS_LIGHT_CH);
        step = "making Levels 2 (deepest folds)";
        const burn = await free("Levels 2", "levels", psLevelsValues(params.l2In[0], params.l2In[2], params.l2In[1], params.l2Out), light, PS_DEEP_CH);
        step = "making " + PS_HI_NAME + " (lit side of the folds)";
        const hi = await free(PS_HI_NAME, "levels", psLevelsValues(0, 255, PS_HI_GAMMA, [PS_HI_OUT_BLACK, 255]), burn, PS_LIT_CH);
        step = "setting blend modes";
        await psSetBlendInModal(sh.id, "multiply", split.one);
        if (sh2) await psSetBlendInModal(sh2.id, "multiply", split.two);
        await psSetBlendInModal(light, "normal", params.lightPct);
        await psSetBlendInModal(burn, "normal", params.burnPct);
        await psSetBlendInModal(hi, "screen", params.hiPct);
        step = "grouping " + PS_SDW_GROUP;
        sdwId = await psGroupInModal((sh2 ? [sh2.id] : []).concat([sh.id, cb, bc, sc1, sc2, light, burn, hi]), PS_SDW_GROUP);
        built.push(sdwId);
        const g = must(sdwId, "The " + PS_SDW_GROUP + " group");
        psPassThrough(g);
        step = "masking " + PS_SDW_GROUP + " to the garment";
        await psMaskToGarmentInModal(sdwId);
        step = "keeping " + PS_PB_GROUP + " above " + PS_SDW_GROUP;
        await psLayoutFixInModal();
        step = "locking " + PS_SHADOW_NAME;
        try { g.visible = true; } catch (_) {}
        try { const l = kbLayerById(sh.id); if (l) l.allLocked = true; } catch (e) { traceErr("ps shade: lock SHADOW", e); }
        if (sh2) { try { const l = kbLayerById(sh2.id); if (l) l.allLocked = true; } catch (e) { traceErr("ps shade: lock SHADOW 2", e); } }
        try { grey.visible = false; } catch (_) {}            // out of the way, not deleted
      }, { commandName: "KBImage — shading" });
      trace("ps shade: SDW group " + sdwId + ", " + JSON.stringify(params));
      return { layerIds: [sdwId], afterSnapshotRef: null, state: {} };
    } catch (err) {
      traceErr("ps shade / " + step, err);
      if (built.length) {                                    // never a half-built SDW: what this run made goes
        try { await deleteLayersById(built.slice().reverse()); trace("ps shade: removed what this run built (" + built.join(", ") + ")"); }
        catch (e) { traceErr("ps shade: remove the half-built shading", e); }
      }
      const e2 = new Error("Build shading failed while " + step + ": " + ((err && err.message) || String(err)));
      e2.cause = err;
      throw e2;
    } finally {
      try { await ps.core.executeAsModal(async function () { await kbRemoveChannels(PS_LIGHT_CH); await kbRemoveChannels(PS_DEEP_CH); await kbRemoveChannels(PS_LIT_CH); }, { commandName: "KBImage — fold masks" }); } catch (_) {}
    }
  }

  // Shading strength changed with an SDW in the document (kept or waiting): SHADOW's opacity,
  // and SHADOW 2 added, updated or removed, without a rebuild. Both are found by name inside
  // SDW (never a saved id). SHADOW and SHADOW 2 are the plug-in's own locks: unlocked for the
  // change and locked again. A kept SDW after Finish: the newest MERGED is redone in place.
  async function psShadeStrengthChanged() {
    const sd = psSdwGroup(), sh = sd ? psChildNamed(sd, PS_SHADOW_NAME) : null;
    if (!sh) return;
    if (generateInFlight) { kbBusyNote(); return; }
    const v = Math.round(kbNum("ps-sh-strength", 100, 0, PS_SHADOW_MAX)), split = psShadowSplit(v);
    generateInFlight = true;
    let did = "";
    try {
      await psMod().core.executeAsModal(async function () {
        const EP = psMod().constants.ElementPlacement;
        const S = psSdwGroup(), a = S ? psChildNamed(S, PS_SHADOW_NAME) : null;
        if (!a) throw new Error(PS_SHADOW_NAME + " is not in " + PS_SDW_GROUP + " any more.");
        let b = psChildNamed(S, PS_SHADOW2_NAME);
        await kbUnlockOneInModal(a);
        await psSetBlendInModal(a.id, "multiply", split.one);
        if (split.two > 0) {
          if (!b) {
            b = await a.duplicate(a, EP.PLACEAFTER, PS_SHADOW2_NAME);  // right under SHADOW: the clipped layers stay on SHADOW
            try { if (b.isClippingMask) b.isClippingMask = false; } catch (_) {}
            did = "added";
          } else { await kbUnlockOneInModal(b); did = "updated"; }
          await psSetBlendInModal(b.id, "multiply", split.two);
          try { b.allLocked = true; } catch (e) { traceErr("ps shade: lock SHADOW 2", e); }
        } else if (b) {
          const f = await kbDeleteLayerSafeInModal(b.id);
          if (f) throw new Error(PS_SHADOW2_NAME + " could not be removed (" + f.why + ").");
          did = "removed";
        }
        try { a.allLocked = true; } catch (e) { traceErr("ps shade: lock SHADOW", e); }
      }, { commandName: "KBImage — Shading strength" });
      trace("ps shade: strength " + v + "% → SHADOW " + split.one + "%" + (split.two ? ", SHADOW 2 " + split.two + "%" : "") + (did ? " (SHADOW 2 " + did + ")" : ""));
      let m = null;
      const kept = !psIsPending(sd.id);
      if (kept && !pendingRecall && psMergedAccepted()) m = await psMergedRebuild(true);
      setStatus(m && /could not/.test(m) ? "bad" : "ok", "Shading strength " + v + "%: SHADOW " + split.one + "%" + (split.two ? ", SHADOW 2 " + split.two + "%" : "")
        + (did ? " (SHADOW 2 " + did + ")" : "") + "." + (m ? " " + m : ""));
    } catch (e) { traceErr("ps shade: strength", e); setStatus("bad", "Could not change the Shading strength: " + ((e && e.message) || String(e))); }
    finally { generateInFlight = false; }
  }
  function psShadeStrengthWire() {
    const f = $("ps-sh-strength");
    if (f && !f.__kbWired) { f.__kbWired = true; f.addEventListener("change", function () { psShadeStrengthChanged().catch(function () {}); }); }
  }

  // First sentence and last: what the status line shows; the rest is in Details.
  function psShadeBuiltText(p) {
    const pair = String(p.tone || "light-light").split("-");
    return "Paint the Light 1, Levels 2 and Highlights masks to add or remove folds."
      + " Shading built: SDW group. " + pair[0] + " garment → " + pair[1] + " print: SHADOW (Multiply " + psShadowSplit(p.strengthPct).one + "%"
      + (psShadowSplit(p.strengthPct).two ? ", plus SHADOW 2 at " + psShadowSplit(p.strengthPct).two + "%" : "") + ", cut to the garment) maps the garment's median gray " + p.median
      + " to white, so only folds darken; fold contrast " + Number(p.foldContrast).toFixed(1) + " (Brightness/Contrast 1 contrast " + p.contrast + "), fold smoothing " + p.smoothPx + " px."
      + (p.smoothBy === "gaussian" ? " Fold smoothing: Gaussian fallback (Photoshop refused Surface Blur; Gaussian Blur " + p.smoothPx / 2 + " px)."
        : (p.smoothBy === "none" ? " Fold smoothing: off (Photoshop refused Surface Blur and Gaussian Blur)." : ""))
      + (p.ringBy === "on" ? " Edge ring " + p.ringPx + " px." : (p.ringBy === "off" ? " Edge ring: off (Photoshop refused it)." : ""))
      + (p.warmBy === "on" ? " Color Balance 1 toward the print ground " + p.ground + " (Cyan/Red " + p.cb[0] + ", Yellow/Blue " + p.cb[2] + ")."
        : (p.warmBy === "unmeasured" ? " Color Balance 1: no print ground read, Yellow/Blue -8." : " Warm shadows off: Color Balance 1 at 0."))
      + " Light 1 " + p.lightPct + "% on the fold edges (" + p.edgePct + "% of the garment), Levels 2 " + p.burnPct + "% on the deepest folds (" + p.deepPct + "%)."
      + " " + PS_HI_NAME + " " + p.hiPct + "% (Screen) on the lit side of the folds (" + p.litPct + "%)."
      + (p.moved ? " Trims and parts moved into PS." : "")
      + " Accept to keep, or change the fields and Re-run."
      + " Re-run replaces your painting.";
  }
  async function actPsBuildShade() {
    if (generateInFlight) { kbBusyNote(); return; }
    const ps = psMod();
    if (!ps.app.activeDocument) { setStatus("bad", "Open a Photoshop document first."); return; }
    if (!kbChannelExists(PS_GARMENT_CH)) { setStatus("bad", "Find the garment first (step 2)."); return; }
    if (!psGreyExactLayer()) { setStatus("bad", "Make gray and Accept " + PS_EXACT_LAYER + " first (step 5)."); return; }
    if (!psPartsGroup()) { setStatus("bad", "Find parts and Accept them first (step 6)."); return; }
    if (psOtherPending("printswap:shade")) { setStatus("bad", "Accept or Re-run the preview that is waiting first."); return; }
    const oldGroup = psSdwGroup() || psTopLayerNamed(PS_SHADE_GROUP), oldVeil = psTopLayerNamed(PS_VEIL_NAME);
    const pend = (pendingRecall && pendingRecall.layerIds) || [];
    if ((oldGroup && pend.indexOf(oldGroup.id) < 0) || (oldVeil && pend.indexOf(oldVeil.id) < 0)) {
      if (Date.now() > psShadeArmUntil) {
        psShadeArmUntil = Date.now() + 5000;
        setStatus("bad", "This replaces the shading (SDW" + (psTopLayerNamed(PS_SHADE_GROUP) || oldVeil ? ", and the old GREY group and GREY copy 3" : "") + "), with any changes made by hand, including painted masks. Click Build shading again within 5 seconds to go ahead.");
        return;
      }
      psShadeArmUntil = 0;
      try { await psShadeCleanup(); } catch (_) {}
    }
    await psToneCheck(false);                              // a swapped print: measured and picked again
    const p = psShadeParams();
    generateInFlight = true;
    traceStart("Print Swap — Build shading");
    try {
      await psRecall(8, "ps-recall-anchor-8", { op: "printswap:shade", params: p, targetLayerId: null, sourceRef: "gray:" + PS_EXACT_LAYER,
        paramsProvider: psShadeParams, execute: executePsShade,
        preDiscard: async function () { await psShadeCleanup(); },            // Re-run / a new run: every old one goes
        discard: async function () { await psShadeCleanup(); return null; },
        reRunStatus: function (pp) { return psShadeBuiltText(pp); } });
      setStatus("ok", psShadeBuiltText(p));
    } catch (err) {
      traceErr("ps shade", err && err.cause ? err.cause : err);
      setStatus("bad", (err && err.message) || "Build shading failed.");
    } finally {
      generateInFlight = false;
      try { updateDocInfo(); } catch (_) {}
      await traceFlush();
    }
  }

  // =======================================================================
  // PRINT SWAP — step 4 TRIMS.
  // No AI for piping; buttons and the other trims (lace, drawcord, bow,
  // zipper …) use SAM 3.1 close-ups.
  //
  //   FIND PIPING — Accept / Re-run. Reads CLEAN (or the photo when no CLEAN is
  //     accepted) by layer, inside KBPS garment, at full resolution:
  //       Colored: HSV saturation ≥ tolerance (CLEAN is neutral gray, so colour
  //                left in it is trim — like Select > Color Range).
  //       Neutral: long thin lines of ONE direction (lighter or darker than the
  //                garment around them, edge ring left out): psPipingNeutral.
  //     → channel "KBPS piping", shown as the selection.
  //   FIND BUTTONS — Accept / Re-run. SAM 3.1 "button" close-ups over the
  //     garment box → channel "KBPS buttons". None found → add by hand.
  //   TOUCH UP — + / − the current selection to / from either channel.
  //   TRIM GROUPS — built when Find piping / Find buttons is accepted; see
  //     "TRIM GROUPS" below (PIPING = CLEAN + Blend If, BUTTON = CLEAN masked to
  //     KBPS buttons, each with a clipped Color Fill in Color mode, off by default).
  //     Nothing is cut out of the parts below; the trims sit on top.
  // =======================================================================
  const PS_PIPING_CH   = "KBPS piping";
  const PS_BUTTONS_CH  = "KBPS buttons";
  const PS_TRIM_TMP    = "KBPS_tmp_trim";
  const PS_PIPING_GRP  = "PIPING";
  const PS_BUTTON_GRP  = "BUTTON";
  const PS_TRIM_TOL    = { colored: 20, neutral: 12 };   // colored 20% from the team's file: red piping ≥ 0.47 sat, neutral fabric ≤ 0.04
  let psTrimTol = { colored: PS_TRIM_TOL.colored, neutral: PS_TRIM_TOL.neutral };

  // ----- Panel -------------------------------------------------------------------
  function psPipingMode() { return readPills("pills-ps-piping-mode", "colored") === "neutral" ? "neutral" : "colored"; }
  function psTrimTolSync() {
    const m = psPipingMode(), sl = $("ps-piping-tol"), lb = $("ps-piping-tol-val");
    if (sl) sl.value = String(psTrimTol[m]);
    const v = psTrimTol[m];
    if (lb) lb.textContent = v + (m === "colored" ? "% color" : "% contrast");
  }
  function psTrimsOnTabOpen() {
    const sl = $("ps-piping-tol");
    if (sl && !sl.__kbWired) {
      sl.__kbWired = true;
      const upd = function () { const v = Math.max(1, Math.min(100, Math.round(Number(sl.value) || 1))); psTrimTol[psPipingMode()] = v; psTrimTolSync(); };
      sl.addEventListener("input", upd);
      sl.addEventListener("change", upd);
    }
    psTrimTolSync();
    psPipingDirRowSync();
    try { psNeuFieldsFill(false); } catch (_) {}
    try { psGtypeRender(); } catch (_) {}   // the type picker + this type's trims
  }
  // Colored / Neutral on the step 4 face. Until you click one, Find piping picks it from
  // the thin lines in CLEAN (psPipingAutoPick) and says which; a click keeps yours.
  let psPipingModeBy = "auto";
  function psTrimsOnModeChanged() {
    psPipingModeBy = "you";
    psTrimTolSync();
    psPipingDirRowSync();
    psPipingModeNote("Your pick: " + (psPipingMode() === "neutral" ? "Neutral" : "Colored") + ". Find piping uses it.");
  }
  function psPipingModeNote(text) { const el = $("ps-piping-mode-note"); if (el) el.textContent = text; }
  function psSetPipingMode(m) {
    const g = $("pills-ps-piping-mode");
    if (g) { const p = g.querySelectorAll(".pill"); for (let i = 0; i < p.length; i++) p[i].classList.toggle("selected", p[i].getAttribute("data-value") === m); }
    psTrimTolSync();
    psPipingDirRowSync();
  }
  // Neutral direction: auto (measured each Find piping) until Light or Dark is clicked.
  let psPipingDirBy = "auto";
  function psPipingDir() { return readPills("pills-ps-piping-dir", "light") === "dark" ? "dark" : "light"; }
  function psPipingDirShow(dir, by) {
    const g = $("pills-ps-piping-dir");
    if (g) { const p = g.querySelectorAll(".pill"); for (let i = 0; i < p.length; i++) p[i].classList.toggle("selected", p[i].getAttribute("data-value") === dir); }
    const n = $("ps-piping-dir-note");
    if (n) n.textContent = dir ? "Neutral: " + dir + " lines" + (by === "you" ? " (your pick)" : (by === "doc" ? " (saved with this file)" : " (auto)")) : "Neutral: light or dark, picked when you click Find piping";
  }
  function psPipingDirRowSync() { const r = $("ps-piping-dir-row"); if (r) r.classList.toggle("hidden", psPipingMode() !== "neutral"); }
  function psTrimsOnDirChanged() {
    psPipingDirBy = "you";
    psPipingDirShow(psPipingDir(), "you");
  }
  function psPipingModeReset() {
    psPipingDirBy = "auto";
    try { psPipingDirShow(null); } catch (_) {}
    psPipingModeBy = "auto";
    psPipingModeNote("Picked from the thin lines in CLEAN when you click Find piping.");
  }

  // The ORIGINAL photo: the step 2 photo if still there, else the lowest
  // ordinary top-level layer (not CLEAN / GREY / KB / PARTS / a group).
  function psOriginalPhotoId() {
    const up = psUpscaleLayer();
    if (up) return up.id;                            // step 0: UPSCALE is the photo (the original is hidden below it)
    const bad = function (n) { return n === PS_CLEAN_NAME || n.indexOf(PS_GREY_NAME) === 0 || n.indexOf("KB") === 0 || n.indexOf("kb_") === 0 || n === PS_PARTS_GROUP || n === "WHITE" || n === "MODEL" || n === "BG LIGHTEN"; };
    if (psPhotoLayerId != null) { const l = kbLayerById(psPhotoLayerId); if (l && !bad(String(l.name || ""))) return psPhotoLayerId; }
    try {
      const t = psMod().app.activeDocument.layers;
      for (let i = t.length - 1; i >= 0; i--) { const l = t[i]; if (!l || l.layers || bad(String(l.name || ""))) continue; return l.id; }
    } catch (_) {}
    return null;
  }

  // The garment box (doc px): KBPS garment's own pixels (> 16) plus a small margin,
  // and the garment coverage over it. Reads the mask over the whole document.
  async function psGarmentBox(marginFrac) {
    const doc = psMod().app.activeDocument;
    const docW = Math.round(doc.width), docH = Math.round(doc.height);
    const full = { left: 0, top: 0, right: docW, bottom: docH };
    const al = await psReadMaskAlpha(full);
    let bl = docW, bt = docH, br = -1, bb = -1;
    for (let y = 0; y < docH; y++) { const o = y * docW; for (let x = 0; x < docW; x++) if (al[o + x] > 16) { if (x < bl) bl = x; if (x > br) br = x; if (y < bt) bt = y; if (y > bb) bb = y; } }
    if (br < 0) throw new Error("the garment channel is empty. Find the garment first (step 2).");
    const m = Math.max(4, Math.round(Math.max(br - bl + 1, bb - bt + 1) * marginFrac));
    const rect = { left: Math.max(0, bl - m), top: Math.max(0, bt - m), right: Math.min(docW, br + 1 + m), bottom: Math.min(docH, bb + 1 + m) };
    const rw = rect.right - rect.left, rh = rect.bottom - rect.top, alpha = new Uint8Array(rw * rh);
    for (let y = 0; y < rh; y++) alpha.set(al.subarray((rect.top + y) * docW + rect.left, (rect.top + y) * docW + rect.left + rw), y * rw);
    return { rect: rect, alpha: alpha, docW: docW, docH: docH };
  }

  // Inside executeAsModal: one layer's own RGB over rect (doc px), no resize.
  // Pixels the layer does not cover stay 0 with valid = 0.
  async function psReadLayerRgb(layerId, rect) {
    const ps = psMod();
    const doc = ps.app.activeDocument;
    const rw = rect.right - rect.left, rh = rect.bottom - rect.top;
    const rgb = new Uint8Array(rw * rh * 3), valid = new Uint8Array(rw * rh);
    const layer = kbLayerById(layerId);
    if (!layer) return { rgb: rgb, valid: valid };
    const lb = layer.bounds;
    const sb = { left: Math.max(rect.left, Math.floor(Number(lb.left) || 0)), top: Math.max(rect.top, Math.floor(Number(lb.top) || 0)),
                 right: Math.min(rect.right, Math.ceil(Number(lb.right) || 0)), bottom: Math.min(rect.bottom, Math.ceil(Number(lb.bottom) || 0)) };
    if (!(sb.right > sb.left && sb.bottom > sb.top)) return { rgb: rgb, valid: valid };
    const pr = await getLayerPixels8({ documentID: doc.id, layerID: layerId, sourceBounds: sb, componentSize: 8 });   // 16-bit safe
    const img = pr && pr.imageData;
    if (!img) return { rgb: rgb, valid: valid };
    try {
      const got = pr.sourceBounds || sb;
      const gl = Math.round(Number(got.left)), gt = Math.round(Number(got.top));
      const d = await img.getData({ chunky: true });
      const w = img.width, h = img.height, c = img.components || Math.round(d.length / (w * h));
      for (let y = 0; y < h; y++) {
        const oy = gt + y - rect.top; if (oy < 0 || oy >= rh) continue;
        for (let x = 0; x < w; x++) {
          const ox = gl + x - rect.left; if (ox < 0 || ox >= rw) continue;
          const p = (y * w + x) * c, o = oy * rw + ox;
          if (c === 4 && d[p + 3] < 128) continue;
          rgb[o * 3] = d[p]; rgb[o * 3 + 1] = d[c >= 3 ? p + 1 : p]; rgb[o * 3 + 2] = d[c >= 3 ? p + 2 : p];
          valid[o] = 1;
        }
      }
    } finally { try { img.dispose(); } catch (_) {} }
    return { rgb: rgb, valid: valid };
  }

  // A plane (rect-sized, white = inside) → alpha channel chName, by the proven
  // route: an opaque black layer + the plane placed at rect on top, their
  // brightness → the selection → saved. Temp layers deleted.
  async function psRectPlaneToChannel(plane, rw, rh, rect, chName) {
    const ps = psMod();
    const rgba = new Uint8Array(rw * rh * 4);
    for (let k = 0, o = 0; k < plane.length; k++, o += 4) { const v = plane[k]; rgba[o] = v; rgba[o + 1] = v; rgba[o + 2] = v; rgba[o + 3] = 255; }
    const bytes = psPngRgba(rgba, rw, rh);
    const folder = await fsLocal().getDataFolder();
    const file = await folder.createFile("kbps-trim-" + Date.now() + ".png", { overwrite: true });
    await file.write(bytes.buffer.byteLength === bytes.length ? bytes.buffer : bytes.slice().buffer, { format: fmts().binary });
    const f = { file: file, token: await fsLocal().createSessionToken(file) };
    const tmp = [];
    try {
      await ps.core.executeAsModal(async function () {
        const doc = ps.app.activeDocument;
        try { await deselectAll(); } catch (_) {}
        try { const top = doc.layers && doc.layers[0]; if (top) await kbSelectLayerById(top.id); } catch (_) {}
        try { await selectRGBChannel(); } catch (_) {}
        await ps.action.batchPlay([{ _obj: "make", _target: [{ _ref: "layer" }], using: { _obj: "layer", name: PS_TMP_LAYER },
          _options: { dialogOptions: "dontDisplay" } }], { synchronousExecution: true });
        tmp.push(kbActiveLayerId());
        await kbFillActiveLayer([0, 0, 0]);
        tmp.push(await kbPlaceFileInModal(f, PS_TMP_LAYER, rect));
        await kbSelectCompositeLuminosity();
        await kbRemoveChannels(chName);
        await saveSelectionToChannel(chName);
        try { await deselectAll(); } catch (_) {}
      }, { commandName: "KBImage — save " + chName });
    } finally {
      await kbDeleteFile(f);
      if (tmp.length) { try { await deleteLayersById(tmp); } catch (_) {} }
    }
  }

  async function psShowChannel(chName) {
    const ps = psMod();
    await ps.core.executeAsModal(async function () { if (kbChannelExists(chName)) await kbLoadChannel(chName); },
      { commandName: "KBImage — show " + chName });
  }

  // =======================================================================
  // PIPING DETECTION — begin. One self-contained module: pure functions on pixel arrays,
  // no shared state, nothing from outside (its own copies of the blur / dilate helpers).
  // Find piping calls it through KBPiping; tests/piping/run.js runs it on the saved piping
  // cases and checks this block uses nothing from outside it. Changes to layout, parts or
  // shading never touch it.
  // =======================================================================
  const KBPiping = (function () {
    // Private copies of the general helpers, so a change made for shading or parts never
    // changes piping.
    function pipBoxBlur(src, w, h, r) {
      const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
      for (let y = 0; y < h; y++) {
        let acc = 0, n = 0;
        const o = y * w;
        for (let x = -r; x < w; x++) {
          const add = x + r, sub = x - r - 1;
          if (add < w) { acc += src[o + add]; n++; }
          if (sub >= 0) { acc -= src[o + sub]; n--; }
          if (x >= 0) tmp[o + x] = acc / n;
        }
      }
      for (let x = 0; x < w; x++) {
        let acc = 0, n = 0;
        for (let y = -r; y < h; y++) {
          const add = y + r, sub = y - r - 1;
          if (add < h) { acc += tmp[add * w + x]; n++; }
          if (sub >= 0) { acc -= tmp[sub * w + x]; n--; }
          if (y >= 0) out[y * w + x] = acc / n;
        }
      }
      return out;
    }
    function pipDilate(b, w, h, r) {
      const f = new Float32Array(w * h); for (let k = 0; k < f.length; k++) f[k] = b[k] ? 1 : 0;
      const bl = pipBoxBlur(f, w, h, r), out = new Uint8Array(w * h);
      for (let k = 0; k < out.length; k++) if (bl[k] > 0.0001) out[k] = 1;
      return out;
    }
    function pipColorRef(rgb, stride, sel, N, valid) {
      const R0 = [], G0 = [], B0 = [];
      for (let k = 0; k < N; k++) if (sel[k] && (!valid || valid[k])) { R0.push(rgb[k * stride]); G0.push(rgb[k * stride + 1]); B0.push(rgb[k * stride + 2]); }
      if (R0.length < 50) return null;
      const med = function (a) { a.sort(function (x, y) { return x - y; }); return a[a.length >> 1]; };
      const r = { r: med(R0.slice()), g: med(G0.slice()), b: med(B0.slice()), n: R0.length };
      const d = [];
      for (let i = 0; i < R0.length; i++) d.push(Math.hypot(R0[i] - r.r, G0[i] - r.g, B0[i] - r.b));
      r.tol = Math.min(48, Math.max(24, 2.5 * med(d)));       // a mask's soft edge widens the spread: capped
      return r;
    }

    // Pure: the piping plane (rect-sized, 0 / 255).
    function pipPlane(src, alpha, rw, rh, mode, tolPct) {
      const N = rw * rh, rgb = src.rgb, out = new Uint8Array(N);
      if (mode === "colored") {
        const t = tolPct / 100;
        for (let k = 0; k < N; k++) {
          if (alpha[k] <= 127 || !src.valid[k]) continue;
          const r = rgb[k * 3], g = rgb[k * 3 + 1], b = rgb[k * 3 + 2];
          const mx = r > g ? (r > b ? r : b) : (g > b ? g : b), mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
          if (mx > 20 && (mx - mn) / mx >= t) out[k] = 255;
        }
      } else {
        const L = new Float32Array(N), A = new Float32Array(N);
        for (let k = 0; k < N; k++) { L[k] = (rgb[k * 3] * 77 + rgb[k * 3 + 1] * 150 + rgb[k * 3 + 2] * 29) >> 8; A[k] = alpha[k] > 127 ? 1 : 0; }
        const r = Math.max(3, Math.round(Math.max(rw, rh) * 0.004));
        const mean = pipBoxBlur(L, rw, rh, r * 3), inside = pipBoxBlur(A, rw, rh, r);          // wide mean: a thin line barely moves it (no halo)
        const t = tolPct * 2.55, sel = new Float32Array(N);
        for (let k = 0; k < N; k++) if (inside[k] > 0.98 && src.valid[k] && Math.abs(L[k] - mean[k]) >= t) sel[k] = 1;   // away from the silhouette
        const wide = pipBoxBlur(sel, rw, rh, r * 2);                                                   // wide dark / light areas are folds, not piping
        for (let k = 0; k < N; k++) if (sel[k] && wide[k] < 0.6) out[k] = 255;
      }
      // Despeckle: drop pixels with almost no selected neighbours.
      const f = new Float32Array(N); for (let k = 0; k < N; k++) f[k] = out[k] ? 1 : 0;
      const nb = pipBoxBlur(f, rw, rh, 1);
      for (let k = 0; k < N; k++) if (out[k] && nb[k] < 0.34) out[k] = 0;
      return out;
    }

    // Pure: NEUTRAL piping as lines of ONE direction (white piping on gray = light lines).
    //   1. Each pixel is compared with the mean of the GARMENT pixels around it (KBPS garment
    //      only, never the background), so the cutout edge does not read as contrast.
    //   2. A thin ring (about 0.1% of the image's long edge) is left out where the garment
    //      meets the BACKGROUND (outside KBPS garment and outside KBPS person), so the cut-out
    //      edge is never a line. Where it meets skin, hair or the neckline there is no ring:
    //      collar, lapel, cuff and hem piping on that edge stays. Without KBPS person every
    //      edge gets the ring (as before).
    //   3. Candidates: lighter (or darker) than that mean by the tolerance, minus keepOut
    //      (KBPS hands, KBPS buttons).
    //   4. Lines, not specks: each connected piece is measured (length = half its outline,
    //      width = 2 × area / outline). Kept when long (≥ 2% of the long edge), thin (0.08%
    //      to 0.6%: a fold ridge only crosses the tolerance along a hairline crest), sharp-
    //      edged (at half the tolerance it may not spread to more than 1.8 × its area: a
    //      fold fades out slowly, piping stops at its edge) and not faint (at least half the
    //      contrast of the strongest long line: heather and folds are weaker than piping).
    //      In the collar area (the top 20% of the garment box) the minimum length is 40%
    //      of it: collar piping comes in short curved pieces.
    //   5. Rescue at the edge: a line touching the ring that runs more than 3% of the
    //      garment height is kept even when the ring took half its width (width, sharpness
    //      and faintness are not asked of it), and it is carried on into the ring where the
    //      ring pixels pass the tolerance within one ring width of it, so it reaches the edge.
    //      The ring on its own (the cut-out halo) never makes a line.
    //   opts: { ring, minLen } (px, the retoucher's, else auto), person (rect-sized KBPS person).
    //   dir "light" | "dark" | "auto" (both are measured; the one with more strong line
    //   length wins). docLong = the image's long edge (px). → { plane, dir, kept, dropped,
    //   keptPx, score: { light, dark } }.
    const PIP_NEU = { ring: 0.001, mean: 0.012, minLen: 0.02, minW: 0.0008, maxW: 0.006, spread: 1.8, faint: 0.5, collar: 0.2, collarLen: 0.4, rescue: 0.03 };
    // The auto Edge ring and Min line length (px) for an image whose long edge is Lg px.
    function pipNeuAuto(Lg) { return { ring: Math.max(2, Math.round(Lg * PIP_NEU.ring)), minLen: Math.max(40, Math.round(Lg * PIP_NEU.minLen)) }; }
    function pipNeutral(src, alpha, rw, rh, tolPct, dir, docLong, keepOut, opts) {
      const o = opts || {};
      const N = rw * rh, rgb = src.rgb, Lg = Math.max(docLong || 0, rw, rh), au = pipNeuAuto(Lg);
      const ring = o.ring != null && o.ring >= 0 ? Math.round(o.ring) : au.ring, R = Math.max(9, Math.round(Lg * PIP_NEU.mean));
      const minLen = o.minLen != null && o.minLen > 0 ? Math.round(o.minLen) : au.minLen, maxW = Math.max(4, Math.round(Lg * PIP_NEU.maxW)), minW = Math.max(2, Lg * PIP_NEU.minW);
      const collarY = Math.round(rh * PIP_NEU.collar), collarLen = Math.max(12, Math.round(minLen * PIP_NEU.collarLen));
      const L = new Float32Array(N), G = new Float32Array(N), LG = new Float32Array(N), bg = new Uint8Array(N);
      let gTop = rh, gBot = -1;
      for (let k = 0; k < N; k++) {
        const g = alpha[k] > 127 && src.valid[k] ? 1 : 0;
        L[k] = (rgb[k * 3] * 77 + rgb[k * 3 + 1] * 150 + rgb[k * 3 + 2] * 29) / 256;
        G[k] = g; LG[k] = L[k] * g;
        bg[k] = !g && !(o.person && o.person[k] > 127) ? 1 : 0;           // background: not garment, not the person (skin, hair, neck)
        if (g) { const y = (k / rw) | 0; if (y < gTop) gTop = y; if (y > gBot) gBot = y; }
      }
      const rescueLen = Math.max(minLen, Math.round(Math.max(1, gBot - gTop + 1) * PIP_NEU.rescue));
      const nearEdge = ring > 0 ? pipDilate(bg, rw, rh, ring) : bg;         // the ring against the background (and the background)
      const num = pipBoxBlur(LG, rw, rh, R), den = pipBoxBlur(G, rw, rh, R);
      const Ls = pipBoxBlur(L, rw, rh, 1);                                  // heather noise down for the edge test
      const d = new Float32Array(N), ds = new Float32Array(N), core = new Uint8Array(N), inRing = new Uint8Array(N);
      for (let k = 0; k < N; k++) {
        if (!G[k] || !(den[k] > 0)) continue;
        const m = num[k] / den[k];
        d[k] = L[k] - m; ds[k] = Ls[k] - m;
        if (nearEdge[k]) inRing[k] = 1; else core[k] = 1;
      }
      const byRing = pipDilate(inRing, rw, rh, 1);                          // core pixels touching the ring
      const t = tolPct * 2.55;
      const one = function (sg) {
        const cand = new Uint8Array(N);
        for (let k = 0; k < N; k++) if (core[k] && !(keepOut && keepOut[k]) && sg * d[k] >= t) cand[k] = 1;
        // pieces (8-connected)
        const lab = new Int32Array(N), stack = new Int32Array(N);
        const area = [0], perim = [0], con = [0], top = [0], edge = [0];
        let nl = 0;
        for (let k0 = 0; k0 < N; k0++) {
          if (!cand[k0] || lab[k0]) continue;
          nl++; area.push(0); perim.push(0); con.push(0); top.push(rh); edge.push(0);
          let sp = 0; stack[sp++] = k0; lab[k0] = nl;
          while (sp) {
            const k = stack[--sp], x = k % rw, y = (k - x) / rw;
            area[nl]++; con[nl] += sg * d[k];
            if (y < top[nl]) top[nl] = y;
            if (byRing[k]) edge[nl]++;
            if (x === 0 || y === 0 || x === rw - 1 || y === rh - 1 || !cand[k - 1] || !cand[k + 1] || !cand[k - rw] || !cand[k + rw]) perim[nl]++;
            for (let dy = -1; dy <= 1; dy++) {
              const yy = y + dy; if (yy < 0 || yy >= rh) continue;
              for (let dx = -1; dx <= 1; dx++) {
                const xx = x + dx; if (xx < 0 || xx >= rw) continue;
                const q = yy * rw + xx;
                if (cand[q] && !lab[q]) { lab[q] = nl; stack[sp++] = q; }
              }
            }
          }
        }
        // edge sharpness: the half-tolerance area near each piece (within maxW of it)
        const near = pipDilate(cand, rw, rh, maxW), half = new Uint8Array(N);
        for (let k = 0; k < N; k++) if (near[k] && core[k] && !(keepOut && keepOut[k]) && sg * ds[k] >= t / 2) half[k] = 1;
        const hl = new Int32Array(N), hArea = [0], cArea = [0];
        let nh = 0;
        for (let k0 = 0; k0 < N; k0++) {
          if (!half[k0] || hl[k0]) continue;
          nh++; hArea.push(0); cArea.push(0);
          let sp = 0; stack[sp++] = k0; hl[k0] = nh;
          while (sp) {
            const k = stack[--sp], x = k % rw, y = (k - x) / rw;
            hArea[nh]++; if (cand[k]) cArea[nh]++;
            for (let dy = -1; dy <= 1; dy++) {
              const yy = y + dy; if (yy < 0 || yy >= rh) continue;
              for (let dx = -1; dx <= 1; dx++) {
                const xx = x + dx; if (xx < 0 || xx >= rw) continue;
                const q = yy * rw + xx;
                if (half[q] && !hl[q]) { hl[q] = nh; stack[sp++] = q; }
              }
            }
          }
        }
        const spread = new Float32Array(nl + 1);                         // each piece: its half-area group's ratio
        for (let k = 0; k < N; k++) if (lab[k] && !spread[lab[k]]) { const h = hl[k]; spread[lab[k]] = h && cArea[h] ? hArea[h] / cArea[h] : 1; }
        const keep = new Uint8Array(nl + 1);
        let kept = 0, dropped = 0, keptPx = 0, score = 0, ref = 0;
        const why = { short: 0, hairline: 0, wide: 0, soft: 0, faint: 0 }, ok = [], rescued = [];
        for (let i = 1; i <= nl; i++) {
          const len = perim[i] / 2, wid = 2 * area[i] / Math.max(1, perim[i]);
          // a line along the edge (touching the ring along much of it), long enough: kept as it is
          if (edge[i] >= len * 0.3 && len >= rescueLen && wid >= 1) { rescued.push(i); continue; }
          if (len < (top[i] < collarY ? collarLen : minLen)) { why.short++; dropped++; continue; }
          if (wid < minW) { why.hairline++; dropped++; continue; }
          if (wid > maxW) { why.wide++; dropped++; continue; }
          if (spread[i] > PIP_NEU.spread) { why.soft++; dropped++; continue; }
          const c = con[i] / area[i];
          ok.push(i);
          if (len >= minLen * 2 && c > ref) ref = c;                        // the strongest long line
        }
        for (let j = 0; j < ok.length; j++) {
          const i = ok[j], c = con[i] / area[i];
          if (c < ref * PIP_NEU.faint) { why.faint++; dropped++; continue; }
          keep[i] = 1; kept++; keptPx += area[i]; score += perim[i] / 2 * c;
        }
        for (let j = 0; j < rescued.length; j++) { const i = rescued[j]; keep[i] = 1; kept++; keptPx += area[i]; score += perim[i] / 2 * con[i] / area[i]; }
        const plane = new Uint8Array(N), kp = new Uint8Array(N);
        for (let k = 0; k < N; k++) if (lab[k] && keep[lab[k]]) { plane[k] = 255; kp[k] = 1; }
        // kept lines carried on into the ring: straight steps (left, right, up, down) from a
        // kept pixel through ring pixels that pass the tolerance, at most one ring width, so a
        // line reaches the edge but never turns a corner onto the cut-out halo
        let ringPx = 0;
        if (ring > 0) {
          const steps = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          for (let k = 0; k < N; k++) {
            if (!kp[k] || !byRing[k]) continue;
            const x0 = k % rw, y0 = (k - x0) / rw;
            for (let s = 0; s < 4; s++) {
              for (let j = 1; j <= ring + 1; j++) {
                const x = x0 + steps[s][0] * j, y = y0 + steps[s][1] * j;
                if (x < 0 || y < 0 || x >= rw || y >= rh) break;
                const q = y * rw + x;
                if (!inRing[q] || (keepOut && keepOut[q]) || sg * d[q] < t) break;
                if (!plane[q]) { plane[q] = 255; ringPx++; }
              }
            }
          }
        }
        return { plane: plane, kept: kept, dropped: dropped, keptPx: keptPx + ringPx, score: score, why: why, rescued: rescued.length, ringPx: ringPx };
      };
      const lt = dir === "dark" ? null : one(1), dk = dir === "light" ? null : one(-1);
      const pick = dir === "light" ? "light" : (dir === "dark" ? "dark" : (dk.score > lt.score ? "dark" : "light"));
      const r = pick === "light" ? lt : dk;
      return { plane: r.plane, dir: pick, kept: r.kept, dropped: r.dropped, keptPx: r.keptPx, why: r.why, rescued: r.rescued, ringPx: r.ringPx,
        score: { light: lt ? Math.round(lt.score) : null, dark: dk ? Math.round(dk.score) : null },
        sizes: { ring: ring, mean: R, minLen: minLen, collarLen: collarLen, collarY: collarY, rescueLen: rescueLen, minW: Math.round(minW * 10) / 10, maxW: maxW, person: !!o.person } };
    }

    // Pure: Neutral Find piping on pixels already read, exactly as the panel runs it (and as
    // tests/piping_cases_test.js runs it on saved real files): KBPS hands (sm, from
    // pipSkinMask) and the found buttons (grown 0.2% of the long edge) kept out, KBPS
    // person for the edge ring. buttons / person: rect-sized 0..255 or null. The skin is
    // taken off afterwards (pipDropSkin), as for Colored.
    function pipNeutralFind(src, alpha, rw, rh, docLong, tolPct, dir, sm, buttons, person, sizes) {
      const N = rw * rh, keepOut = new Uint8Array(N);
      if (sm) for (let k = 0; k < N; k++) if (sm.hands[k]) keepOut[k] = 1;
      if (buttons) {
        const b1 = new Uint8Array(N);
        for (let k = 0; k < N; k++) if (buttons[k] > 127) b1[k] = 1;
        const bo = pipDilate(b1, rw, rh, Math.max(2, Math.round(docLong * 0.002)));
        for (let k = 0; k < N; k++) if (bo[k]) keepOut[k] = 1;
      }
      const s = sizes || {};
      return pipNeutral(src, alpha, rw, rh, tolPct, dir, docLong, keepOut, { ring: s.ring, minLen: s.minLen, person: person });
    }
    // Pure: where piping must never be found (rect-sized, 1 = keep out): KBPS hands grown a
    // little, plus garment pixels with the hands' skin color near the hands or near the
    // garment's edge (fingers, wrists, a neckline left inside the garment mask; skin is
    // never in the middle of the garment, so a pink print there is left alone).
    // `hands` = KBPS hands over the rect (0..255).
    function pipSkinMask(src, alpha, hands, rw, rh) {
      const N = rw * rh, h = new Uint8Array(N);
      let hn = 0; for (let k = 0; k < N; k++) if (hands[k] > 127) { h[k] = 1; hn++; }
      if (!hn) return null;
      const handsOut = pipDilate(h, rw, rh, Math.max(2, Math.round(Math.max(rw, rh) * 0.003)));
      const E = Math.max(4, Math.round(Math.max(rw, rh) * 0.01));
      const nearHands = pipDilate(h, rw, rh, E * 2);
      const A = new Float32Array(N); for (let k = 0; k < N; k++) A[k] = alpha[k] > 127 ? 1 : 0;
      const inside = pipBoxBlur(A, rw, rh, E);                                 // < 1 near the garment's edge
      const skin = new Uint8Array(N);
      const ref = pipColorRef(src.rgb, 3, h, N, src.valid);
      if (ref) {
        for (let k = 0; k < N; k++) {
          if (handsOut[k] || alpha[k] <= 127 || !src.valid[k]) continue;
          if (!nearHands[k] && inside[k] > 0.98) continue;
          if (Math.hypot(src.rgb[k * 3] - ref.r, src.rgb[k * 3 + 1] - ref.g, src.rgb[k * 3 + 2] - ref.b) <= ref.tol) skin[k] = 1;
        }
      }
      return { hands: handsOut, skin: skin, ref: ref };
    }
    // Pure: take the skin mask off a piping plane. If the skin COLOR alone would take most
    // of the piping, the piping is skin-colored itself: then only the hands come off.
    function pipDropSkin(plane, sm) {
      const r = { handsPx: 0, skinPx: 0, skinColorSkipped: false };
      if (!sm) return r;
      let rest = 0, bySkin = 0;                                  // piping found outside the hands
      for (let k = 0; k < plane.length; k++) if (plane[k] && !sm.hands[k]) { rest++; if (sm.skin[k]) bySkin++; }
      r.skinColorSkipped = rest > 0 && bySkin > rest * 0.6;
      for (let k = 0; k < plane.length; k++) {
        if (!plane[k]) continue;
        if (sm.hands[k]) { plane[k] = 0; r.handsPx++; }
        else if (sm.skin[k] && !r.skinColorSkipped) { plane[k] = 0; r.skinPx++; }
      }
      return r;
    }
    // Pure: Colored or Neutral piping for this CLEAN. CLEAN's fabric is gray, so thin
    // lines that still carry color are colored trim; with (almost) none, the piping is
    // white, black or gray. Skin (sm) is left out first.
    function pipAutoPick(src, alpha, rw, rh, sm, tol) {
      const N = rw * rh;
      const col = pipPlane(src, alpha, rw, rh, "colored", tol.colored);
      const neu = pipPlane(src, alpha, rw, rh, "neutral", tol.neutral);
      if (sm) { pipDropSkin(col, sm); pipDropSkin(neu, sm); }
      const f = new Float32Array(N); for (let k = 0; k < N; k++) f[k] = col[k] ? 1 : 0;
      const r = Math.max(3, Math.round(Math.max(rw, rh) * 0.004));
      const wide = pipBoxBlur(f, rw, rh, r * 2);                              // blobs (print left behind) are not lines
      let garment = 0, colored = 0, neutral = 0;
      for (let k = 0; k < N; k++) {
        if (alpha[k] > 127) garment++;
        if (col[k] && wide[k] < 0.6) colored++;
        else if (neu[k]) {
          const R = src.rgb[k * 3], G = src.rgb[k * 3 + 1], B = src.rgb[k * 3 + 2];
          const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
          if (mx <= 20 || (mx - mn) / mx < 0.12) neutral++;
        }
      }
      const need = Math.max(500, Math.round(garment * 0.002));             // 0.2% of the garment
      return { mode: colored >= need ? "colored" : "neutral", coloredPx: colored, neutralPx: neutral, garmentPx: garment, need: need };
    }


    return { plane: pipPlane, neutral: pipNeutral, neutralFind: pipNeutralFind, skinMask: pipSkinMask, dropSkin: pipDropSkin,
      autoPick: pipAutoPick, neuAuto: pipNeuAuto, NEU: PIP_NEU };
  })();
  // ===== PIPING DETECTION — end =====

  // ----- FIND PIPING -------------------------------------------------------------
  async function executePsPiping(params) {
    const ps = psMod();
    if (!ps.app.activeDocument) throw new Error("Open a Photoshop document first.");
    return kbKeepView(async function () { return executePsPipingRun(params); });   // the view stays as it is
  }
  async function executePsPipingRun(params) {
    const ps = psMod();
    let step = "reading the garment";
    try {
      setStatus("busy", "Reading the garment…");
      const g = await psGarmentBox(0.01);
      const rect = g.rect, rw = rect.right - rect.left, rh = rect.bottom - rect.top;
      const cleanId = psAcceptedCleanId();
      const srcId = cleanId != null ? cleanId : psOriginalPhotoId();
      if (srcId == null) throw new Error("no photo layer found.");
      params.source = cleanId != null ? "CLEAN" : "photo";
      step = "reading " + params.source;
      let src = null;
      await ps.core.executeAsModal(async function () { src = await psReadLayerRgb(srcId, rect); }, { commandName: "KBImage — read for piping" });
      step = "reading KBPS hands";
      let sm = null;
      if (kbChannelExists(PS_HANDS_CH)) sm = KBPiping.skinMask(src, g.alpha, await psReadMaskAlpha(rect, PS_HANDS_CH), rw, rh);
      params.hands = !!sm;
      if (params.auto) {
        step = "picking Colored or Neutral";
        setStatus("busy", "Looking at the thin lines in " + params.source + "…");
        const pick = KBPiping.autoPick(src, g.alpha, rw, rh, sm, PS_TRIM_TOL);
        params.mode = pick.mode; params.tolPct = psTrimTol[pick.mode];
        params.pick = { coloredPx: pick.coloredPx, neutralPx: pick.neutralPx, need: pick.need };
        psSetPipingMode(pick.mode);
        psPipingModeNote("Auto: " + (pick.mode === "neutral" ? "Neutral (the thin lines in " + params.source + " are white, gray or black)" : "Colored (" + pick.coloredPx.toLocaleString("en-US") + " px of colored thin lines in " + params.source + ")") + ". Click the other to change.");
        trace("ps piping auto: " + JSON.stringify(pick));
      }
      step = "finding the piping";
      setStatus("busy", "Finding " + params.mode + " piping in " + params.source + "…");
      let plane;
      if (params.mode === "neutral") {
        // KBPS hands and the buttons Find buttons found stay out; then lines of one direction only.
        let buttons = null, person = null;
        if (kbChannelExists(PS_BUTTONS_CH)) { step = "reading KBPS buttons"; buttons = await psReadMaskAlpha(rect, PS_BUTTONS_CH); }
        params.buttonsOut = !!buttons;
        if (kbChannelExists(PS_PERSON_CH)) { step = "reading KBPS person"; person = await psReadMaskAlpha(rect, PS_PERSON_CH); }
        step = "finding the piping";
        setStatus("busy", "Neutral: looking for " + (params.dir === "auto" ? "light and dark" : params.dir) + " lines in " + params.source + "…");
        const nr = KBPiping.neutralFind(src, g.alpha, rw, rh, Math.max(g.docW, g.docH), params.tolPct, params.dir, sm, buttons, person, { ring: params.ringPx, minLen: params.minLenPx });
        params.sizes = nr.sizes; params.rescued = nr.rescued;
        plane = nr.plane;
        params.dirPicked = nr.dir; params.dirBy = params.dir === "auto" ? "auto" : "you";
        params.linesKept = nr.kept; params.linesDropped = nr.dropped; params.dropWhy = nr.why; params.dirScore = nr.score;
        psPipingDirShow(nr.dir, params.dirBy);
        trace("ps piping neutral: " + JSON.stringify({ dir: nr.dir, by: params.dirBy, kept: nr.kept, dropped: nr.dropped, why: nr.why, score: nr.score, sizes: nr.sizes, buttonsOut: params.buttonsOut }));
      } else {
        plane = KBPiping.plane(src, g.alpha, rw, rh, params.mode, params.tolPct);
      }
      const drop = KBPiping.dropSkin(plane, sm);
      params.skinPx = drop.handsPx + drop.skinPx;
      let n = 0; for (let k = 0; k < plane.length; k++) if (plane[k]) n++;
      params.pixels = n;
      trace("ps piping: " + params.mode + " tol " + params.tolPct + "% on " + params.source + " (" + srcId + "), box " + JSON.stringify(rect) + ", " + n + " px"
        + (sm ? ", skin left out " + drop.handsPx + " (hands) + " + drop.skinPx + " (skin color" + (drop.skinColorSkipped ? ": skipped, the piping is skin-colored" : "") + ")" : ", no KBPS hands"));
      if (!n) throw new Error("nothing matched at " + params.tolPct + "%. Lower the tolerance, try the other piping option, or select it by hand and use + Add.");
      step = "saving KBPS piping";
      await psRectPlaneToChannel(plane, rw, rh, rect, PS_PIPING_CH);
      await psSoftenAfterSave([PS_PIPING_CH], "piping", "piping");                     // edge softness
      await psShowChannel(PS_PIPING_CH);
      return { layerIds: [], afterSnapshotRef: null, state: { ch: PS_PIPING_CH } };
    } catch (err) {
      const e2 = new Error("Find piping failed while " + step + ": " + ((err && err.message) || String(err)));
      e2.cause = err;
      throw e2;
    }
  }
  function psPipingParams() {
    const m = psPipingMode(), f = psNeuFields();
    return { mode: m, tolPct: psTrimTol[m], auto: psPipingModeBy === "auto", dir: psPipingDirBy !== "auto" ? psPipingDir() : "auto", ringPx: f.ring, minLenPx: f.minLen };
  }
  // Step 4 Settings: Edge ring (px) and Min line length (px) for Neutral piping, filled with
  // the auto values for this image until the retoucher types one (then theirs, until the
  // document changes). Read on every Find piping and Re-run.
  let psNeuBy = { ring: "auto", minLen: "auto" };
  function psNeuDocLong() { try { const d = psMod().app.activeDocument; if (d) return Math.max(Math.round(d.width), Math.round(d.height)); } catch (_) {} return 4000; }
  function psNeuFieldsFill(reset) {
    if (reset) psNeuBy = { ring: "auto", minLen: "auto" };
    const au = KBPiping.neuAuto(psNeuDocLong());
    [["ps-piping-ring", "ring"], ["ps-piping-minlen", "minLen"]].forEach(function (x) {
      const el = $(x[0]);
      if (!el) return;
      if (!el.__kbWired) { el.__kbWired = true; el.addEventListener("input", function () { psNeuBy[x[1]] = String(el.value).trim() === "" ? "auto" : "you"; }); }
      if (psNeuBy[x[1]] === "auto" && document.activeElement !== el) el.value = String(au[x[1]]);
    });
  }
  // Tuned values travel with the file: after each Find piping, the mode, Light / Dark, both
  // tolerances, Edge ring and Min line length it used are saved in the document's state, and
  // come back when the document opens (a reload, another document and back) as the file's own
  // values instead of being guessed again. Redo keeps them; Start over clears them with the
  // rest of the state.
  async function psPipingStateSave(p) {
    try {
      const st = await psStateLoad();
      st.piping = { mode: p.mode, tol: { colored: psTrimTol.colored, neutral: psTrimTol.neutral },
        dir: p.mode === "neutral" && p.dirPicked ? p.dirPicked : (st.piping && st.piping.dir) || null,
        ring: p.sizes ? p.sizes.ring : p.ringPx, minLen: p.sizes ? p.sizes.minLen : p.minLenPx };
      await psStateSave(st);
      trace("ps piping: settings saved with the document " + JSON.stringify(st.piping));
    } catch (e) { traceErr("ps piping: save settings", e); }
  }
  function psPipingStateApply(pp) {
    if (!pp) return;
    if (pp.tol) { if (pp.tol.colored > 0) psTrimTol.colored = pp.tol.colored; if (pp.tol.neutral > 0) psTrimTol.neutral = pp.tol.neutral; }
    if (pp.mode === "neutral" || pp.mode === "colored") {
      psPipingModeBy = "doc"; psSetPipingMode(pp.mode);
      psPipingModeNote("Saved with this file: " + (pp.mode === "neutral" ? "Neutral" : "Colored") + ". Click the other to change.");
    }
    if (pp.dir === "light" || pp.dir === "dark") { psPipingDirBy = "doc"; psPipingDirShow(pp.dir, "doc"); }
    const set = function (id, key, v) { const el = $(id); if (el && v != null && isFinite(v)) { el.value = String(Math.round(v)); psNeuBy[key] = "doc"; } };
    set("ps-piping-ring", "ring", pp.ring);
    set("ps-piping-minlen", "minLen", pp.minLen);
    try { psTrimTolSync(); } catch (_) {}
    trace("ps piping: settings from the document " + JSON.stringify(pp));
  }
  function psNeuFields() {
    psNeuFieldsFill(false);
    const au = KBPiping.neuAuto(psNeuDocLong());
    return { ring: Math.round(kbNum("ps-piping-ring", au.ring, 0, 200)), minLen: Math.round(kbNum("ps-piping-minlen", au.minLen, 5, 5000)) };
  }
  async function actPsFindPiping() {
    if (generateInFlight) { kbBusyNote(); return; }
    const ps = psMod();
    if (!ps.app.activeDocument) { setStatus("bad", "Open a Photoshop document first."); return; }
    if (!kbChannelExists(PS_GARMENT_CH)) { setStatus("bad", "Find the garment first (step 2)."); return; }
    if (psOtherPending("printswap:piping")) { setStatus("bad", "Accept or Re-run the preview that is waiting first."); return; }
    const p = psPipingParams();
    generateInFlight = true;
    traceStart("Print Swap — Find piping (" + (p.auto ? "auto" : p.mode + ", " + p.tolPct + "%") + ")");
    try {
      await psRecall(4, "ps-recall-anchor-4p", { op: "printswap:piping", params: p, previewChannels: psTrimPreviewCh, targetLayerId: null, sourceRef: "garment:" + PS_GARMENT_CH,
        paramsProvider: psPipingParams, execute: executePsPiping, onSettle: psTrimOnSettle("piping") });
      await psPipingStateSave(p);                          // the values this run used travel with the file
      setStatus("ok", (p.mode === "neutral"
          ? "Neutral: " + p.dirPicked + " lines" + (p.dirBy === "auto" ? " (auto)" : "") + ". Kept " + p.linesKept + " line piece" + (p.linesKept === 1 ? "" : "s") + ", dropped " + Number(p.linesDropped).toLocaleString("en-US")
            + " (short " + p.dropWhy.short + ", hairline " + p.dropWhy.hairline + ", wide " + p.dropWhy.wide + ", soft " + p.dropWhy.soft + ", faint " + p.dropWhy.faint + ")." + (p.auto ? " Neutral picked automatically." : "") + " " + p.pixels + " px in " + p.source + " selected as KBPS piping."
            + (p.buttonsOut ? " Buttons left out." : "")
            + (p.sizes ? " Edge ring " + p.sizes.ring + " px (" + (p.sizes.person ? "against the background only" : "every edge: no KBPS person") + "), min line " + p.sizes.minLen + " px (collar " + p.sizes.collarLen + " px)"
              + (p.rescued ? ", " + p.rescued + " edge line" + (p.rescued === 1 ? "" : "s") + " kept" : "") + "." : "")
          : "Colored piping" + (p.auto ? " (picked automatically)" : "") + " found in " + p.source + " (" + p.pixels + " px) and selected as KBPS piping.")
        + (p.hands ? " " + p.skinPx + " px of skin left out." : " No KBPS hands: run Find garment again to keep skin out.") + " Check the collar, placket, pocket, cuffs and hems at 100%. Fix with + / −, or change the tolerance and Re-run. Accept builds the PIPING group.");
    } catch (err) {
      traceErr("ps piping", err && err.cause ? err.cause : err);
      setStatus("bad", (err && err.message) || "Find piping failed.");
    } finally {
      generateInFlight = false;
      await traceFlush();
    }
  }

  // Save piping test case (step 4 Adjust): what Find piping reads on this document, so a
  // change to piping detection can be checked against real garments offline
  // (tests/piping_cases_test.js). Writes raw files to the plug-in data folder, nothing else:
  //   printswap-case-<name>-src.rgb   CLEAN (else the photo) over the garment box, RGB
  //   ...-valid.l / -garment.l / -person.l / -hands.l / -buttons.l   one byte a pixel
  //   ...-piping.l   KBPS piping as it is now: the EXPECTED result (save once it is right)
  //   ...-meta.json  sizes, the box, the image's long edge, the settings
  async function psWriteDataFile(name, data) {
    const folder = await fsLocal().getDataFolder();
    const f = await folder.createFile(name, { overwrite: true });
    if (typeof data === "string") await f.write(data, { format: fmts().utf8 });
    else await f.write(data.byteOffset === 0 && data.byteLength === data.buffer.byteLength ? data.buffer : data.slice().buffer, { format: fmts().binary });
    return name;
  }
  async function actPsSavePipingCase() {
    if (generateInFlight) { kbBusyNote(); return; }
    const ps = psMod(), doc = ps.app.activeDocument;
    if (!doc) { setStatus("bad", "Open a Photoshop document first."); return; }
    if (!kbChannelExists(PS_GARMENT_CH)) { setStatus("bad", "Find the garment first (step 2)."); return; }
    generateInFlight = true;
    try {
      setStatus("busy", "Saving the piping test case…");
      const g = await psGarmentBox(0.01);
      const rect = g.rect, rw = rect.right - rect.left, rh = rect.bottom - rect.top;
      const cleanId = psAcceptedCleanId(), srcId = cleanId != null ? cleanId : psOriginalPhotoId();
      if (srcId == null) throw new Error("no photo layer found.");
      let src = null;
      await ps.core.executeAsModal(async function () { src = await psReadLayerRgb(srcId, rect); }, { commandName: "KBImage — read for the test case" });
      const name = "printswap-case-" + String(doc.title || "doc").replace(/\.[^.]*$/, "").replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 40);
      const files = [];
      files.push(await psWriteDataFile(name + "-src.rgb", src.rgb));
      files.push(await psWriteDataFile(name + "-valid.l", src.valid));
      files.push(await psWriteDataFile(name + "-garment.l", g.alpha));
      const chans = { person: PS_PERSON_CH, hands: PS_HANDS_CH, buttons: PS_BUTTONS_CH, piping: PS_PIPING_CH }, has = {};
      for (const k in chans) {
        has[k] = kbChannelExists(chans[k]);
        if (has[k]) files.push(await psWriteDataFile(name + "-" + k + ".l", await psReadMaskAlpha(rect, chans[k])));
      }
      const f = psNeuFields();
      const meta = { title: doc.title, source: cleanId != null ? "CLEAN" : "photo", w: rw, h: rh, rect: rect, docW: g.docW, docH: g.docH,
        has: has, mode: psPipingMode(), modeBy: psPipingModeBy, tolPct: psTrimTol[psPipingMode()], dir: psPipingDirBy !== "auto" ? psPipingDir() : "auto", ringPx: f.ring, minLenPx: f.minLen, savedAt: new Date().toISOString() };
      files.push(await psWriteDataFile(name + "-meta.json", JSON.stringify(meta, null, 1)));
      trace("ps piping case: " + files.join(", "));
      setStatus(has.piping ? "ok" : "bad", "Saved the piping test case " + name + " (" + files.length + " files, " + rw + " × " + rh + ") in the plug-in data folder."
        + (has.piping ? " KBPS piping is saved as the expected result, so save it once the piping is right." : " There is no KBPS piping yet: select the piping (Find piping, + / −), then save again."));
    } catch (err) {
      traceErr("ps piping case", err);
      setStatus("bad", "Could not save the test case: " + ((err && err.message) || String(err)));
    } finally {
      generateInFlight = false;
      await traceFlush();
    }
  }

  // ----- FIND BUTTONS ------------------------------------------------------------
  async function executePsButtons(params) {
    const ps = psMod();
    const doc = ps.app.activeDocument;
    if (!doc) throw new Error("Open a Photoshop document first.");
    return kbKeepView(async function () { return executePsButtonsRun(params); });   // the view stays as it is
  }
  async function executePsButtonsRun(params) {
    let step = "reading the garment";
    try {
      setStatus("busy", "Reading the garment…");
      const g = await psGarmentBox(0.04);
      const rect = g.rect, rw = rect.right - rect.left, rh = rect.bottom - rect.top;
      // SAM reads CLEAN (or the photo) straight from the layer: nothing hidden or shown.
      const src = kbSamLayerSource(psOriginalPhotoId(), g.alpha, rect);
      params.source = src.label;
      // close-ups of the upper garment (placket / yoke) — buttons are small.
      step = "asking SAM 3.1 for buttons";
      const zr = await psSamZoomPieces("button", psTrimZoomRegion(rect, "upper"), g, src);
      const srec = logRecordSkeleton("printswap:buttons-sam", { model: PS_SAM_PATH, calls: zr.calls, masks: zr.masks, pieces: zr.pieces.length, estCostUsd: zr.calls * SAM_COST_USD }, null, "composite");
      srec.routedVia = "fal";
      await logRun(srec);
      await logFinalizeCommitted(srec.id);
      params.costUsd = zr.calls * SAM_COST_USD; params.calls = zr.calls;
      const inst = zr.pieces;
      if (!inst.length) { params.found = 0; trace("ps buttons: SAM found none"); return { layerIds: [], afterSnapshotRef: null, state: {} }; }
      step = "fitting the buttons";
      setStatus("busy", "Fitting the buttons to their edges…");
      const fitted = await psFitButtons(inst, rw, rh, rect, g.alpha);    // Button fit setting
      const plane = fitted.plane; let n = 0;
      for (let k = 0; k < plane.length; k++) { if (g.alpha[k] <= 127) plane[k] = 0; if (plane[k]) n++; }
      params.found = inst.length; params.pixels = n; params.fit = fitted.fit; params.refit = fitted.refit;
      trace("ps buttons: " + inst.length + " button(s), " + n + " px inside the garment");
      if (!n) { params.found = 0; return { layerIds: [], afterSnapshotRef: null, state: {} }; }
      step = "saving KBPS buttons";
      await psRectPlaneToChannel(plane, rw, rh, rect, PS_BUTTONS_CH);
      await psSoftenAfterSave([PS_BUTTONS_CH], "buttons", "buttons");                   // edge softness
      step = "saving the button thread marks";
      for (let k = 0; k < fitted.thread.length; k++) if (g.alpha[k] <= 127) fitted.thread[k] = 0;
      if (fitted.threadPx) await psRectPlaneToChannel(fitted.thread, rw, rh, rect, PS_THREAD_CH);
      else await psMod().core.executeAsModal(async function () { await kbRemoveChannels(PS_THREAD_CH); }, { commandName: "KBImage — no thread marks" });
      params.threadPx = fitted.threadPx;
      await psShowChannel(PS_BUTTONS_CH);
      return { layerIds: [], afterSnapshotRef: null, state: { ch: PS_BUTTONS_CH } };
    } catch (err) {
      const e2 = new Error("Find buttons failed while " + step + ": " + ((err && err.message) || String(err)));
      e2.cause = err;
      throw e2;
    }
  }
  async function actPsFindButtons() {
    if (generateInFlight) { kbBusyNote(); return; }
    const ps = psMod();
    const doc = ps.app.activeDocument;
    if (!doc) { setStatus("bad", "Open a Photoshop document first."); return; }
    const problem = kbDocProblem(doc);
    if (problem) { setStatus("bad", problem); return; }
    if (!cachedFalKey) { setStatus("bad", "Add your Fal API key in Settings (gear icon) to find buttons, or select them by hand and use + Add."); return; }
    if (!kbChannelExists(PS_GARMENT_CH)) { setStatus("bad", "Find the garment first (step 2)."); return; }
    if (psOtherPending("printswap:buttons")) { setStatus("bad", "Accept or Re-run the preview that is waiting first."); return; }
    const p = { model: PS_SAM_PATH, prompt: "button" };
    generateInFlight = true;
    traceStart("Print Swap — Find buttons (" + PS_SAM_PATH + ")");
    try {
      await psRecall(4, "ps-recall-anchor-4b", { op: "printswap:buttons", params: p, previewChannels: psTrimPreviewCh, targetLayerId: null, sourceRef: "garment:" + PS_GARMENT_CH,
        paramsProvider: function () { return { model: PS_SAM_PATH, prompt: "button" }; }, execute: executePsButtons, onSettle: psTrimOnSettle("buttons") });
      setStatus(p.found ? "ok" : "bad", p.found
        ? "SAM found " + p.found + " button(s) on " + (p.calls || 0) + " close-up(s) ($" + (p.costUsd || 0).toFixed(3) + "), selected as KBPS buttons. Fix with + / −. Accept builds the BUTTON group."
        : "SAM found no buttons. Select them by hand (Lasso or Elliptical Marquee) and use + Add under Find buttons.");
    } catch (err) {
      traceErr("ps buttons", err && err.cause ? err.cause : err);
      setStatus("bad", (err && err.message) || "Find buttons failed.");
    } finally {
      generateInFlight = false;
      await traceFlush();
    }
  }

  // Find a SAM trim (LACE, RUFFLE LACE, DRAWCORD, BOW, ZIPPER): close-ups
  // → channel "KBPS <trim>", shown as the selection. Accept builds the group.
  async function executePsSamTrim(params) {
    return kbKeepView(async function () { return executePsSamTrimRun(params); });   // the view stays as it is
  }
  async function executePsSamTrimRun(params) {
    const K = PS_TRIM_KINDS[params.kind];
    let step = "reading the garment";
    try {
      setStatus("busy", "Reading the garment…");
      const g = await psGarmentBox(0.04);
      const rect = g.rect, rw = rect.right - rect.left, rh = rect.bottom - rect.top;
      const src = kbSamLayerSource(psOriginalPhotoId(), g.alpha, rect);   // by id: nothing hidden or shown
      params.source = src.label;
      step = "asking SAM 3.1 for " + K.sam;
      const zr = await psSamZoomPieces(K.sam, psTrimZoomRegion(rect, K.zoom), g, src);
      const srec = logRecordSkeleton("printswap:" + params.kind + "-sam", { model: PS_SAM_PATH, prompt: K.sam, calls: zr.calls, masks: zr.masks, pieces: zr.pieces.length,
        estCostUsd: zr.calls * SAM_COST_USD }, null, "composite");
      srec.routedVia = "fal";
      await logRun(srec);
      await logFinalizeCommitted(srec.id);
      params.costUsd = zr.calls * SAM_COST_USD; params.calls = zr.calls; params.found = zr.pieces.length;
      const plane = new Uint8Array(rw * rh); let n = 0;
      for (let i = 0; i < zr.pieces.length; i++) { const b = zr.pieces[i]; for (let k = 0; k < b.length; k++) if (b[k] && !plane[k]) { plane[k] = 255; n++; } }
      params.pixels = n;
      if (!n) { params.found = 0; return { layerIds: [], afterSnapshotRef: null, state: {} }; }
      step = "saving " + K.ch;
      await psRectPlaneToChannel(plane, rw, rh, rect, K.ch);
      await psSoftenAfterSave([K.ch], params.kind, params.kind);
      await psShowChannel(K.ch);
      return { layerIds: [], afterSnapshotRef: null, state: { ch: K.ch } };
    } catch (err) {
      const e2 = new Error("Find " + K.group.toLowerCase() + " failed while " + step + ": " + ((err && err.message) || String(err)));
      e2.cause = err;
      throw e2;
    }
  }
  async function actPsFindSamTrim(srcEl) {
    if (generateInFlight) { kbBusyNote(); return; }
    const kind = srcEl && srcEl.getAttribute && srcEl.getAttribute("data-trim");
    if (!psIsSamTrim(kind)) return;
    const K = PS_TRIM_KINDS[kind], word = K.group.toLowerCase();
    const ps = psMod();
    const doc = ps.app.activeDocument;
    if (!doc) { setStatus("bad", "Open a Photoshop document first."); return; }
    const problem = kbDocProblem(doc);
    if (problem) { setStatus("bad", problem); return; }
    if (!cachedFalKey) { setStatus("bad", "Add your Fal API key in Settings (gear icon) to find the " + word + ", or select it by hand and use + Add."); return; }
    if (!kbChannelExists(PS_GARMENT_CH)) { setStatus("bad", "Find the garment first (step 2)."); return; }
    if (psOtherPending(psTrimOp(kind))) { setStatus("bad", "Accept or Re-run the preview that is waiting first."); return; }
    const p = { model: PS_SAM_PATH, prompt: K.sam, kind: kind };
    generateInFlight = true;
    traceStart("Print Swap — Find " + word + " (" + PS_SAM_PATH + ")");
    try {
      await psRecall(4, psTrimAnchor(kind), { op: psTrimOp(kind), params: p, previewChannels: psTrimPreviewCh, targetLayerId: null, sourceRef: "garment:" + PS_GARMENT_CH,
        paramsProvider: function () { return { model: PS_SAM_PATH, prompt: K.sam, kind: kind }; }, execute: executePsSamTrim, onSettle: psTrimOnSettle(kind) });
      setStatus(p.found ? "ok" : "bad", p.found
        ? "SAM found the " + word + " (" + p.found + " piece(s), " + p.pixels + " px) on " + p.calls + " close-up(s), $" + (p.costUsd || 0).toFixed(3) + ". It is selected as " + K.ch + ". Fix with + / −. Accept builds the " + K.group + " group."
        : "SAM found no " + word + ". Select it by hand and use + Add under Find " + word + ".");
    } catch (err) {
      traceErr("ps " + kind, err && err.cause ? err.cause : err);
      setStatus("bad", (err && err.message) || ("Find " + word + " failed."));
    } finally {
      generateInFlight = false;
      await traceFlush();
    }
  }

  // ----- TOUCH UP — + / − the current selection to / from piping or buttons -------
  async function actPsEditTrim(srcEl) {
    if (generateInFlight) { kbBusyNote(); return; }
    const ps = psMod();
    if (!ps.app.activeDocument) { setStatus("bad", "Open a Photoshop document first."); return; }
    const dt = srcEl && srcEl.getAttribute && srcEl.getAttribute("data-trim");
    const which = PS_TRIM_KINDS[dt] ? dt : "piping";
    const ch = PS_TRIM_KINDS[which].ch;
    const mode = (srcEl && srcEl.getAttribute && srcEl.getAttribute("data-mode")) === "subtract" ? "subtract" : "add";
    if (!kbSelectionBounds()) { setStatus("bad", "Select the bit to " + (mode === "add" ? "add to" : "remove from") + " the " + which + " first (Lasso or any selection tool)."); return; }
    const had = kbChannelExists(ch);
    if (!had && mode === "subtract") { setStatus("bad", "There are no " + which + " yet."); return; }
    generateInFlight = true;
    traceStart("Print Swap — " + (mode === "add" ? "add to " : "remove from ") + which);
    try {
      const softPx = psEdgeSoft(which);
      await ps.core.executeAsModal(async function () {
        await kbRemoveChannels(PS_TRIM_TMP);
        await saveSelectionToChannel(PS_TRIM_TMP);
        if (had) await psUnsoftenInModal(ch);                                 // edit the hard version
        try {
          if (mode === "add") {
            await kbLoadChannel(PS_TRIM_TMP);
            if (kbChannelExists(PS_GARMENT_CH)) await kbLoadChannel(PS_GARMENT_CH, "intersect");
            if (!kbSelectionBounds()) throw new Error("the selection is outside the garment.");
            if (had) await kbLoadChannel(ch, "add");
          } else {
            await kbLoadChannel(ch);
            await kbLoadChannel(PS_TRIM_TMP, "subtract");
          }
          await kbRemoveChannels(ch);
          if (kbSelectionBounds()) await saveSelectionToChannel(ch);
        } finally { await kbRemoveChannels(PS_TRIM_TMP); }
        await psSoftenAfterSaveInModal(ch, softPx);                           // soften again
        if (kbChannelExists(ch)) await kbLoadChannel(ch); else { try { await deselectAll(); } catch (_) {} }
      }, { commandName: "KBImage — edit " + which });
      const rec = logRecordSkeleton("printswap:edit-" + which, { mode: mode, first: !had }, null, "selection");
      await logRun(rec);
      await logFinalizeCommitted(rec.id);
      generateInFlight = false;
      const after = kbChannelExists(ch) ? await psTrimAfterEdit(which) : null;
      setStatus(after && !after.ok ? "bad" : "ok", (mode === "add" ? "Added to" : "Removed from") + " the " + which + ". "
        + (kbChannelExists(ch) ? "They are selected." : "None left.") + (after ? " " + after.msg : ""));
    } catch (err) {
      traceErr("ps edit " + which, err);
      setStatus("bad", "Could not " + (mode === "add" ? "add to" : "remove from") + " the " + which + ": " + ((err && err.message) || String(err)));
    } finally {
      generateInFlight = false;
      await traceFlush();
    }
  }

  // ----- BUILD TRIMS -------------------------------------------------------------
  // Inside executeAsModal: make an adjustment / fill layer above the ACTIVE layer
  // (no selection → no mask), clip it to the layer below. Photoshop's exact error on failure.
  async function psMakeClippedInModal(name, makeDesc) {
    const ps = psMod();
    try { await deselectAll(); } catch (_) {}
    try { await ps.action.batchPlay([makeDesc], { synchronousExecution: true }); }
    catch (e) { throw new Error("Making " + name + " failed — Photoshop said: " + ((e && e.message) || String(e))); }
    const id = kbActiveLayerId();
    try { await renameActiveLayer(name); } catch (_) {}
    await kbSelectLayerById(id);
    // a layer made inside a clipping stack is clipped already ("Create Clipping Mask" would not apply)
    let clipped = false; try { const l = kbLayerById(id); clipped = !!(l && l.isClippingMask); } catch (_) {}
    if (!clipped) await psClipActiveInModal();
    return id;
  }

  // Inside executeAsModal: make layer `id` the active one, or throw.
  async function psSelectLayerVerifiedInModal(id, what) {
    await kbSelectLayerById(id);
    if (kbActiveLayerId() !== id) throw new Error("could not select " + what + " (layer " + id + "); the active layer is " + kbActiveLayerId() + ".");
  }
  // Does layer `id` have a layer (pixel) mask? null when Photoshop will not say.
  async function psLayerHasMask(id) {
    try {
      const r = await psMod().action.batchPlay([{ _obj: "get", _target: [{ _property: "hasUserMask" }, { _ref: "layer", _id: id }],
        _options: { dialogOptions: "dontDisplay" } }], { synchronousExecution: true });
      return (r && r[0] && typeof r[0].hasUserMask === "boolean") ? r[0].hasUserMask : null;
    } catch (_) { return null; }
  }
  // Inside executeAsModal: the loaded selection contracted by px (0 = as is). Throws Photoshop's exact error.
  async function psShrinkSelectionInModal(px) {
    if (!(px > 0)) return;
    try {
      await psMod().action.batchPlay([{ _obj: "contract", by: { _unit: "pixelsUnit", _value: px }, selectionModifyEffectAtCanvasBounds: false,
        _options: { dialogOptions: "dontDisplay" } }], { synchronousExecution: true });
    } catch (e) { throw new Error("Shrinking the selection by " + px + " px failed — Photoshop said: " + ((e && e.message) || String(e))); }
  }
  async function psMaskLayerToChannelInModal(id, ch, what, shrinkPx, minusChs) {
    const ps = psMod();
    await psSelectLayerVerifiedInModal(id, what);
    await kbDeleteMaskInModal(id, false, what);         // a mask copied from the photo: dropped (not applied)
    try { await selectRGBChannel(); } catch (_) {}
    await kbLoadChannel(ch);
    if (!kbSelectionBounds()) throw new Error(ch + " is empty.");
    await psShrinkSelectionInModal(shrinkPx);
    for (let i = 0; minusChs && i < minusChs.length; i++) if (kbChannelExists(minusChs[i])) await kbLoadChannel(minusChs[i], "subtract");
    if (!kbSelectionBounds()) throw new Error(ch + " is empty after shrinking the mask by " + shrinkPx + " px. Use a smaller Shrink mask.");
    await psSelectLayerVerifiedInModal(id, what);
    let err1 = null;
    try { await addLayerMaskRevealSelection(); } catch (e) { err1 = e; }
    try { await deselectAll(); } catch (_) {}
    try { await selectRGBChannel(); } catch (_) {}
    let has = await psLayerHasMask(id);
    trace("ps trims: " + what + " mask from " + ch + " via reveal-selection → " + (has === null ? "unknown" : has) + (err1 ? " (error: " + ((err1 && err1.message) || err1) + ")" : ""));
    if (has === false || err1) {
      let err2 = null;
      try {
        await kbDeleteMaskInModal(id, false, what);
        await psSelectLayerVerifiedInModal(id, what);
        await addLayerMaskHideAll();                    // the mask is now the target channel
        await kbLoadChannel(ch);
        await psShrinkSelectionInModal(shrinkPx);
        for (let i = 0; minusChs && i < minusChs.length; i++) if (kbChannelExists(minusChs[i])) await kbLoadChannel(minusChs[i], "subtract");
        await fillSelectionWithWhite();
        try { await deselectAll(); } catch (_) {}
        try { await selectRGBChannel(); } catch (_) {}
      } catch (e) { err2 = e; }
      has = await psLayerHasMask(id);
      trace("ps trims: " + what + " mask via hide-all + fill → " + has + (err2 ? " (error: " + ((err2 && err2.message) || err2) + ")" : ""));
      if (!has) throw new Error("Photoshop did not add the " + what + " mask from " + ch + ". Reveal-selection said: "
        + ((err1 && err1.message) || (err1 ? String(err1) : "no error, but no mask")) + ". Hide-all + fill said: " + ((err2 && err2.message) || (err2 ? String(err2) : "no error, but no mask")) + ".");
    }
  }

  // ----- TRIM GROUPS — built when Find piping / Find buttons is ACCEPTED ----------
  // At the TOP of the Print Swap stack, above GREY copy 3 (the veil); BUTTON above
  // PIPING. No pixels are cut out:
  //   PIPING = a copy of CLEAN, limited to the piping by Blend If (This Layer) on
  //            the RGB channel that best separates the found piping from the gray
  //            fabric, split sliders for a soft edge. KBPS piping only picks the
  //            channel and the values. Fine-tune in Layer Style.
  //   BUTTON = a copy of CLEAN masked to KBPS buttons (white buttons cannot be
  //            told from light gray fabric by Blend If).
  //   Each has Color Fill 1 (Color mode) clipped above it, hidden until a color
  //   is chosen, so the trim keeps its own color by default. A chosen color adds
  //   Trim lightness (Levels) under it: see "TRIM RECOLOR".
  //   The trims sit above the GREY group and above GREY copy 3 (the veil never covers them).
  const PS_TRIM_KINDS = {
    piping:  { group: PS_PIPING_GRP, ch: PS_PIPING_CH,  adj: "Color Fill 1", hex: null },
    buttons: { group: PS_BUTTON_GRP, ch: PS_BUTTONS_CH, adj: "Color Fill 1", hex: null },
    // the garment types' other Protected trims. Found by SAM on close-ups;
    // built like PIPING: a copy of CLEAN masked to the trim, Blend If keeps its own
    // white and texture (mask only when Blend If cannot separate it). Color Fill off.
    "lace":        { group: "LACE",        ch: "KBPS lace",        adj: "Color Fill 1", hex: null, sam: "lace trim",       zoom: "upper" },
    "ruffle-lace": { group: "RUFFLE LACE", ch: "KBPS ruffle lace", adj: "Color Fill 1", hex: null, sam: "white lace trim", zoom: "all" },
    "drawcord":    { group: "DRAWCORD",    ch: "KBPS drawcord",    adj: "Color Fill 1", hex: null, sam: "drawstring cord", zoom: "all" },
    "bow":         { group: "BOW",         ch: "KBPS bow",         adj: "Color Fill 1", hex: null, sam: "bow",             zoom: "upper" },
    "zipper":      { group: "ZIPPER",      ch: "KBPS zipper",      adj: "Color Fill 1", hex: null, sam: "zipper",          zoom: "all" },
  };
  // A type's trim names (docs/parts-list.md "Protected") → trim kinds.
  const PS_TRIM_KIND_OF = { "PIPING": "piping", "BUTTONS": "buttons", "LACE": "lace", "RUFFLE LACE": "ruffle-lace", "DRAWCORD": "drawcord", "BOW": "bow", "ZIPPER": "zipper" };
  function psTrimPreviewCh(state) { return state && state.ch ? [state.ch] : []; }   // a trim preview is its channel
  function psIsSamTrim(kind) { return !!(PS_TRIM_KINDS[kind] && PS_TRIM_KINDS[kind].sam); }
  function psTrimAnchor(kind) { return kind === "piping" ? "ps-recall-anchor-4p" : (kind === "buttons" ? "ps-recall-anchor-4b" : "ps-recall-anchor-4-" + kind); }
  function psTrimOp(kind) { return kind === "piping" ? "printswap:piping" : (kind === "buttons" ? "printswap:buttons" : "printswap:trim-" + kind); }
  // The trim kinds step 4 shows: the picked type's, else piping + buttons.
  function psTypeTrimKinds() {
    const t = psGtypeById(psGarmentType);
    return t ? t.trims.map(function (n) { return PS_TRIM_KIND_OF[n]; }).filter(Boolean) : ["piping", "buttons"];
  }
  // Step 4 panel: only the type's trims.
  function psTrimsRender() {
    const kinds = psTypeTrimKinds(), t = psGtypeById(psGarmentType);
    const fr = $("ps-trims-for");
    if (fr) fr.textContent = t ? t.short + ": " + t.trims.join(", ") + " (kept on top, never printed)." : "Pick the garment type in step 2 to see its trims (piping and buttons until then).";
    const bp = $("ps-trim-block-piping"), bb = $("ps-trim-block-buttons");
    if (bp) bp.classList.toggle("hidden", kinds.indexOf("piping") < 0);
    if (bb) bb.classList.toggle("hidden", kinds.indexOf("buttons") < 0);
    const box = $("ps-trim-blocks-sam");
    if (!box) return;
    const bar = $("ps-recall-bar");                     // keep the shared Accept bar out of blocks being rebuilt
    if (bar && box.contains(bar)) { const safe = $("ps-recall-anchor-4b"); if (safe) safe.appendChild(bar); }
    while (box.firstChild) box.removeChild(box.firstChild);
    kinds.filter(psIsSamTrim).forEach(function (kind) {
      const K = PS_TRIM_KINDS[kind], word = K.group.toLowerCase();
      const wrap = document.createElement("div"); wrap.className = "ps-trim-sam ps-trim-block";
      const b = document.createElement("div"); b.className = "btn-primary"; b.setAttribute("role", "button"); b.setAttribute("tabindex", "0");
      b.setAttribute("data-action", "ps-find-trim"); b.setAttribute("data-trim", kind); b.textContent = "Find " + word;
      const c = document.createElement("div"); c.className = "ps-cost"; c.textContent = "SAM 3.1 close-ups · up to $" + (KB_ZOOM_TILES * SAM_COST_USD).toFixed(3);
      const a = document.createElement("div"); a.id = psTrimAnchor(kind); a.className = "ps-recall-anchor";
      const links = document.createElement("div"); links.className = "btn-row";
      [["add", "+ Add"], ["subtract", "- Remove"]].forEach(function (m) {
        const l = document.createElement("div"); l.className = "btn-secondary btn-small"; l.setAttribute("role", "button"); l.setAttribute("tabindex", "0");
        l.setAttribute("data-action", "ps-edit-trim"); l.setAttribute("data-trim", kind); l.setAttribute("data-mode", m[0]); l.textContent = m[1];
        links.appendChild(l);
      });
      const main = document.createElement("div"); main.className = "ps-main";
      main.appendChild(b); main.appendChild(c);
      wrap.appendChild(links); wrap.appendChild(main); wrap.appendChild(a);
      box.appendChild(wrap);
    });
    const bc = $("ps-buttons-cost"); if (bc) bc.textContent = "SAM 3.1 close-ups · up to $" + (KB_ZOOM_TILES * SAM_COST_USD).toFixed(3);
    try { psTrimColorRender(); } catch (_) {}
  }

  // SAM on close-up tiles of `region` (doc px) → separate pieces on the garment box
  // grid (g from psGarmentBox), the same piece seen in two overlapping tiles merged.
  function psPasteCropToRect(dst, rw, rh, rect, crop, cw, ch, tile) {
    const tw = Math.max(1, Math.round(tile.right - tile.left)), th = Math.max(1, Math.round(tile.bottom - tile.top));
    const r = kbResamplePlane(crop, cw, ch, tw, th);
    for (let y = 0; y < th; y++) {
      const yy = tile.top - rect.top + y; if (yy < 0 || yy >= rh) continue;
      for (let x = 0; x < tw; x++) { const xx = tile.left - rect.left + x; if (xx < 0 || xx >= rw) continue; const v = r[y * tw + x]; if (v > dst[yy * rw + xx]) dst[yy * rw + xx] = v; }
    }
  }
  async function psSamZoomPieces(prompt, region, g, src) {
    const rect = g.rect, rw = rect.right - rect.left, rh = rect.bottom - rect.top;
    const tiles = kbTiles(region).slice(0, KB_ZOOM_TILES);
    const pieces = []; let masks = 0;
    for (let t = 0; t < tiles.length; t++) {
      setStatus("busy", "SAM: “" + prompt + "”, close-up " + (t + 1) + " of " + tiles.length + "…");
      const r = await kbSamRect(prompt, tiles[t], { maxCover: 0.6, samPath: PS_SAM_PATH, src: src });   // a mask filling the tile is junk
      if (!r || !r.plane) continue;
      masks += r.masks || 0;
      const planes = (r.planes && r.planes.length) ? r.planes : [r.plane];
      for (let i = 0; i < planes.length; i++) {
        const pl = new Uint8Array(rw * rh);
        psPasteCropToRect(pl, rw, rh, rect, planes[i], r.w, r.h, tiles[t]);
        const b = new Uint8Array(rw * rh); let n = 0;
        for (let k = 0; k < b.length; k++) if (pl[k] > 127 && g.alpha[k] > 127) { b[k] = 1; n++; }
        if (n) pieces.push({ b: b, n: n });
      }
    }
    // the same piece in two overlapping tiles → one
    const merged = [];
    for (let i = 0; i < pieces.length; i++) {
      const P = pieces[i]; let into = null;
      for (let j = 0; j < merged.length && !into; j++) {
        const M = merged[j]; let both = 0;
        for (let k = 0; k < P.b.length; k++) if (P.b[k] && M.b[k]) both++;
        if (both >= 0.3 * Math.min(P.n, M.n)) into = M;
      }
      if (into) { for (let k = 0; k < P.b.length; k++) if (P.b[k] && !into.b[k]) { into.b[k] = 1; into.n++; } }
      else merged.push({ b: P.b, n: P.n });
    }
    trace("ps trims: “" + prompt + "” on " + tiles.length + " close-up(s) of " + JSON.stringify(region) + " → " + masks + " mask(s), " + merged.length + " piece(s)");
    return { pieces: merged.map(function (m) { return m.b; }), calls: tiles.length, masks: masks };
  }
  // The close-up area: "upper" = the top 55% of the garment (yoke, placket, collar), else all of it.
  function psTrimZoomRegion(rect, which) {
    if (which !== "upper") return rect;
    return { left: rect.left, top: rect.top, right: rect.right, bottom: Math.round(rect.top + (rect.bottom - rect.top) * 0.55) };
  }
  function psChildNamed(group, name) {
    try { for (let i = 0; i < group.layers.length; i++) if (String(group.layers[i].name) === name) return group.layers[i]; } catch (_) {}
    return null;
  }

  // Outside a modal: Blend If settings for PIPING from CLEAN's pixels — for R, G
  // and B the piping (KBPS piping) and the fabric (rest of the garment) values;
  // the channel where they are furthest apart wins. Piping darker there → shown
  // from 0 up to a split white slider; lighter → from a split black slider up.
  function psQuantile(arr, n, q) {
    if (!n) return 0;
    const h = new Uint32Array(256);
    for (let i = 0; i < n; i++) h[arr[i]]++;
    let acc = 0; for (let v = 0; v < 256; v++) { acc += h[v]; if (acc >= n * q) return v; }
    return 255;
  }
  async function psPipingBlendIf(cleanId, trimCh) {
    const g = await psGarmentBox(0.01);
    const rect = g.rect, rw = rect.right - rect.left, rh = rect.bottom - rect.top, N = rw * rh;
    const pip = await psReadMaskAlpha(rect, trimCh || PS_PIPING_CH);
    let src = null;
    await psMod().core.executeAsModal(async function () { src = await psReadLayerRgb(cleanId, rect); }, { commandName: "KBImage — read CLEAN for piping" });
    const names = ["red", "green", "blue"];
    let best = null;
    for (let c = 0; c < 3; c++) {
      const P = new Uint8Array(N), F = new Uint8Array(N); let np = 0, nf = 0;
      for (let k = 0; k < N; k++) {
        if (!src.valid[k] || g.alpha[k] <= 127) continue;
        const v = src.rgb[k * 3 + c];
        if (pip[k] > 127) P[np++] = v; else if (pip[k] === 0) F[nf++] = v;
      }
      if (np < 20 || nf < 20) continue;
      const p5 = psQuantile(P, np, 0.05), p50 = psQuantile(P, np, 0.5), p95 = psQuantile(P, np, 0.95);
      const f5 = psQuantile(F, nf, 0.05), f50 = psQuantile(F, nf, 0.5), f95 = psQuantile(F, nf, 0.95);
      const sep = Math.abs(p50 - f50) / ((p95 - p5) + (f95 - f5) + 1);
      if (!best || sep > best.sep) best = { c: c, sep: sep, p5: p5, p50: p50, p95: p95, f5: f5, f50: f50, f95: f95, np: np, nf: nf };
    }
    // LACE and the other SAM trims: SAM's mask is rough (it holds fabric
    // between the threads), so the trim is judged against the FABRIC alone: whatever is
    // clearly lighter (or darker) than the fabric outside the mask shows, the rest hides.
    if (trimCh && trimCh !== PS_PIPING_CH) {
      let pick = null;
      for (let c = 0; c < 3; c++) {
        const P = new Uint8Array(N), F = new Uint8Array(N); let np = 0, nf = 0;
        for (let k = 0; k < N; k++) {
          if (!src.valid[k] || g.alpha[k] <= 127) continue;
          const v = src.rgb[k * 3 + c];
          if (pip[k] > 127) P[np++] = v; else if (pip[k] === 0) F[nf++] = v;
        }
        if (np < 20 || nf < 20) continue;
        const f5 = psQuantile(F, nf, 0.05), f50 = psQuantile(F, nf, 0.5), f95 = psQuantile(F, nf, 0.95), p50 = psQuantile(P, np, 0.5);
        const light = p50 >= f50, pq = psQuantile(P, np, light ? 0.75 : 0.25);
        const sep = Math.abs(pq - f50) / ((f95 - f5) + 1);
        if (!pick || sep > pick.sep) pick = { c: c, sep: sep, light: light, pq: pq, f5: f5, f50: f50, f95: f95 };
      }
      if (!pick || pick.sep < 1.5 || (pick.light ? pick.pq <= pick.f95 + 4 : pick.pq >= pick.f5 - 4)) {
        trace("ps " + trimCh + ": Blend If cannot separate it from the fabric (" + (pick ? JSON.stringify(pick) : "no data") + "), mask fallback");
        return { fallback: true, sep: pick ? pick.sep : 0 };
      }
      let a, b2;
      if (pick.light) { a = Math.min(254, pick.f95 + 1); b2 = Math.min(255, Math.max(a + 4, Math.round((pick.f95 + pick.pq) / 2))); }
      else { b2 = Math.max(1, pick.f5 - 1); a = Math.max(0, Math.min(b2 - 4, Math.round((pick.f5 + pick.pq) / 2))); }
      const rt = { channel: names[pick.c], dark: !pick.light, a: a, b: b2, sep: pick.sep, trim: pick.pq, fabric: [pick.f5, pick.f50, pick.f95] };
      trace("ps " + trimCh + " Blend If (against the fabric): " + JSON.stringify(rt));
      return rt;
    }
    // Blend If cannot separate it (neutral piping, or too close to the fabric) → mask fallback.
    if (!best || best.sep < 1.0) { trace("ps " + (trimCh || "piping") + ": Blend If cannot separate it (sep " + (best ? best.sep.toFixed(2) : "?") + "), mask fallback"); return { fallback: true, sep: best ? best.sep : 0 }; }
    const dark = best.p50 < best.f50;
    let a = dark ? best.p95 : best.f95, b = dark ? best.f5 : best.p5;     // split from a (fully one side) to b (fully the other)
    if (b <= a + 2) { const mid = Math.round((best.p50 + best.f50) / 2); a = Math.max(0, mid - 6); b = Math.min(255, mid + 6); }
    const r = { channel: names[best.c], dark: dark, a: a, b: b, sep: best.sep, piping: [best.p5, best.p50, best.p95], fabric: [best.f5, best.f50, best.f95] };
    trace("ps " + (trimCh || "piping") + " Blend If: " + JSON.stringify(r));
    return r;
  }

  // Inside executeAsModal: Blend If (This Layer) on the active layer. Throws Photoshop's exact error.
  async function psSetBlendIfInModal(bi) {
    const range = { _obj: "blendRange", channel: { _ref: "channel", _enum: "channel", _value: bi.channel },
      srcBlackMin: bi.dark ? 0 : bi.a, srcBlackMax: bi.dark ? 0 : bi.b,
      srcWhiteMin: bi.dark ? bi.a : 255, srcWhiteMax: bi.dark ? bi.b : 255,
      destBlackMin: 0, destBlackMax: 0, destWhiteMin: 255, desaturate: 255 };
    try {
      await psMod().action.batchPlay([{ _obj: "set", _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
        to: { _obj: "layer", blendRange: [range] }, _options: { dialogOptions: "dontDisplay" } }], { synchronousExecution: true });
    } catch (e) { throw new Error("Setting Blend If failed — Photoshop said: " + ((e && e.message) || String(e))); }
  }

  // Inside executeAsModal: Color Fill 1 (Color mode) clipped above the active
  // layer; shown with the chosen color, hidden (black) when there is none.
  async function psMakeTrimFillInModal(rgb) {
    const c = rgb || [0, 0, 0];
    const id = await psMakeClippedInModal("Color Fill 1",
      { _obj: "make", _target: [{ _ref: "contentLayer" }],
        using: { _obj: "contentLayer", name: "Color Fill 1", type: { _obj: "solidColorLayer", color: { _obj: "RGBColor", red: c[0], grain: c[1], blue: c[2] } } },
        _options: { dialogOptions: "dontDisplay" } });
    try { await psSetBlendInModal(id, "color", 100); }
    catch (e) { throw new Error("Setting Color Fill 1 to Color failed — Photoshop said: " + ((e && e.message) || String(e))); }
    try { const l = kbLayerById(id); if (l) l.visible = !!rgb; } catch (_) {}
    return id;
  }

  // Inside executeAsModal: build (or rebuild) one trim group. bi = Blend If
  // settings for piping. Throws with the exact reason; removes anything it made.
  async function psBuildTrimGroupInModal(kind, bi) {
    const ps = psMod();
    const doc = ps.app.activeDocument;
    const K = PS_TRIM_KINDS[kind];
    const EP = ps.constants && ps.constants.ElementPlacement;
    if (!kbChannelExists(K.ch)) throw new Error(K.ch + " is missing.");
    await kbLoadChannel(K.ch);
    const has = !!kbSelectionBounds();
    try { await deselectAll(); } catch (_) {}
    if (!has) throw new Error(K.ch + " is empty.");
    const cleanId = psAcceptedCleanId();
    const srcId = cleanId != null ? cleanId : (kind === "buttons" ? psOriginalPhotoId() : null);
    const src = srcId != null ? kbLayerById(srcId) : null;
    if (!src) throw new Error(kind === "piping" ? "PIPING needs an accepted CLEAN (step 3 Remove print)." : "no CLEAN or photo layer found.");
    const old = psTrimGroupNamed(K.group);
    // The order in PB (BUTTON THREAD, BUTTON, the SAM trims (LACE …), PIPING) is set by psLayoutFixInModal.
    const veil = psTopLayerNamed(PS_VEIL_NAME);
    let rel = null, where = null;
    const pb = psPbGroup();
    if (pb) { rel = pb; where = EP.PLACEINSIDE; }                     // straight into PB; the layout fix sets the order
    else if (old) { rel = old; where = EP.PLACEBEFORE; }
    else if (veil) { rel = veil; where = EP.PLACEBEFORE; }             // above the veil: it never covers a trim
    else { rel = doc.layers[0]; where = EP.PLACEBEFORE; }
    const made = [];
    try {
      let px;
      const srcName = cleanId != null ? "CLEAN" : "the photo";
      try { px = await src.duplicate(rel, where, K.group); }
      catch (e) { throw new Error("Copying " + srcName + " as " + K.group + " failed — Photoshop said: " + ((e && e.message) || String(e))); }
      made.push(px.id);
      try { px.visible = true; } catch (_) {}
      if (kind === "piping") {
        // Outline only: KBPS garment pulled in by Edge margin, so color fringe at the
        // garment edge never shows. The piping itself is left to Blend If.
        // KBPS buttons are cut out of PIPING's mask: red / pink buttons pass the same Blend If as red piping.
        if (bi && bi.fallback) await psMaskLayerToChannelInModal(px.id, K.ch, K.group, 0, [PS_BUTTONS_CH]);   // neutral piping: masked to what Find piping found
        else {
          await psMaskLayerToChannelInModal(px.id, PS_GARMENT_CH, K.group, psPipingMargin(), [PS_BUTTONS_CH]);
          await psSelectLayerVerifiedInModal(px.id, K.group);
          await psSetBlendIfInModal(bi);
        }
      } else if (psIsSamTrim(kind)) {
        // LACE and the other SAM trims: masked to what SAM found (buttons cut out); Blend If keeps the trim's own white and texture.
        await psMaskLayerToChannelInModal(px.id, K.ch, K.group, 0, [PS_BUTTONS_CH]);
        if (bi && !bi.fallback) { await psSelectLayerVerifiedInModal(px.id, K.group); await psSetBlendIfInModal(bi); }
      } else {
        await psMaskLayerToChannelInModal(px.id, K.ch, K.group, psTrimShrink());
      }
      await psSelectLayerVerifiedInModal(px.id, K.group);
      const rgb = null;                                             // a chosen color is put back after the build (psTrimColorReapply)
      const fill = await psMakeTrimFillInModal(null);               // Color Fill 1, Color mode, hidden: Original
      made.push(fill);
      const gid = await psGroupInModal([px.id, fill], K.group);
      made.push(gid);
      const olds = old ? [old] : [];                                 // the earlier group, replaced in place
      if (kind === "buttons") {                                      // BUTTON THREAD (team: Layer 10 at 50%)
        const oldT = psTrimGroupNamed(PS_THREAD_NAME);
        if (oldT) olds.push(oldT);
        let tOk = false;
        if (kbChannelExists(PS_THREAD_CH)) { await kbLoadChannel(PS_THREAD_CH); tOk = !!kbSelectionBounds(); try { await deselectAll(); } catch (_) {} }
        if (tOk) {
          let th;
          try { th = await src.duplicate(kbLayerById(gid), EP.PLACEBEFORE, PS_THREAD_NAME); }
          catch (e) { throw new Error("Copying CLEAN as BUTTON THREAD failed — Photoshop said: " + ((e && e.message) || String(e))); }
          made.push(th.id);
          try { th.visible = true; } catch (_) {}
          await psMaskLayerToChannelInModal(th.id, PS_THREAD_CH, PS_THREAD_NAME, 0);
          await psSetBlendInModal(th.id, "normal", 50);
        }
      }
      // The new group is complete: only now the earlier one goes, and from here on nothing is
      // rolled back (a failed rollback after this delete was how PIPING went missing).
      for (let i = 0; i < olds.length; i++) await psDeleteLayerInModal(olds[i].id);
      made.length = 0;
      try { await psLayoutFixInModal(); }                           // into PS › PB, above SDW and the parts
      catch (e) { traceErr("ps trims: " + K.group + " into " + PS_PS_GROUP + " › " + PS_PB_GROUP + " (left where it is)", e); }
      trace("ps trims: built " + K.group + " (group " + gid + ") from " + srcName + " " + srcId
        + (kind === "piping" ? (bi.fallback ? ", masked to " + K.ch + " (Blend If could not separate it)" : ", garment mask pulled in " + psPipingMargin() + " px, Blend If " + bi.channel + (bi.dark ? " white " : " black ") + bi.a + "/" + bi.b)
          : psIsSamTrim(kind) ? ", masked to " + K.ch + (bi && !bi.fallback ? ", Blend If " + bi.channel + (bi.dark ? " white " : " black ") + bi.a + "/" + bi.b : " (Blend If could not separate it)")
          : ", masked to " + K.ch + " (shrunk " + psTrimShrink() + " px)")
        + (rgb ? ", color " + rgb.join(",") : ", color fill off"));
      return gid;
    } catch (err) {
      for (let i = made.length - 1; i >= 0; i--) { try { await psDeleteLayerInModal(made[i]); } catch (_) {} }
      throw err;
    }
  }

  // Outside a modal: build one trim group and report it in the status line.
  async function psBuildTrimGroup(kind, why) {
    const K = PS_TRIM_KINDS[kind];
    traceStart("Print Swap — build " + K.group + " (" + why + ")");
    let msg = null, ok = false, recol = null;
    try {
      let bi = null;
      if (kind === "piping" || psIsSamTrim(kind)) {
        const cleanId = psAcceptedCleanId();
        if (cleanId == null) throw new Error(K.group + " needs an accepted CLEAN (step 3 Remove print).");
        if (!kbChannelExists(K.ch)) throw new Error(K.ch + " is missing.");
        bi = await psPipingBlendIf(cleanId, K.ch);
      }
      await psMod().core.executeAsModal(async function () { await psBuildTrimGroupInModal(kind, bi); }, { commandName: "KBImage — " + K.group });
      // The trim's saved color, on the new group. Redo (step 4 or earlier) and Start over clear
      // the colors, so a color here was set since then; a new Find run says it is back.
      recol = await psTrimColorReapply(kind);
      const rec = logRecordSkeleton("printswap:trim-group", { kind: kind, why: why, blendIf: bi, color: recol }, null, "channel:" + K.ch);
      await logRun(rec);
      await logFinalizeCommitted(rec.id);
      ok = true;
      const found = why === "accepted";
      const back = function (group, hex) { return " " + group + " color " + hex + " put back. Click Original to remove it."; };
      let also = "";
      if (kind === "buttons" && psTrimGroupNamed(PS_PIPING_GRP)) {
        const pr = await psBuildTrimGroup("piping", "buttons changed");
        if (!pr.ok) { trace("ps trims: PIPING rebuild after buttons: " + pr.msg); also = " " + pr.msg; }
        else if (found && pr.recol) also = back(PS_PIPING_GRP, pr.recol);
      }
      msg = K.group + " built." + (recol ? (found ? back(K.group, recol) : " Color " + recol + " kept.") : "") + also + " Set trim colors in step 7.";
      trace("ps trims: " + K.group + " built" + (bi ? (bi.fallback ? " (masked; Blend If could not separate it from the fabric)" : " (Blend If " + bi.channel + " " + bi.a + "/" + bi.b + ")") : ""));
    } catch (err) {
      traceErr("ps trims " + kind, err);
      msg = K.group + " not built: " + ((err && err.message) || String(err)) + (/missing|empty/.test(String(err && err.message)) ? " Select it by hand and use + Add." : "");
    }
    await traceFlush();
    return { ok: ok, msg: msg, recol: recol };
  }
  // On Accept the recall wrapper writes "Accepted — kept…" after onSettle, so the
  // trim result is shown just after it.
  function psTrimOnSettle(kind) {
    return async function (state, accepted) {
      if (!accepted) return;
      generateInFlight = true;
      let r = null;
      try { r = await psBuildTrimGroup(kind, "accepted"); } finally { generateInFlight = false; }
      setTimeout(function () { setStatus(r && r.ok ? "ok" : "bad", r ? r.msg : ""); }, 0);
    };
  }
  // After a hand touch-up: the group (if built) follows the channel.
  async function psTrimAfterEdit(kind) {
    const pend = pendingRecall && pendingRecall.descriptor && String(pendingRecall.descriptor.op);
    if (pend === psTrimOp(kind)) return null;   // Accept builds it
    return psBuildTrimGroup(kind, "touch-up");
  }

  // Edge margin: PIPING's garment mask pulled in this many px (outline only).
  function psPipingMargin() { return Math.round(kbNum("ps-piping-margin", 6, 0, 50)); }
  // Shrink mask: the BUTTON mask only (PIPING's mask is the garment outline).
  function psTrimShrink() { return Math.round(kbNum("ps-trim-shrink", 1, 0, 3)); }
  async function actPsPipingRemargin() {
    if (generateInFlight) { kbBusyNote(); return; }
    if (!psTrimGroupNamed(PS_PIPING_GRP)) { setStatus("bad", "There is no PIPING group yet. Find piping in step 4 and Accept."); return; }
    generateInFlight = true;
    let r = null;
    try { r = await psBuildTrimGroup("piping", "edge margin " + psPipingMargin() + " px"); }
    finally { generateInFlight = false; }
    setStatus(r && r.ok ? "ok" : "bad", r ? r.msg : "");
  }
  async function actPsTrimReshrink() {
    if (generateInFlight) { kbBusyNote(); return; }
    if (!psTrimGroupNamed(PS_BUTTON_GRP)) { setStatus("bad", "There is no BUTTON group yet. Find buttons in step 4 and Accept."); return; }
    generateInFlight = true;
    let r = null;
    try { r = await psBuildTrimGroup("buttons", "shrink mask " + psTrimShrink() + " px"); }
    finally { generateInFlight = false; }
    setStatus(r && r.ok ? "ok" : "bad", r ? r.msg : "");
  }

  const PS_THREAD_NAME = "BUTTON THREAD";

  // ----- TRIM RECOLOR (step 4, and any time after it, Finish included) -------------
  // Each trim row: a swatch, a hex box and Original · White · Black · Custom… (Photoshop's
  // color picker: click the print on the canvas to match it). Original = no recolor.
  // A color is two layers clipped to the trim layer, bottom to top:
  //   Trim lightness (Levels): the trim's median lightness, measured inside its channel,
  //     → the color's lightness, so the texture and shading around it stay;
  //   Color Fill 1 (Color mode): the color's hue and saturation.
  // Both visible when a color is set, hidden on Original. A pick applies at once (no
  // Accept): the old pair is deleted and a new one built; Original undoes it. After
  // Finish a new MERGED is built at once. No Re-run of Find. The color is saved with the
  // document and put back when the trim group is built again.
  const PS_TRIM_LIGHT = "Trim lightness";
  const PS_TRIM_FILL = "Color Fill 1";
  const PS_TRIM_OLD_ADJ = "Hue/Saturation 1";              // earlier versions' BUTTON recolor
  const PS_TRIM_CHIPS = { white: "#FFFFFF", black: "#000000" };
  const PS_TRIM_DARK_FLOOR = 14;                           // the darkest a trim's median goes: folds and edges still read on Black
  let psTrimColors = {};                                   // kind → "#RRGGBB" (absent = Original), this document's
  let psTrimColorDocId = null;
  let psTrimLink = false;                                  // "Buttons same as piping", this document's (off by default)

  // Photoshop's Color blend keeps the base's luminosity (0.30 R + 0.59 G + 0.11 B).
  function psLum(rgb) { return 0.3 * rgb[0] + 0.59 * rgb[1] + 0.11 * rgb[2]; }
  // Pure: Levels that move lightness m to t. Lighter: input white pulled in (linear, the
  // texture keeps its proportions; t = 255 → the median and above go white). Darker: gamma,
  // with output white lowered once the gamma reaches Photoshop's 0.10 limit.
  function psTrimLevels(m, t) {
    m = Math.max(2, Math.min(253, Math.round(m)));
    t = Math.max(PS_TRIM_DARK_FLOOR, Math.min(255, Math.round(t)));
    if (Math.abs(t - m) <= 1) return { input: [0, 255], gamma: 1, output: [0, 255] };
    if (t > m) return { input: [0, Math.max(m, Math.min(255, Math.round(255 * m / t)))], gamma: 1, output: [0, 255] };
    const g = Math.log(m / 255) / Math.log(t / 255);
    if (g >= 0.1) return { input: [0, 255], gamma: Math.round(g * 100) / 100, output: [0, 255] };
    return { input: [0, 255], gamma: 0.1, output: [0, Math.max(1, Math.min(255, Math.round(t / Math.pow(m / 255, 10))))] };
  }
  // The trim's own layer: the copy of CLEAN at the bottom of its group (named like the group).
  function psTrimBase(kind) {
    const K = PS_TRIM_KINDS[kind], g = K ? psTrimGroupNamed(K.group) : null;
    if (!g) return null;
    const own = psChildNamed(g, K.group);
    if (own) return own;
    try { const kids = g.layers; return kids && kids.length ? kids[kids.length - 1] : null; } catch (_) { return null; }
  }
  // The recolor layers in the trim's group (Trim lightness, Color Fill 1, an old Hue/Saturation 1).
  function psTrimColorLayers(kind) {
    const K = PS_TRIM_KINDS[kind], g = K ? psTrimGroupNamed(K.group) : null, out = [];
    try { const kids = g ? g.layers : []; for (let i = 0; i < kids.length; i++) { const n = String(kids[i].name); if (n === PS_TRIM_LIGHT || n === PS_TRIM_FILL || n === PS_TRIM_OLD_ADJ) out.push(kids[i]); } } catch (_) {}
    return out;
  }
  // Outside a modal: the trim's median lightness inside its channel, read from its own layer by id.
  async function psTrimMedian(kind) {
    const K = PS_TRIM_KINDS[kind], base = psTrimBase(kind);
    if (!base) throw new Error("there is no " + K.group + " group yet.");
    if (!kbChannelExists(K.ch)) throw new Error(K.ch + " is missing.");
    const gb = await psGarmentBox(0.01);
    const alpha = await psReadMaskAlpha(gb.rect, K.ch);
    let med = null;
    await psMod().core.executeAsModal(async function () { med = psMedianLuma(await psReadLayerRgb(base.id, gb.rect), alpha); },
      { commandName: "KBImage — measure " + K.group });
    if (med == null) throw new Error(K.ch + " holds none of " + K.group + "'s pixels.");
    return med;
  }
  // Inside executeAsModal: Trim lightness + Color Fill 1, clipped above the trim layer. Returns their ids.
  async function psTrimColorLayersInModal(baseId, rgb, lv) {
    const ps = psMod();
    await psSelectLayerVerifiedInModal(baseId, "the trim layer");
    const vals = psLevelsValues(lv.input[0], lv.input[1], lv.gamma, lv.output);
    const lid = await psMakeClippedInModal(PS_TRIM_LIGHT, { _obj: "make", _target: [{ _ref: "adjustmentLayer" }],
      using: { _obj: "adjustmentLayer", name: PS_TRIM_LIGHT, type: Object.assign({ _obj: "levels" }, vals) }, _options: { dialogOptions: "dontDisplay" } });
    await psSelectLayerVerifiedInModal(lid, PS_TRIM_LIGHT);
    try {
      await ps.action.batchPlay([{ _obj: "set", _target: [{ _ref: "adjustmentLayer", _enum: "ordinal", _value: "targetEnum" }],
        to: Object.assign({ _obj: "levels" }, vals), _options: { dialogOptions: "dontDisplay" } }], { synchronousExecution: true });
    } catch (e) { throw new Error("Setting " + PS_TRIM_LIGHT + " failed — Photoshop said: " + ((e && e.message) || String(e))); }
    try { const l = kbLayerById(lid); if (l) l.visible = true; } catch (_) {}
    const fid = await psMakeTrimFillInModal(rgb);                // Color mode, shown
    return [lid, fid];
  }
  function psTrimGroups(kinds) { return (kinds || []).map(function (k) { return (PS_TRIM_KINDS[k] || { group: "Trim" }).group; }).join(" and "); }
  function psTrimColorText(p) {
    const per = p.per && p.per.length ? p.per : [{ kind: p.kind, median: p.median, target: p.target, levels: p.levels }];
    const one = function (q) {
      const K = PS_TRIM_KINDS[q.kind] || { group: "Trim" }, lv = q.levels || {};
      const how = !lv.input ? "" : (lv.input[1] < 255 ? "input white " + lv.input[1] : "gamma " + lv.gamma + (lv.output && lv.output[1] < 255 ? ", output white " + lv.output[1] : ""));
      return K.group + " median lightness " + q.median + " to " + q.target + " (Levels " + how + ")";
    };
    return psTrimGroups(per.map(function (q) { return q.kind; })) + " recolored " + p.hex + (per.length > 1 ? " together" : "") + ": Trim lightness moves "
      + per.map(one).join("; ") + ", Color Fill 1 (Color mode) gives the hue.";
  }
  async function psTrimColorSave() {
    try { const st = await psStateLoad(); st.trimColors = Object.assign({}, psTrimColors); st.trimLink = !!psTrimLink; await psStateSave(st); }
    catch (e) { traceErr("ps trims: save colors", e); }
  }
  // Redo on step 4 or earlier, and Start over: every trim color and "Buttons same as piping"
  // go, in the panel and in the saved state (the document and the plug-in folder), so trims
  // built after this are Original.
  async function psTrimColorsClear() {
    psTrimColors = {}; psTrimLink = false;
    try { const st = await psStateLoad(); delete st.trimColors; delete st.trimLink; await psStateSave(st); }
    catch (e) { traceErr("ps trims: clear colors", e); }
    try { psTrimColorRender(); psTrimLinkSync(); } catch (_) {}
    trace("ps trims: colors and Buttons same as piping cleared");
  }
  // A color on these trims at once (no Accept): each trim's old pair deleted and a new
  // Trim lightness + Color Fill 1 built. Returns the per-trim measurements.
  async function psTrimColorApply(kinds, hex) {
    const rgb = kbParseHex(hex || "");
    if (!rgb) throw new Error("there is no color to apply.");
    const names = psTrimGroups(kinds), per = [];
    setStatus("busy", "Measuring " + names + "…");
    for (let i = 0; i < kinds.length; i++) {
      const med = await psTrimMedian(kinds[i]), tgt = Math.round(psLum(rgb));
      per.push({ kind: kinds[i], median: med, target: tgt, levels: psTrimLevels(med, tgt) });
    }
    setStatus("busy", "Recoloring " + names + "…");
    let ids = [];
    await psMod().core.executeAsModal(async function () {
      for (let i = 0; i < per.length; i++) {
        const q = per[i], base = psTrimBase(q.kind);
        if (!base) throw new Error("there is no " + PS_TRIM_KINDS[q.kind].group + " group any more.");
        const old = psTrimColorLayers(q.kind);
        for (let k = 0; k < old.length; k++) if (kbLayerById(old[k].id)) await psDeleteLayerInModal(old[k].id);   // the old pair, replaced
        ids = ids.concat(await psTrimColorLayersInModal(base.id, rgb, q.levels));
      }
    }, { commandName: "KBImage — recolor " + names });
    trace("ps trims: recolor " + names + " " + hex + ", " + per.map(function (q) { return q.kind + " median " + q.median + " → " + q.target + ", Levels " + JSON.stringify(q.levels); }).join("; ") + ", layers " + ids.join(", "));
    return per;
  }
  function psTrimWord(kind) { const K = PS_TRIM_KINDS[kind]; return kind === "buttons" ? "buttons" : (K ? K.group.toLowerCase() : "the trim"); }
  // "Buttons same as piping" applies only when the type has both trims.
  function psTrimLinked() { const ks = psTypeTrimKinds(); return !!psTrimLink && ks.indexOf("piping") >= 0 && ks.indexOf("buttons") >= 0; }
  // The trims a color change on `kind` recolors: PIPING and BUTTON together while linked.
  function psTrimRunKinds(kind) {
    if (kind === "piping" && psTrimLinked() && psTrimBase("buttons")) return ["piping", "buttons"];
    return [kind];
  }
  // Why a color cannot be applied now (null = it can). The panel keeps what the retoucher
  // typed or picked; nothing is reset quietly.
  function psTrimBlocked() {
    if (generateInFlight) return "Wait for the current run to finish, then pick the color again.";
    if (psOtherPending("printswap:trim-color")) return "Accept or Discard the preview that is waiting first.";
    return null;
  }
  async function psTrimColorRun(kind, hex, opts) {
    const K = PS_TRIM_KINDS[kind];
    if (!K) return;
    opts = opts || {};
    if (kind === "buttons" && psTrimLinked() && !opts.link) { psTrimColorSync(kind); setStatus("bad", "BUTTON follows PIPING. Turn off Buttons same as piping to set it on its own."); return; }
    const kinds = opts.kinds || psTrimRunKinds(kind);
    const why = psTrimBlocked();
    if (why) { setStatus("bad", why); return; }                   // the box and chip keep what was typed or picked
    if (!psTrimBase(kind)) { setStatus("bad", "There is no " + K.group + " group yet. Find " + psTrimWord(kind) + " in step 4 and Accept, then pick its color."); psTrimColorSync(kind); return; }
    if (!hex) return psTrimColorOriginal(kinds);
    const names = psTrimGroups(kinds);
    generateInFlight = true;
    traceStart("Print Swap — recolor " + names);
    try {
      const per = await psTrimColorApply(kinds, hex);
      kinds.forEach(function (k) { psTrimColors[k] = hex; });
      if (opts.link) psTrimLink = true;
      await psTrimColorSave();
      const mm = !psMergedHeld && psMergedAccepted() ? await psMergedRebuild(true) : null;   // after Finish: the newest MERGED is redone
      const rec = logRecordSkeleton("printswap:trim-color", { kind: kinds[0], kinds: kinds, hex: hex }, null, "trim:" + names);
      await logRun(rec);
      await logFinalizeCommitted(rec.id);
      setStatus("ok", psTrimColorText({ hex: hex, per: per }) + (mm ? " " + mm : ""));
    } catch (err) {
      traceErr("ps trims: recolor " + names, err);
      if (opts.link) psTrimLink = false;
      setStatus("bad", "Could not recolor " + names + ": " + ((err && err.message) || String(err)));
    } finally {
      generateInFlight = false;
      kinds.forEach(psTrimColorSync);
      psTrimLinkSync();
      try { updateDocInfo(); } catch (_) {}
      await traceFlush();
    }
  }
  // Original: no recolor. Kept at once (the pair hidden, not deleted); after Finish the newest MERGED is redone.
  async function psTrimColorOriginal(kindsIn) {
    const kinds = Array.isArray(kindsIn) ? kindsIn : [kindsIn];
    const names = psTrimGroups(kinds);
    generateInFlight = true;
    try {
      let layers = [];
      kinds.forEach(function (k) { layers = layers.concat(psTrimColorLayers(k)); });
      await psMod().core.executeAsModal(async function () { layers.forEach(function (l) { try { l.visible = false; } catch (_) {} }); },
        { commandName: "KBImage — " + names + " original color" });
      kinds.forEach(function (k) { delete psTrimColors[k]; });
      await psTrimColorSave();
      const mm = layers.length && !psMergedHeld && psMergedAccepted() ? await psMergedRebuild(true) : null;
      const rec = logRecordSkeleton("printswap:trim-color", { kind: kinds[0], kinds: kinds, hex: null }, null, "trim:" + names);
      await logRun(rec);
      await logFinalizeCommitted(rec.id);
      setStatus("ok", names + ": Original, no recolor" + (layers.length ? " (Trim lightness and Color Fill 1 hidden)." : ".") + (mm ? " " + mm : ""));
    } catch (err) {
      setStatus("bad", "Could not set " + names + " back to Original: " + ((err && err.message) || String(err)));
    } finally {
      generateInFlight = false;
      kinds.forEach(psTrimColorSync);
    }
  }
  // After the trim group is built again (Find accepted, Edge margin, Shrink …): its saved color back on.
  async function psTrimColorReapply(kind) {
    const hex = psTrimColors[kind], rgb = hex ? kbParseHex(hex) : null;
    if (!rgb) return null;
    try {
      const med = await psTrimMedian(kind), lv = psTrimLevels(med, psLum(rgb));
      await psMod().core.executeAsModal(async function () {
        const base = psTrimBase(kind); if (!base) return;
        const old = psTrimColorLayers(kind);
        for (let i = 0; i < old.length; i++) await psDeleteLayerInModal(old[i].id);
        await psTrimColorLayersInModal(base.id, rgb, lv);
      }, { commandName: "KBImage — " + PS_TRIM_KINDS[kind].group + " color" });
      trace("ps trims: " + PS_TRIM_KINDS[kind].group + " color " + hex + " put back (median " + med + ", Levels " + JSON.stringify(lv) + ")");
      return hex;
    } catch (e) { traceErr("ps trims: put back " + hex + " on " + kind, e); return null; }
  }

  // ----- Panel: one row per trim of the picked type ------------------------------
  function psTrimColorShown(kind) { return psTrimColors[kind] || null; }
  function psTrimColorSync(kind) {
    const hex = psTrimColorShown(kind);
    const sw = $("ps-tc-sw-" + kind);
    if (sw) { sw.classList.toggle("ps-swatch-none", !hex); sw.style.backgroundColor = hex || ""; }
    const box = $("ps-tc-hex-" + kind); if (box) { box.value = hex || ""; box.classList.remove("ps-bad"); }
    const g = $("pills-ps-tc-" + kind);
    if (g) {
      let which = hex ? "custom" : "original";
      Object.keys(PS_TRIM_CHIPS).forEach(function (k) { if (hex && PS_TRIM_CHIPS[k] === hex.toUpperCase()) which = k; });
      const ps = g.querySelectorAll(".pill");
      for (let i = 0; i < ps.length; i++) ps[i].classList.toggle("selected", ps[i].getAttribute("data-value") === which);
    }
  }
  function psTrimColorRender() {
    const box = $("ps-trim-colors");
    if (!box) return;
    while (box.firstChild) box.removeChild(box.firstChild);
    psTypeTrimKinds().forEach(function (kind) {
      const K = PS_TRIM_KINDS[kind];
      const row = document.createElement("div"); row.className = "ps-trim-color-row";
      const nm = document.createElement("div"); nm.className = "ps-trim-color-name"; nm.textContent = K.group;
      const line = document.createElement("div"); line.className = "ps-gray-row";
      const sw = document.createElement("div"); sw.id = "ps-tc-sw-" + kind; sw.className = "ps-gray-swatch ps-swatch-none";
      const inp = document.createElement("input"); inp.id = "ps-tc-hex-" + kind; inp.className = "input"; inp.type = "text";
      inp.setAttribute("placeholder", "Original"); inp.setAttribute("autocomplete", "off"); inp.setAttribute("spellcheck", "false");
      // Enter or leaving the box applies it (with or without "#"); an invalid value only turns the box red
      inp.addEventListener("change", function () { psTrimColorFromBox(kind); });
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") psTrimColorFromBox(kind); });
      inp.addEventListener("input", function () { inp.classList.remove("ps-bad"); });
      line.appendChild(sw); line.appendChild(inp);
      const pills = document.createElement("div"); pills.id = "pills-ps-tc-" + kind; pills.className = "pills pills-small ps-gray-chips"; pills.setAttribute("data-group", "ps-tc");
      [["original", "Original"], ["white", "White"], ["black", "Black"], ["custom", "Custom…"]].forEach(function (c) {
        const p = document.createElement("div"); p.className = "pill"; p.setAttribute("role", "button"); p.setAttribute("tabindex", "0");
        p.setAttribute("data-value", c[0]); p.textContent = c[1];
        pills.appendChild(p);
      });
      row.id = "ps-tc-row-" + kind;
      row.appendChild(nm); row.appendChild(line); row.appendChild(pills);
      box.appendChild(row);
      psTrimColorSync(kind);
    });
    // BUTTON and PIPING are often the same color: one checkbox under the rows links them.
    const ks = psTypeTrimKinds();
    if (ks.indexOf("piping") >= 0 && ks.indexOf("buttons") >= 0) {
      const lb = document.createElement("label"); lb.className = "ps-check ps-trim-link";
      const cb = document.createElement("input"); cb.id = "ps-trim-link"; cb.type = "checkbox";
      cb.addEventListener("change", actPsTrimLink);
      lb.appendChild(cb); lb.appendChild(document.createTextNode(" Buttons same as piping"));
      box.appendChild(lb);
    }
    psTrimLinkSync();
  }
  // Linked: the BUTTON row is grayed out and shows what is on BUTTON (PIPING's color).
  function psTrimLinkSync() {
    const on = psTrimLinked(), cb = $("ps-trim-link");
    if (cb) cb.checked = on;
    const row = $("ps-tc-row-buttons");
    if (!row) return;
    row.classList.toggle("ps-trim-linked", on);
    const inp = $("ps-tc-hex-buttons"); if (inp) inp.disabled = on;
    const g = $("pills-ps-tc-buttons"); if (g) g.classList.toggle("ps-disabled", on);
  }
  async function actPsTrimLink() {
    const cb = $("ps-trim-link");
    if (!cb) return;
    const on = !!cb.checked;
    const why = psTrimBlocked();
    if (why) {
      cb.checked = !on;                                            // said, not quiet: the checkbox stays as the canvas is
      setStatus("bad", why);
      return;
    }
    if (!on) {
      psTrimLink = false; await psTrimColorSave(); psTrimLinkSync();
      setStatus("ok", "BUTTON is on its own again, " + (psTrimColors.buttons || "Original") + ".");
      return;
    }
    const want = psTrimColors.piping || null, have = psTrimColors.buttons || null;
    psTrimLink = true; psTrimLinkSync();
    if (want === have || !psTrimBase("buttons")) {
      await psTrimColorSave();
      setStatus("ok", "BUTTON follows PIPING (" + (want || "Original") + ").");
      return;
    }
    if (!want) { await psTrimColorOriginal(["buttons"]); await psTrimColorSave(); setStatus("ok", "BUTTON follows PIPING: Original, no recolor."); return; }
    await psTrimColorRun("buttons", want, { link: true, kinds: ["buttons"] });   // BUTTON takes PIPING's color, at once
  }
  function psTrimColorFromBox(kind) {
    const box = $("ps-tc-hex-" + kind); if (!box) return;
    const raw = String(box.value || "").trim();
    const rgb = raw ? kbParseHex(raw) : null;
    if (raw && !rgb) { box.classList.add("ps-bad"); return; }       // invalid: red, nothing changes
    box.classList.remove("ps-bad");
    const hex = rgb ? psHex(rgb) : null;
    if (hex === psTrimColorShown(kind)) { box.value = hex || ""; return; }   // the same color (Enter, then leaving the box): once
    psTrimColorRun(kind, hex);
  }
  function psOnTrimColorChip(kind, value) {
    if (!PS_TRIM_KINDS[kind]) return;
    if (value === "custom") { actPsTrimColorCustom(null, kind); return; }
    psTrimColorRun(kind, value === "original" ? null : PS_TRIM_CHIPS[value]);
  }
  async function actPsTrimColor(srcEl) {
    const kind = srcEl && srcEl.getAttribute ? srcEl.getAttribute("data-trim") : null;
    if (kind && PS_TRIM_KINDS[kind]) psTrimColorFromBox(kind);
  }
  // Photoshop's color picker, starting at the trim's color. Click the canvas while it is
  // open to sample (for example the print's sage green).
  async function actPsTrimColorCustom(srcEl, kindIn) {
    const kind = kindIn || (srcEl && srcEl.getAttribute ? srcEl.getAttribute("data-trim") : null);
    const K = PS_TRIM_KINDS[kind];
    if (!K) return;
    if (kind === "buttons" && psTrimLinked()) { psTrimColorSync(kind); setStatus("bad", "BUTTON follows PIPING. Turn off Buttons same as piping to set it on its own."); return; }
    const why = psTrimBlocked();
    if (why) { setStatus("bad", why); return; }                     // checked before the picker opens
    if (!psTrimBase(kind)) { setStatus("bad", "There is no " + K.group + " group yet. Find " + psTrimWord(kind) + " in step 4 and Accept, then pick its color."); psTrimColorSync(kind); return; }
    const ps = psMod();
    const start = kbParseHex(psTrimColorShown(kind) || "#FFFFFF") || [255, 255, 255];
    let res = null;
    try {
      await ps.core.executeAsModal(async function () {
        res = await ps.action.batchPlay([{ _obj: "showColorPicker", context: "Print Swap " + K.group + " color",
          color: { _obj: "RGBColor", red: start[0], grain: start[1], blue: start[2] }, _options: { dialogOptions: "dontDisplay" } }], { synchronousExecution: false });
      }, { commandName: "KBImage — pick " + K.group + " color" });
    } catch (e) { traceErr("ps trims: color picker", e); setStatus("bad", "The color picker did not open: " + ((e && e.message) || String(e))); psTrimColorSync(kind); return; }
    const rgb = psPickerRgb(res && res[0]);
    if (!rgb) { setStatus("ok", K.group + ": nothing picked."); psTrimColorSync(kind); return; }
    psTrimColorRun(kind, psHex(rgb));
  }

  // ----- Order: trims above the GREY group; the veil (GREY copy 3) under the trims ----
  function psTopIndex(l) {
    try { const t = psMod().app.activeDocument.layers; for (let i = 0; i < t.length; i++) if (t[i].id === l.id) return i; } catch (_) {}
    return -1;
  }
  // The trim names, top → bottom.
  function psTrimNames() {
    return [PS_THREAD_NAME, PS_BUTTON_GRP].concat(Object.keys(PS_TRIM_KINDS).filter(psIsSamTrim).map(function (k) { return PS_TRIM_KINDS[k].group; })).concat([PS_PIPING_GRP]);
  }
  // The trims at the top level (older files), top → bottom.
  function psTrimTopLayers() {
    return psTrimNames().map(psTopLayerNamed).filter(Boolean).sort(function (a, b) { return psTopIndex(a) - psTopIndex(b); });
  }
  // Trim groups (and BUTTON THREAD) sitting directly in PS instead of in PB, top → bottom.
  function psTrimsInPs(P) {
    const names = psTrimNames(), out = [];
    try { Array.from(P.layers).forEach(function (l) { const n = String(l.name); if (names.indexOf(n) >= 0 && (l.layers || n === PS_THREAD_NAME)) out.push(l); }); } catch (_) {}
    return out;
  }
  // Inside executeAsModal: `list` (layers already in group G) in this order at the top of G,
  // each placed next to its neighbour, moving only what is out of place (never a move into
  // the group a layer is already in).
  function psOrderInGroup(G, list, mv) {
    const EP = psMod().constants.ElementPlacement;
    const ok = function () { const kids = Array.from(G.layers); return list.every(function (l, i) { return kids[i] && kids[i].id === l.id; }); };
    if (ok()) return;
    // Every move targets G itself (never a child): bottom one first, so each lands on top. If
    // Photoshop refuses "into the group it is already in", the layer steps out above G and back in.
    const into = function (l) { try { mv(l, G, EP.PLACEINSIDE); } catch (e) { mv(l, G, EP.PLACEBEFORE); mv(l, G, EP.PLACEINSIDE); } };
    for (let i = list.length - 1; i >= 0; i--) into(list[i]);
    if (!ok()) for (let i = 0; i < list.length; i++) into(list[i]);   // in case "inside" means the bottom
    const out = list.filter(function (l) { let p = null; try { p = l.parent; } catch (_) {} return !p || p.id !== G.id; });
    if (out.length) throw new Error(out.map(function (l) { return l.name; }).join(", ") + " did not land in " + G.name + ".");
  }
  // Inside executeAsModal: trims nested inside another trim group in PB (a trim group, or
  // BUTTON THREAD, below PB's own level) go back out to PB's level. Returns how many moved.
  function psPbFlattenInModal(dry) {
    const B = psPbGroup();
    if (!B) return 0;
    const EP = psMod().constants.ElementPlacement, names = psTrimNames(), nested = [];
    const walk = function (g, top) {
      let kids = []; try { kids = Array.from(g.layers || []); } catch (_) {}
      for (let i = 0; i < kids.length; i++) {
        const k = kids[i], n = String(k.name), grp = !!k.layers;
        if (top && ((grp && names.indexOf(n) >= 0) || n === PS_THREAD_NAME)) nested.push({ l: k, top: top });
        if (grp) walk(k, top || k);
      }
    };
    walk(B, null);
    if (dry) return nested.length;
    let n = 0;
    for (let i = 0; i < nested.length; i++) {
      const l = nested[i].l;
      try {
        l.move(B, EP.PLACEINSIDE);                            // into PB itself (the order is set after)
        let p = null; try { p = l.parent; } catch (_) {}
        if (!p || p.id !== B.id) throw new Error(l.name + " did not land in " + PS_PB_GROUP + ".");
        n++;
      } catch (e) { throw new Error("Moving " + l.name + " out of " + nested[i].top.name + " in " + PS_PB_GROUP + " failed — Photoshop said: " + ((e && e.message) || String(e))); }
    }
    if (n) trace("ps layout: " + n + " trim(s) nested in another trim group moved back to " + PS_PB_GROUP + "'s level: " + nested.map(function (x) { return x.l.name + " (in " + x.top.name + ")"; }).join(", "));
    return n;
  }
  // Inside executeAsModal: the team's structure, moving only what is out of place. Returns the
  // number of moves. PS is made from the first thing to go in (PARTS or the top trim), in its
  // place; an older file's top-level PARTS goes into PS and part groups loose in PS go into
  // PARTS; top-level or loose trims go into PB (made when needed); then PB is first in PS,
  // SDW right under it, PARTS below, Backup at the bottom.
  function psPassThrough(g) { try { const BM = psMod().constants.BlendMode; if (g && BM) g.blendMode = BM.PASSTHROUGH; } catch (e) { traceErr("ps layout: Pass Through", e); } }
  async function psLayoutFixInModal() {
    const EP = psMod().constants.ElementPlacement;
    const trims = psTrimTopLayers();
    let F = psPartsFolder();
    const fOk = !!(F && psPsParts(F).length && !psPsParts(F).some(function (g) { return psIsPending(g.id); }));   // not while a preview waits
    let P = psPsGroup();
    if (!P && !trims.length && !fOk) return 0;
    let moved = 0;
    const mv = function (l, rel, where) {
      try { if (where === EP.PLACEAFTER) kbPlaceAfterInModal(l, rel); else l.move(rel, where); moved++; }
      catch (e) { throw new Error("Moving " + l.name + " into " + PS_PS_GROUP + " failed — Photoshop said: " + ((e && e.message) || String(e))); }
    };
    const inP = function (l) { return !!(l && l.parent && l.parent.id === P.id); };
    if (!P) {
      P = kbLayerById(await psGroupInModal([(fOk ? F : trims[0]).id], PS_PS_GROUP));
      if (!P) throw new Error("the " + PS_PS_GROUP + " group could not be made.");
      psPassThrough(P); moved++;
    }
    // Parts: one PARTS folder in PS. A v0.19 file's top-level PARTS goes into PS; a v0.20.0
    // file's part groups loose in PS go into PARTS (made when needed).
    if (F && fOk && !inP(F)) mv(F, P, EP.PLACEINSIDE);
    const loose = psPsParts(P).filter(function (g) { return !psIsPending(g.id); });
    if (loose.length) {
      if (!F || !inP(F)) {
        F = kbLayerById(await psGroupInModal([loose[0].id], PS_PARTS_GROUP));
        if (!F) throw new Error("the " + PS_PARTS_GROUP + " group could not be made.");
        psPassThrough(F); moved++;
      }
      for (let i = 0; i < loose.length; i++) if (!loose[i].parent || loose[i].parent.id !== F.id) mv(loose[i], F, EP.PLACEINSIDE);
      psOrderInGroup(F, loose.map(function (g) { return kbLayerById(g.id); }).filter(Boolean), mv);
    }
    const tr = psTrimTopLayers().concat(psTrimsInPs(P));   // top level (older files) or loose in PS: into PB
    let B = psPbGroup();
    if (tr.length) {
      if (!B) {
        B = kbLayerById(await psGroupInModal([tr[0].id], PS_PB_GROUP));
        if (!B) throw new Error("the " + PS_PB_GROUP + " group could not be made.");
        psPassThrough(B); moved++;
        if (!inP(B)) mv(B, P, EP.PLACEINSIDE);
      }
      for (let i = 0; i < tr.length; i++) if (!tr[i].parent || tr[i].parent.id !== B.id) mv(tr[i], B, EP.PLACEINSIDE);
    }
    if (B) {                                                 // top → bottom: BUTTON THREAD, BUTTON, the SAM trims, PIPING; siblings, one level
      moved += psPbFlattenInModal();
      psOrderInGroup(B, psTrimNames().map(function (n) { return psChildNamed(B, n); }).filter(Boolean), mv);
      if (P.layers[0].id !== B.id) mv(B, P.layers[0], EP.PLACEBEFORE);
    }
    const S = psSdwGroup();
    if (S) {
      const at = B ? 1 : 0;
      if (!P.layers[at] || P.layers[at].id !== S.id) { if (B) mv(S, B, EP.PLACEAFTER); else mv(S, P.layers[0], EP.PLACEBEFORE); }
    }
    F = psPartsFolder();                                     // PARTS right under PB and SDW
    if (F && inP(F)) {
      const at = (B ? 1 : 0) + (S ? 1 : 0), up = S || B;
      if (!P.layers[at] || P.layers[at].id !== F.id) { if (up) mv(F, up, EP.PLACEAFTER); else mv(F, P.layers[0], EP.PLACEBEFORE); }
    }
    const bk = psBackupGroup();
    if (bk && P.layers[P.layers.length - 1].id !== bk.id) mv(bk, P.layers[P.layers.length - 1], EP.PLACEAFTER);   // Backup: always at the bottom
    if (moved) trace("ps layout: " + moved + " move(s): " + PS_PS_GROUP + " › " + PS_PB_GROUP + ", " + PS_SDW_GROUP + ", parts, " + PS_BACKUP_GROUP);
    return moved;
  }

  // ----- PB guard: steps 5 to 9 never delete, move or regroup anything inside PB ----------
  // PB's children (id and name), top → bottom; null when there is no PB.
  function psPbSnap() {
    const B = psPbGroup();
    if (!B) return null;
    try { return Array.from(B.layers).map(function (l) { return { id: l.id, name: String(l.name) }; }); } catch (_) { return null; }
  }
  // After a step 5 to 9 action: PB's children as in `before`? If not, what was moved out or
  // renamed is put back in place; a deleted layer cannot come back. Returns the red status
  // line ("PB changed: PIPING missing"), or null when PB is unchanged.
  async function psPbCheck(before) {
    if (!before || !before.length) return null;
    const now = psPbSnap() || [];
    if (now.length === before.length && now.every(function (c, i) { return c.id === before[i].id && c.name === before[i].name; })) return null;
    const gone = [], back = [];
    let reordered = 0;
    const added = now.filter(function (c) { return !before.some(function (b) { return b.id === c.id; }); }).map(function (c) { return c.name; });
    try {
      await psMod().core.executeAsModal(async function () {
        const B = psPbGroup(), EP = psMod().constants.ElementPlacement, list = [];
        for (let i = 0; i < before.length; i++) {
          const l = kbLayerById(before[i].id);
          if (!l || !B) { gone.push(before[i].name); continue; }
          if (String(l.name) !== before[i].name) { try { l.name = before[i].name; back.push(before[i].name); } catch (_) {} }
          if (!l.parent || l.parent.id !== B.id) { l.move(B, EP.PLACEINSIDE); if (back.indexOf(before[i].name) < 0) back.push(before[i].name); }
          list.push(l);
        }
        if (B) psOrderInGroup(B, list, function (l, rel, where) { l.move(rel, where); reordered++; });
      }, { commandName: "KBImage — put PB back" });
    } catch (e) { traceErr("ps PB guard: put back", e); }
    const msg = "PB changed: " + [gone.length ? gone.join(", ") + " missing" : "", back.length ? back.join(", ") + " put back" : (reordered ? "order put back" : ""), added.length ? added.join(", ") + " added" : ""]
      .filter(Boolean).join("; ") + ".";
    trace("ps PB guard: " + msg + " Before: " + before.map(function (b) { return b.name + " " + b.id; }).join(", ") + "; after: " + now.map(function (b) { return b.name + " " + b.id; }).join(", "));
    return msg;
  }
  // The panel actions of steps 5 to 9 (Accept / Re-run / Discard when the preview waiting is theirs).
  const PS_PB_GUARDED = { "ps-make-gray": 1, "ps-find-parts": 1, "ps-part-check": 1, "ps-part-add": 1, "ps-edit-part": 1, "ps-toggle-shapes": 1,
    "ps-choose-print": 1, "ps-apply-print": 1, "ps-print-reset": 1, "ps-part-adjust": 1, "ps-print-rotate": 1, "ps-build-shade": 1, "ps-finish": 1 };
  function psPbGuarded(name, srcEl) {
    if (PS_PB_GUARDED[name]) return true;
    if (name === "ps-edge-apply" || name === "ps-edge-refine") return !!(srcEl && srcEl.getAttribute && srcEl.getAttribute("data-target") === "part");
    if (/^recall-/.test(name)) { const d = pendingRecall && pendingRecall.descriptor; return !!(d && d.psStep >= 5); }
    return false;
  }

  // =======================================================================
  // PRINT SWAP — edge softness for every saved mask (KBPS garment,
  // KBPS part <NAME>, KBPS buttons, KBPS piping).
  //   Each channel C keeps a hard-edged copy "KBPS raw …". C = raw feathered
  //   by Edge softness (0–5 px). Apply rebuilds C from raw at the new value (no
  //   SAM, no cost). Touch-ups work on the hard version, then soften again, so
  //   hand edits survive Apply. Refine in Photoshop opens Select and Mask on C;
  //   its result becomes both raw and C (no extra feather on top).
  // =======================================================================
  function psRawName(ch) { return "KBPS raw " + String(ch).replace(/^KBPS /, ""); }
  // One Edge softness slider per Adjust: person (1), garment (2), piping and other trims (4), buttons (4), parts (6).
  const PS_EDGE_IDS = ["ps-edge-soft-person", "ps-edge-soft-garment", "ps-edge-soft-trims", "ps-edge-soft-buttons", "ps-edge-soft-parts"];
  function psEdgeSoftId(kind) { if (kind === "person") return "ps-edge-soft-person"; if (kind === "buttons") return "ps-edge-soft-buttons"; return kind === "part" ? "ps-edge-soft-parts" : (PS_TRIM_KINDS[kind] ? "ps-edge-soft-trims" : "ps-edge-soft-garment"); }
  function psEdgeSoft(kind) { return Math.round(kbNum(psEdgeSoftId(kind), 1, 0, 5) * 2) / 2; }
  function psEdgeSoftSync() {
    for (let i = 0; i < PS_EDGE_IDS.length; i++) {
      const sl = $(PS_EDGE_IDS[i]), lb = $(PS_EDGE_IDS[i] + "-val");
      if (lb) lb.textContent = (sl ? Number(sl.value) : 1) + " px";
    }
  }
  function psEdgesOnTabOpen() {
    for (let i = 0; i < PS_EDGE_IDS.length; i++) {
      const sl = $(PS_EDGE_IDS[i]);
      if (sl && !sl.__kbWired) { sl.__kbWired = true; sl.addEventListener("input", psEdgeSoftSync); sl.addEventListener("change", psEdgeSoftSync); }
    }
    psEdgeSoftSync();
  }

  // Inside executeAsModal: feather the live selection by px. Photoshop's exact error on failure.
  async function psFeatherSelectionInModal(px) {
    if (!(px > 0)) return;
    try {
      await psMod().action.batchPlay([{ _obj: "feather", radius: { _unit: "pixelsUnit", _value: px }, selectionModifyEffectAtCanvasBounds: false,
        _options: { dialogOptions: "dontDisplay" } }], { synchronousExecution: true });
    } catch (e) { throw new Error("Feathering the mask by " + px + " px failed — Photoshop said: " + ((e && e.message) || String(e))); }
  }
  // Inside executeAsModal: the current selection → channel ch (replaced; removed if empty).
  async function psSaveSelectionAsInModal(ch) {
    await kbRemoveChannels(ch);
    if (kbSelectionBounds()) await saveSelectionToChannel(ch);
  }
  // Inside executeAsModal: C was just saved hard → keep it as raw, then soften C.
  async function psSoftenAfterSaveInModal(ch, px) {
    if (!kbChannelExists(ch)) { await kbRemoveChannels(psRawName(ch)); return; }
    await kbLoadChannel(ch);
    await psSaveSelectionAsInModal(psRawName(ch));
    await psSoftenFromRawInModal(ch, px);
  }
  // Inside executeAsModal: C = raw feathered by px. No raw yet → the current C
  // becomes the raw first. A PART is softened only on the outside: C = raw (hard, shared
  // borders overlapping 1 px) ∩ the garment feathered by px, so where two parts meet the
  // border stays hard and nothing shows through; only the garment's outer edge goes soft.
  async function psSoftenFromRawInModal(ch, px) {
    const raw = psRawName(ch);
    if (!kbChannelExists(raw)) {
      if (!kbChannelExists(ch)) return;
      await kbLoadChannel(ch);
      await psSaveSelectionAsInModal(raw);
    }
    if (String(ch).indexOf(PS_PART_CH) === 0) {
      const gsrc = kbChannelExists(psRawName(PS_GARMENT_CH)) ? psRawName(PS_GARMENT_CH) : PS_GARMENT_CH;
      if (kbChannelExists(gsrc)) {
        const TMP = "KBPS_tmp_outer";
        await kbLoadChannel(gsrc);
        await psFeatherSelectionInModal(px);
        await psSaveSelectionAsInModal(TMP);
        await kbLoadChannel(raw);
        if (kbChannelExists(TMP)) await kbLoadChannel(TMP, "intersect");
        await psSaveSelectionAsInModal(ch);
        await kbRemoveChannels(TMP);
        try { await deselectAll(); } catch (_) {}
        return;
      }
    }
    await kbLoadChannel(raw);
    await psFeatherSelectionInModal(px);
    await psSaveSelectionAsInModal(ch);
    try { await deselectAll(); } catch (_) {}
  }
  // Inside executeAsModal: put the hard version back in C before a touch-up.
  async function psUnsoftenInModal(ch) {
    const raw = psRawName(ch);
    if (!kbChannelExists(raw)) { if (kbChannelExists(ch)) { await kbLoadChannel(ch); await psSaveSelectionAsInModal(raw); } return; }
    await kbLoadChannel(raw);
    await psSaveSelectionAsInModal(ch);
  }
  // Outside a modal: soften a list of just-saved channels.
  async function psSoftenAfterSave(chs, what, kind) {
    const px = psEdgeSoft(kind);
    await psMod().core.executeAsModal(async function () {
      for (let i = 0; i < chs.length; i++) await psSoftenAfterSaveInModal(chs[i], px);
      try { await deselectAll(); } catch (_) {}
    }, { commandName: "KBImage — soften " + what });
    trace("ps edges: " + what + " softened " + px + " px (" + chs.length + " channel(s))");
  }

  // Which mask the Edges controls act on.
  function psEdgeTarget(srcEl) {
    const t = (srcEl && srcEl.getAttribute && srcEl.getAttribute("data-target")) || "garment";
    if (t === "person") return { kind: "person", ch: PS_PERSON_CH, label: "person" };
    if (t === "piping") return { kind: "piping", ch: PS_PIPING_CH, label: "piping" };
    if (t === "buttons") return { kind: "buttons", ch: PS_BUTTONS_CH, label: "buttons" };
    if (psIsSamTrim(t)) return { kind: t, ch: PS_TRIM_KINDS[t].ch, label: PS_TRIM_KINDS[t].group.toLowerCase() };
    if (t === "part") {
      const name = readPills("pills-ps-parts", null);
      return name ? { kind: "part", ch: PS_PART_CH + name, label: name, part: name } : { kind: "part", ch: null, label: "part" };
    }
    return { kind: "garment", ch: PS_GARMENT_CH, label: "garment" };
  }
  // After a mask changed: what is built from it follows (part shape, trim group).
  async function psAfterMaskChanged(t) {
    if (t.kind === "person") {                                  // MODEL / BG LIGHTEN follow KBPS person
      const model = psTopLayerNamed(PS_MODEL_NAME), bg = psBgLayer();
      if (!model && !bg) return "";
      await psMod().core.executeAsModal(async function () {
        if (model) await psMaskLayerToChannelInModal(model.id, PS_PERSON_CH, PS_MODEL_NAME, 0);
        if (bg) await psMaskInverseOfPersonInModal(bg.id);
      }, { commandName: "KBImage — background mask" });
      return model ? " MODEL follows it." : " BG LIGHTEN follows it.";
    }
    if (t.kind === "part" && psPartsGroup()) {
      await psMod().core.executeAsModal(async function () { await psRedrawShapeInModal(t.part); }, { commandName: "KBImage — redraw part" });
      return "";
    }
    if (PS_TRIM_KINDS[t.kind] && psTrimGroupNamed(PS_TRIM_KINDS[t.kind].group)) {
      const r = await psBuildTrimGroup(t.kind, "edges");
      return " " + r.msg;
    }
    return t.kind === "garment" ? " Layers already masked to the garment keep their old mask until they are made again." : "";
  }

  async function actPsEdgeApply(srcEl) {
    if (generateInFlight) { kbBusyNote(); return; }
    const ps = psMod();
    if (!ps.app.activeDocument) { setStatus("bad", "Open a Photoshop document first."); return; }
    const t = psEdgeTarget(srcEl);
    if (!t.ch) { setStatus("bad", "Click a part in the list in step 6 first."); return; }
    if (!kbChannelExists(t.ch) && !kbChannelExists(psRawName(t.ch))) { setStatus("bad", "There is no " + t.label + " mask yet (" + t.ch + ")."); return; }
    const px = psEdgeSoft(t.kind);
    generateInFlight = true;
    traceStart("Print Swap — edge softness " + px + " px on " + t.ch);
    try {
      await ps.core.executeAsModal(async function () {
        await psSoftenFromRawInModal(t.ch, px);
        if (kbChannelExists(t.ch)) await kbLoadChannel(t.ch);
      }, { commandName: "KBImage — edge softness" });
      const rec = logRecordSkeleton("printswap:edge-soft", { channel: t.ch, px: px }, null, "channel:" + t.ch);
      await logRun(rec);
      await logFinalizeCommitted(rec.id);
      generateInFlight = false;
      const more = await psAfterMaskChanged(t);
      let st = [];
      if (t.kind === "garment") { st = await psGarmentChanged(); await psGarmentSnapTake(); psStepsRefresh(); }
      setStatus("ok", "The " + t.label + " mask is softened " + px + " px (from its unsoftened copy, no SAM)." + more + psStaleMsg(st));
    } catch (err) {
      traceErr("ps edge apply", err);
      setStatus("bad", "Could not soften the " + t.label + " mask: " + ((err && err.message) || String(err)));
    } finally {
      generateInFlight = false;
      await traceFlush();
    }
  }

  // Photoshop's own Select and Mask on the chosen mask; the result goes back to it.
  async function actPsEdgeRefine(srcEl) {
    if (generateInFlight) { kbBusyNote(); return; }
    const ps = psMod();
    if (!ps.app.activeDocument) { setStatus("bad", "Open a Photoshop document first."); return; }
    const t = psEdgeTarget(srcEl);
    if (!t.ch) { setStatus("bad", "Click a part in the list in step 6 first."); return; }
    if (!kbChannelExists(t.ch)) { setStatus("bad", "There is no " + t.label + " mask yet (" + t.ch + ")."); return; }
    generateInFlight = true;
    traceStart("Print Swap — Select and Mask on " + t.ch);
    let opened = false;
    try {
      setStatus("busy", "Select and Mask is open in Photoshop. Refine the " + t.label + ", then click OK there.");
      await ps.core.executeAsModal(async function () {
        await kbLoadChannel(t.ch);
        try {
          await ps.action.batchPlay([{ _obj: "smartBrushWorkspace",
            presetKind: { _enum: "presetKindType", _value: "presetKindCustom" },
            smartBrushRadius: 0, smartBrushSmooth: 0,
            smartBrushFeather: { _unit: "pixelsUnit", _value: 0 },
            smartBrushContrast: { _unit: "percentUnit", _value: 0 },
            smartBrushShiftEdge: { _unit: "percentUnit", _value: 0 },
            sampleAllLayers: false, smartBrushUseSmartRadius: false, smartBrushDecontaminate: false,
            refineEdgeOutput: { _enum: "refineEdgeOutput", _value: "selectionOutputToSelection" },
            _options: { dialogOptions: "display" } }], {});
          opened = true;
        } catch (e) {
          if (/cancel/i.test(String((e && e.message) || e))) throw new Error("Select and Mask was cancelled; the " + t.label + " mask was not changed.");
          throw new Error("Photoshop did not let the plug-in open Select and Mask (" + ((e && e.message) || String(e)) + "). Use Select > Select and Mask yourself on the loaded selection, then + Add.");
        }
        if (!kbSelectionBounds()) throw new Error("Select and Mask returned an empty selection; the " + t.label + " mask was not changed.");
        await psSaveSelectionAsInModal(psRawName(t.ch));      // the refined edge is the new base
        await psSaveSelectionAsInModal(t.ch);
      }, { commandName: "KBImage — Select and Mask", interactive: true });
      const rec = logRecordSkeleton("printswap:select-and-mask", { channel: t.ch }, null, "channel:" + t.ch);
      await logRun(rec);
      await logFinalizeCommitted(rec.id);
      generateInFlight = false;
      const more = await psAfterMaskChanged(t);
      let st = [];
      if (t.kind === "garment") { st = await psGarmentChanged(); await psGarmentSnapTake(); psStepsRefresh(); }
      setStatus("ok", "The " + t.label + " mask was refined in Select and Mask and saved to " + t.ch + "." + more + psStaleMsg(st));
    } catch (err) {
      traceErr("ps select and mask (opened: " + opened + ")", err);
      setStatus("bad", (err && err.message) || "Select and Mask failed.");
    } finally {
      generateInFlight = false;
      await traceFlush();
    }
  }

  // =======================================================================
  // PRINT SWAP PANEL — nine collapsible steps, one open at a time.
  //   1 Background · 2 Garment · 3 Remove print · 4 Trims · 5 Gray · 6 Parts ·
  //   7 Print and Color · 8 Shading · 9 Finish. Each header shows locked / ready / done ✓,
  //   read from the document (a preview still waiting does not count as done).
  //   The panel's single recall bar is moved under the button of the step that
  //   ran; Accept collapses that step and opens the next.
  // =======================================================================
  const PS_STEP_COUNT = 9;
  let psOpenStep = null;

  // ----- garment edits made obvious --------------------------------
  // Out of date: steps 3–9 that were done when KBPS garment changed. Nothing is
  // deleted; the step shows "out of date" and its Redo link is highlighted. Kept in
  // the document (kbps:state "garmentStale"); a step leaves the list when it is
  // accepted again or is no longer done (Redo, Start over, layers deleted by hand).
  let psStaleSteps = [], psStaleDocId = null;
  function psActiveDocId() { try { const d = psMod().app.activeDocument; return d ? d.id : null; } catch (_) { return null; } }
  async function psStaleSave() {
    try {
      const st = await psStateLoad();
      if (psStaleSteps.length) st.garmentStale = psStaleSteps.slice(); else delete st.garmentStale;
      await psStateSave(st);
    } catch (e) { traceErr("ps: save out-of-date steps", e); }
  }
  // KBPS garment just changed: mark the steps already done on the old garment.
  async function psGarmentChanged() {
    const done = [];
    for (let n = 3; n <= PS_STEP_COUNT; n++) if (psStepState(n) === "done") done.push(n);
    if (!done.length) return [];
    psStaleDocId = psActiveDocId();
    psStaleSteps = psStaleSteps.concat(done).filter(function (n, i, a) { return a.indexOf(n) === i; }).sort(function (a, b) { return a - b; });
    trace("ps: garment changed; out of date → steps " + psStaleSteps.join(", "));
    await psStaleSave();
    return done;
  }
  function psStaleMsg(done) {
    if (!done || !done.length) return "";
    const list = done.length === 1 ? "Step " + done[0] + " was" : "Steps " + done.slice(0, -1).join(", ") + " and " + done[done.length - 1] + " were";
    return " " + list + " made with the old garment and " + (done.length === 1 ? "is" : "are") + " marked out of date. Use Redo to make " + (done.length === 1 ? "it" : "them") + " again; nothing was deleted.";
  }
  function psStaleClear(n) {
    const i = psStaleSteps.indexOf(n);
    if (i < 0) return;
    psStaleSteps.splice(i, 1);
    psStaleSave();
  }

  // Selection note: step 2 done, and the selection on screen is not KBPS garment.
  // The panel cannot read a channel without loading it, so it remembers what the
  // garment looked like as a selection the last time the panel itself loaded it
  // (bounds + a 256 px wide copy), and compares the current selection to that.
  let psGarmentSnap = null, psSelFpMode = null, psUserSel = false, psPanelSelAt = 0, psGarmentNoteSeq = 0, psGarmentNoteTimer = null;
  function psBoundsKey(b) { return b ? [b.left, b.top, b.right, b.bottom].map(function (v) { return Math.round(Number(v)); }).join(",") : ""; }
  async function psSelFingerprint() {
    const ps = psMod();
    let doc = null; try { doc = ps.app.activeDocument; } catch (_) {}
    if (!doc || psSelFpMode === "none" || !ps.imaging || typeof ps.imaging.getSelection !== "function") return null;
    const W = Math.round(Number(doc.width)), H = Math.round(Number(doc.height));
    if (!(W > 0 && H > 0)) return null;
    const tw = Math.min(256, W), th = Math.max(1, Math.round(H * tw / W));
    const opts = { documentID: doc.id, sourceBounds: { left: 0, top: 0, right: W, bottom: H }, targetSize: { width: tw, height: th } };
    const read = async function () {
      const r = await ps.imaging.getSelection(opts);
      const img = r && r.imageData;
      if (!img) throw new Error("getSelection returned no imageData.");
      try { const d = await img.getData({ chunky: true }); return { w: img.width, h: img.height, d: new Uint8Array(d) }; }
      finally { try { img.dispose(); } catch (_) {} }
    };
    if (psSelFpMode !== "modal") {
      try { const fp = await read(); psSelFpMode = "plain"; return fp; } catch (e) { if (psSelFpMode === "plain") return null; }
    }
    try {
      let fp = null;
      await ps.core.executeAsModal(async function () { fp = await read(); }, { commandName: "KBImage — read selection" });
      psSelFpMode = "modal"; return fp;
    } catch (e) {
      psSelFpMode = "none";                              // bounds only from now on
      try { trace("ps: imaging.getSelection unavailable, garment note compares bounds only: " + ((e && e.message) || e)); } catch (_) {}
      return null;
    }
  }
  // true / false, or null when it cannot tell.
  function psSelDiffers(a, b) {
    if (!a || !b) return null;
    if (a.w !== b.w || a.h !== b.h || a.d.length !== b.d.length) return true;
    for (let k = 0; k < a.d.length; k++) if (Math.abs(a.d[k] - b.d[k]) > 16) return true;
    return false;
  }
  async function psGarmentSnapTake() {
    try {
      const b = kbSelectionBounds();
      psGarmentSnap = b ? { docId: psActiveDocId(), b: psBoundsKey(b), fp: await psSelFingerprint() } : null;
    } catch (_) { psGarmentSnap = null; }
    psUserSel = false;
    psGarmentNoteSet(false);
  }
  function psGarmentNoteSet(show) { const el = $("ps-garment-note"); if (el) el.classList.toggle("hidden", !show); }
  async function psGarmentNoteCheck() {
    const seq = ++psGarmentNoteSeq;
    let show = false;
    try {
      const docId = psActiveDocId();
      if (psUserSel && docId != null && !generateInFlight && psGarmentSnap && psGarmentSnap.docId === docId && psStepState(2) === "done") {
        const b = kbSelectionBounds();
        if (b) {
          if (psBoundsKey(b) !== psGarmentSnap.b) show = true;
          else if (psGarmentSnap.fp) show = psSelDiffers(await psSelFingerprint(), psGarmentSnap.fp) === true;
        }
      }
    } catch (_) { show = false; }
    if (seq === psGarmentNoteSeq) psGarmentNoteSet(show);
    return show;
  }
  // Photoshop selection events. One the panel made (while it works, or just after it
  // loaded a channel) is not the user's: no note for it.
  const PS_SEL_EVENTS = ["set", "addTo", "subtractFrom", "intersectWith", "inverse", "feather", "expand", "contract", "grow", "similar", "smoothness", "border", "autoCutout"];
  function psOnSelectionEvent(ev, desc) {
    if (ev === "set") { let t = ""; try { t = JSON.stringify((desc && desc._target) || ""); } catch (_) {} if (t.indexOf("selection") < 0) return; }
    psUserSel = !generateInFlight && Date.now() - psPanelSelAt > 1500;
    if (psGarmentNoteTimer) clearTimeout(psGarmentNoteTimer);
    psGarmentNoteTimer = setTimeout(function () { psGarmentNoteTimer = null; psGarmentNoteCheck(); }, 400);
  }
  function registerSelectionListener() {
    try {
      const ps = psMod();
      if (!ps.action || typeof ps.action.addNotificationListener !== "function") return;
      try { ps.action.addNotificationListener(PS_SEL_EVENTS, psOnSelectionEvent); }
      catch (e1) { ps.action.addNotificationListener(PS_SEL_EVENTS.map(function (n) { return { event: n }; }), psOnSelectionEvent); }
    } catch (e) { try { console.warn(TAG, "[ps] selection listener not registered:", e); } catch (_) {} }
  }

  function psIsPending(id) { return !!(pendingRecall && (pendingRecall.layerIds || []).indexOf(id) >= 0); }
  function psHasAcceptedTop(name) { const l = psTopLayerNamed(name); return !!(l && !psIsPending(l.id)); }
  // Step 4's trim groups for the picked type: { have, missing } (group names). They count in
  // PS › PB (a v0.19 file with no PS: at the top level), accepted, as groups.
  function psTrimGroupsState() {
    const P = psPsGroup(), B = psPbGroup(), have = [], missing = [];
    psTypeTrimKinds().forEach(function (k) {
      const g = PS_TRIM_KINDS[k].group, l = P ? (B ? psChildNamed(B, g) : null) : psTopLayerNamed(g);
      if (l && l.layers && !psIsPending(l.id)) have.push(g); else missing.push(g);
    });
    return { have: have, missing: missing };
  }
  // A trim group gone after the work went on (some there, one missing, steps 5+ started):
  // "PIPING missing: Redo step 4", else null. Steps 5 to 9 show it instead of their own errors.
  function psTrimsMissingText() {
    try {
      const t = psTrimGroupsState();
      if (!t.have.length || !t.missing.length || !psGreyExactLayers().length) return null;
      return t.missing.join(", ") + " missing: Redo step 4.";
    } catch (_) { return null; }
  }
  function psStepState(n) {
    let garment = false, grey = false, parts = false;
    try {
      if (!psMod().app.activeDocument) return "locked";
      garment = kbChannelExists(PS_GARMENT_CH);
      grey = psGreyExactLayers().some(function (g) { return !psIsPending(g.id); });   // a new preview over it changes nothing
      parts = psPartsAccepted();
    } catch (_) { return "locked"; }
    const white = psHasAcceptedTop(PS_BG_NAME) || (psHasAcceptedTop(PS_MODEL_NAME) && psHasAcceptedTop(PS_WHITE_NAME));
    const up = psUpValue();
    if (n === 0) return white ? "locked" : (up === "done" || up === "skipped" || up === "kept" ? up : "ready");
    if (n === 1) return white ? "done" : (up === "done" || up === "skipped" || up === "kept" ? "ready" : "locked");
    if (n === 2) return garment ? "done" : (white ? "ready" : "locked");
    if (n === 3) return psAcceptedCleanId() != null ? "done" : (garment ? "ready" : "locked");
    if (n === 4) {                                          // done only when every trim group of the type is in PS › PB
      const t = psTrimGroupsState();
      if (t.have.length && !t.missing.length) return "done";
      if (psTrimsMissingText()) return "missing";
      return garment ? "ready" : "locked";
    }
    if (n === 5) return grey ? "done" : (garment ? "ready" : "locked");
    if (n === 6) return parts ? "done" : (grey ? "ready" : "locked");
    if (n === 7) {
      const printed = parts && psPartNames().some(function (nm) { return psPrintIds(nm).some(function (id) { return !psIsPending(id); }); });
      return printed ? "done" : (parts ? "ready" : "locked");
    }
    if (n === 8) return psAccepted(psSdwGroup()) || psHasAcceptedTop(PS_SHADE_GROUP) ? "done" : (parts ? "ready" : "locked");
    return psHasAcceptedTop(PS_MERGED_NAME) || psHasAcceptedTop(PS_MERGED_GROUP) ? "done" : (parts ? "ready" : "locked");
  }
  function psStepsRefresh() {
    try { psGtypeFollowDoc(); } catch (_) {}
    try { psUpKeptSync(); } catch (_) {}                     // an UPSCALE layer always counts as kept
    try { psPrintButtonSync(); } catch (_) {}                 // Swap print
    const gt = psGtypeById(psGarmentType);
    const s0 = $("ps-step-state-0");
    if (s0) {
      const st0 = psStepState(0);
      s0.textContent = st0 === "locked" ? "Start over to upscale" : (st0 === "done" ? "done ✓" : (st0 === "kept" ? "done ✓ · UPSCALE kept" : st0));
      s0.className = "ps-step-state ps-step-" + (st0 === "skipped" || st0 === "kept" ? "done" : st0);
      const paid0 = st0 === "done" ? psStepPaidUsd(0) : 0;   // Upscale accepted: what it cost
      let p0 = s0.nextSibling && s0.nextSibling.classList && s0.nextSibling.classList.contains("ps-step-paid") ? s0.nextSibling : null;
      if (paid0 && !p0) { p0 = document.createElement("span"); p0.className = "ps-step-paid ps-price"; s0.parentNode.insertBefore(p0, s0.nextSibling); }
      if (p0) { if (paid0) p0.textContent = " · " + fmtUSD(paid0); else p0.parentNode.removeChild(p0); }
    }
    try { psUpFaceSync(); } catch (_) {}
    for (let n = 1; n <= PS_STEP_COUNT; n++) {
      const el = $("ps-step-state-" + n);
      if (!el) continue;
      const st = psStepState(n);
      // out of date: done on an older garment. Not done any more → off the list.
      let stale = psStaleSteps.indexOf(n) >= 0 && psStaleDocId === psActiveDocId();
      if (stale && st !== "done" && psActiveDocId() != null) { psStaleClear(n); stale = false; }
      stale = stale && st === "done";
      const miss = st === "missing" ? psTrimsMissingText() : null;
      const paid = st === "done" && !stale ? psStepPaidUsd(n) : 0;
      el.textContent = (miss ? miss.replace(/\.$/, "") : (stale ? "out of date" : (st === "done" ? "done ✓" : st))) + (n === 2 && gt ? " · " + psGtypeShort(gt) : "");
      el.className = "ps-step-state ps-step-" + (miss ? "missing" : (stale ? "stale" : st));
      let pe = el.nextSibling && el.nextSibling.classList && el.nextSibling.classList.contains("ps-step-paid") ? el.nextSibling : null;
      if (paid && !pe) { pe = document.createElement("span"); pe.className = "ps-step-paid ps-price"; el.parentNode.insertBefore(pe, el.nextSibling); }
      if (pe) { if (paid) pe.textContent = " · " + fmtUSD(paid); else pe.parentNode.removeChild(pe); }
      const rd = $("ps-step-redo-" + n);                   // Redo on a done step (and on step 4 with a trim missing)
      if (rd) { rd.classList.toggle("hidden", st !== "done" && !miss); rd.classList.toggle("ps-redo-hot", stale || !!miss); }
    }
    if (psStepState(2) !== "done") psGarmentNoteSet(false);
    try { psPriceSync(); } catch (_) {}
    try { psShadeStrengthWire(); } catch (_) {}
  }
  function psStepOpen(n) {
    const was = psOpenStep;
    psOpenStep = n == null ? null : n;                       // step 0 is a real step
    if (psOpenStep === 8 && was !== 8) psToneSoon();         // Light / Dark print picked from the print
    for (let i = 0; i <= PS_STEP_COUNT; i++) {
      const b = $("ps-step-body-" + i), h = $("ps-step-" + i);
      if (b) b.classList.toggle("hidden", i !== psOpenStep);
      if (h) h.classList.toggle("ps-step-open", i === psOpenStep);
    }
  }
  // The first step that is ready (not done, not locked).
  function psCurrentStep() {
    for (let n = 0; n <= PS_STEP_COUNT; n++) { const st = psStepState(n); if (st === "ready" || st === "kept") return n; }
    return null;
  }
  function psStepsOnTabOpen() {
    psStepsRefresh();
    if (psOpenStep == null) psStepOpen(psCurrentStep() != null ? psCurrentStep() : 1);
  }
  function actPsStepToggle(srcEl) {
    const raw = srcEl && srcEl.getAttribute ? srcEl.getAttribute("data-step") : null, n = Number(raw);
    if (raw == null || raw === "" || !(n >= 0)) return;
    psStepsRefresh();
    psStepOpen(psOpenStep === n ? null : n);
  }
  function actPsToggleSettings(srcEl) {
    const id = srcEl && srcEl.getAttribute && srcEl.getAttribute("data-target");
    const box = id ? $(id) : null;
    if (!box) return;
    const open = box.classList.contains("hidden");
    box.classList.toggle("hidden", !open);
    const ar = $(id + "-arrow"); if (ar) ar.textContent = open ? "▾" : "▸";
  }
  // Run a Print Swap step through the recall wrapper with its Accept / Re-run
  // directly under that step's button; Accept closes it and opens the next.
  async function psRecall(step, anchorId, descriptor) {
    const bar = $("ps-recall-bar"), anchor = $(anchorId);
    if (bar && anchor && bar.parentNode !== anchor) anchor.appendChild(bar);
    descriptor.psStep = step;                              // named when this preview blocks another step
    if (psOpenStep !== step) psStepOpen(step);
    const orig = descriptor.onSettle;
    descriptor.psAnchor = anchorId;
    {                                                       // what this run charges goes on the step's Charged badge
      const runC = descriptor.execute;
      descriptor.execute = async function (params) {
        const doc = psActiveDocId(), cont = kbChargeContinue === anchorId;
        kbChargeContinue = null;
        if (!cont || !psCharged[anchorId] || psCharged[anchorId].docId !== doc) psCharged[anchorId] = { usd: 0, runs: 0, docId: doc, step: step };
        const c = psCharged[anchorId], before = c.usd;
        psChargeTo = anchorId;
        try { return await runC(params); }
        finally { psChargeTo = null; if (c.usd > before) c.runs++; psChargedShow(anchorId); }
      };
    }
    if (step >= 5) {                                        // a preview that changed PB is stopped: PB put back, the preview deleted
      const run0 = descriptor.execute;
      descriptor.execute = async function (params) {
        const pb = psPbSnap();
        const r = await run0(params);
        const bad = await psPbCheck(pb);
        if (bad) {
          const ids = (r && Array.isArray(r.layerIds) ? r.layerIds : []).filter(function (x) { return x != null; });
          if (ids.length) { try { await deleteLayersById(ids); } catch (_) {} }
          throw new Error(bad);
        }
        return r;
      };
    }
    const afterFinish = step === 7 || step === 8;          // Print / Shading after Finish: MERGED follows
    if (afterFinish) {
      const run = descriptor.execute;
      descriptor.execute = async function (params) {
        await psMergedHide();
        try { return await run(params); }
        catch (e) { await psMergedRestore(); throw e; }
      };
    }
    descriptor.onSettle = async function (state, accepted) {
      const own = orig ? await orig(state, accepted) : null;
      let msg = typeof own === "string" ? own : null;     // a step may name what Accept did
      if (afterFinish) {
        try { msg = accepted ? await psMergedRebuild() : (await psMergedRestore(), null); }
        catch (e) { msg = accepted ? "MERGED could not be rebuilt (" + ((e && e.message) || String(e)) + "). Run Finish again." : null; psMergedNote(msg); }
      }
      if (accepted) psChargedAccepted(anchorId);
      if (accepted) psStepAccepted(step, anchorId);
      try { psStepsRefresh(); } catch (_) {}                // step 7 / 8 and step 9 done ✓ again
      return msg;
    };
    return runWithRecall(descriptor);
  }
  // ----- Money: neon green, used for nothing else ------------------------------------
  // Charged badge under a step's Accept / Re-run / Discard: what its runs really cost, added
  // up over Re-runs, kept whatever is clicked (Discard too). A new run starts it again.
  const psCharged = {};                 // anchorId → { usd, runs, docId, step }
  let psChargeTo = null;                // the anchor of the run in progress
  const psStepPaid = {};                // "docId:step" → accepted total, shown after done ✓
  function psChargeAdd(usd) {
    const c = psChargeTo && psCharged[psChargeTo];
    if (!c) return;
    c.usd += usd;
    psChargedShow(psChargeTo);
  }
  function psChargedShow(anchorId) {
    const a = $(anchorId); if (!a) return;
    const c = psCharged[anchorId];
    let el = null; const kids = a.children || [];
    for (let i = 0; i < kids.length; i++) if (kids[i].classList && kids[i].classList.contains("ps-charged")) el = kids[i];
    if (!c || !(c.usd > 0) || c.docId !== psActiveDocId()) { if (el) el.parentNode.removeChild(el); return; }
    if (!el) { el = document.createElement("div"); el.className = "ps-charged ps-price"; a.appendChild(el); }
    el.textContent = "● Charged " + fmtUSD(c.usd) + (c.runs > 1 ? " (" + c.runs + " runs)" : "");
  }
  function psChargedAccepted(anchorId) {
    const c = psCharged[anchorId];
    if (!c || !(c.usd > 0) || c.docId !== psActiveDocId()) return;
    const k = c.docId + ":" + c.step;
    psStepPaid[k] = (psStepPaid[k] || 0) + c.usd;        // step 4: every trim's runs together
  }
  function psStepPaidUsd(n) { const v = psStepPaid[psActiveDocId() + ":" + n]; return v > 0 ? v : 0; }
  function psStepPaidClear(from) { const d = psActiveDocId() + ":"; Object.keys(psStepPaid).forEach(function (k) { if (k.indexOf(d) === 0 && Number(k.slice(d.length)) >= from) delete psStepPaid[k]; }); }
  // Price lines under the paid buttons: neon green when they name a price ("$"); "Photoshop · free" stays gray.
  const PS_PRICE_IDS = ["ps-up-cost", "ps-white-cost", "ps-find-cost", "ps-clean-cost", "ps-buttons-cost", "ps-parts-cost"];
  function psPriceSync() {
    const els = PS_PRICE_IDS.map($).filter(Boolean);
    const box = $("ps-trim-blocks-sam");
    if (box) { const cs = box.querySelectorAll(".ps-cost"); for (let i = 0; i < cs.length; i++) els.push(cs[i]); }
    els.forEach(function (el) { el.classList.toggle("ps-price", /\$\d/.test(String(el.textContent || ""))); });
  }
  function psStepAccepted(step, anchorId) {
    psStepsRefresh();
    // Step 4 stays open until its last trim (for the picked garment type) is accepted.
    if (String(anchorId).indexOf("ps-recall-anchor-4") === 0) {
      const kinds = psTypeTrimKinds();
      if (!kinds.length || anchorId !== psTrimAnchor(kinds[kinds.length - 1])) return;
    }
    psStaleClear(step);                                    // made again on the current garment
    psStepsRefresh();
    psStepOpen(step < PS_STEP_COUNT ? step + 1 : null);
  }

  // =======================================================================
  // PRINT SWAP — step 0 UPSCALE (optional). Never runs by itself.
  //   Topaz on Fal (the v0.18 upscaler, same Fal key): the photo layer ×2 (×4 when ×2
  //   stays under 4000 px), the document resized so the long edge is 4000–6000 px, the
  //   result placed as UPSCALE right above the photo, the original kept below it,
  //   hidden. From then on UPSCALE is the photo for every later step. Discard / Re-run
  //   go back in History to before the run (original pixels and size, shown again).
  //   Step 1 waits until step 0 is accepted or skipped; once step 1 is done step 0 is
  //   locked (Start over clears it). The choice is saved in the document's state, with
  //   the sizes and scale of the run (upInfo). Start over keeps UPSCALE: step 0 then
  //   reads "done ✓ · UPSCALE kept" with Keep and continue, Upscale again (UPSCALE
  //   deleted, the original shown and sized back, then upscaled — never UPSCALE
  //   itself) and Remove upscale (the same, without the new run).
  // =======================================================================
  const PS_UP_PATH  = "fal-ai/topaz/upscale/image";
  const PS_UP_MODEL = "Standard V2";
  const PS_UP_NAME  = "UPSCALE";
  // The accepted UPSCALE layer (top level, not a preview still waiting), else null.
  function psUpscaleLayer() {
    try {
      const t = psMod().app.activeDocument.layers;
      for (let i = 0; i < t.length; i++) if (String(t[i].name) === PS_UP_NAME && !t[i].layers && !psIsPending(t[i].id)) return t[i];
    } catch (_) {}
    return null;
  }
  const PS_UP_MIN = 4000, PS_UP_MAX = 6000;
  let psUpDoc = { docId: null, v: null, info: null };  // this document's step 0: "done" | "skipped" | "kept" | null
  function psUpValue() { return psUpDoc.docId != null && psUpDoc.docId === psActiveDocId() ? psUpDoc.v : null; }
  function psUpInfo() { return psUpDoc.docId != null && psUpDoc.docId === psActiveDocId() ? psUpDoc.info : null; }
  function psUpSet(v, info) { psUpDoc = { docId: psActiveDocId(), v: v || null, info: info !== undefined ? info : psUpInfo() }; }
  // "Topaz ×2, 998 × 2048 → 1996 × 4096" from the sizes saved when step 0 ran.
  function psUpKeptText() {
    const i = psUpInfo(), up = psUpscaleLayer();
    if (i && i.fromW) return "Topaz ×" + i.factor + ", " + i.fromW + " × " + i.fromH + " → " + i.toW + " × " + i.toH;
    let w = 0, h = 0; try { const d = psMod().app.activeDocument; w = Math.round(d.width); h = Math.round(d.height); } catch (_) {}
    return up ? w + " × " + h : "";
  }
  // Topaz on Fal: $0.08 per image up to 24 MP out, doubling for each doubling of size.
  function psUpPrice(outW, outH) { const mp = outW * outH / 1e6; return mp <= 24 ? 0.08 : 0.08 * Math.pow(2, Math.ceil(Math.log(mp / 24) / Math.LN2)); }
  // { factor, outW, outH (what Topaz returns), w, h (the document after), costUsd }
  function psUpPlan(docW, docH) {
    const L = Math.max(docW, docH), factor = 2 * L >= PS_UP_MIN ? 2 : 4;
    const outW = docW * factor, outH = docH * factor, fit = Math.min(1, PS_UP_MAX / (L * factor));
    return { factor: factor, outW: outW, outH: outH, w: Math.round(outW * fit), h: Math.round(outH * fit), costUsd: psUpPrice(outW, outH) };
  }
  function psUpSizeNote(L) { return L < 3000 ? "Small: upscale recommended" : (L < 4000 ? "OK" : "Good: no upscale needed"); }
  function psUpFaceSync() {
    const kept = psStepState(0) === "kept", fresh = $("ps-up-fresh"), kb = $("ps-up-kept");
    if (fresh) fresh.classList.toggle("hidden", kept);
    if (kb) kb.classList.toggle("hidden", !kept);
    const kl = $("ps-up-kept-line"); if (kl) kl.textContent = kept ? "UPSCALE kept (" + psUpKeptText() + ")." : "";
    const sz = $("ps-up-size"), note = $("ps-up-note"), cost = $("ps-up-cost"), btn = $("ps-up-btn"), skip = $("ps-up-skip");
    let doc = null; try { doc = psMod().app.activeDocument; } catch (_) {}
    const st = psStepState(0), busy = st === "locked" || !doc;
    if (btn) btn.classList.toggle("disabled", busy);
    if (skip) skip.classList.toggle("disabled", !doc);    // Skip never blocks
    if (!doc) { if (sz) sz.textContent = "Document: —"; if (note) note.textContent = ""; return; }
    const w = Math.round(Number(doc.width)), h = Math.round(Number(doc.height)), u = psUpPlan(w, h);
    if (sz) sz.textContent = "Document: " + w + " × " + h + " px";
    if (note) note.textContent = psUpSizeNote(Math.max(w, h));
    if (cost) cost.textContent = "Topaz · $" + u.costUsd.toFixed(2) + " (×" + u.factor + " → " + u.w + " × " + u.h + " px)";
  }
  // Saved with the print settings in the document.
  async function psUpSave(v, info) {
    psUpSet(v, info);
    try {
      const s = await psStateLoad(); s.upscale = v || null;
      const i = psUpInfo(); if (i) s.upInfo = i; else delete s.upInfo;
      await psStateSave(s);
    }
    catch (e) { traceErr("ps: save step 0", e); }
  }
  // UPSCALE deleted, the original shown again as the photo and the document sized back
  // to the size before the upscale. Returns the original's id (or null).
  async function psUpRemove() {
    const ps = psMod(), up = psUpscaleLayer(), info = psUpInfo();
    if (!up) return null;
    let orig = info && info.origId != null ? kbLayerById(info.origId) : null;
    if (!orig) {                                       // the layer right under UPSCALE
      try { const t = psMod().app.activeDocument.layers; for (let i = 0; i < t.length - 1; i++) if (t[i].id === up.id) { orig = t[i + 1]; break; } } catch (_) {}
    }
    await deleteLayersById([up.id]);
    await ps.core.executeAsModal(async function () {
      const doc = ps.app.activeDocument;
      if (orig) { try { orig.visible = true; } catch (_) {} }
      const w = Math.round(doc.width), h = Math.round(doc.height);
      if (info && info.fromW && info.fromH && (w !== info.fromW || h !== info.fromH))
        await doc.resizeImage(info.fromW, info.fromH, undefined, ps.constants.ResampleMethod.BICUBICSHARPER);
    }, { commandName: "KBImage — remove upscale" });
    psPhotoLayerId = orig ? orig.id : null;
    trace("ps upscale: UPSCALE " + up.id + " removed, original " + (orig ? orig.id + " (" + orig.name + ")" : "?") + " shown" + (info && info.fromW ? ", document back to " + info.fromW + "x" + info.fromH : ""));
    return orig ? orig.id : null;
  }
  // An accepted UPSCALE in the document while step 0 is not "done" / "kept" (Start over,
  // an older state, a lost value): step 0 is "kept", so its face offers Keep and continue,
  // Upscale again and Remove upscale, and step 1 is not held back.
  function psUpKeptSync() {
    if (psActiveDocId() == null || !psUpscaleLayer()) return;
    const v = psUpValue();
    if (v === "done" || v === "kept") return;
    psUpSet("kept");
    trace("ps upscale: UPSCALE in the document, step 0 was " + (v || "not set") + " → kept");
    if (!generateInFlight) psUpSave("kept").catch(function () {});
  }
  // Step 0 after Start over (UPSCALE kept).
  async function actPsUpKeep() {
    if (generateInFlight) { kbBusyNote(); return; }
    if (psStepState(0) !== "kept") { setStatus("bad", "Step 0 has no kept UPSCALE to keep."); return; }
    await psUpSave("done");
    psStepsRefresh();
    psStepOpen(1);
    setStatus("ok", "UPSCALE kept (" + psUpKeptText() + "). Step 1 is ready.");
  }
  async function actPsUpRemove() {
    if (generateInFlight) { kbBusyNote(); return; }
    if (!psUpscaleLayer()) { setStatus("bad", "There is no UPSCALE layer in this document."); return; }
    if (psStepState(0) === "locked") { setStatus("bad", "Step 0 is locked once step 1 is done. Use Start over to change it."); return; }
    generateInFlight = true;
    let o = null;
    try {
      o = await psUpRemove();
      await psUpSave(null, null);
      const rec = logRecordSkeleton("printswap:upscale-remove", {}, o, "photo");
      await logRun(rec); await logFinalizeCommitted(rec.id);
    } catch (err) {
      traceErr("ps upscale remove", err);
      setStatus("bad", "Remove upscale failed: " + ((err && err.message) || String(err)));
      return;
    } finally { generateInFlight = false; try { psStepsRefresh(); updateDocInfo(); } catch (_) {} }
    psStepOpen(0);
    let w = 0, h = 0; try { const d = psMod().app.activeDocument; w = Math.round(d.width); h = Math.round(d.height); } catch (_) {}
    setStatus("ok", "UPSCALE removed: " + (o != null ? kbLayerName(o) || "the original" : "the original") + " is shown again at " + w + " × " + h + " px. Step 0 is ready: Upscale or Skip.");
  }
  async function actPsUpAgain() {
    if (generateInFlight) { kbBusyNote(); return; }
    if (!psUpscaleLayer()) { setStatus("bad", "There is no UPSCALE layer in this document."); return; }
    if (psStepState(0) === "locked") { setStatus("bad", "Step 0 is locked once step 1 is done. Use Start over to change it."); return; }
    if (!cachedFalKey) { setStatus("bad", "Add your Fal API key in Settings (gear icon) to upscale."); return; }
    generateInFlight = true;
    try {
      await psUpRemove();                               // from the original, never from UPSCALE
      await psUpSave(null, null);
    } catch (err) {
      traceErr("ps upscale again", err);
      setStatus("bad", "Upscale again failed: " + ((err && err.message) || String(err)));
      return;
    } finally { generateInFlight = false; try { psStepsRefresh(); } catch (_) {} }
    return actPsUpscale();
  }
  // Inside nothing: back in History to `hid` (the state before the run). false when
  // History no longer has it.
  async function psUpHistoryBack(hid) {
    if (hid == null) return false;
    const ps = psMod();
    let ok = false;
    await ps.core.executeAsModal(async function () {
      const doc = ps.app.activeDocument;
      try {
        const hs = Array.prototype.slice.call(doc.historyStates || []);
        const h = hs.filter(function (x) { return x.id === hid; })[0];
        if (h) { doc.activeHistoryState = h; ok = true; return; }
      } catch (_) {}
      try {
        await ps.action.batchPlay([{ _obj: "select", _target: [{ _ref: "historyState", _id: hid }], _options: { dialogOptions: "dontDisplay" } }], { synchronousExecution: true });
        ok = true;
      } catch (_) {}
    }, { commandName: "KBImage — undo upscale" });
    return ok;
  }
  // Discard / Re-run: the original photo at its original size.
  async function psUpUndo(state) {
    if (!state) return;
    if (await psUpHistoryBack(state.historyId)) { trace("ps upscale: History back to before the run"); return; }
    // History lost it: UPSCALE goes, the original is shown again and the document is sized
    // back (the original resampled up and down, not its exact pixels).
    trace("ps upscale: History state gone, resizing back to " + state.fromW + "x" + state.fromH);
    const ps = psMod();
    try { if (state.layerId != null && kbLayerById(state.layerId)) await deleteLayersById([state.layerId]); } catch (_) {}
    await ps.core.executeAsModal(async function () {
      const o = state.photoId != null ? kbLayerById(state.photoId) : null;
      if (o) { try { o.visible = true; } catch (_) {} }
      await ps.app.activeDocument.resizeImage(state.fromW, state.fromH, undefined, ps.constants.ResampleMethod.BICUBICSHARPER);
    }, { commandName: "KBImage — size back" });
  }

  async function executePsUpscale(params) {
    const ps = psMod();
    const doc = ps.app.activeDocument;
    if (!doc) throw new Error("Open a Photoshop document first.");
    if (psUpscaleLayer()) throw new Error("UPSCALE is already in the document. Use Upscale again or Remove upscale: Print Swap never upscales UPSCALE itself.");
    const photoId = psOriginalPhotoId(), photo = photoId != null ? kbLayerById(photoId) : null;
    if (!photo) throw new Error("no photo layer found.");
    const docW = Math.round(doc.width), docH = Math.round(doc.height), u = psUpPlan(docW, docH);
    let historyId = null;
    try { historyId = doc.activeHistoryState ? doc.activeHistoryState.id : null; } catch (_) {}

    // 1) the photo alone, full size (other layers hidden while reading)
    setStatus("busy", "Upscale: reading the photo (" + docW + " × " + docH + ")…");
    let src = null;
    await ps.core.executeAsModal(async function () {
      const top = Array.prototype.slice.call(doc.layers || []);
      const was = top.map(function (l) { try { return l.visible; } catch (_) { return true; } });
      try {
        for (let i = 0; i < top.length; i++) { try { top[i].visible = (top[i].id === photoId); } catch (_) {} }
        const pr = await ps.imaging.getPixels({ documentID: doc.id, sourceBounds: { left: 0, top: 0, right: docW, bottom: docH }, applyAlpha: true, componentSize: 8 });
        if (!pr || !pr.imageData) throw new Error("imaging.getPixels returned no imageData.");
        let enc;
        try { enc = await ps.imaging.encodeImageData({ imageData: pr.imageData }); }
        finally { try { pr.imageData.dispose(); } catch (_) {} }
        const b64 = kbEncodedToBase64(enc).replace(/\s+/g, "");
        src = { base64: b64, mime: kbMimeOfBase64(b64) };
      } finally {
        for (let i = 0; i < top.length; i++) { try { top[i].visible = was[i]; } catch (_) {} }
      }
    }, { commandName: "KBImage — read photo for upscale" });

    // 2) Topaz on Fal
    setStatus("busy", "Topaz: upscaling ×" + u.factor + " (" + docW + " × " + docH + " → " + u.w + " × " + u.h + ")…");
    const body = { image_url: await falImageUrl(cachedFalKey, src.base64, src.mime), model: PS_UP_MODEL, upscale_factor: u.factor, output_format: "png" };
    src = null;
    falLogBody(PS_UP_PATH, body);
    const t0 = Date.now();
    const result = await falQueueJson(cachedFalKey, PS_UP_PATH, body);
    try { addSessionCost(u.costUsd); } catch (_) {}      // Topaz answered: charged
    const img = await falResultImage(result, "Topaz");
    const dims = decodeImageDimsFromBytes(img.buf) || { w: 0, h: 0 };
    trace("ps upscale: " + docW + "x" + docH + " ×" + u.factor + " → Topaz " + dims.w + "x" + dims.h + ", " + Math.round(img.buf.byteLength / 1024) + " KB, " + Math.round((Date.now() - t0) / 1000) + " s");

    // 3) the document to the new size, the result right above the photo as UPSCALE, the
    //    original hidden under it
    setStatus("busy", "Upscale: resizing the document to " + u.w + " × " + u.h + " and placing the result…");
    const folder = await fsLocal().getDataFolder();
    const file = await folder.createFile("printswap-upscale-" + Date.now() + (img.mime === "image/jpeg" ? ".jpg" : ".png"), { overwrite: true });
    await file.write(img.buf, { format: fmts().binary });
    const f = { file: file, token: await fsLocal().createSessionToken(file) };
    let id = null, nw = u.w, nh = u.h;
    try {
      await ps.core.executeAsModal(async function () {
        try { await deselectAll(); } catch (_) {}
        await doc.resizeImage(u.w, u.h, undefined, ps.constants.ResampleMethod.BICUBICSMOOTHER);
        nw = Math.round(doc.width); nh = Math.round(doc.height);
        await psSelectLayerVerifiedInModal(photoId, "the photo");
        try { await selectRGBChannel(); } catch (_) {}
        id = await kbPlaceFileInModal(f, PS_UP_NAME, { left: 0, top: 0, right: nw, bottom: nh });
        try { const o = kbLayerById(photoId); if (o) o.visible = false; } catch (e) { traceErr("ps upscale: hide the original", e); }
      }, { commandName: "KBImage — upscale photo" });
    } finally {
      await kbDeleteFile(f);
    }
    params.fromW = docW; params.fromH = docH; params.toW = nw; params.toH = nh; params.factor = u.factor; params.costUsd = u.costUsd;
    return { state: { historyId: historyId, fromW: docW, fromH: docH, toW: nw, toH: nh, factor: u.factor, photoId: photoId, layerId: id }, layerIds: [id] };
  }

  async function actPsUpscale() {
    if (generateInFlight) { kbBusyNote(); return; }
    const ps = psMod();
    const doc = ps.app.activeDocument;
    if (!doc) { setStatus("bad", "Open a Photoshop document first."); return; }
    const problem = kbDocProblem(doc);
    if (problem) { setStatus("bad", problem); return; }
    if (psStepState(0) === "locked") { setStatus("bad", "Step 1 is done: Start over to upscale. Print Swap never upscales under finished steps."); return; }
    if (!cachedFalKey) { setStatus("bad", "Add your Fal API key in Settings (gear icon) to upscale."); return; }
    if (psOtherPending("printswap:upscale")) { setStatus("bad", "Accept or Re-run the preview that is waiting first."); return; }
    const btn = $("ps-up-btn");
    if (btn) btn.classList.add("disabled");
    generateInFlight = true;
    traceStart("Print Swap — Upscale (" + PS_UP_PATH + ")");
    const params = function () { return { model: PS_UP_PATH, topazModel: PS_UP_MODEL }; };
    const p = params();
    try {
      await psRecall(0, "ps-recall-anchor-0", { op: "printswap:upscale", params: p, targetLayerId: psOriginalPhotoId(), sourceRef: "photo",
        paramsProvider: params, execute: executePsUpscale,
        preDiscard: async function (state) { await psUpUndo(state); },
        discard: async function (state) { await psUpUndo(state); return null; },
        onSettle: async function (state, accepted) {
          if (!accepted || !state) { psUpFaceSync(); return null; }
          // Accept: UPSCALE is the photo from now on; the original stays below it, hidden.
          if (state.layerId != null && kbLayerById(state.layerId)) psPhotoLayerId = state.layerId;
          await psUpSave("done", { factor: state.factor, fromW: state.fromW, fromH: state.fromH, toW: state.toW, toH: state.toH, origId: state.photoId });
          updateDocInfo();
          return "Upscale kept: " + state.fromW + " × " + state.fromH + " → " + state.toW + " × " + state.toH + " px, as UPSCALE (the original is hidden below it). Step 1 is ready.";
        } });
      setStatus("ok", "Upscaled " + p.fromW + " × " + p.fromH + " → " + p.toW + " × " + p.toH + " px (Topaz ×" + p.factor + ", $" + Number(p.costUsd || 0).toFixed(2)
        + "). Check it at 100%, then Accept. Discard puts the original back at " + p.fromW + " × " + p.fromH + ".");
    } catch (err) {
      traceErr("ps upscale", err);
      setStatus("bad", "Upscale failed: " + ((err && err.message) || String(err)));
    } finally {
      generateInFlight = false;
      if (btn) btn.classList.remove("disabled");
      try { psStepsRefresh(); updateDocInfo(); } catch (_) {}
      await traceFlush();
    }
  }
  async function actPsUpSkip() {
    if (generateInFlight) { kbBusyNote(); return; }
    if (!psMod().app.activeDocument) { setStatus("bad", "Open a Photoshop document first."); return; }
    if (pendingRecall && String(pendingRecall.descriptor && pendingRecall.descriptor.op) === "printswap:upscale") { setStatus("bad", "Accept or Discard the upscale first."); return; }
    if (psStepState(0) === "locked") { psStepsRefresh(); psStepOpen(psCurrentStep() != null ? psCurrentStep() : 1); setStatus("ok", "Step 1 is already done."); return; }
    if (psUpscaleLayer()) {                               // Skip never blocks: with UPSCALE it is Keep and continue
      await psUpSave("done");
      psStepsRefresh();
      psStepOpen(1);
      setStatus("ok", "UPSCALE kept. Step 1 is ready.");
      return;
    }
    generateInFlight = true;
    try {
      await psUpSave("skipped");
      const rec = logRecordSkeleton("printswap:upscale-skip", {}, null, "photo");
      await logRun(rec); await logFinalizeCommitted(rec.id);
    } finally { generateInFlight = false; }
    psStepsRefresh();
    psStepOpen(1);
    setStatus("ok", "Upscale skipped. Step 1 is ready.");
  }

  // =======================================================================
  // PRINT SWAP — step 1 BACKGROUND (White or Lighten).
  //   Select Subject (SAM 3.1 "person" fallback) → channel "KBPS person" (edge
  //   softness); optional KBPS hair. Just above the original photo: BG LIGHTEN,
  //   solid white at the Settings opacity, masked to the INVERSE of KBPS person.
  //   Nothing is cut out; the photo stays untouched. Later steps read the image
  //   with BG LIGHTEN on; Finish hides it so the real background comes back.
  // =======================================================================
  const PS_PERSON_CH = "KBPS person";
  const PS_HAIR_CH = "KBPS hair";                     // optional (Hair checkbox in step 1)
  const PS_THREAD_CH = "KBPS button thread";          // dark thread / hole marks inside the buttons
  const PS_BG_NAME = "BG LIGHTEN";                   // white at the Settings opacity, masked to the inverse of KBPS person
  function psBgOpacity() { return Math.round(kbNum("ps-bg-opacity", 50, 0, 100)); }
  function psBgLayer() { return psTopLayerNamed(PS_BG_NAME); }
  // Inside executeAsModal: layer `id` gets a mask = the INVERSE of KBPS person
  // (already softened), checked afterwards. Photoshop's exact error on failure.
  async function psMaskInverseOfPersonInModal(id) {
    const ps = psMod();
    await psSelectLayerVerifiedInModal(id, PS_BG_NAME);
    await kbDeleteMaskInModal(id, false, PS_BG_NAME);
    try { await selectRGBChannel(); } catch (_) {}
    await kbLoadChannel(PS_PERSON_CH);
    try { await ps.action.batchPlay([{ _obj: "inverse", _options: { dialogOptions: "dontDisplay" } }], { synchronousExecution: true }); }
    catch (e) { throw new Error("Inverting the person selection failed — Photoshop said: " + ((e && e.message) || String(e))); }
    if (!kbSelectionBounds()) throw new Error("the person covers the whole canvas; there is no background to lighten.");
    await psSelectLayerVerifiedInModal(id, PS_BG_NAME);
    try { await addLayerMaskRevealSelection(); }
    catch (e) { throw new Error("Masking BG LIGHTEN failed — Photoshop said: " + ((e && e.message) || String(e))); }
    try { await deselectAll(); } catch (_) {}
    try { await selectRGBChannel(); } catch (_) {}
    if ((await psLayerHasMask(id)) === false) throw new Error("Photoshop did not add the BG LIGHTEN mask.");
  }
  // The toggle and the opacity can change BG LIGHTEN at any time.
  async function psBgSet(visible, opacity) {
    const l = psBgLayer();
    if (!l) return false;
    await psMod().core.executeAsModal(async function () {
      if (opacity != null) await psSetBlendInModal(l.id, "normal", opacity);
      try { l.visible = !!visible; } catch (_) {}
    }, { commandName: "KBImage — BG LIGHTEN" });
    return true;
  }
  async function actPsBgToggle() {
    const c = $("ps-bg-on"), on = !!(c && c.checked);
    if (!(await psBgSet(on, null))) { setStatus("bad", "There is no BG LIGHTEN yet. Run Lighten background in step 1."); return; }
    setStatus("ok", "Background lightening " + (on ? "on." : "off."));
  }
  async function actPsBgOpacity() {
    const c = $("ps-bg-on"), on = c ? !!c.checked : true;
    if (!(await psBgSet(on, psBgOpacity()))) { setStatus("bad", "There is no BG LIGHTEN yet. Run Lighten background in step 1."); return; }
    setStatus("ok", "BG LIGHTEN opacity " + psBgOpacity() + "%.");
  }
  let psWhiteArmUntil = 0;

  // The layer later steps stack on: MODEL (White) or BG LIGHTEN (Lighten), else the photo.
  function psStackBaseId(photoId) {
    const m = psTopLayerNamed(PS_MODEL_NAME) || psBgLayer();
    return m ? m.id : photoId;
  }
  const PS_WHITE_NAME = "WHITE";                      // White: the team's Layer 7
  const PS_MODEL_NAME = "MODEL";                      //        + the photo masked to KBPS person
  function psBgMode() { return readPills("pills-ps-bg-mode", "white") === "lighten" ? "lighten" : "white"; }
  function psStep1Layers() { return [psTopLayerNamed(PS_WHITE_NAME), psTopLayerNamed(PS_MODEL_NAME), psBgLayer()].filter(Boolean); }

  // Outside a modal: step 1's layers just above the photo from KBPS person.
  // White = WHITE + MODEL (stays in the final); Lighten = BG LIGHTEN (Finish hides it).
  // `made` collects ids for clean-up. Returns the ids, bottom to top.
  async function psBuildBackground(mode, photoId, opacity, made) {
    const ps = psMod();
    const photo = kbLayerById(photoId);
    if (!photo) throw new Error("no photo layer found.");
    const ids = [];
    await ps.core.executeAsModal(async function () {
      try { await deselectAll(); } catch (_) {}
      await psSelectLayerVerifiedInModal(photoId, "the photo");
      try { await selectRGBChannel(); } catch (_) {}
      const name = mode === "white" ? PS_WHITE_NAME : PS_BG_NAME;
      await ps.action.batchPlay([{ _obj: "make", _target: [{ _ref: "layer" }], using: { _obj: "layer", name: name },
        _options: { dialogOptions: "dontDisplay" } }], { synchronousExecution: true });
      const fillId = kbActiveLayerId(); made.push(fillId); ids.push(fillId);
      await kbFillActiveLayer([255, 255, 255]);
      try { await renameActiveLayer(name); } catch (_) {}
      if (mode === "white") {
        let model;
        try { model = await photo.duplicate(kbLayerById(fillId), ps.constants.ElementPlacement.PLACEBEFORE, PS_MODEL_NAME); }
        catch (e) { throw new Error("Copying the photo as MODEL failed — Photoshop said: " + ((e && e.message) || String(e))); }
        made.push(model.id); ids.push(model.id);
        try { model.visible = true; } catch (_) {}
        await psMaskLayerToChannelInModal(model.id, PS_PERSON_CH, PS_MODEL_NAME, 0);
      } else {
        await psSetBlendInModal(fillId, "normal", opacity);
        await psMaskInverseOfPersonInModal(fillId);
        try { const l = kbLayerById(fillId); if (l) l.visible = true; } catch (_) {}
      }
    }, { commandName: mode === "white" ? "KBImage — white background" : "KBImage — lighten background" });
    try { const c = $("ps-bg-on"); if (c) c.checked = true; } catch (_) {}
    return ids;
  }

  // Switching White / Lighten after step 1: only step 1's layers are rebuilt (KBPS
  // person is kept; no Select Subject, no SAM).
  async function psOnBgModeChanged() {
    psBgModeUi();
    if (generateInFlight || !kbChannelExists(PS_PERSON_CH)) return;
    const old = psStep1Layers();
    if (!old.length) return;
    if (old.some(function (l) { return psIsPending(l.id); })) { setStatus("bad", "Accept or Re-run step 1 first, then switch."); return; }
    const mode = psBgMode();
    generateInFlight = true;
    traceStart("Print Swap — background → " + mode);
    const made = [];
    try {
      await deleteLayersById(old.map(function (l) { return l.id; }));
      const ids = await psBuildBackground(mode, psOriginalPhotoId(), psBgOpacity(), made);
      const rec = logRecordSkeleton("printswap:background-switch", { mode: mode, opacity: psBgOpacity() }, null, "channel:" + PS_PERSON_CH);
      await logRun(rec);
      await logFinalizeCommitted(rec.id);
      trace("ps background switched to " + mode + ": " + ids.join(","));
      setStatus("ok", mode === "white" ? "Background is now White (WHITE + MODEL), kept in the final." : "Background is now Lighten (BG LIGHTEN " + psBgOpacity() + "%), hidden by Finish.");
    } catch (err) {
      if (made.length) { try { await deleteLayersById(made); } catch (_) {} }
      traceErr("ps background switch", err);
      setStatus("bad", "Could not switch the background: " + ((err && err.message) || String(err)));
    } finally {
      generateInFlight = false;
      await traceFlush();
    }
  }
  // The Lighten checkbox and opacity only apply to Lighten.
  function psBgModeUi() {
    const lighten = psBgMode() === "lighten";
    const t = $("ps-bg-toggle-row"); if (t) t.classList.toggle("hidden", !lighten);
    const o = $("ps-bg-opacity-field"); if (o) o.classList.toggle("hidden", !lighten);
  }

  // SAM 3.1 on a doc rect → a grid plane (gw × gh, 0..255) of all matches, or
  // null. zoom = retry close up when nothing comes back.
  async function psSamGrid(prompt, rect, gw, gh, docW, docH, zoom) {
    const N = gw * gh;
    let r = await kbSamRect(prompt, rect, { samPath: PS_SAM_PATH });
    let calls = 1, plane = null, n = 0;
    if (r && r.plane) {
      plane = new Uint8Array(N);
      kbPasteCrop(plane, gw, gh, docW, docH, r.plane, r.w, r.h, rect);
      for (let k = 0; k < N; k++) if (plane[k] > 127) n++;
    }
    if (!n && zoom) {
      const zr = await kbSamZoom(prompt, rect, docW, docH, gw, gh, { samPath: PS_SAM_PATH });
      calls += zr.calls;
      n = 0; for (let k = 0; k < N; k++) if (zr.plane[k] > 127) n++;
      if (n) plane = zr.plane;
    }
    trace("ps sam: “" + prompt + "” → " + n + " grid px (" + calls + " call(s))");
    return { plane: n ? plane : null, calls: calls };
  }

  // Square dilation of a boolean grid by r (box blur > 0).
  // Pure: parts that tile the garment exactly. planes = the refined part masks (0..255 on
  // the grid), garment = KBPS garment on the grid. Every garment pixel (> 0) goes to ONE
  // part: the strongest mask over half; where two or more are over half (an overlap) the
  // strongest wins; where none is (a gap) the nearest part (4-connected flood from the
  // assigned pixels, so a pixel cut off from every part still gets the nearest one). Then
  // each part grows 1 px into its neighbours (inside the garment) so shared borders overlap
  // and nothing shows through. → { planes (hard 0 / 255), coveredPct, gapsFixed,
  // overlapsFixed, gapsAfter, multiAfter (the 1 px border overlap), took: garment px
  // each part absorbed from the gaps }.
  // Part masks at full size (pure). planes = the tiled grid planes (gw × gh). Returns
  // { lab, rw, rh, sigma } over rect (document px): lab[p] = part index + 1 for EVERY pixel of
  // rect, so the parts tile it exactly. Smooth seams instead of the grid's stair-steps:
  //   1) each grid cell → its strongest part; cells in no part (outside the garment) → the
  //      nearest part, so every part reaches past the garment's edge (KBPS garment cuts it);
  //   2) each part blurred (σ ≈ 0.1% of the long edge, at full size), sampled bilinearly at
  //      each pixel; the strongest wins (for two parts: the 50% threshold), so seams are curves.
  function psPartsFullLabels(planes, gw, gh, docW, docH, rect) {
    const N = gw * gh, n = planes.length;
    if (!n) return null;
    const L = new Int16Array(N).fill(-1), q = new Int32Array(N);
    let qh = 0, qt = 0;
    for (let k = 0; k < N; k++) {
      let best = -1, bv = 127;
      for (let i = 0; i < n; i++) { const v = planes[i][k]; if (v > bv) { bv = v; best = i; } }
      if (best >= 0) { L[k] = best; q[qt++] = k; }
    }
    if (!qt) return null;
    while (qh < qt) {                                      // nearest part for every other cell
      const k = q[qh++], x = k % gw, y = (k - x) / gw, v = L[k];
      if (x > 0 && L[k - 1] < 0) { L[k - 1] = v; q[qt++] = k - 1; }
      if (x < gw - 1 && L[k + 1] < 0) { L[k + 1] = v; q[qt++] = k + 1; }
      if (y > 0 && L[k - gw] < 0) { L[k - gw] = v; q[qt++] = k - gw; }
      if (y < gh - 1 && L[k + gw] < 0) { L[k + gw] = v; q[qt++] = k + gw; }
    }
    const sx = docW / gw, sy = docH / gh;
    const sigma = Math.max(0.6, 0.001 * Math.max(docW, docH) / Math.max(sx, sy));   // in grid cells
    const r = Math.max(1, Math.round(sigma));             // two box passes ≈ the Gaussian
    const blurOne = function (src) {
      const tmp = new Float32Array(N), out = new Uint8Array(N), w = 2 * r + 1;
      for (let pass = 0; pass < 2; pass++) {
        const a = pass ? out.slice() : src;
        for (let y = 0; y < gh; y++) {                     // horizontal
          let acc = 0; const row = y * gw;
          for (let x = -r; x <= r; x++) acc += a[row + Math.min(gw - 1, Math.max(0, x))];
          for (let x = 0; x < gw; x++) {
            tmp[row + x] = acc / w;
            acc += a[row + Math.min(gw - 1, x + r + 1)] - a[row + Math.max(0, x - r)];
          }
        }
        for (let x = 0; x < gw; x++) {                     // vertical
          let acc = 0;
          for (let y = -r; y <= r; y++) acc += tmp[Math.min(gh - 1, Math.max(0, y)) * gw + x];
          for (let y = 0; y < gh; y++) {
            out[y * gw + x] = Math.round(acc / w);
            acc += tmp[Math.min(gh - 1, y + r + 1) * gw + x] - tmp[Math.max(0, y - r) * gw + x];
          }
        }
      }
      return out;
    };
    const used = [];
    for (let i = 0; i < n; i++) used.push(false);
    for (let k = 0; k < N; k++) used[L[k]] = true;
    const B = [];
    for (let i = 0; i < n; i++) {
      if (!used[i]) { B.push(null); continue; }
      const b = new Uint8Array(N); for (let k = 0; k < N; k++) if (L[k] === i) b[k] = 255;
      B.push(blurOne(b));
    }
    // Cells with one part all around (beyond the blur's reach): that part, no sampling.
    const R = 2 * r + 2, key = new Int32Array(N), U = new Int16Array(N).fill(-1);
    const inner = function (t, s0, e, len) { return (t - s0 >= R || s0 === 0) && (e - 1 - t >= R || e === len); };
    for (let y = 0; y < gh; y++) {                         // rows: the same part within ±R
      let s0 = 0; const row = y * gw;
      for (let x = 1; x <= gw; x++) {
        if (x === gw || L[row + x] !== L[row + s0]) {
          for (let t = s0; t < x; t++) key[row + t] = inner(t, s0, x, gw) ? L[row + t] : -1 - (row + t);
          s0 = x;
        }
      }
    }
    for (let x = 0; x < gw; x++) {                         // then columns of those
      let s0 = 0;
      for (let y = 1; y <= gh; y++) {
        if (y === gh || key[y * gw + x] !== key[s0 * gw + x]) {
          const kk = key[s0 * gw + x];
          if (kk >= 0) for (let t = s0; t < y; t++) if (inner(t, s0, y, gh)) U[t * gw + x] = kk;
          s0 = y;
        }
      }
    }
    const rw = rect.right - rect.left, rh = rect.bottom - rect.top, lab = new Uint8Array(rw * rh);
    for (let py = 0; py < rh; py++) {
      const gyf = Math.min(gh - 1, Math.max(0, (rect.top + py + 0.5) / sy - 0.5)), y0 = Math.floor(gyf), y1 = Math.min(gh - 1, y0 + 1), fy = gyf - y0;
      for (let px = 0; px < rw; px++) {
        const gxf = Math.min(gw - 1, Math.max(0, (rect.left + px + 0.5) / sx - 0.5)), x0 = Math.floor(gxf), x1 = Math.min(gw - 1, x0 + 1), fx = gxf - x0;
        const a = y0 * gw + x0, b = y0 * gw + x1, c = y1 * gw + x0, d = y1 * gw + x1, u = U[a];
        if (u >= 0 && U[b] === u && U[c] === u && U[d] === u) { lab[py * rw + px] = u + 1; continue; }
        let best = L[Math.round(gyf) * gw + Math.round(gxf)], bv = -1;
        for (let i = 0; i < n; i++) {
          const P = B[i]; if (!P) continue;
          const v = (P[a] * (1 - fx) + P[b] * fx) * (1 - fy) + (P[c] * (1 - fx) + P[d] * fx) * fy;
          if (v > bv) { bv = v; best = i; }
        }
        lab[py * rw + px] = best + 1;
      }
    }
    return { lab: lab, rw: rw, rh: rh, sigma: sigma * Math.max(sx, sy) };
  }
  // Part i's full-size plane from psPartsFullLabels, grown 1 px into its neighbours (the
  // overlap that keeps shared borders closed).
  function psPartFullPlane(F, i) {
    const rw = F.rw, rh = F.rh, lab = F.lab, v = i + 1, out = new Uint8Array(rw * rh);
    for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
      const p = y * rw + x;
      if (lab[p] === v || (x > 0 && lab[p - 1] === v) || (x < rw - 1 && lab[p + 1] === v) || (y > 0 && lab[p - rw] === v) || (y < rh - 1 && lab[p + rw] === v)) out[p] = 255;
    }
    return out;
  }
  function psPartsTile(planes, garment, gw, gh) {
    const N = gw * gh, n = planes.length, lab = new Int16Array(N).fill(-1);
    let region = 0, gapsFixed = 0, overlapsFixed = 0;
    const queue = new Int32Array(N); let qh = 0, qt = 0;
    for (let k = 0; k < N; k++) {
      if (!garment[k]) continue;
      region++;
      let best = -1, bv = 127, over = 0;
      for (let i = 0; i < n; i++) { const v = planes[i][k]; if (v > 127) { over++; if (v > bv) { bv = v; best = i; } } }
      if (over > 1) overlapsFixed++;
      if (best >= 0) { lab[k] = best; queue[qt++] = k; } else gapsFixed++;
    }
    if (!n) return { planes: [], coveredPct: 0, gapsFixed: gapsFixed, overlapsFixed: 0, gapsAfter: region, multiAfter: 0, took: [] };
    const took = new Array(n).fill(0);
    // nearest part for the gaps: flood over the whole grid from the assigned pixels
    const first = qt;                                     // the queue past this point: pixels the flood gave a part
    while (qh < qt) {
      const k = queue[qh++], x = k % gw, i = lab[k];
      if (qh > first && garment[k]) took[i]++;
      if (x > 0 && lab[k - 1] < 0) { lab[k - 1] = i; queue[qt++] = k - 1; }
      if (x < gw - 1 && lab[k + 1] < 0) { lab[k + 1] = i; queue[qt++] = k + 1; }
      if (k >= gw && lab[k - gw] < 0) { lab[k - gw] = i; queue[qt++] = k - gw; }
      if (k < N - gw && lab[k + gw] < 0) { lab[k + gw] = i; queue[qt++] = k + gw; }
    }
    const out = [];
    for (let i = 0; i < n; i++) {
      const b = new Uint8Array(N);
      for (let k = 0; k < N; k++) if (garment[k] && lab[k] === i) b[k] = 1;
      const g = psDilate(b, gw, gh, 1), pl = new Uint8Array(N);      // 1 px into the neighbours
      for (let k = 0; k < N; k++) if (garment[k] && g[k]) pl[k] = 255;
      out.push(pl);
    }
    let covered = 0, multi = 0, gapsAfter = 0;
    for (let k = 0; k < N; k++) {
      if (!garment[k]) continue;
      let c = 0; for (let i = 0; i < n; i++) if (out[i][k]) c++;
      if (c) covered++; else gapsAfter++;
      if (c > 1) multi++;
    }
    return { planes: out, coveredPct: region ? Math.round(covered / region * 10000) / 100 : 0, gapsFixed: gapsFixed, overlapsFixed: overlapsFixed, gapsAfter: gapsAfter, multiAfter: multi, took: took };
  }
  function psDilate(b, w, h, r) {
    const f = new Float32Array(w * h); for (let k = 0; k < f.length; k++) f[k] = b[k] ? 1 : 0;
    const bl = kbBoxBlur(f, w, h, r), out = new Uint8Array(w * h);
    for (let k = 0; k < out.length; k++) if (bl[k] > 0.0001) out[k] = 1;
    return out;
  }

  async function executePsWhite(params) {
    const ps = psMod();
    const doc = ps.app.activeDocument;
    if (!doc) throw new Error("Open a Photoshop document first.");
    const photoId = psOriginalPhotoId(), photo = photoId != null ? kbLayerById(photoId) : null;
    if (!photo) throw new Error("no photo layer found.");
    const docW = Math.round(doc.width), docH = Math.round(doc.height);
    if (docW * docH > KB_MAX_PIXELS) throw new Error("the document is too large (" + docW + " × " + docH + ").");
    const G = kbGridSize(docW, docH), gw = G.gw, gh = G.gh;
    const full = { left: 0, top: 0, right: docW, bottom: docH };
    let step = "finding the person";
    const made = [];
    let samCalls = 0;
    try {
      // Everything above the photo is hidden while the person and hair are found.
      const above = [];
      try { const t = doc.layers; for (let i = 0; i < t.length; i++) { if (t[i].id === photoId) break; above.push(t[i]); } } catch (_) {}
      const was = above.map(function (l) { try { return l.visible; } catch (_) { return true; } });
      await ps.core.executeAsModal(async function () { for (let i = 0; i < above.length; i++) { try { above[i].visible = false; } catch (_) {} } },
        { commandName: "KBImage — show the photo" });
      let hairPlane = null;
      try {
        // 1) Person: Photoshop's own Select Subject; SAM 3.1 "person" if that fails.
        setStatus("busy", "Select Subject: finding the person…");
        let ssErr = null;
        await ps.core.executeAsModal(async function () {
          try {
            try { await deselectAll(); } catch (_) {}
            await psSelectLayerVerifiedInModal(photoId, "the photo");
            await ps.action.batchPlay([{ _obj: "autoCutout", sampleAllLayers: false, _options: { dialogOptions: "dontDisplay" } }], { synchronousExecution: true });
            if (!kbSelectionBounds()) throw new Error("Select Subject found nothing.");
            await kbRemoveChannels(PS_PERSON_CH);
            await saveSelectionToChannel(PS_PERSON_CH);
            try { await deselectAll(); } catch (_) {}
          } catch (e) { ssErr = e; }
        }, { commandName: "KBImage — Select Subject" });
        if (!ssErr) params.personBy = "Select Subject";
        else {
          traceErr("ps white: Select Subject (falling back to SAM 3.1)", ssErr);
          params.personBy = "SAM 3.1 (Select Subject said: " + ((ssErr && ssErr.message) || String(ssErr)) + ")";
          step = "asking SAM 3.1 for the person";
          setStatus("busy", "SAM 3.1: finding the person…");
          const s = await psSamGrid("person", full, gw, gh, docW, docH, true);
          samCalls += s.calls;
          if (!s.plane) throw new Error("neither Select Subject nor SAM found a person.");
          const one = [{ name: "person", plane: s.plane }];
          try { await kbRefineMasks(one, gw, gh, docW, docH, photoId, PS_EDGE_SOFT); } catch (e) { traceErr("ps person refine (kept as SAM made it)", e); }
          await psPlaneToChannel(one[0].plane, gw, gh, docW, docH, PS_PERSON_CH);
        }
        // 2) Hair (optional): SAM 3.1 "hair".
        if (params.hair) {
          step = "asking SAM 3.1 for the hair";
          setStatus("busy", "SAM 3.1: finding the hair…");
          const h = await psSamGrid("hair", full, gw, gh, docW, docH, false);
          samCalls += h.calls;
          hairPlane = h.plane;
        }
      } finally {
        await ps.core.executeAsModal(async function () { for (let i = 0; i < above.length; i++) { try { above[i].visible = was[i]; } catch (_) {} } },
          { commandName: "KBImage — restore layers" });
      }
      params.samCalls = samCalls; params.costUsd = samCalls * SAM_COST_USD;
      if (samCalls) {
        const srec = logRecordSkeleton("printswap:person-sam", { model: PS_SAM_PATH, calls: samCalls, estCostUsd: params.costUsd }, photoId, "photo");
        srec.routedVia = "fal";
        await logRun(srec);
        await logFinalizeCommitted(srec.id);
      }
      step = "softening the person edge";
      await psSoftenAfterSave([PS_PERSON_CH], "person", "person");
      if (params.hair) {
        if (!hairPlane) params.hairBy = "not found (SAM found no hair)";
        else {
          step = "saving KBPS hair";
          await psPlaneToChannel(hairPlane, gw, gh, docW, docH, PS_HAIR_CH);
          params.hairBy = await psRefineHair();
        }
      }
      step = params.bgMode === "white" ? "building WHITE and MODEL" : "building BG LIGHTEN";
      setStatus("busy", params.bgMode === "white" ? "Building the white background…" : "Lightening the background…");
      const ids = await psBuildBackground(params.bgMode, photoId, params.opacity, made);
      // Anything else visible above the step 1 layers that covers the whole canvas (a
      // leftover "Background copy") would hide the result: hide it, never delete it.
      step = "checking for layers covering the result";
      params.hidden = await psHideCoveringLayers(ids[ids.length - 1], docW, docH);
      trace("ps background (" + params.bgMode + "): person by " + params.personBy + (params.hair ? ", hair " + params.hairBy : "") + "; layers " + ids.join(",") + " above photo " + photoId);
      return { layerIds: ids, afterSnapshotRef: null, state: {} };
    } catch (err) {
      if (made.length) { try { await deleteLayersById(made); } catch (_) {} }
      const e2 = new Error("Background failed while " + step + ": " + ((err && err.message) || String(err)));
      e2.cause = err;
      throw e2;
    }
  }

  // Top-level layers above layer `id` that are visible, cover ~the whole canvas and
  // are not Print Swap layers → hidden. Returns their names.
  function psIsPrintSwapLayerName(n) {
    return n === PS_BG_NAME || n === "WHITE" || n === "MODEL" || n === PS_CLEAN_NAME || n.indexOf(PS_GREY_NAME) === 0 || n === PS_PARTS_GROUP || n === PS_PS_GROUP
      || n === PS_PIPING_GRP || n === PS_BUTTON_GRP || n === "BUTTON THREAD" || n.indexOf("MERGED") === 0 || n === "HAIR"
      || n.indexOf("KB") === 0 || n.indexOf("kb_") === 0;
  }
  async function psHideCoveringLayers(id, docW, docH) {
    const hide = [];
    try {
      const t = psMod().app.activeDocument.layers;
      for (let i = 0; i < t.length; i++) {
        const l = t[i];
        if (l.id === id) break;                                   // only layers above it
        const n = String(l.name || "");
        if (psIsPrintSwapLayerName(n)) continue;
        let vis = false; try { vis = l.visible; } catch (_) {}
        if (!vis) continue;
        const b = l.bounds;
        const w = Number(b.right) - Number(b.left), h = Number(b.bottom) - Number(b.top);
        if (w >= docW * 0.99 && h >= docH * 0.99) hide.push(l);
      }
    } catch (_) {}
    if (!hide.length) return [];
    await psMod().core.executeAsModal(async function () { for (let i = 0; i < hide.length; i++) { try { hide[i].visible = false; } catch (_) {} } },
      { commandName: "KBImage — hide layers covering the result" });
    const names = hide.map(function (l) { return String(l.name || "(unnamed)"); });
    trace("ps white: hid " + names.join(", ") + " (covering the result)");
    return names;
  }

  // KBPS hair: refined by Select and Mask's own edge detection (smart radius) if
  // the plug-in can call it without the dialog; otherwise the edge softness.
  // Kept inside KBPS person. Returns how it was done (for the status line).
  async function psRefineHair() {
    const ps = psMod();
    let err = null;
    try {
      await ps.core.executeAsModal(async function () {
        await kbLoadChannel(PS_HAIR_CH);
        await ps.action.batchPlay([{ _obj: "smartBrushWorkspace",
          presetKind: { _enum: "presetKindType", _value: "presetKindCustom" },
          smartBrushRadius: 8, smartBrushSmooth: 0,
          smartBrushFeather: { _unit: "pixelsUnit", _value: 0 },
          smartBrushContrast: { _unit: "percentUnit", _value: 0 },
          smartBrushShiftEdge: { _unit: "percentUnit", _value: 0 },
          sampleAllLayers: false, smartBrushUseSmartRadius: true, smartBrushDecontaminate: false,
          refineEdgeOutput: { _enum: "refineEdgeOutput", _value: "selectionOutputToSelection" },
          _options: { dialogOptions: "dontDisplay" } }], { synchronousExecution: true });
        if (!kbSelectionBounds()) throw new Error("Select and Mask returned nothing.");
        if (kbChannelExists(PS_PERSON_CH)) await kbLoadChannel(PS_PERSON_CH, "intersect");
        await psSaveSelectionAsInModal(PS_HAIR_CH);
        await psSaveSelectionAsInModal(psRawName(PS_HAIR_CH));
        try { await deselectAll(); } catch (_) {}
      }, { commandName: "KBImage — refine hair" });
    } catch (e) { err = e; }
    if (!err) { trace("ps hair: refined with Select and Mask (smart radius)"); return "refined with Select and Mask"; }
    traceErr("ps hair: Select and Mask (using edge softness instead)", err);
    await psMod().core.executeAsModal(async function () {
      if (kbChannelExists(PS_PERSON_CH)) { await kbLoadChannel(PS_HAIR_CH); await kbLoadChannel(PS_PERSON_CH, "intersect"); await psSaveSelectionAsInModal(PS_HAIR_CH); }
      try { await deselectAll(); } catch (_) {}
    }, { commandName: "KBImage — hair in person" });
    await psSoftenAfterSave([PS_HAIR_CH], "hair", "person");
    return "softened (Select and Mask could not be called: " + ((err && err.message) || String(err)) + ")";
  }

  function psHairOn() { const c = $("ps-hair-on"); return !!(c && c.checked); }
  function psWhiteCostSync() {
    const el = $("ps-white-cost");
    if (el) el.textContent = psHairOn() ? "Photoshop + SAM 3.1 · $" + SAM_COST_USD.toFixed(3) : "Photoshop · free";
    const gc = $("ps-find-cost");
    if (gc) gc.textContent = psFindCostText();
  }
  function psWhiteOnTabOpen() {
    const c = $("ps-hair-on");
    if (c && !c.__kbWired) { c.__kbWired = true; c.addEventListener("change", psWhiteCostSync); }
    const bt = $("ps-bg-on");
    if (bt && !bt.__kbWired) { bt.__kbWired = true; bt.addEventListener("change", actPsBgToggle); }
    if (bt) { const l = psBgLayer(); if (l) { try { bt.checked = !!l.visible; } catch (_) {} } }
    try { const m = psTopLayerNamed(PS_MODEL_NAME) ? "white" : (psBgLayer() ? "lighten" : null);   // the pill follows what is in the document
      const g = $("pills-ps-bg-mode"); if (m && g) { const ps_ = g.querySelectorAll(".pill"); for (let i = 0; i < ps_.length; i++) ps_[i].classList.toggle("selected", ps_[i].getAttribute("data-value") === m); } } catch (_) {}
    psBgModeUi();
    psWhiteCostSync();
  }

  // ----- 9 FINISH — MERGED (stamp visible, the team's Layer 11) + HAIR on top ------
  const PS_MERGED_NAME = "MERGED";
  const PS_HAIR_NAME = "HAIR";

  // MERGED after a change to Print and Color (7) or Shading (8) once Finish is done. While the
  // preview waits, every MERGED is hidden so the change shows. Accept stamps a new
  // "MERGED · <print file>" in the old one's place (HAIR stays on top, out of the
  // stamp); both live in the "MERGED VERSIONS" group, the earlier one hidden and named
  // with its own print. At most 2 versions: the oldest goes. Re-run / Discard put the
  // layers back as they were. Step 9 stays done.
  const PS_MERGED_GROUP = "MERGED VERSIONS";
  const PS_MERGED_KEEP = 2;
  let psMergedHeld = null;                            // { id, visible, printName } while hidden
  // The MERGED on top: the versions group, else Finish's MERGED layer (not a waiting preview).
  function psMergedAccepted() {
    const g = psTopLayerNamed(PS_MERGED_GROUP);
    if (g && !psIsPending(g.id)) return g;
    const l = psTopLayerNamed(PS_MERGED_NAME);
    return l && !psIsPending(l.id) ? l : null;
  }
  function psMergedVersionName(printName) { return PS_MERGED_NAME + (printName ? " · " + printName : ""); }
  async function psMergedPrintName() { try { return (await psStateLoad()).printName || null; } catch (_) { return null; } }
  async function psMergedHide() {
    if (psMergedHeld) return;
    const m = psMergedAccepted();
    if (!m) return;
    let vis = true; try { vis = m.visible; } catch (_) {}
    psMergedHeld = { id: m.id, visible: vis, printName: await psMergedPrintName() };   // the print the current MERGED shows
    if (vis) await psMod().core.executeAsModal(async function () { try { m.visible = false; } catch (_) {} }, { commandName: "KBImage — hide MERGED" });
    trace("ps merged: hidden while the preview waits (" + m.name + ")");
  }
  async function psMergedRestore() {
    const h = psMergedHeld; psMergedHeld = null;
    if (!h) return;
    const m = kbLayerById(h.id);
    if (m) await psMod().core.executeAsModal(async function () { try { m.visible = h.visible; } catch (_) {} }, { commandName: "KBImage — show MERGED" });
    trace("ps merged: put back as it was (" + h.id + (m ? "" : ", gone") + ")");
  }
  // Inside executeAsModal: Stamp Visible (Merge Visible, duplicate) made from a new empty
  // layer at the top of the document, so the active layer is never a hidden one (Photoshop
  // refuses Merge Visible then). The empty layer is deleted after (unlocked first). Returns
  // the stamp's id, the stamp active.
  const KB_STAMP_TMP = "KBPS_tmp_stamp";
  async function kbStampVisibleInModal() {
    const ps = psMod(), doc = ps.app.activeDocument, EP = ps.constants && ps.constants.ElementPlacement;
    try { await deselectAll(); } catch (_) {}
    const top = doc.layers && doc.layers[0];
    if (top) await kbSelectLayerById(top.id);
    try { await selectRGBChannel(); } catch (_) {}
    let tmpId = null, stampId = null;
    try {
      try {
        await ps.action.batchPlay([{ _obj: "make", _target: [{ _ref: "layer" }], using: { _obj: "layer", name: KB_STAMP_TMP },
          _options: { dialogOptions: "dontDisplay" } }], { synchronousExecution: true });
      } catch (e) { throw new Error("Making the empty layer for the stamp failed — Photoshop said: " + ((e && e.message) || String(e))); }
      tmpId = kbActiveLayerId();
      const tmp = tmpId != null ? kbLayerById(tmpId) : null;
      if (!tmp || String(tmp.name) !== KB_STAMP_TMP) throw new Error("the empty layer for the stamp was not made.");
      try { if (doc.layers[0].id !== tmpId) tmp.move(doc, EP.PLACEATBEGINNING); } catch (e) { traceErr("stamp: move the empty layer to the top", e); }
      try { tmp.visible = true; } catch (_) {}
      await kbSelectLayerById(tmpId);
      try { await selectRGBChannel(); } catch (_) {}
      try {
        await ps.action.batchPlay([{ _obj: "mergeVisible", duplicate: true, _options: { dialogOptions: "dontDisplay" } }], { synchronousExecution: true });
      } catch (e) { throw new Error("Stamp visible failed — Photoshop said: " + ((e && e.message) || String(e))); }
      stampId = kbActiveLayerId();
      if (stampId == null || stampId === tmpId) throw new Error("Stamp visible made no new layer.");
    } finally {
      if (tmpId != null && kbLayerById(tmpId)) await psDeleteLayerInModal(tmpId);   // unlocks first
    }
    await kbSelectLayerById(stampId);
    return stampId;
  }
  // A blocked or failed run (orange / red status): the same message under the open step's
  // button; a result or a new run clears it.
  function psStepNoteSync(kind, text) {
    if (kind === "busy") return;
    const old = document.querySelectorAll(".ps-step-note");
    for (let i = 0; i < old.length; i++) old[i].parentNode.removeChild(old[i]);
    if ((kind !== "bad" && kind !== "warn") || psOpenStep == null || /MERGED could not be rebuilt/.test(String(text || ""))) return;
    const n = psOpenStep, anchor = $("ps-recall-anchor-" + n) || $("ps-recall-anchor-" + n + "p");
    if (!anchor || !anchor.parentNode) return;
    const el = document.createElement("div");
    el.className = "ps-step-note"; el.textContent = statusShort(text).short;
    anchor.parentNode.insertBefore(el, anchor);
  }
  // A failed MERGED rebuild: also shown under the button of the open step.
  function psMergedNote(text) {
    const old = document.querySelectorAll(".ps-merged-note");
    for (let i = 0; i < old.length; i++) old[i].parentNode.removeChild(old[i]);
    if (!text) return;
    const n = psOpenStep != null ? psOpenStep : 9;
    const anchor = $("ps-recall-anchor-" + n) || $("ps-recall-anchor-" + n + "p") || $("ps-recall-anchor-9");
    if (!anchor || !anchor.parentNode) return;
    const el = document.createElement("div");
    el.className = "ps-merged-note"; el.textContent = text;
    anchor.parentNode.insertBefore(el, anchor);
  }
  // Outside a modal: a new MERGED version on top of the group. replace = true (a turn or
  // scale change kept at once): the newest version is redone in place, no new version.
  // Returns the status line, or null when there was no MERGED to follow.
  async function psMergedRebuild(replace) {
    const h = psMergedHeld; psMergedHeld = null;
    const node = h ? kbLayerById(h.id) : psMergedAccepted();
    if (!node) return null;
    const oldPrint = h ? h.printName : await psMergedPrintName();
    const newPrint = await psMergedPrintName();
    const ps = psMod(), EP = ps.constants && ps.constants.ElementPlacement;
    const hair = psTopLayerNamed(PS_HAIR_NAME), bg = psBgLayer();
    const isGroup = !!node.layers;
    let newId = null, dropped = 0;
    try {
      await ps.core.executeAsModal(async function () {
        const hairVis = hair ? hair.visible : false;
        try { await deselectAll(); } catch (_) {}
        try { node.visible = false; } catch (_) {}
        if (hair) { try { hair.visible = false; } catch (_) {} }      // HAIR sits on MERGED, not in it (as Finish)
        if (bg) { try { bg.visible = false; } catch (_) {} }          // original background in the final (as Finish)
        try {
          newId = await kbStampVisibleInModal();                     // from an empty visible layer on top, never the hidden MERGED
          // The versions group, made from Finish's MERGED the first time (in its place).
          let group = node, prev;
          if (replace) {
            const old = isGroup ? (group.layers && group.layers.length ? group.layers[0] : null) : node;
            const n0 = kbLayerById(newId);
            if (old) {
              try { n0.name = isGroup ? psMergedVersionName(newPrint) : String(old.name); } catch (_) {}
              n0.move(old, EP.PLACEBEFORE);
              try { n0.visible = true; } catch (_) {}
              await psDeleteLayerInModal(old.id);
            } else {                                                 // an empty versions group
              try { n0.name = psMergedVersionName(newPrint); } catch (_) {}
              n0.move(group, EP.PLACEINSIDE);
            }
            try { node.visible = true; } catch (_) {}
            return;
          }
          if (!isGroup) {
            prev = node;
            group = kbLayerById(await psGroupInModal([node.id], PS_MERGED_GROUP));
          } else prev = group.layers && group.layers.length ? group.layers[0] : null;
          if (prev && String(prev.name) === PS_MERGED_NAME) { try { prev.name = psMergedVersionName(oldPrint); } catch (_) {} }   // Finish's: named with its print
          const n = kbLayerById(newId);
          try { n.name = psMergedVersionName(newPrint); } catch (_) {}
          if (prev) n.move(prev, EP.PLACEBEFORE); else n.move(group, EP.PLACEINSIDE);
          const kids = Array.from(group.layers || []);
          for (let i = 0; i < kids.length; i++) { try { kids[i].visible = kids[i].id === newId; } catch (_) {} }   // only the newest shows
          for (let i = kids.length - 1; i >= PS_MERGED_KEEP; i--) { await psDeleteLayerInModal(kids[i].id); dropped++; }   // keep 2: the oldest goes
          try { group.visible = true; } catch (_) {}
        } finally {
          if (hair) { try { hair.visible = hairVis; } catch (_) {} }
        }
      }, { commandName: "KBImage — new MERGED" });
      trace("ps merged: new version " + newId + " (" + psMergedVersionName(newPrint) + ")" + (dropped ? ", oldest dropped" : ""));
      psMergedNote(null);
      return "New MERGED built.";
    } catch (err) {
      traceErr("ps merged rebuild", err);
      if (newId != null && newId !== node.id) { try { await deleteLayersById([newId]); } catch (_) {} }
      try { await ps.core.executeAsModal(async function () { const m = kbLayerById(node.id); if (m) m.visible = h ? (h.visible !== false) : true; }, { commandName: "KBImage — show MERGED" }); } catch (_) {}
      const msg = "MERGED could not be rebuilt (" + ((err && err.message) || String(err)) + "). The previous MERGED is shown again; run Finish again for a new one.";
      psMergedNote(msg);
      return msg;
    }
  }

  async function executePsFinish(params) {
    const ps = psMod();
    const doc = ps.app.activeDocument;
    if (!doc) throw new Error("Open a Photoshop document first.");
    const EP = ps.constants && ps.constants.ElementPlacement;
    let step = "stamping the visible result";
    const made = [];
    try {
      let mergedId = null, hairId = null;
      const bg = psBgLayer();
      await ps.core.executeAsModal(async function () {
        step = "moving the PRINT layers into " + PS_BACKUP_GROUP;
        await psBackupTidyInModal();                                   // Backup (and any stray PRINT source / tiled) hidden: never stamped
        const bk = psBackupGroup();
        if (bk) { try { bk.visible = false; } catch (_) {} }
        const shown = psBackupPrints().filter(function (l) { try { return l.visible && (!bk || psParentId(l) !== bk.id); } catch (_) { return false; } });
        if (shown.length) throw new Error(shown.map(function (l) { return String(l.name); }).join(", ") + " is still visible outside " + PS_BACKUP_GROUP);
        step = "stamping the visible result";
        try { await deselectAll(); } catch (_) {}
        if (bg) { try { bg.visible = false; } catch (_) {} }          // original background in the final
        mergedId = await kbStampVisibleInModal(); made.push(mergedId);   // from an empty visible layer on top
        try { await renameActiveLayer(PS_MERGED_NAME); } catch (_) {}
        const m = kbLayerById(mergedId);
        try { if (m && doc.layers[0].id !== mergedId) m.move(doc, EP.PLACEATBEGINNING); }   // above everything
        catch (e) { traceErr("ps finish: move MERGED to the top", e); }
        if (params.hair) {
          step = "making HAIR";
          if (!kbChannelExists(PS_HAIR_CH)) throw new Error("there is no KBPS hair. Turn on Hair in step 1 and run it again.");
          const photo = kbLayerById(psOriginalPhotoId());
          if (!photo) throw new Error("no original photo layer found.");
          let hl;
          try { hl = await photo.duplicate(m, EP.PLACEBEFORE, PS_HAIR_NAME); }
          catch (e) { throw new Error("Copying the photo as HAIR failed — Photoshop said: " + ((e && e.message) || String(e))); }
          hairId = hl.id; made.push(hairId);
          try { hl.visible = true; } catch (_) {}
          await psMaskLayerToChannelInModal(hairId, PS_HAIR_CH, PS_HAIR_NAME, 0);
        }
      }, { commandName: "KBImage — finish" });
      try { const c = $("ps-bg-on"); if (c && bg) c.checked = false; } catch (_) {}
      params.bgHidden = !!bg;
      trace("ps finish: MERGED " + mergedId + (hairId != null ? ", HAIR " + hairId : "") + (bg ? ", BG LIGHTEN hidden" : ""));
      return { layerIds: [mergedId, hairId].filter(function (x) { return x != null; }), afterSnapshotRef: null, state: {} };
    } catch (err) {
      for (let i = made.length - 1; i >= 0; i--) { try { await deleteLayersById([made[i]]); } catch (_) {} }
      const e2 = new Error("Finish failed while " + step + ": " + ((err && err.message) || String(err)));
      e2.cause = err;
      throw e2;
    }
  }
  async function actPsFinish() {
    if (generateInFlight) { kbBusyNote(); return; }
    const ps = psMod();
    if (!ps.app.activeDocument) { setStatus("bad", "Open a Photoshop document first."); return; }
    if (psOtherPending("printswap:finish")) { setStatus("bad", "Accept or Re-run the preview that is waiting first."); return; }
    // Finish replaces the earlier MERGED and HAIR (they would be stamped into the new one otherwise).
    const old = [psTopLayerNamed(PS_MERGED_NAME), psTopLayerNamed(PS_MERGED_GROUP), psTopLayerNamed(PS_HAIR_NAME)].filter(function (l) { return l && !psIsPending(l.id); });
    if (old.length) { try { await deleteLayersById(old.map(function (l) { return l.id; })); } catch (_) {} }
    const params = function () { return { hair: psHairOn() }; };
    const p = params();
    generateInFlight = true;
    traceStart("Print Swap — Finish");
    try {
      await psRecall(9, "ps-recall-anchor-9", { op: "printswap:finish", params: p, targetLayerId: null, sourceRef: "visible",
        paramsProvider: params, execute: executePsFinish });
      setStatus("ok", "MERGED" + (p.hair ? " and HAIR" : "") + " on top" + (p.bgHidden ? ", original background back (BG LIGHTEN off)" : "") + ".");
    } catch (err) {
      traceErr("ps finish", err && err.cause ? err.cause : err);
      setStatus("bad", (err && err.message) || "Finish failed.");
    } finally {
      generateInFlight = false;
      await traceFlush();
    }
  }

  function psHueSatDesc(v) {
    return { _obj: "hueSaturation", presetKind: { _enum: "presetKindType", _value: "presetKindCustom" }, colorize: false,
      adjustment: [{ _obj: "hueSatAdjustmentV2", hue: v.hue, saturation: v.saturation, lightness: v.lightness }] };
  }

  async function actPsWhite() {
    if (generateInFlight) { kbBusyNote(); return; }
    const ps = psMod();
    const doc = ps.app.activeDocument;
    if (!doc) { setStatus("bad", "Open a Photoshop document first."); return; }
    const problem = kbDocProblem(doc);
    if (problem) { setStatus("bad", problem); return; }
    if (!cachedFalKey) { setStatus("bad", "Add your Fal API key in Settings (gear icon) to find the person."); return; }
    if (psOtherPending("printswap:person")) { setStatus("bad", "Accept or Re-run the preview that is waiting first."); return; }
    if (psStepState(1) === "locked") { setStatus("bad", "Step 0 first: Upscale and Accept, or Skip."); return; }
    const old = psStep1Layers().filter(function (l) { return !psIsPending(l.id); });
    if (old.length) {
      if (Date.now() > psWhiteArmUntil) {
        psWhiteArmUntil = Date.now() + 5000;
        setStatus("bad", "This finds the person again and replaces step 1's layers. Click Background again within 5 seconds to go ahead.");
        return;
      }
      psWhiteArmUntil = 0;
      try { await deleteLayersById(old.map(function (l) { return l.id; })); } catch (_) {}
    }
    const params = function () { return { model: "Select Subject / " + PS_SAM_PATH, prompt: "person", hair: psHairOn(), opacity: psBgOpacity(), bgMode: psBgMode() }; };
    const p = params();
    generateInFlight = true;
    traceStart("Print Swap — Background (" + psBgMode() + ")");
    try {
      await psRecall(1, "ps-recall-anchor-1", { op: "printswap:person", params: p, targetLayerId: psOriginalPhotoId(), sourceRef: "photo",
        paramsProvider: params, execute: executePsWhite });
      setStatus(p.hair && !/^refined/.test(String(p.hairBy)) ? "bad" : "ok", (p.bgMode === "white" ? "White background ready." : "Background lightened (" + p.opacity + "%).") + " Person: " + p.personBy + "." + (p.hair ? " Hair: " + p.hairBy + "." : "")
        + (p.hidden && p.hidden.length ? " Hid " + p.hidden.join(", ") + ", which " + (p.hidden.length > 1 ? "were" : "was") + " covering the result." : ""));
    } catch (err) {
      traceErr("ps white", err && err.cause ? err.cause : err);
      setStatus("bad", (err && err.message) || "Background failed.");
    } finally {
      generateInFlight = false;
      await traceFlush();
    }
  }

  // Garment auto edge fix (runs inside Find garment): collar + inside of the
  // collar / back neck added; then KBPS garment grown outward by up to the Grow
  // setting, only into the person and never into skin or hair. Returns the SAM calls made.
  function psGarmentGrow() { return Math.round(kbNum("ps-garment-grow", 4, 0, 20)); }
  async function psGarmentAutoFix(plane, gw, gh, docW, docH) {
    const N = gw * gh, full = { left: 0, top: 0, right: docW, bottom: docH };
    let calls = 0;
    const add = ["collar", "inside of the collar / back neck"];
    for (let i = 0; i < add.length; i++) {
      setStatus("busy", "SAM 3.1: " + add[i] + "…");
      const s = await psSamGrid(add[i], full, gw, gh, docW, docH, false);
      calls += s.calls;
      if (s.plane) for (let k = 0; k < N; k++) if (s.plane[k] > plane[k]) plane[k] = s.plane[k];
    }
    const growPx = psGarmentGrow();
    if (growPx > 0) {
      const block = new Uint8Array(N);                      // skin and hair: never grown into
      const no = ["skin", "hair"];
      for (let i = 0; i < no.length; i++) {
        setStatus("busy", "SAM 3.1: " + no[i] + "…");
        const s = await psSamGrid(no[i], full, gw, gh, docW, docH, false);
        calls += s.calls;
        if (s.plane) for (let k = 0; k < N; k++) if (s.plane[k] > 127) block[k] = 1;
      }
      let person = null;
      if (kbChannelExists(PS_PERSON_CH)) {
        const pa = await psReadMaskAlpha(full, PS_PERSON_CH);
        person = (gw === docW && gh === docH) ? pa : kbResamplePlane(pa, docW, docH, gw, gh);
      }
      const rg = Math.max(1, Math.round(growPx * gw / docW));
      const g = new Uint8Array(N); for (let k = 0; k < N; k++) g[k] = plane[k] > 127 ? 1 : 0;
      const d = psDilate(g, gw, gh, rg);
      let grown = 0;
      for (let k = 0; k < N; k++) {
        if (!d[k] || g[k] || block[k]) continue;
        if (person && person[k] <= 127) continue;
        plane[k] = 255; grown++;
      }
      trace("ps garment grow: " + growPx + " px (grid " + rg + "), " + grown + " grid px added" + (person ? "" : " (no KBPS person: not limited to the person)"));
    }
    calls += await psCuffHandFix(plane, gw, gh, docW, docH);
    if (psHairOn() && kbChannelExists(PS_HAIR_CH)) {         // hair over the garment is not garment
      const ha = await psReadMaskAlpha(full, PS_HAIR_CH);
      const hg = (gw === docW && gh === docH) ? ha : kbResamplePlane(ha, docW, docH, gw, gh);
      for (let k = 0; k < N; k++) if (hg[k]) plane[k] = (plane[k] * (255 - hg[k]) + 127) / 255 | 0;
      trace("ps garment: KBPS hair subtracted");
    }
    return calls;
  }

  // Cuffs and hands: old-garment fringe between the fingers is not caught by the
  // grow (the hands are skin). Around SAM's "sleeve cuff" and "hand", pixels inside
  // the person whose color matches the garment's own color next to the cuff are
  // added to the garment. Skin never matches a garment color. Returns SAM calls.
  async function psCuffHandFix(plane, gw, gh, docW, docH) {
    const N = gw * gh, full = { left: 0, top: 0, right: docW, bottom: docH };
    const area = new Uint8Array(N); let calls = 0, seen = 0;
    const ask = ["sleeve cuff", "hand"];
    for (let i = 0; i < ask.length; i++) {
      setStatus("busy", "SAM 3.1: " + ask[i] + "…");
      const s = await psSamGrid(ask[i], full, gw, gh, docW, docH, false);
      calls += s.calls;
      if (s.plane) for (let k = 0; k < N; k++) if (s.plane[k] > 127) { area[k] = 1; seen++; }
    }
    if (!seen) { trace("ps cuff/hand fix: SAM found no cuff or hand"); return calls; }
    const R = Math.max(3, Math.round(Math.max(gw, gh) * 0.025));
    const near = psDilate(area, gw, gh, R);
    let px = null;
    await psMod().core.executeAsModal(async function () {
      px = await psWithOwnLayersHidden(function () { return psReadCompositePixels(full, Math.max(gw, gh)); });
    }, { commandName: "KBImage — read cuffs and hands" });
    const img = psToRgba(px, gw, gh).rgba;
    let person = null;
    if (kbChannelExists(PS_PERSON_CH)) {
      const pa = await psReadMaskAlpha(full, PS_PERSON_CH);
      person = (gw === docW && gh === docH) ? pa : kbResamplePlane(pa, docW, docH, gw, gh);
    }
    // The garment's color next to the cuffs (median + spread of R, G, B).
    const R0 = [], G0 = [], B0 = [];
    for (let k = 0; k < N; k++) if (near[k] && plane[k] > 200) { R0.push(img[k * 4]); G0.push(img[k * 4 + 1]); B0.push(img[k * 4 + 2]); }
    if (R0.length < 50) { trace("ps cuff/hand fix: too little garment next to the cuffs"); return calls; }
    const med = function (a) { a.sort(function (x, y) { return x - y; }); return a[a.length >> 1]; };
    const mr = med(R0), mg = med(G0), mb = med(B0);
    const d = [];
    for (let i = 0; i < R0.length; i++) d.push(Math.hypot(R0[i] - mr, G0[i] - mg, B0[i] - mb));
    const spread = med(d);
    const tol = Math.max(28, 2.5 * spread);
    let added = 0;
    for (let k = 0; k < N; k++) {
      if (!near[k] || plane[k] > 127) continue;
      if (person && person[k] <= 127) continue;
      if (Math.hypot(img[k * 4] - mr, img[k * 4 + 1] - mg, img[k * 4 + 2] - mb) <= tol) { plane[k] = 255; added++; }
    }
    trace("ps cuff/hand fix: garment color " + [mr, mg, mb].join(",") + " ±" + Math.round(tol) + ", " + added + " grid px added around cuffs and hands");
    return calls;
  }

  // Hands over the garment (runs last in Find garment): SAM 3.1 "hands" is taken off
  // KBPS garment and saved as KBPS hands, which Find piping uses to keep skin out.
  // Long-sleeve types (a HAND TRIM part) also ask "arms" when the hands overlap the
  // garment box; only arm pixels with the hands' skin color come off, so sleeves stay.
  // SAM finds no hands → the garment is not changed. Returns what it did.
  const PS_HANDS_CH = "KBPS hands";
  function psGtypeLongSleeves(t) { return psGtypeParts(t).some(function (p) { return / HAND TRIM$/.test(p.n); }); }
  // Pure: the median color (and a tolerance from its spread) of the pixels where sel[k],
  // read from rgb with `stride` bytes per pixel. null when there are too few.
  function psColorRef(rgb, stride, sel, N, valid) {
    const R0 = [], G0 = [], B0 = [];
    for (let k = 0; k < N; k++) if (sel[k] && (!valid || valid[k])) { R0.push(rgb[k * stride]); G0.push(rgb[k * stride + 1]); B0.push(rgb[k * stride + 2]); }
    if (R0.length < 50) return null;
    const med = function (a) { a.sort(function (x, y) { return x - y; }); return a[a.length >> 1]; };
    const r = { r: med(R0.slice()), g: med(G0.slice()), b: med(B0.slice()), n: R0.length };
    const d = [];
    for (let i = 0; i < R0.length; i++) d.push(Math.hypot(R0[i] - r.r, G0[i] - r.g, B0[i] - r.b));
    r.tol = Math.min(48, Math.max(24, 2.5 * med(d)));       // a mask's soft edge widens the spread: capped
    return r;
  }
  // Pure: take `cut` (0..255) off `plane` (0..255); returns how many pixels left the garment.
  function psSubtractPlane(plane, cut) {
    let removed = 0;
    for (let k = 0; k < plane.length; k++) {
      if (!cut[k]) continue;
      const was = plane[k] > 127;
      plane[k] = (plane[k] * (255 - cut[k]) + 127) / 255 | 0;
      if (was && plane[k] <= 127) removed++;
    }
    return removed;
  }
  // Pure: does any pixel of `b` (> 127) fall inside the box of `plane` (> 127)?
  function psOverlapsBox(plane, b, gw, gh) {
    let l = gw, t = gh, r = -1, bt = -1;
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) if (plane[y * gw + x] > 127) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > bt) bt = y; }
    if (r < 0) return false;
    for (let y = t; y <= bt; y++) for (let x = l; x <= r; x++) if (b[y * gw + x] > 127) return true;
    return false;
  }
  async function psHandsOffGarment(plane, gw, gh, docW, docH) {
    const N = gw * gh, full = { left: 0, top: 0, right: docW, bottom: docH };
    const out = { calls: 0, found: false, arms: false, armsPx: 0, removedPx: 0 };
    await psMod().core.executeAsModal(async function () { await kbRemoveChannels(PS_HANDS_CH); }, { commandName: "KBImage — clear hands" });   // from an earlier Find
    setStatus("busy", "SAM 3.1: hands…");
    const h = await psSamGrid("hands", full, gw, gh, docW, docH, false);
    out.calls += h.calls;
    if (!h.plane) { trace("ps hands: SAM found no hands, garment unchanged"); return out; }
    out.found = true;
    const cut = Uint8Array.from(h.plane);
    const t = psGtypeById(psGarmentType);
    if (t && psGtypeLongSleeves(t) && psOverlapsBox(plane, cut, gw, gh)) {
      setStatus("busy", "SAM 3.1: arms…");
      const a = await psSamGrid("arms", full, gw, gh, docW, docH, false);
      out.calls += a.calls; out.arms = true;
      if (a.plane) {
        let px = null;
        await psMod().core.executeAsModal(async function () {
          px = await psWithOwnLayersHidden(function () { return psReadCompositePixels(full, Math.max(gw, gh)); });
        }, { commandName: "KBImage — read arms" });
        const img = psToRgba(px, gw, gh).rgba;
        const hs = new Uint8Array(N); for (let k = 0; k < N; k++) hs[k] = cut[k] > 127 ? 1 : 0;
        const ref = psColorRef(img, 4, hs, N);
        if (ref) {
          for (let k = 0; k < N; k++) {
            if (a.plane[k] <= 127 || cut[k] > 127) continue;
            if (Math.hypot(img[k * 4] - ref.r, img[k * 4 + 1] - ref.g, img[k * 4 + 2] - ref.b) <= ref.tol) { cut[k] = 255; out.armsPx++; }
          }
          trace("ps hands: arms with the hands' skin color " + [ref.r, ref.g, ref.b].join(",") + " ±" + Math.round(ref.tol) + ": " + out.armsPx + " grid px");
        }
      }
    }
    const removed = psSubtractPlane(plane, cut);
    out.removedPx = Math.round(removed * (docW / gw) * (docH / gh));
    setStatus("busy", "Saving KBPS hands…");
    await psPlaneToChannel(cut, gw, gh, docW, docH, PS_HANDS_CH);
    trace("ps hands: " + removed + " grid px (~" + out.removedPx + " doc px) taken off the garment, " + out.calls + " SAM call(s)" + (out.arms ? ", arms asked" : ""));
    return out;
  }

  // Button fit: inside each SAM button box, the mask is refitted to the button's
  // real edge by brightness against the fabric around it (CLEAN, else MODEL /
  // photo). tight / normal / loose = how far past SAM's outline and how much
  // contrast counts. Falls back to SAM's mask when the button barely differs.
  function psButtonFit() { const v = readPills("pills-ps-button-fit", "tight"); return v === "loose" || v === "normal" ? v : "tight"; }
  async function psFitButtons(instances, rw, rh, rect, alpha) {
    const fit = psButtonFit();
    const P = { tight: { d: 1, k: 1.0 }, normal: { d: 3, k: 0.75 }, loose: { d: 5, k: 0.5 } }[fit];
    const cleanId = psAcceptedCleanId();
    const srcId = cleanId != null ? cleanId : psOriginalPhotoId();
    let src = null;
    await psMod().core.executeAsModal(async function () { src = await psReadLayerRgb(srcId, rect); }, { commandName: "KBImage — read for buttons" });
    const out = new Uint8Array(rw * rh), thread = new Uint8Array(rw * rh);
    let refit = 0, kept = 0, threadPx = 0;
    for (let i = 0; i < instances.length; i++) {
      const m = instances[i];
      let x0 = rw, y0 = rh, x1 = -1, y1 = -1, area = 0;
      for (let y = 0, k = 0; y < rh; y++) for (let x = 0; x < rw; x++, k++) if (m[k]) { area++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (!area) continue;
      const pad = Math.max(4, Math.round(Math.max(x1 - x0, y1 - y0) * 0.3));
      const bx0 = Math.max(0, x0 - pad), by0 = Math.max(0, y0 - pad), bx1 = Math.min(rw - 1, x1 + pad), by1 = Math.min(rh - 1, y1 + pad);
      const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1;
      const L = new Uint8Array(bw * bh), sam = new Uint8Array(bw * bh), fab = [];
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
        const k = (by0 + y) * rw + bx0 + x, o = y * bw + x;
        L[o] = (src.rgb[k * 3] * 77 + src.rgb[k * 3 + 1] * 150 + src.rgb[k * 3 + 2] * 29) >> 8;
        sam[o] = m[k] ? 1 : 0;
        if (!m[k] && alpha[k] > 127) fab.push(L[o]);
      }
      if (fab.length < 20) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (m[y * rw + x]) out[y * rw + x] = 255; kept++; continue; }
      fab.sort(function (a, b) { return a - b; });
      const med = fab[fab.length >> 1];
      const dev = fab.map(function (v) { return Math.abs(v - med); }).sort(function (a, b) { return a - b; });
      const mad = dev[dev.length >> 1];
      const t = Math.max(12, 3 * mad) * P.k;
      const near = psDilate(sam, bw, bh, P.d);
      const fitm = new Uint8Array(bw * bh); let nf = 0;
      for (let o = 0; o < fitm.length; o++) if (near[o] && Math.abs(L[o] - med) >= t) { fitm[o] = 1; nf++; }
      // Holes (thread holes, shine) inside the button are filled: flood the outside from the box border.
      const outside = new Uint8Array(bw * bh), stack = [];
      for (let x = 0; x < bw; x++) { stack.push(x, (bh - 1) * bw + x); }
      for (let y = 0; y < bh; y++) { stack.push(y * bw, y * bw + bw - 1); }
      while (stack.length) { const o = stack.pop(); if (outside[o] || fitm[o]) continue; outside[o] = 1; const x = o % bw, y = (o / bw) | 0;
        if (x > 0) stack.push(o - 1); if (x < bw - 1) stack.push(o + 1); if (y > 0) stack.push(o - bw); if (y < bh - 1) stack.push(o + bw); }
      let filled = 0; for (let o = 0; o < fitm.length; o++) if (!outside[o]) filled++;
      const useFit = nf >= area * 0.3 && filled <= area * 2.5;
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
        const o = y * bw + x, k = (by0 + y) * rw + bx0 + x;
        if (useFit ? !outside[o] : sam[o]) out[k] = 255;
      }
      if (useFit) refit++; else kept++;
      // Thread / hole marks: pixels clearly darker than this button (its own median).
      const bv = [];
      for (let o = 0; o < L.length; o++) if (useFit ? !outside[o] : sam[o]) bv.push(L[o]);
      if (bv.length >= 20) {
        bv.sort(function (a, b) { return a - b; });
        const bmed = bv[bv.length >> 1];
        const bdev = bv.map(function (x) { return Math.abs(x - bmed); }).sort(function (a, b) { return a - b; });
        const tt = Math.max(20, 3 * bdev[bdev.length >> 1]);
        for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
          const o = y * bw + x;
          if ((useFit ? !outside[o] : sam[o]) && L[o] < bmed - tt) { thread[(by0 + y) * rw + bx0 + x] = 255; threadPx++; }
        }
      }
    }
    trace("ps buttons fit (" + fit + "): " + refit + " refitted, " + kept + " kept as SAM made them");
    return { plane: out, thread: thread, threadPx: threadPx, refit: refit, kept: kept, fit: fit };
  }

  // Now that the action handlers exist, replace the placeholder
  // dispatchAction (called from handleClick) with the real router.
  const ACTIONS = {
    "save-fal-key":          actSaveFalKey,      // Settings
    "test-fal-key":          actTestFalKey,
    "show-fal-key":          actShowFalKey,
    "admin-open":            actAdminOpen,
    "status-details":        actStatusDetails,
    "admin-unlock":          actAdminUnlock,
    "admin-reset-key":       actAdminResetKey,
    "open-fal-key-page":     actOpenFalKeyPage,
    "open-help":             actOpenHelp,
    "reset-session":         actResetSession,    // cost counter
    "reset-rates":           actResetRates,
    "recall-accept":         actRecallAccept,    // Accept / Re-run / Discard
    "recall-rerun":          actRecallReRun,
    "recall-discard":        actRecallDiscard,
    "ps-step-toggle":        actPsStepToggle,    // panel: steps, Settings toggles, Start over / Redo
    "ps-toggle-settings":    actPsToggleSettings,
    "ps-start-over":         actPsStartOver,
    "ps-step-redo":          actPsStepRedo,
    "ps-reset-go":           actPsResetGo,
    "ps-reset-cancel":       actPsResetCancel,
    "ps-upscale":            actPsUpscale,       // 0 Upscale (optional)
    "ps-up-skip":            actPsUpSkip,
    "ps-up-keep":            actPsUpKeep,
    "ps-up-again":           actPsUpAgain,
    "ps-up-remove":          actPsUpRemove,
    "ps-white":              actPsWhite,         // 1 Background
    "ps-bg-opacity":         actPsBgOpacity,
    "ps-find-garment":       actPsFindGarment,   // 2 Garment
    "ps-edit-garment":       actPsEditGarment,
    "ps-gtype-confirm":      actPsGtypeConfirm,  // garment type (change after step 2 resets 3–9)
    "ps-gtype-cancel":       actPsGtypeCancel,
    "ps-other-trim":         actPsOtherTrim,     // Other: build a type
    "ps-other-part":         actPsOtherPart,
    "ps-other-add-part":     actPsOtherAddPart,
    "ps-other-save-ask":     actPsOtherSaveAsk,
    "ps-other-save":         actPsOtherSave,
    "ps-other-save-cancel":  actPsOtherSaveCancel,
    "ps-remove-print":       actPsRemovePrint,   // 3 Remove print
    "ps-find-piping":        actPsFindPiping,    // 4 Trims
    "ps-find-buttons":       actPsFindButtons,
    "ps-find-trim":          actPsFindSamTrim,
    "ps-edit-trim":          actPsEditTrim,
    "ps-trim-color":         actPsTrimColor,
    "ps-trim-color-custom":  actPsTrimColorCustom,
    "ps-trim-reshrink":      actPsTrimReshrink,
    "ps-save-piping-case":   actPsSavePipingCase,
    "ps-piping-remargin":    actPsPipingRemargin,
    "ps-make-gray":          actPsMakeGray,      // 5 Gray
    "ps-find-parts":         actPsFindParts,     // 6 Parts
    "ps-part-check":         actPsPartCheck,
    "ps-part-add":           actPsPartAdd,
    "ps-edit-part":          actPsEditPart,
    "ps-toggle-shapes":      actPsToggleShapes,
    "ps-choose-print":       actPsPrintButton,   // 7 Print: Swap print only loads the file
    "ps-apply-print":        actPsApplyPrint,    //   Apply print places / replaces / updates it
    "ps-print-reset":        actPsPrintReset,
    "ps-part-adjust":        actPsPartAdjust,
    "ps-print-rotate":       actPsPrintRotate,
    "ps-build-shade":        actPsBuildShade,    // 8 Shading
    "ps-finish":             actPsFinish,        // 9 Finish
    "ps-edge-apply":         actPsEdgeApply,     // edge softness (steps 1, 2, 4, 6)
    "ps-edge-refine":        actPsEdgeRefine,
  };
  dispatchAction = function (name, srcEl) {
    const fn = ACTIONS[name];
    if (!fn) { try { console.warn(TAG, "no handler for action:", name); } catch (_) {} return; }
    const run = falProgBegin(srcEl);                     // the progress bar goes under this button
    let pb = null;                                       // steps 5 to 9: PB checked before and after
    try {
      if (psPbGuarded(name, srcEl) && name !== "recall-discard") {
        const miss = psTrimsMissingText();                 // a trim group is gone: that first, not the step's own error
        if (miss) { falProgEnd(run); setStatus("bad", miss); return; }
      }
      if (psPbGuarded(name, srcEl)) pb = psPbSnap();
    } catch (_) {}
    const end = function () {
      falProgEnd(run);
      if (pb) psPbCheck(pb).then(function (bad) { if (bad) setTimeout(function () { setStatus("bad", bad); }, 0); }, function () {});
    };
    // An error no action caught still ends in the status line and under the step's button, in red.
    const fail = function (e) { try { traceErr("action " + name, e); setStatus("bad", "Error: " + ((e && e.message) || String(e))); } catch (_) {} end(); };
    let r;
    try { r = fn(srcEl); } catch (e) { fail(e); return; }
    if (r && typeof r.then === "function") r.then(end, fail);
    else end();
  };

  // =======================================================================
  // 4 — start-up: load the key and settings, then show a view.
  // =======================================================================

  async function hydrate() {
    try { cachedFalKey = await loadFalKey(); } catch (_) { cachedFalKey = ""; }
    await adminLoad();
    if (cachedFalKey) {
      if (!adminPinRec) { const $fKey = $("fal-api-key"); if ($fKey) $fKey.value = cachedFalKey; }   // no PIN yet: set one with Save
      setConnFal("ok", adminPinRec ? "saved, locked by admin" : "saved · set an admin PIN and Save to lock it");
    } else { setConnFal("unknown", "no key"); }

    // Cost counter: rates + spend warning; Remove print edge bleed.
    await loadRates();
    await loadThreshold();
    const $warn = $("warn-threshold");
    if ($warn) $warn.value = warnThreshold > 0 ? String(warnThreshold) : "";
    await loadSelBleed();
    const $sb = $("sel-bleed");
    if ($sb) $sb.value = String(cachedSelBleed);
    _rebuildRatesTable();
    resetSession();          // the per-launch cost counter starts now ("since HH:MM")

    // The session log belongs to the active document; follow document changes.
    try {
      const _d = psMod().app.activeDocument;
      currentSessionDocId = (_d && typeof _d.id !== "undefined") ? _d.id : undefined;
    } catch (_) { currentSessionDocId = undefined; }
    registerDocChangeListener();
    registerSelectionListener();   // "Your selection isn't saved to the garment" note
    registerLayerSelectListener(); // a part picked in the Layers panel becomes the selected part
    falTimesLoad().catch(function () {});   // typical render times for the progress bar
    updateDocInfo();
    psCustomLoad().catch(function (e) { try { console.warn(TAG, "saved garment types not loaded:", e); } catch (_) {} });
    // Panel shown again (not reloaded): drop a preview deleted meanwhile.
    try {
      document.addEventListener("uxpcommand", function (e) {
        if (!e || e.commandId !== "uxpshowpanel") return;
        try { recallCheckStale(); } catch (_) {}
        try { psStepsRefresh(); } catch (_) {}
      });
    } catch (_) {}

    const $help = $("help-link");
    if ($help) $help.classList.toggle("hidden", !HELP_URL);

    // Print Swap if the Fal key is saved, Settings otherwise ("Add the Fal key to start").
    adminSync();
    showViewByClass(cachedFalKey ? "printswap" : "settings");
  }

  // hydrate is async but not awaited. If it throws, the body click listener
  // is still live, so the panel stays usable.
  hydrate().catch(function (e) {
    try { console.error(TAG, "hydrate threw:", e); } catch (_) {}
  });
})();
