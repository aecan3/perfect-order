"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { isAdminClient } from "@/lib/admin-client";

export default function AdminReportsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [view, setView] = useState("open");
  const [notes, setNotes] = useState({});
  const [dismissing, setDismissing] = useState({});

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
      .from("user_reports")
      .select(
        "*, reporter:profiles!user_reports_reporter_id_fkey(handle), reported:profiles!user_reports_reported_user_id_fkey(handle)"
      )
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

  async function dismiss(reportId) {
    setDismissing((prev) => ({ ...prev, [reportId]: true }));
    const note = notes[reportId] || "";

    const res = await fetch(`/api/admin/reports/${reportId}/dismiss`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolution_note: note }),
    });

    if (res.ok) {
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      setNotes((prev) => { const n = { ...prev }; delete n[reportId]; return n; });
    }
    setDismissing((prev) => { const d = { ...prev }; delete d[reportId]; return d; });
  }

  // Render nothing until admin check completes — prevents any data flash
  // for non-admin users who will be redirected by router.replace above.
  if (checking) return null;

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

  return (
    <div style={{ padding: 24, background: "var(--po-bg-soft)", minHeight: "100vh", color: "var(--po-text)" }}>
      <h1 style={{ marginTop: 0, marginBottom: 20, fontSize: 20 }}>User Reports</h1>

      <div style={{ marginBottom: 16 }}>
        <button style={btnStyle(view === "open")} onClick={() => switchView("open")}>
          Open Cases
        </button>
        <button style={btnStyle(view === "dismissed")} onClick={() => switchView("dismissed")}>
          Dismissed
        </button>
      </div>

      {loading ? (
        <p style={{ color: "var(--po-text)" }}>Loading…</p>
      ) : reports.length === 0 ? (
        <p style={{ color: "var(--po-text)" }}>
          {view === "open" ? "No open reports. 🎉" : "No dismissed reports yet."}
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", background: "var(--po-bg-soft)" }}>
            <thead>
              <tr>
                <th style={thStyle}>Reporter</th>
                <th style={thStyle}>Reported</th>
                <th style={thStyle}>Reason</th>
                <th style={thStyle}>Details</th>
                <th style={thStyle}>Context</th>
                <th style={thStyle}>Date</th>
                {view === "open" && <th style={thStyle}>Action</th>}
                {view === "dismissed" && <th style={thStyle}>Resolved</th>}
                {view === "dismissed" && <th style={thStyle}>Note</th>}
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td style={tdStyle}>@{r.reporter?.handle ?? "—"}</td>
                  <td style={tdStyle}>@{r.reported?.handle ?? "—"}</td>
                  <td style={tdStyle}>{r.reason}</td>
                  <td style={{ ...tdStyle, maxWidth: 300 }}>{r.details ?? "—"}</td>
                  <td style={tdStyle}>{r.context}</td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                    {new Date(r.created_at).toISOString().slice(0, 16).replace("T", " ")}
                  </td>
                  {view === "open" && (
                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                      <input
                        type="text"
                        placeholder="note (optional)"
                        value={notes[r.id] || ""}
                        onChange={(e) =>
                          setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))
                        }
                        style={{
                          width: 160,
                          marginRight: 8,
                          padding: "3px 6px",
                          background: "transparent",
                          border: "1px solid var(--po-border)",
                          borderRadius: 3,
                          color: "var(--po-text)",
                          fontSize: 12,
                        }}
                      />
                      <button
                        onClick={() => dismiss(r.id)}
                        disabled={!!dismissing[r.id]}
                        style={{
                          padding: "4px 10px",
                          background: "transparent",
                          border: "1px solid var(--po-border)",
                          borderRadius: 3,
                          color: "var(--po-text)",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        {dismissing[r.id] ? "…" : "Dismiss"}
                      </button>
                    </td>
                  )}
                  {view === "dismissed" && (
                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                      {r.resolved_at
                        ? new Date(r.resolved_at).toISOString().slice(0, 16).replace("T", " ")
                        : "—"}
                    </td>
                  )}
                  {view === "dismissed" && (
                    <td style={tdStyle}>{r.resolution_note ?? "—"}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
