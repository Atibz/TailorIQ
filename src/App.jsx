import React, { useMemo, useState } from "react";
import Form from "./components/Form";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: "M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-11h6V4h-6v5Z" },
  { id: "customers", label: "Customers", icon: "M16 11c1.66 0 3-1.57 3-3.5S17.66 4 16 4s-3 1.57-3 3.5 1.34 3.5 3 3.5ZM8 11c1.66 0 3-1.57 3-3.5S9.66 4 8 4 5 5.57 5 7.5 6.34 11 8 11Zm8 2c-2.33 0-7 1.21-7 3.6V20h14v-3.4c0-2.39-4.67-3.6-7-3.6ZM8 13c-.29 0-.62.02-.97.06C5.01 13.3 1 14.33 1 16.6V20h6v-3.4c0-1.34.77-2.48 2.01-3.39C8.64 13.08 8.3 13 8 13Z" },
  { id: "new", label: "New measurement", icon: "M5 4h14v2H5V4Zm0 4h14v2H5V8Zm0 4h9v2H5v-2Zm0 4h6v2H5v-2Zm12-4h2v3h3v2h-3v3h-2v-3h-3v-2h3v-3Z" },
];

const sampleCustomers = [
  {
    id: 1,
    fullname: "Aisha Bello",
    height: "168",
    weight: "64",
    heightUnit: "cm",
    status: "Ready for fitting",
  },
  {
    id: 2,
    fullname: "Daniel Okoro",
    height: "181",
    weight: "78",
    heightUnit: "cm",
    status: "Measurements drafted",
  },
];

const roundHalf = (value) => Math.round(value * 2) / 2;
const cmToInches = (value) => roundHalf(value / 2.54);
const inchesToCm = (value) => roundHalf(value * 2.54);
const getHeightCm = (customer) =>
  customer.heightUnit === "in" ? inchesToCm(Number(customer.height)) : Number(customer.height);

const formatLength = (valueCm) => `${roundHalf(valueCm)} cm / ${cmToInches(valueCm)} in`;

function ellipseCircumference(width, depth) {
  const a = Math.max(width / 2, 1);
  const b = Math.max(depth / 2, 1);

  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}

function scaledRatio(metric, ratio, height, fallback) {
  return metric?.[ratio] ? metric[ratio] * height : fallback;
}

function getPhotoConfidence(customer) {
  const uploadedViews = customer.photoViews?.filter((photo) => photo.fileName).length || 0;
  const captureScore = Number(customer.captureQuality || 0);
  const score = Math.min(100, 45 + uploadedViews * 18 + captureScore * 4);

  if (score >= 85) {
    return { score, label: "High confidence", note: "Front and side photos include a usable scale reference." };
  }

  if (score >= 68) {
    return { score, label: "Good confidence", note: "Photos improve the estimate, but a clearer scale reference helps." };
  }

  return { score, label: "Draft estimate", note: "Use as a starting point and confirm during fitting." };
}

function processMeasurements(customer) {
  const height = getHeightCm(customer);
  const weight = Number(customer.weight);
  const weightAdjustment = (weight - height * 0.42) * 0.18;
  const photoAdjustment = (customer.photoViews?.length || 0) >= 2 ? 0.5 : 0;
  const frontPose = customer.poseMetrics?.front;
  const sidePose = customer.poseMetrics?.side;
  const hasPoseMetrics = Boolean(frontPose);

  const estimatedChest = height * 0.255 + weight * 0.34 + photoAdjustment + 3;
  const estimatedShoulder = height * 0.118 + 17;
  const shoulderWidth = scaledRatio(frontPose, "shoulderWidthRatio", height, estimatedShoulder);
  const hipWidth = scaledRatio(frontPose, "hipWidthRatio", height, height * 0.195);
  const torsoLength = scaledRatio(frontPose, "torsoLengthRatio", height, height * 0.31);
  const frontSleeve = scaledRatio(frontPose, "sleeveLengthRatio", height, height * 0.325);
  const frontTrouser = scaledRatio(frontPose, "trouserLengthRatio", height, height * 0.58);
  const frontInseam = scaledRatio(frontPose, "inseamRatio", height, height * 0.455);
  const sideDepthBase = scaledRatio(sidePose, "hipWidthRatio", height, hipWidth * 0.44);
  const chestWidth = shoulderWidth * 0.94;
  const chestDepth = Math.max(sideDepthBase * 1.05, chestWidth * 0.41);
  const waistWidth = (chestWidth + hipWidth) / 2 - 2;
  const waistDepth = Math.max(sideDepthBase * 0.95, waistWidth * 0.38);
  const hipDepth = Math.max(sideDepthBase * 1.12, hipWidth * 0.48);

  const poseChest = ellipseCircumference(chestWidth, chestDepth) + weightAdjustment;
  const poseWaist = ellipseCircumference(waistWidth, waistDepth) + weightAdjustment * 0.75;
  const poseHip = ellipseCircumference(hipWidth, hipDepth) + weightAdjustment * 0.8;
  const chest = roundHalf(hasPoseMetrics ? poseChest : estimatedChest);
  const waist = roundHalf(hasPoseMetrics ? poseWaist : chest - 4);
  const hip = roundHalf(hasPoseMetrics ? poseHip : chest + 3);
  const shoulder = roundHalf(hasPoseMetrics ? shoulderWidth : estimatedShoulder);
  const sleeve = roundHalf(frontSleeve);
  const topLength = roundHalf(torsoLength + height * 0.13);
  const trouserLength = roundHalf(frontTrouser);
  const inseam = roundHalf(frontInseam);
  const neck = roundHalf(chest * 0.35 + 5);
  const notePrefix = hasPoseMetrics ? "Pose-assisted" : "Estimated";

  return [
    { label: "Chest", valueCm: chest, note: `${notePrefix} circumference from width and side depth` },
    { label: "Waist", valueCm: waist, note: `${notePrefix} natural waist line` },
    { label: "Hip", valueCm: hip, note: `${notePrefix} seat measurement` },
    { label: "Shoulder", valueCm: shoulder, note: `${notePrefix} shoulder point to point` },
    { label: "Sleeve", valueCm: sleeve, note: `${notePrefix} shoulder to wrist` },
    { label: "Top length", valueCm: topLength, note: `${notePrefix} shoulder to desired hem` },
    { label: "Trouser length", valueCm: trouserLength, note: `${notePrefix} waist to ankle` },
    { label: "Inseam", valueCm: inseam, note: `${notePrefix} crotch to ankle` },
    { label: "Neck", valueCm: neck, note: "Collar allowance included" },
  ];
}

function Sidebar({ activePage, onNavigate }) {
  return (
    <aside className="flex w-full flex-col border-b border-stone-200 bg-stone-950 text-white md:min-h-screen md:w-72 md:border-b-0 md:border-r md:border-stone-800">
      <div className="px-6 py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">
          TailorIQ
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal">Measurement Studio</h1>
      </div>

      <nav className="flex gap-2 overflow-x-auto px-4 pb-4 md:flex-col md:overflow-visible">
        {navItems.map((item) => {
          const active = activePage === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`flex min-h-11 shrink-0 items-center gap-3 rounded-md px-4 text-sm font-medium transition ${
                active
                  ? "bg-amber-500 text-stone-950 shadow-sm"
                  : "text-stone-300 hover:bg-stone-900 hover:text-white"
              }`}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                <path d={item.icon} />
              </svg>
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto hidden px-6 py-6 text-sm text-stone-400 md:block">
        <p className="font-medium text-stone-200">Today</p>
        <p className="mt-2">Capture height, weight, front photo, and side photo for measurement drafts.</p>
      </div>
    </aside>
  );
}

function Dashboard({ customers, latestCustomer }) {
  const stats = [
    { label: "Total customers", value: customers.length },
    { label: "Drafted measurements", value: customers.filter((customer) => customer.measurements).length },
    { label: "Pending reviews", value: customers.filter((customer) => !customer.measurements).length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-amber-700">Dashboard</p>
        <h2 className="mt-2 text-3xl font-semibold text-stone-950">Tailor measurement workspace</h2>
        <p className="mt-3 max-w-2xl text-stone-600">
          Manage customer profiles, begin new measurements, and review processed measurement drafts from one place.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">{stat.label}</p>
            <p className="mt-3 text-3xl font-semibold text-stone-950">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-stone-950">Recent customers</h3>
            <span className="text-sm text-stone-500">{customers.length} records</span>
          </div>
          <div className="mt-4 divide-y divide-stone-100">
            {customers.slice(0, 4).map((customer) => (
              <div key={customer.id} className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="font-medium text-stone-900">{customer.fullname}</p>
                  <p className="text-sm text-stone-500">
                    {customer.height ? `${formatLength(getHeightCm(customer))} height` : "No height added"}
                  </p>
                </div>
                <span className="rounded-md bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">
                  {customer.measurements ? "Processed" : customer.status}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-stone-950">Latest measurement</h3>
          {latestCustomer ? (
            <div className="mt-4">
              <p className="text-2xl font-semibold text-stone-950">{latestCustomer.fullname}</p>
              <p className="mt-2 text-sm text-stone-500">
                Based on {formatLength(getHeightCm(latestCustomer))} height and {latestCustomer.weight || "unknown"} kg weight
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {latestCustomer.measurements?.slice(0, 4).map((measurement) => (
                  <div key={measurement.label} className="rounded-md bg-amber-50 p-3">
                    <p className="text-xs text-amber-800">{measurement.label}</p>
                    <p className="mt-1 text-lg font-semibold text-stone-950">{formatLength(measurement.valueCm)}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-stone-600">Create a new measurement to see the latest processed draft here.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function Customers({ customers, onViewMeasurement }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-amber-700">Customers</p>
        <h2 className="mt-2 text-3xl font-semibold text-stone-950">Customer records</h2>
      </div>

      <section className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
        <div className="hidden grid-cols-[1.2fr_1fr_0.8fr_0.9fr_0.7fr] gap-4 border-b border-stone-200 bg-stone-50 px-5 py-3 text-sm font-semibold text-stone-600 md:grid">
          <span>Name</span>
          <span>Height</span>
          <span>Weight</span>
          <span>Status</span>
          <span>Action</span>
        </div>
        <div className="divide-y divide-stone-100">
          {customers.map((customer) => (
            <div
              key={customer.id}
              className="grid grid-cols-1 gap-2 px-5 py-4 text-sm text-stone-700 md:grid-cols-[1.2fr_1fr_0.8fr_0.9fr_0.7fr] md:items-center md:gap-4"
            >
              <span className="font-medium text-stone-950">{customer.fullname}</span>
              <span>{customer.height ? formatLength(getHeightCm(customer)) : "Not added"}</span>
              <span>{customer.weight ? `${customer.weight} kg` : "Not added"}</span>
              <span>{customer.measurements ? "Processed" : customer.status}</span>
              <button
                type="button"
                onClick={() => onViewMeasurement(customer)}
                disabled={!customer.measurements}
                className="min-h-10 rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-400"
              >
                View
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function MeasurementResults({ customer, onStartNew }) {
  if (!customer) {
    return null;
  }

  const confidence = getPhotoConfidence(customer);

  return (
    <section className="min-w-0 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-4 border-b border-stone-100 pb-5 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <p className="text-sm font-medium text-amber-700">Processed measurements</p>
          <h3 className="mt-2 break-words text-2xl font-semibold text-stone-950">{customer.fullname}</h3>
          <p className="mt-2 text-sm text-stone-500">Draft from height, weight, front photo, and side photo</p>
        </div>
        <button
          type="button"
          onClick={onStartNew}
          className="min-h-11 rounded-md bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800"
        >
          New measurement
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        <div className="min-w-0 rounded-lg bg-stone-50 p-4">
          <p className="text-xs font-medium uppercase text-stone-500">Height</p>
          <p className="mt-2 break-words text-base font-semibold text-stone-950">{formatLength(getHeightCm(customer))}</p>
        </div>
        <div className="min-w-0 rounded-lg bg-stone-50 p-4">
          <p className="text-xs font-medium uppercase text-stone-500">Weight</p>
          <p className="mt-2 break-words text-base font-semibold text-stone-950">{customer.weight} kg</p>
        </div>
        <div className="min-w-0 rounded-lg bg-stone-50 p-4">
          <p className="text-xs font-medium uppercase text-stone-500">Photo check</p>
          <p className="mt-2 break-words text-base font-semibold text-stone-950">{confidence.label}</p>
        </div>
        <div className="min-w-0 rounded-lg bg-stone-50 p-4">
          <p className="text-xs font-medium uppercase text-stone-500">Accuracy score</p>
          <p className="mt-2 break-words text-base font-semibold text-stone-950">{confidence.score}%</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-stone-500">{confidence.note}</p>

      <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-stone-950">Processing flow</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {(customer.pipeline || ["Camera", "OpenCV preprocessing", "MediaPipe Pose", "Measurement formulas", "AI adjustment"]).map((step, index) => (
            <div key={step} className="min-w-0 rounded-md bg-white p-3">
              <p className="text-xs font-semibold text-amber-700">Step {index + 1}</p>
              <p className="mt-1 break-words text-sm font-medium text-stone-900">{step}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {customer.measurements.map((measurement) => (
          <div key={measurement.label} className="min-w-0 rounded-lg border border-stone-200 p-4">
            <div className="grid gap-3">
              <div className="min-w-0">
                <p className="font-medium text-stone-950">{measurement.label}</p>
                <p className="mt-1 text-sm text-stone-500">{measurement.note}</p>
              </div>
              <p className="break-words rounded-md bg-amber-50 px-3 py-2 text-base font-semibold text-amber-700">
                {formatLength(measurement.valueCm)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {customer.photoViews?.length > 0 && (
        <div className="mt-5 rounded-lg border border-stone-200 p-4">
          <p className="text-sm font-semibold text-stone-950">Uploaded photos</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {customer.photoViews.map((photo) => (
              <div key={photo.view} className="min-w-0 rounded-md bg-stone-50 p-3">
                <p className="text-sm font-medium text-stone-900">{photo.view}</p>
                <p className="mt-1 break-words text-sm text-stone-500">{photo.fileName || "Not uploaded"}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </section>
  );
}

function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [customers, setCustomers] = useState(sampleCustomers);
  const [processedCustomer, setProcessedCustomer] = useState(null);
  const latestCustomer = useMemo(
    () => customers.find((customer) => customer.measurements) || processedCustomer,
    [customers, processedCustomer],
  );

  const handleViewMeasurement = (customer) => {
    setProcessedCustomer(customer);
    setActivePage("results");
  };

  const handleCustomerSubmit = (customerData) => {
    const customer = {
      ...customerData,
      id: Date.now(),
      status: "Measurements drafted",
      measurements: processMeasurements(customerData),
    };

    setCustomers((currentCustomers) => [customer, ...currentCustomers]);
    setProcessedCustomer(customer);
    setActivePage("results");
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 md:flex">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10">
        {activePage === "dashboard" && (
          <Dashboard customers={customers} latestCustomer={latestCustomer} />
        )}

        {activePage === "customers" && (
          <Customers
            customers={customers}
            onViewMeasurement={handleViewMeasurement}
          />
        )}

        {activePage === "new" && (
          <div className="mx-auto max-w-6xl">
            <Form onSubmitCustomer={handleCustomerSubmit} />
          </div>
        )}

        {activePage === "results" && (
          <MeasurementResults
            customer={processedCustomer}
            onStartNew={() => {
              setProcessedCustomer(null);
              setActivePage("new");
            }}
          />
        )}
      </main>
    </div>
  );
}

export default App;
