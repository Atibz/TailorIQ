import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
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
import * as ImagePicker from "expo-image-picker";
import * as Speech from "expo-speech";

import { buildMeasurementList, getProfileFields, roundMeasurement } from "./src/constants/measurementFields";
import { requestMobileMeasurements } from "./src/services/measurementApi";
import { deleteMobileReminder, fetchMobileReminders, saveMobileReminder } from "./src/services/reminderApi";
import { deleteMobileStyle, fetchMobileStyles, saveMobileStyle } from "./src/services/styleApi";
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
import { getSupabaseConfigError, hasSupabaseConfig, supabase } from "./src/services/supabaseClient";

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

function isNoisyPhotoWarning(message = "") {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("close to the frame edge") ||
    normalizedMessage.includes("near the frame edge") ||
    normalizedMessage.includes("move back only if") ||
    normalizedMessage.includes("very close to the frame edge") ||
    normalizedMessage.includes("person is too close to the camera")
  );
}

function cleanPhotoWarnings(warnings = []) {
  return warnings.filter((warning) => !isNoisyPhotoWarning(warning));
}

function cleanPhotoMessage(message = "") {
  return isNoisyPhotoWarning(message) ? "" : message;
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

function BrandMark({ compact = false }) {
  return (
    <View style={styles.brandRow}>
      <View style={[styles.logoBadge, compact && styles.logoBadgeCompact]}>
        <Text style={[styles.logoBadgeText, compact && styles.logoBadgeTextCompact]}>IQ</Text>
      </View>
      <View>
        <Text style={[styles.brandName, compact && styles.brandNameCompact]}>
          Tailor<Text style={styles.brandAccent}>IQ</Text>
        </Text>
        <Text style={[styles.brandTagline, compact && styles.brandTaglineCompact]}>
          Measure smart. Fit perfect.
        </Text>
      </View>
    </View>
  );
}

function AppHeader({ title, subtitle, onBack }) {
  return (
    <View style={styles.appHeader}>
      <View style={styles.appHeaderTop}>
        {onBack ? (
          <Pressable onPress={onBack} style={({ pressed }) => [styles.headerBackButton, pressed && styles.pressed]}>
            <Text style={styles.headerBackText}>{"<"}</Text>
          </Pressable>
        ) : (
          <BrandMark compact />
        )}
      </View>
      <Text style={styles.pageTitle}>{title}</Text>
      {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function BottomNav({ active, onNavigate }) {
  const items = [
    { id: "home", label: "Home", icon: "^" },
    { id: "measure", label: "Measure", icon: "+" },
    { id: "records", label: "Records", icon: "[]" },
    { id: "more", label: "More", icon: "..." },
  ];

  return (
    <View style={styles.bottomNavWrap}>
      <View style={styles.bottomNav}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => onNavigate(item.id)}
            style={[styles.navItem, active === item.id && styles.navItemActive]}
          >
            <Text style={[styles.navIcon, active === item.id && styles.navIconActive]}>{item.icon}</Text>
            <Text style={[styles.navLabel, active === item.id && styles.navLabelActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function AppShell({ children, active = "home", onNavigate }) {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <View style={styles.shellBody}>{children}</View>
      {onNavigate ? <BottomNav active={active} onNavigate={onNavigate} /> : null}
    </SafeAreaView>
  );
}

function FeatureTile({ title, text, icon, onPress, tone = "light" }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionTile,
        tone === "gold" && styles.actionTileGold,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.actionIconBadge, tone === "gold" && styles.actionIconBadgeGold]}>
        <Text style={[styles.actionIcon, tone === "gold" && styles.actionIconGold]}>{icon}</Text>
      </View>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionText}>{text}</Text>
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
    .map((measurement) => `${measurement.label}: ${roundMeasurement(measurement.valueCm)} cm`);

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

function buildManualMeasurementList(profileId, values = {}) {
  return getProfileFields(profileId).map((field) => ({
    fieldKey: field.key,
    label: field.label,
    valueCm: values[field.valueKey] || "",
    note: field.note,
    group: field.group,
  }));
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
    throw error;
  }

  return {
    id: user.id,
    email: user.email,
    fullName: data.full_name || user.user_metadata?.full_name || "",
    username: data.username || user.user_metadata?.username || "",
    mode: data.mode || "",
    customShorthand: data.custom_shorthand || {},
  };
}

async function resolveLoginEmail(identifier) {
  const cleanIdentifier = identifier.trim();

  if (cleanIdentifier.includes("@")) {
    return cleanIdentifier;
  }

  const { data, error } = await supabase.rpc("get_email_by_username", {
    lookup_username: normalizeUsername(cleanIdentifier),
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("No account found for that username.");
  }

  return data;
}

export default function App() {
  const [screen, setScreen] = useState("auth");
  const [authMode, setAuthMode] = useState("login");
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [profile, setProfile] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
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
  const [retakeOnlyView, setRetakeOnlyView] = useState(null);
  const [selfInstructionReady, setSelfInstructionReady] = useState(false);
  const [measurementDetails, setMeasurementDetails] = useState({
    profile: "female",
    height: "",
    customerName: "",
  });
  const [measurementResult, setMeasurementResult] = useState(null);
  const [reviewMeasurements, setReviewMeasurements] = useState([]);
  const [generatedMeasurements, setGeneratedMeasurements] = useState([]);
  const [savedRecords, setSavedRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [recordToDelete, setRecordToDelete] = useState(null);
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
  const [reminderForm, setReminderForm] = useState({
    customerName: "",
    title: "",
    type: "Fitting",
    dueDate: toDateInputValue(new Date()),
    dueTime: "09:00",
    note: "",
  });
  const [styleLibrary, setStyleLibrary] = useState([]);
  const [stylesLoading, setStylesLoading] = useState(false);
  const [styleViewMode, setStyleViewMode] = useState("grid");
  const [styleSearch, setStyleSearch] = useState("");
  const [styleCategoryFilter, setStyleCategoryFilter] = useState("all");
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [styleToDelete, setStyleToDelete] = useState(null);
  const [styleForm, setStyleForm] = useState({
    title: "",
    category: "Gown",
    notes: "",
    image: null,
  });
  const cameraRef = useRef(null);
  const draftSaveTimerRef = useRef(null);
  const draftCloudIdsRef = useRef({});
  const lastCameraInstructionRef = useRef("");
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
    if (screen !== "capture" || captureMode !== "self" || !cameraReady || !selfInstructionReady || capturing || captureCoolingDown || captureRetryPaused || countdown !== null) {
      return undefined;
    }

    const startTimer = setTimeout(() => {
      setCountdown(5);
    }, 350);

    return () => clearTimeout(startTimer);
  }, [cameraReady, captureCoolingDown, captureMode, captureRetryPaused, capturing, countdown, screen, selfInstructionReady]);

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
        setScreen("auth");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    restoreSession();

    const { data: listener } = supabase?.auth.onAuthStateChange(async (_event, session) => {
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

  const updateForm = (name, value) => {
    setStatus("");
    setForm((currentForm) => ({ ...currentForm, [name]: value }));
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
      setStatus(error.message);
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
    setScreen("auth");
  };

  const loadSavedRecords = async () => {
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
    setScreen("records");
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
    scheduleReminderNotifications(result.reminders).catch(() => {
      // Notification scheduling is helpful but should not block opening reminders.
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

    const result = await fetchMobileStyles({ user: profile });

    setStylesLoading(false);

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
    setActiveDraftId(`draft-${Date.now()}`);
    setCaptureStep("front");
    setCaptureMode(profile?.mode === "client" ? "self" : "assisted");
    setMeasurementPhotoSource("camera");
    setCapturedPhotos({ front: null, side: null });
    setMeasurementResult(null);
    setGeneratedMeasurements([]);
    setReviewMeasurements([]);
    setCameraReady(false);
    setCapturing(false);
    setCountdown(null);
    setCaptureCoolingDown(false);
    setCaptureRetryPaused(false);
    setCaptureFlashVisible(false);
    setPhotoCheckStatus("");
    setSelfInstructionReady(false);
    lastCameraInstructionRef.current = "";
    setRetakeOnlyView(null);

    setScreen("captureChoice");
  };

  const handleStartManualInput = () => {
    const profileId = measurementDetails.profile || "female";

    setStatus("");
    setActiveDraftId(null);
    setMeasurementDetails({
      profile: profileId,
      height: "",
      customerName: "",
    });
    setCapturedPhotos({ front: null, side: null });
    setMeasurementResult(null);
    setGeneratedMeasurements([]);
    setReviewMeasurements(buildManualMeasurementList(profileId));
    setScreen("manualInput");
  };

  const handleManualProfileChange = (profileId) => {
    setMeasurementDetails((currentDetails) => ({
      ...currentDetails,
      profile: profileId,
    }));
    setReviewMeasurements(buildManualMeasurementList(profileId));
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
    setMeasurementDetails(draft.measurementDetails || {
      profile: "female",
      height: "",
      customerName: "",
    });
    setCapturedPhotos(draft.capturedPhotos || { front: null, side: null });
    setMeasurementResult(draft.measurementResult || null);
    setGeneratedMeasurements(draft.generatedMeasurements || []);
    setReviewMeasurements(draft.reviewMeasurements || []);
    setCaptureMode(draft.captureMode || (profile?.mode === "client" ? "self" : "assisted"));
    setMeasurementPhotoSource(draft.measurementPhotoSource || "camera");
    setCaptureStep(draft.capturedPhotos?.front?.uri && !draft.capturedPhotos?.side?.uri ? "side" : "front");
    setCameraReady(false);
    setCountdown(null);
    setCaptureCoolingDown(false);
    setCaptureRetryPaused(false);
    setPhotoCheckStatus("");
    setSelfInstructionReady(false);
    lastCameraInstructionRef.current = "";
    setRetakeOnlyView(null);

    if (draft.stage === "review" && draft.reviewMeasurements?.length) {
      setScreen("measurementResult");
      return;
    }

    if (draft.capturedPhotos?.front?.uri || draft.capturedPhotos?.side?.uri) {
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
      const captureValidation = buildPhotoReadyCheck(captureStep, "Photo captured. Review it before analysis.");

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
    const heightCm = Number(measurementDetails.height);

    if (!capturedPhotos.front?.uri || !capturedPhotos.side?.uri) {
      setStatus("Capture front and side photos before analysis.");
      return;
    }

    if (!Number.isFinite(heightCm) || heightCm < 90 || heightCm > 230) {
      setStatus("Enter the person's height in cm before analysis.");
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
      setScreen("measurementResult");
    } catch (error) {
      setStatus(error.message || "Measurement analysis failed. Try again.");
      setScreen("reviewPhotos");
    } finally {
      setSaving(false);
    }
  };

  const handleReviewMeasurementChange = (index, value) => {
    setReviewMeasurements((currentMeasurements) => currentMeasurements.map((measurement, measurementIndex) => (
      measurementIndex === index
        ? { ...measurement, valueCm: value }
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

    if (!measurementDetails.customerName.trim()) {
      setStatus("Customer name is required before saving.");
      return;
    }

    const cleanMeasurements = reviewMeasurements
      .map((measurement) => ({
        ...measurement,
        valueCm: roundMeasurement(measurement.valueCm),
      }))
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
      measurementDetails,
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
    setScreen("records");
  };

  const resetReminderForm = () => {
    setEditingReminderId(null);
    setReminderForm({
      customerName: "",
      title: "",
      type: "Fitting",
      dueDate: toDateInputValue(new Date()),
      dueTime: "09:00",
      note: "",
    });
    setStatus("");
  };

  const handleEditReminder = (reminder) => {
    const dueDate = reminder.dueAt ? new Date(reminder.dueAt) : new Date();

    setEditingReminderId(reminder.id);
    setReminderForm({
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
    const nextReminder = {
      ...(existingReminder || {}),
      id: existingReminder?.id || `reminder-${Date.now()}`,
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
    setStatus("");
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

    setStyleLibrary((currentStyles) => [result.style, ...currentStyles]);
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

  const handleSaveMeasurementResult = async () => {
    if (!profile?.id) {
      setStatus("Login again before saving.");
      return;
    }

    if (profile.mode === "tailor" && !measurementDetails.customerName.trim()) {
      setStatus("Customer name is required before saving.");
      return;
    }

    const cleanMeasurements = reviewMeasurements.map((measurement) => ({
      ...measurement,
      valueCm: roundMeasurement(measurement.valueCm),
    }));

    setSaving(true);
    setStatus("");

    const result = await saveMobileMeasurement({
      user: profile,
      mode: profile.mode || "client",
      profile: measurementDetails.profile,
      measurementDetails,
      measurements: cleanMeasurements,
      generatedMeasurements,
      warnings: measurementResult?.warnings || [],
    });

    setSaving(false);

    if (!result.ok) {
      setStatus(result.message);
      return;
    }

    setReviewMeasurements(cleanMeasurements);
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
    setStatus("Measurement saved.");
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
          subtitle="Use the camera now or upload clear front and side photos."
          onBack={() => setScreen("home")}
        />

        <View style={styles.modeStack}>
          {status ? <Text style={styles.errorText}>{status}</Text> : null}

          <View style={styles.actionGrid}>
            {isClientMode ? (
              <FeatureTile
                icon="me"
                title="Take it myself"
                text="Use the front camera with an automatic countdown."
                onPress={() => {
                  setStatus("");
                  setScreen("selfCaptureSetup");
                }}
                tone="gold"
              />
            ) : (
              <FeatureTile
                icon="cam"
                title="Use camera"
                text="Capture front and side photos now."
                onPress={() => openCaptureCamera({ mode: "assisted", step: "front" })}
                tone="gold"
              />
            )}
            {isClientMode ? (
              <FeatureTile
                icon="cam"
                title="Someone is helping"
                text="Use the back camera with the guided shutter flow."
                onPress={() => openCaptureCamera({ mode: "assisted", step: "front" })}
              />
            ) : null}
            <FeatureTile
              icon="img"
              title="Upload photos"
              text="Choose existing front and side photos from your gallery."
              onPress={handleStartPhotoUpload}
            />
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
    const showShutter = captureMode !== "self" && cameraReady && !capturing && !captureCoolingDown;
    const guideReading = capturing
      ? "..."
      : countdown !== null
        ? countdown
        : cameraReady
          ? "100"
          : "0";
    const captureHintText = captureMode === "self"
      ? countdown !== null
        ? "Hold still"
        : captureRetryPaused
          ? "Adjust the phone, then retry"
          : photoCheckStatus || (cameraReady ? "Ready" : "Starting camera...")
      : photoCheckStatus || (cameraReady ? nextLabel : "Starting camera...");

    return (
      <View style={styles.cameraScreen}>
        <StatusBar barStyle="light-content" />
        <CameraView
          key={`${captureMode}-${captureStep}-${retakeOnlyView || "new"}`}
          ref={cameraRef}
          style={styles.cameraView}
          facing={cameraFacing}
          onCameraReady={() => setCameraReady(true)}
        />
        {captureFlashVisible ? <View key={captureFlashKey} style={styles.captureFlash} /> : null}

        <SafeAreaView style={styles.cameraOverlay}>
          <View style={styles.cameraTopBar}>
            <Pressable
              onPress={() => setScreen("home")}
              style={({ pressed }) => [styles.cameraBackButton, pressed && styles.pressed]}
            >
              <Text style={styles.cameraBackText}>{"<"}</Text>
            </Pressable>
            <View style={styles.capturePill}>
              <Text style={styles.capturePillText}>{captureLabel}</Text>
            </View>
            <View style={styles.cameraBackButtonPlaceholder} />
          </View>

          <View style={styles.cameraGuideFigureWrap} pointerEvents="none">
            <View style={[
              styles.cameraGuideFigure,
              captureStep === "side" && styles.cameraGuideFigureSide,
              cameraReady && styles.cameraGuideFigureReady,
            ]}>
              <View style={styles.cameraGuideHead} />
              <View style={styles.cameraGuideTorso} />
              <View style={styles.cameraGuideLegs}>
                <View style={styles.cameraGuideLeg} />
                <View style={styles.cameraGuideLeg} />
              </View>
            </View>
            <View style={[styles.cameraGuideReading, cameraReady && styles.cameraGuideReadingReady]}>
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
          {status ? <Text style={styles.errorText}>{status}</Text> : null}
          {photoCheckStatus ? <Text style={styles.noticeText}>{photoCheckStatus}</Text> : null}

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
            <TextInput
              value={measurementDetails.height}
              onChangeText={(height) => setMeasurementDetails((currentDetails) => ({
                ...currentDetails,
                height,
              }))}
              keyboardType="numeric"
              placeholder="Height in cm"
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
          onBack={() => setScreen("home")}
        />

        <ScrollView contentContainerStyle={styles.reviewContent} keyboardShouldPersistTaps="handled">
          {status ? <Text style={status === "Manual measurement saved." ? styles.successText : styles.errorText}>{status}</Text> : null}

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
              keyboardType="numeric"
              placeholder="Height in cm optional"
              placeholderTextColor="#8c8576"
              style={styles.input}
            />
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

          <View style={styles.resultGrid}>
            {reviewMeasurements.map((measurement, index) => (
              <View key={`${measurement.group}-${measurement.fieldKey}-${index}`} style={styles.resultItem}>
                <Text style={styles.resultName}>{measurement.label}</Text>
                <TextInput
                  value={String(measurement.valueCm || "")}
                  onChangeText={(value) => handleReviewMeasurementChange(index, value)}
                  keyboardType="numeric"
                  placeholder="cm"
                  placeholderTextColor="#8c8576"
                  style={styles.resultInput}
                />
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
        </ScrollView>
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
    const currentResultRecord = {
      fullname: profile?.mode === "tailor"
        ? measurementDetails.customerName.trim()
        : profile?.fullName || profile?.username || "My measurement",
      measurementProfile: measurementDetails.profile,
      measurements: reviewMeasurements.map((measurement) => ({
        ...measurement,
        valueCm: roundMeasurement(measurement.valueCm),
      })),
      updatedAt: new Date().toISOString(),
    };

    return (
      <AppShell active="measure" onNavigate={handleNavigate}>
        <AppHeader
          title="Measurement result"
          subtitle="Review generated values, correct where needed, then save."
          onBack={() => setScreen("reviewPhotos")}
        />

        <ScrollView contentContainerStyle={styles.reviewContent}>
          {status ? <Text style={status === "Measurement saved." ? styles.successText : styles.errorText}>{status}</Text> : null}
          {measurementResult?.warnings?.length > 0 && (
            <Text style={styles.warningText}>{measurementResult.warnings.join(" ")}</Text>
          )}

          <View style={styles.resultGrid}>
            {reviewMeasurements.map((measurement, index) => (
              <View key={`${measurement.group}-${measurement.fieldKey}-${index}`} style={styles.resultItem}>
                <Text style={styles.resultName}>{measurement.label}</Text>
                <TextInput
                  value={String(measurement.valueCm || "")}
                  onChangeText={(value) => handleReviewMeasurementChange(index, value)}
                  keyboardType="numeric"
                  style={styles.resultInput}
                />
                <Text style={styles.generatedText}>
                  Generated {generatedMeasurements[index]?.valueCm || measurement.valueCm} cm
                </Text>
              </View>
            ))}
          </View>

          <Pressable
            disabled={saving}
            onPress={handleSaveMeasurementResult}
            style={({ pressed }) => [
              styles.primaryButton,
              saving && styles.disabledButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>{saving ? "Saving..." : "Save measurement"}</Text>
          </Pressable>

          <Pressable
            onPress={() => handleShareMeasurements(currentResultRecord)}
            style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}
          >
            <Text style={styles.shareButtonText}>Share summary</Text>
          </Pressable>

          {profile?.mode === "client" ? (
            <Pressable
              onPress={() => openSendToTailor(currentResultRecord)}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryButtonText}>Send to tailor</Text>
            </Pressable>
          ) : null}

          <Pressable onPress={() => setScreen("home")} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Back home</Text>
          </Pressable>
        </ScrollView>
        {sendToTailorModal}
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
                    <Pressable
                      key={share.cloudShareId || share.id}
                      onPress={() => {
                        setSelectedRecord({
                          ...share.customer,
                          sharedByClient: true,
                          senderUsername: share.senderUsername,
                        });
                        setScreen("recordDetail");
                      }}
                      style={({ pressed }) => [styles.sharedCard, pressed && styles.pressed]}
                    >
                      <View>
                        <Text style={styles.recordName}>{share.customer.fullname || "Shared measurement"}</Text>
                        <Text style={styles.recordMeta}>
                          From @{share.senderUsername || "client"} - {share.customer.measurements?.length || 0} values
                        </Text>
                      </View>
                      <Text style={styles.recordDate}>
                        {share.updatedAt ? new Date(share.updatedAt).toLocaleDateString() : "Received"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {savedRecords.map((record) => (
                <View
                  key={record.cloudMeasurementId || record.id}
                  style={styles.recordCard}
                >
                  <Pressable
                    onPress={() => {
                      setSelectedRecord(record);
                      setScreen("recordDetail");
                    }}
                    style={({ pressed }) => [styles.recordInfoButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.recordName}>{record.fullname || "My measurement"}</Text>
                    <Text style={styles.recordMeta}>
                      {record.measurementProfile === "female" ? "Female" : "Male"} - {record.measurements?.length || 0} values
                    </Text>
                    <Text style={styles.recordDate}>
                      {record.updatedAt ? new Date(record.updatedAt).toLocaleDateString() : "Saved"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setRecordToDelete(record)}
                    style={({ pressed }) => [styles.recordDeleteButton, pressed && styles.recordDeleteButtonPressed]}
                  >
                    <Text style={styles.recordDeleteText}>Delete</Text>
                  </Pressable>
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
    return (
      <AppShell active="records" onNavigate={handleNavigate}>
        <AppHeader
          title={selectedRecord.fullname || "Measurement"}
          subtitle={`${selectedRecord.measurementProfile === "female" ? "Female" : "Male"} measurement record`}
          onBack={() => setScreen("records")}
        />

        <ScrollView contentContainerStyle={styles.reviewContent}>
          {selectedRecord.segmentationWarnings?.length > 0 && (
            <Text style={styles.warningText}>{selectedRecord.segmentationWarnings.join(" ")}</Text>
          )}

          <View style={styles.resultGrid}>
            {(selectedRecord.measurements || []).map((measurement, index) => (
              <View key={`${measurement.group}-${measurement.fieldKey}-${index}`} style={styles.resultItem}>
                <Text style={styles.resultName}>{measurement.label}</Text>
                <Text style={styles.savedValueText}>{roundMeasurement(measurement.valueCm)} cm</Text>
                {selectedRecord.generatedMeasurements?.[index]?.valueCm ? (
                  <Text style={styles.generatedText}>
                    Generated {selectedRecord.generatedMeasurements[index].valueCm} cm
                  </Text>
                ) : null}
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => handleShareMeasurements(selectedRecord)}
            style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}
          >
            <Text style={styles.shareButtonText}>Share summary</Text>
          </Pressable>

          {profile?.mode === "client" ? (
            <Pressable
              onPress={() => openSendToTailor(selectedRecord)}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryButtonText}>Send to tailor</Text>
            </Pressable>
          ) : null}

          {!selectedRecord.sharedByClient ? (
            <Pressable
              onPress={() => setRecordToDelete(selectedRecord)}
              style={({ pressed }) => [styles.deleteWideButton, pressed && styles.recordDeleteButtonPressed]}
            >
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
                .filter((photo) => photo?.uri).length;
              const draftName = draft.measurementDetails?.customerName || (
                profile?.mode === "client" ? "My measurement" : "Untitled measurement"
              );

              return (
                <View key={draft.id} style={styles.recordCard}>
                  <Pressable
                    onPress={() => handleContinueDraft(draft)}
                    style={({ pressed }) => [styles.recordInfoButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.recordName}>{draftName}</Text>
                    <Text style={styles.recordMeta}>
                      {draft.stage === "review" ? "Review ready" : `${photoCount}/2 photos`} - {draft.measurementDetails?.profile === "male" ? "Male" : "Female"}
                    </Text>
                    <Text style={styles.recordDate}>
                      {draft.updatedAt ? new Date(draft.updatedAt).toLocaleDateString() : "Draft"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setDraftToDelete(draft)}
                    style={({ pressed }) => [styles.recordDeleteButton, pressed && styles.recordDeleteButtonPressed]}
                  >
                    <Text style={styles.recordDeleteText}>Delete</Text>
                  </Pressable>
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
          <View style={styles.actionGrid}>
            <FeatureTile
              icon="+"
              title="Save reminder"
              text="Add fitting, pickup, or follow-up work."
              onPress={() => {
                resetReminderForm();
                setScreen("reminderForm");
              }}
              tone="gold"
            />
            <FeatureTile
              icon="list"
              title="View reminders"
              text={`${reminders.length} active reminder${reminders.length === 1 ? "" : "s"}.`}
              onPress={() => {
                loadReminders();
                setScreen("reminderList");
              }}
            />
          </View>
        </ScrollView>
      </AppShell>
    );
  }

  if (screen === "reminderForm") {
    const reminderTypes = ["Fitting", "Pickup", "Delivery", "Follow-up", "Other"];

    return (
      <AppShell active="home" onNavigate={handleNavigate}>
        <AppHeader
          title={editingReminderId ? "Edit reminder" : "Save reminder"}
          subtitle="Set the client, reason, and exact due time."
          onBack={() => setScreen("reminders")}
        />

        <ScrollView contentContainerStyle={styles.reviewContent} keyboardShouldPersistTaps="handled">
          {status ? <Text style={styles.errorText}>{status}</Text> : null}

          <View style={styles.detailsPanel}>
            <Text style={styles.detailsTitle}>Reminder details</Text>
            <Text style={styles.detailsText}>Your phone will alert you at the selected date and time.</Text>
            <TextInput
              value={reminderForm.customerName}
              onChangeText={(customerName) => setReminderForm((currentForm) => ({ ...currentForm, customerName }))}
              placeholder="Customer name"
              placeholderTextColor="#8c8576"
              style={styles.input}
            />
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
        </ScrollView>
      </AppShell>
    );
  }

  if (screen === "reminderList") {
    const sortedReminders = [...reminders].sort((firstReminder, secondReminder) => (
      new Date(firstReminder.dueAt || 0) - new Date(secondReminder.dueAt || 0)
    ));

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
                }}
                style={styles.heroButton}
              >
                <Text style={styles.heroButtonText}>Save reminder</Text>
              </Pressable>
            </View>
          ) : (
            sortedReminders.map((reminder) => (
              <View key={reminder.id} style={styles.recordCard}>
                <View style={styles.recordInfoButton}>
                  <Text style={styles.recordName}>{reminder.title || reminder.type}</Text>
                  <Text style={styles.recordMeta}>{reminder.customerName || "No customer linked"}</Text>
                  <Text style={styles.recordDate}>{formatReminderDateTime(reminder)}</Text>
                  {reminder.note ? <Text style={styles.reminderNote}>{reminder.note}</Text> : null}
                </View>
                <View style={styles.recordActionStack}>
                  <Pressable
                    onPress={() => handleEditReminder(reminder)}
                    style={({ pressed }) => [styles.recordMiniButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.recordMiniButtonText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setReminderToDelete(reminder)}
                    style={({ pressed }) => [styles.recordDeleteButton, pressed && styles.recordDeleteButtonPressed]}
                  >
                    <Text style={styles.recordDeleteText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            ))
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
          <View style={styles.actionGrid}>
            <FeatureTile
              icon="+"
              title={modeCopy.save}
              text="Choose an image, add details if needed, then save."
              onPress={() => {
                resetStyleForm();
                setScreen("styleForm");
              }}
              tone="gold"
            />
            <FeatureTile
              icon="img"
              title={modeCopy.gallery}
              text={`${styleLibrary.length} saved style${styleLibrary.length === 1 ? "" : "s"}.`}
              onPress={() => {
                loadStyleLibrary();
                setScreen("styleGallery");
              }}
            />
          </View>
        </ScrollView>
      </AppShell>
    );
  }

  if (screen === "styleForm") {
    return (
      <AppShell active="home" onNavigate={handleNavigate}>
        <AppHeader
          title={profile?.mode === "client" ? "Save style idea" : "Save style"}
          subtitle="The style name is optional. The image is what matters most."
          onBack={() => setScreen("styles")}
        />

        <ScrollView contentContainerStyle={styles.reviewContent} keyboardShouldPersistTaps="handled">
          {status ? <Text style={styles.errorText}>{status}</Text> : null}

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
            <View style={styles.reminderTypeGrid}>
              {styleCategories.map((category) => (
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
        </ScrollView>
      </AppShell>
    );
  }

  if (screen === "styleGallery") {
    const searchableTerm = styleSearch.trim().toLowerCase();
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
            {["all", ...styleCategories].map((category) => (
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
                  {category === "all" ? "All" : category}
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
                    setScreen("styleDetail");
                  }}
                  style={({ pressed }) => [
                    styleViewMode === "grid" ? styles.styleGridItem : styles.styleListItem,
                    pressed && styles.pressed,
                  ]}
                >
                  <Image
                    source={{ uri: style.imageUrl }}
                    style={styleViewMode === "grid" ? styles.styleThumb : styles.styleListThumb}
                    resizeMode="cover"
                  />
                  <View style={styleViewMode === "grid" ? styles.styleGridText : styles.styleListText}>
                    <Text style={styles.styleTitle}>{style.title || style.category}</Text>
                    <Text style={styles.styleMeta}>{style.category}</Text>
                  </View>
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
          <Pressable
            onPress={() => setStyleToDelete(selectedStyle)}
            style={({ pressed }) => [styles.deleteWideButton, pressed && styles.recordDeleteButtonPressed]}
          >
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

          {moreItems.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setScreen(item.id)}
              style={({ pressed }) => [styles.moreItem, pressed && styles.pressed]}
            >
              <View>
                <Text style={styles.moreItemTitle}>{item.title}</Text>
                <Text style={styles.moreItemText}>{item.text}</Text>
              </View>
              <Text style={styles.moreChevron}>{">"}</Text>
            </Pressable>
          ))}

          <Pressable onPress={() => setScreen("mode")} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Change mode</Text>
          </Pressable>

          <Pressable onPress={handleLogout} style={styles.logoutInline}>
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
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

        <View style={styles.infoPanel}>
          <Text style={styles.infoLabel}>Full name</Text>
          <Text style={styles.infoValue}>{profile?.fullName || "Not added"}</Text>
          <Text style={styles.infoLabel}>Username</Text>
          <Text style={styles.infoValue}>{profile?.username || "Not added"}</Text>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{profile?.email || "Not added"}</Text>
          <Text style={styles.infoLabel}>Mode</Text>
          <Text style={styles.infoValue}>{profile?.mode === "client" ? "Client mode" : "Tailor mode"}</Text>
        </View>
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
          {[
            "Wear fitted clothes so the body outline is clear.",
            "Stand straight with arms slightly away from the body.",
            "Keep the full body inside the frame from head to feet.",
            "Use the real height in cm as the first mobile anchor.",
            "Always review generated values before saving or sharing.",
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
              TailorIQ saves approved measurement records to your signed-in account so they can be retrieved across devices.
            </Text>
            <Text style={styles.policyTitle}>Photos</Text>
            <Text style={styles.policyText}>
              Mobile capture currently uses photos for analysis. Saved mobile records store measurement values, not the captured photo previews.
            </Text>
            <Text style={styles.policyTitle}>Sharing</Text>
            <Text style={styles.policyText}>
              Client measurements should only be shared after review. Future sharing tools will ask before sending results to another user.
            </Text>
            <Text style={styles.policyTitle}>Account access</Text>
            <Text style={styles.policyText}>
              Your account is handled through Supabase authentication. Keep your password private and log out on shared devices.
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

        <View style={styles.infoPanel}>
          <Text style={styles.aboutTitle}>TailorIQ helps tailors and clients turn guided photos into reviewable body measurements.</Text>
          <Text style={styles.policyText}>
            Tailor mode is built for customer records, while client mode is built for people who want to capture and approve their own measurements before sharing them.
          </Text>
          <Text style={styles.policyText}>
            The app is designed around review, correction, and saved records because generated measurements should support good tailoring decisions, not replace professional judgment.
          </Text>
        </View>
      </AppShell>
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
                  icon="cm"
                  title="Manual"
                  text="Save tape measurements."
                  onPress={handleStartManualInput}
                />
                <FeatureTile
                  icon="!"
                  title="Reminders"
                  text={`${reminders.length} active reminder${reminders.length === 1 ? "" : "s"}.`}
                  onPress={() => loadReminders({ openScreen: true })}
                />
              </>
            ) : null}
            <FeatureTile
              icon="..."
              title="Drafts"
              text={`${measurementDrafts.length} unfinished measurement${measurementDrafts.length === 1 ? "" : "s"}.`}
              onPress={() => loadMeasurementDrafts({ openScreen: true })}
            />
            <FeatureTile
              icon="img"
              title="Styles"
              text={`${styleLibrary.length} saved idea${styleLibrary.length === 1 ? "" : "s"}.`}
              onPress={() => loadStyleLibrary({ openScreen: true })}
            />
            <FeatureTile
              icon="[]"
              title="Records"
              text="Open saved measurements."
              onPress={() => handleNavigate("records")}
              tone="gold"
            />
            <FeatureTile
              icon="me"
              title="Mode"
              text="Switch workspace."
              onPress={() => setScreen("mode")}
            />
          </View>

          <Pressable onPress={handleLogout} style={styles.logoutInline}>
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </ScrollView>
      </AppShell>
    );
  }

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
            <Text style={styles.authHeadline}>
              Measurements that stay with the right person.
            </Text>
            <Text style={styles.authCopy}>
              Sign in as a tailor or client and keep every approved measurement ready when you need it.
            </Text>
          </View>

          <View style={styles.authPanel}>
            <Text style={styles.panelTitle}>{title}</Text>
            <Text style={styles.panelText}>
              {isSignup
                ? "Create your private measurement workspace."
                : "Login with your email or username."}
            </Text>

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

            <Pressable
              disabled={saving}
              onPress={handleAuth}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryButtonText}>{saving ? "Please wait..." : isSignup ? "Sign up" : "Login"}</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setStatus("");
                setAuthMode(isSignup ? "login" : "signup");
              }}
              style={styles.textButton}
            >
              <Text style={styles.textButtonText}>
                {isSignup ? "Already have an account? Login" : "New here? Create account"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0B0A08",
    paddingHorizontal: 18,
  },
  authScreen: {
    flex: 1,
    backgroundColor: "#0B0A08",
    paddingHorizontal: 18,
  },
  shellBody: {
    flex: 1,
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
  headerBackText: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
  },
  pageTitle: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 36,
    marginTop: 16,
  },
  pageSubtitle: {
    color: "#D8C9A8",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 8,
  },
  bottomNavWrap: {
    bottom: 0,
    left: 0,
    paddingBottom: 10,
    paddingHorizontal: 14,
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
  navIconActive: {
    color: palette.black,
  },
  navLabel: {
    color: "#D8C9A8",
    fontSize: 9,
    fontWeight: "900",
    marginTop: 3,
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
  cameraGuideFigure: {
    alignItems: "center",
    opacity: 0.64,
    transform: [{ scaleX: 1 }],
  },
  cameraGuideFigureSide: {
    transform: [{ scaleX: 0.42 }],
  },
  cameraGuideFigureReady: {
    opacity: 0.88,
  },
  cameraGuideHead: {
    backgroundColor: "rgba(255,255,255,0.86)",
    borderRadius: 28,
    height: 56,
    width: 48,
  },
  cameraGuideTorso: {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderTopLeftRadius: 42,
    borderTopRightRadius: 42,
    height: 144,
    marginTop: 4,
    width: 116,
  },
  cameraGuideLegs: {
    flexDirection: "row",
    gap: 14,
    marginTop: -2,
  },
  cameraGuideLeg: {
    backgroundColor: "rgba(255,255,255,0.82)",
    height: 154,
    width: 34,
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
    gap: 10,
  },
  styleList: {
    gap: 10,
  },
  styleGridItem: {
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    width: "31%",
  },
  styleListItem: {
    alignItems: "center",
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 92,
    overflow: "hidden",
    padding: 10,
  },
  styleThumb: {
    aspectRatio: 0.8,
    backgroundColor: "#15120b",
    width: "100%",
  },
  styleListThumb: {
    backgroundColor: "#15120b",
    borderRadius: 12,
    height: 76,
    width: 64,
  },
  styleGridText: {
    padding: 8,
  },
  styleListText: {
    flex: 1,
  },
  styleTitle: {
    color: "#15120b",
    fontSize: 12,
    fontWeight: "900",
  },
  styleMeta: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 4,
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
  resultGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },
  resultItem: {
    backgroundColor: "#fffaf0",
    borderRadius: 14,
    minHeight: 112,
    padding: 12,
    width: "48%",
  },
  resultName: {
    color: "#5f584c",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  resultInput: {
    backgroundColor: "#fff7df",
    borderColor: "#efe5c8",
    borderRadius: 10,
    borderWidth: 1,
    color: "#15120b",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 10,
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
    paddingVertical: 24,
  },
  authBrandPanel: {
    backgroundColor: palette.charcoal,
    borderColor: "rgba(255,159,0,0.2)",
    borderRadius: 30,
    borderWidth: 1,
    marginBottom: 14,
    padding: 22,
  },
  authHeadline: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "900",
    lineHeight: 38,
    marginTop: 28,
  },
  authCopy: {
    color: "#D8C9A8",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 12,
  },
  authPanel: {
    backgroundColor: palette.panel,
    borderRadius: 28,
    padding: 20,
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
  actionTileGold: {
    backgroundColor: "#FFF5D5",
    borderColor: "#FFD37A",
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
  actionIconBadgeGold: {
    backgroundColor: palette.amber,
  },
  actionIcon: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  actionIconGold: {
    color: palette.black,
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
    alignItems: "center",
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    minHeight: 88,
    padding: 16,
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
    fontSize: 18,
    fontWeight: "900",
  },
  recordMeta: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 5,
  },
  recordDate: {
    color: palette.amberDark,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 8,
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
    justifyContent: "center",
    minHeight: 40,
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
  infoPanel: {
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
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
    borderColor: "#d7c9a2",
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
