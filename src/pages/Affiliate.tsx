import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ref, onValue, set, get } from "firebase/database";
import { db } from "@/firebase";
import { useAuth } from "@/context/AuthContext";
import { Shell } from "@/components/Shell";

interface ReferralItem {
  uid: string;
  displayName?: string;
  createdAt?: number;
  status?: string;
}

export default function Affiliate() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [affiliateCode, setAffiliateCode] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<ReferralItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    async function loadAffiliateData() {
      try {
        // 1. Get or create user's affiliate code
        const userRef = ref(db, `users/${user!.uid}`);
        const snap = await get(userRef);

        let code = "";
        if (snap.exists() && snap.val().affiliateCode) {
          code = snap.val().affiliateCode;
        } else {
          code = Math.random().toString(36).substring(2, 8).toUpperCase();
          await set(ref(db, `users/${user!.uid}/affiliateCode`), code);
        }

        setAffiliateCode(code);

        // 2. Listen for referrals
        const refCountRef = ref(db, `referrals/${code}`);
        const unsub = onValue(refCountRef, (rSnap) => {
          if (rSnap.exists()) {
            const data = rSnap.val();
            const list: ReferralItem[] = Object.entries(data).map(([uid, val]: [string, any]) => ({
              uid,
              ...val,
            }));
            list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setReferrals(list);
          } else {
            setReferrals([]);
          }
          setLoading(false);
        });

        return () => unsub();
      } catch (err) {
        console.error("Error loading affiliate data", err);
        setLoading(false);
      }
    }

    loadAffiliateData();
  }, [user]);

  const referralLink = affiliateCode ? `${window.location.origin}/register?ref=${affiliateCode}` : "";

  const copyLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyCode = () => {
    if (!affiliateCode) return;
    navigator.clipboard.writeText(affiliateCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const shareWhatsApp = () => {
    if (!affiliateCode) return;
    const text = encodeURIComponent(
      `Join AUTEX AI Crypto platform using my referral code *${affiliateCode}* and start earning today! Register here: ${referralLink}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

  const shareTelegram = () => {
    if (!affiliateCode) return;
    const text = encodeURIComponent(
      `Join AUTEX AI Crypto platform with my referral code ${affiliateCode}! Sign up here:`
    );
    window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${text}`, "_blank");
  };

  const shareTwitter = () => {
    if (!affiliateCode) return;
    const text = encodeURIComponent(
      `Join AUTEX AI Crypto platform using referral code ${affiliateCode}! Trade & earn with top rewards: ${referralLink}`
    );
    window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
  };

  // Commission calculation
  const refCount = referrals.length;
  const commissionRate = refCount >= 16 ? 20 : refCount >= 6 ? 15 : 10;
  const currentTier = refCount >= 16 ? "Gold VIP" : refCount >= 6 ? "Silver Partner" : "Bronze Partner";

  if (!user) {
    return (
      <Shell>
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "rgba(240,185,11,0.12)",
              color: "#d97706",
              margin: "0 auto 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 12 20 22 4 22 4 12" />
              <rect x="2" y="7" width="20" height="5" />
              <line x1="12" y1="22" x2="12" y2="7" />
              <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
              <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
            </svg>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", margin: "0 0 8px" }}>Sign In to View Referral Program</h2>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 20px" }}>Invite friends and earn up to 20% commission on trading fees and platform activities.</p>
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

  return (
    <Shell>
      {/* ── 1. Binance Style Hero Banner ── */}
      <div
        style={{
          borderRadius: 22,
          background: "linear-gradient(135deg, #181a20 0%, #1e2329 100%)",
          border: "1px solid rgba(240,185,11,0.3)",
          boxShadow: "0 12px 36px rgba(0,0,0,0.25), 0 0 20px rgba(240,185,11,0.12)",
          padding: "22px 20px 18px",
          marginBottom: 18,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Ambient gold glow */}
        <div
          style={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 150,
            height: 150,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(240,185,11,0.22) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              background: "#f0b90b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#000",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#f0b90b", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Referral & Affiliate
          </span>
        </div>

        <h1 style={{ fontSize: "clamp(18px, 4.5vw, 22px)", fontWeight: 900, color: "#ffffff", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
          Invite Friends. Earn Crypto Together.
        </h1>
        <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.75)", margin: "0 0 16px", lineHeight: 1.5, maxWidth: 360 }}>
          Earn up to <strong style={{ color: "#f0b90b" }}>20% commission</strong> on every transaction made by your invited friends.
        </p>

        {/* 3 Metric Chips */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8,
            paddingTop: 14,
            borderTop: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 700, textTransform: "uppercase" }}>Invited Friends</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#ffffff", marginTop: 2 }}>{refCount}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 700, textTransform: "uppercase" }}>Commission Rate</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#0ecb81", marginTop: 2 }}>{commissionRate}%</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 700, textTransform: "uppercase" }}>Partner Tier</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#f0b90b", marginTop: 6, whiteSpace: "nowrap" }}>{currentTier}</div>
          </div>
        </div>
      </div>

      {/* ── 2. My Referral Link & Code ── */}
      <div
        style={{
          borderRadius: 20,
          background: "var(--bg1)",
          border: "1px solid rgba(255,255,255,0.6)",
          boxShadow: "-6px -6px 14px rgba(255,255,255,0.9), 6px 6px 14px rgba(163,177,198,0.4)",
          padding: "18px 16px",
          marginBottom: 18,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
          Your Invitation Details
        </div>

        {/* Referral Code Row */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>Referral Code</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--bg2)",
              border: "1.5px solid var(--stroke)",
              borderRadius: 12,
              padding: "10px 14px",
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 900, color: "var(--text)", fontFamily: "monospace", letterSpacing: "0.08em" }}>
              {affiliateCode || "••••••"}
            </span>
            <button
              type="button"
              onClick={copyCode}
              style={{
                border: "none",
                background: copiedCode ? "rgba(14,203,129,0.15)" : "rgba(240,185,11,0.15)",
                color: copiedCode ? "#0ecb81" : "#d97706",
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                transition: "all 0.15s",
              }}
            >
              {copiedCode ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy Code
                </>
              )}
            </button>
          </div>
        </div>

        {/* Referral Link Row */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>Referral Link</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "var(--bg2)",
              border: "1.5px solid var(--stroke)",
              borderRadius: 12,
              padding: "6px 6px 6px 12px",
              gap: 8,
            }}
          >
            <span
              style={{
                flex: 1,
                fontSize: 11.5,
                fontWeight: 600,
                color: "var(--text)",
                fontFamily: "monospace",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {referralLink || "Loading link…"}
            </span>
            <button
              type="button"
              onClick={copyLink}
              style={{
                border: "none",
                background: copiedLink ? "#0ecb81" : "var(--accent)",
                color: "#ffffff",
                padding: "8px 16px",
                borderRadius: 9,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                flexShrink: 0,
                boxShadow: "0 3px 10px rgba(0,166,81,0.25)",
                transition: "all 0.15s",
              }}
            >
              {copiedLink ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy Link
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Social Share Buttons */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>Quick Share:</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <button
              type="button"
              onClick={shareWhatsApp}
              style={{
                padding: "9px 8px",
                borderRadius: 10,
                border: "1.5px solid rgba(37,211,102,0.3)",
                background: "rgba(37,211,102,0.08)",
                color: "#16a34a",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              WhatsApp
            </button>

            <button
              type="button"
              onClick={shareTelegram}
              style={{
                padding: "9px 8px",
                borderRadius: 10,
                border: "1.5px solid rgba(0,136,204,0.3)",
                background: "rgba(0,136,204,0.08)",
                color: "#0284c7",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              Telegram
            </button>

            <button
              type="button"
              onClick={shareTwitter}
              style={{
                padding: "9px 8px",
                borderRadius: 10,
                border: "1.5px solid rgba(0,0,0,0.15)",
                background: "rgba(0,0,0,0.04)",
                color: "var(--text)",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />
              </svg>
              Twitter / X
            </button>
          </div>
        </div>
      </div>

      {/* ── 3. How It Works (Binance 3-Step Flow) ── */}
      <div
        style={{
          borderRadius: 20,
          background: "var(--bg1)",
          border: "1px solid rgba(255,255,255,0.6)",
          boxShadow: "-4px -4px 12px rgba(255,255,255,0.9), 4px 4px 12px rgba(163,177,198,0.4)",
          padding: "18px 16px",
          marginBottom: 18,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>
          How To Earn in 3 Steps
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
          {/* Step 1 */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "rgba(240,185,11,0.15)",
                color: "#d97706",
                fontWeight: 900,
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              1
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>Share Your Link</div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2, lineHeight: 1.4 }}>
                Send your invitation link or code to friends via WhatsApp, Telegram, or social media.
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "rgba(37,99,235,0.15)",
                color: "#2563eb",
                fontWeight: 900,
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              2
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>Friends Register & Trade</div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2, lineHeight: 1.4 }}>
                Your friends sign up using your link and perform deposits or transactions.
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "rgba(14,203,129,0.15)",
                color: "#0ecb81",
                fontWeight: 900,
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              3
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>Earn Instant Commission</div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2, lineHeight: 1.4 }}>
                Receive up to 20% commission directly in your wallet balance automatically.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Tiered Commission Levels ── */}
      <div
        style={{
          borderRadius: 20,
          background: "var(--bg1)",
          border: "1px solid rgba(255,255,255,0.6)",
          boxShadow: "-4px -4px 12px rgba(255,255,255,0.9), 4px 4px 12px rgba(163,177,198,0.4)",
          padding: "18px 16px",
          marginBottom: 18,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
          Commission Tiers
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center" }}>
          {/* Bronze */}
          <div
            style={{
              padding: "12px 6px",
              borderRadius: 14,
              border: `1.5px solid ${currentTier === "Bronze Partner" ? "#00a651" : "var(--stroke)"}`,
              background: currentTier === "Bronze Partner" ? "rgba(0,166,81,0.06)" : "var(--bg2)",
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Bronze</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "var(--text)", margin: "4px 0" }}>10%</div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>1–5 Friends</div>
          </div>

          {/* Silver */}
          <div
            style={{
              padding: "12px 6px",
              borderRadius: 14,
              border: `1.5px solid ${currentTier === "Silver Partner" ? "#00a651" : "var(--stroke)"}`,
              background: currentTier === "Silver Partner" ? "rgba(0,166,81,0.06)" : "var(--bg2)",
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Silver</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "var(--text)", margin: "4px 0" }}>15%</div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>6–15 Friends</div>
          </div>

          {/* Gold VIP */}
          <div
            style={{
              padding: "12px 6px",
              borderRadius: 14,
              border: `1.5px solid ${currentTier === "Gold VIP" ? "#d97706" : "var(--stroke)"}`,
              background: currentTier === "Gold VIP" ? "rgba(240,185,11,0.1)" : "var(--bg2)",
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: "#d97706", textTransform: "uppercase" }}>Gold VIP</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#d97706", margin: "4px 0" }}>20%</div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>16+ Friends</div>
          </div>
        </div>
      </div>

      {/* ── 5. Referral Friends List ── */}
      <div
        style={{
          borderRadius: 20,
          background: "var(--bg1)",
          border: "1px solid rgba(255,255,255,0.6)",
          boxShadow: "-4px -4px 12px rgba(255,255,255,0.9), 4px 4px 12px rgba(163,177,198,0.4)",
          padding: "18px 16px",
          marginBottom: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Referred Users ({referrals.length})
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)" }}>Level 1 Friends</span>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "var(--muted)", fontSize: 12.5 }}>Loading referral records…</div>
        ) : referrals.length === 0 ? (
          <div style={{ textAlign: "center", padding: "28px 16px", background: "rgba(0,0,0,0.02)", borderRadius: 12, border: "1px solid var(--stroke)" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "var(--bg2)",
                margin: "0 auto 10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--muted)",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div style={{ fontWeight: 800, fontSize: 13, color: "var(--text)", marginBottom: 4 }}>No referrals yet</div>
            <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "0 0 14px", lineHeight: 1.4 }}>
              Share your link with your network to start earning instant commissions.
            </p>
            <button
              type="button"
              onClick={copyLink}
              style={{
                padding: "8px 18px",
                borderRadius: 999,
                border: "none",
                background: "var(--accent)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Invite Friends Now
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {referrals.map((r, i) => (
              <div
                key={r.uid || i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "var(--bg2)",
                  border: "1px solid var(--stroke)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #00a651 0%, #008040 100%)",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {(r.displayName || "U").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: "var(--text)" }}>{r.displayName || "Trader"}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "Active Member"}
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    padding: "3px 8px",
                    borderRadius: 999,
                    background: "rgba(14,203,129,0.12)",
                    color: "#0ecb81",
                    fontSize: 10.5,
                    fontWeight: 800,
                  }}
                >
                  Active
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 6. Bottom Navigation Shortcuts ── */}
      <div
        style={{
          textAlign: "center",
          paddingTop: 12,
          borderTop: "1px solid var(--stroke)",
          display: "flex",
          justifyContent: "center",
          gap: 20,
          marginBottom: 10,
        }}
      >
        <Link to="/account" style={{ fontSize: 12, color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}>
          ← My Account
        </Link>
        <Link to="/deposit" style={{ fontSize: 12, color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}>
          Deposit Funds →
        </Link>
      </div>
    </Shell>
  );
}
