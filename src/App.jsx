import React, { useCallback, lazy, Suspense } from "react";
import { AppProvider, useAppContext } from "./context/AppContext.jsx";
import { NavProvider, useNav } from "./navigation/NavProvider.jsx";
import { OverlayHost } from "./navigation/OverlayHost.jsx";
import { useFilePicker } from "./hooks/useFilePicker.jsx";
import { useScanQueue } from "./hooks/useScanQueue.js";
import { useExpenseActions } from "./hooks/useExpenseActions.js";
import { useReanalyze } from "./hooks/useReanalyze.js";
import { useTripActions } from "./hooks/useTripActions.js";
import { useSharedFile } from "./hooks/useSharedFile.jsx";
import { downloadFile, tripToCSV, tripToSummary } from "./utils/export.js";

import { BottomTabBar } from "./components/layout/BottomTabBar.jsx";
import { LockScreen } from "./components/layout/LockScreen.jsx";
import { Onboarding } from "./components/layout/Onboarding.jsx";
import { OfflineBanner } from "./components/layout/OfflineBanner.jsx";
import { ToastStack } from "./components/ui/ToastStack.jsx";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";

import { TripsListView } from "./views/TripsListView.jsx";
import { TripDetailView } from "./views/TripDetailView.jsx";
import { ScanLauncher } from "./views/ScanLauncher.jsx";

// Retry a dynamic import once before giving up, so a transient chunk-load failure
// (stale deploy / flaky network) doesn't drop the user into the error boundary.
function lazyWithRetry(factory) {
  return lazy(() =>
    factory().catch(
      () =>
        new Promise((resolve, reject) => {
          setTimeout(() => factory().then(resolve, reject), 700);
        })
    )
  );
}

const SettingsView = lazyWithRetry(() =>
  import("./views/SettingsView.jsx").then((m) => ({ default: m.SettingsView }))
);

// Skeleton placeholder: hints at the list layout instead of a bare spinner.
function ViewLoader() {
  return (
    <div className="px-5 pt-2 fade-in" aria-busy="true" aria-label="Caricamento">
      <div className="h-8 w-40 bg-surface-2 rounded-lg animate-pulse mb-5" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-surface rounded-2xl shadow-soft p-4 mb-3">
          <div className="h-5 w-1/2 bg-surface-2 rounded animate-pulse" />
          <div className="h-3.5 w-1/3 bg-surface-2 rounded animate-pulse mt-2" />
          <div className="h-4 w-24 bg-surface-2 rounded animate-pulse mt-4" />
        </div>
      ))}
    </div>
  );
}

function AppInner() {
  const { trips, settings, setSettings, locked, setLocked, toasts, toast, ready } =
    useAppContext();
  const nav = useNav();

  const { pickFiles, inputs: filePickerInputs } = useFilePicker();
  const scanQueue = useScanQueue({ pickFiles });
  const expenses = useExpenseActions({ pickFiles });
  const { reanalyzingId, reanalyzeExpense, reanalyzeTrip } = useReanalyze();
  const { openTripForm, deleteTrip } = useTripActions();
  useSharedFile();

  const openTrip = React.useMemo(
    () => trips.find((t) => t.id === nav.tripId) || null,
    [trips, nav.tripId]
  );

  const scanEnabled = trips.length > 0 && !!settings.apiKey;

  const viewImage = useCallback(
    (payload) => {
      if (!payload || (!payload.url && !payload.fullRef)) return;
      nav.pushOverlay({ kind: "imageViewer", props: payload });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Config-object adapter kept for SettingsView: askConfirm(cfg) opens a
  // confirm sheet on the nav stack, askConfirm(null) closes it.
  const askConfirm = useCallback(
    (cfg) => {
      if (!cfg) {
        nav.closeTopOverlay();
        return;
      }
      nav.pushOverlay({
        kind: "confirm",
        props: { ...cfg, onCancel: () => nav.closeTopOverlay() },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const exportPack = async (trip) => {
    if (trip.expenses.length === 0) return toast("Nessuna spesa da esportare", "error");
    toast("Preparo il pacchetto rimborso…", "info");
    try {
      const { exportReimbursePack } = await import("./utils/reimbursePack.js");
      const r = await exportReimbursePack(trip);
      if (!r?.canceled) toast("Pacchetto rimborso esportato", "success");
    } catch (e) {
      toast(e?.message || "Esportazione fallita", "error");
    }
  };

  const exportTrip = async (trip, kind) => {
    if (trip.expenses.length === 0) return toast("Nessuna spesa da esportare", "error");
    const safeName = (trip.name || "trasferta").replace(/[^a-z0-9-_]+/gi, "_");
    try {
      const r =
        kind === "csv"
          ? await downloadFile(`${safeName}.csv`, "text/csv;charset=utf-8", "﻿" + tripToCSV(trip))
          : await downloadFile(
              `${safeName}_riepilogo.txt`,
              "text/plain;charset=utf-8",
              tripToSummary(trip)
            );
      if (!r?.canceled) toast(kind === "csv" ? "CSV esportato" : "Riepilogo esportato", "success");
    } catch (e) {
      toast(e?.message || "Esportazione fallita", "error");
    }
  };

  const renderContent = () => {
    if (!ready && nav.tab !== "settings") {
      return <ViewLoader />;
    }
    if (nav.tab === "settings") {
      return (
        <ErrorBoundary>
          <Suspense fallback={<ViewLoader />}>
            <SettingsView askConfirm={askConfirm} />
          </Suspense>
        </ErrorBoundary>
      );
    }
    if (nav.tab === "scan") {
      if (!scanEnabled) {
        return (
          <div className="px-5 pt-2 pb-6 fade-in text-center flex flex-col items-center justify-center min-h-[50vh]">
            <h2 className="text-2xl font-extrabold text-ink mb-1">Scansiona</h2>
            <div className="bg-surface rounded-2xl shadow-soft p-6 mt-4 max-w-sm mx-auto">
              <p className="font-semibold text-ink">Configura prima l'app</p>
              <p className="text-sm text-ink/60 mt-1">
                {!settings.apiKey
                  ? "Inserisci la tua API key OpenRouter nelle impostazioni."
                  : "Crea almeno una trasferta."}
              </p>
            </div>
          </div>
        );
      }
      return (
        <ScanLauncher
          trips={trips}
          onLaunch={(tripId, mode) => {
            nav.openTrip(tripId);
            scanQueue.startScan(tripId, mode);
          }}
        />
      );
    }
    if (openTrip) {
      return (
        <TripDetailView
          trip={openTrip}
          onBack={nav.closeTrip}
          onEditTrip={() => openTripForm(openTrip)}
          onDeleteExpense={(expenseId) => expenses.deleteExpense(openTrip.id, expenseId)}
          onUpdateExpense={(expenseId, patch) =>
            expenses.updateExpense(openTrip.id, expenseId, patch)
          }
          onAddExpense={() => expenses.addManualExpense(openTrip.id)}
          onRemoveExpense={(expenseId) => expenses.removeExpenseSilent(openTrip.id, expenseId)}
          onReanalyzeExpense={(expenseId) => reanalyzeExpense(openTrip.id, expenseId)}
          onReanalyzeTrip={reanalyzeTrip}
          onAddAttachment={(expenseId, mode) =>
            expenses.addAttachment(openTrip.id, expenseId, mode)
          }
          reanalyzingId={reanalyzingId}
          onScanCamera={() => scanQueue.startScan(openTrip.id, "camera")}
          onScanGallery={() => scanQueue.startScan(openTrip.id, "gallery")}
          onExportCSV={() => exportTrip(openTrip, "csv")}
          onExportSummary={() => exportTrip(openTrip, "summary")}
          onExportPack={() => exportPack(openTrip)}
          onViewImage={viewImage}
          settings={settings}
        />
      );
    }
    return (
      <TripsListView
        trips={trips}
        onOpen={nav.openTrip}
        onNew={() => openTripForm(null)}
        onDelete={deleteTrip}
      />
    );
  };

  return (
    // Mobile: lock the frame to the viewport (h-full + min-h-0 chain) so the
    // inner div is the ONLY scroller and the absolute tab bar stays pinned.
    // Desktop (sm:) keeps the floating card that can grow with the document.
    <div className="h-full sm:h-auto sm:min-h-full bg-[#1a1a2e] flex flex-col items-center">
      <div className="relative w-full max-w-5xl mx-auto sm:my-6 sm:rounded-[36px] bg-paper shadow-soft-lg flex flex-col flex-1 min-h-0 sm:min-h-[calc(100vh-3rem)] overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto pt-4 pb-20 sm:pb-0 relative">
          <div className="max-w-3xl mx-auto h-full px-4 sm:px-8">{renderContent()}</div>
        </div>

        <div className="absolute bottom-0 w-full sm:relative sm:border-t-0 border-t border-line bg-paper/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] sm:pb-0">
          <BottomTabBar
            active={openTrip ? "trips" : nav.tab}
            onChange={(tab) => {
              // The camera FAB shoots straight away: current trip if one is
              // open, otherwise the most recent one. No intermediate screen.
              if (tab === "scan" && scanEnabled) {
                const target =
                  openTrip || [...trips].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
                if (target) {
                  if (!openTrip) nav.openTrip(target.id);
                  scanQueue.startScan(target.id, "camera");
                  return;
                }
              }
              nav.setTab(tab);
            }}
            scanEnabled={scanEnabled}
          />
        </div>

        <OverlayHost
          scanQueue={scanQueue}
          trips={trips}
          settings={settings}
          onViewImage={viewImage}
        />

        <ToastStack toasts={toasts} />
        <OfflineBanner />

        {ready && !locked && !settings.onboardingDone && trips.length === 0 && (
          <Onboarding
            onCreateTrip={() => openTripForm(null)}
            onGoToSettings={() => nav.setTab("settings")}
          />
        )}

        {locked && settings.pinEnabled && (
          <LockScreen
            settings={settings}
            onUnlock={() => setLocked(false)}
            onForget={() => {
              // The PIN is a UI gate, not an encryption key, so a forgotten PIN
              // can be cleared without destroying any data.
              setSettings({
                pinEnabled: false,
                pinHash: null,
                pinSalt: null,
                pinAlgo: null,
                pinFails: 0,
                pinLockUntil: 0,
                biometricEnabled: false,
                biometricCredId: null,
              });
              setLocked(false);
              toast("PIN reimpostato. Imposta un nuovo PIN dalle impostazioni.", "info");
            }}
          />
        )}
      </div>

      {filePickerInputs}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <NavProvider>
        <AppInner />
      </NavProvider>
    </AppProvider>
  );
}
