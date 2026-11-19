import { Link, NavLink, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "@/firebase";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import type { AppNotification } from "@/types";

function linkCls({ isActive }: { isActive: boolean }) {
  return isActive ? "active" : undefined;
}

export function Navbar() {
  const { user, loading, isAdmin, logout } = useAuth();
  const { t } = useLanguage();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [params, setParams] = useSearchParams();
  const query = params.get("q") || "";

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    
    let notifications: AppNotification[] = [];
    let reads: Record<string, boolean> = {};

    const updateCount = () => {
      const count = notifications.filter(n => n.id && !reads[n.id]).length;
      setUnreadCount(count);
    };

    const notifRef = ref(db, "notifications");
    const unsubNotifs = onValue(notifRef, (snap) => {
      const data = snap.val() as Record<string, AppNotification> | null;
      if (data) {
        notifications = Object.entries(data).map(([id, val]) => ({ ...val, id }));
      } else {
        notifications = [];
      }
      updateCount();
    });

    const readsRef = ref(db, `userReads/${user.uid}`);
    const unsubReads = onValue(readsRef, (snap) => {
      reads = snap.val() || {};
      updateCount();
    });

    return () => {
      unsubNotifs();
      unsubReads();
    };
  }, [user]);

  if (isSearchActive) {
    return (
      <nav className="nav search-active-nav" style={{ padding: "4px 12px", display: "flex", alignItems: "center", gap: 8, height: "40px", minHeight: "40px" }}>
        <button
          type="button"
          onClick={() => { setIsSearchActive(false); params.delete("q"); setParams(params); }}
          style={{ background: "transparent", border: "none", color: "var(--muted)", padding: "4px", cursor: "pointer", display: "flex", alignItems: "center" }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>
        <input
          type="text"
          autoFocus
          placeholder={t.searchPlaceholder || "Search..."}
          value={query}
          onChange={(e) => {
            const val = e.target.value;
            if (val) {
              params.set("q", val);
            } else {
              params.delete("q");
            }
            setParams(params);
          }}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            color: "var(--text)",
            fontSize: "16px",
            outline: "none",
            width: "100%",
          }}
        />
        {query && (
          <button
            type="button"
            onClick={() => { params.delete("q"); setParams(params); }}
            style={{ background: "transparent", border: "none", color: "var(--muted)", padding: "4px", cursor: "pointer", display: "flex", alignItems: "center" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
      </nav>
    );
  }

  return (
    <nav className="nav">
      <Link to="/" className="brand" title="Mfalme wa Mikeka">
        <span aria-hidden style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="22" height="18" viewBox="0 0 28 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="crown-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fef9c3" />
                <stop offset="40%" stopColor="#facc15" />
                <stop offset="100%" stopColor="#a16207" />
              </linearGradient>
            </defs>
            <polygon points="2,22 7,8 14,16 21,8 26,22" fill="url(#crown-grad)" />
            <circle cx="2" cy="8" r="2.5" fill="#facc15" />
            <circle cx="14" cy="4" r="2.5" fill="#fef08a" />
            <circle cx="26" cy="8" r="2.5" fill="#facc15" />
          </svg>
        </span>
        <span className="brand-text-mfalme" style={{ fontSize: 14, letterSpacing: "0.06em", fontStyle: "normal" }}>MWM</span>
      </Link>
      <div className="nav-links">
        <button
          type="button"
          onClick={() => setIsSearchActive(true)}
          title={t.search || "Search"}
          style={{ background: "transparent", border: "none", color: "var(--muted)", padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </button>
        {user && isAdmin && (
          <NavLink to="/admin" className={linkCls}>
            {t.admin}
          </NavLink>
        )}
        {!loading && !user && (
          <>
            <NavLink to="/login" className={linkCls}>
              {t.logIn}
            </NavLink>
            <NavLink to="/register" className={linkCls}>
              {t.register}
            </NavLink>
          </>
        )}
        {user && (
          <div className="row" style={{ alignItems: "center", gap: 16 }}>
            <Link to="/notifications" style={{ position: "relative", display: "flex", alignItems: "center", color: "var(--text)" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              {unreadCount > 0 && (
                <span style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  background: "var(--danger)",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: "bold",
                  borderRadius: "10px",
                  padding: "2px 6px",
                  minWidth: 18,
                  textAlign: "center"
                }}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
            <button type="button" onClick={() => void logout()}>
              {t.signOut}
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
