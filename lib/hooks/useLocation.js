"use client";

import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { LocationExplainer } from "@/components/LocationExplainer";

const STORAGE_KEY = "ms_location_explained";

export function useLocation() {
  const [modalState, setModalState] = useState(null);

  const callGeolocation = useCallback((onGranted, onDenied) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => onGranted(pos),
      () => { if (onDenied) onDenied(); }
    );
  }, []);

  const requestLocation = useCallback(({ onGranted, onDenied, title, purpose } = {}) => {
    const explained = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (explained === "1") {
      callGeolocation(onGranted, onDenied);
      return;
    }
    setModalState({ title, purpose, onGranted, onDenied });
  }, [callGeolocation]);

  const handleEnable = useCallback(() => {
    if (!modalState) return;
    localStorage.setItem(STORAGE_KEY, "1");
    const { onGranted, onDenied } = modalState;
    setModalState(null);
    callGeolocation(onGranted, onDenied);
  }, [modalState, callGeolocation]);

  const handleNotNow = useCallback(() => {
    if (!modalState) return;
    localStorage.setItem(STORAGE_KEY, "1");
    const { onDenied } = modalState;
    setModalState(null);
    if (onDenied) onDenied();
  }, [modalState]);

  const modal =
    modalState && typeof document !== "undefined"
      ? createPortal(
          <LocationExplainer
            title={modalState.title}
            purpose={modalState.purpose}
            onEnable={handleEnable}
            onNotNow={handleNotNow}
          />,
          document.body
        )
      : null;

  return { requestLocation, locationModal: modal };
}
