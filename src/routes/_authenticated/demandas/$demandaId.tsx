import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, FolderKanban, History, ListChecks, Play, Plus, Send, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Badge, Field, FormError, LoadingBlock, Modal, useMe } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
import {
  btnGhost, demandQuery, demandStatusLabel, demandTone, fieldClass, formatDate, formatDateTime, friendlyDbError, historyLabel,
  isOverdue, membersQuery, priorityLabel, priorityTone, taskStatusLabel, taskTone, textareaClass, type DemandStatus, type TaskStatus,
} from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/demandas/$demandaId")({
  head: () => ({
    meta: [
      { title: "Detalhe da demanda — ANA" },
      { name: "description", content: "Tarefas, revisões e histórico da demanda." },
      { property: "og:title", content: "Detalhe da demanda — ANA" },
      { property: "og:description", content: "Tarefas, revisões e histórico da demanda." },
    ],
  }),
  component: () => (
    <AppShell>
      <DemandDetail />
    </AppShell>
  ),
});

type DemandFull = Tables<"demands"> & { clients: { name: string } | null; teams: { name: string } | null; responsible: { full_name: string } | null };

type Task = {
  id: string; title: string; description: string | null; status: TaskStatus; due_date: string; required: boolean;
  assignee_id: string; submission_note: string | null; review_comment: string | null; assignee: { full_name: string } | null;
};

function DemandDetail() {
  const { demandaId } = Route.useParams();
  const me = useMe();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery(demandQuery(demandaId));
  const [taskOpen, setTaskOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["demand", demandaId] });
    qc.invalidateQueries({ queryKey: ["demands", me.officeId] });
  };
  const setStatus = useMutation({
    mutationFn: async (s: DemandStatus) => {
      const { error } = await supabase.rpc("set_demand_status", { _demand_id: demandaId, _status: s });
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success("Status atualizado."); },
    onError: (e) => toast.error(friendlyDbError(e)),
  });

  if (isLoading) return <LoadingBlock />;
  if (error) return <EmptyState icon={FolderKanban} title="Erro ao carregar a demanda" description={friendlyDbError(error)} />;
  const d = data?.demand as unknown as DemandFull | null;
  if (!data || !d) return <EmptyState icon={FolderKanban} title="Demanda não encontrada" description="Ela não existe ou você não tem acesso a ela." />;

  const tasks = data.tasks as Task[];
  const finished = d.status === "concluida" || d.status === "cancelada";
  const required = tasks.filter((t) => t.required);
  const canConclude = required.every((t) => t.status === "concluida");

  return (
    <>
      <Link to="/demandas" className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Demandas</Link>

      <div className="surface-card mb-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap gap-2">
              <Badge className={demandTone[d.status]}>{demandStatusLabel[d.status]}</Badge>
              <Badge className={priorityTone[d.priority]}>Prioridade {priorityLabel[d.priority].toLowerCase()}</Badge>
            </div>
            <h1 className="text-2xl font-bold md:text-3xl">{d.title}</h1>
            {d.description && <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm text-muted-foreground">{d.description}</p>}
          </div>
          {me.isManager && !finished && (
            <div className="flex flex-wrap gap-2">
              <select aria-label="Alterar status" className={`${fieldClass} w-48`} value={d.status} disabled={setStatus.isPending} onChange={(e) => setStatus.mutate(e.target.value as DemandStatus)}>
                {(["nova", "em_andamento", "em_revisao", "concluida"] as DemandStatus[]).map((s) => (
                  <option key={s} value={s} disabled={s === "concluida" && !canConclude}>{demandStatusLabel[s]}{s === "concluida" && !canConclude ? " (tarefas pendentes)" : ""}</option>
                ))}
              </select>
              <button className={cn(btnGhost, "text-destructive")} onClick={() => setCancelOpen(true)}>Cancelar demanda</button>
            </div>
          )}
        </div>
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Cliente" value={d.clients?.name ?? "—"} />
          <Info label="Responsável" value={d.responsible?.full_name ?? "—"} />
          <Info label="Time" value={d.teams?.name ?? "—"} />
          <Info label="Prazo" value={formatDate(d.due_date)} danger={isOverdue(d.due_date) && !finished} />
        </dl>
        {d.status === "cancelada" && d.cancel_reason && <p className="mt-4 rounded-field bg-destructive/10 px-3 py-2 text-sm text-destructive">Motivo do cancelamento: {d.cancel_reason}</p>}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="tasks-h">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="tasks-h" className="flex items-center gap-2 text-lg font-semibold"><ListChecks className="h-5 w-5 text-primary" /> Tarefas <span className="text-sm font-normal text-muted-foreground">({tasks.filter((t) => t.status === "concluida").length}/{tasks.length})</span></h2>
            {me.isManager && !finished && <button className="btn-cta" onClick={() => setTaskOpen(true)}><Plus className="h-4 w-4" /> Nova tarefa</button>}
          </div>
          {!tasks.length ? (
            <EmptyState icon={ListChecks} title="Nenhuma tarefa" description={me.isManager ? "Divida a demanda em tarefas e atribua aos advogados." : "Ainda não há tarefas nesta demanda."} />
          ) : (
            <div className="space-y-3">
              {tasks.map((t) => <TaskItem key={t.id} t={t} me={me} locked={finished} onChange={refresh} />)}
            </div>
          )}
        </section>

        <section aria-labelledby="hist-h">
          <h2 id="hist-h" className="mb-3 flex items-center gap-2 text-lg font-semibold"><History className="h-5 w-5 text-primary" /> Histórico</h2>
          <ol className="surface-card space-y-4 p-5">
            {data.history.map((h) => (
              <li key={h.id} className="border-l-2 border-primary/40 pl-3">
                <p className="text-sm font-medium">{historyLabel[h.action] ?? h.action}</p>
                <HistoryDetails details={h.details} />
                <p className="text-xs text-muted-foreground">{h.profiles?.full_name ?? "Sistema"} · {formatDateTime(h.created_at)}</p>
              </li>
            ))}
            {!data.history.length && <li className="text-sm text-muted-foreground">Sem registros.</li>}
          </ol>
        </section>
      </div>

      <Modal open={taskOpen} onClose={() => setTaskOpen(false)} title="Nova tarefa">
        <TaskForm demandId={demandaId} officeId={me.officeId} onDone={() => { setTaskOpen(false); refresh(); }} />
      </Modal>
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancelar demanda">
        <CancelForm demandId={demandaId} onDone={() => { setCancelOpen(false); refresh(); }} />
      </Modal>
    </>
  );
}

function Info({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-field bg-elevated px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 font-medium", danger && "text-destructive")}>{value}</dd>
    </div>
  );
}

function HistoryDetails({ details }: { details: unknown }) {
  if (!details || typeof details !== "object") return null;
  const o = details as Record<string, unknown>;
  const text = o["comment"] ?? o["note"] ?? o["reason"] ?? o["title"] ??
    (typeof o["to"] === "string" && o["to"] in demandStatusLabel ? `${demandStatusLabel[o["from"] as DemandStatus]} → ${demandStatusLabel[o["to"] as DemandStatus]}` : null);
  return text ? <p className="text-xs text-muted-foreground">“{String(text)}”</p> : null;
}

function TaskItem({ t, me, locked, onChange }: { t: Task; me: ReturnType<typeof useMe>; locked: boolean; onChange: () => void }) {
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<"submit" | "reject" | null>(null);
  const mine = t.assignee_id === me.userId;
  const run = useMutation({
    mutationFn: async (action: "start" | "submit" | "approve" | "reject" | "delete") => {
      const res =
        action === "start" ? await supabase.rpc("start_task", { _task_id: t.id })
        : action === "submit" ? await supabase.rpc("submit_task", { _task_id: t.id, ...(note.trim() && { _note: note.trim() }) })
        : action === "approve" ? await supabase.rpc("review_task", { _task_id: t.id, _approve: true })
        : action === "reject" ? await supabase.rpc("review_task", { _task_id: t.id, _approve: false, _comment: note.trim() })
        : await supabase.from("tasks").delete().eq("id", t.id);
      if (res.error) throw res.error;
      return action;
    },
    onSuccess: (a) => {
      setMode(null); setNote(""); onChange();
      toast.success({ start: "Tarefa iniciada.", submit: "Tarefa enviada para revisão.", approve: "Tarefa aprovada.", reject: "Correção solicitada.", delete: "Tarefa removida." }[a]);
    },
    onError: (e) => toast.error(friendlyDbError(e)),
  });
  const late = isOverdue(t.due_date) && t.status !== "concluida";

  return (
    <article className="surface-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{t.title}</h3>
            <Badge className={taskTone[t.status]}>{taskStatusLabel[t.status]}</Badge>
            {!t.required && <Badge className="bg-elevated text-muted-foreground">Opcional</Badge>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t.assignee?.full_name ?? "—"}{mine && " (você)"} · <span className={cn(late && "text-destructive")}>Prazo {formatDate(t.due_date)}</span>
          </p>
          {t.description && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{t.description}</p>}
          {t.submission_note && <p className="mt-2 text-sm"><span className="text-muted-foreground">Nota de entrega:</span> {t.submission_note}</p>}
          {t.review_comment && <p className={cn("mt-2 text-sm", t.status === "correcao" && "text-destructive")}><span className="text-muted-foreground">Revisão:</span> {t.review_comment}</p>}
        </div>
        {!locked && (
          <div className="flex flex-wrap gap-2">
            {mine && (t.status === "pendente" || t.status === "correcao") && <button className={btnGhost} disabled={run.isPending} onClick={() => run.mutate("start")}><Play className="h-4 w-4" /> Iniciar</button>}
            {mine && (t.status === "em_andamento" || t.status === "correcao") && <button className={btnGhost} onClick={() => setMode("submit")}><Send className="h-4 w-4" /> Enviar p/ revisão</button>}
            {me.isManager && !mine && t.status === "em_revisao" && (
              <>
                <button className={cn(btnGhost, "text-success")} disabled={run.isPending} onClick={() => run.mutate("approve")}><CheckCircle2 className="h-4 w-4" /> Aprovar</button>
                <button className={cn(btnGhost, "text-destructive")} onClick={() => setMode("reject")}><XCircle className="h-4 w-4" /> Solicitar correção</button>
              </>
            )}
            {me.isManager && t.status !== "concluida" && <button aria-label="Excluir tarefa" className={cn(btnGhost, "px-3 text-muted-foreground hover:text-destructive")} disabled={run.isPending} onClick={() => confirm("Excluir esta tarefa?") && run.mutate("delete")}><Trash2 className="h-4 w-4" /></button>}
          </div>
        )}
      </div>
      {mode && (
        <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); if (mode === "reject" && !note.trim()) { toast.error("Informe o que precisa ser corrigido."); return; } run.mutate(mode); }}>
          <label htmlFor={`note-${t.id}`} className="text-sm font-medium">{mode === "submit" ? "Nota de entrega (opcional)" : "O que precisa ser corrigido? *"}</label>
          <textarea id={`note-${t.id}`} maxLength={2000} className={textareaClass} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <button type="submit" className="btn-cta" disabled={run.isPending}>{mode === "submit" ? "Enviar" : "Solicitar correção"}</button>
            <button type="button" className={btnGhost} onClick={() => { setMode(null); setNote(""); }}>Voltar</button>
          </div>
        </form>
      )}
    </article>
  );
}

function TaskForm({ demandId, officeId, onDone }: { demandId: string; officeId: string; onDone: () => void }) {
  const members = useQuery(membersQuery(officeId));
  const [f, setF] = useState({ title: "", assignee_id: "", due_date: "", required: true, description: "" });
  const [err, setErr] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: async () => {
      // office_id is overwritten by the database from the demand.
      const { error } = await supabase.from("tasks").insert({
        demand_id: demandId, office_id: officeId, title: f.title.trim(), assignee_id: f.assignee_id, due_date: f.due_date,
        required: f.required, description: f.description.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Tarefa criada."); onDone(); },
    onError: (e) => setErr(friendlyDbError(e)),
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!f.title.trim()) return setErr("Informe o título da tarefa.");
    if (!f.assignee_id) return setErr("Selecione o responsável pela tarefa.");
    if (!f.due_date) return setErr("Informe o prazo da tarefa.");
    m.mutate();
  }
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Título *" htmlFor="t-title"><input id="t-title" maxLength={200} className={fieldClass} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Responsável *" htmlFor="t-assignee">
          <select id="t-assignee" className={fieldClass} value={f.assignee_id} onChange={(e) => setF({ ...f, assignee_id: e.target.value })}>
            <option value="">Selecione…</option>
            {members.data?.filter((x) => x.active).map((x) => <option key={x.user_id} value={x.user_id}>{x.profiles?.full_name}</option>)}
          </select>
        </Field>
        <Field label="Prazo *" htmlFor="t-due"><input id="t-due" type="date" className={fieldClass} value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></Field>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-primary" checked={f.required} onChange={(e) => setF({ ...f, required: e.target.checked })} />
        Obrigatória para concluir a demanda
      </label>
      <Field label="Descrição" htmlFor="t-desc"><textarea id="t-desc" maxLength={4000} className={textareaClass} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <FormError message={err} />
      <button type="submit" className="btn-cta w-full" disabled={m.isPending}>{m.isPending ? "Criando…" : "Criar tarefa"}</button>
    </form>
  );
}

function CancelForm({ demandId, onDone }: { demandId: string; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("cancel_demand", { _demand_id: demandId, _reason: reason.trim() });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Demanda cancelada."); onDone(); },
    onError: (e) => setErr(friendlyDbError(e)),
  });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!reason.trim()) return setErr("Informe o motivo do cancelamento."); m.mutate(); }}>
      <p className="text-sm text-muted-foreground">Esta ação é definitiva: a demanda não poderá mais ser alterada.</p>
      <Field label="Motivo *" htmlFor="cancel-reason"><textarea id="cancel-reason" maxLength={1000} className={textareaClass} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      <FormError message={err} />
      <button type="submit" className="btn-cta w-full" disabled={m.isPending}>{m.isPending ? "Cancelando…" : "Confirmar cancelamento"}</button>
    </form>
  );
}
