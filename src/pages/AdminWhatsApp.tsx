import { useEffect, useState } from "react";
import { onValue, ref, set } from "firebase/database";
import { db } from "@/firebase";

export interface WhatsAppGroupConfig {
  enabled: boolean;
  groupLink: string;
  label: string;
  updatedAt?: number;
}

const DEFAULTS: WhatsAppGroupConfig = {
  enabled: true,
  groupLink: "",
  label: "Join WhatsApp Group",
};

function normalizeWhatsAppUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isValidWhatsAppLink(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(normalizeWhatsAppUrl(url));
    return (
      parsed.protocol === "https:" ||
      parsed.protocol === "http:"
    );
  } catch {
    return false;
  }
}

export function AdminWhatsApp() {
  const [config, setConfig] = useState<WhatsAppGroupConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  useEffect(() => {
    const r = ref(db, "settings/whatsapp");
    return onValue(
      r,
      (snap) => {
        const val = snap.val();
        if (val && typeof val === "object") {
          setConfig({
            enabled: val.enabled !== undefined ? Boolean(val.enabled) : true,
            groupLink: String(val.groupLink || ""),
            label: String(val.label || DEFAULTS.label),
            updatedAt: val.updatedAt,
          });
        } else {
          setConfig(DEFAULTS);
        }
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, []);

  const showNotice = (text: string, type: "ok" | "err" = "ok") => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 3500);
  };

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const cleanedLink = normalizeWhatsAppUrl(config.groupLink);
    if (config.enabled && !cleanedLink) {
      showNotice("Please enter a WhatsApp group invite link before enabling.", "err");
      return;
    }
    if (cleanedLink && !isValidWhatsAppLink(cleanedLink)) {
      showNotice("Please enter a valid URL (e.g. https://chat.whatsapp.com/...).", "err");
      return;
    }

    setSaving(true);
    try {
      const payload: WhatsAppGroupConfig = {
        enabled: config.enabled,
        groupLink: cleanedLink,
        label: config.label.trim() || DEFAULTS.label,
        updatedAt: Date.now(),
      };
      await set(ref(db, "settings/whatsapp"), payload);
      setConfig(payload);
      showNotice("WhatsApp Group link saved & synced to live bubble! ✅");
    } catch (err: any) {
      showNotice(err?.message || "Failed to save WhatsApp settings.", "err");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleEnabled() {
    const next = !config.enabled;
    const cleanedLink = normalizeWhatsAppUrl(config.groupLink);
    if (next && !cleanedLink) {
      showNotice("Add a WhatsApp group link first before enabling the bubble.", "err");
      return;
    }
    setSaving(true);
    try {
      const payload: WhatsAppGroupConfig = {
        ...config,
        groupLink: cleanedLink,
        enabled: next,
        updatedAt: Date.now(),
      };
      await set(ref(db, "settings/whatsapp"), payload);
      setConfig(payload);
      showNotice(next ? "Floating WhatsApp bubble enabled! 🟢" : "Floating WhatsApp bubble hidden. ⚫");
    } catch (err: any) {
      showNotice(err?.message || "Failed to update visibility.", "err");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <div
          style={{
            width: 34,
            height: 34,
            border: "3px solid rgba(37,211,102,0.2)",
            borderTopColor: "#25D366",
            borderRadius: "50%",
            animation: "spin 0.9s linear infinite",
          }}
        />
      </div>
    );
  }

  const previewUrl = normalizeWhatsAppUrl(config.groupLink);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 760 }}>
      {statusMsg && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            background: statusMsg.type === "ok" ? "rgba(37,211,102,0.12)" : "rgba(239,68,68,0.12)",
            border: `1px solid ${statusMsg.type === "ok" ? "rgba(37,211,102,0.35)" : "rgba(239,68,68,0.35)"}`,
            color: statusMsg.type === "ok" ? "#128C7E" : "#ef4444",
            fontWeight: 700,
            fontSize: 13.5,
          }}
        >
          {statusMsg.text}
        </div>
      )}

      {/* Main Config Card */}
      <div className="neu-card" style={{ borderRadius: 18 }}>
        <div className="card-body">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: "linear-gradient(135deg, #25D366, #128C7E)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  boxShadow: "0 6px 16px rgba(37,211,102,0.32)",
                  flexShrink: 0,
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.031 2c-5.516 0-9.969 4.453-9.969 9.969 0 1.766.469 3.484 1.344 5l-1.406 5.156 5.281-1.375c1.469.797 3.109 1.219 4.75 1.219 5.516 0 9.969-4.453 9.969-9.969S17.547 2 12.031 2zm5.813 14.125c-.25.703-1.438 1.344-1.984 1.422-.516.078-1.172.109-1.891-.125-.438-.141-1-.328-1.719-.641-3.016-1.312-4.984-4.359-5.141-4.562-.156-.203-1.234-1.641-1.234-3.125s.781-2.219 1.063-2.516c.281-.297.609-.375.813-.375.203 0 .406.016.578.016.188 0 .438-.078.688.531.25.609.859 2.094.938 2.25.078.156.125.344.016.547-.109.203-.156.328-.313.516-.156.188-.328.406-.469.547-.156.156-.313.328-.141.641.172.313.781 1.281 1.672 2.078 1.156 1.031 2.125 1.344 2.438 1.5.313.156.484.125.672-.078.188-.203.766-.891.969-1.203.203-.313.406-.266.688-.156.281.109 1.781.844 2.094 1 .313.156.516.234.594.359.078.125.078.734-.172 1.438z" />
                </svg>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "var(--text)" }}>
                  WhatsApp Group & Floating Bubble
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
                  Upload your official WhatsApp group invite link. Users will see a draggable, animated WhatsApp bubble across the app.
                </p>
              </div>
            </div>

            {/* Visibility Toggle */}
            <button
              type="button"
              onClick={() => void handleToggleEnabled()}
              disabled={saving}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                borderRadius: 999,
                border: `1px solid ${config.enabled ? "rgba(37,211,102,0.4)" : "var(--stroke)"}`,
                background: config.enabled ? "rgba(37,211,102,0.12)" : "var(--bg2)",
                color: config.enabled ? "#128C7E" : "var(--muted)",
                fontWeight: 800,
                fontSize: 12.5,
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: config.enabled ? "#25D366" : "#94a3b8",
                  boxShadow: config.enabled ? "0 0 8px #25D366" : "none",
                }}
              />
              {config.enabled ? "Bubble Active" : "Bubble Hidden"}
            </button>
          </div>

          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 800, color: "var(--text)", marginBottom: 6 }}>
                WhatsApp Group Invite Link *
              </label>
              <input
                type="url"
                className="input"
                value={config.groupLink}
                onChange={(e) => setConfig((c) => ({ ...c, groupLink: e.target.value }))}
                placeholder="https://chat.whatsapp.com/YourGroupInviteCode"
                style={{ width: "100%", padding: "11px 14px", fontSize: 14 }}
                required
              />
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>
                Paste the invite link from WhatsApp (Group Info → Invite via link → Copy link).
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 800, color: "var(--text)", marginBottom: 6 }}>
                Bubble Tooltip Label
              </label>
              <input
                type="text"
                className="input"
                value={config.label}
                onChange={(e) => setConfig((c) => ({ ...c, label: e.target.value }))}
                placeholder="Join WhatsApp Group"
                maxLength={40}
                style={{ width: "100%", padding: "11px 14px", fontSize: 14 }}
              />
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>
                Short label shown beside the floating WhatsApp bubble (max 40 characters).
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", paddingTop: 4 }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: "11px 22px",
                  borderRadius: 12,
                  border: "none",
                  background: "linear-gradient(135deg, #25D366, #128C7E)",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: saving ? "not-allowed" : "pointer",
                  boxShadow: "0 6px 18px rgba(37,211,102,0.3)",
                }}
              >
                {saving ? "Saving…" : "Save WhatsApp Group Link"}
              </button>

              {previewUrl && isValidWhatsAppLink(previewUrl) && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="neu-btn btn-ghost"
                  style={{
                    padding: "10px 16px",
                    borderRadius: 12,
                    fontSize: 13,
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>↗</span> Test Group Link
                </a>
              )}
            </div>
          </form>

          {config.updatedAt && (
            <div style={{ marginTop: 16, fontSize: 11.5, color: "var(--muted)" }}>
              Last updated: {new Date(config.updatedAt).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* Live Preview Info Card */}
      <div className="neu-card" style={{ borderRadius: 18 }}>
        <div className="card-body">
          <h4 style={{ margin: "0 0 8px", fontSize: 14.5, fontWeight: 800, color: "var(--text)" }}>
            Floating Bubble Behavior
          </h4>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--muted)", lineHeight: 1.7 }}>
            <li>Automatically appears on all user pages once a valid link is saved and active.</li>
            <li>Users can <strong>drag and move</strong> the bubble anywhere around the screen (desktop &amp; mobile touch).</li>
            <li>Smoothly snaps to the nearest screen edge and remembers its position across pages.</li>
            <li>Tapping or clicking opens your WhatsApp group invite link in WhatsApp / new tab.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
