import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { palette } from "../theme";

export function ConfirmationModal({
  cancelLabel = "Cancel",
  children,
  confirmDisabled = false,
  confirmLabel = "Continue",
  confirmTone = "primary",
  message,
  onCancel,
  onConfirm,
  saving = false,
  title,
  visible,
}) {
  const isDanger = confirmTone === "danger";

  return (
    <Modal visible={Boolean(visible)} animationType="fade" transparent onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.confirmPanel}>
          <Text style={styles.confirmTitle}>{title}</Text>
          {message ? <Text style={styles.confirmText}>{message}</Text> : null}
          {children}
          <View style={styles.confirmActions}>
            <Pressable
              disabled={saving}
              onPress={onCancel}
              style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
            >
              <Text style={styles.cancelButtonText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              disabled={saving || confirmDisabled}
              onPress={onConfirm}
              style={({ pressed }) => [
                isDanger ? styles.deleteButton : styles.primaryModalButton,
                (saving || confirmDisabled) && styles.disabledButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={isDanger ? styles.deleteButtonText : styles.primaryModalButtonText}>
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.58)",
    flex: 1,
    justifyContent: "center",
    padding: 22,
  },
  confirmPanel: {
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderRadius: 22,
    borderWidth: 1,
    maxWidth: 420,
    padding: 20,
    width: "100%",
  },
  confirmTitle: {
    color: "#15120b",
    fontSize: 20,
    fontWeight: "900",
  },
  confirmText: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 8,
  },
  confirmActions: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end",
    marginTop: 18,
  },
  cancelButton: {
    alignItems: "center",
    borderColor: palette.line,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 18,
  },
  cancelButtonText: {
    color: "#3d382e",
    fontSize: 14,
    fontWeight: "900",
  },
  primaryModalButton: {
    alignItems: "center",
    backgroundColor: palette.amber,
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 18,
  },
  primaryModalButtonText: {
    color: "#15120b",
    fontSize: 14,
    fontWeight: "900",
  },
  deleteButton: {
    alignItems: "center",
    backgroundColor: "#C83434",
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 18,
  },
  deleteButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.76,
  },
});
