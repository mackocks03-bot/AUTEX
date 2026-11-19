import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
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
.login-shake { animation: shake .4s ease; }
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
        {/* handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--stroke)" }} />
        </div>
        <div style={{ padding: "0 20px 10px", fontWeight: 700, fontSize: 17, color: "var(--text)" }}>
          Select Country
        </div>
        {/* search */}
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
        {/* list */}
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

/* ─── Login page ─────────────────────────────────────── */
export default function Login() {
  const nav = useNavigate();
  const location = useLocation();
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    if (!digits) { setError("Please enter your phone number."); triggerShake(); return; }
    if (!password) { setError("Please enter your password."); triggerShake(); return; }

    setBusy(true);
    setError(null);
    try {
      const emailLocal = `u${country.dialCode}${digits}`;
      const email = `${emailLocal}@autex.com`;
      await signInWithEmailAndPassword(auth, email, password);
      const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || "/";
      nav(from, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("invalid-credential") || msg.includes("wrong-password") || msg.includes("user-not-found")) {
        setError("Incorrect phone number or password.");
      } else if (msg.includes("too-many-requests")) {
        setError("Too many attempts. Please try again later.");
      } else if (msg.includes("network-request-failed")) {
        setError("Network error. Check your connection.");
      } else {
        setError("Login failed. Please try again.");
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
          className={shake ? "login-shake" : ""}
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
              AUTEX AI
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
              Log in to your account
            </div>
          </div>

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Phone */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>
                Phone Number
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                {/* country picker */}
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
                {/* phone input */}
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

            {/* Password */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0 46px 0 14px",
                    height: 48,
                    background: "var(--bg2)",
                    border: "1.5px solid var(--stroke)",
                    borderRadius: 12,
                    fontSize: 16, color: "var(--text)",
                    outline: "none", boxSizing: "border-box",
                    boxShadow: "inset 2px 2px 5px rgba(163,177,198,0.4), inset -2px -2px 5px rgba(255,255,255,0.7)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((p) => !p)}
                  style={{
                    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                    background: "transparent", border: "none", cursor: "pointer", padding: 4,
                  }}
                >
                  {showPw ? (
                    <svg width="20" height="20" fill="none" stroke="var(--muted)" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" fill="none" stroke="var(--muted)" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
              <div style={{ textAlign: "right", marginTop: 6 }}>
                <Link to="/forgot-password" style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
                  Forgot Password?
                </Link>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 10, padding: "10px 14px",
                fontSize: 13, color: "#ef4444", fontWeight: 500,
              }}>
                {error}
              </div>
            )}

            {/* Submit */}
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
              {busy ? "Logging in…" : "Log In"}
            </button>

            <div style={{ textAlign: "center", fontSize: 14, color: "var(--muted)", marginTop: 4 }}>
              Don't have an account?{" "}
              <Link to="/register" style={{ color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}>
                Register
              </Link>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
