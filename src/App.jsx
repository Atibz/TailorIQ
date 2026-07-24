import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Form from "./components/Form";
import resultGuideFemale from "./assets/images/result-guide-female-cutout.png";
import resultGuideMale from "./assets/images/result-guide-male-cutout.png";
import { preventNumberInputWheel } from "./components/measurement/constants";
import { requestSegmentationMeasurements } from "./services/segmentationMeasurementApi";
import { getSupabaseConfigError, hasSupabaseConfig, supabase } from "./services/supabaseClient";
import {
  buildBackendMeasurements,
  buildCorrectionLog,
  buildManualMeasurements,
  cmToInches,
  formatLength,
  getHeightCm,
  getScaleHeightCm,
  getScaleSourceLabel,
  processMeasurements,
  roundHalf,
  toCm,
} from "./shared/measurementCalculations";
import { getProfile, getProfileLabel, profileOptions } from "./shared/measurementProfiles";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: "M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-11h6V4h-6v5Z" },
  { id: "customers", label: "Customers", icon: "M16 11c1.66 0 3-1.57 3-3.5S17.66 4 16 4s-3 1.57-3 3.5 1.34 3.5 3 3.5ZM8 11c1.66 0 3-1.57 3-3.5S9.66 4 8 4 5 5.57 5 7.5 6.34 11 8 11Zm8 2c-2.33 0-7 1.21-7 3.6V20h14v-3.4c0-2.39-4.67-3.6-7-3.6ZM8 13c-.29 0-.62.02-.97.06C5.01 13.3 1 14.33 1 16.6V20h6v-3.4c0-1.34.77-2.48 2.01-3.39C8.64 13.08 8.3 13 8 13Z" },
  { id: "new", label: "New measurement", icon: "M5 4h14v2H5V4Zm0 4h14v2H5V8Zm0 4h9v2H5v-2Zm0 4h6v2H5v-2Zm12-4h2v3h3v2h-3v3h-2v-3h-3v-2h3v-3Z" },
  { id: "reminders", label: "Reminders", icon: "M7 2h2v3H7V2Zm8 0h2v3h-2V2ZM5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 6v10h14V10H5Zm3 3h5v2H8v-2Zm0 4h8v2H8v-2Z" },
  { id: "drafts", label: "Drafts", icon: "M5 3h10l4 4v14H5V3Zm9 1.5V8h3.5L14 4.5ZM8 11h8v2H8v-2Zm0 4h8v2H8v-2Z" },
];

const clientNavItems = [
  { id: "dashboard", label: "Home", icon: "M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-11h6V4h-6v5Z" },
  { id: "new", label: "Measure me", icon: "M5 4h14v2H5V4Zm0 4h14v2H5V8Zm0 4h9v2H5v-2Zm0 4h6v2H5v-2Zm12-4h2v3h3v2h-3v3h-2v-3h-3v-2h3v-3Z" },
  { id: "styles", label: "Styles", icon: "M4 5a2 2 0 0 1 2-2h3l3 4h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Zm2 4v10h12V9h-7L8 5H6v4Zm2 2h8v2H8v-2Zm0 4h5v2H8v-2Z" },
  { id: "drafts", label: "Drafts", icon: "M5 3h10l4 4v14H5V3Zm9 1.5V8h3.5L14 4.5ZM8 11h8v2H8v-2Zm0 4h8v2H8v-2Z" },
];

const secondaryNavItems = [
  { id: "profile", label: "Profile", icon: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4Zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4Z" },
  { id: "help", label: "Help", icon: "M11 18h2v-2h-2v2Zm1-16a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm0-14a3 3 0 0 0-3 3h2a1 1 0 1 1 1 1c-1.1 0-2 .9-2 2v2h2v-2c1.1 0 2-.9 2-2a3 3 0 0 0-3-3Z" },
  { id: "privacy", label: "Privacy", icon: "M12 2 4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3Zm0 2.18 6 2.25V11c0 4.1-2.45 8.07-6 9.82C8.45 19.07 6 15.1 6 11V6.43l6-2.25Z" },
  { id: "about", label: "About", icon: "M11 17h2v-6h-2v6Zm0-8h2V7h-2v2Zm1-7a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z" },
];

const resultGuideDefinitions = {
  male: [
    { key: "neck", marker: "circumference", label: "Neck", instruction: "Neck is measured around the base of the neck where the collar sits.", view: "front", type: "horizontal", x1: 43, x2: 57, y: 45 },
    { key: "chest", marker: "circumference", label: "Chest", instruction: "Chest is measured around the fullest chest, with the tape level across the back.", view: "front", type: "horizontal", x1: 29, x2: 71, y: 65 },
    { key: "stomach", marker: "circumference", label: "Stomach", instruction: "Stomach is measured around the belly line, usually slightly above the trouser waist.", view: "front", type: "horizontal", x1: 34, x2: 66, y: 91 },
    { key: "shoulder", marker: "width", label: "Shoulder", instruction: "Shoulder is measured across the back from one shoulder point to the other.", view: "front", type: "horizontal", x1: 28, x2: 72, y: 48 },
    { key: "acrossBack", marker: "width", label: "Across back", instruction: "Across back is measured from arm crease to arm crease across the shoulder blades.", view: "front", type: "horizontal", x1: 31, x2: 69, y: 65 },
    { key: "armhole", label: "Armhole", instruction: "Armhole is measured around the arm opening from shoulder, underarm, and back up.", view: "front", type: "curve", path: "M30 51 C24 58 24 68 30 75", cx: 28, cy: 63 },
    { key: "sleeve", label: "Sleeve length", instruction: "Sleeve length is measured from the shoulder point where the sleeve seam starts down to the wrist.", view: "front", type: "diagonal", x1: 29, y1: 50, x2: 21, y2: 114 },
    { key: "bicep", marker: "circumference", label: "Round sleeve", instruction: "Round sleeve is measured around the fullest part of the upper arm.", view: "front", type: "horizontal", x1: 21, x2: 31, y: 78 },
    { key: "wrist", marker: "circumference", label: "Cuff / wrist", instruction: "Cuff or wrist is measured around the wrist or desired cuff opening.", view: "front", type: "horizontal", x1: 20, x2: 28, y: 117 },
    { key: "topLength", label: "Top length", instruction: "Top length is measured from the shoulder near the neck down to the hip or seat line.", view: "front", type: "vertical", x: 73, y1: 46, y2: 116 },
    { key: "waist", marker: "circumference", label: "Waist", instruction: "Waist is measured around the waistband position where the trouser will sit.", view: "front", type: "horizontal", x1: 33, x2: 67, y: 104 },
    { key: "seat", marker: "circumference", label: "Seat", instruction: "Seat is measured around the fullest part of the hip or seat.", view: "front", type: "horizontal", x1: 31, x2: 69, y: 116 },
    { key: "trouserLength", label: "Outseam", instruction: "Outseam is measured from the trouser waistband down the outside leg to the ankle.", view: "front", type: "vertical", x: 72, y1: 104, y2: 190 },
    { key: "inseam", label: "Inseam", instruction: "Inseam is measured from crotch down the inside leg to the ankle.", view: "front", type: "vertical", x: 50, y1: 117, y2: 190 },
    { key: "rise", label: "Rise", instruction: "Rise is measured from waistband down to crotch depth.", view: "front", type: "vertical", x: 45, y1: 104, y2: 117 },
    { key: "thigh", marker: "circumference", label: "Thigh", instruction: "Thigh is measured around the fullest part of the upper thigh.", view: "front", type: "horizontal", x1: 35, x2: 51, y: 128 },
    { key: "knee", marker: "circumference", label: "Knee", instruction: "Knee is measured around the knee joint.", view: "front", type: "horizontal", x1: 36, x2: 49, y: 156 },
    { key: "ankle", marker: "circumference", label: "Bottom / ankle", instruction: "Bottom or ankle is measured at the trouser bottom opening.", view: "front", type: "horizontal", x1: 36, x2: 47, y: 190 },
  ],
  female: [
    { key: "bust", marker: "circumference", label: "Bust", instruction: "Bust is measured around the fullest bust, with the tape level across the back.", view: "front", type: "horizontal", x1: 32, x2: 68, y: 69 },
    { key: "underbust", marker: "circumference", label: "Underbust", instruction: "Underbust is measured around the ribcage directly below the bust.", view: "front", type: "horizontal", x1: 34, x2: 66, y: 76 },
    { key: "waist", marker: "circumference", label: "Waist", instruction: "Waist is measured around the natural waist, the narrowest part of the torso.", view: "front", type: "horizontal", x1: 36, x2: 64, y: 90 },
    { key: "shoulder", marker: "width", label: "Shoulder", instruction: "Shoulder is measured across the back from one shoulder point to the other.", view: "front", type: "horizontal", x1: 31, x2: 69, y: 49 },
    { key: "bustPoint", label: "Bust point", instruction: "Bust point is measured from shoulder near the neck down to the bust apex.", view: "front", type: "vertical", x: 43, y1: 49, y2: 68 },
    { key: "bustSpan", marker: "width", label: "Bust span", instruction: "Bust span is measured from one bust apex to the other.", view: "front", type: "horizontal", x1: 41, x2: 59, y: 68 },
    { key: "frontLength", label: "Front bodice length", instruction: "Front bodice length is measured from shoulder through bust point down to the waist.", view: "front", type: "vertical", x: 70, y1: 49, y2: 90 },
    { key: "backLength", label: "Back bodice length", instruction: "Back bodice length is measured from back neck down to the natural waist.", view: "front", type: "vertical", x: 33, y1: 47, y2: 90 },
    { key: "armhole", label: "Armhole", instruction: "Armhole is measured around the arm opening from shoulder, underarm, and back up.", view: "front", type: "curve", path: "M32 52 C26 60 26 70 32 77", cx: 30, cy: 65 },
    { key: "sleeve", label: "Sleeve length", instruction: "Sleeve length is measured from the shoulder point where the sleeve seam starts down to the wrist.", view: "front", type: "diagonal", x1: 31, y1: 51, x2: 18, y2: 114 },
    { key: "bicep", marker: "circumference", label: "Round sleeve", instruction: "Round sleeve is measured around the fullest part of the upper arm.", view: "front", type: "horizontal", x1: 20, x2: 31, y: 79 },
    { key: "topLength", label: "Blouse/top length", instruction: "Blouse or top length is measured from shoulder down to the high hip line.", view: "front", type: "vertical", x: 72, y1: 49, y2: 105 },
    { key: "waistLower", marker: "circumference", label: "Waist band", instruction: "Waist band is measured around the chosen skirt, trouser, or gown waistband line, usually just below the navel.", view: "front", type: "horizontal", x1: 35, x2: 65, y: 98 },
    { key: "highHip", marker: "circumference", label: "High hip", instruction: "High hip is measured around the upper hip right below the waistband.", view: "front", type: "horizontal", x1: 34, x2: 66, y: 105 },
    { key: "hip", marker: "circumference", label: "Full hip", instruction: "Full hip is measured around the broadest point of the hip just below the high hip.", view: "front", type: "horizontal", x1: 31, x2: 69, y: 116 },
    { key: "waistToHip", label: "Waist to hip", instruction: "Waist to hip is the vertical drop from the natural waist down to the high hip line.", view: "front", type: "vertical", x: 38, y1: 90, y2: 105 },
    { key: "lowerLength", label: "Skirt/trouser length", instruction: "Skirt or trouser length is measured from the natural waist down to the ankle.", view: "front", type: "vertical", x: 72, y1: 90, y2: 191 },
    { key: "rise", label: "Rise", instruction: "Rise is measured from the natural waist down to crotch depth for trousers.", view: "front", type: "vertical", x: 50, y1: 90, y2: 121 },
    { key: "inseam", label: "Inseam", instruction: "Inseam is measured from crotch down the inside leg to the ankle.", view: "front", type: "vertical", x: 52, y1: 121, y2: 191 },
    { key: "thigh", marker: "circumference", label: "Thigh", instruction: "Thigh is measured around the fullest part of the upper thigh.", view: "front", type: "horizontal", x1: 35, x2: 51, y: 128 },
    { key: "knee", marker: "circumference", label: "Knee", instruction: "Knee is measured around the knee joint.", view: "front", type: "horizontal", x1: 37, x2: 49, y: 156 },
    { key: "ankle", marker: "circumference", label: "Ankle / hem", instruction: "Ankle or hem is measured at the trouser ankle or skirt hem opening.", view: "front", type: "horizontal", x1: 38, x2: 48, y: 191 },
  ],
};

const resultGuideImages = {
  male: resultGuideMale,
  female: resultGuideFemale,
};

const CUSTOMER_STORAGE_KEY = "tailoriq_customers";
const STYLE_LIBRARY_STORAGE_KEY = "tailoriq_style_library";
const REMINDER_STORAGE_KEY = "tailoriq_reminders";
const CLIENT_RESULT_STORAGE_KEY = "tailoriq_client_latest_result";
const SHARED_MEASUREMENT_STORAGE_KEY = "tailoriq_shared_measurements";
const MEASUREMENT_DRAFT_STORAGE_KEY = "tailoriq_measurement_drafts";
const LEGACY_MEASUREMENT_DRAFT_STORAGE_KEY = "tailoriq_measurement_draft";
const APP_MODE_STORAGE_KEY = "tailoriq_app_mode";
const AUTH_USERS_STORAGE_KEY = "tailoriq_auth_users";
const AUTH_SESSION_STORAGE_KEY = "tailoriq_auth_session";
const APP_THEME_STORAGE_KEY = "tailoriq_theme";
const STYLE_IMAGE_BUCKET = "style-images";
const MEASUREMENT_PHOTO_BUCKET = "measurement-photos";

const aboutSections = [
  {
    title: "What TailorIQ does",
    body: "TailorIQ is a guided measurement workspace for creating, reviewing, saving, and sharing body measurements. It supports two ways of working: Tailor Mode for professionals managing customer records, and Client Mode for individuals who want to measure themselves privately and share only the result they choose.",
  },
  {
    title: "Tailor Mode",
    body: "Tailor Mode is built for day-to-day measurement work. A tailor can create photo-assisted measurements, enter manual tape measurements, continue unfinished drafts, review generated values, save customer records, and open previous records when a client returns.",
  },
  {
    title: "Client Mode",
    body: "Client Mode is designed for people who do not want to send raw personal details or photos directly to a tailor. The client can capture guided photos, review the generated measurement sheet, then copy or share the final result. Client drafts and results are kept separate from tailor customer records.",
  },
  {
    title: "Measurement approach",
    body: "The app uses guided front and side photos, known height, posture checks, and review screens to produce draft body measurements. The result is intended to reduce manual effort and improve consistency, but it should still be reviewed before cutting fabric or making final garment decisions.",
  },
  {
    title: "What TailorIQ is not",
    body: "TailorIQ is not a replacement for professional judgment. Clothing type, camera distance, lighting, pose, and body visibility can affect results. The app is best used as a measurement assistant with final review, correction, and fitting decisions made by the user or tailor.",
  },
];

const tailorSecondaryNavItems = [
  { id: "styles", label: "Styles", icon: "M4 5a2 2 0 0 1 2-2h3l3 4h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Zm2 4v10h12V9h-7L8 5H6v4Zm2 2h8v2H8v-2Zm0 4h5v2H8v-2Z" },
  ...secondaryNavItems,
];

const privacySections = [
  {
    title: "Overview",
    body: "TailorIQ handles personal measurement information, so privacy matters. This policy explains what information the app uses, why it is used, and how users should handle measurement records, photos, and shared results.",
  },
  {
    title: "Information you provide",
    items: [
      "Account details such as full name, email address, username, and password for the current local account system.",
      "Customer or client details entered during measurement, such as name, phone number when provided, gender profile, height, and measurement preferences.",
      "Front and side photos captured or uploaded for measurement generation.",
      "Manual measurement values, reviewed measurement values, fit notes, drafts, and saved records.",
    ],
  },
  {
    title: "How the information is used",
    items: [
      "To identify the signed-in user and keep each user's workspace separate.",
      "To generate draft measurements from guided photos.",
      "To let users review, correct, save, continue, delete, copy, or share measurement results.",
      "To keep Client Mode records separate from Tailor Mode customer records.",
      "To improve the reliability of the measurement workflow through review and correction.",
    ],
  },
  {
    title: "Photos and body data",
    body: "Photos are used only for the measurement workflow. Because body photos are sensitive, users should capture them in a private setting, avoid sharing them unless necessary, and only send them to a tailor when they have clearly chosen to include photos.",
  },
  {
    title: "Local storage today",
    body: "In the current development version, account data, drafts, customer records, and shared measurement data are saved on the device/browser being used. This means clearing browser storage, changing devices, or using another browser can remove or hide local data.",
  },
  {
    title: "Cloud storage before public launch",
    body: "Before a public production release, TailorIQ should move records to a secure cloud backend with proper authentication, encrypted transport, access controls, account recovery, and clear deletion/export options. Users should not treat the current local prototype as permanent cloud backup.",
  },
  {
    title: "Sharing measurements",
    body: "When a client shares a result to a tailor username, the client should be able to decide whether photos are included. Measurement values can still reveal personal body information, so they should only be shared with trusted recipients.",
  },
  {
    title: "User responsibilities",
    items: [
      "Get consent before capturing or storing another person's measurements or photos.",
      "Do not share customer records with unauthorized people.",
      "Delete drafts or records that are no longer needed.",
      "Review generated measurements before using them for garment production.",
    ],
  },
  {
    title: "Production policy note",
    body: "This policy is a product draft for the app's current stage. Before launch on App Store, Play Store, or the web, it should be reviewed and adapted to match the final backend, region, data retention rules, and legal requirements.",
  },
];

const helpSections = [
  {
    title: "Getting started",
    items: [
      "Sign up with your name, email, username, and password.",
      "Choose Tailor Mode if you manage customer records.",
      "Choose Client Mode if you only want to measure yourself and share the result.",
      "You can change mode later from the profile area.",
    ],
  },
  {
    title: "Taking good photos",
    items: [
      "Wear fitted clothing so the body outline is visible.",
      "Stand straight with arms slightly away from the body.",
      "Keep the full body in frame from head to feet.",
      "Use a bright, even light source and avoid strong shadows.",
      "Keep the phone steady and avoid tilted camera angles.",
      "Capture one clear front view and one clear side view.",
    ],
  },
  {
    title: "Tailor Mode workflow",
    items: [
      "Start a new measurement and choose photo-assisted or manual input.",
      "Enter customer details and height information.",
      "Follow the guided capture flow for front and side photos.",
      "Review every generated value before saving.",
      "Use drafts when a capture or review is unfinished.",
      "Open Customer Records to view or delete saved customer measurements.",
    ],
  },
  {
    title: "Client Mode workflow",
    items: [
      "Start a new measurement from the client dashboard.",
      "Choose whether you are taking the photos yourself or someone is helping.",
      "Review the photos before analysis.",
      "Review the generated measurement sheet.",
      "Copy the result or share it to a tailor username.",
      "Choose whether photos should be included when sharing.",
    ],
  },
  {
    title: "When to retake photos",
    items: [
      "The head, feet, or side profile is cut off.",
      "The body is too close to the camera.",
      "The person is leaning, twisting, or hiding the waist and sides.",
      "The photo is too dark, blurry, or strongly shadowed.",
      "Loose clothing hides the true body shape.",
    ],
  },
  {
    title: "Understanding generated measurements",
    body: "Generated values are draft measurements. They should remain visible during review so you can compare what the app produced with any corrections you make. The saved final value should be the reviewed value you trust.",
  },
  {
    title: "Drafts and records",
    body: "Drafts are unfinished measurements. Tailor drafts and client drafts are separated, so starting work in one mode will not clutter the other mode. Saved tailor records appear in Customer Records. Client results stay focused on the client's own measurement result.",
  },
  {
    title: "Common fixes",
    items: [
      "If analysis fails, confirm the measurement service URL is configured correctly.",
      "If camera capture does not start, refresh the page and allow camera permission.",
      "If audio guidance does not play on mobile, tap the screen once and try again because some phones block audio until user interaction.",
      "If measurements look wrong, retake photos with better distance, lighting, and posture before manually correcting values.",
    ],
  },
];

function loadStoredAppMode() {
  try {
    const savedMode = window.localStorage.getItem(APP_MODE_STORAGE_KEY);

    return ["tailor", "client"].includes(savedMode) ? savedMode : "";
  } catch {
    return "";
  }
}

function saveStoredAppMode(mode) {
  try {
    if (mode) {
      window.localStorage.setItem(APP_MODE_STORAGE_KEY, mode);
    } else {
      window.localStorage.removeItem(APP_MODE_STORAGE_KEY);
    }
  } catch {
    // Keep the app usable if storage is unavailable.
  }
}

function loadStoredCustomers() {
  try {
    const savedCustomers = window.localStorage.getItem(CUSTOMER_STORAGE_KEY);

    return savedCustomers ? JSON.parse(savedCustomers) : [];
  } catch {
    return [];
  }
}

function saveStoredCustomers(customers) {
  try {
    window.localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(customers));
  } catch {
    // Keep the app usable if storage is unavailable or full.
  }
}

function loadStoredStyles() {
  try {
    const savedStyles = window.localStorage.getItem(STYLE_LIBRARY_STORAGE_KEY);

    return savedStyles ? JSON.parse(savedStyles) : [];
  } catch {
    return [];
  }
}

function saveStoredStyles(styles) {
  try {
    window.localStorage.setItem(STYLE_LIBRARY_STORAGE_KEY, JSON.stringify(styles));
    return true;
  } catch {
    return false;
  }
}

function loadStoredReminders() {
  try {
    const savedReminders = window.localStorage.getItem(REMINDER_STORAGE_KEY);

    return savedReminders ? JSON.parse(savedReminders) : [];
  } catch {
    return [];
  }
}

function saveStoredReminders(reminders) {
  try {
    window.localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(reminders));
    return true;
  } catch {
    return false;
  }
}

function loadStoredClientResult() {
  try {
    const savedResult = window.localStorage.getItem(CLIENT_RESULT_STORAGE_KEY);

    return savedResult ? JSON.parse(savedResult) : null;
  } catch {
    return null;
  }
}

function saveStoredClientResult(result) {
  try {
    if (result) {
      window.localStorage.setItem(CLIENT_RESULT_STORAGE_KEY, JSON.stringify(result));
    } else {
      window.localStorage.removeItem(CLIENT_RESULT_STORAGE_KEY);
    }
  } catch {
    // Keep the app usable if storage is unavailable.
  }
}

function loadStoredUsers() {
  try {
    const savedUsers = window.localStorage.getItem(AUTH_USERS_STORAGE_KEY);

    return savedUsers ? JSON.parse(savedUsers) : [];
  } catch {
    return [];
  }
}

function saveStoredUsers(users) {
  try {
    window.localStorage.setItem(AUTH_USERS_STORAGE_KEY, JSON.stringify(users));
  } catch {
    // Keep the app usable if storage is unavailable.
  }
}

function loadStoredSession() {
  try {
    const savedSession = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);

    return savedSession ? JSON.parse(savedSession) : null;
  } catch {
    return null;
  }
}

function saveStoredSession(session) {
  try {
    if (session) {
      window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    }
  } catch {
    // Keep the app usable if storage is unavailable.
  }
}

function mapProfileToUser(profile, fallbackUser = {}) {
  const username = profile?.username || fallbackUser.user_metadata?.username || "";

  return {
    id: profile?.id || fallbackUser.id,
    fullName: profile?.full_name || fallbackUser.user_metadata?.full_name || fallbackUser.user_metadata?.name || fallbackUser.email || "",
    email: profile?.email || fallbackUser.email || "",
    username,
    mode: profile?.mode || "",
    customShorthand: profile?.custom_shorthand || {},
    needsUsername: !username,
    authProvider: "supabase",
  };
}

function mergeAuthUser(users, nextUser) {
  if (!nextUser?.id && !nextUser?.username) {
    return users;
  }

  const existingUser = users.some((user) => (
    (nextUser.id && user.id === nextUser.id) ||
    (nextUser.username && user.username === nextUser.username)
  ));

  return existingUser
    ? users.map((user) => (
        (nextUser.id && user.id === nextUser.id) ||
        (nextUser.username && user.username === nextUser.username)
          ? { ...user, ...nextUser }
          : user
      ))
    : [nextUser, ...users];
}

async function fetchSupabaseProfile(user) {
  if (!supabase || !user?.id) {
    return mapProfileToUser(null, user);
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return mapProfileToUser(data, user);
}

function stripPhotoDataFromRecord(customer) {
  const {
    photoPreviews,
    photoCensoredPreviews,
    photoSilhouettes,
    segmentationImages,
    referenceImageDataUrl,
    ...safeCustomer
  } = customer || {};

  return safeCustomer;
}

async function getSignedMeasurementPhotoUrl(photoPath) {
  if (!supabase || !photoPath) {
    return "";
  }

  const { data, error } = await supabase
    .storage
    .from(MEASUREMENT_PHOTO_BUCKET)
    .createSignedUrl(photoPath, 60 * 60);

  return error ? "" : data.signedUrl;
}

async function uploadMeasurementPhotoDataUrl(dataUrl, user, mode, viewKey) {
  if (!dataUrl?.startsWith("data:")) {
    return { ok: true, photoPath: "" };
  }

  const extension = getStyleImageExtension(dataUrl);
  const blob = dataUrlToBlob(dataUrl);
  const photoPath = `${user.id}/${mode}/${Date.now()}-${Math.round(Math.random() * 100000)}-${viewKey}.${extension}`;
  const { error } = await supabase
    .storage
    .from(MEASUREMENT_PHOTO_BUCKET)
    .upload(photoPath, blob, {
      contentType: blob.type || "image/jpeg",
      upsert: false,
    });

  return error ? { ok: false, message: error.message } : { ok: true, photoPath };
}

async function uploadMeasurementPhotos(customer, user, mode) {
  if (!supabase || !user?.id) {
    return { ok: false, message: getSupabaseConfigError() };
  }

  const existingPhotoPaths = customer.photoPaths || {};
  const obsoleteCensoredPaths = [
    existingPhotoPaths.censoredFront,
    existingPhotoPaths.censoredSide,
  ].filter(Boolean);
  const photoInputs = {
    front: customer.photoPreviews?.front,
    side: customer.photoPreviews?.side,
  };
  const photoPaths = {
    ...(existingPhotoPaths.front ? { front: existingPhotoPaths.front } : {}),
    ...(existingPhotoPaths.side ? { side: existingPhotoPaths.side } : {}),
  };

  if (obsoleteCensoredPaths.length) {
    await deleteMeasurementPhotoPaths(obsoleteCensoredPaths);
  }

  for (const [viewKey, dataUrl] of Object.entries(photoInputs)) {
    if (!dataUrl?.startsWith("data:")) {
      continue;
    }

    const uploadedPhoto = await uploadMeasurementPhotoDataUrl(dataUrl, user, mode, viewKey);

    if (!uploadedPhoto.ok) {
      return uploadedPhoto;
    }

    photoPaths[viewKey] = uploadedPhoto.photoPath;
  }

  return { ok: true, photoPaths };
}

async function resolveMeasurementPhotoUrls(photoPaths = {}) {
  const entries = await Promise.all(
    Object.entries(photoPaths || {}).map(async ([viewKey, photoPath]) => [
      viewKey,
      await getSignedMeasurementPhotoUrl(photoPath),
    ]),
  );
  const signedUrls = Object.fromEntries(entries.filter(([, signedUrl]) => Boolean(signedUrl)));

  return {
    photoPreviews: {
      ...(signedUrls.front ? { front: signedUrls.front } : {}),
      ...(signedUrls.side ? { side: signedUrls.side } : {}),
    },
    photoCensoredPreviews: {
      ...(signedUrls.censoredFront ? { front: signedUrls.censoredFront } : {}),
      ...(signedUrls.censoredSide ? { side: signedUrls.censoredSide } : {}),
    },
  };
}

async function deleteMeasurementPhotoPaths(photoPaths = {}) {
  const paths = Object.values(photoPaths || {}).filter(Boolean);

  if (!supabase || !paths.length) {
    return;
  }

  await supabase
    .storage
    .from(MEASUREMENT_PHOTO_BUCKET)
    .remove(paths);
}

function getMeasurementValueMap(measurements = []) {
  return measurements.reduce((values, measurement) => ({
    ...values,
    [measurement.fieldKey || measurement.label]: measurement.valueCm,
  }), {});
}

async function mapCloudCustomerRecord(customerRow, measurementRow) {
  const storedRecord = measurementRow?.values?.record || {};
  const measurements = measurementRow?.values?.measurements || storedRecord.measurements || [];
  const photoPaths = measurementRow?.photo_paths || storedRecord.photoPaths || {};
  const photoUrls = await resolveMeasurementPhotoUrls(photoPaths);

  return {
    ...storedRecord,
    id: storedRecord.id || customerRow.id,
    cloudCustomerId: customerRow.id,
    cloudMeasurementId: measurementRow?.id,
    fullname: storedRecord.fullname || customerRow.fullname,
    phone: storedRecord.phone || customerRow.phone || "",
    email: storedRecord.email || customerRow.email || "",
    height: storedRecord.height || customerRow.height_cm || "",
    heightUnit: storedRecord.heightUnit || "cm",
    customerNote: storedRecord.customerNote || customerRow.note || measurementRow?.customer_note || "",
    measurementProfile: storedRecord.measurementProfile || customerRow.measurement_profile || measurementRow?.measurement_profile || "male",
    measurementSource: storedRecord.measurementSource || customerRow.source || measurementRow?.source || "photo",
    appMode: storedRecord.appMode || measurementRow?.mode || "tailor",
    measurements,
    generatedMeasurements: measurementRow?.generated_values?.measurements || storedRecord.generatedMeasurements,
    photoPaths,
    photoPreviews: {
      ...(storedRecord.photoPreviews || {}),
      ...photoUrls.photoPreviews,
    },
    photoCensoredPreviews: {
      ...(storedRecord.photoCensoredPreviews || {}),
      ...photoUrls.photoCensoredPreviews,
    },
    createdAt: storedRecord.createdAt || customerRow.created_at || measurementRow?.created_at,
    updatedAt: storedRecord.updatedAt || measurementRow?.updated_at || customerRow.updated_at,
    cloudSyncedAt: new Date().toISOString(),
  };
}

async function fetchSupabaseTailorRecords(user) {
  if (!supabase || !user?.id) {
    return [];
  }

  const { data: customerRows, error: customerError } = await supabase
    .from("customers")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (customerError) {
    throw customerError;
  }

  if (!customerRows?.length) {
    return [];
  }

  const customerIds = customerRows.map((customer) => customer.id);
  const { data: measurementRows, error: measurementError } = await supabase
    .from("measurements")
    .select("*")
    .eq("user_id", user.id)
    .eq("mode", "tailor")
    .in("customer_id", customerIds)
    .order("updated_at", { ascending: false });

  if (measurementError) {
    throw measurementError;
  }

  const measurementByCustomerId = new Map();
  (measurementRows || []).forEach((measurement) => {
    if (!measurementByCustomerId.has(measurement.customer_id)) {
      measurementByCustomerId.set(measurement.customer_id, measurement);
    }
  });

  return Promise.all(
    customerRows.map((customer) => mapCloudCustomerRecord(customer, measurementByCustomerId.get(customer.id))),
  );
}

function mergeCloudCustomers(localCustomers, cloudCustomers) {
  const cloudKeys = new Set(cloudCustomers.map((customer) => customer.cloudCustomerId || customer.id));
  const localOnlyCustomers = localCustomers.filter((customer) => {
    const key = customer.cloudCustomerId || customer.id;

    return !cloudKeys.has(key);
  });

  return [...cloudCustomers, ...localOnlyCustomers];
}

async function saveSupabaseTailorRecord(customer, user) {
  if (!supabase || !user?.id) {
    return { ok: false, message: getSupabaseConfigError() };
  }

  const now = new Date().toISOString();
  const uploadedPhotos = await uploadMeasurementPhotos(customer, user, "tailor");

  if (!uploadedPhotos.ok) {
    return uploadedPhotos;
  }

  const safeRecord = stripPhotoDataFromRecord({
    ...customer,
    appMode: "tailor",
    photoPaths: uploadedPhotos.photoPaths,
    updatedAt: customer.updatedAt || now,
    createdAt: customer.createdAt || now,
  });
  const customerPayload = {
    user_id: user.id,
    fullname: safeRecord.fullname,
    phone: safeRecord.phone || null,
    email: safeRecord.email || null,
    measurement_profile: safeRecord.measurementProfile || "male",
    height_cm: getHeightCm(safeRecord) || null,
    note: safeRecord.customerNote || null,
    source: safeRecord.measurementSource || "photo",
    updated_at: now,
  };

  const customerQuery = safeRecord.cloudCustomerId
    ? supabase
        .from("customers")
        .update(customerPayload)
        .eq("id", safeRecord.cloudCustomerId)
        .eq("user_id", user.id)
        .select("*")
        .single()
    : supabase
        .from("customers")
        .insert(customerPayload)
        .select("*")
        .single();

  const { data: customerRow, error: customerError } = await customerQuery;

  if (customerError) {
    return { ok: false, message: customerError.message };
  }

  const customerId = customerRow.id;
  const measurementPayload = {
    user_id: user.id,
    customer_id: customerId,
    mode: "tailor",
    measurement_profile: safeRecord.measurementProfile || "male",
    values: {
      measurements: safeRecord.measurements || [],
      measurementValuesCm: getMeasurementValueMap(safeRecord.measurements),
      record: {
        ...safeRecord,
        cloudCustomerId: customerId,
        cloudMeasurementId: safeRecord.cloudMeasurementId,
      },
    },
    generated_values: {
      measurements: safeRecord.generatedMeasurements || [],
      measurementValuesCm: getMeasurementValueMap(safeRecord.generatedMeasurements || []),
    },
    reviewed_values: {
      measurements: safeRecord.measurements || [],
      measurementValuesCm: getMeasurementValueMap(safeRecord.measurements),
      correctionLog: safeRecord.correctionLog || [],
    },
    customer_note: safeRecord.customerNote || null,
    photo_check_notes: safeRecord.segmentationWarnings || [],
    photo_paths: uploadedPhotos.photoPaths,
    source: safeRecord.measurementSource || "photo",
    updated_at: now,
  };

  const measurementQuery = safeRecord.cloudMeasurementId
    ? supabase
        .from("measurements")
        .update(measurementPayload)
        .eq("id", safeRecord.cloudMeasurementId)
        .eq("user_id", user.id)
        .select("*")
        .single()
    : supabase
        .from("measurements")
        .insert(measurementPayload)
        .select("*")
        .single();

  const { data: measurementRow, error: measurementError } = await measurementQuery;

  if (measurementError) {
    return { ok: false, message: measurementError.message };
  }

  return {
    ok: true,
    customer: await mapCloudCustomerRecord(customerRow, measurementRow),
  };
}

async function deleteSupabaseTailorRecord(customer, user) {
  if (!supabase || !user?.id || !customer?.cloudCustomerId) {
    return { ok: true };
  }

  await deleteMeasurementPhotoPaths(customer.photoPaths);

  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("id", customer.cloudCustomerId)
    .eq("user_id", user.id);

  return error ? { ok: false, message: error.message } : { ok: true };
}

async function mapCloudClientMeasurementRow(row) {
  const storedRecord = row.values?.record || {};
  const photoPaths = row.photo_paths || storedRecord.photoPaths || {};
  const photoUrls = await resolveMeasurementPhotoUrls(photoPaths);

  return {
    ...storedRecord,
    id: storedRecord.id || `client-result-${row.id}`,
    cloudMeasurementId: row.id,
    fullname: storedRecord.fullname || row.values?.customerName || "My measurement",
    measurementProfile: storedRecord.measurementProfile || row.measurement_profile || "male",
    measurements: row.values?.measurements || storedRecord.measurements || [],
    generatedMeasurements: row.generated_values?.measurements || storedRecord.generatedMeasurements,
    photoPaths,
    photoPreviews: {
      ...(storedRecord.photoPreviews || {}),
      ...photoUrls.photoPreviews,
    },
    photoCensoredPreviews: {
      ...(storedRecord.photoCensoredPreviews || {}),
      ...photoUrls.photoCensoredPreviews,
    },
    customerNote: storedRecord.customerNote || row.customer_note || "",
    measurementSource: storedRecord.measurementSource || row.source || "reviewed-photo",
    appMode: "client",
    createdAt: storedRecord.createdAt || row.created_at,
    updatedAt: row.updated_at || storedRecord.updatedAt,
    cloudSyncedAt: new Date().toISOString(),
  };
}

async function fetchSupabaseClientResult(user) {
  if (!supabase || !user?.id) {
    return null;
  }

  const { data, error } = await supabase
    .from("measurements")
    .select("*")
    .eq("user_id", user.id)
    .eq("mode", "client")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? await mapCloudClientMeasurementRow(data) : null;
}

async function saveSupabaseClientResult(customer, user) {
  if (!supabase || !user?.id) {
    return { ok: false, message: getSupabaseConfigError() };
  }

  const now = new Date().toISOString();
  const uploadedPhotos = await uploadMeasurementPhotos(customer, user, "client");

  if (!uploadedPhotos.ok) {
    return uploadedPhotos;
  }

  const safeRecord = stripPhotoDataFromRecord({
    ...customer,
    appMode: "client",
    photoPaths: uploadedPhotos.photoPaths,
    updatedAt: customer.updatedAt || now,
    createdAt: customer.createdAt || now,
  });
  const payload = {
    user_id: user.id,
    customer_id: null,
    mode: "client",
    measurement_profile: safeRecord.measurementProfile || "male",
    values: {
      customerName: safeRecord.fullname || "My measurement",
      measurements: safeRecord.measurements || [],
      measurementValuesCm: getMeasurementValueMap(safeRecord.measurements),
      record: safeRecord,
    },
    generated_values: {
      measurements: safeRecord.generatedMeasurements || [],
      measurementValuesCm: getMeasurementValueMap(safeRecord.generatedMeasurements || []),
    },
    reviewed_values: {
      measurements: safeRecord.measurements || [],
      measurementValuesCm: getMeasurementValueMap(safeRecord.measurements),
      correctionLog: safeRecord.correctionLog || [],
    },
    customer_note: safeRecord.customerNote || null,
    photo_check_notes: safeRecord.segmentationWarnings || [],
    photo_paths: uploadedPhotos.photoPaths,
    source: safeRecord.measurementSource || "reviewed-photo",
    updated_at: now,
  };
  const measurementQuery = safeRecord.cloudMeasurementId
    ? supabase
        .from("measurements")
        .update(payload)
        .eq("id", safeRecord.cloudMeasurementId)
        .eq("user_id", user.id)
        .select("*")
        .single()
    : supabase
        .from("measurements")
        .insert(payload)
        .select("*")
        .single();

  const { data, error } = await measurementQuery;

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true, customer: await mapCloudClientMeasurementRow(data) };
}

function loadStoredTheme() {
  try {
    return window.localStorage.getItem(APP_THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function saveStoredTheme(theme) {
  try {
    window.localStorage.setItem(APP_THEME_STORAGE_KEY, theme);
  } catch {
    // Keep the app usable if storage is unavailable.
  }
}

function loadSharedMeasurements() {
  try {
    const savedShares = window.localStorage.getItem(SHARED_MEASUREMENT_STORAGE_KEY);

    return savedShares ? JSON.parse(savedShares) : [];
  } catch {
    return [];
  }
}

function saveSharedMeasurements(shares) {
  try {
    window.localStorage.setItem(SHARED_MEASUREMENT_STORAGE_KEY, JSON.stringify(shares));
  } catch {
    // Keep the app usable if storage is unavailable.
  }
}

function getRecordMode(record) {
  return record?.appMode === "client" ? "client" : "tailor";
}

function getReminderDueDate(reminder) {
  const dueDate = reminder?.dueAt ? new Date(reminder.dueAt) : null;

  return dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : null;
}

function isSameCalendarDay(firstDate, secondDate) {
  return (
    firstDate?.getFullYear() === secondDate?.getFullYear() &&
    firstDate?.getMonth() === secondDate?.getMonth() &&
    firstDate?.getDate() === secondDate?.getDate()
  );
}

function formatReminderDateTime(reminder) {
  const dueDate = getReminderDueDate(reminder);

  if (!dueDate) {
    return "No date set";
  }

  return dueDate.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function playReminderSound() {
  try {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextConstructor) {
      return;
    }

    const audioContext = new AudioContextConstructor();
    const now = audioContext.currentTime;
    const gainNode = audioContext.createGain();
    gainNode.connect(audioContext.destination);
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(0.22, now + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

    [660, 880].forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.18);
      oscillator.connect(gainNode);
      oscillator.start(now + index * 0.18);
      oscillator.stop(now + 0.65 + index * 0.08);
    });

    window.setTimeout(() => {
      audioContext.close?.();
    }, 1000);
  } catch {
    // Some browsers block sound until the user has interacted with the page.
  }
}

function getDraftMode(draft) {
  return draft?.appMode || draft?.reviewCustomer?.appMode || draft?.values?.appMode || "tailor";
}

function normalizeDraft(draft) {
  const appMode = getDraftMode(draft);

  return {
    ...draft,
    appMode,
    id: draft.id || Date.now(),
    createdAt: draft.createdAt || draft.updatedAt || new Date().toISOString(),
    updatedAt: draft.updatedAt || new Date().toISOString(),
  };
}

function loadMeasurementDrafts() {
  try {
    const savedDraft = window.localStorage.getItem(MEASUREMENT_DRAFT_STORAGE_KEY);
    const legacyDraft = window.localStorage.getItem(LEGACY_MEASUREMENT_DRAFT_STORAGE_KEY);

    if (savedDraft) {
      const parsedDraft = JSON.parse(savedDraft);
      return Array.isArray(parsedDraft) ? parsedDraft.map(normalizeDraft) : [normalizeDraft(parsedDraft)];
    }

    return legacyDraft ? [normalizeDraft(JSON.parse(legacyDraft))] : [];
  } catch {
    return [];
  }
}

function saveMeasurementDrafts(drafts) {
  try {
    window.localStorage.setItem(MEASUREMENT_DRAFT_STORAGE_KEY, JSON.stringify(drafts));
    window.localStorage.removeItem(LEGACY_MEASUREMENT_DRAFT_STORAGE_KEY);
    return true;
  } catch {
    // Keep the app usable if storage is unavailable or full.
    return false;
  }
}

function deleteStoredMeasurementDrafts() {
  try {
    window.localStorage.removeItem(MEASUREMENT_DRAFT_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_MEASUREMENT_DRAFT_STORAGE_KEY);
  } catch {
    // Keep the app usable if storage is unavailable.
  }
}

function getDraftCustomerName(draft) {
  return draft?.reviewCustomer?.fullname || draft?.values?.fullname || "Untitled measurement";
}

function mapCloudDraftRow(row) {
  const values = row.values || {};
  const localDraftId = values.localDraftId || row.review_state?.localDraftId || row.review_customer?.draftStorageId || row.id;

  return normalizeDraft({
    id: localDraftId,
    cloudDraftId: row.id,
    appMode: row.mode,
    stage: row.stage,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    values: row.stage === "capture"
      ? values.formValues || values
      : undefined,
    photos: values.photos || {},
    referenceMarker: values.referenceMarker || null,
    captureInputMode: values.captureInputMode || null,
    reviewCustomer: row.review_customer || null,
    reviewState: row.review_state || null,
  });
}

function mergeCloudDrafts(localDrafts, cloudDrafts) {
  const cloudKeys = new Set(cloudDrafts.map((draft) => draft.cloudDraftId || draft.id));
  const localIds = new Set(cloudDrafts.map((draft) => draft.id));
  const localOnlyDrafts = localDrafts.filter((draft) => (
    !cloudKeys.has(draft.cloudDraftId || draft.id) &&
    !localIds.has(draft.id)
  ));

  return [...cloudDrafts, ...localOnlyDrafts];
}

async function fetchSupabaseMeasurementDrafts(user) {
  if (!supabase || !user?.id) {
    return [];
  }

  const { data, error } = await supabase
    .from("measurement_drafts")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map(mapCloudDraftRow);
}

async function saveSupabaseMeasurementDraft(draft, user) {
  if (!supabase || !user?.id || !draft) {
    return { ok: false, message: getSupabaseConfigError() };
  }

  const normalizedDraft = normalizeDraft(draft);
  const now = new Date().toISOString();
  const payload = {
    user_id: user.id,
    mode: getDraftMode(normalizedDraft),
    stage: normalizedDraft.stage || "capture",
    customer_name: getDraftCustomerName(normalizedDraft),
    values: normalizedDraft.stage === "capture"
      ? {
          localDraftId: normalizedDraft.id,
          formValues: normalizedDraft.values || {},
          photos: normalizedDraft.photos || {},
          referenceMarker: normalizedDraft.referenceMarker || null,
          captureInputMode: normalizedDraft.captureInputMode || null,
        }
      : {
          localDraftId: normalizedDraft.id,
        },
    review_customer: normalizedDraft.stage === "review" ? (normalizedDraft.reviewCustomer || {}) : {},
    review_state: normalizedDraft.stage === "review"
      ? {
          ...(normalizedDraft.reviewState || {}),
          localDraftId: normalizedDraft.id,
        }
      : {},
    updated_at: now,
  };

  const draftQuery = normalizedDraft.cloudDraftId
    ? supabase
        .from("measurement_drafts")
        .update(payload)
        .eq("id", normalizedDraft.cloudDraftId)
        .eq("user_id", user.id)
        .select("*")
        .single()
    : supabase
        .from("measurement_drafts")
        .insert(payload)
        .select("*")
        .single();

  const { data, error } = await draftQuery;

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true, draft: mapCloudDraftRow(data) };
}

async function deleteSupabaseMeasurementDraft(draft, user) {
  if (!supabase || !user?.id || !draft?.cloudDraftId) {
    return { ok: true };
  }

  const { error } = await supabase
    .from("measurement_drafts")
    .delete()
    .eq("id", draft.cloudDraftId)
    .eq("user_id", user.id);

  return error ? { ok: false, message: error.message } : { ok: true };
}

function dataUrlToBlob(dataUrl) {
  const [header, data] = dataUrl.split(",");
  const mimeMatch = header.match(/data:([^;]+);base64/);
  const mimeType = mimeMatch?.[1] || "image/jpeg";
  const binary = window.atob(data);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

function getStyleImageExtension(dataUrl) {
  const mimeMatch = dataUrl.match(/^data:image\/([^;]+);base64,/);
  const extension = mimeMatch?.[1] || "jpg";

  return extension === "jpeg" ? "jpg" : extension;
}

async function getSignedStyleImageUrl(imagePath) {
  if (!supabase || !imagePath) {
    return "";
  }

  const { data, error } = await supabase
    .storage
    .from(STYLE_IMAGE_BUCKET)
    .createSignedUrl(imagePath, 60 * 60);

  return error ? "" : data.signedUrl;
}

async function uploadStyleImage(style, user) {
  if (!supabase || !user?.id) {
    return { ok: false, message: getSupabaseConfigError() };
  }

  if (style.imagePath && !style.imageDataUrl?.startsWith("data:")) {
    return { ok: true, imagePath: style.imagePath, previewUrl: style.imageDataUrl || "" };
  }

  if (!style.imageDataUrl?.startsWith("data:")) {
    return { ok: false, message: "Add a style image before saving." };
  }

  const extension = getStyleImageExtension(style.imageDataUrl);
  const imagePath = `${user.id}/${getRecordMode(style)}/${Date.now()}-${Math.round(Math.random() * 100000)}.${extension}`;
  const blob = dataUrlToBlob(style.imageDataUrl);
  const { error } = await supabase
    .storage
    .from(STYLE_IMAGE_BUCKET)
    .upload(imagePath, blob, {
      contentType: blob.type || "image/jpeg",
      upsert: false,
    });

  if (error) {
    return { ok: false, message: error.message };
  }

  const previewUrl = await getSignedStyleImageUrl(imagePath);

  return { ok: true, imagePath, previewUrl };
}

async function mapCloudStyleRow(row, user) {
  const signedUrl = await getSignedStyleImageUrl(row.image_path);

  return {
    id: `style-${row.id}`,
    cloudStyleId: row.id,
    ownerUsername: user?.username,
    appMode: row.mode,
    title: row.title || "",
    category: row.category || "Other",
    notes: row.notes || "",
    tags: "",
    imagePath: row.image_path || "",
    imageDataUrl: signedUrl || row.image_data_url || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mergeCloudStyles(localStyles, cloudStyles) {
  const cloudKeys = new Set(cloudStyles.map((style) => style.cloudStyleId || style.id));
  const localIds = new Set(cloudStyles.map((style) => style.id));
  const localOnlyStyles = localStyles.filter((style) => (
    !cloudKeys.has(style.cloudStyleId || style.id) &&
    !localIds.has(style.id)
  ));

  return [...cloudStyles, ...localOnlyStyles];
}

async function fetchSupabaseStyles(user) {
  if (!supabase || !user?.id) {
    return [];
  }

  const { data, error } = await supabase
    .from("styles")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return Promise.all((data || []).map((style) => mapCloudStyleRow(style, user)));
}

async function saveSupabaseStyle(style, user) {
  if (!supabase || !user?.id) {
    return { ok: false, message: getSupabaseConfigError() };
  }

  const uploadedImage = await uploadStyleImage(style, user);

  if (!uploadedImage.ok) {
    return uploadedImage;
  }

  const now = new Date().toISOString();
  const payload = {
    user_id: user.id,
    mode: getRecordMode(style),
    title: style.title || null,
    category: style.category || "Other",
    notes: style.notes || null,
    image_path: uploadedImage.imagePath,
    image_data_url: null,
    updated_at: now,
  };
  const styleQuery = style.cloudStyleId
    ? supabase
        .from("styles")
        .update(payload)
        .eq("id", style.cloudStyleId)
        .eq("user_id", user.id)
        .select("*")
        .single()
    : supabase
        .from("styles")
        .insert(payload)
        .select("*")
        .single();

  const { data, error } = await styleQuery;

  if (error) {
    return { ok: false, message: error.message };
  }

  const savedStyle = await mapCloudStyleRow(data, user);

  return {
    ok: true,
    style: {
      ...savedStyle,
      imageDataUrl: uploadedImage.previewUrl || savedStyle.imageDataUrl,
    },
  };
}

async function deleteSupabaseStyle(style, user) {
  if (!supabase || !user?.id || !style?.cloudStyleId) {
    return { ok: true };
  }

  if (style.imagePath) {
    await supabase
      .storage
      .from(STYLE_IMAGE_BUCKET)
      .remove([style.imagePath]);
  }

  const { error } = await supabase
    .from("styles")
    .delete()
    .eq("id", style.cloudStyleId)
    .eq("user_id", user.id);

  return error ? { ok: false, message: error.message } : { ok: true };
}

function mapCloudReminderRow(row, user) {
  const dueDate = row.due_date || "";
  const dueTime = row.due_time ? String(row.due_time).slice(0, 5) : "09:00";

  return {
    id: `reminder-${row.id}`,
    cloudReminderId: row.id,
    ownerUsername: user?.username,
    appMode: "tailor",
    customerId: row.customer_id || "",
    cloudCustomerId: row.customer_id || "",
    customerName: row.customer_name || "",
    type: row.type || "Other",
    title: row.title || "",
    dueAt: dueDate ? new Date(`${dueDate}T${dueTime}`).toISOString() : "",
    note: row.note || "",
    status: row.status || "open",
    alertedAt: row.alerted_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mergeCloudReminders(localReminders, cloudReminders) {
  const cloudKeys = new Set(cloudReminders.map((reminder) => reminder.cloudReminderId || reminder.id));
  const localIds = new Set(cloudReminders.map((reminder) => reminder.id));
  const localOnlyReminders = localReminders.filter((reminder) => (
    !cloudKeys.has(reminder.cloudReminderId || reminder.id) &&
    !localIds.has(reminder.id)
  ));

  return [...cloudReminders, ...localOnlyReminders];
}

async function fetchSupabaseReminders(user) {
  if (!supabase || !user?.id) {
    return [];
  }

  const { data, error } = await supabase
    .from("reminders")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map((reminder) => mapCloudReminderRow(reminder, user));
}

function getReminderPayload(reminder, user) {
  const dueDate = reminder.dueAt ? new Date(reminder.dueAt) : null;

  return {
    user_id: user.id,
    customer_id: reminder.cloudCustomerId || null,
    customer_name: reminder.customerName || null,
    title: reminder.title || null,
    type: reminder.type || "Other",
    note: reminder.note || null,
    due_date: dueDate ? toDateInputValue(dueDate) : toDateInputValue(new Date()),
    due_time: dueDate ? toTimeInputValue(dueDate) : null,
    status: reminder.status || "open",
    alerted_at: reminder.alertedAt || null,
    updated_at: new Date().toISOString(),
  };
}

async function saveSupabaseReminder(reminder, user) {
  if (!supabase || !user?.id) {
    return { ok: false, message: getSupabaseConfigError() };
  }

  const payload = getReminderPayload(reminder, user);
  const reminderQuery = reminder.cloudReminderId
    ? supabase
        .from("reminders")
        .update(payload)
        .eq("id", reminder.cloudReminderId)
        .eq("user_id", user.id)
        .select("*")
        .single()
    : supabase
        .from("reminders")
        .insert(payload)
        .select("*")
        .single();

  const { data, error } = await reminderQuery;

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true, reminder: mapCloudReminderRow(data, user) };
}

async function deleteSupabaseReminder(reminder, user) {
  if (!supabase || !user?.id || !reminder?.cloudReminderId) {
    return { ok: true };
  }

  const { error } = await supabase
    .from("reminders")
    .delete()
    .eq("id", reminder.cloudReminderId)
    .eq("user_id", user.id);

  return error ? { ok: false, message: error.message } : { ok: true };
}

async function mapCloudSharedMeasurementRow(row, user) {
  const measurementData = row.measurement_data || {};
  const photoData = row.photo_data || {};
  const isReceived = row.receiver_user_id === user?.id;
  const photoPaths = row.include_photos
    ? photoData.photoPaths || measurementData.customer?.photoPaths || {}
    : {};
  const photoUrls = row.include_photos ? await resolveMeasurementPhotoUrls(photoPaths) : {};

  return {
    id: `share-${row.id}`,
    cloudShareId: row.id,
    senderUserId: row.sender_user_id,
    receiverUserId: row.receiver_user_id,
    senderUsername: row.sender_username || "",
    tailorUsername: row.receiver_username,
    includePhotos: Boolean(row.include_photos),
    customer: {
      ...(measurementData.customer || {}),
      photoPaths: row.include_photos ? photoPaths : undefined,
      photoPreviews: row.include_photos
        ? {
            ...(photoData.photoPreviews || {}),
            ...(photoUrls.photoPreviews || {}),
          }
        : undefined,
      photoCensoredPreviews: row.include_photos
        ? {
            ...(photoData.photoCensoredPreviews || {}),
            ...(photoUrls.photoCensoredPreviews || {}),
          }
        : undefined,
      photoViews: row.include_photos ? measurementData.customer?.photoViews : undefined,
    },
    status: row.status || "sent",
    isReceived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mergeCloudSharedMeasurements(localShares, cloudShares) {
  const cloudKeys = new Set(cloudShares.map((share) => share.cloudShareId || share.id));
  const localIds = new Set(cloudShares.map((share) => share.id));
  const localOnlyShares = localShares.filter((share) => (
    !cloudKeys.has(share.cloudShareId || share.id) &&
    !localIds.has(share.id)
  ));

  return [...cloudShares, ...localOnlyShares];
}

async function fetchSupabaseSharedMeasurements(user) {
  if (!supabase || !user?.id) {
    return [];
  }

  const { data: sentShares, error: sentError } = await supabase
    .from("shared_measurements")
    .select("*")
    .eq("sender_user_id", user.id)
    .order("created_at", { ascending: false });

  if (sentError) {
    throw sentError;
  }

  const { data: receivedShares, error: receivedError } = await supabase
    .from("shared_measurements")
    .select("*")
    .eq("receiver_user_id", user.id)
    .order("created_at", { ascending: false });

  if (receivedError) {
    throw receivedError;
  }

  const sharesById = new Map();

  [...(sentShares || []), ...(receivedShares || [])].forEach((share) => {
    sharesById.set(share.id, share);
  });

  const sortedShares = [...sharesById.values()]
    .sort((firstShare, secondShare) => new Date(secondShare.created_at) - new Date(firstShare.created_at))
  return Promise.all(sortedShares.map((share) => mapCloudSharedMeasurementRow(share, user)));
}

async function saveSupabaseSharedMeasurement({ tailorUsername, includePhotos, customer }, user) {
  if (!supabase || !user?.id) {
    return { ok: false, message: getSupabaseConfigError() };
  }

  const username = tailorUsername.trim().replace(/^@/, "").toLowerCase();
  const { data: receiverProfiles, error: profileError } = await supabase
    .rpc("get_profile_by_username", { login_username: username });

  if (profileError) {
    return { ok: false, message: profileError.message };
  }

  const receiverProfile = Array.isArray(receiverProfiles) ? receiverProfiles[0] : receiverProfiles;

  if (!receiverProfile?.id) {
    return { ok: false, message: `No tailor found with username @${username}.` };
  }

  if (receiverProfile.id === user.id) {
    return { ok: false, message: "You cannot share a measurement to yourself." };
  }

  const uploadedPhotos = includePhotos
    ? await uploadMeasurementPhotos(customer, user, "shared")
    : { ok: true, photoPaths: {} };

  if (!uploadedPhotos.ok) {
    return uploadedPhotos;
  }

  const customerToShare = stripPhotoDataFromRecord({
    ...customer,
    photoPaths: includePhotos ? uploadedPhotos.photoPaths : undefined,
  });
  const photoData = includePhotos ? { photoPaths: uploadedPhotos.photoPaths } : {};
  const payload = {
    sender_user_id: user.id,
    receiver_user_id: receiverProfile.id,
    receiver_username: username,
    sender_username: user.username || "",
    include_photos: Boolean(includePhotos),
    customer_name: customer.fullname || "",
    measurement_profile: customer.measurementProfile || "male",
    measurement_data: {
      customer: customerToShare,
      measurements: customer.measurements || [],
      sharedText: buildShareText(customer),
    },
    photo_data: photoData,
    status: "sent",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("shared_measurements")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true, share: await mapCloudSharedMeasurementRow(data, user) };
}

function getPhotoConfidence(customer) {
  if (customer.measurementSource === "manual") {
    return {
      score: 100,
      label: "Manual input",
      note: "These measurements were entered manually and were not generated from photos.",
    };
  }

  const uploadedViews = customer.photoViews?.filter((photo) => photo.fileName).length || 0;
  const captureScore = Number(customer.captureQuality || 0);
  const score = Math.min(100, 45 + uploadedViews * 18 + captureScore * 4);

  if (score >= 85) {
    return { score, label: "High confidence", note: "Front and side photos include a clear size reference." };
  }

  if (score >= 68) {
    return { score, label: "Good confidence", note: "Photos look usable, but a clearer size reference helps." };
  }

  return { score, label: "Draft estimate", note: "Use as a starting point and confirm during fitting." };
}

function getConfidenceBadgeClass(confidenceLabel) {
  if (confidenceLabel === "High confidence") {
    return "border border-stone-950 bg-stone-950 text-white";
  }

  if (confidenceLabel === "Good confidence") {
    return "border border-stone-300 bg-white text-stone-700";
  }

  return "border border-stone-300 bg-stone-100 text-stone-700";
}

function TailorIQMark({ className = "h-14 w-14" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 128 128" className={className}>
      <defs>
        <linearGradient id="tailoriq-phone-gradient" x1="24" x2="104" y1="10" y2="118" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff9f00" />
          <stop offset="1" stopColor="#c95a00" />
        </linearGradient>
        <linearGradient id="tailoriq-tape-gradient" x1="12" x2="118" y1="72" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff9f00" />
          <stop offset="1" stopColor="#ff9f00" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="28" fill="#07101d" />
      <rect x="34" y="14" width="60" height="92" rx="13" fill="none" stroke="url(#tailoriq-phone-gradient)" strokeWidth="6" />
      <path d="M55 17h18a5 5 0 0 1-5 5h-8a5 5 0 0 1-5-5Z" fill="#07101d" stroke="url(#tailoriq-phone-gradient)" strokeWidth="4" />
      <path d="M64 30a8 8 0 0 1 8 8c0 4-2 7-5 8v7h7c6 0 11 5 11 11v17H43V64c0-6 5-11 11-11h7v-7c-3-1-5-4-5-8a8 8 0 0 1 8-8Z" fill="#f7fbff" />
      <path d="M55 82h18l3 18H52l3-18Z" fill="#f7fbff" />
      <path d="M43 65h42M48 80h32M58 82v18M70 82v18" fill="none" stroke="#ff9f00" strokeWidth="3" strokeDasharray="7 5" strokeLinecap="round" />
      <path d="M91 70c17 4 27 12 28 22 1 9-7 17-21 22" fill="none" stroke="url(#tailoriq-tape-gradient)" strokeWidth="13" strokeLinecap="round" opacity=".95" />
      <path d="M91 70c17 4 27 12 28 22 1 9-7 17-21 22" fill="none" stroke="#07101d" strokeWidth="2" strokeDasharray="2 8" strokeLinecap="round" opacity=".75" />
      <path d="M18 86c20 18 73 22 100 2" fill="none" stroke="url(#tailoriq-tape-gradient)" strokeWidth="15" strokeLinecap="round" />
      <path d="M22 86c18 15 66 18 91 2" fill="none" stroke="#07101d" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" opacity=".75" />
      <g stroke="#07101d" strokeWidth="2" strokeLinecap="round" opacity=".8">
        <path d="M32 92v7" />
        <path d="M42 95v6" />
        <path d="M52 97v7" />
        <path d="M62 98v6" />
        <path d="M72 98v7" />
        <path d="M82 97v6" />
        <path d="M92 95v7" />
        <path d="M102 92v6" />
      </g>
    </svg>
  );
}

function TailorIQWordmark({ compact = false, light = false, large = false }) {
  const markClass = compact ? "h-10 w-10 shrink-0" : large ? "h-24 w-24 shrink-0" : "h-14 w-14 shrink-0";
  const brandTextClass = compact ? "text-xl" : large ? "text-6xl" : "text-3xl";
  const taglineClass = large ? "mt-3 text-sm tracking-[0.42em]" : "mt-1 text-xs tracking-[0.32em]";

  return (
    <div className={`flex items-center ${large ? "gap-5" : "gap-3"}`}>
      <TailorIQMark className={markClass} />
      <div>
        <p className={`${brandTextClass} font-bold tracking-tight ${light ? "text-white" : "text-stone-950"}`}>
          Tailor<span className="text-[#ff9f00]">IQ</span>
        </p>
        {!compact && (
          <p className={`${taglineClass} font-semibold uppercase ${light ? "text-white/65" : "text-stone-500"}`}>
            Measure smart. Fit perfect.
          </p>
        )}
      </div>
    </div>
  );
}

function ThemeSwitch({ theme, onToggle, compact = false }) {
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-2 rounded-full border transition ${
        compact ? "min-h-10 px-3 text-xs" : "min-h-11 px-4 text-sm"
      } ${
        isDark
          ? "border-[#ff9f00]/40 bg-[#2a2412] text-[#ffd37a]"
          : "border-[#ff9f00]/50 bg-[#fff8e1] text-[#111111]"
      }`}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      <span className={`relative h-5 w-9 rounded-full ${isDark ? "bg-[#ff9f00]" : "bg-[#111111]"}`}>
        <span
          className={`absolute top-1 h-3 w-3 rounded-full bg-white transition ${
            isDark ? "left-5" : "left-1"
          }`}
        />
      </span>
      {isDark ? "Dark" : "Light"}
    </button>
  );
}

function BackButton({ onClick, label = "Back" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-stone-300 bg-white text-stone-700 transition hover:bg-stone-50"
      aria-label={label}
      title={label}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.42-1.41L7.83 13H20v-2Z" />
      </svg>
    </button>
  );
}

function ConfirmDeleteModal({ action, onCancel, onConfirm }) {
  if (!action) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 px-4 py-6">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-700">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M12 2 1 21h22L12 2Zm1 16h-2v-2h2v2Zm0-4h-2V9h2v5Z" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-semibold text-stone-950">{action.title}</p>
            <p className="mt-2 text-sm text-stone-600">{action.message}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-11 rounded-md bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function ReminderAlertModal({ reminder, onClose, onMarkDone, onOpenReminders, onSnooze }) {
  if (!reminder) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-stone-950/60 px-4 py-6 sm:items-center sm:justify-center">
      <div className="w-full max-w-md rounded-xl border border-amber-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Reminder due</p>
            <h2 className="mt-2 text-2xl font-semibold text-stone-950">
              {reminder.title || reminder.type}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-stone-200 text-stone-600 transition hover:bg-stone-100"
            aria-label="Close reminder alert"
          >
            x
          </button>
        </div>

        <div className="mt-4 rounded-lg bg-amber-50 p-4">
          <p className="text-sm font-semibold text-stone-950">
            {reminder.customerName || "No customer linked"}
          </p>
          <p className="mt-1 text-sm text-amber-900">{formatReminderDateTime(reminder)}</p>
          {reminder.note && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-700">{reminder.note}</p>}
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onMarkDone}
            className="min-h-11 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Mark done
          </button>
          <button
            type="button"
            onClick={onSnooze}
            className="min-h-11 rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-800 transition hover:bg-stone-50"
          >
            Snooze 10 min
          </button>
          <button
            type="button"
            onClick={onOpenReminders}
            className="tiq-primary-action min-h-11 rounded-md px-4 text-sm font-semibold transition sm:col-span-2"
          >
            Open reminders
          </button>
        </div>
      </div>
    </div>
  );
}

function AuthPage({ onGoogleLogin, onLogin, onSignup }) {
  const [authMode, setAuthMode] = useState("login");
  const [authPanelOpen, setAuthPanelOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [formValues, setFormValues] = useState({
    fullName: "",
    email: "",
    username: "",
    password: "",
  });
  const [authError, setAuthError] = useState("");

  const isSignup = authMode === "signup";
  const handleChange = (event) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      [event.target.name]: event.target.value,
    }));
    setAuthError("");
  };
  const handleSubmit = async (event) => {
    event.preventDefault();
    const email = formValues.email.trim().toLowerCase();
    const username = formValues.username.trim().replace(/^@/, "").toLowerCase();
    const identifier = username;
    const password = formValues.password;

    if ((!identifier && !isSignup) || !password || (isSignup && (!formValues.fullName.trim() || !email || !username))) {
      setAuthError(isSignup ? "Enter your name, email, username, and password." : "Enter your email and password.");
      return;
    }

    setAuthLoading(true);
    const result = isSignup
      ? await onSignup({ fullName: formValues.fullName.trim(), email, username, password })
      : await onLogin({ identifier, password });
    setAuthLoading(false);

    if (!result.ok) {
      setAuthError(result.message);
      return;
    }

    setFormValues({ fullName: "", email: "", username: "", password: "" });
  };

  const handleGoogleClick = async () => {
    setAuthError("");
    setAuthLoading(true);
    const result = await onGoogleLogin();
    setAuthLoading(false);

    if (!result.ok) {
      setAuthError(result.message);
    }
  };

  return (
    <main className="tiq-auth-page flex min-h-screen items-center justify-center px-4 py-8 text-stone-900 sm:px-6">
      <section className="-mx-4 -my-8 w-[calc(100%+2rem)] sm:-mx-6 sm:w-[calc(100%+3rem)] md:hidden">
        {!authPanelOpen ? (
          <div className="tiq-mobile-auth-card flex min-h-screen flex-col items-center justify-center gap-10 overflow-hidden px-5 py-8">
            <div className="w-full max-w-xs">
              <TailorIQWordmark />
            </div>
            <div className="mt-12 grid w-full max-w-xs gap-3">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("signup");
                  setAuthPanelOpen(true);
                  setAuthError("");
                  setShowPassword(false);
                }}
                className="min-h-12 rounded-full bg-white px-5 text-sm font-bold text-[#111111] shadow-sm transition hover:bg-stone-100"
              >
                Sign up
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setAuthPanelOpen(true);
                  setAuthError("");
                  setShowPassword(false);
                }}
                className="min-h-12 rounded-full bg-[#111111] px-5 text-sm font-bold text-[#ff9f00] shadow-sm transition hover:bg-black"
              >
                Login
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="overflow-hidden rounded-[1.75rem] bg-white shadow-2xl"
          >
            <div className="tiq-mobile-auth-card relative min-h-40 px-5 py-5">
              <button
                type="button"
                onClick={() => {
                  setAuthPanelOpen(false);
                  setAuthError("");
                }}
                className="grid h-9 w-9 place-items-center rounded-full border border-stone-200 bg-white text-[#111111] shadow-sm"
                aria-label="Back to auth options"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                  <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.42-1.41L7.83 13H20v-2Z" />
                </svg>
              </button>
              <div className="mt-7 text-center">
                <p className="text-2xl font-semibold text-stone-950">
                  {isSignup ? "Register" : "Welcome back"}
                </p>
                <p className="mt-1 text-xs font-semibold text-stone-700">
                  {isSignup ? "Create your new account" : "Login to your account"}
                </p>
              </div>
            </div>

            <div className="-mt-8 rounded-t-[2rem] bg-white px-5 pb-5 pt-10">
              <div className="grid grid-cols-2 rounded-full bg-stone-100 p-1">
                {[
                  { id: "login", label: "Login" },
                  { id: "signup", label: "Sign up" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setAuthMode(item.id);
                      setAuthError("");
                      setShowPassword(false);
                    }}
                    className={`min-h-10 rounded-full text-sm font-semibold transition ${
                      authMode === item.id ? "bg-[#111111] text-[#ff9f00] shadow-sm" : "text-stone-600 hover:bg-white"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="mt-5 grid gap-3">
                {isSignup && (
                  <>
                    <label className="text-sm font-semibold text-stone-800">
                      Full name
                      <input
                        type="text"
                        name="fullName"
                        value={formValues.fullName}
                        onChange={handleChange}
                        className="mt-2 min-h-11 w-full rounded-full border border-stone-200 bg-stone-100 px-4 text-sm font-medium outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
                        placeholder="Your name"
                      />
                    </label>
                    <label className="text-sm font-semibold text-stone-800">
                      Email
                      <input
                        type="email"
                        name="email"
                        value={formValues.email}
                        onChange={handleChange}
                        className="mt-2 min-h-11 w-full rounded-full border border-stone-200 bg-stone-100 px-4 text-sm font-medium outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
                        placeholder="you@example.com"
                        autoCapitalize="none"
                      />
                    </label>
                  </>
                )}
                <label className="text-sm font-semibold text-stone-800">
                  {isSignup ? "Username" : "Email / Username"}
                  <input
                    type="text"
                    name="username"
                    value={formValues.username}
                    onChange={handleChange}
                    className="mt-2 min-h-11 w-full rounded-full border border-stone-200 bg-stone-100 px-4 text-sm font-medium outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
                    placeholder={isSignup ? "tailor_username" : "email or username"}
                    autoCapitalize="none"
                  />
                </label>
                <label className="text-sm font-semibold text-stone-800">
                  Password
                  <span className="relative mt-2 block">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formValues.password}
                      onChange={handleChange}
                      className="min-h-11 w-full rounded-full border border-stone-200 bg-stone-100 px-4 pr-12 text-sm font-medium outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
                      placeholder="Password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((currentValue) => !currentValue)}
                      className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-stone-500 transition hover:bg-white hover:text-stone-950"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                        {showPassword ? (
                          <path d="m2.39 1.73 19.88 19.88-1.41 1.41-3.18-3.18A11.86 11.86 0 0 1 12 21C5 21 1 12 1 12a20.8 20.8 0 0 1 5.2-6.62L.98 1.14l1.41-1.41Zm7.07 7.07a3 3 0 0 0 4.24 4.24L9.46 8.8ZM12 3c7 0 11 9 11 9a20.87 20.87 0 0 1-3.39 4.86l-2.84-2.84A5 5 0 0 0 9.98 7.23L7.82 5.07A11.83 11.83 0 0 1 12 3Z" />
                        ) : (
                          <path d="M12 5c7 0 11 7 11 7s-4 7-11 7S1 12 1 12s4-7 11-7Zm0 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-2.2a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6Z" />
                        )}
                      </svg>
                    </button>
                  </span>
                </label>
              </div>

              {authError && (
                <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                  {authError}
                </div>
              )}

              <button
                type="button"
                onClick={handleGoogleClick}
                disabled={authLoading}
                className="mt-4 flex min-h-11 w-full items-center justify-center gap-3 rounded-full border border-stone-200 bg-white px-5 text-sm font-bold text-stone-800 shadow-sm transition hover:bg-stone-50"
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-base font-black text-[#4285F4]">G</span>
                Continue with Google
              </button>

              {isSignup && (
                <p className="mt-4 text-center text-xs leading-5 text-stone-500">
                  By signing up, you agree to TailorIQ's{" "}
                  <button
                    type="button"
                    onClick={() => setPrivacyOpen(true)}
                    className="font-bold text-stone-950 underline decoration-amber-500 underline-offset-4"
                  >
                    privacy policy
                  </button>
                  .
                </p>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className={`${isSignup ? "mt-4" : "mt-7"} min-h-12 w-full rounded-full bg-[#111111] px-5 text-sm font-bold text-[#ff9f00] transition hover:bg-black`}
              >
                {authLoading ? "Please wait..." : isSignup ? "Sign up" : "Login"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode(isSignup ? "login" : "signup");
                  setAuthError("");
                  setShowPassword(false);
                }}
                className="mt-3 w-full text-center text-xs font-semibold text-stone-500"
              >
                {isSignup ? "Already have an account? Login" : "Don't have an account? Sign up"}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="mx-auto hidden min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 md:grid lg:grid-cols-[1fr_0.9fr]">
        <div className="tiq-auth-hero flex min-h-[28rem] items-center justify-center">
          <TailorIQWordmark large />
        </div>

        <form onSubmit={handleSubmit} className="tiq-auth-card rounded-xl border p-5 shadow-xl sm:p-6">
          <div className="grid grid-cols-2 rounded-lg bg-stone-100 p-1">
            {[
              { id: "login", label: "Login" },
              { id: "signup", label: "Sign up" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setAuthMode(item.id);
                  setAuthError("");
                  setShowPassword(false);
                }}
                className={`min-h-10 rounded-md text-sm font-semibold transition ${
                  authMode === item.id ? "tiq-primary-action shadow-sm" : "text-stone-600 hover:bg-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-5">
            <p className="text-xl font-semibold text-stone-950">
              {isSignup ? "Create your account" : "Welcome back"}
            </p>
            <p className="mt-1 text-sm text-stone-500">
              {isSignup ? "Choose a username people can use to share measurements with you." : "Use your email or username to continue."}
            </p>
          </div>

          <div className="mt-5 grid gap-4">
            {isSignup && (
              <>
                <label className="text-sm font-semibold text-stone-800">
                  Full name
                  <input
                    type="text"
                    name="fullName"
                    value={formValues.fullName}
                    onChange={handleChange}
                    className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm font-medium outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
                    placeholder="Your name"
                  />
                </label>
                <label className="text-sm font-semibold text-stone-800">
                  Email
                  <input
                    type="email"
                    name="email"
                    value={formValues.email}
                    onChange={handleChange}
                    className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm font-medium outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
                    placeholder="you@example.com"
                    autoCapitalize="none"
                  />
                </label>
              </>
            )}
            <label className="text-sm font-semibold text-stone-800">
              {isSignup ? "Username" : "Email / Username"}
              <input
                type="text"
                name="username"
                value={formValues.username}
                onChange={handleChange}
                className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm font-medium outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
                placeholder={isSignup ? "tailor_username" : "email or username"}
                autoCapitalize="none"
              />
            </label>
            <label className="text-sm font-semibold text-stone-800">
              Password
              <span className="relative mt-2 block">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formValues.password}
                  onChange={handleChange}
                  className="min-h-11 w-full rounded-md border border-stone-300 px-3 pr-14 text-sm font-medium outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
                  placeholder="Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((currentValue) => !currentValue)}
                  className="absolute right-2 top-1/2 min-h-8 -translate-y-1/2 rounded-md px-2 text-xs font-bold text-stone-500 transition hover:bg-stone-100 hover:text-stone-950"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                    {showPassword ? (
                      <path d="m2.39 1.73 19.88 19.88-1.41 1.41-3.18-3.18A11.86 11.86 0 0 1 12 21C5 21 1 12 1 12a20.8 20.8 0 0 1 5.2-6.62L.98 1.14l1.41-1.41Zm7.07 7.07a3 3 0 0 0 4.24 4.24L9.46 8.8ZM12 3c7 0 11 9 11 9a20.87 20.87 0 0 1-3.39 4.86l-2.84-2.84A5 5 0 0 0 9.98 7.23L7.82 5.07A11.83 11.83 0 0 1 12 3Z" />
                    ) : (
                      <path d="M12 5c7 0 11 7 11 7s-4 7-11 7S1 12 1 12s4-7 11-7Zm0 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-2.2a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6Z" />
                    )}
                  </svg>
                </button>
              </span>
            </label>
          </div>

          {authError && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {authError}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleClick}
            disabled={authLoading}
            className="mt-4 flex min-h-11 w-full items-center justify-center gap-3 rounded-md border border-stone-300 bg-white px-5 text-sm font-bold text-stone-800 transition hover:bg-stone-50"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-base font-black text-[#4285F4]">G</span>
            Continue with Google
          </button>

          {isSignup && (
            <p className="mt-4 text-xs leading-5 text-stone-500">
              By creating an account, you agree to TailorIQ's{" "}
              <button
                type="button"
                onClick={() => setPrivacyOpen(true)}
                className="font-bold text-stone-950 underline decoration-amber-500 underline-offset-4"
              >
                privacy policy
              </button>
              .
            </p>
          )}

          <button
            type="submit"
            disabled={authLoading}
            className="tiq-primary-action mt-5 min-h-11 w-full rounded-md px-5 text-sm font-semibold transition"
          >
            {authLoading ? "Please wait..." : isSignup ? "Create account" : "Login"}
          </button>

          <p className="mt-4 text-xs leading-5 text-stone-500">
            Accounts are saved on this device for now. Online backup will be added before public release.
          </p>
        </form>
      </section>

      {privacyOpen && (
        <div className="fixed inset-0 z-[90] flex h-[100dvh] flex-col bg-[#fff8e1] text-[#111111] sm:bg-black/60 sm:p-6">
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#fffdf7] shadow-2xl sm:mx-auto sm:max-h-[88vh] sm:w-full sm:max-w-3xl sm:rounded-xl">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#e7d8b6] bg-[#fffdf7] p-5 sm:p-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#9a4f00]">Privacy</p>
                <h2 className="mt-1 text-2xl font-semibold text-[#111111]">TailorIQ privacy policy</h2>
              </div>
              <button
                type="button"
                onClick={() => setPrivacyOpen(false)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#d8c493] bg-white text-[#111111] transition hover:bg-[#fff4d6]"
                aria-label="Close privacy policy"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                  <path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z" />
                </svg>
              </button>
            </div>

            <div className="grid flex-1 gap-4 overflow-y-auto bg-[#fff8e1] p-5 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:p-6">
              {privacySections.map((section) => (
                <div key={section.title} className="rounded-lg border border-[#e7d8b6] bg-white p-4">
                  <h3 className="text-sm font-bold text-[#111111]">{section.title}</h3>
                  {section.body && <p className="mt-2 text-sm leading-6 text-[#4f4638]">{section.body}</p>}
                  {section.items && (
                    <ul className="mt-2 grid gap-2 text-sm leading-6 text-[#4f4638]">
                      {section.items.map((item) => (
                        <li key={item}>- {item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function ModeOnboarding({ currentUser, onLogout, onSelectMode, theme, onToggleTheme }) {
  return (
    <main className="tiq-mode-page min-h-screen bg-stone-100 px-4 py-8 text-stone-900 sm:px-6">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col justify-center">
        <div className="max-w-2xl">
          <TailorIQWordmark />
          <h1 className="tiq-mode-title mt-3 text-3xl font-semibold text-stone-950 sm:text-4xl">Choose how you want to use the app</h1>
          <p className="tiq-mode-copy mt-3 text-stone-600">
            Tailor mode is for managing customer records. Client mode is for measuring yourself privately and sharing the result with a tailor.
          </p>
        </div>

        <div className="tiq-mode-account mt-6 flex flex-col gap-3 rounded-xl border border-stone-200 bg-white/95 p-4 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="tiq-mode-avatar grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#111111] text-sm font-bold text-[#ff9f00]">
              {(currentUser?.fullName || currentUser?.username || "U").trim().charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="tiq-mode-name truncate text-sm font-semibold text-[#111111]">
                {currentUser?.fullName || "Signed in"}
              </p>
              {currentUser?.email && <p className="tiq-mode-meta truncate text-xs font-semibold text-[#57534e]">{currentUser.email}</p>}
              <p className="tiq-mode-meta truncate text-xs font-semibold text-[#57534e]">@{currentUser?.username}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeSwitch theme={theme} onToggle={onToggleTheme} compact />
            <button
              type="button"
              onClick={onLogout}
              className="tiq-mode-logout min-h-10 rounded-full border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => onSelectMode("tailor")}
            className="tiq-mode-choice rounded-lg border border-stone-200 bg-white p-5 text-left shadow-sm transition hover:border-stone-400 hover:bg-stone-50"
          >
            <span className="tiq-mode-badge inline-flex rounded-md bg-stone-100 px-3 py-1 text-xs font-bold uppercase text-stone-800">Tailor mode</span>
            <h2 className="tiq-mode-card-title mt-4 text-xl font-semibold text-stone-950">Manage client measurements</h2>
            <p className="tiq-mode-card-copy mt-2 text-sm text-stone-600">
              Use customer records, manual input, drafts, review screens, and saved measurement history.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onSelectMode("client")}
            className="tiq-mode-choice rounded-lg border border-stone-200 bg-white p-5 text-left shadow-sm transition hover:border-stone-400 hover:bg-stone-50"
          >
            <span className="tiq-mode-badge inline-flex rounded-md bg-stone-100 px-3 py-1 text-xs font-bold uppercase text-stone-800">Client mode</span>
            <h2 className="tiq-mode-card-title mt-4 text-xl font-semibold text-stone-950">Measure yourself privately</h2>
            <p className="tiq-mode-card-copy mt-2 text-sm text-stone-600">
              Generate your own result sheet, review it, and copy a tailor-friendly summary when you are ready to share.
            </p>
          </button>
        </div>
      </section>
    </main>
  );
}

function CompleteProfile({ currentUser, onComplete, onLogout }) {
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextUsername = username.trim().replace(/^@/, "").toLowerCase();

    if (!/^[a-z0-9_]{3,24}$/.test(nextUsername)) {
      setStatus({ type: "error", message: "Use 3-24 lowercase letters, numbers, or underscores." });
      return;
    }

    setSaving(true);
    const result = await onComplete(nextUsername);
    setSaving(false);

    if (!result.ok) {
      setStatus({ type: "error", message: result.message });
    }
  };

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-8 text-stone-900 sm:px-6">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <TailorIQWordmark />
          <h1 className="mt-6 text-2xl font-semibold text-stone-950">Choose your TailorIQ username</h1>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            This username is how clients and tailors can find you when sharing measurement results.
          </p>
          <p className="mt-3 rounded-md bg-stone-100 px-3 py-2 text-sm font-semibold text-stone-700">
            {currentUser?.email}
          </p>

          <form onSubmit={handleSubmit} className="mt-5">
            <label className="text-sm font-semibold text-stone-800">
              Username
              <input
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  setStatus(null);
                }}
                className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm font-medium outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
                placeholder="tailor_username"
                autoCapitalize="none"
              />
            </label>

            {status && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {status.message}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="tiq-primary-action mt-5 min-h-11 w-full rounded-md px-5 text-sm font-semibold transition"
            >
              {saving ? "Saving..." : "Continue"}
            </button>
          </form>

          <button
            type="button"
            onClick={onLogout}
            className="mt-3 min-h-10 w-full rounded-md border border-stone-300 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
          >
            Logout
          </button>
        </div>
      </section>
    </main>
  );
}

function Sidebar({ activePage, currentUser, onNavigate, userMode, onChangeMode, onLogout, theme, onToggleTheme }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const visibleNavItems = userMode === "client" ? clientNavItems : navItems;
  const visibleSecondaryNavItems = userMode === "client" ? secondaryNavItems : tailorSecondaryNavItems;
  const activeItem =
    visibleNavItems.find((item) => item.id === activePage) ||
    visibleSecondaryNavItems.find((item) => item.id === activePage) ||
    visibleNavItems[0];
  const secondaryActive = visibleSecondaryNavItems.some((item) => item.id === activePage);
  const handleNavigate = (page) => {
    onNavigate(page);
    setMoreOpen(false);
  };

  return (
    <>
    <aside className="tiq-sidebar flex w-full flex-col border-b text-white md:min-h-screen md:w-72 md:border-b-0 md:border-r">
      <div className="flex items-center justify-between gap-4 px-4 py-4 md:block md:px-6 md:py-6">
        <div>
          <TailorIQWordmark compact light />
          <p className="mt-1 text-xs font-medium text-white/65 md:hidden">{activeItem.label}</p>
        </div>
      </div>

      <nav className="hidden gap-2 px-4 pb-4 md:grid md:flex-col md:overflow-visible">
        {visibleNavItems.map((item) => {
          const active = activePage === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item.id)}
              className={`flex min-h-11 items-center gap-3 rounded-md px-4 text-sm font-medium transition ${
                active
                  ? "tiq-sidebar-active shadow-sm"
                  : "text-white/75 hover:bg-white/10 hover:text-white"
              }`}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                <path d={item.icon} />
              </svg>
              {item.label}
            </button>
          );
        })}
      </nav>

      <nav className="hidden border-t border-white/10 px-4 py-4 md:grid md:gap-2">
        {visibleSecondaryNavItems.map((item) => {
          const active = activePage === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item.id)}
              className={`flex min-h-10 items-center gap-3 rounded-md px-4 text-sm font-medium transition ${
                active
                  ? "bg-[#ff9f00]/20 text-white"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                <path d={item.icon} />
              </svg>
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto hidden px-6 py-6 text-sm text-white/65 md:block">
        <p className="font-medium text-white">{userMode === "client" ? "Client mode" : "Tailor mode"}</p>
        {currentUser && (
          <p className="mt-2 rounded-md bg-white/10 px-3 py-2 text-xs font-semibold text-white/85">
            @{currentUser.username}
          </p>
        )}
        <p className="mt-2">
          {userMode === "client"
            ? "Measure yourself, review the result, and share only what you choose."
            : "Capture a height scale anchor, front photo, and side photo for measurement drafts."}
        </p>
        <div className="mt-4">
          <ThemeSwitch theme={theme} onToggle={onToggleTheme} compact />
        </div>
        <button
          type="button"
          onClick={onChangeMode}
          className="mt-4 min-h-10 rounded-md border border-white/20 px-3 text-xs font-semibold text-white transition hover:bg-white/10"
        >
          Change mode
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="mt-2 min-h-10 rounded-md border border-white/20 px-3 text-xs font-semibold text-white/80 transition hover:bg-white/10"
        >
          Logout
        </button>
      </div>
    </aside>

    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 px-2 py-2 shadow-[0_-10px_30px_rgba(28,25,23,0.12)] backdrop-blur md:hidden">
      <div
        className="mx-auto grid max-w-md gap-1"
        style={{ gridTemplateColumns: `repeat(${visibleNavItems.length + 1}, minmax(0, 1fr))` }}
      >
        {visibleNavItems.map((item) => {
          const active = activePage === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item.id)}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-1 text-[0.68rem] font-semibold transition ${
                active ? "bg-amber-100 text-amber-900" : "text-stone-500 hover:bg-stone-50"
              }`}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                <path d={item.icon} />
              </svg>
              <span className="max-w-full truncate">{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-1 text-[0.68rem] font-semibold transition ${
            secondaryActive ? "bg-amber-100 text-amber-900" : "text-stone-500 hover:bg-stone-50"
          }`}
          aria-label="Open more navigation"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
            <path d="M4 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm8 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm8 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
          </svg>
          <span>More</span>
        </button>
      </div>
    </nav>

    {moreOpen && (
      <div className="fixed inset-0 z-50 bg-stone-950/50 md:hidden">
        <button
          type="button"
          className="absolute inset-0 h-full w-full cursor-default"
          onClick={() => setMoreOpen(false)}
          aria-label="Close more navigation"
        />
        <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-xl">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-100 px-4 py-4">
            <div>
              <p className="text-sm font-semibold text-stone-950">More</p>
              <p className="text-xs text-stone-500">{currentUser ? `@${currentUser.username}` : userMode === "client" ? "Client mode" : "Tailor mode"}</p>
            </div>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              className="grid h-10 w-10 place-items-center rounded-full border border-stone-200 text-sm font-bold text-stone-600 transition hover:bg-stone-50"
              aria-label="Close"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                <path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z" />
              </svg>
            </button>
          </div>
          <div className="grid flex-1 content-start gap-2 overflow-y-auto px-4 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
            {visibleSecondaryNavItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`flex min-h-12 items-center gap-3 rounded-md px-3 text-left text-sm font-semibold transition ${
                  activePage === item.id ? "bg-amber-100 text-amber-900" : "text-stone-800 hover:bg-stone-50"
                }`}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-5 w-5 fill-current ${activePage === item.id ? "text-amber-800" : "text-stone-500"}`}>
                  <path d={item.icon} />
                </svg>
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                onChangeMode();
              }}
              className="mt-2 min-h-12 rounded-md border border-stone-300 px-3 text-left text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
            >
              Change mode
            </button>
            <ThemeSwitch theme={theme} onToggle={onToggleTheme} />
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                onLogout();
              }}
              className="mt-2 min-h-12 rounded-md border border-stone-300 px-3 text-left text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function Dashboard({
  customers,
  draftCount,
  receivedShares = [],
  reminders = [],
  onNewMeasurement,
  onViewDrafts,
  onViewMeasurement,
  onViewSharedMeasurement,
  onViewReminders,
}) {
  const savedCustomers = customers.filter((customer) => customer.measurements);
  const now = new Date();
  const openReminders = reminders
    .filter((reminder) => reminder.status !== "done")
    .sort((firstReminder, secondReminder) => {
      const firstDate = getReminderDueDate(firstReminder)?.getTime() || Number.MAX_SAFE_INTEGER;
      const secondDate = getReminderDueDate(secondReminder)?.getTime() || Number.MAX_SAFE_INTEGER;

      return firstDate - secondDate;
    });
  const todaysReminders = openReminders.filter((reminder) => {
    const dueDate = getReminderDueDate(reminder);

    return dueDate && isSameCalendarDay(dueDate, now);
  });
  const overdueCount = openReminders.filter((reminder) => {
    const dueDate = getReminderDueDate(reminder);

    return dueDate && dueDate < now && !isSameCalendarDay(dueDate, now);
  }).length;
  const stats = [
    { label: "Drafts", value: draftCount },
    { label: "Saved records", value: savedCustomers.length },
    { label: "Reminders", value: openReminders.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-3xl font-semibold text-stone-950">What needs attention</h2>
          <p className="mt-3 max-w-2xl text-stone-600">
            Start new work, continue unfinished measurements, and keep an eye on recent saved records.
          </p>
        </div>
        <button
          type="button"
          onClick={onNewMeasurement}
          className="min-h-11 rounded-md bg-amber-600 px-5 text-sm font-semibold text-white transition hover:bg-amber-700"
        >
          New measurement
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-stone-200 bg-white p-5 text-left shadow-sm"
          >
            <p className="text-sm text-stone-500">{stat.label}</p>
            <p className="mt-3 text-2xl font-semibold text-stone-950">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section>
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-stone-950">Needs attention</h3>
            <span className="text-sm text-stone-500">{draftCount} draft{draftCount === 1 ? "" : "s"}</span>
          </div>
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-stone-950">
              {draftCount > 0 ? "Unfinished measurements are waiting" : "No unfinished measurements"}
            </p>
            <p className="mt-1 text-sm text-amber-900">
              {draftCount > 0
                ? "Continue capture drafts or review generated measurements before saving final records."
                : "New captures and review drafts will appear here when there is work to continue."}
            </p>
            {draftCount > 0 && (
              <button
                type="button"
                onClick={onViewDrafts}
                className="mt-4 min-h-10 rounded-md bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800"
              >
                Open drafts
              </button>
            )}
          </div>
          {receivedShares.length > 0 && (
            <div className="mt-4 rounded-lg border border-[#111111]/20 bg-white p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-stone-950">Received client measurements</p>
                  <p className="mt-1 text-sm text-stone-500">Shared by username for your review.</p>
                </div>
                <span className="tiq-gold-chip rounded-full px-3 py-1 text-xs font-bold">
                  {receivedShares.length}
                </span>
              </div>
              <div className="mt-3 divide-y divide-stone-100">
                {receivedShares.slice(0, 3).map((share) => (
                  <div key={share.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-stone-950">{share.customer?.fullname}</p>
                      <p className="text-xs text-stone-500">
                        {share.includePhotos ? "Measurements + photos" : "Measurements only"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onViewSharedMeasurement(share)}
                      className="tiq-primary-action min-h-8 rounded-md px-3 text-xs font-semibold transition"
                    >
                      Review
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section>
          <div className="mb-6">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold text-stone-950">Today&apos;s reminders</h3>
              <span className="text-sm text-stone-500">
                {overdueCount > 0 ? `${overdueCount} overdue` : `${todaysReminders.length} today`}
              </span>
            </div>
            <div className="mt-4 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
              {openReminders.length > 0 ? (
                <div className="divide-y divide-stone-100">
                  {openReminders.slice(0, 3).map((reminder) => (
                    <div key={reminder.id} className="py-3 first:pt-0 last:pb-0">
                      <p className="text-sm font-semibold text-stone-950">{reminder.title || reminder.type}</p>
                      <p className="mt-1 text-xs text-stone-500">
                        {reminder.customerName || "No customer linked"} - {formatReminderDateTime(reminder)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-stone-500">No reminders waiting. Add fitting, pickup, or follow-up reminders when needed.</p>
              )}
              <button
                type="button"
                onClick={onViewReminders}
                className="tiq-primary-action mt-4 min-h-9 rounded-md px-3 text-xs font-semibold transition"
              >
                Open reminders
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-stone-950">Recent saved records</h3>
            <span className="text-sm text-stone-500">{savedCustomers.length} saved</span>
          </div>
          <div className="mt-4 divide-y divide-stone-100">
            {savedCustomers.slice(0, 3).map((customer) => (
              <div key={customer.id} className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="font-medium text-stone-900">{customer.fullname}</p>
                  <p className="text-sm text-stone-500">
                    {customer.height ? `${formatLength(getHeightCm(customer))} height` : getScaleSourceLabel(customer)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onViewMeasurement(customer)}
                  className="tiq-primary-action min-h-9 rounded-md px-3 text-xs font-semibold shadow-sm transition md:min-h-8 md:px-2.5"
                >
                  View
                </button>
              </div>
            ))}
            {savedCustomers.length === 0 && (
              <p className="py-6 text-sm text-stone-500">
                No saved records yet. Complete a reviewed measurement to see it here.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function ClientHome({ draftCount, latestResult, onStartMeasurement, onViewDrafts, onViewResult }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold text-stone-950">Measure yourself privately</h2>
        <p className="mt-3 max-w-2xl text-stone-600">
          Capture your front and side photos, review your measurement sheet, then share the result with your tailor when you are ready.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={onStartMeasurement}
          className="min-h-28 rounded-lg border border-amber-200 bg-amber-50 p-4 text-left transition hover:border-amber-300 hover:bg-amber-100"
        >
          <span className="text-sm font-semibold text-amber-800">Start self-measurement</span>
          <span className="mt-2 block text-sm text-stone-600">Use guided front and side photos.</span>
        </button>
        <button
          type="button"
          onClick={onViewDrafts}
          className="min-h-28 rounded-lg border border-stone-200 bg-white p-4 text-left transition hover:bg-stone-50"
        >
          <span className="text-sm font-semibold text-stone-950">Continue draft</span>
          <span className="mt-2 block text-sm text-stone-600">{draftCount} unfinished measurement{draftCount === 1 ? "" : "s"}.</span>
        </button>
        <button
          type="button"
          onClick={onViewResult}
          disabled={!latestResult}
          className="min-h-28 rounded-lg border border-stone-200 bg-white p-4 text-left transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="text-sm font-semibold text-stone-950">Latest result</span>
          <span className="mt-2 block text-sm text-stone-600">
            {latestResult ? "Open your shareable measurement sheet." : "No result generated yet."}
          </span>
        </button>
      </div>
    </div>
  );
}

function SecondaryPage({ page, userMode, customerCount, draftCount, currentUser, onChangeMode, onSaveCustomShorthand }) {
  const [customShorthandText, setCustomShorthandText] = useState("");
  const [customShorthandStatus, setCustomShorthandStatus] = useState(null);
  const pageContent = {
    help: {
      eyebrow: "Help",
      title: "Help and guide",
      body: "Use this guide when setting up your account, capturing photos, reviewing generated values, or deciding whether a photo should be retaken.",
      sections: helpSections,
    },
    privacy: {
      eyebrow: "Privacy",
      title: "Privacy policy",
      body: "TailorIQ handles personal body information, photos, and measurement records. This policy describes how that information is used in the current app and what should be in place before public launch.",
      sections: privacySections,
    },
    about: {
      eyebrow: "About",
      title: "About TailorIQ",
      body: "TailorIQ helps turn guided photos and reviewed inputs into practical measurement records for tailoring, personal fitting, and client-to-tailor sharing.",
      sections: aboutSections,
    },
  };
  const content = pageContent[page];

  useEffect(() => {
    const savedShorthand = currentUser?.customShorthand || {};
    const nextText = Object.entries(savedShorthand)
      .map(([alias, key]) => `${alias} = ${key}`)
      .join("\n");

    setCustomShorthandText(nextText);
    setCustomShorthandStatus(null);
  }, [currentUser?.username, currentUser?.customShorthand]);

  if (page === "profile") {
    const profileRows = [
      { label: "Full name", value: currentUser?.fullName || "Not provided" },
      { label: "Email", value: currentUser?.email || "Not provided" },
      { label: "Username", value: currentUser?.username ? `@${currentUser.username}` : "Not provided" },
      { label: "Current mode", value: userMode === "client" ? "Client Mode" : "Tailor Mode" },
      { label: "Saved customer records", value: customerCount },
      { label: "Unfinished drafts", value: draftCount },
    ];

    return (
      <section className="mx-auto max-w-4xl">
        <h2 className="text-3xl font-semibold text-stone-950">Profile</h2>
        <p className="mt-3 text-stone-600">
          This profile uses the details you entered during signup. Your username is the identity clients and tailors can use when sharing measurement results.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {profileRows.map((row) => (
            <div key={row.label} className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-stone-500">{row.label}</p>
              <p className="mt-2 break-words text-lg font-semibold text-stone-950">{row.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-stone-950">
            {userMode === "client" ? "Client Mode is active" : "Tailor Mode is active"}
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-700">
            {userMode === "client"
              ? "Client Mode keeps your personal measurement result separate from tailor customer records."
              : "Tailor Mode gives access to customer records, drafts, manual input, and reviewed measurement history."}
          </p>
        </div>

        <div className="mt-6 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-stone-950">Custom shorthand</h3>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Add shorthand your shop already uses. Write one mapping per line, for example: <span className="font-semibold text-stone-950">BL = back length</span> or <span className="font-semibold text-stone-950">BTM = ankle</span>.
          </p>
          <textarea
            className="mt-4 min-h-40 w-full rounded-md border border-stone-300 px-3 py-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
            value={customShorthandText}
            onChange={(event) => {
              setCustomShorthandText(event.target.value);
              setCustomShorthandStatus(null);
            }}
            placeholder={`Example:\nBTM = ankle\nHL = front length\nRD = waist to hip`}
          />

          {customShorthandStatus && (
            <div className={`mt-3 rounded-md border px-3 py-2 text-sm font-semibold ${
              customShorthandStatus.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
            >
              {customShorthandStatus.message}
            </div>
          )}

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-stone-500">
              If a shorthand is ambiguous, import will stop and ask you to clarify instead of guessing.
            </p>
            <button
              type="button"
              onClick={() => {
                const parsedShorthand = parseCustomShorthandText(customShorthandText);

                if (parsedShorthand.errors.length > 0) {
                  setCustomShorthandStatus({
                    type: "error",
                    message: parsedShorthand.errors.join("; "),
                  });
                  return;
                }

                onSaveCustomShorthand(parsedShorthand.customMap);
                setCustomShorthandStatus({
                  type: "success",
                  message: "Custom shorthand saved.",
                });
              }}
              className="tiq-primary-action min-h-10 rounded-md px-4 text-sm font-semibold transition"
            >
              Save shorthand
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onChangeMode}
          className="tiq-primary-action mt-6 min-h-11 rounded-md px-5 text-sm font-semibold transition"
        >
          Change mode
        </button>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl">
      {content.eyebrow && <p className="text-xs font-bold uppercase tracking-wide text-amber-700">{content.eyebrow}</p>}
      <h2 className="text-3xl font-semibold text-stone-950">{content.title}</h2>
      <p className="mt-3 text-stone-600">{content.body}</p>

      <div className="mt-6 grid gap-4">
        {content.sections.map((section) => (
          <div key={section.title} className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-stone-950">{section.title}</h3>
            {section.body && <p className="mt-2 text-sm leading-6 text-stone-700">{section.body}</p>}
            {section.items && (
              <ul className="mt-3 grid gap-2 text-sm leading-6 text-stone-700">
                {section.items.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Customers({ customers, onBack, onViewMeasurement, onDeleteCustomer }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [profileFilter, setProfileFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = [profileFilter !== "all", sourceFilter !== "all", sortOrder !== "newest"].filter(Boolean).length;
  const filteredCustomers = customers
    .filter((customer) => customer.fullname.toLowerCase().includes(searchTerm.trim().toLowerCase()))
    .filter((customer) => profileFilter === "all" || customer.measurementProfile === profileFilter)
    .filter((customer) => {
      if (sourceFilter === "manual") {
        return customer.measurementSource === "manual";
      }

      if (sourceFilter === "photo") {
        return customer.measurementSource !== "manual";
      }

      return true;
    })
    .sort((firstCustomer, secondCustomer) => {
      if (sortOrder === "name") {
        return firstCustomer.fullname.localeCompare(secondCustomer.fullname);
      }

      if (sortOrder === "oldest") {
        return Number(firstCustomer.id) - Number(secondCustomer.id);
      }

      return Number(secondCustomer.id) - Number(firstCustomer.id);
    });

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <BackButton onClick={onBack} label="Back to dashboard" />
        <div>
          <h2 className="text-3xl font-semibold text-stone-950">Customer records</h2>
        </div>
      </div>

      <section>
        <div className="flex items-end gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <label className="text-xs font-semibold uppercase text-stone-500" htmlFor="customer-search">Search</label>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                  <path d="M9.5 3a6.5 6.5 0 0 1 5.16 10.45l4.44 4.45-1.41 1.41-4.45-4.44A6.5 6.5 0 1 1 9.5 3Zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z" />
                </svg>
              </span>
              <input
                id="customer-search"
                className="min-h-11 w-full rounded-md border border-stone-300 px-10 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by customer name"
              />
            </div>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setFiltersOpen((currentOpen) => !currentOpen)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 sm:px-4"
              aria-expanded={filtersOpen}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                <path d="M3 5h18v2H3V5Zm4 6h10v2H7v-2Zm3 6h4v2h-4v-2Z" />
              </svg>
              <span className="hidden sm:inline">Filter</span>
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-stone-950">{activeFilterCount}</span>
              )}
            </button>
            {filtersOpen && (
              <div className="absolute right-0 z-20 mt-2 w-full min-w-72 rounded-lg border border-stone-200 bg-white p-4 shadow-xl md:w-80">
                <div className="grid gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase text-stone-500" htmlFor="customer-profile-filter">
                      Gender
                    </label>
                    <select
                      id="customer-profile-filter"
                      className="mt-2 min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
                      value={profileFilter}
                      onChange={(event) => setProfileFilter(event.target.value)}
                    >
                      <option value="all">All genders</option>
                      {profileOptions.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-stone-500" htmlFor="customer-source-filter">
                      Source
                    </label>
                    <select
                      id="customer-source-filter"
                      className="mt-2 min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
                      value={sourceFilter}
                      onChange={(event) => setSourceFilter(event.target.value)}
                    >
                      <option value="all">All sources</option>
                      <option value="photo">Photo measurements</option>
                      <option value="manual">Manual input</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-stone-500" htmlFor="customer-sort">
                      Sort
                    </label>
                    <select
                      id="customer-sort"
                      className="mt-2 min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
                      value={sortOrder}
                      onChange={(event) => setSortOrder(event.target.value)}
                    >
                      <option value="newest">Newest first</option>
                      <option value="oldest">Oldest first</option>
                      <option value="name">Name A-Z</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileFilter("all");
                      setSourceFilter("all");
                      setSortOrder("newest");
                    }}
                    className="min-h-10 rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
                  >
                    Clear filters
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {filteredCustomers.map((customer) => {
          const statusLabel = customer.measurementSource === "manual"
            ? "Manual input"
            : customer.measurements
              ? "Processed"
              : customer.status;
          const savedDate = customer.updatedAt || customer.createdAt || customer.id;
          const formattedSavedDate = savedDate ? new Date(savedDate).toLocaleDateString() : "";

          return (
            <article
              key={customer.id}
              className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm transition hover:border-amber-300"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-800">
                  {customer.fullname?.trim()?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="break-words text-base font-semibold text-stone-950 sm:text-lg">{customer.fullname}</h3>
                      {formattedSavedDate && <p className="mt-1 text-sm text-stone-500">Saved {formattedSavedDate}</p>}
                    </div>
                    <span className="w-fit rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
                      {statusLabel}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-stone-50 px-3 py-1 text-xs font-semibold text-stone-600">
                      {getProfileLabel(customer.measurementProfile)}
                    </span>
                    <span className="rounded-full bg-stone-50 px-3 py-1 text-xs font-semibold text-stone-600">
                      {customer.height ? formatLength(getHeightCm(customer)) : getScaleSourceLabel(customer)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 md:flex md:justify-end">
                <button
                  type="button"
                  onClick={() => onViewMeasurement(customer)}
                  disabled={!customer.measurements}
                  className="tiq-primary-action inline-flex min-h-10 items-center justify-center rounded-md px-4 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:bg-stone-300 md:min-h-8 md:w-16 md:px-2.5 md:text-xs"
                >
                  View
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteCustomer(customer)}
                  className="inline-flex min-h-10 items-center justify-center rounded-md border border-[#A31621] bg-transparent px-4 text-sm font-semibold text-[#A31621] shadow-sm transition hover:bg-[#A31621] hover:text-white md:min-h-8 md:w-16 md:px-2.5 md:text-xs"
                >
                  Delete
                </button>
              </div>
            </article>
          );
        })}

        {customers.length === 0 && (
          <div className="rounded-lg border border-stone-200 bg-white px-5 py-8 text-sm text-stone-500 shadow-sm">
            No customer records yet. Create a new measurement or save a manual measurement to begin.
          </div>
        )}
        {customers.length > 0 && filteredCustomers.length === 0 && (
          <div className="rounded-lg border border-stone-200 bg-white px-5 py-8 text-sm text-stone-500 shadow-sm">
            No records match the current search and filters.
          </div>
        )}
      </section>

    </div>
  );
}

function Drafts({ drafts, onBack, onContinueDraft, onDeleteDraft, onStartNew }) {
  const reviewDrafts = drafts.filter((draft) => draft.stage === "review");
  const captureDrafts = drafts.filter((draft) => draft.stage !== "review");
  const renderDraftSection = (sectionDrafts, title, description, emptyText) => (
    <section>
      <div className="border-b border-stone-100 bg-stone-50 px-5 py-4">
        <h3 className="text-sm font-semibold text-stone-950">{title}</h3>
        <p className="mt-1 text-sm text-stone-500">{description}</p>
      </div>
      <div className="hidden grid-cols-[1.3fr_0.8fr_0.8fr_1fr] gap-4 border-b border-stone-100 bg-white px-5 py-3 text-xs font-semibold uppercase text-stone-500 md:grid">
        <span>Customer</span>
        <span>Captured</span>
        <span>Scale</span>
        <span className="text-right">Actions</span>
      </div>
      <div className="divide-y divide-stone-100">
        {sectionDrafts.map((draft) => {
          const isReviewDraft = draft.stage === "review";
          const name = isReviewDraft
            ? draft.reviewCustomer?.fullname?.trim() || "Untitled review"
            : draft.values?.fullname?.trim() || "Untitled measurement";
          const capturedViews = isReviewDraft
            ? draft.reviewCustomer?.photoViews?.filter((photo) => photo.fileName).length || 0
            : [draft.photos?.front, draft.photos?.side].filter(Boolean).length;
          const updatedAt = draft.updatedAt ? new Date(draft.updatedAt).toLocaleString() : "Recently";

          return (
            <div key={draft.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1.3fr_0.8fr_0.8fr_1fr] md:items-center">
              <div className="min-w-0">
                <p className="break-words font-medium text-stone-950">{name}</p>
                <p className="mt-1 text-sm text-stone-500">
                  {isReviewDraft ? "Needs review" : "Capture in progress"} - Last edited {updatedAt}
                </p>
              </div>
              <span className="text-sm text-stone-600">{capturedViews}/2 views</span>
              <span className="text-sm text-stone-600">
                {(isReviewDraft ? draft.reviewCustomer?.scaleMode : draft.values?.scaleMode) === "reference" ? "Reference object" : "Known height"}
              </span>
              <div className="flex flex-wrap gap-2 md:justify-end">
                <button
                  type="button"
                  onClick={() => onContinueDraft(draft)}
                  className="tiq-primary-action min-h-10 rounded-md px-3 text-sm font-semibold shadow-sm transition md:min-h-8 md:w-20 md:px-2.5 md:text-xs"
                >
                  Continue
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteDraft(draft)}
                  className="min-h-10 rounded-md border border-[#A31621] bg-transparent px-3 text-sm font-semibold text-[#A31621] shadow-sm transition hover:bg-[#A31621] hover:text-white md:min-h-8 md:w-20 md:px-2.5 md:text-xs"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
        {sectionDrafts.length === 0 && (
          <div className="px-5 py-6 text-sm text-stone-500">{emptyText}</div>
        )}
      </div>
    </section>
  );

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <BackButton onClick={onBack} label="Back to dashboard" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-semibold text-stone-950">Unfinished measurements</h2>
            <p className="mt-2 text-sm text-stone-500">
              Continue unfinished captures or delete drafts you no longer need.
            </p>
          </div>
          <button
            type="button"
            onClick={onStartNew}
            className="min-h-11 rounded-md bg-amber-600 px-5 text-sm font-semibold text-white transition hover:bg-amber-700"
          >
            New measurement
          </button>
        </div>
      </div>

      {drafts.length === 0 ? (
        <section className="text-sm text-stone-500">
          No drafts yet. Start a new measurement and it will be saved here automatically until it is processed.
        </section>
      ) : (
        <div className="space-y-5">
          {renderDraftSection(
            reviewDrafts,
            "Needs review",
            "Processed measurements that have not been saved as final records.",
            "No review drafts right now.",
          )}
          {renderDraftSection(
            captureDrafts,
            "Capture drafts",
            "Unfinished customer details, photos, or reference marking.",
            "No capture drafts right now.",
          )}
        </div>
      )}
    </div>
  );
}

const styleCategories = [
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

function readStyleImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const maxSize = 1200;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");

        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);

        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };

      image.onerror = reject;
      image.src = reader.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function StyleLibrary({ styles, userMode, onSaveStyle, onDeleteStyle }) {
  const [activeStyleView, setActiveStyleView] = useState("home");
  const [formValues, setFormValues] = useState({
    title: "",
    category: "Gown",
    notes: "",
    tags: "",
    imageDataUrl: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [galleryViewMode, setGalleryViewMode] = useState("grid");
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [status, setStatus] = useState(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const isClientStyleMode = userMode === "client";
  const styleCopy = isClientStyleMode
    ? {
        title: "My style ideas",
        body: "Save outfit inspiration you love, keep everything organized, and bring clear style references when you are ready to talk to a tailor.",
        saveTitle: "Save an outfit idea",
        saveBody: "Add styles from your gallery so your tailor can understand the look, mood, and details you want.",
        galleryTitle: "View saved ideas",
        galleryBody: "Browse the styles you saved, compare options, and keep your inspiration separate from your phone gallery.",
        notePlaceholder: "What you like about it, fabric ideas, occasion, fit preference, or what to tell your tailor.",
      }
    : {
        title: "Style library",
        body: "Save style inspiration in one place so you do not have to search through your phone gallery during client discussions.",
        saveTitle: "Add a new inspiration style",
        saveBody: "Upload a style image, add category, tags, and notes, then save it into your library.",
        galleryTitle: "View saved styles",
        galleryBody: "Browse your saved style ideas with search, category filters, grid view, or list view.",
        notePlaceholder: "Fabric, neckline, sleeve, client body type, or fitting notes.",
      };
  const filteredStyles = styles
    .filter((style) => {
      const searchable = `${style.title} ${style.category} ${style.notes} ${style.tags}`.toLowerCase();
      return searchable.includes(searchTerm.trim().toLowerCase());
    })
    .filter((style) => categoryFilter === "all" || style.category === categoryFilter);

  const handleChange = (event) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      [event.target.name]: event.target.value,
    }));
    setStatus(null);
  };

  const handleImageChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setStatus({ type: "error", message: "Choose a style image from your gallery." });
      return;
    }

    try {
      setLoadingImage(true);
      const imageDataUrl = await readStyleImage(file);
      setFormValues((currentValues) => ({ ...currentValues, imageDataUrl }));
      setStatus({ type: "success", message: "Style image added. Add details if needed, then save it." });
    } catch {
      setStatus({ type: "error", message: "The image could not be added. Try another photo." });
    } finally {
      setLoadingImage(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formValues.imageDataUrl) {
      setStatus({ type: "error", message: "Add a style image before saving." });
      return;
    }

    const saved = await onSaveStyle({
      ...formValues,
      title: formValues.title.trim(),
      notes: formValues.notes.trim(),
      tags: formValues.tags.trim(),
    });

    if (!saved) {
      setStatus({ type: "error", message: "Style could not be saved. Browser storage may be full." });
      return;
    }

    setFormValues({
      title: "",
      category: "Gown",
      notes: "",
      tags: "",
      imageDataUrl: "",
    });
    setStatus({ type: "success", message: "Style saved." });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-semibold text-stone-950">{styleCopy.title}</h2>
          <p className="mt-2 max-w-2xl text-sm text-stone-500">
            {styleCopy.body}
          </p>
        </div>
        <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase text-amber-900">
          {styles.length} saved
        </span>
      </div>

      {activeStyleView === "home" && (
        <div className="grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setActiveStyleView("save");
              setStatus(null);
            }}
            className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-left transition hover:border-amber-500 hover:bg-amber-100"
          >
            <span className="inline-flex rounded-md bg-amber-200 px-3 py-1 text-xs font-bold uppercase text-amber-900">Save style</span>
            <h3 className="mt-4 text-lg font-semibold text-stone-950">{styleCopy.saveTitle}</h3>
            <p className="mt-2 text-sm text-stone-600">
              {styleCopy.saveBody}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveStyleView("gallery")}
            className="rounded-lg border border-stone-200 bg-white p-5 text-left transition hover:border-amber-300 hover:bg-stone-50"
          >
            <span className="inline-flex rounded-md bg-stone-100 px-3 py-1 text-xs font-bold uppercase text-stone-700">Gallery</span>
            <h3 className="mt-4 text-lg font-semibold text-stone-950">{styleCopy.galleryTitle}</h3>
            <p className="mt-2 text-sm text-stone-600">
              {styleCopy.galleryBody}
            </p>
          </button>
        </div>
      )}

      {activeStyleView === "save" && (
      <form onSubmit={handleSubmit} className="grid gap-4 rounded-lg border border-stone-200 bg-white p-4 shadow-sm lg:grid-cols-[0.9fr_1.1fr]">
        <div className="lg:col-span-2">
          <BackButton onClick={() => setActiveStyleView("home")} label="Back to style options" />
        </div>
        <div>
          <label className="flex min-h-72 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-amber-300 bg-amber-50 text-center transition hover:bg-amber-100">
            {formValues.imageDataUrl ? (
              <img src={formValues.imageDataUrl} alt="Style preview" className="h-full max-h-96 w-full object-cover" />
            ) : (
              <span className="px-5 text-sm font-semibold text-amber-900">
                {loadingImage ? "Preparing image..." : "Tap to add style image"}
              </span>
            )}
            <input className="sr-only" type="file" accept="image/*" onChange={handleImageChange} />
          </label>
        </div>

        <div className="grid content-start gap-4">
          <div>
            <label className="text-sm font-semibold text-stone-700" htmlFor="style-title">Style name (optional)</label>
            <input
              id="style-title"
              name="title"
              value={formValues.title}
              onChange={handleChange}
              className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
              placeholder="Example: Corset gown with flare sleeve"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-stone-700" htmlFor="style-category">Category</label>
              <select
                id="style-category"
                name="category"
                value={formValues.category}
                onChange={handleChange}
                className="mt-2 min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
              >
                {styleCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-stone-700" htmlFor="style-tags">Tags</label>
              <input
                id="style-tags"
                name="tags"
                value={formValues.tags}
                onChange={handleChange}
                className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
                placeholder="wedding, lace, dinner"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-stone-700" htmlFor="style-notes">Notes</label>
            <textarea
              id="style-notes"
              name="notes"
              value={formValues.notes}
              onChange={handleChange}
              className="mt-2 min-h-24 w-full rounded-md border border-stone-300 px-3 py-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
              placeholder={styleCopy.notePlaceholder}
            />
          </div>

          {status && (
            <div className={`rounded-md border px-3 py-2 text-sm font-semibold ${
              status.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
            >
              {status.message}
            </div>
          )}

          <button type="submit" className="tiq-primary-action min-h-11 rounded-md px-5 text-sm font-semibold transition">
            Save style
          </button>
        </div>
      </form>
      )}

      {activeStyleView === "gallery" && (
      <section>
        <div className="mb-4">
          <BackButton onClick={() => setActiveStyleView("home")} label="Back to style options" />
        </div>
        <div className="sticky top-0 z-20 rounded-lg border border-stone-200 bg-white/95 p-3 shadow-sm backdrop-blur">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="min-h-11 rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
              placeholder="Search styles, tags, or notes"
            />
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="min-h-11 rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
              aria-label="Filter style category"
            >
              <option value="all">All categories</option>
              {styleCategories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 rounded-md bg-stone-100 p-1">
              {["grid", "list"].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setGalleryViewMode(mode)}
                  className={`min-h-9 rounded px-3 text-xs font-bold capitalize transition ${
                    galleryViewMode === mode ? "bg-white text-stone-950 shadow-sm" : "text-stone-500 hover:text-stone-900"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        {galleryViewMode === "grid" ? (
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {filteredStyles.map((style) => (
              <article key={style.id} className="group relative overflow-hidden rounded-md bg-stone-200 shadow-sm">
                <button type="button" onClick={() => setSelectedStyle(style)} className="block w-full">
                  <img src={style.imageDataUrl} alt={style.title || "Saved style"} className="aspect-square w-full object-cover" />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-6 text-left text-[0.65rem] font-semibold text-white opacity-0 transition group-hover:opacity-100">
                    {style.title || style.category}
                  </span>
                </button>
                <div className="absolute right-1 top-1 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => onDeleteStyle(style)}
                    className="grid h-7 w-7 place-items-center rounded-full bg-black/60 text-xs font-bold text-white transition hover:bg-[#A31621]"
                    aria-label={`Delete ${style.title || "style"}`}
                  >
                    x
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {filteredStyles.map((style) => (
              <article key={style.id} className="grid grid-cols-[4rem_1fr] gap-3 rounded-lg border border-stone-200 bg-white p-2 shadow-sm sm:grid-cols-[5rem_1fr_auto] sm:items-center sm:p-3">
                <button type="button" onClick={() => setSelectedStyle(style)} className="overflow-hidden rounded-md bg-stone-100">
                  <img src={style.imageDataUrl} alt={style.title || "Saved style"} className="aspect-square w-full object-cover" />
                </button>
                <button type="button" onClick={() => setSelectedStyle(style)} className="min-w-0 text-left">
                  <h3 className="break-words text-sm font-semibold text-stone-950">{style.title || "Untitled style"}</h3>
                  <p className="mt-1 text-xs font-semibold text-stone-500">{style.category}</p>
                  {style.tags && <p className="mt-1 line-clamp-1 text-xs text-amber-800">{style.tags}</p>}
                  {style.notes && <p className="mt-1 line-clamp-2 text-xs leading-5 text-stone-500">{style.notes}</p>}
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteStyle(style)}
                  className="col-span-2 min-h-9 rounded-md border border-[#A31621] bg-transparent px-3 text-xs font-semibold text-[#A31621] transition hover:bg-[#A31621] hover:text-white sm:col-span-1"
                >
                  Delete
                </button>
              </article>
            ))}
          </div>
        )}

        {filteredStyles.length === 0 && (
          <div className="mt-4 rounded-lg border border-stone-200 bg-white px-5 py-8 text-sm text-stone-500 shadow-sm">
            No styles found. Save a style image to build your library.
          </div>
        )}
      </section>
      )}

      {selectedStyle && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/70 px-4 py-6">
          <div className="mx-auto max-w-3xl overflow-hidden rounded-lg bg-white shadow-xl">
            <img src={selectedStyle.imageDataUrl} alt={selectedStyle.title || "Saved style"} className="max-h-[70vh] w-full object-contain bg-stone-100" />
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-stone-950">{selectedStyle.title || "Untitled style"}</h3>
                  <p className="mt-1 text-sm text-stone-500">{selectedStyle.category}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStyle(null)}
                  className="h-10 w-10 rounded-md border border-stone-300 text-sm font-bold text-stone-700"
                  aria-label="Close style preview"
                >
                  x
                </button>
              </div>
              {selectedStyle.tags && <p className="mt-3 text-sm font-semibold text-amber-800">{selectedStyle.tags}</p>}
              {selectedStyle.notes && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-700">{selectedStyle.notes}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const reminderTypes = [
  "Fitting",
  "Pickup",
  "Payment",
  "Follow-up",
  "Measurement review",
  "Style decision",
  "Delivery",
  "Other",
];

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toTimeInputValue(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function Reminders({ reminders, customers, onSaveReminder, onUpdateReminder, onDeleteReminder, onViewCustomer }) {
  const initialDueDate = new Date();
  initialDueDate.setHours(initialDueDate.getHours() + 2, 0, 0, 0);
  const [activeReminderView, setActiveReminderView] = useState("home");
  const [activeTab, setActiveTab] = useState("today");
  const [editingReminderId, setEditingReminderId] = useState(null);
  const [formValues, setFormValues] = useState({
    customerId: "",
    type: "Fitting",
    title: "",
    dueDate: toDateInputValue(initialDueDate),
    dueTime: toTimeInputValue(initialDueDate),
    note: "",
  });
  const [status, setStatus] = useState(null);
  const now = new Date();
  const openReminders = reminders.filter((reminder) => reminder.status !== "done");
  const sortedOpenReminders = [...openReminders].sort((firstReminder, secondReminder) => {
    const firstDate = getReminderDueDate(firstReminder)?.getTime() || Number.MAX_SAFE_INTEGER;
    const secondDate = getReminderDueDate(secondReminder)?.getTime() || Number.MAX_SAFE_INTEGER;

    return firstDate - secondDate;
  });
  const todayReminders = sortedOpenReminders.filter((reminder) => {
    const dueDate = getReminderDueDate(reminder);

    return dueDate && isSameCalendarDay(dueDate, now);
  });
  const upcomingReminders = sortedOpenReminders.filter((reminder) => {
    const dueDate = getReminderDueDate(reminder);

    return !dueDate || !isSameCalendarDay(dueDate, now);
  });
  const visibleReminders = activeTab === "upcoming" ? upcomingReminders : todayReminders;
  const tabs = [
    { id: "today", label: "Today", count: todayReminders.length },
    { id: "upcoming", label: "Upcoming", count: upcomingReminders.length },
  ];
  const editingReminder = reminders.find((reminder) => reminder.id === editingReminderId) || null;

  const resetReminderForm = () => {
    const nextDueDate = new Date();
    nextDueDate.setHours(nextDueDate.getHours() + 2, 0, 0, 0);

    setEditingReminderId(null);
    setFormValues({
      customerId: "",
      type: "Fitting",
      title: "",
      dueDate: toDateInputValue(nextDueDate),
      dueTime: toTimeInputValue(nextDueDate),
      note: "",
    });
    setStatus(null);
  };

  const handleChange = (event) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      [event.target.name]: event.target.value,
    }));
    setStatus(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formValues.dueDate || !formValues.dueTime) {
      setStatus({ type: "error", message: "Choose the reminder date and time." });
      return;
    }

    const linkedCustomer = customers.find((customer) => String(customer.id) === formValues.customerId);
    const reminderPayload = {
      ...formValues,
      customerName: linkedCustomer?.fullname || "",
      dueAt: new Date(`${formValues.dueDate}T${formValues.dueTime}`).toISOString(),
    };

    if (editingReminderId) {
      const updated = await onUpdateReminder(editingReminderId, {
        customerId: reminderPayload.customerId || "",
        cloudCustomerId: linkedCustomer?.cloudCustomerId,
        customerName: reminderPayload.customerName,
        type: reminderPayload.type,
        title: reminderPayload.title.trim(),
        dueAt: reminderPayload.dueAt,
        note: reminderPayload.note.trim(),
      });

      if (!updated) {
        setStatus({ type: "error", message: "Reminder could not be updated." });
        return;
      }

      setStatus({ type: "success", message: "Reminder updated." });
      setEditingReminderId(null);
      setActiveReminderView("list");
      return;
    }

    const saved = await onSaveReminder(reminderPayload);

    if (!saved) {
      setStatus({ type: "error", message: "Reminder could not be saved. Browser storage may be full." });
      return;
    }

    setFormValues((currentValues) => ({
      customerId: "",
      type: "Fitting",
      title: "",
      dueDate: currentValues.dueDate,
      dueTime: currentValues.dueTime,
      note: "",
    }));
    setStatus({ type: "success", message: "Reminder saved." });
    setActiveReminderView("list");
  };

  const handleEditReminder = (reminder) => {
    const dueDate = getReminderDueDate(reminder) || initialDueDate;

    setEditingReminderId(reminder.id);
    setFormValues({
      customerId: reminder.customerId || "",
      type: reminder.type || "Fitting",
      title: reminder.title || "",
      dueDate: toDateInputValue(dueDate),
      dueTime: toTimeInputValue(dueDate),
      note: reminder.note || "",
    });
    setStatus(null);
    setActiveReminderView("save");
  };

  const handleDueShortcut = (daysToAdd) => {
    const dueDate = new Date();
    const nextDate = new Date(dueDate);
    nextDate.setDate(nextDate.getDate() + daysToAdd);
    nextDate.setHours(nextDate.getHours() + 2, 0, 0, 0);

    setFormValues((currentValues) => ({
      ...currentValues,
      dueDate: toDateInputValue(nextDate),
      dueTime: toTimeInputValue(nextDate),
    }));
  };

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-semibold text-stone-950">Reminders</h2>
          <p className="mt-2 max-w-2xl text-sm text-stone-500">
            Keep fittings, pickups, payments, and follow-ups close to your tailoring workflow.
          </p>
        </div>
        <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase text-amber-900">
          {openReminders.length} active
        </span>
      </div>

      {activeReminderView === "home" && (
        <div className="grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              resetReminderForm();
              setActiveReminderView("save");
            }}
            className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-left transition hover:border-amber-500 hover:bg-amber-100"
          >
            <span className="inline-flex rounded-md bg-amber-200 px-3 py-1 text-xs font-bold uppercase text-amber-900">Save reminder</span>
            <h3 className="mt-4 text-lg font-semibold text-stone-950">Add a fitting, pickup, or follow-up</h3>
            <p className="mt-2 text-sm text-stone-600">
              Create a reminder, link it to a customer if needed, and choose when it should come up.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveReminderView("list")}
            className="rounded-lg border border-stone-200 bg-white p-5 text-left transition hover:border-amber-300 hover:bg-stone-50"
          >
            <span className="inline-flex rounded-md bg-stone-100 px-3 py-1 text-xs font-bold uppercase text-stone-700">View reminders</span>
            <h3 className="mt-4 text-lg font-semibold text-stone-950">Open your reminder list</h3>
            <p className="mt-2 text-sm text-stone-600">
              Check today&apos;s reminders and upcoming work.
            </p>
          </button>
        </div>
      )}

      {activeReminderView === "save" && (
      <form onSubmit={handleSubmit} className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <BackButton
            onClick={() => {
              resetReminderForm();
              setActiveReminderView("home");
            }}
            label="Back to reminder options"
          />
        </div>
        <div className="mb-4">
          <p className="text-sm font-semibold text-stone-950">
            {editingReminder ? "Edit reminder" : "Save new reminder"}
          </p>
          <p className="mt-1 text-sm text-stone-500">
            {editingReminder ? "Update the reminder details and due time." : "Choose the due time directly or use a quick date suggestion."}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_0.8fr_0.7fr_0.7fr]">
          <div>
            <label htmlFor="reminder-customer" className="text-sm font-semibold text-stone-700">Customer</label>
            <select
              id="reminder-customer"
              name="customerId"
              value={formValues.customerId}
              onChange={handleChange}
              className="mt-2 min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
            >
              <option value="">No customer linked</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.fullname}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="reminder-type" className="text-sm font-semibold text-stone-700">Reminder type</label>
            <select
              id="reminder-type"
              name="type"
              value={formValues.type}
              onChange={handleChange}
              className="mt-2 min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
            >
              {reminderTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="reminder-date" className="text-sm font-semibold text-stone-700">Date</label>
            <input
              id="reminder-date"
              name="dueDate"
              type="date"
              value={formValues.dueDate}
              onChange={handleChange}
              className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
            />
          </div>
          <div>
            <label htmlFor="reminder-time" className="text-sm font-semibold text-stone-700">Time</label>
            <input
              id="reminder-time"
              name="dueTime"
              type="time"
              value={formValues.dueTime}
              onChange={handleChange}
              className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
            />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button
            type="button"
            onClick={() => handleDueShortcut(1)}
            className="min-h-9 rounded-md border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
          >
            Set for tomorrow
          </button>
          <button
            type="button"
            onClick={() => handleDueShortcut(7)}
            className="min-h-9 rounded-md border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
          >
            Set for next week
          </button>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-[0.8fr_1fr_auto] md:items-end">
          <div>
            <label htmlFor="reminder-title" className="text-sm font-semibold text-stone-700">Title (optional)</label>
            <input
              id="reminder-title"
              name="title"
              value={formValues.title}
              onChange={handleChange}
              className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
              placeholder="Example: Second fitting"
            />
          </div>
          <div>
            <label htmlFor="reminder-note" className="text-sm font-semibold text-stone-700">Note</label>
            <input
              id="reminder-note"
              name="note"
              value={formValues.note}
              onChange={handleChange}
              className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
              placeholder="What should you remember?"
            />
          </div>
          <button type="submit" className="tiq-primary-action min-h-11 rounded-md px-5 text-sm font-semibold transition">
            {editingReminder ? "Update reminder" : "Save reminder"}
          </button>
        </div>

        {status && (
          <div className={`mt-3 rounded-md border px-3 py-2 text-sm font-semibold ${
            status.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
          >
            {status.message}
          </div>
        )}
      </form>
      )}

      {activeReminderView === "list" && (
      <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
        <div className="mb-3">
          <BackButton onClick={() => setActiveReminderView("home")} label="Back to reminder options" />
        </div>
        <div className="grid grid-cols-2 rounded-md bg-stone-100 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-10 rounded px-3 text-xs font-bold transition ${
                activeTab === tab.id ? "bg-white text-stone-950 shadow-sm" : "text-stone-500 hover:text-stone-900"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-3">
          {visibleReminders.map((reminder) => {
            const dueDate = getReminderDueDate(reminder);
            const overdue = reminder.status !== "done" && dueDate && dueDate < now && !isSameCalendarDay(dueDate, now);

            return (
              <article key={reminder.id} className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-[0.68rem] font-bold uppercase ${
                        reminder.status === "done"
                          ? "bg-emerald-100 text-emerald-800"
                          : overdue
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-900"
                      }`}
                      >
                        {reminder.status === "done" ? "Done" : overdue ? "Overdue" : reminder.type}
                      </span>
                      <span className="text-xs font-semibold text-stone-500">{formatReminderDateTime(reminder)}</span>
                    </div>
                    <h3 className="mt-2 break-words text-base font-semibold text-stone-950">
                      {reminder.title || reminder.type}
                    </h3>
                    <p className="mt-1 text-sm text-stone-500">
                      {reminder.customerName || "No customer linked"}
                    </p>
                    {reminder.note && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-700">{reminder.note}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                    {reminder.customerId && (
                      <button
                        type="button"
                        onClick={() => onViewCustomer(reminder.customerId)}
                        className="col-span-2 min-h-9 w-full rounded-md border border-stone-300 px-3 text-xs font-semibold text-stone-800 transition hover:bg-white sm:col-span-1 sm:w-auto"
                      >
                        View record
                      </button>
                    )}
                    {reminder.status !== "done" && (
                      <button
                        type="button"
                        onClick={() => onUpdateReminder(reminder.id, { status: "done", completedAt: new Date().toISOString() })}
                        className="col-span-2 min-h-9 w-full rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 sm:col-span-1 sm:w-auto"
                      >
                        Mark done
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleEditReminder(reminder)}
                      className="min-h-9 w-full rounded-md border border-stone-300 px-3 text-xs font-semibold text-stone-800 transition hover:bg-white sm:w-auto"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteReminder(reminder)}
                      className="min-h-9 w-full rounded-md border border-[#A31621] bg-transparent px-3 text-xs font-semibold text-[#A31621] transition hover:bg-[#A31621] hover:text-white sm:w-auto"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })}

          {visibleReminders.length === 0 && (
            <div className="rounded-lg border border-dashed border-stone-300 px-5 py-8 text-center text-sm text-stone-500">
              No reminders in this list yet. Add one when you need to follow up.
            </div>
          )}
        </div>
      </div>
      )}
    </section>
  );
}

function NewMeasurementChoice({ onBack, onChooseManual, onChoosePhoto }) {
  return (
    <section className="mx-auto max-w-5xl">
      <div className="space-y-4 border-b border-stone-100 pb-5">
        <BackButton onClick={onBack} label="Back to dashboard" />
        <div>
          <h2 className="text-2xl font-semibold text-stone-950">Choose measurement method</h2>
          <p className="mt-2 text-sm text-stone-500">
            Start with guided photos for generated measurements, or enter tape measurements manually.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={onChoosePhoto}
          className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-left transition hover:border-amber-500 hover:bg-amber-100"
        >
          <span className="inline-flex rounded-md bg-amber-200 px-3 py-1 text-xs font-bold uppercase text-amber-900">Photo-assisted</span>
          <h3 className="mt-4 text-lg font-semibold text-stone-950">Generate from front and side photos</h3>
          <p className="mt-2 text-sm text-stone-600">
            Capture or upload photos, then review the generated measurements before saving.
          </p>
        </button>

        <button
          type="button"
          onClick={onChooseManual}
          className="rounded-lg border border-stone-200 bg-white p-5 text-left transition hover:border-amber-300 hover:bg-stone-50"
        >
          <span className="inline-flex rounded-md bg-stone-100 px-3 py-1 text-xs font-bold uppercase text-stone-700">Manual input</span>
          <h3 className="mt-4 text-lg font-semibold text-stone-950">Enter tape measurements</h3>
          <p className="mt-2 text-sm text-stone-600">
            Use this when measurements were already taken outside the photo flow.
          </p>
        </button>
      </div>
    </section>
  );
}

function ManualInputChoice({ onBack, onChooseImport, onChooseTyping }) {
  return (
    <section className="mx-auto max-w-5xl">
      <div className="space-y-4 border-b border-stone-100 pb-5">
        <BackButton onClick={onBack} label="Back to measurement methods" />
        <div>
          <h2 className="text-2xl font-semibold text-stone-950">How do you want to enter measurements?</h2>
          <p className="mt-2 text-sm text-stone-500">
            Choose direct typing for fresh tape measurements, or import when the measurements already exist in a book, note, or message.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={onChooseTyping}
          className="rounded-lg border border-stone-200 bg-white p-5 text-left transition hover:border-amber-300 hover:bg-stone-50"
        >
          <span className="inline-flex rounded-md bg-stone-100 px-3 py-1 text-xs font-bold uppercase text-stone-700">Type manually</span>
          <h3 className="mt-4 text-lg font-semibold text-stone-950">Enter values field by field</h3>
          <p className="mt-2 text-sm text-stone-600">
            Best when you are measuring the client now and want to type each value yourself.
          </p>
        </button>

        <button
          type="button"
          onClick={onChooseImport}
          className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-left transition hover:border-amber-500 hover:bg-amber-100"
        >
          <span className="inline-flex rounded-md bg-amber-200 px-3 py-1 text-xs font-bold uppercase text-amber-900">Import</span>
          <h3 className="mt-4 text-lg font-semibold text-stone-950">Scan, paste, or use shorthand</h3>
          <p className="mt-2 text-sm text-stone-600">
            Best for old measurement books, WhatsApp messages, notes, or shorthand like B 36, W 30, H 42.
          </p>
        </button>
      </div>
    </section>
  );
}

const manualImportAliases = {
  fullname: ["name", "full name", "customer", "client", "client name"],
  phone: ["phone", "phone number", "mobile", "tel", "telephone", "contact"],
  height: ["height", "client height"],
  measurementProfile: ["gender", "profile", "sex"],
  chest: ["chest", "round chest", "body", "burst"],
  bust: ["bust", "burst", "chest", "round bust"],
  underbust: ["underbust", "under bust", "under-bust", "below bust"],
  waist: ["waist", "natural waist", "waist band", "waistband"],
  stomach: ["stomach", "belly", "tummy", "round stomach"],
  hip: ["hip", "full hip", "hips", "round hip"],
  highHip: ["high hip", "upper hip"],
  seat: ["seat", "bottom", "full seat", "hip", "hips"],
  shoulder: ["shoulder", "shoulders", "across shoulder"],
  acrossBack: ["across back", "back width"],
  armhole: ["armhole", "arm hole", "round armhole"],
  sleeve: ["sleeve", "sleeve length", "long sleeve", "hand length"],
  bicep: ["bicep", "round sleeve", "round arm", "upper arm"],
  wrist: ["wrist", "cuff", "cuff wrist"],
  topLength: ["top length", "blouse length", "shirt length", "kaftan length", "senator length"],
  frontLength: ["front length", "front bodice", "front bodice length"],
  backLength: ["back length", "back bodice", "back bodice length"],
  bustPoint: ["bust point", "nipple point", "shoulder to bust"],
  bustSpan: ["bust span", "nipple to nipple", "apex to apex"],
  trouserLength: ["trouser length", "pants length", "outseam", "outside leg", "outer length"],
  lowerLength: ["lower length", "skirt length", "gown length", "trouser length", "bottom length"],
  waistToHip: ["waist to hip", "waist-hip", "waist hip"],
  inseam: ["inseam", "inside leg", "inner length"],
  rise: ["rise", "crotch", "crotch depth"],
  thigh: ["thigh", "lap", "round thigh"],
  knee: ["knee", "round knee"],
  ankle: ["ankle", "bottom", "hem", "ankle hem"],
  neck: ["neck", "collar"],
};

const builtInManualShorthand = {
  male: {
    n: "neck",
    c: "chest",
    ch: "chest",
    st: "stomach",
    w: "waist",
    sh: "shoulder",
    ab: "acrossBack",
    ah: "armhole",
    sl: "sleeve",
    rs: "bicep",
    ra: "bicep",
    wr: "wrist",
    cf: "wrist",
    tl: "topLength",
    tr: "trouserLength",
    out: "trouserLength",
    os: "trouserLength",
    il: "inseam",
    is: "inseam",
    r: "rise",
    th: "thigh",
    k: "knee",
    a: "ankle",
    se: "seat",
  },
  female: {
    bu: "bust",
    ub: "underbust",
    u: "underbust",
    w: "waist",
    sh: "shoulder",
    bp: "bustPoint",
    bs: "bustSpan",
    fl: "frontLength",
    bl: "backLength",
    ah: "armhole",
    sl: "sleeve",
    rs: "bicep",
    ra: "bicep",
    tl: "topLength",
    hh: "highHip",
    h: "hip",
    wh: "waistToHip",
    wth: "waistToHip",
    ll: "lowerLength",
    l: "lowerLength",
    r: "rise",
    il: "inseam",
    is: "inseam",
    th: "thigh",
    k: "knee",
    a: "ankle",
  },
};

const ambiguousManualShorthand = {
  male: {
    b: ["chest", "bicep"],
  },
  female: {
    b: ["bust", "bicep"],
  },
};

const normalizeImportText = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function addImportAlias(importMap, alias, key) {
  const normalizedAlias = normalizeImportText(alias);

  if (!normalizedAlias) {
    return;
  }

  const existingKeys = importMap.get(normalizedAlias) || [];

  if (!existingKeys.includes(key)) {
    importMap.set(normalizedAlias, [...existingKeys, key]);
  }
}

function setImportAlias(importMap, alias, key) {
  const normalizedAlias = normalizeImportText(alias);

  if (normalizedAlias) {
    importMap.set(normalizedAlias, [key]);
  }
}

function getManualImportTargets() {
  const targetMap = new Map();

  ["fullname", "phone", "height", "measurementProfile"].forEach((key) => {
    addImportAlias(targetMap, key, key);
    (manualImportAliases[key] || []).forEach((alias) => addImportAlias(targetMap, alias, key));
  });

  ["male", "female"].forEach((profileId) => {
    getProfile(profileId).sections.forEach((section) => {
      section.fields.forEach((field) => {
        addImportAlias(targetMap, field.key, field.key);
        addImportAlias(targetMap, field.label, field.key);
        (manualImportAliases[field.key] || []).forEach((alias) => addImportAlias(targetMap, alias, field.key));
      });
    });
  });

  return targetMap;
}

function getManualFieldLabel(profileId, fieldKey) {
  if (fieldKey === "fullname") {
    return "Full name";
  }

  if (fieldKey === "phone") {
    return "Phone";
  }

  if (fieldKey === "height") {
    return "Height";
  }

  if (fieldKey === "measurementProfile") {
    return "Gender";
  }

  const field = getProfile(profileId).sections
    .flatMap((section) => section.fields)
    .find((currentField) => currentField.key === fieldKey);

  return field?.label || fieldKey;
}

function parseCustomShorthandText(rawText) {
  const customMap = {};
  const errors = [];
  const targetMap = getManualImportTargets();
  const lines = rawText
    .split(/\r?\n|;/)
    .map((line) => line.trim())
    .filter(Boolean);

  lines.forEach((line) => {
    const shorthandMatch = line.match(/^(.+?)(?:=|:|\-)(.+)$/);

    if (!shorthandMatch) {
      errors.push(`${line} should look like SH = shoulder`);
      return;
    }

    const alias = normalizeImportText(shorthandMatch[1]);
    const target = normalizeImportText(shorthandMatch[2]);
    const targetKeys = targetMap.get(target) || [];

    if (!alias) {
      errors.push(`${line} has no shorthand code`);
      return;
    }

    if (targetKeys.length === 0) {
      errors.push(`${line} points to an unknown measurement field`);
      return;
    }

    if (targetKeys.length > 1) {
      errors.push(`${line} points to an ambiguous field: ${targetKeys.join(" or ")}`);
      return;
    }

    customMap[alias] = targetKeys[0];
  });

  return { customMap, errors };
}

function buildManualImportMap(profileId, customShorthand = {}) {
  const fieldKeys = new Set(getProfile(profileId).sections.flatMap((section) => section.fields.map((field) => field.key)));
  const importMap = new Map();

  ["fullname", "phone", "height", "measurementProfile"].forEach((key) => {
    (manualImportAliases[key] || []).forEach((alias) => addImportAlias(importMap, alias, key));
  });

  fieldKeys.forEach((key) => {
    addImportAlias(importMap, key, key);
    (manualImportAliases[key] || []).forEach((alias) => addImportAlias(importMap, alias, key));
  });

  getProfile(profileId).sections.forEach((section) => {
    section.fields.forEach((field) => {
      addImportAlias(importMap, field.label, field.key);
    });
  });

  Object.entries(builtInManualShorthand[profileId] || {}).forEach(([alias, key]) => {
    if (fieldKeys.has(key)) {
      addImportAlias(importMap, alias, key);
    }
  });

  Object.entries(ambiguousManualShorthand[profileId] || {}).forEach(([alias, keys]) => {
    keys.forEach((key) => {
      if (fieldKeys.has(key)) {
        addImportAlias(importMap, alias, key);
      }
    });
  });

  Object.entries(customShorthand || {}).forEach(([alias, key]) => {
    if (fieldKeys.has(key) || ["fullname", "phone", "height", "measurementProfile"].includes(key)) {
      setImportAlias(importMap, alias, key);
    }
  });

  return importMap;
}

function parseManualMeasurementText(rawText, profileId, customShorthand = {}) {
  const importMap = buildManualImportMap(profileId, customShorthand);
  const parsedValues = {};
  const matchedLabels = [];
  const unmatchedLines = [];
  const ambiguousItems = [];
  const mentionsInches = /\b(in|inch|inches)\b/i.test(rawText);
  const mentionsCm = /\b(cm|centimeter|centimeters)\b/i.test(rawText);
  const chunks = rawText
    .split(/\r?\n|;/)
    .map((line) => line.trim())
    .filter(Boolean);
  const lines = chunks.flatMap((line) => {
    const compactMatches = [...line.matchAll(/\b([a-zA-Z]{1,6})\s*[:=\-]?\s*([0-9]+(?:\.[0-9]+)?)(?:\s*(cm|in|inch|inches))?\b/g)];
    const compactText = compactMatches.map((match) => match[0]).join(" ").trim();
    const normalizedLine = line.replace(/\s+/g, " ").trim();

    if (compactMatches.length > 1 && compactText.length >= normalizedLine.length * 0.7) {
      return compactMatches.map((match) => `${match[1]} ${match[2]}${match[3] ? ` ${match[3]}` : ""}`);
    }

    return line.split(",").map((item) => item.trim()).filter(Boolean);
  });

  lines.forEach((line) => {
    const pairMatch = line.match(/^(.+?)(?:[:=\-]| {2,})(.+)$/);
    const looseMatch = line.match(/^([a-zA-Z][a-zA-Z /_-]*?)\s+([0-9]+(?:\.[0-9]+)?)(?:\s*(cm|in|inch|inches))?$/i);
    const labelText = pairMatch ? pairMatch[1] : looseMatch?.[1];
    const valueText = pairMatch ? pairMatch[2] : looseMatch?.[2];

    if (!labelText || !valueText) {
      unmatchedLines.push(line);
      return;
    }

    const normalizedLabel = normalizeImportText(labelText);
    const matchedKeys = importMap.get(normalizedLabel) || [];

    if (matchedKeys.length === 0) {
      unmatchedLines.push(line);
      return;
    }

    if (matchedKeys.length > 1) {
      const numberMatch = valueText.match(/[0-9]+(?:\.[0-9]+)?/);

      ambiguousItems.push({
        id: `${normalizedLabel}-${ambiguousItems.length}`,
        line,
        label: labelText.trim(),
        value: numberMatch?.[0] || valueText.trim(),
        options: matchedKeys.map((key) => ({
          key,
          label: getManualFieldLabel(profileId, key),
        })),
      });
      return;
    }

    const [matchedKey] = matchedKeys;

    if (matchedKey === "fullname") {
      parsedValues.fullname = valueText.trim();
      matchedLabels.push("Full name");
      return;
    }

    if (matchedKey === "phone") {
      parsedValues.phone = valueText.trim();
      matchedLabels.push("Phone");
      return;
    }

    if (matchedKey === "measurementProfile") {
      const normalizedValue = normalizeImportText(valueText);
      if (normalizedValue.includes("female") || normalizedValue.includes("woman") || normalizedValue.includes("lady")) {
        parsedValues.measurementProfile = "female";
      } else if (normalizedValue.includes("male") || normalizedValue.includes("man") || normalizedValue.includes("guy")) {
        parsedValues.measurementProfile = "male";
      }
      matchedLabels.push("Gender");
      return;
    }

    const numberMatch = valueText.match(/[0-9]+(?:\.[0-9]+)?/);
    if (!numberMatch) {
      unmatchedLines.push(line);
      return;
    }

    if (matchedKey === "height" && mentionsInches && !mentionsCm) {
      parsedValues.heightUnit = "in";
    }

    if (matchedKey !== "height" && mentionsInches && !mentionsCm) {
      parsedValues.measurementUnit = "in";
    }

    parsedValues[matchedKey] = numberMatch[0];
    matchedLabels.push(labelText.trim());
  });

  return {
    values: parsedValues,
    matchedLabels,
    unmatchedLines,
    ambiguousItems,
  };
}

function ManualMeasurementForm({ importMode = false, customShorthand = {}, onBack, onSaveManual }) {
  const [values, setValues] = useState({
    fullname: "",
    phone: "",
    height: "",
    customerNote: "",
    heightUnit: "cm",
    measurementUnit: "cm",
    measurementProfile: "male",
    chest: "",
    waist: "",
    hip: "",
    shoulder: "",
    sleeve: "",
    topLength: "",
    trouserLength: "",
    inseam: "",
    neck: "",
  });
  const [error, setError] = useState("");
  const [quickImportText, setQuickImportText] = useState("");
  const [quickImportStatus, setQuickImportStatus] = useState(null);
  const [ambiguousImportItems, setAmbiguousImportItems] = useState([]);
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [openSections, setOpenSections] = useState({});
  const [guideUnit, setGuideUnit] = useState(values.measurementUnit);
  const [selectedGuideMeasurementIndex, setSelectedGuideMeasurementIndex] = useState(0);
  const activeProfile = getProfile(values.measurementProfile);
  const manualGuideMeasurements = useMemo(() => {
    return activeProfile.sections.flatMap((section) =>
      section.fields.map((field) => {
        const enteredValue = Number(values[field.key]);
        const hasEnteredValue = Number.isFinite(enteredValue) && enteredValue > 0;

        return {
          fieldKey: field.key,
          label: field.label,
          valueCm: hasEnteredValue ? roundHalf(toCm(enteredValue, values.measurementUnit)) : 0,
          note: field.note,
          group: section.title,
        };
      }),
    );
  }, [activeProfile, values]);
  const toggleSection = (sectionTitle) => {
    setOpenSections((currentSections) => ({
      ...currentSections,
      [sectionTitle]: !(currentSections[sectionTitle] ?? true),
    }));
  };

  const handleChange = (event) => {
    setValues({ ...values, [event.target.name]: event.target.value });
    if (event.target.name === "measurementUnit") {
      setGuideUnit(event.target.value);
    }
    if (event.target.name === "measurementProfile") {
      setSelectedGuideMeasurementIndex(0);
      setAmbiguousImportItems([]);
    }
    setError("");
  };

  const applyQuickImportText = (textToImport) => {
    const initialImport = parseManualMeasurementText(textToImport, values.measurementProfile, customShorthand);
    const parsedImport = initialImport.values.measurementProfile && initialImport.values.measurementProfile !== values.measurementProfile
      ? parseManualMeasurementText(textToImport, initialImport.values.measurementProfile, customShorthand)
      : initialImport;

    if (parsedImport.matchedLabels.length === 0 && parsedImport.ambiguousItems.length === 0) {
      setQuickImportStatus({
        type: "error",
        message: "No measurement labels were recognized. Use labels or shorthand like B 36, W 30, H 42, SL 23.",
      });
      return false;
    }

    setValues((currentValues) => {
      const nextValues = {
        ...currentValues,
        ...parsedImport.values,
      };

      if (parsedImport.unmatchedLines.length > 0) {
        const importedNote = `Unmatched pasted lines: ${parsedImport.unmatchedLines.join("; ")}`;
        nextValues.customerNote = currentValues.customerNote
          ? `${currentValues.customerNote}\n${importedNote}`
          : importedNote;
      }

      return nextValues;
    });

    if (parsedImport.values.measurementUnit) {
      setGuideUnit(parsedImport.values.measurementUnit);
    }

    if (parsedImport.values.measurementProfile) {
      setSelectedGuideMeasurementIndex(0);
    }

    setError("");

    if (parsedImport.ambiguousItems.length > 0) {
      setAmbiguousImportItems(parsedImport.ambiguousItems);
      setQuickImportStatus({
        type: parsedImport.matchedLabels.length > 0 ? "success" : "error",
        message: parsedImport.matchedLabels.length > 0
          ? `Imported ${parsedImport.matchedLabels.length} clear item${parsedImport.matchedLabels.length === 1 ? "" : "s"}. Some shorthand still needs your confirmation.`
          : "Some shorthand needs your confirmation before it can be imported.",
      });
      return true;
    }

    setAmbiguousImportItems([]);
    setQuickImportStatus({
      type: "success",
      message: `Imported ${parsedImport.matchedLabels.length} item${parsedImport.matchedLabels.length === 1 ? "" : "s"}. Review the filled fields before saving.`,
    });
    return true;
  };

  const handleQuickImport = () => {
    if (!quickImportText.trim()) {
      setQuickImportStatus({ type: "error", message: "Paste the measurement text before importing." });
      return;
    }

    applyQuickImportText(quickImportText);
  };

  const handleResolveAmbiguousImport = (itemId, fieldKey, value) => {
    setValues((currentValues) => ({
      ...currentValues,
      [fieldKey]: value,
    }));
    setAmbiguousImportItems((currentItems) => currentItems.filter((item) => item.id !== itemId));
    setQuickImportStatus({
      type: "success",
      message: `${getManualFieldLabel(values.measurementProfile, fieldKey)} filled. Review the value before saving.`,
    });
  };

  const handleOcrImageChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setQuickImportStatus({ type: "error", message: "Choose a clear photo of the measurement book page." });
      return;
    }

    try {
      setOcrStatus("Reading measurement book...");
      setOcrProgress(0);
      setQuickImportStatus(null);

      const { recognize } = await import("tesseract.js");
      const result = await recognize(file, "eng", {
        logger: (message) => {
          if (message.status) {
            setOcrStatus(message.status.replace(/_/g, " "));
          }
          if (typeof message.progress === "number") {
            setOcrProgress(Math.round(message.progress * 100));
          }
        },
      });
      const extractedText = result.data.text.trim();

      if (!extractedText) {
        setQuickImportStatus({
          type: "error",
          message: "No readable text was found. Try a brighter, closer photo or type the measurements into the box.",
        });
        setOcrStatus("");
        setOcrProgress(0);
        return;
      }

      setQuickImportText(extractedText);
      const imported = applyQuickImportText(extractedText);
      setOcrStatus("");
      setOcrProgress(0);

      if (!imported) {
        setQuickImportStatus({
          type: "error",
          message: "Text was extracted, but no measurement labels matched. Edit the text labels, then tap Fill fields.",
        });
      }
    } catch {
      setOcrStatus("");
      setOcrProgress(0);
      setQuickImportStatus({
        type: "error",
        message: "The book scan could not be read. Check your internet connection, use a clearer photo, or paste the measurements manually.",
      });
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!values.fullname.trim()) {
      setError("Customer name is required.");
      return;
    }

    const measurements = buildManualMeasurements(values);

    if (measurements.length === 0) {
      setError("Enter at least one measurement before saving.");
      return;
    }

    onSaveManual({
      ...values,
      fullname: values.fullname.trim(),
      measurements,
      measurementSource: "manual",
      captureMethod: "Manual input",
      status: "Manual measurements saved",
      pipeline: ["Manual input", "Saved customer record"],
    });
  };

  return (
    <section className={`mx-auto ${importMode ? "max-w-4xl" : "max-w-6xl"}`}>
      {error && (
        <div
          className="fixed bottom-4 left-4 right-4 z-50 rounded-lg border border-red-200 bg-red-50 p-4 pr-12 text-sm font-medium text-red-800 shadow-lg sm:left-auto sm:max-w-md"
          role="alert"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Needs attention</p>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            onClick={() => setError("")}
            className="absolute right-3 top-3 rounded-md px-2 py-1 text-sm font-bold text-red-700 transition hover:bg-red-100"
            aria-label="Dismiss error"
          >
            x
          </button>
        </div>
      )}

      <div className="space-y-3 border-b border-stone-100 pb-4 sm:space-y-4 sm:pb-5">
        <BackButton onClick={onBack} label="Back to dashboard" />
        <div>
          <h2 className="text-xl font-semibold text-stone-950 sm:text-2xl">Enter measurements manually</h2>
          <p className="mt-2 text-sm text-stone-500">
            {importMode
              ? "Scan a measurement book page or paste shorthand, then review the filled fields before saving."
              : "Type measurements taken outside the app. The customer record will be marked as manual input."}
          </p>
        </div>
      </div>

      <form className="mt-4 space-y-4 sm:mt-5 sm:space-y-5" onSubmit={handleSubmit}>
        {importMode && (
        <section className="-mx-1 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:mx-0 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-stone-950">Quick import from book or message</h3>
              <p className="mt-1 text-sm leading-6 text-stone-700">
                Paste measurements from WhatsApp, notes, or a typed copy of your measurement book. Shorthand like B 36, W 30, H 42, SL 23 is supported.
              </p>
            </div>
            <span className="w-fit rounded-full bg-white px-3 py-1 text-[0.68rem] font-bold uppercase text-amber-800 shadow-sm sm:text-xs">
              Review before save
            </span>
          </div>

          <textarea
            className="mt-3 min-h-44 w-full rounded-md border border-amber-200 bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100 sm:mt-4 sm:min-h-36"
            value={quickImportText}
            onChange={(event) => {
              setQuickImportText(event.target.value);
              setQuickImportStatus(null);
            }}
            placeholder={`Example:\nName: Florence\nGender: Female\nBust: 36 in\nWaist: 30\nFull hip: 42\nSleeve length: 23\nSkirt length: 40`}
          />

          {quickImportStatus && (
            <div className={`mt-3 rounded-md border px-3 py-2 text-sm font-semibold ${
              quickImportStatus.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
            >
              {quickImportStatus.message}
            </div>
          )}

          {ambiguousImportItems.length > 0 && (
            <div className="mt-3 grid gap-3">
              {ambiguousImportItems.map((item) => (
                <div key={item.id} className="rounded-md border border-amber-200 bg-white p-3">
                  <p className="text-sm font-semibold text-stone-950">
                    {item.label} could mean {item.options.map((option) => option.label).join(" or ")}. Choose one.
                  </p>
                  <p className="mt-1 text-xs text-stone-500">Value read: {item.value}</p>
                  <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
                    {item.options.map((option) => (
                      <button
                        key={`${item.id}-${option.key}`}
                        type="button"
                        onClick={() => handleResolveAmbiguousImport(item.id, option.key, item.value)}
                        className="min-h-10 rounded-md border border-amber-300 bg-amber-50 px-3 text-xs font-bold text-amber-900 transition hover:bg-amber-100 sm:min-h-9"
                      >
                        Use as {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {ocrStatus && (
            <div className="mt-3 rounded-md border border-amber-200 bg-white px-3 py-3">
              <div className="flex items-center justify-between gap-3 text-xs font-bold uppercase text-amber-800">
                <span>{ocrStatus}</span>
                <span>{ocrProgress}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-amber-100">
                <div
                  className="h-full rounded-full bg-amber-600 transition-all"
                  style={{ width: `${ocrProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-3 grid gap-3 sm:flex sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-stone-600 sm:max-w-md">
              Use a bright, close photo of one measurement page. Printed or clearly written labels work best.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 sm:min-h-10 sm:px-4">
                Scan page
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleOcrImageChange}
                />
              </label>
              <button
                type="button"
                onClick={handleQuickImport}
                className="tiq-primary-action min-h-11 rounded-md px-3 text-sm font-semibold transition sm:min-h-10 sm:px-4"
              >
                Fill fields
              </button>
            </div>
          </div>
        </section>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-stone-700" htmlFor="manual-fullname">
              Full name*
            </label>
            <input
              className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
              id="manual-fullname"
              name="fullname"
              value={values.fullname}
              onChange={handleChange}
              placeholder="Enter customer name"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-stone-700" htmlFor="manual-height">
              Height
            </label>
            <div className="mt-2 flex gap-2">
              <input
                className="min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
                id="manual-height"
                name="height"
                type="number"
                value={values.height}
                onChange={handleChange}
                onWheel={preventNumberInputWheel}
                placeholder="170 or 67"
              />
              <select
                className="min-h-11 rounded-md border border-stone-300 px-2 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
                name="heightUnit"
                value={values.heightUnit}
                onChange={handleChange}
                aria-label="Height unit"
              >
                <option value="cm">cm</option>
                <option value="in">in</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-stone-700" htmlFor="manual-phone">
              Phone number (optional)
            </label>
            <input
              className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
              id="manual-phone"
              name="phone"
              type="tel"
              value={values.phone}
              onChange={handleChange}
              placeholder="080..."
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-stone-700" htmlFor="manual-customer-note">
            Notes, extra measurements, or client preference
          </label>
          <textarea
            className="mt-2 min-h-28 w-full rounded-md border border-stone-300 px-3 py-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
            id="manual-customer-note"
            name="customerNote"
            value={values.customerNote}
            onChange={handleChange}
            placeholder="Example: Add 1 inch ease to chest, client prefers ankle-length trouser, cap size 23 in."
          />
        </div>

        <div>
          <p className="text-sm font-medium text-stone-700" id="manual-profile-label">
            Gender*
          </p>
          <div
            className="tiq-segmented mt-2 grid grid-cols-2 overflow-hidden rounded-full p-0.5"
            role="radiogroup"
            aria-labelledby="manual-profile-label"
          >
            {profileOptions.map((profile) => (
              <button
                key={profile.id}
                type="button"
                role="radio"
                aria-checked={values.measurementProfile === profile.id}
                onClick={() => {
                  setValues((currentValues) => ({
                    ...currentValues,
                    measurementProfile: profile.id,
                  }));
                  setSelectedGuideMeasurementIndex(0);
                  setError("");
                }}
                className={`min-h-10 rounded-full px-3 text-sm font-semibold transition ${
                  values.measurementProfile === profile.id ? "tiq-segmented-button-active" : "tiq-segmented-button"
                }`}
              >
                {profile.label}
              </button>
            ))}
          </div>
        </div>

        {!importMode && (
          <ResultBodyGuide
            measurements={manualGuideMeasurements}
            profileId={values.measurementProfile}
            unit={guideUnit}
            onUnitChange={(nextUnit) => {
              setGuideUnit(nextUnit);
              setValues((currentValues) => ({
                ...currentValues,
                measurementUnit: nextUnit,
              }));
            }}
            selectedIndex={selectedGuideMeasurementIndex}
            onSelect={setSelectedGuideMeasurementIndex}
            title="Measurement Guide"
            compact
          />
        )}

        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
          <div className="sticky top-0 z-10 flex flex-col gap-2 border-b border-stone-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div>
              <p className="text-sm font-semibold text-stone-950">{activeProfile.label} measurement sheet</p>
              {!importMode && <p className="mt-1 text-sm text-stone-500">{activeProfile.description}</p>}
            </div>
            <select
              className="min-h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100 sm:w-auto"
              name="measurementUnit"
              value={values.measurementUnit}
              onChange={handleChange}
              aria-label="Measurement unit"
            >
              <option value="cm">Centimeters</option>
              <option value="in">Inches</option>
            </select>
          </div>

          <div className="space-y-3 bg-stone-50 p-3 sm:space-y-4 sm:p-4">
            {activeProfile.sections.map((section) => {
              const isOpen = openSections[section.title] ?? true;

              return (
                <section key={section.title} className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.title)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition hover:bg-stone-50 sm:gap-4 sm:px-4 sm:py-4"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-stone-950">{section.title}</span>
                      {!importMode && <span className="mt-1 block text-sm text-stone-500">{section.description}</span>}
                    </span>
                    <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-600">
                      {isOpen ? "Hide" : "Show"}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="grid gap-3 border-t border-stone-100 p-3 sm:grid-cols-2 sm:gap-4 sm:p-4 lg:grid-cols-3">
                      {section.fields.map((field) => (
                        <div key={`${section.title}-${field.key}`}>
                          <label className="text-sm font-medium text-stone-700" htmlFor={`manual-${section.title}-${field.key}`}>
                            {field.label}
                          </label>
                          <input
                            className="mt-2 min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
                            id={`manual-${section.title}-${field.key}`}
                            name={field.key}
                            type="number"
                            min="0"
                            step="0.1"
                            value={values[field.key] || ""}
                            onChange={handleChange}
                            onWheel={preventNumberInputWheel}
                            placeholder={values.measurementUnit}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end border-t border-stone-100 pt-4 sm:pt-5">
          <button
            type="submit"
            className="min-h-11 w-full rounded-md bg-amber-600 px-5 text-sm font-semibold text-white transition hover:bg-amber-700 sm:w-auto"
          >
            Save manual measurements
          </button>
        </div>
      </form>
    </section>
  );
}

function MeasurementReview({ draftCustomer, onSaveReview, onCancel, onDraftChange, onClearDraft }) {
  const isEditingSavedRecord = draftCustomer?.editMode === "saved-record";
  const [reviewDraftId] = useState(() => draftCustomer?.draftStorageId || `review-${draftCustomer?.id || Date.now()}`);
  const [unit, setUnit] = useState(draftCustomer?.reviewState?.unit || "in");
  const [customerNote, setCustomerNote] = useState(draftCustomer?.reviewState?.customerNote ?? draftCustomer?.customerNote ?? "");
  const [values, setValues] = useState(
    () =>
      draftCustomer?.reviewState?.values ||
      draftCustomer?.measurements.reduce((currentValues, measurement, index) => {
        return {
          ...currentValues,
          [index]: String(cmToInches(measurement.valueCm)),
        };
      }, {}) || {},
  );

  const saveReviewDraft = useCallback(() => {
    if (!draftCustomer || isEditingSavedRecord) {
      return;
    }

    const reviewCustomer = { ...draftCustomer };
    delete reviewCustomer.reviewState;

    onDraftChange?.({
      id: reviewDraftId,
      stage: "review",
      createdAt: draftCustomer.createdAt,
      updatedAt: new Date().toISOString(),
      reviewCustomer: {
        ...reviewCustomer,
        draftStorageId: reviewDraftId,
      },
      reviewState: {
        unit,
        customerNote,
        values,
      },
    });
  }, [customerNote, draftCustomer, isEditingSavedRecord, onDraftChange, reviewDraftId, unit, values]);

  useEffect(() => {
    saveReviewDraft();
  }, [saveReviewDraft]);

  if (!draftCustomer) {
    return null;
  }

  const generatedBaseline = draftCustomer.generatedMeasurements || draftCustomer.measurements;
  const groupedMeasurements = draftCustomer.measurements.reduce((groups, measurement, index) => {
    const group = measurement.group || getProfileLabel(draftCustomer.measurementProfile);

    return {
      ...groups,
      [group]: [...(groups[group] || []), { ...measurement, index }],
    };
  }, {});

  const handleValueChange = (index, value) => {
    setValues({ ...values, [index]: value });
  };

  const handleSave = async () => {
    const finalMeasurements = draftCustomer.measurements.map((measurement, index) => {
      const generatedMeasurement = generatedBaseline[index] || measurement;
      const rawValue = Number(values[index]);
      const finalValueCm = Number.isFinite(rawValue) && rawValue > 0 ? toCm(rawValue, unit) : measurement.valueCm;
      const generatedText = formatLength(generatedMeasurement.valueCm);

      return {
        ...measurement,
        generatedValueCm: generatedMeasurement.valueCm,
        valueCm: roundHalf(finalValueCm),
        note: `Reviewed final. Generated draft was ${generatedText}.`,
      };
    });

    await onSaveReview({
      ...draftCustomer,
      measurements: finalMeasurements,
      generatedMeasurements: generatedBaseline,
      correctionLog: buildCorrectionLog(generatedBaseline, finalMeasurements),
      customerNote: customerNote.trim(),
      measurementSource: draftCustomer.measurementSource === "manual" ? "manual" : "reviewed-photo",
      status: isEditingSavedRecord ? "Measurements updated" : "Reviewed measurements saved",
      reviewStatus: draftCustomer.measurementSource === "manual" ? undefined : "Reviewed by tailor",
      editMode: undefined,
      draftStorageId: undefined,
      reviewState: undefined,
    });
    onClearDraft?.(reviewDraftId);
  };

  const handleCancel = () => {
    saveReviewDraft();
    onCancel?.();
  };

  return (
    <section className="mx-auto max-w-6xl">
      <div className="flex flex-col justify-between gap-4 border-b border-stone-200 pb-5 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-3xl font-semibold text-stone-950">{draftCustomer.fullname}</h2>
          <p className="mt-2 max-w-2xl text-sm text-stone-500">
            {isEditingSavedRecord
              ? "Update the saved values, then save the customer record."
              : "Check the generated draft, correct anything that is off, then save the final record."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-700">
              {getProfileLabel(draftCustomer.measurementProfile)}
            </span>
            <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-700">
              {getScaleSourceLabel(draftCustomer)}
            </span>
            <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-700">
              {formatLength(getScaleHeightCm(draftCustomer))}
            </span>
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-stone-500">Edit in</p>
          <div className="tiq-segmented grid grid-cols-2 overflow-hidden rounded-full p-0.5">
            {[
              { id: "in", label: "Inches" },
              { id: "cm", label: "cm" },
            ].map((unitOption) => (
              <button
                key={unitOption.id}
                type="button"
                onClick={() => {
                  const nextUnit = unitOption.id;

                  if (nextUnit === unit) {
                    return;
                  }

                  setValues(
                    draftCustomer.measurements.reduce((currentValues, measurement, index) => {
                      const currentCm = toCm(Number(values[index]), unit);

                      return {
                        ...currentValues,
                        [index]: String(nextUnit === "in" ? cmToInches(currentCm || measurement.valueCm) : roundHalf(currentCm || measurement.valueCm)),
                      };
                    }, {}),
                  );
                  setUnit(nextUnit);
                }}
                className={`min-h-8 rounded-full px-2.5 text-xs font-semibold transition ${
                  unit === unitOption.id ? "tiq-segmented-button-active" : "tiq-segmented-button"
                }`}
              >
                {unitOption.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {draftCustomer.segmentationWarnings?.length > 0 && (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-stone-950">Photo check notes</p>
          <div className="mt-2 grid gap-2">
            {draftCustomer.segmentationWarnings.map((warning) => (
              <p key={warning} className="text-sm text-amber-900">{warning}</p>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 space-y-6">
        {Object.entries(groupedMeasurements).map(([group, measurements]) => (
          <section key={group} className="border-t border-stone-100 pt-5 first:border-t-0 first:pt-0">
            <h3 className="text-sm font-semibold text-stone-950">{group}</h3>
            <div className="mt-4 grid grid-cols-2 gap-3 md:gap-4">
              {measurements.map((measurement) => {
                const generatedMeasurement = generatedBaseline[measurement.index] || measurement;
                const currentValueCm = toCm(Number(values[measurement.index]), unit);
                const differenceCm = roundHalf((currentValueCm || measurement.valueCm) - generatedMeasurement.valueCm);
                const hasChanged = Math.abs(differenceCm) >= 0.5;

                return (
                  <div
                    key={`${measurement.group}-${measurement.fieldKey}`}
                    className={`min-w-0 rounded-md border bg-white p-3 transition ${
                      hasChanged ? "border-amber-300 shadow-sm ring-1 ring-amber-100" : "border-stone-200"
                    }`}
                  >
                    <label className="text-sm font-semibold text-stone-950" htmlFor={`review-${measurement.index}`}>
                      {measurement.label}
                    </label>
                    <p className="mt-2 inline-flex rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                      Generated {formatLength(generatedMeasurement.valueCm)}
                    </p>
                    <input
                      id={`review-${measurement.index}`}
                      className="mt-3 min-h-11 w-full rounded-md border border-stone-300 px-3 text-base font-semibold outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
                      type="number"
                      min="0"
                      step="0.1"
                      value={values[measurement.index] || ""}
                      onChange={(event) => handleValueChange(measurement.index, event.target.value)}
                      onWheel={preventNumberInputWheel}
                    />
                    {hasChanged && (
                      <p className="mt-2 text-xs font-medium text-amber-700">
                        Adjusted: {differenceCm > 0 ? "+" : ""}{differenceCm} cm / {cmToInches(differenceCm)} in
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-5 rounded-lg border border-stone-200 bg-stone-50 p-4">
        <label className="text-sm font-semibold text-stone-950" htmlFor="review-customer-note">
          Notes, extra measurements, or client preference
        </label>
        <textarea
          id="review-customer-note"
          className="mt-3 min-h-28 w-full rounded-md border border-stone-300 bg-white px-3 py-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
          value={customerNote}
          onChange={(event) => setCustomerNote(event.target.value)}
          placeholder="Example: Client wants looser sleeve, add embroidery placement, include cap size or any extra measurement not listed."
        />
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-stone-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={handleCancel}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-stone-300 text-stone-700 transition hover:bg-stone-50"
          aria-label={isEditingSavedRecord ? "Back to records" : "Back to drafts"}
          title={isEditingSavedRecord ? "Back to records" : "Back to drafts"}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.42-1.41L7.83 13H20v-2Z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="min-h-11 rounded-md bg-amber-600 px-5 text-sm font-semibold text-white transition hover:bg-amber-700"
        >
          {isEditingSavedRecord ? "Save changes" : "Save final measurements"}
        </button>
      </div>
    </section>
  );
}

function buildShareText(customer) {
  if (!customer) {
    return "";
  }

  const lines = [
    `Measurement result for ${customer.fullname}`,
    `Profile: ${getProfileLabel(customer.measurementProfile)}`,
    `Height scale: ${formatLength(getScaleHeightCm(customer))}`,
    "",
    "Measurements:",
    ...customer.measurements.map((measurement) => `- ${measurement.label}: ${formatLength(measurement.valueCm)}`),
  ];

  if (customer.customerNote) {
    lines.push("", `Notes: ${customer.customerNote}`);
  }

  return lines.join("\n");
}

function getResultGuidePoint(mark) {
  if (mark.type === "horizontal") {
    return { x: (mark.x1 + mark.x2) / 2, y: mark.y };
  }

  if (mark.type === "vertical") {
    return { x: mark.x + 3, y: (mark.y1 + mark.y2) / 2 };
  }

  if (mark.type === "diagonal") {
    return { x: mark.x2 + 3, y: mark.y2 - 3 };
  }

  if (mark.type === "curve") {
    return { x: mark.cx, y: mark.cy };
  }

  return { x: mark.cx, y: mark.cy };
}

function getCircumferenceMarkerHeight(mark) {
  if (["neck", "wrist", "ankle"].includes(mark.key)) {
    return 1.8;
  }

  if (["bicep", "thigh", "knee"].includes(mark.key)) {
    return 2.2;
  }

  if (["seat", "hip", "highHip"].includes(mark.key)) {
    return 3.4;
  }

  return 2.8;
}

function ResultGuideLine({ mark }) {
  const stroke = "#ff9f00";
  const strokeWidth = 1.15;

  if (mark.marker === "circumference" && mark.type === "horizontal") {
    return (
      <ellipse
        cx={(mark.x1 + mark.x2) / 2}
        cy={mark.y}
        rx={(mark.x2 - mark.x1) / 2}
        ry={getCircumferenceMarkerHeight(mark)}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray="2 2"
      />
    );
  }

  if (mark.type === "horizontal") {
    return <path d={`M${mark.x1} ${mark.y} H${mark.x2}`} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray="2 2" />;
  }

  if (mark.type === "vertical") {
    return <path d={`M${mark.x} ${mark.y1} V${mark.y2}`} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray="2 2" />;
  }

  if (mark.type === "diagonal") {
    return <path d={`M${mark.x1} ${mark.y1} L${mark.x2} ${mark.y2}`} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray="2 2" />;
  }

  if (mark.type === "curve") {
    return <path d={mark.path} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray="2 2" />;
  }

  return <circle cx={mark.cx} cy={mark.cy} r={mark.r} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeDasharray="2 2" />;
}

function ResultBodyGuide({ measurements, profileId, unit, onUnitChange, selectedIndex, onSelect, title, resultDate, compact = false }) {
  const [hasSelectedMarker, setHasSelectedMarker] = useState(false);
  const [highlightKey, setHighlightKey] = useState(0);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const guide = resultGuideDefinitions[profileId] || resultGuideDefinitions.male;
  const guideImage = resultGuideImages[profileId] || resultGuideImages.male;
  const visualMeasurements = measurements.map((measurement, index) => {
    const lowerWaist = measurement.fieldKey === "waist" && measurement.group === "Lower body";
    const mark = guide.find((guideMark) => (
      lowerWaist
        ? guideMark.key === "waistLower"
        : guideMark.key === measurement.fieldKey
    )) || guide.find((guideMark) => guideMark.label.toLowerCase() === measurement.label.toLowerCase());

    return mark ? { measurement, mark, number: index + 1, index } : null;
  }).filter(Boolean);

  useEffect(() => {
    const timeout = window.setTimeout(() => setShowInfoPanel(false), 2800);

    return () => window.clearTimeout(timeout);
  }, [selectedIndex, highlightKey]);

  if (visualMeasurements.length === 0) {
    return null;
  }

  const selected = visualMeasurements.find((item) => item.index === selectedIndex) || visualMeasurements[0];
  const value = unit === "cm"
    ? `${roundHalf(selected.measurement.valueCm)} cm`
    : `${cmToInches(selected.measurement.valueCm)} in`;
  const selectedPoint = getResultGuidePoint(selected.mark);
  const formattedGuideDate = resultDate ? new Date(resultDate).toLocaleString([], {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }) : "";

  const handleSelect = (index) => {
    setHasSelectedMarker(true);
    setShowInfoPanel(true);
    setHighlightKey((currentKey) => currentKey + 1);
    onSelect(index);
  };

  return (
    <div className={`tiq-result-surface tiq-result-surface-light mt-5 overflow-hidden border text-stone-950 shadow-lg ${
      compact ? "rounded-lg" : "-mx-4 sm:-mx-6 lg:-mx-10"
    }`}>
      <div className="relative min-h-[42rem] overflow-hidden px-4 pb-4 pt-5 sm:min-h-[48rem] sm:px-7 sm:pt-7 lg:min-h-[45rem]">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-[44%] opacity-65">
          <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,159,0,0.22)_52%,transparent_53%),linear-gradient(60deg,transparent_0%,rgba(0,0,4,0.12)_44%,transparent_45%)] bg-[size:34px_42px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(0,0,4,0.22)_1px,transparent_2px)] bg-[size:34px_34px]" />
        </div>

        <div className="relative z-20">
          <p className="max-w-[65%] truncate text-3xl font-light tracking-[0.18em] text-stone-950 sm:text-5xl">
            {title || "My Measurements"}
          </p>
          {formattedGuideDate && (
            <p className="mt-4 max-w-[64%] text-center text-sm tracking-[0.24em] text-stone-600 sm:text-base">
              {formattedGuideDate}
            </p>
          )}
          <div className="mt-5 flex items-center gap-5 text-sm tracking-[0.24em] text-stone-700 sm:text-base">
            {[
              { id: "cm", label: "cm" },
              { id: "in", label: "inches" },
            ].map((unitOption) => (
              <button
                key={unitOption.id}
                type="button"
                onClick={() => onUnitChange(unitOption.id)}
                className="inline-flex items-center gap-2"
              >
                <span className={`grid h-5 w-5 place-items-center rounded-full border ${
                  unit === unitOption.id ? "border-[#FF9F00]" : "border-stone-500"
                }`}>
                  {unit === unitOption.id && <span className="h-2.5 w-2.5 rounded-full bg-[#FF9F00]" />}
                </span>
                {unitOption.label}
              </button>
            ))}
          </div>
        </div>

        <div className="tiq-result-body-figure absolute z-10 aspect-[853/1844]">
          <div className="absolute inset-0 rounded-full bg-[#ff9f00]/15 blur-3xl" />
          <img
            src={guideImage}
            alt="Standing measurement guide"
            className="absolute inset-0 z-10 h-full w-full rounded-b-[45%] object-cover object-top"
          />
          <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-b from-transparent via-transparent to-amber-900/10" />
          {hasSelectedMarker && (
            <svg className="pointer-events-none absolute inset-0 z-30 h-full w-full" viewBox="0 0 100 216" aria-hidden="true" preserveAspectRatio="none">
              <ResultGuideLine mark={selected.mark} />
              {selected.mark.marker !== "circumference" && (
                <circle cx={selectedPoint.x} cy={selectedPoint.y} r="2.2" fill="#FF9F00" stroke="#ffffff" strokeWidth="0.8" />
              )}
            </svg>
          )}
        </div>

        <div className="relative z-20 mt-6 max-h-[30rem] w-[54%] min-w-0 overflow-y-auto pr-1 sm:mt-8 sm:max-h-[33rem] sm:w-[46%] lg:w-[40%]">
          {visualMeasurements.map((item) => (
            <button
              key={`${item.measurement.fieldKey}-${item.index}`}
              type="button"
              onClick={() => handleSelect(item.index)}
              className="group mb-3 grid w-full grid-cols-[2.6rem_minmax(0,1fr)] items-center gap-3 text-left last:mb-0 sm:grid-cols-[3.2rem_minmax(0,1fr)]"
            >
              <span className={`grid h-10 w-10 place-items-center rounded-full border-2 text-base font-semibold transition sm:h-12 sm:w-12 sm:text-xl ${
                item.index === selected.index && hasSelectedMarker
                  ? "border-[#111111] bg-[#111111] text-[#FF9F00]"
                  : "border-[#FF9F00] bg-white/80 text-[#111111] group-hover:bg-white"
              }`}>
                {item.number}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium tracking-[0.16em] text-stone-950 sm:text-base">{item.measurement.label}</span>
                <span className="mt-1 block text-sm tracking-[0.12em] text-stone-600 sm:text-base">
                  {unit === "cm" ? roundHalf(item.measurement.valueCm) : cmToInches(item.measurement.valueCm)}
                </span>
              </span>
            </button>
          ))}
        </div>

        {showInfoPanel && (
          <div className="absolute inset-x-4 top-32 z-40 rounded-lg border border-[#FF9F00]/40 bg-[#111111]/95 p-4 text-white shadow-2xl backdrop-blur sm:left-auto sm:right-8 sm:top-36 sm:w-[26rem]">
            <p className="text-sm font-semibold">{selected.measurement.label}: {value}</p>
            <p className="mt-2 text-sm leading-6 text-white/95">{selected.mark.instruction}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function MeasurementResults({ customer, onBack, onEdit, onDelete, onShareToTailor, userMode = "tailor" }) {
  const [shareStatus, setShareStatus] = useState("");
  const [resultView, setResultView] = useState("guide");
  const [resultUnit, setResultUnit] = useState("cm");
  const [selectedMeasurementIndex, setSelectedMeasurementIndex] = useState(0);
  const [tailorUsername, setTailorUsername] = useState("");
  const [includePhotos, setIncludePhotos] = useState(false);

  if (!customer) {
    return null;
  }

  const confidence = getPhotoConfidence(customer);
  const isManual = customer.measurementSource === "manual";
  const isClientMode = userMode === "client";
  const shareText = buildShareText(customer);
  const resultDate = customer.updatedAt || customer.createdAt || customer.id;
  const formattedResultDate = resultDate ? new Date(resultDate).toLocaleDateString() : "";
  const getMeasurementNote = (note) => note?.replace(/^Reviewed final\.\s*/, "");
  const availablePhotoViews = [
    {
      view: "Front view",
      preview: customer.photoCensoredPreviews?.front || customer.photoPreviews?.front,
      isCensored: Boolean(customer.photoCensoredPreviews?.front),
      fileName: customer.photoViews?.find((photo) => photo.view === "Front view")?.fileName,
    },
    {
      view: "Side view",
      preview: customer.photoCensoredPreviews?.side || customer.photoPreviews?.side,
      isCensored: Boolean(customer.photoCensoredPreviews?.side),
      fileName: customer.photoViews?.find((photo) => photo.view === "Side view")?.fileName,
    },
  ].filter((photo) => Boolean(photo.preview));
  const groupedMeasurements = customer.measurements.reduce((groups, measurement) => {
    const group = measurement.group || getProfileLabel(customer.measurementProfile);

    return {
      ...groups,
      [group]: [...(groups[group] || []), measurement],
    };
  }, {});
  const handleCopyShareText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setShareStatus("Measurement summary copied.");
    } catch {
      setShareStatus("Copy failed. Select and copy the summary manually.");
    }
  };
  const handleNativeShare = async () => {
    if (!navigator.share) {
      await handleCopyShareText();
      return;
    }

    try {
      await navigator.share({
        title: `Measurement result for ${customer.fullname}`,
        text: shareText,
      });
      setShareStatus("Share sheet opened.");
    } catch {
      setShareStatus("");
    }
  };
  const handleUsernameShare = async () => {
    const username = tailorUsername.trim().replace(/^@/, "");

    if (!username) {
      setShareStatus("Enter the tailor username first.");
      return;
    }

    const result = await onShareToTailor?.({
      tailorUsername: username,
      includePhotos,
      customer,
    });

    if (!result?.ok) {
      setShareStatus(result?.message || "Measurement could not be shared.");
      return;
    }

    setShareStatus(`Shared to @${username}${includePhotos ? " with photos." : " as measurements only."}`);
    setTailorUsername("");
    setIncludePhotos(false);
  };

  return (
    <section className="min-w-0">
      <div className="border-b border-stone-200 pb-5">
        <div className="flex items-center justify-between gap-3">
          <BackButton onClick={onBack} label={isClientMode ? "Back to home" : "Back to customers"} />
          {!isClientMode && (
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => onEdit(customer)}
                className="min-h-10 rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDelete(customer)}
                className="min-h-10 rounded-md border border-[#A31621] bg-transparent px-3 text-sm font-semibold text-[#A31621] shadow-sm transition hover:bg-[#A31621] hover:text-white md:min-h-8 md:px-2.5 md:text-xs"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        <div className="mt-5 min-w-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h3 className="break-words text-3xl font-semibold text-stone-950">{customer.fullname}</h3>
              {formattedResultDate && <p className="mt-2 text-sm text-stone-500">Saved {formattedResultDate}</p>}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-700">
              {getProfileLabel(customer.measurementProfile)}
            </span>
            <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-700">
              {getScaleSourceLabel(customer)}
            </span>
            <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-700">
              {formatLength(getScaleHeightCm(customer))}
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getConfidenceBadgeClass(confidence.label)}`}>
              {confidence.label}
            </span>
            {isManual && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                Manual input
              </span>
            )}
            {customer.reviewStatus && (
              <span className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-semibold text-stone-700">
                {customer.reviewStatus}
              </span>
            )}
          </div>
        </div>
      </div>
      {isClientMode && (
        <div className="tiq-gold-border mt-5 rounded-lg border bg-amber-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-stone-950">Share with your tailor</p>
              <p className="mt-1 text-sm text-amber-900">
                Send a clean measurement summary without sharing the original photos.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:min-w-64">
              <button
                type="button"
                onClick={handleNativeShare}
                className="min-h-10 rounded-md bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800"
              >
                Share
              </button>
              <button
                type="button"
                onClick={handleCopyShareText}
                className="min-h-10 rounded-md border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
              >
                Copy
              </button>
            </div>
          </div>
          {shareStatus && <p className="mt-3 text-sm font-semibold text-amber-900">{shareStatus}</p>}
          <div className="mt-4 rounded-md border border-amber-200 bg-white p-3">
            <label className="text-xs font-semibold uppercase text-stone-500" htmlFor="tailor-username">
              Share to username
            </label>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                id="tailor-username"
                type="text"
                value={tailorUsername}
                onChange={(event) => setTailorUsername(event.target.value)}
                placeholder="tailor_username"
                className="min-h-10 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
              />
              <button
                type="button"
                onClick={handleUsernameShare}
                className="tiq-primary-action min-h-10 rounded-md px-4 text-sm font-semibold transition"
              >
                Send
              </button>
            </div>
            <label className="mt-3 flex items-start gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={includePhotos}
                onChange={(event) => setIncludePhotos(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-stone-300 accent-[#111111]"
              />
              <span>Include the front and side photos with this share.</span>
            </label>
            <p className="mt-2 text-xs leading-5 text-stone-500">
              Username sharing is saved on this device until online accounts are connected.
            </p>
          </div>
          <div className="mt-4 rounded-md border border-amber-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase text-stone-500">Preview</p>
            <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-6 text-stone-700">
              {shareText}
            </pre>
          </div>
        </div>
      )}

      {customer.segmentationWarnings?.length > 0 && (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-stone-950">Photo check notes</p>
          <div className="mt-2 grid gap-2">
            {customer.segmentationWarnings.map((warning) => (
              <p key={warning} className="text-sm text-amber-900">{warning}</p>
            ))}
          </div>
        </div>
      )}

      {customer.customerNote && (
        <div className="mt-5 rounded-lg border border-stone-200 bg-stone-50 p-4">
          <p className="text-sm font-semibold text-stone-950">Notes and preferences</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">{customer.customerNote}</p>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 border-t border-stone-200 pt-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-stone-950">Measurements</p>
          <p className="mt-1 text-sm text-stone-500">View the result visually or as a practical tailor list.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[auto_auto]">
          <div className="tiq-segmented grid grid-cols-2 overflow-hidden rounded-full p-0.5">
            {[
              { id: "guide", label: "Body guide" },
              { id: "list", label: "List" },
            ].map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => setResultView(view.id)}
                className={`min-h-10 rounded-full px-3 text-sm font-semibold transition ${
                  resultView === view.id ? "tiq-segmented-button-active" : "tiq-segmented-button"
                }`}
              >
                {view.label}
              </button>
            ))}
          </div>
          {resultView === "list" && (
            <div className="tiq-segmented grid grid-cols-2 overflow-hidden rounded-full p-0.5">
              {[
                { id: "cm", label: "cm" },
                { id: "in", label: "inches" },
              ].map((unit) => (
                <button
                  key={unit.id}
                  type="button"
                  onClick={() => setResultUnit(unit.id)}
                  className={`min-h-8 rounded-full px-2.5 text-xs font-semibold transition ${
                    resultUnit === unit.id ? "tiq-segmented-button-active" : "tiq-segmented-button"
                  }`}
                >
                  {unit.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {resultView === "guide" ? (
        <ResultBodyGuide
          measurements={customer.measurements}
          profileId={customer.measurementProfile}
          unit={resultUnit}
          onUnitChange={setResultUnit}
          selectedIndex={selectedMeasurementIndex}
          onSelect={setSelectedMeasurementIndex}
          title={isClientMode ? "My Measurements" : customer.fullname}
          resultDate={resultDate}
        />
      ) : (
        <div className="mt-5 space-y-5">
          {Object.entries(groupedMeasurements).map(([group, measurements]) => (
            <section key={group}>
              <h4 className="text-sm font-semibold text-stone-950">{group}</h4>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {measurements.map((measurement) => (
                  <div key={measurement.label} className="min-w-0 rounded-lg border border-stone-200 p-4">
                    <div className="grid gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-stone-950">{measurement.label}</p>
                        {getMeasurementNote(measurement.note) && (
                          <p className="mt-1 text-sm text-stone-500">{getMeasurementNote(measurement.note)}</p>
                        )}
                      </div>
                      <p className="break-words rounded-md bg-amber-50 px-3 py-2 text-base font-semibold text-amber-700">
                        {resultUnit === "cm" ? `${roundHalf(measurement.valueCm)} cm` : `${cmToInches(measurement.valueCm)} in`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {availablePhotoViews.length > 0 && (
        <div className="mt-5 rounded-lg border border-stone-200 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-stone-950">Photo previews</p>
              <p className="mt-1 text-sm text-stone-500">Preview is cropped around the person and the face is censored.</p>
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {availablePhotoViews.map((photo) => (
              <div key={photo.view} className="min-w-0 overflow-hidden rounded-md bg-stone-50">
                <div className="relative">
                  <img src={photo.preview} alt={`${photo.view} preview`} className="tiq-cutout-preview-bg h-64 w-full object-contain" />
                  {photo.isCensored && (
                    <span className="absolute left-3 top-3 rounded-full bg-black/75 px-3 py-1 text-xs font-semibold text-white">
                      Cropped preview
                    </span>
                  )}
                </div>
                <div className="p-3">
                <p className="text-sm font-medium text-stone-900">{photo.view}</p>
                  {photo.fileName && <p className="mt-1 break-words text-sm text-stone-500">{photo.fileName}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </section>
  );
}

function App() {
  const [authUsers, setAuthUsers] = useState(loadStoredUsers);
  const [authSession, setAuthSession] = useState(loadStoredSession);
  const [initialAuthLoading, setInitialAuthLoading] = useState(hasSupabaseConfig);
  const [theme, setTheme] = useState(loadStoredTheme);
  const [userMode, setUserMode] = useState(() => {
    const savedUser = authUsers.find((user) => user.username === authSession?.username);

    return savedUser?.mode || loadStoredAppMode();
  });
  const [activePage, setActivePage] = useState("dashboard");
  const [customers, setCustomers] = useState(loadStoredCustomers);
  const [styles, setStyles] = useState(loadStoredStyles);
  const [reminders, setReminders] = useState(loadStoredReminders);
  const [clientResult, setClientResult] = useState(loadStoredClientResult);
  const [sharedMeasurements, setSharedMeasurements] = useState(loadSharedMeasurements);
  const [processedCustomer, setProcessedCustomer] = useState(null);
  const [reviewDraft, setReviewDraft] = useState(null);
  const [measurementDrafts, setMeasurementDrafts] = useState(loadMeasurementDrafts);
  const [activeMeasurementDraftId, setActiveMeasurementDraftId] = useState(null);
  const [measurementEntryMode, setMeasurementEntryMode] = useState(null);
  const [deleteAction, setDeleteAction] = useState(null);
  const [activeReminderAlert, setActiveReminderAlert] = useState(null);
  const [draftStorageError, setDraftStorageError] = useState("");
  const cloudDraftIdsRef = useRef({});
  const cloudDraftPendingRef = useRef({});
  const cloudDraftQueuedRef = useRef({});
  const currentUser = authUsers.find((user) => (
    (authSession?.userId && user.id === authSession.userId) ||
    (authSession?.username && user.username === authSession.username)
  )) || null;
  const isClientMode = userMode === "client";
  const visibleCustomers = useMemo(
    () => customers.filter((customer) => getRecordMode(customer) === userMode),
    [customers, userMode]
  );
  const visibleStyles = useMemo(
    () => styles.filter((style) => (
      style.ownerUsername === currentUser?.username &&
      getRecordMode(style) === userMode
    )),
    [currentUser?.username, styles, userMode]
  );
  const visibleReminders = useMemo(
    () => reminders.filter((reminder) => (
      reminder.ownerUsername === currentUser?.username &&
      getRecordMode(reminder) === "tailor"
    )),
    [currentUser?.username, reminders]
  );
  const visibleMeasurementDrafts = useMemo(
    () => measurementDrafts.filter((draft) => getDraftMode(draft) === userMode),
    [measurementDrafts, userMode]
  );
  const activeMeasurementDraft = visibleMeasurementDrafts.find((draft) => draft.id === activeMeasurementDraftId) || null;

  useEffect(() => {
    let mounted = true;

    async function restoreSupabaseSession() {
      if (!supabase) {
        setInitialAuthLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.getSession();

      if (!mounted) {
        return;
      }

      if (error || !data.session?.user) {
        setInitialAuthLoading(false);
        return;
      }

      try {
        const profileUser = await fetchSupabaseProfile(data.session.user);

        if (!mounted) {
          return;
        }

        setAuthUsers((currentUsers) => mergeAuthUser(currentUsers, profileUser));
        setAuthSession({ userId: profileUser.id, username: profileUser.username });
        setUserMode(profileUser.mode || "");

        if (profileUser.mode === "tailor") {
          const cloudCustomers = await fetchSupabaseTailorRecords(profileUser);

          if (mounted) {
            setCustomers((currentCustomers) => mergeCloudCustomers(currentCustomers, cloudCustomers));
          }
        }

        const cloudDrafts = await fetchSupabaseMeasurementDrafts(profileUser);

        if (mounted) {
          setMeasurementDrafts((currentDrafts) => mergeCloudDrafts(currentDrafts, cloudDrafts));
        }

        const cloudStyles = await fetchSupabaseStyles(profileUser);

        if (mounted) {
          setStyles((currentStyles) => mergeCloudStyles(currentStyles, cloudStyles));
        }

        if (profileUser.mode === "tailor") {
          const cloudReminders = await fetchSupabaseReminders(profileUser);

          if (mounted) {
            setReminders((currentReminders) => mergeCloudReminders(currentReminders, cloudReminders));
          }
        }

        const cloudShares = await fetchSupabaseSharedMeasurements(profileUser);

        if (mounted) {
          setSharedMeasurements((currentShares) => mergeCloudSharedMeasurements(currentShares, cloudShares));
        }

        if (profileUser.mode === "client") {
          const cloudClientResult = await fetchSupabaseClientResult(profileUser);

          if (mounted && cloudClientResult) {
            setClientResult(cloudClientResult);
          }
        }
      } catch {
        // Fall back to the local auth screen if profile loading fails.
      } finally {
        if (mounted) {
          setInitialAuthLoading(false);
        }
      }
    }

    restoreSupabaseSession();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveStoredTheme(theme);
  }, [theme]);

  useEffect(() => {
    saveStoredUsers(authUsers);
  }, [authUsers]);

  useEffect(() => {
    saveStoredSession(authSession);
  }, [authSession]);

  useEffect(() => {
    saveStoredAppMode(userMode);
  }, [userMode]);

  useEffect(() => {
    saveStoredCustomers(customers);
  }, [customers]);

  useEffect(() => {
    saveStoredStyles(styles);
  }, [styles]);

  useEffect(() => {
    saveStoredReminders(reminders);
  }, [reminders]);

  useEffect(() => {
    saveStoredClientResult(clientResult);
  }, [clientResult]);

  useEffect(() => {
    saveSharedMeasurements(sharedMeasurements);
  }, [sharedMeasurements]);

  useEffect(() => {
    if (measurementDrafts.length > 0) {
      saveMeasurementDrafts(measurementDrafts);
    } else {
      deleteStoredMeasurementDrafts();
    }
  }, [measurementDrafts]);

  useEffect(() => {
    measurementDrafts.forEach((draft) => {
      if (draft.cloudDraftId) {
        cloudDraftIdsRef.current[draft.id] = draft.cloudDraftId;
      }
    });
  }, [measurementDrafts]);

  useEffect(() => {
    if (activePage === "review") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [activePage]);

  useEffect(() => {
    if (!currentUser || isClientMode || activeReminderAlert) {
      return undefined;
    }

    const checkDueReminders = () => {
      const now = new Date();
      const dueReminder = reminders
        .filter((reminder) => (
          reminder.ownerUsername === currentUser.username &&
          getRecordMode(reminder) === "tailor" &&
          reminder.status !== "done" &&
          !reminder.alertedAt
        ))
        .sort((firstReminder, secondReminder) => {
          const firstDate = getReminderDueDate(firstReminder)?.getTime() || Number.MAX_SAFE_INTEGER;
          const secondDate = getReminderDueDate(secondReminder)?.getTime() || Number.MAX_SAFE_INTEGER;

          return firstDate - secondDate;
        })
        .find((reminder) => {
          const dueDate = getReminderDueDate(reminder);

          return dueDate && dueDate <= now;
        });

      if (!dueReminder) {
        return;
      }

      setActiveReminderAlert(dueReminder);
      playReminderSound();
      saveSupabaseReminder({
        ...dueReminder,
        alertedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, currentUser).then((result) => {
        if (!result.ok) {
          setDraftStorageError(`Cloud reminder update failed: ${result.message}`);
        }
      });
      setReminders((currentReminders) => currentReminders.map((reminder) => (
        reminder.id === dueReminder.id
          ? { ...reminder, alertedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
          : reminder
      )));
    };

    checkDueReminders();
    const intervalId = window.setInterval(checkDueReminders, 15000);

    return () => window.clearInterval(intervalId);
  }, [activeReminderAlert, currentUser, isClientMode, reminders]);

  const handleSignup = async ({ fullName, email, username, password }) => {
    if (!hasSupabaseConfig || !supabase) {
      return { ok: false, message: getSupabaseConfigError() };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, message: "Enter a valid email address." };
    }

    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      return { ok: false, message: "Use 3-24 lowercase letters, numbers, or underscores for username." };
    }

    if (password.length < 6) {
      return { ok: false, message: "Password should be at least 6 characters." };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          username,
        },
      },
    });

    if (error) {
      return { ok: false, message: error.message };
    }

    if (!data.user) {
      return { ok: false, message: "Account could not be created. Try again." };
    }

    const profileRow = {
      id: data.user.id,
      full_name: fullName,
      email,
      username,
      mode: null,
      custom_shorthand: {},
      updated_at: new Date().toISOString(),
    };

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(profileRow, { onConflict: "id" });

    if (profileError) {
      if (profileError.message.toLowerCase().includes("duplicate")) {
        return { ok: false, message: "That username is already taken." };
      }

      return { ok: false, message: profileError.message };
    }

    const nextUser = mapProfileToUser(profileRow, data.user);

    setAuthUsers((currentUsers) => mergeAuthUser(currentUsers, nextUser));
    setAuthSession({ userId: nextUser.id, username: nextUser.username });
    setUserMode("");
    setActivePage("dashboard");
    return { ok: true };
  };

  const handleGoogleLogin = async () => {
    if (!hasSupabaseConfig || !supabase) {
      return { ok: false, message: getSupabaseConfigError() };
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      return { ok: false, message: error.message };
    }

    return { ok: true };
  };

  const handleLogin = async ({ identifier, password }) => {
    if (!hasSupabaseConfig || !supabase) {
      return { ok: false, message: getSupabaseConfigError() };
    }

    const loginId = identifier.trim().replace(/^@/, "").toLowerCase();
    let loginEmail = loginId;

    if (!loginId.includes("@")) {
      const { data: usernameEmail, error: usernameError } = await supabase
        .rpc("get_email_by_username", { login_username: loginId });

      if (usernameError || !usernameEmail) {
        return { ok: false, message: "Username or password is incorrect." };
      }

      loginEmail = usernameEmail;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    if (error || !data.user) {
      return { ok: false, message: "Email/username or password is incorrect." };
    }

    try {
      const profileUser = await fetchSupabaseProfile(data.user);

      setAuthUsers((currentUsers) => mergeAuthUser(currentUsers, profileUser));
      setAuthSession({ userId: profileUser.id, username: profileUser.username });
      setUserMode(profileUser.mode || "");

      if (profileUser.mode === "tailor") {
        const cloudCustomers = await fetchSupabaseTailorRecords(profileUser);
        setCustomers((currentCustomers) => mergeCloudCustomers(currentCustomers, cloudCustomers));
      }

      const cloudDrafts = await fetchSupabaseMeasurementDrafts(profileUser);
      setMeasurementDrafts((currentDrafts) => mergeCloudDrafts(currentDrafts, cloudDrafts));
      const cloudStyles = await fetchSupabaseStyles(profileUser);
      setStyles((currentStyles) => mergeCloudStyles(currentStyles, cloudStyles));

      if (profileUser.mode === "tailor") {
        const cloudReminders = await fetchSupabaseReminders(profileUser);
        setReminders((currentReminders) => mergeCloudReminders(currentReminders, cloudReminders));
      }

      const cloudShares = await fetchSupabaseSharedMeasurements(profileUser);
      setSharedMeasurements((currentShares) => mergeCloudSharedMeasurements(currentShares, cloudShares));

      if (profileUser.mode === "client") {
        const cloudClientResult = await fetchSupabaseClientResult(profileUser);

        if (cloudClientResult) {
          setClientResult(cloudClientResult);
        }
      }
    } catch (profileError) {
      return { ok: false, message: profileError.message || "Could not load your profile." };
    }

    setActivePage("dashboard");
    setProcessedCustomer(null);
    setReviewDraft(null);
    return { ok: true };
  };

  const handleCompleteProfile = async (username) => {
    if (!supabase || !currentUser?.id) {
      return { ok: false, message: "Your account session is not ready. Login again and retry." };
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !sessionData.session?.user) {
      return { ok: false, message: "Your account session expired. Login again and retry." };
    }

    const authUser = sessionData.session.user;
    const fullName = currentUser.fullName || authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email || "";
    const email = currentUser.email || authUser.email || "";
    const profileRow = {
      id: authUser.id,
      full_name: fullName,
      email,
      username,
      mode: currentUser.mode || null,
      custom_shorthand: currentUser.customShorthand || {},
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("profiles")
      .upsert(profileRow, { onConflict: "id" });

    if (error) {
      if (error.message.toLowerCase().includes("duplicate")) {
        return { ok: false, message: "That username is already taken." };
      }

      return { ok: false, message: error.message };
    }

    const nextUser = mapProfileToUser(profileRow, authUser);

    setAuthUsers((currentUsers) => mergeAuthUser(currentUsers, nextUser));
    setAuthSession({ userId: nextUser.id, username: nextUser.username });
    setUserMode(nextUser.mode || "");
    return { ok: true };
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }

    setAuthSession(null);
    setUserMode("");
    setActivePage("dashboard");
    setProcessedCustomer(null);
    setReviewDraft(null);
    setActiveMeasurementDraftId(null);
    setMeasurementEntryMode(null);
  };

  const handleToggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  };

  const navigateTo = (page) => {
    if (isClientMode && ["customers", "reminders"].includes(page)) {
      setActivePage("dashboard");
      return;
    }

    setActivePage(page);

    if (page === "new") {
      setActiveMeasurementDraftId(null);
      setMeasurementEntryMode(null);
    }

    if (page !== "results") {
      setProcessedCustomer(null);
    }

    if (page !== "review") {
      setReviewDraft(null);
    }
  };

  const handleViewMeasurement = (customer) => {
    setProcessedCustomer(customer);
    setActivePage("results");
  };

  const handleViewSharedMeasurement = (share) => {
    if (!share?.customer) {
      return;
    }

    setProcessedCustomer({
      ...share.customer,
      sharedByClient: true,
      shareIncludesPhotos: share.includePhotos,
      sharedToUsername: share.tailorUsername,
    });
    setActivePage("results");
  };

  const handleShareToTailor = async ({ tailorUsername, includePhotos, customer }) => {
    const cloudResult = await saveSupabaseSharedMeasurement({ tailorUsername, includePhotos, customer }, currentUser);

    if (!cloudResult.ok) {
      return cloudResult;
    }

    setSharedMeasurements((currentShares) => [cloudResult.share, ...currentShares]);
    return { ok: true };
  };

  const handleViewClientResult = () => {
    if (!clientResult) {
      return;
    }

    setProcessedCustomer(clientResult);
    setActivePage("results");
  };

  const handleEditCustomer = (customer) => {
    setReviewDraft({ ...customer, editMode: "saved-record" });
    setProcessedCustomer(null);
    setActivePage("review");
  };

  const handleDeleteCustomer = (customer) => {
    setDeleteAction({
      type: "customer",
      customer,
      title: "Delete customer record?",
      message: `Delete ${customer.fullname}'s record? This cannot be undone.`,
    });
  };

  const syncDraftToCloud = useCallback((draft) => {
    if (!currentUser?.id || !draft) {
      return;
    }

    const localDraftId = draft.id;
    const cloudDraftId = draft.cloudDraftId || cloudDraftIdsRef.current[localDraftId];
    const draftToSave = cloudDraftId ? { ...draft, cloudDraftId } : draft;

    if (cloudDraftPendingRef.current[localDraftId]) {
      cloudDraftQueuedRef.current[localDraftId] = draftToSave;
      return;
    }

    cloudDraftPendingRef.current[localDraftId] = true;

    saveSupabaseMeasurementDraft(draftToSave, currentUser).then((result) => {
      cloudDraftPendingRef.current[localDraftId] = false;

      if (!result.ok) {
        setDraftStorageError(`Cloud draft save failed: ${result.message}`);
        return;
      }

      cloudDraftIdsRef.current[localDraftId] = result.draft.cloudDraftId;
      setMeasurementDrafts((currentDrafts) => currentDrafts.map((currentDraft) => (
        currentDraft.id === draft.id ? { ...currentDraft, cloudDraftId: result.draft.cloudDraftId } : currentDraft
      )));

      const queuedDraft = cloudDraftQueuedRef.current[localDraftId];

      if (queuedDraft) {
        delete cloudDraftQueuedRef.current[localDraftId];
        syncDraftToCloud({ ...queuedDraft, cloudDraftId: result.draft.cloudDraftId });
      }
    });
  }, [currentUser]);

  const confirmDeleteCustomer = async (customer) => {
    const cloudResult = await deleteSupabaseTailorRecord(customer, currentUser);

    if (!cloudResult.ok) {
      setDraftStorageError(`Cloud delete failed: ${cloudResult.message}`);
      return false;
    }

    setCustomers((currentCustomers) => currentCustomers.filter((currentCustomer) => currentCustomer.id !== customer.id));

    if (processedCustomer?.id === customer.id) {
      setProcessedCustomer(null);
      setActivePage("customers");
    }

    if (reviewDraft?.id === customer.id) {
      setReviewDraft(null);
      setActivePage("customers");
    }

    return true;
  };

  const handleCustomerSubmit = async (customerData) => {
    const { segmentationImages, ...recordData } = customerData;
    const localMeasurements = processMeasurements(recordData);
    const backendResult = await requestSegmentationMeasurements({
      ...recordData,
      segmentationImages,
    });
    const measurements = buildBackendMeasurements(recordData, backendResult, localMeasurements);

    const reviewDraftId = `review-${Date.now()}-${Math.round(Math.random() * 100000)}`;
    const draftCustomer = {
      ...recordData,
      id: Date.now(),
      draftStorageId: reviewDraftId,
      status: "Awaiting tailor review",
      appMode: userMode,
      measurements,
      generatedBy: "backend-segmentation",
      segmentationConfidence: backendResult?.confidence,
      segmentationWarnings: backendResult?.warnings || [],
      segmentationDebug: backendResult?.debug,
      pipeline: [
        ...(recordData.pipeline || []),
        "Measurement preparation",
      ],
    };

    setReviewDraft(draftCustomer);
    setMeasurementDrafts((currentDrafts) => {
      const captureDraftId = activeMeasurementDraftId || recordData.captureDraftId;
      const filteredDrafts = captureDraftId
        ? currentDrafts.filter((draft) => draft.id !== captureDraftId)
        : currentDrafts;
      const reviewDraft = normalizeDraft({
        id: reviewDraftId,
        appMode: userMode,
        stage: "review",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reviewCustomer: draftCustomer,
        reviewState: null,
      });
      const nextDrafts = [reviewDraft, ...filteredDrafts];

      syncDraftToCloud(reviewDraft);

      if (!saveMeasurementDrafts(nextDrafts)) {
        setDraftStorageError("Draft could not be saved because browser storage is full. Delete older drafts and try again.");
      }

      return nextDrafts;
    });
    setActiveMeasurementDraftId(reviewDraftId);
    setActivePage("review");
  };

  const handleMeasurementDraftChange = useCallback((draft) => {
    setMeasurementDrafts((currentDrafts) => {
      const draftId = draft.id || activeMeasurementDraftId || Date.now();
      const existingDraft = currentDrafts.find((currentDraft) => currentDraft.id === draftId);
      const nextDraft = normalizeDraft({
        ...draft,
        id: draftId,
        appMode: draft.appMode || existingDraft?.appMode || userMode,
        createdAt: existingDraft?.createdAt || draft.createdAt,
      });

      const nextDrafts = existingDraft
        ? currentDrafts.map((currentDraft) => (currentDraft.id === draftId ? nextDraft : currentDraft))
        : [nextDraft, ...currentDrafts];

      if (!saveMeasurementDrafts(nextDrafts)) {
        setDraftStorageError("Draft could not be saved because browser storage is full. Retake photos or delete older drafts.");
      }

      syncDraftToCloud(nextDraft);

      return nextDrafts;
    });
  }, [activeMeasurementDraftId, syncDraftToCloud, userMode]);

  const handleDeleteMeasurementDraft = (draft) => {
    const draftName = draft.stage === "review"
      ? draft.reviewCustomer?.fullname?.trim()
      : draft.values?.fullname?.trim();

    setDeleteAction({
      type: "measurement-draft",
      draftId: draft.id,
      draft,
      title: "Delete unsaved draft?",
      message: `Delete ${draftName || "this unsaved measurement draft"}? This cannot be undone.`,
    });
  };

  const handleClearMeasurementDraft = useCallback((draftId) => {
    const draftIdToClear = draftId || activeMeasurementDraftId;

    if (!draftIdToClear) {
      return;
    }

    const draftToClear = measurementDrafts.find((draft) => draft.id === draftIdToClear);

    if (draftToClear) {
      deleteSupabaseMeasurementDraft(draftToClear, currentUser).then((result) => {
        if (!result.ok) {
          setDraftStorageError(`Cloud draft delete failed: ${result.message}`);
        }
      });
    }

    setMeasurementDrafts((currentDrafts) => currentDrafts.filter((draft) => draft.id !== draftIdToClear));
    if (activeMeasurementDraftId === draftIdToClear) {
      setActiveMeasurementDraftId(null);
    }
    setDraftStorageError("");
  }, [activeMeasurementDraftId, currentUser, measurementDrafts]);

  const handleReviewSave = async (reviewedCustomer) => {
    let savedCustomer = { ...reviewedCustomer, appMode: reviewedCustomer.appMode || userMode };

    delete savedCustomer.editMode;

    if (!isClientMode) {
      const cloudResult = await saveSupabaseTailorRecord(savedCustomer, currentUser);

      if (!cloudResult.ok) {
        setDraftStorageError(`Cloud save failed: ${cloudResult.message}`);
        return;
      }

      savedCustomer = cloudResult.customer;
      setCustomers((currentCustomers) => {
        const existingCustomer = currentCustomers.some((customer) => (
          customer.id === savedCustomer.id ||
          (savedCustomer.cloudCustomerId && customer.cloudCustomerId === savedCustomer.cloudCustomerId)
        ));

        if (existingCustomer) {
          return currentCustomers.map((customer) => (
            customer.id === savedCustomer.id ||
            (savedCustomer.cloudCustomerId && customer.cloudCustomerId === savedCustomer.cloudCustomerId)
              ? savedCustomer
              : customer
          ));
        }

        return [savedCustomer, ...currentCustomers];
      });
    } else {
      const cloudResult = await saveSupabaseClientResult(savedCustomer, currentUser);

      if (!cloudResult.ok) {
        setDraftStorageError(`Cloud client result save failed: ${cloudResult.message}`);
        return;
      }

      savedCustomer = cloudResult.customer;
      setClientResult(savedCustomer);
    }
    setProcessedCustomer(savedCustomer);
    setReviewDraft(null);
    if (activeMeasurementDraftId) {
      setMeasurementDrafts((currentDrafts) => currentDrafts.filter((draft) => draft.id !== activeMeasurementDraftId));
      setActiveMeasurementDraftId(null);
    }
    setActivePage("results");
  };

  const handleManualSave = async (manualData) => {
    const customer = {
      ...manualData,
      appMode: "tailor",
      id: Date.now(),
    };
    const cloudResult = await saveSupabaseTailorRecord(customer, currentUser);

    if (!cloudResult.ok) {
      setDraftStorageError(`Cloud save failed: ${cloudResult.message}`);
      return;
    }

    const savedCustomer = cloudResult.customer;

    setCustomers((currentCustomers) => [savedCustomer, ...currentCustomers]);
    setProcessedCustomer(savedCustomer);
    setActivePage("results");
  };

  const handleSaveStyle = async (styleData) => {
    const nextStyle = {
      ...styleData,
      id: `style-${Date.now()}-${Math.round(Math.random() * 100000)}`,
      ownerUsername: currentUser?.username,
      appMode: userMode,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const cloudResult = await saveSupabaseStyle(nextStyle, currentUser);

    if (!cloudResult.ok) {
      setDraftStorageError(`Cloud style save failed: ${cloudResult.message}`);
      return false;
    }

    setStyles((currentStyles) => [cloudResult.style, ...currentStyles]);
    return true;
  };

  const handleDeleteStyle = (style) => {
    setDeleteAction({
      type: "style",
      style,
      title: "Delete saved style?",
      message: `Delete "${style.title || "Untitled style"}" from your style library? This cannot be undone.`,
    });
  };

  const handleSaveReminder = async (reminderData) => {
    const linkedCustomer = visibleCustomers.find((customer) => String(customer.id) === String(reminderData.customerId));
    const nextReminder = {
      id: `reminder-${Date.now()}-${Math.round(Math.random() * 100000)}`,
      ownerUsername: currentUser?.username,
      appMode: "tailor",
      customerId: reminderData.customerId || "",
      cloudCustomerId: linkedCustomer?.cloudCustomerId,
      customerName: reminderData.customerName || "",
      type: reminderData.type,
      title: reminderData.title.trim(),
      dueAt: reminderData.dueAt,
      note: reminderData.note.trim(),
      status: "open",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const cloudResult = await saveSupabaseReminder(nextReminder, currentUser);

    if (!cloudResult.ok) {
      setDraftStorageError(`Cloud reminder save failed: ${cloudResult.message}`);
      return false;
    }

    setReminders((currentReminders) => [cloudResult.reminder, ...currentReminders]);
    return true;
  };

  const handleUpdateReminder = async (reminderId, updates) => {
    const existingReminder = reminders.find((reminder) => reminder.id === reminderId);

    if (!existingReminder) {
      return false;
    }

    const nextReminder = {
      ...existingReminder,
      ...updates,
      alertedAt: updates.dueAt || updates.status === "open" ? null : existingReminder.alertedAt,
      updatedAt: new Date().toISOString(),
    };
    const cloudResult = await saveSupabaseReminder(nextReminder, currentUser);

    if (!cloudResult.ok) {
      setDraftStorageError(`Cloud reminder update failed: ${cloudResult.message}`);
      return false;
    }

    setReminders((currentReminders) => currentReminders.map((reminder) => (
      reminder.id === reminderId ? cloudResult.reminder : reminder
    )));
    return true;
  };

  const handleDeleteReminder = (reminder) => {
    setDeleteAction({
      type: "reminder",
      reminder,
      title: "Delete reminder?",
      message: `Delete "${reminder.title || reminder.type}"? This cannot be undone.`,
    });
  };

  const handleViewReminderCustomer = (customerId) => {
    const linkedCustomer = visibleCustomers.find((customer) => (
      String(customer.id) === String(customerId) ||
      String(customer.cloudCustomerId) === String(customerId)
    ));

    if (linkedCustomer) {
      handleViewMeasurement(linkedCustomer);
    }
  };

  const handleCloseReminderAlert = () => {
    setActiveReminderAlert(null);
  };

  const handleMarkReminderAlertDone = async () => {
    if (!activeReminderAlert) {
      return;
    }

    await handleUpdateReminder(activeReminderAlert.id, {
      status: "done",
      completedAt: new Date().toISOString(),
    });
    setActiveReminderAlert(null);
  };

  const handleSnoozeReminderAlert = async () => {
    if (!activeReminderAlert) {
      return;
    }

    const snoozeDate = new Date();
    snoozeDate.setMinutes(snoozeDate.getMinutes() + 10);
    await handleUpdateReminder(activeReminderAlert.id, {
      dueAt: snoozeDate.toISOString(),
      status: "open",
    });
    setActiveReminderAlert(null);
  };

  const handleOpenReminderAlert = () => {
    setActiveReminderAlert(null);
    setActivePage("reminders");
  };

  const handleSaveCustomShorthand = async (customShorthand) => {
    if (!currentUser) {
      return;
    }

    setAuthUsers((currentUsers) => currentUsers.map((user) => (
      user.username === currentUser.username ? { ...user, customShorthand } : user
    )));

    if (supabase && currentUser.id) {
      await supabase
        .from("profiles")
        .update({
          custom_shorthand: customShorthand,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentUser.id);
    }
  };

  const handleConfirmDelete = async () => {
    if (deleteAction?.type === "customer" && deleteAction.customer) {
      const deleted = await confirmDeleteCustomer(deleteAction.customer);

      if (!deleted) {
        return;
      }
    }

    if (deleteAction?.type === "measurement-draft") {
      const draftToDelete = deleteAction.draft || measurementDrafts.find((draft) => draft.id === deleteAction.draftId);
      const cloudResult = await deleteSupabaseMeasurementDraft(draftToDelete, currentUser);

      if (!cloudResult.ok) {
        setDraftStorageError(`Cloud draft delete failed: ${cloudResult.message}`);
        return;
      }

      setMeasurementDrafts((currentDrafts) => currentDrafts.filter((draft) => draft.id !== deleteAction.draftId));

      if (activeMeasurementDraftId === deleteAction.draftId) {
        setActiveMeasurementDraftId(null);
      }
    }

    if (deleteAction?.type === "style" && deleteAction.style) {
      const cloudResult = await deleteSupabaseStyle(deleteAction.style, currentUser);

      if (!cloudResult.ok) {
        setDraftStorageError(`Cloud style delete failed: ${cloudResult.message}`);
        return;
      }

      setStyles((currentStyles) => currentStyles.filter((style) => style.id !== deleteAction.style.id));
    }

    if (deleteAction?.type === "reminder" && deleteAction.reminder) {
      const cloudResult = await deleteSupabaseReminder(deleteAction.reminder, currentUser);

      if (!cloudResult.ok) {
        setDraftStorageError(`Cloud reminder delete failed: ${cloudResult.message}`);
        return;
      }

      setReminders((currentReminders) => currentReminders.filter((reminder) => reminder.id !== deleteAction.reminder.id));
    }

    setDeleteAction(null);
  };

  const handleContinueDraft = (draft) => {
    setActiveMeasurementDraftId(draft.id);

    if (draft.stage === "review") {
      setReviewDraft({
        ...draft.reviewCustomer,
        draftStorageId: draft.id,
        reviewState: draft.reviewState,
      });
      setActivePage("review");
      return;
    }

    setMeasurementEntryMode("photo");
    setActivePage("new");
  };

  const handleStartNewMeasurement = () => {
    setActiveMeasurementDraftId(null);
    setMeasurementEntryMode(null);
    setActivePage("new");
  };

  const handleSelectMode = async (mode) => {
    setUserMode(mode);
    if (currentUser) {
      setAuthUsers((currentUsers) => currentUsers.map((user) => (
        user.username === currentUser.username ? { ...user, mode } : user
      )));

      if (supabase && currentUser.id) {
        await supabase
          .from("profiles")
          .update({
            mode,
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentUser.id);
      }

      if (mode === "tailor") {
        try {
          const cloudCustomers = await fetchSupabaseTailorRecords({ id: currentUser.id });
          setCustomers((currentCustomers) => mergeCloudCustomers(currentCustomers, cloudCustomers));
        } catch {
          // Local records stay available if cloud records cannot load.
        }
      }

      try {
        const cloudDrafts = await fetchSupabaseMeasurementDrafts({ id: currentUser.id });
        setMeasurementDrafts((currentDrafts) => mergeCloudDrafts(currentDrafts, cloudDrafts));
      } catch {
        // Local drafts stay available if cloud drafts cannot load.
      }

      try {
        const cloudStyles = await fetchSupabaseStyles(currentUser);
        setStyles((currentStyles) => mergeCloudStyles(currentStyles, cloudStyles));
      } catch {
        // Local styles stay available if cloud styles cannot load.
      }

      if (mode === "tailor") {
        try {
          const cloudReminders = await fetchSupabaseReminders(currentUser);
          setReminders((currentReminders) => mergeCloudReminders(currentReminders, cloudReminders));
        } catch {
          // Local reminders stay available if cloud reminders cannot load.
        }
      }

      try {
        const cloudShares = await fetchSupabaseSharedMeasurements(currentUser);
        setSharedMeasurements((currentShares) => mergeCloudSharedMeasurements(currentShares, cloudShares));
      } catch {
        // Local shared measurements stay available if cloud sharing cannot load.
      }

      if (mode === "client") {
        try {
          const cloudClientResult = await fetchSupabaseClientResult(currentUser);

          if (cloudClientResult) {
            setClientResult(cloudClientResult);
          }
        } catch {
          // Local client result stays available if cloud result cannot load.
        }
      }
    }
    setActivePage("dashboard");
    setProcessedCustomer(null);
    setReviewDraft(null);
    setActiveMeasurementDraftId(null);
    setMeasurementEntryMode(null);
  };

  const handleChangeMode = async () => {
    setUserMode("");
    if (currentUser) {
      setAuthUsers((currentUsers) => currentUsers.map((user) => (
        user.username === currentUser.username ? { ...user, mode: "" } : user
      )));

      if (supabase && currentUser.id) {
        await supabase
          .from("profiles")
          .update({
            mode: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentUser.id);
      }
    }
    setActivePage("dashboard");
    setProcessedCustomer(null);
    setReviewDraft(null);
    setActiveMeasurementDraftId(null);
    setMeasurementEntryMode(null);
  };

  if (initialAuthLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-stone-100 px-4 text-stone-900">
        <div className="rounded-xl border border-stone-200 bg-white p-6 text-center shadow-sm">
          <TailorIQWordmark />
          <p className="mt-4 text-sm font-semibold text-stone-600">Connecting your workspace...</p>
        </div>
      </main>
    );
  }

  if (!currentUser) {
    return <AuthPage onGoogleLogin={handleGoogleLogin} onLogin={handleLogin} onSignup={handleSignup} />;
  }

  if (currentUser.needsUsername) {
    return (
      <CompleteProfile
        currentUser={currentUser}
        onComplete={handleCompleteProfile}
        onLogout={handleLogout}
      />
    );
  }

  if (!userMode) {
    return (
      <ModeOnboarding
        currentUser={currentUser}
        onLogout={handleLogout}
        onSelectMode={handleSelectMode}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 md:flex">
      <Sidebar
        activePage={activePage}
        currentUser={currentUser}
        onChangeMode={handleChangeMode}
        onLogout={handleLogout}
        onNavigate={navigateTo}
        onToggleTheme={handleToggleTheme}
        theme={theme}
        userMode={userMode}
      />

      <main className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 md:pb-6 lg:px-10">
        {draftStorageError && (
          <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {draftStorageError}
          </div>
        )}

        {activePage === "dashboard" && (
          isClientMode ? (
            <ClientHome
              draftCount={visibleMeasurementDrafts.length}
              latestResult={clientResult || processedCustomer}
              onStartMeasurement={handleStartNewMeasurement}
              onViewDrafts={() => navigateTo("drafts")}
              onViewResult={handleViewClientResult}
            />
          ) : (
            <Dashboard
              customers={visibleCustomers}
              draftCount={visibleMeasurementDrafts.length}
              reminders={visibleReminders}
              receivedShares={sharedMeasurements.filter((share) => (
                share.receiverUserId === currentUser.id ||
                share.tailorUsername === currentUser.username
              ))}
              onNewMeasurement={handleStartNewMeasurement}
              onViewDrafts={() => navigateTo("drafts")}
              onViewMeasurement={handleViewMeasurement}
              onViewSharedMeasurement={handleViewSharedMeasurement}
              onViewReminders={() => navigateTo("reminders")}
            />
          )
        )}

        {!isClientMode && activePage === "customers" && (
          <Customers
            customers={visibleCustomers}
            onBack={() => navigateTo("dashboard")}
            onViewMeasurement={handleViewMeasurement}
            onDeleteCustomer={handleDeleteCustomer}
          />
        )}

        {activePage === "styles" && (
          <StyleLibrary
            styles={visibleStyles}
            userMode={userMode}
            onSaveStyle={handleSaveStyle}
            onDeleteStyle={handleDeleteStyle}
          />
        )}

        {!isClientMode && activePage === "reminders" && (
          <Reminders
            reminders={visibleReminders}
            customers={visibleCustomers}
            onSaveReminder={handleSaveReminder}
            onUpdateReminder={handleUpdateReminder}
            onDeleteReminder={handleDeleteReminder}
            onViewCustomer={handleViewReminderCustomer}
          />
        )}

        {activePage === "drafts" && (
          <Drafts
            drafts={visibleMeasurementDrafts}
            onBack={() => navigateTo("dashboard")}
            onContinueDraft={handleContinueDraft}
            onDeleteDraft={handleDeleteMeasurementDraft}
            onStartNew={handleStartNewMeasurement}
          />
        )}

        {activePage === "new" && (
          <div className="mx-auto max-w-6xl">
            {!isClientMode && !activeMeasurementDraft && !measurementEntryMode && (
              <NewMeasurementChoice
                onBack={() => navigateTo("dashboard")}
                onChooseManual={() => setMeasurementEntryMode("manual-choice")}
                onChoosePhoto={() => setMeasurementEntryMode("photo")}
              />
            )}
            {!isClientMode && measurementEntryMode === "manual-choice" && (
              <ManualInputChoice
                onBack={() => setMeasurementEntryMode(null)}
                onChooseImport={() => setMeasurementEntryMode("manual-import")}
                onChooseTyping={() => setMeasurementEntryMode("manual-typing")}
              />
            )}
            {(isClientMode || activeMeasurementDraft || measurementEntryMode === "photo") && (
              <Form
                key={activeMeasurementDraftId || "new-measurement"}
                appMode={userMode}
                currentUser={currentUser}
                initialDraft={activeMeasurementDraft}
                onBack={() => {
                  if (!isClientMode && !activeMeasurementDraft && measurementEntryMode === "photo") {
                    setMeasurementEntryMode(null);
                    return;
                  }

                  navigateTo("dashboard");
                }}
                onDraftChange={handleMeasurementDraftChange}
                onSubmitCustomer={handleCustomerSubmit}
                profileOptions={profileOptions}
              />
            )}
            {!isClientMode && ["manual-typing", "manual-import"].includes(measurementEntryMode) && (
              <ManualMeasurementForm
                importMode={measurementEntryMode === "manual-import"}
                customShorthand={currentUser?.customShorthand}
                onBack={() => setMeasurementEntryMode("manual-choice")}
                onSaveManual={handleManualSave}
              />
            )}
          </div>
        )}

        {activePage === "review" && (
          <MeasurementReview
            draftCustomer={reviewDraft}
            onSaveReview={handleReviewSave}
            onDraftChange={handleMeasurementDraftChange}
            onClearDraft={handleClearMeasurementDraft}
            onCancel={() => {
              setReviewDraft(null);
              if (reviewDraft?.editMode === "saved-record") {
                setActivePage("customers");
                return;
              }

              setActiveMeasurementDraftId(null);
              setActivePage(isClientMode ? "dashboard" : "drafts");
            }}
          />
        )}

        {activePage === "results" && (
          <MeasurementResults
            customer={processedCustomer}
            onBack={() => navigateTo(isClientMode || processedCustomer?.sharedByClient ? "dashboard" : "customers")}
            onEdit={handleEditCustomer}
            onDelete={handleDeleteCustomer}
            onShareToTailor={handleShareToTailor}
            userMode={userMode}
          />
        )}

        {secondaryNavItems.some((item) => item.id === activePage) && (
          <SecondaryPage
            page={activePage}
            userMode={userMode}
            currentUser={currentUser}
            customerCount={visibleCustomers.length}
            draftCount={visibleMeasurementDrafts.length}
            onChangeMode={handleChangeMode}
            onSaveCustomShorthand={handleSaveCustomShorthand}
          />
        )}
      </main>

      <ConfirmDeleteModal
        action={deleteAction}
        onCancel={() => setDeleteAction(null)}
        onConfirm={handleConfirmDelete}
      />
      <ReminderAlertModal
        reminder={activeReminderAlert}
        onClose={handleCloseReminderAlert}
        onMarkDone={handleMarkReminderAlertDone}
        onOpenReminders={handleOpenReminderAlert}
        onSnooze={handleSnoozeReminderAlert}
      />
    </div>
  );
}

export default App;



