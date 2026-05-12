"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, Check, X } from "lucide-react";

const FOCUS_BRACKET_CSS = `
@keyframes focusFadeOut {
  0%   { opacity: 1; }
  70%  { opacity: 1; }
  100% { opacity: 0; }
}
`;

export function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [captured, setCaptured] = useState(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);
  const [tapPoint, setTapPoint] = useState(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    setError(null);
    setReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          focusMode: "continuous",
        },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise((resolve) => { videoRef.current.onloadedmetadata = resolve; });
      }

      const track = stream.getVideoTracks()[0];
      const capabilities = track?.getCapabilities?.() ?? {};

      if (capabilities.focusMode?.includes("continuous")) {
        try {
          await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] });
        } catch {
          // continuous focus not supported — silent fail
        }
      }

      setReady(true);
    } catch {
      setError("Camera access denied. Please allow camera access in your browser settings and try again.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const handleTap = async (e) => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    const rect = videoRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    setTapPoint({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setTimeout(() => setTapPoint(null), 800);

    const capabilities = track.getCapabilities?.() ?? {};
    try {
      if (capabilities.focusMode?.includes("manual") && capabilities.pointsOfInterest) {
        await track.applyConstraints({
          advanced: [{ focusMode: "manual", pointsOfInterest: [{ x, y }] }],
        });
        setTimeout(async () => {
          try {
            if (capabilities.focusMode?.includes("continuous")) {
              await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] });
            }
          } catch {
            // silent fail
          }
        }, 1500);
      }
    } catch (err) {
      console.log("Touch focus not supported:", err);
    }
  };

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCaptured(dataUrl);
    stopCamera();
  };

  const retake = () => {
    setCaptured(null);
    startCamera();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <style>{FOCUS_BRACKET_CSS}</style>

      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/60 flex items-center justify-center"
      >
        <X size={18} className="text-white" />
      </button>

      {error ? (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-4">
          <p className="text-white/80 text-sm leading-relaxed">{error}</p>
          <button onClick={onClose} className="py-2 px-6 rounded-xl text-black text-sm font-bold" style={{ background: "var(--po-green)" }}>
            Close
          </button>
        </div>
      ) : captured ? (
        <>
          <img src={captured} alt="Captured card" className="flex-1 w-full object-contain" />
          <div className="flex gap-3 px-6 py-6 pb-10">
            <button
              onClick={retake}
              className="flex-1 py-3.5 rounded-xl border border-white/30 text-white font-bold text-sm flex items-center justify-center gap-2"
            >
              <RotateCcw size={15} /> Retake
            </button>
            <button
              onClick={() => onCapture(captured)}
              className="flex-1 py-3.5 rounded-xl font-black text-sm text-black flex items-center justify-center gap-2"
              style={{ background: "var(--po-green)" }}
            >
              <Check size={15} /> Use Photo
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex-1 relative overflow-hidden" onClick={handleTap}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <p className="text-white/50 text-sm">Starting camera…</p>
              </div>
            )}
            {tapPoint && (
              <div
                style={{
                  position: "absolute",
                  left: tapPoint.x - 30,
                  top: tapPoint.y - 30,
                  width: 60,
                  height: 60,
                  border: "2px solid #c8ff4a",
                  borderRadius: 4,
                  pointerEvents: "none",
                  animation: "focusFadeOut 0.8s forwards",
                }}
              />
            )}
          </div>
          <div className="flex flex-col items-center px-6 py-6 pb-10 gap-3">
            <p className="text-white/50 text-xs text-center">Tap to focus · Tap capture when sharp</p>
            <button
              onClick={capture}
              disabled={!ready}
              className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center disabled:opacity-40"
            >
              <div className="w-12 h-12 rounded-full bg-white" />
            </button>
          </div>
        </>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
