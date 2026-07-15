import React from "react";
import captureGuideA4Paper from "../../assets/images/capture-guide-a4-paper.png";
import captureGuideFemaleA4Paper from "../../assets/images/capture-guide-female-a4-paper.png";
import captureGuideFemaleMeasuringTape from "../../assets/images/capture-guide-female-measuring-tape.png";
import captureGuideFemaleStandardDoor from "../../assets/images/capture-guide-female-standard-door.png";
import captureGuideFemaleStanding from "../../assets/images/capture-guide-female-standing.png";
import captureGuideMeasuringTape from "../../assets/images/capture-guide-measuring-tape.png";
import captureGuideStandardDoor from "../../assets/images/capture-guide-standard-door.png";
import captureStandingGuide from "../../assets/images/capture-standing-guide.png";
import { referenceObjects } from "./constants";

const baseGuideItems = [
  "Wear fitted clothing",
  "Full body in frame",
  "Plain background",
  "Arms slightly away",
  "Feet visible",
];

const referenceGuideContent = {
  "a4-paper": {
    item: "Hold A4 paper flat beside the thigh",
    description: "Keep the full sheet visible in the front and side photos.",
  },
  "standard-door": {
    item: "Stand close to the door frame",
    description: "Keep the top frame and floor line visible with the body.",
  },
  "measuring-tape": {
    item: "Hang the tape straight beside the body",
    description: "Keep the visible marked length vertical and readable.",
  },
};

const guideImages = {
  male: {
    default: captureStandingGuide,
    "a4-paper": captureGuideA4Paper,
    "standard-door": captureGuideStandardDoor,
    "measuring-tape": captureGuideMeasuringTape,
  },
  female: {
    default: captureGuideFemaleStanding,
    "a4-paper": captureGuideFemaleA4Paper,
    "standard-door": captureGuideFemaleStandardDoor,
    "measuring-tape": captureGuideFemaleMeasuringTape,
  },
};

function CaptureStandingGuide({ measurementProfile, referenceObject, scaleMode }) {
  const usesReference = scaleMode === "reference";
  const profileImages = guideImages[measurementProfile] || guideImages.male;
  const selectedReference = referenceObjects.find((object) => object.id === referenceObject);
  const referenceContent = referenceGuideContent[referenceObject];
  const guideImage = usesReference
    ? profileImages[referenceObject] || profileImages.default
    : profileImages.default;
  const guideItems = usesReference && referenceContent
    ? [...baseGuideItems, referenceContent.item]
    : baseGuideItems;

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-stone-950">How to stand</p>
          <p className="mt-1 text-sm text-stone-500">
            {usesReference && selectedReference
              ? `Keep the ${selectedReference.label.toLowerCase()} visible in both photos. ${referenceContent?.description || selectedReference.detail}`
              : "Use this guide for a clear front view and side view."}
          </p>
        </div>
        <span className="rounded-md bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
          {usesReference && selectedReference ? selectedReference.label : "Capture guide"}
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <img
          src={guideImage}
          alt={
            usesReference && selectedReference
              ? `Standing capture guide with ${selectedReference.label.toLowerCase()} reference object`
              : "Front and side standing posture guide for measurement capture"
          }
          className="h-auto w-full rounded-lg object-contain"
        />
        <div className="grid content-start gap-2 grid-cols-2">
          {guideItems.map((item) => (
            <div key={item} className="flex min-h-11 items-center gap-2 rounded-md bg-white px-3 text-sm font-medium text-stone-700">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CaptureStandingGuide;
