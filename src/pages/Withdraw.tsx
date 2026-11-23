import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { push, ref as dbRef, onValue, update } from "firebase/database";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/firebase";
import ecocashLogo   from "@/images/ecocash.png";
import onemoneyLogo  from "@/images/onemoney.png";
import telecashLogo  from "@/images/telecash.png";

type TabKey = "mobile" | "crypto";

interface Network {
  id: string;
  name: string;
  logo: string;
  color: string;
  bg: string;
  currency: string;
  minAmount: number;
  maxAmount: number;
  fee: string;
  hint?: string;
  network?: string;
  processingTime: string;
}

const ZW_NETWORKS: Network[] = [
  { id: "ecocash",  name: "EcoCash",  logo: ecocashLogo,                                                                                                      color: "#e31e24", bg: "rgba(227,30,36,0.10)",   currency: "USD", minAmount: 3,  maxAmount: 5000, fee: "8%", hint: "07X XXX XXXX", processingTime: "5–15 min" },
  { id: "onemoney", name: "OneMoney", logo: onemoneyLogo,                                                                                                      color: "#f7a800", bg: "rgba(247,168,0,0.10)",   currency: "USD", minAmount: 3,  maxAmount: 3000, fee: "8%", hint: "071 XXX XXXX", processingTime: "5–15 min" },
  { id: "innbucks", name: "InnBucks", logo: "https://innbucks.co.zw/wp-content/uploads/2022/03/Innbucks-logo.png",                                            color: "#1565c0", bg: "rgba(21,101,192,0.10)",  currency: "USD", minAmount: 3,  maxAmount: 2000, fee: "8%", hint: "077 XXX XXXX", processingTime: "5–30 min" },
  { id: "telecash", name: "TeleCash", logo: telecashLogo,                                                                                                      color: "#0057a8", bg: "rgba(0,87,168,0.10)",    currency: "USD", minAmount: 3,  maxAmount: 2000, fee: "8%", hint: "073 XXX XXXX", processingTime: "5–30 min" },
];

const CRYPTO_NETWORKS: Network[] = [
  { id: "usdt-trc20", name: "USDT",    network: "TRC20 · Tron",           logo: "https://assets.coingecko.com/coins/images/325/large/Tether.png",        color: "#26a17b", bg: "rgba(38,161,123,0.10)",  currency: "USDT", minAmount: 3,    maxAmount: 50000, fee: "8%", processingTime: "1–5 min"  },
  { id: "usdt-erc20", name: "USDT",    network: "ERC20 · Ethereum",        logo: "https://assets.coingecko.com/coins/images/325/large/Tether.png",        color: "#627EEA", bg: "rgba(98,126,234,0.10)", currency: "USDT", minAmount: 3,    maxAmount: 50000, fee: "8%", processingTime: "5–10 min" },
  { id: "bnb-bsc",   name: "BNB",      network: "BEP20 · BNB Smart Chain", logo: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png", color: "#F3BA2F", bg: "rgba(243,186,47,0.10)", currency: "BNB",  minAmount: 0.005, maxAmount: 1000,  fee: "8%", processingTime: "2–5 min"  },
  { id: "btc",       name: "Bitcoin",  network: "BTC Network",             logo: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",          color: "#F7931A", bg: "rgba(247,147,26,0.10)", currency: "BTC",  minAmount: 0.0001, maxAmount: 10, fee: "8%", processingTime: "10–30 min" },
];

// ─── Global styles ─────────────────────────────────────────────────────────────
const STYLES = `
  @keyframes sheetIn  { from { transform: translateY(100%); opacity: 0; }  to { transform: translateY(0);    opacity: 1; } }
  @keyframes sheetOut { from { transform: translateY(0);    opacity: 1; }  to { transform: translateY(100%); opacity: 0; } }
  @keyframes maskIn   { from { opacity: 0; }  to { opacity: 1; } }
  @keyframes maskOut  { from { opacity: 1; }  to { opacity: 0; } }
  @keyframes wdSpin   { to { transform: rotate(360deg); } }
`;

// ─── Validation helpers ───────────────────────────────────────────────────────
function validateZwPhone(raw: string): { ok: boolean; msg: string } {
  const digits = raw.replace(/[\s\-()]/g, "");
  if (!digits) return { ok: false, msg: "" };
  if (!/^\d+$/.test(digits))             return { ok: false, msg: "Numbers only, no letters." };
  if (digits.length < 9)                 return { ok: false, msg: "Number too short." };
  if (digits.length > 10)                return { ok: false, msg: "Number too long." };
  if (!digits.startsWith("07"))          return { ok: false, msg: "Must start with 07X (e.g. 077…)." };
  return { ok: true, msg: "" };
}

function validateCryptoAddr(addr: string, networkId: string): { ok: boolean; msg: string } {
  const a = addr.trim();
  if (!a) return { ok: false, msg: "" };
  if (networkId === "usdt-trc20") {
    if (!a.startsWith("T"))             return { ok: false, msg: "TRC20 address must start with 'T'." };
    if (a.length !== 34)                return { ok: false, msg: `TRC20 must be 34 characters (got ${a.length}).` };
    if (!/^[A-Za-z0-9]+$/.test(a))     return { ok: false, msg: "Invalid characters in TRC20 address." };
    return { ok: true, msg: "" };
  }
  if (networkId === "usdt-erc20") {
    if (!a.startsWith("0x"))            return { ok: false, msg: "ERC20 address must start with '0x'." };
    if (a.length !== 42)                return { ok: false, msg: `ERC20 must be 42 characters (got ${a.length}).` };
    if (!/^0x[0-9a-fA-F]+$/.test(a))   return { ok: false, msg: "Invalid hex characters in ERC20 address." };
    return { ok: true, msg: "" };
  }
  if (networkId === "bnb-bsc") {
    if (!a.startsWith("0x"))            return { ok: false, msg: "BEP20 address must start with '0x'." };
    if (a.length !== 42)                return { ok: false, msg: `BEP20 must be 42 characters (got ${a.length}).` };
    if (!/^0x[0-9a-fA-F]+$/.test(a))   return { ok: false, msg: "Invalid hex characters in BEP20 address." };
    return { ok: true, msg: "" };
  }
  if (networkId === "btc") {
    if (!/^(1|3|bc1)[A-Za-z0-9]+$/.test(a)) return { ok: false, msg: "Invalid BTC address (must start with 1, 3, or bc1)." };
    if (a.length < 25 || a.length > 62)      return { ok: false, msg: `BTC address length invalid (${a.length} chars).` };
    return { ok: true, msg: "" };
  }
  return { ok: a.length > 10, msg: a.length > 10 ? "" : "Address too short." };
}

// ─── Inline field status indicator ───────────────────────────────────────────
function FieldStatus({ ok, msg, dirty }: { ok: boolean; msg: string; dirty: boolean }) {
  if (!dirty) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5 }}>
      {ok ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0ecb81" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f6465d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      )}
      <span style={{ fontSize: 11, fontWeight: 600, color: ok ? "#0ecb81" : "#f6465d" }}>
        {ok ? "Looks good!" : msg || "Invalid format."}
      </span>
    </div>
  );
}

// ─── Bottom Sheet ──────────────────────────────────────────────────────────────
function BottomSheet({
  open,
  onClose,
  title,
  children,
  peek = "auto",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  peek?: string | number;
}) {
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const DURATION = 300; // ms

  useEffect(() => {
    if (open) {
      setClosing(false);
      setMounted(true);
    }
  }, [open]);

  function handleClose() {
    setClosing(true);
    setTimeout(() => {
      setMounted(false);
      setClosing(false);
      onClose();
    }, DURATION);
  }

  useEffect(() => {
    if (!open && mounted && !closing) handleClose();
  }, [open]);

  if (!mounted) return null;

  return (
    <>
      <style>{STYLES}</style>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(5px)",
          animation: `${closing ? "maskOut" : "maskIn"} ${DURATION}ms cubic-bezier(0.4,0,0.2,1) both`,
        }}
      />
      {/* Centering wrapper */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1001,
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            maxWidth: 520,
            pointerEvents: "all",
            background: "var(--bg1)",
            borderRadius: "22px 22px 0 0",
            border: "1px solid rgba(255,255,255,0.55)",
            boxShadow: "0 -12px 50px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.1)",
            animation: `${closing ? "sheetOut" : "sheetIn"} ${DURATION}ms cubic-bezier(0.34,1.1,0.64,1) both`,
            maxHeight: typeof peek === "number" ? `${peek}px` : peek,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Handle */}
          <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px", flexShrink: 0 }}>
            <div style={{ width: 32, height: 3.5, borderRadius: 999, background: "rgba(0,0,0,0.13)" }} />
          </div>
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "4px 16px 10px",
              flexShrink: 0,
              borderBottom: "1px solid var(--stroke)",
            }}
          >
            <span style={{ fontWeight: 800, fontSize: 14, color: "var(--text)", letterSpacing: "-0.01em" }}>{title}</span>
            <button
              onClick={handleClose}
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                border: "none",
                cursor: "pointer",
                background: "var(--bg2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 24px" }}>{children}</div>
        </div>
      </div>
    </>
  );
}

// ─── Shared helpers ────────────────────────────────────────────────────────────
function NetLogo({ net, size = 36 }: { net: Network; size?: number }) {
  const [err, setErr] = useState(false);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.26,
        background: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0 2px 8px ${net.color}30`,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {!err ? (
        <img
          src={net.logo}
          alt={net.name}
          width={size - 6}
          height={size - 6}
          style={{ objectFit: "contain" }}
          onError={() => setErr(true)}
        />
      ) : (
        <span style={{ fontWeight: 900, fontSize: size * 0.38, color: net.color }}>{net.name.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

function ZwFlag({ size = 14 }: { size?: number }) {
  return (
    <img
      src="https://flagcdn.com/w40/zw.png"
      width={Math.round(size * 1.5)}
      height={size}
      alt="ZW"
      style={{ borderRadius: 2, objectFit: "cover", display: "block", flexShrink: 0 }}
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

// ─── Network Dropdown Trigger ──────────────────────────────────────────────────
function NetworkDropdown({
  selected,
  placeholder,
  onClick,
}: {
  selected: Network | null;
  placeholder: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: "11px 14px",
        borderRadius: 12,
        border: "1.5px solid var(--stroke)",
        background: "var(--bg2)",
        cursor: "pointer",
        textAlign: "left",
        transition: "border-color 0.2s",
        boxShadow: selected ? "-3px -3px 7px rgba(255,255,255,0.9), 3px 3px 7px rgba(163,177,198,0.4)" : "none",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#2563eb")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--stroke)")}
    >
      {selected ? (
        <>
          <NetLogo net={selected} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", lineHeight: 1.2 }}>
              {selected.name}
              {selected.network && (
                <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500, marginLeft: 5 }}>
                  {selected.network}
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>
              Min {selected.minAmount} {selected.currency} · Fee {selected.fee}
            </div>
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: "var(--stroke)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
          <span style={{ flex: 1, fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>{placeholder}</span>
        </>
      )}
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );
}

// ─── Sheet 1: Network Selector ─────────────────────────────────────────────────
function NetworkSelectorSheet({
  open,
  onClose,
  networks,
  onSelect,
  tabKey,
}: {
  open: boolean;
  onClose: () => void;
  networks: Network[];
  onSelect: (n: Network) => void;
  tabKey: TabKey;
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={tabKey === "mobile" ? "Select Mobile Network" : "Select Crypto Network"}
      peek={tabKey === "mobile" ? 400 : 440}
    >
      {tabKey === "mobile" && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 0 8px", borderBottom: "1px solid var(--stroke)", marginBottom: 6 }}>
          <ZwFlag size={13} />
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.06em" }}>ZIMBABWE MOBILE MONEY</span>
        </div>
      )}
      {networks.map((net, i) => (
        <button
          key={net.id}
          onClick={() => {
            onSelect(net);
            onClose();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            width: "100%",
            padding: "8px 10px",
            borderRadius: 11,
            border: "none",
            cursor: "pointer",
            background: "transparent",
            textAlign: "left",
            marginBottom: i < networks.length - 1 ? 2 : 0,
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = net.bg)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <NetLogo net={net} size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: "var(--text)", lineHeight: 1.2 }}>
              {net.name}
              {net.network && (
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted)", marginLeft: 5 }}>{net.network}</span>
              )}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 1 }}>
              Min {net.minAmount} {net.currency} · Fee {net.fee} · {net.processingTime}
            </div>
          </div>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      ))}
    </BottomSheet>
  );
}

// ─── Sheet 2: Review Withdrawal ────────────────────────────────────────────────
function ReviewSheet({
  open,
  onClose,
  net,
  amount,
  destination,
  tabKey,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  net: Network;
  amount: string;
  destination: string;
  tabKey: TabKey;
  onConfirm: () => void;
}) {
  const amt = parseFloat(amount) || 0;
  const feeAmt = net.fee.includes("%") ? (amt * parseFloat(net.fee)) / 100 : 0;
  const youGet = feeAmt > 0 ? (amt - feeAmt).toFixed(2) : `${amt} (${net.fee} deducted)`;

  const rows = [
    { label: "Network", value: net.name + (net.network ? ` · ${net.network}` : "") },
    { label: tabKey === "mobile" ? "To Phone" : "To Address", value: destination, mono: tabKey === "crypto" },
    { label: "Withdrawal Amt", value: `${amt.toFixed(2)} ${net.currency}` },
    { label: "Fee", value: net.fee },
    { label: "You Receive", value: `${youGet} ${net.currency}` },
    { label: "Processing", value: net.processingTime },
  ];

  return (
    <BottomSheet open={open} onClose={onClose} title="Review Withdrawal" peek={480}>
      {/* Hero */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 11px",
          borderRadius: 11,
          background: net.bg,
          border: `1px solid ${net.color}25`,
          marginBottom: 10,
        }}
      >
        <NetLogo net={net} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: "var(--text)" }}>{net.name}</div>
          {net.network && <div style={{ fontSize: 10, color: "var(--muted)" }}>{net.network}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: net.color }}>{amt.toFixed(2)}</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)" }}>{net.currency}</div>
        </div>
      </div>

      {/* Warning */}
      <div
        style={{
          padding: "6px 9px",
          borderRadius: 8,
          marginBottom: 8,
          background: "rgba(246,70,93,0.07)",
          border: "1px solid rgba(246,70,93,0.2)",
          display: "flex",
          gap: 6,
          alignItems: "center",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f6465d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span style={{ fontSize: 10.5, color: "#f6465d", fontWeight: 600, lineHeight: 1.3 }}>
          Withdrawals are irreversible. Please double-check your {tabKey === "mobile" ? "phone number" : "wallet address"}.
        </span>
      </div>

      {/* Detail rows */}
      {rows.map((r) => (
        <div
          key={r.label}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "7px 0",
            borderBottom: "1px solid var(--stroke)",
          }}
        >
          <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500, flexShrink: 0 }}>{r.label}</span>
          <span
            style={{
              fontSize: r.mono ? 10.5 : 11.5,
              fontWeight: 700,
              color: "var(--text)",
              fontFamily: r.mono ? "monospace" : undefined,
              textAlign: "right",
              maxWidth: 210,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {r.value}
          </span>
        </div>
      ))}

      <button
        onClick={onConfirm}
        style={{
          width: "100%",
          marginTop: 12,
          padding: "11px",
          borderRadius: 11,
          border: "none",
          background: "#2563eb",
          color: "#fff",
          fontSize: 13,
          fontWeight: 800,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
        Confirm Withdrawal
      </button>
    </BottomSheet>
  );
}

// ─── Sheet 3: Final Confirm + Submit ───────────────────────────────────────────
function ConfirmSheet({
  open,
  onClose,
  net,
  amount,
  destination,
  accountName,
  tabKey,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  net: Network;
  amount: string;
  destination: string;
  accountName: string;
  tabKey: TabKey;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setError("");
    if (!user) {
      setError("You must be logged in.");
      return;
    }
    setSubmitting(true);
    try {
      const amt = parseFloat(amount) || 0;
      const feePct = net.fee.includes("%") ? parseFloat(net.fee) : 8;
      const feeAmt = !isNaN(feePct) ? (amt * feePct) / 100 : 0;
      await push(dbRef(db, `withdrawRequests/${user.uid}`), {
        network: net.id,
        networkName: net.name,
        amount: amt,
        currency: net.currency,
        destination: destination.trim(),
        accountName: accountName.trim(),
        type: tabKey,
        fee: net.fee,
        feeRate: net.fee,
        feeAmount: Math.round(feeAmt * 100) / 100,
        netAmount: Math.max(0, Math.round((amt - feeAmt) * 100) / 100),
        status: "pending",
        createdAt: Date.now(),
      });
      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Final Confirmation" peek={400}>
      {/* Summary */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "8px 10px",
          borderRadius: 10,
          background: "rgba(37,99,235,0.07)",
          border: "1px solid rgba(37,99,235,0.2)",
          marginBottom: 10,
        }}
      >
        <NetLogo net={net} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600 }}>Withdrawing via {net.name}</div>
          <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>
            {parseFloat(amount).toFixed(2)} {net.currency}
          </div>
        </div>
        <span style={{ padding: "2px 7px", borderRadius: 999, background: "rgba(37,99,235,0.12)", color: "#2563eb", fontSize: 9.5, fontWeight: 800 }}>
          PENDING
        </span>
      </div>

      {/* Account name confirmation */}
      <div style={{ marginBottom: 9 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>
          Account Holder Name
        </div>
        <div style={{ padding: "8px 11px", borderRadius: 8, background: "var(--bg2)", border: "1px solid var(--stroke)", fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
          {accountName || <span style={{ color: "var(--muted)", fontWeight: 400 }}>—</span>}
        </div>
      </div>

      {/* Destination */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>
          {tabKey === "mobile" ? "Phone Number" : "Wallet Address"}
        </div>
        <div
          style={{
            padding: "8px 11px",
            borderRadius: 8,
            background: "var(--bg2)",
            border: "1px solid var(--stroke)",
            fontSize: tabKey === "crypto" ? 10.5 : 12,
            fontWeight: 700,
            color: "var(--text)",
            fontFamily: tabKey === "crypto" ? "monospace" : undefined,
            wordBreak: "break-all",
          }}
        >
          {destination}
        </div>
      </div>

      {/* Disclaimer */}
      <div
        style={{
          padding: "7px 9px",
          borderRadius: 8,
          marginBottom: 10,
          background: "rgba(240,185,11,0.07)",
          border: "1px solid rgba(240,185,11,0.2)",
          fontSize: 10.5,
          color: "#f0b90b",
          fontWeight: 600,
          lineHeight: 1.4,
        }}
      >
        By submitting, you confirm all details are correct. Withdrawals cannot be reversed once processed.
      </div>

      {error && (
        <div style={{ padding: "7px 10px", borderRadius: 8, marginBottom: 8, background: "rgba(246,70,93,0.08)", border: "1px solid rgba(246,70,93,0.22)", color: "#f6465d", fontSize: 11, fontWeight: 600 }}>
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        style={{
          width: "100%",
          padding: "11px",
          borderRadius: 11,
          border: "none",
          background: submitting ? "rgba(37,99,235,0.5)" : "#2563eb",
          color: "#fff",
          fontSize: 13,
          fontWeight: 800,
          cursor: submitting ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        {submitting ? (
          <>
            <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "wdSpin 0.8s linear infinite" }} />
            Submitting…
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            Submit Request
          </>
        )}
      </button>
    </BottomSheet>
  );
}

// ─── Success Screen ────────────────────────────────────────────────────────────
function SuccessScreen({ onReset }: { onReset: () => void }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 18px" }}>
      <div
        style={{
          width: 62,
          height: 62,
          borderRadius: "50%",
          margin: "0 auto 14px",
          background: "rgba(37,99,235,0.10)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 0 28px rgba(37,99,235,0.18)",
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </div>
      <div style={{ fontWeight: 900, fontSize: 17, color: "var(--text)", marginBottom: 6 }}>Withdrawal Requested!</div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", maxWidth: 260, margin: "0 auto 22px", lineHeight: 1.5 }}>
        Your request has been submitted. Processing takes <strong>5–30 minutes</strong>. You'll receive funds once approved.
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <button
          onClick={onReset}
          style={{
            padding: "10px 18px",
            borderRadius: 10,
            border: "1.5px solid var(--stroke)",
            background: "transparent",
            color: "var(--text)",
            fontWeight: 700,
            fontSize: 12.5,
            cursor: "pointer",
          }}
        >
          New Withdrawal
        </button>
        <Link
          to="/payments"
          style={{
            padding: "10px 18px",
            borderRadius: 10,
            border: "none",
            background: "var(--accent)",
            color: "#fff",
            fontWeight: 700,
            fontSize: 12.5,
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          View History
        </Link>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Withdraw() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<TabKey>("mobile");
  const [selectedNet, setNet] = useState<Network | null>(null);
  const [amount, setAmount] = useState("");
  const [destination, setDest] = useState("");
  const [accountName, setName] = useState("");
  const [formError, setFormError] = useState("");

  const [sheet1, setSheet1] = useState(false);
  const [sheet2, setSheet2] = useState(false);
  const [sheet3, setSheet3] = useState(false);
  const [done, setDone] = useState(false);

  // Dirty flags for inline validation
  const [destDirty, setDestDirty] = useState(false);

  // Computed validation
  const destVal = tab === "mobile"
    ? validateZwPhone(destination)
    : selectedNet ? validateCryptoAddr(destination, selectedNet.id) : { ok: false, msg: "" };

  // Live balance
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      setBalance(null);
      return;
    }

    const pRef = dbRef(db, `userPayments/${user.uid}`);
    const wRef = dbRef(db, `withdrawRequests/${user.uid}`);

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
      update(dbRef(db, `users/${user.uid}`), { balance: bal }).catch(() => {});
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
      update(dbRef(db, `users/${user.uid}`), { balance: bal }).catch(() => {});
    });

    return () => {
      unsubP();
      unsubW();
    };
  }, [user]);

  function switchTab(t: TabKey) {
    setTab(t);
    setNet(null);
    setAmount("");
    setDest("");
    setName("");
    setFormError("");
    setDestDirty(false);
    setSheet1(false);
    setSheet2(false);
    setSheet3(false);
    setDone(false);
  }

  function reset() {
    setNet(null);
    setAmount("");
    setDest("");
    setName("");
    setFormError("");
    setDestDirty(false);
    setSheet1(false);
    setSheet2(false);
    setSheet3(false);
    setDone(false);
  }

  const nets = tab === "mobile" ? ZW_NETWORKS : CRYPTO_NETWORKS;

  const quickAmounts =
    tab === "mobile"
      ? [3, 10, 20, 50, 100]
      : selectedNet?.id === "btc"
      ? [0.0001, 0.0005, 0.001, 0.005]
      : selectedNet?.id === "bnb-bsc"
      ? [0.005, 0.01, 0.05, 0.1]
      : [3, 10, 20, 50, 100];

  function handleProceed() {
    setFormError("");
    if (!user) {
      navigate("/login");
      return;
    }
    if (!selectedNet) {
      setFormError("Please select a network.");
      return;
    }
    const amt = parseFloat(amount);
    if (!amt || amt < selectedNet.minAmount) {
      setFormError(`Minimum withdrawal is ${selectedNet.minAmount} ${selectedNet.currency}.`);
      return;
    }
    if (amt > selectedNet.maxAmount) {
      setFormError(`Maximum withdrawal is ${selectedNet.maxAmount} ${selectedNet.currency}.`);
      return;
    }
    if (balance !== null && amt > balance && tab === "mobile") {
      setFormError(`Insufficient balance. Available: $${balance.toFixed(2)} USD.`);
      return;
    }
    if (!destination.trim()) {
      setDestDirty(true);
      setFormError(tab === "mobile" ? "Please enter your phone number." : "Please enter your wallet address.");
      return;
    }
    setDestDirty(true);
    if (tab === "mobile") {
      const v = validateZwPhone(destination);
      if (!v.ok) { setFormError(v.msg || "Please enter a valid Zimbabwe phone number."); return; }
    } else {
      const v = validateCryptoAddr(destination, selectedNet.id);
      if (!v.ok) { setFormError(v.msg || "Please enter a valid wallet address."); return; }
    }
    if (!accountName.trim()) {
      setFormError("Please enter the account holder name.");
      return;
    }
    setSheet2(true);
  }

  if (done) {
    return (
      <Shell>
        <style>{STYLES}</style>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500, marginBottom: 2 }}>Funds</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>Withdraw</div>
        </div>
        <div
          style={{
            borderRadius: 20,
            background: "var(--bg1)",
            border: "1px solid rgba(255,255,255,0.4)",
            boxShadow: "-6px -6px 14px rgba(255,255,255,1), 6px 6px 14px rgba(163,177,198,0.6)",
          }}
        >
          <SuccessScreen onReset={reset} />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <style>{STYLES}</style>

      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500, marginBottom: 2 }}>Funds</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>Withdraw</div>
      </div>

      {/* Balance hint card */}
      <div
        style={{
          borderRadius: 16,
          padding: "14px 16px",
          marginBottom: 16,
          background: "linear-gradient(135deg, #1d4ed8 0%, #0284c7 100%)",
          boxShadow: "0 6px 24px rgba(29,78,216,0.26)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -30,
            right: -30,
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.07)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            fontSize: 10.5,
            color: "rgba(255,255,255,0.75)",
            fontWeight: 600,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            marginBottom: 2,
          }}
        >
          Available Balance
        </div>
        <div style={{ fontSize: 23, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>
          {balance !== null ? balance.toFixed(2) : "—"}
          <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginLeft: 6 }}>USD</span>
        </div>
        <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.7)", marginTop: 3 }}>
          Withdrawals processed manually · Min $3
        </div>
      </div>

      {/* Tab Switcher */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          background: "var(--bg2)",
          borderRadius: 14,
          padding: 3,
          marginBottom: 16,
          boxShadow: "inset -3px -3px 7px rgba(255,255,255,0.8), inset 3px 3px 7px rgba(163,177,198,0.4)",
        }}
      >
        {(
          [
            {
              key: "mobile" as TabKey,
              label: "Mobile Money",
              sub: "Zimbabwe Networks",
              icon: (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={tab === "mobile" ? "var(--accent)" : "var(--muted)"}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="5" y="2" width="14" height="20" rx="2" />
                  <line x1="12" y1="18" x2="12.01" y2="18" />
                </svg>
              ),
            },
            {
              key: "crypto" as TabKey,
              label: "Crypto",
              sub: "BTC · USDT · BNB",
              icon: (
                <img
                  src="https://bin.bnbstatic.com/static/images/common/logo.png"
                  alt="Binance"
                  width={18}
                  height={18}
                  style={{ objectFit: "contain", borderRadius: 4 }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png";
                  }}
                />
              ),
            },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            style={{
              padding: "9px 6px",
              borderRadius: 11,
              border: "none",
              cursor: "pointer",
              background: tab === t.key ? "var(--bg1)" : "transparent",
              boxShadow: tab === t.key ? "-4px -4px 10px rgba(255,255,255,1), 4px 4px 10px rgba(163,177,198,0.6)" : "none",
              transition: "all 0.25s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
            }}
          >
            {t.icon}
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: tab === t.key ? "var(--text)" : "var(--muted)", lineHeight: 1.1 }}>
                {t.label}
              </div>
              <div style={{ fontSize: 9.5, fontWeight: 600, color: tab === t.key ? "var(--accent)" : "var(--muted)", marginTop: 1 }}>
                {t.sub}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Form Card */}
      <div
        style={{
          borderRadius: 18,
          background: "var(--bg1)",
          border: "1px solid rgba(255,255,255,0.4)",
          boxShadow: "-6px -6px 14px rgba(255,255,255,1), 6px 6px 14px rgba(163,177,198,0.6)",
          padding: "16px",
        }}
      >
        {/* Network */}
        <div style={{ marginBottom: 13 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 10.5,
              fontWeight: 700,
              color: "var(--muted)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            {tab === "mobile" && <ZwFlag size={11} />}
            {tab === "mobile" ? "Mobile Network" : "Coin & Network"}
          </div>
          <NetworkDropdown
            selected={selectedNet}
            placeholder={tab === "mobile" ? "Choose withdrawal network" : "Choose crypto network"}
            onClick={() => setSheet1(true)}
          />
        </div>

        {/* Amount */}
        <div style={{ marginBottom: 13 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 10.5,
              fontWeight: 700,
              color: "var(--muted)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            <span>Withdrawal Amount {selectedNet ? `(${selectedNet.currency})` : ""}</span>
            {balance !== null && balance > 0 && tab === "mobile" && (
              <button
                type="button"
                onClick={() => setAmount(String(balance))}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#2563eb",
                  fontSize: 10.5,
                  fontWeight: 800,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                MAX: ${balance.toFixed(2)}
              </button>
            )}
          </div>
          <div style={{ position: "relative" }}>
            {tab === "mobile" && (
              <div
                style={{
                  position: "absolute",
                  left: 11,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: 15,
                  fontWeight: 900,
                  color: "#2563eb",
                  pointerEvents: "none",
                }}
              >
                $
              </div>
            )}
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={selectedNet ? `Min ${selectedNet.minAmount}` : "0.00"}
              min={selectedNet?.minAmount}
              max={selectedNet?.maxAmount}
              step={tab === "mobile" ? "0.01" : "0.0001"}
              style={{
                width: "100%",
                padding: `10px 11px 10px ${tab === "mobile" ? "26px" : "11px"}`,
                borderRadius: 9,
                border: "1.5px solid var(--stroke)",
                background: "var(--bg2)",
                fontSize: 16,
                fontWeight: 800,
                color: "var(--text)",
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#2563eb")}
              onBlur={(e) => (e.target.style.borderColor = "var(--stroke)")}
            />
          </div>
          <div style={{ display: "flex", gap: 5, marginTop: 7, flexWrap: "wrap" }}>
            {quickAmounts.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAmount(String(a))}
                style={{
                  padding: "3px 9px",
                  borderRadius: 999,
                  border: `1.5px solid ${amount === String(a) ? "#2563eb" : "var(--stroke)"}`,
                  background: amount === String(a) ? "rgba(37,99,235,0.08)" : "transparent",
                  color: amount === String(a) ? "#2563eb" : "var(--muted)",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {tab === "mobile" ? "$" : ""}
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Destination: phone or wallet */}
        <div style={{ marginBottom: 13 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 10.5,
              fontWeight: 700,
              color: "var(--muted)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            {tab === "mobile" && <ZwFlag size={11} />}
            {tab === "mobile" ? "Recipient Phone Number" : "Destination Wallet Address"}
          </div>
          {tab === "mobile" ? (
            <div>
              <div style={{
                display: "flex",
                border: `1.5px solid ${destDirty ? (destVal.ok ? "#0ecb81" : "#f6465d") : "var(--stroke)"}`,
                borderRadius: 9,
                overflow: "hidden",
                background: "var(--bg2)",
                transition: "border-color 0.2s",
              }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "0 10px",
                    background: "var(--bg2)",
                    borderRight: "1px solid var(--stroke)",
                    flexShrink: 0,
                  }}
                >
                  <ZwFlag size={13} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", whiteSpace: "nowrap" }}>+263</span>
                </div>
                <input
                  type="tel"
                  value={destination}
                  onChange={(e) => { setDest(e.target.value); setDestDirty(true); }}
                  placeholder={selectedNet?.hint || "07X XXX XXXX"}
                  maxLength={10}
                  style={{
                    flex: 1,
                    padding: "10px 11px",
                    border: "none",
                    background: "transparent",
                    fontSize: 16,
                    fontWeight: 600,
                    color: "var(--text)",
                    outline: "none",
                  }}
                  onBlur={() => setDestDirty(true)}
                />
              </div>
              <FieldStatus ok={destVal.ok} msg={destVal.msg} dirty={destDirty} />
            </div>
          ) : (
            <div>
              <input
                type="text"
                value={destination}
                onChange={(e) => { setDest(e.target.value); setDestDirty(true); }}
                placeholder={
                  selectedNet?.id === "usdt-trc20" ? "T... (34 chars, TRC20)" :
                  selectedNet?.id === "usdt-erc20" ? "0x... (42 chars, ERC20)" :
                  selectedNet?.id === "bnb-bsc"    ? "0x... (42 chars, BEP20)" :
                  selectedNet?.id === "btc"        ? "1... / 3... / bc1..." :
                  `Paste your ${selectedNet?.name ?? "crypto"} wallet address`
                }
                style={{
                  width: "100%",
                  padding: "10px 11px",
                  borderRadius: 9,
                  border: `1.5px solid ${destDirty ? (destVal.ok ? "#0ecb81" : "#f6465d") : "var(--stroke)"}`,
                  background: "var(--bg2)",
                  fontSize: 16,
                  fontWeight: 600,
                  color: "var(--text)",
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "monospace",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => (e.target.style.borderColor = destDirty ? (destVal.ok ? "#0ecb81" : "#f6465d") : "#f6465d")}
                onBlur={(e) => { setDestDirty(true); e.target.style.borderColor = destVal.ok ? "#0ecb81" : (destination ? "#f6465d" : "var(--stroke)"); }}
              />
              <FieldStatus ok={destVal.ok} msg={destVal.msg} dirty={destDirty} />
            </div>
          )}
        </div>

        {/* Account Holder Name */}
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: "var(--muted)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            {tab === "mobile" ? "Account Holder Name" : "Your Name"}
          </div>
          <input
            type="text"
            value={accountName}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name registered on your account"
            style={{
              width: "100%",
              padding: "10px 11px",
              borderRadius: 9,
              border: "1.5px solid var(--stroke)",
              background: "var(--bg2)",
              fontSize: 16,
              fontWeight: 600,
              color: "var(--text)",
              outline: "none",
              boxSizing: "border-box",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#2563eb")}
            onBlur={(e) => (e.target.style.borderColor = "var(--stroke)")}
          />
        </div>

        {/* Summary strip */}
        {selectedNet && amount && parseFloat(amount) >= selectedNet.minAmount && (
          <div
            style={{
              padding: "8px 11px",
              borderRadius: 9,
              marginBottom: 11,
              background: "rgba(37,99,235,0.06)",
              border: "1px solid rgba(37,99,235,0.18)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Withdrawing
              </div>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#2563eb" }}>
                {parseFloat(amount).toFixed(2)} {selectedNet.currency}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Fee</div>
              <div style={{ fontWeight: 800, fontSize: 12, color: "var(--text)" }}>{selectedNet.fee}</div>
            </div>
          </div>
        )}

        {formError && (
          <div
            style={{
              padding: "8px 11px",
              borderRadius: 8,
              marginBottom: 11,
              background: "rgba(246,70,93,0.08)",
              border: "1px solid rgba(246,70,93,0.22)",
              color: "#f6465d",
              fontSize: 11.5,
              fontWeight: 600,
            }}
          >
            {formError}
          </div>
        )}

        <button
          onClick={handleProceed}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: 11,
            border: "none",
            background: "#2563eb",
            color: "#fff",
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
          {user ? "Review Withdrawal" : "Sign In to Withdraw"}
        </button>
        {!user && (
          <div style={{ textAlign: "center", marginTop: 8, fontSize: 11.5, color: "var(--muted)" }}>
            <Link to="/login" style={{ color: "var(--accent)", fontWeight: 700 }}>
              Log in
            </Link>{" "}
            or{" "}
            <Link to="/register" style={{ color: "var(--accent)", fontWeight: 700 }}>
              register
            </Link>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: 14,
          padding: "10px 12px",
          borderRadius: 11,
          background: "rgba(0,0,0,0.03)",
          border: "1px solid var(--stroke)",
          display: "flex",
          alignItems: "flex-start",
          gap: 7,
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, marginTop: 1 }}
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div style={{ fontSize: 10.5, color: "var(--muted)", lineHeight: 1.45 }}>
          Withdrawals are processed manually within <strong>5–30 min</strong>. Need help?{" "}
          <Link to="/support" style={{ color: "var(--accent)", fontWeight: 700 }}>
            Help Center
          </Link>
        </div>
      </div>

      <div
        style={{
          textAlign: "center",
          marginTop: 14,
          paddingTop: 12,
          borderTop: "1px solid var(--stroke)",
          display: "flex",
          justifyContent: "center",
          gap: 18,
        }}
      >
        <Link to="/deposit" style={{ fontSize: 11.5, color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}>
          + Deposit
        </Link>
        <Link to="/payments" style={{ fontSize: 11.5, color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}>
          Transaction History →
        </Link>
      </div>

      {/* Sheets */}
      <NetworkSelectorSheet open={sheet1} onClose={() => setSheet1(false)} networks={nets} onSelect={(n) => setNet(n)} tabKey={tab} />
      {selectedNet && (
        <ReviewSheet
          open={sheet2}
          onClose={() => setSheet2(false)}
          net={selectedNet}
          amount={amount}
          destination={destination}
          tabKey={tab}
          onConfirm={() => {
            setSheet2(false);
            setSheet3(true);
          }}
        />
      )}
      {selectedNet && (
        <ConfirmSheet
          open={sheet3}
          onClose={() => setSheet3(false)}
          net={selectedNet}
          amount={amount}
          destination={destination}
          accountName={accountName}
          tabKey={tab}
          onDone={() => {
            setSheet3(false);
            setDone(true);
          }}
        />
      )}
    </Shell>
  );
}
