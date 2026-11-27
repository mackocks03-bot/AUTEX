import { useEffect, useState, useMemo } from "react";
import { onValue, ref, update, get } from "firebase/database";
import { db } from "@/firebase";

interface UserRecord {
  uid: string;
  phone: string;
  displayName?: string;
  email?: string;
  role?: string;
  balance?: number;
  isActive?: boolean;
  createdAt?: number;
  referredBy?: string;
  affiliateCode?: string;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function timeAgo(ts?: number): string {
  if (!ts) return "Unknown";
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function AdminUserAccess() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [processingUid, setProcessingUid] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [confirmBulk, setConfirmBulk] = useState<{ action: "activate" | "deactivate"; count: number } | null>(null);

  const showToast = (text: string, type: "ok" | "err" = "ok") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const r = ref(db, "users");
    return onValue(r, (snap) => {
      if (!snap.exists()) {
        setUsers([]);
        setLoading(false);
        return;
      }
      const list: UserRecord[] = [];
      snap.forEach((child) => {
        const v = child.val();
        if (v && typeof v === "object" && v.role !== "admin") {
          list.push({
            uid: child.key!,
            phone: String(v.phone || ""),
            displayName: v.displayName || v.phone || "",
            email: v.email || "",
            role: v.role || "user",
            balance: Number(v.balance || 0),
            isActive: v.isActive !== false, // default to active if not set
            createdAt: v.createdAt,
            referredBy: v.referredBy || "",
            affiliateCode: v.affiliateCode || "",
          });
        }
      });
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setUsers(list);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && u.isActive !== false) ||
        (filterStatus === "inactive" && u.isActive === false);
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        u.phone.toLowerCase().includes(q) ||
        (u.displayName || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [users, search, filterStatus]);

  const activeCount = users.filter((u) => u.isActive !== false).length;
  const inactiveCount = users.filter((u) => u.isActive === false).length;

  async function toggleUser(uid: string, currentlyActive: boolean) {
    setProcessingUid(uid);
    try {
      const newState = !currentlyActive;
      await update(ref(db, `users/${uid}`), {
        isActive: newState,
        statusUpdatedAt: Date.now(),
      });
      showToast(
        newState
          ? "✅ Account activated successfully."
          : "🔒 Account deactivated. User cannot withdraw until re-activated.",
        "ok"
      );
    } catch (err: any) {
      showToast(err?.message || "Failed to update user status.", "err");
    } finally {
      setProcessingUid(null);
    }
  }

  async function handleBulkAction(action: "activate" | "deactivate") {
    const targets = filtered.filter((u) =>
      action === "activate" ? u.isActive === false : u.isActive !== false
    );
    if (targets.length === 0) {
      showToast(`No users to ${action} in current view.`, "err");
      return;
    }
    setConfirmBulk({ action, count: targets.length });
  }

  async function confirmBulkAction() {
    if (!confirmBulk) return;
    setConfirmBulk(null);
    setBulkProcessing(true);
    const { action } = confirmBulk;
    const newState = action === "activate";
    const targets = filtered.filter((u) =>
      action === "activate" ? u.isActive === false : u.isActive !== false
    );
    try {
      await Promise.all(
        targets.map((u) =>
          update(ref(db, `users/${u.uid}`), {
            isActive: newState,
            statusUpdatedAt: Date.now(),
          })
        )
      );
      showToast(
        `${targets.length} account(s) ${newState ? "activated" : "deactivated"} successfully.`,
        "ok"
      );
    } catch (err: any) {
      showToast(err?.message || "Bulk action failed.", "err");
    } finally {
      setBulkProcessing(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 60 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "3px solid var(--stroke)",
            borderTopColor: "var(--accent)",
            animation: "spin 0.8s linear infinite",
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            padding: "13px 22px",
            borderRadius: 14,
            background:
              toast.type === "ok"
                ? "linear-gradient(135deg, #00a651, #007a3c)"
                : "#ef4444",
            color: "#fff",
            fontWeight: 800,
            fontSize: 13.5,
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            animation: "fadeIn 0.2s ease",
            whiteSpace: "nowrap",
          }}
        >
          {toast.text}
        </div>
      )}

      {/* Bulk Confirm Dialog */}
      {confirmBulk && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9998,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              background: "var(--bg1)",
              borderRadius: 24,
              padding: "32px 28px",
              maxWidth: 400,
              width: "100%",
              boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
              border: "1px solid var(--stroke)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>
              {confirmBulk.action === "activate" ? "✅" : "🔒"}
            </div>
            <h3 style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 900, color: "var(--text)" }}>
              {confirmBulk.action === "activate" ? "Activate" : "Deactivate"} {confirmBulk.count} Account(s)?
            </h3>
            <p style={{ margin: "0 0 24px", fontSize: 13.5, color: "var(--muted)", lineHeight: 1.6 }}>
              {confirmBulk.action === "deactivate"
                ? "Selected users will not be able to submit withdrawal requests until reactivated."
                : "Selected accounts will be restored to active status and regain full withdrawal access."}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                onClick={() => setConfirmBulk(null)}
                style={{
                  padding: "11px 22px",
                  borderRadius: 12,
                  border: "1px solid var(--stroke)",
                  background: "var(--bg2)",
                  color: "var(--text)",
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmBulkAction()}
                style={{
                  padding: "11px 22px",
                  borderRadius: 12,
                  border: "none",
                  background:
                    confirmBulk.action === "activate"
                      ? "linear-gradient(135deg, #00a651, #007a3c)"
                      : "linear-gradient(135deg, #ef4444, #b91c1c)",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 13.5,
                  cursor: "pointer",
                }}
              >
                Confirm {confirmBulk.action === "activate" ? "Activate" : "Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {[
          { label: "Total Users", value: users.length, icon: "👥", color: "#3b82f6" },
          { label: "Active", value: activeCount, icon: "✅", color: "#00a651" },
          { label: "Deactivated", value: inactiveCount, icon: "🔒", color: "#ef4444" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="neu-card"
            style={{ flex: "1 1 140px", borderRadius: 16 }}
          >
            <div
              className="card-body"
              style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}
            >
              <span style={{ fontSize: 24 }}>{stat.icon}</span>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, color: stat.color, lineHeight: 1 }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{stat.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div
        className="neu-card"
        style={{ borderRadius: 18 }}
      >
        <div className="card-body">
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            {/* Search */}
            <div style={{ flex: "1 1 220px", position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--muted)",
                  fontSize: 15,
                  pointerEvents: "none",
                }}
              >
                🔍
              </span>
              <input
                type="text"
                className="input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by phone, name, email…"
                style={{ width: "100%", paddingLeft: 36, paddingRight: 12, height: 40 }}
              />
            </div>

            {/* Status Filter */}
            <div style={{ display: "flex", gap: 6 }}>
              {(["all", "active", "inactive"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterStatus(f)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    border: "1px solid var(--stroke)",
                    background:
                      filterStatus === f
                        ? f === "inactive"
                          ? "rgba(239,68,68,0.15)"
                          : "rgba(0,166,81,0.12)"
                        : "var(--bg2)",
                    color:
                      filterStatus === f
                        ? f === "inactive"
                          ? "#ef4444"
                          : "#00a651"
                        : "var(--muted)",
                    fontWeight: filterStatus === f ? 800 : 600,
                    fontSize: 12.5,
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {f === "all" ? `All (${users.length})` : f === "active" ? `Active (${activeCount})` : `Deactivated (${inactiveCount})`}
                </button>
              ))}
            </div>

            {/* Bulk Actions */}
            <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
              <button
                onClick={() => void handleBulkAction("activate")}
                disabled={bulkProcessing}
                title="Activate all filtered deactivated users"
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,166,81,0.3)",
                  background: "rgba(0,166,81,0.1)",
                  color: "#00a651",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                ✅ Activate All
              </button>
              <button
                onClick={() => void handleBulkAction("deactivate")}
                disabled={bulkProcessing}
                title="Deactivate all filtered active users"
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(239,68,68,0.3)",
                  background: "rgba(239,68,68,0.08)",
                  color: "#ef4444",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                🔒 Deactivate All
              </button>
            </div>
          </div>

          {/* Results count */}
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
            Showing {filtered.length} of {users.length} users
          </div>

          {/* Users Table / Cards */}
          {filtered.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "48px 20px",
                color: "var(--muted)",
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>No users match your filters</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map((u) => {
                const isActive = u.isActive !== false;
                const isProcessing = processingUid === u.uid;
                return (
                  <div
                    key={u.uid}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 16px",
                      borderRadius: 14,
                      background: isActive
                        ? "var(--bg2)"
                        : "rgba(239,68,68,0.04)",
                      border: `1px solid ${
                        isActive
                          ? "var(--stroke)"
                          : "rgba(239,68,68,0.2)"
                      }`,
                      transition: "all 0.2s ease",
                      flexWrap: "wrap",
                    }}
                  >
                    {/* Avatar + Status dot */}
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: "50%",
                          background: isActive
                            ? "linear-gradient(135deg, #00a651, #007a3c)"
                            : "linear-gradient(135deg, #94a3b8, #64748b)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontWeight: 900,
                          fontSize: 16,
                        }}
                      >
                        {(u.displayName || u.phone || "?")[0].toUpperCase()}
                      </div>
                      <span
                        style={{
                          position: "absolute",
                          bottom: 1,
                          right: 1,
                          width: 11,
                          height: 11,
                          borderRadius: "50%",
                          background: isActive ? "#25D366" : "#ef4444",
                          border: "2px solid var(--bg1)",
                          boxShadow: `0 0 6px ${isActive ? "#25D366" : "#ef4444"}`,
                        }}
                      />
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: 14,
                          color: "var(--text)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {u.displayName || u.phone}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                        {u.phone}
                        {u.email && ` · ${u.email}`}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>
                        Bal: <strong style={{ color: "var(--text)" }}>${fmt(u.balance || 0)}</strong>
                        &nbsp;·&nbsp;Joined {timeAgo(u.createdAt)}
                        &nbsp;·&nbsp;
                        <span
                          style={{
                            fontWeight: 800,
                            color: isActive ? "#00a651" : "#ef4444",
                            textTransform: "uppercase",
                            fontSize: 10,
                          }}
                        >
                          {isActive ? "● Active" : "○ Deactivated"}
                        </span>
                      </div>
                    </div>

                    {/* Toggle Button */}
                    <button
                      onClick={() => void toggleUser(u.uid, isActive)}
                      disabled={isProcessing}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 10,
                        border: "none",
                        background: isActive
                          ? "linear-gradient(135deg, #ef4444, #b91c1c)"
                          : "linear-gradient(135deg, #00a651, #007a3c)",
                        color: "#fff",
                        fontWeight: 800,
                        fontSize: 12.5,
                        cursor: isProcessing ? "not-allowed" : "pointer",
                        opacity: isProcessing ? 0.6 : 1,
                        minWidth: 100,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 5,
                        boxShadow: isActive
                          ? "0 4px 12px rgba(239,68,68,0.3)"
                          : "0 4px 12px rgba(0,166,81,0.3)",
                        flexShrink: 0,
                      }}
                    >
                      {isProcessing ? (
                        <span
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: "50%",
                            border: "2px solid rgba(255,255,255,0.4)",
                            borderTopColor: "#fff",
                            animation: "spin 0.75s linear infinite",
                            display: "inline-block",
                          }}
                        />
                      ) : isActive ? (
                        <>🔒 Deactivate</>
                      ) : (
                        <>✅ Activate</>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="neu-card" style={{ borderRadius: 18 }}>
        <div className="card-body">
          <h4 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 800, color: "var(--text)" }}>
            How Account Activation Works
          </h4>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--muted)", lineHeight: 1.9 }}>
            <li>
              <strong>Active</strong> accounts have full access to withdrawals and all platform features.
            </li>
            <li>
              <strong>Deactivated</strong> accounts cannot submit any withdrawal request. The withdrawal page shows a
              payment gate requiring the user to pay <strong>25% of their total deposited amount</strong> to
              reactivate.
            </li>
            <li>The system automatically calculates the required amount and shows users a copy button and deposit redirect.</li>
            <li>Once a deactivated user deposits the required 25%, their account can be manually reactivated here.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
