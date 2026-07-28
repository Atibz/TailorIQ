import { getSupabaseConfigError, supabase } from "./supabaseClient";
import * as FileSystem from "expo-file-system/legacy";
import { Buffer } from "buffer";

const STYLE_IMAGE_BUCKET = "style-images";

function getMode(user) {
  return user?.mode || "client";
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

  return {
    ok: true,
    styles: await Promise.all((data || []).map((style) => mapStyleRow(style, user))),
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
