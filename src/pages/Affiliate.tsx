import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ref, onValue, set, get } from "firebase/database";
import { db } from "@/firebase";
import { useAuth } from "@/context/AuthContext";
import { Shell } from "@/components/Shell";

interface ReferralMember {
  uid: string;
  displayName?: string;
  phone?: string;
  createdAt?: number;
  status?: string;
  level?: number;
}

interface EarningRecord {
  key: string;
  amount: number;
  currency: string;
  level: number;
  percentage: number;
  fromPhone?: string;
  depositAmount?: number;
  createdAt: number;
}

export default function Affiliate() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [affiliateCode, setAffiliateCode] = useState<string | null>(null);
  const [level1, setLevel1] = useState<ReferralMember[]>([]);
  const [level2, setLevel2] = useState<ReferralMember[]>([]);
  const [level3, setLevel3] = useState<ReferralMember[]>([]);
  const [earnings, setEarnings] = useState<EarningRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeTab, setActiveTab] = useState<"l1" | "l2" | "l3" | "earnings">("l1");

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let unsubRefs: (() => void)[] = [];

    async function loadAffiliateData() {
      try {
        // 1. Get or create user's affiliate code & ensure index exists
        const userRef = ref(db, `users/${user!.uid}`);
        const userSnap = await get(userRef);

        let code = "";
        if (userSnap.exists() && userSnap.val().affiliateCode) {
          code = userSnap.val().affiliateCode;
        } else {
          code = Math.random().toString(36).substring(2, 8).toUpperCase();
          await set(ref(db, `users/${user!.uid}/affiliateCode`), code);
        }

        // Ensure reverse lookup index is synced
        await set(ref(db, `affiliateCodes/${code}`), user!.uid);
        setAffiliateCode(code);

        // 2. Listen for Level 1 Referrals (from userReferrals and legacy referrals)
        const l1Ref = ref(db, `userReferrals/${user!.uid}/level1`);
        const unsubL1 = onValue(l1Ref, (snap) => {
          const map: Record<string, ReferralMember> = {};
          if (snap.exists()) {
            const data = snap.val();
            Object.entries(data).forEach(([uId, val]: [string, any]) => {
              map[uId] = { uid: uId, level: 1, ...val };
            });
          }

          // Merge with legacy referrals/code for backward compatibility
          if (code) {
            get(ref(db, `referrals/${code}`)).then((legSnap) => {
              if (legSnap.exists()) {
                const legData = legSnap.val();
                Object.entries(legData).forEach(([uId, val]: [string, any]) => {
                  if (!map[uId]) {
                    map[uId] = { uid: uId, level: 1, ...val };
                  }
                });
              }
              const list = Object.values(map);
              list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
              setLevel1(list);
            }).catch(() => {
              const list = Object.values(map);
              list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
              setLevel1(list);
            });
          } else {
            const list = Object.values(map);
            list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setLevel1(list);
          }
        });
        unsubRefs.push(unsubL1);

        // 3. Listen for Level 2 Referrals
        const l2Ref = ref(db, `userReferrals/${user!.uid}/level2`);
        const unsubL2 = onValue(l2Ref, (snap) => {
          if (snap.exists()) {
            const list: ReferralMember[] = Object.entries(snap.val()).map(([uId, val]: [string, any]) => ({
              uid: uId,
              level: 2,
              ...val,
            }));
            list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setLevel2(list);
          } else {
            setLevel2([]);
          }
        });
        unsubRefs.push(unsubL2);

        // 4. Listen for Level 3 Referrals
        const l3Ref = ref(db, `userReferrals/${user!.uid}/level3`);
        const unsubL3 = onValue(l3Ref, (snap) => {
          if (snap.exists()) {
            const list: ReferralMember[] = Object.entries(snap.val()).map(([uId, val]: [string, any]) => ({
              uid: uId,
              level: 3,
              ...val,
            }));
            list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setLevel3(list);
          } else {
            setLevel3([]);
          }
        });
        unsubRefs.push(unsubL3);

        // 5. Listen for Commission Earnings
        const earnRef = ref(db, `referralEarnings/${user!.uid}`);
        const unsubEarn = onValue(earnRef, (snap) => {
          if (snap.exists()) {
            const list: EarningRecord[] = Object.entries(snap.val()).map(([key, val]: [string, any]) => ({
              key,
              amount: Number(val.amount || 0),
              currency: val.currency || "USD",
              level: Number(val.level || 1),
              percentage: Number(val.percentage || 12),
              fromPhone: val.fromPhone,
              depositAmount: Number(val.depositAmount || 0),
              createdAt: Number(val.createdAt || 0),
            }));
            list.sort((a, b) => b.createdAt - a.createdAt);
            setEarnings(list);
          } else {
            setEarnings([]);
          }
          setLoading(false);
        });
        unsubRefs.push(unsubEarn);

      } catch (err) {
        console.error("Error loading affiliate data", err);
        setLoading(false);
      }
    }

    loadAffiliateData();

    return () => {
      unsubRefs.forEach((unsub) => unsub());
    };
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
      `Join AUTEX AI Crypto platform using my referral code *${affiliateCode}* and start earning today! Direct 12% commission + 3-tier rewards. Register here: ${referralLink}`
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
      `Join AUTEX AI Crypto platform using referral code ${affiliateCode}! Trade & earn 3-tier affiliate rewards: ${referralLink}`
    );
    window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
  };

  // Calculations
  const totalNetworkCount = level1.length + level2.length + level3.length;
  const totalEarned = earnings.reduce((sum, item) => sum + item.amount, 0);

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
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 20px" }}>Invite friends and earn up to 15% across 3 tiers (12% Direct, 2% Level 2, 1% Level 3) on every approved deposit.</p>
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
      {/* ── 1. Binance Style 3-Tier Hero Banner ── */}
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
            3-Tier Referral Rewards
          </span>
        </div>

        <h1 style={{ fontSize: "clamp(18px, 4.5vw, 22px)", fontWeight: 900, color: "#ffffff", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
          Invite Friends. Earn 15% on Every Deposit.
        </h1>
        <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.75)", margin: "0 0 16px", lineHeight: 1.5, maxWidth: 360 }}>
          Earn <strong style={{ color: "#f0b90b" }}>12% Direct</strong> + <strong style={{ color: "#0ecb81" }}>2% Level 2</strong> + <strong style={{ color: "#60a5fa" }}>1% Level 3</strong> automatically on <strong style={{ color: "#ffffff", textDecoration: "underline" }}>every single deposit</strong> made by your downliners — not just their first deposit!
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
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 700, textTransform: "uppercase" }}>Total Network</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#ffffff", marginTop: 2 }}>{totalNetworkCount}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 700, textTransform: "uppercase" }}>Direct Rate</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#0ecb81", marginTop: 2 }}>12%</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 700, textTransform: "uppercase" }}>Total Earned</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#f0b90b", marginTop: 4 }}>${totalEarned.toFixed(2)}</div>
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

      {/* ── 3. 3-Tier Commission Structure Cards ── */}
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
          3-Tier Commission Distribution
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center" }}>
          {/* Level 1: Direct */}
          <div
            onClick={() => setActiveTab("l1")}
            style={{
              padding: "12px 6px",
              borderRadius: 14,
              border: `1.5px solid ${activeTab === "l1" ? "#00a651" : "var(--stroke)"}`,
              background: activeTab === "l1" ? "rgba(0,166,81,0.08)" : "var(--bg2)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: "#00a651", textTransform: "uppercase" }}>Level 1</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text)", margin: "4px 0" }}>12%</div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>Direct ({level1.length})</div>
          </div>

          {/* Level 2: Secondary */}
          <div
            onClick={() => setActiveTab("l2")}
            style={{
              padding: "12px 6px",
              borderRadius: 14,
              border: `1.5px solid ${activeTab === "l2" ? "#2563eb" : "var(--stroke)"}`,
              background: activeTab === "l2" ? "rgba(37,99,235,0.08)" : "var(--bg2)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: "#2563eb", textTransform: "uppercase" }}>Level 2</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text)", margin: "4px 0" }}>2%</div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>Sub ({level2.length})</div>
          </div>

          {/* Level 3: Extended */}
          <div
            onClick={() => setActiveTab("l3")}
            style={{
              padding: "12px 6px",
              borderRadius: 14,
              border: `1.5px solid ${activeTab === "l3" ? "#d97706" : "var(--stroke)"}`,
              background: activeTab === "l3" ? "rgba(240,185,11,0.12)" : "var(--bg2)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: "#d97706", textTransform: "uppercase" }}>Level 3</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#d97706", margin: "4px 0" }}>1%</div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>Sub ({level3.length})</div>
          </div>
        </div>

        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "rgba(0,166,81,0.06)", border: "1px dashed rgba(0,166,81,0.3)", display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00a651" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
          <span style={{ fontSize: 11, color: "var(--text)", lineHeight: 1.4 }}>
            Commissions are processed in real-time on <strong>every deposit</strong> your downlines make (recurring lifetime commissions, not only their first deposit).
          </span>
        </div>
      </div>

      {/* ── 4. Downline Team & Earnings Explorer ── */}
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
        {/* Navigation Tabs */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 10, marginBottom: 12, borderBottom: "1px solid var(--stroke)" }}>
          <button
            type="button"
            onClick={() => setActiveTab("l1")}
            style={{
              padding: "7px 12px",
              borderRadius: 999,
              border: activeTab === "l1" ? "1.5px solid #00a651" : "1px solid var(--stroke)",
              background: activeTab === "l1" ? "#00a651" : "var(--bg2)",
              color: activeTab === "l1" ? "#fff" : "var(--text)",
              fontSize: 11.5,
              fontWeight: 800,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Level 1 ({level1.length}) • 12%
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("l2")}
            style={{
              padding: "7px 12px",
              borderRadius: 999,
              border: activeTab === "l2" ? "1.5px solid #2563eb" : "1px solid var(--stroke)",
              background: activeTab === "l2" ? "#2563eb" : "var(--bg2)",
              color: activeTab === "l2" ? "#fff" : "var(--text)",
              fontSize: 11.5,
              fontWeight: 800,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Level 2 ({level2.length}) • 2%
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("l3")}
            style={{
              padding: "7px 12px",
              borderRadius: 999,
              border: activeTab === "l3" ? "1.5px solid #d97706" : "1px solid var(--stroke)",
              background: activeTab === "l3" ? "#d97706" : "var(--bg2)",
              color: activeTab === "l3" ? "#fff" : "var(--text)",
              fontSize: 11.5,
              fontWeight: 800,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Level 3 ({level3.length}) • 1%
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("earnings")}
            style={{
              padding: "7px 12px",
              borderRadius: 999,
              border: activeTab === "earnings" ? "1.5px solid #7c3aed" : "1px solid var(--stroke)",
              background: activeTab === "earnings" ? "#7c3aed" : "var(--bg2)",
              color: activeTab === "earnings" ? "#fff" : "var(--text)",
              fontSize: 11.5,
              fontWeight: 800,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Earnings ({earnings.length})
          </button>
        </div>

        {/* Tab 1: Level 1 Members */}
        {activeTab === "l1" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)" }}>Direct Invited Members</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#00a651", background: "rgba(0,166,81,0.1)", padding: "2px 8px", borderRadius: 6 }}>12% Commission</span>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "var(--muted)", fontSize: 12.5 }}>Loading direct members…</div>
            ) : level1.length === 0 ? (
              <div style={{ textAlign: "center", padding: "28px 16px", background: "rgba(0,0,0,0.02)", borderRadius: 12, border: "1px solid var(--stroke)" }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: "var(--text)", marginBottom: 4 }}>No Level 1 members yet</div>
                <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "0 0 14px" }}>Share your invitation link to earn 12% on every deposit they make.</p>
                <button type="button" onClick={copyLink} style={{ padding: "8px 18px", borderRadius: 999, border: "none", background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                  Invite Direct Friends
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {level1.map((m, i) => (
                  <div key={m.uid || i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 12, background: "var(--bg2)", border: "1px solid var(--stroke)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#00a651", color: "#fff", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {(m.displayName || m.phone || "U").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 13, color: "var(--text)" }}>{m.displayName || m.phone || "Direct Referral"}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>{m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "Active Member"}</div>
                      </div>
                    </div>
                    <span style={{ padding: "3px 8px", borderRadius: 999, background: "rgba(0,166,81,0.12)", color: "#00a651", fontSize: 10.5, fontWeight: 800 }}>
                      Level 1
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Level 2 Members */}
        {activeTab === "l2" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)" }}>Secondary Members (Invited by your Level 1)</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#2563eb", background: "rgba(37,99,235,0.1)", padding: "2px 8px", borderRadius: 6 }}>2% Commission</span>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "var(--muted)", fontSize: 12.5 }}>Loading Level 2 members…</div>
            ) : level2.length === 0 ? (
              <div style={{ textAlign: "center", padding: "28px 16px", background: "rgba(0,0,0,0.02)", borderRadius: 12, border: "1px solid var(--stroke)" }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: "var(--text)", marginBottom: 4 }}>No Level 2 members yet</div>
                <p style={{ fontSize: 11.5, color: "var(--muted)", margin: 0 }}>When your direct referrals invite their own friends, they appear here and earn you 2% passive commission.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {level2.map((m, i) => (
                  <div key={m.uid || i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 12, background: "var(--bg2)", border: "1px solid var(--stroke)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#2563eb", color: "#fff", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {(m.displayName || m.phone || "U").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 13, color: "var(--text)" }}>{m.displayName || m.phone || "Level 2 Member"}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>{m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "Active Member"}</div>
                      </div>
                    </div>
                    <span style={{ padding: "3px 8px", borderRadius: 999, background: "rgba(37,99,235,0.12)", color: "#2563eb", fontSize: 10.5, fontWeight: 800 }}>
                      Level 2
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Level 3 Members */}
        {activeTab === "l3" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)" }}>Extended Network (Invited by your Level 2)</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#d97706", background: "rgba(240,185,11,0.1)", padding: "2px 8px", borderRadius: 6 }}>1% Commission</span>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "var(--muted)", fontSize: 12.5 }}>Loading Level 3 members…</div>
            ) : level3.length === 0 ? (
              <div style={{ textAlign: "center", padding: "28px 16px", background: "rgba(0,0,0,0.02)", borderRadius: 12, border: "1px solid var(--stroke)" }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: "var(--text)", marginBottom: 4 }}>No Level 3 members yet</div>
                <p style={{ fontSize: 11.5, color: "var(--muted)", margin: 0 }}>When your Level 2 network invites new friends, they become Level 3 and earn you 1% continuous rewards.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {level3.map((m, i) => (
                  <div key={m.uid || i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 12, background: "var(--bg2)", border: "1px solid var(--stroke)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#d97706", color: "#fff", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {(m.displayName || m.phone || "U").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 13, color: "var(--text)" }}>{m.displayName || m.phone || "Level 3 Member"}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>{m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "Active Member"}</div>
                      </div>
                    </div>
                    <span style={{ padding: "3px 8px", borderRadius: 999, background: "rgba(240,185,11,0.15)", color: "#d97706", fontSize: 10.5, fontWeight: 800 }}>
                      Level 3
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Earnings Log */}
        {activeTab === "earnings" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)" }}>Commission Payment History</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#00a651" }}>Total: ${totalEarned.toFixed(2)}</span>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "var(--muted)", fontSize: 12.5 }}>Loading earnings…</div>
            ) : earnings.length === 0 ? (
              <div style={{ textAlign: "center", padding: "28px 16px", background: "rgba(0,0,0,0.02)", borderRadius: 12, border: "1px solid var(--stroke)" }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: "var(--text)", marginBottom: 4 }}>No commissions received yet</div>
                <p style={{ fontSize: 11.5, color: "var(--muted)", margin: 0 }}>Commissions will automatically be credited directly to your balance when an admin approves downline deposits.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {earnings.map((e) => (
                  <div key={e.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 12, background: "var(--bg2)", border: "1px solid var(--stroke)" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 800,
                          background: e.level === 1 ? "rgba(0,166,81,0.12)" : e.level === 2 ? "rgba(37,99,235,0.12)" : "rgba(240,185,11,0.15)",
                          color: e.level === 1 ? "#00a651" : e.level === 2 ? "#2563eb" : "#d97706",
                        }}>
                          Level {e.level} ({e.percentage}%)
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>from {e.fromPhone || "Downline"}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        {e.createdAt ? new Date(e.createdAt).toLocaleString() : ""} • Deposit: ${e.depositAmount ? e.depositAmount.toFixed(2) : "0.00"}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: "#00a651" }}>
                      +${e.amount.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 5. Bottom Navigation Shortcuts ── */}
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
