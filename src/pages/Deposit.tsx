import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { push, ref as dbRef, onValue } from "firebase/database";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/firebase";
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
  hint?: string;
  network?: string;
  confirmations?: number;
  accountName: string;
  accountNo: string;
}

const DEFAULT_ZW_NETWORKS: Network[] = [
  { id: "ecocash",   name: "EcoCash",  logo: ecocashLogo,                                                                                                      color: "#e31e24", bg: "rgba(227,30,36,0.10)",   currency: "USD", minAmount: 10, hint: "07X XXX XXXX", accountName: "AUTEX PAYMENTS", accountNo: "0771000001" },
  { id: "onemoney",  name: "OneMoney", logo: onemoneyLogo,                                                                                                     color: "#f7a800", bg: "rgba(247,168,0,0.10)",   currency: "USD", minAmount: 10, hint: "071 XXX XXXX", accountName: "AUTEX PAYMENTS", accountNo: "0712000001" },
  { id: "innbucks",  name: "InnBucks", logo: "https://innbucks.co.zw/wp-content/uploads/2022/03/Innbucks-logo.png",                                            color: "#1565c0", bg: "rgba(21,101,192,0.10)",  currency: "USD", minAmount: 10, hint: "077 XXX XXXX", accountName: "AUTEX PAYMENTS", accountNo: "0773000001" },
  { id: "telecash",  name: "TeleCash", logo: telecashLogo,                                                                                                     color: "#0057a8", bg: "rgba(0,87,168,0.10)",    currency: "USD", minAmount: 10, hint: "073 XXX XXXX", accountName: "AUTEX PAYMENTS", accountNo: "0732000001" },
];

const DEFAULT_CRYPTO_NETWORKS: Network[] = [
  { id: "usdt-trc20", name: "USDT",    network: "TRC20 · Tron",           logo: "https://assets.coingecko.com/coins/images/325/large/Tether.png",           color: "#26a17b", bg: "rgba(38,161,123,0.10)",  currency: "USDT", minAmount: 10,     confirmations: 1,  accountName: "AUTEX CRYPTO WALLET", accountNo: "TYour_USDT_TRC20_Address_Here" },
  { id: "usdt-erc20", name: "USDT",    network: "ERC20 · Ethereum",        logo: "https://assets.coingecko.com/coins/images/325/large/Tether.png",           color: "#627EEA", bg: "rgba(98,126,234,0.10)", currency: "USDT", minAmount: 10,     confirmations: 6,  accountName: "AUTEX CRYPTO WALLET", accountNo: "0xYour_ERC20_Address" },
  { id: "bnb-bsc",    name: "BNB",     network: "BEP20 · BNB Smart Chain", logo: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png",    color: "#F3BA2F", bg: "rgba(243,186,47,0.10)", currency: "BNB",  minAmount: 10,     confirmations: 15, accountName: "AUTEX CRYPTO WALLET", accountNo: "0xYour_BNB_Address" },
  { id: "btc",        name: "Bitcoin", network: "BTC Network",             logo: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",             color: "#F7931A", bg: "rgba(247,147,26,0.10)", currency: "BTC",  minAmount: 10,     confirmations: 3,  accountName: "AUTEX CRYPTO WALLET", accountNo: "bc1YourBitcoinAddress" },
];

// ─── Global sheet animation styles ───────────────────────────────────────────
const SHEET_STYLES = `
  @keyframes sheetIn  { from { transform: translateY(100%); opacity: 0; }  to { transform: translateY(0);    opacity: 1; } }
  @keyframes sheetOut { from { transform: translateY(0);    opacity: 1; }  to { transform: translateY(100%); opacity: 0; } }
  @keyframes maskIn   { from { opacity: 0; }  to { opacity: 1; } }
  @keyframes maskOut  { from { opacity: 1; }  to { opacity: 0; } }
  @keyframes depSpin  { to { transform: rotate(360deg); } }
`;

// ─── Animated Bottom Sheet ────────────────────────────────────────────────────
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
  const DURATION = 320; // ms

  // mount on open
  useEffect(() => {
    if (open) { setClosing(false); setMounted(true); }
  }, [open]);

  function handleClose() {
    setClosing(true);
    setTimeout(() => { setMounted(false); setClosing(false); onClose(); }, DURATION);
  }

  // close when backdrop clicked
  useEffect(() => {
    if (!open && mounted && !closing) handleClose();
  }, [open]);

  if (!mounted) return null;

  return (
    <>
      <style>{SHEET_STYLES}</style>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(5px)",
          animation: `${closing ? "maskOut" : "maskIn"} ${DURATION}ms cubic-bezier(0.4,0,0.2,1) both`,
        }}
      />
      {/* Centering wrapper — keeps the sheet horizontally centred regardless of animation */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1001,
        display: "flex", justifyContent: "center", pointerEvents: "none",
      }}>
      {/* Sheet */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 520,
          pointerEvents: "all",
          background: "var(--bg1)",
          borderRadius: "22px 22px 0 0",
          border: "1px solid rgba(255,255,255,0.55)",
          boxShadow: "0 -12px 50px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.1)",
          animation: `${closing ? "sheetOut" : "sheetIn"} ${DURATION}ms cubic-bezier(0.34,1.1,0.64,1) both`,
          maxHeight: typeof peek === "number" ? `${peek}px` : peek,
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px", flexShrink: 0 }}>
          <div style={{ width: 32, height: 3.5, borderRadius: 999, background: "rgba(0,0,0,0.13)" }} />
        </div>
        {/* Title row */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "4px 16px 10px", flexShrink: 0,
          borderBottom: "1px solid var(--stroke)",
        }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: "var(--text)", letterSpacing: "-0.01em" }}>{title}</span>
          <button onClick={handleClose} style={{
            width: 26, height: 26, borderRadius: "50%", border: "none", cursor: "pointer",
            background: "var(--bg2)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 24px" }}>
          {children}
        </div>
      </div>
      </div>
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function NetLogo({ net, size = 36 }: { net: Network; size?: number }) {
  const [err, setErr] = useState(false);
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.26,
      background: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: `0 2px 8px ${net.color}30`, overflow: "hidden", flexShrink: 0,
    }}>
      {!err
        ? <img src={net.logo} alt={net.name} width={size - 6} height={size - 6} style={{ objectFit: "contain" }} onError={() => setErr(true)} />
        : <span style={{ fontWeight: 900, fontSize: size * 0.38, color: net.color }}>{net.name.slice(0, 2).toUpperCase()}</span>
      }
    </div>
  );
}

function ZwFlag({ size = 16 }: { size?: number }) {
  return (
    <img src="https://flagcdn.com/w40/zw.png" width={Math.round(size * 1.5)} height={size}
      alt="ZW" style={{ borderRadius: 2, objectFit: "cover", display: "block", flexShrink: 0 }}
      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
    />
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }
  return (
    <button onClick={copy} style={{
      padding: "3px 10px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700,
      background: copied ? "rgba(14,203,129,0.14)" : "rgba(0,166,81,0.12)",
      color: copied ? "#0ecb81" : "var(--accent)", transition: "all 0.2s",
      display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
    }}>
      {copied
        ? <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Copied</>
        : <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy</>
      }
    </button>
  );
}

// ─── Sheet 1: Network Selector ────────────────────────────────────────────────
function NetworkSelectorSheet({ open, onClose, networks, onSelect, tabKey }: {
  open: boolean; onClose: () => void; networks: Network[];
  onSelect: (n: Network) => void; tabKey: TabKey;
}) {
  return (
    <BottomSheet open={open} onClose={onClose}
      title={tabKey === "mobile" ? "Select Mobile Network" : "Select Crypto Network"}
      peek={tabKey === "mobile" ? 420 : 460}
    >
      {tabKey === "mobile" && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 0 10px", borderBottom: "1px solid var(--stroke)", marginBottom: 8 }}>
          <ZwFlag size={14} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.05em" }}>ZIMBABWE MOBILE MONEY</span>
        </div>
      )}
      {networks.map((net, i) => (
        <button key={net.id} onClick={() => { onSelect(net); onClose(); }}
          style={{
            display: "flex", alignItems: "center", gap: 12, width: "100%",
            padding: "10px 10px", borderRadius: 12, border: "none", cursor: "pointer",
            background: "transparent", textAlign: "left",
            marginBottom: i < networks.length - 1 ? 2 : 0, transition: "background 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = net.bg)}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          <NetLogo net={net} size={42} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)", lineHeight: 1.2 }}>{net.name}</div>
            {net.network && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>{net.network}</div>}
            <div style={{ fontSize: 11, color: net.color, fontWeight: 700, marginTop: 1 }}>Min {net.minAmount} {net.currency}</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      ))}
    </BottomSheet>
  );
}

// ─── Sheet 2: Payment Details ─────────────────────────────────────────────────
function PaymentDetailsSheet({ open, onClose, net, amount, phone, tabKey, onConfirm }: {
  open: boolean; onClose: () => void;
  net: Network; amount: string; phone: string; tabKey: TabKey;
  onConfirm: () => void;
}) {
  const rows = [
    { label: "Account Name", value: net.accountName, copy: true },
    { label: tabKey === "mobile" ? "Number" : "Address", value: net.accountNo, copy: true, mono: true },
    { label: "Amount", value: `${parseFloat(amount).toFixed(tabKey === "mobile" ? 2 : 6)} ${net.currency}`, copy: true },
    ...(tabKey === "mobile" ? [{ label: "Your Phone", value: phone, copy: false }] : []),
    ...(net.confirmations ? [{ label: "Confirmations", value: `${net.confirmations} required`, copy: false }] : []),
    { label: "Fee", value: "Free", copy: false },
  ];

  return (
    <BottomSheet open={open} onClose={onClose} title="Payment Details" peek={520}>
      {/* Network hero — compact */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
        borderRadius: 12, background: net.bg, border: `1px solid ${net.color}25`, marginBottom: 10,
      }}>
        <NetLogo net={net} size={40} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)", lineHeight: 1.2 }}>{net.name}</div>
          {net.network && <div style={{ fontSize: 11, color: "var(--muted)" }}>{net.network}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: net.color, lineHeight: 1 }}>{parseFloat(amount).toFixed(2)}</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)" }}>{net.currency}</div>
        </div>
      </div>

      {/* Warning — compact */}
      <div style={{
        padding: "7px 10px", borderRadius: 9, marginBottom: 10,
        background: "rgba(240,185,11,0.08)", border: "1px solid rgba(240,185,11,0.22)",
        display: "flex", gap: 7, alignItems: "center",
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f0b90b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span style={{ fontSize: 11, color: "#f0b90b", fontWeight: 600, lineHeight: 1.4 }}>
          Send exactly the amount shown and keep your receipt screenshot.
        </span>
      </div>

      {/* Detail rows — compact */}
      {rows.map(r => (
        <div key={r.label} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          padding: "9px 0", borderBottom: "1px solid var(--stroke)",
        }}>
          <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500, flexShrink: 0 }}>{r.label}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
            <span style={{
              fontSize: r.mono ? 11 : 12, fontWeight: 700, color: "var(--text)",
              fontFamily: r.mono ? "monospace" : undefined,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              maxWidth: r.mono ? 130 : undefined,
            }}>{r.value}</span>
            {r.copy && <CopyBtn text={r.value} />}
          </div>
        </div>
      ))}

      {/* CTA */}
      <button onClick={onConfirm} style={{
        width: "100%", marginTop: 14, padding: "13px", borderRadius: 12, border: "none",
        background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 800,
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
        I've Sent the Payment
      </button>
    </BottomSheet>
  );
}

// ─── Sheet 3: Proof Upload ────────────────────────────────────────────────────
function ProofUploadSheet({ open, onClose, net, amount, phone, tabKey, onDone }: {
  open: boolean; onClose: () => void;
  net: Network; amount: string; phone: string; tabKey: TabKey;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [senderName, setSenderName] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | null) {
    if (!file) return;
    setProofFile(file);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    setError("");
    if (!senderName.trim()) { setError("Please enter your sender name."); return; }
    if (!proofFile)         { setError("Please upload your payment screenshot."); return; }
    if (!user)              { setError("You must be logged in."); return; }
    setSubmitting(true);
    try {
      const ext = proofFile.name.split(".").pop() || "jpg";
      const sRef = storageRef(storage, `paymentProofs/${user.uid}/${Date.now()}.${ext}`);
      await uploadBytes(sRef, proofFile);
      const proofUrl = await getDownloadURL(sRef);
      await push(dbRef(db, `userPayments/${user.uid}`), {
        network: net.id,
        networkName: net.name,
        amount: parseFloat(amount),
        currency: net.currency,
        phone: tabKey === "mobile" ? phone : null,
        senderName: senderName.trim(),
        accountNo: net.accountNo,
        accountName: net.accountName,
        proofUrl,
        status: "pending",
        type: "deposit",
        depositType: tabKey,
        createdAt: Date.now(),
      });
      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Confirm Payment" peek={560}>
      {/* Summary strip — compact */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
        borderRadius: 11, background: net.bg, border: `1px solid ${net.color}22`, marginBottom: 12,
      }}>
        <NetLogo net={net} size={34} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, lineHeight: 1 }}>Sending via {net.name}</div>
          <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)", marginTop: 2 }}>
            {parseFloat(amount).toFixed(2)} {net.currency}
          </div>
        </div>
        <span style={{ padding: "3px 9px", borderRadius: 999, background: "rgba(240,185,11,0.14)", color: "#f0b90b", fontSize: 10, fontWeight: 800 }}>
          PENDING
        </span>
      </div>

      {/* Sender Name */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
          Sender Name *
        </label>
        <input
          type="text" value={senderName}
          onChange={e => setSenderName(e.target.value)}
          placeholder="Your name on the account"
          style={{
            width: "100%", padding: "11px 12px", borderRadius: 10,
            border: "1.5px solid var(--stroke)", background: "var(--bg2)",
            fontSize: 16, fontWeight: 600, color: "var(--text)", outline: "none",
            boxSizing: "border-box", transition: "border-color 0.2s",
          }}
          onFocus={e => (e.target.style.borderColor = "var(--accent)")}
          onBlur={e => (e.target.style.borderColor = "var(--stroke)")}
        />
      </div>

      {/* File Upload */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
          Payment Screenshot *
        </label>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={e => handleFile(e.target.files?.[0] ?? null)} />

        {preview ? (
          <div style={{ position: "relative", borderRadius: 11, overflow: "hidden", border: `1.5px solid var(--accent)`, height: 120 }}>
            <img src={preview} alt="Proof" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            <button onClick={() => { setProofFile(null); setPreview(null); }}
              style={{
                position: "absolute", top: 6, right: 6, width: 24, height: 24,
                borderRadius: "50%", background: "rgba(0,0,0,0.65)", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              background: "linear-gradient(transparent, rgba(0,0,0,0.65))",
              padding: "10px 10px 7px", fontSize: 10, fontWeight: 700, color: "#fff",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{proofFile?.name}</div>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()}
            style={{
              width: "100%", padding: "18px 16px", borderRadius: 11,
              border: "2px dashed var(--stroke)", background: "var(--bg2)",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
              transition: "all 0.18s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "rgba(0,166,81,0.04)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--stroke)"; e.currentTarget.style.background = "var(--bg2)"; }}
          >
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(0,166,81,0.09)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>Upload Screenshot</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>Tap to pick an image from your device</div>
            </div>
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: "9px 12px", borderRadius: 9, marginBottom: 10,
          background: "rgba(246,70,93,0.08)", border: "1px solid rgba(246,70,93,0.22)",
          color: "#f6465d", fontSize: 12, fontWeight: 600,
        }}>{error}</div>
      )}

      {/* Submit */}
      <button onClick={handleSubmit} disabled={submitting} style={{
        width: "100%", padding: "13px", borderRadius: 12, border: "none",
        background: submitting ? "rgba(0,166,81,0.5)" : "var(--accent)",
        color: "#fff", fontSize: 14, fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
      }}>
        {submitting ? (
          <><div style={{ width: 15, height: 15, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "depSpin 0.8s linear infinite" }} />Submitting…</>
        ) : (
          <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Submit Payment</>
        )}
      </button>
      <p style={{ fontSize: 10, color: "var(--muted)", textAlign: "center", marginTop: 8, lineHeight: 1.5 }}>
        Verified within 5–30 min. You'll be notified on approval.
      </p>
    </BottomSheet>
  );
}

// ─── Network Dropdown Trigger ─────────────────────────────────────────────────
function NetworkDropdown({ selected, placeholder, onClick }: {
  selected: Network | null; placeholder: string; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} style={{
      width: "100%", display: "flex", alignItems: "center", gap: 11,
      padding: "12px 14px", borderRadius: 12, border: "1.5px solid var(--stroke)",
      background: "var(--bg2)", cursor: "pointer", textAlign: "left",
      transition: "border-color 0.2s, box-shadow 0.2s",
      boxShadow: selected ? "-3px -3px 7px rgba(255,255,255,0.9), 3px 3px 7px rgba(163,177,198,0.4)" : "none",
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--stroke)")}
    >
      {selected ? (
        <>
          <NetLogo net={selected} size={34} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", lineHeight: 1.2 }}>
              {selected.name}
              {selected.network && <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500, marginLeft: 5 }}>{selected.network}</span>}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>Min {selected.minAmount} {selected.currency}</div>
          </div>
        </>
      ) : (
        <>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--stroke)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
          </div>
          <span style={{ flex: 1, fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>{placeholder}</span>
        </>
      )}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>
  );
}

// ─── Success Screen ───────────────────────────────────────────────────────────
function SuccessScreen({ onReset }: { onReset: () => void }) {
  return (
    <div style={{ textAlign: "center", padding: "44px 20px" }}>
      <div style={{
        width: 68, height: 68, borderRadius: "50%", margin: "0 auto 16px",
        background: "rgba(14,203,129,0.11)", display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 0 32px rgba(14,203,129,0.18)",
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0ecb81" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <div style={{ fontWeight: 900, fontSize: 18, color: "var(--text)", marginBottom: 7 }}>Payment Submitted!</div>
      <div style={{ fontSize: 13, color: "var(--muted)", maxWidth: 260, margin: "0 auto 24px", lineHeight: 1.6 }}>
        Your proof has been uploaded. We'll verify and credit your account within 5–30 minutes.
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <button onClick={onReset} style={{ padding: "11px 20px", borderRadius: 11, border: "1.5px solid var(--stroke)", background: "transparent", color: "var(--text)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          New Deposit
        </button>
        <Link to="/payments" style={{ padding: "11px 20px", borderRadius: 11, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 13, textDecoration: "none", display: "inline-block" }}>
          View History
        </Link>
      </div>
    </div>
  );
}

// ─── Validation helpers ───────────────────────────────────────────────────────
/** Zimbabwe phone: 07X format, 10 digits (after stripping spaces/dashes) */
function validateZwPhone(raw: string): { ok: boolean; msg: string } {
  const digits = raw.replace(/[\s\-()]/g, "");
  if (!digits) return { ok: false, msg: "" };
  if (!/^\d+$/.test(digits))             return { ok: false, msg: "Numbers only, no letters." };
  if (digits.length < 9)                 return { ok: false, msg: "Number too short." };
  if (digits.length > 10)                return { ok: false, msg: "Number too long." };
  if (!digits.startsWith("07"))          return { ok: false, msg: "Must start with 07X (e.g. 077…)." };
  return { ok: true, msg: "" };
}

/** Crypto address validation per network id */
function validateCryptoAddr(addr: string, networkId: string): { ok: boolean; msg: string } {
  const a = addr.trim();
  if (!a) return { ok: false, msg: "" };
  if (networkId === "usdt-trc20") {
    if (!a.startsWith("T"))             return { ok: false, msg: "TRC20 address must start with 'T'." };
    if (a.length !== 34)                return { ok: false, msg: `TRC20 address must be 34 characters (got ${a.length}).` };
    if (!/^[A-Za-z0-9]+$/.test(a))     return { ok: false, msg: "Invalid characters in TRC20 address." };
    return { ok: true, msg: "" };
  }
  if (networkId === "usdt-erc20") {
    if (!a.startsWith("0x"))            return { ok: false, msg: "ERC20 address must start with '0x'." };
    if (a.length !== 42)                return { ok: false, msg: `ERC20 address must be 42 characters (got ${a.length}).` };
    if (!/^0x[0-9a-fA-F]+$/.test(a))   return { ok: false, msg: "Invalid hex characters in ERC20 address." };
    return { ok: true, msg: "" };
  }
  if (networkId === "bnb-bsc") {
    if (!a.startsWith("0x"))            return { ok: false, msg: "BEP20 address must start with '0x'." };
    if (a.length !== 42)                return { ok: false, msg: `BEP20 address must be 42 characters (got ${a.length}).` };
    if (!/^0x[0-9a-fA-F]+$/.test(a))   return { ok: false, msg: "Invalid hex characters in BEP20 address." };
    return { ok: true, msg: "" };
  }
  if (networkId === "btc") {
    if (!/^(1|3|bc1)[A-Za-z0-9]+$/.test(a))  return { ok: false, msg: "Invalid BTC address (must start with 1, 3 or bc1)." };
    if (a.length < 25 || a.length > 62)       return { ok: false, msg: `BTC address length invalid (${a.length} chars).` };
    return { ok: true, msg: "" };
  }
  return { ok: a.length > 10, msg: a.length > 10 ? "" : "Address too short." };
}

// ─── Inline field validation indicator ───────────────────────────────────────
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Deposit() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab]           = useState<TabKey>("mobile");
  const [selectedNet, setNet]   = useState<Network | null>(null);
  const [amount, setAmount]     = useState("");
  const [phone, setPhone]       = useState("");
  const [formError, setFormError] = useState("");
  const [sheet1, setSheet1]     = useState(false);
  const [sheet2, setSheet2]     = useState(false);
  const [sheet3, setSheet3]     = useState(false);
  const [done, setDone]         = useState(false);
  // dirty flags for inline validation
  const [phoneDirty, setPhoneDirty]   = useState(false);

  // Live Payment Methods from Firebase Database
  const [mobileNetworks, setMobileNetworks] = useState<Network[]>(DEFAULT_ZW_NETWORKS);
  const [cryptoNetworks, setCryptoNetworks] = useState<Network[]>(DEFAULT_CRYPTO_NETWORKS);

  useEffect(() => {
    const r = dbRef(db, "paymentMethods");
    return onValue(r, (snap) => {
      const data = snap.val() as Record<string, any> | null;
      if (data) {
        const allMethods: Network[] = Object.entries(data)
          .map(([id, val]) => ({
            id,
            name: val.name || id,
            network: val.network,
            logo: val.logo || (val.category === "crypto" ? "https://assets.coingecko.com/coins/images/325/large/Tether.png" : ecocashLogo),
            color: val.color || (val.category === "crypto" ? "#26a17b" : "#00a651"),
            bg: val.bg || (val.category === "crypto" ? "rgba(38,161,123,0.10)" : "rgba(0,166,81,0.10)"),
            currency: val.currency || (val.category === "crypto" ? "USDT" : "USD"),
            minAmount: Number(val.minAmount) || 10,
            hint: val.hint || (val.category === "crypto" ? "Wallet address" : "07X XXX XXXX"),
            accountName: val.accountName || "AUTEX OFFICIAL",
            accountNo: val.accountNo || "",
            confirmations: val.confirmations,
            instructions: val.instructions,
            enabled: val.enabled !== false,
            order: val.order || 99,
            category: val.category || "mobile",
          }))
          .filter(n => (n as any).enabled !== false)
          .sort((a, b) => ((a as any).order || 99) - ((b as any).order || 99));

        const mobiles = allMethods.filter((n: any) => n.category === "mobile");
        const cryptos = allMethods.filter((n: any) => n.category === "crypto");

        if (mobiles.length > 0) setMobileNetworks(mobiles);
        if (cryptos.length > 0) setCryptoNetworks(cryptos);
      }
    });
  }, []);

  const nets = tab === "mobile" ? mobileNetworks : cryptoNetworks;

  // Keep selectedNet synced with latest account details from DB
  useEffect(() => {
    if (selectedNet) {
      const updated = nets.find(n => n.id === selectedNet.id);
      if (updated && (updated.accountNo !== selectedNet.accountNo || updated.accountName !== selectedNet.accountName)) {
        setNet(updated);
      }
    }
  }, [nets, selectedNet]);

  // Computed validation state
  const phoneVal = tab === "mobile" ? validateZwPhone(phone) : { ok: true, msg: "" };

  function switchTab(t: TabKey) {
    setTab(t); setNet(null); setAmount(""); setPhone(""); setFormError("");
    setPhoneDirty(false);
    setSheet1(false); setSheet2(false); setSheet3(false); setDone(false);
  }
  function reset() {
    setNet(null); setAmount(""); setPhone(""); setFormError("");
    setPhoneDirty(false);
    setSheet1(false); setSheet2(false); setSheet3(false); setDone(false);
  }

  const quickAmounts = tab === "mobile" ? [10, 20, 50, 100, 200] : [10, 50, 100, 200, 500];

  function handleProceed() {
    setFormError("");
    if (!user)        { navigate("/login"); return; }
    if (!selectedNet) { setFormError("Please select a network first."); return; }
    const amt = parseFloat(amount);
    if (!amt || amt < selectedNet.minAmount) { setFormError(`Minimum deposit is ${selectedNet.minAmount} ${selectedNet.currency}.`); return; }
    if (tab === "mobile") {
      setPhoneDirty(true);
      if (!phone.trim()) { setFormError("Please enter your phone number."); return; }
      const v = validateZwPhone(phone);
      if (!v.ok) { setFormError(v.msg || "Please enter a valid Zimbabwe phone number."); return; }
    }
    // Crypto only requires amount — no wallet address input needed
    setSheet2(true);
  }

  if (done) return (
    <Shell>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500, marginBottom: 2 }}>Add Funds</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>Deposit</div>
      </div>
      <div style={{ borderRadius: 20, background: "var(--bg1)", border: "1px solid rgba(255,255,255,0.4)", boxShadow: "-6px -6px 14px rgba(255,255,255,1), 6px 6px 14px rgba(163,177,198,0.6)" }}>
        <SuccessScreen onReset={reset} />
      </div>
    </Shell>
  );

  return (
    <Shell>
      <style>{SHEET_STYLES}</style>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500, marginBottom: 2 }}>Add Funds</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>Deposit</div>
      </div>

      {/* Tab Switcher */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        background: "var(--bg2)", borderRadius: 15, padding: 4, marginBottom: 20,
        boxShadow: "inset -3px -3px 7px rgba(255,255,255,0.8), inset 3px 3px 7px rgba(163,177,198,0.4)",
      }}>
        {([
          { key: "mobile" as TabKey, label: "Mobile Money", sub: "Zimbabwe Networks",
            icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={tab === "mobile" ? "var(--accent)" : "var(--muted)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg> },
          { key: "crypto" as TabKey, label: "Crypto",        sub: "BTC · USDT · BNB",
            icon: <img src="https://bin.bnbstatic.com/static/images/common/logo.png" alt="Binance" width={22} height={22} style={{ objectFit: "contain", borderRadius: 5 }} onError={e => { (e.target as HTMLImageElement).src = "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png"; }} /> },
        ] as const).map(t => (
          <button key={t.key} onClick={() => switchTab(t.key)} style={{
            padding: "11px 8px", borderRadius: 12, border: "none", cursor: "pointer",
            background: tab === t.key ? "var(--bg1)" : "transparent",
            boxShadow: tab === t.key ? "-4px -4px 10px rgba(255,255,255,1), 4px 4px 10px rgba(163,177,198,0.6)" : "none",
            transition: "all 0.25s ease", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            {t.icon}
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: tab === t.key ? "var(--text)" : "var(--muted)", lineHeight: 1.1 }}>{t.label}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: tab === t.key ? "var(--accent)" : "var(--muted)", marginTop: 1 }}>{t.sub}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Main Card */}
      <div style={{ borderRadius: 20, background: "var(--bg1)", border: "1px solid rgba(255,255,255,0.4)", boxShadow: "-6px -6px 14px rgba(255,255,255,1), 6px 6px 14px rgba(163,177,198,0.6)", padding: "18px" }}>

        {/* Network Dropdown */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7 }}>
            {tab === "mobile" && <ZwFlag size={12} />}
            {tab === "mobile" ? "Mobile Network" : "Coin & Network"}
          </div>
          <NetworkDropdown
            selected={selectedNet}
            placeholder={tab === "mobile" ? "Choose a Zimbabwe mobile network" : "Choose crypto coin & network"}
            onClick={() => setSheet1(true)}
          />
        </div>

        {/* Amount */}
        <div style={{ marginBottom: tab === "mobile" ? 14 : 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7 }}>
            Amount {selectedNet ? `(${selectedNet.currency})` : ""}
          </div>
          <div style={{ position: "relative" }}>
            {tab === "mobile" && <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16, fontWeight: 900, color: "var(--accent)", pointerEvents: "none" }}>$</div>}
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder={selectedNet ? `Min ${selectedNet.minAmount}` : "0.00"}
              min={selectedNet?.minAmount} step={tab === "mobile" ? "0.01" : "0.0001"}
              style={{
                width: "100%", padding: `12px 12px 12px ${tab === "mobile" ? "28px" : "12px"}`,
                borderRadius: 10, border: "1.5px solid var(--stroke)", background: "var(--bg2)",
                fontSize: 18, fontWeight: 800, color: "var(--text)", outline: "none",
                boxSizing: "border-box", transition: "border-color 0.2s",
              }}
              onFocus={e => (e.target.style.borderColor = "var(--accent)")}
              onBlur={e => (e.target.style.borderColor = "var(--stroke)")}
            />
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {quickAmounts.map(a => (
              <button key={a} type="button" onClick={() => setAmount(String(a))} style={{
                padding: "4px 11px", borderRadius: 999, border: `1.5px solid ${amount === String(a) ? "var(--accent)" : "var(--stroke)"}`,
                background: amount === String(a) ? "rgba(0,166,81,0.08)" : "transparent",
                color: amount === String(a) ? "var(--accent)" : "var(--muted)",
                fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
              }}>{tab === "mobile" ? "$" : ""}{a}</button>
            ))}
          </div>
        </div>

        {/* Phone — mobile only */}
        {tab === "mobile" && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7 }}>
              <ZwFlag size={12} />
              Your Phone Number
            </div>
            <div style={{ display: "flex" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 12px", background: "var(--bg2)", border: `1.5px solid ${phoneDirty ? (phoneVal.ok ? "#0ecb81" : "#f6465d") : "var(--stroke)"}`, borderRight: "none", borderRadius: "10px 0 0 10px", flexShrink: 0 }}>
                <ZwFlag size={14} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", whiteSpace: "nowrap" }}>+263</span>
              </div>
              <input type="tel" value={phone}
                onChange={e => { setPhone(e.target.value); setPhoneDirty(true); }}
                placeholder={selectedNet?.hint || "07X XXX XXXX"}
                maxLength={10}
                style={{
                  flex: 1, padding: "12px 12px", borderRadius: "0 10px 10px 0",
                  border: `1.5px solid ${phoneDirty ? (phoneVal.ok ? "#0ecb81" : "#f6465d") : "var(--stroke)"}`, borderLeft: "none",
                  background: "var(--bg2)", fontSize: 16, fontWeight: 600,
                  color: "var(--text)", outline: "none", transition: "border-color 0.2s",
                }}
                onFocus={e => (e.target.style.borderColor = phoneDirty ? (phoneVal.ok ? "#0ecb81" : "#f6465d") : "var(--accent)")}
                onBlur={e => { setPhoneDirty(true); e.target.style.borderColor = phoneVal.ok ? "#0ecb81" : (phone ? "#f6465d" : "var(--stroke)"); }}
              />
            </div>
            <FieldStatus ok={phoneVal.ok} msg={phoneVal.msg} dirty={phoneDirty} />
          </div>
        )}

        {/* Summary strip */}
        {selectedNet && amount && parseFloat(amount) >= selectedNet.minAmount && (
          <div style={{ padding: "10px 12px", borderRadius: 10, marginBottom: 12, background: "rgba(0,166,81,0.06)", border: "1px solid rgba(0,166,81,0.16)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>You Pay</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "var(--accent)" }}>{parseFloat(amount).toFixed(2)} {selectedNet.currency}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Network</div>
              <div style={{ fontWeight: 800, fontSize: 13, color: "var(--text)" }}>{selectedNet.name}</div>
            </div>
          </div>
        )}

        {/* Error */}
        {formError && (
          <div style={{ padding: "9px 12px", borderRadius: 9, marginBottom: 12, background: "rgba(246,70,93,0.08)", border: "1px solid rgba(246,70,93,0.22)", color: "#f6465d", fontSize: 12, fontWeight: 600 }}>
            {formError}
          </div>
        )}

        {/* Proceed */}
        <button onClick={handleProceed} style={{
          width: "100%", padding: "13px", borderRadius: 12, border: "none",
          background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 800,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12l7 7 7-7"/>
          </svg>
          {user ? "Proceed to Deposit" : "Sign In to Deposit"}
        </button>
        {!user && (
          <div style={{ textAlign: "center", marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
            <Link to="/login" style={{ color: "var(--accent)", fontWeight: 700 }}>Log in</Link> or <Link to="/register" style={{ color: "var(--accent)", fontWeight: 700 }}>register</Link>
          </div>
        )}
      </div>

      {/* Footer note */}
      <div style={{ marginTop: 16, padding: "11px 14px", borderRadius: 12, background: "rgba(0,0,0,0.03)", border: "1px solid var(--stroke)", display: "flex", alignItems: "flex-start", gap: 8 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>
          Deposits verified within <strong>5–30 min</strong>. Need help? <Link to="/support" style={{ color: "var(--accent)", fontWeight: 700 }}>Help Center</Link>
        </div>
      </div>
      <div style={{ textAlign: "center", marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--stroke)", display: "flex", justifyContent: "center", gap: 18 }}>
        <Link to="/withdraw" style={{ fontSize: 12, color: "#2563eb", fontWeight: 700, textDecoration: "none" }}>Withdraw Funds →</Link>
        <Link to="/payments" style={{ fontSize: 12, color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}>Transaction History →</Link>
      </div>

      {/* Sheets */}
      <NetworkSelectorSheet open={sheet1} onClose={() => setSheet1(false)} networks={nets} onSelect={n => setNet(n)} tabKey={tab} />
      {selectedNet && <PaymentDetailsSheet open={sheet2} onClose={() => setSheet2(false)} net={selectedNet} amount={amount} phone={phone} tabKey={tab} onConfirm={() => { setSheet2(false); setSheet3(true); }} />}
      {selectedNet && <ProofUploadSheet open={sheet3} onClose={() => setSheet3(false)} net={selectedNet} amount={amount} phone={phone} tabKey={tab} onDone={() => { setSheet3(false); setDone(true); }} />}
    </Shell>
  );
}
