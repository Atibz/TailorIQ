import { getSupabaseConfigError, supabase } from "./supabaseClient";

const STYLE_IMAGE_BUCKET = "style-images";

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

export async function fetchSharedStyleCategory(token) {
  if (!supabase) {
    return { ok: false, message: getSupabaseConfigError(), share: null, styles: [] };
  }

  const cleanToken = token?.trim();

  if (!cleanToken) {
    return { ok: false, message: "This style link is missing or incomplete.", share: null, styles: [] };
  }

  const { data: shareRows, error: shareError } = await supabase
    .rpc("get_public_style_category_share", {
      share_token: cleanToken,
    });

  const share = shareRows?.[0];

  if (shareError || !share) {
    return { ok: false, message: "This style link is unavailable or has been turned off.", share: null, styles: [] };
  }

  const { data: rows, error: stylesError } = await supabase
    .from("styles")
    .select("id, title, category, notes, image_path, image_data_url, updated_at")
    .eq("user_id", share.user_id)
    .eq("mode", share.mode || "tailor")
    .eq("category", share.category)
    .order("updated_at", { ascending: false });

  if (stylesError) {
    return { ok: false, message: stylesError.message, share, styles: [] };
  }

  const styles = await Promise.all((rows || []).map(async (style) => ({
    id: style.id,
    title: style.title || style.category || "Style idea",
    category: style.category || share.category,
    notes: style.notes || "",
    imageUrl: await getSignedStyleImageUrl(style.image_path) || style.image_data_url || "",
    updatedAt: style.updated_at,
  })));

  return { ok: true, share, styles };
}
