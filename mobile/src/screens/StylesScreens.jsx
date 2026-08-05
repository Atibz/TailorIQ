import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ChevronRight, Image as ImageIcon, Save, Share2, Trash2 } from "lucide-react-native";

import { AppHeader, AppShell } from "../components/AppLayout";
import { PlanUsageMeter } from "../components/PlanUsageMeter";
import { PhotoSourceTile } from "../components/ActionTiles";
import {
  formatShortDate,
  getRecordInitials,
  getStyleCustomerSuggestions,
  mergeStyleCategories,
} from "../utils/customerRecords";
import { palette } from "../theme";

export function StylesHomeScreen({
  isLightMode,
  onBack,
  onNavigate,
  onOpenForm,
  onOpenGallery,
  plan,
  profile,
  status,
  styleLibrary,
}) {
  const modeCopy = profile?.mode === "client"
    ? {
        title: "My style ideas",
        subtitle: "Save outfits you like and keep them ready for tailor conversations.",
        save: "Save an outfit idea",
        gallery: "View saved ideas",
      }
    : {
        title: "Style library",
        subtitle: "Keep client inspiration out of phone-gallery chaos.",
        save: "Save style",
        gallery: "View gallery",
      };

  return (
    <AppShell isLightMode={isLightMode} active="home" onNavigate={onNavigate}>
      <AppHeader isLightMode={isLightMode} title={modeCopy.title} subtitle={modeCopy.subtitle} onBack={onBack} />

      <ScrollView contentContainerStyle={styles.reviewContent}>
        {status ? <Text style={styles.noticeText}>{status}</Text> : null}
        <PlanUsageMeter
          count={styleLibrary.length}
          isLightMode={isLightMode}
          label="Saved styles"
          limit={plan?.styleLimit}
        />
        <View style={styles.photoSourceStack}>
          <PhotoSourceTile
            icon={Save}
            title={modeCopy.save}
            text="Choose an image, add details if needed, then save."
            onPress={onOpenForm}
            tone="amber"
            primary
          />
          <PhotoSourceTile
            icon={ImageIcon}
            title={modeCopy.gallery}
            text={`${styleLibrary.length} saved style${styleLibrary.length === 1 ? "" : "s"}.`}
            onPress={onOpenGallery}
            tone="teal"
          />
        </View>
      </ScrollView>
    </AppShell>
  );
}

export function StyleFormScreen({
  customStyleCategories,
  isLightMode,
  isPositiveStatus,
  newStyleCategory,
  onBack,
  onNavigate,
  onPickStyleImage,
  onSaveCategory,
  onSaveStyle,
  profile,
  saving,
  setNewStyleCategory,
  setStyleForm,
  status,
  styleForm,
}) {
  const availableStyleCategories = mergeStyleCategories(customStyleCategories);

  return (
    <AppShell isLightMode={isLightMode} active="home" onNavigate={onNavigate}>
      <AppHeader
        isLightMode={isLightMode}
        title={profile?.mode === "client" ? "Save style idea" : "Save style"}
        subtitle="The style name is optional. The image is what matters most."
        onBack={onBack}
      />

      <ScrollView contentContainerStyle={styles.reviewContent} keyboardShouldPersistTaps="handled">
        <Pressable onPress={onPickStyleImage} style={({ pressed }) => [styles.stylePicker, pressed && styles.pressed]}>
          {styleForm.image?.uri ? (
            <Image source={{ uri: styleForm.image.uri }} style={styles.stylePickerImage} resizeMode="cover" />
          ) : (
            <Text style={styles.stylePickerText}>Choose image</Text>
          )}
        </Pressable>

        <View style={styles.detailsPanel}>
          <Text style={styles.detailsTitle}>Style details</Text>
          <TextInput
            value={styleForm.title}
            onChangeText={(title) => setStyleForm((currentForm) => ({ ...currentForm, title }))}
            placeholder="Style name optional"
            placeholderTextColor="#8c8576"
            style={styles.input}
          />
          {profile?.mode === "tailor" ? (
            <View style={styles.inlineCategoryCreator}>
              <TextInput
                value={newStyleCategory}
                onChangeText={setNewStyleCategory}
                placeholder="Create category, e.g. Senator wear"
                placeholderTextColor="#8c8576"
                style={[styles.input, styles.categoryInput]}
              />
              <Pressable
                disabled={saving}
                onPress={onSaveCategory}
                style={({ pressed }) => [styles.categoryAddButton, saving && styles.disabledButton, pressed && styles.pressed]}
              >
                <Text style={styles.categoryAddButtonText}>Add</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.reminderTypeGrid}>
            {availableStyleCategories.map((category) => (
              <Pressable
                key={category}
                onPress={() => setStyleForm((currentForm) => ({ ...currentForm, category }))}
                style={[
                  styles.reminderTypeOption,
                  styleForm.category === category && styles.reminderTypeOptionActive,
                ]}
              >
                <Text style={[
                  styles.reminderTypeText,
                  styleForm.category === category && styles.reminderTypeTextActive,
                ]}
                >
                  {category}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={styleForm.notes}
            onChangeText={(notes) => setStyleForm((currentForm) => ({ ...currentForm, notes }))}
            placeholder={profile?.mode === "client"
              ? "Occasion, fabric, fit preference, or what you like about it."
              : "Fabric, neckline, sleeve, body type, or fitting notes."}
            placeholderTextColor="#8c8576"
            multiline
            style={[styles.input, styles.noteInput]}
          />
        </View>

        <Pressable
          disabled={saving}
          onPress={onSaveStyle}
          style={({ pressed }) => [styles.primaryButton, saving && styles.disabledButton, pressed && styles.pressed]}
        >
          <Text style={styles.primaryButtonText}>{saving ? "Saving..." : "Save style"}</Text>
        </Pressable>
        {status ? (
          <Text style={isPositiveStatus(status) ? styles.actionSuccessText : styles.actionErrorText}>{status}</Text>
        ) : null}
      </ScrollView>
    </AppShell>
  );
}

export function StyleGalleryScreen({
  customStyleCategories,
  isLightMode,
  onBack,
  onDeleteStyle,
  onNavigate,
  onOpenStyle,
  onOpenStyleForm,
  onShareCategory,
  profile,
  setStyleCategoryFilter,
  setStyleSearch,
  setStyleViewMode,
  status,
  styleCategoryFilter,
  styleLibrary,
  styleSearch,
  stylesLoading,
  styleViewMode,
}) {
  const searchableTerm = styleSearch.trim().toLowerCase();
  const availableStyleCategories = mergeStyleCategories(customStyleCategories);
  const styleCategoryCounts = styleLibrary.reduce((counts, style) => ({
    ...counts,
    [style.category]: (counts[style.category] || 0) + 1,
  }), {});
  const filteredStyles = styleLibrary
    .filter((style) => styleCategoryFilter === "all" || style.category === styleCategoryFilter)
    .filter((style) => `${style.title} ${style.category} ${style.notes}`.toLowerCase().includes(searchableTerm));

  return (
    <AppShell isLightMode={isLightMode} active="home" onNavigate={onNavigate}>
      <AppHeader
        isLightMode={isLightMode}
        title={profile?.mode === "client" ? "Saved ideas" : "Style gallery"}
        subtitle="Browse saved style images in grid or list view."
        onBack={onBack}
      />

      <ScrollView contentContainerStyle={styles.reviewContent}>
        {status ? <Text style={status === "Style deleted." ? styles.successText : styles.errorText}>{status}</Text> : null}

        <View style={styles.galleryToolbar}>
          <TextInput
            value={styleSearch}
            onChangeText={setStyleSearch}
            placeholder="Search styles"
            placeholderTextColor="#8c8576"
            style={[styles.input, styles.gallerySearch]}
          />
          <View style={styles.galleryModeRow}>
            <Pressable
              onPress={() => setStyleViewMode("grid")}
              style={[styles.galleryModeButton, styleViewMode === "grid" && styles.galleryModeButtonActive]}
            >
              <Text style={[styles.galleryModeText, styleViewMode === "grid" && styles.galleryModeTextActive]}>Grid</Text>
            </Pressable>
            <Pressable
              onPress={() => setStyleViewMode("list")}
              style={[styles.galleryModeButton, styleViewMode === "list" && styles.galleryModeButtonActive]}
            >
              <Text style={[styles.galleryModeText, styleViewMode === "list" && styles.galleryModeTextActive]}>List</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroller}>
          {["all", ...availableStyleCategories].map((category) => (
            <Pressable
              key={category}
              onPress={() => setStyleCategoryFilter(category)}
              style={[styles.categoryChip, styleCategoryFilter === category && styles.categoryChipActive]}
            >
              <Text style={[
                styles.categoryChipText,
                styleCategoryFilter === category && styles.categoryChipTextActive,
              ]}
              >
                {category === "all" ? `All ${styleLibrary.length}` : `${category} ${styleCategoryCounts[category] || 0}`}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {profile?.mode === "tailor" && styleCategoryFilter !== "all" ? (
          <Pressable
            onPress={() => onShareCategory(styleCategoryFilter)}
            style={({ pressed }) => [styles.shareCategoryButton, pressed && styles.pressed]}
          >
            <Share2 color="#15120b" size={16} strokeWidth={2.8} />
            <Text style={styles.shareCategoryButtonText}>Share {styleCategoryFilter}</Text>
          </Pressable>
        ) : null}

        {stylesLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={palette.amber} size="large" />
            <Text style={styles.emptyStateText}>Loading styles...</Text>
          </View>
        ) : filteredStyles.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No styles found</Text>
            <Text style={styles.emptyStateText}>Save a style image to start building your gallery.</Text>
            <Pressable onPress={onOpenStyleForm} style={styles.heroButton}>
              <Text style={styles.heroButtonText}>Save style</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styleViewMode === "grid" ? styles.styleGrid : styles.styleList}>
            {filteredStyles.map((style) => (
              <Pressable
                key={style.id}
                onPress={() => onOpenStyle(style)}
                style={({ pressed }) => [
                  styleViewMode === "grid" ? styles.styleGridItem : styles.styleListItem,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styleViewMode === "grid" ? styles.styleThumbFrame : styles.styleListThumbFrame}>
                  <Image source={{ uri: style.imageUrl }} style={styles.styleThumb} resizeMode="cover" />
                </View>
                <View style={styleViewMode === "grid" ? styles.styleGridText : styles.styleListText}>
                  <Text style={styles.styleTitle} numberOfLines={1}>{style.title || style.category}</Text>
                  <View style={styles.styleMetaRow}>
                    <Text style={styles.styleCategoryPill}>{style.category}</Text>
                    <Text style={styles.styleDateText}>
                      {style.updatedAt ? new Date(style.updatedAt).toLocaleDateString() : "Saved"}
                    </Text>
                  </View>
                  {style.notes ? <Text style={styles.styleNotePreview} numberOfLines={2}>{style.notes}</Text> : null}
                </View>
                <Pressable
                  onPress={() => onDeleteStyle(style)}
                  style={({ pressed }) => [styles.styleDeleteQuickButton, pressed && styles.recordDeleteButtonPressed]}
                >
                  <Trash2 color="#C83434" size={14} strokeWidth={2.7} />
                  <Text style={styles.styleDeleteQuickText}>Delete</Text>
                </Pressable>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </AppShell>
  );
}

export function StyleDetailScreen({
  deleteModal,
  isLightMode,
  onAttachCustomer,
  onBack,
  onDeleteStyle,
  onDetachCustomer,
  onOpenStyleAttachmentUpgrade,
  onNavigate,
  profile,
  savedRecords,
  saving,
  selectedStyle,
  setStyleAttachSearch,
  status,
  styleAttachmentsLocked = false,
  styleAttachSearch,
}) {
  const attachedCustomers = selectedStyle.attachedCustomers || [];
  const customerSuggestions = getStyleCustomerSuggestions(savedRecords, styleAttachSearch, attachedCustomers);

  return (
    <AppShell isLightMode={isLightMode} active="home" onNavigate={onNavigate}>
      <AppHeader
        isLightMode={isLightMode}
        title={selectedStyle?.title || selectedStyle?.category || "Style"}
        subtitle={selectedStyle?.category || "Saved style"}
        onBack={onBack}
      />

      <ScrollView contentContainerStyle={styles.reviewContent}>
        {selectedStyle?.imageUrl ? (
          <Image source={{ uri: selectedStyle.imageUrl }} style={styles.styleDetailImage} resizeMode="cover" />
        ) : null}
        <View style={styles.infoPanel}>
          <Text style={styles.policyTitle}>{selectedStyle?.title || selectedStyle?.category || "Saved style"}</Text>
          {selectedStyle?.notes ? <Text style={styles.policyText}>{selectedStyle.notes}</Text> : null}
          <Text style={styles.recordDate}>
            {selectedStyle?.updatedAt ? new Date(selectedStyle.updatedAt).toLocaleDateString() : "Saved"}
          </Text>
        </View>
        {profile?.mode === "tailor" ? (
          <View style={styles.infoPanel}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.policyTitle}>Attached customers</Text>
              {styleAttachmentsLocked ? <Text style={styles.proBadge}>Pro</Text> : null}
            </View>
            {attachedCustomers.length === 0 ? (
              <Text style={styles.policyText}>
                {styleAttachmentsLocked
                  ? "Upgrade to connect this style directly to a saved customer."
                  : "No customer attached yet. Search a saved customer below."}
              </Text>
            ) : (
              attachedCustomers.map((attachment) => (
                <View key={attachment.id || attachment.cloudCustomerId} style={styles.attachmentRow}>
                  <View style={styles.recordAvatarSmall}>
                    <Text style={styles.recordAvatarText}>{getRecordInitials(attachment.customerName)}</Text>
                  </View>
                  <View style={styles.recordBody}>
                    <Text style={styles.recordName}>{attachment.customerName}</Text>
                    <Text style={styles.recordDate}>Attached style</Text>
                  </View>
                  <Pressable
                    disabled={saving}
                    onPress={() => onDetachCustomer(attachment)}
                    style={({ pressed }) => [styles.recordDeleteButton, pressed && styles.recordDeleteButtonPressed]}
                  >
                    <Trash2 color="#C83434" size={15} strokeWidth={2.7} />
                    <Text style={styles.recordDeleteText}>Remove</Text>
                  </Pressable>
                </View>
              ))
            )}

            {styleAttachmentsLocked ? (
              <Pressable
                onPress={onOpenStyleAttachmentUpgrade}
                style={({ pressed }) => [styles.proActionButton, pressed && styles.pressed]}
              >
                <Text style={styles.proActionButtonText}>Attach customer</Text>
              </Pressable>
            ) : (
              <>
                <TextInput
                  value={styleAttachSearch}
                  onChangeText={setStyleAttachSearch}
                  placeholder="Search customer to attach"
                  placeholderTextColor="#8c8576"
                  style={styles.input}
                />
                {styleAttachSearch.trim() && customerSuggestions.length === 0 ? (
                  <Text style={styles.policyText}>No matching unattached customer found.</Text>
                ) : null}
                {customerSuggestions.length > 0 ? (
                  customerSuggestions.map((customer) => (
                    <Pressable
                      key={customer.id}
                      disabled={saving}
                      onPress={() => onAttachCustomer(customer)}
                      style={({ pressed }) => [styles.customerSuggestionButton, pressed && styles.pressed]}
                    >
                      <View>
                        <Text style={styles.recordName}>{customer.name}</Text>
                        <Text style={styles.recordDate}>{customer.profile} - {formatShortDate(customer.updatedAt)}</Text>
                      </View>
                      <ChevronRight color={palette.amberDark} size={21} strokeWidth={2.8} />
                    </Pressable>
                  ))
                ) : null}
              </>
            )}
            {status ? <Text style={styles.actionSuccessText}>{status}</Text> : null}
          </View>
        ) : null}
        <Pressable onPress={() => onDeleteStyle(selectedStyle)} style={({ pressed }) => [styles.deleteWideButton, pressed && styles.recordDeleteButtonPressed]}>
          <Trash2 color="#C83434" size={15} strokeWidth={2.7} />
          <Text style={styles.recordDeleteText}>Delete style</Text>
        </Pressable>
      </ScrollView>
      {deleteModal}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  reviewContent: { paddingBottom: 34 },
  photoSourceStack: { gap: 12 },
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
  detailsTitle: { color: "#15120b", fontSize: 17, fontWeight: "900" },
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
  inlineCategoryCreator: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  categoryInput: { flex: 1, marginBottom: 0 },
  categoryAddButton: {
    alignItems: "center",
    backgroundColor: palette.black,
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 52,
    minWidth: 72,
    paddingHorizontal: 14,
  },
  categoryAddButtonText: { color: palette.amber, fontSize: 13, fontWeight: "900" },
  reminderTypeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  reminderTypeOption: {
    alignItems: "center",
    backgroundColor: "#efe5c8",
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 12,
  },
  reminderTypeOptionActive: { backgroundColor: "#15120b" },
  reminderTypeText: { color: "#5f584c", fontSize: 12, fontWeight: "900" },
  reminderTypeTextActive: { color: "#ffffff" },
  noteInput: { minHeight: 92, paddingTop: 12, textAlignVertical: "top" },
  stylePicker: {
    alignItems: "center",
    backgroundColor: "#15120b",
    borderColor: palette.line,
    borderRadius: 22,
    borderWidth: 1,
    height: 360,
    justifyContent: "center",
    marginBottom: 16,
    overflow: "hidden",
  },
  stylePickerImage: { height: "100%", width: "100%" },
  stylePickerText: { color: palette.amber, fontSize: 16, fontWeight: "900" },
  primaryButton: {
    alignItems: "center",
    backgroundColor: palette.amber,
    borderRadius: 12,
    justifyContent: "center",
    marginTop: 4,
    minHeight: 52,
  },
  primaryButtonText: { color: "#141006", fontSize: 15, fontWeight: "900" },
  disabledButton: { opacity: 0.45 },
  pressed: { opacity: 0.78 },
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
  emptyStateTitle: { color: "#15120b", fontSize: 20, fontWeight: "900", textAlign: "center" },
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
  heroButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
  galleryToolbar: { gap: 10, marginBottom: 12 },
  gallerySearch: { marginBottom: 0 },
  galleryModeRow: {
    alignSelf: "flex-start",
    backgroundColor: "#efe5c8",
    borderRadius: 12,
    flexDirection: "row",
    padding: 4,
  },
  galleryModeButton: {
    alignItems: "center",
    borderRadius: 9,
    justifyContent: "center",
    minHeight: 36,
    minWidth: 74,
    paddingHorizontal: 10,
  },
  galleryModeButtonActive: { backgroundColor: "#15120b" },
  galleryModeText: { color: "#5f584c", fontSize: 12, fontWeight: "900" },
  galleryModeTextActive: { color: "#ffffff" },
  categoryScroller: { gap: 8, paddingBottom: 12 },
  shareCategoryButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: palette.amber,
    borderRadius: 13,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    marginBottom: 12,
    minHeight: 42,
    paddingHorizontal: 14,
  },
  shareCategoryButtonText: {
    color: "#15120b",
    fontSize: 13,
    fontWeight: "900",
  },
  categoryChip: {
    alignItems: "center",
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 12,
  },
  categoryChipActive: { backgroundColor: palette.black, borderColor: palette.black },
  categoryChipText: { color: palette.muted, fontSize: 12, fontWeight: "900" },
  categoryChipTextActive: { color: "#ffffff" },
  styleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  styleList: { gap: 12 },
  styleGridItem: {
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    padding: 8,
    width: "31%",
  },
  styleListItem: {
    alignItems: "center",
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 106,
    padding: 12,
  },
  styleThumbFrame: {
    aspectRatio: 0.78,
    backgroundColor: "#15120b",
    borderRadius: 16,
    overflow: "hidden",
    width: "100%",
  },
  styleListThumbFrame: {
    backgroundColor: "#15120b",
    borderRadius: 16,
    height: 82,
    overflow: "hidden",
    width: 66,
  },
  styleThumb: { height: "100%", width: "100%" },
  styleGridText: { paddingHorizontal: 2, paddingTop: 9 },
  styleListText: { flex: 1, minWidth: 0 },
  styleDeleteQuickButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: "#C83434",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    minHeight: 30,
    paddingHorizontal: 10,
  },
  styleDeleteQuickText: { color: "#C83434", fontSize: 11, fontWeight: "900" },
  styleTitle: { color: "#15120b", fontSize: 13, fontWeight: "900" },
  styleMetaRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 7 },
  styleCategoryPill: {
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
  styleDateText: { color: palette.muted, fontSize: 10, fontWeight: "800" },
  styleNotePreview: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 7,
  },
  styleDetailImage: {
    backgroundColor: "#15120b",
    borderRadius: 22,
    height: 520,
    marginBottom: 16,
    width: "100%",
  },
  infoPanel: {
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 16,
    padding: 18,
  },
  policyTitle: { color: "#15120b", fontSize: 17, fontWeight: "900", marginTop: 12 },
  sectionTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  proBadge: {
    backgroundColor: "#15120b",
    borderRadius: 999,
    color: palette.amber,
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    textTransform: "uppercase",
  },
  proActionButton: {
    alignItems: "center",
    backgroundColor: "#fff3cf",
    borderColor: "rgba(255,159,0,0.34)",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  proActionButtonText: {
    color: "#15120b",
    fontSize: 14,
    fontWeight: "900",
  },
  policyText: { color: palette.muted, fontSize: 14, fontWeight: "700", lineHeight: 22, marginTop: 8 },
  recordDate: { color: palette.amberDark, fontSize: 11, fontWeight: "900", marginTop: 8 },
  attachmentRow: {
    alignItems: "center",
    backgroundColor: "#fffaf0",
    borderColor: palette.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
    padding: 10,
  },
  recordAvatarSmall: {
    alignItems: "center",
    backgroundColor: palette.black,
    borderColor: "rgba(255,159,0,0.32)",
    borderRadius: 14,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  recordAvatarText: { color: palette.amber, fontSize: 13, fontWeight: "900" },
  recordBody: { flex: 1, minWidth: 0 },
  recordName: { color: "#15120b", fontSize: 16, fontWeight: "900" },
  recordDeleteButton: {
    alignItems: "center",
    borderColor: "#C83434",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 12,
  },
  recordDeleteButtonPressed: { backgroundColor: "#fee2e2" },
  recordDeleteText: { color: "#C83434", fontSize: 13, fontWeight: "900" },
  customerSuggestionButton: {
    alignItems: "center",
    backgroundColor: "#fffaf0",
    borderColor: palette.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    minHeight: 62,
    padding: 12,
  },
  deleteWideButton: {
    alignItems: "center",
    alignSelf: "center",
    borderColor: "#C83434",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    marginTop: 18,
    minHeight: 46,
    paddingHorizontal: 18,
  },
});
