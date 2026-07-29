import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
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
  Bell,
  BookOpen,
  Camera,
  ChevronRight,
  ClipboardList,
  Edit3,
  FileText,
  Home,
  Image as ImageIcon,
  ListChecks,
  MoreHorizontal,
  Moon,
  Palette,
  Plus,
  Ruler,
  Save,
  ScanText,
  Shirt,
  Sun,
  Trash2,
  Upload,
  User,
  Users,
} from "lucide-react-native";

import { buildMeasurementList, getProfileFields, roundMeasurement } from "./src/constants/measurementFields";
import { validateCapturedPhoto } from "./src/services/captureValidationApi";
import { requestMobileMeasurements } from "./src/services/measurementApi";
import { deleteMobileReminder, fetchMobileReminders, saveMobileReminder } from "./src/services/reminderApi";
import {
  attachMobileStyleToCustomer,
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

const palette = {
  amber: "#FF9F00",
  amberDark: "#C46F00",
  black: "#080807",
  charcoal: "#14120E",
  cream: "#FFF9EA",
  panel: "#FFFDF6",
  softGold: "#FFF2C9",
  muted: "#776B58",
  line: "#E8D8AD",
};

const amber = palette.amber;
const black = palette.black;
const softGold = palette.softGold;
const GOOGLE_AUTH_REDIRECT_URL = "tailoriq://auth/callback";
const APP_THEME_STORAGE_KEY = "tailoriq_mobile_theme";
const isRunningInExpoGo = Constants.appOwnership === "expo";
let activeLightMode = false;
const subscriptionPlans = {
  free: {
    id: "free",
    label: "Free",
    customerLimit: 10,
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

function getUserPlan(user) {
  return subscriptionPlans[user?.plan === "pro" ? "pro" : "free"];
}

function canUsePlanFeature(user, featureKey) {
  return Boolean(getUserPlan(user).paidFeatures[featureKey]);
}

function getUpgradeMessage(featureName) {
  return `${featureName} is a Pro feature. Measurement capture, review, saved records, and sharing stay free.`;
}

const featureToneStyles = {
  amber: {
    badge: { backgroundColor: palette.amber },
    text: { color: palette.black },
  },
  teal: {
    badge: { backgroundColor: "#0F766E" },
    text: { color: "#ffffff" },
  },
  blue: {
    badge: { backgroundColor: "#2563EB" },
    text: { color: "#ffffff" },
  },
  rose: {
    badge: { backgroundColor: "#BE123C" },
    text: { color: "#ffffff" },
  },
  slate: {
    badge: { backgroundColor: "#15120b" },
    text: { color: "#ffffff" },
  },
  violet: {
    badge: { backgroundColor: "#7C3AED" },
    text: { color: "#ffffff" },
  },
};
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

const resultGuideDefinitions = {
  male: [
    { key: "neck", marker: "circumference", label: "Neck", instruction: "Neck is measured around the base of the neck where the collar sits.", type: "horizontal", x1: 43, x2: 57, y: 45 },
    { key: "chest", marker: "circumference", label: "Chest", instruction: "Chest is measured around the fullest chest, with the tape level across the back.", type: "horizontal", x1: 29, x2: 71, y: 65 },
    { key: "stomach", marker: "circumference", label: "Stomach", instruction: "Stomach is measured around the belly line, usually slightly above the trouser waist.", type: "horizontal", x1: 35, x2: 65, y: 86 },
    { key: "shoulder", marker: "width", label: "Shoulder", instruction: "Shoulder is measured across the back from one shoulder point to the other.", type: "horizontal", x1: 28, x2: 72, y: 48 },
    { key: "armhole", label: "Armhole", instruction: "Armhole is measured around the arm opening from shoulder, underarm, and back up.", type: "curve", cx: 28, cy: 63 },
    { key: "sleeve", label: "Sleeve length", instruction: "Sleeve length is measured from the shoulder point where the sleeve seam starts down to the wrist.", type: "diagonal", x1: 29, y1: 49, x2: 22, y2: 109 },
    { key: "bicep", marker: "circumference", label: "Round sleeve", instruction: "Round sleeve is measured around the fullest part of the upper arm.", type: "horizontal", x1: 21, x2: 31, y: 78 },
    { key: "wrist", marker: "circumference", label: "Cuff / wrist", instruction: "Cuff or wrist is measured around the wrist or desired cuff opening.", type: "horizontal", x1: 21, x2: 29, y: 108 },
    { key: "topLength", label: "Top length", instruction: "Top length is measured from the shoulder near the neck down to the hip or seat line.", type: "vertical", x: 73, y1: 46, y2: 116 },
    { key: "waist", marker: "circumference", label: "Waist", instruction: "Waist is measured around the waistband position where the trouser will sit.", type: "horizontal", x1: 33, x2: 67, y: 104 },
    { key: "seat", marker: "circumference", label: "Seat", instruction: "Seat is measured around the fullest part of the hip or seat.", type: "horizontal", x1: 31, x2: 69, y: 116 },
    { key: "trouserLength", label: "Outseam", instruction: "Outseam is measured from the trouser waistband down the outside leg to the ankle.", type: "vertical", x: 72, y1: 104, y2: 190 },
    { key: "inseam", label: "Inseam", instruction: "Inseam is measured from crotch down the inside leg to the ankle.", type: "vertical", x: 52, y1: 118, y2: 190 },
    { key: "rise", label: "Rise", instruction: "Rise is measured from waistband down to crotch depth.", type: "vertical", x: 45, y1: 104, y2: 117 },
    { key: "thigh", marker: "circumference", label: "Thigh", instruction: "Thigh is measured around the fullest part of the upper thigh.", type: "horizontal", x1: 35, x2: 51, y: 128 },
    { key: "knee", marker: "circumference", label: "Knee", instruction: "Knee is measured around the knee joint.", type: "horizontal", x1: 33, x2: 46, y: 144 },
    { key: "ankle", marker: "circumference", label: "Bottom / ankle", instruction: "Bottom or ankle is measured at the trouser bottom opening.", type: "horizontal", x1: 32, x2: 42, y: 187 },
  ],
  female: [
    { key: "bust", marker: "circumference", label: "Bust", instruction: "Bust is measured around the fullest bust, with the tape level across the back.", type: "horizontal", x1: 32, x2: 68, y: 69 },
    { key: "underbust", marker: "circumference", label: "Underbust", instruction: "Underbust is measured around the ribcage directly below the bust.", type: "horizontal", x1: 34, x2: 66, y: 76 },
    { key: "waist", marker: "circumference", label: "Waist", instruction: "Waist is measured around the natural waist, the narrowest part of the torso.", type: "horizontal", x1: 36, x2: 64, y: 90 },
    { key: "shoulder", marker: "width", label: "Shoulder", instruction: "Shoulder is measured across the back from one shoulder point to the other.", type: "horizontal", x1: 31, x2: 69, y: 49 },
    { key: "bustPoint", label: "Bust point", instruction: "Bust point is measured from shoulder near the neck down to the bust apex.", type: "vertical", x: 43, y1: 49, y2: 68 },
    { key: "bustSpan", marker: "width", label: "Bust span", instruction: "Bust span is measured from one bust apex to the other.", type: "horizontal", x1: 41, x2: 59, y: 68 },
    { key: "frontLength", label: "Front bodice length", instruction: "Front bodice length is measured from shoulder through bust point down to the waist.", type: "vertical", x: 70, y1: 49, y2: 90 },
    { key: "backLength", label: "Back bodice length", instruction: "Back bodice length is measured from back neck down to the natural waist.", type: "vertical", x: 33, y1: 47, y2: 90 },
    { key: "armhole", label: "Armhole", instruction: "Armhole is measured around the arm opening from shoulder, underarm, and back up.", type: "curve", cx: 30, cy: 65 },
    { key: "sleeve", label: "Sleeve length", instruction: "Sleeve length is measured from the shoulder point where the sleeve seam starts down to the wrist.", type: "diagonal", x1: 31, y1: 51, x2: 20, y2: 108 },
    { key: "bicep", marker: "circumference", label: "Round sleeve", instruction: "Round sleeve is measured around the fullest part of the upper arm.", type: "horizontal", x1: 20, x2: 31, y: 79 },
    { key: "topLength", label: "Blouse/top length", instruction: "Blouse or top length is measured from shoulder down to the high hip line.", type: "vertical", x: 72, y1: 49, y2: 105 },
    { key: "waistLower", marker: "circumference", label: "Waist band", instruction: "Waist band is measured around the chosen skirt, trouser, or gown waistband line, usually just below the navel.", type: "horizontal", x1: 35, x2: 65, y: 98 },
    { key: "highHip", marker: "circumference", label: "High hip", instruction: "High hip is measured around the upper hip right below the waistband.", type: "horizontal", x1: 34, x2: 66, y: 105 },
    { key: "hip", marker: "circumference", label: "Full hip", instruction: "Full hip is measured around the broadest point of the hip just below the high hip.", type: "horizontal", x1: 31, x2: 69, y: 116 },
    { key: "waistToHip", label: "Waist to hip", instruction: "Waist to hip is the vertical drop from the natural waist down to the high hip line.", type: "vertical", x: 38, y1: 90, y2: 105 },
    { key: "lowerLength", label: "Skirt/trouser length", instruction: "Skirt or trouser length is measured from the natural waist down to the ankle.", type: "vertical", x: 72, y1: 90, y2: 191 },
    { key: "rise", label: "Rise", instruction: "Rise is measured from the natural waist down to crotch depth for trousers.", type: "vertical", x: 50, y1: 90, y2: 121 },
    { key: "inseam", label: "Inseam", instruction: "Inseam is measured from crotch down the inside leg to the ankle.", type: "vertical", x: 52, y1: 121, y2: 191 },
    { key: "thigh", marker: "circumference", label: "Thigh", instruction: "Thigh is measured around the fullest part of the upper thigh.", type: "horizontal", x1: 35, x2: 51, y: 128 },
    { key: "knee", marker: "circumference", label: "Knee", instruction: "Knee is measured around the knee joint.", type: "horizontal", x1: 34, x2: 46, y: 143 },
    { key: "ankle", marker: "circumference", label: "Ankle / hem", instruction: "Ankle or hem is measured at the trouser ankle or skirt hem opening.", type: "horizontal", x1: 35, x2: 45, y: 186 },
  ],
};

const selfCaptureSetupSteps = [
  "Place your phone upright on a table.",
  "Support it with books or an open laptop so it stays steady.",
  "Step back slowly until your whole body fits inside the guide.",
  "Wear fitted clothes and stand straight with arms slightly away from the body.",
];

function getCameraVoiceInstruction({ captureMode, captureStep, captureRetryPaused }) {
  if (captureRetryPaused) {
    return "Adjust the phone, make sure your full body is visible, then tap retry.";
  }

  if (captureMode === "self") {
    return captureStep === "front"
      ? "Front view. Step back until your whole body is visible. Stand straight with your arms slightly away from your body."
      : "Side view. Turn fully to your side. Keep your full body visible and your arms slightly away from your body.";
  }

  return captureStep === "front"
    ? "Frame the full front view from head to feet, then take the photo."
    : "Frame the full side view from head to feet, then take the photo.";
}

function getLiveCaptureVoiceInstruction(message = "") {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("not centered")) {
    return "Move your body toward the middle of the frame.";
  }

  if (normalizedMessage.includes("too close") || normalizedMessage.includes("frame edge")) {
    return "Step back until your full body fits comfortably.";
  }

  if (normalizedMessage.includes("too small")) {
    return "Move slightly closer, but keep your head and feet visible.";
  }

  if (normalizedMessage.includes("front-facing")) {
    return "Face the camera straight on.";
  }

  if (normalizedMessage.includes("side-facing") || normalizedMessage.includes("turn sideways")) {
    return "Turn sideways so one shoulder faces the camera.";
  }

  if (normalizedMessage.includes("arms") || normalizedMessage.includes("waist")) {
    return "Let your arms hang slightly away from your body.";
  }

  if (normalizedMessage.includes("stand straight") || normalizedMessage.includes("twisted")) {
    return "Stand straight without twisting your shoulders or hips.";
  }

  if (normalizedMessage.includes("too dark")) {
    return "Use brighter even lighting.";
  }

  if (normalizedMessage.includes("overexposed")) {
    return "Reduce harsh light on the body.";
  }

  if (normalizedMessage.includes("blurry")) {
    return "Hold the camera steady.";
  }

  return "Adjust the camera until your full body is clear.";
}

function isNoisyPhotoWarning(message = "") {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("close to the frame edge") ||
    normalizedMessage.includes("near the frame edge") ||
    normalizedMessage.includes("move back only if") ||
    normalizedMessage.includes("very close to the frame edge") ||
    normalizedMessage.includes("person is too close to the camera") ||
    normalizedMessage.includes("fills almost the whole photo") ||
    normalizedMessage.includes("keep a little space around the head and feet") ||
    normalizedMessage.includes("outline looks wide") ||
    normalizedMessage.includes("continue only if the full body is visible") ||
    normalizedMessage.includes("looks too close or too wide") ||
    normalizedMessage.includes("step back and keep the full body visible") ||
    normalizedMessage.includes("does not look fully side-facing") ||
    normalizedMessage.includes("turn sideways so one shoulder and one hip face the camera") ||
    normalizedMessage.includes("missing some body details")
  );
}

function cleanPhotoWarnings(warnings = []) {
  return warnings.filter((warning) => !isNoisyPhotoWarning(warning));
}

function cleanPhotoMessage(message = "") {
  return isNoisyPhotoWarning(message) ? "" : message;
}

function isBlockingCaptureWarning(message = "") {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("too dark") ||
    normalizedMessage.includes("overexposed") ||
    normalizedMessage.includes("low contrast") ||
    normalizedMessage.includes("blurry") ||
    normalizedMessage.includes("not centered") ||
    normalizedMessage.includes("too small") ||
    normalizedMessage.includes("full-body check") ||
    normalizedMessage.includes("could not be checked") ||
    normalizedMessage.includes("plain background")
  );
}

function getLiveCaptureResult(validation, view) {
  const visibleWarnings = cleanPhotoWarnings(validation?.warnings || []);
  const blockingWarning = [
    validation?.message,
    ...visibleWarnings,
  ].find((message) => isBlockingCaptureWarning(message));

  if (!validation?.ok || blockingWarning) {
    return {
      ready: false,
      message: cleanPhotoMessage(blockingWarning || validation?.message) || `Adjust the ${view === "front" ? "front" : "side"} frame.`,
      warnings: visibleWarnings,
    };
  }

  return {
    ready: true,
    message: `${view === "front" ? "Front" : "Side"} view is ready.`,
    warnings: visibleWarnings,
  };
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

function BrandMark({ compact = false, light = false }) {
  return (
    <View style={styles.brandRow}>
      <View style={[styles.logoBadge, compact && styles.logoBadgeCompact]}>
        <Text style={[styles.logoBadgeText, compact && styles.logoBadgeTextCompact]}>IQ</Text>
      </View>
      <View>
        <Text style={[styles.brandName, compact && styles.brandNameCompact, (activeLightMode || light) && styles.brandNameLight]}>
          Tailor<Text style={styles.brandAccent}>IQ</Text>
        </Text>
        <Text style={[styles.brandTagline, compact && styles.brandTaglineCompact, (activeLightMode || light) && styles.brandTaglineLight]}>
          Measure smart. Fit perfect.
        </Text>
      </View>
    </View>
  );
}

function IconGlyph({ Icon, color = "#15120b", size = 20, strokeWidth = 2.5, style }) {
  if (!Icon) {
    return null;
  }

  return <Icon color={color} size={size} strokeWidth={strokeWidth} style={style} />;
}

function AppHeader({ title, subtitle, onBack }) {
  return (
    <View style={styles.appHeader}>
      <View style={styles.appHeaderTop}>
        {onBack ? (
          <Pressable onPress={onBack} style={({ pressed }) => [styles.headerBackButton, activeLightMode && styles.headerBackButtonLight, pressed && styles.pressed]}>
            <ArrowLeft color={activeLightMode ? "#15120b" : "#ffffff"} size={22} strokeWidth={2.8} />
          </Pressable>
        ) : (
          <BrandMark compact />
        )}
      </View>
      <Text style={[styles.pageTitle, activeLightMode && styles.pageTitleLight]}>{title}</Text>
      {subtitle ? <Text style={[styles.pageSubtitle, activeLightMode && styles.pageSubtitleLight]}>{subtitle}</Text> : null}
    </View>
  );
}

function BottomNav({ active, onNavigate }) {
  const items = [
    { id: "home", label: "Home", icon: Home },
    { id: "measure", label: "Measure", icon: Plus },
    { id: "records", label: "Records", icon: ClipboardList },
    { id: "more", label: "More", icon: MoreHorizontal },
  ];

  return (
    <View style={styles.bottomNavWrap}>
      <View style={[styles.bottomNav, activeLightMode && styles.bottomNavLight]}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => onNavigate(item.id)}
            style={[styles.navItem, active === item.id && styles.navItemActive]}
          >
            <IconGlyph
              Icon={item.icon}
              color={active === item.id ? palette.black : activeLightMode ? "#6f6759" : "#D8C9A8"}
              size={20}
              strokeWidth={2.7}
            />
            <Text style={[
              styles.navLabel,
              activeLightMode && styles.navLabelLight,
              active === item.id && styles.navLabelActive,
            ]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function AppShell({ children, active = "home", onNavigate }) {
  return (
    <SafeAreaView style={[styles.screen, activeLightMode && styles.screenLight]}>
      <StatusBar barStyle={activeLightMode ? "dark-content" : "light-content"} />
      <View style={styles.shellBody}>{children}</View>
      {onNavigate ? <BottomNav active={active} onNavigate={onNavigate} /> : null}
    </SafeAreaView>
  );
}

function AppearanceToggle({ isLightMode, onToggle, compact = false }) {
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.appearanceButton,
        compact && styles.appearanceButtonCompact,
        isLightMode && styles.appearanceButtonLight,
        pressed && styles.pressed,
      ]}
    >
      {isLightMode ? (
        <Moon color="#15120b" size={15} strokeWidth={2.7} />
      ) : (
        <Sun color="#ffffff" size={15} strokeWidth={2.7} />
      )}
      <Text style={[styles.appearanceButtonText, isLightMode && styles.appearanceButtonTextLight]}>
        {isLightMode ? "Dark" : "Light"}
      </Text>
    </Pressable>
  );
}

function OfflineNotice({ message }) {
  if (!message) {
    return null;
  }

  return <Text style={styles.offlineNotice}>{message}</Text>;
}

function FeatureTile({ title, text, icon, onPress, tone = "slate" }) {
  const toneStyle = featureToneStyles[tone] || featureToneStyles.slate;
  const Icon = icon;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionTile,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.actionIconBadge, toneStyle.badge]}>
        {typeof Icon === "function" ? (
          <IconGlyph Icon={Icon} color={toneStyle.icon || toneStyle.text?.color || "#15120b"} size={22} />
        ) : (
          <Text style={[styles.actionIcon, toneStyle.text]}>{icon}</Text>
        )}
      </View>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionText}>{text}</Text>
    </Pressable>
  );
}

function PhotoSourceTile({ title, text, icon, onPress, tone = "slate", primary = false }) {
  const toneStyle = featureToneStyles[tone] || featureToneStyles.slate;
  const Icon = icon;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.photoSourceTile,
        primary && styles.photoSourceTilePrimary,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.photoSourceIconBadge, toneStyle.badge]}>
        {typeof Icon === "function" ? (
          <IconGlyph Icon={Icon} color={toneStyle.icon || toneStyle.text?.color || "#15120b"} size={24} />
        ) : (
          <Text style={[styles.photoSourceIcon, toneStyle.text]}>{icon}</Text>
        )}
      </View>
      <View style={styles.photoSourceBody}>
        <Text style={styles.photoSourceTitle}>{title}</Text>
        <Text style={styles.photoSourceText}>{text}</Text>
      </View>
      <ChevronRight color={palette.amberDark} size={22} strokeWidth={2.8} />
    </Pressable>
  );
}

function RecordActionButton({ label, Icon, onPress, danger = false }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        danger ? styles.recordDeleteButton : styles.recordViewButton,
        pressed && (danger ? styles.recordDeleteButtonPressed : styles.pressed),
      ]}
    >
      <IconGlyph Icon={Icon} color={danger ? "#C83434" : "#ffffff"} size={15} strokeWidth={2.7} />
      <Text style={danger ? styles.recordDeleteText : styles.recordViewText}>{label}</Text>
    </Pressable>
  );
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

function buildManualMeasurementList(profileId, values = {}) {
  return getProfileFields(profileId).map((field) => ({
    fieldKey: field.key,
    valueKey: field.valueKey,
    label: field.label,
    valueCm: values[field.valueKey] || "",
    note: field.note,
    group: field.group,
  }));
}

function groupMeasurements(measurements = []) {
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

function getMeasurementSummary(measurements = []) {
  const visibleMeasurements = measurements.filter(isVisibleMeasurement);
  const filledMeasurements = visibleMeasurements.filter((measurement) => Number(measurement?.valueCm) > 0);

  return {
    total: visibleMeasurements.length,
    filled: filledMeasurements.length,
  };
}

function formatShortDate(value) {
  if (!value) {
    return "Today";
  }

  return new Date(value).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getRecordCustomerName(record = {}) {
  if (!record) {
    return "";
  }

  return (
    record.fullname ||
    record.customerName ||
    record.measurementDetails?.customerName ||
    ""
  ).trim();
}

function getReminderCustomerSuggestions(records = [], searchTerm = "") {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const seenNames = new Set();

  if (!normalizedSearch) {
    return [];
  }

  const matches = records
    .map((record) => {
      const name = getRecordCustomerName(record);

      return {
        id: record.cloudMeasurementId || record.cloudCustomerId || record.id || name,
        cloudCustomerId: record.cloudCustomerId || "",
        name,
        profile: record.measurementProfile === "female" ? "Female" : "Male",
        updatedAt: record.updatedAt || record.createdAt,
      };
    })
    .filter((record) => {
      if (!record.name) {
        return false;
      }

      const normalizedName = record.name.toLowerCase();

      if (seenNames.has(normalizedName)) {
        return false;
      }

      seenNames.add(normalizedName);
      return !normalizedSearch || normalizedName.includes(normalizedSearch);
    })
    .slice(0, 5);

  if (
    normalizedSearch &&
    matches.length === 1 &&
    matches[0].name.toLowerCase() === normalizedSearch
  ) {
    return [];
  }

  return matches;
}

function findReminderCustomerMatch(records = [], customerName = "") {
  const normalizedName = customerName.trim().toLowerCase();

  if (!normalizedName) {
    return null;
  }

  return records.find((record) => getRecordCustomerName(record).toLowerCase() === normalizedName) || null;
}

function getStyleCustomerSuggestions(records = [], searchTerm = "", attachedCustomers = []) {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const attachedIds = new Set(attachedCustomers.map((customer) => String(customer.cloudCustomerId || customer.customerId)));

  if (!normalizedSearch) {
    return [];
  }

  return records
    .map((record) => {
      const name = getRecordCustomerName(record);

      return {
        id: record.cloudCustomerId || record.id || name,
        cloudCustomerId: record.cloudCustomerId || "",
        name,
        profile: record.measurementProfile === "female" ? "Female" : "Male",
        updatedAt: record.updatedAt || record.createdAt,
      };
    })
    .filter((record) => (
      record.name &&
      record.cloudCustomerId &&
      !attachedIds.has(String(record.cloudCustomerId)) &&
      (!normalizedSearch || record.name.toLowerCase().includes(normalizedSearch))
    ))
    .slice(0, 6);
}

function mergeStyleCategories(customCategories = []) {
  return [...styleCategories, ...customCategories].reduce((list, category) => {
    const cleanCategory = category?.trim();

    if (!cleanCategory || list.some((item) => item.toLowerCase() === cleanCategory.toLowerCase())) {
      return list;
    }

    return [...list, cleanCategory];
  }, []);
}

function getRecordInitials(name = "") {
  const cleanName = name.trim();

  if (!cleanName) {
    return "IQ";
  }

  return cleanName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function hasUsablePhoto(photo) {
  return Boolean(photo?.uri);
}

function hasPhotoReference(photo) {
  return Boolean(photo?.uri || photo?.hasPhoto);
}

function cmToInches(value) {
  return Math.round((Number(value) / 2.54) * 4) / 4;
}

function toDisplayMeasurementValue(valueCm, unit) {
  const numericValue = Number(valueCm);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return "";
  }

  return unit === "in" ? String(cmToInches(numericValue)) : String(roundMeasurement(numericValue));
}

function fromDisplayMeasurementValue(value, unit) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return "";
  }

  return unit === "in" ? roundMeasurement(numericValue * 2.54) : roundMeasurement(numericValue);
}

function getGuideKeyForMeasurement(profileId, measurement = {}) {
  if (profileId === "female" && (measurement.valueKey === "waistBand" || measurement.label === "Waist band")) {
    return "waistLower";
  }

  return measurement.valueKey || measurement.fieldKey;
}

function findGuideMark(profileId, measurement) {
  const guideKey = getGuideKeyForMeasurement(profileId, measurement);
  const guide = resultGuideDefinitions[profileId] || resultGuideDefinitions.male;

  return guide.find((mark) => mark.key === guideKey) || null;
}

function isVisibleMeasurement(measurement = {}) {
  return measurement.fieldKey !== "acrossBack" && measurement.valueKey !== "acrossBack";
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

function formatReminderDateTime(reminder) {
  if (!reminder?.dueAt) {
    return "No due time";
  }

  const dueDate = new Date(reminder.dueAt);
  return `${dueDate.toLocaleDateString()} ${dueDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
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
  const [screen, setScreen] = useState("auth");
  const [authMode, setAuthMode] = useState("login");
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [offlineMessage, setOfflineMessage] = useState("");
  const [isLightMode, setIsLightMode] = useState(false);
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
      if (mounted && savedTheme) {
        setIsLightMode(savedTheme === "light");
      }
    }).catch(() => {
      // Theme preference is cosmetic, so failures should not block startup.
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(APP_THEME_STORAGE_KEY, isLightMode ? "light" : "dark").catch(() => {
      // Ignore theme persistence failures.
    });
  }, [isLightMode]);

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
    setEditingSavedRecord(null);
    setActiveDraftId(`draft-${Date.now()}`);
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

    const plan = getUserPlan(profile);

    if (savedRecords.length >= plan.customerLimit) {
      setStatus(`Free plan saves up to ${plan.customerLimit} customer records. Upgrade to Pro when your shop needs more records.`);
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
    setSavedMeasurementReminderPrompt(result.record);
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
      setStatus(getUpgradeMessage("Customer-style attachment"));
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

    const plan = getUserPlan(profile);

    if (profile.mode === "tailor" && !editingSavedRecord && savedRecords.length >= plan.customerLimit) {
      setStatus(`Free plan saves up to ${plan.customerLimit} customer records. Upgrade to Pro when your shop needs more records.`);
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
    if (profile.mode === "tailor") {
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
    <Modal
      visible={Boolean(recordToDelete)}
      animationType="fade"
      transparent
      onRequestClose={() => setRecordToDelete(null)}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.confirmPanel}>
          <Text style={styles.confirmTitle}>Delete record?</Text>
          <Text style={styles.confirmText}>
            This will remove {recordToDelete?.fullname || "this measurement"} from your saved records.
          </Text>
          <View style={styles.confirmActions}>
            <Pressable
              disabled={saving}
              onPress={() => setRecordToDelete(null)}
              style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={saving}
              onPress={handleDeleteRecord}
              style={({ pressed }) => [
                styles.deleteButton,
                saving && styles.disabledButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.deleteButtonText}>{saving ? "Deleting..." : "Delete"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );

  const draftDeleteModal = (
    <Modal
      visible={Boolean(draftToDelete)}
      animationType="fade"
      transparent
      onRequestClose={() => setDraftToDelete(null)}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.confirmPanel}>
          <Text style={styles.confirmTitle}>Delete draft?</Text>
          <Text style={styles.confirmText}>
            This will remove {draftToDelete?.measurementDetails?.customerName || "this unfinished measurement"}.
          </Text>
          <View style={styles.confirmActions}>
            <Pressable
              disabled={saving}
              onPress={() => setDraftToDelete(null)}
              style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={saving}
              onPress={handleDeleteDraft}
              style={({ pressed }) => [
                styles.deleteButton,
                saving && styles.disabledButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.deleteButtonText}>{saving ? "Deleting..." : "Delete"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );

  const reminderDeleteModal = (
    <Modal
      visible={Boolean(reminderToDelete)}
      animationType="fade"
      transparent
      onRequestClose={() => setReminderToDelete(null)}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.confirmPanel}>
          <Text style={styles.confirmTitle}>Delete reminder?</Text>
          <Text style={styles.confirmText}>
            This will remove {reminderToDelete?.title || reminderToDelete?.customerName || "this reminder"}.
          </Text>
          <View style={styles.confirmActions}>
            <Pressable
              disabled={saving}
              onPress={() => setReminderToDelete(null)}
              style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={saving}
              onPress={handleDeleteReminder}
              style={({ pressed }) => [
                styles.deleteButton,
                saving && styles.disabledButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.deleteButtonText}>{saving ? "Deleting..." : "Delete"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );

  const postSaveReminderModal = (
    <Modal
      visible={Boolean(savedMeasurementReminderPrompt)}
      animationType="fade"
      transparent
      onRequestClose={skipReminderAfterSave}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.confirmPanel}>
          <Text style={styles.confirmTitle}>Set a reminder?</Text>
          <Text style={styles.confirmText}>
            Measurement saved for {getRecordCustomerName(savedMeasurementReminderPrompt) || "this customer"}.
            Do you want to add a fitting, pickup, or follow-up reminder now?
          </Text>
          <View style={styles.confirmActions}>
            <Pressable
              onPress={skipReminderAfterSave}
              style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
            >
              <Text style={styles.cancelButtonText}>No</Text>
            </Pressable>
            <Pressable
              onPress={() => openReminderForSavedMeasurement(savedMeasurementReminderPrompt)}
              style={({ pressed }) => [styles.primaryModalButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryModalButtonText}>Yes, set reminder</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );

  const styleDeleteModal = (
    <Modal
      visible={Boolean(styleToDelete)}
      animationType="fade"
      transparent
      onRequestClose={() => setStyleToDelete(null)}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.confirmPanel}>
          <Text style={styles.confirmTitle}>Delete style?</Text>
          <Text style={styles.confirmText}>
            This will remove {styleToDelete?.title || "this saved style"} from your gallery.
          </Text>
          <View style={styles.confirmActions}>
            <Pressable
              disabled={saving}
              onPress={() => setStyleToDelete(null)}
              style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={saving}
              onPress={handleDeleteStyle}
              style={({ pressed }) => [
                styles.deleteButton,
                saving && styles.disabledButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.deleteButtonText}>{saving ? "Deleting..." : "Delete"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );

  const accountDeleteModal = (
    <Modal
      visible={accountDeleteOpen}
      animationType="fade"
      transparent
      onRequestClose={() => {
        setAccountDeleteOpen(false);
        setAccountDeleteText("");
      }}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.confirmPanel}>
          <Text style={styles.confirmTitle}>Delete account?</Text>
          <Text style={styles.confirmText}>
            This permanently removes your profile, saved measurements, drafts, reminders, saved styles, shared measurements, and account login.
          </Text>
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
          <View style={styles.confirmActions}>
            <Pressable
              disabled={saving}
              onPress={() => {
                setAccountDeleteOpen(false);
                setAccountDeleteText("");
                setStatus("");
              }}
              style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={saving || accountDeleteText.trim().toUpperCase() !== "DELETE"}
              onPress={handleDeleteAccount}
              style={({ pressed }) => [
                styles.deleteButton,
                (saving || accountDeleteText.trim().toUpperCase() !== "DELETE") && styles.disabledButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.deleteButtonText}>{saving ? "Deleting..." : "Delete account"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );

  const sendToTailorModal = (
    <Modal
      visible={Boolean(shareTargetRecord)}
      animationType="fade"
      transparent
      onRequestClose={() => setShareTargetRecord(null)}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.confirmPanel}>
          <Text style={styles.confirmTitle}>Send to tailor</Text>
          <Text style={styles.confirmText}>
            Enter the tailor's TailorIQ username. Only the reviewed measurement values will be sent.
          </Text>
          <TextInput
            value={tailorUsername}
            onChangeText={setTailorUsername}
            autoCapitalize="none"
            placeholder="Tailor username"
            placeholderTextColor="#8c8576"
            style={styles.input}
          />
          {status ? <Text style={styles.modalStatusText}>{status}</Text> : null}
          <View style={styles.confirmActions}>
            <Pressable
              disabled={saving}
              onPress={() => {
                setShareTargetRecord(null);
                setTailorUsername("");
              }}
              style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={saving}
              onPress={handleSendToTailor}
              style={({ pressed }) => [
                styles.primarySmallButton,
                saving && styles.disabledButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primarySmallButtonText}>{saving ? "Sending..." : "Send"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
      <AppShell active="measure" onNavigate={handleNavigate}>
        <AppHeader
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
      <AppShell active="measure" onNavigate={handleNavigate}>
        <AppHeader
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
      <AppShell active="measure" onNavigate={handleNavigate}>
        <AppHeader
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
      <AppShell active="measure" onNavigate={handleNavigate}>
        <AppHeader
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
      <AppShell active="measure" onNavigate={handleNavigate}>
        <AppHeader
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
          <BrandMark compact />
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
      <AppShell active="measure" onNavigate={handleNavigate}>
        <AppHeader
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

    return (
      <AppShell active="records" onNavigate={handleNavigate}>
        <AppHeader
          title={profile?.mode === "client" ? "My saved result" : "Saved records"}
          subtitle={profile?.mode === "client"
            ? "Open your latest approved measurements."
            : "Open customer measurements saved from mobile."}
        />

        <ScrollView contentContainerStyle={styles.reviewContent}>
          {status ? <Text style={styles.errorText}>{status}</Text> : null}

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
      <AppShell active="records" onNavigate={handleNavigate}>
        <AppHeader
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
    return (
      <AppShell active="home" onNavigate={handleNavigate}>
        <AppHeader
          title="Unfinished measurements"
          subtitle="Continue drafts that have not been saved as final records."
          onBack={() => setScreen("home")}
        />

        <ScrollView contentContainerStyle={styles.reviewContent}>
          {status ? <Text style={status === "Draft deleted." ? styles.successText : styles.errorText}>{status}</Text> : null}

          {draftsLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={amber} size="large" />
              <Text style={styles.emptyStateText}>Loading drafts...</Text>
            </View>
          ) : measurementDrafts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>No drafts right now</Text>
              <Text style={styles.emptyStateText}>Start a measurement and unfinished work will appear here.</Text>
              <Pressable onPress={handleStartMeasurement} style={styles.heroButton}>
                <Text style={styles.heroButtonText}>New measurement</Text>
              </Pressable>
            </View>
          ) : (
            measurementDrafts.map((draft) => {
              const photoCount = [draft.capturedPhotos?.front, draft.capturedPhotos?.side]
                .filter(hasPhotoReference).length;
              const draftName = draft.measurementDetails?.customerName || (
                profile?.mode === "client" ? "My measurement" : "Untitled measurement"
              );

              return (
                <View key={draft.id} style={styles.recordCard}>
                  <View style={styles.recordAvatar}>
                    <Text style={styles.recordAvatarText}>{photoCount}/2</Text>
                  </View>
                  <View style={styles.recordBody}>
                    <Text style={styles.recordName}>{draftName}</Text>
                    <View style={styles.recordChipRow}>
                      <Text style={styles.recordChip}>{draft.stage === "review" ? "Review ready" : "Capture draft"}</Text>
                      <Text style={styles.recordChip}>{draft.measurementDetails?.profile === "male" ? "Male" : "Female"}</Text>
                    </View>
                    <View style={styles.draftProgress}>
                      {[0, 1].map((stepIndex) => (
                        <View
                          key={stepIndex}
                          style={[
                            styles.draftProgressDot,
                            stepIndex < photoCount && styles.draftProgressDotDone,
                          ]}
                        />
                      ))}
                    </View>
                    <Text style={styles.recordDate}>{formatShortDate(draft.updatedAt || draft.createdAt)}</Text>
                  </View>
                  <View style={styles.recordActionStack}>
                    <RecordActionButton
                      onPress={() => handleContinueDraft(draft)}
                      label="Continue"
                      Icon={ChevronRight}
                    />
                    <RecordActionButton
                      onPress={() => setDraftToDelete(draft)}
                      label="Delete"
                      Icon={Trash2}
                      danger
                    />
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
        {draftDeleteModal}
      </AppShell>
    );
  }

  if (screen === "reminders") {
    return (
      <AppShell active="home" onNavigate={handleNavigate}>
        <AppHeader
          title="Reminders"
          subtitle="Save follow-ups, fittings, pickup dates, and client tasks."
          onBack={() => setScreen("home")}
        />

        <ScrollView contentContainerStyle={styles.reviewContent}>
          {status ? <Text style={styles.noticeText}>{status}</Text> : null}
          <View style={styles.photoSourceStack}>
            <PhotoSourceTile
              icon={Bell}
              title="Save reminder"
              text="Add fitting, pickup, or follow-up work."
              onPress={() => {
                resetReminderForm();
                loadSavedRecords({ openScreen: false });
                setScreen("reminderForm");
              }}
              tone="amber"
              primary
            />
            <PhotoSourceTile
              icon={ListChecks}
              title="View reminders"
              text={`${reminders.length} active reminder${reminders.length === 1 ? "" : "s"}.`}
              onPress={() => {
                loadReminders();
                setScreen("reminderList");
              }}
              tone="rose"
            />
          </View>
        </ScrollView>
      </AppShell>
    );
  }

  if (screen === "reminderForm") {
    const reminderTypes = ["Fitting", "Pickup", "Delivery", "Follow-up", "Other"];
    const customerSuggestions = getReminderCustomerSuggestions(savedRecords, reminderForm.customerName);

    return (
      <AppShell active="home" onNavigate={handleNavigate}>
        <AppHeader
          title={editingReminderId ? "Edit reminder" : "Save reminder"}
          subtitle="Set the client, reason, and exact due time."
          onBack={() => setScreen("reminders")}
        />

        <ScrollView contentContainerStyle={styles.reviewContent} keyboardShouldPersistTaps="handled">
          <View style={styles.detailsPanel}>
            <Text style={styles.detailsTitle}>Reminder details</Text>
            <Text style={styles.detailsText}>Your phone will alert you at the selected date and time.</Text>
            <TextInput
              value={reminderForm.customerName}
              onChangeText={(customerName) => setReminderForm((currentForm) => ({
                ...currentForm,
                cloudCustomerId: "",
                customerName,
              }))}
              placeholder="Customer name"
              placeholderTextColor="#8c8576"
              style={styles.input}
            />
            {recordsLoading ? (
              <Text style={styles.customerSuggestionHint}>Loading saved customers...</Text>
            ) : null}
            {customerSuggestions.length > 0 ? (
              <View style={styles.customerSuggestionList}>
                {customerSuggestions.map((customer) => (
                  <Pressable
                    key={customer.id}
                    onPress={() => setReminderForm((currentForm) => ({
                      ...currentForm,
                      cloudCustomerId: customer.cloudCustomerId,
                      customerName: customer.name,
                    }))}
                    style={({ pressed }) => [
                      styles.customerSuggestionItem,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.customerSuggestionAvatar}>
                      <Text style={styles.customerSuggestionAvatarText}>{getRecordInitials(customer.name)}</Text>
                    </View>
                    <View style={styles.customerSuggestionBody}>
                      <Text style={styles.customerSuggestionName}>{customer.name}</Text>
                      <Text style={styles.customerSuggestionMeta}>
                        {customer.profile} - Updated {formatShortDate(customer.updatedAt)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <TextInput
              value={reminderForm.title}
              onChangeText={(title) => setReminderForm((currentForm) => ({ ...currentForm, title }))}
              placeholder="Reminder title"
              placeholderTextColor="#8c8576"
              style={styles.input}
            />
            <View style={styles.reminderTypeGrid}>
              {reminderTypes.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => setReminderForm((currentForm) => ({ ...currentForm, type }))}
                  style={[
                    styles.reminderTypeOption,
                    reminderForm.type === type && styles.reminderTypeOptionActive,
                  ]}
                >
                  <Text style={[
                    styles.reminderTypeText,
                    reminderForm.type === type && styles.reminderTypeTextActive,
                  ]}
                  >
                    {type}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.formSplitRow}>
              <TextInput
                value={reminderForm.dueDate}
                onChangeText={(dueDate) => setReminderForm((currentForm) => ({ ...currentForm, dueDate }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#8c8576"
                style={[styles.input, styles.splitInput]}
              />
              <TextInput
                value={reminderForm.dueTime}
                onChangeText={(dueTime) => setReminderForm((currentForm) => ({ ...currentForm, dueTime }))}
                placeholder="HH:MM"
                placeholderTextColor="#8c8576"
                style={[styles.input, styles.splitInput]}
              />
            </View>
            <TextInput
              value={reminderForm.note}
              onChangeText={(note) => setReminderForm((currentForm) => ({ ...currentForm, note }))}
              placeholder="Notes optional"
              placeholderTextColor="#8c8576"
              multiline
              style={[styles.input, styles.noteInput]}
            />
          </View>

          <Pressable
            disabled={saving}
            onPress={handleSaveReminder}
            style={({ pressed }) => [
              styles.primaryButton,
              saving && styles.disabledButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>{saving ? "Saving..." : editingReminderId ? "Update reminder" : "Save reminder"}</Text>
          </Pressable>
          {status ? (
            <Text style={isPositiveStatus(status) ? styles.actionSuccessText : styles.actionErrorText}>{status}</Text>
          ) : null}
        </ScrollView>
      </AppShell>
    );
  }

  if (screen === "reminderList") {
    const sortedReminders = [...reminders].sort((firstReminder, secondReminder) => (
      new Date(firstReminder.dueAt || 0) - new Date(secondReminder.dueAt || 0)
    ));
    const nextReminder = sortedReminders[0];

    return (
      <AppShell active="home" onNavigate={handleNavigate}>
        <AppHeader
          title="Saved reminders"
          subtitle="Open, edit, or delete upcoming tailor tasks."
          onBack={() => setScreen("reminders")}
        />

        <ScrollView contentContainerStyle={styles.reviewContent}>
          {status ? <Text style={status === "Reminder deleted." ? styles.successText : styles.errorText}>{status}</Text> : null}

          {remindersLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={amber} size="large" />
              <Text style={styles.emptyStateText}>Loading reminders...</Text>
            </View>
          ) : sortedReminders.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>No reminders yet</Text>
              <Text style={styles.emptyStateText}>Save a reminder when you need to follow up with a client.</Text>
              <Pressable
                onPress={() => {
                  resetReminderForm();
                  setScreen("reminderForm");
                  loadSavedRecords({ openScreen: false });
                }}
                style={styles.heroButton}
              >
                <Text style={styles.heroButtonText}>Save reminder</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.resultHero}>
                <Text style={styles.resultHeroKicker}>Next reminder</Text>
                <Text style={styles.resultHeroTitle}>{nextReminder.title || nextReminder.type}</Text>
                <Text style={styles.resultHeroMeta}>
                  {nextReminder.customerName || "No customer linked"} - {formatReminderDateTime(nextReminder)}
                </Text>
              </View>

              {sortedReminders.map((reminder) => (
                <View key={reminder.id} style={styles.recordCard}>
                  <View style={styles.recordAvatar}>
                    <Text style={styles.recordAvatarText}>{reminder.type?.slice(0, 2).toUpperCase() || "!"}</Text>
                  </View>
                  <View style={styles.recordBody}>
                    <Text style={styles.recordName}>{reminder.title || reminder.type}</Text>
                    <View style={styles.recordChipRow}>
                      <Text style={styles.recordChip}>{reminder.type}</Text>
                      <Text style={styles.recordChip}>{reminder.customerName || "No customer"}</Text>
                    </View>
                    <Text style={styles.recordDate}>{formatReminderDateTime(reminder)}</Text>
                    {reminder.note ? <Text style={styles.reminderNote}>{reminder.note}</Text> : null}
                  </View>
                  <View style={styles.recordActionStack}>
                    <RecordActionButton
                      onPress={() => handleEditReminder(reminder)}
                      label="Edit"
                      Icon={Edit3}
                    />
                    <RecordActionButton
                      onPress={() => setReminderToDelete(reminder)}
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
        {reminderDeleteModal}
      </AppShell>
    );
  }

  if (screen === "styles") {
    const modeCopy = profile?.mode === "client"
      ? {
          title: "My style ideas",
          subtitle: "Save outfits you like and keep them ready for tailor conversations.",
          save: "Save an outfit idea",
          gallery: "View saved ideas",
        }
      : {
          title: "Style library",
          subtitle: "Keep client inspiration out of phone-gallery chaos.",
          save: "Save style",
          gallery: "View gallery",
        };

    return (
      <AppShell active="home" onNavigate={handleNavigate}>
        <AppHeader
          title={modeCopy.title}
          subtitle={modeCopy.subtitle}
          onBack={() => setScreen("home")}
        />

        <ScrollView contentContainerStyle={styles.reviewContent}>
          {status ? <Text style={styles.noticeText}>{status}</Text> : null}
          <View style={styles.photoSourceStack}>
            <PhotoSourceTile
              icon={Save}
              title={modeCopy.save}
              text="Choose an image, add details if needed, then save."
              onPress={() => {
                resetStyleForm();
                setScreen("styleForm");
              }}
              tone="amber"
              primary
            />
            <PhotoSourceTile
              icon={ImageIcon}
              title={modeCopy.gallery}
              text={`${styleLibrary.length} saved style${styleLibrary.length === 1 ? "" : "s"}.`}
              onPress={() => {
                loadStyleLibrary();
                loadSavedRecords({ openScreen: false });
                setScreen("styleGallery");
              }}
              tone="teal"
            />
          </View>
        </ScrollView>
      </AppShell>
    );
  }

  if (screen === "styleForm") {
    const availableStyleCategories = mergeStyleCategories(customStyleCategories);

    return (
      <AppShell active="home" onNavigate={handleNavigate}>
        <AppHeader
          title={profile?.mode === "client" ? "Save style idea" : "Save style"}
          subtitle="The style name is optional. The image is what matters most."
          onBack={() => setScreen("styles")}
        />

        <ScrollView contentContainerStyle={styles.reviewContent} keyboardShouldPersistTaps="handled">
          <Pressable onPress={handlePickStyleImage} style={({ pressed }) => [styles.stylePicker, pressed && styles.pressed]}>
            {styleForm.image?.uri ? (
              <Image source={{ uri: styleForm.image.uri }} style={styles.stylePickerImage} resizeMode="cover" />
            ) : (
              <Text style={styles.stylePickerText}>Choose image</Text>
            )}
          </Pressable>

          <View style={styles.detailsPanel}>
            <Text style={styles.detailsTitle}>Style details</Text>
            <TextInput
              value={styleForm.title}
              onChangeText={(title) => setStyleForm((currentForm) => ({ ...currentForm, title }))}
              placeholder="Style name optional"
              placeholderTextColor="#8c8576"
              style={styles.input}
            />
            {profile?.mode === "tailor" ? (
              <View style={styles.inlineCategoryCreator}>
                <TextInput
                  value={newStyleCategory}
                  onChangeText={setNewStyleCategory}
                  placeholder="Create category, e.g. Senator wear"
                  placeholderTextColor="#8c8576"
                  style={[styles.input, styles.categoryInput]}
                />
                <Pressable
                  disabled={saving}
                  onPress={handleSaveStyleCategory}
                  style={({ pressed }) => [styles.categoryAddButton, saving && styles.disabledButton, pressed && styles.pressed]}
                >
                  <Text style={styles.categoryAddButtonText}>Add</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={styles.reminderTypeGrid}>
              {availableStyleCategories.map((category) => (
                <Pressable
                  key={category}
                  onPress={() => setStyleForm((currentForm) => ({ ...currentForm, category }))}
                  style={[
                    styles.reminderTypeOption,
                    styleForm.category === category && styles.reminderTypeOptionActive,
                  ]}
                >
                  <Text style={[
                    styles.reminderTypeText,
                    styleForm.category === category && styles.reminderTypeTextActive,
                  ]}
                  >
                    {category}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={styleForm.notes}
              onChangeText={(notes) => setStyleForm((currentForm) => ({ ...currentForm, notes }))}
              placeholder={profile?.mode === "client"
                ? "Occasion, fabric, fit preference, or what you like about it."
                : "Fabric, neckline, sleeve, body type, or fitting notes."}
              placeholderTextColor="#8c8576"
              multiline
              style={[styles.input, styles.noteInput]}
            />
          </View>

          <Pressable
            disabled={saving}
            onPress={handleSaveStyle}
            style={({ pressed }) => [
              styles.primaryButton,
              saving && styles.disabledButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>{saving ? "Saving..." : "Save style"}</Text>
          </Pressable>
          {status ? (
            <Text style={isPositiveStatus(status) ? styles.actionSuccessText : styles.actionErrorText}>{status}</Text>
          ) : null}
        </ScrollView>
      </AppShell>
    );
  }

  if (screen === "styleGallery") {
    const searchableTerm = styleSearch.trim().toLowerCase();
    const availableStyleCategories = mergeStyleCategories(customStyleCategories);
    const styleCategoryCounts = styleLibrary.reduce((counts, style) => ({
      ...counts,
      [style.category]: (counts[style.category] || 0) + 1,
    }), {});
    const filteredStyles = styleLibrary
      .filter((style) => styleCategoryFilter === "all" || style.category === styleCategoryFilter)
      .filter((style) => `${style.title} ${style.category} ${style.notes}`.toLowerCase().includes(searchableTerm));

    return (
      <AppShell active="home" onNavigate={handleNavigate}>
        <AppHeader
          title={profile?.mode === "client" ? "Saved ideas" : "Style gallery"}
          subtitle="Browse saved style images in grid or list view."
          onBack={() => setScreen("styles")}
        />

        <ScrollView contentContainerStyle={styles.reviewContent}>
          {status ? <Text style={status === "Style deleted." ? styles.successText : styles.errorText}>{status}</Text> : null}

          <View style={styles.galleryToolbar}>
            <TextInput
              value={styleSearch}
              onChangeText={setStyleSearch}
              placeholder="Search styles"
              placeholderTextColor="#8c8576"
              style={[styles.input, styles.gallerySearch]}
            />
            <View style={styles.galleryModeRow}>
              <Pressable
                onPress={() => setStyleViewMode("grid")}
                style={[styles.galleryModeButton, styleViewMode === "grid" && styles.galleryModeButtonActive]}
              >
                <Text style={[styles.galleryModeText, styleViewMode === "grid" && styles.galleryModeTextActive]}>Grid</Text>
              </Pressable>
              <Pressable
                onPress={() => setStyleViewMode("list")}
                style={[styles.galleryModeButton, styleViewMode === "list" && styles.galleryModeButtonActive]}
              >
                <Text style={[styles.galleryModeText, styleViewMode === "list" && styles.galleryModeTextActive]}>List</Text>
              </Pressable>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroller}>
            {["all", ...availableStyleCategories].map((category) => (
              <Pressable
                key={category}
                onPress={() => setStyleCategoryFilter(category)}
                style={[
                  styles.categoryChip,
                  styleCategoryFilter === category && styles.categoryChipActive,
                ]}
              >
                <Text style={[
                  styles.categoryChipText,
                  styleCategoryFilter === category && styles.categoryChipTextActive,
                ]}
                >
                  {category === "all" ? `All ${styleLibrary.length}` : `${category} ${styleCategoryCounts[category] || 0}`}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {stylesLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={amber} size="large" />
              <Text style={styles.emptyStateText}>Loading styles...</Text>
            </View>
          ) : filteredStyles.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>No styles found</Text>
              <Text style={styles.emptyStateText}>Save a style image to start building your gallery.</Text>
              <Pressable
                onPress={() => {
                  resetStyleForm();
                  setScreen("styleForm");
                }}
                style={styles.heroButton}
              >
                <Text style={styles.heroButtonText}>Save style</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styleViewMode === "grid" ? styles.styleGrid : styles.styleList}>
              {filteredStyles.map((style) => (
                <Pressable
                  key={style.id}
                  onPress={() => {
                    setSelectedStyle(style);
                    setStyleAttachSearch("");
                    loadSavedRecords({ openScreen: false });
                    setScreen("styleDetail");
                  }}
                  style={({ pressed }) => [
                    styleViewMode === "grid" ? styles.styleGridItem : styles.styleListItem,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styleViewMode === "grid" ? styles.styleThumbFrame : styles.styleListThumbFrame}>
                    <Image
                      source={{ uri: style.imageUrl }}
                      style={styles.styleThumb}
                      resizeMode="cover"
                    />
                  </View>
                  <View style={styleViewMode === "grid" ? styles.styleGridText : styles.styleListText}>
                    <Text style={styles.styleTitle} numberOfLines={1}>{style.title || style.category}</Text>
                    <View style={styles.styleMetaRow}>
                      <Text style={styles.styleCategoryPill}>{style.category}</Text>
                      <Text style={styles.styleDateText}>
                        {style.updatedAt ? new Date(style.updatedAt).toLocaleDateString() : "Saved"}
                      </Text>
                    </View>
                    {style.notes ? <Text style={styles.styleNotePreview} numberOfLines={2}>{style.notes}</Text> : null}
                  </View>
                  <Pressable
                    onPress={() => setStyleToDelete(style)}
                    style={({ pressed }) => [
                      styles.styleDeleteQuickButton,
                      pressed && styles.recordDeleteButtonPressed,
                    ]}
                  >
                    <Trash2 color="#C83434" size={14} strokeWidth={2.7} />
                    <Text style={styles.styleDeleteQuickText}>Delete</Text>
                  </Pressable>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
        {styleDeleteModal}
      </AppShell>
    );
  }

  if (screen === "styleDetail" && selectedStyle) {
    const attachedCustomers = selectedStyle.attachedCustomers || [];
    const customerSuggestions = getStyleCustomerSuggestions(savedRecords, styleAttachSearch, attachedCustomers);

    return (
      <AppShell active="home" onNavigate={handleNavigate}>
        <AppHeader
          title={selectedStyle?.title || selectedStyle?.category || "Style"}
          subtitle={selectedStyle?.category || "Saved style"}
          onBack={() => {
            setSelectedStyle(null);
            setScreen("styleGallery");
          }}
        />

        <ScrollView contentContainerStyle={styles.reviewContent}>
          {selectedStyle?.imageUrl ? (
            <Image source={{ uri: selectedStyle.imageUrl }} style={styles.styleDetailImage} resizeMode="cover" />
          ) : null}
          <View style={styles.infoPanel}>
            <Text style={styles.policyTitle}>{selectedStyle?.title || selectedStyle?.category || "Saved style"}</Text>
            {selectedStyle?.notes ? <Text style={styles.policyText}>{selectedStyle.notes}</Text> : null}
            <Text style={styles.recordDate}>
              {selectedStyle?.updatedAt ? new Date(selectedStyle.updatedAt).toLocaleDateString() : "Saved"}
            </Text>
          </View>
          {profile?.mode === "tailor" ? (
            <View style={styles.infoPanel}>
              <Text style={styles.policyTitle}>Attached customers</Text>
              {attachedCustomers.length === 0 ? (
                <Text style={styles.policyText}>No customer attached yet. Search a saved customer below.</Text>
              ) : (
                attachedCustomers.map((attachment) => (
                  <View key={attachment.id || attachment.cloudCustomerId} style={styles.attachmentRow}>
                    <View style={styles.recordAvatarSmall}>
                      <Text style={styles.recordAvatarText}>{getRecordInitials(attachment.customerName)}</Text>
                    </View>
                    <View style={styles.recordBody}>
                      <Text style={styles.recordName}>{attachment.customerName}</Text>
                      <Text style={styles.recordDate}>Attached style</Text>
                    </View>
                    <Pressable
                      disabled={saving}
                      onPress={() => handleDetachStyleFromCustomer(attachment)}
                      style={({ pressed }) => [styles.recordDeleteButton, pressed && styles.recordDeleteButtonPressed]}
                    >
                      <Trash2 color="#C83434" size={15} strokeWidth={2.7} />
                      <Text style={styles.recordDeleteText}>Remove</Text>
                    </Pressable>
                  </View>
                ))
              )}

              <TextInput
                value={styleAttachSearch}
                onChangeText={setStyleAttachSearch}
                placeholder="Search customer to attach"
                placeholderTextColor="#8c8576"
                style={styles.input}
              />
              {styleAttachSearch.trim() && customerSuggestions.length === 0 ? (
                <Text style={styles.policyText}>No matching unattached customer found.</Text>
              ) : null}
              {customerSuggestions.length > 0 ? (
                customerSuggestions.map((customer) => (
                  <Pressable
                    key={customer.id}
                    disabled={saving}
                    onPress={() => handleAttachStyleToCustomer(customer)}
                    style={({ pressed }) => [styles.customerSuggestionButton, pressed && styles.pressed]}
                  >
                    <View>
                      <Text style={styles.recordName}>{customer.name}</Text>
                      <Text style={styles.recordDate}>{customer.profile} - {formatShortDate(customer.updatedAt)}</Text>
                    </View>
                    <ChevronRight color={palette.amberDark} size={21} strokeWidth={2.8} />
                  </Pressable>
                ))
              ) : null}
              {status ? (
                <Text style={isPositiveStatus(status) ? styles.actionSuccessText : styles.actionErrorText}>{status}</Text>
              ) : null}
            </View>
          ) : null}
          <Pressable
            onPress={() => setStyleToDelete(selectedStyle)}
            style={({ pressed }) => [styles.deleteWideButton, pressed && styles.recordDeleteButtonPressed]}
          >
            <Trash2 color="#C83434" size={15} strokeWidth={2.7} />
            <Text style={styles.recordDeleteText}>Delete style</Text>
          </Pressable>
        </ScrollView>
        {styleDeleteModal}
      </AppShell>
    );
  }

  if (screen === "more") {
    const moreItems = [
      { id: "profile", title: "Profile", text: "Account details and workspace mode." },
      { id: "plans", title: "Plans", text: "Compare Free and Pro, then upgrade when payment is ready." },
      { id: "help", title: "Help", text: "Photo capture, review, and saving guidance." },
      { id: "privacy", title: "Privacy policy", text: "How measurement data and photos are handled." },
      { id: "about", title: "About TailorIQ", text: "What the app does and who it is for." },
    ];

    return (
      <AppShell active="more" onNavigate={handleNavigate}>
        <AppHeader
          title="More"
          subtitle="Profile, support, privacy, and app information."
        />

        <ScrollView contentContainerStyle={styles.reviewContent}>
          <View style={styles.profileSummary}>
            <Text style={styles.profileName}>{profile?.fullName || profile?.username || "TailorIQ user"}</Text>
            <Text style={styles.profileMeta}>{profile?.email}</Text>
            <Text style={styles.profileMode}>{profile?.mode === "client" ? "Client mode" : "Tailor mode"}</Text>
          </View>

          <View style={styles.themeToggleRow}>
            <View>
              <Text style={styles.themeToggleTitle}>Appearance</Text>
              <Text style={styles.themeToggleText}>{isLightMode ? "Light mode is active" : "Dark mode is active"}</Text>
            </View>
            <AppearanceToggle
              isLightMode={isLightMode}
              onToggle={() => setIsLightMode((currentValue) => !currentValue)}
            />
          </View>

          {moreItems.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => {
                setStatus("");
                setScreen(item.id);
              }}
              style={({ pressed }) => [styles.moreItem, pressed && styles.pressed]}
            >
              <View>
                <Text style={styles.moreItemTitle}>{item.title}</Text>
                <Text style={styles.moreItemText}>{item.text}</Text>
              </View>
              <ChevronRight color={palette.amberDark} size={21} strokeWidth={2.8} />
            </Pressable>
          ))}

          <Pressable onPress={() => setScreen("mode")} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Change mode</Text>
          </Pressable>

          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}
          >
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </ScrollView>
      </AppShell>
    );
  }

  if (screen === "plans") {
    const plan = getUserPlan(profile);
    const planFeatures = [
      "Unlimited customer records",
      "Unlimited saved style ideas",
      "Reminders for fittings and pickup",
      "Book photo scanning for manual input",
      "Custom shorthand dictionary",
      "Create your own style categories",
      "Attach style ideas to customers",
      "Early access to workflow improvements",
    ];
    const billingOptions = [
      {
        id: "yearly",
        title: "Yearly",
        price: "N29,900.00",
        note: "N2,491.67/month, billed yearly",
        badge: "Save 69%",
      },
      {
        id: "monthly",
        title: "Monthly",
        price: "N7,900.00",
        note: "Billed monthly",
      },
    ];
    const selectedBilling = billingOptions.find((option) => option.id === selectedBillingPlan) || billingOptions[0];

    return (
      <AppShell active="more" onNavigate={handleNavigate}>
        <AppHeader
          title="Upgrade TailorIQ"
          subtitle="Unlock the shop tools built around your measurement workflow."
          onBack={() => setScreen("more")}
        />

        <ScrollView contentContainerStyle={styles.planScreenContent}>
          <View style={[styles.premiumPlanCard, isLightMode && styles.premiumPlanCardLight]}>
            <View style={styles.premiumBadgeRow}>
              <Text style={styles.premiumBadge}>Tailor Shop</Text>
              <Text style={[styles.premiumCurrentBadge, isLightMode && styles.premiumCurrentBadgeLight]}>
                Current: {plan.label}
              </Text>
            </View>

            <Text style={[styles.premiumPrice, isLightMode && styles.premiumPriceLight]}>{selectedBilling.price}</Text>
            <Text style={[styles.premiumPriceNote, isLightMode && styles.premiumPriceNoteLight]}>{selectedBilling.note}</Text>

            <Text style={[styles.premiumIntro, isLightMode && styles.premiumIntroLight]}>
              Keep the measuring core free. Upgrade when your shop needs faster follow-up, better organization, and less manual admin work.
            </Text>

            <View style={[styles.billingToggleRow, isLightMode && styles.billingToggleRowLight]}>
              {billingOptions.map((option) => {
                const active = selectedBillingPlan === option.id;

                return (
                  <Pressable
                    key={option.id}
                    onPress={() => setSelectedBillingPlan(option.id)}
                    style={({ pressed }) => [
                      styles.billingToggle,
                      active && styles.billingToggleActive,
                      isLightMode && !active && styles.billingToggleLight,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[
                      styles.billingToggleText,
                      isLightMode && !active && styles.billingToggleTextLight,
                      active && styles.billingToggleTextActive,
                    ]}>
                      {option.title}
                    </Text>
                    {option.badge ? <Text style={styles.billingToggleBadge}>{option.badge}</Text> : null}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.premiumFeatureList}>
              {planFeatures.map((feature) => (
                <View key={feature} style={styles.premiumFeatureRow}>
                  <Plus color={palette.amber} size={18} strokeWidth={3} />
                  <Text style={[styles.premiumFeatureText, isLightMode && styles.premiumFeatureTextLight]}>{feature}</Text>
                </View>
              ))}
            </View>

            <Pressable
              onPress={() => setStatus(`Payment is not connected yet. Next step is adding Stripe or Paystack checkout for ${selectedBilling.title}.`)}
              style={({ pressed }) => [styles.planUpgradeButton, pressed && styles.pressed]}
            >
              <Text style={styles.planUpgradeButtonText}>Get Tailor Shop</Text>
            </Pressable>

            {status ? <Text style={[styles.premiumStatusText, isLightMode && styles.premiumStatusTextLight]}>{status}</Text> : null}
          </View>

          <Text style={[styles.planFooterNote, isLightMode && styles.planFooterNoteLight]}>
            Photo measurement, review, body guide, saved results, and sharing remain part of the free TailorIQ experience.
          </Text>
        </ScrollView>
      </AppShell>
    );
  }

  if (screen === "profile") {
    return (
      <AppShell active="more" onNavigate={handleNavigate}>
        <AppHeader
          title="Profile"
          subtitle="The identity attached to this TailorIQ workspace."
          onBack={() => setScreen("more")}
        />

        <ScrollView contentContainerStyle={styles.reviewContent} keyboardShouldPersistTaps="handled">
          <View style={styles.infoPanel}>
            <Text style={styles.infoLabel}>Full name</Text>
            <Text style={styles.infoValue}>{profile?.fullName || "Not added"}</Text>
            <Text style={styles.infoLabel}>Username</Text>
            <Text style={styles.infoValue}>{profile?.username || "Not added"}</Text>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{profile?.email || "Not added"}</Text>
            <Text style={styles.infoLabel}>Mode</Text>
            <Text style={styles.infoValue}>{profile?.mode === "client" ? "Client mode" : "Tailor mode"}</Text>
            <Text style={styles.infoLabel}>Plan</Text>
            <Text style={styles.infoValue}>{getUserPlan(profile).label}</Text>
          </View>

          <View style={styles.inlineSettingsBlock}>
            <Text style={styles.policyTitle}>Change username</Text>
            <Text style={styles.policyText}>Use lowercase letters, numbers, or underscores. This is the name other users can search when sharing to you.</Text>
            <TextInput
              value={usernameDraft}
              onChangeText={setUsernameDraft}
              autoCapitalize="none"
              placeholder={profile?.username || "New username"}
              placeholderTextColor="#8c8576"
              style={styles.input}
            />
            <Pressable
              disabled={saving}
              onPress={handleChangeUsername}
              style={({ pressed }) => [
                styles.secondaryButton,
                saving && styles.disabledButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>{saving ? "Saving..." : "Update username"}</Text>
            </Pressable>
            {status && profileStatusTarget === "username" ? (
              <Text style={isPositiveStatus(status) ? styles.actionSuccessText : styles.actionErrorText}>{status}</Text>
            ) : null}
          </View>

          {profile?.mode === "tailor" ? (
            <View style={styles.inlineSettingsBlock}>
              <Text style={styles.policyTitle}>Customize shorthand</Text>
              <Text style={styles.policyText}>
                Add one rule per line, like SH = shoulder or LL = lower length. Ambiguous shorthand will still ask before filling values.
              </Text>
              <TextInput
                value={customShorthandText}
                onChangeText={setCustomShorthandText}
                placeholder={"SH = shoulder\nLL = lower length"}
                placeholderTextColor="#8c8576"
                multiline
                style={[styles.input, styles.noteInput]}
              />
              <Pressable
                disabled={saving}
                onPress={handleSaveCustomShorthand}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  saving && styles.disabledButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.secondaryButtonText}>{saving ? "Saving..." : "Save shorthand"}</Text>
              </Pressable>
              {status && profileStatusTarget === "shorthand" ? (
                <Text style={isPositiveStatus(status) ? styles.actionSuccessText : styles.actionErrorText}>{status}</Text>
              ) : null}
            </View>
          ) : null}

          <View style={[styles.inlineSettingsBlock, styles.dangerZoneBlock]}>
            <Text style={styles.dangerZoneTitle}>Delete account</Text>
            <Text style={styles.policyText}>
              Permanently remove this account and the saved TailorIQ data attached to it. This cannot be undone.
            </Text>
            <Pressable
              disabled={saving}
              onPress={() => {
                setStatus("");
                setProfileStatusTarget("account");
                setAccountDeleteText("");
                setAccountDeleteOpen(true);
              }}
              style={({ pressed }) => [
                styles.deleteAccountButton,
                saving && styles.disabledButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.deleteAccountButtonText}>Delete account</Text>
            </Pressable>
          </View>
          {accountDeleteModal}
        </ScrollView>
      </AppShell>
    );
  }

  if (screen === "help") {
    return (
      <AppShell active="more" onNavigate={handleNavigate}>
        <AppHeader
          title="Help"
          subtitle="Quick guidance for better measurement captures."
          onBack={() => setScreen("more")}
        />

        <ScrollView contentContainerStyle={styles.reviewContent}>
          <View style={styles.infoPanel}>
            <Text style={styles.aboutTitle}>Use TailorIQ with confidence.</Text>
            <Text style={styles.policyText}>
              These notes cover the everyday things that make captures cleaner, records easier to trust, and account recovery smoother.
            </Text>
          </View>
          {[
            "For photo measurements, wear fitted clothes, stand straight, and keep your arms slightly away from the body.",
            "Make sure the full body is inside the frame from head to feet before capture or upload.",
            "Enter the real height using the unit that is easiest for you. TailorIQ converts it before analysis.",
            "Review every generated value before saving. Corrected values are the final record.",
            "Use reminders for fitting dates, pickup dates, delivery work, or follow-ups.",
            "If login or saving fails, check your connection and try again. Unsaved work should be reviewed before leaving the page.",
            "Use password reset from the login page if you forget your password. If signup asks for email verification, check inbox and spam.",
          ].map((item) => (
            <View key={item} style={styles.helpItem}>
              <Text style={styles.helpBullet}>-</Text>
              <Text style={styles.helpText}>{item}</Text>
            </View>
          ))}
        </ScrollView>
      </AppShell>
    );
  }

  if (screen === "privacy") {
    return (
      <AppShell active="more" onNavigate={handleNavigate}>
        <AppHeader
          title="Privacy policy"
          subtitle="A plain-language summary for this mobile version."
          onBack={() => setScreen("more")}
        />

        <ScrollView contentContainerStyle={styles.reviewContent}>
          <View style={styles.infoPanel}>
            <Text style={styles.policyTitle}>Your measurements</Text>
            <Text style={styles.policyText}>
              TailorIQ saves approved measurement records to your signed-in account. Drafts, saved records, styles, reminders, and profile details are kept separate by user account.
            </Text>
            <Text style={styles.policyTitle}>Photos</Text>
            <Text style={styles.policyText}>
              Photos are used to create measurement estimates. To reduce unnecessary storage, saved mobile measurement records keep the approved values rather than storing duplicate original and censored photo files.
            </Text>
            <Text style={styles.policyTitle}>Sharing</Text>
            <Text style={styles.policyText}>
              Client measurements should only be shared after review. When sharing to another TailorIQ username, the recipient should only receive the result you choose to send.
            </Text>
            <Text style={styles.policyTitle}>Account access</Text>
            <Text style={styles.policyText}>
              Account access is protected through email, password, and optional provider login. Keep your password private, use password reset when needed, and log out on shared devices.
            </Text>
            <Text style={styles.policyTitle}>Your responsibility</Text>
            <Text style={styles.policyText}>
              Only save or share another person's measurements with their permission. Always review generated measurements before using them for cutting, sewing, or client delivery.
            </Text>
          </View>
        </ScrollView>
      </AppShell>
    );
  }

  if (screen === "about") {
    return (
      <AppShell active="more" onNavigate={handleNavigate}>
        <AppHeader
          title="About TailorIQ"
          subtitle="Measure smart. Fit perfect."
          onBack={() => setScreen("more")}
        />

        <ScrollView contentContainerStyle={styles.reviewContent}>
          <View style={styles.infoPanel}>
            <Text style={styles.aboutTitle}>TailorIQ helps tailors and clients turn guided photos, manual entries, and style ideas into organized measurement work.</Text>
            <Text style={styles.policyText}>
              Tailor mode is built for shops that need customer records, drafts, reminders, manual input, style galleries, and reviewed measurements in one place.
            </Text>
            <Text style={styles.policyText}>
              Client mode is built for people who want to capture their own measurements, review the result, keep style inspiration, and share approved values with a tailor.
            </Text>
            <Text style={styles.policyText}>
              TailorIQ is designed around guided capture and human review. The app can suggest measurements, but the final saved record should always be checked before it is used for production work.
            </Text>
          </View>
        </ScrollView>
      </AppShell>
    );
  }

  if (screen === "passwordReset") {
    return (
      <SafeAreaView style={styles.authScreen}>
        <StatusBar barStyle="light-content" />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardView}
        >
          <ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled">
            <View style={styles.authBrandPanel}>
              <BrandMark />
            </View>

            <View style={styles.authPanel}>
              <Text style={styles.panelTitle}>Reset password</Text>
              <Text style={styles.panelText}>Create a new password for your TailorIQ account.</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  value={resetPassword}
                  onChangeText={setResetPassword}
                  secureTextEntry={!showPassword}
                  placeholder="New password"
                  placeholderTextColor="#8c8576"
                  style={styles.passwordInput}
                />
                <Pressable onPress={() => setShowPassword((current) => !current)} style={styles.eyeButton}>
                  <Text style={styles.eyeText}>{showPassword ? "Hide" : "Show"}</Text>
                </Pressable>
              </View>
              <TextInput
                value={resetPasswordConfirm}
                onChangeText={setResetPasswordConfirm}
                secureTextEntry={!showPassword}
                placeholder="Confirm new password"
                placeholderTextColor="#8c8576"
                style={styles.input}
              />
              {status ? <Text style={isPositiveStatus(status) ? styles.successText : styles.errorText}>{status}</Text> : null}
              <Pressable
                disabled={saving}
                onPress={handleUpdatePassword}
                style={({ pressed }) => [
                  styles.primaryButton,
                  saving && styles.disabledButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>{saving ? "Updating..." : "Update password"}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setStatus("");
                  setScreen("auth");
                  setAuthMode("login");
                }}
                style={styles.textButton}
              >
                <Text style={styles.textButtonText}>Back to login</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (screen === "mode") {
    return (
      <AppShell>
        <AppHeader
          title="Choose your workspace"
          subtitle="Keep client self-measurements separate from tailor records."
        />

        <View style={styles.modeStack}>
          <OfflineNotice message={offlineMessage} />
          {status ? <Text style={styles.errorText}>{status}</Text> : null}

          <Pressable
            disabled={saving}
            onPress={() => handleSelectMode("tailor")}
            style={({ pressed }) => [styles.workspaceTile, styles.workspaceTilePrimary, pressed && styles.pressed]}
          >
            <Text style={styles.tileEyebrow}>For your shop</Text>
            <Text style={styles.workspaceTitle}>Tailor mode</Text>
            <Text style={styles.workspaceText}>Capture, review, save, and manage client measurements.</Text>
          </Pressable>

          <Pressable
            disabled={saving}
            onPress={() => handleSelectMode("client")}
            style={({ pressed }) => [styles.workspaceTile, pressed && styles.pressed]}
          >
            <Text style={styles.tileEyebrow}>For personal use</Text>
            <Text style={styles.workspaceTitle}>Client mode</Text>
            <Text style={styles.workspaceText}>Take your own measurement and share only the result you approve.</Text>
          </Pressable>
        </View>
      </AppShell>
    );
  }

  if (screen === "home") {
    return (
      <AppShell active="home" onNavigate={handleNavigate}>
        <AppHeader
          title={profile?.mode === "client" ? "My measurements" : "Measurement studio"}
          subtitle={profile?.mode === "client"
            ? "Capture, review, and share your approved body measurements."
            : "Capture clean measurements and keep customer records organized."}
        />

        <ScrollView contentContainerStyle={styles.homeContent} showsVerticalScrollIndicator={false}>
          <OfflineNotice message={offlineMessage} />
          {status ? <Text style={styles.noticeText}>{status}</Text> : null}

          <View style={styles.heroPanel}>
            <Text style={styles.heroKicker}>{profile?.username || profile?.email}</Text>
            <Text style={styles.heroTitle}>
              {profile?.mode === "client" ? "Take a fresh measurement" : "Start a client measurement"}
            </Text>
            <Text style={styles.heroText}>
              Use guided front and side photos, review each value, then save only what you approve.
            </Text>
            <Pressable onPress={handleStartMeasurement} style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}>
              <Text style={styles.heroButtonText}>New measurement</Text>
            </Pressable>
          </View>

          <View style={styles.actionGrid}>
            {profile?.mode === "tailor" ? (
              <>
                <FeatureTile
                  icon={Ruler}
                  title="Manual"
                  text="Save tape measurements."
                  onPress={handleStartManualInput}
                  tone="blue"
                />
                <FeatureTile
                  icon={Bell}
                  title="Reminders"
                  text={`${reminders.length} active reminder${reminders.length === 1 ? "" : "s"}.`}
                  onPress={() => loadReminders({ openScreen: true })}
                  tone="rose"
                />
              </>
            ) : null}
            <FeatureTile
              icon={FileText}
              title="Drafts"
              text={`${measurementDrafts.length} unfinished measurement${measurementDrafts.length === 1 ? "" : "s"}.`}
              onPress={() => loadMeasurementDrafts({ openScreen: true })}
              tone="violet"
            />
            <FeatureTile
              icon={Palette}
              title="Styles"
              text={`${styleLibrary.length} saved idea${styleLibrary.length === 1 ? "" : "s"}.`}
              onPress={() => loadStyleLibrary({ openScreen: true })}
              tone="teal"
            />
            <FeatureTile
              icon={ClipboardList}
              title="Records"
              text="Open saved measurements."
              onPress={() => handleNavigate("records")}
              tone="amber"
            />
            <FeatureTile
              icon={User}
              title="Mode"
              text="Switch workspace."
              onPress={() => setScreen("mode")}
              tone="slate"
            />
          </View>

        </ScrollView>
      </AppShell>
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
  screen: {
    flex: 1,
    backgroundColor: "#0B0A08",
    paddingHorizontal: 18,
  },
  screenLight: {
    backgroundColor: "#FFF8E7",
  },
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
  shellBody: {
    flex: 1,
    marginHorizontal: 20,
    paddingBottom: 88,
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
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  logoBadge: {
    alignItems: "center",
    backgroundColor: palette.amber,
    borderColor: "#FFD37A",
    borderRadius: 18,
    borderWidth: 2,
    height: 58,
    justifyContent: "center",
    width: 58,
  },
  logoBadgeCompact: {
    borderRadius: 13,
    height: 42,
    width: 42,
  },
  logoBadgeText: {
    color: palette.black,
    fontSize: 18,
    fontWeight: "900",
  },
  logoBadgeTextCompact: {
    fontSize: 13,
  },
  brandName: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "900",
  },
  brandNameLight: {
    color: "#15120b",
  },
  brandNameCompact: {
    fontSize: 22,
  },
  brandAccent: {
    color: palette.amber,
  },
  brandTagline: {
    color: "#F8E6B8",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    marginTop: 2,
    textTransform: "uppercase",
  },
  brandTaglineLight: {
    color: "#6b4b05",
  },
  brandTaglineCompact: {
    fontSize: 8,
    letterSpacing: 1.4,
  },
  appHeader: {
    paddingBottom: 18,
    paddingTop: 8,
  },
  appHeaderTop: {
    minHeight: 44,
    justifyContent: "center",
  },
  headerBackButton: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 13,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  headerBackButtonLight: {
    borderColor: "rgba(21,18,11,0.16)",
    backgroundColor: "#FFFDF6",
  },
  headerBackText: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
  },
  headerBackTextLight: {
    color: "#15120b",
  },
  pageTitle: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 36,
    marginTop: 16,
  },
  pageTitleLight: {
    color: "#15120b",
  },
  pageSubtitle: {
    color: "#D8C9A8",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 8,
  },
  pageSubtitleLight: {
    color: "#6f6759",
  },
  bottomNavWrap: {
    bottom: 0,
    left: 0,
    paddingBottom: 10,
    paddingHorizontal: 20,
    position: "absolute",
    right: 0,
  },
  bottomNav: {
    backgroundColor: "#12100C",
    borderColor: "rgba(255,159,0,0.22)",
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    padding: 6,
  },
  bottomNavLight: {
    backgroundColor: "#FFFDF6",
    borderColor: "#E8D8AD",
  },
  navItem: {
    alignItems: "center",
    borderRadius: 16,
    flex: 1,
    minHeight: 52,
    justifyContent: "center",
  },
  navItemActive: {
    backgroundColor: palette.amber,
  },
  navIcon: {
    color: "#D8C9A8",
    fontSize: 15,
    fontWeight: "900",
  },
  navIconLight: {
    color: "#6f6759",
  },
  navIconActive: {
    color: palette.black,
  },
  navLabel: {
    color: "#D8C9A8",
    fontSize: 9,
    fontWeight: "900",
    marginTop: 3,
  },
  navLabelLight: {
    color: "#6f6759",
  },
  navLabelActive: {
    color: palette.black,
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
  cameraBackText: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 30,
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
  smallBackText: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
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
  actionTile: {
    backgroundColor: palette.panel,
    borderColor: "rgba(232,216,173,0.84)",
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 128,
    padding: 14,
    width: "48.5%",
  },
  actionIconBadge: {
    alignItems: "center",
    backgroundColor: "#15120b",
    borderRadius: 12,
    height: 36,
    justifyContent: "center",
    minWidth: 36,
    paddingHorizontal: 8,
    alignSelf: "flex-start",
  },
  actionIcon: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  actionTitle: {
    color: "#15120b",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 12,
  },
  actionText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 5,
  },
  photoSourceStack: {
    gap: 12,
  },
  photoSourceTile: {
    alignItems: "center",
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    minHeight: 104,
    padding: 16,
  },
  photoSourceTilePrimary: {
    borderColor: "rgba(255,159,0,0.5)",
  },
  photoSourceIconBadge: {
    alignItems: "center",
    borderRadius: 18,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  photoSourceIcon: {
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  photoSourceBody: {
    flex: 1,
  },
  photoSourceTitle: {
    color: "#15120b",
    fontSize: 18,
    fontWeight: "900",
  },
  photoSourceText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 5,
  },
  photoSourceArrow: {
    color: palette.amberDark,
    fontSize: 20,
    fontWeight: "900",
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
  offlineNotice: {
    backgroundColor: "#201A10",
    borderColor: "rgba(255,159,0,0.42)",
    borderRadius: 14,
    borderWidth: 1,
    color: "#FFE5A3",
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
  recordViewButton: {
    alignItems: "center",
    backgroundColor: palette.black,
    borderRadius: 12,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 40,
    minWidth: 92,
    paddingHorizontal: 14,
  },
  recordViewText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
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
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(8,8,7,0.64)",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  confirmPanel: {
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderRadius: 24,
    borderWidth: 1,
    maxWidth: 420,
    padding: 20,
    width: "100%",
  },
  confirmTitle: {
    color: "#15120b",
    fontSize: 22,
    fontWeight: "900",
  },
  confirmText: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 8,
  },
  confirmActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
    marginTop: 20,
  },
  cancelButton: {
    alignItems: "center",
    borderColor: palette.line,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 16,
  },
  cancelButtonText: {
    color: "#15120b",
    fontSize: 14,
    fontWeight: "900",
  },
  primaryModalButton: {
    alignItems: "center",
    backgroundColor: palette.amber,
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 18,
  },
  primaryModalButtonText: {
    color: "#15120b",
    fontSize: 14,
    fontWeight: "900",
  },
  deleteButton: {
    alignItems: "center",
    backgroundColor: "#C83434",
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 18,
  },
  deleteButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  dangerZoneBlock: {
    borderColor: "#F3B8B8",
  },
  dangerZoneTitle: {
    color: "#991B1B",
    fontSize: 18,
    fontWeight: "900",
  },
  deleteAccountButton: {
    alignItems: "center",
    borderColor: "#C83434",
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 14,
    minHeight: 48,
    paddingHorizontal: 18,
  },
  deleteAccountButtonText: {
    color: "#C83434",
    fontSize: 14,
    fontWeight: "900",
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
  profileSummary: {
    backgroundColor: palette.softGold,
    borderColor: palette.amber,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 14,
    padding: 18,
  },
  profileName: {
    color: "#15120b",
    fontSize: 22,
    fontWeight: "900",
  },
  profileMeta: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 5,
  },
  profileMode: {
    alignSelf: "flex-start",
    backgroundColor: palette.black,
    borderRadius: 999,
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    textTransform: "uppercase",
  },
  themeToggleRow: {
    alignItems: "center",
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    padding: 14,
  },
  themeToggleTitle: {
    color: "#15120b",
    fontSize: 15,
    fontWeight: "900",
  },
  themeToggleText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
  },
  appearanceButton: {
    alignItems: "center",
    backgroundColor: palette.black,
    borderColor: "rgba(255,159,0,0.22)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 38,
    minWidth: 78,
    paddingHorizontal: 14,
  },
  appearanceButtonCompact: {
    minHeight: 34,
    minWidth: 68,
    paddingHorizontal: 12,
  },
  appearanceButtonLight: {
    backgroundColor: palette.amber,
    borderColor: palette.amber,
  },
  appearanceButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  appearanceButtonTextLight: {
    color: palette.black,
  },
  moreItem: {
    alignItems: "center",
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    minHeight: 78,
    padding: 15,
  },
  moreItemTitle: {
    color: "#15120b",
    fontSize: 16,
    fontWeight: "900",
  },
  moreItemText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 4,
    maxWidth: 260,
  },
  moreChevron: {
    color: palette.amberDark,
    fontSize: 18,
    fontWeight: "900",
  },
  planScreenContent: {
    paddingBottom: 36,
  },
  premiumPlanCard: {
    backgroundColor: "#11100e",
    borderColor: "rgba(255,159,0,0.3)",
    borderRadius: 22,
    borderWidth: 1,
    padding: 22,
  },
  premiumPlanCardLight: {
    backgroundColor: "#fff9ea",
    borderColor: "rgba(196,111,0,0.42)",
  },
  premiumBadgeRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 26,
  },
  premiumBadge: {
    backgroundColor: palette.amber,
    borderRadius: 10,
    color: "#15120b",
    fontSize: 13,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resultGuideChipLight: {
    backgroundColor: "#fffaf0",
    borderColor: "rgba(196,111,0,0.18)",
  },
  premiumCurrentBadge: {
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    borderWidth: 1,
    color: "#d7c9a2",
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 7,
    textTransform: "uppercase",
  },
  premiumCurrentBadgeLight: {
    borderColor: "rgba(196,111,0,0.26)",
    color: "#7a4b00",
  },
  premiumPrice: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "900",
  },
  premiumPriceLight: {
    color: "#15120b",
  },
  premiumPriceNote: {
    color: "#d7c9a2",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 6,
  },
  premiumPriceNoteLight: {
    color: "#6f6759",
  },
  premiumIntro: {
    color: "#b9afa1",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 28,
  },
  premiumIntroLight: {
    color: "#5f584c",
  },
  billingToggleRow: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
    padding: 6,
  },
  billingToggleRowLight: {
    backgroundColor: "#efe5c8",
  },
  billingToggle: {
    alignItems: "center",
    borderRadius: 12,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 8,
  },
  billingToggleActive: {
    backgroundColor: palette.amber,
  },
  billingToggleLight: {
    backgroundColor: "#fffdf6",
  },
  billingToggleText: {
    color: "#d7c9a2",
    fontSize: 13,
    fontWeight: "900",
  },
  billingToggleTextLight: {
    color: "#5f584c",
  },
  billingToggleTextActive: {
    color: "#15120b",
  },
  billingToggleBadge: {
    color: "#15120b",
    fontSize: 10,
    fontWeight: "900",
    marginTop: 2,
  },
  premiumFeatureList: {
    gap: 14,
    marginTop: 28,
  },
  premiumFeatureRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
  },
  premiumFeatureIcon: {
    color: palette.amber,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 22,
    width: 18,
  },
  premiumFeatureText: {
    color: "#f8efe2",
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 22,
  },
  premiumFeatureTextLight: {
    color: "#15120b",
  },
  planUpgradeButton: {
    alignItems: "center",
    backgroundColor: palette.amber,
    borderRadius: 16,
    justifyContent: "center",
    marginTop: 30,
    minHeight: 56,
    paddingHorizontal: 16,
  },
  planUpgradeButtonText: {
    color: "#15120b",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  premiumStatusText: {
    color: "#d7c9a2",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
    marginTop: 14,
    textAlign: "center",
  },
  premiumStatusTextLight: {
    color: "#7a4b00",
  },
  planFooterNote: {
    color: "#a9a091",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 19,
    marginTop: 14,
    textAlign: "center",
  },
  planFooterNoteLight: {
    color: "#5f584c",
  },
  infoPanel: {
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
  },
  inlineSettingsBlock: {
    borderColor: "rgba(232,216,173,0.8)",
    borderTopWidth: 1,
    marginTop: 16,
    paddingTop: 16,
  },
  infoLabel: {
    color: palette.amberDark,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginTop: 14,
    textTransform: "uppercase",
  },
  infoValue: {
    color: "#15120b",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 5,
  },
  helpItem: {
    alignItems: "flex-start",
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
    padding: 14,
  },
  helpBullet: {
    color: palette.amberDark,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 22,
  },
  helpText: {
    color: "#15120b",
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 21,
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
  aboutTitle: {
    color: "#15120b",
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 28,
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
  logoutButton: {
    alignItems: "center",
    marginTop: 18,
  },
  logoutText: {
    color: "#991b1b",
    fontSize: 14,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.78,
  },
});
