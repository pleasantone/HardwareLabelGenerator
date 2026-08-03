# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Static, fully client-side browser app that generates printable hardware bin labels (screws, set screws, nuts, washers, bearings) with SVG technical drawings. Deployed as-is to GitHub Pages.

## Running

No build step, no package manager, no test suite, no linter. The app uses native ES modules (`<script type="module">`), so it **must be served over HTTP** — opening `index.html` via `file://` breaks the module imports.

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

Verify changes by loading the page and exercising the form; printing behavior is checked via the browser's print preview.

## Architecture

Five files do the work: `index.html` (form markup), `script.js` (state + orchestration), `fastener-data.js` (dimension tables), `renderers/*.js` (SVG drawing), `style.css` (screen + print).

Note the `#averyTemplate` select id predates non-Avery templates; it is kept because it is a stable DOM contract. The JS constant is `LABEL_TEMPLATES`.

### The `part` object is the single data contract

`getCurrentPart()` in `script.js` reads every form field into one flat `part` object. That object is the *only* thing passed to renderers, label markup, and JSON export. All five renderers take `(part, view)` and return an SVG string. Adding a field means touching `getCurrentPart()`, `applyPartToForm()` (the inverse, used by label switching and JSON import), and whichever renderer consumes it.

Note that `getCurrentPart()` reads *all* field ids unconditionally, including fields hidden for the current hardware type — so a `part` always carries nut, washer, and bearing values regardless of `part.type`.

### Everything is millimeters internally

SAE is a presentation/input concern only. `getCurrentPart()` converts inch lengths to mm (`inchesToMm`) and TPI to a mm pitch on the way in; `buildMetaLines()` converts back with `mmToInches` on the way out. Renderers never see inches. Keep new dimensions in mm.

### Fastener dimensions are computed, not tabulated

`fastener-data.js` does not contain real spec-table values. `createFastenerSize(diameter, pitch, tpi)` derives head/nut/washer dimensions from the nominal diameter via ratio formulas. Thread sizes are declared as `[name, diameter, pitch|tpi]` tuples in `metricThreadSeries` / `saeThreadSeries`. To add a size, add a tuple — the dimensions follow automatically. These values are approximations tuned for drawing, not for engineering.

### Conditional form fields

Type-specific field groups are declared in HTML as `.config-group[data-types="screw,nut"]`. `updateFormOptions()` toggles `.is-hidden` and sets `disabled` on their controls based on the selected type. Adding a new type-specific control means adding a `data-types` group in `index.html` — no JS registry to update.

### Renderer conventions

All renderers emit a raw SVG string with a fixed `viewBox="0 0 120 160"`, drawing centered at `x=60` (top views at `y=80`). Geometry is hand-tuned with `clamp`/`Math.min`/`Math.max` so wildly different sizes still fill the box — real-world proportions are deliberately not preserved. Stroke is `#111`, fill `#fff`, so labels print cleanly in mono.

`renderFastenerViews()` in `script.js` decides which views appear per type (screws get side+top, headless screws and nuts/washers/bearings get one).

### Sheet layout and printing

`LABEL_TEMPLATES` in `script.js` defines each template in **inches** (columns, rows, label size, gaps, optional `padTop`/`padRight`/`padBottom`/`padLeft`). `updatePreview()` expands `labelConfigs` by per-label `quantity`, chunks them into pages by template capacity, and passes the template geometry to CSS as custom properties (`--cols`, `--label-width`, `--pad-top`, …) on `.label-sheet-grid`. Layout math lives in CSS grid, not JS.

Print output is the same DOM: `@media print` hides `.no-print`, drops borders, and forces page breaks per `.sheet-page`. Anything screen-only must carry the `no-print` class.

### Two media types

`template.media` is `'sheet'` (default) or `'roll'`.

Roll templates are thermal stock (NIIMBOT 12mm tape) built by `createRollTemplate()`, which takes **mm** and is the source of truth for the page size; the inch fields are derived. They are always `columns: 1, rows: 1` with zero padding, so the existing capacity math naturally yields one label per page.

Because `@page` cannot be scoped to an element, `updatePageSizeRule()` swaps a document-level `<style id="pageSizeRule">` whenever the template changes — `@page { size: 75mm 12mm }` for roll, `size: auto` for sheet. Forgetting to call it leaves the previous template's paper size active.

### Three density tiers

`layout.density` selects how much content a label shows:

| density | trigger | behavior |
| --- | --- | --- |
| `normal` | default | full type, both SVG views, separate location block |
| `compact` | `labelHeight <= 1.2in` | smaller type, location folded into meta |
| `micro` | set explicitly by roll templates | mm/pt sizing, single SVG view, one line per detail |

Roll templates additionally carry a content budget consumed by `renderLabelMarkup()`: `showVisuals`, `showSubtitle`, `maxMetaLines`, and `titleLines` (emitted as the `--title-lines` custom property and enforced with `line-clamp`).

At 12mm tape there are only ~10mm and ~3 short lines of printable height, so `.label--micro` sets `overflow: hidden` as a hard guarantee against spilling onto the adjacent label, and clamps each `.label-meta-line` to one line with an ellipsis. `maxMetaLines` counts only the detail lines from `buildMetaLines()` — the location line is appended afterwards so it is never the thing that gets truncated. If you widen what micro labels show, re-measure: `scrollHeight > clientHeight` on `.label-main` is the overflow test.

Micro type is sized in `pt`/`mm` rather than `rem` so output is predictable at the printer's 203dpi instead of tracking screen pixels.

### Multi-label state

`labelConfigs[]` + `activeLabelIndex` hold all labels. Every mutation path calls `storeActiveLabel()` (snapshot the form into the active slot) before switching or re-rendering — omitting it silently loses edits. Form `input`/`change` handlers are delegated on the `<form>` and both end with `updatePreview()`.

### JSON import compatibility

`normalizePart()` migrates older exports (e.g. the legacy boolean `isLockNut` → the `nutStyle` enum) and keeps both fields in sync. When changing a `part` field's representation, extend `normalizePart()` rather than breaking previously exported files.

## Adding a new hardware type

1. Add the `<option>` to `#type` in `index.html` and a `.config-group[data-types="yourType"]` block for its fields.
2. Read those fields in `getCurrentPart()`; write them back in `applyPartToForm()`; seed defaults in `syncTypeSpecificDefaults()`.
3. Add `renderers/yourTypeRenderer.js` exporting `renderYourTypeSVG(part, view)` on the 120×160 viewBox.
4. Wire it into `renderFastenerSVG()` and `renderFastenerViews()`.
5. Add cases to `renderTitle()`, `renderSubtitle()`, and `buildMetaLines()` (including the SAE branch).
