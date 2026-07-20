import React from "react";
import { captureLabels } from "./constants";

function CapturePreviewCards({ photos, onRetake }) {
  return (
    <>
      {Object.entries(captureLabels).map(([view, label]) => (
        <div key={view} className="rounded-lg border border-stone-200 bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-stone-950">{label}</p>
            {photos[view]?.preview && (
              <button
                type="button"
                onClick={() => onRetake(view)}
                className="text-xs font-semibold text-amber-700 hover:text-amber-800"
              >
                Retake
              </button>
            )}
          </div>
          {photos[view]?.preview ? (
            <img
              className="mt-3 aspect-video w-full rounded-md object-cover"
              src={photos[view].silhouettePreview || photos[view].preview}
              alt={`${label} capture`}
            />
          ) : (
            <div className="mt-3 flex aspect-video items-center justify-center rounded-md bg-stone-100 text-sm text-stone-500">
              Not captured
            </div>
          )}
        </div>
      ))}
    </>
  );
}

export default CapturePreviewCards;
