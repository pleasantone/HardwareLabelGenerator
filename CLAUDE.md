# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Static, fully client-side browser app that generates printable hardware bin labels (screws, set screws, nuts, washers, bearings, mixed assortments) with SVG technical drawings. Deployed as-is to GitHub Pages.

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

### Screw types carry their own defaults

`screwType` (machine, sheetMetal, wood, drywall, plastic, lag) is what a screw *is*, and `SCREW_TYPE_DEFAULTS` holds what comes with that: a `threadRatio` scaling the size's machine coarse pitch, a `tip`, and a `head`. Changing the type calls `syncTypeSpecificDefaults({ resetScrewType: true })`, which re-seeds all three — changing the *size* deliberately does not, since head and tip belong to the type. The ratio multiplies a metric pitch and divides an SAE TPI, being the same statement either way round.

Machine is the assumption the rest of the app already makes, so it is the only type that adds nothing: no subtitle segment, and `renderSizeName()` keeps the size as it is. Every other type is named in the subtitle and drops the thread designation from the title, because `M5x0.8` and `1/4-20` name a machine thread that a wood screw does not cut — those titles read `5mm × 30mm` and `1/4 × 1.25in`.

In the renderer, `COARSE_THREAD_TYPES` draw a sawtooth silhouette at the pitch instead of hatching a straight shank, `PARTIAL_THREAD_TYPES` leave the top of the shank smooth, and both get a longer gimlet point. `THREAD_DEPTH` is cut deeper than the real root ratios: at label size the shank is about ten units wide, and anything shallower reads as a wavy line rather than a thread. Check any change to it by rasterising, not by reasoning — the failure mode is subtle at 4x and invisible in the numbers.

### A label can describe more than one part

Two fields let one label cover a whole bin, and they compose:

- `lengths` (screw / set screw / assortment) — a free-text spec, either an explicit set (`30, 35, 40`) or the shorthand range (`30-50`). `parseLengthSpec()` returns `{values, min, max, enumerated}`, where `enumerated` is false for the shorthand, because that form does not say what is actually stocked. `lengthStyle` picks the title form (`range` by default, or `list`). Only the *enumerated* case gets the `Lengths: 30/35/40mm` meta line — a shorthand range has nothing more to spell out, and a `list` title already shows it.
- `assortmentItems` (type `assortment`) — a subset of `ASSORTMENT_ITEM_LABELS`' keys, always re-sorted into that map's order by `normalizeAssortmentItems()` so the same box always reads the same way. The keys are drawn by `ITEM_RENDERERS` in `renderers/assortmentRenderer.js`; the two lists must stay in step.

Renderers draw one part, so `withRepresentativeLength()` swaps in the *median* length before drawing a multi-length label. Both `renderFastenerSVG()` and `renderFastenerViews()` apply it, so nothing can bypass it.

An assortment's detail line follows its contents: a box holding washers gets the washer ID/OD/thickness line (`buildWasherDetailLine()`, shared with the washer type) instead of the thread spec, because the title already carries the thread size and the washer OD is the one dimension it cannot imply. A box without washers keeps the thread line.

When the layout has no subtitle at all, `buildMetaLines(part, { includeContents })` moves the contents into the details — on a mixed box that line is the whole point of the label.

### Wording is chosen by measurement, not by template

Nothing is abbreviated up front. A line is emitted at its widest wording with the narrower ones in a `data-fallbacks` attribute, and `applyTextFallbacks()` — run against the preview right after `innerHTML` — steps down only while the element still overflows. So the 75mm tape prints `Nuts • Flat Washers • Lock Washers` while the 22mm prints `Nuts • Flat/Lock Wshr`, from the same code, with no per-template wording config.

The fallbacks, widest first:

| line | wordings |
| --- | --- |
| title | full, `short: true` (range not list, `Kit`, `Star Washer`), and for a washer beside a subtitle, the style dropped entirely |
| contents | `ASSORTMENT_CONTENT_TIERS` — full names, `ASSORTMENT_ITEM_SHORT_LABELS`, then two or more washer kinds merged into one `Flat/Lock Wshr` segment |
| nut / washer / bearing dimensions | all three, then the last one dropped (thickness, thickness, width) |
| lengths | `Lengths: 30/35/40mm`, then the word dropped |

`renderFittedLine()` builds the markup; passing one wording just emits it. Candidates are only offered on micro stock, so sheet labels carry no attribute at all. The overflow test is `scrollWidth > clientWidth || scrollHeight > clientHeight`, which covers both a detail clamped by width and a title clamped by `--title-lines`. Adding a wording means adding it to the array — do not reason about whether it fits, the fallback measures.

One line still has nowhere to go: a bearing's ID and OD overrun the 22mm tape's 73px on their own.

### Renderer conventions

All renderers emit a raw SVG string with a fixed `viewBox="0 0 120 160"`, drawing centered at `x=60` (top views at `y=80`). Geometry is hand-tuned with `clamp`/`Math.min`/`Math.max` so wildly different sizes still fill the box — real-world proportions are deliberately not preserved. Stroke is `#111`, fill `#fff`, so labels print cleanly in mono.

`renderFastenerViews()` in `script.js` decides which views appear per type (screws get side+top, headless screws and nuts/washers/bearings get one).

`assortmentRenderer.js` is the one deliberate exception to the fixed viewBox: it composes the *other* renderers' output into a strip of `120 × N` by `160`, one 120-unit column per item, nesting each drawing in an `<svg x= width= viewBox="0 0 120 160">`. Nesting rather than re-scaling by hand is what keeps every item on the geometry its own renderer was tuned for. It returns `''` when nothing is selected, so both dispatchers filter falsy views. Because the strip is wider than a single drawing, `.label--assortment` gives it a larger view slot in CSS, and `renderLabelMarkup()` caps it at 3 items on full-size stock and 2 below that.

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

Roll templates additionally carry a content budget consumed by `renderLabelMarkup()`: `showVisuals`, `showSubtitle`, `shortSubtitle`, `maxMetaLines`, and `titleLines` (emitted as the `--title-lines` custom property and enforced with `line-clamp`).

`shortSubtitle` drops the end type from screw subtitles. That is safe because micro density renders the **side** view, which draws the end (a taper for `pointed`, a blunt rect for `flat`), whereas `renderDriveSymbol()` runs only in the `view === 'top'` branch — so the drive is the segment nothing else conveys and must be kept. Headless screws keep both segments, having no other descriptor.

At 12mm tape there are only ~10mm and ~3 short lines of printable height, so `.label--micro` sets `overflow: hidden` as a hard guarantee against spilling onto the adjacent label, and clamps each `.label-meta-line` to one line with an ellipsis.

The line budget is measured, not estimated: on 12mm stock `.label-main` is 38px, a title is 12.5px, a subtitle 8.1px and a detail line 8px. That is why enabling `showSubtitle` costs exactly one `maxMetaLines`. If you change what micro labels show, re-measure rather than reasoning about it — `scrollHeight > clientHeight` on `.label-main` is the overflow test.

Location ranks below every other detail: it is appended to the list *before* `maxMetaLines` is applied, so it fills leftover space and is the first line dropped when the budget runs out.

Micro type is sized in `pt`/`mm` rather than `rem` so output is predictable at the printer's 203dpi instead of tracking screen pixels.

### Multi-label state

`labelConfigs[]` + `activeLabelIndex` hold all labels. Every mutation path calls `storeActiveLabel()` (snapshot the form into the active slot) before switching or re-rendering — omitting it silently loses edits. Form `input`/`change` handlers are delegated on the `<form>` and both end with `updatePreview()`.

### JSON import compatibility

`normalizePart()` migrates older exports (e.g. the legacy boolean `isLockNut` → the `nutStyle` enum) and keeps both fields in sync. It also fills in fields that predate an export — `lengths`, `lengthStyle`, `washerStyle`, `assortmentItems` — so a file saved before those existed still imports. When changing a `part` field's representation, extend `normalizePart()` rather than breaking previously exported files.

## Adding a new hardware type

1. Add the `<option>` to `#type` in `index.html` and a `.config-group[data-types="yourType"]` block for its fields.
2. Read those fields in `getCurrentPart()`; write them back in `applyPartToForm()`; seed defaults in `syncTypeSpecificDefaults()`.
3. Add `renderers/yourTypeRenderer.js` exporting `renderYourTypeSVG(part, view)` on the 120×160 viewBox.
4. Wire it into `renderFastenerSVG()` and `renderFastenerViews()`.
5. Add cases to `renderTitle()`, `renderSubtitle()`, and `buildMetaLines()` (including the SAE branch).
