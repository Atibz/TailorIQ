const SEGMENTATION_API_URL = import.meta.env.VITE_SEGMENTATION_API_URL;
const RASTER_MAX_WIDTH = 260;
const RASTER_MAX_HEIGHT = 360;

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return window.btoa(binary);
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not prepare the photo for measurement."));
    image.src = source;
  });
}

async function createRaster(source) {
  const image = await loadImage(source);
  const scale = Math.min(RASTER_MAX_WIDTH / image.naturalWidth, RASTER_MAX_HEIGHT / image.naturalHeight, 1);
  const width = Math.max(Math.round(image.naturalWidth * scale), 1);
  const height = Math.max(Math.round(image.naturalHeight * scale), 1);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  const imageData = context.getImageData(0, 0, width, height);

  return {
    width,
    height,
    rgbaBase64: arrayBufferToBase64(imageData.data.buffer),
  };
}

export async function requestSegmentationMeasurements(customerData) {
  if (!SEGMENTATION_API_URL) {
    throw new Error("Measurement service is not connected. Check the app setup and try again.");
  }

  const frontRaster = await createRaster(customerData.segmentationImages.front);
  const sideRaster = await createRaster(customerData.segmentationImages.side);

  const response = await fetch(SEGMENTATION_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      profile: customerData.measurementProfile,
      scale: {
        mode: customerData.scaleMode,
        height: customerData.height,
        heightUnit: customerData.heightUnit,
        referenceObject: customerData.referenceObject,
        referenceSize: customerData.referenceSize,
        referenceUnit: customerData.referenceUnit,
        referenceCalibration: customerData.referenceCalibration,
        referenceCalibratedHeightCm: customerData.referenceCalibratedHeightCm,
      },
      images: customerData.segmentationImages,
      rasters: {
        front: frontRaster,
        side: sideRaster,
      },
      poseMetrics: customerData.poseMetrics,
    }),
  });

  if (!response.ok) {
    let message = `Measurement service failed with ${response.status}`;

    try {
      const errorBody = await response.json();
      message = errorBody?.error || message;
    } catch {
      // Keep the status message when the backend does not return JSON.
    }

    throw new Error(message);
  }

  const result = await response.json();

  if (!result?.measurements) {
    throw new Error("Measurement service did not return measurements.");
  }

  return result;
}
