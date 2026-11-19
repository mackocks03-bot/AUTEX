import { useEffect, useState } from "react";
import { onValue, ref, set } from "firebase/database";
import { db } from "@/firebase";

export interface AppSettings {
  siteName: string;
  siteTagline: string;
  currency: string;
  miningWindowStart: string;
  miningWindowEnd: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  adEnabled: boolean;
  adImageUrl: string;
  adLinkUrl: string;
  telegramLink: string;
  supportPhone: string;
}

const DEFAULTS: AppSettings = {
  siteName: "AUTEX AI",
  siteTagline: "Next-Gen Autonomous AI Crypto Fleet",
  currency: "USD",
  miningWindowStart: "13:00",
  miningWindowEnd: "14:00",
  maintenanceMode: false,
  maintenanceMessage: "AUTEX AI is currently undergoing scheduled infrastructure upgrades. We will be back online shortly.",
  adEnabled: false,
  adImageUrl: "",
  adLinkUrl: "",
  telegramLink: "https://t.me/autex_ai",
  supportPhone: "+255 700 000 000",
};

function ToggleSwitch({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <label htmlFor={id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
      <div
        id={id}
        onClick={() => onChange(!checked)}
        style={{
          width: 50,
          height: 28,
          borderRadius: 14,
          background: checked ? "#00a651" : "rgba(148,163,184,0.3)",
          border: `1px solid ${checked ? "#00a651" : "rgba(148,163,184,0.35)"}`,
          position: "relative",
          transition: "all 0.25s ease",
          cursor: "pointer",
          flexShrink: 0,
          boxShadow: checked ? "0 0 12px rgba(0,166,81,0.4)" : "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 3,
            left: checked ? 25 : 3,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.25s ease",
            boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
          }}
        />
      </div>
    </label>
  );
}

function SettingRow({
  icon,
  title,
  description,
  children,
}: {
  icon: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "16px 0",
        borderBottom: "1px solid var(--stroke)",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flex: 1, minWidth: 220 }}>
        <span style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>{icon}</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14.5, color: "var(--text)" }}>{title}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, lineHeight: 1.4 }}>{description}</div>
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

export function AdminSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  useEffect(() => {
    const r = ref(db, "settings");
    return onValue(r, (snap) => {
      const val = snap.val();
      setSettings({ ...DEFAULTS, ...(val ?? {}) });
      setLoading(false);
    });
  }, []);

  async function save<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSaving(key);
    try {
      await set(ref(db, `settings/${key}`), value);
      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 2000);
    } catch (e) {
      console.error("Failed to save setting", e);
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <div style={{ width: 34, height: 34, border: "3px solid rgba(0,0,0,0.1)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Brand Identity Card */}
      <div className="neu-card" style={{ borderRadius: 18 }}>
        <div className="card-body">
          <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800, color: "#00a651", display: "flex", alignItems: "center", gap: 8 }}>
            <span>🌐</span> Platform Branding & Identity
          </h3>
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--muted)" }}>
            Configure the core public brand details displayed across AUTEX AI.
          </p>

          <SettingRow icon="🏷️" title="Platform Name" description="The main platform brand name shown in header and titles.">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                className="input"
                value={settings.siteName}
                onChange={(e) => setSettings((s) => ({ ...s, siteName: e.target.value }))}
                style={{ width: 170, padding: "7px 12px", fontSize: 13 }}
              />
              <button
                className="neu-btn btn-ghost"
                style={{ padding: "7px 14px", fontSize: 12.5 }}
                onClick={() => void save("siteName", settings.siteName)}
                disabled={saving === "siteName"}
              >
                {savedKey === "siteName" ? "✅" : "Save"}
              </button>
            </div>
          </SettingRow>

          <SettingRow icon="✨" title="Site Tagline" description="Secondary slogan displayed under the logo and hero header.">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                className="input"
                value={settings.siteTagline}
                onChange={(e) => setSettings((s) => ({ ...s, siteTagline: e.target.value }))}
                style={{ width: 220, padding: "7px 12px", fontSize: 13 }}
              />
              <button
                className="neu-btn btn-ghost"
                style={{ padding: "7px 14px", fontSize: 12.5 }}
                onClick={() => void save("siteTagline", settings.siteTagline)}
                disabled={saving === "siteTagline"}
              >
                {savedKey === "siteTagline" ? "✅" : "Save"}
              </button>
            </div>
          </SettingRow>

          <SettingRow icon="💵" title="Base Currency" description="Global currency code used across trading bots and balances.">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                className="input"
                value={settings.currency}
                onChange={(e) => setSettings((s) => ({ ...s, currency: e.target.value.toUpperCase() }))}
                style={{ width: 90, padding: "7px 12px", fontSize: 13, textTransform: "uppercase" }}
              />
              <button
                className="neu-btn btn-ghost"
                style={{ padding: "7px 14px", fontSize: 12.5 }}
                onClick={() => void save("currency", settings.currency)}
                disabled={saving === "currency"}
              >
                {savedKey === "currency" ? "✅" : "Save"}
              </button>
            </div>
          </SettingRow>
        </div>
      </div>

      {/* AI Mining Windows Card */}
      <div className="neu-card" style={{ borderRadius: 18 }}>
        <div className="card-body">
          <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800, color: "#00a651", display: "flex", alignItems: "center", gap: 8 }}>
            <span>⚡</span> AI Mining Schedule
          </h3>
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--muted)" }}>
            Current daily window is locked to 1:00 PM – 2:00 PM daily.
          </p>

          <div
            style={{
              padding: "14px 16px",
              borderRadius: 14,
              background: "rgba(0,166,81,0.08)",
              border: "1px solid rgba(0,166,81,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#00a651" }}>Active Mining Window: 13:00 - 14:00 (1:00 PM - 2:00 PM)</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                Bots yield 12% daily (&lt;$100) or 15% daily (&ge;$100). Users can claim once per calendar day during this window.
              </div>
            </div>
            <span style={{ padding: "4px 10px", borderRadius: 999, background: "#00a651", color: "#fff", fontSize: 11, fontWeight: 800 }}>
              AUTO SCHEDULED
            </span>
          </div>
        </div>
      </div>

      {/* Maintenance Mode Card */}
      <div
        className="neu-card"
        style={{
          borderRadius: 18,
          border: settings.maintenanceMode ? "1.5px solid rgba(239,68,68,0.5)" : "1px solid var(--stroke)",
        }}
      >
        <div className="card-body">
          <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800, color: settings.maintenanceMode ? "#ef4444" : "#00a651", display: "flex", alignItems: "center", gap: 8 }}>
            <span>🔧</span> Maintenance Mode
          </h3>
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--muted)" }}>
            Lock out regular users during infrastructure updates while granting full access to admins.
          </p>

          <SettingRow
            icon="⚠️"
            title="Enable Maintenance Gate"
            description="When ON, non-admin visitors see the maintenance screen and cannot interact with the app."
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: settings.maintenanceMode ? "#ef4444" : "var(--muted)", fontWeight: 700 }}>
                {settings.maintenanceMode ? "ACTIVE (LOCKED)" : "INACTIVE (OPEN)"}
              </span>
              <ToggleSwitch
                id="toggle-maintenance"
                checked={settings.maintenanceMode}
                onChange={(v) => void save("maintenanceMode", v)}
              />
              {savedKey === "maintenanceMode" && <span style={{ fontSize: 16 }}>✅</span>}
            </div>
          </SettingRow>

          <div style={{ marginTop: 14 }}>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 6 }}>
              Custom Maintenance Notice to Users:
            </label>
            <textarea
              className="textarea"
              value={settings.maintenanceMessage}
              rows={3}
              onChange={(e) => setSettings((s) => ({ ...s, maintenanceMessage: e.target.value }))}
              style={{ fontSize: 13, width: "100%" }}
            />
            <button
              className="neu-btn btn-ghost"
              style={{ marginTop: 8, padding: "7px 18px", fontSize: 13 }}
              onClick={() => void save("maintenanceMessage", settings.maintenanceMessage)}
              disabled={saving === "maintenanceMessage"}
            >
              {savedKey === "maintenanceMessage" ? "✅ Message Saved" : "Save Notice"}
            </button>
          </div>
        </div>
      </div>

      {/* Pop-up Ad & Announcements */}
      <div className="neu-card" style={{ borderRadius: 18 }}>
        <div className="card-body">
          <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800, color: "#00a651", display: "flex", alignItems: "center", gap: 8 }}>
            <span>📢</span> Pop-up Promotion & Modal Ad
          </h3>
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--muted)" }}>
            Display an overlay modal banner to users on platform entry.
          </p>

          <SettingRow icon="🖼️" title="Enable Pop-up Banner" description="Turn on or off the promotional modal banner.">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>
                {settings.adEnabled ? "ON" : "OFF"}
              </span>
              <ToggleSwitch
                id="toggle-ad"
                checked={settings.adEnabled}
                onChange={(v) => void save("adEnabled", v)}
              />
              {savedKey === "adEnabled" && <span style={{ fontSize: 16 }}>✅</span>}
            </div>
          </SettingRow>

          <div style={{ marginTop: 14 }}>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 6 }}>
              Banner Image URL
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                value={settings.adImageUrl}
                onChange={(e) => setSettings((s) => ({ ...s, adImageUrl: e.target.value }))}
                style={{ flex: 1, padding: "8px 12px", fontSize: 13 }}
                placeholder="https://..."
              />
              <button
                className="neu-btn btn-ghost"
                onClick={() => void save("adImageUrl", settings.adImageUrl)}
                disabled={saving === "adImageUrl"}
              >
                {savedKey === "adImageUrl" ? "✅" : "Save"}
              </button>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 6 }}>
              Target Destination Link
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                value={settings.adLinkUrl}
                onChange={(e) => setSettings((s) => ({ ...s, adLinkUrl: e.target.value }))}
                style={{ flex: 1, padding: "8px 12px", fontSize: 13 }}
                placeholder="https://..."
              />
              <button
                className="neu-btn btn-ghost"
                onClick={() => void save("adLinkUrl", settings.adLinkUrl)}
                disabled={saving === "adLinkUrl"}
              >
                {savedKey === "adLinkUrl" ? "✅" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
