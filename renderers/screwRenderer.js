import { getFastenerData, getDefaultSizeForStandard } from '../fastener-data.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function toTitleCase(value) {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

function renderDriveSymbol(drive, cx, y, width) {
  const half = width / 2;

  switch (drive) {
    case 'phillips':
      return `
        <line x1="${cx - half}" y1="${y}" x2="${cx + half}" y2="${y}" stroke="#111" stroke-width="2" />
        <line x1="${cx}" y1="${y - half}" x2="${cx}" y2="${y + half}" stroke="#111" stroke-width="2" />
      `;
    case 'hex': {
      const r = width * 0.45;
      const points = Array.from({ length: 6 }, (_, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI) / 3;
        return `${(cx + r * Math.cos(angle)).toFixed(2)},${(y + r * Math.sin(angle)).toFixed(2)}`;
      }).join(' ');
      return `<polygon points="${points}" fill="none" stroke="#111" stroke-width="2" />`;
    }
    case 'torx': {
      const outer = width * 0.46;
      const inner = width * 0.22;
      const points = Array.from({ length: 12 }, (_, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI) / 6;
        const radius = index % 2 === 0 ? outer : inner;
        return `${(cx + radius * Math.cos(angle)).toFixed(2)},${(y + radius * Math.sin(angle)).toFixed(2)}`;
      }).join(' ');
      return `<polygon points="${points}" fill="none" stroke="#111" stroke-width="2" />`;
    }
    case 'securityTorx': {
      const outer = width * 0.52;
      const inner = width * 0.29;
      const points = Array.from({ length: 12 }, (_, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI) / 6;
        const radius = index % 2 === 0 ? outer : inner;
        return `${(cx + radius * Math.cos(angle)).toFixed(2)},${(y + radius * Math.sin(angle)).toFixed(2)}`;
      }).join(' ');
      const pinRadius = Math.max(1.8, width * 0.13);
      return `
        <polygon points="${points}" fill="none" stroke="#111" stroke-width="2" />
        <circle cx="${cx}" cy="${y}" r="${pinRadius}" fill="#fff" stroke="#111" stroke-width="1.8" />
      `;
    }
    case 'slotted':
      return `<line x1="${cx - half}" y1="${y}" x2="${cx + half}" y2="${y}" stroke="#111" stroke-width="2" />`;
    default:
      return '';
  }
}

function getHeadGeometry(headType, centerX, headTopY, shaftWidth) {
  const headBottomY = 34;
  const headHeight = headBottomY - headTopY;
  const topWidth = shaftWidth * 2.45;
  const topLeft = centerX - topWidth / 2;
  const topRight = centerX + topWidth / 2;
  const bodyWidth = shaftWidth * 2.28;
  const bodyLeft = centerX - bodyWidth / 2;
  const bodyRight = centerX + bodyWidth / 2;
  const shortRectHeight = Math.max(6, Math.min(11, headHeight * 0.52));
  const shortRectTop = headBottomY - shortRectHeight;
  const flatWidth = topWidth + 4;
  const flatLeft = centerX - flatWidth / 2;

  switch (headType) {
    case 'socketCap':
      return `<rect x="${bodyLeft}" y="${headTopY + 2}" width="${bodyWidth}" height="${Math.max(7, headHeight - 2)}" rx="1.5" fill="#fff" stroke="#111" stroke-width="2" />`;
    case 'flat':
      return `<rect x="${flatLeft}" y="${shortRectTop}" width="${flatWidth}" height="${shortRectHeight}" fill="#fff" stroke="#111" stroke-width="2" />`;
    case 'flat82': {
      const flat82Top = headTopY + Math.max(1, headHeight * 0.14);
      return `<polygon points="${topLeft - 2},${flat82Top} ${topRight + 2},${flat82Top} ${centerX + shaftWidth * 0.52},${headBottomY} ${centerX - shaftWidth * 0.52},${headBottomY}" fill="#fff" stroke="#111" stroke-width="2" />`;
    }
    case 'hex':
      return `
        <rect x="${bodyLeft}" y="${shortRectTop}" width="${bodyWidth}" height="${shortRectHeight}" fill="#fff" stroke="#111" stroke-width="2" />
        <line x1="${centerX - bodyWidth * 0.28}" y1="${shortRectTop + 1}" x2="${centerX - bodyWidth * 0.28}" y2="${headBottomY - 1}" stroke="#111" stroke-width="1.5" />
        <line x1="${centerX + bodyWidth * 0.28}" y1="${shortRectTop + 1}" x2="${centerX + bodyWidth * 0.28}" y2="${headBottomY - 1}" stroke="#111" stroke-width="1.5" />
      `;
    case 'hexWasher': {
      const flangeHeight = Math.max(3, Math.min(5, headHeight * 0.28));
      const flangeWidth = topWidth + 8;
      const flangeLeft = centerX - flangeWidth / 2;
      const hexHeight = shortRectHeight;
      const hexTop = headBottomY - flangeHeight - hexHeight;
      return `
        <rect x="${flangeLeft}" y="${headBottomY - flangeHeight}" width="${flangeWidth}" height="${flangeHeight}" fill="#fff" stroke="#111" stroke-width="2" />
        <rect x="${bodyLeft}" y="${hexTop}" width="${bodyWidth}" height="${hexHeight}" fill="#fff" stroke="#111" stroke-width="2" />
        <line x1="${centerX - bodyWidth * 0.28}" y1="${hexTop + 1}" x2="${centerX - bodyWidth * 0.28}" y2="${hexTop + hexHeight - 1}" stroke="#111" stroke-width="1.4" />
        <line x1="${centerX + bodyWidth * 0.28}" y1="${hexTop + 1}" x2="${centerX + bodyWidth * 0.28}" y2="${hexTop + hexHeight - 1}" stroke="#111" stroke-width="1.4" />
      `;
    }
    case 'button': {
      const buttonWidth = topWidth * 1.02;
      const buttonHeight = Math.max(5, Math.min(9, headHeight * 0.5));
      const flankHeight = Math.max(1.5, buttonHeight * 0.22);
      const flankY = headBottomY - flankHeight;
      const domeHeight = buttonHeight - flankHeight;
      return `
        <path
          d="M ${centerX - buttonWidth / 2} ${headBottomY}
             L ${centerX - buttonWidth / 2} ${flankY}
             A ${buttonWidth / 2} ${domeHeight} 0 0 1 ${centerX + buttonWidth / 2} ${flankY}
             L ${centerX + buttonWidth / 2} ${headBottomY}
             Z"
          fill="#fff"
          stroke="#111"
          stroke-width="2"
        />
      `;
    }
    case 'fillister': {
      const fillisterWidth = shaftWidth * 2.05;
      const fillisterHeight = Math.max(10, Math.min(17, headHeight * 1.05));
      const fillisterTop = headBottomY - fillisterHeight;
      const shoulderY = fillisterTop + fillisterHeight * 0.28;
      const crownY = fillisterTop - fillisterHeight * 0.08;
      const slotY = fillisterTop + fillisterHeight * 0.24;
      return `
        <path
          d="M ${centerX - fillisterWidth / 2} ${headBottomY}
             L ${centerX - fillisterWidth / 2} ${shoulderY}
             Q ${centerX - fillisterWidth * 0.22} ${crownY}, ${centerX} ${crownY}
             Q ${centerX + fillisterWidth * 0.22} ${crownY}, ${centerX + fillisterWidth / 2} ${shoulderY}
             L ${centerX + fillisterWidth / 2} ${headBottomY}
             Z"
          fill="#fff"
          stroke="#111"
          stroke-width="2"
        />
        <line x1="${centerX - fillisterWidth / 2 + 1}" y1="${slotY}" x2="${centerX + fillisterWidth / 2 - 1}" y2="${slotY}" stroke="#111" stroke-width="1.6" />
      `;
    }
    case 'oval': {
      const ovalTopWidth = topWidth * 1.02;
      const ovalNeckWidth = shaftWidth * 1.08;
      const ovalShoulderY = headTopY + headHeight * 0.38;
      const ovalCrownY = headTopY + headHeight * 0.08;
      return `
        <path
          d="M ${centerX - ovalNeckWidth / 2} ${headBottomY}
             L ${centerX - ovalTopWidth / 2} ${ovalShoulderY}
             Q ${centerX - ovalTopWidth * 0.22} ${ovalCrownY}, ${centerX} ${ovalCrownY}
             Q ${centerX + ovalTopWidth * 0.22} ${ovalCrownY}, ${centerX + ovalTopWidth / 2} ${ovalShoulderY}
             L ${centerX + ovalNeckWidth / 2} ${headBottomY}
             Z"
          fill="#fff"
          stroke="#111"
          stroke-width="2"
        />
      `;
    }
    case 'round': {
      const radius = topWidth * 0.5;
      const roundCy = headBottomY;
      return `<path d="M ${centerX - radius} ${roundCy} A ${radius} ${radius * 0.75} 0 0 1 ${centerX + radius} ${roundCy} L ${centerX + shaftWidth * 0.55} ${roundCy} L ${centerX - shaftWidth * 0.55} ${roundCy} Z" fill="#fff" stroke="#111" stroke-width="2" />`;
    }
    case 'roundWasher': {
      const washerWidth = topWidth + 8;
      const washerLeft = centerX - washerWidth / 2;
      const washerHeight = Math.max(3, Math.min(5, headHeight * 0.28));
      const domeRadius = topWidth * 0.42;
      const baseY = headBottomY - washerHeight;
      return `
        <rect x="${washerLeft}" y="${baseY}" width="${washerWidth}" height="${washerHeight}" fill="#fff" stroke="#111" stroke-width="2" />
        <path d="M ${centerX - domeRadius} ${baseY} A ${domeRadius} ${domeRadius * 0.7} 0 0 1 ${centerX + domeRadius} ${baseY} L ${centerX - domeRadius} ${baseY} Z" fill="#fff" stroke="#111" stroke-width="2" />
      `;
    }
    case 'trim': {
      const trimWidth = shaftWidth * 1.28;
      const trimTop = headTopY + headHeight * 0.18;
      return `<polygon points="${centerX - trimWidth / 2},${trimTop} ${centerX + trimWidth / 2},${trimTop} ${centerX + shaftWidth * 0.45},${headBottomY} ${centerX - shaftWidth * 0.45},${headBottomY}" fill="#fff" stroke="#111" stroke-width="2" />`;
    }
    case 'wafer': {
      const waferHeight = Math.max(4, Math.min(7, headHeight * 0.4));
      const waferTop = headBottomY - waferHeight;
      const waferWidth = topWidth + 10;
      return `<rect x="${centerX - waferWidth / 2}" y="${waferTop}" width="${waferWidth}" height="${waferHeight}" rx="2" fill="#fff" stroke="#111" stroke-width="2" />`;
    }
    case 'pan':
    default:
      {
        const panHeight = Math.max(6, Math.min(10, headHeight * 0.55));
        const panTopY = headBottomY - panHeight;
        const cornerRadius = Math.max(3, Math.min(7, panHeight * 0.6));
        return `
          <path
            d="M ${topLeft} ${headBottomY}
               L ${topLeft} ${panTopY + cornerRadius}
               Q ${topLeft} ${panTopY}, ${topLeft + cornerRadius} ${panTopY}
               L ${topRight - cornerRadius} ${panTopY}
               Q ${topRight} ${panTopY}, ${topRight} ${panTopY + cornerRadius}
               L ${topRight} ${headBottomY}
               Z"
            fill="#fff"
            stroke="#111"
            stroke-width="2"
          />
        `;
      }
  }
}

function getResolvedHeadData(sizeData, headType) {
  const baseHead = sizeData.heads[headType] || sizeData.heads.pan;
  const scales = {
    button: { diameter: 0.95, height: 0.72 },
    fillister: { diameter: 0.95, height: 1.15 },
    flat82: { diameter: 1.1, height: 0.9 },
    hexWasher: { diameter: 1.18, height: 1.0 },
    oval: { diameter: 1.06, height: 0.95 },
    round: { diameter: 1.08, height: 1.0 },
    roundWasher: { diameter: 1.22, height: 0.98 },
    trim: { diameter: 0.8, height: 0.86 },
    wafer: { diameter: 1.22, height: 0.65 }
  };

  const scale = scales[headType] || { diameter: 1, height: 1 };
  return {
    headDiameter: (baseHead.headDiameter || sizeData.heads.pan.headDiameter) * scale.diameter,
    headHeight: (baseHead.headHeight || sizeData.heads.pan.headHeight) * scale.height
  };
}

export function renderScrewSVG(part, view = 'side') {
  const dataSet = getFastenerData(part.standard);
  const fallbackSize = getDefaultSizeForStandard(part.standard);
  const sizeData = dataSet[part.size] || dataSet[fallbackSize];
  const headData = getResolvedHeadData(sizeData, part.head);
  const diameter = Number(part.diameter) || sizeData.diameter;
  const length = Number(part.length) || 12;
  const pitch = Number(part.pitch) || sizeData.coarsePitch;
  const endType = part.endType || 'pointed';
  const isHeadless = Boolean(part.isHeadless);

  const centerX = 60;
  const shaftTopY = isHeadless ? 18 : 34;
  const shaftWidth = clamp(diameter * 2.1, 7, 20);
  const shaftHeight = clamp(length * 4.4, 38, 98);
  const shaftBottomY = shaftTopY + shaftHeight;
  const tipHeight = clamp(diameter * 3.2, 12, 20);
  const tipBottomY = shaftBottomY + tipHeight;

  const headHeightPx = clamp(headData.headHeight * 6, 10, 26);
  const headTopY = clamp(34 - headHeightPx, 8, 24);
  const headMarkup = isHeadless ? '' : getHeadGeometry(part.head, centerX, headTopY, shaftWidth);

  const pitchPx = clamp((pitch / sizeData.coarsePitch) * 8, 5, 11);
  let threadLines = '';

  for (let y = shaftTopY + 4; y < shaftBottomY - 4; y += pitchPx) {
    threadLines += `<line x1="${centerX - shaftWidth / 2}" y1="${y}" x2="${centerX + shaftWidth / 2}" y2="${y + 3}" stroke="#111" stroke-width="1" />`;
  }

  const headLabel = toTitleCase(part.head || 'pan');
  const driveLabel = toTitleCase(part.drive || 'phillips');
  const endLabel = toTitleCase(endType);

  if (view === 'top') {
    const topCenterY = 80;
    const headRadius = isHeadless
      ? clamp(diameter * 6.4, 11, 24)
      : clamp((headData.headDiameter || diameter * 2.4) * 3.1, 16, 42);

    let outline = `<circle cx="${centerX}" cy="${topCenterY}" r="${headRadius}" fill="#fff" stroke="#111" stroke-width="2" />`;
    if (!isHeadless && part.head === 'trim') {
      outline = `<circle cx="${centerX}" cy="${topCenterY}" r="${headRadius * 0.72}" fill="#fff" stroke="#111" stroke-width="2" />`;
    }

    if (!isHeadless && (part.head === 'hex' || part.head === 'hexWasher')) {
      if (part.head === 'hexWasher') {
        outline = `<circle cx="${centerX}" cy="${topCenterY}" r="${headRadius * 1.08}" fill="#fff" stroke="#111" stroke-width="2" />`;
      }
      const points = Array.from({ length: 6 }, (_, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI) / 3;
        return `${(centerX + headRadius * Math.cos(angle)).toFixed(2)},${(topCenterY + headRadius * Math.sin(angle)).toFixed(2)}`;
      }).join(' ');
      outline += `<polygon points="${points}" fill="#fff" stroke="#111" stroke-width="2" />`;
    }

    const topDrive = (!isHeadless && (part.head === 'hex' || part.head === 'hexWasher'))
      ? ''
      : renderDriveSymbol(part.drive, centerX, topCenterY, clamp(headRadius * 1.05, 14, 30));

    return `
      <svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${headLabel} ${driveLabel} screw top view">
        ${outline}
        ${topDrive}
      </svg>
    `;
  }

  const endMarkup = endType === 'flat'
    ? `<rect x="${centerX - shaftWidth / 2}" y="${shaftBottomY}" width="${shaftWidth}" height="6" fill="#fff" stroke="#111" stroke-width="2" />`
    : `<polygon points="${centerX - shaftWidth / 2},${shaftBottomY} ${centerX + shaftWidth / 2},${shaftBottomY} ${centerX},${tipBottomY}" fill="#fff" stroke="#111" stroke-width="2" />`;

  return `
    <svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${isHeadless ? `Headless ${endLabel}` : `${headLabel} ${driveLabel} ${endLabel}`} screw side view">
      ${headMarkup}
      <rect x="${centerX - shaftWidth / 2}" y="${shaftTopY}" width="${shaftWidth}" height="${shaftHeight}" fill="#fff" stroke="#111" stroke-width="2" />
      ${threadLines}
      ${endMarkup}
    </svg>
  `;
}
