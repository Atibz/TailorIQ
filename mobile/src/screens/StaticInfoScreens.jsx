import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { AppHeader, AppShell } from "../components/AppLayout";
import { palette } from "../theme";

const helpItems = [
  "For photo measurements, wear fitted clothes, stand straight, and keep your arms slightly away from the body.",
  "Make sure the full body is inside the frame from head to feet before capture or upload.",
  "Enter the real height using the unit that is easiest for you. TailorIQ converts it before analysis.",
  "Review every generated value before saving. Corrected values are the final record.",
  "Use reminders for fitting dates, pickup dates, delivery work, or follow-ups.",
  "If login or saving fails, check your connection and try again. Unsaved work should be reviewed before leaving the page.",
  "Use password reset from the login page if you forget your password. If signup asks for email verification, check inbox and spam.",
];

const privacySections = [
  {
    title: "Your measurements",
    text: "TailorIQ saves approved measurement records to your signed-in account. Drafts, saved records, styles, reminders, and profile details are kept separate by user account.",
  },
  {
    title: "Photos",
    text: "Photos are used to create measurement estimates. To reduce unnecessary storage, saved mobile measurement records keep the approved values rather than storing duplicate original and censored photo files.",
  },
  {
    title: "Sharing",
    text: "Client measurements should only be shared after review. When sharing to another TailorIQ username, the recipient should only receive the result you choose to send.",
  },
  {
    title: "Account access",
    text: "Account access is protected through email, password, and optional provider login. Keep your password private, use password reset when needed, and log out on shared devices.",
  },
  {
    title: "Your responsibility",
    text: "Only save or share another person's measurements with their permission. Always review generated measurements before using them for cutting, sewing, or client delivery.",
  },
];

const aboutParagraphs = [
  "Tailor mode is built for shops that need customer records, drafts, reminders, manual input, style galleries, and reviewed measurements in one place.",
  "Client mode is built for people who want to capture their own measurements, review the result, keep style inspiration, and share approved values with a tailor.",
  "TailorIQ is designed around guided capture and human review. The app can suggest measurements, but the final saved record should always be checked before it is used for production work.",
];

export function HelpScreen({ isLightMode, onBack, onNavigate }) {
  return (
    <AppShell isLightMode={isLightMode} active="more" onNavigate={onNavigate}>
      <AppHeader
        isLightMode={isLightMode}
        title="Help"
        subtitle="Quick guidance for better measurement captures."
        onBack={onBack}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.panel}>
          <Text style={styles.aboutTitle}>Use TailorIQ with confidence.</Text>
          <Text style={styles.policyText}>
            These notes cover the everyday things that make captures cleaner, records easier to trust, and account recovery smoother.
          </Text>
        </View>
        {helpItems.map((item) => (
          <View key={item} style={styles.helpItem}>
            <Text style={styles.helpBullet}>-</Text>
            <Text style={styles.helpText}>{item}</Text>
          </View>
        ))}
      </ScrollView>
    </AppShell>
  );
}

export function PrivacyScreen({ isLightMode, onBack, onNavigate }) {
  return (
    <AppShell isLightMode={isLightMode} active="more" onNavigate={onNavigate}>
      <AppHeader
        isLightMode={isLightMode}
        title="Privacy policy"
        subtitle="A plain-language summary for this mobile version."
        onBack={onBack}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.panel}>
          {privacySections.map((section) => (
            <React.Fragment key={section.title}>
              <Text style={styles.policyTitle}>{section.title}</Text>
              <Text style={styles.policyText}>{section.text}</Text>
            </React.Fragment>
          ))}
        </View>
      </ScrollView>
    </AppShell>
  );
}

export function AboutScreen({ isLightMode, onBack, onNavigate }) {
  return (
    <AppShell isLightMode={isLightMode} active="more" onNavigate={onNavigate}>
      <AppHeader
        isLightMode={isLightMode}
        title="About TailorIQ"
        subtitle="Measure smart. Fit perfect."
        onBack={onBack}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.panel}>
          <Text style={styles.aboutTitle}>
            TailorIQ helps tailors and clients turn guided photos, manual entries, and style ideas into organized measurement work.
          </Text>
          {aboutParagraphs.map((paragraph) => (
            <Text key={paragraph} style={styles.policyText}>{paragraph}</Text>
          ))}
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 34,
  },
  panel: {
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 14,
    padding: 16,
  },
  helpItem: {
    alignItems: "flex-start",
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
    padding: 14,
  },
  helpBullet: {
    color: palette.amberDark,
    fontSize: 15,
    fontWeight: "900",
  },
  helpText: {
    color: "#15120b",
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
  },
  policyTitle: {
    color: "#15120b",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 10,
  },
  policyText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 7,
  },
  aboutTitle: {
    color: "#15120b",
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 23,
  },
});
