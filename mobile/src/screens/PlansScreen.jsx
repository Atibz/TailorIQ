import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Plus } from "lucide-react-native";

import { AppHeader, AppShell } from "../components/AppLayout";
import { palette } from "../theme";

export const billingOptions = [
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

export function PlansScreen({
  isLightMode,
  onBack,
  onNavigate,
  onSelectBilling,
  onUpgradePress,
  plan,
  selectedBillingPlan,
  status,
}) {
  const selectedBilling = billingOptions.find((option) => option.id === selectedBillingPlan) || billingOptions[0];

  return (
    <AppShell isLightMode={isLightMode} active="more" onNavigate={onNavigate}>
      <AppHeader
        isLightMode={isLightMode}
        title="Upgrade TailorIQ"
        subtitle="Unlock the shop tools built around your measurement workflow."
        onBack={onBack}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, isLightMode && styles.cardLight]}>
          <View style={styles.badgeRow}>
            <Text style={styles.badge}>Tailor Shop</Text>
            <Text style={[styles.currentBadge, isLightMode && styles.currentBadgeLight]}>
              Current: {plan.label}
            </Text>
          </View>

          <Text style={[styles.price, isLightMode && styles.priceLight]}>{selectedBilling.price}</Text>
          <Text style={[styles.priceNote, isLightMode && styles.priceNoteLight]}>{selectedBilling.note}</Text>

          <Text style={[styles.intro, isLightMode && styles.introLight]}>
            Keep the measuring core free. Upgrade when your shop needs faster follow-up, better organization, and less manual admin work.
          </Text>

          <View style={[styles.billingToggleRow, isLightMode && styles.billingToggleRowLight]}>
            {billingOptions.map((option) => {
              const active = selectedBillingPlan === option.id;

              return (
                <Pressable
                  key={option.id}
                  onPress={() => onSelectBilling(option.id)}
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
                  ]}
                  >
                    {option.title}
                  </Text>
                  {option.badge ? <Text style={styles.billingToggleBadge}>{option.badge}</Text> : null}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.featureList}>
            {planFeatures.map((feature) => (
              <View key={feature} style={styles.featureRow}>
                <Plus color={palette.amber} size={18} strokeWidth={3} />
                <Text style={[styles.featureText, isLightMode && styles.featureTextLight]}>{feature}</Text>
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => onUpgradePress(selectedBilling)}
            style={({ pressed }) => [styles.upgradeButton, pressed && styles.pressed]}
          >
            <Text style={styles.upgradeButtonText}>Get Tailor Shop</Text>
          </Pressable>

          {status ? <Text style={[styles.statusText, isLightMode && styles.statusTextLight]}>{status}</Text> : null}
        </View>

        <Text style={[styles.footerNote, isLightMode && styles.footerNoteLight]}>
          Photo measurement, review, body guide, saved results, and sharing remain part of the free TailorIQ experience.
        </Text>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.76,
  },
  content: {
    paddingBottom: 36,
  },
  card: {
    backgroundColor: "#11100e",
    borderColor: "rgba(255,199,71,0.32)",
    borderRadius: 28,
    borderWidth: 1,
    marginTop: 28,
    padding: 20,
  },
  cardLight: {
    backgroundColor: "#15120b",
    borderColor: "rgba(255,159,0,0.42)",
  },
  badgeRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  badge: {
    backgroundColor: palette.amber,
    borderRadius: 999,
    color: palette.black,
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  currentBadge: {
    borderColor: "rgba(255,199,71,0.4)",
    borderRadius: 999,
    borderWidth: 1,
    color: "#f8efe2",
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  currentBadgeLight: {
    borderColor: "rgba(255,199,71,0.42)",
    color: "#fff5d6",
  },
  price: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "900",
  },
  priceLight: {
    color: "#ffffff",
  },
  priceNote: {
    color: "#d8c9a8",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 5,
  },
  priceNoteLight: {
    color: "#f2d99c",
  },
  intro: {
    color: "#cfc4ae",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 18,
  },
  introLight: {
    color: "#f4e5bd",
  },
  billingToggleRow: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    flexDirection: "row",
    gap: 8,
    marginTop: 22,
    padding: 6,
  },
  billingToggleRowLight: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  billingToggle: {
    alignItems: "center",
    borderRadius: 14,
    flex: 1,
    justifyContent: "center",
    minHeight: 58,
    padding: 8,
  },
  billingToggleActive: {
    backgroundColor: palette.amber,
  },
  billingToggleLight: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  billingToggleText: {
    color: "#cfc4ae",
    fontSize: 13,
    fontWeight: "900",
  },
  billingToggleTextLight: {
    color: "#f4e5bd",
  },
  billingToggleTextActive: {
    color: palette.black,
  },
  billingToggleBadge: {
    color: "#5b3b00",
    fontSize: 10,
    fontWeight: "900",
    marginTop: 3,
  },
  featureList: {
    gap: 14,
    marginTop: 26,
  },
  featureRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
  },
  featureText: {
    color: "#f8efe2",
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 21,
  },
  featureTextLight: {
    color: "#fff6dc",
  },
  upgradeButton: {
    alignItems: "center",
    backgroundColor: palette.amber,
    borderRadius: 16,
    marginTop: 30,
    minHeight: 58,
    justifyContent: "center",
  },
  upgradeButtonText: {
    color: palette.black,
    fontSize: 16,
    fontWeight: "900",
  },
  statusText: {
    color: "#f8efe2",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 14,
    textAlign: "center",
  },
  statusTextLight: {
    color: "#fff6dc",
  },
  footerNote: {
    color: "#d8c9a8",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 16,
    textAlign: "center",
  },
  footerNoteLight: {
    color: "#6f6759",
  },
});
