function round(value, decimals = 3) {
  return Number(value.toFixed(decimals));
}

function createFastenerSize(diameter, pitch, threadPerInch) {
  const clearance = diameter < 6 ? 0.3 : 0.4;
  const panHeadDiameter = diameter * 2 + 0.6;
  const socketCapDiameter = diameter * 1.8 + 0.4;
  const flatHeadDiameter = diameter * 2.1 + 1;
  const hexHeadDiameter = diameter * 1.75;

  const data = {
    diameter: round(diameter),
    coarsePitch: round(pitch),
    heads: {
      pan: { headDiameter: round(panHeadDiameter), headHeight: round(diameter * 0.75 + 0.2) },
      socketCap: { headDiameter: round(socketCapDiameter), headHeight: round(diameter * 1 + 0.4) },
      flat: { headDiameter: round(flatHeadDiameter), headHeight: round(Math.max(1, diameter * 0.55)) },
      hex: { headDiameter: round(hexHeadDiameter), headHeight: round(diameter * 0.8 + 0.2) }
    },
    nut: {
      widthAcrossFlats: round(diameter * 1.7),
      thickness: round(Math.max(1.2, diameter * 0.8))
    },
    washer: {
      innerDiameter: round(diameter + clearance),
      outerDiameter: round(Math.max(diameter * 2.2, diameter + 4)),
      thickness: round(Math.max(0.5, Math.min(2.5, diameter * 0.25)))
    }
  };

  if (threadPerInch) {
    data.threadPerInch = threadPerInch;
  }

  return data;
}

const metricThreadSeries = [
  ['M2', 2, 0.4],
  ['M2.5', 2.5, 0.45],
  ['M3', 3, 0.5],
  ['M4', 4, 0.7],
  ['M5', 5, 0.8],
  ['M6', 6, 1.0],
  ['M8', 8, 1.25],
  ['M3x0.5', 3, 0.5],
  ['M4x0.7', 4, 0.7],
  ['M5x0.8', 5, 0.8],
  ['M6x1.0', 6, 1.0],
  ['M7x1.0', 7, 1.0],
  ['M8x1.0', 8, 1.0],
  ['M8x1.25', 8, 1.25],
  ['M10x1.0', 10, 1.0],
  ['M10x1.25', 10, 1.25],
  ['M10x1.5', 10, 1.5],
  ['M12x1.25', 12, 1.25],
  ['M12x1.5', 12, 1.5],
  ['M12x1.75', 12, 1.75]
];

export const metricFastenerData = Object.fromEntries(
  metricThreadSeries.map(([size, diameter, pitch]) => [size, createFastenerSize(diameter, pitch)])
);

const saeThreadSeries = [
  ['6-40', 3.505, 40],
  ['6-32', 3.505, 32],
  ['8-32', 4.166, 32],
  ['10-24', 4.826, 24],
  ['10-32', 4.826, 32],
  ['1/4-20', 6.35, 20],
  ['1/4-28', 6.35, 28],
  ['5/16-18', 7.938, 18],
  ['5/16-24', 7.938, 24],
  ['3/8-16', 9.525, 16],
  ['3/8-24', 9.525, 24],
  ['7/16-14', 11.112, 14],
  ['7/16-20', 11.112, 20],
  ['1/2-13', 12.7, 13],
  ['1/2-20', 12.7, 20]
];

// Screw gauge, how wood and sheet-metal screws are actually sold. The major
// diameter is 0.060 + 0.013 x gauge inches, which is where these come from.
// The declared thread is the machine (UNC) thread for that gauge: it is the
// baseline SCREW_TYPE_DEFAULTS scales from, so a #8 wood screw lands near 14 TPI
// against a real 15. Coarse threads are approximated to within a turn or so,
// like every other dimension here.
const gaugeThreadSeries = [
  ['#2', 2.184, 56],
  ['#4', 2.845, 40],
  ['#6', 3.505, 32],
  ['#8', 4.166, 32],
  ['#10', 4.826, 24],
  ['#12', 5.486, 24],
  ['#14', 6.147, 20]
];

export const gaugeSizeNames = gaugeThreadSeries.map(([size]) => size);

export const defaultGaugeSize = '#8';

// Gauge sizes are part of the inch dataset rather than a standard of their own —
// they are a way of naming a diameter, not a way of measuring one. Every lookup
// therefore resolves them; only the size dropdown filters them down to the screw
// types actually sold that way.
export const saeFastenerData = Object.fromEntries(
  [...gaugeThreadSeries, ...saeThreadSeries]
    .map(([size, diameter, tpi]) => [size, createFastenerSize(diameter, 25.4 / tpi, tpi)])
);

export const fastenerDataByStandard = {
  metric: metricFastenerData,
  sae: saeFastenerData
};

export function getFastenerData(standard = 'metric') {
  return fastenerDataByStandard[standard] || metricFastenerData;
}

export function getDefaultSizeForStandard(standard = 'metric') {
  const defaults = {
    metric: 'M6x1.0',
    sae: '1/4-20'
  };
  return defaults[standard] || 'M6x1.0';
}
