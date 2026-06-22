import React, { useEffect, useRef, useState } from "react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

const initialValues = {
  fullname: "",
  weight: "",
  height: "",
  heightUnit: "cm",
  captureQuality: 0,
};

const guidelineLabels = {
  fullBody: "Full body is visible",
  centered: "Body is centered in the frame",
  upright: "Camera is straight and level",
  armsClear: "Arms are slightly away from body",
  lighting: "Lighting is clear",
  contrast: "Image contrast is usable",
  sharpness: "Image is not blurry",
};

const emptyGuidelines = Object.keys(guidelineLabels).reduce(
  (checks, key) => ({ ...checks, [key]: false }),
  {},
);

const emptyPhotos = {
  front: null,
  side: null,
};

const captureLabels = {
  front: "Front view",
  side: "Side view",
};

const fieldClass =
  "min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-amber-600 focus:ring-4 focus:ring-amber-100";

const labelClass = "text-sm font-medium text-stone-700";

const requiredLandmarks = [0, 11, 12, 23, 24, 25, 26, 27, 28];

function isVisible(landmark, threshold = 0.55) {
  return Boolean(landmark) && (landmark.visibility ?? 0) >= threshold;
}

function distanceBetween(first, second) {
  if (!first || !second) {
    return 0;
  }

  return Math.hypot(first.x - second.x, first.y - second.y);
}

function midpoint(first, second) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

function extractPoseMetrics(landmarks, frameMetrics) {
  if (!landmarks?.length) {
    return null;
  }

  const nose = landmarks[0];
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftElbow = landmarks[13];
  const rightElbow = landmarks[14];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const topY = Math.min(nose.y, leftShoulder.y, rightShoulder.y);
  const bottomY = Math.max(leftAnkle.y, rightAnkle.y);
  const bodyHeight = Math.max(bottomY - topY, 0.01);
  const shoulderCenter = midpoint(leftShoulder, rightShoulder);
  const hipCenter = midpoint(leftHip, rightHip);
  const ankleCenter = midpoint(leftAnkle, rightAnkle);
  const leftArm = distanceBetween(leftShoulder, leftElbow) + distanceBetween(leftElbow, leftWrist);
  const rightArm = distanceBetween(rightShoulder, rightElbow) + distanceBetween(rightElbow, rightWrist);
  const leftLeg = distanceBetween(leftHip, leftKnee) + distanceBetween(leftKnee, leftAnkle);
  const rightLeg = distanceBetween(rightHip, rightKnee) + distanceBetween(rightKnee, rightAnkle);

  return {
    bodyHeightRatio: bodyHeight,
    shoulderWidthRatio: Math.abs(rightShoulder.x - leftShoulder.x) / bodyHeight,
    hipWidthRatio: Math.abs(rightHip.x - leftHip.x) / bodyHeight,
    torsoLengthRatio: distanceBetween(shoulderCenter, hipCenter) / bodyHeight,
    sleeveLengthRatio: ((leftArm + rightArm) / 2) / bodyHeight,
    trouserLengthRatio: distanceBetween(hipCenter, ankleCenter) / bodyHeight,
    inseamRatio: ((leftLeg + rightLeg) / 2) / bodyHeight,
    frameMetrics: {
      brightness: Math.round(frameMetrics.brightness),
      contrast: Math.round(frameMetrics.contrast),
      edgeDensity: Number(frameMetrics.edgeDensity.toFixed(3)),
      sharpness: Math.round(frameMetrics.sharpness),
    },
  };
}

async function getOpenCv() {
  const { default: cvModule } = await import("@techstark/opencv-js");

  if (cvModule instanceof Promise) {
    return cvModule;
  }

  if (cvModule.Mat) {
    return cvModule;
  }

  await new Promise((resolve) => {
    cvModule.onRuntimeInitialized = resolve;
  });

  return cvModule;
}

let openCvLoadPromise = null;

function loadOpenCvModule() {
  if (!openCvLoadPromise) {
    openCvLoadPromise = getOpenCv().catch((error) => {
      openCvLoadPromise = null;
      throw error;
    });
  }

  return openCvLoadPromise;
}

function withTimeout(promise, milliseconds, errorMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(errorMessage)), milliseconds);
    }),
  ]);
}

function getCanvasImageData(video, width = 160, height = 120) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(video, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
}

function preprocessFrameWithCanvas(video) {
  const imageData = getCanvasImageData(video, 120, 90);
  const data = imageData.data;
  let total = 0;
  let edgeTotal = 0;
  const samples = [];

  for (let index = 0; index < data.length; index += 4) {
    const value = (data[index] + data[index + 1] + data[index + 2]) / 3;
    samples.push(value);
    total += value;

    if (index >= 4) {
      edgeTotal += Math.abs(value - samples[samples.length - 2]);
    }
  }

  const brightness = total / samples.length;
  const variance =
    samples.reduce((sum, value) => sum + (value - brightness) ** 2, 0) / samples.length;
  const contrast = Math.sqrt(variance);
  const sharpness = edgeTotal / samples.length;

  return {
    brightness,
    contrast,
    sharpness,
    edgeDensity: sharpness / 255,
    lighting: brightness > 55 && brightness < 215,
    contrastOk: contrast > 18,
    sharpnessOk: sharpness > 5,
  };
}

function preprocessFrame(video, cv) {
  if (!cv) {
    return preprocessFrameWithCanvas(video);
  }

  const imageData = getCanvasImageData(video);
  const source = cv.matFromImageData(imageData);
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const laplacian = new cv.Mat();
  const edges = new cv.Mat();
  const mean = new cv.Mat();
  const stddev = new cv.Mat();

  try {
    cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(3, 3), 0);
    cv.meanStdDev(gray, mean, stddev);
    cv.Laplacian(blurred, laplacian, cv.CV_64F);
    cv.Canny(blurred, edges, 50, 120);

    const brightness = mean.doubleAt(0, 0);
    const contrast = stddev.doubleAt(0, 0);
    cv.meanStdDev(laplacian, mean, stddev);
    const sharpness = stddev.doubleAt(0, 0);
    const edgeDensity = cv.countNonZero(edges) / (edges.rows * edges.cols);

    return {
      brightness,
      contrast,
      sharpness,
      edgeDensity,
      lighting: brightness > 55 && brightness < 215,
      contrastOk: contrast > 24,
      sharpnessOk: stddev.doubleAt(0, 0) > 6 && edgeDensity > 0.015,
    };
  } finally {
    source.delete();
    gray.delete();
    blurred.delete();
    laplacian.delete();
    edges.delete();
    mean.delete();
    stddev.delete();
  }
}

function analyzePose(landmarks, frameMetrics) {
  const frameChecks = {
    lighting: frameMetrics.lighting,
    contrast: frameMetrics.contrastOk,
    sharpness: frameMetrics.sharpnessOk,
  };

  if (!landmarks?.length) {
    return {
      checks: { ...emptyGuidelines, ...frameChecks },
      message: "Step back until your full body appears in the guide",
      score: 0,
    };
  }

  const visibleRequired = requiredLandmarks.every((index) => isVisible(landmarks[index]));
  const nose = landmarks[0];
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];

  const topY = Math.min(nose?.y ?? 1, leftShoulder?.y ?? 1, rightShoulder?.y ?? 1);
  const bottomY = Math.max(leftAnkle?.y ?? 0, rightAnkle?.y ?? 0);
  const leftX = Math.min(leftShoulder?.x ?? 1, leftHip?.x ?? 1, leftAnkle?.x ?? 1);
  const rightX = Math.max(rightShoulder?.x ?? 0, rightHip?.x ?? 0, rightAnkle?.x ?? 0);
  const centerX = (leftShoulder.x + rightShoulder.x + leftHip.x + rightHip.x) / 4;
  const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y);
  const hipTilt = Math.abs(leftHip.y - rightHip.y);
  const bodyWidth = Math.abs(rightShoulder.x - leftShoulder.x);

  const checks = {
    fullBody:
      visibleRequired &&
      topY > 0.02 &&
      bottomY < 0.98 &&
      leftX > 0.03 &&
      rightX < 0.97,
    centered: centerX > 0.38 && centerX < 0.62,
    upright: shoulderTilt < 0.045 && hipTilt < 0.055,
    armsClear:
      isVisible(leftWrist, 0.45) &&
      isVisible(rightWrist, 0.45) &&
      leftWrist.x < leftShoulder.x - bodyWidth * 0.12 &&
      rightWrist.x > rightShoulder.x + bodyWidth * 0.12,
    ...frameChecks,
  };

  const failedKey = Object.keys(checks).find((key) => !checks[key]);
  const score = Object.values(checks).filter(Boolean).length;

  return {
    checks,
    message: failedKey ? guidelineLabels[failedKey] : "Ready to capture",
    score,
  };
}

function drawPose(canvas, video, landmarks) {
  if (!canvas || !video) {
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);

  if (!landmarks?.length) {
    return;
  }

  const connections = [
    [11, 12],
    [11, 23],
    [12, 24],
    [23, 24],
    [11, 13],
    [13, 15],
    [12, 14],
    [14, 16],
    [23, 25],
    [25, 27],
    [24, 26],
    [26, 28],
  ];

  context.lineWidth = 4;
  context.strokeStyle = "#fbbf24";
  connections.forEach(([start, end]) => {
    const first = landmarks[start];
    const second = landmarks[end];

    if (!isVisible(first, 0.4) || !isVisible(second, 0.4)) {
      return;
    }

    context.beginPath();
    context.moveTo(first.x * canvas.width, first.y * canvas.height);
    context.lineTo(second.x * canvas.width, second.y * canvas.height);
    context.stroke();
  });

  context.fillStyle = "#ffffff";
  landmarks.forEach((landmark) => {
    if (!isVisible(landmark, 0.45)) {
      return;
    }

    context.beginPath();
    context.arc(landmark.x * canvas.width, landmark.y * canvas.height, 5, 0, Math.PI * 2);
    context.fill();
  });
}

const Form = ({ onSubmitCustomer }) => {
  const [values, setValues] = useState(initialValues);
  const [photos, setPhotos] = useState(emptyPhotos);
  const [activeCapture, setActiveCapture] = useState("front");
  const [guidelines, setGuidelines] = useState(emptyGuidelines);
  const [cameraStatus, setCameraStatus] = useState("Camera is off");
  const [openCvStatus, setOpenCvStatus] = useState("OpenCV not loaded");
  const [poseStatus, setPoseStatus] = useState("Pose model not loaded");
  const [poseMessage, setPoseMessage] = useState("Start the camera to begin automatic checks");
  const [error, setError] = useState("");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const openCvRef = useRef(null);
  const poseLandmarkerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const latestPoseMetricsRef = useRef(null);

  const allGuidelinesPassed = Object.values(guidelines).every(Boolean);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
      poseLandmarkerRef.current?.close();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const preloadOpenCv = async () => {
      setOpenCvStatus("Preloading OpenCV");

      try {
        const cv = await withTimeout(loadOpenCvModule(), 10000, "OpenCV preload timed out");

        if (!cancelled) {
          openCvRef.current = cv;
          setOpenCvStatus("OpenCV ready");
        }
      } catch {
        if (!cancelled) {
          openCvRef.current = null;
          setOpenCvStatus("Using fallback frame checks");
        }
      }
    };

    preloadOpenCv();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleChanges = (e) => {
    setValues({ ...values, [e.target.name]: e.target.value });
    setError("");
  };

  const loadPoseLandmarker = async () => {
    if (poseLandmarkerRef.current) {
      return poseLandmarkerRef.current;
    }

    setPoseStatus("Loading MediaPipe Pose");
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
    );

    poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.6,
      minPosePresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });

    setPoseStatus("MediaPipe Pose ready");
    return poseLandmarkerRef.current;
  };

  const loadOpenCv = async () => {
    if (openCvRef.current) {
      return openCvRef.current;
    }

    setOpenCvStatus("Loading OpenCV");
    try {
      openCvRef.current = await withTimeout(loadOpenCvModule(), 7000, "OpenCV loading timed out");
      setOpenCvStatus("OpenCV ready");
      return openCvRef.current;
    } catch {
      openCvRef.current = null;
      setOpenCvStatus("Using fallback frame checks");
      return null;
    }
  };

  const detectPose = async () => {
    const video = videoRef.current;
    const poseLandmarker = poseLandmarkerRef.current;

    if (!video || video.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(detectPose);
      return;
    }

    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const result = poseLandmarker?.detectForVideo(video, video.currentTime * 1000);
      const landmarks = result?.landmarks?.[0];
      const frameMetrics = preprocessFrame(video, openCvRef.current);
      const analysis = analyzePose(landmarks, frameMetrics);

      latestPoseMetricsRef.current = extractPoseMetrics(landmarks, frameMetrics);
      setGuidelines(analysis.checks);
      setPoseMessage(analysis.message);
      setValues((currentValues) => ({
        ...currentValues,
        captureQuality: analysis.score,
      }));
      drawPose(canvasRef.current, video, landmarks);
    }

    animationFrameRef.current = requestAnimationFrame(detectPose);
  };

  const startCamera = async () => {
    setError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("Camera is not available in this browser");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraStatus("Camera ready");
      setOpenCvStatus(openCvRef.current ? "OpenCV ready" : "Loading OpenCV in background");
      setPoseStatus("Loading MediaPipe Pose in background");
      setPoseMessage("Camera is open. Vision checks are loading.");

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      animationFrameRef.current = requestAnimationFrame(detectPose);

      const [openCvResult, poseResult] = await Promise.allSettled([
        loadOpenCv(),
        withTimeout(loadPoseLandmarker(), 12000, "MediaPipe loading timed out"),
      ]);

      if (openCvResult.status === "fulfilled") {
        openCvRef.current = openCvResult.value;
      }

      if (poseResult.status === "fulfilled") {
        poseLandmarkerRef.current = poseResult.value;
        setPoseMessage("Move into the guide so the pose model can validate the frame");
      } else {
        setPoseStatus("Pose model could not load");
        setPoseMessage("Camera is open, but pose checks could not load. Check internet access.");
      }
    } catch {
      setCameraStatus("Allow camera access in your browser");
    }
  };

  const capturePhoto = () => {
    if (!allGuidelinesPassed) {
      setError(`Cannot capture yet: ${poseMessage}.`);
      return;
    }

    if (!videoRef.current || videoRef.current.readyState < 2) {
      setError("Start the camera and wait for the preview before capturing.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const context = canvas.getContext("2d");
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    setPhotos({
      ...photos,
      [activeCapture]: {
        view: captureLabels[activeCapture],
        fileName: `${captureLabels[activeCapture]} MediaPipe capture`,
        preview: canvas.toDataURL("image/jpeg", 0.88),
        poseMetrics: latestPoseMetricsRef.current,
      },
    });

    if (activeCapture === "front") {
      setActiveCapture("side");
    }
  };

  const retakePhoto = (view) => {
    setPhotos({ ...photos, [view]: null });
    setActiveCapture(view);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!values.fullname.trim() || !values.height || !values.weight) {
      setError("Full name, height, and weight are required to process a measurement.");
      return;
    }

    if (!photos.front || !photos.side) {
      setError("Capture clear front and side photos so the measurement can be pose-assisted.");
      return;
    }

    onSubmitCustomer({
      ...values,
      fullname: values.fullname.trim(),
      photoViews: [
        { view: "Front view", fileName: photos.front?.fileName },
        { view: "Side view", fileName: photos.side?.fileName },
      ],
      poseMetrics: {
        front: photos.front?.poseMetrics,
        side: photos.side?.poseMetrics,
      },
      captureMethod: "MediaPipe guided camera",
      pipeline: ["Camera", "OpenCV preprocessing", "MediaPipe Pose", "Measurement formulas", "AI adjustment"],
    });
  };

  const handleReset = () => {
    setValues(initialValues);
    setPhotos(emptyPhotos);
    setGuidelines(emptyGuidelines);
    setActiveCapture("front");
    setPoseMessage("Start the camera to begin automatic checks");
    setError("");
  };

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <div className="border-b border-stone-100 pb-5">
        <p className="text-sm font-medium text-amber-700">New measurement</p>
        <h2 className="mt-2 text-2xl font-semibold text-stone-950">Customer information</h2>
        <p className="mt-2 text-sm text-stone-500">Enter height and weight, then capture front and side photos.</p>
      </div>

      <form className="mt-5 space-y-5" onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <div>
          <label className={labelClass} htmlFor="fullname">
            Full name*
          </label>
          <input
            className={`${fieldClass} mt-2`}
            id="fullname"
            type="text"
            placeholder="Enter customer name"
            name="fullname"
            value={values.fullname}
            onChange={handleChanges}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="height">
              Height*
            </label>
            <div className="mt-2 flex gap-2">
              <input
                className={fieldClass}
                id="height"
                type="number"
                min="30"
                max="230"
                placeholder="170 or 67"
                name="height"
                value={values.height}
                onChange={handleChanges}
              />
              <select
                className="min-h-11 rounded-md border border-stone-300 bg-white px-2 text-sm text-stone-950 outline-none transition focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
                name="heightUnit"
                value={values.heightUnit}
                onChange={handleChanges}
                aria-label="Height unit"
              >
                <option value="cm">cm</option>
                <option value="in">in</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="weight">
              Weight (kg)*
            </label>
            <input
              className={`${fieldClass} mt-2`}
              id="weight"
              type="number"
              min="20"
              max="250"
              placeholder="70"
              name="weight"
              value={values.weight}
              onChange={handleChanges}
            />
          </div>
        </div>

        <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-stone-950">MediaPipe guided camera</p>
              <p className="mt-1 text-sm text-stone-500">
                Capture unlocks only when the pose model confirms the body position.
              </p>
            </div>
            <span className="rounded-md bg-white px-3 py-1 text-xs font-medium text-amber-700">
              Front + side required
            </span>
          </div>

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
                <div className="absolute bottom-3 left-3 right-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="rounded-md bg-black/70 px-3 py-2 text-xs font-medium text-white">
                    Capturing: {captureLabels[activeCapture]}
                  </span>
                  <span
                    className={`rounded-md px-3 py-2 text-xs font-semibold ${
                      allGuidelinesPassed ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
                    }`}
                  >
                    {allGuidelinesPassed ? "Ready" : "Adjust pose"}
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
                <span className="min-h-10 rounded-md bg-white/10 px-3 py-2 text-sm text-white">
                  {cameraStatus}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-lg border border-stone-200 bg-white p-3">
                <p className="text-sm font-semibold text-stone-950">Automatic checks</p>
                <p className="mt-1 text-sm text-stone-500">{poseMessage}</p>
                <p className="mt-1 text-xs font-medium text-emerald-700">{openCvStatus}</p>
                <p className="mt-1 text-xs font-medium text-amber-700">{poseStatus}</p>
                <div className="mt-3 grid gap-2">
                  {Object.entries(guidelineLabels).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-2 text-sm text-stone-700">
                      <span
                        className={`h-3 w-3 rounded-full ${
                          guidelines[key] ? "bg-emerald-500" : "bg-stone-300"
                        }`}
                      />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {Object.entries(captureLabels).map(([view, label]) => (
                <div key={view} className="rounded-lg border border-stone-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-stone-950">{label}</p>
                    {photos[view] && (
                      <button
                        type="button"
                        onClick={() => retakePhoto(view)}
                        className="text-xs font-semibold text-amber-700 hover:text-amber-800"
                      >
                        Retake
                      </button>
                    )}
                  </div>
                  {photos[view] ? (
                    <img
                      className="mt-3 aspect-video w-full rounded-md object-cover"
                      src={photos[view].preview}
                      alt={`${label} capture`}
                    />
                  ) : (
                    <div className="mt-3 flex aspect-video items-center justify-center rounded-md bg-stone-100 text-sm text-stone-500">
                      Not captured
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-stone-100 pt-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleReset}
            className="min-h-11 rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
          >
            Clear
          </button>
          <button
            type="submit"
            className="min-h-11 rounded-md bg-amber-600 px-5 text-sm font-semibold text-white transition hover:bg-amber-700"
          >
            Process measurement
          </button>
        </div>
      </form>
    </section>
  );
};

export default Form;
