import { measurementValueMap } from "../constants/measurementFields";
import { getSupabaseConfigError, supabase } from "./supabaseClient";

function mapMeasurementRow(row) {
  const storedRecord = row.values?.record || {};
  const measurements = row.values?.measurements || storedRecord.measurements || [];
  const generatedMeasurements = row.generated_values?.measurements || storedRecord.generatedMeasurements || [];

  return {
    ...storedRecord,
    id: storedRecord.id || `measurement-${row.id}`,
    cloudMeasurementId: row.id,
    cloudCustomerId: row.customer_id || storedRecord.cloudCustomerId,
    fullname: storedRecord.fullname || row.values?.customerName || "My measurement",
    measurementProfile: storedRecord.measurementProfile || row.measurement_profile || "male",
    measurements,
    generatedMeasurements,
    segmentationWarnings: row.photo_check_notes || storedRecord.segmentationWarnings || [],
    measurementSource: storedRecord.measurementSource || row.source || "mobile-photo",
    photoStoragePolicy: storedRecord.photoStoragePolicy || "values-only",
    appMode: row.mode,
    createdAt: storedRecord.createdAt || row.created_at,
    updatedAt: row.updated_at || storedRecord.updatedAt,
  };
}

function summarizePhotoForCloud(photo, view) {
  if (!photo?.uri && !photo?.hasPhoto) {
    return null;
  }

  return {
    view,
    hasPhoto: true,
    width: photo.width || null,
    height: photo.height || null,
    fileName: photo.fileName || `${view} photo`,
    checkedAt: photo.captureValidation?.checkedAt || photo.photoCheck?.checkedAt || null,
  };
}

function summarizePhotosForCloud(capturedPhotos = {}) {
  return {
    front: summarizePhotoForCloud(capturedPhotos.front, "front"),
    side: summarizePhotoForCloud(capturedPhotos.side, "side"),
  };
}

function sanitizeDraftForCloud(draft) {
  const photoSummary = summarizePhotosForCloud(draft.capturedPhotos || {});

  return {
    ...draft,
    capturedPhotos: photoSummary,
    photoStoragePolicy: "photo-files-not-saved",
  };
}

function mapDraftRow(row) {
  const values = row.values || {};
  const mobileDraft = values.mobileDraft || {};
  const photoSummary = mobileDraft.capturedPhotos || values.photoSummary || values.photos || { front: null, side: null };

  return {
    ...mobileDraft,
    id: values.localDraftId || mobileDraft.id || `draft-${row.id}`,
    cloudDraftId: row.id,
    mode: row.mode || mobileDraft.mode || "client",
    stage: row.stage || mobileDraft.stage || "capture",
    measurementDetails: mobileDraft.measurementDetails || values.formValues || {
      profile: row.measurement_profile || "female",
      height: "",
      customerName: row.customer_name || "",
    },
    capturedPhotos: photoSummary,
    photoStoragePolicy: mobileDraft.photoStoragePolicy || values.photoStoragePolicy || "photo-files-not-saved",
    measurementResult: mobileDraft.measurementResult || null,
    generatedMeasurements: mobileDraft.generatedMeasurements || [],
    reviewMeasurements: mobileDraft.reviewMeasurements || [],
    createdAt: row.created_at || mobileDraft.createdAt,
    updatedAt: row.updated_at || mobileDraft.updatedAt,
  };
}

function buildRecord({ profile, measurementDetails, measurements, generatedMeasurements, warnings, measurementSource }) {
  const now = new Date().toISOString();
  const source = measurementSource || "mobile-photo";

  return {
    id: `mobile-${Date.now()}`,
    fullname: measurementDetails.customerName?.trim() || "My measurement",
    phone: "",
    email: "",
    height: measurementDetails.height,
    heightUnit: measurementDetails.heightUnit || "cm",
    measurementProfile: profile,
    measurementSource: source,
    measurements,
    generatedMeasurements,
    segmentationWarnings: warnings || [],
    customerNote: "",
    photoStoragePolicy: "values-only",
    createdAt: now,
    updatedAt: now,
  };
}

function buildShareText(record) {
  const measurements = record.measurements || [];
  const lines = measurements
    .filter((measurement) => measurement?.label && measurement?.valueCm !== "")
    .map((measurement) => `${measurement.label}: ${Math.round((Number(measurement.valueCm) / 2.54) * 4) / 4} in`);

  return [
    "TailorIQ measurement summary",
    `Name: ${record.fullname || "My measurement"}`,
    `Profile: ${record.measurementProfile === "female" ? "Female" : "Male"}`,
    "",
    ...lines,
    "",
    "Measure smart. Fit perfect.",
  ].join("\n");
}

function mapSharedMeasurementRow(row, user) {
  const measurementData = row.measurement_data || {};
  const customer = measurementData.customer || {};

  return {
    id: `share-${row.id}`,
    cloudShareId: row.id,
    senderUserId: row.sender_user_id,
    receiverUserId: row.receiver_user_id,
    senderUsername: row.sender_username || "",
    tailorUsername: row.receiver_username || "",
    status: row.status || "sent",
    includePhotos: Boolean(row.include_photos),
    isReceived: row.receiver_user_id === user?.id,
    customer: {
      ...customer,
      id: customer.id || `shared-customer-${row.id}`,
      fullname: customer.fullname || row.customer_name || "Shared measurement",
      measurementProfile: customer.measurementProfile || row.measurement_profile || "male",
      measurements: measurementData.measurements || customer.measurements || [],
      generatedMeasurements: customer.generatedMeasurements || [],
      appMode: "shared",
      createdAt: customer.createdAt || row.created_at,
      updatedAt: row.updated_at || customer.updatedAt,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function saveMobileMeasurement({
  user,
  mode,
  profile,
  measurementDetails,
  measurements,
  generatedMeasurements,
  warnings,
  measurementSource = "mobile-photo",
  existingRecord = null,
}) {
  if (!supabase || !user?.id) {
    return { ok: false, message: getSupabaseConfigError() };
  }

  const now = new Date().toISOString();
  const record = buildRecord({
    profile,
    measurementDetails,
    measurements,
    generatedMeasurements,
    warnings,
    measurementSource,
  });
  const existingCloudMeasurementId = existingRecord?.cloudMeasurementId || null;
  const existingCloudCustomerId = existingRecord?.cloudCustomerId || null;

  if (existingRecord) {
    record.id = existingRecord.id || record.id;
    record.createdAt = existingRecord.createdAt || record.createdAt;
    record.cloudMeasurementId = existingCloudMeasurementId;
    record.cloudCustomerId = existingCloudCustomerId;
  }

  if (mode === "tailor" && !existingCloudCustomerId) {
    if (!record.fullname || record.fullname === "My measurement") {
      return { ok: false, message: "Customer name is required before saving." };
    }

    const { data: customerRow, error: customerError } = await supabase
      .from("customers")
      .insert({
        user_id: user.id,
        fullname: record.fullname,
        phone: null,
        email: null,
        measurement_profile: profile,
        height_cm: Number(measurementDetails.height) || null,
        note: null,
        source: measurementSource,
        updated_at: now,
      })
      .select("*")
      .single();

    if (customerError) {
      return { ok: false, message: customerError.message };
    }

    record.cloudCustomerId = customerRow.id;
  } else if (mode === "tailor" && existingCloudCustomerId) {
    record.cloudCustomerId = existingCloudCustomerId;

    const { error: customerUpdateError } = await supabase
      .from("customers")
      .update({
        fullname: record.fullname,
        measurement_profile: profile,
        height_cm: Number(measurementDetails.height) || null,
        source: measurementSource,
        updated_at: now,
      })
      .eq("id", existingCloudCustomerId)
      .eq("user_id", user.id);

    if (customerUpdateError) {
      return { ok: false, message: customerUpdateError.message };
    }
  }

  const measurementPayload = {
      user_id: user.id,
      customer_id: mode === "tailor" ? record.cloudCustomerId : null,
      mode,
      measurement_profile: profile,
      values: {
        customerName: record.fullname,
        measurements,
        measurementValuesCm: measurementValueMap(measurements),
        record,
      },
      generated_values: {
        measurements: generatedMeasurements,
        measurementValuesCm: measurementValueMap(generatedMeasurements),
      },
      reviewed_values: {
        measurements,
        measurementValuesCm: measurementValueMap(measurements),
        correctionLog: [],
      },
      customer_note: null,
      photo_check_notes: warnings || [],
      photo_paths: {},
      source: measurementSource,
      updated_at: now,
  };

  const measurementQuery = existingCloudMeasurementId
    ? supabase
        .from("measurements")
        .update(measurementPayload)
        .eq("id", existingCloudMeasurementId)
        .eq("user_id", user.id)
        .select("*")
        .single()
    : supabase
        .from("measurements")
        .insert(measurementPayload)
        .select("*")
        .single();

  const { data: measurementRow, error: measurementError } = await measurementQuery;

  if (measurementError) {
    return { ok: false, message: measurementError.message };
  }

  return {
    ok: true,
    record: {
      ...record,
      cloudMeasurementId: measurementRow.id,
    },
  };
}

export async function fetchMobileMeasurements({ user, mode }) {
  if (!supabase || !user?.id) {
    return { ok: false, message: getSupabaseConfigError(), records: [] };
  }

  const { data, error } = await supabase
    .from("measurements")
    .select("*")
    .eq("user_id", user.id)
    .eq("mode", mode)
    .order("updated_at", { ascending: false });

  if (error) {
    return { ok: false, message: error.message, records: [] };
  }

  return {
    ok: true,
    records: (data || []).map(mapMeasurementRow),
  };
}

export async function deleteMobileMeasurement({ user, record }) {
  if (!supabase || !user?.id) {
    return { ok: false, message: getSupabaseConfigError() };
  }

  if (!record?.cloudMeasurementId) {
    return { ok: false, message: "This record is missing its saved measurement ID." };
  }

  const { error: measurementError } = await supabase
    .from("measurements")
    .delete()
    .eq("id", record.cloudMeasurementId)
    .eq("user_id", user.id);

  if (measurementError) {
    return { ok: false, message: measurementError.message };
  }

  if (record.cloudCustomerId) {
    const { error: customerError } = await supabase
      .from("customers")
      .delete()
      .eq("id", record.cloudCustomerId)
      .eq("user_id", user.id);

    if (customerError) {
      return {
        ok: true,
        warning: "Measurement deleted. The linked customer could not be cleaned up automatically.",
      };
    }
  }

  return { ok: true };
}

export async function shareMobileMeasurementToUsername({ user, record, tailorUsername }) {
  if (!supabase || !user?.id) {
    return { ok: false, message: getSupabaseConfigError() };
  }

  const username = tailorUsername.trim().replace(/^@/, "").toLowerCase();

  if (!username) {
    return { ok: false, message: "Enter the tailor username." };
  }

  const { data: receiverProfiles, error: profileError } = await supabase
    .rpc("get_profile_by_username", { login_username: username });

  if (profileError) {
    return { ok: false, message: profileError.message };
  }

  const receiverProfile = Array.isArray(receiverProfiles) ? receiverProfiles[0] : receiverProfiles;

  if (!receiverProfile?.id) {
    return { ok: false, message: `No tailor found with username @${username}.` };
  }

  if (receiverProfile.id === user.id) {
    return { ok: false, message: "You cannot share a measurement to yourself." };
  }

  const cleanRecord = {
    ...record,
    photoPreviews: undefined,
    photoCensoredPreviews: undefined,
    photoViews: undefined,
    photoPaths: undefined,
  };

  const { data, error } = await supabase
    .from("shared_measurements")
    .insert({
      sender_user_id: user.id,
      receiver_user_id: receiverProfile.id,
      receiver_username: username,
      sender_username: user.username || "",
      include_photos: false,
      customer_name: cleanRecord.fullname || "My measurement",
      measurement_profile: cleanRecord.measurementProfile || "male",
      measurement_data: {
        customer: cleanRecord,
        measurements: cleanRecord.measurements || [],
        sharedText: buildShareText(cleanRecord),
      },
      photo_data: {},
      status: "sent",
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true, share: mapSharedMeasurementRow(data, user) };
}

export async function fetchMobileSharedMeasurements({ user }) {
  if (!supabase || !user?.id) {
    return { ok: false, message: getSupabaseConfigError(), shares: [] };
  }

  const { data: sentShares, error: sentError } = await supabase
    .from("shared_measurements")
    .select("*")
    .eq("sender_user_id", user.id)
    .order("created_at", { ascending: false });

  if (sentError) {
    return { ok: false, message: sentError.message, shares: [] };
  }

  const { data: receivedShares, error: receivedError } = await supabase
    .from("shared_measurements")
    .select("*")
    .eq("receiver_user_id", user.id)
    .order("created_at", { ascending: false });

  if (receivedError) {
    return { ok: false, message: receivedError.message, shares: [] };
  }

  const sharesById = new Map();

  [...(sentShares || []), ...(receivedShares || [])].forEach((share) => {
    sharesById.set(share.id, share);
  });

  return {
    ok: true,
    shares: [...sharesById.values()]
      .sort((firstShare, secondShare) => new Date(secondShare.created_at) - new Date(firstShare.created_at))
      .map((share) => mapSharedMeasurementRow(share, user)),
  };
}

export async function fetchMobileMeasurementDrafts({ user, mode }) {
  if (!supabase || !user?.id) {
    return { ok: false, message: getSupabaseConfigError(), drafts: [] };
  }

  const { data, error } = await supabase
    .from("measurement_drafts")
    .select("*")
    .eq("user_id", user.id)
    .eq("mode", mode)
    .order("updated_at", { ascending: false });

  if (error) {
    return { ok: false, message: error.message, drafts: [] };
  }

  return {
    ok: true,
    drafts: (data || []).map(mapDraftRow),
  };
}

export async function saveMobileMeasurementDraft({ user, draft }) {
  if (!supabase || !user?.id || !draft) {
    return { ok: false, message: getSupabaseConfigError() };
  }

  const now = new Date().toISOString();
  const cleanDraft = {
    ...draft,
    updatedAt: now,
  };
  const cloudDraft = sanitizeDraftForCloud(cleanDraft);
  const payload = {
    user_id: user.id,
    mode: cleanDraft.mode || "client",
    stage: cleanDraft.stage || "capture",
    customer_name: cleanDraft.measurementDetails?.customerName || cleanDraft.measurementDetails?.fullName || "Untitled measurement",
    values: {
      localDraftId: cleanDraft.id,
      mobileDraft: cloudDraft,
      formValues: cleanDraft.measurementDetails || {},
      photoSummary: cloudDraft.capturedPhotos || {},
      photoStoragePolicy: "photo-files-not-saved",
    },
    review_customer: cleanDraft.stage === "review"
      ? {
          fullname: cleanDraft.measurementDetails?.customerName || "My measurement",
          measurementProfile: cleanDraft.measurementDetails?.profile || "female",
          measurements: cleanDraft.reviewMeasurements || [],
          generatedMeasurements: cleanDraft.generatedMeasurements || [],
        }
      : {},
    review_state: cleanDraft.stage === "review"
      ? {
          localDraftId: cleanDraft.id,
          measurements: cleanDraft.reviewMeasurements || [],
        }
      : {},
    updated_at: now,
  };

  const draftQuery = cleanDraft.cloudDraftId
    ? supabase
        .from("measurement_drafts")
        .update(payload)
        .eq("id", cleanDraft.cloudDraftId)
        .eq("user_id", user.id)
        .select("*")
        .single()
    : supabase
        .from("measurement_drafts")
        .insert(payload)
        .select("*")
        .single();

  const { data, error } = await draftQuery;

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true, draft: mapDraftRow(data) };
}

export async function deleteMobileMeasurementDraft({ user, draft }) {
  if (!supabase || !user?.id || !draft?.cloudDraftId) {
    return { ok: true };
  }

  const { error } = await supabase
    .from("measurement_drafts")
    .delete()
    .eq("id", draft.cloudDraftId)
    .eq("user_id", user.id);

  return error ? { ok: false, message: error.message } : { ok: true };
}
