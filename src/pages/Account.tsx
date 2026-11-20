import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ref, onValue, update } from "firebase/database";
import { db } from "@/firebase";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/context/AuthContext";

export default function Account() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  // Profile data
  const [balance, setBalance] = useState<number | null>(null);
  const [hideBalance, setHideBalance] = useState<boolean>(() => {
    return localStorage.getItem("binance_hide_balance") === "true";
  });
  const [copiedUid, setCopiedUid] = useState(false);
  const [following, setFollowing] = useState<string[]>([]);
  const [activeBotCount, setActiveBotCount] = useState<number>(0);
  const [affiliateCode, setAffiliateCode] = useState<string | null>(null);

  // Toggle hide balance
  const toggleHideBalance = () => {
    setHideBalance((prev) => {
      const next = !prev;
      localStorage.setItem("binance_hide_balance", String(next));
      return next;
    });
  };

  // Copy UID
  const handleCopyUid = () => {
    if (!user) return;
    navigator.clipboard.writeText(user.uid);
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  // Real-time Balance & Data Sync
  useEffect(() => {
    if (!user) return;

    // Load following
    const followRef = ref(db, `userFollowing/${user.uid}`);
    const followSub = onValue(followRef, (snap) => {
      const data = snap.val() as Record<string, boolean> | null;
      setFollowing(data ? Object.keys(data).filter((k) => data[k]) : []);
    });

    // Load active bots count
    const botsRef = ref(db, `userBots/${user.uid}`);
    const botsSub = onValue(botsRef, (snap) => {
      setActiveBotCount(snap.exists() ? Object.keys(snap.val() || {}).length : 0);
    });

    // Load affiliate code
    const userRef = ref(db, `users/${user.uid}/affiliateCode`);
    const affSub = onValue(userRef, (snap) => {
      if (snap.exists()) {
        setAffiliateCode(String(snap.val()));
      }
    });

    // Live balance from payments minus withdrawals
    const pRef = ref(db, `userPayments/${user.uid}`);
    const wRef = ref(db, `withdrawRequests/${user.uid}`);

    let totalDeposits = 0;
    let totalWithdraws = 0;

    const unsubP = onValue(pRef, (snap) => {
      totalDeposits = 0;
      if (snap.exists()) {
        snap.forEach((child) => {
          const v = child.val();
          const s = String(v.status || "").toLowerCase();
          if (["completed", "success", "paid"].includes(s)) {
            totalDeposits += Number(v.amount) || 0;
          }
        });
      }
      const bal = Math.max(0, totalDeposits - totalWithdraws);
      setBalance(bal);
      update(ref(db, `users/${user.uid}`), { balance: bal }).catch(() => {});
    });

    const unsubW = onValue(wRef, (snap) => {
      totalWithdraws = 0;
      if (snap.exists()) {
        snap.forEach((child) => {
          const v = child.val();
          const s = String(v.status || "").toLowerCase();
          if (!["failed", "rejected", "cancelled"].includes(s)) {
            totalWithdraws += Number(v.amount) || 0;
          }
        });
      }
      const bal = Math.max(0, totalDeposits - totalWithdraws);
      setBalance(bal);
      update(ref(db, `users/${user.uid}`), { balance: bal }).catch(() => {});
    });

    return () => {
      followSub();
      botsSub();
      affSub();
      unsubP();
      unsubW();
    };
  }, [user]);

  if (!user) {
    return (
      <Shell>
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "var(--bg2)",
              margin: "0 auto 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", margin: "0 0 8px" }}>Sign in to your account</h2>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 20px" }}>Access your crypto portfolio, transactions, and security settings.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button
              onClick={() => navigate("/login")}
              style={{
                padding: "10px 24px",
                borderRadius: 12,
                border: "none",
                background: "var(--accent)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Log In
            </button>
            <button
              onClick={() => navigate("/register")}
              style={{
                padding: "10px 24px",
                borderRadius: 12,
                border: "1.5px solid var(--stroke)",
                background: "transparent",
                color: "var(--text)",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Register
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  const displayName = user.displayName || user.email?.split("@")[0] || "AUTEX User";
  const displayPhone = user.email?.replace(/@.*$/, "") || user.email;

  return (
    <Shell>
      {/* ── 1. Binance Top Profile Card ── */}
      <div
        style={{
          borderRadius: 20,
          background: "var(--bg1)",
          border: "1px solid rgba(255,255,255,0.6)",
          boxShadow: "-6px -6px 14px rgba(255,255,255,0.9), 6px 6px 14px rgba(163,177,198,0.4)",
          padding: "18px 16px",
          marginBottom: 16,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          {/* Avatar with status ring */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #00a651 0%, #008040 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: 900,
                color: "#ffffff",
                boxShadow: "0 4px 14px rgba(0,166,81,0.35)",
              }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
            {/* Online / Verified check pip */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 17,
                height: 17,
                borderRadius: "50%",
                background: "#0ecb81",
                border: "2px solid #ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>

          {/* User Details */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
              <span
                style={{
                  fontWeight: 900,
                  fontSize: 16,
                  color: "var(--text)",
                  letterSpacing: "-0.01em",
                  maxWidth: 160,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {displayName}
              </span>
              {/* VIP / Role Badge */}
              <span
                style={{
                  padding: "2px 7px",
                  borderRadius: 6,
                  background: isAdmin ? "rgba(240,185,11,0.15)" : "rgba(0,166,81,0.12)",
                  color: isAdmin ? "#d97706" : "#00a651",
                  border: `1px solid ${isAdmin ? "rgba(240,185,11,0.35)" : "rgba(0,166,81,0.25)"}`,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.03em",
                }}
              >
                {isAdmin ? "ADMIN" : "REGULAR"}
              </span>
              <span
                style={{
                  padding: "2px 6px",
                  borderRadius: 6,
                  background: "rgba(14,203,129,0.12)",
                  color: "#0ecb81",
                  fontSize: 10,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Verified
              </span>
            </div>

            {/* UID + 1-Click Copy */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600 }}>UID:</span>
              <span style={{ fontSize: 11.5, color: "var(--text)", fontWeight: 700, fontFamily: "monospace" }}>
                {user.uid.slice(0, 10)}…
              </span>
              <button
                type="button"
                onClick={handleCopyUid}
                title="Copy UID"
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: "2px 4px",
                  display: "inline-flex",
                  alignItems: "center",
                  color: copiedUid ? "#0ecb81" : "var(--muted)",
                  transition: "color 0.15s",
                }}
              >
                {copiedUid ? (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#0ecb81" }}>Copied!</span>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Contact info strip */}
        <div
          style={{
            marginTop: 14,
            paddingTop: 11,
            borderTop: "1px solid var(--stroke)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 11.5,
          }}
        >
          <span style={{ color: "var(--muted)", fontWeight: 600 }}>Registered Account:</span>
          <span style={{ color: "var(--text)", fontWeight: 700 }}>{displayPhone}</span>
        </div>
      </div>

      {/* ── 2. Binance Estimated Balance / Total Assets Card ── */}
      <div
        style={{
          borderRadius: 20,
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
          color: "#ffffff",
          padding: "20px 18px 16px",
          marginBottom: 18,
          boxShadow: "0 10px 28px rgba(15,23,42,0.35)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Ambient glow flare */}
        <div
          style={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 140,
            height: 140,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0,166,81,0.25) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Label + Eye Icon */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Total Balance
          </span>
          <button
            type="button"
            onClick={toggleHideBalance}
            title={hideBalance ? "Show balance" : "Hide balance"}
            style={{
              border: "none",
              background: "transparent",
              color: "rgba(255,255,255,0.6)",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
            }}
          >
            {hideBalance ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>

        {/* Balance Display */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 28, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.02em" }}>
            {hideBalance ? "••••••" : balance !== null ? balance.toFixed(2) : "0.00"}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.75)" }}>USD</span>
        </div>

        {/* 24h PnL chip */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>Today's PnL:</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#0ecb81" }}>+$0.00 (+0.00%)</span>
        </div>

        {/* Quick Action Buttons (Deposit / Withdraw / History) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
          <Link
            to="/deposit"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "10px 8px",
              borderRadius: 12,
              background: "#00a651",
              color: "#ffffff",
              textDecoration: "none",
              fontSize: 12,
              fontWeight: 800,
              boxShadow: "0 4px 12px rgba(0,166,81,0.35)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
            Deposit
          </Link>

          <Link
            to="/withdraw"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "10px 8px",
              borderRadius: 12,
              background: "#2563eb",
              color: "#ffffff",
              textDecoration: "none",
              fontSize: 12,
              fontWeight: 800,
              boxShadow: "0 4px 12px rgba(37,99,235,0.35)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
            Withdraw
          </Link>

          <Link
            to="/payments"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "10px 8px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.1)",
              color: "#ffffff",
              textDecoration: "none",
              fontSize: 12,
              fontWeight: 700,
              border: "1px solid rgba(255,255,255,0.18)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            History
          </Link>
        </div>
      </div>

      {/* ── 3. Binance Shortcut Grid (Referral / Portfolio / Alerts / Support) ── */}
      <div
        style={{
          borderRadius: 18,
          background: "var(--bg1)",
          border: "1px solid rgba(255,255,255,0.6)",
          boxShadow: "-4px -4px 12px rgba(255,255,255,0.9), 4px 4px 12px rgba(163,177,198,0.4)",
          padding: "14px 10px",
          marginBottom: 16,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 6,
          textAlign: "center",
        }}
      >
        <Link to="/affiliate" style={{ textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: "rgba(240,185,11,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#d97706",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 12 20 22 4 22 4 12" />
              <rect x="2" y="7" width="20" height="5" />
              <line x1="12" y1="22" x2="12" y2="7" />
              <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
              <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
            </svg>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>Referral</span>
        </Link>

        <Link to="/bots" style={{ textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: "rgba(0,166,81,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#00a651",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              <circle cx="12" cy="16" r="1" fill="currentColor" />
            </svg>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>AI Bots</span>
        </Link>

        <Link to="/notifications" style={{ textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: "rgba(37,99,235,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#2563eb",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>Alerts</span>
        </Link>

        <Link to="/support" style={{ textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: "rgba(124,58,237,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#7c3aed",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
            </svg>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>Support</span>
        </Link>
      </div>

      {/* ── 4. Account Security & Verification Section ── */}
      <div
        style={{
          borderRadius: 18,
          background: "var(--bg1)",
          border: "1px solid rgba(255,255,255,0.6)",
          boxShadow: "-4px -4px 12px rgba(255,255,255,0.9), 4px 4px 12px rgba(163,177,198,0.4)",
          padding: "16px",
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
          Security & Verification
        </div>

        {/* Identity Verification Row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--stroke)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(14,203,129,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0ecb81" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <circle cx="9" cy="10" r="2" />
                <line x1="15" y1="8" x2="17" y2="8" />
                <line x1="15" y1="12" x2="17" y2="12" />
                <line x1="7" y1="16" x2="17" y2="16" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Identity Verification</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>Personal details verified</div>
            </div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#0ecb81", padding: "2px 8px", borderRadius: 999, background: "rgba(14,203,129,0.12)" }}>
            Verified
          </span>
        </div>

        {/* 2FA Security Level */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--stroke)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(0,166,81,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Security Level</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>Password & Phone Protection</div>
            </div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#00a651", padding: "2px 8px", borderRadius: 999, background: "rgba(0,166,81,0.12)" }}>
            Protected
          </span>
        </div>

        {/* Payment Methods */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(37,99,235,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563eb" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Payment Channels</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>Mobile Money & Crypto</div>
            </div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#2563eb", padding: "2px 8px", borderRadius: 999, background: "rgba(37,99,235,0.12)" }}>
            Active
          </span>
        </div>
      </div>

      {/* ── 5. Community & Affiliate Section ── */}
      <div
        style={{
          borderRadius: 18,
          background: "var(--bg1)",
          border: "1px solid rgba(255,255,255,0.6)",
          boxShadow: "-4px -4px 12px rgba(255,255,255,0.9), 4px 4px 12px rgba(163,177,198,0.4)",
          padding: "16px",
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
          Community & Rewards
        </div>

        {/* Affiliate row */}
        <Link
          to="/affiliate"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 0",
            borderBottom: "1px solid var(--stroke)",
            textDecoration: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(240,185,11,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#d97706" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="7" />
                <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Affiliate Program</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                {affiliateCode ? `Code: ${affiliateCode}` : "Invite friends & earn rewards"}
              </div>
            </div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>

        {/* My Active Bots */}
        <Link
          to="/my-bots"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 0",
            borderBottom: "1px solid var(--stroke)",
            textDecoration: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(0,166,81,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <circle cx="12" cy="5" r="2" />
                <path d="M12 7v4" />
                <line x1="8" y1="16" x2="8" y2="16" strokeWidth="3" strokeLinecap="round" />
                <line x1="16" y1="16" x2="16" y2="16" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>My Active Bots</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>{activeBotCount} active {activeBotCount === 1 ? "bot" : "bots"} · 1:00 PM mining</div>
            </div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>

        {/* Explore Trading Bots */}
        <Link
          to="/bots"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 0",
            textDecoration: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(56,189,248,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0284c7" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polygon points="10 8 16 12 10 16 10 8" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Explore Bots Fleet</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>13 autonomous tiers · 12% - 15% daily</div>
            </div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </div>

      {/* ── 6. Preferences (English fixed, USD fixed) ── */}
      <div
        style={{
          borderRadius: 18,
          background: "var(--bg1)",
          border: "1px solid rgba(255,255,255,0.6)",
          boxShadow: "-4px -4px 12px rgba(255,255,255,0.9), 4px 4px 12px rgba(163,177,198,0.4)",
          padding: "16px",
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
          Preferences
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--stroke)" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Language</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>English (US)</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--stroke)" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Base Currency</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>USD ($)</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Change Password</span>
          <Link to="/forgot-password" style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", textDecoration: "none" }}>
            Update →
          </Link>
        </div>
      </div>

      {/* ── 7. Admin Control Center Banner (Admin only) ── */}
      {isAdmin && (
        <div
          style={{
            borderRadius: 18,
            background: "linear-gradient(135deg, rgba(240,185,11,0.18), rgba(217,119,6,0.1))",
            border: "1.5px solid rgba(240,185,11,0.4)",
            padding: "16px",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "linear-gradient(135deg, #f0b90b, #d97706)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 4px 14px rgba(240,185,11,0.4)",
              }}
            >
              <span style={{ fontSize: 20 }}>👑</span>
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 14, color: "var(--text)" }}>
                Admin Control Center
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 1 }}>
                Full platform management · withdrawals · users · bots
              </div>
            </div>
          </div>

          {/* Quick module links for admin */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 10,
            }}
          >
            {[
              { label: "📊 Overview", tab: "overview" },
              { label: "💸 Withdrawals", tab: "withdrawals" },
              { label: "🤖 Fleet", tab: "bots" },
              { label: "👥 Users", tab: "users" },
            ].map(({ label, tab }) => (
              <Link
                key={tab}
                to={`/admin?tab=${tab}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "8px 10px",
                  borderRadius: 10,
                  background: "rgba(240,185,11,0.1)",
                  border: "1px solid rgba(240,185,11,0.3)",
                  color: "var(--text)",
                  fontSize: 12,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                {label}
              </Link>
            ))}
          </div>

          <Link
            to="/admin"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "11px",
              borderRadius: 11,
              background: "linear-gradient(135deg, #d97706, #b45309)",
              color: "#ffffff",
              fontWeight: 800,
              fontSize: 13,
              textDecoration: "none",
              boxShadow: "0 4px 14px rgba(217,119,6,0.4)",
            }}
          >
            <span>Open Admin Dashboard</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        </div>
      )}

      {/* ── 8. Binance Style Sign Out Button ── */}
      <button
        onClick={() => void logout()}
        style={{
          width: "100%",
          padding: "13px",
          borderRadius: 14,
          border: "1.5px solid rgba(246,70,93,0.3)",
          background: "rgba(246,70,93,0.06)",
          color: "#f6465d",
          fontSize: 13.5,
          fontWeight: 800,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
          marginBottom: 20,
          transition: "all 0.2s",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Log Out
      </button>

      <div style={{ textAlign: "center", fontSize: 11, color: "var(--muted)", paddingBottom: 10 }}>
        App Version 2.4.0 · Binance Engine Security
      </div>
    </Shell>
  );
}
