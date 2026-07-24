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
  if (profile === "female") {
    let correction = 1;

    if (generatedChest >= 101) {
      correction = 9.5;
    } else if (generatedChest >= 96) {
      correction = 8.5;
    } else if (generatedChest >= 92) {
      correction = 6;
    } else if (generatedChest >= 89) {
      correction = 3;
    }

    return clampValue(generatedChest - correction, baselineChest - 4, baselineChest + 8);
  }

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
  return profile === "female" ? 0 : height * 0.018;
}

function getInseamBaseline(profile, height) {
  return height * (profile === "female" ? 0.435 : 0.44);
}

function getTopLength(profile, height, torsoLength, waistToHip) {
  return profile === "female"
    ? torsoLength + waistToHip
    : torsoLength + height * 0.18;
}

function getRise(profile, height) {
  return height * (profile === "female" ? 0.19 : 0.155);
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
    return { minimum: 10, maximum: 18, target: 14 };
  }

  if (bust < 96) {
    return { minimum: 12, maximum: 19, target: 15 };
  }

  if (bust < 106) {
    return { minimum: 13, maximum: 20, target: 16 };
  }

  return { minimum: 14, maximum: 22, target: 17 };
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

function getStableUnderbust(profile, bust, underbustCandidate) {
  if (profile !== "female") {
    return underbustCandidate;
  }

  const gap = getBustUnderbustGap(profile, bust);
  const guardedCandidate = getConsistentUnderbust(profile, bust, underbustCandidate);
  const gapAnchored = bust - gap.target;
  const guardedGapDifference = Math.abs((bust - guardedCandidate) - gap.target);
  const candidateWeight = guardedGapDifference <= 3 ? 0.3 : 0.15;
  const stableUnderbust = blendValues(guardedCandidate, gapAnchored, candidateWeight);

  return clampValue(stableUnderbust, bust - gap.maximum, bust - gap.minimum);
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

function getArmholeMeasurement(profile, chest, shoulder) {
  return profile === "female"
    ? chest * 0.27 + shoulder * 0.22 + 12.7
    : chest * 0.29 + shoulder * 0.24 + 10.16;
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

function chooseCircumference({ silhouetteSample, poseValue, baselineValue, expectedWidth, tolerance = 0.18, maxFallbackDelta = 3.5 }) {
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

    const fallbackDelta = silhouetteValue - fallbackValue;

    if (Math.abs(fallbackDelta) > maxFallbackDelta) {
      return fallbackValue + Math.sign(fallbackDelta) * maxFallbackDelta;
    }

    return silhouetteValue;
  }

  return fallbackValue;
}

function chooseScannedCircumference({ silhouetteSample, fallbackValue, minimum, maximum }) {
  if (!silhouetteSample?.circumferenceCm) {
    return fallbackValue;
  }

  return clampValue(silhouetteSample.circumferenceCm, minimum, maximum);
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

function getBodyComponentMask(mask, width, height, { centerX = 0.5, topY = 0.04, bottomY = 0.96 } = {}) {
  const visited = new Uint8Array(mask.length);
  const bodyCenterPixel = clampValue(centerX, 0, 1) * width;
  const bodyTopPixel = clampValue(topY, 0, 1) * height;
  const bodyBottomPixel = clampValue(bottomY, 0, 1) * height;
  const minimumArea = Math.max(Math.round(width * height * 0.001), 12);
  const components = [];

  for (let startIndex = 0; startIndex < mask.length; startIndex += 1) {
    if (mask[startIndex] !== 1 || visited[startIndex]) {
      continue;
    }

    const stack = [startIndex];
    const pixels = [];
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;

    visited[startIndex] = 1;

    while (stack.length > 0) {
      const index = stack.pop();
      const x = index % width;
      const y = Math.floor(index / width);

      pixels.push(index);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      const neighbors = [
        x > 0 ? index - 1 : -1,
        x < width - 1 ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y < height - 1 ? index + width : -1,
      ];

      neighbors.forEach((neighbor) => {
        if (neighbor >= 0 && mask[neighbor] === 1 && !visited[neighbor]) {
          visited[neighbor] = 1;
          stack.push(neighbor);
        }
      });
    }

    if (pixels.length < minimumArea) {
      continue;
    }

    const centerDistance = Math.abs((minX + maxX) / 2 - bodyCenterPixel) / width;
    const centerBonus = bodyCenterPixel >= minX - width * 0.1 && bodyCenterPixel <= maxX + width * 0.1 ? 1.8 : 1;
    const overlapTop = Math.max(minY, bodyTopPixel);
    const overlapBottom = Math.min(maxY, bodyBottomPixel);
    const overlapRatio = Math.max(overlapBottom - overlapTop, 0) / Math.max(maxY - minY, 1);
    const score = pixels.length * centerBonus * Math.max(overlapRatio, 0.35) * (1 - Math.min(centerDistance, 0.8) * 0.55);

    components.push({
      pixels,
      area: pixels.length,
      box: { minX, maxX, minY, maxY },
      score,
    });
  }

  if (components.length === 0) {
    return {
      mask,
      metadata: {
        componentCount: 0,
        selectedArea: 0,
        retainedRatio: 1,
        cleanupApplied: false,
      },
    };
  }

  const selected = components.sort((first, second) => second.score - first.score)[0];
  const cleanedMask = new Uint8Array(mask.length);

  selected.pixels.forEach((index) => {
    cleanedMask[index] = 1;
  });

  return {
    mask: cleanedMask,
    metadata: {
      componentCount: components.length,
      selectedArea: selected.area,
      retainedRatio: Number((selected.area / Math.max(mask.reduce((sum, value) => sum + value, 0), 1)).toFixed(3)),
      cleanupApplied: components.length > 1,
      selectedBox: selected.box,
    },
  };
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

function sampleSilhouetteAtLevel({ frontMask, sideMask, frontRaster, sideRaster, frontCmPerPixel, sideCmPerPixel, frontCenterX, sideCenterX }, normalizedY) {
  const frontWidth = sampleMaskWidth(frontMask, frontRaster, normalizedY, frontCenterX);
  const sideDepth = sampleMaskWidth(sideMask, sideRaster, normalizedY, sideCenterX);

  if (!frontWidth || !sideDepth) {
    return null;
  }

  const widthCm = frontWidth * frontCmPerPixel;
  const depthCm = sideDepth * sideCmPerPixel;

  return {
    level: normalizedY,
    widthCm,
    depthCm,
    circumferenceCm: ellipseCircumference(widthCm, depthCm),
  };
}

function findSilhouetteLevel(context, { start, end, mode = "narrowest", fallback }) {
  const lower = clampValue(Math.min(start, end), 0.02, 0.98);
  const upper = clampValue(Math.max(start, end), lower + 0.01, 0.98);
  const steps = 18;
  let best = null;

  for (let index = 0; index <= steps; index += 1) {
    const level = lower + ((upper - lower) * index) / steps;
    const sample = sampleSilhouetteAtLevel(context, level);

    if (!sample) {
      continue;
    }

    if (!best) {
      best = sample;
      continue;
    }

    if (mode === "widest" && sample.circumferenceCm > best.circumferenceCm) {
      best = sample;
    }

    if (mode === "narrowest" && sample.circumferenceCm < best.circumferenceCm) {
      best = sample;
    }
  }

  return best || sampleSilhouetteAtLevel(context, fallback);
}

function getLevel(metrics, key, fallback) {
  const value = metrics?.silhouetteLevels?.[key];

  return Number.isFinite(value) ? clampValue(value, 0.02, 0.98) : fallback;
}

function getCenterX(metrics) {
  const value = metrics?.silhouetteLevels?.bodyCenterX;

  return Number.isFinite(value) ? clampValue(value, 0.18, 0.82) : 0.5;
}

function getFrameWarnings(metrics, label) {
  const warnings = [];
  const frame = metrics?.frameMetrics;

  if (!frame) {
    warnings.push(`${label} image quality data is missing. Retake the photo if the result looks unreliable.`);
    return warnings;
  }

  if (frame.brightness < 50) {
    warnings.push(`${label} photo looks too dark. Use brighter, even lighting so the body is clear.`);
  } else if (frame.brightness > 225) {
    warnings.push(`${label} photo looks overexposed. Reduce harsh light so the body outline stays visible.`);
  }

  if (frame.contrast < 16) {
    warnings.push(`${label} photo has low contrast. Use a plainer background or clothing that separates from the background.`);
  }

  if (frame.sharpness < 4) {
    warnings.push(`${label} photo may be blurry. Hold the camera steady or retake before measuring.`);
  }

  return warnings;
}

function getBodyFitWarnings(metrics, label, { minimum, maximum }) {
  const bodyHeightRatio = metrics?.bodyHeightRatio;

  if (!Number.isFinite(bodyHeightRatio)) {
    return [`${label} full-body check is missing. Retake the photo if the person is not clearly visible from head to feet.`];
  }

  if (bodyHeightRatio < minimum) {
    return [`${label} person is too small in the frame. Move the camera closer while keeping head and feet visible.`];
  }

  if (bodyHeightRatio > maximum) {
    return [`${label} person is too close to the camera. Move the camera back so the full body fits comfortably.`];
  }

  return [];
}

function getLandmarkSummary(metrics) {
  const landmarks = Array.isArray(metrics?.landmarks) ? metrics.landmarks : [];
  const visibleCount = landmarks.filter((landmark) => Number(landmark.visibility) >= 0.35).length;

  return {
    source: metrics?.landmarkSource || "unknown",
    count: landmarks.length,
    visibleCount,
    hasExpectedLandmarks: landmarks.length >= 33,
  };
}

function validateCapturePayload(payload) {
  const frontPose = payload.poseMetrics?.front;
  const sidePose = payload.poseMetrics?.side;
  const errors = [];
  const warnings = [];

  if (!frontPose?.silhouetteLevels) {
    errors.push("Front view photo check is missing. Retake or re-upload the front photo with the guided checks active.");
  }

  if (!sidePose?.silhouetteLevels) {
    errors.push("Side view photo check is missing. Retake or re-upload the side photo with the guided checks active.");
  }

  if (errors.length > 0) {
    return { errors, warnings };
  }

  warnings.push(
    ...getFrameWarnings(frontPose, "Front view"),
    ...getFrameWarnings(sidePose, "Side view"),
    ...getBodyFitWarnings(frontPose, "Front view", { minimum: 0.48, maximum: 0.94 }),
    ...getBodyFitWarnings(sidePose, "Side view", { minimum: 0.38, maximum: 0.96 }),
  );

  const frontLandmarks = getLandmarkSummary(frontPose);
  const sideLandmarks = getLandmarkSummary(sidePose);

  if (!frontLandmarks.hasExpectedLandmarks) {
    warnings.push("Front view photo is missing some body details. Retake if the result looks unreliable.");
  }

  if (!sideLandmarks.hasExpectedLandmarks) {
    warnings.push("Side view photo is missing some body details. Retake if the result looks unreliable.");
  }

  return { errors, warnings };
}

function buildSilhouetteMeasurements(payload, height, profile) {
  const frontRaster = parseRaster(payload.rasters?.front);
  const sideRaster = parseRaster(payload.rasters?.side);
  const frontMetrics = payload.poseMetrics?.front;
  const sideMetrics = payload.poseMetrics?.side || frontMetrics;

  if (!frontRaster || !sideRaster || !frontMetrics?.silhouetteLevels) {
    return null;
  }

  const frontLevels = frontMetrics.silhouetteLevels;
  const sideLevelsSource = sideMetrics?.silhouetteLevels || frontLevels;
  const rawFrontMask = buildForegroundMask(frontRaster);
  const rawSideMask = buildForegroundMask(sideRaster);
  const frontCleanup = getBodyComponentMask(rawFrontMask, frontRaster.width, frontRaster.height, {
    centerX: getCenterX(frontMetrics),
    topY: frontLevels.bodyTopY,
    bottomY: frontLevels.bodyBottomY,
  });
  const sideCleanup = getBodyComponentMask(rawSideMask, sideRaster.width, sideRaster.height, {
    centerX: getCenterX(sideMetrics),
    topY: sideLevelsSource.bodyTopY,
    bottomY: sideLevelsSource.bodyBottomY,
  });
  const frontMask = frontCleanup.mask;
  const sideMask = sideCleanup.mask;
  const frontBodyPixelHeight = Math.max((frontLevels.bodyBottomY - frontLevels.bodyTopY) * frontRaster.height, frontRaster.height * 0.55);
  const sideBodyPixelHeight = Math.max((sideLevelsSource.bodyBottomY - sideLevelsSource.bodyTopY) * sideRaster.height, sideRaster.height * 0.55);
  const frontCmPerPixel = height / frontBodyPixelHeight;
  const sideCmPerPixel = height / sideBodyPixelHeight;
  const frontCenterX = getCenterX(frontMetrics);
  const sideCenterX = getCenterX(sideMetrics);
  const poseLevels = {
    shoulderY: getLevel(frontMetrics, "shoulderY", 0.24),
    chest: getLevel(frontMetrics, "chestY", 0.34),
    underbust: getLevel(frontMetrics, "underbustY", 0.4),
    waist: getLevel(frontMetrics, "waistY", 0.48),
    hip: getLevel(frontMetrics, "hipY", 0.56),
    thigh: getLevel(frontMetrics, "thighY", 0.68),
    knee: getLevel(frontMetrics, "kneeY", 0.78),
    ankle: getLevel(frontMetrics, "ankleY", 0.93),
  };
  const context = {
    frontMask,
    sideMask,
    frontRaster,
    sideRaster,
    frontCmPerPixel,
    sideCmPerPixel,
    frontCenterX,
    sideCenterX,
  };
  const torsoHeight = Math.max(poseLevels.hip - poseLevels.shoulderY, 0.08);
  const bodyHeightRatio = frontBodyPixelHeight / frontRaster.height;
  const sample = (level) => sampleSilhouetteAtLevel(context, level);
  const underbustLevel = clampValue(
    poseLevels.chest + torsoHeight * 0.16,
    poseLevels.chest,
    poseLevels.waist - torsoHeight * 0.08,
  );
  const waist = findSilhouetteLevel(context, {
    start: poseLevels.underbust + torsoHeight * 0.12,
    end: poseLevels.hip - torsoHeight * 0.2,
    mode: "narrowest",
    fallback: poseLevels.waist,
  });
  const waistLevel = waist?.level || poseLevels.waist;
  const waistBandLevel = profile === "female"
    ? clampValue(waistLevel + torsoHeight * 0.15, waistLevel, poseLevels.hip - torsoHeight * 0.08)
    : waistLevel;
  const highHipLevel = clampValue(
    waistBandLevel + torsoHeight * 0.08,
    waistBandLevel + torsoHeight * 0.04,
    poseLevels.hip - torsoHeight * 0.04,
  );
  const highHip = sample(highHipLevel);
  const hip = sample(poseLevels.hip);
  const thigh = findSilhouetteLevel(context, {
    start: poseLevels.hip + (poseLevels.knee - poseLevels.hip) * 0.12,
    end: poseLevels.hip + (poseLevels.knee - poseLevels.hip) * 0.45,
    mode: "widest",
    fallback: poseLevels.thigh,
  });

  return {
    chest: sample(poseLevels.chest),
    underbust: sample(underbustLevel),
    waist,
    waistBand: sample(waistBandLevel),
    highHip,
    hip,
    thigh,
    knee: sample(poseLevels.knee),
    ankle: sample(poseLevels.ankle),
    levels: {
      shoulder: poseLevels.shoulderY,
      chest: poseLevels.chest,
      underbust: underbustLevel,
      waist: waistLevel,
      waistBand: waistBandLevel,
      highHip: highHipLevel,
      hip: poseLevels.hip,
      thigh: thigh?.level || poseLevels.thigh,
      knee: poseLevels.knee,
      ankle: poseLevels.ankle,
    },
    bodyHeightRatio,
    frontCmPerPixel,
    sideCmPerPixel,
    maskCleanup: {
      front: frontCleanup.metadata,
      side: sideCleanup.metadata,
    },
  };
}

function buildMeasurements(payload, captureWarnings = []) {
  const profile = payload.profile || "male";
  const height = getHeightCm(payload);
  const frontPose = payload.poseMetrics?.front;
  const hasPoseMetrics = Boolean(frontPose);
  const baseline = getCircumferenceBaseline(profile, height);
  const silhouette = buildSilhouetteMeasurements(payload, height, profile);
  const getSilhouetteLevelDistance = (startLevel, endLevel) => {
    if (!silhouette?.bodyHeightRatio || !Number.isFinite(startLevel) || !Number.isFinite(endLevel)) {
      return null;
    }

    return Math.max(0, ((endLevel - startLevel) / silhouette.bodyHeightRatio) * height);
  };
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
  const estimatedWaistToHip = height * getWaistToHipRatio(profile);
  const poseHipToAnkle = scaledOptionalRatio(frontPose, "trouserLengthRatio", height);
  const lowerLengthStartCorrection = getLowerLengthStartCorrection(profile, height);
  const trouserBaseline = getTrouserLengthBaseline(profile, height) - lowerLengthStartCorrection;
  const rawTrouserLength = poseHipToAnkle
    ? poseHipToAnkle + estimatedWaistToHip - lowerLengthStartCorrection
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
    chest: Boolean(silhouette?.chest && isPlausibleWidthDepth(silhouette.chest, chestWidth) && isPlausibleCircumference(silhouette.chest.circumferenceCm, baseline.chest)),
    waist: Boolean(silhouette?.waist && isPlausibleWidthDepth(silhouette.waist, waistWidth) && isPlausibleCircumference(silhouette.waist.circumferenceCm, baseline.waist, 0.16)),
    hip: Boolean(silhouette?.hip && isPlausibleWidthDepth(silhouette.hip, hipWidth) && isPlausibleCircumference(silhouette.hip.circumferenceCm, baseline.hip)),
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
  const waistBand = roundHalf(
    profile === "female"
      ? chooseScannedCircumference({
        silhouetteSample: silhouette?.waistBand,
        fallbackValue: waist + 2,
        minimum: waist - 2,
        maximum: waist + Math.max(waist * 0.12, 8),
      })
      : waist,
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
  const rise = roundHalf(getRise(profile, height));
  const inseamBaseline = getInseamBaseline(profile, height);
  const rawInseam = Math.max(0, (poseHipToAnkle || trouserBaseline - estimatedWaistToHip) - height * 0.03);
  const inseam = getCorrectedLength(rawInseam, inseamBaseline, { lowerTolerance: 5, upperTolerance: 5.5 });
  const underbustCandidate = roundHalf(chooseScannedCircumference({
    silhouetteSample: silhouette?.underbust,
    fallbackValue: derived.underbust,
    minimum: derived.underbust - Math.max(derived.underbust * 0.12, 7),
    maximum: derived.underbust + Math.max(derived.underbust * 0.1, 6),
  }));
  const underbust = roundHalf(getStableUnderbust(profile, chest, underbustCandidate));
  const thigh = roundHalf(derived.thigh);
  const knee = roundHalf(derived.knee);
  const ankle = roundHalf(chooseScannedCircumference({
    silhouetteSample: silhouette?.ankle,
    fallbackValue: derived.ankle,
    minimum: derived.ankle - Math.max(derived.ankle * 0.16, 4),
    maximum: derived.ankle + Math.max(derived.ankle * 0.16, 4),
  }));
  const highHip = roundHalf(derived.highHip);
  const waistToHip = height * getWaistToHipRatio(profile);
  const topLengthTargetLevel = profile === "female" ? silhouette?.levels?.highHip : silhouette?.levels?.hip;
  const topLength = getSilhouetteLevelDistance(silhouette?.levels?.shoulder, topLengthTargetLevel)
    || getTopLength(profile, height, torsoLength, estimatedWaistToHip);
  const armholeChest = profile === "female" ? generatedChest : chest;
  const armhole = roundHalf(getArmholeMeasurement(profile, armholeChest, shoulderWidth));
  const shoulderToWaist = getSilhouetteLevelDistance(silhouette?.levels?.shoulder, silhouette?.levels?.waist);
  const frontLength = shoulderToWaist || height * 0.27;
  const backLength = shoulderToWaist
    ? Math.max(shoulderToWaist - (profile === "female" ? 2 : 1), height * 0.2)
    : height * 0.25;

  return {
    measurements: {
      neck: roundHalf(derived.neck),
      chest,
      bust: chest,
      underbust,
      waist,
      waistBand,
      stomach: roundHalf(derived.stomach),
      hip,
      seat: hip,
      shoulder: roundHalf(shoulderWidth),
      acrossBack: roundHalf(shoulderWidth - 2),
      armhole,
      sleeve: roundHalf(sleeve),
      bicep: roundHalf(derived.bicep),
      wrist: roundHalf(derived.wrist),
      topLength: roundHalf(topLength),
      bustPoint: roundHalf(height * 0.16),
      bustSpan: roundHalf(derived.bustSpan),
      frontLength: roundHalf(frontLength),
      backLength: roundHalf(backLength),
      trouserLength: roundHalf(trouserLength),
      lowerLength: roundHalf(trouserLength),
      inseam: roundHalf(inseam),
      rise,
      thigh,
      knee,
      ankle,
      highHip,
      waistToHip: roundHalf(waistToHip),
    },
    confidence: {
      overall: Math.max((Object.values(acceptedSilhouette).some(Boolean) ? 78 : hasPoseMetrics ? 72 : 55) - captureWarnings.length * 3, 45),
      chest: Math.max((acceptedSilhouette.chest ? 78 : hasPoseMetrics ? 68 : 50) - captureWarnings.length * 2, 42),
      waist: Math.max((acceptedSilhouette.waist ? 78 : hasPoseMetrics ? 68 : 50) - captureWarnings.length * 2, 42),
      hip: Math.max((acceptedSilhouette.hip ? 80 : hasPoseMetrics ? 70 : 52) - captureWarnings.length * 2, 42),
    },
    warnings: [
      ...captureWarnings,
      ...(silhouette
        ? []
        : ["The body outline could not be checked well. Use clear full-body front and side photos on a plain background."]),
    ],
    debug: {
      engine: silhouette ? "2.5d-silhouette-backend" : "pose-baseline-backend",
      heightCm: roundHalf(height),
      usedPoseMetrics: hasPoseMetrics,
      usedSilhouetteSampling: Boolean(silhouette),
      captureValidation: {
        warningCount: captureWarnings.length,
        warnings: captureWarnings,
        landmarks: {
          front: getLandmarkSummary(payload.poseMetrics?.front),
          side: getLandmarkSummary(payload.poseMetrics?.side),
        },
      },
      circumferenceGuard: "direct-scanned-rows-with-profile-clamps-v1",
      silhouetteSelection: {
        waist: "narrowest torso row",
        highHip: "derived from restored hip relationship",
        hip: "restored blended hip estimator",
        underbust: "row just below bust",
        thigh: "restored derived thigh relationship",
        knee: "restored derived knee relationship",
        waistToHip: "profile ratio from natural waist to high hip",
        topLength: profile === "female" ? "shoulder row to high hip row" : "shoulder row to hip/seat row",
      },
      chestCalculation: {
        mode: "female-bust-band-correction-v3",
        generatedCm: generatedChest,
        finalCm: chest,
        correctionCm: roundHalf(generatedChest - chest),
      },
      underbustCalculation: {
        mode: "wider-bust-underbust-gap-v3",
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
      armholeCalculation: {
        mode: "upper-frame-chest-shoulder-v3",
        chestCm: chest,
        frameChestCm: armholeChest,
        shoulderCm: roundHalf(shoulderWidth),
        finalCm: armhole,
      },
      bodiceLengthCalculation: {
        mode: "shoulder-to-natural-waist-row-v1",
        shoulderLevel: silhouette?.levels?.shoulder ?? null,
        waistLevel: silhouette?.levels?.waist ?? null,
        frontLengthCm: roundHalf(frontLength),
        backLengthCm: roundHalf(backLength),
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
      maskCleanup: silhouette?.maskCleanup || null,
      silhouetteSamples: silhouette
        ? {
          chest: silhouette.chest,
          waist: silhouette.waist,
          waistBand: silhouette.waistBand,
          highHip: silhouette.highHip,
          hip: silhouette.hip,
          thigh: silhouette.thigh,
          knee: silhouette.knee,
          ankle: silhouette.ankle,
          levels: silhouette.levels,
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
  const requestPath = new URL(request.url, `http://${request.headers.host || "localhost"}`).pathname;
  const measurementPaths = new Set(["/", "/measure", "/measurements/segment"]);

  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  if (request.method === "GET" && (requestPath === "/" || requestPath === "/health")) {
    sendJson(response, 200, {
      ok: true,
      service: "TailorIQ measurement service",
      endpoint: "/measurements/segment",
    });
    return;
  }

  if (request.method !== "POST" || !measurementPaths.has(requestPath)) {
    sendJson(response, 404, {
      error: "Not found",
      expected: "POST /measurements/segment",
    });
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
        error: `Front and side photos could not be prepared for measurement. Received front: ${Boolean(payload.rasters?.front)}, side: ${Boolean(payload.rasters?.side)}.`,
      });
      return;
    }

    const captureValidation = validateCapturePayload(payload);

    if (captureValidation.errors.length > 0) {
      sendJson(response, 400, {
        error: captureValidation.errors.join(" "),
        warnings: captureValidation.warnings,
      });
      return;
    }

    sendJson(response, 200, buildMeasurements(payload, captureValidation.warnings));
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Measurement service failed" });
  }
});

server.listen(PORT, () => {
  console.log(`TailorIQ measurement service listening on http://localhost:${PORT}`);
});
