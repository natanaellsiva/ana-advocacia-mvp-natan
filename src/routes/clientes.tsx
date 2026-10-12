import { createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { AppShell, EmptyState, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — ANA" },
      { name: "description", content: "Cadastro de clientes do escritório." },
      { property: "og:title", content: "Clientes — ANA" },
      { property: "og:description", content: "Cadastro de clientes do escritório." },
    ],
  }),
  component: () => (
    <AppShell>
      <PageHeader title="Clientes" description="Clientes associados às demandas do escritório." action={<button className="btn-cta" disabled>Novo cliente</button>} />
      <EmptyState icon={Building2} title="Nenhum cliente ainda" description="O cadastro de clientes será habilitado na Fase 4." />
    </AppShell>
  ),
});
