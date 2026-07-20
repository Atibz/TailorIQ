import React, { useCallback, useEffect, useState } from "react";
import Form from "./components/Form";
import MeasurementGuide from "./components/MeasurementGuide";
import resultGuideFemale from "./assets/images/result-guide-female-cutout.png";
import resultGuideMale from "./assets/images/result-guide-male-cutout.png";
import { preventNumberInputWheel } from "./components/measurement/constants";
import { requestSegmentationMeasurements } from "./services/segmentationMeasurementApi";
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
  { id: "drafts", label: "Drafts", icon: "M5 3h10l4 4v14H5V3Zm9 1.5V8h3.5L14 4.5ZM8 11h8v2H8v-2Zm0 4h8v2H8v-2Z" },
];

const clientNavItems = [
  { id: "dashboard", label: "Home", icon: "M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-11h6V4h-6v5Z" },
  { id: "new", label: "Measure me", icon: "M5 4h14v2H5V4Zm0 4h14v2H5V8Zm0 4h9v2H5v-2Zm0 4h6v2H5v-2Zm12-4h2v3h3v2h-3v3h-2v-3h-3v-2h3v-3Z" },
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
const CLIENT_RESULT_STORAGE_KEY = "tailoriq_client_latest_result";
const SHARED_MEASUREMENT_STORAGE_KEY = "tailoriq_shared_measurements";
const MEASUREMENT_DRAFT_STORAGE_KEY = "tailoriq_measurement_drafts";
const LEGACY_MEASUREMENT_DRAFT_STORAGE_KEY = "tailoriq_measurement_draft";
const APP_MODE_STORAGE_KEY = "tailoriq_app_mode";
const AUTH_USERS_STORAGE_KEY = "tailoriq_auth_users";
const AUTH_SESSION_STORAGE_KEY = "tailoriq_auth_session";
const APP_THEME_STORAGE_KEY = "tailoriq_theme";

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

function normalizeDraft(draft) {
  return {
    ...draft,
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
    return { score, label: "High confidence", note: "Front and side photos include a usable scale anchor." };
  }

  if (score >= 68) {
    return { score, label: "Good confidence", note: "Photos improve the estimate, but a clearer scale anchor helps." };
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

function AuthPage({ onLogin, onSignup }) {
  const [authMode, setAuthMode] = useState("login");
  const [authPanelOpen, setAuthPanelOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formValues, setFormValues] = useState({
    fullName: "",
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
  const handleSubmit = (event) => {
    event.preventDefault();
    const username = formValues.username.trim().replace(/^@/, "").toLowerCase();
    const password = formValues.password;

    if (!username || !password || (isSignup && !formValues.fullName.trim())) {
      setAuthError(isSignup ? "Enter your name, username, and password." : "Enter your username and password.");
      return;
    }

    const result = isSignup
      ? onSignup({ fullName: formValues.fullName.trim(), username, password })
      : onLogin({ username, password });

    if (!result.ok) {
      setAuthError(result.message);
      return;
    }

    setFormValues({ fullName: "", username: "", password: "" });
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
                )}
                <label className="text-sm font-semibold text-stone-800">
                  Email / Username
                  <input
                    type="text"
                    name="username"
                    value={formValues.username}
                    onChange={handleChange}
                    className="mt-2 min-h-11 w-full rounded-full border border-stone-200 bg-stone-100 px-4 text-sm font-medium outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
                    placeholder="email or username"
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
                      <span className="text-xs font-bold">{showPassword ? "Hide" : "View"}</span>
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
                type="submit"
                className="mt-7 min-h-12 w-full rounded-full bg-[#111111] px-5 text-sm font-bold text-[#ff9f00] transition hover:bg-black"
              >
                {isSignup ? "Sign up" : "Login"}
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
              {isSignup ? "Choose a username people can use to share measurements with you." : "Use your saved username to continue."}
            </p>
          </div>

          <div className="mt-5 grid gap-4">
            {isSignup && (
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
            )}
            <label className="text-sm font-semibold text-stone-800">
              Email / Username
              <input
                type="text"
                name="username"
                value={formValues.username}
                onChange={handleChange}
                className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm font-medium outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
                placeholder="email or username"
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
                >
                  {showPassword ? "Hide" : "View"}
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
            type="submit"
            className="tiq-primary-action mt-5 min-h-11 w-full rounded-md px-5 text-sm font-semibold transition"
          >
            {isSignup ? "Create account" : "Login"}
          </button>

          <p className="mt-4 text-xs leading-5 text-stone-500">
            Prototype note: accounts are saved on this device for now. Cloud login will replace this before production.
          </p>
        </form>
      </section>
    </main>
  );
}

function ModeOnboarding({ currentUser, onLogout, onSelectMode, theme, onToggleTheme }) {
  return (
    <main className="min-h-screen bg-stone-100 px-4 py-8 text-stone-900 sm:px-6">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col justify-center">
        <div className="max-w-2xl">
          <TailorIQWordmark />
          <h1 className="mt-3 text-3xl font-semibold text-stone-950 sm:text-4xl">Choose how you want to use the app</h1>
          <p className="mt-3 text-stone-600">
            Tailor mode is for managing customer records. Client mode is for measuring yourself privately and sharing the result with a tailor.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-xl border border-stone-200 bg-white/90 p-4 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#111111] text-sm font-bold text-[#ff9f00]">
              {(currentUser?.fullName || currentUser?.username || "U").trim().charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-stone-950">
                {currentUser?.fullName || "Signed in"}
              </p>
              <p className="truncate text-xs font-medium text-stone-500">@{currentUser?.username}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeSwitch theme={theme} onToggle={onToggleTheme} compact />
            <button
              type="button"
              onClick={onLogout}
              className="min-h-10 rounded-full border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => onSelectMode("tailor")}
            className="rounded-lg border border-amber-300 bg-white p-5 text-left shadow-sm transition hover:border-amber-500 hover:bg-amber-50"
          >
            <span className="tiq-gold-badge inline-flex rounded-md px-3 py-1 text-xs font-bold uppercase">Tailor mode</span>
            <h2 className="mt-4 text-xl font-semibold text-stone-950">Manage client measurements</h2>
            <p className="mt-2 text-sm text-stone-600">
              Use customer records, manual input, drafts, review screens, and saved measurement history.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onSelectMode("client")}
            className="rounded-lg border border-stone-200 bg-white p-5 text-left shadow-sm transition hover:border-amber-500 hover:bg-amber-50"
          >
            <span className="inline-flex rounded-md bg-[#FF9F00]/30 px-3 py-1 text-xs font-bold uppercase text-[#111111]">Client mode</span>
            <h2 className="mt-4 text-xl font-semibold text-stone-950">Measure yourself privately</h2>
            <p className="mt-2 text-sm text-stone-600">
              Generate your own result sheet, review it, and copy a tailor-friendly summary when you are ready to share.
            </p>
          </button>
        </div>
      </section>
    </main>
  );
}

function Sidebar({ activePage, currentUser, onNavigate, userMode, onChangeMode, onLogout, theme, onToggleTheme }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const visibleNavItems = userMode === "client" ? clientNavItems : navItems;
  const activeItem =
    visibleNavItems.find((item) => item.id === activePage) ||
    secondaryNavItems.find((item) => item.id === activePage) ||
    visibleNavItems[0];
  const secondaryActive = secondaryNavItems.some((item) => item.id === activePage);
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
        {secondaryNavItems.map((item) => {
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
      <div className="fixed inset-0 z-50 bg-stone-950/50 px-4 pb-24 pt-10 md:hidden">
        <button
          type="button"
          className="absolute inset-0 h-full w-full cursor-default"
          onClick={() => setMoreOpen(false)}
          aria-label="Close more navigation"
        />
        <div className="relative mt-auto rounded-lg bg-white p-4 shadow-xl">
          <div className="flex items-center justify-between gap-3 border-b border-stone-100 pb-3">
            <div>
              <p className="text-sm font-semibold text-stone-950">More</p>
              <p className="text-xs text-stone-500">{currentUser ? `@${currentUser.username}` : userMode === "client" ? "Client mode" : "Tailor mode"}</p>
            </div>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              className="h-10 w-10 rounded-md border border-stone-200 text-sm font-bold text-stone-600"
              aria-label="Close"
            >
              x
            </button>
          </div>
          <div className="mt-3 grid gap-2">
            {secondaryNavItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className="flex min-h-12 items-center gap-3 rounded-md px-3 text-left text-sm font-semibold text-stone-800 transition hover:bg-stone-50"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current text-stone-500">
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
              className="mt-2 min-h-12 rounded-md border border-stone-300 px-3 text-left text-sm font-semibold text-stone-700"
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
              className="mt-2 min-h-12 rounded-md border border-stone-300 px-3 text-left text-sm font-semibold text-stone-700"
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

function Dashboard({ customers, draftCount, receivedShares = [], onNewMeasurement, onViewDrafts, onViewMeasurement, onViewSharedMeasurement }) {
  const savedCustomers = customers.filter((customer) => customer.measurements);
  const stats = [
    { label: "Drafts", value: draftCount },
    { label: "Saved records", value: savedCustomers.length },
    { label: "Received", value: receivedShares.length },
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

      <section>
        <h3 className="text-lg font-semibold text-stone-950">What you can share</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {["Measurement values", "Fit notes", "Confidence details"].map((item) => (
            <div key={item} className="rounded-md bg-stone-50 p-3">
              <p className="text-sm font-semibold text-stone-950">{item}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-stone-600">
          Customer records and manual input are hidden in Client Mode so the app stays focused on your own measurement result.
        </p>
      </section>
    </div>
  );
}

function SecondaryPage({ page, userMode, customerCount, draftCount, onChangeMode }) {
  const pageContent = {
    profile: {
      eyebrow: "Profile",
      title: "App profile",
      body: userMode === "client"
        ? "You are using Client Mode. This keeps the app focused on measuring yourself and sharing only the result you choose."
        : "You are using Tailor Mode. This gives you customer records, drafts, manual input, and reviewed measurement history.",
      details: [
        `Current mode: ${userMode === "client" ? "Client Mode" : "Tailor Mode"}`,
        `Saved customer records: ${customerCount}`,
        `Unfinished drafts: ${draftCount}`,
      ],
    },
    help: {
      eyebrow: "Help",
      title: "Capture and measurement help",
      body: "For best results, wear fitted clothing, stand straight, keep the full body visible, and capture both front and side photos in good lighting.",
      details: [
        "Use known height when available.",
        "Retake photos when feet, head, or side profile are unclear.",
        "Review generated values before saving or sharing.",
      ],
    },
    privacy: {
      eyebrow: "Privacy",
      title: "Privacy policy",
      body: "This prototype stores records and drafts in this browser unless you share or export them. Photos are used for measurement processing and should be handled carefully before production release.",
      details: [
        "Client Mode keeps self-measurement results separate from tailor customer records.",
        "Do not share photos or measurement results without consent.",
        "Before public launch, move storage and privacy controls into a proper backend policy.",
      ],
    },
    about: {
      eyebrow: "About",
      title: "About TailorIQ",
      body: "TailorIQ helps generate draft body measurements from guided photos, then lets users review, correct, save, or share the result.",
      details: [
        "Photo-assisted measurement engine",
        "Tailor and client modes",
        "Built for measurement review, not blind automation",
      ],
    },
  };
  const content = pageContent[page] || pageContent.profile;

  return (
    <section className="mx-auto max-w-4xl">
      <h2 className="text-3xl font-semibold text-stone-950">{content.title}</h2>
      <p className="mt-3 text-stone-600">{content.body}</p>

      <div className="mt-6 grid gap-3">
        {content.details.map((detail) => (
          <div key={detail} className="rounded-md bg-stone-50 p-4 text-sm font-medium text-stone-800">
            {detail}
          </div>
        ))}
      </div>

      {page === "profile" && (
        <button
          type="button"
          onClick={onChangeMode}
          className="mt-6 min-h-11 rounded-md bg-stone-950 px-5 text-sm font-semibold text-white transition hover:bg-stone-800"
        >
          Change mode
        </button>
      )}
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
            Capture or upload photos, run backend segmentation, then review the generated measurements.
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

function ManualMeasurementForm({ onBack, onSaveManual }) {
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
  const [openSections, setOpenSections] = useState({});
  const activeProfile = getProfile(values.measurementProfile);
  const toggleSection = (sectionTitle) => {
    setOpenSections((currentSections) => ({
      ...currentSections,
      [sectionTitle]: !(currentSections[sectionTitle] ?? true),
    }));
  };

  const handleChange = (event) => {
    setValues({ ...values, [event.target.name]: event.target.value });
    setError("");
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
    <section className="mx-auto max-w-6xl">
      <div className="space-y-4 border-b border-stone-100 pb-5">
        <BackButton onClick={onBack} label="Back to dashboard" />
        <div>
          <h2 className="text-2xl font-semibold text-stone-950">Enter measurements manually</h2>
          <p className="mt-2 text-sm text-stone-500">
            Save measurements taken outside the app. The customer record will be marked as manual input.
          </p>
        </div>
      </div>

      <form className="mt-5 space-y-5" onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
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
          <label className="text-sm font-medium text-stone-700" htmlFor="manual-profile">
            Gender*
          </label>
          <select
            className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
            id="manual-profile"
            name="measurementProfile"
            value={values.measurementProfile}
            onChange={handleChange}
          >
            {profileOptions.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.label}
              </option>
            ))}
          </select>
        </div>

        <MeasurementGuide profileId={values.measurementProfile} />

        <div className="overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
          <div className="sticky top-0 z-10 flex flex-col gap-2 border-b border-stone-200 bg-stone-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-stone-950">{activeProfile.label} measurement sheet</p>
              <p className="mt-1 text-sm text-stone-500">{activeProfile.description}</p>
            </div>
            <select
              className="min-h-10 rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
              name="measurementUnit"
              value={values.measurementUnit}
              onChange={handleChange}
              aria-label="Measurement unit"
            >
              <option value="cm">Centimeters</option>
              <option value="in">Inches</option>
            </select>
          </div>

          <div className="space-y-4 p-4">
            {activeProfile.sections.map((section) => {
              const isOpen = openSections[section.title] ?? true;

              return (
                <section key={section.title} className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.title)}
                    className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-stone-50"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-stone-950">{section.title}</span>
                      <span className="mt-1 block text-sm text-stone-500">{section.description}</span>
                    </span>
                    <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-600">
                      {isOpen ? "Hide" : "Show"}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="grid gap-4 border-t border-stone-100 p-4 sm:grid-cols-2 lg:grid-cols-3">
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

        <div className="flex justify-end border-t border-stone-100 pt-5">
          <button
            type="submit"
            className="min-h-11 rounded-md bg-amber-600 px-5 text-sm font-semibold text-white transition hover:bg-amber-700"
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

  const handleSave = () => {
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

    onSaveReview({
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
          <p className="text-sm font-semibold text-stone-950">Segmentation warnings</p>
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

function ResultBodyGuide({ measurements, profileId, unit, onUnitChange, selectedIndex, onSelect, title, resultDate }) {
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
    <div className="tiq-result-surface -mx-4 mt-5 overflow-hidden border text-stone-950 shadow-lg sm:-mx-6 lg:-mx-10">
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
          <div className="absolute inset-x-4 bottom-4 z-40 rounded-lg border border-[#FF9F00]/40 bg-[#111111]/95 p-4 text-white shadow-2xl backdrop-blur sm:inset-x-8 sm:bottom-6">
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
  const [photoPreviewMode, setPhotoPreviewMode] = useState("silhouette");

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
      preview: customer.photoPreviews?.front,
      silhouette: customer.photoSilhouettes?.front,
      fileName: customer.photoViews?.find((photo) => photo.view === "Front view")?.fileName,
    },
    {
      view: "Side view",
      preview: customer.photoPreviews?.side,
      silhouette: customer.photoSilhouettes?.side,
      fileName: customer.photoViews?.find((photo) => photo.view === "Side view")?.fileName,
    },
  ].filter((photo) => Boolean(photo.preview));
  const hasPhotoSilhouettes = availablePhotoViews.some((photo) => Boolean(photo.silhouette));
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
  const handleUsernameShare = () => {
    const username = tailorUsername.trim().replace(/^@/, "");

    if (!username) {
      setShareStatus("Enter the tailor username first.");
      return;
    }

    onShareToTailor?.({
      tailorUsername: username,
      includePhotos,
      customer,
    });
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
              Prototype note: username sharing is saved locally until cloud accounts are connected.
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
          <p className="text-sm font-semibold text-stone-950">Segmentation warnings</p>
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
              <p className="mt-1 text-sm text-stone-500">Silhouette mode hides the original background, clothing details, and face details.</p>
            </div>
            {hasPhotoSilhouettes && (
              <div className="tiq-segmented grid grid-cols-2 overflow-hidden rounded-full p-0.5">
                {[
                  { id: "silhouette", label: "Silhouette" },
                  { id: "original", label: "Original" },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setPhotoPreviewMode(mode.id)}
                    className={`min-h-8 rounded-full px-3 text-xs font-semibold transition ${
                      photoPreviewMode === mode.id ? "tiq-segmented-button-active" : "tiq-segmented-button"
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {availablePhotoViews.map((photo) => {
              const displayPreview = photoPreviewMode === "silhouette" ? photo.silhouette || photo.preview : photo.preview;

              return (
                <div key={photo.view} className="min-w-0 overflow-hidden rounded-md bg-stone-50">
                  <div className="relative">
                    <img src={displayPreview} alt={`${photo.view} preview`} className="h-64 w-full object-cover object-top" />
                    {photoPreviewMode === "silhouette" && photo.silhouette && (
                      <span className="absolute left-3 top-3 rounded-full bg-black/75 px-3 py-1 text-xs font-semibold text-white">
                        Privacy silhouette
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                  <p className="text-sm font-medium text-stone-900">{photo.view}</p>
                    {photo.fileName && <p className="mt-1 break-words text-sm text-stone-500">{photo.fileName}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </section>
  );
}

function App() {
  const [authUsers, setAuthUsers] = useState(loadStoredUsers);
  const [authSession, setAuthSession] = useState(loadStoredSession);
  const [theme, setTheme] = useState(loadStoredTheme);
  const [userMode, setUserMode] = useState(() => {
    const savedUser = authUsers.find((user) => user.username === authSession?.username);

    return savedUser?.mode || loadStoredAppMode();
  });
  const [activePage, setActivePage] = useState("dashboard");
  const [customers, setCustomers] = useState(loadStoredCustomers);
  const [clientResult, setClientResult] = useState(loadStoredClientResult);
  const [sharedMeasurements, setSharedMeasurements] = useState(loadSharedMeasurements);
  const [processedCustomer, setProcessedCustomer] = useState(null);
  const [reviewDraft, setReviewDraft] = useState(null);
  const [measurementDrafts, setMeasurementDrafts] = useState(loadMeasurementDrafts);
  const [activeMeasurementDraftId, setActiveMeasurementDraftId] = useState(null);
  const [measurementEntryMode, setMeasurementEntryMode] = useState(null);
  const [deleteAction, setDeleteAction] = useState(null);
  const [draftStorageError, setDraftStorageError] = useState("");
  const activeMeasurementDraft = measurementDrafts.find((draft) => draft.id === activeMeasurementDraftId) || null;
  const currentUser = authUsers.find((user) => user.username === authSession?.username) || null;
  const isClientMode = userMode === "client";

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
    if (activePage === "review") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [activePage]);

  const handleSignup = ({ fullName, username, password }) => {
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      return { ok: false, message: "Use 3-24 lowercase letters, numbers, or underscores for username." };
    }

    if (password.length < 6) {
      return { ok: false, message: "Password should be at least 6 characters." };
    }

    if (authUsers.some((user) => user.username === username)) {
      return { ok: false, message: "That username is already taken." };
    }

    const nextUser = {
      id: `user-${Date.now()}-${Math.round(Math.random() * 100000)}`,
      fullName,
      username,
      password,
      mode: "",
      createdAt: new Date().toISOString(),
    };

    setAuthUsers((currentUsers) => [nextUser, ...currentUsers]);
    setAuthSession({ username });
    setUserMode("");
    setActivePage("dashboard");
    return { ok: true };
  };

  const handleLogin = ({ username, password }) => {
    const matchingUser = authUsers.find((user) => user.username === username && user.password === password);

    if (!matchingUser) {
      return { ok: false, message: "Username or password is incorrect." };
    }

    setAuthSession({ username });
    setUserMode(matchingUser.mode || "");
    setActivePage("dashboard");
    setProcessedCustomer(null);
    setReviewDraft(null);
    return { ok: true };
  };

  const handleLogout = () => {
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
    if (isClientMode && ["customers"].includes(page)) {
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

  const handleShareToTailor = ({ tailorUsername, includePhotos, customer }) => {
    const customerToShare = {
      ...customer,
      photoPreviews: includePhotos ? customer.photoPreviews : undefined,
    };

    setSharedMeasurements((currentShares) => [
      {
        id: `share-${Date.now()}-${Math.round(Math.random() * 100000)}`,
        tailorUsername,
        includePhotos,
        customer: customerToShare,
        createdAt: new Date().toISOString(),
      },
      ...currentShares,
    ]);
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

  const confirmDeleteCustomer = (customer) => {
    setCustomers((currentCustomers) => currentCustomers.filter((currentCustomer) => currentCustomer.id !== customer.id));

    if (processedCustomer?.id === customer.id) {
      setProcessedCustomer(null);
      setActivePage("customers");
    }

    if (reviewDraft?.id === customer.id) {
      setReviewDraft(null);
      setActivePage("customers");
    }
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
        "Backend segmentation",
      ],
    };

    setReviewDraft(draftCustomer);
    setMeasurementDrafts((currentDrafts) => {
      const filteredDrafts = activeMeasurementDraftId
        ? currentDrafts.filter((draft) => draft.id !== activeMeasurementDraftId)
        : currentDrafts;
      const reviewDraft = normalizeDraft({
        id: reviewDraftId,
        stage: "review",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reviewCustomer: draftCustomer,
        reviewState: null,
      });
      const nextDrafts = [reviewDraft, ...filteredDrafts];

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
        createdAt: existingDraft?.createdAt || draft.createdAt,
      });

      if (!activeMeasurementDraftId) {
        setActiveMeasurementDraftId(draftId);
      }

      const nextDrafts = existingDraft
        ? currentDrafts.map((currentDraft) => (currentDraft.id === draftId ? nextDraft : currentDraft))
        : [nextDraft, ...currentDrafts];

      if (!saveMeasurementDrafts(nextDrafts)) {
        setDraftStorageError("Draft could not be saved because browser storage is full. Retake photos or delete older drafts.");
      }

      return nextDrafts;
    });
  }, [activeMeasurementDraftId]);

  const handleDeleteMeasurementDraft = (draft) => {
    const draftName = draft.stage === "review"
      ? draft.reviewCustomer?.fullname?.trim()
      : draft.values?.fullname?.trim();

    setDeleteAction({
      type: "measurement-draft",
      draftId: draft.id,
      title: "Delete unsaved draft?",
      message: `Delete ${draftName || "this unsaved measurement draft"}? This cannot be undone.`,
    });
  };

  const handleClearMeasurementDraft = useCallback((draftId) => {
    const draftIdToClear = draftId || activeMeasurementDraftId;

    if (!draftIdToClear) {
      return;
    }

    setMeasurementDrafts((currentDrafts) => currentDrafts.filter((draft) => draft.id !== draftIdToClear));
    if (activeMeasurementDraftId === draftIdToClear) {
      setActiveMeasurementDraftId(null);
    }
    setDraftStorageError("");
  }, [activeMeasurementDraftId]);

  const handleReviewSave = (reviewedCustomer) => {
    const savedCustomer = { ...reviewedCustomer };

    delete savedCustomer.editMode;

    if (!isClientMode) {
      setCustomers((currentCustomers) => {
        const existingCustomer = currentCustomers.some((customer) => customer.id === savedCustomer.id);

        if (existingCustomer) {
          return currentCustomers.map((customer) => (customer.id === savedCustomer.id ? savedCustomer : customer));
        }

        return [savedCustomer, ...currentCustomers];
      });
    } else {
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

  const handleManualSave = (manualData) => {
    const customer = {
      ...manualData,
      id: Date.now(),
    };

    setCustomers((currentCustomers) => [customer, ...currentCustomers]);
    setProcessedCustomer(customer);
    setActivePage("results");
  };

  const handleConfirmDelete = () => {
    if (deleteAction?.type === "customer" && deleteAction.customer) {
      confirmDeleteCustomer(deleteAction.customer);
    }

    if (deleteAction?.type === "measurement-draft") {
      setMeasurementDrafts((currentDrafts) => currentDrafts.filter((draft) => draft.id !== deleteAction.draftId));

      if (activeMeasurementDraftId === deleteAction.draftId) {
        setActiveMeasurementDraftId(null);
      }
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

  const handleSelectMode = (mode) => {
    setUserMode(mode);
    if (currentUser) {
      setAuthUsers((currentUsers) => currentUsers.map((user) => (
        user.username === currentUser.username ? { ...user, mode } : user
      )));
    }
    setActivePage("dashboard");
    setProcessedCustomer(null);
    setReviewDraft(null);
    setActiveMeasurementDraftId(null);
    setMeasurementEntryMode(null);
  };

  const handleChangeMode = () => {
    setUserMode("");
    if (currentUser) {
      setAuthUsers((currentUsers) => currentUsers.map((user) => (
        user.username === currentUser.username ? { ...user, mode: "" } : user
      )));
    }
    setActivePage("dashboard");
    setProcessedCustomer(null);
    setReviewDraft(null);
    setActiveMeasurementDraftId(null);
    setMeasurementEntryMode(null);
  };

  if (!currentUser) {
    return <AuthPage onLogin={handleLogin} onSignup={handleSignup} />;
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
              draftCount={measurementDrafts.length}
              latestResult={clientResult || processedCustomer}
              onStartMeasurement={handleStartNewMeasurement}
              onViewDrafts={() => navigateTo("drafts")}
              onViewResult={handleViewClientResult}
            />
          ) : (
            <Dashboard
              customers={customers}
              draftCount={measurementDrafts.length}
              receivedShares={sharedMeasurements.filter((share) => share.tailorUsername === currentUser.username)}
              onNewMeasurement={handleStartNewMeasurement}
              onViewDrafts={() => navigateTo("drafts")}
              onViewMeasurement={handleViewMeasurement}
              onViewSharedMeasurement={handleViewSharedMeasurement}
            />
          )
        )}

        {!isClientMode && activePage === "customers" && (
          <Customers
            customers={customers}
            onBack={() => navigateTo("dashboard")}
            onViewMeasurement={handleViewMeasurement}
            onDeleteCustomer={handleDeleteCustomer}
          />
        )}

        {activePage === "drafts" && (
          <Drafts
            drafts={measurementDrafts}
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
                onChooseManual={() => setMeasurementEntryMode("manual")}
                onChoosePhoto={() => setMeasurementEntryMode("photo")}
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
            {!isClientMode && measurementEntryMode === "manual" && (
              <ManualMeasurementForm
                onBack={() => setMeasurementEntryMode(null)}
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
            customerCount={customers.length}
            draftCount={measurementDrafts.length}
            onChangeMode={handleChangeMode}
          />
        )}
      </main>

      <ConfirmDeleteModal
        action={deleteAction}
        onCancel={() => setDeleteAction(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

export default App;



