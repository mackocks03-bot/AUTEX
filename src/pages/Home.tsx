import { useEffect, useState, useRef } from "react";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import { ref, onValue, update } from "firebase/database";
import { db } from "@/firebase";

// ─── Crypto Data ──────────────────────────────────────────────────────────────
const COINS = [
  {
    id: "bitcoin",
    symbol: "BTC",
    name: "Bitcoin",
    color: "#F7931A",
    gradient: "linear-gradient(135deg, #c77700 0%, #944e00 50%, #572900 100%)",
    shadow: "0 10px 30px rgba(199, 119, 0, 0.35)",
    desc: "The original cryptocurrency & digital gold",
    img: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
  },
  {
    id: "ethereum",
    symbol: "ETH",
    name: "Ethereum",
    color: "#627EEA",
    gradient: "linear-gradient(135deg, #4338ca 0%, #2e2694 50%, #171350 100%)",
    shadow: "0 10px 30px rgba(67, 56, 202, 0.35)",
    desc: "Smart contracts & decentralized apps platform",
    img: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
  },
  {
    id: "binancecoin",
    symbol: "BNB",
    name: "BNB",
    color: "#F3BA2F",
    gradient: "linear-gradient(135deg, #b8860b 0%, #8a6400 50%, #523b00 100%)",
    shadow: "0 10px 30px rgba(184, 134, 11, 0.35)",
    desc: "Binance ecosystem token & gas for BNB Chain",
    img: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png",
  },
  {
    id: "solana",
    symbol: "SOL",
    name: "Solana",
    color: "#9945FF",
    gradient: "linear-gradient(135deg, #7c3aed 0%, #581c87 50%, #0d9488 100%)",
    shadow: "0 10px 30px rgba(124, 58, 237, 0.35)",
    desc: "High-speed blockchain for DeFi & NFTs",
    img: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
  },
  {
    id: "ripple",
    symbol: "XRP",
    name: "XRP",
    color: "#00AAE4",
    gradient: "linear-gradient(135deg, #0284c7 0%, #0369a1 50%, #082f49 100%)",
    shadow: "0 10px 30px rgba(2, 132, 199, 0.35)",
    desc: "Fast global payments & cross-border transfers",
    img: "https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png",
  },
  {
    id: "cardano",
    symbol: "ADA",
    name: "Cardano",
    color: "#0033AD",
    gradient: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 50%, #0f172a 100%)",
    shadow: "0 10px 30px rgba(29, 78, 216, 0.35)",
    desc: "Research-driven proof-of-stake blockchain",
    img: "https://assets.coingecko.com/coins/images/975/large/cardano.png",
  },
  {
    id: "dogecoin",
    symbol: "DOGE",
    name: "Dogecoin",
    color: "#C2A633",
    gradient: "linear-gradient(135deg, #b45309 0%, #78350f 50%, #451a03 100%)",
    shadow: "0 10px 30px rgba(180, 83, 9, 0.35)",
    desc: "The original meme coin, now a payment staple",
    img: "https://assets.coingecko.com/coins/images/5/large/dogecoin.png",
  },
  {
    id: "tron",
    symbol: "TRX",
    name: "TRON",
    color: "#EF0027",
    gradient: "linear-gradient(135deg, #dc2626 0%, #991b1b 50%, #450a0a 100%)",
    shadow: "0 10px 30px rgba(220, 38, 38, 0.35)",
    desc: "Decentralized entertainment & content platform",
    img: "https://assets.coingecko.com/coins/images/1094/large/tron-logo.png",
  },
];

// ─── Live Price Hook ──────────────────────────────────────────────────────────
function usePrices() {
  const [prices, setPrices] = useState<Record<string, { usd: number; usd_24h_change: number }>>({});
  useEffect(() => {
    const ids = COINS.map((c) => c.id).join(",");
    fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
    )
      .then((r) => r.json())
      .then((data) => setPrices(data))
      .catch(() => {});
  }, []);
  return prices;
}

// ─── Coin Slider ──────────────────────────────────────────────────────────────
function CoinSlider({ prices }: { prices: Record<string, { usd: number; usd_24h_change: number }> }) {
  const [active, setActive] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const restart = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setActive((p) => (p + 1) % COINS.length), 4000);
  };

  useEffect(() => {
    restart();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const coin = COINS[active];
  const price = prices[coin.id];

  return (
    <div style={{
      borderRadius: 22,
      background: coin.gradient,
      boxShadow: `0 14px 34px rgba(0,0,0,0.18), ${coin.shadow}`,
      border: "1px solid rgba(255,255,255,0.18)",
      padding: "20px 20px 16px",
      marginBottom: 20,
      position: "relative",
      overflow: "hidden",
      minHeight: 165,
      transition: "background 0.5s ease, box-shadow 0.5s ease",
    }}>
      {/* Ambient glass light flares */}
      <div style={{
        position: "absolute", top: -50, right: -50,
        width: 180, height: 180, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,255,255,0.22) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: -30, left: -30,
        width: 120, height: 120, borderRadius: "50%",
        background: "rgba(255,255,255,0.08)",
        filter: "blur(20px)",
        pointerEvents: "none",
      }} />

      {/* Top row */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14, position: "relative", zIndex: 1 }}>
        <img
          src={coin.img}
          alt={coin.name}
          width={52}
          height={52}
          style={{
            borderRadius: "50%",
            objectFit: "contain",
            background: "#ffffff",
            padding: 4,
            boxShadow: "0 6px 20px rgba(0,0,0,0.3)",
            flexShrink: 0,
          }}
          onError={(e) => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/52"; }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontWeight: 900, fontSize: 21, color: "#ffffff", letterSpacing: "-0.02em",
              textShadow: "0 2px 6px rgba(0,0,0,0.35)",
            }}>
              {coin.symbol}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999,
              background: "rgba(255,255,255,0.22)", color: "#ffffff",
              backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.25)",
              letterSpacing: "0.03em",
            }}>
              {coin.name}
            </span>
          </div>
          <p style={{
            margin: "4px 0 0", fontSize: 12, color: "rgba(255,255,255,0.85)", lineHeight: 1.4,
            textShadow: "0 1px 3px rgba(0,0,0,0.25)",
          }}>
            {coin.desc}
          </p>
        </div>
        {price ? (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{
              fontWeight: 900, fontSize: 18, color: "#ffffff", letterSpacing: "-0.01em",
              textShadow: "0 2px 8px rgba(0,0,0,0.35)",
            }}>
              ${price.usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{
              fontWeight: 800, fontSize: 11.5, marginTop: 4,
              display: "inline-flex", alignItems: "center", gap: 3,
              padding: "2px 8px", borderRadius: 999,
              background: price.usd_24h_change >= 0 ? "rgba(14,203,129,0.25)" : "rgba(246,70,93,0.3)",
              color: price.usd_24h_change >= 0 ? "#5efc82" : "#ff9aa7",
              border: `1px solid ${price.usd_24h_change >= 0 ? "rgba(94,252,130,0.35)" : "rgba(255,154,167,0.35)"}`,
              backdropFilter: "blur(4px)",
            }}>
              {price.usd_24h_change >= 0 ? "▲" : "▼"} {Math.abs(price.usd_24h_change).toFixed(2)}%
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "right", color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 600 }}>Loading…</div>
        )}
      </div>

      {/* Dot indicators */}
      <div style={{ display: "flex", gap: 6, justifyContent: "center", position: "relative", zIndex: 1 }}>
        {COINS.map((c, i) => (
          <button
            key={c.id}
            onClick={() => { setActive(i); restart(); }}
            style={{
              width: i === active ? 22 : 7,
              height: 6, borderRadius: 999, border: "none", padding: 0, cursor: "pointer",
              background: i === active ? "#ffffff" : "rgba(255,255,255,0.35)",
              boxShadow: i === active ? "0 0 10px rgba(255,255,255,0.9)" : "none",
              transition: "all 0.35s ease",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Quick Action Button ──────────────────────────────────────────────────────
function QuickAction({ icon, label, to }: { icon: React.ReactNode; label: string; to: string }) {
  return (
    <Link to={to} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, textDecoration: "none" }}>
      <div style={{
        width: 52, height: 52, borderRadius: 16,
        background: "var(--bg2)", border: "1px solid rgba(255,255,255,0.5)",
        boxShadow: "-4px -4px 10px rgba(255,255,255,0.9), 4px 4px 10px rgba(163,177,198,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--accent)", transition: "transform 0.15s ease",
      }}
        onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.08)")}
        onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
      >
        {icon}
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textAlign: "center", letterSpacing: "0.01em" }}>{label}</span>
    </Link>
  );
}

// ─── Coin Row in Market List ──────────────────────────────────────────────────
function CoinRow({ coin, price }: {
  coin: typeof COINS[0];
  price?: { usd: number; usd_24h_change: number };
}) {
  const up = price ? price.usd_24h_change >= 0 : null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "13px 16px",
      borderBottom: "1px solid var(--stroke)",
    }}>
      <img
        src={coin.img}
        alt={coin.symbol}
        width={38}
        height={38}
        style={{ borderRadius: "50%", objectFit: "contain", background: "#fff", padding: 3, boxShadow: `0 2px 10px ${coin.color}33`, flexShrink: 0 }}
        onError={(e) => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/38"; }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{coin.symbol}</div>
        <div style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{coin.name}</div>
      </div>
      {/* Mini sparkline */}
      <div style={{ width: 60, height: 32, flexShrink: 0 }}>
        <svg viewBox="0 0 60 32" width="60" height="32" style={{ overflow: "visible" }}>
          <polyline
            points={
              up === null
                ? "0,16 15,16 30,16 45,16 60,16"
                : up
                ? "0,28 10,22 20,18 30,14 40,10 50,6 60,4"
                : "0,4 10,8 20,12 30,16 40,20 50,24 60,28"
            }
            fill="none"
            stroke={up === null ? "#94a3b8" : up ? "#0ecb81" : "#f6465d"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div style={{ textAlign: "right", minWidth: 90, flexShrink: 0 }}>
        {price ? (
          <>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>
              ${price.usd >= 1000
                ? price.usd.toLocaleString("en-US", { maximumFractionDigits: 0 })
                : price.usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: up ? "#0ecb81" : "#f6465d" }}>
              {up ? "+" : ""}{price.usd_24h_change.toFixed(2)}%
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: "var(--muted)" }}>–</div>
        )}
      </div>
    </div>
  );
}

// ─── Home Balance Card ────────────────────────────────
function HomeBalanceCard({
  balance,
  hideBalance,
  toggleHide,
  btcPrice,
}: {
  balance: number | null;
  hideBalance: boolean;
  toggleHide: () => void;
  btcPrice?: number;
}) {
  const btcVal =
    balance !== null && btcPrice && btcPrice > 0
      ? (balance / btcPrice).toFixed(6)
      : "0.000000";

  return (
    <div
      style={{
        borderRadius: 20,
        background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
        color: "#ffffff",
        padding: "20px 18px 18px",
        marginBottom: 20,
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

      {/* Label + Eye Icon + Live Badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Total Balance
          </span>
          <button
            type="button"
            onClick={toggleHide}
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

        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          background: "rgba(0,166,81,0.15)", border: "1px solid rgba(0,166,81,0.3)",
          borderRadius: 999, padding: "2px 8px", fontSize: 10.5, fontWeight: 700, color: "#0ecb81",
        }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#0ecb81", display: "inline-block" }} />
          Live
        </div>
      </div>

      {/* Balance Display */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 28, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.02em" }}>
          {hideBalance ? "••••••" : balance !== null ? balance.toFixed(2) : "0.00"}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.75)" }}>USD</span>
      </div>

      {/* BTC Equivalent & 24h PnL */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: 500, fontFamily: "monospace" }}>
          {hideBalance ? "≈ •••••• BTC" : `≈ ${btcVal} BTC`}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>Today's PnL:</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#0ecb81" }}>+$0.00 (+0.00%)</span>
        </div>
      </div>

      {/* Quick Deposit & Withdraw Buttons */}
      <div style={{ display: "flex", gap: 10 }}>
        <Link
          to="/deposit"
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 12,
            background: "linear-gradient(135deg, #00a651, #008742)",
            color: "#ffffff",
            fontWeight: 700,
            fontSize: 13,
            textAlign: "center",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            boxShadow: "0 4px 14px rgba(0,166,81,0.35)",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
          Deposit
        </Link>
        <Link
          to="/withdraw"
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "#ffffff",
            fontWeight: 700,
            fontSize: 13,
            textAlign: "center",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
          Withdraw
        </Link>
        <Link
          to="/payments"
          title="Payment History"
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "rgba(255,255,255,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

// ─── Banner Announcement ──────────────────────────────────────────────────────
function Banner() {
  return (
    <div style={{
      borderRadius: 16,
      background: "linear-gradient(135deg, #00a651 0%, #008f45 60%, #005c2b 100%)",
      padding: "16px 20px",
      marginBottom: 20,
      display: "flex",
      alignItems: "center",
      gap: 14,
      boxShadow: "0 8px 32px rgba(0,166,81,0.2)",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: -30, right: -30, width: 120, height: 120,
        borderRadius: "50%", background: "rgba(255,255,255,0.08)", pointerEvents: "none",
      }} />
      <div style={{
        width: 44, height: 44, borderRadius: 14, flexShrink: 0,
        background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: 22 }}>🚀</span>
      </div>
      <div>
        <div style={{ fontWeight: 800, fontSize: 14, color: "#fff", letterSpacing: "-0.01em" }}>Start Trading Today</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>Deposit & get instant access to 100+ crypto markets</div>
      </div>
      <div style={{ marginLeft: "auto", flexShrink: 0 }}>
        <Link to="/deposit" style={{
          display: "block", padding: "8px 16px", borderRadius: 999, fontWeight: 700, fontSize: 12,
          background: "#fff", color: "#00a651", textDecoration: "none", whiteSpace: "nowrap",
        }}>
          Deposit →
        </Link>
      </div>
    </div>
  );
}

// ─── Home Page ────────────────────────────────────────────────────────────────
export default function Home() {
  const { user } = useAuth();
  const prices = usePrices();
  const [marketTab, setMarketTab] = useState<"all" | "gainers" | "losers">("all");
  const [balance, setBalance] = useState<number | null>(null);
  const [hideBalance, setHideBalance] = useState<boolean>(() => {
    return localStorage.getItem("binance_hide_balance") === "true";
  });

  const toggleHideBalance = () => {
    setHideBalance((prev) => {
      const next = !prev;
      localStorage.setItem("binance_hide_balance", String(next));
      return next;
    });
  };

  useEffect(() => {
    if (!user) {
      setBalance(0);
      return;
    }

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
      unsubP();
      unsubW();
    };
  }, [user]);

  const sortedCoins = [...COINS].sort((a, b) => {
    const pa = prices[a.id];
    const pb = prices[b.id];
    if (marketTab === "gainers") {
      return (pb?.usd_24h_change ?? 0) - (pa?.usd_24h_change ?? 0);
    }
    if (marketTab === "losers") {
      return (pa?.usd_24h_change ?? 0) - (pb?.usd_24h_change ?? 0);
    }
    return 0;
  });

  return (
    <Shell>
      {/* ── Greeting ── */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em", marginTop: 2 }}>
          {user ? `Welcome back 👋` : "Crypto Markets 📈"}
        </div>
      </div>

      {/* ── Binance Total Balance Card ── */}
      {user && (
        <HomeBalanceCard
          balance={balance}
          hideBalance={hideBalance}
          toggleHide={toggleHideBalance}
          btcPrice={prices.bitcoin?.usd}
        />
      )}

      {/* ── Coin Slider ── */}
      <CoinSlider prices={prices} />

      {/* ── Quick Actions ── */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8,
        marginBottom: 24,
      }}>
        <QuickAction
          to="/deposit"
          label="Deposit"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          }
        />
        <QuickAction
          to="/withdraw"
          label="Withdraw"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          }
        />
        <QuickAction
          to="/bots"
          label="AI Bots"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              <circle cx="12" cy="16" r="1" fill="currentColor" />
            </svg>
          }
        />
        <QuickAction
          to="/my-bots"
          label="My Bots"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <circle cx="12" cy="5" r="2" />
              <path d="M12 7v4" />
              <line x1="8" y1="16" x2="8" y2="16" strokeWidth="3" strokeLinecap="round" />
              <line x1="16" y1="16" x2="16" y2="16" strokeWidth="3" strokeLinecap="round" />
            </svg>
          }
        />
      </div>

      {/* ── Promotional Banner ── */}
      <Banner />

      {/* ── Market List ── */}
      <div style={{
        borderRadius: 20,
        background: "var(--bg1)",
        border: "1px solid rgba(255,255,255,0.4)",
        boxShadow: "-6px -6px 14px rgba(255,255,255,1), 6px 6px 14px rgba(163,177,198,0.6)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: "var(--text)" }}>Market</span>
          <div style={{ display: "flex", gap: 4 }}>
            {(["all", "gainers", "losers"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setMarketTab(tab)}
                style={{
                  padding: "5px 12px", borderRadius: 999, border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 700,
                  background: marketTab === tab ? "var(--accent)" : "transparent",
                  color: marketTab === tab ? "#fff" : "var(--muted)",
                  transition: "all 0.2s ease",
                }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Column labels */}
        <div style={{
          display: "flex", alignItems: "center", padding: "10px 16px 4px",
          fontSize: 11, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase",
        }}>
          <span style={{ flex: 1 }}>Name</span>
          <span style={{ width: 60, textAlign: "center" }}>7D</span>
          <span style={{ width: 90, textAlign: "right" }}>Price / 24h</span>
        </div>

        {/* Rows */}
        {sortedCoins.map((coin) => (
          <CoinRow key={coin.id} coin={coin} price={prices[coin.id]} />
        ))}

        {/* Footer */}
        <div style={{ padding: "14px 16px", textAlign: "center" }}>
          <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 700, cursor: "pointer" }}>
            View all markets →
          </span>
        </div>
      </div>

      {/* ── Learn Cards ── */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)", marginBottom: 12 }}>Learn & Explore</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          {[
            { emoji: "🔐", title: "What is DeFi?", sub: "Decentralized finance explained" },
            { emoji: "💎", title: "NFT Basics", sub: "Digital ownership on blockchain" },
            { emoji: "⛓️", title: "How Blockchain Works", sub: "The tech behind crypto" },
            { emoji: "📊", title: "Trading Strategies", sub: "Spot, futures & more" },
          ].map((item) => (
            <div
              key={item.title}
              style={{
                borderRadius: 16, padding: "16px 14px",
                background: "var(--bg1)",
                border: "1px solid rgba(255,255,255,0.4)",
                boxShadow: "-4px -4px 10px rgba(255,255,255,0.9), 4px 4px 10px rgba(163,177,198,0.5)",
                cursor: "pointer", transition: "transform 0.15s ease",
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
            >
              <div style={{ fontSize: 24, marginBottom: 8 }}>{item.emoji}</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", marginBottom: 3 }}>{item.title}</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>{item.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}
