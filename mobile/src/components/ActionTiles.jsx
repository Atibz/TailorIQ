import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";

import { featureToneStyles, palette } from "../theme";

export function IconGlyph({ Icon, color = "#15120b", size = 20, strokeWidth = 2.5, style }) {
  if (!Icon) {
    return null;
  }

  return <Icon color={color} size={size} strokeWidth={strokeWidth} style={style} />;
}

function isIconComponent(icon) {
  return icon && typeof icon !== "string" && typeof icon !== "number";
}

export function FeatureTile({ title, text, icon, onPress, tone = "slate", badge }) {
  const toneStyle = featureToneStyles[tone] || featureToneStyles.slate;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionTile,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.actionIconBadge, toneStyle.badge]}>
        {isIconComponent(icon) ? (
          <IconGlyph Icon={icon} color={toneStyle.icon || toneStyle.text?.color || "#15120b"} size={22} />
        ) : (
          <Text style={[styles.actionIcon, toneStyle.text]}>{icon}</Text>
        )}
      </View>
      <View style={styles.actionTitleRow}>
        <Text style={styles.actionTitle}>{title}</Text>
        {badge ? <Text style={styles.actionBadge}>{badge}</Text> : null}
      </View>
      <Text style={styles.actionText}>{text}</Text>
    </Pressable>
  );
}

export function PhotoSourceTile({ title, text, icon, onPress, tone = "slate", primary = false }) {
  const toneStyle = featureToneStyles[tone] || featureToneStyles.slate;

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
        {isIconComponent(icon) ? (
          <IconGlyph Icon={icon} color={toneStyle.icon || toneStyle.text?.color || "#15120b"} size={24} />
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

export function RecordActionButton({ label, Icon, onPress, danger = false }) {
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

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.76,
  },
  actionTile: {
    backgroundColor: palette.panel,
    borderColor: "rgba(232,216,173,0.84)",
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 142,
    padding: 14,
    width: "48.5%",
  },
  actionIconBadge: {
    alignItems: "center",
    backgroundColor: "#15120b",
    borderRadius: 15,
    height: 42,
    justifyContent: "center",
    marginBottom: 14,
    width: 42,
  },
  actionIcon: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  actionTitle: {
    color: "#15120b",
    flex: 1,
    fontSize: 16,
    fontWeight: "900",
  },
  actionTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  actionBadge: {
    backgroundColor: "#15120b",
    borderRadius: 999,
    color: palette.amber,
    fontSize: 9,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 4,
    textTransform: "uppercase",
  },
  actionText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 6,
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
});
