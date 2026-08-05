import { buildMeasurementList, getProfileFields, roundMeasurement } from "../constants/measurementFields";
import { resultGuideDefinitions } from "../constants/resultGuideDefinitions";

export function buildManualMeasurementList(profileId, values = {}) {
  return getProfileFields(profileId).map((field) => ({
    fieldKey: field.key,
    valueKey: field.valueKey,
    label: field.label,
    valueCm: values[field.valueKey] || "",
    note: field.note,
    group: field.group,
  }));
}

export function groupMeasurements(measurements = []) {
  return measurements.filter(isVisibleMeasurement).reduce((groups, measurement) => {
    const groupName = measurement.group || "Measurements";
    const existingGroup = groups.find((group) => group.title === groupName);

    if (existingGroup) {
      existingGroup.items.push(measurement);
      return groups;
    }

    return [...groups, { title: groupName, items: [measurement] }];
  }, []);
}

export function getMeasurementSummary(measurements = []) {
  const visibleMeasurements = measurements.filter(isVisibleMeasurement);
  const filledMeasurements = visibleMeasurements.filter((measurement) => Number(measurement?.valueCm) > 0);

  return {
    total: visibleMeasurements.length,
    filled: filledMeasurements.length,
  };
}

export function cmToInches(value) {
  return Math.round((Number(value) / 2.54) * 4) / 4;
}

export function toDisplayMeasurementValue(valueCm, unit) {
  const numericValue = Number(valueCm);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return "";
  }

  return unit === "in" ? String(cmToInches(numericValue)) : String(roundMeasurement(numericValue));
}

export function fromDisplayMeasurementValue(value, unit) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return "";
  }

  return unit === "in" ? roundMeasurement(numericValue * 2.54) : roundMeasurement(numericValue);
}

export function findGuideMark(profileId, measurement) {
  const guideKey = getGuideKeyForMeasurement(profileId, measurement);
  const guide = resultGuideDefinitions[profileId] || resultGuideDefinitions.male;

  return guide.find((mark) => mark.key === guideKey) || null;
}

export function isVisibleMeasurement(measurement = {}) {
  return measurement.fieldKey !== "acrossBack" && measurement.valueKey !== "acrossBack";
}

export function createMeasurementListFromResult(profileId, values) {
  return buildMeasurementList(profileId, values).filter(isVisibleMeasurement);
}

function getGuideKeyForMeasurement(profileId, measurement = {}) {
  if (profileId === "female" && (measurement.valueKey === "waistBand" || measurement.label === "Waist band")) {
    return "waistLower";
  }

  return measurement.valueKey || measurement.fieldKey;
}
