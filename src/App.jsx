import React, { useCallback, useEffect, useMemo, useState } from "react";
import Form from "./components/Form";
import MeasurementGuide from "./components/MeasurementGuide";
import { preventNumberInputWheel } from "./components/measurement/constants";
import { requestSegmentationMeasurements } from "./services/segmentationMeasurementApi";
import {
  buildBackendMeasurements,
  buildCorrectionLog,
  buildManualMeasurements,
  cmToInches,
  formatLength,
  getHeightCm,
  getScaleHeightCm,
  getScaleSourceLabel,
  processMeasurements,
  roundHalf,
  toCm,
} from "./shared/measurementCalculations";
import { getProfile, getProfileLabel, profileOptions } from "./shared/measurementProfiles";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: "M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-11h6V4h-6v5Z" },
  { id: "customers", label: "Customers", icon: "M16 11c1.66 0 3-1.57 3-3.5S17.66 4 16 4s-3 1.57-3 3.5 1.34 3.5 3 3.5ZM8 11c1.66 0 3-1.57 3-3.5S9.66 4 8 4 5 5.57 5 7.5 6.34 11 8 11Zm8 2c-2.33 0-7 1.21-7 3.6V20h14v-3.4c0-2.39-4.67-3.6-7-3.6ZM8 13c-.29 0-.62.02-.97.06C5.01 13.3 1 14.33 1 16.6V20h6v-3.4c0-1.34.77-2.48 2.01-3.39C8.64 13.08 8.3 13 8 13Z" },
  { id: "new", label: "New measurement", icon: "M5 4h14v2H5V4Zm0 4h14v2H5V8Zm0 4h9v2H5v-2Zm0 4h6v2H5v-2Zm12-4h2v3h3v2h-3v3h-2v-3h-3v-2h3v-3Z" },
  { id: "drafts", label: "Drafts", icon: "M5 3h10l4 4v14H5V3Zm9 1.5V8h3.5L14 4.5ZM8 11h8v2H8v-2Zm0 4h8v2H8v-2Z" },
  { id: "manual", label: "Manual input", icon: "M4 4h16v2H4V4Zm0 4h10v2H4V8Zm0 4h16v2H4v-2Zm0 4h10v2H4v-2Zm13-8h3v3h-3V8Zm0 8h3v3h-3v-3Z" },
];

const CUSTOMER_STORAGE_KEY = "tailoriq_customers";
const MEASUREMENT_DRAFT_STORAGE_KEY = "tailoriq_measurement_drafts";
const LEGACY_MEASUREMENT_DRAFT_STORAGE_KEY = "tailoriq_measurement_draft";

function loadStoredCustomers() {
  try {
    const savedCustomers = window.localStorage.getItem(CUSTOMER_STORAGE_KEY);

    return savedCustomers ? JSON.parse(savedCustomers) : [];
  } catch {
    return [];
  }
}

function saveStoredCustomers(customers) {
  try {
    window.localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(customers));
  } catch {
    // Keep the app usable if storage is unavailable or full.
  }
}

function normalizeDraft(draft) {
  return {
    ...draft,
    id: draft.id || Date.now(),
    createdAt: draft.createdAt || draft.updatedAt || new Date().toISOString(),
    updatedAt: draft.updatedAt || new Date().toISOString(),
  };
}

function loadMeasurementDrafts() {
  try {
    const savedDraft = window.localStorage.getItem(MEASUREMENT_DRAFT_STORAGE_KEY);
    const legacyDraft = window.localStorage.getItem(LEGACY_MEASUREMENT_DRAFT_STORAGE_KEY);

    if (savedDraft) {
      const parsedDraft = JSON.parse(savedDraft);
      return Array.isArray(parsedDraft) ? parsedDraft.map(normalizeDraft) : [normalizeDraft(parsedDraft)];
    }

    return legacyDraft ? [normalizeDraft(JSON.parse(legacyDraft))] : [];
  } catch {
    return [];
  }
}

function saveMeasurementDrafts(drafts) {
  try {
    window.localStorage.setItem(MEASUREMENT_DRAFT_STORAGE_KEY, JSON.stringify(drafts));
    window.localStorage.removeItem(LEGACY_MEASUREMENT_DRAFT_STORAGE_KEY);
    return true;
  } catch {
    // Keep the app usable if storage is unavailable or full.
    return false;
  }
}

function deleteStoredMeasurementDrafts() {
  try {
    window.localStorage.removeItem(MEASUREMENT_DRAFT_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_MEASUREMENT_DRAFT_STORAGE_KEY);
  } catch {
    // Keep the app usable if storage is unavailable.
  }
}

function getPhotoConfidence(customer) {
  if (customer.measurementSource === "manual") {
    return {
      score: 100,
      label: "Manual input",
      note: "These measurements were entered manually and were not generated from photos.",
    };
  }

  const uploadedViews = customer.photoViews?.filter((photo) => photo.fileName).length || 0;
  const captureScore = Number(customer.captureQuality || 0);
  const score = Math.min(100, 45 + uploadedViews * 18 + captureScore * 4);

  if (score >= 85) {
    return { score, label: "High confidence", note: "Front and side photos include a usable scale anchor." };
  }

  if (score >= 68) {
    return { score, label: "Good confidence", note: "Photos improve the estimate, but a clearer scale anchor helps." };
  }

  return { score, label: "Draft estimate", note: "Use as a starting point and confirm during fitting." };
}

function BackButton({ onClick, label = "Back" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.42-1.41L7.83 13H20v-2Z" />
      </svg>
      {label}
    </button>
  );
}

function ConfirmDeleteModal({ action, onCancel, onConfirm }) {
  if (!action) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 px-4 py-6">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-700">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M12 2 1 21h22L12 2Zm1 16h-2v-2h2v2Zm0-4h-2V9h2v5Z" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-semibold text-stone-950">{action.title}</p>
            <p className="mt-2 text-sm text-stone-600">{action.message}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-11 rounded-md bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ activePage, onNavigate }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const activeItem = navItems.find((item) => item.id === activePage) || navItems[0];
  const handleNavigate = (page) => {
    onNavigate(page);
    setMobileMenuOpen(false);
  };

  return (
    <aside className="flex w-full flex-col border-b border-stone-200 bg-stone-950 text-white md:min-h-screen md:w-72 md:border-b-0 md:border-r md:border-stone-800">
      <div className="flex items-center justify-between gap-4 px-4 py-4 md:block md:px-6 md:py-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">
            TailorIQ
          </p>
          <h1 className="mt-2 text-xl font-semibold tracking-normal md:mt-3 md:text-2xl">Measurement Studio</h1>
          <p className="mt-1 text-xs font-medium text-stone-400 md:hidden">{activeItem.label}</p>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen((currentOpen) => !currentOpen)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-stone-700 text-stone-100 transition hover:bg-stone-900 md:hidden"
          aria-expanded={mobileMenuOpen}
          aria-label="Open navigation menu"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-current">
            <path d={mobileMenuOpen ? "M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6 6.4 5Z" : "M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z"} />
          </svg>
        </button>
      </div>

      <nav className={`${mobileMenuOpen ? "grid" : "hidden"} gap-2 px-4 pb-4 md:grid md:flex-col md:overflow-visible`}>
        {navItems.map((item) => {
          const active = activePage === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item.id)}
              className={`flex min-h-11 items-center gap-3 rounded-md px-4 text-sm font-medium transition ${
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
        <p className="mt-2">Capture a height scale anchor, front photo, and side photo for measurement drafts.</p>
      </div>
    </aside>
  );
}

function Dashboard({ customers, draftCount, latestCustomer, onNewMeasurement, onManualInput, onViewDrafts, onViewCustomers }) {
  const stats = [
    { label: "Total customers", value: customers.length },
    { label: "Drafted measurements", value: draftCount },
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={onNewMeasurement}
          className="min-h-24 rounded-lg border border-amber-200 bg-amber-50 p-4 text-left transition hover:border-amber-300 hover:bg-amber-100"
        >
          <span className="text-sm font-semibold text-amber-800">New photo measurement</span>
          <span className="mt-2 block text-sm text-stone-600">Capture or upload front and side photos.</span>
        </button>
        <button
          type="button"
          onClick={onManualInput}
          className="min-h-24 rounded-lg border border-stone-200 bg-white p-4 text-left transition hover:bg-stone-50"
        >
          <span className="text-sm font-semibold text-stone-950">Manual measurement</span>
          <span className="mt-2 block text-sm text-stone-600">Save measurements taken with a tape.</span>
        </button>
        <button
          type="button"
          onClick={onViewDrafts}
          className="min-h-24 rounded-lg border border-stone-200 bg-white p-4 text-left transition hover:bg-stone-50"
        >
          <span className="text-sm font-semibold text-stone-950">Continue draft</span>
          <span className="mt-2 block text-sm text-stone-600">{draftCount} unfinished measurement{draftCount === 1 ? "" : "s"}.</span>
        </button>
        <button
          type="button"
          onClick={onViewCustomers}
          className="min-h-24 rounded-lg border border-stone-200 bg-white p-4 text-left transition hover:bg-stone-50"
        >
          <span className="text-sm font-semibold text-stone-950">View customers</span>
          <span className="mt-2 block text-sm text-stone-600">Open saved measurement records.</span>
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => {
          const isDraftStat = stat.label === "Drafted measurements";
          const StatElement = isDraftStat ? "button" : "div";

          return (
          <StatElement
            key={stat.label}
            type={isDraftStat ? "button" : undefined}
            onClick={isDraftStat ? onViewDrafts : undefined}
            className={`rounded-lg border border-stone-200 bg-white p-5 text-left shadow-sm ${
              isDraftStat ? "transition hover:border-amber-300 hover:bg-amber-50" : ""
            }`}
          >
            <p className="text-sm text-stone-500">{stat.label}</p>
            <p className="mt-3 text-3xl font-semibold text-stone-950">{stat.value}</p>
          </StatElement>
          );
        })}
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
                    {customer.height ? `${formatLength(getHeightCm(customer))} height` : getScaleSourceLabel(customer)}
                  </p>
                </div>
                <span className="rounded-md bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">
                  {customer.measurementSource === "manual"
                    ? "Manual input"
                    : customer.measurements
                      ? "Processed"
                      : customer.status}
                </span>
              </div>
            ))}
            {customers.length === 0 && (
              <p className="py-6 text-sm text-stone-500">
                No customer records yet. Start with a new measurement or manual input.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-stone-950">Latest measurement</h3>
          {latestCustomer ? (
            <div className="mt-4">
              <p className="text-2xl font-semibold text-stone-950">{latestCustomer.fullname}</p>
              <p className="mt-2 text-sm text-stone-500">
                {latestCustomer.measurementSource === "manual"
                  ? "Manual measurements saved"
                  : `Based on ${getScaleSourceLabel(latestCustomer)}, front photo, and side photo`}
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

function Customers({ customers, onBack, onViewMeasurement, onDeleteCustomer }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [profileFilter, setProfileFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = [profileFilter !== "all", sourceFilter !== "all", sortOrder !== "newest"].filter(Boolean).length;
  const filteredCustomers = customers
    .filter((customer) => customer.fullname.toLowerCase().includes(searchTerm.trim().toLowerCase()))
    .filter((customer) => profileFilter === "all" || customer.measurementProfile === profileFilter)
    .filter((customer) => {
      if (sourceFilter === "manual") {
        return customer.measurementSource === "manual";
      }

      if (sourceFilter === "photo") {
        return customer.measurementSource !== "manual";
      }

      return true;
    })
    .sort((firstCustomer, secondCustomer) => {
      if (sortOrder === "name") {
        return firstCustomer.fullname.localeCompare(secondCustomer.fullname);
      }

      if (sortOrder === "oldest") {
        return Number(firstCustomer.id) - Number(secondCustomer.id);
      }

      return Number(secondCustomer.id) - Number(firstCustomer.id);
    });

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <BackButton onClick={onBack} label="Back to dashboard" />
        <div>
          <p className="text-sm font-medium text-amber-700">Customers</p>
          <h2 className="mt-2 text-3xl font-semibold text-stone-950">Customer records</h2>
        </div>
      </div>

      <section className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex items-end gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <label className="text-xs font-semibold uppercase text-stone-500" htmlFor="customer-search">Search</label>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                  <path d="M9.5 3a6.5 6.5 0 0 1 5.16 10.45l4.44 4.45-1.41 1.41-4.45-4.44A6.5 6.5 0 1 1 9.5 3Zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z" />
                </svg>
              </span>
              <input
                id="customer-search"
                className="min-h-11 w-full rounded-md border border-stone-300 px-10 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by customer name"
              />
            </div>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setFiltersOpen((currentOpen) => !currentOpen)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 sm:px-4"
              aria-expanded={filtersOpen}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                <path d="M3 5h18v2H3V5Zm4 6h10v2H7v-2Zm3 6h4v2h-4v-2Z" />
              </svg>
              <span className="hidden sm:inline">Filter</span>
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-stone-950">{activeFilterCount}</span>
              )}
            </button>
            {filtersOpen && (
              <div className="absolute right-0 z-20 mt-2 w-full min-w-72 rounded-lg border border-stone-200 bg-white p-4 shadow-xl md:w-80">
                <div className="grid gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase text-stone-500" htmlFor="customer-profile-filter">
                      Gender
                    </label>
                    <select
                      id="customer-profile-filter"
                      className="mt-2 min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
                      value={profileFilter}
                      onChange={(event) => setProfileFilter(event.target.value)}
                    >
                      <option value="all">All genders</option>
                      {profileOptions.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-stone-500" htmlFor="customer-source-filter">
                      Source
                    </label>
                    <select
                      id="customer-source-filter"
                      className="mt-2 min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
                      value={sourceFilter}
                      onChange={(event) => setSourceFilter(event.target.value)}
                    >
                      <option value="all">All sources</option>
                      <option value="photo">Photo measurements</option>
                      <option value="manual">Manual input</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-stone-500" htmlFor="customer-sort">
                      Sort
                    </label>
                    <select
                      id="customer-sort"
                      className="mt-2 min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
                      value={sortOrder}
                      onChange={(event) => setSortOrder(event.target.value)}
                    >
                      <option value="newest">Newest first</option>
                      <option value="oldest">Oldest first</option>
                      <option value="name">Name A-Z</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileFilter("all");
                      setSourceFilter("all");
                      setSortOrder("newest");
                    }}
                    className="min-h-10 rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
                  >
                    Clear filters
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {filteredCustomers.map((customer) => {
          const statusLabel = customer.measurementSource === "manual"
            ? "Manual input"
            : customer.measurements
              ? "Processed"
              : customer.status;

          return (
            <article
              key={customer.id}
              className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm transition hover:border-amber-200"
            >
              <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-[1.05fr_1.35fr_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-800">
                      {customer.fullname?.trim()?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="break-words text-base font-semibold text-stone-950 sm:text-lg">{customer.fullname}</h3>
                        <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-700">
                          {statusLabel}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-stone-500">
                        {getProfileLabel(customer.measurementProfile)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div className="rounded-md bg-stone-50 px-3 py-2 sm:p-3">
                    <p className="text-[0.68rem] font-semibold uppercase text-stone-500">Scale</p>
                    <p className="mt-1 truncate font-medium text-stone-900">
                      {customer.height ? formatLength(getHeightCm(customer)) : getScaleSourceLabel(customer)}
                    </p>
                  </div>
                  <div className="hidden rounded-md bg-stone-50 px-3 py-2 sm:block sm:p-3">
                    <p className="text-[0.68rem] font-semibold uppercase text-stone-500">Gender</p>
                    <p className="mt-1 font-medium text-stone-900">
                      {getProfileLabel(customer.measurementProfile)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-stone-100 pt-3 lg:flex lg:border-t-0 lg:pt-0 lg:justify-end">
                  <button
                    type="button"
                    onClick={() => onViewMeasurement(customer)}
                    disabled={!customer.measurements}
                    className="inline-flex min-h-10 items-center justify-center rounded-md bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300 lg:min-w-20"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteCustomer(customer)}
                    className="inline-flex min-h-10 items-center justify-center rounded-md border border-red-200 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50 lg:min-w-20"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          );
        })}

        {customers.length === 0 && (
          <div className="rounded-lg border border-stone-200 bg-white px-5 py-8 text-sm text-stone-500 shadow-sm">
            No customer records yet. Create a new measurement or save a manual measurement to begin.
          </div>
        )}
        {customers.length > 0 && filteredCustomers.length === 0 && (
          <div className="rounded-lg border border-stone-200 bg-white px-5 py-8 text-sm text-stone-500 shadow-sm">
            No records match the current search and filters.
          </div>
        )}
      </section>

    </div>
  );
}

function Drafts({ drafts, onBack, onContinueDraft, onDeleteDraft, onStartNew }) {
  const reviewDrafts = drafts.filter((draft) => draft.stage === "review");
  const captureDrafts = drafts.filter((draft) => draft.stage !== "review");
  const renderDraftSection = (sectionDrafts, title, description, emptyText) => (
    <section className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-100 bg-stone-50 px-5 py-4">
        <h3 className="text-sm font-semibold text-stone-950">{title}</h3>
        <p className="mt-1 text-sm text-stone-500">{description}</p>
      </div>
      <div className="hidden grid-cols-[1.3fr_0.8fr_0.8fr_1fr] gap-4 border-b border-stone-100 bg-white px-5 py-3 text-xs font-semibold uppercase text-stone-500 md:grid">
        <span>Customer</span>
        <span>Captured</span>
        <span>Scale</span>
        <span className="text-right">Actions</span>
      </div>
      <div className="divide-y divide-stone-100">
        {sectionDrafts.map((draft) => {
          const isReviewDraft = draft.stage === "review";
          const name = isReviewDraft
            ? draft.reviewCustomer?.fullname?.trim() || "Untitled review"
            : draft.values?.fullname?.trim() || "Untitled measurement";
          const capturedViews = isReviewDraft
            ? draft.reviewCustomer?.photoViews?.filter((photo) => photo.fileName).length || 0
            : [draft.photos?.front, draft.photos?.side].filter(Boolean).length;
          const updatedAt = draft.updatedAt ? new Date(draft.updatedAt).toLocaleString() : "Recently";

          return (
            <div key={draft.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1.3fr_0.8fr_0.8fr_1fr] md:items-center">
              <div className="min-w-0">
                <p className="break-words font-medium text-stone-950">{name}</p>
                <p className="mt-1 text-sm text-stone-500">
                  {isReviewDraft ? "Needs review" : "Capture in progress"} - Last edited {updatedAt}
                </p>
              </div>
              <span className="text-sm text-stone-600">{capturedViews}/2 views</span>
              <span className="text-sm text-stone-600">
                {(isReviewDraft ? draft.reviewCustomer?.scaleMode : draft.values?.scaleMode) === "reference" ? "Reference object" : "Known height"}
              </span>
              <div className="flex flex-wrap gap-2 md:justify-end">
                <button
                  type="button"
                  onClick={() => onContinueDraft(draft)}
                  className="min-h-10 rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
                >
                  Continue
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteDraft(draft)}
                  className="min-h-10 rounded-md border border-red-200 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
        {sectionDrafts.length === 0 && (
          <div className="px-5 py-6 text-sm text-stone-500">{emptyText}</div>
        )}
      </div>
    </section>
  );

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <BackButton onClick={onBack} label="Back to dashboard" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-amber-700">Drafts</p>
            <h2 className="mt-2 text-3xl font-semibold text-stone-950">Unfinished measurements</h2>
            <p className="mt-2 text-sm text-stone-500">
              Continue unfinished captures or delete drafts you no longer need.
            </p>
          </div>
          <button
            type="button"
            onClick={onStartNew}
            className="min-h-11 rounded-md bg-amber-600 px-5 text-sm font-semibold text-white transition hover:bg-amber-700"
          >
            New measurement
          </button>
        </div>
      </div>

      {drafts.length === 0 ? (
        <section className="rounded-lg border border-stone-200 bg-white px-5 py-8 text-sm text-stone-500 shadow-sm">
          No drafts yet. Start a new measurement and it will be saved here automatically until it is processed.
        </section>
      ) : (
        <div className="space-y-5">
          {renderDraftSection(
            reviewDrafts,
            "Needs review",
            "Processed measurements that have not been saved as final records.",
            "No review drafts right now.",
          )}
          {renderDraftSection(
            captureDrafts,
            "Capture drafts",
            "Unfinished customer details, photos, or reference marking.",
            "No capture drafts right now.",
          )}
        </div>
      )}
    </div>
  );
}

function ManualMeasurementForm({ onBack, onSaveManual }) {
  const [values, setValues] = useState({
    fullname: "",
    height: "",
    customerNote: "",
    heightUnit: "cm",
    measurementUnit: "cm",
    measurementProfile: "male",
    chest: "",
    waist: "",
    hip: "",
    shoulder: "",
    sleeve: "",
    topLength: "",
    trouserLength: "",
    inseam: "",
    neck: "",
  });
  const [error, setError] = useState("");
  const [openSections, setOpenSections] = useState({});
  const activeProfile = getProfile(values.measurementProfile);
  const toggleSection = (sectionTitle) => {
    setOpenSections((currentSections) => ({
      ...currentSections,
      [sectionTitle]: !(currentSections[sectionTitle] ?? true),
    }));
  };

  const handleChange = (event) => {
    setValues({ ...values, [event.target.name]: event.target.value });
    setError("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!values.fullname.trim()) {
      setError("Customer name is required.");
      return;
    }

    const measurements = buildManualMeasurements(values);

    if (measurements.length === 0) {
      setError("Enter at least one measurement before saving.");
      return;
    }

    onSaveManual({
      ...values,
      fullname: values.fullname.trim(),
      measurements,
      measurementSource: "manual",
      captureMethod: "Manual input",
      status: "Manual measurements saved",
      pipeline: ["Manual input", "Saved customer record"],
    });
  };

  return (
    <section className="mx-auto max-w-6xl rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <div className="space-y-4 border-b border-stone-100 pb-5">
        <BackButton onClick={onBack} label="Back to dashboard" />
        <div>
          <p className="text-sm font-medium text-amber-700">Manual input</p>
          <h2 className="mt-2 text-2xl font-semibold text-stone-950">Enter measurements manually</h2>
          <p className="mt-2 text-sm text-stone-500">
            Save measurements taken outside the app. The customer record will be marked as manual input.
          </p>
        </div>
      </div>

      <form className="mt-5 space-y-5" onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-stone-700" htmlFor="manual-fullname">
              Full name*
            </label>
            <input
              className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
              id="manual-fullname"
              name="fullname"
              value={values.fullname}
              onChange={handleChange}
              placeholder="Enter customer name"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-stone-700" htmlFor="manual-height">
              Height
            </label>
            <div className="mt-2 flex gap-2">
              <input
                className="min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
                id="manual-height"
                name="height"
                type="number"
                value={values.height}
                onChange={handleChange}
                onWheel={preventNumberInputWheel}
                placeholder="170 or 67"
              />
              <select
                className="min-h-11 rounded-md border border-stone-300 px-2 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
                name="heightUnit"
                value={values.heightUnit}
                onChange={handleChange}
                aria-label="Height unit"
              >
                <option value="cm">cm</option>
                <option value="in">in</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-stone-700" htmlFor="manual-customer-note">
            Notes, extra measurements, or client preference
          </label>
          <textarea
            className="mt-2 min-h-28 w-full rounded-md border border-stone-300 px-3 py-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
            id="manual-customer-note"
            name="customerNote"
            value={values.customerNote}
            onChange={handleChange}
            placeholder="Example: Add 1 inch ease to chest, client prefers ankle-length trouser, cap size 23 in."
          />
        </div>

        <div>
          <label className="text-sm font-medium text-stone-700" htmlFor="manual-profile">
            Gender*
          </label>
          <select
            className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
            id="manual-profile"
            name="measurementProfile"
            value={values.measurementProfile}
            onChange={handleChange}
          >
            {profileOptions.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.label}
              </option>
            ))}
          </select>
        </div>

        <MeasurementGuide profileId={values.measurementProfile} />

        <div className="overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
          <div className="sticky top-0 z-10 flex flex-col gap-2 border-b border-stone-200 bg-stone-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-stone-950">{activeProfile.label} measurement sheet</p>
              <p className="mt-1 text-sm text-stone-500">{activeProfile.description}</p>
            </div>
            <select
              className="min-h-10 rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
              name="measurementUnit"
              value={values.measurementUnit}
              onChange={handleChange}
              aria-label="Measurement unit"
            >
              <option value="cm">Centimeters</option>
              <option value="in">Inches</option>
            </select>
          </div>

          <div className="space-y-4 p-4">
            {activeProfile.sections.map((section) => {
              const isOpen = openSections[section.title] ?? true;

              return (
                <section key={section.title} className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.title)}
                    className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-stone-50"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-stone-950">{section.title}</span>
                      <span className="mt-1 block text-sm text-stone-500">{section.description}</span>
                    </span>
                    <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-600">
                      {isOpen ? "Hide" : "Show"}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="grid gap-4 border-t border-stone-100 p-4 sm:grid-cols-2 lg:grid-cols-3">
                      {section.fields.map((field) => (
                        <div key={`${section.title}-${field.key}`}>
                          <label className="text-sm font-medium text-stone-700" htmlFor={`manual-${section.title}-${field.key}`}>
                            {field.label}
                          </label>
                          <input
                            className="mt-2 min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
                            id={`manual-${section.title}-${field.key}`}
                            name={field.key}
                            type="number"
                            min="0"
                            step="0.1"
                            value={values[field.key] || ""}
                            onChange={handleChange}
                            onWheel={preventNumberInputWheel}
                            placeholder={values.measurementUnit}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end border-t border-stone-100 pt-5">
          <button
            type="submit"
            className="min-h-11 rounded-md bg-amber-600 px-5 text-sm font-semibold text-white transition hover:bg-amber-700"
          >
            Save manual measurements
          </button>
        </div>
      </form>
    </section>
  );
}

function MeasurementReview({ draftCustomer, onSaveReview, onCancel, onDraftChange, onClearDraft }) {
  const isEditingSavedRecord = draftCustomer?.editMode === "saved-record";
  const [reviewDraftId] = useState(() => draftCustomer?.draftStorageId || `review-${draftCustomer?.id || Date.now()}`);
  const [unit, setUnit] = useState(draftCustomer?.reviewState?.unit || "in");
  const [customerNote, setCustomerNote] = useState(draftCustomer?.reviewState?.customerNote ?? draftCustomer?.customerNote ?? "");
  const [values, setValues] = useState(
    () =>
      draftCustomer?.reviewState?.values ||
      draftCustomer?.measurements.reduce((currentValues, measurement, index) => {
        return {
          ...currentValues,
          [index]: String(cmToInches(measurement.valueCm)),
        };
      }, {}) || {},
  );

  const saveReviewDraft = useCallback(() => {
    if (!draftCustomer || isEditingSavedRecord) {
      return;
    }

    const reviewCustomer = { ...draftCustomer };
    delete reviewCustomer.reviewState;

    onDraftChange?.({
      id: reviewDraftId,
      stage: "review",
      createdAt: draftCustomer.createdAt,
      updatedAt: new Date().toISOString(),
      reviewCustomer: {
        ...reviewCustomer,
        draftStorageId: reviewDraftId,
      },
      reviewState: {
        unit,
        customerNote,
        values,
      },
    });
  }, [customerNote, draftCustomer, isEditingSavedRecord, onDraftChange, reviewDraftId, unit, values]);

  useEffect(() => {
    saveReviewDraft();
  }, [saveReviewDraft]);

  if (!draftCustomer) {
    return null;
  }

  const generatedBaseline = draftCustomer.generatedMeasurements || draftCustomer.measurements;
  const groupedMeasurements = draftCustomer.measurements.reduce((groups, measurement, index) => {
    const group = measurement.group || getProfileLabel(draftCustomer.measurementProfile);

    return {
      ...groups,
      [group]: [...(groups[group] || []), { ...measurement, index }],
    };
  }, {});

  const handleValueChange = (index, value) => {
    setValues({ ...values, [index]: value });
  };

  const handleSave = () => {
    const finalMeasurements = draftCustomer.measurements.map((measurement, index) => {
      const generatedMeasurement = generatedBaseline[index] || measurement;
      const rawValue = Number(values[index]);
      const finalValueCm = Number.isFinite(rawValue) && rawValue > 0 ? toCm(rawValue, unit) : measurement.valueCm;
      const generatedText = formatLength(generatedMeasurement.valueCm);

      return {
        ...measurement,
        generatedValueCm: generatedMeasurement.valueCm,
        valueCm: roundHalf(finalValueCm),
        note: `Reviewed final. Generated draft was ${generatedText}.`,
      };
    });

    onSaveReview({
      ...draftCustomer,
      measurements: finalMeasurements,
      generatedMeasurements: generatedBaseline,
      correctionLog: buildCorrectionLog(generatedBaseline, finalMeasurements),
      customerNote: customerNote.trim(),
      measurementSource: draftCustomer.measurementSource === "manual" ? "manual" : "reviewed-photo",
      status: isEditingSavedRecord ? "Measurements updated" : "Reviewed measurements saved",
      reviewStatus: draftCustomer.measurementSource === "manual" ? undefined : "Reviewed by tailor",
      editMode: undefined,
      draftStorageId: undefined,
      reviewState: undefined,
    });
    onClearDraft?.(reviewDraftId);
  };

  const handleCancel = () => {
    saveReviewDraft();
    onCancel?.();
  };

  return (
    <section className="mx-auto max-w-6xl rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-4 border-b border-stone-100 pb-5 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-medium text-amber-700">
            {isEditingSavedRecord ? "Edit measurements" : "Review measurements"}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-stone-950">{draftCustomer.fullname}</h2>
          <p className="mt-2 max-w-2xl text-sm text-stone-500">
            {isEditingSavedRecord
              ? "Update the saved values, then save the customer record."
              : "Check the generated draft, correct anything that is off, then save the final record."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-stone-700" htmlFor="review-unit">
            Edit in
          </label>
          <select
            id="review-unit"
            className="min-h-10 rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
            value={unit}
            onChange={(event) => {
              const nextUnit = event.target.value;
              setValues(
                draftCustomer.measurements.reduce((currentValues, measurement, index) => {
                  const currentCm = toCm(Number(values[index]), unit);

                  return {
                    ...currentValues,
                    [index]: String(nextUnit === "in" ? cmToInches(currentCm || measurement.valueCm) : roundHalf(currentCm || measurement.valueCm)),
                  };
                }, {}),
              );
              setUnit(nextUnit);
            }}
          >
            <option value="in">Inches</option>
            <option value="cm">Centimeters</option>
          </select>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg bg-stone-50 p-4">
          <p className="text-xs font-medium uppercase text-stone-500">Scale anchor</p>
          <p className="mt-2 font-semibold text-stone-950">{getScaleSourceLabel(draftCustomer)}</p>
        </div>
        <div className="rounded-lg bg-stone-50 p-4">
          <p className="text-xs font-medium uppercase text-stone-500">Formula height</p>
          <p className="mt-2 font-semibold text-stone-950">{formatLength(getScaleHeightCm(draftCustomer))}</p>
        </div>
        <div className="rounded-lg bg-stone-50 p-4">
          <p className="text-xs font-medium uppercase text-stone-500">Gender</p>
          <p className="mt-2 font-semibold text-stone-950">{getProfileLabel(draftCustomer.measurementProfile)}</p>
        </div>
      </div>

      {draftCustomer.segmentationWarnings?.length > 0 && (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-stone-950">Segmentation warnings</p>
          <div className="mt-2 grid gap-2">
            {draftCustomer.segmentationWarnings.map((warning) => (
              <p key={warning} className="text-sm text-amber-900">{warning}</p>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 space-y-5">
        {Object.entries(groupedMeasurements).map(([group, measurements]) => (
          <section key={group} className="rounded-lg border border-stone-200 bg-stone-50 p-4">
            <h3 className="text-sm font-semibold text-stone-950">{group}</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {measurements.map((measurement) => {
                const generatedMeasurement = generatedBaseline[measurement.index] || measurement;
                const currentValueCm = toCm(Number(values[measurement.index]), unit);
                const differenceCm = roundHalf((currentValueCm || measurement.valueCm) - generatedMeasurement.valueCm);

                return (
                  <div key={`${measurement.group}-${measurement.fieldKey}`} className="rounded-lg border border-stone-200 bg-white p-4">
                    <label className="text-sm font-semibold text-stone-950" htmlFor={`review-${measurement.index}`}>
                      {measurement.label}
                    </label>
                    <p className="mt-1 text-xs text-stone-500">Generated: {formatLength(generatedMeasurement.valueCm)}</p>
                    <input
                      id={`review-${measurement.index}`}
                      className="mt-3 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
                      type="number"
                      min="0"
                      step="0.1"
                      value={values[measurement.index] || ""}
                      onChange={(event) => handleValueChange(measurement.index, event.target.value)}
                      onWheel={preventNumberInputWheel}
                    />
                    <p className={`mt-2 text-xs font-medium ${differenceCm === 0 ? "text-stone-500" : "text-amber-700"}`}>
                      Difference: {differenceCm > 0 ? "+" : ""}{differenceCm} cm / {cmToInches(differenceCm)} in
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-5 rounded-lg border border-stone-200 bg-stone-50 p-4">
        <label className="text-sm font-semibold text-stone-950" htmlFor="review-customer-note">
          Notes, extra measurements, or client preference
        </label>
        <textarea
          id="review-customer-note"
          className="mt-3 min-h-28 w-full rounded-md border border-stone-300 bg-white px-3 py-3 text-sm outline-none focus:border-amber-600 focus:ring-4 focus:ring-amber-100"
          value={customerNote}
          onChange={(event) => setCustomerNote(event.target.value)}
          placeholder="Example: Client wants looser sleeve, add embroidery placement, include cap size or any extra measurement not listed."
        />
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-stone-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={handleCancel}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.42-1.41L7.83 13H20v-2Z" />
          </svg>
          {isEditingSavedRecord ? "Back to records" : "Back to drafts"}
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="min-h-11 rounded-md bg-amber-600 px-5 text-sm font-semibold text-white transition hover:bg-amber-700"
        >
          {isEditingSavedRecord ? "Save changes" : "Save final measurements"}
        </button>
      </div>
    </section>
  );
}

function MeasurementResults({ customer, onBack, onEdit, onDelete }) {
  if (!customer) {
    return null;
  }

  const confidence = getPhotoConfidence(customer);
  const isManual = customer.measurementSource === "manual";
  const groupedMeasurements = customer.measurements.reduce((groups, measurement) => {
    const group = measurement.group || getProfileLabel(customer.measurementProfile);

    return {
      ...groups,
      [group]: [...(groups[group] || []), measurement],
    };
  }, {});

  return (
    <section className="min-w-0 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <div className="border-b border-stone-100 pb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <BackButton onClick={onBack} label="Back to customers" />
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => onEdit(customer)}
              className="min-h-10 rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(customer)}
              className="min-h-10 rounded-md border border-red-200 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>

        <div className="mt-5 min-w-0">
          <p className="text-sm font-medium text-amber-700">Processed measurements</p>
          <h3 className="mt-2 break-words text-2xl font-semibold text-stone-950">{customer.fullname}</h3>
          <p className="mt-2 text-sm text-stone-500">
            {isManual
              ? "Saved from measurements entered manually"
              : "Draft from height scale anchor, front photo, and side photo"}
          </p>
          {isManual && (
            <span className="mt-3 inline-flex rounded-md bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              Manual input
            </span>
          )}
          {customer.reviewStatus && (
            <span className="mt-3 inline-flex rounded-md bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              {customer.reviewStatus}
            </span>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        <div className="min-w-0 rounded-lg bg-stone-50 p-4">
          <p className="text-xs font-medium uppercase text-stone-500">Scale anchor</p>
          <p className="mt-2 break-words text-base font-semibold text-stone-950">
            {getScaleSourceLabel(customer)}
          </p>
        </div>
        <div className="min-w-0 rounded-lg bg-stone-50 p-4">
          <p className="text-xs font-medium uppercase text-stone-500">Formula height</p>
          <p className="mt-2 break-words text-base font-semibold text-stone-950">
            {formatLength(getScaleHeightCm(customer))}
          </p>
        </div>
        <div className="min-w-0 rounded-lg bg-stone-50 p-4">
          <p className="text-xs font-medium uppercase text-stone-500">Gender</p>
          <p className="mt-2 break-words text-base font-semibold text-stone-950">
            {getProfileLabel(customer.measurementProfile)}
          </p>
        </div>
        <div className="min-w-0 rounded-lg bg-stone-50 p-4">
          <p className="text-xs font-medium uppercase text-stone-500">Source</p>
          <p className="mt-2 break-words text-base font-semibold text-stone-950">{confidence.label}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-stone-500">{confidence.note}</p>

      {customer.generatedBy && (
        <div className="mt-5 rounded-lg border border-stone-200 bg-stone-50 p-4">
          <p className="text-sm font-semibold text-stone-950">Measurement engine</p>
          <p className="mt-2 text-sm text-stone-600">
            {customer.generatedBy === "backend-segmentation"
              ? "Generated with backend segmentation."
              : "Generated measurement record."}
          </p>
        </div>
      )}

      {customer.segmentationWarnings?.length > 0 && (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-stone-950">Segmentation warnings</p>
          <div className="mt-2 grid gap-2">
            {customer.segmentationWarnings.map((warning) => (
              <p key={warning} className="text-sm text-amber-900">{warning}</p>
            ))}
          </div>
        </div>
      )}

      {customer.customerNote && (
        <div className="mt-5 rounded-lg border border-stone-200 bg-stone-50 p-4">
          <p className="text-sm font-semibold text-stone-950">Notes and preferences</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">{customer.customerNote}</p>
        </div>
      )}

      {customer.correctionLog?.length > 0 && (
        <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-stone-950">Calibration data saved</p>
          <p className="mt-1 text-sm text-stone-600">
            This record keeps the generated draft, final reviewed values, and differences for future formula tuning.
          </p>
        </div>
      )}

      <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-stone-950">Processing flow</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {(customer.pipeline || ["Camera or upload", "Guideline checks", "MediaPipe Pose", "Scale anchor", "Measurement formulas"]).map((step, index) => (
            <div key={step} className="min-w-0 rounded-md bg-white p-3">
              <p className="text-xs font-semibold text-amber-700">Step {index + 1}</p>
              <p className="mt-1 break-words text-sm font-medium text-stone-900">{step}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-5">
        {Object.entries(groupedMeasurements).map(([group, measurements]) => (
          <section key={group}>
            <h4 className="text-sm font-semibold text-stone-950">{group}</h4>
            <div className="mt-3 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {measurements.map((measurement) => (
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
          </section>
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
  const [customers, setCustomers] = useState(loadStoredCustomers);
  const [processedCustomer, setProcessedCustomer] = useState(null);
  const [reviewDraft, setReviewDraft] = useState(null);
  const [measurementDrafts, setMeasurementDrafts] = useState(loadMeasurementDrafts);
  const [activeMeasurementDraftId, setActiveMeasurementDraftId] = useState(null);
  const [deleteAction, setDeleteAction] = useState(null);
  const [draftStorageError, setDraftStorageError] = useState("");
  const activeMeasurementDraft = measurementDrafts.find((draft) => draft.id === activeMeasurementDraftId) || null;
  const latestCustomer = useMemo(
    () => customers.find((customer) => customer.measurements) || processedCustomer,
    [customers, processedCustomer],
  );

  useEffect(() => {
    saveStoredCustomers(customers);
  }, [customers]);

  useEffect(() => {
    if (measurementDrafts.length > 0) {
      saveMeasurementDrafts(measurementDrafts);
    } else {
      deleteStoredMeasurementDrafts();
    }
  }, [measurementDrafts]);

  useEffect(() => {
    if (activePage === "review") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [activePage]);

  const navigateTo = (page) => {
    setActivePage(page);

    if (page === "new") {
      setActiveMeasurementDraftId(null);
    }

    if (page !== "results") {
      setProcessedCustomer(null);
    }

    if (page !== "review") {
      setReviewDraft(null);
    }
  };

  const handleViewMeasurement = (customer) => {
    setProcessedCustomer(customer);
    setActivePage("results");
  };

  const handleEditCustomer = (customer) => {
    setReviewDraft({ ...customer, editMode: "saved-record" });
    setProcessedCustomer(null);
    setActivePage("review");
  };

  const handleDeleteCustomer = (customer) => {
    setDeleteAction({
      type: "customer",
      customer,
      title: "Delete customer record?",
      message: `Delete ${customer.fullname}'s record? This cannot be undone.`,
    });
  };

  const confirmDeleteCustomer = (customer) => {
    setCustomers((currentCustomers) => currentCustomers.filter((currentCustomer) => currentCustomer.id !== customer.id));

    if (processedCustomer?.id === customer.id) {
      setProcessedCustomer(null);
      setActivePage("customers");
    }

    if (reviewDraft?.id === customer.id) {
      setReviewDraft(null);
      setActivePage("customers");
    }
  };

  const handleCustomerSubmit = async (customerData) => {
    const { segmentationImages, ...recordData } = customerData;
    const localMeasurements = processMeasurements(recordData);
    const backendResult = await requestSegmentationMeasurements({
      ...recordData,
      segmentationImages,
    });
    const measurements = buildBackendMeasurements(recordData, backendResult, localMeasurements);

    const reviewDraftId = `review-${Date.now()}-${Math.round(Math.random() * 100000)}`;
    const draftCustomer = {
      ...recordData,
      id: Date.now(),
      draftStorageId: reviewDraftId,
      status: "Awaiting tailor review",
      measurements,
      generatedBy: "backend-segmentation",
      segmentationConfidence: backendResult?.confidence,
      segmentationWarnings: backendResult?.warnings || [],
      segmentationDebug: backendResult?.debug,
      pipeline: [
        ...(recordData.pipeline || []),
        "Backend segmentation",
      ],
    };

    setReviewDraft(draftCustomer);
    setMeasurementDrafts((currentDrafts) => {
      const filteredDrafts = activeMeasurementDraftId
        ? currentDrafts.filter((draft) => draft.id !== activeMeasurementDraftId)
        : currentDrafts;
      const reviewDraft = normalizeDraft({
        id: reviewDraftId,
        stage: "review",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reviewCustomer: draftCustomer,
        reviewState: null,
      });
      const nextDrafts = [reviewDraft, ...filteredDrafts];

      if (!saveMeasurementDrafts(nextDrafts)) {
        setDraftStorageError("Draft could not be saved because browser storage is full. Delete older drafts and try again.");
      }

      return nextDrafts;
    });
    setActiveMeasurementDraftId(reviewDraftId);
    setActivePage("review");
  };

  const handleMeasurementDraftChange = useCallback((draft) => {
    setMeasurementDrafts((currentDrafts) => {
      const draftId = draft.id || activeMeasurementDraftId || Date.now();
      const existingDraft = currentDrafts.find((currentDraft) => currentDraft.id === draftId);
      const nextDraft = normalizeDraft({
        ...draft,
        id: draftId,
        createdAt: existingDraft?.createdAt || draft.createdAt,
      });

      if (!activeMeasurementDraftId) {
        setActiveMeasurementDraftId(draftId);
      }

      const nextDrafts = existingDraft
        ? currentDrafts.map((currentDraft) => (currentDraft.id === draftId ? nextDraft : currentDraft))
        : [nextDraft, ...currentDrafts];

      if (!saveMeasurementDrafts(nextDrafts)) {
        setDraftStorageError("Draft could not be saved because browser storage is full. Retake photos or delete older drafts.");
      }

      return nextDrafts;
    });
  }, [activeMeasurementDraftId]);

  const handleDeleteMeasurementDraft = (draft) => {
    const draftName = draft.stage === "review"
      ? draft.reviewCustomer?.fullname?.trim()
      : draft.values?.fullname?.trim();

    setDeleteAction({
      type: "measurement-draft",
      draftId: draft.id,
      title: "Delete unsaved draft?",
      message: `Delete ${draftName || "this unsaved measurement draft"}? This cannot be undone.`,
    });
  };

  const handleClearMeasurementDraft = useCallback((draftId) => {
    const draftIdToClear = draftId || activeMeasurementDraftId;

    if (!draftIdToClear) {
      return;
    }

    setMeasurementDrafts((currentDrafts) => currentDrafts.filter((draft) => draft.id !== draftIdToClear));
    if (activeMeasurementDraftId === draftIdToClear) {
      setActiveMeasurementDraftId(null);
    }
    setDraftStorageError("");
  }, [activeMeasurementDraftId]);

  const handleReviewSave = (reviewedCustomer) => {
    const savedCustomer = { ...reviewedCustomer };

    delete savedCustomer.editMode;

    setCustomers((currentCustomers) => {
      const existingCustomer = currentCustomers.some((customer) => customer.id === savedCustomer.id);

      if (existingCustomer) {
        return currentCustomers.map((customer) => (customer.id === savedCustomer.id ? savedCustomer : customer));
      }

      return [savedCustomer, ...currentCustomers];
    });
    setProcessedCustomer(savedCustomer);
    setReviewDraft(null);
    if (activeMeasurementDraftId) {
      setMeasurementDrafts((currentDrafts) => currentDrafts.filter((draft) => draft.id !== activeMeasurementDraftId));
      setActiveMeasurementDraftId(null);
    }
    setActivePage("results");
  };

  const handleManualSave = (manualData) => {
    const customer = {
      ...manualData,
      id: Date.now(),
    };

    setCustomers((currentCustomers) => [customer, ...currentCustomers]);
    setProcessedCustomer(customer);
    setActivePage("results");
  };

  const handleConfirmDelete = () => {
    if (deleteAction?.type === "customer" && deleteAction.customer) {
      confirmDeleteCustomer(deleteAction.customer);
    }

    if (deleteAction?.type === "measurement-draft") {
      setMeasurementDrafts((currentDrafts) => currentDrafts.filter((draft) => draft.id !== deleteAction.draftId));

      if (activeMeasurementDraftId === deleteAction.draftId) {
        setActiveMeasurementDraftId(null);
      }
    }

    setDeleteAction(null);
  };

  const handleContinueDraft = (draft) => {
    setActiveMeasurementDraftId(draft.id);

    if (draft.stage === "review") {
      setReviewDraft({
        ...draft.reviewCustomer,
        draftStorageId: draft.id,
        reviewState: draft.reviewState,
      });
      setActivePage("review");
      return;
    }

    setActivePage("new");
  };

  const handleStartNewMeasurement = () => {
    setActiveMeasurementDraftId(null);
    setActivePage("new");
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 md:flex">
      <Sidebar activePage={activePage} onNavigate={navigateTo} />

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10">
        {draftStorageError && (
          <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {draftStorageError}
          </div>
        )}

        {activePage === "dashboard" && (
          <Dashboard
            customers={customers}
            draftCount={measurementDrafts.length}
            latestCustomer={latestCustomer}
            onManualInput={() => navigateTo("manual")}
            onNewMeasurement={handleStartNewMeasurement}
            onViewCustomers={() => navigateTo("customers")}
            onViewDrafts={() => navigateTo("drafts")}
          />
        )}

        {activePage === "customers" && (
          <Customers
            customers={customers}
            onBack={() => navigateTo("dashboard")}
            onViewMeasurement={handleViewMeasurement}
            onDeleteCustomer={handleDeleteCustomer}
          />
        )}

        {activePage === "drafts" && (
          <Drafts
            drafts={measurementDrafts}
            onBack={() => navigateTo("dashboard")}
            onContinueDraft={handleContinueDraft}
            onDeleteDraft={handleDeleteMeasurementDraft}
            onStartNew={handleStartNewMeasurement}
          />
        )}

        {activePage === "new" && (
          <div className="mx-auto max-w-6xl">
            <Form
              key={activeMeasurementDraftId || "new-measurement"}
              initialDraft={activeMeasurementDraft}
              onBack={() => navigateTo("dashboard")}
              onClearDraft={handleClearMeasurementDraft}
              onDraftChange={handleMeasurementDraftChange}
              onSubmitCustomer={handleCustomerSubmit}
              profileOptions={profileOptions}
            />
          </div>
        )}

        {activePage === "manual" && (
          <ManualMeasurementForm
            onBack={() => navigateTo("dashboard")}
            onSaveManual={handleManualSave}
          />
        )}

        {activePage === "review" && (
          <MeasurementReview
            draftCustomer={reviewDraft}
            onSaveReview={handleReviewSave}
            onDraftChange={handleMeasurementDraftChange}
            onClearDraft={handleClearMeasurementDraft}
            onCancel={() => {
              setReviewDraft(null);
              if (reviewDraft?.editMode === "saved-record") {
                setActivePage("customers");
                return;
              }

              setActiveMeasurementDraftId(null);
              setActivePage("drafts");
            }}
          />
        )}

        {activePage === "results" && (
          <MeasurementResults
            customer={processedCustomer}
            onBack={() => navigateTo("customers")}
            onEdit={handleEditCustomer}
            onDelete={handleDeleteCustomer}
          />
        )}
      </main>

      <ConfirmDeleteModal
        action={deleteAction}
        onCancel={() => setDeleteAction(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

export default App;
