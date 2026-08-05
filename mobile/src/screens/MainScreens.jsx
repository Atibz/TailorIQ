import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Bell, ClipboardList, FileText, Palette, Ruler, User } from "lucide-react-native";

import { FeatureTile } from "../components/ActionTiles";
import { AppHeader, AppShell, BrandMark, OfflineNotice } from "../components/AppLayout";
import { palette } from "../theme";

export function PasswordResetScreen({
  isLightMode,
  isPositiveStatus,
  onBackToLogin,
  onSubmit,
  resetPassword,
  resetPasswordConfirm,
  saving,
  setResetPassword,
  setResetPasswordConfirm,
  setShowPassword,
  showPassword,
  status,
}) {
  return (
    <SafeAreaView style={styles.authScreen}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled">
          <View style={styles.authBrandPanel}>
            <BrandMark light={isLightMode} />
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
              onPress={onSubmit}
              style={({ pressed }) => [styles.primaryButton, saving && styles.disabledButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryButtonText}>{saving ? "Updating..." : "Update password"}</Text>
            </Pressable>
            <Pressable onPress={onBackToLogin} style={styles.textButton}>
              <Text style={styles.textButtonText}>Back to login</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function ModeScreen({ isLightMode, offlineMessage, onSelectMode, saving, status }) {
  return (
    <AppShell isLightMode={isLightMode}>
      <AppHeader
        isLightMode={isLightMode}
        title="Choose your workspace"
        subtitle="Keep client self-measurements separate from tailor records."
      />

      <View style={styles.modeStack}>
        <OfflineNotice message={offlineMessage} />
        {status ? <Text style={styles.errorText}>{status}</Text> : null}

        <Pressable
          disabled={saving}
          onPress={() => onSelectMode("tailor")}
          style={({ pressed }) => [styles.workspaceTile, styles.workspaceTilePrimary, pressed && styles.pressed]}
        >
          <Text style={styles.tileEyebrow}>For your shop</Text>
          <Text style={styles.workspaceTitle}>Tailor mode</Text>
          <Text style={styles.workspaceText}>Capture, review, save, and manage client measurements.</Text>
        </Pressable>

        <Pressable
          disabled={saving}
          onPress={() => onSelectMode("client")}
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

export function HomeScreen({
  isLightMode,
  measurementDrafts,
  offlineMessage,
  onNavigate,
  onOpenRecords,
  onOpenStyles,
  onOpenDrafts,
  onOpenReminders,
  onOpenManual,
  onOpenMode,
  onStartMeasurement,
  profile,
  remindersLocked = false,
  reminders,
  status,
  styleLibrary,
}) {
  return (
    <AppShell isLightMode={isLightMode} active="home" onNavigate={onNavigate}>
      <AppHeader
        isLightMode={isLightMode}
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
          <Pressable onPress={onStartMeasurement} style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}>
            <Text style={styles.heroButtonText}>New measurement</Text>
          </Pressable>
        </View>

        <View style={styles.actionGrid}>
          {profile?.mode === "tailor" ? (
            <>
              <FeatureTile icon={Ruler} title="Manual" text="Save tape measurements." onPress={onOpenManual} tone="blue" />
              <FeatureTile
                icon={Bell}
                title="Reminders"
                text={remindersLocked
                  ? "Upgrade to set fitting and pickup alerts."
                  : `${reminders.length} active reminder${reminders.length === 1 ? "" : "s"}.`}
                onPress={onOpenReminders}
                tone="rose"
                badge={remindersLocked ? "Pro" : ""}
              />
            </>
          ) : null}
          <FeatureTile
            icon={FileText}
            title="Drafts"
            text={`${measurementDrafts.length} unfinished measurement${measurementDrafts.length === 1 ? "" : "s"}.`}
            onPress={onOpenDrafts}
            tone="violet"
          />
          <FeatureTile
            icon={Palette}
            title="Styles"
            text={`${styleLibrary.length} saved idea${styleLibrary.length === 1 ? "" : "s"}.`}
            onPress={onOpenStyles}
            tone="teal"
          />
          <FeatureTile icon={ClipboardList} title="Records" text="Open saved measurements." onPress={onOpenRecords} tone="amber" />
          <FeatureTile icon={User} title="Mode" text="Switch workspace." onPress={onOpenMode} tone="slate" />
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  authScreen: {
    backgroundColor: "#0B0A08",
    flex: 1,
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
  authBrandPanel: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    borderRadius: 24,
    borderWidth: 0,
    marginBottom: 12,
    padding: 18,
    position: "relative",
  },
  authPanel: {
    backgroundColor: palette.panel,
    borderRadius: 24,
    padding: 18,
  },
  panelTitle: {
    color: "#15120b",
    fontSize: 26,
    fontWeight: "900",
  },
  panelText: {
    color: "#5f584c",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
    marginTop: 8,
  },
  input: {
    backgroundColor: palette.softGold,
    borderRadius: 12,
    color: "#15120b",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 12,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  passwordRow: {
    alignItems: "center",
    backgroundColor: palette.softGold,
    borderRadius: 12,
    flexDirection: "row",
    marginBottom: 12,
    minHeight: 52,
  },
  passwordInput: {
    color: "#15120b",
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    paddingHorizontal: 14,
  },
  eyeButton: {
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 14,
  },
  eyeText: {
    color: "#8a5a00",
    fontSize: 12,
    fontWeight: "900",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: palette.amber,
    borderRadius: 12,
    justifyContent: "center",
    marginTop: 4,
    minHeight: 52,
  },
  primaryButtonText: {
    color: "#141006",
    fontSize: 15,
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
  successText: {
    backgroundColor: "#dcfce7",
    borderRadius: 10,
    color: "#166534",
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 19,
    marginBottom: 12,
    padding: 12,
  },
  errorText: {
    backgroundColor: "#fee2e2",
    borderRadius: 10,
    color: "#991b1b",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
    marginBottom: 12,
    padding: 12,
  },
  pressed: {
    opacity: 0.78,
  },
  modeStack: {
    gap: 12,
  },
  workspaceTile: {
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
  },
  workspaceTilePrimary: {
    backgroundColor: palette.softGold,
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
});
