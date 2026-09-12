import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Instagram, Trash2, Wand2 } from "lucide-react";
import { apiDelete, apiGet, apiPost, ApiError } from "@/lib/api";
import type { GeneratedText } from "@/lib/types";
import Panel from "@/components/layout/Panel";
import { useLang } from "@/lib/lang";
import { toast } from "sonner";

type Kind = "post" | "reels" | "caption" | "hashtags" | "takvim" | "dm" | "biyografi";
type Tone = "profesyonel" | "samimi" | "enerjik" | "prestijli";

const KINDS: { value: Kind; label: string }[] = [
  { value: "post", label: "Feed Gönderisi" },
  { value: "reels", label: "Reels Senaryosu" },
  { value: "caption", label: "Açıklama (Caption)" },
  { value: "hashtags", label: "Hashtag Seti" },
  { value: "takvim", label: "7 Günlük Takvim" },
  { value: "dm", label: "DM Taslağı" },
  { value: "biyografi", label: "Profil Biyografisi" },
];

const TONES: Tone[] = ["profesyonel", "samimi", "enerjik", "prestijli"];

export default function Social() {
  const qc = useQueryClient();
  const [lang] = useLang();
  const [kind, setKind] = useState<Kind>("post");
  const [tone, setTone] = useState<Tone>("profesyonel");
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState<GeneratedText | null>(null);

  const items = useQuery({
    queryKey: ["social"],
    queryFn: () => apiGet<GeneratedText[]>("/social/items"),
    retry: false,
  });

  const generate = useMutation({
    mutationFn: () => apiPost<GeneratedText>("/social/generate", { kind, topic, tone, lang }),
    onSuccess: (data) => {
      setResult(data);
      qc.invalidateQueries({ queryKey: ["social"] });
      qc.invalidateQueries({ queryKey: ["activity"] });
      toast.success("İçerik üretildi.");
    },
    onError: (e: unknown) => {
      const detail =
        e instanceof ApiError && e.body && typeof e.body === "object" && "detail" in e.body
          ? String((e.body as { detail: unknown }).detail)
          : "İçerik üretilemedi.";
      toast.error(detail);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete<{ deleted: boolean }>(`/social/items/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social"] }),
  });

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Kopyalandı.");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <Panel title="Instagram İçerik Ajansı" testId="panel-social-form">
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#FFB800]/25 bg-[#FFB800]/6 px-3 py-2">
          <Instagram className="h-3.5 w-3.5 shrink-0 text-[#FFB800]" />
          <p className="font-mono text-[10px] leading-relaxed tracking-wide text-[#d8b25f]">
            İçerik üretir, HESABA GÖNDERMEZ. Otomatik gönderi/DM için resmi Instagram
            Graph API bağlantısı gerekir — şu an BAĞLI DEĞİL.
          </p>
        </div>

        <label className="q8-overline">İçerik Türü</label>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as Kind)}
          data-testid="social-kind"
          className="mb-3 mt-2 h-11 w-full rounded-xl border border-[#00F0FF]/20 bg-[#050811]/70 px-3 text-sm text-[#C7E4FF] outline-none"
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>

        <label className="q8-overline">Ton</label>
        <select
          value={tone}
          onChange={(e) => setTone(e.target.value as Tone)}
          data-testid="social-tone"
          className="mb-3 mt-2 h-11 w-full rounded-xl border border-[#00F0FF]/20 bg-[#050811]/70 px-3 text-sm text-[#C7E4FF] outline-none"
        >
          {TONES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <label className="q8-overline">Konu / Brief</label>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          rows={4}
          placeholder="Örn: Küçük işletmelere özel yazılım ve web sistemi hizmetimizi tanıtan gönderi"
          data-testid="social-topic"
          className="mt-2 w-full resize-none rounded-xl border border-[#00F0FF]/20 bg-[#050811]/70 p-3 text-sm text-[#E2F1FF] outline-none transition-colors duration-200 placeholder:text-[#4b6782] focus:border-[#00F0FF]/60"
        />

        <button
          type="button"
          disabled={generate.isPending || !topic.trim()}
          onClick={() => generate.mutate()}
          data-testid="social-generate"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#00F0FF]/60 bg-[#00F0FF]/15 py-3.5 font-mono text-[11px] uppercase tracking-widest text-[#00F0FF] transition-[background-color,box-shadow] duration-200 hover:bg-[#00F0FF]/25 hover:shadow-[0_0_24px_rgba(0,240,255,0.3)] disabled:opacity-40"
        >
          <Wand2 className="h-4 w-4" />
          {generate.isPending ? "ÜRETİLİYOR…" : "İÇERİK ÜRET"}
        </button>
      </Panel>

      <div className="space-y-4">
        {result ? (
          <Panel
            title={`Sonuç · ${result.kind}`}
            testId="panel-social-result"
            action={
              <button
                type="button"
                onClick={() => copy(result.content)}
                data-testid="social-copy"
                className="flex items-center gap-1.5 rounded-lg border border-[#00F0FF]/35 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[#00F0FF] transition-colors duration-200 hover:bg-[#00F0FF]/12"
              >
                <Copy className="h-3 w-3" /> Kopyala
              </button>
            }
          >
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#D6E9FF]">
              {result.content}
            </p>
          </Panel>
        ) : null}

        <Panel title="Üretim Arşivi" testId="panel-social-history">
          {(items.data ?? []).length === 0 ? (
            <p className="text-sm text-[#5d7a97]" data-testid="social-empty">
              Henüz üretilmiş içerik yok.
            </p>
          ) : (
            <ul className="space-y-2" data-testid="social-list">
              {(items.data ?? []).map((it) => (
                <li
                  key={it.id}
                  className="rounded-xl border border-white/6 bg-[#050811]/55 p-3"
                  data-testid={`social-item-${it.id}`}
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[#00F0FF]">
                      {it.kind} · {it.lang}
                    </span>
                    <span className="flex-1 truncate text-[11px] text-[#5d7a97]">{it.topic}</span>
                    <button
                      type="button"
                      onClick={() => copy(it.content)}
                      className="text-[#5d7a97] transition-colors duration-200 hover:text-[#00F0FF]"
                      aria-label="Kopyala"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove.mutate(it.id)}
                      className="text-[#5d7a97] transition-colors duration-200 hover:text-[#FF3366]"
                      aria-label="Sil"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-[#A9C6E3]">
                    {it.content}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
