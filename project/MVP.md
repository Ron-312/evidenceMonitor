# Input Evidence Chrome Extension — MVP Plan

## 1) Goal

Build a **local-only Chrome extension** that records **evidence of scripts interacting with inputs** and exports events with **full stack traces** in a schema compatible with **Explorer** for easy comparison.

### Success criteria (MVP)

* Toggle capture on any page and see **events** when:

  * A script adds listeners to inputs (`input`, `change`, `keyup`, `paste`, `submit`).
  * A script **reads** input/select/textarea values via getters (e.g., `.value`, `.checked`).
* Each event contains: `actionId`, `type`, `start`, `duration`, `data` (outerHTML snippet), `target.id` (stable synthetic id), and `stackTrace[]` (full frames formatted `url:line:col [fn]`).
* Export all captured events as a **JSON** file.

### Non-goals (for MVP)

* Value masking/PII handling (local-only; we can log raw values later if needed).
* Source-map resolution, async causal stacks, or DevTools panel.
* Cloud sync or remote upload.

---

## 2) Primary use cases

1. **Prove who touched an input**: identify third-party/inline bundles that attach listeners or read values.
2. **Reproduce Explorer evidence**: mirror event shape to diff against Explorer logs.
3. **Break on a specific script**: optional breakpoint when a stack frame matches a regex (e.g., `attack\.js`).

---

## 3) Event schema (Explorer-aligned v1)

```json
{
  "actionId": "<random base36>",
  "type": "input.addEventListener(change) | input.value/get | textarea.value/get | select.value/get | input.checked/get",
  "start": 6859.0,
  "duration": 0.1,
  "data": "<input type=\"search\" class=\"form-control\" placeholder=\"Search...\">",
  "target": { "id": "gyubw16yh49x4brk" },
  "stackTrace": [
    "https://cdn.shopify.com/.../attack.js:8:716 [addEventListenerToElement2]",
    "http://localhost:8001/script/internals:5289:43 [functionCall]"
  ]
}
```

Notes:

* `start` is ms since first patch init (`performance.now()` baseline). `duration` is \~0 for getters.
* `data` is a trimmed `outerHTML` (≤300 chars) for visual element identity.
* `target.id` is a synthetic stable id (`WeakMap<Element, id>`), not DOM id.

---

## 4) MVP architecture (Manifest V3)

**Components**

* **Content script**: injects page-world code, bridges `window.postMessage` ⇄ service worker.
* **Injected (page-world) script**: patches prototypes, collects stacks, emits events.
* **Service worker**: stores events in-memory; handles export, settings fan-out.
* **Popup**: on/off toggle, optional breakpoint regex, optional selector filter, export/clear buttons.

**Data flow**
`Injected script (MAIN world) → window.postMessage → Content script → chrome.runtime.sendMessage → Service worker (buffer) → Popup (export)`

---

## 5) MVP scope (phased)

### Phase 0 — Bootstrap

* MV3 `manifest.json` with `content_scripts` (`all_frames: true`, `document_start`).
* Basic popup with **Enable capture** + **Export JSON**.
* Wiring: injected code posts events; SW buffers; Export downloads file.

### Phase 1 — Listener attachments (parity with example)

* Patch `EventTarget.prototype.addEventListener`.
* Record only for `input/textarea/select/form` and events: `input|change|keyup|keydown|paste|submit`.
* Emit Explorer-shaped event: `"<tag>.addEventListener(<type>)"` + full stack.

### Phase 2 — Value reads

* Patch getters on:

  * `HTMLInputElement`: `value`, `checked`, `files`, `valueAsNumber`, `valueAsDate`.
  * `HTMLTextAreaElement`: `value`.
  * `HTMLSelectElement`: `value`, `selectedIndex`.
* Emit `"<tag>.<prop>/get"` events with stack and element snippet.

### Phase 3 — Extras (still MVP)

* Patch `Element.prototype.getAttribute('value')` (some libs read via attribute).
* Patch `FormData(form)` constructor to record serialization events (`"form.formData()"`).
* **Breakpoint regex**: if any stack frame matches, trigger `debugger;` (after emitting).
* **Selector filter**: optional CSS filter to reduce noise (e.g., only `input[name=email]`).

---

## 6) Acceptance tests (MVP)

* **AT-1**: When a page attaches `change` on `<input>`, we capture an `input.addEventListener(change)` event with ≥1 external frame in `stackTrace`.
* **AT-2**: Reading `el.value` inside any handler produces an `input.value/get` event with a non-empty `stackTrace`.
* **AT-3**: `Export JSON` downloads a JSON array containing the above events.
* **AT-4**: Setting breakpoint regex to a known script path pauses DevTools at the moment of capture.
* **AT-5**: Works in **iframes** (same-origin and third-party where injection is allowed), due to `all_frames: true`.

---

## 7) Test plan

* **Local fixture** page with inputs and scripts that:

  1. Attach listeners via a helper (`addEventListenerToElement2`).
  2. Read `.value` repeatedly.
  3. Construct `new FormData(form)`.
* **Cross-origin iframe** test: host an iframe from a local secondary origin; verify events in both.
* **CSP edge**: verify inline injection via appended `<script>`; if blocked, fall back to `src` injection using `chrome.runtime.getURL`.
* **Perf sanity**: measure added overhead on frequent `.value` reads; keep logging toggle OFF by default.

---

## 8) Risks & mitigations

* **Async stacks**: native `Error().stack` is synchronous only → acceptable for MVP.
* **Minified bundles**: stack shows compiled URLs; acceptable for evidence. (Future: source-map lookups via DevTools protocol.)
* **CSP blocking**: rare; use `src`-based injection as fallback.
* **Third-party iframes**: some contexts restrict script execution; capture where allowed.

---

## 9) Backlog (post-MVP)

* DevTools panel with live stream & filters.
* Raw value capture toggle / value-length-only mode.
* First/third-party classification fields; frame origin metadata.
* JSONL export, per-tab sessionization, and small replay viewer.
* **Diff tool**: Node script that normalizes Explorer vs Extension and prints missing/extra.
* Form library heuristics (serialize patterns, virtual inputs, contenteditable).
* Shadow DOM support (patching `ElementInternals`, retargeted events).

---

## 10) Next actions (checklist)

* Create MV3 scaffold (manifest, SW, popup, content injector)
* Implement Phase 1 hooks (listener attachments) + export
* Implement Phase 2 hooks (value reads) + export
* Add breakpoint regex + selector filter (Phase 3)
* Build test fixture pages (same-origin + x-origin iframe)
* Validate AT-1…AT-5 and iterate

*End of MVP plan.*
