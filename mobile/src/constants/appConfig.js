export const subscriptionPlans = {
  free: {
    id: "free",
    label: "Free",
    customerLimit: 10,
    clientRecordLimit: 5,
    draftLimit: 5,
    styleLimit: 10,
    paidFeatures: {
      reminders: false,
      ocrImport: false,
      customShorthand: false,
      customStyleCategories: false,
      styleAttachments: false,
    },
  },
  pro: {
    id: "pro",
    label: "Pro",
    customerLimit: Infinity,
    clientRecordLimit: Infinity,
    draftLimit: Infinity,
    styleLimit: Infinity,
    paidFeatures: {
      reminders: true,
      ocrImport: true,
      customShorthand: true,
      customStyleCategories: true,
      styleAttachments: true,
    },
  },
};

export const styleCategories = [
  "Gown",
  "Blouse",
  "Skirt",
  "Trouser",
  "Native wear",
  "Suit",
  "Agbada",
  "Casual",
  "Bridal",
  "Other",
];

export const selfCaptureSetupSteps = [
  "Place your phone upright on a table.",
  "Support it with books or an open laptop so it stays steady.",
  "Step back slowly until your whole body fits inside the guide.",
  "Wear fitted clothes and stand straight with arms slightly away from the body.",
];

export function getUserPlan(user) {
  return subscriptionPlans[user?.plan === "pro" ? "pro" : "free"];
}

export function getRecordLimit(user) {
  const plan = getUserPlan(user);
  return user?.mode === "client" ? plan.clientRecordLimit : plan.customerLimit;
}

export function canUsePlanFeature(user, featureKey) {
  return Boolean(getUserPlan(user).paidFeatures[featureKey]);
}

export function getUpgradeMessage(featureName) {
  return `${featureName} is a Pro feature. Measurement capture, review, saved records, and sharing stay free.`;
}
