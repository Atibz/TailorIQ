import { requestMobilePhotoCheck } from "./measurementApi";

export const CAPTURE_VALIDATION_ENGINE = "backend-photo-check";

function getViewLabel(view) {
  return view === "side" ? "Side view" : "Front view";
}

export async function validateCapturedPhoto({ photo, view }) {
  const result = await requestMobilePhotoCheck({ photo, view });

  return {
    ok: Boolean(result.ok),
    engine: CAPTURE_VALIDATION_ENGINE,
    view,
    message: result.message || `${getViewLabel(view)} is ready.`,
    warnings: result.warnings || [],
    metrics: result.metrics || null,
    checkedAt: new Date().toISOString(),
  };
}

export function getCaptureRejectionMessage(error, view) {
  const message = error?.message || "Photo could not be checked. Try again.";

  return `${getViewLabel(view)} needs retake. ${message}`;
}
