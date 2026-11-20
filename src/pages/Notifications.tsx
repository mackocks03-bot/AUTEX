import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ref, onValue, set } from "firebase/database";
import { db } from "@/firebase";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/context/AuthContext";
import type { AppNotification } from "@/types";

function fmt(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === "") return "0.00";
  const n = Number(v);
  return isNaN(n) ? String(v) : n.toFixed(2);
}

/** Formats all transaction details into one natural, unified paragraph */
function getNotificationParagraph(n: AppNotification): string {
  const meta = n.meta;
  if (!meta) return n.message;

  const t = n.type;
  if (t === "deposit_approved") {
    const amt = meta.amount != null ? `$${fmt(meta.amount)} ${meta.currency || "USD"}` : "";
    const net = meta.network ? ` via ${meta.network}` : "";
    const acc = meta.accountNo ? ` (Acc: ${meta.accountNo})` : "";
    const sender = meta.senderName ? ` from ${meta.senderName}` : "";
    const plan = meta.botName ? ` for ${meta.botName}` : "";
    const refId = meta.reference ? ` Ref: ${String(meta.reference).slice(0, 16)}.` : "";
    return `Your deposit of ${amt}${net}${acc}${sender}${plan} has been approved and credited to your wallet balance.${refId} Happy investing!`;
  }

  if (t === "deposit_rejected") {
    const amt = meta.amount != null ? `$${fmt(meta.amount)} ${meta.currency || "USD"}` : "";
    const net = meta.network ? ` via ${meta.network}` : "";
    const acc = meta.accountNo ? ` (Acc: ${meta.accountNo})` : "";
    const reason = meta.reason ? ` Reason: ${meta.reason}.` : "";
    const refId = meta.reference ? ` Ref: ${String(meta.reference).slice(0, 16)}.` : "";
    return `Your deposit of ${amt}${net}${acc} was rejected.${reason}${refId} Please contact support if you believe this is an error.`;
  }

  if (t === "commission") {
    const comm = meta.commissionAmount != null ? `$${fmt(meta.commissionAmount)} ${meta.currency || "USD"}` : "";
    const lvl = meta.level != null ? `Level ${meta.level}` : "";
    const pct = meta.percentage != null ? ` (${meta.percentage}%)` : "";
    const from = meta.fromUser ? ` from downline user ${meta.fromUser}` : "";
    const depAmt = meta.depositAmount != null ? ` on their deposit of $${fmt(meta.depositAmount)}` : "";
    const net = meta.network ? ` via ${meta.network}` : "";
    const refId = meta.depositReference ? ` Ref: ${String(meta.depositReference).slice(0, 16)}.` : "";
    return `You earned a ${lvl} referral commission of ${comm}${pct}${from}${depAmt}${net}.${refId}`;
  }

  if (t === "withdrawal_approved") {
    const amt = meta.amount != null ? `$${fmt(meta.amount)} ${meta.currency || "USD"}` : "";
    const dest = meta.destination ? ` to ${meta.destination}` : "";
    const net = meta.network ? ` via ${meta.network}` : "";
    const feeInfo = meta.fee && Number(meta.fee) > 0 ? ` (Net: $${fmt(meta.netAmount)}, Fee: $${fmt(meta.fee)})` : "";
    const refId = meta.reference ? ` Ref: ${String(meta.reference).slice(0, 16)}.` : "";
    return `Your withdrawal payout of ${amt}${dest}${net}${feeInfo} has been approved and processed successfully.${refId}`;
  }

  if (t === "withdrawal_rejected") {
    const amt = meta.amount != null ? `$${fmt(meta.amount)} ${meta.currency || "USD"}` : "";
    const dest = meta.destination ? ` to ${meta.destination}` : "";
    const reason = meta.reason ? ` Reason: ${meta.reason}.` : "";
    const refId = meta.reference ? ` Ref: ${String(meta.reference).slice(0, 16)}.` : "";
    return `Your withdrawal request of ${amt}${dest} was rejected.${reason}${refId} Please contact support for assistance.`;
  }

  if (t === "balance_adjustment") {
    const amt = meta.amount != null ? `$${fmt(meta.amount)} USD` : "";
    const newBal = meta.newBalance != null ? ` New balance: $${fmt(meta.newBalance)} USD.` : "";
    const reason = meta.reason ? ` Note: ${meta.reason}.` : "";
    const refId = meta.reference ? ` Ref: ${String(meta.reference).slice(0, 16)}.` : "";
    return `Your wallet balance has been adjusted with ${amt} by administrator.${newBal}${reason}${refId}`;
  }

  if (t === "bot_activation") {
    const amt = meta.amount != null ? `$${fmt(meta.amount)} USD` : "";
    const name = meta.botName ? ` ${meta.botName}` : " AI Bot";
    const daily = meta.dailyReturn != null ? ` earning $${fmt(meta.dailyReturn)}/day (${meta.dailyPct || 0}%)` : "";
    const refId = meta.reference ? ` Ref: ${String(meta.reference).slice(0, 16)}.` : "";
    return `You have successfully activated${name} for ${amt}.${daily} The investment amount has been deducted from your wallet balance.${refId}`;
  }

  if (t === "bot_reward") {
    const amt = meta.amount != null ? `$${fmt(meta.amount)} ${meta.currency || "USD"}` : "";
    const name = meta.botName ? ` from your ${meta.botName} bot` : "";
    const refId = meta.reference ? ` Ref: ${String(meta.reference).slice(0, 16)}.` : "";
    return `You received a daily mining yield of ${amt}${name}.${refId} The amount has been credited to your wallet balance.`;
  }

  return n.message;
}

/** Placeholder skeleton card displayed while loading data */
function NotificationSkeleton() {
  return (
    <div
      className="neu-card"
      style={{
        padding: "16px 18px",
        borderRadius: 16,
        border: "1px solid var(--stroke)",
        background: "var(--bg1, #1e293b)",
      }}
    >
      <div className="row" style={{ gap: 14, alignItems: "flex-start" }}>
        {/* Pulsing icon skeleton */}
        <div
          className="skeleton-pulse"
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            flexShrink: 0,
            background: "rgba(255, 255, 255, 0.08)",
          }}
        />
        {/* Pulsing content lines */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Title skeleton */}
          <div
            className="skeleton-pulse"
            style={{
              width: "40%",
              height: 16,
              borderRadius: 6,
              background: "rgba(255, 255, 255, 0.09)",
            }}
          />
          {/* One-paragraph message skeletons */}
          <div
            className="skeleton-pulse"
            style={{
              width: "95%",
              height: 13,
              borderRadius: 5,
              background: "rgba(255, 255, 255, 0.07)",
            }}
          />
          <div
            className="skeleton-pulse"
            style={{
              width: "75%",
              height: 13,
              borderRadius: 5,
              background: "rgba(255, 255, 255, 0.07)",
            }}
          />
          {/* Date skeleton */}
          <div
            className="skeleton-pulse"
            style={{
              width: "25%",
              height: 11,
              borderRadius: 4,
              marginTop: 2,
              background: "rgba(255, 255, 255, 0.06)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function Notifications() {
  const { user } = useAuth();
  const [globalNotifs, setGlobalNotifs] = useState<AppNotification[]>([]);
  const [personalNotifs, setPersonalNotifs] = useState<AppNotification[]>([]);
  const [reads, setReads] = useState<Record<string, boolean>>({});
  const [loadingGlobal, setLoadingGlobal] = useState(true);
  const [loadingPersonal, setLoadingPersonal] = useState(true);

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
      setLoadingGlobal(false);
    });
  }, []);

  // Personal per-user notifications (from admin actions)
  useEffect(() => {
    if (!user) {
      setLoadingPersonal(false);
      return;
    }
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
      setLoadingPersonal(false);
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

  const isLoading = loadingGlobal || loadingPersonal;
  const unreadCount = notifications.filter((n) => n.id && !reads[n.id]).length;

  return (
    <Shell>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Notifications</h1>
        {!isLoading && unreadCount > 0 && (
          <button className="neu-btn btn-ghost" onClick={() => void markAllAsRead()}>
            Mark all as read
          </button>
        )}
      </div>

      <div className="grid" style={{ gap: 12 }}>
        {/* Loading skeleton state */}
        {isLoading && (
          <>
            <NotificationSkeleton />
            <NotificationSkeleton />
            <NotificationSkeleton />
            <NotificationSkeleton />
          </>
        )}

        {/* Loaded notifications */}
        {!isLoading &&
          notifications.map((n) => {
            const isUnread = n.id && !reads[n.id];
            const typeIcon =
              n.type === "deposit_approved" ? "✅" :
              n.type === "deposit_rejected" ? "❌" :
              n.type === "commission" ? "💰" :
              n.type === "withdrawal_approved" ? "💸" :
              n.type === "withdrawal_rejected" ? "🚫" :
              n.type === "balance_adjustment" ? "💵" :
              n.type === "bot_activation" ? "🤖" :
              n.type === "bot_reward" ? "⚡" :
              n.type === "broadcast" ? "📢" : "🔔";

            const iconBg =
              n.type === "deposit_approved" ? "rgba(0,166,81,0.15)" :
              n.type === "deposit_rejected" ? "rgba(239,68,68,0.15)" :
              n.type === "commission" ? "rgba(234,179,8,0.15)" :
              n.type === "withdrawal_approved" ? "rgba(56,189,248,0.15)" :
              n.type === "withdrawal_rejected" ? "rgba(239,68,68,0.15)" :
              n.type === "balance_adjustment" ? "rgba(16,185,129,0.15)" :
              n.type === "bot_activation" ? "rgba(168,85,247,0.15)" :
              n.type === "bot_reward" ? "rgba(16,185,129,0.15)" :
              "rgba(99,102,241,0.15)";

            const paragraphMessage = getNotificationParagraph(n);

            return (
              <div
                key={n.id}
                className="neu-card"
                style={{
                  cursor: isUnread ? "pointer" : "default",
                  borderColor: isUnread ? "var(--accent)" : "var(--stroke)",
                  background: isUnread ? "rgba(56, 189, 248, 0.04)" : undefined,
                  transition: "all 0.2s ease",
                }}
                onClick={() => {
                  if (isUnread && n.id) {
                    void markAsRead(n.id);
                  }
                }}
              >
                <div className="card-body">
                  <div className="row" style={{ gap: 14, alignItems: "flex-start" }}>
                    {/* Icon or image */}
                    {n.imageUrl ? (
                      <img
                        src={n.imageUrl}
                        alt=""
                        style={{ width: 48, height: 48, borderRadius: 12, objectFit: "cover", flexShrink: 0 }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 12,
                          flexShrink: 0,
                          background: iconBg,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 24,
                        }}
                      >
                        {typeIcon}
                      </div>
                    )}

                    {/* Content: Title, single paragraph message, and timestamp */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: isUnread ? "var(--text)" : "var(--muted)" }}>
                          {n.title}
                        </div>
                        {isUnread && (
                          <div
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: "var(--accent)",
                              boxShadow: "0 0 6px var(--accent)",
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </div>

                      {/* Unified single-paragraph details */}
                      <p
                        style={{
                          margin: "0 0 6px 0",
                          color: "var(--text)",
                          fontSize: 13.5,
                          lineHeight: 1.55,
                          opacity: isUnread ? 1 : 0.85,
                        }}
                      >
                        {paragraphMessage}
                      </p>

                      <div style={{ fontSize: 11.5, color: "var(--muted)", opacity: 0.7 }}>
                        {new Date(n.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

        {/* Empty state */}
        {!isLoading && !notifications.length && (
          <div className="neu-card">
            <div className="card-body" style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>📭</div>
              <h3 style={{ margin: "0 0 8px" }}>No notifications</h3>
              <p className="muted" style={{ margin: 0 }}>You're all caught up!</p>
            </div>
          </div>
        )}
      </div>

      {/* Shimmer pulse animation for skeletons */}
      <style>{`
        @keyframes skeletonShimmer {
          0% {
            opacity: 0.35;
          }
          50% {
            opacity: 0.85;
          }
          100% {
            opacity: 0.35;
          }
        }
        .skeleton-pulse {
          animation: skeletonShimmer 1.4s ease-in-out infinite;
        }
      `}</style>
    </Shell>
  );
}
