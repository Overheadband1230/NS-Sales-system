import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function AppLayout() {
  const { profile, signOut } = useAuth();
  return (
    <div className="shell">
      <header className="app-header">
        <NavLink className="brand" to="/shipments"><span>NS</span><div><strong>Shipment Tracker</strong><small>Online workspace</small></div></NavLink>
        <nav>
          <NavLink to="/shipments">Shipments</NavLink>
          {profile?.role === "admin" && <NavLink to="/settings/staff">Staff</NavLink>}
        </nav>
        <div className="account-menu"><span>{profile?.display_name || profile?.email}</span><button className="text-button" onClick={() => void signOut()}>Sign out</button></div>
      </header>
      <main className="page"><Outlet /></main>
    </div>
  );
}
