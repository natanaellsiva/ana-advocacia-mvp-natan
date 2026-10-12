import { createFileRoute } from "@tanstack/react-router";
import { LayoutGrid } from "lucide-react";
import { AppShell, EmptyState, PageHeader } from "@/components/app-shell";

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
      <PageHeader title="Painel" description="Visão geral das demandas e da carga de trabalho do escritório." />
      <EmptyState icon={LayoutGrid} title="Métricas ainda não disponíveis" description="As métricas serão calculadas a partir dos dados reais do banco quando o painel for implementado (Fase 6)." />
    </AppShell>
  ),
});
