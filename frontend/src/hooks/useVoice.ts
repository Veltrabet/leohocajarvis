/* Browser-native Turkish voice I/O (Web Speech API). No server credential involved;
   if the browser has no support we say so instead of pretending. */
import { useCallback, useEffect, useRef, useState } from "react";
import { speechLocale, useLang } from "@/lib/lang";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Recognition = any;

function pickVoice(locale: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const language = locale.toLowerCase();
  return voices.find((voice) => voice.lang.toLowerCase() === language) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(language.slice(0, 2))) ??
    voices.find((voice) => voice.default);
}

function getRecognitionCtor(): any | null {
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoice() {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recRef = useRef<Recognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [lang] = useLang();
  const locale = speechLocale(lang);

  const sttSupported = typeof window !== "undefined" && getRecognitionCtor() !== null;
  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    if (!ttsSupported) return;
    const loadVoices = () => window.speechSynthesis.getVoices();
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, [ttsSupported]);

  useEffect(() => {
    return () => {
      try {
        recRef.current?.stop();
        audioRef.current?.pause();
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore teardown races */
      }
    };
  }, []);

  const startListening = useCallback(
    (onFinal: (text: string) => void) => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return false;
    if (ttsSupported) {
      // Mobile Safari/Chrome often require speechSynthesis to be touched during
      // the microphone tap before allowing speech after an async response.
      const prime = new SpeechSynthesisUtterance(" ");
      prime.volume = 0;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(prime);
      window.speechSynthesis.cancel();
    }
    const rec: Recognition = new Ctor();
    rec.lang = locale;
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      let text = "";
      for (let i = 0; i < e.results.length; i += 1) text += e.results[i][0].transcript;
      setTranscript(text);
      if (e.results[e.results.length - 1].isFinal) onFinal(text.trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setTranscript("");
      rec.start();
      setListening(true);
      return true;
    },
    [locale, ttsSupported],
  );

  const stopListening = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* already stopped */
    }
    setListening(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!text.trim()) return false;
      const clean = text.replace(/[*#`]/g, "");
      audioRef.current?.pause();
      window.speechSynthesis?.cancel();
      if (!ttsSupported) return false;

      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = locale;
      utterance.rate = 1.02;
      utterance.pitch = 0.95;
      utterance.voice = pickVoice(locale) ?? null;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => {
        setSpeaking(false);
        // Some mobile engines reject the first utterance while voices load.
        window.setTimeout(() => {
          const retry = new SpeechSynthesisUtterance(clean);
          retry.lang = locale;
          retry.voice = pickVoice(locale) ?? null;
          retry.rate = 1.02;
          retry.onstart = () => setSpeaking(true);
          retry.onend = () => setSpeaking(false);
          retry.onerror = () => setSpeaking(false);
          window.speechSynthesis.speak(retry);
        }, 180);
      };
      window.speechSynthesis.speak(utterance);
      return true;
    },
    [ttsSupported, locale],
  );

  const stopSpeaking = useCallback(() => {
    audioRef.current?.pause();
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  return {
    listening,
    speaking,
    transcript,
    sttSupported,
    ttsSupported,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}
