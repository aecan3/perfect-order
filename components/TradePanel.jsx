"use client";

import { useState, useEffect, useRef } from "react";
import { CheckCircle, Camera, Clock, ArrowLeftRight, MapPin, Users, Package, AlertTriangle } from "lucide-react";
import { CameraCapture } from "@/components/CameraCapture";

const DISCLAIMER =
  "Photo confirmation indicates a card matching this description was photographed at the time of this trade. Master Setter does not authenticate, grade, or guarantee the condition or authenticity of any card. All trades are between users. Master Setter accepts no liability for trade disputes.";

const LIABILITY_CHECKBOX =
  "I understand Master Setter is a platform only and accepts no responsibility for the outcome of this trade.";

export function TradePanel({ tradeId, user, otherHandle, otherUserId, requestCard, supabase }) {
  const [trade, setTrade] = useState(null);
  const [verifications, setVerifications] = useState([]);
  const [events, setEvents] = useState([]);
  const [showCamera, setShowCamera] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [verifyError, setVerifyError] = useState(null);
  const [acceptError, setAcceptError] = useState(null);
  const [declineError, setDeclineError] = useState(null);
  const [logisticsChoice, setLogisticsChoice] = useState(null);
  const [liabilityChecked, setLiabilityChecked] = useState(false);
  const [revealedAddress, setRevealedAddress] = useState(null);
  const [revealLoading, setRevealLoading] = useState(false);
  const [revealError, setRevealError] = useState(null);
  const [nearbyShops, setNearbyShops] = useState(null);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const channelRef = useRef(null);

  useEffect(() => {
    if (!tradeId) return;
    loadTradeState();

    channelRef.current = supabase
      .channel(`trade:${tradeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trade_verifications", filter: `trade_id=eq.${tradeId}` }, loadTradeState)
      .on("postgres_changes", { event: "*", schema: "public", table: "trade_events", filter: `trade_id=eq.${tradeId}` }, loadTradeState)
      .on("postgres_changes", { event: "*", schema: "public", table: "trades", filter: `id=eq.${tradeId}` }, loadTradeState)
      .subscribe();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [tradeId]);

  const loadTradeState = async () => {
    const [{ data: tradeRow }, { data: verRows }, { data: evRows }] = await Promise.all([
      supabase.from("trades").select("*").eq("id", tradeId).maybeSingle(),
      supabase.from("trade_verifications").select("*").eq("trade_id", tradeId),
      supabase.from("trade_events").select("*").eq("trade_id", tradeId),
    ]);
    if (tradeRow) setTrade(tradeRow);
    setVerifications(verRows || []);
    setEvents(evRows || []);
  };

  if (!trade) return null;

  const isProposer = trade.proposer_id === user.id;
  const isExpired = (trade.status === "pending" || trade.status === "verification_required") && new Date(trade.expires_at) < new Date();

  const myVerification = verifications.find((v) => v.user_id === user.id);
  const otherVerification = verifications.find((v) => v.user_id === otherUserId);
  const bothVerified = myVerification?.confirmed && otherVerification?.confirmed;

  const myAccepted = events.some((e) => e.user_id === user.id && e.event_type === "accepted");
  const otherAccepted = events.some((e) => e.user_id === otherUserId && e.event_type === "accepted");
  const bothAccepted = trade.status === "accepted" || (myAccepted && otherAccepted);

  const handlePhotoCapture = async (imageBase64) => {
    setShowCamera(false);
    setProcessing(true);
    setVerifyError(null);
    try {
      const res = await fetch(`/api/trade/${tradeId}/verify-photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          cardName: requestCard?.card_name || requestCard?.cardName || "",
          setName: requestCard?.set_name || requestCard?.setName || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) { setVerifyError(data.error || "Verification failed"); return; }
      if (!data.confirmed) {
        setVerifyError(data.aiResult?.failureReason || "Photo verification failed. Please retake the photo with better lighting and ensure the card name is clearly visible.");
      } else {
        await loadTradeState();
      }
    } catch {
      setVerifyError("Network error — please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handleAccept = async () => {
    setProcessing(true);
    setAcceptError(null);
    try {
      const res = await fetch(`/api/trade/${tradeId}/accept`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setAcceptError(data.error || "Failed to accept trade"); return; }
      await loadTradeState();
    } catch {
      setAcceptError("Network error — please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    setProcessing(true);
    setDeclineError(null);
    try {
      const res = await fetch(`/api/trade/${tradeId}/decline`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setDeclineError(data.error || "Failed to decline trade"); return; }
      await loadTradeState();
    } catch {
      setDeclineError("Network error — please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handleRevealAddress = async () => {
    setRevealLoading(true);
    setRevealError(null);
    try {
      const res = await fetch(`/api/trade/${tradeId}/reveal-address`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "no_address") {
          setRevealError(`@${otherHandle} hasn't added a mailing address to their profile yet. Ask them to add one in their profile settings.`);
        } else {
          setRevealError(data.error || "Failed to reveal address");
        }
        return;
      }
      setRevealedAddress(data);
    } catch {
      setRevealError("Network error — please try again.");
    } finally {
      setRevealLoading(false);
    }
  };

  const handleFindShops = () => {
    setShopsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`/api/places?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
          const data = await res.json();
          setNearbyShops(data.shops || []);
        } catch {
          setNearbyShops([]);
        } finally {
          setShopsLoading(false);
        }
      },
      () => {
        setNearbyShops([]);
        setShopsLoading(false);
      }
    );
  };

  return (
    <>
      {showCamera && (
        <CameraCapture
          onCapture={handlePhotoCapture}
          onClose={() => setShowCamera(false)}
        />
      )}

      <div className="mt-2 rounded-2xl border border-[var(--po-border)] overflow-hidden" style={{ background: "var(--po-bg-soft)" }}>
        <div className="px-4 py-3 border-b border-[var(--po-border)]">
          <div className="flex items-center gap-2">
            <ArrowLeftRight size={13} style={{ color: "var(--po-green)" }} />
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--po-green)" }}>Trade Proposal</span>
          </div>
        </div>

        <div className="px-4 py-3 space-y-3">

          {/* ── DECLINED ── */}
          {trade.status === "declined" && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-700/40 bg-rose-950/30 px-3 py-3">
              <AlertTriangle size={14} className="text-rose-400 flex-shrink-0" />
              <p className="text-xs text-rose-300">Trade declined.</p>
            </div>
          )}

          {/* ── PENDING: proposer waits, recipient decides ── */}
          {trade.status === "pending" && !isExpired && (
            isProposer ? (
              <div className="flex items-center gap-2 text-xs text-[var(--po-text-dim)]">
                <Clock size={13} className="flex-shrink-0" />
                Waiting for @{otherHandle} to accept or decline…
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)]">Respond to this trade</p>
                <button
                  onClick={handleAccept}
                  disabled={processing}
                  className="w-full py-3 rounded-xl font-black text-sm uppercase tracking-widest text-black disabled:opacity-50 flex items-center justify-center gap-2 po-glow-green"
                  style={{ background: "var(--po-green)" }}
                >
                  {processing ? "Accepting…" : "Accept Trade"}
                </button>
                <button
                  onClick={handleDecline}
                  disabled={processing}
                  className="w-full py-2.5 rounded-xl font-bold text-sm border border-rose-700/60 text-rose-400 disabled:opacity-50 flex items-center justify-center"
                >
                  Decline Trade
                </button>
                {(acceptError || declineError) && (
                  <p className="text-xs text-rose-300">{acceptError || declineError}</p>
                )}
              </div>
            )
          )}

          {/* ── VERIFICATION PHASE ── */}
          {trade.status === "verification_required" && !isExpired && (
            <>
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)]">Photo Verification</p>
                <VerificationRow label="You" verified={myVerification?.confirmed} timestamp={myVerification?.created_at} />
                <VerificationRow label={`@${otherHandle}`} verified={otherVerification?.confirmed} timestamp={otherVerification?.created_at} />
              </div>

              {!myVerification?.confirmed && (
                <div className="space-y-2">
                  <button
                    onClick={() => setShowCamera(true)}
                    disabled={processing}
                    className="w-full py-3 rounded-xl font-black text-sm uppercase tracking-widest text-black disabled:opacity-50 flex items-center justify-center gap-2 po-glow-green"
                    style={{ background: "var(--po-green)" }}
                  >
                    <Camera size={14} />
                    {processing ? "Verifying…" : "Begin Verification"}
                  </button>
                  {verifyError && (
                    <div className="rounded-xl border border-rose-700/60 bg-rose-950/40 px-3 py-2">
                      <p className="text-xs text-rose-300 leading-relaxed">{verifyError}</p>
                      <button onClick={() => { setVerifyError(null); setShowCamera(true); }} className="text-xs text-rose-400 font-bold underline mt-1">
                        Retake photo
                      </button>
                    </div>
                  )}
                </div>
              )}

              {myVerification?.confirmed && !otherVerification?.confirmed && (
                <div className="flex items-center gap-2 text-xs text-[var(--po-text-dim)]">
                  <Clock size={13} />
                  Waiting for @{otherHandle} to verify
                </div>
              )}

              {myVerification?.confirmed && (
                <p className="text-[9px] leading-relaxed text-[var(--po-text-dim)] border-t border-[var(--po-border)] pt-3">
                  {DISCLAIMER}
                </p>
              )}

              {bothVerified && (
                <div className="space-y-2 border-t border-[var(--po-border)] pt-3">
                  {myAccepted ? (
                    <div className="flex items-center gap-2 text-xs text-[var(--po-text-dim)]">
                      <Clock size={13} />
                      Waiting for @{otherHandle} to confirm
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={handleAccept}
                        disabled={processing}
                        className="w-full py-3 rounded-xl font-black text-sm uppercase tracking-widest border border-[var(--po-green)] text-[var(--po-green)] disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {processing ? "Confirming…" : "Confirm Trade"}
                      </button>
                      {acceptError && <p className="text-xs text-rose-300">{acceptError}</p>}
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── EXPIRED ── */}
          {isExpired && (
            <div className="flex items-center gap-2 rounded-xl border border-[var(--po-border)] px-3 py-3" style={{ background: "var(--po-bg)" }}>
              <AlertTriangle size={14} className="text-[var(--po-text-dim)] flex-shrink-0" />
              <p className="text-xs text-[var(--po-text-dim)]">This trade proposal has expired.</p>
            </div>
          )}

          {/* Logistics — both accepted */}
          {bothAccepted && (
            <div className="space-y-3 border-t border-[var(--po-border)] pt-3">
              <div className="flex items-center gap-2">
                <CheckCircle size={14} style={{ color: "var(--po-green)" }} />
                <span className="text-xs font-bold" style={{ color: "var(--po-green)" }}>Trade Accepted</span>
              </div>

              {!logisticsChoice && (
                <>
                  <p className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)]">How will you exchange?</p>
                  <div className="space-y-2">
                    <LogisticsButton icon={<Package size={14} />} label="Post" onClick={() => setLogisticsChoice("post")} />
                    <LogisticsButton icon={<Users size={14} />} label="Meet in Person" onClick={() => setLogisticsChoice("in_person")} />
                    <LogisticsButton icon={<MapPin size={14} />} label="Card Shop Nearby" onClick={() => { setLogisticsChoice("card_shop"); handleFindShops(); }} />
                  </div>
                </>
              )}

              {logisticsChoice === "post" && (
                <PostLogistics
                  liabilityChecked={liabilityChecked}
                  setLiabilityChecked={setLiabilityChecked}
                  revealedAddress={revealedAddress}
                  revealLoading={revealLoading}
                  revealError={revealError}
                  onReveal={handleRevealAddress}
                  otherHandle={otherHandle}
                  onBack={() => { setLogisticsChoice(null); setRevealedAddress(null); setLiabilityChecked(false); setRevealError(null); }}
                />
              )}

              {logisticsChoice === "in_person" && (
                <InPersonLogistics
                  notesValue={notesValue}
                  setNotesValue={setNotesValue}
                  onBack={() => setLogisticsChoice(null)}
                />
              )}

              {logisticsChoice === "card_shop" && (
                <CardShopLogistics
                  shops={nearbyShops}
                  loading={shopsLoading}
                  onBack={() => setLogisticsChoice(null)}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function VerificationRow({ label, verified, timestamp }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          background: verified ? "var(--po-green)" : "transparent",
          border: `2px solid ${verified ? "var(--po-green)" : "var(--po-border)"}`,
        }}
      >
        {verified && <span className="text-black text-[9px] font-black">✓</span>}
      </div>
      <span className="text-xs text-[var(--po-text)] flex-1">{label}</span>
      {verified && timestamp ? (
        <span className="text-[9px] text-[var(--po-text-dim)]">
          {new Date(timestamp).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true })}
        </span>
      ) : (
        <span className="text-[9px] text-[var(--po-text-dim)]">Pending</span>
      )}
    </div>
  );
}

function LogisticsButton({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--po-border)] text-sm font-bold text-[var(--po-text)] hover:border-[var(--po-green)] transition-colors"
    >
      <span style={{ color: "var(--po-green)" }}>{icon}</span>
      {label}
    </button>
  );
}

function PostLogistics({ liabilityChecked, setLiabilityChecked, revealedAddress, revealLoading, revealError, onReveal, otherHandle, onBack }) {
  return (
    <div className="space-y-3">
      <button onClick={onBack} className="text-[10px] text-[var(--po-text-dim)] underline">Back</button>
      <p className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)]">Postal Exchange</p>

      {!revealedAddress ? (
        <>
          <label className="flex items-start gap-3 cursor-pointer">
            <div
              className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{
                background: liabilityChecked ? "var(--po-green)" : "transparent",
                border: `2px solid ${liabilityChecked ? "var(--po-green)" : "var(--po-border)"}`,
              }}
              onClick={() => setLiabilityChecked((v) => !v)}
            >
              {liabilityChecked && <span className="text-black text-[9px] font-black">✓</span>}
            </div>
            <p className="text-xs text-[var(--po-text-dim)] leading-relaxed">{LIABILITY_CHECKBOX}</p>
          </label>

          <button
            onClick={onReveal}
            disabled={!liabilityChecked || revealLoading}
            className="w-full py-3 rounded-xl font-black text-sm uppercase tracking-widest text-black disabled:opacity-40 po-glow-green"
            style={{ background: "var(--po-green)" }}
          >
            {revealLoading ? "Loading…" : `See @${otherHandle}'s Address`}
          </button>

          {revealError && (
            <p className="text-xs text-rose-300 leading-relaxed">{revealError}</p>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-[var(--po-green)]/40 p-4 space-y-1" style={{ background: "rgba(200,255,74,0.05)" }}>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--po-green)" }}>
            @{revealedAddress.handle}'s Mailing Address
          </p>
          <p className="text-sm font-bold text-[var(--po-text)] whitespace-pre-wrap">{revealedAddress.address}</p>
          <p className="text-[9px] text-[var(--po-text-dim)] pt-1">
            Screenshot this — it won't be shown again in this session.
          </p>
        </div>
      )}
    </div>
  );
}

function InPersonLogistics({ notesValue, setNotesValue, onBack }) {
  return (
    <div className="space-y-3">
      <button onClick={onBack} className="text-[10px] text-[var(--po-text-dim)] underline">Back</button>
      <p className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)]">Arrange a Meetup</p>
      <textarea
        value={notesValue}
        onChange={(e) => setNotesValue(e.target.value)}
        placeholder="Suggest a time, place, or any other details…"
        rows={4}
        className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--po-bg)] border border-[var(--po-border)] text-[var(--po-text)] placeholder:text-[var(--po-text-dim)] focus:outline-none focus:border-[var(--po-green)] resize-none"
      />
      <p className="text-[9px] text-[var(--po-text-dim)]">Use the chat below to coordinate the meetup details.</p>
    </div>
  );
}

function CardShopLogistics({ shops, loading, onBack }) {
  return (
    <div className="space-y-3">
      <button onClick={onBack} className="text-[10px] text-[var(--po-text-dim)] underline">Back</button>
      <p className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)]">Nearby Card Shops</p>

      {loading && <p className="text-xs text-[var(--po-text-dim)]">Finding shops near you…</p>}

      {!loading && shops?.length === 0 && (
        <p className="text-xs text-[var(--po-text-dim)]">No card shops found within 10km. Try searching Google Maps for hobby stores nearby.</p>
      )}

      {!loading && shops?.map((shop, i) => (
        <a
          key={i}
          href={shop.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col gap-0.5 px-4 py-3 rounded-xl border border-[var(--po-border)] hover:border-[var(--po-green)] transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-bold text-[var(--po-text)]">{shop.name}</span>
            <span className="text-xs text-[var(--po-text-dim)] flex-shrink-0">{shop.distKm}km</span>
          </div>
          <span className="text-[10px] text-[var(--po-text-dim)]">{shop.address}</span>
          <span className="text-[10px] mt-1" style={{ color: "var(--po-green)" }}>Open in Maps →</span>
        </a>
      ))}
    </div>
  );
}
