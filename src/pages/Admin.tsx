import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ref, onValue, update, set, get, remove, push } from "firebase/database";
import { db } from "@/firebase";
import { useAuth } from "@/context/AuthContext";
import { BOTS, getBotById } from "@/lib/bots";
import { AdminNotifications } from "./AdminNotifications";
import { AdminSettings } from "./AdminSettings";
import { AdminPaymentAccounts } from "./AdminPaymentAccounts";
import { AdminWhatsApp } from "./AdminWhatsApp";
import { AdminUserAccess } from "./AdminUserAccess";

/* ── Types ─────────────────────────────────────────── */
type AdminTab =
  | "overview"
  | "bots"
  | "withdrawals"
  | "payments"
  | "payment-methods"
  | "users"
  | "user-access"
  | "whatsapp"
  | "notifications"
  | "settings";

interface UserBotItem {
  key: string;
  uid: string;
  bot: string;
  botName: string;
  amount: number;
  dailyPct: number;
  dailyReturn: number;
  activatedAt: number;
  status: string;
  lastClaimedDate?: string;
  lastClaimedAt?: number;
  totalEarned?: number;
}

interface WithdrawItem {
  key: string;
  uid: string;
  network?: string;
  networkName?: string;
  amount: number;
  currency?: string;
  destination: string;
  accountName?: string;
  type?: string;
  fee?: number;
  feeRate?: string;
  status: "pending" | "completed" | "rejected";
  createdAt: number;
  processedAt?: number;
  adminNote?: string;
  // joined from users list
  userPhone?: string;
  userName?: string;
}

interface PaymentItem {
  key: string;
  uid: string;
  amount: number;
  currency?: string;
  type?: string;
  depositType?: string;
  botId?: string;
  botName?: string;
  status: string;
  description?: string;
  createdAt: number;
  network?: string;
  networkName?: string;
  phone?: string;
  senderName?: string;
  txHash?: string;
  accountNo?: string;
  accountName?: string;
  proofUrl?: string;
  approvedAt?: number;
  rejectedAt?: number;
  commissionProcessed?: boolean;
  adminNote?: string;
  deletedFromAdmin?: boolean;
}

interface UserProfile {
  uid: string;
  displayName?: string;
  phone?: string;
  email?: string;
  createdAt?: number;
  affiliateCode?: string;
  role?: string;
  referredBy?: string;
  referredByL2?: string;
  referredByL3?: string;
  balance?: number;
}

interface PopupDialog {
  isOpen: boolean;
  type: "confirm" | "prompt";
  title: string;
  message: string;
  confirmLabel?: string;
  confirmColor?: string;
  cancelLabel?: string;
  defaultValue?: string;
  inputValue?: string;
  inputPlaceholder?: string;
  onConfirm: (inputVal?: string) => void | Promise<void>;
}

function fmt(n: number) {
  return (n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(ms?: number) {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Admin() {
  const { user, isAdmin, refreshClaims } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Tab State
  const [tab, setTab] = useState<AdminTab>("overview");

  // Read ?tab= from URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get("tab");
    const validTabs: AdminTab[] = [
      "overview", "bots", "withdrawals", "payments",
      "payment-methods", "users", "notifications", "settings",
    ];
    if (tabParam && validTabs.includes(tabParam as AdminTab)) {
      setTab(tabParam as AdminTab);
    }
  }, [location.search]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Live Data States
  const [userBots, setUserBots] = useState<UserBotItem[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Search/Filter states
  const [botSearch, setBotSearch] = useState("");
  const [withdrawStatus, setWithdrawStatus] = useState<"all" | "pending" | "completed" | "rejected">("all");
  const [withdrawSearch, setWithdrawSearch] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<"all" | "pending" | "completed" | "rejected">("all");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<PaymentItem | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Custom Popup Dialog state (replaces native alert/confirm/prompt)
  const [popupDialog, setPopupDialog] = useState<PopupDialog | null>(null);

  // Edit User Details & Balance state
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editPhone, setEditPhone] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("user");
  const [editAffiliateCode, setEditAffiliateCode] = useState("");
  const [editReferredBy, setEditReferredBy] = useState("");
  const [editBalance, setEditBalance] = useState("");
  const [editBalanceReason, setEditBalanceReason] = useState("");
  const [savingUser, setSavingUser] = useState(false);

  // Action states
  const [processingKey, setProcessingKey] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  const showMsg = (text: string, type: "ok" | "err" = "ok") => {
    setActionMsg({ text, type });
    setTimeout(() => setActionMsg(null), 3500);
  };

  // Live balance calculation for any user
  function getUserBalance(uid: string): number {
    const userPays = payments.filter(
      (p) => p.uid === uid && ["completed", "success", "paid"].includes(String(p.status || "").toLowerCase())
    );
    const totalIn = userPays.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const userWiths = withdrawals.filter(
      (w) => w.uid === uid && !["failed", "rejected", "cancelled"].includes(String(w.status || "").toLowerCase())
    );
    const totalOut = userWiths.reduce((sum, w) => sum + (Number(w.amount) || 0), 0);

    return Math.max(0, totalIn - totalOut);
  }

  function handleOpenEditUser(u: UserProfile) {
    setEditingUser(u);
    setEditPhone(u.phone || "");
    setEditDisplayName(u.displayName || u.phone || "");
    setEditEmail(u.email || "");
    setEditRole(u.role || "user");
    setEditAffiliateCode(u.affiliateCode || "");
    setEditReferredBy(u.referredBy || "");
    const curBal = getUserBalance(u.uid);
    setEditBalance(curBal.toFixed(2));
    setEditBalanceReason("");
  }

  async function handleSaveUser() {
    if (!editingUser) return;
    setSavingUser(true);
    try {
      const curBal = getUserBalance(editingUser.uid);
      const targetBal = Math.max(0, parseFloat(editBalance) || 0);
      const diff = parseFloat((targetBal - curBal).toFixed(2));

      // Balance adjustment if changed
      if (Math.abs(diff) >= 0.01) {
        if (diff > 0) {
          const adjRef = await push(ref(db, `userPayments/${editingUser.uid}`), {
            amount: diff,
            currency: "USD",
            type: "admin_adjustment",
            status: "completed",
            description: editBalanceReason.trim() || `Admin balance adjustment (Credit +$${fmt(diff)})`,
            createdAt: Date.now(),
          });
          await sendUserNotification(
            editingUser.uid,
            "💵 Balance Credited",
            `Your wallet balance has been credited with +$${fmt(diff)} USD by administrator. New balance: $${fmt(targetBal)} USD.${editBalanceReason.trim() ? ` Note: ${editBalanceReason.trim()}.` : ""} Ref: ${adjRef.key.slice(0, 16)}.`,
            "balance_adjustment",
            {
              amount: diff,
              newBalance: targetBal,
              reason: editBalanceReason.trim() || "Admin balance credit",
              reference: adjRef.key,
              processedAt: Date.now(),
            }
          );
        } else {
          const dedRef = await push(ref(db, `withdrawRequests/${editingUser.uid}`), {
            amount: Math.abs(diff),
            currency: "USD",
            type: "admin_deduction",
            destination: "Admin Adjustment",
            status: "completed",
            description: editBalanceReason.trim() || `Admin balance deduction (-$${fmt(Math.abs(diff))})`,
            createdAt: Date.now(),
            processedAt: Date.now(),
          });
          await sendUserNotification(
            editingUser.uid,
            "📉 Balance Adjusted",
            `Your wallet balance has been adjusted with -$${fmt(Math.abs(diff))} USD by administrator. New balance: $${fmt(targetBal)} USD.${editBalanceReason.trim() ? ` Note: ${editBalanceReason.trim()}.` : ""} Ref: ${dedRef.key.slice(0, 16)}.`,
            "balance_adjustment",
            {
              amount: Math.abs(diff),
              newBalance: targetBal,
              reason: editBalanceReason.trim() || "Admin balance deduction",
              reference: dedRef.key,
              processedAt: Date.now(),
            }
          );
        }
      }

      // Update user document
      const cleanPhone = editPhone.trim();
      const cleanCode = editAffiliateCode.trim().toUpperCase();
      const updates: Record<string, any> = {
        phone: cleanPhone,
        displayName: editDisplayName.trim() || cleanPhone,
        email: editEmail.trim(),
        role: editRole,
        balance: targetBal,
        updatedAt: Date.now(),
      };
      if (cleanCode) updates.affiliateCode = cleanCode;
      if (editReferredBy.trim()) updates.referredBy = editReferredBy.trim();

      await update(ref(db, `users/${editingUser.uid}`), updates);

      // Keep affiliateCodes index in sync
      if (cleanCode) {
        await set(ref(db, `affiliateCodes/${cleanCode}`), editingUser.uid);
      }

      // Keep admins node in sync
      if (editRole === "admin") {
        await set(ref(db, `admins/${editingUser.uid}`), true);
      } else {
        await remove(ref(db, `admins/${editingUser.uid}`));
      }

      showMsg(`User ${cleanPhone || editingUser.uid.slice(0, 8)} updated successfully! Balance set to $${fmt(targetBal)} ✅`);
      setEditingUser(null);
    } catch (err: any) {
      showMsg(err?.message || "Failed to update user details.", "err");
    } finally {
      setSavingUser(false);
    }
  }

  async function handleClaimAdminRole() {
    if (!user) return;
    try {
      await set(ref(db, `users/${user.uid}/role`), "admin");
      await refreshClaims();
      showMsg("Admin role activated for your account! 👑");
    } catch (err: any) {
      showMsg(err?.message || "Failed to set admin role.", "err");
    }
  }

  /* ── Firebase Listeners ────────────────────────────── */
  useEffect(() => {
    if (!user || !isAdmin) {
      setLoading(false);
      return;
    }

    // 1. All Active User Bots
    const botsRef = ref(db, "userBots");
    const unsubBots = onValue(botsRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val() as Record<string, Record<string, any>>;
        const list: UserBotItem[] = [];
        Object.entries(val).forEach(([uid, botsMap]) => {
          if (botsMap && typeof botsMap === "object") {
            Object.entries(botsMap).forEach(([key, b]) => {
              list.push({
                key,
                uid,
                bot: b.bot || "nano",
                botName: b.botName || "AI Bot",
                amount: Number(b.amount || 0),
                dailyPct: Number(b.dailyPct || (b.amount >= 100 ? 15 : 12)),
                dailyReturn: Number(b.dailyReturn || 0),
                activatedAt: Number(b.activatedAt || 0),
                status: b.status || "active",
                lastClaimedDate: b.lastClaimedDate,
                lastClaimedAt: b.lastClaimedAt,
                totalEarned: Number(b.totalEarned || 0),
              });
            });
          }
        });
        list.sort((a, b) => b.activatedAt - a.activatedAt);
        setUserBots(list);
      } else {
        setUserBots([]);
      }
    });

    // 2. All Withdrawal Requests
    const wRef = ref(db, "withdrawRequests");
    const unsubW = onValue(wRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val() as Record<string, Record<string, any>>;
        const list: WithdrawItem[] = [];
        Object.entries(val).forEach(([uid, reqsMap]) => {
          if (reqsMap && typeof reqsMap === "object") {
            Object.entries(reqsMap).forEach(([key, r]) => {
              const amt = Number(r.amount || 0);
              let feeDollar = 0;
              let feeRate = typeof r.fee === "string" ? r.fee : (r.feeRate || "8%");

              if (r.feeAmount != null && !isNaN(Number(r.feeAmount))) {
                feeDollar = Number(r.feeAmount);
              } else if (typeof r.fee === "string" && r.fee.includes("%")) {
                const pct = parseFloat(r.fee);
                if (!isNaN(pct)) feeDollar = (amt * pct) / 100;
              } else if (r.fee != null && !isNaN(Number(r.fee))) {
                const num = Number(r.fee);
                feeDollar = num <= 1 && num > 0 ? amt * num : num;
              } else {
                // Platform withdrawal fee across all networks is 8%
                feeDollar = (amt * 8) / 100;
              }

              list.push({
                key,
                uid,
                network: r.network,
                networkName: r.networkName,
                amount: amt,
                currency: r.currency || "USD",
                destination: r.destination || "",
                accountName: r.accountName || "",
                type: r.type,
                fee: Math.round(feeDollar * 100) / 100,
                feeRate,
                status: (r.status || "pending") as any,
                createdAt: Number(r.createdAt || 0),
                processedAt: r.processedAt,
                adminNote: r.adminNote,
              });
            });
          }
        });
        list.sort((a, b) => b.createdAt - a.createdAt);
        setWithdrawals(list);
      } else {
        setWithdrawals([]);
      }
    });

    // 3. All Payments & Deposits
    const pRef = ref(db, "userPayments");
    const unsubP = onValue(pRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val() as Record<string, Record<string, any>>;
        const list: PaymentItem[] = [];
        Object.entries(val).forEach(([uid, payMap]) => {
          if (payMap && typeof payMap === "object") {
            Object.entries(payMap).forEach(([key, p]) => {
              list.push({
                key,
                uid,
                amount: Number(p.amount || 0),
                currency: p.currency || "USD",
                type: p.type || "deposit",
                depositType: p.depositType,
                botId: p.botId,
                botName: p.botName,
                status: p.status || "pending",
                description: p.description,
                createdAt: Number(p.createdAt || 0),
                network: p.network,
                networkName: p.networkName,
                phone: p.phone,
                senderName: p.senderName,
                txHash: p.txHash || (p.depositType === "crypto" ? p.senderName : undefined),
                accountNo: p.accountNo,
                accountName: p.accountName,
                proofUrl: p.proofUrl,
                approvedAt: p.approvedAt,
                rejectedAt: p.rejectedAt,
                commissionProcessed: p.commissionProcessed,
                adminNote: p.adminNote,
                deletedFromAdmin: Boolean(p.deletedFromAdmin),
              });
            });
          }
        });
        list.sort((a, b) => b.createdAt - a.createdAt);
        setPayments(list);
      } else {
        setPayments([]);
      }
    });

    // 4. Users Directory
    const uRef = ref(db, "users");
    const unsubU = onValue(uRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val() as Record<string, any>;
        const list: UserProfile[] = Object.entries(val).map(([uid, u]) => ({
          uid,
          displayName: u.displayName || u.phone,
          phone: u.phone,
          email: u.email,
          createdAt: u.createdAt,
          affiliateCode: u.affiliateCode,
          role: u.role,
          referredBy: u.referredBy,
          referredByL2: u.referredByL2,
          referredByL3: u.referredByL3,
          balance: u.balance,
        }));
        list.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
        setUsersList(list);
      } else {
        setUsersList([]);
      }
      setLoading(false);
    });

    return () => {
      unsubBots();
      unsubW();
      unsubP();
      unsubU();
    };
  }, [isAdmin]);

  /* ── Helper: Send per-user notification ─────────────── */
  async function sendUserNotification(
    uid: string,
    title: string,
    message: string,
    type: string,
    meta?: Record<string, string | number | boolean | null | undefined>
  ) {
    try {
      // Strip any NaN / undefined / null values from meta — Firebase rejects NaN
      const cleanMeta: Record<string, string | number | boolean> = {};
      if (meta) {
        Object.entries(meta).forEach(([k, v]) => {
          if (v !== null && v !== undefined && !(typeof v === "number" && isNaN(v))) {
            cleanMeta[k] = v as string | number | boolean;
          }
        });
      }
      await push(ref(db, `userNotifications/${uid}`), {
        title,
        message,
        type,
        createdAt: Date.now(),
        read: false,
        ...(Object.keys(cleanMeta).length > 0 ? { meta: cleanMeta } : {}),
      });
    } catch (err) {
      console.warn("sendUserNotification error:", err);
    }
  }

  /* ── Actions: Withdrawals Approval / Rejection ───────── */
  function handleApproveWithdrawal(w: WithdrawItem) {
    const feeVal = w.fee != null && !isNaN(Number(w.fee)) ? Number(w.fee) : 0;
    const netAmt = Math.max(0, w.amount - feeVal);
    setPopupDialog({
      isOpen: true,
      type: "confirm",
      title: "Approve Withdrawal Payout",
      message: `Approve payout of $${fmt(netAmt)} (Requested: $${fmt(w.amount)}${feeVal > 0 ? `, Fee: $${fmt(feeVal)}` : ""}) to ${w.destination} (${w.accountName || "User"})?\n\nThis will mark the withdrawal as completed.`,
      confirmLabel: "Approve Payout",
      confirmColor: "#00a651",
      cancelLabel: "Cancel",
      onConfirm: async () => {
        setPopupDialog(null);
        setProcessingKey(w.key);
        try {
          await update(ref(db, `withdrawRequests/${w.uid}/${w.key}`), {
            status: "completed",
            processedAt: Date.now(),
            adminNote: "Approved & processed by admin",
          });
          // Update users/${w.uid}/balance in database
          const newBal = getUserBalance(w.uid);
          await update(ref(db, `users/${w.uid}`), { balance: newBal, updatedAt: Date.now() }).catch(() => {});
          // Notify user
          await sendUserNotification(
            w.uid,
            "💸 Withdrawal Approved",
            `Your withdrawal payout of $${fmt(w.amount)} ${w.currency || "USD"}${w.destination ? ` to ${w.destination}` : ""}${w.networkName || w.network ? ` via ${w.networkName || w.network}` : ""}${w.fee ? ` (Net: $${fmt(w.amount - w.fee)}, Fee: $${fmt(w.fee)})` : ""} has been approved and processed successfully. Ref: ${w.key.slice(0, 16)}.`,
            "withdrawal_approved",
            {
              amount: w.amount,
              currency: w.currency || "USD",
              network: w.networkName || w.network || null,
              destination: w.destination || null,
              accountName: w.accountName || null,
              fee: w.fee ?? null,
              netAmount: w.fee ? w.amount - w.fee : w.amount,
              reference: w.key,
              processedAt: Date.now(),
            }
          );
          showMsg(`Withdrawal of $${fmt(w.amount)} marked as completed! ✅`);
        } catch (err: any) {
          showMsg(err?.message || "Failed to approve withdrawal.", "err");
        } finally {
          setProcessingKey(null);
        }
      },
    });
  }

  function handleRejectWithdrawal(w: WithdrawItem) {
    setPopupDialog({
      isOpen: true,
      type: "prompt",
      title: "Reject Withdrawal Request",
      message: `Enter reason for rejecting withdrawal of $${fmt(w.amount)}:\n(The amount of $${fmt(w.amount)} will be refunded to user's balance)`,
      defaultValue: "Verification issue / invalid destination details",
      inputValue: "Verification issue / invalid destination details",
      inputPlaceholder: "Enter rejection reason…",
      confirmLabel: "Reject & Refund",
      confirmColor: "#ef4444",
      cancelLabel: "Cancel",
      onConfirm: async (reason) => {
        setPopupDialog(null);
        setProcessingKey(w.key);
        try {
          await update(ref(db, `withdrawRequests/${w.uid}/${w.key}`), {
            status: "rejected",
            processedAt: Date.now(),
            adminNote: (reason || "").trim() || "Rejected by administrator",
          });

          // Refund amount to user balance in database:
          // User balance is total completed payments minus non-rejected withdrawals.
          // Since this withdrawal key is now rejected, exclude it from total withdrawals.
          const userPays = payments.filter(
            (p) => p.uid === w.uid && ["completed", "success", "paid"].includes(String(p.status || "").toLowerCase())
          );
          const totalIn = userPays.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
          const userWiths = withdrawals.filter(
            (wi) =>
              wi.uid === w.uid &&
              wi.key !== w.key &&
              !["failed", "rejected", "cancelled"].includes(String(wi.status || "").toLowerCase())
          );
          const totalOut = userWiths.reduce((sum, wi) => sum + (Number(wi.amount) || 0), 0);
          const refundedBal = Math.max(0, totalIn - totalOut);

          await update(ref(db, `users/${w.uid}`), {
            balance: refundedBal,
            updatedAt: Date.now(),
          }).catch(() => {});

          // Notify user
          await sendUserNotification(
            w.uid,
            "🚫 Withdrawal Rejected & Refunded",
            `Your withdrawal request of $${fmt(w.amount)} ${w.currency || "USD"}${w.destination ? ` to ${w.destination}` : ""} has been rejected, and $${fmt(w.amount)} has been refunded back to your account balance. Reason: ${(reason || "").trim() || "Verification issue or invalid destination details"}. Ref: ${w.key.slice(0, 16)}.`,
            "withdrawal_rejected",
            {
              amount: w.amount,
              refundedAmount: w.amount,
              currency: w.currency || "USD",
              network: w.networkName || w.network || null,
              destination: w.destination || null,
              accountName: w.accountName || null,
              reason: (reason || "").trim() || "Verification issue / invalid destination details",
              reference: w.key,
              rejectedAt: Date.now(),
            }
          );
          showMsg(`Withdrawal rejected. $${fmt(w.amount)} refunded to user balance! ❌`, "err");
        } catch (err: any) {
          showMsg(err?.message || "Failed to reject withdrawal.", "err");
        } finally {
          setProcessingKey(null);
        }
      },
    });
  }

  /* ── Actions: Deposit Approval, Rejection & Deletion ───────── */
  function handleApproveDeposit(p: PaymentItem) {
    if (p.status === "completed") {
      showMsg("This deposit is already completed/approved.", "err");
      return;
    }
    const confirmMsg = `Approve deposit of $${fmt(p.amount)} for User (${p.phone || p.uid.slice(0, 8)})?\n\nThis will credit their wallet balance and automatically distribute recurring multi-level commissions (12% L1 · 2% L2 · 1% L3) on this deposit.`;
    
    setPopupDialog({
      isOpen: true,
      type: "confirm",
      title: "Approve Deposit & Pay Commissions",
      message: confirmMsg,
      confirmLabel: "Approve & Distribute",
      confirmColor: "#00a651",
      cancelLabel: "Cancel",
      onConfirm: async () => {
        setPopupDialog(null);
        setProcessingKey(p.key);
        try {
          const depositAmount = Number(p.amount || 0);

          // 1. Fetch depositor's user profile to resolve upline referral chain
          const userSnap = await get(ref(db, `users/${p.uid}`));
          let level1Uid: string | null = null;
          let level2Uid: string | null = null;
          let level3Uid: string | null = null;
          let depositorPhone = p.phone || "Downline User";

          if (userSnap.exists()) {
            const uData = userSnap.val();
            depositorPhone = uData.phone || uData.displayName || depositorPhone;
            level1Uid = uData.referredBy || null;
            level2Uid = uData.referredByL2 || null;
            level3Uid = uData.referredByL3 || null;

            // Traverse uplines dynamically if L2/L3 not pre-stored
            if (level1Uid && !level2Uid) {
              const l1Snap = await get(ref(db, `users/${level1Uid}`));
              if (l1Snap.exists()) {
                level2Uid = l1Snap.val().referredBy || null;
                if (level2Uid && !level3Uid) {
                  const l2Snap = await get(ref(db, `users/${level2Uid}`));
                  if (l2Snap.exists()) {
                    level3Uid = l2Snap.val().referredBy || null;
                  }
                }
              }
            }
          }

          // 2. Distribute multi-tier commissions: 12% (L1), 2% (L2), 1% (L3)
          const commissionTiers: { uid: string; level: number; pct: number }[] = [];
          if (level1Uid && level1Uid !== p.uid) commissionTiers.push({ uid: level1Uid, level: 1, pct: 12 });
          if (level2Uid && level2Uid !== p.uid && level2Uid !== level1Uid) commissionTiers.push({ uid: level2Uid, level: 2, pct: 2 });
          if (level3Uid && level3Uid !== p.uid && level3Uid !== level1Uid && level3Uid !== level2Uid) commissionTiers.push({ uid: level3Uid, level: 3, pct: 1 });

          for (const tier of commissionTiers) {
            const commAmt = parseFloat(((depositAmount * tier.pct) / 100).toFixed(2));
            if (commAmt > 0) {
              // A) Credit upline wallet balance in userPayments
              await push(ref(db, `userPayments/${tier.uid}`), {
                amount: commAmt,
                currency: p.currency || "USD",
                type: "referral_commission",
                status: "completed",
                description: `Level ${tier.level} (${tier.pct}%) Commission from ${depositorPhone} (Deposit: $${depositAmount.toFixed(2)})`,
                fromUid: p.uid,
                fromPhone: depositorPhone,
                level: tier.level,
                percentage: tier.pct,
                depositKey: p.key,
                depositAmount: depositAmount,
                createdAt: Date.now(),
              });

              // B) Record in referralEarnings for affiliate tracking
              await push(ref(db, `referralEarnings/${tier.uid}`), {
                amount: commAmt,
                currency: p.currency || "USD",
                level: tier.level,
                percentage: tier.pct,
                fromUid: p.uid,
                fromPhone: depositorPhone,
                depositKey: p.key,
                depositAmount: depositAmount,
                createdAt: Date.now(),
              });

              // C) Notify upline about their commission
              await sendUserNotification(
                tier.uid,
                "💰 Commission Earned!",
                `You earned a Level ${tier.level} referral commission of $${commAmt.toFixed(2)} ${p.currency || "USD"} (${tier.pct}%) from downline user ${depositorPhone}'s deposit of $${depositAmount.toFixed(2)}${p.networkName || p.network ? ` via ${p.networkName || p.network}` : ""}. Ref: ${p.key.slice(0, 16)}.`,
                "commission",
                {
                  commissionAmount: commAmt,
                  currency: p.currency || "USD",
                  level: tier.level,
                  percentage: tier.pct,
                  fromUser: depositorPhone,
                  fromUid: p.uid,
                  depositAmount: depositAmount,
                  depositReference: p.key,
                  network: p.networkName || p.network || null,
                  earnedAt: Date.now(),
                }
              );
            }
          }

          // 3. Mark the deposit as completed
          await update(ref(db, `userPayments/${p.uid}/${p.key}`), {
            status: "completed",
            approvedAt: Date.now(),
            commissionProcessed: true,
            adminNote: "Approved by administrator with multi-tier referral commissions paid.",
          });

          // Sync updated balance directly to users/${p.uid}/balance in database
          const curBal = getUserBalance(p.uid);
          await update(ref(db, `users/${p.uid}`), { balance: curBal + depositAmount, updatedAt: Date.now() }).catch(() => {});

          // 4. Notify depositor
          await sendUserNotification(
            p.uid,
            "✅ Deposit Approved",
            `Your deposit of $${fmt(depositAmount)} ${p.currency || "USD"}${p.networkName || p.network ? ` via ${p.networkName || p.network}` : ""}${p.accountNo ? ` (Acc: ${p.accountNo})` : ""}${p.senderName ? ` from ${p.senderName}` : ""} has been approved and credited to your wallet balance. Ref: ${p.key.slice(0, 16)}. Happy investing!`,
            "deposit_approved",
            {
              amount: depositAmount,
              currency: p.currency || "USD",
              network: p.networkName || p.network || null,
              phone: p.phone || null,
              senderName: p.senderName || null,
              accountNo: p.accountNo || null,
              botName: p.botName || null,
              reference: p.key,
              approvedAt: Date.now(),
            }
          );

          showMsg(`Deposit of $${fmt(depositAmount)} approved and commissions distributed! ✅`);
          if (selectedPayment?.key === p.key) {
            setSelectedPayment(null);
          }
        } catch (err: any) {
          showMsg(err?.message || "Failed to approve deposit.", "err");
        } finally {
          setProcessingKey(null);
        }
      },
    });
  }

  function handleRejectDeposit(p: PaymentItem) {
    if (p.status === "completed") {
      showMsg("Completed deposits cannot be rejected. User balance and commissions are preserved.", "err");
      return;
    }

    setPopupDialog({
      isOpen: true,
      type: "prompt",
      title: "Reject Deposit Request",
      message: `Enter reason for rejecting deposit request of $${fmt(p.amount)}:`,
      defaultValue: "Invalid payment proof or funds not received",
      inputValue: "Invalid payment proof or funds not received",
      inputPlaceholder: "Enter rejection reason…",
      confirmLabel: "Reject Deposit",
      confirmColor: "#ef4444",
      cancelLabel: "Cancel",
      onConfirm: async (reason) => {
        setPopupDialog(null);
        setProcessingKey(p.key);
        try {
          // Reject pending deposit. Commissions are NOT distributed, and NO commissions/balances are cleared.
          await update(ref(db, `userPayments/${p.uid}/${p.key}`), {
            status: "rejected",
            rejectedAt: Date.now(),
            adminNote: (reason || "").trim() || "Rejected by administrator",
          });

          // Notify depositor
          await sendUserNotification(
            p.uid,
            "❌ Deposit Rejected",
            `Your deposit request of $${fmt(p.amount)} ${p.currency || "USD"}${p.networkName || p.network ? ` via ${p.networkName || p.network}` : ""}${p.accountNo ? ` (Acc: ${p.accountNo})` : ""} has been rejected. Reason: ${(reason || "").trim() || "Invalid payment proof or funds not received"}. Ref: ${p.key.slice(0, 16)}.`,
            "deposit_rejected",
            {
              amount: p.amount,
              currency: p.currency || "USD",
              network: p.networkName || p.network || null,
              phone: p.phone || null,
              senderName: p.senderName || null,
              accountNo: p.accountNo || null,
              reason: (reason || "").trim() || "Invalid payment proof or funds not received",
              reference: p.key,
              rejectedAt: Date.now(),
            }
          );

          showMsg(`Deposit request of $${fmt(p.amount)} rejected. Balances and commissions are preserved. ❌`, "err");
          if (selectedPayment?.key === p.key) {
            setSelectedPayment(null);
          }
        } catch (err: any) {
          showMsg(err?.message || "Failed to reject deposit.", "err");
        } finally {
          setProcessingKey(null);
        }
      },
    });
  }

  function handleDeleteDeposit(p: PaymentItem) {
    setPopupDialog({
      isOpen: true,
      type: "confirm",
      title: "Delete Deposit Record",
      message: `Are you sure you want to delete deposit record $${fmt(p.amount)} (${p.key})?\n\nThis will remove the record from Admin Deposits. User balances and referral commissions will remain intact.`,
      confirmLabel: "Delete Record",
      confirmColor: "#ef4444",
      cancelLabel: "Cancel",
      onConfirm: async () => {
        setPopupDialog(null);
        setProcessingKey(p.key);
        try {
          // If the deposit was completed, hide from Admin view so depositor balance & upline commissions remain 100% intact
          if (p.status === "completed") {
            await update(ref(db, `userPayments/${p.uid}/${p.key}`), {
              deletedFromAdmin: true,
              adminDeletedAt: Date.now(),
            });
          } else {
            // Pending or rejected: safe to remove record completely without affecting balance
            await remove(ref(db, `userPayments/${p.uid}/${p.key}`));
          }

          showMsg("Deposit record removed from admin list. Balances and commissions remain intact. 🗑️");
          if (selectedPayment?.key === p.key) {
            setSelectedPayment(null);
          }
        } catch (err: any) {
          showMsg(err?.message || "Failed to delete deposit.", "err");
        } finally {
          setProcessingKey(null);
        }
      },
    });
  }

  /* ── Calculations & Metrics ────────────────────────── */
  const pendingWithdrawals = useMemo(
    () => withdrawals.filter((w) => {
      const EXCLUDED_TYPES = ["bot_activation", "admin_deduction", "bot_reward", "referral_commission"];
      return w.status === "pending" && !(w.type && EXCLUDED_TYPES.includes(w.type));
    }),
    [withdrawals]
  );
  const pendingWithdrawalsSum = useMemo(
    () => pendingWithdrawals.reduce((sum, w) => sum + w.amount, 0),
    [pendingWithdrawals]
  );

  const totalBotsCapital = useMemo(
    () => userBots.reduce((sum, b) => sum + (b.amount || 0), 0),
    [userBots]
  );
  const totalBotsDailyPayout = useMemo(
    () => userBots.reduce((sum, b) => sum + (b.dailyReturn || 0), 0),
    [userBots]
  );
  const totalMinedRewardsPaid = useMemo(
    () =>
      payments
        .filter((p) => p.type === "bot_reward" && p.status === "completed")
        .reduce((sum, p) => sum + p.amount, 0),
    [payments]
  );
  // Real user deposits only — exclude internal commissions, bot yields, and admin adjustments
  const EXCLUDED_DEPOSIT_TYPES = ["referral_commission", "bot_reward", "admin_adjustment", "commission"];

  const depositPayments = useMemo(
    () => payments.filter((p) => !EXCLUDED_DEPOSIT_TYPES.includes(p.type || "") && !p.deletedFromAdmin),
    [payments]
  );

  const totalDepositedVolume = useMemo(
    () =>
      depositPayments
        .filter((p) => p.status === "completed" || p.status === "paid")
        .reduce((sum, p) => sum + p.amount, 0),
    [depositPayments]
  );

  // Filtered lists
  const filteredBots = useMemo(() => {
    if (!botSearch.trim()) return userBots;
    const q = botSearch.toLowerCase();
    return userBots.filter(
      (b) =>
        b.botName.toLowerCase().includes(q) ||
        b.uid.toLowerCase().includes(q) ||
        b.key.toLowerCase().includes(q)
    );
  }, [userBots, botSearch]);

  const filteredWithdrawals = useMemo(() => {
    // Exclude internal system transaction types — only show real user withdrawal requests
    const EXCLUDED_TYPES = ["bot_activation", "admin_deduction", "bot_reward", "referral_commission"];
    return withdrawals.filter((w) => {
      if (w.type && EXCLUDED_TYPES.includes(w.type)) return false;
      const matchStatus = withdrawStatus === "all" || w.status === withdrawStatus;
      const q = withdrawSearch.toLowerCase();
      const matchSearch =
        !q ||
        w.uid.toLowerCase().includes(q) ||
        (w.destination && w.destination.toLowerCase().includes(q)) ||
        (w.accountName && w.accountName.toLowerCase().includes(q)) ||
        (w.networkName && w.networkName.toLowerCase().includes(q));
      return matchStatus && matchSearch;
    });
  }, [withdrawals, withdrawStatus, withdrawSearch]);

  const pendingPayments = useMemo(
    () => depositPayments.filter((p) => p.status === "pending" || !p.status),
    [depositPayments]
  );

  const filteredPayments = useMemo(() => {
    return depositPayments.filter((p) => {
      const matchStatus =
        paymentStatusFilter === "all" ||
        (paymentStatusFilter === "pending" && (p.status === "pending" || !p.status)) ||
        p.status === paymentStatusFilter;
      const q = paymentSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        p.uid.toLowerCase().includes(q) ||
        (p.phone && p.phone.toLowerCase().includes(q)) ||
        (p.senderName && p.senderName.toLowerCase().includes(q)) ||
        (p.txHash && p.txHash.toLowerCase().includes(q)) ||
        (p.networkName && p.networkName.toLowerCase().includes(q)) ||
        (p.accountNo && p.accountNo.toLowerCase().includes(q)) ||
        (p.type && p.type.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q));
      return matchStatus && matchSearch;
    });
  }, [depositPayments, paymentStatusFilter, paymentSearch]);

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return usersList;
    const q = userSearch.toLowerCase();
    return usersList.filter(
      (u) =>
        u.uid.toLowerCase().includes(q) ||
        (u.phone && u.phone.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.affiliateCode && u.affiliateCode.toLowerCase().includes(q))
    );
  }, [usersList, userSearch]);

  /* ── Sidebar Navigation Tabs ────────────────────────── */
  const NAV_ITEMS: { key: AdminTab; label: string; icon: string; badge?: number }[] = [
    { key: "overview", label: "Overview", icon: "📊" },
    { key: "bots", label: "Fleet Monitor", icon: "🤖", badge: userBots.length },
    { key: "withdrawals", label: "Withdrawals", icon: "💸", badge: pendingWithdrawals.length },
    { key: "payments", label: "Deposits", icon: "💳", badge: pendingPayments.length },
    { key: "payment-methods", label: "Deposit Accounts", icon: "🏦" },
    { key: "users", label: "Users Directory", icon: "👥", badge: usersList.length },
    { key: "user-access", label: "Account Access", icon: "🛡️" },
    { key: "whatsapp", label: "WhatsApp Group", icon: "💬" },
    { key: "notifications", label: "Alerts & Broadcast", icon: "🔔" },
    { key: "settings", label: "Settings", icon: "⚙️" },
  ];

  if (!isAdmin) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "var(--bg0)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            background: "var(--bg1)",
            borderRadius: 20,
            padding: "36px 28px",
            border: "1px solid var(--stroke)",
            boxShadow: "-6px -6px 14px rgba(255,255,255,0.9), 6px 6px 14px rgba(163,177,198,0.5)",
          }}
        >
          <div style={{ fontSize: 44, marginBottom: 12 }}>🔒</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px", color: "var(--text)" }}>
            Access Restricted
          </h2>
          <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "0 0 24px", lineHeight: 1.5 }}>
            You do not have administrative privileges to view this control center.
          </p>
          <Link
            to="/"
            style={{
              display: "inline-block",
              padding: "12px 24px",
              borderRadius: 12,
              background: "linear-gradient(135deg, #00a651, #007a3c)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              textDecoration: "none",
              boxShadow: "0 4px 14px rgba(0,166,81,0.3)",
            }}
          >
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg2)", color: "var(--text)" }}>
      {/* ── Global Action Toast ── */}
      {actionMsg && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            padding: "12px 20px",
            borderRadius: 14,
            background: actionMsg.type === "ok" ? "linear-gradient(135deg, #00a651, #007a3c)" : "#ef4444",
            color: "#fff",
            fontWeight: 800,
            fontSize: 13.5,
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            animation: "fadeIn 0.2s ease",
          }}
        >
          {actionMsg.text}
        </div>
      )}

      {/* ── Mobile Drawer Backdrop ── */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
          }}
        />
      )}

      {/* ── 1. Sidebar (Responsive Desktop & Mobile Drawer) ── */}
      <aside
        style={{
          width: 260,
          background: "var(--bg1)",
          borderRight: "1px solid var(--stroke)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          zIndex: 1001,
          position: "fixed",
          top: 0,
          bottom: 0,
          left: 0,
          transform: mobileMenuOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: "4px 0 20px rgba(0,0,0,0.06)",
        }}
        className="admin-sidebar"
      >
        {/* Sidebar Header */}
        <div
          style={{
            padding: "20px 18px",
            borderBottom: "1px solid var(--stroke)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg, #00a651, #007a3c)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(0,166,81,0.35)",
              }}
            >
              <span style={{ fontSize: 18 }}>⚡</span>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: "var(--text)", letterSpacing: "-0.01em" }}>AUTEX AI</div>
              <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Admin Console</div>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="mobile-close-btn"
            style={{
              background: "none",
              border: "none",
              color: "var(--muted)",
              cursor: "pointer",
              padding: 6,
              borderRadius: 8,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Sidebar Navigation Items */}
        <nav style={{ padding: "12px 10px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV_ITEMS.map((item) => {
            const isActive = tab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => {
                  setTab(item.key);
                  setMobileMenuOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "11px 14px",
                  borderRadius: 12,
                  border: "none",
                  cursor: "pointer",
                  background: isActive ? "linear-gradient(135deg, rgba(0,166,81,0.12), rgba(0,166,81,0.06))" : "transparent",
                  color: isActive ? "#00a651" : "var(--text)",
                  fontWeight: isActive ? 800 : 600,
                  fontSize: 13.5,
                  textAlign: "left",
                  transition: "all 0.15s ease",
                  borderLeft: isActive ? "3px solid #00a651" : "3px solid transparent",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {typeof item.badge === "number" && item.badge > 0 && (
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 800,
                      background: item.key === "withdrawals" ? "rgba(239,68,68,0.15)" : "var(--bg2)",
                      color: item.key === "withdrawals" ? "#ef4444" : "var(--muted)",
                      border: item.key === "withdrawals" ? "1px solid rgba(239,68,68,0.3)" : "1px solid var(--stroke)",
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div style={{ padding: "14px 16px", borderTop: "1px solid var(--stroke)" }}>
          <Link
            to="/"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "10px",
              borderRadius: 12,
              background: "var(--bg2)",
              color: "var(--muted)",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 700,
              border: "1px solid var(--stroke)",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span>Exit to Main App</span>
          </Link>
        </div>
      </aside>

      {/* ── 2. Main Content Area ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, marginLeft: 0 }} className="admin-main">
        {/* Top Bar Header */}
        <header
          style={{
            height: 62,
            background: "var(--bg1)",
            borderBottom: "1px solid var(--stroke)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 18px",
            position: "sticky",
            top: 0,
            zIndex: 100,
            boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => setMobileMenuOpen(true)}
              style={{
                background: "var(--bg2)",
                border: "1px solid var(--stroke)",
                borderRadius: 10,
                padding: "8px 10px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text)",
              }}
              className="mobile-hamburger-btn"
              title="Open Navigation"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div>
              <div style={{ fontSize: 17, fontWeight: 900, color: "var(--text)", textTransform: "capitalize" }}>
                {tab === "overview"
                  ? "Dashboard Overview"
                  : tab === "bots"
                  ? "AI Fleet Monitor"
                  : tab === "withdrawals"
                  ? "Withdrawal Requests"
                  : tab === "payments"
                  ? "Payments & Deposits"
                  : tab === "payment-methods"
                  ? "Deposit Accounts & Addresses"
                  : tab === "users"
                  ? "Users Directory"
                  : tab === "user-access"
                  ? "Account Activation Control"
                  : tab === "whatsapp"
                  ? "WhatsApp Community Group"
                  : tab === "notifications"
                  ? "Broadcast Alerts"
                  : "Platform Settings"}
              </div>
            </div>
          </div>

          {/* Right Header Status Pill */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {pendingWithdrawals.length > 0 && (
              <button
                onClick={() => setTab("withdrawals")}
                style={{
                  background: "rgba(239,68,68,0.12)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: 999,
                  padding: "4px 10px",
                  color: "#ef4444",
                  fontSize: 11.5,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444" }} />
                <span>{pendingWithdrawals.length} Pending Payouts</span>
              </button>
            )}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "5px 12px",
                borderRadius: 999,
                background: "rgba(0,166,81,0.1)",
                border: "1px solid rgba(0,166,81,0.25)",
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#00a651" }} />
              <span style={{ fontSize: 11.5, fontWeight: 800, color: "#00a651" }}>LIVE</span>
            </div>
          </div>
        </header>

        {/* Tab Content Container */}
        <main style={{ padding: "18px 18px 40px", maxWidth: 1200, width: "100%", margin: "0 auto" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted)", fontSize: 14 }}>
              Loading platform data…
            </div>
          ) : (
            <>
              {/* ──────────────────────────────────────────────────────────
                  TAB 1: OVERVIEW & DASHBOARD METRICS
              ────────────────────────────────────────────────────────── */}
              {tab === "overview" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {/* Pending Alert banner if requests exist */}
                  {pendingWithdrawals.length > 0 && (
                    <div
                      style={{
                        padding: "14px 16px",
                        borderRadius: 16,
                        background: "linear-gradient(135deg, rgba(239,68,68,0.14), rgba(220,38,38,0.06))",
                        border: "1.5px solid rgba(239,68,68,0.35)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 10,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 24 }}>⚠️</span>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "#ef4444" }}>
                            {pendingWithdrawals.length} Pending Withdrawal Request(s)
                          </div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>
                            Totaling <strong>${fmt(pendingWithdrawalsSum)}</strong> awaiting admin payout review.
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setTab("withdrawals")}
                        style={{
                          padding: "8px 16px",
                          borderRadius: 10,
                          background: "#ef4444",
                          color: "#fff",
                          fontSize: 12.5,
                          fontWeight: 800,
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Review Requests →
                      </button>
                    </div>
                  )}

                  {/* 4 Key Stat Cards */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: 14,
                    }}
                  >
                    {/* Stat 1: Total Users */}
                    <div
                      className="neu-card"
                      style={{
                        borderRadius: 18,
                        padding: "16px 18px",
                        background: "var(--bg1)",
                        boxShadow: "-4px -4px 12px rgba(255,255,255,0.9), 4px 4px 12px rgba(163,177,198,0.4)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>
                            Registered Users
                          </div>
                          <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text)", marginTop: 4 }}>
                            {usersList.length}
                          </div>
                        </div>
                        <span style={{ fontSize: 24 }}>👥</span>
                      </div>
                    </div>

                    {/* Stat 2: Active Bots Capital */}
                    <div
                      className="neu-card"
                      style={{
                        borderRadius: 18,
                        padding: "16px 18px",
                        background: "var(--bg1)",
                        boxShadow: "-4px -4px 12px rgba(255,255,255,0.9), 4px 4px 12px rgba(163,177,198,0.4)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>
                            Active Fleet Capital
                          </div>
                          <div style={{ fontSize: 24, fontWeight: 900, color: "#00a651", marginTop: 4 }}>
                            ${fmt(totalBotsCapital)}
                          </div>
                        </div>
                        <span style={{ fontSize: 24 }}>🤖</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>
                        {userBots.length} active fleet units running
                      </div>
                    </div>

                    {/* Stat 3: Total Deposits */}
                    <div
                      className="neu-card"
                      style={{
                        borderRadius: 18,
                        padding: "16px 18px",
                        background: "var(--bg1)",
                        boxShadow: "-4px -4px 12px rgba(255,255,255,0.9), 4px 4px 12px rgba(163,177,198,0.4)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>
                            Completed Deposits
                          </div>
                          <div style={{ fontSize: 24, fontWeight: 900, color: "#2563eb", marginTop: 4 }}>
                            ${fmt(totalDepositedVolume)}
                          </div>
                        </div>
                        <span style={{ fontSize: 24 }}>💳</span>
                      </div>
                    </div>

                    {/* Stat 4: Mining Yield Paid */}
                    <div
                      className="neu-card"
                      style={{
                        borderRadius: 18,
                        padding: "16px 18px",
                        background: "var(--bg1)",
                        boxShadow: "-4px -4px 12px rgba(255,255,255,0.9), 4px 4px 12px rgba(163,177,198,0.4)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>
                            Daily Mining Yields
                          </div>
                          <div style={{ fontSize: 24, fontWeight: 900, color: "#d97706", marginTop: 4 }}>
                            ${fmt(totalMinedRewardsPaid)}
                          </div>
                        </div>
                        <span style={{ fontSize: 24 }}>⚡</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>
                        +${fmt(totalBotsDailyPayout)}/day potential
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Matrix */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                      gap: 16,
                    }}
                  >
                    {/* Recent Fleets Activated */}
                    <div className="neu-card" style={{ borderRadius: 18, padding: 18 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div style={{ fontWeight: 800, fontSize: 15 }}>Recent Fleet Activations</div>
                        <button
                          onClick={() => setTab("bots")}
                          style={{ background: "none", border: "none", color: "#00a651", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                        >
                          View All ({userBots.length}) →
                        </button>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {userBots.slice(0, 5).map((b) => (
                          <div
                            key={b.key}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "9px 12px",
                              borderRadius: 12,
                              background: "var(--bg2)",
                              fontSize: 12.5,
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 800 }}>{b.botName}</div>
                              <div style={{ fontSize: 11, color: "var(--muted)" }}>UID: {b.uid.slice(0, 8)}…</div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontWeight: 800, color: "#00a651" }}>${fmt(b.amount)}</div>
                              <div style={{ fontSize: 10.5, color: "var(--muted)" }}>+{b.dailyPct}%/day</div>
                            </div>
                          </div>
                        ))}
                        {userBots.length === 0 && (
                          <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: 16 }}>
                            No bot activations yet.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Recent Withdrawals */}
                    <div className="neu-card" style={{ borderRadius: 18, padding: 18 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div style={{ fontWeight: 800, fontSize: 15 }}>Recent Withdrawal Activity</div>
                        <button
                          onClick={() => setTab("withdrawals")}
                          style={{ background: "none", border: "none", color: "#00a651", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                        >
                          Manage ({withdrawals.length}) →
                        </button>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {withdrawals.slice(0, 5).map((w) => (
                          <div
                            key={w.key}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "9px 12px",
                              borderRadius: 12,
                              background: "var(--bg2)",
                              fontSize: 12.5,
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 800 }}>${fmt(w.amount)}</div>
                              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                                {w.networkName || (w.type === "bot_activation" ? "🤖 Bot Activation" : w.type === "admin_deduction" ? "⚖️ Admin Deduction" : "Withdraw")} · {w.destination.slice(0, 16)}…
                              </div>
                            </div>
                            <div>
                              <span
                                style={{
                                  padding: "3px 8px",
                                  borderRadius: 999,
                                  fontSize: 11,
                                  fontWeight: 800,
                                  background:
                                    w.status === "completed"
                                      ? "rgba(0,166,81,0.12)"
                                      : w.status === "rejected"
                                      ? "rgba(239,68,68,0.12)"
                                      : "rgba(245,158,11,0.12)",
                                  color:
                                    w.status === "completed"
                                      ? "#00a651"
                                      : w.status === "rejected"
                                      ? "#ef4444"
                                      : "#d97706",
                                }}
                              >
                                {w.status.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        ))}
                        {withdrawals.length === 0 && (
                          <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: 16 }}>
                            No withdrawals yet.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ──────────────────────────────────────────────────────────
                  TAB 2: AI BOTS & FLEET MONITOR
              ────────────────────────────────────────────────────────── */}
              {tab === "bots" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {/* Top Bar Summary */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 12,
                    }}
                  >
                    <div>
                      <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>Active Fleet Directory</h2>
                      <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
                        Total Capital Running: <strong>${fmt(totalBotsCapital)}</strong> · Daily Payout:{" "}
                        <strong style={{ color: "#00a651" }}>+${fmt(totalBotsDailyPayout)}</strong>
                      </div>
                    </div>
                    <input
                      className="input"
                      value={botSearch}
                      onChange={(e) => setBotSearch(e.target.value)}
                      placeholder="Search by UID or Bot Name…"
                      style={{ maxWidth: 280, width: "100%", padding: "8px 14px", fontSize: 13 }}
                    />
                  </div>

                  {/* 13 Official Bots Specifications Grid */}
                  <div className="neu-card" style={{ borderRadius: 18, padding: "16px 18px" }}>
                    <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12 }}>Official Bot Configurations (13 Tiers)</div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                        gap: 10,
                      }}
                    >
                      {BOTS.map((bot) => (
                        <div
                          key={bot.id}
                          style={{
                            padding: "10px",
                            borderRadius: 12,
                            background: "var(--bg2)",
                            border: "1px solid var(--stroke)",
                            textAlign: "center",
                          }}
                        >
                          <img src={bot.img} alt={bot.name} style={{ width: 28, height: 28, margin: "0 auto 6px" }} />
                          <div style={{ fontSize: 12, fontWeight: 800 }}>{bot.name}</div>
                          <div style={{ fontSize: 13, fontWeight: 900, color: "#00a651", marginTop: 2 }}>
                            ${bot.investAmount}
                          </div>
                          <div style={{ fontSize: 10.5, color: "var(--muted)" }}>
                            {bot.dailyPct}%/day · {bot.maxMultiplier}x
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* User Active Bots Table */}
                  <div className="neu-card" style={{ borderRadius: 18, overflow: "hidden" }}>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: "var(--bg2)", borderBottom: "1px solid var(--stroke)" }}>
                            <th style={{ padding: "12px 14px", fontWeight: 800 }}>Bot</th>
                            <th style={{ padding: "12px 14px", fontWeight: 800 }}>User UID</th>
                            <th style={{ padding: "12px 14px", fontWeight: 800 }}>Active Capital</th>
                            <th style={{ padding: "12px 14px", fontWeight: 800 }}>Daily Yield</th>
                            <th style={{ padding: "12px 14px", fontWeight: 800 }}>Activated</th>
                            <th style={{ padding: "12px 14px", fontWeight: 800 }}>Total Collected</th>
                            <th style={{ padding: "12px 14px", fontWeight: 800 }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredBots.map((b) => {
                            const botMeta = getBotById(b.bot);
                            return (
                              <tr key={b.key} style={{ borderBottom: "1px solid var(--stroke)" }}>
                                <td style={{ padding: "12px 14px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <img src={botMeta.img} alt="" style={{ width: 24, height: 24 }} />
                                    <span style={{ fontWeight: 800 }}>{b.botName}</span>
                                  </div>
                                </td>
                                <td style={{ padding: "12px 14px", fontFamily: "monospace", fontSize: 12 }}>
                                  {b.uid.slice(0, 10)}…
                                </td>
                                <td style={{ padding: "12px 14px", fontWeight: 800 }}>${fmt(b.amount)}</td>
                                <td style={{ padding: "12px 14px", fontWeight: 800, color: "#00a651" }}>
                                  +${fmt(b.dailyReturn)} ({b.dailyPct}%)
                                </td>
                                <td style={{ padding: "12px 14px", color: "var(--muted)", fontSize: 12 }}>
                                  {fmtDate(b.activatedAt)}
                                </td>
                                <td style={{ padding: "12px 14px", fontWeight: 800, color: "#2563eb" }}>
                                  ${fmt(b.totalEarned || 0)}
                                </td>
                                <td style={{ padding: "12px 14px" }}>
                                  <span
                                    style={{
                                      padding: "3px 8px",
                                      borderRadius: 999,
                                      background: "rgba(0,166,81,0.12)",
                                      color: "#00a651",
                                      fontSize: 11,
                                      fontWeight: 800,
                                    }}
                                  >
                                    ACTIVE
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                          {filteredBots.length === 0 && (
                            <tr>
                              <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>
                                No bot activations found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ──────────────────────────────────────────────────────────
                  TAB 3: WITHDRAWAL REQUESTS MANAGEMENT
              ────────────────────────────────────────────────────────── */}
              {tab === "withdrawals" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Top Bar Filter */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 12,
                    }}
                  >
                    {/* Status Tabs */}
                    <div style={{ display: "flex", gap: 6, background: "var(--bg2)", padding: 4, borderRadius: 12 }}>
                      {(["all", "pending", "completed", "rejected"] as const).map((st) => (
                        <button
                          key={st}
                          onClick={() => setWithdrawStatus(st)}
                          style={{
                            padding: "6px 14px",
                            borderRadius: 8,
                            border: "none",
                            background: withdrawStatus === st ? "var(--bg1)" : "transparent",
                            color: withdrawStatus === st ? "var(--text)" : "var(--muted)",
                            fontWeight: withdrawStatus === st ? 800 : 600,
                            fontSize: 12.5,
                            cursor: "pointer",
                            boxShadow: withdrawStatus === st ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                            textTransform: "capitalize",
                          }}
                        >
                          {st}
                        </button>
                      ))}
                    </div>

                    <input
                      className="input"
                      value={withdrawSearch}
                      onChange={(e) => setWithdrawSearch(e.target.value)}
                      placeholder="Search UID, account, destination…"
                      style={{ maxWidth: 280, width: "100%", padding: "8px 14px", fontSize: 13 }}
                    />
                  </div>

                  {/* Withdrawals List — Mobile-friendly cards */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {filteredWithdrawals.length === 0 && (
                      <div className="neu-card" style={{ padding: 28, textAlign: "center", color: "var(--muted)", borderRadius: 16 }}>
                        No withdrawal requests in this category.
                      </div>
                    )}
                    {filteredWithdrawals.map((w) => {
                      const isProcessing = processingKey === w.key;
                      const userInfo = usersList.find((u) => u.uid === w.uid);
                      // Withdrawal details submitted by the user
                      const payoutDestination = w.destination || userInfo?.phone || "—";
                      const payoutAccountName = w.accountName || userInfo?.displayName || "—";
                      const registeredPhone = userInfo?.phone || "—";
                      const registeredName = userInfo?.displayName || userInfo?.phone || "User";
                      const feeVal = (w.fee != null && !isNaN(Number(w.fee))) ? Number(w.fee) : 0;
                      const netAmount = Math.max(0, w.amount - feeVal);
                      const netAmountStr = `$${fmt(netAmount)}`;
                      const copyText = `Account/Phone: ${payoutDestination}\nName: ${payoutAccountName}\nAmount: ${netAmountStr}`;
                      const methodLabel =
                        w.networkName ||
                        (w.type === "bot_activation"
                          ? "🤖 Bot Activation"
                          : w.type === "admin_deduction"
                          ? "⚖️ Admin Deduction"
                          : "Withdraw");
                      const statusColor =
                        w.status === "completed" ? "#00a651" : w.status === "rejected" ? "#ef4444" : "#d97706";
                      const statusBg =
                        w.status === "completed"
                          ? "rgba(0,166,81,0.12)"
                          : w.status === "rejected"
                          ? "rgba(239,68,68,0.12)"
                          : "rgba(245,158,11,0.12)";
                      return (
                        <div
                          key={w.key}
                          className="neu-card"
                          style={{ borderRadius: 16, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}
                        >
                          {/* Top row: method + status + date */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                            <span style={{ fontWeight: 800, fontSize: 13 }}>{methodLabel}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span
                                style={{
                                  padding: "3px 10px",
                                  borderRadius: 999,
                                  fontSize: 11,
                                  fontWeight: 800,
                                  background: statusBg,
                                  color: statusColor,
                                }}
                              >
                                {w.status.toUpperCase()}
                              </span>
                              <span style={{ fontSize: 11, color: "var(--muted)" }}>{fmtDate(w.createdAt)}</span>
                            </div>
                          </div>

                          {/* Copy rows: Submitted Payout Account / Name / Amount */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {/* Row 1: Payout Phone / Address (Submitted by user) */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                background: "var(--bg2)",
                                borderRadius: 10,
                                padding: "8px 12px",
                                gap: 8,
                              }}
                            >
                              <div>
                                <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 700, marginBottom: 1 }}>
                                  📱 Payout Account / Phone
                                </div>
                                <div style={{ fontSize: 13.5, fontWeight: 800, wordBreak: "break-all", fontFamily: "monospace" }}>
                                  {payoutDestination}
                                </div>
                              </div>
                              <button
                                title="Copy Payout Account / Phone"
                                onClick={() => {
                                  navigator.clipboard.writeText(payoutDestination);
                                  showMsg("Payout account/phone copied! 📋");
                                }}
                                style={{
                                  flexShrink: 0,
                                  padding: "5px 10px",
                                  borderRadius: 8,
                                  border: "1px solid var(--stroke)",
                                  background: "var(--bg1)",
                                  color: "var(--text)",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                📋 Copy
                              </button>
                            </div>

                            {/* Row 2: Account Name (Submitted by user) */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                background: "var(--bg2)",
                                borderRadius: 10,
                                padding: "8px 12px",
                                gap: 8,
                              }}
                            >
                              <div>
                                <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 700, marginBottom: 1 }}>
                                  👤 Account Name
                                </div>
                                <div style={{ fontSize: 13.5, fontWeight: 800, wordBreak: "break-all" }}>
                                  {payoutAccountName}
                                </div>
                              </div>
                              <button
                                title="Copy Account Name"
                                onClick={() => {
                                  navigator.clipboard.writeText(payoutAccountName);
                                  showMsg("Account name copied! 📋");
                                }}
                                style={{
                                  flexShrink: 0,
                                  padding: "5px 10px",
                                  borderRadius: 8,
                                  border: "1px solid var(--stroke)",
                                  background: "var(--bg1)",
                                  color: "var(--text)",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                📋 Copy
                              </button>
                            </div>

                            {/* Row 3: Amount after tax/fee (user receives) + requested amount breakdown */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                background: "var(--bg2)",
                                borderRadius: 10,
                                padding: "9px 12px",
                                gap: 8,
                              }}
                            >
                              <div>
                                <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 700, marginBottom: 1 }}>
                                  💵 Amount to Send (Net after fee)
                                </div>
                                <div style={{ fontSize: 15, fontWeight: 900, color: "#00a651" }}>
                                  {netAmountStr}
                                </div>
                                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                                  Requested: <strong style={{ color: "var(--text)" }}>${fmt(w.amount)}</strong>
                                  {feeVal > 0 ? (
                                    <> · Fee/Tax ({w.feeRate || "8%"}): <span style={{ color: "#ef4444", fontWeight: 700 }}>-${fmt(feeVal)}</span></>
                                  ) : (
                                    <> · <span style={{ color: "#00a651", fontWeight: 600 }}>No Fee</span></>
                                  )}
                                </div>
                              </div>
                              <button
                                title="Copy Net Amount"
                                onClick={() => {
                                  navigator.clipboard.writeText(netAmountStr);
                                  showMsg(`Net Amount (${netAmountStr}) copied! 📋`);
                                }}
                                style={{
                                  flexShrink: 0,
                                  padding: "5px 10px",
                                  borderRadius: 8,
                                  border: "1px solid var(--stroke)",
                                  background: "var(--bg1)",
                                  color: "var(--text)",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                📋 Copy
                              </button>
                            </div>
                          </div>

                          {/* Copy All button */}
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(copyText);
                              showMsg("All payout details copied! 📋");
                            }}
                            style={{
                              width: "100%",
                              padding: "8px 0",
                              borderRadius: 10,
                              border: "1px dashed var(--stroke)",
                              background: "transparent",
                              color: "var(--muted)",
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            📋 Copy All (Payout Account · Name · Net: {netAmountStr})
                          </button>

                          {/* Reference info: Registered profile details */}
                          <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5, background: "var(--bg2)", borderRadius: 8, padding: "6px 10px" }}>
                            <div>👤 Member: <strong>{registeredName}</strong> {registeredPhone !== "—" ? `· Reg: ${registeredPhone}` : ""} · UID: <span style={{ fontFamily: "monospace" }}>{w.uid.slice(0, 10)}…</span></div>
                            {w.adminNote && <div style={{ color: "#d97706", marginTop: 2 }}>⚠️ Note: {w.adminNote}</div>}
                          </div>

                          {/* Action buttons */}
                          <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                            {w.status === "pending" ? (
                              <>
                                <button
                                  onClick={() => handleApproveWithdrawal(w)}
                                  disabled={isProcessing}
                                  style={{
                                    flex: 1,
                                    padding: "9px 0",
                                    borderRadius: 10,
                                    background: "#00a651",
                                    color: "#fff",
                                    fontSize: 13,
                                    fontWeight: 800,
                                    border: "none",
                                    cursor: "pointer",
                                    opacity: isProcessing ? 0.6 : 1,
                                  }}
                                >
                                  ✅ Approve
                                </button>
                                <button
                                  onClick={() => handleRejectWithdrawal(w)}
                                  disabled={isProcessing}
                                  style={{
                                    flex: 1,
                                    padding: "9px 0",
                                    borderRadius: 10,
                                    background: "rgba(239,68,68,0.10)",
                                    color: "#ef4444",
                                    border: "1px solid rgba(239,68,68,0.3)",
                                    fontSize: 13,
                                    fontWeight: 800,
                                    cursor: "pointer",
                                    opacity: isProcessing ? 0.6 : 1,
                                  }}
                                >
                                  ❌ Reject
                                </button>
                              </>
                            ) : (
                              <div style={{ fontSize: 12, color: "var(--muted)", padding: "6px 0" }}>
                                Processed {w.processedAt ? `· ${fmtDate(w.processedAt)}` : ""}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ──────────────────────────────────────────────────────────
                  TAB 4: PAYMENTS & DEPOSITS MANAGEMENT
              ────────────────────────────────────────────────────────── */}
              {tab === "payments" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Header & Controls */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 12,
                    }}
                  >
                    <div>
                      <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>Deposits & Payments Management</h2>
                      <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
                        Review, approve, or reject deposits with multi-tier commission distribution (12% L1 · 2% L2 · 1% L3)
                      </div>
                    </div>
                    <input
                      className="input"
                      value={paymentSearch}
                      onChange={(e) => setPaymentSearch(e.target.value)}
                      placeholder="Search phone, sender, UID, method…"
                      style={{ maxWidth: 320, width: "100%", padding: "9px 14px", fontSize: 13 }}
                    />
                  </div>

                  {/* Status Filter Tabs */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {[
                      { key: "all", label: `All Deposits (${depositPayments.length})` },
                      { key: "pending", label: `Pending Review (${pendingPayments.length})`, alert: pendingPayments.length > 0 },
                      { key: "completed", label: `Completed (${depositPayments.filter((p) => p.status === "completed").length})` },
                      { key: "rejected", label: `Rejected (${depositPayments.filter((p) => p.status === "rejected").length})` },
                    ].map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setPaymentStatusFilter(f.key as any)}
                        style={{
                          padding: "7px 14px",
                          borderRadius: 999,
                          border: paymentStatusFilter === f.key ? "1.5px solid var(--accent)" : "1px solid var(--stroke)",
                          background: paymentStatusFilter === f.key ? "rgba(0,166,81,0.12)" : "var(--bg1)",
                          color: paymentStatusFilter === f.key ? "var(--accent)" : "var(--text)",
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          position: "relative",
                        }}
                      >
                        {f.alert && (
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ef4444" }} />
                        )}
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Pending Alert Notice */}
                  {pendingPayments.length > 0 && paymentStatusFilter === "all" && (
                    <div
                      style={{
                        padding: "12px 16px",
                        borderRadius: 14,
                        background: "rgba(245,158,11,0.12)",
                        border: "1.5px solid rgba(245,158,11,0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 10,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                        <span style={{ fontSize: 18 }}>⚠️</span>
                        <span>
                          <strong>{pendingPayments.length} pending deposit(s)</strong> awaiting review. Approving will automatically distribute 12% to direct referrer, 2% to Level 2, and 1% to Level 3.
                        </span>
                      </div>
                      <button
                        onClick={() => setPaymentStatusFilter("pending")}
                        style={{
                          padding: "6px 14px",
                          borderRadius: 8,
                          background: "#d97706",
                          color: "#fff",
                          fontWeight: 800,
                          fontSize: 12,
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        View Pending Only
                      </button>
                    </div>
                  )}

                  {/* Desktop Table View */}
                  <div className="admin-desktop-table" style={{ borderRadius: 18, overflow: "hidden", background: "var(--bg1)", border: "1px solid var(--stroke)" }}>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: "var(--bg2)", borderBottom: "1px solid var(--stroke)" }}>
                            <th style={{ padding: "12px 14px", fontWeight: 800 }}>Date</th>
                            <th style={{ padding: "12px 14px", fontWeight: 800 }}>User / Sender</th>
                            <th style={{ padding: "12px 14px", fontWeight: 800 }}>Method</th>
                            <th style={{ padding: "12px 14px", fontWeight: 800 }}>Amount</th>
                            <th style={{ padding: "12px 14px", fontWeight: 800 }}>Proof</th>
                            <th style={{ padding: "12px 14px", fontWeight: 800 }}>Status</th>
                            <th style={{ padding: "12px 14px", fontWeight: 800, textAlign: "right" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPayments.map((p) => {
                            const isPending = p.status === "pending" || !p.status;
                            const isCompleted = p.status === "completed";
                            const isProcessing = processingKey === p.key;

                            return (
                              <tr key={p.key} style={{ borderBottom: "1px solid var(--stroke)" }}>
                                <td style={{ padding: "12px 14px", color: "var(--muted)", fontSize: 12 }}>
                                  {fmtDate(p.createdAt)}
                                </td>
                                <td style={{ padding: "12px 14px" }}>
                                  <div style={{ fontWeight: 700, color: "var(--text)" }}>{p.senderName || p.phone || "User"}</div>
                                  <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--muted)" }}>
                                    UID: {p.uid.slice(0, 10)}…
                                  </div>
                                </td>
                                <td style={{ padding: "12px 14px" }}>
                                  <span
                                    style={{
                                      padding: "3px 8px",
                                      borderRadius: 6,
                                      fontSize: 11,
                                      fontWeight: 700,
                                      background: p.type === "bot_reward" ? "rgba(14,203,129,0.12)" : "rgba(37,99,235,0.12)",
                                      color: p.type === "bot_reward" ? "#00a651" : "#2563eb",
                                    }}
                                  >
                                    {p.networkName || (p.type === "bot_reward" ? "Mining Yield" : p.type || "Deposit")}
                                  </span>
                                </td>
                                <td style={{ padding: "12px 14px", fontWeight: 900, fontSize: 14 }}>
                                  ${fmt(p.amount)} <span style={{ fontSize: 11, color: "var(--muted)" }}>{p.currency || "USD"}</span>
                                </td>
                                <td style={{ padding: "12px 14px" }}>
                                  {p.proofUrl ? (
                                    <button
                                      type="button"
                                      onClick={() => setPreviewImage(p.proofUrl || null)}
                                      style={{
                                        border: "none",
                                        background: "transparent",
                                        cursor: "pointer",
                                        padding: 0,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 5,
                                        color: "var(--accent)",
                                        fontWeight: 700,
                                        fontSize: 12,
                                      }}
                                    >
                                      <img
                                        src={p.proofUrl}
                                        alt="Proof"
                                        style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 6, border: "1px solid var(--stroke)" }}
                                      />
                                      <span>View</span>
                                    </button>
                                  ) : (
                                    <span style={{ fontSize: 11, color: "var(--muted)" }}>No file</span>
                                  )}
                                </td>
                                <td style={{ padding: "12px 14px" }}>
                                  <span
                                    style={{
                                      padding: "3px 9px",
                                      borderRadius: 999,
                                      fontSize: 11,
                                      fontWeight: 800,
                                      background: isCompleted
                                        ? "rgba(14,203,129,0.14)"
                                        : p.status === "rejected"
                                        ? "rgba(239,68,68,0.14)"
                                        : "rgba(245,158,11,0.14)",
                                      color: isCompleted
                                        ? "#00a651"
                                        : p.status === "rejected"
                                        ? "#ef4444"
                                        : "#d97706",
                                    }}
                                  >
                                    {p.status ? p.status.toUpperCase() : "PENDING"}
                                  </span>
                                </td>
                                <td style={{ padding: "12px 14px", textAlign: "right" }}>
                                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                                    <button
                                      onClick={() => setSelectedPayment(p)}
                                      title="View Details & Proof"
                                      style={{
                                        padding: "6px 11px",
                                        borderRadius: 8,
                                        background: "var(--bg2)",
                                        border: "1px solid var(--stroke)",
                                        color: "var(--text)",
                                        fontSize: 11.5,
                                        fontWeight: 700,
                                        cursor: "pointer",
                                      }}
                                    >
                                      Details
                                    </button>
                                    {isPending && (
                                      <>
                                        <button
                                          onClick={() => handleApproveDeposit(p)}
                                          disabled={isProcessing}
                                          title="Approve & Distribute Multi-tier Commissions"
                                          style={{
                                            padding: "6px 12px",
                                            borderRadius: 8,
                                            background: "linear-gradient(135deg, #00a651, #007a3c)",
                                            border: "none",
                                            color: "#fff",
                                            fontSize: 11.5,
                                            fontWeight: 800,
                                            cursor: isProcessing ? "not-allowed" : "pointer",
                                            boxShadow: "0 2px 6px rgba(0,166,81,0.3)",
                                          }}
                                        >
                                          {isProcessing ? "…" : "Approve"}
                                        </button>
                                        <button
                                          onClick={() => handleRejectDeposit(p)}
                                          disabled={isProcessing}
                                          title="Reject Deposit"
                                          style={{
                                            padding: "6px 10px",
                                            borderRadius: 8,
                                            background: "rgba(239,68,68,0.12)",
                                            border: "1px solid rgba(239,68,68,0.25)",
                                            color: "#ef4444",
                                            fontSize: 11.5,
                                            fontWeight: 700,
                                            cursor: isProcessing ? "not-allowed" : "pointer",
                                          }}
                                        >
                                          Reject
                                        </button>
                                      </>
                                    )}
                                    <button
                                      onClick={() => handleDeleteDeposit(p)}
                                      disabled={isProcessing}
                                      title="Delete record permanently"
                                      style={{
                                        padding: "6px 8px",
                                        borderRadius: 8,
                                        background: "transparent",
                                        border: "none",
                                        color: "var(--muted)",
                                        cursor: isProcessing ? "not-allowed" : "pointer",
                                        fontSize: 14,
                                      }}
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {filteredPayments.length === 0 && (
                            <tr>
                              <td colSpan={7} style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
                                No transactions found matching criteria.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Mobile Cards View (responsive) */}
                  <div className="admin-mobile-cards" style={{ display: "none", flexDirection: "column", gap: 12 }}>
                    {filteredPayments.map((p) => {
                      const isPending = p.status === "pending" || !p.status;
                      const isCompleted = p.status === "completed";
                      const isProcessing = processingKey === p.key;

                      return (
                        <div
                          key={p.key}
                          className="neu-card"
                          style={{
                            borderRadius: 16,
                            padding: "16px",
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                            background: "var(--bg1)",
                            border: isPending ? "1.5px solid rgba(245,158,11,0.4)" : "1px solid var(--stroke)",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                              <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{fmtDate(p.createdAt)}</div>
                              <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)", marginTop: 2 }}>
                                {p.senderName || p.phone || "Deposit"}
                              </div>
                              <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--muted)" }}>
                                {p.phone || `UID: ${p.uid.slice(0, 10)}…`}
                              </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontWeight: 900, fontSize: 18, color: "var(--text)" }}>
                                ${fmt(p.amount)} <span style={{ fontSize: 11, color: "var(--muted)" }}>{p.currency || "USD"}</span>
                              </div>
                              <span
                                style={{
                                  display: "inline-block",
                                  marginTop: 4,
                                  padding: "3px 8px",
                                  borderRadius: 999,
                                  fontSize: 10.5,
                                  fontWeight: 800,
                                  background: isCompleted
                                    ? "rgba(14,203,129,0.14)"
                                    : p.status === "rejected"
                                    ? "rgba(239,68,68,0.14)"
                                    : "rgba(245,158,11,0.14)",
                                  color: isCompleted
                                    ? "#00a651"
                                    : p.status === "rejected"
                                    ? "#ef4444"
                                    : "#d97706",
                                }}
                              >
                                {p.status ? p.status.toUpperCase() : "PENDING"}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--bg2)", padding: "10px 12px", borderRadius: 10, fontSize: 12 }}>
                            <div style={{ flex: 1 }}>
                              <span style={{ color: "var(--muted)", fontWeight: 600 }}>Method: </span>
                              <strong>{p.networkName || p.type || "Deposit"}</strong>
                              {p.accountNo && (
                                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, fontFamily: "monospace" }}>
                                  Acc: {p.accountNo}
                                </div>
                              )}
                            </div>
                            {p.proofUrl && (
                              <button
                                type="button"
                                onClick={() => setPreviewImage(p.proofUrl || null)}
                                style={{
                                  border: "none",
                                  background: "transparent",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                  color: "var(--accent)",
                                  fontWeight: 700,
                                  fontSize: 12,
                                }}
                              >
                                <img
                                  src={p.proofUrl}
                                  alt="Proof"
                                  style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 8, border: "1.5px solid var(--accent)" }}
                                />
                                <span>Proof</span>
                              </button>
                            )}
                          </div>

                          {/* Action Buttons for Mobile Card */}
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <button
                              onClick={() => setSelectedPayment(p)}
                              style={{
                                flex: 1,
                                padding: "9px 0",
                                borderRadius: 10,
                                background: "var(--bg2)",
                                border: "1px solid var(--stroke)",
                                color: "var(--text)",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Details
                            </button>
                            {isPending && (
                              <>
                                <button
                                  onClick={() => handleApproveDeposit(p)}
                                  disabled={isProcessing}
                                  style={{
                                    flex: 1.4,
                                    padding: "9px 0",
                                    borderRadius: 10,
                                    background: "linear-gradient(135deg, #00a651, #007a3c)",
                                    border: "none",
                                    color: "#fff",
                                    fontSize: 12,
                                    fontWeight: 800,
                                    cursor: isProcessing ? "not-allowed" : "pointer",
                                  }}
                                >
                                  {isProcessing ? "…" : "Approve"}
                                </button>
                                <button
                                  onClick={() => handleRejectDeposit(p)}
                                  disabled={isProcessing}
                                  style={{
                                    padding: "9px 12px",
                                    borderRadius: 10,
                                    background: "rgba(239,68,68,0.12)",
                                    border: "1px solid rgba(239,68,68,0.25)",
                                    color: "#ef4444",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: isProcessing ? "not-allowed" : "pointer",
                                  }}
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleDeleteDeposit(p)}
                              disabled={isProcessing}
                              style={{
                                padding: "9px 12px",
                                borderRadius: 10,
                                background: "transparent",
                                border: "1px solid var(--stroke)",
                                color: "var(--muted)",
                                cursor: isProcessing ? "not-allowed" : "pointer",
                              }}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ──────────────────────────────────────────────────────────
                  TAB 5: USERS DIRECTORY
              ────────────────────────────────────────────────────────── */}
              {tab === "users" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 12,
                    }}
                  >
                    <div>
                      <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>Registered Users Directory</h2>
                      <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
                        Total Members: {usersList.length} • Click "Edit" on any user to modify details or set wallet balance.
                      </div>
                    </div>
                    <input
                      className="input"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search phone, email, UID…"
                      style={{ maxWidth: 280, width: "100%", padding: "8px 14px", fontSize: 13 }}
                    />
                  </div>

                  {/* Desktop Table View */}
                  <div className="admin-desktop-table">
                    <div className="neu-card" style={{ borderRadius: 18, overflow: "hidden" }}>
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                          <thead>
                            <tr style={{ background: "var(--bg2)", borderBottom: "1px solid var(--stroke)" }}>
                              <th style={{ padding: "12px 14px", fontWeight: 800 }}>User / Contact</th>
                              <th style={{ padding: "12px 14px", fontWeight: 800 }}>Live Balance</th>
                              <th style={{ padding: "12px 14px", fontWeight: 800 }}>UID</th>
                              <th style={{ padding: "12px 14px", fontWeight: 800 }}>Joined</th>
                              <th style={{ padding: "12px 14px", fontWeight: 800 }}>Referral Code</th>
                              <th style={{ padding: "12px 14px", fontWeight: 800 }}>Active Bots</th>
                              <th style={{ padding: "12px 14px", fontWeight: 800 }}>Role</th>
                              <th style={{ padding: "12px 14px", fontWeight: 800, textAlign: "right" }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredUsers.map((u) => {
                              const userBotCount = userBots.filter((b) => b.uid === u.uid).length;
                              const userBal = getUserBalance(u.uid);
                              return (
                                <tr key={u.uid} style={{ borderBottom: "1px solid var(--stroke)" }}>
                                  <td style={{ padding: "12px 14px", fontWeight: 700 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <div
                                        style={{
                                          width: 28,
                                          height: 28,
                                          borderRadius: "50%",
                                          background: "var(--bg2)",
                                          border: "1px solid var(--stroke)",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          fontSize: 12,
                                          fontWeight: 800,
                                        }}
                                      >
                                        {(u.displayName || u.phone || "U").charAt(0).toUpperCase()}
                                      </div>
                                      <div>
                                        <div>{u.displayName || u.phone || "Registered User"}</div>
                                        {u.email && <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>{u.email}</div>}
                                      </div>
                                    </div>
                                  </td>
                                  <td style={{ padding: "12px 14px" }}>
                                    <span
                                      style={{
                                        padding: "3px 8px",
                                        borderRadius: 6,
                                        fontSize: 12,
                                        fontWeight: 900,
                                        background: userBal > 0 ? "rgba(0,166,81,0.12)" : "rgba(148,163,184,0.12)",
                                        color: userBal > 0 ? "#00a651" : "var(--muted)",
                                      }}
                                    >
                                      ${fmt(userBal)}
                                    </span>
                                  </td>
                                  <td style={{ padding: "12px 14px", fontFamily: "monospace", fontSize: 11.5, color: "var(--muted)" }}>
                                    {u.uid.slice(0, 10)}…
                                  </td>
                                  <td style={{ padding: "12px 14px", color: "var(--muted)", fontSize: 12 }}>
                                    {fmtDate(u.createdAt)}
                                  </td>
                                  <td style={{ padding: "12px 14px", fontFamily: "monospace", fontWeight: 700 }}>
                                    {u.affiliateCode || "—"}
                                  </td>
                                  <td style={{ padding: "12px 14px", fontWeight: 800 }}>
                                    {userBotCount > 0 ? (
                                      <span style={{ color: "#00a651" }}>{userBotCount} Bots</span>
                                    ) : (
                                      <span style={{ color: "var(--muted)" }}>0</span>
                                    )}
                                  </td>
                                  <td style={{ padding: "12px 14px" }}>
                                    <span
                                      style={{
                                        padding: "3px 8px",
                                        borderRadius: 6,
                                        fontSize: 11,
                                        fontWeight: 800,
                                        background: u.role === "admin" ? "rgba(245,158,11,0.12)" : "rgba(148,163,184,0.12)",
                                        color: u.role === "admin" ? "#d97706" : "var(--muted)",
                                      }}
                                    >
                                      {(u.role || "user").toUpperCase()}
                                    </span>
                                  </td>
                                  <td style={{ padding: "12px 14px", textAlign: "right" }}>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditUser(u)}
                                      style={{
                                        padding: "6px 12px",
                                        borderRadius: 8,
                                        border: "1px solid var(--accent)",
                                        background: "rgba(0,166,81,0.08)",
                                        color: "var(--accent)",
                                        fontSize: 11.5,
                                        fontWeight: 800,
                                        cursor: "pointer",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 5,
                                      }}
                                    >
                                      ✏️ Edit Details
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                            {filteredUsers.length === 0 && (
                              <tr>
                                <td colSpan={8} style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>
                                  No users match the search criteria.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Mobile Cards View */}
                  <div className="admin-mobile-cards" style={{ flexDirection: "column", gap: 10 }}>
                    {filteredUsers.map((u) => {
                      const userBotCount = userBots.filter((b) => b.uid === u.uid).length;
                      const userBal = getUserBalance(u.uid);
                      return (
                        <div
                          key={u.uid}
                          className="neu-card"
                          style={{
                            borderRadius: 16,
                            padding: "14px 14px",
                            display: "flex",
                            flexDirection: "column",
                            gap: 10,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                              <div
                                style={{
                                  width: 34,
                                  height: 34,
                                  borderRadius: "50%",
                                  background: "var(--bg2)",
                                  border: "1px solid var(--stroke)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 13,
                                  fontWeight: 900,
                                }}
                              >
                                {(u.displayName || u.phone || "U").charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text)" }}>
                                  {u.displayName || u.phone || "User"}
                                </div>
                                <div style={{ fontSize: 10.5, color: "var(--muted)", fontFamily: "monospace" }}>
                                  UID: {u.uid.slice(0, 8)}…
                                </div>
                              </div>
                            </div>
                            <span
                              style={{
                                padding: "3px 8px",
                                borderRadius: 6,
                                fontSize: 10.5,
                                fontWeight: 800,
                                background: u.role === "admin" ? "rgba(245,158,11,0.12)" : "rgba(148,163,184,0.12)",
                                color: u.role === "admin" ? "#d97706" : "var(--muted)",
                              }}
                            >
                              {(u.role || "user").toUpperCase()}
                            </span>
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: 6,
                              padding: "10px 12px",
                              borderRadius: 12,
                              background: "var(--bg2)",
                              border: "1px solid var(--stroke)",
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>Live Balance</div>
                              <div style={{ fontSize: 16, fontWeight: 900, color: userBal > 0 ? "#00a651" : "var(--text)", marginTop: 2 }}>
                                ${fmt(userBal)}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>Active Bots</div>
                              <div style={{ fontSize: 13, fontWeight: 800, color: userBotCount > 0 ? "#00a651" : "var(--muted)", marginTop: 4 }}>
                                {userBotCount > 0 ? `${userBotCount} Running` : "None"}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>Referral Code</div>
                              <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace", marginTop: 2 }}>
                                {u.affiliateCode || "—"}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>Joined</div>
                              <div style={{ fontSize: 11, color: "var(--text)", fontWeight: 600, marginTop: 2 }}>
                                {fmtDate(u.createdAt)}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleOpenEditUser(u)}
                            style={{
                              width: "100%",
                              padding: "9px 0",
                              borderRadius: 10,
                              border: "1.5px solid var(--accent)",
                              background: "rgba(0,166,81,0.08)",
                              color: "var(--accent)",
                              fontWeight: 800,
                              fontSize: 12.5,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                            }}
                          >
                            ✏️ Edit Details & Set Balance
                          </button>
                        </div>
                      );
                    })}
                    {filteredUsers.length === 0 && (
                      <div className="neu-card" style={{ padding: 24, textAlign: "center", color: "var(--muted)", borderRadius: 14 }}>
                        No users match the search criteria.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ──────────────────────────────────────────────────────────
                  TAB: DEPOSIT ACCOUNTS & ADDRESSES
              ────────────────────────────────────────────────────────── */}
              {tab === "payment-methods" && <AdminPaymentAccounts />}

              {/* ──────────────────────────────────────────────────────────
                  TAB: WHATSAPP COMMUNITY GROUP
              ────────────────────────────────────────────────────────── */}
              {tab === "whatsapp" && <AdminWhatsApp />}

              {/* ──────────────────────────────────────────────────────────
                  TAB: ACCOUNT ACTIVATION CONTROL
              ────────────────────────────────────────────────────────── */}
              {tab === "user-access" && <AdminUserAccess />}

              {/* ──────────────────────────────────────────────────────────
                  TAB 6: BROADCAST ALERTS & NOTIFICATIONS
              ────────────────────────────────────────────────────────── */}
              {tab === "notifications" && <AdminNotifications />}

              {/* ──────────────────────────────────────────────────────────
                  TAB 7: PLATFORM SETTINGS
              ────────────────────────────────────────────────────────── */}
              {tab === "settings" && <AdminSettings />}
            </>
          )}
        </main>
      </div>

      {/* ── Payment Details & Image Proof Confirmation Card Modal ── */}
      {selectedPayment && (
        <div
          onClick={() => setSelectedPayment(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 520,
              maxHeight: "90vh",
              overflowY: "auto",
              background: "var(--bg1)",
              borderRadius: 22,
              padding: "24px 20px",
              border: "1.5px solid var(--stroke)",
              boxShadow: "0 12px 40px rgba(0,0,0,0.3)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>Deposit Confirmation Card</h3>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                  Key: {selectedPayment.key}
                </div>
              </div>
              <button
                onClick={() => setSelectedPayment(null)}
                style={{
                  background: "var(--bg2)",
                  border: "none",
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  color: "var(--muted)",
                }}
              >
                ✕
              </button>
            </div>

            {/* Amount & Status highlight */}
            <div
              style={{
                borderRadius: 16,
                padding: "16px",
                background: "var(--bg2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                  Deposit Amount
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, color: "var(--text)", marginTop: 2 }}>
                  ${fmt(selectedPayment.amount)} <span style={{ fontSize: 14, color: "var(--accent)" }}>{selectedPayment.currency || "USD"}</span>
                </div>
              </div>
              <span
                style={{
                  padding: "4px 12px",
                  borderRadius: 999,
                  fontSize: 11.5,
                  fontWeight: 800,
                  background: selectedPayment.status === "completed"
                    ? "rgba(14,203,129,0.15)"
                    : selectedPayment.status === "rejected"
                    ? "rgba(239,68,68,0.15)"
                    : "rgba(245,158,11,0.15)",
                  color: selectedPayment.status === "completed"
                    ? "#00a651"
                    : selectedPayment.status === "rejected"
                    ? "#ef4444"
                    : "#d97706",
                }}
              >
                {(selectedPayment.status || "PENDING").toUpperCase()}
              </span>
            </div>

            {/* Details Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12.5 }}>
              <div style={{ background: "var(--bg2)", padding: "10px 12px", borderRadius: 10 }}>
                <div style={{ color: "var(--muted)", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase" }}>
                  {selectedPayment.depositType === "crypto" || selectedPayment.txHash ? "Transaction Hash (TxID)" : "Sender Name"}
                </div>
                <div style={{ fontWeight: 800, color: "var(--text)", marginTop: 2, wordBreak: "break-all", fontFamily: (selectedPayment.depositType === "crypto" || selectedPayment.txHash) ? "monospace" : undefined }}>
                  {selectedPayment.txHash || selectedPayment.senderName || "—"}
                </div>
              </div>
              <div style={{ background: "var(--bg2)", padding: "10px 12px", borderRadius: 10 }}>
                <div style={{ color: "var(--muted)", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase" }}>Phone / Contact</div>
                <div style={{ fontWeight: 800, color: "var(--text)", marginTop: 2 }}>{selectedPayment.phone || "—"}</div>
              </div>
              <div style={{ background: "var(--bg2)", padding: "10px 12px", borderRadius: 10 }}>
                <div style={{ color: "var(--muted)", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase" }}>Network / Gateway</div>
                <div style={{ fontWeight: 800, color: "var(--text)", marginTop: 2 }}>{selectedPayment.networkName || selectedPayment.network || selectedPayment.type || "—"}</div>
              </div>
              <div style={{ background: "var(--bg2)", padding: "10px 12px", borderRadius: 10 }}>
                <div style={{ color: "var(--muted)", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase" }}>Target Account</div>
                <div style={{ fontWeight: 800, color: "var(--text)", marginTop: 2, fontFamily: "monospace" }}>{selectedPayment.accountNo || "—"}</div>
              </div>
              <div style={{ background: "var(--bg2)", padding: "10px 12px", borderRadius: 10, gridColumn: "span 2" }}>
                <div style={{ color: "var(--muted)", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase" }}>User UID</div>
                <div style={{ fontWeight: 700, color: "var(--text)", marginTop: 2, fontFamily: "monospace", wordBreak: "break-all" }}>
                  {selectedPayment.uid}
                </div>
              </div>
              <div style={{ background: "var(--bg2)", padding: "10px 12px", borderRadius: 10, gridColumn: "span 2" }}>
                <div style={{ color: "var(--muted)", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase" }}>Submission Time</div>
                <div style={{ fontWeight: 700, color: "var(--text)", marginTop: 2 }}>
                  {fmtDate(selectedPayment.createdAt)}
                </div>
              </div>
            </div>

            {/* Referral Commission Calculation Preview */}
            <div
              style={{
                borderRadius: 14,
                padding: "12px 14px",
                background: "rgba(0,166,81,0.06)",
                border: "1px solid rgba(0,166,81,0.2)",
                fontSize: 12,
              }}
            >
              <div style={{ fontWeight: 800, color: "var(--accent)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <span>💰</span>
                <span>Referral Commissions Schedule (15% Total)</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 8, textAlign: "center" }}>
                <div style={{ background: "var(--bg1)", padding: "8px 4px", borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>Level 1 (Direct)</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#00a651", marginTop: 2 }}>
                    ${fmt((selectedPayment.amount * 12) / 100)}
                  </div>
                  <div style={{ fontSize: 9.5, color: "var(--muted)" }}>12%</div>
                </div>
                <div style={{ background: "var(--bg1)", padding: "8px 4px", borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>Level 2</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#2563eb", marginTop: 2 }}>
                    ${fmt((selectedPayment.amount * 2) / 100)}
                  </div>
                  <div style={{ fontSize: 9.5, color: "var(--muted)" }}>2%</div>
                </div>
                <div style={{ background: "var(--bg1)", padding: "8px 4px", borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>Level 3</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#f59e0b", marginTop: 2 }}>
                    ${fmt((selectedPayment.amount * 1) / 100)}
                  </div>
                  <div style={{ fontSize: 9.5, color: "var(--muted)" }}>1%</div>
                </div>
              </div>
              <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 6, textAlign: "center" }}>
                {selectedPayment.commissionProcessed
                  ? "✅ Multi-tier commissions already processed and credited."
                  : "⏳ Commissions will be distributed automatically when you click Approve."}
              </div>
            </div>

            {/* Payment Proof Screenshot */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text)", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>Payment Screenshot Proof</span>
                {selectedPayment.proofUrl && (
                  <button
                    onClick={() => setPreviewImage(selectedPayment.proofUrl || null)}
                    style={{ background: "transparent", border: "none", color: "var(--accent)", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
                  >
                    View Fullscreen ↗
                  </button>
                )}
              </div>
              {selectedPayment.proofUrl ? (
                <div
                  onClick={() => setPreviewImage(selectedPayment.proofUrl || null)}
                  style={{
                    borderRadius: 14,
                    overflow: "hidden",
                    border: "1.5px solid var(--stroke)",
                    maxHeight: 220,
                    cursor: "zoom-in",
                    position: "relative",
                  }}
                >
                  <img
                    src={selectedPayment.proofUrl}
                    alt="Payment proof screenshot"
                    style={{ width: "100%", height: 220, objectFit: "contain", background: "#000" }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: 8,
                      right: 8,
                      background: "rgba(0,0,0,0.7)",
                      color: "#fff",
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: "4px 8px",
                      borderRadius: 6,
                    }}
                  >
                    🔍 Click to Enlarge
                  </div>
                </div>
              ) : (
                <div style={{ padding: "24px 0", textAlign: "center", background: "var(--bg2)", borderRadius: 12, color: "var(--muted)", fontSize: 12 }}>
                  No payment proof image uploaded for this transaction.
                </div>
              )}
            </div>

            {/* Action Buttons in Modal */}
            <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
              {selectedPayment.status !== "completed" && (
                <button
                  onClick={() => handleApproveDeposit(selectedPayment)}
                  disabled={processingKey === selectedPayment.key}
                  style={{
                    flex: 1,
                    minWidth: 140,
                    padding: "12px",
                    borderRadius: 12,
                    border: "none",
                    background: "linear-gradient(135deg, #00a651, #007a3c)",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(0,166,81,0.3)",
                  }}
                >
                  {processingKey === selectedPayment.key ? "Processing…" : "Approve & Pay Commissions"}
                </button>
              )}
              {selectedPayment.status !== "rejected" && selectedPayment.status !== "completed" && (
                <button
                  onClick={() => handleRejectDeposit(selectedPayment)}
                  disabled={processingKey === selectedPayment.key}
                  style={{
                    padding: "12px 18px",
                    borderRadius: 12,
                    border: "1.5px solid #ef4444",
                    background: "rgba(239,68,68,0.1)",
                    color: "#ef4444",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Reject
                </button>
              )}
              <button
                onClick={() => handleDeleteDeposit(selectedPayment)}
                disabled={processingKey === selectedPayment.key}
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--stroke)",
                  background: "var(--bg2)",
                  color: "#ef4444",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
                title="Delete deposit record"
              >
                Delete 🗑️
              </button>
              <button
                onClick={() => setSelectedPayment(null)}
                style={{
                  padding: "12px 18px",
                  borderRadius: 12,
                  border: "1px solid var(--stroke)",
                  background: "var(--bg2)",
                  color: "var(--text)",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Fullscreen Proof Lightbox ── */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 20000,
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}>
            <img
              src={previewImage}
              alt="Fullscreen payment proof"
              style={{
                maxWidth: "100%",
                maxHeight: "85vh",
                objectFit: "contain",
                borderRadius: 12,
                boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
              }}
            />
            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 12 }}>
              <a
                href={previewImage}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: "var(--accent)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 12,
                  textDecoration: "none",
                }}
              >
                Open in New Tab ↗
              </a>
              <button
                onClick={() => setPreviewImage(null)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.2)",
                  color: "#fff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Custom Popup Dialog Card (Replaces native browser alert/confirm/prompt) ── */}
      {popupDialog && popupDialog.isOpen && (
        <div
          onClick={() => setPopupDialog(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 15000,
            background: "rgba(0,0,0,0.72)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="neu-card"
            style={{
              width: "100%",
              maxWidth: 450,
              borderRadius: 20,
              padding: "24px 20px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
              border: "1px solid var(--stroke)",
              position: "relative",
              background: "var(--bg1)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  background: popupDialog.confirmColor === "#ef4444" ? "rgba(239,68,68,0.12)" : "rgba(0,166,81,0.12)",
                  color: popupDialog.confirmColor || "#00a651",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {popupDialog.confirmColor === "#ef4444" ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                )}
              </div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "var(--text)" }}>{popupDialog.title}</h3>
            </div>

            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 16px", lineHeight: 1.5, whiteSpace: "pre-line" }}>
              {popupDialog.message}
            </p>

            {popupDialog.type === "prompt" && (
              <div style={{ marginBottom: 18 }}>
                <input
                  className="input"
                  autoFocus
                  value={popupDialog.inputValue ?? ""}
                  onChange={(e) => setPopupDialog({ ...popupDialog, inputValue: e.target.value })}
                  placeholder={popupDialog.inputPlaceholder || "Enter details…"}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      popupDialog.onConfirm(popupDialog.inputValue);
                    } else if (e.key === "Escape") {
                      setPopupDialog(null);
                    }
                  }}
                  style={{ width: "100%", padding: "10px 14px", fontSize: 13 }}
                />
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setPopupDialog(null)}
                style={{
                  padding: "10px 18px",
                  borderRadius: 12,
                  border: "1px solid var(--stroke)",
                  background: "var(--bg2)",
                  color: "var(--text)",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {popupDialog.cancelLabel || "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => popupDialog.onConfirm(popupDialog.inputValue)}
                style={{
                  padding: "10px 20px",
                  borderRadius: 12,
                  border: "none",
                  background: popupDialog.confirmColor || "#00a651",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: "pointer",
                  boxShadow: `0 4px 14px ${popupDialog.confirmColor === "#ef4444" ? "rgba(239,68,68,0.3)" : "rgba(0,166,81,0.3)"}`,
                }}
              >
                {popupDialog.confirmLabel || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit User Details & Balance Modal Card ── */}
      {editingUser && (
        <div
          onClick={() => setEditingUser(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 14000,
            background: "rgba(0,0,0,0.72)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="neu-card"
            style={{
              width: "100%",
              maxWidth: 500,
              maxHeight: "90vh",
              overflowY: "auto",
              borderRadius: 22,
              padding: "24px 20px",
              boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
              border: "1px solid var(--stroke)",
              position: "relative",
              background: "var(--bg1)",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #00a651, #007a3c)",
                    color: "#fff",
                    fontWeight: 900,
                    fontSize: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {(editingUser.displayName || editingUser.phone || "U").charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "var(--text)" }}>
                    Edit User Profile & Balance
                  </h3>
                  <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "monospace" }}>
                    UID: {editingUser.uid}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border: "1px solid var(--stroke)",
                  background: "var(--bg2)",
                  color: "var(--muted)",
                  fontSize: 16,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>

            {/* Current Balance & Adjustment Banner */}
            <div
              style={{
                borderRadius: 16,
                padding: "16px",
                background: "linear-gradient(135deg, rgba(0,166,81,0.08), rgba(0,166,81,0.02))",
                border: "1.5px solid rgba(0,166,81,0.25)",
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: "#00a651", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Current Live Balance
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text)", marginTop: 2 }}>
                    ${fmt(getUserBalance(editingUser.uid))}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 700 }}>Joined AUTEX</div>
                  <div style={{ fontSize: 11.5, color: "var(--text)", fontWeight: 700, marginTop: 2 }}>
                    {fmtDate(editingUser.createdAt)}
                  </div>
                </div>
              </div>

              {/* Edit Balance Input */}
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 800, color: "var(--text)", display: "block", marginBottom: 6 }}>
                  Set New Target Balance ($ USD)
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 15, fontWeight: 800, color: "var(--muted)" }}>$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input"
                    value={editBalance}
                    onChange={(e) => setEditBalance(e.target.value)}
                    placeholder="0.00"
                    style={{ width: "100%", padding: "10px 14px 10px 28px", fontSize: 16, fontWeight: 800 }}
                  />
                </div>

                {/* Quick Add / Deduct Chips */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {[
                    { label: "+$10", val: 10 },
                    { label: "+$50", val: 50 },
                    { label: "+$100", val: 100 },
                    { label: "+$500", val: 500 },
                    { label: "-$10", val: -10 },
                    { label: "Reset to 0", val: -999999 },
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => {
                        const cur = Math.max(0, parseFloat(editBalance) || 0);
                        if (chip.val === -999999) {
                          setEditBalance("0.00");
                        } else {
                          setEditBalance(Math.max(0, cur + chip.val).toFixed(2));
                        }
                      }}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 8,
                        border: "1px solid var(--stroke)",
                        background: "var(--bg1)",
                        color: chip.val < 0 ? "#ef4444" : "var(--accent)",
                        fontSize: 10.5,
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {/* Optional Reason */}
                <div style={{ marginTop: 10 }}>
                  <input
                    className="input"
                    value={editBalanceReason}
                    onChange={(e) => setEditBalanceReason(e.target.value)}
                    placeholder="Adjustment reason (optional, e.g. Manual credit / bonus)"
                    style={{ width: "100%", padding: "8px 12px", fontSize: 11.5 }}
                  />
                </div>
              </div>
            </div>

            {/* Profile Fields */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 800, color: "var(--muted)", display: "block", marginBottom: 5 }}>
                  Phone Number
                </label>
                <input
                  className="input"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+263..."
                  style={{ width: "100%", padding: "9px 12px", fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11.5, fontWeight: 800, color: "var(--muted)", display: "block", marginBottom: 5 }}>
                  Display Name
                </label>
                <input
                  className="input"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="Trader Name"
                  style={{ width: "100%", padding: "9px 12px", fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11.5, fontWeight: 800, color: "var(--muted)", display: "block", marginBottom: 5 }}>
                  Email Address
                </label>
                <input
                  className="input"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="user@example.com"
                  style={{ width: "100%", padding: "9px 12px", fontSize: 13 }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 800, color: "var(--muted)", display: "block", marginBottom: 5 }}>
                    Role
                  </label>
                  <select
                    className="input"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", fontSize: 13, background: "var(--bg2)" }}
                  >
                    <option value="user">User (Standard)</option>
                    <option value="admin">Administrator 👑</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 800, color: "var(--muted)", display: "block", marginBottom: 5 }}>
                    Affiliate Code
                  </label>
                  <input
                    className="input"
                    value={editAffiliateCode}
                    onChange={(e) => setEditAffiliateCode(e.target.value.toUpperCase())}
                    placeholder="CODE123"
                    style={{ width: "100%", padding: "9px 12px", fontSize: 13, fontFamily: "monospace" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11.5, fontWeight: 800, color: "var(--muted)", display: "block", marginBottom: 5 }}>
                  Referred By (Upline UID or Code)
                </label>
                <input
                  className="input"
                  value={editReferredBy}
                  onChange={(e) => setEditReferredBy(e.target.value)}
                  placeholder="Optional Upline UID"
                  style={{ width: "100%", padding: "9px 12px", fontSize: 13, fontFamily: "monospace" }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                style={{
                  flex: 1,
                  padding: "11px 16px",
                  borderRadius: 12,
                  border: "1px solid var(--stroke)",
                  background: "var(--bg2)",
                  color: "var(--text)",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveUser}
                disabled={savingUser}
                style={{
                  flex: 1.6,
                  padding: "11px 16px",
                  borderRadius: 12,
                  border: "none",
                  background: "linear-gradient(135deg, #00a651, #007a3c)",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: savingUser ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 14px rgba(0,166,81,0.3)",
                }}
              >
                {savingUser ? "Saving Changes…" : "Save Changes & Balance"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CSS Responsive Styles ── */}
      <style>{`
        @media (min-width: 901px) {
          .admin-sidebar {
            transform: translateX(0) !important;
            box-shadow: none !important;
          }
          .admin-main {
            margin-left: 260px !important;
          }
          .mobile-hamburger-btn {
            display: none !important;
          }
          .mobile-close-btn {
            display: none !important;
          }
        }
        @media (max-width: 900px) {
          .admin-main {
            margin-left: 0 !important;
          }
        }
        @media (max-width: 768px) {
          .admin-desktop-table {
            display: none !important;
          }
          .admin-mobile-cards {
            display: flex !important;
          }
        }
        @media (min-width: 769px) {
          .admin-desktop-table {
            display: block !important;
          }
          .admin-mobile-cards {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
