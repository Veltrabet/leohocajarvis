import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type { Priority, Project, Task, TaskStatus } from "@/lib/types";
import Panel from "@/components/layout/Panel";
import { toast } from "sonner";

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: "kritik", label: "Kritik", color: "#FF3366" },
  { value: "yuksek", label: "Yüksek", color: "#FFB800" },
  { value: "normal", label: "Normal", color: "#38BDF8" },
  { value: "dusuk", label: "Düşük", color: "#7B96B2" },
];

const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "bekliyor", label: "Bekliyor" },
  { value: "devam", label: "Devam" },
  { value: "tamam", label: "Tamam" },
];

export default function Tasks() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("");

  const tasks = useQuery({ queryKey: ["tasks"], queryFn: () => apiGet<Task[]>("/tasks"), retry: false });
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiGet<Project[]>("/projects"),
    retry: false,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["activity"] });
  };

  const addTask = useMutation({
    mutationFn: () =>
      apiPost<Task>("/tasks", { title, priority, project_id: projectId || null }),
    onSuccess: () => {
      setTitle("");
      refresh();
      toast.success("Görev eklendi.");
    },
    onError: () => toast.error("Görev eklenemedi."),
  });

  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: TaskStatus }) =>
      apiPatch<Task>(`/tasks/${v.id}`, { status: v.status }),
    onSuccess: refresh,
  });

  const delTask = useMutation({
    mutationFn: (id: string) => apiDelete<{ deleted: boolean }>(`/tasks/${id}`),
    onSuccess: refresh,
  });

  const addProject = useMutation({
    mutationFn: () => apiPost<Project>("/projects", { name: projectName }),
    onSuccess: () => {
      setProjectName("");
      refresh();
      toast.success("Proje eklendi.");
    },
  });

  const delProject = useMutation({
    mutationFn: (id: string) => apiDelete<{ deleted: boolean }>(`/projects/${id}`),
    onSuccess: refresh,
  });

  const list = tasks.data ?? [];
  const nameOf = (id: string | null) =>
    id ? (projects.data ?? []).find((p) => p.id === id)?.name ?? "—" : "—";

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <Panel title="Görev Matrisi" testId="panel-tasks">
        <form
          className="mb-5 grid gap-2 md:grid-cols-[1fr_auto_auto_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) addTask.mutate();
          }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Yeni görev başlığı"
            data-testid="task-title-input"
            className="h-11 rounded-xl border border-[#00F0FF]/20 bg-[#050811]/70 px-4 text-sm text-[#E2F1FF] outline-none transition-colors duration-200 placeholder:text-[#4b6782] focus:border-[#00F0FF]/60"
          />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            data-testid="task-priority-select"
            className="h-11 rounded-xl border border-[#00F0FF]/20 bg-[#050811]/70 px-3 text-sm text-[#C7E4FF] outline-none"
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            data-testid="task-project-select"
            className="h-11 rounded-xl border border-[#00F0FF]/20 bg-[#050811]/70 px-3 text-sm text-[#C7E4FF] outline-none"
          >
            <option value="">Proje yok</option>
            {(projects.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            data-testid="task-add-button"
            className="flex h-11 items-center gap-2 rounded-xl border border-[#00F0FF]/50 bg-[#00F0FF]/12 px-4 font-mono text-[11px] uppercase tracking-widest text-[#00F0FF] transition-colors duration-200 hover:bg-[#00F0FF]/25"
          >
            <Plus className="h-4 w-4" /> Ekle
          </button>
        </form>

        {list.length === 0 ? (
          <p className="text-sm text-[#5d7a97]" data-testid="tasks-empty">
            Henüz görev yok. Yukarıdan ilk görevinizi ekleyin.
          </p>
        ) : (
          <ul className="space-y-2" data-testid="task-list">
            {list.map((t) => {
              const color = PRIORITIES.find((p) => p.value === t.priority)?.color ?? "#38BDF8";
              return (
                <li
                  key={t.id}
                  data-testid={`task-row-${t.id}`}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-white/6 bg-[#050811]/55 px-4 py-3"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
                  <div className="min-w-[160px] flex-1">
                    <p
                      className={
                        t.status === "tamam"
                          ? "text-sm text-[#5d7a97] line-through"
                          : "text-sm text-[#E2F1FF]"
                      }
                    >
                      {t.title}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-[#4b6782]">
                      {nameOf(t.project_id)}
                    </p>
                  </div>
                  <select
                    value={t.status}
                    onChange={(e) => setStatus.mutate({ id: t.id, status: e.target.value as TaskStatus })}
                    data-testid={`task-status-${t.id}`}
                    className="h-9 rounded-lg border border-[#00F0FF]/20 bg-[#0B132B] px-2 font-mono text-[11px] text-[#C7E4FF] outline-none"
                  >
                    {STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => delTask.mutate(t.id)}
                    data-testid={`task-delete-${t.id}`}
                    className="text-[#5d7a97] transition-colors duration-200 hover:text-[#FF3366]"
                    aria-label="Görevi sil"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Projeler" testId="panel-projects">
        <form
          className="mb-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (projectName.trim()) addProject.mutate();
          }}
        >
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Proje adı"
            data-testid="project-name-input"
            className="h-11 flex-1 rounded-xl border border-[#00F0FF]/20 bg-[#050811]/70 px-3 text-sm text-[#E2F1FF] outline-none placeholder:text-[#4b6782] focus:border-[#00F0FF]/60"
          />
          <button
            type="submit"
            data-testid="project-add-button"
            className="grid h-11 w-11 place-items-center rounded-xl border border-[#00F0FF]/50 bg-[#00F0FF]/12 text-[#00F0FF] transition-colors duration-200 hover:bg-[#00F0FF]/25"
            aria-label="Proje ekle"
          >
            <Plus className="h-4 w-4" />
          </button>
        </form>

        {(projects.data ?? []).length === 0 ? (
          <p className="text-sm text-[#5d7a97]">Kayıtlı proje yok.</p>
        ) : (
          <ul className="space-y-2" data-testid="project-list">
            {(projects.data ?? []).map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-lg border border-white/6 bg-[#050811]/55 px-3 py-2.5"
              >
                <span className="flex-1 truncate text-sm text-[#D6E9FF]">{p.name}</span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#00F0FF]">
                  {p.status}
                </span>
                <button
                  type="button"
                  onClick={() => delProject.mutate(p.id)}
                  data-testid={`project-delete-${p.id}`}
                  className="text-[#5d7a97] transition-colors duration-200 hover:text-[#FF3366]"
                  aria-label="Projeyi sil"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
