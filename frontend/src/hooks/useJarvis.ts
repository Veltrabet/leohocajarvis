import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiStream, ApiError } from "@/lib/api";
import type { OrbState } from "@/components/jarvis/JarvisOrb";
import { useVoice } from "@/hooks/useVoice";
import { useLang } from "@/lib/lang";

/** Shared JARVIS conversation engine: streaming answer + orb state + Turkish voice. */
export function useJarvis(options?: { autoSpeak?: boolean }) {
  const qc = useQueryClient();
  const voice = useVoice();
  const [lang] = useLang();
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const shouldSpeak = useRef(false);

  const send = useCallback(
    async (text: string, speakAnswer = false): Promise<string> => {
      if (!text.trim() || busy) return "";
      shouldSpeak.current = speakAnswer || Boolean(options?.autoSpeak);
      setBusy(true);
      setError("");
      setStreaming("");
      let acc = "";
      try {
        await apiStream("/chat/stream", { message: text, lang }, (delta) => {
          acc += delta;
          setStreaming(acc);
        });
        if (shouldSpeak.current && acc.trim()) voice.speak(acc);
      } catch (e: unknown) {
        const detail =
          e instanceof ApiError && e.body && typeof e.body === "object" && "detail" in e.body
            ? String((e.body as { detail: unknown }).detail)
            : "JARVIS yanıt veremedi. Bağlantı veya AI servisi kullanılamıyor.";
        setError(detail);
        acc = "";
      } finally {
        setBusy(false);
        setStreaming("");
        await qc.invalidateQueries({ queryKey: ["chat"] });
        await qc.invalidateQueries({ queryKey: ["activity"] });
        await qc.invalidateQueries({ queryKey: ["memory"] });
      }
      return acc;
    },
    [busy, lang, options?.autoSpeak, qc, voice],
  );

  const orbState: OrbState = voice.listening
    ? "LISTENING"
    : busy
      ? "THINKING"
      : voice.speaking
        ? "SPEAKING"
        : "IDLE";

  return { send, streaming, busy, error, setError, orbState, voice };
}
