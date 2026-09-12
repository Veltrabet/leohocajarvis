import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Plus, Trash2, XCircle } from "lucide-react";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import type { Activity, Capability, Memory } from "@/lib/types";
import Panel from "@/components/layout/Panel";
import { toast } from "sonner";

const CAP_LABEL: Record<string, string> = {
  text: "LLM · Metin / Akıl Yürütme",
  image: "Image AI · Görsel Üret & Düzenle",
  voice: "Ses · STT + TTS (Türkçe)",
  video: "Video AI · Text→Video / Image→Video",
};

export default function System() {
  const qc = useQueryClient();
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");

  const caps = useQuery({
    queryKey: ["capabilities"],
    queryFn: () => apiGet<Capability[]>("/system/capabilities"),
    retry: false,
  });
  const memory = useQuery({
    queryKey: ["memory"],
    queryFn: () => apiGet<Memory[]>("/memory"),
    retry: false,
  });
  const activity = useQuery({
    queryKey: ["activity"],
    queryFn: () => apiGet<Activity[]>("/activity?limit=80"),
    retry: false,
  });

  const addMemory = useMutation({
    mutationFn: () => apiPost<Memory>("/memory", { key, value }),
    onSuccess: () => {
      setKey("");
      setValue("");
      qc.invalidateQueries({ queryKey: ["memory"] });
      qc.invalidateQueries({ queryKey: ["activity"] });
      toast.success("Kalıcı hafızaya eklendi.");
    },
    onError: () => toast.error("Hafızaya eklenemedi."),
  });

  const delMemory = useMutation({
    mutationFn: (id: string) => apiDelete<{ deleted: boolean }>(`/memory/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memory"] }),
  });

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Servis Durumu (Gerçek)" testId="panel-capabilities" className="lg:col-span-2">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" data-testid="capability-list">
          {(caps.data ?? []).map((c) => (
            <div
              key={c.capability}
              data-testid={`capability-${c.capability}`}
              className="rounded-xl border border-white/6 bg-[#050811]/55 p-4"
            >
              <div className="mb-2 flex items-center gap-2">
                {c.configured ? (
                  <CheckCircle2 className="h-4 w-4 text-[#00FFA3]" />
                ) : (
                  <XCircle className="h-4 w-4 text-[#FF3366]" />
                )}
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#8EA8C3]">
                  {c.configured ? "BAĞLI" : "BAĞLI DEĞİL"}
                </span>
              </div>
              <p className="text-sm font-semibold text-[#E2F1FF]">
                {CAP_LABEL[c.capability] ?? c.capability}
              </p>
              <p className="mt-1 font-mono text-[10px] tracking-wide text-[#5d7a97]">
                {c.configured ? `${c.provider} · ${c.model}` : "API anahtarı / servis tanımlı değil"}
              </p>
            </div>
          ))}
          {(caps.data ?? []).length === 0 ? (
            <p className="text-sm text-[#5d7a97]">Servis durumu okunamadı (bağlantı yok).</p>
          ) : null}
        </div>
        <p className="mt-4 font-mono text-[10px] leading-relaxed tracking-wide text-[#42607d]">
          Sağlayıcılar backend/.env üzerinden değiştirilebilir: OPENAI_API_KEY, GEMINI_API_KEY,
          JARVIS_TEXT_MODEL, JARVIS_IMAGE_MODEL. Anahtarlar asla frontend'e gönderilmez.
        </p>
      </Panel>

      <Panel title="Kalıcı Hafıza" testId="panel-memory">
        <form
          className="mb-4 grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (key.trim() && value.trim()) addMemory.mutate();
          }}
        >
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Anahtar (örn: tercih_edilen_stack)"
            data-testid="memory-key-input"
            className="h-11 rounded-xl border border-[#00F0FF]/20 bg-[#050811]/70 px-3 text-sm text-[#E2F1FF] outline-none placeholder:text-[#4b6782] focus:border-[#00F0FF]/60"
          />
          <div className="flex gap-2">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Değer (örn: FastAPI + React + Mongo)"
              data-testid="memory-value-input"
              className="h-11 flex-1 rounded-xl border border-[#00F0FF]/20 bg-[#050811]/70 px-3 text-sm text-[#E2F1FF] outline-none placeholder:text-[#4b6782] focus:border-[#00F0FF]/60"
            />
            <button
              type="submit"
              data-testid="memory-add-button"
              className="grid h-11 w-11 place-items-center rounded-xl border border-[#00F0FF]/50 bg-[#00F0FF]/12 text-[#00F0FF] transition-colors duration-200 hover:bg-[#00F0FF]/25"
              aria-label="Hafızaya ekle"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </form>

        {(memory.data ?? []).length === 0 ? (
          <p className="text-sm text-[#5d7a97]" data-testid="memory-empty">
            Hafıza boş. JARVIS sohbet sırasında öğrendiklerini otomatik olarak buraya kaydeder.
          </p>
        ) : (
          <ul className="space-y-2" data-testid="memory-list">
            {(memory.data ?? []).map((m) => (
              <li
                key={m.id}
                className="flex items-start gap-3 rounded-lg border border-white/6 bg-[#050811]/55 px-3 py-2.5"
              >
                <div className="flex-1">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#00F0FF]">
                    {m.key} · {m.source}
                  </p>
                  <p className="text-sm text-[#D6E9FF]">{m.value}</p>
                </div>
                <button
                  type="button"
                  onClick={() => delMemory.mutate(m.id)}
                  data-testid={`memory-delete-${m.id}`}
                  className="text-[#5d7a97] transition-colors duration-200 hover:text-[#FF3366]"
                  aria-label="Hafıza kaydını sil"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Tam İşlem Günlüğü" testId="panel-full-activity">
        {(activity.data ?? []).length === 0 ? (
          <p className="text-sm text-[#5d7a97]">Kayıt yok.</p>
        ) : (
          <ul className="max-h-[520px] space-y-1.5 overflow-y-auto pr-1" data-testid="full-activity-list">
            {(activity.data ?? []).map((a) => (
              <li key={a.id} className="flex items-start gap-3 rounded-lg bg-[#050811]/50 px-3 py-2">
                <span className="font-mono text-[11px] text-[#00F0FF]">
                  {new Date(a.created_at).toLocaleString("tr-TR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="flex-1 text-sm text-[#A9C6E3]">{a.message}</span>
                <span
                  className="font-mono text-[10px] uppercase"
                  style={{ color: a.status === "error" ? "#FF3366" : "#00FFA3" }}
                >
                  {a.kind}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
