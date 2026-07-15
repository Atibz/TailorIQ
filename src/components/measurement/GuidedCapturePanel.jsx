import React, { useEffect, useRef, useState } from "react";
import { captureLabels } from "./constants";
import GuidelineChecklist from "./GuidelineChecklist";
import PhotoUploadPanel from "./PhotoUploadPanel";

function GuidedCapturePanel({
  activeCapture,
  allGuidelinesPassed,
  canvasRef,
  cameraFeedback,
  capturePhoto,
  guidelineLabels,
  guidelines,
  isCameraActive,
  onExitCamera,
  onUploadPhoto,
  photos,
  poseMessage,
  poseStatus,
  retakePhoto,
  startCamera,
  uploadStatus,
  videoRef,
  inputMode,
  captureMode = "assisted",
}) {
  const [countdown, setCountdown] = useState(null);
  const lastSpokenInstructionRef = useRef("");
  const lastSpokenAtRef = useRef(0);
  const capturePhotoRef = useRef(capturePhoto);
  const isCameraCapture = inputMode === "camera";
  const isSelfCapture = captureMode === "self";
  const isReadyToCapture = isCameraCapture && isCameraActive && allGuidelinesPassed;

  useEffect(() => {
    capturePhotoRef.current = capturePhoto;
  }, [capturePhoto]);

  useEffect(() => {
    if (!isCameraCapture || typeof window === "undefined" || !window.speechSynthesis) {
      return undefined;
    }

    if (!isCameraActive || isReadyToCapture) {
      window.speechSynthesis.cancel();
      return undefined;
    }

    const speakInstruction = () => {
      const instruction = isSelfCapture
        ? `${poseMessage || "Move into the guide until the shutter turns green."} Step back slowly until your whole body fits.`
        : poseMessage || "Move into the guide until the shutter turns green.";
      const now = Date.now();

      if (instruction === lastSpokenInstructionRef.current && now - lastSpokenAtRef.current < 6500) {
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(instruction);
      utterance.rate = 0.95;
      utterance.pitch = 1;
      lastSpokenInstructionRef.current = instruction;
      lastSpokenAtRef.current = now;
      window.speechSynthesis.speak(utterance);
    };

    speakInstruction();
    const speechTimer = window.setInterval(speakInstruction, 5500);

    return () => window.clearInterval(speechTimer);
  }, [isCameraActive, isCameraCapture, isReadyToCapture, isSelfCapture, poseMessage]);

  useEffect(() => {
    if (!isSelfCapture || !isReadyToCapture) {
      return undefined;
    }

    let remaining = 5;
    const startTimer = window.setTimeout(() => setCountdown(remaining), 0);

    const speak = (text) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    };

    speak(
      activeCapture === "front"
        ? "Front photo ready. Hold your pose. Capturing in 5 seconds."
        : "Side photo ready. Hold your side pose. Capturing in 5 seconds.",
    );

    const countdownTimer = window.setInterval(() => {
      remaining -= 1;

      if (remaining > 0) {
        setCountdown(remaining);
        speak(String(remaining));
        return;
      }

      window.clearInterval(countdownTimer);
      setCountdown(0);
      speak("Capturing now.");
      window.setTimeout(() => {
        capturePhotoRef.current?.();
        setCountdown(null);
      }, 250);
    }, 1000);

    return () => {
      window.clearTimeout(startTimer);
      window.clearInterval(countdownTimer);
    };
  }, [activeCapture, isReadyToCapture, isSelfCapture]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (isCameraCapture) {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden bg-black text-white">
        <video
          ref={videoRef}
          className={`h-full w-full object-cover transition-opacity ${isCameraActive ? "opacity-100" : "opacity-0"}`}
          autoPlay
          muted
          playsInline
        />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_42%,rgba(0,0,0,0.38)_74%)]" />
        <div
          className={`pointer-events-none absolute inset-x-[12%] bottom-32 top-24 rounded-[46%] border transition ${
            isReadyToCapture
              ? "border-emerald-400 shadow-[0_0_28px_rgba(52,211,153,0.45)]"
              : "border-white/70"
          }`}
        />
        <div
          className={`pointer-events-none absolute left-1/2 top-24 h-[calc(100%-14rem)] w-px -translate-x-1/2 transition ${
            isReadyToCapture ? "bg-emerald-300/55" : "bg-white/25"
          }`}
        />

        <div className="absolute left-0 right-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/85 to-transparent px-4 pb-12 pt-4">
          <button
            type="button"
            onClick={onExitCamera}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/20 transition hover:bg-black/80"
            aria-label="Exit camera"
            title="Exit camera"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.42-1.41L7.83 13H20v-2Z" />
            </svg>
          </button>
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/70">
              {activeCapture === "front" ? "Front photo" : "Side photo"}
            </p>
            <p className="mt-1 text-sm font-semibold">
              {isReadyToCapture ? (isSelfCapture ? "Timer ready" : "Ready") : isCameraActive ? "Align body" : "Opening camera"}
            </p>
            <div className="mt-2 flex items-center justify-center gap-2">
              {["front", "side"].map((view) => (
                <span
                  key={view}
                  className={`h-1.5 w-8 rounded-full ${
                    activeCapture === view ? "bg-white" : "bg-white/25"
                  }`}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={startCamera}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/20 transition hover:bg-black/80"
            aria-label={isCameraActive ? "Restart camera" : "Start camera"}
            title={isCameraActive ? "Restart camera" : "Start camera"}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M9 3 7.17 5H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.17L15 3H9Zm3 15a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
            </svg>
          </button>
        </div>

        {!isCameraActive && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
            <div>
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              <p className="mt-4 text-sm font-medium text-white/80">Opening camera...</p>
            </div>
          </div>
        )}

        {cameraFeedback && (
          <div className="absolute inset-x-4 top-24 flex justify-center">
            <span className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg">
              {cameraFeedback}
            </span>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center bg-gradient-to-t from-black via-black/85 to-transparent px-4 pb-5 pt-16">
          <p
            className={`mb-4 max-w-[min(28rem,calc(100vw-2rem))] rounded-full px-4 py-2 text-center text-sm font-medium ${
              isReadyToCapture ? "bg-emerald-500/90 text-white" : "bg-black/70 text-white"
            }`}
          >
            {isReadyToCapture
              ? isSelfCapture
                ? `Hold still. Capturing in ${countdown ?? 5}.`
                : "Good. Hold still."
              : isCameraActive
                ? poseMessage
                : "Camera is starting."}
          </p>
          <button
            type="button"
            onClick={capturePhoto}
            disabled={!isReadyToCapture || isSelfCapture}
            className={`flex h-20 w-20 items-center justify-center rounded-full border-[5px] shadow-lg transition ${
              isReadyToCapture
                ? "border-emerald-200 bg-emerald-500 shadow-emerald-500/30 hover:bg-emerald-600"
                : "cursor-not-allowed border-white/55 bg-white/15"
            }`}
            aria-label={`Capture ${captureLabels[activeCapture]}`}
            title={allGuidelinesPassed ? `Capture ${captureLabels[activeCapture]}` : "Align the photo until checks pass"}
          >
            <span className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold ${
              isReadyToCapture ? "bg-white text-emerald-700" : "bg-white/35 text-white/70"
            }`}>
              {isSelfCapture && isReadyToCapture && countdown !== null ? countdown : ""}
            </span>
          </button>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.25em] text-white">Photo</p>
          <p className="mt-2 text-xs font-medium text-white/60">{poseStatus}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-stone-950">Upload photos</p>
          <p className="mt-1 text-sm text-stone-500">Add one clear front view and one clear side view.</p>
        </div>
        <span className="rounded-md bg-white px-3 py-1 text-xs font-medium text-amber-700">
          Front + side required
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <PhotoUploadPanel
          photos={photos}
          uploadStatus={uploadStatus}
          onRetake={retakePhoto}
          onUploadPhoto={onUploadPhoto}
        />
        <div className="space-y-3">
          <GuidelineChecklist
            guidelineLabels={guidelineLabels}
            guidelines={guidelines}
            poseMessage={poseMessage}
            poseStatus={poseStatus}
          />
        </div>
      </div>
    </div>
  );
}

export default GuidedCapturePanel;
