import { Navigate, Route, Routes } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { Me } from "@/lib/types";
import Shell from "@/components/layout/Shell";
import JarvisOrb from "@/components/jarvis/JarvisOrb";
import PinLogin from "@/pages/PinLogin";
import Command from "@/pages/Command";
import Chat from "@/pages/Chat";
import Tasks from "@/pages/Tasks";
import Social from "@/pages/Social";
import Crm from "@/pages/Crm";
import Studio from "@/pages/Studio";
import System from "@/pages/System";

function Guard({ children }: { children: React.ReactNode }) {
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<Me>("/auth/me"),
    retry: false,
    staleTime: 60_000,
  });

  if (me.isPending) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <JarvisOrb state="THINKING" size={180} />
      </div>
    );
  }
  if (me.isError || !me.data?.authenticated) return <Navigate to="/login" replace />;
  return <Shell>{children}</Shell>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PinLogin />} />
      <Route
        path="/"
        element={
          <Guard>
            <Command />
          </Guard>
        }
      />
      <Route
        path="/chat"
        element={
          <Guard>
            <Chat />
          </Guard>
        }
      />
      <Route
        path="/tasks"
        element={
          <Guard>
            <Tasks />
          </Guard>
        }
      />
      <Route
        path="/social"
        element={
          <Guard>
            <Social />
          </Guard>
        }
      />
      <Route
        path="/crm"
        element={
          <Guard>
            <Crm />
          </Guard>
        }
      />
      <Route
        path="/studio"
        element={
          <Guard>
            <Studio />
          </Guard>
        }
      />
      <Route
        path="/system"
        element={
          <Guard>
            <System />
          </Guard>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
