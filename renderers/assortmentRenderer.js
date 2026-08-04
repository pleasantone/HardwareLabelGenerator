import { renderScrewSVG } from './screwRenderer.js';
import { renderNutSVG } from './nutRenderer.js';
import { renderWasherSVG } from './washerRenderer.js';

// Drawing for one content item. The keys are the same vocabulary that
// ASSORTMENT_ITEM_LABELS in script.js names for the label text; anything not
// listed here is simply not drawn.
const ITEM_RENDERERS = {
  screw: (part) => renderScrewSVG({ ...part, type: 'screw' }, 'side'),
  nut: (part) => renderNutSVG({ ...part, nutStyle: 'hex', isLockNut: false }, 'top'),
  lockNut: (part) => renderNutSVG({ ...part, nutStyle: 'lock', isLockNut: true }, 'top'),
  flatWasher: (part) => renderWasherSVG({ ...part, washerStyle: 'flat' }, 'top'),
  lockWasher: (part) => renderWasherSVG({ ...part, washerStyle: 'lock' }, 'top')
};

const ITEM_WIDTH = 120;
const ITEM_HEIGHT = 160;

// Every other renderer owns a whole 120x160 box. Nesting their output in an
// <svg> of that size keeps each drawing on its native geometry, so the items
// only have to be laid out, not re-scaled by hand.
function placeItem(svgMarkup, x) {
  return svgMarkup
    .trim()
    .replace(
      /^<svg[^>]*>/,
      `<svg x="${x}" y="0" width="${ITEM_WIDTH}" height="${ITEM_HEIGHT}" viewBox="0 0 ${ITEM_WIDTH} ${ITEM_HEIGHT}" preserveAspectRatio="xMidYMid meet">`
    );
}

// Deliberately not on the shared 120x160 viewBox: the box is widened to one
// 120-unit column per item so each drawing keeps the aspect ratio it was tuned
// for. The label CSS scales the whole strip into the usual view slot.
export function renderAssortmentSVG(part, { maxItems = 3 } = {}) {
  const items = (Array.isArray(part.assortmentItems) ? part.assortmentItems : [])
    .filter((item) => ITEM_RENDERERS[item])
    .slice(0, Math.max(1, maxItems));

  if (!items.length) {
    return '';
  }

  const drawings = items
    .map((item, index) => placeItem(ITEM_RENDERERS[item](part), index * ITEM_WIDTH))
    .join('');

  return `
    <svg viewBox="0 0 ${ITEM_WIDTH * items.length} ${ITEM_HEIGHT}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${part.size} hardware assortment">
      ${drawings}
    </svg>
  `;
}
