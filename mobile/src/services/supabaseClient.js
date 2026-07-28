import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

function isValidSupabaseUrl(url) {
  if (!url || url.includes("your-project-id")) {
    return false;
  }

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
  supabasePublishableKey !== "your-anon-public-key" &&
  isValidSupabaseUrl(supabaseUrl)
);

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export function getSupabaseConfigError() {
  if (hasSupabaseConfig) {
    return "";
  }

  if (supabaseUrl && !isValidSupabaseUrl(supabaseUrl)) {
    return "Account access is not configured correctly on this device.";
  }

  if (!supabasePublishableKey || supabasePublishableKey === "your-anon-public-key") {
    return "Account access is not ready on this device.";
  }

  return "Account access is not ready on this device.";
}
