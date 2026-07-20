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
  const [isSelfCountdownRunning, setIsSelfCountdownRunning] = useState(false);
  const [deviceAlignmentScore, setDeviceAlignmentScore] = useState(null);
  const lastSpokenInstructionRef = useRef("");
  const lastSpokenAtRef = useRef(0);
  const capturePhotoRef = useRef(capturePhoto);
  const isCameraCapture = inputMode === "camera";
  const isSelfCapture = captureMode === "self";
  const isReadyToCapture = isCameraCapture && isCameraActive && allGuidelinesPassed;
  const guidelineValues = Object.values(guidelines || {});
  const passedGuidelineCount = guidelineValues.filter(Boolean).length;
  const alignmentScore = guidelineValues.length
    ? Math.round((passedGuidelineCount / guidelineValues.length) * 100)
    : 0;
  const selfAlignmentScore = deviceAlignmentScore ?? alignmentScore;
  const isSelfPhoneBalanced = isCameraCapture && isCameraActive && selfAlignmentScore >= 85;
  const showCaptureButton = isSelfCapture
    ? isSelfPhoneBalanced && !isSelfCountdownRunning
    : isReadyToCapture;
  const isGuideReady = isSelfCapture ? isSelfPhoneBalanced : isReadyToCapture;
  const centerReading = isSelfCountdownRunning && countdown !== null
    ? countdown
    : isSelfCapture
      ? selfAlignmentScore
      : alignmentScore;

  useEffect(() => {
    capturePhotoRef.current = capturePhoto;
  }, [capturePhoto]);

  useEffect(() => {
    if (!isCameraCapture || !isSelfCapture || typeof window === "undefined") {
      setDeviceAlignmentScore(null);
      return undefined;
    }

    let receivedOrientation = false;

    const scoreFromTilt = (beta = 90, gamma = 0) => {
      const uprightError = Math.abs(Math.abs(beta) - 90) * 1.35;
      const sideTiltError = Math.abs(gamma) * 3.2;
      return Math.max(0, Math.min(100, Math.round(100 - uprightError - sideTiltError)));
    };

    const handleOrientation = (event) => {
      if (typeof event.beta !== "number" || typeof event.gamma !== "number") {
        return;
      }

      receivedOrientation = true;
      setDeviceAlignmentScore(scoreFromTilt(event.beta, event.gamma));
    };

    const handleMotion = (event) => {
      if (receivedOrientation) {
        return;
      }

      const gravity = event.accelerationIncludingGravity;

      if (!gravity || typeof gravity.x !== "number" || typeof gravity.y !== "number" || typeof gravity.z !== "number") {
        return;
      }

      const verticalError = Math.abs(Math.abs(gravity.y) - 9.8) * 7;
      const sideTiltError = Math.abs(gravity.x) * 6;
      setDeviceAlignmentScore(Math.max(0, Math.min(100, Math.round(100 - verticalError - sideTiltError))));
    };

    window.addEventListener("deviceorientation", handleOrientation);
    window.addEventListener("devicemotion", handleMotion);

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
      window.removeEventListener("devicemotion", handleMotion);
    };
  }, [isCameraCapture, isSelfCapture]);

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
      window.speechSynthesis.resume?.();
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
    if (!isSelfCapture || !isReadyToCapture || !isSelfCountdownRunning) {
      return undefined;
    }

    const selfCaptureCountdownSeconds = 8;
    let remaining = selfCaptureCountdownSeconds;
    const startTimer = window.setTimeout(() => setCountdown(remaining), 0);

    const speak = (text) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        return;
      }

      window.speechSynthesis.cancel();
      window.speechSynthesis.resume?.();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    };

    speak(
      activeCapture === "front"
        ? `Front photo ready. Hold your pose. Capturing in ${selfCaptureCountdownSeconds} seconds.`
        : `Side photo ready. Hold your side pose. Capturing in ${selfCaptureCountdownSeconds} seconds.`,
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
        setIsSelfCountdownRunning(false);
      }, 250);
    }, 1000);

    return () => {
      window.clearTimeout(startTimer);
      window.clearInterval(countdownTimer);
    };
  }, [activeCapture, isReadyToCapture, isSelfCapture, isSelfCountdownRunning]);

  useEffect(() => {
    setCountdown(null);
    setIsSelfCountdownRunning(false);
  }, [activeCapture]);

  useEffect(() => {
    if (!isReadyToCapture && isSelfCountdownRunning) {
      setCountdown(null);
      setIsSelfCountdownRunning(false);
    }
  }, [isReadyToCapture, isSelfCountdownRunning]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (isCameraCapture) {
    return (
      <div className="fixed inset-0 z-50 h-[100dvh] min-h-[100dvh] overflow-hidden overscroll-none bg-black text-white">
        <video
          ref={videoRef}
          className={`h-full w-full object-cover transition-opacity ${isCameraActive ? "opacity-100" : "opacity-0"}`}
          autoPlay
          muted
          playsInline
        />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />

        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6 pb-20 pt-36">
          <div className="relative h-[min(56vh,27rem)] w-[min(54vw,15rem)]">
            <svg
              viewBox="0 0 160 420"
              className={`h-full w-full drop-shadow-[0_0_20px_rgba(0,0,0,0.35)] transition ${
                isGuideReady ? "text-emerald-400" : "text-white/62"
              }`}
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                d="M80 18c18.8 0 31.2 14.3 31.2 35.5 0 22.6-12.6 39.4-31.2 39.4S48.8 76.1 48.8 53.5C48.8 32.3 61.2 18 80 18Zm-44.4 112.2c5.2-24.6 23.4-39.6 44.4-39.6s39.2 15 44.4 39.6l11.4 54.2c2.3 11.2 7.9 21.3 15.9 29.3l-14.6 18.8c-9.6-8.7-16.3-19.6-20-32.4l-8.9-30.7-2.8 86.7 22.1 132.6h-31L80 279.2 63.5 388.7h-31l22.1-132.6-2.8-86.7-8.9 30.7c-3.7 12.8-10.4 23.7-20 32.4L8.3 213.7c8-8 13.6-18.1 15.9-29.3l11.4-54.2Z"
              />
            </svg>
            <div
              className={`absolute left-1/2 top-[49%] grid h-24 w-24 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 text-4xl font-light tabular-nums text-white backdrop-blur-[1px] transition ${
                isGuideReady ? "border-emerald-300 bg-emerald-500/20" : "border-white/55 bg-black/10"
              }`}
            >
              {centerReading}
            </div>
          </div>
        </div>

        <div className="absolute left-0 right-0 top-0 flex items-start justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={onExitCamera}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white shadow-lg ring-1 ring-white/25 backdrop-blur transition hover:bg-black/55"
            aria-label="Exit camera"
            title="Exit camera"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.42-1.41L7.83 13H20v-2Z" />
            </svg>
          </button>
          <div className="rounded-full bg-black/30 px-4 py-3 shadow-lg ring-1 ring-white/15 backdrop-blur">
            <div className="flex items-center justify-center gap-2">
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
          <span className="h-10 w-10" aria-hidden="true" />
        </div>

        {!isCameraActive && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {showCaptureButton && (
            <button
              type="button"
              onClick={() => {
                if (isSelfCapture) {
                  setIsSelfCountdownRunning(true);
                  return;
                }

                capturePhoto();
              }}
              className="flex h-20 w-20 items-center justify-center rounded-full border-[5px] border-emerald-200 bg-emerald-500 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-600"
              aria-label={`Capture ${captureLabels[activeCapture]}`}
              title={`Capture ${captureLabels[activeCapture]}`}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-emerald-700" />
            </button>
          )}
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
