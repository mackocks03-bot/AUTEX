import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/context/AuthContext";
import { ref, onValue, push, set, update } from "firebase/database";
import { db } from "@/firebase";
import { getBotById } from "@/lib/bots";

/* ─── Styles & Keyframe Animations ───────────────────── */
const css = `
@keyframes botSpin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

@keyframes radarSpin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

@keyframes pulseLive {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(14, 203, 129, 0.7);
  }
  50% {
    transform: scale(1.18);
    box-shadow: 0 0 0 8px rgba(14, 203, 129, 0);
  }
}

@keyframes glowWave {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; filter: drop-shadow(0 0 10px rgba(0, 166, 81, 0.6)); }
}

@keyframes claimPop {
  0% { transform: scale(0.8); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
`;

function fmtFull(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface ActiveBotRecord {
  key: string;
  bot: string;
  botName: string;
  amount: number;
  dailyPct: number;
  dailyReturn: number;
  activatedAt: number;
  status: string;
  lastClaimedDate?: string;
  lastClaimedAt?: number;
  totalEarned?: number;
}

export default function MyBots() {
  const { user } = useAuth();
  const [activeBots, setActiveBots] = useState<ActiveBotRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Time state for live countdown
  const [now, setNow] = useState(new Date());
  const [claimingKey, setClaimingKey] = useState<string | null>(null);
  const [claimedModal, setClaimedModal] = useState<{ name: string; amount: number } | null>(null);

  // Real-time clock tick every second
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch active bots from Firebase
  useEffect(() => {
    if (!user) {
      setActiveBots([]);
      setLoading(false);
      return;
    }

    const r = ref(db, `userBots/${user.uid}`);
    return onValue(r, (snap) => {
      if (snap.exists()) {
        const val = snap.val() as Record<string, Omit<ActiveBotRecord, "key">>;
        const list: ActiveBotRecord[] = Object.entries(val).map(([key, data]) => ({
          key,
          ...data,
          dailyPct: data.dailyPct || (data.amount >= 100 ? 15 : 12),
          dailyReturn: data.dailyReturn || data.amount * ((data.dailyPct || (data.amount >= 100 ? 15 : 12)) / 100),
        }));
        // sort by newest activation first
        list.sort((a, b) => b.activatedAt - a.activatedAt);
        setActiveBots(list);
      } else {
        setActiveBots([]);
      }
      setLoading(false);
    });
  }, [user]);

  // 1:00 PM to 2:00 PM window calculation (Hours: 13:00:00 - 13:59:59)
  const currentHour = now.getHours();
  const isMiningWindow = currentHour === 13;

  // Countdown timer calculations
  let countdownText = "";
  if (isMiningWindow) {
    // Minutes and seconds until 2:00 PM (14:00:00)
    const minsLeft = 59 - now.getMinutes();
    const secsLeft = 59 - now.getSeconds();
    countdownText = `${String(minsLeft).padStart(2, "0")}m ${String(secsLeft).padStart(2, "0")}s`;
  } else {
    // Time until next 1:00 PM (13:00:00)
    const target = new Date(now);
    if (currentHour >= 14) {
      target.setDate(target.getDate() + 1);
    }
    target.setHours(13, 0, 0, 0);
    const diffMs = target.getTime() - now.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diffMs % (1000 * 60)) / 1000);
    countdownText = `${String(hours).padStart(2, "0")}h ${String(mins).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`;
  }

  const todayKey = getTodayKey();

  // Claim/Mine daily yield
  async function handleClaim(b: ActiveBotRecord) {
    if (!user || claimingKey || !isMiningWindow) return;
    if (b.lastClaimedDate === todayKey) return;

    setClaimingKey(b.key);
    try {
      const claimAmount = b.dailyReturn;

      // 1. Credit wallet balance through userPayments (real-time balance update)
      const payRef = push(ref(db, `userPayments/${user.uid}`));
      await set(payRef, {
        amount: claimAmount,
        currency: "USD",
        type: "bot_reward",
        botId: b.bot,
        botName: b.botName,
        status: "completed",
        description: `${b.botName} Daily Mining Yield`,
        createdAt: Date.now(),
      });

      // 2. Update bot record with lastClaimedDate and totalEarned
      const botRef = ref(db, `userBots/${user.uid}/${b.key}`);
      await update(botRef, {
        lastClaimedDate: todayKey,
        lastClaimedAt: Date.now(),
        totalEarned: (b.totalEarned || 0) + claimAmount,
      });

      setClaimedModal({ name: b.botName, amount: claimAmount });
    } catch (e) {
      console.error("Failed to claim daily return:", e);
    } finally {
      setClaimingKey(null);
    }
  }

  // Portfolio aggregates
  const totalInvested = activeBots.reduce((sum, b) => sum + (b.amount || 0), 0);
  const totalDailyProfit = activeBots.reduce((sum, b) => sum + (b.dailyReturn || 0), 0);
  const totalEarnedSoFar = activeBots.reduce((sum, b) => sum + (b.totalEarned || 0), 0);

  return (
    <>
      <style>{css}</style>

      {/* ── Claim Success Modal ── */}
      {claimedModal && (
        <>
          <div
            onClick={() => setClaimedModal(null)}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1100,
            }}
          />
          <div style={{
            position: "fixed",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: "calc(100% - 48px)", maxWidth: 360,
            background: "var(--bg1)",
            borderRadius: 22,
            boxShadow: "-8px -8px 24px rgba(255,255,255,0.9), 8px 8px 24px rgba(163,177,198,0.5)",
            border: "1px solid rgba(255,255,255,0.8)",
            zIndex: 1101,
            padding: "26px 20px 20px",
            textAlign: "center",
            animation: "claimPop 0.3s ease",
          }}>
            <div style={{
              width: 58, height: 58, borderRadius: "50%",
              background: "linear-gradient(135deg, #00a651, #007a3c)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              marginBottom: 12,
              boxShadow: "0 6px 20px rgba(0,166,81,0.4), -3px -3px 8px rgba(255,255,255,0.8)",
            }}>
              <span style={{ fontSize: 28 }}>⚡</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text)", marginBottom: 4 }}>
              Daily Return Mined! 🎉
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
              Successfully claimed from <strong>{claimedModal.name}</strong>.
            </div>
            <div style={{
              padding: "12px", borderRadius: 14,
              background: "var(--bg2)",
              border: "1px solid rgba(0,166,81,0.3)",
              boxShadow: "inset 2px 2px 5px rgba(163,177,198,0.3), inset -2px -2px 5px rgba(255,255,255,0.8)",
              marginBottom: 18,
            }}>
              <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>Added to Wallet</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#00a651", marginTop: 2 }}>
                +${fmtFull(claimedModal.amount)}
              </div>
            </div>
            <button
              onClick={() => setClaimedModal(null)}
              style={{
                width: "100%", height: 44, borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.4)",
                background: "linear-gradient(135deg, #00a651 0%, #007a3c 100%)",
                color: "#fff", fontSize: 15, fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(0,166,81,0.35)",
              }}
            >
              Continue
            </button>
          </div>
        </>
      )}

      <Shell>
        {/* Header Title */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "#0ecb81",
              boxShadow: "0 0 10px #0ecb81",
              animation: "pulseLive 1.5s infinite",
              display: "inline-block",
            }} />
            <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Live Autonomous Fleet
            </span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text)", letterSpacing: "-0.02em" }}>
            My Active Bots 🤖
          </div>
        </div>

        {/* ── Navigation Tabs (Neumorphic Switch) ── */}
        <div style={{
          display: "flex", gap: 8, padding: 4, borderRadius: 14,
          background: "var(--bg2)",
          border: "1px solid rgba(255,255,255,0.6)",
          boxShadow: "inset 2px 2px 5px rgba(163,177,198,0.35), inset -2px -2px 5px rgba(255,255,255,0.8)",
          marginBottom: 16,
        }}>
          <Link
            to="/bots"
            style={{
              flex: 1, padding: "9px 0", borderRadius: 10, textAlign: "center",
              fontSize: 13, fontWeight: 700, textDecoration: "none",
              color: "var(--muted)",
              transition: "all 0.15s ease",
            }}
          >
            Explore Bots (13)
          </Link>
          <div
            style={{
              flex: 1, padding: "9px 0", borderRadius: 10, textAlign: "center",
              fontSize: 13, fontWeight: 800,
              background: "var(--bg1)",
              color: "var(--text)",
              boxShadow: "-3px -3px 8px rgba(255,255,255,0.95), 3px 3px 8px rgba(163,177,198,0.45)",
            }}
          >
            My Bots ({activeBots.length})
          </div>
        </div>

        {/* ── 1:00 PM – 2:00 PM Mining Window Banner ── */}
        <div style={{
          borderRadius: 18,
          padding: "15px 16px",
          marginBottom: 16,
          background: isMiningWindow
            ? "linear-gradient(135deg, rgba(0,166,81,0.14) 0%, rgba(14,203,129,0.06) 100%)"
            : "var(--bg1)",
          border: isMiningWindow
            ? "1.5px solid rgba(0,166,81,0.4)"
            : "1.5px solid var(--stroke)",
          boxShadow: isMiningWindow
            ? "0 0 20px rgba(0,166,81,0.2), -4px -4px 10px rgba(255,255,255,0.9)"
            : "-5px -5px 14px rgba(255,255,255,0.9), 5px 5px 14px rgba(163,177,198,0.4)",
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: 16 }}>{isMiningWindow ? "⚡" : "⏰"}</span>
              <span style={{
                fontSize: 13, fontWeight: 800,
                color: isMiningWindow ? "#00a651" : "var(--text)",
                letterSpacing: "-0.01em",
              }}>
                {isMiningWindow ? "MINING WINDOW OPEN" : "DAILY MINING WINDOW"}
              </span>
            </div>
            <div style={{
              padding: "3px 9px", borderRadius: 999,
              background: isMiningWindow ? "#00a651" : "var(--bg2)",
              color: isMiningWindow ? "#fff" : "var(--muted)",
              fontSize: 11, fontWeight: 800,
              boxShadow: isMiningWindow ? "0 2px 8px rgba(0,166,81,0.4)" : "none",
            }}>
              1:00 PM – 2:00 PM
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 4 }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              {isMiningWindow
                ? "Mining window active! Claim your daily return below:"
                : "Mining is allowed daily between 1:00 PM & 2:00 PM only."}
            </div>
          </div>

          {/* Countdown timer pill */}
          <div style={{
            marginTop: 10,
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "6px 12px", borderRadius: 10,
            background: "var(--bg2)",
            border: "1px solid rgba(255,255,255,0.7)",
            boxShadow: "inset 2px 2px 5px rgba(163,177,198,0.35), inset -2px -2px 5px rgba(255,255,255,0.8)",
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>
              {isMiningWindow ? "Window closes in:" : "Next window opens in:"}
            </span>
            <span style={{
              fontSize: 13, fontWeight: 900, fontFamily: "monospace",
              color: isMiningWindow ? "#00a651" : "var(--text)",
            }}>
              {countdownText}
            </span>
          </div>
        </div>

        {/* ── Neumorphic Fleet Summary Card ── */}
        <div style={{
          borderRadius: 20,
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
          padding: "16px 18px",
          marginBottom: 18,
          boxShadow: "-6px -6px 14px rgba(255,255,255,0.85), 6px 8px 20px rgba(163,177,198,0.45)",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: -25, right: -25, width: 110, height: 110,
            borderRadius: "50%", background: "radial-gradient(circle,rgba(0,166,81,0.25),transparent 70%)",
            pointerEvents: "none",
          }} />

          {/* 3 Metrics Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Total Invested
              </div>
              <div style={{ fontSize: 19, fontWeight: 900, color: "#fff", marginTop: 2 }}>
                ${fmtFull(totalInvested)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Daily Yield
              </div>
              <div style={{ fontSize: 19, fontWeight: 900, color: "#0ecb81", marginTop: 2 }}>
                +${fmtFull(totalDailyProfit)}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Earned
              </div>
              <div style={{ fontSize: 19, fontWeight: 900, color: "#38bdf8", marginTop: 2 }}>
                ${fmtFull(totalEarnedSoFar)}
              </div>
            </div>
          </div>
        </div>

        {/* ── Active Bots List ── */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--muted)", fontSize: 14 }}>
            Loading your trading bots…
          </div>
        ) : activeBots.length === 0 ? (
          /* Empty State */
          <div style={{
            borderRadius: 20,
            background: "var(--bg1)",
            padding: "36px 20px",
            textAlign: "center",
            border: "1.5px solid var(--stroke)",
            boxShadow: "-5px -5px 14px rgba(255,255,255,0.9), 5px 5px 14px rgba(163,177,198,0.45)",
          }}>
            <div style={{
              width: 68, height: 68, borderRadius: "50%",
              background: "var(--bg2)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              marginBottom: 14,
              boxShadow: "inset 2px 2px 6px rgba(163,177,198,0.35), inset -2px -2px 6px rgba(255,255,255,0.8)",
            }}>
              <span style={{ fontSize: 32 }}>🤖</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", marginBottom: 6 }}>
              No Active Bots Yet
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", maxWidth: 280, margin: "0 auto 20px", lineHeight: 1.5 }}>
              Activate an AI trading bot to start earning automated 12% – 15% daily returns.
            </div>
            <Link
              to="/bots"
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "12px 24px", borderRadius: 12,
                background: "linear-gradient(135deg, #00a651 0%, #007a3c 100%)",
                color: "#fff", fontSize: 14, fontWeight: 800,
                textDecoration: "none",
                boxShadow: "0 4px 14px rgba(0,166,81,0.35)",
              }}
            >
              <span>Explore Trading Bots</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {activeBots.map((b) => {
              const botMeta = getBotById(b.bot);
              const isClaimedToday = b.lastClaimedDate === todayKey;
              const isClaiming = claimingKey === b.key;

              return (
                <div
                  key={b.key}
                  style={{
                    borderRadius: 20,
                    background: "var(--bg1)",
                    border: "1px solid rgba(255, 255, 255, 0.75)",
                    boxShadow: "-6px -6px 14px rgba(255, 255, 255, 0.95), 6px 6px 16px rgba(163, 177, 198, 0.45)",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {/* Card Header with Rotating Avatar & Radar Ring */}
                  <div style={{
                    background: botMeta.gradient,
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    position: "relative",
                    overflow: "hidden",
                  }}>
                    {/* Background flare */}
                    <div style={{
                      position: "absolute", top: -25, right: -25, width: 90, height: 90,
                      borderRadius: "50%", background: "rgba(255,255,255,0.08)", pointerEvents: "none",
                    }} />

                    {/* Left: Avatar with Rotating Image + Rotating Green Margin Ring */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {/* Rotating Green Margin / Radar Ring */}
                      <div style={{
                        position: "relative",
                        width: 50, height: 50,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {/* Rotating Radar Conic Ring */}
                        <div style={{
                          position: "absolute",
                          inset: 0,
                          borderRadius: "50%",
                          padding: "2.5px",
                          background: "conic-gradient(from 0deg, #00a651 0%, #0ecb81 35%, transparent 60%, #00a651 100%)",
                          animation: "radarSpin 3s linear infinite",
                          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                          WebkitMaskComposite: "xor",
                          maskComposite: "exclude",
                        }} />

                        {/* Inner Avatar Bubble with Continuous Image Rotation */}
                        <div style={{
                          width: 42, height: 42, borderRadius: "50%",
                          background: "rgba(255,255,255,0.18)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.3), inset 1px 1px 2px rgba(255,255,255,0.4)",
                          overflow: "hidden",
                        }}>
                          <img
                            src={botMeta.img}
                            alt={b.botName}
                            style={{
                              width: 28, height: 28, objectFit: "contain",
                              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
                              animation: "botSpin 7s linear infinite",
                            }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "https://cdn-icons-png.flaticon.com/512/4712/4712035.png";
                            }}
                          />
                        </div>
                      </div>

                      {/* Bot Info & Running Status */}
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", lineHeight: 1.2 }}>
                          {b.botName}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                          {/* Live green pulsing beacon */}
                          <span style={{
                            width: 7, height: 7, borderRadius: "50%",
                            background: "#0ecb81",
                            boxShadow: "0 0 8px #0ecb81",
                            animation: "pulseLive 1.4s infinite",
                            display: "inline-block",
                          }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#0ecb81", letterSpacing: "0.03em" }}>
                            ENGINE RUNNING
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Daily Rate Pill */}
                    <div style={{
                      background: "rgba(0,0,0,0.32)",
                      border: "1px solid rgba(14,203,129,0.5)",
                      borderRadius: 10,
                      padding: "4px 9px",
                      textAlign: "right",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 900, color: "#0ecb81" }}>
                        +{b.dailyPct}%
                      </div>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.75)", fontWeight: 700 }}>
                        DAILY
                      </div>
                    </div>
                  </div>

                  {/* Card Body Details (Neumorphic Inset Rows) */}
                  <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
                    {/* Detail 1: Active Investment */}
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "7px 11px", borderRadius: 10,
                      background: "var(--bg2)",
                      border: "1px solid rgba(255,255,255,0.6)",
                      boxShadow: "inset 2px 2px 5px rgba(163,177,198,0.35), inset -2px -2px 5px rgba(255,255,255,0.8)",
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Active Capital</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text)" }}>${fmtFull(b.amount)}</span>
                    </div>

                    {/* Detail 2: Daily Payout */}
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "7px 11px", borderRadius: 10,
                      background: "var(--bg2)",
                      border: "1px solid rgba(0,166,81,0.25)",
                      boxShadow: "inset 2px 2px 5px rgba(163,177,198,0.3), inset -2px -2px 5px rgba(255,255,255,0.8)",
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Daily Return</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#00a651" }}>
                        +${fmtFull(b.dailyReturn)} / day
                      </span>
                    </div>

                    {/* Detail 3: Total Claimed to Date */}
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "7px 11px", borderRadius: 10,
                      background: "var(--bg2)",
                      border: "1px solid rgba(255,255,255,0.6)",
                      boxShadow: "inset 2px 2px 5px rgba(163,177,198,0.35), inset -2px -2px 5px rgba(255,255,255,0.8)",
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Total Collected</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#0284c7" }}>
                        ${fmtFull(b.totalEarned || 0)}
                      </span>
                    </div>

                    {/* ── Mine / Claim Action Button ── */}
                    {isClaimedToday ? (
                      /* Already claimed today */
                      <div
                        style={{
                          marginTop: 3,
                          width: "100%",
                          height: 42,
                          borderRadius: 11,
                          border: "1px solid rgba(0,166,81,0.3)",
                          background: "rgba(0,166,81,0.08)",
                          color: "#00a651",
                          fontSize: 13.5,
                          fontWeight: 800,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>Claimed Today (+${fmtFull(b.dailyReturn)})</span>
                      </div>
                    ) : isMiningWindow ? (
                      /* Inside 1:00 PM - 2:00 PM: Can Mine! */
                      <button
                        onClick={() => handleClaim(b)}
                        disabled={isClaiming}
                        style={{
                          marginTop: 3,
                          width: "100%",
                          height: 42,
                          borderRadius: 11,
                          border: "1px solid rgba(255,255,255,0.3)",
                          background: "linear-gradient(135deg, #00a651 0%, #008742 100%)",
                          color: "#ffffff",
                          fontSize: 14,
                          fontWeight: 800,
                          cursor: isClaiming ? "not-allowed" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 7,
                          boxShadow: "0 4px 16px rgba(0,166,81,0.4), -2px -2px 6px rgba(255,255,255,0.6)",
                          animation: "glowWave 2s infinite",
                          transition: "all 0.15s ease",
                        }}
                        onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
                        onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                      >
                        <span style={{ fontSize: 16 }}>⚡</span>
                        <span>{isClaiming ? "Mining…" : `Mine / Claim · +$${fmtFull(b.dailyReturn)}`}</span>
                      </button>
                    ) : (
                      /* Outside Mining Window (1:00 PM - 2:00 PM) */
                      <button
                        disabled
                        style={{
                          marginTop: 3,
                          width: "100%",
                          height: 42,
                          borderRadius: 11,
                          border: "1px solid rgba(255,255,255,0.6)",
                          background: "var(--bg2)",
                          color: "var(--muted)",
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: "not-allowed",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          boxShadow: "inset 2px 2px 5px rgba(163,177,198,0.3), inset -2px -2px 5px rgba(255,255,255,0.8)",
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                        <span>Mine at 1:00 PM – 2:00 PM (+${fmtFull(b.dailyReturn)})</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Shell>
    </>
  );
}
