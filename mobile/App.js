import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  Vibration,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import * as Speech from "expo-speech";
import {
  ArrowLeft,
  BookOpen,
  Camera,
  ChevronRight,
  Ruler,
  ScanText,
  Trash2,
  Upload,
  User,
  Users,
} from "lucide-react-native";

import { buildMeasurementList, getProfileFields, roundMeasurement } from "./src/constants/measurementFields";
import {
  canUsePlanFeature,
  getUpgradeMessage,
  getRecordLimit,
  getUserPlan,
  selfCaptureSetupSteps,
  styleCategories,
} from "./src/constants/appConfig";
import { IconGlyph, PhotoSourceTile, RecordActionButton } from "./src/components/ActionTiles";
import { AppHeader, AppShell, BrandMark, OfflineNotice } from "./src/components/AppLayout";
import { ConfirmationModal } from "./src/components/ConfirmationModal";
import { PlanUsageMeter } from "./src/components/PlanUsageMeter";
import { DraftsScreen } from "./src/screens/DraftsScreen";
import { HomeScreen, ModeScreen, PasswordResetScreen } from "./src/screens/MainScreens";
import { MoreScreen } from "./src/screens/MoreScreen";
import { PlansScreen } from "./src/screens/PlansScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { ReminderFormScreen, ReminderListScreen, RemindersHomeScreen } from "./src/screens/RemindersScreens";
import { AboutScreen, HelpScreen, PrivacyScreen } from "./src/screens/StaticInfoScreens";
import { StyleDetailScreen, StyleFormScreen, StyleGalleryScreen, StylesHomeScreen } from "./src/screens/StylesScreens";
import { palette } from "./src/theme";
import {
  buildManualMeasurementList,
  cmToInches,
  findGuideMark,
  fromDisplayMeasurementValue,
  getMeasurementSummary,
  groupMeasurements,
  isVisibleMeasurement,
  toDisplayMeasurementValue,
} from "./src/utils/measurementDisplay";
import {
  findReminderCustomerMatch,
  formatShortDate,
  getRecordCustomerName,
  getRecordInitials,
  hasPhotoReference,
  hasUsablePhoto,
  mergeStyleCategories,
} from "./src/utils/customerRecords";
import {
  cleanPhotoMessage,
  cleanPhotoWarnings,
  getCameraVoiceInstruction,
  getLiveCaptureResult,
  getLiveCaptureVoiceInstruction,
} from "./src/utils/captureFeedback";
import { validateCapturedPhoto } from "./src/services/captureValidationApi";
import { requestMobileMeasurements } from "./src/services/measurementApi";
import { deleteMobileReminder, fetchMobileReminders, saveMobileReminder } from "./src/services/reminderApi";
import {
  attachMobileStyleToCustomer,
  createMobileStyleCategoryShare,
  deleteMobileStyle,
  detachMobileStyleFromCustomer,
  fetchMobileStyleCategories,
  fetchMobileStyles,
  saveMobileStyleCategory,
  saveMobileStyle,
} from "./src/services/styleApi";
import { deleteMobileAccount } from "./src/services/accountApi";
import {
  cancelReminderNotification,
  requestReminderNotificationPermission,
  scheduleReminderNotification,
  scheduleReminderNotifications,
} from "./src/services/notificationApi";
import {
  deleteMobileMeasurement,
  deleteMobileMeasurementDraft,
  fetchMobileMeasurements,
  fetchMobileMeasurementDrafts,
  fetchMobileSharedMeasurements,
  saveMobileMeasurement,
  saveMobileMeasurementDraft,
  shareMobileMeasurementToUsername,
} from "./src/services/measurementSaveApi";
import { getSupabaseConfigError, hasSupabaseConfig, supabase, supabaseUrl } from "./src/services/supabaseClient";

const resultGuideMale = require("./assets/result-guide-male-cutout.png");
const resultGuideFemale = require("./assets/result-guide-female-cutout.png");
const captureStandingGuide = require("./assets/capture-standing-guide.png");
const captureFemaleStandingGuide = require("./assets/capture-guide-female-standing.png");
const authBackgroundImage = require("./assets/auth-background.png");

const amber = palette.amber;
const black = palette.black;
const softGold = palette.softGold;
const GOOGLE_AUTH_REDIRECT_URL = "tailoriq://auth/callback";
const APP_THEME_STORAGE_KEY = "tailoriq_mobile_theme";
const isRunningInExpoGo = Constants.appOwnership === "expo";
let activeLightMode = false;

function createLocalDraftId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildPhotoReadyCheck(view, message = "Photo ready for analysis.") {
  return {
    ok: true,
    engine: "final-measurement-analysis",
    view,
    message,
    warnings: [],
    metrics: null,
    checkedAt: new Date().toISOString(),
  };
}

function normalizeUsername(value) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function formatMeasurementShareText(record) {
  const name = record?.fullname || "My measurement";
  const profileLabel = record?.measurementProfile === "female" ? "Female" : "Male";
  const measurements = record?.measurements || [];
  const dateLabel = record?.updatedAt
    ? new Date(record.updatedAt).toLocaleDateString()
    : new Date().toLocaleDateString();

  const lines = measurements
    .filter((measurement) => measurement?.label && measurement?.valueCm !== "")
    .map((measurement) => `${measurement.label}: ${cmToInches(measurement.valueCm)} in`);

  return [
    "TailorIQ measurement summary",
    `Name: ${name}`,
    `Profile: ${profileLabel}`,
    `Date: ${dateLabel}`,
    "",
    ...lines,
    "",
    "Measure smart. Fit perfect.",
  ].join("\n");
}

function heightInputToCm(value, unit = "cm") {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return NaN;
  }

  if (unit === "in") {
    return roundMeasurement(numericValue * 2.54);
  }

  if (unit === "ft") {
    return roundMeasurement(numericValue * 30.48);
  }

  return roundMeasurement(numericValue);
}

function getHeightPlaceholder(unit = "cm") {
  if (unit === "in") {
    return "Height in inches";
  }

  if (unit === "ft") {
    return "Height in feet";
  }

  return "Height in cm";
}

function isPositiveStatus(message = "") {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("saved") ||
    normalizedMessage.includes("imported") ||
    normalizedMessage.includes("sent to") ||
    normalizedMessage.includes("deleted") ||
    normalizedMessage.includes("updated")
  );
}

function isManualImportStatus(message = "") {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("paste") ||
    normalizedMessage.includes("recognized") ||
    normalizedMessage.includes("import") ||
    normalizedMessage.includes("could mean") ||
    normalizedMessage.includes("saved as")
  );
}

function isManualSaveStatus(message = "") {
  return Boolean(message) && !isManualImportStatus(message);
}

const GUIDE_WIDTH = 170;
const GUIDE_HEIGHT = 368;

function guideX(value) {
  return (Number(value) / 100) * GUIDE_WIDTH;
}

function guideY(value) {
  return (Number(value) / 216) * GUIDE_HEIGHT;
}

function guideHeight(value) {
  return (Number(value) / 216) * GUIDE_HEIGHT;
}

function getCircumferenceMarkerHeight(mark) {
  if (["neck", "wrist", "ankle"].includes(mark.key)) {
    return guideHeight(3.6);
  }

  if (["bicep", "thigh", "knee"].includes(mark.key)) {
    return guideHeight(4.4);
  }

  if (["seat", "hip", "highHip"].includes(mark.key)) {
    return guideHeight(6.8);
  }

  return guideHeight(5.6);
}

function GuideMarker({ mark }) {
  if (!mark) {
    return null;
  }

  if (mark.type === "horizontal") {
    const left = guideX(mark.x1);
    const top = guideY(mark.y);
    const width = guideX(mark.x2) - left;
    const markerHeight = getCircumferenceMarkerHeight(mark);

    return mark.marker === "circumference" ? (
      <View
        pointerEvents="none"
        style={[
          styles.guideCircumferenceMarker,
          {
            left,
            top: top - markerHeight / 2,
            width,
            height: markerHeight,
          },
        ]}
      />
    ) : (
      <View pointerEvents="none" style={[styles.guideLineMarker, { left, top, width }]} />
    );
  }

  if (mark.type === "vertical") {
    const left = guideX(mark.x);
    const top = guideY(mark.y1);
    const height = guideY(mark.y2) - top;

    return <View pointerEvents="none" style={[styles.guideVerticalMarker, { left, top, height }]} />;
  }

  if (mark.type === "diagonal") {
    const x1 = guideX(mark.x1);
    const y1 = guideY(mark.y1);
    const x2 = guideX(mark.x2);
    const y2 = guideY(mark.y2);
    const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const angle = `${Math.atan2(y2 - y1, x2 - x1)}rad`;
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;

    return (
      <View
        pointerEvents="none"
        style={[
          styles.guideLineMarker,
          {
            left: centerX - length / 2,
            top: centerY - 1,
            width: length,
            transform: [{ rotate: angle }],
          },
        ]}
      />
    );
  }

  if (mark.type === "curve") {
    return (
      <View
        pointerEvents="none"
        style={[
          styles.guideCurveMarker,
          {
            left: guideX(mark.cx) - 8,
            top: guideY(mark.cy) - 22,
          },
        ]}
      />
    );
  }

  return null;
}

function ResultBodyGuide({ profileId, selectedMeasurement }) {
  const mark = findGuideMark(profileId, selectedMeasurement);
  const guideImage = profileId === "female" ? resultGuideFemale : resultGuideMale;

  return (
    <View style={[styles.resultGuidePanel, activeLightMode && styles.resultGuidePanelLight]}>
      <View style={[styles.resultGuideVisual, activeLightMode && styles.resultGuideVisualLight]}>
        <View style={styles.guideBodyWrap}>
          <View pointerEvents="none" style={styles.guideFallbackBody}>
            <View style={styles.guideHead} />
            <View style={styles.guideNeck} />
            <View style={styles.guideTorso} />
            <View style={styles.guideHip} />
            <View style={styles.guideLeftArm} />
            <View style={styles.guideRightArm} />
            <View style={styles.guideLeftLeg} />
            <View style={styles.guideRightLeg} />
            <View style={styles.guideLeftFoot} />
            <View style={styles.guideRightFoot} />
          </View>
          <Image source={guideImage} style={styles.guideBodyImage} resizeMode="contain" />
          <GuideMarker mark={mark} />
        </View>
      </View>
      <View style={styles.resultGuideCopy}>
        <Text style={[styles.resultGuideLabel, activeLightMode && styles.resultGuideLabelLight]}>{mark?.label || selectedMeasurement?.label || "Measurement guide"}</Text>
        <Text style={[styles.resultGuideInstruction, activeLightMode && styles.resultGuideInstructionLight]}>{mark?.instruction || "Tap any measurement to see where it belongs on the body."}</Text>
      </View>
    </View>
  );
}

function ResultControls({ viewMode, unit, onChangeViewMode, onChangeUnit }) {
  return (
    <View style={[styles.resultControlPanel, activeLightMode && styles.resultControlPanelLight]}>
      <View style={[styles.resultControlGroup, activeLightMode && styles.resultControlGroupLight]}>
        {["guide", "list"].map((mode) => (
          <Pressable
            key={mode}
            onPress={() => onChangeViewMode(mode)}
            style={[
              styles.resultControlButton,
              viewMode === mode && styles.resultControlButtonActive,
              activeLightMode && viewMode !== mode && styles.resultControlButtonLight,
            ]}
          >
            <Text
              style={[
                styles.resultControlText,
                activeLightMode && viewMode !== mode && styles.resultControlTextLight,
                viewMode === mode && styles.resultControlTextActive,
              ]}
            >
              {mode === "guide" ? "Body guide" : "List"}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={[styles.resultControlGroup, activeLightMode && styles.resultControlGroupLight]}>
        {["cm", "in"].map((nextUnit) => (
          <Pressable
            key={nextUnit}
            onPress={() => onChangeUnit(nextUnit)}
            style={[
              styles.resultUnitToggle,
              unit === nextUnit && styles.resultControlButtonActive,
              activeLightMode && unit !== nextUnit && styles.resultControlButtonLight,
            ]}
          >
            <Text
              style={[
                styles.resultControlText,
                activeLightMode && unit !== nextUnit && styles.resultControlTextLight,
                unit === nextUnit && styles.resultControlTextActive,
              ]}
            >
              {nextUnit === "in" ? "In" : "Cm"}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ResultGuidePicker({ measurements, selectedIndex, onSelect }) {
  const visibleMeasurements = measurements
    .map((measurement, index) => ({ measurement, index }))
    .filter(({ measurement }) => isVisibleMeasurement(measurement));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.resultGuideChipRow}
    >
      {visibleMeasurements.map(({ measurement, index }) => (
        <Pressable
          key={`${measurement.group}-${measurement.fieldKey}-${index}`}
          onPress={() => onSelect(index)}
          style={[
            styles.resultGuideChip,
            selectedIndex === index && styles.resultGuideChipActive,
            activeLightMode && selectedIndex !== index && styles.resultGuideChipLight,
          ]}
        >
          <Text
            style={[
              styles.resultGuideChipText,
              activeLightMode && selectedIndex !== index && styles.resultGuideChipTextLight,
              selectedIndex === index && styles.resultGuideChipTextActive,
            ]}
          >
            {measurement.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const builtInShorthand = {
  common: {
    n: "neck",
    nk: "neck",
    sh: "shoulder",
    ah: "armhole",
    arm: "armhole",
    sl: "sleeve",
    sleeve: "sleeve",
    rs: "bicep",
    round_sleeve: "bicep",
    cuff: "wrist",
    wr: "wrist",
    tl: "topLength",
    top: "topLength",
    th: "thigh",
    kn: "knee",
    knee: "knee",
    an: "ankle",
    ankle: "ankle",
    in: "inseam",
    inseam: "inseam",
    rise: "rise",
    height: "height",
    hgt: "height",
    name: "customerName",
    customer: "customerName",
  },
  male: {
    c: "chest",
    ch: "chest",
    chest: "chest",
    st: "stomach",
    stomach: "stomach",
    w: "waist",
    waist: "waist",
    seat: "seat",
    hp: "seat",
    hip: "seat",
    out: "trouserLength",
    os: "trouserLength",
    trouser: "trouserLength",
    trouser_length: "trouserLength",
  },
  female: {
    bust: "bust",
    bu: "bust",
    ub: "underbust",
    underbust: "underbust",
    w: "waist",
    waist: "waist",
    wb: "waistBand",
    waistband: "waistBand",
    hh: "highHip",
    high_hip: "highHip",
    hp: "hip",
    hip: "hip",
    full_hip: "hip",
    bp: "bustPoint",
    bust_point: "bustPoint",
    bs: "bustSpan",
    bust_span: "bustSpan",
    fl: "frontLength",
    front_length: "frontLength",
    bl: "backLength",
    back_length: "backLength",
    wth: "waistToHip",
    waist_to_hip: "waistToHip",
    ll: "lowerLength",
    lower_length: "lowerLength",
    skirt: "lowerLength",
  },
};

const ambiguousShorthand = {
  male: {
    b: ["bicep"],
  },
  female: {
    b: ["bust", "bicep"],
    h: ["height", "hip", "highHip"],
  },
};

function normalizeImportLabel(value = "") {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getManualImportMap(profileId, customShorthand = {}) {
  const importMap = new Map();
  const fields = getProfileFields(profileId);

  fields.forEach((field) => {
    const targets = [field.key, field.valueKey].filter(Boolean);

    [field.label, field.key, field.valueKey].filter(Boolean).forEach((alias) => {
      importMap.set(normalizeImportLabel(alias), [...new Set(targets)]);
    });
  });

  Object.entries({
    ...builtInShorthand.common,
    ...(builtInShorthand[profileId] || {}),
  }).forEach(([alias, target]) => {
    importMap.set(normalizeImportLabel(alias), [target]);
  });

  Object.entries(ambiguousShorthand[profileId] || {}).forEach(([alias, targets]) => {
    importMap.set(normalizeImportLabel(alias), targets);
  });

  Object.entries(customShorthand || {}).forEach(([alias, target]) => {
    importMap.set(normalizeImportLabel(alias), [target]);
  });

  return importMap;
}

function getManualFieldLabel(profileId, targetKey) {
  if (targetKey === "customerName") {
    return "Customer name";
  }

  if (targetKey === "height") {
    return "Height";
  }

  const field = getProfileFields(profileId).find((item) => item.valueKey === targetKey || item.key === targetKey);
  return field?.label || targetKey;
}

function parseManualImportText(rawText, profileId, customShorthand = {}) {
  const importMap = getManualImportMap(profileId, customShorthand);
  const values = {};
  const matchedLabels = [];
  const unmatchedLines = [];
  const ambiguousItems = [];
  const usesInches = /\b(in|inch|inches)\b/i.test(rawText) && !/\b(cm|centimeter|centimeters)\b/i.test(rawText);
  const entries = rawText
    .split(/\r?\n|;|,/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const compactMatches = [...entry.matchAll(/\b([a-zA-Z][a-zA-Z /_-]{0,20})\s*[:=\-]?\s*([0-9]+(?:\.[0-9]+)?)(?:\s*(cm|in|inch|inches))?\b/g)];
      const compactText = compactMatches.map((match) => match[0]).join(" ").trim();

      if (compactMatches.length > 1 && compactText.length >= entry.length * 0.65) {
        return compactMatches.map((match) => `${match[1]} ${match[2]}${match[3] ? ` ${match[3]}` : ""}`);
      }

      return [entry];
    });

  entries.forEach((entry) => {
    const pairMatch = entry.match(/^(.+?)(?:[:=\-]| {2,})(.+)$/);
    const looseMatch = entry.match(/^([a-zA-Z][a-zA-Z /_-]*?)\s+([0-9]+(?:\.[0-9]+)?)(?:\s*(cm|in|inch|inches))?$/i);
    const labelText = pairMatch ? pairMatch[1] : looseMatch?.[1];
    const valueText = pairMatch ? pairMatch[2] : looseMatch?.[2];

    if (!labelText || !valueText) {
      unmatchedLines.push(entry);
      return;
    }

    const normalizedLabel = normalizeImportLabel(labelText);
    const targets = importMap.get(normalizedLabel) || [];
    const numberMatch = valueText.match(/[0-9]+(?:\.[0-9]+)?/);

    if (targets.length === 0) {
      unmatchedLines.push(entry);
      return;
    }

    if (targets.length === 1 && targets[0] === "customerName") {
      values.customerName = valueText.trim();
      matchedLabels.push("Customer name");
      return;
    }

    if (!numberMatch) {
      unmatchedLines.push(entry);
      return;
    }

    if (targets.length > 1) {
      ambiguousItems.push({
        id: `${normalizedLabel}-${ambiguousItems.length}`,
        label: labelText.trim(),
        value: numberMatch[0],
        options: targets.map((target) => ({
          key: target,
          label: getManualFieldLabel(profileId, target),
        })),
      });
      return;
    }

    const [target] = targets;
    values[target] = numberMatch[0];
    matchedLabels.push(getManualFieldLabel(profileId, target));
  });

  return {
    values,
    matchedLabels,
    unmatchedLines,
    ambiguousItems,
    usesInches,
  };
}

function parseCustomShorthandText(rawText, profileId) {
  const customMap = {};
  const errors = [];
  const targetMap = new Map();

  ["customerName", "height"].forEach((key) => {
    targetMap.set(normalizeImportLabel(key), key);
    targetMap.set(normalizeImportLabel(getManualFieldLabel(profileId, key)), key);
  });

  getProfileFields(profileId).forEach((field) => {
    [field.key, field.valueKey, field.label].filter(Boolean).forEach((alias) => {
      targetMap.set(normalizeImportLabel(alias), field.valueKey || field.key);
    });
  });

  rawText
    .split(/\r?\n|;/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const match = line.match(/^(.+?)(?:=|:|-)(.+)$/);

      if (!match) {
        errors.push(`${line} should look like SH = shoulder`);
        return;
      }

      const alias = normalizeImportLabel(match[1]);
      const targetLabel = normalizeImportLabel(match[2]);
      const target = targetMap.get(targetLabel);

      if (!alias) {
        errors.push(`${line} has no shorthand code`);
        return;
      }

      if (!target) {
        errors.push(`${line} points to an unknown measurement`);
        return;
      }

      customMap[alias] = target;
    });

  return { customMap, errors };
}

function convertInputValueToCm(value, usesInches) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return "";
  }

  return roundMeasurement(usesInches ? numericValue * 2.54 : numericValue);
}

function toDateInputValue(date) {
  return date.toISOString().slice(0, 10);
}

function toTimeInputValue(date) {
  return date.toTimeString().slice(0, 5);
}

async function fetchProfile(user) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    if (error.code !== "PGRST116") {
      throw error;
    }

    const fallbackUsernameBase = normalizeUsername(
      user.user_metadata?.username ||
      user.email?.split("@")[0] ||
      `user_${user.id.slice(0, 8)}`
    ).replace(/[^a-z0-9_]/g, "_").slice(0, 24);
    const fallbackUsername = `${fallbackUsernameBase.slice(0, 15)}_${user.id.slice(0, 8)}`;
    const fallbackProfile = {
      id: user.id,
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || "",
      email: user.email,
      username: fallbackUsername.length >= 3 ? fallbackUsername : `user_${user.id.slice(0, 8)}`,
      mode: null,
      custom_shorthand: {},
      updated_at: new Date().toISOString(),
    };
    const { data: insertedProfile, error: insertError } = await supabase
      .from("profiles")
      .upsert(fallbackProfile)
      .select("*")
      .single();

    if (insertError) {
      throw insertError;
    }

    return {
      id: user.id,
      email: user.email,
      fullName: insertedProfile.full_name || "",
      username: insertedProfile.username || "",
      mode: insertedProfile.mode || "",
      plan: insertedProfile.plan === "pro" ? "pro" : "free",
      planStatus: insertedProfile.plan_status || "active",
      customShorthand: insertedProfile.custom_shorthand || {},
    };
  }

  return {
    id: user.id,
    email: user.email,
    fullName: data.full_name || user.user_metadata?.full_name || "",
    username: data.username || user.user_metadata?.username || "",
    mode: data.mode || "",
    plan: data.plan === "pro" ? "pro" : "free",
    planStatus: data.plan_status || "active",
    customShorthand: data.custom_shorthand || {},
  };
}

async function resolveLoginEmail(identifier) {
  const cleanIdentifier = identifier.trim();

  if (cleanIdentifier.includes("@")) {
    return cleanIdentifier;
  }

  const { data, error } = await supabase.rpc("get_email_by_username", {
    login_username: normalizeUsername(cleanIdentifier),
  });

  if (error) {
    if (
      error.message?.includes("get_email_by_username") ||
      error.message?.includes("schema cache") ||
      error.code === "PGRST202"
    ) {
      throw new Error("Username login is not fully set up yet. Use email login for now.");
    }

    throw error;
  }

  if (!data) {
    throw new Error("No account found for that username.");
  }

  return data;
}

function isNetworkLikeError(error) {
  const message = String(error?.message || error || "").toLowerCase();

  return (
    message.includes("network request failed") ||
    message.includes("failed to fetch") ||
    message.includes("timeout") ||
    message.includes("offline")
  );
}

async function canReachSupabase() {
  if (!supabaseUrl || !supabase) {
    return true;
  }

  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Connection check timed out.")), 6500);
      }),
    ]);

    return !isNetworkLikeError(result?.error);
  } catch (error) {
    return !isNetworkLikeError(error) ? true : false;
  }
}

export default function App() {
  const deviceColorScheme = useColorScheme();
  const [screen, setScreen] = useState("auth");
  const [authMode, setAuthMode] = useState("login");
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [offlineMessage, setOfflineMessage] = useState("");
  const [themePreference, setThemePreference] = useState("system");
  const [profile, setProfile] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");
  const [usernameDraft, setUsernameDraft] = useState("");
  const [profileStatusTarget, setProfileStatusTarget] = useState("");
  const [accountDeleteOpen, setAccountDeleteOpen] = useState(false);
  const [accountDeleteText, setAccountDeleteText] = useState("");
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [captureStep, setCaptureStep] = useState("front");
  const [captureMode, setCaptureMode] = useState("assisted");
  const [measurementPhotoSource, setMeasurementPhotoSource] = useState("camera");
  const [capturedPhotos, setCapturedPhotos] = useState({ front: null, side: null });
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [captureCoolingDown, setCaptureCoolingDown] = useState(false);
  const [captureRetryPaused, setCaptureRetryPaused] = useState(false);
  const [captureFlashKey, setCaptureFlashKey] = useState(0);
  const [captureFlashVisible, setCaptureFlashVisible] = useState(false);
  const [photoCheckStatus, setPhotoCheckStatus] = useState("");
  const [liveCaptureCheck, setLiveCaptureCheck] = useState({
    status: "idle",
    message: "Starting camera...",
  });
  const [liveCaptureValidation, setLiveCaptureValidation] = useState(null);
  const [retakeOnlyView, setRetakeOnlyView] = useState(null);
  const [selfInstructionReady, setSelfInstructionReady] = useState(false);
  const [measurementDetails, setMeasurementDetails] = useState({
    profile: "female",
    height: "",
    heightUnit: "cm",
    customerName: "",
  });
  const [measurementResult, setMeasurementResult] = useState(null);
  const [reviewMeasurements, setReviewMeasurements] = useState([]);
  const [generatedMeasurements, setGeneratedMeasurements] = useState([]);
  const [manualImportText, setManualImportText] = useState("");
  const [manualImportUnit, setManualImportUnit] = useState("cm");
  const [manualImportAmbiguities, setManualImportAmbiguities] = useState([]);
  const [manualImportUnmatched, setManualImportUnmatched] = useState([]);
  const [customShorthandText, setCustomShorthandText] = useState("");
  const [selectedResultGuideIndex, setSelectedResultGuideIndex] = useState(0);
  const [resultViewMode, setResultViewMode] = useState("guide");
  const [resultUnit, setResultUnit] = useState("cm");
  const [measurementInputDrafts, setMeasurementInputDrafts] = useState({});
  const [savedRecords, setSavedRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [editingSavedRecord, setEditingSavedRecord] = useState(null);
  const [sharedMeasurements, setSharedMeasurements] = useState([]);
  const [shareTargetRecord, setShareTargetRecord] = useState(null);
  const [tailorUsername, setTailorUsername] = useState("");
  const [measurementDrafts, setMeasurementDrafts] = useState([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [draftToDelete, setDraftToDelete] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [reminderToDelete, setReminderToDelete] = useState(null);
  const [editingReminderId, setEditingReminderId] = useState(null);
  const [savedMeasurementReminderPrompt, setSavedMeasurementReminderPrompt] = useState(null);
  const [upgradePrompt, setUpgradePrompt] = useState(null);
  const [reminderForm, setReminderForm] = useState({
    cloudCustomerId: "",
    customerName: "",
    title: "",
    type: "Fitting",
    dueDate: toDateInputValue(new Date()),
    dueTime: "09:00",
    note: "",
  });
  const [styleLibrary, setStyleLibrary] = useState([]);
  const [stylesLoading, setStylesLoading] = useState(false);
  const [customStyleCategories, setCustomStyleCategories] = useState([]);
  const [styleViewMode, setStyleViewMode] = useState("grid");
  const [styleSearch, setStyleSearch] = useState("");
  const [styleCategoryFilter, setStyleCategoryFilter] = useState("all");
  const [styleAttachSearch, setStyleAttachSearch] = useState("");
  const [newStyleCategory, setNewStyleCategory] = useState("");
  const [selectedBillingPlan, setSelectedBillingPlan] = useState("yearly");
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [styleToDelete, setStyleToDelete] = useState(null);
  const [styleForm, setStyleForm] = useState({
    title: "",
    category: "Gown",
    notes: "",
    image: null,
  });
  const cameraRef = useRef(null);
  const liveCaptureCheckRunningRef = useRef(false);
  const draftSaveTimerRef = useRef(null);
  const draftCloudIdsRef = useRef({});
  const lastCameraInstructionRef = useRef("");
  const lastLiveCaptureInstructionRef = useRef("");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    username: "",
    password: "",
  });

  const isSignup = authMode === "signup";

  const title = useMemo(() => (
    isSignup ? "Create your account" : "Welcome back"
  ), [isSignup]);
  const isLightMode = themePreference === "system" ? deviceColorScheme !== "dark" : themePreference === "light";

  activeLightMode = isLightMode;

  const resetLiveCaptureCheck = (message = "Starting camera...") => {
    setLiveCaptureCheck({
      status: "idle",
      message,
    });
    setLiveCaptureValidation(null);
    liveCaptureCheckRunningRef.current = false;
    lastLiveCaptureInstructionRef.current = "";
  };

  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(APP_THEME_STORAGE_KEY).then((savedTheme) => {
      if (mounted && (savedTheme === "light" || savedTheme === "dark")) {
        setThemePreference(savedTheme);
      }
    }).catch(() => {
      // Theme preference is cosmetic, so failures should not block startup.
    });

    return () => {
      mounted = false;
    };
  }, []);

  const handleToggleTheme = () => {
    const nextTheme = isLightMode ? "dark" : "light";
    setThemePreference(nextTheme);
    AsyncStorage.setItem(APP_THEME_STORAGE_KEY, nextTheme).catch(() => {
      // Ignore theme persistence failures.
    });
  };

  useEffect(() => {
    if (profile?.id && profile.mode) {
      loadMeasurementDrafts();
      loadStyleLibrary();
      if (profile.mode === "tailor") {
        loadReminders();
      } else {
        setReminders([]);
      }
    }
  }, [profile?.id, profile?.mode]);

  useEffect(() => {
    const shouldSaveDraft = Boolean(
      profile?.id &&
      activeDraftId &&
      ["capture", "reviewPhotos", "measurementResult"].includes(screen)
    );

    if (!shouldSaveDraft) {
      return undefined;
    }

    const hasDraftContent = Boolean(
      capturedPhotos.front?.uri ||
      capturedPhotos.side?.uri ||
      measurementDetails.height ||
      measurementDetails.customerName ||
      reviewMeasurements.length
    );

    if (!hasDraftContent) {
      return undefined;
    }

    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
    }

    draftSaveTimerRef.current = setTimeout(async () => {
      const draft = {
        id: activeDraftId,
        cloudDraftId: draftCloudIdsRef.current[activeDraftId],
        mode: profile.mode || "client",
        stage: screen === "measurementResult" ? "review" : "capture",
        measurementDetails,
        capturedPhotos,
        captureMode,
        measurementPhotoSource,
        measurementResult,
        generatedMeasurements,
        reviewMeasurements,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setMeasurementDrafts((currentDrafts) => {
        const exists = currentDrafts.some((currentDraft) => currentDraft.id === activeDraftId);
        return exists
          ? currentDrafts.map((currentDraft) => (currentDraft.id === activeDraftId ? draft : currentDraft))
          : [draft, ...currentDrafts];
      });

      const result = await saveMobileMeasurementDraft({
        user: profile,
        draft,
      });

      if (result.ok) {
        draftCloudIdsRef.current[activeDraftId] = result.draft.cloudDraftId;
        setMeasurementDrafts((currentDrafts) => currentDrafts.map((currentDraft) => (
          currentDraft.id === activeDraftId ? result.draft : currentDraft
        )));
      }
    }, 900);

    return () => {
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current);
      }
    };
  }, [
    activeDraftId,
    captureMode,
    capturedPhotos,
    generatedMeasurements,
    measurementDetails,
    measurementPhotoSource,
    measurementResult,
    profile,
    reviewMeasurements,
    screen,
  ]);

  useEffect(() => {
    if (!status || !isPositiveStatus(status)) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setStatus((currentStatus) => (currentStatus === status ? "" : currentStatus));
    }, 3200);

    return () => clearTimeout(timeoutId);
  }, [status]);

  useEffect(() => {
    if (screen !== "capture" || !cameraReady || capturing || captureCoolingDown) {
      return undefined;
    }

    const instruction = getCameraVoiceInstruction({ captureMode, captureStep, captureRetryPaused });
    const instructionKey = `${captureMode}:${captureStep}:${captureRetryPaused}:${instruction}`;

    if (lastCameraInstructionRef.current === instructionKey) {
      return undefined;
    }

    lastCameraInstructionRef.current = instructionKey;

    if (captureMode === "self") {
      setSelfInstructionReady(false);
    }

    Speech.stop();
    Speech.speak(instruction, {
      rate: 0.88,
      onDone: () => {
        if (captureMode === "self") {
          setSelfInstructionReady(true);
        }
      },
      onStopped: () => {
        if (captureMode === "self") {
          setSelfInstructionReady(true);
        }
      },
      onError: () => {
        if (captureMode === "self") {
          setSelfInstructionReady(true);
        }
      },
    });

    const fallbackTimer = setTimeout(() => {
      if (captureMode === "self") {
        setSelfInstructionReady(true);
      }
    }, captureStep === "side" ? 5200 : 4300);

    return () => clearTimeout(fallbackTimer);
  }, [cameraReady, captureCoolingDown, captureMode, captureRetryPaused, captureStep, capturing, screen]);

  useEffect(() => {
    if (screen !== "capture" || liveCaptureCheck.status !== "adjust" || capturing || countdown !== null) {
      return;
    }

    const instruction = getLiveCaptureVoiceInstruction(liveCaptureCheck.message);
    const instructionKey = `${captureStep}:${instruction}`;

    if (lastLiveCaptureInstructionRef.current === instructionKey) {
      return;
    }

    lastLiveCaptureInstructionRef.current = instructionKey;
    Speech.stop();
    Speech.speak(instruction, { rate: 0.9 });
  }, [captureStep, capturing, countdown, liveCaptureCheck.message, liveCaptureCheck.status, screen]);

  useEffect(() => {
    if (screen !== "capture" || !cameraReady || capturing || captureCoolingDown || captureRetryPaused || countdown !== null) {
      return undefined;
    }

    let cancelled = false;
    let nextProbeTimer;

    const runLiveProbe = async () => {
      if (cancelled || liveCaptureCheckRunningRef.current || !cameraRef.current) {
        return;
      }

      let nextProbeDelay = 2600;
      liveCaptureCheckRunningRef.current = true;
      setLiveCaptureCheck((currentCheck) => (
        currentCheck.status === "ready"
          ? currentCheck
          : { status: "checking", message: "Checking frame..." }
      ));

      try {
        const probePhoto = await cameraRef.current.takePictureAsync({
          quality: 0.22,
          skipProcessing: true,
          shutterSound: false,
        });
        const validation = await validateCapturedPhoto({
          photo: probePhoto,
          view: captureStep,
        });

        if (cancelled) {
          return;
        }

        const liveResult = getLiveCaptureResult(validation, captureStep);

        if (!liveResult.ready) {
          setLiveCaptureValidation(null);
          setLiveCaptureCheck({
            status: "adjust",
            message: liveResult.message,
            warnings: liveResult.warnings,
          });
          nextProbeDelay = 2600;
          return;
        }

        setLiveCaptureValidation(validation);
        setLiveCaptureCheck({
          status: "ready",
          message: liveResult.message,
          warnings: liveResult.warnings,
        });
        nextProbeDelay = 4500;
      } catch (error) {
        if (cancelled) {
          return;
        }

        setLiveCaptureValidation(null);
        setLiveCaptureCheck({
          status: "adjust",
          message: error.message || "Adjust the camera until the full body is clear.",
        });
        nextProbeDelay = 2600;
      } finally {
        liveCaptureCheckRunningRef.current = false;

        if (!cancelled) {
          nextProbeTimer = setTimeout(runLiveProbe, nextProbeDelay);
        }
      }
    };

    const firstProbeTimer = setTimeout(runLiveProbe, 900);

    return () => {
      cancelled = true;
      clearTimeout(firstProbeTimer);
      clearTimeout(nextProbeTimer);
      liveCaptureCheckRunningRef.current = false;
    };
  }, [cameraReady, captureCoolingDown, captureRetryPaused, captureStep, capturing, countdown, screen]);

  useEffect(() => {
    if (screen !== "capture" || captureMode !== "self" || liveCaptureCheck.status !== "ready" || !cameraReady || !selfInstructionReady || capturing || captureCoolingDown || captureRetryPaused || countdown !== null) {
      return undefined;
    }

    const startTimer = setTimeout(() => {
      setCountdown(5);
    }, 350);

    return () => clearTimeout(startTimer);
  }, [cameraReady, captureCoolingDown, captureMode, captureRetryPaused, capturing, countdown, liveCaptureCheck.status, screen, selfInstructionReady]);

  useEffect(() => {
    if (screen !== "capture" || captureMode !== "self" || countdown === null) {
      return undefined;
    }

    if (countdown <= 0) {
      const captureTimer = setTimeout(() => {
        handleCapturePhoto();
      }, 250);

      return () => clearTimeout(captureTimer);
    }

    const tickTimer = setTimeout(() => {
      setCountdown((currentCountdown) => (
        currentCountdown === null ? null : Math.max(currentCountdown - 1, 0)
      ));
    }, 1000);

    return () => clearTimeout(tickTimer);
  }, [captureMode, countdown, screen]);

  useEffect(() => {
    if (screen !== "capture" || captureMode !== "self" || countdown === null || countdown <= 0) {
      return;
    }

    Speech.stop();
    Speech.speak(String(countdown), { rate: 0.95 });
  }, [captureMode, countdown, screen]);

  useEffect(() => {
    if (screen === "capture") {
      return undefined;
    }

    Speech.stop();
    lastCameraInstructionRef.current = "";
    lastLiveCaptureInstructionRef.current = "";
    setLiveCaptureValidation(null);
    setLiveCaptureCheck({
      status: "idle",
      message: "Starting camera...",
    });
    liveCaptureCheckRunningRef.current = false;
    return undefined;
  }, [screen]);

  useEffect(() => {
    let mounted = true;

    async function restoreSession() {
      if (!supabase) {
        setLoading(false);
        return;
      }

      try {
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Startup took too long. Check your connection and try again.")), 8000);
          }),
        ]);

        if (!mounted) {
          return;
        }

        if (!sessionResult.data.session?.user) {
          setLoading(false);
          return;
        }

        const nextProfile = await fetchProfile(sessionResult.data.session.user);

        if (!mounted) {
          return;
        }

        setProfile(nextProfile);
        setScreen(nextProfile.mode ? "home" : "mode");
      } catch (error) {
        setStatus(error.message);
        setShowAuthForm(true);
        setScreen("auth");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    restoreSession();

    const { data: listener } = supabase?.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setShowAuthForm(true);
        setScreen("passwordReset");
        setStatus("Create a new password for your account.");
        return;
      }

      if (!session?.user) {
        setProfile(null);
        setScreen("auth");
        return;
      }

      try {
        const nextProfile = await fetchProfile(session.user);
        setProfile(nextProfile);
        setScreen(nextProfile.mode ? "home" : "mode");
      } catch {
        // The explicit auth actions below surface errors in a friendlier place.
      }
    }) || { data: null };

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function refreshConnection() {
      const online = await canReachSupabase();

      if (!mounted) {
        return;
      }

      setOfflineMessage(online ? "" : "Connection looks unstable. Saving and account actions may fail until your connection returns.");
    }

    refreshConnection();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refreshConnection();
        if (profile?.mode === "tailor") {
          loadReminders();
        }
      }
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [profile?.mode]);

  useEffect(() => {
    if (!supabase) {
      return undefined;
    }

    async function handleAuthUrl(url) {
      if (!url?.startsWith(GOOGLE_AUTH_REDIRECT_URL)) {
        return;
      }

      try {
        const parsedUrl = new URL(url);
        const code = parsedUrl.searchParams.get("code");

        if (!code) {
          const errorDescription = parsedUrl.searchParams.get("error_description") || parsedUrl.searchParams.get("error");

          if (errorDescription) {
            setStatus(errorDescription);
          }

          return;
        }

        setSaving(true);
        setStatus("");

        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          throw error;
        }

        const nextProfile = await fetchProfile(data.user);
        setProfile(nextProfile);
        setScreen(nextProfile.mode ? "home" : "mode");
      } catch (error) {
        setStatus(error.message || "Google sign-in could not be completed.");
      } finally {
        setSaving(false);
      }
    }

    const subscription = Linking.addEventListener("url", ({ url }) => handleAuthUrl(url));

    Linking.getInitialURL().then((url) => {
      if (url) {
        handleAuthUrl(url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const updateForm = (name, value) => {
    setStatus("");
    setForm((currentForm) => ({ ...currentForm, [name]: value }));
  };

  const handleRequestPasswordReset = async () => {
    if (!supabase) {
      setStatus(getSupabaseConfigError());
      return;
    }

    const identifier = (form.email || form.username).trim();

    if (!identifier) {
      setStatus("Enter your email or username first.");
      return;
    }

    setSaving(true);
    setStatus("");

    try {
      const recoveryEmail = await resolveLoginEmail(identifier);
      const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail);

      if (error) {
        throw error;
      }

      setStatus("Check your email for the password reset link.");
    } catch (error) {
      setStatus(error.message || "Password reset could not be sent.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!supabase) {
      setStatus(getSupabaseConfigError());
      return;
    }

    if (resetPassword.length < 6) {
      setStatus("Password should be at least 6 characters.");
      return;
    }

    if (resetPassword !== resetPasswordConfirm) {
      setStatus("Passwords do not match.");
      return;
    }

    setSaving(true);
    setStatus("");

    const { error } = await supabase.auth.updateUser({ password: resetPassword });

    setSaving(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    setResetPassword("");
    setResetPasswordConfirm("");
    setStatus("Password updated. Login with your new password.");
    setShowAuthForm(true);
    setScreen("auth");
    setAuthMode("login");
  };

  const handleResendVerificationEmail = async () => {
    if (!supabase) {
      setStatus(getSupabaseConfigError());
      return;
    }

    const email = (pendingVerificationEmail || form.email).trim().toLowerCase();

    if (!email) {
      setStatus("Enter the email you used to sign up.");
      return;
    }

    setSaving(true);
    setStatus("");

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    setSaving(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    setPendingVerificationEmail(email);
    setStatus("Verification email sent again. Check your inbox and spam folder.");
  };

  const handleChangeUsername = async () => {
    setProfileStatusTarget("username");

    if (!supabase || !profile?.id) {
      setStatus("Login again before changing username.");
      return;
    }

    const nextUsername = normalizeUsername(usernameDraft);

    if (!/^[a-z0-9_]{3,24}$/.test(nextUsername)) {
      setStatus("Use 3-24 lowercase letters, numbers, or underscores.");
      return;
    }

    if (nextUsername === profile.username) {
      setStatus("Username is unchanged.");
      return;
    }

    setSaving(true);
    setStatus("");

    const { error } = await supabase
      .from("profiles")
      .update({
        username: nextUsername,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    if (!error) {
      await supabase.auth.updateUser({
        data: { username: nextUsername },
      });
    }

    setSaving(false);

    if (error) {
      setStatus(error.message.toLowerCase().includes("duplicate") ? "That username is already taken." : error.message);
      return;
    }

    setProfile((currentProfile) => ({
      ...currentProfile,
      username: nextUsername,
    }));
    setUsernameDraft("");
    setStatus("Username updated.");
  };

  const handleAuth = async () => {
    if (!supabase) {
      setStatus(getSupabaseConfigError());
      return;
    }

    setSaving(true);
    setStatus("");

    try {
      if (isSignup) {
        const fullName = form.fullName.trim();
        const email = form.email.trim().toLowerCase();
        const username = normalizeUsername(form.username);

        if (!fullName || !email || !username || form.password.length < 6) {
          throw new Error("Enter your name, email, username, and a password of at least 6 characters.");
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password: form.password,
          options: {
            data: {
              full_name: fullName,
              username,
            },
          },
        });

        if (error) {
          throw error;
        }

        if (!data.user) {
          throw new Error("Account could not be created. Try again.");
        }

        const { error: profileError } = await supabase.from("profiles").upsert({
          id: data.user.id,
          full_name: fullName,
          email,
          username,
          mode: null,
          custom_shorthand: {},
          updated_at: new Date().toISOString(),
        });

        if (profileError) {
          throw profileError;
        }

        if (!data.session) {
          setPendingVerificationEmail(email);
          setStatus("Check your email to verify your account, then come back to login.");
          setAuthMode("login");
          return;
        }

        const nextProfile = await fetchProfile(data.user);
        setProfile(nextProfile);
        setScreen("mode");
        return;
      }

      const email = await resolveLoginEmail(form.email || form.username);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: form.password,
      });

      if (error) {
        throw error;
      }

      const nextProfile = await fetchProfile(data.user);
      setProfile(nextProfile);
      setScreen(nextProfile.mode ? "home" : "mode");
    } catch (error) {
      if (isNetworkLikeError(error)) {
        setOfflineMessage("Connection looks unstable. Try again when your connection returns.");
      }
      setStatus(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGoogleAuth = async () => {
    if (!supabase) {
      setStatus(getSupabaseConfigError());
      return;
    }

    if (isRunningInExpoGo) {
      setStatus("Google sign-in will be available in the installed app. Use email login while testing in Expo Go.");
      return;
    }

    setSaving(true);
    setStatus("");

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: GOOGLE_AUTH_REDIRECT_URL,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        throw error;
      }

      if (!data?.url) {
        throw new Error("Google sign-in could not be started.");
      }

      await Linking.openURL(data.url);
      setStatus("Complete Google sign-in, then return to TailorIQ.");
    } catch (error) {
      setStatus(error.message || "Google sign-in could not be started.");
    } finally {
      setSaving(false);
    }
  };

  const handleSelectMode = async (mode) => {
    if (!profile?.id) {
      return;
    }

    setSaving(true);
    setStatus("");

    const { error } = await supabase
      .from("profiles")
      .update({
        mode,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    setSaving(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    setProfile((currentProfile) => ({ ...currentProfile, mode }));
    setScreen("home");
  };

  const handleLogout = async () => {
    await supabase?.auth.signOut();
    setProfile(null);
    setShowAuthForm(false);
    setScreen("auth");
  };

  const handleDeleteAccount = async () => {
    if (accountDeleteText.trim().toUpperCase() !== "DELETE") {
      setProfileStatusTarget("account");
      setStatus("Type DELETE to confirm account deletion.");
      return;
    }

    setSaving(true);
    setProfileStatusTarget("account");
    setStatus("");

    const result = await deleteMobileAccount();

    setSaving(false);

    if (!result.ok) {
      setStatus(result.message || "Account could not be deleted.");
      return;
    }

    setAccountDeleteOpen(false);
    setAccountDeleteText("");
    setProfile(null);
    setShowAuthForm(false);
    setScreen("auth");
    setStatus("");
  };

  const loadSavedRecords = async ({ openScreen = true } = {}) => {
    if (!profile?.id) {
      return;
    }

    setRecordsLoading(true);
    setStatus("");

    const [result, sharedResult] = await Promise.all([
      fetchMobileMeasurements({
        user: profile,
        mode: profile.mode || "client",
      }),
      fetchMobileSharedMeasurements({ user: profile }),
    ]);

    setRecordsLoading(false);

    if (!result.ok) {
      setStatus(result.message);
      setSavedRecords([]);
      return;
    }

    setSavedRecords(result.records);
    setSharedMeasurements(sharedResult.ok ? sharedResult.shares : []);

    if (openScreen) {
      setScreen("records");
    }
  };

  const loadMeasurementDrafts = async ({ openScreen = false } = {}) => {
    if (!profile?.id) {
      return;
    }

    setDraftsLoading(true);
    setStatus("");

    const result = await fetchMobileMeasurementDrafts({
      user: profile,
      mode: profile.mode || "client",
    });

    setDraftsLoading(false);

    if (!result.ok) {
      setStatus(result.message);
      setMeasurementDrafts([]);
      return;
    }

    result.drafts.forEach((draft) => {
      if (draft.cloudDraftId) {
        draftCloudIdsRef.current[draft.id] = draft.cloudDraftId;
      }
    });

    setMeasurementDrafts(result.drafts);

    if (openScreen) {
      setScreen("drafts");
    }
  };

  const loadReminders = async ({ openScreen = false } = {}) => {
    if (!profile?.id || profile.mode !== "tailor") {
      return;
    }

    setRemindersLoading(true);
    setStatus("");

    const result = await fetchMobileReminders({ user: profile });

    setRemindersLoading(false);

    if (!result.ok) {
      setStatus(result.message);
      setReminders([]);
      return;
    }

    setReminders(result.reminders);
    scheduleReminderNotifications(result.reminders).then((notificationResult) => {
      if (!notificationResult?.ok) {
        setStatus(notificationResult.message || "Reminder alerts need notification permission.");
      }
    }).catch(() => {
      setStatus("Reminder alerts could not be refreshed. Check notification permission.");
    });

    if (openScreen) {
      setScreen("reminders");
    }
  };

  const openReminderUpgradePrompt = () => {
    setUpgradePrompt({
      title: "Reminders are Pro",
      message: "Free keeps measurement capture, review, saved records, styles, and sharing available. Upgrade when you want fitting, pickup, and follow-up reminders.",
    });
  };

  const openStyleAttachmentUpgradePrompt = () => {
    setUpgradePrompt({
      title: "Style attachment is Pro",
      message: "Free lets you save style ideas and customer records separately. Upgrade when you want to connect specific styles to specific customers.",
    });
  };

  const handleOpenReminders = () => {
    if (!canUsePlanFeature(profile, "reminders")) {
      openReminderUpgradePrompt();
      return;
    }

    loadReminders({ openScreen: true });
  };

  const loadStyleLibrary = async ({ openScreen = false } = {}) => {
    if (!profile?.id) {
      return;
    }

    setStylesLoading(true);
    setStatus("");

    const [result, categoryResult] = await Promise.all([
      fetchMobileStyles({ user: profile }),
      fetchMobileStyleCategories({ user: profile }),
    ]);

    setStylesLoading(false);

    if (categoryResult.ok) {
      setCustomStyleCategories(categoryResult.categories);
    }

    if (!result.ok) {
      setStatus(result.message);
      setStyleLibrary([]);
      return;
    }

    setStyleLibrary(result.styles);

    if (openScreen) {
      setScreen("styles");
    }
  };

  const handleNavigate = (target) => {
    setStatus("");

    if (target === "measure") {
      handleStartMeasurement();
      return;
    }

    if (target === "records") {
      loadSavedRecords();
      return;
    }

    if (target === "more") {
      setScreen("more");
      return;
    }

    setScreen("home");
  };

  const openCaptureCamera = async ({ mode = "assisted", step = "front", retakeView = null } = {}) => {
    setStatus("");
    setMeasurementPhotoSource("camera");
    setCaptureMode(mode);
    setCaptureStep(step);
    setRetakeOnlyView(retakeView);
    setCameraReady(false);
    setCapturing(false);
    setCountdown(null);
    setCaptureRetryPaused(false);
    setPhotoCheckStatus("");
    setSelfInstructionReady(false);
    lastCameraInstructionRef.current = "";
    resetLiveCaptureCheck("Starting camera...");

    if (!cameraPermission?.granted) {
      const permissionResult = await requestCameraPermission();

      if (!permissionResult.granted) {
        setStatus("Camera permission is needed to capture measurement photos.");
        return;
      }
    }

    setScreen("capture");
  };

  const handleStartMeasurement = async () => {
    setStatus("");
    const plan = getUserPlan(profile);

    if (measurementDrafts.length >= plan.draftLimit) {
      setStatus(`Free plan keeps up to ${plan.draftLimit} unfinished measurement drafts. Continue or delete an old draft before starting another.`);
      setScreen("drafts");
      return;
    }

    setEditingSavedRecord(null);
    setActiveDraftId(createLocalDraftId());
    setCaptureStep("front");
    setCaptureMode(profile?.mode === "client" ? "self" : "assisted");
    setMeasurementPhotoSource("camera");
    setCapturedPhotos({ front: null, side: null });
    setMeasurementResult(null);
    setGeneratedMeasurements([]);
    setReviewMeasurements([]);
    setMeasurementInputDrafts({});
    setCameraReady(false);
    setCapturing(false);
    setCountdown(null);
    setCaptureCoolingDown(false);
    setCaptureRetryPaused(false);
    setCaptureFlashVisible(false);
    setPhotoCheckStatus("");
    setSelfInstructionReady(false);
    lastCameraInstructionRef.current = "";
    resetLiveCaptureCheck("Starting camera...");
    setRetakeOnlyView(null);

    setScreen("captureChoice");
  };

  const handleStartManualInput = () => {
    setStatus("");
    setEditingSavedRecord(null);
    setScreen("manualChoice");
  };

  const openManualInputForm = ({ reset = false } = {}) => {
    const profileId = measurementDetails.profile || "female";

    setStatus("");
    setManualImportAmbiguities([]);
    setManualImportUnmatched([]);
    setActiveDraftId(null);
    if (reset) {
      setManualImportText("");
      setMeasurementDetails({
        profile: profileId,
        height: "",
        heightUnit: "cm",
        customerName: "",
      });
    }
    setCapturedPhotos({ front: null, side: null });
    setMeasurementResult(null);
    setGeneratedMeasurements([]);
    setReviewMeasurements(buildManualMeasurementList(profileId));
    setMeasurementInputDrafts({});
    setScreen("manualInput");
  };

  const handleManualProfileChange = (profileId) => {
    setMeasurementDetails((currentDetails) => ({
      ...currentDetails,
      profile: profileId,
    }));
    setReviewMeasurements(buildManualMeasurementList(profileId));
    setManualImportAmbiguities([]);
    setManualImportUnmatched([]);
  };

  const applyManualImportValues = (parsedValues, usesInches) => {
    setMeasurementDetails((currentDetails) => ({
      ...currentDetails,
      customerName: parsedValues.customerName || currentDetails.customerName,
      height: parsedValues.height || currentDetails.height,
    }));

    setReviewMeasurements((currentMeasurements) => currentMeasurements.map((measurement) => {
      const targetKey = measurement.valueKey || measurement.fieldKey;

      if (!Object.prototype.hasOwnProperty.call(parsedValues, targetKey)) {
        return measurement;
      }

      return {
        ...measurement,
        valueCm: convertInputValueToCm(parsedValues[targetKey], usesInches),
      };
    }));
  };

  const handleImportManualText = () => {
    const textToImport = manualImportText.trim();

    if (!textToImport) {
      setStatus("Paste measurements or shorthand before importing.");
      return;
    }

    const parsedImport = parseManualImportText(
      textToImport,
      measurementDetails.profile,
      profile?.customShorthand || {},
    );
    const usesInches = manualImportUnit === "in" || parsedImport.usesInches;

    applyManualImportValues(parsedImport.values, usesInches);
    setManualImportAmbiguities(parsedImport.ambiguousItems);
    setManualImportUnmatched(parsedImport.unmatchedLines);

    if (parsedImport.matchedLabels.length === 0 && parsedImport.ambiguousItems.length === 0) {
      setStatus("No measurement labels were recognized. Use labels or shorthand like B 36, W 30, H 42, SL 23.");
      return;
    }

    setStatus(parsedImport.ambiguousItems.length > 0
      ? `Imported ${parsedImport.matchedLabels.length} clear item${parsedImport.matchedLabels.length === 1 ? "" : "s"}. Choose meanings for the ambiguous shorthand.`
      : `Imported ${parsedImport.matchedLabels.length} item${parsedImport.matchedLabels.length === 1 ? "" : "s"}. Review before saving.`);
  };

  const handleResolveManualAmbiguity = (ambiguity, targetKey) => {
    applyManualImportValues({ [targetKey]: ambiguity.value }, manualImportUnit === "in");
    setManualImportAmbiguities((currentItems) => currentItems.filter((item) => item.id !== ambiguity.id));
    setStatus(`${ambiguity.label} saved as ${getManualFieldLabel(measurementDetails.profile, targetKey)}.`);
  };

  const handleSaveCustomShorthand = async () => {
    setProfileStatusTarget("shorthand");

    if (!profile?.id) {
      setStatus("Login again before saving shorthand.");
      return;
    }

    if (!canUsePlanFeature(profile, "customShorthand")) {
      setStatus(getUpgradeMessage("Custom shorthand"));
      return;
    }

    const parsedShorthand = parseCustomShorthandText(customShorthandText, measurementDetails.profile || "female");

    if (parsedShorthand.errors.length > 0) {
      setStatus(parsedShorthand.errors.join("; "));
      return;
    }

    setSaving(true);
    setStatus("");

    const nextCustomShorthand = {
      ...(profile.customShorthand || {}),
      ...parsedShorthand.customMap,
    };
    const { error } = await supabase
      .from("profiles")
      .update({
        custom_shorthand: nextCustomShorthand,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    setSaving(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    setProfile((currentProfile) => ({
      ...currentProfile,
      customShorthand: nextCustomShorthand,
    }));
    setCustomShorthandText("");
    setStatus("Custom shorthand saved.");
  };

  const handleContinueDraft = async (draft) => {
    if (!draft) {
      return;
    }

    setStatus("");
    setActiveDraftId(draft.id);
    if (draft.cloudDraftId) {
      draftCloudIdsRef.current[draft.id] = draft.cloudDraftId;
    }
    setMeasurementDetails({
      profile: "female",
      height: "",
      heightUnit: "cm",
      customerName: "",
      ...(draft.measurementDetails || {}),
    });
    setCapturedPhotos(draft.capturedPhotos || { front: null, side: null });
    setMeasurementResult(draft.measurementResult || null);
    setGeneratedMeasurements(draft.generatedMeasurements || []);
    setReviewMeasurements(draft.reviewMeasurements || []);
    setCaptureMode(draft.captureMode || (profile?.mode === "client" ? "self" : "assisted"));
    setMeasurementPhotoSource(draft.measurementPhotoSource || "camera");
    setCaptureStep(hasUsablePhoto(draft.capturedPhotos?.front) && !hasUsablePhoto(draft.capturedPhotos?.side) ? "side" : "front");
    setCameraReady(false);
    setCountdown(null);
    setCaptureCoolingDown(false);
    setCaptureRetryPaused(false);
    setPhotoCheckStatus("");
    setSelfInstructionReady(false);
    lastCameraInstructionRef.current = "";
    resetLiveCaptureCheck("Starting camera...");
    setRetakeOnlyView(null);

    if (draft.stage === "review" && draft.reviewMeasurements?.length) {
      setScreen("measurementResult");
      return;
    }

    if (hasPhotoReference(draft.capturedPhotos?.front) || hasPhotoReference(draft.capturedPhotos?.side)) {
      if (!hasUsablePhoto(draft.capturedPhotos?.front) || !hasUsablePhoto(draft.capturedPhotos?.side)) {
        setStatus("Draft photos need to be added again. Re-upload or retake both photos before analysis.");
      }
      setScreen("reviewPhotos");
      return;
    }

    if (!cameraPermission?.granted) {
      const permissionResult = await requestCameraPermission();

      if (!permissionResult.granted) {
        setStatus("Camera permission is needed to continue this draft.");
        return;
      }
    }

    setScreen("captureChoice");
  };

  const handleCapturePhoto = async () => {
    if (!cameraRef.current || !cameraReady || capturing) {
      return;
    }

    setCapturing(true);
    setCountdown(null);
    setCaptureCoolingDown(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.55,
        skipProcessing: false,
      });

      setCaptureFlashKey((currentKey) => currentKey + 1);
      setCaptureFlashVisible(true);
      Vibration.vibrate(80);
      setTimeout(() => setCaptureFlashVisible(false), 260);
      const hasCurrentLiveValidation = liveCaptureValidation?.view === captureStep
        && liveCaptureValidation?.ok
        && liveCaptureValidation?.metrics;

      if (!hasCurrentLiveValidation) {
        throw new Error("Camera checks are not ready yet. Wait for the guide to confirm the full body is in frame.");
      }

      const captureValidation = liveCaptureValidation?.view === captureStep
        ? {
            ...liveCaptureValidation,
            message: "Photo captured. Review it before analysis.",
            checkedAt: new Date().toISOString(),
          }
        : null;

      setCapturedPhotos((currentPhotos) => ({
        ...currentPhotos,
        [captureStep]: {
          ...photo,
          captureValidation,
          photoCheck: captureValidation,
        },
      }));
      setPhotoCheckStatus(captureValidation.message || "Photo accepted.");
      Speech.stop();

      if (retakeOnlyView) {
        Speech.speak(`${captureStep === "front" ? "Front" : "Side"} photo accepted. Review your photos.`, { rate: 0.92 });
        setRetakeOnlyView(null);
        setTimeout(() => {
          setCaptureCoolingDown(false);
          setScreen("reviewPhotos");
        }, 900);
      } else if (captureStep === "front") {
        Speech.speak("Front photo accepted. Turn to your side for the side photo.", { rate: 0.92 });
        setTimeout(() => {
          setCaptureStep("side");
          setPhotoCheckStatus("");
          resetLiveCaptureCheck("Checking side frame...");
          setSelfInstructionReady(false);
          lastCameraInstructionRef.current = "";
          setCaptureCoolingDown(false);
        }, 1300);
      } else {
        Speech.speak("Side photo accepted. Review your photos.", { rate: 0.92 });
        setTimeout(() => {
          setCaptureCoolingDown(false);
          setScreen("reviewPhotos");
        }, 900);
      }
    } catch (error) {
      setStatus(error.message || `${captureStep === "front" ? "Front" : "Side"} photo could not be captured. Try again.`);
      setPhotoCheckStatus("");
      setCountdown(null);
      if (captureMode === "self") {
        setCaptureRetryPaused(true);
      }
      Speech.stop();
      Speech.speak(`${captureStep === "front" ? "Front" : "Side"} photo could not be captured. Try again.`, { rate: 0.9 });
      setCaptureCoolingDown(false);
    } finally {
      setCapturing(false);
    }
  };

  const handleRetrySelfCapture = () => {
    setStatus("");
    setPhotoCheckStatus("");
    setCountdown(null);
    setCaptureCoolingDown(false);
    setSelfInstructionReady(false);
    resetLiveCaptureCheck("Checking frame...");
    lastCameraInstructionRef.current = "";
    setCaptureRetryPaused(false);
  };

  const handleRetakePhoto = async (view) => {
    if (measurementPhotoSource === "upload") {
      await handleUploadMeasurementPhoto(view);
      return;
    }

    await openCaptureCamera({
      mode: captureMode || (profile?.mode === "client" ? "self" : "assisted"),
      step: view,
      retakeView: view,
    });
  };

  const handleStartPhotoUpload = () => {
    setStatus("");
    setMeasurementPhotoSource("upload");
    setCaptureMode("upload");
    setCaptureStep("front");
    setRetakeOnlyView(null);
    setCameraReady(false);
    setCapturing(false);
    setCountdown(null);
    setCaptureCoolingDown(false);
    setCaptureRetryPaused(false);
    setPhotoCheckStatus("");
    setSelfInstructionReady(false);
    lastCameraInstructionRef.current = "";
    setScreen("reviewPhotos");
  };

  const handleUploadMeasurementPhoto = async (view) => {
    setStatus("");
    setPhotoCheckStatus("");
    setSaving(true);

    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        setStatus("Photo library permission is needed to upload measurement photos.");
        setPhotoCheckStatus("");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.72,
      });

      if (result.canceled || !result.assets?.[0]) {
        setPhotoCheckStatus("");
        return;
      }

      const photo = {
        ...result.assets[0],
        width: result.assets[0].width,
        height: result.assets[0].height,
        fileName: `${view === "front" ? "Front" : "Side"} uploaded photo`,
      };
      const captureValidation = buildPhotoReadyCheck(view, "Photo selected. Review it before analysis.");

      setCapturedPhotos((currentPhotos) => ({
        ...currentPhotos,
        [view]: {
          ...photo,
          captureValidation,
          photoCheck: captureValidation,
        },
      }));
      setPhotoCheckStatus(`${view === "front" ? "Front" : "Side"} photo selected.`);
    } catch (error) {
      setStatus(error.message || `${view === "front" ? "Front" : "Side"} photo could not be selected. Try again.`);
      setPhotoCheckStatus("");
    } finally {
      setSaving(false);
    }
  };

  const handleAnalyzePhotos = async () => {
    const heightCm = heightInputToCm(measurementDetails.height, measurementDetails.heightUnit);

    if (!capturedPhotos.front?.uri || !capturedPhotos.side?.uri) {
      setStatus("Capture front and side photos before analysis.");
      return;
    }

    if (!Number.isFinite(heightCm) || heightCm < 90 || heightCm > 230) {
      setStatus("Enter a valid height before analysis.");
      return;
    }

    if (
      measurementPhotoSource === "camera"
      && (!capturedPhotos.front?.captureValidation?.metrics || !capturedPhotos.side?.captureValidation?.metrics)
    ) {
      setStatus("Retake the photos with the camera guide so the app can verify the full body before analysis.");
      return;
    }

    setSaving(true);
    setStatus("");
    setScreen("processing");

    try {
      const result = await requestMobileMeasurements({
        frontPhoto: capturedPhotos.front,
        sidePhoto: capturedPhotos.side,
        profile: measurementDetails.profile,
        height: heightCm,
      });
      const nextMeasurements = buildMeasurementList(measurementDetails.profile, result.measurements);

      setMeasurementResult(result);
      setGeneratedMeasurements(nextMeasurements);
      setReviewMeasurements(nextMeasurements);
      setMeasurementInputDrafts({});
      setSelectedResultGuideIndex(0);
      setScreen("measurementResult");
    } catch (error) {
      setStatus(error.message || "Measurement analysis failed. Try again.");
      setScreen("reviewPhotos");
    } finally {
      setSaving(false);
    }
  };

  const getMeasurementInputValue = (index, valueCm, unit = "cm") => {
    const draftKey = `${unit}-${index}`;

    if (Object.prototype.hasOwnProperty.call(measurementInputDrafts, draftKey)) {
      return measurementInputDrafts[draftKey];
    }

    return unit === "cm" ? String(valueCm || "") : toDisplayMeasurementValue(valueCm, unit);
  };

  const clearMeasurementInputDraft = (index, unit = "cm") => {
    const draftKey = `${unit}-${index}`;

    setMeasurementInputDrafts((currentDrafts) => {
      if (!Object.prototype.hasOwnProperty.call(currentDrafts, draftKey)) {
        return currentDrafts;
      }

      const nextDrafts = { ...currentDrafts };
      delete nextDrafts[draftKey];
      return nextDrafts;
    });
  };

  const handleReviewMeasurementChange = (index, value, unit = "cm") => {
    const draftKey = `${unit}-${index}`;
    const normalizedValue = value.replace(/,/g, ".");

    setMeasurementInputDrafts((currentDrafts) => ({
      ...currentDrafts,
      [draftKey]: normalizedValue,
    }));

    if (
      normalizedValue === "" ||
      normalizedValue === "." ||
      normalizedValue.endsWith(".")
    ) {
      if (normalizedValue === "") {
        setReviewMeasurements((currentMeasurements) => currentMeasurements.map((measurement, measurementIndex) => (
          measurementIndex === index
            ? { ...measurement, valueCm: "" }
            : measurement
        )));
      }
      return;
    }

    const nextValueCm = unit === "cm" ? normalizedValue : fromDisplayMeasurementValue(normalizedValue, unit);

    if (!Number.isFinite(Number(nextValueCm)) || Number(nextValueCm) <= 0) {
      return;
    }

    setReviewMeasurements((currentMeasurements) => currentMeasurements.map((measurement, measurementIndex) => (
      measurementIndex === index
        ? { ...measurement, valueCm: nextValueCm }
        : measurement
    )));
  };

  const handleSaveManualMeasurement = async () => {
    if (!profile?.id) {
      setStatus("Login again before saving.");
      return;
    }

    if (profile.mode !== "tailor") {
      setStatus("Manual input is available in tailor mode.");
      return;
    }

    const recordLimit = getRecordLimit(profile);

    if (savedRecords.length >= recordLimit) {
      setStatus(`Free plan saves up to ${recordLimit} customer records. Upgrade to Pro when your shop needs more records.`);
      return;
    }

    if (!measurementDetails.customerName.trim()) {
      setStatus("Customer name is required before saving.");
      return;
    }

    const cleanMeasurements = reviewMeasurements
      .map((measurement) => ({
        ...measurement,
        valueCm: roundMeasurement(measurement.valueCm),
      }))
      .filter((measurement) => measurement?.fieldKey !== "acrossBack" && measurement?.valueKey !== "acrossBack")
      .filter((measurement) => Number.isFinite(Number(measurement.valueCm)) && Number(measurement.valueCm) > 0);

    if (cleanMeasurements.length === 0) {
      setStatus("Enter at least one measurement before saving.");
      return;
    }

    setSaving(true);
    setStatus("");

    const result = await saveMobileMeasurement({
      user: profile,
      mode: "tailor",
      profile: measurementDetails.profile,
      measurementDetails: {
        ...measurementDetails,
        height: heightInputToCm(measurementDetails.height, measurementDetails.heightUnit) || measurementDetails.height,
        heightUnit: "cm",
      },
      measurements: cleanMeasurements,
      generatedMeasurements: [],
      warnings: [],
      measurementSource: "manual",
    });

    setSaving(false);

    if (!result.ok) {
      setStatus(result.message);
      return;
    }

    setSavedRecords((currentRecords) => [result.record, ...currentRecords]);
    setStatus("Manual measurement saved.");
    if (canUsePlanFeature(profile, "reminders")) {
      setSavedMeasurementReminderPrompt(result.record);
    } else {
      setScreen("home");
    }
  };

  const resetReminderForm = () => {
    setEditingReminderId(null);
    setReminderForm({
      cloudCustomerId: "",
      customerName: "",
      title: "",
      type: "Fitting",
      dueDate: toDateInputValue(new Date()),
      dueTime: "09:00",
      note: "",
    });
    setStatus("");
  };

  const openReminderForSavedMeasurement = (record) => {
    const dueDate = new Date();
    dueDate.setHours(dueDate.getHours() + 2, 0, 0, 0);

    setSavedMeasurementReminderPrompt(null);
    setEditingReminderId(null);
    setReminderForm({
      cloudCustomerId: record?.cloudCustomerId || "",
      customerName: getRecordCustomerName(record),
      title: "",
      type: "Fitting",
      dueDate: toDateInputValue(dueDate),
      dueTime: toTimeInputValue(dueDate),
      note: "",
    });
    loadSavedRecords({ openScreen: false });
    setStatus("");
    setScreen("reminderForm");
  };

  const skipReminderAfterSave = () => {
    setSavedMeasurementReminderPrompt(null);
    setStatus("");
    setScreen("home");
  };

  const handleEditSavedRecord = (record) => {
    if (!record || record.sharedByClient) {
      return;
    }

    setEditingSavedRecord(record);
    setActiveDraftId(null);
    setMeasurementDetails({
      profile: record.measurementProfile || "female",
      height: record.height ? String(record.height) : "",
      heightUnit: record.heightUnit || "cm",
      customerName: record.fullname || "",
    });
    setGeneratedMeasurements((record.generatedMeasurements || record.measurements || []).filter(isVisibleMeasurement));
    setReviewMeasurements((record.measurements || []).filter(isVisibleMeasurement));
    setMeasurementInputDrafts({});
    setMeasurementResult({
      warnings: cleanPhotoWarnings(record.segmentationWarnings || []),
    });
    setSelectedResultGuideIndex(0);
    setStatus("");
    setScreen("measurementResult");
  };

  const handleEditReminder = (reminder) => {
    const dueDate = reminder.dueAt ? new Date(reminder.dueAt) : new Date();

    loadSavedRecords({ openScreen: false });
    setEditingReminderId(reminder.id);
    setReminderForm({
      cloudCustomerId: reminder.cloudCustomerId || "",
      customerName: reminder.customerName || "",
      title: reminder.title || "",
      type: reminder.type || "Fitting",
      dueDate: toDateInputValue(dueDate),
      dueTime: toTimeInputValue(dueDate),
      note: reminder.note || "",
    });
    setStatus("");
    setScreen("reminderForm");
  };

  const handleSaveReminder = async () => {
    if (!profile?.id || profile.mode !== "tailor") {
      setStatus("Reminders are available in tailor mode.");
      return;
    }

    if (!canUsePlanFeature(profile, "reminders")) {
      setStatus(getUpgradeMessage("Reminders"));
      return;
    }

    if (!reminderForm.title.trim() && !reminderForm.customerName.trim()) {
      setStatus("Add a customer name or reminder title.");
      return;
    }

    if (!reminderForm.dueDate || !reminderForm.dueTime) {
      setStatus("Choose the date and time for this reminder.");
      return;
    }

    const notificationPermission = await requestReminderNotificationPermission();

    if (!notificationPermission.ok) {
      setStatus(notificationPermission.message);
      return;
    }

    const existingReminder = reminders.find((reminder) => reminder.id === editingReminderId);
    const dueAt = new Date(`${reminderForm.dueDate}T${reminderForm.dueTime}`).toISOString();
    const matchedCustomer = findReminderCustomerMatch(savedRecords, reminderForm.customerName);
    const nextReminder = {
      ...(existingReminder || {}),
      id: existingReminder?.id || `reminder-${Date.now()}`,
      cloudCustomerId: reminderForm.cloudCustomerId || matchedCustomer?.cloudCustomerId || "",
      customerName: reminderForm.customerName.trim(),
      title: reminderForm.title.trim(),
      type: reminderForm.type,
      note: reminderForm.note.trim(),
      dueAt,
      status: "open",
      appMode: "tailor",
      updatedAt: new Date().toISOString(),
    };

    setSaving(true);
    setStatus("");

    const result = await saveMobileReminder({
      user: profile,
      reminder: nextReminder,
    });

    setSaving(false);

    if (!result.ok) {
      setStatus(result.message);
      return;
    }

    setReminders((currentReminders) => {
      const exists = currentReminders.some((reminder) => reminder.id === result.reminder.id);
      return exists
        ? currentReminders.map((reminder) => (reminder.id === result.reminder.id ? result.reminder : reminder))
        : [result.reminder, ...currentReminders];
    });
    const notificationResult = await scheduleReminderNotification(result.reminder);

    if (!notificationResult.ok) {
      setStatus(notificationResult.message);
      return;
    }

    resetReminderForm();
    setStatus("Reminder saved.");
    setScreen("reminderList");
  };

  const handleDeleteReminder = async () => {
    if (!reminderToDelete || !profile?.id || saving) {
      return;
    }

    setSaving(true);
    setStatus("");

    const result = await deleteMobileReminder({
      user: profile,
      reminder: reminderToDelete,
    });

    setSaving(false);

    if (!result.ok) {
      setStatus(result.message);
      return;
    }

    await cancelReminderNotification(reminderToDelete);
    setReminders((currentReminders) => currentReminders.filter((reminder) => reminder.id !== reminderToDelete.id));
    setReminderToDelete(null);
    setStatus("Reminder deleted.");
  };

  const resetStyleForm = () => {
    setStyleForm({
      title: "",
      category: "Gown",
      notes: "",
      image: null,
    });
    setNewStyleCategory("");
    setStatus("");
  };

  const handleSaveStyleCategory = async () => {
    const cleanCategory = newStyleCategory.trim();

    if (!canUsePlanFeature(profile, "customStyleCategories")) {
      setStatus(getUpgradeMessage("Custom style categories"));
      return;
    }

    if (!cleanCategory) {
      setStatus("Enter a category name.");
      return;
    }

    if (mergeStyleCategories(customStyleCategories).some((category) => category.toLowerCase() === cleanCategory.toLowerCase())) {
      setStyleForm((currentForm) => ({ ...currentForm, category: cleanCategory }));
      setNewStyleCategory("");
      setStatus("Category selected.");
      return;
    }

    setSaving(true);
    setStatus("");

    const result = await saveMobileStyleCategory({ user: profile, name: cleanCategory });

    setSaving(false);

    if (!result.ok) {
      setStatus(result.message);
      return;
    }

    setCustomStyleCategories((currentCategories) => mergeStyleCategories([...currentCategories, result.category]).filter((category) => (
      !styleCategories.some((defaultCategory) => defaultCategory.toLowerCase() === category.toLowerCase())
    )));
    setStyleForm((currentForm) => ({ ...currentForm, category: result.category }));
    setNewStyleCategory("");
    setStatus("Category added.");
  };

  const handlePickStyleImage = async () => {
    setStatus("");

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      setStatus("Photo library permission is needed to choose a style image.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.72,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    setStyleForm((currentForm) => ({
      ...currentForm,
      image: result.assets[0],
    }));
  };

  const handleSaveStyle = async () => {
    if (!profile?.id) {
      setStatus("Login again before saving.");
      return;
    }

    const plan = getUserPlan(profile);

    if (styleLibrary.length >= plan.styleLimit) {
      setStatus(`Free plan saves up to ${plan.styleLimit} styles. Upgrade to Pro when you need a larger style library.`);
      return;
    }

    if (!styleForm.image?.uri) {
      setStatus("Choose a style image before saving.");
      return;
    }

    setSaving(true);
    setStatus("");

    const result = await saveMobileStyle({
      user: profile,
      style: styleForm,
    });

    setSaving(false);

    if (!result.ok) {
      setStatus(result.message);
      return;
    }

    const refreshedStyles = await fetchMobileStyles({ user: profile });
    setStyleLibrary(refreshedStyles.ok ? refreshedStyles.styles : [result.style, ...styleLibrary]);
    resetStyleForm();
    setStatus("Style saved.");
    setScreen("styleGallery");
  };

  const handleShareStyleCategory = async (category) => {
    if (!profile?.id) {
      setStatus("Login again before sharing.");
      return;
    }

    const result = await createMobileStyleCategoryShare({
      user: profile,
      category,
    });

    if (!result.ok) {
      setStatus(result.message);
      return;
    }

    try {
      await Share.share({
        message: `${profile.fullName || profile.username || "TailorIQ"} shared ${result.category} styles with you:\n${result.url}`,
        url: result.url,
      });
      setStatus("Category link ready to share.");
    } catch {
      setStatus(result.url);
    }
  };

  const handleDeleteStyle = async () => {
    if (!styleToDelete || !profile?.id || saving) {
      return;
    }

    setSaving(true);
    setStatus("");

    const result = await deleteMobileStyle({
      user: profile,
      style: styleToDelete,
    });

    setSaving(false);

    if (!result.ok) {
      setStatus(result.message);
      return;
    }

    setStyleLibrary((currentStyles) => currentStyles.filter((style) => style.id !== styleToDelete.id));
    if (selectedStyle?.id === styleToDelete.id) {
      setSelectedStyle(null);
      setScreen("styleGallery");
    }
    setStyleToDelete(null);
    setStatus("Style deleted.");
  };

  const refreshStyleLibrary = async () => {
    const refreshedStyles = await fetchMobileStyles({ user: profile });

    if (!refreshedStyles.ok) {
      setStatus(refreshedStyles.message);
      return null;
    }

    setStyleLibrary(refreshedStyles.styles);
    return refreshedStyles.styles;
  };

  const handleAttachStyleToCustomer = async (customer) => {
    if (!selectedStyle || !profile?.id || saving) {
      return;
    }

    if (!canUsePlanFeature(profile, "styleAttachments")) {
      openStyleAttachmentUpgradePrompt();
      return;
    }

    setSaving(true);
    setStatus("");

    const result = await attachMobileStyleToCustomer({
      user: profile,
      style: selectedStyle,
      customer,
    });

    setSaving(false);

    if (!result.ok) {
      setStatus(result.message);
      return;
    }

    const refreshedStyles = await refreshStyleLibrary();
    const refreshedStyle = refreshedStyles?.find((style) => style.cloudStyleId === selectedStyle.cloudStyleId);

    if (refreshedStyle) {
      setSelectedStyle(refreshedStyle);
    }

    setStyleAttachSearch("");
    setStatus("Style attached to customer.");
  };

  const handleDetachStyleFromCustomer = async (attachment) => {
    if (!selectedStyle || !profile?.id || saving) {
      return;
    }

    setSaving(true);
    setStatus("");

    const result = await detachMobileStyleFromCustomer({
      user: profile,
      style: selectedStyle,
      attachment,
    });

    setSaving(false);

    if (!result.ok) {
      setStatus(result.message);
      return;
    }

    const refreshedStyles = await refreshStyleLibrary();
    const refreshedStyle = refreshedStyles?.find((style) => style.cloudStyleId === selectedStyle.cloudStyleId);

    if (refreshedStyle) {
      setSelectedStyle(refreshedStyle);
    }

    setStatus("Style detached.");
  };

  const handleSaveMeasurementResult = async () => {
    if (!profile?.id) {
      setStatus("Login again before saving.");
      return;
    }

    if (profile.mode === "tailor" && !measurementDetails.customerName.trim()) {
      setStatus("Customer name is required before saving.");
      return;
    }

    const recordLimit = getRecordLimit(profile);

    if (!editingSavedRecord && savedRecords.length >= recordLimit) {
      setStatus(`Free plan saves up to ${recordLimit} saved record${recordLimit === 1 ? "" : "s"}. Upgrade to Pro when you need more records.`);
      return;
    }

    const keptMeasurementEntries = reviewMeasurements
      .map((measurement, index) => ({ measurement, index }))
      .filter(({ measurement }) => measurement?.fieldKey !== "acrossBack" && measurement?.valueKey !== "acrossBack");
    const cleanMeasurements = keptMeasurementEntries.map(({ measurement }) => ({
      ...measurement,
      valueCm: roundMeasurement(measurement.valueCm),
    }));
    const cleanGeneratedMeasurements = keptMeasurementEntries.map(({ measurement, index }) => generatedMeasurements[index] || measurement);

    setSaving(true);
    setStatus("");

    const result = await saveMobileMeasurement({
      user: profile,
      mode: profile.mode || "client",
      profile: measurementDetails.profile,
      measurementDetails: {
        ...measurementDetails,
        height: heightInputToCm(measurementDetails.height, measurementDetails.heightUnit) || measurementDetails.height,
        heightUnit: "cm",
      },
      measurements: cleanMeasurements,
      generatedMeasurements: cleanGeneratedMeasurements,
      warnings: cleanPhotoWarnings(measurementResult?.warnings || []),
      existingRecord: editingSavedRecord,
    });

    setSaving(false);

    if (!result.ok) {
      setStatus(result.message);
      return;
    }

    setReviewMeasurements(cleanMeasurements);
    setGeneratedMeasurements(cleanGeneratedMeasurements);
    setSavedRecords((currentRecords) => [result.record, ...currentRecords]);
    if (activeDraftId) {
      const draftToClear = measurementDrafts.find((draft) => draft.id === activeDraftId);
      await deleteMobileMeasurementDraft({
        user: profile,
        draft: draftToClear || { cloudDraftId: draftCloudIdsRef.current[activeDraftId] },
      });
      delete draftCloudIdsRef.current[activeDraftId];
      setMeasurementDrafts((currentDrafts) => currentDrafts.filter((draft) => draft.id !== activeDraftId));
      setActiveDraftId(null);
    }
    setStatus(editingSavedRecord ? "Measurement updated." : "Measurement saved.");
    if (editingSavedRecord) {
      setSelectedRecord(result.record);
      setSavedRecords((currentRecords) => currentRecords.map((record) => (
        record.cloudMeasurementId === result.record.cloudMeasurementId || record.id === result.record.id ? result.record : record
      )));
      setEditingSavedRecord(null);
      setScreen("recordDetail");
      return;
    }
    if (profile.mode === "tailor" && canUsePlanFeature(profile, "reminders")) {
      setSavedMeasurementReminderPrompt(result.record);
    }
  };

  const handleDeleteDraft = async () => {
    if (!draftToDelete || !profile?.id || saving) {
      return;
    }

    setSaving(true);
    setStatus("");

    const result = await deleteMobileMeasurementDraft({
      user: profile,
      draft: draftToDelete,
    });

    setSaving(false);

    if (!result.ok) {
      setStatus(result.message);
      return;
    }

    delete draftCloudIdsRef.current[draftToDelete.id];
    setMeasurementDrafts((currentDrafts) => currentDrafts.filter((draft) => draft.id !== draftToDelete.id));
    if (activeDraftId === draftToDelete.id) {
      setActiveDraftId(null);
    }
    setDraftToDelete(null);
    setStatus("Draft deleted.");
  };

  const handleDeleteRecord = async () => {
    if (!recordToDelete || !profile?.id || saving) {
      return;
    }

    setSaving(true);
    setStatus("");

    const result = await deleteMobileMeasurement({
      user: profile,
      record: recordToDelete,
    });

    setSaving(false);

    if (!result.ok) {
      setStatus(result.message);
      return;
    }

    setSavedRecords((currentRecords) => currentRecords.filter((record) => (
      (record.cloudMeasurementId || record.id) !== (recordToDelete.cloudMeasurementId || recordToDelete.id)
    )));

    if ((selectedRecord?.cloudMeasurementId || selectedRecord?.id) === (recordToDelete.cloudMeasurementId || recordToDelete.id)) {
      setSelectedRecord(null);
      setScreen("records");
    }

    setRecordToDelete(null);
    setStatus(result.warning || "Record deleted.");
  };

  const handleShareMeasurements = async (record) => {
    if (!record?.measurements?.length) {
      setStatus("There are no measurements to share yet.");
      return;
    }

    setStatus("");

    try {
      await Share.share({
        title: "TailorIQ measurement summary",
        message: formatMeasurementShareText(record),
      });
    } catch (error) {
      setStatus(error.message || "Sharing failed. Try again.");
    }
  };

  const handleSendToTailor = async () => {
    if (!shareTargetRecord || !profile?.id || saving) {
      return;
    }

    setSaving(true);
    setStatus("");

    const result = await shareMobileMeasurementToUsername({
      user: profile,
      record: shareTargetRecord,
      tailorUsername,
    });

    setSaving(false);

    if (!result.ok) {
      setStatus(result.message);
      return;
    }

    setSharedMeasurements((currentShares) => [result.share, ...currentShares]);
    setShareTargetRecord(null);
    setTailorUsername("");
    setStatus(`Measurement sent to @${result.share.tailorUsername}.`);
  };

  const openSendToTailor = (record) => {
    setStatus("");
    setTailorUsername("");
    setShareTargetRecord(record);
  };

  const deleteConfirmModal = (
    <ConfirmationModal
      visible={Boolean(recordToDelete)}
      title="Delete record?"
      message={`This will remove ${recordToDelete?.fullname || "this measurement"} from your saved records.`}
      confirmLabel={saving ? "Deleting..." : "Delete"}
      confirmTone="danger"
      saving={saving}
      onCancel={() => setRecordToDelete(null)}
      onConfirm={handleDeleteRecord}
    />
  );

  const draftDeleteModal = (
    <ConfirmationModal
      visible={Boolean(draftToDelete)}
      title="Delete draft?"
      message={`This will remove ${draftToDelete?.measurementDetails?.customerName || "this unfinished measurement"}.`}
      confirmLabel={saving ? "Deleting..." : "Delete"}
      confirmTone="danger"
      saving={saving}
      onCancel={() => setDraftToDelete(null)}
      onConfirm={handleDeleteDraft}
    />
  );

  const reminderDeleteModal = (
    <ConfirmationModal
      visible={Boolean(reminderToDelete)}
      title="Delete reminder?"
      message={`This will remove ${reminderToDelete?.title || reminderToDelete?.customerName || "this reminder"}.`}
      confirmLabel={saving ? "Deleting..." : "Delete"}
      confirmTone="danger"
      saving={saving}
      onCancel={() => setReminderToDelete(null)}
      onConfirm={handleDeleteReminder}
    />
  );

  const postSaveReminderModal = (
    <ConfirmationModal
      visible={Boolean(savedMeasurementReminderPrompt)}
      title="Set a reminder?"
      message={`Measurement saved for ${getRecordCustomerName(savedMeasurementReminderPrompt) || "this customer"}. Do you want to add a fitting, pickup, or follow-up reminder now?`}
      cancelLabel="No"
      confirmLabel="Yes, set reminder"
      onCancel={skipReminderAfterSave}
      onConfirm={() => openReminderForSavedMeasurement(savedMeasurementReminderPrompt)}
    />
  );

  const upgradePromptModal = (
    <ConfirmationModal
      visible={Boolean(upgradePrompt)}
      title={upgradePrompt?.title || "Upgrade TailorIQ"}
      message={upgradePrompt?.message}
      cancelLabel="Not now"
      confirmLabel="View plans"
      onCancel={() => setUpgradePrompt(null)}
      onConfirm={() => {
        setUpgradePrompt(null);
        setStatus("");
        setScreen("plans");
      }}
    />
  );

  const styleDeleteModal = (
    <ConfirmationModal
      visible={Boolean(styleToDelete)}
      title="Delete style?"
      message={`This will remove ${styleToDelete?.title || "this saved style"} from your gallery.`}
      confirmLabel={saving ? "Deleting..." : "Delete"}
      confirmTone="danger"
      saving={saving}
      onCancel={() => setStyleToDelete(null)}
      onConfirm={handleDeleteStyle}
    />
  );

  const accountDeleteModal = (
    <ConfirmationModal
      visible={accountDeleteOpen}
      title="Delete account?"
      message="This permanently removes your profile, saved measurements, drafts, reminders, saved styles, shared measurements, and account login."
      confirmLabel={saving ? "Deleting..." : "Delete account"}
      confirmTone="danger"
      confirmDisabled={accountDeleteText.trim().toUpperCase() !== "DELETE"}
      saving={saving}
      onCancel={() => {
        setAccountDeleteOpen(false);
        setAccountDeleteText("");
        setStatus("");
      }}
      onConfirm={handleDeleteAccount}
    >
      <Text style={styles.confirmText}>Type DELETE to confirm.</Text>
      <TextInput
        value={accountDeleteText}
        onChangeText={setAccountDeleteText}
        autoCapitalize="characters"
        placeholder="DELETE"
        placeholderTextColor="#8c8576"
        style={styles.input}
      />
      {status && profileStatusTarget === "account" ? (
        <Text style={styles.actionErrorText}>{status}</Text>
      ) : null}
    </ConfirmationModal>
  );

  const sendToTailorModal = (
    <ConfirmationModal
      visible={Boolean(shareTargetRecord)}
      title="Send to tailor"
      message="Enter the tailor's TailorIQ username. Only the reviewed measurement values will be sent."
      confirmLabel={saving ? "Sending..." : "Send"}
      saving={saving}
      onCancel={() => {
        setShareTargetRecord(null);
        setTailorUsername("");
      }}
      onConfirm={handleSendToTailor}
    >
      <TextInput
        value={tailorUsername}
        onChangeText={setTailorUsername}
        autoCapitalize="none"
        placeholder="Tailor username"
        placeholderTextColor="#8c8576"
        style={styles.input}
      />
      {status ? <Text style={styles.modalStatusText}>{status}</Text> : null}
    </ConfirmationModal>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator color={amber} size="large" />
        <Text style={styles.loadingText}>Opening TailorIQ...</Text>
      </SafeAreaView>
    );
  }

  if (screen === "captureChoice") {
    const isClientMode = profile?.mode === "client";

    return (
      <AppShell isLightMode={isLightMode} active="measure" onNavigate={handleNavigate}>
        <AppHeader isLightMode={isLightMode}
          title="Choose photo source"
          subtitle={isClientMode ? "Use guided camera capture for your measurement photos." : "Use the camera now or upload clear front and side photos."}
          onBack={() => setScreen("home")}
        />

        <View style={styles.modeStack}>
          {status ? <Text style={styles.errorText}>{status}</Text> : null}

          <View style={styles.photoSourceStack}>
            {isClientMode ? (
              <PhotoSourceTile
                icon={User}
                title="Take it myself"
                text="Use the front camera with an automatic countdown."
                onPress={() => {
                  setStatus("");
                  setScreen("selfCaptureSetup");
                }}
                tone="amber"
                primary
              />
            ) : (
              <PhotoSourceTile
                icon={Camera}
                title="Use camera"
                text="Capture front and side photos now."
                onPress={() => openCaptureCamera({ mode: "assisted", step: "front" })}
                tone="amber"
                primary
              />
            )}
            {isClientMode ? (
              <PhotoSourceTile
                icon={Users}
                title="Someone is helping"
                text="Use the back camera with the guided shutter flow."
                onPress={() => openCaptureCamera({ mode: "assisted", step: "front" })}
                tone="blue"
              />
            ) : null}
            {!isClientMode ? (
              <PhotoSourceTile
                icon={Upload}
                title="Upload photos"
                text="Choose existing front and side photos from your gallery."
                onPress={handleStartPhotoUpload}
                tone="teal"
              />
            ) : null}
          </View>
        </View>
      </AppShell>
    );
  }

  if (screen === "selfCaptureSetup") {
    return (
      <AppShell isLightMode={isLightMode} active="measure" onNavigate={handleNavigate}>
        <AppHeader isLightMode={isLightMode}
          title="Set up your phone"
          subtitle="Use this before the automatic front and side capture starts."
          onBack={() => setScreen("captureChoice")}
        />

        <ScrollView contentContainerStyle={styles.reviewContent} showsVerticalScrollIndicator={false}>
          <View style={styles.selfSetupVisual}>
            <View style={styles.selfSetupFloor} />
            <View style={styles.selfSetupBooks}>
              <View style={[styles.selfSetupBook, styles.selfSetupBookGold]} />
              <View style={styles.selfSetupBook} />
              <View style={[styles.selfSetupBook, styles.selfSetupBookDark]} />
            </View>
            <View style={styles.selfSetupPhone}>
              <View style={styles.selfSetupPhoneSpeaker} />
              <View style={styles.selfSetupPhoneGuide} />
            </View>
            <View style={styles.selfSetupPath} />
            <Text style={styles.selfSetupStepsLabel}>5-7 steps</Text>
            <View style={styles.selfSetupPerson}>
              <View style={styles.selfSetupPersonHead} />
              <View style={styles.selfSetupPersonBody} />
              <View style={styles.selfSetupPersonLegs}>
                <View style={styles.selfSetupPersonLeg} />
                <View style={styles.selfSetupPersonLeg} />
              </View>
            </View>
          </View>

          <View style={styles.setupStepList}>
            {selfCaptureSetupSteps.map((step, index) => (
              <View key={step} style={styles.setupStepRow}>
                <View style={styles.setupStepNumber}>
                  <Text style={styles.setupStepNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.setupStepText}>{step}</Text>
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => openCaptureCamera({ mode: "self", step: "front" })}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
          </Pressable>
        </ScrollView>
      </AppShell>
    );
  }

  if (screen === "capture") {
    const captureLabel = captureStep === "front" ? "Front photo" : "Side photo";
    const nextLabel = captureStep === "front" ? "Next: side photo" : "Review photos";
    const cameraFacing = captureMode === "self" ? "front" : "back";
    const isLiveReady = liveCaptureCheck.status === "ready";
    const showShutter = captureMode !== "self" && isLiveReady && !capturing && !captureCoolingDown;
    const cameraGuideImage = measurementDetails.profile === "female" ? captureFemaleStandingGuide : captureStandingGuide;
    const guideReading = capturing
      ? "..."
      : countdown !== null
        ? countdown
        : isLiveReady
          ? "100"
          : liveCaptureCheck.status === "checking"
            ? "..."
          : "0";
    const captureHintText = captureMode === "self"
      ? countdown !== null
        ? "Hold still"
        : captureRetryPaused
          ? "Adjust the phone, then retry"
          : liveCaptureCheck.message || (cameraReady ? "Checking frame..." : "Starting camera...")
      : liveCaptureCheck.message || (cameraReady ? nextLabel : "Starting camera...");

    return (
      <View style={styles.cameraScreen}>
        <StatusBar barStyle="light-content" />
        <CameraView
          key={`${captureMode}-${captureStep}-${retakeOnlyView || "new"}`}
          ref={cameraRef}
          style={styles.cameraView}
          facing={cameraFacing}
          onCameraReady={() => {
            setCameraReady(true);
            setLiveCaptureCheck({
              status: "checking",
              message: "Checking frame...",
            });
          }}
        />
        {captureFlashVisible ? <View key={captureFlashKey} style={styles.captureFlash} /> : null}

        <SafeAreaView style={styles.cameraOverlay}>
          <View style={styles.cameraTopBar}>
            <Pressable
              onPress={() => setScreen("home")}
              style={({ pressed }) => [styles.cameraBackButton, pressed && styles.pressed]}
            >
              <ArrowLeft color="#ffffff" size={25} strokeWidth={2.9} />
            </Pressable>
            <View style={styles.capturePill}>
              <Text style={styles.capturePillText}>{captureLabel}</Text>
            </View>
            <View style={styles.cameraBackButtonPlaceholder} />
          </View>

          <View style={styles.cameraGuideFigureWrap} pointerEvents="none">
            <Image
              source={cameraGuideImage}
              style={[
                styles.cameraGuidePoseImage,
                captureStep === "side" && styles.cameraGuidePoseImageSide,
                isLiveReady && styles.cameraGuidePoseImageReady,
              ]}
              resizeMode="contain"
            />
            <View style={[styles.cameraGuideReading, isLiveReady && styles.cameraGuideReadingReady]}>
              <Text style={styles.cameraGuideReadingText}>{guideReading}</Text>
            </View>
          </View>

          {status ? <Text style={styles.cameraErrorText}>{status}</Text> : null}

          <View style={styles.captureFooter}>
            <Text style={styles.captureHint}>{captureHintText}</Text>
            {captureRetryPaused ? (
              <Pressable
                onPress={handleRetrySelfCapture}
                style={({ pressed }) => [styles.cameraRetryButton, pressed && styles.pressed]}
              >
                <Text style={styles.cameraRetryButtonText}>Retry</Text>
              </Pressable>
            ) : null}
            {showShutter ? (
              <Pressable
                disabled={!cameraReady || capturing}
                onPress={handleCapturePhoto}
                style={({ pressed }) => [
                  styles.shutterOuter,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.shutterInner} />
              </Pressable>
            ) : null}
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (screen === "reviewPhotos") {
    const isUploadFlow = measurementPhotoSource === "upload";

    return (
      <AppShell isLightMode={isLightMode} active="measure" onNavigate={handleNavigate}>
        <AppHeader isLightMode={isLightMode}
          title={isUploadFlow ? "Upload photos" : "Review capture"}
          subtitle={isUploadFlow
            ? "Choose clear front and side photos, then run analysis."
            : "Check the photos, add the height anchor, then run analysis."}
          onBack={() => setScreen("home")}
        />

        <ScrollView contentContainerStyle={styles.reviewContent}>
          <View style={styles.detailsPanel}>
            <Text style={styles.detailsTitle}>Measurement setup</Text>
            <Text style={styles.detailsText}>Use the real height in cm. The final values can still be reviewed before saving.</Text>
            {profile?.mode === "tailor" && (
              <TextInput
                value={measurementDetails.customerName}
                onChangeText={(customerName) => setMeasurementDetails((currentDetails) => ({
                  ...currentDetails,
                  customerName,
                }))}
                placeholder="Customer name"
                placeholderTextColor="#8c8576"
                style={styles.input}
              />
            )}
            <View style={styles.segmentedRow}>
              {["female", "male"].map((profileOption) => (
                <Pressable
                  key={profileOption}
                  onPress={() => setMeasurementDetails((currentDetails) => ({
                    ...currentDetails,
                    profile: profileOption,
                  }))}
                  style={[
                    styles.segmentedOption,
                    measurementDetails.profile === profileOption && styles.segmentedOptionActive,
                  ]}
                >
                  <Text style={[
                    styles.segmentedOptionText,
                    measurementDetails.profile === profileOption && styles.segmentedOptionTextActive,
                  ]}
                  >
                    {profileOption === "female" ? "Female" : "Male"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.segmentedRow}>
              {["cm", "in", "ft"].map((heightUnit) => (
                <Pressable
                  key={heightUnit}
                  onPress={() => setMeasurementDetails((currentDetails) => ({
                    ...currentDetails,
                    heightUnit,
                  }))}
                  style={[
                    styles.segmentedOption,
                    measurementDetails.heightUnit === heightUnit && styles.segmentedOptionActive,
                  ]}
                >
                  <Text style={[
                    styles.segmentedOptionText,
                    measurementDetails.heightUnit === heightUnit && styles.segmentedOptionTextActive,
                  ]}
                  >
                    {heightUnit === "cm" ? "cm" : heightUnit === "in" ? "inches" : "feet"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={measurementDetails.height}
              onChangeText={(height) => setMeasurementDetails((currentDetails) => ({
                ...currentDetails,
                height,
              }))}
              keyboardType="decimal-pad"
              placeholder={getHeightPlaceholder(measurementDetails.heightUnit)}
              placeholderTextColor="#8c8576"
              style={styles.input}
            />
          </View>

          {["front", "side"].map((view) => (
            <View key={view} style={styles.photoCard}>
              {(() => {
                const validation = capturedPhotos[view]?.captureValidation || capturedPhotos[view]?.photoCheck;

                return (
                  <>
              <View style={styles.photoCardHeader}>
                <Text style={styles.photoTitle}>{view === "front" ? "Front view" : "Side view"}</Text>
                <Pressable
                  disabled={saving}
                  onPress={() => (isUploadFlow ? handleUploadMeasurementPhoto(view) : handleRetakePhoto(view))}
                  style={({ pressed }) => [styles.retakeButton, pressed && styles.pressed]}
                >
                  <Text style={styles.retakeButtonText}>
                    {capturedPhotos[view]?.uri ? (isUploadFlow ? "Replace" : "Retake") : "Choose"}
                  </Text>
                </Pressable>
              </View>

              {capturedPhotos[view]?.uri ? (
                <Image
                  source={{ uri: capturedPhotos[view].uri }}
                  style={styles.photoPreview}
                  resizeMode="contain"
                />
              ) : (
                <Pressable
                  disabled={saving}
                  onPress={() => (isUploadFlow ? handleUploadMeasurementPhoto(view) : handleRetakePhoto(view))}
                  style={({ pressed }) => [styles.emptyPhotoPreview, pressed && styles.pressed]}
                >
                  <Text style={styles.emptyPhotoText}>No photo yet</Text>
                  {isUploadFlow ? <Text style={styles.emptyPhotoHint}>Tap to choose {view} photo</Text> : null}
                </Pressable>
              )}
              {cleanPhotoMessage(validation?.message) ? (
                <Text style={styles.photoCheckText}>{cleanPhotoMessage(validation.message)}</Text>
              ) : null}
              {cleanPhotoWarnings(validation?.warnings || []).length ? (
                <Text style={styles.photoWarningText}>{cleanPhotoWarnings(validation.warnings).join(" ")}</Text>
              ) : null}
                  </>
                );
              })()}
            </View>
          ))}

          <Pressable
            disabled={!capturedPhotos.front?.uri || !capturedPhotos.side?.uri}
            onPress={handleAnalyzePhotos}
            style={({ pressed }) => [
              styles.primaryButton,
              (!capturedPhotos.front?.uri || !capturedPhotos.side?.uri) && styles.disabledButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>Continue to analysis</Text>
          </Pressable>
          {status ? <Text style={styles.actionErrorText}>{status}</Text> : null}
          {photoCheckStatus ? <Text style={styles.actionNoticeText}>{photoCheckStatus}</Text> : null}
        </ScrollView>
      </AppShell>
    );
  }

  if (screen === "manualChoice") {
    return (
      <AppShell isLightMode={isLightMode} active="measure" onNavigate={handleNavigate}>
        <AppHeader isLightMode={isLightMode}
          title="Manual measurement"
          subtitle="Choose how you want to enter tape measurements."
          onBack={() => setScreen("home")}
        />

        <ScrollView contentContainerStyle={styles.reviewContent}>
          <View style={styles.photoSourceStack}>
          <PhotoSourceTile
            icon={Ruler}
            title="Type manually"
            text="Enter each measurement from your tape."
            onPress={() => openManualInputForm({ reset: true })}
            tone="amber"
            primary
          />
          <PhotoSourceTile
            icon={ScanText}
            title="Paste shorthand"
            text="Import notes like B 36, W 30, H 42, SL 23."
            onPress={() => {
              openManualInputForm({ reset: true });
              setManualImportText("");
              setStatus("Paste your note, choose cm or inches, then tap Import.");
            }}
            tone="teal"
          />
          </View>
        </ScrollView>
      </AppShell>
    );
  }

  if (screen === "manualInput") {
    return (
      <AppShell isLightMode={isLightMode} active="measure" onNavigate={handleNavigate}>
        <AppHeader isLightMode={isLightMode}
          title="Manual input"
          subtitle="Enter measurements taken with a tape, then save the customer record."
          onBack={() => setScreen("manualChoice")}
        />

        <ScrollView contentContainerStyle={styles.reviewContent} keyboardShouldPersistTaps="handled">
          <View style={styles.detailsPanel}>
            <Text style={styles.detailsTitle}>Customer details</Text>
            <TextInput
              value={measurementDetails.customerName}
              onChangeText={(customerName) => setMeasurementDetails((currentDetails) => ({
                ...currentDetails,
                customerName,
              }))}
              placeholder="Customer name"
              placeholderTextColor="#8c8576"
              style={styles.input}
            />
            <TextInput
              value={measurementDetails.height}
              onChangeText={(height) => setMeasurementDetails((currentDetails) => ({
                ...currentDetails,
                height,
              }))}
              keyboardType="decimal-pad"
              placeholder={`${getHeightPlaceholder(measurementDetails.heightUnit)} optional`}
              placeholderTextColor="#8c8576"
              style={styles.input}
            />
            <View style={styles.segmentedRow}>
              {["cm", "in", "ft"].map((heightUnit) => (
                <Pressable
                  key={heightUnit}
                  onPress={() => setMeasurementDetails((currentDetails) => ({
                    ...currentDetails,
                    heightUnit,
                  }))}
                  style={[
                    styles.segmentedOption,
                    measurementDetails.heightUnit === heightUnit && styles.segmentedOptionActive,
                  ]}
                >
                  <Text style={[
                    styles.segmentedOptionText,
                    measurementDetails.heightUnit === heightUnit && styles.segmentedOptionTextActive,
                  ]}
                  >
                    {heightUnit === "cm" ? "cm" : heightUnit === "in" ? "inches" : "feet"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.segmentedRow}>
              {["female", "male"].map((profileOption) => (
                <Pressable
                  key={profileOption}
                  onPress={() => handleManualProfileChange(profileOption)}
                  style={[
                    styles.segmentedOption,
                    measurementDetails.profile === profileOption && styles.segmentedOptionActive,
                  ]}
                >
                  <Text style={[
                    styles.segmentedOptionText,
                    measurementDetails.profile === profileOption && styles.segmentedOptionTextActive,
                  ]}
                  >
                    {profileOption === "female" ? "Female" : "Male"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.detailsPanel}>
            <Text style={styles.detailsTitle}>Paste shorthand</Text>
            <Text style={styles.detailsText}>
              Use labels or shorthand. Ambiguous codes will ask before filling any field.
            </Text>
            <View style={styles.segmentedRow}>
              {["cm", "in"].map((unit) => (
                <Pressable
                  key={unit}
                  onPress={() => setManualImportUnit(unit)}
                  style={[
                    styles.segmentedOption,
                    manualImportUnit === unit && styles.segmentedOptionActive,
                  ]}
                >
                  <Text style={[
                    styles.segmentedOptionText,
                    manualImportUnit === unit && styles.segmentedOptionTextActive,
                  ]}
                  >
                    {unit === "cm" ? "cm" : "inches"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={manualImportText}
              onChangeText={setManualImportText}
              placeholder="Example: Name: Florence, B 36, W 30, H 42, SL 23"
              placeholderTextColor="#8c8576"
              multiline
              style={[styles.input, styles.noteInput]}
            />
            <Pressable
              onPress={handleImportManualText}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryButtonText}>Import shorthand</Text>
            </Pressable>
            {status && isManualImportStatus(status) ? (
              <Text style={isPositiveStatus(status) ? styles.actionSuccessText : styles.actionErrorText}>{status}</Text>
            ) : null}

            {manualImportAmbiguities.length > 0 ? (
              <View style={styles.ambiguityStack}>
                {manualImportAmbiguities.map((ambiguity) => (
                  <View key={ambiguity.id} style={styles.ambiguityCard}>
                    <Text style={styles.ambiguityTitle}>
                      {ambiguity.label} could mean {ambiguity.options.map((option) => option.label).join(" or ")}.
                    </Text>
                    <View style={styles.reminderTypeGrid}>
                      {ambiguity.options.map((option) => (
                        <Pressable
                          key={option.key}
                          onPress={() => handleResolveManualAmbiguity(ambiguity, option.key)}
                          style={styles.reminderTypeOption}
                        >
                          <Text style={styles.reminderTypeText}>{option.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {manualImportUnmatched.length > 0 ? (
              <Text style={styles.photoWarningText}>
                Not recognized: {manualImportUnmatched.join("; ")}
              </Text>
            ) : null}
          </View>

          <View style={styles.resultGrid}>
            {reviewMeasurements.map((measurement, index) => (
              <View key={`${measurement.group}-${measurement.fieldKey}-${index}`} style={styles.resultItem}>
                <Text style={styles.resultName}>{measurement.label}</Text>
                <View style={styles.resultInputRow}>
                  <TextInput
                    value={getMeasurementInputValue(index, measurement.valueCm, "cm")}
                    onChangeText={(value) => handleReviewMeasurementChange(index, value, "cm")}
                    onBlur={() => clearMeasurementInputDraft(index, "cm")}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor="#8c8576"
                    style={styles.resultInput}
                  />
                  <Text style={styles.resultUnit}>cm</Text>
                </View>
                <Text style={styles.generatedText}>{measurement.note}</Text>
              </View>
            ))}
          </View>

          <Pressable
            disabled={saving}
            onPress={handleSaveManualMeasurement}
            style={({ pressed }) => [
              styles.primaryButton,
              saving && styles.disabledButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>{saving ? "Saving..." : "Save manual record"}</Text>
          </Pressable>
          {status && isManualSaveStatus(status) ? (
            <Text style={isPositiveStatus(status) ? styles.actionSuccessText : styles.actionErrorText}>{status}</Text>
          ) : null}
        </ScrollView>
        {postSaveReminderModal}
      </AppShell>
    );
  }

  if (screen === "processing") {
    return (
      <SafeAreaView style={styles.processingScreen}>
        <StatusBar barStyle="light-content" />
        <View style={styles.processingCard}>
          <BrandMark compact light={isLightMode} />
          <View style={styles.scanRing}>
            <ActivityIndicator color={amber} size="large" />
          </View>
          <Text style={styles.loadingText}>Analyzing photos...</Text>
          <Text style={styles.processingText}>
            Reading the body outline, checking proportions, and preparing values for review.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (screen === "measurementResult") {
    const visibleReviewEntries = reviewMeasurements
      .map((measurement, index) => ({ measurement, index }))
      .filter(({ measurement }) => isVisibleMeasurement(measurement));
    const selectedReviewEntry =
      visibleReviewEntries.find((entry) => entry.index === selectedResultGuideIndex) || visibleReviewEntries[0];
    const measurementGroups = groupMeasurements(reviewMeasurements);
    const measurementSummary = getMeasurementSummary(reviewMeasurements);
    const selectedReviewMeasurement = selectedReviewEntry?.measurement;
    const selectedReviewIndex = selectedReviewEntry?.index ?? 0;
    const selectedGeneratedValue = generatedMeasurements[selectedReviewIndex]?.valueCm || selectedReviewMeasurement?.valueCm;
    const currentResultRecord = {
      fullname: profile?.mode === "tailor"
        ? measurementDetails.customerName.trim()
        : profile?.fullName || profile?.username || "My measurement",
      measurementProfile: measurementDetails.profile,
      measurements: reviewMeasurements.filter(isVisibleMeasurement).map((measurement) => ({
        ...measurement,
        valueCm: roundMeasurement(measurement.valueCm),
      })),
      updatedAt: new Date().toISOString(),
    };

    return (
      <AppShell isLightMode={isLightMode} active="measure" onNavigate={handleNavigate}>
        <AppHeader isLightMode={isLightMode}
          title={editingSavedRecord ? "Edit measurement" : "Measurement result"}
          subtitle={editingSavedRecord ? "Update the saved values, then save changes." : "Review generated values, correct where needed, then save."}
          onBack={() => setScreen(editingSavedRecord ? "recordDetail" : "reviewPhotos")}
        />

        <ScrollView contentContainerStyle={styles.reviewContent}>
          <View style={styles.resultHero}>
            <Text style={styles.resultHeroKicker}>{profile?.mode === "client" ? "Personal result" : "Client result"}</Text>
            <Text style={styles.resultHeroTitle}>{currentResultRecord.fullname || "Measurement review"}</Text>
            <Text style={styles.resultHeroMeta}>
              {measurementDetails.profile === "female" ? "Female" : "Male"} - {measurementSummary.filled}/{measurementSummary.total} values ready
            </Text>
          </View>

          <ResultControls
            viewMode={resultViewMode}
            unit={resultUnit}
            onChangeViewMode={setResultViewMode}
            onChangeUnit={setResultUnit}
          />

          {resultViewMode === "guide" ? (
            <>
              <ResultBodyGuide
                profileId={measurementDetails.profile}
                selectedMeasurement={selectedReviewMeasurement}
              />
              <ResultGuidePicker
                measurements={reviewMeasurements}
                selectedIndex={selectedResultGuideIndex}
                onSelect={setSelectedResultGuideIndex}
              />
              {selectedReviewMeasurement ? (
                <View style={styles.focusMeasurementCard}>
                  <Text style={styles.focusMeasurementLabel}>{selectedReviewMeasurement.label}</Text>
                  <View style={styles.resultInputRow}>
                    <TextInput
                      value={getMeasurementInputValue(selectedReviewIndex, selectedReviewMeasurement.valueCm, resultUnit)}
                      onChangeText={(value) => {
                        handleReviewMeasurementChange(
                          selectedReviewIndex,
                          value,
                          resultUnit
                        );
                      }}
                      onBlur={() => clearMeasurementInputDraft(selectedReviewIndex, resultUnit)}
                      keyboardType="decimal-pad"
                      style={styles.resultInput}
                    />
                    <Text style={styles.resultUnit}>{resultUnit}</Text>
                  </View>
                  <Text style={styles.generatedText}>
                    Generated {toDisplayMeasurementValue(selectedGeneratedValue, resultUnit)} {resultUnit}
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            measurementGroups.map((group) => (
              <View key={group.title} style={styles.measurementGroup}>
                <View style={styles.measurementGroupHeader}>
                  <Text style={styles.measurementGroupTitle}>{group.title}</Text>
                  <Text style={styles.measurementGroupCount}>{group.items.length}</Text>
                </View>
                <View style={styles.resultGrid}>
                  {group.items.map((measurement) => {
                    const originalIndex = reviewMeasurements.findIndex((item) => item === measurement);
                    const generatedValue = generatedMeasurements[originalIndex]?.valueCm || measurement.valueCm;

                    return (
                      <Pressable
                        key={`${measurement.group}-${measurement.fieldKey}-${originalIndex}`}
                        onPress={() => setSelectedResultGuideIndex(originalIndex)}
                        style={[
                          styles.resultItem,
                          selectedResultGuideIndex === originalIndex && styles.resultItemActive,
                        ]}
                      >
                        <Text style={styles.resultName}>{measurement.label}</Text>
                        <View style={styles.resultInputRow}>
                          <TextInput
                            value={getMeasurementInputValue(originalIndex, measurement.valueCm, resultUnit)}
                            onChangeText={(value) => {
                              handleReviewMeasurementChange(
                                originalIndex,
                                value,
                                resultUnit
                              );
                            }}
                            onBlur={() => clearMeasurementInputDraft(originalIndex, resultUnit)}
                            keyboardType="decimal-pad"
                            style={styles.resultInput}
                          />
                          <Text style={styles.resultUnit}>{resultUnit}</Text>
                        </View>
                        <Text style={styles.generatedText}>
                          Generated {toDisplayMeasurementValue(generatedValue, resultUnit)} {resultUnit}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))
          )}

          <Pressable
            disabled={saving}
            onPress={handleSaveMeasurementResult}
            style={({ pressed }) => [
              styles.primaryButton,
              saving && styles.disabledButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>{saving ? "Saving..." : editingSavedRecord ? "Save changes" : "Save measurement"}</Text>
          </Pressable>
          {status ? (
            <Text style={isPositiveStatus(status) ? styles.actionSuccessText : styles.actionErrorText}>{status}</Text>
          ) : null}

          <View style={styles.actionButtonRow}>
            <Pressable
              onPress={() => handleShareMeasurements(currentResultRecord)}
              style={({ pressed }) => [styles.shareButton, styles.actionButtonHalf, pressed && styles.pressed]}
            >
              <Text style={styles.shareButtonText}>Copy / share</Text>
            </Pressable>
            {profile?.mode === "client" ? (
              <Pressable
                onPress={() => openSendToTailor(currentResultRecord)}
                style={({ pressed }) => [styles.secondaryButton, styles.actionButtonHalf, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryButtonText}>Send to tailor</Text>
              </Pressable>
            ) : null}
          </View>

          <Pressable onPress={() => setScreen("home")} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Back home</Text>
          </Pressable>
        </ScrollView>
        {sendToTailorModal}
        {postSaveReminderModal}
      </AppShell>
    );
  }

  if (screen === "records") {
    const receivedShares = sharedMeasurements.filter((share) => share.isReceived);
    const plan = getUserPlan(profile);

    return (
      <AppShell isLightMode={isLightMode} active="records" onNavigate={handleNavigate}>
        <AppHeader isLightMode={isLightMode}
          title={profile?.mode === "client" ? "My saved result" : "Saved records"}
          subtitle={profile?.mode === "client"
            ? "Open your latest approved measurements."
            : "Open customer measurements saved from mobile."}
        />

        <ScrollView contentContainerStyle={styles.reviewContent}>
          {status ? <Text style={styles.errorText}>{status}</Text> : null}
          <PlanUsageMeter
            count={savedRecords.length}
            isLightMode={isLightMode}
            label="Saved records"
            limit={getRecordLimit(profile)}
          />

          {recordsLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={amber} size="large" />
              <Text style={styles.emptyStateText}>Loading saved records...</Text>
            </View>
          ) : savedRecords.length === 0 && receivedShares.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>No saved records yet</Text>
              <Text style={styles.emptyStateText}>Start a measurement, review the values, then save it here.</Text>
              <Pressable onPress={handleStartMeasurement} style={styles.heroButton}>
                <Text style={styles.heroButtonText}>New measurement</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {receivedShares.length > 0 && (
                <View style={styles.sharedSection}>
                  <Text style={styles.sectionLabel}>Sent by clients</Text>
                  {receivedShares.map((share) => (
                    <View
                      key={share.cloudShareId || share.id}
                      style={styles.recordCard}
                    >
                      <View style={styles.recordAvatar}>
                        <Text style={styles.recordAvatarText}>{getRecordInitials(share.customer.fullname || share.senderUsername)}</Text>
                      </View>
                      <View style={styles.recordBody}>
                        <Text style={styles.recordName}>{share.customer.fullname || "Shared measurement"}</Text>
                        <View style={styles.recordChipRow}>
                          <Text style={styles.recordChip}>@{share.senderUsername || "client"}</Text>
                          <Text style={styles.recordChip}>{share.customer.measurements?.length || 0} values</Text>
                        </View>
                        <Text style={styles.recordDate}>{formatShortDate(share.updatedAt || share.createdAt)}</Text>
                      </View>
                      <RecordActionButton
                      onPress={() => {
                        setSelectedRecord({
                          ...share.customer,
                          sharedByClient: true,
                          senderUsername: share.senderUsername,
                        });
                        setSelectedResultGuideIndex(0);
                        setScreen("recordDetail");
                      }}
                        label="View"
                        Icon={BookOpen}
                      />
                    </View>
                  ))}
                </View>
              )}

              {savedRecords.map((record) => (
                <View
                  key={record.cloudMeasurementId || record.id}
                  style={styles.recordCard}
                >
                  <View style={styles.recordAvatar}>
                    <Text style={styles.recordAvatarText}>{getRecordInitials(record.fullname)}</Text>
                  </View>
                  <View style={styles.recordBody}>
                    <Text style={styles.recordName}>{record.fullname || "My measurement"}</Text>
                    <View style={styles.recordChipRow}>
                      <Text style={styles.recordChip}>{record.measurementProfile === "female" ? "Female" : "Male"}</Text>
                      <Text style={styles.recordChip}>{record.measurements?.length || 0} values</Text>
                    </View>
                    <Text style={styles.recordDate}>{formatShortDate(record.updatedAt || record.createdAt)}</Text>
                  </View>
                  <View style={styles.recordActionStack}>
                    <RecordActionButton
                      onPress={() => {
                        setSelectedRecord(record);
                        setSelectedResultGuideIndex(0);
                        setScreen("recordDetail");
                      }}
                      label="View"
                      Icon={BookOpen}
                    />
                    <RecordActionButton
                      onPress={() => setRecordToDelete(record)}
                      label="Delete"
                      Icon={Trash2}
                      danger
                    />
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
        {deleteConfirmModal}
      </AppShell>
    );
  }

  if (screen === "recordDetail" && selectedRecord) {
    const selectedRecordGroups = groupMeasurements(selectedRecord.measurements || []);
    const selectedRecordSummary = getMeasurementSummary(selectedRecord.measurements || []);
    const selectedRecordMeasurements = (selectedRecord.measurements || []).filter(isVisibleMeasurement);
    const selectedRecordEntries = (selectedRecord.measurements || [])
      .map((measurement, index) => ({ measurement, index }))
      .filter(({ measurement }) => isVisibleMeasurement(measurement));
    const selectedRecordEntry =
      selectedRecordEntries.find((entry) => entry.index === selectedResultGuideIndex) || selectedRecordEntries[0];
    const selectedRecordMeasurement = selectedRecordEntry?.measurement;
    const selectedRecordOriginalIndex = selectedRecordEntry?.index ?? 0;
    const selectedRecordGeneratedValue =
      selectedRecord.generatedMeasurements?.[selectedRecordOriginalIndex]?.valueCm || selectedRecordMeasurement?.valueCm;

    return (
      <AppShell isLightMode={isLightMode} active="records" onNavigate={handleNavigate}>
        <AppHeader isLightMode={isLightMode}
          title={selectedRecord.fullname || "Measurement"}
          subtitle={`${selectedRecord.measurementProfile === "female" ? "Female" : "Male"} measurement record`}
          onBack={() => setScreen("records")}
        />

        <ScrollView contentContainerStyle={styles.reviewContent}>
          <View style={styles.resultHero}>
            <Text style={styles.resultHeroKicker}>{selectedRecord.sharedByClient ? "Shared record" : "Saved record"}</Text>
            <Text style={styles.resultHeroTitle}>{selectedRecord.fullname || "Measurement"}</Text>
            <Text style={styles.resultHeroMeta}>
              {selectedRecord.measurementProfile === "female" ? "Female" : "Male"} - {selectedRecordSummary.filled}/{selectedRecordSummary.total} values - {formatShortDate(selectedRecord.updatedAt || selectedRecord.createdAt)}
            </Text>
          </View>

          <ResultControls
            viewMode={resultViewMode}
            unit={resultUnit}
            onChangeViewMode={setResultViewMode}
            onChangeUnit={setResultUnit}
          />

          {resultViewMode === "guide" ? (
            <>
              <ResultBodyGuide
                profileId={selectedRecord.measurementProfile}
                selectedMeasurement={selectedRecordMeasurement}
              />
              <ResultGuidePicker
                measurements={selectedRecord.measurements || []}
                selectedIndex={selectedResultGuideIndex}
                onSelect={setSelectedResultGuideIndex}
              />
              {selectedRecordMeasurement ? (
                <View style={styles.focusMeasurementCard}>
                  <Text style={styles.focusMeasurementLabel}>{selectedRecordMeasurement.label}</Text>
                  <Text style={styles.savedValueText}>
                    {toDisplayMeasurementValue(selectedRecordMeasurement.valueCm, resultUnit)} {resultUnit}
                  </Text>
                  {selectedRecordGeneratedValue ? (
                    <Text style={styles.generatedText}>
                      Generated {toDisplayMeasurementValue(selectedRecordGeneratedValue, resultUnit)} {resultUnit}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </>
          ) : (
            selectedRecordGroups.map((group) => (
              <View key={group.title} style={styles.measurementGroup}>
                <View style={styles.measurementGroupHeader}>
                  <Text style={styles.measurementGroupTitle}>{group.title}</Text>
                  <Text style={styles.measurementGroupCount}>{group.items.length}</Text>
                </View>
                <View style={styles.resultGrid}>
                  {group.items.map((measurement) => {
                    const originalIndex = (selectedRecord.measurements || []).findIndex((item) => item === measurement);

                    return (
                      <Pressable
                        key={`${measurement.group}-${measurement.fieldKey}-${originalIndex}`}
                        onPress={() => setSelectedResultGuideIndex(originalIndex)}
                        style={[
                          styles.resultItem,
                          selectedResultGuideIndex === originalIndex && styles.resultItemActive,
                        ]}
                      >
                        <Text style={styles.resultName}>{measurement.label}</Text>
                        <Text style={styles.savedValueText}>
                          {toDisplayMeasurementValue(measurement.valueCm, resultUnit)} {resultUnit}
                        </Text>
                        {selectedRecord.generatedMeasurements?.[originalIndex]?.valueCm ? (
                          <Text style={styles.generatedText}>
                            Generated {toDisplayMeasurementValue(selectedRecord.generatedMeasurements[originalIndex].valueCm, resultUnit)} {resultUnit}
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))
          )}

          <View style={styles.actionButtonRow}>
            {!selectedRecord.sharedByClient ? (
              <Pressable
                onPress={() => handleEditSavedRecord(selectedRecord)}
                style={({ pressed }) => [styles.secondaryButton, styles.actionButtonHalf, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryButtonText}>Edit</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => handleShareMeasurements(selectedRecord)}
              style={({ pressed }) => [styles.shareButton, styles.actionButtonHalf, pressed && styles.pressed]}
            >
              <Text style={styles.shareButtonText}>Copy / share</Text>
            </Pressable>
            {profile?.mode === "client" ? (
              <Pressable
                onPress={() => openSendToTailor(selectedRecord)}
                style={({ pressed }) => [styles.secondaryButton, styles.actionButtonHalf, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryButtonText}>Send to tailor</Text>
              </Pressable>
            ) : null}
          </View>

          {!selectedRecord.sharedByClient ? (
            <Pressable
              onPress={() => setRecordToDelete(selectedRecord)}
              style={({ pressed }) => [styles.deleteWideButton, pressed && styles.recordDeleteButtonPressed]}
            >
              <Trash2 color="#C83434" size={15} strokeWidth={2.7} />
              <Text style={styles.recordDeleteText}>Delete record</Text>
            </Pressable>
          ) : null}
        </ScrollView>
        {deleteConfirmModal}
        {sendToTailorModal}
      </AppShell>
    );
  }

  if (screen === "drafts") {
    const plan = getUserPlan(profile);

    return (
      <DraftsScreen
        deleteModal={draftDeleteModal}
        draftsLoading={draftsLoading}
        isLightMode={isLightMode}
        measurementDrafts={measurementDrafts}
        onBack={() => setScreen("home")}
        onContinueDraft={handleContinueDraft}
        onDeleteDraft={setDraftToDelete}
        onNavigate={handleNavigate}
        onNewMeasurement={handleStartMeasurement}
        plan={plan}
        profile={profile}
        status={status}
      />
    );
  }

  if (screen === "reminders") {
    return (
      <RemindersHomeScreen
        isLightMode={isLightMode}
        onBack={() => setScreen("home")}
        onNavigate={handleNavigate}
        onOpenForm={() => {
          resetReminderForm();
          loadSavedRecords({ openScreen: false });
          setScreen("reminderForm");
        }}
        onOpenList={() => {
          loadReminders();
          setScreen("reminderList");
        }}
        reminders={reminders}
        status={status}
      />
    );
  }

  if (screen === "reminderForm") {
    return (
      <ReminderFormScreen
        editingReminderId={editingReminderId}
        isLightMode={isLightMode}
        isPositiveStatus={isPositiveStatus}
        onBack={() => setScreen("reminders")}
        onNavigate={handleNavigate}
        onSaveReminder={handleSaveReminder}
        recordsLoading={recordsLoading}
        reminderForm={reminderForm}
        savedRecords={savedRecords}
        saving={saving}
        setReminderForm={setReminderForm}
        status={status}
      />
    );
  }

  if (screen === "reminderList") {
    return (
      <ReminderListScreen
        deleteModal={reminderDeleteModal}
        isLightMode={isLightMode}
        onBack={() => setScreen("reminders")}
        onDeleteReminder={setReminderToDelete}
        onEditReminder={handleEditReminder}
        onNavigate={handleNavigate}
        onNewReminder={() => {
          resetReminderForm();
          setScreen("reminderForm");
          loadSavedRecords({ openScreen: false });
        }}
        reminders={reminders}
        remindersLoading={remindersLoading}
        status={status}
      />
    );
  }

  if (screen === "styles") {
    const plan = getUserPlan(profile);

    return (
      <StylesHomeScreen
        isLightMode={isLightMode}
        onBack={() => setScreen("home")}
        onNavigate={handleNavigate}
        onOpenForm={() => {
          resetStyleForm();
          setScreen("styleForm");
        }}
        onOpenGallery={() => {
          loadStyleLibrary();
          loadSavedRecords({ openScreen: false });
          setScreen("styleGallery");
        }}
        plan={plan}
        profile={profile}
        status={status}
        styleLibrary={styleLibrary}
      />
    );
  }

  if (screen === "styleForm") {
    return (
      <StyleFormScreen
        customStyleCategories={customStyleCategories}
        isLightMode={isLightMode}
        isPositiveStatus={isPositiveStatus}
        newStyleCategory={newStyleCategory}
        onBack={() => setScreen("styles")}
        onNavigate={handleNavigate}
        onPickStyleImage={handlePickStyleImage}
        onSaveCategory={handleSaveStyleCategory}
        onSaveStyle={handleSaveStyle}
        profile={profile}
        saving={saving}
        setNewStyleCategory={setNewStyleCategory}
        setStyleForm={setStyleForm}
        status={status}
        styleForm={styleForm}
      />
    );
  }

  if (screen === "styleGallery") {
    return (
      <StyleGalleryScreen
        customStyleCategories={customStyleCategories}
        isLightMode={isLightMode}
        onBack={() => setScreen("styles")}
        onDeleteStyle={setStyleToDelete}
        onNavigate={handleNavigate}
        onOpenStyle={(style) => {
          setSelectedStyle(style);
          setStyleAttachSearch("");
          loadSavedRecords({ openScreen: false });
          setScreen("styleDetail");
        }}
        onOpenStyleForm={() => {
          resetStyleForm();
          setScreen("styleForm");
        }}
        onShareCategory={handleShareStyleCategory}
        profile={profile}
        setStyleCategoryFilter={setStyleCategoryFilter}
        setStyleSearch={setStyleSearch}
        setStyleViewMode={setStyleViewMode}
        status={status}
        styleCategoryFilter={styleCategoryFilter}
        styleLibrary={styleLibrary}
        styleSearch={styleSearch}
        stylesLoading={stylesLoading}
        styleViewMode={styleViewMode}
      />
    );
  }

  if (screen === "styleDetail" && selectedStyle) {
    return (
      <>
        <StyleDetailScreen
          deleteModal={styleDeleteModal}
          isLightMode={isLightMode}
          onAttachCustomer={handleAttachStyleToCustomer}
          onBack={() => {
            setSelectedStyle(null);
            setScreen("styleGallery");
          }}
          onDeleteStyle={setStyleToDelete}
          onDetachCustomer={handleDetachStyleFromCustomer}
          onOpenStyleAttachmentUpgrade={openStyleAttachmentUpgradePrompt}
          onNavigate={handleNavigate}
          profile={profile}
          savedRecords={savedRecords}
          saving={saving}
          selectedStyle={selectedStyle}
          setStyleAttachSearch={setStyleAttachSearch}
          status={status}
          styleAttachmentsLocked={!canUsePlanFeature(profile, "styleAttachments")}
          styleAttachSearch={styleAttachSearch}
        />
        {upgradePromptModal}
      </>
    );
  }

  if (screen === "more") {
    return (
      <MoreScreen
        isLightMode={isLightMode}
        onBottomNavigate={handleNavigate}
        onChangeMode={() => setScreen("mode")}
        onLogout={handleLogout}
        onMenuNavigate={(nextScreen) => {
          setStatus("");
          setScreen(nextScreen);
        }}
        onToggleTheme={handleToggleTheme}
        profile={profile}
      />
    );
  }

  if (screen === "plans") {
    const plan = getUserPlan(profile);

    return (
      <PlansScreen
        isLightMode={isLightMode}
        onBack={() => setScreen("more")}
        onNavigate={handleNavigate}
        onSelectBilling={setSelectedBillingPlan}
        onUpgradePress={(selectedBilling) => setStatus(`Payment is not connected yet. Next step is adding Stripe or Paystack checkout for ${selectedBilling.title}.`)}
        plan={plan}
        selectedBillingPlan={selectedBillingPlan}
        status={status}
      />
    );
  }

  if (screen === "profile") {
    const plan = getUserPlan(profile);

    return (
      <ProfileScreen
        accountDeleteModal={accountDeleteModal}
        customShorthandText={customShorthandText}
        isLightMode={isLightMode}
        isPositiveStatus={isPositiveStatus}
        onBack={() => setScreen("more")}
        onChangeUsername={handleChangeUsername}
        onNavigate={handleNavigate}
        onOpenDeleteAccount={() => {
          setStatus("");
          setProfileStatusTarget("account");
          setAccountDeleteText("");
          setAccountDeleteOpen(true);
        }}
        onSaveCustomShorthand={handleSaveCustomShorthand}
        onSetCustomShorthandText={setCustomShorthandText}
        onSetUsernameDraft={setUsernameDraft}
        plan={plan}
        profile={profile}
        profileStatusTarget={profileStatusTarget}
        saving={saving}
        status={status}
        usernameDraft={usernameDraft}
      />
    );
  }

  if (screen === "help") {
    return (
      <HelpScreen
        isLightMode={isLightMode}
        onBack={() => setScreen("more")}
        onNavigate={handleNavigate}
      />
    );
  }

  if (screen === "privacy") {
    return (
      <PrivacyScreen
        isLightMode={isLightMode}
        onBack={() => setScreen("more")}
        onNavigate={handleNavigate}
      />
    );
  }

  if (screen === "about") {
    return (
      <AboutScreen
        isLightMode={isLightMode}
        onBack={() => setScreen("more")}
        onNavigate={handleNavigate}
      />
    );
  }

  if (screen === "passwordReset") {
    return (
      <PasswordResetScreen
        isLightMode={isLightMode}
        isPositiveStatus={isPositiveStatus}
        onBackToLogin={() => {
          setStatus("");
          setScreen("auth");
          setAuthMode("login");
        }}
        onSubmit={handleUpdatePassword}
        resetPassword={resetPassword}
        resetPasswordConfirm={resetPasswordConfirm}
        saving={saving}
        setResetPassword={setResetPassword}
        setResetPasswordConfirm={setResetPasswordConfirm}
        setShowPassword={setShowPassword}
        showPassword={showPassword}
        status={status}
      />
    );
  }

  if (screen === "mode") {
    return (
      <ModeScreen
        isLightMode={isLightMode}
        offlineMessage={offlineMessage}
        onSelectMode={handleSelectMode}
        saving={saving}
        status={status}
      />
    );
  }

  if (screen === "home") {
    return (
      <>
        <HomeScreen
          isLightMode={isLightMode}
          measurementDrafts={measurementDrafts}
          offlineMessage={offlineMessage}
          onNavigate={handleNavigate}
          onOpenDrafts={() => loadMeasurementDrafts({ openScreen: true })}
          onOpenManual={handleStartManualInput}
          onOpenMode={() => setScreen("mode")}
          onOpenRecords={() => handleNavigate("records")}
          onOpenReminders={handleOpenReminders}
          onOpenStyles={() => loadStyleLibrary({ openScreen: true })}
          onStartMeasurement={handleStartMeasurement}
          profile={profile}
          remindersLocked={!canUsePlanFeature(profile, "reminders")}
          reminders={reminders}
          status={status}
          styleLibrary={styleLibrary}
        />
        {upgradePromptModal}
      </>
    );
  }

  return (
    <SafeAreaView style={[styles.authScreen, isLightMode && styles.authScreenLight]}>
      <ImageBackground
        source={authBackgroundImage}
        resizeMode="cover"
        style={styles.authBackground}
        imageStyle={styles.authBackgroundImage}
      >
        <StatusBar barStyle="dark-content" />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={[styles.authContent, !showAuthForm && styles.authLandingContent]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[
              styles.authBrandPanel,
              !showAuthForm && styles.authBrandLandingPanel,
              isLightMode && styles.authBrandPanelLight,
            ]}
            >
              <View style={!showAuthForm ? styles.authLandingBrandMark : undefined}>
                <BrandMark light />
              </View>
              {!showAuthForm ? (
                <View style={styles.authLandingActions}>
                  <Pressable
                    onPress={() => {
                      setStatus("");
                      setAuthMode("signup");
                      setShowAuthForm(true);
                    }}
                    style={({ pressed }) => [styles.authLandingButtonPrimary, pressed && styles.pressed]}
                  >
                    <Text style={styles.authLandingButtonPrimaryText}>Sign up</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setStatus("");
                      setAuthMode("login");
                      setShowAuthForm(true);
                    }}
                    style={({ pressed }) => [
                      styles.authLandingButtonSecondary,
                      isLightMode && styles.authLandingButtonSecondaryLight,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[
                      styles.authLandingButtonSecondaryText,
                      isLightMode && styles.authLandingButtonSecondaryTextLight,
                    ]}
                    >
                      Login
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            {showAuthForm ? (
              <View style={[styles.authPanel, isLightMode && styles.authPanelLight]}>
              <Text style={styles.panelTitle}>{title}</Text>
              <Text style={styles.panelText}>
                {isSignup
                  ? "Create your private measurement workspace."
                  : "Login with your email or username."}
              </Text>
              <OfflineNotice message={offlineMessage} />

            {isSignup && (
              <TextInput
                value={form.fullName}
                onChangeText={(value) => updateForm("fullName", value)}
                placeholder="Full name"
                placeholderTextColor="#8c8576"
                style={styles.input}
              />
            )}

            <TextInput
              value={isSignup ? form.email : form.email || form.username}
              onChangeText={(value) => updateForm(isSignup ? "email" : "email", value)}
              autoCapitalize="none"
              keyboardType={isSignup ? "email-address" : "default"}
              placeholder={isSignup ? "Email" : "Email or username"}
              placeholderTextColor="#8c8576"
              style={styles.input}
            />

            {isSignup && (
              <TextInput
                value={form.username}
                onChangeText={(value) => updateForm("username", value)}
                autoCapitalize="none"
                placeholder="Username"
                placeholderTextColor="#8c8576"
                style={styles.input}
              />
            )}

            <View style={styles.passwordRow}>
              <TextInput
                value={form.password}
                onChangeText={(value) => updateForm("password", value)}
                secureTextEntry={!showPassword}
                placeholder="Password"
                placeholderTextColor="#8c8576"
                style={styles.passwordInput}
              />
              <Pressable onPress={() => setShowPassword((current) => !current)} style={styles.eyeButton}>
                <Text style={styles.eyeText}>{showPassword ? "Hide" : "Show"}</Text>
              </Pressable>
            </View>

            {status ? <Text style={styles.errorText}>{status}</Text> : null}
            {pendingVerificationEmail ? (
              <Pressable
                disabled={saving}
                onPress={handleResendVerificationEmail}
                style={({ pressed }) => [styles.resendButton, saving && styles.disabledButton, pressed && styles.pressed]}
              >
                <Text style={styles.resendButtonText}>Resend verification email</Text>
              </Pressable>
            ) : null}

            <Pressable
              disabled={saving}
              onPress={handleAuth}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryButtonText}>{saving ? "Please wait..." : isSignup ? "Sign up" : "Login"}</Text>
            </Pressable>

            {isRunningInExpoGo ? (
              <Text style={styles.authHintText}>Google sign-in will be available in the installed app. Use email login while testing in Expo Go.</Text>
            ) : (
              <Pressable
                disabled={saving}
                onPress={handleGoogleAuth}
                style={({ pressed }) => [
                  styles.googleButton,
                  saving && styles.disabledButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </Pressable>
            )}

            {!isSignup ? (
              <Pressable
                disabled={saving}
                onPress={handleRequestPasswordReset}
                style={styles.textButton}
              >
                <Text style={styles.textButtonText}>Forgot password?</Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => {
                setStatus("");
                setPendingVerificationEmail("");
                setAuthMode(isSignup ? "login" : "signup");
                setShowAuthForm(true);
              }}
              style={styles.textButton}
            >
              <Text style={styles.textButtonText}>
                {isSignup ? "Already have an account? Login" : "New here? Create account"}
              </Text>
            </Pressable>
            </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  authScreen: {
    flex: 1,
    backgroundColor: "#0B0A08",
  },
  authScreenLight: {
    backgroundColor: "#FFF8E7",
  },
  authBackground: {
    flex: 1,
  },
  authBackgroundImage: {
    height: "100%",
    width: "100%",
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.black,
  },
  processingScreen: {
    flex: 1,
    alignItems: "center",
    backgroundColor: palette.black,
    justifyContent: "center",
    padding: 22,
  },
  processingCard: {
    alignItems: "center",
    backgroundColor: palette.charcoal,
    borderColor: "rgba(255,159,0,0.28)",
    borderRadius: 28,
    borderWidth: 1,
    padding: 24,
    width: "100%",
  },
  scanRing: {
    alignItems: "center",
    borderColor: "rgba(255,159,0,0.32)",
    borderRadius: 54,
    borderWidth: 1,
    height: 108,
    justifyContent: "center",
    marginTop: 28,
    width: 108,
  },
  loadingText: {
    marginTop: 14,
    color: "#f8f5ee",
    fontSize: 15,
    fontWeight: "700",
  },
  processingText: {
    color: "#d7c9a2",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 12,
    maxWidth: 300,
    textAlign: "center",
  },
  selfSetupVisual: {
    backgroundColor: "#15120b",
    borderColor: "rgba(255,211,122,0.35)",
    borderRadius: 24,
    borderWidth: 1,
    height: 360,
    marginBottom: 16,
    overflow: "hidden",
    position: "relative",
  },
  selfSetupFloor: {
    backgroundColor: "rgba(255,255,255,0.12)",
    bottom: 38,
    height: 8,
    left: 24,
    position: "absolute",
    right: 24,
  },
  selfSetupBooks: {
    bottom: 50,
    left: 34,
    position: "absolute",
  },
  selfSetupBook: {
    backgroundColor: "#ffffff",
    borderRadius: 6,
    height: 22,
    marginTop: 4,
    width: 96,
  },
  selfSetupBookGold: {
    backgroundColor: palette.amber,
    width: 82,
  },
  selfSetupBookDark: {
    backgroundColor: "#2a2412",
    width: 76,
  },
  selfSetupPhone: {
    alignItems: "center",
    backgroundColor: "#050505",
    borderColor: palette.amber,
    borderRadius: 18,
    borderWidth: 5,
    bottom: 112,
    height: 120,
    justifyContent: "center",
    left: 72,
    position: "absolute",
    width: 74,
  },
  selfSetupPhoneSpeaker: {
    backgroundColor: "rgba(255,255,255,0.64)",
    borderRadius: 999,
    height: 4,
    position: "absolute",
    top: 10,
    width: 28,
  },
  selfSetupPhoneGuide: {
    borderColor: "rgba(255,255,255,0.68)",
    borderRadius: 24,
    borderWidth: 1,
    height: 70,
    width: 36,
  },
  selfSetupPath: {
    borderColor: palette.amber,
    borderStyle: "dashed",
    borderTopWidth: 1,
    bottom: 128,
    left: 150,
    position: "absolute",
    width: 128,
  },
  selfSetupStepsLabel: {
    backgroundColor: palette.amber,
    borderRadius: 999,
    bottom: 108,
    color: palette.black,
    fontSize: 12,
    fontWeight: "900",
    left: 174,
    paddingHorizontal: 12,
    paddingVertical: 5,
    position: "absolute",
  },
  selfSetupPerson: {
    alignItems: "center",
    bottom: 54,
    position: "absolute",
    right: 50,
  },
  selfSetupPersonHead: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    height: 36,
    width: 32,
  },
  selfSetupPersonBody: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: 82,
    marginTop: 3,
    width: 58,
  },
  selfSetupPersonLegs: {
    flexDirection: "row",
    gap: 8,
    marginTop: -1,
  },
  selfSetupPersonLeg: {
    backgroundColor: "#ffffff",
    height: 86,
    width: 14,
  },
  setupStepList: {
    gap: 10,
    marginBottom: 16,
  },
  setupStepRow: {
    alignItems: "center",
    backgroundColor: palette.panel,
    borderColor: "rgba(232,216,173,0.84)",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  setupStepNumber: {
    alignItems: "center",
    backgroundColor: "#15120b",
    borderRadius: 999,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  setupStepNumberText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  setupStepText: {
    color: "#4b4130",
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  cameraScreen: {
    flex: 1,
    backgroundColor: "#000000",
  },
  cameraView: {
    ...StyleSheet.absoluteFillObject,
  },
  captureFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.78)",
    opacity: 0.72,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 22,
  },
  cameraTopBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  cameraBackButton: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  cameraBackButtonPlaceholder: {
    width: 48,
  },
  capturePill: {
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  capturePillText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  cameraGuide: {
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.42)",
    borderRadius: 18,
    maxWidth: 320,
    padding: 16,
  },
  cameraGuideTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  cameraGuideText: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 8,
    textAlign: "center",
  },
  cameraGuideFigureWrap: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 390,
  },
  cameraGuidePoseImage: {
    borderRadius: 22,
    height: 360,
    opacity: 0.58,
    width: 300,
  },
  cameraGuidePoseImageSide: {
    transform: [{ scaleX: 0.82 }],
  },
  cameraGuidePoseImageReady: {
    opacity: 0.78,
  },
  cameraGuideFigure: {
    alignItems: "center",
    opacity: 0.64,
    transform: [{ scaleX: 1 }],
    width: 196,
  },
  cameraGuideFigureSide: {
    transform: [{ scaleX: 0.36 }],
  },
  cameraGuideFigureReady: {
    opacity: 0.88,
  },
  cameraGuideHead: {
    backgroundColor: "rgba(255,255,255,0.86)",
    borderRadius: 28,
    height: 54,
    width: 46,
  },
  cameraGuideUpperBody: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 4,
    width: "100%",
  },
  cameraGuideTorso: {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    height: 142,
    width: 96,
  },
  cameraGuideArm: {
    backgroundColor: "rgba(255,255,255,0.78)",
    borderRadius: 18,
    height: 142,
    marginTop: 26,
    width: 22,
  },
  cameraGuideArmLeft: {
    marginRight: 10,
    transform: [{ rotate: "8deg" }],
  },
  cameraGuideArmRight: {
    marginLeft: 10,
    transform: [{ rotate: "-8deg" }],
  },
  cameraGuideHip: {
    backgroundColor: "rgba(255,255,255,0.8)",
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    height: 38,
    marginTop: -4,
    width: 86,
  },
  cameraGuideLegs: {
    flexDirection: "row",
    gap: 16,
    marginTop: -2,
  },
  cameraGuideLeg: {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    height: 146,
    width: 30,
  },
  cameraGuideFeet: {
    flexDirection: "row",
    gap: 24,
    marginTop: -1,
  },
  cameraGuideFoot: {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderRadius: 8,
    height: 12,
    width: 38,
  },
  cameraGuideReading: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.16)",
    borderColor: "rgba(255,255,255,0.58)",
    borderRadius: 48,
    borderWidth: 3,
    height: 96,
    justifyContent: "center",
    position: "absolute",
    width: 96,
  },
  cameraGuideReadingReady: {
    backgroundColor: "rgba(16,185,129,0.22)",
    borderColor: "#6EE7B7",
  },
  cameraGuideReadingText: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "300",
  },
  cameraErrorText: {
    alignSelf: "center",
    backgroundColor: "#fee2e2",
    borderRadius: 12,
    color: "#991b1b",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
    padding: 12,
  },
  captureFooter: {
    alignItems: "center",
    gap: 14,
  },
  captureHint: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  shutterOuter: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.25)",
    borderColor: "#ffffff",
    borderRadius: 42,
    borderWidth: 4,
    height: 84,
    justifyContent: "center",
    width: 84,
  },
  shutterInner: {
    backgroundColor: "#ffffff",
    borderRadius: 31,
    height: 62,
    width: 62,
  },
  shutterDisabled: {
    opacity: 0.45,
  },
  cameraRetryButton: {
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  cameraRetryButtonText: {
    color: "#15120b",
    fontSize: 14,
    fontWeight: "900",
  },
  reviewHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    marginBottom: 18,
    marginTop: 12,
  },
  smallBackButton: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 12,
    borderWidth: 1,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  reviewTitle: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "900",
  },
  reviewContent: {
    paddingBottom: 34,
  },
  reviewIntro: {
    color: "#d7c9a2",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
    marginBottom: 16,
  },
  detailsPanel: {
    backgroundColor: "#fffaf0",
    borderColor: "rgba(232,216,173,0.85)",
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  detailsTitle: {
    color: "#15120b",
    fontSize: 17,
    fontWeight: "900",
  },
  detailsText: {
    color: "#5f584c",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginBottom: 12,
    marginTop: 4,
  },
  segmentedRow: {
    backgroundColor: "#efe5c8",
    borderRadius: 12,
    flexDirection: "row",
    marginBottom: 12,
    padding: 4,
  },
  segmentedOption: {
    alignItems: "center",
    borderRadius: 9,
    flex: 1,
    minHeight: 42,
    justifyContent: "center",
  },
  segmentedOptionActive: {
    backgroundColor: "#15120b",
  },
  segmentedOptionText: {
    color: "#5f584c",
    fontSize: 13,
    fontWeight: "900",
  },
  segmentedOptionTextActive: {
    color: "#ffffff",
  },
  reminderTypeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  inlineCategoryCreator: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  categoryInput: {
    flex: 1,
    marginBottom: 0,
  },
  categoryAddButton: {
    alignItems: "center",
    backgroundColor: palette.black,
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 52,
    minWidth: 72,
    paddingHorizontal: 14,
  },
  categoryAddButtonText: {
    color: palette.amber,
    fontSize: 13,
    fontWeight: "900",
  },
  reminderTypeOption: {
    alignItems: "center",
    backgroundColor: "#efe5c8",
    borderRadius: 999,
    minHeight: 38,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  reminderTypeOptionActive: {
    backgroundColor: "#15120b",
  },
  reminderTypeText: {
    color: "#5f584c",
    fontSize: 12,
    fontWeight: "900",
  },
  reminderTypeTextActive: {
    color: "#ffffff",
  },
  customerSuggestionHint: {
    color: "#6f6759",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 10,
    marginTop: -4,
  },
  customerSuggestionList: {
    backgroundColor: "#fff5dd",
    borderColor: "rgba(255,159,0,0.26)",
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    marginBottom: 12,
    marginTop: -4,
    padding: 8,
  },
  customerSuggestionItem: {
    alignItems: "center",
    backgroundColor: "#fffaf0",
    borderColor: "rgba(232,216,173,0.85)",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 56,
    padding: 10,
  },
  customerSuggestionAvatar: {
    alignItems: "center",
    backgroundColor: "#15120b",
    borderRadius: 999,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  customerSuggestionAvatarText: {
    color: amber,
    fontSize: 12,
    fontWeight: "900",
  },
  customerSuggestionBody: {
    flex: 1,
  },
  customerSuggestionName: {
    color: "#15120b",
    fontSize: 14,
    fontWeight: "900",
  },
  customerSuggestionMeta: {
    color: "#6f6759",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  formSplitRow: {
    flexDirection: "row",
    gap: 10,
  },
  splitInput: {
    flex: 1,
  },
  noteInput: {
    minHeight: 92,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  ambiguityStack: {
    gap: 10,
    marginTop: 12,
  },
  ambiguityCard: {
    backgroundColor: "#fff5dd",
    borderColor: "rgba(255,159,0,0.42)",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  ambiguityTitle: {
    color: "#3b2a06",
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 19,
    marginBottom: 10,
  },
  stylePicker: {
    alignItems: "center",
    backgroundColor: "#15120b",
    borderColor: palette.line,
    borderRadius: 22,
    borderWidth: 1,
    height: 360,
    justifyContent: "center",
    marginBottom: 16,
    overflow: "hidden",
  },
  stylePickerImage: {
    height: "100%",
    width: "100%",
  },
  stylePickerText: {
    color: palette.amber,
    fontSize: 16,
    fontWeight: "900",
  },
  galleryToolbar: {
    gap: 10,
    marginBottom: 12,
  },
  gallerySearch: {
    marginBottom: 0,
  },
  galleryModeRow: {
    alignSelf: "flex-start",
    backgroundColor: "#efe5c8",
    borderRadius: 12,
    flexDirection: "row",
    padding: 4,
  },
  galleryModeButton: {
    alignItems: "center",
    borderRadius: 9,
    minHeight: 36,
    minWidth: 74,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  galleryModeButtonActive: {
    backgroundColor: "#15120b",
  },
  galleryModeText: {
    color: "#5f584c",
    fontSize: 12,
    fontWeight: "900",
  },
  galleryModeTextActive: {
    color: "#ffffff",
  },
  categoryScroller: {
    gap: 8,
    paddingBottom: 12,
  },
  categoryChip: {
    alignItems: "center",
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 12,
  },
  categoryChipActive: {
    backgroundColor: palette.black,
    borderColor: palette.black,
  },
  categoryChipText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "900",
  },
  categoryChipTextActive: {
    color: "#ffffff",
  },
  styleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  styleList: {
    gap: 12,
  },
  styleGridItem: {
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    padding: 8,
    width: "31%",
  },
  styleListItem: {
    alignItems: "center",
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 106,
    padding: 12,
  },
  styleThumbFrame: {
    aspectRatio: 0.78,
    backgroundColor: "#15120b",
    borderRadius: 16,
    overflow: "hidden",
    width: "100%",
  },
  styleListThumbFrame: {
    backgroundColor: "#15120b",
    borderRadius: 16,
    height: 82,
    overflow: "hidden",
    width: 66,
  },
  styleThumb: {
    height: "100%",
    width: "100%",
  },
  styleGridText: {
    paddingHorizontal: 2,
    paddingTop: 9,
  },
  styleListText: {
    flex: 1,
    minWidth: 0,
  },
  styleDeleteQuickButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: "#C83434",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    minHeight: 30,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  styleDeleteQuickText: {
    color: "#C83434",
    fontSize: 11,
    fontWeight: "900",
  },
  styleTitle: {
    color: "#15120b",
    fontSize: 13,
    fontWeight: "900",
  },
  styleMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 7,
  },
  styleCategoryPill: {
    backgroundColor: "#fff3cf",
    borderColor: "rgba(255,159,0,0.24)",
    borderRadius: 999,
    borderWidth: 1,
    color: "#6b4b05",
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  styleDateText: {
    color: palette.muted,
    fontSize: 10,
    fontWeight: "800",
  },
  styleNotePreview: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 7,
  },
  styleDetailImage: {
    backgroundColor: "#15120b",
    borderRadius: 22,
    height: 520,
    marginBottom: 16,
    width: "100%",
  },
  photoCard: {
    backgroundColor: "#fffaf0",
    borderRadius: 18,
    marginBottom: 16,
    overflow: "hidden",
  },
  photoCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14,
  },
  photoTitle: {
    color: "#15120b",
    fontSize: 16,
    fontWeight: "900",
  },
  retakeButton: {
    borderColor: "#d7c9a2",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retakeButtonText: {
    color: "#15120b",
    fontSize: 13,
    fontWeight: "900",
  },
  photoPreview: {
    backgroundColor: "#15120b",
    height: 360,
    width: "100%",
  },
  emptyPhotoPreview: {
    alignItems: "center",
    backgroundColor: "#15120b",
    height: 220,
    justifyContent: "center",
  },
  emptyPhotoText: {
    color: "#d7c9a2",
    fontSize: 14,
    fontWeight: "800",
  },
  emptyPhotoHint: {
    color: "#fff5d6",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 8,
  },
  photoCheckText: {
    color: "#0f766e",
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 18,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  photoWarningText: {
    color: "#7c2d12",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    paddingHorizontal: 14,
    paddingTop: 6,
  },
  warningText: {
    backgroundColor: "#fff7df",
    borderColor: "#f59e0b",
    borderRadius: 12,
    borderWidth: 1,
    color: "#5f3700",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
    marginBottom: 14,
    padding: 12,
  },
  resultHero: {
    backgroundColor: "#fff5d5",
    borderColor: "#ffd37a",
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 14,
    padding: 16,
  },
  resultHeroKicker: {
    color: palette.amberDark,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  resultHeroTitle: {
    color: "#15120b",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 30,
    marginTop: 8,
  },
  resultHeroMeta: {
    color: "#5f4c2a",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 7,
  },
  measurementGroup: {
    marginBottom: 16,
  },
  measurementGroupHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 9,
  },
  measurementGroupTitle: {
    color: "#fff7df",
    fontSize: 14,
    fontWeight: "900",
  },
  measurementGroupCount: {
    backgroundColor: "rgba(255,159,0,0.16)",
    borderColor: "rgba(255,159,0,0.32)",
    borderRadius: 999,
    borderWidth: 1,
    color: palette.amber,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  resultGuidePanel: {
    backgroundColor: "#091018",
    borderColor: "rgba(255,159,0,0.28)",
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 18,
    overflow: "hidden",
    padding: 14,
  },
  resultGuidePanelLight: {
    backgroundColor: "#fffaf0",
    borderColor: "rgba(196,111,0,0.22)",
  },
  resultGuideVisual: {
    alignItems: "center",
    backgroundColor: "#111820",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    borderWidth: 1,
    height: GUIDE_HEIGHT,
    justifyContent: "center",
    overflow: "hidden",
    width: GUIDE_WIDTH,
  },
  resultGuideVisualLight: {
    backgroundColor: "#fff4d8",
    borderColor: "rgba(196,111,0,0.2)",
  },
  guideBodyWrap: {
    height: GUIDE_HEIGHT,
    position: "relative",
    width: GUIDE_WIDTH,
  },
  guideFallbackBody: {
    height: GUIDE_HEIGHT,
    left: 0,
    opacity: 0.5,
    position: "absolute",
    top: 0,
    width: GUIDE_WIDTH,
  },
  guideBodyImage: {
    height: "100%",
    width: "100%",
  },
  guideHead: {
    backgroundColor: "#fffaf0",
    borderRadius: 999,
    height: 34,
    left: 78,
    position: "absolute",
    top: 26,
    width: 34,
  },
  guideNeck: {
    backgroundColor: "#fffaf0",
    height: 22,
    left: 84,
    position: "absolute",
    top: 56,
    width: 22,
  },
  guideTorso: {
    backgroundColor: "#fffaf0",
    borderTopLeftRadius: 38,
    borderTopRightRadius: 38,
    height: 126,
    left: 50,
    position: "absolute",
    top: 72,
    width: 90,
  },
  guideHip: {
    backgroundColor: "#fffaf0",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    height: 44,
    left: 58,
    position: "absolute",
    top: 188,
    width: 74,
  },
  guideLeftArm: {
    backgroundColor: "#fffaf0",
    borderRadius: 999,
    height: 132,
    left: 30,
    position: "absolute",
    top: 89,
    transform: [{ rotate: "10deg" }],
    width: 18,
  },
  guideRightArm: {
    backgroundColor: "#fffaf0",
    borderRadius: 999,
    height: 132,
    position: "absolute",
    right: 30,
    top: 89,
    transform: [{ rotate: "-10deg" }],
    width: 18,
  },
  guideLeftLeg: {
    backgroundColor: "#fffaf0",
    height: 111,
    left: 68,
    position: "absolute",
    top: 225,
    width: 22,
  },
  guideRightLeg: {
    backgroundColor: "#fffaf0",
    height: 111,
    position: "absolute",
    right: 68,
    top: 225,
    width: 22,
  },
  guideLeftFoot: {
    backgroundColor: "#fffaf0",
    borderRadius: 999,
    bottom: 0,
    height: 10,
    left: 62,
    position: "absolute",
    width: 31,
  },
  guideRightFoot: {
    backgroundColor: "#fffaf0",
    borderRadius: 999,
    bottom: 0,
    height: 10,
    position: "absolute",
    right: 62,
    width: 31,
  },
  guideLineMarker: {
    backgroundColor: "#22d3ee",
    borderRadius: 999,
    height: 2,
    position: "absolute",
  },
  guideVerticalMarker: {
    backgroundColor: "#22d3ee",
    borderRadius: 999,
    position: "absolute",
    width: 2,
  },
  guideCircumferenceMarker: {
    borderColor: "#22d3ee",
    borderRadius: 999,
    borderWidth: 1.25,
    position: "absolute",
  },
  guideCurveMarker: {
    borderColor: "#22d3ee",
    borderLeftWidth: 2,
    borderRadius: 999,
    height: 44,
    position: "absolute",
    width: 22,
  },
  resultGuideCopy: {
    flex: 1,
    justifyContent: "center",
  },
  resultGuideLabel: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },
  resultGuideLabelLight: {
    color: "#15120b",
  },
  resultGuideInstruction: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 8,
  },
  resultGuideInstructionLight: {
    color: "#5f584c",
  },
  resultControlPanel: {
    alignItems: "center",
    backgroundColor: "rgba(255,249,234,0.08)",
    borderColor: "rgba(255,159,0,0.18)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    padding: 6,
  },
  resultControlPanelLight: {
    backgroundColor: "#fff6df",
    borderColor: "rgba(196,111,0,0.18)",
  },
  resultControlGroup: {
    backgroundColor: "rgba(0,0,0,0.18)",
    borderRadius: 14,
    flexDirection: "row",
    gap: 4,
    padding: 3,
  },
  resultControlGroupLight: {
    backgroundColor: "#efe3c6",
  },
  resultControlButton: {
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  resultControlButtonLight: {
    backgroundColor: "#fffdf6",
  },
  resultUnitToggle: {
    borderRadius: 11,
    minWidth: 42,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  resultControlButtonActive: {
    backgroundColor: palette.amber,
  },
  resultControlText: {
    color: "#f7e9c2",
    fontSize: 11,
    fontWeight: "900",
  },
  resultControlTextLight: {
    color: "#5f584c",
  },
  resultControlTextActive: {
    color: "#15120b",
  },
  resultGuideChipRow: {
    gap: 8,
    paddingBottom: 14,
  },
  resultGuideChip: {
    backgroundColor: "rgba(255,250,240,0.1)",
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resultGuideChipLight: {
    backgroundColor: "#fffaf0",
    borderColor: "rgba(196,111,0,0.18)",
  },
  resultGuideChipActive: {
    backgroundColor: palette.amber,
    borderColor: palette.amber,
  },
  resultGuideChipText: {
    color: "#f7e9c2",
    fontSize: 11,
    fontWeight: "900",
  },
  resultGuideChipTextLight: {
    color: "#5f584c",
  },
  resultGuideChipTextActive: {
    color: "#15120b",
  },
  focusMeasurementCard: {
    backgroundColor: "#fffaf0",
    borderColor: palette.amber,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 18,
    padding: 14,
  },
  focusMeasurementLabel: {
    color: "#15120b",
    fontSize: 14,
    fontWeight: "900",
  },
  resultGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },
  resultItem: {
    backgroundColor: "#fffaf0",
    borderRadius: 14,
    borderColor: "transparent",
    borderWidth: 1,
    minHeight: 112,
    padding: 12,
    width: "48%",
  },
  resultItemActive: {
    borderColor: palette.amber,
    backgroundColor: "#fff4cf",
  },
  resultName: {
    color: "#5f584c",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  resultInputRow: {
    alignItems: "center",
    backgroundColor: "#fff7df",
    borderColor: "#efe5c8",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    marginTop: 8,
    minHeight: 44,
    paddingRight: 9,
  },
  resultInput: {
    color: "#15120b",
    flex: 1,
    fontSize: 22,
    fontWeight: "900",
    paddingHorizontal: 10,
  },
  resultUnit: {
    color: "#7a6d55",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  generatedText: {
    color: "#8c8576",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 6,
  },
  keyboardView: {
    flex: 1,
  },
  authContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  authLandingContent: {
    justifyContent: "center",
  },
  authBrandPanel: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    borderRadius: 24,
    borderWidth: 0,
    marginBottom: 12,
    padding: 18,
    position: "relative",
  },
  authBrandLandingPanel: {
    borderRadius: 0,
    minHeight: 640,
    justifyContent: "center",
    marginHorizontal: -18,
    marginVertical: -10,
    paddingHorizontal: 34,
    paddingVertical: 48,
  },
  authBrandPanelLight: {
    backgroundColor: "transparent",
    borderColor: "transparent",
  },
  authOrbitOne: {
    borderColor: "rgba(255,159,0,0.18)",
    borderRadius: 180,
    borderWidth: 1,
    height: 360,
    position: "absolute",
    right: -190,
    top: -130,
    width: 360,
  },
  authOrbitTwo: {
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 120,
    borderWidth: 1,
    bottom: -90,
    height: 240,
    left: -120,
    position: "absolute",
    width: 240,
  },
  authGridLineOne: {
    backgroundColor: "rgba(255,159,0,0.15)",
    height: 1,
    left: 0,
    position: "absolute",
    right: 0,
    top: 96,
    transform: [{ rotate: "-12deg" }],
  },
  authGridLineTwo: {
    backgroundColor: "rgba(255,255,255,0.08)",
    height: 1,
    left: -20,
    position: "absolute",
    right: -20,
    top: 220,
    transform: [{ rotate: "18deg" }],
  },
  authDotOne: {
    backgroundColor: palette.amber,
    borderRadius: 999,
    height: 8,
    position: "absolute",
    right: 42,
    top: 72,
    width: 8,
  },
  authDotTwo: {
    backgroundColor: "rgba(255,255,255,0.44)",
    borderRadius: 999,
    bottom: 82,
    height: 6,
    left: 48,
    position: "absolute",
    width: 6,
  },
  authLandingBrandMark: {
    alignItems: "center",
  },
  authPanel: {
    backgroundColor: palette.panel,
    borderRadius: 24,
    padding: 18,
  },
  authPanelLight: {
    backgroundColor: "#FFFDF6",
  },
  authLandingActions: {
    gap: 12,
    marginTop: 34,
  },
  authLandingButtonPrimary: {
    alignItems: "center",
    backgroundColor: palette.amber,
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 52,
  },
  authLandingButtonPrimaryText: {
    color: palette.black,
    fontSize: 15,
    fontWeight: "900",
  },
  authLandingButtonSecondary: {
    alignItems: "center",
    backgroundColor: "#111111",
    borderColor: "#111111",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 52,
  },
  authLandingButtonSecondaryLight: {
    backgroundColor: "#111111",
    borderColor: "#111111",
  },
  authLandingButtonSecondaryText: {
    color: palette.amber,
    fontSize: 15,
    fontWeight: "900",
  },
  authLandingButtonSecondaryTextLight: {
    color: palette.amber,
  },
  modeStack: {
    gap: 14,
  },
  workspaceTile: {
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
  },
  workspaceTilePrimary: {
    backgroundColor: palette.softGold,
    borderColor: palette.amber,
  },
  tileEyebrow: {
    color: palette.amberDark,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  workspaceTitle: {
    color: "#15120b",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 12,
  },
  workspaceText: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 8,
  },
  homeContent: {
    paddingBottom: 34,
  },
  heroPanel: {
    backgroundColor: "#FFF5D5",
    borderColor: "#FFD37A",
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
  },
  heroKicker: {
    color: palette.amberDark,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#15120b",
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 34,
    marginTop: 12,
  },
  heroText: {
    color: "#5F4C2A",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 10,
  },
  heroButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: palette.black,
    borderRadius: 13,
    justifyContent: "center",
    marginTop: 18,
    minHeight: 50,
    paddingHorizontal: 18,
  },
  heroButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  photoSourceStack: {
    gap: 12,
  },
  noticeText: {
    backgroundColor: "#FFF3D2",
    borderColor: palette.line,
    borderRadius: 14,
    borderWidth: 1,
    color: "#5F3700",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
    marginBottom: 12,
    padding: 12,
  },
  logoutInline: {
    alignItems: "center",
    marginTop: 22,
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
  },
  emptyStateTitle: {
    color: "#15120b",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyStateText: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 8,
    textAlign: "center",
  },
  recordCard: {
    alignItems: "flex-start",
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    minHeight: 88,
    padding: 14,
    gap: 12,
  },
  recordAvatar: {
    alignItems: "center",
    backgroundColor: palette.black,
    borderColor: "rgba(255,159,0,0.32)",
    borderRadius: 18,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  recordAvatarSmall: {
    alignItems: "center",
    backgroundColor: palette.black,
    borderColor: "rgba(255,159,0,0.32)",
    borderRadius: 14,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  recordAvatarText: {
    color: palette.amber,
    fontSize: 13,
    fontWeight: "900",
  },
  recordBody: {
    flex: 1,
    minWidth: 0,
  },
  attachmentRow: {
    alignItems: "center",
    backgroundColor: "#fffaf0",
    borderColor: palette.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
    padding: 10,
  },
  customerSuggestionButton: {
    alignItems: "center",
    backgroundColor: "#fffaf0",
    borderColor: palette.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    minHeight: 62,
    padding: 12,
  },
  sharedSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    color: palette.amberDark,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  sharedCard: {
    alignItems: "center",
    backgroundColor: palette.softGold,
    borderColor: palette.amber,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    minHeight: 88,
    padding: 16,
  },
  recordInfoButton: {
    flex: 1,
    paddingRight: 12,
  },
  recordActionStack: {
    alignItems: "flex-end",
    gap: 8,
    minWidth: 92,
  },
  recordMiniButton: {
    alignItems: "center",
    backgroundColor: palette.black,
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 16,
  },
  recordMiniButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  recordName: {
    color: "#15120b",
    fontSize: 16,
    fontWeight: "900",
  },
  recordChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  recordChip: {
    backgroundColor: "#fff3cf",
    borderColor: "rgba(255,159,0,0.24)",
    borderRadius: 999,
    borderWidth: 1,
    color: "#6b4b05",
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  recordMeta: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 5,
  },
  recordDate: {
    color: palette.amberDark,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 8,
  },
  draftProgress: {
    flexDirection: "row",
    gap: 5,
    marginTop: 9,
  },
  draftProgressDot: {
    backgroundColor: "#efe5c8",
    borderRadius: 999,
    height: 7,
    width: 28,
  },
  draftProgressDotDone: {
    backgroundColor: palette.amber,
  },
  reminderNote: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 8,
  },
  recordDeleteButton: {
    alignItems: "center",
    borderColor: "#C83434",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 40,
    minWidth: 92,
    paddingHorizontal: 14,
  },
  recordDeleteButtonPressed: {
    backgroundColor: "#FFF1F1",
  },
  recordDeleteText: {
    color: "#C83434",
    fontSize: 13,
    fontWeight: "900",
  },
  deleteWideButton: {
    alignItems: "center",
    alignSelf: "center",
    borderColor: "#C83434",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    marginTop: 18,
    minHeight: 46,
    paddingHorizontal: 18,
  },
  confirmText: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 8,
  },
  modalStatusText: {
    backgroundColor: "#fff7df",
    borderColor: palette.line,
    borderRadius: 12,
    borderWidth: 1,
    color: "#5F3700",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
    marginTop: 12,
    padding: 10,
  },
  savedValueText: {
    color: "#15120b",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 10,
  },
  resultGuideChipLight: {
    backgroundColor: "#fffaf0",
    borderColor: "rgba(196,111,0,0.18)",
  },
  infoPanel: {
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
  },
  policyTitle: {
    color: "#15120b",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 12,
  },
  policyText: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
  },
  logoBlock: {
    alignItems: "center",
    marginBottom: 28,
    marginTop: 18,
  },
  logo: {
    color: "#ffffff",
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: 0,
  },
  tagline: {
    marginTop: 8,
    color: amber,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  panel: {
    width: "100%",
    borderRadius: 18,
    backgroundColor: "#fffaf0",
    padding: 20,
  },
  panelTitle: {
    color: "#15120b",
    fontSize: 26,
    fontWeight: "900",
  },
  panelText: {
    marginTop: 8,
    marginBottom: 18,
    color: "#5f584c",
    fontSize: 15,
    lineHeight: 22,
  },
  input: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: softGold,
    color: "#15120b",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 12,
    paddingHorizontal: 14,
  },
  passwordRow: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: softGold,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    color: "#15120b",
    fontSize: 15,
    fontWeight: "700",
    paddingHorizontal: 14,
  },
  eyeButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  eyeText: {
    color: "#8a5a00",
    fontSize: 12,
    fontWeight: "900",
  },
  resendButton: {
    alignItems: "center",
    borderColor: "#D8A52A",
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    marginBottom: 12,
    minHeight: 44,
  },
  resendButtonText: {
    color: "#6d4c05",
    fontSize: 13,
    fontWeight: "900",
  },
  googleButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#DADCE0",
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 12,
    minHeight: 50,
  },
  googleButtonText: {
    color: "#15120b",
    fontSize: 14,
    fontWeight: "900",
  },
  authHintText: {
    color: "#7a6d55",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 8,
    textAlign: "center",
  },
  errorText: {
    borderRadius: 10,
    backgroundColor: "#fee2e2",
    color: "#991b1b",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
    marginBottom: 12,
    padding: 12,
  },
  successText: {
    borderRadius: 10,
    backgroundColor: "#dcfce7",
    color: "#166534",
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 19,
    marginBottom: 12,
    padding: 12,
  },
  actionErrorText: {
    backgroundColor: "#fee2e2",
    borderColor: "#fecaca",
    borderRadius: 10,
    borderWidth: 1,
    color: "#991b1b",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
    marginTop: 10,
    padding: 12,
  },
  actionNoticeText: {
    backgroundColor: "#fff7df",
    borderColor: "#f7d986",
    borderRadius: 10,
    borderWidth: 1,
    color: "#7a4b00",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
    marginTop: 10,
    padding: 12,
  },
  actionSuccessText: {
    backgroundColor: "#dcfce7",
    borderColor: "#bbf7d0",
    borderRadius: 10,
    borderWidth: 1,
    color: "#166534",
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 19,
    marginTop: 10,
    padding: 12,
  },
  primaryButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: amber,
    marginTop: 4,
  },
  primaryButtonText: {
    color: "#141006",
    fontSize: 15,
    fontWeight: "900",
  },
  secondaryButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: palette.panel,
    borderColor: palette.line,
    marginTop: 12,
  },
  secondaryButtonText: {
    color: "#15120b",
    fontSize: 14,
    fontWeight: "900",
  },
  primarySmallButton: {
    alignItems: "center",
    backgroundColor: amber,
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 18,
  },
  primarySmallButtonText: {
    color: "#141006",
    fontSize: 14,
    fontWeight: "900",
  },
  shareButton: {
    alignItems: "center",
    backgroundColor: palette.black,
    borderColor: "rgba(255,159,0,0.35)",
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 12,
    minHeight: 50,
  },
  actionButtonRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionButtonHalf: {
    flex: 1,
  },
  shareButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.45,
  },
  textButton: {
    alignItems: "center",
    marginTop: 16,
  },
  textButtonText: {
    color: "#6d4c05",
    fontSize: 13,
    fontWeight: "800",
  },
  modeButton: {
    borderRadius: 14,
    backgroundColor: "#15120b",
    marginTop: 12,
    padding: 16,
  },
  modeTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },
  modeText: {
    color: "#d7c9a2",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  pressed: {
    opacity: 0.78,
  },
});
