import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { DashboardBody } from "@/routes/_authenticated/painel";
import type { DemandStatus, TaskStatus } from "@/lib/domain";

// TEMPORARY layout-preview route used only to check the dashboard at mobile widths.
// Renders the real dashboard body component with sample rows; delete after verifying.

const U = "11111111-1111-4111-8111-111111111111";
const V = "22222222-2222-4222-8222-222222222222";

const ds = [
  { status: "nova" }, { status: "em_andamento" }, { status: "em_andamento" },
  { status: "em_revisao" }, { status: "concluida" }, { status: "cancelada" },
] as { status: DemandStatus }[];

const mk = (
  id: string, title: string, status: TaskStatus, due_date: string, demand_id: string, assignee_id: string,
  full_name: string, demandTitle: string,
) => ({ id, title, status, due_date, demand_id, assignee_id, assignee: { full_name }, demands: { title: demandTitle } });

const ts = [
  mk("a1", "Analisar cláusulas de rescisão e multa contratual", "pendente", "2026-09-30", U, V, "Maria Eduarda Cavalcanti", "Revisão do Contrato de Locação Comercial nº 4582/2026 — Imobiliária Horizonte Ltda"),
  mk("a2", "Protelar defesa", "correcao", "2026-09-12", U, V, "João", "Contrato"),
  mk("a3", "Elaborar notificação extrajudicial", "em_revisao", "2026-10-01", V, U, "Natanael Leite Silva", "Ação de Cobrança"),
  mk("a4", "Juntar documentos", "concluida", "2026-11-01", V, U, "Ana Beatriz", "Honorários"),
] as const;

export const Route = createFileRoute("/painel-preview")({
  component: () => (
    <div className="flex min-h-screen w-full bg-deepest">
      <div className="flex min-w-0 flex-1 flex-col bg-background bg-app-aurora">
        <main className="flex-1 px-4 py-8 md:px-8">
          <DashboardBody me={{ fullName: "Natanael Leite Silva", userId: U, isManager: true }} ds={ds} ts={ts as never} />
        </main>
      </div>
    </div>
  ),
});
