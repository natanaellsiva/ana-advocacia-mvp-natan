import { createFileRoute } from "@tanstack/react-router";
import { FolderKanban } from "lucide-react";
import { AppShell, EmptyState, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/demandas")({
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
      <PageHeader title="Demandas" description="Acompanhe demandas, tarefas e revisões." action={<button className="btn-cta" disabled>Nova demanda</button>} />
      <EmptyState icon={FolderKanban} title="Nenhuma demanda ainda" description="O cadastro de demandas será habilitado após a conexão com o banco (Fase 4)." />
    </AppShell>
  ),
});
