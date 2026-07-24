import { getProfile, getProfileFields } from "./measurementProfiles";
import { referenceObjects } from "./referenceObjects";

const MEASUREMENT_PRECISION = 0.25;

export const roundMeasurement = (value) => Math.round(value / MEASUREMENT_PRECISION) * MEASUREMENT_PRECISION;
export const roundHalf = roundMeasurement;
export const cmToInches = (value) => roundHalf(value / 2.54);
export const inchesToCm = (value) => roundHalf(value * 2.54);
export const formatLength = (valueCm) => `${roundHalf(valueCm)} cm / ${cmToInches(valueCm)} in`;
export const toCm = (value, unit) => (unit === "in" ? inchesToCm(Number(value)) : Number(value));

export const getHeightCm = (customer) =>
  customer.heightUnit === "in" ? inchesToCm(Number(customer.height)) : Number(customer.height);

export const defaultHeightByProfile = {
  male: 173,
  female: 162,
};

const getReferenceObject = (referenceObjectId) =>
  referenceObjects.find((object) => object.id === referenceObjectId);

export const getReferenceLabel = (customer) => {
  const referenceObject = getReferenceObject(customer.referenceObject);

  if (!referenceObject) {
    return "Not added";
  }

  const knownSize = customer.referenceSize
    ? `${customer.referenceSize} ${customer.referenceUnit || "cm"}`
    : referenceObject.sizeCm
      ? `${referenceObject.sizeCm} cm / ${cmToInches(referenceObject.sizeCm)} in`
      : "Size not added";

  return `${referenceObject.label} (${knownSize})`;
};

export const getScaleHeightCm = (customer) => {
  const knownHeight = getHeightCm(customer);
  const calibratedReferenceHeight = Number(customer.referenceCalibratedHeightCm);

  if (Number.isFinite(knownHeight) && knownHeight > 0) {
    return knownHeight;
  }

  if (Number.isFinite(calibratedReferenceHeight) && calibratedReferenceHeight > 0) {
    return calibratedReferenceHeight;
  }

  return defaultHeightByProfile[customer.measurementProfile] || defaultHeightByProfile.male;
};

export const getScaleSourceLabel = (customer) => {
  if (customer.height) {
    return "Known height";
  }

  if (customer.scaleMode === "reference") {
    return customer.referenceCalibratedHeightCm
      ? `${getReferenceLabel(customer)} reference`
      : getReferenceLabel(customer);
  }

  return "Estimated scale";
};

const scaledRatio = (metric, ratio, height, fallback) => (metric?.[ratio] ? metric[ratio] * height : fallback);
const scaledOptionalRatio = (metric, ratio, height) => (metric?.[ratio] ? metric[ratio] * height : null);
const clampValue = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);
const blendValues = (primary, fallback, primaryWeight = 0.55) =>
  primary * primaryWeight + fallback * (1 - primaryWeight);
const getWaistToHipRatio = (profileId) => (profileId === "female" ? 0.115 : 0.105);

function getFirmChestMeasurement(profileId, generatedChest, baselineChest) {
  const standardEase = profileId === "female" ? 4.5 : 4;
  const lightEase = profileId === "female" ? 2 : 1.5;
  const aboveBaseline = generatedChest - baselineChest;
  const broadThreshold = profileId === "female" ? 12 : 14;
  const correction = aboveBaseline >= broadThreshold
    ? lightEase
    : aboveBaseline >= 4
      ? standardEase
      : standardEase * 0.5;

  return Math.max(generatedChest - correction, baselineChest - 3);
}

function getSleeveBaseline(profileId, height) {
  return height * (profileId === "female" ? 0.33 : 0.34);
}

function getCorrectedSleeve(profileId, rawSleeve, baselineSleeve) {
  const overage = rawSleeve - baselineSleeve;
  const upperTolerance = profileId === "female" ? 3.5 : 4.5;

  if (overage <= 0) {
    return clampValue(rawSleeve, baselineSleeve - 5, baselineSleeve + upperTolerance);
  }

  const poseWeight = overage > 9 ? 0.25 : overage > 5 ? 0.45 : 0.7;
  const correctedSleeve = blendValues(rawSleeve, baselineSleeve, poseWeight);

  return clampValue(correctedSleeve, baselineSleeve - 5, baselineSleeve + upperTolerance);
}

function getTrouserLengthBaseline(profileId, height) {
  return height * (profileId === "female" ? 0.595 : 0.59);
}

function getLowerLengthStartCorrection(profileId, height) {
  return profileId === "female" ? 0 : height * 0.018;
}

function getInseamBaseline(profileId, height) {
  return height * (profileId === "female" ? 0.435 : 0.44);
}

function getTopLength(profileId, height, torsoLength, waistToHip) {
  return profileId === "female"
    ? torsoLength + waistToHip
    : torsoLength + height * 0.18;
}

function getRise(profileId, height) {
  return height * (profileId === "female" ? 0.19 : 0.155);
}

function getMeasurementValueKey(field) {
  return field.key === "waist" && field.group === "Lower body" ? "waistBand" : field.key;
}

function getCorrectedLength(rawLength, baselineLength, { lowerTolerance = 5, upperTolerance = 6 } = {}) {
  const difference = rawLength - baselineLength;
  const absoluteDifference = Math.abs(difference);

  if (absoluteDifference <= 2) {
    return clampValue(rawLength, baselineLength - lowerTolerance, baselineLength + upperTolerance);
  }

  const rawWeight = absoluteDifference > 10 ? 0.3 : absoluteDifference > 6 ? 0.5 : 0.72;
  const correctedLength = blendValues(rawLength, baselineLength, rawWeight);

  return clampValue(correctedLength, baselineLength - lowerTolerance, baselineLength + upperTolerance);
}

function getBustUnderbustGap(profileId, bust) {
  if (profileId !== "female") {
    return { minimum: 0, maximum: Infinity, target: 0 };
  }

  if (bust < 86) {
    return { minimum: 7, maximum: 14, target: 10 };
  }

  if (bust < 96) {
    return { minimum: 8, maximum: 16, target: 12 };
  }

  if (bust < 106) {
    return { minimum: 9, maximum: 18, target: 14 };
  }

  return { minimum: 10, maximum: 21, target: 16 };
}

function getConsistentUnderbust(profileId, bust, underbustCandidate) {
  if (profileId !== "female") {
    return underbustCandidate;
  }

  const gap = getBustUnderbustGap(profileId, bust);
  const currentGap = bust - underbustCandidate;

  if (currentGap < gap.minimum) {
    return bust - gap.minimum;
  }

  if (currentGap > gap.maximum) {
    return bust - gap.maximum;
  }

  return underbustCandidate * 0.7 + (bust - gap.target) * 0.3;
}

function getCircumferenceBaseline(profileId, height) {
  if (profileId === "female") {
    const bust = height * 0.54;
    const waist = height * 0.42;
    const hip = height * 0.58;

    return {
      chest: bust,
      waist,
      hip: Math.max(hip, bust + 2),
    };
  }

  const chest = height * 0.55;
  const waist = height * 0.47;
  const hip = height * 0.55;

  return {
    chest,
    waist,
    hip: Math.max(hip, waist + 4),
  };
}

function getDerivedCircumferences(profileId, { chest, waist, hip }) {
  if (profileId === "female") {
    return {
      neck: chest * 0.15 + 22,
      underbust: chest - 8,
      stomach: waist + 4,
      armhole: chest * 0.25 + 9,
      bicep: chest * 0.2 + 7,
      wrist: chest * 0.075 + 9,
      bustSpan: chest * 0.2,
      thigh: hip * 0.34 + 18,
      knee: hip * 0.15 + 22,
      ankle: hip * 0.07 + 13,
      highHip: hip - 6,
    };
  }

  return {
    neck: chest * 0.16 + 23,
    underbust: chest - 8,
    stomach: waist + 4,
    armhole: chest * 0.28 + 8,
    bicep: chest * 0.23 + 8,
    wrist: chest * 0.08 + 8.5,
    bustSpan: chest * 0.2,
    thigh: hip * 0.35 + 20,
    knee: hip * 0.16 + 22,
    ankle: hip * 0.08 + 12,
    highHip: hip - 6,
  };
}

function getArmholeMeasurement(profileId, chest, shoulder) {
  return profileId === "female"
    ? chest * 0.27 + shoulder * 0.22 + 12.7
    : chest * 0.29 + shoulder * 0.24 + 10.16;
}

export function buildManualMeasurements(values) {
  const profile = getProfile(values.measurementProfile);

  return getProfileFields(profile)
    .filter((field) => values[field.key])
    .map((field) => ({
      fieldKey: field.key,
      label: field.label,
      valueCm: roundHalf(toCm(values[field.key], values.measurementUnit)),
      note: `Manual input: ${field.note}`,
      group: field.group,
    }));
}

function pickValue(values, key, fallback) {
  return values[key] === undefined || Number.isNaN(values[key]) ? fallback : values[key];
}

function buildGeneratedMeasurements(customer, values) {
  const profile = getProfile(customer.measurementProfile);

  return getProfileFields(profile).map((field) => {
    const valueKey = getMeasurementValueKey(field);

    return {
      fieldKey: field.key,
      label: field.label,
      valueCm: roundHalf(pickValue(values, valueKey, values[field.fallbackKey] || values.chest || values.waist || 0)),
      note: `${values.notePrefix}: ${field.note}`,
      group: field.group,
    };
  });
}

export function buildBackendMeasurements(customer, backendResult, fallbackMeasurements) {
  const backendMeasurements = backendResult?.measurements || {};
  const profile = getProfile(customer.measurementProfile);

  return getProfileFields(profile).map((field, index) => {
    const valueKey = getMeasurementValueKey(field);
    const backendValue = Number(backendMeasurements[valueKey]);
    const fallbackMeasurement = fallbackMeasurements[index];
    const valueCm = Number.isFinite(backendValue) && backendValue > 0
      ? roundHalf(backendValue)
      : fallbackMeasurement.valueCm;

    return {
      fieldKey: field.key,
      label: field.label,
      valueCm,
      note: `Photo-based result: ${field.note}`,
      group: field.group,
    };
  });
}

export function buildCorrectionLog(generatedMeasurements, finalMeasurements) {
  return finalMeasurements.map((measurement, index) => {
    const generated = generatedMeasurements[index];
    const differenceCm = roundHalf(measurement.valueCm - generated.valueCm);

    return {
      fieldKey: measurement.fieldKey,
      label: measurement.label,
      group: measurement.group,
      generatedCm: generated.valueCm,
      finalCm: measurement.valueCm,
      differenceCm,
      differenceIn: cmToInches(differenceCm),
    };
  });
}

export function processMeasurements(customer) {
  const height = getScaleHeightCm(customer);
  const photoAdjustment = (customer.photoViews?.length || 0) >= 2 ? 0.5 : 0;
  const frontPose = customer.poseMetrics?.front;
  const hasPoseMetrics = Boolean(frontPose);
  const profileId = customer.measurementProfile;

  const circumferenceBaseline = getCircumferenceBaseline(profileId, height);
  const estimatedShoulder = height * 0.118 + 17;
  const shoulderWidth = scaledRatio(frontPose, "shoulderWidthRatio", height, estimatedShoulder);
  const hipWidth = scaledRatio(frontPose, "hipWidthRatio", height, height * 0.195);
  const torsoLength = scaledRatio(frontPose, "torsoLengthRatio", height, height * 0.31);
  const sleeveBaseline = getSleeveBaseline(profileId, height);
  const rawSleeve = scaledRatio(frontPose, "sleeveLengthRatio", height, sleeveBaseline);
  const frontSleeve = hasPoseMetrics ? getCorrectedSleeve(profileId, rawSleeve, sleeveBaseline) : sleeveBaseline;
  const poseHipToAnkle = scaledOptionalRatio(frontPose, "trouserLengthRatio", height);
  const waistToHip = height * getWaistToHipRatio(customer.measurementProfile);
  const lowerLengthStartCorrection = getLowerLengthStartCorrection(profileId, height);
  const trouserBaseline = getTrouserLengthBaseline(profileId, height) - lowerLengthStartCorrection;
  const rawTrouserLength = poseHipToAnkle
    ? poseHipToAnkle + waistToHip - lowerLengthStartCorrection
    : trouserBaseline;
  const frontTrouser = hasPoseMetrics
    ? getCorrectedLength(rawTrouserLength, trouserBaseline, { lowerTolerance: 5, upperTolerance: 6 })
    : trouserBaseline;
  const chestWidth = shoulderWidth * 0.94;
  const waistWidth = Math.max((chestWidth + hipWidth) / 2 - 2, hipWidth * 0.78);
  const poseChest = chestWidth * (profileId === "female" ? 2.55 : 2.5) + photoAdjustment;
  const poseWaist = waistWidth * (profileId === "female" ? 2.35 : 2.45) + photoAdjustment;
  const poseHip = hipWidth * (profileId === "female" ? 2.9 : 2.75) + photoAdjustment;
  const generatedChest = roundHalf(
    hasPoseMetrics
      ? clampValue(blendValues(poseChest, circumferenceBaseline.chest), circumferenceBaseline.chest - 10, circumferenceBaseline.chest + 10)
      : circumferenceBaseline.chest,
  );
  const chest = roundHalf(getFirmChestMeasurement(profileId, generatedChest, circumferenceBaseline.chest));
  const waist = roundHalf(
    hasPoseMetrics
      ? clampValue(blendValues(poseWaist, circumferenceBaseline.waist), circumferenceBaseline.waist - 10, circumferenceBaseline.waist + 10)
      : circumferenceBaseline.waist,
  );
  const hip = roundHalf(
    hasPoseMetrics
      ? clampValue(blendValues(poseHip, circumferenceBaseline.hip), circumferenceBaseline.hip - 10, circumferenceBaseline.hip + 10)
      : circumferenceBaseline.hip,
  );
  const shoulder = roundHalf(hasPoseMetrics ? shoulderWidth : estimatedShoulder);
  const sleeve = roundHalf(frontSleeve);
  const topLength = roundHalf(getTopLength(profileId, height, torsoLength, waistToHip));
  const trouserLength = roundHalf(frontTrouser);
  const rise = roundHalf(getRise(profileId, height));
  const inseamBaseline = getInseamBaseline(profileId, height);
  const rawInseam = Math.max(0, (poseHipToAnkle || trouserBaseline - waistToHip) - height * 0.03);
  const inseam = roundHalf(getCorrectedLength(rawInseam, inseamBaseline, { lowerTolerance: 5, upperTolerance: 5.5 }));
  const derivedCircumferences = getDerivedCircumferences(profileId, { chest: generatedChest, waist, hip });
  const neck = roundHalf(derivedCircumferences.neck);
  const armholeChest = profileId === "female" ? generatedChest : chest;
  const notePrefix = hasPoseMetrics ? "Pose-assisted" : "Estimated";
  const values = {
    notePrefix,
    neck,
    chest,
    bust: chest,
    underbust: getConsistentUnderbust(profileId, chest, derivedCircumferences.underbust),
    waist,
    waistBand: profileId === "female" ? waist + 2 : waist,
    stomach: derivedCircumferences.stomach,
    hip,
    seat: hip,
    shoulder,
    acrossBack: shoulder - 2,
    armhole: getArmholeMeasurement(profileId, armholeChest, shoulder),
    sleeve,
    bicep: derivedCircumferences.bicep,
    wrist: derivedCircumferences.wrist,
    topLength,
    bustPoint: height * 0.16,
    bustSpan: derivedCircumferences.bustSpan,
    frontLength: height * 0.27,
    backLength: height * 0.25,
    trouserLength,
    lowerLength: trouserLength,
    inseam,
    rise,
    thigh: derivedCircumferences.thigh,
    knee: derivedCircumferences.knee,
    ankle: derivedCircumferences.ankle,
    highHip: derivedCircumferences.highHip,
    waistToHip,
  };

  return buildGeneratedMeasurements(customer, values);
}
