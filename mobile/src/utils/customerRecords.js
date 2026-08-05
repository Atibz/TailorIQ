import { styleCategories } from "../constants/appConfig";

export function formatShortDate(value) {
  if (!value) {
    return "Today";
  }

  return new Date(value).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getRecordCustomerName(record = {}) {
  if (!record) {
    return "";
  }

  return (
    record.fullname ||
    record.customerName ||
    record.measurementDetails?.customerName ||
    ""
  ).trim();
}

export function getReminderCustomerSuggestions(records = [], searchTerm = "") {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const seenNames = new Set();

  if (!normalizedSearch) {
    return [];
  }

  const matches = records
    .map((record) => {
      const name = getRecordCustomerName(record);

      return {
        id: record.cloudMeasurementId || record.cloudCustomerId || record.id || name,
        cloudCustomerId: record.cloudCustomerId || "",
        name,
        profile: record.measurementProfile === "female" ? "Female" : "Male",
        updatedAt: record.updatedAt || record.createdAt,
      };
    })
    .filter((record) => {
      if (!record.name) {
        return false;
      }

      const normalizedName = record.name.toLowerCase();

      if (seenNames.has(normalizedName)) {
        return false;
      }

      seenNames.add(normalizedName);
      return !normalizedSearch || normalizedName.includes(normalizedSearch);
    })
    .slice(0, 5);

  if (
    normalizedSearch &&
    matches.length === 1 &&
    matches[0].name.toLowerCase() === normalizedSearch
  ) {
    return [];
  }

  return matches;
}

export function findReminderCustomerMatch(records = [], customerName = "") {
  const normalizedName = customerName.trim().toLowerCase();

  if (!normalizedName) {
    return null;
  }

  return records.find((record) => getRecordCustomerName(record).toLowerCase() === normalizedName) || null;
}

export function getStyleCustomerSuggestions(records = [], searchTerm = "", attachedCustomers = []) {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const attachedIds = new Set(attachedCustomers.map((customer) => String(customer.cloudCustomerId || customer.customerId)));

  if (!normalizedSearch) {
    return [];
  }

  return records
    .map((record) => {
      const name = getRecordCustomerName(record);

      return {
        id: record.cloudCustomerId || record.id || name,
        cloudCustomerId: record.cloudCustomerId || "",
        name,
        profile: record.measurementProfile === "female" ? "Female" : "Male",
        updatedAt: record.updatedAt || record.createdAt,
      };
    })
    .filter((record) => (
      record.name &&
      record.cloudCustomerId &&
      !attachedIds.has(String(record.cloudCustomerId)) &&
      (!normalizedSearch || record.name.toLowerCase().includes(normalizedSearch))
    ))
    .slice(0, 6);
}

export function mergeStyleCategories(customCategories = []) {
  return [...styleCategories, ...customCategories].reduce((list, category) => {
    const cleanCategory = category?.trim();

    if (!cleanCategory || list.some((item) => item.toLowerCase() === cleanCategory.toLowerCase())) {
      return list;
    }

    return [...list, cleanCategory];
  }, []);
}

export function getRecordInitials(name = "") {
  const cleanName = name.trim();

  if (!cleanName) {
    return "IQ";
  }

  return cleanName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function hasUsablePhoto(photo) {
  return Boolean(photo?.uri);
}

export function hasPhotoReference(photo) {
  return Boolean(photo?.uri || photo?.hasPhoto);
}
