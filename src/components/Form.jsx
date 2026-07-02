import React, { useCallback, useEffect, useState } from "react";
import { useMeasurementCapture } from "../hooks/useMeasurementCapture";
import CustomerDetailsFields from "./measurement/CustomerDetailsFields";
import GuidedCapturePanel from "./measurement/GuidedCapturePanel";
import ReferenceCalibrationPanel from "./measurement/ReferenceCalibrationPanel";
import { buildReferenceCalibration } from "./measurement/referenceCalibration";

const initialValues = {
  fullname: "",
  height: "",
  heightUnit: "cm",
  scaleMode: "height",
  referenceObject: "a4-paper",
  referenceSize: "",
  referenceUnit: "cm",
  measurementProfile: "male",
  captureQuality: 0,
};

function WorkflowProgress({ steps }) {
  return (
    <div className="sticky top-0 z-20 -mx-5 border-y border-stone-200 bg-white/95 px-5 py-3 backdrop-blur">
      <div className="flex gap-2 overflow-x-auto">
        {steps.map((step, index) => (
          <div
            key={step.label}
            className={`flex min-w-[10rem] items-center gap-3 rounded-md border px-3 py-2 text-sm ${
              step.done
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : step.active
                  ? "border-amber-300 bg-amber-50 text-amber-900"
                  : "border-stone-200 bg-stone-50 text-stone-500"
            }`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                step.done
                  ? "bg-emerald-600 text-white"
                  : step.active
                    ? "bg-amber-500 text-stone-950"
                    : "bg-stone-200 text-stone-600"
              }`}
            >
              {step.done ? "OK" : index + 1}
            </span>
            <span className="font-semibold">{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompletionStatus({ items }) {
  return (
    <div className="grid gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.done ? "bg-emerald-500" : "bg-stone-300"}`} />
          <span className={item.done ? "font-medium text-stone-800" : "text-stone-500"}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function Form({ initialDraft, onBack, onClearDraft, onDraftChange, onSubmitCustomer, profileOptions = [] }) {
  const [draftId] = useState(() => initialDraft?.id || `draft-${Date.now()}-${Math.round(Math.random() * 100000)}`);
  const [values, setValues] = useState(() => ({ ...initialValues, ...(initialDraft?.values || {}) }));
  const [error, setError] = useState("");
  const [referenceMarker, setReferenceMarker] = useState(initialDraft?.referenceMarker || null);
  const [captureInputMode, setCaptureInputMode] = useState("camera");
  const [isProcessing, setIsProcessing] = useState(false);
  const capture = useMeasurementCapture({
    initialPhotos: initialDraft?.photos,
    referenceObject: values.referenceObject,
    scaleMode: values.scaleMode,
    setValues,
    setError,
  });
  const needsHeight = values.scaleMode === "height";
  const needsReference = values.scaleMode === "reference";
  const needsReferenceSize = values.referenceObject === "measuring-tape";
  const hasCustomerInfo = Boolean(values.fullname.trim());
  const hasScaleAnchor = needsHeight
    ? Boolean(values.height)
    : Boolean(values.referenceObject && (!needsReferenceSize || values.referenceSize));
  const hasFrontPhoto = Boolean(capture.photos.front?.preview);
  const hasSidePhoto = Boolean(capture.photos.side?.preview);
  const hasPhotos = hasFrontPhoto && hasSidePhoto;
  const referenceCalibration = needsReference
    ? buildReferenceCalibration({
        marker: referenceMarker,
        photo: capture.photos.front,
        referenceObject: values.referenceObject,
        referenceSize: values.referenceSize,
        referenceUnit: values.referenceUnit,
      })
    : null;
  const hasReferenceCalibration = !needsReference || Boolean(referenceCalibration);
  const canProcessMeasurement = hasCustomerInfo && hasScaleAnchor && hasPhotos && hasReferenceCalibration && !isProcessing;
  const workflowSteps = [
    { label: "Customer info", done: hasCustomerInfo },
    { label: "Scale anchor", done: hasScaleAnchor },
    { label: "Photos", done: hasPhotos },
    ...(needsReference ? [{ label: "Reference mark", done: hasReferenceCalibration }] : []),
    { label: isProcessing ? "Processing" : "Review", done: false },
  ].map((step, index, steps) => ({
    ...step,
    active: !step.done && steps.slice(0, index).every((previousStep) => previousStep.done),
  }));
  const completionItems = [
    { label: hasCustomerInfo ? "Customer ready" : "Customer name needed", done: hasCustomerInfo },
    { label: hasScaleAnchor ? "Scale ready" : "Scale anchor needed", done: hasScaleAnchor },
    { label: hasFrontPhoto ? "Front view ready" : "Front view needed", done: hasFrontPhoto },
    { label: hasSidePhoto ? "Side view ready" : "Side view needed", done: hasSidePhoto },
    ...(needsReference
      ? [{ label: hasReferenceCalibration ? "Reference marked" : "Reference mark needed", done: hasReferenceCalibration }]
      : []),
  ];

  const hasDraftContent = useCallback(() => {
    const hasChanged = JSON.stringify(values) !== JSON.stringify(initialValues);
    const hasPhotos = Boolean(capture.photos.front || capture.photos.side);
    const hasReferenceMarker = Boolean(referenceMarker);

    return hasChanged || hasPhotos || hasReferenceMarker;
  }, [capture.photos.front, capture.photos.side, referenceMarker, values]);

  const saveDraft = useCallback(() => {
    if (!hasDraftContent()) {
      return;
    }

    onDraftChange?.({
      id: draftId,
      stage: "capture",
      createdAt: initialDraft?.createdAt,
      updatedAt: new Date().toISOString(),
      values,
      photos: capture.photos,
      referenceMarker,
    });
  }, [capture.photos, draftId, hasDraftContent, initialDraft?.createdAt, onDraftChange, referenceMarker, values]);

  useEffect(() => {
    saveDraft();
  }, [saveDraft]);

  const handleChanges = (event) => {
    const nextValues = { ...values, [event.target.name]: event.target.value };

    setValues(nextValues);
    if (["referenceObject", "referenceSize", "referenceUnit", "scaleMode"].includes(event.target.name)) {
      setReferenceMarker(null);
    }
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isProcessing) {
      return;
    }

    if (!values.fullname.trim()) {
      setError("Full name is required.");
      return;
    }

    if (needsHeight && !values.height) {
      setError("Enter the customer's height, or switch to a reference object if they do not know it.");
      return;
    }

    if (needsReference && !values.referenceObject) {
      setError("Choose the reference object that will appear clearly in the photos.");
      return;
    }

    if (needsReference && needsReferenceSize && !values.referenceSize) {
      setError("Enter the visible size of the measuring tape.");
      return;
    }

    if (!capture.photos.front || !capture.photos.side) {
      setError("Capture clear front and side photos so the measurement can be pose-assisted.");
      return;
    }

    if (!capture.photos.front?.preview || !capture.photos.side?.preview) {
      setError("Front and side image previews are missing. Retake or re-upload both photos.");
      return;
    }

    if (needsReference && !referenceCalibration) {
      setError("Mark the reference object in the front photo so the app can calculate the scale.");
      return;
    }

    try {
      setIsProcessing(true);
      setError("");
      await onSubmitCustomer({
        ...values,
        fullname: values.fullname.trim(),
        referenceCalibration,
        referenceCalibratedHeightCm: referenceCalibration?.calibratedHeightCm || "",
        photoViews: [
          { view: "Front view", fileName: capture.photos.front?.fileName },
          { view: "Side view", fileName: capture.photos.side?.fileName },
        ],
        poseMetrics: {
          front: capture.photos.front?.poseMetrics,
          side: capture.photos.side?.poseMetrics,
        },
        segmentationImages: {
          front: capture.photos.front?.preview,
          side: capture.photos.side?.preview,
        },
        captureMethod: "MediaPipe guided camera",
        pipeline: [
          "Camera or upload",
          "Guideline checks",
          "MediaPipe Pose",
          needsReference ? "Reference calibration" : "Scale anchor",
          "Backend segmentation",
        ],
      });
    } catch (submitError) {
      setIsProcessing(false);
      setError(submitError.message || "Backend segmentation failed. Check the backend and try again.");
    }
  };

  const handleReset = () => {
    setValues(initialValues);
    capture.resetCapture();
    setReferenceMarker(null);
    setIsProcessing(false);
    setError("");
    onClearDraft?.();
  };

  const handleRetakePhoto = (view) => {
    if (view === "front") {
      setReferenceMarker(null);
    }

    capture.retakePhoto(view);
  };

  const handleBack = () => {
    saveDraft();
    onBack?.();
  };

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      {error && (
        <div
          className="fixed bottom-4 left-4 right-4 z-50 rounded-lg border border-red-200 bg-red-50 p-4 pr-12 text-sm font-medium text-red-800 shadow-lg sm:left-auto sm:max-w-md"
          role="alert"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Needs attention</p>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            onClick={() => setError("")}
            className="absolute right-3 top-3 rounded-md px-2 py-1 text-sm font-bold text-red-700 transition hover:bg-red-100"
            aria-label="Dismiss error"
          >
            x
          </button>
        </div>
      )}

      <div className="space-y-4 border-b border-stone-100 pb-5">
        {onBack && (
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.42-1.41L7.83 13H20v-2Z" />
            </svg>
            Back to dashboard
          </button>
        )}
        <div>
          <p className="text-sm font-medium text-amber-700">New measurement</p>
          <h2 className="mt-2 text-2xl font-semibold text-stone-950">Customer information</h2>
          <p className="mt-2 text-sm text-stone-500">
            Use a known height when available. If not, choose a safe reference object and capture front and side photos.
          </p>
        </div>
      </div>

      <WorkflowProgress steps={workflowSteps} />

      <form className="mt-5 space-y-5" onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <CustomerDetailsFields values={values} profileOptions={profileOptions} onChange={handleChanges} />

        <GuidedCapturePanel
          activeCapture={capture.activeCapture}
          allGuidelinesPassed={capture.allGuidelinesPassed}
          canvasRef={capture.canvasRef}
          capturePhoto={capture.capturePhoto}
          guidelineLabels={capture.guidelineLabels}
          guidelines={capture.guidelines}
          measurementProfile={values.measurementProfile}
          onUploadPhoto={capture.handleUploadPhoto}
          photos={capture.photos}
          poseMessage={capture.poseMessage}
          poseStatus={capture.poseStatus}
          referenceObject={values.referenceObject}
          retakePhoto={handleRetakePhoto}
          scaleMode={values.scaleMode}
          startCamera={capture.startCamera}
          uploadStatus={capture.uploadStatus}
          videoRef={capture.videoRef}
          inputMode={captureInputMode}
          onInputModeChange={setCaptureInputMode}
        />

        {values.scaleMode === "reference" && (
          <ReferenceCalibrationPanel
            marker={referenceMarker}
            onChange={setReferenceMarker}
            photo={capture.photos.front}
            referenceObject={values.referenceObject}
            referenceSize={values.referenceSize}
            referenceUnit={values.referenceUnit}
          />
        )}

        <div className="space-y-3 border-t border-stone-100 pt-5">
          <CompletionStatus items={completionItems} />
          {isProcessing && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold text-stone-950">Processing photos...</p>
              <p className="mt-1">Uploading views, running segmentation, estimating measurements, and preparing review.</p>
            </div>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleReset}
              disabled={isProcessing}
              className="min-h-11 rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-400"
            >
              Clear
            </button>
            <button
              type="submit"
              disabled={!canProcessMeasurement}
              className="min-h-11 rounded-md bg-amber-600 px-5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-stone-400"
            >
              {isProcessing ? "Processing..." : "Process measurement"}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

export default Form;
