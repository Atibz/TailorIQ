import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ChevronRight, Trash2 } from "lucide-react-native";

import { AppHeader, AppShell } from "../components/AppLayout";
import { PlanUsageMeter } from "../components/PlanUsageMeter";
import { RecordActionButton } from "../components/ActionTiles";
import { formatShortDate, hasPhotoReference } from "../utils/customerRecords";
import { palette } from "../theme";

export function DraftsScreen({
  deleteModal,
  draftsLoading,
  isLightMode,
  measurementDrafts,
  onContinueDraft,
  onDeleteDraft,
  onNavigate,
  onNewMeasurement,
  onBack,
  plan,
  profile,
  status,
}) {
  return (
    <AppShell isLightMode={isLightMode} active="home" onNavigate={onNavigate}>
      <AppHeader
        isLightMode={isLightMode}
        title="Unfinished measurements"
        subtitle="Continue drafts that have not been saved as final records."
        onBack={onBack}
      />

      <ScrollView contentContainerStyle={styles.reviewContent}>
        {status ? (
          <Text style={status === "Draft deleted." ? styles.successText : styles.errorText}>{status}</Text>
        ) : null}
        <PlanUsageMeter
          count={measurementDrafts.length}
          isLightMode={isLightMode}
          label="Drafts"
          limit={plan?.draftLimit}
        />

        {draftsLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={palette.amber} size="large" />
            <Text style={styles.emptyStateText}>Loading drafts...</Text>
          </View>
        ) : measurementDrafts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No drafts right now</Text>
            <Text style={styles.emptyStateText}>Start a measurement and unfinished work will appear here.</Text>
            <Pressable onPress={onNewMeasurement} style={styles.heroButton}>
              <Text style={styles.heroButtonText}>New measurement</Text>
            </Pressable>
          </View>
        ) : (
          measurementDrafts.map((draft, draftIndex) => {
            const photoCount = [draft.capturedPhotos?.front, draft.capturedPhotos?.side]
              .filter(hasPhotoReference).length;
            const draftName = draft.measurementDetails?.customerName || (
              profile?.mode === "client" ? "My measurement" : "Untitled measurement"
            );

            return (
              <View key={`${draft.id || "draft"}-${draft.cloudDraftId || draft.updatedAt || draftIndex}`} style={styles.recordCard}>
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
                    onPress={() => onContinueDraft(draft)}
                    label="Continue"
                    Icon={ChevronRight}
                  />
                  <RecordActionButton
                    onPress={() => onDeleteDraft(draft)}
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
      {deleteModal}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  reviewContent: {
    paddingBottom: 34,
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
  heroButton: {
    alignItems: "center",
    alignSelf: "center",
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
  recordCard: {
    alignItems: "flex-start",
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    marginBottom: 12,
    minHeight: 88,
    padding: 14,
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
  recordAvatarText: {
    color: palette.amber,
    fontSize: 13,
    fontWeight: "900",
  },
  recordBody: {
    flex: 1,
    minWidth: 0,
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
  recordActionStack: {
    alignItems: "flex-end",
    gap: 8,
    minWidth: 92,
  },
});
