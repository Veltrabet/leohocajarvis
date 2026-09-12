import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, MessageSquarePlus, Plus, Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "@/lib/api";
import type { GeneratedText, Lead, LeadStage } from "@/lib/types";
import Panel from "@/components/layout/Panel";
import { useLang } from "@/lib/lang";
import { toast } from "sonner";

const STAGES: { value: LeadStage; label: string; color: string }[] = [
  { value: "yeni", label: "Yeni", color: "#38BDF8" },
  { value: "iletisimde", label: "İletişimde", color: "#00F0FF" },
  { value: "teklif", label: "Teklif", color: "#FFB800" },
  { value: "kazanildi", label: "Kazanıldı", color: "#00FFA3" },
  { value: "kaybedildi", label: "Kaybedildi", color: "#FF3366" },
];

const CHANNELS = [
  { value: "instagram_dm", label: "Instagram DM" },
  { value: "eposta", label: "E-posta" },
  { value: "whatsapp", label: "WhatsApp" },
];

const TONES = ["profesyonel", "samimi", "kisa", "ikna edici"];

export default function Crm() {
  const qc = useQueryClient();
  const [lang] = useLang();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [handle, setHandle] = useState("");
  const [need, setNeed] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [channel, setChannel] = useState("instagram_dm");
  const [tone, setTone] = useState("profesyonel");
  const [goal, setGoal] = useState("ilk temas");
  const [draft, setDraft] = useState<GeneratedText | null>(null);

  const leads = useQuery({
    queryKey: ["leads"],
    queryFn: () => apiGet<Lead[]>("/crm/leads"),
    retry: false,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["leads"] });
    qc.invalidateQueries({ queryKey: ["activity"] });
  };

  const add = useMutation({
    mutationFn: () => apiPost<Lead>("/crm/leads", { name, company, handle, need }),
    onSuccess: () => {
      setName("");
      setCompany("");
      setHandle("");
      setNeed("");
      refresh();
      toast.success("Müşteri kaydı eklendi.");
    },
    onError: () => toast.error("Kayıt eklenemedi."),
  });

  const setStage = useMutation({
    mutationFn: (v: { id: string; stage: LeadStage }) =>
      apiPatch<Lead>(`/crm/leads/${v.id}`, { stage: v.stage }),
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete<{ deleted: boolean }>(`/crm/leads/${id}`),
    onSuccess: refresh,
  });

  const outreach = useMutation({
    mutationFn: (id: string) =>
      apiPost<GeneratedText>(`/crm/leads/${id}/outreach`, { goal, tone, channel, lang }),
    onSuccess: (data) => {
      setDraft(data);
      refresh();
      toast.success("Mesaj taslağı hazır (gönderilmedi).");
    },
    onError: (e: unknown) => {
      const detail =
        e instanceof ApiError && e.body && typeof e.body === "object" && "detail" in e.body
          ? String((e.body as { detail: unknown }).detail)
          : "Taslak üretilemedi.";
      toast.error(detail);
    },
  });

  const list = leads.data ?? [];
  const active = list.find((l) => l.id === selected) ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
      <Panel title="Potansiyel Müşteriler (CRM)" testId="panel-crm">
        <form
          className="mb-5 grid gap-2 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) add.mutate();
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="İsim / yetkili"
            data-testid="lead-name-input"
            className="h-11 rounded-xl border border-[#00F0FF]/20 bg-[#050811]/70 px-3 text-sm text-[#E2F1FF] outline-none placeholder:text-[#4b6782] focus:border-[#00F0FF]/60"
          />
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Firma"
            data-testid="lead-company-input"
            className="h-11 rounded-xl border border-[#00F0FF]/20 bg-[#050811]/70 px-3 text-sm text-[#E2F1FF] outline-none placeholder:text-[#4b6782] focus:border-[#00F0FF]/60"
          />
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@instagram"
            data-testid="lead-handle-input"
            className="h-11 rounded-xl border border-[#00F0FF]/20 bg-[#050811]/70 px-3 text-sm text-[#E2F1FF] outline-none placeholder:text-[#4b6782] focus:border-[#00F0FF]/60"
          />
          <input
            value={need}
            onChange={(e) => setNeed(e.target.value)}
            placeholder="İhtiyaç (örn: web sitesi + rezervasyon sistemi)"
            data-testid="lead-need-input"
            className="h-11 rounded-xl border border-[#00F0FF]/20 bg-[#050811]/70 px-3 text-sm text-[#E2F1FF] outline-none placeholder:text-[#4b6782] focus:border-[#00F0FF]/60"
          />
          <button
            type="submit"
            data-testid="lead-add-button"
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#00F0FF]/50 bg-[#00F0FF]/12 px-4 font-mono text-[11px] uppercase tracking-widest text-[#00F0FF] transition-colors duration-200 hover:bg-[#00F0FF]/25 md:col-span-2"
          >
            <Plus className="h-4 w-4" /> Müşteri Ekle
          </button>
        </form>

        {list.length === 0 ? (
          <p className="text-sm text-[#5d7a97]" data-testid="crm-empty">
            Kayıtlı müşteri yok. Yukarıdan ekleyin; JARVIS bu kayıtları sohbette de bilir.
          </p>
        ) : (
          <ul className="space-y-2" data-testid="lead-list">
            {list.map((l) => {
              const stage = STAGES.find((s) => s.value === l.stage);
              return (
                <li
                  key={l.id}
                  data-testid={`lead-row-${l.id}`}
                  className={
                    selected === l.id
                      ? "rounded-xl border border-[#00F0FF]/50 bg-[#00F0FF]/8 p-3"
                      : "rounded-xl border border-white/6 bg-[#050811]/55 p-3"
                  }
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(l.id);
                        setDraft(null);
                      }}
                      data-testid={`lead-select-${l.id}`}
                      className="min-w-[140px] flex-1 text-left"
                    >
                      <p className="text-sm font-semibold text-[#E2F1FF]">{l.name}</p>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-[#5d7a97]">
                        {l.company || "—"} {l.handle ? `· ${l.handle}` : ""}
                      </p>
                    </button>
                    <span
                      className="rounded-md px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest"
                      style={{ color: stage?.color, border: `1px solid ${stage?.color}55` }}
                    >
                      {stage?.label}
                    </span>
                    <select
                      value={l.stage}
                      onChange={(e) => setStage.mutate({ id: l.id, stage: e.target.value as LeadStage })}
                      data-testid={`lead-stage-${l.id}`}
                      className="h-9 rounded-lg border border-[#00F0FF]/20 bg-[#0B132B] px-2 font-mono text-[11px] text-[#C7E4FF] outline-none"
                    >
                      {STAGES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => remove.mutate(l.id)}
                      data-testid={`lead-delete-${l.id}`}
                      className="text-[#5d7a97] transition-colors duration-200 hover:text-[#FF3366]"
                      aria-label="Kaydı sil"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {l.need ? <p className="mt-2 text-xs text-[#A9C6E3]">İhtiyaç: {l.need}</p> : null}
                  {l.notes.length ? (
                    <p className="mt-1 font-mono text-[10px] text-[#4b6782]">
                      {l.notes.length} not · son: {l.notes[l.notes.length - 1].slice(0, 70)}…
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="AI İletişim Taslağı" testId="panel-outreach">
        {!active ? (
          <p className="text-sm text-[#5d7a97]">
            Soldan bir müşteri seçin. JARVIS onun bağlamına ve sizin tarzınıza göre mesaj taslağı
            yazar — gönderme işlemi yapmaz, onay sizde kalır.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[#E2F1FF]">
              Seçili: <b>{active.name}</b>
            </p>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              data-testid="outreach-channel"
              className="h-11 w-full rounded-xl border border-[#00F0FF]/20 bg-[#050811]/70 px-3 text-sm text-[#C7E4FF] outline-none"
            >
              {CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              data-testid="outreach-tone"
              className="h-11 w-full rounded-xl border border-[#00F0FF]/20 bg-[#050811]/70 px-3 text-sm text-[#C7E4FF] outline-none"
            >
              {TONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Amaç (örn: teklif sunumu için görüşme ayarla)"
              data-testid="outreach-goal"
              className="h-11 w-full rounded-xl border border-[#00F0FF]/20 bg-[#050811]/70 px-3 text-sm text-[#E2F1FF] outline-none placeholder:text-[#4b6782] focus:border-[#00F0FF]/60"
            />
            <button
              type="button"
              disabled={outreach.isPending}
              onClick={() => outreach.mutate(active.id)}
              data-testid="outreach-generate"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#00F0FF]/60 bg-[#00F0FF]/15 py-3.5 font-mono text-[11px] uppercase tracking-widest text-[#00F0FF] transition-colors duration-200 hover:bg-[#00F0FF]/25 disabled:opacity-40"
            >
              <MessageSquarePlus className="h-4 w-4" />
              {outreach.isPending ? "YAZILIYOR…" : "TASLAK OLUŞTUR"}
            </button>

            {draft ? (
              <div
                className="rounded-xl border border-[#00F0FF]/25 bg-[#050811]/70 p-3"
                data-testid="outreach-result"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="q8-overline">Taslak · gönderilmedi</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(draft.content);
                      toast.success("Kopyalandı.");
                    }}
                    className="text-[#7B96B2] transition-colors duration-200 hover:text-[#00F0FF]"
                    aria-label="Kopyala"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#D6E9FF]">
                  {draft.content}
                </p>
              </div>
            ) : null}
          </div>
        )}
      </Panel>
    </div>
  );
}
