import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { AppShell, EmptyState, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/equipe")({
  head: () => ({
    meta: [
      { title: "Equipe — ANA" },
      { name: "description", content: "Membros da equipe e papéis no escritório." },
      { property: "og:title", content: "Equipe — ANA" },
      { property: "og:description", content: "Membros da equipe e papéis no escritório." },
    ],
  }),
  component: () => (
    <AppShell>
      <PageHeader title="Equipe" description="Membros, papéis e carga de trabalho." />
      <EmptyState icon={Users} title="Nenhum membro listado" description="A gestão de equipe será habilitada após autenticação e papéis (Fases 3 e 4)." />
    </AppShell>
  ),
});
