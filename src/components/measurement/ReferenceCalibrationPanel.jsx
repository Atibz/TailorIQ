import React, { useMemo, useState } from "react";
import { referenceObjects } from "./constants";
import {
  buildReferenceCalibration,
  formatLength,
  getSuggestedMarkers,
} from "./referenceCalibration";

function ReferenceCalibrationPanel({
  marker,
  onChange,
  photo,
  referenceObject,
  referenceSize,
  referenceUnit,
}) {
  const [activePoint, setActivePoint] = useState("top");
  const reference = referenceObjects.find((object) => object.id === referenceObject);
  const suggestedMarker = useMemo(() => getSuggestedMarkers(referenceObject), [referenceObject]);
  const activeMarker = marker || suggestedMarker;
  const calibration = buildReferenceCalibration({
    marker: activeMarker,
    photo,
    referenceObject,
    referenceSize,
    referenceUnit,
  });

  if (!photo?.preview) {
    return null;
  }

  const handleImageClick = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const nextPoint = {
      x: Math.min(Math.max((event.clientX - bounds.left) / bounds.width, 0), 1),
      y: Math.min(Math.max((event.clientY - bounds.top) / bounds.height, 0), 1),
    };
    const nextMarker = {
      ...activeMarker,
      [activePoint]: nextPoint,
    };

    onChange(nextMarker);
    setActivePoint(activePoint === "top" ? "bottom" : "top");
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-stone-950">Reference size check</p>
          <p className="mt-1 text-sm text-amber-900">
            Mark the top and bottom of the {reference?.label || "reference object"} in the front photo.
          </p>
        </div>
        <div className="tiq-segmented grid grid-cols-2 overflow-hidden rounded-full p-0.5">
          <button
            type="button"
            onClick={() => setActivePoint("top")}
            className={`min-h-9 rounded-full px-3 text-xs font-semibold transition ${
              activePoint === "top" ? "tiq-segmented-button-active" : "tiq-segmented-button"
            }`}
          >
            Top
          </button>
          <button
            type="button"
            onClick={() => setActivePoint("bottom")}
            className={`min-h-9 rounded-full px-3 text-xs font-semibold transition ${
              activePoint === "bottom" ? "tiq-segmented-button-active" : "tiq-segmented-button"
            }`}
          >
            Bottom
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
        {[
          "Tap the top edge",
          "Tap the bottom edge",
          "Check the height estimate",
        ].map((step, index) => (
          <div key={step} className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-stone-700">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-stone-950">
              {index + 1}
            </span>
            <span className="font-medium">{step}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <button
          type="button"
          onClick={handleImageClick}
          className="relative overflow-hidden rounded-lg bg-stone-950 text-left"
        >
          <img
            className="aspect-[3/4] w-full object-contain sm:aspect-video"
            src={photo.preview}
            alt="Front view reference marking"
          />
          {["top", "bottom"].map((point) => (
            <React.Fragment key={point}>
              <span
                className="absolute left-0 right-0 h-0.5 bg-amber-300"
                style={{ top: `${activeMarker[point].y * 100}%` }}
              />
              <span
                className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-amber-500 shadow"
                style={{
                  left: `${activeMarker[point].x * 100}%`,
                  top: `${activeMarker[point].y * 100}%`,
                }}
              />
            </React.Fragment>
          ))}
        </button>

        <div className="rounded-lg bg-white p-4">
          <p className="text-xs font-semibold uppercase text-stone-500">Click target</p>
          <p className="mt-1 text-sm font-semibold text-stone-950">
            Set {activePoint === "top" ? "top edge" : "bottom edge"}
          </p>
          <p className="mt-3 text-sm text-stone-600">
            The app uses the marked reference object to understand the photo size and prepare measurements in centimeters.
          </p>
          <div className="mt-4 grid gap-3 text-sm">
            <div>
              <p className="text-xs font-medium uppercase text-stone-500">Reference size</p>
              <p className="mt-1 font-semibold text-stone-950">
                {calibration ? formatLength(calibration.referenceSizeCm) : "Add a valid reference size"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-stone-500">Height estimate</p>
              <p className="mt-1 font-semibold text-stone-950">
                {calibration ? formatLength(calibration.calibratedHeightCm) : "Mark both reference edges"}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onChange(suggestedMarker)}
              className="min-h-9 rounded-md border border-stone-300 px-3 text-xs font-semibold text-stone-700 transition hover:bg-stone-50"
            >
              Use suggestion
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="min-h-9 rounded-md border border-stone-300 px-3 text-xs font-semibold text-stone-700 transition hover:bg-stone-50"
            >
              Clear adjustment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReferenceCalibrationPanel;
