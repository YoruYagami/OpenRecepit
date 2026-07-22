import React, { lazy, Suspense } from "react";
import { useNav } from "./NavProvider.jsx";
import { Overlay } from "../components/ui/Overlay.jsx";
import { ConfirmBody } from "../components/dialogs/ConfirmDialog.jsx";
import { TripFormBody } from "../components/dialogs/TripFormModal.jsx";
import { ImageViewerBody } from "../components/dialogs/ImageViewer.jsx";
import { ErrorBoundary } from "../components/ErrorBoundary.jsx";
import { Spinner } from "../components/ui/Spinner.jsx";

const ScanQueueView = lazy(() =>
  import("../views/ScanQueueView.jsx").then((m) => ({ default: m.ScanQueueView }))
);

/*
 * Renders the nav overlay stack in order (later = visually on top). Static
 * overlays (confirm, trip form, image viewer) render from the descriptor's
 * props snapshot; the scan queue renders from the LIVE api passed down by App,
 * so analysis progress keeps flowing into an already-open overlay.
 */
export function OverlayHost({ scanQueue, trips, settings, onViewImage }) {
  const { overlays, closeTopOverlay } = useNav();

  return (
    <>
      {overlays.map((d) => {
        switch (d.kind) {
          case "confirm":
            return (
              <Overlay key={d.id} variant="sheet" closeOnBackdrop onClose={closeTopOverlay}>
                <ConfirmBody {...d.props} />
              </Overlay>
            );
          case "tripForm":
            return (
              <Overlay key={d.id} variant="sheet" onClose={closeTopOverlay}>
                <TripFormBody {...d.props} onClose={closeTopOverlay} />
              </Overlay>
            );
          case "imageViewer":
            return (
              <Overlay key={d.id} variant="lightbox" closeOnBackdrop onClose={closeTopOverlay}>
                <ImageViewerBody {...d.props} onClose={closeTopOverlay} />
              </Overlay>
            );
          case "scanQueue":
            return (
              <ErrorBoundary key={d.id}>
                <Overlay variant="fullscreen" onClose={closeTopOverlay}>
                  <Suspense
                    fallback={
                      <div className="flex-1 flex items-center justify-center">
                        <Spinner className="w-8 h-8 text-ink/40" />
                      </div>
                    }
                  >
                    <ScanQueueView
                      queue={scanQueue.queue}
                      onChangeItem={scanQueue.handlers.changeItem}
                      onConfirmItem={scanQueue.handlers.confirmItem}
                      onDiscardItem={scanQueue.handlers.discardItem}
                      onRetryItem={scanQueue.handlers.retryItem}
                      onSaveRawItem={scanQueue.handlers.saveRawItem}
                      onReanalyzeItem={scanQueue.handlers.reanalyzeItem}
                      onConfirmAll={scanQueue.handlers.confirmAll}
                      onDiscardAll={scanQueue.handlers.discardAll}
                      onAddPhotos={scanQueue.addMorePhotos}
                      onClose={closeTopOverlay}
                      onViewImage={onViewImage}
                      settings={settings}
                      trip={trips.find((t) => t.id === scanQueue.queue[0]?.tripId) || null}
                    />
                  </Suspense>
                </Overlay>
              </ErrorBoundary>
            );
          default:
            return null;
        }
      })}
    </>
  );
}
