import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ClipboardCheck, FolderOpen, LayoutGrid } from "lucide-react";
import type { ReactNode } from "react";
import { AppShell, EmptyState, PageHeader } from "@/components/app-shell";
import { Badge, LoadingBlock, useMe } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  demandStatuses, demandStatusLabel, demandsQuery, formatDate, friendlyDbError, isOverdue, taskStatusLabel, taskTone,
  type DemandStatus, type TaskStatus,
} from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel — ANA | A Nova Advocacia" },
      { name: "description", content: "Visão geral das demandas e da carga de trabalho do escritório." },
      { property: "og:title", content: "Painel — ANA | A Nova Advocacia" },
      { property: "og:description", content: "Visão geral das demandas e da carga de trabalho do escritório." },
    ],
  }),
  component: () => (
    <AppShell>
      <Dashboard />
    </AppShell>
  ),
});

type TaskRow = {
  id: string; title: string; status: TaskStatus; due_date: string; demand_id: string; assignee_id: string;
  assignee: { full_name: string } | null; demands: { title: string } | null;
};

const tasksQuery = (officeId: string) =>
  queryOptions({
    queryKey: ["office-tasks", officeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, status, due_date, demand_id, assignee_id, assignee:profiles!tasks_assignee_id_fkey(full_name), demands(title)")
        .eq("office_id", officeId)
        .order("due_date");
      if (error) throw error;
      return data as unknown as TaskRow[];
    },
  });

const barTone: Record<DemandStatus, string> = {
  nova: "bg-muted-foreground", em_andamento: "bg-primary", em_revisao: "bg-warning", concluida: "bg-success", cancelada: "bg-destructive",
};

function Dashboard() {
  const me = useMe();
  const demands = useQuery(demandsQuery(me.officeId));
  const tasks = useQuery(tasksQuery(me.officeId));

  if (demands.isLoading || tasks.isLoading) {
    return (
      <>
        <PageHeader
          title={`Olá, ${me.fullName.split(" ")[0]}`}
          description={me.isManager ? "Visão geral das demandas e da carga de trabalho do escritório." : "Suas demandas e tarefas."}
        />
        <LoadingBlock />
      </>
    );
  }
  if (demands.error || tasks.error) {
    return (
      <EmptyState
        icon={LayoutGrid}
        title="Erro ao carregar o painel"
        description={friendlyDbError(demands.error ?? tasks.error)}
      />
    );
  }

  return (
    <DashboardBody
      me={me}
      ds={(demands.data ?? []) as { status: DemandStatus }[]}
      ts={tasks.data ?? []}
    />
  );
}

export type PainelViewer = { fullName: string; userId: string; isManager: boolean };

export function DashboardBody({ me, ds, ts }: { me: PainelViewer; ds: { status: DemandStatus }[]; ts: TaskRow[] }) {
  const count = (s: DemandStatus) => ds.filter((d) => d.status === s).length;
  const open = count("nova") + count("em_andamento") + count("em_revisao");
  const overdue = ts.filter((t) => t.status !== "concluida" && isOverdue(t.due_date));
  const awaitingReview = ts.filter((t) => t.status === "em_revisao" && t.assignee_id !== me.userId);
  const mine = ts.filter((t) => t.assignee_id === me.userId && t.status !== "concluida");
  const max = Math.max(1, ...demandStatuses.map(count));

  return (
    <>
      <PageHeader
        title={`Olá, ${me.fullName.split(" ")[0]}`}
        description={me.isManager ? "Visão geral das demandas e da carga de trabalho do escritório." : "Suas demandas e tarefas."}
      />

      <section aria-label="Indicadores" className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={FolderOpen} label="Demandas abertas" value={open} hint="Novas, em andamento ou em revisão" />
        <Metric icon={CheckCircle2} label="Demandas concluídas" value={count("concluida")} tone="text-success" />
        <Metric icon={AlertTriangle} label="Tarefas atrasadas" value={overdue.length} tone={overdue.length ? "text-destructive" : undefined} hint="Prazo vencido e não concluídas" />
        <Metric icon={ClipboardCheck} label={me.isManager ? "Aguardando sua revisão" : "Minhas tarefas abertas"} value={me.isManager ? awaitingReview.length : mine.length} tone="text-warning" />
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <section aria-labelledby="dist-h" className="surface-card p-5 sm:p-6">
          <h2 id="dist-h" className="mb-1 text-lg font-semibold">Distribuição por status</h2>
          <p className="mb-5 text-sm text-muted-foreground">{ds.length} demanda(s) no total</p>
          {ds.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma demanda cadastrada ainda.</p>
          ) : (
            <ul className="space-y-4">
              {demandStatuses.map((s) => {
                const n = count(s);
                const pct = ds.length ? Math.round((n / ds.length) * 100) : 0;
                return (
                  <li key={s}>
                    <div className="mb-1.5 flex min-w-0 items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">{demandStatusLabel[s]}</span>
                      <span className="shrink-0 text-muted-foreground">{n} · {pct}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-elevated" role="img" aria-label={`${demandStatusLabel[s]}: ${n} demandas, ${pct}%`}>
                      <div className={cn("h-full rounded-full", barTone[s])} style={{ width: `${(n / max) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <TaskList title="Tarefas atrasadas" empty="Nenhuma tarefa atrasada. 🎉" tasks={overdue} />
        {me.isManager && <TaskList title="Aguardando revisão" empty="Nenhuma tarefa aguardando revisão." tasks={awaitingReview} />}
        <TaskList title="Minhas tarefas" empty="Você não tem tarefas abertas." tasks={mine} />
      </div>
    </>
  );
}

function Metric({ icon: Icon, label, value, hint, tone }: { icon: typeof LayoutGrid; label: string; value: number; hint?: string | undefined; tone?: string | undefined }) {
  return (
    <div className="surface-card min-w-0 p-5">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <p className="min-w-0 text-sm text-muted-foreground">{label}</p>
        <Icon className={cn("h-5 w-5 shrink-0 text-primary", tone)} aria-hidden />
      </div>
      <p className={cn("mt-2 font-display text-3xl font-bold", tone)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function TaskList({ title, empty, tasks }: { title: string; empty: ReactNode; tasks: TaskRow[] }) {
  const id = title.replace(/\s/g, "-");
  return (
    <section aria-labelledby={id} className="surface-card min-w-0 p-5 sm:p-6">
      <h2 id={id} className="mb-4 min-w-0 text-lg font-semibold">
        {title} <span className="text-sm font-normal text-muted-foreground">({tasks.length})</span>
      </h2>
      {tasks.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : (
        <ul className="space-y-2">
          {tasks.slice(0, 8).map((t) => (
            <li key={t.id} className="min-w-0">
              <Link
                to="/demandas/$demandaId"
                params={{ demandaId: t.demand_id }}
                className="grid min-h-11 min-w-0 grid-cols-1 gap-x-3 gap-y-1.5 rounded-field bg-elevated px-4 py-2.5 hover:bg-elevated/70 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{t.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{t.demands?.title} · {t.assignee?.full_name}</span>
                </span>
                <span className="flex shrink-0 items-center justify-between gap-2 lg:flex-col lg:items-end lg:gap-1">
                  <Badge className={taskTone[t.status]}>{taskStatusLabel[t.status]}</Badge>
                  <span className={cn("text-xs", t.status !== "concluida" && isOverdue(t.due_date) ? "text-destructive" : "text-muted-foreground")}>{formatDate(t.due_date)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
