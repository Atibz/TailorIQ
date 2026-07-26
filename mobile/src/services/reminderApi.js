import { getSupabaseConfigError, supabase } from "./supabaseClient";

function toDateInputValue(date) {
  return date.toISOString().slice(0, 10);
}

function toTimeInputValue(date) {
  return date.toTimeString().slice(0, 5);
}

function mapReminderRow(row, user) {
  const dueDate = row.due_date || "";
  const dueTime = row.due_time ? String(row.due_time).slice(0, 5) : "09:00";

  return {
    id: `reminder-${row.id}`,
    cloudReminderId: row.id,
    ownerUsername: user?.username || "",
    appMode: "tailor",
    customerId: row.customer_id || "",
    cloudCustomerId: row.customer_id || "",
    customerName: row.customer_name || "",
    title: row.title || "",
    type: row.type || "Other",
    note: row.note || "",
    dueAt: dueDate ? new Date(`${dueDate}T${dueTime}`).toISOString() : "",
    status: row.status || "open",
    alertedAt: row.alerted_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getReminderPayload(reminder, user) {
  const dueDate = reminder.dueAt ? new Date(reminder.dueAt) : new Date();

  return {
    user_id: user.id,
    customer_id: reminder.cloudCustomerId || null,
    customer_name: reminder.customerName || null,
    title: reminder.title || null,
    type: reminder.type || "Other",
    note: reminder.note || null,
    due_date: toDateInputValue(dueDate),
    due_time: toTimeInputValue(dueDate),
    status: reminder.status || "open",
    alerted_at: reminder.alertedAt || null,
    updated_at: new Date().toISOString(),
  };
}

export async function fetchMobileReminders({ user }) {
  if (!supabase || !user?.id) {
    return { ok: false, message: getSupabaseConfigError(), reminders: [] };
  }

  const { data, error } = await supabase
    .from("reminders")
    .select("*")
    .eq("user_id", user.id)
    .order("due_date", { ascending: true })
    .order("due_time", { ascending: true });

  if (error) {
    return { ok: false, message: error.message, reminders: [] };
  }

  return {
    ok: true,
    reminders: (data || []).map((reminder) => mapReminderRow(reminder, user)),
  };
}

export async function saveMobileReminder({ user, reminder }) {
  if (!supabase || !user?.id || !reminder) {
    return { ok: false, message: getSupabaseConfigError() };
  }

  const payload = getReminderPayload(reminder, user);
  const query = reminder.cloudReminderId
    ? supabase
        .from("reminders")
        .update(payload)
        .eq("id", reminder.cloudReminderId)
        .eq("user_id", user.id)
        .select("*")
        .single()
    : supabase
        .from("reminders")
        .insert(payload)
        .select("*")
        .single();

  const { data, error } = await query;

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true, reminder: mapReminderRow(data, user) };
}

export async function deleteMobileReminder({ user, reminder }) {
  if (!supabase || !user?.id || !reminder?.cloudReminderId) {
    return { ok: true };
  }

  const { error } = await supabase
    .from("reminders")
    .delete()
    .eq("id", reminder.cloudReminderId)
    .eq("user_id", user.id);

  return error ? { ok: false, message: error.message } : { ok: true };
}
