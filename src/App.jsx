import React, { useState, useRef, useCallback } from 'react';
import { AppProvider, useAppContext } from './context/AppContext.jsx';
import { uid } from './utils/formatters.js';
import { analyzeReceipt } from './api/openRouter.js';
import { fileSha256, fileToResizedDataURL } from './utils/image.js';
import { defaultDocsForNewExpense, findContentDuplicate, mergeQueueItems } from './utils/expenseLogic.js';
import { isNative as platformIsNative, pickImagesNative } from './platform/camera.js';

import { BottomTabBar } from './components/layout/BottomTabBar.jsx';
import { LockScreen } from './components/layout/LockScreen.jsx';
import { ToastStack } from './components/ui/ToastStack.jsx';
import { ConfirmDialog } from './components/dialogs/ConfirmDialog.jsx';
import { ImageViewer } from './components/dialogs/ImageViewer.jsx';
import { TripFormModal } from './components/dialogs/TripFormModal.jsx';

import { SettingsView } from './views/SettingsView.jsx';
import { TripsListView } from './views/TripsListView.jsx';
import { TripDetailView } from './views/TripDetailView.jsx';
import { ScanLauncher } from './views/ScanLauncher.jsx';
import { ScanQueueView } from './views/ScanQueueView.jsx';

function AppInner() {
  const { trips, setTrips, settings, locked, setLocked, toasts, toast } = useAppContext();

  const [activeTab, setActiveTab] = useState("trips");
  const [openTripId, setOpenTripId] = useState(null);

  const [tripModalOpen, setTripModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState(null);

  const [confirm, setConfirm] = useState(null);

  const [scanQueue, setScanQueue] = useState([]);
  const [scanQueueOpen, setScanQueueOpen] = useState(false);
  const [reanalyzingId, setReanalyzingId] = useState(null);
  const [imageViewer, setImageViewer] = useState(null);

  const viewImage = useCallback((payload) => {
    if (!payload || !payload.url) return;
    setImageViewer(payload);
  }, []);

  const scanQueueRef = useRef([]);
  scanQueueRef.current = scanQueue;
  const queueTargetTripIdRef = useRef(null);
  const fileActionRef = useRef(null);

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const openTrip = React.useMemo(
    () => trips.find((t) => t.id === openTripId) || null,
    [trips, openTripId]
  );

  const scanEnabled = trips.length > 0 && !!settings.apiKey;

  const handleNewTrip = () => { setEditingTrip(null); setTripModalOpen(true); };
  const handleEditTrip = (trip) => { setEditingTrip(trip); setTripModalOpen(true); };

  const handleSaveTrip = (data) => {
    if (editingTrip) {
      setTrips((ts) => ts.map((t) => (t.id === editingTrip.id ? { ...t, ...data } : t)));
      toast("Trasferta aggiornata", "success");
    } else {
      const t = { id: uid(), createdAt: Date.now(), expenses: [], ...data };
      setTrips((ts) => [t, ...ts]);
      setOpenTripId(t.id);
      toast("Trasferta creata", "success");
    }
    setTripModalOpen(false);
    setEditingTrip(null);
  };

  const handleDeleteTrip = (tripId) => {
    const t = trips.find((x) => x.id === tripId);
    if (!t) return;
    setConfirm({
      title: "Eliminare la trasferta?",
      message: `"${t.name}" e tutte le sue ${t.expenses.length} spese verranno eliminate.`,
      danger: true,
      confirmLabel: "Elimina",
      onConfirm: () => {
        setTrips((ts) => ts.filter((x) => x.id !== tripId));
        if (openTripId === tripId) setOpenTripId(null);
        setConfirm(null);
        toast("Trasferta eliminata");
      },
    });
  };

  const handleDeleteExpense = (expenseId) => {
    if (!openTrip) return;
    setConfirm({
      title: "Eliminare la spesa?",
      message: "Questa azione non può essere annullata.",
      danger: true,
      confirmLabel: "Elimina",
      onConfirm: () => {
        setTrips((ts) =>
          ts.map((t) =>
            t.id === openTrip.id ? { ...t, expenses: t.expenses.filter((e) => e.id !== expenseId) } : t
          )
        );
        setConfirm(null);
        toast("Spesa eliminata");
      },
    });
  };

  const handleUpdateExpense = (expenseId, patch) => {
    if (!openTrip) return;
    setTrips((ts) =>
      ts.map((t) =>
        t.id === openTrip.id
          ? {
              ...t,
              expenses: t.expenses.map((e) =>
                e.id === expenseId ? { ...e, ...patch, importo: parseFloat(patch.importo) || 0 } : e
              ),
            }
          : t
      )
    );
  };

  const handleReanalyzeExpense = async (expenseId) => {
    if (!openTrip) return;
    const expense = openTrip.expenses.find((e) => e.id === expenseId);
    if (!expense) return;
    if (!expense.full) {
      toast("Immagine non disponibile per la rianalisi", "error");
      return;
    }
    if (!settings.apiKey) {
      toast("Configura prima la API key", "error");
      setActiveTab("settings");
      return;
    }
    setReanalyzingId(expenseId);
    try {
      const parsed = await analyzeReceipt({ apiKey: settings.apiKey, model: settings.model, imageDataUrl: expense.full });
      const { detectedDocs, ...fields } = parsed;
      setTrips((ts) =>
        ts.map((t) =>
          t.id === openTrip.id
            ? {
                ...t,
                expenses: t.expenses.map((e) => {
                  if (e.id !== expenseId) return e;
                  const documents = detectedDocs || e.documents || {};
                  const detectedCount = Object.values(documents).filter(Boolean).length;
                  return {
                    ...e,
                    ...fields,
                    documents,
                    merged: detectedCount >= 2 ? true : !!e.merged,
                  };
                }),
              }
            : t
        )
      );
      toast("Scontrino rianalizzato", "success");
    } catch (e) {
      toast(e?.message || "Rianalisi fallita", "error");
    } finally {
      setReanalyzingId(null);
    }
  };

  const handleReanalyzeTrip = async (tripId) => {
    if (!settings.apiKey) {
      toast("Configura prima la API key", "error");
      setActiveTab("settings");
      return;
    }
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;
    
    const expensesWithImages = trip.expenses.filter(e => e.full);
    if (expensesWithImages.length === 0) {
      toast("Nessuno scontrino con immagine da rianalizzare", "error");
      return;
    }

    let successCount = 0;
    for (const expense of expensesWithImages) {
      setReanalyzingId(expense.id);
      try {
        const parsed = await analyzeReceipt({ apiKey: settings.apiKey, model: settings.model, imageDataUrl: expense.full });
        const { detectedDocs, ...fields } = parsed;
        
        setTrips((ts) =>
          ts.map((t) =>
            t.id === tripId
              ? {
                  ...t,
                  expenses: t.expenses.map((e) => {
                    if (e.id !== expense.id) return e;
                    const documents = detectedDocs || e.documents || {};
                    const detectedCount = Object.values(documents).filter(Boolean).length;
                    return {
                      ...e,
                      ...fields,
                      documents,
                      merged: detectedCount >= 2 ? true : !!e.merged,
                    };
                  }),
                }
              : t
          )
        );
        successCount++;
      } catch (e) {
        toast(`Errore rianalisi ${expense.esercente || 'scontrino'}: ${e?.message}`, "error");
      }
    }
    setReanalyzingId(null);
    if (successCount > 0) {
      toast(`${successCount} scontrini rianalizzati con successo`, "success");
    }
  };

  const triggerAddAttachment = async (tripId, expenseId, mode = "gallery") => {
    if (platformIsNative()) {
      try {
        const picks = await pickImagesNative({ source: mode === "camera" ? "camera" : "gallery" });
        if (!picks || picks.length === 0) return;
        const files = await Promise.all(
          picks.map(async (p, i) => {
            const resp = await fetch(p.dataUrl);
            const blob = await resp.blob();
            return new File([blob], p.name || `attach_${Date.now()}_${i}.jpg`, { type: blob.type || "image/jpeg" });
          })
        );
        await processAttachmentsForExpense(tripId, expenseId, files);
      } catch (err) {
        const msg = err?.message || "";
        if (!/cancel|abort/i.test(msg)) {
          toast(msg || "Errore fotocamera", "error");
        }
      }
      return;
    }
    fileActionRef.current = { type: "attach", tripId, expenseId };
    if (mode === "camera") cameraInputRef.current?.click();
    else galleryInputRef.current?.click();
  };

  const triggerScan = async (tripId, mode) => {
    if (!settings.apiKey) {
      toast("Imposta prima la API key di OpenRouter", "error");
      setActiveTab("settings");
      return;
    }
    queueTargetTripIdRef.current = tripId;
    fileActionRef.current = { type: "scan", tripId };

    if (platformIsNative()) {
      try {
        const picks = await pickImagesNative({ source: mode === "camera" ? "camera" : "gallery" });
        if (!picks || picks.length === 0) return;
        const files = await Promise.all(
          picks.map(async (p, i) => {
            const resp = await fetch(p.dataUrl);
            const blob = await resp.blob();
            return new File([blob], p.name || `image_${Date.now()}_${i}.jpg`, { type: blob.type || "image/jpeg" });
          })
        );
        await processFilesForTrip(tripId, files);
      } catch (err) {
        const msg = err?.message || "";
        if (!/cancel|abort/i.test(msg)) {
          toast(msg || "Errore fotocamera", "error");
        }
      }
      return;
    }

    if (mode === "camera") cameraInputRef.current?.click();
    else galleryInputRef.current?.click();
  };

  const processFilesForTrip = async (tripId, files) => {
    if (!tripId || files.length === 0) return;

    const trip = trips.find((t) => t.id === tripId);
    const existingHashes = new Set((trip?.expenses || []).map((e) => e.imageHash).filter(Boolean));

    let skippedDuplicateFiles = 0;
    const seenInBatch = new Set();

    const built = await Promise.all(
      files.map(async (file) => {
        let thumb = null, full = null, error = null, imageHash = null;
        try { imageHash = await fileSha256(file); } catch {}
        if (imageHash && (existingHashes.has(imageHash) || seenInBatch.has(imageHash))) {
          return { skipped: true, imageHash };
        }
        if (imageHash) seenInBatch.add(imageHash);
        try {
          [full, thumb] = await Promise.all([
            fileToResizedDataURL(file, 1280, 0.85),
            fileToResizedDataURL(file, 320, 0.6),
          ]);
        } catch (err) {
          error = err?.message || "Impossibile leggere l'immagine";
        }
        return {
          id: uid(), tripId, fileName: file.name || "scontrino.jpg",
          status: error ? "error" : "pending", error, thumb, full, imageHash, data: null,
        };
      })
    );

    const newItems = built.filter(b => !b.skipped);
    skippedDuplicateFiles = built.length - newItems.length;

    if (skippedDuplicateFiles > 0) {
      toast(`${skippedDuplicateFiles} duplicat${skippedDuplicateFiles === 1 ? "o" : "i"} saltat${skippedDuplicateFiles === 1 ? "o" : "i"}`, "info");
    }
    if (newItems.length === 0) return;

    setScanQueue(newItems);
    setScanQueueOpen(true);

    for (const item of newItems) {
      if (item.status === "error") continue;
      await processQueueItem(item);
    }
  };

  const processAttachmentsForExpense = async (tripId, expenseId, files) => {
    if (!tripId || !expenseId || files.length === 0) return;
    toast("Aggiunta allegato in corso...", "info");
    const built = [];
    for (const file of files) {
      try {
        let imageHash = null;
        try { imageHash = await fileSha256(file); } catch {}
        const [full, thumb] = await Promise.all([
          fileToResizedDataURL(file, 1280, 0.85),
          fileToResizedDataURL(file, 320, 0.6),
        ]);
        built.push({ thumb, full, imageHash });
      } catch (e) {
        toast("Errore allegato: " + e?.message, "error");
      }
    }
    if (built.length > 0) {
      setTrips(ts => ts.map(t => t.id === tripId ? {
        ...t, 
        expenses: t.expenses.map(e => e.id === expenseId ? {
          ...e,
          extraImages: [...(e.extraImages || []), ...built]
        } : e)
      } : t));
      toast(`Aggiunt${built.length === 1 ? 'o' : 'i'} ${built.length} allegat${built.length === 1 ? 'o' : 'i'}`, "success");
    }
  };

  const onFilesSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    
    if (fileActionRef.current?.type === "attach") {
      await processAttachmentsForExpense(fileActionRef.current.tripId, fileActionRef.current.expenseId, files);
    } else {
      const tripId = queueTargetTripIdRef.current;
      await processFilesForTrip(tripId, files);
    }
    fileActionRef.current = null;
  };

  const processQueueItem = async (item) => {
    setScanQueue((q) => q.map((it) => (it.id === item.id ? { ...it, status: "processing", error: null } : it)));
    try {
      const parsed = await analyzeReceipt({ apiKey: settings.apiKey, model: settings.model, imageDataUrl: item.full });
      const { detectedDocs, ...fields } = parsed;
      const documents = detectedDocs || item.data?.documents || defaultDocsForNewExpense(settings);
      const detectedCount = Object.values(documents).filter(Boolean).length;
      const merged = detectedCount >= 2 ? true : !!item.data?.merged;
      const targetTrip = trips.find((t) => t.id === item.tripId);
      const dup = targetTrip ? findContentDuplicate(fields, targetTrip.expenses) : null;
      const data = {
        ...fields,
        documents,
        merged,
        ...(dup ? { duplicateOf: dup.id, duplicateLabel: `${dup.esercente} · ${dup.importo} ${dup.valuta}` } : {}),
      };
      setScanQueue((q) => q.map((it) => (it.id === item.id ? { ...it, status: "done", data } : it)));
    } catch (err) {
      setScanQueue((q) => q.map((it) => it.id === item.id ? { ...it, status: "error", error: err?.message || "Errore di analisi" } : it));
    }
  };

  const handleQueueItemConfirm = (itemId) => {
    const item = scanQueueRef.current.find((it) => it.id === itemId);
    if (!item || item.status !== "done") return;
    const tripId = item.tripId;
    const { duplicateOf, duplicateLabel, ...savedData } = item.data || {};
    const expense = { id: uid(), ...savedData, thumb: item.thumb, full: item.full, imageHash: item.imageHash, extraImages: item.extraImages, createdAt: Date.now() };
    setTrips((ts) => ts.map((t) => (t.id === tripId ? { ...t, expenses: [...t.expenses, expense] } : t)));
    setScanQueue((q) => q.map((it) => (it.id === itemId ? { ...it, status: "confirmed" } : it)));
  };

  const handleQueueItemDiscard = (itemId) => setScanQueue((q) => q.filter((it) => it.id !== itemId));
  const handleQueueItemRetry = (itemId) => { const item = scanQueueRef.current.find((it) => it.id === itemId); if (item) processQueueItem(item); };
  const handleQueueItemReanalyze = (itemId) => { const item = scanQueueRef.current.find((it) => it.id === itemId); if (item && item.full) processQueueItem(item); };

  const handleMergeGroup = (itemIds) => {
    setScanQueue((q) => {
      const itemsToMerge = q.filter((it) => itemIds.includes(it.id));
      if (itemsToMerge.length < 2) return q;
      const merged = mergeQueueItems(itemsToMerge);
      
      const allImages = itemsToMerge.map(it => ({ thumb: it.thumb, full: it.full, imageHash: it.imageHash, extraImages: it.extraImages || [] }));
      const primary = allImages[0];
      
      // Flatten any existing extraImages from items being merged again
      let combinedExtra = [];
      for (let i = 0; i < allImages.length; i++) {
        if (i > 0) combinedExtra.push({ thumb: allImages[i].thumb, full: allImages[i].full, imageHash: allImages[i].imageHash });
        if (allImages[i].extraImages.length > 0) combinedExtra.push(...allImages[i].extraImages);
      }
      
      merged.thumb = primary.thumb;
      merged.full = primary.full;
      merged.imageHash = primary.imageHash;
      merged.extraImages = combinedExtra;
      
      const out = [];
      let mergedAdded = false;
      for (const it of q) {
        if (itemIds.includes(it.id)) {
          if (!mergedAdded) {
            out.push(merged);
            mergedAdded = true;
          }
        } else {
          out.push(it);
        }
      }
      return out;
    });
  };

  const handleQueueConfirmAll = () => {
    const tripId = queueTargetTripIdRef.current;
    if (!tripId) return;
    const all = scanQueueRef.current.filter((it) => it.status === "done");
    const toAdd = all.filter((it) => !it.data?.duplicateOf);
    if (toAdd.length === 0) return toast("Nessuno scontrino valido da aggiungere", "error");
    const newExpenses = toAdd.map((item) => {
      const { duplicateOf, duplicateLabel, ...savedData } = item.data || {};
      return { id: uid(), ...savedData, thumb: item.thumb, full: item.full, imageHash: item.imageHash, extraImages: item.extraImages, createdAt: Date.now() };
    });
    setTrips((ts) => ts.map((t) => (t.id === tripId ? { ...t, expenses: [...t.expenses, ...newExpenses] } : t)));
    setScanQueue((q) => q.map((it) => (toAdd.find((a) => a.id === it.id) ? { ...it, status: "confirmed" } : it)));
    toast(`${toAdd.length} scontrini aggiunti`, "success");
    setTimeout(() => closeQueue(), 600);
  };

  const handleQueueDiscardAll = () => {
    setConfirm({
      title: "Scartare tutti?",
      message: "Gli scontrini non confermati verranno scartati.",
      danger: true,
      confirmLabel: "Scarta tutti",
      onConfirm: () => { setConfirm(null); closeQueue(); },
    });
  };

  const closeQueue = () => {
    const pendingDone = scanQueueRef.current.filter((it) => it.status === "done").length;
    if (pendingDone > 0) {
      setConfirm({
        title: "Chiudere senza confermare?",
        message: `Ci sono ${pendingDone} scontrini non confermati.`,
        danger: true,
        confirmLabel: "Chiudi",
        onConfirm: () => { setConfirm(null); setScanQueue([]); setScanQueueOpen(false); },
      });
      return;
    }
    if (scanQueueRef.current.some((it) => it.status === "confirmed") && queueTargetTripIdRef.current) {
      setOpenTripId(queueTargetTripIdRef.current);
      setActiveTab("trips");
    }
    setScanQueue([]);
    setScanQueueOpen(false);
  };

  const renderContent = () => {
    if (activeTab === "settings") {
      return <SettingsView askConfirm={setConfirm} />;
    }
    if (activeTab === "scan") {
      if (!scanEnabled) {
        return (
          <div className="px-5 pt-2 pb-6 fade-in text-center flex flex-col items-center justify-center min-h-[50vh]">
            <h2 className="text-2xl font-extrabold text-ink mb-1">Scansiona</h2>
            <div className="bg-white rounded-2xl shadow-soft p-6 mt-4 max-w-sm mx-auto">
              <p className="font-semibold text-ink">Configura prima l'app</p>
              <p className="text-sm text-ink/60 mt-1">
                {!settings.apiKey ? "Inserisci la tua API key OpenRouter nelle impostazioni." : "Crea almeno una trasferta."}
              </p>
            </div>
          </div>
        );
      }
      return <ScanLauncher trips={trips} onLaunch={(tripId, mode) => { setOpenTripId(tripId); setActiveTab("trips"); triggerScan(tripId, mode); }} />;
    }
    if (openTrip) {
      return (
        <TripDetailView
          trip={openTrip}
          onBack={() => setOpenTripId(null)}
          onEditTrip={() => handleEditTrip(openTrip)}
          onDeleteExpense={handleDeleteExpense}
          onUpdateExpense={handleUpdateExpense}
          onReanalyzeExpense={handleReanalyzeExpense}
          onReanalyzeTrip={handleReanalyzeTrip}
          onAddAttachment={(expenseId, mode) => triggerAddAttachment(openTrip.id, expenseId, mode)}
          reanalyzingId={reanalyzingId}
          onScanCamera={() => triggerScan(openTrip.id, "camera")}
          onScanGallery={() => triggerScan(openTrip.id, "gallery")}
          onExportCSV={() => {}} // Not fully implemented in rewriting but logic is in export.js
          onExportSummary={() => {}}
          onViewImage={viewImage}
          settings={settings}
        />
      );
    }
    return <TripsListView trips={trips} onOpen={setOpenTripId} onNew={handleNewTrip} onDelete={handleDeleteTrip} />;
  };

  return (
    <div className="min-h-full bg-[#1a1a2e] flex flex-col items-center">
      {/* Desktop Wrapper -> Changed to fluid width constraint */}
      <div className="relative w-full max-w-5xl mx-auto sm:my-6 sm:rounded-[36px] bg-paper shadow-soft-lg flex flex-col flex-1 sm:min-h-[calc(100vh-3rem)] overflow-hidden">
        <div className="flex-1 overflow-y-auto pt-4 pb-20 sm:pb-0 relative">
          <div className="max-w-3xl mx-auto h-full px-4 sm:px-8">
            {renderContent()}
          </div>
        </div>

        {/* Adjusting BottomTabBar for Desktop layout -> Sticky at bottom for mobile, fixed inside container for Desktop */}
        <div className="absolute bottom-0 w-full sm:relative sm:border-t-0 border-t border-black/5 bg-paper/95 backdrop-blur-md">
          <BottomTabBar active={openTrip ? "trips" : activeTab} onChange={(id) => { if (openTrip && id === "trips") setOpenTripId(null); setActiveTab(id); }} scanEnabled={scanEnabled} />
        </div>

        <ToastStack toasts={toasts} />
        <TripFormModal open={tripModalOpen} initial={editingTrip} onClose={() => { setTripModalOpen(false); setEditingTrip(null); }} onSave={handleSaveTrip} />

        {scanQueueOpen && (
          <ScanQueueView
            queue={scanQueue}
            onChangeItem={(item) => setScanQueue(q => q.map(i => i.id === item.id ? item : i))}
            onConfirmItem={handleQueueItemConfirm}
            onDiscardItem={handleQueueItemDiscard}
            onRetryItem={handleQueueItemRetry}
            onReanalyzeItem={handleQueueItemReanalyze}
            onMergeGroup={handleMergeGroup}
            onConfirmAll={handleQueueConfirmAll}
            onDiscardAll={handleQueueDiscardAll}
            onClose={closeQueue}
            onViewImage={viewImage}
            settings={settings}
            trip={trips.find((t) => t.id === scanQueue[0]?.tripId) || null}
          />
        )}

        <ConfirmDialog open={!!confirm} {...confirm} onCancel={() => setConfirm(null)} />
        {locked && settings.pinEnabled && <LockScreen settings={settings} onUnlock={() => setLocked(false)} />}
        <ImageViewer open={!!imageViewer} {...imageViewer} onClose={() => setImageViewer(null)} />
      </div>

      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFilesSelected} />
      <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={onFilesSelected} />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}
