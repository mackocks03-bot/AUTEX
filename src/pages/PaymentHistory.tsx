import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { onValue, ref } from "firebase/database";
import { db } from "@/firebase";
import type { UserPayment } from "@/types";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/context/AuthContext";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}
function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}
function fmtDateTime(ts: number) {
  return `${fmtDate(ts)} ${fmtTime(ts)}`;
}
function shortRef(ref?: string) {
  if (!ref) return "—";
  return ref.length > 16 ? ref.slice(0, 8) + "…" + ref.slice(-6) : ref;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
type StatusKey = "completed" | "success" | "paid" | "failed" | "error" | "expired" | "cancelled" | string;
function statusMeta(status: StatusKey) {
  const s = String(status).toLowerCase();
  if (["completed", "success", "paid"].includes(s))
    return { label: "Completed", color: "#0ecb81", bg: "rgba(14,203,129,0.12)", dot: "#0ecb81" };
  if (["failed", "error", "expired", "cancelled"].includes(s))
    return { label: "Failed", color: "#f6465d", bg: "rgba(246,70,93,0.12)", dot: "#f6465d" };
  return { label: "Pending", color: "#f0b90b", bg: "rgba(240,185,11,0.12)", dot: "#f0b90b" };
}

function StatusBadge({ status }: { status: string }) {
  const m = statusMeta(status);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
      background: m.bg, color: m.color, letterSpacing: "0.04em",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.dot, display: "inline-block", flexShrink: 0 }} />
      {m.label.toUpperCase()}
    </span>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────
function SummaryCard({
  list,
}: {
  list: (UserPayment & { id: string })[];
}) {
  const total = list.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const completed = list.filter((p) => ["completed", "success", "paid"].includes(String(p.status).toLowerCase()));
  const pending = list.filter((p) => !["completed", "success", "paid", "failed", "error", "expired", "cancelled"].includes(String(p.status).toLowerCase()));
  const failed = list.filter((p) => ["failed", "error", "expired", "cancelled"].includes(String(p.status).toLowerCase()));

  const stat = (label: string, value: string | number, color?: string) => (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: color || "var(--text)", letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
    </div>
  );

  return (
    <div style={{
      borderRadius: 20,
      background: "linear-gradient(135deg, #00a651 0%, #008040 100%)",
      padding: "22px 20px 18px",
      marginBottom: 20,
      boxShadow: "0 8px 32px rgba(0,166,81,0.25)",
      position: "relative", overflow: "hidden",
    }}>
      {/* Background circles */}
      <div style={{ position: "absolute", top: -40, right: -40, width: 150, height: 150, borderRadius: "50%", background: "rgba(255,255,255,0.07)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -30, left: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />

      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Total Deposits</div>
      <div style={{ fontSize: 32, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", marginBottom: 20 }}>
        {total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        <span style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginLeft: 6 }}>
          {list[0]?.currency || "TZS"}
        </span>
      </div>

      {/* Stats Row */}
      <div style={{
        display: "flex", gap: 0,
        background: "rgba(0,0,0,0.15)", borderRadius: 14, padding: "12px 8px",
      }}>
        {stat("All", list.length)}
        <div style={{ width: 1, background: "rgba(255,255,255,0.15)", margin: "0 4px" }} />
        {stat("Done", completed.length, "#0ecb81")}
        <div style={{ width: 1, background: "rgba(255,255,255,0.15)", margin: "0 4px" }} />
        {stat("Pending", pending.length, "#f0b90b")}
        <div style={{ width: 1, background: "rgba(255,255,255,0.15)", margin: "0 4px" }} />
        {stat("Failed", failed.length, "#f6465d")}
      </div>
    </div>
  );
}

// ─── Transaction Row ───────────────────────────────────────────────────────────
function TxRow({
  payment,
  onClick,
}: {
  payment: UserPayment & { id: string };
  onClick: () => void;
}) {
  const m = statusMeta(payment.status);
  const ref = payment.reference || payment.palmpesaTransid || payment.selcomTransid || payment.orderId || payment.id;

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 16px",
        borderBottom: "1px solid var(--stroke)",
        cursor: "pointer",
        transition: "background 0.15s ease",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.03)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      {/* Icon */}
      <div style={{
        width: 42, height: 42, borderRadius: 14, flexShrink: 0,
        background: m.bg,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={m.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          {["completed", "success", "paid"].includes(String(payment.status).toLowerCase())
            ? <><path d="M12 5v14M5 12l7 7 7-7" /></>
            : ["failed", "error", "expired", "cancelled"].includes(String(payment.status).toLowerCase())
            ? <><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>
            : <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>
          }
        </svg>
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>Deposit</span>
          <StatusBadge status={payment.status} />
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {shortRef(ref)}
        </div>
      </div>

      {/* Amount + Date */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: m.color }}>
          +{Number(payment.amount).toLocaleString("en-US", { minimumFractionDigits: 0 })}
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
          {fmtDate(Number(payment.createdAt))}
        </div>
      </div>

      {/* Chevron */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </div>
  );
}

// ─── Detail Row in Modal ───────────────────────────────────────────────────────
function DetailRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      padding: "12px 0", borderBottom: "1px solid var(--stroke)", gap: 12,
    }}>
      <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <span style={{
        fontSize: 13, fontWeight: 600, color: "var(--text)", textAlign: "right",
        fontFamily: mono ? "monospace" : undefined, wordBreak: "break-all",
      }}>{value}</span>
    </div>
  );
}

// ─── Transaction Detail Modal ──────────────────────────────────────────────────
function TxModal({ payment, onClose }: { payment: UserPayment & { id: string }; onClose: () => void }) {
  const m = statusMeta(payment.status);
  const ref = payment.reference || payment.palmpesaTransid || payment.selcomTransid || payment.orderId || payment.id;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        padding: "0 0 0 0",
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480,
          background: "var(--bg1)",
          borderRadius: "24px 24px 0 0",
          border: "1px solid rgba(255,255,255,0.4)",
          boxShadow: "0 -20px 60px rgba(0,0,0,0.3)",
          maxHeight: "90vh", overflowY: "auto",
          animation: "slideUpModal 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <style>{`
          @keyframes slideUpModal {
            from { transform: translateY(60px); opacity: 0; }
            to   { transform: translateY(0); opacity: 1; }
          }
        `}</style>

        {/* Handle bar */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: 40, height: 4, borderRadius: 999, background: "rgba(0,0,0,0.15)" }} />
        </div>

        {/* Amount Hero */}
        <div style={{ textAlign: "center", padding: "24px 24px 20px" }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20, margin: "0 auto 16px",
            background: m.bg,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={m.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {["completed", "success", "paid"].includes(String(payment.status).toLowerCase())
                ? <><path d="M12 5v14M5 12l7 7 7-7" /></>
                : ["failed", "error", "expired", "cancelled"].includes(String(payment.status).toLowerCase())
                ? <><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>
                : <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>
              }
            </svg>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Deposit Amount</div>
          <div style={{ fontSize: 36, fontWeight: 900, color: "var(--text)", letterSpacing: "-0.03em" }}>
            {Number(payment.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            <span style={{ fontSize: 18, fontWeight: 600, color: "var(--muted)", marginLeft: 6 }}>{payment.currency}</span>
          </div>
          <div style={{ marginTop: 10 }}>
            <StatusBadge status={payment.status} />
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "var(--stroke)", margin: "0 20px" }} />

        {/* Details */}
        <div style={{ padding: "4px 24px 20px" }}>
          <DetailRow label="Date & Time" value={fmtDateTime(Number(payment.createdAt))} />
          <DetailRow label="Order ID" value={payment.orderId || payment.id} mono />
          {ref && ref !== payment.orderId && ref !== payment.id && (
            <DetailRow label="Transaction Ref" value={ref} mono />
          )}
          {payment.selcomTransid && (
            <DetailRow label="Selcom Transid" value={payment.selcomTransid} mono />
          )}
          {payment.palmpesaTransid && (
            <DetailRow label="PalmPesa Transid" value={payment.palmpesaTransid} mono />
          )}
          <DetailRow label="Currency" value={payment.currency} />
          <DetailRow label="Network" value="Mobile Money" />
          <DetailRow label="Fee" value="0.00" />
        </div>

        {/* Actions */}
        <div style={{ padding: "0 20px 32px", display: "flex", gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: "14px 0", borderRadius: 14, border: "1px solid var(--stroke)",
              background: "var(--bg2)", color: "var(--text)", fontWeight: 700, fontSize: 14, cursor: "pointer",
            }}
          >
            Close
          </button>
          <Link
            to="/my-bots"
            style={{
              flex: 1, padding: "14px 0", borderRadius: 14, border: "none",
              background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
              textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            My Bots
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{ textAlign: "center", padding: "60px 24px" }}>
      <div style={{
        width: 80, height: 80, borderRadius: 24, margin: "0 auto 20px",
        background: "rgba(0,166,81,0.08)", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      </div>
      <div style={{ fontWeight: 800, fontSize: 17, color: "var(--text)", marginBottom: 6 }}>No Transactions Yet</div>
      <div style={{ fontSize: 13, color: "var(--muted)", maxWidth: 260, margin: "0 auto 24px", lineHeight: 1.5 }}>
        Your deposit & payment history will appear here once you make your first transaction.
      </div>
      <Link
        to="/payments"
        style={{
          display: "inline-block", padding: "12px 28px", borderRadius: 999,
          background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 14,
          textDecoration: "none",
        }}
      >
        Make a Deposit
      </Link>
    </div>
  );
}

// ─── Filter Bar ────────────────────────────────────────────────────────────────
type Filter = "all" | "completed" | "pending" | "failed";
function FilterBar({ active, onChange }: { active: Filter; onChange: (f: Filter) => void }) {
  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "completed", label: "Completed" },
    { key: "pending", label: "Pending" },
    { key: "failed", label: "Failed" },
  ];
  return (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          style={{
            padding: "7px 16px", borderRadius: 999, border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
            background: active === t.key ? "var(--accent)" : "var(--bg2)",
            color: active === t.key ? "#fff" : "var(--muted)",
            transition: "all 0.2s ease",
            flexShrink: 0,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PaymentHistory() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Record<string, UserPayment> | null>(null);
  const [selected, setSelected] = useState<(UserPayment & { id: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (!user) { setRows(null); setLoading(false); return; }
    const r = ref(db, `userPayments/${user.uid}`);
    return onValue(r, (snap) => {
      setRows(snap.val() as Record<string, UserPayment> | null);
      setLoading(false);
    });
  }, [user]);

  const list = useMemo(() => {
    if (!rows) return [];
    return Object.entries(rows)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
  }, [rows]);

  const filtered = useMemo(() => {
    if (filter === "all") return list;
    if (filter === "completed") return list.filter(p => ["completed", "success", "paid"].includes(String(p.status).toLowerCase()));
    if (filter === "pending") return list.filter(p => !["completed", "success", "paid", "failed", "error", "expired", "cancelled"].includes(String(p.status).toLowerCase()));
    if (filter === "failed") return list.filter(p => ["failed", "error", "expired", "cancelled"].includes(String(p.status).toLowerCase()));
    return list;
  }, [list, filter]);

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, (UserPayment & { id: string })[]> = {};
    for (const p of filtered) {
      const key = fmtDate(Number(p.createdAt));
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
    return groups;
  }, [filtered]);

  if (loading) {
    return (
      <Shell>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "50vh", gap: 16 }}>
          <div style={{
            width: 44, height: 44,
            border: "3px solid rgba(0,166,81,0.15)",
            borderTopColor: "var(--accent)",
            borderRadius: "50%",
            animation: "spinLoader 0.9s linear infinite",
          }} />
          <style>{`@keyframes spinLoader { to { transform: rotate(360deg); } }`}</style>
          <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Loading transactions…</span>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* ── Header ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500, marginBottom: 4 }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>
          Transaction History
        </div>
      </div>

      {/* ── Not Logged In ── */}
      {!user && (
        <div style={{
          borderRadius: 20, background: "var(--bg1)",
          border: "1px solid rgba(255,255,255,0.4)",
          boxShadow: "-6px -6px 14px rgba(255,255,255,1), 6px 6px 14px rgba(163,177,198,0.6)",
          padding: "48px 24px", textAlign: "center",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
          <div style={{ fontWeight: 800, fontSize: 18, color: "var(--text)", marginBottom: 8 }}>Sign in to view history</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24 }}>Log in to access your complete transaction history</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <Link to="/register" style={{
              padding: "12px 24px", borderRadius: 12, fontWeight: 700, fontSize: 14,
              border: "1px solid var(--stroke)", background: "transparent", color: "var(--text)", textDecoration: "none",
            }}>Register</Link>
            <Link to="/login" style={{
              padding: "12px 24px", borderRadius: 12, fontWeight: 700, fontSize: 14,
              background: "var(--accent)", color: "#fff", textDecoration: "none",
            }}>Log In</Link>
          </div>
        </div>
      )}

      {user && (
        <>
          {/* ── Summary Card ── */}
          {list.length > 0 && <SummaryCard list={list} />}

          {/* ── Filter + Deposit Button ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 16 }}>
            <FilterBar active={filter} onChange={setFilter} />
            <Link
              to="/payments"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "7px 16px", borderRadius: 999, flexShrink: 0,
                background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 12,
                textDecoration: "none",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Deposit
            </Link>
          </div>

          {/* ── Transaction List ── */}
          <div style={{
            borderRadius: 20, background: "var(--bg1)",
            border: "1px solid rgba(255,255,255,0.4)",
            boxShadow: "-6px -6px 14px rgba(255,255,255,1), 6px 6px 14px rgba(163,177,198,0.6)",
            overflow: "hidden",
          }}>
            {filtered.length === 0 ? (
              <EmptyState />
            ) : (
              Object.entries(grouped).map(([date, payments]) => (
                <div key={date}>
                  {/* Date Group Header */}
                  <div style={{
                    padding: "10px 16px 6px",
                    fontSize: 11, fontWeight: 700, color: "var(--muted)",
                    textTransform: "uppercase", letterSpacing: "0.07em",
                    background: "rgba(0,0,0,0.02)",
                    borderBottom: "1px solid var(--stroke)",
                  }}>
                    {date}
                  </div>
                  {payments.map((p) => (
                    <TxRow key={p.id} payment={p} onClick={() => setSelected(p)} />
                  ))}
                </div>
              ))
            )}
          </div>

          {/* ── Footer Note ── */}
          {filtered.length > 0 && (
            <div style={{ textAlign: "center", padding: "20px 0 4px", fontSize: 12, color: "var(--muted)" }}>
              Showing {filtered.length} of {list.length} transaction{list.length !== 1 ? "s" : ""}
            </div>
          )}
        </>
      )}

      {/* ── Transaction Detail Modal ── */}
      {selected && (
        <TxModal payment={selected} onClose={() => setSelected(null)} />
      )}
    </Shell>
  );
}
