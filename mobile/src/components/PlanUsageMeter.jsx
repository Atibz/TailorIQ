import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { palette } from "../theme";

export function PlanUsageMeter({ count = 0, isLightMode, label, limit }) {
  if (!Number.isFinite(limit)) {
    return null;
  }

  const safeLimit = Math.max(1, limit);
  const ratio = Math.min(count / safeLimit, 1);
  const remaining = Math.max(safeLimit - count, 0);

  return (
    <View style={[styles.card, !isLightMode && styles.cardDark]}>
      <View style={styles.row}>
        <Text style={[styles.label, !isLightMode && styles.labelDark]}>{label}</Text>
        <Text style={[styles.count, !isLightMode && styles.countDark]}>{count}/{safeLimit}</Text>
      </View>
      <View style={[styles.track, !isLightMode && styles.trackDark]}>
        <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
      </View>
      <Text style={[styles.note, !isLightMode && styles.noteDark]}>
        {remaining > 0
          ? `${remaining} free ${label.toLowerCase()} ${remaining === 1 ? "slot" : "slots"} left.`
          : `Free ${label.toLowerCase()} limit reached. Upgrade for unlimited saves.`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFF5D5",
    borderColor: "#FFD37A",
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  cardDark: {
    backgroundColor: "#17130d",
    borderColor: "rgba(255,159,0,0.32)",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: {
    color: "#5F3700",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  labelDark: {
    color: "#FFD37A",
  },
  count: {
    color: "#15120b",
    fontSize: 13,
    fontWeight: "900",
  },
  countDark: {
    color: "#FFF7E3",
  },
  track: {
    backgroundColor: "rgba(95,55,0,0.16)",
    borderRadius: 999,
    height: 8,
    marginTop: 11,
    overflow: "hidden",
  },
  trackDark: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  fill: {
    backgroundColor: palette.amber,
    borderRadius: 999,
    height: "100%",
  },
  note: {
    color: "#6B4B05",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
    marginTop: 8,
  },
  noteDark: {
    color: "#D8C9A8",
  },
});
