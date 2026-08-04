# Hardware Label Generator

A static, browser-based label generator for hardware bins and organizers.

It creates printable labels with technical details and SVG visuals for:
- Screws
- Set screws
- Nuts
- Washers
- Bearings
- Assortments (one bin holding several lengths, or a mix of nuts and washers)

The project is fully client-side (HTML/CSS/JavaScript), so it works well on GitHub Pages.

## Features

- Dynamic form options by hardware type
- Metric and inch/SAE support for threaded hardware
- Detailed screw controls:
  - Screw type (machine, sheet metal / self-tapping, wood, drywall,
    thread-forming for plastic, lag), each seeding its own thread pitch, head
    and tip, and each drawn with the thread it actually cuts
  - Gauge sizing (#2–#14) for the types sold that way, titled `#8 × 1.25in`
  - Head type
  - Drive type (Phillips, JIS, hex, Torx, security Torx, square/Robertson,
    slotted)
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
- Washer controls with ID/OD/thickness and style options:
  - Flat
  - Split lock
  - Toothed lock (star)
- Assortment labels for bins that hold more than one part:
  - Several lengths of one thread size, titled as a range (`M5x0.8 × 30–50mm`)
    or a list (`M5x0.8 × 30/35/40/45/50mm`)
  - Mixed boxes (`M5x0.8 Assortment` / `Nuts • Flat Washers • Lock Washers`),
    drawn as one strip with a drawing per item
  - Detail line follows the contents: washer ID/OD/thickness when the box holds
    washers, otherwise the thread spec
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
- Work in progress is kept in browser local storage, so a refresh or a closed
  tab does not lose the labels; **Reset** starts over
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
- [renderers/assortmentRenderer.js](renderers/assortmentRenderer.js) – mixed-box strip composed from the other renderers
- [favicon.svg](favicon.svg) – app icon

## Supported Thread Size Sets

### Metric
Includes general and thread-specific metric options such as:
- M2, M2.5, M3, M4, M5, M6, M8
- M3x0.5, M4x0.7, M5x0.8, M6x1.0, M7x1.0
- M8x1.0, M8x1.25
- M10x1.0, M10x1.25, M10x1.5
- M12x1.25, M12x1.5, M12x1.75

### Screw gauge
Offered for the screw types sold that way — wood, sheet metal, drywall,
thread-forming and lag — alongside the fractional sizes:
- #2, #4, #6, #8, #10, #12, #14

Machine screws keep the thread designation instead (`8-32`, not `#8`), since
that is how they are sold.

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
  so quantity 5 produces 5 pages, and the label is centred in the page width.
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

Nothing is abbreviated unless it has to be. Each line is laid out at its full
wording and only steps down to a shorter one while it would otherwise end in an
ellipsis, so the same box prints differently on each stock:

| | T12*75 | T12*40 | T12*22 |
| --- | --- | --- | --- |
| Title | `M5x0.8 Assortment` | `M5x0.8 Assortment` | `M5x0.8 Assortment` |
| Contents | `Nuts • Flat Washers • Lock Washers` | `Nuts • Flat Wshr • Lock Wshr` | `Nuts • Flat/Lock Wshr` |
| Washer size | `5.3mm ID • 11mm OD • 1.25mm thick` | `5.3mm ID • 11mm OD` | `5.3mm ID • 11mm OD` |

Longer sizes and fuller boxes step down sooner — an `M12x1.75` mixed box titles
itself `M12x1.75 Kit` on the 40mm tape but stays `M12x1.75 Assortment` on the
75mm. The same applies outside assortments: a length list stays a list where it
fits and becomes a range where it does not, and nut, washer and bearing dimension
lines drop their last figure only when the line would overflow.

What is left is a hard budget, not an item count: roughly 25 characters on the
40mm tape and 19 on the 22mm. Three items fit comfortably; a fourth fits only if
the names are short, so `Nuts • Flat/Lock/Star Wshr` makes it and
`Screws • Nuts • Flat/Lock Wshr` still ends in an ellipsis. The drawings and the
size in the title carry the rest.
