import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Delete, ShieldCheck } from "lucide-react";
import { apiPost, ApiError } from "@/lib/api";
import type { Me } from "@/lib/types";
import JarvisOrb from "@/components/jarvis/JarvisOrb";

export default function PinLogin() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const login = useMutation({
    mutationFn: (value: string) => apiPost<Me>("/auth/login", { pin: value }),
    onSuccess: () => navigate("/", { replace: true }),
    onError: (e: unknown) => {
      setPin("");
      setError(
        e instanceof ApiError && e.status === 401
          ? "Geçersiz erişim kodu. Tekrar deneyin."
          : "Sunucuya ulaşılamadı. Bağlantıyı kontrol edin.",
      );
    },
  });

  const press = (d: string) => {
    setError("");
    const next = (pin + d).slice(0, 8);
    setPin(next);
  };

  const submit = () => {
    if (pin.length < 3) {
      setError("Erişim kodu en az 3 hane olmalı.");
      return;
    }
    login.mutate(pin);
  };

  return (
    <div className="q8-stage relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="q8-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(800px 500px at 20% 20%, rgba(0,240,255,0.13), transparent 60%), radial-gradient(700px 500px at 85% 80%, rgba(189,0,255,0.10), transparent 60%)",
        }}
      />
      <div className="q8-scanline" aria-hidden="true" />

      <div className="relative z-10 grid w-full max-w-4xl items-center gap-10 md:grid-cols-2">
        <div className="flex flex-col items-center gap-6 text-center md:items-start md:text-left">
          <JarvisOrb state={login.isPending ? "THINKING" : "IDLE"} size={210} />
          <div className="mt-4">
            <div className="q8-overline">Q8Ka By Leohoca</div>
            <h1 className="mt-2 font-heading text-4xl font-bold md:text-5xl">JARVIS</h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-[#7B96B2]">
              Kişisel yapay zeka işletim merkezi. Erişim için operatör kodunuzu girin.
            </p>
          </div>
        </div>

        <div className="q8-glass q8-bracket relative rounded-2xl p-6">
          <div className="mb-5 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#00F0FF]" />
            <span className="q8-overline">Güvenli Giriş Konsolu</span>
          </div>

          <div
            className="mb-5 flex h-14 items-center justify-center gap-3 rounded-xl border border-[#00F0FF]/25 bg-[#050811]/70 font-mono text-2xl tracking-[0.5em] text-[#00F0FF]"
            data-testid="pin-display"
          >
            {pin ? "•".repeat(pin.length) : <span className="text-sm tracking-widest text-[#42607d]">KOD</span>}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button
                key={d}
                type="button"
                data-testid={`pin-key-${d}`}
                onClick={() => press(d)}
                className="h-14 rounded-xl border border-[#00F0FF]/20 bg-[#0B132B]/60 font-mono text-xl text-[#C7E4FF] transition-[background-color,box-shadow,border-color] duration-200 hover:border-[#00F0FF]/60 hover:bg-[#00F0FF]/10 hover:shadow-[0_0_18px_rgba(0,240,255,0.25)] active:scale-95"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              data-testid="pin-key-clear"
              onClick={() => {
                setPin("");
                setError("");
              }}
              className="h-14 rounded-xl border border-[#FF3366]/25 bg-[#0B132B]/60 text-[#FF3366] transition-colors duration-200 hover:bg-[#FF3366]/10"
              aria-label="Temizle"
            >
              <Delete className="mx-auto h-5 w-5" />
            </button>
            <button
              type="button"
              data-testid="pin-key-0"
              onClick={() => press("0")}
              className="h-14 rounded-xl border border-[#00F0FF]/20 bg-[#0B132B]/60 font-mono text-xl text-[#C7E4FF] transition-[background-color,box-shadow,border-color] duration-200 hover:border-[#00F0FF]/60 hover:bg-[#00F0FF]/10 active:scale-95"
            >
              0
            </button>
            <button
              type="button"
              data-testid="pin-submit"
              disabled={login.isPending}
              onClick={submit}
              className="h-14 rounded-xl border border-[#00F0FF]/60 bg-[#00F0FF]/15 font-mono text-xs uppercase tracking-widest text-[#00F0FF] transition-[background-color,box-shadow] duration-200 hover:bg-[#00F0FF]/25 hover:shadow-[0_0_24px_rgba(0,240,255,0.35)] disabled:opacity-50"
            >
              {login.isPending ? "…" : "GİR"}
            </button>
          </div>

          {error ? (
            <p className="mt-4 text-center text-sm text-[#FF3366]" data-testid="pin-error">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
