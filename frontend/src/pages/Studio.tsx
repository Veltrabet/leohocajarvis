import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ImagePlus, Trash2, Wand2, X } from "lucide-react";
import { apiDelete, apiGet, apiPost, ApiError } from "@/lib/api";
import type { StudioItem } from "@/lib/types";
import Panel from "@/components/layout/Panel";
import { toast } from "sonner";

const QUICK = [
  "Bu görselin arka planını kaldır, şeffaf yap.",
  "Bu fotoğrafı profesyonel reklam görseline dönüştür.",
  "Bunu Instagram post formatına (1:1) hazırla.",
  "Görseli iyileştir: kontrast, netlik ve renk dengesini profesyonelleştir.",
];

export default function Studio() {
  const qc = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [source, setSource] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const items = useQuery({
    queryKey: ["studio"],
    queryFn: () => apiGet<StudioItem[]>("/studio/items"),
    retry: false,
  });

  const generate = useMutation({
    mutationFn: () =>
      apiPost<StudioItem>("/studio/image", {
        prompt,
        source_image_base64: source,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["studio"] });
      qc.invalidateQueries({ queryKey: ["activity"] });
      toast.success(source ? "Görsel düzenlendi." : "Görsel üretildi.");
    },
    onError: (e: unknown) => {
      const detail =
        e instanceof ApiError && e.body && typeof e.body === "object" && "detail" in e.body
          ? String((e.body as { detail: unknown }).detail)
          : "Görsel servisi şu anda kullanılamıyor.";
      toast.error(detail);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete<{ deleted: boolean }>(`/studio/items/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio"] }),
  });

  const pick = (file: File) => {
    if (file.size > 6 * 1024 * 1024) {
      toast.error("Dosya 6 MB'tan küçük olmalı.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setSource(String(reader.result));
    reader.readAsDataURL(file);
  };

  const status = generate.isPending
    ? "PROCESSING"
    : generate.isError
      ? "FAILED"
      : generate.isSuccess
        ? "COMPLETED"
        : "QUEUED";

  return (
    <div className="grid gap-5 lg:grid-cols-[400px_1fr]">
      <Panel title="Creative Workspace · Görsel" testId="panel-studio-form">
        <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest">
          <span className="text-[#7B96B2]">DURUM</span>
          <span
            data-testid="studio-status"
            style={{
              color:
                status === "FAILED" ? "#FF3366" : status === "COMPLETED" ? "#00FFA3" : "#00F0FF",
            }}
          >
            {status}
          </span>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="Ne oluşturmamı istersiniz? Örn: “Koyu lacivert arka planda cyan ışıklı futuristik web ajansı reklam görseli.”"
          data-testid="studio-prompt"
          className="w-full resize-none rounded-xl border border-[#00F0FF]/20 bg-[#050811]/70 p-3 text-sm text-[#E2F1FF] outline-none transition-colors duration-200 placeholder:text-[#4b6782] focus:border-[#00F0FF]/60"
        />

        <div className="mt-3 space-y-2">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setPrompt(q)}
              data-testid="studio-quick-prompt"
              className="w-full rounded-lg border border-white/6 bg-[#050811]/60 px-3 py-2 text-left text-xs text-[#A9C6E3] transition-[border-color,color] duration-200 hover:border-[#00F0FF]/40 hover:text-[#00F0FF]"
            >
              {q}
            </button>
          ))}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          data-testid="studio-file-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pick(f);
          }}
        />

        {source ? (
          <div className="relative mt-4">
            <img src={source} alt="Kaynak görsel" className="w-full rounded-xl border border-[#00F0FF]/25" />
            <button
              type="button"
              onClick={() => setSource(null)}
              data-testid="studio-clear-source"
              className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg border border-[#FF3366]/40 bg-[#050811]/80 text-[#FF3366]"
              aria-label="Kaynak görseli kaldır"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            data-testid="studio-upload-button"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#00F0FF]/30 px-3 py-4 font-mono text-[11px] uppercase tracking-widest text-[#7B96B2] transition-colors duration-200 hover:border-[#00F0FF]/60 hover:text-[#00F0FF]"
          >
            <ImagePlus className="h-4 w-4" /> Düzenlenecek görseli yükle
          </button>
        )}

        <button
          type="button"
          disabled={generate.isPending || !prompt.trim()}
          onClick={() => generate.mutate()}
          data-testid="studio-generate"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#00F0FF]/60 bg-[#00F0FF]/15 py-3.5 font-mono text-[11px] uppercase tracking-widest text-[#00F0FF] transition-[background-color,box-shadow] duration-200 hover:bg-[#00F0FF]/25 hover:shadow-[0_0_24px_rgba(0,240,255,0.3)] disabled:opacity-40"
        >
          <Wand2 className="h-4 w-4" />
          {generate.isPending ? "ÜRETİLİYOR…" : source ? "GÖRSELİ DÜZENLE" : "GÖRSEL ÜRET"}
        </button>

        <p className="mt-3 font-mono text-[10px] leading-relaxed tracking-wide text-[#42607d]">
          Video üretimi bu sürümde bağlı DEĞİL — bağlı olmayan bir servisi çalışıyor gibi
          göstermiyoruz. Sistem sekmesinden servis durumlarını görebilirsiniz.
        </p>
      </Panel>

      <Panel title="Üretim Geçmişi" testId="panel-studio-history">
        {(items.data ?? []).length === 0 ? (
          <p className="text-sm text-[#5d7a97]" data-testid="studio-empty">
            Henüz üretilmiş görsel yok.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="studio-gallery">
            {(items.data ?? []).map((it) => (
              <figure
                key={it.id}
                className="overflow-hidden rounded-xl border border-[#00F0FF]/18 bg-[#050811]/60"
                data-testid={`studio-item-${it.id}`}
              >
                <img src={it.data_url} alt={it.prompt} className="aspect-square w-full object-cover" />
                <figcaption className="space-y-2 p-3">
                  <p className="line-clamp-2 text-xs text-[#A9C6E3]">{it.prompt}</p>
                  <div className="flex items-center gap-2">
                    <a
                      href={it.data_url}
                      download={`jarvis-${it.id}.png`}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#00F0FF]/30 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[#00F0FF] transition-colors duration-200 hover:bg-[#00F0FF]/10"
                    >
                      <Download className="h-3 w-3" /> İndir
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setPrompt(it.prompt);
                        setSource(it.data_url);
                      }}
                      className="rounded-lg border border-[#38BDF8]/30 px-2 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[#38BDF8] transition-colors duration-200 hover:bg-[#38BDF8]/10"
                    >
                      Yeni sürüm
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
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
