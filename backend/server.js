import { Buffer } from "node:buffer";
import http from "node:http";
import process from "node:process";

const PORT = Number(process.env.PORT || 5050);
const MAX_BODY_BYTES = 25 * 1024 * 1024;

const MEASUREMENT_PRECISION = 0.25;
const roundMeasurement = (value) => Math.round(value / MEASUREMENT_PRECISION) * MEASUREMENT_PRECISION;
const roundHalf = roundMeasurement;
const inchesToCm = (value) => roundHalf(Number(value) * 2.54);
const clampValue = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);
const blendValues = (primary, fallback, primaryWeight = 0.55) =>
  primary * primaryWeight + fallback * (1 - primaryWeight);
const blendThree = (primary, secondary, fallback, primaryWeight = 0.42, secondaryWeight = 0.38) =>
  primary * primaryWeight + secondary * secondaryWeight + fallback * (1 - primaryWeight - secondaryWeight);

function getHeightCm(payload) {
  const knownHeight = payload.scale?.heightUnit === "in"
    ? inchesToCm(payload.scale?.height)
    : Number(payload.scale?.height);
  const calibratedHeight = Number(payload.scale?.referenceCalibratedHeightCm);

  if (Number.isFinite(knownHeight) && knownHeight > 0) {
    return knownHeight;
  }

  if (Number.isFinite(calibratedHeight) && calibratedHeight > 0) {
    return calibratedHeight;
  }

  return payload.profile === "female" ? 162 : 173;
}

function scaledRatio(metric, ratio, height, fallback) {
  return metric?.[ratio] ? metric[ratio] * height : fallback;
}

function scaledOptionalRatio(metric, ratio, height) {
  return metric?.[ratio] ? metric[ratio] * height : null;
}

function getWaistToHipRatio(profile) {
  return profile === "female" ? 0.115 : 0.105;
}

function getShoulderBaseline(profile, height) {
  return profile === "female" ? height * 0.118 + 15 : height * 0.118 + 17;
}

function getCorrectedShoulder(profile, rawShoulder, baseline) {
  const correction = profile === "female" ? 0.82 : 0.96;
  const poseWeight = profile === "female" ? 0.25 : 0.58;
  const correctedPose = rawShoulder * correction;
  const blendedShoulder = blendValues(correctedPose, baseline, poseWeight);
  const upperTolerance = profile === "female" ? 4 : 7;

  return clampValue(blendedShoulder, baseline - 2, baseline + upperTolerance);
}

function getFirmChestMeasurement(profile, generatedChest, baselineChest) {
  const standardEase = profile === "female" ? 4.5 : 4;
  const lightEase = profile === "female" ? 2 : 1.5;
  const aboveBaseline = generatedChest - baselineChest;
  const broadThreshold = profile === "female" ? 12 : 14;
  const correction = aboveBaseline >= broadThreshold
    ? lightEase
    : aboveBaseline >= 4
      ? standardEase
      : standardEase * 0.5;

  return Math.max(generatedChest - correction, baselineChest - 3);
}

function getSleeveBaseline(profile, height) {
  return height * (profile === "female" ? 0.33 : 0.34);
}

function getCorrectedSleeve(profile, rawSleeve, baselineSleeve) {
  const overage = rawSleeve - baselineSleeve;
  const upperTolerance = profile === "female" ? 3.5 : 4.5;

  if (overage <= 0) {
    return clampValue(rawSleeve, baselineSleeve - 5, baselineSleeve + upperTolerance);
  }

  const poseWeight = overage > 9 ? 0.25 : overage > 5 ? 0.45 : 0.7;
  const correctedSleeve = blendValues(rawSleeve, baselineSleeve, poseWeight);

  return clampValue(correctedSleeve, baselineSleeve - 5, baselineSleeve + upperTolerance);
}

function getTrouserLengthBaseline(profile, height) {
  return height * (profile === "female" ? 0.595 : 0.59);
}

function getLowerLengthStartCorrection(profile, height) {
  return height * (profile === "female" ? 0.026 : 0.018);
}

function getInseamBaseline(profile, height) {
  return height * (profile === "female" ? 0.435 : 0.44);
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

function getBustUnderbustGap(profile, bust) {
  if (profile !== "female") {
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

function getConsistentUnderbust(profile, bust, underbustCandidate) {
  if (profile !== "female") {
    return underbustCandidate;
  }

  const gap = getBustUnderbustGap(profile, bust);
  const currentGap = bust - underbustCandidate;

  if (currentGap < gap.minimum) {
    return bust - gap.minimum;
  }

  if (currentGap > gap.maximum) {
    return bust - gap.maximum;
  }

  return underbustCandidate * 0.7 + (bust - gap.target) * 0.3;
}

function getCircumferenceBaseline(profile, height) {
  if (profile === "female") {
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

function getDerivedCircumferences(profile, { chest, waist, hip }) {
  if (profile === "female") {
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

function ellipseCircumference(width, depth) {
  const a = Math.max(width / 2, 1);
  const b = Math.max(depth / 2, 1);

  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}

function isPlausibleCircumference(value, baseline, tolerance = 0.18) {
  return Number.isFinite(value) && value > baseline * (1 - tolerance) && value < baseline * (1 + tolerance);
}

function isPlausibleWidthDepth(sample, expectedWidth) {
  if (!sample) {
    return false;
  }

  return (
    sample.widthCm > expectedWidth * 0.55 &&
    sample.widthCm < expectedWidth * 1.55 &&
    sample.depthCm > sample.widthCm * 0.22 &&
    sample.depthCm < sample.widthCm * 0.95
  );
}

function chooseCircumference({ silhouetteSample, poseValue, baselineValue, expectedWidth, tolerance = 0.18 }) {
  const fallbackValue = clampValue(
    blendValues(poseValue, baselineValue, 0.56),
    baselineValue - Math.max(baselineValue * 0.09, 6),
    baselineValue + Math.max(baselineValue * 0.09, 6),
  );

  if (
    silhouetteSample &&
    isPlausibleWidthDepth(silhouetteSample, expectedWidth) &&
    isPlausibleCircumference(silhouetteSample.circumferenceCm, baselineValue, tolerance)
  ) {
    const silhouetteValue = clampValue(
      blendThree(silhouetteSample.circumferenceCm, poseValue, baselineValue),
      baselineValue - Math.max(baselineValue * 0.1, 7),
      baselineValue + Math.max(baselineValue * 0.1, 7),
    );

    return silhouetteValue < fallbackValue - 2 ? fallbackValue : silhouetteValue;
  }

  return fallbackValue;
}

function parseRaster(raster) {
  if (!raster?.rgbaBase64 || !raster.width || !raster.height) {
    return null;
  }

  return {
    width: Number(raster.width),
    height: Number(raster.height),
    data: Buffer.from(raster.rgbaBase64, "base64"),
  };
}

function getPixel(raster, x, y) {
  const index = (y * raster.width + x) * 4;

  return [raster.data[index], raster.data[index + 1], raster.data[index + 2]];
}

function getBackgroundColor(raster) {
  const samples = [];
  const edgeStep = Math.max(Math.floor(Math.min(raster.width, raster.height) / 32), 1);

  for (let x = 0; x < raster.width; x += edgeStep) {
    samples.push(getPixel(raster, x, 0), getPixel(raster, x, raster.height - 1));
  }

  for (let y = 0; y < raster.height; y += edgeStep) {
    samples.push(getPixel(raster, 0, y), getPixel(raster, raster.width - 1, y));
  }

  return [0, 1, 2].map((channel) =>
    samples.reduce((sum, sample) => sum + sample[channel], 0) / Math.max(samples.length, 1),
  );
}

function colorDistance(first, second) {
  return Math.hypot(first[0] - second[0], first[1] - second[1], first[2] - second[2]);
}

function buildForegroundMask(raster) {
  const background = getBackgroundColor(raster);
  const mask = new Uint8Array(raster.width * raster.height);

  for (let y = 0; y < raster.height; y += 1) {
    for (let x = 0; x < raster.width; x += 1) {
      const index = (y * raster.width + x) * 4;
      const color = [raster.data[index], raster.data[index + 1], raster.data[index + 2]];
      const alpha = raster.data[index + 3];
      const distance = colorDistance(color, background);
      const luminance = color[0] * 0.299 + color[1] * 0.587 + color[2] * 0.114;
      const backgroundLum = background[0] * 0.299 + background[1] * 0.587 + background[2] * 0.114;

      if (alpha > 20 && (distance > 28 || Math.abs(luminance - backgroundLum) > 24)) {
        mask[y * raster.width + x] = 1;
      }
    }
  }

  return mask;
}

function findSpanAtRow(mask, width, height, row, centerX) {
  const y = clampValue(Math.round(row), 0, height - 1);
  const spans = [];
  let start = null;

  for (let x = 0; x < width; x += 1) {
    const isForeground = mask[y * width + x] === 1;

    if (isForeground && start === null) {
      start = x;
    }

    if ((!isForeground || x === width - 1) && start !== null) {
      const end = isForeground && x === width - 1 ? x : x - 1;

      if (end - start > width * 0.025) {
        spans.push({ start, end, center: (start + end) / 2, width: end - start + 1 });
      }

      start = null;
    }
  }

  if (spans.length === 0) {
    return null;
  }

  const centerPixel = centerX * width;
  return spans
    .sort((first, second) => {
      const firstContainsCenter = centerPixel >= first.start && centerPixel <= first.end ? 0 : 1;
      const secondContainsCenter = centerPixel >= second.start && centerPixel <= second.end ? 0 : 1;

      return firstContainsCenter - secondContainsCenter || Math.abs(first.center - centerPixel) - Math.abs(second.center - centerPixel);
    })[0];
}

function median(values) {
  if (values.length === 0) {
    return null;
  }

  const sortedValues = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sortedValues.length / 2);

  return sortedValues.length % 2 === 0
    ? (sortedValues[middle - 1] + sortedValues[middle]) / 2
    : sortedValues[middle];
}

function sampleMaskWidth(mask, raster, normalizedY, centerX) {
  const widths = [];
  const row = normalizedY * raster.height;
  const radius = Math.max(Math.round(raster.height * 0.012), 2);

  for (let offset = -radius; offset <= radius; offset += 1) {
    const span = findSpanAtRow(mask, raster.width, raster.height, row + offset, centerX);

    if (span) {
      widths.push(span.width);
    }
  }

  return median(widths);
}

function getLevel(metrics, key, fallback) {
  const value = metrics?.silhouetteLevels?.[key];

  return Number.isFinite(value) ? clampValue(value, 0.02, 0.98) : fallback;
}

function getCenterX(metrics) {
  const value = metrics?.silhouetteLevels?.bodyCenterX;

  return Number.isFinite(value) ? clampValue(value, 0.18, 0.82) : 0.5;
}

function buildSilhouetteMeasurements(payload, height) {
  const frontRaster = parseRaster(payload.rasters?.front);
  const sideRaster = parseRaster(payload.rasters?.side);
  const frontMetrics = payload.poseMetrics?.front;
  const sideMetrics = payload.poseMetrics?.side || frontMetrics;

  if (!frontRaster || !sideRaster || !frontMetrics?.silhouetteLevels) {
    return null;
  }

  const frontMask = buildForegroundMask(frontRaster);
  const sideMask = buildForegroundMask(sideRaster);
  const frontLevels = frontMetrics.silhouetteLevels;
  const sideLevelsSource = sideMetrics?.silhouetteLevels || frontLevels;
  const frontBodyPixelHeight = Math.max((frontLevels.bodyBottomY - frontLevels.bodyTopY) * frontRaster.height, frontRaster.height * 0.55);
  const sideBodyPixelHeight = Math.max((sideLevelsSource.bodyBottomY - sideLevelsSource.bodyTopY) * sideRaster.height, sideRaster.height * 0.55);
  const frontCmPerPixel = height / frontBodyPixelHeight;
  const sideCmPerPixel = height / sideBodyPixelHeight;
  const frontCenterX = getCenterX(frontMetrics);
  const sideCenterX = getCenterX(sideMetrics);
  const levels = {
    chest: getLevel(frontMetrics, "chestY", 0.34),
    underbust: getLevel(frontMetrics, "underbustY", 0.4),
    waist: getLevel(frontMetrics, "waistY", 0.48),
    hip: getLevel(frontMetrics, "hipY", 0.56),
    thigh: getLevel(frontMetrics, "thighY", 0.68),
    knee: getLevel(frontMetrics, "kneeY", 0.78),
    ankle: getLevel(frontMetrics, "ankleY", 0.93),
  };
  const sideLevels = {
    chest: getLevel(sideMetrics, "chestY", levels.chest),
    underbust: getLevel(sideMetrics, "underbustY", levels.underbust),
    waist: getLevel(sideMetrics, "waistY", levels.waist),
    hip: getLevel(sideMetrics, "hipY", levels.hip),
    thigh: getLevel(sideMetrics, "thighY", levels.thigh),
    knee: getLevel(sideMetrics, "kneeY", levels.knee),
    ankle: getLevel(sideMetrics, "ankleY", levels.ankle),
  };
  const sample = (key) => {
    const frontWidth = sampleMaskWidth(frontMask, frontRaster, levels[key], frontCenterX);
    const sideDepth = sampleMaskWidth(sideMask, sideRaster, sideLevels[key], sideCenterX);

    if (!frontWidth || !sideDepth) {
      return null;
    }

    return {
      widthCm: frontWidth * frontCmPerPixel,
      depthCm: sideDepth * sideCmPerPixel,
      circumferenceCm: ellipseCircumference(frontWidth * frontCmPerPixel, sideDepth * sideCmPerPixel),
    };
  };

  return {
    chest: sample("chest"),
    underbust: sample("underbust"),
    waist: sample("waist"),
    hip: sample("hip"),
    thigh: sample("thigh"),
    knee: sample("knee"),
    ankle: sample("ankle"),
    frontCmPerPixel,
    sideCmPerPixel,
  };
}

function buildMeasurements(payload) {
  const profile = payload.profile || "male";
  const height = getHeightCm(payload);
  const frontPose = payload.poseMetrics?.front;
  const hasPoseMetrics = Boolean(frontPose);
  const baseline = getCircumferenceBaseline(profile, height);
  const silhouette = buildSilhouetteMeasurements(payload, height);
  const estimatedShoulder = getShoulderBaseline(profile, height);
  const rawShoulderWidth = scaledRatio(frontPose, "shoulderWidthRatio", height, estimatedShoulder);
  const shoulderWidth = hasPoseMetrics
    ? getCorrectedShoulder(profile, rawShoulderWidth, estimatedShoulder)
    : estimatedShoulder;
  const hipWidth = scaledRatio(frontPose, "hipWidthRatio", height, height * 0.195);
  const torsoLength = scaledRatio(frontPose, "torsoLengthRatio", height, height * 0.31);
  const sleeveBaseline = getSleeveBaseline(profile, height);
  const rawSleeve = scaledRatio(frontPose, "sleeveLengthRatio", height, sleeveBaseline);
  const sleeve = hasPoseMetrics ? getCorrectedSleeve(profile, rawSleeve, sleeveBaseline) : sleeveBaseline;
  const waistToHip = height * getWaistToHipRatio(profile);
  const poseHipToAnkle = scaledOptionalRatio(frontPose, "trouserLengthRatio", height);
  const lowerLengthStartCorrection = getLowerLengthStartCorrection(profile, height);
  const trouserBaseline = getTrouserLengthBaseline(profile, height) - lowerLengthStartCorrection;
  const rawTrouserLength = poseHipToAnkle
    ? poseHipToAnkle + waistToHip - lowerLengthStartCorrection
    : trouserBaseline;
  const trouserLength = hasPoseMetrics
    ? getCorrectedLength(rawTrouserLength, trouserBaseline, { lowerTolerance: 5, upperTolerance: 6 })
    : trouserBaseline;
  const chestWidth = rawShoulderWidth * 0.94;
  const waistWidth = Math.max((chestWidth + hipWidth) / 2 - 2, hipWidth * 0.78);
  const poseChest = chestWidth * (profile === "female" ? 2.55 : 2.5) + 0.5;
  const poseWaist = waistWidth * (profile === "female" ? 2.35 : 2.45) + 0.5;
  const poseHip = hipWidth * (profile === "female" ? 2.9 : 2.75) + 0.5;
  const acceptedSilhouette = {
    chest: silhouette?.chest && isPlausibleWidthDepth(silhouette.chest, chestWidth) && isPlausibleCircumference(silhouette.chest.circumferenceCm, baseline.chest),
    waist: silhouette?.waist && isPlausibleWidthDepth(silhouette.waist, waistWidth) && isPlausibleCircumference(silhouette.waist.circumferenceCm, baseline.waist, 0.16),
    hip: silhouette?.hip && isPlausibleWidthDepth(silhouette.hip, hipWidth) && isPlausibleCircumference(silhouette.hip.circumferenceCm, baseline.hip),
  };
  const generatedChest = roundHalf(
    hasPoseMetrics
      ? chooseCircumference({
        silhouetteSample: silhouette?.chest,
        poseValue: poseChest,
        baselineValue: baseline.chest,
        expectedWidth: chestWidth,
      })
      : baseline.chest,
  );
  const chest = roundHalf(getFirmChestMeasurement(profile, generatedChest, baseline.chest));
  const waist = roundHalf(
    hasPoseMetrics
      ? chooseCircumference({
        silhouetteSample: silhouette?.waist,
        poseValue: poseWaist,
        baselineValue: baseline.waist,
        expectedWidth: waistWidth,
        tolerance: 0.16,
      })
      : baseline.waist,
  );
  const hip = roundHalf(
    hasPoseMetrics
      ? chooseCircumference({
        silhouetteSample: silhouette?.hip,
        poseValue: poseHip,
        baselineValue: baseline.hip,
        expectedWidth: hipWidth,
      })
      : baseline.hip,
  );
  const derived = getDerivedCircumferences(profile, { chest: generatedChest, waist, hip });
  const rise = roundHalf(height * 0.155);
  const inseamBaseline = getInseamBaseline(profile, height);
  const rawInseam = Math.max(0, (poseHipToAnkle || trouserBaseline - waistToHip) - height * 0.03);
  const inseam = getCorrectedLength(rawInseam, inseamBaseline, { lowerTolerance: 5, upperTolerance: 5.5 });
  const underbustCandidate = roundHalf(chooseCircumference({
    silhouetteSample: silhouette?.underbust,
    poseValue: derived.underbust,
    baselineValue: derived.underbust,
    expectedWidth: chestWidth * 0.86,
    tolerance: 0.18,
  }));
  const underbust = roundHalf(getConsistentUnderbust(profile, chest, underbustCandidate));
  const thigh = roundHalf(chooseCircumference({
    silhouetteSample: silhouette?.thigh,
    poseValue: derived.thigh,
    baselineValue: derived.thigh,
    expectedWidth: hipWidth * 0.52,
    tolerance: 0.22,
  }));
  const knee = roundHalf(chooseCircumference({
    silhouetteSample: silhouette?.knee,
    poseValue: derived.knee,
    baselineValue: derived.knee,
    expectedWidth: hipWidth * 0.34,
    tolerance: 0.22,
  }));
  const ankle = roundHalf(chooseCircumference({
    silhouetteSample: silhouette?.ankle,
    poseValue: derived.ankle,
    baselineValue: derived.ankle,
    expectedWidth: hipWidth * 0.2,
    tolerance: 0.25,
  }));

  return {
    measurements: {
      neck: roundHalf(derived.neck),
      chest,
      bust: chest,
      underbust,
      waist,
      stomach: roundHalf(derived.stomach),
      hip,
      seat: hip,
      shoulder: roundHalf(shoulderWidth),
      acrossBack: roundHalf(shoulderWidth - 2),
      armhole: roundHalf(derived.armhole),
      sleeve: roundHalf(sleeve),
      bicep: roundHalf(derived.bicep),
      wrist: roundHalf(derived.wrist),
      topLength: roundHalf(torsoLength + height * 0.13),
      bustPoint: roundHalf(height * 0.16),
      bustSpan: roundHalf(derived.bustSpan),
      frontLength: roundHalf(height * 0.27),
      backLength: roundHalf(height * 0.25),
      trouserLength: roundHalf(trouserLength),
      lowerLength: roundHalf(trouserLength),
      inseam: roundHalf(inseam),
      rise,
      thigh,
      knee,
      ankle,
      highHip: roundHalf(derived.highHip),
      waistToHip: roundHalf(waistToHip),
    },
    confidence: {
      overall: Object.values(acceptedSilhouette).some(Boolean) ? 78 : hasPoseMetrics ? 72 : 55,
      chest: acceptedSilhouette.chest ? 78 : hasPoseMetrics ? 68 : 50,
      waist: acceptedSilhouette.waist ? 78 : hasPoseMetrics ? 68 : 50,
      hip: acceptedSilhouette.hip ? 80 : hasPoseMetrics ? 70 : 52,
    },
    warnings: silhouette
      ? []
      : ["Silhouette sampling could not run. Check that front and side photos are full-body images on a plain background."],
    debug: {
      engine: silhouette ? "2.5d-silhouette-backend" : "pose-baseline-backend",
      heightCm: roundHalf(height),
      usedPoseMetrics: hasPoseMetrics,
      usedSilhouetteSampling: Boolean(silhouette),
      circumferenceGuard: "silhouette-cannot-shrink-more-than-2cm-v1",
      chestCalculation: {
        mode: "firm-output-chest-v2",
        generatedCm: generatedChest,
        finalCm: chest,
        correctionCm: roundHalf(generatedChest - chest),
      },
      underbustCalculation: {
        mode: "bust-underbust-gap-guard-v1",
        candidateCm: underbustCandidate,
        finalCm: underbust,
        bustUnderbustGapCm: roundHalf(chest - underbust),
      },
      shoulderCalculation: {
        mode: "backend-front-pose-corrected-v2",
        baselineCm: roundHalf(estimatedShoulder),
        rawPoseCm: roundHalf(rawShoulderWidth),
        correctedCm: roundHalf(shoulderWidth),
      },
      sleeveCalculation: {
        mode: "adaptive-pose-sleeve-v1",
        baselineCm: roundHalf(sleeveBaseline),
        rawPoseCm: roundHalf(rawSleeve),
        correctedCm: roundHalf(sleeve),
      },
      trouserLengthCalculation: {
        mode: "profile-waist-start-outseam-v2",
        startCorrectionCm: roundHalf(lowerLengthStartCorrection),
        baselineCm: roundHalf(trouserBaseline),
        rawPoseCm: roundHalf(rawTrouserLength),
        correctedCm: roundHalf(trouserLength),
      },
      inseamCalculation: {
        mode: "adaptive-independent-inseam-v2",
        baselineCm: roundHalf(inseamBaseline),
        rawCm: roundHalf(rawInseam),
        correctedCm: roundHalf(inseam),
      },
      acceptedSilhouette,
      frontCmPerPixel: silhouette ? Number(silhouette.frontCmPerPixel.toFixed(4)) : null,
      sideCmPerPixel: silhouette ? Number(silhouette.sideCmPerPixel.toFixed(4)) : null,
      silhouetteSamples: silhouette
        ? {
          chest: silhouette.chest,
          waist: silhouette.waist,
          hip: silhouette.hip,
          thigh: silhouette.thigh,
          knee: silhouette.knee,
          ankle: silhouette.ankle,
        }
        : null,
    },
  };
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify(body));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let rawBody = "";

    request.on("data", (chunk) => {
      rawBody += chunk;

      if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) {
        reject(new Error("Request body is too large"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(rawBody));
    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  if (request.method !== "POST" || request.url !== "/measurements/segment") {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  try {
    const rawBody = await readBody(request);
    const payload = JSON.parse(rawBody);

    if (!payload.images?.front || !payload.images?.side) {
      sendJson(response, 400, {
        error: `Front and side images are required. Received front: ${Boolean(payload.images?.front)}, side: ${Boolean(payload.images?.side)}.`,
      });
      return;
    }

    if (!payload.rasters?.front || !payload.rasters?.side) {
      sendJson(response, 400, {
        error: `Front and side rasters are required for 2.5D silhouette sampling. Received front: ${Boolean(payload.rasters?.front)}, side: ${Boolean(payload.rasters?.side)}.`,
      });
      return;
    }

    sendJson(response, 200, buildMeasurements(payload));
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Segmentation backend failed" });
  }
});

server.listen(PORT, () => {
  console.log(`TailorIQ segmentation backend listening on http://localhost:${PORT}`);
});
