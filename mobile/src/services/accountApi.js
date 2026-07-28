import { getSupabaseConfigError, supabase } from "./supabaseClient";

export async function deleteMobileAccount() {
  if (!supabase) {
    return { ok: false, message: getSupabaseConfigError() };
  }

  const { error } = await supabase.rpc("delete_current_user_account");

  if (error) {
    return { ok: false, message: error.message };
  }

  await supabase.auth.signOut();

  return { ok: true };
}
