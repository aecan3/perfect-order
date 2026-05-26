"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { isAdminClient } from "@/lib/admin-client";

const CATEGORY_LABELS = {
  wrong_image: "Wrong image",
  wrong_name_or_number: "Wrong name or number",
  wrong_rarity: "Wrong rarity",
  wrong_price: "Wrong price",
  missing_card_or_variant: "Missing card or variant",
  other: "Other",
};

const VIEWS = [
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In Progress" },
  { key: "resolved", label: "Resolved" },
  { key: "dismissed", label: "Dismissed" },
];

function actionsFor(status) {
  if (status === "open") {
    return [
      { label: "Start work", target: "in_progress", needsNote: false },
      { label: "Mark Resolved", target: "resolved", needsNote: true },
      { label: "Dismiss", target: "dismissed", needsNote: true },
    ];
  }
  if (status === "in_progress") {
    return [
      { label: "Mark Resolved", target: "resolved", needsNote: true },
      { label: "Reopen", target: "open", needsNote: false },
      { label: "Dismiss", target: "dismissed", needsNote: true },
    ];
  }
  if (status === "resolved" || status === "dismissed") {
    return [{ label: "Reopen", target: "open", needsNote: false }];
  }
  return [];
}

export default function AdminCardReportsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [view, setView] = useState("open");
  const [notes, setNotes] = useState({});
  const [submitting, setSubmitting] = useState({});

  useEffect(() => {
    const supabase = createClient();

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/welcome");
        return;
      }

      const admin = await isAdminClient(supabase, user.id);
      if (!admin) {
        router.replace("/you");
        return;
      }

      await fetchReports(supabase, view);
      setChecking(false);
      setLoading(false);
    }

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchReports(supabase, status) {
    setLoading(true);
    const { data } = await supabase
      .from("card_reports")
      .select("*, reporter:profiles!card_reports_reporter_id_fkey(handle)")
      .eq("status", status)
      .order("created_at", { ascending: false });
    setReports(data || []);
    setLoading(false);
  }

  async function switchView(newView) {
    setView(newView);
    const supabase = createClient();
    await fetchReports(supabase, newView);
  }

  async function changeStatus(reportId, targetStatus, includeNote) {
    setSubmitting((prev) => ({ ...prev, [reportId]: true }));

    const body = { status: targetStatus };
    if (includeNote) {
      body.resolution_note = notes[reportId] || "";
    }

    const res = await fetch(`/api/admin/card-reports/${reportId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      setNotes((prev) => {
        const n = { ...prev };
        delete n[reportId];
        return n;
      });
    }
    setSubmitting((prev) => {
      const s = { ...prev };
      delete s[reportId];
      return s;
    });
  }

  if (checking) return null;

  const isHistorical = view === "resolved" || view === "dismissed";

  const tdStyle = {
    padding: "8px 10px",
    borderBottom: "1px solid var(--po-border)",
    verticalAlign: "top",
    color: "var(--po-text)",
    fontSize: 13,
  };

  const thStyle = {
    ...tdStyle,
    fontWeight: 600,
    borderBottom: "2px solid var(--po-border)",
    whiteSpace: "nowrap",
  };

  const btnStyle = (active) => ({
    padding: "6px 14px",
    marginRight: 8,
    background: active ? "var(--po-text)" : "transparent",
    color: active ? "var(--po-bg-soft)" : "var(--po-text)",
    border: "1px solid var(--po-border)",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 13,
  });

  const actionBtnStyle = {
    display: "block",
    width: "100%",
    marginBottom: 4,
    padding: "3px 8px",
    background: "transparent",
    border: "1px solid var(--po-border)",
    borderRadius: 3,
    color: "var(--po-text)",
    cursor: "pointer",
    fontSize: 12,
    textAlign: "left",
  };

  const currentViewLabel = VIEWS.find((v) => v.key === view)?.label ?? view;

  return (
    <div
      style={{
        padding: 24,
        background: "var(--po-bg-soft)",
        minHeight: "100vh",
        color: "var(--po-text)",
      }}
    >
      <h1 style={{ marginTop: 0, marginBottom: 20, fontSize: 20 }}>Card Reports</h1>

      <div style={{ marginBottom: 16 }}>
        {VIEWS.map((v) => (
          <button
            key={v.key}
            style={btnStyle(view === v.key)}
            onClick={() => switchView(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: "var(--po-text)" }}>Loading…</p>
      ) : reports.length === 0 ? (
        <p style={{ color: "var(--po-text)" }}>No {currentViewLabel.toLowerCase()} reports.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              borderCollapse: "collapse",
              width: "100%",
              background: "var(--po-bg-soft)",
            }}
          >
            <thead>
              <tr>
                <th style={thStyle}>Reporter</th>
                <th style={thStyle}>Set</th>
                <th style={thStyle}>Category</th>
                <th style={thStyle}>Details</th>
                <th style={thStyle}>Date</th>
                {isHistorical && <th style={thStyle}>Resolved</th>}
                {isHistorical && <th style={thStyle}>Note</th>}
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => {
                const actions = actionsFor(r.status);
                const hasNoteActions = actions.some((a) => a.needsNote);
                return (
                  <tr key={r.id}>
                    <td style={tdStyle}>@{r.reporter?.handle ?? "—"}</td>
                    <td style={tdStyle}>{r.set_id ?? "—"}</td>
                    <td style={tdStyle}>
                      {CATEGORY_LABELS[r.category] ?? r.category}
                    </td>
                    <td style={{ ...tdStyle, maxWidth: 300 }}>{r.details}</td>
                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                      {new Date(r.created_at).toISOString().slice(0, 16).replace("T", " ")}
                    </td>
                    {isHistorical && (
                      <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                        {r.resolved_at
                          ? new Date(r.resolved_at).toISOString().slice(0, 16).replace("T", " ")
                          : "—"}
                      </td>
                    )}
                    {isHistorical && (
                      <td style={tdStyle}>{r.resolution_note ?? "—"}</td>
                    )}
                    <td style={{ ...tdStyle, minWidth: 180 }}>
                      {hasNoteActions && (
                        <input
                          type="text"
                          placeholder="note (optional)"
                          value={notes[r.id] || ""}
                          onChange={(e) =>
                            setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))
                          }
                          style={{
                            width: "100%",
                            marginBottom: 6,
                            padding: "3px 6px",
                            background: "transparent",
                            border: "1px solid var(--po-border)",
                            borderRadius: 3,
                            color: "var(--po-text)",
                            fontSize: 12,
                            boxSizing: "border-box",
                          }}
                        />
                      )}
                      {actions.map((action) => (
                        <button
                          key={action.target}
                          style={actionBtnStyle}
                          disabled={!!submitting[r.id]}
                          onClick={() =>
                            changeStatus(r.id, action.target, action.needsNote)
                          }
                        >
                          {submitting[r.id] ? "…" : action.label}
                        </button>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
