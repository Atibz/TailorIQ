import React from "react";
import { captureLabels } from "./constants";

function getStatusClass(status) {
  if (status.startsWith("Accepted")) {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status.startsWith("Rejected") || status.startsWith("Could not")) {
    return "bg-red-50 text-red-700";
  }

  return "bg-amber-50 text-amber-700";
}

function PhotoUploadPanel({ photos, uploadStatus, onRetake, onUploadPhoto }) {
  return (
    <div>
      <div>
        <div>
          <p className="text-sm font-semibold text-stone-950">Photo upload</p>
          <p className="mt-1 text-sm text-stone-500">
            Use this when the client is alone. Uploaded photos are accepted only if the same checks pass.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4">
        {Object.entries(captureLabels).map(([view, label]) => {
          const photo = photos[view];

          return (
            <div key={view} className="overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
              <div className="flex items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-stone-950">{label}</p>
                  <p className="mt-1 text-xs text-stone-500">Full body, clear lighting, arms slightly away</p>
                </div>
                {photo?.preview && (
                  <button
                    type="button"
                    onClick={() => onRetake(view)}
                    className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 transition hover:bg-stone-50"
                  >
                    Retake
                  </button>
                )}
              </div>

              <label className="block cursor-pointer">
                {photo?.preview ? (
                  <div className="relative">
                    <img
                      className="aspect-[4/3] w-full bg-stone-950 object-contain"
                      src={photo.preview}
                      alt={`${label} upload preview`}
                    />
                  </div>
                ) : (
                  <div className="flex min-h-56 flex-col items-center justify-center px-4 py-8 text-center transition hover:bg-amber-50">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-current">
                        <path d="M11 16V7.83L7.41 11.42 6 10l6-6 6 6-1.41 1.42L13 7.83V16h-2Zm-6 4v-5h2v3h10v-3h2v5H5Z" />
                      </svg>
                    </span>
                    <span className="mt-3 text-sm font-semibold text-stone-950">Upload {label.toLowerCase()}</span>
                    <span className="mt-1 text-xs text-stone-500">Tap to choose a photo</span>
                  </div>
                )}

                {uploadStatus[view] && (
                  <span className={`m-3 block rounded-md px-3 py-2 text-xs font-medium ${getStatusClass(uploadStatus[view])}`}>
                    {uploadStatus[view]}
                  </span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    onUploadPhoto(view, event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PhotoUploadPanel;
