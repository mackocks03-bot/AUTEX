import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { ref, set } from "firebase/database";
import { auth, db } from "@/firebase";
import { triggerErrorFeedback } from "@/utils/haptics";
import { COUNTRIES, DEFAULT_COUNTRY, getFlagUrl, type Country } from "@/lib/countries";

/* ─── shared styles ─────────────────────────────────── */
const css = `
@keyframes sheetIn  { from { transform: translateY(100%) } to { transform: translateY(0) } }
@keyframes sheetOut { from { transform: translateY(0) }    to { transform: translateY(100%) } }
@keyframes maskIn   { from { opacity: 0 } to { opacity: 1 } }
@keyframes maskOut  { from { opacity: 1 } to { opacity: 0 } }
@keyframes shake    { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-8px)} 40%,80%{transform:translateX(8px)} }
.reg-shake { animation: shake .4s ease; }
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

/* ─── helpers ───────────────────────────────────────── */
function genAffiliateCode(len = 7) {
  return Math.random().toString(36).substring(2, 2 + len).toUpperCase();
}

/* ─── Register page ──────────────────────────────────── */
export default function Register() {
  const nav = useNavigate();
  const [params] = useSearchParams();

  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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
    if (password.length < 6) { setError("Password must be at least 6 characters."); triggerShake(); return; }
    if (password !== confirm) { setError("Passwords do not match."); triggerShake(); return; }

    setBusy(true);
    setError(null);
    try {
      const formattedPhone = `+${country.dialCode}${digits}`;
      // Build a valid email: strip non-alphanumeric chars from phone for the local part
      const emailLocal = `u${country.dialCode}${digits}`;
      const email = `${emailLocal}@autex.com`;
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(user, { displayName: formattedPhone });

      const affiliateCode = genAffiliateCode();
      await set(ref(db, `users/${user.uid}`), {
        displayName: formattedPhone,
        phone: formattedPhone,
        email,
        affiliateCode,
        createdAt: Date.now(),
      });

      /* referral tracking */
      const refCode = params.get("ref");
      if (refCode) {
        await set(ref(db, `referrals/${refCode}/${user.uid}`), {
          displayName: formattedPhone,
          createdAt: Date.now(),
          status: "active",
        });
      }

      nav("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("email-already-in-use")) {
        setError("This phone number is already registered.");
      } else if (msg.includes("weak-password")) {
        setError("Password is too weak. Use at least 6 characters.");
      } else if (msg.includes("network-request-failed")) {
        setError("Network error. Check your connection.");
      } else {
        setError("Registration failed. Please try again.");
      }
      triggerShake();
    } finally {
      setBusy(false);
    }
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "0 14px",
    height: 48,
    background: "var(--bg2)",
    border: "1.5px solid var(--stroke)",
    borderRadius: 12,
    fontSize: 16, color: "var(--text)",
    outline: "none", boxSizing: "border-box",
    boxShadow: "inset 2px 2px 5px rgba(163,177,198,0.4), inset -2px -2px 5px rgba(255,255,255,0.7)",
  };

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
          className={shake ? "reg-shake" : ""}
          style={{
            width: "100%", maxWidth: 420,
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
              Create Account
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
              Join AUTEX AI today
            </div>
          </div>

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Phone */}
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
                  style={{ ...fieldStyle, flex: 1 }}
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
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ ...fieldStyle, paddingRight: 46 }}
                />
                <button type="button" onClick={() => setShowPw((p) => !p)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", padding: 4 }}>
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
            </div>

            {/* Confirm Password */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>
                Confirm Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showConfirm ? "text" : "password"}
                  placeholder="Repeat password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  style={{
                    ...fieldStyle,
                    paddingRight: 46,
                    borderColor: confirm && confirm !== password ? "#ef4444"
                      : confirm && confirm === password ? "#00a651"
                      : "var(--stroke)",
                  }}
                />
                <button type="button" onClick={() => setShowConfirm((p) => !p)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", padding: 4 }}>
                  {showConfirm ? (
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
                height: 50, borderRadius: 14, border: "none",
                cursor: busy ? "not-allowed" : "pointer",
                background: busy ? "var(--stroke)" : "linear-gradient(135deg,#00a651,#007a3c)",
                color: "#fff", fontSize: 16, fontWeight: 700,
                boxShadow: busy ? "none" : "0 4px 16px rgba(0,166,81,0.3)",
                transition: "all .2s",
                marginTop: 4,
              }}
            >
              {busy ? "Creating account…" : "Create Account"}
            </button>

            <div style={{ textAlign: "center", fontSize: 14, color: "var(--muted)", marginTop: 4 }}>
              Already have an account?{" "}
              <Link to="/login" style={{ color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}>
                Log In
              </Link>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
