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

function getPhotoCheckUrl() {
  return joinMeasurementPath("/measurements/photo-check");
}

function getMeasurementConfigError() {
  if (measurementApiUrl) {
    return "";
  }

  return "Measurement service is not connected. Add EXPO_PUBLIC_SEGMENTATION_API_URL in mobile/.env.";
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

  const response = await withTimeout(fetch(getMeasurementUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
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
    }),
  }), REQUEST_TIMEOUT_MS, "Measurement analysis timed out. Try smaller, clearer photos or check the connection.");

  if (!response.ok) {
    let message = `Measurement service failed with ${response.status}`;

    try {
      const errorBody = await response.json();
      message = errorBody?.error || message;
    } catch {
      // Keep the status message if the backend does not return JSON.
    }

    throw new Error(message);
  }

  const result = await response.json();

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
    // Keep the status message if the backend does not return JSON.
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
      throw new Error("Photo check is not available on the measurement backend yet. Restart or redeploy the backend, then reload the app.");
    }

    throw new Error(result?.error || result?.message || `Photo check failed with ${response.status}`);
  }

  return result;
}
