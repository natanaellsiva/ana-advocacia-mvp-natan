import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { CalendarDays, Columns3, FolderKanban, List, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell, EmptyState, PageHeader } from "@/components/app-shell";
import { Badge, Field, FormError, LoadingBlock, Modal, useMe } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  clientsQuery, demandStatuses, demandStatusLabel, demandTone, demandsQuery, fieldClass, formatDate, friendlyDbError,
  isOverdue, membersQuery, priorityLabel, priorityTone, teamsQuery, textareaClass, type DemandStatus, type Priority,
} from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/demandas/")({
  head: () => ({
    meta: [
      { title: "Demandas — ANA" },
      { name: "description", content: "Gestão de demandas jurídicas do escritório." },
      { property: "og:title", content: "Demandas — ANA" },
      { property: "og:description", content: "Gestão de demandas jurídicas do escritório." },
    ],
  }),
  component: () => (
    <AppShell>
      <DemandsPage />
    </AppShell>
  ),
});

type DemandRow = {
  id: string; title: string; status: DemandStatus; priority: Priority; due_date: string | null;
  clients: { name: string } | null; responsible: { full_name: string } | null; tasks: { id: string; status: string }[];
};

function DemandsPage() {
  const me = useMe();
  const [view, setView] = useState<"list" | "kanban">("kanban");
  const [status, setStatus] = useState<DemandStatus | "">("");
  const [open, setOpen] = useState(false);
  const { data, isLoading, error } = useQuery(demandsQuery(me.officeId));
  const rows = ((data ?? []) as DemandRow[]).filter((d) => !status || d.status === status);

  return (
    <>
      <PageHeader
        title="Demandas"
        description={me.isManager ? "Acompanhe demandas, tarefas e revisões do escritório." : "Demandas em que você é responsável ou tem tarefas."}
        action={me.isManager && <button className="btn-cta" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nova demanda</button>}
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Modo de visualização" className="flex rounded-full border p-1">
          {([["kanban", Columns3, "Quadro"], ["list", List, "Lista"]] as const).map(([v, Icon, label]) => (
            <button key={v} aria-pressed={view === v} onClick={() => setView(v)} className={cn("inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm", view === v ? "bg-accent text-primary" : "text-muted-foreground hover:text-foreground")}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
        {view === "list" && (
          <select aria-label="Filtrar por status" className={`${fieldClass} w-48`} value={status} onChange={(e) => setStatus(e.target.value as DemandStatus | "")}>
            <option value="">Todos os status</option>
            {demandStatuses.map((s) => <option key={s} value={s}>{demandStatusLabel[s]}</option>)}
          </select>
        )}
      </div>

      {isLoading ? <LoadingBlock /> : error ? (
        <EmptyState icon={FolderKanban} title="Erro ao carregar demandas" description={friendlyDbError(error)} />
      ) : !data?.length ? (
        <EmptyState icon={FolderKanban} title="Nenhuma demanda ainda" description={me.isManager ? "Crie a primeira demanda vinculada a um cliente." : "Quando você for designado a uma demanda, ela aparecerá aqui."} />
      ) : view === "kanban" ? (
        <div className="grid gap-4 overflow-x-auto pb-2 md:grid-cols-[repeat(5,minmax(220px,1fr))]">
          {demandStatuses.map((s) => {
            const col = (data as DemandRow[]).filter((d) => d.status === s);
            return (
              <div key={s} className="min-w-0 rounded-card bg-deepest/60 p-3">
                <div className="mb-3 flex items-center justify-between px-1">
                  <Badge className={demandTone[s]}>{demandStatusLabel[s]}</Badge>
                  <span className="text-xs text-muted-foreground">{col.length}</span>
                </div>
                <div className="space-y-3">
                  {col.map((d) => <DemandCard key={d.id} d={d} />)}
                  {!col.length && <p className="px-1 py-4 text-center text-xs text-muted-foreground">Vazio</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="surface-card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>{["Demanda", "Cliente", "Responsável", "Prioridade", "Status", "Prazo", "Tarefas"].map((h) => <th key={h} className="px-5 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="border-b last:border-0 hover:bg-elevated/50">
                  <td className="px-5 py-3 font-medium"><Link to="/demandas/$demandaId" params={{ demandaId: d.id }} className="hover:text-primary">{d.title}</Link></td>
                  <td className="px-5 py-3 text-muted-foreground">{d.clients?.name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{d.responsible?.full_name ?? "—"}</td>
                  <td className="px-5 py-3"><Badge className={priorityTone[d.priority]}>{priorityLabel[d.priority]}</Badge></td>
                  <td className="px-5 py-3"><Badge className={demandTone[d.status]}>{demandStatusLabel[d.status]}</Badge></td>
                  <td className={cn("px-5 py-3", isOverdue(d.due_date) && !["concluida", "cancelada"].includes(d.status) ? "text-destructive" : "text-muted-foreground")}>{formatDate(d.due_date)}</td>
                  <td className="px-5 py-3 text-muted-foreground">{d.tasks.filter((t) => t.status === "concluida").length}/{d.tasks.length}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">Nenhuma demanda com este status.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nova demanda">
        <DemandForm officeId={me.officeId} userId={me.userId} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function DemandCard({ d }: { d: DemandRow }) {
  const done = d.tasks.filter((t) => t.status === "concluida").length;
  const late = isOverdue(d.due_date) && !["concluida", "cancelada"].includes(d.status);
  return (
    <Link to="/demandas/$demandaId" params={{ demandaId: d.id }} className="block rounded-field border bg-card p-4 transition-colors hover:border-primary/50">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-medium">{d.title}</p>
        <Badge className={priorityTone[d.priority]}>{priorityLabel[d.priority]}</Badge>
      </div>
      <p className="truncate text-xs text-muted-foreground">{d.clients?.name}</p>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span className={cn("inline-flex items-center gap-1", late && "text-destructive")}><CalendarDays className="h-3.5 w-3.5" />{formatDate(d.due_date)}</span>
        <span>{done}/{d.tasks.length} tarefas</span>
      </div>
    </Link>
  );
}

function DemandForm({ officeId, userId, onDone }: { officeId: string; userId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const clients = useQuery(clientsQuery(officeId));
  const members = useQuery(membersQuery(officeId));
  const teams = useQuery(teamsQuery(officeId));
  const [f, setF] = useState({ title: "", client_id: "", priority: "media" as Priority, responsible_id: "", team_id: "", due_date: "", description: "" });
  const [err, setErr] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: async () => {
      // ID is generated here and the row is NOT read back in the same request:
      // the SELECT policy (can_view_demand) can't see a row inserted in the same
      // statement, so `.select()` after insert fails RLS even for admins.
      const id = crypto.randomUUID();
      const { error } = await supabase.from("demands").insert({
        id, office_id: officeId, created_by: userId, title: f.title.trim(), client_id: f.client_id, priority: f.priority,
        responsible_id: f.responsible_id || null, team_id: f.team_id || null, due_date: f.due_date || null, description: f.description.trim() || null,
      });
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["demands", officeId] });
      toast.success("Demanda criada.");
      onDone();
      navigate({ to: "/demandas/$demandaId", params: { demandaId: id } });
    },
    onError: (e) => setErr(friendlyDbError(e)),
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!f.title.trim()) return setErr("Informe o título da demanda.");
    if (!f.client_id) return setErr("Selecione o cliente.");
    m.mutate();
  }
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Título *" htmlFor="d-title"><input id="d-title" maxLength={200} className={fieldClass} value={f.title} onChange={set("title")} /></Field>
      <Field label="Cliente *" htmlFor="d-client" hint={clients.data && !clients.data.length ? "Cadastre um cliente antes de criar demandas." : undefined}>
        <select id="d-client" className={fieldClass} value={f.client_id} onChange={set("client_id")}>
          <option value="">Selecione…</option>
          {clients.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prioridade" htmlFor="d-priority">
          <select id="d-priority" className={fieldClass} value={f.priority} onChange={set("priority")}>
            {(Object.keys(priorityLabel) as Priority[]).map((p) => <option key={p} value={p}>{priorityLabel[p]}</option>)}
          </select>
        </Field>
        <Field label="Prazo" htmlFor="d-due"><input id="d-due" type="date" className={fieldClass} value={f.due_date} onChange={set("due_date")} /></Field>
        <Field label="Responsável" htmlFor="d-resp">
          <select id="d-resp" className={fieldClass} value={f.responsible_id} onChange={set("responsible_id")}>
            <option value="">Sem responsável</option>
            {members.data?.filter((x) => x.active).map((x) => <option key={x.user_id} value={x.user_id}>{x.profiles?.full_name}</option>)}
          </select>
        </Field>
        <Field label="Time" htmlFor="d-team">
          <select id="d-team" className={fieldClass} value={f.team_id} onChange={set("team_id")}>
            <option value="">Sem time</option>
            {teams.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Descrição" htmlFor="d-desc"><textarea id="d-desc" maxLength={4000} className={textareaClass} value={f.description} onChange={set("description")} /></Field>
      <FormError message={err} />
      <button type="submit" className="btn-cta w-full" disabled={m.isPending}>{m.isPending ? "Criando…" : "Criar demanda"}</button>
    </form>
  );
}
