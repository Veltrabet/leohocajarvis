import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CircleDot, Mic, MicOff, Send, Sparkles, Square } from "lucide-react";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import type { Activity, DailyBrief, Task } from "@/lib/types";
import JarvisOrb from "@/components/jarvis/JarvisOrb";
import Panel from "@/components/layout/Panel";
import { useJarvis } from "@/hooks/useJarvis";
import { toast } from "sonner";

const PRIORITY_COLOR: Record<string, string> = {
  kritik: "#FF3366",
  yuksek: "#FFB800",
  normal: "#38BDF8",
  dusuk: "#7B96B2",
};

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

export default function Command() {
  const qc = useQueryClient();
  const jarvis = useJarvis();
  const [input, setInput] = useState("");
  const [answer, setAnswer] = useState("");
  const [voiceMode, setVoiceMode] = useState(false);
  const voiceModeRef = useRef(false);

  const tasks = useQuery({ queryKey: ["tasks"], queryFn: () => apiGet<Task[]>("/tasks"), retry: false });
  const activity = useQuery({
    queryKey: ["activity"],
    queryFn: () => apiGet<Activity[]>("/activity?limit=12"),
    retry: false,
  });

  const brief = useMutation({
    mutationFn: () => apiPost<DailyBrief>("/brief"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activity"] }),
    onError: () => toast.error("Günlük özet üretilemedi. AI servisini kontrol edin."),
  });

  const complete = useMutation({
    mutationFn: (id: string) => apiPatch<Task>(`/tasks/${id}`, { status: "tamam" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["activity"] });
      toast.success("Görev tamamlandı olarak işaretlendi.");
    },
  });

  const open = (tasks.data ?? []).filter((t) => t.status !== "tamam");
  const priority = [...open].sort(
    (a, b) =>
      ["kritik", "yuksek", "normal", "dusuk"].indexOf(a.priority) -
      ["kritik", "yuksek", "normal", "dusuk"].indexOf(b.priority),
  );

  const run = async (text: string, speak: boolean) => {
    setAnswer("");
    setInput("");
    const final = await jarvis.send(text, speak);
    if (final) setAnswer(final);
  };

  const startVoiceMode = () => {
    voiceModeRef.current = true;
    setVoiceMode(true);
    const ok = jarvis.voice.startListening((text) => {
      if (text) void run(text, true);
    });
    if (!ok) {
      voiceModeRef.current = false;
      setVoiceMode(false);
      toast.error("Bu tarayıcı sesli girişi desteklemiyor. Chrome veya Safari kullanın.");
    }
  };

  const stopVoiceMode = () => {
    voiceModeRef.current = false;
    setVoiceMode(false);
    jarvis.voice.stopListening();
    jarvis.voice.stopSpeaking();
  };

  useEffect(() => {
    if (!voiceMode || jarvis.busy || jarvis.voice.speaking || jarvis.voice.listening) return;
    const timer = window.setTimeout(() => {
      if (!voiceModeRef.current) return;
      jarvis.voice.startListening((text) => {
        if (text) void run(text, true);
      });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [voiceMode, jarvis.busy, jarvis.voice.speaking, jarvis.voice.listening]);

  const mic = () => {
    if (voiceMode) {
      stopVoiceMode();
      return;
    }
    startVoiceMode();
  };

  const shown = jarvis.streaming || answer;

  return (
    <div className="grid grid-cols-12 gap-5">
      <div className="col-span-12 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#00F0FF]/20 bg-[#0B132B]/70 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <CircleDot className="h-3.5 w-3.5 animate-pulse text-[#00FFA3]" />
          <span className="font-mono text-[11px] tracking-widest text-[#8EA8C3]">
            SİSTEM ÇEVRİMİÇİ · {new Date().toLocaleDateString("tr-TR")}
          </span>
        </div>
        <div className="flex gap-5 font-mono text-[11px] tracking-widest text-[#8EA8C3]">
          <span data-testid="stat-open">AÇIK GÖREV: <b className="text-[#00F0FF]">{open.length}</b></span>
          <span data-testid="stat-critical">
            KRİTİK: <b className="text-[#FF3366]">{open.filter((t) => t.priority === "kritik").length}</b>
          </span>
          <span className="hidden sm:inline">İŞLEM: <b className="text-[#38BDF8]">{activity.data?.length ?? 0}</b></span>
        </div>
      </div>

      {/* Orb command */}
      <section className="q8-glass q8-bracket relative col-span-12 flex flex-col items-center overflow-hidden rounded-2xl p-6 lg:col-span-7">
        <JarvisOrb state={jarvis.orbState} size={260} onClick={mic} />

        {!voiceMode ? (
          <button
            type="button"
            onClick={startVoiceMode}
            data-testid="voice-mode-start"
            className="mt-5 flex items-center gap-3 rounded-full border border-[#00FFA3]/50 bg-[#00FFA3]/10 px-5 py-3 font-mono text-xs uppercase tracking-[0.2em] text-[#00FFA3] transition-[background-color,box-shadow] duration-200 hover:bg-[#00FFA3]/20 hover:shadow-[0_0_24px_rgba(0,255,163,0.24)]"
          >
            <Mic className="h-4 w-4" /> LEO'YU DİNLEMEYE BAŞLAT
          </button>
        ) : (
          <div className="mt-5 flex items-center gap-3">
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#00FFA3]">
              {jarvis.voice.listening ? "LEO DİNLİYOR" : jarvis.voice.speaking ? "LEO KONUŞUYOR" : "LEO HAZIRLANIYOR"}
            </span>
            <button
              type="button"
              onClick={stopVoiceMode}
              data-testid="voice-mode-stop"
              className="rounded-full border border-[#FF3366]/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[#FF8FA8]"
            >
              Durdur
            </button>
          </div>
        )}

        <div className="mt-10 w-full">
          <form
            className={voiceMode ? "hidden" : "flex gap-2"}
            onSubmit={(e) => {
              e.preventDefault();
              void run(input, false);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Yazılı yedek komut: “Bugün ne yapmam gerekiyor?”"
              data-testid="command-input"
              className="h-12 flex-1 rounded-xl border border-[#00F0FF]/20 bg-[#050811]/70 px-4 text-sm text-[#E2F1FF] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[#4b6782] focus:border-[#00F0FF]/60 focus:shadow-[0_0_20px_rgba(0,240,255,0.18)]"
            />
            <button
              type="submit"
              disabled={jarvis.busy}
              data-testid="command-send"
              className="grid h-12 w-12 place-items-center rounded-xl border border-[#00F0FF]/50 bg-[#00F0FF]/12 text-[#00F0FF] transition-[background-color,box-shadow] duration-200 hover:bg-[#00F0FF]/25 disabled:opacity-40"
              aria-label="Gönder"
            >
              <Send className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={mic}
              data-testid="voice-toggle"
              className="grid h-12 w-12 place-items-center rounded-xl border border-[#00FFA3]/40 bg-[#00FFA3]/10 text-[#00FFA3] transition-[background-color,box-shadow] duration-200 hover:bg-[#00FFA3]/20"
              aria-label="Sesli komut"
            >
              {jarvis.voice.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            {jarvis.voice.speaking ? (
              <button
                type="button"
                onClick={jarvis.voice.stopSpeaking}
                data-testid="voice-stop"
                className="grid h-12 w-12 place-items-center rounded-xl border border-[#FF3366]/40 text-[#FF3366]"
                aria-label="Sesi durdur"
              >
                <Square className="h-4 w-4" />
              </button>
            ) : null}
          </form>

          {jarvis.voice.transcript ? (
            <p className="mt-3 font-mono text-xs tracking-wide text-[#00FFA3]" data-testid="voice-transcript">
              ▸ {jarvis.voice.transcript}
            </p>
          ) : null}

          <div
            className="mt-4 min-h-[96px] rounded-xl border border-[#00F0FF]/12 bg-[#050811]/60 p-4 text-sm leading-relaxed text-[#C7E4FF]"
            data-testid="command-answer"
            aria-live="polite"
          >
            {jarvis.error ? (
              <span className="text-[#FF3366]">{jarvis.error}</span>
            ) : shown ? (
              <span className="whitespace-pre-wrap">{shown}</span>
            ) : (
              <span className="text-[#4b6782]">
                LEO hazır. Sesli modu başlatıp doğrudan konuşun. Tüm yanıtlar gerçek görev,
                proje ve hafıza verinize dayanır.
              </span>
            )}
          </div>
          {!jarvis.voice.sttSupported ? (
            <p className="mt-2 flex items-center gap-2 font-mono text-[11px] text-[#FFB800]">
              <AlertTriangle className="h-3 w-3" /> Bu tarayıcıda sesli giriş desteklenmiyor (Chrome/Safari önerilir).
            </p>
          ) : null}
        </div>
      </section>

      {/* Daily brief */}
      <div className="col-span-12 flex flex-col gap-5 lg:col-span-5">
        <Panel
          title="Günlük Yönetici Özeti"
          testId="panel-brief"
          action={
            <button
              type="button"
              onClick={() => brief.mutate()}
              disabled={brief.isPending}
              data-testid="brief-generate"
              className="rounded-lg border border-[#00F0FF]/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[#00F0FF] transition-colors duration-200 hover:bg-[#00F0FF]/12 disabled:opacity-40"
            >
              {brief.isPending ? "ÜRETİLİYOR…" : "ÖZET AL"}
            </button>
          }
        >
          {brief.isError ? (
            <p className="text-sm text-[#FF3366]">Özet üretilemedi. AI servis durumunu kontrol edin.</p>
          ) : brief.data ? (
            <div data-testid="brief-content">
              <div className="mb-3 flex gap-4 font-mono text-[11px] tracking-widest text-[#8EA8C3]">
                <span>AÇIK {brief.data.open_tasks}</span>
                <span className="text-[#FF3366]">KRİTİK {brief.data.critical_tasks}</span>
                <span className="text-[#00FFA3]">BUGÜN {brief.data.completed_today}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#C7E4FF]">
                {brief.data.summary}
              </p>
            </div>
          ) : (
            <p className="text-sm text-[#5d7a97]">
              “ÖZET AL” ile bugünün durumunu gerçek verinizden çıkarın.
            </p>
          )}
        </Panel>

        <Panel
          title="Öncelikli Görev Matrisi"
          testId="panel-priority"
          action={
            <Link to="/tasks" className="font-mono text-[10px] uppercase tracking-widest text-[#7B96B2] hover:text-[#00F0FF]">
              tümü →
            </Link>
          }
        >
          {priority.length === 0 ? (
            <p className="text-sm text-[#5d7a97]">Açık görev yok. Görevler sekmesinden ekleyebilirsiniz.</p>
          ) : (
            <ul className="space-y-2" data-testid="priority-list">
              {priority.slice(0, 5).map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 rounded-lg border border-white/5 bg-[#050811]/50 px-3 py-2.5"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: PRIORITY_COLOR[t.priority] }}
                  />
                  <span className="flex-1 truncate text-sm text-[#D6E9FF]">{t.title}</span>
                  <button
                    type="button"
                    onClick={() => complete.mutate(t.id)}
                    data-testid={`quick-complete-${t.id}`}
                    className="rounded-md border border-[#00FFA3]/30 px-2 py-1 font-mono text-[10px] tracking-widest text-[#00FFA3] transition-colors duration-200 hover:bg-[#00FFA3]/12"
                  >
                    BİTİR
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

          <Panel title="LEO İşlem Günlüğü" testId="panel-activity" className="col-span-12">
        {(activity.data ?? []).length === 0 ? (
          <p className="text-sm text-[#5d7a97]">Henüz kayıtlı işlem yok.</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2" data-testid="activity-list">
            {(activity.data ?? []).map((a) => (
              <li key={a.id} className="flex items-start gap-3 rounded-lg bg-[#050811]/50 px-3 py-2">
                <span className="mt-0.5 font-mono text-[11px] text-[#00F0FF]">{timeOf(a.created_at)}</span>
                <span className="flex-1 text-sm text-[#A9C6E3]">{a.message}</span>
                <span
                  className="font-mono text-[10px] uppercase tracking-widest"
                  style={{ color: a.status === "error" ? "#FF3366" : "#00FFA3" }}
                >
                  {a.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="col-span-12 flex items-center gap-2 pb-2 font-mono text-[11px] tracking-widest text-[#42607d]">
        <Sparkles className="h-3 w-3" /> Q8KA BY LEOHOCA · JARVIS PERSONAL AI OS
      </div>
    </div>
  );
}
