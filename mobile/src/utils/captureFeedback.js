export function getCameraVoiceInstruction({ captureMode, captureStep, captureRetryPaused }) {
  if (captureRetryPaused) {
    return "Adjust the phone, make sure your full body is visible, then tap retry.";
  }

  if (captureMode === "self") {
    return captureStep === "front"
      ? "Front view. Step back until your whole body is visible. Stand straight with your arms slightly away from your body."
      : "Side view. Turn fully to your side. Keep your full body visible and your arms slightly away from your body.";
  }

  return captureStep === "front"
    ? "Frame the full front view from head to feet, then take the photo."
    : "Frame the full side view from head to feet, then take the photo.";
}

export function getLiveCaptureVoiceInstruction(message = "") {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("not centered")) {
    return "Move your body toward the middle of the frame.";
  }

  if (normalizedMessage.includes("too close") || normalizedMessage.includes("frame edge")) {
    return "Step back until your full body fits comfortably.";
  }

  if (normalizedMessage.includes("too small")) {
    return "Move slightly closer, but keep your head and feet visible.";
  }

  if (normalizedMessage.includes("front-facing")) {
    return "Face the camera straight on.";
  }

  if (normalizedMessage.includes("side-facing") || normalizedMessage.includes("turn sideways")) {
    return "Turn sideways so one shoulder faces the camera.";
  }

  if (normalizedMessage.includes("arms") || normalizedMessage.includes("waist")) {
    return "Let your arms hang slightly away from your body.";
  }

  if (normalizedMessage.includes("stand straight") || normalizedMessage.includes("twisted")) {
    return "Stand straight without twisting your shoulders or hips.";
  }

  if (normalizedMessage.includes("too dark")) {
    return "Use brighter even lighting.";
  }

  if (normalizedMessage.includes("overexposed")) {
    return "Reduce harsh light on the body.";
  }

  if (normalizedMessage.includes("blurry")) {
    return "Hold the camera steady.";
  }

  return "Adjust the camera until your full body is clear.";
}

export function cleanPhotoWarnings(warnings = []) {
  return warnings.filter((warning) => !isNoisyPhotoWarning(warning));
}

export function cleanPhotoMessage(message = "") {
  return isNoisyPhotoWarning(message) ? "" : message;
}

export function isBlockingCaptureWarning(message = "") {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("too dark") ||
    normalizedMessage.includes("overexposed") ||
    normalizedMessage.includes("low contrast") ||
    normalizedMessage.includes("blurry") ||
    normalizedMessage.includes("not centered") ||
    normalizedMessage.includes("too small") ||
    normalizedMessage.includes("full-body check") ||
    normalizedMessage.includes("could not be checked") ||
    normalizedMessage.includes("plain background")
  );
}

export function getLiveCaptureResult(validation, view) {
  const visibleWarnings = cleanPhotoWarnings(validation?.warnings || []);
  const blockingWarning = [
    validation?.message,
    ...visibleWarnings,
  ].find((message) => isBlockingCaptureWarning(message));

  if (!validation?.ok || blockingWarning) {
    return {
      ready: false,
      message: cleanPhotoMessage(blockingWarning || validation?.message) || `Adjust the ${view === "front" ? "front" : "side"} frame.`,
      warnings: visibleWarnings,
    };
  }

  return {
    ready: true,
    message: `${view === "front" ? "Front" : "Side"} view is ready.`,
    warnings: visibleWarnings,
  };
}

function isNoisyPhotoWarning(message = "") {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("close to the frame edge") ||
    normalizedMessage.includes("near the frame edge") ||
    normalizedMessage.includes("move back only if") ||
    normalizedMessage.includes("very close to the frame edge") ||
    normalizedMessage.includes("person is too close to the camera") ||
    normalizedMessage.includes("fills almost the whole photo") ||
    normalizedMessage.includes("keep a little space around the head and feet") ||
    normalizedMessage.includes("outline looks wide") ||
    normalizedMessage.includes("continue only if the full body is visible") ||
    normalizedMessage.includes("looks too close or too wide") ||
    normalizedMessage.includes("step back and keep the full body visible") ||
    normalizedMessage.includes("does not look fully side-facing") ||
    normalizedMessage.includes("turn sideways so one shoulder and one hip face the camera") ||
    normalizedMessage.includes("missing some body details")
  );
}
