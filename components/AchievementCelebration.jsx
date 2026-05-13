"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

const MASTER_COLORS = ["#c8ff4a", "#a8e832", "#ffffff", "#c8ff4a"];
const GM_COLORS = ["#FFB830", "#FFD077", "#FF8C00", "#f4f4f6"];

function spawnParticles(canvas, colors) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const particles = Array.from({ length: 120 }, () => {
    const isRect = Math.random() > 0.5;
    return {
      x: Math.random() * W,
      y: Math.random() * H * 0.6,
      vx: (Math.random() - 0.5) * 6,
      vy: -(2 + Math.random() * 7),
      size: 3 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1,
      decay: 0.008 + Math.random() * 0.015,
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.18,
      isRect,
    };
  });

  let animId;
  function draw() {
    ctx.clearRect(0, 0, W, H);
    let alive = false;
    for (const p of particles) {
      if (p.life <= 0) continue;
      alive = true;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.vx *= 0.99;
      p.rot += p.rotV;
      p.life -= p.decay;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.isRect) {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (alive) animId = requestAnimationFrame(draw);
  }
  animId = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(animId);
}

export function AchievementCelebration({ type, setName, setLogoUrl, onDismiss }) {
  const isGm = type === "grand_master";
  const color = isGm ? "#FFB830" : "#c8ff4a";
  const colors = isGm ? GM_COLORS : MASTER_COLORS;

  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState("flash"); // flash → shake → content → hint
  const [flashVisible, setFlashVisible] = useState(false);
  const [shake, setShake] = useState(false);
  const [logoIn, setLogoIn] = useState(false);
  const [contentIn, setContentIn] = useState(false);
  const [bracketsIn, setBracketsIn] = useState(false);
  const [labelIn, setLabelIn] = useState(false);
  const [hintIn, setHintIn] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const stopsRef = useRef([]);

  useEffect(() => { setMounted(true); }, []);

  const dismiss = useCallback(() => {
    if (dismissing) return;
    setDismissing(true);
    stopsRef.current.forEach((s) => s());
    setTimeout(onDismiss, 400);
  }, [dismissing, onDismiss]);

  useEffect(() => {
    if (!mounted) return;

    try { navigator.vibrate([100, 50, 100, 50, 200]); } catch (_) {}

    const timers = [];
    const t = (fn, ms) => { timers.push(setTimeout(fn, ms)); };

    // Triple flash
    t(() => setFlashVisible(true), 0);
    t(() => setFlashVisible(false), 80);
    t(() => setFlashVisible(true), 120);
    t(() => setFlashVisible(false), 200);
    t(() => setFlashVisible(true), 240);
    t(() => setFlashVisible(false), 320);

    // Screen shake
    t(() => setShake(true), 0);
    t(() => setShake(false), 480);

    // Logo drops in
    t(() => setLogoIn(true), 200);

    // Content scale-in
    t(() => setContentIn(true), 400);

    // Brackets fly in
    t(() => setBracketsIn(true), 600);

    // Set name label fade
    t(() => setLabelIn(true), 800);

    // First particle burst
    t(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const stop = spawnParticles(canvas, colors);
      stopsRef.current.push(stop);
    }, 100);

    // Second burst + shake
    t(() => {
      setShake(true);
      setTimeout(() => setShake(false), 480);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const stop = spawnParticles(canvas, colors);
      stopsRef.current.push(stop);
    }, 1000);

    // Third burst
    t(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const stop = spawnParticles(canvas, colors);
      stopsRef.current.push(stop);
    }, 1700);

    // Dismiss hint
    t(() => setHintIn(true), 2600);

    return () => timers.forEach(clearTimeout);
  }, [mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null;

  const shakeStyle = shake ? {
    animation: "po-achieve-shake 0.48s ease-out",
  } : {};

  const content = (
    <div
      ref={overlayRef}
      onClick={dismiss}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        background: "#07070a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
        opacity: dismissing ? 0 : 1,
        transition: dismissing ? "opacity 0.4s ease" : "none",
        ...shakeStyle,
      }}
    >
      {/* Flash overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: color,
          opacity: flashVisible ? 0.85 : 0,
          transition: "opacity 0.3s ease",
          pointerEvents: "none",
        }}
      />

      {/* Particle canvas */}
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      />

      {/* Content block */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: "0 32px",
          gap: 0,
        }}
      >
        {/* Set logo */}
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
            boxShadow: isGm
              ? "0 0 40px rgba(255,184,48,0.8)"
              : "0 0 40px rgba(200,255,74,0.6)",
            transition: "transform 0.6s cubic-bezier(0.34,1.56,0.64,1), opacity 0.6s ease",
            opacity: logoIn ? 1 : 0,
            transform: logoIn ? "translateY(0) scale(1)" : "translateY(-80px) scale(0.5)",
          }}
        >
          {setLogoUrl ? (
            <img
              src={setLogoUrl}
              alt={setName}
              style={{ width: 96, height: 96, objectFit: "contain", borderRadius: 16 }}
            />
          ) : (
            <div style={{ fontSize: 48, lineHeight: 1 }}>{isGm ? "✦" : "🏆"}</div>
          )}
        </div>

        {/* Small set name label */}
        <div
          style={{
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: 13,
            letterSpacing: "0.08em",
            color,
            fontWeight: 700,
            marginBottom: 12,
            opacity: labelIn ? 1 : 0,
            transition: "opacity 0.4s ease",
          }}
        >
          {setName.toUpperCase()}
        </div>

        {/* Main text with brackets */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 0,
            opacity: contentIn ? 1 : 0,
            transform: contentIn ? "scale(1)" : "scale(0.3)",
            transition: "opacity 0.5s ease, transform 0.5s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          {/* Left bracket */}
          <div
            style={{
              fontFamily: '"IBM Plex Sans", sans-serif',
              fontSize: 80,
              fontWeight: 900,
              color,
              lineHeight: 1,
              opacity: bracketsIn ? 1 : 0,
              transform: bracketsIn ? "translateX(0)" : "translateX(-30px)",
              transition: "opacity 0.4s cubic-bezier(0.34,1.56,0.64,1), transform 0.4s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            [
          </div>

          <div style={{ padding: "0 8px" }}>
            <div
              style={{
                fontFamily: '"IBM Plex Sans", sans-serif',
                fontWeight: 900,
                fontSize: 48,
                color: "#f4f4f6",
                letterSpacing: "0.04em",
                lineHeight: 1.05,
                textTransform: "uppercase",
              }}
            >
              {isGm ? "GRAND" : "MASTER"}
            </div>
            <div
              style={{
                fontFamily: '"IBM Plex Sans", sans-serif',
                fontWeight: 900,
                fontSize: 48,
                color,
                letterSpacing: "0.04em",
                lineHeight: 1.05,
                textTransform: "uppercase",
                textShadow: `0 0 24px ${color}88`,
              }}
            >
              {isGm ? "MASTER" : "SET COMPLETE"}
            </div>
          </div>

          {/* Right bracket */}
          <div
            style={{
              fontFamily: '"IBM Plex Sans", sans-serif',
              fontSize: 80,
              fontWeight: 900,
              color,
              lineHeight: 1,
              opacity: bracketsIn ? 1 : 0,
              transform: bracketsIn ? "translateX(0)" : "translateX(30px)",
              transition: "opacity 0.4s cubic-bezier(0.34,1.56,0.64,1), transform 0.4s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            ]
          </div>
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: 14,
            color: "rgba(244,244,246,0.5)",
            marginTop: 16,
            opacity: contentIn ? 1 : 0,
            transition: "opacity 0.5s ease 0.2s",
          }}
        >
          You collected every card
        </div>

        {/* Tap to continue hint */}
        <div
          style={{
            position: "fixed",
            bottom: 48,
            left: "50%",
            transform: "translateX(-50%)",
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: 11,
            color: "rgba(244,244,246,0.35)",
            letterSpacing: "0.06em",
            opacity: hintIn ? 1 : 0,
            transition: "opacity 0.4s ease",
            whiteSpace: "nowrap",
          }}
        >
          tap anywhere to continue
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
