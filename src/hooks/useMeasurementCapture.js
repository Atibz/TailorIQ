import { useEffect, useMemo, useRef, useState } from "react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import {
  captureLabels,
  emptyPhotos,
  emptyUploadStatus,
  getEmptyGuidelines,
  getGuidelineFixes,
  getGuidelineLabels,
} from "../components/measurement/constants";

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

function getSleeveRatio(leftSleeve, rightSleeve, bodyHeight) {
  const shorterSleeve = Math.min(leftSleeve, rightSleeve);
  const longerSleeve = Math.max(leftSleeve, rightSleeve);
  const sleevesDisagree = longerSleeve - shorterSleeve > bodyHeight * 0.055;
  const sleeveLength = sleevesDisagree ? shorterSleeve : (leftSleeve + rightSleeve) / 2;

  return sleeveLength / bodyHeight;
}

function extractPoseMetrics(landmarks, frameMetrics) {
  if (!landmarks?.length) {
    return null;
  }

  const nose = landmarks[0];
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
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
  const leftSleeve = distanceBetween(leftShoulder, leftWrist);
  const rightSleeve = distanceBetween(rightShoulder, rightWrist);
  const leftLeg = distanceBetween(leftHip, leftKnee) + distanceBetween(leftKnee, leftAnkle);
  const rightLeg = distanceBetween(rightHip, rightKnee) + distanceBetween(rightKnee, rightAnkle);
  const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
  const hipY = (leftHip.y + rightHip.y) / 2;
  const kneeY = (leftKnee.y + rightKnee.y) / 2;
  const ankleY = (leftAnkle.y + rightAnkle.y) / 2;
  const torsoY = Math.max(hipY - shoulderY, 0.01);
  const bodyCenterX = (shoulderCenter.x + hipCenter.x) / 2;

  return {
    bodyHeightRatio: bodyHeight,
    shoulderWidthRatio: Math.abs(rightShoulder.x - leftShoulder.x) / bodyHeight,
    hipWidthRatio: Math.abs(rightHip.x - leftHip.x) / bodyHeight,
    torsoLengthRatio: distanceBetween(shoulderCenter, hipCenter) / bodyHeight,
    sleeveLengthRatio: getSleeveRatio(leftSleeve, rightSleeve, bodyHeight),
    trouserLengthRatio: distanceBetween(hipCenter, ankleCenter) / bodyHeight,
    inseamRatio: ((leftLeg + rightLeg) / 2) / bodyHeight,
    silhouetteLevels: {
      bodyCenterX,
      shoulderY,
      chestY: shoulderY + torsoY * 0.28,
      underbustY: shoulderY + torsoY * 0.42,
      waistY: shoulderY + torsoY * 0.64,
      hipY,
      thighY: hipY + (kneeY - hipY) * 0.38,
      kneeY,
      ankleY,
      bodyTopY: topY,
      bodyBottomY: bottomY,
    },
    frameMetrics: {
      brightness: Math.round(frameMetrics.brightness),
      contrast: Math.round(frameMetrics.contrast),
      edgeDensity: Number(frameMetrics.edgeDensity.toFixed(3)),
      sharpness: Math.round(frameMetrics.sharpness),
    },
  };
}

function withTimeout(promise, milliseconds, errorMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(errorMessage)), milliseconds);
    }),
  ]);
}

function getCanvasImageData(source, width = 160, height = 120) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(source, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
}

function preprocessImageSource(source) {
  const imageData = getCanvasImageData(source, 120, 90);
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

function createPreviewFromImageSource(source, maxSize = 900, quality = 0.72) {
  const sourceWidth = source.videoWidth || source.naturalWidth || source.width;
  const sourceHeight = source.videoHeight || source.naturalHeight || source.height;
  const scale = Math.min(maxSize / sourceWidth, maxSize / sourceHeight, 1);
  const canvas = document.createElement("canvas");
  const width = Math.max(Math.round(sourceWidth * scale), 1);
  const height = Math.max(Math.round(sourceHeight * scale), 1);

  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(source, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", quality);
}

function createImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const reader = new FileReader();
    let preview = "";

    image.onload = () => resolve({ image, preview });
    image.onerror = () => reject(new Error("Image could not be loaded"));
    reader.onerror = () => reject(new Error("Image could not be loaded"));
    reader.onload = () => {
      preview = reader.result;
      image.src = preview;
    };
    reader.readAsDataURL(file);
  });
}

function analyzePose(landmarks, frameMetrics, options = {}) {
  const { scaleMode = "height", referenceObject = "", view = "front" } = options;
  const captureSettings = { scaleMode, referenceObject };
  const emptyGuidelines = getEmptyGuidelines(captureSettings);
  const guidelineFixes = getGuidelineFixes(captureSettings);
  const frameChecks = {
    lighting: frameMetrics.lighting,
    contrast: frameMetrics.contrastOk,
    sharpness: frameMetrics.sharpnessOk,
  };

  if (!landmarks?.length) {
    return {
      checks: { ...emptyGuidelines, ...frameChecks },
      message: "Make sure the person is visible from head to feet.",
      score: 0,
    };
  }

  const nose = landmarks[0];
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftElbow = landmarks[13];
  const rightElbow = landmarks[14];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];
  const visibleRequired =
    view === "side"
      ? isVisible(nose, 0.28) &&
        (isVisible(leftShoulder, 0.28) || isVisible(rightShoulder, 0.28)) &&
        (isVisible(leftHip, 0.28) || isVisible(rightHip, 0.28)) &&
        (isVisible(leftKnee, 0.22) || isVisible(rightKnee, 0.22)) &&
        (isVisible(leftAnkle, 0.22) || isVisible(rightAnkle, 0.22))
      : requiredLandmarks.every((index) => isVisible(landmarks[index], 0.35));

  const topY = Math.min(nose?.y ?? 1, leftShoulder?.y ?? 1, rightShoulder?.y ?? 1);
  const bottomY = Math.max(leftAnkle?.y ?? 0, rightAnkle?.y ?? 0);
  const leftX = Math.min(leftShoulder?.x ?? 1, leftHip?.x ?? 1, leftAnkle?.x ?? 1);
  const rightX = Math.max(rightShoulder?.x ?? 0, rightHip?.x ?? 0, rightAnkle?.x ?? 0);
  const centerX = (leftShoulder.x + rightShoulder.x + leftHip.x + rightHip.x) / 4;
  const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y);
  const hipTilt = Math.abs(leftHip.y - rightHip.y);
  const bodyHeight = Math.max(bottomY - topY, 0.01);
  const kneeY = Math.max(leftKnee?.y ?? 0, rightKnee?.y ?? 0);
  const visibleArmPoints = [leftElbow, rightElbow, leftWrist, rightWrist].filter((point) =>
    isVisible(point, 0.28),
  );
  const leftArmVisible = isVisible(leftElbow, 0.28) || isVisible(leftWrist, 0.28);
  const rightArmVisible = isVisible(rightElbow, 0.28) || isVisible(rightWrist, 0.28);
  const leftArmHangs =
    (isVisible(leftElbow, 0.28) && leftElbow.y > leftShoulder.y + bodyHeight * 0.06) ||
    (isVisible(leftWrist, 0.28) && leftWrist.y > leftShoulder.y + bodyHeight * 0.18);
  const rightArmHangs =
    (isVisible(rightElbow, 0.28) && rightElbow.y > rightShoulder.y + bodyHeight * 0.06) ||
    (isVisible(rightWrist, 0.28) && rightWrist.y > rightShoulder.y + bodyHeight * 0.18);
  const frontArmsClear =
    leftArmVisible &&
    rightArmVisible &&
    leftArmHangs &&
    rightArmHangs;
  const sideArmsClear =
    visibleArmPoints.length >= 1 &&
    visibleArmPoints.some(
      (point) =>
        point.y > Math.min(leftShoulder.y, rightShoulder.y) + bodyHeight * 0.08 &&
        point.y < kneeY + bodyHeight * 0.08,
    );

  const bodyChecks = {
    fullBody:
      visibleRequired &&
      topY > (view === "side" ? -0.06 : -0.02) &&
      bottomY < (view === "side" ? 1.08 : 1.03) &&
      leftX > (view === "side" ? -0.08 : -0.03) &&
      rightX < (view === "side" ? 1.08 : 1.03),
    centered: view === "side" ? centerX > 0.32 && centerX < 0.68 : centerX > 0.38 && centerX < 0.62,
    upright: view === "side" ? shoulderTilt < 0.11 && hipTilt < 0.12 : shoulderTilt < 0.065 && hipTilt < 0.075,
    armsClear: view === "side" ? sideArmsClear : frontArmsClear,
    ...frameChecks,
  };
  const referenceChecks =
    scaleMode === "reference"
      ? {
          referenceAnchor:
            bodyChecks.fullBody &&
            bodyChecks.centered &&
            bodyChecks.contrast &&
            bodyChecks.sharpness,
        }
      : {};
  const checks = {
    ...bodyChecks,
    ...referenceChecks,
  };

  const failedKey = Object.keys(checks).find((key) => !checks[key]);
  const score = Object.values(checks).filter(Boolean).length;

  return {
    checks,
    message: failedKey ? guidelineFixes[failedKey] : "Ready to capture",
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

function revokePhoto(photo) {
  if (photo?.preview?.startsWith("blob:")) {
    URL.revokeObjectURL(photo.preview);
  }
}

export function useMeasurementCapture({ initialPhotos, referenceObject, scaleMode, setValues, setError }) {
  const captureSettings = useMemo(
    () => ({ scaleMode, referenceObject }),
    [referenceObject, scaleMode],
  );
  const guidelineLabels = getGuidelineLabels(captureSettings);
  const [photos, setPhotos] = useState(() => initialPhotos || emptyPhotos);
  const [uploadStatus, setUploadStatus] = useState(emptyUploadStatus);
  const [activeCapture, setActiveCapture] = useState("front");
  const [guidelines, setGuidelines] = useState(() => getEmptyGuidelines(captureSettings));
  const [poseStatus, setPoseStatus] = useState("Pose model not loaded");
  const [poseMessage, setPoseMessage] = useState("Start the camera to begin automatic checks");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const poseLandmarkerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const latestPoseMetricsRef = useRef(null);
  const poseModeRef = useRef("VIDEO");
  const activeCaptureRef = useRef("front");
  const captureSettingsRef = useRef(captureSettings);
  const photosRef = useRef(emptyPhotos);

  const allGuidelinesPassed =
    Object.keys(guidelineLabels).length > 0 &&
    Object.keys(guidelineLabels).every((key) => guidelines[key]);

  useEffect(() => {
    activeCaptureRef.current = activeCapture;
  }, [activeCapture]);

  useEffect(() => {
    latestPoseMetricsRef.current = null;
    setGuidelines(getEmptyGuidelines(captureSettingsRef.current));
    setPoseMessage(
      activeCapture === "front"
        ? "Place the full front view inside the guide."
        : "Turn to the side and keep the full body inside the guide.",
    );
  }, [activeCapture]);

  useEffect(() => {
    captureSettingsRef.current = captureSettings;
  }, [captureSettings]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
      poseLandmarkerRef.current?.close();
      Object.values(photosRef.current).forEach(revokePhoto);
    };
  }, []);

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

  const setPoseMode = async (mode) => {
    const poseLandmarker = await loadPoseLandmarker();

    if (poseModeRef.current !== mode) {
      await poseLandmarker.setOptions({ runningMode: mode });
      poseModeRef.current = mode;
    }

    return poseLandmarker;
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
      if (poseLandmarker && poseModeRef.current !== "VIDEO") {
        animationFrameRef.current = requestAnimationFrame(detectPose);
        return;
      }

      const result = poseLandmarker?.detectForVideo(video, video.currentTime * 1000);
      const landmarks = result?.landmarks?.[0];
      const frameMetrics = preprocessImageSource(video);
      const analysis = analyzePose(landmarks, frameMetrics, {
        ...captureSettingsRef.current,
        view: activeCaptureRef.current,
      });

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
      setError("Camera is not available in this browser.");
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

      setIsCameraActive(true);
      setPoseStatus("Loading MediaPipe Pose in background");
      setPoseMessage("Camera is open. Vision checks are loading.");

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      animationFrameRef.current = requestAnimationFrame(detectPose);

      const poseResult = await Promise.allSettled([
        withTimeout(setPoseMode("VIDEO"), 12000, "MediaPipe loading timed out"),
      ]);

      if (poseResult[0].status === "fulfilled") {
        poseLandmarkerRef.current = poseResult[0].value;
        setPoseMessage("Move into the guide so the pose model can validate the frame");
      } else {
        setPoseStatus("Pose model could not load");
        setPoseMessage("Camera is open, but pose checks could not load. Check internet access.");
      }
    } catch {
      setIsCameraActive(false);
      setError("Allow camera access in your browser.");
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setPoseMessage("Start the camera to begin automatic checks");
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

    const preview = createPreviewFromImageSource(videoRef.current);

    setPhotos((currentPhotos) => ({
      ...currentPhotos,
        [activeCaptureRef.current]: {
          view: captureLabels[activeCaptureRef.current],
          fileName: `${captureLabels[activeCaptureRef.current]} MediaPipe capture`,
          preview,
          poseMetrics: latestPoseMetricsRef.current,
        },
    }));

    if (activeCaptureRef.current === "front") {
      setActiveCapture("side");
    }
  };

  const handleUploadPhoto = async (view, file) => {
    if (!file) {
      return;
    }

    setError("");
    setUploadStatus((currentStatus) => ({
      ...currentStatus,
      [view]: `Checking ${file.name}...`,
    }));
    setPoseStatus("Checking uploaded photo");

    try {
      const { image, preview } = await createImageFromFile(file);
      setUploadStatus((currentStatus) => ({
        ...currentStatus,
        [view]: "Photo loaded. Checking body position...",
      }));
      const poseLandmarker = await withTimeout(
        setPoseMode("IMAGE"),
        12000,
        "MediaPipe image check timed out",
      );
      const frameMetrics = preprocessImageSource(image);
      const result = poseLandmarker.detect(image);
      const landmarks = result.landmarks?.[0];
      const analysis = analyzePose(landmarks, frameMetrics, {
        ...captureSettingsRef.current,
        view,
      });

      if (!Object.values(analysis.checks).every(Boolean)) {
        revokePhoto({ preview });
        setPoseStatus("Uploaded photo rejected");
        setUploadStatus((currentStatus) => ({
          ...currentStatus,
          [view]: `Rejected. ${analysis.message}`,
        }));
        setError(`${captureLabels[view]} rejected. ${analysis.message}`);
        return;
      }

      setPhotos((currentPhotos) => {
        revokePhoto(currentPhotos[view]);
        return {
          ...currentPhotos,
          [view]: {
            view: captureLabels[view],
            fileName: `${captureLabels[view]} uploaded photo`,
            preview: createPreviewFromImageSource(image),
            poseMetrics: extractPoseMetrics(landmarks, frameMetrics),
          },
        };
      });
      setPoseStatus("Uploaded photo accepted");
      setUploadStatus((currentStatus) => ({
        ...currentStatus,
        [view]: "Accepted. Guideline checks passed.",
      }));
      setGuidelines(analysis.checks);
      setValues((currentValues) => ({
        ...currentValues,
        captureQuality: analysis.score,
      }));
    } catch (uploadError) {
      setPoseStatus("Uploaded photo could not be checked");
      setUploadStatus((currentStatus) => ({
        ...currentStatus,
        [view]: "Could not check this photo.",
      }));
      setError(
        uploadError.message?.includes("timed out")
          ? "Photo check timed out while loading the pose model. Check your internet connection and try again."
          : "Could not validate that photo. Try a clearer full-body image.",
      );
    }
  };

  const retakePhoto = (view) => {
    setPhotos((currentPhotos) => {
      revokePhoto(currentPhotos[view]);
      return { ...currentPhotos, [view]: null };
    });
    setUploadStatus((currentStatus) => ({ ...currentStatus, [view]: "" }));
    setActiveCapture(view);
  };

  const resetCapture = () => {
    Object.values(photosRef.current).forEach(revokePhoto);
    setPhotos(emptyPhotos);
    setUploadStatus(emptyUploadStatus);
    setGuidelines(getEmptyGuidelines(captureSettingsRef.current));
    setActiveCapture("front");
    setPoseMessage("Start the camera to begin automatic checks");
    stopCamera();
  };

  return {
    activeCapture,
    allGuidelinesPassed,
    capturePhoto,
    canvasRef,
    guidelines,
    guidelineLabels,
    handleUploadPhoto,
    isCameraActive,
    photos,
    poseMessage,
    poseStatus,
    resetCapture,
    retakePhoto,
    startCamera,
    stopCamera,
    uploadStatus,
    videoRef,
  };
}
