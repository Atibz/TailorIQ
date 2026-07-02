export { referenceObjects } from "../../shared/referenceObjects";

export const baseGuidelineLabels = {
  fullBody: "Full body is visible",
  centered: "Body is centered in the frame",
  upright: "Camera is straight and level",
  armsClear: "Arms leave a small gap at the sides",
  lighting: "Lighting is clear",
  contrast: "Image contrast is usable",
  sharpness: "Image is not blurry",
};

export const baseGuidelineFixes = {
  fullBody: "Make sure the whole body is inside the photo, from head to feet.",
  centered: "Place the person near the center of the photo.",
  upright: "Keep the phone straight and avoid a tilted photo.",
  armsClear: "Relax the arms naturally with a small visible gap from the body so the waist and sides are not hidden.",
  lighting: "Use brighter, even lighting without heavy shadows.",
  contrast: "Use a plain background or clearer clothing/background contrast.",
  sharpness: "Use a sharper photo and avoid motion blur.",
};

export const referenceGuideRules = {
  "a4-paper": {
    label: "A4 paper is flat, full, and beside the body",
    fix: "Place one full A4 sheet flat beside the body, not covering the body, and keep all four sheet edges visible in both photos.",
  },
  "standard-door": {
    label: "Door height is visible from top to floor",
    fix: "Stand close to the door and keep the top frame, bottom/floor line, and full body visible in the same photo.",
  },
  "measuring-tape": {
    label: "Measuring tape is vertical and readable",
    fix: "Hang the tape straight beside the body with the marked length visible, vertical, and not bent or hidden.",
  },
};

export const guidelineLabels = baseGuidelineLabels;
export const guidelineFixes = baseGuidelineFixes;

export function getGuidelineLabels({ scaleMode, referenceObject } = {}) {
  if (scaleMode !== "reference") {
    return baseGuidelineLabels;
  }

  return {
    ...baseGuidelineLabels,
    referenceAnchor:
      referenceGuideRules[referenceObject]?.label || "Reference object is clearly visible",
  };
}

export function getGuidelineFixes({ scaleMode, referenceObject } = {}) {
  if (scaleMode !== "reference") {
    return baseGuidelineFixes;
  }

  return {
    ...baseGuidelineFixes,
    referenceAnchor:
      referenceGuideRules[referenceObject]?.fix ||
      "Keep the selected reference object clearly visible beside the body in both photos.",
  };
}

export function getEmptyGuidelines(captureSettings) {
  return Object.keys(getGuidelineLabels(captureSettings)).reduce(
    (checks, key) => ({ ...checks, [key]: false }),
    {},
  );
}

export const emptyGuidelines = Object.keys(guidelineLabels).reduce(
  (checks, key) => ({ ...checks, [key]: false }),
  {},
);

export const emptyPhotos = {
  front: null,
  side: null,
};

export const emptyUploadStatus = {
  front: "",
  side: "",
};

export function preventNumberInputWheel(event) {
  event.currentTarget.blur();
}

export const captureLabels = {
  front: "Front view",
  side: "Side view",
};

export const fieldClass =
  "min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-amber-600 focus:ring-4 focus:ring-amber-100";

export const labelClass = "text-sm font-medium text-stone-700";
