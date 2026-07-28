export const measurementProfiles = {
  male: {
    label: "Male",
    sections: [
      {
        title: "Upper body",
        fields: [
          { key: "neck", label: "Neck", note: "Collar circumference" },
          { key: "chest", label: "Chest", note: "Around the fullest chest" },
          { key: "stomach", label: "Stomach", note: "Around the belly line" },
          { key: "shoulder", label: "Shoulder", note: "Across the back from one shoulder point to the other" },
          { key: "armhole", label: "Armhole", note: "Around the arm opening" },
          { key: "sleeve", label: "Sleeve length", note: "Shoulder point where sleeve starts to wrist" },
          { key: "bicep", label: "Round sleeve", note: "Around upper arm" },
          { key: "wrist", label: "Cuff / wrist", note: "Around wrist or cuff opening" },
          { key: "topLength", label: "Top length", note: "Shoulder to hip/seat line" },
        ],
      },
      {
        title: "Trouser",
        fields: [
          { key: "waist", label: "Waist", note: "Trouser waistband position" },
          { key: "seat", label: "Seat", note: "Around the fullest hip/seat" },
          { key: "trouserLength", label: "Outseam", note: "Waistband to ankle/hem" },
          { key: "inseam", label: "Inseam", note: "Crotch to ankle/hem" },
          { key: "rise", label: "Rise", note: "Waistband to crotch depth" },
          { key: "thigh", label: "Thigh", note: "Around fullest upper thigh" },
          { key: "knee", label: "Knee", note: "Around knee joint" },
          { key: "ankle", label: "Bottom / ankle", note: "Trouser bottom opening" },
        ],
      },
    ],
  },
  female: {
    label: "Female",
    sections: [
      {
        title: "Upper body",
        fields: [
          { key: "bust", label: "Bust", note: "Around the fullest bust" },
          { key: "underbust", label: "Underbust", note: "Ribcage directly below bust" },
          { key: "waist", label: "Waist", note: "Natural waist line" },
          { key: "shoulder", label: "Shoulder", note: "Across the back from one shoulder point to the other" },
          { key: "bustPoint", label: "Bust point", note: "Shoulder to bust apex" },
          { key: "bustSpan", label: "Bust span", note: "Apex to apex spacing" },
          { key: "frontLength", label: "Front bodice length", note: "Shoulder through bust to waist" },
          { key: "backLength", label: "Back bodice length", note: "Back neck to waist" },
          { key: "armhole", label: "Armhole", note: "Around the arm opening" },
          { key: "sleeve", label: "Sleeve length", note: "Shoulder point where sleeve starts to wrist" },
          { key: "bicep", label: "Round sleeve", note: "Around upper arm" },
          { key: "topLength", label: "Blouse/top length", note: "Shoulder to high hip" },
        ],
      },
      {
        title: "Lower body",
        fields: [
          { key: "waist", label: "Waist band", note: "Chosen skirt, trouser, or gown waistband line" },
          { key: "highHip", label: "High hip", note: "Upper hip below waist" },
          { key: "hip", label: "Full hip", note: "Around the fullest hip" },
          { key: "waistToHip", label: "Waist to hip", note: "Vertical drop from natural waist to high hip" },
          { key: "lowerLength", label: "Skirt/trouser length", note: "Natural waist to ankle/hem" },
          { key: "rise", label: "Rise", note: "Natural waist to crotch depth for trousers" },
          { key: "inseam", label: "Inseam", note: "Crotch to ankle/hem for trousers" },
          { key: "thigh", label: "Thigh", note: "Around fullest upper thigh" },
          { key: "knee", label: "Knee", note: "Around knee joint" },
          { key: "ankle", label: "Ankle / hem", note: "Trouser ankle or skirt hem opening" },
        ],
      },
    ],
  },
};

const MEASUREMENT_PRECISION = 0.25;

export const roundMeasurement = (value) => Math.round(Number(value) / MEASUREMENT_PRECISION) * MEASUREMENT_PRECISION;

export function getProfileFields(profileId) {
  const profile = measurementProfiles[profileId] || measurementProfiles.male;

  return profile.sections.flatMap((section) =>
    section.fields.map((field) => ({
      ...field,
      group: section.title,
      valueKey: field.key === "waist" && section.title === "Lower body" ? "waistBand" : field.key,
    })),
  );
}

export function buildMeasurementList(profileId, values = {}) {
  return getProfileFields(profileId).map((field) => {
    const rawValue = Number(values[field.valueKey]);
    const valueCm = Number.isFinite(rawValue) && rawValue > 0 ? roundMeasurement(rawValue) : 0;

    return {
      fieldKey: field.key,
      label: field.label,
      valueCm,
      note: `Photo-based result: ${field.note}`,
      group: field.group,
    };
  });
}

export function measurementValueMap(measurements = []) {
  return measurements.reduce((values, measurement) => ({
    ...values,
    [measurement.fieldKey || measurement.label]: measurement.valueCm,
  }), {});
}
