import type { ReactElement } from "react";
import { Navigate, Route, Routes, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Home from "@/pages/Home";
import BetslipDetail from "@/pages/BetslipDetail";
import MovieGroupDetail from "@/pages/MovieGroupDetail";
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import Register from "@/pages/Register";
import Admin from "@/pages/Admin";
import PaymentHistory from "@/pages/PaymentHistory";
import Deposit from "@/pages/Deposit";
import Withdraw from "@/pages/Withdraw";
import Support from "@/pages/Support";
import PaymentReturn from "@/pages/PaymentReturn";
import PaymentCancel from "@/pages/PaymentCancel";
import Account from "@/pages/Account";
import Bots from "@/pages/Bots";
import MyBots from "@/pages/MyBots";
import Notifications from "@/pages/Notifications";
import Movies from "@/pages/Movies";
import Affiliate from "@/pages/Affiliate";
import LiveMatches from "@/pages/LiveMatches";

/** Spinner shown while Firebase Auth determines the current session */
function AuthLoadingScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg0, #eef2f6)",
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          border: "3px solid var(--stroke, rgba(0,0,0,0.08))",
          borderTopColor: "var(--accent, #00a651)",
          animation: "authSpin 0.75s linear infinite",
        }}
      />
      <style>{`@keyframes authSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/** Route wrapper for protected pages: redirects unauthenticated users to /login */
function ProtectedLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

/** Route wrapper for public auth pages: redirects already-logged-in users to / */
function PublicOnlyRoute({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
}

/** Route wrapper for admin pages: requires user and admin role */
function AdminRoute({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      {/* Public auth pages */}
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <Register />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicOnlyRoute>
            <ForgotPassword />
          </PublicOnlyRoute>
        }
      />

      {/* Authenticated pages: any unauthenticated visit redirects to /login */}
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/affiliate" element={<Affiliate />} />
        <Route path="/live" element={<LiveMatches />} />
        <Route path="/slip/:id" element={<BetslipDetail />} />
        <Route path="/payments" element={<PaymentHistory />} />
        <Route path="/deposit" element={<Deposit />} />
        <Route path="/withdraw" element={<Withdraw />} />
        <Route path="/support" element={<Support />} />
        <Route path="/account" element={<Account />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/chat" element={<Navigate to="/my-bots" replace />} />
        <Route path="/bots" element={<Bots />} />
        <Route path="/my-bots" element={<MyBots />} />
        <Route path="/payment/return" element={<PaymentReturn />} />
        <Route path="/payment/cancel" element={<PaymentCancel />} />
        <Route path="/movies" element={<Movies />} />
        <Route path="/movies/:groupId" element={<MovieGroupDetail />} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <Admin />
            </AdminRoute>
          }
        />
      </Route>

      {/* Catch-all fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
