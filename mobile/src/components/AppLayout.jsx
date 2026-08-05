import React from "react";
import { Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";
import { ArrowLeft, ClipboardList, Home, MoreHorizontal, Plus } from "lucide-react-native";

import { IconGlyph } from "./ActionTiles";
import { palette } from "../theme";

export function BrandMark({ compact = false, light = false }) {
  return (
    <View style={styles.brandRow}>
      <View style={[styles.logoBadge, compact && styles.logoBadgeCompact]}>
        <Text style={[styles.logoBadgeText, compact && styles.logoBadgeTextCompact]}>IQ</Text>
      </View>
      <View>
        <Text style={[styles.brandName, compact && styles.brandNameCompact, light && styles.brandNameLight]}>
          Tailor<Text style={styles.brandAccent}>IQ</Text>
        </Text>
        <Text style={[styles.brandTagline, compact && styles.brandTaglineCompact, light && styles.brandTaglineLight]}>
          Measure smart. Fit perfect.
        </Text>
      </View>
    </View>
  );
}

export function AppHeader({ title, subtitle, onBack, isLightMode = false }) {
  return (
    <View style={styles.appHeader}>
      <View style={styles.appHeaderTop}>
        {onBack ? (
          <Pressable onPress={onBack} style={({ pressed }) => [styles.headerBackButton, isLightMode && styles.headerBackButtonLight, pressed && styles.pressed]}>
            <ArrowLeft color={isLightMode ? "#15120b" : "#ffffff"} size={22} strokeWidth={2.8} />
          </Pressable>
        ) : (
          <BrandMark compact light={isLightMode} />
        )}
      </View>
      <Text style={[styles.pageTitle, isLightMode && styles.pageTitleLight]}>{title}</Text>
      {subtitle ? <Text style={[styles.pageSubtitle, isLightMode && styles.pageSubtitleLight]}>{subtitle}</Text> : null}
    </View>
  );
}

export function BottomNav({ active, onNavigate, isLightMode = false }) {
  const items = [
    { id: "home", label: "Home", icon: Home },
    { id: "measure", label: "Measure", icon: Plus },
    { id: "records", label: "Records", icon: ClipboardList },
    { id: "more", label: "More", icon: MoreHorizontal },
  ];

  return (
    <View style={styles.bottomNavWrap}>
      <View style={[styles.bottomNav, isLightMode && styles.bottomNavLight]}>
        {items.map((item) => {
          const activeItem = active === item.id;

          return (
            <Pressable
              key={item.id}
              onPress={() => onNavigate(item.id)}
              style={[styles.navItem, activeItem && styles.navItemActive]}
            >
              <IconGlyph
                Icon={item.icon}
                color={activeItem ? palette.black : isLightMode ? "#6f6759" : "#D8C9A8"}
                size={20}
                strokeWidth={2.7}
              />
              <Text style={[
                styles.navLabel,
                isLightMode && styles.navLabelLight,
                activeItem && styles.navLabelActive,
              ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function AppShell({ children, active = "home", onNavigate, isLightMode = false }) {
  return (
    <SafeAreaView style={[styles.screen, isLightMode && styles.screenLight]}>
      <StatusBar barStyle={isLightMode ? "dark-content" : "light-content"} />
      <View style={styles.shellBody}>{children}</View>
      {onNavigate ? <BottomNav active={active} onNavigate={onNavigate} isLightMode={isLightMode} /> : null}
    </SafeAreaView>
  );
}

export function OfflineNotice({ message }) {
  if (!message) {
    return null;
  }

  return <Text style={styles.offlineNotice}>{message}</Text>;
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.76,
  },
  screen: {
    backgroundColor: "#0c0b08",
    flex: 1,
  },
  screenLight: {
    backgroundColor: palette.cream,
  },
  shellBody: {
    flex: 1,
    marginHorizontal: 8,
    paddingBottom: 96,
    paddingHorizontal: 12,
    paddingTop: 8,
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
    justifyContent: "center",
    minHeight: 44,
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
    backgroundColor: "#FFFDF6",
    borderColor: "rgba(21,18,11,0.16)",
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
    justifyContent: "center",
    minHeight: 52,
  },
  navItemActive: {
    backgroundColor: palette.amber,
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
  offlineNotice: {
    backgroundColor: "#FFF5DD",
    borderColor: "rgba(255,159,0,0.32)",
    borderRadius: 14,
    borderWidth: 1,
    color: "#5f3b00",
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 18,
    marginBottom: 12,
    padding: 12,
  },
});
