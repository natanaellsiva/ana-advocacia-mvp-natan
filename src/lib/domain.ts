import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type DemandStatus = Database["public"]["Enums"]["demand_status"];
export type TaskStatus = Database["public"]["Enums"]["task_status"];
export type Priority = Database["public"]["Enums"]["priority"];

export const fieldClass =
  "block h-11 w-full rounded-field border bg-elevated px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60";
export const textareaClass =
  "block min-h-24 w-full rounded-field border bg-elevated px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
export const btnGhost =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium text-foreground transition-colors hover:bg-elevated disabled:opacity-50";

export const demandStatusLabel: Record<DemandStatus, string> = {
  nova: "Nova",
  em_andamento: "Em andamento",
  em_revisao: "Em revisão",
  concluida: "Concluída",
  cancelada: "Cancelada",
};
export const demandStatuses: DemandStatus[] = ["nova", "em_andamento", "em_revisao", "concluida", "cancelada"];

export const taskStatusLabel: Record<TaskStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  em_revisao: "Em revisão",
  correcao: "Correção solicitada",
  concluida: "Concluída",
};

export const priorityLabel: Record<Priority, string> = { baixa: "Baixa", media: "Média", alta: "Alta", urgente: "Urgente" };

const tones = {
  neutral: "bg-elevated text-muted-foreground",
  primary: "bg-accent text-primary",
  secondary: "bg-secondary/20 text-secondary-foreground",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-destructive/15 text-destructive",
};
export const demandTone: Record<DemandStatus, string> = {
  nova: tones.neutral, em_andamento: tones.primary, em_revisao: tones.warning, concluida: tones.success, cancelada: tones.danger,
};
export const taskTone: Record<TaskStatus, string> = {
  pendente: "border border-muted-foreground bg-card text-foreground", em_andamento: tones.primary, em_revisao: tones.warning, correcao: tones.danger, concluida: tones.success,
};
export const priorityTone: Record<Priority, string> = {
  baixa: tones.neutral, media: tones.primary, alta: tones.warning, urgente: tones.danger,
};

export function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  const date = d.length === 10 ? new Date(`${d}T00:00:00`) : new Date(d);
  return date.toLocaleDateString("pt-BR");
}
export function formatDateTime(d: string) {
  return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
export function isOverdue(d: string | null | undefined) {
  if (!d) return false;
  return new Date(`${d}T23:59:59`) < new Date();
}

const errorMap: [string, string][] = [
  ["All required tasks must be completed", "Todas as tarefas obrigatórias precisam estar concluídas antes de concluir a demanda."],
  ["cannot review your own task", "Você não pode revisar a própria tarefa."],
  ["comment is required when rejecting", "Informe um comentário ao solicitar correção."],
  ["finished demand", "Esta demanda já foi finalizada e não pode ser alterada."],
  ["Only the assignee", "Apenas o responsável pela tarefa pode fazer isso."],
  ["Only admins and coordinators", "Apenas administradores e coordenadores podem fazer isso."],
  ["cannot be started from status", "Esta tarefa não pode ser iniciada no status atual."],
  ["cannot be submitted from status", "Esta tarefa não pode ser enviada no status atual."],
  ["not awaiting review", "Esta tarefa não está aguardando revisão."],
  ["must be an active member", "A pessoa escolhida precisa ser um membro ativo do escritório."],
  ["row-level security", "Você não tem permissão para esta ação."],
  ["duplicate key", "Este registro já existe."],
  ["Forbidden", "Você não tem permissão para esta ação."],
];
export function friendlyDbError(err: unknown) {
  const msg = err instanceof Error ? err.message : typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : String(err);
  for (const [k, v] of errorMap) if (msg.toLowerCase().includes(k.toLowerCase())) return v;
  return msg || "Algo deu errado. Tente novamente.";
}

async function unwrap<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data as T;
}

export const membersQuery = (officeId: string) =>
  queryOptions({
    queryKey: ["members", officeId],
    queryFn: () =>
      unwrap(
        supabase
          .from("office_members")
          .select("id, user_id, role, active, profiles(full_name, email)")
          .eq("office_id", officeId)
          .order("created_at"),
      ),
  });

export const clientsQuery = (officeId: string) =>
  queryOptions({
    queryKey: ["clients", officeId],
    queryFn: () => unwrap(supabase.from("clients").select("*").eq("office_id", officeId).order("name")),
  });

export const teamsQuery = (officeId: string) =>
  queryOptions({
    queryKey: ["teams", officeId],
    queryFn: () =>
      unwrap(
        supabase
          .from("teams")
          .select("id, name, team_members(id, user_id, profiles(full_name))")
          .eq("office_id", officeId)
          .order("name"),
      ),
  });

export const demandsQuery = (officeId: string) =>
  queryOptions({
    queryKey: ["demands", officeId],
    queryFn: () =>
      unwrap(
        supabase
          .from("demands")
          .select("id, title, status, priority, due_date, created_at, clients(name), responsible:profiles!demands_responsible_id_fkey(full_name), tasks(id, status, required)")
          .eq("office_id", officeId)
          .order("created_at", { ascending: false }),
      ),
  });

export const demandQuery = (id: string) =>
  queryOptions({
    queryKey: ["demand", id],
    queryFn: async () => {
      const [demand, tasks, history] = await Promise.all([
        unwrap(
          supabase
            .from("demands")
            .select("*, clients(name), teams(name), responsible:profiles!demands_responsible_id_fkey(full_name)")
            .eq("id", id)
            .maybeSingle(),
        ),
        unwrap(
          supabase
            .from("tasks")
            .select("*, assignee:profiles!tasks_assignee_id_fkey(full_name)")
            .eq("demand_id", id)
            .order("created_at"),
        ),
        unwrap(
          supabase
            .from("demand_history")
            .select("id, action, details, created_at, profiles(full_name)")
            .eq("demand_id", id)
            .order("created_at", { ascending: false }),
        ),
      ]);
      return { demand, tasks, history };
    },
  });

export const historyLabel: Record<string, string> = {
  demand_created: "Demanda criada",
  responsible_changed: "Responsável alterado",
  task_assigned: "Tarefa atribuída",
  task_started: "Tarefa iniciada",
  task_submitted: "Tarefa enviada para revisão",
  task_approved: "Tarefa aprovada",
  task_rejected: "Correção solicitada",
  status_changed: "Status alterado",
  demand_cancelled: "Demanda cancelada",
};
