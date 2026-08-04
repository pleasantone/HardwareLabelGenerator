import { getFastenerData, getDefaultSizeForStandard } from '../fastener-data.js';

const pointOnCircle = (cx, cy, radius, degrees) => {
  const radians = (degrees * Math.PI) / 180;
  return `${(cx + radius * Math.cos(radians)).toFixed(2)} ${(cy + radius * Math.sin(radians)).toFixed(2)}`;
};

export function renderWasherSVG(part, view = 'top') {
  const dataSet = getFastenerData(part.standard);
  const fallbackSize = getDefaultSizeForStandard(part.standard);
  const sizeData = dataSet[part.size] || dataSet[fallbackSize];
  const innerDiameter = Number(part.innerDiameter) || sizeData.washer.innerDiameter;
  const outerDiameter = Number(part.outerDiameter) || sizeData.washer.outerDiameter;
  const thickness = Number(part.washerThickness) || sizeData.washer.thickness;

  const isLock = part.washerStyle === 'lock';
  const isToothed = part.washerStyle === 'toothed';

  const centerX = 60;
  const centerY = 80;
  const outerRadius = Math.max(20, Math.min(45, (outerDiameter / 2) * 6));
  const innerRadius = Math.max(7, Math.min(22, (innerDiameter / 2) * 6));

  if (view === 'side') {
    const bodyWidth = Math.max(44, Math.min(100, outerDiameter * 6.2));
    const bodyHeight = Math.max(6, Math.min(16, thickness * 6));
    const bodyX = centerX - bodyWidth / 2;
    const bodyY = centerY - bodyHeight / 2;
    const slotWidth = Math.max(8, Math.min(28, innerDiameter * 2.8));

    // The split raises one end by roughly its own thickness, so the side view
    // shows the far end stepped up rather than a plain flat bar.
    const stepMarkup = isLock
      ? `<rect x="${bodyX + bodyWidth * 0.82}" y="${bodyY - bodyHeight * 0.85}" width="${bodyWidth * 0.18}" height="${bodyHeight}" fill="#fff" stroke="#111" stroke-width="2" />`
      : '';

    const sideLabel = (isLock && 'Split lock washer') || (isToothed && 'Toothed lock washer') || 'Washer';

    return `
      <svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${sideLabel} side view">
        <rect x="${bodyX}" y="${bodyY}" width="${bodyWidth}" height="${bodyHeight}" fill="#fff" stroke="#111" stroke-width="2" />
        ${stepMarkup}
        <line x1="${centerX - slotWidth / 2}" y1="${centerY}" x2="${centerX + slotWidth / 2}" y2="${centerY}" stroke="#111" stroke-width="2" />
      </svg>
    `;
  }

  // External-tooth washer: the teeth are what distinguishes it, so they are cut
  // deep enough to survive being scaled down into an assortment icon.
  if (isToothed) {
    const toothCount = 12;
    const rootRadius = outerRadius * 0.78;
    const points = Array.from({ length: toothCount * 2 }, (_, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI) / toothCount;
      const radius = index % 2 === 0 ? outerRadius : rootRadius;
      return `${(centerX + radius * Math.cos(angle)).toFixed(2)},${(centerY + radius * Math.sin(angle)).toFixed(2)}`;
    }).join(' ');

    return `
      <svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Toothed lock washer top view">
        <polygon points="${points}" fill="#fff" stroke="#111" stroke-width="2" stroke-linejoin="round" />
        <circle cx="${centerX}" cy="${centerY}" r="${innerRadius}" fill="#fff" stroke="#111" stroke-width="2" />
      </svg>
    `;
  }

  // A split lock washer reads as a C from above: one ring with a gap and two
  // square end faces. The gap is drawn at the top so it survives being scaled
  // down into an assortment icon.
  if (isLock) {
    const gapHalfAngle = 13;
    const startAngle = -90 + gapHalfAngle;
    const endAngle = -90 - gapHalfAngle;

    return `
      <svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Split lock washer top view">
        <path
          d="M ${pointOnCircle(centerX, centerY, outerRadius, startAngle)}
             A ${outerRadius} ${outerRadius} 0 1 1 ${pointOnCircle(centerX, centerY, outerRadius, endAngle)}
             L ${pointOnCircle(centerX, centerY, innerRadius, endAngle)}
             A ${innerRadius} ${innerRadius} 0 1 0 ${pointOnCircle(centerX, centerY, innerRadius, startAngle)}
             Z"
          fill="#fff"
          stroke="#111"
          stroke-width="2"
        />
      </svg>
    `;
  }

  return `
    <svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Washer top view">
      <circle cx="${centerX}" cy="${centerY}" r="${outerRadius}" fill="#fff" stroke="#111" stroke-width="2" />
      <circle cx="${centerX}" cy="${centerY}" r="${innerRadius}" fill="#fff" stroke="#111" stroke-width="2" />
    </svg>
  `;
}
