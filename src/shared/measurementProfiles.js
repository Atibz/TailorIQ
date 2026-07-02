export const measurementProfiles = {
  male: {
    label: "Male",
    description: "Complete male measurement sheet for upper garments and trousers.",
    sections: [
      {
        title: "Upper body",
        description: "For shirt, senator top, kaftan top, jacket, or agbada inner top.",
        fields: [
          { key: "neck", label: "Neck", note: "Collar circumference" },
          { key: "chest", label: "Chest", note: "Around the fullest chest" },
          { key: "stomach", label: "Stomach", note: "Around the belly line" },
          { key: "shoulder", label: "Shoulder", note: "Across the back from one shoulder point to the other" },
          { key: "acrossBack", label: "Across back", note: "Back width across shoulder blades" },
          { key: "armhole", label: "Armhole", note: "Around the arm opening" },
          { key: "sleeve", label: "Sleeve length", note: "Shoulder point where sleeve starts to wrist" },
          { key: "bicep", label: "Round sleeve", note: "Around upper arm" },
          { key: "wrist", label: "Cuff / wrist", note: "Around wrist or cuff opening" },
          { key: "topLength", label: "Top length", note: "Shoulder to desired hem" },
        ],
      },
      {
        title: "Trouser",
        description: "For formal trouser, native trouser, chinos, or fitted pants.",
        fields: [
          { key: "waist", label: "Waist", note: "Trouser waistband position" },
          { key: "seat", label: "Seat", note: "Around the fullest hip/seat" },
          { key: "trouserLength", label: "Outseam", note: "Waistband to ankle/hem" },
          { key: "inseam", label: "Inseam", note: "Crotch to ankle/hem" },
          { key: "rise", label: "Rise", note: "Waistband to crotch depth" },
          { key: "thigh", label: "Thigh", note: "Around upper thigh" },
          { key: "knee", label: "Knee", note: "Around knee level" },
          { key: "ankle", label: "Bottom / ankle", note: "Trouser bottom opening" },
        ],
      },
    ],
  },
  female: {
    label: "Female",
    description: "Complete female measurement sheet for upper garments and lower garments.",
    sections: [
      {
        title: "Upper body",
        description: "For blouse, fitted top, bodice, jacket, or gown upper body.",
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
          { key: "topLength", label: "Blouse/top length", note: "Shoulder to desired hem" },
        ],
      },
      {
        title: "Lower body",
        description: "For skirt, wrapper skirt, palazzo, trouser, or gown lower body.",
        fields: [
          { key: "waist", label: "Waist", note: "Natural waist or chosen waistband" },
          { key: "highHip", label: "High hip", note: "Upper hip below waist" },
          { key: "hip", label: "Full hip", note: "Around the fullest hip" },
          { key: "waistToHip", label: "Waist to hip", note: "Vertical drop from waist to full hip" },
          { key: "lowerLength", label: "Skirt/trouser length", note: "Waist to desired hem" },
          { key: "rise", label: "Rise", note: "Waistband to crotch depth for trousers" },
          { key: "inseam", label: "Inseam", note: "Crotch to hem for trousers" },
          { key: "thigh", label: "Thigh", note: "Around upper thigh" },
          { key: "knee", label: "Knee", note: "Around knee level" },
          { key: "ankle", label: "Ankle / hem", note: "Trouser ankle or skirt hem opening" },
        ],
      },
    ],
  },
};

export const profileOptions = Object.entries(measurementProfiles).map(([id, profile]) => ({
  id,
  label: profile.label,
}));

export const getProfileLabel = (profileId) => measurementProfiles[profileId]?.label || "Measurement";
export const getProfile = (profileId) => measurementProfiles[profileId] || measurementProfiles.male;
export const getProfileFields = (profile) =>
  profile.sections.flatMap((section) =>
    section.fields.map((field) => ({
      ...field,
      group: section.title,
    })),
  );
