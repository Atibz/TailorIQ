import { referenceObjects } from "./constants";

const MEASUREMENT_PRECISION = 0.25;

export const roundMeasurement = (value) => Math.round(value / MEASUREMENT_PRECISION) * MEASUREMENT_PRECISION;
export const roundHalf = roundMeasurement;
export const inchesToCm = (value) => roundHalf(value * 2.54);
export const formatLength = (valueCm) => `${roundHalf(valueCm)} cm / ${roundHalf(valueCm / 2.54)} in`;

function toCm(value, unit) {
  return unit === "in" ? inchesToCm(Number(value)) : Number(value);
}

function getReferenceSizeCm(referenceObjectId, referenceSize, referenceUnit) {
  const referenceObject = referenceObjects.find((object) => object.id === referenceObjectId);
  const enteredSize = toCm(referenceSize, referenceUnit);

  if (Number.isFinite(enteredSize) && enteredSize > 0) {
    return enteredSize;
  }

  return referenceObject?.sizeCm || 0;
}

export function getSuggestedMarkers(referenceObjectId) {
  const markerPresets = {
    "a4-paper": {
      top: { x: 0.22, y: 0.44 },
      bottom: { x: 0.22, y: 0.62 },
    },
    "standard-door": {
      top: { x: 0.18, y: 0.08 },
      bottom: { x: 0.18, y: 0.94 },
    },
    "measuring-tape": {
      top: { x: 0.18, y: 0.16 },
      bottom: { x: 0.18, y: 0.9 },
    },
  };

  return markerPresets[referenceObjectId] || markerPresets["a4-paper"];
}

export function buildReferenceCalibration({
  marker,
  photo,
  referenceObject,
  referenceSize,
  referenceUnit,
}) {
  const referenceSizeCm = getReferenceSizeCm(referenceObject, referenceSize, referenceUnit);
  const markerHeightRatio = Math.abs((marker?.bottom?.y || 0) - (marker?.top?.y || 0));
  const bodyHeightRatio = photo?.poseMetrics?.bodyHeightRatio;

  if (!referenceSizeCm || !markerHeightRatio || !bodyHeightRatio) {
    return null;
  }

  const cmPerImageRatio = referenceSizeCm / markerHeightRatio;
  const calibratedHeightCm = roundHalf(bodyHeightRatio * cmPerImageRatio);

  if (!Number.isFinite(calibratedHeightCm) || calibratedHeightCm <= 0) {
    return null;
  }

  return {
    bodyHeightRatio,
    calibratedHeightCm,
    marker,
    markerHeightRatio,
    referenceSizeCm,
  };
}
