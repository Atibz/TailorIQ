import React from "react";
import CapturePreviewCards from "./CapturePreviewCards";
import CaptureStandingGuide from "./CaptureStandingGuide";
import { captureLabels } from "./constants";
import GuidelineChecklist from "./GuidelineChecklist";
import PhotoUploadPanel from "./PhotoUploadPanel";

function GuidedCapturePanel({
  activeCapture,
  allGuidelinesPassed,
  canvasRef,
  capturePhoto,
  guidelineLabels,
  guidelines,
  measurementProfile,
  onUploadPhoto,
  photos,
  poseMessage,
  poseStatus,
  referenceObject,
  retakePhoto,
  scaleMode,
  startCamera,
  uploadStatus,
  videoRef,
  inputMode,
  onInputModeChange,
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-stone-950">Photo capture</p>
          <p className="mt-1 text-sm text-stone-500">
            Wear fitted clothing for best results. Use the camera or upload clear front and side photos.
          </p>
        </div>
        <span className="rounded-md bg-white px-3 py-1 text-xs font-medium text-amber-700">
          Front + side required
        </span>
      </div>

      <div className="mt-4">
        <CaptureStandingGuide
          measurementProfile={measurementProfile}
          referenceObject={referenceObject}
          scaleMode={scaleMode}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-md border border-stone-300 bg-white p-1">
        {[
          { id: "camera", label: "Use camera" },
          { id: "upload", label: "Upload photos" },
        ].map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => onInputModeChange(mode.id)}
            className={`min-h-10 rounded px-3 text-sm font-semibold transition ${
              inputMode === mode.id
                ? "bg-stone-950 text-white"
                : "text-stone-700 hover:bg-stone-100"
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {inputMode === "camera" ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="overflow-hidden rounded-lg bg-stone-950">
            <div className="relative aspect-[3/4] w-full sm:aspect-video">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                autoPlay
                muted
                playsInline
              />
              <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
              <div className="pointer-events-none absolute inset-4 rounded-[45%] border-2 border-dashed border-amber-300" />
              <div className="pointer-events-none absolute left-1/2 top-4 h-[calc(100%-2rem)] w-px -translate-x-1/2 bg-white/30" />
              <div className="absolute bottom-3 left-3">
                <span className="rounded-md bg-black/70 px-3 py-2 text-xs font-medium text-white">
                  Capturing: {captureLabels[activeCapture]}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2 border-t border-white/10 p-3 sm:flex-row">
              <button
                type="button"
                onClick={startCamera}
                className="min-h-10 rounded-md bg-white px-4 text-sm font-semibold text-stone-950 transition hover:bg-stone-100"
              >
                Start camera
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                disabled={!allGuidelinesPassed}
                className="min-h-10 rounded-md bg-amber-600 px-4 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-stone-500"
              >
                Capture {captureLabels[activeCapture]}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <GuidelineChecklist
              guidelineLabels={guidelineLabels}
              guidelines={guidelines}
              poseMessage={poseMessage}
              poseStatus={poseStatus}
            />
            <CapturePreviewCards photos={photos} onRetake={retakePhoto} />
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
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
      )}
    </div>
  );
}

export default GuidedCapturePanel;
