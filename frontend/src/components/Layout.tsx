import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

/** Authenticated page shell: sidebar on the left, the routed page in the scrollable main area. */
export default function Layout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-bg">
        <Outlet />
      </main>
    </div>
  );
}
