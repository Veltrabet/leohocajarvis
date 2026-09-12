import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mic, MicOff, Send, Trash2, Volume2, VolumeX } from "lucide-react";
import { apiDelete, apiGet } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";
import { useJarvis } from "@/hooks/useJarvis";
import JarvisOrb from "@/components/jarvis/JarvisOrb";
import { toast } from "sonner";

const PRESETS = [
  "Bugün ne yapmam gerekiyor?",
  "Açık görevlerimi önceliklendir.",
  "Projelerimin durumu ne?",
  "Bu hafta için bir çalışma planı çıkar.",
];

export default function Chat() {
  const qc = useQueryClient();
  const jarvis = useJarvis();
  const [input, setInput] = useState("");
  const [autoSpeak, setAutoSpeak] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const messages = useQuery({
    queryKey: ["chat"],
    queryFn: () => apiGet<ChatMessage[]>("/chat/messages"),
    retry: false,
  });

  const clear = useMutation({
    mutationFn: () => apiDelete<{ cleared: boolean }>("/chat/messages"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat"] });
      toast.success("Sohbet geçmişi temizlendi.");
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data, jarvis.streaming]);

  const submit = (text: string) => {
    if (!text.trim()) return;
    setInput("");
    void jarvis.send(text, autoSpeak);
  };

  const mic = () => {
    if (jarvis.voice.listening) {
      jarvis.voice.stopListening();
      return;
    }
    const ok = jarvis.voice.startListening((text) => text && submit(text));
    if (!ok) toast.error("Bu tarayıcı sesli girişi desteklemiyor.");
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <section className="q8-glass q8-bracket relative flex min-h-[70vh] flex-col rounded-2xl p-4 md:p-6">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="q8-overline">Neural Sohbet Konsolu</h1>
          <button
            type="button"
            onClick={() => clear.mutate()}
            data-testid="chat-clear"
            className="flex items-center gap-2 rounded-lg border border-[#FF3366]/25 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[#FF3366] transition-colors duration-200 hover:bg-[#FF3366]/10"
          >
            <Trash2 className="h-3 w-3" /> Temizle
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto pr-1" data-testid="chat-messages">
          {(messages.data ?? []).length === 0 && !jarvis.streaming ? (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <JarvisOrb state={jarvis.orbState} size={150} />
              <p className="max-w-sm text-sm text-[#5d7a97]">
                JARVIS, görevleriniz, projeleriniz ve kalıcı hafızanız üzerinden konuşur. Bir komut yazın.
              </p>
            </div>
          ) : null}

          {(messages.data ?? []).map((m) => (
            <div
              key={m.id}
              data-testid={`chat-message-${m.role}`}
              className={
                m.role === "user"
                  ? "ml-auto max-w-[85%] rounded-2xl rounded-br-sm border border-[#00F0FF]/30 bg-[#00F0FF]/10 px-4 py-3 text-sm text-[#E2F1FF]"
                  : "mr-auto max-w-[90%] rounded-2xl rounded-bl-sm border border-white/8 bg-[#0B132B]/80 px-4 py-3 text-sm leading-relaxed text-[#C7E4FF]"
              }
            >
              {m.role === "assistant" ? (
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="q8-overline">JARVIS</span>
                  <button
                    type="button"
                    onClick={() => jarvis.voice.speak(m.content)}
                    data-testid="speak-message"
                    className="text-[#7B96B2] transition-colors duration-200 hover:text-[#00F0FF]"
                    aria-label="Sesli oku"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          ))}

          {jarvis.streaming ? (
            <div
              className="mr-auto max-w-[90%] rounded-2xl rounded-bl-sm border border-[#BD00FF]/30 bg-[#0B132B]/80 px-4 py-3 text-sm leading-relaxed text-[#C7E4FF]"
              data-testid="chat-streaming"
            >
              <span className="q8-overline">JARVIS YANITLIYOR</span>
              <p className="mt-1 whitespace-pre-wrap">{jarvis.streaming}</p>
            </div>
          ) : null}

          {jarvis.error ? (
            <p className="rounded-xl border border-[#FF3366]/30 bg-[#FF3366]/10 px-4 py-3 text-sm text-[#FF8FA8]" data-testid="chat-error">
              {jarvis.error}
            </p>
          ) : null}
          <div ref={endRef} />
        </div>

        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="JARVIS'e yazın…"
            data-testid="chat-input"
            className="h-12 flex-1 rounded-xl border border-[#00F0FF]/20 bg-[#050811]/70 px-4 text-sm text-[#E2F1FF] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[#4b6782] focus:border-[#00F0FF]/60 focus:shadow-[0_0_20px_rgba(0,240,255,0.18)]"
          />
          <button
            type="button"
            onClick={mic}
            data-testid="chat-mic"
            className="grid h-12 w-12 place-items-center rounded-xl border border-[#00FFA3]/40 text-[#00FFA3] transition-colors duration-200 hover:bg-[#00FFA3]/12"
            aria-label="Sesli giriş"
          >
            {jarvis.voice.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <button
            type="submit"
            disabled={jarvis.busy}
            data-testid="chat-send"
            className="grid h-12 w-12 place-items-center rounded-xl border border-[#00F0FF]/50 bg-[#00F0FF]/12 text-[#00F0FF] transition-[background-color,box-shadow] duration-200 hover:bg-[#00F0FF]/25 disabled:opacity-40"
            aria-label="Gönder"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </section>

      <aside className="space-y-4">
        <div className="q8-glass rounded-2xl p-5">
          <h2 className="q8-overline mb-3">Durum</h2>
          <div className="flex justify-center">
            <JarvisOrb state={jarvis.orbState} size={150} />
          </div>
          <button
            type="button"
            onClick={() => {
              setAutoSpeak((v) => !v);
              if (autoSpeak) jarvis.voice.stopSpeaking();
            }}
            data-testid="autospeak-toggle"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-[#38BDF8]/35 px-3 py-2.5 font-mono text-[10px] uppercase tracking-widest text-[#38BDF8] transition-colors duration-200 hover:bg-[#38BDF8]/12"
          >
            {autoSpeak ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            Sesli yanıt {autoSpeak ? "açık" : "kapalı"}
          </button>
        </div>

        <div className="q8-glass rounded-2xl p-5">
          <h2 className="q8-overline mb-3">Hızlı Komutlar</h2>
          <div className="space-y-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => submit(p)}
                data-testid="preset-command"
                className="w-full rounded-lg border border-white/6 bg-[#050811]/60 px-3 py-2.5 text-left text-xs text-[#A9C6E3] transition-[border-color,color] duration-200 hover:border-[#00F0FF]/40 hover:text-[#00F0FF]"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
