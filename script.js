import {
  defaultGaugeSize,
  gaugeSizeNames,
  getDefaultSizeForStandard,
  getFastenerData
} from './fastener-data.js';
import { renderScrewSVG } from './renderers/screwRenderer.js';
import { renderSetScrewSVG } from './renderers/setScrewRenderer.js';
import { renderNutSVG } from './renderers/nutRenderer.js';
import { renderWasherSVG } from './renderers/washerRenderer.js';
import { renderBearingSVG } from './renderers/bearingRenderer.js';
import { renderAssortmentSVG } from './renderers/assortmentRenderer.js';

// Roll media (thermal label printers) is one label per page: the page itself is
// cut to the label, so there is no sheet margin and capacity is always 1.
// widthMm is the length along the roll; heightMm is the tape width.
function createRollTemplate({ id, label, widthMm, heightMm, showVisuals, maxMetaLines, showSubtitle, shortSubtitle, titleLines }) {
  return {
    id,
    label,
    media: 'roll',
    density: 'micro',
    columns: 1,
    rows: 1,
    widthMm,
    heightMm,
    labelWidth: mmToInches(widthMm),
    labelHeight: mmToInches(heightMm),
    colGap: 0,
    rowGap: 0,
    padTop: 0,
    padRight: 0,
    padBottom: 0,
    padLeft: 0,
    showVisuals,
    showSubtitle,
    shortSubtitle,
    maxMetaLines,
    titleLines
  };
}

const LABEL_TEMPLATES = {
  single: {
    id: 'single',
    label: 'Single Label',
    columns: 1,
    rows: 1,
    labelWidth: 4,
    labelHeight: 2.25,
    colGap: 0,
    rowGap: 0
  },
  '5160': {
    id: '5160',
    label: 'Avery 5160',
    columns: 3,
    rows: 10,
    labelWidth: 2.625,
    labelHeight: 1,
    colGap: 0.125,
    rowGap: 0
  },
  generic30: {
    id: 'generic30',
    label: 'Generic 30-Up (1in × 2 5/8in)',
    columns: 3,
    rows: 10,
    labelWidth: 2.625,
    labelHeight: 1,
    colGap: mmToInches(3),
    rowGap: 0,
    padTop: mmToInches(16),
    padRight: mmToInches(7),
    padLeft: 8.5 - ((2.625 * 3) + (mmToInches(3) * 2) + mmToInches(7)),
    padBottom: 11 - mmToInches(16) - (1 * 10)
  },
  '5163': {
    id: '5163',
    label: 'Avery 5163',
    columns: 2,
    rows: 5,
    labelWidth: 4,
    labelHeight: 2,
    colGap: 0.125,
    rowGap: 0
  },

  // NIIMBOT D11 / D110 / D101 / H1S thermal roll stock.
  // 12mm tape width; the trailing number in the part code is labels per roll,
  // which does not affect layout.
  // 12mm of tape leaves roughly 10mm of printable height. At 7.5pt titles and
  // 5pt details that is a title plus about three more lines, so each budget
  // below is set to fill that height without clipping in the common case.
  niimbot12x22: createRollTemplate({
    id: 'niimbot12x22',
    label: 'NIIMBOT T12*22-260',
    widthMm: 22,
    heightMm: 12,
    // ~19mm of usable width has no room for a drawing beside the text, and the
    // title needs two lines at this width, which leaves room for one detail.
    showVisuals: false,
    showSubtitle: false,
    maxMetaLines: 1,
    titleLines: 2
  }),
  niimbot12x40: createRollTemplate({
    id: 'niimbot12x40',
    label: 'NIIMBOT T12*40-160',
    widthMm: 40,
    heightMm: 12,
    showVisuals: true,
    // The subtitle costs one detail line: 12.5px title + 8.1px subtitle + 2 x 8px
    // detail fills the 38px budget, where a third detail line would overflow.
    showSubtitle: true,
    shortSubtitle: true,
    maxMetaLines: 2,
    titleLines: 1
  }),
  niimbot12x75: createRollTemplate({
    id: 'niimbot12x75',
    label: 'NIIMBOT T12*75-95',
    widthMm: 75,
    heightMm: 12,
    showVisuals: true,
    showSubtitle: true,
    maxMetaLines: 2,
    titleLines: 1
  })
};

const form = document.getElementById('labelForm');
const printBtn = document.getElementById('printBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const importJsonBtn = document.getElementById('importJsonBtn');
const importJsonInput = document.getElementById('importJsonInput');
const addLabelBtn = document.getElementById('addLabelBtn');
const duplicateLabelBtn = document.getElementById('duplicateLabelBtn');
const removeLabelBtn = document.getElementById('removeLabelBtn');
const labelPicker = document.getElementById('labelPicker');
const conditionalGroups = Array.from(document.querySelectorAll('.config-group[data-types]'));

const standardSelect = document.getElementById('standard');
const sizeSelect = document.getElementById('size');
const templateSelect = document.getElementById('averyTemplate');
const labelQuantityInput = document.getElementById('labelQuantity');

const sizeLabel = document.getElementById('sizeLabel');
const lengthLabel = document.getElementById('lengthLabel');
const pitchLabel = document.getElementById('pitchLabel');
const setScrewLengthLabel = document.getElementById('setScrewLengthLabel');
const setScrewPitchLabel = document.getElementById('setScrewPitchLabel');

const sheetPreview = document.getElementById('sheetPreview');
const sheetNotice = document.getElementById('sheetNotice');

let labelConfigs = [];
let activeLabelIndex = 0;

const HEAD_LABELS = {
  pan: 'Pan Head',
  socketCap: 'Socket Cap',
  button: 'Button Head',
  fillister: 'Fillister Head',
  flat: 'Flat Head',
  flat82: '82° Flat Head',
  hex: 'Hex Head',
  hexWasher: 'Hex Washer Head',
  oval: 'Oval Head',
  round: 'Round Head',
  roundWasher: 'Round Washer Head',
  trim: 'Trim Head',
  wafer: 'Wafer Head'
};

const DRIVE_LABELS = {
  phillips: 'Phillips',
  jis: 'JIS Cross',
  hex: 'Hex',
  torx: 'Torx',
  securityTorx: 'Security Torx',
  square: 'Square',
  slotted: 'Slotted'
};

const SCREW_TYPE_LABELS = {
  machine: 'Machine Screw',
  sheetMetal: 'Sheet Metal Screw',
  wood: 'Wood Screw',
  drywall: 'Drywall Screw',
  plastic: 'Thread-Forming Screw',
  lag: 'Lag Screw'
};

const SCREW_TYPE_SHORT_LABELS = {
  machine: 'Machine',
  sheetMetal: 'Sheet Metal',
  wood: 'Wood',
  drywall: 'Drywall',
  plastic: 'Thread-Form',
  lag: 'Lag'
};

// What a box of each type is normally full of. `threadRatio` scales the machine
// coarse pitch for the size: a wood screw at 2.3x really is about a tenth of an
// inch between crests where an M5 machine screw is 0.8mm. Like everything in
// fastener-data.js these are tuned to be right to a turn or so, not to spec.
// The head and tip come with the type — a wood screw countersinks and bites,
// a machine screw sits on the surface and butts against a nut.
const SCREW_TYPE_DEFAULTS = {
  machine: { threadRatio: 1, tip: 'flat', head: 'pan' },
  sheetMetal: { threadRatio: 2, tip: 'pointed', head: 'pan' },
  wood: { threadRatio: 2.3, tip: 'pointed', head: 'flat82' },
  drywall: { threadRatio: 2.3, tip: 'pointed', head: 'flat82' },
  plastic: { threadRatio: 2.2, tip: 'pointed', head: 'pan' },
  lag: { threadRatio: 2.3, tip: 'pointed', head: 'hex' }
};

const END_TYPE_LABELS = {
  pointed: 'Pointed End',
  flat: 'Flat End',
  cup: 'Cup Point',
  cone: 'Cone Point',
  dog: 'Dog Point'
};

const NUT_STYLE_LABELS = {
  hex: 'Hex Nut',
  lock: 'Hex Lock Nut',
  wing: 'Wing Nut',
  keps: 'Keps Nut'
};

const WASHER_STYLE_LABELS = {
  flat: 'Flat Washer',
  lock: 'Split Lock Washer',
  toothed: 'Toothed Lock Washer'
};

// Shop names, used where the full one would not fit.
const WASHER_STYLE_SHORT_LABELS = {
  flat: 'Flat Washer',
  lock: 'Lock Washer',
  toothed: 'Star Washer'
};

// Contents of a mixed-hardware box, in the order they are listed on the label.
// The same keys are drawn by ITEM_RENDERERS in renderers/assortmentRenderer.js.
const ASSORTMENT_ITEM_LABELS = {
  screw: 'Screws',
  nut: 'Nuts',
  lockNut: 'Lock Nuts',
  flatWasher: 'Flat Washers',
  lockWasher: 'Lock Washers',
  toothedWasher: 'Toothed Washers'
};

// One line of 12mm stock fits roughly 24 characters, which three full names
// overrun. These are what the contents collapse to rather than losing the last
// item to an ellipsis.
const ASSORTMENT_ITEM_SHORT_LABELS = {
  screw: 'Screws',
  nut: 'Nuts',
  lockNut: 'Locknuts',
  flatWasher: 'Flat Wshr',
  lockWasher: 'Lock Wshr',
  toothedWasher: 'Star Wshr'
};

// Repeating the noun for every washer kind is what overruns the line, so the
// last tier collapses two or more of them to one segment — `Flat/Lock Wshr`.
const ASSORTMENT_WASHER_ADJECTIVES = {
  flatWasher: 'Flat',
  lockWasher: 'Lock',
  toothedWasher: 'Star'
};

// Wordings for the contents, widest first. Nothing picks one up front: the
// label falls through them at render time and keeps the first that fits.
const ASSORTMENT_CONTENT_TIERS = ['full', 'short', 'merged'];

const BEARING_PRESETS = {
  '608': { innerDiameter: 8, outerDiameter: 22, width: 7, seal: 'shielded' },
  '625': { innerDiameter: 5, outerDiameter: 16, width: 5, seal: 'shielded' },
  '626': { innerDiameter: 6, outerDiameter: 19, width: 6, seal: 'shielded' },
  '627': { innerDiameter: 7, outerDiameter: 22, width: 7, seal: 'shielded' },
  '6000': { innerDiameter: 10, outerDiameter: 26, width: 8, seal: 'sealed' },
  '6001': { innerDiameter: 12, outerDiameter: 28, width: 8, seal: 'sealed' },
  '6002': { innerDiameter: 15, outerDiameter: 32, width: 9, seal: 'sealed' },
  '6003': { innerDiameter: 17, outerDiameter: 35, width: 10, seal: 'sealed' },
  '6004': { innerDiameter: 20, outerDiameter: 42, width: 12, seal: 'sealed' },
  '6200': { innerDiameter: 10, outerDiameter: 30, width: 9, seal: 'sealed' },
  '6201': { innerDiameter: 12, outerDiameter: 32, width: 10, seal: 'sealed' },
  '6202': { innerDiameter: 15, outerDiameter: 35, width: 11, seal: 'sealed' },
  '6203': { innerDiameter: 17, outerDiameter: 40, width: 12, seal: 'sealed' },
  R188: { innerDiameter: 6.35, outerDiameter: 12.7, width: 4.7625, seal: 'shielded' }
};

function applyBearingPreset(presetKey) {
  if (!presetKey || presetKey === 'custom') {
    return;
  }

  const preset = BEARING_PRESETS[presetKey];
  if (!preset) {
    return;
  }

  const bearingIdInput = document.getElementById('bearingID');
  const bearingOdInput = document.getElementById('bearingOD');
  const bearingWidthInput = document.getElementById('bearingWidth');
  const bearingSealInput = document.getElementById('bearingSeal');

  if (bearingIdInput) {
    bearingIdInput.value = preset.innerDiameter;
  }
  if (bearingOdInput) {
    bearingOdInput.value = preset.outerDiameter;
  }
  if (bearingWidthInput) {
    bearingWidthInput.value = preset.width;
  }
  if (bearingSealInput) {
    bearingSealInput.value = preset.seal || 'open';
  }
}

function resolveDriveForHead(head, drive, isHeadless = false) {
  if (isHeadless) {
    return drive;
  }

  return head === 'hex' || head === 'hexWasher'
    ? 'hex'
    : drive;
}

function normalizeNutStyle(style, isLockNut = false) {
  if (style && NUT_STYLE_LABELS[style]) {
    return style;
  }

  return isLockNut ? 'lock' : 'hex';
}

function normalizeScrewType(screwType) {
  return SCREW_TYPE_DEFAULTS[screwType] ? screwType : 'machine';
}

function getScrewTypeDefaults(screwType) {
  return SCREW_TYPE_DEFAULTS[normalizeScrewType(screwType)];
}

function normalizeWasherStyle(style) {
  return WASHER_STYLE_LABELS[style] ? style : 'flat';
}

// Order is fixed by ASSORTMENT_ITEM_LABELS rather than by click order, so the
// same box always reads the same way.
function normalizeAssortmentItems(items) {
  const requested = new Set(Array.isArray(items) ? items : []);
  return Object.keys(ASSORTMENT_ITEM_LABELS).filter((key) => requested.has(key));
}

function normalizePart(part) {
  if (!part || typeof part !== 'object') {
    return part;
  }

  const normalized = {
    ...part,
    // Absent on anything exported before screw types existed, and those were
    // all machine screws.
    screwType: normalizeScrewType(part.screwType),
    lengths: typeof part.lengths === 'string' ? part.lengths : '',
    lengthStyle: part.lengthStyle === 'list' ? 'list' : 'range',
    washerStyle: normalizeWasherStyle(part.washerStyle),
    assortmentItems: normalizeAssortmentItems(part.assortmentItems)
  };

  if (part.type === 'nut') {
    normalized.nutStyle = normalizeNutStyle(part.nutStyle, Boolean(part.isLockNut));
    normalized.isLockNut = normalized.nutStyle === 'lock';
  }

  return normalized;
}

// A box of one thread size in several lengths. Accepts an explicit set
// ("30, 35, 40") or the shorthand range ("30-50"); the shorthand carries no
// list of what is actually inside, so `enumerated` records which was given.
function parseLengthSpec(part) {
  if (!part || (part.type !== 'screw' && part.type !== 'setScrew' && part.type !== 'assortment')) {
    return null;
  }

  const raw = String(part.lengths || '').trim();
  if (!raw) {
    return null;
  }

  const values = [...new Set((raw.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter((value) => value > 0))]
    .sort((a, b) => a - b);

  if (values.length < 2) {
    return null;
  }

  return {
    values,
    min: values[0],
    max: values[values.length - 1],
    enumerated: !/^\d+(?:\.\d+)?\s*[-–—]\s*\d+(?:\.\d+)?$/.test(raw)
  };
}

function formatLengthSpec(part, spec, { forceRange = false } = {}) {
  const useRange = forceRange || !spec.enumerated || part.lengthStyle !== 'list';
  return useRange
    ? `${formatNumber(spec.min, 2)}–${formatNumber(spec.max, 2)}${part.lengthUnit}`
    : `${spec.values.map((value) => formatNumber(value, 2)).join('/')}${part.lengthUnit}`;
}

// Renderers draw one screw, so an assortment is drawn at its middle length —
// the shortest would understate the box and the longest would overstate it.
function withRepresentativeLength(part) {
  const spec = parseLengthSpec(part);
  if (!spec) {
    return part;
  }

  const median = spec.values[Math.floor(spec.values.length / 2)];
  return {
    ...part,
    length: part.standard === 'sae' ? inchesToMm(median) : median,
    lengthDisplay: median
  };
}

function getNutStyleDefaults(baseNut, nutStyle) {
  const style = normalizeNutStyle(nutStyle);
  const widthAcrossFlats = Number(baseNut?.widthAcrossFlats) || 7;
  const thickness = Number(baseNut?.thickness) || 3.2;
  const roundDimension = (value) => Number(value.toFixed(2));

  switch (style) {
    case 'lock':
      return {
        widthAcrossFlats: roundDimension(widthAcrossFlats),
        thickness: roundDimension(thickness * 1.15)
      };
    case 'wing':
      return {
        widthAcrossFlats: roundDimension(widthAcrossFlats * 2.2),
        thickness: roundDimension(thickness * 0.9)
      };
    case 'keps':
      return {
        widthAcrossFlats: roundDimension(widthAcrossFlats * 1.9),
        thickness: roundDimension(thickness * 1.05)
      };
    case 'hex':
    default:
      return {
        widthAcrossFlats: roundDimension(widthAcrossFlats),
        thickness: roundDimension(thickness)
      };
  }
}

// Bearings have no table of their own, so a custom one is derived from the
// washer for the same thread size. Rounded here rather than at the point of
// display, so the derived value cannot reach the form field — or the label — as
// floating-point noise like 23.759999999999998.
function getBearingDefaults(sizeData) {
  const washerInner = Number(sizeData.washer.innerDiameter) || 4;
  const washerOuter = Number(sizeData.washer.outerDiameter) || 9;
  const roundDimension = (value) => Number(value.toFixed(2));

  return {
    innerDiameter: roundDimension(Math.max(2, washerInner)),
    outerDiameter: roundDimension(Math.max(4, washerOuter * 1.8)),
    width: roundDimension(Math.max(2, (washerOuter - washerInner) * 0.45))
  };
}

function syncDriveWithHeadSelection() {
  const headSelect = document.getElementById('head');
  const driveSelect = document.getElementById('drive');
  const headlessInput = document.getElementById('screwHeadless');

  if (!headSelect || !driveSelect) {
    return;
  }

  const resolvedDrive = resolveDriveForHead(
    headSelect.value,
    driveSelect.value || 'phillips',
    Boolean(headlessInput?.checked)
  );
  if (driveSelect.value !== resolvedDrive) {
    driveSelect.value = resolvedDrive;
  }
}

function formatNumber(value, decimals = 2) {
  return Number(value).toFixed(decimals).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

function mmToInches(mmValue) {
  return mmValue / 25.4;
}

function inchesToMm(inchValue) {
  return inchValue * 25.4;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getValue(id) {
  return document.getElementById(id).value.trim();
}

function getChecked(id) {
  return Boolean(document.getElementById(id)?.checked);
}

function getCheckedValues(name) {
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`))
    .map((input) => input.value);
}

function getSizeData(standard, size) {
  const dataSet = getFastenerData(standard);
  const fallback = getDefaultSizeForStandard(standard);
  return dataSet[size] || dataSet[fallback];
}

// Gauge is how the screws that cut their own hole are sold; a machine screw of
// the same diameter is named for its thread instead (#8 versus 8-32), so the two
// lists are kept apart. Callers that are mid-way through populating the form
// pass the context in rather than letting this read half-updated fields.
function offersGaugeSizes({ standard, type, screwType }) {
  return standard === 'sae'
    && (type === 'screw' || type === 'assortment')
    && normalizeScrewType(screwType) !== 'machine';
}

function populateSizeOptions(context = {}) {
  const standard = context.standard || getValue('standard') || 'metric';
  const type = context.type || getValue('type') || 'screw';
  const screwType = context.screwType || getValue('screwType');
  const dataSet = getFastenerData(standard);

  const withGauge = offersGaugeSizes({ standard, type, screwType });
  const sizeKeys = Object.keys(dataSet)
    .filter((sizeKey) => (gaugeSizeNames.includes(sizeKey) ? withGauge : true));

  const current = context.size || sizeSelect.value;
  const defaultSize = withGauge ? defaultGaugeSize : getDefaultSizeForStandard(standard);
  // A size can drop out of the list when the screw type changes under it.
  const selected = sizeKeys.includes(current) ? current : defaultSize;

  sizeSelect.innerHTML = sizeKeys
    .map((sizeKey) => `<option value="${sizeKey}">${sizeKey}</option>`)
    .join('');

  sizeSelect.value = selected;
}

function updateStandardLabels() {
  const standard = getValue('standard') || 'metric';
  const pitchInput = document.getElementById('pitch');
  const setScrewPitchInput = document.getElementById('setScrewPitch');

  sizeLabel.textContent = standard === 'sae' ? 'SAE Size' : 'Metric Size';
  lengthLabel.textContent = standard === 'sae' ? 'Length (in)' : 'Length (mm)';
  pitchLabel.textContent = standard === 'sae' ? 'Threads Per Inch (TPI)' : 'Pitch (mm)';
  if (setScrewLengthLabel) {
    setScrewLengthLabel.textContent = standard === 'sae' ? 'Length (in)' : 'Length (mm)';
  }
  if (setScrewPitchLabel) {
    setScrewPitchLabel.textContent = standard === 'sae' ? 'Threads Per Inch (TPI)' : 'Pitch (mm)';
  }

  if (pitchInput) {
    pitchInput.step = standard === 'sae' ? '1' : '0.05';
  }
  if (setScrewPitchInput) {
    setScrewPitchInput.step = standard === 'sae' ? '1' : '0.05';
  }
}

function getCurrentPart() {
  const standard = getValue('standard') || 'metric';
  const type = getValue('type') || 'screw';
  const size = getValue('size') || getDefaultSizeForStandard(standard);
  const sizeData = getSizeData(standard, size);
  const nutDefaults = sizeData.nut;
  const nutStyle = normalizeNutStyle(getValue('nutStyle'));
  const nutStyleDefaults = getNutStyleDefaults(nutDefaults, nutStyle);
  const washerDefaults = sizeData.washer;
  const bearingDefaults = getBearingDefaults(sizeData);
  const isSetScrew = type === 'setScrew';
  const threadInput = Number(getValue('pitch'))
    || (standard === 'sae' ? (sizeData.threadPerInch || Math.round(25.4 / sizeData.coarsePitch)) : sizeData.coarsePitch);
  const setScrewThreadInput = Number(getValue('setScrewPitch'))
    || (standard === 'sae' ? (sizeData.threadPerInch || Math.round(25.4 / sizeData.coarsePitch)) : sizeData.coarsePitch);

  const pitch = standard === 'sae'
    ? 25.4 / Math.max(isSetScrew ? setScrewThreadInput : threadInput, 1)
    : (isSetScrew ? setScrewThreadInput : threadInput);

  const lengthInput = Number(getValue('length')) || (standard === 'sae' ? 0.5 : 12);
  const setScrewLengthInput = Number(getValue('setScrewLength')) || (standard === 'sae' ? 0.25 : 8);
  const lengthMm = standard === 'sae' ? inchesToMm(lengthInput) : lengthInput;
  const setScrewLengthMm = standard === 'sae' ? inchesToMm(setScrewLengthInput) : setScrewLengthInput;
  const isScrewHeadless = getChecked('screwHeadless');

  const screwType = normalizeScrewType(getValue('screwType'));
  const screwTypeDefaults = getScrewTypeDefaults(screwType);
  const head = getValue('head') || screwTypeDefaults.head;
  const screwDrive = resolveDriveForHead(head, getValue('drive') || 'phillips', isScrewHeadless);
  const setScrewDrive = getValue('setScrewDrive') || 'hex';
  const setScrewPoint = getValue('setScrewPoint') || 'cup';

  return normalizePart({
    standard,
    type,
    size,
    diameter: sizeData.diameter,
    length: isSetScrew ? setScrewLengthMm : lengthMm,
    lengthDisplay: isSetScrew ? setScrewLengthInput : lengthInput,
    lengthUnit: standard === 'sae' ? 'in' : 'mm',
    lengths: getValue('lengths'),
    lengthStyle: getValue('lengthStyle') || 'range',
    pitch,
    threadValue: isSetScrew ? setScrewThreadInput : threadInput,
    head,
    screwType,
    drive: isSetScrew ? setScrewDrive : screwDrive,
    endType: isSetScrew ? setScrewPoint : (getValue('endType') || screwTypeDefaults.tip),
    isHeadless: isScrewHeadless,
    material: getValue('material'),
    finish: getValue('finish'),
    location: getValue('location'),
    vendor: getValue('vendor'),
    sku: getValue('sku'),
    quantity: Math.max(1, Number(getValue('labelQuantity')) || 1),
    isLockNut: nutStyle === 'lock',
    nutStyle,
    widthAcrossFlats: Number(getValue('nutWidthAcrossFlats')) || nutStyleDefaults.widthAcrossFlats,
    nutThickness: Number(getValue('nutThickness')) || nutStyleDefaults.thickness,
    innerDiameter: Number(getValue('washerID')) || washerDefaults.innerDiameter,
    outerDiameter: Number(getValue('washerOD')) || washerDefaults.outerDiameter,
    washerThickness: Number(getValue('washerThickness')) || washerDefaults.thickness,
    washerStyle: normalizeWasherStyle(getValue('washerStyle')),
    assortmentItems: getCheckedValues('assortmentItem'),
    bearingInnerDiameter: Number(getValue('bearingID')) || bearingDefaults.innerDiameter,
    bearingOuterDiameter: Number(getValue('bearingOD')) || bearingDefaults.outerDiameter,
    bearingWidth: Number(getValue('bearingWidth')) || bearingDefaults.width,
    bearingSeal: getValue('bearingSeal') || 'open',
    bearingPreset: getValue('bearingPreset') || 'custom'
  });
}

function applyPartToForm(part) {
  const normalizedPart = normalizePart(part);

  standardSelect.value = part.standard || 'metric';
  // The size list depends on the hardware and screw type, neither of which is on
  // the form yet, so they are handed over rather than read back.
  populateSizeOptions({
    standard: normalizedPart.standard || 'metric',
    type: normalizedPart.type || 'screw',
    screwType: normalizedPart.screwType,
    size: normalizedPart.size
  });
  updateStandardLabels();

  const setField = (id, value) => {
    const element = document.getElementById(id);
    if (element && value !== undefined && value !== null) {
      element.value = value;
    }
  };

  setField('type', normalizedPart.type || 'screw');
  setField('size', normalizedPart.size || getDefaultSizeForStandard(standardSelect.value));
  setField('length', normalizedPart.lengthDisplay || 12);
  setField('setScrewLength', normalizedPart.lengthDisplay || 8);
  setField('pitch', normalizedPart.standard === 'sae' ? (normalizedPart.threadValue || 20) : (normalizedPart.pitch || 0.7));
  setField('setScrewPitch', normalizedPart.standard === 'sae' ? (normalizedPart.threadValue || 20) : (normalizedPart.pitch || 0.7));
  setField('screwType', normalizeScrewType(normalizedPart.screwType));
  setField('head', normalizedPart.head || getScrewTypeDefaults(normalizedPart.screwType).head);
  setField('drive', resolveDriveForHead(normalizedPart.head || 'pan', normalizedPart.drive || 'phillips', Boolean(normalizedPart.isHeadless)));
  setField('setScrewDrive', normalizedPart.drive || 'hex');
  setField('endType', normalizedPart.endType || getScrewTypeDefaults(normalizedPart.screwType).tip);
  setField('setScrewPoint', normalizedPart.endType || 'cup');
  setField('lengths', normalizedPart.lengths || '');
  setField('lengthStyle', normalizedPart.lengthStyle || 'range');
  setField('material', normalizedPart.material || '');
  setField('finish', normalizedPart.finish || '');
  setField('location', normalizedPart.location || '');
  setField('vendor', normalizedPart.vendor || '');
  setField('sku', normalizedPart.sku || '');
  setField('labelQuantity', normalizedPart.quantity || 1);
  setField('nutStyle', normalizeNutStyle(normalizedPart.nutStyle, Boolean(normalizedPart.isLockNut)));
  const screwHeadlessInput = document.getElementById('screwHeadless');
  if (screwHeadlessInput) {
    screwHeadlessInput.checked = Boolean(normalizedPart.isHeadless);
  }
  setField('nutWidthAcrossFlats', normalizedPart.widthAcrossFlats);
  setField('nutThickness', normalizedPart.nutThickness);
  setField('washerID', normalizedPart.innerDiameter);
  setField('washerOD', normalizedPart.outerDiameter);
  setField('washerThickness', normalizedPart.washerThickness);
  setField('washerStyle', normalizedPart.washerStyle || 'flat');

  const selectedItems = new Set(normalizedPart.assortmentItems || []);
  document.querySelectorAll('input[name="assortmentItem"]').forEach((input) => {
    input.checked = selectedItems.has(input.value);
  });

  setField('bearingID', normalizedPart.bearingInnerDiameter);
  setField('bearingOD', normalizedPart.bearingOuterDiameter);
  setField('bearingWidth', normalizedPart.bearingWidth);
  setField('bearingSeal', normalizedPart.bearingSeal || 'open');
  setField('bearingPreset', normalizedPart.bearingPreset || 'custom');

  updateFormOptions();
  syncDriveWithHeadSelection();
}

function storeActiveLabel() {
  if (!labelConfigs[activeLabelIndex]) {
    return;
  }

  labelConfigs[activeLabelIndex] = getCurrentPart();
}

function refreshLabelPicker() {
  const previous = activeLabelIndex;
  labelPicker.innerHTML = labelConfigs
    .map((label, index) => {
      const name = `${index + 1}: ${renderTitle(label)} ×${label.quantity}`;
      return `<option value="${index}">${escapeHtml(name)}</option>`;
    })
    .join('');

  activeLabelIndex = Math.min(previous, labelConfigs.length - 1);
  labelPicker.value = String(activeLabelIndex);

  removeLabelBtn.disabled = labelConfigs.length <= 1;
}

function getSheetSettings() {
  const templateId = templateSelect.value || 'single';
  const template = LABEL_TEMPLATES[templateId] || LABEL_TEMPLATES.single;
  const capacity = template.columns * template.rows;
  const totalLabelCount = labelConfigs.reduce((sum, label) => sum + Math.max(1, Number(label.quantity) || 1), 0);
  const pageCount = Math.max(1, Math.ceil(totalLabelCount / capacity));

  return {
    template,
    totalLabelCount,
    capacity,
    pageCount
  };
}

// `resetScrewType` also re-seeds the head and tip, which belong to the screw
// type rather than to the size — so changing the size leaves them alone.
function syncTypeSpecificDefaults({ resetLength = false, resetScrewType = false } = {}) {
  const standard = getValue('standard') || 'metric';
  const size = getValue('size') || getDefaultSizeForStandard(standard);
  const sizeData = getSizeData(standard, size);
  const screwTypeDefaults = getScrewTypeDefaults(getValue('screwType'));

  const pitchInput = document.getElementById('pitch');
  if (pitchInput) {
    // Coarser thread, fewer turns per inch — the ratio divides the TPI where it
    // multiplies the pitch.
    pitchInput.value = standard === 'sae'
      ? Math.round((sizeData.threadPerInch || Math.round(25.4 / sizeData.coarsePitch)) / screwTypeDefaults.threadRatio)
      : Number((sizeData.coarsePitch * screwTypeDefaults.threadRatio).toFixed(2));
  }

  if (resetScrewType) {
    const headSelect = document.getElementById('head');
    const endTypeSelect = document.getElementById('endType');
    if (headSelect) {
      headSelect.value = screwTypeDefaults.head;
    }
    if (endTypeSelect) {
      endTypeSelect.value = screwTypeDefaults.tip;
    }
    syncDriveWithHeadSelection();
  }

  const lengthInput = document.getElementById('length');
  const setScrewLengthInput = document.getElementById('setScrewLength');
  if (lengthInput && resetLength) {
    lengthInput.value = standard === 'sae' ? 0.5 : 12;
  }
  if (setScrewLengthInput && resetLength) {
    setScrewLengthInput.value = standard === 'sae' ? 0.25 : 8;
  }

  const setScrewPitchInput = document.getElementById('setScrewPitch');
  if (setScrewPitchInput) {
    setScrewPitchInput.value = standard === 'sae'
      ? (sizeData.threadPerInch || Math.round(25.4 / sizeData.coarsePitch))
      : sizeData.coarsePitch;
  }

  const nutWidthInput = document.getElementById('nutWidthAcrossFlats');
  const nutThicknessInput = document.getElementById('nutThickness');
  const nutStyle = normalizeNutStyle(getValue('nutStyle'));
  const nutStyleDefaults = getNutStyleDefaults(sizeData.nut, nutStyle);
  if (nutWidthInput) {
    nutWidthInput.value = nutStyleDefaults.widthAcrossFlats;
  }
  if (nutThicknessInput) {
    nutThicknessInput.value = nutStyleDefaults.thickness;
  }

  const washerIdInput = document.getElementById('washerID');
  const washerOdInput = document.getElementById('washerOD');
  const washerThicknessInput = document.getElementById('washerThickness');
  if (washerIdInput) {
    washerIdInput.value = sizeData.washer.innerDiameter;
  }
  if (washerOdInput) {
    washerOdInput.value = sizeData.washer.outerDiameter;
  }
  if (washerThicknessInput) {
    washerThicknessInput.value = sizeData.washer.thickness;
  }

  const bearingIdInput = document.getElementById('bearingID');
  const bearingOdInput = document.getElementById('bearingOD');
  const bearingWidthInput = document.getElementById('bearingWidth');
  const bearingPresetSelect = document.getElementById('bearingPreset');
  const selectedType = getValue('type') || 'screw';
  const selectedBearingPreset = bearingPresetSelect?.value || 'custom';

  if (selectedType === 'bearing' && selectedBearingPreset !== 'custom') {
    applyBearingPreset(selectedBearingPreset);
    return;
  }

  const bearingDefaults = getBearingDefaults(sizeData);
  if (bearingIdInput) {
    bearingIdInput.value = bearingDefaults.innerDiameter;
  }
  if (bearingOdInput) {
    bearingOdInput.value = bearingDefaults.outerDiameter;
  }
  if (bearingWidthInput) {
    bearingWidthInput.value = bearingDefaults.width;
  }
}

function updateFormOptions() {
  const selectedType = getValue('type') || 'screw';

  conditionalGroups.forEach((group) => {
    const allowedTypes = group.dataset.types
      .split(',')
      .map((type) => type.trim())
      .filter(Boolean);

    const visible = allowedTypes.includes(selectedType);
    group.classList.toggle('is-hidden', !visible);

    group.querySelectorAll('input, select, textarea, button').forEach((control) => {
      control.disabled = !visible;
    });
  });

  const screwHeadlessInput = document.getElementById('screwHeadless');
  const headSelect = document.getElementById('head');
  const driveSelect = document.getElementById('drive');
  const headGroup = headSelect?.closest('.form-group');
  const driveGroup = driveSelect?.closest('.form-group');
  const shouldHideHeadType = selectedType === 'screw' && Boolean(screwHeadlessInput?.checked);

  if (headGroup) {
    headGroup.classList.toggle('is-hidden', shouldHideHeadType);
  }
  if (driveGroup) {
    driveGroup.classList.toggle('is-hidden', shouldHideHeadType);
  }

  if (headSelect && selectedType === 'screw') {
    headSelect.disabled = shouldHideHeadType;
  }
  if (driveSelect && selectedType === 'screw') {
    driveSelect.disabled = shouldHideHeadType;
  }

  const sizeGroup = sizeSelect?.closest('.form-group');
  const hideSizeForBearing = selectedType === 'bearing';
  if (sizeGroup) {
    sizeGroup.classList.toggle('is-hidden', hideSizeForBearing);
  }
  if (sizeSelect) {
    sizeSelect.disabled = hideSizeForBearing;
  }
}

function renderFastenerSVG(basePart, { maxAssortmentItems = 3 } = {}) {
  const part = withRepresentativeLength(basePart);

  switch (part.type) {
    case 'screw':
      return renderScrewSVG(part, 'side');
    case 'setScrew':
      return renderSetScrewSVG(part, 'side');
    case 'nut':
      return renderNutSVG(part, 'top');
    case 'washer':
      return renderWasherSVG(part, 'top');
    case 'bearing':
      return renderBearingSVG(part, 'top');
    case 'assortment':
      return renderAssortmentSVG(part, { maxItems: maxAssortmentItems });
    default:
      return renderScrewSVG(part, 'side');
  }
}

function renderFastenerViews(basePart, { maxAssortmentItems = 3 } = {}) {
  const part = withRepresentativeLength(basePart);

  switch (part.type) {
    case 'screw':
      return part.isHeadless
        ? [renderScrewSVG(part, 'side')]
        : [renderScrewSVG(part, 'side'), renderScrewSVG(part, 'top')];
    case 'setScrew':
      return [renderSetScrewSVG(part, 'side'), renderSetScrewSVG(part, 'top')];
    case 'nut':
      return [renderNutSVG(part, 'top')];
    case 'washer':
      return [renderWasherSVG(part, 'top')];
    case 'bearing':
      return [renderBearingSVG(part, 'top')];
    // One strip already carries every item, so a second view would repeat it.
    case 'assortment':
      return [renderAssortmentSVG(part, { maxItems: maxAssortmentItems })];
    default:
      return [renderScrewSVG(part, 'side'), renderScrewSVG(part, 'top')];
  }
}

// A size designation names a machine thread — `M5x0.8` is a 0.8mm pitch, `1/4-20`
// is 20 turns to the inch. A wood or sheet-metal screw in that hole has neither,
// so it is named by its nominal diameter instead of by a thread it does not cut.
function renderSizeName(part) {
  if (part.type !== 'screw' || normalizeScrewType(part.screwType) === 'machine') {
    return part.size;
  }

  return part.standard === 'sae'
    ? String(part.size).replace(/-\d+$/, '')
    : `${formatNumber(part.diameter, 2)}mm`;
}

// `short` is for stock that clamps the title to a line or two: an enumerated
// length list collapses back to its endpoints rather than being cut off
// mid-number, and the longest words give way to ones that fit.
function renderTitle(part, { short = false } = {}) {
  if (part.type === 'screw' || part.type === 'setScrew') {
    const spec = parseLengthSpec(part);
    const size = renderSizeName(part);
    return spec
      ? `${size} × ${formatLengthSpec(part, spec, { forceRange: short })}`
      : `${size} × ${formatNumber(part.lengthDisplay, 2)}${part.lengthUnit}`;
  }

  if (part.type === 'assortment') {
    return short ? `${part.size} Kit` : `${part.size} Assortment`;
  }

  if (part.type === 'washer') {
    const labels = short ? WASHER_STYLE_SHORT_LABELS : WASHER_STYLE_LABELS;
    return `${part.size} ${labels[normalizeWasherStyle(part.washerStyle)]}`;
  }

  if (part.type === 'bearing') {
    const preset = part.bearingPreset && part.bearingPreset !== 'custom'
      ? String(part.bearingPreset)
      : '';
    return preset ? `${preset} Bearing` : 'Bearing';
  }

  // The size designation already implies the standard (M6x1.0 vs 1/4-20), so the
  // word is dropped. Screws and set screws have never carried it either.
  if (part.type === 'nut') {
    const nutStyleLabel = NUT_STYLE_LABELS[normalizeNutStyle(part.nutStyle, Boolean(part.isLockNut))] || NUT_STYLE_LABELS.hex;
    return `${part.size} ${nutStyleLabel}`;
  }

  return `${part.size} ${part.type.charAt(0).toUpperCase()}${part.type.slice(1)}`;
}

// The screw entry carries the length range so a mixed box still says which
// screws are in it; the other items are fully described by the size in the title.
// The tiers are the wordings to fall back through when the line is too narrow
// for the names in full — see ASSORTMENT_CONTENT_TIERS.
function renderAssortmentContents(part, { tier = 'full' } = {}) {
  const spec = parseLengthSpec(part);
  const labels = tier === 'full' ? ASSORTMENT_ITEM_LABELS : ASSORTMENT_ITEM_SHORT_LABELS;
  const items = part.assortmentItems || [];
  const washers = tier === 'merged' ? items.filter((item) => ASSORTMENT_WASHER_ADJECTIVES[item]) : [];
  const mergeWashers = washers.length > 1;

  const contents = [];

  for (const item of items) {
    if (mergeWashers && ASSORTMENT_WASHER_ADJECTIVES[item]) {
      // Emitted once, where the first washer kind would have gone.
      if (item === washers[0]) {
        contents.push(`${washers.map((key) => ASSORTMENT_WASHER_ADJECTIVES[key]).join('/')} Wshr`);
      }
      continue;
    }

    // A box of wood screws says so, at both tiers — "Wood Screws" is no longer
    // than "Flat Washers" beside it.
    const screwType = normalizeScrewType(part.screwType);
    const label = item === 'screw' && screwType !== 'machine'
      ? `${SCREW_TYPE_SHORT_LABELS[screwType]} Screws`
      : (labels[item] || item);

    contents.push(item === 'screw' && spec
      ? `${label} ${formatLengthSpec(part, spec, { forceRange: true })}`
      : label);
  }

  return contents;
}

// `short` trims the subtitle for narrow stock. It drops the end type, which the
// side-view drawing already shows, and keeps the drive, which it does not —
// renderDriveSymbol() only runs for the top view.
function renderSubtitle(part, { short = false, tier = 'full' } = {}) {
  if (part.type === 'assortment') {
    const contents = renderAssortmentContents(part, { tier });
    return contents.length ? contents.join(' • ') : 'Assorted Hardware';
  }

  if (part.type === 'screw') {
    const head = part.isHeadless ? 'Headless' : (HEAD_LABELS[part.head] || 'Head');
    const drive = DRIVE_LABELS[part.drive] || 'Drive';
    const endType = END_TYPE_LABELS[part.endType] || 'Pointed End';

    // Machine is the assumption everywhere else in the app, so only the types
    // that break it are named — otherwise every screw label grows a segment
    // that says nothing.
    const screwType = normalizeScrewType(part.screwType);
    const typeLabels = short ? SCREW_TYPE_SHORT_LABELS : SCREW_TYPE_LABELS;
    const prefix = screwType === 'machine' ? '' : `${typeLabels[screwType]} • `;

    if (part.isHeadless) {
      // Nothing else describes a headless screw, so both segments are kept.
      return `${prefix}${head} • ${endType}`;
    }

    return short
      ? `${prefix}${head} • ${drive}`
      : `${prefix}${head} • ${drive} • ${endType}`;
  }

  if (part.type === 'setScrew') {
    const drive = DRIVE_LABELS[part.drive] || 'Drive';
    const pointStyle = END_TYPE_LABELS[part.endType] || 'Cup Point';
    return `Set Screw • ${drive} • ${pointStyle}`;
  }

  if (part.type === 'nut') {
    return NUT_STYLE_LABELS[normalizeNutStyle(part.nutStyle, Boolean(part.isLockNut))] || NUT_STYLE_LABELS.hex;
  }

  if (part.type === 'bearing') {
    if (part.bearingSeal === 'sealed') {
      return 'Ball Bearing • Sealed (2RS)';
    }
    if (part.bearingSeal === 'shielded') {
      return 'Ball Bearing • Shielded (ZZ)';
    }
    return 'Ball Bearing • Open';
  }

  const washerLabels = short ? WASHER_STYLE_SHORT_LABELS : WASHER_STYLE_LABELS;
  return washerLabels[normalizeWasherStyle(part.washerStyle)];
}

function formatDimension(part, value) {
  return part.standard === 'sae'
    ? `${formatNumber(mmToInches(value), 3)}in`
    : `${formatNumber(value, 2)}mm`;
}

// `short` drops the last segment — thickness for a washer, width for a bearing —
// which is the least useful of the three when picking one out of a bin, and the
// one that will not fit beside the other two on 12mm stock.
function buildWasherDetailLine(part, { short = false } = {}) {
  const segments = [
    `${formatDimension(part, part.innerDiameter)} ID`,
    `${formatDimension(part, part.outerDiameter)} OD`
  ];

  if (!short) {
    segments.push(`${formatDimension(part, part.washerThickness)} thick`);
  }

  return segments.join(' • ');
}

function buildNutDetailLine(part, { short = false } = {}) {
  const segments = [`${formatDimension(part, part.widthAcrossFlats)} A/F`];

  if (!short) {
    segments.push(`${formatDimension(part, part.nutThickness)} thick`);
  }

  return segments.join(' • ');
}

function buildBearingDetailLine(part, { short = false } = {}) {
  const segments = [
    `${formatDimension(part, part.bearingInnerDiameter)} ID`,
    `${formatDimension(part, part.bearingOuterDiameter)} OD`
  ];

  if (!short) {
    segments.push(`${formatDimension(part, part.bearingWidth)} W`);
  }

  return segments.join(' • ');
}

function hasWasherContents(part) {
  return (part.assortmentItems || []).some((item) => item.endsWith('Washer'));
}

// `includeContents` recovers what the subtitle would have said on stock too
// narrow to show one — for a mixed box that is the whole point of the label.
// `narrowStock` does not shorten anything by itself: it offers the narrower
// wordings as fallbacks, and applyTextFallbacks() only takes one if the line
// it is on actually overflows. A line may therefore be a string or, where
// there is something to fall back to, an array of wordings widest first.
function buildMetaLines(part, { includeContents = false, narrowStock = false } = {}) {
  let detailLine = `${formatNumber(part.pitch, 3)}mm pitch • ⌀${part.diameter.toFixed(1)}mm`;

  if (part.standard === 'sae') {
    detailLine = `${formatNumber(part.threadValue, 0)} TPI • ⌀${formatNumber(mmToInches(part.diameter), 3)}in`;
  }

  if (part.type === 'nut') {
    detailLine = narrowStock
      ? [buildNutDetailLine(part), buildNutDetailLine(part, { short: true })]
      : buildNutDetailLine(part);
  }

  // The thread size is already in an assortment's title, so a box holding
  // washers spends its detail line on the one dimension the title cannot
  // imply — how wide the washers are.
  if (part.type === 'washer' || (part.type === 'assortment' && hasWasherContents(part))) {
    detailLine = narrowStock
      ? [buildWasherDetailLine(part), buildWasherDetailLine(part, { short: true })]
      : buildWasherDetailLine(part);
  }

  if (part.type === 'bearing') {
    detailLine = narrowStock
      ? [buildBearingDetailLine(part), buildBearingDetailLine(part, { short: true })]
      : buildBearingDetailLine(part);
  }

  const metaLines = [];

  // What is in the box outranks the thread spec, so contents lead the details.
  if (includeContents && part.type === 'assortment') {
    const wordings = ASSORTMENT_CONTENT_TIERS
      .map((tier) => renderAssortmentContents(part, { tier }).join(' • '))
      .filter(Boolean);

    if (wordings.length) {
      metaLines.push(narrowStock ? wordings : wordings[0]);
    }
  }

  // A range title says how long the shortest and longest are but not which
  // lengths are actually stocked, so the set is spelled out here instead.
  const lengthSpec = part.type === 'assortment' ? null : parseLengthSpec(part);
  if (lengthSpec && lengthSpec.enumerated && part.lengthStyle !== 'list') {
    const values = `${lengthSpec.values.map((value) => formatNumber(value, 2)).join('/')}${part.lengthUnit}`;
    // The title is already a length range, so the word is the part this line can
    // afford to lose.
    metaLines.push(narrowStock ? [`Lengths: ${values}`, values] : `Lengths: ${values}`);
  }

  metaLines.push(detailLine);

  if (part.type === 'nut') {
    const nutStyle = normalizeNutStyle(part.nutStyle, Boolean(part.isLockNut));
    if (nutStyle === 'lock') {
      metaLines.push('Locking insert');
    }
    if (nutStyle === 'wing') {
      metaLines.push('Hand-tightened wing tabs');
    }
    if (nutStyle === 'keps') {
      metaLines.push('Captive external-tooth washer');
    }
  }

  if (part.material || part.finish) {
    metaLines.push(part.material && part.finish
      ? `${part.material} • ${part.finish}`
      : (part.material || part.finish));
  }

  if (part.vendor) {
    metaLines.push(`Vendor: ${part.vendor}`);
  }

  if (part.sku) {
    metaLines.push(`SKU: ${part.sku}`);
  }

  return metaLines;
}

function uniqueCandidates(candidates) {
  return [...new Set(candidates.filter(Boolean))];
}

// Emits the widest wording, plus the narrower ones for applyTextFallbacks() to
// fall back through if it does not fit.
function renderFittedLine(className, candidates) {
  const wordings = uniqueCandidates(candidates);
  const fallbacks = wordings.length > 1
    ? ` data-fallbacks="${escapeHtml(JSON.stringify(wordings))}"`
    : '';

  return `<div class="${className}"${fallbacks}>${escapeHtml(wordings[0] || '')}</div>`;
}

// Wording that fits beats wording that is short, so nothing is abbreviated up
// front: each line starts at its widest and steps down only while it overflows.
// This has to run after layout — at 5pt in a proportional font the rendered
// width is the only honest measure, and it moves with the template's drawing
// column. Lines clamped by height (a title) and by width (a detail) both report
// through the same test.
function applyTextFallbacks(root) {
  root.querySelectorAll('[data-fallbacks]').forEach((element) => {
    const wordings = JSON.parse(element.dataset.fallbacks);

    for (const wording of wordings) {
      element.textContent = wording;
      if (element.scrollWidth <= element.clientWidth && element.scrollHeight <= element.clientHeight) {
        break;
      }
    }
  });
}

// `maxMetaLines` caps how many detail lines survive. Location ranks below every
// other detail, so it is appended before the cap is applied and is therefore the
// first thing dropped when the budget runs out.
function renderLabelMarkup(part, layout = {}) {
  const {
    density = 'normal',
    showVisuals = true,
    showSubtitle = true,
    shortSubtitle = false,
    maxMetaLines = Infinity
  } = layout;

  const compact = density === 'compact';
  const micro = density === 'micro';

  // Micro stock clamps every line, so each one is offered its short form as a
  // fallback. Which stock it is decides nothing here — only whether the line
  // overflows once rendered, which applyTextFallbacks() settles.
  const titleWordings = [renderTitle(part)];
  if (micro) {
    titleWordings.push(renderTitle(part, { short: true }));
    // Last resort for a long size: the subtitle is naming the style anyway, so
    // the title can give it up rather than end in an ellipsis.
    if (showSubtitle && part.type === 'washer') {
      titleWordings.push(`${part.size} Washer`);
    }
  }
  const titleMarkup = renderFittedLine('label-title', titleWordings);
  const detailLines = buildMetaLines(part, { includeContents: !showSubtitle, narrowStock: micro });

  // Narrow stock has no room for a separate location block, so fold it inline
  // as the lowest-priority line.
  if ((compact || micro) && part.location) {
    detailLines.push(`Loc: ${part.location}`);
  }

  const metaLines = Number.isFinite(maxMetaLines)
    ? detailLines.slice(0, Math.max(0, maxMetaLines))
    : detailLines;

  // One element per line so micro stock can clamp each to a single line.
  const meta = metaLines
    .map((line) => renderFittedLine('label-meta-line', Array.isArray(line) ? line : [line]))
    .join('');

  // A single drawing is all that fits on micro stock; wider media gets both views.
  // Assortment items share one view slot between them, so the smaller the label
  // the fewer of them stay legible — the contents text carries the rest.
  const viewOptions = { maxAssortmentItems: density === 'normal' ? 3 : 2 };
  const views = (showVisuals
    ? (micro ? [renderFastenerSVG(part, viewOptions)] : renderFastenerViews(part, viewOptions))
    : []
  ).filter(Boolean);
  const viewsMarkup = views
    .map((viewSvg) => `<div class="label-view"><div class="label-view-svg">${viewSvg}</div></div>`)
    .join('');
  const visualsMarkup = views.length
    ? `<div class="label-visuals${views.length === 1 ? ' label-visuals--single' : ''}" aria-hidden="true">${viewsMarkup}</div>`
    : '';

  const subtitleWordings = micro
    ? ASSORTMENT_CONTENT_TIERS.map((tier) => renderSubtitle(part, { short: shortSubtitle, tier }))
    : [renderSubtitle(part, { short: shortSubtitle })];
  const subtitleMarkup = showSubtitle
    ? renderFittedLine('label-subtitle', subtitleWordings)
    : '';
  const locationMarkup = !compact && !micro && part.location
    ? `<div class="label-location">${escapeHtml(part.location)}</div>`
    : '';

  const classNames = ['label'];
  if (compact) {
    classNames.push('label--compact');
  }
  if (micro) {
    classNames.push('label--micro');
  }
  if (views.length) {
    classNames.push('label--with-visuals');
  }
  // The assortment strip is wider than a single drawing and needs more of the
  // label to stay readable.
  if (part.type === 'assortment') {
    classNames.push('label--assortment');
  }

  const styleAttr = micro ? ` style="--title-lines:${layout.titleLines || 1}"` : '';

  return `
    <section class="${classNames.join(' ')}"${styleAttr}>
      <div class="label-main">
        <div>
          ${titleMarkup}
          ${subtitleMarkup}
          <div class="label-meta">${meta}</div>
        </div>
        ${locationMarkup}
      </div>
      ${visualsMarkup}
    </section>
  `;
}

function updateSheetNotice(totalCount, capacity, pageCount, template) {
  const labelWord = `${totalCount} label${totalCount === 1 ? '' : 's'}`;

  if (template.media === 'roll') {
    sheetNotice.textContent = `${template.label} preview • ${labelWord} • ${template.widthMm} × ${template.heightMm}mm, one per page (shown enlarged)`;
    return;
  }

  sheetNotice.textContent = `${template.label} preview • ${labelWord} across ${pageCount} page${pageCount === 1 ? '' : 's'} (${capacity} per page)`;
}

// @page cannot be scoped to an element, so the paper size for roll media has to
// be swapped at the document level whenever the template changes.
function updatePageSizeRule(template) {
  let styleEl = document.getElementById('pageSizeRule');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'pageSizeRule';
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = template.media === 'roll'
    ? `@page { size: ${template.widthMm}mm ${template.heightMm}mm; margin: 0; }`
    : '@page { size: auto; margin: 0; }';
}

function updatePreview() {
  storeActiveLabel();
  const { template, totalLabelCount, capacity, pageCount } = getSheetSettings();
  const layout = {
    density: template.density || (template.labelHeight <= 1.2 ? 'compact' : 'normal'),
    showVisuals: template.showVisuals ?? true,
    showSubtitle: template.showSubtitle ?? true,
    shortSubtitle: template.shortSubtitle ?? false,
    maxMetaLines: template.maxMetaLines ?? Infinity,
    titleLines: template.titleLines ?? 1
  };
  const padTop = template.padTop ?? 0.15;
  const padRight = template.padRight ?? 0.15;
  const padBottom = template.padBottom ?? 0.15;
  const padLeft = template.padLeft ?? 0.15;

  printBtn.textContent = totalLabelCount > 1 ? 'Print Labels' : 'Print Label';

  const expandedLabels = [];
  for (const label of labelConfigs) {
    const quantity = Math.max(1, Number(label.quantity) || 1);
    for (let index = 0; index < quantity; index += 1) {
      expandedLabels.push(label);
    }
  }

  const pageMarkup = Array.from({ length: pageCount }, (_, pageIndex) => {
    const start = pageIndex * capacity;
    const end = start + capacity;
    const labelsForPage = expandedLabels.slice(start, end);
    const labelsMarkup = labelsForPage.map((label) => renderLabelMarkup(label, layout)).join('');

    return `
      <div class="sheet-page">
        <div class="sheet-page-title no-print">Page ${pageIndex + 1} of ${pageCount}</div>
        <div
          class="label-sheet-grid"
          style="--cols:${template.columns}; --label-width:${template.labelWidth}in; --label-height:${template.labelHeight}in; --col-gap:${template.colGap}in; --row-gap:${template.rowGap}in; --pad-top:${padTop}in; --pad-right:${padRight}in; --pad-bottom:${padBottom}in; --pad-left:${padLeft}in;"
          data-template="${template.id}"
          data-media="${template.media || 'sheet'}"
        >
          ${labelsMarkup}
        </div>
      </div>
    `;
  }).join('');

  sheetPreview.innerHTML = pageMarkup;
  applyTextFallbacks(sheetPreview);

  updatePageSizeRule(template);
  refreshLabelPicker();
  updateSheetNotice(totalLabelCount, capacity, pageCount, template);
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportCurrentConfig() {
  storeActiveLabel();
  const sheet = getSheetSettings();
  const payload = {
    activeLabelIndex,
    labels: labelConfigs,
    sheet: {
      template: sheet.template.id,
      totalLabelCount: sheet.totalLabelCount,
      capacity: sheet.capacity,
      pageCount: sheet.pageCount
    },
    exportedAt: new Date().toISOString()
  };

  const part = labelConfigs[activeLabelIndex] || getCurrentPart();
  const safeName = `${part.standard}-${part.type}-${part.size}-label-config`.replace(/[^a-z0-9\-_.]/gi, '_').toLowerCase();
  downloadTextFile(`${safeName}.json`, `${JSON.stringify(payload, null, 2)}\n`, 'application/json');
}

function importConfigFromPayload(payload) {
  const labels = Array.isArray(payload?.labels) ? payload.labels : [];
  if (!labels.length) {
    throw new Error('Imported file does not contain any labels.');
  }

  const normalizedLabels = labels
    .filter((label) => label && typeof label === 'object')
    .map((label) => ({
      ...normalizePart(label),
      quantity: Math.max(1, Number(label.quantity) || 1)
    }));

  if (!normalizedLabels.length) {
    throw new Error('Imported labels are not valid objects.');
  }

  const templateId = payload?.sheet?.template;
  if (templateId && LABEL_TEMPLATES[templateId]) {
    templateSelect.value = templateId;
  }

  labelConfigs = normalizedLabels;
  const requestedIndex = Number(payload?.activeLabelIndex);
  activeLabelIndex = Number.isInteger(requestedIndex)
    ? Math.min(Math.max(0, requestedIndex), labelConfigs.length - 1)
    : 0;

  applyPartToForm(labelConfigs[activeLabelIndex]);
  updatePreview();
}

async function importCurrentConfig(file) {
  const text = await file.text();
  const payload = JSON.parse(text);
  importConfigFromPayload(payload);
}

form.addEventListener('input', (event) => {
  if (event.target.id === 'labelPicker') {
    return;
  }

  storeActiveLabel();
  updateFormOptions();
  updatePreview();
});

form.addEventListener('change', (event) => {
  if (event.target.id === 'labelPicker') {
    return;
  }

  if (event.target.id === 'head' || event.target.id === 'screwHeadless') {
    syncDriveWithHeadSelection();
  }

  if (event.target.id === 'bearingPreset') {
    applyBearingPreset(event.target.value);
  }

  if (event.target.id === 'bearingID' || event.target.id === 'bearingOD' || event.target.id === 'bearingWidth') {
    const bearingPresetSelect = document.getElementById('bearingPreset');
    if (bearingPresetSelect) {
      bearingPresetSelect.value = 'custom';
    }
  }

  storeActiveLabel();

  if (event.target.id === 'standard') {
    populateSizeOptions();
    updateStandardLabels();
    syncTypeSpecificDefaults({ resetLength: true });
  }

  if (event.target.id === 'size') {
    syncTypeSpecificDefaults();
  }

  if (event.target.id === 'nutStyle') {
    syncTypeSpecificDefaults();
  }

  // Both of these change which sizes are on offer: gauge is only sold for the
  // screw types that cut their own hole.
  if (event.target.id === 'screwType' || event.target.id === 'type') {
    populateSizeOptions();
  }

  if (event.target.id === 'screwType') {
    syncTypeSpecificDefaults({ resetScrewType: true });
  }

  updateFormOptions();
  updatePreview();
});

labelPicker.addEventListener('change', () => {
  storeActiveLabel();
  activeLabelIndex = Number(labelPicker.value) || 0;
  const nextLabel = labelConfigs[activeLabelIndex];
  if (nextLabel) {
    applyPartToForm(nextLabel);
  }
  updatePreview();
});

addLabelBtn.addEventListener('click', () => {
  storeActiveLabel();
  const newLabel = { ...labelConfigs[activeLabelIndex], quantity: 1 };
  labelConfigs.push(newLabel);
  activeLabelIndex = labelConfigs.length - 1;
  applyPartToForm(newLabel);
  updatePreview();
});

duplicateLabelBtn.addEventListener('click', () => {
  storeActiveLabel();
  const copy = { ...labelConfigs[activeLabelIndex] };
  labelConfigs.push(copy);
  activeLabelIndex = labelConfigs.length - 1;
  applyPartToForm(copy);
  updatePreview();
});

removeLabelBtn.addEventListener('click', () => {
  if (labelConfigs.length <= 1) {
    return;
  }

  labelConfigs.splice(activeLabelIndex, 1);
  activeLabelIndex = Math.max(0, activeLabelIndex - 1);
  applyPartToForm(labelConfigs[activeLabelIndex]);
  updatePreview();
});

form.addEventListener('reset', () => {
  setTimeout(() => {
    populateSizeOptions();
    updateStandardLabels();
    syncTypeSpecificDefaults();
    updateFormOptions();
    labelConfigs = [getCurrentPart()];
    activeLabelIndex = 0;
    updatePreview();
  }, 0);
});

printBtn.addEventListener('click', () => window.print());
exportJsonBtn.addEventListener('click', exportCurrentConfig);
importJsonBtn.addEventListener('click', () => {
  importJsonInput.click();
});
importJsonInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  try {
    await importCurrentConfig(file);
  } catch (error) {
    alert(`Unable to import JSON: ${error.message || 'Invalid file format.'}`);
  } finally {
    importJsonInput.value = '';
  }
});

populateSizeOptions();
updateStandardLabels();
syncTypeSpecificDefaults();
updateFormOptions();
labelConfigs = [getCurrentPart()];
activeLabelIndex = 0;
updatePreview();
