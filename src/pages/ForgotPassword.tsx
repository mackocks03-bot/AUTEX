import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/firebase";
import { triggerErrorFeedback } from "@/utils/haptics";
import { COUNTRIES, DEFAULT_COUNTRY, getFlagUrl, type Country } from "@/lib/countries";

/* ─── shared styles ─────────────────────────────────── */
const css = `
@keyframes sheetIn  { from { transform: translateY(100%) } to { transform: translateY(0) } }
@keyframes sheetOut { from { transform: translateY(0) }    to { transform: translateY(100%) } }
@keyframes maskIn   { from { opacity: 0 } to { opacity: 1 } }
@keyframes maskOut  { from { opacity: 1 } to { opacity: 0 } }
@keyframes shake    { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-8px)} 40%,80%{transform:translateX(8px)} }
.fp-shake { animation: shake .4s ease; }
`;

/* ─── CountrySheet ───────────────────────────────────── */
interface SheetProps {
  open: boolean;
  onClose: () => void;
  selected: Country;
  onSelect: (c: Country) => void;
}

function CountrySheet({ open, onClose, selected, onSelect }: SheetProps) {
  const [query, setQuery] = useState("");
  const [closing, setClosing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setQuery(""); setTimeout(() => inputRef.current?.focus(), 300); }
  }, [open]);

  const filtered = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.dialCode.includes(query) ||
      c.code.toLowerCase().includes(query.toLowerCase())
  );

  function close() {
    setClosing(true);
    setTimeout(() => { setClosing(false); onClose(); }, 280);
  }

  if (!open && !closing) return null;

  return (
    <>
      <div
        onClick={close}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
          zIndex: 1000,
          animation: closing ? "maskOut .28s ease forwards" : "maskIn .28s ease forwards",
        }}
      />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "var(--bg1)",
        borderRadius: "22px 22px 0 0",
        zIndex: 1001,
        maxHeight: "80vh",
        display: "flex", flexDirection: "column",
        animation: closing ? "sheetOut .28s ease forwards" : "sheetIn .3s ease forwards",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.18)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--stroke)" }} />
        </div>
        <div style={{ padding: "0 20px 10px", fontWeight: 700, fontSize: 17, color: "var(--text)" }}>
          Select Country
        </div>
        <div style={{ padding: "0 16px 10px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "var(--bg2)", borderRadius: 12,
            padding: "10px 14px",
            border: "1.5px solid var(--stroke)",
          }}>
            <svg width="16" height="16" fill="none" stroke="var(--muted)" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country or dial code"
              style={{
                flex: 1, border: "none", background: "transparent",
                fontSize: 15, color: "var(--text)", outline: "none",
              }}
            />
          </div>
        </div>
        <div style={{ overflowY: "auto", flex: 1, paddingBottom: 24 }}>
          {filtered.map((c) => (
            <button
              key={c.code}
              onClick={() => { onSelect(c); close(); }}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 12,
                padding: "13px 20px",
                background: c.code === selected.code ? "rgba(0,166,81,0.08)" : "transparent",
                border: "none", cursor: "pointer",
                borderBottom: "1px solid var(--stroke)",
              }}
            >
              <img
                src={getFlagUrl(c.code)}
                alt={c.name}
                style={{ width: 26, height: 18, objectFit: "cover", borderRadius: 3, boxShadow: "0 0 1px rgba(0,0,0,0.3)" }}
                loading="lazy"
              />
              <span style={{ flex: 1, textAlign: "left", fontSize: 15, color: "var(--text)", fontWeight: 500 }}>
                {c.name}
              </span>
              <span style={{ fontSize: 14, color: "var(--muted)", fontFamily: "monospace" }}>
                +{c.dialCode}
              </span>
              {c.code === selected.code && (
                <svg width="16" height="16" fill="none" stroke="var(--accent)" strokeWidth="2.5" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--muted)", padding: "32px 0", fontSize: 15 }}>
              No countries found
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function ForgotPassword() {
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  function triggerShake() {
    setShake(true);
    triggerErrorFeedback();
    setTimeout(() => setShake(false), 450);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (!digits) {
      setError("Please enter your phone number.");
      triggerShake();
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const generatedEmail = `u${country.dialCode}${digits}@autex.com`;
      await sendPasswordResetEmail(auth, generatedEmail);
      setSuccess(true);
      setPhone("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("user-not-found") || msg.includes("invalid-credential")) {
        setError("Account not found with this phone number.");
      } else if (msg.includes("network-request-failed")) {
        setError("Network error. Check your connection.");
      } else if (msg.includes("too-many-requests")) {
        setError("Too many attempts. Please try again later.");
      } else {
        setError("Failed to request password reset. Please try again.");
      }
      triggerShake();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <style>{css}</style>
      <CountrySheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        selected={country}
        onSelect={setCountry}
      />

      <div style={{
        minHeight: "100vh",
        background: "var(--bg0)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px 16px",
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <div
          className={shake ? "fp-shake" : ""}
          style={{
            width: "100%", maxWidth: 400,
            background: "var(--bg1)",
            borderRadius: 22,
            boxShadow: "-6px -6px 14px rgba(255,255,255,0.9), 6px 6px 14px rgba(163,177,198,0.6)",
            padding: "36px 28px 32px",
          }}
        >
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{
              width: 60, height: 60, borderRadius: "50%",
              background: "linear-gradient(135deg,#00a651,#007a3c)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 16px rgba(0,166,81,0.3)",
              marginBottom: 12,
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                <path d="M12 2L3 7l9 5 9-5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5"/>
              </svg>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: -0.5 }}>
              Reset Password
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
              Enter your phone number to reset your password
            </div>
          </div>

          {error && (
            <div style={{
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 10, padding: "10px 14px",
              fontSize: 13, color: "#ef4444", fontWeight: 500,
              marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{
              marginBottom: 16, padding: "16px", borderRadius: 12,
              background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)",
              textAlign: "center",
            }}>
              <div style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 40, height: 40, borderRadius: "50%",
                background: "rgba(16,185,129,0.2)", color: "#10b981", marginBottom: 10,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h3 style={{ margin: "0 0 6px", color: "#10b981", fontSize: 16 }}>Request Received</h3>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
                If an account exists with this phone number, reset instructions have been dispatched.
              </p>
            </div>
          )}

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>
                Phone Number
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "0 12px",
                    background: "var(--bg2)",
                    border: "1.5px solid var(--stroke)",
                    borderRadius: 12, cursor: "pointer",
                    fontSize: 15, color: "var(--text)", fontWeight: 600,
                    whiteSpace: "nowrap",
                    boxShadow: "inset 2px 2px 5px rgba(163,177,198,0.4), inset -2px -2px 5px rgba(255,255,255,0.7)",
                    minHeight: 48,
                  }}
                >
                  <img
                    src={getFlagUrl(country.code)}
                    alt={country.name}
                    style={{ width: 24, height: 16, objectFit: "cover", borderRadius: 3, boxShadow: "0 0 1px rgba(0,0,0,0.3)" }}
                  />
                  <span>+{country.dialCode}</span>
                  <svg width="12" height="12" fill="none" stroke="var(--muted)" strokeWidth="2" viewBox="0 0 24 24">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="Phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  style={{
                    flex: 1,
                    padding: "0 14px",
                    height: 48,
                    background: "var(--bg2)",
                    border: "1.5px solid var(--stroke)",
                    borderRadius: 12,
                    fontSize: 16, color: "var(--text)",
                    outline: "none",
                    boxShadow: "inset 2px 2px 5px rgba(163,177,198,0.4), inset -2px -2px 5px rgba(255,255,255,0.7)",
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              style={{
                height: 50, borderRadius: 14, border: "none", cursor: busy ? "not-allowed" : "pointer",
                background: busy ? "var(--stroke)" : "linear-gradient(135deg,#00a651,#007a3c)",
                color: "#fff", fontSize: 16, fontWeight: 700,
                boxShadow: busy ? "none" : "0 4px 16px rgba(0,166,81,0.3)",
                transition: "all .2s",
                marginTop: 4,
              }}
            >
              {busy ? "Sending…" : "Send Reset Request"}
            </button>

            <div style={{ textAlign: "center", marginTop: 8 }}>
              <Link to="/login" style={{ color: "var(--accent)", fontSize: 14, textDecoration: "none", fontWeight: 600 }}>
                ← Back to Log In
              </Link>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
