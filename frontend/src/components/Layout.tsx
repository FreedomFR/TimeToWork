import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";

/** Authenticated page shell: sidebar on the left, the routed page in the scrollable main area. */
export default function Layout() {
  const { pathname } = useLocation();
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      {/* Keyed by page: each page fades in, and starts scrolled to the top */}
      <main key={pathname} className="flex-1 overflow-y-auto bg-bg animate-page-in">
        <Outlet />
      </main>
    </div>
  );
}
