import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, CheckSquare, Cpu, Database, Instagram, LogOut, Sparkles, Users } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import type { Me } from "@/lib/types";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import LangSwitch from "@/components/layout/LangSwitch";

const NAV = [
  { label: "Komuta", path: "/", icon: Cpu, key: "command" },
  { label: "Sohbet", path: "/chat", icon: Bot, key: "chat" },
  { label: "Görevler", path: "/tasks", icon: CheckSquare, key: "tasks" },
  { label: "Sosyal", path: "/social", icon: Instagram, key: "social" },
  { label: "Müşteri", path: "/crm", icon: Users, key: "crm" },
  { label: "Stüdyo", path: "/studio", icon: Sparkles, key: "studio" },
  { label: "Sistem", path: "/system", icon: Database, key: "system" },
];

export default function Shell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<Me>("/auth/me"),
    retry: false,
  });

  const logout = useMutation({
    mutationFn: () => apiPost<Me>("/auth/logout"),
    onSuccess: () => {
      qc.clear();
      navigate("/login");
    },
  });

  return (
    <div className="q8-stage relative min-h-screen overflow-x-hidden text-foreground">
      <div className="q8-grid pointer-events-none fixed inset-0 opacity-40" aria-hidden="true" />
      <div className="q8-scanline" aria-hidden="true" />

      <header className="sticky top-0 z-40 border-b border-[#00F0FF]/15 bg-[#050811]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-3 py-3 md:px-6">
          <Link to="/" className="flex items-center gap-3" data-testid="brand-link">
            <div
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#00F0FF]/40"
              style={{ boxShadow: "0 0 18px rgba(0,240,255,0.25)" }}
            >
              <span className="font-heading text-sm font-bold text-[#00F0FF]">Q8</span>
            </div>
            <div className="leading-tight">
              <div className="font-heading text-base font-bold tracking-tight">JARVIS</div>
              <div className="q8-overline">Q8Ka By Leohoca</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-0.5 lg:flex" data-testid="desktop-nav">
            {NAV.map((n) => {
              const active = location.pathname === n.path;
              return (
                <Link
                  key={n.path}
                  to={n.path}
                  data-testid={`nav-${n.key}`}
                  className={cn(
                    "rounded-lg px-2.5 py-2 font-mono text-[11px] uppercase tracking-widest transition-colors duration-200",
                    active
                      ? "bg-[#00F0FF]/10 text-[#00F0FF]"
                      : "text-[#7B96B2] hover:bg-white/5 hover:text-[#C7E4FF]",
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <LangSwitch />
            <span className="hidden font-mono text-[11px] tracking-widest text-[#7B96B2] xl:block">
              {me.data?.operator ? me.data.operator.toUpperCase() : "…"}
            </span>
            <button
              type="button"
              onClick={() => logout.mutate()}
              data-testid="logout-button"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#00F0FF]/25 text-[#7B96B2] transition-colors duration-200 hover:border-[#FF3366]/50 hover:text-[#FF3366]"
              aria-label="Oturumu kapat"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1600px] px-3 pb-28 pt-5 md:px-6 md:pb-10">
        {children}
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex h-[70px] items-center gap-1 overflow-x-auto border-t border-[#00F0FF]/20 bg-[#080E1E]/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl lg:hidden"
        data-testid="mobile-nav"
      >
        {NAV.map((n) => {
          const Icon = n.icon;
          const active = location.pathname === n.path;
          return (
            <Link
              key={n.path}
              to={n.path}
              data-testid={`mobilenav-${n.key}`}
              className={cn(
                "flex min-w-[58px] flex-1 flex-col items-center gap-1 rounded-xl py-2 transition-colors duration-200",
                active ? "bg-[#00F0FF]/10 text-[#00F0FF]" : "text-[#63809c]",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[9.5px] tracking-wide">{n.label}</span>
            </Link>
          );
        })}
      </nav>

      <Toaster />
    </div>
  );
}
