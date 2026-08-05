import { getSupabaseConfigError, supabase } from "./supabaseClient";
import * as FileSystem from "expo-file-system/legacy";
import { Buffer } from "buffer";

const STYLE_IMAGE_BUCKET = "style-images";
const DEFAULT_WEB_APP_URL = "https://tailor-iq.netlify.app";

function isMissingAttachmentTableError(error) {
  const message = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();

  return (
    message.includes("42p01") ||
    message.includes("customer_styles") ||
    message.includes("could not find a relationship")
  );
}

function isMissingStyleCategoryTableError(error) {
  const message = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();

  return (
    message.includes("42p01") ||
    message.includes("style_categories") ||
    message.includes("schema cache")
  );
}

function getMode(user) {
  return user?.mode || "client";
}

function createShareToken() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

function normalizePublicBaseUrl() {
  const configuredUrl = process.env.EXPO_PUBLIC_WEB_APP_URL?.trim();
  const baseUrl = configuredUrl || DEFAULT_WEB_APP_URL;

  return baseUrl.replace(/\/+$/, "");
}

export function buildStyleCategoryShareUrl(token) {
  return `${normalizePublicBaseUrl()}/shared/styles/${token}`;
}

function getImageExtension(image) {
  const mimeType = image?.mimeType || image?.type || "image/jpeg";
  const extension = mimeType.split("/")[1] || "jpg";

  return extension === "jpeg" ? "jpg" : extension;
}

async function getSignedStyleImageUrl(imagePath) {
  if (!supabase || !imagePath) {
    return "";
  }

  const { data, error } = await supabase
    .storage
    .from(STYLE_IMAGE_BUCKET)
    .createSignedUrl(imagePath, 60 * 60);

  return error ? "" : data.signedUrl;
}

async function uploadStyleImage(style, user) {
  if (!supabase || !user?.id) {
    return { ok: false, message: getSupabaseConfigError() };
  }

  if (style.imagePath && !style.image?.uri) {
    return { ok: true, imagePath: style.imagePath, previewUrl: style.imageUrl || "" };
  }

  if (!style.image?.uri) {
    return { ok: false, message: "Add a style image before saving." };
  }

  const extension = getImageExtension(style.image);
  const imagePath = `${user.id}/${getMode(user)}/${Date.now()}-${Math.round(Math.random() * 100000)}.${extension}`;
  const base64 = await FileSystem.readAsStringAsync(style.image.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = Buffer.from(base64, "base64");

  const { error } = await supabase
    .storage
    .from(STYLE_IMAGE_BUCKET)
    .upload(imagePath, bytes, {
      contentType: style.image.mimeType || style.image.type || "image/jpeg",
      upsert: false,
    });

  if (error) {
    return { ok: false, message: error.message };
  }

  const previewUrl = await getSignedStyleImageUrl(imagePath);

  return { ok: true, imagePath, previewUrl };
}

async function mapStyleRow(row, user) {
  const signedUrl = await getSignedStyleImageUrl(row.image_path);

  return {
    id: `style-${row.id}`,
    cloudStyleId: row.id,
    ownerUsername: user?.username || "",
    appMode: row.mode || getMode(user),
    title: row.title || "",
    category: row.category || "Other",
    notes: row.notes || "",
    imagePath: row.image_path || "",
    imageUrl: signedUrl || row.image_data_url || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchMobileStyleAttachments({ user }) {
  if (!supabase || !user?.id) {
    return { ok: false, message: getSupabaseConfigError(), attachmentsByStyleId: {} };
  }

  const { data, error } = await supabase
    .from("customer_styles")
    .select("id, style_id, customer_id, note, created_at, customers(id, fullname)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingAttachmentTableError(error)) {
      return { ok: true, attachmentsByStyleId: {} };
    }

    return { ok: false, message: error.message, attachmentsByStyleId: {} };
  }

  const attachmentsByStyleId = (data || []).reduce((groups, row) => {
    const styleId = row.style_id;

    if (!groups[styleId]) {
      groups[styleId] = [];
    }

    groups[styleId].push({
      id: row.id,
      cloudCustomerId: row.customer_id,
      customerId: row.customer_id,
      customerName: row.customers?.fullname || "Customer",
      note: row.note || "",
      createdAt: row.created_at,
    });

    return groups;
  }, {});

  return { ok: true, attachmentsByStyleId };
}

export async function fetchMobileStyles({ user }) {
  if (!supabase || !user?.id) {
    return { ok: false, message: getSupabaseConfigError(), styles: [] };
  }

  const { data, error } = await supabase
    .from("styles")
    .select("*")
    .eq("user_id", user.id)
    .eq("mode", getMode(user))
    .order("updated_at", { ascending: false });

  if (error) {
    return { ok: false, message: error.message, styles: [] };
  }

  const mappedStyles = await Promise.all((data || []).map((style) => mapStyleRow(style, user)));
  const attachmentResult = await fetchMobileStyleAttachments({ user });

  return {
    ok: true,
    styles: mappedStyles.map((style) => ({
      ...style,
      attachedCustomers: attachmentResult.attachmentsByStyleId?.[style.cloudStyleId] || [],
    })),
  };
}

export async function saveMobileStyle({ user, style }) {
  if (!supabase || !user?.id || !style) {
    return { ok: false, message: getSupabaseConfigError() };
  }

  const uploadedImage = await uploadStyleImage(style, user);

  if (!uploadedImage.ok) {
    return uploadedImage;
  }

  const payload = {
    user_id: user.id,
    mode: getMode(user),
    title: style.title?.trim() || null,
    category: style.category || "Other",
    notes: style.notes?.trim() || null,
    image_path: uploadedImage.imagePath,
    image_data_url: null,
    updated_at: new Date().toISOString(),
  };

  const query = style.cloudStyleId
    ? supabase
        .from("styles")
        .update(payload)
        .eq("id", style.cloudStyleId)
        .eq("user_id", user.id)
        .select("*")
        .single()
    : supabase
        .from("styles")
        .insert(payload)
        .select("*")
        .single();

  const { data, error } = await query;

  if (error) {
    return { ok: false, message: error.message };
  }

  const savedStyle = await mapStyleRow(data, user);

  return {
    ok: true,
    style: {
      ...savedStyle,
      imageUrl: uploadedImage.previewUrl || savedStyle.imageUrl,
    },
  };
}

export async function deleteMobileStyle({ user, style }) {
  if (!supabase || !user?.id || !style?.cloudStyleId) {
    return { ok: true };
  }

  if (style.imagePath) {
    await supabase
      .storage
      .from(STYLE_IMAGE_BUCKET)
      .remove([style.imagePath]);
  }

  const { error } = await supabase
    .from("styles")
    .delete()
    .eq("id", style.cloudStyleId)
    .eq("user_id", user.id);

  return error ? { ok: false, message: error.message } : { ok: true };
}

export async function fetchMobileStyleCategories({ user }) {
  if (!supabase || !user?.id) {
    return { ok: false, message: getSupabaseConfigError(), categories: [] };
  }

  const { data, error } = await supabase
    .from("style_categories")
    .select("id, name, mode, created_at")
    .eq("user_id", user.id)
    .eq("mode", getMode(user))
    .order("name", { ascending: true });

  if (error) {
    if (isMissingStyleCategoryTableError(error)) {
      return { ok: true, categories: [] };
    }

    return { ok: false, message: error.message, categories: [] };
  }

  return {
    ok: true,
    categories: (data || []).map((category) => category.name).filter(Boolean),
  };
}

export async function saveMobileStyleCategory({ user, name }) {
  if (!supabase || !user?.id) {
    return { ok: false, message: getSupabaseConfigError() };
  }

  const cleanName = name?.trim();

  if (!cleanName) {
    return { ok: false, message: "Enter a category name." };
  }

  const { error } = await supabase
    .from("style_categories")
    .upsert({
      user_id: user.id,
      mode: getMode(user),
      name: cleanName,
    }, {
      onConflict: "user_id,mode,name",
    });

  if (error) {
    if (isMissingStyleCategoryTableError(error)) {
      return { ok: false, message: "Run the style categories SQL before adding custom categories." };
    }

    return { ok: false, message: error.message };
  }

  return { ok: true, category: cleanName };
}

export async function createMobileStyleCategoryShare({ user, category }) {
  if (!supabase || !user?.id) {
    return { ok: false, message: getSupabaseConfigError() };
  }

  const cleanCategory = category?.trim();

  if (!cleanCategory || cleanCategory === "all") {
    return { ok: false, message: "Choose a style category before sharing." };
  }

  const token = createShareToken();
  const payload = {
    user_id: user.id,
    mode: getMode(user),
    category: cleanCategory,
    token,
    tailor_name: user.fullName || user.username || null,
    tailor_username: user.username || null,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("style_category_shares")
    .upsert(payload, {
      onConflict: "user_id,mode,category",
    })
    .select("token, category")
    .single();

  if (error) {
    return { ok: false, message: error.message };
  }

  const shareToken = data?.token || token;

  return {
    ok: true,
    token: shareToken,
    category: data?.category || cleanCategory,
    url: buildStyleCategoryShareUrl(shareToken),
  };
}

export async function attachMobileStyleToCustomer({ user, style, customer, note = "" }) {
  if (!supabase || !user?.id) {
    return { ok: false, message: getSupabaseConfigError() };
  }

  if (!style?.cloudStyleId) {
    return { ok: false, message: "Save this style before attaching it to a customer." };
  }

  if (!customer?.cloudCustomerId) {
    return { ok: false, message: "Choose a saved customer record before attaching this style." };
  }

  const { error } = await supabase
    .from("customer_styles")
    .upsert({
      user_id: user.id,
      style_id: style.cloudStyleId,
      customer_id: customer.cloudCustomerId,
      note: note?.trim() || null,
    }, {
      onConflict: "user_id,customer_id,style_id",
    });

  return error ? { ok: false, message: error.message } : { ok: true };
}

export async function detachMobileStyleFromCustomer({ user, style, attachment }) {
  if (!supabase || !user?.id) {
    return { ok: false, message: getSupabaseConfigError() };
  }

  if (!style?.cloudStyleId || !attachment?.cloudCustomerId) {
    return { ok: false, message: "This attachment could not be found." };
  }

  const { error } = await supabase
    .from("customer_styles")
    .delete()
    .eq("user_id", user.id)
    .eq("style_id", style.cloudStyleId)
    .eq("customer_id", attachment.cloudCustomerId);

  return error ? { ok: false, message: error.message } : { ok: true };
}
