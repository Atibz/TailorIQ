import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

function isValidSupabaseUrl(url) {
  try {
    const parsedUrl = new URL(url);

    return parsedUrl.protocol === "https:" && parsedUrl.hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

export const hasSupabaseConfig = Boolean(
  supabaseUrl &&
  supabasePublishableKey &&
  isValidSupabaseUrl(supabaseUrl)
);

export const supabase = (() => {
  if (!hasSupabaseConfig) {
    return null;
  }

  try {
    return createClient(supabaseUrl, supabasePublishableKey);
  } catch {
    return null;
  }
})();

export function getSupabaseConfigError() {
  if (hasSupabaseConfig) {
    return "";
  }

  if (supabaseUrl && !isValidSupabaseUrl(supabaseUrl)) {
    return "Supabase URL should look like https://your-project-id.supabase.co. Do not include /rest/v1/ at the end.";
  }

  return "Supabase is not connected yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.";
}
