# Hardware Label Generator

A static, browser-based label generator for hardware bins and organizers.

It creates printable labels with technical details and SVG visuals for:
- Screws
- Set screws
- Nuts
- Washers
- Bearings

The project is fully client-side (HTML/CSS/JavaScript), so it works well on GitHub Pages.

## Features

- Dynamic form options by hardware type
- Metric and inch/SAE support for threaded hardware
- Detailed screw controls:
  - Head type
  - Drive type
  - End type
  - Optional headless mode
- Set screw controls:
  - Drive type
  - Point style
  - Length and pitch/TPI
- Nut controls with style options:
  - Hex
  - Hex lock
  - Wing
  - Keps
- Washer controls with ID/OD/thickness
- Bearing controls with:
  - Preset sizes (e.g. 608, 6203)
  - ID/OD/width fields
  - Seal type (Open / ZZ / 2RS)
- Multi-label manager:
  - Add, duplicate, remove labels
  - Switch active label
  - Per-label quantity
- Sheet templates (US Letter):
  - Single label
  - Avery 5160
  - Generic 30-up (1in × 2 5/8in)
  - Avery 5163
  - Multi-page overflow preview
- NIIMBOT thermal roll templates (D11 / D110 / D101 / H1S, 12mm tape):
  - T12*22-260 (12 × 22mm)
  - T12*40-160 (12 × 40mm)
  - T12*75-95 (12 × 75mm)
- Print-ready output
- JSON export and JSON import of label configurations
- Workspace-style dotted background in preview area (non-print)

## Project Structure

- [index.html](index.html) – UI layout and form controls
- [style.css](style.css) – app, preview, and print styles
- [script.js](script.js) – app state, rendering flow, import/export, events
- [fastener-data.js](fastener-data.js) – metric/SAE fastener dimensions and thread sizes
- [renderers/screwRenderer.js](renderers/screwRenderer.js) – screw SVG rendering
- [renderers/setScrewRenderer.js](renderers/setScrewRenderer.js) – set screw SVG rendering
- [renderers/nutRenderer.js](renderers/nutRenderer.js) – nut SVG rendering
- [renderers/washerRenderer.js](renderers/washerRenderer.js) – washer SVG rendering
- [renderers/bearingRenderer.js](renderers/bearingRenderer.js) – bearing SVG rendering
- [favicon.svg](favicon.svg) – app icon

## Supported Thread Size Sets

### Metric
Includes general and thread-specific metric options such as:
- M2, M2.5, M3, M4, M5, M6, M8
- M3x0.5, M4x0.7, M5x0.8, M6x1.0, M7x1.0
- M8x1.0, M8x1.25
- M10x1.0, M10x1.25, M10x1.5
- M12x1.25, M12x1.5, M12x1.75

### Inch / SAE
- 6-40, 6-32
- 8-32
- 10-24, 10-32
- 1/4-20, 1/4-28
- 5/16-18, 5/16-24
- 3/8-16, 3/8-24
- 7/16-14, 7/16-20
- 1/2-13, 1/2-20


## How to Use

1. Select standard and hardware type.
2. Fill in size/dimension fields and optional metadata (material, finish, vendor, SKU, location).
3. Choose label quantity and template.
4. Use label manager to add/duplicate/remove labels.
5. Print using **Print Label(s)**.
6. Save/load configurations with **Export JSON** / **Import JSON**.

## JSON Import/Export Format

Exported files include:
- `activeLabelIndex`
- `labels` (array of label configs)
- `sheet` (template/capacity/page count)
- `exportedAt`

Import expects this structure and restores labels + template selection.

## Printing Notes

- Printing uses dedicated `@media print` styles.
- Non-print UI is hidden automatically.
- Sheet pages break correctly for multi-page output.

### NIIMBOT roll labels

- Each label prints as its own page sized exactly to the stock (e.g. `75mm × 12mm`),
  so quantity 5 produces 5 pages.
- Roll labels are shown enlarged in the preview; they print at true size.
- In the print dialog, set scale to 100% (not "Fit to page") and pick the NIIMBOT
  printer before printing, so the page size set by the app is used as-is.
- 12mm of tape leaves roughly 10mm of printable height — about three short lines.
  The templates drop detail lines on the narrower stock rather than shrinking text
  to an unreadable size. Location is the lowest-priority line: it fills leftover
  space and is the first thing dropped.

What each 12mm template prints, highest priority first:

| | T12*22 | T12*40 | T12*75 |
| --- | :-: | :-: | :-: |
| Title | ✅ | ✅ | ✅ |
| Dimensions | ✅ | ✅ | ✅ |
| Drawing | — | ✅ | ✅ |
| Subtitle | — | ✅ (short) | ✅ (full) |
| Material / finish | — | ✅ | ✅ |
| Vendor, SKU | — | — | — |
| Location | — | if room | if room |

Titles omit the "Metric"/"SAE" word throughout the app, since the size designation
already implies it (`M6x1.0` vs `1/4-20`).
