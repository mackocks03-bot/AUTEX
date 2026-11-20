import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { onValue, ref } from "firebase/database";
import { db } from "@/firebase";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/context/AuthContext";

// ─── Types ───────────────────────────────────────────────────────────────────
export type TxCategory = "deposit" | "withdraw" | "commission" | "adjustment";

export interface HistoryItem {
  id: string;
  category: TxCategory;
  amount: number;
  currency: string;
  status: string;
  createdAt: number;
  type?: string;
  orderId?: string;
  reference?: string;
  destination?: string;
  network?: string;
  networkName?: string;
  accountNo?: string;
  accountName?: string;
  senderName?: string;
  fee?: number;
  description?: string;
  adminNote?: string;
  level?: number;
  percentage?: number;
  fromPhone?: string;
  botName?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === "") return "0.00";
  const n = Number(v);
  return isNaN(n) ? String(v) : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit",
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
type StatusKey = "completed" | "success" | "paid" | "failed" | "error" | "expired" | "cancelled" | "rejected" | string;
function statusMeta(status: StatusKey) {
  const s = String(status).toLowerCase();
  if (["completed", "success", "paid"].includes(s))
    return { label: "Completed", color: "#0ecb81", bg: "rgba(14,203,129,0.12)", dot: "#0ecb81" };
  if (["failed", "error", "expired", "cancelled", "rejected"].includes(s))
    return { label: "Rejected", color: "#f6465d", bg: "rgba(246,70,93,0.12)", dot: "#f6465d" };
  return { label: "Pending", color: "#f0b90b", bg: "rgba(240,185,11,0.12)", dot: "#f0b90b" };
}

function StatusBadge({ status }: { status: string }) {
  const m = statusMeta(status);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 8px", borderRadius: 999, fontSize: 10.5, fontWeight: 700,
      background: m.bg, color: m.color, letterSpacing: "0.03em",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: m.dot, display: "inline-block", flexShrink: 0 }} />
      {m.label.toUpperCase()}
    </span>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────
function SummaryCard({ list }: { list: HistoryItem[] }) {
  const totalDeposits = list
    .filter(p => p.category === "deposit" && ["completed", "success", "paid"].includes(String(p.status).toLowerCase()))
    .reduce((s, p) => s + p.amount, 0);

  const totalWithdrawals = list
    .filter(p => p.category === "withdraw" && ["completed", "success", "paid"].includes(String(p.status).toLowerCase()))
    .reduce((s, p) => s + p.amount, 0);

  const totalCommissions = list
    .filter(p => p.category === "commission" && ["completed", "success", "paid"].includes(String(p.status).toLowerCase()))
    .reduce((s, p) => s + p.amount, 0);

  const stat = (label: string, value: string | number, color?: string) => (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: color || "var(--text)", letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
    </div>
  );

  return (
    <div style={{
      borderRadius: 20,
      background: "linear-gradient(135deg, #00a651 0%, #007338 100%)",
      padding: "20px 18px 16px",
      marginBottom: 20,
      boxShadow: "0 8px 30px rgba(0,166,81,0.25)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Decorative backdrop glow */}
      <div style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.08)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -30, left: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />

      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>
        Total Deposits Made
      </div>
      <div style={{ fontSize: 30, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", marginBottom: 16 }}>
        ${fmt(totalDeposits)}
        <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.75)", marginLeft: 6 }}>USD</span>
      </div>

      {/* Stats Breakdown Row */}
      <div style={{
        display: "flex",
        background: "rgba(0,0,0,0.18)",
        borderRadius: 12,
        padding: "10px 6px",
      }}>
        {stat("All Tx", list.length)}
        <div style={{ width: 1, background: "rgba(255,255,255,0.12)", margin: "0 2px" }} />
        {stat("Payouts", `$${fmt(totalWithdrawals)}`, "#38bdf8")}
        <div style={{ width: 1, background: "rgba(255,255,255,0.12)", margin: "0 2px" }} />
        {stat("Earned", `$${fmt(totalCommissions)}`, "#facc15")}
      </div>
    </div>
  );
}

// ─── Transaction Row ───────────────────────────────────────────────────────────
function TxRow({
  item,
  onClick,
}: {
  item: HistoryItem;
  onClick: () => void;
}) {
  const m = statusMeta(item.status);
  const ref = item.reference || item.orderId || item.id;

  // Category visual setup
  const isCommission = item.category === "commission";
  const isWithdrawal = item.category === "withdraw";
  const isAdjustment = item.category === "adjustment";
  const isDeposit = item.category === "deposit";

  const categoryLabel =
    isCommission ? "Commission" :
    isWithdrawal ? "Withdrawal" :
    isAdjustment ? "Adjustment" : "Deposit";

  const categoryColor =
    isCommission ? "#facc15" :
    isWithdrawal ? "#38bdf8" :
    isAdjustment ? "#14b8a6" : "var(--text)";

  // Amount formatting
  const isDebit = isWithdrawal || (isAdjustment && item.amount < 0);
  const sign = isDebit ? "-" : "+";
  const amountColor = isDebit ? "#f6465d" : isCommission ? "#facc15" : "#0ecb81";

  // Subtitle text
  const subtext =
    isCommission ? (item.description || `Level ${item.level || 1} Referral Earnings`) :
    isWithdrawal ? (`To: ${item.destination || item.network || "Account"}`) :
    isAdjustment ? (item.description || "Admin Balance Update") :
    (item.network ? `${item.network} · ${shortRef(ref)}` : shortRef(ref));

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 16px",
        borderBottom: "1px solid var(--stroke)",
        cursor: "pointer",
        transition: "background 0.15s ease",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.03)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      {/* Category Icon */}
      <div style={{
        width: 42,
        height: 42,
        borderRadius: 14,
        flexShrink: 0,
        background:
          isCommission ? "rgba(250,204,21,0.15)" :
          isWithdrawal ? "rgba(56,189,248,0.15)" :
          isAdjustment ? "rgba(20,184,166,0.15)" :
          m.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 18,
      }}>
        {isCommission ? (
          "💰"
        ) : isWithdrawal ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="7" y1="17" x2="17" y2="7" />
            <polyline points="7 7 17 7 17 17" />
          </svg>
        ) : isAdjustment ? (
          "⚖️"
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0ecb81" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <polyline points="19 12 12 19 5 12" />
          </svg>
        )}
      </div>

      {/* Info: Category label + Status + Subtitle */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ fontWeight: 800, fontSize: 13.5, color: categoryColor }}>
            {categoryLabel}
          </span>
          <StatusBadge status={item.status} />
        </div>
        <div style={{
          fontSize: 12,
          color: "var(--muted)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          {subtext}
        </div>
      </div>

      {/* Amount + Date */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14.5, color: amountColor }}>
          {sign}${fmt(Math.abs(item.amount))}
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
          {fmtDate(Number(item.createdAt))}
        </div>
      </div>

      {/* Chevron */}
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </div>
  );
}

// ─── Detail Row in Modal ───────────────────────────────────────────────────────
function DetailRow({ label, value, mono, highlight }: { label: string; value: React.ReactNode; mono?: boolean; highlight?: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      padding: "11px 0", borderBottom: "1px solid var(--stroke)", gap: 12,
    }}>
      <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <span style={{
        fontSize: 13,
        fontWeight: highlight ? 800 : 600,
        color: highlight ? "var(--accent)" : "var(--text)",
        textAlign: "right",
        fontFamily: mono ? "monospace" : undefined,
        wordBreak: "break-all",
      }}>{value}</span>
    </div>
  );
}

// ─── Transaction Detail Modal ──────────────────────────────────────────────────
function TxModal({ item, onClose }: { item: HistoryItem; onClose: () => void }) {
  const m = statusMeta(item.status);
  const ref = item.reference || item.orderId || item.id;

  const isCommission = item.category === "commission";
  const isWithdrawal = item.category === "withdraw";
  const isAdjustment = item.category === "adjustment";
  const isDebit = isWithdrawal || (isAdjustment && item.amount < 0);

  const title =
    isCommission ? "Commission Details" :
    isWithdrawal ? "Withdrawal Details" :
    isAdjustment ? "Adjustment Details" : "Deposit Details";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          background: "var(--bg1)",
          borderRadius: "24px 24px 0 0",
          border: "1px solid var(--stroke)",
          boxShadow: "0 -20px 60px rgba(0,0,0,0.4)",
          maxHeight: "90vh",
          overflowY: "auto",
          animation: "slideUpModal 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
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
          <div style={{ width: 40, height: 4, borderRadius: 999, background: "rgba(0,0,0,0.18)" }} />
        </div>

        {/* Amount Hero */}
        <div style={{ textAlign: "center", padding: "20px 24px 18px" }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            margin: "0 auto 12px",
            background:
              isCommission ? "rgba(250,204,21,0.15)" :
              isWithdrawal ? "rgba(56,189,248,0.15)" :
              m.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 26,
          }}>
            {isCommission ? "💰" : isWithdrawal ? "📤" : isAdjustment ? "⚖️" : "📥"}
          </div>

          <div style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
            {title}
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: "var(--text)", letterSpacing: "-0.03em" }}>
            {isDebit ? "-" : "+"}${fmt(Math.abs(item.amount))}
            <span style={{ fontSize: 15, fontWeight: 600, color: "var(--muted)", marginLeft: 6 }}>
              {item.currency || "USD"}
            </span>
          </div>
          <div style={{ marginTop: 8 }}>
            <StatusBadge status={item.status} />
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "var(--stroke)", margin: "0 20px" }} />

        {/* Details list */}
        <div style={{ padding: "4px 24px 20px" }}>
          <DetailRow label="Category" value={isCommission ? "Referral Commission" : isWithdrawal ? "Withdrawal Payout" : isAdjustment ? "Balance Adjustment" : "Deposit"} highlight />
          <DetailRow label="Date & Time" value={fmtDateTime(Number(item.createdAt))} />
          <DetailRow label="Reference ID" value={shortRef(ref)} mono />

          {/* Conditional Category Rows */}
          {isWithdrawal && (
            <>
              {item.destination && <DetailRow label="Destination" value={item.destination} />}
              {item.network && <DetailRow label="Network" value={item.network} />}
              {item.accountName && <DetailRow label="Account Name" value={item.accountName} />}
              {item.fee != null && Number(item.fee) > 0 && <DetailRow label="Fee" value={`$${fmt(item.fee)}`} />}
              {item.fee != null && (
                <DetailRow label="Net Received" value={`$${fmt(Math.max(0, item.amount - (item.fee || 0)))}`} highlight />
              )}
            </>
          )}

          {isDeposit && (
            <>
              {item.network && <DetailRow label="Network" value={item.network} />}
              {item.accountNo && <DetailRow label="Sender Phone" value={item.accountNo} />}
              {item.senderName && <DetailRow label="Sender Name" value={item.senderName} />}
              {item.botName && <DetailRow label="Plan / Bot" value={item.botName} />}
            </>
          )}

          {isCommission && (
            <>
              {item.level != null && <DetailRow label="Tier Level" value={`Level ${item.level}`} />}
              {item.percentage != null && <DetailRow label="Rate" value={`${item.percentage}%`} />}
              {item.fromPhone && <DetailRow label="Downline User" value={item.fromPhone} />}
            </>
          )}

          {item.adminNote && (
            <DetailRow label="Admin Note" value={item.adminNote} />
          )}

          {item.description && !item.adminNote && !isCommission && (
            <DetailRow label="Description" value={item.description} />
          )}
        </div>

        {/* Action Button */}
        <div style={{ padding: "0 20px 28px", display: "flex", gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "13px 0",
              borderRadius: 12,
              border: "1px solid var(--stroke)",
              background: "var(--bg2)",
              color: "var(--text)",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Close
          </button>
          <Link
            to={isCommission ? "/affiliate" : isWithdrawal ? "/withdraw" : "/deposit"}
            style={{
              flex: 1.2,
              padding: "13px 0",
              borderRadius: 12,
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isCommission ? "My Team" : isWithdrawal ? "New Withdrawal" : "New Deposit"}
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Filter Bar ────────────────────────────────────────────────────────────────
type Filter = "all" | "deposit" | "withdraw" | "commission" | "completed" | "pending";

function FilterBar({ active, onChange }: { active: Filter; onChange: (f: Filter) => void }) {
  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "deposit", label: "Deposits" },
    { key: "withdraw", label: "Withdrawals" },
    { key: "commission", label: "Commissions" },
    { key: "completed", label: "Completed" },
    { key: "pending", label: "Pending" },
  ];

  return (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          style={{
            padding: "7px 15px",
            borderRadius: 999,
            border: "none",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 700,
            whiteSpace: "nowrap",
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
  const [payments, setPayments] = useState<HistoryItem[]>([]);
  const [withdrawals, setWithdrawals] = useState<HistoryItem[]>([]);
  const [selected, setSelected] = useState<HistoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (!user) {
      setPayments([]);
      setWithdrawals([]);
      setLoading(false);
      return;
    }

    let pLoaded = false;
    let wLoaded = false;
    const checkDone = () => {
      if (pLoaded && wLoaded) setLoading(false);
    };

    // 1. Listen to Deposits & Commissions & Adjustments
    const pRef = ref(db, `userPayments/${user.uid}`);
    const unsubP = onValue(pRef, (snap) => {
      const data = snap.val() as Record<string, any> | null;
      if (data) {
        const list: HistoryItem[] = Object.entries(data).map(([id, val]) => {
          const isComm =
            val.type === "referral_commission" ||
            String(val.description || "").toLowerCase().includes("commission");
          const isAdj = val.type === "admin_adjustment";
          const category: TxCategory = isComm ? "commission" : isAdj ? "adjustment" : "deposit";

          return {
            id,
            category,
            amount: Number(val.amount) || 0,
            currency: val.currency || "USD",
            status: val.status || "pending",
            createdAt: Number(val.createdAt) || Date.now(),
            type: val.type,
            orderId: val.orderId,
            reference: val.reference || val.depositKey || id,
            network: val.networkName || val.network,
            accountNo: val.accountNo || val.phone,
            accountName: val.accountName,
            senderName: val.senderName,
            description: val.description,
            level: val.level,
            percentage: val.percentage,
            fromPhone: val.fromPhone,
            botName: val.botName,
          };
        });
        setPayments(list);
      } else {
        setPayments([]);
      }
      pLoaded = true;
      checkDone();
    });

    // 2. Listen to Withdrawals
    const wRef = ref(db, `withdrawRequests/${user.uid}`);
    const unsubW = onValue(wRef, (snap) => {
      const data = snap.val() as Record<string, any> | null;
      if (data) {
        const list: HistoryItem[] = Object.entries(data).map(([id, val]) => {
          const isAdj = val.type === "admin_deduction";
          const category: TxCategory = isAdj ? "adjustment" : "withdraw";

          return {
            id,
            category,
            amount: Number(val.amount) || 0,
            currency: val.currency || "USD",
            status: val.status || "pending",
            createdAt: Number(val.createdAt) || Date.now(),
            type: val.type || "withdraw",
            destination: val.destination,
            network: val.networkName || val.network,
            accountName: val.accountName,
            fee: val.fee,
            description: val.description || val.adminNote,
            adminNote: val.adminNote,
            reference: id,
          };
        });
        setWithdrawals(list);
      } else {
        setWithdrawals([]);
      }
      wLoaded = true;
      checkDone();
    });

    return () => {
      unsubP();
      unsubW();
    };
  }, [user]);

  // Merge deposits, withdrawals, and commissions
  const list = useMemo(() => {
    return [...payments, ...withdrawals].sort(
      (a, b) => Number(b.createdAt) - Number(a.createdAt)
    );
  }, [payments, withdrawals]);

  // Apply filters
  const filtered = useMemo(() => {
    if (filter === "all") return list;
    if (filter === "deposit") return list.filter(p => p.category === "deposit");
    if (filter === "withdraw") return list.filter(p => p.category === "withdraw");
    if (filter === "commission") return list.filter(p => p.category === "commission");
    if (filter === "completed") {
      return list.filter(p => ["completed", "success", "paid"].includes(String(p.status).toLowerCase()));
    }
    if (filter === "pending") {
      return list.filter(p =>
        !["completed", "success", "paid", "failed", "error", "expired", "cancelled", "rejected"].includes(
          String(p.status).toLowerCase()
        )
      );
    }
    return list;
  }, [list, filter]);

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, HistoryItem[]> = {};
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
          <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Loading transaction history…</span>
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
          border: "1px solid var(--stroke)",
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

          {/* ── Filter Bar + Action Buttons ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 16 }}>
            <FilterBar active={filter} onChange={setFilter} />
            <Link
              to="/deposit"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "7px 15px", borderRadius: 999, flexShrink: 0,
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
            borderRadius: 20,
            background: "var(--bg1)",
            border: "1px solid var(--stroke)",
            boxShadow: "-6px -6px 14px rgba(255,255,255,0.05), 6px 6px 14px rgba(0,0,0,0.15)",
            overflow: "hidden",
          }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "50px 24px" }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 20, margin: "0 auto 16px",
                  background: "rgba(0,166,81,0.08)", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 28,
                }}>
                  📋
                </div>
                <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text)", marginBottom: 6 }}>
                  No Transactions Found
                </div>
                <div style={{ fontSize: 13, color: "var(--muted)", maxWidth: 280, margin: "0 auto 20px", lineHeight: 1.5 }}>
                  {filter === "all"
                    ? "Your deposits, withdrawals, and referral commissions will appear here."
                    : `No ${filter} transactions match this filter.`}
                </div>
              </div>
            ) : (
              Object.entries(grouped).map(([date, items]) => (
                <div key={date}>
                  {/* Date Group Header */}
                  <div style={{
                    padding: "9px 16px 6px",
                    fontSize: 11, fontWeight: 700, color: "var(--muted)",
                    textTransform: "uppercase", letterSpacing: "0.06em",
                    background: "rgba(0,0,0,0.02)",
                    borderBottom: "1px solid var(--stroke)",
                  }}>
                    {date}
                  </div>
                  {items.map((item) => (
                    <TxRow key={item.id} item={item} onClick={() => setSelected(item)} />
                  ))}
                </div>
              ))
            )}
          </div>

          {/* ── Footer Counter ── */}
          {filtered.length > 0 && (
            <div style={{ textAlign: "center", padding: "18px 0 4px", fontSize: 12, color: "var(--muted)" }}>
              Showing {filtered.length} of {list.length} transaction{list.length !== 1 ? "s" : ""}
            </div>
          )}
        </>
      )}

      {/* ── Transaction Detail Modal ── */}
      {selected && (
        <TxModal item={selected} onClose={() => setSelected(null)} />
      )}
    </Shell>
  );
}
