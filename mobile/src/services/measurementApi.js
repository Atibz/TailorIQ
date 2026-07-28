import "react-native-url-polyfill/auto";

import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";

const measurementApiUrl = process.env.EXPO_PUBLIC_SEGMENTATION_API_URL?.trim();
const REQUEST_TIMEOUT_MS = 45000;
const MAX_PHOTO_EDGE = 1200;

function joinMeasurementPath(path) {
  if (!measurementApiUrl) {
    return "";
  }

  try {
    const url = new URL(measurementApiUrl);
    url.pathname = url.pathname
      .replace(/\/measurements\/segment\/?$/, "")
      .replace(/\/measurements\/photo-check\/?$/, "")
      .replace(/\/$/, "");
    url.pathname = `${url.pathname}${path}`;
    return url.toString();
  } catch {
    return measurementApiUrl;
  }
}

function getMeasurementUrl() {
  return joinMeasurementPath("/measurements/segment");
}

function getMeasurementFallbackUrls() {
  return [
    joinMeasurementPath("/measurements/segment"),
    joinMeasurementPath("/measure"),
    joinMeasurementPath("/"),
  ].filter(Boolean);
}

function getPhotoCheckUrl() {
  return joinMeasurementPath("/measurements/photo-check");
}

function getMeasurementConfigError() {
  if (measurementApiUrl) {
    return "";
  }

  return "Measurement analysis is not connected on this device yet. Check the app setup and try again.";
}

function withTimeout(promise, milliseconds, errorMessage) {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), milliseconds);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

async function preparePhotoForBackend(photo) {
  if (!photo?.uri) {
    throw new Error("Front and side photos are required.");
  }

  const width = Number(photo.width);
  const height = Number(photo.height);
  const longestEdge = Math.max(width || 0, height || 0);
  const resizeAction = longestEdge > MAX_PHOTO_EDGE
    ? width >= height
      ? { resize: { width: MAX_PHOTO_EDGE } }
      : { resize: { height: MAX_PHOTO_EDGE } }
    : null;

  const preparedPhoto = await ImageManipulator.manipulateAsync(
    photo.uri,
    resizeAction ? [resizeAction] : [],
    {
      compress: 0.72,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

  return {
    ...photo,
    ...preparedPhoto,
    mimeType: "image/jpeg",
    originalUri: photo.uri,
  };
}

async function readPhotoAsDataUrl(photo) {
  const preparedPhoto = await preparePhotoForBackend(photo);
  const base64 = await FileSystem.readAsStringAsync(preparedPhoto.uri, {
    encoding: FileSystem.EncodingType?.Base64 || "base64",
  });

  return `data:image/jpeg;base64,${base64}`;
}

export async function requestMobileMeasurements({ frontPhoto, sidePhoto, profile, height }) {
  if (!measurementApiUrl) {
    throw new Error(getMeasurementConfigError());
  }

  const [frontImage, sideImage] = await Promise.all([
    readPhotoAsDataUrl(frontPhoto),
    readPhotoAsDataUrl(sidePhoto),
  ]);

  const payload = {
    profile,
    scale: {
      mode: "known-height",
      height,
      heightUnit: "cm",
    },
    images: {
      front: frontImage,
      side: sideImage,
    },
    poseMetrics: {
      front: frontPhoto.captureValidation?.metrics || frontPhoto.photoCheck?.metrics || null,
      side: sidePhoto.captureValidation?.metrics || sidePhoto.photoCheck?.metrics || null,
    },
  };
  const urls = getMeasurementFallbackUrls();
  let response = null;
  let result = null;
  let lastErrorMessage = "";
  let usedUrl = urls[0] || getMeasurementUrl();

  for (const url of urls) {
    usedUrl = url;
    response = await withTimeout(fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }), REQUEST_TIMEOUT_MS, "Measurement analysis timed out. Try smaller, clearer photos or check the connection.");

    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (response.ok || response.status !== 404) {
      break;
    }

    lastErrorMessage = result?.error || result?.message || "Measurement analysis could not be reached.";
  }

  if (!response.ok) {
    let message = result?.error || result?.message || lastErrorMessage || `Measurement service failed with ${response.status}`;

    if (response.status === 404 || message === "Not found") {
      message = "Measurement analysis could not be reached. Check the app setup, restart the app, and try again.";
    }

    throw new Error(message);
  }

  if (!result?.measurements) {
    throw new Error("Measurement service did not return measurements.");
  }

  return result;
}

export async function requestMobilePhotoCheck({ photo, view }) {
  if (!measurementApiUrl) {
    throw new Error(getMeasurementConfigError());
  }

  const photoCheckUrl = getPhotoCheckUrl();
  const image = await readPhotoAsDataUrl(photo);
  let response = await withTimeout(fetch(photoCheckUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      view,
      image,
    }),
  }), REQUEST_TIMEOUT_MS, "Photo check timed out. Try a smaller, clearer photo or check the connection.");

  let result = null;

  try {
    result = await response.json();
  } catch {
    // Keep the status message if the service does not return JSON.
  }

  if (!response.ok && response.status === 404) {
    const fallbackPhotoCheckUrl = joinMeasurementPath("/photo-check");

    if (fallbackPhotoCheckUrl !== photoCheckUrl) {
      response = await withTimeout(fetch(fallbackPhotoCheckUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          view,
          image,
        }),
      }), REQUEST_TIMEOUT_MS, "Photo check timed out. Try a smaller, clearer photo or check the connection.");

      try {
        result = await response.json();
      } catch {
        result = null;
      }
    }
  }

  if (!response.ok) {
    if (response.status === 404 || result?.error === "Not found") {
      throw new Error("Photo check is not available right now. Restart the app and try again.");
    }

    throw new Error(result?.error || result?.message || `Photo check failed with ${response.status}`);
  }

  return result;
}
