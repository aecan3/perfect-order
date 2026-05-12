"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, Check, X } from "lucide-react";

export function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [captured, setCaptured] = useState(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    setError(null);
    setReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setReady(true);
      }
    } catch {
      setError("Camera access denied. Please allow camera access in your browser settings and try again.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
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
              onClick={() => { onCapture(captured); }}
              className="flex-1 py-3.5 rounded-xl font-black text-sm text-black flex items-center justify-center gap-2"
              style={{ background: "var(--po-green)" }}
            >
              <Check size={15} /> Use Photo
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex-1 relative overflow-hidden">
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
          </div>
          <div className="flex flex-col items-center px-6 py-6 pb-10 gap-3">
            <p className="text-white/50 text-xs text-center">Hold the card steady and ensure it is fully in frame</p>
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
