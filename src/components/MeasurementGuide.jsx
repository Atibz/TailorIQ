import React from "react";

const guideDefinitions = {
  male: {
    label: "Male measurement guide",
    note: "Use the numbers on the body guide to match each tape position before entering the value.",
    marks: [
      { key: "neck", section: "Upper body", label: "Neck", instruction: "Wrap the tape around the base of the neck where the collar sits.", view: "front", type: "horizontal", x1: 102, x2: 128, y: 57 },
      { key: "chest", section: "Upper body", label: "Chest", instruction: "Wrap around the fullest chest, keeping the tape level across the back.", view: "front", type: "horizontal", x1: 80, x2: 150, y: 92 },
      { key: "stomach", section: "Upper body", label: "Stomach", instruction: "Wrap around the belly line, usually slightly above the trouser waist.", view: "front", type: "horizontal", x1: 86, x2: 144, y: 128 },
      { key: "shoulder", section: "Upper body", label: "Shoulder", instruction: "Measure across the back from one shoulder point to the other shoulder point.", view: "back", type: "horizontal", x1: 286, x2: 354, y: 78 },
      { key: "acrossBack", section: "Upper body", label: "Across back", instruction: "Measure across the back from arm crease to arm crease.", view: "back", type: "horizontal", x1: 293, x2: 347, y: 102 },
      { key: "armhole", section: "Upper body", label: "Armhole", instruction: "Measure around the arm opening from shoulder, underarm, and back up.", view: "front", type: "circle", cx: 78, cy: 96, r: 15 },
      { key: "sleeve", section: "Upper body", label: "Sleeve length", instruction: "Measure from the shoulder point where the sleeve seam starts down to the wrist.", view: "front", type: "diagonal", x1: 76, y1: 82, x2: 47, y2: 158 },
      { key: "bicep", section: "Upper body", label: "Round sleeve", instruction: "Wrap around the fullest part of the upper arm.", view: "front", type: "horizontal", x1: 45, x2: 70, y: 112 },
      { key: "wrist", section: "Upper body", label: "Cuff / wrist", instruction: "Wrap around the wrist or desired cuff opening.", view: "front", type: "horizontal", x1: 37, x2: 58, y: 158 },
      { key: "topLength", section: "Upper body", label: "Top length", instruction: "Measure from the shoulder near the neck down to the desired shirt/top hem.", view: "front", type: "vertical", x: 164, y1: 62, y2: 164 },
      { key: "waist", section: "Trouser", label: "Waist", instruction: "Wrap around the waistband position where the trouser will sit.", view: "front", type: "horizontal", x1: 86, x2: 144, y: 142 },
      { key: "seat", section: "Trouser", label: "Seat", instruction: "Wrap around the fullest part of the hip/seat.", view: "front", type: "horizontal", x1: 78, x2: 152, y: 166 },
      { key: "trouserLength", section: "Trouser", label: "Outseam", instruction: "Measure from the trouser waist down the outside leg to the hem.", view: "front", type: "vertical", x: 174, y1: 142, y2: 250 },
      { key: "inseam", section: "Trouser", label: "Inseam", instruction: "Measure from crotch down the inside leg to the hem.", view: "front", type: "vertical", x: 115, y1: 174, y2: 250 },
      { key: "rise", section: "Trouser", label: "Rise", instruction: "Measure from waistband down to crotch depth.", view: "front", type: "vertical", x: 99, y1: 142, y2: 174 },
      { key: "thigh", section: "Trouser", label: "Thigh", instruction: "Wrap around the upper thigh just below the crotch.", view: "front", type: "horizontal", x1: 86, x2: 115, y: 187 },
      { key: "knee", section: "Trouser", label: "Knee", instruction: "Wrap around the knee level.", view: "front", type: "horizontal", x1: 88, x2: 110, y: 220 },
      { key: "ankle", section: "Trouser", label: "Bottom / ankle", instruction: "Measure the trouser bottom opening at the ankle or desired hem.", view: "front", type: "horizontal", x1: 82, x2: 106, y: 250 },
    ],
  },
  female: {
    label: "Female measurement guide",
    note: "Use the front and back views together; some women measurements are vertical points, not round-body measurements.",
    marks: [
      { key: "bust", section: "Upper body", label: "Bust", instruction: "Wrap around the fullest bust, keeping the tape level across the back.", view: "front", type: "horizontal", x1: 78, x2: 152, y: 96 },
      { key: "underbust", section: "Upper body", label: "Underbust", instruction: "Wrap around the ribcage directly below the bust.", view: "front", type: "horizontal", x1: 84, x2: 146, y: 116 },
      { key: "waist", section: "Upper body", label: "Waist", instruction: "Wrap around the natural waist, the narrowest part of the torso.", view: "front", type: "horizontal", x1: 88, x2: 142, y: 140 },
      { key: "shoulder", section: "Upper body", label: "Shoulder", instruction: "Measure across the back from one shoulder point to the other shoulder point.", view: "back", type: "horizontal", x1: 288, x2: 352, y: 78 },
      { key: "bustPoint", section: "Upper body", label: "Bust point", instruction: "Measure from shoulder near the neck down to the bust apex.", view: "front", type: "vertical", x: 105, y1: 62, y2: 96 },
      { key: "bustSpan", section: "Upper body", label: "Bust span", instruction: "Measure from one bust apex to the other.", view: "front", type: "horizontal", x1: 100, x2: 130, y: 101 },
      { key: "frontLength", section: "Upper body", label: "Front bodice length", instruction: "Measure from shoulder through the bust point down to the waist.", view: "front", type: "vertical", x: 160, y1: 62, y2: 140 },
      { key: "backLength", section: "Upper body", label: "Back bodice length", instruction: "Measure from back neck down to the natural waist.", view: "back", type: "vertical", x: 320, y1: 60, y2: 140 },
      { key: "armhole", section: "Upper body", label: "Armhole", instruction: "Measure around the arm opening from shoulder, underarm, and back up.", view: "front", type: "circle", cx: 78, cy: 96, r: 15 },
      { key: "sleeve", section: "Upper body", label: "Sleeve length", instruction: "Measure from the shoulder point where the sleeve seam starts down to the wrist.", view: "front", type: "diagonal", x1: 76, y1: 82, x2: 47, y2: 158 },
      { key: "bicep", section: "Upper body", label: "Round sleeve", instruction: "Wrap around the fullest part of the upper arm.", view: "front", type: "horizontal", x1: 45, x2: 70, y: 112 },
      { key: "topLength", section: "Upper body", label: "Blouse/top length", instruction: "Measure from shoulder down to the chosen blouse or top hem.", view: "front", type: "vertical", x: 172, y1: 62, y2: 164 },
      { key: "waistLower", section: "Lower body", label: "Waist", instruction: "Use the same waist line for skirt, trouser, or gown lower body.", view: "front", type: "horizontal", x1: 88, x2: 142, y: 140 },
      { key: "highHip", section: "Lower body", label: "High hip", instruction: "Wrap around the upper hip below the waist.", view: "front", type: "horizontal", x1: 82, x2: 148, y: 158 },
      { key: "hip", section: "Lower body", label: "Full hip", instruction: "Wrap around the fullest part of the hip.", view: "front", type: "horizontal", x1: 76, x2: 154, y: 178 },
      { key: "waistToHip", section: "Lower body", label: "Waist to hip", instruction: "Measure vertically from natural waist down to the full hip line.", view: "front", type: "vertical", x: 98, y1: 140, y2: 178 },
      { key: "lowerLength", section: "Lower body", label: "Skirt/trouser length", instruction: "Measure from waist down to the desired lower-garment hem.", view: "front", type: "vertical", x: 174, y1: 140, y2: 250 },
      { key: "rise", section: "Lower body", label: "Rise", instruction: "For trousers, measure from waistband down to crotch depth.", view: "front", type: "vertical", x: 112, y1: 140, y2: 178 },
      { key: "inseam", section: "Lower body", label: "Inseam", instruction: "For trousers, measure from crotch down the inside leg to the hem.", view: "front", type: "vertical", x: 118, y1: 178, y2: 250 },
      { key: "thigh", section: "Lower body", label: "Thigh", instruction: "Wrap around the upper thigh just below the crotch.", view: "front", type: "horizontal", x1: 86, x2: 116, y: 190 },
      { key: "knee", section: "Lower body", label: "Knee", instruction: "Wrap around the knee level.", view: "front", type: "horizontal", x1: 88, x2: 110, y: 222 },
      { key: "ankle", section: "Lower body", label: "Ankle / hem", instruction: "Measure ankle opening for trousers or hem opening for a skirt.", view: "front", type: "horizontal", x1: 82, x2: 106, y: 250 },
    ],
  },
};

const strokeColor = "#fef3c7";
const markerFill = "#f59e0b";

function getMarkerPoint(mark) {
  if (mark.type === "horizontal") {
    return { x: mark.x2 + 10, y: mark.y };
  }

  if (mark.type === "vertical") {
    return { x: mark.x + 10, y: (mark.y1 + mark.y2) / 2 };
  }

  if (mark.type === "diagonal") {
    return { x: mark.x2 + 10, y: mark.y2 - 8 };
  }

  return { x: mark.cx + mark.r + 10, y: mark.cy };
}

function MeasurementMark({ mark, index }) {
  const point = getMarkerPoint(mark);

  return (
    <g>
      {mark.type === "horizontal" && (
        <path d={`M${mark.x1} ${mark.y} H${mark.x2}`} stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
      )}
      {mark.type === "vertical" && (
        <path d={`M${mark.x} ${mark.y1} V${mark.y2}`} stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
      )}
      {mark.type === "diagonal" && (
        <path d={`M${mark.x1} ${mark.y1} L${mark.x2} ${mark.y2}`} stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
      )}
      {mark.type === "circle" && (
        <circle cx={mark.cx} cy={mark.cy} r={mark.r} fill="none" stroke={strokeColor} strokeWidth="2.5" />
      )}

      <circle cx={point.x} cy={point.y} r="8" fill={markerFill} stroke="#fff7ed" strokeWidth="2" />
      <text x={point.x} y={point.y + 3.5} textAnchor="middle" fill="#1c1917" fontSize="9" fontWeight="800">
        {index + 1}
      </text>
    </g>
  );
}

function BodyFigure({ profileId, view, marks }) {
  const isFemale = profileId === "female";
  const isBack = view === "back";
  const offset = isBack ? 230 : 0;

  return (
    <g transform={`translate(${offset} 0)`}>
      <text x="115" y="22" textAnchor="middle" fill="#fafaf9" fontSize="13" fontWeight="800">
        {isBack ? "Back view" : "Front view"}
      </text>
      <circle cx="115" cy="48" r="19" fill="#f5d0a4" />
      <path
        d={
          isFemale
            ? "M115 70 C100 82 93 111 90 140 C87 168 78 199 72 252 L94 252 L112 176 L136 252 L158 252 C152 199 143 168 140 140 C137 111 130 82 115 70 Z"
            : "M115 70 C100 82 90 112 88 143 L82 252 L101 252 L114 176 L129 252 L148 252 L142 143 C140 112 130 82 115 70 Z"
        }
        fill="#f59e0b"
        opacity="0.93"
      />
      <path
        d={isFemale ? "M94 88 C104 80 126 80 136 88 L141 140 C128 150 102 150 89 140 Z" : "M93 88 C104 80 126 80 137 88 L142 143 C128 153 102 153 88 143 Z"}
        fill="#fbbf24"
      />
      <path d="M90 92 L48 166" stroke="#f5d0a4" strokeWidth="13" strokeLinecap="round" />
      <path d="M140 92 L182 166" stroke="#f5d0a4" strokeWidth="13" strokeLinecap="round" />
      <path d="M98 252 L92 270" stroke="#f5d0a4" strokeWidth="11" strokeLinecap="round" />
      <path d="M144 252 L150 270" stroke="#f5d0a4" strokeWidth="11" strokeLinecap="round" />

      {marks.map((mark) => (
        <MeasurementMark key={`${mark.key}-${view}`} mark={mark} index={mark.number - 1} />
      ))}
    </g>
  );
}

function MeasurementDiagram({ profileId, marks }) {
  const frontMarks = marks.filter((mark) => mark.view === "front");
  const backMarks = marks.filter((mark) => mark.view === "back").map((mark) => ({
    ...mark,
    x: mark.x ? mark.x - 230 : undefined,
    x1: mark.x1 ? mark.x1 - 230 : undefined,
    x2: mark.x2 ? mark.x2 - 230 : undefined,
  }));

  return (
    <svg className="h-[32rem] w-full" viewBox="0 0 460 290" role="img" aria-label="Measurement placement diagram">
      <rect width="460" height="290" rx="14" fill="#1c1917" />
      <BodyFigure profileId={profileId} view="front" marks={frontMarks} />
      <BodyFigure profileId={profileId} view="back" marks={backMarks} />
    </svg>
  );
}

function MeasurementGuide({ profileId = "male", className = "" }) {
  const guide = guideDefinitions[profileId] || guideDefinitions.male;
  const numberedMarks = guide.marks.map((mark, index) => ({ ...mark, number: index + 1 }));
  const groupedMarks = numberedMarks.reduce((groups, mark) => {
    return {
      ...groups,
      [mark.section]: [...(groups[mark.section] || []), mark],
    };
  }, {});

  return (
    <div className={`overflow-hidden rounded-lg border border-stone-200 bg-white ${className}`}>
      <div className="grid gap-0 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="bg-stone-950 p-4 text-white">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold">{guide.label}</p>
              <p className="mt-1 text-xs text-stone-300">{guide.note}</p>
            </div>
            <span className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-semibold text-amber-200">
              {numberedMarks.length} points
            </span>
          </div>
          <div className="mt-4">
            <MeasurementDiagram profileId={profileId} marks={numberedMarks} />
          </div>
        </div>

        <div className="max-h-[38rem] overflow-y-auto p-4">
          <div className="space-y-4">
            {Object.entries(groupedMarks).map(([section, marks]) => (
              <section key={section} className="rounded-lg bg-stone-50 p-4">
                <h3 className="text-sm font-semibold text-stone-950">{section}</h3>
                <div className="mt-3 grid gap-2">
                  {marks.map((mark) => (
                    <div key={mark.key} className="grid grid-cols-[2rem_1fr] gap-3 rounded-md border border-stone-200 bg-white p-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-stone-950">
                        {mark.number}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-stone-950">{mark.label}</p>
                        <p className="mt-1 text-sm text-stone-500">{mark.instruction}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MeasurementGuide;
