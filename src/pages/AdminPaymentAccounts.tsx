import { useEffect, useState } from "react";
import { onValue, ref, remove, set, update } from "firebase/database";
import { db } from "@/firebase";

export interface PaymentMethodItem {
  id: string;
  name: string;
  category: "mobile" | "crypto";
  network?: string;
  accountName: string;
  accountNo: string;
  currency: string;
  minAmount: number;
  color?: string;
  bg?: string;
  logo?: string;
  qrCode?: string;
  instructions?: string;
  hint?: string;
  confirmations?: number;
  enabled: boolean;
  order?: number;
  updatedAt?: number;
}

// Preset logos for quick one-tap selection
const LOGO_PRESETS = [
  { name: "EcoCash", url: "/assets/ecocash-CHHvbg1s.png", color: "#e31e24", category: "mobile" },
  { name: "OneMoney", url: "/assets/onemoney-6fa-RLkc.png", color: "#f7a800", category: "mobile" },
  { name: "TeleCash", url: "/assets/telecash-DWcJuOSx.png", color: "#0057a8", category: "mobile" },
  { name: "InnBucks", url: "https://innbucks.co.zw/wp-content/uploads/2022/03/Innbucks-logo.png", color: "#1565c0", category: "mobile" },
  { name: "Binance", url: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png", color: "#F3BA2F", category: "crypto" },
  { name: "Tether (USDT)", url: "https://assets.coingecko.com/coins/images/325/large/Tether.png", color: "#26a17b", category: "crypto" },
  { name: "Bitcoin (BTC)", url: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png", color: "#F7931A", category: "crypto" },
  { name: "Ethereum (ETH)", url: "https://assets.coingecko.com/coins/images/279/large/ethereum.png", color: "#627EEA", category: "crypto" },
];

const DEFAULT_METHODS: PaymentMethodItem[] = [
  {
    id: "ecocash",
    name: "EcoCash",
    category: "mobile",
    accountName: "AUTEX PAYMENTS",
    accountNo: "0771000001",
    currency: "USD",
    minAmount: 10,
    color: "#e31e24",
    bg: "rgba(227,30,36,0.10)",
    logo: "/assets/ecocash-CHHvbg1s.png",
    hint: "07X XXX XXXX",
    instructions: "Send USD to the Merchant/EcoCash number above and upload your transaction SMS/receipt screenshot.",
    enabled: true,
    order: 1,
  },
  {
    id: "onemoney",
    name: "OneMoney",
    category: "mobile",
    accountName: "AUTEX PAYMENTS",
    accountNo: "0712000001",
    currency: "USD",
    minAmount: 10,
    color: "#f7a800",
    bg: "rgba(247,168,0,0.10)",
    logo: "/assets/onemoney-6fa-RLkc.png",
    hint: "071 XXX XXXX",
    instructions: "Send USD to the OneMoney number above and upload your SMS receipt.",
    enabled: true,
    order: 2,
  },
  {
    id: "innbucks",
    name: "InnBucks",
    category: "mobile",
    accountName: "AUTEX PAYMENTS",
    accountNo: "0773000001",
    currency: "USD",
    minAmount: 10,
    color: "#1565c0",
    bg: "rgba(21,101,192,0.10)",
    logo: "https://innbucks.co.zw/wp-content/uploads/2022/03/Innbucks-logo.png",
    hint: "077 XXX XXXX",
    instructions: "Deposit to InnBucks account and provide proof screenshot.",
    enabled: true,
    order: 3,
  },
  {
    id: "telecash",
    name: "TeleCash",
    category: "mobile",
    accountName: "AUTEX PAYMENTS",
    accountNo: "0732000001",
    currency: "USD",
    minAmount: 10,
    color: "#0057a8",
    bg: "rgba(0,87,168,0.10)",
    logo: "/assets/telecash-DWcJuOSx.png",
    hint: "073 XXX XXXX",
    instructions: "Transfer USD to TeleCash number and submit confirmation receipt.",
    enabled: true,
    order: 4,
  },
  {
    id: "usdt-trc20",
    name: "Binance / USDT",
    category: "crypto",
    network: "TRC20 · Tron",
    accountName: "AUTEX BINANCE WALLET",
    accountNo: "TYour_USDT_TRC20_Address_Here",
    currency: "USDT",
    minAmount: 10,
    color: "#26a17b",
    bg: "rgba(38,161,123,0.10)",
    logo: "https://assets.coingecko.com/coins/images/325/large/Tether.png",
    confirmations: 1,
    instructions: "Transfer USDT via Tron (TRC20) network or Binance Pay to this address. Confirm transaction hash.",
    enabled: true,
    order: 1,
  },
  {
    id: "bnb-bep20",
    name: "Binance (BNB)",
    category: "crypto",
    network: "BEP20 · BNB Smart Chain",
    accountName: "AUTEX BINANCE WALLET",
    accountNo: "0xYour_BNB_BEP20_Address_Here",
    currency: "BNB",
    minAmount: 10,
    color: "#F3BA2F",
    bg: "rgba(243,186,47,0.10)",
    logo: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png",
    confirmations: 15,
    instructions: "Send BNB via BNB Smart Chain (BEP20) to this address.",
    enabled: true,
    order: 2,
  },
  {
    id: "btc-mainnet",
    name: "Bitcoin (BTC)",
    category: "crypto",
    network: "Bitcoin Network",
    accountName: "AUTEX BINANCE WALLET",
    accountNo: "bc1Your_Bitcoin_Address_Here",
    currency: "BTC",
    minAmount: 15,
    color: "#F7931A",
    bg: "rgba(247,147,26,0.10)",
    logo: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
    confirmations: 3,
    instructions: "Send BTC to this Bitcoin Native SegWit address. Requires 3 network confirmations.",
    enabled: true,
    order: 3,
  },
];

export function AdminPaymentAccounts() {
  const [methods, setMethods] = useState<PaymentMethodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"mobile" | "crypto">("mobile");
  const [editingItem, setEditingItem] = useState<PaymentMethodItem | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function showToast(msg: string, type: "ok" | "err" = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  // Load from Firebase Realtime Database
  useEffect(() => {
    const r = ref(db, "paymentMethods");
    return onValue(r, (snap) => {
      const data = snap.val() as Record<string, PaymentMethodItem> | null;
      if (data) {
        const list = Object.entries(data).map(([id, val]) => ({
          ...val,
          id,
        })).sort((a, b) => (a.order || 99) - (b.order || 99));
        setMethods(list);
      } else {
        setMethods([]);
      }
      setLoading(false);
    });
  }, []);

  // Quick Seed Defaults if DB is empty
  async function seedDefaults() {
    setSaving(true);
    try {
      for (const item of DEFAULT_METHODS) {
        await set(ref(db, `paymentMethods/${item.id}`), {
          ...item,
          updatedAt: Date.now(),
        });
      }
      showToast("Default payment networks & Binance addresses seeded successfully! ✅");
    } catch (err: any) {
      showToast(err?.message || "Failed to seed defaults", "err");
    } finally {
      setSaving(false);
    }
  }

  // Toggle active/enabled
  async function toggleStatus(item: PaymentMethodItem) {
    try {
      await update(ref(db, `paymentMethods/${item.id}`), {
        enabled: !item.enabled,
        updatedAt: Date.now(),
      });
      showToast(`${item.name} is now ${!item.enabled ? "ACTIVE (Enabled)" : "DISABLED"}!`);
    } catch (err: any) {
      showToast(err?.message || "Failed to update status", "err");
    }
  }

  // Open modal for new item
  function handleAddNew(category: "mobile" | "crypto") {
    setIsNew(true);
    setEditingItem({
      id: `${category}-${Date.now().toString(36)}`,
      name: category === "mobile" ? "New Mobile Network" : "Binance / Crypto Network",
      category,
      network: category === "crypto" ? "TRC20 · Tron" : "Mobile Network",
      accountName: "AUTEX OFFICIAL",
      accountNo: "",
      currency: category === "crypto" ? "USDT" : "USD",
      minAmount: 10,
      color: category === "crypto" ? "#26a17b" : "#00a651",
      instructions: "Transfer the exact amount and upload your payment proof screenshot.",
      enabled: true,
      order: (methods.filter(m => m.category === category).length) + 1,
    });
  }

  // Save changes to item
  async function handleSaveItem() {
    if (!editingItem) return;
    if (!editingItem.name.trim() || !editingItem.accountNo.trim()) {
      showToast("Network Name and Account Number/Address are required.", "err");
      return;
    }

    setSaving(true);
    try {
      const cleanId = editingItem.id.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-");
      await set(ref(db, `paymentMethods/${cleanId}`), {
        ...editingItem,
        id: cleanId,
        minAmount: Number(editingItem.minAmount) || 10,
        updatedAt: Date.now(),
      });
      showToast(`${editingItem.name} account details saved! ✅`);
      setEditingItem(null);
      setIsNew(false);
    } catch (err: any) {
      showToast(err?.message || "Failed to save account details", "err");
    } finally {
      setSaving(false);
    }
  }

  // Delete item
  async function handleDeleteItem() {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      await remove(ref(db, `paymentMethods/${id}`));
      showToast("Payment account removed successfully.");
    } catch (err: any) {
      showToast(err?.message || "Failed to delete item", "err");
    }
  }

  const currentMethods = methods.filter(m => m.category === activeTab);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Toast alert */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            zIndex: 999999,
            padding: "12px 20px",
            borderRadius: 12,
            background: toast.type === "err" ? "#ef4444" : "#00a651",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13.5,
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            animation: "fadeIn 0.2s ease",
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* Top Controls Card */}
      <div className="neu-card" style={{ borderRadius: 18 }}>
        <div className="card-body">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
            <div>
              <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: "var(--text)" }}>
                Deposit Accounts & Addresses
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                Configure payment account details and Binance/crypto addresses shown to users on the Deposit page.
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {methods.length === 0 && (
                <button
                  className="neu-btn"
                  style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff", fontWeight: 700, fontSize: 12.5 }}
                  onClick={seedDefaults}
                  disabled={saving}
                >
                  ⚡ Populate Default Accounts
                </button>
              )}
              <button
                className="neu-btn"
                style={{ background: "var(--accent)", color: "#fff", fontWeight: 800, fontSize: 12.5 }}
                onClick={() => handleAddNew(activeTab)}
              >
                + Add {activeTab === "mobile" ? "Mobile Account" : "Binance / Crypto Address"}
              </button>
            </div>
          </div>

          {/* Category Tabs */}
          <div style={{ display: "flex", gap: 8, marginTop: 18, borderBottom: "1px solid var(--stroke)", paddingBottom: 10 }}>
            <button
              onClick={() => setActiveTab("mobile")}
              style={{
                padding: "8px 18px",
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 800,
                background: activeTab === "mobile" ? "var(--accent)" : "var(--bg2)",
                color: activeTab === "mobile" ? "#fff" : "var(--muted)",
                transition: "all 0.2s ease",
              }}
            >
              📱 Mobile Money ({methods.filter(m => m.category === "mobile").length})
            </button>
            <button
              onClick={() => setActiveTab("crypto")}
              style={{
                padding: "8px 18px",
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 800,
                background: activeTab === "crypto" ? "var(--accent)" : "var(--bg2)",
                color: activeTab === "crypto" ? "#fff" : "var(--muted)",
                transition: "all 0.2s ease",
              }}
            >
              🪙 Binance & Crypto ({methods.filter(m => m.category === "crypto").length})
            </button>
          </div>
        </div>
      </div>

      {/* Accounts List Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
          Loading payment accounts…
        </div>
      ) : currentMethods.length === 0 ? (
        <div className="neu-card" style={{ padding: 40, textAlign: "center", borderRadius: 18 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🏦</div>
          <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>No {activeTab === "mobile" ? "Mobile Money" : "Binance / Crypto"} Accounts Configured</h3>
          <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: 13 }}>
            Add your accounts so users can see where to deposit funds.
          </p>
          <button
            className="neu-btn"
            style={{ background: "var(--accent)", color: "#fff", fontWeight: 700 }}
            onClick={() => handleAddNew(activeTab)}
          >
            + Add First {activeTab === "mobile" ? "Mobile Network" : "Crypto Address"}
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {currentMethods.map((item) => (
            <div
              key={item.id}
              className="neu-card"
              style={{
                borderRadius: 18,
                border: item.enabled ? "1px solid var(--stroke)" : "1px dashed rgba(239,68,68,0.4)",
                opacity: item.enabled ? 1 : 0.7,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                overflow: "hidden",
                transition: "all 0.2s ease",
              }}
            >
              <div className="card-body">
                {/* Header row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {item.logo ? (
                      <img
                        src={item.logo}
                        alt={item.name}
                        style={{ width: 42, height: 42, borderRadius: 10, objectFit: "contain", background: "#fff", padding: 3, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}
                        onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 10,
                          background: item.color || "var(--accent)",
                          color: "#fff",
                          fontWeight: 800,
                          fontSize: 16,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {item.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)" }}>{item.name}</div>
                      {item.network && (
                        <div style={{ fontSize: 11.5, color: "var(--accent)", fontWeight: 700 }}>
                          {item.network}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status Toggle Switch */}
                  <button
                    onClick={() => toggleStatus(item)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: "none",
                      fontSize: 10.5,
                      fontWeight: 800,
                      cursor: "pointer",
                      background: item.enabled ? "rgba(0,166,81,0.15)" : "rgba(239,68,68,0.15)",
                      color: item.enabled ? "#00a651" : "#ef4444",
                    }}
                  >
                    {item.enabled ? "ACTIVE" : "DISABLED"}
                  </button>
                </div>

                {/* Account Details Box */}
                <div
                  style={{
                    background: "rgba(0,0,0,0.03)",
                    borderRadius: 12,
                    padding: "10px 12px",
                    border: "1px solid var(--stroke)",
                    marginBottom: 12,
                  }}
                >
                  <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
                    {item.category === "crypto" ? "Wallet Address / Pay ID" : "Account Number / Phone"}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text)", fontFamily: "monospace", wordBreak: "break-all" }}>
                    {item.accountNo || "—"}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--stroke)" }}>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>Account Name</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{item.accountName || "AUTEX OFFICIAL"}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>Min Deposit</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--accent)" }}>{item.minAmount} {item.currency}</div>
                    </div>
                  </div>
                </div>

                {/* Custom Instruction preview */}
                {item.instructions && (
                  <div style={{ fontSize: 11.5, color: "var(--muted)", fontStyle: "italic", lineHeight: 1.4, marginBottom: 12 }}>
                    "{item.instructions}"
                  </div>
                )}
              </div>

              {/* Action buttons footer */}
              <div
                style={{
                  padding: "10px 16px",
                  background: "rgba(0,0,0,0.02)",
                  borderTop: "1px solid var(--stroke)",
                  display: "flex",
                  gap: 8,
                  justifyContent: "flex-end",
                }}
              >
                <button
                  className="neu-btn btn-ghost"
                  style={{ fontSize: 12, padding: "6px 12px", color: "var(--danger)" }}
                  onClick={() => setConfirmDeleteId(item.id)}
                >
                  Delete
                </button>
                <button
                  className="neu-btn"
                  style={{ fontSize: 12, padding: "6px 14px", background: "var(--accent)", color: "#fff", fontWeight: 700 }}
                  onClick={() => { setIsNew(false); setEditingItem(item); }}
                >
                  Edit Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Edit / Add Modal ── */}
      {editingItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            padding: 16,
          }}
          onClick={() => setEditingItem(null)}
        >
          <div
            className="neu-card"
            style={{
              maxWidth: 500,
              width: "100%",
              borderRadius: 20,
              padding: 24,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                {isNew ? "+ Add New Payment Network" : `Edit ${editingItem.name}`}
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: "var(--bg2)", cursor: "pointer", color: "var(--muted)" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Category selector */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Category</label>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => setEditingItem({ ...editingItem, category: "mobile", currency: "USD" })}
                    style={{
                      flex: 1,
                      padding: "8px",
                      borderRadius: 10,
                      border: "1px solid var(--stroke)",
                      background: editingItem.category === "mobile" ? "var(--accent)" : "var(--bg2)",
                      color: editingItem.category === "mobile" ? "#fff" : "var(--text)",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Mobile Money
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingItem({ ...editingItem, category: "crypto", currency: "USDT" })}
                    style={{
                      flex: 1,
                      padding: "8px",
                      borderRadius: 10,
                      border: "1px solid var(--stroke)",
                      background: editingItem.category === "crypto" ? "var(--accent)" : "var(--bg2)",
                      color: editingItem.category === "crypto" ? "#fff" : "var(--text)",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Binance / Crypto
                  </button>
                </div>
              </div>

              {/* Preset Logos quick-pick */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                  Choose Preset Logo
                </label>
                <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
                  {LOGO_PRESETS.filter(p => p.category === editingItem.category).map(preset => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => setEditingItem({
                        ...editingItem,
                        logo: preset.url,
                        color: preset.color,
                        name: isNew ? preset.name : editingItem.name,
                      })}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 8,
                        border: editingItem.logo === preset.url ? "2px solid var(--accent)" : "1px solid var(--stroke)",
                        background: "var(--bg2)",
                        cursor: "pointer",
                        fontSize: 11,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <img src={preset.url} alt="" style={{ width: 14, height: 14, objectFit: "contain" }} onError={e => { (e.target as HTMLElement).style.display = "none"; }} />
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Network Name */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Network Name *</label>
                <input
                  className="input"
                  style={{ width: "100%", marginTop: 4 }}
                  value={editingItem.name}
                  onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                  placeholder="e.g. EcoCash, Binance Pay, USDT"
                  required
                />
              </div>

              {/* Blockchain network label */}
              {editingItem.category === "crypto" && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Network / Chain (TRC20, BEP20, ERC20)</label>
                  <input
                    className="input"
                    style={{ width: "100%", marginTop: 4 }}
                    value={editingItem.network || ""}
                    onChange={e => setEditingItem({ ...editingItem, network: e.target.value })}
                    placeholder="e.g. TRC20 · Tron, BEP20 · BNB Chain"
                  />
                </div>
              )}

              {/* Account Number / Crypto Address */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                  {editingItem.category === "crypto" ? "Deposit Address / Binance Pay ID *" : "Account Number / Phone *"}
                </label>
                <input
                  className="input"
                  style={{ width: "100%", marginTop: 4, fontFamily: "monospace", fontSize: 13 }}
                  value={editingItem.accountNo}
                  onChange={e => setEditingItem({ ...editingItem, accountNo: e.target.value.trim() })}
                  placeholder={editingItem.category === "crypto" ? "e.g. Txyz... or Binance Pay ID" : "e.g. 0771000001"}
                  required
                />
              </div>

              {/* Account Name */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Account Name / Payee Name</label>
                <input
                  className="input"
                  style={{ width: "100%", marginTop: 4 }}
                  value={editingItem.accountName}
                  onChange={e => setEditingItem({ ...editingItem, accountName: e.target.value })}
                  placeholder="e.g. AUTEX OFFICIAL / COMPANY NAME"
                />
              </div>

              {/* Min amount & Currency */}
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Currency</label>
                  <input
                    className="input"
                    style={{ width: "100%", marginTop: 4 }}
                    value={editingItem.currency}
                    onChange={e => setEditingItem({ ...editingItem, currency: e.target.value.toUpperCase() })}
                    placeholder="USD, USDT, BTC"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Minimum Amount</label>
                  <input
                    className="input"
                    type="number"
                    style={{ width: "100%", marginTop: 4 }}
                    value={editingItem.minAmount}
                    onChange={e => setEditingItem({ ...editingItem, minAmount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              {/* Custom Instructions */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Instructions to User</label>
                <textarea
                  className="textarea"
                  rows={2}
                  style={{ width: "100%", marginTop: 4, fontSize: 12.5 }}
                  value={editingItem.instructions || ""}
                  onChange={e => setEditingItem({ ...editingItem, instructions: e.target.value })}
                  placeholder="e.g. Send to above account and upload screenshot of receipt"
                />
              </div>

              {/* Custom Logo URL */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Custom Logo Image URL (Optional)</label>
                <input
                  className="input"
                  style={{ width: "100%", marginTop: 4, fontSize: 12 }}
                  value={editingItem.logo || ""}
                  onChange={e => setEditingItem({ ...editingItem, logo: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>

            {/* Modal actions */}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                className="neu-btn btn-ghost"
                style={{ flex: 1, padding: "10px" }}
                onClick={() => setEditingItem(null)}
              >
                Cancel
              </button>
              <button
                className="neu-btn"
                style={{ flex: 1.4, padding: "10px", background: "var(--accent)", color: "#fff", fontWeight: 800 }}
                onClick={handleSaveItem}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save Payment Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999999,
            padding: 16,
          }}
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="neu-card"
            style={{ maxWidth: 400, width: "100%", padding: 24, borderRadius: 18 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 32, marginBottom: 10, textAlign: "center" }}>🗑️</div>
            <h3 style={{ margin: "0 0 8px", fontSize: 17, textAlign: "center" }}>Delete Payment Account?</h3>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--muted)", textAlign: "center", lineHeight: 1.5 }}>
              Are you sure you want to delete this payment account? Users will no longer see it on the deposit page.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="neu-btn btn-ghost"
                style={{ flex: 1, padding: "10px" }}
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </button>
              <button
                className="neu-btn"
                style={{ flex: 1, padding: "10px", background: "var(--danger)", color: "#fff", fontWeight: 700 }}
                onClick={handleDeleteItem}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
