import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ChevronRight, Moon, Sun } from "lucide-react-native";

import { AppHeader, AppShell } from "../components/AppLayout";
import { palette } from "../theme";

const moreItems = [
  { id: "profile", title: "Profile", text: "Account details and workspace mode." },
  { id: "plans", title: "Plans", text: "Compare Free and Pro, then upgrade when payment is ready." },
  { id: "help", title: "Help", text: "Photo capture, review, and saving guidance." },
  { id: "privacy", title: "Privacy policy", text: "How measurement data and photos are handled." },
  { id: "about", title: "About TailorIQ", text: "What the app does and who it is for." },
];

export function MoreScreen({
  isLightMode,
  onBottomNavigate,
  onChangeMode,
  onLogout,
  onMenuNavigate,
  onToggleTheme,
  profile,
}) {
  return (
    <AppShell isLightMode={isLightMode} active="more" onNavigate={onBottomNavigate}>
      <AppHeader
        isLightMode={isLightMode}
        title="More"
        subtitle="Profile, support, privacy, and app information."
      />

      <ScrollView contentContainerStyle={styles.content}>
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
          <AppearanceToggle isLightMode={isLightMode} onToggle={onToggleTheme} />
        </View>

        {moreItems.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => onMenuNavigate(item.id)}
            style={({ pressed }) => [styles.moreItem, pressed && styles.pressed]}
          >
            <View>
              <Text style={styles.moreItemTitle}>{item.title}</Text>
              <Text style={styles.moreItemText}>{item.text}</Text>
            </View>
            <ChevronRight color={palette.amberDark} size={21} strokeWidth={2.8} />
          </Pressable>
        ))}

        <Pressable onPress={onChangeMode} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Change mode</Text>
        </Pressable>

        <Pressable
          onPress={onLogout}
          style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </ScrollView>
    </AppShell>
  );
}

function AppearanceToggle({ isLightMode, onToggle }) {
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.appearanceButton,
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

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.78,
  },
  content: {
    paddingBottom: 34,
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
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#fff5d6",
    borderColor: "#E4C66E",
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: "#15120b",
    fontSize: 14,
    fontWeight: "900",
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
});
