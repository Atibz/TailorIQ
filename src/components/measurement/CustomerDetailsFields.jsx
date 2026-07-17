import React from "react";
import { fieldClass, labelClass, preventNumberInputWheel, referenceObjects } from "./constants";

function CustomerDetailsFields({ isClientMode = false, section = "all", values, profileOptions, onChange }) {
  const selectedReference = referenceObjects.find((object) => object.id === values.referenceObject);
  const needsReferenceSize = values.referenceObject === "measuring-tape";

  const infoFields = (
    <>
      <div>
        <label className={labelClass} htmlFor="fullname">
          {isClientMode ? "Your name*" : "Full name*"}
        </label>
        <input
          className={`${fieldClass} mt-2`}
          id="fullname"
          type="text"
          placeholder={isClientMode ? "Enter your name" : "Enter customer name"}
          name="fullname"
          value={values.fullname}
          onChange={onChange}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="phone">
          Phone number (optional)
        </label>
        <input
          className={`${fieldClass} mt-2`}
          id="phone"
          type="tel"
          placeholder="080..."
          name="phone"
          value={values.phone}
          onChange={onChange}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="measurementProfile">
          Gender*
        </label>
        <select
          className={`${fieldClass} mt-2`}
          id="measurementProfile"
          name="measurementProfile"
          value={values.measurementProfile}
          onChange={onChange}
        >
          {profileOptions.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.label}
            </option>
          ))}
        </select>
      </div>
    </>
  );

  const scaleFields = (
    <>
      {isClientMode && (
        <div>
          <label className={labelClass} htmlFor="measurementProfile">
            Gender*
          </label>
          <select
            className={`${fieldClass} mt-2`}
            id="measurementProfile"
            name="measurementProfile"
            value={values.measurementProfile}
            onChange={onChange}
          >
            {profileOptions.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
        <p className="text-sm font-semibold text-stone-950">Scale anchor*</p>
        <p className="mt-1 text-sm text-stone-500">
          Height gives the best scale. If the client does not know it, include one reference object clearly in both photos.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer gap-3 rounded-md border border-stone-200 bg-white p-3 text-sm text-stone-700">
            <input
              type="radio"
              name="scaleMode"
              value="height"
              checked={values.scaleMode === "height"}
              onChange={onChange}
              className="mt-1 accent-amber-600"
            />
            <span>
              <span className="block font-semibold text-stone-950">I know my height</span>
              <span className="mt-1 block text-stone-500">Recommended for the most accurate result.</span>
            </span>
          </label>

          <label className="flex cursor-pointer gap-3 rounded-md border border-stone-200 bg-white p-3 text-sm text-stone-700">
            <input
              type="radio"
              name="scaleMode"
              value="reference"
              checked={values.scaleMode === "reference"}
              onChange={onChange}
              className="mt-1 accent-amber-600"
            />
            <span>
              <span className="block font-semibold text-stone-950">Use a reference object</span>
              <span className="mt-1 block text-stone-500">For clients who do not know their height.</span>
            </span>
          </label>
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="height">
          Height {values.scaleMode === "height" ? "*" : "(optional)"}
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
            onChange={onChange}
            onWheel={preventNumberInputWheel}
          />
          <select
            className="min-h-11 rounded-md border border-stone-300 bg-white px-2 text-sm text-stone-950 outline-none transition focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
            name="heightUnit"
            value={values.heightUnit}
            onChange={onChange}
            aria-label="Height unit"
          >
            <option value="cm">cm</option>
            <option value="in">in</option>
          </select>
        </div>
      </div>

      {values.scaleMode === "reference" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="referenceObject">
                Reference object*
              </label>
              <select
                className={`${fieldClass} mt-2`}
                id="referenceObject"
                name="referenceObject"
                value={values.referenceObject}
                onChange={onChange}
              >
                {referenceObjects.map((object) => (
                  <option key={object.id} value={object.id}>
                    {object.label}
                  </option>
                ))}
              </select>
            </div>

            {needsReferenceSize && (
              <div>
                <label className={labelClass} htmlFor="referenceSize">
                  Visible size*
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    className={fieldClass}
                    id="referenceSize"
                    type="number"
                    min="1"
                    step="0.1"
                    placeholder="30 or 12"
                    name="referenceSize"
                    value={values.referenceSize}
                    onChange={onChange}
                    onWheel={preventNumberInputWheel}
                  />
                  <select
                    className="min-h-11 rounded-md border border-stone-300 bg-white px-2 text-sm text-stone-950 outline-none transition focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
                    name="referenceUnit"
                    value={values.referenceUnit}
                    onChange={onChange}
                    aria-label="Reference unit"
                  >
                    <option value="cm">cm</option>
                    <option value="in">in</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <p className="mt-3 text-sm text-amber-900">{selectedReference?.detail}</p>
        </div>
      )}
    </>
  );

  if (section === "info") {
    return infoFields;
  }

  if (section === "scale") {
    return scaleFields;
  }

  return (
    <>
      {infoFields}
      {scaleFields}
    </>
  );
}

export default CustomerDetailsFields;
