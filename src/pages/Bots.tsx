import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/context/AuthContext";
import { ref, onValue, push, set, get, update } from "firebase/database";
import { db } from "@/firebase";
import { BOTS, type BotDef } from "@/lib/bots";

/* ─── Styles & Animations ────────────────────────────── */
const css = `
@keyframes sheetIn  { from{transform:translateY(100%)} to{transform:translateY(0)} }
@keyframes sheetOut { from{transform:translateY(0)} to{transform:translateY(100%)} }
@keyframes maskIn   { from{opacity:0} to{opacity:1} }
@keyframes maskOut  { from{opacity:1} to{opacity:0} }
@keyframes botPop   { 0%{transform:scale(0.8);opacity:0} 100%{transform:scale(1);opacity:1} }
@keyframes checkPop { 0%{transform:scale(0)} 60%{transform:scale(1.2)} 100%{transform:scale(1)} }
`;

function fmtFull(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ─── Compact Neumorphic Confirm Sheet ────────────────── */
interface SheetProps {
  bot: BotDef;
  balance: number;
  open: boolean;
  closing: boolean;
  onConfirm: () => void;
  onClose: () => void;
  submitting: boolean;
  done: boolean;
}

function ConfirmSheet({ bot, balance, open, closing, onConfirm, onClose, submitting, done }: SheetProps) {
  if (!open && !closing) return null;

  const amount = bot.investAmount;
  const dailyReturn = amount * (bot.dailyPct / 100);
  const insufficient = balance < amount;

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000,
        animation: closing ? "maskOut .25s ease forwards" : "maskIn .25s ease forwards",
      }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "var(--bg1)",
        borderRadius: "20px 20px 0 0",
        zIndex: 1001,
        maxWidth: 440,
        margin: "0 auto",
        animation: closing ? "sheetOut .22s ease forwards" : "sheetIn .24s ease forwards",
        boxShadow: "0 -8px 36px rgba(0,0,0,0.22), -4px -4px 14px rgba(255,255,255,0.8)",
        border: "1px solid rgba(255,255,255,0.6)",
      }}>
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 4px" }}>
          <div style={{
            width: 34, height: 3.5, borderRadius: 2,
            background: "var(--stroke)",
            boxShadow: "inset 1px 1px 2px rgba(163,177,198,0.4), inset -1px -1px 2px rgba(255,255,255,0.8)"
          }} />
        </div>

        {done ? (
          /* ── Success ── */
          <div style={{ textAlign: "center", padding: "8px 18px 16px" }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: "linear-gradient(135deg,#00a651,#007a3c)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              marginBottom: 8,
              boxShadow: "0 4px 14px rgba(0,166,81,0.4)",
              animation: "botPop .35s ease forwards",
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "checkPop .25s ease .1s both" }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", marginBottom: 3 }}>
              {bot.name} Activated! 🎉
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14, lineHeight: 1.4 }}>
              Daily return of <strong style={{ color: "#00a651" }}>${fmtFull(dailyReturn)} ({bot.dailyPct}%)</strong> arrives during the 1:00 PM – 2:00 PM window.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onClose} style={{
                flex: 1, height: 38, borderRadius: 10, border: "1px solid var(--stroke)",
                background: "var(--bg2)", color: "var(--muted)", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>
                Close
              </button>
              <Link to="/my-bots" style={{
                flex: 2, height: 38, borderRadius: 10, border: "1px solid rgba(255,255,255,0.3)",
                background: "linear-gradient(135deg,#00a651,#007a3c)",
                color: "#fff", fontSize: 13, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center",
                textDecoration: "none", gap: 6,
                boxShadow: "0 3px 10px rgba(0,166,81,0.35)",
              }}>
                <span>View in My Bots →</span>
              </Link>
            </div>
          </div>
        ) : insufficient ? (
          /* ── Insufficient Balance State ── */
          <div style={{ padding: "4px 14px 16px" }}>
            <div style={{
              borderRadius: 14,
              padding: "12px 10px",
              background: "var(--bg2)",
              border: "1px solid rgba(239,68,68,0.3)",
              boxShadow: "inset 2px 2px 6px rgba(163,177,198,0.35), inset -2px -2px 6px rgba(255,255,255,0.8)",
              textAlign: "center",
              marginBottom: 10,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "rgba(239,68,68,0.12)",
                color: "#ef4444",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                marginBottom: 6,
                boxShadow: "-2px -2px 6px rgba(255,255,255,0.9), 2px 2px 6px rgba(163,177,198,0.4)",
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: "#ef4444", marginBottom: 3 }}>
                Insufficient Balance
              </div>
              <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.4, marginBottom: 8 }}>
                Fund your account to activate <strong>{bot.name}</strong>.
              </div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "4px 10px", borderRadius: 8,
                background: "var(--bg1)",
                boxShadow: "-1px -1px 3px rgba(255,255,255,0.9), 1px 1px 3px rgba(163,177,198,0.35)",
                fontSize: 11.5, color: "var(--muted)",
              }}>
                <span>Need: <strong style={{ color: "var(--text)" }}>${fmtFull(amount)}</strong></span>
                <span>•</span>
                <span>Have: <strong style={{ color: "#ef4444" }}>${fmtFull(balance)}</strong></span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onClose} style={{
                flex: 1, height: 38, borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.7)", background: "var(--bg2)",
                color: "var(--muted)", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>
                Cancel
              </button>
              <Link to="/deposit" style={{
                flex: 2, height: 38, borderRadius: 10,
                background: "linear-gradient(135deg, #00a651 0%, #007a3c 100%)",
                color: "#fff", fontSize: 13, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 6, textDecoration: "none",
                boxShadow: "0 3px 10px rgba(0,166,81,0.35)",
              }}>
                <span>Fund Account</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12l7 7 7-7"/>
                </svg>
              </Link>
            </div>
          </div>
        ) : (
          /* ── Normal Confirmation State ── */
          <div style={{ padding: "2px 14px 14px" }}>
            {/* Bot row */}
            <div style={{
              borderRadius: 12, padding: "8px 12px",
              background: bot.gradient,
              marginBottom: 8,
              display: "flex", alignItems: "center", gap: 8,
              position: "relative", overflow: "hidden",
              boxShadow: "-2px -2px 6px rgba(255,255,255,0.5), 2px 4px 10px rgba(0,0,0,0.2)",
            }}>
              <img src={bot.img} alt={bot.name} style={{ width: 28, height: 28, objectFit: "contain", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bot.name}</div>
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.75)" }}>{bot.badge} {bot.tier} · {bot.dailyPct}% Daily</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>${fmtFull(amount)}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.65)" }}>Investment</div>
              </div>
            </div>

            {/* Quick Stats Grid with Inset Wells */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, marginBottom: 8 }}>
              {[
                { label: `Daily (${bot.dailyPct}%)`, value: `+$${fmtFull(dailyReturn)}` },
                { label: "Weekly", value: `+$${fmtFull(dailyReturn * 7)}` },
                { label: "Monthly", value: `+$${fmtFull(dailyReturn * 30)}` },
              ].map(s => (
                <div key={s.label} style={{
                  borderRadius: 8, padding: "5px 4px", textAlign: "center",
                  background: "var(--bg2)",
                  border: "1px solid rgba(0,166,81,0.2)",
                  boxShadow: "inset 1px 1px 3px rgba(163,177,198,0.25), inset -1px -1px 3px rgba(255,255,255,0.7)",
                }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#00a651" }}>{s.value}</div>
                  <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 1 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Balance check recessed row */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              borderRadius: 8, padding: "6px 10px", marginBottom: 8,
              background: "var(--bg2)",
              border: "1px solid rgba(255,255,255,0.6)",
              boxShadow: "inset 1px 1px 3px rgba(163,177,198,0.3), inset -1px -1px 3px rgba(255,255,255,0.8)",
            }}>
              <div>
                <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 500 }}>Wallet Balance</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>${fmtFull(balance)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 500 }}>After Activation</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#00a651" }}>${fmtFull(Math.max(0, balance - amount))}</div>
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onClose} disabled={submitting} style={{
                flex: 1, height: 38, borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.7)", background: "var(--bg2)",
                color: "var(--muted)", fontSize: 13, fontWeight: 700, cursor: "pointer",
                boxShadow: "-1px -1px 4px rgba(255,255,255,0.9), 1px 1px 4px rgba(163,177,198,0.35)",
              }}>Cancel</button>
              <button onClick={onConfirm} disabled={submitting} style={{
                flex: 2, height: 38, borderRadius: 10, border: "1px solid rgba(255,255,255,0.3)",
                background: "linear-gradient(135deg,#00a651,#007a3c)",
                color: "#fff", fontSize: 13, fontWeight: 800,
                cursor: submitting ? "not-allowed" : "pointer",
                boxShadow: "0 3px 10px rgba(0,166,81,0.35)",
              }}>
                {submitting ? "Activating…" : "Confirm & Activate 🚀"}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Neumorphic Vertical Bot Card ────────────────────── */
function BotCard({ bot, onActivate }: {
  bot: BotDef;
  onActivate: (bot: BotDef) => void;
}) {
  const dailyReturn = bot.investAmount * (bot.dailyPct / 100);
  const maxAllowed = bot.investAmount * bot.maxMultiplier;

  return (
    <div style={{
      borderRadius: 18,
      background: "var(--bg1)",
      border: "1px solid rgba(255, 255, 255, 0.75)",
      boxShadow: "-6px -6px 14px rgba(255, 255, 255, 0.95), 6px 6px 16px rgba(163, 177, 198, 0.45)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      transition: "transform 0.15s ease",
    }}>
      {/* 1. Header (Beveled soft header) */}
      <div style={{
        background: bot.gradient,
        padding: "11px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Ambient glow flare */}
        <div style={{
          position: "absolute", top: -20, right: -20, width: 80, height: 80,
          borderRadius: "50%", background: "rgba(255,255,255,0.08)", pointerEvents: "none",
        }} />

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Extruded Avatar container */}
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "rgba(255,255,255,0.18)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 3px 8px rgba(0,0,0,0.25), inset 1px 1px 2px rgba(255,255,255,0.4)",
            flexShrink: 0,
          }}>
            <img
              src={bot.img}
              alt={bot.name}
              style={{ width: 24, height: 24, objectFit: "contain", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))" }}
              onError={e => { (e.target as HTMLImageElement).src = "https://cdn-icons-png.flaticon.com/512/4712/4712035.png"; }}
            />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>{bot.name}</div>
            <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.75)", marginTop: 1 }}>{bot.badge} {bot.tier} Tier</div>
          </div>
        </div>

        {/* Daily percentage badge */}
        <div style={{
          background: "rgba(0,0,0,0.3)",
          border: `1px solid ${bot.dailyPct >= 15 ? "rgba(34,211,238,0.5)" : "rgba(14,203,129,0.5)"}`,
          borderRadius: 8,
          padding: "3px 8px",
          display: "flex",
          alignItems: "center",
          gap: 4,
          boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
        }}>
          <span style={{ fontSize: 13, fontWeight: 900, color: bot.dailyPct >= 15 ? "#22d3ee" : "#0ecb81" }}>
            +{bot.dailyPct}%
          </span>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.75)", fontWeight: 700 }}>DAILY</span>
        </div>
      </div>

      {/* 2. Vertical Column Details (Neumorphic Inset Wells) */}
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
        {/* Detail 1: Fixed Investment */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "7px 11px", borderRadius: 10,
          background: "var(--bg2)",
          border: "1px solid rgba(255,255,255,0.6)",
          boxShadow: "inset 2px 2px 5px rgba(163,177,198,0.35), inset -2px -2px 5px rgba(255,255,255,0.8)",
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Investment Amount</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text)" }}>${fmtFull(bot.investAmount)}</span>
        </div>

        {/* Detail 2: Daily Return */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "7px 11px", borderRadius: 10,
          background: "var(--bg2)",
          border: "1px solid rgba(0,166,81,0.25)",
          boxShadow: "inset 2px 2px 5px rgba(163,177,198,0.3), inset -2px -2px 5px rgba(255,255,255,0.8)",
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Daily Return ({bot.dailyPct}%)</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: bot.dailyPct >= 15 ? "#0284c7" : "#00a651" }}>
            +${fmtFull(dailyReturn)} / day
          </span>
        </div>

        {/* Detail 3: Max Multiplier Limit */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "7px 11px", borderRadius: 10,
          background: "var(--bg2)",
          border: "1px solid rgba(255,255,255,0.6)",
          boxShadow: "inset 2px 2px 5px rgba(163,177,198,0.35), inset -2px -2px 5px rgba(255,255,255,0.8)",
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Max Limit</span>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: bot.color }}>{bot.maxMultiplier}x (${fmtFull(maxAllowed)} max)</span>
        </div>

        {/* 3. Neumorphic Action Button */}
        <button
          onClick={() => onActivate(bot)}
          style={{
            marginTop: 3,
            width: "100%",
            height: 40,
            borderRadius: 11,
            border: "1px solid rgba(255,255,255,0.3)",
            background: "linear-gradient(135deg, #00a651 0%, #008742 100%)",
            color: "#ffffff",
            fontSize: 13.5,
            fontWeight: 800,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            boxShadow: "0 4px 14px rgba(0,166,81,0.32), -2px -2px 6px rgba(255,255,255,0.6)",
            transition: "all 0.15s ease",
          }}
          onMouseDown={e => (e.currentTarget.style.transform = "scale(0.98)")}
          onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
        >
          <span>Activate Bot · ${fmtFull(bot.investAmount)}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────── */
export default function Bots() {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(true);

  const [activeBot, setActiveBot] = useState<BotDef | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetClosing, setSheetClosing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [activeBotCount, setActiveBotCount] = useState(0);

  useEffect(() => {
    if (!user) { setBalance(0); setBalanceLoading(false); return; }
    const pRef = ref(db, `userPayments/${user.uid}`);
    const wRef = ref(db, `withdrawRequests/${user.uid}`);
    let dep = 0, with_ = 0;
    const u1 = onValue(pRef, snap => {
      dep = 0;
      snap.forEach(c => {
        const v = c.val();
        if (["completed","success","paid"].includes(String(v.status||"").toLowerCase()))
          dep += Number(v.amount)||0;
      });
      const cur = Math.max(0, dep - with_);
      setBalance(cur);
      setBalanceLoading(false);
      update(ref(db, `users/${user.uid}`), { balance: cur }).catch(() => {});
    });
    const u2 = onValue(wRef, snap => {
      with_ = 0;
      snap.forEach(c => {
        const v = c.val();
        if (!["failed","rejected","cancelled"].includes(String(v.status||"").toLowerCase()))
          with_ += Number(v.amount)||0;
      });
      const cur = Math.max(0, dep - with_);
      setBalance(cur);
      update(ref(db, `users/${user.uid}`), { balance: cur }).catch(() => {});
    });
    return () => { u1(); u2(); };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return onValue(ref(db, `userBots/${user.uid}`), snap => {
      setActiveBotCount(snap.exists() ? Object.keys(snap.val()).length : 0);
    });
  }, [user]);

  // Backfill debit record for any previously activated bots that lacked a deduction
  useEffect(() => {
    if (!user) return;
    const botsRef = ref(db, `userBots/${user.uid}`);
    const wRef = ref(db, `withdrawRequests/${user.uid}`);

    let botsData: Record<string, any> | null = null;
    let withData: Record<string, any> | null = null;
    let synced = false;

    const checkAndSync = () => {
      if (!botsData || synced) return;
      const existingDebits = Object.values(withData || {}).filter(
        (w: any) => w && w.type === "bot_activation"
      );

      Object.entries(botsData).forEach(async ([bKey, bVal]) => {
        if (!bVal || typeof bVal !== "object") return;
        const amt = Number(bVal.amount) || 0;
        if (amt <= 0) return;

        const alreadyDebited = existingDebits.some(
          (w: any) =>
            w.botKey === bKey ||
            (w.botId === bVal.bot &&
              Math.abs((Number(w.amount) || 0) - amt) < 0.01 &&
              Math.abs((Number(w.createdAt) || 0) - (Number(bVal.activatedAt) || 0)) < 120000)
        );

        if (!alreadyDebited) {
          try {
            const debitRef = push(ref(db, `withdrawRequests/${user.uid}`));
            await set(debitRef, {
              amount: amt,
              currency: "USD",
              type: "bot_activation",
              botId: bVal.bot || "bot",
              botName: bVal.botName || "AI Bot",
              botKey: bKey,
              destination: `AI Fleet: ${bVal.botName || "AI Bot"}`,
              status: "completed",
              description: `Activated ${bVal.botName || "AI Bot"} ($${amt.toFixed(2)}) · ${bVal.dailyPct || 0}% Daily`,
              createdAt: Number(bVal.activatedAt) || Date.now(),
              processedAt: Number(bVal.activatedAt) || Date.now(),
            });

            // Also deduct from users/${user.uid}/balance in database
            const uRef = ref(db, `users/${user.uid}`);
            const uSnap = await get(uRef);
            if (uSnap.exists() && uSnap.val().balance !== undefined) {
              const cur = Number(uSnap.val().balance) || 0;
              await update(uRef, {
                balance: Math.max(0, parseFloat((cur - amt).toFixed(2))),
                updatedAt: Date.now(),
              });
            }
          } catch (err) {
            console.error("Backfill debit failed:", err);
          }
        }
      });
      synced = true;
    };

    const unsubBots = onValue(botsRef, snap => {
      botsData = snap.val();
      checkAndSync();
    }, { onlyOnce: true });

    const unsubWith = onValue(wRef, snap => {
      withData = snap.val();
      checkAndSync();
    }, { onlyOnce: true });

    return () => {
      unsubBots();
      unsubWith();
    };
  }, [user]);

  function openSheet(bot: BotDef) {
    setActiveBot(bot);
    setDone(false);
    setSheetOpen(true);
    setSheetClosing(false);
  }

  function closeSheet() {
    setSheetClosing(true);
    setTimeout(() => {
      setSheetOpen(false);
      setSheetClosing(false);
      setActiveBot(null);
      setDone(false);
    }, 280);
  }

  async function confirmInvest() {
    if (!activeBot || !user) return;
    if (balance < activeBot.investAmount) return;
    setSubmitting(true);
    try {
      const investAmt = Number(activeBot.investAmount) || 0;
      const dailyReturn = investAmt * (activeBot.dailyPct / 100);
      const botKey = push(ref(db, `userBots/${user.uid}`)).key!;

      // 1. Save bot record under userBots
      await set(ref(db, `userBots/${user.uid}/${botKey}`), {
        bot: activeBot.id,
        botName: activeBot.name,
        amount: investAmt,
        dailyPct: activeBot.dailyPct,
        dailyReturn: dailyReturn,
        activatedAt: Date.now(),
        status: "active",
      });

      // 2. Immediately record completed debit in withdrawRequests to deduct from user balance
      const debitRef = push(ref(db, `withdrawRequests/${user.uid}`));
      await set(debitRef, {
        amount: investAmt,
        currency: "USD",
        type: "bot_activation",
        botId: activeBot.id,
        botName: activeBot.name,
        botKey: botKey,
        destination: `AI Fleet: ${activeBot.name}`,
        status: "completed",
        description: `Activated ${activeBot.name} ($${investAmt.toFixed(2)}) · ${activeBot.dailyPct}% Daily`,
        createdAt: Date.now(),
        processedAt: Date.now(),
      });

      // 3. Directly deduct from users/${user.uid}/balance in database
      const userDbRef = ref(db, `users/${user.uid}`);
      const userSnap = await get(userDbRef);
      const curDbBal = userSnap.exists() && userSnap.val().balance !== undefined
        ? Number(userSnap.val().balance)
        : balance;
      const newBal = Math.max(0, parseFloat((curDbBal - investAmt).toFixed(2)));
      await update(userDbRef, {
        balance: newBal,
        updatedAt: Date.now(),
      });
      setBalance(newBal);

      // 4. Send transaction notification to userNotifications
      const notifRef = push(ref(db, `userNotifications/${user.uid}`));
      await set(notifRef, {
        type: "bot_activation",
        title: "AI Bot Activated",
        message: `You successfully activated ${activeBot.name} for $${investAmt.toFixed(2)} USD. $${investAmt.toFixed(2)} has been deducted from your wallet balance. Your bot is now generating ${activeBot.dailyPct}% daily returns ($${dailyReturn.toFixed(2)}/day).`,
        createdAt: Date.now(),
        read: false,
        meta: {
          amount: investAmt,
          currency: "USD",
          botName: activeBot.name,
          dailyReturn: dailyReturn,
          dailyPct: activeBot.dailyPct,
          reference: debitRef.key,
        },
      });

      setDone(true);
    } catch (e) {
      console.error("Failed to activate bot:", e);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <style>{css}</style>

      {activeBot && (
        <ConfirmSheet
          bot={activeBot}
          balance={balance}
          open={sheetOpen}
          closing={sheetClosing}
          onConfirm={confirmInvest}
          onClose={closeSheet}
          submitting={submitting}
          done={done}
        />
      )}

      <Shell>
        {/* Header */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#0ecb81", display: "inline-block", boxShadow: "0 0 8px #0ecb81" }} />
            <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Algorithmic Engine · {BOTS.length} Bots Active
            </span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text)", letterSpacing: "-0.02em" }}>
            AI Trading Bots 🤖
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
          <div
            style={{
              flex: 1, padding: "9px 0", borderRadius: 10, textAlign: "center",
              fontSize: 13, fontWeight: 800,
              background: "var(--bg1)",
              color: "var(--text)",
              boxShadow: "-3px -3px 8px rgba(255,255,255,0.95), 3px 3px 8px rgba(163,177,198,0.45)",
            }}
          >
            Explore Bots ({BOTS.length})
          </div>
          <Link
            to="/my-bots"
            style={{
              flex: 1, padding: "9px 0", borderRadius: 10, textAlign: "center",
              fontSize: 13, fontWeight: 700, textDecoration: "none",
              color: "var(--muted)",
              transition: "all 0.15s ease",
            }}
          >
            My Bots ({activeBotCount})
          </Link>
        </div>

        {/* Neumorphic Summary Card */}
        <div style={{
          borderRadius: 20,
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
          padding: "16px 18px",
          marginBottom: 16,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          boxShadow: "-6px -6px 14px rgba(255,255,255,0.85), 6px 8px 20px rgba(163,177,198,0.45)",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: -25, right: -25, width: 100, height: 100,
            borderRadius: "50%", background: "radial-gradient(circle,rgba(0,166,81,0.25),transparent 70%)",
            pointerEvents: "none",
          }} />
          <div>
            <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 3 }}>
              Wallet Balance
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.01em" }}>
              {balanceLoading ? "…" : `$${fmtFull(balance)}`}
            </div>
          </div>
          <Link to="/my-bots" style={{ textAlign: "right", textDecoration: "none" }}>
            <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 3 }}>
              Running Bots →
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: activeBotCount > 0 ? "#0ecb81" : "rgba(255,255,255,0.35)" }}>
              {activeBotCount}
            </div>
          </Link>
        </div>

        {/* Neumorphic Inset Info Banner */}
        <div style={{
          borderRadius: 14,
          padding: "10px 14px",
          marginBottom: 18,
          background: "var(--bg2)",
          border: "1px solid rgba(255,255,255,0.6)",
          boxShadow: "inset 2px 2px 5px rgba(163,177,198,0.3), inset -2px -2px 5px rgba(255,255,255,0.8)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "rgba(0,166,81,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            boxShadow: "-1px -1px 3px rgba(255,255,255,0.8), 1px 1px 3px rgba(163,177,198,0.4)"
          }}>
            <span style={{ fontSize: 13 }}>⚡</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.45 }}>
            Automated daily returns: <strong style={{ color: "#00a651" }}>12% daily</strong> (under $100) and <strong style={{ color: "#0284c7" }}>15% daily</strong> ($100 & above). Mining window: <strong style={{ color: "var(--text)" }}>1:00 PM – 2:00 PM daily</strong>.
          </div>
        </div>

        {/* Neumorphic Bot Cards List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {BOTS.map(bot => (
            <BotCard key={bot.id} bot={bot} onActivate={openSheet} />
          ))}
        </div>
      </Shell>
    </>
  );
}
