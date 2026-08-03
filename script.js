import { getDefaultSizeForStandard, getFastenerData } from './fastener-data.js';
import { renderScrewSVG } from './renderers/screwRenderer.js';
import { renderSetScrewSVG } from './renderers/setScrewRenderer.js';
import { renderNutSVG } from './renderers/nutRenderer.js';
import { renderWasherSVG } from './renderers/washerRenderer.js';
import { renderBearingSVG } from './renderers/bearingRenderer.js';

// Roll media (thermal label printers) is one label per page: the page itself is
// cut to the label, so there is no sheet margin and capacity is always 1.
// widthMm is the length along the roll; heightMm is the tape width.
function createRollTemplate({ id, label, widthMm, heightMm, showVisuals, maxMetaLines, showSubtitle, titleLines }) {
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
    showSubtitle: false,
    maxMetaLines: 3,
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
  hex: 'Hex',
  torx: 'Torx',
  securityTorx: 'Security Torx',
  slotted: 'Slotted'
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

function normalizePart(part) {
  if (!part || typeof part !== 'object') {
    return part;
  }

  if (part.type !== 'nut') {
    return part;
  }

  const nutStyle = normalizeNutStyle(part.nutStyle, Boolean(part.isLockNut));
  return {
    ...part,
    nutStyle,
    isLockNut: nutStyle === 'lock'
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

function getDataForCurrentStandard() {
  const standard = getValue('standard') || 'metric';
  return getFastenerData(standard);
}

function getSizeData(standard, size) {
  const dataSet = getFastenerData(standard);
  const fallback = getDefaultSizeForStandard(standard);
  return dataSet[size] || dataSet[fallback];
}

function populateSizeOptions() {
  const standard = getValue('standard') || 'metric';
  const dataSet = getDataForCurrentStandard();
  const current = sizeSelect.value;
  const defaultSize = getDefaultSizeForStandard(standard);
  const selected = dataSet[current] ? current : defaultSize;

  sizeSelect.innerHTML = Object.keys(dataSet)
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
  const bearingDefaults = {
    innerDiameter: Math.max(2, Number(sizeData.washer.innerDiameter) || 4),
    outerDiameter: Math.max(4, (Number(sizeData.washer.outerDiameter) || 9) * 1.8),
    width: Math.max(2, ((Number(sizeData.washer.outerDiameter) || 9) - (Number(sizeData.washer.innerDiameter) || 4)) * 0.45)
  };
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

  const head = getValue('head') || 'pan';
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
    pitch,
    threadValue: isSetScrew ? setScrewThreadInput : threadInput,
    head,
    drive: isSetScrew ? setScrewDrive : screwDrive,
    endType: isSetScrew ? setScrewPoint : (getValue('endType') || 'pointed'),
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
  populateSizeOptions();
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
  setField('head', normalizedPart.head || 'pan');
  setField('drive', resolveDriveForHead(normalizedPart.head || 'pan', normalizedPart.drive || 'phillips', Boolean(normalizedPart.isHeadless)));
  setField('setScrewDrive', normalizedPart.drive || 'hex');
  setField('endType', normalizedPart.endType || 'pointed');
  setField('setScrewPoint', normalizedPart.endType || 'cup');
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

function syncTypeSpecificDefaults({ resetLength = false } = {}) {
  const standard = getValue('standard') || 'metric';
  const size = getValue('size') || getDefaultSizeForStandard(standard);
  const sizeData = getSizeData(standard, size);

  const pitchInput = document.getElementById('pitch');
  if (pitchInput) {
    pitchInput.value = standard === 'sae'
      ? (sizeData.threadPerInch || Math.round(25.4 / sizeData.coarsePitch))
      : sizeData.coarsePitch;
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

  if (bearingIdInput) {
    bearingIdInput.value = Math.max(2, Number(sizeData.washer.innerDiameter) || 4);
  }
  if (bearingOdInput) {
    bearingOdInput.value = Math.max(4, (Number(sizeData.washer.outerDiameter) || 9) * 1.8);
  }
  if (bearingWidthInput) {
    bearingWidthInput.value = Math.max(2, ((Number(sizeData.washer.outerDiameter) || 9) - (Number(sizeData.washer.innerDiameter) || 4)) * 0.45);
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

function renderFastenerSVG(part) {
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
    default:
      return renderScrewSVG(part, 'side');
  }
}

function renderFastenerViews(part) {
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
    default:
      return [renderScrewSVG(part, 'side'), renderScrewSVG(part, 'top')];
  }
}

function renderTitle(part) {
  if (part.type === 'screw' || part.type === 'setScrew') {
    return `${part.size} × ${formatNumber(part.lengthDisplay, 2)}${part.lengthUnit}`;
  }

  if (part.type === 'bearing') {
    const preset = part.bearingPreset && part.bearingPreset !== 'custom'
      ? String(part.bearingPreset)
      : '';
    return preset ? `${preset} Bearing` : 'Bearing';
  }

  if (part.type === 'nut') {
    const standardLabel = part.standard === 'sae' ? 'SAE' : 'Metric';
    const nutStyleLabel = NUT_STYLE_LABELS[normalizeNutStyle(part.nutStyle, Boolean(part.isLockNut))] || NUT_STYLE_LABELS.hex;
    return `${standardLabel} ${part.size} ${nutStyleLabel}`;
  }

  const standardLabel = part.standard === 'sae' ? 'SAE' : 'Metric';
  return `${standardLabel} ${part.size} ${part.type.charAt(0).toUpperCase()}${part.type.slice(1)}`;
}

function renderSubtitle(part) {
  if (part.type === 'screw') {
    const head = part.isHeadless ? 'Headless' : (HEAD_LABELS[part.head] || 'Head');
    const drive = DRIVE_LABELS[part.drive] || 'Drive';
    const endType = END_TYPE_LABELS[part.endType] || 'Pointed End';
    return part.isHeadless
      ? `${head} • ${endType}`
      : `${head} • ${drive} • ${endType}`;
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

  return 'Flat Washer';
}

function buildMetaLines(part) {
  let detailLine = `${formatNumber(part.pitch, 3)}mm pitch • ⌀${part.diameter.toFixed(1)}mm`;

  if (part.standard === 'sae') {
    detailLine = `${formatNumber(part.threadValue, 0)} TPI • ⌀${formatNumber(mmToInches(part.diameter), 3)}in`;
  }

  if (part.type === 'nut') {
    detailLine = `${formatNumber(part.widthAcrossFlats, 2)}mm A/F • ${formatNumber(part.nutThickness, 2)}mm thick`;
    if (part.standard === 'sae') {
      detailLine = `${formatNumber(mmToInches(part.widthAcrossFlats), 3)}in A/F • ${formatNumber(mmToInches(part.nutThickness), 3)}in thick`;
    }
  }

  if (part.type === 'washer') {
    detailLine = `${part.innerDiameter}mm ID • ${part.outerDiameter}mm OD • ${part.washerThickness}mm thick`;
    if (part.standard === 'sae') {
      detailLine = `${formatNumber(mmToInches(part.innerDiameter), 3)}in ID • ${formatNumber(mmToInches(part.outerDiameter), 3)}in OD • ${formatNumber(mmToInches(part.washerThickness), 3)}in thick`;
    }
  }

  if (part.type === 'bearing') {
    detailLine = `${part.bearingInnerDiameter}mm ID • ${part.bearingOuterDiameter}mm OD • ${part.bearingWidth}mm W`;
    if (part.standard === 'sae') {
      detailLine = `${formatNumber(mmToInches(part.bearingInnerDiameter), 3)}in ID • ${formatNumber(mmToInches(part.bearingOuterDiameter), 3)}in OD • ${formatNumber(mmToInches(part.bearingWidth), 3)}in W`;
    }
  }

  const metaLines = [detailLine];

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

// `maxMetaLines` caps how many detail lines survive. Location ranks below every
// other detail, so it is appended before the cap is applied and is therefore the
// first thing dropped when the budget runs out.
function renderLabelMarkup(part, layout = {}) {
  const {
    density = 'normal',
    showVisuals = true,
    showSubtitle = true,
    maxMetaLines = Infinity
  } = layout;

  const compact = density === 'compact';
  const micro = density === 'micro';

  const title = escapeHtml(renderTitle(part));
  const detailLines = buildMetaLines(part);

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
    .map((line) => `<div class="label-meta-line">${escapeHtml(line)}</div>`)
    .join('');

  // A single drawing is all that fits on micro stock; wider media gets both views.
  const views = showVisuals
    ? (micro ? [renderFastenerSVG(part)] : renderFastenerViews(part))
    : [];
  const viewsMarkup = views
    .map((viewSvg) => `<div class="label-view"><div class="label-view-svg">${viewSvg}</div></div>`)
    .join('');
  const visualsMarkup = views.length
    ? `<div class="label-visuals${views.length === 1 ? ' label-visuals--single' : ''}" aria-hidden="true">${viewsMarkup}</div>`
    : '';

  const subtitleMarkup = showSubtitle
    ? `<div class="label-subtitle">${escapeHtml(renderSubtitle(part))}</div>`
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

  const styleAttr = micro ? ` style="--title-lines:${layout.titleLines || 1}"` : '';

  return `
    <section class="${classNames.join(' ')}"${styleAttr}>
      <div class="label-main">
        <div>
          <div class="label-title">${title}</div>
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
