import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { AppHeader, AppShell } from "../components/AppLayout";
import { palette } from "../theme";

export function ProfileScreen({
  accountDeleteModal,
  customShorthandText,
  isLightMode,
  isPositiveStatus,
  onBack,
  onChangeUsername,
  onOpenDeleteAccount,
  onSaveCustomShorthand,
  onSetCustomShorthandText,
  onSetUsernameDraft,
  onNavigate,
  plan,
  profile,
  profileStatusTarget,
  saving,
  status,
  usernameDraft,
}) {
  return (
    <AppShell isLightMode={isLightMode} active="more" onNavigate={onNavigate}>
      <AppHeader
        isLightMode={isLightMode}
        title="Profile"
        subtitle="The identity attached to this TailorIQ workspace."
        onBack={onBack}
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.infoPanel, !isLightMode && styles.infoPanelDark]}>
          <Text style={[styles.infoLabel, !isLightMode && styles.infoLabelDark]}>Full name</Text>
          <Text style={[styles.infoValue, !isLightMode && styles.infoValueDark]}>{profile?.fullName || "Not added"}</Text>
          <Text style={[styles.infoLabel, !isLightMode && styles.infoLabelDark]}>Username</Text>
          <Text style={[styles.infoValue, !isLightMode && styles.infoValueDark]}>{profile?.username || "Not added"}</Text>
          <Text style={[styles.infoLabel, !isLightMode && styles.infoLabelDark]}>Email</Text>
          <Text style={[styles.infoValue, !isLightMode && styles.infoValueDark]}>{profile?.email || "Not added"}</Text>
          <Text style={[styles.infoLabel, !isLightMode && styles.infoLabelDark]}>Mode</Text>
          <Text style={[styles.infoValue, !isLightMode && styles.infoValueDark]}>{profile?.mode === "client" ? "Client mode" : "Tailor mode"}</Text>
          <Text style={[styles.infoLabel, !isLightMode && styles.infoLabelDark]}>Plan</Text>
          <Text style={[styles.infoValue, !isLightMode && styles.infoValueDark]}>{plan.label}</Text>
        </View>

        <View style={[styles.inlineSettingsBlock, !isLightMode && styles.inlineSettingsBlockDark]}>
          <Text style={[styles.policyTitle, !isLightMode && styles.policyTitleDark]}>Change username</Text>
          <Text style={[styles.policyText, !isLightMode && styles.policyTextDark]}>Use lowercase letters, numbers, or underscores. This is the name other users can search when sharing to you.</Text>
          <TextInput
            value={usernameDraft}
            onChangeText={onSetUsernameDraft}
            autoCapitalize="none"
            placeholder={profile?.username || "New username"}
            placeholderTextColor={isLightMode ? "#8c8576" : "#9f9278"}
            style={[styles.input, !isLightMode && styles.inputDark]}
          />
          <Pressable
            disabled={saving}
            onPress={onChangeUsername}
            style={({ pressed }) => [
              styles.secondaryButton,
              !isLightMode && styles.secondaryButtonDark,
              saving && styles.disabledButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.secondaryButtonText, !isLightMode && styles.secondaryButtonTextDark]}>{saving ? "Saving..." : "Update username"}</Text>
          </Pressable>
          {status && profileStatusTarget === "username" ? (
            <Text style={isPositiveStatus(status) ? styles.actionSuccessText : styles.actionErrorText}>{status}</Text>
          ) : null}
        </View>

        {profile?.mode === "tailor" ? (
          <View style={[styles.inlineSettingsBlock, !isLightMode && styles.inlineSettingsBlockDark]}>
            <Text style={[styles.policyTitle, !isLightMode && styles.policyTitleDark]}>Customize shorthand</Text>
            <Text style={[styles.policyText, !isLightMode && styles.policyTextDark]}>
              Add one rule per line, like SH = shoulder or LL = lower length. Ambiguous shorthand will still ask before filling values.
            </Text>
            <TextInput
              value={customShorthandText}
              onChangeText={onSetCustomShorthandText}
              placeholder={"SH = shoulder\nLL = lower length"}
              placeholderTextColor={isLightMode ? "#8c8576" : "#9f9278"}
              multiline
              style={[styles.input, !isLightMode && styles.inputDark, styles.noteInput]}
            />
            <Pressable
              disabled={saving}
              onPress={onSaveCustomShorthand}
              style={({ pressed }) => [
                styles.secondaryButton,
                !isLightMode && styles.secondaryButtonDark,
                saving && styles.disabledButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.secondaryButtonText, !isLightMode && styles.secondaryButtonTextDark]}>{saving ? "Saving..." : "Save shorthand"}</Text>
            </Pressable>
            {status && profileStatusTarget === "shorthand" ? (
              <Text style={isPositiveStatus(status) ? styles.actionSuccessText : styles.actionErrorText}>{status}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={[
          styles.inlineSettingsBlock,
          !isLightMode && styles.inlineSettingsBlockDark,
          styles.dangerZoneBlock,
          !isLightMode && styles.dangerZoneBlockDark,
        ]}>
          <Text style={styles.dangerZoneTitle}>Delete account</Text>
          <Text style={[styles.policyText, !isLightMode && styles.policyTextDark]}>
            Permanently remove this account and the saved TailorIQ data attached to it. This cannot be undone.
          </Text>
          <Pressable
            disabled={saving}
            onPress={onOpenDeleteAccount}
            style={({ pressed }) => [
              styles.deleteAccountButton,
              !isLightMode && styles.deleteAccountButtonDark,
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

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.78,
  },
  content: {
    paddingBottom: 34,
  },
  infoPanel: {
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
  },
  infoPanelDark: {
    backgroundColor: "#15120d",
    borderColor: "rgba(255,159,0,0.24)",
  },
  inlineSettingsBlock: {
    borderColor: "rgba(232,216,173,0.8)",
    borderTopWidth: 1,
    marginTop: 16,
    paddingTop: 16,
  },
  inlineSettingsBlockDark: {
    borderColor: "rgba(255,159,0,0.22)",
  },
  infoLabel: {
    color: palette.amberDark,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginTop: 12,
    textTransform: "uppercase",
  },
  infoLabelDark: {
    color: "#FFC768",
  },
  infoValue: {
    color: "#15120b",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 5,
  },
  infoValueDark: {
    color: "#FFF7E3",
  },
  policyTitle: {
    color: "#15120b",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 12,
  },
  policyTitleDark: {
    color: "#FFF7E3",
  },
  policyText: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
  },
  policyTextDark: {
    color: "#D8C9A8",
  },
  input: {
    backgroundColor: "#fff5dd",
    borderColor: palette.line,
    borderRadius: 14,
    borderWidth: 1,
    color: "#15120b",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 12,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  inputDark: {
    backgroundColor: "#211c12",
    borderColor: "rgba(255,159,0,0.34)",
    color: "#FFF7E3",
  },
  noteInput: {
    minHeight: 92,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#fff5d6",
    borderColor: "#E4C66E",
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 12,
    minHeight: 50,
    paddingHorizontal: 16,
  },
  secondaryButtonDark: {
    backgroundColor: "#FF9F00",
    borderColor: "#FFB84D",
  },
  secondaryButtonText: {
    color: "#15120b",
    fontSize: 14,
    fontWeight: "900",
  },
  secondaryButtonTextDark: {
    color: "#080807",
  },
  disabledButton: {
    opacity: 0.62,
  },
  dangerZoneBlock: {
    borderColor: "#F3B8B8",
  },
  dangerZoneBlockDark: {
    borderColor: "rgba(248,113,113,0.42)",
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
  deleteAccountButtonDark: {
    backgroundColor: "rgba(200,52,52,0.12)",
    borderColor: "#F87171",
  },
  deleteAccountButtonText: {
    color: "#C83434",
    fontSize: 14,
    fontWeight: "900",
  },
  actionErrorText: {
    backgroundColor: "#fee2e2",
    borderColor: "#fecaca",
    borderRadius: 12,
    borderWidth: 1,
    color: "#991b1b",
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 18,
    marginTop: 12,
    padding: 12,
  },
  actionSuccessText: {
    backgroundColor: "#dcfce7",
    borderColor: "#bbf7d0",
    borderRadius: 12,
    borderWidth: 1,
    color: "#166534",
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 18,
    marginTop: 12,
    padding: 12,
  },
});
