import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ref, onValue, set } from "firebase/database";
import { db } from "@/firebase";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/context/AuthContext";
import type { AppNotification } from "@/types";

function fmt(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  return isNaN(n) ? String(v) : n.toFixed(2);
}

/** Renders the meta details grid for transaction notifications */
function NotifMeta({ type, meta }: { type?: string; meta?: Record<string, string | number | boolean | null> }) {
  if (!meta) return null;

  const rows: { label: string; value: string; highlight?: boolean }[] = [];

  if (type === "deposit_approved" || type === "deposit_rejected") {
    if (meta.amount != null) rows.push({ label: "Amount", value: `$${fmt(meta.amount as number)} ${meta.currency || "USD"}`, highlight: true });
    if (meta.network) rows.push({ label: "Network", value: String(meta.network) });
    if (meta.phone) rows.push({ label: "From Phone", value: String(meta.phone) });
    if (meta.senderName) rows.push({ label: "Sender Name", value: String(meta.senderName) });
    if (meta.accountNo) rows.push({ label: "Account No.", value: String(meta.accountNo) });
    if (meta.botName) rows.push({ label: "Plan / Bot", value: String(meta.botName) });
    if (meta.reference) rows.push({ label: "Reference ID", value: String(meta.reference).slice(0, 20) });
    if (type === "deposit_rejected" && meta.reason) rows.push({ label: "Rejection Reason", value: String(meta.reason) });
    const ts = type === "deposit_approved" ? meta.approvedAt : meta.rejectedAt;
    if (ts) rows.push({ label: "Processed At", value: new Date(Number(ts)).toLocaleString() });
  }

  if (type === "withdrawal_approved" || type === "withdrawal_rejected") {
    if (meta.amount != null) rows.push({ label: "Amount", value: `$${fmt(meta.amount as number)} ${meta.currency || "USD"}`, highlight: true });
    if (meta.fee != null && meta.fee !== 0) rows.push({ label: "Processing Fee", value: `$${fmt(meta.fee as number)}` });
    if (meta.netAmount != null) rows.push({ label: "Net Received", value: `$${fmt(meta.netAmount as number)}`, highlight: type === "withdrawal_approved" });
    if (meta.network) rows.push({ label: "Network", value: String(meta.network) });
    if (meta.destination) rows.push({ label: "Destination", value: String(meta.destination) });
    if (meta.accountName) rows.push({ label: "Account Name", value: String(meta.accountName) });
    if (meta.reference) rows.push({ label: "Reference ID", value: String(meta.reference).slice(0, 20) });
    if (type === "withdrawal_rejected" && meta.reason) rows.push({ label: "Rejection Reason", value: String(meta.reason) });
    const ts = type === "withdrawal_approved" ? meta.processedAt : meta.rejectedAt;
    if (ts) rows.push({ label: "Processed At", value: new Date(Number(ts)).toLocaleString() });
  }

  if (type === "commission") {
    if (meta.commissionAmount != null) rows.push({ label: "Commission Earned", value: `$${fmt(meta.commissionAmount as number)} ${meta.currency || "USD"}`, highlight: true });
    if (meta.percentage != null) rows.push({ label: "Commission Rate", value: `Level ${meta.level} — ${meta.percentage}%` });
    if (meta.fromUser) rows.push({ label: "From", value: String(meta.fromUser) });
    if (meta.depositAmount != null) rows.push({ label: "Their Deposit", value: `$${fmt(meta.depositAmount as number)}` });
    if (meta.network) rows.push({ label: "Network", value: String(meta.network) });
    if (meta.depositReference) rows.push({ label: "Deposit Ref.", value: String(meta.depositReference).slice(0, 20) });
    if (meta.earnedAt) rows.push({ label: "Earned At", value: new Date(Number(meta.earnedAt)).toLocaleString() });
  }

  if (!rows.length) return null;

  return (
    <div style={{
      marginTop: 10,
      borderRadius: 10,
      overflow: "hidden",
      border: "1px solid var(--stroke)",
      fontSize: 13,
    }}>
      {rows.map((row, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 8,
            padding: "7px 12px",
            background: i % 2 === 0 ? "rgba(0,0,0,0.04)" : "transparent",
            borderTop: i === 0 ? "none" : "1px solid var(--stroke)",
          }}
        >
          <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{row.label}</span>
          <span style={{
            fontWeight: row.highlight ? 700 : 500,
            color: row.highlight ? "var(--accent)" : "var(--text)",
            textAlign: "right",
            wordBreak: "break-all",
          }}>
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Notifications() {
  const { user } = useAuth();
  const [globalNotifs, setGlobalNotifs] = useState<AppNotification[]>([]);
  const [personalNotifs, setPersonalNotifs] = useState<AppNotification[]>([]);
  const [reads, setReads] = useState<Record<string, boolean>>({});

  // Global broadcast notifications
  useEffect(() => {
    const r = ref(db, "notifications");
    return onValue(r, (snap) => {
      const data = snap.val() as Record<string, AppNotification> | null;
      if (data) {
        setGlobalNotifs(
          Object.entries(data)
            .map(([id, val]) => ({ ...val, id: `global_${id}`, type: val.type || "broadcast" }))
            .sort((a, b) => b.createdAt - a.createdAt)
        );
      } else {
        setGlobalNotifs([]);
      }
    });
  }, []);

  // Personal per-user notifications (from admin actions)
  useEffect(() => {
    if (!user) return;
    const r = ref(db, `userNotifications/${user.uid}`);
    return onValue(r, (snap) => {
      const data = snap.val() as Record<string, AppNotification> | null;
      if (data) {
        setPersonalNotifs(
          Object.entries(data)
            .map(([id, val]) => ({ ...val, id: `personal_${id}` }))
            .sort((a, b) => b.createdAt - a.createdAt)
        );
      } else {
        setPersonalNotifs([]);
      }
    });
  }, [user]);

  const notifications = [...personalNotifs, ...globalNotifs].sort(
    (a, b) => b.createdAt - a.createdAt
  );

  useEffect(() => {
    if (!user) return;
    const r = ref(db, `userReads/${user.uid}`);
    return onValue(r, (snap) => {
      setReads(snap.val() || {});
    });
  }, [user]);

  const markAsRead = async (id: string) => {
    if (!user || reads[id]) return;
    try {
      await set(ref(db, `userReads/${user.uid}/${id}`), true);
    } catch {
      // ignore
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const newReads = { ...reads };
    notifications.forEach((n) => {
      if (n.id) newReads[n.id] = true;
    });
    try {
      await set(ref(db, `userReads/${user.uid}`), newReads);
    } catch {
      // ignore
    }
  };

  if (!user) {
    return (
      <Shell>
        <div className="alert">
          Log in to view your notifications. <Link to="/login">Log in</Link>
        </div>
      </Shell>
    );
  }

  const unreadCount = notifications.filter((n) => n.id && !reads[n.id]).length;

  return (
    <Shell>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Notifications</h1>
        {unreadCount > 0 && (
          <button className="neu-btn btn-ghost" onClick={() => void markAllAsRead()}>
            Mark all as read
          </button>
        )}
      </div>

      <div className="grid" style={{ gap: 12 }}>
        {notifications.map((n) => {
          const isUnread = n.id && !reads[n.id];
          const typeIcon =
            n.type === "deposit_approved" ? "✅" :
            n.type === "deposit_rejected" ? "❌" :
            n.type === "commission" ? "💰" :
            n.type === "withdrawal_approved" ? "💸" :
            n.type === "withdrawal_rejected" ? "🚫" :
            n.type === "broadcast" ? "📢" : "🔔";

          const iconBg =
            n.type === "deposit_approved" ? "rgba(0,166,81,0.15)" :
            n.type === "deposit_rejected" ? "rgba(239,68,68,0.15)" :
            n.type === "commission" ? "rgba(234,179,8,0.15)" :
            n.type === "withdrawal_approved" ? "rgba(56,189,248,0.15)" :
            n.type === "withdrawal_rejected" ? "rgba(239,68,68,0.15)" :
            "rgba(99,102,241,0.15)";

          return (
            <div
              key={n.id}
              className="neu-card"
              style={{
                cursor: isUnread ? "pointer" : "default",
                borderColor: isUnread ? "var(--accent)" : "var(--stroke)",
                background: isUnread ? "rgba(56, 189, 248, 0.04)" : undefined,
              }}
              onClick={() => {
                if (isUnread && n.id) {
                  void markAsRead(n.id);
                }
              }}
            >
              <div className="card-body">
                {/* Header row */}
                <div className="row" style={{ gap: 14, alignItems: "flex-start" }}>
                  {/* Icon or image */}
                  {n.imageUrl ? (
                    <img
                      src={n.imageUrl}
                      alt=""
                      style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{
                      width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                      background: iconBg,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
                    }}>
                      {typeIcon}
                    </div>
                  )}

                  {/* Title + message */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: isUnread ? "var(--text)" : "var(--muted)" }}>
                        {n.title}
                      </div>
                      {isUnread && (
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
                      )}
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: 13.5, lineHeight: 1.5, marginBottom: 4 }}>
                      {n.message}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", opacity: 0.7 }}>
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Detail meta grid */}
                <NotifMeta type={n.type} meta={n.meta} />
              </div>
            </div>
          );
        })}

        {!notifications.length && (
          <div className="neu-card">
            <div className="card-body" style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>📭</div>
              <h3 style={{ margin: "0 0 8px" }}>No notifications</h3>
              <p className="muted" style={{ margin: 0 }}>You're all caught up!</p>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
