import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Bell, Edit3, ListChecks, Trash2 } from "lucide-react-native";

import { AppHeader, AppShell } from "../components/AppLayout";
import { PhotoSourceTile, RecordActionButton } from "../components/ActionTiles";
import {
  formatShortDate,
  getRecordInitials,
  getReminderCustomerSuggestions,
} from "../utils/customerRecords";
import { palette } from "../theme";

const reminderTypes = ["Fitting", "Pickup", "Delivery", "Follow-up", "Other"];

function formatReminderDateTime(reminder) {
  if (!reminder?.dueAt) {
    return "No due date";
  }

  const dueDate = new Date(reminder.dueAt);
  if (Number.isNaN(dueDate.getTime())) {
    return "No due date";
  }

  return dueDate.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function RemindersHomeScreen({
  isLightMode,
  onBack,
  onNavigate,
  onOpenForm,
  onOpenList,
  reminders,
  status,
}) {
  return (
    <AppShell isLightMode={isLightMode} active="home" onNavigate={onNavigate}>
      <AppHeader
        isLightMode={isLightMode}
        title="Reminders"
        subtitle="Save follow-ups, fittings, pickup dates, and client tasks."
        onBack={onBack}
      />

      <ScrollView contentContainerStyle={styles.reviewContent}>
        {status ? <Text style={styles.noticeText}>{status}</Text> : null}
        <View style={styles.photoSourceStack}>
          <PhotoSourceTile
            icon={Bell}
            title="Save reminder"
            text="Add fitting, pickup, or follow-up work."
            onPress={onOpenForm}
            tone="amber"
            primary
          />
          <PhotoSourceTile
            icon={ListChecks}
            title="View reminders"
            text={`${reminders.length} active reminder${reminders.length === 1 ? "" : "s"}.`}
            onPress={onOpenList}
            tone="rose"
          />
        </View>
      </ScrollView>
    </AppShell>
  );
}

export function ReminderFormScreen({
  editingReminderId,
  isLightMode,
  isPositiveStatus,
  onBack,
  onNavigate,
  onSaveReminder,
  recordsLoading,
  reminderForm,
  savedRecords,
  saving,
  setReminderForm,
  status,
}) {
  const customerSuggestions = getReminderCustomerSuggestions(savedRecords, reminderForm.customerName);

  return (
    <AppShell isLightMode={isLightMode} active="home" onNavigate={onNavigate}>
      <AppHeader
        isLightMode={isLightMode}
        title={editingReminderId ? "Edit reminder" : "Save reminder"}
        subtitle="Set the client, reason, and exact due time."
        onBack={onBack}
      />

      <ScrollView contentContainerStyle={styles.reviewContent} keyboardShouldPersistTaps="handled">
        <View style={styles.detailsPanel}>
          <Text style={styles.detailsTitle}>Reminder details</Text>
          <Text style={styles.detailsText}>Your phone will alert you at the selected date and time.</Text>
          <TextInput
            value={reminderForm.customerName}
            onChangeText={(customerName) => setReminderForm((currentForm) => ({
              ...currentForm,
              cloudCustomerId: "",
              customerName,
            }))}
            placeholder="Customer name"
            placeholderTextColor="#8c8576"
            style={styles.input}
          />
          {recordsLoading ? <Text style={styles.customerSuggestionHint}>Loading saved customers...</Text> : null}
          {customerSuggestions.length > 0 ? (
            <View style={styles.customerSuggestionList}>
              {customerSuggestions.map((customer) => (
                <Pressable
                  key={customer.id}
                  onPress={() => setReminderForm((currentForm) => ({
                    ...currentForm,
                    cloudCustomerId: customer.cloudCustomerId,
                    customerName: customer.name,
                  }))}
                  style={({ pressed }) => [styles.customerSuggestionItem, pressed && styles.pressed]}
                >
                  <View style={styles.customerSuggestionAvatar}>
                    <Text style={styles.customerSuggestionAvatarText}>{getRecordInitials(customer.name)}</Text>
                  </View>
                  <View style={styles.customerSuggestionBody}>
                    <Text style={styles.customerSuggestionName}>{customer.name}</Text>
                    <Text style={styles.customerSuggestionMeta}>
                      {customer.profile} - Updated {formatShortDate(customer.updatedAt)}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}
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
          onPress={onSaveReminder}
          style={({ pressed }) => [
            styles.primaryButton,
            saving && styles.disabledButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>{saving ? "Saving..." : editingReminderId ? "Update reminder" : "Save reminder"}</Text>
        </Pressable>
        {status ? (
          <Text style={isPositiveStatus(status) ? styles.actionSuccessText : styles.actionErrorText}>{status}</Text>
        ) : null}
      </ScrollView>
    </AppShell>
  );
}

export function ReminderListScreen({
  deleteModal,
  isLightMode,
  onBack,
  onDeleteReminder,
  onEditReminder,
  onNavigate,
  onNewReminder,
  reminders,
  remindersLoading,
  status,
}) {
  const sortedReminders = [...reminders].sort((firstReminder, secondReminder) => (
    new Date(firstReminder.dueAt || 0) - new Date(secondReminder.dueAt || 0)
  ));
  const nextReminder = sortedReminders[0];

  return (
    <AppShell isLightMode={isLightMode} active="home" onNavigate={onNavigate}>
      <AppHeader
        isLightMode={isLightMode}
        title="Saved reminders"
        subtitle="Open, edit, or delete upcoming tailor tasks."
        onBack={onBack}
      />

      <ScrollView contentContainerStyle={styles.reviewContent}>
        {status ? (
          <Text style={status === "Reminder deleted." ? styles.successText : styles.errorText}>{status}</Text>
        ) : null}

        {remindersLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={palette.amber} size="large" />
            <Text style={styles.emptyStateText}>Loading reminders...</Text>
          </View>
        ) : sortedReminders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No reminders yet</Text>
            <Text style={styles.emptyStateText}>Save a reminder when you need to follow up with a client.</Text>
            <Pressable onPress={onNewReminder} style={styles.heroButton}>
              <Text style={styles.heroButtonText}>Save reminder</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.resultHero}>
              <Text style={styles.resultHeroKicker}>Next reminder</Text>
              <Text style={styles.resultHeroTitle}>{nextReminder.title || nextReminder.type}</Text>
              <Text style={styles.resultHeroMeta}>
                {nextReminder.customerName || "No customer linked"} - {formatReminderDateTime(nextReminder)}
              </Text>
            </View>

            {sortedReminders.map((reminder) => (
              <View key={reminder.id} style={styles.recordCard}>
                <View style={styles.recordAvatar}>
                  <Text style={styles.recordAvatarText}>{reminder.type?.slice(0, 2).toUpperCase() || "!"}</Text>
                </View>
                <View style={styles.recordBody}>
                  <Text style={styles.recordName}>{reminder.title || reminder.type}</Text>
                  <View style={styles.recordChipRow}>
                    <Text style={styles.recordChip}>{reminder.type}</Text>
                    <Text style={styles.recordChip}>{reminder.customerName || "No customer"}</Text>
                  </View>
                  <Text style={styles.recordDate}>{formatReminderDateTime(reminder)}</Text>
                  {reminder.note ? <Text style={styles.reminderNote}>{reminder.note}</Text> : null}
                </View>
                <View style={styles.recordActionStack}>
                  <RecordActionButton
                    onPress={() => onEditReminder(reminder)}
                    label="Edit"
                    Icon={Edit3}
                  />
                  <RecordActionButton
                    onPress={() => onDeleteReminder(reminder)}
                    label="Delete"
                    Icon={Trash2}
                    danger
                  />
                </View>
              </View>
            ))}
          </>
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
  photoSourceStack: {
    gap: 12,
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
  customerSuggestionHint: {
    color: "#6f6759",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 10,
    marginTop: -4,
  },
  customerSuggestionList: {
    backgroundColor: "#fff5dd",
    borderColor: "rgba(255,159,0,0.26)",
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    marginBottom: 12,
    marginTop: -4,
    padding: 8,
  },
  customerSuggestionItem: {
    alignItems: "center",
    backgroundColor: "#fffaf0",
    borderColor: "rgba(232,216,173,0.85)",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 56,
    padding: 10,
  },
  customerSuggestionAvatar: {
    alignItems: "center",
    backgroundColor: "#15120b",
    borderRadius: 999,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  customerSuggestionAvatarText: {
    color: palette.amber,
    fontSize: 12,
    fontWeight: "900",
  },
  customerSuggestionBody: {
    flex: 1,
  },
  customerSuggestionName: {
    color: "#15120b",
    fontSize: 14,
    fontWeight: "900",
  },
  customerSuggestionMeta: {
    color: "#6f6759",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
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
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 12,
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
  pressed: {
    opacity: 0.78,
  },
  actionErrorText: {
    backgroundColor: "#fee2e2",
    borderColor: "#fecaca",
    borderRadius: 10,
    borderWidth: 1,
    color: "#991b1b",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
    marginTop: 10,
    padding: 12,
  },
  actionSuccessText: {
    backgroundColor: "#dcfce7",
    borderColor: "#bbf7d0",
    borderRadius: 10,
    borderWidth: 1,
    color: "#166534",
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 19,
    marginTop: 10,
    padding: 12,
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
  resultHero: {
    backgroundColor: "#fff5d5",
    borderColor: "#ffd37a",
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 14,
    padding: 16,
  },
  resultHeroKicker: {
    color: palette.amberDark,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  resultHeroTitle: {
    color: "#15120b",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 30,
    marginTop: 8,
  },
  resultHeroMeta: {
    color: "#5f4c2a",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 7,
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
  reminderNote: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 8,
  },
  recordActionStack: {
    alignItems: "flex-end",
    gap: 8,
    minWidth: 92,
  },
});
