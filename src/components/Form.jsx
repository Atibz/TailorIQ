import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMeasurementCapture } from "../hooks/useMeasurementCapture";
import CaptureStandingGuide from "./measurement/CaptureStandingGuide";
import CustomerDetailsFields from "./measurement/CustomerDetailsFields";
import GuidedCapturePanel from "./measurement/GuidedCapturePanel";
import ReferenceCalibrationPanel from "./measurement/ReferenceCalibrationPanel";
import { buildReferenceCalibration } from "./measurement/referenceCalibration";

const initialValues = {
  fullname: "",
  phone: "",
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

const stepContent = {
  info: {
    eyebrow: "Step 1",
    title: "Basic information",
    description: "Add the name, optional phone number, and measurement profile.",
  },
  scale: {
    eyebrow: "Step 2",
    title: "Scale anchor",
    description: "Use a known height or choose a reference object for scaling.",
  },
  photos: {
    eyebrow: "Step 4",
    title: "Front and side photos",
    description: "Add the photos using the method you chose.",
  },
  clientSetup: {
    eyebrow: "Step 4",
    title: "Set up your phone",
    description: "Place your phone where it can see your whole body before starting the guided capture.",
  },
  photoReview: {
    eyebrow: "Step 5",
    title: "Check your photos",
    description: "Review the front and side photos before analysis begins.",
  },
  captureMethod: {
    eyebrow: "Step 3",
    title: "Photo setup",
    description: "Prepare the client, then choose how to add the photos.",
  },
  reference: {
    eyebrow: "Step 5",
    title: "Reference mark",
    description: "Mark the reference object in the front photo so scale can be calculated.",
  },
  review: {
    eyebrow: "Final step",
    title: "Ready to process",
    description: "Check that each requirement is complete, then process the measurement.",
  },
};

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

function SelfCaptureSetup() {
  const steps = [
    "Place your phone upright on a table.",
    "Support it with books or an open laptop so it does not fall.",
    "Step back slowly until your whole body fits inside the guide.",
    "Wear fitted clothes and stand straight with arms relaxed.",
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-[linear-gradient(135deg,#FF9F00_0%,#F1F1F1_54%,#FFF3D6_100%)] p-5">
        <div className="relative mx-auto flex min-h-72 max-w-md items-end justify-center">
          <div className="absolute bottom-10 left-4 right-4 h-4 rounded-full bg-[#111111]/20" />
          <div className="absolute bottom-12 left-8 h-7 w-24 rounded-md bg-[#A31621] shadow-md" />
          <div className="absolute bottom-[4.75rem] left-14 h-7 w-28 rounded-md bg-[#111111] shadow-md" />
          <div className="absolute bottom-[6.5rem] left-20 h-7 w-24 rounded-md bg-[#000004] shadow-md" />
          <div className="absolute bottom-[7.7rem] left-[7.4rem] h-28 w-16 animate-[phone-tilt_3s_ease-in-out_infinite] rounded-xl border-[6px] border-[#000004] bg-[#F1F1F1] shadow-xl">
            <span className="absolute left-1/2 top-2 h-1.5 w-6 -translate-x-1/2 rounded-full bg-[#000004]/50" />
            <span className="absolute inset-x-2 bottom-3 top-5 rounded-md border border-[#111111]/30 bg-[#FF9F00]/40" />
          </div>
          <div className="absolute bottom-10 right-20 h-32 w-20 rounded-t-full bg-white/80 shadow-[0_0_0_2px_rgba(53,86,145,0.25)]" />
          <div className="absolute bottom-4 right-[6.7rem] h-16 w-6 rounded-full bg-white/80" />
          <div className="absolute bottom-4 right-[4.7rem] h-16 w-6 rounded-full bg-white/80" />
          <div className="absolute bottom-24 right-10 h-px w-24 border-t border-dashed border-[#111111]" />
          <div className="absolute bottom-28 right-8 rounded-full bg-[#111111] px-3 py-1 text-xs font-bold text-white">5-7 steps</div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-stone-950">Self capture guide</p>
          <p className="mt-1 text-sm leading-6 text-stone-600">
            The camera will speak instructions and wait until your full body is inside the guide before the timer starts.
          </p>
        </div>
        <div className="grid gap-3">
          {steps.map((step, index) => (
            <div key={step} className="flex gap-3 rounded-lg border border-stone-200 bg-white p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#111111] text-xs font-bold text-white">
                {index + 1}
              </span>
              <p className="text-sm leading-6 text-stone-700">{step}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ClientPhotoReview({ photos, onRetake }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {Object.entries({ front: "Front photo", side: "Side photo" }).map(([view, label]) => (
          <div key={view} className="overflow-hidden rounded-lg border border-stone-200 bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
              <p className="text-sm font-semibold text-stone-950">{label}</p>
              <button
                type="button"
                onClick={() => onRetake(view)}
                className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 transition hover:bg-stone-50"
              >
                Retake
              </button>
            </div>
            {photos[view]?.preview ? (
              <img className="aspect-[3/4] w-full object-cover" src={photos[view].preview} alt={`${label} preview`} />
            ) : (
              <div className="flex min-h-64 items-center justify-center bg-stone-50 px-4 text-center text-sm text-stone-500">
                No {label.toLowerCase()} yet.
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        Continue only if your head, feet, and full body shape are visible in both photos.
      </div>
    </div>
  );
}

function CaptureMethodChoice({ isClientMode, referenceObject, scaleMode, measurementProfile, onChoose }) {
  if (isClientMode) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onChoose("self-camera")}
          className="min-h-32 rounded-lg border border-amber-200 bg-amber-50 p-4 text-left transition hover:border-amber-300 hover:bg-amber-100"
        >
          <span className="text-sm font-semibold text-stone-950">Take it myself</span>
          <span className="mt-2 block text-sm leading-6 text-stone-600">
            Set the phone down, follow audio guidance, and let the timer capture front and side photos.
          </span>
        </button>
        <button
          type="button"
          onClick={() => onChoose("friend-camera")}
          className="min-h-32 rounded-lg border border-stone-200 bg-white p-4 text-left transition hover:border-amber-300 hover:bg-amber-50"
        >
          <span className="text-sm font-semibold text-stone-950">Someone is helping</span>
          <span className="mt-2 block text-sm leading-6 text-stone-600">
            Use the guided camera like tailor mode, then review the photos before analysis.
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <CaptureStandingGuide
        measurementProfile={measurementProfile}
        referenceObject={referenceObject}
        scaleMode={scaleMode}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onChoose("camera")}
          className="min-h-28 rounded-lg border border-stone-200 bg-white p-4 text-left transition hover:border-amber-300 hover:bg-amber-50"
        >
          <span className="text-sm font-semibold text-stone-950">Use camera</span>
          <span className="mt-2 block text-sm text-stone-600">Open the camera and capture the front and side views now.</span>
        </button>
        <button
          type="button"
          onClick={() => onChoose("upload")}
          className="min-h-28 rounded-lg border border-stone-200 bg-white p-4 text-left transition hover:border-amber-300 hover:bg-amber-50"
        >
          <span className="text-sm font-semibold text-stone-950">Upload photos</span>
          <span className="mt-2 block text-sm text-stone-600">Choose existing front and side photos from the device.</span>
        </button>
      </div>
    </div>
  );
}

function Form({ appMode = "tailor", initialDraft, onBack, onDraftChange, onSubmitCustomer, profileOptions = [] }) {
  const [draftId] = useState(() => initialDraft?.id || `draft-${Date.now()}-${Math.round(Math.random() * 100000)}`);
  const [values, setValues] = useState(() => ({ ...initialValues, ...(initialDraft?.values || {}) }));
  const [error, setError] = useState("");
  const [activeStep, setActiveStep] = useState("info");
  const [referenceMarker, setReferenceMarker] = useState(initialDraft?.referenceMarker || null);
  const [captureInputMode, setCaptureInputMode] = useState(initialDraft?.captureInputMode || "");
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraFeedback, setCameraFeedback] = useState("");
  const cameraAutoStartRequestedRef = useRef(false);
  const startCameraRef = useRef(null);
  const capture = useMeasurementCapture({
    initialPhotos: initialDraft?.photos,
    referenceObject: values.referenceObject,
    scaleMode: values.scaleMode,
    setValues,
    setError,
  });
  const isCameraActive = capture.isCameraActive;
  const needsHeight = values.scaleMode === "height";
  const needsReference = values.scaleMode === "reference";
  const isClientMode = appMode === "client";
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
  const stepOrder = useMemo(
    () => [
      { id: "info", label: isClientMode ? "Your info" : "Customer info", done: hasCustomerInfo },
      { id: "scale", label: "Scale anchor", done: hasScaleAnchor },
      { id: "captureMethod", label: "Photo setup", done: Boolean(captureInputMode) },
      ...(isClientMode && captureInputMode === "self-camera"
        ? [{ id: "clientSetup", label: "Phone setup", done: activeStep === "photos" || hasPhotos }]
        : []),
      { id: "photos", label: "Photos", done: hasPhotos },
      ...(isClientMode ? [{ id: "photoReview", label: "Photo review", done: hasPhotos && activeStep === "review" }] : []),
      ...(needsReference ? [{ id: "reference", label: "Reference mark", done: hasReferenceCalibration }] : []),
      { id: "review", label: isProcessing ? "Processing" : "Review", done: false },
    ],
    [activeStep, captureInputMode, hasCustomerInfo, hasPhotos, hasReferenceCalibration, hasScaleAnchor, isClientMode, isProcessing, needsReference],
  );
  const currentStep = stepOrder.some((step) => step.id === activeStep) ? activeStep : "review";
  const activeStepIndex = Math.max(stepOrder.findIndex((step) => step.id === currentStep), 0);
  const activeStepContent = stepContent[currentStep] || stepContent.info;
  const isFinalStep = currentStep === "review";
  const workflowSteps = stepOrder.map((step) => ({
    ...step,
    active: step.id === currentStep,
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

    return hasChanged || hasPhotos || hasReferenceMarker || Boolean(captureInputMode);
  }, [capture.photos.front, capture.photos.side, captureInputMode, referenceMarker, values]);

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
      captureInputMode,
    });
  }, [capture.photos, captureInputMode, draftId, hasDraftContent, initialDraft?.createdAt, onDraftChange, referenceMarker, values]);

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
        captureMethod: captureInputMode === "upload"
          ? "Uploaded photos"
          : captureInputMode === "self-camera"
            ? "Self guided camera"
            : "MediaPipe guided camera",
        pipeline: [
          captureInputMode === "upload"
            ? "Uploaded photos"
            : captureInputMode === "self-camera"
              ? "Self guided camera"
              : "Camera capture",
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

  const getStepError = (stepId) => {
    if (stepId === "info" && !values.fullname.trim()) {
      return "Full name is required.";
    }

    if (stepId === "scale") {
      if (needsHeight && !values.height) {
        return isClientMode
          ? "Enter your height, or switch to a reference object if you do not know it."
          : "Enter the customer's height, or switch to a reference object if they do not know it.";
      }

      if (needsReference && !values.referenceObject) {
        return "Choose the reference object that will appear clearly in the photos.";
      }

      if (needsReference && needsReferenceSize && !values.referenceSize) {
        return "Enter the visible size of the measuring tape.";
      }
    }

    if (stepId === "photos" && !hasPhotos) {
      return "Capture or upload both front and side photos before continuing.";
    }

    if (stepId === "captureMethod" && !captureInputMode) {
      return isClientMode ? "Choose whether you are taking the photos yourself or getting help." : "Choose whether to use the camera or upload photos.";
    }

    if (stepId === "photoReview" && !hasPhotos) {
      return "Review both front and side photos before analysis begins.";
    }

    if (stepId === "reference" && needsReference && !referenceCalibration) {
      return "Mark the reference object in the front photo so the app can calculate the scale.";
    }

    return "";
  };

  const handleNextStep = () => {
    const stepError = getStepError(currentStep);

    if (stepError) {
      setError(stepError);
      return;
    }

    setError("");
    setActiveStep(stepOrder[Math.min(activeStepIndex + 1, stepOrder.length - 1)].id);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };

  const handlePreviousStep = () => {
    setError("");
    setActiveStep(stepOrder[Math.max(activeStepIndex - 1, 0)].id);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };

  const handleChooseCaptureMethod = (mode) => {
    setCaptureInputMode(mode);
    setCameraFeedback("");
    setError("");
    setActiveStep(isClientMode && mode === "self-camera" ? "clientSetup" : "photos");
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };

  useEffect(() => {
    startCameraRef.current = capture.startCamera;
  }, [capture.startCamera]);

  useEffect(() => {
    if (currentStep !== "photos" || !["camera", "self-camera", "friend-camera"].includes(captureInputMode)) {
      cameraAutoStartRequestedRef.current = false;
      return undefined;
    }

    if (cameraAutoStartRequestedRef.current || isCameraActive) {
      return undefined;
    }

    cameraAutoStartRequestedRef.current = true;
    const startTimer = window.setTimeout(() => {
      startCameraRef.current?.();
    }, 120);

    return () => window.clearTimeout(startTimer);
  }, [captureInputMode, currentStep, isCameraActive]);

  const movePastPhotoStep = () => {
    const photoStepIndex = stepOrder.findIndex((step) => step.id === "photos");
    const nextStep = stepOrder[Math.min(photoStepIndex + 1, stepOrder.length - 1)];

    setActiveStep(nextStep.id);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };

  const handleCameraCapture = () => {
    const capturedView = capture.activeCapture;
    const shouldAdvanceAfterCapture =
      capturedView === "side" &&
      capture.allGuidelinesPassed &&
      capture.videoRef.current?.readyState >= 2;
    const shouldShowSuccess =
      capture.allGuidelinesPassed &&
      capture.videoRef.current?.readyState >= 2;

    capture.capturePhoto();

    if (shouldShowSuccess) {
      setCameraFeedback(
        capturedView === "front" && captureInputMode === "self-camera"
          ? "Front saved. Turn to your side."
          : `${capturedView === "front" ? "Front" : "Side"} view saved`,
      );
      window.setTimeout(() => setCameraFeedback(""), 900);
    }

    if (shouldAdvanceAfterCapture) {
      setTimeout(() => {
        setError("");
        capture.stopCamera();
        movePastPhotoStep();
      }, 650);
    }
  };

  const handleExitCamera = () => {
    capture.stopCamera();
    setCameraFeedback("");
    setError("");
    setActiveStep("captureMethod");
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };

  const handleRetakePhoto = (view) => {
    if (view === "front") {
      setReferenceMarker(null);
    }

    capture.retakePhoto(view);
    if (isClientMode) {
      setActiveStep("photos");
    }
  };

  const handleBack = () => {
    saveDraft();
    onBack?.();
  };

  return (
    <section>
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
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-stone-300 bg-white text-stone-700 transition hover:bg-stone-50"
            aria-label={isClientMode ? "Back to home" : "Back to dashboard"}
            title={isClientMode ? "Back to home" : "Back to dashboard"}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.42-1.41L7.83 13H20v-2Z" />
            </svg>
          </button>
        )}
        <div>
          <p className="text-sm font-medium text-amber-700">{activeStepContent.eyebrow}</p>
          <h2 className="mt-2 text-2xl font-semibold text-stone-950">
            {activeStepContent.title}
          </h2>
          <p className="mt-2 text-sm text-stone-500">
            {activeStepContent.description}
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

        {currentStep === "info" && (
          <div className="grid gap-5 md:grid-cols-2">
            <CustomerDetailsFields
              isClientMode={isClientMode}
              section="info"
              values={values}
              profileOptions={profileOptions}
              onChange={handleChanges}
            />
          </div>
        )}

        {currentStep === "scale" && (
          <div className="grid gap-5">
            <CustomerDetailsFields
              isClientMode={isClientMode}
              section="scale"
              values={values}
              profileOptions={profileOptions}
              onChange={handleChanges}
            />
          </div>
        )}

        {currentStep === "captureMethod" && (
          <CaptureMethodChoice
            isClientMode={isClientMode}
            measurementProfile={values.measurementProfile}
            referenceObject={values.referenceObject}
            scaleMode={values.scaleMode}
            onChoose={handleChooseCaptureMethod}
          />
        )}

        {currentStep === "clientSetup" && (
          <SelfCaptureSetup />
        )}

        {currentStep === "photos" && (
          <GuidedCapturePanel
            activeCapture={capture.activeCapture}
            allGuidelinesPassed={capture.allGuidelinesPassed}
            canvasRef={capture.canvasRef}
            cameraFeedback={cameraFeedback}
            capturePhoto={handleCameraCapture}
            guidelineLabels={capture.guidelineLabels}
            guidelines={capture.guidelines}
            isCameraActive={capture.isCameraActive}
            onExitCamera={handleExitCamera}
            onUploadPhoto={capture.handleUploadPhoto}
            photos={capture.photos}
            poseMessage={capture.poseMessage}
            poseStatus={capture.poseStatus}
            retakePhoto={handleRetakePhoto}
            startCamera={capture.startCamera}
            uploadStatus={capture.uploadStatus}
            videoRef={capture.videoRef}
            inputMode={["camera", "self-camera", "friend-camera"].includes(captureInputMode) ? "camera" : captureInputMode}
            captureMode={captureInputMode === "self-camera" ? "self" : "assisted"}
          />
        )}

        {currentStep === "photoReview" && (
          <ClientPhotoReview photos={capture.photos} onRetake={handleRetakePhoto} />
        )}

        {currentStep === "reference" && values.scaleMode === "reference" && (
          <ReferenceCalibrationPanel
            marker={referenceMarker}
            onChange={setReferenceMarker}
            photo={capture.photos.front}
            referenceObject={values.referenceObject}
            referenceSize={values.referenceSize}
            referenceUnit={values.referenceUnit}
          />
        )}

        {currentStep === "review" && (
          <div className="space-y-3">
          <CompletionStatus items={completionItems} />
          {isProcessing && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold text-stone-950">Processing photos...</p>
              <p className="mt-1">Uploading views, running segmentation, estimating measurements, and preparing review.</p>
            </div>
          )}
          </div>
        )}

        <div className="border-t border-stone-100 pt-5">
          <div className={`grid gap-3 ${currentStep === "captureMethod" ? "grid-cols-1" : "grid-cols-2"}`}>
            <button
              type="button"
              onClick={handlePreviousStep}
              disabled={activeStepIndex === 0 || isProcessing}
              className="min-h-11 rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-400"
            >
              Previous
            </button>
            {isFinalStep || (isClientMode && currentStep === "photoReview") ? (
              <button
                type="submit"
                disabled={!canProcessMeasurement}
                className="min-h-11 rounded-md bg-amber-600 px-5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-stone-400"
              >
                {isProcessing ? "Processing..." : isClientMode && currentStep === "photoReview" ? "Analyze measurements" : "Process measurement"}
              </button>
            ) : currentStep === "captureMethod" ? null : (
              <button
                type="button"
                onClick={handleNextStep}
                disabled={isProcessing}
                className="min-h-11 rounded-md bg-amber-600 px-5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-stone-400"
              >
                Continue
              </button>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}

export default Form;


