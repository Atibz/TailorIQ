import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const REMINDER_NOTIFICATION_MAP_KEY = "tailoriq_reminder_notification_ids";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function getNotificationMap() {
  try {
    const savedMap = await AsyncStorage.getItem(REMINDER_NOTIFICATION_MAP_KEY);
    return savedMap ? JSON.parse(savedMap) : {};
  } catch {
    return {};
  }
}

async function saveNotificationMap(notificationMap) {
  await AsyncStorage.setItem(REMINDER_NOTIFICATION_MAP_KEY, JSON.stringify(notificationMap));
}

function getReminderKey(reminder) {
  return reminder?.cloudReminderId || reminder?.id;
}

function getReminderNotificationContent(reminder) {
  const title = reminder.title || reminder.type || "TailorIQ reminder";
  const body = reminder.customerName
    ? `${reminder.customerName}${reminder.note ? ` - ${reminder.note}` : ""}`
    : reminder.note || "You have a TailorIQ reminder due.";

  return { title, body };
}

async function ensureReminderNotificationChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync("tailoriq-reminders", {
    name: "TailorIQ reminders",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
  });
}

export async function requestReminderNotificationPermission() {
  const existingPermission = await Notifications.getPermissionsAsync();

  if (existingPermission.granted) {
    return { ok: true };
  }

  const requestedPermission = await Notifications.requestPermissionsAsync();

  return requestedPermission.granted
    ? { ok: true }
    : { ok: false, message: "Notification permission is needed for reminder alerts." };
}

export async function cancelReminderNotification(reminder) {
  const reminderKey = getReminderKey(reminder);

  if (!reminderKey) {
    return;
  }

  const notificationMap = await getNotificationMap();
  const notificationId = notificationMap[reminderKey];

  if (notificationId) {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    delete notificationMap[reminderKey];
    await saveNotificationMap(notificationMap);
  }
}

export async function scheduleReminderNotification(reminder) {
  if (!reminder?.dueAt || reminder.status === "done") {
    return { ok: true };
  }

  const dueDate = new Date(reminder.dueAt);

  if (Number.isNaN(dueDate.getTime()) || dueDate.getTime() <= Date.now()) {
    await cancelReminderNotification(reminder);
    return { ok: true };
  }

  const permission = await requestReminderNotificationPermission();

  if (!permission.ok) {
    return permission;
  }

  await ensureReminderNotificationChannel();
  await cancelReminderNotification(reminder);

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      ...getReminderNotificationContent(reminder),
      sound: true,
      data: {
        reminderId: reminder.id,
        cloudReminderId: reminder.cloudReminderId,
      },
    },
    trigger: {
      type: "date",
      date: dueDate,
      channelId: "tailoriq-reminders",
    },
  });

  const notificationMap = await getNotificationMap();
  notificationMap[getReminderKey(reminder)] = notificationId;
  await saveNotificationMap(notificationMap);

  return { ok: true };
}

export async function scheduleReminderNotifications(reminders = []) {
  const openReminders = reminders.filter((reminder) => reminder.status !== "done");

  for (const reminder of openReminders) {
    await scheduleReminderNotification(reminder);
  }
}
