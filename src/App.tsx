import { lazy, Suspense } from "react";
import { HashRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AppLayout } from "./components/AppLayout";

const LoginPage = lazy(() => import("./pages/LoginPage").then((module) => ({ default: module.LoginPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const ShipmentEditorPage = lazy(() => import("./pages/ShipmentEditorPage").then((module) => ({ default: module.ShipmentEditorPage })));
const PublicTrackerPage = lazy(() => import("./pages/PublicTrackerPage").then((module) => ({ default: module.PublicTrackerPage })));
const StaffPage = lazy(() => import("./pages/StaffPage").then((module) => ({ default: module.StaffPage })));

function ProtectedRoute() {
  const { session, profile, loading } = useAuth();
  if (loading) return <main className="public-state"><div className="spinner" /><p>Opening workspace…</p></main>;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile?.active) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function AdminRoute() {
  const { profile } = useAuth();
  return profile?.role === "admin" ? <Outlet /> : <Navigate to="/shipments" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<main className="public-state"><div className="spinner" /><p>Loading…</p></main>}>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/track/:shareToken" element={<PublicTrackerPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/shipments" element={<DashboardPage />} />
                <Route path="/shipments/new" element={<ShipmentEditorPage />} />
                <Route path="/shipments/:id" element={<ShipmentEditorPage />} />
                <Route element={<AdminRoute />}><Route path="/settings/staff" element={<StaffPage />} /></Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/shipments" replace />} />
          </Routes>
        </HashRouter>
      </Suspense>
    </AuthProvider>
  );
}
